/**
 * The Message types require `content` to always be present, but untyped JS
 * extension tools, hand-built histories, and old or hand-edited session files
 * can violate that contract. We are intentionally lax at the ingestion
 * boundaries and normalize null/missing content to an empty array so it never
 * reaches rendering, compaction, or provider request conversion
 * (issues #6259, #6276).
 */
/**
 * 文件职责：验证不受类型约束的扩展和旧会话传入 null/缺失 content 时，会在入口边界统一归一化为空数组。
 * 技术维度：使用 Harness、伪模型响应、TypeBox 自定义工具和 SessionEntry 转换覆盖运行时与持久化两条路径。
 * 产品维度：防止手写扩展或历史会话的畸形消息导致渲染、压缩或提供商请求崩溃。
 * 逻辑维度：依次测试工具结果、message_end 替换、自定义消息、会话加载，以及合法内容保持不变。
 * 关键边界：这里只在不可信输入边界放宽约束，内部 Message 类型仍要求 content 存在。
 * 新手阅读建议：先看 messageEntry 如何伪造旧会话记录，再比较每个入口归一化后的 session.messages。
 */

import type { AgentMessage, AgentToolResult } from "@earendil-works/pi-agent-core";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { describe, expect, it } from "vitest";
import { type SessionEntry, sessionEntryToContextMessages } from "../../src/core/session-manager.ts";
import type { ExtensionFactory } from "../../src/index.ts";
import { createHarness } from "./harness.ts";

/**
 * 把松散消息对象包装成最小会话消息条目。
 * @param message 可能缺少或含 null content 的未知消息结构。
 * @returns 经测试断言消费的 SessionEntry；例如 `messageEntry({ role: "user" })`。
 */
function messageEntry(message: Record<string, unknown>): SessionEntry {
	return {
		type: "message",
		id: "entry-1",
		parentId: null,
		timestamp: new Date().toISOString(),
		message,
	} as unknown as SessionEntry;
}

// 验证各种不可信消息入口都执行相同的 content 归一化规则。
describe("lax message content handling", () => {
	// 未声明 content 的 JavaScript 工具结果应变成空内容数组并可继续下一轮。
	it("normalizes tool results from untyped tools that omit content", async () => {
		// extensionFactories 注册一个故意返回不完整结果的自定义工具。
		const extensionFactories: ExtensionFactory[] = [
			(pi) => {
				pi.registerTool({
					name: "web_search",
					label: "Web Search",
					description: "Custom tool that returns a result without content",
					parameters: Type.Object({}),
					// Simulate an untyped JS extension tool that omits content.
					// 模拟未受 TypeScript 约束且遗漏 content 的 JavaScript 扩展工具。
					execute: async () => ({ details: {} }) as unknown as AgentToolResult<unknown>,
				});
			},
		];
		// harness 承载扩展工具和伪模型响应，测试结束后必须清理。
		const harness = await createHarness({ extensionFactories });

		try {
			harness.setResponses([
				fauxAssistantMessage(fauxToolCall("web_search", {}), { stopReason: "toolUse" }),
				fauxAssistantMessage("done"),
			]);

			await harness.session.prompt("search something");

			// toolResults 只保留会话中归一化后的工具结果消息。
			const toolResults = harness.session.messages.filter((message) => message.role === "toolResult");
			expect(toolResults).toHaveLength(1);
			expect(toolResults[0].content).toEqual([]);
			// The follow-up turn consumed the normalized tool result without crashing.
			// 后续模型轮次已消费归一化结果且没有崩溃，因此待响应数为 0。
			expect(harness.getPendingResponseCount()).toBe(0);
		} finally {
			harness.cleanup();
		}
	});

	// message_end 扩展把助手 content 改为 null 时也应在写入会话前修复。
	it("normalizes null content in message_end extension replacements", async () => {
		// extensionFactories 注册一个故意返回 null content 助手消息的结束处理器。
		const extensionFactories: ExtensionFactory[] = [
			(pi) => {
				pi.on("message_end", async (event) => {
					if (event.message.role !== "assistant") return undefined;
					// Simulate an untyped JS extension replacing a message without content.
					// 模拟未受类型约束的扩展用 null content 替换助手消息。
					return { message: { ...event.message, content: null } as unknown as AgentMessage };
				});
			},
		];
		// harness 加载上述消息替换扩展。
		const harness = await createHarness({ extensionFactories });

		try {
			harness.setResponses([fauxAssistantMessage("hello")]);
			await harness.session.prompt("hi");

			// assistantMessages 是会话最终保存的助手消息集合。
			const assistantMessages = harness.session.messages.filter((message) => message.role === "assistant");
			expect(assistantMessages).toHaveLength(1);
			expect(assistantMessages[0].content).toEqual([]);
		} finally {
			harness.cleanup();
		}
	});

	// 扩展直接发送的自定义消息同样不能让 null 进入内部消息历史。
	it("normalizes null content in custom messages from extensions", async () => {
		// harness 使用默认扩展环境，只测试公开 sendCustomMessage 入口。
		const harness = await createHarness();

		try {
			await harness.session.sendCustomMessage({
				customType: "test",
				content: null as unknown as string,
				display: false,
				details: undefined,
			});

			// customMessages 是会话中保存的自定义消息。
			const customMessages = harness.session.messages.filter((message) => message.role === "custom");
			expect(customMessages).toHaveLength(1);
			expect(customMessages[0].content).toEqual([]);
		} finally {
			harness.cleanup();
		}
	});

	// 加载旧会话时，用户、助手和工具结果的 null 或缺失 content 都应转为空数组。
	it("normalizes null or missing content when loading session message entries", () => {
		// badMessages 覆盖三种角色以及 null/完全缺失两类畸形内容。
		const badMessages = [
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
		];

		for (const badMessage of badMessages) {
			// message 是单个会话条目转换出的规范化上下文消息。
			const [message] = sessionEntryToContextMessages(messageEntry(badMessage));
			expect(message).toMatchObject({ role: badMessage.role, content: [] });
		}
	});

	// custom_message 类型的旧会话条目也应用相同归一化规则。
	it("normalizes null content when loading custom message entries", () => {
		// entry 模拟磁盘中 content 为 null 的自定义消息条目。
		const entry = {
			type: "custom_message",
			id: "entry-1",
			parentId: null,
			timestamp: new Date().toISOString(),
			customType: "test",
			content: null,
			display: false,
			details: undefined,
		} as unknown as SessionEntry;

		// message 是从自定义条目生成的统一上下文消息。
		const [message] = sessionEntryToContextMessages(entry);
		expect(message).toMatchObject({ role: "custom", content: [] });
	});

	// 合法字符串内容不得因防御性归一化而改变。
	it("keeps valid message content untouched when loading session entries", () => {
		// message 是由合法用户消息条目转换出的上下文消息。
		const [message] = sessionEntryToContextMessages(
			messageEntry({ role: "user", content: "hello", timestamp: Date.now() }),
		);
		expect(message).toMatchObject({ role: "user", content: "hello" });
	});
});
