/**
 * 文件职责：回归验证 #6647 中会话压缩摘要遇到暂时流中断时会按设置重试，并正确处理终止条件。
 * 技术维度：使用 Vitest、coding-agent Harness、假助手事件流和微任务构造可重复的流成功/失败脚本。
 * 产品维度：避免长会话压缩因一次短暂网络断开而整体失败，同时防止配额错误或用户中止被错误重试。
 * 逻辑维度：先播种可压缩会话，再替换 streamFunction，分别覆盖恢复、不可重试、禁用、耗尽和中止。
 * 关键边界：重试次数由 settings.retry 控制；只有可重试助手错误会重试；每个 Harness 必须清理。
 * 新手阅读建议：先看 seedCompactableSession 与 useScriptedStreamFn，再按成功恢复到中止回退的顺序阅读用例。
 */
import type { StreamFn } from "@earendil-works/pi-agent-core";
import { type AssistantMessage, createAssistantMessageEventStream, fauxAssistantMessage } from "@earendil-works/pi-ai";
import { afterEach, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "../harness.ts";

/**
 * Regression for #6647: compaction runs a single non-retried summarization call, so a
 * transient mid-stream socket death (`terminated`) failed the whole compaction.
 * Verifies that summarization now reuses `settings.retry` (bounded retries with
 * exponential backoff gated on isRetryableAssistantError), emits
 * `summarization_retry_*` events, and that aborts / non-retryable errors are not retried.
 */
/** #6647 回归：摘要调用应复用有限指数退避设置、发出重试事件，并跳过中止及不可重试错误。 */
/** 覆盖会话压缩摘要的重试决策、事件和中止行为。 */
describe("#6647 compaction retries transient summarization failures", () => {
	/** 当前 describe 创建的全部 Harness，afterEach 统一清理。 */
	const harnesses: Harness[] = [];

	/** 每个用例后释放所有会话、假提供商和临时目录。 */
	afterEach(() => {
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
	});

	/**
	 * 创建指定总令牌数的零成本用量对象。
	 * @param totalTokens 输入和总令牌数。
	 * @returns 可放入 AssistantMessage 的 usage。
	 * @example createUsage(100);
	 */
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

	/**
	 * 向 Harness 写入一组会触发压缩的用户和助手消息。
	 * @param harness 待播种的测试夹具。
	 * @returns 无返回值，同时同步 SessionManager 与 Agent 状态。
	 * @example seedCompactableSession(harness);
	 */
	function seedCompactableSession(harness: Harness): void {
		harness.settingsManager.applyOverrides({ compaction: { keepRecentTokens: 1 } });
		/** 用于构造有先后顺序消息时间戳的当前时间。 */
		const now = Date.now();
		harness.sessionManager.appendMessage({
			role: "user",
			content: [{ type: "text", text: "message to compact" }],
			timestamp: now - 1000,
		});
		/** 假提供商当前模型，用于补齐助手消息来源字段。 */
		const model = harness.getModel();
		/** 令牌数足以超过 keepRecentTokens 的助手消息。 */
		const assistant: AssistantMessage = {
			...fauxAssistantMessage("", { stopReason: "stop", timestamp: now - 500 }),
			api: model.api,
			provider: model.provider,
			model: model.id,
			usage: createUsage(100),
		};
		assistant.content = [{ type: "text", text: "assistant response to compact" }];
		harness.sessionManager.appendMessage(assistant);
		harness.session.agent.state.messages = harness.sessionManager.buildSessionContext().messages;
	}

	/** streamFn that responds with the given sequence of assistant messages across calls. */
	/** 按调用次数返回脚本中对应助手消息的流函数。 */
	/**
	 * @param harness 要替换 streamFunction 的夹具。
	 * @param script 每次调用依次使用的助手消息，超出后重复最后一条。
	 * @returns 读取当前调用次数的函数。
	 * @example const count = useScriptedStreamFn(harness, [message]);
	 */
	function useScriptedStreamFn(harness: Harness, script: AssistantMessage[]): () => number {
		/** 脚本流函数已被调用的次数。 */
		let callCount = 0;
		/** 根据 callCount 创建成功、错误或中止事件流的替代实现。 */
		const streamFunction: StreamFn = (model) => {
			/** 当前调用应返回的脚本消息；越界时复用最后一条。 */
			const message = script[callCount] ?? script[script.length - 1]!;
			callCount++;
			/** 本次调用返回给 Agent 的助手事件流。 */
			const stream = createAssistantMessageEventStream();
			queueMicrotask(() => {
				const response = { ...message, api: model.api, provider: model.provider, model: model.id };
				if (response.stopReason === "pending") {
					const error: AssistantMessage = {
						...response,
						stopReason: "error",
						errorMessage: "Scripted response ended without a stop reason",
					};
					stream.push({ type: "error", reason: "error", error });
				} else if (response.stopReason === "error" || response.stopReason === "aborted") {
					stream.push({ type: "error", reason: response.stopReason, error: response });
				} else {
					stream.push({ type: "done", reason: response.stopReason, message: response });
				}
			});
			return stream;
		};
		harness.session.agent.streamFunction = streamFunction;
		return () => callCount;
	}

	it("retries a transient `terminated` summarization error and compacts successfully", async () => {
		/** 暂时错误恢复场景的未配置认证夹具。 */
		const harness = await createHarness({ withConfiguredAuth: false });
		harnesses.push(harness);
		seedCompactableSession(harness);
		harness.settingsManager.applyOverrides({ retry: { enabled: true, maxRetries: 3, baseDelayMs: 0 } });

		/** 用于确认恢复后仍使用原模型的假模型。 */
		const model = harness.getModel();
		/** 创建带指定错误文本的助手错误消息。 */
		const error = (errorMessage: string): AssistantMessage => ({
			...fauxAssistantMessage("", { stopReason: "error", errorMessage }),
			usage: createUsage(10),
		});
		/** 两次失败后返回的成功摘要消息。 */
		const success: AssistantMessage = {
			...fauxAssistantMessage("recovered summary"),
			usage: createUsage(10),
		};
		/** 查询摘要流总调用次数的函数。 */
		const getCallCount = useScriptedStreamFn(harness, [error("terminated"), error("terminated"), success]);

		/** 压缩成功结果，应包含恢复后的摘要。 */
		const result = await harness.session.compact();

		expect(result.summary).toContain("recovered summary");
		expect(getCallCount()).toBe(3); // 1 initial + 2 retries
		// 共调用三次：一次初始请求和两次重试。
		/** 捕获的摘要重试调度事件。 */
		const starts = harness.eventsOfType("summarization_retry_scheduled");
		/** 捕获的摘要重试结束事件。 */
		const ends = harness.eventsOfType("summarization_retry_finished");
		expect(starts).toHaveLength(2);
		expect(ends).toHaveLength(1);
		expect(starts[0]).toMatchObject({ attempt: 1, maxAttempts: 3, errorMessage: "terminated" });
		expect(starts[1]).toMatchObject({ attempt: 2, maxAttempts: 3 });
		expect(ends[0]).toMatchObject({ type: "summarization_retry_finished" });
		// model.* referenced to keep imports honest
		// 引用 model 字段以确保类型和值确实参与测试。
		expect(model.id).toBeTruthy();
	});

	it("does not retry a non-retryable error (insufficient_quota)", async () => {
		/** 不可重试配额错误场景的夹具。 */
		const harness = await createHarness({ withConfiguredAuth: false });
		harnesses.push(harness);
		seedCompactableSession(harness);
		harness.settingsManager.applyOverrides({ retry: { enabled: true, maxRetries: 3, baseDelayMs: 0 } });

		/** 配额不足助手错误。 */
		const error: AssistantMessage = {
			...fauxAssistantMessage("", { stopReason: "error", errorMessage: "insufficient_quota" }),
			usage: createUsage(10),
		};
		/** 查询不可重试错误场景调用次数的函数。 */
		const getCallCount = useScriptedStreamFn(harness, [error]);

		await expect(harness.session.compact()).rejects.toThrow("insufficient_quota");
		expect(getCallCount()).toBe(1);
		expect(harness.eventsOfType("summarization_retry_scheduled")).toHaveLength(0);
	});

	it("does not retry when retry is disabled", async () => {
		/** 禁用重试场景的夹具。 */
		const harness = await createHarness({ withConfiguredAuth: false });
		harnesses.push(harness);
		seedCompactableSession(harness);
		harness.settingsManager.applyOverrides({ retry: { enabled: false, maxRetries: 3, baseDelayMs: 0 } });

		/** 在禁用重试时出现的暂时错误。 */
		const error: AssistantMessage = {
			...fauxAssistantMessage("", { stopReason: "error", errorMessage: "terminated" }),
			usage: createUsage(10),
		};
		/** 查询禁用重试场景调用次数的函数。 */
		const getCallCount = useScriptedStreamFn(harness, [error]);

		await expect(harness.session.compact()).rejects.toThrow("terminated");
		expect(getCallCount()).toBe(1);
		expect(harness.eventsOfType("summarization_retry_scheduled")).toHaveLength(0);
	});

	it("stops retrying after maxRetries and reports failure", async () => {
		/** 重试耗尽场景的夹具。 */
		const harness = await createHarness({ withConfiguredAuth: false });
		harnesses.push(harness);
		seedCompactableSession(harness);
		harness.settingsManager.applyOverrides({ retry: { enabled: true, maxRetries: 2, baseDelayMs: 0 } });

		/** 每次调用都返回的暂时错误。 */
		const error: AssistantMessage = {
			...fauxAssistantMessage("", { stopReason: "error", errorMessage: "terminated" }),
			usage: createUsage(10),
		};
		/** 查询最大重试场景调用次数的函数。 */
		const getCallCount = useScriptedStreamFn(harness, [error, error, error]);

		await expect(harness.session.compact()).rejects.toThrow("terminated");
		expect(getCallCount()).toBe(3); // 1 initial + 2 retries
		// maxRetries 为 2，因此总计一次初始请求和两次重试。
		/** 重试耗尽前发出的调度事件。 */
		const starts = harness.eventsOfType("summarization_retry_scheduled");
		/** 重试循环结束事件。 */
		const ends = harness.eventsOfType("summarization_retry_finished");
		expect(starts).toHaveLength(2);
		expect(ends).toHaveLength(1);
		expect(ends[0]).toMatchObject({ type: "summarization_retry_finished" });
	});

	it("aborts an in-flight retry backoff via abortCompaction", async () => {
		/** 长退避中止场景的夹具。 */
		const harness = await createHarness({ withConfiguredAuth: false });
		harnesses.push(harness);
		seedCompactableSession(harness);
		harness.settingsManager.applyOverrides({ retry: { enabled: true, maxRetries: 5, baseDelayMs: 30_000 } });

		/** 触发 30 秒重试退避的暂时错误。 */
		const error: AssistantMessage = {
			...fauxAssistantMessage("", { stopReason: "error", errorMessage: "terminated" }),
			usage: createUsage(10),
		};
		useScriptedStreamFn(harness, [error, error, error]);

		/** 尚在执行或退避中的压缩 Promise。 */
		const compactPromise = harness.session.compact();
		// Let the first error resolve and the retry backoff sleep start.
		// 让首次错误完成并进入重试退避等待。
		await new Promise((resolve) => setTimeout(resolve, 0));
		harness.session.abortCompaction();

		// The aborted retry backoff is normalized to an aborted assistant message,
		// which compaction classifies as aborted.
		// 被中止的退避会归一化为 aborted 助手消息，压缩流程据此标记中止。
		await expect(compactPromise).rejects.toThrow();
		/** 最后一个压缩结束事件，应带 aborted 标记。 */
		const compactionEnd = harness.eventsOfType("compaction_end").at(-1);
		expect(compactionEnd).toMatchObject({ aborted: true });
	});
});
