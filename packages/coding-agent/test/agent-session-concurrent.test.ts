/**
 * 文件职责：验证 AgentSession 在并发提示、转向消息、后续消息和扩展回调同时发生时的状态与事件顺序。
 * 技术维度：使用 Vitest、可控异步流、延迟 Promise 和伪模型构造确定性的并发测试。
 * 产品维度：防止用户快速连续输入时出现重复执行、消息丢失或会话记录顺序错乱。
 * 逻辑维度：先构造模拟助手流与会话，再覆盖并发拒绝、队列注入、工具调用持久化和慢回调等待。
 * 关键边界：测试依赖精确的微任务与事件时序；延迟对象必须由用例显式释放，避免测试永久等待。
 * 新手阅读建议：先看 MockAssistantStream 和 createSession，再按 prompt、steer、followUp、扩展事件的顺序阅读。
 */
import { createModelRegistry, getModelRuntime } from "./model-runtime-test-utils.ts";
/**
 * Tests for AgentSession concurrent prompt guard.
 */
// 中文说明：上方英文注释描述“/** * Tests for AgentSession concurrent prompt guard. *”相关前提、步骤或边界；下面代码按该说明执行。

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Agent } from "@earendil-works/pi-agent-core";
import {
	type AssistantMessage,
	type AssistantMessageEvent,
	EventStream,
	getModel,
	type ImageContent,
	type TextContent,
} from "@earendil-works/pi-ai/compat";
import { Type } from "typebox";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AgentSession } from "../src/core/agent-session.ts";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";
import type { BuildSystemPromptOptions } from "../src/core/system-prompt.ts";
import { createTestExtensionsResult, createTestResourceLoader } from "./utilities.ts";

// Mock stream that mimics AssistantMessageEventStream
// 中文说明：上方英文注释描述“Mock stream that mimics AssistantMessageEventStream”相关前提、步骤或边界；下面代码按该说明执行。
/** MockAssistantStream 模拟助手消息事件流；它把完成或错误事件转换为最终结果，供并发会话用例控制响应时序。 */
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

