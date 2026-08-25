/**
 * 文件职责：验证 OpenAI Responses 流必须以 completed/incomplete/failed 终止，并正确生成最终状态和用量。
 * 技术维度：使用 Vitest、模拟 OpenAI SDK、手工 ResponseStreamEvent 异步生成器和 AssistantMessageEventStream 测试流处理器。
 * 产品维度：避免上游连接提前结束时把部分推理误报为成功，并准确显示长度停止、错误和计费用量。
 * 逻辑维度：构造早停与三类终态事件，分别测试底层处理器和公开 stream 包装器的错误传播与最终消息。
 * 关键边界：没有终态事件必须视为错误；completed/incomplete 用量需扣分缓存读取/写入；failed 应抛提供商错误。
 * 新手阅读建议：先看四个事件生成器，再比较 processResponsesStream 对 output 的原地更新和包装流的最终事件。
 */
import type { ResponseStreamEvent } from "openai/resources/responses/responses.js";
import { describe, expect, it, vi } from "vitest";
import { stream as streamOpenAIResponses } from "../src/api/openai-responses.ts";
import { processResponsesStream } from "../src/api/openai-responses-shared.ts";
import type { AssistantMessage, AssistantMessageEvent, Context, Model } from "../src/types.ts";
import { AssistantMessageEventStream } from "../src/utils/event-stream.ts";

// 模拟 OpenAI SDK 返回一个在部分 reasoning 后提前 EOF 的响应流。
vi.mock("openai", () => {
	/** 生成包装器早停所需的 created、reasoning item 和 delta；无参数；返回异步事件流。 */
	async function* createMockResponsesStream(): AsyncIterable<ResponseStreamEvent> {
		yield {
			type: "response.created",
			sequence_number: 0,
			response: { id: "resp_wrapper_early_eof" },
		} as ResponseStreamEvent;
		yield {
			type: "response.output_item.added",
			sequence_number: 1,
			output_index: 0,
			item: { type: "reasoning", id: "rs_wrapper_early_eof", summary: [] },
		} as ResponseStreamEvent;
		yield {
			type: "response.reasoning_text.delta",
			sequence_number: 2,
			output_index: 0,
			content_index: 0,
			item_id: "rs_wrapper_early_eof",
			delta: "partial reasoning before the wrapper stream ends",
		} as ResponseStreamEvent;
	}

	/** FakeOpenAI 只实现 responses.create，并返回支持 withResponse 的早停流。 */
	class FakeOpenAI {
		// responses 模拟 SDK Responses 资源。
		responses = {
			create: () => {
				// responseStream 是本次 create 独占的早停异步流。
				const responseStream = createMockResponsesStream();
				// promise 同时兼容直接 await 和 SDK withResponse 调用方式。
				const promise = Promise.resolve(responseStream) as Promise<AsyncIterable<ResponseStreamEvent>> & {
					withResponse: () => Promise<{
						data: AsyncIterable<ResponseStreamEvent>;
						response: { status: number; headers: Headers };
					}>;
				};
				promise.withResponse = async () => ({
					data: responseStream,
					response: { status: 200, headers: new Headers() },
				});
				return promise;
			},
		};
	}

	return { default: FakeOpenAI };
});

/** 构造固定 OpenAI Responses 推理模型；无参数；返回 Model。 */
function createModel(): Model<"openai-responses"> {
	return {
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
}

/** 构造待流处理器原地填充的空助手消息；参数 model 为来源模型；返回 AssistantMessage。 */
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
		stopReason: "stop",
		timestamp: Date.now(),
	};
}

/** 生成包含部分推理但没有终态的事件序列；无参数；返回异步事件流。 */
async function* createEarlyEofEvents(): AsyncIterable<ResponseStreamEvent> {
	yield {
		type: "response.created",
		sequence_number: 0,
		response: { id: "resp_early_eof" },
	} as ResponseStreamEvent;
	yield {
		type: "response.output_item.added",
		sequence_number: 1,
		output_index: 0,
		item: { type: "reasoning", id: "rs_early_eof", summary: [] },
	} as ResponseStreamEvent;
	yield {
		type: "response.reasoning_text.delta",
		sequence_number: 2,
		output_index: 0,
		content_index: 0,
		item_id: "rs_early_eof",
		delta: "partial reasoning before the stream ends",
	} as ResponseStreamEvent;
}

/** 生成带完整用量的 response.completed 事件；无参数；返回异步事件流。 */
async function* createCompletedEvents(): AsyncIterable<ResponseStreamEvent> {
	yield {
		type: "response.completed",
		sequence_number: 0,
		response: {
			id: "resp_completed",
			status: "completed",
			usage: {
				input_tokens: 20,
				output_tokens: 7,
				total_tokens: 27,
				input_tokens_details: { cached_tokens: 2, cache_write_tokens: 3 },
			},
		},
	} as unknown as ResponseStreamEvent;
}

