/**
 * 文件职责：验证安装方式识别以及 npm、pnpm、yarn、bun 自更新命令的生成规则。
 * 技术维度：使用 Vitest、临时文件系统、伪包管理器脚本和可恢复的 process 全局状态模拟多平台安装布局。
 * 产品维度：确保用户收到适合当前安装来源且可安全执行的升级命令，路径不可写时给出明确指引。
 * 逻辑维度：先构造各包管理器的临时全局安装，再覆盖识别、重命名升级、路径引用和权限边界。
 * 关键边界：用例会临时修改 PATH、PI_PACKAGE_DIR、argv 与 execPath；afterEach 必须完整恢复这些进程状态。
 * 新手阅读建议：先读四个 create*Install 辅助函数，再看 getSelfUpdateCommand 的期望对象及重命名 steps。
 */
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { delimiter, join } from "path";
import { afterEach, describe, expect, test } from "vitest";
import {
	detectInstallMethod,
	getSelfUpdateCommand,
	getSelfUpdateUnavailableInstruction,
	getUpdateInstruction,
} from "../src/config.ts";

/** 测试开始前 process.execPath 的属性描述符，用于恢复只读属性。 */
const execPathDescriptor = Object.getOwnPropertyDescriptor(process, "execPath");
/** 测试开始前的 PATH；可能未定义。 */
const originalPath = process.env.PATH;
/** 测试开始前显式包目录环境变量；可能未定义。 */
const originalPiPackageDir = process.env.PI_PACKAGE_DIR;
/** 测试开始前的入口脚本路径。 */
const originalArgv1 = process.argv[1];
/** 当前用例创建的临时根目录，清理后重置为 undefined。 */
let tempDir: string | undefined;

/** 临时覆盖 Node 可执行路径。参数 value 为模拟路径；无返回值。例如：setExecPath("/usr/bin/node")。 */
function setExecPath(value: string): void {
	Object.defineProperty(process, "execPath", {
		value,
		configurable: true,
	});
}

// 每个用例后恢复进程全局状态，并删除本用例的临时安装目录。
afterEach(() => {
	if (execPathDescriptor) {
		Object.defineProperty(process, "execPath", execPathDescriptor);
	}
	if (originalPath === undefined) {
		delete process.env.PATH;
	} else {
		process.env.PATH = originalPath;
	}
	if (originalPiPackageDir === undefined) {
		delete process.env.PI_PACKAGE_DIR;
	} else {
		process.env.PI_PACKAGE_DIR = originalPiPackageDir;
	}
	if (originalArgv1 === undefined) {
		process.argv.splice(1, 1);
	} else {
		process.argv[1] = originalArgv1;
	}
	if (tempDir) {
		chmodSync(tempDir, 0o700);
		rmSync(tempDir, { recursive: true, force: true });
		tempDir = undefined;
	}
});

/** 创建 npm 自定义 prefix 安装布局。参数 template 为临时目录前缀；返回 prefix 与包目录。例如：createNpmPrefixInstall()。 */
function createNpmPrefixInstall(template = "pi-prefix-"): { prefix: string; packageDir: string } {
	/** npm 全局安装使用的临时 prefix。 */
	const prefix = mkdtempSync(join(tmpdir(), template));
	/** prefix 下的全局 node_modules 根目录。 */
	const root = join(prefix, "lib", "node_modules");
	/** 当前包组织名目录。 */
	const scopeDir = join(root, "@earendil-works");
	/** 模拟 pi-coding-agent 包目录。 */
	const packageDir = join(scopeDir, "pi-coding-agent");
	mkdirSync(packageDir, { recursive: true });
	tempDir = prefix;
	process.env.PI_PACKAGE_DIR = packageDir;
	setExecPath(join(packageDir, "dist", "cli.js"));
	return { prefix, packageDir };
}

