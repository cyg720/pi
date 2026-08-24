import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Agent, type AgentEvent, type AgentTool } from "@earendil-works/pi-agent-core";
import { type AssistantMessage, type AssistantMessageEvent, EventStream, getModel } from "@earendil-works/pi-ai/compat";
import { Type } from "typebox";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AgentSession } from "../src/core/agent-session.ts";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";
import { createModelRegistry, getModelRuntime } from "./model-runtime-test-utils.ts";
import { createTestResourceLoader } from "./utilities.ts";

/** 将助手流事件收敛为最终 AssistantMessage 的测试流。 */
class MockAssistantStream extends EventStream<AssistantMessageEvent, AssistantMessage> {
	/** 配置 done/error 终止判定和结果提取器；无参数。示例：new MockAssistantStream()。 */
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

/** 创建字段完整的模拟助手消息。text 为文本，overrides 可替换错误或停止原因；返回消息。示例：createAssistantMessage("ok")。 */
function createAssistantMessage(text: string, overrides?: Partial<AssistantMessage>): AssistantMessage {
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
		...overrides,
	};
}

/** 暴露 AgentSession 私有扩展事件钩子的测试视图。 */
type SessionWithExtensionEmitHook = {
	_emitExtensionEvent: (event: AgentEvent) => Promise<void>;
};

