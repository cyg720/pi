/**
 * 文件职责：通过虚拟模型提供商端到端验证 Agent 的提示、工具调用、中止、事件、上下文和 continue 流程。
 * 技术维度：使用 Vitest、可编程 faux provider、Agent 状态机与流式事件接口构造无需真实网络的集成测试。
 * 产品维度：保障代理在常见对话及恢复场景中稳定工作，避免用户看到丢消息、悬挂工具或错误续写。
 * 逻辑维度：先提供注册与文本辅助函数，再覆盖基本交互，最后验证从用户消息和工具结果继续运行。
 * 关键边界：测试依赖全局注册表且必须在用例后注销；断言针对 faux provider，不代表真实服务的时延表现。
 * 新手阅读建议：先看 basicPrompt 和 toolExecution，再沿 Agent.state 理解事件与消息变化，最后阅读 continue 校验。
 */
import {
	type AssistantMessage,
	type FauxProviderRegistration,
	fauxAssistantMessage,
	fauxText,
	fauxThinking,
	fauxToolCall,
	type Model,
	registerFauxProvider,
	streamSimple,
	type ToolResultMessage,
	type UserMessage,
} from "@earendil-works/pi-ai/compat";
import { afterEach, describe, expect, it } from "vitest";
import { Agent, type AgentEvent } from "../src/index.ts";
import { calculateTool } from "./utils/calculate.ts";

/** 当前测试文件创建的虚拟提供商注册项，用例后统一注销以避免相互污染。 */
const registrations: FauxProviderRegistration[] = [];

/** 注册并记录一个虚拟提供商。参数 options 控制模型与流速；返回可配置响应的注册对象。例如：createFauxRegistration()。 */
function createFauxRegistration(options: Parameters<typeof registerFauxProvider>[0] = {}): FauxProviderRegistration {
	/** 本次创建的虚拟提供商注册句柄。 */
	const registration = registerFauxProvider(options);
	registrations.push(registration);
	return registration;
}

/** 合并助手或工具结果消息中的文本块。参数 message 为目标消息；返回以换行连接的文本。例如：getTextContent(message)。 */
function getTextContent(message: AssistantMessage | ToolResultMessage): string {
	return message.content
		.filter((block) => block.type === "text")
		.map((block) => block.text)
		.join("\n");
}

// 每个用例后注销全部虚拟提供商，保证后续测试从干净注册表开始。
afterEach(() => {
	while (registrations.length > 0) {
		registrations.pop()?.unregister();
	}
});

/** 验证一次基本文本提示。参数 model 为虚拟模型；无返回值，断言失败会抛错。例如：await basicPrompt(faux.getModel())。 */
async function basicPrompt(model: Model<string>) {
	/** 执行基本问答的代理实例。 */
	const agent = new Agent({
		streamFn: streamSimple,
		initialState: {
			systemPrompt: "You are a helpful assistant. Keep your responses concise.",
			model,
			thinkingLevel: "off",
			tools: [],
		},
	});

	await agent.prompt("What is 2+2? Answer with just the number.");

	expect(agent.state.isStreaming).toBe(false);
	expect(agent.state.messages.length).toBe(2);
	expect(agent.state.messages[0].role).toBe("user");
	expect(agent.state.messages[1].role).toBe("assistant");

	/** 状态中的最终助手消息。 */
	const assistantMessage = agent.state.messages[1];
	if (assistantMessage.role !== "assistant") throw new Error("Expected assistant message");
	expect(getTextContent(assistantMessage)).toContain("4");
}

/** 验证工具调用、结果回传与待处理集合。参数 model 为虚拟模型；无返回值。例如：await toolExecution(model)。 */
async function toolExecution(model: Model<string>) {
	/** 配置计算器工具的代理实例。 */
	const agent = new Agent({
		streamFn: streamSimple,
		initialState: {
			systemPrompt: "You are a helpful assistant. Always use the calculator tool for math.",
			model,
			thinkingLevel: "off",
			tools: [calculateTool],
		},
	});

	/** 在工具开始和结束事件瞬间记录的待处理调用编号快照。 */
	const pendingToolCallsDuringEvents: Array<{ type: AgentEvent["type"]; ids: string[] }> = [];
	agent.subscribe((event) => {
		if (event.type === "tool_execution_start" || event.type === "tool_execution_end") {
			pendingToolCallsDuringEvents.push({
				type: event.type,
				ids: [...agent.state.pendingToolCalls],
			});
		}
	});

	await agent.prompt("Calculate 123 * 456 using the calculator tool.");

	expect(agent.state.isStreaming).toBe(false);
	expect(agent.state.messages.length).toBeGreaterThanOrEqual(4);
	/** 消息历史中计算器返回的工具结果。 */
	const toolResultMsg = agent.state.messages.find((message) => message.role === "toolResult");
	expect(toolResultMsg).toBeDefined();
	if (toolResultMsg?.role !== "toolResult") throw new Error("Expected tool result message");
	expect(getTextContent(toolResultMsg)).toContain("123 * 456 = 56088");

	/** 工具结果之后生成的最终助手回复。 */
	const finalMessage = agent.state.messages[agent.state.messages.length - 1];
	if (finalMessage.role !== "assistant") throw new Error("Expected final assistant message");
	expect(getTextContent(finalMessage)).toContain("56088");
	expect(agent.state.pendingToolCalls.size).toBe(0);
	expect(pendingToolCallsDuringEvents).toEqual([
		{ type: "tool_execution_start", ids: ["calc-1"] },
		{ type: "tool_execution_end", ids: [] },
	]);
}

