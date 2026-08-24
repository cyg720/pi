/**
 * 文件职责：回归验证自动重试、扩展追加消息和并发命令期间 agent_settled 事件只在会话真正空闲后发出。
 * 技术维度：使用 coding-agent 测试 Harness、伪模型响应、可控 Promise 工具和扩展事件监听器模拟异步时序。
 * 产品维度：避免界面或扩展过早判断任务已结束，确保后续消息、重试和工具执行全部完成后再更新状态。
 * 逻辑维度：分别覆盖自动重试、agent_end 排队 follow-up，以及命令 waitForIdle 等待长工具的三条路径。
 * 关键边界：测试依赖手动释放 Promise 控制顺序；每个 Harness 必须在 afterEach 中清理。
 * 新手阅读建议：先理解 createWaitTool 的闸门 Promise，再按事件数组观察 agent_end 到 agent_settled 的时序。
 */
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { afterEach, describe, expect, it } from "vitest";
import { createHarness, getUserTexts, type Harness } from "../harness.ts";

/**
 * 创建一个在外部 Promise 完成前保持执行中的测试工具。
 * @param released 控制工具何时继续的 Promise。
 * @returns 名为 wait 的 AgentTool；例如 `createWaitTool(released)`。
 */
function createWaitTool(released: Promise<void>): AgentTool {
	return {
		name: "wait",
		label: "Wait",
		description: "Wait until released",
		parameters: Type.Object({}),
		execute: async () => {
			await released;
			return { content: [{ type: "text", text: "released" }], details: {} };
		},
	};
}

