/**
 * 文件职责：验证包管理命令对本地路径、项目信任、配置覆盖和自更新参数的处理。
 * 技术维度：使用 Vitest、临时文件系统、进程环境替换、伪 npm/pnpm 命令和组件交互进行集成测试。
 * 产品维度：保证用户安装、删除、更新扩展包及执行自更新时路径与信任策略可靠。
 * 逻辑维度：先搭建隔离目录和环境，再覆盖安装/移除、信任、模型刷新、配置切换和自更新。
 * 关键边界：用例会修改 cwd、环境变量、execPath 与退出码，必须在清理阶段完整恢复；部分脚本受平台差异影响。
 * 新手阅读建议：先看 beforeEach/afterEach 的隔离逻辑，再读本地包路径用例，最后看自更新伪命令。
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV_AGENT_DIR, PACKAGE_NAME, VERSION } from "../src/config.ts";
import { ModelRuntime } from "../src/core/model-runtime.ts";
import type { ResolvedPaths } from "../src/core/package-manager.ts";
import { InMemorySettingsStorage, SettingsManager } from "../src/core/settings-manager.ts";
import { ProjectTrustStore } from "../src/core/trust-manager.ts";
import { main } from "../src/main.ts";
import { ConfigSelectorComponent } from "../src/modes/interactive/components/config-selector.ts";
import { handlePackageCommand } from "../src/package-manager-cli.ts";

// 用例分组：集中验证“package commands”相关功能。
describe("package commands", () => {
	/** 变量 tempDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let tempDir: string;
	/** 变量 agentDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let agentDir: string;
	/** 变量 projectDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let projectDir: string;
	/** 变量 packageDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let packageDir: string;
	/** 变量 originalCwd 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let originalCwd: string;
	/** 变量 originalAgentDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let originalAgentDir: string | undefined;
	/** 变量 originalPiPackageDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let originalPiPackageDir: string | undefined;
	/** 变量 originalPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let originalPath: string | undefined;
	/** 变量 originalExitCode 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let originalExitCode: typeof process.exitCode;
	/** 变量 originalExecPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let originalExecPath: string;

	/** getNewerPatchVersion 执行当前测试辅助步骤；参数 无 按签名提供输入，返回值供调用方断言。示例：getNewerPatchVersion()。 */
	function getNewerPatchVersion(): string {
		/** 常量 [major 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const [major = "0", minor = "0", patch = "0"] = VERSION.split(".");
		return `${major}.${minor}.${Number.parseInt(patch, 10) + 1}`;
	}

	/** runPackageCommandDirectly 执行当前测试辅助步骤；参数 args 按签名提供输入，返回值供调用方断言。示例：runPackageCommandDirectly(...)。 */
	async function runPackageCommandDirectly(args: string[]): Promise<void> {
		expect(await handlePackageCommand(args)).toBe(true);
	}

	/** extensionPaths 执行当前测试辅助步骤；参数 无 按签名提供输入，返回值供调用方断言。示例：extensionPaths()。 */
	function extensionPaths(
		packageRoot: string,
		source: string,
		scope: "user" | "project",
		names: string[],
	): ResolvedPaths {
		return {
			extensions: names.map((name) => ({
				path: join(packageRoot, "extensions", name),
				enabled: true,
				metadata: { source, scope, origin: "package", baseDir: packageRoot },
			})),
			skills: [],
			prompts: [],
			themes: [],
		};
	}

	beforeEach(() => {
		tempDir = join(tmpdir(), `pi-package-commands-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		agentDir = join(tempDir, "agent");
		projectDir = join(tempDir, "project");
		packageDir = join(tempDir, "local-package");
		mkdirSync(agentDir, { recursive: true });
		mkdirSync(projectDir, { recursive: true });
		mkdirSync(packageDir, { recursive: true });

		originalCwd = process.cwd();
		originalAgentDir = process.env[ENV_AGENT_DIR];
		originalPiPackageDir = process.env.PI_PACKAGE_DIR;
		originalPath = process.env.PATH;
		originalExitCode = process.exitCode;
		originalExecPath = process.execPath;
		process.exitCode = undefined;
		vi.spyOn(process, "exit").mockImplementation(((code?: string | number | null) => {
			if (code === undefined || code === null || Number(code) === 0) {
				process.exitCode = undefined;
			} else {
				process.exitCode = code;
			}
			return undefined as never;
		}) as typeof process.exit);
		process.env[ENV_AGENT_DIR] = agentDir;
		process.chdir(projectDir);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		process.chdir(originalCwd);
		process.exitCode = originalExitCode;
		if (originalAgentDir === undefined) {
			delete process.env[ENV_AGENT_DIR];
		} else {
			process.env[ENV_AGENT_DIR] = originalAgentDir;
		}
		if (originalPiPackageDir === undefined) {
			delete process.env.PI_PACKAGE_DIR;
		} else {
			process.env.PI_PACKAGE_DIR = originalPiPackageDir;
		}
		if (originalPath === undefined) {
			delete process.env.PATH;
		} else {
			process.env.PATH = originalPath;
		}
		Object.defineProperty(process, "execPath", { value: originalExecPath, configurable: true });
		rmSync(tempDir, { recursive: true, force: true });
	});

	// 测试场景：验证“should persist global relative local package paths relative to settings.json”对应的行为、结果与边界。
	it("should persist global relative local package paths relative to settings.json", async () => {
		/** 常量 relativePkgDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const relativePkgDir = join(projectDir, "packages", "local-package");
		mkdirSync(relativePkgDir, { recursive: true });

		await main(["install", "./packages/local-package"]);

		/** 常量 settingsPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const settingsPath = join(agentDir, "settings.json");
		/** 常量 settings 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const settings = JSON.parse(readFileSync(settingsPath, "utf-8")) as { packages?: string[] };
		expect(settings.packages?.length).toBe(1);
		/** 常量 stored 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const stored = settings.packages?.[0] ?? "";
		/** 常量 resolvedFromSettings 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const resolvedFromSettings = realpathSync(join(agentDir, stored));
		expect(resolvedFromSettings).toBe(realpathSync(relativePkgDir));
	});

	// 测试场景：验证“should remove local packages using a path with a trailing slash”对应的行为、结果与边界。
	it("should remove local packages using a path with a trailing slash", async () => {
		await main(["install", `${packageDir}/`]);

		/** 常量 settingsPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const settingsPath = join(agentDir, "settings.json");
		/** 常量 installedSettings 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const installedSettings = JSON.parse(readFileSync(settingsPath, "utf-8")) as { packages?: string[] };
		expect(installedSettings.packages?.length).toBe(1);

		await main(["remove", `${packageDir}/`]);

		/** 常量 removedSettings 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const removedSettings = JSON.parse(readFileSync(settingsPath, "utf-8")) as { packages?: string[] };
		expect(removedSettings.packages ?? []).toHaveLength(0);
	});

	// 测试场景：验证“skips untrusted project package settings”对应的行为、结果与边界。
	it("skips untrusted project package settings", async () => {
		mkdirSync(join(projectDir, ".pi"), { recursive: true });
		writeFileSync(join(projectDir, ".pi", "settings.json"), JSON.stringify({ packages: ["npm:@project/pkg"] }));
		/** 常量 logSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		try {
			await expect(main(["list"])).resolves.toBeUndefined();

			/** 常量 stdout 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const stdout = logSpy.mock.calls.map(([message]) => String(message)).join("\n");
			expect(stdout).toContain("No packages installed.");
			expect(stdout).not.toContain("Project packages:");
		} finally {
			logSpy.mockRestore();
		}
	});

	// 测试场景：验证“uses remembered project trust for list”对应的行为、结果与边界。
	it("uses remembered project trust for list", async () => {
		mkdirSync(join(projectDir, ".pi"), { recursive: true });
		writeFileSync(join(projectDir, ".pi", "settings.json"), JSON.stringify({ packages: ["npm:@project/pkg"] }));
		new ProjectTrustStore(agentDir).set(projectDir, true);
		/** 常量 logSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		try {
			await expect(main(["list"])).resolves.toBeUndefined();

			/** 常量 stdout 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const stdout = logSpy.mock.calls.map(([message]) => String(message)).join("\n");
			expect(stdout).toContain("Project packages:");
			expect(stdout).toContain("npm:@project/pkg");
			expect(stdout).not.toContain("No packages installed.");
			expect(process.exitCode).toBeUndefined();
		} finally {
			logSpy.mockRestore();
		}
	});

	// 测试场景：验证“overrides remembered trust for list with --no-approve”对应的行为、结果与边界。
	it("overrides remembered trust for list with --no-approve", async () => {
		mkdirSync(join(projectDir, ".pi"), { recursive: true });
		writeFileSync(join(projectDir, ".pi", "settings.json"), JSON.stringify({ packages: ["npm:@project/pkg"] }));
		new ProjectTrustStore(agentDir).set(projectDir, true);
		/** 常量 logSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		try {
			await expect(main(["list", "--no-approve"])).resolves.toBeUndefined();

			/** 常量 stdout 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const stdout = logSpy.mock.calls.map(([message]) => String(message)).join("\n");
			expect(stdout).toContain("No packages installed.");
			expect(stdout).not.toContain("Project packages:");
			expect(process.exitCode).toBeUndefined();
		} finally {
			logSpy.mockRestore();
		}
	});

	// 测试场景：验证“approves project trust for list with --approve”对应的行为、结果与边界。
	it("approves project trust for list with --approve", async () => {
		mkdirSync(join(projectDir, ".pi"), { recursive: true });
		writeFileSync(join(projectDir, ".pi", "settings.json"), JSON.stringify({ packages: ["npm:@project/pkg"] }));
		/** 常量 logSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		try {
			await expect(main(["list", "--approve"])).resolves.toBeUndefined();

			/** 常量 stdout 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const stdout = logSpy.mock.calls.map(([message]) => String(message)).join("\n");
			expect(stdout).toContain("Project packages:");
			expect(stdout).toContain("npm:@project/pkg");
			expect(stdout).not.toContain("No packages installed.");
			expect(process.exitCode).toBeUndefined();
		} finally {
			logSpy.mockRestore();
		}
	});

	// 测试场景：验证“uses default project trust for list”对应的行为、结果与边界。
	it("uses default project trust for list", async () => {
		mkdirSync(join(projectDir, ".pi"), { recursive: true });
		writeFileSync(join(agentDir, "settings.json"), JSON.stringify({ defaultProjectTrust: "always" }));
		writeFileSync(join(projectDir, ".pi", "settings.json"), JSON.stringify({ packages: ["npm:@project/pkg"] }));
		/** 常量 logSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		try {
			await expect(main(["list"])).resolves.toBeUndefined();

			/** 常量 stdout 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const stdout = logSpy.mock.calls.map(([message]) => String(message)).join("\n");
			expect(stdout).toContain("Project packages:");
			expect(stdout).toContain("npm:@project/pkg");
			expect(stdout).not.toContain("No packages installed.");
			expect(process.exitCode).toBeUndefined();
		} finally {
			logSpy.mockRestore();
		}
	});

	// 测试场景：验证“uses project_trust extensions for package commands”对应的行为、结果与边界。
	it("uses project_trust extensions for package commands", async () => {
		mkdirSync(join(projectDir, ".pi"), { recursive: true });
		writeFileSync(join(projectDir, ".pi", "settings.json"), JSON.stringify({ packages: ["npm:@project/pkg"] }));
		/** 常量 logSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		try {
			await expect(
				main(["list"], {
					extensionFactories: [
						(pi) => {
							pi.on("project_trust", () => ({ trusted: "yes" }));
						},
					],
				}),
			).resolves.toBeUndefined();

			/** 常量 stdout 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const stdout = logSpy.mock.calls.map(([message]) => String(message)).join("\n");
			expect(stdout).toContain("Project packages:");
			expect(stdout).toContain("npm:@project/pkg");
			expect(stdout).not.toContain("No packages installed.");
			expect(process.exitCode).toBeUndefined();
		} finally {
			logSpy.mockRestore();
		}
	});

	// 测试场景：验证“does not prompt or ask extensions for project trust during update”对应的行为、结果与边界。
	it("does not prompt or ask extensions for project trust during update", async () => {
		mkdirSync(join(projectDir, ".pi"), { recursive: true });
		writeFileSync(join(agentDir, "settings.json"), JSON.stringify({ defaultProjectTrust: "always" }));
		/** 常量 fakeNpmPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeNpmPath = join(tempDir, "fake-project-npm.cjs");
		/** 常量 recordPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const recordPath = join(tempDir, "project-update.json");
		writeFileSync(
			fakeNpmPath,
			`const fs=require("node:fs");fs.writeFileSync(${JSON.stringify(recordPath)},JSON.stringify(process.argv.slice(2)));`,
		);
		writeFileSync(
			join(projectDir, ".pi", "settings.json"),
			JSON.stringify({ packages: ["npm:fake-package"], npmCommand: [originalExecPath, fakeNpmPath] }),
		);
		/** 变量 projectTrustCalled 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let projectTrustCalled = false;
		/** 常量 logSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		try {
			await expect(
				main(["update", "--extensions"], {
					extensionFactories: [
						(pi) => {
							pi.on("project_trust", () => {
								projectTrustCalled = true;
								return { trusted: "yes" };
							});
						},
					],
				}),
			).resolves.toBeUndefined();

			expect(projectTrustCalled).toBe(false);
			expect(existsSync(recordPath)).toBe(false);
			expect(process.exitCode).toBeUndefined();
		} finally {
			logSpy.mockRestore();
		}
	});

	// 测试场景：验证“uses saved project trust during update”对应的行为、结果与边界。
	it("uses saved project trust during update", async () => {
		mkdirSync(join(projectDir, ".pi"), { recursive: true });
		/** 常量 fakeNpmPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeNpmPath = join(tempDir, "fake-trusted-project-npm.cjs");
		/** 常量 recordPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const recordPath = join(tempDir, "trusted-project-update.json");
		writeFileSync(
			fakeNpmPath,
			`const fs=require("node:fs");fs.writeFileSync(${JSON.stringify(recordPath)},JSON.stringify(process.argv.slice(2)));`,
		);
		writeFileSync(
			join(projectDir, ".pi", "settings.json"),
			JSON.stringify({ packages: ["npm:fake-package"], npmCommand: [originalExecPath, fakeNpmPath] }),
		);
		new ProjectTrustStore(agentDir).set(projectDir, true);
		/** 常量 logSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		try {
			await expect(main(["update", "--extensions"])).resolves.toBeUndefined();

			expect(existsSync(recordPath)).toBe(true);
			expect(process.exitCode).toBeUndefined();
		} finally {
			logSpy.mockRestore();
		}
	});

	// 测试场景：验证“lets trust.json override default project trust”对应的行为、结果与边界。
	it("lets trust.json override default project trust", async () => {
		mkdirSync(join(projectDir, ".pi"), { recursive: true });
		writeFileSync(join(agentDir, "settings.json"), JSON.stringify({ defaultProjectTrust: "always" }));
		writeFileSync(join(projectDir, ".pi", "settings.json"), JSON.stringify({ packages: ["npm:@project/pkg"] }));
		new ProjectTrustStore(agentDir).set(projectDir, false);
		/** 常量 logSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		try {
			await expect(main(["list"])).resolves.toBeUndefined();

			/** 常量 stdout 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const stdout = logSpy.mock.calls.map(([message]) => String(message)).join("\n");
			expect(stdout).toContain("No packages installed.");
			expect(stdout).not.toContain("Project packages:");
			expect(process.exitCode).toBeUndefined();
		} finally {
			logSpy.mockRestore();
		}
	});

	// 测试场景：验证“blocks local package changes when project is untrusted”对应的行为、结果与边界。
	it("blocks local package changes when project is untrusted", async () => {
		mkdirSync(join(projectDir, ".pi"), { recursive: true });
		writeFileSync(join(projectDir, ".pi", "settings.json"), "{}");
		/** 常量 errorSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		try {
			await expect(main(["install", "-l", "./local-package"])).resolves.toBeUndefined();

			/** 常量 stderr 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const stderr = errorSpy.mock.calls.map(([message]) => String(message)).join("\n");
			expect(stderr).toContain("Project is not trusted. Use --approve to modify local package config.");
			expect(process.exitCode).toBe(1);
		} finally {
			errorSpy.mockRestore();
		}
	});

	// 测试场景：验证“allows local package install to initialize fresh project settings”对应的行为、结果与边界。
	it("allows local package install to initialize fresh project settings", async () => {
		await main(["install", "-l", packageDir]);

		/** 常量 settingsPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const settingsPath = join(projectDir, ".pi", "settings.json");
		/** 常量 settings 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const settings = JSON.parse(readFileSync(settingsPath, "utf-8")) as { packages?: string[] };
		expect(settings.packages?.length).toBe(1);
		/** 常量 stored 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const stored = settings.packages?.[0] ?? "";
		expect(realpathSync(join(projectDir, ".pi", stored))).toBe(realpathSync(packageDir));
		expect(process.exitCode).toBeUndefined();
	});

	// 测试场景：验证“shows install subcommand help”对应的行为、结果与边界。
	it("shows install subcommand help", async () => {
		/** 常量 logSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		/** 常量 errorSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		try {
			await expect(main(["install", "--help"])).resolves.toBeUndefined();

			/** 常量 stdout 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const stdout = logSpy.mock.calls.map(([message]) => String(message)).join("\n");
			expect(stdout).toContain("Usage:");
			expect(stdout).toContain("pi install <source> [-l]");
			expect(errorSpy).not.toHaveBeenCalled();
			expect(process.exitCode).toBeUndefined();
		} finally {
			logSpy.mockRestore();
			errorSpy.mockRestore();
		}
	});

	// 测试场景：验证“refreshes only model catalogs with update --models”对应的行为、结果与边界。
	it("refreshes only model catalogs with update --models", async () => {
		/** 常量 refresh 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const refresh = vi.fn(async () => ({ aborted: false, errors: new Map<string, Error>() }));
		/** 常量 create 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const create = vi.spyOn(ModelRuntime, "create").mockResolvedValue({ refresh } as unknown as ModelRuntime);
		/** 常量 logSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		/** 常量 errorSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		await expect(runPackageCommandDirectly(["update", "--models"])).resolves.toBeUndefined();

		expect(create).toHaveBeenCalledWith({
			authPath: join(agentDir, "auth.json"),
			modelsPath: join(agentDir, "models.json"),
			allowModelNetwork: false,
		});
		expect(refresh).toHaveBeenCalledWith({
			allowNetwork: true,
			force: true,
			signal: expect.any(AbortSignal),
		});
		expect(logSpy.mock.calls.map(([message]) => String(message)).join("\n")).toContain("Model catalogs refreshed");
		expect(errorSpy).not.toHaveBeenCalled();
		expect(process.exitCode).toBeUndefined();
	});

	// 测试场景：验证“rejects update --models combined with another update target”对应的行为、结果与边界。
	it("rejects update --models combined with another update target", async () => {
		/** 常量 create 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const create = vi.spyOn(ModelRuntime, "create");
		/** 常量 errorSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		await expect(runPackageCommandDirectly(["update", "--models", "--self"])).resolves.toBeUndefined();

		expect(create).not.toHaveBeenCalled();
		expect(errorSpy.mock.calls.map(([message]) => String(message)).join("\n")).toContain(
			"--models cannot be combined with --self",
		);
		expect(process.exitCode).toBe(1);
	});

	// 测试场景：验证“cycles project package overrides in config local mode”对应的行为、结果与边界。
	it("cycles project package overrides in config local mode", async () => {
		/** 常量 storage 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const storage = new InMemorySettingsStorage();
		storage.withLock("global", () => JSON.stringify({ packages: ["npm:pi-tools"] }));
		/** 常量 settingsManager 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const settingsManager = SettingsManager.fromStorage(storage, { projectTrusted: true });
		/** 常量 resolvedPaths 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const resolvedPaths = extensionPaths(join(tempDir, "pkg"), "npm:pi-tools", "user", ["bar.ts"]);
		/** 常量 selector 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const selector = new ConfigSelectorComponent(
			{ global: resolvedPaths, project: resolvedPaths },
			settingsManager,
			projectDir,
			agentDir,
			() => {},
			() => {},
			() => {},
			24,
			"project",
		);

		selector.getResourceList().handleInput(" ");
		expect(settingsManager.getProjectSettings().packages).toEqual([
			{ source: "npm:pi-tools", autoload: false, extensions: ["-extensions/bar.ts"] },
		]);

		selector.getResourceList().handleInput(" ");
		expect(settingsManager.getProjectSettings().packages).toEqual([
			{ source: "npm:pi-tools", autoload: false, extensions: ["+extensions/bar.ts"] },
		]);

		selector.getResourceList().handleInput(" ");
		expect(settingsManager.getProjectSettings().packages).toEqual([]);
	});

	// 测试场景：验证“shows a friendly error for unknown install options”对应的行为、结果与边界。
	it("shows a friendly error for unknown install options", async () => {
		/** 常量 errorSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		try {
			await expect(main(["install", "--unknown"])).resolves.toBeUndefined();

			/** 常量 stderr 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const stderr = errorSpy.mock.calls.map(([message]) => String(message)).join("\n");
			expect(stderr).toContain('Unknown option --unknown for "install".');
			expect(stderr).toContain('Use "pi --help" or "pi install <source> [-l] [--approve|--no-approve]".');
			expect(process.exitCode).toBe(1);
		} finally {
			errorSpy.mockRestore();
		}
	});

	// 测试场景：验证“shows a friendly error for missing install source”对应的行为、结果与边界。
	it("shows a friendly error for missing install source", async () => {
		/** 常量 errorSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		try {
			await expect(main(["install"])).resolves.toBeUndefined();

			/** 常量 stderr 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const stderr = errorSpy.mock.calls.map(([message]) => String(message)).join("\n");
			expect(stderr).toContain("Missing install source.");
			expect(stderr).toContain("Usage: pi install <source> [-l]");
			expect(stderr).not.toContain("at ");
			expect(process.exitCode).toBe(1);
		} finally {
			errorSpy.mockRestore();
		}
	});

	// 测试场景：验证“allows explicit self-update checks when automatic version checks are disabled”对应的行为、结果与边界。
	it("allows explicit self-update checks when automatic version checks are disabled", async () => {
		/** 常量 previousSkipVersionCheck 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const previousSkipVersionCheck = process.env.PI_SKIP_VERSION_CHECK;
		process.env.PI_SKIP_VERSION_CHECK = "1";
		/** 常量 fetchMock 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fetchMock = vi.fn(async () => Response.json({ version: VERSION }));
		vi.stubGlobal("fetch", fetchMock);
		/** 常量 logSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		/** 常量 errorSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		try {
			await expect(runPackageCommandDirectly(["update", "--self"])).resolves.toBeUndefined();

			expect(fetchMock).toHaveBeenCalledOnce();
			expect(logSpy.mock.calls.map(([message]) => String(message)).join("\n")).toContain(
				`pi is already up to date (v${VERSION})`,
			);
			expect(errorSpy).not.toHaveBeenCalled();
			expect(process.exitCode).toBeUndefined();
		} finally {
			if (previousSkipVersionCheck === undefined) {
				delete process.env.PI_SKIP_VERSION_CHECK;
			} else {
				process.env.PI_SKIP_VERSION_CHECK = previousSkipVersionCheck;
			}
		}
	});

	// 测试场景：验证“uses the update check version for forced self updates even when current”对应的行为、结果与边界。
	it("uses the update check version for forced self updates even when current", async () => {
		/** 常量 globalPrefix 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const globalPrefix = join(tempDir, "global-prefix");
		/** 常量 projectPrefix 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const projectPrefix = join(tempDir, "project-prefix");
		/** 常量 selfPackageDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const selfPackageDir = join(globalPrefix, "lib", "node_modules", "@earendil-works", "pi-coding-agent");
		/** 常量 fakeNpmPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeNpmPath = join(tempDir, "fake-npm.cjs");
		/** 常量 recordPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const recordPath = join(tempDir, "self-update.json");
		mkdirSync(selfPackageDir, { recursive: true });
		mkdirSync(join(projectDir, ".pi"), { recursive: true });
		writeFileSync(
			fakeNpmPath,
			`const fs=require("node:fs"),path=require("node:path"),args=process.argv.slice(2),prefix=args[args.indexOf("--prefix")+1];
if(args.includes("root")) console.log(path.join(prefix,"lib","node_modules"));
else fs.writeFileSync(${JSON.stringify(recordPath)},JSON.stringify(args));
`,
		);
		writeFileSync(
			join(agentDir, "settings.json"),
			JSON.stringify({ npmCommand: [originalExecPath, fakeNpmPath, "--prefix", globalPrefix] }, null, 2),
		);
		writeFileSync(
			join(projectDir, ".pi", "settings.json"),
			JSON.stringify({ npmCommand: [originalExecPath, fakeNpmPath, "--prefix", projectPrefix] }, null, 2),
		);
		process.env.PI_PACKAGE_DIR = selfPackageDir;
		Object.defineProperty(process, "execPath", {
			value: join(selfPackageDir, "dist", "cli.js"),
			configurable: true,
		});
		/** 常量 fetchMock 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fetchMock = vi.fn(async () => Response.json({ version: VERSION }));
		vi.stubGlobal("fetch", fetchMock);

		/** 常量 logSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		/** 常量 errorSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		try {
			await expect(runPackageCommandDirectly(["update", "--self", "--force"])).resolves.toBeUndefined();

			expect(process.exitCode).toBeUndefined();
			expect(errorSpy).not.toHaveBeenCalled();
			expect(fetchMock).toHaveBeenCalledOnce();
			/** 常量 stdout 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const stdout = logSpy.mock.calls.map(([message]) => String(message)).join("\n");
			/** 常量 recordedArgs 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const recordedArgs = JSON.parse(readFileSync(recordPath, "utf-8")) as string[];
			expect(recordedArgs).toContain(globalPrefix);
			expect(recordedArgs).toContain(`${PACKAGE_NAME}@${VERSION}`);
			expect(recordedArgs).not.toContain(PACKAGE_NAME);
			expect(recordedArgs).not.toContain(projectPrefix);
			expect(stdout).toContain(`Updated pi from ${VERSION} to ${VERSION}`);
		} finally {
			logSpy.mockRestore();
			errorSpy.mockRestore();
		}
	});

	// 测试场景：验证“uses the current package name when the update check omits packageName”对应的行为、结果与边界。
	it("uses the current package name when the update check omits packageName", async () => {
		/** 常量 globalPrefix 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const globalPrefix = join(tempDir, "global-prefix");
		/** 常量 selfPackageDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const selfPackageDir = join(globalPrefix, "lib", "node_modules", "@mariozechner", "pi-coding-agent");
		/** 常量 fakeNpmPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeNpmPath = join(tempDir, "fake-npm.cjs");
		/** 常量 recordPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const recordPath = join(tempDir, "self-update.json");
		mkdirSync(selfPackageDir, { recursive: true });
		writeFileSync(
			fakeNpmPath,
			`const fs=require("node:fs"),path=require("node:path"),args=process.argv.slice(2),prefix=args[args.indexOf("--prefix")+1];
if(args.includes("root")) console.log(path.join(prefix,"lib","node_modules"));
else fs.writeFileSync(${JSON.stringify(recordPath)},JSON.stringify(args));
`,
		);
		writeFileSync(
			join(agentDir, "settings.json"),
			JSON.stringify({ npmCommand: [originalExecPath, fakeNpmPath, "--prefix", globalPrefix] }, null, 2),
		);
		process.env.PI_PACKAGE_DIR = selfPackageDir;
		Object.defineProperty(process, "execPath", {
			value: join(selfPackageDir, "dist", "cli.js"),
			configurable: true,
		});
		/** 常量 targetVersion 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const targetVersion = getNewerPatchVersion();
		/** 常量 fetchMock 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fetchMock = vi.fn(async () => Response.json({ version: targetVersion }));
		vi.stubGlobal("fetch", fetchMock);

		/** 常量 logSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		/** 常量 errorSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		try {
			await expect(runPackageCommandDirectly(["update", "--self"])).resolves.toBeUndefined();

			expect(process.exitCode).toBeUndefined();
			expect(errorSpy).not.toHaveBeenCalled();
			expect(fetchMock).toHaveBeenCalledOnce();
			/** 常量 stdout 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const stdout = logSpy.mock.calls.map(([message]) => String(message)).join("\n");
			/** 常量 recordedArgs 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const recordedArgs = JSON.parse(readFileSync(recordPath, "utf-8")) as string[];
			expect(recordedArgs).toContain(`${PACKAGE_NAME}@${targetVersion}`);
			expect(recordedArgs).not.toContain(PACKAGE_NAME);
			expect(stdout).toContain(`Updated pi from ${VERSION} to ${targetVersion}`);
		} finally {
			logSpy.mockRestore();
			errorSpy.mockRestore();
		}
	});

	// 测试场景：验证“installs the active package name from the update check during self-update”对应的行为、结果与边界。
	it("installs the active package name from the update check during self-update", async () => {
		/** 常量 globalPrefix 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const globalPrefix = join(tempDir, "global-prefix");
		/** 常量 selfPackageDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const selfPackageDir = join(globalPrefix, "lib", "node_modules", "@mariozechner", "pi-coding-agent");
		/** 常量 fakeNpmPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeNpmPath = join(tempDir, "fake-npm.cjs");
		/** 常量 recordPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const recordPath = join(tempDir, "self-update.json");
		mkdirSync(selfPackageDir, { recursive: true });
		writeFileSync(
			fakeNpmPath,
			`const fs=require("node:fs"),path=require("node:path"),args=process.argv.slice(2),prefix=args[args.indexOf("--prefix")+1];
if(args.includes("root")) console.log(path.join(prefix,"lib","node_modules"));
else {
	const records=fs.existsSync(${JSON.stringify(recordPath)})?JSON.parse(fs.readFileSync(${JSON.stringify(recordPath)},"utf-8")):[];
	records.push(args);
	fs.writeFileSync(${JSON.stringify(recordPath)},JSON.stringify(records));
}
`,
		);
		writeFileSync(
			join(agentDir, "settings.json"),
			JSON.stringify({ npmCommand: [originalExecPath, fakeNpmPath, "--prefix", globalPrefix] }, null, 2),
		);
		process.env.PI_PACKAGE_DIR = selfPackageDir;
		Object.defineProperty(process, "execPath", {
			value: join(selfPackageDir, "dist", "cli.js"),
			configurable: true,
		});
		/** 常量 activePackageName 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const activePackageName = PACKAGE_NAME === "@new-scope/pi" ? "@newer-scope/pi" : "@new-scope/pi";
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => Response.json({ packageName: activePackageName, version: "0.73.0" })),
		);

		/** 常量 logSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		/** 常量 errorSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		try {
			await expect(runPackageCommandDirectly(["update", "--self"])).resolves.toBeUndefined();

			expect(process.exitCode).toBeUndefined();
			expect(errorSpy).not.toHaveBeenCalled();
			/** 常量 recordedCalls 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const recordedCalls = JSON.parse(readFileSync(recordPath, "utf-8")) as string[][];
			expect(recordedCalls).toEqual([
				expect.arrayContaining(["uninstall", "-g", PACKAGE_NAME]),
				expect.arrayContaining(["install", "-g", `${activePackageName}@0.73.0`]),
			]);
		} finally {
			logSpy.mockRestore();
			errorSpy.mockRestore();
		}
	});

	// 测试场景：验证“prints a pnpm metadata hint when self-update fails”对应的行为、结果与边界。
	it("prints a pnpm metadata hint when self-update fails", async () => {
		/** 常量 globalRoot 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const globalRoot = join(tempDir, "pnpm", "global", "v11");
		/** 常量 selfPackageDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const selfPackageDir = join(globalRoot, "node_modules", "@earendil-works", "pi-coding-agent");
		/** 常量 fakeBinDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeBinDir = join(tempDir, "bin");
		/** 常量 fakePnpmPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakePnpmPath = join(fakeBinDir, process.platform === "win32" ? "pnpm.cmd" : "pnpm");
		mkdirSync(selfPackageDir, { recursive: true });
		mkdirSync(fakeBinDir, { recursive: true });
		writeFileSync(join(selfPackageDir, "package.json"), JSON.stringify({ name: PACKAGE_NAME, version: VERSION }));
		/** 常量 fakePnpmScript 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakePnpmScript =
			process.platform === "win32"
				? `@echo off\r\nif "%1"=="root" if "%2"=="-g" (echo ${globalRoot} & exit /b 0)\r\nexit /b 23\r\n`
				: `#!/bin/sh\nif [ "$1" = "root" ] && [ "$2" = "-g" ]; then\n\tprintf '%s\\n' '${globalRoot.replaceAll("'", "'\\''")}'\n\texit 0\nfi\nexit 23\n`;
		writeFileSync(fakePnpmPath, fakePnpmScript);
		chmodSync(fakePnpmPath, 0o755);
		process.env.PATH = `${fakeBinDir}${process.env.PATH ? `${delimiter}${process.env.PATH}` : ""}`;
		process.env.PI_PACKAGE_DIR = selfPackageDir;
		Object.defineProperty(process, "execPath", {
			value: join(tempDir, "pnpm", "bin", "node"),
			configurable: true,
		});
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => Response.json({ version: getNewerPatchVersion() })),
		);

		/** 常量 logSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		/** 常量 errorSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		try {
			await expect(runPackageCommandDirectly(["update", "--self"])).resolves.toBeUndefined();

			expect(process.exitCode).toBe(1);
			/** 常量 stdout 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const stdout = logSpy.mock.calls.map(([message]) => String(message)).join("\n");
			/** 常量 stderr 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const stderr = errorSpy.mock.calls.map(([message]) => String(message)).join("\n");
			expect(stdout).not.toContain("Updated pi");
			expect(stderr).toContain("exited with code 23");
			expect(stderr).toContain("If pnpm reports missing package versions");
			expect(stderr).toContain("Run `pnpm store prune` and retry `pi update --self`.");
		} finally {
			logSpy.mockRestore();
			errorSpy.mockRestore();
		}
	});

	// 测试场景：验证“fails self-update when renamed npm package installation fails”对应的行为、结果与边界。
	it("fails self-update when renamed npm package installation fails", async () => {
		/** 常量 globalPrefix 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const globalPrefix = join(tempDir, "global-prefix");
		/** 常量 selfPackageDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const selfPackageDir = join(globalPrefix, "lib", "node_modules", "@mariozechner", "pi-coding-agent");
		/** 常量 fakeNpmPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeNpmPath = join(tempDir, "fake-npm-fail.cjs");
		/** 常量 recordPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const recordPath = join(tempDir, "self-update-fail.json");
		mkdirSync(selfPackageDir, { recursive: true });
		writeFileSync(
			fakeNpmPath,
			`const fs=require("node:fs"),path=require("node:path"),args=process.argv.slice(2),prefix=args[args.indexOf("--prefix")+1];
if(args.includes("root")) {
	console.log(path.join(prefix,"lib","node_modules"));
	process.exit(0);
}
const records=fs.existsSync(${JSON.stringify(recordPath)})?JSON.parse(fs.readFileSync(${JSON.stringify(recordPath)},"utf-8")):[];
records.push(args);
fs.writeFileSync(${JSON.stringify(recordPath)},JSON.stringify(records));
if(args.includes("install")) process.exit(23);
`,
		);
		writeFileSync(
			join(agentDir, "settings.json"),
			JSON.stringify({ npmCommand: [originalExecPath, fakeNpmPath, "--prefix", globalPrefix] }, null, 2),
		);
		process.env.PI_PACKAGE_DIR = selfPackageDir;
		Object.defineProperty(process, "execPath", {
			value: join(selfPackageDir, "dist", "cli.js"),
			configurable: true,
		});
		/** 常量 activePackageName 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const activePackageName = PACKAGE_NAME === "@new-scope/pi" ? "@newer-scope/pi" : "@new-scope/pi";
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => Response.json({ packageName: activePackageName, version: "0.73.0" })),
		);

		/** 常量 logSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		/** 常量 errorSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		try {
			await expect(runPackageCommandDirectly(["update", "--self"])).resolves.toBeUndefined();

			expect(process.exitCode).toBe(1);
			/** 常量 stdout 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const stdout = logSpy.mock.calls.map(([message]) => String(message)).join("\n");
			/** 常量 stderr 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const stderr = errorSpy.mock.calls.map(([message]) => String(message)).join("\n");
			expect(stdout).not.toContain(`Updated pi`);
			expect(stderr).toContain("exited with code 23");
			/** 常量 recordedCalls 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const recordedCalls = JSON.parse(readFileSync(recordPath, "utf-8")) as string[][];
			expect(recordedCalls).toEqual([
				expect.arrayContaining(["uninstall", "-g", PACKAGE_NAME]),
				expect.arrayContaining(["install", "-g", `${activePackageName}@0.73.0`]),
			]);
		} finally {
			logSpy.mockRestore();
			errorSpy.mockRestore();
		}
	});

	// 测试场景：验证“suggests the configured source when update input omits the npm prefix”对应的行为、结果与边界。
	it("suggests the configured source when update input omits the npm prefix", async () => {
		/** 常量 settingsPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const settingsPath = join(agentDir, "settings.json");
		writeFileSync(settingsPath, JSON.stringify({ packages: ["npm:pi-formatter"] }, null, 2));

		/** 常量 errorSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		/** 常量 logSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		try {
			await expect(main(["update", "pi-formatter"])).resolves.toBeUndefined();

			/** 常量 stderr 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const stderr = errorSpy.mock.calls.map(([message]) => String(message)).join("\n");
			/** 常量 stdout 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const stdout = logSpy.mock.calls.map(([message]) => String(message)).join("\n");
			expect(stderr).toContain("Did you mean npm:pi-formatter?");
			expect(stdout).not.toContain("Updated pi-formatter");
			expect(process.exitCode).toBe(1);

			/** 常量 settings 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const settings = JSON.parse(readFileSync(settingsPath, "utf-8")) as { packages?: string[] };
			expect(settings.packages).toContain("npm:pi-formatter");
		} finally {
			errorSpy.mockRestore();
			logSpy.mockRestore();
		}
	});
});
