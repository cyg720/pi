import type { AssistantMessage } from "../types.ts";

function buildProviderErrorPattern(patterns: readonly string[]): RegExp {
	return new RegExp(patterns.join("|"), "i");
}

/**
 * 【文件职责】带预算的重试机制：为"产生助手消息的调用"提供指数退避重试，
 *              并区分可重试的瞬态错误与不可重试的配额/计费错误。
 * 【技术维度】错误文案模式分类（可重试/不可重试两张正则表）；指数退避（base*2^(n-1)）；
 *              重试阶段回调（schedule/start/finished）；退避期间中止归一化为 aborted 消息。
 * 【产品维度】让网络抖动/上游过载自动重试成功，同时让配额耗尽等确定性错误快速失败，
 *              避免无谓等待与费用风险。
 * 【逻辑维度】模式表 → RetryPolicy/RetryCallbacks 契约 → 退避 sleep → retryAssistantCall
 *              主循环（成功/中止/不可重试/预算耗尽即返回）→ isRetryableAssistantError 分类器。
 * 【关键边界】首次调用不计入重试；aborted 永不复试；退避期间中止统一转 aborted 消息；
 *              分类器只做判断不实现策略（策略由调用方/上层负责）。
 * 【新手阅读建议】先读 RetryPolicy 与 RetryCallbacks → 再读 retryAssistantCall 主循环 →
 *              最后看两个错误模式表理解可重试边界。
 */
// 不可重试的额度/计费错误模式：OpenCode Go 免费额度限制、订阅额度耗尽、
// 通用配额/预算/计费耗尽（如 OpenAI 的 insufficient_quota）
const NON_RETRYABLE_PROVIDER_LIMIT_ERROR_PATTERN = buildProviderErrorPattern([
	// OpenCode Go/free-tier limits returned as 429 JSON error types by OpenCode's
	// Zen API. These are subscription/account limits, not transient throttles.
	"GoUsageLimitError",
	"FreeUsageLimitError",

	// OpenCode Go subscription-limit text asks users to enable available-balance
	// usage after rolling/weekly/monthly limits are reached.
	"Monthly usage limit reached",
	"available balance",

	// Generic quota/budget/billing exhaustion. `insufficient_quota` is OpenAI's
	// quota/billing error code; the other strings cover common gateway wording.
	"insufficient_quota",
	"out of budget",
	"quota exceeded",
	"billing",
]);

// 可重试的瞬态错误模式：过载/限流/5xx/服务不可用/网络与连接失败/传输超时/
// WebSocket 关闭/流提前结束/供应商明示可重试/资源耗尽（gRPC）
const RETRYABLE_PROVIDER_ERROR_PATTERN = buildProviderErrorPattern([
	// Generic provider load, HTTP status, and server-side transient failures.
	"overloaded",
	"rate.?limit",
	"too many requests",
	"429",
	"500",
	"502",
	"503",
	"504",
	"524",
	"service.?unavailable",
	"server.?error",
	"internal.?error",

	// Wrapper/provider text for transient upstream failures, including OpenRouter
	// "Provider returned error" responses (#2264).
	"provider.?returned.?error",

	// Network, proxy, and fetch transport failures. This includes OpenAI Codex
	// raw-fetch failures such as "upstream connect", "connection refused", and
	// "reset before headers" (#733), plus OpenRouter connection drops (#3317).
	"network.?error",
	"connection.?error",
	"connection.?refused",
	"connection.?lost",
	"other side closed",
	"fetch failed",
	"getaddrinfo",
	"ENOTFOUND",
	"EAI_AGAIN",
	"upstream.?connect",
	"reset before headers",
	"socket hang up",
	"socket connection was closed",
	"timed? out",
	"timeout",
	"terminated",

	// WebSocket transports can report close/error text instead of HTTP/fetch text.
	"websocket.?closed",
	"websocket.?error",

	// Premature stream endings from SDKs and transports. Anthropic can throw
	// "stream ended without ..." and "Anthropic stream ended before message_stop"
	// (#4433); Bedrock/Smithy can throw an HTTP/2 no-response error (#3594).
	"ended without",
	"stream ended before message_stop",
	"stream ended before a terminal response event",
	"http2 request did not get a response",

	// Provider-requested retry delay cap failures should flow through the outer
	// retry policy so callers can surface/abort the backoff (#1123).
	"retry delay",

	// Explicit retry guidance emitted mid-stream by OpenAI Responses and Bedrock
	// stream exceptions (#6019).
	"you can retry your request",
	"try your request again",
	"please retry your request",

	// gRPC based providers (e.g. NVIDIA NIM)
	"ResourceExhausted",
]);

