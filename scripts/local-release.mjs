#!/usr/bin/env node
/**
 * 文件职责：构建并打包所有可发布工作区包，在仓库外创建隔离 npm/Bun 安装和当前平台 Bun 二进制。
 * 技术维度：使用 Node.js ESM、npm pack/install、Bun、子进程、文件复制、符号链接和临时目录。
 * 产品维度：在正式发布前提供接近用户安装方式的本地冒烟测试产物，发现打包遗漏和跨运行时问题。
 * 逻辑维度：解析选项，准备外部输出目录，生成模型与校验，构建打包，再创建二进制和隔离安装。
 * 关键边界：输出目录必须在仓库外；--force 会递归删除指定输出；脚本默认运行检查、测试和构建。
 * 新手阅读建议：先看底部主流程，再读 prepareOutputDirectory 的安全检查，最后看打包、shim 和 Bun 二进制。
 */

import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

/** 按依赖顺序构建和打包的公开工作区包。 */
const packages = [
	{ directory: "packages/ai", name: "@earendil-works/pi-ai" },
	{ directory: "packages/tui", name: "@earendil-works/pi-tui" },
	{ directory: "packages/agent", name: "@earendil-works/pi-agent-core" },
	{ directory: "packages/storage/sqlite-node", name: "@earendil-works/pi-storage-sqlite-node" },
	{ directory: "packages/coding-agent", name: "@earendil-works/pi-coding-agent" },
];

/** 输出本地发布脚本用法和选项。 */
function printUsage() {
	console.log(`Usage: node scripts/local-release.mjs [options]

Builds and packs the publishable packages, then installs the tarballs into an
isolated directory outside the repository for local release testing.

Options:
  --out <dir>          Output directory. Defaults to a new directory under ${tmpdir()}
  --force              Remove --out first if it already exists
  --skip-check         Do not run npm run check before building
  --skip-test          Do not run ./test.sh before building
  --skip-install       Only create tarballs; do not create isolated installs
  --skip-bun-install   Do not create the isolated Bun install
  --help               Show this help
`);
}

/**
 * 解析 process.argv 中的本地发布选项。
 * @returns {object} force、输出目录和各跳过开关。
 */
function parseArgs() {
	/** 使用默认值初始化的可变选项。 */
	const options = {
		force: false,
		outDir: undefined,
		skipBunInstall: false,
		skipCheck: false,
		skipInstall: false,
		skipTest: false,
	};
	/** 不含 node 与脚本路径的命令行参数。 */
	const args = process.argv.slice(2);

	for (let i = 0; i < args.length; i++) {
		/** 当前参数。 */
		const arg = args[i];
		if (arg === "--help") {
			printUsage();
			process.exit(0);
		}
		if (arg === "--force") {
			options.force = true;
			continue;
		}
		if (arg === "--skip-check") {
			options.skipCheck = true;
			continue;
		}
		if (arg === "--skip-test") {
			options.skipTest = true;
			continue;
		}
		if (arg === "--skip-install") {
			options.skipInstall = true;
			continue;
		}
		if (arg === "--skip-bun-install") {
			options.skipBunInstall = true;
			continue;
		}
		if (arg === "--out") {
			/** --out 后的目录值。 */
			const value = args[++i];
			if (!value) {
				throw new Error("--out requires a directory");
			}
			options.outDir = value;
			continue;
		}
		throw new Error(`Unknown option: ${arg}`);
	}

	return options;
}

/**
 * 同步运行并显示外部命令，失败时抛错。
 * @param {string} command 命令。
 * @param {string[]} args 参数。
 * @param {{cwd?:string,capture?:boolean}} options 工作目录与输出捕获。
 * @returns {string} 捕获输出或空串。
 */
function run(command, args, options = {}) {
	console.log(`$ ${[command, ...args].join(" ")}`);
	/** 子进程同步执行结果。 */
	const result = spawnSync(command, args, {
		cwd: options.cwd,
		encoding: "utf8",
		shell: process.platform === "win32",
		stdio: options.capture ? ["inherit", "pipe", "inherit"] : "inherit",
	});

	if (result.status !== 0) {
		throw new Error(`Command failed: ${[command, ...args].join(" ")}`);
	}

	return result.stdout ?? "";
}

/** 读取并解析指定目录 package.json。 */
function readPackageJson(directory) {
	return JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
}

/** 检查命令是否能成功执行 --version。 */
function commandExists(command) {
	return spawnSync(command, ["--version"], { stdio: "ignore" }).status === 0;
}

/**
 * 判断 child 是否等于或位于 parent 之下。
 * @param {string} child 子路径。
 * @param {string} parent 父路径。
 * @returns {boolean} 是否在范围内。
 */