/** 创建可被探测的 pnpm 全局安装布局和伪命令。无参数；返回全局根与包目录。例如：createPnpmGlobalInstall()。 */
function createPnpmGlobalInstall(): { root: string; packageDir: string } {
	/** pnpm 测试使用的临时根目录。 */
	const temp = mkdtempSync(join(tmpdir(), "pi-pnpm-"));
	/** 放置伪 pnpm 可执行文件的目录。 */
	const binDir = join(temp, "bin");
	/** 伪 pnpm root -g 返回的全局 node_modules。 */
	const root = join(temp, "pnpm", "global", "5", "node_modules");
	/** 模拟旧作用域包的安装目录。 */
	const packageDir = join(root, "@mariozechner", "pi-coding-agent");
	mkdirSync(packageDir, { recursive: true });
	mkdirSync(binDir, { recursive: true });
	writeFileSync(join(binDir, process.platform === "win32" ? "pnpm.cmd" : "pnpm"), createFakePnpmScript(root));
	chmodSync(join(binDir, process.platform === "win32" ? "pnpm.cmd" : "pnpm"), 0o755);
	tempDir = temp;
	process.env.PATH = `${binDir}${delimiter}${originalPath ?? ""}`;
	process.env.PI_PACKAGE_DIR = packageDir;
	setExecPath(
		join(
			root,
			".pnpm",
			"@mariozechner+pi-coding-agent@0.0.0",
			"node_modules",
			"@mariozechner",
			"pi-coding-agent",
			"dist",
			"cli.js",
		),
	);
	return { root, packageDir };
}

/** 创建 Yarn 全局安装布局和伪命令。无参数；返回全局目录与包目录。例如：createYarnGlobalInstall()。 */
function createYarnGlobalInstall(): { globalDir: string; packageDir: string } {
	/** Yarn 测试使用的临时根目录。 */
	const temp = mkdtempSync(join(tmpdir(), "pi-yarn-"));
	/** 放置伪 yarn 可执行文件的目录。 */
	const binDir = join(temp, "bin");
	/** 伪 yarn global dir 返回的目录。 */
	const globalDir = join(temp, "yarn", "global");
	/** 模拟旧作用域包的安装目录。 */
	const packageDir = join(globalDir, "node_modules", "@mariozechner", "pi-coding-agent");
	mkdirSync(packageDir, { recursive: true });
	mkdirSync(binDir, { recursive: true });
	writeFileSync(join(binDir, process.platform === "win32" ? "yarn.cmd" : "yarn"), createFakeYarnScript(globalDir));
	chmodSync(join(binDir, process.platform === "win32" ? "yarn.cmd" : "yarn"), 0o755);
	tempDir = temp;
	process.env.PATH = `${binDir}${delimiter}${originalPath ?? ""}`;
	process.env.PI_PACKAGE_DIR = packageDir;
	setExecPath(join(globalDir, ".yarn", "@mariozechner", "pi-coding-agent", "dist", "cli.js"));
	return { globalDir, packageDir };
}

/** 创建 Bun 全局安装布局和伪命令。无参数；返回包目录。例如：createBunGlobalInstall()。 */
function createBunGlobalInstall(): { packageDir: string } {
	/** Bun 测试使用的临时根目录。 */
	const temp = mkdtempSync(join(tmpdir(), "pi-bun-"));
	/** 模拟用户 .bun 安装前缀。 */
	const prefix = join(temp, ".bun");
	/** 伪 bun 命令及全局 shim 所在目录。 */
	const bunBin = join(prefix, "bin");
	/** Bun 全局包的 node_modules 根目录。 */
	const root = join(prefix, "install", "global", "node_modules");
	/** 当前包组织名目录。 */
	const scopeDir = join(root, "@earendil-works");
	/** 模拟 pi-coding-agent 包目录。 */
	const packageDir = join(scopeDir, "pi-coding-agent");
	mkdirSync(packageDir, { recursive: true });
	mkdirSync(bunBin, { recursive: true });
	writeFileSync(join(bunBin, process.platform === "win32" ? "bun.cmd" : "bun"), createFakeBunScript(bunBin));
	chmodSync(join(bunBin, process.platform === "win32" ? "bun.cmd" : "bun"), 0o755);
	tempDir = temp;
	process.env.PATH = `${bunBin}${delimiter}${originalPath ?? ""}`;
	process.env.PI_PACKAGE_DIR = packageDir;
	setExecPath(join(packageDir, "dist", "cli.js"));
	return { packageDir };
}

