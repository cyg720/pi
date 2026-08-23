/**
 * 【文件职责】通用撤销栈（clone-on-push 语义）：为编辑器等组件提供“入栈即深拷贝、出栈直接返回”的
 *              历史快照管理能力。
 * 【技术维度】泛型类 + structuredClone 深拷贝；数组实现 LIFO 栈。
 * 【产品维度】支撑 Ctrl+Z 撤销体验：每次修改前压入快照，撤销时弹出恢复，深拷贝保证各版本互不影响。
 * 【逻辑维度】push 深克隆入栈 → pop 弹出最新快照 → clear 清空 → length 只读长度。
 * 【关键边界】pop 出来的对象已是独立副本，可直接使用但不要再放回；大状态频繁 structuredClone 有性能成本。
 * 【新手阅读建议】半分钟读完：记住“push 存的是克隆、pop 给的是原件”这一所有权约定即可。
 */
/**
 * Generic undo stack with clone-on-push semantics.
 *
 * Stores deep clones of state snapshots. Popped snapshots are returned
 * directly (no re-cloning) since they are already detached.
 */
/**
 * 撤销栈（中文说明）：泛型 S 为快照状态类型。
 */
export class UndoStack<S> {
	// 快照栈：越靠后越新
	private stack: S[] = [];

	/** Push a deep clone of the given state onto the stack. */
	// 入栈：存入 state 的深拷贝，与外部对象彻底隔离
	push(state: S): void {
		this.stack.push(structuredClone(state));
	}

	/** Pop and return the most recent snapshot, or undefined if empty. */
	// 出栈：返回最近快照（本身已脱离原引用，无需再克隆）；空栈返回 undefined
	pop(): S | undefined {
		return this.stack.pop();
	}

	/** Remove all snapshots. */
	// 清空全部快照
	clear(): void {
		this.stack.length = 0;
	}

	// 当前快照数量
	get length(): number {
		return this.stack.length;
	}
}