/** 验证流式生成期间的中止行为。参数 model 为低速虚拟模型；无返回值。例如：await abortExecution(model)。 */
async function abortExecution(model: Model<string>) {
	/** 用于触发并观察中止状态的代理实例。 */
	const agent = new Agent({
		streamFn: streamSimple,
		initialState: {
			systemPrompt: "You are a helpful assistant.",
			model,
			thinkingLevel: "off",
			tools: [],
		},
	});

	/** 尚未完成的提示 Promise，在短延迟后被主动中止。 */
	const promptPromise = agent.prompt("Count slowly from 1 to 20.");
	setTimeout(() => {
		agent.abort();
	}, 30);

	await promptPromise;

	expect(agent.state.isStreaming).toBe(false);
	expect(agent.state.messages.length).toBeGreaterThanOrEqual(2);

	/** 中止后保留在历史末尾的助手消息。 */
	const lastMessage = agent.state.messages[agent.state.messages.length - 1];
	if (lastMessage.role !== "assistant") throw new Error("Expected assistant message");
	expect(lastMessage.stopReason).toBe("aborted");
	expect(lastMessage.errorMessage).toBeDefined();
	expect(agent.state.errorMessage).toBe(lastMessage.errorMessage);
}

/** 验证流式请求发出的生命周期事件及顺序。参数 model 为虚拟模型；无返回值。例如：await stateUpdates(model)。 */
async function stateUpdates(model: Model<string>) {
	/** 被观察生命周期事件的代理实例。 */
	const agent = new Agent({
		streamFn: streamSimple,
		initialState: {
			systemPrompt: "You are a helpful assistant.",
			model,
			thinkingLevel: "off",
			tools: [],
		},
	});

	/** 按实际触发顺序收集的代理事件类型。 */
	const events: AgentEvent["type"][] = [];
	agent.subscribe((event) => {
		events.push(event.type);
	});

	await agent.prompt("Count from 1 to 5.");

	expect(events).toContain("agent_start");
	expect(events).toContain("turn_start");
	expect(events).toContain("message_start");
	expect(events).toContain("message_update");
	expect(events).toContain("message_end");
	expect(events).toContain("turn_end");
	expect(events).toContain("agent_end");
	expect(events.indexOf("agent_start")).toBeLessThan(events.indexOf("message_start"));
	expect(events.indexOf("message_start")).toBeLessThan(events.indexOf("message_end"));
	expect(events.indexOf("message_end")).toBeLessThan(events.lastIndexOf("agent_end"));

	expect(agent.state.isStreaming).toBe(false);
	expect(agent.state.messages.length).toBe(2);
}

/** 验证多轮提示会保留早期上下文。参数 model 为按上下文响应的虚拟模型；无返回值。例如：await multiTurnConversation(model)。 */
async function multiTurnConversation(model: Model<string>) {
	/** 负责两轮姓名记忆对话的代理实例。 */
	const agent = new Agent({
		streamFn: streamSimple,
		initialState: {
			systemPrompt: "You are a helpful assistant.",
			model,
			thinkingLevel: "off",
			tools: [],
		},
	});

	await agent.prompt("My name is Alice.");
	expect(agent.state.messages.length).toBe(2);

	await agent.prompt("What is my name?");
	expect(agent.state.messages.length).toBe(4);

	/** 第二轮生成的助手回复，应能引用第一轮姓名。 */
	const lastMessage = agent.state.messages[3];
	if (lastMessage.role !== "assistant") throw new Error("Expected assistant message");
	expect(getTextContent(lastMessage).toLowerCase()).toContain("alice");
}

