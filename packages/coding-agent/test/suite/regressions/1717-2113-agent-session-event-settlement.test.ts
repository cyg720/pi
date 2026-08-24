/**
 * 文件职责：回归验证异步扩展事件不会打乱助手、工具结果的持久化顺序和 tool_call 时机。
 * 技术维度：使用 Vitest、faux 模型、会话夹具、自定义 echo 工具和异步事件监听器。
 * 产品维度：保证扩展暂停事件处理时，会话树仍按用户可理解的对话和工具调用顺序保存。
 * 逻辑维度：第一例延迟 message_end 并检查消息顺序，第二例在 tool_call 时拍摄分支角色快照。
 * 关键边界：使用虚拟提供商，不访问真实模型；所有夹具必须在 afterEach 中释放。
 * 新手阅读建议：先看 createEchoTool，再比较“事件处理延迟”和“事件触发时分支状态”两例。
 */
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { afterEach, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "../harness.ts";

/**
 * 创建把 text 参数原样返回的测试工具。
 * 参数：无。
 * 返回值：名为 echo 的 AgentTool。
 * 使用示例：`tools: [createEchoTool()]`。
 */
function createEchoTool(): AgentTool {
	return {
		name: "echo",
		label: "Echo",
		description: "Echo text back",
		parameters: Type.Object({ text: Type.String() }),
		// _toolCallId 在本工具中无需使用，params 是可能包含 text 的调用参数。
		execute: async (_toolCallId, params) => {
			// text 是安全提取并转换后的回显内容，缺失时为空字符串。
			const text = typeof params === "object" && params !== null && "text" in params ? String(params.text) : "";
			return { content: [{ type: "text", text }], details: { text } };
		},
	};
}

describe("regressions #1717/#2113: agent session event settlement", () => {
	// harnesses 保存本测试组创建的会话夹具，便于统一清理。
	const harnesses: Harness[] = [];

	// 每例后清理全部夹具；无参数，无返回值。
	afterEach(() => {
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
	});

	// 验证异步 message_end 让出控制权时消息持久化顺序仍正确；无参数，无返回值。
	it("keeps persisted assistant/toolResult message order when extension message_end handlers yield", async () => {
		// harness 注册 echo 工具，并让助手消息结束处理器等待 20 毫秒。
		const harness = await createHarness({
			tools: [createEchoTool()],
			extensionFactories: [
				// pi 是扩展 API，用于监听 message_end。
				(pi) => {
					// event 是已结束的消息事件，仅延迟助手消息。
					pi.on("message_end", async (event) => {
						if (event.message.role === "assistant") {
							// resolve 是 20 毫秒后完成延迟的回调。
							await new Promise((resolve) => setTimeout(resolve, 20));
						}
					});
				},
			],
		});
		harnesses.push(harness);
		harness.setResponses([
			fauxAssistantMessage([fauxToolCall("echo", { text: "one" }), fauxToolCall("echo", { text: "two" })], {
				stopReason: "toolUse",
			}),
			fauxAssistantMessage("done"),
		]);
		await harness.session.prompt("run tools");

		// branchMessages 是当前分支中按持久化顺序提取的全部消息。
		const branchMessages = harness.sessionManager
			.getBranch()
			// entry 是当前会话树条目，先保留消息条目再取 message。
			.filter((entry) => entry.type === "message")
			.map((entry) => entry.message);
		// message 是当前分支消息，回调提取角色用于顺序断言。
		expect(branchMessages.map((message) => message.role)).toEqual([
			"user",
			"assistant",
			"toolResult",
			"toolResult",
			"assistant",
		]);
		// firstToolResultIndex 是首条工具结果在分支消息中的位置。
		const firstToolResultIndex = branchMessages.findIndex((message) => message.role === "toolResult");
		expect(firstToolResultIndex).toBeGreaterThan(0);
		expect(branchMessages[firstToolResultIndex - 1]?.role).toBe("assistant");
	});

	// 验证 tool_call 触发前助手工具调用消息已进入会话分支；无参数，无返回值。
	it("runs tool_call handlers after the assistant tool-use message is settled in the session", async () => {
		// harness 稍后赋值，使扩展回调能够读取同一夹具。
		let harness: Harness;
		// branchRolesAtToolCall 保存每次 tool_call 事件观察到的分支角色列表。
		const branchRolesAtToolCall: string[][] = [];
		harness = await createHarness({
			tools: [createEchoTool()],
			extensionFactories: [
				// pi 是扩展 API，用于监听 tool_call。
				(pi) => {
					// 回调在工具调用时同步拍摄已持久化分支角色。
					pi.on("tool_call", () => {
						branchRolesAtToolCall.push(
							harness.sessionManager
								.getBranch()
								// entry 是当前分支条目，只保留消息并提取其角色。
								.filter((entry) => entry.type === "message")
								.map((entry) => entry.message.role),
						);
					});
				},
			],
		});
		harnesses.push(harness);
		harness.setResponses([
			fauxAssistantMessage([fauxToolCall("echo", { text: "hello" })], { stopReason: "toolUse" }),
			fauxAssistantMessage("done"),
		]);

		await harness.session.prompt("run tool");

		expect(branchRolesAtToolCall).toEqual([["user", "assistant"]]);
	});
});
