import { type FSWatcher, type WatchListener, watch } from "node:fs";

/**
 * 【文件职责】文件监视：递归/非递归监视目录变化并节流回调。
 * 【产品维度】配置/资源热更新。
 * 【新手阅读建议】看监视与去抖。
 */
export const FS_WATCH_RETRY_DELAY_MS = 5000;

export function closeWatcher(watcher: FSWatcher | null | undefined): void {
	if (!watcher) {
		return;
	}

	try {
		watcher.close();
	} catch {
		// Ignore watcher close errors
	}
}

export function watchWithErrorHandler(
	path: string,
	listener: WatchListener<string>,
	onError: () => void,
): FSWatcher | null {
	try {
		const watcher = watch(path, listener);
		watcher.on("error", onError);
		return watcher;
	} catch {
		onError();
		return null;
	}
}
