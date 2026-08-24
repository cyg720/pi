#!/usr/bin/env node
/**
 * 文件职责：提供交互式按键码记录器，展示终端输入的十六进制、字符码和转义表示。
 * 技术维度：使用 ProcessTerminal、TUI、键位匹配和宽度截断支持 Kitty 等键盘协议。
 * 产品维度：帮助开发者诊断不同终端和系统下组合键编码，完善可配置快捷键兼容性。
 * 逻辑维度：KeyLogger 接收输入并维护最近日志，渲染协议与测试提示，主流程启动 TUI。
 * 关键边界：这是交互调试工具，会占用原始终端；Ctrl+C 或 SIGINT 会停止并退出进程。
 * 新手阅读建议：先运行并按键观察，再读 handleInput 的三种表示和 protocolName 判断。
 */
import { matchesKey } from "../src/keys.ts";
import { ProcessTerminal } from "../src/terminal.ts";
import { type Component, TUI } from "../src/tui.ts";
import { truncateToWidth } from "../src/utils.ts";

/**
 * Simple key code logger component
 */
/** 简单的按键编码日志组件。 */
class KeyLogger implements Component {
	// log 保存最近收到的格式化按键记录。
	private log: string[] = [];
	// maxLines 限制屏幕保留的日志条数。
	private maxLines = 20;
	// tui 用于停止界面和请求重绘。
	private tui: TUI;
	// terminal 用于检测当前键盘协议状态。
	private terminal: ProcessTerminal;

	/** 构造记录器；tui 为界面，terminal 为真实终端，无返回值。 */
	constructor(tui: TUI, terminal: ProcessTerminal) {
		this.tui = tui;
		this.terminal = terminal;
	}

	/** 解析并记录原始输入；data 为终端字节字符串，无返回值。 */
	handleInput(data: string): void {
		// Handle Ctrl+C (raw or Kitty protocol) for exit
		// 处理原始或 Kitty 协议编码的 Ctrl+C 并退出。
		if (matchesKey(data, "ctrl+c")) {
			this.tui.stop();
			console.log("\nExiting...");
			process.exit(0);
		}

		// Convert to various representations
		// 把输入转换为多种便于诊断的表示。
		// hex 是输入字节的十六进制字符串。
		const hex = Buffer.from(data).toString("hex");
		// charCodes 是每个字符 UTF-16 码元的逗号分隔文本。
		const charCodes = Array.from(data)
			// c 是当前字符，回调取得其码元。
			.map((c) => c.charCodeAt(0))
			.join(", ");
		// repr 把不可见控制字符替换为可读转义形式。
		const repr = data
			.replace(/\x1b/g, "\\x1b")
			.replace(/\r/g, "\\r")
			.replace(/\n/g, "\\n")
			.replace(/\t/g, "\\t")
			.replace(/\x7f/g, "\\x7f");

		// logLine 是本次输入的单行诊断记录。
		const logLine = `Hex: ${hex.padEnd(20)} | Chars: [${charCodes.padEnd(15)}] | Repr: "${repr}"`;

		this.log.push(logLine);

		// Keep only last N lines
		// 只保留最近 maxLines 条记录。
		if (this.log.length > this.maxLines) {
			this.log.shift();
		}

		// Request re-render to show the new log entry
		// 请求重绘以显示新日志。
		this.tui.requestRender();
	}

	invalidate(): void {
		// No cached state to invalidate currently
		// 当前没有需要清除的缓存状态。
	}

	/** 返回当前键盘协议名称；无参数，返回 kitty、modifyOtherKeys 或 legacy。 */
	private protocolName(): string {
		if (this.terminal.kittyProtocolActive) return "kitty";
		if (this.terminal.modifyOtherKeysActive) return "modifyOtherKeys";
		return "legacy";
	}

	/** 把 line 截断并补齐到 width；返回固定宽度字符串。 */
	private fit(line: string, width: number): string {
		return truncateToWidth(line, width).padEnd(width);
	}

	/** 按 width 渲染标题、日志、填充和页脚；返回全部屏幕行。 */
	render(width: number): string[] {
		// lines 累积本次渲染的所有屏幕行。
		const lines: string[] = [];

		// Title
		// 渲染标题和当前协议。
		lines.push("=".repeat(width));
		lines.push(this.fit("Key Code Tester - Press keys to see their codes (Ctrl+C to exit)", width));
		lines.push(this.fit(`Protocol: ${this.protocolName()}`, width));
		lines.push("=".repeat(width));
		lines.push("");

		// Log entries
		// entry 是当前按键日志行。
		for (const entry of this.log) {
			lines.push(this.fit(entry, width));
		}

		// Fill remaining space
		// remaining 是为保持固定布局需要补充的空行数。
		const remaining = Math.max(0, 25 - lines.length);
		// i 是当前空行索引。
		for (let i = 0; i < remaining; i++) {
			lines.push("".padEnd(width));
		}

		// Footer
		// 渲染建议测试的组合键列表。
		lines.push("=".repeat(width));
		lines.push(this.fit("Test these:", width));
		lines.push(this.fit("  - Shift + Enter (should show: \\x1b[13;2u with Kitty protocol)", width));
		lines.push(this.fit("  - Alt/Option + Enter", width));
		lines.push(this.fit("  - Option/Alt + Backspace", width));
		lines.push(this.fit("  - Cmd/Ctrl + Backspace", width));
		lines.push(this.fit("  - Regular Backspace", width));
		lines.push("=".repeat(width));

		return lines;
	}
}

// Set up TUI

// 创建真实终端、TUI 和按键记录组件。
// terminal 是当前进程终端适配器。
const terminal = new ProcessTerminal();
// tui 是承载按键记录器的终端界面。
const tui = new TUI(terminal);
// logger 是接收焦点输入的记录组件。
const logger = new KeyLogger(tui, terminal);

tui.addChild(logger);
tui.setFocus(logger);

// Handle Ctrl+C for clean exit (SIGINT still works for raw mode)

// 处理 SIGINT，确保原始模式下也能干净退出。
process.on("SIGINT", () => {
	tui.stop();
	console.log("\nExiting...");
	process.exit(0);
});

// Start the TUI

// 启动终端界面。
tui.start();

// Protocol negotiation completes asynchronously after the first render.
// 协议协商会在首次渲染后异步完成。
// Refresh briefly/continuously so the displayed protocol state is not stale.
// 持续刷新，避免屏幕显示过期协议状态。
setInterval(() => tui.requestRender(), 100);
