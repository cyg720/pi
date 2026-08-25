/**
 * 文件职责：验证内置与自定义模型提供商的注册、认证解析、模型元数据、动态刷新和流式分发。
 * 技术维度：使用 Vitest、内存模型存储、伪认证上下文和 AssistantMessageEventStream 构造离线集成测试。
 * 产品维度：确保用户能看到正确模型、按优先级取得凭据，并把请求交给模型声明的 API 实现。
 * 逻辑维度：依次覆盖内置提供商、通用环境变量认证、createProvider 编排以及 faux provider 响应。
 * 关键边界：内置模型数量断言依赖生成清单；动态刷新仅模拟内存与短延迟，不访问真实服务。
 * 新手阅读建议：先看 builtin providers 和 envApiKeyAuth，再读 createProvider 的 API 分发，最后看动态刷新。
 */
import { describe, expect, it } from "vitest";
import { envApiKeyAuth } from "../src/auth/helpers.ts";
import type { AuthContext, AuthEvent } from "../src/auth/types.ts";
import { createModels, createProvider } from "../src/models.ts";
import { InMemoryModelsStore, type ModelsStoreEntry } from "../src/models-store.ts";
import { builtinModels, builtinProviders, getBuiltinModel } from "../src/providers/all.ts";
import { amazonBedrockProvider } from "../src/providers/amazon-bedrock.ts";
import { anthropicProvider } from "../src/providers/anthropic.ts";
import { cloudflareAIGatewayProvider } from "../src/providers/cloudflare-ai-gateway.ts";
import { cloudflareWorkersAIProvider } from "../src/providers/cloudflare-workers-ai.ts";
import { fauxAssistantMessage, fauxProvider } from "../src/providers/faux.ts";
import { googleVertexProvider } from "../src/providers/google-vertex.ts";
import type { Api, Context, Model, ProviderStreams } from "../src/types.ts";
import { AssistantMessageEventStream } from "../src/utils/event-stream.ts";

/** 构造只读取给定环境变量和文件集合的认证上下文。参数 env 为键值、files 为存在路径；返回 AuthContext。例如：fakeAuthContext({ API_KEY: "key" })。 */
function fakeAuthContext(env: Record<string, string>, files: string[] = []): AuthContext {
	return {
		env: async (name) => env[name],
		fileExists: async (path) => files.includes(path),
	};
}

/** 供流式完成测试复用的最小用户消息上下文。 */
const context: Context = { messages: [{ role: "user", content: "hi", timestamp: Date.now() }] };

