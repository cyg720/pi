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
import { getModels as getCompatModels } from "../src/compat.ts";
import {
	type CreateProviderOptions,
	createModels,
	createProvider,
	getModelType,
	hasApi,
	isModelType,
	type Provider,
} from "../src/models.ts";
import { InMemoryModelsStore } from "../src/models-store.ts";
import {
	builtinModels,
	getAllBuiltinModels,
	getBuiltinClassifierModels,
	getBuiltinImageModel,
	getBuiltinImageModels,
	getBuiltinModels,
} from "../src/providers/all.ts";
import type {
	AnyModel,
	Api,
	AssistantImages,
	ImageApi,
	ImageModel,
	ImagesContext,
	ImagesOptions,
	Model,
} from "../src/types.ts";
import { AssistantMessageEventStream } from "../src/utils/event-stream.ts";

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

<<<<<<< HEAD
/**
 * 创建最小图片模型定义。
 * @param provider 所属提供商标识。
 * @param id 模型标识和显示名称。
 * @returns 只支持文字输入、图片输出的零成本测试模型。
 * @example testImageModel("p1", "model-a");
 */
function testImageModel(provider: string, id: string): ImagesModel<ImagesApi> {
=======
function imageModel(provider: string, id: string): ImageModel<ImageApi> {
>>>>>>> main
	return {
		type: "image",
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

<<<<<<< HEAD
/**
 * 为指定模型创建成功的固定图片生成结果。
 * @param model 决定结果中 API、提供商和模型字段的模型。
 * @returns 包含一个微型 PNG Base64 数据的助手结果。
 * @example okResult(testImageModel("p1", "m1"));
 */
function okResult(model: ImagesModel<ImagesApi>): AssistantImages {
=======
function chatModel(provider: string, id: string): Model<Api> {
	return {
		id,
		name: id,
		api: "test-chat",
		provider,
		baseUrl: "https://example.test/v1",
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 1000,
		maxTokens: 100,
	};
}

function okResult(model: ImageModel<ImageApi>): AssistantImages {
>>>>>>> main
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
	model: ImageModel<ImageApi>;
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
	models?: AnyModel[];
	envVar?: string;
	calls?: GenerateCall[];
	images?: Record<string, boolean>;
}): Provider {
	const generateImages = async (model: ImageModel<ImageApi>, _context: ImagesContext, options?: ImagesOptions) => {
		input.calls?.push({ model, options });
		return okResult(model);
	};
	const imageApis = Object.keys(input.images ?? { "test-images": true });
	const allModels = input.models ?? [imageModel(input.id, "model-a")];
	return createProvider({
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
		models: allModels,
		api: {
			"test-chat": {
				stream: () => new AssistantMessageEventStream(),
				streamSimple: () => new AssistantMessageEventStream(),
			},
		},
		images: Object.fromEntries(imageApis.map((api) => [api, { generateImages }])),
	});
}

/** 所有图片生成用例复用的文字提示上下文。 */
const context: ImagesContext = { input: [{ type: "text", text: "a red circle" }] };

<<<<<<< HEAD
/** 覆盖图片模型注册表的同步查询、认证、调用、刷新和内置配置。 */
describe("ImagesModels", () => {
	it("registers providers and reads models synchronously", () => {
		/** models 是本例新建的空图片模型注册表，随后注册 p1 与 p2。 */
		const models = createImagesModels();
		models.setProvider(testProvider({ id: "p1", models: [testImageModel("p1", "m1"), testImageModel("p1", "m2")] }));
		models.setProvider(testProvider({ id: "p2", models: [testImageModel("p2", "m3")] }));
=======
describe("model discriminants", () => {
	it("treats models without a type as chat models", () => {
		const chat = chatModel("p", "c");
		const image = imageModel("p", "i");
>>>>>>> main

		expect(chat.type).toBeUndefined();
		expect(getModelType(chat)).toBe("chat");
		expect(getModelType({ ...chat, type: "chat" })).toBe("chat");
		expect(getModelType(image)).toBe("image");
		expect(isModelType(chat, "chat")).toBe(true);
		expect(isModelType(chat, "image")).toBe(false);
		expect(isModelType(image, "image")).toBe(true);

		// hasApi never matches an image model, even on an equal api string
		expect(hasApi({ ...image, api: "test-chat" }, "test-chat")).toBe(false);
		expect(hasApi(chat, "test-chat")).toBe(true);
	});
});

describe("Models with image models", () => {
	it("lists models without a type as chat models at createProvider boundaries", async () => {
		const provider = createProvider({
			id: "legacy",
			auth: { apiKey: { name: "Test", resolve: async () => ({ auth: {} }) } },
			models: [chatModel("legacy", "static"), imageModel("legacy", "static")],
			fetchModels: async () => [chatModel("legacy", "dynamic")],
			api: {
				stream: () => new AssistantMessageEventStream(),
				streamSimple: () => new AssistantMessageEventStream(),
			},
		});
		const models = createModels();
		models.setProvider(provider);

		expect(provider.getModels().map((model) => model.id)).toEqual(["static"]);
		await models.refresh({ providers: [provider.id] });
		expect(provider.getModels().map((model) => model.id)).toEqual(["static", "dynamic"]);
		expect(provider.getModels().map((model) => model.type)).toEqual([undefined, undefined]);
		expect(models.getModelsOfType("image", "legacy").map((model) => model.id)).toEqual(["static"]);
	});

<<<<<<< HEAD
	it("resolves auth through the provider and merges it into requests; explicit options win", async () => {
		/** 收集提供商实际收到的图片生成调用。 */
		const calls: GenerateCall[] = [];
		/** 使用 TEST_KEY 假环境变量的图片模型注册表。 */
		const models = createImagesModels({ authContext: fakeAuthContext({ TEST_KEY: "env-key" }) });
		models.setProvider(testProvider({ id: "p1", envVar: "TEST_KEY", calls }));
		/** 从注册表取得的待生成模型。 */
		const model = models.getModel("p1", "model-a")!;
=======
	it("lists chat, image, and all models through typed accessors", () => {
		const models = createModels();
		models.setProvider(
			testProvider({
				id: "p1",
				models: [chatModel("p1", "c1"), imageModel("p1", "i1"), imageModel("p1", "i2")],
			}),
		);
		models.setProvider(testProvider({ id: "p2", models: [imageModel("p2", "i3")] }));

		expect(models.getModels().map((m) => m.id)).toEqual(["c1"]);
		expect(models.getModelsOfType("chat").map((m) => m.id)).toEqual(["c1"]);
		expect(models.getModelsOfType("image").map((m) => m.id)).toEqual(["i1", "i2", "i3"]);
		expect(models.getModelsOfType("image", "p1").map((m) => m.id)).toEqual(["i1", "i2"]);
		expect(models.getModelsOfType("classifier")).toEqual([]);
		expect(models.getAllModels().map((m) => m.id)).toEqual(["c1", "i1", "i2", "i3"]);

		expect(models.getModel("p1", "c1")?.id).toBe("c1");
		expect(models.getModel("p1", "i1")).toBeUndefined();
		expect(models.getModelOfType("chat", "p1", "c1")?.id).toBe("c1");
		expect(models.getModelOfType("image", "p1", "i1")?.id).toBe("i1");
		expect(models.getModelOfType("image", "p1", "c1")).toBeUndefined();
	});

	it("splits available models by type", async () => {
		const models = createModels({ authContext: fakeAuthContext({ KEY: "k" }) });
		models.setProvider(
			testProvider({ id: "p1", envVar: "KEY", models: [chatModel("p1", "c1"), imageModel("p1", "i1")] }),
		);
		models.setProvider(testProvider({ id: "p2", envVar: "MISSING", models: [imageModel("p2", "i2")] }));

		expect((await models.getAvailable()).map((m) => m.id)).toEqual(["c1"]);
		expect((await models.getAvailableOfType("chat")).map((m) => m.id)).toEqual(["c1"]);
		expect((await models.getAvailableOfType("image")).map((m) => m.id)).toEqual(["i1"]);
		expect((await models.getAllAvailable()).map((m) => m.id)).toEqual(["c1", "i1"]);
	});

	it("resolves auth through the provider and merges it into image requests; explicit options win", async () => {
		const calls: GenerateCall[] = [];
		const models = createModels({ authContext: fakeAuthContext({ TEST_KEY: "env-key" }) });
		models.setProvider(testProvider({ id: "p1", envVar: "TEST_KEY", calls }));
		const model = models.getModelOfType("image", "p1", "model-a")!;
>>>>>>> main

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

<<<<<<< HEAD
	it("merges provider-resolved env into image options", async () => {
		/** 收集环境合并场景中提供商收到的选项。 */
		const calls: GenerateCall[] = [];
		/** 未覆盖认证上下文的空图片模型注册表。 */
		const models = createImagesModels();
=======
	it("merges provider-resolved env and applies header transforms", async () => {
		const calls: GenerateCall[] = [];
		const models = createModels();
>>>>>>> main
		models.setProvider(
			createProvider({
				id: "p1",
				auth: {
					apiKey: {
						name: "Test key",
						resolve: async () => ({
							auth: { apiKey: "provider-key", headers: { "x-base": "1" } },
							env: { PROVIDER_ONLY: "provider", SHARED: "provider" },
						}),
					},
				},
				models: [imageModel("p1", "model-a")],
				images: {
					"test-images": {
						generateImages: async (model, _context, options) => {
							calls.push({ model, options });
							return okResult(model);
						},
					},
				},
			}),
		);
<<<<<<< HEAD
		/** 环境合并场景的测试模型。 */
		const model = models.getModel("p1", "model-a")!;
=======
		const model = models.getModelOfType("image", "p1", "model-a")!;
>>>>>>> main

		await models.generateImages(model, context, {
			apiKey: "request-key",
			env: { REQUEST_ONLY: "request", SHARED: "request" },
			transformHeaders: (headers) => ({ ...headers, "x-extra": "2" }),
		});

		expect(calls[0].options?.apiKey).toBe("request-key");
		expect(calls[0].options?.env).toEqual({
			PROVIDER_ONLY: "provider",
			REQUEST_ONLY: "request",
			SHARED: "request",
		});
		expect(calls[0].options?.headers).toEqual({ "x-base": "1", "x-extra": "2" });
	});

<<<<<<< HEAD
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
=======
	it("returns error results instead of rejecting", async () => {
		const models = createModels({ authContext: fakeAuthContext({}) });

		const ghost = await models.generateImages(imageModel("ghost", "m"), context);
		expect(ghost.stopReason).toBe("error");
		expect(ghost.errorMessage).toContain("Unknown provider: ghost");

		// Unconfigured auth is an error, matching stream().
		const calls: GenerateCall[] = [];
		models.setProvider(testProvider({ id: "p1", envVar: "MISSING", calls }));
		const model = models.getModelOfType("image", "p1", "model-a")!;
>>>>>>> main
		expect(await models.getAuth(model)).toBeUndefined();
		const unconfigured = await models.generateImages(model, context);
		expect(unconfigured.stopReason).toBe("error");
		expect(unconfigured.errorMessage).toContain("not configured");
		expect(calls).toEqual([]);

<<<<<<< HEAD
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
=======
		const controller = new AbortController();
		controller.abort();
		const cancelled = await models.generateImages(model, context, { signal: controller.signal });
		expect(cancelled.stopReason).toBe("aborted");
		expect(calls).toEqual([]);
>>>>>>> main

		// A provider without any images implementation rejects image models it lists.
		models.setProvider(
			createProvider({
				id: "chat-only",
				auth: { apiKey: { name: "Test", resolve: async () => ({ auth: {} }) } },
				models: [imageModel("chat-only", "i")],
				api: {
					stream: () => new AssistantMessageEventStream(),
					streamSimple: () => new AssistantMessageEventStream(),
				},
			}),
		);
		const unsupported = await models.generateImages(models.getModelOfType("image", "chat-only", "i")!, context);
		expect(unsupported.stopReason).toBe("error");
		expect(unsupported.errorMessage).toContain("does not support image generation");

		// An images map without the model's api yields a provider error result.
		models.setProvider(
			testProvider({ id: "wrong-api", models: [imageModel("wrong-api", "i")], images: { "other-images": true } }),
		);
		const missingApi = await models.generateImages(models.getModelOfType("image", "wrong-api", "i")!, context);
		expect(missingApi.stopReason).toBe("error");
		expect(missingApi.errorMessage).toContain('no image generation implementation for "test-images"');
	});

<<<<<<< HEAD
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
=======
	it("rejects chat models at the image entry point at runtime", async () => {
		const models = createModels();
		const chat = chatModel("p1", "chat");
		models.setProvider(testProvider({ id: "p1", models: [chat], images: { "test-chat": true } }));

		const result = await models.generateImages(chat as unknown as ImageModel<ImageApi>, context);
		expect(result.stopReason).toBe("error");
		expect(result.errorMessage).toContain("is not an image model");
	});
>>>>>>> main

	it("rejects image models at the stream entry points at runtime", async () => {
		const models = createModels();
		models.setProvider(testProvider({ id: "p1" }));
		const image = models.getModelOfType("image", "p1", "model-a")!;

		const result = await models.streamSimple(image as unknown as Model<Api>, { messages: [] }).result();
		expect(result.stopReason).toBe("error");
		expect(result.errorMessage).toContain("is not a chat model");
	});

	it("requires at least one concrete operation implementation", () => {
		const createEmptyProvider = (implementations: Pick<CreateProviderOptions, "api" | "images" | "classifiers">) =>
			createProvider({
				id: "empty",
				auth: { apiKey: { name: "Test", resolve: async () => ({ auth: {} }) } },
				models: [],
				...implementations,
			});

		const message = 'at least one of "api", "images", or "classifiers"';
		expect(() => createEmptyProvider({})).toThrow(message);
		expect(() => createEmptyProvider({ api: {} })).toThrow(message);
		expect(() => createEmptyProvider({ images: {} })).toThrow(message);
		expect(() => createEmptyProvider({ classifiers: {} })).toThrow(message);
	});

	it("supports dynamic providers listing image models via refresh", async () => {
		let fetches = 0;
		const modelsStore = new InMemoryModelsStore();
		const models = createModels({ modelsStore });
		models.setProvider(
			createProvider({
				id: "dyn",
				auth: { apiKey: { name: "Test", resolve: async () => ({ auth: {} }) } },
				models: [],
				fetchModels: async () => {
					fetches++;
					return [imageModel("dyn", "listed"), chatModel("dyn", "chat")];
				},
				images: { "test-images": { generateImages: async (model) => okResult(model) } },
			}),
		);

		expect(models.getAllModels("dyn")).toEqual([]);
		const result = await models.refresh({ providers: ["dyn"] });
		expect(result.errors.size).toBe(0);
		expect(fetches).toBe(1);
		expect(models.getModelOfType("image", "dyn", "listed")).toBeDefined();
		expect(models.getModel("dyn", "chat")).toBeDefined();
		const stored = await modelsStore.read("dyn");
		expect(stored?.models.map((model) => model.id)).toEqual(["listed", "chat"]);
	});

	it("keeps existing built-in and compat model reads chat-only", () => {
		const chat = getBuiltinModels("openrouter");
		const images = getBuiltinImageModels("openrouter");
		const all = getAllBuiltinModels("openrouter");
		const compat = getCompatModels("openrouter");

		expect(chat.every((model) => isModelType(model, "chat"))).toBe(true);
		expect(images.every((model) => isModelType(model, "image"))).toBe(true);
		expect(all.some((model) => isModelType(model, "image"))).toBe(true);
		expect(compat).toEqual(chat);
		expect(chat.every((model) => model.contextWindow > 0)).toBe(true);
		expect(chat.length + images.length + getBuiltinClassifierModels("openrouter").length).toBe(all.length);
		expect(getBuiltinImageModel("openrouter", "black-forest-labs/flux.2-pro").type).toBe("image");
	});

	it("builtinModels exposes OpenRouter image models under the openrouter provider", async () => {
		const models = builtinModels({ authContext: fakeAuthContext({ OPENROUTER_API_KEY: "or-key" }) });
		const provider = models.getProvider("openrouter")!;
		const images = models.getModelsOfType("image", "openrouter");
		expect(images.length).toBeGreaterThan(0);
		expect(provider.getModels().every((model) => isModelType(model, "chat"))).toBe(true);
		expect(provider.getAllModels?.().some((model) => isModelType(model, "image"))).toBe(true);
		expect(images.every((m) => m.type === "image" && m.api === "openrouter-images")).toBe(true);
		expect(models.getModelsOfType("image").every((m) => m.provider === "openrouter")).toBe(true);

		// One upstream id can expose separate chat and image operations.
		const chat = models.getModel("openrouter", "google/gemini-3-pro-image");
		const image = models.getModelOfType("image", "openrouter", "google/gemini-3-pro-image");
		expect(chat?.api).toBe("openai-completions");
		expect(image?.api).toBe("openrouter-images");

		// One credential covers both.
		expect((await models.getAuth(images[0]))?.auth.apiKey).toBe("or-key");
		expect((await models.getAuth(chat!))?.auth.apiKey).toBe("or-key");
		expect(provider.generateImages).toBeDefined();
	});
});
