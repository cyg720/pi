/**
 * 文件职责：刻画并回归验证 AgentSession 的手动压缩、自动压缩、认证、取消、溢出恢复和阈值判断。
 * 技术维度：使用 Vitest、伪模型流、会话测试夹具、内部压缩方法视图和消息 Token 估算。
 * 产品维度：保障长对话接近上下文上限时可安全生成摘要并继续，且失败或取消不会造成重复请求和状态错乱。
 * 逻辑维度：先定义消息与摘要流辅助函数，再覆盖扩展摘要、认证来源、自动触发、取消和边界用量判断。
 * 关键边界：部分用例通过类型转换访问内部方法；伪计时器和夹具必须在 afterEach 中恢复与清理。
 * 新手阅读建议：先读 createUsage、createAssistant 和 seedCompactableSession，再按手动、自动、溢出三类用例阅读。
 */

import {
	/** 类型 AssistantMessage：暴露压缩测试需要调用的会话内部方法签名。 */
	type AssistantMessage,
	createAssistantMessageEventStream,
	fauxAssistantMessage,
	/** 类型 Model：暴露压缩测试需要调用的会话内部方法签名。 */
	type Model,
} from "@earendil-works/pi-ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { estimateTokens } from "../../src/core/compaction/index.ts";
import { createHarness, type Harness } from "./harness.ts";

/** 类型 SessionWithCompactionInternals：暴露压缩测试需要调用的会话内部方法签名。 */
type SessionWithCompactionInternals = {
	/** 检查给定助手消息是否需要执行自动压缩。 */
	_checkCompaction: (assistantMessage: AssistantMessage, skipAbortedCheck?: boolean) => Promise<boolean>;
	/** 按溢出或阈值原因执行自动压缩，并返回是否成功。 */
	_runAutoCompaction: (reason: "overflow" | "threshold", willRetry: boolean) => Promise<boolean>;
};

/** 构造固定结构的零成本 Token 用量。参数 totalTokens 为输入和总 Token 数；返回用量对象。例如：createUsage(100)。 */
function createUsage(totalTokens: number) {
	return {
		input: totalTokens,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
	};
}

/** 按夹具模型信息构造助手消息。参数 harness 提供模型，options 控制停止原因、错误、用量和时间；返回 AssistantMessage。例如：createAssistant(harness, { totalTokens: 100 })。 */
function createAssistant(
	harness: Harness,
	options: {
		/** 可选的助手停止原因。 */
		stopReason?: AssistantMessage["stopReason"];
		/** 可选的模型错误说明。 */
		errorMessage?: string;
		/** 可选的总 Token 数，用于触发阈值场景。 */
		totalTokens?: number;
		/** 可选的消息毫秒时间戳。 */
		timestamp?: number;
	},
): AssistantMessage {
	/** 变量 model：夹具当前选中的模型配置；仅在当前函数或测试范围内有效。 */
	const model = harness.getModel();
	return {
		...fauxAssistantMessage("", {
			stopReason: options.stopReason,
			errorMessage: options.errorMessage,
			timestamp: options.timestamp,
		}),
		api: model.api,
		provider: model.provider,
		model: model.id,
		usage: createUsage(options.totalTokens ?? 0),
	};
}

/** 把会话模型流替换为返回固定摘要的伪流。参数 harness 为夹具、summary 为摘要文本；返回读取调用次数的函数。例如：useSummaryStreamFn(harness, "summary")。 */
function useSummaryStreamFn(harness: Harness, summary: string): () => number {
	/** 变量 callCount：固定摘要流被调用的累计次数，从 0 开始；仅在当前函数或测试范围内有效。 */
	let callCount = 0;
	harness.session.agent.streamFunction = (model) => {
		callCount++;
		/** 变量 stream：手工推送完成事件的助手消息流；仅在当前函数或测试范围内有效。 */
		const stream = createAssistantMessageEventStream();
		queueMicrotask(() => {
			/** 变量 message：准备推入伪流的摘要助手消息；仅在当前函数或测试范围内有效。 */
			const message: AssistantMessage = {
				...fauxAssistantMessage(summary),
				api: model.api,
				provider: model.provider,
				model: model.id,
				usage: createUsage(10),
			};
			stream.push({ type: "done", reason: "stop", message });
		});
		return stream;
	};
	return () => callCount;
}