describe("Agent integration with faux provider", () => {
	// 验证基础文本提示能够产生预设助手回复。
	it("handles a basic text prompt", async () => {
		/** 当前用例的虚拟提供商。 */
		const faux = createFauxRegistration();
		faux.setResponses([fauxAssistantMessage("4")]);
		await basicPrompt(faux.getModel());
	});

	// 验证代理执行工具并同步维护待处理工具调用集合。
	it("executes tools and tracks pending tool calls", async () => {
		/** 依次提供工具调用与最终回答的虚拟提供商。 */
		const faux = createFauxRegistration();
		faux.setResponses([
			fauxAssistantMessage(
				[
					fauxText("Let me calculate that."),
					fauxToolCall("calculate", { expression: "123 * 456" }, { id: "calc-1" }),
				],
				{ stopReason: "toolUse" },
			),
			fauxAssistantMessage("The result is 56088."),
		]);
		await toolExecution(faux.getModel());
	});

	// 验证慢速流式输出可被主动中止。
	it("handles abort during streaming", async () => {
		/** 使用固定小分片和低速率的虚拟提供商，确保有中止窗口。 */
		const faux = createFauxRegistration({
			tokensPerSecond: 20,
			tokenSize: { min: 2, max: 2 },
		});
		faux.setResponses([
			fauxAssistantMessage(
				"one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen",
			),
		]);
		await abortExecution(faux.getModel());
	});

	// 验证生成期间发出完整且有序的生命周期事件。
	it("emits lifecycle updates while streaming", async () => {
		/** 逐字符流式输出的虚拟提供商。 */
		const faux = createFauxRegistration({ tokenSize: { min: 1, max: 1 } });
		faux.setResponses([fauxAssistantMessage("1 2 3 4 5")]);
		await stateUpdates(faux.getModel());
	});

	// 验证第二轮响应函数可以读取第一轮用户消息。
	it("maintains context across multiple turns", async () => {
		/** 根据传入上下文动态决定第二个响应的虚拟提供商。 */
		const faux = createFauxRegistration();
		faux.setResponses([
			fauxAssistantMessage("Nice to meet you, Alice."),
			(context) => {
				/** 上下文中是否仍能找到用户先前提供的 Alice 姓名。 */
				const hasAlice = context.messages.some((message) => {
					if (message.role !== "user") return false;
					if (typeof message.content === "string") return message.content.includes("Alice");
					return message.content.some((block) => block.type === "text" && block.text.includes("Alice"));
				});
				return fauxAssistantMessage(hasAlice ? "Your name is Alice." : "I do not know your name.");
			},
		]);
		await multiTurnConversation(faux.getModel());
	});

	// 验证推理模型的 thinking 内容块不会在 Agent 层被丢弃。
	it("preserves thinking content blocks", async () => {
		/** 声明支持推理内容的虚拟提供商。 */
		const faux = createFauxRegistration({ models: [{ id: "faux-reasoning", reasoning: true }] });
		faux.setResponses([fauxAssistantMessage([fauxThinking("step by step"), fauxText("4")])]);

		/** 启用低级思考模式的代理实例。 */
		const agent = new Agent({
			streamFn: streamSimple,
			initialState: {
				systemPrompt: "You are a helpful assistant.",
				model: faux.getModel(),
				thinkingLevel: "low",
				tools: [],
			},
		});

		await agent.prompt("What is 2+2?");

		/** 同时包含 thinking 与 text 块的助手消息。 */
		const assistantMessage = agent.state.messages[1];
		if (assistantMessage?.role !== "assistant") throw new Error("Expected assistant message");
		expect(assistantMessage.content).toEqual([
			{ type: "thinking", thinking: "step by step" },
			{ type: "text", text: "4" },
		]);
	});
});

