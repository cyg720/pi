#!/usr/bin/env node
/**
 * Release script for pi-mono
 *
 * Usage:
 *   node scripts/release.mjs <major|minor|patch>
 *   node scripts/release.mjs <x.y.z>
 *
 * Steps:
 * 1. Check for uncommitted changes
 * 2. Bump version via npm run version:xxx or set an explicit version
 * 3. Update CHANGELOG.md files: [Unreleased] -> [version] - date
 * 4. Regenerate release artifacts
 * 5. Run checks and tests
 * 6. Commit and tag the release
 * 7. Add new [Unreleased] section to changelogs
 * 8. Commit next-cycle changelog updates
 * 9. Push main and the tag to trigger CI publishing
 */
/**
 * 文件职责：自动执行 pi-mono 的版本升级、变更日志归档、产物再生成、校验、提交、打标签和推送。
 * 技术维度：使用 Node.js ESM、子进程、文件系统和 Git/npm 命令串联完整发布流程。
 * 产品维度：把多包锁步版本发布固化为可审计步骤，降低漏改版本、漏跑检查或漏推标签的风险。
 * 逻辑维度：校验发布目标，清理锁文件旧条目，更新版本与日志，运行检查，生成两次提交并推送。
 * 关键边界：脚本会修改文件、提交并推送远端，只应在干净 main 分支和发布准备全部完成后运行。
 * 新手阅读建议：先阅读底部 1–9 步主流程，再回看 run、版本处理和 changelog 辅助函数的实现。
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { findPackageDirectories } from "./package-workspaces.mjs";

/** 命令行传入的升级类型或显式语义化版本号。 */
const RELEASE_TARGET = process.argv[2];
/** 允许 npm 自动递增的版本级别集合。 */
const BUMP_TYPES = new Set(["major", "minor", "patch"]);
/** 接受不带前缀和预发布段的 x.y.z 版本格式。 */
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

if (!RELEASE_TARGET || (!BUMP_TYPES.has(RELEASE_TARGET) && !SEMVER_RE.test(RELEASE_TARGET))) {
	console.error("Usage: node scripts/release.mjs <major|minor|patch|x.y.z>");
	process.exit(1);
}

/**
 * 同步执行一条外部命令，失败时按选项决定退出或返回空值。
 * @param {string} cmd 要交给系统 shell 的完整命令。
 * @param {{silent?: boolean, ignoreError?: boolean}} options silent 捕获输出，ignoreError 允许失败。
 * @returns {string|null} 捕获的标准输出，继承输出时通常为空，允许失败时可能为 null。
 * @example run("git status --porcelain", { silent: true });
 */
function run(cmd, options = {}) {
	console.log(`$ ${cmd}`);
	try {
		return execSync(cmd, { encoding: "utf-8", stdio: options.silent ? "pipe" : "inherit", ...options });
	} catch (e) {
		/** e 是子进程抛出的原始异常；这里只依据 ignoreError 决定是否终止。 */
		if (!options.ignoreError) {
			console.error(`Command failed: ${cmd}`);
			process.exit(1);
		}
		return null;
	}
}

/**
 * 读取锁步包当前版本。
 * @returns {string} packages/ai/package.json 中的版本号。
 * @example const version = getVersion();
 */
function getVersion() {
	/** AI 包清单对象，作为所有工作区包共享版本的来源。 */
	const pkg = JSON.parse(readFileSync("packages/ai/package.json", "utf-8"));
	return pkg.version;
}

/**
 * 比较两个 x.y.z 版本。
 * @param {string} a 左侧版本。
 * @param {string} b 右侧版本。
 * @returns {number} 正数表示 a 较新，负数表示 b 较新，0 表示相等。
 * @example compareVersions("1.2.0", "1.1.9");
 */
function compareVersions(a, b) {
	/** 左侧版本拆分后的三个数字段。 */
	const aParts = a.split(".").map(Number);
	/** 右侧版本拆分后的三个数字段。 */
	const bParts = b.split(".").map(Number);

	for (let i = 0; i < 3; i++) {
		/** 当前主、次或补丁位的差值，缺失位按 0 处理。 */
		const diff = (aParts[i] || 0) - (bParts[i] || 0);
		if (diff !== 0) {
			return diff;
		}
	}

	return 0;
}

/**
 * 把路径安全包裹为 POSIX shell 单引号参数。
 * @param {string} value 原始参数文本。
 * @returns {string} 可拼入 git add 命令的转义文本。
 * @example shellQuote("a'b.txt");
 */
