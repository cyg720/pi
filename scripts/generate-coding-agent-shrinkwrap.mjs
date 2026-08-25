#!/usr/bin/env node

/**
 * 文件职责：从仓库根 package-lock.json 生成 coding-agent 发布包专用 npm-shrinkwrap.json，并执行安全与完整性校验。
 * 技术维度：遍历 npm lockfile v3 的 packages 图、解析 Node 模块寻址、展开内部工作区依赖并稳定排序输出。
 * 产品维度：确保用户安装 coding-agent 时得到可复现、无本地链接、包含全平台可选包且已审查安装脚本的依赖树。
 * 逻辑维度：定位工作区与外部包，广度遍历依赖队列，构造发布版锁文件，验证后写入或在 --check 模式比较。
 * 关键边界：根锁文件必须为 v3；安装脚本包必须显式列入允许表；未知参数和任何依赖缺失都会立即失败。
 * 新手阅读建议：先看 generateShrinkwrap 主流程，再看 addInternalWorkspace/addExternalPackage，最后阅读 validateShrinkwrap。
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** 当前脚本所在目录。 */
const scriptDir = dirname(fileURLToPath(import.meta.url));
/** 仓库根目录。 */
const repoRoot = resolve(scriptDir, "..");
/** coding-agent 包目录。 */
const codingAgentDir = join(repoRoot, "packages/coding-agent");
/** 根 npm lockfile 路径。 */
const rootLockfilePath = join(repoRoot, "package-lock.json");
/** 生成或检查的 coding-agent shrinkwrap 路径。 */
const shrinkwrapPath = join(codingAgentDir, "npm-shrinkwrap.json");
/** 识别仓库内部发布包的 npm 名称前缀。 */
const internalPackagePrefix = "@earendil-works/pi-";
/** 已人工审查且允许执行安装脚本的“包@版本”及理由。 */
const allowedInstallScriptPackages = new Map([
	["@google/genai@1.52.0", "preinstall is a no-op in the published package"],
	["protobufjs@7.6.5", "postinstall only warns about protobufjs version scheme mismatches"],
]);

/** 用户传入的去重参数集合。 */
const args = new Set(process.argv.slice(2));
/** 是否只检查现有 shrinkwrap 而不写文件。 */
const checkOnly = args.has("--check");

/** arg 是当前命令行参数；仅识别检查模式等脚本选项。 */
for (const arg of args) {
	if (arg !== "--check") {
		console.error(`Unknown argument: ${arg}`);
		process.exit(1);
	}
}

/** 同步读取 JSON 文件并解析。返回 JavaScript 值。示例：readJson(path)。 */
function readJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

/** 合并普通和可选依赖。返回包名到版本范围的对象。 */
function packageDependencies(entry) {
	return {
		...(entry.dependencies ?? {}),
		...(entry.optionalDependencies ?? {}),
	};
}

/** 按键名排序普通对象。返回稳定插入顺序的新对象。 */
function sortedObject(object) {
	return Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
}

/** 按 npm 常见字段顺序整理包条目，其余字段再按字母排序。返回新对象。 */
function sortedPackageEntry(entry) {
	/** shrinkwrap 包条目的首选字段顺序。 */
	const fieldOrder = [
		"name",
		"version",
		"resolved",
		"integrity",
		"license",
		"dependencies",
		"optionalDependencies",
		"peerDependencies",
		"peerDependenciesMeta",
		"bin",
		"engines",
		"os",
		"cpu",
		"libc",
		"optional",
		"hasInstallScript",
		"deprecated",
		"funding",
	];
	/** 按目标顺序逐步填充的结果对象。 */
	const sorted = {};

	for (const field of fieldOrder) {
		/** field 是当前优先输出字段名，存在于记录中时按约定顺序复制。 */
		if (entry[field] !== undefined) {
			sorted[field] = entry[field];
		}
	}
	for (const [field, value] of Object.entries(entry).sort(([a], [b]) => a.localeCompare(b))) {
		/** field 与 value 是按名称排序的当前剩余字段和值，用于保留未知元数据。 */
		if (sorted[field] === undefined) {
			sorted[field] = value;
		}
	}
	return sorted;
}

/** 复制根 lockfile 条目并去除开发、本地链接字段。返回排序条目。 */
function copyLockEntry(entry) {
	/** 待清理的浅拷贝。 */
	const copied = { ...entry };
	delete copied.dev;
	delete copied.devOptional;
	delete copied.extraneous;
	delete copied.link;
	return sortedPackageEntry(copied);
}

