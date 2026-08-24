/**
 * 文件职责：验证终端背景色 OSC 11 响应、颜色方案报告解析，以及 TUI 查询期间对输入事件的拦截规则。
 * 技术维度：使用 Node.js test/assert、自定义 Terminal/Component 测试替身和异步超时模拟终端协议交互。
 * 产品维度：让 TUI 自动适配深浅色终端，并防止协议回复被误当成用户输入传给组件或监听器。
 * 逻辑维度：先定义可记录写入的终端和输入组件，再测试纯解析函数，最后测试查询、分流和超时行为。
 * 关键边界：OSC 响应必须完整严格匹配；超时后的迟到回复仍需被消费；测试终端不执行真实控制序列。
 * 新手阅读建议：先看 TestTerminal/InputRecorder，再从纯解析用例过渡到 queryTerminalBackgroundColor 的异步流程。
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import {
	type Component,
	parseOsc11BackgroundColor,
	parseTerminalColorSchemeReport,
	type Terminal,
	TUI,
} from "../src/index.ts";

/** TestTerminal 是最小 Terminal 替身，记录写入并允许测试主动发送输入和缩放事件。 */
class TestTerminal implements Terminal {
	// inputHandler 保存 TUI start 注册的终端输入回调。
	private inputHandler?: (data: string) => void;
	// resizeHandler 保存 TUI start 注册的尺寸变化回调。
	private resizeHandler?: () => void;
	// columnCount 是固定测试列数。
	private readonly columnCount: number;
	// rowCount 是固定测试行数。
	private readonly rowCount: number;
	// writes 记录 TUI 写入的所有协议序列和文本。
	readonly writes: string[] = [];

	/** 创建固定尺寸终端；参数 columnCount/rowCount 默认 80×24；返回 TestTerminal 实例。 */
	constructor(columnCount = 80, rowCount = 24) {
		this.columnCount = columnCount;
		this.rowCount = rowCount;
	}

	/** 注册输入与缩放回调；参数 onInput/onResize 为处理器；无返回值。 */
	start(onInput: (data: string) => void, onResize: () => void): void {
		this.inputHandler = onInput;
		this.resizeHandler = onResize;
	}

	/** 清除已注册回调；无参数、无返回值。 */
	stop(): void {
		this.inputHandler = undefined;
		this.resizeHandler = undefined;
	}

	/** 虚拟排空输入；参数仅兼容接口；返回立即完成 Promise。 */
	async drainInput(_maxMs?: number, _idleMs?: number): Promise<void> {}

	/** 记录终端写入；参数 data 为文本或控制序列；无返回值。 */
	write(data: string): void {
		this.writes.push(data);
	}

	/** 返回固定列数。 */
	get columns(): number {
		return this.columnCount;
	}

	/** 返回固定行数。 */
	get rows(): number {
		return this.rowCount;
	}

	/** 测试终端不启用 Kitty 协议，固定返回 false。 */
	get kittyProtocolActive(): boolean {
		return false;
	}

	/** 兼容相对移动接口；参数未使用；无返回值。 */
	moveBy(_lines: number): void {}

	/** 兼容隐藏光标接口；测试替身无需动作。 */
	hideCursor(): void {}

	/** 兼容显示光标接口；测试替身无需动作。 */
	showCursor(): void {}

	/** 兼容清行接口；测试替身无需动作。 */
	clearLine(): void {}

	/** 兼容从光标清屏接口；测试替身无需动作。 */
	clearFromCursor(): void {}

	/** 兼容全屏清理接口；测试替身无需动作。 */
	clearScreen(): void {}

	/** 兼容标题接口；参数未使用；无返回值。 */
	setTitle(_title: string): void {}

	/** 兼容进度状态接口；参数未使用；无返回值。 */
	setProgress(_active: boolean): void {}

	/** 模拟键盘/协议输入；参数 data 为原始终端数据；无返回值。 */
	sendInput(data: string): void {
		this.inputHandler?.(data);
	}

	/** 主动触发已注册缩放回调；无参数、无返回值。 */
	sendResize(): void {
		this.resizeHandler?.();
	}
}

