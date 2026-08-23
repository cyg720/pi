/**
 * 【文件职责】实现 TruncatedText 单行文本组件：只取文本第一行并按可用宽度截断（带省略号），
 *              支持水平/垂直内边距，输出恒为固定行高的整行内容。
 * 【技术维度】实现 Component 接口；truncateToWidth 处理 ANSI 与宽字符的正确截断；无缓存。
 * 【产品维度】用于状态栏、标题、列表行等“只显示一行”的场景：超长内容优雅省略而不破坏布局。
 * 【逻辑维度】render：上下垂直边距空行 → 取首行 → 截断到可用宽度 → 加左右内边距并补齐整行 → 输出。
 * 【关键边界】多行文本仅显示第一行；可用宽度至少 1；默认无内边距；每次渲染都重新计算（无缓存）。
 * 【新手阅读建议】半分钟读完：对照 render 的六步流程即可掌握全部逻辑。
 */
import type { Component } from "../tui.ts";
import { truncateToWidth, visibleWidth } from "../utils.ts";

/**
 * Text component that truncates to fit viewport width
 */
/**
 * TruncatedText 组件（中文说明）：持有单行文本与内边距配置，按视口宽度截断展示。
 */
export class TruncatedText implements Component {
	// 待显示的原始文本（可能含多行，但只取第一行）
	private text: string;
	// 水平内边距（列数）
	private paddingX: number;
	// 垂直内边距（行数）
	private paddingY: number;

	// 构造函数：默认无边距
	constructor(text: string, paddingX: number = 0, paddingY: number = 0) {
		this.text = text;
		this.paddingX = paddingX;
		this.paddingY = paddingY;
	}

	invalidate(): void {
		// No cached state to invalidate currently
		// 当前没有需要失效的缓存状态
	}

	// 渲染：输出“上边距 + 截断后的单行 + 下边距”的行数组
	render(width: number): string[] {
		const result: string[] = [];

		// Empty line padded to width
		// 等宽空行（供垂直边距使用）
		const emptyLine = " ".repeat(width);

		// Add vertical padding above
		// 上方垂直边距
		for (let i = 0; i < this.paddingY; i++) {
			result.push(emptyLine);
		}

		// Calculate available width after horizontal padding
		// 扣除左右内边距后的可用宽度（至少 1 列）
		const availableWidth = Math.max(1, width - this.paddingX * 2);

		// Take only the first line (stop at newline)
		// 只保留第一个换行符之前的内容
		let singleLineText = this.text;
		const newlineIndex = this.text.indexOf("\n");
		if (newlineIndex !== -1) {
			singleLineText = this.text.substring(0, newlineIndex);
		}

		// Truncate text if needed (accounting for ANSI codes)
		// 按可见宽度截断（正确处理 ANSI 序列不计宽）
		const displayText = truncateToWidth(singleLineText, availableWidth);

		// Add horizontal padding
		// 拼接左右内边距
		const leftPadding = " ".repeat(this.paddingX);
		const rightPadding = " ".repeat(this.paddingX);
		const lineWithPadding = leftPadding + displayText + rightPadding;

		// Pad line to exactly width characters
		// 补空格使该行可见宽度恰为 width
		const lineVisibleWidth = visibleWidth(lineWithPadding);
		const paddingNeeded = Math.max(0, width - lineVisibleWidth);
		const finalLine = lineWithPadding + " ".repeat(paddingNeeded);

		result.push(finalLine);

		// Add vertical padding below
		// 下方垂直边距
		for (let i = 0; i < this.paddingY; i++) {
			result.push(emptyLine);
		}

		return result;
	}
}
