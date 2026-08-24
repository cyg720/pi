/**
 * 文件职责：验证 OpenRouter OAuth 在文本/图片提供商中的暴露、PKCE 回调、令牌交换、取消和主机配置。
 * 技术维度：使用 Vitest 全局 fetch/env stub、真实一次性回环 HTTP 回调、Web Crypto 与内存凭据存储。
 * 产品维度：保证用户能通过浏览器安全登录 OpenRouter，并让同一永久 API Key 同时服务文本和图片模型。
 * 逻辑维度：构造 JSON 与 Base64URL 助手，先检查提供商认证，再覆盖成功交换、失败、并发、取消和主机。
 * 关键边界：回调服务器只接受一次交换；PKCE 必须使用 S256；测试期间未拦截 URL 会调用原生 fetch。
 * 新手阅读建议：先看成功 PKCE 用例的授权 URL—回调—交换链路，再比较失败、重复回调和取消场景。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryCredentialStore } from "../src/auth/credential-store.ts";
import { openRouterOAuth } from "../src/auth/oauth/openrouter.ts";
import { createImagesModels } from "../src/images-models.ts";
import { createModels } from "../src/models.ts";
import { openrouterProvider } from "../src/providers/openrouter.ts";
import { openrouterImagesProvider } from "../src/providers/openrouter-images.ts";

/** OpenRouter 用授权码换永久 API Key 的端点。 */
const TOKEN_URL = "https://openrouter.ai/api/v1/auth/keys";
/** 测试开始前的原生 fetch，用于访问本地回调服务器。 */
const nativeFetch = globalThis.fetch;

/**
 * 创建 JSON 响应。
 * @param body 待序列化正文。
 * @param status HTTP 状态码，默认 200。
 * @returns application/json Response。
 * @example jsonResponse({ key: "sk" });
 */
function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/**
 * 把字节编码为不带填充的 Base64URL。
 * @param bytes 原始字节。
 * @returns 将 +、/、= 转换或移除后的 URL 安全文本。
 * @example base64url(new Uint8Array([1, 2]));
 */
