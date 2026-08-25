/**
 * 文件职责：验证 Models 运行时注册表的提供商装载、模型查询、认证优先级、动态刷新和请求分发。
 * 技术维度：使用 Vitest、内存提供商、OAuth/API Key 伪实现和事件流对模型运行时进行离线测试。
 * 产品维度：确保用户选择模型、配置凭据和发起请求时得到稳定、可预测的运行时行为。
 * 逻辑维度：通过模型与消息工厂构造夹具，依次测试注册、查询、刷新、认证并发和流式调用。
 * 关键边界：测试模型均为伪数据；认证缓存与刷新涉及异步时序，不能把断言外推为真实服务可用性。
 * 新手阅读建议：先看 testModel、testProvider 与认证辅助函数，再阅读基础注册用例，最后看 OAuth 和 stream。
 */
import { describe, expect, it } from "vitest";
import { InMemoryCredentialStore } from "../src/auth/credential-store.ts";
import type { ApiKeyAuth, CredentialStore, OAuthAuth, ProviderAuth } from "../src/auth/types.ts";
import { calculateCost, createModels, createProvider, hasApi, type Provider } from "../src/models.ts";
import { InMemoryModelsStore } from "../src/models-store.ts";
import type { Api, AssistantMessage, Context, Model, SimpleStreamOptions, StreamOptions, Usage } from "../src/types.ts";
import { AssistantMessageEventStream } from "../src/utils/event-stream.ts";

/** 执行并收集 testModel 对应步骤；参数 provider、id 按签名提供所需输入；返回值供调用方继续执行或断言。示例：testModel(..., ...)。 */
function testModel(provider: string, id: string): Model<Api> {
	return {
		id,
		name: id,
		api: "test-api",
		provider,
		baseUrl: "https://example.test/v1",
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 10000,
		maxTokens: 1000,
	};
}

/** 处理 doneMessage 对应步骤；参数 model、text 按签名提供所需输入；返回值供调用方继续执行或断言。示例：doneMessage(..., ...)。 */
function doneMessage(model: Model<Api>, text: string): AssistantMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		api: model.api,
		provider: model.provider,
		model: model.id,
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop",
		timestamp: Date.now(),
	};
}

/** ProviderCall 描述当前测试步骤返回的结构化数据及字段约束。 */
interface ProviderCall {
	model: Model<Api>;
	options: StreamOptions | undefined;
}

/** Ambient auth for keyless test providers; reports "configured" with no auth values. */
// 中文说明：上方英文注释描述“/** Ambient auth for keyless test providers; reports "c”相关前提、步骤或边界；下面代码按该说明执行。
const ambientAuth: ApiKeyAuth = {
	name: "Ambient",
	resolve: async () => ({ auth: {} }),
};

