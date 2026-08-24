/**
 * 文件职责：验证 GitHub Copilot 会话从 OpenAI 模型切换到 Claude 时，推理块、工具签名和孤立工具调用被正确迁移。
 * 技术维度：使用 Vitest、统一 Message 类型和真实 transformMessages 逻辑，手工构造跨 API 会话历史。
 * 产品维度：保障用户在同一 Copilot 会话切换模型后可继续对话，不因提供商协议差异产生无效请求。
 * 逻辑维度：定义 Claude 目标模型与消息工厂，再覆盖 thinking 文本化、签名移除和缺失工具结果补全。
 * 关键边界：Anthropic 工具调用 ID 仅允许安全字符且最多 64 字符；合成结果只补仍缺失的尾部调用。
 * 新手阅读建议：先比较源消息 api/model 与目标模型，再观察 transformMessages 返回的内容块和工具结果。
 */
import { describe, expect, it } from "vitest";
import { transformMessages } from "../src/api/transform-messages.ts";
import type { AssistantMessage, Message, Model, ToolCall } from "../src/types.ts";

// Normalize function matching what anthropic.ts uses
// 该规范化函数与 anthropic.ts 的实现一致，用于把工具调用 ID 转为 Anthropic 可接受格式。
/** 参数 id 为原调用 ID，后两个参数仅满足签名；返回替换非法字符并截到 64 字符的 ID。 */
function anthropicNormalizeToolCallId(
	id: string,
	_model: Model<"anthropic-messages">,
	_source: AssistantMessage,
): string {
	return id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
}

