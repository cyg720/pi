/**
 * 文件职责：验证 `--session` 指向非会话文件时 CLI 友好报错且绝不改写原文件。
 * 技术维度：使用 Vitest、真实 Node 子进程、临时目录和离线 CLI 环境。
 * 产品维度：避免用户误选日志或其他文件时遭到数据破坏，并隐藏无用堆栈。
 * 逻辑维度：创建隔离目录与假日志，运行 CLI，检查退出码、stderr 和原始文件内容。
 * 关键边界：测试会启动子进程并递归删除自身临时目录；通过 PI_OFFLINE 禁止网络访问。
 * 新手阅读建议：先看 runCli 如何隔离环境，再看测试对错误文本和文件完整性的双重断言。
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ENV_AGENT_DIR } from "../src/config.ts";

/** 编码代理 TypeScript CLI 的绝对路径。 */
const cliPath = resolve(__dirname, "../src/cli.ts");
/** 本文件创建的临时目录清单。 */
const tempDirs: string[] = [];

/** 每例结束后清理所有临时目录。 */
afterEach(() => {
	// dir 是由 createTempDir 登记的系统临时目录。
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

/** @returns 真实路径规范化后的唯一临时目录。@example `const root = createTempDir()`。 */
function createTempDir(): string {
	/** 新建并 realpath 规范化的目录。 */
	const dir = realpathSync(mkdtempSync(join(tmpdir(), "pi-session-file-invalid-")));
	tempDirs.push(dir);
	return dir;
}

/**
 * 在隔离环境中运行 CLI。
 * @param args CLI 参数数组。
 * @param cwd 子进程工作目录。
 * @param agentDir 隔离的代理配置目录。
 * @returns 退出码和完整 stderr。
 * @example `await runCli(["--help"], cwd, agentDir)`。
 */
async function runCli(args: string[], cwd: string, agentDir: string): Promise<{ code: number | null; stderr: string }> {
	/** 子进程累计标准错误文本。 */
	let stderr = "";
	/** 子进程关闭时解析的退出码。 */
	const code = await new Promise<number | null>((resolvePromise, reject) => {
		/** 以当前 Node 运行 TypeScript CLI 的子进程。 */
		const child = spawn(process.execPath, [cliPath, ...args], {
			cwd,
			env: {
				...process.env,
				[ENV_AGENT_DIR]: agentDir,
				PI_OFFLINE: "1",
				TSX_TSCONFIG_PATH: resolve(__dirname, "../../../tsconfig.json"),
			},
			stdio: ["ignore", "ignore", "pipe"],
		});
		// chunk 是 stderr 的一段 Buffer 或字符串数据。
		child.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		child.on("error", reject);
		child.on("close", resolvePromise);
	});

	return { code, stderr };
}

/** 无效会话文件处理测试组。 */
describe("--session invalid file handling", () => {
	/** 验证友好错误、无堆栈并保持非会话文件逐字不变。 */
	it("prints a friendly error and preserves non-session file content", async () => {
		/** 当前用例临时根目录。 */
		const tempRoot = createTempDir();
		/** 隔离代理配置目录。 */
		const agentDir = join(tempRoot, "agent");
		/** 隔离项目目录。 */
		const projectDir = join(tempRoot, "project");
		/** 故意不是会话格式的日志路径。 */
		const sessionFile = join(tempRoot, "not-a-session.log");
		/** 必须在 CLI 失败后保持不变的原内容。 */
		const originalContent = '{"type":"event","data":"not a session"}\n';
		mkdirSync(agentDir, { recursive: true });
		mkdirSync(projectDir, { recursive: true });
		writeFileSync(sessionFile, originalContent);

		/** CLI 子进程执行结果。 */
		const result = await runCli(["--session", sessionFile, "-p", "hi"], projectDir, agentDir);

		expect(result.code).toBe(1);
		expect(result.stderr).toContain(`Error: Session file is not a valid pi session: ${sessionFile}`);
		expect(result.stderr).not.toContain("SessionManager.open");
		expect(result.stderr).not.toContain("at ");
		expect(readFileSync(sessionFile, "utf8")).toBe(originalContent);
	});
});
