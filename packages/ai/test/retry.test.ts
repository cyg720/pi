/**
 * 文件职责：验证助手错误的可重试分类以及 retryAssistantCall 的次数、事件、成功、中止和策略开关。
 * 技术维度：使用 Vitest mock、假助手消息、AbortController 和零延迟/长延迟重试策略构造纯单元测试。
 * 产品维度：让短暂网络或提供商故障自动恢复，同时避免对配额、计费和用户中止进行无意义重试。
 * 逻辑维度：先用真实错误文本测试分类器，再覆盖立即成功、不可重试、耗尽、恢复、事件和中止退避。
 * 关键边界：maxRetries 不含首次调用；只有 error 且命中暂时错误才重试；中止退避返回 aborted 消息。
 * 新手阅读建议：先读分类用例理解规则，再按 retryAssistantCall 的成功—失败—恢复—中止路径阅读。
 */
import { describe, expect, it, vi } from "vitest";
import { fauxAssistantMessage } from "../src/providers/faux.ts";
import { isRetryableAssistantError, type RetryPolicy, retryAssistantCall } from "../src/utils/retry.ts";

/** OpenAI 明确提示用户可重试的错误文本。 */
const openAIExplicitRetryMessage =
	"An error occurred while processing your request. You can retry your request, or contact us through our help center at help.openai.com if the error persists. Please include the request ID req_******** in your message.";
/** Bedrock JSON 正文中明确建议重试的错误文本。 */
const bedrockExplicitRetryMessage =
	'{"message":"The system encountered an unexpected error during processing. Try your request again."}';
/** NVIDIA NIM 工作节点请求上限错误。 */
const nvidiaNIMResourceExhaustedMessage = "ResourceExhausted: Worker local total request limit reached (288/48)";
/** Bun fetch 套接字意外关闭错误。 */
const bunFetchSocketClosedMessage =
	"The socket connection was closed unexpectedly. For more information, pass `verbose: true` in the second argument to fetch()";
/** OpenAI Responses 流在终止事件前结束的错误。 */
const openAIResponsesEarlyEofMessage = "OpenAI Responses stream ended before a terminal response event";
/** 被上层错误文本包裹的 DNS 查询失败。 */
const wrappedDnsLookupError =
	"The pending stream has been canceled (caused by: getaddrinfo ENOTFOUND bedrock-runtime.us-east-1.amazonaws.com)";

/** 覆盖不同提供商与传输层错误文本的重试分类。 */
describe("provider retry classification", () => {
	it("matches explicit provider retry guidance", () => {
		expect(
			isRetryableAssistantError(
				fauxAssistantMessage("", { stopReason: "error", errorMessage: openAIExplicitRetryMessage }),
			),
		).toBe(true);
		expect(
			isRetryableAssistantError(
				fauxAssistantMessage("", { stopReason: "error", errorMessage: bedrockExplicitRetryMessage }),
			),
		).toBe(true);
		expect(
			isRetryableAssistantError(
				fauxAssistantMessage("", { stopReason: "error", errorMessage: nvidiaNIMResourceExhaustedMessage }),
			),
		).toBe(true);
	});

	it("matches Bun fetch socket drop wording", () => {
		expect(
			isRetryableAssistantError(
				fauxAssistantMessage("", { stopReason: "error", errorMessage: bunFetchSocketClosedMessage }),
			),
		).toBe(true);
	});

	it.each([
		wrappedDnsLookupError,
		"connect ENOTFOUND api.example.com",
		"EAI_AGAIN api.example.com",
		"getaddrinfo failed for api.example.com",
	])("matches DNS transport failure wording: %s", (errorMessage) => {
		expect(isRetryableAssistantError(fauxAssistantMessage("", { stopReason: "error", errorMessage }))).toBe(true);
	});

	it("matches OpenAI Responses streams that end before terminal events", () => {
		expect(
			isRetryableAssistantError(
				fauxAssistantMessage("", { stopReason: "error", errorMessage: openAIResponsesEarlyEofMessage }),
			),
		).toBe(true);
	});

	it("keeps provider limit errors non-retryable", () => {
		expect(
			isRetryableAssistantError(
				fauxAssistantMessage("", { stopReason: "error", errorMessage: "429 quota exceeded" }),
			),
		).toBe(false);
	});

	it("classifies assistant error messages", () => {
		expect(
			isRetryableAssistantError(fauxAssistantMessage("", { stopReason: "error", errorMessage: "overloaded_error" })),
		).toBe(true);
		expect(
			isRetryableAssistantError(
				fauxAssistantMessage("", { stopReason: "error", errorMessage: "524 status code (no body)" }),
			),
		).toBe(true);
		expect(isRetryableAssistantError(fauxAssistantMessage("not an error"))).toBe(false);
	});
});