/** 从 package.json 复制发布所需字段。options.includeName 控制根 name；返回排序条目。 */
function copyPackageJsonEntry(packageJson, options) {
	/** 根据是否为根条目创建的基础 name/version 对象。 */
	const entry = options.includeName
		? { name: packageJson.name, version: packageJson.version }
		: { version: packageJson.version };

	/** field 是当前允许写入 shrinkwrap 包记录的标准字段名。 */
	for (const field of [
		/** field 是当前允许写入 shrinkwrap 包记录的标准字段名。 */
		"license",
		"dependencies",
		"optionalDependencies",
		"peerDependencies",
		"peerDependenciesMeta",
		"bin",
		"engines",
		"os",
		"cpu",
		"libc",
	]) {
		if (packageJson[field] !== undefined) {
			entry[field] = packageJson[field];
		}
	}

	return sortedPackageEntry(entry);
}

/** 从 lockfile 路径提取 npm 包名，支持 scope；无法识别时返回 undefined。 */
function packageNameFromLockPath(lockPath) {
	/** node_modules 路径标记。 */
	const marker = "node_modules/";
	/** 最内层 node_modules 标记位置。 */
	const index = lockPath.lastIndexOf(marker);
	if (index === -1) {
		return undefined;
	}

	/** node_modules 后按斜杠拆分的包路径。 */
	const parts = lockPath.slice(index + marker.length).split("/");
	if (parts[0]?.startsWith("@")) {
		return `${parts[0]}/${parts[1]}`;
	}
	return parts[0];
}

/** 为指定包版本构造 npm registry tarball URL。返回 HTTPS 地址。 */
function registryTarballUrl(packageName, version) {
	/** tarball 文件名使用的无 scope 包名。 */
	const tarballName = packageName.startsWith("@") ? packageName.split("/")[1] : packageName;
	return `https://registry.npmjs.org/${packageName}/-/${tarballName}-${version}.tgz`;
}

/** 从根 lockfile 找出所有内部工作区包。返回包名到路径/package.json 的 Map。 */
function getInternalWorkspaces(lockPackages) {
	/** 内部包名到工作区元数据的映射。 */
	const workspaces = new Map();

	for (const [lockPath, entry] of Object.entries(lockPackages)) {
		/** lockPath 与 entry 是当前安装路径和包记录，用于建立依赖解析索引。 */
		if (!lockPath.startsWith("packages/") || lockPath.includes("/node_modules/") || !entry.name || !entry.version) {
			continue;
		}
		if (!entry.name.startsWith(internalPackagePrefix)) {
			continue;
		}

		workspaces.set(entry.name, {
			lockPath,
			packageJson: readJson(join(repoRoot, lockPath, "package.json")),
		});
	}

	return workspaces;
}

/** 按 Node 模块向上查找规则解析外部依赖 lock 路径；歧义或缺失时抛错。 */
function resolveExternalDependency(lockPackages, packageName, fromLockPath) {
	/** 从引用方到根依次尝试的目录。 */
	const candidateDirs = [];
	/** 当前向上遍历的 lockfile 路径。 */
	let current = fromLockPath;

	while (current) {
		candidateDirs.push(current);
		/** 当前路径的 POSIX 父目录。 */
		const parent = posix.dirname(current);
		if (parent === "." || parent === current) {
			break;
		}
		current = parent;
	}
	candidateDirs.push("");

	/** 已尝试的完整候选 lock 路径，避免重复。 */
	const tried = new Set();
	for (const directory of candidateDirs) {
		/** 当前目录下对应 node_modules 包的候选路径。 */
		const candidate = directory ? `${directory}/node_modules/${packageName}` : `node_modules/${packageName}`;
		if (tried.has(candidate)) {
			continue;
		}
		tried.add(candidate);

		/** 候选路径处的 lockfile 包条目。 */
		const entry = lockPackages[candidate];
		if (entry && !entry.link) {
			return candidate;
		}
	}

	/** 用于全局后备搜索的 node_modules 路径后缀。 */
	const suffix = `node_modules/${packageName}`;
	/** 全 lockfile 中匹配该包且非链接的路径。 */
	const matches = Object.entries(lockPackages)
		.filter(([lockPath, entry]) => !entry.link && (lockPath === suffix || lockPath.endsWith(`/${suffix}`)))
		.map(([lockPath]) => lockPath);

	if (matches.length === 1) {
		return matches[0];
	}

	throw new Error(
		`Cannot resolve ${packageName} from ${fromLockPath || "root"}. ` +
			(matches.length > 1 ? `Matches: ${matches.join(", ")}` : "No matching lockfile entry found."),
	);
}

