/**
 * Sleep helper that respects abort signal.
 */
/**
 * 【文件职责】睡眠/延迟工具（可中止）。
 * 【新手阅读建议】半分钟读完。
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new Error("Aborted"));
			return;
		}

		const timeout = setTimeout(resolve, ms);

		signal?.addEventListener("abort", () => {
			clearTimeout(timeout);
			reject(new Error("Aborted"));
		});
	});
}
