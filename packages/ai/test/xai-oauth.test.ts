/**
 * 文件职责：验证 xAI OAuth 设备码登录与刷新令牌流程的请求格式、轮询节奏、安全校验和错误处理。
 * 技术维度：使用 Vitest 假时钟、全局 fetch 模拟、AbortController 与 Response/URLSearchParams 构造协议级测试。
 * 产品维度：保障用户通过 Grok/xAI 订阅登录时看到可信验证地址，并能正确等待授权、取消或刷新凭据。
 * 逻辑维度：先定义响应和调用包装器，再覆盖 pending/slow_down、默认间隔、URI 安全、拒绝、取消和刷新场景。
 * 关键边界：只信任 HTTPS 验证地址；令牌过期时间预留五分钟；每个用例后必须恢复全局模拟和真实时钟。
 * 新手阅读建议：先看 deviceCodeResponse、tokenResponse 和 loginXaiForTest，再按正常登录、异常登录、刷新顺序阅读。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { xaiOAuth } from "../src/auth/oauth/xai.ts";
import type { OAuthCredential } from "../src/auth/types.ts";

/** 构造 JSON Response。body 为载荷，status 默认为 200；返回带 JSON 类型头的响应。示例：jsonResponse({ok: true})。 */
function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

/** 从 fetch 的多种 input 形式提取 URL 字符串，不支持的类型抛错。示例：requestUrl(input)。 */
function requestUrl(input: unknown): string {
	if (typeof input === "string") return input;
	if (input instanceof URL) return input.toString();
	if (input instanceof Request) return input.url;
	throw new Error(`Unsupported request input: ${String(input)}`);
}

/** 将请求体转换成 URLSearchParams。返回便于断言的表单对象。示例：requestForm(init)。 */
function requestForm(init: RequestInit | undefined): URLSearchParams {
	return new URLSearchParams(String(init?.body));
}

/** 创建标准设备码响应，并允许 overrides 覆盖字段。返回 JSON 记录。示例：deviceCodeResponse({interval: 1})。 */
function deviceCodeResponse(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		device_code: "device-code",
		user_code: "ABCD-1234",
		verification_uri: "https://accounts.x.ai/oauth2/device",
		expires_in: 900,
		interval: 5,
		...overrides,
	};
}

/** 创建标准令牌响应，并允许 overrides 模拟缺失或轮换字段。返回 JSON 记录。示例：tokenResponse()。 */
function tokenResponse(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		access_token: "access-token",
		refresh_token: "refresh-token",
		expires_in: 21_600,
		token_type: "Bearer",
		...overrides,
	};
}

/** 登录回调收到的设备码展示信息。 */
type DeviceCodeInfo = {
	userCode: string;
	verificationUri: string;
	intervalSeconds?: number;
	expiresInSeconds?: number;
};

/** 用固定 prompt/notify 适配器调用 xAI 登录。返回 OAuth 凭据。示例：loginXaiForTest({onDeviceCode})。 */
function loginXaiForTest(options: {
	onDeviceCode: (info: DeviceCodeInfo) => void;
	signal?: AbortSignal;
}): Promise<OAuthCredential> {
	return xaiOAuth.login({
		signal: options.signal,
		prompt: () => {
			throw new Error("Unexpected prompt");
		},
		notify: (event) => {
			if (event.type === "device_code") {
				const { type: _, ...info } = event;
				/** _ 丢弃事件类型字段，info 保留设备码回调所需的其余公开信息。 */
				options.onDeviceCode(info);
			}
		},
	});
}

/** 使用给定刷新令牌调用 xAI 刷新。返回新的 OAuth 凭据。示例：refreshXaiForTest("token")。 */
function refreshXaiForTest(refreshToken: string): Promise<OAuthCredential> {
	return xaiOAuth.refresh({ type: "oauth", access: "old-access", refresh: refreshToken, expires: 0 });
}