function shellQuote(value) {
	return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * 删除根锁文件中版本落后的工作区包实体条目。
 * @returns {void} 仅在发现旧条目时重写 package-lock.json。
 * @example removeStaleWorkspaceLockEntries();
 */
function removeStaleWorkspaceLockEntries() {
	/** 所有非私有工作区包名到当前版本的映射。 */
	const workspaceVersions = new Map(
		findPackageDirectories()
			.map((directory) => JSON.parse(readFileSync(join(directory, "package.json"), "utf8")))
			.filter((pkg) => pkg.private !== true)
			.map((pkg) => [pkg.name, pkg.version]),
	);
	/** 根 npm 锁文件路径。 */
	const lockPath = "package-lock.json";
	/** 解析后的锁文件对象；packages 字段会按需删除旧实体。 */
	const lock = JSON.parse(readFileSync(lockPath, "utf8"));
	/** 已删除的旧工作区包条目数。 */
	let removed = 0;

	// path 和 pkg 是 lockfile 中当前包路径及其元数据。
	for (const [path, pkg] of Object.entries(lock.packages)) {
		if (!path.startsWith("packages/") || pkg.link === true) {
			continue;
		}
		// name 和 version 是当前工作区包名及发布目标版本。
		for (const [name, version] of workspaceVersions) {
			if (path.endsWith(`/node_modules/${name}`) && pkg.version !== version) {
				delete lock.packages[path];
				removed++;
				break;
			}
		}
	}

	if (removed > 0) {
		writeFileSync(lockPath, `${JSON.stringify(lock, null, "\t")}\n`);
		console.log(`Removed ${removed} stale workspace package lock ${removed === 1 ? "entry" : "entries"}.`);
	}
}

/**
 * 显式暂存当前已修改、新增或删除的文件。
 * @returns {void} 工作区无变化时直接返回。
 * @example stageChangedFiles();
 */
function stageChangedFiles() {
	/** git 返回的逐行变更路径文本。 */
	const output = run("git ls-files -m -o -d --exclude-standard", { silent: true });
	/** 去空、去重后的待暂存路径。 */
	const paths = [...new Set((output || "").split("\n").map((line) => line.trim()).filter(Boolean))];
	if (paths.length === 0) {
		return;
	}

	run(`git add -- ${paths.map(shellQuote).join(" ")}`);
}

/**
 * 按递增类型或显式目标版本更新全部工作区版本并刷新依赖锁定。
 * @param {string} target major/minor/patch 或更大的 x.y.z 版本。
 * @returns {string} 更新完成后的实际版本。
 * @example bumpOrSetVersion("patch");
 */
function bumpOrSetVersion(target) {
	/** 升级前的锁步版本，用于验证显式版本必须递增。 */
	const currentVersion = getVersion();

	if (BUMP_TYPES.has(target)) {
		console.log(`Bumping version (${target})...`);
		run(`npm run version:${target}`);
	} else {
		if (compareVersions(target, currentVersion) <= 0) {
			console.error(`Error: explicit version ${target} must be greater than current version ${currentVersion}.`);
			process.exit(1);
		}

		console.log(`Setting explicit version (${target})...`);
		run(`npm version ${target} -ws --no-git-tag-version && node scripts/sync-versions.js && npm install --package-lock-only --ignore-scripts`);
	}

	// npm version can temporarily install the previous workspace versions before
	// sync-versions updates inter-package ranges. Remove those stale lock entries,
	// refresh the lockfile, then hydrate from the final dependency graph.
	// npm version 可能短暂写入旧工作区版本；同步内部依赖后需清理旧条目、刷新锁文件并按最终依赖图安装。
	removeStaleWorkspaceLockEntries();
	run("npm install --package-lock-only --ignore-scripts");
	run("npm ci --ignore-scripts");
	return getVersion();
}

/**
 * 列出所有实际存在的工作区变更日志。
 * @returns {string[]} CHANGELOG.md 路径数组。
 * @example const changelogs = getChangelogs();
 */
function getChangelogs() {
	return findPackageDirectories()
		.map((directory) => join(directory, "CHANGELOG.md"))
		.filter((path) => existsSync(path));
}

/**
 * 将每个变更日志的 Unreleased 标题归档为本次版本和日期。
 * @param {string} version 本次发布版本。
 * @returns {void} 直接更新存在 Unreleased 段的文件。
 * @example updateChangelogsForRelease("1.2.3");
 */
function updateChangelogsForRelease(version) {
	/** UTC 日期字符串，格式为 YYYY-MM-DD。 */
	const date = new Date().toISOString().split("T")[0];
	/** 需要检查和更新的变更日志路径。 */
	const changelogs = getChangelogs();

	for (const changelog of changelogs) {
		/** 当前变更日志的完整文本。 */
		const content = readFileSync(changelog, "utf-8");

		if (!content.includes("## [Unreleased]")) {
			console.log(`  Skipping ${changelog}: no [Unreleased] section`);
			continue;
		}

		/** 把首个 Unreleased 标题替换成本次正式版本后的文本。 */
		const updated = content.replace(
			"## [Unreleased]",
			`## [${version}] - ${date}`
		);
		writeFileSync(changelog, updated);
		console.log(`  Updated ${changelog}`);
	}
}

/**
 * 在每个变更日志标题后插入新的 Unreleased 段。
 * @returns {void} 直接重写各 CHANGELOG.md。
 * @example addUnreleasedSection();
 */
function addUnreleasedSection() {
	/** 所有需要开启下一开发周期的变更日志。 */
	const changelogs = getChangelogs();
	/** 新周期统一使用的空 Unreleased 标题文本。 */
	const unreleasedSection = "## [Unreleased]\n\n";

	for (const changelog of changelogs) {
		/** 当前变更日志的完整文本。 */
		const content = readFileSync(changelog, "utf-8");

		// Insert after "# Changelog\n\n"
		// 插入在一级 Changelog 标题之后，确保新周期位于所有已发布版本之前。
		/** 插入下一周期标题后的新文本。 */
		const updated = content.replace(
			/^(# Changelog\n\n)/,
			`$1${unreleasedSection}`
		);
		writeFileSync(changelog, updated);
		console.log(`  Added [Unreleased] to ${changelog}`);
	}
}

// Main flow
// 主流程：以下步骤按发布顺序执行，任一步失败都会终止脚本。
console.log("\n=== Release Script ===\n");

// 1. Check for uncommitted changes
// 1. 检查未提交变更，避免把无关工作带入发布提交。
console.log("Checking for uncommitted changes...");
/** git 工作区状态；非空表示发布前置条件不满足。 */
const status = run("git status --porcelain", { silent: true });
if (status && status.trim()) {
	console.error("Error: Uncommitted changes detected. Commit or stash first.");
	console.error(status);
	process.exit(1);
}
console.log("  Working directory clean\n");

// 2. Bump or set version
// 2. 递增或设置版本，并取得最终锁步版本号。
/** 本次发布的最终版本号，后续用于日志、提交和标签。 */
const version = bumpOrSetVersion(RELEASE_TARGET);
console.log(`  New version: ${version}\n`);

// 3. Update changelogs
// 3. 将各包 Unreleased 内容归档到本次版本。
console.log("Updating CHANGELOG.md files...");
updateChangelogsForRelease(version);
console.log();

// 4. Regenerate release artifacts
// 4. 重新生成模型数据、检查模型元数据并更新 coding-agent 发布锁定文件。
console.log("Regenerating release artifacts...");
run("npm run generate:models");
run("npm run check:model-data");
run("npm run shrinkwrap:coding-agent");
run("npm run install-lock:coding-agent");
console.log();

// 5. Run checks and tests
// 5. 执行静态检查、离线构建和非端到端测试，失败则阻止发布。
console.log("Running checks...");
run("npm run check");
console.log();

console.log("Building packages for tests...");
run("npm run build:offline");
console.log();

console.log("Running tests...");
run("./test.sh");
console.log();

// 6. Commit and tag
// 6. 暂存发布产生的文件，创建版本提交和对应 Git 标签。
console.log("Committing and tagging...");
stageChangedFiles();
run(`git commit -m "Release v${version}"`);
run(`git tag v${version}`);
console.log();

// 7. Add new [Unreleased] sections
// 7. 为下一开发周期补回空的 Unreleased 段。
console.log("Adding [Unreleased] sections for next cycle...");
addUnreleasedSection();
console.log();

// 8. Commit
// 8. 单独提交下一周期的变更日志标题，保持发布提交边界清楚。
console.log("Committing changelog updates...");
stageChangedFiles();
run(`git commit -m "Add [Unreleased] section for next cycle"`);
console.log();

// 9. Push
// 9. 推送 main 与版本标签，由标签触发 CI 发布。
console.log("Pushing to remote...");
run("git push origin main");
run(`git push origin v${version}`);
console.log();

console.log(`=== Prepared release v${version}; CI publishing starts after the tag push ===`);