describe("Agent.continue() with faux provider", () => {
	describe("validation", () => {
		// 空消息上下文无法确定续写起点，应立即拒绝。
		it("throws when no messages in context", async () => {
			/** 当前校验用例的虚拟提供商。 */
			const faux = createFauxRegistration();
			/** 没有历史消息的代理实例。 */
			const agent = new Agent({
				streamFn: streamSimple,
				initialState: {
					systemPrompt: "Test",
					model: faux.getModel(),
				},
			});

			await expect(agent.continue()).rejects.toThrow("No messages to continue from");
		});

		// 助手消息不能作为 continue 的输入末端，应返回清晰错误。
		it("throws when last message is assistant", async () => {
			/** 当前校验用例的虚拟提供商。 */
			const faux = createFauxRegistration();
			/** 用于构造消息元数据的虚拟模型。 */
			const model = faux.getModel();
			/** 将被注入助手末尾消息的代理实例。 */
			const agent = new Agent({
				streamFn: streamSimple,
				initialState: {
					systemPrompt: "Test",
					model,
				},
			});

			/** 人工构造的末尾助手消息，用于触发角色校验。 */
			const assistantMessage: AssistantMessage = {
				role: "assistant",
				content: [{ type: "text", text: "Hello" }],
				api: model.api,
				provider: model.provider,
				model: model.id,
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
			agent.state.messages = [assistantMessage];

			await expect(agent.continue()).rejects.toThrow("Cannot continue from message role: assistant");
		});
	});

	describe("continue from user message", () => {
		// 用户消息作为末尾时，continue 应继续调用模型并追加助手回复。
		it("continues and gets a response when last message is user", async () => {
			/** 返回固定大写回复的虚拟提供商。 */
			const faux = createFauxRegistration();
			faux.setResponses([fauxAssistantMessage("HELLO WORLD")]);
			/** 预置用户消息后执行 continue 的代理实例。 */
			const agent = new Agent({
				streamFn: streamSimple,
				initialState: {
					systemPrompt: "You are a helpful assistant. Follow instructions exactly.",
					model: faux.getModel(),
					thinkingLevel: "off",
					tools: [],
				},
			});

			/** 人工构造的待续写用户消息。 */
			const userMessage: UserMessage = {
				role: "user",
				content: [{ type: "text", text: "Say exactly: HELLO WORLD" }],
				timestamp: Date.now(),
			};
			agent.state.messages = [userMessage];

			await agent.continue();

			expect(agent.state.isStreaming).toBe(false);
			expect(agent.state.messages.length).toBe(2);
			expect(agent.state.messages[0].role).toBe("user");
			expect(agent.state.messages[1].role).toBe("assistant");

			/** continue 新追加的助手消息。 */
			const assistantMsg = agent.state.messages[1];
			if (assistantMsg.role !== "assistant") throw new Error("Expected assistant message");
			expect(getTextContent(assistantMsg).toUpperCase()).toContain("HELLO WORLD");
		});
	});

	describe("continue from tool result", () => {
		// 工具结果作为末尾时，continue 应让模型生成面向用户的最终答案。
		it("continues and processes tool results", async () => {
			/** 返回工具结果总结的虚拟提供商。 */
			const faux = createFauxRegistration();
			/** 构造历史助手消息所需的模型元数据。 */
			const model = faux.getModel();
			faux.setResponses([fauxAssistantMessage("The answer is 8.")]);
			/** 配置计算器工具并接收预置历史的代理实例。 */
			const agent = new Agent({
				streamFn: streamSimple,
				initialState: {
					systemPrompt:
						"You are a helpful assistant. After getting a calculation result, state the answer clearly.",
					model,
					thinkingLevel: "off",
					tools: [calculateTool],
				},
			});

			/** 原始数学问题用户消息。 */
			const userMessage: UserMessage = {
				role: "user",
				content: [{ type: "text", text: "What is 5 + 3?" }],
				timestamp: Date.now(),
			};

			/** 发起 calculate 工具调用的历史助手消息。 */
			const assistantMessage: AssistantMessage = {
				role: "assistant",
				content: [
					{ type: "text", text: "Let me calculate that." },
					{ type: "toolCall", id: "calc-1", name: "calculate", arguments: { expression: "5 + 3" } },
				],
				api: model.api,
				provider: model.provider,
				model: model.id,
				usage: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 0,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
				},
				stopReason: "toolUse",
				timestamp: Date.now(),
			};

			/** 与 calc-1 调用对应的成功工具结果。 */
			const toolResult: ToolResultMessage = {
				role: "toolResult",
				toolCallId: "calc-1",
				toolName: "calculate",
				content: [{ type: "text", text: "5 + 3 = 8" }],
				isError: false,
				timestamp: Date.now(),
			};

			agent.state.messages = [userMessage, assistantMessage, toolResult];

			await agent.continue();

			expect(agent.state.isStreaming).toBe(false);
			expect(agent.state.messages.length).toBeGreaterThanOrEqual(4);

			/** continue 在工具结果之后追加的最终助手消息。 */
			const lastMessage = agent.state.messages[agent.state.messages.length - 1];
			expect(lastMessage.role).toBe("assistant");
			if (lastMessage.role !== "assistant") throw new Error("Expected assistant message");
			expect(getTextContent(lastMessage)).toContain("8");
		});
	});
});
