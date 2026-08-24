/**
 * 文件职责：验证 agentLoop 与 agentLoopContinue 在消息事件、工具调用、上下文转换、排队消息、终止和错误路径下的行为。
 * 技术维度：使用 Vitest、EventStream、TypeBox 模式和可控模拟流，构造无需真实模型服务的代理循环测试。
 * 产品维度：保障代理对话在普通回复、工具执行、并行调度与中断场景中保持可预测，避免用户看到丢消息或乱序结果。
 * 逻辑维度：先定义模型、消息与流辅助对象，再依次覆盖消息转换、工具生命周期、调度顺序、停止条件及继续既有上下文。
 * 关键边界：测试依赖微任务和少量定时器推进异步流；模拟流必须发送 done 事件，否则消费循环不会结束。
 * 新手阅读建议：先阅读辅助构造函数和基础消息事件用例，再看工具执行与队列测试，最后阅读终止条件和 agentLoopContinue 场景。
 */
import {
	type AssistantMessage,
	type AssistantMessageEvent,
	EventStream,
	type Message,
	type Model,
	type UserMessage,
} from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { describe, expect, it } from "vitest";
import { agentLoop, agentLoopContinue } from "../src/agent-loop.ts";
import { setDefaultStreamFn } from "../src/index.ts";
import type { AgentContext, AgentEvent, AgentLoopConfig, AgentMessage, AgentTool } from "../src/types.ts";

// Mock stream for testing - mimics MockAssistantStream
// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
/**
 * 用于测试的助手事件流，模拟真实模型流的完成与失败收束方式。
 * 使用场景：测试通过 push 注入事件，并由代理循环异步消费这些事件。
 */
