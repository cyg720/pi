/**
 * Tool Call ID Normalization Tests
 *
 * Tests that tool call IDs from OpenAI Responses API (github-copilot, openai-codex, opencode)
 * are properly normalized when sent to other providers.
 *
 * OpenAI Responses API generates IDs in format: {call_id}|{id}
 * where {id} can be 400+ chars with special characters (+, /, =).
 *
 * Regression test for: https://github.com/earendil-works/pi-mono/issues/1022
 */
/**
 * 文件职责：回归验证 OpenAI Responses 的管道分隔超长工具调用 ID 在跨提供商传递时会被规范化。
 * 技术维度：使用 Vitest 在线模型调用、TypeBox 工具、OAuth/环境凭据和预填历史消息覆盖真实协议边界。
 * 产品维度：避免用户在 Copilot、OpenRouter 和 Codex 间切换模型时收到 call_id 过长或非法字符错误。
 * 逻辑维度：解析可选凭据，定义 echo 工具，先做实时跨提供商交接，再用 #1022 精确失败 ID 回放。
 * 关键边界：用例依赖真实凭据并可能跳过；在线调用有 30–60 秒超时；原始失败 ID 含特殊字符。
 * 新手阅读建议：先理解 call_id|id 格式和 echo 工具，再看实时交接，最后阅读无需首轮生成的预填上下文。
 */

import { Type } from "typebox";
import { describe, expect, it } from "vitest";
import { completeSimple, getEnvApiKey, getModel } from "../src/compat.ts";
import type { AssistantMessage, Message, Tool, ToolResultMessage } from "../src/types.ts";
import { resolveApiKey } from "./oauth.ts";

// Resolve API keys
// 解析三个在线提供商的可选测试凭据。
/** GitHub Copilot OAuth 令牌，缺失时相关用例跳过。 */
const copilotToken = await resolveApiKey("github-copilot");
/** OpenRouter 环境 API Key，缺失时相关用例跳过。 */
const openrouterKey = getEnvApiKey("openrouter");
/** OpenAI Codex OAuth 令牌，缺失时相关用例跳过。 */
const codexToken = await resolveApiKey("openai-codex");

// Simple echo tool for testing
// 用于生成和回填工具调用的简单 echo 工具。
/** echo 工具只接受一个 message 字符串。 */
const echoToolSchema = Type.Object({
	message: Type.String({ description: "Message to echo back" }),
});

/** 回显 message 参数的测试工具声明。 */
const echoTool: Tool<typeof echoToolSchema> = {
	name: "echo",
	description: "Echoes the message back",
	parameters: echoToolSchema,
};

/**
 * Test 1: Live cross-provider handoff
 *
 * 1. Use github-copilot gpt-5.2-codex to generate a tool call
 * 2. Switch to openrouter openai/gpt-5.2-codex and complete
 * 3. Switch to openai-codex gpt-5.5 and complete
 *
 * Both should succeed without "call_id too long" errors.
 */
