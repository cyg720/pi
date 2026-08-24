/**
 * 文件职责：验证 Anthropic 原始 SSE 流对畸形 JSON、拒绝详情、缺失用量和尾随未知事件的解析。
 * 技术维度：使用 Vitest、Web Response、假 Anthropic 客户端与真实流适配器构造内存 SSE 集成测试。
 * 产品维度：保证代理在网关转义异常或服务端扩展事件下仍能得到正确工具参数、错误原因和用量。
 * 逻辑维度：createSseResponse 组装事件流，假客户端返回响应，各用例消费流并断言标准助手结果。
 * 关键边界：不访问真实 Anthropic；畸形内容只覆盖解析器允许修复的反斜杠和制表符情况。
 * 新手阅读建议：先看 minimalAnthropicEvents 的标准序列，再对比首个畸形工具流和其余边界用例。
 */
import type Anthropic from "@anthropic-ai/sdk";
import { Type } from "typebox";
import { describe, expect, it } from "vitest";
import { stream as streamAnthropic } from "../src/api/anthropic-messages.ts";
import { getModel } from "../src/compat.ts";
import type { Context, ToolCall } from "../src/types.ts";

/**
 * 把事件名和 data 文本序列编码为标准 SSE Response。
 * @param events 按接收顺序排列的 SSE 事件。
 * @returns content-type 为 text/event-stream 的内存响应。
 * @example createSseResponse([{ event: "message_stop", data: "{}" }]);
 */
function createSseResponse(events: Array<{ event: string; data: string }>): Response {
	/** 每个事件之间以空行分隔的 SSE 正文。 */
	const body = events.map(({ event, data }) => `event: ${event}\ndata: ${data}\n`).join("\n");
	return new Response(body, {
		status: 200,
		headers: { "content-type": "text/event-stream" },
	});
}

/** 最小成功 Anthropic 事件序列，产出文本 Hello 和固定输入用量。 */
const minimalAnthropicEvents = [
	{
		event: "message_start",
		data: JSON.stringify({
			type: "message_start",
			message: {
				id: "msg_test",
				usage: {
					input_tokens: 12,
					output_tokens: 0,
					cache_read_input_tokens: 0,
					cache_creation_input_tokens: 0,
				},
			},
		}),
	},
	{
		event: "content_block_start",
		data: JSON.stringify({
			type: "content_block_start",
			index: 0,
			content_block: { type: "text", text: "" },
		}),
	},
	{
		event: "content_block_delta",
		data: JSON.stringify({
			type: "content_block_delta",
			index: 0,
			delta: { type: "text_delta", text: "Hello" },
		}),
	},
	{
		event: "content_block_stop",
		data: JSON.stringify({ type: "content_block_stop", index: 0 }),
	},
	{
		event: "message_delta",
		data: JSON.stringify({
			type: "message_delta",
			delta: { stop_reason: "end_turn" },
			usage: {
				input_tokens: 12,
				output_tokens: 5,
				cache_read_input_tokens: 0,
				cache_creation_input_tokens: 0,
			},
		}),
	},
	{
		event: "message_stop",
		data: JSON.stringify({ type: "message_stop" }),
	},
];

/**
 * 创建只返回指定 Response 的最小 Anthropic 客户端替身。
 * @param response messages.create().asResponse() 应返回的响应。
 * @returns 类型兼容的 Anthropic 客户端。
 * @example createFakeAnthropicClient(createSseResponse(events));
 */
function createFakeAnthropicClient(response: Response): Anthropic {
	return {
		messages: {
			create: () => ({
				asResponse: async () => response,
			}),
		},
	} as unknown as Anthropic;
}

