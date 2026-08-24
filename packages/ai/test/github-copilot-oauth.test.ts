/**
 * 文件职责：验证 GitHub Copilot OAuth 设备授权、令牌刷新、模型目录过滤、URI 安全和轮询节奏。
 * 技术维度：使用 Vitest 假计时器、全局 fetch 替身、Web Response/URL 以及内存凭据存储模拟 OAuth 网络流程。
 * 产品维度：确保用户登录 Copilot 时看到可信验证地址、合理等待提示，并只获得账户实际可用的模型。
 * 逻辑维度：先定义响应与登录适配器，再覆盖模型过滤、设备码通知、URI 校验、slow_down 和超时。
 * 关键边界：所有网络均为精确 URL 替身；假计时器必须在用例后恢复，恶意 URI 必须在通知前拒绝。
 * 新手阅读建议：先读 loginGitHubCopilotForTest 的事件转换，再看标准设备流，最后比较 slow_down 与超时。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryCredentialStore } from "../src/auth/credential-store.ts";
import { githubCopilotOAuth } from "../src/auth/oauth/github-copilot.ts";
import { createModels } from "../src/models.ts";
import { githubCopilotProvider } from "../src/providers/github-copilot.ts";

/** 构造 JSON HTTP 响应。参数 body 为响应体、status 为状态码且默认 200；返回 Response。例如：jsonResponse({ ok: true })。 */
function jsonResponse(body: unknown, status: number = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json",
		},
	});
}

/** 从 fetch 输入提取 URL。参数 input 可为字符串、URL 或 Request；返回 URL 字符串，不支持时抛错。例如：getUrl(input)。 */
function getUrl(input: unknown): string {
	if (typeof input === "string") {
		return input;
	}
	if (input instanceof URL) {
		return input.toString();
	}
	if (input instanceof Request) {
		return input.url;
	}
	throw new Error(`Unsupported fetch input: ${String(input)}`);
}

/** 把测试回调适配到 Copilot OAuth 登录接口。参数 options 接收设备码、提示、进度和中止；返回登录 Promise。例如：loginGitHubCopilotForTest(options)。 */
function loginGitHubCopilotForTest(options: {
	/** 接收用户码、验证地址、轮询间隔和有效期的设备码通知回调。 */
	onDeviceCode(info: {
		/** 用户需在验证页输入的一次性代码。 */
		userCode: string;
		/** 已校验并规范化的 HTTP(S) 验证地址。 */
		verificationUri: string;
		/** 服务端建议的轮询间隔秒数。 */
		intervalSeconds?: number;
		/** 设备码剩余有效秒数。 */
		expiresInSeconds?: number;
	}): void;
	/** 处理文本提示并返回用户输入的异步回调。 */
	onPrompt(prompt: { message: string; placeholder?: string; allowEmpty?: boolean }): Promise<string>;
	/** 可选进度消息回调。 */
	onProgress?(message: string): void;
	/** 可选中止信号，用于取消设备授权流程。 */
	signal?: AbortSignal;
}) {
	return githubCopilotOAuth.login({
		signal: options.signal,
		prompt: (prompt) => {
			if (prompt.type !== "text") throw new Error(`Unexpected prompt: ${prompt.type}`);
			return options.onPrompt({ message: prompt.message, placeholder: prompt.placeholder, allowEmpty: true });
		},
		notify: (event) => {
			if (event.type === "device_code") {
				/** 从设备码事件中剔除且不再使用的 type 字段。 */
				const { type: _, ...info } = event;
				options.onDeviceCode(info);
			}
			if (event.type === "progress") options.onProgress?.(event.message);
		},
	});
}

