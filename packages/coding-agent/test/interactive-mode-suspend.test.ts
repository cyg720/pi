/**
 * 文件职责：验证交互模式响应 Ctrl+Z 时的平台分支、进程挂起流程以及失败清理行为。
 * 技术维度：使用 Vitest 间谍函数模拟 TUI、定时器和 Node.js 进程信号，并通过原型调用私有处理逻辑。
 * 产品维度：保障类 Unix 系统可安全把终端会话挂到后台，同时 Windows 用户得到明确提示而不会破坏界面。
 * 逻辑维度：先构造最小 UI 上下文，再分别覆盖 Windows 跳过、SIGCONT 恢复和挂起失败三条路径。
 * 关键边界：测试会临时修改 process.platform 和信号 API；所有桩必须恢复，且不会向真实进程发送信号。
 * 新手阅读建议：先理解四个测试辅助类型和 callHandleCtrlZ，再按正常恢复、异常清理两条时序阅读断言。
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { InteractiveMode } from "../src/modes/interactive/interactive-mode.ts";

// FakeUi 描述挂起处理器实际用到的最小界面能力，避免构造完整 TUI。
type FakeUi = {
	start: () => void;
	stop: () => void;
	requestRender: (force?: boolean) => void;
};

// HandleCtrlZThis 描述调用 handleCtrlZ 时必须提供的 this 上下文。
type HandleCtrlZThis = {
	ui: FakeUi;
};

// ProcessSignalHandler 表示无参数、无返回值的进程信号回调。
type ProcessSignalHandler = () => void;

// InteractiveModePrototypeWithHandleCtrlZ 只暴露待测的原型方法签名。
type InteractiveModePrototypeWithHandleCtrlZ = {
	handleCtrlZ(this: HandleCtrlZThis): void;
};

/**
 * 以最小伪造上下文调用 InteractiveMode 的 handleCtrlZ 原型方法。
 * @param context 提供待测方法所需 UI 的 this 对象。
 * @returns 无返回值；例如 `callHandleCtrlZ({ ui })` 会执行挂起分支。
 */
function callHandleCtrlZ(context: HandleCtrlZThis): void {
	(interactiveModePrototype as InteractiveModePrototypeWithHandleCtrlZ).handleCtrlZ.call(context);
}

// interactiveModePrototype 保存运行时原型；先视为 unknown，再在辅助函数中收窄到测试签名。
const interactiveModePrototype = InteractiveMode.prototype as unknown;

