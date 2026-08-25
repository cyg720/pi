/**
 * 文件职责：验证 CLI 的只读命令不会提前占用 `--session-id`，并检查缺失、已存在和非法 ID 的提示行为。
 * 技术维度：使用 Vitest 启动真实 TypeScript CLI 子进程，在临时 agent/project/session 目录中扫描 JSONL 标头。
 * 产品维度：避免用户查看帮助或模型列表时意外创建会话，同时为新建、打开和 fork 冲突提供明确反馈。
 * 逻辑维度：先提供目录、扫描、子进程和会话写入辅助器，再覆盖只读命令、缺失/已有 ID 与校验失败。
 * 关键边界：CLI 以离线环境运行；macOS 临时目录需 realpath；递归扫描忽略损坏会话文件。
 * 新手阅读建议：先看 runCli 如何隔离环境和捕获 stderr，再按命令参数与 hasSessionWithId 结果阅读用例。
 */
import { spawn } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ENV_AGENT_DIR } from "../src/config.ts";

// cliPath 是测试直接交给 Node.js 执行的 TypeScript CLI 入口绝对路径。
const cliPath = resolve(__dirname, "../src/cli.ts");
// tempDirs 收集所有用例临时根目录，afterEach 中统一删除。
const tempDirs: string[] = [];