/** 生成只响应 pnpm root -g 的平台脚本。参数 root 为返回路径；返回脚本文本。例如：createFakePnpmScript(root)。 */
function createFakePnpmScript(root: string): string {
	if (process.platform === "win32") {
		return `@echo off\r\nif "%1"=="root" if "%2"=="-g" echo ${root}\r\n`;
	}
	/** 适合嵌入 POSIX 单引号字符串的根目录。 */
	const escapedRoot = root.replaceAll("'", "'\\''");
	return `#!/bin/sh\nif [ "$1" = "root" ] && [ "$2" = "-g" ]; then\n\tprintf '%s\\n' '${escapedRoot}'\n\texit 0\nfi\nexit 1\n`;
}

/** 生成只响应 yarn global dir 的平台脚本。参数 globalDir 为返回路径；返回脚本文本。例如：createFakeYarnScript(dir)。 */
function createFakeYarnScript(globalDir: string): string {
	if (process.platform === "win32") {
		return `@echo off\r\nif "%1"=="global" if "%2"=="dir" echo ${globalDir}\r\n`;
	}
	/** 适合嵌入 POSIX 单引号字符串的 Yarn 全局目录。 */
	const escapedGlobalDir = globalDir.replaceAll("'", "'\\''");
	return `#!/bin/sh\nif [ "$1" = "global" ] && [ "$2" = "dir" ]; then\n\tprintf '%s\\n' '${escapedGlobalDir}'\n\texit 0\nfi\nexit 1\n`;
}

/** 生成只响应 bun pm bin -g 的平台脚本。参数 bunBin 为返回路径；返回脚本文本。例如：createFakeBunScript(dir)。 */
function createFakeBunScript(bunBin: string): string {
	if (process.platform === "win32") {
		return `@echo off\r\nif "%1"=="pm" if "%2"=="bin" if "%3"=="-g" echo ${bunBin}\r\n`;
	}
	/** 适合嵌入 POSIX 单引号字符串的 Bun bin 目录。 */
	const escapedBunBin = bunBin.replaceAll("'", "'\\''");
	return `#!/bin/sh\nif [ "$1" = "pm" ] && [ "$2" = "bin" ] && [ "$3" = "-g" ]; then\n\tprintf '%s\\n' '${escapedBunBin}'\n\texit 0\nfi\nexit 1\n`;
}