class MockAssistantStream extends EventStream<AssistantMessageEvent, AssistantMessage> {
	/** 初始化流结束判定和最终结果提取逻辑；无参数，无显式返回值。示例：new MockAssistantStream()。 */
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

/** createUsage 执行当前测试辅助步骤；参数 无 按签名提供输入，返回值供调用方断言。示例：createUsage()。 */
function createUsage() {
	return {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 0,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
	};
}

/** createModel 执行当前测试辅助步骤；参数 无 按签名提供输入，返回值供调用方断言。示例：createModel()。 */
function createModel(): Model<"openai-responses"> {
	return {
		id: "mock",
		name: "mock",
		api: "openai-responses",
		provider: "openai",
		baseUrl: "https://example.invalid",
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 8192,
		maxTokens: 2048,
	};
}

/** createAssistantMessage 执行当前测试辅助步骤；参数 无 按签名提供输入，返回值供调用方断言。示例：createAssistantMessage()。 */
function createAssistantMessage(
	content: AssistantMessage["content"],
	stopReason: AssistantMessage["stopReason"] = "stop",
): AssistantMessage {
	return {
		role: "assistant",
		content,
		api: "openai-responses",
		provider: "openai",
		model: "mock",
		usage: createUsage(),
		stopReason,
		timestamp: Date.now(),
	};
}

/** createUserMessage 执行当前测试辅助步骤；参数 text 按签名提供输入，返回值供调用方断言。示例：createUserMessage(...)。 */
function createUserMessage(text: string): UserMessage {
	return {
		role: "user",
		content: text,
		timestamp: Date.now(),
	};
}

// Simple identity converter for tests - just passes through standard messages
// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
function identityConverter(messages: AgentMessage[]): Message[] {
	return messages.filter((m) => m.role === "user" || m.role === "assistant" || m.role === "toolResult") as Message[];
}

// 用例分组：集中验证“default stream function compatibility”相关功能。
describe("default stream function compatibility", () => {
	// 测试场景：验证“uses the configured default when a legacy caller omits streamFn”对应的行为、结果与边界。
	it("uses the configured default when a legacy caller omits streamFn", async () => {
		/** 变量 calls 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let calls = 0;
		setDefaultStreamFn(() => {
			calls++;
			/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const stream = new MockAssistantStream();
			queueMicrotask(() => {
				stream.push({
					type: "done",
					reason: "stop",
					message: createAssistantMessage([{ type: "text", text: "fallback" }]),
				});
			});
			return stream;
		});

		try {
			/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const context: AgentContext = { systemPrompt: "", messages: [], tools: [] };
			/** 常量 config 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const config: AgentLoopConfig = { model: createModel(), convertToLlm: identityConverter };
			/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const stream = Reflect.apply(agentLoop, undefined, [
				[createUserMessage("Hello")],
				context,
				config,
				undefined,
			]) as ReturnType<typeof agentLoop>;

			await stream.result();
			expect(calls).toBe(1);
		} finally {
			setDefaultStreamFn(undefined);
		}
	});
});

// 用例分组：集中验证“agentLoop with AgentMessage”相关功能。
describe("agentLoop with AgentMessage", () => {
	// 测试场景：验证“should emit events with AgentMessage types”对应的行为、结果与边界。
	it("should emit events with AgentMessage types", async () => {
		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: AgentContext = {
			systemPrompt: "You are helpful.",
			messages: [],
			tools: [],
		};

		/** 常量 userPrompt 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const userPrompt: AgentMessage = createUserMessage("Hello");

		/** 常量 config 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const config: AgentLoopConfig = {
			model: createModel(),
			convertToLlm: identityConverter,
		};

		/** streamFn 封装当前回调或辅助步骤；参数 无 提供输入，返回值用于后续流程。示例：streamFn()。 */
		const streamFn = () => {
			/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const stream = new MockAssistantStream();
			queueMicrotask(() => {
				/** 常量 message 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const message = createAssistantMessage([{ type: "text", text: "Hi there!" }]);
				stream.push({ type: "done", reason: "stop", message });
			});
			return stream;
		};

		/** 常量 events 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const events: AgentEvent[] = [];
		/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const stream = agentLoop([userPrompt], context, config, undefined, streamFn);

		for await (const event of stream) {
			events.push(event);
		}

		/** 常量 messages 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const messages = await stream.result();

		// Should have user message and assistant message
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		expect(messages.length).toBe(2);
		expect(messages[0].role).toBe("user");
		expect(messages[1].role).toBe("assistant");

		// Verify event sequence
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		const eventTypes = events.map((e) => e.type);
		expect(eventTypes).toContain("agent_start");
		expect(eventTypes).toContain("turn_start");
		expect(eventTypes).toContain("message_start");
		expect(eventTypes).toContain("message_end");
		expect(eventTypes).toContain("turn_end");
		expect(eventTypes).toContain("agent_end");
	});

	// 测试场景：验证“should handle custom message types via convertToLlm”对应的行为、结果与边界。
	it("should handle custom message types via convertToLlm", async () => {
		// Create a custom message type
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		interface CustomNotification {
			role: "notification";
			text: string;
			timestamp: number;
		}

		/** 常量 notification 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const notification: CustomNotification = {
			role: "notification",
			text: "This is a notification",
			timestamp: Date.now(),
		};

		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: AgentContext = {
			systemPrompt: "You are helpful.",
			messages: [notification as unknown as AgentMessage], // Custom message in context
			tools: [],
		};

		/** 常量 userPrompt 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const userPrompt: AgentMessage = createUserMessage("Hello");

		/** 变量 convertedMessages 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let convertedMessages: Message[] = [];
		/** 常量 config 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const config: AgentLoopConfig = {
			model: createModel(),
			convertToLlm: (messages) => {
				// Filter out notifications, convert rest
				// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
				convertedMessages = messages
					.filter((m) => (m as { role: string }).role !== "notification")
					.filter((m) => m.role === "user" || m.role === "assistant" || m.role === "toolResult") as Message[];
				return convertedMessages;
			},
		};

		/** streamFn 封装当前回调或辅助步骤；参数 无 提供输入，返回值用于后续流程。示例：streamFn()。 */
		const streamFn = () => {
			/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const stream = new MockAssistantStream();
			queueMicrotask(() => {
				/** 常量 message 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const message = createAssistantMessage([{ type: "text", text: "Response" }]);
				stream.push({ type: "done", reason: "stop", message });
			});
			return stream;
		};

		/** 常量 events 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const events: AgentEvent[] = [];
		/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const stream = agentLoop([userPrompt], context, config, undefined, streamFn);

		for await (const event of stream) {
			events.push(event);
		}

		// The notification should have been filtered out in convertToLlm
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		expect(convertedMessages.length).toBe(1); // Only user message
		expect(convertedMessages[0].role).toBe("user");
	});

	// 测试场景：验证“should apply transformContext before convertToLlm”对应的行为、结果与边界。
	it("should apply transformContext before convertToLlm", async () => {
		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: AgentContext = {
			systemPrompt: "You are helpful.",
			messages: [
				createUserMessage("old message 1"),
				createAssistantMessage([{ type: "text", text: "old response 1" }]),
				createUserMessage("old message 2"),
				createAssistantMessage([{ type: "text", text: "old response 2" }]),
			],
			tools: [],
		};

		/** 常量 userPrompt 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const userPrompt: AgentMessage = createUserMessage("new message");

		/** 变量 transformedMessages 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let transformedMessages: AgentMessage[] = [];
		/** 变量 convertedMessages 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let convertedMessages: Message[] = [];

		/** 常量 config 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const config: AgentLoopConfig = {
			model: createModel(),
			transformContext: async (messages) => {
				// Keep only last 2 messages (prune old ones)
				// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
				transformedMessages = messages.slice(-2);
				return transformedMessages;
			},
			convertToLlm: (messages) => {
				convertedMessages = messages.filter(
					(m) => m.role === "user" || m.role === "assistant" || m.role === "toolResult",
				) as Message[];
				return convertedMessages;
			},
		};

		/** streamFn 封装当前回调或辅助步骤；参数 无 提供输入，返回值用于后续流程。示例：streamFn()。 */
		const streamFn = () => {
			/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const stream = new MockAssistantStream();
			queueMicrotask(() => {
				/** 常量 message 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const message = createAssistantMessage([{ type: "text", text: "Response" }]);
				stream.push({ type: "done", reason: "stop", message });
			});
			return stream;
		};

		/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const stream = agentLoop([userPrompt], context, config, undefined, streamFn);

		for await (const _ of stream) {
			// consume
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		}

		// transformContext should have been called first, keeping only last 2
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		expect(transformedMessages.length).toBe(2);
		// Then convertToLlm receives the pruned messages
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		expect(convertedMessages.length).toBe(2);
	});

	// 测试场景：验证“should handle tool calls and results”对应的行为、结果与边界。
	it("should handle tool calls and results", async () => {
		/** 常量 toolSchema 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const toolSchema = Type.Object({ value: Type.String() });
		/** 常量 executed 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const executed: string[] = [];
		/** 常量 toolUsage 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const toolUsage = {
			input: 1,
			output: 2,
			cacheRead: 3,
			cacheWrite: 4,
			totalTokens: 10,
			cost: { input: 0.1, output: 0.2, cacheRead: 0.3, cacheWrite: 0.4, total: 1 },
		};
		/** 常量 patchedToolUsage 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const patchedToolUsage = {
			input: 5,
			output: 6,
			cacheRead: 7,
			cacheWrite: 8,
			totalTokens: 26,
			cost: { input: 0.5, output: 0.6, cacheRead: 0.7, cacheWrite: 0.8, total: 2.6 },
		};
		/** 变量 observedToolUsage 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let observedToolUsage: typeof toolUsage | undefined;
		/** 常量 tool 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tool: AgentTool<typeof toolSchema, { value: string }> = {
			name: "echo",
			label: "Echo",
			description: "Echo tool",
			parameters: toolSchema,
			async execute(_toolCallId, params) {
				executed.push(params.value);
				return {
					content: [{ type: "text", text: `echoed: ${params.value}` }],
					details: { value: params.value },
					usage: toolUsage,
				};
			},
		};

		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: AgentContext = {
			systemPrompt: "",
			messages: [],
			tools: [tool],
		};

		/** 常量 userPrompt 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const userPrompt: AgentMessage = createUserMessage("echo something");

		/** 常量 config 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const config: AgentLoopConfig = {
			model: createModel(),
			convertToLlm: identityConverter,
			afterToolCall: async ({ result }) => {
				observedToolUsage = result.usage;
				return { usage: patchedToolUsage };
			},
		};

		/** 变量 callIndex 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let callIndex = 0;
		/** streamFn 封装当前回调或辅助步骤；参数 无 提供输入，返回值用于后续流程。示例：streamFn()。 */
		const streamFn = () => {
			/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const stream = new MockAssistantStream();
			queueMicrotask(() => {
				if (callIndex === 0) {
					// First call: return tool call
					// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
					const message = createAssistantMessage(
						[{ type: "toolCall", id: "tool-1", name: "echo", arguments: { value: "hello" } }],
						"toolUse",
					);
					stream.push({ type: "done", reason: "toolUse", message });
				} else {
					// Second call: return final response
					// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
					const message = createAssistantMessage([{ type: "text", text: "done" }]);
					stream.push({ type: "done", reason: "stop", message });
				}
				callIndex++;
			});
			return stream;
		};

		/** 常量 events 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const events: AgentEvent[] = [];
		/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const stream = agentLoop([userPrompt], context, config, undefined, streamFn);

		for await (const event of stream) {
			events.push(event);
		}

		// Tool should have been executed
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		expect(executed).toEqual(["hello"]);

		// Should have tool execution events
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		const toolStart = events.find((e) => e.type === "tool_execution_start");
		/** 常量 toolEnd 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const toolEnd = events.find((e) => e.type === "tool_execution_end");
		expect(toolStart).toBeDefined();
		expect(toolEnd).toBeDefined();
		if (toolEnd?.type === "tool_execution_end") {
			expect(toolEnd.isError).toBe(false);
		}
		expect(observedToolUsage).toEqual(toolUsage);
		/** 常量 messages 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const messages = await stream.result();
		/** 常量 toolResult 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const toolResult = messages.find((message) => message.role === "toolResult");
		expect(toolResult?.role === "toolResult" ? toolResult.usage : undefined).toEqual(patchedToolUsage);
	});

	// 测试场景：验证“should not execute tool calls from a length-truncated assistant message”对应的行为、结果与边界。
	it("should not execute tool calls from a length-truncated assistant message", async () => {
		/** 常量 toolSchema 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const toolSchema = Type.Object({ value: Type.String() });
		/** 常量 executed 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const executed: string[] = [];
		/** 常量 tool 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tool: AgentTool<typeof toolSchema, { value: string }> = {
			name: "echo",
			label: "Echo",
			description: "Echo tool",
			parameters: toolSchema,
			async execute(_toolCallId, params) {
				executed.push(params.value);
				return {
					content: [{ type: "text", text: `echoed: ${params.value}` }],
					details: { value: params.value },
				};
			},
		};

		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: AgentContext = {
			systemPrompt: "",
			messages: [],
			tools: [tool],
		};

		/** 常量 config 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const config: AgentLoopConfig = {
			model: createModel(),
			convertToLlm: identityConverter,
		};

		/** 变量 callIndex 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let callIndex = 0;
		/** streamFn 封装当前回调或辅助步骤；参数 无 提供输入，返回值用于后续流程。示例：streamFn()。 */
		const streamFn = () => {
			/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const stream = new MockAssistantStream();
			queueMicrotask(() => {
				if (callIndex === 0) {
					// Output hit the token limit mid tool call. The salvage parser can
					// produce arguments that validate but are silently truncated, so
					// nothing in this message may execute.
					// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
					const message = createAssistantMessage(
						[{ type: "toolCall", id: "tool-1", name: "echo", arguments: { value: "hel" } }],
						"length",
					);
					stream.push({ type: "done", reason: "length", message });
				} else {
					/** 常量 message 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const message = createAssistantMessage([{ type: "text", text: "done" }]);
					stream.push({ type: "done", reason: "stop", message });
				}
				callIndex++;
			});
			return stream;
		};

		/** 常量 events 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const events: AgentEvent[] = [];
		/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const stream = agentLoop([createUserMessage("echo something")], context, config, undefined, streamFn);
		for await (const event of stream) {
			events.push(event);
		}

		// The tool must never execute with potentially truncated arguments.
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		expect(executed).toEqual([]);

		/** 常量 toolEnd 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const toolEnd = events.find((e) => e.type === "tool_execution_end");
		expect(toolEnd).toBeDefined();
		if (toolEnd?.type === "tool_execution_end") {
			expect(toolEnd.isError).toBe(true);
			/** 常量 text 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const text = toolEnd.result.content.find((c: { type: string }) => c.type === "text");
			expect(text && "text" in text ? text.text : "").toContain("output token limit");
		}

		// The loop continues so the model can re-issue the tool call.
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		expect(callIndex).toBe(2);
		/** 常量 messages 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const messages = await stream.result();
		expect(messages[messages.length - 1].role).toBe("assistant");
	});

	// 测试场景：验证“should execute mutated beforeToolCall args without revalidation”对应的行为、结果与边界。
	it("should execute mutated beforeToolCall args without revalidation", async () => {
		/** 常量 toolSchema 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const toolSchema = Type.Object({ value: Type.String() });
		/** 常量 executed 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const executed: Array<string | number> = [];
		/** 常量 tool 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tool: AgentTool<typeof toolSchema, { value: string | number }> = {
			name: "echo",
			label: "Echo",
			description: "Echo tool",
			parameters: toolSchema,
			async execute(_toolCallId, params) {
				executed.push(params.value as string | number);
				return {
					content: [{ type: "text", text: `echoed: ${String(params.value)}` }],
					details: { value: params.value as string | number },
				};
			},
		};

		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: AgentContext = {
			systemPrompt: "",
			messages: [],
			tools: [tool],
		};

		/** 常量 userPrompt 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const userPrompt: AgentMessage = createUserMessage("echo something");

		/** 常量 config 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const config: AgentLoopConfig = {
			model: createModel(),
			convertToLlm: identityConverter,
			beforeToolCall: async ({ args }) => {
				/** 常量 mutableArgs 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const mutableArgs = args as { value: string | number };
				mutableArgs.value = 123;
				return undefined;
			},
		};

		/** 变量 callIndex 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let callIndex = 0;
		/** streamFn 封装当前回调或辅助步骤；参数 无 提供输入，返回值用于后续流程。示例：streamFn()。 */
		const streamFn = () => {
			/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const stream = new MockAssistantStream();
			queueMicrotask(() => {
				if (callIndex === 0) {
					/** 常量 message 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const message = createAssistantMessage(
						[{ type: "toolCall", id: "tool-1", name: "echo", arguments: { value: "hello" } }],
						"toolUse",
					);
					stream.push({ type: "done", reason: "toolUse", message });
				} else {
					/** 常量 message 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const message = createAssistantMessage([{ type: "text", text: "done" }]);
					stream.push({ type: "done", reason: "stop", message });
				}
				callIndex++;
			});
			return stream;
		};

		/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const stream = agentLoop([userPrompt], context, config, undefined, streamFn);
		for await (const _event of stream) {
			// consume
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		}

		expect(executed).toEqual([123]);
	});

	// 测试场景：验证“should prepare tool arguments for validation”对应的行为、结果与边界。
	it("should prepare tool arguments for validation", async () => {
		/** 常量 replaceSchema 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const replaceSchema = Type.Object({ oldText: Type.String(), newText: Type.String() });
		/** 常量 toolSchema 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const toolSchema = Type.Object({ edits: Type.Array(replaceSchema) });
		/** 常量 executed 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const executed: Array<Array<{ oldText: string; newText: string }>> = [];
		/** 常量 tool 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tool: AgentTool<typeof toolSchema, { count: number }> = {
			name: "edit",
			label: "Edit",
			description: "Edit tool",
			parameters: toolSchema,
			prepareArguments(args) {
				if (!args || typeof args !== "object") {
					return args as { edits: { oldText: string; newText: string }[] };
				}
				/** 常量 input 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const input = args as {
					edits?: Array<{ oldText: string; newText: string }>;
					oldText?: string;
					newText?: string;
				};
				if (typeof input.oldText !== "string" || typeof input.newText !== "string") {
					return args as { edits: { oldText: string; newText: string }[] };
				}
				return {
					edits: [...(input.edits ?? []), { oldText: input.oldText, newText: input.newText }],
				};
			},
			async execute(_toolCallId, params) {
				executed.push(params.edits);
				return {
					content: [{ type: "text", text: `edited ${params.edits.length}` }],
					details: { count: params.edits.length },
				};
			},
		};

		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: AgentContext = {
			systemPrompt: "",
			messages: [],
			tools: [tool],
		};

		/** 常量 userPrompt 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const userPrompt: AgentMessage = createUserMessage("edit something");
		/** 常量 config 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const config: AgentLoopConfig = {
			model: createModel(),
			convertToLlm: identityConverter,
		};

		/** 变量 callIndex 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let callIndex = 0;
		/** streamFn 封装当前回调或辅助步骤；参数 无 提供输入，返回值用于后续流程。示例：streamFn()。 */
		const streamFn = () => {
			/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const stream = new MockAssistantStream();
			queueMicrotask(() => {
				if (callIndex === 0) {
					/** 常量 message 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const message = createAssistantMessage(
						[
							{
								type: "toolCall",
								id: "tool-1",
								name: "edit",
								arguments: { oldText: "before", newText: "after" },
							},
						],
						"toolUse",
					);
					stream.push({ type: "done", reason: "toolUse", message });
				} else {
					/** 常量 message 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const message = createAssistantMessage([{ type: "text", text: "done" }]);
					stream.push({ type: "done", reason: "stop", message });
				}
				callIndex++;
			});
			return stream;
		};

		/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const stream = agentLoop([userPrompt], context, config, undefined, streamFn);
		for await (const _event of stream) {
			// consume
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		}

		expect(executed).toEqual([[{ oldText: "before", newText: "after" }]]);
	});

	// 测试场景：验证“should emit tool_execution_end in completion order but persist tool results in source order”对应的行为、结果与边界。
	it("should emit tool_execution_end in completion order but persist tool results in source order", async () => {
		/** 常量 toolSchema 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const toolSchema = Type.Object({ value: Type.String() });
		/** 变量 firstResolved 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let firstResolved = false;
		/** 变量 parallelObserved 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let parallelObserved = false;
		/** 变量 releaseFirst 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let releaseFirst: (() => void) | undefined;
		/** 常量 firstDone 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const firstDone = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});

		/** 常量 tool 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tool: AgentTool<typeof toolSchema, { value: string }> = {
			name: "echo",
			label: "Echo",
			description: "Echo tool",
			parameters: toolSchema,
			async execute(_toolCallId, params) {
				if (params.value === "first") {
					await firstDone;
					firstResolved = true;
				}
				if (params.value === "second" && !firstResolved) {
					parallelObserved = true;
				}
				return {
					content: [{ type: "text", text: `echoed: ${params.value}` }],
					details: { value: params.value },
				};
			},
		};

		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: AgentContext = {
			systemPrompt: "",
			messages: [],
			tools: [tool],
		};

		/** 常量 userPrompt 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const userPrompt: AgentMessage = createUserMessage("echo both");
		/** 常量 config 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const config: AgentLoopConfig = {
			model: createModel(),
			convertToLlm: identityConverter,
			toolExecution: "parallel",
		};

		/** 变量 callIndex 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let callIndex = 0;
		/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const stream = agentLoop([userPrompt], context, config, undefined, () => {
			/** 常量 mockStream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const mockStream = new MockAssistantStream();
			queueMicrotask(() => {
				if (callIndex === 0) {
					/** 常量 message 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const message = createAssistantMessage(
						[
							{ type: "toolCall", id: "tool-1", name: "echo", arguments: { value: "first" } },
							{ type: "toolCall", id: "tool-2", name: "echo", arguments: { value: "second" } },
						],
						"toolUse",
					);
					mockStream.push({ type: "done", reason: "toolUse", message });
					setTimeout(() => releaseFirst?.(), 20);
				} else {
					/** 常量 message 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const message = createAssistantMessage([{ type: "text", text: "done" }]);
					mockStream.push({ type: "done", reason: "stop", message });
				}
				callIndex++;
			});
			return mockStream;
		});

		/** 常量 events 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const events: AgentEvent[] = [];
		for await (const event of stream) {
			events.push(event);
		}

		/** 常量 toolExecutionEndIds 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const toolExecutionEndIds = events.flatMap((event) => {
			if (event.type !== "tool_execution_end") {
				return [];
			}
			return [event.toolCallId];
		});
		/** 常量 toolResultIds 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const toolResultIds = events.flatMap((event) => {
			if (event.type !== "message_end" || event.message.role !== "toolResult") {
				return [];
			}
			return [event.message.toolCallId];
		});
		/** 常量 turnToolResultIds 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const turnToolResultIds = events.flatMap((event) => {
			if (event.type !== "turn_end") {
				return [];
			}
			return event.toolResults.map((toolResult) => toolResult.toolCallId);
		});

		expect(parallelObserved).toBe(true);
		expect(toolExecutionEndIds).toEqual(["tool-2", "tool-1"]);
		expect(toolResultIds).toEqual(["tool-1", "tool-2"]);
		expect(turnToolResultIds).toEqual(["tool-1", "tool-2"]);
	});

	// 测试场景：验证“should inject queued messages after all tool calls complete”对应的行为、结果与边界。
	it("should inject queued messages after all tool calls complete", async () => {
		/** 常量 toolSchema 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const toolSchema = Type.Object({ value: Type.String() });
		/** 常量 executed 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const executed: string[] = [];
		/** 常量 tool 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tool: AgentTool<typeof toolSchema, { value: string }> = {
			name: "echo",
			label: "Echo",
			description: "Echo tool",
			parameters: toolSchema,
			async execute(_toolCallId, params) {
				executed.push(params.value);
				return {
					content: [{ type: "text", text: `ok:${params.value}` }],
					details: { value: params.value },
				};
			},
		};

		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: AgentContext = {
			systemPrompt: "",
			messages: [],
			tools: [tool],
		};

		/** 常量 userPrompt 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const userPrompt: AgentMessage = createUserMessage("start");
		/** 常量 queuedUserMessage 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const queuedUserMessage: AgentMessage = createUserMessage("interrupt");

		/** 变量 queuedDelivered 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let queuedDelivered = false;
		/** 变量 callIndex 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let callIndex = 0;
		/** 变量 sawInterruptInContext 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let sawInterruptInContext = false;

		/** 常量 config 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const config: AgentLoopConfig = {
			model: createModel(),
			convertToLlm: identityConverter,
			toolExecution: "sequential",
			getSteeringMessages: async () => {
				// Return steering message after tool execution has started.
				// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
				if (executed.length >= 1 && !queuedDelivered) {
					queuedDelivered = true;
					return [queuedUserMessage];
				}
				return [];
			},
		};

		/** 常量 events 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const events: AgentEvent[] = [];
		/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const stream = agentLoop([userPrompt], context, config, undefined, (_model, ctx, _options) => {
			// Check if interrupt message is in context on second call
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			if (callIndex === 1) {
				sawInterruptInContext = ctx.messages.some(
					(m) => m.role === "user" && typeof m.content === "string" && m.content === "interrupt",
				);
			}

			/** 常量 mockStream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const mockStream = new MockAssistantStream();
			queueMicrotask(() => {
				if (callIndex === 0) {
					// First call: return two tool calls
					// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
					const message = createAssistantMessage(
						[
							{ type: "toolCall", id: "tool-1", name: "echo", arguments: { value: "first" } },
							{ type: "toolCall", id: "tool-2", name: "echo", arguments: { value: "second" } },
						],
						"toolUse",
					);
					mockStream.push({ type: "done", reason: "toolUse", message });
				} else {
					// Second call: return final response
					// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
					const message = createAssistantMessage([{ type: "text", text: "done" }]);
					mockStream.push({ type: "done", reason: "stop", message });
				}
				callIndex++;
			});
			return mockStream;
		});

		for await (const event of stream) {
			events.push(event);
		}

		// Both tools should execute before steering is injected
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		expect(executed).toEqual(["first", "second"]);

		/** 常量 toolEnds 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const toolEnds = events.filter(
			(e): e is Extract<AgentEvent, { type: "tool_execution_end" }> => e.type === "tool_execution_end",
		);
		expect(toolEnds.length).toBe(2);
		expect(toolEnds[0].isError).toBe(false);
		expect(toolEnds[1].isError).toBe(false);

		// Queued message should appear in events after both tool result messages
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		const eventSequence = events.flatMap((event) => {
			if (event.type !== "message_start") return [];
			if (event.message.role === "toolResult") return [`tool:${event.message.toolCallId}`];
			if (event.message.role === "user" && typeof event.message.content === "string") {
				return [event.message.content];
			}
			return [];
		});
		expect(eventSequence).toContain("interrupt");
		expect(eventSequence.indexOf("tool:tool-1")).toBeLessThan(eventSequence.indexOf("interrupt"));
		expect(eventSequence.indexOf("tool:tool-2")).toBeLessThan(eventSequence.indexOf("interrupt"));

		// Interrupt message should be in context when second LLM call is made
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		expect(sawInterruptInContext).toBe(true);
	});

	// 测试场景：验证“should force sequential execution when a tool has executionMode=sequential even with default parallel config”对应的行为、结果与边界。
	it("should force sequential execution when a tool has executionMode=sequential even with default parallel config", async () => {
		/** 常量 toolSchema 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const toolSchema = Type.Object({ value: Type.String() });
		/** 变量 firstResolved 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let firstResolved = false;
		/** 变量 parallelObserved 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let parallelObserved = false;
		/** 变量 releaseFirst 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let releaseFirst: (() => void) | undefined;
		/** 常量 firstDone 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const firstDone = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});

		/** 常量 slowTool 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const slowTool: AgentTool<typeof toolSchema, { value: string }> = {
			name: "slow",
			label: "Slow",
			description: "Slow tool",
			parameters: toolSchema,
			executionMode: "sequential",
			async execute(_toolCallId, params) {
				if (params.value === "first") {
					await firstDone;
					firstResolved = true;
				}
				if (params.value === "second" && !firstResolved) {
					parallelObserved = true;
				}
				return {
					content: [{ type: "text", text: `slow: ${params.value}` }],
					details: { value: params.value },
				};
			},
		};

		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: AgentContext = {
			systemPrompt: "",
			messages: [],
			tools: [slowTool],
		};

		/** 常量 userPrompt 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const userPrompt: AgentMessage = createUserMessage("run both");
		// config is parallel (default), but tool forces sequential
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		const config: AgentLoopConfig = {
			model: createModel(),
			convertToLlm: identityConverter,
		};

		/** 变量 callIndex 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let callIndex = 0;
		/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const stream = agentLoop([userPrompt], context, config, undefined, () => {
			/** 常量 mockStream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const mockStream = new MockAssistantStream();
			queueMicrotask(() => {
				if (callIndex === 0) {
					/** 常量 message 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const message = createAssistantMessage(
						[
							{ type: "toolCall", id: "tool-1", name: "slow", arguments: { value: "first" } },
							{ type: "toolCall", id: "tool-2", name: "slow", arguments: { value: "second" } },
						],
						"toolUse",
					);
					mockStream.push({ type: "done", reason: "toolUse", message });
					setTimeout(() => releaseFirst?.(), 20);
				} else {
					/** 常量 message 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const message = createAssistantMessage([{ type: "text", text: "done" }]);
					mockStream.push({ type: "done", reason: "stop", message });
				}
				callIndex++;
			});
			return mockStream;
		});

		/** 常量 events 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const events: AgentEvent[] = [];
		for await (const event of stream) {
			events.push(event);
		}

		// With sequential execution, second tool should NOT start before first finishes
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		expect(parallelObserved).toBe(false);

		/** 常量 toolResultIds 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const toolResultIds = events.flatMap((event) => {
			if (event.type !== "message_end" || event.message.role !== "toolResult") {
				return [];
			}
			return [event.message.toolCallId];
		});
		expect(toolResultIds).toEqual(["tool-1", "tool-2"]);
	});

	// 测试场景：验证“should force sequential execution when one of multiple tools has executionMode=sequential”对应的行为、结果与边界。
	it("should force sequential execution when one of multiple tools has executionMode=sequential", async () => {
		/** 常量 toolSchema 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const toolSchema = Type.Object({ value: Type.String() });
		/** 常量 executionOrder 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const executionOrder: string[] = [];
		/** 变量 releaseSlow 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let releaseSlow: (() => void) | undefined;
		/** 常量 slowDone 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const slowDone = new Promise<void>((resolve) => {
			releaseSlow = resolve;
		});

		/** 常量 slowTool 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const slowTool: AgentTool<typeof toolSchema, { value: string }> = {
			name: "slow",
			label: "Slow",
			description: "Slow tool",
			parameters: toolSchema,
			executionMode: "sequential",
			async execute(_toolCallId, params) {
				executionOrder.push(`slow:${params.value}`);
				if (params.value === "a") {
					await slowDone;
				}
				return {
					content: [{ type: "text", text: `slow: ${params.value}` }],
					details: { value: params.value },
				};
			},
		};

		/** 常量 fastTool 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fastTool: AgentTool<typeof toolSchema, { value: string }> = {
			name: "fast",
			label: "Fast",
			description: "Fast tool",
			parameters: toolSchema,
			// no executionMode = defaults to parallel
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			async execute(_toolCallId, params) {
				executionOrder.push(`fast:${params.value}`);
				return {
					content: [{ type: "text", text: `fast: ${params.value}` }],
					details: { value: params.value },
				};
			},
		};

		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: AgentContext = {
			systemPrompt: "",
			messages: [],
			tools: [slowTool, fastTool],
		};

		/** 常量 userPrompt 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const userPrompt: AgentMessage = createUserMessage("run both");
		/** 常量 config 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const config: AgentLoopConfig = {
			model: createModel(),
			convertToLlm: identityConverter,
			// parallel by default, but slowTool forces sequential
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		};

		/** 变量 callIndex 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let callIndex = 0;
		/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const stream = agentLoop([userPrompt], context, config, undefined, () => {
			/** 常量 mockStream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const mockStream = new MockAssistantStream();
			queueMicrotask(() => {
				if (callIndex === 0) {
					/** 常量 message 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const message = createAssistantMessage(
						[
							{ type: "toolCall", id: "tool-1", name: "slow", arguments: { value: "a" } },
							{ type: "toolCall", id: "tool-2", name: "fast", arguments: { value: "b" } },
						],
						"toolUse",
					);
					mockStream.push({ type: "done", reason: "toolUse", message });
					setTimeout(() => releaseSlow?.(), 20);
				} else {
					/** 常量 message 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const message = createAssistantMessage([{ type: "text", text: "done" }]);
					mockStream.push({ type: "done", reason: "stop", message });
				}
				callIndex++;
			});
			return mockStream;
		});

		/** 常量 events 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const events: AgentEvent[] = [];
		for await (const event of stream) {
			events.push(event);
		}

		// Fast tool should NOT run before slow tool finishes
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		expect(executionOrder[0]).toBe("slow:a");
		expect(executionOrder).toContain("fast:b");
	});

	// 测试场景：验证“should allow parallel execution when all tools have executionMode=parallel”对应的行为、结果与边界。
	it("should allow parallel execution when all tools have executionMode=parallel", async () => {
		/** 常量 toolSchema 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const toolSchema = Type.Object({ value: Type.String() });
		/** 变量 firstResolved 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let firstResolved = false;
		/** 变量 parallelObserved 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let parallelObserved = false;
		/** 变量 releaseFirst 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let releaseFirst: (() => void) | undefined;
		/** 常量 firstDone 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const firstDone = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});

		/** 常量 tool 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tool: AgentTool<typeof toolSchema, { value: string }> = {
			name: "echo",
			label: "Echo",
			description: "Echo tool",
			parameters: toolSchema,
			executionMode: "parallel",
			async execute(_toolCallId, params) {
				if (params.value === "first") {
					await firstDone;
					firstResolved = true;
				}
				if (params.value === "second" && !firstResolved) {
					parallelObserved = true;
				}
				return {
					content: [{ type: "text", text: `echoed: ${params.value}` }],
					details: { value: params.value },
				};
			},
		};

		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: AgentContext = {
			systemPrompt: "",
			messages: [],
			tools: [tool],
		};

		/** 常量 userPrompt 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const userPrompt: AgentMessage = createUserMessage("echo both");
		/** 常量 config 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const config: AgentLoopConfig = {
			model: createModel(),
			convertToLlm: identityConverter,
		};

		/** 变量 callIndex 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let callIndex = 0;
		/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const stream = agentLoop([userPrompt], context, config, undefined, () => {
			/** 常量 mockStream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const mockStream = new MockAssistantStream();
			queueMicrotask(() => {
				if (callIndex === 0) {
					/** 常量 message 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const message = createAssistantMessage(
						[
							{ type: "toolCall", id: "tool-1", name: "echo", arguments: { value: "first" } },
							{ type: "toolCall", id: "tool-2", name: "echo", arguments: { value: "second" } },
						],
						"toolUse",
					);
					mockStream.push({ type: "done", reason: "toolUse", message });
					setTimeout(() => releaseFirst?.(), 20);
				} else {
					/** 常量 message 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const message = createAssistantMessage([{ type: "text", text: "done" }]);
					mockStream.push({ type: "done", reason: "stop", message });
				}
				callIndex++;
			});
			return mockStream;
		});

		/** 常量 events 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const events: AgentEvent[] = [];
		for await (const event of stream) {
			events.push(event);
		}

		// With executionMode=parallel, second tool should start before first finishes
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		expect(parallelObserved).toBe(true);
	});

	// 测试场景：验证“should use prepareNextTurn snapshot before continuing”对应的行为、结果与边界。
	it("should use prepareNextTurn snapshot before continuing", async () => {
		/** 常量 toolSchema 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const toolSchema = Type.Object({ value: Type.String() });
		/** 常量 tool 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tool: AgentTool<typeof toolSchema, { value: string }> = {
			name: "echo",
			label: "Echo",
			description: "Echo tool",
			parameters: toolSchema,
			async execute(_toolCallId, params) {
				return {
					content: [{ type: "text", text: `echoed: ${params.value}` }],
					details: { value: params.value },
				};
			},
		};
		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: AgentContext = {
			systemPrompt: "first prompt",
			messages: [],
			tools: [tool],
		};
		/** 变量 convertedSecondTurnSystemPrompt 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let convertedSecondTurnSystemPrompt = "";
		/** 变量 prepared 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let prepared = false;
		/** 常量 config 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const config: AgentLoopConfig = {
			model: createModel(),
			convertToLlm: identityConverter,
			prepareNextTurn: async ({ context: currentContext }) => {
				if (prepared) return undefined;
				prepared = true;
				return {
					context: {
						systemPrompt: "second prompt",
						messages: currentContext.messages.slice(),
						tools: currentContext.tools,
					},
				};
			},
		};

		/** 变量 llmCalls 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let llmCalls = 0;
		/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const stream = agentLoop([createUserMessage("echo something")], context, config, undefined, (_model, ctx) => {
			llmCalls++;
			if (llmCalls === 2) {
				convertedSecondTurnSystemPrompt = ctx.systemPrompt ?? "";
			}
			/** 常量 mockStream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const mockStream = new MockAssistantStream();
			queueMicrotask(() => {
				if (llmCalls === 1) {
					mockStream.push({
						type: "done",
						reason: "toolUse",
						message: createAssistantMessage(
							[{ type: "toolCall", id: "tool-1", name: "echo", arguments: { value: "hello" } }],
							"toolUse",
						),
					});
				} else {
					mockStream.push({
						type: "done",
						reason: "stop",
						message: createAssistantMessage([{ type: "text", text: "done" }]),
					});
				}
			});
			return mockStream;
		});

		for await (const _event of stream) {
			// consume
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		}

		expect(llmCalls).toBe(2);
		expect(convertedSecondTurnSystemPrompt).toBe("second prompt");
	});

	// 测试场景：验证“should stop after the current turn when shouldStopAfterTurn returns true”对应的行为、结果与边界。
	it("should stop after the current turn when shouldStopAfterTurn returns true", async () => {
		/** 常量 toolSchema 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const toolSchema = Type.Object({ value: Type.String() });
		/** 常量 executed 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const executed: string[] = [];
		/** 常量 tool 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tool: AgentTool<typeof toolSchema, { value: string }> = {
			name: "echo",
			label: "Echo",
			description: "Echo tool",
			parameters: toolSchema,
			async execute(_toolCallId, params) {
				executed.push(params.value);
				return {
					content: [{ type: "text", text: `echoed: ${params.value}` }],
					details: { value: params.value },
				};
			},
		};

		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: AgentContext = {
			systemPrompt: "",
			messages: [],
			tools: [tool],
		};

		/** 变量 steeringPolls 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let steeringPolls = 0;
		/** 变量 followUpPolls 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let followUpPolls = 0;
		/** 变量 callbackToolResultIds 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let callbackToolResultIds: string[] = [];
		/** 变量 callbackContextRoles 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let callbackContextRoles: string[] = [];
		/** 常量 config 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const config: AgentLoopConfig = {
			model: createModel(),
			convertToLlm: identityConverter,
			getSteeringMessages: async () => {
				steeringPolls++;
				return [];
			},
			getFollowUpMessages: async () => {
				followUpPolls++;
				return [createUserMessage("follow up should stay queued")];
			},
			shouldStopAfterTurn: async ({ message, toolResults, context }) => {
				expect(message.role).toBe("assistant");
				callbackToolResultIds = toolResults.map((toolResult) => toolResult.toolCallId);
				callbackContextRoles = context.messages.map((contextMessage) => contextMessage.role);
				return true;
			},
		};

		/** 变量 llmCalls 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let llmCalls = 0;
		/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const stream = agentLoop([createUserMessage("echo something")], context, config, undefined, () => {
			llmCalls++;
			/** 常量 mockStream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const mockStream = new MockAssistantStream();
			queueMicrotask(() => {
				if (llmCalls === 1) {
					/** 常量 message 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const message = createAssistantMessage(
						[{ type: "toolCall", id: "tool-1", name: "echo", arguments: { value: "hello" } }],
						"toolUse",
					);
					mockStream.push({ type: "done", reason: "toolUse", message });
				} else {
					mockStream.push({
						type: "done",
						reason: "stop",
						message: createAssistantMessage([{ type: "text", text: "should not run" }]),
					});
				}
			});
			return mockStream;
		});

		/** 常量 events 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const events: AgentEvent[] = [];
		for await (const event of stream) {
			events.push(event);
		}

		/** 常量 messages 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const messages = await stream.result();
		expect(llmCalls).toBe(1);
		expect(executed).toEqual(["hello"]);
		expect(steeringPolls).toBe(1);
		expect(followUpPolls).toBe(0);
		expect(callbackToolResultIds).toEqual(["tool-1"]);
		expect(callbackContextRoles).toEqual(["user", "assistant", "toolResult"]);
		expect(messages.map((message) => message.role)).toEqual(["user", "assistant", "toolResult"]);
		expect(events.map((event) => event.type)).toEqual([
			"agent_start",
			"turn_start",
			"message_start",
			"message_end",
			"message_start",
			"message_end",
			"tool_execution_start",
			"tool_execution_end",
			"message_start",
			"message_end",
			"turn_end",
			"agent_end",
		]);
	});

	// 测试场景：验证“should stop after a tool batch when every tool result sets terminate=true”对应的行为、结果与边界。
	it("should stop after a tool batch when every tool result sets terminate=true", async () => {
		/** 常量 toolSchema 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const toolSchema = Type.Object({ value: Type.String() });
		/** 常量 tool 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tool: AgentTool<typeof toolSchema, { value: string }> = {
			name: "echo",
			label: "Echo",
			description: "Echo tool",
			parameters: toolSchema,
			async execute(_toolCallId, params) {
				return {
					content: [{ type: "text", text: `echoed: ${params.value}` }],
					details: { value: params.value },
					terminate: true,
				};
			},
		};

		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: AgentContext = {
			systemPrompt: "",
			messages: [],
			tools: [tool],
		};

		/** 常量 config 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const config: AgentLoopConfig = {
			model: createModel(),
			convertToLlm: identityConverter,
		};

		/** 变量 llmCalls 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let llmCalls = 0;
		/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const stream = agentLoop([createUserMessage("echo something")], context, config, undefined, () => {
			llmCalls++;
			/** 常量 mockStream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const mockStream = new MockAssistantStream();
			queueMicrotask(() => {
				/** 常量 message 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const message = createAssistantMessage(
					[{ type: "toolCall", id: "tool-1", name: "echo", arguments: { value: "hello" } }],
					"toolUse",
				);
				mockStream.push({ type: "done", reason: "toolUse", message });
			});
			return mockStream;
		});

		/** 常量 events 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const events: AgentEvent[] = [];
		for await (const event of stream) {
			events.push(event);
		}

		/** 常量 messages 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const messages = await stream.result();
		expect(llmCalls).toBe(1);
		expect(messages.map((message) => message.role)).toEqual(["user", "assistant", "toolResult"]);
		expect(events.filter((event) => event.type === "turn_end")).toHaveLength(1);
	});

	// 测试场景：验证“should continue after parallel tool calls when not all tool results terminate”对应的行为、结果与边界。
	it("should continue after parallel tool calls when not all tool results terminate", async () => {
		/** 常量 toolSchema 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const toolSchema = Type.Object({ value: Type.String() });
		/** 常量 tool 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tool: AgentTool<typeof toolSchema, { value: string }> = {
			name: "echo",
			label: "Echo",
			description: "Echo tool",
			parameters: toolSchema,
			async execute(_toolCallId, params) {
				return {
					content: [{ type: "text", text: `echoed: ${params.value}` }],
					details: { value: params.value },
					terminate: params.value === "first",
				};
			},
		};

		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: AgentContext = {
			systemPrompt: "",
			messages: [],
			tools: [tool],
		};

		/** 常量 config 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const config: AgentLoopConfig = {
			model: createModel(),
			convertToLlm: identityConverter,
			toolExecution: "parallel",
		};

		/** 变量 callIndex 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let callIndex = 0;
		/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const stream = agentLoop([createUserMessage("echo both")], context, config, undefined, () => {
			/** 常量 mockStream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const mockStream = new MockAssistantStream();
			queueMicrotask(() => {
				if (callIndex === 0) {
					/** 常量 message 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const message = createAssistantMessage(
						[
							{ type: "toolCall", id: "tool-1", name: "echo", arguments: { value: "first" } },
							{ type: "toolCall", id: "tool-2", name: "echo", arguments: { value: "second" } },
						],
						"toolUse",
					);
					mockStream.push({ type: "done", reason: "toolUse", message });
				} else {
					/** 常量 message 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const message = createAssistantMessage([{ type: "text", text: "done" }]);
					mockStream.push({ type: "done", reason: "stop", message });
				}
				callIndex++;
			});
			return mockStream;
		});

		for await (const _event of stream) {
			// consume
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		}

		/** 常量 messages 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const messages = await stream.result();
		expect(callIndex).toBe(2);
		expect(messages.map((message) => message.role)).toEqual([
			"user",
			"assistant",
			"toolResult",
			"toolResult",
			"assistant",
		]);
	});

	// 测试场景：验证“should allow afterToolCall to mark a tool batch as terminating”对应的行为、结果与边界。
	it("should allow afterToolCall to mark a tool batch as terminating", async () => {
		/** 常量 toolSchema 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const toolSchema = Type.Object({ value: Type.String() });
		/** 常量 tool 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tool: AgentTool<typeof toolSchema, { value: string }> = {
			name: "echo",
			label: "Echo",
			description: "Echo tool",
			parameters: toolSchema,
			async execute(_toolCallId, params) {
				return {
					content: [{ type: "text", text: `echoed: ${params.value}` }],
					details: { value: params.value },
				};
			},
		};

		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: AgentContext = {
			systemPrompt: "",
			messages: [],
			tools: [tool],
		};

		/** 常量 config 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const config: AgentLoopConfig = {
			model: createModel(),
			convertToLlm: identityConverter,
			afterToolCall: async () => ({ terminate: true }),
		};

		/** 变量 llmCalls 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let llmCalls = 0;
		/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const stream = agentLoop([createUserMessage("echo something")], context, config, undefined, () => {
			llmCalls++;
			/** 常量 mockStream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const mockStream = new MockAssistantStream();
			queueMicrotask(() => {
				/** 常量 message 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const message = createAssistantMessage(
					[{ type: "toolCall", id: "tool-1", name: "echo", arguments: { value: "hello" } }],
					"toolUse",
				);
				mockStream.push({ type: "done", reason: "toolUse", message });
			});
			return mockStream;
		});

		for await (const _event of stream) {
			// consume
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		}

		expect(llmCalls).toBe(1);
	});
});

// 用例分组：集中验证“agentLoopContinue with AgentMessage”相关功能。
describe("agentLoopContinue with AgentMessage", () => {
	// 测试场景：验证“should throw when context has no messages”对应的行为、结果与边界。
	it("should throw when context has no messages", () => {
		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: AgentContext = {
			systemPrompt: "You are helpful.",
			messages: [],
			tools: [],
		};

		/** 常量 config 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const config: AgentLoopConfig = {
			model: createModel(),
			convertToLlm: identityConverter,
		};

		expect(() =>
			agentLoopContinue(context, config, undefined, () => {
				throw new Error("Unexpected stream call");
			}),
		).toThrow("Cannot continue: no messages in context");
	});

	// 测试场景：验证“should continue from existing context without emitting user message events”对应的行为、结果与边界。
	it("should continue from existing context without emitting user message events", async () => {
		/** 常量 userMessage 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const userMessage: AgentMessage = createUserMessage("Hello");

		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: AgentContext = {
			systemPrompt: "You are helpful.",
			messages: [userMessage],
			tools: [],
		};

		/** 常量 config 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const config: AgentLoopConfig = {
			model: createModel(),
			convertToLlm: identityConverter,
		};

		/** streamFn 封装当前回调或辅助步骤；参数 无 提供输入，返回值用于后续流程。示例：streamFn()。 */
		const streamFn = () => {
			/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const stream = new MockAssistantStream();
			queueMicrotask(() => {
				/** 常量 message 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const message = createAssistantMessage([{ type: "text", text: "Response" }]);
				stream.push({ type: "done", reason: "stop", message });
			});
			return stream;
		};

		/** 常量 events 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const events: AgentEvent[] = [];
		/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const stream = agentLoopContinue(context, config, undefined, streamFn);

		for await (const event of stream) {
			events.push(event);
		}

		/** 常量 messages 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const messages = await stream.result();

		// Should only return the new assistant message (not the existing user message)
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		expect(messages.length).toBe(1);
		expect(messages[0].role).toBe("assistant");

		// Should NOT have user message events (that's the key difference from agentLoop)
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		const messageEndEvents = events.filter((e) => e.type === "message_end");
		expect(messageEndEvents.length).toBe(1);
		expect((messageEndEvents[0] as any).message.role).toBe("assistant");
	});

	// 测试场景：验证“should allow custom message types as last message (caller responsibility)”对应的行为、结果与边界。
	it("should allow custom message types as last message (caller responsibility)", async () => {
		// Custom message that will be converted to user message by convertToLlm
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		interface CustomMessage {
			role: "custom";
			text: string;
			timestamp: number;
		}

		/** 常量 customMessage 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const customMessage: CustomMessage = {
			role: "custom",
			text: "Hook content",
			timestamp: Date.now(),
		};

		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: AgentContext = {
			systemPrompt: "You are helpful.",
			messages: [customMessage as unknown as AgentMessage],
			tools: [],
		};

		/** 常量 config 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const config: AgentLoopConfig = {
			model: createModel(),
			convertToLlm: (messages) => {
				// Convert custom to user message
				// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
				return messages
					.map((m) => {
						if ((m as any).role === "custom") {
							return {
								role: "user" as const,
								content: (m as any).text,
								timestamp: m.timestamp,
							};
						}
						return m;
					})
					.filter((m) => m.role === "user" || m.role === "assistant" || m.role === "toolResult") as Message[];
			},
		};

		/** streamFn 封装当前回调或辅助步骤；参数 无 提供输入，返回值用于后续流程。示例：streamFn()。 */
		const streamFn = () => {
			/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const stream = new MockAssistantStream();
			queueMicrotask(() => {
				/** 常量 message 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const message = createAssistantMessage([{ type: "text", text: "Response to custom message" }]);
				stream.push({ type: "done", reason: "stop", message });
			});
			return stream;
		};

		// Should not throw - the custom message will be converted to user message
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		const stream = agentLoopContinue(context, config, undefined, streamFn);

		/** 常量 events 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const events: AgentEvent[] = [];
		for await (const event of stream) {
			events.push(event);
		}

		/** 常量 messages 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const messages = await stream.result();
		expect(messages.length).toBe(1);
		expect(messages[0].role).toBe("assistant");
	});
});
