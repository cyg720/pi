/**
 * Tests for the test harness itself.
 * Validates that the faux provider and session factory work correctly.
 */
/**
 * 文件职责：对 coding-agent 测试工具箱自身做自检，验证伪提供商、会话工厂、事件捕获、流式增量和扩展加载。
 * 技术维度：使用 Vitest、TypeBox 工具参数、内联扩展工厂以及确定性响应序列驱动完整 AgentSession。
 * 产品维度：让后续功能回归测试能在无真实密钥和费用的情况下可信模拟模型、工具和扩展行为。
 * 逻辑维度：每个用例创建独立 Harness，覆盖文本、错误、重试、工具、流式事件、扩展命令与持久化。
 * 关键边界：用例结束必须 cleanup；响应序列用完后会循环；工具必须通过 baseToolsOverride 显式注入。
 * 新手阅读建议：先读简单响应和响应序列，再看工具调用与重试，最后阅读流式事件顺序和重复命令消歧。
 */

import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { afterEach, describe, expect, it } from "vitest";
import { createHarness, createHarnessWithExtensions, type Harness } from "./test-harness.ts";

describe("test harness", () => {
	/** 当前用例持有的测试工具箱实例；afterEach 负责清理。 */
	let harness: Harness;

	/** 每个用例结束后释放临时会话和资源。 */
	afterEach(() => {
		harness?.cleanup();
	});

	/** 验证单个文本响应会生成一条成功助手消息。 */
	it("simple text response", async () => {
		harness = await createHarness({ responses: ["hello world"] });

		await harness.session.prompt("hi");

		expect(harness.faux.callCount).toBe(1);

		/** 会话中筛选出的助手消息。 */
		const assistantMessages = harness.session.messages.filter((m) => m.role === "assistant");
		expect(assistantMessages).toHaveLength(1);

		/** 第一条助手消息的强类型视图。 */
		const msg = assistantMessages[0] as AssistantMessage;
		expect(msg.content).toEqual([{ type: "text", text: "hello world" }]);
		expect(msg.stopReason).toBe("stop");
	});

	/** 验证多次请求依次消费预设响应。 */
	it("response sequence", async () => {
		harness = await createHarness({ responses: ["first", "second", "third"] });

		await harness.session.prompt("a");
		await harness.session.prompt("b");
		await harness.session.prompt("c");

		expect(harness.faux.callCount).toBe(3);

		/** 会话中每条助手消息的首个文本内容。 */
		const assistantTexts = harness.session.messages
			.filter((m): m is AssistantMessage => m.role === "assistant")
			.map((m) => m.content.find((c) => c.type === "text")?.text);

		expect(assistantTexts).toEqual(["first", "second", "third"]);
	});

	/** 验证工具调用响应会执行已注册工具并继续模型循环。 */
	it("tool call response triggers tool execution", async () => {
		/** 标记 echo 工具是否真正执行。 */
		let toolExecuted = false;
		/** 返回固定 echoed 文本的测试工具。 */
		const echoTool: AgentTool = {
			name: "echo",
			label: "Echo",
			description: "Echo back",
			parameters: Type.Object({ text: Type.String() }),
			execute: async () => {
				toolExecuted = true;
				return { content: [{ type: "text", text: "echoed" }], details: {} };
			},
		};

		harness = await createHarness({
			responses: [{ toolCalls: [{ name: "echo", args: { text: "hi" } }] }, "done after tool"],
			tools: [echoTool],
			baseToolsOverride: { echo: echoTool },
		});

		await harness.session.prompt("use the tool");

		expect(toolExecuted).toBe(true);
		expect(harness.faux.callCount).toBe(2);

		/** 会话中由工具执行产生的结果消息。 */
		const toolResults = harness.session.messages.filter((m) => m.role === "toolResult");
		expect(toolResults).toHaveLength(1);
	});

	/** 验证伪提供商错误被记录为助手错误消息。 */
	it("error response", async () => {
		harness = await createHarness({
			responses: [{ error: "something broke" }],
		});

		await harness.session.prompt("hi");

		/** 会话中筛选出的助手消息。 */
		const assistantMessages = harness.session.messages.filter((m): m is AssistantMessage => m.role === "assistant");
		expect(assistantMessages).toHaveLength(1);
		expect(assistantMessages[0].stopReason).toBe("error");
		expect(assistantMessages[0].errorMessage).toBe("something broke");
	});

	/** 验证 transient 错误会按设置自动重试并成功结束。 */
	it("retry on transient error", async () => {
		harness = await createHarness({
			responses: [{ error: "overloaded_error" }, "recovered"],
			settings: { retry: { enabled: true, maxRetries: 3, baseDelayMs: 1 } },
		});

		await harness.session.prompt("hi");

		expect(harness.faux.callCount).toBe(2);

		/** 捕获到的自动重试开始事件。 */
		const retryStarts = harness.eventsOfType("auto_retry_start");
		expect(retryStarts).toHaveLength(1);

		/** 捕获到的自动重试结束事件。 */
		const retryEnds = harness.eventsOfType("auto_retry_end");
		expect(retryEnds).toHaveLength(1);
		expect(retryEnds[0].success).toBe(true);
	});

	/** 验证自定义用量数字被保留在助手消息中。 */
	it("custom usage numbers", async () => {
		harness = await createHarness({
			responses: [{ text: "big response", usage: { input: 100000, output: 5000 } }],
		});

		await harness.session.prompt("hi");

		/** 带自定义用量的助手消息。 */
		const msg = harness.session.messages.find((m): m is AssistantMessage => m.role === "assistant")!;
		expect(msg.usage.input).toBe(100000);
		expect(msg.usage.output).toBe(5000);
	});

	/** 验证 Harness 可按类型检索关键 Agent 事件。 */
	it("event capture", async () => {
		harness = await createHarness({ responses: ["hello"] });

		await harness.session.prompt("hi");

		/** 捕获到的 agent_start 事件。 */
		const agentStarts = harness.eventsOfType("agent_start");
		expect(agentStarts).toHaveLength(1);

		/** 捕获到的 agent_end 事件。 */
		const agentEnds = harness.eventsOfType("agent_end");
		expect(agentEnds).toHaveLength(1);

		/** 用户和助手消息完成时产生的 message_end 事件。 */
		const messageEnds = harness.eventsOfType("message_end");
		expect(messageEnds.length).toBeGreaterThanOrEqual(2); // user + assistant
	});

	/** 验证伪提供商保存每次调用收到的上下文。 */
	it("context capture", async () => {
		harness = await createHarness({ responses: ["reply"] });

		await harness.session.prompt("my question");

		expect(harness.faux.contexts).toHaveLength(1);
		/** 第一次模型调用收到的上下文。 */
		const ctx = harness.faux.contexts[0];
		/** 上下文中的用户消息。 */
		const userMsg = ctx.messages.find((m) => m.role === "user");
		expect(userMsg).toBeDefined();
	});

	/** 验证请求次数超过响应数时按序循环使用响应。 */
	it("wraps around when more calls than responses", async () => {
		harness = await createHarness({ responses: ["a", "b"] });

		await harness.session.prompt("1");
		await harness.session.prompt("2");
		await harness.session.prompt("3");

		expect(harness.faux.callCount).toBe(3);

		/** 循环消费响应后得到的助手文本序列。 */
		const texts = harness.session.messages
			.filter((m): m is AssistantMessage => m.role === "assistant")
			.map((m) => m.content.find((c) => c.type === "text")?.text);

		expect(texts).toEqual(["a", "b", "a"]);
	});

	/** 验证文本响应产生可重建原文的流式增量。 */
	it("streams text deltas", async () => {
		harness = await createHarness({ responses: ["hello world"] });

		await harness.session.prompt("hi");

		/** 本次会话的全部消息更新事件。 */
		const updates = harness.eventsOfType("message_update");
		/** 其中的文本增量事件。 */
		const textDeltas = updates.filter((e) => e.assistantMessageEvent.type === "text_delta");
		expect(textDeltas.length).toBeGreaterThan(0);

		// Deltas should reconstruct the full text
		// 所有文本增量拼接后应恢复完整响应。
		/** 按事件顺序拼接得到的文本。 */
		const reconstructed = textDeltas.map((e) => (e.assistantMessageEvent as { delta: string }).delta).join("");
		expect(reconstructed).toBe("hello world");
	});

	/** 验证思考内容产生开始、增量和结束事件。 */
	it("streams thinking deltas", async () => {
		harness = await createHarness({
			responses: [{ thinking: "let me think about this", text: "answer" }],
		});

		await harness.session.prompt("hi");

		/** 本次会话的全部消息更新事件。 */
		const updates = harness.eventsOfType("message_update");
		/** 思考内容开始事件。 */
		const thinkingStarts = updates.filter((e) => e.assistantMessageEvent.type === "thinking_start");
		/** 思考内容增量事件。 */
		const thinkingDeltas = updates.filter((e) => e.assistantMessageEvent.type === "thinking_delta");
		/** 思考内容结束事件。 */
		const thinkingEnds = updates.filter((e) => e.assistantMessageEvent.type === "thinking_end");

		expect(thinkingStarts).toHaveLength(1);
		expect(thinkingDeltas.length).toBeGreaterThan(0);
		expect(thinkingEnds).toHaveLength(1);

		/** 按顺序拼接得到的思考文本。 */
		const reconstructed = thinkingDeltas.map((e) => (e.assistantMessageEvent as { delta: string }).delta).join("");
		expect(reconstructed).toBe("let me think about this");
	});

	/** 验证工具调用产生开始、参数增量和结束事件。 */
	it("streams tool call deltas", async () => {
		/** 返回固定结果的 echo 测试工具。 */
		const echoTool: AgentTool = {
			name: "echo",
			label: "Echo",
			description: "Echo back",
			parameters: Type.Object({ text: Type.String() }),
			execute: async () => ({ content: [{ type: "text", text: "echoed" }], details: {} }),
		};

		harness = await createHarness({
			responses: [{ toolCalls: [{ name: "echo", args: { text: "hi" } }] }, "done"],
			tools: [echoTool],
			baseToolsOverride: { echo: echoTool },
		});

		await harness.session.prompt("use tool");

		/** 本次会话的全部消息更新事件。 */
		const updates = harness.eventsOfType("message_update");
		/** 工具调用开始事件。 */
		const toolcallStarts = updates.filter((e) => e.assistantMessageEvent.type === "toolcall_start");
		/** 工具参数增量事件。 */
		const toolcallDeltas = updates.filter((e) => e.assistantMessageEvent.type === "toolcall_delta");
		/** 工具调用结束事件。 */
		const toolcallEnds = updates.filter((e) => e.assistantMessageEvent.type === "toolcall_end");

		expect(toolcallStarts).toHaveLength(1);
		expect(toolcallDeltas.length).toBeGreaterThan(0);
		expect(toolcallEnds).toHaveLength(1);
	});

	/** 验证思考、文本和工具调用三类流式事件严格按内容顺序出现。 */
	it("streams thinking then text then tool call in order", async () => {
		/** 返回固定结果的 echo 测试工具。 */
		const echoTool: AgentTool = {
			name: "echo",
			label: "Echo",
			description: "Echo back",
			parameters: Type.Object({ text: Type.String() }),
			execute: async () => ({ content: [{ type: "text", text: "echoed" }], details: {} }),
		};

		harness = await createHarness({
			responses: [
				{
					thinking: "hmm",
					text: "I will call a tool",
					toolCalls: [{ name: "echo", args: { text: "x" } }],
				},
				"final",
			],
			tools: [echoTool],
			baseToolsOverride: { echo: echoTool },
		});

		await harness.session.prompt("do it");

		/** 本次会话的全部消息更新事件。 */
		const updates = harness.eventsOfType("message_update");
		/** 按发生顺序提取的助手消息事件类型。 */
		const streamTypes = updates.map((e) => e.assistantMessageEvent.type);

		// Thinking events should come before text events, text before toolcall
		// 思考事件应早于文本事件，文本事件又应早于工具调用事件。
		/** 首个思考开始事件的位置。 */
		const firstThinking = streamTypes.indexOf("thinking_start");
		/** 首个文本开始事件的位置。 */
		const firstText = streamTypes.indexOf("text_start");
		/** 首个工具调用开始事件的位置。 */
		const firstToolcall = streamTypes.indexOf("toolcall_start");

		expect(firstThinking).toBeLessThan(firstText);
		expect(firstText).toBeLessThan(firstToolcall);
	});

	/** 验证内联扩展可加载，且同名命令会获得唯一调用名。 */
	it("loads inline extension factories and disambiguates duplicate commands", async () => {
		/** 两个同名命令的实际执行记录。 */
		const calls: string[] = [];

		harness = await createHarnessWithExtensions({
			extensionFactories: [
				{
					path: "<alpha>",
					factory: (pi) => {
						pi.registerCommand("shared-cmd", {
							description: "Alpha command",
							handler: async (args) => {
								calls.push(`alpha:${args}`);
							},
						});
					},
				},
				{
					path: "<beta>",
					factory: (pi) => {
						pi.registerCommand("shared-cmd", {
							description: "Beta command",
							handler: async (args) => {
								calls.push(`beta:${args}`);
							},
						});
					},
				},
			],
		});

		/** Harness 会话加载的扩展运行器。 */
		const runner = harness.session.extensionRunner;
		expect(runner).toBeDefined();

		/** 扩展运行器汇总并消歧后的命令定义。 */
		const commands = runner!.getRegisteredCommands();
		expect(
			commands.map((command) => ({
				name: command.name,
				invocationName: command.invocationName,
				description: command.description,
				path: command.sourceInfo.path,
			})),
		).toEqual([
			{ name: "shared-cmd", invocationName: "shared-cmd:1", description: "Alpha command", path: "<alpha>" },
			{ name: "shared-cmd", invocationName: "shared-cmd:2", description: "Beta command", path: "<beta>" },
		]);

		await runner!.getCommand("shared-cmd:1")?.handler("first", runner!.createCommandContext());
		await runner!.getCommand("shared-cmd:2")?.handler("second", runner!.createCommandContext());

		expect(calls).toEqual(["alpha:first", "beta:second"]);
	});

	/** 验证 Agent 消息会写入 SessionManager 条目。 */
	it("session persistence works", async () => {
		harness = await createHarness({ responses: ["persisted"] });

		await harness.session.prompt("hi");

		/** 会话管理器保存的全部条目。 */
		const entries = harness.sessionManager.getEntries();
		/** 条目中属于消息的部分。 */
		const messageEntries = entries.filter((e) => e.type === "message");
		expect(messageEntries.length).toBeGreaterThanOrEqual(2); // user + assistant
	});
});
