/**
 * 文件职责：验证 TUI 启动时查询终端单元格尺寸不会吞掉普通 Escape 或后续用户输入。
 * 技术维度：使用 Node 测试运行器、VirtualTerminal、终端能力缓存和最小 Component 实现。
 * 产品维度：保证支持图片的终端既能上报像素尺寸，也能正常响应取消键和键盘输入。
 * 逻辑维度：临时模拟 Ghostty 环境，启动 TUI，分别发送裸 Escape 和尺寸响应后检查记录。
 * 关键边界：测试会临时修改三个终端环境变量，并必须在 finally 中恢复与重置能力缓存。
 * 新手阅读建议：先看 InputRecorder 和 withImageTerminal，再跟踪两例 sendInput 后的数据变化。
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { getCellDimensions, resetCapabilitiesCache, setCellDimensions } from "../src/terminal-image.ts";
import { type Component, TUI } from "../src/tui.ts";
import { VirtualTerminal } from "./virtual-terminal.ts";

/** 记录 TUI 转发输入的最小组件，用于区分被协议消费和交给用户的字节。 */
class InputRecorder implements Component {
	// inputs 按收到顺序保存所有原始输入字符串。
	readonly inputs: string[] = [];

	/** 渲染一个空行；无参数，返回单行数组，示例：TUI 聚焦该组件后调用。 */
	render(): string[] {
		return [""];
	}

	/** 接收输入并追加到记录；data 为原始终端数据，无返回值。 */
	handleInput(data: string): void {
		this.inputs.push(data);
	}

	/** 满足 Component 接口的空失效方法；无参数，无返回值。 */
	invalidate(): void {}
}

/**
 * 在模拟支持图片的 Ghostty 环境中执行回调并可靠恢复环境。
 * 参数：fn 为需要终端能力环境的同步函数。
 * 返回值：fn 的原始返回值。
 * 使用示例：`withImageTerminal(() => { ... })`。
 */
function withImageTerminal<T>(fn: () => T): T {
	// prevTermProgram 保存原 TERM_PROGRAM 值，可能未定义。
	const prevTermProgram = process.env.TERM_PROGRAM;
	// prevTerm 保存原 TERM 值，可能未定义。
	const prevTerm = process.env.TERM;
	// prevGhosttyResourcesDir 保存原 Ghostty 资源目录值，可能未定义。
	const prevGhosttyResourcesDir = process.env.GHOSTTY_RESOURCES_DIR;

	process.env.TERM_PROGRAM = "ghostty";
	delete process.env.TERM;
	delete process.env.GHOSTTY_RESOURCES_DIR;
	resetCapabilitiesCache();

	try {
		return fn();
	} finally {
		if (prevTermProgram === undefined) delete process.env.TERM_PROGRAM;
		else process.env.TERM_PROGRAM = prevTermProgram;
		if (prevTerm === undefined) delete process.env.TERM;
		else process.env.TERM = prevTerm;
		if (prevGhosttyResourcesDir === undefined) delete process.env.GHOSTTY_RESOURCES_DIR;
		else process.env.GHOSTTY_RESOURCES_DIR = prevGhosttyResourcesDir;
		resetCapabilitiesCache();
	}
}

describe("TUI cell size responses", () => {
	// 验证启动尺寸查询期间的单独 Escape 仍转发给焦点组件；无参数，无返回值。
	it("forwards bare escape even when a cell size query was sent at startup", () => {
		withImageTerminal(() => {
			// terminal 是 80×24 的内存虚拟终端。
			const terminal = new VirtualTerminal(80, 24);
			// tui 是绑定虚拟终端的用户界面实例。
			const tui = new TUI(terminal);
			// recorder 是当前焦点输入记录组件。
			const recorder = new InputRecorder();

			tui.setFocus(recorder);
			tui.start();

			terminal.sendInput("\x1b");

			assert.deepStrictEqual(recorder.inputs, ["\x1b"]);
			tui.stop();
		});
	});

	// 验证尺寸协议响应被消费，但其后的普通字符仍被转发；无参数，无返回值。
	it("consumes cell size responses and still forwards later user input", () => {
		withImageTerminal(() => {
			setCellDimensions({ widthPx: 9, heightPx: 18 });

			// terminal 是接收尺寸响应和用户输入的内存虚拟终端。
			const terminal = new VirtualTerminal(80, 24);
			// tui 是绑定虚拟终端的用户界面实例。
			const tui = new TUI(terminal);
			// recorder 只应记录尺寸响应之后的 q 字符。
			const recorder = new InputRecorder();

			tui.setFocus(recorder);
			tui.start();

			terminal.sendInput("\x1b[6;20;10t");
			assert.deepStrictEqual(recorder.inputs, []);
			assert.deepStrictEqual(getCellDimensions(), { widthPx: 10, heightPx: 20 });

			terminal.sendInput("q");
			assert.deepStrictEqual(recorder.inputs, ["q"]);
			tui.stop();
		});
	});
});
