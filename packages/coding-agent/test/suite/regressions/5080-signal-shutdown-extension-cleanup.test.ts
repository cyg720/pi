import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import chalk from "chalk";
import { afterEach, describe, expect, test, vi } from "vitest";
import { APP_NAME } from "../../../src/config.ts";
import type { SessionManager } from "../../../src/core/session-manager.ts";
import { InteractiveMode } from "../../../src/modes/interactive/interactive-mode.ts";

// Regression for https://github.com/earendil-works/pi/issues/5080
// 回归验证 issue #5080 的信号关闭与扩展清理顺序。
//
// On SIGTERM/SIGHUP the graceful shutdown must emit `session_shutdown`
// SIGTERM/SIGHUP 触发的优雅关闭必须先发出 session_shutdown。
// (runtimeHost.dispose) BEFORE touching the terminal. Extension teardown such
// 也就是在触碰终端前先执行 runtimeHost.dispose，让扩展有机会完成清理。
// as removing a socket does not write to the tty, so it must not be skipped if
// 删除套接字等扩展收尾不写 TTY，不能因后续终端恢复失败而被跳过。
// a later terminal-restore write fails on a dead or stalled terminal. The
// 即使终端已经断开或卡死，扩展清理仍必须执行。
// interactive quit path (Ctrl+D, /quit) keeps the opposite order to preserve
// 交互式 Ctrl+D 或 /quit 则保持相反顺序，以保留最后一帧 TUI。
// the final TUI frame.

// 这两类入口的不同顺序是本文件的核心断言。
// 文件职责：验证 InteractiveMode 关闭时按触发来源正确排序扩展释放、输入排空、TUI 停止和恢复提示。
// 技术维度：使用 Vitest、原型方法调用、process.exit/stdout 桩和临时持久化会话文件模拟关闭流程。
// 产品维度：保证系统信号下扩展资源不会泄漏，交互退出时终端显示完整并提示用户如何恢复会话。
// 逻辑维度：构造最小 shutdown this 上下文，分别覆盖信号、交互、恢复提示、无提示和重入保护。
// 关键边界：测试拦截 process.exit 并临时修改 stdout.isTTY；所有全局状态和临时目录必须恢复。
// 新手阅读建议：先看 createContext 记录 order 的方式，再比较 fromSignal true/false 的期望数组。

// ShutdownThis 描述 shutdown 内部方法真正读取和修改的最小 this 结构。
type ShutdownThis = {
	isShuttingDown: boolean;
	unregisterSignalHandlers: () => void;
	runtimeHost: { dispose: () => Promise<void> };
	ui: { terminal: { drainInput: (ms: number) => Promise<void> } };
	themeController: { disableAutoSync: () => void };
	stop: () => void;
	sessionManager: SessionManager;
};

// InteractiveModePrototypeWithShutdown 暴露待测私有 shutdown 方法的调用签名。
type InteractiveModePrototypeWithShutdown = {
	shutdown(this: ShutdownThis, options?: { fromSignal?: boolean }): Promise<void>;
};

// interactiveModePrototype 保存真实类原型，调用时再收窄类型。
const interactiveModePrototype = InteractiveMode.prototype as unknown;
// tempDirs 收集恢复提示测试创建的临时会话目录。
const tempDirs: string[] = [];
// originalStdoutIsTTY 保存 stdout.isTTY 的原始属性描述符。
const originalStdoutIsTTY = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");

/** ProcessExitError 是 process.exit 桩用于中断控制流的哨兵错误。 */
class ProcessExitError extends Error {}

/** 构造 shutdown 使用的最小 SessionManager；参数 options 可给会话文件；返回测试替身。 */
function createSessionManager(options: { sessionFile?: string } = {}): SessionManager {
	return {
		isPersisted: () => options.sessionFile !== undefined,
		getSessionFile: () => options.sessionFile,
		getSessionId: () => "test-session",
		getSessionDir: () => "/tmp/pi-sessions",
		usesDefaultSessionDir: () => true,
	} as unknown as SessionManager;
}

/** 创建一个登记清理的临时会话文件；无参数；返回文件绝对路径。 */
function createTempFile(): string {
	// dir 是本次恢复提示用例的临时目录。
	const dir = mkdtempSync(join(tmpdir(), "pi-shutdown-resume-hint-"));
	tempDirs.push(dir);
	// file 是模拟已持久化会话的 JSONL 文件路径。
	const file = join(dir, "session.jsonl");
	writeFileSync(file, "\n");
	return file;
}

/** 临时设置 stdout.isTTY；参数 value 为目标布尔值；无返回值。 */
function setStdoutIsTTY(value: boolean): void {
	Object.defineProperty(process.stdout, "isTTY", { configurable: true, value });
}

/** 恢复 stdout.isTTY 原始描述符；无参数、无返回值。 */
function restoreStdoutIsTTY(): void {
	if (originalStdoutIsTTY) {
		Object.defineProperty(process.stdout, "isTTY", originalStdoutIsTTY);
	} else {
		Reflect.deleteProperty(process.stdout, "isTTY");
	}
}

