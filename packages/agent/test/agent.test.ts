/**
 * 文件职责：验证 Agent 的状态生命周期、消息流、工具执行、队列策略、取消处理和会话标识传播。
 * 技术维度：使用 Vitest、模拟助手事件流、可控 Promise 与测试工具覆盖同步和异步状态转换。
 * 产品维度：保证代理在对话、工具调用和用户中断场景下不丢消息、不重复执行并正确报告状态。
 * 逻辑维度：先定义模拟流和消息工厂，再从初始状态逐步覆盖订阅、运行、工具、队列和状态修改接口。
 * 关键边界：部分断言依赖事件发出顺序；并行工具和取消信号必须等待清理完成后再判断最终状态。
 * 新手阅读建议：先读 MockAssistantStream 和消息工厂，再看基础 prompt 流程，最后看工具并行与队列策略。
 */
import { type AssistantMessage, type AssistantMessageEvent, EventStream, getModel } from "@earendil-works/pi-ai/compat";
import { Type } from "typebox";
import { describe, expect, it } from "vitest";
import {
	Agent,
	type AgentEvent,
	type AgentTool,
	type AgentToolUpdateCallback,
	type StreamFn,
	setDefaultStreamFn,
} from "../src/index.ts";

// Mock stream that mimics AssistantMessageEventStream
// 中文说明：上方英文注释描述“Mock stream that mimics AssistantMessageEventStream”相关前提、步骤或边界；下面代码按该说明执行。
/** MockAssistantStream 模拟助手消息事件流；它定义完成与错误事件的收束方式，供 Agent 生命周期用例复用。 */
class MockAssistantStream extends EventStream<AssistantMessageEvent, AssistantMessage> {
	/** 初始化模拟对象；参数按签名注入初始状态，构造后供测试驱动。示例：new MockAssistantStream(...)。 */
	constructor() {
		super(
			(event) => event.type === "done" || event.type === "error",
			(event) => {
				if (event.type === "done") return event.message;
				if (event.type === "error") return event.error;
				throw new Error("Unexpected event type");
			},
		);
	}
}

/** 创建 createAssistantMessage 对应步骤；参数 text 按签名提供所需输入；返回值供调用方继续执行或断言。示例：createAssistantMessage(...)。 */
function createAssistantMessage(text: string): AssistantMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		api: "openai-responses",
		provider: "openai",
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

/** ToolCallContent 约束当前测试夹具允许使用的数据形态。 */
type ToolCallContent = Extract<AssistantMessage["content"][number], { type: "toolCall" }>;