describe("xAI OAuth device flow", () => {
	/** 每个用例后恢复 fetch、计时器和所有 Vitest 模拟。 */
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	/** 验证设备授权 pending 与 slow_down 会按协议调整轮询时间。 */
	it("uses the device grant, delays polling, and handles pending and slow_down", async () => {
		vi.useFakeTimers();
		/** 假时钟的固定起点。 */
		const startTime = new Date("2026-07-09T20:00:00Z");
		vi.setSystemTime(startTime);
		/** 每次令牌轮询发生的系统时间。 */
		const pollTimes: number[] = [];
		/** 令牌端点依次返回 pending、slow_down 和成功。 */
		const tokenReplies = [
			jsonResponse({ error: "authorization_pending" }, 400),
			jsonResponse({ error: "slow_down", interval: 10 }, 400),
			jsonResponse(tokenResponse()),
		];

		/** 模拟设备码和令牌两个端点的 fetch。 */
		const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
			/** 当前 fetch 请求 URL。 */
			const url = requestUrl(input);

			if (url === "https://auth.x.ai/oauth2/device/code") {
				/** 设备码请求表单。 */
				const form = requestForm(init);
				expect(form.get("client_id")).toBe("b1a00492-073a-47ea-816f-4c329264a828");
				expect(form.get("scope")).toBe("openid profile email offline_access grok-cli:access api:access");
				expect(form.get("referrer")).toBe("pi");
				return jsonResponse(deviceCodeResponse());
			}

			if (url === "https://auth.x.ai/oauth2/token") {
				pollTimes.push(Date.now());
				/** 令牌轮询请求表单。 */
				const form = requestForm(init);
				expect(form.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:device_code");
				expect(form.get("client_id")).toBe("b1a00492-073a-47ea-816f-4c329264a828");
				expect(form.get("device_code")).toBe("device-code");
				/** 当前轮询应返回的预设响应。 */
				const reply = tokenReplies.shift();
				if (!reply) throw new Error("Unexpected token poll");
				return reply;
			}

			throw new Error(`Unexpected request: ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		/** notify 回调收到的设备码信息。 */
		const deviceCodes: DeviceCodeInfo[] = [];
		/** 正在等待轮询成功的登录 Promise。 */
		const loginPromise = loginXaiForTest({ onDeviceCode: (info) => deviceCodes.push(info) });

		await vi.advanceTimersByTimeAsync(0);
		expect(deviceCodes).toEqual([
			{
				userCode: "ABCD-1234",
				verificationUri: "https://accounts.x.ai/oauth2/device",
				intervalSeconds: 5,
				expiresInSeconds: 900,
			},
		]);
		expect(pollTimes).toEqual([]);

		await vi.advanceTimersByTimeAsync(5000);
		expect(pollTimes).toEqual([startTime.getTime() + 5000]);

		// slow_down raised the interval to 10 seconds
		// slow_down 将后续轮询间隔提高到 10 秒。
		await vi.advanceTimersByTimeAsync(5000);
		expect(pollTimes).toEqual([startTime.getTime() + 5000, startTime.getTime() + 10_000]);

		await vi.advanceTimersByTimeAsync(10_000);
		/** 完成三次轮询后得到的凭据。 */
		const credentials = await loginPromise;
		expect(pollTimes).toEqual([
			startTime.getTime() + 5000,
			startTime.getTime() + 10_000,
			startTime.getTime() + 20_000,
		]);
		expect(credentials).toEqual({
			type: "oauth",
			access: "access-token",
			refresh: "refresh-token",
			expires: startTime.getTime() + 20_000 + 21_600_000 - 300_000,
		});
	});

	/** 验证服务返回 interval=0 时采用 RFC 默认五秒间隔。 */
	it("falls back to the default poll interval when the response reports interval 0", async () => {
		vi.useFakeTimers();
		/** 假时钟的固定起点。 */
		const startTime = new Date("2026-07-09T20:00:00Z");
		vi.setSystemTime(startTime);
		/** 实际发生令牌轮询的时间。 */
		const pollTimes: number[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: unknown) => {
				if (requestUrl(input) === "https://auth.x.ai/oauth2/device/code") {
					return jsonResponse(deviceCodeResponse({ interval: 0 }));
				}
				pollTimes.push(Date.now());
				return jsonResponse(tokenResponse());
			}),
		);

		/** 等待默认轮询间隔后完成的登录 Promise。 */
		const loginPromise = loginXaiForTest({ onDeviceCode: () => {} });
		// RFC 8628 default interval is 5 seconds when the server does not require a wait.
		// RFC 8628 规定服务未给出有效等待值时默认间隔为五秒。
		await vi.advanceTimersByTimeAsync(5000);
		await loginPromise;
		expect(pollTimes).toEqual([startTime.getTime() + 5000]);
	});

	/** 验证存在完整验证 URI 时优先展示它。 */
	it("prefers verification_uri_complete when the server provides it", async () => {
		vi.useFakeTimers();
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: unknown) => {
				if (requestUrl(input) === "https://auth.x.ai/oauth2/device/code") {
					return jsonResponse(
						deviceCodeResponse({
							verification_uri_complete: "https://accounts.x.ai/oauth2/device?user_code=ABCD-1234",
						}),
					);
				}
				return jsonResponse(tokenResponse());
			}),
		);

		/** notify 回调收到的设备码信息。 */
		const deviceCodes: DeviceCodeInfo[] = [];
		/** 使用完整验证 URI 的登录 Promise。 */
		const loginPromise = loginXaiForTest({ onDeviceCode: (info) => deviceCodes.push(info) });
		await vi.advanceTimersByTimeAsync(5000);
		await loginPromise;
		expect(deviceCodes).toEqual([
			{
				userCode: "ABCD-1234",
				verificationUri: "https://accounts.x.ai/oauth2/device?user_code=ABCD-1234",
				intervalSeconds: 5,
				expiresInSeconds: 900,
			},
		]);
	});

	/** 验证不安全的完整验证 URI 被拒绝。 */
	it("rejects a non-https verification_uri_complete", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				jsonResponse(
					deviceCodeResponse({
						verification_uri_complete: "http://accounts.x.ai/oauth2/device?user_code=ABCD-1234",
					}),
				),
			),
		);

		await expect(loginXaiForTest({ onDeviceCode: () => {} })).rejects.toThrow("Untrusted verification URI");
	});

	/** 逐项验证普通 verification_uri 也必须是 HTTPS。 */
	it.each(["http://accounts.x.ai/oauth2/device", "file:///etc/passwd", "not a url"])(
		"rejects a non-https verification URI: %s",
		async (verificationUri) => {
			vi.stubGlobal(
				"fetch",
				vi.fn(async () => jsonResponse(deviceCodeResponse({ verification_uri: verificationUri }))),
			);

			await expect(loginXaiForTest({ onDeviceCode: () => {} })).rejects.toThrow("Untrusted verification URI");
		},
	);

	/** 验证两种授权拒绝错误都会终止登录。 */
	it.each(["access_denied", "authorization_denied"])(
		"fails when device authorization is denied: %s",
		async (error) => {
			vi.useFakeTimers();
			/** 设备码请求与首次令牌轮询的累计请求次数。 */
			let requestCount = 0;
			vi.stubGlobal(
				"fetch",
				vi.fn(async () => {
					requestCount += 1;
					return requestCount === 1
						? jsonResponse(deviceCodeResponse({ interval: 1 }))
						: jsonResponse({ error }, 400);
				}),
			);

			/** 应在首次令牌轮询后拒绝的登录 Promise。 */
			const loginPromise = loginXaiForTest({ onDeviceCode: () => {} });
			/** 提前注册的拒绝断言，避免假时钟推进前出现未处理拒绝。 */
			const assertion = expect(loginPromise).rejects.toThrow("xAI device authorization was denied");
			await vi.advanceTimersByTimeAsync(1000);
			await assertion;
		},
	);

	/** 验证首次轮询等待期间可由 AbortSignal 取消登录。 */
	it("cancels while waiting for the first token poll", async () => {
		vi.useFakeTimers();
		/** 在设备码通知回调中触发的中止控制器。 */
		const controller = new AbortController();
		/** 只应被调用一次的设备码 fetch 模拟。 */
		const fetchMock = vi.fn(async () => jsonResponse(deviceCodeResponse()));
		vi.stubGlobal("fetch", fetchMock);

		/** 收到设备码后立即中止的登录 Promise。 */
		const loginPromise = loginXaiForTest({
			onDeviceCode: () => controller.abort(),
			signal: controller.signal,
		});

		await expect(loginPromise).rejects.toThrow("Login cancelled");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	/** 验证刷新令牌轮换时采用新值，未轮换时保留旧值。 */
	it("refreshes tokens and preserves an unrotated refresh token", async () => {
		/** 两次刷新请求的累计次数。 */
		let requestCount = 0;
		/** 根据请求次数模拟轮换和未返回刷新令牌的 fetch。 */
		const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
			expect(requestUrl(input)).toBe("https://auth.x.ai/oauth2/token");
			/** 刷新令牌请求表单。 */
			const form = requestForm(init);
			expect(form.get("grant_type")).toBe("refresh_token");
			expect(form.get("client_id")).toBe("b1a00492-073a-47ea-816f-4c329264a828");
			requestCount += 1;
			if (requestCount === 1) {
				expect(form.get("refresh_token")).toBe("old-refresh");
				return jsonResponse(tokenResponse({ access_token: "new-access", refresh_token: "new-refresh" }));
			}
			expect(form.get("refresh_token")).toBe("keep-refresh");
			return jsonResponse(tokenResponse({ access_token: "newer-access", refresh_token: undefined }));
		});
		vi.stubGlobal("fetch", fetchMock);

		/** 服务返回新 refresh_token 后的凭据。 */
		const rotated = await refreshXaiForTest("old-refresh");
		/** 服务不返回 refresh_token 时保留旧值的凭据。 */
		const preserved = await refreshXaiForTest("keep-refresh");
		expect(rotated.type).toBe("oauth");
		expect(rotated.refresh).toBe("new-refresh");
		expect(rotated.access).toBe("new-access");
		expect(preserved.refresh).toBe("keep-refresh");
		expect(preserved.access).toBe("newer-access");
		expect(xaiOAuth.name).toBe("xAI (Grok/X subscription)");
		await expect(xaiOAuth.toAuth(preserved)).resolves.toEqual({ apiKey: "newer-access" });
	});

	/** 验证缺少 expires_in 时按一小时有效期计算并预留五分钟。 */
	it("assumes a one-hour lifetime when expires_in is missing", async () => {
		vi.useFakeTimers();
		/** 假时钟的固定起点。 */
		const startTime = new Date("2026-07-09T20:00:00Z");
		vi.setSystemTime(startTime);
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => jsonResponse(tokenResponse({ expires_in: undefined }))),
		);

		/** 使用默认有效期得到的刷新凭据。 */
		const credentials = await refreshXaiForTest("old-refresh");
		expect(credentials.expires).toBe(startTime.getTime() + 3_600_000 - 300_000);
	});

	/** 验证缺少 access_token 等必需字段时明确失败。 */
	it("rejects token responses with missing fields", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => jsonResponse(tokenResponse({ access_token: undefined }))),
		);

		await expect(refreshXaiForTest("old-refresh")).rejects.toThrow("Invalid xAI OAuth response field: access_token");
	});

	/** 验证刷新失败错误包含上游错误码和描述。 */
	it("surfaces the upstream error code and description on refresh failure", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => jsonResponse({ error: "invalid_grant", error_description: "refresh token revoked" }, 400)),
		);

		await expect(refreshXaiForTest("old-refresh")).rejects.toThrow(
			"xAI OAuth token refresh failed (HTTP 400): invalid_grant: refresh token revoked",
		);
	});
});
/**
 * 文件职责：验证 xAI OAuth 设备码登录与刷新令牌流程的请求格式、轮询节奏、安全校验和错误处理。
 * 技术维度：使用 Vitest 假时钟、全局 fetch 模拟、AbortController 与 Response/URLSearchParams 构造协议级测试。
 * 产品维度：保障用户通过 Grok/xAI 订阅登录时看到可信验证地址，并能正确等待授权、取消或刷新凭据。
 * 逻辑维度：先定义响应和调用包装器，再覆盖 pending/slow_down、默认间隔、URI 安全、拒绝、取消和刷新场景。
 * 关键边界：只信任 HTTPS 验证地址；令牌过期时间预留五分钟；每个用例后必须恢复全局模拟和真实时钟。
 * 新手阅读建议：先看 deviceCodeResponse、tokenResponse 和 loginXaiForTest，再按正常登录、异常登录、刷新顺序阅读。
 */
