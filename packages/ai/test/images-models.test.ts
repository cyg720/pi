/**
 * 文件职责：验证图片模型注册表的提供商管理、认证合并、动态刷新和内置目录行为。
 * 技术维度：使用 Vitest、内存认证上下文与假图片提供商，对 ImagesModels 公共接口进行单元测试。
 * 产品维度：保证图片生成模型能被正确发现、认证和调用，并能安全刷新远程模型目录。
 * 逻辑维度：先构造认证、模型、结果和提供商夹具，再覆盖注册、请求选项、错误、刷新及内置提供商。
 * 关键边界：测试不访问真实图片服务；动态刷新中的延迟只用于验证并发去重；显式请求选项优先于认证结果。
 * 新手阅读建议：先看四个夹具函数，再按注册、认证、刷新、内置目录的顺序阅读用例。
 */
import { describe, expect, it } from "vitest";
import type { AuthContext } from "../src/auth/types.ts";
import { createImagesModels, createImagesProvider, type ImagesProvider } from "../src/images-models.ts";
import { builtinImagesModels } from "../src/providers/all.ts";
import type { AssistantImages, ImagesApi, ImagesContext, ImagesModel, ImagesOptions } from "../src/types.ts";

/**
 * 创建只从给定映射读取环境变量的认证上下文。
 * @param env 环境变量名到值的测试映射。
 * @returns 不读取真实文件系统的 AuthContext。
 * @example fakeAuthContext({ TEST_KEY: "secret" });
 */
function fakeAuthContext(env: Record<string, string>): AuthContext {
	return {
		env: async (name) => env[name],
		fileExists: async () => false,
	};
}

/**
 * 创建最小图片模型定义。
 * @param provider 所属提供商标识。
 * @param id 模型标识和显示名称。
 * @returns 只支持文字输入、图片输出的零成本测试模型。
 * @example testImageModel("p1", "model-a");
 */
