/**
 * 文件职责：验证 OpenAI Responses 工具调用完成后从持久化块和结束事件中移除 partialJson。
 * 技术维度：使用 Vitest、异步生成器、模拟 Responses SSE 事件和 AssistantMessageEventStream。
 * 产品维度：避免会话文件保存仅供流式展示的临时 JSON，保证工具参数干净稳定。
 * 逻辑维度：构造输出消息和工具参数事件序列，处理流后检查持久内容及发出的结束事件。
 * 关键边界：参数增量是分段 JSON，但 done 事件提供完整字符串；不访问真实 OpenAI。
 * 新手阅读建议：先看事件生成器顺序，再跟踪 persistedToolCall 和 toolCallEnd 两处断言。
 */
import type { ResponseStreamEvent } from "openai/resources/responses/responses.js";
import { describe, expect, it, vi } from "vitest";
import { processResponsesStream } from "../src/api/openai-responses-shared.ts";
import type { AssistantMessage, AssistantMessageEvent, Model } from "../src/types.ts";
import { AssistantMessageEventStream } from "../src/utils/event-stream.ts";

/** 创建绑定指定模型的空助手输出消息；返回 AssistantMessage。 */
function createOutput(model: Model<"openai-responses">): AssistantMessage {
	return {
		role: "assistant",
		content: [],
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
		stopReason: "pending",
		timestamp: Date.now(),
	};
}

/**
 * 生成一次 edit 工具调用从 added、参数增量到 completed 的事件序列。
 * 参数：argumentsJson 为完成事件携带的完整参数 JSON。
 * 返回值：ResponseStreamEvent 异步迭代器。
 */
async function* createFunctionCallEvents(argumentsJson: string): AsyncIterable<ResponseStreamEvent> {
	yield {
		type: "response.output_item.added",
		item: {
			type: "function_call",
			id: "fc_test",
			call_id: "call_test",
			name: "edit",
			arguments: "",
		},
	} as ResponseStreamEvent;
	yield {
		type: "response.function_call_arguments.delta",
		delta: '{"path":"README.md"',
	} as ResponseStreamEvent;
	yield {
		type: "response.function_call_arguments.delta",
		delta: ',"content":"updated"}',
	} as ResponseStreamEvent;
	yield {
		type: "response.function_call_arguments.done",
		arguments: argumentsJson,
	} as ResponseStreamEvent;
	yield {
		type: "response.output_item.done",
		item: {
			type: "function_call",
			id: "fc_test",
			call_id: "call_test",
			name: "edit",
			arguments: argumentsJson,
		},
	} as ResponseStreamEvent;
	yield {
		type: "response.completed",
		sequence_number: 5,
		response: { id: "resp_test", status: "completed" },
	} as ResponseStreamEvent;
}

describe("openai responses partialJson cleanup", () => {
	// 验证 output_item.done 后持久块和 toolcall_end 均无 partialJson；无参数，无返回值。
	it("removes partialJson from persisted tool-call blocks at output_item.done", async () => {
		// model 是用于流解析的固定 Responses 测试模型。
		const model: Model<"openai-responses"> = {
			id: "gpt-5-mini",
			name: "GPT-5 Mini",
			api: "openai-responses",
			provider: "openai",
			baseUrl: "https://api.openai.com/v1",
			reasoning: true,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 400000,
			maxTokens: 128000,
		};
		// output 是待由事件流逐步填充的助手消息。
		const output = createOutput(model);
		// stream 收集解析器发出的助手消息事件。
		const stream = new AssistantMessageEventStream();
		// pushSpy 记录 stream.push 的全部事件参数。
		const pushSpy = vi.spyOn(stream, "push");
		// argumentsJson 是最终完整工具参数。
		const argumentsJson = '{"path":"README.md","content":"updated"}';

		await processResponsesStream(createFunctionCallEvents(argumentsJson), output, stream, model);

		expect(output.content).toHaveLength(1);
		// persistedToolCall 是最终写入助手消息的工具调用块。
		const persistedToolCall = output.content[0];
		expect(persistedToolCall?.type).toBe("toolCall");
		if (!persistedToolCall || persistedToolCall.type !== "toolCall") {
			throw new Error("Expected toolCall block");
		}
		expect(persistedToolCall.arguments).toEqual({ path: "README.md", content: "updated" });
		expect("partialJson" in persistedToolCall).toBe(false);

		// emittedEvents 从模拟调用中提取全部事件对象。
		const emittedEvents = pushSpy.mock.calls.map(([event]) => event as AssistantMessageEvent);
		// toolCallEnd 是可选的工具调用结束事件。
		const toolCallEnd = emittedEvents.find((event) => event.type === "toolcall_end");
		expect(toolCallEnd).toBeDefined();
		if (!toolCallEnd || toolCallEnd.type !== "toolcall_end") {
			throw new Error("Expected toolcall_end event");
		}
		expect(toolCallEnd.toolCall).toBe(persistedToolCall);
		expect("partialJson" in toolCallEnd.toolCall).toBe(false);
	});
});
