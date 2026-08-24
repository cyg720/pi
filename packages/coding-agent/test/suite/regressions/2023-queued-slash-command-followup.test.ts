/**
 * 文件职责：回归验证扩展排队发送的斜杠开头 follow-up 会作为普通用户文本交给模型。
 * 技术维度：使用 Vitest、faux 模型、测试夹具、自定义等待工具和扩展命令注册接口。
 * 产品维度：防止扩展生成的跟进文本意外触发本地命令，确保自动化对话语义正确。
 * 逻辑维度：阻塞工具执行，排队 `/testcmd` 文本，释放工具后检查命令未运行且模型收到文本。
 * 关键边界：仅覆盖 deliverAs 为 followUp 的扩展消息；测试夹具必须在 afterEach 中清理。
 * 新手阅读建议：先看 wait 工具如何制造排队窗口，再看扩展命令计数和最终三组断言。
 */
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { afterEach, describe, expect, it } from "vitest";
import { createHarness, getAssistantTexts, getUserTexts, type Harness } from "../harness.ts";

describe("issue #2023 queued slash-command follow-up", () => {
	// harnesses 保存本测试组创建的夹具，供用例结束后统一释放。
	const harnesses: Harness[] = [];

	// 清理所有剩余夹具；无参数，无返回值。
	afterEach(() => {
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
	});

	// 验证扩展排队的斜杠文本不会分派成本地命令；无参数，无返回值。
	it("treats extension-origin queued slash-command follow-ups as raw user text instead of dispatching the command", async () => {
		// extensionApi 保存扩展工厂获得的 API，工厂运行前允许为 undefined。
		let extensionApi: ExtensionAPI | undefined;
		// commandRuns 记录 testcmd 真正执行时收到的参数，预期保持为空。
		const commandRuns: string[] = [];
		// releaseToolExecution 是外部释放等待工具的可选回调。
		let releaseToolExecution: (() => void) | undefined;
		// toolRelease 是等待显式释放信号的 Promise。
		const toolRelease = new Promise<void>((resolve) => {
			// resolve 是完成等待 Promise 的回调，将其暴露给测试后续步骤。
			releaseToolExecution = resolve;
		});
		// waitTool 是执行时阻塞到 toolRelease 完成的测试工具。
		const waitTool: AgentTool = {
			name: "wait",
			label: "Wait",
			description: "Wait for the test to release execution",
			parameters: Type.Object({}),
			execute: async () => {
				await toolRelease;
				return {
					content: [{ type: "text", text: "released" }],
					details: {},
				};
			},
		};
		// harness 是注册等待工具和 testcmd 扩展命令的虚拟会话环境。
		const harness = await createHarness({
			tools: [waitTool],
			extensionFactories: [
				// pi 是当前扩展 API，用于保存引用并注册测试命令。
				(pi) => {
					extensionApi = pi;
					pi.registerCommand("testcmd", {
						description: "Test command",
						// args 是命令真正执行时的参数，写入 commandRuns 供断言。
						handler: async (args) => {
							commandRuns.push(args);
						},
					});
				},
			],
		});
		harnesses.push(harness);

		harness.setResponses([
			fauxAssistantMessage(fauxToolCall("wait", {}), { stopReason: "toolUse" }),
			fauxAssistantMessage("first turn complete"),
			fauxAssistantMessage("queued follow-up handled by model"),
		]);

		// sawToolStart 在 wait 工具开始执行时解决，确保后续消息确实进入排队路径。
		const sawToolStart = new Promise<void>((resolve) => {
			// resolve 是观察到目标工具事件后完成 Promise 的回调。
			// unsubscribe 是会话事件取消订阅函数，目标事件出现后立即调用。
			const unsubscribe = harness.session.subscribe((event) => {
				// event 是当前会话事件，只关注 wait 工具的执行开始。
				if (event.type === "tool_execution_start" && event.toolName === "wait") {
					unsubscribe();
					resolve();
				}
			});
		});

		// promptPromise 保存首轮提示词及其工具调用全部完成的 Promise。
		const promptPromise = harness.session.prompt("start");
		await sawToolStart;
		// resolve 在下一轮事件循环解决，给工具状态传播留出时间。
		await new Promise((resolve) => setTimeout(resolve, 0));

		extensionApi?.sendUserMessage("/testcmd queued", { deliverAs: "followUp" });
		releaseToolExecution?.();
		await promptPromise;

		expect(commandRuns).toEqual([]);
		expect(getUserTexts(harness)).toEqual(["start", "/testcmd queued"]);
		expect(getAssistantTexts(harness)).toContain("queued follow-up handled by model");
	});
});
