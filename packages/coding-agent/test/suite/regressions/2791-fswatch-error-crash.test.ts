/**
 * 文件职责：回归验证主题文件监听器收到 error 事件时具有处理器，不会导致 Node 进程崩溃。
 * 技术维度：使用 Vitest、临时主题文件、动态生成的 TypeScript 子进程脚本和活动句柄检查。
 * 产品维度：避免用户开启自定义主题监听后，底层文件系统错误直接终止整个交互式代理。
 * 逻辑维度：复制主题夹具，生成会触发 FSWatcher error 的脚本，在子进程执行并断言正常退出。
 * 关键边界：测试依赖私有 process._getActiveHandles；子脚本是字符串数据，不能把外部路径原样信任。
 * 新手阅读建议：先读英文回归步骤及其中文说明，再看子脚本如何定位监听器并模拟错误。
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Regression test for https://github.com/earendil-works/pi-mono/issues/2791
 *
 * fs.watch() returns an FSWatcher (EventEmitter). If the watcher emits an
 * 'error' event after creation and no error handler is attached, Node.js
 * treats it as an uncaught exception and terminates the process.
 *
 * We test this by spawning a child process that:
 * 1. Sets up a custom theme with the watcher enabled
 * 2. Finds the FSWatcher via process._getActiveHandles()
 * 3. Emits a synthetic 'error' event on it
 * 4. If the watcher has no error handler -> crash (exit != 0) -> bug present
 * 5. If the watcher has an error handler -> clean exit (exit 0) -> bug fixed
 * 中文说明：测试通过独立子进程模拟异步文件系统错误；退出码 0 表示监听器已安全处理 error 事件。
 */
describe("issue #2791 fs.watch error event crashes process", () => {
	// 当前用例的临时根目录；包含代理主题和生成的子进程脚本。
	let tempRoot: string;

	// 功能：创建自定义主题夹具；参数：无；返回：无。示例：Vitest 每个用例前自动调用。
	beforeEach(() => {
		// 本用例独占的临时根目录。
		tempRoot = mkdtempSync(join(tmpdir(), "pi-2791-"));
		// 模拟的用户代理配置目录。
		const agentDir = join(tempRoot, "agent");
		// 自定义主题文件所在目录。
		const themesDir = join(agentDir, "themes");
		mkdirSync(themesDir, { recursive: true });

		// Copy dark.json as "custom-test" theme
		// 中文说明：复用内置 dark.json 内容，只改名称以构造可监听的自定义主题。
		// 内置暗色主题源文件路径。
		const darkThemePath = join(__dirname, "../../../src/modes/interactive/theme/dark.json");
		// 解析后的可变主题对象；仅在测试夹具中把 name 改成 custom-test。
		const darkTheme = JSON.parse(readFileSync(darkThemePath, "utf-8"));
		darkTheme.name = "custom-test";
		writeFileSync(join(themesDir, "custom-test.json"), JSON.stringify(darkTheme, null, 2));
	});

	// 功能：删除主题和子脚本目录；参数：无；返回：无。示例：Vitest 每个用例后调用。
	afterEach(() => {
		rmSync(tempRoot, { recursive: true, force: true });
	});

	it("process should survive an error event on the theme FSWatcher", () => {
		// 子脚本要导入的主题模块路径；斜杠归一化便于写入 ESM import。
		const themeModulePath = join(__dirname, "../../../src/modes/interactive/theme/theme.ts").replace(/\\/g, "/");
		// 写入子进程环境的代理目录路径，同样归一化为正斜杠。
		const agentDir = join(tempRoot, "agent").replace(/\\/g, "/");

		// Script that sets up the watcher and emits a synthetic error on it.
		// 中文说明：下方脚本启动监听器并手工触发 error 事件。
		// If no .on('error') handler is attached, EventEmitter.emit('error')
		// 中文说明：若未注册 error 监听器，Node 的 EventEmitter 会把该事件作为异常抛出。
		// throws, which either crashes the process or gets caught by our try/catch.
		// 中文说明：异常会导致子进程崩溃或被脚本捕获并以失败码退出。
		// 生成的子进程脚本路径，扩展名 mts 使其按 ESM 解释。
		const scriptPath = join(tempRoot, "test-watcher-error.mts");
		writeFileSync(
			scriptPath,
			`
import { setTheme, stopThemeWatcher } from "${themeModulePath}";

process.env.PI_CODING_AGENT_DIR = "${agentDir}";

setTheme("custom-test", true);

// Find the FSWatcher among active handles
const handles = (process as any)._getActiveHandles();
const fsWatcher = handles.find((h: any) => h.constructor?.name === "FSWatcher");

if (!fsWatcher) {
	process.stderr.write("no FSWatcher found among active handles\\n");
	process.exit(2);
}

const errorListenerCount = fsWatcher.listenerCount("error");
if (errorListenerCount === 0) {
	process.stderr.write("BUG: FSWatcher has no error handler (issue #2791)\\n");
}

// Emitting 'error' on an EventEmitter with no error listener throws.
// This simulates an async OS error (e.g. ReadDirectoryChangesW invalidation).
try {
	fsWatcher.emit("error", new Error("simulated OS watcher failure"));
} catch {
	process.stderr.write("error event was unhandled and threw\\n");
	process.exit(1);
}

stopThemeWatcher();
process.exit(0);
`,
		);

		// 子进程标准输出；当前断言不用它，但异常时保留以辅助诊断。
		let _stdout = "";
		// 子进程标准错误，用于拼接失败断言消息。
		let stderr = "";
		// 子进程退出码；正常执行为 0，异常分支使用捕获状态或默认 1。
		let exitCode: number;
		try {
			_stdout = execFileSync(process.execPath, [scriptPath], {
				timeout: 10000,
				encoding: "utf-8",
				env: { ...process.env, PI_CODING_AGENT_DIR: agentDir },
				stdio: ["pipe", "pipe", "pipe"],
			});
			exitCode = 0;
		} catch (err: unknown) {
			// execFileSync 抛出的进程错误最小形状。
			const e = err as { status: number; stdout: string; stderr: string };
			_stdout = e.stdout ?? "";
			stderr = e.stderr ?? "";
			exitCode = e.status ?? 1;
		}

		expect(exitCode, `Child crashed (exit ${exitCode}). stderr: ${stderr.trim()}`).toBe(0);
	});
});