describe("builtin providers", () => {
	// 测试场景：验证“builtinModels registers every builtin provider with models”对应的提供商行为。
	it("builtinModels registers every builtin provider with models", async () => {
		/** 当前用例创建或取得的模型集合，用于注册提供商并查询模型或认证。 */
		const models = builtinModels();
		/** 模型集合中已注册的全部提供商定义。 */
		const providers = models.getProviders();
		expect(providers.length).toBe(builtinProviders().length);
		expect(providers.map((p) => p.id)).toContain("anthropic");

		/** 从内置集合查询到的 Anthropic Haiku 模型。 */
		const anthropic = models.getModel("anthropic", "claude-haiku-4-5");
		expect(anthropic?.api).toBe("anthropic-messages");

		/** 内置模型集合中的全部模型。 */
		const all = models.getModels();
		expect(all.length).toBeGreaterThan(500);

		// Static providers list models immediately; Radius is purely dynamic.
		// 静态提供商会立即列出模型；Radius 完全依靠动态刷新。
		for (const provider of providers) {
			/** 当前提供商名下可立即列出的模型列表。 */
			const list = models.getModels(provider.id);
			if (provider.id === "radius") expect(list).toEqual([]);
			else expect(list.length).toBeGreaterThan(0);
			expect(list.every((m) => m.provider === provider.id)).toBe(true);
		}
	});

	// 测试场景：验证“stores native constrained-sampling capabilities in model metadata”对应的提供商行为。
	it("stores native constrained-sampling capabilities in model metadata", () => {
		/** 用于检查约束采样能力元数据的 GPT-4o 模型。 */
		const gpt4o = getBuiltinModel("openai", "gpt-4o");
		expect(gpt4o.compat?.supportsStrictMode).toBe(true);
		expect(gpt4o.compat?.supportsOpenAIGrammarTools).toBeUndefined();
		expect(getBuiltinModel("openai", "gpt-5.4").compat).toMatchObject({
			supportsStrictMode: true,
			supportsOpenAIGrammarTools: true,
		});
		expect(getBuiltinModel("anthropic", "claude-haiku-4-5").compat?.supportsStrictTools).toBe(true);
	});

	// 测试场景：验证“uses official Kimi K3 pricing for Moonshot providers”对应的提供商行为。
	it("uses official Kimi K3 pricing for Moonshot providers", () => {
		/** 当前用例创建或取得的模型集合，用于注册提供商并查询模型或认证。 */
		const models = builtinModels();
		// provider 是当前国际或中国区 Moonshot 提供商标识。
		for (const provider of ["moonshotai", "moonshotai-cn"]) {
			expect(models.getModel(provider, "kimi-k3")?.cost).toEqual({
				input: 3,
				output: 15,
				cacheRead: 0.3,
				cacheWrite: 0,
			});
		}
	});

	// 测试场景：验证“uses API-equivalent implied pricing for Kimi Coding subscription models”对应的提供商行为。
	it("uses API-equivalent implied pricing for Kimi Coding subscription models", () => {
		/** 当前用例创建或取得的模型集合，用于注册提供商并查询模型或认证。 */
		const models = builtinModels();
		/** Kimi Coding 各订阅模型应采用的 API 等价价格映射。 */
		const expectedCosts = {
			k3: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 0 },
			"kimi-for-coding-highspeed": { input: 1.9, output: 8, cacheRead: 0.38, cacheWrite: 0 },
		};

		// modelId 和 cost 是当前 Kimi Coding 模型标识及预期费用。
		for (const [modelId, cost] of Object.entries(expectedCosts)) {
			expect(models.getModel("kimi-coding", modelId)?.cost).toEqual(cost);
		}
	});

	// 测试场景：验证“resolves Anthropic bearer auth from env with auth token precedence”对应的提供商行为。
	it("resolves Anthropic bearer auth from env with auth token precedence", async () => {
		/** 当前用例创建或取得的模型集合，用于注册提供商并查询模型或认证。 */
		const models = createModels({
			authContext: fakeAuthContext({
				ANTHROPIC_AUTH_TOKEN: "auth-token",
				ANTHROPIC_OAUTH_TOKEN: "oauth-token",
				ANTHROPIC_API_KEY: "api-key",
			}),
		});
		models.setProvider(anthropicProvider());

		expect(await models.getAuth("anthropic")).toEqual({
			auth: { headers: { Authorization: "Bearer auth-token" } },
			source: "ANTHROPIC_AUTH_TOKEN",
		});
	});

	// 测试场景：验证“preserves Anthropic OAuth token precedence over the API key”对应的提供商行为。
	it("preserves Anthropic OAuth token precedence over the API key", async () => {
		/** 当前用例创建或取得的模型集合，用于注册提供商并查询模型或认证。 */
		const models = createModels({
			authContext: fakeAuthContext({ ANTHROPIC_API_KEY: "key", ANTHROPIC_OAUTH_TOKEN: "oauth-token" }),
		});
		models.setProvider(anthropicProvider());

		/** 当前认证、流式调用或错误流程返回的结果。 */
		const result = await models.getAuth("anthropic");
		expect(result?.auth.apiKey).toBe("oauth-token");
		expect(result?.source).toBe("ANTHROPIC_OAUTH_TOKEN");
	});

	// 测试场景：验证“runs provider-owned Bedrock bearer token and AWS profile login flows”对应的提供商行为。
	it("runs provider-owned Bedrock bearer token and AWS profile login flows", async () => {
		/** 当前提供商拥有的 API Key 认证策略。 */
		const auth = amazonBedrockProvider().auth.apiKey!;
		/** 模拟 Bedrock bearer token 登录提示的依次回答。 */
		const bearerAnswers = ["bearer-token", "bedrock-token"];
		expect(
			await auth.login?.({
				prompt: async () => bearerAnswers.shift()!,
				notify: () => {},
			}),
		).toEqual({ type: "api_key", key: "bedrock-token" });

		/** 模拟 Bedrock AWS profile 登录提示的依次回答。 */
		const profileAnswers = ["aws-profile", "work"];
		/** 认证登录过程中通知给调用方的事件列表。 */
		const events: AuthEvent[] = [];
		expect(
			await auth.login?.({
				prompt: async () => profileAnswers.shift()!,
				notify: (event) => events.push(event),
			}),
		).toEqual({ type: "api_key", env: { AWS_PROFILE: "work" } });
		expect(events).toEqual([
			expect.objectContaining({
				type: "info",
				links: [expect.objectContaining({ label: "AWS credential provider chain" })],
			}),
		]);
		expect(
			await auth.resolve({
				ctx: fakeAuthContext({}),
				credential: { type: "api_key", env: { AWS_PROFILE: "work" } },
			}),
		).toMatchObject({ auth: {}, env: { AWS_PROFILE: "work" } });
	});

	// 测试场景：验证“reports bedrock as configured from ambient AWS credentials without an api key”对应的提供商行为。
	it("reports bedrock as configured from ambient AWS credentials without an api key", async () => {
		/** 当前用例创建或取得的模型集合，用于注册提供商并查询模型或认证。 */
		const models = createModels({ authContext: fakeAuthContext({ AWS_PROFILE: "dev" }) });
		models.setProvider(amazonBedrockProvider());
		/** 当前用例从提供商取得或构造的目标模型。 */
		const model = models.getModels("amazon-bedrock")[0];

		/** 当前认证、流式调用或错误流程返回的结果。 */
		const result = await models.getAuth(model.provider);
		expect(result?.auth).toEqual({});
		expect(result?.source).toBe("AWS_PROFILE");

		/** 未提供任何环境凭据的模型集合，用于验证未配置状态。 */
		const unconfigured = createModels({ authContext: fakeAuthContext({}) });
		unconfigured.setProvider(amazonBedrockProvider());
		expect(await unconfigured.getAuth(model.provider)).toBeUndefined();
	});

	// 测试场景：验证“requires Cloudflare Workers AI account config and returns scoped env”对应的提供商行为。
	it("requires Cloudflare Workers AI account config and returns scoped env", async () => {
		/** 只含 Cloudflare API Key、缺少账户编号的模型集合。 */
		const missingAccount = createModels({ authContext: fakeAuthContext({ CLOUDFLARE_API_KEY: "cf-key" }) });
		missingAccount.setProvider(cloudflareWorkersAIProvider());
		/** 当前用例从提供商取得或构造的目标模型。 */
		const model = missingAccount.getModels("cloudflare-workers-ai")[0];
		expect(await missingAccount.getAuth(model.provider)).toBeUndefined();

		/** 提供完整环境配置的模型集合。 */
		const configured = createModels({
			authContext: fakeAuthContext({ CLOUDFLARE_API_KEY: "cf-key", CLOUDFLARE_ACCOUNT_ID: "account-id" }),
		});
		configured.setProvider(cloudflareWorkersAIProvider());
		/** 当前认证、流式调用或错误流程返回的结果。 */
		const result = await configured.getAuth(model.provider);
		expect(result?.auth).toEqual({ apiKey: "cf-key" });
		expect(result?.env).toEqual({ CLOUDFLARE_ACCOUNT_ID: "account-id" });
	});

	// 测试场景：验证“requires Cloudflare AI Gateway account and gateway config and returns scoped env headers”对应的提供商行为。
	it("requires Cloudflare AI Gateway account and gateway config and returns scoped env headers", async () => {
		/** 缺少 Cloudflare Gateway 编号的模型集合。 */
		const missingGateway = createModels({
			authContext: fakeAuthContext({ CLOUDFLARE_API_KEY: "cf-key", CLOUDFLARE_ACCOUNT_ID: "account-id" }),
		});
		missingGateway.setProvider(cloudflareAIGatewayProvider());
		/** 当前用例从提供商取得或构造的目标模型。 */
		const model = missingGateway.getModels("cloudflare-ai-gateway")[0];
		expect(await missingGateway.getAuth(model.provider)).toBeUndefined();

		/** 提供完整环境配置的模型集合。 */
		const configured = createModels({
			authContext: fakeAuthContext({
				CLOUDFLARE_API_KEY: "cf-key",
				CLOUDFLARE_ACCOUNT_ID: "account-id",
				CLOUDFLARE_GATEWAY_ID: "gateway-id",
			}),
		});
		configured.setProvider(cloudflareAIGatewayProvider());
		/** 当前认证、流式调用或错误流程返回的结果。 */
		const result = await configured.getAuth(model.provider);
		expect(result?.auth).toEqual({
			headers: {
				"cf-aig-authorization": "Bearer cf-key",
				Authorization: null,
				"x-api-key": null,
			},
		});
		expect(result?.env).toEqual({
			CLOUDFLARE_ACCOUNT_ID: "account-id",
			CLOUDFLARE_GATEWAY_ID: "gateway-id",
		});
	});

	// 测试场景：验证“runs provider-owned Vertex API key and ADC login flows”对应的提供商行为。
	it("runs provider-owned Vertex API key and ADC login flows", async () => {
		/** 当前提供商拥有的 API Key 认证策略。 */
		const auth = googleVertexProvider().auth.apiKey!;
		/** 模拟 Vertex API Key 登录提示的依次回答。 */
		const keyAnswers = ["api-key", "vertex-key"];
		expect(
			await auth.login?.({
				prompt: async () => keyAnswers.shift()!,
				notify: () => {},
			}),
		).toEqual({ type: "api_key", key: "vertex-key" });

		/** 模拟 Vertex ADC 登录中项目与区域提示的依次回答。 */
		const adcAnswers = ["adc", "project-id", "us-central1"];
		/** 认证登录过程中通知给调用方的事件列表。 */
		const events: AuthEvent[] = [];
		expect(
			await auth.login?.({
				prompt: async () => adcAnswers.shift()!,
				notify: (event) => events.push(event),
			}),
		).toEqual({
			type: "api_key",
			env: { GOOGLE_CLOUD_PROJECT: "project-id", GOOGLE_CLOUD_LOCATION: "us-central1" },
		});
		expect(events).toEqual([
			expect.objectContaining({
				type: "info",
				links: [expect.objectContaining({ label: "Application Default Credentials" })],
			}),
		]);
		expect(
			await auth.resolve({
				ctx: fakeAuthContext({}, ["~/.config/gcloud/application_default_credentials.json"]),
				credential: {
					type: "api_key",
					env: { GOOGLE_CLOUD_PROJECT: "project-id", GOOGLE_CLOUD_LOCATION: "us-central1" },
				},
			}),
		).toMatchObject({
			auth: {},
			env: { GOOGLE_CLOUD_PROJECT: "project-id", GOOGLE_CLOUD_LOCATION: "us-central1" },
		});
	});

	// 测试场景：验证“resolves vertex via ADC file plus project and location”对应的提供商行为。
	it("resolves vertex via ADC file plus project and location", async () => {
		/** Application Default Credentials 文件的约定路径。 */
		const adc = "~/.config/gcloud/application_default_credentials.json";
		/** 提供完整环境配置的模型集合。 */
		const configured = createModels({
			authContext: fakeAuthContext({ GOOGLE_CLOUD_PROJECT: "proj", GOOGLE_CLOUD_LOCATION: "us-central1" }, [adc]),
		});
		configured.setProvider(googleVertexProvider());
		/** 当前用例从提供商取得或构造的目标模型。 */
		const model = configured.getModels("google-vertex")[0];

		/** 当前认证、流式调用或错误流程返回的结果。 */
		const result = await configured.getAuth(model.provider);
		expect(result?.auth).toEqual({});
		expect(result?.source).toContain("application default");

		// ADC without project/location is not configured
		// 只有 ADC 文件但缺少项目或区域时，仍视为未配置。
		/** 只有部分 Vertex ADC 配置的模型集合。 */
		const partial = createModels({ authContext: fakeAuthContext({ GOOGLE_CLOUD_PROJECT: "proj" }, [adc]) });
		partial.setProvider(googleVertexProvider());
		expect(await partial.getAuth(model.provider)).toBeUndefined();

		// explicit key wins over ADC
		// 显式 API Key 的优先级高于 ADC。
		/** 显式提供 Vertex API Key 的模型集合。 */
		const keyed = createModels({ authContext: fakeAuthContext({ GOOGLE_CLOUD_API_KEY: "vertex-key" }) });
		keyed.setProvider(googleVertexProvider());
		expect((await keyed.getAuth(model.provider))?.auth.apiKey).toBe("vertex-key");
	});
});

