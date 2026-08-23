/**
 * 【文件职责】实现 Text 文本组件：把多行文本按宽度自动折行渲染，支持水平/垂直内边距与自定义背景色。
 * 【技术维度】实现 Component 接口；wrapTextWithAnsi 保留 ANSI 样式折行；三元组缓存（文本+宽度+结果）
 *              避免重复计算。
 * 【产品维度】是助手消息、说明文字等内容展示的基础组件，保证彩色文本与宽字符正确换行对齐。
 * 【逻辑维度】render：命中缓存直接返回 → 空文本返回空 → tab 归一化 → 折行 → 加左右边距 →
 *              应用背景或补空格到整行 → 拼上下垂直边距 → 更新缓存。
 * 【关键边界】内容宽度至少为 1；纯空白文本不渲染任何行；无背景时也补空格到整行宽（便于覆盖层合成）。
 * 【新手阅读建议】先看三个缓存字段理解失效策略 → 再通读 render 的七步流程。
 */
import type { Component } from "../tui.ts";
import { applyBackgroundToLine, visibleWidth, wrapTextWithAnsi } from "../utils.ts";

/**
 * Text component - displays multi-line text with word wrapping
 */
/**
 * Text 组件（中文说明）：持有文本、内边距与可选背景函数，按需渲染带样式的多行文本。
 */
export class Text implements Component {
	// 当前文本内容
	private text: string;
	private paddingX: number; // Left/right padding
	// 左右内边距（列数）
	private paddingY: number; // Top/bottom padding
	// 上下内边距（行数）
	private customBgFn?: (text: string) => string;

	// Cache for rendered output
	// 渲染结果缓存：文本、宽度与输出行三者一致才命中
	private cachedText?: string;
	private cachedWidth?: number;
	private cachedLines?: string[];

	// 构造函数：默认各 1 列/1 行内边距，无背景
	constructor(text: string = "", paddingX: number = 1, paddingY: number = 1, customBgFn?: (text: string) => string) {
		this.text = text;
		this.paddingX = paddingX;
		this.paddingY = paddingY;
		this.customBgFn = customBgFn;
	}

	// 更新文本并使缓存失效
	setText(text: string): void {
		this.text = text;
		this.cachedText = undefined;
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}

	// 更新背景着色函数并使缓存失效（传 undefined 表示移除背景）
	setCustomBgFn(customBgFn?: (text: string) => string): void {
		this.customBgFn = customBgFn;
		this.cachedText = undefined;
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}

	// 外部触发的缓存失效
	invalidate(): void {
		this.cachedText = undefined;
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}

	// 渲染：按目标宽度输出带边距/背景的完整行数组
	render(width: number): string[] {
		// Check cache
		// 缓存命中：文本与宽度都未变
		if (this.cachedLines && this.cachedText === this.text && this.cachedWidth === width) {
			return this.cachedLines;
		}

		// Don't render anything if there's no actual text
		// 无实际内容的空文本：渲染为空并记入缓存
		if (!this.text || this.text.trim() === "") {
			const result: string[] = [];
			this.cachedText = this.text;
			this.cachedWidth = width;
			this.cachedLines = result;
			return result;
		}

		// Replace tabs with 3 spaces
		// tab 归一化为 3 空格，避免终端制表位错位
		const normalizedText = this.text.replace(/\t/g, "   ");

		// Calculate content width (subtract left/right margins)
		// 内容可用宽度 = 目标宽度 - 两侧边距；至少保留 1 列
		const contentWidth = Math.max(1, width - this.paddingX * 2);

		// Wrap text (this preserves ANSI codes but does NOT pad)
		// 折行（保留 ANSI 样式但不填充）
		const wrappedLines = wrapTextWithAnsi(normalizedText, contentWidth);

		// Add margins and background to each line
		const leftMargin = " ".repeat(this.paddingX);
		const rightMargin = " ".repeat(this.paddingX);
		const contentLines: string[] = [];

		for (const line of wrappedLines) {
			// Add margins
			// 拼接左右边距
			const lineWithMargins = leftMargin + line + rightMargin;

			// Apply background if specified (this also pads to full width)
			// 有背景：着色并补齐到整行；无背景：仅补空格到整行
			if (this.customBgFn) {
				contentLines.push(applyBackgroundToLine(lineWithMargins, width, this.customBgFn));
			} else {
				// No background - just pad to width with spaces
				const visibleLen = visibleWidth(lineWithMargins);
				const paddingNeeded = Math.max(0, width - visibleLen);
				contentLines.push(lineWithMargins + " ".repeat(paddingNeeded));
			}
		}

		// Add top/bottom padding (empty lines)
		// 垂直边距：生成等宽的空白行（有背景时一并着色）
		const emptyLine = " ".repeat(width);
		const emptyLines: string[] = [];
		for (let i = 0; i < this.paddingY; i++) {
			const line = this.customBgFn ? applyBackgroundToLine(emptyLine, width, this.customBgFn) : emptyLine;
			emptyLines.push(line);
		}

		// 组合：上边距 + 内容 + 下边距
		const result = [...emptyLines, ...contentLines, ...emptyLines];

		// Update cache
		// 写入缓存
		this.cachedText = this.text;
		this.cachedWidth = width;
		this.cachedLines = result;

		return result.length > 0 ? result : [""];
	}
}
