/**
 * 【文件职责】实现 `@earendil-works/pi-tui` 包中的 `layout-node` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `./tui.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为文本应用提供基于差分渲染的终端界面能力；本文件负责其中与 `layout-node` 对应的子能力。
 * 【逻辑维度】对外入口包括 `LAYOUT_NODE`、`LayoutViewport`、`StackLayoutEntry`、`StackLayoutNode`、`ScrollLayoutState`、`ScrollLayoutNode`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `LAYOUT_NODE`、`LayoutViewport`、`StackLayoutEntry`、`StackLayoutNode`、`ScrollLayoutState`、`ScrollLayoutNode` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import type { Component } from "./tui.ts";

export const LAYOUT_NODE = Symbol.for("@earendil-works/pi-tui/layout-node");

export interface LayoutViewport {
	width: number;
	height: number;
}

export interface StackLayoutEntry {
	component: Component;
	basis?: number | "auto";
	grow?: number;
	shrink?: number;
	minSize?: number;
	maxSize?: number;
	visible?: (viewport: LayoutViewport) => boolean;
}

export interface StackLayoutNode {
	type: "vstack" | "hstack";
	entries: readonly StackLayoutEntry[];
	gap: number;
	align: "stretch" | "start" | "center" | "end";
}

export interface ScrollLayoutState {
	readonly scrollTop: number;
	readonly primary: boolean;
	readonly overscroll: "chain" | "contain";
	readonly viewportHeight: number;
	getContentWidth(width: number): number;
	updateLayout(contentHeight: number, viewportHeight: number, requestRender: () => void): void;
}

export interface ScrollLayoutNode {
	type: "scroll";
	component: Component;
	state: ScrollLayoutState;
}

export type LayoutNode = StackLayoutNode | ScrollLayoutNode;

export interface LayoutComponent extends Component {
	[LAYOUT_NODE](): LayoutNode;
}

export function getLayoutNode(component: Component): LayoutNode | undefined {
	const candidate = component as Partial<LayoutComponent>;
	return typeof candidate[LAYOUT_NODE] === "function" ? candidate[LAYOUT_NODE]() : undefined;
}
