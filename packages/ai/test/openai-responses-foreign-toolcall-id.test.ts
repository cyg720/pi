/**
 * 文件职责：验证来自 Copilot 的超长异构工具调用 ID 会规范化为 Codex 安全的短 ID。
 * 技术维度：使用 Vitest、Responses 消息转换、短哈希和跨提供方历史消息夹具。
 * 产品维度：让 Copilot 历史工具调用可在 OpenAI Codex 会话中重放，不因 ID 格式被拒绝。
 * 逻辑维度：构造工具调用与结果，转换上下文，找到 function_call 后检查哈希、长度和字符集。
 * 关键边界：只对竖线后的外部 item ID 哈希；安全 ID 最长 64 且只含字母数字。
 * 新手阅读建议：先看原始 ID 的竖线分段，再比较 expectedItemId 的生成公式。
 */
import { describe, expect, it } from "vitest";
import { convertResponsesMessages } from "../src/api/openai-responses-shared.ts";
import { getModel } from "../src/compat.ts";
import type { AssistantMessage, Context, ToolResultMessage, Usage } from "../src/types.ts";
import { shortHash } from "../src/utils/hash.ts";

/** Copilot 返回的代表性超长原始工具调用 ID。 */
const COPILOT_RAW_TOOL_CALL_ID =
	"call_4VnzVawQXPB9MgYib7CiQFEY|I9b95oN1wD/cHXKTw3PpRkL6KkCtzTJhUxMouMWYwHeTo2j3htzfSk7YPx2vifiIM4g3A8XXyOj8q4Bt6SLUG7gqY1E3ELkrkVQNHglRfUmWj84lqxJY+Puieb3VKyX0FB+83TUzn91cDMF/4gzt990IzqVrc+nIb9RRscRD070Du16q1glydVjWR0SBJsE6TbY/esOjFpqplogQqrajm1eI++f3eLi73R6q7hVusY0QbeFySVxABCjhN0lXB04caBe1rzHjYzul6MAXj7uq+0r17VLq+yrtyYhN12wkmFqHeqTyEei6EFPbMy24Nc+IbJlkP0OCg02W+gOnyBFcbi2ctvJFSOhSjt1CqBdqCnnhwUqXjbWiT0wh3DmLScRgTHmGkaI+oAcQQjfic65nxj+TnEkReA==";

/** 满足历史助手消息结构的零用量夹具。 */
const usage: Usage = {
	input: 0,
	output: 0,
	cacheRead: 0,
	cacheWrite: 0,
	totalTokens: 0,
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

/** 外部工具调用 ID 规范化测试组。 */
describe("OpenAI Responses foreign tool call ID normalization", () => {
	/** 验证外部 ID 转为 `fc_<hash>`，且长度和字符集符合 Codex 约束。 */
	it("hashes foreign Copilot tool item IDs into a bounded Codex-safe fc_<hash> shape", () => {
		/** 作为目标格式的 OpenAI Codex 模型。 */
		const model = getModel("openai-codex", "gpt-5.5");
		/** 使用 Copilot 原始工具 ID 的历史助手消息。 */
		const assistant: AssistantMessage = {
			role: "assistant",
			content: [
				{
					type: "toolCall",
					id: COPILOT_RAW_TOOL_CALL_ID,
					name: "edit",
					arguments: { path: "src/styles/app.css" },
				},
			],
			api: "openai-responses",
			provider: "github-copilot",
			model: "gpt-5.5",
			usage,
			stopReason: "toolUse",
			timestamp: Date.now() - 2000,
		};
		/** 与同一原始 ID 配对的工具结果。 */
		const toolResult: ToolResultMessage = {
			role: "toolResult",
			toolCallId: COPILOT_RAW_TOOL_CALL_ID,
			toolName: "edit",
			content: [{ type: "text", text: "ok" }],
			isError: false,
			timestamp: Date.now() - 1000,
		};
		/** 用户、助手工具调用和工具结果组成的跨提供方上下文。 */
		const context: Context = {
			systemPrompt: "You are concise.",
			messages: [{ role: "user", content: "Use the tool.", timestamp: Date.now() - 3000 }, assistant, toolResult],
		};

		/** 转换后的 Responses 输入项。 */
		const input = convertResponsesMessages(model, context, new Set(["openai", "openai-codex", "opencode"]));
		/** 转换结果中的函数调用项。 */
		const functionCall = input.find((item) => item.type === "function_call");

		expect(functionCall).toBeDefined();
		expect(functionCall?.type).toBe("function_call");
		if (!functionCall || functionCall.type !== "function_call") {
			throw new Error("Expected function_call item");
		}

		/** 用竖线后外部 item ID 计算出的期望安全 ID。 */
		const expectedItemId = `fc_${shortHash(COPILOT_RAW_TOOL_CALL_ID.split("|")[1]!)}`;
		expect(functionCall.id).toBe(expectedItemId);
		expect(functionCall.id?.length ?? 0).toBeLessThanOrEqual(64);
		expect(functionCall.id).toMatch(/^fc_[A-Za-z0-9]+$/);
	});
});
