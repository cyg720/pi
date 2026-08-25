/**
 * 文件职责：验证 NodeExecutionEnv 的路径、文件、目录、符号链接、临时资源、命令执行、流输出与取消能力。
 * 技术维度：使用 Vitest、Node 文件/子进程 API、真实 shell、AbortController 和临时目录执行跨平台集成测试。
 * 产品维度：保障代理工具在本机读写文件和运行命令时得到统一结果、明确错误并能可靠清理后台进程。
 * 逻辑维度：先定义超时与子进程辅助函数，再覆盖文件系统能力，最后检查 shell 环境、流、超时和中止。
 * 关键边界：部分用例需要符号链接或可用 Bash；Windows 专用用例会启动并清理分离子进程。
 * 新手阅读建议：先看基础文件操作与 FileError，再读 exec 正常路径，最后理解 WSL、超时和 cleanup 场景。
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { access, chmod, realpath, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { NodeExecutionEnv } from "../../src/harness/env/nodejs.ts";
import { FileError, getOrThrow } from "../../src/harness/types.ts";
import { executeShellWithCapture } from "../../src/harness/utils/shell-output.ts";
import { createTempDir } from "./session-test-utils.ts";

/** 用例中改动过权限且需要 afterEach 恢复为 0700 的路径列表。 */
const chmodRestorePaths: string[] = [];