/** InputRecorder 是记录 TUI 分发输入的最小可聚焦组件。 */
class InputRecorder implements Component {
	// inputs 按到达顺序保存组件收到的原始输入。
	readonly inputs: string[] = [];

	/** 测试组件不渲染内容；参数宽度未使用；返回空行数组。 */
	render(_width: number): string[] {
		return [];
	}

	/** 记录输入；参数 data 为分发文本；无返回值。 */
	handleInput(data: string): void {
		this.inputs.push(data);
	}

	/** 兼容组件失效接口；无参数、无返回值。 */
	invalidate(): void {}
}

// wait 是基于 setTimeout 的毫秒延迟辅助器，例如 `await wait(5)`。
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// 验证 OSC 11 背景色回复支持的 RGB 格式和严格边界。
describe("parseOsc11BackgroundColor", () => {
	it("parses 16-bit OSC 11 rgb responses", () => {
		assert.deepStrictEqual(parseOsc11BackgroundColor("\x1b]11;rgb:0000/8000/ffff\x07"), {
			r: 0,
			g: 128,
			b: 255,
		});
	});

	it("parses OSC 11 hex responses", () => {
		assert.deepStrictEqual(parseOsc11BackgroundColor("\x1b]11;#ffffff\x1b\\"), { r: 255, g: 255, b: 255 });
		assert.deepStrictEqual(parseOsc11BackgroundColor("\x1b]11;#000000\x07"), { r: 0, g: 0, b: 0 });
	});

	it("rejects non-strict OSC 11 responses", () => {
		assert.strictEqual(parseOsc11BackgroundColor(`x\x1b]11;#ffffff\x07`), undefined);
		assert.strictEqual(parseOsc11BackgroundColor("\x1b]10;#ffffff\x07"), undefined);
		assert.strictEqual(parseOsc11BackgroundColor("\x1b]11;#ffffff\x07x"), undefined);
	});
});

// 验证终端颜色方案报告只接受标准 997 状态序列。
describe("parseTerminalColorSchemeReport", () => {
	it("parses color scheme reports", () => {
		assert.strictEqual(parseTerminalColorSchemeReport("\x1b[?997;1n"), "dark");
		assert.strictEqual(parseTerminalColorSchemeReport("\x1b[?997;2n"), "light");
		assert.strictEqual(parseTerminalColorSchemeReport("\x1b[?997;3n"), undefined);
		assert.strictEqual(parseTerminalColorSchemeReport("\x1b[?996n"), undefined);
		assert.strictEqual(parseTerminalColorSchemeReport("x\x1b[?997;1n"), undefined);
	});
});