/** 把内部工作区作为已发布 tarball 加入 shrinkwrap，并将其依赖入队。无返回值。 */
function addInternalWorkspace(shrinkwrapPackages, addedPaths, queue, name, workspace) {
	/** 内部工作区 package.json。 */
	const packageJson = workspace.packageJson;
	/** 内部包在发布 shrinkwrap 中的根 node_modules 路径。 */
	const outputPath = `node_modules/${name}`;
	/** 从 package.json 复制的发布条目。 */
	const entry = copyPackageJsonEntry(packageJson, { includeName: false });
	entry.resolved = registryTarballUrl(name, packageJson.version);

	shrinkwrapPackages[outputPath] = sortedPackageEntry(entry);
	addedPaths.add(outputPath);

	for (const dependencyName of Object.keys(packageDependencies(packageJson))) {
		/** dependencyName 是根包当前运行时依赖名称，用于追踪完整传递闭包。 */
		queue.push({ name: dependencyName, from: outputPath });
	}
}

/** 解析并加入外部包，然后将其依赖入队；已加入时直接返回。 */
function addExternalPackage(lockPackages, shrinkwrapPackages, addedPaths, queue, name, from) {
	/** 按引用位置解析出的根 lockfile 路径。 */
	const lockPath = resolveExternalDependency(lockPackages, name, from);
	if (addedPaths.has(lockPath)) {
		return;
	}

	/** 根 lockfile 中的外部包条目。 */
	const entry = lockPackages[lockPath];
	shrinkwrapPackages[lockPath] = copyLockEntry(entry);
	addedPaths.add(lockPath);

	for (const dependencyName of Object.keys(packageDependencies(entry))) {
		/** dependencyName 是当前包的运行时依赖名称，用于继续遍历依赖图。 */
		queue.push({ name: dependencyName, from: lockPath });
	}
}

/** 校验生成 shrinkwrap 无链接、依赖完整、安装脚本已审查且含平台包。无返回值。 */
function validateShrinkwrap(shrinkwrap, internalNames) {
	/** 所有校验错误，最终一次性抛出。 */
	const errors = [];
	/** shrinkwrap 已包含的 lock 路径。 */
	const includedPaths = new Set(Object.keys(shrinkwrap.packages));
	/** 从路径解析出的已包含包名。 */
	const includedPackageNames = new Set();
	/** 生成结果中实际出现的安装脚本允许项。 */
	const seenAllowedInstallScriptPackages = new Set();

	for (const [lockPath, entry] of Object.entries(shrinkwrap.packages)) {
		/** 当前 lock 路径提取出的 npm 包名。 */
		const packageName = packageNameFromLockPath(lockPath);
		if (packageName) {
			includedPackageNames.add(packageName);
		}
		if (entry.link) {
			errors.push(`${lockPath} is a link entry`);
		}
		if (typeof entry.resolved === "string" && /^(file:|link:|workspace:|\.\.?\/|\/)/.test(entry.resolved)) {
			errors.push(`${lockPath} has a local resolved value: ${entry.resolved}`);
		}
		if (entry.hasInstallScript) {
			if (!packageName || !entry.version) {
				errors.push(`${lockPath || "root"} has install scripts but no package name/version`);
			} else {
				/** 当前含安装脚本包的“名称@版本”标识。 */
				const packageId = `${packageName}@${entry.version}`;
				if (allowedInstallScriptPackages.has(packageId)) {
					seenAllowedInstallScriptPackages.add(packageId);
				} else {
					errors.push(
						`${lockPath} has install scripts (${packageId}). Review it and add it to allowedInstallScriptPackages if intentional.`,
					);
				}
			}
		}
	}

	for (const packageId of allowedInstallScriptPackages.keys()) {
		/** packageId 是允许执行安装脚本的当前包标识，必须存在于生成结果中。 */
		if (!seenAllowedInstallScriptPackages.has(packageId)) {
			errors.push(`allowed install-script package ${packageId} is no longer present; remove it from the allowlist`);
		}
	}

	for (const name of internalNames) {
		/** name 是当前工作区内部包名，用于确认未被错误打包进发布锁。 */
		if (!includedPackageNames.has(name)) {
			errors.push(`internal dependency ${name} is missing`);
		}
	}

	for (const [lockPath, entry] of Object.entries(shrinkwrap.packages)) {
		/** lockPath 与 entry 是 shrinkwrap 中的当前路径和记录，用于执行最终安全校验。 */
		for (const dependencyName of Object.keys(packageDependencies(entry))) {
			/** 依赖名是否在任一允许的 node_modules 层级出现。 */
			const dependencyIncluded = [...includedPaths].some(
				(candidate) => candidate === `node_modules/${dependencyName}` || candidate.endsWith(`/node_modules/${dependencyName}`),
			);
			if (!dependencyIncluded) {
				errors.push(`${lockPath || "root"} dependency ${dependencyName} is missing`);
			}
		}
	}

	/** 带 os、cpu 或 libc 限制的平台可选包数量。 */
	const platformPackageCount = Object.values(shrinkwrap.packages).filter((entry) => entry.os || entry.cpu || entry.libc).length;
	if (platformPackageCount === 0) {
		errors.push("no platform-specific optional dependency entries found");
	}

	if (errors.length > 0) {
		throw new Error(`Generated shrinkwrap failed validation:\n${errors.map((error) => `  - ${error}`).join("\n")}`);
	}
}

