/**
 * 文件职责：验证内置 OAuth 适配器以及 Models.getAuth 懒加载链路能正确转换、刷新和读取凭据。
 * 技术维度：使用 Vitest、内存凭据存储、全局 fetch 桩和真实提供商配置进行单元测试。
 * 产品维度：保障用户登录 Anthropic、OpenAI Codex、OpenRouter、xAI 与 GitHub Copilot 后可以稳定调用模型。
 * 逻辑维度：先逐个测试适配器的凭据转换与刷新，再测试模型注册表从存储中解析 OAuth 授权。
 * 关键边界：测试不会访问真实网络；企业版 Copilot 的域名推导和永久凭据的刷新语义必须保持不变。
 * 新手阅读建议：先看 jsonResponse 和简单的 toAuth 用例，再看 refresh 桩，最后理解 Models.getAuth 的懒加载流程。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryCredentialStore } from "../src/auth/credential-store.ts";
import { anthropicOAuth } from "../src/auth/oauth/anthropic.ts";
import { githubCopilotOAuth } from "../src/auth/oauth/github-copilot.ts";
import { openaiCodexOAuth } from "../src/auth/oauth/openai-codex.ts";
import { openRouterOAuth } from "../src/auth/oauth/openrouter.ts";
import { xaiOAuth } from "../src/auth/oauth/xai.ts";
import { createModels } from "../src/models.ts";
import * as extensionOAuthCompatibility from "../src/oauth.ts";
import { anthropicProvider } from "../src/providers/anthropic.ts";
import { githubCopilotProvider } from "../src/providers/github-copilot.ts";

/**
 * 构造模拟 OAuth 接口返回的 JSON 响应。
 * @param body 要序列化到响应体的数据，可为任意可 JSON 序列化的值。
 * @param status HTTP 状态码，默认使用成功状态 200。
 * @returns 带 JSON 内容类型的标准 Response；例如 `jsonResponse({ token: "x" })`。
 */
function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// 按顺序执行适配器用例，避免多个测试同时替换全局 fetch 而相互干扰。
describe.sequential("OAuthAuth adapters", () => {
	// 验证面向扩展的兼容入口不会意外暴露内置登录实现。
	it("keeps the extension OAuth barrel free of built-in flow implementations", () => {
		expect(extensionOAuthCompatibility).not.toHaveProperty("loginAnthropic");
		expect(extensionOAuthCompatibility).not.toHaveProperty("anthropicOAuth");
	});

	// 每个用例结束后清除全局桩，保证测试彼此隔离。
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	// 验证 Anthropic 访问令牌会被转换成提供商需要的 API 密钥字段。
	it("anthropic toAuth derives the api key from the access token", async () => {
		// auth 是 Anthropic 适配器输出的统一授权对象。
		const auth = await anthropicOAuth.toAuth({ type: "oauth", access: "token", refresh: "r", expires: 0 });
		expect(auth).toEqual({ apiKey: "token" });
	});

	// 验证 OpenAI Codex 适配器沿用访问令牌作为 API 密钥。
	it("openai-codex toAuth derives the api key from the access token", async () => {
		// auth 保存供 OpenAI Codex 请求层直接消费的授权字段。
		const auth = await openaiCodexOAuth.toAuth({ type: "oauth", access: "token", refresh: "r", expires: 0 });
		expect(auth).toEqual({ apiKey: "token" });
	});

	// 验证 OpenRouter 永久凭据无需交换刷新令牌且保持同一对象。
	it("openrouter derives the api key and keeps the permanent credential on refresh", async () => {
		// credential 模拟永不过期、没有刷新令牌的 OpenRouter OAuth 凭据。
		const credential = { type: "oauth" as const, access: "token", refresh: "", expires: Number.MAX_SAFE_INTEGER };
		expect(await openRouterOAuth.toAuth(credential)).toEqual({ apiKey: "token" });
		expect(await openRouterOAuth.refresh(credential)).toBe(credential);
	});

	// 验证 xAI 访问令牌会被映射为 API 密钥。
	it("xAI toAuth derives the api key from the access token", async () => {
		// auth 是 xAI 请求层需要的标准授权对象。
		const auth = await xaiOAuth.toAuth({ type: "oauth", access: "token", refresh: "r", expires: 0 });
		expect(auth).toEqual({ apiKey: "token" });
	});

	// 验证 Copilot 令牌中的代理端点可推导出实际 API 地址。
	it("github-copilot toAuth derives baseUrl from the token proxy endpoint", async () => {
		// access 模拟 Copilot 返回的分号分隔访问令牌，其中包含代理端点。
		const access = "tid=abc;exp=123;proxy-ep=proxy.enterprise.example;rest";
		// auth 同时包含原始令牌和从代理端点转换出的基础地址。
		const auth = await githubCopilotOAuth.toAuth({ type: "oauth", access, refresh: "r", expires: 0 });
		expect(auth).toEqual({ apiKey: access, baseUrl: "https://api.enterprise.example" });
	});

	// 验证缺少代理端点时依次使用企业域名和个人版默认地址。
	it("github-copilot toAuth falls back to the enterprise domain, then the individual endpoint", async () => {
		// enterprise 表示带企业实例地址的授权转换结果。
		const enterprise = await githubCopilotOAuth.toAuth({
			type: "oauth",
			access: "no-proxy-ep",
			refresh: "r",
			expires: 0,
			enterpriseUrl: "https://company.ghe.com",
		});
		expect(enterprise.baseUrl).toBe("https://copilot-api.company.ghe.com");

		// individual 表示没有企业信息时的个人版授权转换结果。
		const individual = await githubCopilotOAuth.toAuth({
			type: "oauth",
			access: "no-proxy-ep",
			refresh: "r",
			expires: 0,
		});
		expect(individual.baseUrl).toBe("https://api.individual.githubcopilot.com");
	});

	// 验证 Anthropic 刷新请求会生成字段完整且带未来过期时间的新凭据。
	it("anthropic refresh exchanges the refresh token and returns a typed credential", async () => {
		// 用固定响应替代真实令牌服务，避免测试依赖网络和账号。
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				jsonResponse({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 3600 }),
			),
		);

		// refreshed 是适配器用旧刷新令牌换得的新 OAuth 凭据。
		const refreshed = await anthropicOAuth.refresh({ type: "oauth", access: "old", refresh: "old-r", expires: 0 });
		expect(refreshed.type).toBe("oauth");
		expect(refreshed.access).toBe("new-access");
		expect(refreshed.refresh).toBe("new-refresh");
		expect(refreshed.expires).toBeGreaterThan(Date.now());
	});

	// 验证企业版 Copilot 刷新时不会丢失凭据绑定的企业域名。
	it("github-copilot refresh preserves the enterprise domain", async () => {
		// fetchedUrls 按调用顺序记录刷新流程访问的地址，用于验证域名选择。
		const fetchedUrls: string[] = [];
		// fetchMock 根据模型列表或令牌接口返回对应的最小模拟响应。
		const fetchMock = vi.fn(async (input: unknown) => {
			// url 将 Request 或字符串输入统一转换为便于断言的文本。
			const url = typeof input === "string" ? input : String(input);
			fetchedUrls.push(url);
			if (url.endsWith("/models")) {
				return jsonResponse({ data: [] });
			}
			return jsonResponse({ token: "new-token", expires_at: 9999999999 });
		});
		// 将模拟函数安装为全局 fetch，使刷新代码完全离线运行。
		vi.stubGlobal("fetch", fetchMock);

		// refreshed 保存刷新后的 Copilot 凭据，企业地址应原样保留。
		const refreshed = await githubCopilotOAuth.refresh({
			type: "oauth",
			access: "old",
			refresh: "gh-token",
			expires: 0,
			enterpriseUrl: "company.ghe.com",
		});
		expect(refreshed.access).toBe("new-token");
		expect(refreshed.enterpriseUrl).toBe("company.ghe.com");
		expect(fetchedUrls[0]).toContain("api.company.ghe.com");
	});
});