// 验证 TUI 发出 OSC 11 查询并在等待窗口内正确分流输入。
describe("TUI.queryTerminalBackgroundColor", () => {
	// 合法 RGB 回复应解析并完成查询 Promise。
	it("writes OSC 11 query and resolves with the parsed RGB reply", async () => {
		// terminal 记录查询序列并提供输入注入能力。
		const terminal = new TestTerminal();
		// tui 是使用测试终端的真实 TUI 实例。
		const tui = new TUI(terminal);
		tui.start();
		try {
			// query 是等待 OSC 11 回复的异步查询。
			const query = tui.queryTerminalBackgroundColor({ timeoutMs: 1000 });
			assert.ok(terminal.writes.includes("\x1b]11;?\x07"));

			terminal.sendInput("\x1b]11;#ffffff\x07");

			assert.deepStrictEqual(await query, { r: 255, g: 255, b: 255 });
		} finally {
			tui.stop();
		}
	});

	// OSC 11 回复应由查询层消费，不传播到普通监听器和焦点组件。
	it("consumes OSC 11 replies before input listeners and focused component dispatch", async () => {
		// terminal、tui、component 构成可观察输入分发链。
		const terminal = new TestTerminal();
		const tui = new TUI(terminal);
		const component = new InputRecorder();
		// listenerInputs 记录普通输入监听器收到的数据。
		const listenerInputs: string[] = [];
		tui.addChild(component);
		tui.setFocus(component);
		tui.addInputListener((data) => {
			listenerInputs.push(data);
			return undefined;
		});
		tui.start();
		try {
			// query 等待有效黑色背景回复。
			const query = tui.queryTerminalBackgroundColor({ timeoutMs: 1000 });

			terminal.sendInput("\x1b]11;#000000\x07");

			assert.deepStrictEqual(await query, { r: 0, g: 0, b: 0 });
			assert.deepStrictEqual(listenerInputs, []);
			assert.deepStrictEqual(component.inputs, []);
		} finally {
			tui.stop();
		}
	});

	// 形状严格但颜色内容无效的回复也应被消费，并解析为 undefined。
	it("consumes unparseable strict OSC 11 replies and resolves undefined", async () => {
		// terminal、tui、component 用于确认无效协议回复不会向下传播。
		const terminal = new TestTerminal();
		const tui = new TUI(terminal);
		const component = new InputRecorder();
		// listenerInputs 观察普通监听器是否收到协议文本。
		const listenerInputs: string[] = [];
		tui.addChild(component);
		tui.setFocus(component);
		tui.addInputListener((data) => {
			listenerInputs.push(data);
			return undefined;
		});
		tui.start();
		try {
			// query 是待无效颜色回复结束的 Promise。
			const query = tui.queryTerminalBackgroundColor({ timeoutMs: 1000 });

			terminal.sendInput("\x1b]11;not-a-color\x07");

			assert.strictEqual(await query, undefined);
			assert.deepStrictEqual(listenerInputs, []);
			assert.deepStrictEqual(component.inputs, []);
		} finally {
			tui.stop();
		}
	});

	// 等待回复期间的普通字符仍应正常传给监听器和组件，查询保持未完成。
	it("dispatches non-matching input normally while waiting for an OSC 11 reply", async () => {
		// terminal、tui、component 构成真实输入路由。
		const terminal = new TestTerminal();
		const tui = new TUI(terminal);
		const component = new InputRecorder();
		// listenerInputs 保存监听器收到的非协议输入。
		const listenerInputs: string[] = [];
		tui.addChild(component);
		tui.setFocus(component);
		tui.addInputListener((data) => {
			listenerInputs.push(data);
			return undefined;
		});
		tui.start();
		try {
			// settled 标记颜色查询是否已完成。
			let settled = false;
			// query 在完成时更新 settled 并返回 RGB。
			const query = tui.queryTerminalBackgroundColor({ timeoutMs: 1000 }).then((rgb) => {
				settled = true;
				return rgb;
			});

			terminal.sendInput("x");
			await Promise.resolve();

			assert.strictEqual(settled, false);
			assert.deepStrictEqual(listenerInputs, ["x"]);
			assert.deepStrictEqual(component.inputs, ["x"]);

			terminal.sendInput("\x1b]11;#ffffff\x07");
			assert.deepStrictEqual(await query, { r: 255, g: 255, b: 255 });
		} finally {
			tui.stop();
		}
	});

	// 查询超时后到达的严格 OSC 11 回复仍应被吞掉，不污染输入。
	it("keeps consuming a late OSC 11 reply after timeout", async () => {
		// terminal、tui、component 用于观察迟到回复分流。
		const terminal = new TestTerminal();
		const tui = new TUI(terminal);
		const component = new InputRecorder();
		// listenerInputs 记录超时后的普通监听器输入。
		const listenerInputs: string[] = [];
		tui.addChild(component);
		tui.setFocus(component);
		tui.addInputListener((data) => {
			listenerInputs.push(data);
			return undefined;
		});
		tui.start();
		try {
			// query 使用 1ms 超时，确保先以 undefined 结束。
			const query = tui.queryTerminalBackgroundColor({ timeoutMs: 1 });
			await wait(5);

			assert.strictEqual(await query, undefined);

			terminal.sendInput("\x1b]11;#ffffff\x07");

			assert.deepStrictEqual(listenerInputs, []);
			assert.deepStrictEqual(component.inputs, []);
		} finally {
			tui.stop();
		}
	});
});
