/**
 * 文件职责：刻画并验证 AgentSession 在运行中接收 steering、follow-up、自定义消息和扩展命令时的队列语义。
 * 技术维度：使用 faux provider、可阻塞测试工具、扩展 API、会话事件订阅和 Vitest 异步断言。
 * 产品维度：确保用户在代理忙碌时追加或纠正任务，消息仍按所选模式、顺序和生命周期可靠送达。
 * 逻辑维度：创建等待工具控制运行窗口，再覆盖立即命令、逐条/批量队列、自定义消息及事件边界。
 * 关键边界：测试依靠显式释放 wait 工具避免竞态；扩展命令不能作为 steering 或 follow-up 排队。
 * 新手阅读建议：先读 createWaitingHarness，再比较 steer 与 followUp，随后看 all 模式和 agent_end 用例。
 */
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { afterEach, describe, expect, it } from "vitest";
import { createHarness, getAssistantTexts, getMessageText, getUserTexts, type Harness } from "./harness.ts";

/** 创建带阻塞 wait 工具的会话夹具。参数 options 可追加工具和扩展；返回夹具、释放函数及两个同步 Promise。例如：await createWaitingHarness()。 */
async function createWaitingHarness(
	options: {
		/** 除内置 wait 工具外需要注册的额外工具。 */
		tools?: AgentTool[];
		/** 创建夹具时执行的扩展注册工厂。 */
		extensionFactories?: Harness["session"]["extensionRunner"] extends never
			? never
			: Array<(pi: ExtensionAPI) => void>;
	} = {},
): Promise<{
	/** 创建完成并已配置 wait 工具的测试夹具。 */
	harness: Harness;
	/** 允许测试继续完成 wait 工具调用的释放函数。 */
	releaseToolExecution: () => void;
	/** 从 start 提示开始的完整会话运行 Promise。 */
	promptPromise: Promise<void>;
	/** 在 wait 工具开始执行时完成的 Promise。 */
	waitForToolStart: Promise<void>;
}> {
	/** 解除 wait 工具阻塞的回调；创建 Promise 前可能暂为 undefined。 */
	let releaseToolExecution: (() => void) | undefined;
	/** 等待测试显式释放后才完成的 Promise。 */
	const toolRelease = new Promise<void>((resolve) => {
		releaseToolExecution = resolve;
	});
	/** 通过 toolRelease 阻塞执行的测试工具，用于稳定制造会话忙碌窗口。 */
	const waitTool: AgentTool = {
		name: "wait",
		label: "Wait",
		description: "Wait for release",
		parameters: Type.Object({}),
		/** 等待释放信号后返回固定工具结果。无参数；返回 AgentToolResult Promise。例如：await waitTool.execute(...)。 */
		execute: async () => {
			await toolRelease;
			return {
				content: [{ type: "text", text: "released" }],
				details: {},
			};
		},
	};
	/** 当前用例的会话测试夹具。 */
	const harness = await createHarness({
		tools: [waitTool, ...(options.tools ?? [])],
		extensionFactories: options.extensionFactories,
	});

	/** 在 wait 工具发出执行开始事件后完成的同步 Promise。 */
	const waitForToolStart = new Promise<void>((resolve) => {
		/** 取消当前会话事件订阅的函数，首次匹配后立即调用。 */
		const unsubscribe = harness.session.subscribe((event) => {
			if (event.type === "tool_execution_start" && event.toolName === "wait") {
				unsubscribe();
				resolve();
			}
		});
	});

	return {
		harness,
		releaseToolExecution: () => releaseToolExecution?.(),
		promptPromise: harness.session.prompt("start"),
		waitForToolStart,
	};
}

