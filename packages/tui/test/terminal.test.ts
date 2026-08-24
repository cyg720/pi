/**
 * 文件职责：验证 Apple Terminal 的 Shift+Enter 归一化、Kitty 键盘协议协商回退和终端尺寸环境变量回退。
 * 技术维度：使用 Node.js test/assert/mock timers，临时替换 stdin/stdout 方法并直接调用 ProcessTerminal 内部协商逻辑。
 * 产品维度：确保不同终端能正确识别组合键，优先使用 Kitty 协议并在不支持时启用 modifyOtherKeys。
 * 逻辑维度：先测试输入纯函数，再用协商 Harness 注入响应，最后覆盖 stdout 尺寸缺失时的环境变量。
 * 关键边界：测试会修改全局 stdin/stdout 和 Kitty 状态，cleanup 必须幂等；分片 CSI 回复依赖模拟计时器。
 * 新手阅读建议：先看 normalizeAppleTerminalInput 用例，再阅读 setupNegotiation 如何捕获协议写入和模拟数据事件。
 */
import assert from "node:assert";
import { describe, it, mock } from "node:test";
import { setKittyProtocolActive } from "../src/keys.ts";
import { normalizeAppleTerminalInput, ProcessTerminal } from "../src/terminal.ts";

// 验证 Apple Terminal 特殊 Return 输入只在正确终端和 Shift 状态下重写。
describe("normalizeAppleTerminalInput", () => {
	it("rewrites Apple Terminal Return to CSI-u Shift+Enter when Shift is pressed", () => {
		assert.equal(normalizeAppleTerminalInput("\r", true, true), "\x1b[13;2u");
	});

	it("leaves Apple Terminal Return unchanged when Shift is not pressed", () => {
		assert.equal(normalizeAppleTerminalInput("\r", true, false), "\r");
	});

	it("leaves non-Apple Terminal Return unchanged when Shift is pressed", () => {
		assert.equal(normalizeAppleTerminalInput("\r", false, true), "\r");
	});

	it("leaves non-Return input unchanged", () => {
		assert.equal(normalizeAppleTerminalInput("\x1b[13;2u", true, true), "\x1b[13;2u");
		assert.equal(normalizeAppleTerminalInput("a", true, true), "a");
	});
});

