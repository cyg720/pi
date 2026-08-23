/**
 * 【文件职责】多中止信号的合并：把多个可选中止信号聚合为一个信号，任一源中止即中止，
 *              并返回清理函数移除监听。
 * 【技术维度】AbortController 桥接；监听器管理（once + 显式移除）。
 * 【产品维度】让嵌套请求（上层信号 + 内部超时信号等）以单一信号向下传播，简化取消语义。
 * 【逻辑维度】过滤有效信号 → 0/1 个直接短路 → 多个时建控制器并桥接 abort（透传 reason）→
 *              清理时移除全部监听。
 * 【关键边界】任一源已中止则立即中止（透传其 reason）；cleanup 必须调用以防监听泄漏。
 * 【新手阅读建议】半分钟读完：记住“合并后必须调用 cleanup”即可。
 */
export interface CombinedAbortSignal {
	// 合并后的信号（无有效源时 undefined）
	signal?: AbortSignal;
	// 清理函数：移除全部监听
	cleanup: () => void;
}

// 合并中止信号（公开）：signals 中任一中止 → 合并信号中止
export function combineAbortSignals(signals: readonly (AbortSignal | undefined)[]): CombinedAbortSignal {
	// 过滤掉 undefined
	const activeSignals = signals.filter((signal): signal is AbortSignal => signal !== undefined);
	if (activeSignals.length === 0) {
		// 无有效源：空操作
		return { cleanup: () => {} };
	}
	if (activeSignals.length === 1) {
		// 单源：直接复用
		return { signal: activeSignals[0], cleanup: () => {} };
	}

	const controller = new AbortController();
	const listeners: Array<{ signal: AbortSignal; listener: () => void }> = [];
	const abort = (signal: AbortSignal) => {
		if (!controller.signal.aborted) {
			controller.abort(signal.reason);
		}
	};

	for (const signal of activeSignals) {
		if (signal.aborted) {
			abort(signal);
			break;
		}
		const listener = () => abort(signal);
		signal.addEventListener("abort", listener, { once: true });
		listeners.push({ signal, listener });
	}

	return {
		signal: controller.signal,
		cleanup: () => {
			for (const { signal, listener } of listeners) {
				signal.removeEventListener("abort", listener);
			}
		},
	};
}
