/**
 * 【文件职责】实现 Emacs 风格的“kill 环”（环形剪切板）：记录被删除（kill）的文本片段，
 *              支持连续删除合并、yank 粘贴最近一条与 yank-pop 轮换更早条目。
 * 【技术维度】数组模拟环形队列；push/pop/unshift 组合实现轮换语义。
 * 【产品维度】让终端编辑器拥有与 Emacs 一致的高级剪贴体验：多次 Ctrl+W 删除的内容可依次找回。
 * 【逻辑维度】push（可累积合并）→ peek 查看队首 → rotate 把末尾条目转到最前 → length 长度。
 * 【关键边界】空文本入栈被忽略；accumulate 只与最近一条合并，prepend 决定拼接方向（向后删=前拼）；
 *              本实现不设环大小上限，调用方自行控制。
 * 【新手阅读建议】半分钟读完：对照 push/peek/rotate 三个方法理解 yank/yank-pop 的数据基础。
 */
/**
 * Ring buffer for Emacs-style kill/yank operations.
 *
 * Tracks killed (deleted) text entries. Consecutive kills can accumulate
 * into a single entry. Supports yank (paste most recent) and yank-pop
 * (cycle through older entries).
 */
/**
 * Kill 环（中文说明）：ring 数组按时间顺序存放被删除文本，末尾为最新。
 */
export class KillRing {
	// 环形缓冲：越靠后越新
	private ring: string[] = [];

	/**
	 * Add text to the kill ring.
	 *
	 * @param text - The killed text to add
	 * @param opts - Push options
	 * @param opts.prepend - If accumulating, prepend (backward deletion) or append (forward deletion)
	 * @param opts.accumulate - Merge with the most recent entry instead of creating a new one
	 */
	// 入环（中文说明）：text 为被删除文本；opts.prepend 表示删除方向向前时新文本拼在前面；
	// opts.accumulate 为 true 时与最近条目合并而非新建。空文本直接忽略。
	push(text: string, opts: { prepend: boolean; accumulate?: boolean }): void {
		if (!text) return;

		if (opts.accumulate && this.ring.length > 0) {
			// 弹出最近条目并按方向拼接后压回
			const last = this.ring.pop()!;
			this.ring.push(opts.prepend ? text + last : last + text);
		} else {
			this.ring.push(text);
		}
	}

	/** Get most recent entry without modifying the ring. */
	// 查看最新条目但不修改环；空环返回 undefined
	peek(): string | undefined {
		return this.ring.length > 0 ? this.ring[this.ring.length - 1] : undefined;
	}

	/** Move last entry to front (for yank-pop cycling). */
	// 轮换（yank-pop 用）：把最新条目移到最前，使下一次 yank 取到次新的内容
	rotate(): void {
		if (this.ring.length > 1) {
			const last = this.ring.pop()!;
			this.ring.unshift(last);
		}
	}

	// 当前条目数量
	get length(): number {
		return this.ring.length;
	}
}
