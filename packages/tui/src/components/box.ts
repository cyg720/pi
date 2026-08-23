/**
 * 【文件职责】实现 Box 容器组件：为所有子组件统一施加水平/垂直内边距与背景色，
 *              并对渲染结果做“内容+宽度+背景采样”四元组缓存。
 * 【技术维度】实现 Component 接口；组合模式（children 列表）；背景变化通过采样输出探测而非依赖失效通知；
 *              子行拼接左内边距后统一着色/补齐。
 * 【产品维度】是面板、卡片等视觉容器的基础：一处设置即可给整块内容加上留白与底色。
 * 【逻辑维度】add/remove/clear 修改子列表并失效缓存 → render：渲染子组件 → 缓存命中判断 →
 *              上内边距空行 + 内容行 + 下内边距空行 → 写缓存；applyBg 负责单行的补齐与着色。
 * 【关键边界】内容宽度至少为 1；无子组件返回空数组；setBgFn 故意不失效缓存（靠 bgSample 探测变化）；
 *              缓存比较要求子行逐行相等，因此子组件需自行正确响应 invalidate。
 * 【新手阅读建议】先看 RenderCache 四个字段理解缓存判定 → 再读 render 主流程与 applyBg。
 */
import type { Component } from "../tui.ts";
import { applyBackgroundToLine, visibleWidth } from "../utils.ts";

// 渲染缓存结构（中文说明）：记录生成结果时的输入条件，用于命中判定
type RenderCache = {
	// 参与渲染的子组件行（已带左内边距）
	childLines: string[];
	// 当时的目标宽度
	width: number;
	// 背景函数输出采样（用于探测 bgFn 行为变化）
	bgSample: string | undefined;
	// 最终输出行
	lines: string[];
};

/**
 * Box component - a container that applies padding and background to all children
 */
/**
 * Box 容器组件（中文说明）：持有子组件列表、内外边距配置与可选背景函数。
 */
export class Box implements Component {
	// 子组件列表（按顺序垂直排列）
	children: Component[] = [];
	// 水平内边距（列数）
	private paddingX: number;
	// 垂直内边距（行数）
	private paddingY: number;
	// 可选的背景着色函数
	private bgFn?: (text: string) => string;

	// Cache for rendered output
	// 渲染缓存；undefined 表示失效
	private cache?: RenderCache;

	// 构造函数：默认水平/垂直各 1，无背景
	constructor(paddingX = 1, paddingY = 1, bgFn?: (text: string) => string) {
		this.paddingX = paddingX;
		this.paddingY = paddingY;
		this.bgFn = bgFn;
	}

	// 追加子组件并失效缓存
	addChild(component: Component): void {
		this.children.push(component);
		this.invalidateCache();
	}

	// 移除指定子组件（存在才移除）并失效缓存
	removeChild(component: Component): void {
		const index = this.children.indexOf(component);
		if (index !== -1) {
			this.children.splice(index, 1);
			this.invalidateCache();
		}
	}

	// 清空全部子组件并失效缓存
	clear(): void {
		this.children = [];
		this.invalidateCache();
	}

	// 更新背景函数；故意不在此处失效缓存——由渲染时的采样对比来发现变化
	setBgFn(bgFn?: (text: string) => string): void {
		this.bgFn = bgFn;
		// Don't invalidate here - we'll detect bgFn changes by sampling output
	}

	// 内部缓存失效
	private invalidateCache(): void {
		this.cache = undefined;
	}

	// 缓存命中判定（私有）：宽度、背景采样一致且子行逐行相等
	private matchCache(width: number, childLines: string[], bgSample: string | undefined): boolean {
		const cache = this.cache;
		return (
			!!cache &&
			cache.width === width &&
			cache.bgSample === bgSample &&
			cache.childLines.length === childLines.length &&
			cache.childLines.every((line, i) => line === childLines[i])
		);
	}

	// 级联失效：清自身缓存并逐子组件调用其 invalidate
	invalidate(): void {
		this.invalidateCache();
		for (const child of this.children) {
			child.invalidate?.();
		}
	}

	// 渲染：以给定宽度输出带内边距与背景的完整行数组
	render(width: number): string[] {
		if (this.children.length === 0) {
			return [];
		}

		// 内容可用宽度（至少 1 列）
		const contentWidth = Math.max(1, width - this.paddingX * 2);
		const leftPad = " ".repeat(this.paddingX);

		// Render all children
		// 渲染全部子组件并拼上左内边距
		const childLines: string[] = [];
		for (const child of this.children) {
			const lines = child.render(contentWidth);
			for (const line of lines) {
				childLines.push(leftPad + line);
			}
		}

		if (childLines.length === 0) {
			return [];
		}

		// Check if bgFn output changed by sampling
		// 用固定输入采样背景函数输出，检测其行为是否发生变化
		const bgSample = this.bgFn ? this.bgFn("test") : undefined;

		// Check cache validity
		// 命中缓存则直接复用上次结果
		if (this.matchCache(width, childLines, bgSample)) {
			return this.cache!.lines;
		}

		// Apply background and padding
		const result: string[] = [];

		// Top padding
		// 顶部内边距空行
		for (let i = 0; i < this.paddingY; i++) {
			result.push(this.applyBg("", width));
		}

		// Content
		// 内容行
		for (const line of childLines) {
			result.push(this.applyBg(line, width));
		}

		// Bottom padding
		// 底部内边距空行
		for (let i = 0; i < this.paddingY; i++) {
			result.push(this.applyBg("", width));
		}

		// Update cache
		// 写入缓存
		this.cache = { childLines, width, bgSample, lines: result };

		return result;
	}

	// 单行处理（私有）：补空格到整行宽；有背景函数时再整体着色
	private applyBg(line: string, width: number): string {
		const visLen = visibleWidth(line);
		const padNeeded = Math.max(0, width - visLen);
		const padded = line + " ".repeat(padNeeded);

		if (this.bgFn) {
			return applyBackgroundToLine(padded, width, this.bgFn);
		}
		return padded;
	}
}
