/**
 * 文件职责：提供基于 xterm.js 的内存虚拟终端，供 TUI 测试精确观察屏幕、滚动区和光标状态。
 * 技术维度：实现项目 Terminal 接口，并使用 @xterm/headless 解析 ANSI/OSC 控制序列和异步写入。
 * 产品维度：让终端界面在不启动真实交互终端的情况下得到稳定回归测试，降低不同平台造成的差异。
 * 逻辑维度：封装终端生命周期与写入，再提供输入、缩放、刷新、视口和光标等测试辅助方法。
 * 关键边界：该实现没有真实 stdin；Kitty 协议固定为启用；异步写入后需调用 flush 或等待渲染。
 * 新手阅读建议：先对照 Terminal 接口阅读 start/write/stop，再看 xterm 缓冲区如何转换为测试字符串。
 */
import type { Terminal as XtermTerminalType } from "@xterm/headless";
import xterm from "@xterm/headless";
import type { Terminal } from "../src/terminal.ts";

// Extract Terminal class from the module
// 从 CommonJS 兼容模块对象中取出实际的 Terminal 构造器。
// XtermTerminal 是创建无界面终端模拟器所用的运行时类。
const XtermTerminal = xterm.Terminal;

/**
 * Virtual terminal for testing using xterm.js for accurate terminal emulation
 */
/**
 * 基于 xterm.js 的测试虚拟终端，用于准确模拟控制序列、屏幕缓冲区和光标移动。
 * 设计目的：以最小可控对象替代真实终端；核心功能：实现 Terminal 并暴露测试查询方法；使用场景：TUI 组件和渲染回归测试。
 */
export class VirtualTerminal implements Terminal {
	// xterm 保存真正解析终端控制序列的 headless xterm 实例。
	private xterm: XtermTerminalType;
	// inputHandler 保存 start 注册的输入回调；停止后清空。
	private inputHandler?: (data: string) => void;
	// resizeHandler 保存尺寸变化回调；停止后清空。
	private resizeHandler?: () => void;
	// _columns 保存当前列数，必须与 xterm 尺寸同步。
	private _columns: number;
	// _rows 保存当前行数，必须与 xterm 尺寸同步。
	private _rows: number;

	/**
	 * 创建指定尺寸的虚拟终端。
	 * @param columns 列数，默认 80。
	 * @param rows 行数，默认 24。
	 * @returns 新 VirtualTerminal 实例；例如 `new VirtualTerminal(100, 30)`。
	 */
	constructor(columns = 80, rows = 24) {
		this._columns = columns;
		this._rows = rows;

		// Create xterm instance with specified dimensions
		// 按指定行列数创建 xterm 实例。
		this.xterm = new XtermTerminal({
			cols: columns,
			rows: rows,
			// Disable all interactive features for testing
			// 测试中禁用真实交互输入，只保留缓冲区和控制序列解析。
			disableStdin: true,
			allowProposedApi: true,
		});
	}

	/**
	 * 启动终端并注册输入与缩放回调。
	 * @param onInput 模拟输入到达时调用的处理器。
	 * @param onResize 尺寸变化时调用的处理器。
	 * @returns 无返回值；例如 `terminal.start(handleInput, handleResize)`。
	 */
	start(onInput: (data: string) => void, onResize: () => void): void {
		this.inputHandler = onInput;
		this.resizeHandler = onResize;
		// Enable bracketed paste mode for consistency with ProcessTerminal
		// 启用括号粘贴模式，使虚拟终端启动状态与 ProcessTerminal 一致。
		this.xterm.write("\x1b[?2004h");
	}

	/**
	 * 兼容真实终端的输入排空接口；虚拟终端没有 stdin，因此立即完成。
	 * @param _maxMs 未使用的最长等待毫秒数。
	 * @param _idleMs 未使用的空闲判定毫秒数。
	 * @returns 已完成的 Promise；例如 `await terminal.drainInput()`。
	 */
	async drainInput(_maxMs?: number, _idleMs?: number): Promise<void> {
		// No-op for virtual terminal - no stdin to drain
		// 虚拟终端没有标准输入缓冲区，因此这里不执行任何操作。
	}