describe("detectInstallMethod", () => {
	// Windows 的 .pnpm 存储路径应识别为 pnpm，并生成 pnpm 更新说明。
	test("detects pnpm from Windows .pnpm install paths", () => {
		setExecPath(
			"C:\\Users\\Admin\\Documents\\pnpm-repository\\global\\5\\.pnpm\\@earendil-works+pi-coding-agent@0.67.68\\node_modules\\@earendil-works\\pi-coding-agent\\dist\\cli.js",
		);

		expect(detectInstallMethod()).toBe("pnpm");
		expect(getUpdateInstruction("@earendil-works/pi-coding-agent")).toBe(
			"Run: pnpm install -g --ignore-scripts --config.minimumReleaseAge=0 @earendil-works/pi-coding-agent",
		);
	});

	// 无法识别的包装器安装不应自动更新，应提示用户使用原安装来源。
	test("does not self-update unknown wrapper installs", () => {
		setExecPath("/usr/local/bin/node");

		expect(detectInstallMethod()).toBe("unknown");
		expect(getSelfUpdateCommand("@earendil-works/pi-coding-agent")).toBeUndefined();
		expect(getUpdateInstruction("@earendil-works/pi-coding-agent")).toBe(
			"Update @earendil-works/pi-coding-agent using the package manager, wrapper, or source checkout that provides this installation.",
		);
	});

	// npm 自定义 prefix 应在更新命令中显式保留。
	test("self-updates npm installs from custom prefixes", () => {
		/** 当前模拟 npm 安装的 prefix。 */
		const { prefix } = createNpmPrefixInstall();

		/** 为当前 npm 安装生成的自更新命令。 */
		const command = getSelfUpdateCommand("@earendil-works/pi-coding-agent");

		expect(detectInstallMethod()).toBe("npm");
		expect(command).toEqual({
			command: "npm",
			args: [
				"--prefix",
				prefix,
				"install",
				"-g",
				"--ignore-scripts",
				"--min-release-age=0",
				"@earendil-works/pi-coding-agent",
			],
			display: `npm --prefix ${prefix} install -g --ignore-scripts --min-release-age=0 @earendil-works/pi-coding-agent`,
		});
	});

	// 指定精确新版本时只需安装该版本，不应卸载同名当前包。
	test("self-updates exact npm versions without uninstalling the current package", () => {
		/** 当前模拟 npm 安装的 prefix。 */
		const { prefix } = createNpmPrefixInstall();

		/** 带精确版本安装规格的自更新命令。 */
		const command = getSelfUpdateCommand("@earendil-works/pi-coding-agent", undefined, {
			packageName: "@earendil-works/pi-coding-agent",
			installSpec: "@earendil-works/pi-coding-agent@1.2.3",
		});

		expect(command).toEqual({
			command: "npm",
			args: [
				"--prefix",
				prefix,
				"install",
				"-g",
				"--ignore-scripts",
				"--min-release-age=0",
				"@earendil-works/pi-coding-agent@1.2.3",
			],
			display: `npm --prefix ${prefix} install -g --ignore-scripts --min-release-age=0 @earendil-works/pi-coding-agent@1.2.3`,
		});
	});

	// 包重命名时 npm 更新计划应先卸载旧名再安装新名。
	test("self-updates renamed packages from the current install prefix", () => {
		/** 当前模拟 npm 安装的 prefix。 */
		const { prefix } = createNpmPrefixInstall();

		/** 从旧作用域迁移到新包名的两步更新命令。 */
		const command = getSelfUpdateCommand("@mariozechner/pi-coding-agent", undefined, "@new-scope/pi");

		expect(command).toEqual({
			command: "npm",
			args: ["--prefix", prefix, "install", "-g", "--ignore-scripts", "--min-release-age=0", "@new-scope/pi"],
			display: `npm --prefix ${prefix} uninstall -g @mariozechner/pi-coding-agent && npm --prefix ${prefix} install -g --ignore-scripts --min-release-age=0 @new-scope/pi`,
			steps: [
				{
					command: "npm",
					args: ["--prefix", prefix, "uninstall", "-g", "@mariozechner/pi-coding-agent"],
					display: `npm --prefix ${prefix} uninstall -g @mariozechner/pi-coding-agent`,
				},
				{
					command: "npm",
					args: ["--prefix", prefix, "install", "-g", "--ignore-scripts", "--min-release-age=0", "@new-scope/pi"],
					display: `npm --prefix ${prefix} install -g --ignore-scripts --min-release-age=0 @new-scope/pi`,
				},
			],
		});
	});

	// 显式配置的 npmCommand 应被解析并复用于更新命令。
	test("self-update respects configured npmCommand", () => {
		/** 当前模拟 npm 安装的 prefix。 */
		const { prefix } = createNpmPrefixInstall();

		/** 使用配置 npmCommand 生成的更新命令。 */
		const command = getSelfUpdateCommand("@earendil-works/pi-coding-agent", ["npm", "--prefix", prefix]);

		expect(command).toEqual({
			command: "npm",
			args: [
				"--prefix",
				prefix,
				"install",
				"-g",
				"--ignore-scripts",
				"--min-release-age=0",
				"@earendil-works/pi-coding-agent",
			],
			display: `npm --prefix ${prefix} install -g --ignore-scripts --min-release-age=0 @earendil-works/pi-coding-agent`,
		});
	});

	// 空 npmCommand 等价于未配置，应回退到安装探测结果。
	test("self-update treats empty npmCommand as unset", () => {
		/** 当前模拟 npm 安装的 prefix。 */
		const { prefix } = createNpmPrefixInstall();

		/** 空配置下自动探测生成的更新命令。 */
		const command = getSelfUpdateCommand("@earendil-works/pi-coding-agent", []);

		expect(command?.args).toEqual([
			"--prefix",
			prefix,
			"install",
			"-g",
			"--ignore-scripts",
			"--min-release-age=0",
			"@earendil-works/pi-coding-agent",
		]);
	});

	// 显示命令中的含空格 prefix 必须加引号。
	test("quotes npm self-update display paths", () => {
		/** 路径含空格的模拟 npm prefix。 */
		const { prefix } = createNpmPrefixInstall("pi prefix ");

		/** 应对显示路径加引号的更新命令。 */
		const command = getSelfUpdateCommand("@earendil-works/pi-coding-agent");

		expect(command?.display).toBe(
			`npm --prefix "${prefix}" install -g --ignore-scripts --min-release-age=0 @earendil-works/pi-coding-agent`,
		);
	});

	// Windows 包路径本身不足以可靠推断自定义 npm prefix。
	test("does not infer Windows npm custom prefixes from package paths", () => {
		/** 含空格但不提供可验证 prefix 的 Windows 包目录。 */
		const packageDir = "C:\\Users\\Admin\\npm prefix\\node_modules\\@earendil-works\\pi-coding-agent";
		process.env.PI_PACKAGE_DIR = packageDir;
		setExecPath(`${packageDir}\\dist\\cli.js`);

		expect(detectInstallMethod()).toBe("npm");
		expect(getUpdateInstruction("@earendil-works/pi-coding-agent")).toBe(
			"Run: npm install -g --ignore-scripts --min-release-age=0 @earendil-works/pi-coding-agent",
		);
	});

	// Bun 安装应通过 bun pm bin 探测并生成 bun install -g 命令。
	test("self-updates bun global installs from bun pm bin", () => {
		createBunGlobalInstall();

		/** 为 Bun 全局安装生成的更新命令。 */
		const command = getSelfUpdateCommand("@earendil-works/pi-coding-agent");

		expect(detectInstallMethod()).toBe("bun");
		expect(command).toEqual({
			command: "bun",
			args: ["install", "-g", "--ignore-scripts", "--minimum-release-age=0", "@earendil-works/pi-coding-agent"],
			display: "bun install -g --ignore-scripts --minimum-release-age=0 @earendil-works/pi-coding-agent",
		});
	});

	// pnpm 包重命名升级应先删除旧包再安装新包。
	test("self-updates renamed pnpm global installs by removing the old package first", () => {
		createPnpmGlobalInstall();

		/** pnpm 旧包迁移到新包的两步命令。 */
		const command = getSelfUpdateCommand("@mariozechner/pi-coding-agent", undefined, "@new-scope/pi");

		expect(detectInstallMethod()).toBe("pnpm");
		expect(command).toEqual({
			command: "pnpm",
			args: ["install", "-g", "--ignore-scripts", "--config.minimumReleaseAge=0", "@new-scope/pi"],
			display:
				"pnpm remove -g @mariozechner/pi-coding-agent && pnpm install -g --ignore-scripts --config.minimumReleaseAge=0 @new-scope/pi",
			steps: [
				{
					command: "pnpm",
					args: ["remove", "-g", "@mariozechner/pi-coding-agent"],
					display: "pnpm remove -g @mariozechner/pi-coding-agent",
				},
				{
					command: "pnpm",
					args: ["install", "-g", "--ignore-scripts", "--config.minimumReleaseAge=0", "@new-scope/pi"],
					display: "pnpm install -g --ignore-scripts --config.minimumReleaseAge=0 @new-scope/pi",
				},
			],
		});
	});

	// pnpm v11 从内容寻址 store 执行时仍应定位对应全局安装。
	test("self-updates pnpm v11 global installs resolved through the store", () => {
		/** pnpm v11 测试的临时根目录。 */
		const temp = mkdtempSync(join(tmpdir(), "pi-pnpm11-"));
		/** 放置伪 pnpm 命令的目录。 */
		const binDir = join(temp, "bin");
		/** pnpm v11 全局安装根目录。 */
		const root = join(temp, "Library", "pnpm", "global", "v11");
		/** 被更新的正式包名。 */
		const packageName = "@earendil-works/pi-coding-agent";
		/** 全局项目中指向包的逻辑安装目录。 */
		const globalPackageDir = join(root, "11e9a", "node_modules", "@earendil-works", "pi-coding-agent");
		/** pnpm store 中实际执行代码所在的包目录。 */
		const storePackageDir = join(
			temp,
			"Library",
			"pnpm",
			"store",
			"v11",
			"links",
			"@earendil-works",
			"pi-coding-agent",
			"0.75.0",
			"hash",
			"node_modules",
			"@earendil-works",
			"pi-coding-agent",
		);
		mkdirSync(globalPackageDir, { recursive: true });
		mkdirSync(storePackageDir, { recursive: true });
		mkdirSync(binDir, { recursive: true });
		writeFileSync(join(globalPackageDir, "package.json"), "{}");
		writeFileSync(join(binDir, process.platform === "win32" ? "pnpm.cmd" : "pnpm"), createFakePnpmScript(root));
		chmodSync(join(binDir, process.platform === "win32" ? "pnpm.cmd" : "pnpm"), 0o755);
		tempDir = temp;
		process.env.PATH = `${binDir}${delimiter}${originalPath ?? ""}`;
		process.env.PI_PACKAGE_DIR = storePackageDir;
		process.argv[1] = join(globalPackageDir, "dist", "cli.js");
		setExecPath(join(storePackageDir, "dist", "cli.js"));

		/** 从 store 路径反向识别全局安装后生成的命令。 */
		const command = getSelfUpdateCommand(packageName);

		expect(detectInstallMethod()).toBe("pnpm");
		expect(command).toEqual({
			command: "pnpm",
			args: ["install", "-g", "--ignore-scripts", "--config.minimumReleaseAge=0", packageName],
			display: `pnpm install -g --ignore-scripts --config.minimumReleaseAge=0 ${packageName}`,
		});
	});

	// Yarn 包重命名升级应按全局目录先删旧包再加新包。
	test("self-updates renamed yarn global installs by removing the old package first", () => {
		createYarnGlobalInstall();

		/** Yarn 旧包迁移到新包的两步命令。 */
		const command = getSelfUpdateCommand("@mariozechner/pi-coding-agent", undefined, "@new-scope/pi");

		expect(detectInstallMethod()).toBe("yarn");
		expect(command).toEqual({
			command: "yarn",
			args: ["global", "add", "--ignore-scripts", "@new-scope/pi"],
			display: "yarn global remove @mariozechner/pi-coding-agent && yarn global add --ignore-scripts @new-scope/pi",
			steps: [
				{
					command: "yarn",
					args: ["global", "remove", "@mariozechner/pi-coding-agent"],
					display: "yarn global remove @mariozechner/pi-coding-agent",
				},
				{
					command: "yarn",
					args: ["global", "add", "--ignore-scripts", "@new-scope/pi"],
					display: "yarn global add --ignore-scripts @new-scope/pi",
				},
			],
		});
	});

	// Bun 包重命名升级应先卸载旧包再安装新包。
	test("self-updates renamed bun global installs by removing the old package first", () => {
		createBunGlobalInstall();

		/** Bun 旧包迁移到新包的两步命令。 */
		const command = getSelfUpdateCommand("@mariozechner/pi-coding-agent", undefined, "@new-scope/pi");

		expect(detectInstallMethod()).toBe("bun");
		expect(command).toEqual({
			command: "bun",
			args: ["install", "-g", "--ignore-scripts", "--minimum-release-age=0", "@new-scope/pi"],
			display:
				"bun uninstall -g @mariozechner/pi-coding-agent && bun install -g --ignore-scripts --minimum-release-age=0 @new-scope/pi",
			steps: [
				{
					command: "bun",
					args: ["uninstall", "-g", "@mariozechner/pi-coding-agent"],
					display: "bun uninstall -g @mariozechner/pi-coding-agent",
				},
				{
					command: "bun",
					args: ["install", "-g", "--ignore-scripts", "--minimum-release-age=0", "@new-scope/pi"],
					display: "bun install -g --ignore-scripts --minimum-release-age=0 @new-scope/pi",
				},
			],
		});
	});

	// npm 包目录不可写时禁止自更新，并返回权限说明。
	test("does not self-update when npm install path is not writable", () => {
		/** 将被改为只读的模拟 npm 包目录。 */
		const { packageDir } = createNpmPrefixInstall();
		chmodSync(packageDir, 0o500);

		expect(getSelfUpdateCommand("@earendil-works/pi-coding-agent")).toBeUndefined();
		expect(getSelfUpdateUnavailableInstruction("@earendil-works/pi-coding-agent")).toContain(
			"the install path is not writable",
		);
	});
});
