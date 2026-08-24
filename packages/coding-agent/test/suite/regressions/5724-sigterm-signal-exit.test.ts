import { afterEach, describe, expect, test, vi } from "vitest";
import { InteractiveMode } from "../../../src/modes/interactive/interactive-mode.ts";

// Regression for https://github.com/earendil-works/pi/issues/5724
//
// `proper-lockfile` installs `signal-exit`, whose signal listener re-sends
// SIGTERM/SIGHUP when it observes no other process listeners during the same
// signal dispatch. InteractiveMode must therefore keep its signal handlers
// registered until async terminal cleanup has completed.
// 回归问题：https://github.com/earendil-works/pi/issues/5724
// proper-lockfile 引入的 signal-exit 会在同一次信号分派中发现无其他监听器时重新发送信号。
// 因此 InteractiveMode 必须等异步终端清理完成后再注销自己的信号处理器。
/**
 * 文件职责：回归验证 SIGTERM 触发的异步关闭期间不会过早注销进程信号处理器。
 * 技术维度：使用 Vitest、私有原型方法绑定、可控 Promise、process.exit 模拟和调用顺序记录。
 * 产品维度：避免终端清理尚未完成时 signal-exit 重发信号导致进程提前终止或界面损坏。
 * 逻辑维度：阻塞 runtimeHost.dispose，检查等待期间监听器状态，释放后核对清理调用顺序。
 * 关键边界：测试把 process.exit 替换为抛出专用异常；afterEach 必须恢复所有模拟。
 * 新手阅读建议：先看顶部问题背景和 deferred，再顺着 order 数组理解关闭阶段。
 */

/** 描述调用 InteractiveMode.shutdown 所需的最小 this 上下文。 */
type ShutdownThis = {
	// isShuttingDown 标记关闭流程是否已经开始。
	isShuttingDown: boolean;
	// unregisterSignalHandlers 注销进程信号监听器，本用例预期不会在信号路径调用。
	unregisterSignalHandlers: () => void;
	// runtimeHost.dispose 异步释放运行时资源。
	runtimeHost: { dispose: () => Promise<void> };
	// ui.terminal.drainInput 等待终端输入排空。
	ui: { terminal: { drainInput: (ms: number) => Promise<void> } };
	// themeController.disableAutoSync 停止主题自动同步。
	themeController: { disableAutoSync: () => void };
	// stop 停止交互界面。
	stop: () => void;
};

/** 描述测试借用的私有 shutdown 方法签名。 */
type InteractiveModePrototypeWithShutdown = {
	// shutdown 接收可选信号来源标记并返回清理完成 Promise。
	shutdown(this: ShutdownThis, options?: { fromSignal?: boolean }): Promise<void>;
};

// interactiveModePrototype 保存未经公开类型声明的 InteractiveMode 原型。
const interactiveModePrototype = InteractiveMode.prototype as unknown;

/** 表示测试模拟 process.exit 时主动抛出的预期异常。 */
class ProcessExitError extends Error {}

/**
 * 创建可由外部显式解决的 Promise。
 * 参数：无。
 * 返回值：promise 与对应 resolve 函数。
 * 使用示例：`const dispose = deferred()`。
 */
function deferred(): { promise: Promise<void>; resolve: () => void } {
	// resolve 保存 Promise 构造器给出的解决函数，初始化时允许未定义。
	let resolve: (() => void) | undefined;
	// promise 是等待测试显式释放的异步门闩。
	const promise = new Promise<void>((res) => {
		// res 是 Promise 的内部解决回调。
		resolve = res;
	});
	return {
		promise,
		resolve: () => resolve?.(),
	};
}

/**
 * 调用私有关闭方法并吞掉测试专用退出异常。
 * 参数：context 为模拟关闭上下文，options 指示是否源于信号。
 * 返回值：清理完成后的 Promise。
 * 使用示例：`await callShutdown(context, { fromSignal: true })`。
 */
async function callShutdown(context: ShutdownThis, options?: { fromSignal?: boolean }): Promise<void> {
	try {
		await (interactiveModePrototype as InteractiveModePrototypeWithShutdown).shutdown.call(context, options);
	} catch (error) {
		// error 是关闭过程中抛出的未知异常，只允许测试专用退出异常。
		if (!(error instanceof ProcessExitError)) throw error;
	}
}

describe("InteractiveMode SIGTERM shutdown with signal-exit (#5724)", () => {
	// 每个用例后恢复 process.exit 等模拟；无参数，无返回值。
	afterEach(() => {
		vi.restoreAllMocks();
	});

	// 验证信号触发的资源释放完成前监听器保持注册；无参数，无返回值。
	test("keeps signal handlers registered while signal-triggered cleanup is pending", async () => {
		vi.spyOn(process, "exit").mockImplementation((() => {
			throw new ProcessExitError();
		}) as typeof process.exit);

		// order 按发生顺序记录关键关闭步骤。
		const order: string[] = [];
		// dispose 是用于阻塞 runtimeHost.dispose 的可控 Promise。
		const dispose = deferred();
		// context 是包含全部关闭依赖模拟的最小 this 对象。
		const context: ShutdownThis = {
			isShuttingDown: false,
			unregisterSignalHandlers: vi.fn(() => {
				order.push("unregister");
			}),
			runtimeHost: {
				dispose: vi.fn(() => {
					order.push("dispose");
					return dispose.promise;
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
		};

		// shutdownPromise 保存尚被 dispose 门闩阻塞的关闭流程。
		const shutdownPromise = callShutdown(context, { fromSignal: true });
		await Promise.resolve();

		expect(order).toEqual(["dispose"]);
		expect(context.unregisterSignalHandlers).not.toHaveBeenCalled();

		dispose.resolve();
		await shutdownPromise;

		expect(order).toEqual(["dispose", "drainInput", "stop"]);
	});
});