// 集中验证 Ctrl+Z 处理器在不同平台和信号结果下的行为。
describe("InteractiveMode.handleCtrlZ", () => {
	// 每个用例后恢复全部间谍和桩，防止污染 Node.js 全局状态。
	afterEach(() => {
		vi.restoreAllMocks();
	});

	// Windows 不支持 POSIX 挂起信号，应只显示状态提示。
	test("shows a status message and skips suspend on Windows", () => {
		// ui 记录界面生命周期调用，所有方法均为可断言的模拟函数。
		const ui: FakeUi = {
			start: vi.fn(),
			stop: vi.fn(),
			requestRender: vi.fn(),
		};
		// showStatus 捕获面向用户的挂起不支持提示。
		const showStatus = vi.fn();
		// context 在最小 UI 上额外提供 Windows 分支需要的状态展示函数。
		const context: HandleCtrlZThis & { showStatus: (message: string) => void } = { ui, showStatus };
		// platformDescriptor 保存原始平台属性描述符，finally 中据此完整还原。
		const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");
		Object.defineProperty(process, "platform", {
			configurable: true,
			value: "win32",
		});
		// setIntervalSpy 确认 Windows 分支不会创建用于保持进程存活的定时器。
		const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
		// processOnSpy 确认不会安装临时 SIGINT 监听器。
		const processOnSpy = vi.spyOn(process, "on");
		// processOnceSpy 确认不会等待 SIGCONT 恢复信号。
		const processOnceSpy = vi.spyOn(process, "once");
		// processKillSpy 确认不会向当前进程发送 SIGTSTP。
		const processKillSpy = vi.spyOn(process, "kill");

		try {
			callHandleCtrlZ(context);
		} finally {
			if (platformDescriptor) {
				Object.defineProperty(process, "platform", platformDescriptor);
			}
		}

		expect(showStatus).toHaveBeenCalledWith("Suspend to background is not supported on Windows");
		expect(ui.stop).not.toHaveBeenCalled();
		expect(setIntervalSpy).not.toHaveBeenCalled();
		expect(processOnSpy).not.toHaveBeenCalledWith("SIGINT", expect.any(Function));
		expect(processOnceSpy).not.toHaveBeenCalledWith("SIGCONT", expect.any(Function));
		expect(processKillSpy).not.toHaveBeenCalled();
	});

	// 类 Unix 挂起期间应保持事件循环存活，并在 SIGCONT 后恢复界面。
	test("keeps the process alive while suspended and restores the TUI on SIGCONT", () => {
		// ui 记录停止、启动和强制重绘的调用顺序与次数。
		const ui: FakeUi = {
			start: vi.fn(),
			stop: vi.fn(),
			requestRender: vi.fn(),
		};
		// context 是调用原型方法所需的最小 this 对象。
		const context: HandleCtrlZThis = { ui };
		// keepAliveHandle 提供一个类型正确但已清除的定时器句柄供桩返回。
		const keepAliveHandle = setTimeout(() => undefined, 0);
		clearTimeout(keepAliveHandle);

		// sigintHandler 捕获代码注册的临时中断处理器，以便验证清理。
		let sigintHandler: ProcessSignalHandler | undefined;
		// sigcontHandler 捕获一次性恢复处理器，测试会手动触发它。
		let sigcontHandler: ProcessSignalHandler | undefined;

		// setIntervalSpy 用固定句柄替代长周期定时器，避免真实等待。
		const setIntervalSpy = vi.spyOn(globalThis, "setInterval").mockReturnValue(keepAliveHandle);
		// clearIntervalSpy 记录恢复时是否释放保持存活句柄。
		const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval").mockImplementation(() => undefined);
		// processOnSpy 捕获 SIGINT 监听器，同时保留链式调用所需的 process 返回值。
		const processOnSpy = vi.spyOn(process, "on").mockImplementation(((event: string, listener: () => void) => {
			if (event === "SIGINT") {
				sigintHandler = listener;
			}
			return process;
		}) as typeof process.on);
		// processOnceSpy 捕获 SIGCONT 一次性监听器供测试触发。
		const processOnceSpy = vi.spyOn(process, "once").mockImplementation(((event: string, listener: () => void) => {
			if (event === "SIGCONT") {
				sigcontHandler = listener;
			}
			return process;
		}) as typeof process.once);
		// removeListenerSpy 记录恢复时移除临时 SIGINT 监听器的参数。
		const removeListenerSpy = vi
			.spyOn(process, "removeListener")
			.mockImplementation(((_event: string, _listener: () => void) => process) as typeof process.removeListener);
		// processKillSpy 模拟成功发送 SIGTSTP，不触碰真实进程。
		const processKillSpy = vi.spyOn(process, "kill").mockImplementation(() => true);

		callHandleCtrlZ(context);

		expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 2 ** 30);
		expect(processOnSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function));
		expect(processOnceSpy).toHaveBeenCalledWith("SIGCONT", expect.any(Function));
		expect(ui.stop).toHaveBeenCalledTimes(1);
		expect(processKillSpy).toHaveBeenCalledWith(0, "SIGTSTP");
		expect(sigintHandler).toBeDefined();
		expect(sigcontHandler).toBeDefined();

		sigcontHandler?.();

		expect(clearIntervalSpy).toHaveBeenCalledWith(keepAliveHandle);
		expect(removeListenerSpy).toHaveBeenCalledWith("SIGINT", sigintHandler);
		expect(ui.start).toHaveBeenCalledTimes(1);
		expect(ui.requestRender).toHaveBeenCalledWith(true);
	});

	// 发送挂起信号失败时仍应释放定时器和监听器，但不应伪装成成功恢复。
	test("cleans up the temporary handlers if suspension fails", () => {
		// ui 记录异常路径中的界面停止及是否被错误恢复。
		const ui: FakeUi = {
			start: vi.fn(),
			stop: vi.fn(),
			requestRender: vi.fn(),
		};
		// context 为待测方法提供最小 UI 上下文。
		const context: HandleCtrlZThis = { ui };
		// keepAliveHandle 是供定时器桩返回并供清理断言使用的句柄。
		const keepAliveHandle = setTimeout(() => undefined, 0);
		clearTimeout(keepAliveHandle);
		// suspendError 是 process.kill 桩抛出的固定错误，用于验证原样传播。
		const suspendError = new Error("suspend failed");

		// setIntervalSpy 模拟挂起前创建的保持存活定时器。
		const setIntervalSpy = vi.spyOn(globalThis, "setInterval").mockReturnValue(keepAliveHandle);
		// clearIntervalSpy 记录异常清理是否释放同一计时器句柄。
		const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval").mockImplementation(() => undefined);
		vi.spyOn(process, "on").mockImplementation(
			((_event: string, _listener: () => void) => process) as typeof process.on,
		);
		// removeListenerSpy 记录失败路径是否移除临时 SIGINT 监听器。
		const removeListenerSpy = vi
			.spyOn(process, "removeListener")
			.mockImplementation(((_event: string, _listener: () => void) => process) as typeof process.removeListener);
		vi.spyOn(process, "once").mockImplementation(
			((_event: string, _listener: () => void) => process) as typeof process.once,
		);
		vi.spyOn(process, "kill").mockImplementation(() => {
			throw suspendError;
		});

		expect(() => callHandleCtrlZ(context)).toThrow(suspendError);
		expect(ui.stop).toHaveBeenCalledTimes(1);
		expect(setIntervalSpy).toHaveBeenCalledTimes(1);
		expect(clearIntervalSpy).toHaveBeenCalledWith(keepAliveHandle);
		expect(removeListenerSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function));
		expect(ui.start).not.toHaveBeenCalled();
		expect(ui.requestRender).not.toHaveBeenCalled();
	});
});