/** 覆盖 Anthropic 原始 SSE 解析和标准助手消息归一化。 */
describe("Anthropic raw SSE parsing", () => {
	it("repairs malformed SSE JSON and malformed streamed tool JSON", async () => {
		/** 支持工具调用的被测 Anthropic 模型。 */
		const model = getModel("anthropic", "claude-haiku-4-5");
		/** 声明 edit 工具的最小用户会话。 */
		const context: Context = {
			messages: [{ role: "user", content: "Use the edit tool.", timestamp: Date.now() }],
			tools: [
				{
					name: "edit",
					description: "Edit a file.",
					parameters: Type.Object({
						path: Type.String(),
						text: Type.String(),
					}),
				},
			],
		};

		/** 同时包含非法反斜杠转义与原始制表符的工具参数 SSE 数据。 */
		const malformedToolJsonDelta = String.raw`{"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\"path\":\"A\H\",\"text\":\"col1	col2\"}"}}`;

		/** 包含畸形工具增量的完整 SSE 响应。 */
		const response = createSseResponse([
			{
				event: "message_start",
				data: JSON.stringify({
					type: "message_start",
					message: {
						id: "msg_test",
						usage: {
							input_tokens: 12,
							output_tokens: 0,
							cache_read_input_tokens: 0,
							cache_creation_input_tokens: 0,
						},
					},
				}),
			},
			{
				event: "content_block_start",
				data: JSON.stringify({
					type: "content_block_start",
					index: 0,
					content_block: {
						type: "tool_use",
						id: "toolu_test",
						name: "edit",
						input: {},
					},
				}),
			},
			{ event: "content_block_delta", data: malformedToolJsonDelta },
			{
				event: "content_block_stop",
				data: JSON.stringify({ type: "content_block_stop", index: 0 }),
			},
			{
				event: "message_delta",
				data: JSON.stringify({
					type: "message_delta",
					delta: { stop_reason: "tool_use" },
					usage: {
						input_tokens: 12,
						output_tokens: 5,
						cache_read_input_tokens: 0,
						cache_creation_input_tokens: 0,
					},
				}),
			},
			{
				event: "message_stop",
				data: JSON.stringify({ type: "message_stop" }),
			},
		]);

		/** 使用假客户端创建的标准 Anthropic 消息流。 */
		const stream = streamAnthropic(model, context, {
			client: createFakeAnthropicClient(response),
		});
		/** 消费全部 SSE 后得到的助手消息。 */
		const result = await stream.result();

		expect(result.stopReason).toBe("toolUse");
		expect(result.errorMessage).toBeUndefined();

		/** 从助手内容中提取修复后的工具调用。 */
		const toolCall = result.content.find((block): block is ToolCall => block.type === "toolCall");
		expect(toolCall).toBeDefined();
		expect(toolCall?.arguments).toEqual({
			path: "A\\H",
			text: "col1\tcol2",
		});
	});

	it("preserves refusal stop details from message_delta", async () => {
		/** 会返回安全拒绝详情的模型。 */
		const model = getModel("anthropic", "claude-fable-5");
		/** 触发拒绝场景的最小上下文。 */
		const context: Context = {
			messages: [{ role: "user", content: "blocked request", timestamp: Date.now() }],
		};
		/** 服务端 stop_details 中提供的完整拒绝说明。 */
		const explanation =
			"This request triggered restrictions on violative cyber content and was blocked under Anthropic's Usage Policy. To learn more, provide feedback, or request an exemption based on how you use Claude, visit our help center: https://support.claude.com/en/articles/14604842-real-time-cyber-safeguards-on-claude.";
		/** 只包含开始、拒绝增量和结束事件的响应。 */
		const response = createSseResponse([
			{
				event: "message_start",
				data: JSON.stringify({
					type: "message_start",
					message: {
						id: "msg_01XFUDYJgAACzvnptvVoYEL",
						usage: {
							input_tokens: 412,
							output_tokens: 0,
							cache_read_input_tokens: 0,
							cache_creation_input_tokens: 0,
						},
					},
				}),
			},
			{
				event: "message_delta",
				data: JSON.stringify({
					type: "message_delta",
					delta: {
						stop_reason: "refusal",
						stop_details: {
							type: "refusal",
							category: "cyber",
							explanation,
						},
					},
					usage: {
						input_tokens: 412,
						output_tokens: 0,
						cache_read_input_tokens: 0,
						cache_creation_input_tokens: 0,
					},
				}),
			},
			{
				event: "message_stop",
				data: JSON.stringify({ type: "message_stop" }),
			},
		]);

		/** 拒绝场景的 Anthropic 消息流。 */
		const stream = streamAnthropic(model, context, {
			client: createFakeAnthropicClient(response),
		});
		/** 应被归一化为 error 的拒绝结果。 */
		const result = await stream.result();

		expect(result.stopReason).toBe("error");
		expect(result.errorMessage).toBe(explanation);
	});

	it("treats message_delta without usage as a no-op for usage accumulation", async () => {
		/** 缺失 message_delta 用量场景的模型。 */
		const model = getModel("anthropic", "claude-haiku-4-5");
		/** 请求简单文本回复的上下文。 */
		const context: Context = {
			messages: [{ role: "user", content: "Say hello.", timestamp: Date.now() }],
		};
		/** 从标准序列移除 message_delta.usage 后得到的 SSE 响应。 */
		const response = createSseResponse(
			minimalAnthropicEvents.map((event) =>
				event.event === "message_delta"
					? {
							event: "message_delta",
							data: JSON.stringify({ type: "message_delta", delta: { stop_reason: "end_turn" } }),
						}
					: event,
			),
		);

		/** 缺失增量用量场景的消息流。 */
		const stream = streamAnthropic(model, context, {
			client: createFakeAnthropicClient(response),
		});
		/** 用量应只累计 message_start 的结果。 */
		const result = await stream.result();

		expect(result.stopReason).toBe("stop");
		expect(result.errorMessage).toBeUndefined();
		expect(result.content).toEqual([{ type: "text", text: "Hello" }]);
		expect(result.usage.input).toBe(12);
		expect(result.usage.totalTokens).toBe(12);
	});

	it("ignores unknown SSE events after message_stop", async () => {
		/** 尾随未知事件场景的模型。 */
		const model = getModel("anthropic", "claude-haiku-4-5");
		/** 请求简单文本回复的上下文。 */
		const context: Context = {
			messages: [{ role: "user", content: "Say hello.", timestamp: Date.now() }],
		};
		/** 在 message_stop 后追加非 JSON 代理事件的响应。 */
		const response = createSseResponse([
			...minimalAnthropicEvents,
			{ event: "done", data: "[DONE]" },
			{ event: "proxy.stats", data: "not json" },
		]);

		/** 带尾随事件的消息流。 */
		const stream = streamAnthropic(model, context, {
			client: createFakeAnthropicClient(response),
		});
		/** 未知尾随事件不应改变的成功结果。 */
		const result = await stream.result();

		expect(result.stopReason).toBe("stop");
		expect(result.errorMessage).toBeUndefined();
		expect(result.content).toEqual([{ type: "text", text: "Hello" }]);
	});
});
