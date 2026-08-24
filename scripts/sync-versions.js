#!/usr/bin/env node

/**
 * Validates lockstep versions for published packages, then synchronizes
 * internal dependency versions in all workspace packages, including private ones.
 */
/**
 * 文件职责：校验已发布工作区包版本锁步，并同步所有包的内部依赖版本范围。
 * 技术维度：使用 Node 文件系统、工作区目录发现、Map/Set 和 JSON 清单原地改写。
 * 产品维度：保证锁步发布一致性，并避免私有工具包引用过期的内部包版本。
 * 逻辑维度：读取清单并排除生成目录，校验公开包版本，再遍历依赖更新并写回。
 * 关键边界：会改写 package.json；生成的 install-lock 清单被跳过，别名仅处理 npm: 格式。
 * 新手阅读建议：先看 synchronizedDependencyVersion，再看版本校验和双层依赖遍历。
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { findPackageDirectories } from "./package-workspaces.mjs";

// GENERATED_PACKAGE_SUFFIXES 列出不得由本脚本改写的生成清单目录后缀。
const GENERATED_PACKAGE_SUFFIXES = [join("coding-agent", "install-lock")];

/**
 * 计算内部依赖应使用的新版本说明符。
 * 参数：dependencyName 为依赖名，currentSpecifier 为当前范围，versionMap 为工作区版本表。
 * 返回值：新的直接或 npm 别名范围；非内部依赖返回 null。
 * 使用示例：`synchronizedDependencyVersion(name, range, versionMap)`。
 */
function synchronizedDependencyVersion(dependencyName, currentSpecifier, versionMap) {
	// directVersion 是同名工作区包的可选版本。
	const directVersion = versionMap.get(dependencyName);
	if (directVersion) {
		return `^${directVersion}`;
	}
	if (typeof currentSpecifier !== "string" || !currentSpecifier.startsWith("npm:")) {
		return null;
	}

	// separator 是 npm 别名中包名与版本之间最后一个 @ 的位置。
	const separator = currentSpecifier.lastIndexOf("@");
	// aliasPackage 是 npm: 前缀后引用的真实包名。
	const aliasPackage = currentSpecifier.slice("npm:".length, separator);
	// aliasVersion 是别名目标工作区包的可选版本。
	const aliasVersion = versionMap.get(aliasPackage);
	return aliasVersion ? `npm:${aliasPackage}@${aliasVersion}` : null;
}

// packageRoot 是命令行指定或默认的工作区包根目录。
const packageRoot = process.argv[2] ?? "packages";
// workspacePackages 是排除生成清单后解析得到的全部包数据与路径。
const workspacePackages = findPackageDirectories(packageRoot)
	// directory 是候选包目录，过滤掉生成目录。
	.filter((directory) => !GENERATED_PACKAGE_SUFFIXES.some((suffix) => directory.endsWith(suffix)))
	// directory 是保留包目录，回调读取 package.json。
	.map((directory) => {
		// path 是当前包清单路径。
		const path = join(directory, "package.json");
		return { data: JSON.parse(readFileSync(path, "utf8")), path };
	});
// publishedPackages 是所有非 private 的已发布包。
const publishedPackages = workspacePackages.filter((pkg) => pkg.data.private !== true);
// versionMap 把每个工作区包名映射到当前版本。
const versionMap = new Map(workspacePackages.map((pkg) => [pkg.data.name, pkg.data.version]));

console.log("Current versions:");
// pkg 是按包名排序后的当前公开包，用于稳定输出版本列表。
for (const pkg of [...publishedPackages].sort((a, b) => a.data.name.localeCompare(b.data.name))) {
	console.log(`  ${pkg.data.name}: ${pkg.data.version}`);
}

// versions 收集公开包的唯一版本，用于锁步校验。
const versions = new Set(publishedPackages.map((pkg) => pkg.data.version));
if (versions.size > 1) {
	console.error("\nERROR: Not all non-private packages have the same version.");
	console.error("Expected lockstep versioning. Run one of:");
	console.error("  npm run version:patch");
	console.error("  npm run version:minor");
	console.error("  npm run version:major");
	process.exit(1);
}

console.log("\nAll non-private packages are at the same version (lockstep).");

// totalUpdates 统计实际改变的依赖项数量。
let totalUpdates = 0;
// updatedPackages 保存至少有一个依赖更新的包，最终统一写回。
const updatedPackages = new Set();
// pkg 是当前待扫描依赖的工作区包。
for (const pkg of workspacePackages) {
	// dependencyType 依次表示运行依赖和开发依赖字段。
	for (const dependencyType of ["dependencies", "devDependencies"]) {
		// dependencies 是当前包的可选依赖映射。
		const dependencies = pkg.data[dependencyType];
		if (!dependencies) {
			continue;
		}

		// dependencyName 和 currentSpecifier 是当前依赖名与版本说明符。
		for (const [dependencyName, currentSpecifier] of Object.entries(dependencies)) {
			// newSpecifier 是同步后应使用的可选版本范围。
			const newSpecifier = synchronizedDependencyVersion(dependencyName, currentSpecifier, versionMap);
			if (!newSpecifier || currentSpecifier === newSpecifier) {
				continue;
			}

			console.log(`\n${pkg.data.name}:`);
			console.log(
				`  ${dependencyName}: ${currentSpecifier} → ${newSpecifier}${dependencyType === "devDependencies" ? " (devDependencies)" : ""}`,
			);
			dependencies[dependencyName] = newSpecifier;
			updatedPackages.add(pkg);
			totalUpdates++;
		}
	}
}

// pkg 是当前需要写回格式化 JSON 的已更新包。
for (const pkg of updatedPackages) {
	writeFileSync(pkg.path, `${JSON.stringify(pkg.data, null, "\t")}\n`);
}

if (totalUpdates === 0) {
	console.log("\nAll inter-package dependencies are already in sync.");
} else {
	console.log(`\nUpdated ${totalUpdates} dependency version(s).`);
}