/** 生成带长度停止用量的 response.incomplete 事件；无参数；返回异步事件流。 */
async function* createIncompleteEvents(): AsyncIterable<ResponseStreamEvent> {
	yield {
		type: "response.incomplete",
		sequence_number: 0,
		response: {
			id: "resp_incomplete",
			status: "incomplete",
			usage: {
				input_tokens: 30,
				output_tokens: 12,
				total_tokens: 42,
				input_tokens_details: { cached_tokens: 5 },
			},
		},
	} as ResponseStreamEvent;
}

/** 生成带 server_error 的 response.failed 事件；无参数；返回异步事件流。 */
async function* createFailedEvents(): AsyncIterable<ResponseStreamEvent> {
	yield {
		type: "response.failed",
		sequence_number: 0,
		response: {
			id: "resp_failed",
			status: "failed",
			error: { code: "server_error", message: "boom" },
		},
	} as ResponseStreamEvent;
}

// 验证 OpenAI Responses 流终态识别、错误传播和用量结算。
describe("OpenAI Responses terminal event handling", () => {
	// 底层事件流 EOF 前没有终态时应拒绝 Promise。
	it("rejects streams that end before a terminal response event", async () => {
		// model 是流处理器用于计费和元数据的测试模型。
		const model = createModel();
		// output 是待处理器填充的助手消息。
		const output = createOutput(model);
		// stream 接收处理器发出的统一助手事件。
		const stream = new AssistantMessageEventStream();

		await expect(processResponsesStream(createEarlyEofEvents(), output, stream, model)).rejects.toThrow(
			"OpenAI Responses stream ended before a terminal response event",
		);
	});

	// 公开包装流应把早停异常转换为 error 终态和错误结果，而不是悬挂。
	it("emits an error final result when the wrapper stream ends before a terminal response event", async () => {
		// model 是伪 SDK 请求使用的测试模型。
		const model = createModel();
		// context 是公开流所需的最小用户上下文。
		const context: Context = {
			systemPrompt: "",
			messages: [{ role: "user", content: [{ type: "text", text: "hi" }], timestamp: 0 }],
			tools: [],
		};
		// stream 是通过伪 OpenAI SDK 创建的公开 Responses 流。
		const stream = streamOpenAIResponses(model, context, { apiKey: "test" });
		// events 收集包装器输出的全部统一事件。
		const events: AssistantMessageEvent[] = [];

		/** event 是包装流当前产出的统一事件；循环完整收集后再检查终止顺序。 */
		for await (const event of stream) {
			events.push(event);
		}

		// result 是包装流最终返回的错误助手消息。
		const result = await stream.result();
		// lastEvent 是流最后一个事件，必须为 error。
		const lastEvent = events.at(-1);
		expect(lastEvent?.type).toBe("error");
		expect(result.stopReason).toBe("error");
		expect(result.errorMessage).toBe("OpenAI Responses stream ended before a terminal response event");
	});

	// completed 终态应保存 responseId、stop 原因和拆分后的缓存用量。
	it("finalizes completed terminal events as stop", async () => {
		// model、output、stream 构成底层处理器依赖。
		const model = createModel();
		const output = createOutput(model);
		const stream = new AssistantMessageEventStream();
		/** stream 接收 completed 序列转换出的统一事件，并保存最终结果供断言。 */

		await processResponsesStream(createCompletedEvents(), output, stream, model);

		expect(output.responseId).toBe("resp_completed");
		expect(output.stopReason).toBe("stop");
		expect(output.usage).toMatchObject({
			input: 15,
			output: 7,
			cacheRead: 2,
			cacheWrite: 3,
			totalTokens: 27,
		});
	});

	// incomplete 终态应映射为 length 停止并保留用量。
	it("finalizes incomplete terminal events as length stops", async () => {
		// model、output、stream 用于处理 incomplete 序列。
		const model = createModel();
		const output = createOutput(model);
		const stream = new AssistantMessageEventStream();
		/** stream 接收 incomplete 序列；本用例重点确认不完整原因被保留。 */

		await processResponsesStream(createIncompleteEvents(), output, stream, model);

		expect(output.responseId).toBe("resp_incomplete");
		expect(output.stopReason).toBe("length");
		expect(output.usage).toMatchObject({
			input: 25,
			output: 12,
			cacheRead: 5,
			cacheWrite: 0,
			totalTokens: 42,
		});
	});

	// failed 终态应以提供商 code/message 拒绝处理 Promise。
	it("rejects failed terminal events with the provider error", async () => {
		// model、output、stream 用于处理 failed 序列。
		const model = createModel();
		const output = createOutput(model);
		const stream = new AssistantMessageEventStream();
		/** stream 接收 failed 序列；处理器应将服务端错误转换为拒绝结果。 */

		await expect(processResponsesStream(createFailedEvents(), output, stream, model)).rejects.toThrow(
			"server_error: boom",
		);
	});
});
