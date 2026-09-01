/**
 * 【文件职责】实现 `@earendil-works/pi-ai` 包中的 `auth/oauth/kimi-coding` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `../../utils/provider-env.ts`、`../../utils/sleep.ts`、`../types.ts`、`./device-code.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为不同大模型提供统一 API、模型发现和供应商配置能力；本文件负责其中与 `auth/oauth/kimi-coding` 对应的子能力。
 * 【逻辑维度】对外入口包括 `kimiCodingOAuth`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `kimiCodingOAuth` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
/**
 * Kimi Code (subscription) OAuth flow
 *
 * RFC 8628 device authorization grant against https://auth.kimi.com with JSON
 * responses. The access token authenticates requests to
 *【中文说明】Kimi Code（订阅）OAuth 流程：RFC 8628 设备授权（auth.kimi.com，JSON 响应）；
 * 访问令牌作为 Bearer 认证 https://api.kimi.com/coding 请求。
 * https://api.kimi.com/coding as an `Authorization: Bearer` header.
 */

import { getProviderEnvValue } from "../../utils/provider-env.ts";
import { sleep } from "../../utils/sleep.ts";
import type { OAuthAuth, OAuthCredential, ProviderAuthInteraction } from "../types.ts";
import { pollOAuthDeviceCodeFlow } from "./device-code.ts";

// Kimi 客户端 ID
const CLIENT_ID = "17e5f671-d194-4dfb-9706-5516cb48c098";
const DEFAULT_OAUTH_HOST = "https://auth.kimi.com";
// 设备码轮询总超时（15 分钟）
const DEVICE_CODE_TIMEOUT_SECONDS = 15 * 60;
const DEFAULT_POLL_INTERVAL_SECONDS = 5;
const REQUEST_TIMEOUT_MS = 30 * 1000;
// 刷新最大重试次数
const REFRESH_MAX_RETRIES = 3;

type DeviceAuthorization = {
	deviceCode: string;
	userCode: string;
	verificationUri: string;
	verificationUriComplete: string;
	intervalSeconds: number;
	expiresInSeconds: number;
};

type TokenResponse = {
	access: string;
	refresh: string;
	expires: number;
};

function getOauthHost(): string {
	const override = getProviderEnvValue("KIMI_CODE_OAUTH_HOST") || getProviderEnvValue("KIMI_OAUTH_HOST");
	return (override || DEFAULT_OAUTH_HOST).replace(/\/+$/, "");
}

function requestSignal(signal: AbortSignal): AbortSignal {
	return AbortSignal.any([AbortSignal.timeout(REQUEST_TIMEOUT_MS), signal]);
}

function formUrlEncode(fields: Record<string, string>): string {
	return new URLSearchParams(fields).toString();
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
	try {
		const json = await response.json();
		return json && typeof json === "object" ? (json as Record<string, unknown>) : null;
	} catch {
		return null;
	}
}

/** The verification URI is opened in the user's browser; only http(s) URLs are trusted. */
function trustedHttpUrl(value: unknown): string | null {
	if (typeof value !== "string" || !value) return null;
	try {
		const url = new URL(value);
		if (url.protocol !== "https:" && url.protocol !== "http:") return null;
		return url.href;
	} catch {
		return null;
	}
}

async function startDeviceAuthorization(oauthHost: string, signal: AbortSignal): Promise<DeviceAuthorization> {
	const response = await fetch(`${oauthHost}/api/oauth/device_authorization`, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Accept: "application/json",
		},
		body: formUrlEncode({ client_id: CLIENT_ID }),
		signal: requestSignal(signal),
	});

	if (!response.ok) {
		const text = await response.text().catch(() => "");
		throw new Error(`Kimi Code device authorization failed with status ${response.status}${text ? `: ${text}` : ""}`);
	}

	const json = await readJson(response);
	const deviceCode = json?.device_code;
	const userCode = json?.user_code;
	const verificationUri = json?.verification_uri;
	const verificationUriComplete = json?.verification_uri_complete;
	if (
		typeof deviceCode !== "string" ||
		typeof userCode !== "string" ||
		typeof verificationUri !== "string" ||
		typeof verificationUriComplete !== "string" ||
		!trustedHttpUrl(verificationUriComplete) ||
		!trustedHttpUrl(verificationUri)
	) {
		throw new Error(`Invalid Kimi Code device authorization response: ${JSON.stringify(json)}`);
	}

	const interval = json?.interval;
	const expiresIn = json?.expires_in;
	return {
		deviceCode,
		userCode,
		verificationUri,
		verificationUriComplete,
		intervalSeconds:
			typeof interval === "number" && Number.isFinite(interval) && interval > 0
				? interval
				: DEFAULT_POLL_INTERVAL_SECONDS,
		expiresInSeconds:
			typeof expiresIn === "number" && Number.isFinite(expiresIn) && expiresIn > 0
				? expiresIn
				: DEVICE_CODE_TIMEOUT_SECONDS,
	};
}

function parseTokenResponse(json: Record<string, unknown> | null, operation: string): TokenResponse {
	const accessToken = json?.access_token;
	const refreshToken = json?.refresh_token;
	const expiresIn = json?.expires_in;
	if (
		typeof accessToken !== "string" ||
		!accessToken ||
		typeof refreshToken !== "string" ||
		!refreshToken ||
		typeof expiresIn !== "number" ||
		!Number.isFinite(expiresIn) ||
		expiresIn <= 0
	) {
		throw new Error(`Kimi Code token ${operation} response missing fields: ${JSON.stringify(json)}`);
	}
	return {
		access: accessToken,
		refresh: refreshToken,
		expires: Date.now() + expiresIn * 1000,
	};
}