// 回归覆盖 issue #6363 中“模型轮次结束不等于会话已完全安定”的问题。
describe("regression #6363: agent settled event and idle waiting", () => {
	// harnesses 收集当前用例创建的测试宿主，便于统一清理。
	const harnesses: Harness[] = [];

	// 每个用例后按后进先出顺序清理所有 Harness 资源。
	afterEach(() => {
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
	});

	// 自动重试包含两个 agent_end，但最终只应产生一次 settled。
	it("emits one agent_settled event after automatic retry finishes", async () => {
		// extensionEvents 记录扩展层看到的结束与安定事件及空闲状态。
		const extensionEvents: string[] = [];
		// publicEvents 记录会话公开订阅接口发出的安定事件。
		const publicEvents: string[] = [];
		// harness 配置一次快速自动重试和两个扩展事件处理器。
		const harness = await createHarness({
			settings: { retry: { enabled: true, maxRetries: 3, baseDelayMs: 1 } },
			extensionFactories: [
				(pi) => {
					pi.on("agent_end", () => {
						extensionEvents.push("agent_end");
					});
					pi.on("agent_settled", (_event, ctx) => {
						extensionEvents.push(`agent_settled:${ctx.isIdle()}`);
					});
				},
			],
		});
		harnesses.push(harness);
		harness.session.subscribe((event) => {
			if (event.type === "agent_settled") {
				publicEvents.push("agent_settled");
			}
		});
		harness.setResponses([
			fauxAssistantMessage("", { stopReason: "error", errorMessage: "overloaded_error" }),
			fauxAssistantMessage("recovered"),
		]);

		await harness.session.prompt("test");

		expect(harness.eventsOfType("agent_end").map((event) => event.willRetry)).toEqual([true, false]);
		expect(harness.eventsOfType("agent_settled")).toHaveLength(1);
		expect(extensionEvents).toEqual(["agent_end", "agent_end", "agent_settled:true"]);
		expect(publicEvents).toEqual(["agent_settled"]);
	});

	// agent_end 扩展排入的 follow-up 完成前不得发出 settled。
	it("settles only after follow-ups queued by agent_end handlers run", async () => {
		// queuedFollowUp 防止第二次 agent_end 再次无限排入消息。
		let queuedFollowUp = false;
		// settledIdleStates 保存扩展收到 settled 时 ctx.isIdle() 的结果。
		const settledIdleStates: boolean[] = [];
		// harness 安装会追加一次 follow-up 的结束处理器和安定状态观察器。
		const harness = await createHarness({
			extensionFactories: [
				(pi) => {
					pi.on("agent_end", () => {
						if (queuedFollowUp) return;
						queuedFollowUp = true;
						pi.sendUserMessage("status follow-up", { deliverAs: "followUp" });
					});
					pi.on("agent_settled", (_event, ctx) => {
						settledIdleStates.push(ctx.isIdle());
					});
				},
			],
		});
		harnesses.push(harness);
		harness.setResponses([fauxAssistantMessage("first"), fauxAssistantMessage("second")]);

		await harness.session.prompt("hello");

		expect(getUserTexts(harness)).toEqual(["hello", "status follow-up"]);
		expect(harness.eventsOfType("agent_end")).toHaveLength(2);
		expect(harness.eventsOfType("agent_settled")).toHaveLength(1);
		expect(settledIdleStates).toEqual([true]);
	});

	// 扩展命令调用 waitForIdle 时应等待整个会话而非当前模型响应。
	it("extension command waitForIdle waits for session-level settlement", async () => {
		// releaseTool 是外部释放 wait 工具 Promise 的函数，创建 Promise 后会被替换。
		let releaseTool = () => {};
		// released 控制测试工具保持阻塞或继续完成。
		const released = new Promise<void>((resolve) => {
			releaseTool = resolve;
		});
		// markCommandStarted 在命令进入处理器时解除 commandStarted Promise。
		let markCommandStarted = () => {};
		// commandStarted 让测试确认命令已开始等待后再检查未完成状态。
		const commandStarted = new Promise<void>((resolve) => {
			markCommandStarted = resolve;
		});
		// commandResults 记录 waitForIdle 返回后命令上下文报告的空闲状态。
		const commandResults: boolean[] = [];
		// harness 注册受控 wait 工具和调用 ctx.waitForIdle 的扩展命令。
		const harness = await createHarness({
			tools: [createWaitTool(released)],
			extensionFactories: [
				(pi) => {
					pi.registerCommand("after-idle", {
						description: "Wait for idle",
						handler: async (_args, ctx) => {
							markCommandStarted();
							await ctx.waitForIdle();
							commandResults.push(ctx.isIdle());
						},
					});
				},
			],
		});
		harnesses.push(harness);
		await harness.session.bindExtensions({
			commandContextActions: {
				waitForIdle: () => harness.session.waitForIdle(),
				newSession: async () => ({ cancelled: false }),
				fork: async () => ({ cancelled: false }),
				navigateTree: async () => ({ cancelled: false }),
				switchSession: async () => ({ cancelled: false }),
				reload: async () => {},
			},
		});
		// toolStarted 在 wait 工具真正开始执行时完成，并自动取消临时订阅。
		const toolStarted = new Promise<void>((resolve) => {
			// unsubscribe 是一次性事件订阅的清理函数，在命中目标事件时立即调用。
			const unsubscribe = harness.session.subscribe((event) => {
				if (event.type === "tool_execution_start" && event.toolName === "wait") {
					unsubscribe();
					resolve();
				}
			});
		});
		harness.setResponses([
			fauxAssistantMessage(fauxToolCall("wait", {}), { stopReason: "toolUse" }),
			fauxAssistantMessage("done"),
		]);

		// promptPromise 表示触发 wait 工具的主用户提示尚在运行。
		const promptPromise = harness.session.prompt("start");
		await toolStarted;
		// commandPromise 表示并发执行的 /after-idle 扩展命令。
		const commandPromise = harness.session.prompt("/after-idle");
		await commandStarted;
		// commandFinished 标记命令 Promise 是否已经结束，释放工具前应保持 false。
		let commandFinished = false;
		void commandPromise.then(() => {
			commandFinished = true;
		});
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(commandFinished).toBe(false);

		releaseTool();
		await Promise.all([promptPromise, commandPromise]);

		expect(commandResults).toEqual([true]);
		expect(harness.eventsOfType("agent_settled")).toHaveLength(1);
	});
});
