/**
 * 文件职责：验证 CLI 在非交互模式下严格区分 stdout 与 stderr，避免结构化输出被启动日志污染。
 * 技术维度：使用 Vitest、临时项目配置、伪 npm 脚本和真实 Node 子进程采集两条输出流。
 * 产品维度：保证脚本、管道和 JSON 模式消费者可以安全解析 stdout，同时仍能在 stderr 看到提示。
 * 逻辑维度：构造会打印安装日志的可信项目，运行不同帮助/版本参数组合，逐项断言输出通道。
 * 关键边界：只有 --approve 才信任项目包安装；子进程继承环境但使用独占 agentDir 和 tsconfig。
 * 新手阅读建议：先看五个用例的参数与输出差异，再研究 runCli 如何制造并捕获启动噪声。
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ENV_AGENT_DIR } from "../src/config.ts";

// CLI TypeScript 入口的绝对路径。
const cliPath = resolve(__dirname, "../src/cli.ts");

// 本测试创建的临时根目录列表；每个用例结束后清空并删除。
const tempDirs: string[] = [];

// 功能：清理所有临时目录；参数：无；返回：无。示例：Vitest 每个用例后自动调用。
afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		// dir 是本用例登记的单个临时目录。
		rmSync(dir, { recursive: true, force: true });
	}
});

/** 功能：创建并登记 stdout 测试目录；参数：无；返回：绝对路径。示例：const root = createTempDir()。 */
function createTempDir(): string {
	// 由系统临时目录生成的独占根路径。
	const dir = mkdtempSync(join(tmpdir(), "pi-stdout-clean-"));
	tempDirs.push(dir);
	return dir;
}

/** 功能：准备伪 npm 项目并执行 CLI；参数 args 为命令行；返回：stdout、stderr 和退出码。示例：await runCli(["--version"])。 */
async function runCli(args: string[]): Promise<{ stdout: string; stderr: string; code: number | null }> {
	// 当前 CLI 运行的临时根目录。
	const tempRoot = createTempDir();
	// 隔离用户代理配置的目录。
	const agentDir = join(tempRoot, "agent");
	// CLI 的工作项目目录。
	const projectDir = join(tempRoot, "project");
	// 项目级 .pi 配置目录。
	const projectConfigDir = join(projectDir, ".pi");
	mkdirSync(agentDir, { recursive: true });
	mkdirSync(projectConfigDir, { recursive: true });

	// 模拟 npm 的脚本路径；执行时只打印两条典型安装日志。
	const fakeNpmPath = join(tempRoot, "fake-npm.mjs");
	writeFileSync(
		fakeNpmPath,
		[
			'console.log("changed 1 package in 471ms");',
			'console.log("found 0 vulnerabilities");',
			"process.exit(0);",
		].join("\n"),
		"utf-8",
	);

	writeFileSync(
		join(projectConfigDir, "settings.json"),
		JSON.stringify(
			{
				packages: ["npm:fake-package"],
				npmCommand: [process.execPath, fakeNpmPath],
			},
			null,
			2,
		),
		"utf-8",
	);

	return await new Promise((resolvePromise, reject) => {
		// 被测 CLI 子进程；标准输出和错误均通过管道捕获。
		const child = spawn(process.execPath, [cliPath, ...args], {
			cwd: projectDir,
			env: {
				...process.env,
				[ENV_AGENT_DIR]: agentDir,
				TSX_TSCONFIG_PATH: resolve(__dirname, "../../../tsconfig.json"),
			},
			stdio: ["ignore", "pipe", "pipe"],
		});

		// 子进程标准输出累积文本。
		let stdout = "";
		// 子进程标准错误累积文本。
		let stderr = "";
		child.stdout.on("data", (chunk) => {
			stdout += chunk.toString();
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		child.on("error", reject);
		child.on("close", (code) => {
			resolvePromise({ stdout, stderr, code });
		});
	});
}

describe("stdout cleanliness in non-interactive modes", () => {
	it("prints --version to stdout when stdout is redirected", async () => {
		// --version 在重定向环境下的进程结果。
		const result = await runCli(["--version"]);

		expect(result.code).toBe(0);
		expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
		expect(result.stderr).toBe("");
	});

	it("prints plain --help to stdout when stdout is redirected", async () => {
		// 普通 --help 的进程结果，帮助文本应进入 stdout。
		const result = await runCli(["--help"]);

		expect(result.code).toBe(0);
		expect(result.stdout).toContain("Usage:");
		expect(result.stderr).not.toContain("Usage:");
	});

	it("keeps stdout empty for --mode json --help while routing trusted startup chatter to stderr", async () => {
		// 可信 JSON 模式帮助请求的结果；安装日志与帮助均转入 stderr。
		const result = await runCli(["--mode", "json", "--help", "--approve"]);

		expect(result.code).toBe(0);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain("changed 1 package in 471ms");
		expect(result.stderr).toContain("found 0 vulnerabilities");
		expect(result.stderr).toContain("Usage:");
	});

	it("keeps stdout empty for -p --help while routing trusted startup chatter to stderr", async () => {
		// 可信打印模式帮助请求的结果；stdout 必须留给模型输出。
		const result = await runCli(["-p", "--help", "--approve"]);

		expect(result.code).toBe(0);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain("changed 1 package in 471ms");
		expect(result.stderr).toContain("found 0 vulnerabilities");
		expect(result.stderr).toContain("Usage:");
	});

	it("ignores untrusted project package installs for help", async () => {
		// 未批准项目配置时的打印模式帮助结果；伪 npm 不应运行。
		const result = await runCli(["-p", "--help"]);

		expect(result.code).toBe(0);
		expect(result.stdout).toBe("");
		expect(result.stderr).not.toContain("changed 1 package in 471ms");
		expect(result.stderr).not.toContain("found 0 vulnerabilities");
		expect(result.stderr).toContain("Usage:");
	});
});