// 验证模型注册表通过懒加载适配器读取已保存 OAuth 凭据的完整链路。
describe("OAuth through Models.getAuth (lazy load chain)", () => {
	// 验证 Anthropic 凭据可从内存存储解析为模型授权信息。
	it("resolves stored anthropic oauth credentials via the lazy flow import", async () => {
		// credentials 是仅供当前测试使用的内存凭据仓库，不会写入磁盘。
		const credentials = new InMemoryCredentialStore();
		await credentials.modify("anthropic", async () => ({
			type: "oauth",
			access: "oauth-access-token",
			refresh: "r",
			expires: Date.now() + 60_000,
		}));
		// models 是绑定上述凭据仓库的模型注册表实例。
		const models = createModels({ credentials });
		models.setProvider(anthropicProvider());

		// model 取 Anthropic 注册结果中的首个模型，测试只关心其提供商标识。
		const model = models.getModels("anthropic")[0];
		// result 是模型注册表经懒加载 OAuth 适配器解析出的授权及来源。
		const result = await models.getAuth(model.provider);
		expect(result?.auth.apiKey).toBe("oauth-access-token");
		expect(result?.source).toBe("OAuth");
	});

	// 验证每份 Copilot 凭据携带的代理信息会进入最终授权基础地址。
	it("resolves stored github-copilot oauth credentials including per-credential baseUrl", async () => {
		// access 模拟包含商业版 Copilot 代理端点的访问令牌。
		const access = "tid=abc;exp=123;proxy-ep=proxy.business.githubcopilot.com;rest";
		// credentials 隔离保存当前用例的 Copilot OAuth 凭据。
		const credentials = new InMemoryCredentialStore();
		await credentials.modify("github-copilot", async () => ({
			type: "oauth",
			access,
			refresh: "r",
			expires: Date.now() + 60_000,
		}));
		// models 是安装了 GitHub Copilot 提供商的测试模型注册表。
		const models = createModels({ credentials });
		models.setProvider(githubCopilotProvider());

		// model 是注册表中首个 Copilot 模型，用于获得正确的提供商键。
		const model = models.getModels("github-copilot")[0];
		// result 包含原始访问令牌以及按凭据推导的企业 API 地址。
		const result = await models.getAuth(model.provider);
		expect(result?.auth.apiKey).toBe(access);
		expect(result?.auth.baseUrl).toBe("https://api.business.githubcopilot.com");
	});
});