function base64url(bytes: Uint8Array): string {
	/** 逐字节转换得到的二进制字符串。 */
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/** 串行覆盖 OpenRouter OAuth 的提供商注册、回环登录和取消语义。 */
describe.sequential("OpenRouter OAuth", () => {
	/** 每个用例后恢复全局函数和环境变量。 */
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
	});

	it("is exposed by both OpenRouter providers alongside API-key auth", () => {
		for (const provider of [openrouterProvider(), openrouterImagesProvider()]) {
			expect(provider.auth.apiKey).toBeDefined();
			expect(provider.auth.oauth).toBeDefined();
			expect(provider.auth.oauth?.loginLabel).toBe("Sign in with OpenRouter");
		}
	});

	it("resolves the same stored OAuth key for text and image providers", async () => {
		/** 文本与图片提供商共享的内存凭据存储。 */
		const credentials = new InMemoryCredentialStore();
		await credentials.modify("openrouter", async () => ({
			type: "oauth",
			access: "sk-or-stored",
			refresh: "",
			expires: Number.MAX_SAFE_INTEGER,
		}));

		/** 注册 OpenRouter 文本提供商的模型注册表。 */
		const textModels = createModels({ credentials });
		textModels.setProvider(openrouterProvider());
		/** 注册 OpenRouter 图片提供商的图片模型注册表。 */
		const imageModels = createImagesModels({ credentials });
		imageModels.setProvider(openrouterImagesProvider());

		expect((await textModels.getAuth("openrouter"))?.auth.apiKey).toBe("sk-or-stored");
		expect((await imageModels.getAuth("openrouter"))?.auth.apiKey).toBe("sk-or-stored");
	});

	it("runs PKCE on a one-shot loopback callback and exchanges the code for a permanent API key", async () => {
		/** 令牌交换请求解析后的 JSON 正文。 */
		let exchangeBody: Record<string, unknown> | undefined;
		/** 只拦截 OpenRouter 令牌端点的 fetch mock。 */
		const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
			/** 当前 fetch URL。 */
			const url = input instanceof Request ? input.url : String(input);
			if (url !== TOKEN_URL) return nativeFetch(input, init);
			exchangeBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
			return jsonResponse({ key: "sk-or-test" });
		});
		vi.stubGlobal("fetch", fetchMock);

		/** 登录事件提供的浏览器授权 URL。 */
		let authorizeUrl: URL | undefined;
		/** 本地回调页面最终响应 Promise。 */
		let callbackResponse: Promise<Response> | undefined;
		/** 成功登录返回的永久 OAuth 凭据。 */
		const credential = await openRouterOAuth.login({
			prompt: async () => {
				throw new Error("OpenRouter login must not prompt for a code");
			},
			notify: (event) => {
				if (event.type !== "auth_url") return;
				authorizeUrl = new URL(event.url);
				/** 从授权 URL 提取的本地回调 URL。 */
				const callbackUrl = new URL(authorizeUrl.searchParams.get("callback_url") ?? "");
				callbackUrl.searchParams.set("code", "authorization-code");
				callbackResponse = nativeFetch(callbackUrl);
			},
		});

		expect(credential).toEqual({
			type: "oauth",
			access: "sk-or-test",
			refresh: "",
			expires: Number.MAX_SAFE_INTEGER,
		});
		expect((await callbackResponse)?.status).toBe(200);
		expect(authorizeUrl?.origin).toBe("https://openrouter.ai");
		expect(authorizeUrl?.pathname).toBe("/auth");
		expect(authorizeUrl?.searchParams.get("code_challenge_method")).toBe("S256");

		/** 用于断言主机和随机回调路径的 URL。 */
		const callbackUrl = new URL(authorizeUrl?.searchParams.get("callback_url") ?? "");
		expect(callbackUrl.hostname).toBe("127.0.0.1");
		expect(callbackUrl.pathname).toMatch(/^\/oauth\/callback\/[0-9a-f-]+$/);

		expect(exchangeBody).toMatchObject({
			code: "authorization-code",
			code_challenge_method: "S256",
		});
		/** 令牌交换发送的 PKCE verifier。 */
		const verifier = exchangeBody?.code_verifier;
		expect(typeof verifier).toBe("string");
		/** verifier 的 SHA-256 摘要。 */
		const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(verifier)));
		expect(authorizeUrl?.searchParams.get("code_challenge")).toBe(base64url(new Uint8Array(digest)));
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("reports token exchange failures through both the callback page and login", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => jsonResponse({ error: { message: "invalid code" } }, 403)),
		);

		/** 失败令牌交换后回调页面返回的响应。 */
		let callbackResponse: Promise<Response> | undefined;
		/** 预期同时让回调页面与调用方失败的登录 Promise。 */
		const login = openRouterOAuth.login({
			prompt: async () => "",
			notify: (event) => {
				if (event.type !== "auth_url") return;
				/** 令牌交换失败场景的本地回调 URL。 */
				const callbackUrl = new URL(new URL(event.url).searchParams.get("callback_url") ?? "");
				callbackUrl.searchParams.set("code", "bad-code");
				callbackResponse = nativeFetch(callbackUrl);
			},
		});

		await expect(login).rejects.toThrow("OpenRouter OAuth key exchange failed (HTTP 403): invalid code");
		expect((await callbackResponse)?.status).toBe(502);
	});

	it("allows only one token exchange for a callback", async () => {
		/** 外部可控制首个令牌交换何时完成的函数。 */
		let completeExchange = (_response: Response): void => {
			throw new Error("Token exchange did not start");
		};
		/** 等待外部 resolve 的令牌交换 fetch mock。 */
		const fetchMock = vi.fn(
			async () =>
				new Promise<Response>((resolve) => {
					completeExchange = resolve;
				}),
		);
		vi.stubGlobal("fetch", fetchMock);

		/** 一次性回调 URL。 */
		let callbackUrl: URL | undefined;
		/** 首次合法回调的响应 Promise。 */
		let firstCallback: Promise<Response> | undefined;
		/** 等待首个交换完成的登录 Promise。 */
		const login = openRouterOAuth.login({
			prompt: async () => "",
			notify: (event) => {
				if (event.type !== "auth_url") return;
				callbackUrl = new URL(new URL(event.url).searchParams.get("callback_url") ?? "");
				callbackUrl.searchParams.set("code", "authorization-code");
				firstCallback = nativeFetch(callbackUrl);
			},
		});

		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		if (!callbackUrl) throw new Error("OpenRouter did not provide a callback URL");
		expect((await nativeFetch(callbackUrl)).status).toBe(409);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		completeExchange(jsonResponse({ key: "sk-or-test" }));

		await expect(login).resolves.toMatchObject({ access: "sk-or-test" });
		expect((await firstCallback)?.status).toBe(200);
	});

	it("rejects a successful response that does not contain a key", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => jsonResponse({ user_id: "user-1" })),
		);

		/** 缺少 key 响应场景的回调页面响应。 */
		let callbackResponse: Promise<Response> | undefined;
		/** 预期因成功正文缺少 key 而失败的登录 Promise。 */
		const login = openRouterOAuth.login({
			prompt: async () => "",
			notify: (event) => {
				if (event.type !== "auth_url") return;
				/** 缺少 key 场景的本地回调 URL。 */
				const callbackUrl = new URL(new URL(event.url).searchParams.get("callback_url") ?? "");
				callbackUrl.searchParams.set("code", "code-without-key");
				callbackResponse = nativeFetch(callbackUrl);
			},
		});

		await expect(login).rejects.toThrow('OpenRouter OAuth response carries no "key"');
		expect((await callbackResponse)?.status).toBe(502);
	});

	it("closes the pending callback when login is cancelled", async () => {
		/** 中止待处理登录的控制器。 */
		const controller = new AbortController();
		/** 登录事件中捕获的回调 URL。 */
		let callbackUrl: URL | undefined;
		/** 随控制器中止而拒绝的登录 Promise。 */
		const login = openRouterOAuth.login({
			signal: controller.signal,
			prompt: async () => "",
			notify: (event) => {
				if (event.type !== "auth_url") return;
				callbackUrl = new URL(new URL(event.url).searchParams.get("callback_url") ?? "");
				controller.abort();
			},
		});

		await expect(login).rejects.toThrow("Login cancelled");
		expect(callbackUrl).toBeDefined();
		await expect(nativeFetch(callbackUrl!)).rejects.toThrow();
	});

	it("rejects before opening a callback server when login is already cancelled", async () => {
		/** 在调用 login 前已经中止的控制器。 */
		const controller = new AbortController();
		controller.abort();

		await expect(
			openRouterOAuth.login({
				signal: controller.signal,
				prompt: async () => "",
				notify: () => {
					throw new Error("Cancelled login must not emit events");
				},
			}),
		).rejects.toThrow("Login cancelled");
	});

	it("uses the configured OAuth callback host", async () => {
		vi.stubEnv("PI_OAUTH_CALLBACK_HOST", "localhost");
		/** 用于读取 localhost 回调 URL 后取消登录的控制器。 */
		const controller = new AbortController();
		/** 使用配置主机生成的回调 URL。 */
		let callbackUrl: URL | undefined;
		/** 捕获 URL 后立即中止的登录 Promise。 */
		const login = openRouterOAuth.login({
			signal: controller.signal,
			prompt: async () => "",
			notify: (event) => {
				if (event.type !== "auth_url") return;
				callbackUrl = new URL(new URL(event.url).searchParams.get("callback_url") ?? "");
				controller.abort();
			},
		});

		await expect(login).rejects.toThrow("Login cancelled");
		expect(callbackUrl?.hostname).toBe("localhost");
	});
});