describe("envApiKeyAuth", () => {
	// 测试场景：验证“prefers the stored credential key and falls back through env vars in order”对应的提供商行为。
	it("prefers the stored credential key and falls back through env vars in order", async () => {
		/** 当前提供商拥有的 API Key 认证策略。 */
		const auth = envApiKeyAuth("Test key", ["FIRST_KEY", "SECOND_KEY"]);

		/** 解析已保存凭据得到的认证结果。 */
		const stored = await auth.resolve({
			ctx: fakeAuthContext({ FIRST_KEY: "env" }),
			credential: { type: "api_key", key: "stored" },
		});
		expect(stored?.auth.apiKey).toBe("stored");
		expect(stored?.source).toBe("stored credential");

		/** 从第二顺位环境变量解析得到的认证结果。 */
		const second = await auth.resolve({ ctx: fakeAuthContext({ SECOND_KEY: "second" }) });
		expect(second?.auth.apiKey).toBe("second");
		expect(second?.source).toBe("SECOND_KEY");

		expect(await auth.resolve({ ctx: fakeAuthContext({}) })).toBeUndefined();
	});

	// 测试场景：验证“login prompts for a secret and returns an api-key credential”对应的提供商行为。
	it("login prompts for a secret and returns an api-key credential", async () => {
		/** 当前提供商拥有的 API Key 认证策略。 */
		const auth = envApiKeyAuth("Test key", ["TEST_KEY"]);
		/** 交互式登录返回的 API Key 凭据。 */
		const credential = await auth.login?.({
			prompt: async (prompt) => {
				expect(prompt.type).toBe("secret");
				return "entered-key";
			},
			notify: () => {},
		});
		expect(credential).toEqual({ type: "api_key", key: "entered-key" });
	});
});

