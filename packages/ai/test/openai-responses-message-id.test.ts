/**
 * 文件职责：验证一个助手轮次转换出多个 Responses 消息时生成唯一回退 ID。
 * 技术维度：使用 Vitest、消息上下文和类型守卫筛选 ResponseOutputMessage。
 * 产品维度：避免重复消息 ID 导致 API 拒绝上下文或错误关联内容块。
 * 逻辑维度：构造含思考与文本的助手消息，转换、提取 ID 并检查序列与唯一性。
 * 关键边界：使用零用量夹具，不请求真实 API；只验证回退 ID。
 * 新手阅读建议：先看 assistant 两个内容块，再跟踪 input 到 messageIds 的过滤过程。
 */
import type { ResponseOutputMessage } from "openai/resources/responses/responses.js";
import { describe, expect, it } from "vitest";
import { convertResponsesMessages } from "../src/api/openai-responses-shared.ts";
import { getModel } from "../src/compat.ts";
import type { AssistantMessage, Context, Usage } from "../src/types.ts";

/** 满足消息结构的零用量夹具。 */
const usage: Usage = {
	input: 0,
	output: 0,
	cacheRead: 0,
	cacheWrite: 0,
	totalTokens: 0,
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

/** Responses 消息 ID 转换测试组。 */
describe("OpenAI Responses message ID conversion", () => {
	/** 验证两个输出消息依次获得 msg_pi_1 与 msg_pi_1_1。 */
	it("generates unique fallback message IDs for multiple text blocks in one assistant turn", () => {
		/** 执行转换的 OpenAI Codex 模型。 */
		const model = getModel("openai-codex", "gpt-5.5");
		/** 含思考和可见文本的历史助手消息。 */
		const assistant: AssistantMessage = {
			role: "assistant",
			content: [
				{ type: "thinking", thinking: "private reasoning" },
				{ type: "text", text: "visible answer" },
			],
			api: "anthropic-messages",
			provider: "anthropic",
			model: "claude-opus-4-8",
			usage,
			stopReason: "stop",
			timestamp: Date.now() - 1000,
		};
		/** 一条用户消息加上述助手消息的上下文。 */
		const context: Context = {
			systemPrompt: "You are concise.",
			messages: [{ role: "user", content: "hello", timestamp: Date.now() - 2000 }, assistant],
		};

		/** 转换得到的 Responses 输入项。 */
		const input = convertResponsesMessages(model, context, new Set(["openai", "openai-codex", "opencode"]));
		/** 从带字符串 ID 的 message 项中提取的 ID 列表。 */
		const messageIds = input
			.filter(
				// item 是一个输入项；此类型守卫只保留带字符串 id 的 message。
				(item): item is ResponseOutputMessage =>
					item.type === "message" && "id" in item && typeof item.id === "string",
			)
			// item 已收窄为 ResponseOutputMessage，可安全读取 id。
			.map((item) => item.id);

		expect(messageIds).toEqual(["msg_pi_1", "msg_pi_1_1"]);
		expect(new Set(messageIds).size).toBe(messageIds.length);
	});
});