// 用例分组：集中验证“AgentSession concurrent prompt guard”相关功能。
describe("AgentSession concurrent prompt guard", () => {
	/** 变量 session 保存“session”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	let session: AgentSession;
	/** 变量 tempDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	let tempDir: string;

	beforeEach(async () => {
		tempDir = join(tmpdir(), `pi-concurrent-test-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
	});

	afterEach(async () => {
		delete (globalThis as typeof globalThis & { testExtensionApi?: unknown }).testExtensionApi;
		delete (globalThis as typeof globalThis & { testCommandRuns?: unknown }).testCommandRuns;
		if (session) {
			session.dispose();
		}
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true });
		}
	});

	/** 创建 createSession 对应步骤；无参数；返回值供调用方继续执行或断言。示例：createSession()。 */
	async function createSession() {
		/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const model = getModel("anthropic", "claude-sonnet-4-5")!;
		/** 变量 abortSignal 保存“abortSignal”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		let abortSignal: AbortSignal | undefined;

		// Use a stream function that responds to abort
		// 中文说明：上方英文注释描述“Use a stream function that responds to abort”相关前提、步骤或边界；下面代码按该说明执行。
		const agent = new Agent({
			getApiKey: () => "test-key",
			initialState: {
				model,
				systemPrompt: "Test",
				tools: [],
			},
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

		/** 常量 sessionManager 保存“sessionManager”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const sessionManager = SessionManager.inMemory();
		/** 常量 settingsManager 保存控制当前行为的配置选项；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const settingsManager = SettingsManager.create(tempDir, tempDir);
		/** 常量 authStorage 保存认证或环境配置数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const authStorage = AuthStorage.create(join(tempDir, "auth.json"));
		/** 常量 modelRegistry 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const modelRegistry = await createModelRegistry(authStorage, tempDir);
		// Set a runtime API key so validation passes
		// 中文说明：上方英文注释描述“Set a runtime API key so validation passes”相关前提、步骤或边界；下面代码按该说明执行。
		await authStorage.modify("anthropic", async () => ({ type: "api_key", key: "test-key" }));

		session = new AgentSession({
			agent,
			sessionManager,
			settingsManager,
			cwd: tempDir,
			modelRuntime: getModelRuntime(modelRegistry),
			resourceLoader: createTestResourceLoader(),
		});

		return session;
	}

	// 测试场景：验证“should throw when prompt() called while streaming”对应的行为、返回值与边界条件。
	it("should throw when prompt() called while streaming", async () => {
		await createSession();

		// Start first prompt (don't await, it will block until abort)
		// 中文说明：上方英文注释描述“Start first prompt (don't await, it will block until ab”相关前提、步骤或边界；下面代码按该说明执行。
		const firstPrompt = session.prompt("First message");

		// Wait a tick for isStreaming to be set
		// 中文说明：上方英文注释描述“Wait a tick for isStreaming to be set”相关前提、步骤或边界；下面代码按该说明执行。
		await new Promise((resolve) => setTimeout(resolve, 10));

		// Verify we're streaming
		// 中文说明：上方英文注释描述“Verify we're streaming”相关前提、步骤或边界；下面代码按该说明执行。
		expect(session.isStreaming).toBe(true);

		// Second prompt should reject
		// 中文说明：上方英文注释描述“Second prompt should reject”相关前提、步骤或边界；下面代码按该说明执行。
		await expect(session.prompt("Second message")).rejects.toThrow(
			"Agent is already processing. Specify streamingBehavior ('steer' or 'followUp') to queue the message.",
		);

		// Cleanup
		// 中文说明：上方英文注释描述“Cleanup”相关前提、步骤或边界；下面代码按该说明执行。
		await session.abort();
		await firstPrompt.catch(() => {}); // Ignore abort error
	});

	// 测试场景：验证“should allow steer() while streaming”对应的行为、返回值与边界条件。
	it("should allow steer() while streaming", async () => {
		await createSession();

		// Start first prompt
		// 中文说明：上方英文注释描述“Start first prompt”相关前提、步骤或边界；下面代码按该说明执行。
		const firstPrompt = session.prompt("First message");
		await new Promise((resolve) => setTimeout(resolve, 10));

		// steer should work while streaming
		// 中文说明：上方英文注释描述“steer should work while streaming”相关前提、步骤或边界；下面代码按该说明执行。
		expect(() => session.steer("Steering message")).not.toThrow();
		expect(session.pendingMessageCount).toBe(1);

		// Cleanup
		// 中文说明：上方英文注释描述“Cleanup”相关前提、步骤或边界；下面代码按该说明执行。
		await session.abort();
		await firstPrompt.catch(() => {});
	});

	// 测试场景：验证“should allow followUp() while streaming”对应的行为、返回值与边界条件。
	it("should allow followUp() while streaming", async () => {
		await createSession();

		// Start first prompt
		// 中文说明：上方英文注释描述“Start first prompt”相关前提、步骤或边界；下面代码按该说明执行。
		const firstPrompt = session.prompt("First message");
		await new Promise((resolve) => setTimeout(resolve, 10));

		// followUp should work while streaming
		// 中文说明：上方英文注释描述“followUp should work while streaming”相关前提、步骤或边界；下面代码按该说明执行。
		expect(() => session.followUp("Follow-up message")).not.toThrow();
		expect(session.pendingMessageCount).toBe(1);

		// Cleanup
		// 中文说明：上方英文注释描述“Cleanup”相关前提、步骤或边界；下面代码按该说明执行。
		await session.abort();
		await firstPrompt.catch(() => {});
	});

	// 测试场景：验证“should queue extension-origin steering messages while streaming”对应的行为、返回值与边界条件。
	it("should queue extension-origin steering messages while streaming", async () => {
		/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const model = getModel("anthropic", "claude-sonnet-4-5")!;
		/** 变量 abortSignal 保存“abortSignal”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		let abortSignal: AbortSignal | undefined;
		/** 变量 sawSteeringMessage 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		let sawSteeringMessage = false;
		/** 变量 lastInputSource 保存“lastInputSource”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		let lastInputSource: string | undefined;
		/** 常量 queueEvents 保存核对调用或事件顺序的记录；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const queueEvents: Array<{ steering: readonly string[]; followUp: readonly string[] }> = [];

		/** 常量 agent 保存“agent”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const agent = new Agent({
			getApiKey: () => "test-key",
			initialState: {
				model,
				systemPrompt: "Test",
				tools: [],
			},
			streamFn: (_model, context, options) => {
				abortSignal = options?.signal;
				/** 常量 stream 保存传递助手事件的异步流；取值由声明类型和当前场景约束，注意隔离可变状态。 */
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					/** 常量 userTexts 保存当前场景使用或生成的文本；取值由声明类型和当前场景约束，注意隔离可变状态。 */
					const userTexts = context.messages
						.filter((message) => message.role === "user")
						.map((message) => {
							if (typeof message.content === "string") {
								return message.content;
							}
							return message.content
								.filter((part): part is TextContent | ImageContent => typeof part === "object" && part !== null)
								.filter((part): part is TextContent => part.type === "text")
								.map((part) => part.text)
								.join("\n");
						});

					if (userTexts.includes("Steer from extension")) {
						sawSteeringMessage = true;
						stream.push({ type: "start", partial: createAssistantMessage("") });
						stream.push({ type: "done", reason: "stop", message: createAssistantMessage("Steered") });
						return;
					}

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

		/** 常量 sessionManager 保存“sessionManager”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const sessionManager = SessionManager.inMemory();
		/** 常量 settingsManager 保存控制当前行为的配置选项；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const settingsManager = SettingsManager.create(tempDir, tempDir);
		/** 常量 authStorage 保存认证或环境配置数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const authStorage = AuthStorage.create(join(tempDir, "auth.json"));
		/** 常量 modelRegistry 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const modelRegistry = await createModelRegistry(authStorage, tempDir);
		await authStorage.modify("anthropic", async () => ({ type: "api_key", key: "test-key" }));

		/** 常量 extensionsResult 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const extensionsResult = await createTestExtensionsResult([
			(pi) => {
				(globalThis as typeof globalThis & { testExtensionApi?: unknown }).testExtensionApi = pi;
			},
			(pi) => {
				pi.on("input", async (event) => {
					lastInputSource = event.source;
				});
			},
		]);

		session = new AgentSession({
			agent,
			sessionManager,
			settingsManager,
			cwd: tempDir,
			modelRuntime: getModelRuntime(modelRegistry),
			resourceLoader: createTestResourceLoader({ extensionsResult }),
		});
		session.subscribe((event) => {
			if (event.type === "queue_update") {
				queueEvents.push({ steering: event.steering, followUp: event.followUp });
			}
		});

		/** 常量 firstPrompt 保存当前场景使用或生成的文本；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const firstPrompt = session.prompt("First message");
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(session.isStreaming).toBe(true);

		/** 常量 pi 保存“pi”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const pi = (
			globalThis as typeof globalThis & {
				testExtensionApi?: {
					sendUserMessage: (content: string, options?: { deliverAs?: "steer" | "followUp" }) => void;
				};
			}
		).testExtensionApi;
		expect(pi).toBeDefined();

		pi!.sendUserMessage("Steer from extension", { deliverAs: "steer" });
		await new Promise((resolve) => setTimeout(resolve, 25));

		expect(session.pendingMessageCount).toBe(1);
		expect(session.getSteeringMessages()).toContain("Steer from extension");
		expect(lastInputSource).toBe("extension");
		expect(queueEvents.some((event) => event.steering.includes("Steer from extension"))).toBe(true);

		await session.abort();
		await firstPrompt.catch(() => {});

		expect(sawSteeringMessage).toBe(true);
	});

	// 测试场景：验证“should allow prompt() after previous completes”对应的行为、返回值与边界条件。
	it("should allow prompt() after previous completes", async () => {
		// Create session with a stream that completes immediately
		// 中文说明：上方英文注释描述“Create session with a stream that completes immediately”相关前提、步骤或边界；下面代码按该说明执行。
		const model = getModel("anthropic", "claude-sonnet-4-5")!;
		/** 常量 agent 保存“agent”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const agent = new Agent({
			getApiKey: () => "test-key",
			initialState: {
				model,
				systemPrompt: "Test",
				tools: [],
			},
			streamFn: () => {
				/** 常量 stream 保存传递助手事件的异步流；取值由声明类型和当前场景约束，注意隔离可变状态。 */
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					stream.push({ type: "start", partial: createAssistantMessage("") });
					stream.push({ type: "done", reason: "stop", message: createAssistantMessage("Done") });
				});
				return stream;
			},
		});

		/** 常量 sessionManager 保存“sessionManager”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const sessionManager = SessionManager.inMemory();
		/** 常量 settingsManager 保存控制当前行为的配置选项；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const settingsManager = SettingsManager.create(tempDir, tempDir);
		/** 常量 authStorage 保存认证或环境配置数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const authStorage = AuthStorage.create(join(tempDir, "auth.json"));
		/** 常量 modelRegistry 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const modelRegistry = await createModelRegistry(authStorage, tempDir);
		await authStorage.modify("anthropic", async () => ({ type: "api_key", key: "test-key" }));

		session = new AgentSession({
			agent,
			sessionManager,
			settingsManager,
			cwd: tempDir,
			modelRuntime: getModelRuntime(modelRegistry),
			resourceLoader: createTestResourceLoader(),
		});

		// First prompt completes
		// 中文说明：上方英文注释描述“First prompt completes”相关前提、步骤或边界；下面代码按该说明执行。
		await session.prompt("First message");

		// Should not be streaming anymore
		// 中文说明：上方英文注释描述“Should not be streaming anymore”相关前提、步骤或边界；下面代码按该说明执行。
		expect(session.isStreaming).toBe(false);

		// Second prompt should work
		// 中文说明：上方英文注释描述“Second prompt should work”相关前提、步骤或边界；下面代码按该说明执行。
		await expect(session.prompt("Second message")).resolves.not.toThrow();
	});

	// 测试场景：验证“should wait for queued agent events before emitting tool_call”对应的行为、返回值与边界条件。
	it("should wait for queued agent events before emitting tool_call", async () => {
		/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const model = getModel("anthropic", "claude-sonnet-4-5")!;
		/** 常量 tool 保存“tool”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const tool = {
			name: "dummy",
			description: "Dummy tool",
			label: "dummy",
			parameters: Type.Object({ q: Type.String() }),
			execute: async (_toolCallId: string, params: unknown) => {
				/** 常量 q 保存“q”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
				const q =
					typeof params === "object" && params !== null && "q" in params
						? String((params as { q: unknown }).q)
						: "";
				return {
					content: [{ type: "text" as const, text: `result:${q}` }],
					details: {},
				};
			},
		};

		/** 常量 agent 保存“agent”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const agent = new Agent({
			getApiKey: () => "test-key",
			initialState: {
				model,
				systemPrompt: "Test",
				tools: [tool],
			},
			streamFn: async (_model, context) => {
				/** 常量 stream 保存传递助手事件的异步流；取值由声明类型和当前场景约束，注意隔离可变状态。 */
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					/** 常量 toolResultCount 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
					const toolResultCount = context.messages.filter((message) => message.role === "toolResult").length;
					if (toolResultCount > 0) {
						/** 常量 message 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
						const message: AssistantMessage = {
							role: "assistant",
							content: [{ type: "text", text: "done" }],
							api: "anthropic-messages",
							provider: "anthropic",
							model: "mock",
							usage: {
								input: 1,
								output: 1,
								cacheRead: 0,
								cacheWrite: 0,
								totalTokens: 2,
								cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
							},
							stopReason: "stop",
							timestamp: Date.now(),
						};
						stream.push({ type: "start", partial: { ...message, content: [] } });
						stream.push({ type: "done", reason: "stop", message });
						return;
					}

					/** 常量 message 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
					const message: AssistantMessage = {
						role: "assistant",
						content: [
							{ type: "toolCall", id: "toolu_1", name: "dummy", arguments: { q: "x" } },
							{ type: "toolCall", id: "toolu_2", name: "dummy", arguments: { q: "y" } },
						],
						api: "anthropic-messages",
						provider: "anthropic",
						model: "mock",
						usage: {
							input: 1,
							output: 1,
							cacheRead: 0,
							cacheWrite: 0,
							totalTokens: 2,
							cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
						},
						stopReason: "toolUse",
						timestamp: Date.now(),
					};

					stream.push({ type: "start", partial: { ...message, content: [] } });
					stream.push({ type: "done", reason: "toolUse", message });
				});
				return stream;
			},
		});

		/** 常量 sessionManager 保存“sessionManager”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const sessionManager = SessionManager.inMemory();
		/** 常量 settingsManager 保存控制当前行为的配置选项；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const settingsManager = SettingsManager.create(tempDir, tempDir);
		/** 常量 authStorage 保存认证或环境配置数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const authStorage = AuthStorage.create(join(tempDir, "auth.json"));
		/** 常量 modelRegistry 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const modelRegistry = await createModelRegistry(authStorage, tempDir);
		await authStorage.modify("anthropic", async () => ({ type: "api_key", key: "test-key" }));

		session = new AgentSession({
			agent,
			sessionManager,
			settingsManager,
			cwd: tempDir,
			modelRuntime: getModelRuntime(modelRegistry),
			resourceLoader: createTestResourceLoader(),
			baseToolsOverride: { dummy: tool },
		});

		/** 常量 snapshots 保存“snapshots”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const snapshots: string[][] = [];
		/** 常量 sessionWithRunner 保存“sessionWithRunner”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const sessionWithRunner = session as unknown as {
			_extensionRunner?: {
				hasHandlers: (eventType: string) => boolean;
				emit: (event: { type: string; message?: { role?: string } }) => Promise<void>;
				emitMessageEnd: (event: { type: string; message?: { role?: string } }) => Promise<undefined>;
				emitToolCall: (event: { type: string; toolCallId: string }) => Promise<undefined>;
				emitInput: (
					text: string,
					images: unknown,
					source: "interactive" | "rpc" | "extension",
					streamingBehavior?: "steer" | "followUp",
				) => Promise<{ action: "continue" }>;
				emitBeforeAgentStart: (
					prompt: string,
					images: unknown,
					systemPrompt: string,
					systemPromptOptions: BuildSystemPromptOptions,
				) => Promise<undefined>;
				invalidate: (message?: string) => void;
			};
		};
		sessionWithRunner._extensionRunner = {
			hasHandlers: (eventType) => eventType === "tool_call",
			emit: async () => {},
			emitMessageEnd: async () => undefined,
			emitToolCall: async () => {
				snapshots.push(
					sessionManager
						.getEntries()
						.filter((entry) => entry.type === "message")
						.map((entry) => entry.message.role),
				);
				return undefined;
			},
			emitInput: async () => ({ action: "continue" }),
			emitBeforeAgentStart: async () => undefined,
			invalidate: () => {},
		};

		await session.prompt("hi");
		await session.agent.waitForIdle();

		expect(snapshots).toEqual([
			["user", "assistant"],
			["user", "assistant"],
		]);
	});

	// 测试场景：验证“should persist message_end events in order with slow extension handlers”对应的行为、返回值与边界条件。
	it("should persist message_end events in order with slow extension handlers", async () => {
		/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const model = getModel("anthropic", "claude-sonnet-4-5")!;
		/** 常量 tool 保存“tool”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const tool = {
			name: "dummy",
			description: "Dummy tool",
			label: "dummy",
			parameters: Type.Object({ q: Type.String() }),
			execute: async (_toolCallId: string, params: unknown) => {
				/** 常量 q 保存“q”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
				const q =
					typeof params === "object" && params !== null && "q" in params
						? String((params as { q: unknown }).q)
						: "";
				return {
					content: [{ type: "text" as const, text: `result:${q}` }],
					details: {},
				};
			},
		};

		/** 常量 agent 保存“agent”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const agent = new Agent({
			getApiKey: () => "test-key",
			initialState: {
				model,
				systemPrompt: "Test",
				tools: [tool],
			},
			streamFn: async (_model, context) => {
				/** 常量 stream 保存传递助手事件的异步流；取值由声明类型和当前场景约束，注意隔离可变状态。 */
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					/** 常量 hasToolResult 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
					const hasToolResult = context.messages.some((message) => message.role === "toolResult");

					if (hasToolResult) {
						/** 常量 message 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
						const message: AssistantMessage = {
							role: "assistant",
							content: [{ type: "text", text: "done" }],
							api: "anthropic-messages",
							provider: "anthropic",
							model: "mock",
							usage: {
								input: 1,
								output: 1,
								cacheRead: 0,
								cacheWrite: 0,
								totalTokens: 2,
								cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
							},
							stopReason: "stop",
							timestamp: Date.now(),
						};
						stream.push({ type: "start", partial: { ...message, content: [] } });
						stream.push({ type: "done", reason: "stop", message });
						return;
					}

					/** 常量 message 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
					const message: AssistantMessage = {
						role: "assistant",
						content: [
							{ type: "text", text: "calling tool" },
							{ type: "toolCall", id: "toolu_1", name: "dummy", arguments: { q: "x" } },
						],
						api: "anthropic-messages",
						provider: "anthropic",
						model: "mock",
						usage: {
							input: 1,
							output: 1,
							cacheRead: 0,
							cacheWrite: 0,
							totalTokens: 2,
							cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
						},
						stopReason: "toolUse",
						timestamp: Date.now(),
					};

					stream.push({ type: "start", partial: { ...message, content: [] } });
					stream.push({ type: "done", reason: "toolUse", message });
				});
				return stream;
			},
		});

		/** 常量 sessionManager 保存“sessionManager”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const sessionManager = SessionManager.inMemory();
		/** 常量 settingsManager 保存控制当前行为的配置选项；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const settingsManager = SettingsManager.create(tempDir, tempDir);
		/** 常量 authStorage 保存认证或环境配置数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const authStorage = AuthStorage.create(join(tempDir, "auth.json"));
		/** 常量 modelRegistry 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const modelRegistry = await createModelRegistry(authStorage, tempDir);
		await authStorage.modify("anthropic", async () => ({ type: "api_key", key: "test-key" }));

		session = new AgentSession({
			agent,
			sessionManager,
			settingsManager,
			cwd: tempDir,
			modelRuntime: getModelRuntime(modelRegistry),
			resourceLoader: createTestResourceLoader(),
			baseToolsOverride: { dummy: tool },
		});

		/** 常量 sessionWithRunner 保存“sessionWithRunner”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const sessionWithRunner = session as unknown as {
			_extensionRunner?: {
				hasHandlers: (eventType: string) => boolean;
				emit: (event: { type: string; message?: { role?: string } }) => Promise<void>;
				emitMessageEnd: (event: { type: string; message?: { role?: string } }) => Promise<undefined>;
				emitInput: (
					text: string,
					images: unknown,
					source: "interactive" | "rpc" | "extension",
					streamingBehavior?: "steer" | "followUp",
				) => Promise<{ action: "continue" }>;
				emitBeforeAgentStart: (
					prompt: string,
					images: unknown,
					systemPrompt: string,
					systemPromptOptions: BuildSystemPromptOptions,
				) => Promise<undefined>;
				invalidate: (message?: string) => void;
			};
		};
		sessionWithRunner._extensionRunner = {
			hasHandlers: () => false,
			emit: async () => {},
			emitMessageEnd: async (event) => {
				if (event.type === "message_end" && event.message?.role === "assistant") {
					await new Promise((resolve) => setTimeout(resolve, 40));
				}
				return undefined;
			},
			emitInput: async () => ({ action: "continue" }),
			emitBeforeAgentStart: async () => undefined,
			invalidate: () => {},
		};

		await session.prompt("hi");
		await session.agent.waitForIdle();
		await new Promise((resolve) => setTimeout(resolve, 100));

		/** 常量 messageEntries 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const messageEntries = sessionManager.getEntries().filter((entry) => entry.type === "message");
		expect(messageEntries.map((entry) => entry.message.role)).toEqual([
			"user",
			"assistant",
			"toolResult",
			"assistant",
		]);
	});
});