/** 执行并收集 testProvider 对应步骤；参数 input 按签名提供所需输入；返回值供调用方继续执行或断言。示例：testProvider(...)。 */
function testProvider(input: {
	id: string;
	models?: Model<Api>[];
	auth?: ProviderAuth;
	getModels?: () => readonly Model<Api>[];
	refreshModels?: Provider["refreshModels"];
	calls?: ProviderCall[];
}): Provider {
	/** 常量 models 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const models = input.models ?? [testModel(input.id, "model-a")];
	/** 处理 respond 对应步骤；参数 model、options 按签名提供所需输入；返回值供调用方继续执行或断言。示例：respond(..., ...)。 */
	const respond = (model: Model<Api>, options: StreamOptions | undefined) => {
		input.calls?.push({ model, options });
		/** 常量 stream 保存传递助手事件的异步流；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const stream = new AssistantMessageEventStream();
		/** 常量 message 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const message = doneMessage(model, "ok");
		stream.push({ type: "start", partial: message });
		stream.push({ type: "done", reason: "stop", message });
		stream.end(message);
		return stream;
	};
	return {
		id: input.id,
		name: input.id,
		auth: input.auth ?? { apiKey: ambientAuth },
		getModels: input.getModels ?? (() => models),
		refreshModels: input.refreshModels,
		stream: (model, _context, options) => respond(model, options as StreamOptions | undefined),
		streamSimple: (model, _context, options) => respond(model, options as SimpleStreamOptions | undefined),
	};
}

/** 常量 context 保存本次请求或会话的上下文；取值由声明类型和当前场景约束，注意隔离可变状态。 */
const context: Context = { messages: [{ role: "user", content: "hi", timestamp: Date.now() }] };

/** 处理 envKeyAuth 对应步骤；参数 key 按签名提供所需输入；返回值供调用方继续执行或断言。示例：envKeyAuth(...)。 */
function envKeyAuth(key: string | undefined): ApiKeyAuth {
	return {
		name: "Test API key",
		resolve: async ({ credential }) => {
			/** 常量 resolved 保存“resolved”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const resolved = credential?.key ?? key;
			if (!resolved) return undefined;
			return { auth: { apiKey: resolved }, source: credential ? "stored" : "env" };
		},
	};
}

/** 执行并收集 testOAuth 对应步骤；参数 overrides 按签名提供所需输入；返回值供调用方继续执行或断言。示例：testOAuth(...)。 */
function testOAuth(overrides?: Partial<OAuthAuth>): OAuthAuth {
	return {
		name: "Test OAuth",
		login: async () => {
			throw new Error("not used");
		},
		refresh: async (credential) => credential,
		toAuth: async (credential) => ({ apiKey: credential.access }),
		...overrides,
	};
}

// 用例分组：集中验证“Models runtime”相关功能。
describe("Models runtime", () => {
	// 测试场景：验证“enumerates credential metadata without exposing secrets”对应的行为、返回值与边界条件。
	it("enumerates credential metadata without exposing secrets", async () => {
		/** 常量 credentials 保存“credentials”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const credentials = new InMemoryCredentialStore();
		await credentials.modify("api-provider", async () => ({ type: "api_key", key: "secret" }));
		await credentials.modify("oauth-provider", async () => ({
			type: "oauth",
			access: "access",
			refresh: "refresh",
			expires: Date.now() + 60_000,
		}));

		expect(await credentials.list()).toEqual([
			{ providerId: "api-provider", type: "api_key" },
			{ providerId: "oauth-provider", type: "oauth" },
		]);
	});

	// 测试场景：验证“applies request-wide pricing tiers above the configured input threshold”对应的行为、返回值与边界条件。
	it("applies request-wide pricing tiers above the configured input threshold", () => {
		/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const model = testModel("openai", "gpt-5.6-sol");
		model.cost = {
			input: 5,
			output: 30,
			cacheRead: 0.5,
			cacheWrite: 6.25,
			tiers: [
				{
					inputTokensAbove: 272000,
					input: 10,
					output: 45,
					cacheRead: 1,
					cacheWrite: 12.5,
				},
			],
		};
		/** 常量 createUsage 保存令牌或用量数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const createUsage = (cacheWrite: number): Usage => ({
			input: 200000,
			output: 100000,
			cacheRead: 72000,
			cacheWrite,
			totalTokens: 372000 + cacheWrite,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		});

		/** 常量 short 保存“short”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const short = calculateCost(model, createUsage(0));
		expect(short).toMatchObject({ input: 1, output: 3, cacheRead: 0.036, cacheWrite: 0 });

		/** 常量 long 保存“long”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const long = calculateCost(model, createUsage(1));
		expect(long.input).toBe(2);
		expect(long.output).toBe(4.5);
		expect(long.cacheRead).toBe(0.072);
		expect(long.cacheWrite).toBe(0.0000125);
	});

	// 测试场景：验证“registers, replaces, and deletes providers”对应的行为、返回值与边界条件。
	it("registers, replaces, and deletes providers", () => {
		/** 常量 models 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const models = createModels();
		models.setProvider(testProvider({ id: "p1" }));
		models.setProvider(testProvider({ id: "p2" }));
		expect(models.getProviders().map((p) => p.id)).toEqual(["p1", "p2"]);

		/** 常量 replacement 保存“replacement”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const replacement = testProvider({ id: "p1" });
		models.setProvider(replacement);
		expect(models.getProvider("p1")).toBe(replacement);
		expect(models.getProviders()).toHaveLength(2);

		models.deleteProvider("p1");
		expect(models.getProvider("p1")).toBeUndefined();

		models.clearProviders();
		expect(models.getProviders()).toHaveLength(0);
	});

	// 测试场景：验证“lists and finds models per provider”对应的行为、返回值与边界条件。
	it("lists and finds models per provider", async () => {
		/** 常量 models 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const models = createModels();
		models.setProvider(testProvider({ id: "p1", models: [testModel("p1", "m1"), testModel("p1", "m2")] }));
		models.setProvider(testProvider({ id: "p2", models: [testModel("p2", "m3")] }));

		expect(models.getModels().map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
		expect(models.getModels("p1").map((m) => m.id)).toEqual(["m1", "m2"]);
		expect(models.getModels("nope").length).toBe(0);
		expect(models.getModel("p2", "m3")?.id).toBe("m3");
		expect(models.getModel("p2", "missing")).toBeUndefined();

		// hasApi() narrows dynamically looked-up models with a runtime check
		// 中文说明：上方英文注释描述“hasApi() narrows dynamically looked-up models with a ru”相关前提、步骤或边界；下面代码按该说明执行。
		const found = models.getModel("p2", "m3");
		expect(found && hasApi(found, "openai-completions")).toBe(false);
		expect(found && hasApi(found, "test-api")).toBe(true);
		if (found && hasApi(found, "test-api")) {
			/** 常量 _typed 保存“_typed”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const _typed: Model<"test-api"> = found;
			expect(_typed.id).toBe("m3");
		}
	});

	// 测试场景：验证“swallows provider source failures for both all-provider and single-provider listing”对应的行为、返回值与边界条件。
	it("swallows provider source failures for both all-provider and single-provider listing", () => {
		/** 常量 models 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const models = createModels();
		models.setProvider(
			testProvider({
				id: "broken",
				getModels: () => {
					throw new Error("boom");
				},
			}),
		);
		models.setProvider(testProvider({ id: "ok", models: [testModel("ok", "m1")] }));

		expect(models.getModels().map((m) => m.id)).toEqual(["m1"]);
		expect(models.getModels("broken")).toEqual([]);
		// precise failures come from the provider directly
		// 中文说明：上方英文注释描述“precise failures come from the provider directly”相关前提、步骤或边界；下面代码按该说明执行。
		expect(() => models.getProvider("broken")?.getModels()).toThrow("boom");
	});

	// 测试场景：验证“refresh() updates every configured dynamic provider and reports failures”对应的行为、返回值与边界条件。
	it("refresh() updates every configured dynamic provider and reports failures", async () => {
		/** 变量 list 保存“list”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		let list = [testModel("dyn", "before")];
		/** 变量 refreshes 保存“refreshes”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		let refreshes = 0;
		/** 常量 models 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const models = createModels();
		models.setProvider(
			testProvider({
				id: "dyn",
				getModels: () => list,
				refreshModels: async () => {
					refreshes++;
					list = [testModel("dyn", "after")];
				},
			}),
		);
		models.setProvider(testProvider({ id: "static", models: [testModel("static", "s1")] }));

		expect(models.getModel("dyn", "before")).toBeDefined();
		/** 常量 first 保存“first”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const first = await models.refresh();
		expect(first.errors.size).toBe(0);
		expect(refreshes).toBe(1);
		expect(models.getModel("dyn", "after")).toBeDefined();
		expect(models.getModel("dyn", "before")).toBeUndefined();

		models.setProvider(
			testProvider({
				id: "flaky",
				refreshModels: async () => {
					throw new Error("fetch failed");
				},
			}),
		);
		/** 常量 second 保存“second”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const second = await models.refresh();
		expect(refreshes).toBe(2);
		expect(second.errors.get("flaky")?.message).toBe("fetch failed");
	});

	// 测试场景：验证“persists dynamic catalogs and restores them without network access”对应的行为、返回值与边界条件。
	it("persists dynamic catalogs and restores them without network access", async () => {
		/** 常量 credentials 保存“credentials”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const credentials = new InMemoryCredentialStore();
		/** 常量 modelsStore 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const modelsStore = new InMemoryModelsStore();
		await credentials.modify("dynamic", async () => ({ type: "api_key", key: "key" }));
		/** 创建 createDynamicProvider 对应步骤；参数 fetchModels 按签名提供所需输入；返回值供调用方继续执行或断言。示例：createDynamicProvider(...)。 */
		const createDynamicProvider = (fetchModels: (() => Promise<readonly Model<Api>[]>) | undefined) =>
			createProvider({
				id: "dynamic",
				auth: { apiKey: envKeyAuth(undefined) },
				models: [],
				fetchModels: fetchModels ? () => fetchModels() : undefined,
				api: {
					stream: () => new AssistantMessageEventStream(),
					streamSimple: () => new AssistantMessageEventStream(),
				},
			});

		/** 常量 online 保存“online”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const online = createModels({ credentials, modelsStore });
		online.setProvider(createDynamicProvider(async () => [testModel("dynamic", "fetched")]));
		expect((await online.refresh()).errors.size).toBe(0);
		expect(online.getModel("dynamic", "fetched")).toBeDefined();

		/** 常量 offline 保存“offline”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const offline = createModels({ credentials, modelsStore });
		offline.setProvider(
			createDynamicProvider(async () => {
				throw new Error("must not fetch");
			}),
		);
		expect((await offline.refresh({ allowNetwork: false })).errors.size).toBe(0);
		expect(offline.getModel("dynamic", "fetched")).toBeDefined();
	});

	// 测试场景：验证“passes effective API-key credentials and refresh options while skipping unconfigured providers”对应的行为、返回值与边界条件。
	it("passes effective API-key credentials and refresh options while skipping unconfigured providers", async () => {
		/** 变量 effectiveCredential 保存“effectiveCredential”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		let effectiveCredential: unknown;
		/** 变量 forceRefresh 保存“forceRefresh”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		let forceRefresh: boolean | undefined;
		/** 变量 unconfiguredRefreshes 保存“unconfiguredRefreshes”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		let unconfiguredRefreshes = 0;
		/** 常量 models 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const models = createModels();
		models.setProvider(
			testProvider({
				id: "configured",
				auth: { apiKey: envKeyAuth("ambient-key") },
				refreshModels: async (context) => {
					effectiveCredential = context.credential;
					forceRefresh = context.force;
				},
			}),
		);
		models.setProvider(
			testProvider({
				id: "unconfigured",
				auth: { apiKey: envKeyAuth(undefined) },
				refreshModels: async () => {
					unconfiguredRefreshes++;
				},
			}),
		);

		await models.refresh({ force: true });
		expect(effectiveCredential).toEqual({ type: "api_key", key: "ambient-key", env: undefined });
		expect(forceRefresh).toBe(true);
		expect(unconfiguredRefreshes).toBe(0);
	});

	// 测试场景：验证“refreshes expired OAuth before refreshing models”对应的行为、返回值与边界条件。
	it("refreshes expired OAuth before refreshing models", async () => {
		/** 常量 credentials 保存“credentials”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const credentials = new InMemoryCredentialStore();
		/** 变量 modelRefreshCredential 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		let modelRefreshCredential: unknown;
		await credentials.modify("oauth-dynamic", async () => ({
			type: "oauth",
			access: "expired",
			refresh: "refresh",
			expires: 0,
		}));
		/** 常量 models 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const models = createModels({ credentials });
		models.setProvider(
			testProvider({
				id: "oauth-dynamic",
				auth: {
					oauth: testOAuth({
						refresh: async () => ({
							type: "oauth",
							access: "fresh",
							refresh: "rotated",
							expires: Date.now() + 60_000,
						}),
					}),
				},
				refreshModels: async (context) => {
					modelRefreshCredential = context.credential;
				},
			}),
		);

		expect((await models.refresh()).errors.size).toBe(0);
		expect(modelRefreshCredential).toMatchObject({ type: "oauth", access: "fresh", refresh: "rotated" });
		expect(await credentials.read("oauth-dynamic")).toMatchObject({ access: "fresh", refresh: "rotated" });
	});

	// 测试场景：验证“returns aborted state without reporting cancellation as a provider error”对应的行为、返回值与边界条件。
	it("returns aborted state without reporting cancellation as a provider error", async () => {
		/** 常量 controller 保存“controller”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const controller = new AbortController();
		/** 常量 models 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const models = createModels();
		models.setProvider(
			testProvider({
				id: "dynamic",
				refreshModels: async ({ signal }) => {
					controller.abort();
					if (signal?.aborted) return;
				},
			}),
		);

		/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const result = await models.refresh({ signal: controller.signal });
		expect(result.aborted).toBe(true);
		expect(result.errors.size).toBe(0);
	});

	// 测试场景：验证“resolves auth: stored credential owns the provider, ambient only when nothing stored”对应的行为、返回值与边界条件。
	it("resolves auth: stored credential owns the provider, ambient only when nothing stored", async () => {
		/** 常量 credentials 保存“credentials”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const credentials = new InMemoryCredentialStore();
		/** 常量 models 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const models = createModels({ credentials });
		models.setProvider(testProvider({ id: "p1", auth: { apiKey: envKeyAuth("env-key"), oauth: testOAuth() } }));
		/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const model = testModel("p1", "model-a");

		// model and provider-id overloads resolve the same provider-scoped auth
		// 中文说明：上方英文注释描述“model and provider-id overloads resolve the same provid”相关前提、步骤或边界；下面代码按该说明执行。
		expect((await models.getAuth(model))?.auth.apiKey).toBe("env-key");
		expect((await models.getAuth(model.provider))?.auth.apiKey).toBe("env-key");
		expect((await models.getAuth(model, { apiKey: "explicit-key" }))?.auth.apiKey).toBe("explicit-key");

		// stored oauth credential (persisted via the single write path): beats ambient env
		// 中文说明：上方英文注释描述“stored oauth credential (persisted via the single write”相关前提、步骤或边界；下面代码按该说明执行。
		await credentials.modify("p1", async () => ({
			type: "oauth",
			access: "oauth-token",
			refresh: "r",
			expires: Date.now() + 100000,
		}));
		/** 常量 resolution 保存“resolution”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const resolution = await models.getAuth(model.provider);
		expect(resolution?.auth.apiKey).toBe("oauth-token");
		expect(resolution?.source).toBe("OAuth");

		// stored api-key credential resolves through apiKey auth, beats env
		// 中文说明：上方英文注释描述“stored api-key credential resolves through apiKey auth,”相关前提、步骤或边界；下面代码按该说明执行。
		await credentials.modify("p1", async () => ({ type: "api_key", key: "stored-key" }));
		/** 常量 apiKeyResolution 保存认证或环境配置数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const apiKeyResolution = await models.getAuth(model.provider);
		expect(apiKeyResolution?.auth.apiKey).toBe("stored-key");
		expect(apiKeyResolution?.source).toBe("stored");
	});

	// 测试场景：验证“checks provider auth without refreshing OAuth and filters available models”对应的行为、返回值与边界条件。
	it("checks provider auth without refreshing OAuth and filters available models", async () => {
		/** 常量 credentials 保存“credentials”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const credentials = new InMemoryCredentialStore();
		/** 变量 refreshes 保存“refreshes”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		let refreshes = 0;
		/** 常量 models 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const models = createModels({ credentials });
		models.setProvider(testProvider({ id: "ambient", auth: { apiKey: envKeyAuth("env-key") } }));
		models.setProvider(testProvider({ id: "missing", auth: { apiKey: envKeyAuth(undefined) } }));
		models.setProvider(
			testProvider({
				id: "oauth",
				auth: {
					oauth: testOAuth({
						refresh: async (credential) => {
							refreshes++;
							return credential;
						},
					}),
				},
			}),
		);
		await credentials.modify("oauth", async () => ({
			type: "oauth",
			access: "expired",
			refresh: "refresh",
			expires: 0,
		}));

		expect(await models.checkAuth("ambient")).toEqual({ source: "env", type: "api_key" });
		expect(await models.checkAuth("missing")).toBeUndefined();
		expect(await models.checkAuth("oauth")).toEqual({ source: "OAuth", type: "oauth" });
		expect(refreshes).toBe(0);
		expect((await models.getAvailable()).map((model) => model.provider)).toEqual(["ambient", "oauth"]);
		expect((await models.getAvailable("ambient")).map((model) => model.provider)).toEqual(["ambient"]);
	});

	// 测试场景：验证“runs provider login and logout through the credential store”对应的行为、返回值与边界条件。
	it("runs provider login and logout through the credential store", async () => {
		/** 常量 credentials 保存“credentials”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const credentials = new InMemoryCredentialStore();
		/** 常量 apiKey 保存认证或环境配置数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const apiKey = envKeyAuth(undefined);
		apiKey.login = async () => ({ type: "api_key", key: "logged-in" });
		/** 常量 models 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const models = createModels({ credentials });
		models.setProvider(testProvider({ id: "p1", auth: { apiKey } }));

		/** 常量 credential 保存“credential”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const credential = await models.login("p1", "api_key", {
			prompt: async () => "unused",
			notify: () => {},
		});
		expect(credential).toEqual({ type: "api_key", key: "logged-in" });
		expect(await credentials.read("p1")).toEqual(credential);

		await models.logout("p1");
		expect(await credentials.read("p1")).toBeUndefined();
	});

	// 测试场景：验证“a stored credential without a matching handler blocks ambient fallback”对应的行为、返回值与边界条件。
	it("a stored credential without a matching handler blocks ambient fallback", async () => {
		/** 常量 credentials 保存“credentials”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const credentials = new InMemoryCredentialStore();
		/** 常量 models 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const models = createModels({ credentials });
		// provider has only apiKey auth, but an oauth credential is stored (stale config)
		// 中文说明：上方英文注释描述“provider has only apiKey auth, but an oauth credential ”相关前提、步骤或边界；下面代码按该说明执行。
		models.setProvider(testProvider({ id: "p1", auth: { apiKey: envKeyAuth("env-key") } }));
		await credentials.modify("p1", async () => ({ type: "oauth", access: "a", refresh: "r", expires: 0 }));

		expect(await models.getAuth("p1")).toBeUndefined();
	});

	// 测试场景：验证“refreshes expired oauth credentials and persists the rotated credential”对应的行为、返回值与边界条件。
	it("refreshes expired oauth credentials and persists the rotated credential", async () => {
		/** 常量 credentials 保存“credentials”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const credentials = new InMemoryCredentialStore();
		/** 常量 oauth 保存认证或环境配置数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const oauth = testOAuth({
			refresh: async (credential) => ({ ...credential, access: "new-token", expires: Date.now() + 60_000 }),
		});
		/** 常量 models 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const models = createModels({ credentials });
		models.setProvider(testProvider({ id: "p1", auth: { oauth } }));
		await credentials.modify("p1", async () => ({
			type: "oauth",
			access: "old-token",
			refresh: "r",
			expires: 0,
		}));

		/** 常量 resolution 保存“resolution”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const resolution = await models.getAuth("p1");
		expect(resolution?.auth.apiKey).toBe("new-token");
		expect(((await credentials.read("p1")) as { access: string }).access).toBe("new-token");
	});

	// 测试场景：验证“rejects with code oauth when refresh fails, preserving the stored credential”对应的行为、返回值与边界条件。
	it("rejects with code oauth when refresh fails, preserving the stored credential", async () => {
		/** 常量 credentials 保存“credentials”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const credentials = new InMemoryCredentialStore();
		/** 常量 oauth 保存认证或环境配置数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const oauth = testOAuth({
			refresh: async () => {
				throw new Error("invalid_grant");
			},
		});
		/** 常量 models 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const models = createModels({ credentials });
		models.setProvider(testProvider({ id: "p1", auth: { oauth } }));
		await credentials.modify("p1", async () => ({ type: "oauth", access: "old", refresh: "r", expires: 0 }));

		await expect(models.getAuth("p1")).rejects.toMatchObject({ code: "oauth" });
		// credential preserved for retry / re-login
		// 中文说明：上方英文注释描述“credential preserved for retry / re-login”相关前提、步骤或边界；下面代码按该说明执行。
		expect(((await credentials.read("p1")) as { access: string }).access).toBe("old");
	});

	// 测试场景：验证“serializes concurrent OAuth refreshes through store.modify (no double refresh)”对应的行为、返回值与边界条件。
	it("serializes concurrent OAuth refreshes through store.modify (no double refresh)", async () => {
		/** 常量 credentials 保存“credentials”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const credentials = new InMemoryCredentialStore();
		await credentials.modify("p1", async () => ({ type: "oauth", access: "old", refresh: "r1", expires: 0 }));

		/** 变量 refreshes 保存“refreshes”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		let refreshes = 0;
		/** 常量 oauth 保存认证或环境配置数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const oauth = testOAuth({
			refresh: async () => {
				refreshes++;
				await new Promise((resolve) => setTimeout(resolve, 10));
				return { type: "oauth", access: `new-${refreshes}`, refresh: "r2", expires: Date.now() + 60_000 };
			},
		});
		/** 常量 models 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const models = createModels({ credentials });
		models.setProvider(testProvider({ id: "p1", auth: { oauth } }));
		/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const model = testModel("p1", "model-a");

		/** 常量 [a, b] 保存“[a, b]”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const [a, b] = await Promise.all([models.getAuth(model.provider), models.getAuth(model.provider)]);
		expect(refreshes).toBe(1);
		expect(a?.auth.apiKey).toBe("new-1");
		expect(b?.auth.apiKey).toBe("new-1");
	});

	// 测试场景：验证“valid oauth tokens resolve without touching modify”对应的行为、返回值与边界条件。
	it("valid oauth tokens resolve without touching modify", async () => {
		/** 变量 modifies 保存“modifies”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		let modifies = 0;
		/** 常量 base 保存“base”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const base = new InMemoryCredentialStore();
		/** 常量 credentials 保存“credentials”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const credentials: CredentialStore = {
			read: (pid) => base.read(pid),
			list: () => base.list(),
			modify: (pid, fn) => {
				modifies++;
				return base.modify(pid, fn);
			},
			delete: (pid) => base.delete(pid),
		};
		await base.modify("p1", async () => ({
			type: "oauth",
			access: "valid",
			refresh: "r",
			expires: Date.now() + 60_000,
		}));
		/** 常量 models 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const models = createModels({ credentials });
		models.setProvider(testProvider({ id: "p1", auth: { oauth: testOAuth() } }));

		expect((await models.getAuth("p1"))?.auth.apiKey).toBe("valid");
		expect(modifies).toBe(0);
	});

	// 测试场景：验证“wraps credential store failures in ModelsError”对应的行为、返回值与边界条件。
	it("wraps credential store failures in ModelsError", async () => {
		// read failure
		// 中文说明：上方英文注释描述“read failure”相关前提、步骤或边界；下面代码按该说明执行。
		const readFailing: CredentialStore = {
			read: async () => {
				throw new Error("disk on fire");
			},
			list: async () => [],
			modify: async () => undefined,
			delete: async () => {},
		};
		/** 常量 models 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const models = createModels({ credentials: readFailing });
		models.setProvider(testProvider({ id: "p1", auth: { apiKey: envKeyAuth("env-key") } }));
		await expect(models.getAuth("p1")).rejects.toMatchObject({ code: "auth" });

		// modify failure during refresh
		// 中文说明：上方英文注释描述“modify failure during refresh”相关前提、步骤或边界；下面代码按该说明执行。
		const modifyFailing: CredentialStore = {
			read: async () => ({ type: "oauth", access: "old", refresh: "r", expires: 0 }),
			list: async () => [{ providerId: "p1", type: "oauth" }],
			modify: async () => {
				throw new Error("disk on fire");
			},
			delete: async () => {},
		};
		/** 常量 oauthModels 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const oauthModels = createModels({ credentials: modifyFailing });
		oauthModels.setProvider(testProvider({ id: "p1", auth: { oauth: testOAuth() } }));
		await expect(oauthModels.getAuth("p1")).rejects.toMatchObject({ code: "auth" });
	});

	// 测试场景：验证“wraps api-key auth failures in ModelsError”对应的行为、返回值与边界条件。
	it("wraps api-key auth failures in ModelsError", async () => {
		/** 常量 failing 保存“failing”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const failing: ApiKeyAuth = {
			name: "Failing",
			resolve: async () => {
				throw new Error("nope");
			},
		};
		/** 常量 models 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const models = createModels();
		models.setProvider(testProvider({ id: "p1", auth: { apiKey: failing } }));
		await expect(models.getAuth("p1")).rejects.toMatchObject({ code: "auth" });
	});

	// 测试场景：验证“uses explicit request api key and env during provider auth resolution”对应的行为、返回值与边界条件。
	it("uses explicit request api key and env during provider auth resolution", async () => {
		/** 常量 calls 保存核对调用或事件顺序的记录；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const calls: ProviderCall[] = [];
		/** 常量 apiKey 保存认证或环境配置数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const apiKey: ApiKeyAuth = {
			name: "Scoped",
			resolve: async ({ credential, ctx }) => {
				/** 常量 account 保存“account”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
				const account = credential?.env?.ACCOUNT_ID ?? (await ctx.env("ACCOUNT_ID"));
				if (!credential?.key || !account) return undefined;
				return {
					auth: { apiKey: credential.key, baseUrl: `https://example.test/${account}` },
					env: { ACCOUNT_ID: account },
				};
			},
		};
		/** 常量 models 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const models = createModels();
		models.setProvider(testProvider({ id: "p1", auth: { apiKey }, calls }));
		/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const model = testModel("p1", "model-a");

		await models.completeSimple(model, context, { apiKey: "explicit-key", env: { ACCOUNT_ID: "acct" } });

		expect(calls[0].model.baseUrl).toBe("https://example.test/acct");
		expect(calls[0].options?.apiKey).toBe("explicit-key");
		expect(calls[0].options?.env).toEqual({ ACCOUNT_ID: "acct" });
	});

	// 测试场景：验证“merges resolved auth into stream options; explicit options win per field”对应的行为、返回值与边界条件。
	it("merges resolved auth into stream options; explicit options win per field", async () => {
		/** 常量 calls 保存核对调用或事件顺序的记录；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const calls: ProviderCall[] = [];
		/** 常量 apiKey 保存认证或环境配置数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const apiKey: ApiKeyAuth = {
			name: "Test",
			resolve: async () => ({
				auth: {
					apiKey: "resolved-key",
					headers: { Authorization: "Bearer resolved-key", "x-a": "auth", "x-b": "auth" },
					baseUrl: "https://auth.test/v1",
				},
			}),
		};
		/** 常量 models 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const models = createModels();
		models.setProvider(testProvider({ id: "p1", auth: { apiKey }, calls }));
		/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const model = testModel("p1", "model-a");

		/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const result = await models.completeSimple(model, context, {
			apiKey: "explicit-key",
			headers: { authorization: "Explicit token", "x-b": "explicit" },
		});
		expect(result.stopReason).toBe("stop");
		expect(calls).toHaveLength(1);
		expect(calls[0].options?.apiKey).toBe("explicit-key");
		expect(calls[0].options?.headers).toEqual({ authorization: "Explicit token", "x-a": "auth", "x-b": "explicit" });
		expect(calls[0].model.baseUrl).toBe("https://auth.test/v1");

		// without explicit options, resolved auth applies
		// 中文说明：上方英文注释描述“without explicit options, resolved auth applies”相关前提、步骤或边界；下面代码按该说明执行。
		const result2 = await models.completeSimple(model, context);
		expect(result2.stopReason).toBe("stop");
		expect(calls[1].options?.apiKey).toBe("resolved-key");
	});

	// 测试场景：验证“adds model headers only for model auth and transforms assembled headers once”对应的行为、返回值与边界条件。
	it("adds model headers only for model auth and transforms assembled headers once", async () => {
		/** 常量 calls 保存核对调用或事件顺序的记录；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const calls: ProviderCall[] = [];
		/** 常量 models 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const models = createModels();
		models.setProvider(testProvider({ id: "p1", auth: { apiKey: envKeyAuth("key") }, calls }));
		/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const model = testModel("p1", "model-a");
		model.headers = { "x-model": "model", "x-shared": "model" };

		expect((await models.getAuth("p1"))?.auth.headers).toBeUndefined();
		expect((await models.getAuth(model))?.auth.headers).toEqual({ "x-model": "model", "x-shared": "model" });

		/** 变量 transforms 保存“transforms”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		let transforms = 0;
		await models.completeSimple(model, context, {
			headers: { "x-explicit": "explicit", "X-Shared": "explicit" },
			transformHeaders: async (headers) => {
				transforms++;
				expect(headers).toEqual({ "x-model": "model", "x-explicit": "explicit", "X-Shared": "explicit" });
				return { ...headers, "x-transformed": "yes" };
			},
		});

		expect(transforms).toBe(1);
		expect(calls[0].options?.headers).toEqual({
			"x-model": "model",
			"x-explicit": "explicit",
			"X-Shared": "explicit",
			"x-transformed": "yes",
		});
		expect(calls[0].options).not.toHaveProperty("transformHeaders");
	});

	// 测试场景：验证“produces an error stream for unknown providers instead of throwing”对应的行为、返回值与边界条件。
	it("produces an error stream for unknown providers instead of throwing", async () => {
		/** 常量 models 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const models = createModels();
		/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const result = await models.completeSimple(testModel("ghost", "model-a"), context);
		expect(result.stopReason).toBe("error");
		expect(result.errorMessage).toContain("Unknown provider: ghost");
	});

	// 测试场景：验证“streams through the provider”对应的行为、返回值与边界条件。
	it("streams through the provider", async () => {
		/** 常量 models 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const models = createModels();
		models.setProvider(testProvider({ id: "p1" }));
		/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const model = testModel("p1", "model-a");

		/** 常量 events 保存核对调用或事件顺序的记录；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const events: string[] = [];
		/** 常量 stream 保存传递助手事件的异步流；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const stream = models.streamSimple(model, context);
		// event 是当前标准化助手流事件，循环按顺序记录其类型。
		for await (const event of stream) {
			events.push(event.type);
		}
		expect(events).toEqual(["start", "done"]);
		/** 常量 message 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const message = await stream.result();
		expect(message.stopReason).toBe("stop");
	});
});
