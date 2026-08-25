/**
 * 文件职责：验证 TUI 的差量渲染、全量重绘、终端缩放、内容收缩和 Kitty 图片清理顺序。
 * 技术维度：使用 Node test、无头 xterm、虚拟终端和精确 ANSI 序列断言模拟真实终端绘制。
 * 产品维度：保证界面更新不残留旧内容、不破坏图片，并在窗口变化后保持光标与视口正确。
 * 逻辑维度：先定义测试组件和日志终端，再覆盖调试日志、图片、缩放、收缩及多种差量更新场景。
 * 关键边界：断言依赖终端尺寸、ANSI 字节顺序与异步渲染完成时机；每个用例必须停止 TUI 并恢复图片能力。
 * 新手阅读建议：先读两个测试组件和 withEnv，再看简单缩放用例，最后阅读 Kitty 图片和复杂视口收缩场景。
 */
import assert from "node:assert";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { Terminal as XtermTerminalType } from "@xterm/headless";
import { Image } from "../src/components/image.ts";
import {
	deleteKittyImage,
	encodeKitty,
	resetCapabilitiesCache,
	setCapabilities,
	setCellDimensions,
} from "../src/terminal-image.ts";
import { type Component, TUI } from "../src/tui.ts";
import { VirtualTerminal } from "./virtual-terminal.ts";

/** TestComponent 提供可直接替换行内容的最小组件，用于隔离验证 TUI 渲染器。 */
class TestComponent implements Component {
	/** lines 保存下一次 render 返回的文本行；数组可为空，修改后需请求重绘。 */
	lines: string[] = [];
	/** 返回当前文本行；参数 _width 为可用宽度但本夹具不裁剪，返回值直接交给 TUI。例如：component.render(40)。 */
	render(_width: number): string[] {
		return this.lines;
	}
	/** 标记组件失效；本夹具无内部缓存，因此无参数、无返回值且无需执行操作。例如：component.invalidate()。 */
	invalidate(): void {}
}

/** LoggingVirtualTerminal 在虚拟终端基础上记录所有写入，供用例检查 ANSI 输出先后顺序。 */
class LoggingVirtualTerminal extends VirtualTerminal {
	/** writes 保存自上次清空以来的原始写入片段，仅在当前终端实例内使用。 */
	private writes: string[] = [];

	/** 记录并转交终端写入；参数 data 为原始 ANSI 文本，无返回值。例如：terminal.write("text")。 */
	override write(data: string): void {
		this.writes.push(data);
		super.write(data);
	}

	/** 合并并返回全部写入片段；无参数，返回原始输出字符串。例如：terminal.getWrites()。 */
	getWrites(): string {
		return this.writes.join("");
	}

	/** 清空写入记录；无参数和返回值，用于分隔两次渲染。例如：terminal.clearWrites()。 */
	clearWrites(): void {
		this.writes = [];
	}
}