// 验证 ProcessTerminal 启动时的 Kitty 查询、响应解析和 modifyOtherKeys 回退。
describe("ProcessTerminal Kitty keyboard protocol negotiation", () => {
	// NegotiationHarness 暴露协商测试所需终端、写入、输入注入和幂等清理能力。
	type NegotiationHarness = {
		terminal: ProcessTerminal;
		writes: string[];
		send(data: string): void;
		getInput(): string | undefined;
		cleanup(): void;
	};

	/** 创建拦截 stdin/stdout 的 Kitty 协商环境；无参数；返回 NegotiationHarness。 */
	function setupNegotiation(): NegotiationHarness {
		// terminal 是待测真实 ProcessTerminal 实例。
		const terminal = new ProcessTerminal();
		// writes 按顺序保存写向 stdout 的协议序列。
		const writes: string[] = [];
		// input 保存最终转发给应用输入处理器的数据。
		let input: string | undefined;
		// dataHandler 捕获 terminal 向 process.stdin 注册的数据监听器。
		let dataHandler: ((data: string) => void) | undefined;
		// cleaned 保证 cleanup 多次调用只执行一次恢复。
		let cleaned = false;
		// previousWrite 保存原 stdout.write。
		const previousWrite = process.stdout.write;
		// previousOn 保存原 stdin.on。
		const previousOn = process.stdin.on;

		process.stdout.write = ((chunk: string | Uint8Array) => {
			writes.push(String(chunk));
			return true;
		}) as typeof process.stdout.write;
		process.stdin.on = ((event: string | symbol, listener: (...args: unknown[]) => void) => {
			if (event === "data") dataHandler = listener as (data: string) => void;
			return process.stdin;
		}) as typeof process.stdin.on;

		(
			terminal as unknown as {
				inputHandler?: (data: string) => void;
				queryAndEnableKittyProtocol(): void;
			}
		).inputHandler = (data) => {
			input = data;
		};
		(terminal as unknown as { queryAndEnableKittyProtocol(): void }).queryAndEnableKittyProtocol();

		return {
			terminal,
			writes,
			send(data: string): void {
				dataHandler?.(data);
			},
			getInput(): string | undefined {
				return input;
			},
			cleanup(): void {
				if (cleaned) return;
				cleaned = true;
				try {
					terminal.stop();
				} finally {
					process.stdout.write = previousWrite;
					process.stdin.on = previousOn;
					setKittyProtocolActive(false);
				}
			},
		};
	}

	// 首先应查询 Kitty 标志，尚未收到响应前不启用回退协议。
	it("queries Kitty mode before enabling modifyOtherKeys fallback", () => {
		// harness 是刚启动查询但未注入回复的协商环境。
		const harness = setupNegotiation();
		try {
			assert.equal(harness.writes[0], "\x1b[>7u\x1b[?u\x1b[c");
			assert.equal(harness.writes.includes("\x1b[>4;2m"), false);
			assert.equal(harness.terminal.kittyProtocolActive, false);
		} finally {
			harness.cleanup();
		}
	});

	// 非零 Kitty 标志表示协议可用，停止时只发送 Kitty 退出序列。
	it("activates Kitty mode for non-zero negotiated flags", () => {
		// harness 用于注入 flags=7 回复并观察状态。
		const harness = setupNegotiation();
		try {
			harness.send("\x1b[?7u");

			assert.equal(harness.getInput(), undefined);
			assert.equal(harness.terminal.kittyProtocolActive, true);
			assert.equal(harness.writes.includes("\x1b[>4;2m"), false);
			assert.equal(harness.writes.includes("\x1b[>4;0m"), false);

			harness.cleanup();
			assert.equal(harness.writes.filter((write) => write === "\x1b[<u").length, 1);
			assert.equal(harness.writes.includes("\x1b[>4;0m"), false);
		} finally {
			harness.cleanup();
		}
	});

	// flags=0 表示 Kitty 不可用，应启用并在停止时关闭 modifyOtherKeys。
	it("falls back to modifyOtherKeys for zero Kitty flags", () => {
		// harness 用于注入零标志回复。
		const harness = setupNegotiation();
		try {
			harness.send("\x1b[?0u");

			assert.equal(harness.getInput(), undefined);
			assert.equal(harness.terminal.kittyProtocolActive, false);
			assert.equal(harness.writes.filter((write) => write === "\x1b[>4;2m").length, 1);

			harness.cleanup();
			assert.equal(harness.writes.filter((write) => write === "\x1b[>4;0m").length, 1);
		} finally {
			harness.cleanup();
		}
	});

	// 设备属性回复没有 Kitty 标志时也应立即使用回退协议。
	it("falls back to modifyOtherKeys for device attributes without Kitty flags", () => {
		// harness 用于注入常规 DA 响应。
		const harness = setupNegotiation();
		try {
			harness.send("\x1b[?62;4;52c");

			assert.equal(harness.getInput(), undefined);
			assert.equal(harness.terminal.kittyProtocolActive, false);
			assert.equal(harness.writes.filter((write) => write === "\x1b[>4;2m").length, 1);
		} finally {
			harness.cleanup();
		}
	});

	// 等待协商时的普通输入不能被吞掉。
	it("forwards normal input while waiting for Kitty response", () => {
		// harness 用于注入普通字符 a。
		const harness = setupNegotiation();
		try {
			harness.send("a");

			assert.equal(harness.getInput(), "a");
			assert.equal(harness.terminal.kittyProtocolActive, false);
		} finally {
			harness.cleanup();
		}
	});

	// Kitty 确认序列分成两次数据事件时仍应合并识别。
	it("tracks split Kitty confirmation", () => {
		mock.timers.enable({ apis: ["setTimeout"] });
		// harness 用于分两段发送 `CSI ? 7 u`。
		const harness = setupNegotiation();
		try {
			harness.send("\x1b[?7");
			mock.timers.tick(10);

			assert.equal(harness.getInput(), undefined);

			harness.send("u");

			assert.equal(harness.terminal.kittyProtocolActive, true);
			assert.equal(harness.writes.includes("\x1b[>4;2m"), false);
		} finally {
			harness.cleanup();
			mock.timers.reset();
		}
	});

	// 只有 CSI 前缀但最终不是 Kitty 回复时，应在等待窗口后重放给应用。
	it("replays buffered CSI-prefix input when it is not a Kitty response", () => {
		mock.timers.enable({ apis: ["setTimeout"] });
		// harness 用于发送不完整 CSI 并推进超时。
		const harness = setupNegotiation();
		try {
			harness.send("\x1b[");
			mock.timers.tick(10);

			assert.equal(harness.getInput(), undefined);

			mock.timers.tick(150);

			assert.equal(harness.getInput(), "\x1b[");
		} finally {
			harness.cleanup();
			mock.timers.reset();
		}
	});
});

// 验证 stdout 没有尺寸时使用 COLUMNS/LINES，再回退默认值。
describe("ProcessTerminal dimensions", () => {
	// 环境变量中的正整数尺寸应优先于硬编码默认尺寸。
	it("falls back to COLUMNS and LINES before default dimensions", () => {
		// previousColumnsDescriptor 保存 stdout.columns 原属性。
		const previousColumnsDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "columns");
		// previousRowsDescriptor 保存 stdout.rows 原属性。
		const previousRowsDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "rows");
		// previousColumns 保存原 COLUMNS 环境值。
		const previousColumns = process.env.COLUMNS;
		// previousLines 保存原 LINES 环境值。
		const previousLines = process.env.LINES;

		try {
			Object.defineProperty(process.stdout, "columns", { value: undefined, configurable: true });
			Object.defineProperty(process.stdout, "rows", { value: undefined, configurable: true });
			process.env.COLUMNS = "123";
			process.env.LINES = "45";

			// terminal 在 stdout 尺寸为空时读取环境变量。
			const terminal = new ProcessTerminal();

			assert.equal(terminal.columns, 123);
			assert.equal(terminal.rows, 45);
		} finally {
			if (previousColumnsDescriptor) {
				Object.defineProperty(process.stdout, "columns", previousColumnsDescriptor);
			} else {
				Reflect.deleteProperty(process.stdout, "columns");
			}
			if (previousRowsDescriptor) {
				Object.defineProperty(process.stdout, "rows", previousRowsDescriptor);
			} else {
				Reflect.deleteProperty(process.stdout, "rows");
			}
			if (previousColumns === undefined) {
				delete process.env.COLUMNS;
			} else {
				process.env.COLUMNS = previousColumns;
			}
			if (previousLines === undefined) {
				delete process.env.LINES;
			} else {
				process.env.LINES = previousLines;
			}
		}
	});
});
