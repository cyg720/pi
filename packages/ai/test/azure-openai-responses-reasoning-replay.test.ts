/**
 * 文件职责：验证 Azure OpenAI Responses 流中的加密推理内容在消息回放时被完整保留。
 * 技术维度：使用 Vitest、OpenAI Responses 事件类型、异步生成器和共享流处理函数构造事件序列。
 * 产品维度：保证多轮 Azure 对话能复用模型返回的 encrypted_content，维持服务端推理上下文。
 * 逻辑维度：创建模型与输出消息，依次产出 added、done、completed 事件，再转换历史并检查推理项。
 * 关键边界：done 已有密文时不得被 completed 覆盖；done 缺失密文时才允许用 completed 补全。
 * 新手阅读建议：先比较两个用例唯一差异，再追踪 createEvents 与 getReplayedReasoning 的数据流。
 */
import type { ResponseReasoningItem, ResponseStreamEvent } from "openai/resources/responses/responses.js";
import { describe, expect, it } from "vitest";
import { convertResponsesMessages, processResponsesStream } from "../src/api/openai-responses-shared.ts";
import type { AssistantMessage, Context, Model } from "../src/types.ts";
import { AssistantMessageEventStream } from "../src/utils/event-stream.ts";

/** 功能：创建 Azure Responses 测试模型；参数：无；返回：固定模型元数据。示例：const model = createModel()。 */
function createModel(): Model<"azure-openai-responses"> {
	return {
		id: "gpt-5-mini",
		name: "GPT-5 Mini",
		api: "azure-openai-responses",
		provider: "azure-openai-responses",
		baseUrl: "https://example.invalid",
		reasoning: true,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 400000,
		maxTokens: 128000,
	};
}

/** 功能：创建待流处理器填充的助手消息；参数 model 为模型元数据；返回：空内容、零用量消息。示例：createOutput(model)。 */
function createOutput(model: Model<"azure-openai-responses">): AssistantMessage {
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

/** 功能：按协议顺序生成三条响应事件；参数 doneItem 和 completedItem 为两个阶段的推理项；返回：异步事件流。示例：processResponsesStream(createEvents(a, b), ...)。 */
async function* createEvents(
	doneItem: ResponseReasoningItem,
	completedItem: ResponseReasoningItem,
): AsyncIterable<ResponseStreamEvent> {
	yield {
		type: "response.output_item.added",
		output_index: 0,
		sequence_number: 0,
		item: { type: "reasoning", id: doneItem.id, summary: [] },
	} as ResponseStreamEvent;
	yield {
		type: "response.output_item.done",
		output_index: 0,
		sequence_number: 1,
		item: doneItem,
	} as ResponseStreamEvent;
	yield {
		type: "response.completed",
		sequence_number: 2,
		response: {
			id: "resp_test",
			status: "completed",
			output: [completedItem],
		},
	} as ResponseStreamEvent;
}

/** 功能：把助手消息放入下一轮上下文并取回推理项；参数 model、assistant；返回：首个 reasoning 输入或 undefined。示例：getReplayedReasoning(model, output)。 */
function getReplayedReasoning(model: Model<"azure-openai-responses">, assistant: AssistantMessage) {
	// 模拟“用户—助手—追问”的回放上下文；时间戳只用于保持消息顺序。
	const context: Context = {
		messages: [
			{ role: "user", content: "first", timestamp: Date.now() - 1 },
			assistant,
			{ role: "user", content: "follow-up", timestamp: Date.now() },
		],
	};
	// 转换后的 Azure Responses 输入数组，仅用于寻找 reasoning 项。
	const input = convertResponsesMessages(model, context, new Set(["azure-openai-responses"]));
	return input.find((item) => item.type === "reasoning");
}

describe("Azure OpenAI Responses reasoning replay", () => {
	it("preserves existing encrypted_content from output_item.done", async () => {
		// 本用例使用的 Azure 测试模型。
		const model = createModel();
		// 将由事件处理器写入内容的助手消息。
		const output = createOutput(model);
		// output_item.done 阶段已携带密文的推理项，应具有最高保留优先级。
		const doneItem: ResponseReasoningItem = {
			type: "reasoning",
			id: "rs_done",
			summary: [],
			encrypted_content: "from-output-item-done",
		};
		// response.completed 阶段同 id 但不同密文的推理项，不应覆盖已有值。
		const completedItem: ResponseReasoningItem = {
			...doneItem,
			encrypted_content: "from-response-completed",
		};

		await processResponsesStream(
			createEvents(doneItem, completedItem),
			output,
			new AssistantMessageEventStream(),
			model,
		);

		expect(getReplayedReasoning(model, output)).toMatchObject({
			type: "reasoning",
			id: "rs_done",
			encrypted_content: "from-output-item-done",
		});
	});

	it("fills encrypted_content when output_item.done omitted it", async () => {
		// 本用例使用的 Azure 测试模型。
		const model = createModel();
		// 将由事件处理器写入内容的助手消息。
		const output = createOutput(model);
		// done 阶段缺少 encrypted_content 的推理项。
		const doneItem: ResponseReasoningItem = {
			type: "reasoning",
			id: "rs_missing",
			summary: [],
		};
		// completed 阶段提供可用于补全的密文。
		const completedItem: ResponseReasoningItem = {
			...doneItem,
			encrypted_content: "from-response-completed",
		};

		await processResponsesStream(
			createEvents(doneItem, completedItem),
			output,
			new AssistantMessageEventStream(),
			model,
		);

		expect(getReplayedReasoning(model, output)).toMatchObject({
			type: "reasoning",
			id: "rs_missing",
			encrypted_content: "from-response-completed",
		});
	});
});
