/**
 * Tests for git-based extension updates, specifically handling force-push scenarios.
 *
 * These tests verify that DefaultPackageManager.update() handles:
 * - Normal git updates (no force-push)
 * - Force-pushed remotes gracefully (currently fails, fix needed)
 */
/**
 * 文件职责：验证 DefaultPackageManager 对 Git 扩展的正常更新、历史重写、固定引用、临时缓存和作用域处理。
 * 技术维度：使用 Vitest、真实本地 Git 仓库、spawnSync、临时目录和内部命令替身执行集成测试。
 * 产品维度：确保用户安装的 Git 扩展能更新到正确提交，并在 force-push 或固定版本场景中保持可恢复和可预测。
 * 逻辑维度：先提供 Git 辅助函数和远程/安装目录装配，再按正常、重写、固定、临时和作用域分组验证。
 * 关键边界：测试要求本机可用 Git；所有仓库均位于临时目录，固定来源不得越过配置 ref。
 * 新手阅读建议：先读 setupRemoteAndInstall，再看正常更新，随后比较 force-push、pinned 与 temporary 分组。
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DefaultPackageManager } from "../src/core/package-manager.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";

// Helper to run git commands in a directory
// 在指定目录运行 Git 命令的辅助函数。
/** 在指定目录同步执行 Git 命令。参数 args 为子命令参数、cwd 为目录；返回去空白 stdout，失败抛错。例如：git(["status"], dir)。 */
function git(args: string[], cwd: string): string {
	/** 当前 Git 或替代命令同步执行结果。 */
	const result = spawnSync("git", args, {
		cwd,
		encoding: "utf-8",
	});
	if (result.status !== 0) {
		throw new Error(`Command failed: git ${args.join(" ")}\n${result.stderr}`);
	}
	return result.stdout.trim();
}

/** 初始化 main 分支并配置测试提交身份。参数 repoDir 为仓库目录；无返回值。例如：initGitRepo(dir)。 */
function initGitRepo(repoDir: string): void {
	git(["init", "--initial-branch=main"], repoDir);
	git(["config", "--local", "user.email", "test@test.com"], repoDir);
	git(["config", "--local", "user.name", "Test"], repoDir);
}

// Helper to create a commit with a file
// 写入文件并创建提交的辅助函数。
/** 写入文件并创建提交。参数为仓库、文件名、内容和消息；返回提交哈希。例如：createCommit(dir,"a.ts","x","init")。 */
function createCommit(repoDir: string, filename: string, content: string, message: string): string {
	writeFileSync(join(repoDir, filename), content);
	git(["add", filename], repoDir);
	git(["commit", "-m", message], repoDir);
	return git(["rev-parse", "HEAD"], repoDir);
}

// Helper to get current commit hash
// 获取当前提交哈希的辅助函数。
/** 读取仓库当前 HEAD 哈希。参数 repoDir 为仓库目录；返回字符串。例如：getCurrentCommit(dir)。 */
function getCurrentCommit(repoDir: string): string {
	return git(["rev-parse", "HEAD"], repoDir);
}

// Helper to get file content
// 读取仓库文件内容的辅助函数。
/** 读取仓库内文件文本。参数为仓库目录和文件名；返回 UTF-8 文本。例如：getFileContent(dir,"a.ts")。 */
function getFileContent(repoDir: string, filename: string): string {
	return readFileSync(join(repoDir, filename), "utf-8");
}

/** 包管理器内部 Git 来源解析结果的测试投影。 */
type GitSourceForTest = {
	/** 固定来源类别。 */
	type: "git";
	/** 原始仓库标识。 */
	repo: string;
	/** Git 主机名。 */
	host: string;
	/** 主机内仓库路径。 */
	path: string;
	/** 是否固定到明确引用。 */
	pinned: boolean;
	/** 可选分支、标签或提交引用。 */
	ref?: string;
};

