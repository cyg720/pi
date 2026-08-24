/**
 * 文件职责：验证 OpenAI Completions 流中的 reasoning_details 能与工具调用配对并在下一轮回放。
 * 技术维度：使用 Vitest 提升式状态、模拟 OpenAI SDK 异步迭代流以及 TypeBox 工具参数模式。
 * 产品维度：保证经 OpenRouter 等兼容服务进行多轮工具调用时，模型思考签名不会丢失。
 * 逻辑维度：构造分片流，执行一次工具调用，检查内部签名，再把消息回放并检查请求载荷。
 * 关键边界：模拟分片顺序刻意让推理详情先于工具调用；测试不发起真实网络请求。
 * 新手阅读建议：先看主用例的两次流调用，再按 model、chunk、toolCallChunk 理解测试数据来源。
 */
import { Type } from "typebox";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { stream as streamOpenAICompletions } from "../src/api/openai-completions.ts";
import type { AssistantMessage, Model, Tool } from "../src/types.ts";

// OpenAI SDK 模拟器共享状态；chunkSets 提供每次请求的分片，payloads 保存实际请求参数。
const mockState = vi.hoisted(() => ({
	chunkSets: [] as unknown[][],
	payloads: [] as unknown[],
}));

vi.mock("openai", () => {
	// FakeOpenAI 复刻测试所需的最小 SDK 表面，用可控分片替代真实网络流。
	class FakeOpenAI {
		// 模拟 SDK 的 chat.completions 接口；create 会消费一组分片并返回可等待的异步流。
		chat = {
			completions: {
				create: (payload: unknown) => {
					// payload 是当前 SDK 请求载荷；该回调记录它并返回带 withResponse 的 Promise。
					mockState.payloads.push(payload);
					// 当前请求使用的分片序列；队列为空时退化为空流。
					const chunks = mockState.chunkSets.shift() ?? [];
					// 支持 for-await 消费的最小异步可迭代对象。
					const stream = {
						async *[Symbol.asyncIterator]() {
							for (const chunk of chunks) {
								// chunk 是单个模拟增量；生成器逐项返回且最终不提供额外返回值。
								yield chunk;
							}
						},
					};
					// 模拟 SDK 返回值及其 withResponse 扩展方法。
					const result = Promise.resolve(stream) as Promise<typeof stream> & {
						withResponse: () => Promise<{ data: typeof stream; response: { status: number; headers: Headers } }>;
					};
					result.withResponse = async () => ({
						data: stream,
						response: { status: 200, headers: new Headers() },
					});
					return result;
				},
			},
		};
	}
	return { default: FakeOpenAI };
});

// 可被序列化和回放的加密推理详情；id 必须与工具调用 id 一致。
const reasoningDetail = { type: "reasoning.encrypted", id: "call_1", data: "encrypted-signature" };
// 测试用读取工具定义；参数模式只允许字符串路径。
const readTool: Tool = {
	name: "read",
	description: "Read a file",
	parameters: Type.Object({ path: Type.String() }),
};

/** 功能：创建 OpenRouter 的测试模型元数据；参数：无；返回：OpenAI Completions 模型。示例：streamOpenAICompletions(model(), ...)。 */
function model(): Model<"openai-completions"> {
	return {
		id: "google/gemini-test",
		name: "Gemini Test",
		api: "openai-completions",
		provider: "openrouter",
		baseUrl: "https://openrouter.ai/api/v1",
		reasoning: true,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 100_000,
		maxTokens: 4096,
	};
}

/** 功能：包装一个聊天流分片；参数 delta 为增量内容、finishReason 为终止原因；返回：SDK 形状对象。示例：chunk({ content: "ok" }, "stop")。 */
function chunk(delta: Record<string, unknown>, finishReason: string | null = null): unknown {
	return {
		id: "chatcmpl-test",
		model: "google/gemini-test",
		choices: [{ index: 0, delta, finish_reason: finishReason }],
	};
}

/** 功能：创建固定的 read 工具调用分片；参数：无；返回：工具调用流分片。示例：toolCallChunk()。 */
function toolCallChunk(): unknown {
	return chunk({
		tool_calls: [
			{
				index: 0,
				id: "call_1",
				type: "function",
				function: { name: "read", arguments: '{"path":"README.md"}' },
			},
		],
	});
}

/** 功能：执行测试流并收集助手消息；参数 messages 为可选历史；返回：最终助手消息。示例：await runOpenAICompletionsStream()。 */
async function runOpenAICompletionsStream(messages: AssistantMessage[] = []): Promise<AssistantMessage> {
	return await streamOpenAICompletions(model(), { messages, tools: [readTool] }, { apiKey: "test" }).result();
}

/** 功能：从未知请求载荷中寻找助手消息；参数 payload 为请求对象；返回：助手载荷或 undefined。示例：getAssistantPayload(mockState.payloads[0])。 */
function getAssistantPayload(payload: unknown): { reasoning_details?: unknown } | undefined {
	// 防御性读取消息数组；载荷缺少 messages 时使用空数组。
	const messages = (payload as { messages?: Array<{ role?: string; reasoning_details?: unknown }> }).messages ?? [];
	return messages.find((message) => message.role === "assistant");
}

describe("openai-completions reasoning_details streaming", () => {
	beforeEach(() => {
		mockState.chunkSets = [];
		mockState.payloads = [];
	});

	it("preserves reasoning_details that arrive before their matching tool call", async () => {
		mockState.chunkSets = [
			[chunk({ reasoning_details: [reasoningDetail] }), toolCallChunk(), chunk({}, "tool_calls")],
			[chunk({ content: "ok" }), chunk({}, "stop")],
		];

		// 首次请求得到的助手消息，其中应包含工具调用及推理签名。
		const assistantMessage = await runOpenAICompletionsStream();
		// 从消息内容中定位唯一工具调用块；找不到时为 undefined 并使断言失败。
		const toolCall = assistantMessage.content.find((block) => block.type === "toolCall");
		expect(toolCall).toMatchObject({
			type: "toolCall",
			id: "call_1",
			name: "read",
			arguments: { path: "README.md" },
			thoughtSignature: JSON.stringify(reasoningDetail),
		});

		await runOpenAICompletionsStream([assistantMessage]);

		expect(getAssistantPayload(mockState.payloads[1])?.reasoning_details).toEqual([reasoningDetail]);
	});
});
