/**
 * 文件职责：验证 CLI 启动已有会话时会正确写入 --name，并在名称无效时不追加元数据。
 * 技术维度：使用 Vitest、JSONL 会话文件、真实 Node 子进程和离线环境变量执行 CLI 集成测试。
 * 产品维度：保证用户即使后续模型校验失败，也能可靠命名所选会话且不会写入空名称。
 * 逻辑维度：创建最小会话文件，启动 CLI，收集退出信息，再从 JSONL 中筛选 session_info 名称。
 * 关键边界：子进程十秒后强制终止；测试固定离线并使用不存在模型，预期退出码为 1。
 * 新手阅读建议：先看两个测试对有效与空名称的对照，再阅读 setup、runCli 和 JSONL 读取函数。
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ENV_AGENT_DIR } from "../src/config.ts";

// CLI TypeScript 入口绝对路径；子进程由当前 Node 可执行程序加载它。
const cliPath = resolve(__dirname, "../src/cli.ts");
// 本文件创建的临时目录登记表；afterEach 会逐项删除。
const tempDirs: string[] = [];

// 功能：清空并删除全部测试目录；参数：无；返回：无。示例：Vitest 每个用例后自动调用。
afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		// dir 是本用例登记的单个临时目录，强制递归删除。
		rmSync(dir, { recursive: true, force: true });
	}
});

/** 功能：创建并登记测试目录；参数：无；返回：绝对路径。示例：const root = createTempDir()。 */
function createTempDir(): string {
	// 随机且独占的 CLI 测试根目录。
	const dir = mkdtempSync(join(tmpdir(), "pi-startup-session-name-"));
	tempDirs.push(dir);
	return dir;
}

// CLI 运行所需三类路径的集合。
interface CliDirs {
	agentDir: string;
	projectDir: string;
	sessionFile: string;
}

// CLI 子进程的可观察退出结果。
interface CliResult {
	code: number | null;
	signal: NodeJS.Signals | null;
	stderr: string;
}

/** 功能：写入包含会话头与助手消息的最小 JSONL；参数 projectDir、sessionFile；返回：无。示例：createSessionFile(project, file)。 */
function createSessionFile(projectDir: string, sessionFile: string): void {
	// 两条初始记录共用的 ISO 时间戳，保证会话文件内部一致。
	const timestamp = new Date().toISOString();
	writeFileSync(
		sessionFile,
		`${JSON.stringify({ type: "session", version: 3, id: "existing-session", timestamp, cwd: projectDir })}\n${JSON.stringify(
			{
				type: "message",
				id: "assistant-1",
				parentId: null,
				timestamp,
				message: {
					role: "assistant",
					content: [{ type: "text", text: "hello" }],
					provider: "anthropic",
					model: "claude-sonnet-4-5",
					timestamp: Date.now(),
				},
			},
		)}\n`,
	);
}

/** 功能：读取会话文件中的 session_info 名称；参数 sessionFile 为 JSONL 路径；返回：名称数组。示例：readSessionInfoNames(file)。 */
function readSessionInfoNames(sessionFile: string): string[] {
	return readFileSync(sessionFile, "utf8")
		.trim()
		.split("\n")
		.map((line) => JSON.parse(line) as { type?: string; name?: string })
		.filter((entry) => entry.type === "session_info")
		.map((entry) => entry.name ?? "");
}

/** 功能：以离线环境运行 CLI；参数 args 为命令行、dirs 为测试路径；返回：退出码、信号和 stderr。示例：await runCli(["--help"], dirs)。 */
async function runCli(args: string[], dirs: CliDirs): Promise<CliResult> {
	// 子进程标准错误累积文本，用于检查参数校验消息。
	let stderr = "";
	// CLI 子进程；stdout 被忽略，stderr 通过管道收集。
	const child = spawn(process.execPath, [cliPath, ...args], {
		cwd: dirs.projectDir,
		env: {
			...process.env,
			[ENV_AGENT_DIR]: dirs.agentDir,
			PI_OFFLINE: "1",
			TSX_TSCONFIG_PATH: resolve(__dirname, "../../../tsconfig.json"),
		},
		stdio: ["ignore", "ignore", "pipe"],
	});
	child.stderr.on("data", (chunk) => {
		stderr += chunk.toString();
	});

	return new Promise((resolvePromise, reject) => {
		// 防止 CLI 异常挂起的十秒保护定时器。
		const timeout = setTimeout(() => {
			child.kill("SIGKILL");
		}, 10_000);
		child.on("error", (error) => {
			clearTimeout(timeout);
			reject(error);
		});
		child.on("close", (code, signal) => {
			clearTimeout(timeout);
			resolvePromise({ code, signal, stderr });
		});
	});
}

/** 功能：创建代理目录、项目目录和初始会话文件；参数：无；返回：CliDirs。示例：const dirs = setup()。 */
function setup(): CliDirs {
	// 本用例所有文件的临时根目录。
	const tempRoot = createTempDir();
	// CLI 所需目录和文件路径集合。
	const dirs = {
		agentDir: join(tempRoot, "agent"),
		projectDir: join(tempRoot, "project"),
		sessionFile: join(tempRoot, "session.jsonl"),
	};
	mkdirSync(dirs.agentDir, { recursive: true });
	mkdirSync(dirs.projectDir, { recursive: true });
	createSessionFile(dirs.projectDir, dirs.sessionFile);
	return dirs;
}

describe("startup session name", () => {
	it("sets --name on the selected session before runtime model validation", async () => {
		// 有效名称场景的完整 CLI 目录夹具。
		const dirs = setup();
		// CLI 运行结果；missing-model 刻意触发名称写入后的失败。
		const result = await runCli(
			["--session", dirs.sessionFile, "--name", "  CLI Named Session  ", "--model", "missing-model", "-p", "hi"],
			dirs,
		);

		expect(result.code).toBe(1);
		expect(result.signal).toBeNull();
		expect(readSessionInfoNames(dirs.sessionFile)).toEqual(["CLI Named Session"]);
	});

	it("rejects empty --name values without appending session metadata", async () => {
		// 空白名称场景的完整 CLI 目录夹具。
		const dirs = setup();
		// CLI 运行结果；应在写 session_info 前拒绝空名称。
		const result = await runCli(
			["--session", dirs.sessionFile, "--name", "   ", "--model", "missing-model", "-p", "hi"],
			dirs,
		);

		expect(result.code).toBe(1);
		expect(result.signal).toBeNull();
		expect(result.stderr).toContain("--name requires a non-empty value");
		expect(readSessionInfoNames(dirs.sessionFile)).toEqual([]);
	});
});
