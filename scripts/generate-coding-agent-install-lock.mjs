#!/usr/bin/env node

/**
 * 文件职责：从仓库根锁文件提取 coding-agent 安装所需的生产依赖闭包，并生成独立安装锁文件。
 * 技术维度：使用 Node.js 文件 API、npm lockfileVersion 3 结构、依赖图广度遍历和确定性字段排序。
 * 产品维度：让安装器和自更新流程获得可复现、跨平台且不依赖工作区链接的最小依赖集合。
 * 逻辑维度：读取工作区与外部包，解析依赖位置，复制并规范化锁条目，严格校验后检查或写入产物。
 * 关键边界：安装脚本包必须显式加入审核白名单；内部包版本必须锁步，任何本地 link/file 引用都会失败。
 * 新手阅读建议：先读 generateInstallLock 的队列流程，再看两个 add* 函数，最后理解 validateGeneratedFiles 的安全约束。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** 当前生成脚本所在目录。 */
const scriptDir = dirname(fileURLToPath(import.meta.url));
/** 单体仓库根目录。 */
const repoRoot = resolve(scriptDir, "..");
/** coding-agent 包目录。 */
const codingAgentDir = join(repoRoot, "packages/coding-agent");
/** 独立安装锁产物目录。 */
const outputDir = join(codingAgentDir, "install-lock");
/** 仓库根 package-lock.json 路径，作为依赖真值来源。 */
const rootLockfilePath = join(repoRoot, "package-lock.json");
/** 生成的安装器 package.json 路径。 */
const outputPackageJsonPath = join(outputDir, "package.json");
/** 生成的安装器 package-lock.json 路径。 */
const outputLockfilePath = join(outputDir, "package-lock.json");
/** 用于识别仓库内部发布包的名称前缀。 */
const internalPackagePrefix = "@earendil-works/pi-";
/** 独立锁文件根项目使用的私有包名。 */
const installPackageName = "@earendil-works/pi-coding-agent-install";
/** 经人工审核允许保留安装脚本的精确包版本及依据。 */
const allowedInstallScriptPackages = new Map([
	["@google/genai@1.52.0", "preinstall is a no-op in the published package"],
	["protobufjs@7.6.5", "postinstall only warns about protobufjs version scheme mismatches"],
]);

/** 去重后的命令行参数，目前仅支持 --check。 */
const args = new Set(process.argv.slice(2));
/** 是否只验证现有生成文件而不写盘。 */
const checkOnly = args.has("--check");

/** arg 是当前命令行参数；仅识别检查模式等脚本选项。 */
for (const arg of args) {
	if (arg !== "--check") {
		console.error(`Unknown argument: ${arg}`);
		process.exit(1);
	}
}

/** 读取并解析 UTF-8 JSON 文件。参数 path 为文件路径；返回解析对象。例如：readJson(rootLockfilePath)。 */
function readJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

/** 合并包的普通依赖与可选依赖。参数 entry 为包元数据；返回名称到版本规格映射。例如：packageDependencies(entry)。 */
function packageDependencies(entry) {
	return {
		...(entry.dependencies ?? {}),
		...(entry.optionalDependencies ?? {}),
	};
}

/** 按键名字典序重建对象。参数 object 为待排序对象；返回确定性对象。例如：sortedObject(packages)。 */
function sortedObject(object) {
	return Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
}