describe("AgentSession queue characterization", () => {
	/** 本 describe 创建的全部夹具，afterEach 中统一清理。 */
	const harnesses: Harness[] = [];

	afterEach(() => {
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
	});

	// 测试场景：验证“dispatches extension commands immediately when prompted while idle”对应的消息队列行为。
	it("dispatches extension commands immediately when prompted while idle", async () => {
		/** 扩展命令实际收到的参数列表。 */
		const commandRuns: string[] = [];
		/** 当前用例的会话测试夹具。 */
		const harness = await createHarness({
			extensionFactories: [
				(pi) => {
					pi.registerCommand("testcmd", {
						description: "Test command",
						handler: async (args) => {
							commandRuns.push(args);
						},
					});
				},
			],
		});
		harnesses.push(harness);

		await harness.session.prompt("/testcmd hello world");

		expect(commandRuns).toEqual(["hello world"]);
		expect(harness.getPendingResponseCount()).toBe(0);
		expect(harness.session.messages).toEqual([]);
	});

	// 测试场景：验证“delivers extension-origin steering messages before the next LLM call”对应的消息队列行为。
	it("delivers extension-origin steering messages before the next LLM call", async () => {
		/** 测试扩展初始化时捕获的 API，用于从扩展侧发送消息。 */
		let extensionApi: ExtensionAPI | undefined;
		/** 同时包含夹具、阻塞释放函数和等待 Promise 的控制对象。 */
		const waiting = await createWaitingHarness({
			extensionFactories: [
				(pi) => {
					extensionApi = pi;
				},
			],
		});
		/** 当前用例的会话测试夹具。 */
		const { harness, waitForToolStart, promptPromise, releaseToolExecution } = waiting;
		harnesses.push(harness);

		harness.setResponses([
			fauxAssistantMessage(fauxToolCall("wait", {}), { stopReason: "toolUse" }),
			(context) => {
				/** 模型上下文中是否出现预期 steering 文本。 */
				const sawSteer = context.messages.some(
					(message) => message.role === "user" && getMessageText(message) === "steer now",
				);
				return fauxAssistantMessage(sawSteer ? "saw steer" : "missing steer");
			},
		]);

		await waitForToolStart;
		await new Promise((resolve) => setTimeout(resolve, 0));

		extensionApi?.sendUserMessage("steer now", { deliverAs: "steer" });
		releaseToolExecution();
		await promptPromise;

		expect(getUserTexts(harness)).toEqual(["start", "steer now"]);
		expect(getAssistantTexts(harness)).toContain("saw steer");
	});

	// 测试场景：验证“delivers follow-up messages only after the current run finishes”对应的消息队列行为。
	it("delivers follow-up messages only after the current run finishes", async () => {
		/** 同时包含夹具、阻塞释放函数和等待 Promise 的控制对象。 */
		const waiting = await createWaitingHarness();
		/** 当前用例的会话测试夹具。 */
		const { harness, waitForToolStart, promptPromise, releaseToolExecution } = waiting;
		harnesses.push(harness);
		/** follow-up 模型调用前已存在的助手文本列表。 */
		const assistantSeenBeforeFollowUp: string[] = [];

		harness.setResponses([
			fauxAssistantMessage(fauxToolCall("wait", {}), { stopReason: "toolUse" }),
			(context) => {
				assistantSeenBeforeFollowUp.push(
					...context.messages
						.filter((message) => message.role === "assistant")
						.map((message) =>
							message.content
								.filter((part): part is { type: "text"; text: string } => part.type === "text")
								.map((part) => part.text)
								.join("\n"),
						),
				);
				return fauxAssistantMessage("follow-up response");
			},
		]);

		await waitForToolStart;
		await harness.session.followUp("after current run");
		releaseToolExecution();
		await promptPromise;

		expect(getUserTexts(harness)).toEqual(["start", "after current run"]);
		expect(assistantSeenBeforeFollowUp).toContain("");
		expect(getAssistantTexts(harness)).toContain("follow-up response");
	});

	// 测试场景：验证“delivers multiple steering messages in order in one-at-a-time mode”对应的消息队列行为。
	it("delivers multiple steering messages in order in one-at-a-time mode", async () => {
		/** 同时包含夹具、阻塞释放函数和等待 Promise 的控制对象。 */
		const waiting = await createWaitingHarness();
		/** 当前用例的会话测试夹具。 */
		const { harness, waitForToolStart, promptPromise, releaseToolExecution } = waiting;
		harnesses.push(harness);

		harness.setResponses([
			fauxAssistantMessage(fauxToolCall("wait", {}), { stopReason: "toolUse" }),
			fauxAssistantMessage("handled steer 1"),
			fauxAssistantMessage("handled steer 2"),
		]);

		await waitForToolStart;
		await harness.session.steer("steer 1");
		await harness.session.steer("steer 2");
		releaseToolExecution();
		await promptPromise;

		expect(getUserTexts(harness)).toEqual(["start", "steer 1", "steer 2"]);
		expect(getAssistantTexts(harness)).toEqual(["", "handled steer 1", "handled steer 2"]);
	});

	// 测试场景：验证“delivers multiple follow-up messages in order in one-at-a-time mode”对应的消息队列行为。
	it("delivers multiple follow-up messages in order in one-at-a-time mode", async () => {
		/** 同时包含夹具、阻塞释放函数和等待 Promise 的控制对象。 */
		const waiting = await createWaitingHarness();
		/** 当前用例的会话测试夹具。 */
		const { harness, waitForToolStart, promptPromise, releaseToolExecution } = waiting;
		harnesses.push(harness);

		harness.setResponses([
			fauxAssistantMessage(fauxToolCall("wait", {}), { stopReason: "toolUse" }),
			fauxAssistantMessage("original turn complete"),
			fauxAssistantMessage("handled follow-up 1"),
			fauxAssistantMessage("handled follow-up 2"),
		]);

		await waitForToolStart;
		await harness.session.followUp("follow-up 1");
		await harness.session.followUp("follow-up 2");
		releaseToolExecution();
		await promptPromise;

		expect(getUserTexts(harness)).toEqual(["start", "follow-up 1", "follow-up 2"]);
		expect(getAssistantTexts(harness)).toEqual([
			"",
			"original turn complete",
			"handled follow-up 1",
			"handled follow-up 2",
		]);
	});

	// 测试场景：验证“delivers all steering messages in one batch in all mode”对应的消息队列行为。
	it("delivers all steering messages in one batch in all mode", async () => {
		/** 同时包含夹具、阻塞释放函数和等待 Promise 的控制对象。 */
		const waiting = await createWaitingHarness();
		/** 当前用例的会话测试夹具。 */
		const { harness, waitForToolStart, promptPromise, releaseToolExecution } = waiting;
		harnesses.push(harness);
		harness.session.setSteeringMode("all");
		/** 批量模式下单次模型调用看到的用户消息文本。 */
		let batchedUserMessages: string[] = [];

		harness.setResponses([
			fauxAssistantMessage(fauxToolCall("wait", {}), { stopReason: "toolUse" }),
			(context) => {
				batchedUserMessages = context.messages
					.filter((message) => message.role === "user")
					.map((message) => getMessageText(message));
				return fauxAssistantMessage("batched steer response");
			},
		]);

		await waitForToolStart;
		await harness.session.steer("steer 1");
		await harness.session.steer("steer 2");
		releaseToolExecution();
		await promptPromise;

		expect(batchedUserMessages).toEqual(["start", "steer 1", "steer 2"]);
		expect(getAssistantTexts(harness)).toEqual(["", "batched steer response"]);
	});

	// 测试场景：验证“delivers all follow-up messages in one batch in all mode”对应的消息队列行为。
	it("delivers all follow-up messages in one batch in all mode", async () => {
		/** 同时包含夹具、阻塞释放函数和等待 Promise 的控制对象。 */
		const waiting = await createWaitingHarness();
		/** 当前用例的会话测试夹具。 */
		const { harness, waitForToolStart, promptPromise, releaseToolExecution } = waiting;
		harnesses.push(harness);
		harness.session.setFollowUpMode("all");
		/** 批量模式下单次模型调用看到的用户消息文本。 */
		let batchedUserMessages: string[] = [];

		harness.setResponses([
			fauxAssistantMessage(fauxToolCall("wait", {}), { stopReason: "toolUse" }),
			fauxAssistantMessage("original turn complete"),
			(context) => {
				batchedUserMessages = context.messages
					.filter((message) => message.role === "user")
					.map((message) => getMessageText(message));
				return fauxAssistantMessage("batched follow-up response");
			},
		]);

		await waitForToolStart;
		await harness.session.followUp("follow-up 1");
		await harness.session.followUp("follow-up 2");
		releaseToolExecution();
		await promptPromise;

		expect(batchedUserMessages).toEqual(["start", "follow-up 1", "follow-up 2"]);
		expect(getAssistantTexts(harness)).toEqual(["", "original turn complete", "batched follow-up response"]);
	});

	// 测试场景：验证“queues custom messages with deliverAs steer while streaming”对应的消息队列行为。
	it("queues custom messages with deliverAs steer while streaming", async () => {
		/** 同时包含夹具、阻塞释放函数和等待 Promise 的控制对象。 */
		const waiting = await createWaitingHarness();
		/** 当前用例的会话测试夹具。 */
		const { harness, waitForToolStart, promptPromise, releaseToolExecution } = waiting;
		harnesses.push(harness);
		/** 模型上下文中是否出现指定自定义消息内容。 */
		let sawCustomMessage = false;

		harness.setResponses([
			fauxAssistantMessage(fauxToolCall("wait", {}), { stopReason: "toolUse" }),
			(context) => {
				sawCustomMessage = context.messages.some(
					(message) =>
						message.role === "user" &&
						typeof message.content !== "string" &&
						message.content.some((part) => part.type === "text" && part.text === "steer custom"),
				);
				return fauxAssistantMessage("done");
			},
		]);

		await waitForToolStart;
		await harness.session.sendCustomMessage(
			{ customType: "queue-test", content: "steer custom", display: true, details: { value: 1 } },
			{ deliverAs: "steer" },
		);
		releaseToolExecution();
		await promptPromise;

		expect(sawCustomMessage).toBe(true);
		expect(
			harness.session.messages.some((message) => message.role === "custom" && message.customType === "queue-test"),
		).toBe(true);
	});

	// 测试场景：验证“queues custom messages with deliverAs followUp while streaming”对应的消息队列行为。
	it("queues custom messages with deliverAs followUp while streaming", async () => {
		/** 同时包含夹具、阻塞释放函数和等待 Promise 的控制对象。 */
		const waiting = await createWaitingHarness();
		/** 当前用例的会话测试夹具。 */
		const { harness, waitForToolStart, promptPromise, releaseToolExecution } = waiting;
		harnesses.push(harness);
		/** 模型上下文中是否出现指定自定义消息内容。 */
		let sawCustomMessage = false;

		harness.setResponses([
			fauxAssistantMessage(fauxToolCall("wait", {}), { stopReason: "toolUse" }),
			fauxAssistantMessage("original turn complete"),
			(context) => {
				sawCustomMessage = context.messages.some(
					(message) =>
						message.role === "user" &&
						typeof message.content !== "string" &&
						message.content.some((part) => part.type === "text" && part.text === "follow-up custom"),
				);
				return fauxAssistantMessage("done");
			},
		]);

		await waitForToolStart;
		await harness.session.sendCustomMessage(
			{ customType: "queue-test", content: "follow-up custom", display: true, details: { value: 1 } },
			{ deliverAs: "followUp" },
		);
		releaseToolExecution();
		await promptPromise;

		expect(sawCustomMessage).toBe(true);
		expect(
			harness.session.messages.some((message) => message.role === "custom" && message.customType === "queue-test"),
		).toBe(true);
	});

	// 测试场景：验证“injects nextTurn custom messages into the next prompt”对应的消息队列行为。
	it("injects nextTurn custom messages into the next prompt", async () => {
		/** 当前用例的会话测试夹具。 */
		const harness = await createHarness();
		harnesses.push(harness);
		/** 模型上下文中是否出现指定自定义消息内容。 */
		let sawCustomMessage = false;

		await harness.session.sendCustomMessage(
			{ customType: "next-turn", content: "carry this", display: true, details: {} },
			{ deliverAs: "nextTurn" },
		);

		harness.setResponses([
			(context) => {
				sawCustomMessage = context.messages.some(
					(message) =>
						message.role === "user" &&
						typeof message.content !== "string" &&
						message.content.some((part) => part.type === "text" && part.text === "carry this"),
				);
				return fauxAssistantMessage("done");
			},
		]);

		await harness.session.prompt("normal prompt");

		expect(sawCustomMessage).toBe(true);
		expect(harness.session.messages.map((message) => message.role)).toEqual(["user", "custom", "assistant"]);
	});

	// 测试场景：验证“updates pendingMessageCount and removes queued text before message_start is emitted”对应的消息队列行为。
	it("updates pendingMessageCount and removes queued text before message_start is emitted", async () => {
		/** 同时包含夹具、阻塞释放函数和等待 Promise 的控制对象。 */
		const waiting = await createWaitingHarness();
		/** 当前用例的会话测试夹具。 */
		const { harness, waitForToolStart, promptPromise, releaseToolExecution } = waiting;
		harnesses.push(harness);
		/** 排队消息触发 message_start 时记录的 pendingMessageCount。 */
		const countsAtQueuedMessageStart: number[] = [];

		harness.setResponses([
			fauxAssistantMessage(fauxToolCall("wait", {}), { stopReason: "toolUse" }),
			fauxAssistantMessage("done"),
		]);

		harness.session.subscribe((event) => {
			if (
				event.type === "message_start" &&
				event.message.role === "user" &&
				getMessageText(event.message) === "queued"
			) {
				countsAtQueuedMessageStart.push(harness.session.pendingMessageCount);
			}
		});

		await waitForToolStart;
		await harness.session.steer("queued");
		expect(harness.session.pendingMessageCount).toBe(1);
		releaseToolExecution();
		await promptPromise;

		expect(countsAtQueuedMessageStart).toEqual([0]);
		expect(harness.session.pendingMessageCount).toBe(0);
	});

	// 测试场景：验证“throws when queueing an extension command with steer”对应的消息队列行为。
	it("throws when queueing an extension command with steer", async () => {
		/** 当前用例的会话测试夹具。 */
		const harness = await createHarness({
			extensionFactories: [
				(pi) => {
					pi.registerCommand("testcmd", {
						description: "Test command",
						handler: async () => {},
					});
				},
			],
		});
		harnesses.push(harness);

		await expect(harness.session.steer("/testcmd queued")).rejects.toThrow(
			'Extension command "/testcmd" cannot be queued. Use prompt() or execute the command when not streaming.',
		);
	});

	// 测试场景：验证“throws when queueing an extension command with followUp”对应的消息队列行为。
	it("throws when queueing an extension command with followUp", async () => {
		/** 当前用例的会话测试夹具。 */
		const harness = await createHarness({
			extensionFactories: [
				(pi) => {
					pi.registerCommand("testcmd", {
						description: "Test command",
						handler: async () => {},
					});
				},
			],
		});
		harnesses.push(harness);

		await expect(harness.session.followUp("/testcmd queued")).rejects.toThrow(
			'Extension command "/testcmd" cannot be queued. Use prompt() or execute the command when not streaming.',
		);
	});

	// 测试场景：验证“delivers follow-ups queued during agent_end”对应的消息队列行为。
	it("delivers follow-ups queued during agent_end", async () => {
		/** agent_end 扩展是否已经发送过 follow-up，防止重复触发。 */
		let sent = false;
		/** 当前用例的会话测试夹具。 */
		const harness = await createHarness({
			extensionFactories: [
				(pi: ExtensionAPI) => {
					pi.on("agent_end", async () => {
						if (sent) return;
						sent = true;
						pi.sendUserMessage("conflict report", { deliverAs: "followUp" });
					});
				},
			],
		});
		harnesses.push(harness);

		harness.setResponses([fauxAssistantMessage("reply"), fauxAssistantMessage("follow-up reply")]);

		await harness.session.prompt("hello");
		await harness.session.agent.waitForIdle();

		expect(getUserTexts(harness)).toEqual(["hello", "conflict report"]);
	});
});
