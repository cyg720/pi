/**
 * 文件职责：验证消息 content 为 null 或缺失时，提供方请求前会宽松规范化为空数组。
 * 技术维度：使用 Vitest、非类型安全历史消息夹具和 transformMessages 转换入口。
 * 产品维度：兼容旧会话、手写历史和自定义工具产生的不完整消息，避免请求前崩溃。
 * 逻辑维度：构造仅文本模型和三种坏消息，转换后逐条检查 content 等于空数组。
 * 关键边界：宽松行为只用于提供方请求前的防御；公开 Message 类型仍要求 content 存在。
 * 新手阅读建议：先读现有英文背景，再比较强类型契约与 unknown 强制输入的差异。
 */
/**
 * The Message types require `content` to always be present, but untyped
 * callers (custom tools, hand-built histories, old session files) can violate
 * that contract. `transformMessages` is the choke point before every provider
 * request and is intentionally lax: it normalizes null/missing content to an
 * empty array (issues #6259, #6276).
 */
/**
 * Message 类型要求 content 存在，但无类型调用方可能违反契约；transformMessages 会在请求前把
 * null 或缺失 content 规范化为空数组，以兼容第 6259、6276 号问题中的旧数据。
 */

import { describe, expect, it } from "vitest";
import { transformMessages } from "../src/api/transform-messages.ts";
import type { Message, Model } from "../src/types.ts";

// Text-only model so the image downgrade path (replaceImagesWithPlaceholder) runs,
// 使用纯文本模型以触发图片降级路径 replaceImagesWithPlaceholder，
// which was the primary crash site for null tool result content.
// 该路径曾是空工具结果 content 崩溃的主要位置。
/** @returns 固定的纯文本 OpenAI Completions 模型夹具。 */
function makeTextOnlyModel(): Model<"openai-completions"> {
	return {
		id: "test-model",
		name: "Test Model",
		api: "openai-completions",
		provider: "openai",
		baseUrl: "https://example.invalid/v1",
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128000,
		maxTokens: 16000,
	};
}

/** 宽松消息 content 处理测试组。 */
describe("lax message content handling", () => {
	/** 验证用户、助手和工具结果的坏 content 均被规范化为空数组。 */
	it("normalizes null/missing content to an empty array instead of crashing", () => {
		/** 故意违反 Message 类型契约的三条历史消息。 */
		const messages = [
			{ role: "user", content: null, timestamp: Date.now() },
			{
				role: "assistant",
				content: null,
				api: "openai-completions",
				provider: "openai",
				model: "test-model",
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
			},
			{
				role: "toolResult",
				toolCallId: "call_1",
				toolName: "web_search",
				isError: false,
				timestamp: Date.now(),
			},
		] as unknown as Message[];

		/** 经过防御性转换的消息数组。 */
		const result = transformMessages(messages, makeTextOnlyModel());

		expect(result).toHaveLength(3);
		// msg 是转换后的当前消息，content 必须统一为空数组。
		for (const msg of result) {
			expect(msg.content).toEqual([]);
		}
	});
});
