/**
 * 文件职责：验证会话压缩前的文本序列化只截断过长工具结果，不截断用户或助手消息。
 * 技术维度：使用 Vitest、统一 Message 类型和 serializeConversation 纯函数进行边界测试。
 * 产品维度：控制压缩提示词体积，同时保留对话双方的完整语义，减少摘要失真。
 * 逻辑维度：分别构造长工具结果、短工具结果和长对话消息，检查序列化文本。
 * 关键边界：当前截断阈值通过 2000/3000 字符断言锁定，调整策略时需同步更新用例。
 * 新手阅读建议：按三个用例依次比较，重点观察相同长度内容在不同消息角色下的差异。
 */
import type { Message } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import { serializeConversation } from "../src/core/compaction/utils.ts";

describe("serializeConversation", () => {
	// 验证 5000 字符的工具结果保留前段并标注剩余截断量；无参数，无返回值。
	it("should truncate long tool results", () => {
		// longContent 是超过工具结果截断阈值的测试文本。
		const longContent = "x".repeat(5000);
		// messages 只包含一条长文本工具结果消息。
		const messages: Message[] = [
			{
				role: "toolResult",
				toolCallId: "tc1",
				toolName: "read",
				content: [{ type: "text", text: longContent }],
				isError: false,
				timestamp: Date.now(),
			},
		];

		// result 是用于压缩摘要输入的序列化对话文本。
		const result = serializeConversation(messages);

		expect(result).toContain("[Tool result]:");
		expect(result).toContain("[... 3000 more characters truncated]");
		expect(result).not.toContain("x".repeat(3000));
		// First 2000 chars should be present
		// 前 2000 个字符应该完整保留。
		expect(result).toContain("x".repeat(2000));
	});

	// 验证低于阈值的工具结果保持完整且不出现截断标记；无参数，无返回值。
	it("should not truncate short tool results", () => {
		// shortContent 是低于截断阈值的 1500 字符文本。
		const shortContent = "x".repeat(1500);
		// messages 只包含一条短文本工具结果消息。
		const messages: Message[] = [
			{
				role: "toolResult",
				toolCallId: "tc1",
				toolName: "read",
				content: [{ type: "text", text: shortContent }],
				isError: false,
				timestamp: Date.now(),
			},
		];

		// result 是预期完整包含 shortContent 的序列化文本。
		const result = serializeConversation(messages);

		expect(result).toBe(`[Tool result]: ${shortContent}`);
		expect(result).not.toContain("truncated");
	});

	// 验证用户和助手的长文本不会套用工具结果截断规则；无参数，无返回值。
	it("should not truncate assistant or user messages", () => {
		// longText 是同时用于用户和助手消息的 5000 字符文本。
		const longText = "y".repeat(5000);
		// messages 包含一条用户消息和一条助手消息，用于覆盖两个角色。
		const messages: Message[] = [
			{
				role: "user",
				content: [{ type: "text", text: longText }],
				timestamp: Date.now(),
			},
			{
				role: "assistant",
				content: [{ type: "text", text: longText }],
				api: "anthropic",
				provider: "anthropic",
				model: "test",
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
		];

		// result 是同时包含两条长消息的序列化文本。
		const result = serializeConversation(messages);

		expect(result).not.toContain("truncated");
		expect(result).toContain(longText);
	});
});
