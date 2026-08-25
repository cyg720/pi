/**
 * 文件职责：在线验证 OpenAI Responses 在中止推理、同提供商换模型和 Anthropic 跨提供商历史中的回放。
 * 技术维度：使用 Vitest、真实 OpenAI/Anthropic API、TypeBox 工具、推理签名和 onPayload 调试捕获。
 * 产品维度：保证用户切换模型或提供商后能继续含推理和工具调用的会话，不触发孤立配对项 400 错误。
 * 逻辑维度：定义 double_number 工具，分别构造中止历史、同提供商模型交接和 Anthropic 到 OpenAI 交接。
 * 关键边界：用例需要两类真实密钥并整体跳过；会产生付费请求；日志可能输出标准化后的请求结构。
 * 新手阅读建议：先读首个中止推理用例，再比较同提供商与跨提供商工具 ID 如何转换。
 */
import { Type } from "typebox";
import { describe, expect, it } from "vitest";
import { complete, getEnvApiKey, getModel } from "../src/compat.ts";
import type { AssistantMessage, Context, Message, Tool, ToolCall } from "../src/types.ts";

/** double_number 工具参数结构。 */
const testToolSchema = Type.Object({
	value: Type.Number({ description: "A number to double" }),
});

/** 要求模型调用的数字翻倍工具声明。 */
const testTool: Tool<typeof testToolSchema> = {
	name: "double_number",
	description: "Doubles a number and returns the result",
	parameters: testToolSchema,
};

