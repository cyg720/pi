import type { ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { spawnProcess, waitForChildProcess } from "../../../src/utils/child-process.ts";

/**
 * Regression test for https://github.com/earendil-works/pi/issues/5303
 *
 * waitForChildProcess armed a fixed 100ms timer on `exit` and destroyed the
 * stdio streams when it fired. When a short-lived detached descendant kept the
 * stdout pipe open, `close` never fired, so that timer was the only thing that
 * resolved the wait, and any output written more than 100ms after exit was
 * binned. In practice every git commit whose pre-commit hook runs lint-staged
 * came back truncated mid-listr2 output, read by the model as a hang.
 *
 * The fix re-arms the grace on each chunk, so an actively writing pipe keeps us
 * reading while a genuinely idle held-open handle still releases after the
 * grace elapses. Both behaviours are covered below.
 */
/**
 * 文件职责：回归验证父进程退出后仍活跃的 stdout 管道不会截断延迟输出，也不会永久挂起。
 * 技术维度：使用 Vitest、分离进程组、真实 `/bin/sh`、流事件和 waitForChildProcess。
 * 产品维度：保证 git hooks 等后台子进程的输出完整返回给模型，同时为静默句柄设置退出宽限。
 * 逻辑维度：第一例后台持续写入并检查最后一行，第二例后台静默睡眠并检查快速结束。
 * 关键边界：Windows 上跳过；afterEach 会按负 pid 强制结束残留的 Unix 进程组。
 * 新手阅读建议：先读英文缺陷背景，再比较“持续写入重置宽限”和“静默触发宽限”两例。
 */
describe.skipIf(process.platform === "win32")("issue #5303 bash output truncation past exit", () => {
	// child 保存当前用例的分离子进程，清理前允许未定义。
	let child: ChildProcessByStdio<null, Readable, Readable> | undefined;

	// 每例后强制结束仍存在的子进程组并清空引用；无参数，无返回值。
	afterEach(() => {
		if (child?.pid) {
			try {
				process.kill(-child.pid, "SIGKILL");
			} catch {
				// Already gone.
				// 进程已经退出，无需处理。
			}
		}
		child = undefined;
	});

	// 验证父 shell 退出后后台进程的持续输出仍被完整捕获；无参数，无返回值。
	it("captures output emitted after exit while a detached child holds stdout open", async () => {
		// The shell exits immediately, but a backgrounded subshell keeps the stdout
		// shell 立即退出，但后台子 shell 继续持有 stdout 管道。
		// pipe open and emits ticks every 50ms, the last well past the 100ms grace.
		// 它每 50 毫秒输出一次，最后一行明显晚于 100 毫秒宽限。
		// command 是先输出 HEAD、再后台连续输出六个 TICK 的 shell 脚本。
		const command = 'printf "HEAD\\n"; ( for i in 1 2 3 4 5 6; do sleep 0.05; printf "TICK$i\\n"; done ) &';
		child = spawnProcess("/bin/sh", ["-c", command], {
			stdio: ["ignore", "pipe", "pipe"],
			detached: true,
		}) as ChildProcessByStdio<null, Readable, Readable>;

		// output 累积 stdout 的所有数据块。
		let output = "";
		// chunk 是当前 stdout 二进制数据块。
		child.stdout.on("data", (chunk: Buffer) => {
			output += chunk.toString();
		});

		// exitCode 是等待流宽限处理后的 shell 退出码。
		const exitCode = await waitForChildProcess(child);

		expect(exitCode).toBe(0);
		expect(output).toContain("HEAD");
		expect(output).toContain("TICK6");
	});

	// 验证后台进程静默持有管道时宽限会快速释放等待；无参数，无返回值。
	it("resolves promptly when a detached child holds stdout open but stays quiet", async () => {
		// The shell exits, but a backgrounded sleeper inherits the stdout pipe and
		// shell 退出后，后台 sleep 继承 stdout 管道但不会写入。
		// keeps it open for a long time without writing. `close` never fires, so we
		// 管道长时间保持打开且 close 不触发，因此必须依靠空闲宽限结束。
		// must still release via the idle grace rather than hang on the open handle.
		// 不能等待句柄自然关闭，否则会挂起 30 秒。
		// command 是输出 DONE 后启动 30 秒后台睡眠的 shell 脚本。
		const command = 'printf "DONE\\n"; ( sleep 30 ) &';
		child = spawnProcess("/bin/sh", ["-c", command], {
			stdio: ["ignore", "pipe", "pipe"],
			detached: true,
		}) as ChildProcessByStdio<null, Readable, Readable>;

		// output 累积父 shell 输出，预期包含 DONE。
		let output = "";
		// chunk 是当前 stdout 数据块。
		child.stdout.on("data", (chunk: Buffer) => {
			output += chunk.toString();
		});

		// start 是开始等待子进程的时间戳。
		const start = Date.now();
		// exitCode 是宽限处理后的父 shell 退出码。
		const exitCode = await waitForChildProcess(child);
		// elapsed 是等待流程耗费的毫秒数。
		const elapsed = Date.now() - start;

		expect(exitCode).toBe(0);
		expect(output).toContain("DONE");
		// Must not wait for the 30s sleeper; the idle grace releases us in well under a second.
		// 不应等待 30 秒睡眠；空闲宽限应在远低于一秒的时间内释放。
		expect(elapsed).toBeLessThan(2000);
	});
});