/** 向夹具写入一组可触发压缩的用户与助手消息。参数 harness 为目标夹具；无返回值。例如：seedCompactableSession(harness)。 */
function seedCompactableSession(harness: Harness): void {
	harness.settingsManager.applyOverrides({ compaction: { keepRecentTokens: 1 } });
	/** 变量 now：构造可压缩消息时使用的当前时间戳；仅在当前函数或测试范围内有效。 */
	const now = Date.now();
	harness.sessionManager.appendMessage({
		role: "user",
		content: [{ type: "text", text: "message to compact" }],
		timestamp: now - 1000,
	});
	/** 变量 assistant：当前场景构造的助手消息；仅在当前函数或测试范围内有效。 */
	const assistant = createAssistant(harness, {
		stopReason: "stop",
		totalTokens: 100,
		timestamp: now - 500,
	});
	assistant.content = [{ type: "text", text: "assistant response to compact" }];
	harness.sessionManager.appendMessage(assistant);
	harness.session.agent.state.messages = harness.sessionManager.buildSessionContext().messages;
}

/** 测试分组：AgentSession 压缩行为特征与回归边界。 */
describe("AgentSession compaction characterization", () => {
	/** 变量 harnesses：当前测试已创建且待清理的全部夹具；仅在当前函数或测试范围内有效。 */
	const harnesses: Harness[] = [];

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
	});

	/** 测试场景：manually compacts using an extension-provided summary。 */
	it("manually compacts using an extension-provided summary", async () => {
		/** 变量 summaryUsage：扩展返回摘要时附带的完整用量样例；仅在当前函数或测试范围内有效。 */
		const summaryUsage = {
			input: 10,
			output: 20,
			cacheRead: 30,
			cacheWrite: 40,
			totalTokens: 100,
			cost: { input: 0.1, output: 0.2, cacheRead: 0.3, cacheWrite: 0.4, total: 1 },
		};
		/** 变量 harness：当前场景的会话测试夹具；仅在当前函数或测试范围内有效。 */
		const harness = await createHarness({
			settings: { compaction: { keepRecentTokens: 1 } },
			extensionFactories: [
				(pi) => {
					pi.on("session_before_compact", async (event) => ({
						compaction: {
							summary: "summary from extension",
							firstKeptEntryId: event.preparation.firstKeptEntryId,
							tokensBefore: event.preparation.tokensBefore,
							usage: summaryUsage,
							details: { source: "extension" },
						},
					}));
				},
			],
		});
		harnesses.push(harness);

		await harness.session.prompt("one");
		await harness.session.prompt("two");
		/** 变量 statsBefore：执行压缩前的会话统计快照；仅在当前函数或测试范围内有效。 */
		const statsBefore = harness.session.getSessionStats();

		/** 变量 result：压缩操作返回的摘要、用量与估算结果；仅在当前函数或测试范围内有效。 */
		const result = await harness.session.compact();
		/** 变量 compactionEntries：从会话条目中过滤出的压缩记录；仅在当前函数或测试范围内有效。 */
		const compactionEntries = harness.sessionManager.getEntries().filter((entry) => entry.type === "compaction");
		/** 变量 estimatedTokensAfter：压缩后消息上下文的重新估算 Token 数；仅在当前函数或测试范围内有效。 */
		const estimatedTokensAfter = harness.session.messages.reduce((sum, message) => sum + estimateTokens(message), 0);

		expect(result.summary).toBe("summary from extension");
		expect(result.usage).toEqual(summaryUsage);
		expect(result.estimatedTokensAfter).toBe(estimatedTokensAfter);
		expect(compactionEntries).toHaveLength(1);
		/** 变量 compactionEntry：首个压缩记录，供检查其持久化用量；仅在当前函数或测试范围内有效。 */
		const compactionEntry = compactionEntries[0];
		if (compactionEntry?.type === "compaction") {
			expect(compactionEntry.usage).toEqual(summaryUsage);
		}
		/** 变量 statsAfter：执行压缩后的会话统计快照；仅在当前函数或测试范围内有效。 */
		const statsAfter = harness.session.getSessionStats();
		expect(statsAfter.tokens.input).toBe(statsBefore.tokens.input + summaryUsage.input);
		expect(statsAfter.tokens.output).toBe(statsBefore.tokens.output + summaryUsage.output);
		expect(statsAfter.tokens.cacheRead).toBe(statsBefore.tokens.cacheRead + summaryUsage.cacheRead);
		expect(statsAfter.tokens.cacheWrite).toBe(statsBefore.tokens.cacheWrite + summaryUsage.cacheWrite);
		expect(statsAfter.cost).toBe(statsBefore.cost + summaryUsage.cost.total);
		expect(harness.session.messages[0]?.role).toBe("compactionSummary");
	});

	/** 测试场景：throws when compacting without a model。 */
	it("throws when compacting without a model", async () => {
		/** 变量 harness：当前场景的会话测试夹具；仅在当前函数或测试范围内有效。 */
		const harness = await createHarness();
		harnesses.push(harness);
		harness.session.agent.state.model = undefined as unknown as Model<any>;

		await expect(harness.session.compact()).rejects.toThrow("No model selected");
	});

	/** 测试场景：throws when compacting without configured auth。 */
	it("throws when compacting without configured auth", async () => {
		/** 变量 harness：当前场景的会话测试夹具；仅在当前函数或测试范围内有效。 */
		const harness = await createHarness({ withConfiguredAuth: false });
		harnesses.push(harness);

		await expect(harness.session.compact()).rejects.toThrow(`No API key found for ${harness.getModel().provider}.`);
	});

	/** 测试场景：manually compacts with a custom streamFn when registry auth is absent。 */
	it("manually compacts with a custom streamFn when registry auth is absent", async () => {
		/** 变量 harness：当前场景的会话测试夹具；仅在当前函数或测试范围内有效。 */
		const harness = await createHarness({ withConfiguredAuth: false });
		harnesses.push(harness);
		seedCompactableSession(harness);
		/** 变量 getStreamCallCount：读取自定义摘要流调用次数的闭包；仅在当前函数或测试范围内有效。 */
		const getStreamCallCount = useSummaryStreamFn(harness, "summary from custom stream");

		/** 变量 result：压缩操作返回的摘要、用量与估算结果；仅在当前函数或测试范围内有效。 */
		const result = await harness.session.compact();

		expect(result.summary).toContain("summary from custom stream");
		expect(getStreamCallCount()).toBe(1);
	});

	/** 测试场景：manually compacts with provider-resolved bearer auth。 */
	it("manually compacts with provider-resolved bearer auth", async () => {
		/** 变量 harness：当前场景的会话测试夹具；仅在当前函数或测试范围内有效。 */
		const harness = await createHarness({ withConfiguredAuth: false });
		harnesses.push(harness);
		/** 变量 model：夹具当前选中的模型配置；仅在当前函数或测试范围内有效。 */
		const model = harness.getModel();
		harness.session.modelRuntime.registerNativeProvider({
			id: model.provider,
			name: "Faux bearer provider",
			auth: {
				apiKey: {
					name: "Faux bearer token",
					resolve: async () => ({
						auth: { headers: { Authorization: "Bearer ambient-token" } },
						source: "ambient bearer token",
					}),
				},
			},
			getModels: () => harness.models,
			stream: () => createAssistantMessageEventStream(),
			streamSimple: () => createAssistantMessageEventStream(),
		});
		seedCompactableSession(harness);
		harness.setResponses([
			(_context, options) => {
				expect(options?.apiKey).toBeUndefined();
				expect(options?.headers).toEqual({ Authorization: "Bearer ambient-token" });
				return fauxAssistantMessage("summary with bearer auth");
			},
		]);

		/** 变量 result：压缩操作返回的摘要、用量与估算结果；仅在当前函数或测试范围内有效。 */
		const result = await harness.session.compact();

		expect(result.summary).toContain("summary with bearer auth");
		expect(harness.faux.state.callCount).toBe(1);
	});

	/** 测试场景：persists usage from pi-generated manual compaction。 */
	it("persists usage from pi-generated manual compaction", async () => {
		/** 变量 harness：当前场景的会话测试夹具；仅在当前函数或测试范围内有效。 */
		const harness = await createHarness({ withConfiguredAuth: false });
		harnesses.push(harness);
		seedCompactableSession(harness);
		useSummaryStreamFn(harness, "summary from custom stream");

		/** 变量 result：压缩操作返回的摘要、用量与估算结果；仅在当前函数或测试范围内有效。 */
		const result = await harness.session.compact();

		/** 变量 compactionEntries：从会话条目中过滤出的压缩记录；仅在当前函数或测试范围内有效。 */
		const compactionEntries = harness.sessionManager.getEntries().filter((entry) => entry.type === "compaction");
		expect(result.usage).toEqual(createUsage(10));
		expect(compactionEntries).toHaveLength(1);
		expect(compactionEntries[0]?.type === "compaction" ? compactionEntries[0].usage : undefined).toEqual(
			createUsage(10),
		);
	});

	/** 测试场景：auto-compacts with a custom streamFn when registry auth is absent。 */
	it("auto-compacts with a custom streamFn when registry auth is absent", async () => {
		/** 变量 harness：当前场景的会话测试夹具；仅在当前函数或测试范围内有效。 */
		const harness = await createHarness({ withConfiguredAuth: false });
		harnesses.push(harness);
		seedCompactableSession(harness);
		/** 变量 getStreamCallCount：读取自定义摘要流调用次数的闭包；仅在当前函数或测试范围内有效。 */
		const getStreamCallCount = useSummaryStreamFn(harness, "auto summary from custom stream");
		/** 变量 sessionInternals：转换为内部压缩方法视图的会话对象；仅在当前函数或测试范围内有效。 */
		const sessionInternals = harness.session as unknown as SessionWithCompactionInternals;

		await sessionInternals._runAutoCompaction("threshold", false);

		/** 变量 compactionEntries：从会话条目中过滤出的压缩记录；仅在当前函数或测试范围内有效。 */
		const compactionEntries = harness.sessionManager.getEntries().filter((entry) => entry.type === "compaction");
		/** 变量 compactionEnd：最后一次 compaction_end 事件；仅在当前函数或测试范围内有效。 */
		const compactionEnd = harness.eventsOfType("compaction_end").at(-1);
		expect(compactionEntries).toHaveLength(1);
		expect(compactionEnd?.result?.estimatedTokensAfter).toBeGreaterThan(0);
		expect(getStreamCallCount()).toBe(1);
	});

	/** 测试场景：cancels in-progress manual compaction when abortCompaction is called。 */
	it("cancels in-progress manual compaction when abortCompaction is called", async () => {
		/** 变量 harness：当前场景的会话测试夹具；仅在当前函数或测试范围内有效。 */
		const harness = await createHarness({
			settings: { compaction: { keepRecentTokens: 1 } },
			extensionFactories: [
				(pi) => {
					pi.on("session_before_compact", async (event) => {
						return await new Promise<{ cancel: true }>((resolve) => {
							event.signal.addEventListener("abort", () => resolve({ cancel: true }), { once: true });
						});
					});
				},
			],
		});
		harnesses.push(harness);

		await harness.session.prompt("one");
		await harness.session.prompt("two");

		/** 变量 compactPromise：尚未完成且随后会被取消的手动压缩 Promise；仅在当前函数或测试范围内有效。 */
		const compactPromise = harness.session.compact();
		await new Promise((resolve) => setTimeout(resolve, 0));
		harness.session.abortCompaction();

		await expect(compactPromise).rejects.toThrow("Compaction cancelled");
	});

	/** 测试场景：resumes after threshold compaction when only agent-level queued messages exist。 */
	it("resumes after threshold compaction when only agent-level queued messages exist", async () => {
		vi.useFakeTimers();
		/** 变量 harness：当前场景的会话测试夹具；仅在当前函数或测试范围内有效。 */
		const harness = await createHarness({
			settings: { compaction: { keepRecentTokens: 1 } },
			extensionFactories: [
				(pi) => {
					pi.on("session_before_compact", async (event) => ({
						compaction: {
							summary: "auto compacted",
							firstKeptEntryId: event.preparation.firstKeptEntryId,
							tokensBefore: event.preparation.tokensBefore,
							details: {},
						},
					}));
				},
			],
		});
		harnesses.push(harness);
		harness.setResponses([fauxAssistantMessage("one"), fauxAssistantMessage("two")]);
		await harness.session.prompt("first");
		await harness.session.prompt("second");

		harness.session.agent.followUp({
			role: "custom",
			customType: "test",
			content: [{ type: "text", text: "queued custom" }],
			display: false,
			timestamp: Date.now(),
		});

		/** 变量 sessionInternals：转换为内部压缩方法视图的会话对象；仅在当前函数或测试范围内有效。 */
		const sessionInternals = harness.session as unknown as SessionWithCompactionInternals;

		await expect(sessionInternals._runAutoCompaction("threshold", false)).resolves.toBe(true);
	});

	/** 测试场景：does not retry overflow recovery more than once。 */
	it("does not retry overflow recovery more than once", async () => {
		/** 变量 harness：当前场景的会话测试夹具；仅在当前函数或测试范围内有效。 */
		const harness = await createHarness();
		harnesses.push(harness);
		/** 变量 sessionInternals：转换为内部压缩方法视图的会话对象；仅在当前函数或测试范围内有效。 */
		const sessionInternals = harness.session as unknown as SessionWithCompactionInternals;
		/** 变量 overflowMessage：模拟上下文超限错误的助手消息；仅在当前函数或测试范围内有效。 */
		const overflowMessage = createAssistant(harness, {
			stopReason: "error",
			errorMessage: "prompt is too long",
			timestamp: Date.now(),
		});
		/** 变量 runAutoCompactionSpy：监视自动压缩内部调用的 Vitest spy；仅在当前函数或测试范围内有效。 */
		const runAutoCompactionSpy = vi.spyOn(sessionInternals, "_runAutoCompaction").mockResolvedValue(false);
		/** 变量 compactionErrors：订阅到的压缩错误消息列表；仅在当前函数或测试范围内有效。 */
		const compactionErrors: string[] = [];
		harness.session.subscribe((event) => {
			if (event.type === "compaction_end" && event.errorMessage) {
				compactionErrors.push(event.errorMessage);
			}
		});

		await sessionInternals._checkCompaction(overflowMessage);
		await sessionInternals._checkCompaction({ ...overflowMessage, timestamp: Date.now() + 1 });

		expect(runAutoCompactionSpy).toHaveBeenCalledTimes(1);
		expect(compactionErrors).toContain(
			"Context overflow recovery failed after one compact-and-retry attempt. Try reducing context or switching to a larger-context model.",
		);
	});

	/** 测试场景：compacts successful overflow responses without retrying。 */
	it("compacts successful overflow responses without retrying", async () => {
		/** 变量 harness：当前场景的会话测试夹具；仅在当前函数或测试范围内有效。 */
		const harness = await createHarness({
			settings: { compaction: { enabled: true, keepRecentTokens: 1, reserveTokens: 0 } },
			models: [{ id: "faux-1", contextWindow: 1, maxTokens: 100 }],
			extensionFactories: [
				(pi) => {
					pi.on("session_before_compact", async (event) => ({
						compaction: {
							summary: "successful overflow compacted",
							firstKeptEntryId: event.preparation.firstKeptEntryId,
							tokensBefore: event.preparation.tokensBefore,
							details: {},
						},
					}));
				},
			],
		});
		harnesses.push(harness);
		harness.setResponses([fauxAssistantMessage("completed answer")]);

		await expect(harness.session.prompt("hello")).resolves.toBeUndefined();

		/** 变量 compactionEnd：最后一次 compaction_end 事件；仅在当前函数或测试范围内有效。 */
		const compactionEnd = harness.eventsOfType("compaction_end").at(-1);
		expect(compactionEnd).toMatchObject({
			reason: "overflow",
			aborted: false,
			willRetry: false,
		});
		expect(harness.faux.state.callCount).toBe(1);
	});

	/** 测试场景：ignores stale pre-compaction assistant usage on pre-prompt checks。 */
	it("ignores stale pre-compaction assistant usage on pre-prompt checks", async () => {
		/** 变量 harness：当前场景的会话测试夹具；仅在当前函数或测试范围内有效。 */
		const harness = await createHarness();
		harnesses.push(harness);
		/** 变量 sessionInternals：转换为内部压缩方法视图的会话对象；仅在当前函数或测试范围内有效。 */
		const sessionInternals = harness.session as unknown as SessionWithCompactionInternals;
		/** 变量 staleTimestamp：早于最近压缩的旧消息时间戳；仅在当前函数或测试范围内有效。 */
		const staleTimestamp = Date.now() - 10_000;
		/** 变量 staleAssistant：携带过期高 Token 用量的助手消息；仅在当前函数或测试范围内有效。 */
		const staleAssistant = createAssistant(harness, {
			stopReason: "stop",
			totalTokens: 610_000,
			timestamp: staleTimestamp,
		});

		harness.sessionManager.appendMessage({
			role: "user",
			content: [{ type: "text", text: "before compaction" }],
			timestamp: staleTimestamp - 1000,
		});
		harness.sessionManager.appendMessage(staleAssistant);
		/** 变量 firstKeptEntryId：压缩记录声明保留的首条消息编号；仅在当前函数或测试范围内有效。 */
		const firstKeptEntryId = harness.sessionManager.getEntries()[0]!.id;
		harness.sessionManager.appendCompaction(
			"summary",
			firstKeptEntryId,
			staleAssistant.usage.totalTokens,
			undefined,
			false,
		);
		harness.sessionManager.appendMessage({
			role: "user",
			content: [{ type: "text", text: "after compaction" }],
			timestamp: Date.now(),
		});

		/** 变量 runAutoCompactionSpy：监视自动压缩内部调用的 Vitest spy；仅在当前函数或测试范围内有效。 */
		const runAutoCompactionSpy = vi.spyOn(sessionInternals, "_runAutoCompaction").mockResolvedValue(false);

		await sessionInternals._checkCompaction(staleAssistant, false);

		expect(runAutoCompactionSpy).not.toHaveBeenCalled();
	});

	/** 测试场景：triggers threshold compaction for error messages using the last successful usage。 */
	it("triggers threshold compaction for error messages using the last successful usage", async () => {
		/** 变量 harness：当前场景的会话测试夹具；仅在当前函数或测试范围内有效。 */
		const harness = await createHarness();
		harnesses.push(harness);
		/** 变量 sessionInternals：转换为内部压缩方法视图的会话对象；仅在当前函数或测试范围内有效。 */
		const sessionInternals = harness.session as unknown as SessionWithCompactionInternals;
		/** 变量 successfulAssistant：最近一次带有效高用量的成功助手消息；仅在当前函数或测试范围内有效。 */
		const successfulAssistant = createAssistant(harness, {
			stopReason: "stop",
			totalTokens: 190_000,
			timestamp: Date.now(),
		});
		/** 变量 errorAssistant：不含可靠用量的错误助手消息；仅在当前函数或测试范围内有效。 */
		const errorAssistant = createAssistant(harness, {
			stopReason: "error",
			errorMessage: "529 overloaded",
			timestamp: Date.now() + 1000,
		});
		harness.session.agent.state.messages = [
			{ role: "user", content: [{ type: "text", text: "hello" }], timestamp: Date.now() - 1000 },
			successfulAssistant,
			{ role: "user", content: [{ type: "text", text: "retry" }], timestamp: Date.now() + 500 },
			errorAssistant,
		];

		/** 变量 runAutoCompactionSpy：监视自动压缩内部调用的 Vitest spy；仅在当前函数或测试范围内有效。 */
		const runAutoCompactionSpy = vi.spyOn(sessionInternals, "_runAutoCompaction").mockResolvedValue(false);

		await sessionInternals._checkCompaction(errorAssistant);

		expect(runAutoCompactionSpy).toHaveBeenCalledWith("threshold", false);
	});

	/** 测试场景：does not trigger threshold compaction for error messages when no prior usage exists。 */
	it("does not trigger threshold compaction for error messages when no prior usage exists", async () => {
		/** 变量 harness：当前场景的会话测试夹具；仅在当前函数或测试范围内有效。 */
		const harness = await createHarness();
		harnesses.push(harness);
		/** 变量 sessionInternals：转换为内部压缩方法视图的会话对象；仅在当前函数或测试范围内有效。 */
		const sessionInternals = harness.session as unknown as SessionWithCompactionInternals;
		/** 变量 errorAssistant：不含可靠用量的错误助手消息；仅在当前函数或测试范围内有效。 */
		const errorAssistant = createAssistant(harness, {
			stopReason: "error",
			errorMessage: "529 overloaded",
			timestamp: Date.now(),
		});
		harness.session.agent.state.messages = [
			{ role: "user", content: [{ type: "text", text: "hello" }], timestamp: Date.now() - 1000 },
			errorAssistant,
		];

		/** 变量 runAutoCompactionSpy：监视自动压缩内部调用的 Vitest spy；仅在当前函数或测试范围内有效。 */
		const runAutoCompactionSpy = vi.spyOn(sessionInternals, "_runAutoCompaction").mockResolvedValue(false);

		await sessionInternals._checkCompaction(errorAssistant);

		expect(runAutoCompactionSpy).not.toHaveBeenCalled();
	});

	/** 测试场景：does not trigger threshold compaction when only kept pre-compaction usage exists。 */
	it("does not trigger threshold compaction when only kept pre-compaction usage exists", async () => {
		/** 变量 harness：当前场景的会话测试夹具；仅在当前函数或测试范围内有效。 */
		const harness = await createHarness();
		harnesses.push(harness);
		/** 变量 sessionInternals：转换为内部压缩方法视图的会话对象；仅在当前函数或测试范围内有效。 */
		const sessionInternals = harness.session as unknown as SessionWithCompactionInternals;
		/** 变量 preCompactionTimestamp：构造压缩前保留消息的旧时间戳；仅在当前函数或测试范围内有效。 */
		const preCompactionTimestamp = Date.now() - 10_000;
		/** 变量 keptAssistant：位于既有压缩之前且仍被保留的助手消息；仅在当前函数或测试范围内有效。 */
		const keptAssistant = createAssistant(harness, {
			stopReason: "stop",
			totalTokens: 190_000,
			timestamp: preCompactionTimestamp,
		});

		harness.sessionManager.appendMessage({
			role: "user",
			content: [{ type: "text", text: "before compaction" }],
			timestamp: preCompactionTimestamp - 1000,
		});
		harness.sessionManager.appendMessage(keptAssistant);
		/** 变量 firstKeptEntryId：压缩记录声明保留的首条消息编号；仅在当前函数或测试范围内有效。 */
		const firstKeptEntryId = harness.sessionManager.getEntries()[0]!.id;
		harness.sessionManager.appendCompaction(
			"summary",
			firstKeptEntryId,
			keptAssistant.usage.totalTokens,
			undefined,
			false,
		);

		/** 变量 errorAssistant：不含可靠用量的错误助手消息；仅在当前函数或测试范围内有效。 */
		const errorAssistant = createAssistant(harness, {
			stopReason: "error",
			errorMessage: "529 overloaded",
			timestamp: Date.now(),
		});
		harness.session.agent.state.messages = [
			{ role: "user", content: [{ type: "text", text: "kept user" }], timestamp: preCompactionTimestamp - 1000 },
			keptAssistant,
			{ role: "user", content: [{ type: "text", text: "new prompt" }], timestamp: Date.now() - 500 },
			errorAssistant,
		];

		/** 变量 runAutoCompactionSpy：监视自动压缩内部调用的 Vitest spy；仅在当前函数或测试范围内有效。 */
		const runAutoCompactionSpy = vi.spyOn(sessionInternals, "_runAutoCompaction").mockResolvedValue(false);

		await sessionInternals._checkCompaction(errorAssistant);

		expect(runAutoCompactionSpy).not.toHaveBeenCalled();
	});

	/** 测试场景：does not trigger threshold compaction below the threshold or when disabled。 */
	it("does not trigger threshold compaction below the threshold or when disabled", async () => {
		/** 变量 belowThresholdHarness：Token 用量低于阈值的测试夹具；仅在当前函数或测试范围内有效。 */
		const belowThresholdHarness = await createHarness({
			settings: { compaction: { enabled: true, reserveTokens: 1000 } },
			models: [{ id: "faux-1", contextWindow: 200_000 }],
		});
		harnesses.push(belowThresholdHarness);
		/** 变量 disabledHarness：明确关闭自动压缩的测试夹具；仅在当前函数或测试范围内有效。 */
		const disabledHarness = await createHarness({ settings: { compaction: { enabled: false } } });
		harnesses.push(disabledHarness);

		/** 变量 belowThresholdInternals：低阈值场景的内部会话视图；仅在当前函数或测试范围内有效。 */
		const belowThresholdInternals = belowThresholdHarness.session as unknown as SessionWithCompactionInternals;
		/** 变量 disabledInternals：禁用场景的内部会话视图；仅在当前函数或测试范围内有效。 */
		const disabledInternals = disabledHarness.session as unknown as SessionWithCompactionInternals;
		/** 变量 belowThresholdSpy：低阈值场景自动压缩调用监视器；仅在当前函数或测试范围内有效。 */
		const belowThresholdSpy = vi.spyOn(belowThresholdInternals, "_runAutoCompaction").mockResolvedValue(false);
		/** 变量 disabledSpy：禁用场景自动压缩调用监视器；仅在当前函数或测试范围内有效。 */
		const disabledSpy = vi.spyOn(disabledInternals, "_runAutoCompaction").mockResolvedValue(false);

		await belowThresholdInternals._checkCompaction(
			createAssistant(belowThresholdHarness, { stopReason: "stop", totalTokens: 1_000, timestamp: Date.now() }),
		);
		await disabledInternals._checkCompaction(
			createAssistant(disabledHarness, { stopReason: "stop", totalTokens: 1_000_000, timestamp: Date.now() }),
		);

		expect(belowThresholdSpy).not.toHaveBeenCalled();
		expect(disabledSpy).not.toHaveBeenCalled();
	});
});
