/**
 * 文件职责：验证未知提供商仍可通过旧版 API 注册表分发请求并传递调用级密钥。
 * 技术维度：使用 Vitest、自定义提供商注册和 AssistantMessageEventStream 构造同步完成流。
 * 产品维度：保障扩展提供商在兼容入口中继续收到用户为单次请求指定的认证信息。
 * 逻辑维度：准备固定模型与上下文，注册两种流方法，调用 complete 并检查捕获的密钥。
 * 关键边界：不发起网络请求；每个用例后必须重置全局提供商注册表，避免污染其他测试。
 * 新手阅读建议：先看 context、model 和 message 三个夹具，再看注册回调如何生成最小事件流。
 */
import { afterEach, describe, expect, it } from "vitest";
import { complete, registerApiProvider, resetApiProviders } from "../src/compat.ts";
import type { AssistantMessage, Context, Model } from "../src/types.ts";
import { AssistantMessageEventStream } from "../src/utils/event-stream.ts";

// 固定的最小用户上下文，用于触发一次兼容层完成请求。
const context: Context = { messages: [{ role: "user", content: "hi", timestamp: Date.now() }] };

// 模拟不在内置提供商表中的 OpenAI Responses 模型配置。
const model: Model<"openai-responses"> = {
	id: "test-model",
	name: "Test Model",
	api: "openai-responses",
	provider: "custom-openai",
	baseUrl: "https://example.test/v1",
	reasoning: false,
	input: ["text"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 128000,
	maxTokens: 4096,
};

/**
 * 创建成功结束的最小助手消息。
 * 参数：无。
 * 返回值：内容为 ok、用量为零且引用测试模型的 AssistantMessage。
 * 使用示例：`stream.end(message())`。
 */
function message(): AssistantMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text: "ok" }],
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

describe("compat legacy API fallback", () => {
	// 每个用例结束后清空全局 API 提供商注册，避免跨测试泄漏；无参数，无返回值。
	afterEach(() => {
		resetApiProviders();
	});

	// 验证请求级 apiKey 会传给旧版注册表中的流实现；无参数，无返回值。
	it("dispatches unknown providers through the legacy API registry", async () => {
		// 保存流回调收到的请求密钥；调用前允许为 undefined。
		let capturedApiKey: string | undefined;
		registerApiProvider({
			api: "openai-responses",
			// _model 和 _context 在夹具中无需使用，options 携带待验证的请求选项。
			stream: (_model, _context, options) => {
				capturedApiKey = options?.apiKey;
				// stream 是手工推送开始和完成事件的测试消息流。
				const stream = new AssistantMessageEventStream();
				// output 是同时用于部分事件与最终结果的固定助手消息。
				const output = message();
				stream.push({ type: "start", partial: output });
				stream.push({ type: "done", reason: "stop", message: output });
				stream.end(output);
				return stream;
			},
			// _model 和 _context 在夹具中无需使用，options 携带待验证的请求选项。
			streamSimple: (_model, _context, options) => {
				capturedApiKey = options?.apiKey;
				// stream 是供简单流接口返回的测试消息流。
				const stream = new AssistantMessageEventStream();
				// output 是简单流的固定成功助手消息。
				const output = message();
				stream.push({ type: "start", partial: output });
				stream.push({ type: "done", reason: "stop", message: output });
				stream.end(output);
				return stream;
			},
		});

		await complete(model, context, { apiKey: "request-key" });

		expect(capturedApiKey).toBe("request-key");
	});
});
