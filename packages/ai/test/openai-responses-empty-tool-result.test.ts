/**
 * 文件职责：验证空文本工具结果转换到 OpenAI Responses 时使用明确占位文本。
 * 技术维度：使用 Vitest、消息夹具和 convertResponsesMessages 纯转换函数。
 * 产品维度：避免 API 收到无效空输出，同时不错误提示存在图片附件。
 * 逻辑维度：构造工具调用和空结果上下文，转换后查找 function_call_output 并检查文本。
 * 关键边界：只覆盖无图片的空文本结果；不请求真实 OpenAI 服务。
 * 新手阅读建议：先看 buildEmptyToolResult，再沿 context、input、functionCallOutput 阅读。
 */
import { describe, expect, it } from "vitest";
import { convertResponsesMessages } from "../src/api/openai-responses-shared.ts";
import { getModel } from "../src/compat.ts";
import type { AssistantMessage, Context, ToolResultMessage, Usage } from "../src/types.ts";

/** 满足助手消息结构的零用量夹具。 */
const usage: Usage = {
	input: 0,
	output: 0,
	cacheRead: 0,
	cacheWrite: 0,
	totalTokens: 0,
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

/**
 * 构造空文本的成功工具结果。
 * @param toolCallId 对应的工具调用 ID。
 * @param timestamp 消息毫秒时间戳。
 * @returns bash 工具的空文本 ToolResultMessage。
 * @example `buildEmptyToolResult("tool-1", Date.now())`。
 */
function buildEmptyToolResult(toolCallId: string, timestamp: number): ToolResultMessage {
	return {
		role: "toolResult",
		toolCallId,
		toolName: "bash",
		content: [{ type: "text", text: "" }],
		isError: false,
		timestamp,
	};
}

/** 空工具结果转换测试组。 */
describe("OpenAI Responses convertResponsesMessages empty tool result", () => {
	/** 验证无图片的空结果变成 `(no tool output)`，且不包含附件提示。 */
	it("uses '(no tool output)' placeholder for empty tool results without images", () => {
		/** 用于执行 Responses 转换的 OpenAI 模型。 */
		const model = getModel("openai", "gpt-4o-mini");
		/** 三条相关消息共享的基准时间戳。 */
		const now = Date.now();
		/** 发起 bash 工具调用的助手消息。 */
		const assistant: AssistantMessage = {
			role: "assistant",
			content: [{ type: "toolCall", id: "tool-1", name: "bash", arguments: { command: "true" } }],
			api: model.api,
			provider: model.provider,
			model: model.id,
			usage,
			stopReason: "toolUse",
			timestamp: now,
		};

		/** 用户、工具调用和空工具结果组成的上下文。 */
		const context: Context = {
			messages: [
				{ role: "user", content: "Run the command", timestamp: now - 1 },
				assistant,
				buildEmptyToolResult("tool-1", now + 1),
			],
		};

		/** 转换后的 Responses 输入项。 */
		const input = convertResponsesMessages(model, context, new Set(["openai", "openai-codex", "opencode"]));
		/** 查找到的函数调用输出项；未找到时为 undefined。 */
		const functionCallOutput = input.find((item) => item.type === "function_call_output") as
			| { type: "function_call_output"; output: string }
			| undefined;

		expect(functionCallOutput).toBeTruthy();
		expect(functionCallOutput?.output).toBe("(no tool output)");
		expect(functionCallOutput?.output).not.toContain("see attached image");
	});
});
