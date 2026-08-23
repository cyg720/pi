import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { setKittyProtocolActive } from "./keys.ts";
import { isNativeModifierPressed } from "./native-modifiers.ts";
import { StdinBuffer } from "./stdin-buffer.ts";

const cjsRequire = createRequire(import.meta.url);

// 进度指示的保活间隔：未写输出时仍定时发送活动序列，防止终端认为会话空闲
const TERMINAL_PROGRESS_KEEPALIVE_MS = 1000;
// 进度活动转义序列：通知终端“仍有工作在进行”
const TERMINAL_PROGRESS_ACTIVE_SEQUENCE = "\x1b]9;4;3\x07";
// 进度清除转义序列：通知终端进度指示结束
const TERMINAL_PROGRESS_CLEAR_SEQUENCE = "\x1b]9;4;0;\x07";
// Apple Terminal 的 Shift+Enter 特殊序列：与普通回车区分
const APPLE_TERMINAL_SHIFT_ENTER_SEQUENCE = "\x1b[13;2u";
// 请求的 Kitty 键盘协议标志位：1 消歧 + 2 事件类型 + 4 备用键
const DESIRED_KITTY_KEYBOARD_PROTOCOL_FLAGS = 7;
// Kitty 协议响应分片超时：等待拆分的响应片段到达的最长时间（毫秒）
const KEYBOARD_PROTOCOL_RESPONSE_FRAGMENT_TIMEOUT_MS = 150;
// 完整的协议探测序列：请求标志 + 查询标志 + DA 哨兵（用于无 Kitty 支持的终端回退）
const KITTY_KEYBOARD_PROTOCOL_QUERY = `\x1b[>${DESIRED_KITTY_KEYBOARD_PROTOCOL_FLAGS}u\x1b[?u\x1b[c`;

/**
 * 【文件职责】实现终端进程封装（ProcessTerminal）：管理 stdin/stdout 原始模式、
 *              Kitty 键盘协议协商、括号粘贴、Windows VT 输入、进度指示与调试写日志。
 * 【技术维度】node:process stdin/stdout 事件驱动；StdinBuffer 拆包；原生模块按需加载
 *              （darwin 修饰键 / win32 VT 控制台模式）；转义序列状态机。
 * 【产品维度】是 TUI 与真实终端的唯一桥梁：协议协商失败也能优雅回退到传统输入，
 *              保证跨终端（iTerm/Kitty/Windows Terminal/macOS 终端）一致可用。
 * 【逻辑维度】顶层工具函数（协议解析/苹果终端归一化）→ Terminal 接口 → ProcessTerminal
 *              实现：start 建流水线 → 协商缓冲与转发 → drainInput 排空输入 → stop 复原 →
 *              输出与尺寸工具。
 * 【关键边界】必须成对调用 start/stop 否则终端状态错乱；drainInput 期间输入被静默丢弃；
 *              原生助手缺失时降级（Shift+Enter/Shift+Tab 可能无法区分）；
 *              writeLogPath 由 PI_TUI_WRITE_LOG 环境变量控制。
 * 【新手阅读建议】先读 Terminal 接口了解对外契约 → 再读 start/stop 理解生命周期 →
 *              最后研究 Kitty 协议协商状态机（setupStdinBuffer → readKeyboardProtocol…）。
 */
export type KeyboardProtocolNegotiationSequence =
	| { type: "kitty-flags"; flags: number }
	| { type: "device-attributes" };

