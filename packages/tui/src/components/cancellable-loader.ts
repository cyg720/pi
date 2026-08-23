/**
 * 【文件职责】实现可取消的加载组件（CancellableLoader）：在 Loader 之上叠加“按 Escape 取消”能力，
 *              通过 AbortSignal 把取消意图传递给正在进行的异步操作。
 * 【技术维度】继承 Loader；AbortController/AbortSignal 标准中止协议；复用全局快捷键表匹配取消键。
 * 【产品维度】让“加载中”不再只能干等——用户可随时 Esc 中断模型请求等耗时操作，界面立即响应。
 * 【逻辑维度】handleInput 命中 tui.select.cancel 键位 → 触发 abortController.abort() 并回调 onAbort →
 *              业务侧通过 signal 感知中止、dispose 时停止动画。
 * 【关键边界】onAbort 回调可选；abort 只能发生一次（signal 状态不可逆）；销毁务必调用 dispose 清定时器。
 * 【新手阅读建议】半分钟读完：重点看 handleInput 与 signal 的联动方式及使用示例。
 */
import { getKeybindings } from "../keybindings.ts";
import { Loader } from "./loader.ts";

/**
 * Loader that can be cancelled with Escape.
 * Extends Loader with an AbortSignal for cancelling async operations.
 *
 * @example
 * const loader = new CancellableLoader(tui, cyan, dim, "Working...");
 * loader.onAbort = () => done(null);
 * doWork(loader.signal).then(done);
 */
/**
 * CancellableLoader（中文说明）：持有独立的中止控制器；
 * 使用示例见上方 JSDoc——把 signal 传给异步任务、用 onAbort 处理取消后的 UI 收尾。
 */
export class CancellableLoader extends Loader {
	// 内部中止控制器：Escape 触发其 abort
	private abortController = new AbortController();

	/** Called when user presses Escape */
	// 用户按下取消键后的回调（可选）
	onAbort?: () => void;

	/** AbortSignal that is aborted when user presses Escape */
	// 中止信号：传给需要支持取消的异步操作
	get signal(): AbortSignal {
		return this.abortController.signal;
	}

	/** Whether the loader was aborted */
	// 是否已被取消
	get aborted(): boolean {
		return this.abortController.signal.aborted;
	}

	// 处理按键输入：命中全局“选择取消”键位时触发中止并回调
	handleInput(data: string): void {
		const kb = getKeybindings();
		if (kb.matches(data, "tui.select.cancel")) {
			this.abortController.abort();
			this.onAbort?.();
		}
	}

	// 释放资源：停止动画定时器
	dispose(): void {
		this.stop();
	}
}
