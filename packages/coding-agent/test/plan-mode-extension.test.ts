/**
 * 文件职责：验证示例计划模式扩展在工具切换、计划识别、细化和执行选择上的完整交互行为。
 * 技术维度：使用 Vitest 伪造 ExtensionAPI、ExtensionContext 和助手消息，并直接触发注册的命令与事件处理器。
 * 产品维度：保障用户可安全进入只读规划阶段、保留自定义工具，并把计划细化或执行排入后续消息。
 * 逻辑维度：setup 捕获扩展注册结果并提供触发器，测试再覆盖两次模式切换和三种助手响应选择。
 * 关键边界：测试 UI 为最小桩，不渲染真实终端；只有含计划特征的助手文本才会弹出选择框。
 * 新手阅读建议：先读 setup 返回的 runCommand/triggerAgentEnd，再对照四个用例观察扩展状态变化。
 */
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { describe, expect, it, vi } from "vitest";
import planModeExtension from "../examples/extensions/plan-mode/index.ts";
import type { ExtensionAPI, ExtensionContext } from "../src/core/extensions/index.ts";

// CommandHandler 描述扩展命令注册器保存的处理函数签名。
type CommandHandler = (args: string, ctx: ExtensionContext) => Promise<void> | void;
// AgentEndHandler 描述 agent_end 事件处理器收到的消息集合和上下文。
type AgentEndHandler = (
	event: { type: "agent_end"; messages: AgentMessage[] },
	ctx: ExtensionContext,
) => Promise<void> | void;

/**
 * 构造带固定提供商与零用量的测试助手消息。
 * @param text 助手文本正文。
 * @returns 可传入 agent_end 事件的 AssistantMessage；例如 `createAssistantMessage("Plan: ...")`。
 */
function createAssistantMessage(text: string): AssistantMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		api: "anthropic-messages",
		provider: "anthropic",
		model: "mock",
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
	};
}

/**
 * 安装计划模式扩展并返回可观察状态和事件触发辅助器。
 * @param options 可选初始工具、选择框答案和编辑器文本。
 * @returns 测试驱动对象；例如 `setup({ selectChoice: "Refine the plan" })`。
 */
function setup(options: { activeTools?: string[]; selectChoice?: string; editorText?: string } = {}) {
	// activeTools 保存扩展当前启用的工具名，默认包含四个内置工具。
	let activeTools = options.activeTools ?? ["read", "bash", "edit", "write"];
	// commands 按命令名保存扩展注册的处理器。
	const commands = new Map<string, CommandHandler>();
	// agentEndHandler 捕获扩展注册的 agent_end 监听器，注册前为 undefined。
	let agentEndHandler: AgentEndHandler | undefined;

	// sendMessage 记录扩展发送自定义消息的参数。
	const sendMessage = vi.fn<ExtensionAPI["sendMessage"]>();
	// sendUserMessage 记录扩展排入后续用户消息的参数。
	const sendUserMessage = vi.fn<ExtensionAPI["sendUserMessage"]>();
	// setActiveTools 同步更新本地 activeTools 并保留调用记录。
	const setActiveTools = vi.fn<ExtensionAPI["setActiveTools"]>((toolNames) => {
		activeTools = [...toolNames];
	});
	// appendEntry 记录扩展是否写入持久化状态条目。
	const appendEntry = vi.fn<ExtensionAPI["appendEntry"]>();

	// api 是计划模式扩展需要的最小 ExtensionAPI 实现。
	const api = {
		registerFlag: vi.fn(),
		registerCommand(name: string, command: { handler: CommandHandler }) {
			commands.set(name, command.handler);
		},
		registerShortcut: vi.fn(),
		on(event: string, handler: unknown) {
			if (event === "agent_end") agentEndHandler = handler as AgentEndHandler;
		},
		getFlag: vi.fn(() => false),
		getActiveTools: vi.fn(() => [...activeTools]),
		setActiveTools,
		sendMessage,
		sendUserMessage,
		appendEntry,
	} as unknown as ExtensionAPI;

	planModeExtension(api);

	// ctx 是命令与事件处理器共用的最小交互上下文。
	const ctx = {
		hasUI: true,
		ui: {
			notify: vi.fn(),
			select: vi.fn(async () => options.selectChoice),
			editor: vi.fn(async () => options.editorText),
			setStatus: vi.fn(),
			setWidget: vi.fn(),
			theme: {
				fg: (_name: string, text: string) => text,
				strikethrough: (text: string) => text,
			},
		},
		sessionManager: { getEntries: () => [] },
		isIdle: () => false,
		hasPendingMessages: () => false,
	} as unknown as ExtensionContext;

	/**
	 * 调用扩展注册的指定命令。
	 * @param name 命令名，不含斜杠。
	 * @returns 处理器完成后的 Promise；例如 `await runCommand("plan")`。
	 */
	async function runCommand(name: string): Promise<void> {
		// command 是按名称查到的命令处理器，不存在时表示扩展注册失败。
		const command = commands.get(name);
		if (!command) throw new Error(`Missing command: ${name}`);
		await command("", ctx);
	}

	/**
	 * 用给定助手文本触发捕获的 agent_end 处理器。
	 * @param text 模拟助手最终输出。
	 * @returns 事件处理完成后的 Promise；例如 `await triggerAgentEnd("Plan:\n1. Test")`。
	 */
	async function triggerAgentEnd(text: string): Promise<void> {
		if (!agentEndHandler) throw new Error("Missing agent_end handler");
		await agentEndHandler({ type: "agent_end", messages: [createAssistantMessage(text)] }, ctx);
	}

	return {
		activeTools: () => activeTools,
		appendEntry,
		ctx,
		runCommand,
		sendMessage,
		sendUserMessage,
		setActiveTools,
		triggerAgentEnd,
	};
}