/** 测试一：实时从 Copilot 生成工具调用，再交给 OpenRouter 或 Codex 继续会话。 */
/** 覆盖实时跨提供商交接中的管道分隔 ID 规范化。 */
describe("Tool Call ID Normalization - Live Handoff", () => {
	it.skipIf(!copilotToken || !openrouterKey)(
		"github-copilot -> openrouter should normalize pipe-separated IDs",
		async () => {
			/** 首轮生成工具调用的 Copilot 模型。 */
			const copilotModel = getModel("github-copilot", "gpt-5.2-codex");
			/** 接收历史工具调用的 OpenRouter 模型。 */
			const openrouterModel = getModel("openrouter", "openai/gpt-5.2-codex");

			// Step 1: Generate tool call with github-copilot
			// 步骤 1：让 GitHub Copilot 生成 Responses 格式工具调用。
			/** 请求调用 echo 工具的首轮用户消息。 */
			const userMessage: Message = {
				role: "user",
				content: "Use the echo tool to echo 'hello world'",
				timestamp: Date.now(),
			};

			/** Copilot 返回的工具调用助手消息。 */
			const assistantResponse = await completeSimple(
				copilotModel,
				{
					systemPrompt: "You are a helpful assistant. Use the echo tool when asked.",
					messages: [userMessage],
					tools: [echoTool],
				},
				{ apiKey: copilotToken },
			);

			expect(assistantResponse.stopReason, `Copilot error: ${assistantResponse.errorMessage}`).toBe("toolUse");

			/** 从助手内容提取的工具调用。 */
			const toolCall = assistantResponse.content.find((c) => c.type === "toolCall");
			expect(toolCall).toBeDefined();
			expect(toolCall!.type).toBe("toolCall");

			// Verify it's a pipe-separated ID (OpenAI Responses format)
			// 验证源 ID 确实采用 OpenAI Responses 的管道分隔格式。
			if (toolCall?.type === "toolCall") {
				expect(toolCall.id).toContain("|");
				console.log(`Tool call ID from github-copilot: ${toolCall.id.slice(0, 80)}...`);
			}

			// Create tool result
			// 创建与原始超长 ID 关联的工具结果。
			/** 回填给下一提供商的 echo 工具结果。 */
			const toolResult: ToolResultMessage = {
				role: "toolResult",
				toolCallId: (toolCall as any).id,
				toolName: "echo",
				content: [{ type: "text", text: "hello world" }],
				isError: false,
				timestamp: Date.now(),
			};

			// Step 2: Complete with openrouter (uses openai-completions API)
			// 步骤 2：用 OpenAI Completions 协议的 OpenRouter 继续会话。
			/** OpenRouter 消费跨提供商历史后的回复。 */
			const openrouterResponse = await completeSimple(
				openrouterModel,
				{
					systemPrompt: "You are a helpful assistant.",
					messages: [
						userMessage,
						assistantResponse,
						toolResult,
						{ role: "user", content: "Say hi", timestamp: Date.now() },
					],
					tools: [echoTool],
				},
				{ apiKey: openrouterKey },
			);

			// Should NOT fail with "call_id too long" error
			// 规范化后不应出现 call_id 过长错误。
			expect(openrouterResponse.stopReason, `OpenRouter error: ${openrouterResponse.errorMessage}`).not.toBe(
				"error",
			);
			expect(openrouterResponse.errorMessage).toBeUndefined();
		},
		60000,
	);

	it.skipIf(!copilotToken || !codexToken)(
		"github-copilot -> openai-codex should normalize pipe-separated IDs",
		async () => {
			/** 首轮生成工具调用的 Copilot 模型。 */
			const copilotModel = getModel("github-copilot", "gpt-5.2-codex");
			/** 接收历史工具调用的 OpenAI Codex 模型。 */
			const codexModel = getModel("openai-codex", "gpt-5.5");

			// Step 1: Generate tool call with github-copilot
			// 步骤 1：让 GitHub Copilot 生成管道分隔 ID 的工具调用。
			/** 请求调用 echo 工具的首轮用户消息。 */
			const userMessage: Message = {
				role: "user",
				content: "Use the echo tool to echo 'test message'",
				timestamp: Date.now(),
			};

			/** Copilot 返回的工具调用消息。 */
			const assistantResponse = await completeSimple(
				copilotModel,
				{
					systemPrompt: "You are a helpful assistant. Use the echo tool when asked.",
					messages: [userMessage],
					tools: [echoTool],
				},
				{ apiKey: copilotToken },
			);

			expect(assistantResponse.stopReason, `Copilot error: ${assistantResponse.errorMessage}`).toBe("toolUse");

			/** 从助手内容提取的工具调用。 */
			const toolCall = assistantResponse.content.find((c) => c.type === "toolCall");
			expect(toolCall).toBeDefined();

			// Create tool result
			// 创建与原始 ID 关联的工具结果。
			/** 回填给 Codex 的 echo 工具结果。 */
			const toolResult: ToolResultMessage = {
				role: "toolResult",
				toolCallId: (toolCall as any).id,
				toolName: "echo",
				content: [{ type: "text", text: "test message" }],
				isError: false,
				timestamp: Date.now(),
			};

			// Step 2: Complete with openai-codex (uses openai-codex-responses API)
			// 步骤 2：用 OpenAI Codex Responses 协议继续会话。
			/** Codex 消费跨提供商历史后的回复。 */
			const codexResponse = await completeSimple(
				codexModel,
				{
					systemPrompt: "You are a helpful assistant.",
					messages: [
						userMessage,
						assistantResponse,
						toolResult,
						{ role: "user", content: "Say hi", timestamp: Date.now() },
					],
					tools: [echoTool],
				},
				{ apiKey: codexToken },
			);

			// Should NOT fail with ID validation error
			// 规范化后不应出现 ID 校验错误。
			expect(codexResponse.stopReason, `Codex error: ${codexResponse.errorMessage}`).not.toBe("error");
			expect(codexResponse.errorMessage).toBeUndefined();
		},
		60000,
	);
});

/**
 * Test 2: Prefilled context with exact failing IDs from issue #1022
 *
 * Uses the exact tool call ID format that caused the error:
 * "call_xxx|very_long_base64_with_special_chars+/="
 */
