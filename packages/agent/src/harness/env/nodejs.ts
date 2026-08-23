/**
 * 【文件职责】ExecutionEnv 接口的 Node.js 实现（NodeExecutionEnv）：基于 node:fs / child_process
 *              提供 FileSystem 全部方法与 bash 命令执行能力，是 Harness 在本机运行时的默认环境。
 * 【技术维度】node:fs/promises 异步文件 API + 流式按行读取；spawn 子进程 + 进程树终止；
 *              跨平台 shell 探测（Git Bash/WSL/PATH）；Node 错误码 → 稳定 FileErrorCode 的映射。
 * 【产品维度】让智能体具备“读写本地文件 + 执行命令”的真实操作能力，是 coding-agent 各类工具的物理基础。
 * 【逻辑维度】模块级私有工具函数（路径解析、错误转换、shell 探测、进程等待）→ NodeExecutionEnv 类逐个实现接口方法。
 * 【关键边界】所有方法不抛异常、失败封装为 Result；fileInfo 用 lstat 不跟随符号链接；
 *              Windows 必须有 bash（Git Bash 优先）否则报 shell_unavailable；超时以“秒”为入参、上限约 24.8 天。
 * 【新手阅读建议】先读顶部常量与 resolvePath/toFileError 两个基础函数 → 再浏览 getShellConfig 了解跨平台探测 →
 *              最后按接口顺序阅读 NodeExecutionEnv 各方法。
 */