describe("AgentSession retry", () => {
	/** 当前用例创建的会话，结束后统一释放。 */
	let session: AgentSession;
	/** 当前用例使用的临时工作目录。 */
	let tempDir: string;

	/** 每个用例前创建独立临时目录。 */
	beforeEach(async () => {
		tempDir = join(tmpdir(), `pi-retry-test-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
	});

	/** 每个用例后释放会话并删除临时目录。 */
	afterEach(() => {
		if (session) {
			session.dispose();
		}
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true });
		}
	});

	/** 创建可按指定次数失败的 AgentSession；返回会话和调用计数读取器。示例：await createSession({failCount: 1})。 */
	async function createSession(options?: {
		failCount?: number;
		maxRetries?: number;
		delayAssistantMessageEndMs?: number;
	}) {
		/** 开始成功前需要模拟的失败次数。 */
		const failCount = options?.failCount ?? 1;
		/** 会话允许的最大重试次数。 */
		const maxRetries = options?.maxRetries ?? 3;
		/** 助手 message_end 扩展处理的人工延迟。 */
		const delayAssistantMessageEndMs = options?.delayAssistantMessageEndMs ?? 0;
		/** 模拟提供商流函数累计调用次数。 */
		let callCount = 0;

		/** 测试使用的静态模型定义。 */
		const model = getModel("anthropic", "claude-sonnet-4-5")!;
		/** 根据 callCount 输出错误或成功消息的测试 Agent。 */
		const agent = new Agent({
			getApiKey: () => "test-key",
			initialState: { model, systemPrompt: "Test", tools: [] },
			streamFn: () => {
				callCount++;
				/** 当前模型请求的独立助手事件流。 */
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					if (callCount <= failCount) {
						/** 触发自动重试的过载错误消息。 */
						const msg = createAssistantMessage("", {
							stopReason: "error",
							errorMessage: "overloaded_error",
						});
						stream.push({ type: "start", partial: msg });
						stream.push({ type: "error", reason: "error", error: msg });
					} else {
						/** 达到失败次数后返回的成功消息。 */
						const msg = createAssistantMessage("Success");
						stream.push({ type: "start", partial: msg });
						stream.push({ type: "done", reason: "stop", message: msg });
					}
				});
				return stream;
			},
		});

		/** 不落盘的会话管理器。 */
		const sessionManager = SessionManager.inMemory();
		/** 指向临时目录的设置管理器。 */
		const settingsManager = SettingsManager.create(tempDir, tempDir);
		/** 保存测试密钥的临时认证存储。 */
		const authStorage = AuthStorage.create(join(tempDir, "auth.json"));
		/** 由临时认证构建的模型注册表。 */
		const modelRegistry = await createModelRegistry(authStorage, tempDir);
		await authStorage.modify("anthropic", async () => ({ type: "api_key", key: "test-key" }));
		settingsManager.applyOverrides({ retry: { enabled: true, maxRetries, baseDelayMs: 1 } });

		session = new AgentSession({
			agent,
			sessionManager,
			settingsManager,
			cwd: tempDir,
			modelRuntime: getModelRuntime(modelRegistry),
			resourceLoader: createTestResourceLoader(),
		});

		if (delayAssistantMessageEndMs > 0) {
			/** 可替换私有事件钩子的会话测试视图。 */
			const sessionWithHook = session as unknown as SessionWithExtensionEmitHook;
			/** 原始扩展事件发送函数，延迟后仍须调用。 */
			const original = sessionWithHook._emitExtensionEvent.bind(sessionWithHook);
			sessionWithHook._emitExtensionEvent = async (event: AgentEvent) => {
				if (event.type === "message_end" && event.message.role === "assistant") {
					await new Promise((resolve) => setTimeout(resolve, delayAssistantMessageEndMs));
				}
				await original(event);
			};
		}

		return { session, getCallCount: () => callCount };
	}

	/** 验证一次瞬时失败后重试成功并发出成对事件。 */
	it("retries after a transient error and succeeds", async () => {
		/** 配置首次失败的待测会话。 */
		const created = await createSession({ failCount: 1 });
		/** 自动重试事件的简化记录。 */
		const events: string[] = [];
		created.session.subscribe((event) => {
			if (event.type === "auto_retry_start") events.push(`start:${event.attempt}`);
			if (event.type === "auto_retry_end") events.push(`end:success=${event.success}`);
		});

		await created.session.prompt("Test");

		expect(created.getCallCount()).toBe(2);
		expect(events).toEqual(["start:1", "end:success=true"]);
		expect(created.session.isRetrying).toBe(false);
	});

	/** 验证超过最大重试次数后发出失败结束事件。 */
	it("exhausts max retries and emits failure", async () => {
		/** 始终失败且最多重试两次的待测会话。 */
		const created = await createSession({ failCount: 99, maxRetries: 2 });
		/** 自动重试事件的简化记录。 */
		const events: string[] = [];
		created.session.subscribe((event) => {
			if (event.type === "auto_retry_start") events.push(`start:${event.attempt}`);
			if (event.type === "auto_retry_end") events.push(`end:success=${event.success}`);
		});

		await created.session.prompt("Test");

		expect(created.getCallCount()).toBe(3);
		expect(events).toContain("start:1");
		expect(events).toContain("start:2");
		expect(events).toContain("end:success=false");
		expect(created.session.isRetrying).toBe(false);
	});

	/** 验证 prompt 会等待延迟的 message_end 处理和重试全部完成。 */
	it("prompt waits for retry completion even when assistant message_end handling is delayed", async () => {
		/** 首次失败且助手结束事件延迟 40ms 的会话。 */
		const created = await createSession({ failCount: 1, delayAssistantMessageEndMs: 40 });

		await created.session.prompt("Test");

		expect(created.getCallCount()).toBe(2);
		expect(created.session.isRetrying).toBe(false);
	});

	/** 验证提供商 network_error 文本也会触发自动重试。 */
	it("retries provider network_error failures", async () => {
		/** 先创建标准依赖，随后替换其中 Agent 的会话。 */
		const created = await createSession({ failCount: 0 });
		/** 自定义网络错误流函数的调用次数。 */
		let callCount = 0;
		/** 首次返回 network_error、随后成功的模拟流函数。 */
		const streamFn = () => {
			callCount++;
			/** 当前请求的独立助手事件流。 */
			const stream = new MockAssistantStream();
			queueMicrotask(() => {
				if (callCount === 1) {
					/** 首次请求返回的网络错误消息。 */
					const msg = createAssistantMessage("", {
						stopReason: "error",
						errorMessage: "Provider finish_reason: network_error",
					});
					stream.push({ type: "start", partial: msg });
					stream.push({ type: "error", reason: "error", error: msg });
					return;
				}

				/** 重试请求返回的成功消息。 */
				const msg = createAssistantMessage("Recovered after retry");
				stream.push({ type: "start", partial: msg });
				stream.push({ type: "done", reason: "stop", message: msg });
			});
			return stream;
		};
		created.session.dispose();

		/** 自定义流使用的模型定义。 */
		const model = getModel("anthropic", "claude-sonnet-4-5")!;
		/** 使用 network_error 模拟流的 Agent。 */
		const agent = new Agent({
			getApiKey: () => "test-key",
			initialState: { model, systemPrompt: "Test", tools: [] },
			streamFn: streamFn,
		});
		/** 新会话使用的内存会话管理器。 */
		const sessionManager = SessionManager.inMemory();
		/** 新会话使用的临时设置管理器。 */
		const settingsManager = SettingsManager.create(tempDir, tempDir);
		/** 新会话使用的临时认证存储。 */
		const authStorage = AuthStorage.create(join(tempDir, "auth.json"));
		/** 新会话使用的模型注册表。 */
		const modelRegistry = await createModelRegistry(authStorage, tempDir);
		await authStorage.modify("anthropic", async () => ({ type: "api_key", key: "test-key" }));
		settingsManager.applyOverrides({ retry: { enabled: true, maxRetries: 3, baseDelayMs: 1 } });
		session = new AgentSession({
			agent,
			sessionManager,
			settingsManager,
			cwd: tempDir,
			modelRuntime: getModelRuntime(modelRegistry),
			resourceLoader: createTestResourceLoader(),
		});

		/** 自动重试事件的简化记录。 */
		const events: string[] = [];
		session.subscribe((event) => {
			if (event.type === "auto_retry_start") events.push(`start:${event.attempt}`);
			if (event.type === "auto_retry_end") events.push(`end:success=${event.success}`);
		});

		await session.prompt("Test");

		expect(callCount).toBe(2);
		expect(events).toEqual(["start:1", "end:success=true"]);
	});

	/** 验证重试响应含工具调用时，prompt 等待整个工具循环和最终回答。 */
	it("prompt waits for full agent loop when retry produces tool calls", async () => {
		// Regression: when auto-retry fires and the retry response includes tool_use,
		// 回归背景：自动重试成功响应包含 tool_use 时，仍需继续执行工具。
		// session.prompt() must wait for the entire tool loop to finish before returning.
		// session.prompt() 必须等待整个工具循环结束后才能返回。
		// Previously, _resolveRetry() on the first successful message_end would unblock
		// 旧实现会在首个成功 message_end 时由 _resolveRetry() 提前解除等待，
		// waitForRetry() while the agent was still executing tools.
		// 此时 Agent 实际仍在执行工具。
		/** 本场景中模型流被调用的次数。 */
		let callCount = 0;
		/** 用对象保存工具执行状态，便于闭包修改。 */
		const toolExecuted = { value: false };

		/** 将执行状态置为 true 并返回固定文本的测试工具。 */
		const echoTool: AgentTool = {
			name: "echo",
			label: "Echo",
			description: "Echo text back",
			parameters: Type.Object({ text: Type.String() }),
			execute: async () => {
				toolExecuted.value = true;
				return { content: [{ type: "text", text: "echoed" }], details: undefined };
			},
		};

		/** 工具循环场景使用的模型定义。 */
		const model = getModel("anthropic", "claude-sonnet-4-5")!;
		/** 依次输出过载、工具调用和最终回答的测试 Agent。 */
		const agent = new Agent({
			getApiKey: () => "test-key",
			initialState: { model, systemPrompt: "Test", tools: [] },
			streamFn: () => {
				callCount++;
				/** 当前请求的独立助手事件流。 */
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					if (callCount === 1) {
						// First call: overloaded error
						// 第一次调用返回过载错误。
						/** 触发重试的过载错误消息。 */
						const msg = createAssistantMessage("", {
							stopReason: "error",
							errorMessage: "overloaded_error",
						});
						stream.push({ type: "start", partial: msg });
						stream.push({ type: "error", reason: "error", error: msg });
					} else if (callCount === 2) {
						// Second call (retry): text + tool_use
						// 第二次调用（重试）同时返回文本和工具调用。
						/** 要求执行 echo 的重试成功消息。 */
						const msg: AssistantMessage = {
							...createAssistantMessage("Looking that up now."),
							stopReason: "toolUse",
							content: [
								{ type: "text", text: "Looking that up now." },
								{ type: "toolCall", id: "call_1", name: "echo", arguments: { text: "hello" } },
							],
						};
						stream.push({ type: "start", partial: msg });
						stream.push({ type: "done", reason: "toolUse", message: msg });
					} else {
						// Third call (after tool result): final response
						// 第三次调用在工具结果后返回最终回答。
						/** 工具循环结束后的最终助手消息。 */
						const msg = createAssistantMessage("Final answer.");
						stream.push({ type: "start", partial: msg });
						stream.push({ type: "done", reason: "stop", message: msg });
					}
				});
				return stream;
			},
		});

		/** 工具循环场景使用的内存会话管理器。 */
		const sessionManager = SessionManager.inMemory();
		/** 工具循环场景使用的临时设置管理器。 */
		const settingsManager = SettingsManager.create(tempDir, tempDir);
		/** 工具循环场景使用的临时认证存储。 */
		const authStorage = AuthStorage.create(join(tempDir, "auth.json"));
		/** 工具循环场景使用的模型注册表。 */
		const modelRegistry = await createModelRegistry(authStorage, tempDir);
		await authStorage.modify("anthropic", async () => ({ type: "api_key", key: "test-key" }));
		settingsManager.applyOverrides({ retry: { enabled: true, maxRetries: 3, baseDelayMs: 1 } });

		session = new AgentSession({
			agent,
			sessionManager,
			settingsManager,
			cwd: tempDir,
			modelRuntime: getModelRuntime(modelRegistry),
			resourceLoader: createTestResourceLoader(),
			baseToolsOverride: { echo: echoTool },
		});

		await session.prompt("Test");

		// All three LLM calls must have completed
		// prompt 返回前，前三次模型调用必须全部完成。
		expect(callCount).toBe(3);
		// Tool must have been executed
		// echo 工具必须真正执行。
		expect(toolExecuted.value).toBe(true);
		// Agent must not be streaming after prompt returns
		// prompt 返回后 Agent 不应仍处于流式处理中。
		expect(session.isStreaming).toBe(false);
		// A follow-up prompt must work (no "Agent is already processing" error)
		// 后续 prompt 应正常工作，不能出现 Agent 仍在处理的错误。
		await session.prompt("Follow-up");
		expect(callCount).toBe(4);
	});
});
/**
 * 文件职责：验证 AgentSession 面对可重试错误时的重试次数、事件、等待语义和工具循环完整性。
 * 技术维度：使用 Vitest、可编程 EventStream、内存 SessionManager 和临时认证配置模拟提供商响应序列。
 * 产品维度：保障网络抖动或服务过载时用户请求能自动恢复，且 prompt 不会在后台工作未结束时提前返回。
 * 逻辑维度：先定义模拟消息流和会话工厂，再测试成功重试、耗尽、延迟事件、network_error 及重试后的工具循环。
 * 关键边界：重试延迟缩短为 1ms；临时目录在用例后递归删除；模拟流只接受 done/error 作为终止事件。
 * 新手阅读建议：先看 MockAssistantStream 和 createSession，再读前三个基础重试用例，最后分析工具调用回归场景。
 */