/** 按常用锁文件字段顺序及字典序整理包条目。参数 entry 为原条目；返回新对象。例如：sortedPackageEntry(entry)。 */
function sortedPackageEntry(entry) {
	/** 锁文件核心字段的稳定优先顺序。 */
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

/** 复制外部锁条目并移除开发、外来和链接标记。参数 entry 为根锁条目；返回排序后的生产条目。例如：copyLockEntry(entry)。 */
function copyLockEntry(entry) {
	/** 可安全删除元数据的浅拷贝。 */
	const copied = { ...entry };
	delete copied.dev;
	delete copied.devOptional;
	delete copied.extraneous;
	delete copied.link;
	return sortedPackageEntry(copied);
}

/** 从工作区 package.json 构造锁条目。参数 options.includeName 控制名称字段；返回排序条目。例如：copyPackageJsonEntry(pkg,{includeName:false})。 */
function copyPackageJsonEntry(packageJson, options) {
	/** 以版本及可选名称初始化的目标条目。 */
	const entry = options.includeName
		? { name: packageJson.name, version: packageJson.version }
		: { version: packageJson.version };

	/** field 是当前允许写入安装锁包记录的标准字段名。 */
	for (const field of [
		/** field 是当前允许写入安装锁包记录的标准字段名。 */
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

/** 从 node_modules 锁路径提取包名。参数 lockPath 为 packages 键；返回普通/作用域包名或 undefined。例如：packageNameFromLockPath(path)。 */
function packageNameFromLockPath(lockPath) {
	/** 锁路径中最后一个依赖目录标记。 */
	const marker = "node_modules/";
	/** 最后一个依赖目录标记的位置。 */
	const index = lockPath.lastIndexOf(marker);
	if (index === -1) {
		return undefined;
	}

	/** node_modules 后按斜杠拆分的路径片段。 */
	const parts = lockPath.slice(index + marker.length).split("/");
	if (parts[0]?.startsWith("@")) {
		return `${parts[0]}/${parts[1]}`;
	}
	return parts[0];
}

/** 构造 npm Registry tarball URL。参数为包名和精确版本；返回下载地址。例如：registryTarballUrl(name, version)。 */
function registryTarballUrl(packageName, version) {
	/** tarball 文件名中的无作用域包名部分。 */
	const tarballName = packageName.startsWith("@") ? packageName.split("/")[1] : packageName;
	return `https://registry.npmjs.org/${packageName}/-/${tarballName}-${version}.tgz`;
}

/** 判断依赖规格是否为精确语义版本。参数 spec 为版本字符串；返回布尔值。例如：isExactVersionSpec("1.2.3")。 */
function isExactVersionSpec(spec) {
	return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(spec);
}

/** 收集根锁文件中的内部发布工作区。参数 lockPackages 为 packages 映射；返回包名到工作区信息的 Map。例如：getInternalWorkspaces(packages)。 */
function getInternalWorkspaces(lockPackages) {
	/** 内部包名到锁路径及 package.json 的映射。 */
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

/** 按 Node 向上查找规则定位外部依赖锁条目。参数为 packages、包名和来源路径；返回锁路径，歧义或缺失时抛错。 */
function resolveExternalDependency(lockPackages, packageName, fromLockPath) {
	/** 从来源开始逐级向上的候选依赖目录。 */
	const candidateDirs = [];
	/** 正在回溯的锁路径。 */
	let current = fromLockPath;

	while (current) {
		candidateDirs.push(current);
		/** 当前锁路径的父目录。 */
		const parent = posix.dirname(current);
		if (parent === "." || parent === current) {
			break;
		}
		current = parent;
	}
	candidateDirs.push("");

	/** 已检查候选路径集合，防止重复查询。 */
	const tried = new Set();
	for (const directory of candidateDirs) {
		/** 当前目录下按 node_modules 规则拼出的候选锁路径。 */
		const candidate = directory ? `${directory}/node_modules/${packageName}` : `node_modules/${packageName}`;
		if (tried.has(candidate)) {
			continue;
		}
		tried.add(candidate);

		/** 候选路径对应的锁条目。 */
		const entry = lockPackages[candidate];
		if (entry && !entry.link) {
			return candidate;
		}
	}

	/** 在常规向上查找失败后用于全局匹配的路径后缀。 */
	const suffix = `node_modules/${packageName}`;
	/** 所有非链接且后缀匹配的锁路径。 */
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

/** 把内部工作区转换为 Registry 锁条目并入队其依赖。参数为目标映射、去重集、队列、包名和工作区；无返回值。 */
function addInternalWorkspace(installLockPackages, addedPaths, queue, name, workspace) {
	/** 内部工作区的 package.json 数据。 */
	const packageJson = workspace.packageJson;
	/** 安装锁中该内部包的标准 node_modules 路径。 */
	const outputPath = `node_modules/${name}`;
	/** 从 package.json 复制出的锁条目。 */
	const entry = copyPackageJsonEntry(packageJson, { includeName: false });
	entry.resolved = registryTarballUrl(name, packageJson.version);

	installLockPackages[outputPath] = sortedPackageEntry(entry);
	addedPaths.add(outputPath);

	for (const dependencyName of Object.keys(packageDependencies(packageJson))) {
		/** dependencyName 是根包当前运行时依赖名称，用于追踪完整传递闭包。 */
		queue.push({ name: dependencyName, from: outputPath });
	}
}

/** 复制外部依赖及入队其子依赖。参数包含源/目标映射、去重集、队列、名称和来源；无返回值。 */
function addExternalPackage(lockPackages, installLockPackages, addedPaths, queue, name, from) {
	/** 按来源解析出的外部依赖锁路径。 */
	const lockPath = resolveExternalDependency(lockPackages, name, from);
	if (addedPaths.has(lockPath)) {
		return;
	}

	/** 根锁文件中的原始外部包条目。 */
	const entry = lockPackages[lockPath];
	installLockPackages[lockPath] = copyLockEntry(entry);
	addedPaths.add(lockPath);

	for (const dependencyName of Object.keys(packageDependencies(entry))) {
		/** dependencyName 是当前包的运行时依赖名称，用于继续遍历依赖图。 */
		queue.push({ name: dependencyName, from: lockPath });
	}
}

/** 创建独立安装锁的根 package.json。参数为 coding-agent 包元数据；返回私有安装器对象。例如：createInstallerPackageJson(pkg)。 */
function createInstallerPackageJson(codingAgentPackage) {
	/** 仅依赖当前版本 coding-agent 的安装器包元数据。 */
	const packageJson = {
		name: installPackageName,
		version: codingAgentPackage.version,
		private: true,
		description: "Lockfile root used by the Pi installer and updater.",
		dependencies: {
			[codingAgentPackage.name]: codingAgentPackage.version,
		},
	};
	if (codingAgentPackage.overrides) {
		packageJson.overrides = codingAgentPackage.overrides;
	}
	if (codingAgentPackage.engines) {
		packageJson.engines = codingAgentPackage.engines;
	}
	return packageJson;
}

/** 从安装器 package.json 创建锁文件根条目。参数为安装器元数据；返回排序条目。例如：createRootLockEntry(pkg)。 */
function createRootLockEntry(installerPackageJson) {
	/** 锁文件 packages[""] 的基础字段。 */
	const entry = {
		name: installerPackageJson.name,
		version: installerPackageJson.version,
		dependencies: installerPackageJson.dependencies,
	};
	if (installerPackageJson.engines) {
		entry.engines = installerPackageJson.engines;
	}
	return sortedPackageEntry(entry);
}

/** 全面校验生成锁文件的可发布性和依赖闭包。参数为根元数据、锁对象、内部包名集；成功无返回值，失败抛错。 */
function validateGeneratedFiles(installerPackageJson, installLock, internalNames) {
	/** 收集全部校验错误，最后一次性报告。 */
	const errors = [];
	/** 安装锁的根 packages 条目。 */
	const rootEntry = installLock.packages[""];
	/** 锁文件实际包含的包名集合。 */
	const includedPackageNames = new Set();
	/** 本次锁文件中确实出现的白名单安装脚本包。 */
	const seenAllowedInstallScriptPackages = new Set();

	if (installLock.lockfileVersion !== 3) {
		errors.push("package-lock.json must use lockfileVersion 3");
	}
	if (installLock.name !== installerPackageJson.name) {
		errors.push(`lockfile name ${installLock.name} does not match package.json name ${installerPackageJson.name}`);
	}
	if (installLock.version !== installerPackageJson.version) {
		errors.push(
			`lockfile version ${installLock.version} does not match package.json version ${installerPackageJson.version}`,
		);
	}
	if (JSON.stringify(rootEntry?.dependencies ?? {}) !== JSON.stringify(installerPackageJson.dependencies)) {
		errors.push("lockfile root dependencies do not match package.json dependencies");
	}

	for (const [lockPath, entry] of Object.entries(installLock.packages)) {
		/** 从当前锁路径推导出的包名；根条目为 undefined。 */
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
		if (entry.dev || entry.devOptional || entry.extraneous) {
			errors.push(`${lockPath || "root"} contains dev/extraneous metadata`);
		}
		if (packageName?.startsWith(internalPackagePrefix) && entry.version !== installerPackageJson.version) {
			errors.push(`${lockPath} internal package version ${entry.version} does not match ${installerPackageJson.version}`);
		}
		if (entry.hasInstallScript) {
			if (!packageName || !entry.version) {
				errors.push(`${lockPath || "root"} has install scripts but no package name/version`);
			} else {
				/** 用于精确匹配安装脚本白名单的名称与版本组合。 */
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

	for (const [lockPath, entry] of Object.entries(installLock.packages)) {
		/** lockPath 与 entry 是生成锁中的当前路径和记录，用于执行最终安全校验。 */
		for (const [dependencyName, dependencySpec] of Object.entries(packageDependencies(entry))) {
			/** 当前依赖在生成锁中的实际解析路径。 */
			let dependencyLockPath;
			try {
				dependencyLockPath = resolveExternalDependency(installLock.packages, dependencyName, lockPath);
			} catch {
				errors.push(`${lockPath || "root"} dependency ${dependencyName} is missing`);
				continue;
			}

			/** 被解析依赖对应的生成锁条目。 */
			const dependencyEntry = installLock.packages[dependencyLockPath];
			if (isExactVersionSpec(dependencySpec) && dependencyEntry.version !== dependencySpec) {
				errors.push(
					`${lockPath || "root"} dependency ${dependencyName}@${dependencySpec} resolves to ${dependencyEntry.version}`,
				);
			}
		}
	}

	/** 包含操作系统、CPU 或 libc 约束的平台专用包数量。 */
	const platformPackageCount = Object.values(installLock.packages).filter((entry) => entry.os || entry.cpu || entry.libc)
		.length;
	if (platformPackageCount === 0) {
		errors.push("no platform-specific optional dependency entries found");
	}

	if (errors.length > 0) {
		throw new Error(`Generated installer lock failed validation:\n${errors.map((error) => `  - ${error}`).join("\n")}`);
	}
}

/** 从根锁文件生成并校验独立安装器元数据。无参数；返回 package.json 与 package-lock 对象。例如：generateInstallLock()。 */
function generateInstallLock() {
	/** 解析后的仓库根锁文件。 */
	const rootLock = readJson(rootLockfilePath);
	if (rootLock.lockfileVersion !== 3 || !rootLock.packages) {
		throw new Error("package-lock.json must be lockfileVersion 3 and contain a packages map");
	}

	/** 根锁文件的 packages 路径映射。 */
	const lockPackages = rootLock.packages;
	/** coding-agent 当前 package.json。 */
	const codingAgentPackage = readJson(join(codingAgentDir, "package.json"));
	/** 独立安装锁的根 package.json。 */
	const installerPackageJson = createInstallerPackageJson(codingAgentPackage);
	/** 根锁文件中的内部工作区索引。 */
	const internalWorkspaces = getInternalWorkspaces(lockPackages);
	/** 正在构建的安装锁 packages 映射，初始仅含根条目。 */
	const installLockPackages = {
		"": createRootLockEntry(installerPackageJson),
	};
	/** 已加入目标锁的路径集合，用于去重和阻止依赖环。 */
	const addedPaths = new Set([""]);
	/** 依赖闭包中实际使用的内部包名。 */
	const internalNames = new Set();
	/** 尚待解析的依赖队列，每项携带名称与父锁路径。 */
	const queue = Object.keys(packageDependencies(installerPackageJson)).map((name) => ({ name, from: "" }));

	while (queue.length > 0) {
		/** 当前从队首取出的依赖任务。 */
		const item = queue.shift();
		if (!item) {
			break;
		}

		/** 当前依赖是否对应仓库内部工作区。 */
		const workspace = internalWorkspaces.get(item.name);
		if (workspace) {
			/** 内部包写入目标锁时的标准路径。 */
			const outputPath = `node_modules/${item.name}`;
			internalNames.add(item.name);
			if (!addedPaths.has(outputPath)) {
				addInternalWorkspace(installLockPackages, addedPaths, queue, item.name, workspace);
			}
			continue;
		}

		addExternalPackage(lockPackages, installLockPackages, addedPaths, queue, item.name, item.from);
	}

	/** 排序并补齐顶层元数据后的最终安装锁对象。 */
	const installLock = {
		name: installerPackageJson.name,
		version: installerPackageJson.version,
		lockfileVersion: 3,
		requires: true,
		packages: sortedObject(installLockPackages),
	};

	validateGeneratedFiles(installerPackageJson, installLock, internalNames);
	return { installerPackageJson, installLock };
}

try {
	/** 本次生成得到的安装器元数据与锁文件对象。 */
	const { installerPackageJson, installLock } = generateInstallLock();
	/** 使用制表符缩进并以换行结尾的 package.json 文本。 */
	const packageJsonContent = `${JSON.stringify(installerPackageJson, null, "\t")}\n`;
	/** 使用制表符缩进并以换行结尾的 package-lock.json 文本。 */
	const lockfileContent = `${JSON.stringify(installLock, null, "\t")}\n`;

	if (checkOnly) {
		if (!existsSync(outputPackageJsonPath) || !existsSync(outputLockfilePath)) {
			console.error("packages/coding-agent/install-lock is missing generated files.");
			console.error("Run: npm run install-lock:coding-agent");
			process.exit(1);
		}
		/** 磁盘上现有的安装器 package.json 文本。 */
		const currentPackageJson = readFileSync(outputPackageJsonPath, "utf8");
		/** 磁盘上现有的安装器 package-lock.json 文本。 */
		const currentLockfile = readFileSync(outputLockfilePath, "utf8");
		if (currentPackageJson !== packageJsonContent || currentLockfile !== lockfileContent) {
			console.error("packages/coding-agent/install-lock is out of date.");
			console.error("Run: npm run install-lock:coding-agent");
			process.exit(1);
		}
		console.log("packages/coding-agent/install-lock is up to date.");
	} else {
		mkdirSync(outputDir, { recursive: true });
		writeFileSync(outputPackageJsonPath, packageJsonContent);
		writeFileSync(outputLockfilePath, lockfileContent);
		/** 生成锁中除根条目外的依赖包数量。 */
		const packageCount = Object.keys(installLock.packages).length - 1;
		/** 生成锁中带平台约束的可选包数量。 */
		const platformPackageCount = Object.values(installLock.packages).filter((entry) => entry.os || entry.cpu || entry.libc)
			.length;
		console.log(
			`Wrote packages/coding-agent/install-lock/package.json and package-lock.json (${packageCount} packages, ${platformPackageCount} platform-specific).`,
		);
	}
} catch (error) {
	/** error 是生成或校验安装锁时的顶层异常；打印可读信息后以失败状态退出。 */
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
}
