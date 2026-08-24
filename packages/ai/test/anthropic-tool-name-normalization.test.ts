/**
 * 文件职责：端到端验证 Claude Code OAuth 工具名在发送时规范为官方大小写、返回时恢复用户原始名称。
 * 技术维度：使用 Vitest、TypeBox 工具模式、Anthropic OAuth 凭据和真实 stream API 执行在线工具调用测试。
 * 产品维度：避免大小写差异让模型返回无法匹配的工具名，并防止把语义不同的 find 错误映射为 Glob。
 * 逻辑维度：准备 OAuth 模型，分别测试 TodoWrite、内置 read、find 反例和完全自定义工具的往返结果。
 * 关键边界：需要真实 OAuth Token 并产生网络请求；规范化只做大小写查找，不做不同工具名的语义映射。
 * 新手阅读建议：先读下方英文背景说明理解旧 bug，再比较每个 context.tools 名称与 toolcall_end 返回名称。
 */
import { Type } from "typebox";
import { describe, expect, it } from "vitest";
import { getModel, stream } from "../src/compat.ts";
import type { Context, Tool } from "../src/types.ts";
import { resolveApiKey } from "./oauth.ts";

// oauthToken 是 Anthropic Claude Code OAuth 凭据；缺失时整组在线测试跳过。
const oauthToken = await resolveApiKey("anthropic");

/**
 * Tests for Anthropic OAuth tool name normalization.
 *
 * When using Claude Code OAuth, tool names must match CC's canonical casing.
 * The normalization should:
 * 1. Convert tool names that match CC tools (case-insensitive) to CC casing on outbound
 * 2. Convert tool names back to the original casing on inbound
 *
 * This is a simple case-insensitive lookup, NOT a mapping of different names.
 * e.g., "todowrite" -> "TodoWrite" -> "todowrite" (round-trip works)
 *
 * The old `find -> Glob` mapping was WRONG because:
 * - Outbound: "find" -> "Glob"
 * - Inbound: "Glob" -> ??? (no tool named "glob" in context.tools, only "find")
 * - Result: tool call has name "Glob" but no tool exists with that name
 */
/**
 * 中文说明：Claude Code OAuth 要求官方工具大小写，出站可把同名工具改成官方形式，入站必须还原用户原名。
 * 这里仅做不区分大小写的同名查找；`find` 与 `Glob` 含义不同，绝不能沿用旧版错误映射。
 */
