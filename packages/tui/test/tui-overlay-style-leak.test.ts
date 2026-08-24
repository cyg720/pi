/**
 * 文件职责：回归验证覆盖层裁剪 ANSI 重置序列时，斜体样式不会泄漏到下一行。
 * 技术维度：使用 Node 测试运行器、xterm 无头缓冲区、VirtualTerminal 和 TUI 覆盖层合成。
 * 产品维度：避免终端覆盖层使输入区或后续内容意外继承上方文本样式。
 * 逻辑维度：构造固定斜体满宽行，分别在无覆盖层和有覆盖层情况下渲染并读取单元格样式。
 * 关键边界：断言依赖 xterm 缓冲区内部样式值；渲染是异步的，检查前必须等待刷新完成。
 * 新手阅读建议：先看两个静态组件，再理解 getCellItalic 如何读取缓冲区，最后比较两个场景。
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { Terminal as XtermTerminalType } from "@xterm/headless";
import { type Component, TUI } from "../src/tui.ts";
import { VirtualTerminal } from "./virtual-terminal.ts";

/** 渲染调用方提供的固定多行文本，作为覆盖层下方的基础内容。 */
class StaticLines implements Component {
	// lines 保存每次 render 原样返回的全部行。
	private readonly lines: string[];

	/** 构造固定行组件；lines 为渲染内容，无返回值。 */
	constructor(lines: string[]) {
		this.lines = lines;
	}

	/** 返回构造时传入的固定行数组；无参数。 */
	render(): string[] {
		return this.lines;
	}

	/** 满足 Component 接口的空失效方法；无参数，无返回值。 */
	invalidate(): void {}
}

/** 渲染单行固定文本的覆盖层组件。 */
class StaticOverlay implements Component {
	// line 保存覆盖层唯一的渲染行。
	private readonly line: string;

	/** 构造固定覆盖层；line 为单行内容，无返回值。 */
	constructor(line: string) {
		this.line = line;
	}

	/** 返回包含固定覆盖文本的单元素数组；无参数。 */
	render(): string[] {
		return [this.line];
	}

	/** 满足 Component 接口的空失效方法；无参数，无返回值。 */
	invalidate(): void {}
}

/**
 * 读取虚拟终端指定单元格的斜体状态。
 * 参数：terminal 为虚拟终端，row 和 col 为从零开始的行列坐标。
 * 返回值：xterm 的斜体状态数值。
 * 使用示例：`getCellItalic(terminal, 1, 0)`。
 */
function getCellItalic(terminal: VirtualTerminal, row: number, col: number): number {
	// xterm 是从测试终端中取出的无头终端实例。
	const xterm = (terminal as unknown as { xterm: XtermTerminalType }).xterm;
	// buffer 是当前活动屏幕缓冲区。
	const buffer = xterm.buffer.active;
	// line 是包含视口偏移后的目标缓冲行。
	const line = buffer.getLine(buffer.viewportY + row);
	assert.ok(line, `Missing buffer line at row ${row}`);
	// cell 是目标列的可选终端单元格。
	const cell = line.getCell(col);
	assert.ok(cell, `Missing cell at row ${row} col ${col}`);
	return cell.isItalic();
}

/**
 * 请求立即渲染并等待下一事件循环与虚拟终端写入完成。
 * 参数：tui 为待刷新的界面，terminal 为等待输出的虚拟终端。
 * 返回值：渲染完成后解决的 Promise。
 * 使用示例：`await renderAndFlush(tui, terminal)`。
 */
async function renderAndFlush(tui: TUI, terminal: VirtualTerminal): Promise<void> {
	tui.requestRender(true);
	// resolve 是把 nextTick 完成信号传给 Promise 的回调。
	await new Promise<void>((resolve) => process.nextTick(resolve));
	await terminal.waitForRender();
}

describe("TUI overlay compositing", () => {
	// 验证无覆盖层时行尾之外的重置码不会污染下一行；无参数，无返回值。
	it("should not leak styles when a trailing reset sits beyond the last visible column (no overlay)", async () => {
		// width 是虚拟终端和满宽斜体内容共同使用的列数。
		const width = 20;
		// baseLine 是以斜体开始、在可视宽度后重置的满宽字符串。
		const baseLine = `\x1b[3m${"X".repeat(width)}\x1b[23m`;

		// terminal 是用于检查样式状态的虚拟终端。
		const terminal = new VirtualTerminal(width, 6);
		// tui 渲染满宽基础行和下一行 INPUT。
		const tui = new TUI(terminal);
		tui.addChild(new StaticLines([baseLine, "INPUT"]));
		tui.start();
		await renderAndFlush(tui, terminal);
		assert.strictEqual(getCellItalic(terminal, 1, 0), 0);
		tui.stop();
	});

	// 验证覆盖层切片丢弃尾部重置码时仍不会污染下一行；无参数，无返回值。
	it("should not leak styles when overlay slicing drops trailing SGR resets", async () => {
		// width 是虚拟终端和满宽斜体内容共同使用的列数。
		const width = 20;
		// baseLine 是会被覆盖层横向切片的满宽斜体字符串。
		const baseLine = `\x1b[3m${"X".repeat(width)}\x1b[23m`;

		// terminal 是用于读取合成结果样式的虚拟终端。
		const terminal = new VirtualTerminal(width, 6);
		// tui 同时承载基础内容和三列宽覆盖层。
		const tui = new TUI(terminal);
		tui.addChild(new StaticLines([baseLine, "INPUT"]));

		tui.showOverlay(new StaticOverlay("OVR"), { row: 0, col: 5, width: 3 });
		tui.start();
		await renderAndFlush(tui, terminal);

		assert.strictEqual(getCellItalic(terminal, 1, 0), 0);
		tui.stop();
	});
});