/**
 * Retry policy: bounded attempts with exponential backoff (`baseDelayMs * 2^(attempt-1)`).
 * Matches `settings.retry` (`enabled`, `maxRetries`, `baseDelayMs`) in coding-agent; kept
 * here so the classifier and the policy-driven retry loop live together and stay reusable
 * by the SDK and other callers.
 */
/**
 * 重试策略（中文说明）：enabled 开关；maxRetries 最大重试次数（0=不重试，首次调用不计）；
 * baseDelayMs 基础延迟（每次尝试为 baseDelayMs * 2^(attempt-1)，含抖动前）。
 */
export interface RetryPolicy {
	enabled: boolean;
	// 是否启用重试
	/** Max retry attempts (0 = no retries). The initial call never counts as a retry. */
	maxRetries: number;
	// 最大重试次数（0 = 不重试；首次调用不计入重试）
	/** Base delay in ms. Per-attempt delay is `baseDelayMs * 2^(attempt-1)` before jitter. */
	baseDelayMs: number;
	// 基础延迟毫秒数（每次尝试前乘 2 的幂）
}

/** Optional callbacks emitted by {@link retryAssistantCall} around each retry. */
/** 重试回调（中文说明）：围绕每次重试发出的三个生命周期事件。 */
export interface RetryCallbacks {
	/** Emitted before the backoff sleep of each retry attempt (1-indexed). */
	onRetryScheduled?: (
	// 每次重试的退避睡眠前触发（attempt 从 1 起）
		attempt: number,
		maxAttempts: number,
		delayMs: number,
		errorMessage: string,
	) => void | Promise<void>;
	/** Emitted after the backoff sleep, immediately before the retried call starts. */
	onRetryAttemptStart?: () => void | Promise<void>;
	// 退避结束后、重试调用开始前触发
	/** Emitted once when the loop ends: success if a later call completed normally. */
	onRetryFinished?: (success: boolean, attempt: number, finalError?: string) => void | Promise<void>;
	// 循环结束时触发一次：成功（后续调用正常完成）或失败（含最终错误）
}

// 退避睡眠被中止时的内部错误标记（私有）
class RetrySleepAbortError extends Error {
	constructor() {
		super("Aborted");
	}
}

// 可中止的睡眠（私有）：signal 中止时 reject（用于归一化退避期间取消）
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new RetrySleepAbortError());
			return;
		}
		const timeout = setTimeout(resolve, ms);
		signal?.addEventListener(
			"abort",
			() => {
				clearTimeout(timeout);
				reject(new RetrySleepAbortError());
			},
			{ once: true },
		);
	});
}

/**
 * Run a single assistant-producing call with bounded retry on transient errors.
 *
 * Behavior:
 * - A successful response is returned immediately. Aborts are terminal and never
 *   retried, but reported as unsuccessful if they happen after a retry was scheduled.
 *   Aborts during the backoff sleep are normalized to an aborted `AssistantMessage`
 *   too, so callers do not need to care when cancellation happened.
 * - A non-retryable error (per {@link isRetryableAssistantError}, including quota/
 *   billing exhaustion) is returned immediately so deterministic errors fail fast.
 * - Otherwise retries up to `maxRetries` times with exponential backoff, emitting
 *   `onRetryScheduled` before each sleep, `onRetryAttemptStart` after each sleep before
 *   the retried call starts, and `onRetryFinished` once at the end (whether the loop
 *   ends in success, exhausted retries, or an aborted backoff).
 *
 * When `policy` is undefined or disabled, the first response is returned unchanged
 * (equivalent to calling `produce()` directly).
 */
