/**
 * 文件职责：验证扩展提供商在原生认证、models.json 覆盖、动态刷新和旧 OAuth modifyModels 生命周期中的兼容行为。
 * 技术维度：使用 Vitest、ModelRuntime/ModelRegistry、内存凭据与模型存储，以及临时 models.json 执行集成测试。
 * 产品维度：让新旧扩展都能可靠注册模型、登录认证、应用用户覆盖，并在登录状态变化时更新目录。
 * 逻辑维度：先定义基础模型工厂，再覆盖原生 Provider、配置覆盖、非持久刷新和旧 OAuth 凭据增删模型。
 * 关键边界：动态 refreshModels 结果默认不写 ModelsStore；models.json 覆盖高于原生数据；注销需移除凭据模型。
 * 新手阅读建议：先看 model 工厂，再按“注册、覆盖、刷新、OAuth”四个用例理解模型目录的层级来源。
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InMemoryModelsStore, type Model, type Provider } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { ModelRegistry } from "../src/core/model-registry.ts";
import { ModelRuntime } from "../src/core/model-runtime.ts";

/** 构造扩展 OAuth 提供商的基础 OpenAI Completions 模型；参数 id 为模型 ID；返回 Model。 */
function model(id: string): Model<"openai-completions"> {
	return {
		id,
		name: id,
		api: "openai-completions",
		provider: "extension-oauth",
		baseUrl: "https://example.test/v1",
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 1000,
		maxTokens: 100,
	};
}