/** 仅在 OpenAI 和 Anthropic 密钥同时存在时运行推理历史交接在线测试。 */
describe.skipIf(!process.env.OPENAI_API_KEY || !process.env.ANTHROPIC_API_KEY)(
	"OpenAI Responses reasoning replay e2e",
	() => {
		it("skips reasoning-only history after an aborted turn", { retry: 2 }, async () => {
			/** 首轮生成推理签名的 OpenAI 模型。 */
			const model = getModel("openai", "gpt-5-mini");

			/** 解析后的 OpenAI API Key。 */
			const apiKey = getEnvApiKey("openai");
			if (!apiKey) {
				throw new Error("Missing OPENAI_API_KEY");
			}

			/** 请求调用 double_number 的用户消息。 */
			const userMessage: Message = {
				role: "user",
				content: "Use the double_number tool to double 21.",
				timestamp: Date.now(),
			};

			/** 含推理和工具调用的真实助手响应。 */
			const assistantResponse = await complete(
				model,
				{
					systemPrompt: "You are a helpful assistant. Use the tool.",
					messages: [userMessage],
					tools: [testTool],
				},
				{
					apiKey,
					reasoningEffort: "high",
				},
			);

			/** 带签名的推理内容块。 */
			const thinkingBlock = assistantResponse.content.find(
				(block) => block.type === "thinking" && block.thinkingSignature,
			);
			if (!thinkingBlock || thinkingBlock.type !== "thinking") {
				throw new Error("Missing thinking signature from OpenAI Responses");
			}

			/** 只保留推理块并标记中止的损坏历史消息。 */
			const corruptedAssistant: AssistantMessage = {
				...assistantResponse,
				content: [thinkingBlock],
				stopReason: "aborted",
			};

			/** 中止轮次后的用户追问。 */
			const followUp: Message = {
				role: "user",
				content: "Say hello to confirm you can continue.",
				timestamp: Date.now(),
			};

			/** 包含孤立推理块的回放上下文。 */
			const context: Context = {
				systemPrompt: "You are a helpful assistant.",
				messages: [userMessage, corruptedAssistant, followUp],
				tools: [testTool],
			};

			/** OpenAI 继续处理清洗后上下文的回复。 */
			const response = await complete(model, context, {
				apiKey,
				reasoningEffort: "high",
			});

			// The key assertion: no 400 error from orphaned reasoning item
			// 核心断言：孤立推理项不得导致 400 错误。
			expect(response.stopReason, `Error: ${response.errorMessage}`).not.toBe("error");
			expect(response.errorMessage).toBeFalsy();
			// Model should respond (text or tool call)
			// 模型应至少返回文本或工具调用内容。
			expect(response.content.length).toBeGreaterThan(0);
		});

		it("handles same-provider different-model handoff with tool calls", { retry: 2 }, async () => {
			// This tests the scenario where:
			// 1. Model A (gpt-5-mini) generates reasoning + function_call
			// 2. User switches to Model B (gpt-5.2-codex) - same provider, different model
			// 3. transform-messages: isSameModel=false, thinking converted to text
			// 4. But tool call ID still has OpenAI pairing history (fc_xxx paired with rs_xxx)
			// 5. Without fix: OpenAI returns 400 "function_call without required reasoning item"
			// 6. With fix: tool calls/results converted to text, conversation continues
			// 此场景验证同提供商换模型后，旧推理及工具配对会转换为可安全继续的文本历史。

			/** 生成旧推理/工具历史的模型 A。 */
			const modelA = getModel("openai", "gpt-5-mini");
			/** 接收历史并继续会话的模型 B。 */
			const modelB = getModel("openai", "gpt-5.5");

			/** OpenAI API Key。 */
			const apiKey = getEnvApiKey("openai");
			/** apiKey 仅来自测试环境；缺失时立即停止，避免发出无凭据请求。 */
			if (!apiKey) {
				throw new Error("Missing OPENAI_API_KEY");
			}

			/** 请求工具调用的首轮用户消息。 */
			const userMessage: Message = {
				role: "user",
				content: "Use the double_number tool to double 21.",
				timestamp: Date.now(),
			};

			// Get a real response from Model A with reasoning + tool call
			// 从模型 A 获取真实推理和工具调用。
			/** 模型 A 的真实工具调用响应。 */
			const assistantResponse = await complete(
				modelA,
				{
					systemPrompt: "You are a helpful assistant. Always use the tool when asked.",
					messages: [userMessage],
					tools: [testTool],
				},
				{
					apiKey,
					reasoningEffort: "high",
				},
			);

			/** 从模型 A 响应中提取的工具调用。 */
			const toolCallBlock = assistantResponse.content.find((block) => block.type === "toolCall") as
				| ToolCall
				| undefined;

			if (!toolCallBlock) {
				throw new Error("Missing tool call from OpenAI Responses - model did not use the tool");
			}

			// Provide a tool result
			// 回填 double_number 的工具结果。
			/** 与模型 A 工具调用关联的结果。 */
			const toolResult: Message = {
				role: "toolResult",
				toolCallId: toolCallBlock.id,
				toolName: toolCallBlock.name,
				content: [{ type: "text", text: "42" }],
				isError: false,
				timestamp: Date.now(),
			};

			/** 请求读取工具结果的后续用户消息。 */
			const followUp: Message = {
				role: "user",
				content: "What was the result? Answer with just the number.",
				timestamp: Date.now(),
			};

			// Now continue with Model B (different model, same provider)
			// 使用同提供商的不同模型 B 继续会话。
			/** 模型 B 接收的完整跨模型上下文。 */
			const context: Context = {
				systemPrompt: "You are a helpful assistant. Answer concisely.",
				messages: [userMessage, assistantResponse, toolResult, followUp],
				tools: [testTool],
			};

			/** onPayload 捕获的原始 Responses 请求。 */
			let capturedPayload: any = null;
			/** 模型 B 处理历史后的回复。 */
			const response = await complete(modelB, context, {
				apiKey,
				reasoningEffort: "high",
				onPayload: (payload) => {
					capturedPayload = payload;
				},
			});

			// The key assertion: no 400 error from orphaned function_call
			// 核心断言：孤立 function_call 不得造成 400 错误。
			expect(response.stopReason, `Error: ${response.errorMessage}`).not.toBe("error");
			expect(response.errorMessage).toBeFalsy();
			expect(response.content.length).toBeGreaterThan(0);

			// Log what was sent for debugging
			// 输出请求结构便于在线失败时诊断。
			/** 发送给 Responses API 的 input 数组。 */
			const input = capturedPayload?.input as any[];
			/** 规范化后仍保留的 function_call 项。 */
			const functionCalls = input?.filter((item: any) => item.type === "function_call") || [];
			/** 规范化后仍保留的 reasoning 项。 */
			const reasoningItems = input?.filter((item: any) => item.type === "reasoning") || [];

			console.log("Payload sent to API:");
			console.log("- function_calls:", functionCalls.length);
			console.log("- reasoning items:", reasoningItems.length);
			console.log("- full input:", JSON.stringify(input, null, 2));

			// Verify the model understood the context
			// 验证新模型仍理解工具结果。
			/** 模型 B 回复的拼接文本。 */
			const responseText = response.content
				.filter((b) => b.type === "text")
				.map((b) => (b as any).text)
				.join("");
			expect(responseText).toContain("42");
		});

		it("handles cross-provider handoff from Anthropic to OpenAI Codex", { retry: 2 }, async () => {
			// This tests cross-provider handoff:
			// 1. Anthropic model generates thinking + function_call (toolu_xxx ID)
			// 2. User switches to OpenAI Codex
			// 3. transform-messages: isSameModel=false, thinking converted to text
			// 4. Tool call ID is Anthropic format (toolu_xxx), no OpenAI pairing history
			// 5. Should work because foreign IDs have no pairing expectation
			// 此场景验证 Anthropic 工具 ID 没有 OpenAI 配对约束，跨提供商应直接继续。

			/** 生成 Anthropic 思考与工具调用的源模型。 */
			const anthropicModel = getModel("anthropic", "claude-sonnet-4-5");
			/** 接收跨提供商历史的 OpenAI 模型。 */
			const codexModel = getModel("openai", "gpt-5.5");

			/** Anthropic API Key。 */
			const anthropicApiKey = getEnvApiKey("anthropic");
			/** anthropicApiKey 用于跨提供商回放的 Anthropic 请求，不应写入日志或断言快照。 */
			/** OpenAI API Key。 */
			const openaiApiKey = getEnvApiKey("openai");
			/** openaiApiKey 用于同一回放流程的 OpenAI 请求，不应写入日志或断言快照。 */
			if (!anthropicApiKey || !openaiApiKey) {
				throw new Error("Missing API keys");
			}

			/** 请求 Anthropic 调用工具的用户消息。 */
			const userMessage: Message = {
				role: "user",
				content: "Use the double_number tool to double 21.",
				timestamp: Date.now(),
			};

			// Get a real response from Anthropic with thinking + tool call
			// 从 Anthropic 获取真实思考和工具调用。
			/** Anthropic 的真实工具调用响应。 */
			const assistantResponse = await complete(
				anthropicModel,
				{
					systemPrompt: "You are a helpful assistant. Always use the tool when asked.",
					messages: [userMessage],
					tools: [testTool],
				},
				{
					apiKey: anthropicApiKey,
					thinkingEnabled: true,
					thinkingBudgetTokens: 5000,
				},
			);

			/** 从 Anthropic 响应提取的工具调用。 */
			const toolCallBlock = assistantResponse.content.find((block) => block.type === "toolCall") as
				| ToolCall
				| undefined;

			if (!toolCallBlock) {
				throw new Error("Missing tool call from Anthropic - model did not use the tool");
			}

			console.log("Anthropic tool call ID:", toolCallBlock.id);

			// Provide a tool result
			// 回填 Anthropic 工具调用结果。
			/** 使用 toolu_* ID 的工具结果。 */
			const toolResult: Message = {
				role: "toolResult",
				toolCallId: toolCallBlock.id,
				toolName: toolCallBlock.name,
				content: [{ type: "text", text: "42" }],
				isError: false,
				timestamp: Date.now(),
			};

			/** 请求读取工具结果的后续用户消息。 */
			const followUp: Message = {
				role: "user",
				content: "What was the result? Answer with just the number.",
				timestamp: Date.now(),
			};

			// Now continue with Codex (different provider)
			// 使用不同提供商的 Codex 模型继续会话。
			/** Codex 接收的跨提供商上下文。 */
			const context: Context = {
				systemPrompt: "You are a helpful assistant. Answer concisely.",
				messages: [userMessage, assistantResponse, toolResult, followUp],
				tools: [testTool],
			};

			/** onPayload 捕获的 Codex 请求。 */
			let capturedPayload: any = null;
			/** Codex 处理跨提供商历史后的回复。 */
			const response = await complete(codexModel, context, {
				apiKey: openaiApiKey,
				reasoningEffort: "high",
				onPayload: (payload) => {
					capturedPayload = payload;
				},
			});

			// Log what was sent
			// 输出 Codex 请求结构便于调试。
			/** Codex 请求 input 数组。 */
			const input = capturedPayload?.input as any[];
			/** Codex 请求中的 function_call 项。 */
			const functionCalls = input?.filter((item: any) => item.type === "function_call") || [];
			/** Codex 请求中的 reasoning 项。 */
			const reasoningItems = input?.filter((item: any) => item.type === "reasoning") || [];

			console.log("Payload sent to Codex:");
			console.log("- function_calls:", functionCalls.length);
			console.log("- reasoning items:", reasoningItems.length);
			if (functionCalls.length > 0) {
				console.log(
					"- function_call IDs:",
					functionCalls.map((fc: any) => fc.id),
				);
			}

			// The key assertion: no 400 error
			// 核心断言：跨提供商历史不得产生 400 错误。
			expect(response.stopReason, `Error: ${response.errorMessage}`).not.toBe("error");
			expect(response.errorMessage).toBeFalsy();
			expect(response.content.length).toBeGreaterThan(0);

			// Verify the model understood the context
			// 验证 Codex 仍理解工具结果。
			/** Codex 回复的拼接文本。 */
			const responseText = response.content
				.filter((b) => b.type === "text")
				.map((b) => (b as any).text)
				.join("");
			expect(responseText).toContain("42");
		});
	},
);