/** 仅暴露路径测试需要的 DefaultPackageManager 内部方法。 */
interface PackageManagerPathInternals {
	/** 解析来源字符串并返回 GitSourceForTest。 */
	parseSource(source: string): GitSourceForTest;
	/** 计算临时作用域 Git 安装路径。 */
	getGitInstallPath(source: GitSourceForTest, scope: "temporary"): string;
}

describe("DefaultPackageManager git update", () => {
	/** 当前用例所有仓库和 agent 目录的临时根。 */
	let tempDir: string;
	/** 模拟远程来源的本地 Git 仓库目录。 */
	let remoteDir: string; // Simulates the "remote" repository
	// 上一行变量模拟远程仓库目录。
	/** 扩展全局安装使用的 agent 根目录。 */
	let agentDir: string; // The agent directory where extensions are installed
	// 上一行变量表示扩展安装使用的 agent 目录。
	/** 从模拟远程克隆出的扩展安装目录。 */
	let installedDir: string; // The installed extension directory
	// 上一行变量表示已安装扩展目录。
	/** 记录包来源的内存设置管理器。 */
	let settingsManager: SettingsManager;
	/** 被测试的默认包管理器实例。 */
	let packageManager: DefaultPackageManager;

	// Git source that maps to our installed directory structure.
	// Must use "git:" prefix so parseSource() treats it as a git source
	// (bare "github.com/..." is not recognized as a git URL).
	// 该 Git 来源映射到测试安装结构；必须使用 git: 前缀，裸 github.com 路径不会被识别为 Git URL。
	/** 映射到测试安装路径的非固定 Git 来源字符串。 */
	const gitSource = "git:github.com/test/extension";

	// 每个用例创建临时远程、agent 目录、设置和包管理器。
	beforeEach(() => {
		tempDir = join(tmpdir(), `git-update-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		mkdirSync(tempDir, { recursive: true });
		remoteDir = join(tempDir, "remote");
		agentDir = join(tempDir, "agent");

		// This matches the path structure: agentDir/git/<host>/<path>
		// 安装目录遵循 agentDir/git/<host>/<path> 结构。
		installedDir = join(agentDir, "git", "github.com", "test", "extension");

		mkdirSync(agentDir, { recursive: true });

		settingsManager = SettingsManager.inMemory();
		packageManager = new DefaultPackageManager({
			cwd: tempDir,
			agentDir,
			settingsManager,
		});
	});

	// 每个用例后递归删除临时 Git 仓库与安装目录。
	afterEach(() => {
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	/**
	 * Sets up a "remote" repository and clones it to the installed directory.
	 * This simulates what packageManager.install() would do.
	 * @param sourceOverride Optional source string to use instead of gitSource (e.g., with @ref for pinned tests)
	 */
	/** 创建模拟远程并克隆到安装目录。参数 sourceOverride 可替换默认来源；无返回值。例如：setupRemoteAndInstall()。 */
	function setupRemoteAndInstall(sourceOverride?: string): void {
		// Create "remote" repository
		// 创建模拟远程仓库。
		mkdirSync(remoteDir, { recursive: true });
		initGitRepo(remoteDir);
		createCommit(remoteDir, "extension.ts", "// v1", "Initial commit");

		// Clone to installed directory (simulating what install() does)
		// 克隆到安装目录，模拟 install() 的行为。
		mkdirSync(join(agentDir, "git", "github.com", "test"), { recursive: true });
		git(["clone", remoteDir, installedDir], tempDir);
		git(["config", "--local", "user.email", "test@test.com"], installedDir);
		git(["config", "--local", "user.name", "Test"], installedDir);

		// Add to global packages so update() processes this source
		// 加入全局包列表，让 update() 处理该来源。
		settingsManager.setPackages([sourceOverride ?? gitSource]);
	}

	describe("normal updates (no force-push)", () => {
		// 测试场景：验证“should skip reset, clean, and install when already up to date”对应的 Git 更新行为。
		it("should skip reset, clean, and install when already up to date", async () => {
			mkdirSync(remoteDir, { recursive: true });
			initGitRepo(remoteDir);
			writeFileSync(join(remoteDir, "package.json"), JSON.stringify({ name: "test-extension", version: "1.0.0" }));
			createCommit(remoteDir, "extension.ts", "// v1", "Initial commit");

			mkdirSync(join(agentDir, "git", "github.com", "test"), { recursive: true });
			git(["clone", remoteDir, installedDir], tempDir);
			settingsManager.setPackages([gitSource]);

			/** 替代命令执行器实际收到的命令文本列表。 */
			const executedCommands: string[] = [];
			/** 暴露内部命令方法以便测试替换的包管理器视图。 */
			const managerWithInternals = packageManager as unknown as {
				runCommand: (command: string, args: string[], options?: { cwd?: string }) => Promise<void>;
			};
			managerWithInternals.runCommand = async (command, args, options) => {
				executedCommands.push(`${command} ${args.join(" ")}`);
				if (command === "npm") {
					return;
				}
				/** 当前 Git 或替代命令同步执行结果。 */
				const result = spawnSync(command, args, {
					cwd: options?.cwd,
					encoding: "utf-8",
				});
				if (result.status !== 0) {
					throw new Error(`Command failed: ${command} ${args.join(" ")}\n${result.stderr}`);
				}
			};

			await packageManager.update();

			expect(executedCommands).toContain(
				"git fetch --prune --no-tags origin +refs/heads/main:refs/remotes/origin/main",
			);
			expect(executedCommands).not.toContain("git fetch --prune origin");
			expect(executedCommands).not.toContain("git reset --hard @{upstream}");
			expect(executedCommands).not.toContain("git reset --hard origin/HEAD");
			expect(executedCommands).not.toContain("git clean -fdx");
			expect(executedCommands).not.toContain("npm install");
		});

		// 测试场景：验证“should update to latest commit when remote has new commits”对应的 Git 更新行为。
		it("should update to latest commit when remote has new commits", async () => {
			setupRemoteAndInstall();
			expect(getFileContent(installedDir, "extension.ts")).toBe("// v1");

			// Add a new commit to remote
			/** 远程新增提交的哈希。 */
			const newCommit = createCommit(remoteDir, "extension.ts", "// v2", "Second commit");

			// Update via package manager (no args = uses settings)
			// 不传参数更新，表示读取设置中的来源。
			await packageManager.update();

			// Verify update succeeded
			// 核对安装目录已更新到新提交和文件内容。
			expect(getCurrentCommit(installedDir)).toBe(newCommit);
			expect(getFileContent(installedDir, "extension.ts")).toBe("// v2");
		});

		// 测试场景：验证“should handle multiple commits ahead”对应的 Git 更新行为。
		it("should handle multiple commits ahead", async () => {
			setupRemoteAndInstall();

			// Add multiple commits to remote
			// 在远程连续增加多个提交。
			createCommit(remoteDir, "extension.ts", "// v2", "Second commit");
			createCommit(remoteDir, "extension.ts", "// v3", "Third commit");
			/** 多次新增后远程最新提交哈希。 */
			const latestCommit = createCommit(remoteDir, "extension.ts", "// v4", "Fourth commit");

			await packageManager.update();

			expect(getCurrentCommit(installedDir)).toBe(latestCommit);
			expect(getFileContent(installedDir, "extension.ts")).toBe("// v4");
		});

		// 测试场景：验证“should update even when local checkout has no upstream”对应的 Git 更新行为。
		it("should update even when local checkout has no upstream", async () => {
			setupRemoteAndInstall();
			createCommit(remoteDir, "extension.ts", "// v2", "Second commit");
			/** 多次新增后远程最新提交哈希。 */
			const latestCommit = createCommit(remoteDir, "extension.ts", "// v3", "Third commit");

			/** 进入 detached HEAD 前安装仓库的当前提交。 */
			const detachedCommit = getCurrentCommit(installedDir);
			git(["checkout", detachedCommit], installedDir);

			/** 替代命令执行器实际收到的命令文本列表。 */
			const executedCommands: string[] = [];
			/** 暴露内部命令方法以便测试替换的包管理器视图。 */
			const managerWithInternals = packageManager as unknown as {
				runCommand: (command: string, args: string[], options?: { cwd?: string }) => Promise<void>;
			};
			managerWithInternals.runCommand = async (command, args, options) => {
				executedCommands.push(`${command} ${args.join(" ")}`);
				/** 当前 Git 或替代命令同步执行结果。 */
				const result = spawnSync(command, args, {
					cwd: options?.cwd,
					encoding: "utf-8",
				});
				if (result.status !== 0) {
					throw new Error(`Command failed: ${command} ${args.join(" ")}\n${result.stderr}`);
				}
			};

			await packageManager.update();

			expect(executedCommands).toContain(
				"git fetch --prune --no-tags origin +refs/heads/main:refs/remotes/origin/main",
			);
			expect(getCurrentCommit(installedDir)).toBe(latestCommit);
			expect(getFileContent(installedDir, "extension.ts")).toBe("// v3");
		});
	});

	describe("force-push scenarios", () => {
		// 测试场景：验证“should recover when remote history is rewritten”对应的 Git 更新行为。
		it("should recover when remote history is rewritten", async () => {
			setupRemoteAndInstall();
			/** 历史重写前远程的初始提交哈希。 */
			const initialCommit = getCurrentCommit(remoteDir);

			// Add commit to remote
			// 在模拟远程添加一个提交。
			createCommit(remoteDir, "extension.ts", "// v2", "Commit to keep");

			// Update to get the new commit
			// 先更新安装目录以取得该新提交。
			await packageManager.update();
			expect(getFileContent(installedDir, "extension.ts")).toBe("// v2");

			// Now force-push to rewrite history on remote
			// 随后通过硬重置模拟远程 force-push 重写历史。
			git(["reset", "--hard", initialCommit], remoteDir);
			/** force-push 场景中重建历史后的提交哈希。 */
			const rewrittenCommit = createCommit(remoteDir, "extension.ts", "// v2-rewritten", "Rewritten commit");

			// Update should succeed despite force-push
			// 即使发生 force-push，更新仍应成功。
			await packageManager.update();

			expect(getCurrentCommit(installedDir)).toBe(rewrittenCommit);
			expect(getFileContent(installedDir, "extension.ts")).toBe("// v2-rewritten");
		});

		// 测试场景：验证“should recover when local commit no longer exists in remote”对应的 Git 更新行为。
		it("should recover when local commit no longer exists in remote", async () => {
			setupRemoteAndInstall();

			// Add commits to remote
			// 在远程增加两个提交。
			createCommit(remoteDir, "extension.ts", "// v2", "Commit A");
			createCommit(remoteDir, "extension.ts", "// v3", "Commit B");

			// Update to get all commits
			// 更新安装目录以取得全部新增提交。
			await packageManager.update();
			expect(getFileContent(installedDir, "extension.ts")).toBe("// v3");

			// Force-push remote to remove commits A and B
			// 重写远程历史，移除先前的 A、B 提交。
			git(["reset", "--hard", "HEAD~2"], remoteDir);
			/** 远程新增提交的哈希。 */
			const newCommit = createCommit(remoteDir, "extension.ts", "// v2-new", "New commit replacing A and B");

			// Update should succeed - the commits we had locally no longer exist
			// 即使本地已有提交不再存在于远程，更新仍应成功。
			await packageManager.update();

			expect(getCurrentCommit(installedDir)).toBe(newCommit);
			expect(getFileContent(installedDir, "extension.ts")).toBe("// v2-new");
		});

		// 测试场景：验证“should handle complete history rewrite”对应的 Git 更新行为。
		it("should handle complete history rewrite", async () => {
			setupRemoteAndInstall();

			// Remote gets several commits
			// 模拟远程先产生多个连续提交。
			createCommit(remoteDir, "extension.ts", "// v2", "v2");
			createCommit(remoteDir, "extension.ts", "// v3", "v3");

			await packageManager.update();
			expect(getFileContent(installedDir, "extension.ts")).toBe("// v3");

			// Maintainer force-pushes completely different history
			// 模拟维护者 force-push 一段完全不同的历史。
			git(["reset", "--hard", "HEAD~2"], remoteDir);
			createCommit(remoteDir, "extension.ts", "// rewrite-a", "Rewrite A");
			/** 完整历史重写后的最终提交哈希。 */
			const finalCommit = createCommit(remoteDir, "extension.ts", "// rewrite-b", "Rewrite B");

			// Should handle this gracefully
			// 更新逻辑应平稳切换到重写后的最终提交。
			await packageManager.update();

			expect(getCurrentCommit(installedDir)).toBe(finalCommit);
			expect(getFileContent(installedDir, "extension.ts")).toBe("// rewrite-b");
		});
	});

	describe("pinned sources", () => {
		// 测试场景：验证“should not move pinned git sources past their configured ref”对应的 Git 更新行为。
		it("should not move pinned git sources past their configured ref", async () => {
			// Create remote repo first to get the initial commit
			// 先创建远程仓库并取得初始提交哈希。
			mkdirSync(remoteDir, { recursive: true });
			initGitRepo(remoteDir);
			/** 历史重写前远程的初始提交哈希。 */
			const initialCommit = createCommit(remoteDir, "extension.ts", "// v1", "Initial commit");

			// Install with pinned ref from the start - full clone to ensure commit is available
			// 从一开始就固定引用，并完整克隆以保证该提交可用。
			mkdirSync(join(agentDir, "git", "github.com", "test"), { recursive: true });
			git(["clone", remoteDir, installedDir], tempDir);
			git(["checkout", initialCommit], installedDir);
			git(["config", "--local", "user.email", "test@test.com"], installedDir);
			git(["config", "--local", "user.name", "Test"], installedDir);

			// Add to global packages with pinned ref
			// 将带固定提交的来源加入全局包设置。
			settingsManager.setPackages([`${gitSource}@${initialCommit}`]);

			// Add new commit to remote
			// 在远程添加固定引用之后的新提交。
			createCommit(remoteDir, "extension.ts", "// v2", "Second commit");

			await packageManager.update();

			// Should still be on initial commit
			// 更新后仍应停留在初始固定提交。
			expect(getCurrentCommit(installedDir)).toBe(initialCommit);
			expect(getFileContent(installedDir, "extension.ts")).toBe("// v1");
		});

		// 测试场景：验证“should checkout the configured pinned git ref during full and targeted updates”对应的 Git 更新行为。
		it("should checkout the configured pinned git ref during full and targeted updates", async () => {
			mkdirSync(remoteDir, { recursive: true });
			initGitRepo(remoteDir);
			/** v1 标签指向的提交哈希。 */
			const v1Commit = createCommit(remoteDir, "extension.ts", "// v1", "Initial commit");
			git(["tag", "v1"], remoteDir);
			/** v2 标签指向的提交哈希。 */
			const v2Commit = createCommit(remoteDir, "extension.ts", "// v2", "Second commit");
			git(["tag", "v2"], remoteDir);

			mkdirSync(join(agentDir, "git", "github.com", "test"), { recursive: true });
			git(["clone", remoteDir, installedDir], tempDir);
			git(["checkout", "v1"], installedDir);
			expect(getCurrentCommit(installedDir)).toBe(v1Commit);

			/** 固定到 v2 标签的 Git 来源字符串。 */
			const pinnedSource = `${gitSource}@v2`;
			settingsManager.setPackages([pinnedSource]);

			await packageManager.update();

			expect(getCurrentCommit(installedDir)).toBe(v2Commit);
			expect(getFileContent(installedDir, "extension.ts")).toBe("// v2");

			git(["checkout", "v1"], installedDir);

			await packageManager.update(pinnedSource);

			expect(getCurrentCommit(installedDir)).toBe(v2Commit);
			expect(getFileContent(installedDir, "extension.ts")).toBe("// v2");
		});

		// 测试场景：验证“should not reset an annotated tag checkout that already matches the configured ref”对应的 Git 更新行为。
		it("should not reset an annotated tag checkout that already matches the configured ref", async () => {
			mkdirSync(remoteDir, { recursive: true });
			initGitRepo(remoteDir);
			/** 带注释 v1 标签指向的提交哈希。 */
			const taggedCommit = createCommit(remoteDir, "extension.ts", "// v1", "Initial commit");
			git(["tag", "-a", "v1", "-m", "v1"], remoteDir);

			mkdirSync(join(agentDir, "git", "github.com", "test"), { recursive: true });
			git(["clone", remoteDir, installedDir], tempDir);
			git(["checkout", "v1"], installedDir);
			expect(getCurrentCommit(installedDir)).toBe(taggedCommit);

			settingsManager.setPackages([`${gitSource}@v1`]);

			/** 替代命令执行器实际收到的命令文本列表。 */
			const executedCommands: string[] = [];
			/** 暴露内部命令方法以便测试替换的包管理器视图。 */
			const managerWithInternals = packageManager as unknown as {
				runCommand: (command: string, args: string[], options?: { cwd?: string }) => Promise<void>;
			};
			managerWithInternals.runCommand = async (command, args, options) => {
				executedCommands.push(`${command} ${args.join(" ")}`);
				/** 当前 Git 或替代命令同步执行结果。 */
				const result = spawnSync(command, args, {
					cwd: options?.cwd,
					encoding: "utf-8",
				});
				if (result.status !== 0) {
					throw new Error(`Command failed: ${command} ${args.join(" ")}\n${result.stderr}`);
				}
			};

			await packageManager.update();

			expect(executedCommands).toContain("git fetch origin v1");
			expect(executedCommands.some((command) => command.startsWith("git reset --hard"))).toBe(false);
			expect(executedCommands).not.toContain("git clean -fdx");
			expect(getCurrentCommit(installedDir)).toBe(taggedCommit);
		});
	});

	describe("temporary git sources", () => {
		// 测试场景：验证“should refresh cached temporary git sources when resolving”对应的 Git 更新行为。
		it("should refresh cached temporary git sources when resolving", async () => {
			/** 暴露 Git 路径解析内部方法的包管理器视图。 */
			const managerWithPaths = packageManager as unknown as PackageManagerPathInternals;
			/** 临时 Git 来源的缓存安装目录。 */
			const cachedDir = managerWithPaths.getGitInstallPath(managerWithPaths.parseSource(gitSource), "temporary");
			/** 缓存目录中的测试扩展文件路径。 */
			const extensionFile = join(cachedDir, "pi-extensions", "session-breakdown.ts");

			rmSync(cachedDir, { recursive: true, force: true });
			mkdirSync(join(cachedDir, "pi-extensions"), { recursive: true });
			writeFileSync(
				join(cachedDir, "package.json"),
				JSON.stringify({ pi: { extensions: ["./pi-extensions"] } }, null, 2),
			);
			writeFileSync(extensionFile, "// stale");

			/** 替代命令执行器实际收到的命令文本列表。 */
			const executedCommands: string[] = [];
			/** 暴露内部命令方法以便测试替换的包管理器视图。 */
			const managerWithInternals = packageManager as unknown as {
				runCommand: (command: string, args: string[], options?: { cwd?: string }) => Promise<void>;
				runCommandCapture: (command: string, args: string[], options?: { cwd?: string }) => Promise<string>;
			};
			managerWithInternals.runCommand = async (command, args) => {
				executedCommands.push(`${command} ${args.join(" ")}`);
				if (command === "git" && args[0] === "reset") {
					writeFileSync(extensionFile, "// fresh");
				}
			};
			managerWithInternals.runCommandCapture = async (_command, args) => {
				if (args[0] === "rev-parse" && args[1] === "HEAD") {
					return "local-head";
				}
				if (args[0] === "rev-parse" && args[1] === "@{upstream}") {
					return "remote-head";
				}
				if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") {
					return "origin/main";
				}
				return "";
			};

			await packageManager.resolveExtensionSources([gitSource], { temporary: true });

			expect(executedCommands).toContain(
				"git fetch --prune --no-tags origin +refs/heads/main:refs/remotes/origin/main",
			);
			expect(getFileContent(cachedDir, "pi-extensions/session-breakdown.ts")).toBe("// fresh");
		});

		// 测试场景：验证“should not refresh pinned temporary git sources”对应的 Git 更新行为。
		it("should not refresh pinned temporary git sources", async () => {
			/** 暴露 Git 路径解析内部方法的包管理器视图。 */
			const managerWithPaths = packageManager as unknown as PackageManagerPathInternals;
			/** 临时 Git 来源的缓存安装目录。 */
			const cachedDir = managerWithPaths.getGitInstallPath(managerWithPaths.parseSource(gitSource), "temporary");
			/** 缓存目录中的测试扩展文件路径。 */
			const extensionFile = join(cachedDir, "pi-extensions", "session-breakdown.ts");

			rmSync(cachedDir, { recursive: true, force: true });
			mkdirSync(join(cachedDir, "pi-extensions"), { recursive: true });
			writeFileSync(
				join(cachedDir, "package.json"),
				JSON.stringify({ pi: { extensions: ["./pi-extensions"] } }, null, 2),
			);
			writeFileSync(extensionFile, "// pinned");

			/** 替代命令执行器实际收到的命令文本列表。 */
			const executedCommands: string[] = [];
			/** 暴露内部命令方法以便测试替换的包管理器视图。 */
			const managerWithInternals = packageManager as unknown as {
				runCommand: (command: string, args: string[], options?: { cwd?: string }) => Promise<void>;
			};
			managerWithInternals.runCommand = async (command, args) => {
				executedCommands.push(`${command} ${args.join(" ")}`);
			};

			await packageManager.resolveExtensionSources([`${gitSource}@main`], { temporary: true });

			expect(executedCommands).toEqual([]);
			expect(getFileContent(cachedDir, "pi-extensions/session-breakdown.ts")).toBe("// pinned");
		});
	});

	describe("scope-aware update", () => {
		// 测试场景：验证“should not install locally when source is only registered globally”对应的 Git 更新行为。
		it("should not install locally when source is only registered globally", async () => {
			setupRemoteAndInstall();

			// Add a new commit to remote
			// 在全局来源远程添加新提交。
			createCommit(remoteDir, "extension.ts", "// v2", "Second commit");

			// The project-scope install path should not exist before or after update
			/** 项目作用域下不应被创建的 Git 安装目录。 */
			const projectGitDir = join(tempDir, ".pi", "git", "github.com", "test", "extension");
			expect(existsSync(projectGitDir)).toBe(false);

			await packageManager.update(gitSource);

			// Global install should be updated
			// 全局安装目录应成功更新。
			expect(getFileContent(installedDir, "extension.ts")).toBe("// v2");

			// Project-scope directory should NOT have been created
			// 不应额外创建项目作用域安装目录。
			expect(existsSync(projectGitDir)).toBe(false);
		});
	});
});