describe("GitHub Copilot OAuth device flow", () => {
	// 每个用例后撤销全局 fetch 替身并恢复真实计时器。
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	// 测试场景：验证“filters models to the authenticated account picker catalog”对应的 Copilot OAuth 行为。
	it("filters models to the authenticated account picker catalog", async () => {
		/** 模拟本用例 OAuth 与 Copilot API 请求的 fetch 函数；接收 fetch 输入和可选初始化，返回 Response Promise。例如：await fetchMock(url)。 */
		const fetchMock = vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
			/** 从当前 fetch 输入规范化得到的请求 URL。 */
			const url = getUrl(input);

			if (url.includes("/copilot_internal/v2/token")) {
				return jsonResponse({
					token: "tid=test;exp=9999999999;proxy-ep=proxy.individual.githubcopilot.com;",
					expires_at: 9999999999,
				});
			}

			if (url === "https://api.individual.githubcopilot.com/models") {
				expect(init?.headers).toMatchObject({
					Authorization: "Bearer tid=test;exp=9999999999;proxy-ep=proxy.individual.githubcopilot.com;",
				});
				return jsonResponse({
					data: [
						{
							id: "gpt-4.1",
							model_picker_enabled: true,
							capabilities: { supports: { tool_calls: true } },
						},
						{
							id: "claude-opus-4.7",
							model_picker_enabled: true,
							policy: { state: "disabled" },
							capabilities: { supports: { tool_calls: true } },
						},
						{
							id: "gpt-5.4-nano",
							model_picker_enabled: false,
							capabilities: { supports: { tool_calls: true } },
						},
					],
				});
			}

			throw new Error(`Unexpected fetch URL: ${url}`);
		});

		vi.stubGlobal("fetch", fetchMock);

		/** 刷新旧 OAuth 凭据后得到的新 Copilot 凭据与模型可用列表。 */
		const credentials = await githubCopilotOAuth.refresh({
			type: "oauth",
			access: "old-access-token",
			refresh: "ghu_refresh_token",
			expires: 0,
		});
		expect(credentials.availableModelIds).toEqual(["gpt-4.1"]);

		/** 保存刷新凭据的内存凭据存储。 */
		const store = new InMemoryCredentialStore();
		await store.modify("github-copilot", async () => ({ ...credentials, type: "oauth" }));
		/** 使用内存凭据并注册 Copilot 提供商的模型集合。 */
		const models = createModels({ credentials: store });
		models.setProvider(githubCopilotProvider());
		expect((await models.getAvailable("github-copilot")).map((model) => model.id)).toEqual(["gpt-4.1"]);
	});

	// 测试场景：验证“reports device-code details through onDeviceCode”对应的 Copilot OAuth 行为。
	it("reports device-code details through onDeviceCode", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-03-09T00:00:00Z"));

		/** 模拟本用例 OAuth 与 Copilot API 请求的 fetch 函数；接收 fetch 输入和可选初始化，返回 Response Promise。例如：await fetchMock(url)。 */
		const fetchMock = vi.fn(async (input: unknown): Promise<Response> => {
			/** 从当前 fetch 输入规范化得到的请求 URL。 */
			const url = getUrl(input);

			if (url.endsWith("/login/device/code")) {
				return jsonResponse({
					device_code: "device-code",
					user_code: "ABCD-EFGH",
					verification_uri: "https://github.com/login/device",
					interval: 1,
					expires_in: 900,
				});
			}

			if (url.endsWith("/login/oauth/access_token")) {
				return jsonResponse({ access_token: "ghu_refresh_token" });
			}

			if (url.includes("/copilot_internal/v2/token")) {
				return jsonResponse({
					token: "tid=test;exp=9999999999;proxy-ep=proxy.individual.githubcopilot.com;",
					expires_at: 9999999999,
				});
			}

			if (url.endsWith("/models")) {
				return jsonResponse({ data: [] });
			}

			if (url.includes("/models/") && url.endsWith("/policy")) {
				return new Response("", { status: 200 });
			}

			throw new Error(`Unexpected fetch URL: ${url}`);
		});

		vi.stubGlobal("fetch", fetchMock);

		/** 记录设备码通知参数的 Vitest 模拟函数。 */
		const onDeviceCode = vi.fn();
		/** 尚在轮询中的设备授权登录 Promise。 */
		const loginPromise = loginGitHubCopilotForTest({
			onDeviceCode,
			onPrompt: async () => "",
		});

		await vi.advanceTimersByTimeAsync(0);

		expect(onDeviceCode).toHaveBeenCalledWith({
			userCode: "ABCD-EFGH",
			verificationUri: "https://github.com/login/device",
			intervalSeconds: 1,
			expiresInSeconds: 900,
		});
		await vi.advanceTimersByTimeAsync(1000);
		await loginPromise;
	});

	// 测试场景：验证“rejects a non-http(s) verification_uri before it reaches onDeviceCode”对应的 Copilot OAuth 行为。
	it("rejects a non-http(s) verification_uri before it reaches onDeviceCode", async () => {
		// A malicious enterprise OAuth server could return a verification_uri that
		// the browser launcher would otherwise hand to the OS. Ensure such values
		// are rejected at the deserialization boundary.
		// 恶意企业 OAuth 服务可能返回会被浏览器启动器交给系统的地址，因此必须在反序列化边界拒绝。
		/** 模拟本用例 OAuth 与 Copilot API 请求的 fetch 函数；接收 fetch 输入和可选初始化，返回 Response Promise。例如：await fetchMock(url)。 */
		const fetchMock = vi.fn(async (input: unknown): Promise<Response> => {
			/** 从当前 fetch 输入规范化得到的请求 URL。 */
			const url = getUrl(input);
			if (url.endsWith("/login/device/code")) {
				return jsonResponse({
					device_code: "device-code",
					user_code: "ABCD-EFGH",
					verification_uri: "$(id>/tmp/pwned)",
					interval: 1,
					expires_in: 900,
				});
			}
			throw new Error(`Unexpected fetch URL: ${url}`);
		});

		vi.stubGlobal("fetch", fetchMock);

		/** 记录设备码通知参数的 Vitest 模拟函数。 */
		const onDeviceCode = vi.fn();
		await expect(
			loginGitHubCopilotForTest({
				onDeviceCode,
				onPrompt: async () => "",
			}),
		).rejects.toThrow(/Untrusted verification_uri/);
		expect(onDeviceCode).not.toHaveBeenCalled();
	});

	// 测试场景：验证“normalizes verification_uri before it reaches onDeviceCode”对应的 Copilot OAuth 行为。
	it("normalizes verification_uri before it reaches onDeviceCode", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-03-09T00:00:00Z"));

		/** 服务端返回、包含控制字符的原始验证地址。 */
		const rawVerificationUri = "https://github.com/login/\x1b]8;;evil";
		/** 经过 URL 解析器规范化后的可信验证地址。 */
		const normalizedVerificationUri = new URL(rawVerificationUri).href;
		expect(normalizedVerificationUri).not.toBe(rawVerificationUri);

		/** 模拟本用例 OAuth 与 Copilot API 请求的 fetch 函数；接收 fetch 输入和可选初始化，返回 Response Promise。例如：await fetchMock(url)。 */
		const fetchMock = vi.fn(async (input: unknown): Promise<Response> => {
			/** 从当前 fetch 输入规范化得到的请求 URL。 */
			const url = getUrl(input);

			if (url.endsWith("/login/device/code")) {
				return jsonResponse({
					device_code: "device-code",
					user_code: "ABCD-EFGH",
					verification_uri: rawVerificationUri,
					interval: 1,
					expires_in: 900,
				});
			}

			if (url.endsWith("/login/oauth/access_token")) {
				return jsonResponse({ access_token: "ghu_refresh_token" });
			}

			if (url.includes("/copilot_internal/v2/token")) {
				return jsonResponse({
					token: "tid=test;exp=9999999999;proxy-ep=proxy.individual.githubcopilot.com;",
					expires_at: 9999999999,
				});
			}

			if (url.endsWith("/models")) {
				return jsonResponse({ data: [] });
			}

			if (url.includes("/models/") && url.endsWith("/policy")) {
				return new Response("", { status: 200 });
			}

			throw new Error(`Unexpected fetch URL: ${url}`);
		});

		vi.stubGlobal("fetch", fetchMock);

		/** 记录设备码通知参数的 Vitest 模拟函数。 */
		const onDeviceCode = vi.fn();
		/** 尚在轮询中的设备授权登录 Promise。 */
		const loginPromise = loginGitHubCopilotForTest({
			onDeviceCode,
			onPrompt: async () => "",
		});

		await vi.advanceTimersByTimeAsync(0);

		expect(onDeviceCode).toHaveBeenCalledWith({
			userCode: "ABCD-EFGH",
			verificationUri: normalizedVerificationUri,
			intervalSeconds: 1,
			expiresInSeconds: 900,
		});
		expect(onDeviceCode).not.toHaveBeenCalledWith(expect.objectContaining({ verificationUri: rawVerificationUri }));

		await vi.advanceTimersByTimeAsync(1000);
		await loginPromise;
	});

	// 测试场景：验证“waits before polling and increases the interval after slow_down”对应的 Copilot OAuth 行为。
	it("waits before polling and increases the interval after slow_down", async () => {
		vi.useFakeTimers();
		/** 假计时器固定的设备流起始时间。 */
		const startTime = new Date("2026-03-09T00:00:00Z");
		vi.setSystemTime(startTime);

		/** 每次访问令牌轮询发生时的毫秒时间戳。 */
		const accessTokenPollTimes: number[] = [];
		/** 按轮询顺序返回的 pending、slow_down 或成功响应队列。 */
		const accessTokenResponses = [
			jsonResponse({ error: "authorization_pending", error_description: "pending" }),
			jsonResponse({ error: "slow_down", error_description: "slow down", interval: 7 }),
			jsonResponse({ access_token: "ghu_refresh_token" }),
		];

		/** 模拟本用例 OAuth 与 Copilot API 请求的 fetch 函数；接收 fetch 输入和可选初始化，返回 Response Promise。例如：await fetchMock(url)。 */
		const fetchMock = vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
			/** 从当前 fetch 输入规范化得到的请求 URL。 */
			const url = getUrl(input);

			if (url.endsWith("/login/device/code")) {
				expect(init?.method).toBe("POST");
				expect(init?.headers).toMatchObject({
					Accept: "application/json",
					"Content-Type": "application/x-www-form-urlencoded",
				});
				expect(String(init?.body)).toContain("client_id=");
				expect(String(init?.body)).toContain("scope=read%3Auser");
				return jsonResponse({
					device_code: "device-code",
					user_code: "ABCD-EFGH",
					verification_uri: "https://github.com/login/device",
					interval: 5,
					expires_in: 900,
				});
			}

			if (url.endsWith("/login/oauth/access_token")) {
				accessTokenPollTimes.push(Date.now());
				expect(init?.method).toBe("POST");
				expect(init?.headers).toMatchObject({
					Accept: "application/json",
					"Content-Type": "application/x-www-form-urlencoded",
				});
				expect(String(init?.body)).toContain("client_id=");
				expect(String(init?.body)).toContain("device_code=device-code");
				expect(String(init?.body)).toContain("grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code");
				/** 从预设轮询响应队列取出的当前 HTTP 响应。 */
				const response = accessTokenResponses.shift();
				if (!response) {
					throw new Error("Unexpected extra access token poll");
				}
				return response;
			}

			if (url.includes("/copilot_internal/v2/token")) {
				return jsonResponse({
					token: "tid=test;exp=9999999999;proxy-ep=proxy.individual.githubcopilot.com;",
					expires_at: 9999999999,
				});
			}

			if (url.endsWith("/models")) {
				return jsonResponse({ data: [] });
			}

			if (url.includes("/models/") && url.endsWith("/policy")) {
				return new Response("", { status: 200 });
			}

			throw new Error(`Unexpected fetch URL: ${url}`);
		});

		vi.stubGlobal("fetch", fetchMock);

		/** 尚在轮询中的设备授权登录 Promise。 */
		const loginPromise = loginGitHubCopilotForTest({
			onDeviceCode: () => {},
			onPrompt: async () => "",
			onProgress: () => {},
		});

		await vi.advanceTimersByTimeAsync(0);
		expect(accessTokenPollTimes).toHaveLength(0);

		await vi.advanceTimersByTimeAsync(4999);
		expect(accessTokenPollTimes).toHaveLength(0);

		await vi.advanceTimersByTimeAsync(1);
		expect(accessTokenPollTimes).toHaveLength(1);

		await vi.advanceTimersByTimeAsync(4999);
		expect(accessTokenPollTimes).toHaveLength(1);

		await vi.advanceTimersByTimeAsync(1);
		expect(accessTokenPollTimes).toHaveLength(2);

		// slow_down carried a server-provided interval of 7 seconds.
		// slow_down 响应携带服务端指定的 7 秒新轮询间隔。
		await vi.advanceTimersByTimeAsync(6999);
		expect(accessTokenPollTimes).toHaveLength(2);

		await vi.advanceTimersByTimeAsync(1);
		await loginPromise;

		expect(accessTokenPollTimes).toEqual([
			startTime.getTime() + 5000,
			startTime.getTime() + 10000,
			startTime.getTime() + 17000,
		]);
	});

	// 测试场景：验证“times out after repeated slow_down responses”对应的 Copilot OAuth 行为。
	it("times out after repeated slow_down responses", async () => {
		vi.useFakeTimers();
		/** 假计时器固定的设备流起始时间。 */
		const startTime = new Date("2026-03-09T00:00:00Z");
		vi.setSystemTime(startTime);

		/** 每次访问令牌轮询发生时的毫秒时间戳。 */
		const accessTokenPollTimes: number[] = [];
		/** 按轮询顺序返回的 pending、slow_down 或成功响应队列。 */
		const accessTokenResponses = [
			jsonResponse({ error: "slow_down", error_description: "slow down" }),
			jsonResponse({ error: "slow_down", error_description: "still too fast" }),
			jsonResponse({ error: "authorization_pending", error_description: "pending" }),
		];

		/** 模拟本用例 OAuth 与 Copilot API 请求的 fetch 函数；接收 fetch 输入和可选初始化，返回 Response Promise。例如：await fetchMock(url)。 */
		const fetchMock = vi.fn(async (input: unknown): Promise<Response> => {
			/** 从当前 fetch 输入规范化得到的请求 URL。 */
			const url = getUrl(input);

			if (url.endsWith("/login/device/code")) {
				return jsonResponse({
					device_code: "device-code",
					user_code: "ABCD-EFGH",
					verification_uri: "https://github.com/login/device",
					interval: 5,
					expires_in: 25,
				});
			}

			if (url.endsWith("/login/oauth/access_token")) {
				accessTokenPollTimes.push(Date.now());
				/** 从预设轮询响应队列取出的当前 HTTP 响应。 */
				const response = accessTokenResponses.shift();
				if (!response) {
					throw new Error("Unexpected extra access token poll");
				}
				return response;
			}

			throw new Error(`Unexpected fetch URL: ${url}`);
		});

		vi.stubGlobal("fetch", fetchMock);

		/** 尚在轮询中的设备授权登录 Promise。 */
		const loginPromise = loginGitHubCopilotForTest({
			onDeviceCode: () => {},
			onPrompt: async () => "",
		});
		/** 对预期超时拒绝的断言 Promise，提前创建以避免未处理拒绝。 */
		const rejection = expect(loginPromise).rejects.toThrow(
			/Device flow timed out after one or more slow_down responses/,
		);

		await vi.advanceTimersByTimeAsync(4999);
		expect(accessTokenPollTimes).toEqual([]);

		await vi.advanceTimersByTimeAsync(1);
		expect(accessTokenPollTimes).toEqual([startTime.getTime() + 5000]);

		await vi.advanceTimersByTimeAsync(9999);
		expect(accessTokenPollTimes).toEqual([startTime.getTime() + 5000]);

		await vi.advanceTimersByTimeAsync(1);
		expect(accessTokenPollTimes).toEqual([startTime.getTime() + 5000, startTime.getTime() + 15000]);

		await vi.advanceTimersByTimeAsync(9999);
		expect(accessTokenPollTimes).toEqual([startTime.getTime() + 5000, startTime.getTime() + 15000]);

		await vi.advanceTimersByTimeAsync(1);
		await rejection;

		expect(accessTokenPollTimes).toEqual([startTime.getTime() + 5000, startTime.getTime() + 15000]);
	});
});
