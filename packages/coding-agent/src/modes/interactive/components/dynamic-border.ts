/**
 * 文件职责：实现一个始终适配当前视口宽度的单行动态边框组件。
 * 技术维度：遵循 pi-tui Component 接口，通过可注入颜色函数和字符串 repeat 生成渲染结果。
 * 产品维度：为交互界面的对话框或区块提供随终端尺寸变化的统一视觉分隔线。
 * 逻辑维度：构造时保存着色函数，invalidate 无缓存可清理，render 按宽度生成至少一个横线字符。
 * 关键边界：扩展经 jiti 加载时全局 theme 可能不可用，调用方应显式传入颜色函数；宽度最小按 1 处理。
 * 新手阅读建议：先看 Component 对 render 的约定，再理解为什么构造函数允许替换默认主题函数。
 */
import type { Component } from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.ts";

/**
 * Dynamic border component that adjusts to viewport width.
 *
 * Note: When used from extensions loaded via jiti, the global `theme` may be undefined
 * because jiti creates a separate module cache. Always pass an explicit color
 * function when using DynamicBorder in components exported for extension use.
 */
/**
 * 动态边框组件：按渲染宽度生成横线，可用于主程序或扩展中的视觉分隔。
 * 扩展场景应传入明确的着色函数，避免独立模块缓存导致默认主题不可用。
 */
export class DynamicBorder implements Component {
	/** 文本着色函数；输入和输出均为字符串，实例生命周期内保持可调用。 */
	private color: (str: string) => string;

	/**
	 * 创建动态边框。
	 * @param color 可选着色函数；省略时使用当前主题的 border 前景色。
	 * @example `new DynamicBorder((text) => text)` 创建无颜色处理的边框。
	 */
	constructor(color: (str: string) => string = (str) => theme.fg("border", str)) {
		this.color = color;
	}

	/**
	 * 通知组件状态失效。
	 * @returns 无返回值；当前组件没有缓存，因此无需执行操作。
	 * @example `border.invalidate()`。
	 */
	invalidate(): void {
		// No cached state to invalidate currently
		// 当前没有需要失效的缓存状态。
	}

	/**
	 * 按可用宽度渲染一行边框。
	 * @param width 视口提供的列宽；小于 1 时仍输出一个横线字符。
	 * @returns 仅含一行着色边框的字符串数组。
	 * @example `border.render(3)` 生成长度为 3 的边框行。
	 */
	render(width: number): string[] {
		return [this.color("─".repeat(Math.max(1, width)))];
	}
}
