/**
 * 文件职责：验证 FooterDataProvider 在普通 Git 仓库、reftable 与 worktree 中读取和监听分支状态。
 * 技术维度：使用 Vitest mock 子进程、真实临时 .git 结构、FSWatcher 和假定时器构造 Git 边界场景。
 * 产品维度：确保终端页脚始终显示正确分支，并避免文件系统快速事件造成重复刷新或监听器失效。
 * 逻辑维度：创建三种仓库夹具，模拟同步/异步 git symbolic-ref，再覆盖读取、去抖、更新和错误重试。
 * 关键边界：不会运行真实 Git；reftable 的 .invalid HEAD 依赖命令回退；监听器错误后固定 5 秒重建。
 * 新手阅读建议：先看三个仓库夹具与 child_process mock，再按普通仓库、reftable、监听更新和重试阅读。
 */
import { execFile, spawnSync } from "child_process";
import { existsSync, type FSWatcher, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** 假 git symbolic-ref 当前应返回的分支；空串表示 detached。 */
let resolvedBranch = "main";

/** 用同步和异步替身模拟 FooterDataProvider 的 git symbolic-ref 调用。 */
vi.mock("child_process", () => ({
	execFile: vi.fn(
		(
			_command: string,
			args: readonly string[],
			_options: unknown,
			callback: (error: Error | null, stdout: string, stderr: string) => void,
		) => {
			if (args[1] === "symbolic-ref") {
				setTimeout(
					() =>
						callback(
							resolvedBranch ? null : new Error("detached"),
							resolvedBranch ? `${resolvedBranch}\n` : "",
							"",
						),
					0,
				);
				return;
			}
			setTimeout(() => callback(new Error("unsupported"), "", ""), 0);
		},
	),
	spawnSync: vi.fn((_command: string, args: readonly string[]) => {
		if (args[1] === "symbolic-ref") {
			return { status: resolvedBranch ? 0 : 1, stdout: resolvedBranch ? `${resolvedBranch}\n` : "", stderr: "" };
		}
		return { status: 1, stdout: "", stderr: "" };
	}),
}));

import { FooterDataProvider } from "../src/core/footer-data-provider.ts";

/** reftable worktree 夹具中工作区和公共 reftable 目录。 */
type WorktreeFixture = {
	/** worktree 根目录。 */
	worktreeDir: string;
	/** 公共 Git 目录下被监听的 reftable 目录。 */
	reftableDir: string;
};

/**
 * 创建 HEAD 为 .invalid 的普通 reftable 仓库结构。
 * @param tempDir 用例临时目录。
 * @returns 仓库根目录。
 * @example createPlainReftableRepo(tempDir);
 */
function createPlainReftableRepo(tempDir: string): string {
	/** 新建仓库根目录。 */
	const repoDir = join(tempDir, "repo");
	mkdirSync(join(repoDir, ".git", "reftable"), { recursive: true });
	writeFileSync(join(repoDir, ".git", "HEAD"), "ref: refs/heads/.invalid\n");
	return repoDir;
}

/**
 * 创建 HEAD 直接指向 main 的普通 Git 仓库结构。
 * @param tempDir 用例临时目录。
 * @returns 仓库根目录。
 * @example createPlainRepo(tempDir);
 */
function createPlainRepo(tempDir: string): string {
	/** 新建普通仓库根目录。 */
	const repoDir = join(tempDir, "repo");
	mkdirSync(join(repoDir, ".git"), { recursive: true });
	writeFileSync(join(repoDir, ".git", "HEAD"), "ref: refs/heads/main\n");
	return repoDir;
}

/**
 * 创建使用公共 reftable 目录的 worktree 文件结构。
 * @param tempDir 用例临时目录。
 * @returns worktree 与 reftable 目录路径。
 * @example createReftableWorktree(tempDir);
 */
function createReftableWorktree(tempDir: string): WorktreeFixture {
	/** 主仓库根目录。 */
	const repoDir = join(tempDir, "repo");
	/** 主仓库公共 .git 目录。 */
	const commonGitDir = join(repoDir, ".git");
	/** worktree 专属 Git 元数据目录。 */
	const gitDir = join(commonGitDir, "worktrees", "src");
	/** 独立 worktree 根目录。 */
	const worktreeDir = join(tempDir, "worktree");
	/** 公共 reftable 数据目录。 */
	const reftableDir = join(commonGitDir, "reftable");

	mkdirSync(gitDir, { recursive: true });
	mkdirSync(reftableDir, { recursive: true });
	mkdirSync(worktreeDir, { recursive: true });

	writeFileSync(join(worktreeDir, ".git"), `gitdir: ${gitDir}\n`);
	writeFileSync(join(gitDir, "HEAD"), "ref: refs/heads/.invalid\n");
	writeFileSync(join(gitDir, "commondir"), "../..\n");
	writeFileSync(join(reftableDir, "tables.list"), "0\n");

	return { worktreeDir, reftableDir };
}

/**
 * 轮询等待条件成立，超时则抛错。
 * @param condition 无副作用的完成条件。
 * @param timeoutMs 最长等待时间，默认 3 秒。
 * @returns 条件成立后完成的 Promise。
 * @example await waitFor(() => calls.length === 1);
 */
async function waitFor(condition: () => boolean, timeoutMs = 3000): Promise<void> {
	/** 开始等待的毫秒时间戳。 */
	const startedAt = Date.now();
	while (!condition()) {
		if (Date.now() - startedAt > timeoutMs) {
			throw new Error("Timed out waiting for condition");
		}
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
}

/** 覆盖 FooterDataProvider 的分支读取、reftable 监听和错误恢复。 */
describe("FooterDataProvider reftable branch detection", () => {
	/** 用例开始前进程的当前目录。 */
	let originalCwd: string;
	/** 当前用例独立使用的临时目录。 */
	let tempDir: string;

	/** 每个用例前保存 cwd、创建临时目录并重置 mock。 */
	beforeEach(() => {
		originalCwd = process.cwd();
		tempDir = mkdtempSync(join(tmpdir(), "footer-data-provider-"));
		resolvedBranch = "main";
		vi.mocked(spawnSync).mockClear();
		vi.mocked(execFile).mockClear();
	});

	/** 每个用例后恢复 cwd 并删除临时目录。 */
	afterEach(() => {
		process.chdir(originalCwd);
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("uses HEAD directly in a regular repo from a nested directory", () => {
		/** 普通仓库根目录。 */
		const repoDir = createPlainRepo(tempDir);
		/** 用于验证向上查找 .git 的嵌套目录。 */
		const nestedDir = join(repoDir, "src", "nested");
		mkdirSync(nestedDir, { recursive: true });
		process.chdir(nestedDir);

		/** 从嵌套目录读取分支的页脚数据提供器。 */
		const provider = new FooterDataProvider(nestedDir);
		try {
			expect(provider.getGitBranch()).toBe("main");
			expect(vi.mocked(spawnSync)).not.toHaveBeenCalled();
		} finally {
			provider.dispose();
		}
	});

	it("resolves the branch via git when HEAD is .invalid in a reftable repo", () => {
		/** HEAD 为 .invalid 的 reftable 仓库。 */
		const repoDir = createPlainReftableRepo(tempDir);
		process.chdir(repoDir);

		/** 应回退同步 git 命令解析分支的提供器。 */
		const provider = new FooterDataProvider(repoDir);
		try {
			expect(provider.getGitBranch()).toBe("main");
			expect(vi.mocked(spawnSync)).toHaveBeenCalledWith(
				"git",
				["--no-optional-locks", "symbolic-ref", "--quiet", "--short", "HEAD"],
				expect.objectContaining({
					cwd: expect.stringMatching(/repo$/),
					encoding: "utf8",
					stdio: ["ignore", "pipe", "ignore"],
				}),
			);
		} finally {
			provider.dispose();
		}
	});

	it("resolves the branch via git in a reftable-backed worktree", () => {
		/** reftable worktree 根目录。 */
		const { worktreeDir } = createReftableWorktree(tempDir);
		process.chdir(worktreeDir);

		/** 从 worktree 公共目录解析分支的提供器。 */
		const provider = new FooterDataProvider(worktreeDir);
		try {
			expect(provider.getGitBranch()).toBe("main");
		} finally {
			provider.dispose();
		}
	});

	it("treats an unresolved .invalid reftable HEAD as detached", () => {
		/** 无法解析 .invalid HEAD 的 reftable 仓库。 */
		const repoDir = createPlainReftableRepo(tempDir);
		process.chdir(repoDir);
		resolvedBranch = "";

		/** 应显示 detached 的提供器。 */
		const provider = new FooterDataProvider(repoDir);
		try {
			expect(provider.getGitBranch()).toBe("detached");
		} finally {
			provider.dispose();
		}
	});

	it("does not notify listeners when reftable updates keep the same branch", async () => {
		/** 用于触发 reftable 监听事件的目录。 */
		const { worktreeDir, reftableDir } = createReftableWorktree(tempDir);
		process.chdir(worktreeDir);

		/** 缓存 main 分支并监听 reftable 的提供器。 */
		const provider = new FooterDataProvider(worktreeDir);
		try {
			expect(provider.getGitBranch()).toBe("main");
			vi.mocked(spawnSync).mockClear();
			/** 记录分支变更通知的回调 mock。 */
			const onBranchChange = vi.fn();
			provider.onBranchChange(onBranchChange);

			writeFileSync(join(reftableDir, "tables.list"), "1\n");
			await waitFor(() => vi.mocked(execFile).mock.calls.length === 1);

			expect(vi.mocked(execFile)).toHaveBeenCalledTimes(1);
			expect(vi.mocked(spawnSync)).not.toHaveBeenCalled();
			expect(provider.getGitBranch()).toBe("main");
			expect(onBranchChange).not.toHaveBeenCalled();
		} finally {
			provider.dispose();
		}
	});

	it("debounces rapid reftable updates into a single async refresh", async () => {
		/** 快速连续写入 reftable 场景的夹具路径。 */
		const { worktreeDir, reftableDir } = createReftableWorktree(tempDir);
		process.chdir(worktreeDir);

		/** 应对快速事件去抖的提供器。 */
		const provider = new FooterDataProvider(worktreeDir);
		try {
			expect(provider.getGitBranch()).toBe("main");
			vi.mocked(execFile).mockClear();

			writeFileSync(join(reftableDir, "tables.list"), "1\n");
			writeFileSync(join(reftableDir, "tables.list"), "2\n");
			writeFileSync(join(reftableDir, "tables.list"), "3\n");
			await waitFor(() => vi.mocked(execFile).mock.calls.length === 1);
			await new Promise((resolve) => setTimeout(resolve, 650));

			expect(vi.mocked(execFile)).toHaveBeenCalledTimes(1);
		} finally {
			provider.dispose();
		}
	});

	it("updates the cached branch when the reftable directory changes", async () => {
		/** 分支实际变化场景的 worktree 与 reftable 路径。 */
		const { worktreeDir, reftableDir } = createReftableWorktree(tempDir);
		process.chdir(worktreeDir);

		/** 应异步更新缓存和通知监听器的提供器。 */
		const provider = new FooterDataProvider(worktreeDir);
		try {
			expect(provider.getGitBranch()).toBe("main");
			resolvedBranch = "foo";
			/** 记录有效分支变化通知的回调 mock。 */
			const onBranchChange = vi.fn();
			provider.onBranchChange(onBranchChange);

			writeFileSync(join(reftableDir, "tables.list"), "1\n");
			await waitFor(() => vi.mocked(execFile).mock.calls.length === 1);
			await waitFor(() => provider.getGitBranch() === "foo");

			expect(vi.mocked(execFile)).toHaveBeenCalledTimes(1);
			expect(provider.getGitBranch()).toBe("foo");
			expect(onBranchChange).toHaveBeenCalledTimes(1);
		} finally {
			provider.dispose();
		}
	});

	it("retries git watchers 5 seconds after an async fs.watch error", async () => {
		vi.useFakeTimers();
		/** 监听器错误重试场景的普通仓库。 */
		const repoDir = createPlainRepo(tempDir);
		process.chdir(repoDir);

		/** 使用真实 FSWatcher、假定时器的提供器。 */
		const provider = new FooterDataProvider(repoDir);
		try {
			/** 暴露内部 HEAD watcher 以验证销毁和重建。 */
			const providerWithInternals = provider as unknown as {
				headWatcher: FSWatcher | null;
			};
			/** 发生错误前创建的原始监听器。 */
			const originalWatcher = providerWithInternals.headWatcher;
			expect(originalWatcher).not.toBeNull();
			expect(originalWatcher?.listenerCount("error")).toBeGreaterThan(0);

			originalWatcher?.emit("error", new Error("simulated EMFILE"));
			expect(providerWithInternals.headWatcher).toBeNull();

			await vi.advanceTimersByTimeAsync(4999);
			expect(providerWithInternals.headWatcher).toBeNull();

			await vi.advanceTimersByTimeAsync(1);
			expect(providerWithInternals.headWatcher).not.toBeNull();
			expect(providerWithInternals.headWatcher).not.toBe(originalWatcher);
		} finally {
			provider.dispose();
			vi.useRealTimers();
		}
	});
});