	/** 停止终端、关闭括号粘贴模式并清除回调；无参数、无返回值，例如 `terminal.stop()`。 */
	stop(): void {
		// Disable bracketed paste mode
		// 写入控制序列关闭括号粘贴模式。
		this.xterm.write("\x1b[?2004l");
		this.inputHandler = undefined;
		this.resizeHandler = undefined;
	}

	/** 写入待解析的终端数据；参数 data 可含 ANSI 序列；无返回值，例如 `terminal.write("hello")`。 */
	write(data: string): void {
		this.xterm.write(data);
	}

	/** 获取当前列数；返回正整数，例如 `terminal.columns`。 */
	get columns(): number {
		return this._columns;
	}

	/** 获取当前行数；返回正整数，例如 `terminal.rows`。 */
	get rows(): number {
		return this._rows;
	}

	/** 获取 Kitty 键盘协议状态；测试终端固定返回 true，例如 `terminal.kittyProtocolActive`。 */
	get kittyProtocolActive(): boolean {
		// Virtual terminal always reports Kitty protocol as active for testing
		// 测试虚拟终端始终声明 Kitty 协议已启用，保持按键编码路径稳定。
		return true;
	}

	/**
	 * 相对当前光标上下移动。
	 * @param lines 正数向下、负数向上、0 不移动。
	 * @returns 无返回值；例如 `terminal.moveBy(-2)` 向上两行。
	 */
	moveBy(lines: number): void {
		if (lines > 0) {
			// Move down
			// 正数通过 CSI B 控制序列向下移动。
			this.xterm.write(`\x1b[${lines}B`);
		} else if (lines < 0) {
			// Move up
			// 负数取绝对值后通过 CSI A 控制序列向上移动。
			this.xterm.write(`\x1b[${-lines}A`);
		}
		// lines === 0: no movement
		// lines 为 0 时不写入控制序列，光标保持原位。
	}

	/** 隐藏光标；无参数、无返回值，例如 `terminal.hideCursor()`。 */
	hideCursor(): void {
		this.xterm.write("\x1b[?25l");
	}

	/** 显示光标；无参数、无返回值，例如 `terminal.showCursor()`。 */
	showCursor(): void {
		this.xterm.write("\x1b[?25h");
	}

	/** 清除光标到当前行末尾的内容；无参数、无返回值，例如 `terminal.clearLine()`。 */
	clearLine(): void {
		this.xterm.write("\x1b[K");
	}

	/** 清除光标到屏幕末尾的内容；无参数、无返回值，例如 `terminal.clearFromCursor()`。 */
	clearFromCursor(): void {
		this.xterm.write("\x1b[J");
	}

	/** 清空屏幕并把光标移到左上角；无参数、无返回值，例如 `terminal.clearScreen()`。 */
	clearScreen(): void {
		this.xterm.write("\x1b[2J\x1b[H"); // Clear screen and move to home (1,1)
		// 上述序列同时清屏并把光标移动到坐标 (1,1)。
	}

	/** 设置终端窗口标题；参数 title 为标题文本；无返回值，例如 `terminal.setTitle("Tests")`。 */
	setTitle(title: string): void {
		// OSC 0;title BEL - set terminal window title
		// 使用 OSC 0 与 BEL 结束符设置终端标题。
		this.xterm.write(`\x1b]0;${title}\x07`);
	}

	/** 兼容进度状态接口；参数 _active 表示是否活动，但测试实现无需处理；无返回值。 */
	setProgress(_active: boolean): void {}

	// Test-specific methods not in Terminal interface
	// 以下方法仅服务测试断言，不属于正式 Terminal 接口。

	/**
	 * Simulate keyboard input
	 */
	/** 参数 data 是要送入已注册回调的键盘数据；无返回值，例如 `terminal.sendInput("a")`。 */
	sendInput(data: string): void {
		if (this.inputHandler) {
			this.inputHandler(data);
		}
	}

