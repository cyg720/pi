/**
 * 文件职责：验证 ModelRuntime 接受统一凭据存储、投影认证方法、解析请求环境并正确合并/变换请求头。
 * 技术维度：使用 Vitest、内存 AuthStorage/CredentialStore 和动态注册扩展提供商构造认证单元测试。
 * 产品维度：让登录 UI 展示真实提供商认证方式，并保证扩展提供商能安全使用环境变量、OAuth 和自定义头。
 * 逻辑维度：authOptions 投影方法，testModel 创建模型，再覆盖存储、可用性、方法状态和请求头处理。
 * 关键边界：显式 Authorization 大小写不敏感地覆盖自动头；transformHeaders 只执行一次且不下传。
 * 新手阅读建议：先看 authOptions 如何从提供商生成选项，再读凭据存储和扩展提供商，最后看头合并测试。
 */
import { type AuthType, type CredentialStore, InMemoryCredentialStore } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { ModelRuntime } from "../src/core/model-runtime.ts";

/**
 * 将运行时提供商认证方法投影为 UI 可用选项。
 * @param runtime 模型运行时。
 * @param type 可选只保留 oauth 或 api_key。
 * @returns 认证类型、提供商和方法数组。
 */
function authOptions(runtime: ModelRuntime, type?: AuthType) {
	return runtime
		.getProviders()
		.flatMap((provider) => [
			...(!type || type === "oauth"
				? provider.auth.oauth
					? [{ type: "oauth" as const, provider, method: provider.auth.oauth }]
					: []
				: []),
			...(!type || type === "api_key"
				? provider.auth.apiKey
					? [{ type: "api_key" as const, provider, method: provider.auth.apiKey }]
					: []
				: []),
		]);
}

/**
 * 创建扩展提供商使用的最小模型元数据。
 * @param id 模型标识和名称。
 * @returns 无成本文本模型字段。
 */
function testModel(id: string) {
	return {
		id,
		name: id,
		reasoning: false,
		input: ["text"] as ("text" | "image")[],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 10000,
		maxTokens: 1000,
	};
}

