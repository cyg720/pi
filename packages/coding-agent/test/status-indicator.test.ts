/**
 * 文件职责：验证空闲状态占位高度和重试倒计时组件释放定时更新的行为。
 * 技术维度：使用 Vitest 假定时器、TUI 测试替身和真实状态组件渲染方法。
 * 产品维度：防止状态切换时界面跳动，并避免已销毁组件继续请求重绘造成资源泄漏。
 * 逻辑维度：每例后恢复真实定时器；分别断言空闲两行输出与 dispose 后调用数不再增加。
 * 关键边界：TUI 仅提供 requestRender 最小替身；不验证终端实际颜色和动画观感。
 * 新手阅读建议：先看 afterEach 的隔离作用，再分别理解布局测试和生命周期测试。
 */
import type { TUI } from "@earendil-works/pi-tui";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IdleStatus, RetryStatusIndicator } from "../src/modes/interactive/components/status-indicator.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";

/** 状态指示器测试组。 */
describe("status indicators", () => {
	/** 每个用例结束后恢复真实定时器，避免假时钟影响其他测试。 */
	afterEach(() => {
		vi.useRealTimers();
	});

	/** 验证空闲组件也渲染两行，和活动状态组件切换时高度一致。 */
	it("keeps idle status at the same height as status indicators", () => {
		/** 无动画的空闲状态组件。 */
		const idleStatus = new IdleStatus();

		/** 在 20 列宽度下渲染的占位行；应为两行各 20 个空格。 */
		const lines = idleStatus.render(20);
		expect(lines).toHaveLength(2);
		expect(lines).toEqual([" ".repeat(20), " ".repeat(20)]);
	});

	/** 验证释放重试指示器后，倒计时定时器不再请求 TUI 重绘。 */
	it("disposes retry countdown updates", () => {
		initTheme("dark");
		vi.useFakeTimers();
		/** 记录重绘请求次数的模拟函数。 */
		const requestRender = vi.fn();
		/** 只实现 requestRender 的最小 TUI 替身；unknown 中转限定在测试中。 */
		const tui = { requestRender } as unknown as TUI;
		/** 第 1/3 次重试、总等待 1000 毫秒的倒计时组件。 */
		const indicator = new RetryStatusIndicator(tui, 1, 3, 1000);
		/** dispose 前已发生的重绘次数，作为后续不增长断言的基准。 */
		const callsBeforeDispose = requestRender.mock.calls.length;

		indicator.dispose();
		vi.advanceTimersByTime(2000);

		expect(requestRender).toHaveBeenCalledTimes(callsBeforeDispose);
	});
});