/** 构造记录关闭步骤顺序的 this 上下文；参数 order 为记录数组、sessionManager 可覆盖；返回 ShutdownThis。 */
function createContext(order: string[], sessionManager = createSessionManager()): ShutdownThis {
	return {
		isShuttingDown: false,
		unregisterSignalHandlers: vi.fn(),
		runtimeHost: {
			dispose: vi.fn(async () => {
				order.push("dispose");
			}),
		},
		ui: {
			terminal: {
				drainInput: vi.fn(async () => {
					order.push("drainInput");
				}),
			},
		},
		themeController: { disableAutoSync: vi.fn() },
		stop: vi.fn(() => {
			order.push("stop");
		}),
		sessionManager,
	};
}

/** 调用真实 shutdown 并吞掉预期的 process.exit 哨兵；参数 context/options 为上下文和触发来源；返回 Promise。 */
async function callShutdown(context: ShutdownThis, options?: { fromSignal?: boolean }): Promise<void> {
	try {
		await (interactiveModePrototype as InteractiveModePrototypeWithShutdown).shutdown.call(context, options);
	} catch (error) {
		if (!(error instanceof ProcessExitError)) throw error;
	}
}

// 回归覆盖 InteractiveMode.shutdown 在不同退出来源下的调用顺序。
describe("InteractiveMode.shutdown ordering (#5080)", () => {
	// 每个用例后恢复桩、TTY 属性并删除临时会话。
	afterEach(() => {
		vi.restoreAllMocks();
		restoreStdoutIsTTY();
		for (const dir of tempDirs.splice(0)) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	// 信号关闭必须先 dispose，再操作终端。
	test("signal-triggered shutdown emits session_shutdown before terminal writes", async () => {
		vi.spyOn(process, "exit").mockImplementation((() => {
			throw new ProcessExitError();
		}) as typeof process.exit);
		// order 按实际调用顺序记录 dispose、drainInput 和 stop。
		const order: string[] = [];
		// context 是默认无持久化会话的关闭上下文。
		const context = createContext(order);

		await callShutdown(context, { fromSignal: true });

		expect(order).toEqual(["dispose", "drainInput", "stop"]);
		expect(context.isShuttingDown).toBe(true);
	});

	// 交互退出应先完成终端收尾，再释放运行时。
	test("interactive quit stops the TUI before emitting session_shutdown", async () => {
		vi.spyOn(process, "exit").mockImplementation((() => {
			throw new ProcessExitError();
		}) as typeof process.exit);
		// order 记录交互路径调用顺序。
		const order: string[] = [];
		// context 是默认交互退出上下文。
		const context = createContext(order);

		await callShutdown(context);

		expect(order).toEqual(["drainInput", "stop", "dispose"]);
	});

	// 持久化会话从交互入口退出时应打印恢复命令。
	test("interactive quit prints a resume hint for persisted sessions", async () => {
		vi.spyOn(process, "exit").mockImplementation((() => {
			throw new ProcessExitError();
		}) as typeof process.exit);
		// stdoutWrite 捕获恢复提示而不写真实终端。
		const stdoutWrite = vi
			.spyOn(process.stdout, "write")
			.mockImplementation((() => true) as typeof process.stdout.write);
		setStdoutIsTTY(true);
		// order 记录持久化会话交互退出顺序。
		const order: string[] = [];
		// context 绑定一个真实存在的临时会话文件。
		const context = createContext(order, createSessionManager({ sessionFile: createTempFile() }));

		await callShutdown(context);

		expect(order).toEqual(["drainInput", "stop", "dispose"]);
		expect(stdoutWrite).toHaveBeenCalledWith(
			`${chalk.dim("To resume this session:")} ${APP_NAME} --session test-session\n`,
		);
	});

	// 信号关闭即使会话持久化也不应尝试向可能失效的终端打印提示。
	test("signal-triggered shutdown does not print a resume hint", async () => {
		vi.spyOn(process, "exit").mockImplementation((() => {
			throw new ProcessExitError();
		}) as typeof process.exit);
		// stdoutWrite 捕获所有潜在终端输出。
		const stdoutWrite = vi
			.spyOn(process.stdout, "write")
			.mockImplementation((() => true) as typeof process.stdout.write);
		setStdoutIsTTY(true);
		// order 记录信号关闭调用顺序。
		const order: string[] = [];
		// context 包含持久化会话，但以信号来源关闭。
		const context = createContext(order, createSessionManager({ sessionFile: createTempFile() }));

		await callShutdown(context, { fromSignal: true });

		for (const call of stdoutWrite.mock.calls) {
			expect(call[0]).not.toContain("To resume this session:");
		}
	});

	// 已处于关闭状态时再次调用必须立即返回，不重复释放资源。
	test("re-entrant shutdown is a no-op", async () => {
		vi.spyOn(process, "exit").mockImplementation((() => {
			throw new ProcessExitError();
		}) as typeof process.exit);
		// order 应始终为空，用于确认没有执行任何步骤。
		const order: string[] = [];
		// context 将 isShuttingDown 预设为 true。
		const context = createContext(order);
		context.isShuttingDown = true;

		await callShutdown(context, { fromSignal: true });

		expect(order).toEqual([]);
		expect(context.runtimeHost.dispose).not.toHaveBeenCalled();
	});
});
