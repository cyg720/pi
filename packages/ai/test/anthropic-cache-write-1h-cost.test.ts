/**
 * 文件职责：验证 Anthropic 一小时缓存写入令牌按 2 倍输入费率计价，缺少明细时回退五分钟费率。
 * 技术维度：使用 Vitest、模拟 SSE Response、假 Anthropic 客户端和真实流解析逻辑。
 * 产品维度：保证缓存成本统计准确，帮助用户评估长缓存的费用收益。
 * 逻辑维度：构造包含缓存用量的事件序列，分别提供 5m/1h 明细或仅总量后断言费用。
 * 关键边界：使用一百万令牌便于计算；不访问网络，模型费率来自当前目录配置。
 * 新手阅读建议：先看 eventsWithCacheCreation 的 usage，再按注释公式核对两个用例。
 */
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { stream as streamAnthropic } from "../src/api/anthropic-messages.ts";
import { getModel } from "../src/compat.ts";
import type { Context } from "../src/types.ts";

/** 把事件数组编码成 SSE Response；events 为事件和 JSON 数据，返回状态 200 响应。 */
function createSseResponse(events: Array<{ event: string; data: string }>): Response {
	// body 是符合 SSE 格式的连续事件文本。
	const body = events.map(({ event, data }) => `event: ${event}\ndata: ${data}\n`).join("\n");
	return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

/** 创建 messages.create().asResponse() 返回固定响应的假客户端。 */
function createFakeAnthropicClient(response: Response): Anthropic {
	return {
		messages: { create: () => ({ asResponse: async () => response }) },
	} as unknown as Anthropic;
}

/** 构造带一百万缓存写入令牌的完整事件数组；cacheCreation 为可选 5m/1h 明细。 */
function eventsWithCacheCreation(
	cacheCreation: Record<string, number> | undefined,
): Array<{ event: string; data: string }> {
	// startUsage 是 message_start 携带的初始用量对象。
	const startUsage: Record<string, unknown> = {
		input_tokens: 100,
		output_tokens: 0,
		cache_read_input_tokens: 0,
		cache_creation_input_tokens: 1_000_000,
	};
	if (cacheCreation) startUsage.cache_creation = cacheCreation;
	return [
		{
			event: "message_start",
			data: JSON.stringify({ type: "message_start", message: { id: "msg_test", usage: startUsage } }),
		},
		{
			event: "content_block_start",
			data: JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }),
		},
		{
			event: "content_block_delta",
			data: JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hi" } }),
		},
		{ event: "content_block_stop", data: JSON.stringify({ type: "content_block_stop", index: 0 }) },
		{
			event: "message_delta",
			data: JSON.stringify({
				type: "message_delta",
				delta: { stop_reason: "end_turn" },
				usage: {
					input_tokens: 100,
					output_tokens: 5,
					cache_read_input_tokens: 0,
					cache_creation_input_tokens: 1_000_000,
				},
			}),
		},
		{ event: "message_stop", data: JSON.stringify({ type: "message_stop" }) },
	];
}

// claude-opus-4-8: input 5, cacheWrite (5m) 6.25 per Mtok. 1h write = 2x input = 10.
// Claude Opus 4.8：输入 5 美元/百万令牌，5m 缓存写入 6.25，1h 写入为输入价 2 倍即 10。
// context 是触发一次请求的最小固定用户上下文。
const context: Context = { messages: [{ role: "user", content: "hi", timestamp: Date.now() }] };

describe("Anthropic 1h cache write cost", () => {
	// 验证 1h 部分按 10/Mtok，其余按 6.25/Mtok；无参数，无返回值。
	it("prices the 1h portion at 2x input and the rest at the 5m rate", async () => {
		// model 是当前目录中的 Claude Opus 4.8 配置。
		const model = getModel("anthropic", "claude-opus-4-8");
		// response 含 60 万 5m 和 40 万 1h 写入明细。
		const response = createSseResponse(
			eventsWithCacheCreation({ ephemeral_5m_input_tokens: 600_000, ephemeral_1h_input_tokens: 400_000 }),
		);
		// result 是流解析器计算用量和费用后的助手结果。
		const result = await streamAnthropic(model, context, { client: createFakeAnthropicClient(response) }).result();

		expect(result.usage.cacheWrite).toBe(1_000_000);
		expect(result.usage.cacheWrite1h).toBe(400_000);
		// 600k * 6.25/Mtok + 400k * 10/Mtok = 3.75 + 4.0 = 7.75
		// 60 万×6.25/百万 + 40 万×10/百万 = 7.75。
		expect(result.usage.cost.cacheWrite).toBeCloseTo(7.75, 10);
	});

	// 验证缺少缓存明细时全部按 5m 费率计算；无参数，无返回值。
	it("falls back to the 5m rate when no breakdown is reported", async () => {
		// model 是 Claude Opus 4.8 配置。
		const model = getModel("anthropic", "claude-opus-4-8");
		// response 只报告缓存写入总量。
		const response = createSseResponse(eventsWithCacheCreation(undefined));
		// result 是回退费率计算后的助手结果。
		const result = await streamAnthropic(model, context, { client: createFakeAnthropicClient(response) }).result();

		expect(result.usage.cacheWrite).toBe(1_000_000);
		expect(result.usage.cacheWrite1h ?? 0).toBe(0);
		// 1M * 6.25/Mtok = 6.25
		// 100 万×6.25/百万 = 6.25。
		expect(result.usage.cost.cacheWrite).toBeCloseTo(6.25, 10);
	});
});
