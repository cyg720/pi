/**
 * 文件职责：刻画 AgentSession 的 Bash 执行、流式期间延迟记录、消息持久化、中止和输出事件行为。
 * 技术维度：使用 Vitest、统一 Harness、假模型响应、可注入 BashOperations 和 AgentTool 夹具。
 * 产品维度：保证终端命令结果按正确时机进入会话历史，并能被 UI 实时展示、取消和在后续轮次使用。
 * 逻辑维度：先提供条目类型助手，再覆盖空闲/流式记录、真实与自定义执行、消息顺序、中止和增量事件。
 * 关键边界：真实 printf 用例依赖本机 shell；流式测试用 Promise 门闩控制时序；每个 Harness 必须清理。
 * 新手阅读建议：先看空闲记录与流式延迟两个对照用例，再读持久化顺序，最后关注中止和输出回调。
 */
import { Buffer } from "node:buffer";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { afterEach, describe, expect, it } from "vitest";
import type { BashOperations } from "../../src/core/tools/bash.ts";
import { createHarness, type Harness } from "./harness.ts";

/**
 * 读取 Harness 会话管理器中的底层条目类型。
 * @param harness 已创建的测试夹具。
 * @returns 按持久化顺序排列的 entry.type 数组。
 * @example getEntryTypes(harness);
 */
function getEntryTypes(harness: Harness): string[] {
	return harness.sessionManager.getEntries().map((entry) => entry.type);
}