/**
 * 带预算的重试调用（公开）：成功立即返回；aborted 终态不复试；
 * 不可重试错误（含配额耗尽）立即返回；否则按策略指数退避重试，
 * 全程经回调上报。policy 缺失或禁用时等价于直接调用 produce()。
 */
export async function retryAssistantCall(
	produce: () => Promise<AssistantMessage>,
	policy: RetryPolicy | undefined,
	signal: AbortSignal | undefined,
	callbacks?: RetryCallbacks,
): Promise<AssistantMessage> {
	const maxAttempts = policy?.enabled ? policy.maxRetries : 0;

	let attempt = 0;
	let lastRetry: { attempt: number; errorMessage: string } | undefined;
	for (;;) {
		const response = await produce();

		// Abort: terminal but not successful. Never retry an aborted message.
	// 中止：终态且不算成功；永不重试已中止的消息
		if (response.stopReason === "aborted") {
			if (lastRetry) await callbacks?.onRetryFinished?.(false, lastRetry.attempt);
			return response;
		}

		// Success: non-error, non-abort responses return as-is.
	// 成功：非错误、非中止的响应原样返回
		if (response.stopReason !== "error") {
			if (lastRetry) await callbacks?.onRetryFinished?.(true, lastRetry.attempt);
			return response;
		}

		// Non-retryable, or budget exhausted: return the final error message.
	// 不可重试或预算耗尽：直接返回最终错误消息
		if (attempt >= maxAttempts || !isRetryableAssistantError(response)) {
			if (lastRetry) await callbacks?.onRetryFinished?.(false, lastRetry.attempt, response.errorMessage);
			return response;
		}

		attempt++;
		lastRetry = { attempt, errorMessage: response.errorMessage || "Unknown error" };
		const delayMs = policy!.baseDelayMs * 2 ** (attempt - 1);
		await callbacks?.onRetryScheduled?.(attempt, maxAttempts, delayMs, lastRetry.errorMessage);

		// Normalize aborts during retry backoff to the same AssistantMessage shape as
		// 退避期间的中止归一化为与流中止一致的 AssistantMessage 形态，
		// 调用方无需关心取消发生在哪个阶段
		// provider stream aborts, so callers do not need to care when cancellation happened.
		try {
			await sleep(delayMs, signal);
		} catch (error) {
			await callbacks?.onRetryFinished?.(false, attempt, lastRetry.errorMessage);
			if (error instanceof RetrySleepAbortError) {
				return { ...response, stopReason: "aborted", errorMessage: undefined };
			}
			throw error;
		}
		await callbacks?.onRetryAttemptStart?.();
	}
}

/**
 * Classifies whether a failed assistant message looks like a transient provider
 * or transport error, so callers can decide if the last assistant turn should be
 * restarted.
 *
 * This does not implement retry policy. Callers should first handle context
 * overflow separately, then apply their own retry budget, backoff, and reporting
 * before restarting the assistant turn.
 */
/**
 * 分类助手消息是否为可重试瞬态错误（公开）：仅做判断不实现策略——
 * 调用方应先处理上下文溢出，再应用自己的重试预算/退避/上报。
 */
export function isRetryableAssistantError(message: AssistantMessage): boolean {
	if (message.stopReason !== "error" || !message.errorMessage) return false;
	const errorMessage = message.errorMessage;
	if (NON_RETRYABLE_PROVIDER_LIMIT_ERROR_PATTERN.test(errorMessage)) return false;
	// 命中不可重试模式直接判否
	return RETRYABLE_PROVIDER_ERROR_PATTERN.test(errorMessage);
	// 命中可重试模式判是
}
