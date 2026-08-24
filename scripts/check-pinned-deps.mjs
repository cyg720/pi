/**
 * 文件职责：扫描仓库所有 package.json，确保直接外部依赖使用精确版本号。
 * 技术维度：使用 Node.js 同步目录遍历、正则、Set 和 npm alias 版本解析。
 * 产品维度：降低供应链漂移风险，使安装结果可审查、可复现。
 * 逻辑维度：递归收集清单，遍历三个依赖区，跳过内部/非注册表项，汇总并报告失败。
 * 关键边界：只检查直接依赖和指定三个区段；工作区、文件、Git、URL 等说明符被豁免。
 * 新手阅读建议：先看三组常量，再按 collect、分类函数、主循环、失败输出阅读。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** 需要检查精确版本的 package.json 依赖区段。 */
const dependencySections = ["dependencies", "devDependencies", "optionalDependencies"];
/** 接受完整 semver 及预发布/构建后缀、但不接受 ^、~ 或范围的正则。 */
const exactVersionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
/** 递归扫描时跳过的目录。 */
const ignoredDirectories = new Set([".git", "dist", "node_modules"]);
/** 已发现的 package.json 相对路径。 */
const packageJsonFiles = [];

/** @param directory 当前扫描目录。@returns 无返回；将发现的清单追加到 packageJsonFiles。 */
function collectPackageJsonFiles(directory) {
	// entry 是当前目录中的一个文件系统条目。
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (!ignoredDirectories.has(entry.name)) {
				collectPackageJsonFiles(join(directory, entry.name));
			}
			continue;
		}

		if (entry.isFile() && entry.name === "package.json") {
			packageJsonFiles.push(join(directory, entry.name));
		}
	}
}

/** @param name 依赖包名。@returns 是否为本仓库内部包。 */
function isInternalWorkspaceDependency(name) {
	return name.startsWith("@earendil-works/pi-");
}

/** @param specifier 依赖说明符。@returns 是否来自工作区、文件、Git 或 URL 而非 npm 注册表版本。 */
function isNonRegistrySpecifier(specifier) {
	return /^(?:workspace:|file:|link:|portal:|git\+|github:|git:|https?:|ssh:|git:\/\/)/.test(specifier);
}

/** @param specifier 普通版本或 npm alias。@returns 实际需要校验的版本部分。 */
function getVersionSpecifier(specifier) {
	if (!specifier.startsWith("npm:")) return specifier;
	/** 去掉 npm: 前缀后的 alias 目标。 */
	const aliasTarget = specifier.slice("npm:".length);
	/** alias 目标中最后一个 @ 的位置，用于兼容带作用域包名。 */
	const versionSeparator = aliasTarget.lastIndexOf("@");
	if (versionSeparator <= 0) return specifier;
	return aliasTarget.slice(versionSeparator + 1);
}

/** 所有未固定依赖的诊断文本。 */
const failures = [];

collectPackageJsonFiles(".");

// file 是排序后的一个 package.json 路径。
for (const file of packageJsonFiles.sort()) {
	/** 当前清单解析出的对象。 */
	const packageJson = JSON.parse(readFileSync(file, "utf8"));

	// section 是 dependencies、devDependencies 或 optionalDependencies。
	for (const section of dependencySections) {
		/** 当前依赖区段对象；缺失时跳过。 */
		const dependencies = packageJson[section];
		if (!dependencies) continue;

		// name 与 specifier 是当前依赖名及版本说明符。
		for (const [name, specifier] of Object.entries(dependencies)) {
			if (isInternalWorkspaceDependency(name) || isNonRegistrySpecifier(specifier)) continue;
			if (exactVersionPattern.test(getVersionSpecifier(specifier))) continue;
			failures.push(`${file}: ${section}.${name} must be pinned, found ${specifier}`);
		}
	}
}

if (failures.length > 0) {
	console.error("Direct external dependencies must use exact versions:");
	// failure 是一条未固定依赖诊断。
	for (const failure of failures) console.error(`  ${failure}`);
	process.exit(1);
}
