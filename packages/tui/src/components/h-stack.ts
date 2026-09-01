/**
 * 【文件职责】实现 `@earendil-works/pi-tui` 包中的 `components/h-stack` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `../tui.ts`、`../utils.ts`、`./stack.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为文本应用提供基于差分渲染的终端界面能力；本文件负责其中与 `components/h-stack` 对应的子能力。
 * 【逻辑维度】对外入口包括 `HStack`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `HStack` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import { compositeTuiLine } from "../tui.ts";
import { visibleWidth } from "../utils.ts";
import { allocateStackSizes, Stack, type StackChild, type StackOptions, visibleStackEntries } from "./stack.ts";

export class HStack extends Stack {
	protected readonly layoutType = "hstack" as const;

	constructor(children: StackChild[] = [], options: StackOptions = {}) {
		super(children, options);
	}

	override render(width: number): string[] {
		const safeWidth = Math.max(1, width);
		const viewport = { width: safeWidth, height: Number.MAX_SAFE_INTEGER };
		const entries = visibleStackEntries(this.entries, viewport);
		if (entries.length === 0) return [];

		const intrinsicWidths = entries.map((entry) => {
			const lines = entry.component.render(safeWidth);
			return lines.reduce((max, line) => Math.max(max, visibleWidth(line)), 0);
		});
		const widths = allocateStackSizes(entries, intrinsicWidths, safeWidth, this.gap);
		const rendered = entries.map((entry, index) =>
			widths[index] === 0 ? [] : entry.component.render(widths[index]!),
		);
		const height = rendered.reduce((max, lines) => Math.max(max, lines.length), 0);
		const result = Array.from({ length: height }, () => "");
		let x = 0;
		for (let index = 0; index < rendered.length; index++) {
			const lines = rendered[index]!;
			const childWidth = widths[index]!;
			let offset = 0;
			if (this.align === "center") offset = Math.floor((height - lines.length) / 2);
			else if (this.align === "end") offset = height - lines.length;
			for (let row = 0; row < lines.length; row++) {
				const target = row + offset;
				if (target < 0 || target >= result.length) continue;
				result[target] = compositeTuiLine(result[target]!, lines[row]!, x, childWidth, safeWidth);
			}
			x += childWidth + this.gap;
		}
		return result;
	}
}