// 验证计划模式示例扩展的用户可见状态和消息调度结果。
describe("plan-mode example extension", () => {
	// 进入计划模式应添加只读辅助工具，退出时恢复原自定义工具集合。
	it("preserves custom active tools while toggling plan mode", async () => {
		// activeTools、runCommand 和 setActiveTools 分别观察状态、触发命令及验证调用。
		const { activeTools, runCommand, setActiveTools } = setup({
			activeTools: ["read", "bash", "edit", "write", "echo_tool"],
		});

		await runCommand("plan");

		expect(activeTools()).toEqual(["read", "bash", "echo_tool", "grep", "find", "ls", "questionnaire"]);
		expect(setActiveTools).toHaveBeenLastCalledWith([
			"read",
			"bash",
			"echo_tool",
			"grep",
			"find",
			"ls",
			"questionnaire",
		]);

		await runCommand("plan");

		expect(activeTools()).toEqual(["read", "bash", "edit", "write", "echo_tool"]);
		expect(setActiveTools).toHaveBeenLastCalledWith(["read", "bash", "edit", "write", "echo_tool"]);
	});

	// 普通说明文字不构成计划，扩展不应打断用户请求选择。
	it("does not prompt when the assistant response contains no plan", async () => {
		// ctx 和消息桩用于确认没有选择框及后续自定义消息。
		const { ctx, runCommand, sendMessage, triggerAgentEnd } = setup();

		await runCommand("plan");
		await triggerAgentEnd("This file defines the command-line argument parser.");

		expect(ctx.ui.select).not.toHaveBeenCalled();
		expect(sendMessage).not.toHaveBeenCalled();
	});

	// 用户选择细化时，编辑器内容应作为 follow-up 用户消息排队。
	it("queues plan refinement as a follow-up user message", async () => {
		// setup 预设选择结果和用户在编辑器中补充的修改要求。
		const { runCommand, sendUserMessage, triggerAgentEnd } = setup({
			selectChoice: "Refine the plan",
			editorText: "Add a regression test.",
		});

		await runCommand("plan");
		await triggerAgentEnd("Plan:\n1. Inspect the current implementation\n2. Add a regression test");

		expect(sendUserMessage).toHaveBeenCalledWith("Add a regression test.", { deliverAs: "followUp" });
	});

	// 用户选择执行时应退出计划模式并发送可跟踪的执行自定义消息。
	it("queues plan execution as a follow-up custom message", async () => {
		// activeTools 验证执行前恢复写工具，sendMessage 验证执行消息投递选项。
		const { activeTools, runCommand, sendMessage, triggerAgentEnd } = setup({
			activeTools: ["read", "bash", "edit", "write", "echo_tool"],
			selectChoice: "Execute the plan (track progress)",
		});

		await runCommand("plan");
		await triggerAgentEnd("Plan:\n1. Inspect the current implementation\n2. Add a regression test");

		expect(activeTools()).toEqual(["read", "bash", "edit", "write", "echo_tool"]);
		expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ customType: "plan-mode-execute" }), {
			triggerTurn: true,
			deliverAs: "followUp",
		});
	});
});
