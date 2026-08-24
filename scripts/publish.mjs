#!/usr/bin/env node

/**
 * 文件职责：校验并按固定顺序发布全部 pi npm 包，支持幂等跳过已发布版本和只校验的 dry-run。
 * 技术维度：使用 Node 子进程调用 npm pack/view/publish，读取各 package.json 并检查 dist 构建产物。
 * 产品维度：减少手工发布遗漏、版本不一致和重复发布错误，确保上传包内容在发布前可审查。
 * 逻辑维度：解析参数，验证包名和锁步版本，检查发布状态与打包内容，最后逐个发布未存在版本。
 * 关键边界：真实模式会对 npm 产生不可逆发布操作；必须先构建，且所有包版本必须完全一致。
 * 新手阅读建议：先看 packages 清单和末尾主流程，再阅读 run、validatePack、isPublished 三个外部操作函数。
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// 按发布依赖顺序列出的工作区目录与预期 npm 包名。
const packages = [
	{ directory: "packages/ai", name: "@earendil-works/pi-ai" },
	{ directory: "packages/agent", name: "@earendil-works/pi-agent-core" },
	{ directory: "packages/storage/sqlite-node", name: "@earendil-works/pi-storage-sqlite-node" },
	{ directory: "packages/tui", name: "@earendil-works/pi-tui" },
	{ directory: "packages/coding-agent", name: "@earendil-works/pi-coding-agent" },
];

// 是否只执行校验和 npm pack，不实际发布。
const dryRun = process.argv.includes("--dry-run");
// 除 --dry-run 之外的未知参数；非空时打印用法并退出。
const unknownArgs = process.argv.slice(2).filter((arg) => arg !== "--dry-run");

if (unknownArgs.length > 0) {
	console.error(`Usage: node scripts/publish.mjs [--dry-run]`);
	process.exit(1);
}

/** 功能：取得当前平台可执行命令名；参数 command；返回：Windows 带 .cmd 的名称。示例：commandForPlatform("npm")。 */
function commandForPlatform(command) {
	return process.platform === "win32" ? `${command}.cmd` : command;
}

/** 功能：同步运行并检查外部命令；参数 command、args、options；返回：spawnSync 结果。示例：run("npm", ["pack"], { cwd })。 */
function run(command, args, options = {}) {
	console.log(`$ ${[command, ...args].join(" ")}`);
	// 外部命令执行结果；capture 模式把 stdout/stderr 保存为字符串。
	const result = spawnSync(commandForPlatform(command), args, {
		cwd: options.cwd,
		encoding: "utf8",
		stdio: options.capture ? ["inherit", "pipe", "pipe"] : "inherit",
	});

	if (result.status !== 0) {
		// 失败时合并的标准输出和错误，便于抛出完整诊断。
		const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
		throw new Error(output ? `Command failed: ${command} ${args.join(" ")}\n${output}` : `Command failed: ${command} ${args.join(" ")}`);
	}

	return result;
}

/** 功能：读取工作区 package.json；参数 directory；返回：解析后的对象。示例：readPackageJson("packages/ai")。 */
function readPackageJson(directory) {
	return JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
}

/** 功能：确认包目录已有 dist；参数 directory；返回：无，缺失时抛错。示例：assertBuildOutputExists(pkg.directory)。 */
function assertBuildOutputExists(directory) {
	if (!existsSync(join(directory, "dist"))) {
		throw new Error(`${directory}/dist does not exist. Run npm run build before publishing.`);
	}
}

/** 功能：执行 npm pack dry-run 并打印包大小；参数 directory；返回：无。示例：validatePack("packages/ai")。 */
function validatePack(directory) {
	// npm pack --json 的捕获结果。
	const result = run("npm", ["pack", "--dry-run", "--ignore-scripts", "--json"], { capture: true, cwd: directory });
	// npm 返回数组中的首个打包摘要对象。
	const packed = JSON.parse(result.stdout)[0];
	console.log(`  ${packed.filename}: ${packed.files.length} files, ${packed.size} bytes packed, ${packed.unpackedSize} bytes unpacked`);
}

/** 功能：查询指定 npm 版本是否已发布；参数 name、version；返回：布尔值。示例：isPublished(pkg.name, pkg.version)。 */
function isPublished(name, version) {
	// npm view 查询结果；404 表示版本尚不存在，其他失败继续抛出。
	const result = spawnSync(commandForPlatform("npm"), ["view", `${name}@${version}`, "version", "--json"], {
		encoding: "utf8",
		stdio: ["inherit", "pipe", "pipe"],
	});

	if (result.status === 0 && result.stdout.trim()) {
		return true;
	}

	// 查询失败时的合并输出，用于区分 404 与真实故障。
	const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
	if (result.status !== 0 && (output.includes("E404") || output.includes("404 Not Found"))) {
		return false;
	}

	throw new Error(output ? `Failed to query ${name}@${version}\n${output}` : `Failed to query ${name}@${version}`);
}

// 通过包名索引的本地版本映射，用于锁步版本检查和发布状态构造。
const packageVersions = new Map();
for (const pkg of packages) {
	// 当前工作区包的 package.json 内容。
	const packageJson = readPackageJson(pkg.directory);
	if (packageJson.name !== pkg.name) {
		throw new Error(`${pkg.directory}/package.json has name ${packageJson.name}, expected ${pkg.name}`);
	}
	packageVersions.set(pkg.name, packageJson.version);
}

// 去重后的发布版本列表；锁步发布要求长度严格为 1。
const versions = [...new Set(packageVersions.values())];
if (versions.length !== 1) {
	throw new Error(`Publish packages are not lockstep versioned: ${versions.join(", ")}`);
}

console.log(`Publishing pi packages at ${versions[0]}${dryRun ? " (dry run)" : ""}\n`);

// 每个包的发布计划状态，初始一律标记为未发布。
const packageStates = packages.map((pkg) => ({
	...pkg,
	published: false,
	version: packageVersions.get(pkg.name),
}));

for (const pkg of packageStates) {
	// pkg 是当前校验包状态；循环会补充 published 并执行 npm pack 审查。
	assertBuildOutputExists(pkg.directory);
	pkg.published = isPublished(pkg.name, pkg.version);

	if (pkg.published) {
		console.log(`${pkg.name}@${pkg.version} is already published; validating package contents only.`);
	} else {
		console.log(`${pkg.name}@${pkg.version} is not published; validating package contents before publish.`);
	}
	validatePack(pkg.directory);
	console.log();
}

if (dryRun) {
	process.exit(0);
}

console.log("All packages validated; starting publication.\n");

for (const pkg of packageStates) {
	// pkg 是当前待发布包状态；已发布版本会幂等跳过。
	if (pkg.published) {
		console.log(`Skipping ${pkg.name}@${pkg.version}: already published\n`);
		continue;
	}

	run("npm", ["publish", "--access", "public", "--provenance", "--ignore-scripts"], { cwd: pkg.directory });
	console.log();
}