/** 从根 lockfile 遍历 coding-agent 的完整发布依赖闭包。返回已验证 shrinkwrap 对象。 */
function generateShrinkwrap() {
	/** 解析后的根 package-lock.json。 */
	const rootLock = readJson(rootLockfilePath);
	if (rootLock.lockfileVersion !== 3 || !rootLock.packages) {
		throw new Error("package-lock.json must be lockfileVersion 3 and contain a packages map");
	}

	/** 根 lockfile 的 packages 映射。 */
	const lockPackages = rootLock.packages;
	/** coding-agent 自身 package.json。 */
	const codingAgentPackage = readJson(join(codingAgentDir, "package.json"));
	/** 可作为 registry tarball 展开的内部工作区。 */
	const internalWorkspaces = getInternalWorkspaces(lockPackages);
	/** 生成结果的包路径映射，先放入根包。 */
	const shrinkwrapPackages = {
		"": copyPackageJsonEntry(codingAgentPackage, { includeName: true }),
	};
	/** 已加入结果的路径，避免依赖环重复处理。 */
	const addedPaths = new Set([""]);
	/** 依赖闭包中实际使用的内部包名。 */
	const internalNames = new Set();
	/** 待解析依赖的广度遍历队列。 */
	const queue = Object.keys(packageDependencies(codingAgentPackage)).map((name) => ({ name, from: "" }));

	while (queue.length > 0) {
		/** 当前出队的依赖名及引用路径。 */
		const item = queue.shift();
		if (!item) {
			break;
		}

		/** 当前依赖若为内部工作区时的元数据。 */
		const workspace = internalWorkspaces.get(item.name);
		if (workspace) {
			/** 内部包在 shrinkwrap 中的输出路径。 */
			const outputPath = `node_modules/${item.name}`;
			internalNames.add(item.name);
			if (!addedPaths.has(outputPath)) {
				addInternalWorkspace(shrinkwrapPackages, addedPaths, queue, item.name, workspace);
			}
			continue;
		}

		addExternalPackage(lockPackages, shrinkwrapPackages, addedPaths, queue, item.name, item.from);
	}

	/** 按 npm lockfile v3 格式组装的最终对象。 */
	const shrinkwrap = {
		name: codingAgentPackage.name,
		version: codingAgentPackage.version,
		lockfileVersion: 3,
		requires: true,
		packages: sortedObject(shrinkwrapPackages),
	};

	validateShrinkwrap(shrinkwrap, internalNames);
	return shrinkwrap;
}

try {
	/** 生成并验证后的 shrinkwrap 对象。 */
	const shrinkwrap = generateShrinkwrap();
	/** 使用 Tab 缩进并保留末尾换行的输出文本。 */
	const content = `${JSON.stringify(shrinkwrap, null, "\t")}\n`;

	if (checkOnly) {
		if (!existsSync(shrinkwrapPath)) {
			console.error("packages/coding-agent/npm-shrinkwrap.json is missing.");
			console.error("Run: npm run shrinkwrap:coding-agent");
			process.exit(1);
		}
		/** 磁盘上现有 shrinkwrap 文本。 */
		const current = readFileSync(shrinkwrapPath, "utf8");
		if (current !== content) {
			console.error("packages/coding-agent/npm-shrinkwrap.json is out of date.");
			console.error("Run: npm run shrinkwrap:coding-agent");
			process.exit(1);
		}
		console.log("packages/coding-agent/npm-shrinkwrap.json is up to date.");
	} else {
		writeFileSync(shrinkwrapPath, content);
		/** 不含根条目的发布依赖包数量。 */
		const packageCount = Object.keys(shrinkwrap.packages).length - 1;
		/** 生成结果中的平台专属包数量。 */
		const platformPackageCount = Object.values(shrinkwrap.packages).filter((entry) => entry.os || entry.cpu || entry.libc).length;
		console.log(
			`Wrote packages/coding-agent/npm-shrinkwrap.json (${packageCount} packages, ${platformPackageCount} platform-specific).`,
		);
	}
} catch (error) {
	/** error 是生成或校验 shrinkwrap 时的顶层异常；打印可读信息后以失败状态退出。 */
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
}