// 验证扩展提供商从注册到注销期间的模型和认证生命周期。
describe("extension provider model lifecycle", () => {
	// 原生 pi-ai Provider 应保留自己的认证实现、模型列表和注册表身份。
	it("registers native pi-ai providers with their auth implementation", async () => {
		// runtime 是禁网、空凭据和内存模型存储的运行时。
		const runtime = await ModelRuntime.create({
			credentials: AuthStorage.inMemory(),
			modelsStore: new InMemoryModelsStore(),
			modelsPath: null,
			allowModelNetwork: false,
		});
		// nativeModel 是属于 extension-native 且带回退地址的模型。
		const nativeModel = {
			...model("native"),
			provider: "extension-native",
			baseUrl: "https://fallback.test/v1",
		};
		// provider 是带登录、检查、解析和流接口的完整原生提供商。
		const provider: Provider = {
			id: "extension-native",
			name: "Extension Native",
			auth: {
				apiKey: {
					name: "Native setup",
					login: async (interaction) => ({
						type: "api_key",
						key: await interaction.prompt({ type: "secret", message: "API key" }),
					}),
					check: async ({ credential }) =>
						credential?.key ? { type: "api_key", source: "stored native key" } : undefined,
					resolve: async ({ credential }) =>
						credential?.key
							? {
									auth: { apiKey: credential.key, baseUrl: "https://resolved.test/v1" },
									source: "stored native key",
								}
							: undefined,
				},
			},
			getModels: () => [nativeModel],
			stream: () => {
				throw new Error("unused");
			},
			streamSimple: () => {
				throw new Error("unused");
			},
		};

		runtime.registerNativeProvider(provider);
		// registry 是面向旧调用方的 ModelRuntime 兼容包装。
		const registry = new ModelRegistry(runtime);
		expect(registry.getProvider("extension-native")).toBe(provider);
		expect(registry.getRegisteredNativeProvider("extension-native")).toBe(provider);
		expect(registry.getRegisteredProviderIds()).toContain("extension-native");
		expect(registry.find("extension-native", "native")).toBeDefined();

		await runtime.login("extension-native", "api_key", {
			prompt: async () => "secret",
			notify: () => {},
		});
		expect(await registry.getProviderAuth("extension-native")).toMatchObject({
			auth: { apiKey: "secret", baseUrl: "https://resolved.test/v1" },
		});

		registry.unregisterProvider("extension-native");
		expect(registry.getProvider("extension-native")).toBeUndefined();
	});

	// models.json 中的 modelOverrides 应覆盖原生提供商给出的模型字段。
	it("applies models.json overrides above native providers", async () => {
		// tempDir 保存本用例 models.json，finally 中删除。
		const tempDir = mkdtempSync(join(tmpdir(), "pi-native-provider-"));
		// modelsPath 指向含 contextWindow 覆盖的临时配置。
		const modelsPath = join(tempDir, "models.json");
		writeFileSync(
			modelsPath,
			JSON.stringify({
				providers: {
					"extension-native": {
						modelOverrides: {
							native: { contextWindow: 4242 },
						},
					},
				},
			}),
		);
		try {
			// runtime 先加载用户配置，再接收原生提供商注册。
			const runtime = await ModelRuntime.create({
				credentials: AuthStorage.inMemory(),
				modelsStore: new InMemoryModelsStore(),
				modelsPath,
				allowModelNetwork: false,
			});
			// nativeModel 是原生提供商给出的基础模型，稍后应被配置覆盖。
			const nativeModel = {
				...model("native"),
				provider: "extension-native",
				baseUrl: "https://native.test/v1",
			};
			runtime.registerNativeProvider({
				id: "extension-native",
				name: "Extension Native",
				auth: {
					apiKey: {
						name: "Native key",
						resolve: async () => ({ auth: { apiKey: "key" }, source: "native" }),
					},
				},
				getModels: () => [nativeModel],
				stream: () => {
					throw new Error("unused");
				},
				streamSimple: () => {
					throw new Error("unused");
				},
			});

			expect(runtime.getModel("extension-native", "native")?.contextWindow).toBe(4242);
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	// refreshModels 可发布实时目录，而不强制把结果持久化到 ModelsStore。
	it("publishes refreshModels results without forcing ModelsStore persistence", async () => {
		// modelsStore 用于确认动态刷新没有自动写入缓存。
		const modelsStore = new InMemoryModelsStore();
		// runtime 是禁网但允许扩展自身 refreshModels 运行的模型运行时。
		const runtime = await ModelRuntime.create({
			credentials: AuthStorage.inMemory(),
			modelsStore,
			modelsPath: null,
			allowModelNetwork: false,
		});
		runtime.registerProvider("extension-dynamic", {
			baseUrl: "http://localhost:8080/v1",
			apiKey: "local",
			api: "openai-completions",
			refreshModels: async () => [
				{
					...model("live"),
					provider: "extension-dynamic",
					baseUrl: "http://localhost:8080/v1",
				},
			],
		});

		await runtime.refresh({ allowNetwork: false });
		expect(runtime.getModel("extension-dynamic", "live")).toBeDefined();
		expect(await modelsStore.read("extension-dynamic")).toBeUndefined();
	});

	// 旧式 OAuth modifyModels 应在异步凭据初始化后添加模型，并在注销后撤销。
	it("applies legacy OAuth modifyModels after async credential initialization", async () => {
		// runtime 预装一份未过期的旧式扩展 OAuth 凭据。
		const runtime = await ModelRuntime.create({
			credentials: AuthStorage.inMemory({
				"extension-oauth": {
					type: "oauth",
					access: "access",
					refresh: "refresh",
					expires: Date.now() + 60_000,
				},
			}),
			modelsStore: new InMemoryModelsStore(),
			modelsPath: null,
			allowModelNetwork: false,
		});
		runtime.registerProvider("extension-oauth", {
			baseUrl: "https://example.test/v1",
			api: "openai-completions",
			models: [model("base")],
			oauth: {
				name: "Extension OAuth",
				login: async () => {
					throw new Error("not used");
				},
				refreshToken: async (credential) => credential,
				getApiKey: (credential) => credential.access,
				modifyModels: (models, credential) =>
					credential.access === "access" ? [...models, model("credential-model")] : models,
			},
		});

		await runtime.refresh({ allowNetwork: false });
		expect(runtime.getModel("extension-oauth", "base")).toBeDefined();
		expect(runtime.getModel("extension-oauth", "credential-model")).toBeDefined();

		await runtime.logout("extension-oauth");
		expect(runtime.getModel("extension-oauth", "credential-model")).toBeUndefined();
	});
});