/** 覆盖重试执行器的策略开关、次数、回调和中止行为。 */
describe("retryAssistantCall", () => {
	/** 完全关闭重试的策略。 */
	const disabled: RetryPolicy = { enabled: false, maxRetries: 3, baseDelayMs: 0 };
	/** 开启三次重试且无等待的策略。 */
	const enabled: RetryPolicy = { enabled: true, maxRetries: 3, baseDelayMs: 0 };

	it("returns a successful response immediately without retrying", async () => {
		/** 首次即返回成功消息的生产函数。 */
		const produce = vi.fn(async () => fauxAssistantMessage("ok"));
		/** 重试执行器返回的成功消息。 */
		const res = await retryAssistantCall(produce, enabled, undefined);
		expect(res.content).toEqual([{ type: "text", text: "ok" }]);
		expect(produce).toHaveBeenCalledTimes(1);
	});

	it("does not retry an aborted message", async () => {
		/** 首次即返回 aborted 的生产函数。 */
		const produce = vi.fn(async () => fauxAssistantMessage("", { stopReason: "aborted" }));
		/** 记录是否错误调度重试的回调。 */
		const onRetryScheduled = vi.fn();
		/** aborted 场景的最终结果。 */
		const res = await retryAssistantCall(produce, enabled, undefined, { onRetryScheduled });
		expect(res.stopReason).toBe("aborted");
		expect(produce).toHaveBeenCalledTimes(1);
		expect(onRetryScheduled).not.toHaveBeenCalled();
	});

	it("does not retry a non-retryable error (quota/billing)", async () => {
		/** 始终返回配额错误的生产函数。 */
		const produce = vi.fn(async () =>
			fauxAssistantMessage("", { stopReason: "error", errorMessage: "insufficient_quota" }),
		);
		/** 重试调度回调 mock。 */
		const onRetryScheduled = vi.fn();
		/** 重试完成回调 mock。 */
		const onRetryFinished = vi.fn();
		/** 配额错误的最终结果。 */
		const res = await retryAssistantCall(produce, enabled, undefined, { onRetryScheduled, onRetryFinished });
		expect(res.stopReason).toBe("error");
		expect(produce).toHaveBeenCalledTimes(1);
		expect(onRetryScheduled).not.toHaveBeenCalled();
		expect(onRetryFinished).not.toHaveBeenCalled();
	});

	it("retries a transient error up to maxRetries then returns the final error", async () => {
		/** 始终返回 terminated 暂时错误的生产函数。 */
		const produce = vi.fn(async () => fauxAssistantMessage("", { stopReason: "error", errorMessage: "terminated" }));
		/** 每次暂时错误后的调度回调。 */
		const onRetryScheduled = vi.fn();
		/** 重试循环结束回调。 */
		const onRetryFinished = vi.fn();
		/** 耗尽重试后的最终错误。 */
		const res = await retryAssistantCall(produce, enabled, undefined, { onRetryScheduled, onRetryFinished });
		expect(res.stopReason).toBe("error");
		expect(produce).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
		// 总计一次初始调用和三次重试。
		expect(onRetryScheduled).toHaveBeenCalledTimes(3);
		expect(onRetryFinished).toHaveBeenCalledWith(false, 3, "terminated");
	});

	it("stops retrying once a call succeeds", async () => {
		/** 当前生产函数调用次数。 */
		let n = 0;
		/** 前两次失败、第三次恢复的生产函数。 */
		const produce = vi.fn(async () => {
			n++;
			return n < 3
				? fauxAssistantMessage("", { stopReason: "error", errorMessage: "terminated" })
				: fauxAssistantMessage("recovered");
		});
		/** 记录恢复时重试次数的完成回调。 */
		const onRetryFinished = vi.fn();
		/** 第三次调用成功后的结果。 */
		const res = await retryAssistantCall(produce, enabled, undefined, { onRetryFinished });
		expect(res.content).toEqual([{ type: "text", text: "recovered" }]);
		expect(produce).toHaveBeenCalledTimes(3);
		expect(onRetryFinished).toHaveBeenCalledWith(true, 2);
	});

	it("reports an aborted retried call as unsuccessful", async () => {
		/** 当前生产函数调用次数。 */
		let n = 0;
		/** 首次暂时错误、重试时返回 aborted 的生产函数。 */
		const produce = vi.fn(async () => {
			n++;
			return n === 1
				? fauxAssistantMessage("", { stopReason: "error", errorMessage: "terminated" })
				: fauxAssistantMessage("", { stopReason: "aborted" });
		});
		/** 记录重试被中止的完成回调。 */
		const onRetryFinished = vi.fn();
		/** 重试调用中止后的结果。 */
		const res = await retryAssistantCall(produce, enabled, undefined, { onRetryFinished });
		expect(res.stopReason).toBe("aborted");
		expect(produce).toHaveBeenCalledTimes(2);
		expect(onRetryFinished).toHaveBeenCalledWith(false, 1);
	});

	it("does not retry when policy is disabled", async () => {
		/** 在禁用策略下返回暂时错误的生产函数。 */
		const produce = vi.fn(async () => fauxAssistantMessage("", { stopReason: "error", errorMessage: "terminated" }));
		/** 禁用策略下不应调用的调度回调。 */
		const onRetryScheduled = vi.fn();
		/** 禁用策略下不应调用的完成回调。 */
		const onRetryFinished = vi.fn();
		/** 禁用策略下直接返回的错误。 */
		const res = await retryAssistantCall(produce, disabled, undefined, { onRetryScheduled, onRetryFinished });
		expect(res.stopReason).toBe("error");
		expect(produce).toHaveBeenCalledTimes(1);
		expect(onRetryScheduled).not.toHaveBeenCalled();
		expect(onRetryFinished).not.toHaveBeenCalled();
	});

	it("emits onRetryAttemptStart after backoff before each retried call", async () => {
		/** 记录生产、调度和重试开始的精确事件顺序。 */
		const events: string[] = [];
		/** 当前生产调用编号。 */
		let n = 0;
		/** 前两次失败、第三次成功并记录顺序的生产函数。 */
		const produce = vi.fn(async () => {
			events.push(`produce:${n}`);
			n++;
			return n < 3
				? fauxAssistantMessage("", { stopReason: "error", errorMessage: "terminated" })
				: fauxAssistantMessage("recovered");
		});
		/** 记录重试调度及 attempt 的回调。 */
		const onRetryScheduled = vi.fn((attempt: number) => {
			events.push(`retry:${attempt}`);
		});
		/** 记录退避结束、重试调用即将开始的回调。 */
		const onRetryAttemptStart = vi.fn(() => {
			events.push("attempt-start");
		});
		/** 恢复后的最终消息。 */
		const res = await retryAssistantCall(produce, enabled, undefined, { onRetryScheduled, onRetryAttemptStart });
		expect(res.content).toEqual([{ type: "text", text: "recovered" }]);
		expect(onRetryScheduled).toHaveBeenCalledTimes(2);
		expect(onRetryAttemptStart).toHaveBeenCalledTimes(2);
		expect(events).toEqual([
			"produce:0",
			"retry:1",
			"attempt-start",
			"produce:1",
			"retry:2",
			"attempt-start",
			"produce:2",
		]);
	});

	it("aborts backoff sleep via signal, returns an aborted message, and emits onRetryFinished(false)", async () => {
		/** 中止长退避等待的控制器。 */
		const controller = new AbortController();
		/** 首次返回暂时错误的生产函数。 */
		const produce = vi.fn(async () => fauxAssistantMessage("", { stopReason: "error", errorMessage: "terminated" }));
		/** 启用五次重试和十秒基础延迟的策略。 */
		const policy: RetryPolicy = { enabled: true, maxRetries: 5, baseDelayMs: 10_000 };
		/** 记录退避中止结果的完成回调。 */
		const onRetryFinished = vi.fn();
		/** 正处于首次错误或退避中的重试 Promise。 */
		const p = retryAssistantCall(produce, policy, controller.signal, { onRetryFinished });
		// Let one error call resolve and the first backoff sleep start, then abort.
		// 等待首次错误完成并进入第一次退避后再中止。
		await vi.waitFor(() => expect(produce).toHaveBeenCalled());
		controller.abort();
		/** 中止退避后归一化得到的助手消息。 */
		const res = await p;
		expect(res.stopReason).toBe("aborted");
		expect(res.errorMessage).toBeUndefined();
		expect(produce).toHaveBeenCalledTimes(1);
		expect(onRetryFinished).toHaveBeenCalledWith(false, 1, "terminated");
	});
});
