/**
 * 文件职责：验证 Windows 上 Shell 退出后，即使脱离子进程继承标准流，Bash 执行也不会永久等待 close。
 * 技术维度：使用 Vitest、Windows taskkill、AbortController、超时 Promise 与真实 Node 子进程构造回归场景。
 * 产品维度：防止用户执行会派生后台进程的命令时，代理的 Bash 工具一直卡住无法返回。
 * 逻辑维度：生成派生进程命令，记录其 PID，分别测试底层执行器和 Bash 工具，最后强制清理子进程。
 * 关键边界：仅在 Windows 运行；测试会启动并终止真实进程，PID 文件只能位于独占临时目录。
 * 新手阅读建议：先看两个测试共同的 try/finally，再查看命令生成、超时包装和 PID 清理帮助函数。
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { executeBashWithOperations } from "../src/core/bash-executor.ts";
import { createBashTool, createLocalBashOperations } from "../src/core/tools/bash.ts";

/** 功能：把路径转成 Bash 单引号参数；参数 value 为原字符串；返回：安全引用文本。示例：toBashSingleQuotedArg("C:\\tmp")。 */
function toBashSingleQuotedArg(value: string): string {
	return `'${value.replace(/\\/g, "/").replace(/'/g, `'"'"'`)}'`;
}

/** 功能：生成会派生继承标准流后台进程的 Node 命令；参数 pidFile 为记录 PID 的路径；返回：Bash 命令。示例：createInheritedStdioCommand(pidPath)。 */
function createInheritedStdioCommand(pidFile: string): string {
	// 适合直接拼入 Bash 命令的 PID 文件参数。
	const pidFileArg = toBashSingleQuotedArg(pidFile);
	return (
		'node -e "' +
		"const fs=require('fs');" +
		"const {spawn}=require('child_process');" +
		"const child=spawn(process.execPath,['-e','setTimeout(()=>{},60000)'],{stdio:'inherit',detached:true});" +
		"fs.writeFileSync(process.argv[1], String(child.pid));" +
		"child.unref();" +
		"console.log('child-exiting');" +
		'" ' +
		pidFileArg
	);
}

/** 功能：读取 PID 文件并终止脱离子进程树；参数 pidFile 为 PID 路径；返回：无。示例：finally 中调用 cleanupDetachedChild(path)。 */
function cleanupDetachedChild(pidFile: string): void {
	if (!existsSync(pidFile)) {
		return;
	}

	// 从文件解析出的进程号；只有有限正整数才传给 taskkill。
	const pid = Number.parseInt(readFileSync(pidFile, "utf-8").trim(), 10);
	if (Number.isFinite(pid) && pid > 0) {
		try {
			execFileSync("taskkill", ["/F", "/T", "/PID", String(pid)], { stdio: "ignore" });
		} catch {
			// Process may have already exited.
			// 中文说明：进程若已自行退出，taskkill 失败属于可接受的清理竞态。
		}
	}
}

/** 功能：为异步操作增加硬超时；参数 promise 为任务、ms 为毫秒、onTimeout 为超时回调；返回：原结果或拒绝。示例：await withTimeout(task, 3000, abort)。 */
async function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => void): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		// 超时定时器标识；任务完成时必须清除，避免延迟拒绝。
		const timeoutId = setTimeout(() => {
			onTimeout();
			reject(new Error(`Timed out after ${ms}ms`));
		}, ms);

		promise.then(
			(value) => {
				clearTimeout(timeoutId);
				resolve(value);
			},
			(error: unknown) => {
				clearTimeout(timeoutId);
				reject(error);
			},
		);
	});
}

/** 功能：拼接工具结果中的文本块；参数 result 为可选内容数组；返回：换行连接的文本。示例：getTextOutput(result)。 */
function getTextOutput(result: { content?: Array<{ type: string; text?: string }> }): string {
	return (
		result.content
			?.filter((block) => block.type === "text")
			.map((block) => block.text ?? "")
			.join("\n") ?? ""
	);
}

describe.skipIf(process.platform !== "win32")("Windows child-process close handling", () => {
	// 当前用例的独占临时目录；用于存放后台进程 PID 文件。
	let testDir: string;

	// 功能：创建用例临时目录；参数：无；返回：无。示例：由 Vitest 在每个 Windows 用例前调用。
	beforeEach(() => {
		testDir = join(tmpdir(), `coding-agent-bash-close-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		mkdirSync(testDir, { recursive: true });
	});

	// 功能：递归删除用例临时目录；参数：无；返回：无。示例：由 Vitest 在用例后调用。
	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	it("executeBash resolves after the shell exits even if inherited stdio handles stay open", async () => {
		// 底层执行器场景的后台子进程 PID 文件。
		const pidFile = join(testDir, "executor-grandchild.pid");
		// 会输出 child-exiting 并留下后台进程的测试命令。
		const command = createInheritedStdioCommand(pidFile);
		// 在超时或 finally 中终止底层执行请求的控制器。
		const controller = new AbortController();

		try {
			// 在三秒硬超时内取得的 Bash 执行结果。
			const result = await withTimeout(
				executeBashWithOperations(command, process.cwd(), createLocalBashOperations(), {
					signal: controller.signal,
				}),
				3000,
				() => {
					controller.abort();
				},
			);

			expect(result.output).toContain("child-exiting");
			expect(result.exitCode).toBe(0);
			expect(result.cancelled).toBe(false);
		} finally {
			controller.abort();
			cleanupDetachedChild(pidFile);
		}
	});

	it("bash tool resolves after the shell exits even if inherited stdio handles stay open", async () => {
		// Bash 工具场景的后台子进程 PID 文件。
		const pidFile = join(testDir, "tool-grandchild.pid");
		// 与底层执行器测试相同形状的派生进程命令。
		const command = createInheritedStdioCommand(pidFile);
		// 用于在超时和 finally 中取消工具调用。
		const controller = new AbortController();
		// 绑定 testDir 的 Bash 工具实例，确保文件操作位于临时目录。
		const bashTool = createBashTool(testDir);

		try {
			// Bash 工具在三秒内返回的结构化结果。
			const result = await withTimeout(bashTool.execute("test-call", { command }, controller.signal), 3000, () => {
				controller.abort();
			});

			expect(getTextOutput(result)).toContain("child-exiting");
		} finally {
			controller.abort();
			cleanupDetachedChild(pidFile);
		}
	});
});
