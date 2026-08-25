/**
 * 文件职责：验证 Responses API 的 JSON Schema 与语法约束采样转换、回放和流式增量处理。
 * 技术维度：使用 Vitest、TypeBox、OpenAI Responses 事件类型及自定义消息事件流构造纯单元测试。
 * 产品维度：保证工具参数能按约束可靠生成，并在提供商能力不足时采用可预测的降级或报错策略。
 * 逻辑维度：先创建模型、用量和工具夹具，再测试工具转换、历史回放、增量拼接及实时工具调用。
 * 关键边界：语法工具目前要求指定属性为字符串；strict=require 不允许静默降级；增量只能追加不能改写。
 * 新手阅读建议：先看 makeTool 和转换用例理解配置，再阅读 append-only 用例，最后跟踪完整流事件数组。
 */
import type { ResponseStreamEvent } from "openai/resources/responses/responses.js";
import { Type } from "typebox";
import { describe, expect, it } from "vitest";
import { appendGrammarToolInputJsonDelta } from "../src/api/constrained-sampling.ts";
import {
	convertResponsesMessages,
	convertResponsesTools,
	processResponsesStream,
} from "../src/api/openai-responses-shared.ts";
import type { AssistantMessage, Context, Model, Tool, ToolCall } from "../src/types.ts";
import { AssistantMessageEventStream } from "../src/utils/event-stream.ts";

/**
 * 创建不访问网络的最小 Responses 模型夹具。
 * @returns 支持文字和图片输入的测试模型。
 * @example const model = makeModel();
 */