	/**
	 * Resize the terminal
	 */
	/** 参数 columns/rows 是新尺寸；同步 xterm 后触发回调；无返回值，例如 `terminal.resize(120, 40)`。 */
	resize(columns: number, rows: number): void {
		this._columns = columns;
		this._rows = rows;
		this.xterm.resize(columns, rows);
		if (this.resizeHandler) {
			this.resizeHandler();
		}
	}

	/**
	 * Wait for all pending writes to complete. Viewport and scroll buffer will be updated.
	 */
	/** 等待此前异步写入全部进入缓冲区；返回完成 Promise，例如 `await terminal.flush()`。 */
	async flush(): Promise<void> {
		// Write an empty string to ensure all previous writes are flushed
		// 追加空写入并等待其回调，可确保此前写入已按顺序处理完毕。
		return new Promise<void>((resolve) => {
			this.xterm.write("", () => resolve());
		});
	}

	/**
	 * Flush and get viewport - convenience method for tests
	 */
	/** 先刷新再读取可见视口；返回每行文本数组，例如 `await terminal.flushAndGetViewport()`。 */
	async flushAndGetViewport(): Promise<string[]> {
		await this.flush();
		return this.getViewport();
	}

	/**
	 * Get the visible viewport (what's currently on screen)
	 * Note: You should use getViewportAfterWrite() for testing after writing data
	 */
	/** 返回当前可见区域的逐行文本；写入后应先 flush，例如 `terminal.getViewport()`。 */
	getViewport(): string[] {
		// lines 逐行累积当前视口文本，空白行保存为空字符串。
		const lines: string[] = [];
		// buffer 是 xterm 当前活动的屏幕与滚动缓冲区。
		const buffer = this.xterm.buffer.active;

		// Get only the visible lines (viewport)
		// 只遍历从 viewportY 开始的可见行，不包含上方滚动历史。
		for (let i = 0; i < this.xterm.rows; i++) {
			// line 是缓冲区中当前视口对应的单行对象，越界时可能不存在。
			const line = buffer.getLine(buffer.viewportY + i);
			if (line) {
				lines.push(line.translateToString(true));
			} else {
				lines.push("");
			}
		}

		return lines;
	}

	/**
	 * Get the entire scroll buffer
	 */
	/** 返回包括滚动历史在内的全部缓冲区文本行；例如 `terminal.getScrollBuffer()`。 */
	getScrollBuffer(): string[] {
		// lines 按缓冲区索引保存所有历史与当前屏幕行。
		const lines: string[] = [];
		// buffer 是待读取的活动 xterm 缓冲区。
		const buffer = this.xterm.buffer.active;

		// Get all lines in the buffer (including scrollback)
		// 遍历缓冲区完整长度，包括已经滚出可见区域的行。
		for (let i = 0; i < buffer.length; i++) {
			// line 是当前位置的缓冲行；不存在时用空字符串占位。
			const line = buffer.getLine(i);
			if (line) {
				lines.push(line.translateToString(true));
			} else {
				lines.push("");
			}
		}

		return lines;
	}

	/**
	 * Clear the terminal viewport
	 */
	/** 清空当前视口内容；无参数、无返回值，例如 `terminal.clear()`。 */
	clear(): void {
		this.xterm.clear();
	}

	/**
	 * Reset the terminal completely
	 */
	/** 把终端状态完全恢复到 xterm 默认值；无参数、无返回值，例如 `terminal.reset()`。 */
	reset(): void {
		this.xterm.reset();
	}

	/**
	 * Get cursor position
	 */
	/** 返回零基光标坐标 `{ x, y }`；例如 `terminal.getCursorPosition()`。 */
	getCursorPosition(): { x: number; y: number } {
		// buffer 提供最新光标横纵坐标。
		const buffer = this.xterm.buffer.active;
		return {
			x: buffer.cursorX,
			y: buffer.cursorY,
		};
	}

	/** Wait for TUI's throttled render pipeline to settle. */
	/** 等待 TUI 节流渲染、定时器和 xterm 写入全部完成；返回 Promise，例如 `await terminal.waitForRender()`。 */
	async waitForRender(): Promise<void> {
		await new Promise<void>((resolve) => process.nextTick(resolve));
		await new Promise<void>((resolve) => setTimeout(resolve, 20));
		await this.flush();
	}
}