/** 覆盖 ModelRuntime 的认证方法发现、凭据读取和请求选项组装。 */
describe("ModelRuntime auth options", () => {
	it("accepts a pi-ai CredentialStore", async () => {
		/** 预置 anthropic API Key 的通用凭据存储。 */
		const credentials = new InMemoryCredentialStore();
		await credentials.modify("anthropic", async () => ({ type: "api_key", key: "stored-key" }));
		/** 使用 pi-ai CredentialStore 创建的模型运行时。 */
		const runtime = await ModelRuntime.create({ credentials, modelsPath: null });

		expect((await runtime.getAuth("anthropic"))?.auth.apiKey).toBe("stored-key");
	});

	it("scopes provider availability reads and records refresh failures", async () => {
		/** 实际保存凭据的底层内存存储。 */
		const base = new InMemoryCredentialStore();
		/** 凭据读取过的提供商标识。 */
		const reads: string[] = [];
		/** 是否让后续 read 调用失败。 */
		let failReads = false;
		/** 记录读取范围并可注入失败的凭据存储包装器。 */
		const credentials: CredentialStore = {
			read: async (providerId) => {
				reads.push(providerId);
				if (failReads) throw new Error(`read failed for ${providerId}`);
				return base.read(providerId);
			},
			list: () => base.list(),
			modify: (providerId, fn) => base.modify(providerId, fn),
			delete: (providerId) => base.delete(providerId),
		};
		/** 使用记录型凭据存储的运行时。 */
		const runtime = await ModelRuntime.create({ credentials, modelsPath: null });

		reads.length = 0;
		await runtime.getAvailable("anthropic");
		expect(new Set(reads)).toEqual(new Set(["anthropic"]));

		failReads = true;
		await expect(runtime.getAvailable("anthropic")).rejects.toThrow("Credential store read failed for anthropic");
		expect(runtime.getError()).toContain("Availability refresh: Credential store read failed for anthropic");

		failReads = false;
		await runtime.getAvailable();
		expect(runtime.getError()).toBeUndefined();
	});

	it("projects provider-owned methods, names, and status", async () => {
		/** 使用内存认证的内置提供商运行时。 */
		const runtime = await ModelRuntime.create({ credentials: AuthStorage.inMemory(), modelsPath: null });
		/** 所有提供商暴露的认证选项。 */
		const options = authOptions(runtime);

		expect(options).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "api_key",
					provider: expect.objectContaining({ id: "amazon-bedrock", name: "Amazon Bedrock" }),
					method: expect.objectContaining({ name: "AWS credentials or bearer token" }),
				}),
				expect.objectContaining({
					type: "api_key",
					provider: expect.objectContaining({ id: "google-vertex", name: "Google Vertex AI" }),
					method: expect.objectContaining({ name: "Google Cloud credentials" }),
				}),
				expect.objectContaining({
					type: "oauth",
					provider: expect.objectContaining({ id: "anthropic", name: "Anthropic" }),
				}),
				expect.objectContaining({
					type: "api_key",
					provider: expect.objectContaining({ id: "cloudflare-ai-gateway", name: "Cloudflare AI Gateway" }),
				}),
				expect.objectContaining({
					type: "api_key",
					provider: expect.objectContaining({ id: "cloudflare-workers-ai", name: "Cloudflare Workers AI" }),
				}),
			]),
		);
		expect(authOptions(runtime, "api_key").every((option) => option.type === "api_key")).toBe(true);
		expect(authOptions(runtime, "oauth").every((option) => option.type === "oauth")).toBe(true);
		expect(options.some((option) => option.provider.id === "openai-codex" && option.type === "api_key")).toBe(false);
	});

	it("attaches the provider's active auth status to every method option", async () => {
		/** 预置 Anthropic OAuth 凭据的运行时。 */
		const runtime = await ModelRuntime.create({
			credentials: AuthStorage.inMemory({
				anthropic: {
					type: "oauth",
					access: "access",
					refresh: "refresh",
					expires: Date.now() + 60_000,
				},
			}),
			modelsPath: null,
		});

		/** Anthropic 所有认证方法选项。 */
		const options = authOptions(runtime).filter((option) => option.provider.id === "anthropic");
		expect(options).toHaveLength(2);
		expect(await runtime.checkAuth("anthropic")).toMatchObject({ type: "oauth" });
	});

	it("distinguishes subscription OAuth from generic OAuth sign-in", async () => {
		const runtime = await ModelRuntime.create({
			credentials: AuthStorage.inMemory({
				anthropic: {
					type: "oauth",
					access: "anthropic-access",
					refresh: "anthropic-refresh",
					expires: Date.now() + 60 * 60_000,
				},
				openrouter: {
					type: "oauth",
					access: "openrouter-key",
					refresh: "",
					expires: Number.MAX_SAFE_INTEGER,
				},
				radius: {
					type: "oauth",
					access: "radius-access",
					refresh: "radius-refresh",
					expires: Date.now() + 60 * 60_000,
				},
			}),
			modelsPath: null,
		});

		expect(runtime.isUsingOAuth("anthropic")).toBe(true);
		expect(runtime.isUsingSubscription("anthropic")).toBe(true);
		expect(runtime.isUsingOAuth("openrouter")).toBe(true);
		expect(runtime.isUsingSubscription("openrouter")).toBe(false);
		expect(runtime.isUsingOAuth("radius")).toBe(true);
		expect(runtime.isUsingSubscription("radius")).toBe(false);
	});

	it("constructs an API key method for an extension API-key provider", async () => {
		/** 用于注册 API Key 扩展提供商的运行时。 */
		const runtime = await ModelRuntime.create({ credentials: AuthStorage.inMemory(), modelsPath: null });
		runtime.registerProvider("extension-api-key", {
			name: "Extension API Key",
			baseUrl: "https://example.test/v1",
			apiKey: "$EXTENSION_TEST_API_KEY",
			api: "openai-completions",
			models: [testModel("extension-model")],
		});

		/** 新扩展提供商对应的认证选项。 */
		const options = authOptions(runtime).filter((option) => option.provider.id === "extension-api-key");
		expect(options).toHaveLength(1);
		expect(options[0]).toMatchObject({
			type: "api_key",
			provider: { id: "extension-api-key", name: "Extension API Key" },
			method: { name: "API key" },
		});
		expect(options[0]?.method.login).toBeTypeOf("function");
	});

	it("resolves configured auth from request-scoped environment overrides", async () => {
		/** 用于验证请求级环境覆盖的运行时。 */
		const runtime = await ModelRuntime.create({ credentials: AuthStorage.inMemory(), modelsPath: null });
		runtime.registerProvider("request-env-provider", {
			baseUrl: "https://example.test/v1",
			apiKey: "$REQUEST_SCOPED_API_KEY",
			headers: { "x-request-value": "$REQUEST_SCOPED_HEADER" },
			api: "openai-completions",
			models: [testModel("request-env-model")],
		});

		/** 使用请求级环境解析出的认证结果。 */
		const auth = await runtime.getAuth("request-env-provider", {
			env: { REQUEST_SCOPED_API_KEY: "request-key", REQUEST_SCOPED_HEADER: "request-header" },
		});

		expect(auth?.auth).toEqual({ apiKey: "request-key", headers: { "x-request-value": "request-header" } });
	});

	it("lets an explicit Authorization header override authHeader case-insensitively", async () => {
		/** 用于验证 Authorization 覆盖的运行时。 */
		const runtime = await ModelRuntime.create({ credentials: AuthStorage.inMemory(), modelsPath: null });
		/** 提供商流最终收到的头。 */
		let capturedHeaders: Record<string, string | null> | undefined;
		runtime.registerProvider("auth-header-provider", {
			baseUrl: "https://example.test/v1",
			apiKey: "generated-key",
			authHeader: true,
			api: "openai-completions",
			streamSimple: (_model, _context, options) => {
				capturedHeaders = options?.headers;
				throw new Error("captured");
			},
			models: [testModel("auth-header-model")],
		});
		/** 动态注册后取得的认证头测试模型。 */
		const model = runtime.getModel("auth-header-provider", "auth-header-model");
		expect(model).toBeDefined();

		await runtime.completeSimple(model!, { messages: [] }, { headers: { authorization: "Explicit token" } });

		expect(capturedHeaders).toEqual({ authorization: "Explicit token" });
	});

	it("transforms fully assembled headers once without forwarding the transform", async () => {
		/** 用于验证完整头变换的运行时。 */
		const runtime = await ModelRuntime.create({ credentials: AuthStorage.inMemory(), modelsPath: null });
		/** 变换后提供商流收到的头。 */
		let capturedHeaders: Record<string, string | null> | undefined;
		/** transformHeaders 实际执行次数。 */
		let transforms = 0;
		runtime.registerProvider("header-provider", {
			baseUrl: "https://example.test/v1",
			apiKey: "generated-key",
			authHeader: true,
			headers: { "x-provider": "provider" },
			api: "openai-completions",
			streamSimple: (_model, _context, options) => {
				expect(options).not.toHaveProperty("transformHeaders");
				capturedHeaders = options?.headers;
				throw new Error("captured");
			},
			models: [{ ...testModel("header-model"), headers: { "x-model": "model" } }],
		});
		/** 动态注册后取得的头变换测试模型。 */
		const model = runtime.getModel("header-provider", "header-model");
		expect(model).toBeDefined();

		await runtime.completeSimple(
			model!,
			{ messages: [] },
			{
				headers: { "x-explicit": "explicit" },
				transformHeaders: async (headers) => {
					transforms++;
					expect(headers).toEqual({
						Authorization: "Bearer generated-key",
						"x-provider": "provider",
						"x-model": "model",
						"x-explicit": "explicit",
					});
					return { ...headers, "x-transformed": "yes" };
				},
			},
		);

		expect(transforms).toBe(1);
		expect(capturedHeaders).toEqual({
			Authorization: "Bearer generated-key",
			"x-provider": "provider",
			"x-model": "model",
			"x-explicit": "explicit",
			"x-transformed": "yes",
		});
	});

	it("forwards cancellation to extension OAuth refresh", async () => {
		const credentials = AuthStorage.inMemory({
			"extension-oauth": {
				type: "oauth",
				access: "expired",
				refresh: "refresh",
				expires: 0,
			},
		});
		const runtime = await ModelRuntime.create({ credentials, modelsPath: null });
		let refreshSignal: AbortSignal | undefined;
		runtime.registerProvider("extension-oauth", {
			name: "Extension OAuth",
			baseUrl: "https://example.test/v1",
			api: "openai-completions",
			oauth: {
				name: "Extension subscription",
				login: async () => ({ access: "access", refresh: "refresh", expires: Date.now() + 60_000 }),
				refreshToken: async (credential, signal) => {
					refreshSignal = signal;
					return { ...credential, expires: Date.now() + 60_000 };
				},
				getApiKey: (credential) => credential.access,
			},
			models: [testModel("extension-model")],
		});
		const controller = new AbortController();

		await runtime.getAuth("extension-oauth", { signal: controller.signal });
		expect(refreshSignal).toBeInstanceOf(AbortSignal);
		const reason = new Error("cancelled");
		controller.abort(reason);
		expect(refreshSignal?.aborted).toBe(true);
		expect(refreshSignal?.reason).toBe(reason);
	});

	it("does not fabricate an API key method for an extension OAuth-only provider", async () => {
		/** 用于注册 OAuth-only 扩展提供商的运行时。 */
		const runtime = await ModelRuntime.create({ credentials: AuthStorage.inMemory(), modelsPath: null });
		runtime.registerProvider("extension-oauth", {
			name: "Extension OAuth",
			baseUrl: "https://example.test/v1",
			api: "openai-completions",
			oauth: {
				name: "Extension subscription",
				isSubscription: true,
				login: async () => ({ access: "access", refresh: "refresh", expires: Date.now() + 60_000 }),
				refreshToken: async (credentials) => credentials,
				getApiKey: (credentials) => credentials.access,
			},
			models: [testModel("extension-model")],
		});

		/** OAuth-only 提供商对应的认证选项。 */
		const options = authOptions(runtime).filter((option) => option.provider.id === "extension-oauth");
		expect(options).toHaveLength(1);
		expect(options[0]).toMatchObject({
			type: "oauth",
			provider: { id: "extension-oauth", name: "Extension OAuth" },
			method: { name: "Extension subscription", isSubscription: true },
		});
	});
});