describe("createProvider", () => {
	/** 创建会记录调用并返回固定成功消息的流实现。参数 label 为 API 标签、calls 为记录数组；返回 ProviderStreams。例如：recordingStreams("a", calls)。 */
	function recordingStreams(label: string, calls: string[]): ProviderStreams {
		/** 接收模型并返回固定成功事件流，同时记录调用。参数 model 为目标模型；返回 AssistantMessageEventStream。例如：respond(model)。 */
		const respond = (model: Model<Api>) => {
			calls.push(`${label}:${model.id}`);
			/** 当前响应函数创建的助手消息事件流。 */
			const stream = new AssistantMessageEventStream();
			/** 作为流开始、完成和最终结果复用的固定助手消息。 */
			const message = fauxAssistantMessage("ok");
			stream.push({ type: "start", partial: message });
			stream.push({ type: "done", reason: "stop", message });
			stream.end(message);
			return stream;
		};
		return { stream: respond, streamSimple: respond };
	}

	/** 构造最小测试模型。参数 api 为 API 标识、id 为模型编号；返回 Model<Api>。例如：testModel("api-a", "model-a")。 */
	function testModel(api: string, id: string): Model<Api> {
		return {
			id,
			name: id,
			api,
			provider: "mixed",
			baseUrl: "https://example.test/v1",
			reasoning: false,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 10000,
			maxTokens: 1000,
		};
	}

	// 测试场景：验证“dispatches on model.api for mixed-API providers”对应的提供商行为。
	it("dispatches on model.api for mixed-API providers", async () => {
		/** 按调用顺序记录 API 标签与模型编号的数组。 */
		const calls: string[] = [];
		/** 当前用例构造的模型提供商。 */
		const provider = createProvider({
			id: "mixed",
			auth: { apiKey: { name: "Test", resolve: async () => ({ auth: {} }) } },
			models: [testModel("api-a", "model-a"), testModel("api-b", "model-b")],
			api: { "api-a": recordingStreams("a", calls), "api-b": recordingStreams("b", calls) },
		});
		/** 当前用例创建或取得的模型集合，用于注册提供商并查询模型或认证。 */
		const models = createModels();
		models.setProvider(provider);

		await models.completeSimple(testModel("api-a", "model-a"), context);
		await models.completeSimple(testModel("api-b", "model-b"), context);
		expect(calls).toEqual(["a:model-a", "b:model-b"]);
	});

	// 测试场景：验证“merges provider-resolved env into stream options”对应的提供商行为。
	it("merges provider-resolved env into stream options", async () => {
		/** 提供商认证环境与请求环境合并后传给流实现的值。 */
		let capturedEnv: Record<string, string> | undefined;
		/** 最终传给流实现的请求级 API Key。 */
		let capturedApiKey: string | undefined;
		/** 归属 env-provider、用于检查认证环境合并的模型。 */
		const envModel = { ...testModel("api-a", "model-a"), provider: "env-provider" };
		/** 当前用例构造的模型提供商。 */
		const provider = createProvider({
			id: "env-provider",
			auth: {
				apiKey: {
					name: "Test",
					resolve: async () => ({
						auth: { apiKey: "provider-key" },
						env: { PROVIDER_ONLY: "provider", SHARED: "provider" },
					}),
				},
			},
			models: [envModel],
			api: {
				stream: (model, _context, options) => {
					capturedEnv = options?.env;
					capturedApiKey = options?.apiKey;
					return recordingStreams("a", []).stream(model, _context, options);
				},
				streamSimple: (model, _context, options) => {
					capturedEnv = options?.env;
					capturedApiKey = options?.apiKey;
					return recordingStreams("a", []).streamSimple(model, _context, options);
				},
			},
		});
		/** 当前用例创建或取得的模型集合，用于注册提供商并查询模型或认证。 */
		const models = createModels();
		models.setProvider(provider);

		await models.completeSimple(envModel, context, {
			apiKey: "request-key",
			env: { REQUEST_ONLY: "request", SHARED: "request" },
		});

		expect(capturedApiKey).toBe("request-key");
		expect(capturedEnv).toEqual({ PROVIDER_ONLY: "provider", REQUEST_ONLY: "request", SHARED: "request" });
	});

	// 测试场景：验证“produces a stream error for a model whose api has no implementation”对应的提供商行为。
	it("produces a stream error for a model whose api has no implementation", async () => {
		/** 当前用例构造的模型提供商。 */
		const provider = createProvider({
			id: "mixed",
			auth: { apiKey: { name: "Test", resolve: async () => ({ auth: {} }) } },
			models: [testModel("api-a", "model-a")],
			api: { "api-a": recordingStreams("a", []) },
		});
		/** 当前认证、流式调用或错误流程返回的结果。 */
		const result = await provider.streamSimple(testModel("api-ghost", "model-x"), context).result();
		expect(result.stopReason).toBe("error");
		expect(result.errorMessage).toContain("no API implementation");
	});

	// 测试场景：验证“supports dynamic providers: empty until refreshed, in-flight refreshes deduped”对应的提供商行为。
	it("supports dynamic providers: empty until refreshed, in-flight refreshes deduped", async () => {
		/** 动态模型列表实际获取次数，用于验证并发去重。 */
		let fetches = 0;
		/** 当前用例构造的模型提供商。 */
		const provider = createProvider({
			id: "dynamic",
			auth: { apiKey: { name: "Test", resolve: async () => ({ auth: {} }) } },
			models: [],
			fetchModels: async () => {
				fetches++;
				await new Promise((resolve) => setTimeout(resolve, 5));
				return [testModel("api-a", "listed")];
			},
			api: recordingStreams("a", []),
		});

		/** 保存动态模型缓存的内存存储。 */
		const store = new InMemoryModelsStore();
		/** 动态提供商刷新模型所需的凭据、缓存和联网选项。 */
		const refreshContext = {
			credential: { type: "api_key" as const },
			store: {
				read: () => store.read("dynamic"),
				write: (entry: ModelsStoreEntry) => store.write("dynamic", entry),
				delete: () => store.delete("dynamic"),
			},
			allowNetwork: true,
		};
		expect(provider.getModels()).toEqual([]);
		await Promise.all([provider.refreshModels?.(refreshContext), provider.refreshModels?.(refreshContext)]);
		expect(fetches).toBe(1);
		expect(provider.getModels().map((m) => m.id)).toEqual(["listed"]);

		// a later refresh fetches again
		// 前一轮结束后的后续刷新应重新获取模型。
		await provider.refreshModels?.(refreshContext);
		expect(fetches).toBe(2);
	});
});

describe("fauxProvider", () => {
	// 测试场景：验证“streams queued responses through a Models collection”对应的提供商行为。
	it("streams queued responses through a Models collection", async () => {
		/** 提供可排队响应和调用状态的虚拟模型提供商。 */
		const faux = fauxProvider();
		/** 当前用例创建或取得的模型集合，用于注册提供商并查询模型或认证。 */
		const models = createModels();
		models.setProvider(faux.provider);
		faux.setResponses([fauxAssistantMessage("hello from faux")]);

		/** 当前用例从提供商取得或构造的目标模型。 */
		const model = models.getModels(faux.provider.id)[0];
		/** 当前认证、流式调用或错误流程返回的结果。 */
		const result = await models.completeSimple(model, context);
		expect(result.stopReason).toBe("stop");
		expect(result.content).toEqual([{ type: "text", text: "hello from faux" }]);
		expect(faux.state.callCount).toBe(1);
	});
});