// 每个用例结束后清理临时文件树。
afterEach(() => {
	// dir 是当前待删除的测试临时目录，只来自 tempDirs 登记项。
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

/** 创建物理路径形式的临时根目录并登记清理；无参数；返回绝对路径。 */
function createTempDir(): string {
	// realpath: on macOS tmpdir() is a symlink (/var -> /private/var), but the
	// macOS 的 tmpdir 通常经 `/var` 符号链接，而子进程 cwd 会看到 `/private/var` 物理路径。
	// spawned CLI sees the physical path via process.cwd(). Session cwd
	// 会话 cwd 的文本比较要求测试夹具也使用相同物理路径。
	// filtering compares paths textually, so the fixture must use physical paths.
	// 因此这里先 realpath，避免逻辑相同但字符串不同造成误判。
	// dir 是规范化后的唯一临时目录。
	const dir = realpathSync(mkdtempSync(join(tmpdir(), "pi-session-id-readonly-")));
	tempDirs.push(dir);
	return dir;
}

/** 递归查找根目录下是否存在指定 ID 的会话标头；参数 root/sessionId 为根目录和目标 ID；返回布尔值。 */
function hasSessionWithId(root: string, sessionId: string): boolean {
	if (!existsSync(root)) return false;
	for (const entry of readdirSync(root, { withFileTypes: true })) {
		// path 是当前目录项的完整路径。
		const path = join(root, entry.name);
		if (entry.isDirectory() && hasSessionWithId(path, sessionId)) return true;
		if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;

		try {
			// firstLine 是 JSONL 会话文件的首条标头文本。
			const firstLine = readFileSync(path, "utf8").split("\n", 1)[0];
			// header 只读取判断会话 ID 所需的字段。
			const header = JSON.parse(firstLine) as { type?: string; id?: string };
			if (header.type === "session" && header.id === sessionId) return true;
		} catch {
			// Ignore malformed session files.
			// 损坏会话文件不影响继续扫描其他目录项。
		}
	}
	return false;
}

// CliDirs 描述每次子进程测试隔离出的 agent、项目和会话目录。
interface CliDirs {
	agentDir: string;
	projectDir: string;
	sessionDir: string;
}

/**
 * 在隔离目录和离线环境中运行 CLI 并收集退出码和 stderr。
 * @param args 固定参数数组，或根据临时目录动态生成参数的函数。
 * @param setup 可选的文件夹/会话准备回调。
 * @returns 子进程结果；例如 `await runCli(["--help"])`。
 */
async function runCli(
	args: string[] | ((dirs: CliDirs) => string[]),
	setup?: (dirs: CliDirs) => void,
): Promise<{ code: number | null; agentDir: string; stderr: string }> {
	// tempRoot 是当前 CLI 运行的临时根目录。
	const tempRoot = createTempDir();
	// dirs 把三种用途目录分开，避免默认路径互相干扰。
	const dirs: CliDirs = {
		agentDir: join(tempRoot, "agent"),
		projectDir: join(tempRoot, "project"),
		sessionDir: join(tempRoot, "sessions"),
	};
	mkdirSync(dirs.agentDir, { recursive: true });
	mkdirSync(dirs.projectDir, { recursive: true });
	setup?.(dirs);
	// resolvedArgs 是最终传给 CLI 的参数数组。
	const resolvedArgs = typeof args === "function" ? args(dirs) : args;

	// stderr 累积子进程标准错误文本，供警告和校验断言。
	let stderr = "";
	// code 等待子进程关闭后得到退出码，启动失败则拒绝 Promise。
	const code = await new Promise<number | null>((resolvePromise, reject) => {
		// child 是在临时项目目录、离线环境中启动的 Node.js CLI 进程。
		const child = spawn(process.execPath, [cliPath, ...resolvedArgs], {
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
		child.on("error", reject);
		child.on("close", resolvePromise);
	});

	return { code, agentDir: dirs.agentDir, stderr };
}

/** 写入只含会话标头的 JSONL 文件；参数为目录、cwd 和 ID；无返回值。 */
function writeSession(sessionDir: string, cwd: string, id: string): void {
	writeFileSync(
		join(sessionDir, `${id}.jsonl`),
		`${JSON.stringify({ type: "session", version: 3, id, timestamp: new Date().toISOString(), cwd })}\n`,
	);
}

// 验证带 session-id 的帮助/列表等只读路径不会预留会话文件。
describe("--session-id read-only commands", () => {
	it("does not reserve a session for --help", async () => {
		// result 是带自定义 ID 执行帮助命令的子进程结果。
		const result = await runCli(["--session-id", "read-only-help", "--help"]);

		expect(result.code).toBe(0);
		expect(hasSessionWithId(join(result.agentDir, "sessions"), "read-only-help")).toBe(false);
	});

	it("allows --no-session with --session-id", async () => {
		// result 验证 no-session 与 session-id 可同时出现且不落盘。
		const result = await runCli(["--no-session", "--session-id", "ephemeral-id", "--help"]);

		expect(result.code).toBe(0);
		expect(hasSessionWithId(join(result.agentDir, "sessions"), "ephemeral-id")).toBe(false);
	});

	it("does not reserve a session for --list-models", async () => {
		// result 是列表模型只读命令的执行结果。
		const result = await runCli(["--session-id", "read-only-models", "--list-models"]);

		expect(result.code).toBe(0);
		expect(hasSessionWithId(join(result.agentDir, "sessions"), "read-only-models")).toBe(false);
	});

	it("warns when a missing --session-id creates a new session", async () => {
		// result 模拟缺失会话 ID 后继续进入需会话的提示模式。
		const result = await runCli((dirs) => [
			"--session-dir",
			dirs.sessionDir,
			"--session-id",
			"missing-session-id",
			"--model",
			"missing-model",
			"-p",
			"hi",
		]);

		expect(result.code).toBe(1);
		expect(result.stderr).toContain(
			"Warning: No project session found with id 'missing-session-id'; creating a new session with that id.",
		);
	});

	it("does not warn when --session-id opens an existing session", async () => {
		// result 在 setup 创建已有会话后按 ID 打开它。
		const result = await runCli(
			(dirs) => [
				"--session-dir",
				dirs.sessionDir,
				"--session-id",
				"existing-session-id",
				"--model",
				"missing-model",
				"-p",
				"hi",
			],
			(dirs) => {
				mkdirSync(dirs.sessionDir, { recursive: true });
				writeSession(dirs.sessionDir, dirs.projectDir, "existing-session-id");
			},
		);

		expect(result.code).toBe(1);
		expect(result.stderr).not.toContain("No project session found with id 'existing-session-id'");
	});

	it("rejects an existing fork target session id", async () => {
		// result 尝试把 fork 目标设为已存在 ID，应失败。
		const result = await runCli(
			(dirs) => ["--session-dir", dirs.sessionDir, "--fork", "source-id", "--session-id", "existing-id", "-p", "hi"],
			(dirs) => {
				mkdirSync(dirs.sessionDir, { recursive: true });
				writeSession(dirs.sessionDir, dirs.projectDir, "source-id");
				writeSession(dirs.sessionDir, dirs.projectDir, "existing-id");
			},
		);

		expect(result.code).toBe(1);
		expect(result.stderr).toContain("Session already exists with id 'existing-id'");
	});
});

// 验证 CLI 把 SessionManager 的 ID 校验错误转为简洁用户消息。
describe("--session-id validation", () => {
	it("rejects ids invalid under SessionManager rules without stack traces", async () => {
		for (const id of ["-bad", "bad id"]) {
			// result 是当前非法 ID 的 CLI 执行结果。
			const result = await runCli(["--session-id", id, "-p", "hi"]);

			expect(result.code).toBe(1);
			expect(result.stderr).toContain("Session id must be non-empty");
			expect(result.stderr).not.toContain("SessionManager.create");
		}
	});
});
