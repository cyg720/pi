/**
 * 【文件职责】RFC 8628 设备码轮询流程：按间隔轮询授权状态直至完成/超时/取消，
 *              处理 slow_down 增距与中止信号。
 * 【技术维度】可中止睡眠；状态机（pending/slow_down/failed/complete）。
 * 【产品维度】为设备码类 OAuth（Kimi/xAI/Copilot）提供统一轮询实现。
 * 【逻辑维度】首次轮询延迟（可选）→ 循环：poll → 分支处理（complete/slow_down/
 *              pending/failed）→ 超时/取消退出。
 * 【关键边界】服务端省略 interval 时按 5 秒轮询（RFC 8628 §3.2）；
 *              slow_down 每次增加 5 秒（§3.5）；WSL/VM 时钟漂移会超时报错。
 * 【新手阅读建议】先看 OAuthDeviceCodePollResult 状态联合，再读主轮询循环。
 */
// 取消提示文案
const CANCEL_MESSAGE = "Login cancelled";
const TIMEOUT_MESSAGE = "Device flow timed out";
const SLOW_DOWN_TIMEOUT_MESSAGE =
	"Device flow timed out after one or more slow_down responses. This is often caused by clock drift in WSL or VM environments. Please sync or restart the VM clock and try again.";
const MINIMUM_INTERVAL_MS = 1000;
// 最小轮询间隔
// RFC 8628 section 3.2: if the authorization server omits `interval`, the client must use 5 seconds.
// 默认轮询间隔（秒）：服务端省略 interval 时使用
const DEFAULT_POLL_INTERVAL_SECONDS = 5;
// RFC 8628 section 3.5: `slow_down` means the polling interval must increase by 5 seconds.
const SLOW_DOWN_INTERVAL_INCREMENT_MS = 5000;
// slow_down 的间隔增量（秒）

type OAuthDeviceCodeIncompletePollResult =
	| { status: "pending" }
	| { status: "slow_down"; intervalSeconds?: number }
	| { status: "failed"; message: string };

// 设备码轮询结果（公开）：pending/slow_down/failed/complete
export type OAuthDeviceCodePollResult<T> = OAuthDeviceCodeIncompletePollResult | { status: "complete"; value: T };

/** 轮询选项（中文说明）：intervalSeconds 间隔；expiresInSeconds 超时；
 * waitBeforeFirstPoll 首轮前是否等待；poll 轮询回调；signal 中止信号。 */
export type OAuthDeviceCodePollOptions<T> = {
	intervalSeconds?: number;
	expiresInSeconds?: number;
	waitBeforeFirstPoll?: boolean;
	poll: () => Promise<OAuthDeviceCodePollResult<T>>;
	signal?: AbortSignal;
};

// 可中止睡眠（私有）：中止时以取消文案 reject
function abortableSleep(ms: number, signal: AbortSignal | undefined, cancelMessage: string): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new Error(cancelMessage));
			return;
		}

		const onAbort = () => {
			clearTimeout(timeout);
			reject(new Error(cancelMessage));
		};
		const timeout = setTimeout(() => {
			signal?.removeEventListener("abort", onAbort);
			resolve();
		}, ms);

		signal?.addEventListener("abort", onAbort, { once: true });
	});
}

export async function pollOAuthDeviceCodeFlow<T>(options: OAuthDeviceCodePollOptions<T>): Promise<T> {
	const deadline =
		typeof options.expiresInSeconds === "number"
			? Date.now() + options.expiresInSeconds * 1000
			: Number.POSITIVE_INFINITY;
	let intervalMs = Math.max(
		MINIMUM_INTERVAL_MS,
		Math.floor((options.intervalSeconds ?? DEFAULT_POLL_INTERVAL_SECONDS) * 1000),
	);

	let slowDownResponses = 0;
	if (options.waitBeforeFirstPoll) {
		const remainingMs = deadline - Date.now();
		if (remainingMs > 0) {
			await abortableSleep(Math.min(intervalMs, remainingMs), options.signal, CANCEL_MESSAGE);
		}
	}

	while (Date.now() < deadline) {
		if (options.signal?.aborted) {
			throw new Error(CANCEL_MESSAGE);
		}

		const result = await options.poll();
		if (result.status === "complete") {
			return result.value;
		}
		if (result.status === "failed") {
			throw new Error(result.message);
		}
		if (result.status === "slow_down") {
			slowDownResponses += 1;
			// Use the server-provided interval when given (GitHub reports the new required minimum
			// in `interval`); trusting only a client-tracked value risks polling early forever under
			// WSL/VM clock drift. Otherwise apply RFC 8628 section 3.5: increase by 5 seconds.
			intervalMs =
				typeof result.intervalSeconds === "number" &&
				Number.isFinite(result.intervalSeconds) &&
				result.intervalSeconds > 0
					? Math.max(MINIMUM_INTERVAL_MS, Math.floor(result.intervalSeconds * 1000))
					: Math.max(MINIMUM_INTERVAL_MS, intervalMs + SLOW_DOWN_INTERVAL_INCREMENT_MS);
		}

		const remainingMs = deadline - Date.now();
		if (remainingMs <= 0) {
			break;
		}

		await abortableSleep(Math.min(intervalMs, remainingMs), options.signal, CANCEL_MESSAGE);
	}

	throw new Error(slowDownResponses > 0 ? SLOW_DOWN_TIMEOUT_MESSAGE : TIMEOUT_MESSAGE);
}