// 有 OAuth 凭据时验证工具名称在真实 Claude Code 路由中的双向规范化。
describe.skipIf(!oauthToken)("Anthropic OAuth tool name normalization", () => {
	// model 是所有用例共享的 Claude Code OAuth 目标模型。
	const model = getModel("anthropic", "claude-sonnet-4-6");

	// 用户小写 todowrite 应出站为 TodoWrite，入站恢复为 todowrite。
	it("should normalize user-defined tool matching CC name (todowrite -> TodoWrite -> todowrite)", async () => {
		// User defines a tool named "todowrite" (lowercase)
		// 用户定义名为小写 todowrite 的工具。
		// CC has "TodoWrite" - this should round-trip correctly
		// Claude Code 中对应 TodoWrite，往返后仍应匹配用户名称。
		// todoTool 是待规范化的用户工具定义。
		const todoTool: Tool = {
			name: "todowrite",
			description: "Write a todo item",
			parameters: Type.Object({
				task: Type.String({ description: "The task to add" }),
			}),
		};

		// context 要求模型调用 todoTool，并把它作为唯一可用工具。
		const context: Context = {
			systemPrompt: "You are a helpful assistant. Use the todowrite tool when asked to add todos.",
			messages: [
				{
					role: "user",
					content: "Add a todo: buy milk. Use the todowrite tool.",
					timestamp: Date.now(),
				},
			],
			tools: [todoTool],
		};

		// s 是使用 OAuth Token 的真实 Anthropic 事件流。
		const s = stream(model, context, { apiKey: oauthToken });
		// toolCallName 保存 toolcall_end 中恢复后的工具名。
		let toolCallName: string | undefined;

		for await (const event of s) {
			if (event.type === "toolcall_end") {
				// toolCall 是当前完成事件对应的内容块。
				const toolCall = event.partial.content[event.contentIndex];
				if (toolCall.type === "toolCall") {
					toolCallName = toolCall.name;
				}
			}
		}

		// response 是流结束后的完整助手消息。
		const response = await s.result();
		expect(response.stopReason, `Error: ${response.errorMessage}`).toBe("toolUse");

		// The tool call should come back with the ORIGINAL name "todowrite", not "TodoWrite"
		// 返回工具调用必须使用原名 todowrite，而不是 Claude Code 的 TodoWrite。
		expect(toolCallName).toBe("todowrite");
	});

	// pi 内置小写 read 同样应在往返后恢复为 read。
	it("should handle pi's built-in tools (read, write, edit, bash)", async () => {
		// Pi's tools use lowercase names, CC uses PascalCase
		// pi 工具使用小写名，Claude Code 使用 PascalCase。
		// readTool 是代表内置工具的最小定义。
		const readTool: Tool = {
			name: "read",
			description: "Read a file",
			parameters: Type.Object({
				path: Type.String({ description: "File path" }),
			}),
		};

		// context 要求模型明确调用 read 工具。
		const context: Context = {
			systemPrompt: "You are a helpful assistant. Use the read tool to read files.",
			messages: [
				{
					role: "user",
					content: "Read the file /tmp/test.txt using the read tool.",
					timestamp: Date.now(),
				},
			],
			tools: [readTool],
		};

		// s 是本次内置工具调用流。
		const s = stream(model, context, { apiKey: oauthToken });
		// toolCallName 保存入站规范化后的名称。
		let toolCallName: string | undefined;

		for await (const event of s) {
			if (event.type === "toolcall_end") {
				// toolCall 是流中结束的工具调用内容块。
				const toolCall = event.partial.content[event.contentIndex];
				if (toolCall.type === "toolCall") {
					toolCallName = toolCall.name;
				}
			}
		}

		// response 用于确认模型确实以工具调用停止。
		const response = await s.result();
		expect(response.stopReason, `Error: ${response.errorMessage}`).toBe("toolUse");

		// The tool call should come back with the ORIGINAL name "read", not "Read"
		// 返回名称应是原始 read，而不是官方大小写 Read。
		expect(toolCallName).toBe("read");
	});

	// find 不是 Claude Code 工具名，不得为了匹配 Glob 而做语义映射。
	it("should NOT map find to Glob - find is not a CC tool name", async () => {
		// Pi has a "find" tool, CC has "Glob" - these are DIFFERENT tools
		// pi 的 find 与 Claude Code 的 Glob 是两个语义不同的工具。
		// The old code incorrectly mapped find -> Glob, which broke the round-trip
		// 旧实现错误映射 find -> Glob，导致返回名称无法匹配上下文工具。
		// because there's no tool named "glob" in context.tools
		// context.tools 中没有 glob，因此入站无法恢复为 find。
		// findTool 是必须原样通过的 pi 查找工具。
		const findTool: Tool = {
			name: "find",
			description: "Find files by pattern",
			parameters: Type.Object({
				pattern: Type.String({ description: "Glob pattern" }),
			}),
		};

		// context 明确要求调用 find，排除其他工具选择。
		const context: Context = {
			systemPrompt: "You are a helpful assistant. Use the find tool to search for files.",
			messages: [
				{
					role: "user",
					content: "Find all .ts files using the find tool.",
					timestamp: Date.now(),
				},
			],
			tools: [findTool],
		};

		// s 是 find 工具的真实调用流。
		const s = stream(model, context, { apiKey: oauthToken });
		// toolCallName 保存模型返回并经规范化后的名称。
		let toolCallName: string | undefined;

		for await (const event of s) {
			if (event.type === "toolcall_end") {
				// toolCall 是已完成的工具调用块。
				const toolCall = event.partial.content[event.contentIndex];
				if (toolCall.type === "toolCall") {
					toolCallName = toolCall.name;
				}
			}
		}

		// response 验证模型成功选择工具。
		const response = await s.result();
		expect(response.stopReason, `Error: ${response.errorMessage}`).toBe("toolUse");

		// With the BROKEN find -> Glob mapping:
		// 错误 find -> Glob 映射下：
		// - Sent as "Glob" to Anthropic
		// - Received back as "Glob"
		// - fromClaudeCodeName("Glob", tools) looks for tool.name.toLowerCase() === "glob"
		// - No match (tool is named "find"), returns "Glob"
		// - Test fails: toolCallName is "Glob" instead of "find"
		//
		// With the CORRECT implementation (no find->Glob mapping):
		// 正确实现不做 find -> Glob 映射：
		// - Sent as "find" to Anthropic (no CC tool named "Find")
		// - Received back as "find"
		// - Test passes: toolCallName is "find"
		expect(toolCallName).toBe("find");
	});

	// 完全不匹配官方名称的自定义工具应从始至终保持原名。
	it("should handle custom tools that don't match any CC tool names", async () => {
		// A completely custom tool should pass through unchanged
		// 完全自定义工具名不应被任何规范化规则修改。
		// customTool 是没有 Claude Code 同名项的工具。
		const customTool: Tool = {
			name: "my_custom_tool",
			description: "A custom tool",
			parameters: Type.Object({
				input: Type.String({ description: "Input value" }),
			}),
		};

		// context 指示模型调用唯一的自定义工具。
		const context: Context = {
			systemPrompt: "You are a helpful assistant. Use my_custom_tool when asked.",
			messages: [
				{
					role: "user",
					content: "Use my_custom_tool with input 'hello'.",
					timestamp: Date.now(),
				},
			],
			tools: [customTool],
		};

		// s 是自定义工具的真实调用流。
		const s = stream(model, context, { apiKey: oauthToken });
		// toolCallName 保存最终返回名称。
		let toolCallName: string | undefined;

		for await (const event of s) {
			if (event.type === "toolcall_end") {
				// toolCall 是当前 toolcall_end 对应的内容块。
				const toolCall = event.partial.content[event.contentIndex];
				if (toolCall.type === "toolCall") {
					toolCallName = toolCall.name;
				}
			}
		}

		// response 确认响应以工具调用正常停止。
		const response = await s.result();
		expect(response.stopReason, `Error: ${response.errorMessage}`).toBe("toolUse");

		// Custom tool names should pass through unchanged
		// 自定义工具名应完全原样往返。
		expect(toolCallName).toBe("my_custom_tool");
	});
});
