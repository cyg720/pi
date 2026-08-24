/**
 * 文件职责：验证 Kimi Code OAuth 设备授权、轮询、主机覆盖、令牌刷新、限流重试和授权失败处理。
 * 技术维度：使用 Vitest 假定时器、全局 fetch/env stub、Web Response 与 URLSearchParams 检查协议请求。
 * 产品维度：保证用户可通过设备码登录 Kimi Code，刷新凭据，并在过期、拒绝或限流时得到正确结果。
 * 逻辑维度：构造 JSON 响应和交互记录器，分别模拟设备授权成功、失败、主机覆盖及刷新分支。
 * 关键边界：测试不访问真实认证服务；设备流首次轮询需等待 interval；invalid_grant 不重试，429 可重试。
 * 新手阅读建议：先看三个夹具函数，再跟随成功设备流的时间线，最后比较过期、拒绝与刷新重试用例。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { kimiCodingOAuth } from "../src/auth/oauth/kimi-coding.ts";
import type { AuthInteraction } from "../src/auth/types.ts";

/** Kimi Code OAuth 公共客户端标识。 */
const CLIENT_ID = "17e5f671-d194-4dfb-9706-5516cb48c098";
/** 默认 Kimi OAuth 服务根地址。 */
const OAUTH_HOST = "https://auth.kimi.com";

/**
 * 创建 JSON Web Response。
 * @param body 要序列化的响应正文。
 * @param status HTTP 状态码，默认 200。
 * @returns application/json 响应。
 * @example jsonResponse({ access_token: "a" });
 */
