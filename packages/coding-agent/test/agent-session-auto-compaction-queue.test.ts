/**
 * 文件职责：验证 AgentSession 自动压缩与代理级消息队列交互时的恢复、去重和 Token 使用量选择。
 * 技术维度：使用 Vitest、内存 SessionManager、faux 流、私有压缩方法绑定和 spy 构造边界测试。
 * 产品维度：避免长会话压缩后遗漏排队消息、重复压缩，或因错误回复缺少用量而错误触发新压缩。
 * 逻辑维度：每例创建隔离会话，再覆盖阈值恢复、溢出重试、旧用量过滤和错误消息阈值判断。
 * 关键边界：测试通过类型收窄访问私有方法；固定 API Key 仅供 faux 流，不会调用真实 Anthropic 服务。
 * 新手阅读建议：先看 beforeEach 的会话装配，再读阈值队列恢复，最后比较三种错误消息用量场景。
 */
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Agent } from "@earendil-works/pi-agent-core";
import { type AssistantMessage, createAssistantMessageEventStream, fauxAssistantMessage } from "@earendil-works/pi-ai";
import { getModel, streamSimple } from "@earendil-works/pi-ai/compat";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentSession } from "../src/core/agent-session.ts";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";
import { createModelRegistry, getModelRuntime } from "./model-runtime-test-utils.ts";
import { createTestResourceLoader } from "./utilities.ts";