function testImageModel(provider: string, id: string): ImagesModel<ImagesApi> {
	return {
		id,
		name: id,
		api: "test-images",
		provider,
		baseUrl: "https://example.test/v1",
		input: ["text"],
		output: ["image"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	};
}

/**
 * 为指定模型创建成功的固定图片生成结果。
 * @param model 决定结果中 API、提供商和模型字段的模型。
 * @returns 包含一个微型 PNG Base64 数据的助手结果。
 * @example okResult(testImageModel("p1", "m1"));
 */
function okResult(model: ImagesModel<ImagesApi>): AssistantImages {
	return {
		api: model.api,
		provider: model.provider,
		model: model.id,
		output: [{ type: "image", data: "aGk=", mimeType: "image/png" }],
		stopReason: "stop",
		timestamp: Date.now(),
	};
}

/** 记录一次图片生成调用收到的模型和最终合并选项。 */
interface GenerateCall {
	model: ImagesModel<ImagesApi>;
	options: ImagesOptions | undefined;
}

/**
 * 创建可选认证、模型列表和调用记录的图片提供商。
 * @param input 提供商标识、可选模型、环境变量名和调用记录数组。
 * @returns 可注册到 ImagesModels 的测试提供商。
 * @example testProvider({ id: "p1", envVar: "TEST_KEY", calls: [] });
 */
function testProvider(input: {
	id: string;
	models?: ImagesModel<ImagesApi>[];
	envVar?: string;
	calls?: GenerateCall[];
}): ImagesProvider {
	return createImagesProvider({
		id: input.id,
		auth: {
			apiKey: {
				name: "Test key",
				resolve: async ({ ctx, credential }) => {
					if (!input.envVar) return { auth: {} };
					/** 显式凭据优先，否则从假认证上下文读取指定环境变量。 */
					const key = credential?.key ?? (await ctx.env(input.envVar));
					return key ? { auth: { apiKey: key }, source: credential ? "stored" : input.envVar } : undefined;
				},
			},
		},
		models: input.models ?? [testImageModel(input.id, "model-a")],
		api: {
			generateImages: async (model, _context, options) => {
				input.calls?.push({ model, options });
				return okResult(model);
			},
		},
	});
}

/** 所有图片生成用例复用的文字提示上下文。 */
const context: ImagesContext = { input: [{ type: "text", text: "a red circle" }] };

/** 覆盖图片模型注册表的同步查询、认证、调用、刷新和内置配置。 */
describe("ImagesModels", () => {
	it("registers providers and reads models synchronously", () => {
		/** models 是本例新建的空图片模型注册表，随后注册 p1 与 p2。 */
		const models = createImagesModels();
		models.setProvider(testProvider({ id: "p1", models: [testImageModel("p1", "m1"), testImageModel("p1", "m2")] }));
		models.setProvider(testProvider({ id: "p2", models: [testImageModel("p2", "m3")] }));

		expect(models.getProviders().map((p) => p.id)).toEqual(["p1", "p2"]);
		expect(models.getModels().map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
		expect(models.getModels("p1").map((m) => m.id)).toEqual(["m1", "m2"]);
		expect(models.getModel("p2", "m3")?.id).toBe("m3");
		expect(models.getModel("p2", "missing")).toBeUndefined();

		models.deleteProvider("p1");
		expect(models.getProvider("p1")).toBeUndefined();
	});

	it("resolves auth through the provider and merges it into requests; explicit options win", async () => {
		/** 收集提供商实际收到的图片生成调用。 */
		const calls: GenerateCall[] = [];
		/** 使用 TEST_KEY 假环境变量的图片模型注册表。 */
		const models = createImagesModels({ authContext: fakeAuthContext({ TEST_KEY: "env-key" }) });
		models.setProvider(testProvider({ id: "p1", envVar: "TEST_KEY", calls }));
		/** 从注册表取得的待生成模型。 */
		const model = models.getModel("p1", "model-a")!;

		expect((await models.getAuth(model))?.auth.apiKey).toBe("env-key");
		expect((await models.getAuth(model.provider))?.auth.apiKey).toBe("env-key");
		expect((await models.getAuth(model, { apiKey: "explicit-key" }))?.auth.apiKey).toBe("explicit-key");

		/** 首次生成的成功结果。 */
		const result = await models.generateImages(model, context);
		expect(result.stopReason).toBe("stop");
		expect(calls[0].options?.apiKey).toBe("env-key");

		await models.generateImages(model, context, { apiKey: "explicit" });
		expect(calls[1].options?.apiKey).toBe("explicit");
	});

	it("merges provider-resolved env into image options", async () => {
		/** 收集环境合并场景中提供商收到的选项。 */
		const calls: GenerateCall[] = [];
		/** 未覆盖认证上下文的空图片模型注册表。 */
		const models = createImagesModels();
		models.setProvider(
			createImagesProvider({
				id: "p1",
				auth: {
					apiKey: {
						name: "Test key",
						resolve: async () => ({
							auth: { apiKey: "provider-key" },
							env: { PROVIDER_ONLY: "provider", SHARED: "provider" },
						}),
					},
				},
				models: [testImageModel("p1", "model-a")],
				api: {
					generateImages: async (model, _context, options) => {
						calls.push({ model, options });
						return okResult(model);
					},
				},
			}),
		);
		/** 环境合并场景的测试模型。 */
		const model = models.getModel("p1", "model-a")!;

		await models.generateImages(model, context, {
			apiKey: "request-key",
			env: { REQUEST_ONLY: "request", SHARED: "request" },
		});

		expect(calls[0].options?.apiKey).toBe("request-key");
		expect(calls[0].options?.env).toEqual({
			PROVIDER_ONLY: "provider",
			REQUEST_ONLY: "request",
			SHARED: "request",
		});
	});

	it("returns an error result for unknown providers and unconfigured auth rejections", async () => {
		/** 没有任何认证环境的图片模型注册表。 */
		const models = createImagesModels({ authContext: fakeAuthContext({}) });
		/** 引用未注册提供商的模型，用于验证错误结果。 */
		const ghost = await models.generateImages(testImageModel("ghost", "m"), context);
		expect(ghost.stopReason).toBe("error");
		expect(ghost.errorMessage).toContain("Unknown provider: ghost");

		// unconfigured (resolve -> undefined) still dispatches; provider decides what to do
		// 未配置认证时解析结果为 undefined，但仍会派发请求，由提供商决定如何处理。
		/** 记录缺失认证时是否仍发生生成调用。 */
		const calls: GenerateCall[] = [];
		models.setProvider(testProvider({ id: "p1", envVar: "MISSING", calls }));
		/** 缺少 MISSING 环境变量的模型。 */
		const model = models.getModel("p1", "model-a")!;
		expect(await models.getAuth(model)).toBeUndefined();
		await models.generateImages(model, context);
		expect(calls[0].options?.apiKey).toBeUndefined();
	});

	it("supports dynamic providers via refresh with in-flight dedupe", async () => {
		/** refreshModels 实际执行次数，用于验证并发刷新去重。 */
		let fetches = 0;
		/** 能动态列出一个模型的提供商。 */
		const provider = createImagesProvider({
			id: "dyn",
			auth: { apiKey: { name: "Test", resolve: async () => ({ auth: {} }) } },
			models: [],
			refreshModels: async () => {
				fetches++;
				await new Promise((resolve) => setTimeout(resolve, 5));
				return [testImageModel("dyn", "listed")];
			},
			api: { generateImages: async (model) => okResult(model) },
		});
		/** 注册动态提供商的图片模型注册表。 */
		const models = createImagesModels();
		models.setProvider(provider);

		expect(models.getModels("dyn")).toEqual([]);
		await Promise.all([models.refresh("dyn"), models.refresh("dyn")]);
		expect(fetches).toBe(1);
		expect(models.getModel("dyn", "listed")).toBeDefined();

		// failures reject with ModelsError for a single provider
		models.setProvider(
			createImagesProvider({
				id: "flaky",
				auth: { apiKey: { name: "Test", resolve: async () => ({ auth: {} }) } },
				models: [],
				refreshModels: async () => {
					throw new Error("fetch failed");
				},
				api: { generateImages: async (model) => okResult(model) },
			}),
		);
		await expect(models.refresh("flaky")).rejects.toMatchObject({ code: "model_source" });
		await expect(models.refresh()).resolves.toBeUndefined();
	});

	it("builtinImagesModels registers the openrouter provider with its catalog", async () => {
		/** 带 OpenRouter 假密钥的内置图片模型注册表。 */
		const models = builtinImagesModels({ authContext: fakeAuthContext({ OPENROUTER_API_KEY: "or-key" }) });
		/** 内置注册表暴露的提供商列表。 */
		const providers = models.getProviders();
		expect(providers.map((p) => p.id)).toEqual(["openrouter"]);

		/** OpenRouter 内置图片模型目录。 */
		const list = models.getModels("openrouter");
		expect(list.length).toBeGreaterThan(0);
		expect(list.every((m) => m.api === "openrouter-images")).toBe(true);

		expect((await models.getAuth(list[0]))?.auth.apiKey).toBe("or-key");
	});
});
