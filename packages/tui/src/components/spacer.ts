/**
 * 【文件职责】实现 Spacer 占位组件：渲染指定数量的空行，用于在布局中制造垂直间距。
 * 【技术维度】实现 Component 接口；无状态渲染（每次按 lines 数量生成空行数组）。
 * 【产品维度】让界面各区块之间留出可配置的空白间隔，是布局排版的基础积木。
 * 【逻辑维度】构造/setLines 设定行数 → render 输出对应数量空字符串 → invalidate 无缓存可清理。
 * 【关键边界】lines 默认为 1；行数为 0 时不占任何空间。
 * 【新手阅读建议】半分钟读完：这是最简单的组件范本，可作为学习 Component 接口的起点。
 */
import type { Component } from "../tui.ts";

/**
 * Spacer component that renders empty lines
 */
/**
 * Spacer 组件（中文说明）：持有空行数量并在渲染时输出等量空行。
 */
export class Spacer implements Component {
	// 需要渲染的空行数量
	private lines: number;

	// 构造函数：默认 1 行空行
	constructor(lines: number = 1) {
		this.lines = lines;
	}

	// 动态调整空行数量
	setLines(lines: number): void {
		this.lines = lines;
	}

	invalidate(): void {
		// No cached state to invalidate currently
		// 当前没有需要失效的缓存状态
	}

	// 渲染：输出 lines 个空行（宽度参数未使用）
	render(_width: number): string[] {
		const result: string[] = [];
		for (let i = 0; i < this.lines; i++) {
			result.push("");
		}
		return result;
	}
}