// 解析键盘协议协商序列（公开）：识别 kitty-flags（CSI>N;…u）与 DA（CSI?…c）两类响应
export function parseKeyboardProtocolNegotiationSequence(
	sequence: string,
): KeyboardProtocolNegotiationSequence | undefined {
	const kittyFlags = sequence.match(/^\x1b\[\?(\d+)u$/);
	if (kittyFlags) {
		return { type: "kitty-flags", flags: Number.parseInt(kittyFlags[1]!, 10) };
	}
	if (/^\x1b\[\?[\d;]*c$/.test(sequence)) {
		return { type: "device-attributes" };
	}
	return undefined;
}

// 判断序列是否为协商响应的前缀（私有）：用于缓存拆分的响应片段
function isKeyboardProtocolNegotiationSequencePrefix(sequence: string): boolean {
	return sequence === "\x1b[" || /^\x1b\[\?[\d;]*$/.test(sequence);
}

// 检测当前是否运行在 Apple Terminal 中（公开）：通过 TERM_PROGRAM 环境变量判断
export function isAppleTerminalSession(): boolean {
	return process.platform === "darwin" && process.env.TERM_PROGRAM === "Apple_Terminal";
}

// 归一化 Apple Terminal 输入（公开）：连续两次回车且第二次带 shift 修饰时
// 合成 Shift+Enter 序列，否则原样透传
export function normalizeAppleTerminalInput(data: string, isAppleTerminal: boolean, isShiftPressed: boolean): string {
	if (isAppleTerminal && data === "\r" && isShiftPressed) return APPLE_TERMINAL_SHIFT_ENTER_SEQUENCE;
	return data;
}

/**
 * Minimal terminal interface for TUI
 */
/**
 * 终端接口（中文说明）：所有 TUI 输出/输入/终端模式操作的总契约。
 */
export interface Terminal {
	// Start the terminal with input and resize handlers
	start(onInput: (data: string) => void, onResize: () => void): void;

	// Stop the terminal and restore state
	stop(): void;

	/**
	 * Drain stdin before exiting to prevent Kitty key release events from
	 * leaking to the parent shell over slow SSH connections.
	 * @param maxMs - Maximum time to drain (default: 1000ms)
	 * @param idleMs - Exit early if no input arrives within this time (default: 50ms)
	 */
	drainInput(maxMs?: number, idleMs?: number): Promise<void>;

	// Write output to terminal
	write(data: string): void;

	// Get terminal dimensions
	// 终端列宽（列数）
	get columns(): number;
	// 终端行高（行数）
	get rows(): number;

	// Whether Kitty keyboard protocol is active
	get kittyProtocolActive(): boolean;

	// Cursor positioning (relative to current position)
	moveBy(lines: number): void; // Move cursor up (negative) or down (positive) by N lines

	// Cursor visibility
	hideCursor(): void; // Hide the cursor
	showCursor(): void; // Show the cursor

	// Clear operations
	clearLine(): void; // Clear current line
	clearFromCursor(): void; // Clear from cursor to end of screen
	clearScreen(): void; // Clear entire screen and move cursor to (0,0)

	// Title operations
	setTitle(title: string): void; // Set terminal window title

	// Progress indicator (OSC 9;4)
	setProgress(active: boolean): void;
}

/**
 * Real terminal using process.stdin/stdout
 */
/**
 * ProcessTerminal（中文说明）：基于 node:process 的真实终端实现。
 * 维护原始模式、输入分发、协议协商、进度指示与写日志等全部运行时状态。
 */
export class ProcessTerminal implements Terminal {
	private wasRaw = false;
	// 进入原始模式前的 stdin.isRaw 状态：stop 时恢复
	private inputHandler?: (data: string) => void;
	// 输入分发目标回调（由 start 注入，drainInput 期间暂时置空）
	private resizeHandler?: () => void;
	// 终端尺寸变化回调
	private _kittyProtocolActive = false;
	// Kitty 键盘协议是否已激活（对外经 getter 暴露）
	private _modifyOtherKeysActive = false;
	// modifyOtherKeys 模式是否已激活
	private keyboardProtocolPushed = false;
	// 是否已向终端发送过协议查询（stop 时据此决定是否需要关闭协议）
	private keyboardProtocolNegotiationBuffer = "";
	// 协商响应的累积缓冲（响应可能被拆成多段到达）
	private keyboardProtocolBufferFlushTimer?: ReturnType<typeof setTimeout>;
	// 协商缓冲的超时冲刷定时器
	private stdinBuffer?: StdinBuffer;
	// 输入拆包缓冲器实例
	private stdinDataHandler?: (data: string) => void;
	// 注册在 process.stdin 上的原始数据处理器（stop 时移除）
	private progressInterval?: ReturnType<typeof setInterval>;
	// 进度保活定时器
	private writeLogPath = (() => {
	// 写日志文件路径：由 PI_TUI_WRITE_LOG 指定；指向目录时自动生成带时间戳与 PID 的文件名
		const env = process.env.PI_TUI_WRITE_LOG || "";
		if (!env) return "";
		try {
			if (fs.statSync(env).isDirectory()) {
				const now = new Date();
				const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(now.getSeconds()).padStart(2, "0")}`;
				return path.join(env, `tui-${ts}-${process.pid}.log`);
			}
		} catch {
			// Not an existing directory - use as-is (file path)
		}
		return env;
	})();

	// Kitty 键盘协议是否激活（只读）
	get kittyProtocolActive(): boolean {
		return this._kittyProtocolActive;
	}

	// modifyOtherKeys 是否激活（只读）
	get modifyOtherKeysActive(): boolean {
		return this._modifyOtherKeysActive;
	}

	// 启动终端（公开）：进入原始模式、启用括号粘贴、挂尺寸监听、刷新尺寸、
	// Windows 启用 VT 输入并启动 Kitty 协议协商
	start(onInput: (data: string) => void, onResize: () => void): void {
		this.inputHandler = onInput;
		this.resizeHandler = onResize;

		// Save previous state and enable raw mode
		// 记录原 raw 状态并启用原始模式（逐键直通，不做行缓冲）
		this.wasRaw = process.stdin.isRaw || false;
		if (process.stdin.setRawMode) {
			process.stdin.setRawMode(true);
		}
		process.stdin.setEncoding("utf8");
		process.stdin.resume();

		// Enable bracketed paste mode - terminal will wrap pastes in \x1b[200~ ... \x1b[201~
		// 启用括号粘贴模式：终端会以 200~/201~ 标记包裹粘贴内容
		process.stdout.write("\x1b[?2004h");

		// Set up resize handler immediately
		// 立即挂上尺寸变化监听
		process.stdout.on("resize", this.resizeHandler);

		// Refresh terminal dimensions - they may be stale after suspend/resume
		// 主动刷新终端尺寸：挂起/恢复后 SIGWINCH 可能丢失（仅类 Unix）
		// (SIGWINCH is lost while process is stopped). Unix only.
		if (process.platform !== "win32") {
			process.kill(process.pid, "SIGWINCH");
		}

		// On Windows, enable ENABLE_VIRTUAL_TERMINAL_INPUT so the console sends
		// Windows 启用 ENABLE_VIRTUAL_TERMINAL_INPUT 使控制台发送 VT 序列而非丢失修饰符的原始事件；
		// 必须在 setRawMode(true) 之后执行（后者会重置控制台模式标志）
		// VT escape sequences (e.g. \x1b[Z for Shift+Tab) instead of raw console
		// events that lose modifier information. Must run AFTER setRawMode(true)
		// since that resets console mode flags.
		this.enableWindowsVTInput();

		// Query Kitty keyboard protocol and fall back to modifyOtherKeys when DA confirms no Kitty response.
		// 探测 Kitty 键盘协议；DA 哨兵确认无响应时回退到 modifyOtherKeys
		// See: https://sw.kovidgoyal.net/kitty/keyboard-protocol/
		this.queryAndEnableKittyProtocol();
	}

	/**
	 * Set up StdinBuffer to split batched input into individual sequences.
	 * This ensures components receive single events, making matchesKey/isKeyRelease work correctly.
	 *
	 * Also watches for Kitty protocol response and enables it when detected.
	 * This is done here (after stdinBuffer parsing) rather than on raw stdin
	 * to handle the case where the response arrives split across multiple events.
	 */
	// 建立输入拆包流水线（私有）：StdinBuffer 负责把批量输入切分为单条序列，
	// 并在"data"事件里完成 Kitty 协商响应识别；paste 事件重新包上粘贴标记后转发
	private setupStdinBuffer(): void {
		this.stdinBuffer = new StdinBuffer({ timeout: 10 });

		// Forward individual sequences to the input handler
		// 把切分出的单条序列转发给输入处理器
		this.stdinBuffer.on("data", (sequence) => {
			const negotiationSequence = this.readKeyboardProtocolNegotiationSequence(sequence);
			if (negotiationSequence === "pending") {
				this.scheduleKeyboardProtocolNegotiationBufferFlush();
				return; // Wait briefly for the rest of a split Kitty response.
			}
			if (this.handleKeyboardProtocolNegotiationSequence(negotiationSequence)) {
				return;
			}

			this.forwardInputSequence(sequence);
		});

		// Re-wrap paste content with bracketed paste markers for existing editor handling
		// 粘贴内容重新包装括号粘贴标记，供既有编辑器处理逻辑使用
		this.stdinBuffer.on("paste", (content) => {
			if (this.inputHandler) {
				this.inputHandler(`\x1b[200~${content}\x1b[201~`);
			}
		});

		// Handler that pipes stdin data through the buffer
		// 把原始 stdin 数据灌入缓冲器
		this.stdinDataHandler = (data: string) => {
			this.stdinBuffer!.process(data);
		};
	}

	/**
	 * Query terminal for Kitty keyboard protocol support and enable it if available.
	 *
	 * Kitty's progressive enhancement detection requires requesting the desired
	 * flags before querying them. The trailing DA query is a sentinel supported by
	 * terminals that do not know Kitty keyboard protocol; receiving DA before a
	 * Kitty response enables modifyOtherKeys fallback without a startup timeout.
	 *
	 * The requested flags are:
	 * - 1 = disambiguate escape codes
	 * - 2 = report event types (press/repeat/release)
	 * - 4 = report alternate keys (shifted key, base layout key)
	 */
	// 发起 Kitty 协议协商（私有）：挂上 stdin 数据监听并发送探测序列
	private queryAndEnableKittyProtocol(): void {
		this.setupStdinBuffer();
		process.stdin.on("data", this.stdinDataHandler!);
		this.keyboardProtocolPushed = true;
		this.clearKeyboardProtocolNegotiationBuffer();
		process.stdout.write(KITTY_KEYBOARD_PROTOCOL_QUERY);
	}

	// 处理协商响应（私有）：kitty-flags 非零 → 停用 modifyOtherKeys 并激活 Kitty；
	// 零或无标志 → 走 modifyOtherKeys 回退
	private handleKeyboardProtocolNegotiationSequence(
		negotiationSequence: KeyboardProtocolNegotiationSequence | undefined,
	): boolean {
		if (!negotiationSequence) return false;
		this.clearKeyboardProtocolNegotiationBuffer();
		if (negotiationSequence.type === "kitty-flags") {
			if (negotiationSequence.flags !== 0) {
				this.disableModifyOtherKeys();
				if (!this._kittyProtocolActive) {
					this._kittyProtocolActive = true;
					setKittyProtocolActive(true);
				}
			} else {
				this.enableModifyOtherKeys();
			}
			return true;
		}

		if (!this._kittyProtocolActive) {
			this.enableModifyOtherKeys();
		}
		return true;
	}

	// 读取协商响应（私有）：先拼缓冲再解析，不足则按前缀缓存并返回 pending
	private readKeyboardProtocolNegotiationSequence(
		sequence: string,
	): KeyboardProtocolNegotiationSequence | "pending" | undefined {
		if (this.keyboardProtocolNegotiationBuffer) {
			const bufferedSequence = this.keyboardProtocolNegotiationBuffer + sequence;
			const negotiationSequence = parseKeyboardProtocolNegotiationSequence(bufferedSequence);
			if (negotiationSequence) {
				this.clearKeyboardProtocolNegotiationBuffer();
				return negotiationSequence;
			}
			if (isKeyboardProtocolNegotiationSequencePrefix(bufferedSequence)) {
				this.setKeyboardProtocolNegotiationBuffer(bufferedSequence);
				return "pending";
			}
			this.flushKeyboardProtocolNegotiationBufferAsInput();
		}

		const negotiationSequence = parseKeyboardProtocolNegotiationSequence(sequence);
		if (negotiationSequence) return negotiationSequence;
		if (isKeyboardProtocolNegotiationSequencePrefix(sequence)) {
			this.setKeyboardProtocolNegotiationBuffer(sequence);
			return "pending";
		}
		return undefined;
	}

	// 写入协商缓冲（私有）：同时清理冲刷定时器
	private setKeyboardProtocolNegotiationBuffer(sequence: string): void {
		this.clearKeyboardProtocolNegotiationBufferFlushTimer();
		this.keyboardProtocolNegotiationBuffer = sequence;
	}

	// 清空协商缓冲（私有）
	private clearKeyboardProtocolNegotiationBuffer(): void {
		this.clearKeyboardProtocolNegotiationBufferFlushTimer();
		this.keyboardProtocolNegotiationBuffer = "";
	}

	// 把缓冲中的内容作为普通输入冲刷转发（私有）：超时后仍非协商响应的兜底
	private flushKeyboardProtocolNegotiationBufferAsInput(): void {
		if (!this.keyboardProtocolNegotiationBuffer) return;
		const sequence = this.keyboardProtocolNegotiationBuffer;
		this.clearKeyboardProtocolNegotiationBuffer();
		this.forwardInputSequence(sequence);
	}

	// 安排协商缓冲的超时冲刷（私有）：响应被拆散时等待补齐，超时后按输入处理
	private scheduleKeyboardProtocolNegotiationBufferFlush(): void {
		if (!this.keyboardProtocolNegotiationBuffer || this.keyboardProtocolBufferFlushTimer) return;
		this.keyboardProtocolBufferFlushTimer = setTimeout(() => {
			this.keyboardProtocolBufferFlushTimer = undefined;
			this.flushKeyboardProtocolNegotiationBufferAsInput();
		}, KEYBOARD_PROTOCOL_RESPONSE_FRAGMENT_TIMEOUT_MS);
	}

	// 清除冲刷定时器（私有）
	private clearKeyboardProtocolNegotiationBufferFlushTimer(): void {
		if (!this.keyboardProtocolBufferFlushTimer) return;
		clearTimeout(this.keyboardProtocolBufferFlushTimer);
		this.keyboardProtocolBufferFlushTimer = undefined;
	}

	// 转发输入序列（私有）：Apple Terminal 下对回车做 shift 归一化后交给输入处理器
	private forwardInputSequence(sequence: string): void {
		if (!this.inputHandler) return;
		const isAppleTerminal = sequence === "\r" && isAppleTerminalSession();
		const input = normalizeAppleTerminalInput(
			sequence,
			isAppleTerminal,
			isAppleTerminal && isNativeModifierPressed("shift"),
		);
		this.inputHandler(input);
	}

	// 启用 modifyOtherKeys 模式（私有）：发送 CSI>4;2m；Kitty 已激活或已启用则跳过
	private enableModifyOtherKeys(): void {
		if (this._kittyProtocolActive || this._modifyOtherKeysActive) return;
		process.stdout.write("\x1b[>4;2m");
		this._modifyOtherKeysActive = true;
	}

	// 停用 modifyOtherKeys 模式（私有）：发送 CSI>4;0m
	private disableModifyOtherKeys(): void {
		if (!this._modifyOtherKeysActive) return;
		process.stdout.write("\x1b[>4;0m");
		this._modifyOtherKeysActive = false;
	}

	/**
	 * On Windows, add ENABLE_VIRTUAL_TERMINAL_INPUT (0x0200) to the stdin
	 * console handle so the terminal sends VT sequences for modified keys
	 * (e.g. \x1b[Z for Shift+Tab). Without this, libuv's ReadConsoleInputW
	 * discards modifier state and Shift+Tab arrives as plain \t.
	 */
	// 启用 Windows VT 输入（私有）：动态加载 win32 原生助手设置控制台模式标志；
	// 原生助手不可用则静默降级
	private enableWindowsVTInput(): void {
		if (process.platform !== "win32") return;
		try {
			const arch = process.arch;
			if (arch !== "x64" && arch !== "arm64") return;

			// Dynamic require so non-Windows and bundled/browser paths never load the
			// native helper. In the npm package native/ is next to dist/; in compiled
			// binary archives native/ is copied next to the executable.
			const moduleDir = path.dirname(fileURLToPath(import.meta.url));
			const nativePath = path.join("native", "win32", "prebuilds", `win32-${arch}`, "win32-console-mode.node");
			const candidates = [
				path.join(moduleDir, "..", nativePath),
				path.join(moduleDir, nativePath),
				path.join(path.dirname(process.execPath), nativePath),
			];
			for (const modulePath of candidates) {
				try {
					const helper = cjsRequire(modulePath) as { enableVirtualTerminalInput?: () => boolean };
					helper.enableVirtualTerminalInput?.();
					return;
				} catch {
				// 日志写失败直接忽略，不影响主输出
					// Try the next possible packaging location.
				}
			}
		} catch {
			// Native helper not available — Shift+Tab won't be distinguishable from Tab.
		}
	}

	// 排空输入队列（公开）：暂停输入分发、关闭协议，等待不再有新数据后恢复；
	// 用于需要独占键盘的短暂窗口（如取原生剪贴板内容）
	async drainInput(maxMs = 1000, idleMs = 50): Promise<void> {
		const shouldDisableKittyProtocol = this.keyboardProtocolPushed || this._kittyProtocolActive;
		this.clearKeyboardProtocolNegotiationBuffer();
		if (shouldDisableKittyProtocol) {
			// Disable Kitty keyboard protocol first so any late key releases
		// 先关闭 Kitty 协议，防止迟到的按键释放产生新的转义序列
			// do not generate new Kitty escape sequences.
			process.stdout.write("\x1b[<u");
			this.keyboardProtocolPushed = false;
			this._kittyProtocolActive = false;
			setKittyProtocolActive(false);
		}
		this.disableModifyOtherKeys();

		const previousHandler = this.inputHandler;
		this.inputHandler = undefined;

		let lastDataTime = Date.now();
		const onData = () => {
			lastDataTime = Date.now();
		};

		process.stdin.on("data", onData);
		const endTime = Date.now() + maxMs;

		try {
			while (true) {
				const now = Date.now();
				const timeLeft = endTime - now;
				if (timeLeft <= 0) break;
				if (now - lastDataTime >= idleMs) break;
				await new Promise((resolve) => setTimeout(resolve, Math.min(idleMs, timeLeft)));
			}
		} finally {
			process.stdin.removeListener("data", onData);
			this.inputHandler = previousHandler;
		}
	}

	// 停止终端（公开）：清理进度指示、关闭括号粘贴与键盘协议、销毁缓冲器、
	// 移除监听、暂停 stdin 并恢复原始 raw 模式
	stop(): void {
		if (this.clearProgressInterval()) {
			process.stdout.write(TERMINAL_PROGRESS_CLEAR_SEQUENCE);
		}

		// Disable bracketed paste mode
		process.stdout.write("\x1b[?2004l");

		const shouldDisableKittyProtocol = this.keyboardProtocolPushed || this._kittyProtocolActive;
		this.clearKeyboardProtocolNegotiationBuffer();

		// Disable Kitty keyboard protocol if not already done by drainInput()
		if (shouldDisableKittyProtocol) {
			process.stdout.write("\x1b[<u");
			this.keyboardProtocolPushed = false;
			this._kittyProtocolActive = false;
			setKittyProtocolActive(false);
		}
		this.disableModifyOtherKeys();

		// Clean up StdinBuffer
		// 销毁输入缓冲器
		if (this.stdinBuffer) {
			this.stdinBuffer.destroy();
			this.stdinBuffer = undefined;
		}

		// Remove event handlers
		// 移除全部事件监听
		if (this.stdinDataHandler) {
			process.stdin.removeListener("data", this.stdinDataHandler);
			this.stdinDataHandler = undefined;
		}
		this.inputHandler = undefined;
		if (this.resizeHandler) {
			process.stdout.removeListener("resize", this.resizeHandler);
			this.resizeHandler = undefined;
		}

		// Pause stdin to prevent any buffered input (e.g., Ctrl+D) from being
		// 暂停 stdin：防止缓冲输入（如 Ctrl+D）在 raw 模式关闭后被重新解释
		// （修复 SSH 下 Ctrl+D 可能关闭父 shell 的竞态）
		// re-interpreted after raw mode is disabled. This fixes a race condition
		// where Ctrl+D could close the parent shell over SSH.
		process.stdin.pause();

		// Restore raw mode state
		// 恢复进入前的 raw 模式状态
		if (process.stdin.setRawMode) {
			process.stdin.setRawMode(this.wasRaw);
		}
	}

	// 输出数据（公开）：写入 stdout；开启了写日志时同步追加到日志文件
	write(data: string): void {
		process.stdout.write(data);
		if (this.writeLogPath) {
			try {
				fs.appendFileSync(this.writeLogPath, data, { encoding: "utf8" });
			} catch {
				// Ignore logging errors
			}
		}
	}

	// 终端列宽：优先 stdout.columns，回退环境变量 COLUMNS，再兜底 80
	get columns(): number {
		return process.stdout.columns || Number(process.env.COLUMNS) || 80;
	}

	// 终端行高：优先 stdout.rows，回退 LINES，再兜底 24
	get rows(): number {
		return process.stdout.rows || Number(process.env.LINES) || 24;
	}

	// 光标按行移动（公开）：正数向下、负数向上、零不动
	moveBy(lines: number): void {
		if (lines > 0) {
			// Move down
			process.stdout.write(`\x1b[${lines}B`);
		} else if (lines < 0) {
			// Move up
			process.stdout.write(`\x1b[${-lines}A`);
		}
		// lines === 0: no movement
	}

	// 隐藏光标（公开）
	hideCursor(): void {
		process.stdout.write("\x1b[?25l");
	}

	// 显示光标（公开）
	showCursor(): void {
		process.stdout.write("\x1b[?25h");
	}

	clearLine(): void {
		process.stdout.write("\x1b[K");
	}

	clearFromCursor(): void {
		process.stdout.write("\x1b[J");
	}

	clearScreen(): void {
		process.stdout.write("\x1b[2J\x1b[H"); // Clear screen and move to home (1,1)
	}

	setTitle(title: string): void {
		// OSC 0;title BEL - set terminal window title
		process.stdout.write(`\x1b]0;${title}\x07`);
	}

	setProgress(active: boolean): void {
		if (active) {
			// OSC 9;4;3 - indeterminate progress
			process.stdout.write(TERMINAL_PROGRESS_ACTIVE_SEQUENCE);
			if (!this.progressInterval) {
				this.progressInterval = setInterval(() => {
					process.stdout.write(TERMINAL_PROGRESS_ACTIVE_SEQUENCE);
				}, TERMINAL_PROGRESS_KEEPALIVE_MS);
			}
		} else {
			this.clearProgressInterval();
			// OSC 9;4;0 - clear progress
			process.stdout.write(TERMINAL_PROGRESS_CLEAR_SEQUENCE);
		}
	}

	private clearProgressInterval(): boolean {
		if (!this.progressInterval) return false;
		clearInterval(this.progressInterval);
		this.progressInterval = undefined;
		return true;
	}
}