async function pollForToken(
	oauthHost: string,
	device: DeviceAuthorization,
	signal: AbortSignal,
): Promise<TokenResponse> {
	return pollOAuthDeviceCodeFlow<TokenResponse>({
		intervalSeconds: device.intervalSeconds,
		expiresInSeconds: device.expiresInSeconds,
		waitBeforeFirstPoll: true,
		signal,
		poll: async () => {
			const response = await fetch(`${oauthHost}/api/oauth/token`, {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					Accept: "application/json",
				},
				body: formUrlEncode({
					client_id: CLIENT_ID,
					device_code: device.deviceCode,
					grant_type: "urn:ietf:params:oauth:grant-type:device_code",
				}),
				signal: requestSignal(signal),
			});

			if (response.status >= 500) {
				const text = await response.text().catch(() => "");
				return {
					status: "failed",
					message: `Kimi Code device token request failed with status ${response.status}${text ? `: ${text}` : ""}`,
				};
			}

			const json = await readJson(response);
			if (response.ok && typeof json?.access_token === "string") {
				try {
					return { status: "complete", value: parseTokenResponse(json, "poll") };
				} catch (error) {
					return { status: "failed", message: error instanceof Error ? error.message : String(error) };
				}
			}

			const error = json?.error;
			const description = typeof json?.error_description === "string" ? `: ${json.error_description}` : "";
			if (error === "authorization_pending") {
				return { status: "pending" };
			}
			if (error === "slow_down") {
				const interval = json?.interval;
				return {
					status: "slow_down",
					intervalSeconds: typeof interval === "number" && interval > 0 ? interval : undefined,
				};
			}
			if (error === "expired_token") {
				return { status: "failed", message: "Kimi Code device authorization expired. Please restart login." };
			}
			if (error === "access_denied") {
				return { status: "failed", message: "Kimi Code login was denied." };
			}
			return {
				status: "failed",
				message: `Kimi Code device token request failed (status ${response.status})${typeof error === "string" ? `: ${error}${description}` : ""}`,
			};
		},
	});
}

function isRetryableRefreshFailure(response: Response): boolean {
	return response.status === 429 || response.status >= 500;
}

async function refreshToken(oauthHost: string, refreshTokenValue: string, signal: AbortSignal): Promise<TokenResponse> {
	let lastError: Error | undefined;
	for (let attempt = 0; attempt <= REFRESH_MAX_RETRIES; attempt++) {
		if (attempt > 0) {
			await sleep(1000 * 2 ** (attempt - 1), signal);
		}
		if (signal.aborted) {
			throw new Error("Kimi Code token refresh aborted");
		}

		let response: Response;
		try {
			response = await fetch(`${oauthHost}/api/oauth/token`, {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					Accept: "application/json",
				},
				body: formUrlEncode({
					client_id: CLIENT_ID,
					grant_type: "refresh_token",
					refresh_token: refreshTokenValue,
				}),
				signal: requestSignal(signal),
			});
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
			continue;
		}

		const json = await readJson(response);
		if (response.ok) {
			return parseTokenResponse(json, "refresh");
		}

		// Unauthorized: the stored credential is dead; Models clears it and prompts re-login.
		if (response.status === 401 || response.status === 403 || json?.error === "invalid_grant") {
			const description = typeof json?.error_description === "string" ? `: ${json.error_description}` : "";
			throw new Error(`Kimi Code token refresh unauthorized (status ${response.status})${description}`);
		}

		if (isRetryableRefreshFailure(response) && attempt < REFRESH_MAX_RETRIES) {
			lastError = new Error(`Kimi Code token refresh failed with status ${response.status}`);
			continue;
		}

		const text = JSON.stringify(json);
		throw new Error(`Kimi Code token refresh failed with status ${response.status}${text ? `: ${text}` : ""}`);
	}

	throw lastError ?? new Error("Kimi Code token refresh failed");
}

async function loginKimiCoding(interaction: ProviderAuthInteraction): Promise<OAuthCredential> {
	const oauthHost = getOauthHost();
	const device = await startDeviceAuthorization(oauthHost, interaction.signal);
	interaction.notify({
		type: "device_code",
		userCode: device.userCode,
		verificationUri: device.verificationUriComplete,
		intervalSeconds: device.intervalSeconds,
		expiresInSeconds: device.expiresInSeconds,
	});
	const token = await pollForToken(oauthHost, device, interaction.signal);
	return { type: "oauth", access: token.access, refresh: token.refresh, expires: token.expires };
}

export const kimiCodingOAuth: OAuthAuth = {
	name: "Kimi Code (subscription)",
	isSubscription: true,
	loginLabel: "Sign in with Kimi Code",

	login: loginKimiCoding,

	refresh: async (credential, signal) => {
		const token = await refreshToken(getOauthHost(), credential.refresh, signal);
		return { type: "oauth", access: token.access, refresh: token.refresh, expires: token.expires };
	},

	async toAuth(credential) {
		return { headers: { Authorization: `Bearer ${credential.access}` } };
	},
};