import { type ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { constants, createReadStream } from "node:fs";
import {
	access,
	appendFile,
	lstat,
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	realpath,
	rm,
	writeFile,
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import {
	type ExecutionEnv,
	ExecutionError,
	err,
	FileError,
	type FileInfo,
	type FileKind,
	ok,
	type Result,
	type ShellExecOptions,
	toError,
} from "../types.ts";

// setTimeout 可设置的最大毫秒数（32 位有符号整数上限，约 24.8 天）
const MAX_TIMEOUT_MS = 2_147_483_647;
// 与上对应的最大秒数
const MAX_TIMEOUT_SECONDS = MAX_TIMEOUT_MS / 1000;
// 进程退出后等待 stdio 收尾的宽限时间（毫秒）
const EXIT_STDIO_GRACE_MS = 100;

/**
 * 校验并换算超时（私有）：undefined 合法；非正数或非有限值报错；超过系统上限报错。
 * 参数 timeout —— 秒；返回毫秒数（或 undefined）或 ExecutionError。
 */
function resolveTimeoutMs(timeout: number | undefined): Result<number | undefined, ExecutionError> {
	if (timeout === undefined) return ok(undefined);
	if (!Number.isFinite(timeout) || timeout <= 0) {
		return err(new ExecutionError("timeout", "Invalid timeout: must be a finite number of seconds"));
	}

	const timeoutMs = timeout * 1000;
	if (timeoutMs > MAX_TIMEOUT_MS) {
		return err(new ExecutionError("timeout", `Invalid timeout: maximum is ${MAX_TIMEOUT_SECONDS} seconds`));
	}
	return ok(timeoutMs);
}

/**
 * 解析路径（私有）：支持 ~ 与 ~/ 前缀（展开到用户主目录）及 file:// URL；
 * 相对路径基于 cwd 解析为绝对路径。畸形 URL 按普通路径处理以维持“不抛异常”契约。
 */
function resolvePath(cwd: string, path: string): string {
	let normalized = path;
	if (normalized === "~") {
		normalized = homedir();
	} else if (normalized.startsWith("~/") || (process.platform === "win32" && normalized.startsWith("~\\"))) {
		normalized = join(homedir(), normalized.slice(2));
	} else if (normalized.startsWith("file://")) {
		try {
			normalized = fileURLToPath(normalized);
		} catch {
			// Keep malformed URLs as ordinary paths so filesystem methods preserve their non-throwing contract.
			// 保持畸形 URL 为普通路径，维持不抛异常的契约
		}
	}
	return isAbsolute(normalized) ? resolve(normalized) : resolve(cwd, normalized);
}

/**
 * 从 stats 提取文件种类（私有）：依次判定 file/directory/symlink；其余返回 undefined。
 */
function fileKindFromStats(stats: {
	isFile(): boolean;
	isDirectory(): boolean;
	isSymbolicLink(): boolean;
}): FileKind | undefined {
	if (stats.isFile()) return "file";
	if (stats.isDirectory()) return "directory";
	if (stats.isSymbolicLink()) return "symlink";
	return undefined;
}

/**
 * 由 stats 构造 FileInfo（私有）：name 取路径最后一段；无法识别的种类报 invalid 错误。
 */
function fileInfoFromStats(
	path: string,
	stats: { isFile(): boolean; isDirectory(): boolean; isSymbolicLink(): boolean; size: number; mtimeMs: number },
): Result<FileInfo, FileError> {
	const kind = fileKindFromStats(stats);
	if (!kind) return err(new FileError("invalid", "Unsupported file type", path));
	return ok({
		name: path.replace(/\/+$/, "").split("/").pop() ?? path,
		path,
		kind,
		size: stats.size,
		mtimeMs: stats.mtimeMs,
	});
}

// 判断是否为带 code 属性的 Node 错误（私有类型守卫）
function isNodeError(error: unknown): error is NodeJS.ErrnoException {
	return error instanceof Error && "code" in error;
}

/**
 * 把任意错误转换为稳定 FileError（私有）：按 Node errno 映射——ABORT_ERR→aborted、ENOENT→not_found、
 * EACCES/EPERM→permission_denied、ENOTDIR/EISDIR/EINVAL 等；未识别归为 unknown。
 */
function toFileError(error: unknown, path?: string): FileError {
	if (error instanceof FileError) return error;
	const cause = toError(error);
	if (isNodeError(error)) {
		const message = error.message;
		switch (error.code) {
			case "ABORT_ERR":
				return new FileError("aborted", message, path, cause);
			case "ENOENT":
				return new FileError("not_found", message, path, cause);
			case "EACCES":
			case "EPERM":
				return new FileError("permission_denied", message, path, cause);
			case "ENOTDIR":
				return new FileError("not_directory", message, path, cause);
			case "EISDIR":
				return new FileError("is_directory", message, path, cause);
			case "EINVAL":
				return new FileError("invalid", message, path, cause);
		}
	}
	return new FileError("unknown", cause.message, path, cause);
}

// 已中止时返回统一的 aborted 结果（私有）；否则返回 undefined 表示未中止
function abortResult<TValue>(signal: AbortSignal | undefined, path?: string): Result<TValue, FileError> | undefined {
	return signal?.aborted ? err(new FileError("aborted", "aborted", path)) : undefined;
}

// 探测路径是否存在（私有）：access F_OK 成功即存在
async function pathExists(path: string): Promise<boolean> {
	try {
		await access(path, constants.F_OK);
		return true;
	} catch {
		return false;
	}
}

/**
 * 运行短命令并收集 stdout（私有）：用于 where/which 探测；忽略 stderr；
 * 超时杀进程树；任何异常都解析为 status:null。参数 command/args/timeoutMs。
 */
async function runCommand(
	command: string,
	args: string[],
	timeoutMs: number,
): Promise<{ stdout: string; status: number | null }> {
	return await new Promise((resolve) => {
		let stdout = "";
		let child: ReturnType<typeof spawn>;
		try {
			child = spawn(command, args, {
				stdio: ["ignore", "pipe", "ignore"],
				windowsHide: true,
			});
		} catch {
			resolve({ stdout: "", status: null });
			return;
		}
		// 超时保护：到点杀掉整棵进程树
		const timeout = setTimeout(() => {
			if (child.pid) killProcessTree(child.pid);
		}, timeoutMs);
		child.stdout?.setEncoding("utf8");
		child.stdout?.on("data", (chunk: string) => {
			stdout += chunk;
		});
		child.on("error", () => {
			clearTimeout(timeout);
			resolve({ stdout: "", status: null });
		});
		child.on("close", (status) => {
			clearTimeout(timeout);
			resolve({ stdout, status });
		});
	});
}

// 在 PATH 中查找 bash（私有）：Windows 用 where bash.exe，其余用 which bash；校验首个结果确实存在
async function findBashOnPath(): Promise<string | null> {
	const result =
		process.platform === "win32"
			? await runCommand("where", ["bash.exe"], 5000)
			: await runCommand("which", ["bash"], 5000);
	if (result.status !== 0 || !result.stdout) return null;
	const firstMatch = result.stdout.trim().split(/\r?\n/)[0];
	return firstMatch && (await pathExists(firstMatch)) ? firstMatch : null;
}

/** shell 配置（中文说明）：可执行文件、固定参数与命令传递方式（argv 直接传参 或 stdin 写入）。 */
interface ShellConfig {
	shell: string;
	args: string[];
	commandTransport?: "argv" | "stdin";
}

// 判断是否为旧版 WSL 的 bash 路径（私有）：形如 X:\windows\system32|sysnative\bash.exe
function isLegacyWslBashPath(path: string): boolean {
	const normalized = path.replace(/\//g, "\\").toLowerCase();
	return /^[a-z]:\\windows\\(?:system32|sysnative)\\bash\.exe$/.test(normalized);
}

// 生成 bash 配置（私有）：旧版 WSL 需经 stdin 传命令（-s），常规 bash 用 -c
function getBashShellConfig(shell: string): ShellConfig {
	return isLegacyWslBashPath(shell) ? { shell, args: ["-s"], commandTransport: "stdin" } : { shell, args: ["-c"] };
}

/**
 * 探测可用 shell（私有）：优先自定义路径 → Windows 找 Git Bash（ProgramFiles 两处 + PATH）
 * → 类 Unix 先看 /bin/bash 再 PATH，最后退回 sh。找不到时给出带修复建议的错误。
 */
async function getShellConfig(customShellPath?: string): Promise<Result<ShellConfig, ExecutionError>> {
	if (customShellPath) {
		if (await pathExists(customShellPath)) {
			return ok(getBashShellConfig(customShellPath));
		}
		return err(new ExecutionError("shell_unavailable", `Custom shell path not found: ${customShellPath}`));
	}
	if (process.platform === "win32") {
		// 候选：两个 ProgramFiles 下的 Git Bash
		const candidates: string[] = [];
		const programFiles = process.env.ProgramFiles;
		if (programFiles) candidates.push(`${programFiles}\\Git\\bin\\bash.exe`);
		const programFilesX86 = process.env["ProgramFiles(x86)"];
		if (programFilesX86) candidates.push(`${programFilesX86}\\Git\\bin\\bash.exe`);
		for (const candidate of candidates) {
			if (await pathExists(candidate)) {
				return ok(getBashShellConfig(candidate));
			}
		}
		const bashOnPath = await findBashOnPath();
		if (bashOnPath) {
			return ok(getBashShellConfig(bashOnPath));
		}
		return err(
			new ExecutionError(
				"shell_unavailable",
				`No bash shell found. Options:\n` +
					`  1. Install Git for Windows: https://git-scm.com/download/win\n` +
					`  2. Add your bash to PATH (Cygwin, MSYS2, etc.)\n` +
					"  3. Configure an explicit shellPath\n\n" +
					`Searched Git Bash in:\n${candidates.map((path) => `  ${path}`).join("\n")}`,
			),
		);
	}

	if (await pathExists("/bin/bash")) {
		return ok(getBashShellConfig("/bin/bash"));
	}
	const bashOnPath = await findBashOnPath();
	if (bashOnPath) {
		return ok(getBashShellConfig(bashOnPath));
	}
	return ok({ shell: "sh", args: ["-c"] });
}

/**
 * 合成命令环境变量（私有）：inheritEnv=false 时仅用 extraEnv；
 * 否则 进程环境 ← shellEnv ← extraEnv 依次覆盖。
 */
function getShellEnv(
	baseEnv?: NodeJS.ProcessEnv,
	extraEnv?: Record<string, string>,
	inheritEnv = true,
): NodeJS.ProcessEnv {
	if (!inheritEnv) return { ...extraEnv };
	return {
		...process.env,
		...baseEnv,
		...extraEnv,
	};
}

/**
 * 终止整棵进程树（私有）：Windows 用 taskkill /F /T；POSIX 先向 -pid（进程组）发 SIGKILL，
 * 失败再直接对 pid 发；全部静默忽略错误。
 */
function killProcessTree(pid: number): void {
	if (process.platform === "win32") {
		try {
			spawn("taskkill", ["/F", "/T", "/PID", String(pid)], {
				stdio: "ignore",
				detached: true,
				windowsHide: true,
			});
		} catch {
			// Ignore errors.
		}
		return;
	}

	try {
		process.kill(-pid, "SIGKILL");
	} catch {
		try {
			process.kill(pid, "SIGKILL");
		} catch {
			// Process already dead.
		}
	}
}

/**
 * 等待子进程结束并拿到退出码（私有）：处理“exit 已发生但 stdio 尚未结束”的竞态——
 * exit 后若流迟迟不结束，启动 EXIT_STDIO_GRACE_MS 宽限计时器兜底 finalize；close 事件则直接完成。
 */
function waitForChildProcess(child: ChildProcess): Promise<number | null> {
	return new Promise((resolvePromise, reject) => {
		// 是否已定局
		let settled = false;
		// 是否已收到 exit
		let exited = false;
		// 记录的退出码
		let exitCode: number | null = null;
		// 退出后 stdio 宽限计时器
		let postExitTimer: ReturnType<typeof setTimeout> | undefined;
		// stdout/stderr 是否已结束
		let stdoutEnded = child.stdout === null;
		let stderrEnded = child.stderr === null;

		// 清理所有监听器与计时器
		const cleanup = (): void => {
			if (postExitTimer) clearTimeout(postExitTimer);
			child.removeListener("error", onError);
			child.removeListener("exit", onExit);
			child.removeListener("close", onClose);
			child.stdout?.removeListener("end", onStdoutEnd);
			child.stderr?.removeListener("end", onStderrEnd);
			child.stdout?.removeListener("data", onData);
			child.stderr?.removeListener("data", onData);
		};
		// 定局：只执行一次，销毁残留流
		const finalize = (code: number | null): void => {
			if (settled) return;
			settled = true;
			cleanup();
			child.stdout?.destroy();
			child.stderr?.destroy();
			resolvePromise(code);
		};
		// exit 且两条流都结束后即可定局
		const maybeFinalizeAfterExit = (): void => {
			if (exited && stdoutEnded && stderrEnded) finalize(exitCode);
		};
		// （重）设宽限计时器
		const armIdleTimer = (): void => {
			if (postExitTimer) clearTimeout(postExitTimer);
			postExitTimer = setTimeout(() => finalize(exitCode), EXIT_STDIO_GRACE_MS);
		};
		// 退出后仍有数据到达：续命宽限计时器
		const onData = (): void => {
			if (exited && !settled) armIdleTimer();
		};
		const onStdoutEnd = (): void => {
			stdoutEnded = true;
			maybeFinalizeAfterExit();
		};
		const onStderrEnd = (): void => {
			stderrEnded = true;
			maybeFinalizeAfterExit();
		};
		// 启动失败等致命错误：reject
		const onError = (error: Error): void => {
			if (settled) return;
			settled = true;
			cleanup();
			reject(error);
		};
		const onExit = (code: number | null): void => {
			exited = true;
			exitCode = code;
			maybeFinalizeAfterExit();
			if (!settled) armIdleTimer();
		};
		// close：stdio 全部关闭，直接定局
		const onClose = (code: number | null): void => finalize(code);

		child.stdout?.once("end", onStdoutEnd);
		child.stderr?.once("end", onStderrEnd);
		child.stdout?.on("data", onData);
		child.stderr?.on("data", onData);
		child.once("error", onError);
		child.once("exit", onExit);
		child.once("close", onClose);
	});
}

/**
 * NodeExecutionEnv（中文说明）：ExecutionEnv 的 Node.js 实现。
 * 构造参数决定工作目录、可选的自定义 bash 路径与附加环境变量；
 * cleanup 时会终止所有仍在运行的子进程。
 */
export class NodeExecutionEnv implements ExecutionEnv {
	// 当前工作目录（相对路径基准）
	cwd: string;
	// 自定义 bash 可执行文件路径（可选）
	private shellPath?: string;
	// 附加环境变量基线（可选）
	private shellEnv?: NodeJS.ProcessEnv;
	// 活跃子进程 PID 集合：cleanup 时统一终止
	private activeChildPids = new Set<number>();

	constructor(options: { cwd: string; shellPath?: string; shellEnv?: NodeJS.ProcessEnv }) {
		this.cwd = options.cwd;
		this.shellPath = options.shellPath;
		this.shellEnv = options.shellEnv;
	}

	// 转绝对寻址路径：纯字符串运算，不会失败
	async absolutePath(path: string): Promise<Result<string, FileError>> {
		return ok(resolvePath(this.cwd, path));
	}

	// 拼接路径段
	async joinPath(parts: string[]): Promise<Result<string, FileError>> {
		return ok(join(...parts));
	}

	/**
	 * 执行 shell 命令（中文说明）：完整流程——预检中止信号与超时 → 解析 cwd 并确认存在 →
	 * 探测 shell 配置 → spawn（POSIX 下 detached 形成进程组）→ 超时/中止杀树 →
	 * stdout/stderr 累计并回调（回调抛错记 callback_error 并中止）→ waitForChildProcess 定局。
	 */
	async exec(
		command: string,
		options?: ShellExecOptions,
	): Promise<Result<{ stdout: string; stderr: string; exitCode: number }, ExecutionError>> {
		if (options?.abortSignal?.aborted) return err(new ExecutionError("aborted", "aborted"));
		const timeoutMsResult = resolveTimeoutMs(options?.timeout);
		if (!timeoutMsResult.ok) return err(timeoutMsResult.error);
		const timeoutMs = timeoutMsResult.value;

		const cwd = options?.cwd ? resolvePath(this.cwd, options.cwd) : this.cwd;
		const shellConfig = await getShellConfig(this.shellPath);
		if (!shellConfig.ok) return shellConfig;
		try {
			await access(cwd, constants.F_OK);
		} catch (error) {
			const cause = toError(error);
			return err(
				new ExecutionError(
					"spawn_error",
					`Working directory does not exist: ${cwd}\nCannot execute bash commands.`,
					cause,
				),
			);
		}

		return await new Promise((resolvePromise) => {
			let stdout = "";
			let stderr = "";
			let settled = false;
			let timedOut = false;
			let callbackError: ExecutionError | undefined;
			let child: ReturnType<typeof spawn> | undefined;
			let timeoutId: ReturnType<typeof setTimeout> | undefined;

			// 中止处理器：杀掉整棵子进程树
			const onAbort = () => {
				if (child?.pid) {
					killProcessTree(child.pid);
				}
			};

			// 统一定局：清计时器、摘除监听、移出活跃集合
			const settle = (result: Result<{ stdout: string; stderr: string; exitCode: number }, ExecutionError>) => {
				if (timeoutId) clearTimeout(timeoutId);
				if (options?.abortSignal) options.abortSignal.removeEventListener("abort", onAbort);
				if (child?.pid) this.activeChildPids.delete(child.pid);
				if (settled) return;
				settled = true;
				resolvePromise(result);
			};

			try {
				// 旧版 WSL 经 stdin 传命令，其余经 argv
				const commandFromStdin = shellConfig.value.commandTransport === "stdin";
				child = spawn(
					shellConfig.value.shell,
					commandFromStdin ? shellConfig.value.args : [...shellConfig.value.args, command],
					{
						cwd,
						detached: process.platform !== "win32",
						env: getShellEnv(this.shellEnv, options?.env, options?.inheritEnv),
						stdio: [commandFromStdin ? "pipe" : "ignore", "pipe", "pipe"],
						windowsHide: true,
					},
				);
				if (child.pid) this.activeChildPids.add(child.pid);
				if (commandFromStdin) {
					child.stdin?.on("error", () => {});
					child.stdin?.end(command);
				}
			} catch (error) {
				const cause = toError(error);
				settle(err(new ExecutionError("spawn_error", cause.message, cause)));
				return;
			}

			// 超时定时器：到点标记超时并杀树
			timeoutId =
				timeoutMs !== undefined
					? setTimeout(() => {
							timedOut = true;
							if (child?.pid) {
								killProcessTree(child.pid);
							}
						}, timeoutMs)
					: undefined;

			if (options?.abortSignal) {
				if (options.abortSignal.aborted) {
					onAbort();
				} else {
					options.abortSignal.addEventListener("abort", onAbort, { once: true });
				}
			}

			child.stdout?.setEncoding("utf8");
			child.stderr?.setEncoding("utf8");
			child.stdout?.on("data", (chunk: string) => {
				stdout += chunk;
				try {
					options?.onStdout?.(chunk);
				} catch (error) {
					// 回调抛错视为 callback_error 并立即中止命令
					const cause = toError(error);
					callbackError = new ExecutionError("callback_error", cause.message, cause);
					onAbort();
				}
			});
			child.stderr?.on("data", (chunk: string) => {
				stderr += chunk;
				try {
					options?.onStderr?.(chunk);
				} catch (error) {
					const cause = toError(error);
					callbackError = new ExecutionError("callback_error", cause.message, cause);
					onAbort();
				}
			});

			void waitForChildProcess(child).then(
				(code) => {
					if (callbackError) {
						settle(err(callbackError));
						return;
					}
					if (timedOut) {
						settle(err(new ExecutionError("timeout", `timeout:${options?.timeout}`)));
						return;
					}
					if (options?.abortSignal?.aborted) {
						settle(err(new ExecutionError("aborted", "aborted")));
						return;
					}
					settle(ok({ stdout, stderr, exitCode: code ?? 0 }));
				},
				(error: Error) => settle(err(new ExecutionError("spawn_error", error.message, error))),
			);
		});
	}

	// 读取 UTF-8 文本文件
	async readTextFile(path: string, abortSignal?: AbortSignal): Promise<Result<string, FileError>> {
		const resolved = resolvePath(this.cwd, path);
		const aborted = abortResult<string>(abortSignal, resolved);
		if (aborted) return aborted;
		try {
			return ok(await readFile(resolved, { encoding: "utf8", signal: abortSignal }));
		} catch (error) {
			return err(toFileError(error, resolved));
		}
	}

	/**
	 * 按行读取文本（中文说明）：用文件流 + readline 迭代；maxLines≤0 直接返回空数组；
	 * 读满 maxLines 即停（尽早释放 IO）；循环内每行都检查中止信号；finally 关闭读取器与流。
	 */
	async readTextLines(
		path: string,
		options?: { maxLines?: number; abortSignal?: AbortSignal },
	): Promise<Result<string[], FileError>> {
		const resolved = resolvePath(this.cwd, path);
		const aborted = abortResult<string[]>(options?.abortSignal, resolved);
		if (aborted) return aborted;
		if (options?.maxLines !== undefined && options.maxLines <= 0) return ok([]);
		let stream: ReturnType<typeof createReadStream> | undefined;
		let lineReader: ReturnType<typeof createInterface> | undefined;
		try {
			stream = createReadStream(resolved, { encoding: "utf8", signal: options?.abortSignal });
			lineReader = createInterface({ input: stream, crlfDelay: Infinity });
			const lines: string[] = [];
			for await (const line of lineReader) {
				const loopAbort = abortResult<string[]>(options?.abortSignal, resolved);
				if (loopAbort) return loopAbort;
				lines.push(line);
				if (options?.maxLines !== undefined && lines.length >= options.maxLines) break;
			}
			const afterReadAbort = abortResult<string[]>(options?.abortSignal, resolved);
			if (afterReadAbort) return afterReadAbort;
			return ok(lines);
		} catch (error) {
			return err(toFileError(error, resolved));
		} finally {
			lineReader?.close();
			stream?.destroy();
		}
	}

	// 读取二进制文件
	async readBinaryFile(path: string, abortSignal?: AbortSignal): Promise<Result<Uint8Array, FileError>> {
		const resolved = resolvePath(this.cwd, path);
		const aborted = abortResult<Uint8Array>(abortSignal, resolved);
		if (aborted) return aborted;
		try {
			return ok(await readFile(resolved, { signal: abortSignal }));
		} catch (error) {
			return err(toFileError(error, resolved));
		}
	}

	// 写文件（覆盖语义）：先递归创建父目录，再写入
	async writeFile(
		path: string,
		content: string | Uint8Array,
		abortSignal?: AbortSignal,
	): Promise<Result<void, FileError>> {
		const resolved = resolvePath(this.cwd, path);
		const aborted = abortResult<void>(abortSignal, resolved);
		if (aborted) return aborted;
		try {
			await mkdir(resolve(resolved, ".."), { recursive: true });
			const afterMkdirAbort = abortResult<void>(abortSignal, resolved);
			if (afterMkdirAbort) return afterMkdirAbort;
			await writeFile(resolved, content, { signal: abortSignal });
			return ok(undefined);
		} catch (error) {
			return err(toFileError(error, resolved));
		}
	}

	// 追加写文件：同样先确保父目录存在
	async appendFile(path: string, content: string | Uint8Array): Promise<Result<void, FileError>> {
		const resolved = resolvePath(this.cwd, path);
		try {
			await mkdir(resolve(resolved, ".."), { recursive: true });
			await appendFile(resolved, content);
			return ok(undefined);
		} catch (error) {
			return err(toFileError(error, resolved));
		}
	}

	// 取元信息：lstat 不跟随符号链接
	async fileInfo(path: string): Promise<Result<FileInfo, FileError>> {
		const resolved = resolvePath(this.cwd, path);
		try {
			return fileInfoFromStats(resolved, await lstat(resolved));
		} catch (error) {
			return err(toFileError(error, resolved));
		}
	}

	// 列目录：withFileTypes 拿到种类；逐项 lstat 组装 FileInfo（任一项失败整体报错）
	async listDir(path: string, abortSignal?: AbortSignal): Promise<Result<FileInfo[], FileError>> {
		const resolved = resolvePath(this.cwd, path);
		const aborted = abortResult<FileInfo[]>(abortSignal, resolved);
		if (aborted) return aborted;
		try {
			const entries = await readdir(resolved, { withFileTypes: true });
			const infos: FileInfo[] = [];
			for (const entry of entries) {
				const loopAbort = abortResult<FileInfo[]>(abortSignal, resolved);
				if (loopAbort) return loopAbort;
				const entryPath = resolve(resolved, entry.name);
				try {
					const info = fileInfoFromStats(entryPath, await lstat(entryPath));
					if (info.ok) infos.push(info.value);
				} catch (error) {
					return err(toFileError(error, entryPath));
				}
			}
			return ok(infos);
		} catch (error) {
			return err(toFileError(error, resolved));
		}
	}

	// 规范路径：realpath 解析符号链接（要求目标存在）
	async canonicalPath(path: string): Promise<Result<string, FileError>> {
		const resolved = resolvePath(this.cwd, path);
		try {
			return ok(await realpath(resolved));
		} catch (error) {
			return err(toFileError(error, resolved));
		}
	}

	// 存在性检查：not_found 视为不存在，其他错误如实上报
	async exists(path: string): Promise<Result<boolean, FileError>> {
		const result = await this.fileInfo(path);
		if (result.ok) return ok(true);
		if (result.error.code === "not_found") return ok(false);
		return err(result.error);
	}

	// 创建目录：recursive 默认开启
	async createDir(path: string, options?: { recursive?: boolean }): Promise<Result<void, FileError>> {
		const resolved = resolvePath(this.cwd, path);
		try {
			await mkdir(resolved, { recursive: options?.recursive ?? true });
			return ok(undefined);
		} catch (error) {
			return err(toFileError(error, resolved));
		}
	}

	// 删除文件/目录：默认不递归不强删
	async remove(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<Result<void, FileError>> {
		const resolved = resolvePath(this.cwd, path);
		try {
			await rm(resolved, { recursive: options?.recursive ?? false, force: options?.force ?? false });
			return ok(undefined);
		} catch (error) {
			return err(toFileError(error, resolved));
		}
	}

	// 创建临时目录：系统临时目录 + 前缀（默认 tmp-）
	async createTempDir(prefix: string = "tmp-"): Promise<Result<string, FileError>> {
		try {
			return ok(await mkdtemp(join(tmpdir(), prefix)));
		} catch (error) {
			return err(toFileError(error));
		}
	}

	// 创建临时文件：先建临时目录，再以 UUID 命名空文件
	async createTempFile(options?: { prefix?: string; suffix?: string }): Promise<Result<string, FileError>> {
		const dir = await this.createTempDir("tmp-");
		if (!dir.ok) return dir;
		const filePath = join(dir.value, `${options?.prefix ?? ""}${randomUUID()}${options?.suffix ?? ""}`);
		try {
			await writeFile(filePath, "");
			return ok(filePath);
		} catch (error) {
			return err(toFileError(error, filePath));
		}
	}

	// 清理：终止所有仍活跃的子进程并清空集合
	async cleanup(): Promise<void> {
		for (const pid of this.activeChildPids) killProcessTree(pid);
		this.activeChildPids.clear();
	}
}