/** 创建 createAssistantToolUseMessage 对应步骤；参数 content 按签名提供所需输入；返回值供调用方继续执行或断言。示例：createAssistantToolUseMessage(...)。 */
function createAssistantToolUseMessage(content: ToolCallContent[]): AssistantMessage {
	return {
		role: "assistant",
		content,
		api: "openai-responses",
		provider: "openai",
		model: "mock",
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
}

/** 处理 unusedStreamFunction 对应步骤；无参数；返回值供调用方继续执行或断言。示例：unusedStreamFunction()。 */
const unusedStreamFunction: StreamFn = () => {
	throw new Error("Unexpected stream call");
};

/** 创建 createDeferred 对应步骤；无参数；返回值供调用方继续执行或断言。示例：createDeferred()。 */
function createDeferred(): {
	promise: Promise<void>;
	resolve: () => void;
} {
	/** 解析并确定 resolve 对应步骤；无参数；返回值供调用方继续执行或断言。示例：resolve()。 */
	let resolve = () => {};
	/** 常量 promise 保存“promise”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const promise = new Promise<void>((resolvePromise) => {
		resolve = resolvePromise;
	});
	return { promise, resolve };
}

// 用例分组：集中验证“Agent”相关功能。
describe("Agent", () => {
	// 测试场景：验证“uses the configured default when a legacy caller omits streamFn”对应的行为、返回值与边界条件。
	it("uses the configured default when a legacy caller omits streamFn", async () => {
		/** 变量 calls 保存核对调用或事件顺序的记录；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		let calls = 0;
		setDefaultStreamFn(() => {
			calls++;
			/** 常量 stream 保存传递助手事件的异步流；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const stream = new MockAssistantStream();
			queueMicrotask(() => {
				/** 常量 message 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
				const message = createAssistantMessage("fallback");
				stream.push({ type: "done", reason: "stop", message });
			});
			return stream;
		});

		try {
			/** 常量 agent 保存“agent”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const agent = Reflect.construct(Agent, [{}]) as Agent;
			await agent.prompt("Hello");
			expect(calls).toBe(1);
		} finally {
			setDefaultStreamFn(undefined);
		}
	});

	// 测试场景：验证“should create an agent instance with default state”对应的行为、返回值与边界条件。
	it("should create an agent instance with default state", () => {
		/** 常量 agent 保存“agent”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const agent = new Agent({ streamFn: unusedStreamFunction });

		expect(agent.state).toBeDefined();
		expect(agent.state.systemPrompt).toBe("");
		expect(agent.state.model).toBeDefined();
		expect(agent.state.thinkingLevel).toBe("off");
		expect(agent.state.tools).toEqual([]);
		expect(agent.state.messages).toEqual([]);
		expect(agent.state.isStreaming).toBe(false);
		expect(agent.state.streamingMessage).toBe(undefined);
		expect(agent.state.pendingToolCalls).toEqual(new Set());
		expect(agent.state.errorMessage).toBeUndefined();
	});

	// 测试场景：验证“should create an agent instance with custom initial state”对应的行为、返回值与边界条件。
	it("should create an agent instance with custom initial state", () => {
		/** 常量 customModel 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const customModel = getModel("openai", "gpt-4o-mini");
		/** 常量 agent 保存“agent”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const agent = new Agent({
			streamFn: unusedStreamFunction,
			initialState: {
				systemPrompt: "You are a helpful assistant.",
				model: customModel,
				thinkingLevel: "low",
			},
		});

		expect(agent.state.systemPrompt).toBe("You are a helpful assistant.");
		expect(agent.state.model).toBe(customModel);
		expect(agent.state.thinkingLevel).toBe("low");
	});

	// 测试场景：验证“should subscribe to events”对应的行为、返回值与边界条件。
	it("should subscribe to events", () => {
		/** 常量 agent 保存“agent”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const agent = new Agent({ streamFn: unusedStreamFunction });

		/** 变量 eventCount 保存“eventCount”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		let eventCount = 0;
		/** 常量 unsubscribe 保存“unsubscribe”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const unsubscribe = agent.subscribe((_event) => {
			eventCount++;
		});

		// No initial event on subscribe
		// 中文说明：上方英文注释描述“No initial event on subscribe”相关前提、步骤或边界；下面代码按该说明执行。
		expect(eventCount).toBe(0);

		// State mutators don't emit events
		// 中文说明：上方英文注释描述“State mutators don't emit events”相关前提、步骤或边界；下面代码按该说明执行。
		agent.state.systemPrompt = "Test prompt";
		expect(eventCount).toBe(0);
		expect(agent.state.systemPrompt).toBe("Test prompt");

		// Unsubscribe should work
		// 中文说明：上方英文注释描述“Unsubscribe should work”相关前提、步骤或边界；下面代码按该说明执行。
		unsubscribe();
		agent.state.systemPrompt = "Another prompt";
		expect(eventCount).toBe(0); // Should not increase
	});

	// 测试场景：验证“emits full lifecycle events for thrown run failures”对应的行为、返回值与边界条件。
	it("emits full lifecycle events for thrown run failures", async () => {
		/** 常量 agent 保存“agent”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const agent = new Agent({
			streamFn: () => {
				throw new Error("provider exploded");
			},
		});
		/** 常量 events 保存核对调用或事件顺序的记录；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const events: string[] = [];
		agent.subscribe((event) => {
			events.push(event.type);
		});

		await agent.prompt("hello");

		expect(events).toEqual([
			"agent_start",
			"turn_start",
			"message_start",
			"message_end",
			"message_start",
			"message_end",
			"turn_end",
			"agent_end",
		]);
		/** 常量 lastMessage 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const lastMessage = agent.state.messages[agent.state.messages.length - 1];
		expect(lastMessage?.role).toBe("assistant");
		if (lastMessage?.role !== "assistant") throw new Error("Expected assistant message");
		expect(lastMessage.stopReason).toBe("error");
		expect(lastMessage.errorMessage).toBe("provider exploded");
		expect(agent.state.errorMessage).toBe("provider exploded");
	});

	// 测试场景：验证“should await async subscribers before prompt resolves”对应的行为、返回值与边界条件。
	it("should await async subscribers before prompt resolves", async () => {
		/** 常量 barrier 保存“barrier”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const barrier = createDeferred();
		/** 常量 agent 保存“agent”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const agent = new Agent({
			streamFn: () => {
				/** 常量 stream 保存传递助手事件的异步流；取值由声明类型和当前场景约束，注意隔离可变状态。 */
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					stream.push({ type: "done", reason: "stop", message: createAssistantMessage("ok") });
				});
				return stream;
			},
		});

		/** 变量 listenerFinished 保存“listenerFinished”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		let listenerFinished = false;
		agent.subscribe(async (event) => {
			if (event.type === "agent_end") {
				await barrier.promise;
				listenerFinished = true;
			}
		});

		/** 变量 promptResolved 保存当前场景使用或生成的文本；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		let promptResolved = false;
		/** 常量 promptPromise 保存当前场景使用或生成的文本；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const promptPromise = agent.prompt("hello").then(() => {
			promptResolved = true;
		});

		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(promptResolved).toBe(false);
		expect(listenerFinished).toBe(false);
		expect(agent.state.isStreaming).toBe(true);

		barrier.resolve();
		await promptPromise;

		expect(listenerFinished).toBe(true);
		expect(promptResolved).toBe(true);
		expect(agent.state.isStreaming).toBe(false);
	});

	// 测试场景：验证“waitForIdle should wait for async subscribers”对应的行为、返回值与边界条件。
	it("waitForIdle should wait for async subscribers", async () => {
		/** 常量 barrier 保存“barrier”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const barrier = createDeferred();
		/** 常量 agent 保存“agent”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const agent = new Agent({
			streamFn: () => {
				/** 常量 stream 保存传递助手事件的异步流；取值由声明类型和当前场景约束，注意隔离可变状态。 */
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					stream.push({ type: "done", reason: "stop", message: createAssistantMessage("ok") });
				});
				return stream;
			},
		});

		agent.subscribe(async (event) => {
			if (event.type === "message_end" && event.message.role === "assistant") {
				await barrier.promise;
			}
		});

		/** 常量 promptPromise 保存当前场景使用或生成的文本；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const promptPromise = agent.prompt("hello");
		/** 变量 idleResolved 保存“idleResolved”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		let idleResolved = false;
		/** 常量 idlePromise 保存“idlePromise”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const idlePromise = agent.waitForIdle().then(() => {
			idleResolved = true;
		});

		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(idleResolved).toBe(false);
		expect(agent.state.isStreaming).toBe(true);

		barrier.resolve();
		await Promise.all([promptPromise, idlePromise]);

		expect(idleResolved).toBe(true);
		expect(agent.state.isStreaming).toBe(false);
	});

	// 测试场景：验证“should pass the active abort signal to subscribers”对应的行为、返回值与边界条件。
	it("should pass the active abort signal to subscribers", async () => {
		/** 变量 receivedSignal 保存“receivedSignal”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		let receivedSignal: AbortSignal | undefined;
		/** 常量 agent 保存“agent”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const agent = new Agent({
			streamFn: (_model, _context, options) => {
				/** 常量 stream 保存传递助手事件的异步流；取值由声明类型和当前场景约束，注意隔离可变状态。 */
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					stream.push({ type: "start", partial: createAssistantMessage("") });
					/** 处理 checkAbort 对应步骤；无参数；返回值供调用方继续执行或断言。示例：checkAbort()。 */
					const checkAbort = () => {
						if (options?.signal?.aborted) {
							stream.push({ type: "error", reason: "aborted", error: createAssistantMessage("Aborted") });
						} else {
							setTimeout(checkAbort, 5);
						}
					};
					checkAbort();
				});
				return stream;
			},
		});

		agent.subscribe((event, signal) => {
			if (event.type === "agent_start") {
				receivedSignal = signal;
			}
		});

		/** 常量 promptPromise 保存当前场景使用或生成的文本；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const promptPromise = agent.prompt("hello");
		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(receivedSignal).toBeDefined();
		expect(receivedSignal?.aborted).toBe(false);

		agent.abort();
		await promptPromise;

		expect(receivedSignal?.aborted).toBe(true);
	});

	// 测试场景：验证“should ignore tool updates after the tool execution settles”对应的行为、返回值与边界条件。
	it("should ignore tool updates after the tool execution settles", async () => {
		/** 常量 toolSchema 保存“toolSchema”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const toolSchema = Type.Object({});
		/** 变量 delayedUpdate 保存“delayedUpdate”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		let delayedUpdate: AgentToolUpdateCallback<{ status: string }> | undefined;
		/** 常量 events 保存核对调用或事件顺序的记录；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const events: AgentEvent[] = [];
		/** 常量 unhandledRejections 保存“unhandledRejections”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const unhandledRejections: unknown[] = [];
		/** 处理 onUnhandledRejection 对应步骤；参数 error 按签名提供所需输入；返回值供调用方继续执行或断言。示例：onUnhandledRejection(...)。 */
		const onUnhandledRejection = (error: unknown) => {
			unhandledRejections.push(error);
		};
		/** 常量 tool 保存“tool”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const tool: AgentTool<typeof toolSchema, { status: string }> = {
			name: "delayed_tool",
			label: "Delayed Tool",
			description: "Captures progress callbacks",
			parameters: toolSchema,
			/** 模拟可发送中间更新的工具执行；参数依次为调用编号、参数、取消信号和更新回调，返回最终工具结果。 */
			async execute(_toolCallId, _params, _signal, onUpdate) {
				delayedUpdate = onUpdate;
				onUpdate?.({
					content: [{ type: "text", text: "running" }],
					details: { status: "running" },
				});
				return {
					content: [{ type: "text", text: "ok" }],
					details: { status: "done" },
					terminate: true,
				};
			},
		};
		/** 常量 agent 保存“agent”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const agent = new Agent({
			initialState: { tools: [tool] },
			streamFn: () => {
				/** 常量 stream 保存传递助手事件的异步流；取值由声明类型和当前场景约束，注意隔离可变状态。 */
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					stream.push({
						type: "done",
						reason: "toolUse",
						message: createAssistantToolUseMessage([
							{ type: "toolCall", id: "call-1", name: "delayed_tool", arguments: {} },
						]),
					});
				});
				return stream;
			},
		});
		agent.subscribe((event) => {
			events.push(event);
		});

		process.on("unhandledRejection", onUnhandledRejection);
		try {
			await agent.prompt("run tool");
			/** 常量 eventCountAfterPrompt 保存当前场景使用或生成的文本；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const eventCountAfterPrompt = events.length;

			delayedUpdate?.({
				content: [{ type: "text", text: "late" }],
				details: { status: "late" },
			});
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(events.filter((event) => event.type === "tool_execution_update")).toHaveLength(1);
			expect(events).toHaveLength(eventCountAfterPrompt);
			expect(unhandledRejections).toEqual([]);
		} finally {
			process.off("unhandledRejection", onUnhandledRejection);
		}
	});

	// 测试场景：验证“should ignore a settled parallel tool update while another tool is still running”对应的行为、返回值与边界条件。
	it("should ignore a settled parallel tool update while another tool is still running", async () => {
		/** 常量 toolSchema 保存“toolSchema”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const toolSchema = Type.Object({});
		/** 常量 slowStarted 保存“slowStarted”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const slowStarted = createDeferred();
		/** 常量 settledToolEnded 保存“settledToolEnded”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const settledToolEnded = createDeferred();
		/** 常量 releaseSlow 保存“releaseSlow”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const releaseSlow = createDeferred();
		/** 变量 settledToolUpdate 保存“settledToolUpdate”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		let settledToolUpdate: AgentToolUpdateCallback<{ status: string }> | undefined;
		/** 常量 events 保存核对调用或事件顺序的记录；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const events: AgentEvent[] = [];
		/** 常量 settledTool 保存“settledTool”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const settledTool: AgentTool<typeof toolSchema, { status: string }> = {
			name: "settled_tool",
			label: "Settled Tool",
			description: "Captures progress callbacks",
			parameters: toolSchema,
			/** 模拟第二个并行工具执行；参数依次为调用编号、参数、取消信号和更新回调，返回最终工具结果。 */
			async execute(_toolCallId, _params, _signal, onUpdate) {
				settledToolUpdate = onUpdate;
				return {
					content: [{ type: "text", text: "done" }],
					details: { status: "done" },
					terminate: true,
				};
			},
		};
		/** 常量 slowTool 保存“slowTool”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const slowTool: AgentTool<typeof toolSchema, { status: string }> = {
			name: "slow_tool",
			label: "Slow Tool",
			description: "Keeps the agent run active",
			parameters: toolSchema,
			/** 模拟立即失败的工具执行；无参数，调用后抛出预设错误供异常路径断言。 */
			async execute() {
				slowStarted.resolve();
				await releaseSlow.promise;
				return {
					content: [{ type: "text", text: "done" }],
					details: { status: "done" },
					terminate: true,
				};
			},
		};
		/** 常量 agent 保存“agent”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const agent = new Agent({
			initialState: { tools: [settledTool, slowTool] },
			streamFn: () => {
				/** 常量 stream 保存传递助手事件的异步流；取值由声明类型和当前场景约束，注意隔离可变状态。 */
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					stream.push({
						type: "done",
						reason: "toolUse",
						message: createAssistantToolUseMessage([
							{ type: "toolCall", id: "call-1", name: "settled_tool", arguments: {} },
							{ type: "toolCall", id: "call-2", name: "slow_tool", arguments: {} },
						]),
					});
				});
				return stream;
			},
		});
		agent.subscribe((event) => {
			events.push(event);
			if (event.type === "tool_execution_end" && event.toolCallId === "call-1") {
				settledToolEnded.resolve();
			}
		});

		/** 常量 promptPromise 保存当前场景使用或生成的文本；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const promptPromise = agent.prompt("run tools");
		await Promise.all([slowStarted.promise, settledToolEnded.promise]);
		/** 常量 eventCountBeforeLateUpdate 保存“eventCountBeforeLateUpdate”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const eventCountBeforeLateUpdate = events.length;

		settledToolUpdate?.({
			content: [{ type: "text", text: "late" }],
			details: { status: "late" },
		});
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(events).toHaveLength(eventCountBeforeLateUpdate);

		releaseSlow.resolve();
		await promptPromise;
		expect(events.filter((event) => event.type === "tool_execution_update")).toHaveLength(0);
	});

	// 测试场景：验证“should update state with mutators”对应的行为、返回值与边界条件。
	it("should update state with mutators", () => {
		/** 常量 agent 保存“agent”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const agent = new Agent({ streamFn: unusedStreamFunction });

		// Test setSystemPrompt
		// 中文说明：上方英文注释描述“Test setSystemPrompt”相关前提、步骤或边界；下面代码按该说明执行。
		agent.state.systemPrompt = "Custom prompt";
		expect(agent.state.systemPrompt).toBe("Custom prompt");

		// Test setModel
		// 中文说明：上方英文注释描述“Test setModel”相关前提、步骤或边界；下面代码按该说明执行。
		const newModel = getModel("google", "gemini-2.5-flash");
		agent.state.model = newModel;
		expect(agent.state.model).toBe(newModel);

		// Test setThinkingLevel
		// 中文说明：上方英文注释描述“Test setThinkingLevel”相关前提、步骤或边界；下面代码按该说明执行。
		agent.state.thinkingLevel = "high";
		expect(agent.state.thinkingLevel).toBe("high");

		// Test setTools
		// 中文说明：上方英文注释描述“Test setTools”相关前提、步骤或边界；下面代码按该说明执行。
		const tools = [{ name: "test", description: "test tool" } as any];
		agent.state.tools = tools;
		expect(agent.state.tools).toEqual(tools);
		expect(agent.state.tools).not.toBe(tools); // Should be a copy

		// Test replaceMessages
		// 中文说明：上方英文注释描述“Test replaceMessages”相关前提、步骤或边界；下面代码按该说明执行。
		const messages = [{ role: "user" as const, content: "Hello", timestamp: Date.now() }];
		agent.state.messages = messages;
		expect(agent.state.messages).toEqual(messages);
		expect(agent.state.messages).not.toBe(messages); // Should be a copy

		// Test appendMessage
		// 中文说明：上方英文注释描述“Test appendMessage”相关前提、步骤或边界；下面代码按该说明执行。
		const newMessage = { role: "assistant" as const, content: [{ type: "text" as const, text: "Hi" }] };
		agent.state.messages.push(newMessage as any);
		expect(agent.state.messages).toHaveLength(2);
		expect(agent.state.messages[1]).toBe(newMessage);

		// Test clearMessages
		// 中文说明：上方英文注释描述“Test clearMessages”相关前提、步骤或边界；下面代码按该说明执行。
		agent.state.messages = [];
		expect(agent.state.messages).toEqual([]);
	});

	// 测试场景：验证“should support steering message queue”对应的行为、返回值与边界条件。
	it("should support steering message queue", async () => {
		/** 常量 agent 保存“agent”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const agent = new Agent({ streamFn: unusedStreamFunction });

		/** 常量 message 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const message = { role: "user" as const, content: "Steering message", timestamp: Date.now() };
		agent.steer(message);

		// The message is queued but not yet in state.messages
		// 中文说明：上方英文注释描述“The message is queued but not yet in state.messages”相关前提、步骤或边界；下面代码按该说明执行。
		expect(agent.state.messages).not.toContainEqual(message);
	});

	// 测试场景：验证“should support follow-up message queue”对应的行为、返回值与边界条件。
	it("should support follow-up message queue", async () => {
		/** 常量 agent 保存“agent”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const agent = new Agent({ streamFn: unusedStreamFunction });

		/** 常量 message 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const message = { role: "user" as const, content: "Follow-up message", timestamp: Date.now() };
		agent.followUp(message);

		// The message is queued but not yet in state.messages
		// 中文说明：上方英文注释描述“The message is queued but not yet in state.messages”相关前提、步骤或边界；下面代码按该说明执行。
		expect(agent.state.messages).not.toContainEqual(message);
	});

	// 测试场景：验证“should handle abort controller”对应的行为、返回值与边界条件。
	it("should handle abort controller", () => {
		/** 常量 agent 保存“agent”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const agent = new Agent({ streamFn: unusedStreamFunction });

		// Should not throw even if nothing is running
		// 中文说明：上方英文注释描述“Should not throw even if nothing is running”相关前提、步骤或边界；下面代码按该说明执行。
		expect(() => agent.abort()).not.toThrow();
	});

	// 测试场景：验证“should throw when prompt() called while streaming”对应的行为、返回值与边界条件。
	it("should throw when prompt() called while streaming", async () => {
		/** 变量 abortSignal 保存“abortSignal”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		let abortSignal: AbortSignal | undefined;
		/** 常量 agent 保存“agent”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const agent = new Agent({
			// Use a stream function that responds to abort
			// 中文说明：上方英文注释描述“Use a stream function that responds to abort”相关前提、步骤或边界；下面代码按该说明执行。
			streamFn: (_model, _context, options) => {
				abortSignal = options?.signal;
				/** 常量 stream 保存传递助手事件的异步流；取值由声明类型和当前场景约束，注意隔离可变状态。 */
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					stream.push({ type: "start", partial: createAssistantMessage("") });
					// Check abort signal periodically
					// 中文说明：上方英文注释描述“Check abort signal periodically”相关前提、步骤或边界；下面代码按该说明执行。
					const checkAbort = () => {
						if (abortSignal?.aborted) {
							stream.push({ type: "error", reason: "aborted", error: createAssistantMessage("Aborted") });
						} else {
							setTimeout(checkAbort, 5);
						}
					};
					checkAbort();
				});
				return stream;
			},
		});

		// Start first prompt (don't await, it will block until abort)
		// 中文说明：上方英文注释描述“Start first prompt (don't await, it will block until ab”相关前提、步骤或边界；下面代码按该说明执行。
		const firstPrompt = agent.prompt("First message");

		// Wait a tick for isStreaming to be set
		// 中文说明：上方英文注释描述“Wait a tick for isStreaming to be set”相关前提、步骤或边界；下面代码按该说明执行。
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(agent.state.isStreaming).toBe(true);

		// Second prompt should reject
		// 中文说明：上方英文注释描述“Second prompt should reject”相关前提、步骤或边界；下面代码按该说明执行。
		await expect(agent.prompt("Second message")).rejects.toThrow(
			"Agent is already processing a prompt. Use steer() or followUp() to queue messages, or wait for completion.",
		);

		// Cleanup - abort to stop the stream
		// 中文说明：上方英文注释描述“Cleanup - abort to stop the stream”相关前提、步骤或边界；下面代码按该说明执行。
		agent.abort();
		await firstPrompt.catch(() => {}); // Ignore abort error
	});

	// 测试场景：验证“should throw when continue() called while streaming”对应的行为、返回值与边界条件。
	it("should throw when continue() called while streaming", async () => {
		/** 变量 abortSignal 保存“abortSignal”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		let abortSignal: AbortSignal | undefined;
		/** 常量 agent 保存“agent”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const agent = new Agent({
			streamFn: (_model, _context, options) => {
				abortSignal = options?.signal;
				/** 常量 stream 保存传递助手事件的异步流；取值由声明类型和当前场景约束，注意隔离可变状态。 */
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					stream.push({ type: "start", partial: createAssistantMessage("") });
					/** 处理 checkAbort 对应步骤；无参数；返回值供调用方继续执行或断言。示例：checkAbort()。 */
					const checkAbort = () => {
						if (abortSignal?.aborted) {
							stream.push({ type: "error", reason: "aborted", error: createAssistantMessage("Aborted") });
						} else {
							setTimeout(checkAbort, 5);
						}
					};
					checkAbort();
				});
				return stream;
			},
		});

		// Start first prompt
		// 中文说明：上方英文注释描述“Start first prompt”相关前提、步骤或边界；下面代码按该说明执行。
		const firstPrompt = agent.prompt("First message");
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(agent.state.isStreaming).toBe(true);

		// continue() should reject
		// 中文说明：上方英文注释描述“continue() should reject”相关前提、步骤或边界；下面代码按该说明执行。
		await expect(agent.continue()).rejects.toThrow(
			"Agent is already processing. Wait for completion before continuing.",
		);

		// Cleanup
		// 中文说明：上方英文注释描述“Cleanup”相关前提、步骤或边界；下面代码按该说明执行。
		agent.abort();
		await firstPrompt.catch(() => {});
	});

	// 测试场景：验证“continue() should process queued follow-up messages after an assistant turn”对应的行为、返回值与边界条件。
	it("continue() should process queued follow-up messages after an assistant turn", async () => {
		/** 常量 agent 保存“agent”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const agent = new Agent({
			streamFn: () => {
				/** 常量 stream 保存传递助手事件的异步流；取值由声明类型和当前场景约束，注意隔离可变状态。 */
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					stream.push({ type: "done", reason: "stop", message: createAssistantMessage("Processed") });
				});
				return stream;
			},
		});

		agent.state.messages = [
			{
				role: "user",
				content: [{ type: "text", text: "Initial" }],
				timestamp: Date.now() - 10,
			},
			createAssistantMessage("Initial response"),
		];

		agent.followUp({
			role: "user",
			content: [{ type: "text", text: "Queued follow-up" }],
			timestamp: Date.now(),
		});

		await expect(agent.continue()).resolves.toBeUndefined();

		/** 常量 hasQueuedFollowUp 保存“hasQueuedFollowUp”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const hasQueuedFollowUp = agent.state.messages.some((message) => {
			if (message.role !== "user") return false;
			if (typeof message.content === "string") return message.content === "Queued follow-up";
			return message.content.some((part) => part.type === "text" && part.text === "Queued follow-up");
		});

		expect(hasQueuedFollowUp).toBe(true);
		expect(agent.state.messages[agent.state.messages.length - 1].role).toBe("assistant");
	});

	// 测试场景：验证“continue() should keep one-at-a-time steering semantics from assistant tail”对应的行为、返回值与边界条件。
	it("continue() should keep one-at-a-time steering semantics from assistant tail", async () => {
		/** 变量 responseCount 保存当前调用返回的响应；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		let responseCount = 0;
		/** 常量 agent 保存“agent”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const agent = new Agent({
			streamFn: () => {
				/** 常量 stream 保存传递助手事件的异步流；取值由声明类型和当前场景约束，注意隔离可变状态。 */
				const stream = new MockAssistantStream();
				responseCount++;
				queueMicrotask(() => {
					stream.push({
						type: "done",
						reason: "stop",
						message: createAssistantMessage(`Processed ${responseCount}`),
					});
				});
				return stream;
			},
		});

		agent.state.messages = [
			{
				role: "user",
				content: [{ type: "text", text: "Initial" }],
				timestamp: Date.now() - 10,
			},
			createAssistantMessage("Initial response"),
		];

		agent.steer({
			role: "user",
			content: [{ type: "text", text: "Steering 1" }],
			timestamp: Date.now(),
		});
		agent.steer({
			role: "user",
			content: [{ type: "text", text: "Steering 2" }],
			timestamp: Date.now() + 1,
		});

		await expect(agent.continue()).resolves.toBeUndefined();

		/** 常量 recentMessages 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const recentMessages = agent.state.messages.slice(-4);
		expect(recentMessages.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
		expect(responseCount).toBe(2);
	});

	// 测试场景：验证“keeps legacy prepareNextTurn signal callback behavior”对应的行为、返回值与边界条件。
	it("keeps legacy prepareNextTurn signal callback behavior", async () => {
		/** 常量 schema 保存“schema”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const schema = Type.Object({});
		/** 常量 tool 保存“tool”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const tool: AgentTool<typeof schema> = {
			name: "noop",
			label: "Noop",
			description: "Noop tool",
			parameters: schema,
			execute: async () => ({ content: [{ type: "text", text: "ok" }], details: {} }),
		};
		/** 变量 requestCount 保存“requestCount”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		let requestCount = 0;
		/** 变量 sawAbortSignal 保存“sawAbortSignal”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		let sawAbortSignal = false;
		/** 常量 agent 保存“agent”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const agent = new Agent({
			initialState: { tools: [tool] },
			prepareNextTurn: async (signal) => {
				sawAbortSignal = signal instanceof AbortSignal;
				return undefined;
			},
			streamFn: () => {
				requestCount++;
				/** 常量 stream 保存传递助手事件的异步流；取值由声明类型和当前场景约束，注意隔离可变状态。 */
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					if (requestCount === 1) {
						/** 常量 message 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
						const message = createAssistantToolUseMessage([
							{ type: "toolCall", id: "tool-1", name: "noop", arguments: {} },
						]);
						stream.push({ type: "done", reason: "toolUse", message });
						return;
					}
					/** 常量 message 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
					const message = createAssistantMessage("done");
					stream.push({ type: "done", reason: "stop", message });
				});
				return stream;
			},
		});

		await agent.prompt("start");

		expect(requestCount).toBe(2);
		expect(sawAbortSignal).toBe(true);
	});

	// 测试场景：验证“forwards sessionId to streamFunction options”对应的行为、返回值与边界条件。
	it("forwards sessionId to streamFunction options", async () => {
		/** 变量 receivedSessionId 保存“receivedSessionId”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		let receivedSessionId: string | undefined;
		/** 常量 agent 保存“agent”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const agent = new Agent({
			sessionId: "session-abc",
			streamFn: (_model, _context, options) => {
				receivedSessionId = options?.sessionId;
				/** 常量 stream 保存传递助手事件的异步流；取值由声明类型和当前场景约束，注意隔离可变状态。 */
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					/** 常量 message 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
					const message = createAssistantMessage("ok");
					stream.push({ type: "done", reason: "stop", message });
				});
				return stream;
			},
		});

		await agent.prompt("hello");
		expect(receivedSessionId).toBe("session-abc");

		// Test setter
		// 中文说明：上方英文注释描述“Test setter”相关前提、步骤或边界；下面代码按该说明执行。
		agent.sessionId = "session-def";
		expect(agent.sessionId).toBe("session-def");

		await agent.prompt("hello again");
		expect(receivedSessionId).toBe("session-def");
	});
});
