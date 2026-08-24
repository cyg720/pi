#!/usr/bin/env node

/**
 * 文件职责：作为提交前检查，阻止未经确认的 package-lock.json 依赖变更进入提交。
 * 技术维度：使用 Node 子进程调用 Git，对比 HEAD 与暂存区 JSON，并按锁文件 package 路径分类。
 * 产品维度：降低依赖投毒、意外升级和发布锁文件漂移风险，同时放行纯工作区版本元数据更新。
 * 逻辑维度：读取许可开关与暂存文件，计算锁文件差异，判断工作区特例，打印摘要和处理指引。
 * 关键边界：只检查已暂存的根 package-lock.json；显式环境变量会绕过阻止但不会省略人工审查责任。
 * 新手阅读建议：从文件末尾主流程逆向阅读，再查看差异提取、分类和摘要三个帮助函数。
 */
import { execFileSync } from "node:child_process";

// 用户显式设置的锁文件变更许可原始值；未设置时为 undefined。
const allowValue = process.env.PI_ALLOW_LOCKFILE_CHANGE;
// 归一化后的许可布尔值，仅接受 1、true 或 yes。
const allowed = allowValue === "1" || allowValue === "true" || allowValue === "yes";

/** 功能：同步执行 Git 并返回文本；参数 args 为 Git 参数数组；返回：UTF-8 stdout。示例：git(["status", "--short"])。 */
function git(args) {
	return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/** 功能：从 Git 对象表达式读取 JSON；参数 ref 为 show 引用；返回：解析对象或 undefined。示例：readJsonFromGit("HEAD:package-lock.json")。 */
function readJsonFromGit(ref) {
	try {
		return JSON.parse(git(["show", ref]));
	} catch {
		return undefined;
	}
}

/** 功能：从锁文件 packages 路径推导包名；参数 lockPath；返回：普通或作用域包名。示例：packageNameFromLockPath("node_modules/a")。 */
function packageNameFromLockPath(lockPath) {
	// node_modules 路径分隔标记，用最后一次出现位置定位真实包段。
	const marker = "node_modules/";
	// 标记在锁文件路径中的最后索引；-1 表示工作区或根条目。
	const index = lockPath.lastIndexOf(marker);
	if (index === -1) return lockPath || "<root>";
	// node_modules 后的路径片段；作用域包需要前两段组成名称。
	const parts = lockPath.slice(index + marker.length).split("/");
	return parts[0]?.startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
}

/** 功能：生成便于审查的包标签；参数 lockPath、entry；返回：name 或 name@version。示例：packageLabel(path, entry)。 */
function packageLabel(lockPath, entry) {
	// 优先使用锁文件条目显式名称，否则从路径推导。
	const name = entry?.name ?? packageNameFromLockPath(lockPath);
	return entry?.version ? `${name}@${entry.version}` : name;
}

/** 功能：比较 HEAD 与暂存区锁文件 packages；参数：无；返回：变化数组或无法读取时的 undefined。示例：getLockfilePackageChanges()。 */
function getLockfilePackageChanges() {
	// 提交前版本的根锁文件对象。
	const before = readJsonFromGit("HEAD:package-lock.json");
	// Git 暂存区中的根锁文件对象。
	const after = readJsonFromGit(":package-lock.json");
	if (!before?.packages || !after?.packages) return undefined;

	// 包条目差异结果，每项保存路径及前后值。
	const changes = [];
	// 前后版本所有 packages 键的并集，确保新增和删除都被比较。
	const paths = new Set([...Object.keys(before.packages), ...Object.keys(after.packages)]);
	for (const lockPath of [...paths].sort()) {
		// 旧锁文件中的当前条目；新增包时为 undefined。
		const oldEntry = before.packages[lockPath];
		// 暂存锁文件中的当前条目；删除包时为 undefined。
		const newEntry = after.packages[lockPath];
		if (JSON.stringify(oldEntry) !== JSON.stringify(newEntry)) {
			changes.push({ lockPath, oldEntry, newEntry });
		}
	}
	return changes;
}

/** 功能：判断锁文件路径是否属于仓库工作区包；参数 lockPath；返回：布尔值。示例：isWorkspacePackagePath("packages/ai")。 */
function isWorkspacePackagePath(lockPath) {
	return lockPath.startsWith("packages/");
}

/** 功能：判断变化是否非空且全部为工作区元数据；参数 changes；返回：布尔值。示例：hasOnlyWorkspacePackageChanges(changes)。 */
function hasOnlyWorkspacePackageChanges(changes) {
	return changes.length > 0 && changes.every((change) => isWorkspacePackagePath(change.lockPath));
}

/** 功能：汇总 node_modules 包级变化；参数 changes；返回：可打印短句数组。示例：summarizeLockfileChange(changes)。 */
function summarizeLockfileChange(changes) {
	// 过滤掉工作区和根元数据后剩余的外部依赖变化。
	const nodeModuleChanges = changes.filter((change) => change.lockPath.includes("node_modules/"));
	// 面向人工审查的变化摘要数组。
	const summary = [];
	for (const { lockPath, oldEntry, newEntry } of nodeModuleChanges) {
		// 当前外部依赖条目的路径及变更前后值，用于分类新增、删除、升级或元数据变化。
		if (!oldEntry && newEntry) {
			summary.push(`added ${packageLabel(lockPath, newEntry)}`);
		} else if (oldEntry && !newEntry) {
			summary.push(`removed ${packageLabel(lockPath, oldEntry)}`);
		} else if (oldEntry?.version !== newEntry?.version) {
			summary.push(
				`changed ${packageNameFromLockPath(lockPath)} ${oldEntry?.version ?? "<none>"} -> ${newEntry?.version ?? "<none>"}`,
			);
		} else {
			summary.push(`changed ${packageLabel(lockPath, newEntry)}`);
		}
	}
	return summary;
}

// 当前暂存区文件路径列表；空行被剔除。
const stagedFiles = git(["diff", "--cached", "--name-only"])
	.split("\n")
	.map((line) => line.trim())
	.filter(Boolean);

if (!stagedFiles.includes("package-lock.json")) {
	process.exit(0);
}

if (allowed) {
	console.error("package-lock.json is staged; PI_ALLOW_LOCKFILE_CHANGE is set, allowing commit.");
	process.exit(0);
}

// 根锁文件的包条目变化；读取失败时为 undefined 并采用保守阻止策略。
const changes = getLockfilePackageChanges();
if (changes && hasOnlyWorkspacePackageChanges(changes)) {
	console.error("package-lock.json only updates workspace package metadata; allowing commit.");
	process.exit(0);
}

console.error("package-lock.json is staged.");
console.error("");
console.error("Review lockfile changes before committing:");
console.error("  - confirm every new/updated package is intentional");
console.error("  - confirm npm age gates were active for resolution");
console.error("  - review any new lifecycle scripts in the dependency tree");
console.error("  - regenerate/check coding-agent shrinkwrap if release deps changed");

// 最多展示前 40 条的外部依赖版本摘要。
const summary = changes ? summarizeLockfileChange(changes) : [];
if (summary.length > 0) {
	console.error("");
	console.error("Detected package version changes:");
	for (const change of summary.slice(0, 40)) {
		// change 是单条已格式化依赖变化说明。
		console.error(`  - ${change}`);
	}
	if (summary.length > 40) {
		console.error(`  ... ${summary.length - 40} more`);
	}
}

console.error("");
console.error("If this lockfile change is intentional, commit with:");
console.error("  PI_ALLOW_LOCKFILE_CHANGE=1 git commit ...");
process.exit(1);