function jsonResponse(body: unknown, status: number = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

/**
 * 从 fetch 支持的输入类型中读取 URL 字符串。
 * @param input 字符串、URL 或 Request。
 * @returns 完整 URL 文本。
 * @example getUrl(new URL("https://example.com"));
 */
function getUrl(input: unknown): string {
	if (typeof input === "string") return input;
	if (input instanceof URL) return input.toString();
	if (input instanceof Request) return input.url;
	throw new Error(`Unsupported fetch input: ${String(input)}`);
}

/**
 * 创建标准设备授权成功响应，并允许覆盖字段。
 * @param overrides 要覆盖的设备码、间隔或有效期字段。
 * @returns 固定 Kimi 设备授权 JSON 响应。
 * @example deviceAuthorizationResponse({ interval: 1 });
 */
function deviceAuthorizationResponse(overrides?: Record<string, unknown>): Response {
	return jsonResponse({
		user_code: "ABCD-1234",
		device_code: "device-code-123",
		verification_uri: "https://www.kimi.com/code",
		verification_uri_complete: "https://www.kimi.com/code?user_code=ABCD-1234",
		interval: 5,
		expires_in: 600,
		...overrides,
	});
}

/**
 * 创建不允许文本输入、只记录通知事件的认证交互对象。
 * @param events 接收 device_code 等事件的数组。
 * @returns Kimi 登录可使用的 AuthInteraction。
 * @example createInteraction([]);
 */
function createInteraction(events: Array<Record<string, unknown>>): AuthInteraction {
	return {
		prompt: async () => {
			throw new Error("Kimi Code login should not prompt");
		},
		notify: (event) => events.push(event),
	};
}

/** 覆盖 Kimi Code OAuth 登录、刷新和错误恢复协议。 */
describe("Kimi Code OAuth", () => {
	/** 每个用例后恢复 mock、全局变量、环境变量和真实定时器。 */
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
		vi.useRealTimers();
	});

	it("logs in with the device authorization flow", async () => {
		vi.useFakeTimers();
		/** 固定系统时间，用于精确断言轮询和过期时间。 */
		const startTime = new Date("2026-07-20T00:00:00Z");
		vi.setSystemTime(startTime);

		/** 认证交互收到的通知事件。 */
		const events: Array<Record<string, unknown>> = [];
		/** 第一次待授权、第二次成功的令牌轮询响应队列。 */
		const pollResponses = [
			jsonResponse({ error: "authorization_pending" }, 400),
			jsonResponse({ access_token: "access-token", refresh_token: "refresh-token", expires_in: 3600 }),
		];
		/** 每次令牌轮询发生的系统时间。 */
		const pollTimes: number[] = [];

		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
				/** 当前 fetch 输入的 URL 文本。 */
				const url = getUrl(input);
				if (url === `${OAUTH_HOST}/api/oauth/device_authorization`) {
					expect(init?.method).toBe("POST");
					expect(init?.headers).toMatchObject({
						"Content-Type": "application/x-www-form-urlencoded",
						Accept: "application/json",
					});
					expect(new URLSearchParams(String(init?.body)).get("client_id")).toBe(CLIENT_ID);
					return deviceAuthorizationResponse();
				}
				if (url === `${OAUTH_HOST}/api/oauth/token`) {
					pollTimes.push(Date.now());
					/** 令牌轮询表单参数。 */
					const params = new URLSearchParams(String(init?.body));
					expect(params.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:device_code");
					expect(params.get("client_id")).toBe(CLIENT_ID);
					expect(params.get("device_code")).toBe("device-code-123");
					/** 从队列取出的本次令牌响应。 */
					const response = pollResponses.shift();
					if (!response) throw new Error("Unexpected extra token poll");
					return response;
				}
				throw new Error(`Unexpected fetch URL: ${url}`);
			}),
		);

		/** 尚未完成的设备登录 Promise。 */
		const credentialPromise = kimiCodingOAuth.login(createInteraction(events));
		for (let i = 0; i < 5 && events.length === 0; i++) {
			await vi.advanceTimersByTimeAsync(0);
		}
		expect(events).toEqual([
			{
				type: "device_code",
				userCode: "ABCD-1234",
				verificationUri: "https://www.kimi.com/code?user_code=ABCD-1234",
				intervalSeconds: 5,
				expiresInSeconds: 600,
			},
		]);

		// waitBeforeFirstPoll: first poll happens after the 5s interval.
		// waitBeforeFirstPoll 要求首次轮询先完整等待 5 秒间隔。
		await vi.advanceTimersByTimeAsync(4999);
		expect(pollTimes).toEqual([]);
		await vi.advanceTimersByTimeAsync(1);
		expect(pollTimes).toEqual([startTime.getTime() + 5000]);

		await vi.advanceTimersByTimeAsync(5000);
		await expect(credentialPromise).resolves.toEqual({
			type: "oauth",
			access: "access-token",
			refresh: "refresh-token",
			expires: startTime.getTime() + 10000 + 3600 * 1000,
		});
		expect(pollTimes).toEqual([startTime.getTime() + 5000, startTime.getTime() + 10000]);
	});

	it("fails when the device code expires", async () => {
		vi.useFakeTimers();
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: unknown): Promise<Response> => {
				/** 当前设备流 fetch URL。 */
				const url = getUrl(input);
				if (url === `${OAUTH_HOST}/api/oauth/device_authorization`) {
					return deviceAuthorizationResponse();
				}
				if (url === `${OAUTH_HOST}/api/oauth/token`) {
					return jsonResponse({ error: "expired_token" }, 400);
				}
				throw new Error(`Unexpected fetch URL: ${url}`);
			}),
		);

		/** 预期因设备码过期而拒绝的登录 Promise。 */
		const credentialPromise = kimiCodingOAuth.login(createInteraction([]));
		/** 在推进假定时器前先注册的拒绝断言，避免未处理 rejection。 */
		const assertion = expect(credentialPromise).rejects.toThrow("expired");
		await vi.advanceTimersByTimeAsync(5000);
		await assertion;
	});

	it("fails when the user denies the login", async () => {
		vi.useFakeTimers();
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: unknown): Promise<Response> => {
				/** 当前拒绝授权场景 fetch URL。 */
				const url = getUrl(input);
				if (url === `${OAUTH_HOST}/api/oauth/device_authorization`) {
					return deviceAuthorizationResponse();
				}
				if (url === `${OAUTH_HOST}/api/oauth/token`) {
					return jsonResponse({ error: "access_denied" }, 400);
				}
				throw new Error(`Unexpected fetch URL: ${url}`);
			}),
		);

		/** 预期因用户拒绝而失败的登录 Promise。 */
		const credentialPromise = kimiCodingOAuth.login(createInteraction([]));
		/** 在推进假定时器前注册的拒绝断言。 */
		const assertion = expect(credentialPromise).rejects.toThrow("denied");
		await vi.advanceTimersByTimeAsync(5000);
		await assertion;
	});

	it("honors the KIMI_CODE_OAUTH_HOST override", async () => {
		vi.useFakeTimers();
		vi.stubEnv("KIMI_CODE_OAUTH_HOST", "https://auth.example.com/");

		/** 主机覆盖场景实际访问的 URL 顺序。 */
		const urls: string[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: unknown): Promise<Response> => {
				/** 当前自定义主机场景 fetch URL。 */
				const url = getUrl(input);
				urls.push(url);
				if (url === "https://auth.example.com/api/oauth/device_authorization") {
					return deviceAuthorizationResponse({ interval: 1 });
				}
				if (url === "https://auth.example.com/api/oauth/token") {
					return jsonResponse({ access_token: "a", refresh_token: "r", expires_in: 60 });
				}
				throw new Error(`Unexpected fetch URL: ${url}`);
			}),
		);

		/** 使用 1 秒轮询间隔的自定义主机登录 Promise。 */
		const credentialPromise = kimiCodingOAuth.login(createInteraction([]));
		await vi.advanceTimersByTimeAsync(1000);
		await expect(credentialPromise).resolves.toMatchObject({ access: "a", refresh: "r" });
		expect(urls).toEqual([
			"https://auth.example.com/api/oauth/device_authorization",
			"https://auth.example.com/api/oauth/token",
		]);
	});

	it("refreshes tokens and returns a Bearer header for requests", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
				/** 刷新令牌请求 URL。 */
				const url = getUrl(input);
				expect(url).toBe(`${OAUTH_HOST}/api/oauth/token`);
				/** 刷新令牌表单参数。 */
				const params = new URLSearchParams(String(init?.body));
				expect(params.get("grant_type")).toBe("refresh_token");
				expect(params.get("refresh_token")).toBe("old-refresh");
				expect(params.get("client_id")).toBe(CLIENT_ID);
				return jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 3600 });
			}),
		);

		/** 发起刷新前的当前时间下界。 */
		const before = Date.now();
		/** 刷新后返回的新 OAuth 凭据。 */
		const credential = await kimiCodingOAuth.refresh({
			type: "oauth",
			access: "old-access",
			refresh: "old-refresh",
			expires: before,
		});
		expect(credential).toEqual({
			type: "oauth",
			access: "new-access",
			refresh: "new-refresh",
			expires: expect.any(Number),
		});
		expect(credential.expires).toBeGreaterThanOrEqual(before + 3600 * 1000);

		await expect(kimiCodingOAuth.toAuth(credential)).resolves.toEqual({
			headers: { Authorization: "Bearer new-access" },
		});
	});

	it("retries refresh on 429 and fails unauthorized on invalid_grant", async () => {
		vi.useFakeTimers();

		// 429 once, then success.
		// 首次返回 429，下一次成功，用于验证暂时错误重试。
		/** refresh fetch 已调用次数。 */
		let calls = 0;
		vi.stubGlobal(
			"fetch",
			vi.fn(async (): Promise<Response> => {
				calls += 1;
				if (calls === 1) return jsonResponse({ error: "temporarily_unavailable" }, 429);
				return jsonResponse({ access_token: "a", refresh_token: "r", expires_in: 60 });
			}),
		);

		/** 首次限流后应自动重试的刷新 Promise。 */
		const refreshPromise = kimiCodingOAuth.refresh({
			type: "oauth",
			access: "old",
			refresh: "old",
			expires: 0,
		});
		await vi.advanceTimersByTimeAsync(1000);
		await expect(refreshPromise).resolves.toMatchObject({ access: "a" });
		expect(calls).toBe(2);

		// invalid_grant is not retried.
		// invalid_grant 表示刷新凭据失效，不应继续重试。
		vi.stubGlobal(
			"fetch",
			vi.fn(async (): Promise<Response> => jsonResponse({ error: "invalid_grant" }, 400)),
		);
		await expect(
			kimiCodingOAuth.refresh({ type: "oauth", access: "old", refresh: "old", expires: 0 }),
		).rejects.toThrow("unauthorized");
	});
});