/** 构造 Copilot 路由下的 Claude 目标模型；无参数；返回 anthropic-messages Model。 */
function makeCopilotClaudeModel(): Model<"anthropic-messages"> {
	return {
		id: "claude-sonnet-4.6",
		name: "Claude Sonnet 4.6",
		api: "anthropic-messages",
		provider: "github-copilot",
		baseUrl: "https://api.individual.githubcopilot.com",
		reasoning: true,
		input: ["text", "image"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128000,
		maxTokens: 16000,
	};
}

/** 构造来源为 Copilot OpenAI Responses 的助手工具调用消息；参数 content 为内容块；返回 AssistantMessage。 */
function makeAssistantMessage(content: AssistantMessage["content"]): AssistantMessage {
	return {
		role: "assistant",
		content,
		api: "openai-responses",
		provider: "github-copilot",
		model: "gpt-5",
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "toolUse",
		timestamp: Date.now(),
	};
}

// 验证 Copilot 内从 OpenAI 协议历史迁移到 Anthropic 协议的兼容修复。
describe("OpenAI to Anthropic session migration for Copilot Claude", () => {
	// 源模型不同的 thinking 块不能作为 Anthropic 签名推理继续发送，应降级为文本。
	it("converts thinking blocks to plain text when source model differs", () => {
		// model 是会话即将切换到的 Copilot Claude 模型。
		const model = makeCopilotClaudeModel();
		// messages 包含一条来自旧 OpenAI Completions 模型的 thinking 助手消息。
		const messages: Message[] = [
			{ role: "user", content: "hello", timestamp: Date.now() },
			{
				role: "assistant",
				content: [
					{
						type: "thinking",
						thinking: "Let me think about this...",
						thinkingSignature: "reasoning_content",
					},
					{ type: "text", text: "Hi there!" },
				],
				api: "openai-completions",
				provider: "github-copilot",
				model: "gpt-4o",
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

		// result 是按目标 Claude 协议清理后的会话历史。
		const result = transformMessages(messages, model, anthropicNormalizeToolCallId);
		// assistantMsg 是转换后的助手消息。
		const assistantMsg = result.find((m) => m.role === "assistant") as AssistantMessage;

		// Thinking block should be converted to text since models differ
		// 因源目标模型不同，thinking 块应转换为普通文本块。
		// textBlocks 保存转换后所有文本内容块。
		const textBlocks = assistantMsg.content.filter((b) => b.type === "text");
		// thinkingBlocks 保存仍残留的推理块，预期为空。
		const thinkingBlocks = assistantMsg.content.filter((b) => b.type === "thinking");
		expect(thinkingBlocks).toHaveLength(0);
		expect(textBlocks.length).toBeGreaterThanOrEqual(2);
	});

	// OpenAI 加密 thoughtSignature 不能跨模型复用于 Anthropic 工具调用。
	it("removes thoughtSignature from tool calls when migrating between models", () => {
		// model 是目标 Copilot Claude 模型。
		const model = makeCopilotClaudeModel();
		// messages 包含带 OpenAI 加密推理签名的工具调用和对应结果。
		const messages: Message[] = [
			{ role: "user", content: "run a command", timestamp: Date.now() },
			{
				role: "assistant",
				content: [
					{
						type: "toolCall",
						id: "call_123",
						name: "bash",
						arguments: { command: "ls" },
						thoughtSignature: JSON.stringify({ type: "reasoning.encrypted", id: "call_123", data: "encrypted" }),
					},
				],
				api: "openai-responses",
				provider: "github-copilot",
				model: "gpt-5",
				usage: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 0,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
				},
				stopReason: "toolUse",
				timestamp: Date.now(),
			},
			{
				role: "toolResult",
				toolCallId: "call_123",
				toolName: "bash",
				content: [{ type: "text", text: "output" }],
				isError: false,
				timestamp: Date.now(),
			},
		];

		// result 是清理协议专属签名后的历史。
		const result = transformMessages(messages, model, anthropicNormalizeToolCallId);
		// assistantMsg 是转换后的工具调用助手消息。
		const assistantMsg = result.find((m) => m.role === "assistant") as AssistantMessage;
		// toolCall 是从助手内容中找到的首个工具调用。
		const toolCall = assistantMsg.content.find((b) => b.type === "toolCall") as ToolCall;

		expect(toolCall.thoughtSignature).toBeUndefined();
	});

	// 会话结尾只有工具调用而没有结果时，应追加错误结果保持协议成对。
	it("adds synthetic tool results for trailing orphaned tool calls", () => {
		// model 是目标 Copilot Claude 模型。
		const model = makeCopilotClaudeModel();
		// messages 以一个包含特殊字符 ID 的未完成 read 调用结尾。
		const messages: Message[] = [
			{ role: "user", content: "read the file", timestamp: Date.now() },
			makeAssistantMessage([
				{
					type: "toolCall",
					id: "call_123|fc_123",
					name: "read",
					arguments: { path: "README.md" },
				},
			]),
		];

		// result 是补齐孤立调用并规范化 ID 后的历史。
		const result = transformMessages(messages, model, anthropicNormalizeToolCallId);
		// lastMessage 应是转换器追加的合成错误工具结果。
		const lastMessage = result[result.length - 1];

		expect(lastMessage).toMatchObject({
			role: "toolResult",
			toolCallId: "call_123_fc_123",
			toolName: "read",
			isError: true,
			content: [{ type: "text", text: "No result provided" }],
		});
	});

	// 多个尾部调用中已有结果的调用不得重复补全，只补仍缺失者。
	it("adds synthetic results only for trailing tool calls that are still missing results", () => {
		// model 是目标 Copilot Claude 模型。
		const model = makeCopilotClaudeModel();
		// messages 包含两个调用，但只有第一个已有正常结果。
		const messages: Message[] = [
			{ role: "user", content: "run commands", timestamp: Date.now() },
			makeAssistantMessage([
				{ type: "toolCall", id: "call_1|fc_1", name: "read", arguments: { path: "README.md" } },
				{ type: "toolCall", id: "call_2|fc_2", name: "bash", arguments: { command: "pwd" } },
			]),
			{
				role: "toolResult",
				toolCallId: "call_1|fc_1",
				toolName: "read",
				content: [{ type: "text", text: "done" }],
				isError: false,
				timestamp: Date.now(),
			},
		];

		// result 是迁移并补齐后的完整消息序列。
		const result = transformMessages(messages, model, anthropicNormalizeToolCallId);
		// syntheticResults 只筛选转换器生成的错误工具结果。
		const syntheticResults = result.filter((message) => message.role === "toolResult" && message.isError);

		expect(syntheticResults).toHaveLength(1);
		expect(syntheticResults[0]).toMatchObject({
			role: "toolResult",
			toolCallId: "call_2_fc_2",
			toolName: "bash",
			content: [{ type: "text", text: "No result provided" }],
		});
	});
});