/** 参数 updates 是临时环境变量，run 是待执行回调；返回回调结果并恢复环境；示例：`await withEnv({ CI: "1" }, run)`。 */
async function withEnv<T>(updates: Record<string, string | undefined>, run: () => Promise<T>): Promise<T> {
	/** 常量 previousValues 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const previousValues = new Map<string, string | undefined>();
	/** 循环变量 [key, 表示当前遍历项或索引，仅在循环体内有效。 */
	for (const [key, value] of Object.entries(updates)) {
		previousValues.set(key, process.env[key]);
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}

	try {
		return await run();
	} finally {
		/** 循环变量 [key, 表示当前遍历项或索引，仅在循环体内有效。 */
		for (const [key, value] of previousValues) {
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
	}
}

/** getCellItalic 执行当前测试辅助步骤；参数 terminal、row、col 按签名提供输入，返回值供调用方断言。示例：getCellItalic(..., ..., ...)。 */
function getCellItalic(terminal: VirtualTerminal, row: number, col: number): number {
	/** 常量 xterm 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const xterm = (terminal as unknown as { xterm: XtermTerminalType }).xterm;
	/** 常量 buffer 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const buffer = xterm.buffer.active;
	/** 常量 line 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const line = buffer.getLine(buffer.viewportY + row);
	assert.ok(line, `Missing buffer line at row ${row}`);
	/** 常量 cell 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const cell = line.getCell(col);
	assert.ok(cell, `Missing cell at row ${row} col ${col}`);
	return cell.isItalic();
}

// 用例分组：集中验证“TUI debug logging”相关功能。
describe("TUI debug logging", () => {
	// 测试场景：验证“writes redraw logs to the provided directory”对应的行为、结果与边界。
	it("writes redraw logs to the provided directory", async () => {
		/** 常量 logDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const logDir = mkdtempSync(join(tmpdir(), "pi-tui-log-"));
		try {
			await withEnv({ PI_DEBUG_REDRAW: "1" }, async () => {
				/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const terminal = new VirtualTerminal(40, 10);
				/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const tui = new TUI(terminal, undefined, logDir);
				/** 常量 component 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const component = new TestComponent();
				tui.addChild(component);
				component.lines = ["test"];
				tui.start();
				await terminal.waitForRender();

				assert.match(readFileSync(join(logDir, "pi-debug.log"), "utf-8"), /fullRender: first render/);
				tui.stop();
			});
		} finally {
			rmSync(logDir, { recursive: true, force: true });
		}
	});
});

// 用例分组：集中验证“TUI Kitty image cleanup”相关功能。
describe("TUI Kitty image cleanup", () => {
	// 测试场景：验证“clears reserved Kitty image rows before drawing appended image placements”对应的行为、结果与边界。
	it("clears reserved Kitty image rows before drawing appended image placements", async () => {
		setCapabilities({ images: "kitty", trueColor: true, hyperlinks: true });
		setCellDimensions({ widthPx: 10, heightPx: 10 });
		try {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new LoggingVirtualTerminal(40, 10);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 component 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const component = new TestComponent();
			tui.addChild(component);

			component.lines = ["before"];
			tui.start();
			await terminal.waitForRender();
			terminal.clearWrites();

			/** 常量 image 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const image = new Image(
				"AAAA",
				"image/png",
				{ fallbackColor: (value) => value },
				{ maxWidthCells: 2 },
				{ widthPx: 20, heightPx: 20 },
			);
			/** 常量 imageLines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const imageLines = image.render(40);
			/** 常量 imageSequence 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const imageSequence = imageLines[0];
			component.lines = ["before", ...imageLines, "after"];
			tui.requestRender();
			await terminal.waitForRender();

			/** 常量 writes 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const writes = terminal.getWrites();
			assert.ok(
				writes.includes(`\x1b[2K\r\n\x1b[2K\x1b[1A${imageSequence}\x1b[1B`),
				"reserved rows should be cleared before the image placement is drawn",
			);
			assert.ok(
				!writes.includes(`${imageSequence}\r\n\x1b[2K`),
				"reserved row clears must not run after the image placement is drawn",
			);

			tui.stop();
		} finally {
			resetCapabilitiesCache();
			setCellDimensions({ widthPx: 9, heightPx: 18 });
		}
	});

	// 测试场景：验证“falls back to full redraw when Kitty image pre-clear would scroll”对应的行为、结果与边界。
	it("falls back to full redraw when Kitty image pre-clear would scroll", async () => {
		setCapabilities({ images: "kitty", trueColor: true, hyperlinks: true });
		setCellDimensions({ widthPx: 10, heightPx: 10 });
		try {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new LoggingVirtualTerminal(40, 2);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 component 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const component = new TestComponent();
			tui.addChild(component);

			component.lines = ["before"];
			tui.start();
			await terminal.waitForRender();
			/** 常量 redrawsBeforeImage 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const redrawsBeforeImage = tui.fullRedraws;
			terminal.clearWrites();

			/** 常量 image 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const image = new Image(
				"AAAA",
				"image/png",
				{ fallbackColor: (value) => value },
				{ maxWidthCells: 3 },
				{ widthPx: 30, heightPx: 30 },
			);
			component.lines = ["before", ...image.render(40), "after"];
			tui.requestRender();
			await terminal.waitForRender();

			assert.ok(tui.fullRedraws > redrawsBeforeImage, "unsafe image pre-clear should force a full redraw");
			assert.ok(terminal.getWrites().includes("\x1b[2J"), "fallback should clear and fully redraw");

			tui.stop();
		} finally {
			resetCapabilitiesCache();
			setCellDimensions({ widthPx: 9, heightPx: 18 });
		}
	});

	// 测试场景：验证“reserves Kitty image rows before drawing during full redraw fallbacks”对应的行为、结果与边界。
	it("reserves Kitty image rows before drawing during full redraw fallbacks", async () => {
		setCapabilities({ images: "kitty", trueColor: true, hyperlinks: true });
		setCellDimensions({ widthPx: 10, heightPx: 10 });
		try {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new LoggingVirtualTerminal(40, 5);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 component 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const component = new TestComponent();
			tui.addChild(component);

			component.lines = ["l0", "l1", "l2", "l3", "l4"];
			tui.start();
			await terminal.waitForRender();
			/** 常量 redrawsBeforeImage 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const redrawsBeforeImage = tui.fullRedraws;
			terminal.clearWrites();

			/** 常量 image 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const image = new Image(
				"AAAA",
				"image/png",
				{ fallbackColor: (value) => value },
				{ maxWidthCells: 3 },
				{ widthPx: 30, heightPx: 30 },
			);
			/** 常量 imageLines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const imageLines = image.render(40);
			/** 常量 imageSequence 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const imageSequence = imageLines[0];
			component.lines = ["l0", "l1", "l2", "l3", "l4", ...imageLines, "after"];
			tui.requestRender();
			await terminal.waitForRender();

			/** 常量 writes 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const writes = terminal.getWrites();
			assert.ok(tui.fullRedraws > redrawsBeforeImage, "scrolling image append should force a full redraw");
			assert.ok(
				writes.includes(`\r\n\r\n\x1b[2A${imageSequence}\x1b[2B`),
				"full redraw should reserve visible image rows before drawing the placement",
			);
			assert.ok(
				!writes.includes(`${imageSequence}\r\n\x1b[0m`),
				"full redraw must not write reserved padding rows after drawing the placement",
			);

			tui.stop();
		} finally {
			resetCapabilitiesCache();
			setCellDimensions({ widthPx: 9, heightPx: 18 });
		}
	});

	// 测试场景：验证“does not use cursor-up placement for Kitty images taller than the viewport”对应的行为、结果与边界。
	it("does not use cursor-up placement for Kitty images taller than the viewport", async () => {
		setCapabilities({ images: "kitty", trueColor: true, hyperlinks: true });
		setCellDimensions({ widthPx: 10, heightPx: 10 });
		try {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new LoggingVirtualTerminal(40, 5);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 component 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const component = new TestComponent();
			tui.addChild(component);

			component.lines = ["before"];
			tui.start();
			await terminal.waitForRender();
			terminal.clearWrites();

			/** 常量 image 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const image = new Image(
				"AAAA",
				"image/png",
				{ fallbackColor: (value) => value },
				{ maxWidthCells: 6 },
				{ widthPx: 60, heightPx: 60 },
			);
			/** 常量 imageLines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const imageLines = image.render(40);
			/** 常量 imageSequence 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const imageSequence = imageLines[0];
			assert.ok(imageLines.length > terminal.rows, "test image should exceed the viewport height");

			component.lines = ["before", ...imageLines, "after"];
			tui.requestRender(true);
			await terminal.waitForRender();

			/** 常量 writes 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const writes = terminal.getWrites();
			assert.ok(writes.includes(imageSequence), "image placement should be drawn");
			assert.ok(
				!writes.includes(`\x1b[${imageLines.length - 1}A${imageSequence}`),
				"taller-than-viewport images must keep the #4461 first-row placement path",
			);

			tui.stop();
		} finally {
			resetCapabilitiesCache();
			setCellDimensions({ widthPx: 9, heightPx: 18 });
		}
	});

	// 测试场景：验证“deletes changed image ids before drawing moved placements”对应的行为、结果与边界。
	it("deletes changed image ids before drawing moved placements", async () => {
		/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const terminal = new LoggingVirtualTerminal(40, 10);
		/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tui = new TUI(terminal);
		/** 常量 component 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const component = new TestComponent();
		tui.addChild(component);

		/** 常量 oldImage 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const oldImage = encodeKitty("AAAA", { columns: 2, rows: 2, imageId: 42, moveCursor: false });
		component.lines = ["top", oldImage];
		tui.start();
		await terminal.waitForRender();
		terminal.clearWrites();

		/** 常量 newImage 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const newImage = encodeKitty("BBBB", { columns: 2, rows: 1, imageId: 42, moveCursor: false });
		component.lines = [newImage, ""];
		tui.requestRender();
		await terminal.waitForRender();

		/** 常量 writes 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const writes = terminal.getWrites();
		/** 常量 deleteIndex 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const deleteIndex = writes.indexOf(deleteKittyImage(42));
		/** 常量 drawIndex 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const drawIndex = writes.indexOf(newImage);
		assert.ok(deleteIndex >= 0, "changed old image should be deleted");
		assert.ok(drawIndex >= 0, "new image should be drawn");
		assert.ok(deleteIndex < drawIndex, "old image must be deleted before the new placement is drawn");

		tui.stop();
	});

	// 测试场景：验证“redraws image lines when an earlier reserved image row changes”对应的行为、结果与边界。
	it("redraws image lines when an earlier reserved image row changes", async () => {
		/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const terminal = new LoggingVirtualTerminal(40, 10);
		/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tui = new TUI(terminal);
		/** 常量 component 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const component = new TestComponent();
		tui.addChild(component);

		/** 常量 image 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const image = encodeKitty("AAAA", { columns: 2, rows: 2, imageId: 88, moveCursor: false });
		component.lines = ["", image];
		tui.start();
		await terminal.waitForRender();
		terminal.clearWrites();

		component.lines = ["covered", image];
		tui.requestRender();
		await terminal.waitForRender();

		/** 常量 writes 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const writes = terminal.getWrites();
		/** 常量 deleteIndex 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const deleteIndex = writes.indexOf(deleteKittyImage(88));
		/** 常量 drawIndex 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const drawIndex = writes.indexOf(image);
		assert.ok(deleteIndex >= 0, "image should be deleted when a reserved row changes");
		assert.ok(drawIndex >= 0, "unchanged image line should be redrawn after deleting the placement");
		assert.ok(deleteIndex < drawIndex, "old placement must be deleted before the image line is redrawn");
		assert.ok(!writes.includes("\x1b[2J"), "reserved row changes should not force a full redraw");

		tui.stop();
	});

	// 测试场景：验证“deletes previously rendered image ids during full redraws”对应的行为、结果与边界。
	it("deletes previously rendered image ids during full redraws", async () => {
		/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const terminal = new LoggingVirtualTerminal(40, 10);
		/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tui = new TUI(terminal);
		/** 常量 component 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const component = new TestComponent();
		tui.addChild(component);

		component.lines = [encodeKitty("AAAA", { columns: 2, rows: 2, imageId: 77, moveCursor: false })];
		tui.start();
		await terminal.waitForRender();
		terminal.clearWrites();

		component.lines = ["plain text"];
		tui.requestRender(true);
		await terminal.waitForRender();

		/** 常量 writes 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const writes = terminal.getWrites();
		/** 常量 deleteIndex 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const deleteIndex = writes.indexOf(deleteKittyImage(77));
		/** 常量 clearIndex 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const clearIndex = writes.indexOf("\x1b[2J");
		assert.ok(deleteIndex >= 0, "previous image should be deleted during full redraw");
		assert.ok(clearIndex >= 0, "full redraw should clear the screen");
		assert.ok(deleteIndex < clearIndex, "old image should be deleted before the screen is cleared");

		tui.stop();
	});
});

// 用例分组：集中验证“TUI resize handling”相关功能。
describe("TUI resize handling", () => {
	// 测试场景：验证“triggers full re-render when terminal height changes”对应的行为、结果与边界。
	it("triggers full re-render when terminal height changes", async () => {
		await withEnv({ TERMUX_VERSION: undefined }, async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(40, 10);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 component 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const component = new TestComponent();
			tui.addChild(component);

			component.lines = ["Line 0", "Line 1", "Line 2"];
			tui.start();
			await terminal.waitForRender();

			/** 常量 initialRedraws 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const initialRedraws = tui.fullRedraws;

			// Resize height
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			terminal.resize(40, 15);
			await terminal.waitForRender();

			// Should have triggered a full redraw
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			assert.ok(tui.fullRedraws > initialRedraws, "Height change should trigger full redraw");

			/** 常量 viewport 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const viewport = terminal.getViewport();
			assert.ok(viewport[0]?.includes("Line 0"), "Content preserved after height change");

			tui.stop();
		});
	});

	// 测试场景：验证“skips full re-render on height changes in Termux”对应的行为、结果与边界。
	it("skips full re-render on height changes in Termux", async () => {
		await withEnv({ TERMUX_VERSION: "1" }, async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new LoggingVirtualTerminal(40, 10);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 component 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const component = new TestComponent();
			tui.addChild(component);

			component.lines = Array.from({ length: 20 }, (_, i) => `Line ${i}`);
			tui.start();
			await terminal.waitForRender();
			terminal.clearWrites();

			/** 常量 initialRedraws 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const initialRedraws = tui.fullRedraws;
			/** 循环变量 height 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const height of [15, 8, 14, 11]) {
				terminal.resize(40, height);
				await terminal.waitForRender();
			}

			assert.strictEqual(tui.fullRedraws, initialRedraws, "Height change should not trigger full redraw");
			assert.ok(!terminal.getWrites().includes("\x1b[2J"), "Height change should not clear the screen");
			assert.ok(!terminal.getWrites().includes("\x1b[3J"), "Height change should not clear scrollback");

			/** 常量 viewport 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const viewport = terminal.getViewport();
			assert.ok(viewport.join("\n").includes("Line 19"), "Latest content remains visible after resize");

			tui.stop();
		});
	});

	// 测试场景：验证“triggers full re-render when terminal width changes”对应的行为、结果与边界。
	it("triggers full re-render when terminal width changes", async () => {
		/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const terminal = new VirtualTerminal(40, 10);
		/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tui = new TUI(terminal);
		/** 常量 component 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const component = new TestComponent();
		tui.addChild(component);

		component.lines = ["Line 0", "Line 1", "Line 2"];
		tui.start();
		await terminal.waitForRender();

		/** 常量 initialRedraws 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const initialRedraws = tui.fullRedraws;

		// Resize width
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		terminal.resize(60, 10);
		await terminal.waitForRender();

		// Should have triggered a full redraw
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		assert.ok(tui.fullRedraws > initialRedraws, "Width change should trigger full redraw");

		tui.stop();
	});
});

// 用例分组：集中验证“TUI content shrinkage”相关功能。
describe("TUI content shrinkage", () => {
	// 测试场景：验证“clears empty rows when content shrinks significantly”对应的行为、结果与边界。
	it("clears empty rows when content shrinks significantly", async () => {
		/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const terminal = new VirtualTerminal(40, 10);
		/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tui = new TUI(terminal);
		tui.setClearOnShrink(true); // Explicitly enable (may be disabled via env var)
		/** 常量 component 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const component = new TestComponent();
		tui.addChild(component);

		// Start with many lines
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		component.lines = ["Line 0", "Line 1", "Line 2", "Line 3", "Line 4", "Line 5"];
		tui.start();
		await terminal.waitForRender();

		/** 常量 initialRedraws 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const initialRedraws = tui.fullRedraws;

		// Shrink to fewer lines
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		component.lines = ["Line 0", "Line 1"];
		tui.requestRender();
		await terminal.waitForRender();

		// Should have triggered a full redraw to clear empty rows
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		assert.ok(tui.fullRedraws > initialRedraws, "Content shrinkage should trigger full redraw");

		/** 常量 viewport 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const viewport = terminal.getViewport();
		assert.ok(viewport[0]?.includes("Line 0"), "First line preserved");
		assert.ok(viewport[1]?.includes("Line 1"), "Second line preserved");
		// Lines below should be empty (cleared)
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		assert.strictEqual(viewport[2]?.trim(), "", "Line 2 should be cleared");
		assert.strictEqual(viewport[3]?.trim(), "", "Line 3 should be cleared");

		tui.stop();
	});

	// 测试场景：验证“handles shrink to single line”对应的行为、结果与边界。
	it("handles shrink to single line", async () => {
		/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const terminal = new VirtualTerminal(40, 10);
		/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tui = new TUI(terminal);
		tui.setClearOnShrink(true); // Explicitly enable (may be disabled via env var)
		/** 常量 component 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const component = new TestComponent();
		tui.addChild(component);

		component.lines = ["Line 0", "Line 1", "Line 2", "Line 3"];
		tui.start();
		await terminal.waitForRender();

		// Shrink to single line
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		component.lines = ["Only line"];
		tui.requestRender();
		await terminal.waitForRender();

		/** 常量 viewport 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const viewport = terminal.getViewport();
		assert.ok(viewport[0]?.includes("Only line"), "Single line rendered");
		assert.strictEqual(viewport[1]?.trim(), "", "Line 1 should be cleared");

		tui.stop();
	});

	// 测试场景：验证“handles shrink to empty”对应的行为、结果与边界。
	it("handles shrink to empty", async () => {
		/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const terminal = new VirtualTerminal(40, 10);
		/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tui = new TUI(terminal);
		tui.setClearOnShrink(true); // Explicitly enable (may be disabled via env var)
		/** 常量 component 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const component = new TestComponent();
		tui.addChild(component);

		component.lines = ["Line 0", "Line 1", "Line 2"];
		tui.start();
		await terminal.waitForRender();

		// Shrink to empty
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		component.lines = [];
		tui.requestRender();
		await terminal.waitForRender();

		/** 常量 viewport 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const viewport = terminal.getViewport();
		// All lines should be empty
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		assert.strictEqual(viewport[0]?.trim(), "", "Line 0 should be cleared");
		assert.strictEqual(viewport[1]?.trim(), "", "Line 1 should be cleared");

		tui.stop();
	});
});

// 用例分组：集中验证“TUI differential rendering”相关功能。
describe("TUI differential rendering", () => {
	// 测试场景：验证“tracks cursor correctly when content shrinks with unchanged remaining lines”对应的行为、结果与边界。
	it("tracks cursor correctly when content shrinks with unchanged remaining lines", async () => {
		/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const terminal = new VirtualTerminal(40, 10);
		/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tui = new TUI(terminal);
		/** 常量 component 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const component = new TestComponent();
		tui.addChild(component);

		// Initial render: 5 identical lines
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		component.lines = ["Line 0", "Line 1", "Line 2", "Line 3", "Line 4"];
		tui.start();
		await terminal.waitForRender();

		// Shrink to 3 lines, all identical to before (no content changes in remaining lines)
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		component.lines = ["Line 0", "Line 1", "Line 2"];
		tui.requestRender();
		await terminal.waitForRender();

		// cursorRow should be 2 (last line of new content)
		// Verify by doing another render with a change on line 1
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		component.lines = ["Line 0", "CHANGED", "Line 2"];
		tui.requestRender();
		await terminal.waitForRender();

		/** 常量 viewport 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const viewport = terminal.getViewport();
		// Line 1 should show "CHANGED", proving cursor tracking was correct
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		assert.ok(viewport[1]?.includes("CHANGED"), `Expected "CHANGED" on line 1, got: ${viewport[1]}`);

		tui.stop();
	});

	// 测试场景：验证“renders correctly when only a middle line changes (spinner case)”对应的行为、结果与边界。
	it("renders correctly when only a middle line changes (spinner case)", async () => {
		/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const terminal = new VirtualTerminal(40, 10);
		/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tui = new TUI(terminal);
		/** 常量 component 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const component = new TestComponent();
		tui.addChild(component);

		// Initial render
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		component.lines = ["Header", "Working...", "Footer"];
		tui.start();
		await terminal.waitForRender();

		// Simulate spinner animation - only middle line changes
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		const spinnerFrames = ["|", "/", "-", "\\"];
		/** 循环变量 frame 表示当前遍历项或索引，仅在循环体内有效。 */
		for (const frame of spinnerFrames) {
			component.lines = ["Header", `Working ${frame}`, "Footer"];
			tui.requestRender();
			await terminal.waitForRender();

			/** 常量 viewport 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const viewport = terminal.getViewport();
			assert.ok(viewport[0]?.includes("Header"), `Header preserved: ${viewport[0]}`);
			assert.ok(viewport[1]?.includes(`Working ${frame}`), `Spinner updated: ${viewport[1]}`);
			assert.ok(viewport[2]?.includes("Footer"), `Footer preserved: ${viewport[2]}`);
		}

		tui.stop();
	});

	// 测试场景：验证“resets styles after each rendered line”对应的行为、结果与边界。
	it("resets styles after each rendered line", async () => {
		/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const terminal = new VirtualTerminal(20, 6);
		/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tui = new TUI(terminal);
		/** 常量 component 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const component = new TestComponent();
		tui.addChild(component);

		component.lines = ["\x1b[3mItalic", "Plain"];
		tui.start();
		await terminal.waitForRender();

		assert.strictEqual(getCellItalic(terminal, 1, 0), 0);
		tui.stop();
	});

	// 测试场景：验证“renders correctly when first line changes but rest stays same”对应的行为、结果与边界。
	it("renders correctly when first line changes but rest stays same", async () => {
		/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const terminal = new VirtualTerminal(40, 10);
		/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tui = new TUI(terminal);
		/** 常量 component 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const component = new TestComponent();
		tui.addChild(component);

		component.lines = ["Line 0", "Line 1", "Line 2", "Line 3"];
		tui.start();
		await terminal.waitForRender();

		// Change only first line
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		component.lines = ["CHANGED", "Line 1", "Line 2", "Line 3"];
		tui.requestRender();
		await terminal.waitForRender();

		/** 常量 viewport 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const viewport = terminal.getViewport();
		assert.ok(viewport[0]?.includes("CHANGED"), `First line changed: ${viewport[0]}`);
		assert.ok(viewport[1]?.includes("Line 1"), `Line 1 preserved: ${viewport[1]}`);
		assert.ok(viewport[2]?.includes("Line 2"), `Line 2 preserved: ${viewport[2]}`);
		assert.ok(viewport[3]?.includes("Line 3"), `Line 3 preserved: ${viewport[3]}`);

		tui.stop();
	});

	// 测试场景：验证“renders correctly when last line changes but rest stays same”对应的行为、结果与边界。
	it("renders correctly when last line changes but rest stays same", async () => {
		/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const terminal = new VirtualTerminal(40, 10);
		/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tui = new TUI(terminal);
		/** 常量 component 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const component = new TestComponent();
		tui.addChild(component);

		component.lines = ["Line 0", "Line 1", "Line 2", "Line 3"];
		tui.start();
		await terminal.waitForRender();

		// Change only last line
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		component.lines = ["Line 0", "Line 1", "Line 2", "CHANGED"];
		tui.requestRender();
		await terminal.waitForRender();

		/** 常量 viewport 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const viewport = terminal.getViewport();
		assert.ok(viewport[0]?.includes("Line 0"), `Line 0 preserved: ${viewport[0]}`);
		assert.ok(viewport[1]?.includes("Line 1"), `Line 1 preserved: ${viewport[1]}`);
		assert.ok(viewport[2]?.includes("Line 2"), `Line 2 preserved: ${viewport[2]}`);
		assert.ok(viewport[3]?.includes("CHANGED"), `Last line changed: ${viewport[3]}`);

		tui.stop();
	});

	// 测试场景：验证“renders correctly when multiple non-adjacent lines change”对应的行为、结果与边界。
	it("renders correctly when multiple non-adjacent lines change", async () => {
		/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const terminal = new VirtualTerminal(40, 10);
		/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tui = new TUI(terminal);
		/** 常量 component 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const component = new TestComponent();
		tui.addChild(component);

		component.lines = ["Line 0", "Line 1", "Line 2", "Line 3", "Line 4"];
		tui.start();
		await terminal.waitForRender();

		// Change lines 1 and 3, keep 0, 2, 4 the same
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		component.lines = ["Line 0", "CHANGED 1", "Line 2", "CHANGED 3", "Line 4"];
		tui.requestRender();
		await terminal.waitForRender();

		/** 常量 viewport 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const viewport = terminal.getViewport();
		assert.ok(viewport[0]?.includes("Line 0"), `Line 0 preserved: ${viewport[0]}`);
		assert.ok(viewport[1]?.includes("CHANGED 1"), `Line 1 changed: ${viewport[1]}`);
		assert.ok(viewport[2]?.includes("Line 2"), `Line 2 preserved: ${viewport[2]}`);
		assert.ok(viewport[3]?.includes("CHANGED 3"), `Line 3 changed: ${viewport[3]}`);
		assert.ok(viewport[4]?.includes("Line 4"), `Line 4 preserved: ${viewport[4]}`);

		tui.stop();
	});

	// 测试场景：验证“handles transition from content to empty and back to content”对应的行为、结果与边界。
	it("handles transition from content to empty and back to content", async () => {
		/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const terminal = new VirtualTerminal(40, 10);
		/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tui = new TUI(terminal);
		/** 常量 component 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const component = new TestComponent();
		tui.addChild(component);

		// Start with content
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		component.lines = ["Line 0", "Line 1", "Line 2"];
		tui.start();
		await terminal.waitForRender();

		/** 变量 viewport 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let viewport = terminal.getViewport();
		assert.ok(viewport[0]?.includes("Line 0"), "Initial content rendered");

		// Clear to empty
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		component.lines = [];
		tui.requestRender();
		await terminal.waitForRender();

		// Add content back - this should work correctly even after empty state
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		component.lines = ["New Line 0", "New Line 1"];
		tui.requestRender();
		await terminal.waitForRender();

		viewport = terminal.getViewport();
		assert.ok(viewport[0]?.includes("New Line 0"), `New content rendered: ${viewport[0]}`);
		assert.ok(viewport[1]?.includes("New Line 1"), `New content line 1: ${viewport[1]}`);

		tui.stop();
	});

	// 测试场景：验证“full re-renders when deleted lines move the viewport upward”对应的行为、结果与边界。
	it("full re-renders when deleted lines move the viewport upward", async () => {
		/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const terminal = new VirtualTerminal(20, 5);
		/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tui = new TUI(terminal);
		/** 常量 component 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const component = new TestComponent();
		tui.addChild(component);

		component.lines = Array.from({ length: 12 }, (_, i) => `Line ${i}`);
		tui.start();
		await terminal.waitForRender();

		/** 常量 initialRedraws 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const initialRedraws = tui.fullRedraws;

		component.lines = Array.from({ length: 7 }, (_, i) => `Line ${i}`);
		tui.requestRender();
		await terminal.waitForRender();

		assert.ok(tui.fullRedraws > initialRedraws, "Shrink should trigger a full redraw");
		assert.deepStrictEqual(terminal.getViewport(), ["Line 2", "Line 3", "Line 4", "Line 5", "Line 6"]);

		tui.stop();
	});

	// 测试场景：验证“appends after a shrink without another full redraw once the viewport is reset”对应的行为、结果与边界。
	it("appends after a shrink without another full redraw once the viewport is reset", async () => {
		/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const terminal = new VirtualTerminal(20, 5);
		/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tui = new TUI(terminal);
		/** 常量 component 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const component = new TestComponent();
		tui.addChild(component);

		component.lines = Array.from({ length: 8 }, (_, i) => `Line ${i}`);
		tui.start();
		await terminal.waitForRender();

		/** 常量 initialRedraws 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const initialRedraws = tui.fullRedraws;

		component.lines = ["Line 0", "Line 1"];
		tui.requestRender();
		await terminal.waitForRender();

		assert.ok(tui.fullRedraws > initialRedraws, "Shrink should reset the viewport with a full redraw");
		/** 常量 redrawsAfterShrink 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const redrawsAfterShrink = tui.fullRedraws;

		component.lines = ["Line 0", "Line 1", "Line 2"];
		tui.requestRender();
		await terminal.waitForRender();

		assert.strictEqual(tui.fullRedraws, redrawsAfterShrink, "Append should stay on the differential path");
		assert.deepStrictEqual(terminal.getViewport(), ["Line 0", "Line 1", "Line 2", "", ""]);

		tui.stop();
	});

	// 测试场景：验证“clears stale content when maxLinesRendered was inflated by a transient component”对应的行为、结果与边界。
	it("clears stale content when maxLinesRendered was inflated by a transient component", async () => {
		/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const terminal = new VirtualTerminal(40, 10);
		/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tui = new TUI(terminal);
		/** 常量 chat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const chat = new TestComponent();
		/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const editor = new TestComponent();
		tui.addChild(chat);
		tui.addChild(editor);

		/** 常量 longChat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const longChat = Array.from({ length: 15 }, (_, i) => `Chat ${i}`);
		/** 常量 shortChat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const shortChat = Array.from({ length: 12 }, (_, i) => `Chat ${i}`);
		/** 常量 editorLines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const editorLines = ["Editor 0", "Editor 1", "Editor 2"];
		/** 常量 selectorLines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const selectorLines = Array.from({ length: 8 }, (_, i) => `Selector ${i}`);

		chat.lines = longChat;
		editor.lines = editorLines;
		tui.start();
		await terminal.waitForRender();

		editor.lines = selectorLines;
		tui.requestRender();
		await terminal.waitForRender();

		editor.lines = editorLines;
		tui.requestRender();
		await terminal.waitForRender();

		/** 常量 redrawsBeforeSwitch 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const redrawsBeforeSwitch = tui.fullRedraws;
		chat.lines = shortChat;
		tui.requestRender();
		await terminal.waitForRender();

		assert.ok(tui.fullRedraws > redrawsBeforeSwitch, "Branch switch should trigger a full redraw");

		/** 常量 viewport 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const viewport = terminal.getViewport();
		/** 循环变量 i 表示当前遍历项或索引，仅在循环体内有效。 */
		for (let i = 0; i < 10; i++) {
			/** 常量 line 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const line = viewport[i] ?? "";
			assert.ok(!line.includes("Chat 12"), `Stale "Chat 12" at viewport row ${i}`);
			assert.ok(!line.includes("Chat 13"), `Stale "Chat 13" at viewport row ${i}`);
			assert.ok(!line.includes("Chat 14"), `Stale "Chat 14" at viewport row ${i}`);
		}

		assert.deepStrictEqual(viewport, [
			"Chat 5",
			"Chat 6",
			"Chat 7",
			"Chat 8",
			"Chat 9",
			"Chat 10",
			"Chat 11",
			"Editor 0",
			"Editor 1",
			"Editor 2",
		]);

		tui.stop();
	});
});
