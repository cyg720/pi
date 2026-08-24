/**
 * 文件职责：验证 OpenAI Codex OAuth 的设备码登录、方式选择、轮询、取消、超时、错误信息和令牌刷新。
 * 技术维度：使用 Vitest 假计时器、fetch 替身、JWT 载荷构造、AbortController 与 Web Response 模拟认证服务。
 * 产品维度：确保无浏览器环境也能安全登录 Codex，并在等待、取消或服务失败时给用户准确反馈。
 * 逻辑维度：先定义 HTTP 与测试登录辅助函数，再覆盖正常设备流、登录方式选择及各种失败边界。
 * 关键边界：设备码默认 15 分钟超时；403/404 视为待授权，其他错误必须包含响应体且不得写入 stderr。
 * 新手阅读建议：先读 loginOpenAICodexDeviceCodeForTest，再跟随首个完整登录用例，最后比较取消、超时和错误。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { openaiCodexOAuth } from "../src/auth/oauth/openai-codex.ts";

/** 构造 JSON HTTP 响应。参数 body 为响应体、status 为状态码且默认 200；返回 Response。例如：jsonResponse({ ok: true })。 */
function jsonResponse(body: unknown, status: number = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

/** 从 fetch 输入提取 URL。参数 input 可为字符串、URL 或 Request；返回 URL 字符串，不支持时抛错。例如：getUrl(input)。 */
function getUrl(input: unknown): string {
	if (typeof input === "string") return input;
	if (input instanceof URL) return input.toString();
	if (input instanceof Request) return input.url;
	throw new Error(`Unsupported fetch input: ${String(input)}`);
}

/** 构造包含账户编号的无签名测试访问令牌。参数 accountId 为账户编号；返回 JWT 形状字符串。例如：createAccessToken("account-1")。 */
function createAccessToken(accountId: string): string {
	/** 无签名测试 JWT 的 Base64 头部。 */
	const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64");
	/** 包含 OpenAI auth 命名空间和账户编号的 Base64 载荷。 */
	const payload = Buffer.from(
		JSON.stringify({
			"https://api.openai.com/auth": {
				chatgpt_account_id: accountId,
			},
		}),
	).toString("base64");
	return `${header}.${payload}.signature`;
}

/** 构造 OpenAI 设备授权尚未完成的 403 JSON 响应。无参数；返回 Response。例如：deviceAuthPendingResponse()。 */
function deviceAuthPendingResponse(): Response {
	return jsonResponse(
		{
			error: {
				message: "Device authorization is pending. Please try again.",
				type: "invalid_request_error",
				param: null,
				code: "deviceauth_authorization_pending",
			},
		},
		403,
	);
}

/** 通过固定选择 device_code 的提示适配器启动登录。参数 options 接收设备码回调和可选中止信号；返回登录 Promise。例如：loginOpenAICodexDeviceCodeForTest(options)。 */
function loginOpenAICodexDeviceCodeForTest(options: {
	/** 接收规范化设备码信息的通知回调。 */
	onDeviceCode(info: {
		/** 用户需要输入的一次性代码。 */
		userCode: string;
		/** 打开并完成授权的 HTTP(S) 地址。 */
		verificationUri: string;
		/** 服务端建议的轮询间隔秒数。 */
		intervalSeconds?: number;
		/** 设备码剩余有效秒数。 */
		expiresInSeconds?: number;
	}): void;
	/** 可选中止信号，用于取消登录等待。 */
	signal?: AbortSignal;
}) {
	return openaiCodexOAuth.login({
		signal: options.signal,
		prompt: async (prompt) => {
			if (prompt.type !== "select") throw new Error(`Unexpected prompt: ${prompt.type}`);
			return "device_code";
		},
		notify: (event) => {
			if (event.type === "device_code") {
				/** 从设备码事件中剔除且不再使用的 type 字段。 */
				const { type: _, ...info } = event;
				options.onDeviceCode(info);
			}
		},
	});
}

describe("OpenAI Codex OAuth", () => {
	// 每个用例后恢复 spy、全局 fetch 和真实计时器。
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	// 测试场景：验证“logs in with the OpenAI Codex device code flow”对应的 Codex OAuth 行为。
	it("logs in with the OpenAI Codex device code flow", async () => {
		vi.useFakeTimers();
		/** 假计时器固定的认证流程起始时间。 */
		const startTime = new Date("2026-05-20T00:00:00Z");
		vi.setSystemTime(startTime);

		/** 包含目标测试账户编号的访问令牌。 */
		const accessToken = createAccessToken("account-123");
		/** 登录过程中收到的设备码通知列表。 */
		const deviceInfos: Array<{
			/** 设备授权页面需要输入的用户码。 */
			userCode: string;
			/** 用户应打开的验证地址。 */
			verificationUri: string;
			/** 可选附加操作说明。 */
			instructions?: string;
			/** 建议轮询间隔秒数。 */
			intervalSeconds?: number;
			/** 设备码有效秒数。 */
			expiresInSeconds?: number;
		}> = [];
		/** 每次设备授权轮询发生时的毫秒时间戳。 */
		const pollTimes: number[] = [];
		/** 按顺序返回的设备授权待定或成功响应队列。 */
		const pollResponses = [
			deviceAuthPendingResponse(),
			jsonResponse({
				authorization_code: "oauth-code",
				code_challenge: "device-code-challenge",
				code_verifier: "device-code-verifier",
			}),
		];

		/** 模拟 OpenAI 认证端点的 fetch 函数；接收请求输入和可选初始化并返回 Response Promise。例如：await fetchMock(url)。 */
		const fetchMock = vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
			/** 从当前 fetch 输入提取的请求 URL。 */
			const url = getUrl(input);

			if (url === "https://auth.openai.com/api/accounts/deviceauth/usercode") {
				expect(init?.method).toBe("POST");
				expect(init?.headers).toMatchObject({ "Content-Type": "application/json" });
				expect(JSON.parse(String(init?.body))).toEqual({ client_id: "app_EMoamEEZ73f0CkXaXp7hrann" });
				return jsonResponse({
					device_auth_id: "device-auth-id",
					user_code: "ABCD-1234",
					interval: "5",
				});
			}

			if (url === "https://auth.openai.com/api/accounts/deviceauth/token") {
				pollTimes.push(Date.now());
				expect(init?.method).toBe("POST");
				expect(init?.headers).toMatchObject({ "Content-Type": "application/json" });
				expect(JSON.parse(String(init?.body))).toEqual({
					device_auth_id: "device-auth-id",
					user_code: "ABCD-1234",
				});
				/** 从预设设备授权响应队列取出的当前响应。 */
				const response = pollResponses.shift();
				if (!response) {
					throw new Error("Unexpected extra device auth poll");
				}
				return response;
			}

			if (url === "https://auth.openai.com/oauth/token") {
				expect(init?.method).toBe("POST");
				expect(init?.headers).toMatchObject({ "Content-Type": "application/x-www-form-urlencoded" });
				/** 从 OAuth token 请求体解析出的表单参数。 */
				const params = new URLSearchParams(String(init?.body));
				expect(params.get("grant_type")).toBe("authorization_code");
				expect(params.get("client_id")).toBe("app_EMoamEEZ73f0CkXaXp7hrann");
				expect(params.get("code")).toBe("oauth-code");
				expect(params.get("redirect_uri")).toBe("https://auth.openai.com/deviceauth/callback");
				expect(params.get("code_verifier")).toBe("device-code-verifier");
				return jsonResponse({
					access_token: accessToken,
					refresh_token: "refresh-token",
					expires_in: 3600,
				});
			}

			throw new Error(`Unexpected fetch URL: ${url}`);
		});

		vi.stubGlobal("fetch", fetchMock);

		/** 尚在进行设备轮询和令牌交换的登录 Promise。 */
		const credentialsPromise = loginOpenAICodexDeviceCodeForTest({
			onDeviceCode: (info) => deviceInfos.push(info),
		});

		// i 为最多 5 次的微任务刷新计数，直到首次轮询被记录。
		for (let i = 0; i < 5 && pollTimes.length === 0; i++) {
			await vi.advanceTimersByTimeAsync(0);
		}
		expect(deviceInfos).toEqual([
			{
				userCode: "ABCD-1234",
				verificationUri: "https://auth.openai.com/codex/device",
				intervalSeconds: 5,
				expiresInSeconds: 900,
			},
		]);
		expect(pollTimes).toEqual([startTime.getTime()]);

		await vi.advanceTimersByTimeAsync(4999);
		expect(pollTimes).toEqual([startTime.getTime()]);

		await vi.advanceTimersByTimeAsync(1);
		await expect(credentialsPromise).resolves.toMatchObject({
			access: accessToken,
			refresh: "refresh-token",
			expires: startTime.getTime() + 5000 + 3600 * 1000,
			accountId: "account-123",
		});
		expect(pollTimes).toEqual([startTime.getTime(), startTime.getTime() + 5000]);
	});

	// 测试场景：验证“offers browser login first and uses the selected OpenAI Codex device code flow”对应的 Codex OAuth 行为。
	it("offers browser login first and uses the selected OpenAI Codex device code flow", async () => {
		/** 包含目标测试账户编号的访问令牌。 */
		const accessToken = createAccessToken("account-456");
		/** 登录方式选择界面收到的 select 提示列表。 */
		const selectPrompts: Array<{
			/** 选择登录方式时显示的提示文本。 */
			message: string;
			/** 可供用户选择的登录方式编号和标签。 */
			options: readonly { id: string; label: string }[];
		}> = [];
		/** 登录过程中收到的设备码通知列表。 */
		const deviceInfos: Array<{
			/** 设备授权页面需要输入的用户码。 */
			userCode: string;
			/** 用户应打开的验证地址。 */
			verificationUri: string;
			/** 建议轮询间隔秒数。 */
			intervalSeconds?: number;
			/** 设备码有效秒数。 */
			expiresInSeconds?: number;
		}> = [];

		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
				/** 从当前 fetch 输入提取的请求 URL。 */
				const url = getUrl(input);
				if (url === "https://auth.openai.com/api/accounts/deviceauth/usercode") {
					expect(JSON.parse(String(init?.body))).toEqual({ client_id: "app_EMoamEEZ73f0CkXaXp7hrann" });
					return jsonResponse({
						device_auth_id: "device-auth-id",
						user_code: "WXYZ-7890",
						interval: "5",
					});
				}
				if (url === "https://auth.openai.com/api/accounts/deviceauth/token") {
					return jsonResponse({
						authorization_code: "oauth-code",
						code_challenge: "device-code-challenge",
						code_verifier: "device-code-verifier",
					});
				}
				if (url === "https://auth.openai.com/oauth/token") {
					return jsonResponse({
						access_token: accessToken,
						refresh_token: "refresh-token",
						expires_in: 3600,
					});
				}
				throw new Error(`Unexpected fetch URL: ${url}`);
			}),
		);

		await expect(
			openaiCodexOAuth.login({
				prompt: async (prompt) => {
					if (prompt.type !== "select") throw new Error("Text prompt should not be used");
					selectPrompts.push(prompt);
					return "device_code";
				},
				notify: (event) => {
					if (event.type === "auth_url") throw new Error("Browser login should not start");
					if (event.type === "device_code") {
						/** 从设备码事件中剔除且不再使用的 type 字段。 */
						const { type: _, ...info } = event;
						deviceInfos.push(info);
					}
				},
			}),
		).resolves.toMatchObject({
			type: "oauth",
			access: accessToken,
			refresh: "refresh-token",
			accountId: "account-456",
		});

		expect(selectPrompts).toEqual([
			{
				type: "select",
				message: "Select OpenAI Codex login method:",
				options: [
					{ id: "browser", label: "Browser login (default)" },
					{ id: "device_code", label: "Device code login (headless)" },
				],
			},
		]);
		expect(deviceInfos).toEqual([
			{
				userCode: "WXYZ-7890",
				verificationUri: "https://auth.openai.com/codex/device",
				intervalSeconds: 5,
				expiresInSeconds: 900,
			},
		]);
	});

	// 测试场景：验证“cancels when OpenAI Codex login method selection is cancelled”对应的 Codex OAuth 行为。
	it("cancels when OpenAI Codex login method selection is cancelled", async () => {
		await expect(
			openaiCodexOAuth.login({
				prompt: async () => {
					throw new Error("Login cancelled");
				},
				notify: () => {},
			}),
		).rejects.toThrow("Login cancelled");
	});

	// 测试场景：验证“cancels the OpenAI Codex device code flow while waiting”对应的 Codex OAuth 行为。
	it("cancels the OpenAI Codex device code flow while waiting", async () => {
		vi.useFakeTimers();
		/** 用于取消设备码等待的 AbortController。 */
		const controller = new AbortController();
		/** 每次设备授权轮询发生时的毫秒时间戳。 */
		const pollTimes: number[] = [];

		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
				/** 从当前 fetch 输入提取的请求 URL。 */
				const url = getUrl(input);
				if (url === "https://auth.openai.com/api/accounts/deviceauth/usercode") {
					expect(JSON.parse(String(init?.body))).toEqual({ client_id: "app_EMoamEEZ73f0CkXaXp7hrann" });
					return jsonResponse({
						device_auth_id: "device-auth-id",
						user_code: "ABCD-1234",
						interval: "5",
					});
				}
				if (url === "https://auth.openai.com/api/accounts/deviceauth/token") {
					pollTimes.push(Date.now());
					return deviceAuthPendingResponse();
				}
				throw new Error(`Unexpected fetch URL: ${url}`);
			}),
		);

		/** 尚在进行设备轮询和令牌交换的登录 Promise。 */
		const credentialsPromise = loginOpenAICodexDeviceCodeForTest({
			onDeviceCode: () => {},
			signal: controller.signal,
		});
		/** 把登录拒绝转换为可等待错误值的 Promise，避免未处理拒绝。 */
		const rejectionPromise = credentialsPromise.then(
			() => new Error("Expected login to fail"),
			(error: unknown) => error,
		);

		// i 为最多 5 次的微任务刷新计数，直到首次轮询被记录。
		for (let i = 0; i < 5 && pollTimes.length === 0; i++) {
			await vi.advanceTimersByTimeAsync(0);
		}
		expect(pollTimes).toHaveLength(1);

		controller.abort();
		/** 取消或超时后实际得到的错误对象。 */
		const rejection = await rejectionPromise;
		expect(rejection).toBeInstanceOf(Error);
		expect((rejection as Error).message).toBe("Login cancelled");
	});

	// 测试场景：验证“times out the OpenAI Codex device code flow after 15 minutes”对应的 Codex OAuth 行为。
	it("times out the OpenAI Codex device code flow after 15 minutes", async () => {
		vi.useFakeTimers();
		/** 每次设备授权轮询发生时的毫秒时间戳。 */
		const pollTimes: number[] = [];

		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
				/** 从当前 fetch 输入提取的请求 URL。 */
				const url = getUrl(input);
				if (url === "https://auth.openai.com/api/accounts/deviceauth/usercode") {
					expect(JSON.parse(String(init?.body))).toEqual({ client_id: "app_EMoamEEZ73f0CkXaXp7hrann" });
					return jsonResponse({
						device_auth_id: "device-auth-id",
						user_code: "ABCD-1234",
						interval: "60",
					});
				}
				if (url === "https://auth.openai.com/api/accounts/deviceauth/token") {
					pollTimes.push(Date.now());
					return deviceAuthPendingResponse();
				}
				throw new Error(`Unexpected fetch URL: ${url}`);
			}),
		);

		/** 尚在进行设备轮询和令牌交换的登录 Promise。 */
		const credentialsPromise = loginOpenAICodexDeviceCodeForTest({
			onDeviceCode: () => {},
		});
		/** 把登录拒绝转换为可等待错误值的 Promise，避免未处理拒绝。 */
		const rejectionPromise = credentialsPromise.then(
			() => new Error("Expected login to fail"),
			(error: unknown) => error,
		);

		// i 为最多 5 次的微任务刷新计数，直到首次轮询被记录。
		for (let i = 0; i < 5 && pollTimes.length === 0; i++) {
			await vi.advanceTimersByTimeAsync(0);
		}
		expect(pollTimes).toHaveLength(1);

		await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
		/** 取消或超时后实际得到的错误对象。 */
		const rejection = await rejectionPromise;
		expect(rejection).toBeInstanceOf(Error);
		expect((rejection as Error).message).toBe("Device flow timed out");
	});

	// 测试场景：验证“treats OpenAI Codex device auth 403 and 404 responses as pending”对应的 Codex OAuth 行为。
	it("treats OpenAI Codex device auth 403 and 404 responses as pending", async () => {
		vi.useFakeTimers();
		/** 包含目标测试账户编号的访问令牌。 */
		const accessToken = createAccessToken("account-403-404");
		/** 每次设备授权轮询发生时的毫秒时间戳。 */
		const pollTimes: number[] = [];
		/** 按顺序返回的设备授权待定或成功响应队列。 */
		const pollResponses = [
			jsonResponse({ error: "access_denied", error_description: "denied" }, 403),
			new Response("not ready", { status: 404, headers: { "Content-Type": "text/plain" } }),
			jsonResponse({
				authorization_code: "oauth-code",
				code_challenge: "device-code-challenge",
				code_verifier: "device-code-verifier",
			}),
		];

		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: unknown): Promise<Response> => {
				/** 从当前 fetch 输入提取的请求 URL。 */
				const url = getUrl(input);
				if (url === "https://auth.openai.com/api/accounts/deviceauth/usercode") {
					return jsonResponse({
						device_auth_id: "device-auth-id",
						user_code: "ABCD-1234",
						interval: "1",
					});
				}
				if (url === "https://auth.openai.com/api/accounts/deviceauth/token") {
					pollTimes.push(Date.now());
					/** 从预设设备授权响应队列取出的当前响应。 */
					const response = pollResponses.shift();
					if (!response) {
						throw new Error("Unexpected extra device auth poll");
					}
					return response;
				}
				if (url === "https://auth.openai.com/oauth/token") {
					return jsonResponse({
						access_token: accessToken,
						refresh_token: "refresh-token",
						expires_in: 3600,
					});
				}
				throw new Error(`Unexpected fetch URL: ${url}`);
			}),
		);

		/** 尚在进行设备轮询和令牌交换的登录 Promise。 */
		const credentialsPromise = loginOpenAICodexDeviceCodeForTest({
			onDeviceCode: () => {},
		});

		// i 为最多 5 次的微任务刷新计数，直到首次轮询被记录。
		for (let i = 0; i < 5 && pollTimes.length === 0; i++) {
			await vi.advanceTimersByTimeAsync(0);
		}
		await vi.advanceTimersByTimeAsync(1000);
		await vi.advanceTimersByTimeAsync(1000);

		await expect(credentialsPromise).resolves.toMatchObject({
			access: accessToken,
			refresh: "refresh-token",
			accountId: "account-403-404",
		});
		expect(pollTimes).toHaveLength(3);
	});

	// 测试场景：验证“includes the response body in OpenAI Codex device auth poll failures”对应的 Codex OAuth 行为。
	it("includes the response body in OpenAI Codex device auth poll failures", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: unknown): Promise<Response> => {
				/** 从当前 fetch 输入提取的请求 URL。 */
				const url = getUrl(input);
				if (url === "https://auth.openai.com/api/accounts/deviceauth/usercode") {
					return jsonResponse({
						device_auth_id: "device-auth-id",
						user_code: "ABCD-1234",
						interval: "5",
					});
				}
				if (url === "https://auth.openai.com/api/accounts/deviceauth/token") {
					return jsonResponse({ error: "server_error", error_description: "try again later" }, 500);
				}
				throw new Error(`Unexpected fetch URL: ${url}`);
			}),
		);

		await expect(
			loginOpenAICodexDeviceCodeForTest({
				onDeviceCode: () => {},
			}),
		).rejects.toThrow(
			'OpenAI Codex device auth failed with status 500: {"error":"server_error","error_description":"try again later"}',
		);
	});

	// 测试场景：验证“does not write token refresh failures to stderr”对应的 Codex OAuth 行为。
	it("does not write token refresh failures to stderr", async () => {
		/** 监视 console.error 是否被令牌刷新失败调用的 spy。 */
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
		vi.stubGlobal(
			"fetch",
			vi.fn(async (): Promise<Response> => {
				return new Response(
					JSON.stringify({
						error: {
							message: "Could not validate your token. Please try signing in again.",
							type: "invalid_request_error",
						},
					}),
					{ status: 401, statusText: "Unauthorized", headers: { "Content-Type": "application/json" } },
				);
			}),
		);

		await expect(
			openaiCodexOAuth.refresh({
				type: "oauth",
				access: "invalid-access-token",
				refresh: "invalid-refresh-token",
				expires: 0,
			}),
		).rejects.toThrow(/OpenAI Codex token refresh failed \(401\).*Could not validate your token/);
		expect(consoleError).not.toHaveBeenCalled();
	});
});
