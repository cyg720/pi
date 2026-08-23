/**
 * 【文件职责】供应商请求重试（SDK 层）：复刻 OpenAI/Anthropic SDK 内置的重试行为，
 *              但把退避睡眠改为可中止；同时支持服务端 retry-after 与指数退避抖动。
 * 【技术维度】可重试判定（x-should-retry 头 + 408/409/429/5xx）；retry-after-ms/
 *              retry-after 解析；指数退避（0.5s 起、上限 8s、±25% 抖动）；AbortSignal 中断。
 * 【产品维度】在保留 SDK 级重试语义的同时让取消即时生效，避免退避期间无法中止的卡顿。
 * 【逻辑维度】isProviderError 类型守卫 → isRetryableProviderError 判定 →
 *              getRetryDelayMs 计算延迟 → abortableSleep 可中止睡眠 → retryProviderRequest 主循环。
 * 【关键边界】服务端请求的延迟超过 maxRetryDelayMs（默认 60s）时立即失败（0 关闭上限）；
 *              每次重试都是全新 SDK 请求，因此 X-Stainless-Retry-Count 保持为 0。
 * 【新手阅读建议】先读 isRetryableProviderError 的判定表 → 再看 getRetryDelayMs 三路径 →
 *              最后看主循环。
 */

// 默认的服务端重试延迟上限（毫秒）
const DEFAULT_MAX_RETRY_DELAY_MS = 60_000;

// 重试选项（内部）：maxRetries 重试次数；maxRetryDelayMs 服务端延迟上限；signal 中止信号
interface ProviderRetryOptions {
	maxRetries?: number;
	maxRetryDelayMs?: number;
	signal?: AbortSignal;
}

// 带状态/头的供应商错误形态
interface ProviderError extends Error {
	status: number | undefined;
	headers: Headers | undefined;
}

// 类型守卫：是否带 status/headers 的供应商错误
function isProviderError(error: unknown): error is ProviderError {
	if (!(error instanceof Error) || !("status" in error) || !("headers" in error)) return false;
	return (
		(error.status === undefined || typeof error.status === "number") &&
		(error.headers === undefined || error.headers instanceof Headers)
	);
}

/** Mirrors the pinned OpenAI/Anthropic SDK retry policy; review when either SDK is upgraded. */
// 可重试判定（私有）：x-should-retry 头优先；否则 408/409/429/5xx 视为可重试；
// 状态缺失视为可重试。注：镜像 OpenAI/Anthropic SDK 的既定策略，升级 SDK 时需复核。
function isRetryableProviderError(error: ProviderError): boolean {
	const shouldRetry = error.headers?.get("x-should-retry");
	if (shouldRetry === "true") return true;
	if (shouldRetry === "false") return false;

	if (error.status === undefined) return true;
	return (
		error.status === 408 ||
		error.status === 409 ||
		error.status === 429 ||
		(typeof error.status === "number" && error.status >= 500)
	);
}

// 校验服务端请求的延迟（私有）：超过上限立即抛错（携带请求延迟供上层处理）
function validateServerRetryDelayMs(
	delayMs: number,
	maxRetryDelayMs: number | undefined,
	providerErrorMessage: string,
): number {
	const maxDelayMs = maxRetryDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS;
	if (maxDelayMs > 0 && delayMs > maxDelayMs) {
		throw new Error(
			`Server requested ${Math.ceil(delayMs / 1000)}s retry delay (max: ${Math.ceil(maxDelayMs / 1000)}s). ${providerErrorMessage}`,
		);
	}
	return delayMs;
}

// 计算重试延迟（私有）：优先 retry-after-ms；其次 retry-after（秒或 HTTP 日期）；
// 否则指数退避 0.5*2^n 秒（上限 8s）并加 ±25% 抖动
function getRetryDelayMs(error: ProviderError, retryIndex: number, maxRetryDelayMs: number | undefined): number {
	const retryAfterMs = error.headers?.get("retry-after-ms");
	if (retryAfterMs) {
		const value = Number.parseFloat(retryAfterMs);
		if (!Number.isNaN(value)) return validateServerRetryDelayMs(value, maxRetryDelayMs, error.message);
	}

	const retryAfter = error.headers?.get("retry-after");
	if (retryAfter) {
		const seconds = Number.parseFloat(retryAfter);
		const delayMs = Number.isNaN(seconds) ? Date.parse(retryAfter) - Date.now() : seconds * 1000;
		return validateServerRetryDelayMs(delayMs, maxRetryDelayMs, error.message);
	}

	const exponentialDelay = Math.min(0.5 * 2 ** retryIndex, 8) * 1000;
	return exponentialDelay * (1 - Math.random() * 0.25);
}

// 构造标准 AbortError（私有）
function createAbortError(): Error {
	const error = new Error("Request aborted");
	error.name = "AbortError";
	return error;
}

// 可中止的睡眠（私有）：signal 中止时以 AbortError reject
function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(createAbortError());
			return;
		}

		const onAbort = () => {
			clearTimeout(timeout);
			reject(createAbortError());
		};
		const timeout = setTimeout(
			() => {
				signal?.removeEventListener("abort", onAbort);
				resolve();
			},
			Math.max(0, ms),
		);
		signal?.addEventListener("abort", onAbort, { once: true });
	});
}

/**
 * 供应商请求重试（公开）：复刻 OpenAI/Anthropic SDK 重试行为但退避可中止——
 * 其内置重试计时器忽略请求 AbortSignal，因此调用方需以 maxRetries:0 调用 SDK 并用本函数包裹。
 * 服务端请求的延迟超过 maxRetryDelayMs（默认 60s）立即失败；设 0 关闭上限。
 */
export async function retryProviderRequest<T>(
	request: () => Promise<T>,
	options: ProviderRetryOptions = {},
): Promise<T> {
	const maxRetries = options.maxRetries ?? 0;
	let retriesRemaining = maxRetries;

	for (;;) {
		try {
			// Each retry is a fresh SDK request, so X-Stainless-Retry-Count remains zero.
			// 每次重试都是全新 SDK 请求，X-Stainless-Retry-Count 保持为零
			return await request();
		} catch (error) {
			if (options.signal?.aborted) throw createAbortError();
			if (retriesRemaining <= 0 || !isProviderError(error) || !isRetryableProviderError(error)) throw error;

			const retryIndex = maxRetries - retriesRemaining;
			retriesRemaining--;
			await abortableSleep(getRetryDelayMs(error, retryIndex, options.maxRetryDelayMs), options.signal);
		}
	}
}