function makeModel(): Model<"openai-responses"> {
	return {
		id: "gpt-test",
		name: "GPT Test",
		api: "openai-responses",
		provider: "openai",
		baseUrl: "https://api.openai.com/v1",
		reasoning: false,
		input: ["text", "image"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128000,
		maxTokens: 4096,
	};
}

/**
 * 创建所有计数为零的助手用量对象。
 * @returns 可直接放入 AssistantMessage 的 usage。
 * @example const usage = makeUsage();
 */
function makeUsage(): AssistantMessage["usage"] {
	return {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 0,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
	};
}

/**
 * 创建尚未包含内容的助手输出，供流处理器原地填充。
 * @returns 初始停止原因为 stop 的测试助手消息。
 * @example const output = makeOutput();
 */
function makeOutput(): AssistantMessage {
	return {
		role: "assistant",
		content: [],
		api: "openai-responses",
		provider: "openai",
		model: "gpt-test",
		usage: makeUsage(),
		stopReason: "stop",
		timestamp: Date.now(),
	};
}

/**
 * 把普通事件数组包装成异步生成器，模拟网络响应流。
 * @param events 按到达顺序排列的 Responses 事件。
 * @returns 逐个产出原事件的异步生成器。
 * @example for await (const event of iterateEvents(events)) { ... }
 */
async function* iterateEvents(events: ResponseStreamEvent[]): AsyncGenerator<ResponseStreamEvent> {
	yield* events;
}

/**
 * 创建默认函数工具，并允许用例覆盖约束配置等字段。
 * @param overrides 要合并到默认工具上的字段。
 * @returns 参数含 payload 字符串的工具定义。
 * @example makeTool({ constrainedSampling: false });
 */
function makeTool(overrides: Partial<Tool> = {}): Tool {
	return {
		name: "sample_tool",
		description: "Sample tool",
		parameters: Type.Object({ payload: Type.String() }, { additionalProperties: false }),
		...overrides,
	};
}

/**
 * 劫持事件流 push 方法并记录所有 toolcall_delta 文本。
 * @param stream 待观察的助手消息事件流。
 * @returns 会随 push 调用持续追加的增量字符串数组。
 * @example const deltas = captureToolCallDeltas(stream);
 */
function captureToolCallDeltas(stream: AssistantMessageEventStream): string[] {
	/** 按发送顺序收集的工具调用参数增量。 */
	const deltas: string[] = [];
	/** 绑定原实例的 push，记录后仍需转发事件。 */
	const originalPush = stream.push.bind(stream);
	stream.push = (event) => {
		if (event.type === "toolcall_delta") {
			deltas.push(event.delta);
		}
		originalPush(event);
	};
	return deltas;
}

/** 覆盖约束工具在声明转换、历史消息和实时响应流中的完整生命周期。 */
describe("constrained tool sampling", () => {
	it("converts supported constraints and falls back when unsupported", () => {
		expect(
			convertResponsesTools([makeTool({ constrainedSampling: { type: "json_schema", strict: "prefer" } })])[0],
		).toMatchObject({ type: "function", name: "sample_tool", strict: true });

		expect(() =>
			convertResponsesTools([makeTool({ constrainedSampling: { type: "json_schema", strict: "require" } })], {
				supportsStrictMode: false,
			}),
		).toThrow('Tool "sample_tool" requires JSON-schema constrained sampling');

		/** 带 OpenAI Lark 语法变体的测试工具。 */
		const grammarTool = makeTool({
			constrainedSampling: { type: "grammar", variants: { openai_lark: "start: /[a-z]+/" } },
		});
		expect(convertResponsesTools([grammarTool], { supportsOpenAIGrammarTools: true })[0]).toMatchObject({
			type: "custom",
			name: "sample_tool",
			format: { type: "grammar", syntax: "lark", definition: "start: /[a-z]+/" },
		});
		expect(() =>
			convertResponsesTools([makeTool({ constrainedSampling: { type: "grammar", variants: {} } })], {
				supportsOpenAIGrammarTools: true,
			}),
		).toThrow(
			'Tool "sample_tool" cannot use grammar constrained sampling: no supported grammar variant was provided',
		);

		/** 提供商不支持语法或 strict 时得到的普通函数工具。 */
		const fallback = convertResponsesTools([grammarTool], {
			supportsOpenAIGrammarTools: false,
			supportsStrictMode: false,
		})[0];
		expect(fallback).toMatchObject({ type: "function", name: "sample_tool" });
		expect("strict" in (fallback as object)).toBe(false);

		expect(convertResponsesTools([makeTool({ constrainedSampling: false })])).toEqual(
			convertResponsesTools([makeTool()]),
		);
	});

	it("replays grammar calls as custom Responses items", () => {
		/** 历史助手消息中的语法工具调用，会在循环中暂时写入非法参数。 */
		const replayedToolCall: ToolCall = {
			type: "toolCall",
			id: "call_1|ctc_1",
			name: "sample_tool",
			arguments: { payload: "abc" },
		};
		/** 包含工具调用及对应工具结果的历史会话。 */
		const context: Context = {
			messages: [
				{
					role: "assistant",
					api: "openai-responses",
					provider: "openai",
					model: "gpt-test",
					content: [replayedToolCall],
					usage: makeUsage(),
					stopReason: "toolUse",
					timestamp: Date.now(),
				},
				{
					role: "toolResult",
					toolCallId: "call_1|ctc_1",
					toolName: "sample_tool",
					content: [{ type: "text", text: "done" }],
					isError: false,
					timestamp: Date.now(),
				},
			],
		};
		// invalidArguments 是当前缺字段或字段类型错误的语法工具参数夹具。
		for (const invalidArguments of [{}, { payload: 42 }]) {
			replayedToolCall.arguments = invalidArguments;
			expect(() =>
				convertResponsesMessages(makeModel(), context, new Set(["openai"]), {
					grammarToolInputProperties: new Map([["sample_tool", "payload"]]),
				}),
			).toThrow('Grammar tool call "sample_tool" requires argument "payload" to be a string');
		}

		replayedToolCall.arguments = { payload: "abc" };
		/** 转换后的 Responses 输入项，应包含自定义工具调用与输出。 */
		const messages = convertResponsesMessages(makeModel(), context, new Set(["openai"]), {
			grammarToolInputProperties: new Map([["sample_tool", "payload"]]),
		});

		expect(messages).toContainEqual({
			type: "custom_tool_call",
			id: "ctc_1",
			call_id: "call_1",
			name: "sample_tool",
			input: "abc",
		});
		expect(messages).toContainEqual({
			type: "custom_tool_call_output",
			call_id: "call_1",
			output: "done",
		});
	});

	it("keeps grammar input JSON deltas append-only", () => {
		/** 记录语法属性已输出文本及开始、结束状态的可变缓冲区。 */
		const buffer = { input: "", started: false, closed: false };
		/** 首次输入产生的 JSON 文本增量。 */
		const first = appendGrammarToolInputJsonDelta(buffer, "payload", 'a"', false);
		/** 在首次内容后追加换行和字符产生的第二段增量。 */
		const second = appendGrammarToolInputJsonDelta(buffer, "payload", 'a"\nb', true);

		expect(JSON.parse(`${first}${second}`)).toEqual({ payload: 'a"\nb' });
		expect(appendGrammarToolInputJsonDelta(buffer, "payload", 'a"\nb', true)).toBeUndefined();
		expect(() => appendGrammarToolInputJsonDelta(buffer, "payload", "changed", true)).toThrow(
			'grammar tool input for property "payload" changed after it was closed',
		);
	});

	it("streams custom Responses tool calls as string arguments", async () => {
		/** 将被流处理器填充的助手输出。 */
		const output = makeOutput();
		/** 接收标准化消息事件的本地事件流。 */
		const stream = new AssistantMessageEventStream();
		/** 记录工具参数的逐段 JSON 增量。 */
		const deltas = captureToolCallDeltas(stream);
		/** 模拟一次自定义工具调用从创建、增量、完成到响应结束的原始事件序列。 */
		const events = [
			{
				type: "response.output_item.added",
				output_index: 0,
				item: { type: "custom_tool_call", call_id: "call_1", id: "ctc_1", name: "sample_tool", input: "" },
			},
			{
				type: "response.custom_tool_call_input.delta",
				output_index: 0,
				item_id: "ctc_1",
				delta: "ab",
			},
			{
				type: "response.custom_tool_call_input.done",
				output_index: 0,
				item_id: "ctc_1",
				input: "abc",
			},
			{
				type: "response.output_item.done",
				output_index: 0,
				item: { type: "custom_tool_call", call_id: "call_1", id: "ctc_1", name: "sample_tool", input: "abc" },
			},
			{
				type: "response.completed",
				response: { status: "completed", usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } },
			},
		] as ResponseStreamEvent[];

		await processResponsesStream(iterateEvents(events), output, stream, makeModel(), {
			grammarToolInputProperties: new Map([["sample_tool", "payload"]]),
		});

		expect(output.stopReason).toBe("toolUse");
		expect(output.content).toEqual([
			{ type: "toolCall", id: "call_1|ctc_1", name: "sample_tool", arguments: { payload: "abc" } },
		]);
		expect(JSON.parse(deltas.join(""))).toEqual({ payload: "abc" });
	});
});