/** 为 Promise 增加测试超时。参数 promise 为目标任务、ms 为毫秒、onTimeout 为可选回调；返回同类型 Promise。例如：await withTimeout(task, 3000)。 */
function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout?: () => void): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		/** 超时定时器编号，在目标 Promise 完成或失败时清除。 */
		const timeoutId = setTimeout(() => {
			onTimeout?.();
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

/** 把路径转换为 Bash 安全的单引号参数。参数 value 为原值；返回转义字符串。例如：toBashSingleQuotedArg(path)。 */
function toBashSingleQuotedArg(value: string): string {
	return `'${value.replace(/\\/g, "/").replace(/'/g, `'"'"'`)}'`;
}

/** 生成会启动继承 stdio 的分离子进程命令。参数 pidFile 为子进程编号文件；返回 shell 命令。例如：createInheritedStdioCommand(path)。 */
function createInheritedStdioCommand(pidFile: string): string {
	return (
		'node -e "' +
		"const fs=require('fs');" +
		"const {spawn}=require('child_process');" +
		"const child=spawn(process.execPath,['-e','setTimeout(()=>{},60000)'],{stdio:'inherit',detached:true});" +
		"fs.writeFileSync(process.argv[1], String(child.pid));" +
		"child.unref();" +
		"console.log('child-exiting');" +
		'" ' +
		toBashSingleQuotedArg(pidFile)
	);
}

/** 尽力终止 pid 文件记录的 Windows 子进程树。参数 pidFile 为编号文件；无返回值。例如：cleanupDetachedChild(path)。 */
function cleanupDetachedChild(pidFile: string): void {
	if (!existsSync(pidFile)) return;
	/** 从文件读取并解析出的分离子进程编号，必须为正有限数。 */
	const pid = Number.parseInt(readFileSync(pidFile, "utf8").trim(), 10);
	if (!Number.isFinite(pid) || pid <= 0) return;
	try {
		execFileSync("taskkill", ["/F", "/T", "/PID", String(pid)], { stdio: "ignore" });
	} catch {}
}

// 每个用例后恢复被修改路径的访问权限，忽略已删除路径。
afterEach(async () => {
	// path 是当前待恢复访问权限的测试路径。
	for (const path of chmodRestorePaths.splice(0)) {
		try {
			await access(path);
			await chmod(path, 0o700);
		} catch {}
	}
});

describe("NodeExecutionEnv", () => {
	// 测试场景：验证“undefined”对应的 Node 执行环境行为。
	it("reads, writes, lists, and removes files and directories", async () => {
		/** 当前用例使用的临时工作目录。 */
		const root = createTempDir();
		/** 以临时目录为 cwd 的 NodeExecutionEnv 实例。 */
		const env = new NodeExecutionEnv({ cwd: root });
		expect(getOrThrow(await env.absolutePath("nested/child"))).toBe(join(root, "nested/child"));
		expect(getOrThrow(await env.joinPath([root, "nested", "child"]))).toBe(join(root, "nested", "child"));
		getOrThrow(await env.createDir("nested/child"));
		getOrThrow(await env.writeFile("nested/child/file.txt", "hel"));
		getOrThrow(await env.appendFile("nested/child/file.txt", "lo"));
		expect(getOrThrow(await env.readTextFile("nested/child/file.txt"))).toBe("hello");
		expect(getOrThrow(await env.readTextLines("nested/child/file.txt", { maxLines: 1 }))).toEqual(["hello"]);
		expect(Buffer.from(getOrThrow(await env.readBinaryFile("nested/child/file.txt"))).toString("utf8")).toBe("hello");

		/** 目录列表接口返回的文件条目。 */
		const entries = getOrThrow(await env.listDir("nested/child"));
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({
			name: "file.txt",
			path: join(root, "nested/child/file.txt"),
			kind: "file",
			size: 5,
		});
		expect(typeof entries[0]!.mtimeMs).toBe("number");

		expect(getOrThrow(await env.exists("nested/child/file.txt"))).toBe(true);
		getOrThrow(await env.remove("nested/child/file.txt"));
		expect(getOrThrow(await env.exists("nested/child/file.txt"))).toBe(false);
	});

	// 测试场景：验证“undefined”对应的 Node 执行环境行为。
	it("expands home-relative paths and file URLs", async () => {
		/** 当前用例使用的临时工作目录。 */
		const root = createTempDir();
		/** 以临时目录为 cwd 的 NodeExecutionEnv 实例。 */
		const env = new NodeExecutionEnv({ cwd: root });
		expect(getOrThrow(await env.absolutePath("~/pi-node-env-test"))).toBe(join(homedir(), "pi-node-env-test"));
		/** 包含空格的测试文件绝对路径。 */
		const filePath = join(root, "file with spaces.txt");
		expect(getOrThrow(await env.absolutePath(pathToFileURL(filePath).href))).toBe(filePath);
	});

	// 测试场景：验证“undefined”对应的 Node 执行环境行为。
	it("returns fileInfo for files, directories, and symlinks without following symlinks", async () => {
		/** 当前用例使用的临时工作目录。 */
		const root = createTempDir();
		/** 以临时目录为 cwd 的 NodeExecutionEnv 实例。 */
		const env = new NodeExecutionEnv({ cwd: root });
		getOrThrow(await env.createDir("dir", { recursive: true }));
		getOrThrow(await env.writeFile("dir/file.txt", "hello"));
		await symlink(join(root, "dir/file.txt"), join(root, "file-link"));
		await symlink(join(root, "dir"), join(root, "dir-link"));

		expect(getOrThrow(await env.fileInfo("dir"))).toMatchObject({
			name: "dir",
			path: join(root, "dir"),
			kind: "directory",
		});
		expect(getOrThrow(await env.fileInfo("dir/file.txt"))).toMatchObject({
			name: "file.txt",
			path: join(root, "dir/file.txt"),
			kind: "file",
			size: 5,
		});
		expect(getOrThrow(await env.fileInfo("file-link"))).toMatchObject({
			name: "file-link",
			path: join(root, "file-link"),
			kind: "symlink",
		});
		expect(getOrThrow(await env.fileInfo("dir-link"))).toMatchObject({
			name: "dir-link",
			path: join(root, "dir-link"),
			kind: "symlink",
		});
		expect(getOrThrow(await env.canonicalPath("file-link"))).toBe(await realpath(join(root, "dir/file.txt")));
	});

	// 测试场景：验证“undefined”对应的 Node 执行环境行为。
	it("lists symlinks as symlinks", async () => {
		/** 当前用例使用的临时工作目录。 */
		const root = createTempDir();
		/** 以临时目录为 cwd 的 NodeExecutionEnv 实例。 */
		const env = new NodeExecutionEnv({ cwd: root });
		getOrThrow(await env.writeFile("target.txt", "hello"));
		await symlink(join(root, "target.txt"), join(root, "link.txt"));

		/** 目录列表接口返回的文件条目。 */
		const entries = getOrThrow(await env.listDir("."));
		expect(
			entries.map((entry) => ({ name: entry.name, kind: entry.kind })).sort((a, b) => a.name.localeCompare(b.name)),
		).toEqual([
			{ name: "link.txt", kind: "symlink" },
			{ name: "target.txt", kind: "file" },
		]);
	});

	// 测试场景：验证“undefined”对应的 Node 执行环境行为。
	it("stops reading text lines at the requested limit", async () => {
		/** 当前用例使用的临时工作目录。 */
		const root = createTempDir();
		/** 以临时目录为 cwd 的 NodeExecutionEnv 实例。 */
		const env = new NodeExecutionEnv({ cwd: root });
		getOrThrow(await env.writeFile("file.txt", "one\ntwo\nthree"));
		expect(getOrThrow(await env.readTextLines("file.txt", { maxLines: 1 }))).toEqual(["one"]);
	});

	// 测试场景：验证“undefined”对应的 Node 执行环境行为。
	it("returns FileError for missing paths and keeps exists false for missing paths", async () => {
		/** 当前用例使用的临时工作目录。 */
		const root = createTempDir();
		/** 以临时目录为 cwd 的 NodeExecutionEnv 实例。 */
		const env = new NodeExecutionEnv({ cwd: root });
		/** fileInfo 对缺失路径返回的结果对象。 */
		const info = await env.fileInfo("missing.txt");
		expect(info.ok).toBe(false);
		if (!info.ok) {
			expect(info.error).toBeInstanceOf(FileError);
			expect(info.error).toMatchObject({
				name: "FileError",
				code: "not_found",
				path: join(root, "missing.txt"),
			});
		}
		expect(getOrThrow(await env.exists("missing.txt"))).toBe(false);
	});

	// 测试场景：验证“undefined”对应的 Node 执行环境行为。
	it("returns FileError for listing non-directories", async () => {
		/** 当前用例使用的临时工作目录。 */
		const root = createTempDir();
		/** 以临时目录为 cwd 的 NodeExecutionEnv 实例。 */
		const env = new NodeExecutionEnv({ cwd: root });
		getOrThrow(await env.writeFile("file.txt", "hello"));
		/** 当前文件或命令操作返回的结果。 */
		const result = await env.listDir("file.txt");
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBeInstanceOf(FileError);
			expect(result.error).toMatchObject({ code: "not_directory" });
		}
	});

	// 测试场景：验证“undefined”对应的 Node 执行环境行为。
	it("appends to new files and creates parent directories", async () => {
		/** 当前用例使用的临时工作目录。 */
		const root = createTempDir();
		/** 以临时目录为 cwd 的 NodeExecutionEnv 实例。 */
		const env = new NodeExecutionEnv({ cwd: root });
		getOrThrow(await env.appendFile("new/nested/file.txt", "a"));
		getOrThrow(await env.appendFile("new/nested/file.txt", "b"));
		expect(getOrThrow(await env.readTextFile("new/nested/file.txt"))).toBe("ab");
	});

	// 测试场景：验证“undefined”对应的 Node 执行环境行为。
	it("creates temporary directories and files", async () => {
		/** 当前用例使用的临时工作目录。 */
		const root = createTempDir();
		/** 以临时目录为 cwd 的 NodeExecutionEnv 实例。 */
		const env = new NodeExecutionEnv({ cwd: root });
		/** 执行环境创建的临时目录路径。 */
		const tempDir = getOrThrow(await env.createTempDir("node-env-test-"));
		await expect(access(tempDir)).resolves.toBeUndefined();
		/** 执行环境创建的临时文件路径。 */
		const tempFile = getOrThrow(await env.createTempFile({ prefix: "prefix-", suffix: ".txt" }));
		await expect(access(tempFile)).resolves.toBeUndefined();
		expect(tempFile.endsWith(".txt")).toBe(true);
	});

	// 测试场景：验证“undefined”对应的 Node 执行环境行为。
	it("honors createDir recursive false and remove recursive/force options", async () => {
		/** 当前用例使用的临时工作目录。 */
		const root = createTempDir();
		/** 以临时目录为 cwd 的 NodeExecutionEnv 实例。 */
		const env = new NodeExecutionEnv({ cwd: root });
		/** 禁止递归创建缺失父目录时返回的失败结果。 */
		const createResult = await env.createDir("missing/child", { recursive: false });
		expect(createResult.ok).toBe(false);
		if (!createResult.ok) expect(createResult.error).toMatchObject({ code: "not_found" });

		getOrThrow(await env.writeFile("dir/child/file.txt", "hello"));
		/** 禁止递归删除非空目录时返回的失败结果。 */
		const removeDirectory = await env.remove("dir", { recursive: false });
		expect(removeDirectory.ok).toBe(false);
		getOrThrow(await env.remove("dir", { recursive: true }));
		expect(getOrThrow(await env.exists("dir"))).toBe(false);

		/** force 为 false 时删除缺失路径的失败结果。 */
		const removeMissing = await env.remove("missing", { force: false });
		expect(removeMissing.ok).toBe(false);
		getOrThrow(await env.remove("missing", { force: true }));
	});

	// 测试场景：验证“undefined”对应的 Node 执行环境行为。
	it("returns aborted results for pre-aborted cancellable file operations", async () => {
		/** 当前用例使用的临时工作目录。 */
		const root = createTempDir();
		/** 以临时目录为 cwd 的 NodeExecutionEnv 实例。 */
		const env = new NodeExecutionEnv({ cwd: root });
		getOrThrow(await env.writeFile("file.txt", "hello"));
		/** 控制文件或命令操作取消的 AbortController。 */
		const controller = new AbortController();
		controller.abort();
		/** 已中止控制器提供的 AbortSignal。 */
		const signal = controller.signal;

		/** 并行执行多种预中止文件操作得到的结果数组。 */
		const results = await Promise.all([
			env.readTextFile("file.txt", signal),
			env.readTextLines("file.txt", { abortSignal: signal }),
			env.readBinaryFile("file.txt", signal),
			env.writeFile("other.txt", "hello", signal),
			env.listDir(".", signal),
		]);
		// result 是当前并发执行环境操作的中止结果。
		for (const result of results) {
			expect(result.ok).toBe(false);
			if (!result.ok) expect(result.error).toMatchObject({ code: "aborted" });
		}
	});

	// 测试场景：验证“undefined”对应的 Node 执行环境行为。
	it("cleanup is best-effort", async () => {
		/** 当前用例使用的临时工作目录。 */
		const root = createTempDir();
		/** 以临时目录为 cwd 的 NodeExecutionEnv 实例。 */
		const env = new NodeExecutionEnv({ cwd: root });
		await expect(env.cleanup()).resolves.toBeUndefined();
	});

	// 测试场景：验证“undefined”对应的 Node 执行环境行为。
	it("executes commands in cwd with env overrides", async () => {
		/** 当前用例使用的临时工作目录。 */
		const root = createTempDir();
		/** 以临时目录为 cwd 的 NodeExecutionEnv 实例。 */
		const env = new NodeExecutionEnv({ cwd: root });
		/** 当前文件或命令操作返回的结果。 */
		const result = getOrThrow(
			await env.exec('printf \'%s:%s\' "$PWD" "$NODE_ENV_TEST"', {
				env: { NODE_ENV_TEST: "ok" },
			}),
		);
		expect(result).toEqual({ stdout: `${await realpath(root)}:ok`, stderr: "", exitCode: 0 });
	});

	// 测试场景：验证“undefined”对应的 Node 执行环境行为。
	it("can replace rather than inherit the default shell environment", async () => {
		/** 当前用例使用的临时工作目录。 */
		const root = createTempDir();
		/** 用于验证宿主环境继承行为的环境变量名。 */
		const inheritedKey = "PI_NODE_ENV_INHERITED_TEST";
		/** 构造执行环境时配置的环境变量名。 */
		const configuredKey = "PI_NODE_ENV_CONFIGURED_TEST";
		/** 单次 exec 调用显式提供的环境变量名。 */
		const explicitKey = "PI_NODE_ENV_EXPLICIT_TEST";
		/** 测试前宿主环境变量的原值，结束时恢复。 */
		const previousInherited = process.env[inheritedKey];
		process.env[inheritedKey] = "host";
		try {
			/** 以临时目录为 cwd 的 NodeExecutionEnv 实例。 */
			const env = new NodeExecutionEnv({ cwd: root, shellEnv: { [configuredKey]: "configured" } });
			/** 当前文件或命令操作返回的结果。 */
			const result = getOrThrow(
				await env.exec(`printf '%s:%s:%s' "\${${inheritedKey}-}" "\${${configuredKey}-}" "\${${explicitKey}-}"`, {
					inheritEnv: false,
					env: { [explicitKey]: "explicit" },
				}),
			);

			expect(result.stdout).toBe("::explicit");
		} finally {
			if (previousInherited === undefined) delete process.env[inheritedKey];
			else process.env[inheritedKey] = previousInherited;
		}
	});

	// 测试场景：验证“undefined”对应的 Node 执行环境行为。
	it("uses stdin command transport for legacy WSL bash paths", async () => {
		if (process.platform === "win32") return;
		/** 当前用例使用的临时工作目录。 */
		const root = createTempDir();
		/** 当前用例使用的伪 shell 或不可执行 shell 路径。 */
		const shellPath = "C:\\Windows\\System32\\bash.exe";
		/** 以临时目录为 cwd 的 NodeExecutionEnv 实例。 */
		const env = new NodeExecutionEnv({ cwd: root });
		getOrThrow(await env.writeFile(shellPath, '#!/bin/sh\nprintf \'args:%s\\n\' "$*" >&2\nexec /bin/bash "$@"\n'));
		await chmod(join(root, shellPath), 0o755);

		/** 测试修改前的进程工作目录。 */
		const originalCwd = process.cwd();
		/** 测试修改前的 PATH 环境变量。 */
		const originalPath = process.env.PATH;
		/** 测试覆盖前 process.platform 的属性描述符。 */
		const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");
		try {
			process.chdir(root);
			process.env.PATH = `${root}${delimiter}${originalPath ?? ""}`;
			Object.defineProperty(process, "platform", {
				configurable: true,
				value: "win32",
			});

			/** 模拟 Windows WSL bash 路径的执行环境。 */
			const wslEnv = new NodeExecutionEnv({ cwd: root, shellPath });
			/** 拆分构造的 shell 变量展开文本，避免模板字符串提前求值。 */
			const nameExpansion = "$" + "{name}";
			/** 当前文件或命令操作返回的结果。 */
			const result = getOrThrow(await wslEnv.exec(`name='World'; echo "Hello, ${nameExpansion}!"`));

			expect(result).toEqual({ stdout: "Hello, World!\n", stderr: "args:-s\n", exitCode: 0 });
		} finally {
			process.chdir(originalCwd);
			process.env.PATH = originalPath;
			if (platformDescriptor) {
				Object.defineProperty(process, "platform", platformDescriptor);
			}
		}
	});

	// Windows 下验证父 shell 退出后，即使分离后代仍持有继承 stdio，执行 Promise 也能完成。
	it.skipIf(process.platform !== "win32")(
		"settles after the shell exits when a detached descendant retains inherited stdio",
		async () => {
			/** 当前用例使用的临时工作目录。 */
			const root = createTempDir();
			/** 分离子进程写入编号的文件路径。 */
			const pidFile = join(root, "grandchild.pid");
			/** 以临时目录为 cwd 的 NodeExecutionEnv 实例。 */
			const env = new NodeExecutionEnv({ cwd: root });
			/** 控制文件或命令操作取消的 AbortController。 */
			const controller = new AbortController();
			try {
				/** 当前文件或命令操作返回的结果。 */
				const result = getOrThrow(
					await withTimeout(
						env.exec(createInheritedStdioCommand(pidFile), { abortSignal: controller.signal }),
						3000,
						() => controller.abort(),
					),
				);
				expect(result.stdout).toContain("child-exiting");
			} finally {
				controller.abort();
				cleanupDetachedChild(pidFile);
			}
		},
	);

	// 测试场景：验证“undefined”对应的 Node 执行环境行为。
	it("cleanup terminates active shell processes", async () => {
		/** 当前用例使用的临时工作目录。 */
		const root = createTempDir();
		/** 以临时目录为 cwd 的 NodeExecutionEnv 实例。 */
		const env = new NodeExecutionEnv({ cwd: root });
		/** 仍在运行、随后由 cleanup 终止的命令 Promise。 */
		const execution = env.exec("touch started; sleep 60");
		// 最多轮询 100 次等待命令创建 started 文件，attempt 为从 0 开始的尝试次数。
		for (let attempt = 0; attempt < 100 && !getOrThrow(await env.exists("started")); attempt++) {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
		expect(getOrThrow(await env.exists("started"))).toBe(true);
		await env.cleanup();
		await expect(withTimeout(execution, 3000)).resolves.toMatchObject({ ok: true });
	});

	// 测试场景：验证“undefined”对应的 Node 执行环境行为。
	it("streams stdout and stderr chunks", async () => {
		/** 当前用例使用的临时工作目录。 */
		const root = createTempDir();
		/** 以临时目录为 cwd 的 NodeExecutionEnv 实例。 */
		const env = new NodeExecutionEnv({ cwd: root });
		/** 流回调累计收到的标准输出文本。 */
		let stdout = "";
		/** 流回调累计收到的标准错误文本。 */
		let stderr = "";
		/** 当前文件或命令操作返回的结果。 */
		const result = getOrThrow(
			await env.exec("printf out; printf err >&2", {
				onStdout: (chunk) => {
					stdout += chunk;
				},
				onStderr: (chunk) => {
					stderr += chunk;
				},
			}),
		);
		expect(result).toEqual({ stdout: "out", stderr: "err", exitCode: 0 });
		expect(stdout).toBe("out");
		expect(stderr).toBe("err");
	});

	// 测试场景：验证“undefined”对应的 Node 执行环境行为。
	it("reports a missing working directory before spawning", async () => {
		/** 当前用例使用的临时工作目录。 */
		const root = createTempDir();
		/** 以临时目录为 cwd 的 NodeExecutionEnv 实例。 */
		const env = new NodeExecutionEnv({ cwd: join(root, "missing") });
		/** 当前文件或命令操作返回的结果。 */
		const result = await env.exec("printf ok");

		expect(result).toMatchObject({
			ok: false,
			error: { code: "spawn_error", message: expect.stringContaining("Working directory does not exist") },
		});
	});

	// 测试场景：验证“undefined”对应的 Node 执行环境行为。
	it("returns non-zero command exit codes as successful execution results", async () => {
		/** 当前用例使用的临时工作目录。 */
		const root = createTempDir();
		/** 以临时目录为 cwd 的 NodeExecutionEnv 实例。 */
		const env = new NodeExecutionEnv({ cwd: root });
		/** 当前文件或命令操作返回的结果。 */
		const result = getOrThrow(await env.exec("exit 7"));
		expect(result).toEqual({ stdout: "", stderr: "", exitCode: 7 });
	});

	// 测试场景：验证“undefined”对应的 Node 执行环境行为。
	it("returns timeout errors for commands exceeding the timeout", async () => {
		/** 当前用例使用的临时工作目录。 */
		const root = createTempDir();
		/** 以临时目录为 cwd 的 NodeExecutionEnv 实例。 */
		const env = new NodeExecutionEnv({ cwd: root });
		/** 当前文件或命令操作返回的结果。 */
		const result = await env.exec("sleep 5", { timeout: 0.01 });
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toMatchObject({ code: "timeout" });
	});

	// 测试场景：验证“undefined”对应的 Node 执行环境行为。
	it("returns callback errors from exec stream handlers", async () => {
		/** 当前用例使用的临时工作目录。 */
		const root = createTempDir();
		/** 以临时目录为 cwd 的 NodeExecutionEnv 实例。 */
		const env = new NodeExecutionEnv({ cwd: root });
		/** 当前文件或命令操作返回的结果。 */
		const result = await env.exec("printf out", {
			onStdout: () => {
				throw new Error("callback failed");
			},
		});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toMatchObject({ code: "callback_error", message: "callback failed" });
	});

	// 测试场景：验证“undefined”对应的 Node 执行环境行为。
	it("returns shell unavailable and spawn errors", async () => {
		/** 当前用例使用的临时工作目录。 */
		const root = createTempDir();
		/** 指向不存在 shell 的执行环境。 */
		const missingShellEnv = new NodeExecutionEnv({ cwd: root, shellPath: join(root, "missing-shell") });
		/** 不存在 shell 时返回的失败结果。 */
		const missingShell = await missingShellEnv.exec("printf ok");
		expect(missingShell.ok).toBe(false);
		if (!missingShell.ok) expect(missingShell.error).toMatchObject({ code: "shell_unavailable" });

		/** 当前用例使用的伪 shell 或不可执行 shell 路径。 */
		const shellPath = join(root, "not-executable-shell");
		/** 以临时目录为 cwd 的 NodeExecutionEnv 实例。 */
		const env = new NodeExecutionEnv({ cwd: root });
		getOrThrow(await env.writeFile(shellPath, "not executable"));
		/** 指向不可执行 shell 文件的执行环境。 */
		const spawnErrorEnv = new NodeExecutionEnv({ cwd: root, shellPath });
		/** shell 无法启动时返回的失败结果。 */
		const spawnError = await spawnErrorEnv.exec("printf ok");
		expect(spawnError.ok).toBe(false);
		if (!spawnError.ok) expect(spawnError.error).toMatchObject({ code: "spawn_error" });
	});

	// 测试场景：验证“undefined”对应的 Node 执行环境行为。
	it("returns an aborted result for aborted commands", async () => {
		/** 当前用例使用的临时工作目录。 */
		const root = createTempDir();
		/** 以临时目录为 cwd 的 NodeExecutionEnv 实例。 */
		const env = new NodeExecutionEnv({ cwd: root });
		/** 控制文件或命令操作取消的 AbortController。 */
		const controller = new AbortController();
		/** 启动后将由 AbortController 取消的命令 Promise。 */
		const promise = env.exec("sleep 5", { abortSignal: controller.signal });
		controller.abort();
		/** 当前文件或命令操作返回的结果。 */
		const result = await promise;
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toMatchObject({ code: "aborted" });
	});

	// 测试场景：验证“undefined”对应的 Node 执行环境行为。
	it("captures large shell output to a full output file through the execution env", async () => {
		/** 当前用例使用的临时工作目录。 */
		const root = createTempDir();
		/** 以临时目录为 cwd 的 NodeExecutionEnv 实例。 */
		const env = new NodeExecutionEnv({ cwd: root });
		/** 当前文件或命令操作返回的结果。 */
		const result = getOrThrow(await executeShellWithCapture(env, "yes line | head -n 15000"));
		expect(result.truncated).toBe(true);
		expect(result.fullOutputPath).toBeDefined();
		/** 从捕获文件读取的完整大输出文本。 */
		const fullOutput = getOrThrow(await env.readTextFile(result.fullOutputPath!));
		expect(fullOutput.split("\n").length).toBeGreaterThan(10000);
		expect(result.output.length).toBeLessThan(fullOutput.length);
	});
});