/** 测试二：用 #1022 的精确失败 ID 构造预填上下文，直接验证目标提供商。 */
/** 覆盖无需在线生成首轮工具调用的精确历史回放。 */
describe("Tool Call ID Normalization - Prefilled Context", () => {
	// Exact tool call ID from issue #1022 JSONL
	// 来自 #1022 JSONL 的精确超长工具调用 ID。
	/** 含管道分隔、Base64 特殊字符和数百字符后缀的失败 ID。 */
	const FAILING_TOOL_CALL_ID =
		"call_pAYbIr76hXIjncD9UE4eGfnS|t5nnb2qYMFWGSsr13fhCd1CaCu3t3qONEPuOudu4HSVEtA8YJSL6FAZUxvoOoD792VIJWl91g87EdqsCWp9krVsdBysQoDaf9lMCLb8BS4EYi4gQd5kBQBYLlgD71PYwvf+TbMD9J9/5OMD42oxSRj8H+vRf78/l2Xla33LWz4nOgsddBlbvabICRs8GHt5C9PK5keFtzyi3lsyVKNlfduK3iphsZqs4MLv4zyGJnvZo/+QzShyk5xnMSQX/f98+aEoNflEApCdEOXipipgeiNWnpFSHbcwmMkZoJhURNu+JEz3xCh1mrXeYoN5o+trLL3IXJacSsLYXDrYTipZZbJFRPAucgbnjYBC+/ZzJOfkwCs+Gkw7EoZR7ZQgJ8ma+9586n4tT4cI8DEhBSZsWMjrCt8dxKg==";

	// Build prefilled context with the failing ID
	// 使用失败 ID 构造完整工具调用历史。
	/**
	 * 创建用户请求、助手工具调用、工具结果和追问组成的历史。
	 * @returns 含精确失败 ID 的消息数组。
	 * @example const messages = buildPrefilledMessages();
	 */
	function buildPrefilledMessages(): Message[] {
		/** 发起 echo 工具请求的用户消息。 */
		const userMessage: Message = {
			role: "user",
			content: "Use the echo tool to echo 'hello'",
			timestamp: Date.now() - 2000,
		};

		/** 带精确失败 ID 的助手工具调用消息。 */
		const assistantMessage: AssistantMessage = {
			role: "assistant",
			content: [
				{
					type: "toolCall",
					id: FAILING_TOOL_CALL_ID,
					name: "echo",
					arguments: { message: "hello" },
				},
			],
			api: "openai-responses",
			provider: "github-copilot",
			model: "gpt-5.2-codex",
			usage: {
				input: 100,
				output: 50,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 150,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "toolUse",
			timestamp: Date.now() - 1500,
		};

		/** 与失败 ID 关联的工具结果。 */
		const toolResult: ToolResultMessage = {
			role: "toolResult",
			toolCallId: FAILING_TOOL_CALL_ID,
			toolName: "echo",
			content: [{ type: "text", text: "hello" }],
			isError: false,
			timestamp: Date.now() - 1000,
		};

		/** 工具执行后的用户追问。 */
		const followUpUser: Message = {
			role: "user",
			content: "Say hi",
			timestamp: Date.now(),
		};

		return [userMessage, assistantMessage, toolResult, followUpUser];
	}

	it.skipIf(!openrouterKey)(
		"openrouter should handle prefilled context with long pipe-separated IDs",
		async () => {
			/** 接收预填历史的 OpenRouter 模型。 */
			const model = getModel("openrouter", "openai/gpt-5.2-codex");
			/** 含失败 ID 的预填消息。 */
			const messages = buildPrefilledMessages();

			/** OpenRouter 处理预填历史后的回复。 */
			const response = await completeSimple(
				model,
				{
					systemPrompt: "You are a helpful assistant.",
					messages,
					tools: [echoTool],
				},
				{ apiKey: openrouterKey },
			);

			// Should NOT fail with "call_id too long" error
			// 规范化后不应包含 call_id 过长错误。
			expect(response.stopReason, `OpenRouter error: ${response.errorMessage}`).not.toBe("error");
			if (response.errorMessage) {
				expect(response.errorMessage).not.toContain("call_id");
				expect(response.errorMessage).not.toContain("too long");
			}
		},
		30000,
	);

	it.skipIf(!codexToken)(
		"openai-codex should handle prefilled context with long pipe-separated IDs",
		async () => {
			/** 接收预填历史的 OpenAI Codex 模型。 */
			const model = getModel("openai-codex", "gpt-5.5");
			/** 含失败 ID 的预填消息。 */
			const messages = buildPrefilledMessages();

			/** Codex 处理预填历史后的回复。 */
			const response = await completeSimple(
				model,
				{
					systemPrompt: "You are a helpful assistant.",
					messages,
					tools: [echoTool],
				},
				{ apiKey: codexToken },
			);

			// Should NOT fail with ID validation error
			// 规范化后不应包含 ID 校验错误。
			expect(response.stopReason, `Codex error: ${response.errorMessage}`).not.toBe("error");
			if (response.errorMessage) {
				expect(response.errorMessage).not.toContain("id");
				expect(response.errorMessage).not.toContain("additional characters");
			}
		},
		30000,
	);
});
