/**
 * 文件职责：验证 Anthropic OAuth 手工回调登录、刷新请求和提示生命周期的协议细节。
 * 技术维度：使用 Vitest 顺序套件、全局 fetch 模拟、JSON Response 与 AuthPrompt/AuthEvent 类型。
 * 产品维度：确保用户手工粘贴回调时保留 localhost redirect_uri，刷新和登录完成后及时关闭 UI 提示。
 * 逻辑维度：三个帮助函数解析请求；三个用例分别检查授权码交换、刷新载荷和 manual_code 信号中止。
 * 关键边界：套件顺序执行且每例恢复 fetch；刷新请求不能携带 scope，回调 state 必须与授权 URL 一致。
 * 新手阅读建议：先看 getUrl/getJsonBody，再逐条对照 token 端点收到的 grant_type 和返回凭据。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { anthropicOAuth } from "../src/auth/oauth/anthropic.ts";
import type { AuthEvent, AuthPrompt } from "../src/auth/types.ts";

/** 功能：创建 JSON HTTP 响应；参数 body、status；返回：Response。示例：jsonResponse({ access_token: "x" })。 */
function jsonResponse(body: unknown, status: number = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json",
		},
	});
}

/** 功能：从 fetch input 取得 URL；参数 input；返回：字符串 URL。示例：getUrl(request)。 */
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

/** 功能：解析字符串请求体为键值对象；参数 init；返回：JSON 对象。示例：getJsonBody(init)。 */
function getJsonBody(init?: RequestInit): Record<string, string> {
	if (typeof init?.body !== "string") {
		throw new Error(`Expected string request body, got ${typeof init?.body}`);
	}
	return JSON.parse(init.body) as Record<string, string>;
}

describe.sequential("Anthropic OAuth", () => {
	// 功能：恢复被模拟的全局对象；参数：无；返回：无。示例：每个顺序用例后调用。
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("keeps the localhost redirect_uri for manual callback login", async () => {
		// notify 事件提供的授权 URL，供 prompt 回调解析 state。
		let authUrl = "";
		// 验证授权码交换请求的 fetch 模拟。
		const fetchMock = vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
			expect(getUrl(input)).toBe("https://platform.claude.com/v1/oauth/token");
			expect(init?.method).toBe("POST");
			// token 请求 JSON body。
			const body = getJsonBody(init);
			expect(body.grant_type).toBe("authorization_code");
			expect(body.code).toBe("manual-code");
			expect(body.redirect_uri).toBe("http://localhost:53692/callback");
			return jsonResponse({
				access_token: "access-token",
				refresh_token: "refresh-token",
				expires_in: 3600,
			});
		});
		vi.stubGlobal("fetch", fetchMock);

		// 完成手工回调登录后得到的 OAuth 凭据。
		const credentials = await anthropicOAuth.login({
			notify: (event) => {
				if (event.type === "auth_url") authUrl = event.url;
			},
			prompt: async (prompt) => {
				if (prompt.type !== "manual_code") throw new Error(`Unexpected prompt: ${prompt.type}`);
				// 授权 URL 对象。
				const url = new URL(authUrl);
				// OAuth 防重放 state。
				const state = url.searchParams.get("state");
				// 授权请求携带的 localhost 回调地址。
				const redirectUri = url.searchParams.get("redirect_uri");
				if (!state || !redirectUri) throw new Error("Missing OAuth state or redirect_uri in auth URL");
				return `${redirectUri}?code=manual-code&state=${state}`;
			},
		});

		expect(credentials.access).toBe("access-token");
		expect(credentials.refresh).toBe("refresh-token");
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it("omits scope from refresh token requests", async () => {
		// 验证刷新请求字段的 fetch 模拟。
		const fetchMock = vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
			expect(getUrl(input)).toBe("https://platform.claude.com/v1/oauth/token");
			expect(init?.method).toBe("POST");
			// 刷新 token 请求 JSON body。
			const body = getJsonBody(init);
			expect(body.grant_type).toBe("refresh_token");
			expect(body.client_id).toBeTruthy();
			expect(body.refresh_token).toBe("refresh-token");
			expect(body).not.toHaveProperty("scope");
			return jsonResponse({
				access_token: "new-access-token",
				refresh_token: "new-refresh-token",
				expires_in: 3600,
			});
		});
		vi.stubGlobal("fetch", fetchMock);

		// 刷新后得到的新 OAuth 凭据。
		const credentials = await anthropicOAuth.refresh({
			type: "oauth",
			access: "old-access-token",
			refresh: "refresh-token",
			expires: 0,
		});

		expect(credentials.access).toBe("new-access-token");
		expect(credentials.refresh).toBe("new-refresh-token");
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it("anthropicOAuth.login resolves through the manual_code prompt and aborts it after settling", async () => {
		// 只响应 token 端点的简化 fetch 模拟。
		const fetchMock = vi.fn(async (input: unknown): Promise<Response> => {
			// 当前 fetch URL 文本。
			const url = typeof input === "string" ? input : String(input);
			if (url.includes("/oauth/token")) {
				return jsonResponse({ access_token: "access", refresh_token: "refresh", expires_in: 3600 });
			}
			throw new Error(`Unexpected fetch: ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		// 登录期间收到的认证事件。
		const events: AuthEvent[] = [];
		// 登录期间展示的提示对象。
		const prompts: AuthPrompt[] = [];
		// manual_code 提示的取消信号，登录完成后应为 aborted。
		let manualSignal: AbortSignal | undefined;

		// 手工代码提示返回 the-code 后取得的凭据。
		const credential = await anthropicOAuth.login({
			notify: (event) => events.push(event),
			prompt: async (prompt) => {
				prompts.push(prompt);
				if (prompt.type === "manual_code") {
					manualSignal = prompt.signal;
					return "the-code";
				}
				throw new Error(`Unexpected prompt: ${prompt.type}`);
			},
		});

		expect(credential.type).toBe("oauth");
		expect(credential.access).toBe("access");
		expect(events.some((e) => e.type === "auth_url")).toBe(true);
		expect(prompts.some((p) => p.type === "manual_code")).toBe(true);
		// the prompt's signal is aborted once login settles, so UIs can dismiss it
		// 中文说明：登录结束后中止提示信号，UI 可据此关闭手工输入框。
		expect(manualSignal?.aborted).toBe(true);
	});
});