/** 覆盖 Bash 执行消息与常规会话持久化之间的时序和事件契约。 */
describe("AgentSession bash and persistence characterization", () => {
	/** 当前 describe 创建的全部 Harness，afterEach 统一清理。 */
	const harnesses: Harness[] = [];

	/** 每个用例后释放所有 Harness。 */
	afterEach(() => {
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
	});

	it("records bash results immediately while idle", async () => {
		/** 空闲记录场景的默认夹具。 */
		const harness = await createHarness();
		harnesses.push(harness);

		harness.session.recordBashResult("echo hi", {
			output: "hi",
			exitCode: 0,
			cancelled: false,
			truncated: false,
		});

		expect(harness.session.hasPendingBashMessages).toBe(false);
		expect(harness.session.messages[harness.session.messages.length - 1]?.role).toBe("bashExecution");
		expect(getEntryTypes(harness)).toContain("message");
	});

	it("defers bash results while streaming and flushes them before the next prompt", async () => {
		/** 解除 wait 工具执行的外部函数。 */
		let releaseToolExecution: (() => void) | undefined;
		/** wait 工具等待的门闩 Promise。 */
		const toolRelease = new Promise<void>((resolve) => {
			releaseToolExecution = resolve;
		});
		/** 在门闩解除前保持会话流式状态的测试工具。 */
		const waitTool: AgentTool = {
			name: "wait",
			label: "Wait",
			description: "Wait for release",
			parameters: Type.Object({}),
			execute: async () => {
				await toolRelease;
				return {
					content: [{ type: "text", text: "released" }],
					details: {},
				};
			},
		};
		/** 注册 wait 工具并预置三条假模型响应的夹具。 */
		const harness = await createHarness({ tools: [waitTool] });
		harnesses.push(harness);
		harness.setResponses([
			fauxAssistantMessage([fauxToolCall("wait", {})], { stopReason: "toolUse" }),
			fauxAssistantMessage("done"),
			fauxAssistantMessage("after flush"),
		]);

		/** 首次工具执行开始时完成的观察 Promise。 */
		const sawToolStart = new Promise<void>((resolve) => {
			/** 工具开始后立即取消的会话订阅。 */
			const unsubscribe = harness.session.subscribe((event) => {
				if (event.type === "tool_execution_start") {
					unsubscribe();
					resolve();
				}
			});
		});

		/** 启动流式工具调用的首轮 prompt。 */
		const firstPrompt = harness.session.prompt("start");
		await sawToolStart;
		harness.session.recordBashResult("echo hi", {
			output: "hi",
			exitCode: 0,
			cancelled: false,
			truncated: false,
		});

		expect(harness.session.hasPendingBashMessages).toBe(true);
		expect(harness.session.messages.some((message) => message.role === "bashExecution")).toBe(false);

		releaseToolExecution?.();
		await firstPrompt;

		expect(harness.session.hasPendingBashMessages).toBe(false);
		expect(harness.session.messages.some((message) => message.role === "bashExecution")).toBe(true);

		await harness.session.prompt("next turn");

		expect(harness.session.hasPendingBashMessages).toBe(false);
		expect(harness.session.messages.some((message) => message.role === "bashExecution")).toBe(true);
		expect(getEntryTypes(harness).filter((type) => type === "message").length).toBeGreaterThan(0);
	});

	it("executes bash commands and records the result", async () => {
		/** 真实 Bash printf 场景的默认夹具。 */
		const harness = await createHarness();
		harnesses.push(harness);

		/** executeBash 返回的输出、退出码和状态。 */
		const result = await harness.session.executeBash("printf 'hello'");

		expect(result.output).toContain("hello");
		expect(harness.session.messages[harness.session.messages.length - 1]?.role).toBe("bashExecution");
	});

	it("cancels running bash commands with abortBash", async () => {
		/** 中止 Bash 场景的夹具。 */
		const harness = await createHarness();
		harnesses.push(harness);
		/** 等待 AbortSignal 并拒绝的自定义 Bash 操作。 */
		const operations: BashOperations = {
			exec: async (_command, _cwd, options) => {
				return await new Promise<{ exitCode: number | null }>((_resolve, reject) => {
					options.signal?.addEventListener(
						"abort",
						() => {
							reject(new Error("aborted"));
						},
						{ once: true },
					);
				});
			},
		};

		/** 尚在等待中止信号的 Bash Promise。 */
		const bashPromise = harness.session.executeBash("sleep", undefined, { operations });
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(harness.session.isBashRunning).toBe(true);
		harness.session.abortBash();

		/** 中止后得到的标准 Bash 结果。 */
		const result = await bashPromise;
		expect(result.cancelled).toBe(true);
		expect(harness.session.isBashRunning).toBe(false);
	});

	it("persists user, assistant, toolResult, and custom messages in order", async () => {
		/** 把 text 参数原样返回的自定义 echo 工具。 */
		const echoTool: AgentTool = {
			name: "echo",
			label: "Echo",
			description: "Echo text back",
			parameters: Type.Object({ text: Type.String() }),
			execute: async (_toolCallId, params) => {
				/** 从未知工具参数安全提取的 text 字符串。 */
				const text = typeof params === "object" && params !== null && "text" in params ? String(params.text) : "";
				return { content: [{ type: "text", text: `echo:${text}` }], details: { text } };
			},
		};
		/** 注册 echo 工具并预置工具调用和终止回复的夹具。 */
		const harness = await createHarness({ tools: [echoTool] });
		harnesses.push(harness);
		harness.setResponses([
			fauxAssistantMessage([fauxToolCall("echo", { text: "hello" })], { stopReason: "toolUse" }),
			fauxAssistantMessage("done"),
		]);

		await harness.session.sendCustomMessage({
			customType: "note",
			content: "hello",
			display: true,
			details: { a: 1 },
		});
		await harness.session.prompt("start");

		/** 自定义消息与一轮工具调用持久化后的底层条目。 */
		const entries = harness.sessionManager.getEntries();
		expect(entries.map((entry) => entry.type)).toEqual([
			"custom_message",
			"message",
			"message",
			"message",
			"message",
		]);
		expect(harness.session.messages.map((message) => message.role)).toEqual([
			"custom",
			"user",
			"assistant",
			"toolResult",
			"assistant",
		]);
	});

	it("does not emit message_end for bash execution messages", async () => {
		/** bashExecution 不应发出 message_end 场景的夹具。 */
		const harness = await createHarness();
		harnesses.push(harness);
		/** 捕获所有 message_end 事件的消息角色。 */
		const messageEndRoles: string[] = [];
		harness.session.subscribe((event) => {
			if (event.type === "message_end") {
				messageEndRoles.push(event.message.role);
			}
		});

		harness.session.recordBashResult("echo hi", {
			output: "hi",
			exitCode: 0,
			cancelled: false,
			truncated: false,
		});

		expect(messageEndRoles).toEqual([]);
	});

	it("persists aborted assistant messages", async () => {
		/** 助手消息中止持久化场景的夹具。 */
		const harness = await createHarness();
		harnesses.push(harness);
		harness.setResponses([fauxAssistantMessage("x".repeat(20_000))]);

		/** 收到首个消息增量时完成的观察 Promise。 */
		const sawMessageUpdate = new Promise<void>((resolve) => {
			/** 收到首个更新后立即取消的会话订阅。 */
			const unsubscribe = harness.session.subscribe((event) => {
				if (event.type === "message_update") {
					unsubscribe();
					resolve();
				}
			});
		});

		/** 正在产生长助手消息的 prompt Promise。 */
		const promptPromise = harness.session.prompt("hi");
		await sawMessageUpdate;
		await harness.session.abort();
		await promptPromise;

		/** 中止后会话管理器中的最后一个持久化条目。 */
		const lastEntry = harness.sessionManager.getEntries()[harness.sessionManager.getEntries().length - 1];
		expect(lastEntry?.type).toBe("message");
		if (lastEntry?.type === "message") {
			expect(lastEntry.message.role).toBe("assistant");
			if (lastEntry.message.role === "assistant") {
				expect(lastEntry.message.stopReason).toBe("aborted");
			}
		}
	});

	it("records bash output through custom operations", async () => {
		/** 自定义 Bash 操作输出场景的夹具。 */
		const harness = await createHarness();
		harnesses.push(harness);
		/** 通过 onData 写入固定文本的自定义 Bash 操作。 */
		const operations: BashOperations = {
			exec: async (_command, _cwd, options) => {
				options.onData(Buffer.from("hello from custom ops"));
				return { exitCode: 0 };
			},
		};

		/** 自定义操作执行后的 Bash 结果。 */
		const result = await harness.session.executeBash("custom", undefined, { operations });

		expect(result.output).toContain("hello from custom ops");
		expect(harness.session.messages[harness.session.messages.length - 1]?.role).toBe("bashExecution");
	});

	it("streams bash output to the callback and session events", async () => {
		/** Bash 增量回调和事件场景的夹具。 */
		const harness = await createHarness();
		harnesses.push(harness);
		/** executeBash 回调收到的文本增量。 */
		const callbackDeltas: string[] = [];
		/** bash_execution_update 事件中的标识和增量。 */
		const eventUpdates: Array<{ id: string | undefined; delta: string }> = [];
		/** 记录 Bash 更新事件的订阅取消函数。 */
		const unsubscribe = harness.session.subscribe((event) => {
			if (event.type === "bash_execution_update") {
				eventUpdates.push({ id: event.id, delta: event.delta });
			}
		});
		/** 连续推送两个字节块的自定义 Bash 操作。 */
		const operations: BashOperations = {
			exec: async (_command, _cwd, options) => {
				options.onData(Buffer.from("hello "));
				options.onData(Buffer.from("world"));
				return { exitCode: 0 };
			},
		};

		await harness.session.executeBash("custom", (delta) => callbackDeltas.push(delta), {
			id: "bash-1",
			operations,
		});
		unsubscribe();

		expect(callbackDeltas).toEqual(["hello ", "world"]);
		expect(eventUpdates).toEqual([
			{ id: "bash-1", delta: "hello " },
			{ id: "bash-1", delta: "world" },
		]);
	});
});
