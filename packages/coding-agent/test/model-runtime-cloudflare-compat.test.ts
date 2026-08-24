/**
 * 文件职责：验证 Cloudflare AI Gateway 兼容端点在运行时和扩展式认证两条路径中正确生成。
 * 技术维度：使用 Vitest 模块模拟、OpenAI 流接口、内存认证、ModelRuntime 和 ModelRegistry。
 * 产品维度：保证用户只配置账户、网关和令牌即可通过 OpenAI 兼容协议调用 Cloudflare。
 * 逻辑维度：模拟成功流并捕获客户端选项，分别通过运行时完成接口和注册表认证调用。
 * 关键边界：不访问网络；共享捕获状态由每次假客户端构造覆盖，调用前重置 API 提供商。
 * 新手阅读建议：先看 FakeOpenAI 的最小流，再看 createCloudflareRuntime 如何注入三项凭据。
 */
import { complete, resetApiProviders } from "@earendil-works/pi-ai/compat";
import { describe, expect, it, vi } from "vitest";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { ModelRegistry } from "../src/core/model-registry.ts";
import { ModelRuntime } from "../src/core/model-runtime.ts";

// openAIState 保存假 OpenAI 客户端构造时收到的选项。
const openAIState = vi.hoisted(() => ({ clientOptions: undefined as unknown }));

// 用假客户端替换 openai 模块，避免网络访问。
vi.mock("openai", () => {
	/** 提供成功空流响应的最小 OpenAI 客户端。 */
	class FakeOpenAI {
		/** 保存客户端选项；options 为构造配置，无返回值。 */
		constructor(options: unknown) {
			openAIState.clientOptions = options;
		}

		// chat.completions.create 返回支持 withResponse 的异步流。
		chat = {
			completions: {
				create: () => {
					// stream 是只产生一个停止事件的异步可迭代对象。
					const stream = {
						async *[Symbol.asyncIterator]() {
							yield {
								choices: [{ delta: {}, finish_reason: "stop" }],
								usage: { prompt_tokens: 1, completion_tokens: 1 },
							};
						},
					};
					// promise 模拟 SDK 返回值，并附加 withResponse 方法。
					const promise = Promise.resolve(stream) as Promise<typeof stream> & {
						withResponse(): Promise<{
							data: typeof stream;
							response: { status: number; headers: Headers };
						}>;
					};
					promise.withResponse = async () => ({
						data: stream,
						response: { status: 200, headers: new Headers() },
					});
					return promise;
				},
			},
		};
	}

	return { default: FakeOpenAI };
});

/** 创建带测试认证的 Cloudflare 运行时与注册表；无参数，返回二者的 Promise。 */
async function createCloudflareRuntime(): Promise<{ modelRuntime: ModelRuntime; modelRegistry: ModelRegistry }> {
	// authStorage 保存测试令牌及账户、网关环境值。
	const authStorage = AuthStorage.inMemory();
	await authStorage.modify("cloudflare-ai-gateway", async () => ({
		type: "api_key",
		key: "test-token",
		env: {
			CLOUDFLARE_ACCOUNT_ID: "test-account",
			CLOUDFLARE_GATEWAY_ID: "test-gateway",
		},
	}));
	// modelRuntime 从内存认证和内置模型创建。
	const modelRuntime = await ModelRuntime.create({ credentials: authStorage, modelsPath: null });
	return { modelRuntime, modelRegistry: new ModelRegistry(modelRuntime) };
}

describe("ModelRegistry Cloudflare compat streaming", () => {
	// 验证 ModelRuntime 直接调用时物化兼容端点和授权头；无参数，无返回值。
	it("materializes the Cloudflare endpoint through ModelRuntime streaming", async () => {
		// modelRuntime 是带 Cloudflare 测试认证的运行时。
		const { modelRuntime } = await createCloudflareRuntime();
		// model 是 Cloudflare Workers AI Kimi 模型。
		const model = modelRuntime.getModel("cloudflare-ai-gateway", "workers-ai/@cf/moonshotai/kimi-k2.5");
		expect(model).toBeDefined();

		resetApiProviders();
		await modelRuntime.completeSimple(model!, { messages: [] });

		// clientOptions 是假客户端捕获的最终端点和默认请求头。
		const clientOptions = openAIState.clientOptions as {
			baseURL?: string;
			defaultHeaders?: Record<string, unknown>;
		};
		expect(clientOptions.baseURL).toBe("https://gateway.ai.cloudflare.com/v1/test-account/test-gateway/compat");
		expect(clientOptions.defaultHeaders?.["cf-aig-authorization"]).toBe("Bearer test-token");
	});

	// 验证扩展式先解析认证再 complete 时得到相同端点；无参数，无返回值。
	it("materializes the Cloudflare endpoint after extension-style auth resolution", async () => {
		// modelRegistry 是基于同一运行时的模型查找与认证接口。
		const { modelRegistry } = await createCloudflareRuntime();
		// model 是从注册表查得的 Cloudflare 模型。
		const model = modelRegistry.find("cloudflare-ai-gateway", "workers-ai/@cf/moonshotai/kimi-k2.5");
		expect(model).toBeDefined();

		resetApiProviders();
		// auth 是扩展调用风格解析得到的密钥和请求头。
		const auth = await modelRegistry.getApiKeyAndHeaders(model!);
		expect(auth.ok).toBe(true);
		if (!auth.ok) throw new Error(auth.error);

		await complete(model!, { messages: [] }, auth);

		// clientOptions 是第二条调用路径捕获的客户端配置。
		const clientOptions = openAIState.clientOptions as {
			baseURL?: string;
			defaultHeaders?: Record<string, unknown>;
		};
		expect(clientOptions.baseURL).toBe("https://gateway.ai.cloudflare.com/v1/test-account/test-gateway/compat");
		expect(clientOptions.defaultHeaders?.["cf-aig-authorization"]).toBe("Bearer test-token");
	});
});