function isInsidePath(child, parent) {
	/** child 相对 parent 的路径。 */
	const relativePath = relative(parent, child);
	return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

/**
 * 创建或安全替换仓库外输出目录。
 * @param {object} options 解析后的命令选项。
 * @param {string} repoRoot 仓库根目录。
 * @returns {string} 可用输出目录。
 */
function prepareOutputDirectory(options, repoRoot) {
	if (!options.outDir) {
		return mkdtempSync(join(tmpdir(), "pi-local-release-"));
	}

	/** 规范化后的显式输出目录。 */
	const outDir = resolve(options.outDir);

	if (isInsidePath(outDir, repoRoot)) {
		throw new Error(`Output directory must be outside the repository: ${outDir}`);
	}

	if (existsSync(outDir)) {
		if (!options.force) {
			throw new Error(`Output directory already exists. Use --force to replace it: ${outDir}`);
		}
		rmSync(outDir, { force: true, recursive: true });
	}

	mkdirSync(outDir, { recursive: true });
	return outDir;
}

/** 将 tarball 路径转换为相对安装目录的 file: 说明符。 */
function fileSpecifier(fromDirectory, file) {
	/** 使用正斜杠的相对路径。 */
	const relativePath = relative(fromDirectory, file).replaceAll("\\", "/");
	return `file:${relativePath.startsWith(".") ? relativePath : `./${relativePath}`}`;
}

/** 返回当前操作系统和架构对应的二进制平台名。 */
function currentBinaryPlatform() {
	if (process.platform === "win32") return process.arch === "arm64" ? "windows-arm64" : "windows-x64";
	if (process.platform === "darwin") return process.arch === "arm64" ? "darwin-arm64" : "darwin-x64";
	if (process.platform === "linux") return process.arch === "arm64" ? "linux-arm64" : "linux-x64";
	throw new Error(`Unsupported binary platform: ${process.platform} ${process.arch}`);
}

/**
 * 构建当前平台 Bun 二进制并复制解压目录和归档。
 * @param {string} targetDirectory 目标可执行目录。
 * @param {string} archiveDirectory 归档输出目录。
 * @returns {string} 当前二进制平台名。
 */
function buildBunBinaryRelease(targetDirectory, archiveDirectory) {
	if (!commandExists("bun")) {
		throw new Error("Bun is required for the local binary release build.");
	}
	/** 当前机器对应的平台标识。 */
	const platform = currentBinaryPlatform();
	/** build-binaries.sh 临时输出目录。 */
	const binaryBuildDirectory = join(archiveDirectory, "binary-build");
	run("./scripts/build-binaries.sh", [
		"--skip-install",
		"--skip-deps",
		"--skip-build",
		"--platform",
		platform,
		"--out",
		binaryBuildDirectory,
	]);
	rmSync(targetDirectory, { force: true, recursive: true });
	cpSync(join(binaryBuildDirectory, platform), targetDirectory, { recursive: true });
	/** 当前平台生成的 zip 或 tar.gz 文件名。 */
	const archiveName = platform.startsWith("windows-") ? `pi-${platform}.zip` : `pi-${platform}.tar.gz`;
	cpSync(join(binaryBuildDirectory, archiveName), join(archiveDirectory, archiveName));
	return platform;
}

/**
 * 在隔离安装根目录创建方便调用 pi 的平台 shim。
 * @param {string} installDirectory npm 或 Bun 安装目录。
 * @returns {void}
 */
function createPiShim(installDirectory) {
	/** node_modules/.bin 路径。 */
	const binDirectory = join(installDirectory, "node_modules", ".bin");
	if (process.platform === "win32") {
		if (existsSync(join(binDirectory, "pi.cmd"))) {
			writeFileSync(join(installDirectory, "pi.cmd"), '@ECHO off\r\n"%~dp0node_modules\\.bin\\pi.cmd" %*\r\n');
			writeFileSync(join(installDirectory, "pi.ps1"), '& "$PSScriptRoot/node_modules/.bin/pi.ps1" @args\n');
			return;
		}
		writeFileSync(join(installDirectory, "pi.cmd"), '@ECHO off\r\n"%~dp0node_modules\\.bin\\pi.exe" %*\r\n');
		writeFileSync(join(installDirectory, "pi.ps1"), '& "$PSScriptRoot/node_modules/.bin/pi.exe" @args\n');
		return;
	}
	symlinkSync(join("node_modules", ".bin", "pi"), join(installDirectory, "pi"));
}

/**
 * 校验包名并用 npm pack 生成 tarball。
 * @param {{directory:string,name:string}} pkg 包目录和期望名称。
 * @param {string} tarballDirectory tarball 输出目录。
 * @returns {string} 生成 tarball 路径。
 */
function packPackage(pkg, tarballDirectory) {
	/** 目标包 package.json。 */
	const packageJson = readPackageJson(pkg.directory);
	if (packageJson.name !== pkg.name) {
		throw new Error(`${pkg.directory}/package.json has name ${packageJson.name}, expected ${pkg.name}`);
	}

	/** npm pack --json 输出文本。 */
	const output = run("npm", ["pack", "--json", "--pack-destination", tarballDirectory], {
		capture: true,
		cwd: pkg.directory,
	});
	/** npm pack 输出数组首项。 */
	const packed = JSON.parse(output)[0];
	return join(tarballDirectory, packed.filename);
}

/** 解析后的本地发布选项。 */
const options = parseArgs();
/** 要求为当前工作目录的仓库根路径。 */
const repoRoot = process.cwd();
/** 根 package.json，用于确认脚本运行位置。 */
const rootPackageJson = readPackageJson(repoRoot);

if (rootPackageJson.name !== "pi-monorepo") {
	throw new Error("Run this script from the repository root");
}

/** 已安全准备的仓库外输出根目录。 */
const outDir = prepareOutputDirectory(options, repoRoot);
/** npm pack tarball 目录。 */
const tarballDirectory = join(outDir, "tarballs");
/** 隔离 npm 安装目录。 */
const nodeInstallDirectory = join(outDir, "node");
/** 隔离 Bun 包安装目录。 */
const bunInstallDirectory = join(outDir, "bun-install");
/** 当前平台 Bun 二进制解压目录。 */
const binaryDirectory = join(outDir, "bun");
mkdirSync(tarballDirectory, { recursive: true });

// Release artifacts always use a freshly generated, strictly validated catalog,
// including when checks or tests are explicitly skipped.
// 即使显式跳过检查或测试，发布产物仍必须使用新生成并严格校验的模型目录。
run("npm", ["run", "generate:models"], { cwd: repoRoot });

if (!options.skipCheck) {
	run("npm", ["run", "check"], { cwd: repoRoot });
}


// pkg 是当前待清理并构建的工作区包描述。
for (const pkg of packages) {
	run("npm", ["run", "clean"], { cwd: pkg.directory });
	run("npm", ["run", pkg.directory === "packages/ai" ? "build:offline" : "build"], { cwd: pkg.directory });
}

if (!options.skipTest) {
	run("./test.sh", [], { cwd: repoRoot });
}

/** 包名到本地 tarball 路径的映射。 */
const tarballs = new Map();
for (const pkg of packages) {
	/** 当前包生成的 tarball 路径。 */
	const tarball = packPackage(pkg, tarballDirectory);
	tarballs.set(pkg.name, tarball);
}

/** 实际构建的当前二进制平台；跳过安装时保持 undefined。 */
let binaryPlatform;
if (!options.skipInstall) {
	binaryPlatform = buildBunBinaryRelease(binaryDirectory, outDir);

	mkdirSync(nodeInstallDirectory, { recursive: true });
	/** 隔离 npm 安装使用的本地 tarball 依赖映射。 */
	const dependencies = Object.fromEntries(
		packages.map((pkg) => [pkg.name, fileSpecifier(nodeInstallDirectory, tarballs.get(pkg.name))]),
	);
	/** 隔离 npm 安装的 package.json 文本。 */
	const installPackageJson = `${JSON.stringify({ private: true, dependencies, overrides: dependencies }, undefined, "\t")}\n`;
	writeFileSync(join(nodeInstallDirectory, "package.json"), installPackageJson);

	run("npm", ["install", "--omit=dev", "--ignore-scripts"], { cwd: nodeInstallDirectory });
	createPiShim(nodeInstallDirectory);

	if (!options.skipBunInstall) {
		if (!commandExists("bun")) {
			throw new Error("Bun is required for the isolated Bun install. Use --skip-bun-install to skip it.");
		}
		mkdirSync(bunInstallDirectory, { recursive: true });
		/** 隔离 Bun 安装使用的本地 tarball 依赖映射。 */
		const bunDependencies = Object.fromEntries(
			packages.map((pkg) => [pkg.name, fileSpecifier(bunInstallDirectory, tarballs.get(pkg.name))]),
		);
		writeFileSync(join(bunInstallDirectory, "package.json"), `${JSON.stringify({ private: true, dependencies: bunDependencies, overrides: bunDependencies }, undefined, "\t")}\n`);
		run("bun", ["install", "--production", "--ignore-scripts"], { cwd: bunInstallDirectory });
		createPiShim(bunInstallDirectory);
	}
}

console.log("\nLocal release artifacts created:");
console.log(`  ${outDir}`);
console.log("\nTarballs:");

// tarball 是当前已打包工作区产物的绝对路径。
for (const tarball of tarballs.values()) {
	console.log(`  ${tarball}`);
}

if (!options.skipInstall) {
	console.log("\nLocal Bun binary release:");
	console.log(`  ${binaryDirectory}`);
	console.log(`  ${join(outDir, `pi-${binaryPlatform}.${String(binaryPlatform).startsWith("windows-") ? "zip" : "tar.gz"}`)}`);
	console.log("\nRun the local Bun binary release from outside the repository:");
	console.log(`  ${join(binaryDirectory, String(binaryPlatform).startsWith("windows-") ? "pi.exe" : "pi")} --help`);

	console.log("\nIsolated npm install:");
	console.log(`  ${nodeInstallDirectory}`);
	console.log("\nRun the locally packed npm CLI from outside the repository:");
	console.log(`  ${join(nodeInstallDirectory, process.platform === "win32" ? "pi.cmd" : "pi")} --help`);

	if (!options.skipBunInstall) {
		console.log("\nIsolated Bun package install:");
		console.log(`  ${bunInstallDirectory}`);
		console.log("\nRun the locally packed Bun package CLI from outside the repository:");
		console.log(`  ${join(bunInstallDirectory, process.platform === "win32" ? "pi.cmd" : "pi")} --help`);
	}
}
