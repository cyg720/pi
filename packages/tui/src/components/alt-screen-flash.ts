/**
 * 【文件职责】实现 `@earendil-works/pi-tui` 包中的 `components/alt-screen-flash` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `../tui.ts`、`../utils.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为文本应用提供基于差分渲染的终端界面能力；本文件负责其中与 `components/alt-screen-flash` 对应的子能力。
 * 【逻辑维度】对外入口包括 `AltScreenFlashContainer`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `AltScreenFlashContainer` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import type { Component } from "../tui.ts";
import { truncateToWidth } from "../utils.ts";

const DEFAULT_DURATION_MS = 1000;

interface FlashEntry {
	id: number;
	message: string;
	timer: NodeJS.Timeout;
}

/** Transient messages composited by the alternate-screen renderer. */
export class AltScreenFlashContainer implements Component {
	private readonly entries: FlashEntry[] = [];
	private nextId = 0;
	private readonly requestRender: () => void;

	constructor(requestRender: () => void) {
		this.requestRender = requestRender;
	}

	flash(message: string, durationMs = DEFAULT_DURATION_MS): void {
		const id = this.nextId++;
		const timer = setTimeout(
			() => {
				const index = this.entries.findIndex((entry) => entry.id === id);
				if (index === -1) return;
				this.entries.splice(index, 1);
				this.requestRender();
			},
			Math.max(0, durationMs),
		);
		timer.unref();
		this.entries.push({ id, message, timer });
		this.requestRender();
	}

	dispose(): void {
		for (const entry of this.entries) clearTimeout(entry.timer);
		this.entries.length = 0;
	}

	invalidate(): void {}

	render(width: number): string[] {
		return this.entries.map((entry) => {
			const message = truncateToWidth(` ${entry.message} `, width, "");
			return `\x1b[7m${message}\x1b[27m`;
		});
	}
}