describe("AgentSession auto-compaction queue resume", () => {
	/** 当前用例共享的 AgentSession，afterEach 中释放。 */
	let session: AgentSession;
	/** 保存测试消息和压缩条目的内存会话管理器。 */
	let sessionManager: SessionManager;
	/** 控制压缩阈值与保留 Token 的测试设置管理器。 */
	let settingsManager: SettingsManager;
	/** 当前用例的临时配置与认证目录。 */
	let tempDir: string;

	// 每个用例创建隔离目录、faux 代理、内存会话和测试认证。
	beforeEach(async () => {
		tempDir = join(tmpdir(), `pi-auto-compaction-queue-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });

		/** 会话当前选中的模型定义。 */
		const model = getModel("anthropic", "claude-sonnet-4-5")!;
		/** 承载 faux 流与消息状态的底层 Agent。 */
		const agent = new Agent({
			streamFn: streamSimple,
			initialState: {
				model,
				systemPrompt: "Test",
				tools: [],
			},
		});

		sessionManager = SessionManager.inMemory();
		settingsManager = SettingsManager.create(tempDir, tempDir);
		/** 保存测试 API Key 的临时认证存储。 */
		const authStorage = AuthStorage.create(join(tempDir, "auth.json"));
		await authStorage.modify("anthropic", async () => ({ type: "api_key", key: "test-key" }));
		/** 从认证存储创建并供会话查询的模型注册表。 */
		const modelRegistry = await createModelRegistry(authStorage, tempDir);

		session = new AgentSession({
			agent,
			sessionManager,
			settingsManager,
			cwd: tempDir,
			modelRuntime: getModelRuntime(modelRegistry),
			resourceLoader: createTestResourceLoader(),
		});
	});

	// 每个用例后释放会话、恢复 spy 并删除临时目录。
	afterEach(() => {
		session.dispose();
		vi.restoreAllMocks();
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true });
		}
	});

	// 测试场景：验证“should resume after threshold compaction when only agent-level queued messages exist”对应的自动压缩行为。
	it("should resume after threshold compaction when only agent-level queued messages exist", async () => {
		settingsManager.applyOverrides({ compaction: { keepRecentTokens: 1 } });
		/** 会话当前选中的模型定义。 */
		const model = session.model!;
		/** 构造有序历史消息使用的当前毫秒时间。 */
		const now = Date.now();
		sessionManager.appendMessage({
			role: "user",
			content: [{ type: "text", text: "message to compact" }],
			timestamp: now - 1000,
		});
		sessionManager.appendMessage({
			role: "assistant",
			content: [{ type: "text", text: "assistant response to compact" }],
			api: model.api,
			provider: model.provider,
			model: model.id,
			usage: {
				input: 100,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 100,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "stop",
			timestamp: now - 500,
		});
		session.agent.state.messages = sessionManager.buildSessionContext().messages;
		session.agent.streamFunction = (summaryModel) => {
			/** 压缩摘要流使用的助手消息事件流。 */
			const stream = createAssistantMessageEventStream();
			void Promise.resolve().then(() => {
				stream.push({
					type: "done",
					reason: "stop",
					message: {
						...fauxAssistantMessage("compacted"),
						api: summaryModel.api,
						provider: summaryModel.provider,
						model: summaryModel.id,
						usage: {
							input: 10,
							output: 0,
							cacheRead: 0,
							cacheWrite: 0,
							totalTokens: 10,
							cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
						},
					},
				});
			});
			return stream;
		};

		session.agent.followUp({
			role: "custom",
			customType: "test",
			content: [{ type: "text", text: "Queued custom" }],
			display: false,
			timestamp: Date.now(),
		});

		expect(session.pendingMessageCount).toBe(0);
		expect(session.agent.hasQueuedMessages()).toBe(true);

		/** 监视 Agent.continue 是否被自动压缩流程调用的 spy。 */
		const continueSpy = vi.spyOn(session.agent, "continue").mockResolvedValue();

		/** 绑定当前 session 的私有自动压缩入口，仅用于边界断言。 */
		const runAutoCompaction = (
			session as unknown as {
				_runAutoCompaction: (reason: "overflow" | "threshold", willRetry: boolean) => Promise<boolean>;
			}
		)._runAutoCompaction.bind(session);

		await expect(runAutoCompaction("threshold", false)).resolves.toBe(true);

		expect(continueSpy).not.toHaveBeenCalled();
	});

	// 测试场景：验证“should not compact repeatedly after overflow recovery already attempted”对应的自动压缩行为。
	it("should not compact repeatedly after overflow recovery already attempted", async () => {
		/** 会话当前选中的模型定义。 */
		const model = session.model!;
		/** 模拟上下文过长错误的助手消息。 */
		const overflowMessage: AssistantMessage = {
			role: "assistant",
			content: [{ type: "text", text: "" }],
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
			stopReason: "error",
			errorMessage: "prompt is too long",
			timestamp: Date.now(),
		};

		/** 替换私有自动压缩方法并记录调用次数与参数的 spy。 */
		const runAutoCompactionSpy = vi
			.spyOn(
				session as unknown as {
					_runAutoCompaction: (reason: "overflow" | "threshold", willRetry: boolean) => Promise<void>;
				},
				"_runAutoCompaction",
			)
			.mockResolvedValue();

		/** 捕获的压缩结束事件简化记录。 */
		const events: Array<{ type: string; reason: string; errorMessage?: string }> = [];
		session.subscribe((event) => {
			if (event.type === "compaction_end") {
				events.push({ type: event.type, reason: event.reason, errorMessage: event.errorMessage });
			}
		});

		/** 绑定当前 session 的私有压缩判断方法。 */
		const checkCompaction = (
			session as unknown as {
				_checkCompaction: (assistantMessage: AssistantMessage, skipAbortedCheck?: boolean) => Promise<void>;
			}
		)._checkCompaction.bind(session);

		await checkCompaction(overflowMessage);
		await checkCompaction({ ...overflowMessage, timestamp: Date.now() + 1 });

		expect(runAutoCompactionSpy).toHaveBeenCalledTimes(1);
		expect(events).toContainEqual({
			type: "compaction_end",
			reason: "overflow",
			errorMessage:
				"Context overflow recovery failed after one compact-and-retry attempt. Try reducing context or switching to a larger-context model.",
		});
	});

	// 测试场景：验证“should ignore stale pre-compaction assistant usage on pre-prompt compaction checks”对应的自动压缩行为。
	it("should ignore stale pre-compaction assistant usage on pre-prompt compaction checks", async () => {
		/** 会话当前选中的模型定义。 */
		const model = session.model!;
		/** 明确早于新压缩条目的助手消息时间。 */
		const staleAssistantTimestamp = Date.now() - 10_000;
		/** 压缩前具有很高 Token 用量的旧助手消息。 */
		const staleAssistant: AssistantMessage = {
			role: "assistant",
			content: [{ type: "text", text: "large response before compaction" }],
			api: model.api,
			provider: model.provider,
			model: model.id,
			usage: {
				input: 600_000,
				output: 10_000,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 610_000,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "stop",
			timestamp: staleAssistantTimestamp,
		};

		sessionManager.appendMessage({
			role: "user",
			content: [{ type: "text", text: "before compaction" }],
			timestamp: staleAssistantTimestamp - 1000,
		});
		sessionManager.appendMessage(staleAssistant);

		/** 压缩条目记录的首个保留会话条目编号。 */
		const firstKeptEntryId = sessionManager.getEntries()[0]!.id;
		sessionManager.appendCompaction("summary", firstKeptEntryId, staleAssistant.usage.totalTokens, undefined, false);

		sessionManager.appendMessage({
			role: "user",
			content: [{ type: "text", text: "session recovery payload" }],
			timestamp: Date.now(),
		});

		/** 替换私有自动压缩方法并记录调用次数与参数的 spy。 */
		const runAutoCompactionSpy = vi
			.spyOn(
				session as unknown as {
					_runAutoCompaction: (reason: "overflow" | "threshold", willRetry: boolean) => Promise<void>;
				},
				"_runAutoCompaction",
			)
			.mockResolvedValue();

		/** 绑定当前 session 的私有压缩判断方法。 */
		const checkCompaction = (
			session as unknown as {
				_checkCompaction: (assistantMessage: AssistantMessage, skipAbortedCheck?: boolean) => Promise<void>;
			}
		)._checkCompaction.bind(session);

		await checkCompaction(staleAssistant, false);

		expect(runAutoCompactionSpy).not.toHaveBeenCalled();
	});

	// 测试场景：验证“should trigger threshold compaction for error messages using last successful usage”对应的自动压缩行为。
	it("should trigger threshold compaction for error messages using last successful usage", async () => {
		/** 会话当前选中的模型定义。 */
		const model = session.model!;

		// A successful assistant message with token usage just over the compaction threshold.
		// 构造 Token 用量刚刚超过压缩阈值的成功助手消息。
		// Compute this from the selected model so generated catalog context-window changes do not break the test.
		// 阈值根据当前模型计算，避免生成模型清单的上下文窗口变化破坏测试。
		/** 当前会话解析后的压缩配置。 */
		const compactionSettings = settingsManager.getCompactionSettings();
		/** 刚好超过模型压缩阈值一个 Token 的测试用量。 */
		const thresholdTokens = (model.contextWindow ?? 200_000) - compactionSettings.reserveTokens + 1;
		/** 带有效高 Token 用量的成功助手消息。 */
		const successfulAssistant: AssistantMessage = {
			role: "assistant",
			content: [{ type: "text", text: "large successful response" }],
			api: model.api,
			provider: model.provider,
			model: model.id,
			usage: {
				input: thresholdTokens - 10_000,
				output: 10_000,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: thresholdTokens,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "stop",
			timestamp: Date.now(),
		};

		// An error message (e.g. 529 overloaded) with no useful usage data
		// 构造没有有效用量数据的错误消息，例如 529 overloaded。
		/** 没有可用 Token 统计的错误助手消息。 */
		const errorAssistant: AssistantMessage = {
			role: "assistant",
			content: [{ type: "text", text: "" }],
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
			stopReason: "error",
			errorMessage: "529 overloaded",
			timestamp: Date.now() + 1000,
		};

		// Put both messages into agent state so estimateContextTokens can find the successful one
		// 把成功与错误消息都放入代理状态，让 estimateContextTokens 能找到最近有效用量。
		session.agent.state.messages = [
			{ role: "user", content: [{ type: "text", text: "hello" }], timestamp: Date.now() - 1000 },
			successfulAssistant,
			{ role: "user", content: [{ type: "text", text: "another prompt" }], timestamp: Date.now() + 500 },
			errorAssistant,
		];

		/** 替换私有自动压缩方法并记录调用次数与参数的 spy。 */
		const runAutoCompactionSpy = vi
			.spyOn(
				session as unknown as {
					_runAutoCompaction: (reason: "overflow" | "threshold", willRetry: boolean) => Promise<void>;
				},
				"_runAutoCompaction",
			)
			.mockResolvedValue();

		/** 绑定当前 session 的私有压缩判断方法。 */
		const checkCompaction = (
			session as unknown as {
				_checkCompaction: (assistantMessage: AssistantMessage, skipAbortedCheck?: boolean) => Promise<void>;
			}
		)._checkCompaction.bind(session);

		await checkCompaction(errorAssistant);

		expect(runAutoCompactionSpy).toHaveBeenCalledWith("threshold", false);
	});

	// 测试场景：验证“should not trigger threshold compaction for error messages when no prior usage exists”对应的自动压缩行为。
	it("should not trigger threshold compaction for error messages when no prior usage exists", async () => {
		/** 会话当前选中的模型定义。 */
		const model = session.model!;

		// An error message with no prior successful assistant in context
		// 构造上下文中不存在成功助手消息时的错误消息。
		/** 没有可用 Token 统计的错误助手消息。 */
		const errorAssistant: AssistantMessage = {
			role: "assistant",
			content: [{ type: "text", text: "" }],
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
			stopReason: "error",
			errorMessage: "529 overloaded",
			timestamp: Date.now(),
		};

		session.agent.state.messages = [
			{ role: "user", content: [{ type: "text", text: "hello" }], timestamp: Date.now() - 1000 },
			errorAssistant,
		];

		/** 替换私有自动压缩方法并记录调用次数与参数的 spy。 */
		const runAutoCompactionSpy = vi
			.spyOn(
				session as unknown as {
					_runAutoCompaction: (reason: "overflow" | "threshold", willRetry: boolean) => Promise<void>;
				},
				"_runAutoCompaction",
			)
			.mockResolvedValue();

		/** 绑定当前 session 的私有压缩判断方法。 */
		const checkCompaction = (
			session as unknown as {
				_checkCompaction: (assistantMessage: AssistantMessage, skipAbortedCheck?: boolean) => Promise<void>;
			}
		)._checkCompaction.bind(session);

		await checkCompaction(errorAssistant);

		expect(runAutoCompactionSpy).not.toHaveBeenCalled();
	});

	// 测试场景：验证“should not trigger threshold compaction for error messages when only kept pre-compaction usage exists”对应的自动压缩行为。
	it("should not trigger threshold compaction for error messages when only kept pre-compaction usage exists", async () => {
		/** 会话当前选中的模型定义。 */
		const model = session.model!;
		/** 构造保留但位于压缩前消息的时间基准。 */
		const preCompactionTimestamp = Date.now() - 10_000;

		// A "kept" assistant message from before compaction with high usage
		// 构造压缩前被保留且用量很高的助手消息。
		/** 被保留在上下文中但时间早于最近压缩的高用量助手消息。 */
		const keptAssistant: AssistantMessage = {
			role: "assistant",
			content: [{ type: "text", text: "kept response from before compaction" }],
			api: model.api,
			provider: model.provider,
			model: model.id,
			usage: {
				input: 180_000,
				output: 10_000,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 190_000,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "stop",
			timestamp: preCompactionTimestamp,
		};

		// Record the kept assistant in the session and create a compaction after it
		// 把保留消息写入会话，并在其后记录一次压缩。
		sessionManager.appendMessage({
			role: "user",
			content: [{ type: "text", text: "before compaction" }],
			timestamp: preCompactionTimestamp - 1000,
		});
		sessionManager.appendMessage(keptAssistant);
		/** 压缩条目记录的首个保留会话条目编号。 */
		const firstKeptEntryId = sessionManager.getEntries()[0]!.id;
		sessionManager.appendCompaction("summary", firstKeptEntryId, keptAssistant.usage.totalTokens, undefined, false);

		// Post-compaction error message
		// 构造压缩之后的新错误助手消息。
		/** 没有可用 Token 统计的错误助手消息。 */
		const errorAssistant: AssistantMessage = {
			role: "assistant",
			content: [{ type: "text", text: "" }],
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
			stopReason: "error",
			errorMessage: "529 overloaded",
			timestamp: Date.now(),
		};

		// Agent state has the kept assistant (pre-compaction) and the error (post-compaction)
		// 代理状态同时包含压缩前保留消息和压缩后错误消息。
		session.agent.state.messages = [
			{ role: "user", content: [{ type: "text", text: "kept user msg" }], timestamp: preCompactionTimestamp - 1000 },
			keptAssistant,
			{ role: "user", content: [{ type: "text", text: "new prompt" }], timestamp: Date.now() - 500 },
			errorAssistant,
		];

		/** 替换私有自动压缩方法并记录调用次数与参数的 spy。 */
		const runAutoCompactionSpy = vi
			.spyOn(
				session as unknown as {
					_runAutoCompaction: (reason: "overflow" | "threshold", willRetry: boolean) => Promise<void>;
				},
				"_runAutoCompaction",
			)
			.mockResolvedValue();

		/** 绑定当前 session 的私有压缩判断方法。 */
		const checkCompaction = (
			session as unknown as {
				_checkCompaction: (assistantMessage: AssistantMessage, skipAbortedCheck?: boolean) => Promise<void>;
			}
		)._checkCompaction.bind(session);

		await checkCompaction(errorAssistant);

		// Should NOT compact because the only usage data is from a kept pre-compaction message
		// 唯一用量来自压缩前保留消息，因此不应再次压缩。
		expect(runAutoCompactionSpy).not.toHaveBeenCalled();
	});
});
