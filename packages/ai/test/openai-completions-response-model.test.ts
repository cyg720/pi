/**
 * 文件职责：验证路由型 OpenAI Completions 模型把实际响应模型写入 responseModel，而不改变请求模型 id。
 * 技术维度：使用 Vitest、模拟 OpenAI SDK 异步流和 OpenRouter auto 虚拟模型构造响应分片。
 * 产品维度：让用户既能看到自己选择的路由模型，也能获知服务实际分派到的具体模型。
 * 逻辑维度：模拟不同 chunk.model 值，完成流请求，分别检查具体模型、相同模型和空值三种结果。
 * 关键边界：只有非空且不同于请求 id 的响应模型才应写入 responseModel；测试不访问网络。
 * 新手阅读建议：先读顶部路由说明及中文补充，再比较三个用例的分片 model 字段。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { complete } from "../src/compat.ts";
import type { Model } from "../src/types.ts";

// Router/virtual ids (e.g. OpenRouter `auto`) keep `model` pinned to the
// 中文说明：路由或虚拟 id（如 OpenRouter auto）始终保留在消息的 model 字段中。
// requested id and surface the routed concrete id on `responseModel`.
// 中文说明：服务实际选择的具体模型另存到 responseModel，方便调用方区分请求与响应模型。

// OpenAI SDK 模拟状态；chunks 是下一次请求会返回的完整分片序列。
const mockState = vi.hoisted(() => ({
	chunks: [] as unknown[],
}));

vi.mock("openai", () => {
	// FakeOpenAI 提供测试所需最小 chat.completions.create 接口，并从 mockState 读取分片。
	class FakeOpenAI {
		// 模拟 SDK 的 chat 命名空间及 completions 端点。
		chat = {
			completions: {
				create: () => {
					// 当前请求使用的分片数组，不复制以保持测试设置简单。
					const chunks = mockState.chunks;
					// 可由 for-await 消费的最小流对象。
					const stream = {
						async *[Symbol.asyncIterator]() {
							for (const chunk of chunks) yield chunk;
						},
					};
					// 兼容 SDK withResponse 调用约定的 Promise。
					const promise = Promise.resolve(stream) as Promise<typeof stream> & {
						withResponse: () => Promise<{
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

/** 功能：创建 OpenRouter auto 虚拟模型；参数：无；返回：固定模型元数据。示例：complete(openRouterAuto(), context, options)。 */
function openRouterAuto(): Model<"openai-completions"> {
	return {
		id: "openrouter/auto",
		name: "OpenRouter Auto",
		api: "openai-completions",
		provider: "openrouter",
		baseUrl: "https://openrouter.ai/api/v1",
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 200_000,
		maxTokens: 8192,
	};
}

describe("openai-completions responseModel", () => {
	// 功能：重置模拟分片；参数：无；返回：无。示例：Vitest 每个用例前调用。
	beforeEach(() => {
		mockState.chunks = [];
	});

	it("surfaces routed chunk.model on responseModel without changing model", async () => {
		mockState.chunks = [
			{ id: "chatcmpl-1", model: "anthropic/claude-opus-4.8", choices: [{ index: 0, delta: { content: "hi" } }] },
			{
				id: "chatcmpl-1",
				model: "anthropic/claude-opus-4.8",
				choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
				usage: {
					prompt_tokens: 10,
					completion_tokens: 5,
					prompt_tokens_details: { cached_tokens: 0 },
					completion_tokens_details: { reasoning_tokens: 0 },
				},
			},
		];

		// 完成模拟流后得到的助手消息；应同时保留请求 id 与实际路由 id。
		const message = await complete(
			openRouterAuto(),
			{ messages: [{ role: "user", content: "hi", timestamp: Date.now() }] },
			{ apiKey: "test" },
		);

		expect(message.model).toBe("openrouter/auto");
		expect(message.responseModel).toBe("anthropic/claude-opus-4.8");
		expect(message.provider).toBe("openrouter");
		expect(message.stopReason).toBe("stop");
	});

	it("leaves responseModel undefined when chunks echo the requested id", async () => {
		mockState.chunks = [
			{ id: "chatcmpl-2", model: "openrouter/auto", choices: [{ index: 0, delta: { content: "hi" } }] },
			{
				id: "chatcmpl-2",
				model: "openrouter/auto",
				choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
				usage: {
					prompt_tokens: 1,
					completion_tokens: 1,
					prompt_tokens_details: { cached_tokens: 0 },
					completion_tokens_details: { reasoning_tokens: 0 },
				},
			},
		];

		// 分片回显请求模型时生成的助手消息。
		const message = await complete(
			openRouterAuto(),
			{ messages: [{ role: "user", content: "hi", timestamp: Date.now() }] },
			{ apiKey: "test" },
		);

		expect(message.model).toBe("openrouter/auto");
		expect(message.responseModel).toBeUndefined();
	});

	it("ignores empty or missing chunk.model", async () => {
		mockState.chunks = [
			{ id: "chatcmpl-3", choices: [{ index: 0, delta: { content: "hi" } }] },
			{ id: "chatcmpl-3", model: "", choices: [{ index: 0, delta: { content: "!" } }] },
			{
				id: "chatcmpl-3",
				choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
				usage: {
					prompt_tokens: 1,
					completion_tokens: 2,
					prompt_tokens_details: { cached_tokens: 0 },
					completion_tokens_details: { reasoning_tokens: 0 },
				},
			},
		];

		// 分片缺失或提供空模型名时生成的助手消息。
		const message = await complete(
			openRouterAuto(),
			{ messages: [{ role: "user", content: "hi", timestamp: Date.now() }] },
			{ apiKey: "test" },
		);

		expect(message.model).toBe("openrouter/auto");
		expect(message.responseModel).toBeUndefined();
	});
});
