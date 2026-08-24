/**
 * 文件职责：全面验证 DefaultPackageManager 对本地、npm、Git 包以及扩展、技能、提示词和主题资源的发现、安装、过滤与更新。
 * 技术维度：使用 Vitest、临时文件系统、进程与流替身、SettingsManager，并跨平台检查路径归一化、符号链接和命令参数。
 * 产品维度：保障用户安装或配置扩展包时资源能正确加载、去重、启停和更新，同时支持离线模式与多种包管理器。
 * 逻辑维度：先测试资源解析和自动发现，再覆盖 npm/Git 命令与来源语法，随后验证过滤优先级、去重、多文件扩展及更新流程。
 * 关键边界：用例会创建和递归删除独立临时目录，并临时修改 HOME、PI_OFFLINE 等环境变量；真实网络命令应由 mock 隔离。
 * 新手阅读建议：先读测试夹具与 resolve 基础场景，再看来源解析和安装命令；理解 !、+、- 过滤规则后，最后阅读离线与批量更新测试。
 */
import { EventEmitter } from "node:events";
import { mkdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DefaultPackageManager, type ProgressEvent, type ResolvedResource } from "../src/core/package-manager.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";

/** normalizeForMatch 执行当前测试辅助步骤；参数 value 按签名提供输入，返回值供调用方断言。示例：normalizeForMatch(...)。 */
function normalizeForMatch(value: string): string {
	return value.replace(/\\/g, "/");
}

/** pathEndsWith 执行当前测试辅助步骤；参数 actualPath、suffix 按签名提供输入，返回值供调用方断言。示例：pathEndsWith(..., ...)。 */
function pathEndsWith(actualPath: string, suffix: string): boolean {
	return normalizeForMatch(actualPath).endsWith(normalizeForMatch(suffix));
}

/**
 * 模拟子进程的标准输出、标准错误和关闭事件，供命令捕获测试精确控制事件顺序。
 * 使用场景：验证实现必须等待 close，而不能在较早的 exit 事件出现时提前返回。
 */
class MockSpawnedProcess extends EventEmitter {
	/** 模拟子进程标准输出流；测试可写入任意文本并主动结束。 */
	stdout = new PassThrough();
	/** 模拟子进程标准错误流；取值为可写的内存 PassThrough。 */
	stderr = new PassThrough();

	/** 模拟终止子进程并发出 close；无参数，成功时返回 true。示例：child.kill()。 */
	kill(): boolean {
		this.emit("close", null, "SIGTERM");
		return true;
	}
}

interface PackageManagerInternals {
	runCommand(command: string, args: string[], options?: { cwd?: string }): Promise<void>;
	runCommandCapture(
		command: string,
		args: string[],
		options?: { cwd?: string; timeoutMs?: number; env?: Record<string, string> },
	): Promise<string>;
	getLocalGitUpdateTarget(installedPath: string): Promise<{ ref: string; head: string; fetchArgs: string[] }>;
	parseSource(
		source: string,
	):
		| { type: "npm"; spec: string; name: string; pinned: boolean }
		| { type: "git"; repo: string; host: string; path: string; pinned: boolean; ref?: string }
		| { type: "local"; path: string };
	getNpmInstallPath(
		source: { type: "npm"; spec: string; name: string; pinned: boolean },
		scope: "user" | "project" | "temporary",
	): string;
	getGitInstallPath(
		source: { type: "git"; repo: string; host: string; path: string; pinned: boolean; ref?: string },
		scope: "user" | "project" | "temporary",
	): string;
}

// Helper to check if a resource is enabled
// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
const isEnabled = (r: ResolvedResource, pathMatch: string, matchFn: "endsWith" | "includes" = "endsWith") => {
	/** 常量 normalizedPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const normalizedPath = normalizeForMatch(r.path);
	/** 常量 normalizedMatch 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const normalizedMatch = normalizeForMatch(pathMatch);
	return matchFn === "endsWith"
		? normalizedPath.endsWith(normalizedMatch) && r.enabled
		: normalizedPath.includes(normalizedMatch) && r.enabled;
};

/** isDisabled 封装当前回调或辅助步骤；参数 r: ResolvedResource、pathMatch: string、matchFn: "endsWith" | "includes" = "endsWith" 提供输入，返回值用于后续流程。示例：isDisabled(..., ..., ...)。 */
const isDisabled = (r: ResolvedResource, pathMatch: string, matchFn: "endsWith" | "includes" = "endsWith") => {
	/** 常量 normalizedPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const normalizedPath = normalizeForMatch(r.path);
	/** 常量 normalizedMatch 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const normalizedMatch = normalizeForMatch(pathMatch);
	return matchFn === "endsWith"
		? normalizedPath.endsWith(normalizedMatch) && !r.enabled
		: normalizedPath.includes(normalizedMatch) && !r.enabled;
};

// 用例分组：集中验证“DefaultPackageManager”相关功能。
describe("DefaultPackageManager", () => {
	/** 变量 tempDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let tempDir: string;
	/** 变量 agentDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let agentDir: string;
	/** 变量 settingsManager 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let settingsManager: SettingsManager;
	/** 变量 packageManager 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let packageManager: DefaultPackageManager;
	/** 变量 previousOfflineEnv 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let previousOfflineEnv: string | undefined;

	beforeEach(() => {
		previousOfflineEnv = process.env.PI_OFFLINE;
		delete process.env.PI_OFFLINE;
		tempDir = join(tmpdir(), `pm-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		mkdirSync(tempDir, { recursive: true });
		agentDir = join(tempDir, "agent");
		mkdirSync(agentDir, { recursive: true });

		settingsManager = SettingsManager.inMemory();
		packageManager = new DefaultPackageManager({
			cwd: tempDir,
			agentDir,
			settingsManager,
		});
	});

	afterEach(() => {
		if (previousOfflineEnv === undefined) {
			delete process.env.PI_OFFLINE;
		} else {
			process.env.PI_OFFLINE = previousOfflineEnv;
		}
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		rmSync(tempDir, { recursive: true, force: true });
	});

	// 用例分组：集中验证“resolve”相关功能。
	describe("resolve", () => {
		// 测试场景：验证“should return no package-sourced paths when no sources configured”对应的行为、结果与边界。
		it("should return no package-sourced paths when no sources configured", async () => {
			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			expect(result.extensions).toEqual([]);
			expect(result.prompts).toEqual([]);
			expect(result.themes).toEqual([]);
			expect(result.skills.every((r) => r.metadata.source === "auto" && r.metadata.origin === "top-level")).toBe(
				true,
			);
		});

		// 测试场景：验证“should resolve local extension paths from settings”对应的行为、结果与边界。
		it("should resolve local extension paths from settings", async () => {
			/** 常量 extDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extDir = join(agentDir, "extensions");
			mkdirSync(extDir, { recursive: true });
			/** 常量 extPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extPath = join(extDir, "my-extension.ts");
			writeFileSync(extPath, "export default function() {}");
			settingsManager.setExtensionPaths(["extensions/my-extension.ts"]);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			expect(result.extensions.some((r) => r.path === extPath && r.enabled)).toBe(true);
		});

		// 测试场景：验证“should resolve skill paths from settings”对应的行为、结果与边界。
		it("should resolve skill paths from settings", async () => {
			/** 常量 skillDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const skillDir = join(agentDir, "skills", "my-skill");
			mkdirSync(skillDir, { recursive: true });
			/** 常量 skillFile 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const skillFile = join(skillDir, "SKILL.md");
			writeFileSync(
				skillFile,
				`---
name: test-skill
description: A test skill
---
Content`,
			);

			settingsManager.setSkillPaths(["skills"]);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			// Skills with SKILL.md are returned as file paths
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(result.skills.some((r) => r.path === skillFile && r.enabled)).toBe(true);
		});

		// 测试场景：验证“should auto-discover root markdown skills from .pi skill dirs”对应的行为、结果与边界。
		it("should auto-discover root markdown skills from .pi skill dirs", async () => {
			/** 常量 skillFile 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const skillFile = join(agentDir, "skills", "single-file.md");
			mkdirSync(join(agentDir, "skills"), { recursive: true });
			writeFileSync(
				skillFile,
				`---
name: single-file
description: A root markdown skill
---
Content`,
			);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			expect(result.skills.some((r) => r.path === skillFile && r.enabled)).toBe(true);
		});

		// 测试场景：验证“should resolve project paths relative to .pi”对应的行为、结果与边界。
		it("should resolve project paths relative to .pi", async () => {
			/** 常量 extDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extDir = join(tempDir, ".pi", "extensions");
			mkdirSync(extDir, { recursive: true });
			/** 常量 extPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extPath = join(extDir, "project-ext.ts");
			writeFileSync(extPath, "export default function() {}");

			settingsManager.setProjectExtensionPaths(["extensions/project-ext.ts"]);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			expect(result.extensions.some((r) => r.path === extPath && r.enabled)).toBe(true);
		});

		// 测试场景：验证“should auto-discover user prompts with overrides”对应的行为、结果与边界。
		it("should auto-discover user prompts with overrides", async () => {
			/** 常量 promptsDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const promptsDir = join(agentDir, "prompts");
			mkdirSync(promptsDir, { recursive: true });
			/** 常量 promptPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const promptPath = join(promptsDir, "auto.md");
			writeFileSync(promptPath, "Auto prompt");

			settingsManager.setPromptTemplatePaths(["!prompts/auto.md"]);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			expect(result.prompts.some((r) => r.path === promptPath && !r.enabled)).toBe(true);
		});

		// 测试场景：验证“should resolve symlinked user and project resources once”对应的行为、结果与边界。
		it("should resolve symlinked user and project resources once", async () => {
			/** 常量 previousHome 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const previousHome = process.env.HOME;
			process.env.HOME = tempDir;

			try {
				/** 常量 sharedDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const sharedDir = join(tempDir, "shared-resources");
				/** 常量 sharedExtensionsDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const sharedExtensionsDir = join(sharedDir, "extensions");
				/** 常量 sharedSkillsDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const sharedSkillsDir = join(sharedDir, "skills");
				/** 常量 sharedPromptsDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const sharedPromptsDir = join(sharedDir, "prompts");
				/** 常量 sharedThemesDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const sharedThemesDir = join(sharedDir, "themes");
				mkdirSync(sharedExtensionsDir, { recursive: true });
				mkdirSync(sharedSkillsDir, { recursive: true });
				mkdirSync(sharedPromptsDir, { recursive: true });
				mkdirSync(sharedThemesDir, { recursive: true });

				writeFileSync(join(sharedExtensionsDir, "shared.ts"), "export default function() {}");
				mkdirSync(join(sharedSkillsDir, "shared-skill"), { recursive: true });
				writeFileSync(
					join(sharedSkillsDir, "shared-skill", "SKILL.md"),
					`---
name: shared-skill
description: Shared skill
---
Content`,
				);
				writeFileSync(join(sharedPromptsDir, "shared.md"), "Shared prompt");
				writeFileSync(join(sharedThemesDir, "shared.json"), JSON.stringify({ name: "shared-theme" }));

				mkdirSync(join(agentDir), { recursive: true });
				mkdirSync(join(tempDir, ".pi"), { recursive: true });
				symlinkSync(sharedExtensionsDir, join(agentDir, "extensions"), "dir");
				symlinkSync(sharedSkillsDir, join(agentDir, "skills"), "dir");
				symlinkSync(sharedPromptsDir, join(agentDir, "prompts"), "dir");
				symlinkSync(sharedThemesDir, join(agentDir, "themes"), "dir");
				symlinkSync(sharedExtensionsDir, join(tempDir, ".pi", "extensions"), "dir");
				symlinkSync(sharedSkillsDir, join(tempDir, ".pi", "skills"), "dir");
				symlinkSync(sharedPromptsDir, join(tempDir, ".pi", "prompts"), "dir");
				symlinkSync(sharedThemesDir, join(tempDir, ".pi", "themes"), "dir");

				/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const result = await packageManager.resolve();

				expect({
					extensions: result.extensions.length,
					skills: result.skills.length,
					prompts: result.prompts.length,
					themes: result.themes.length,
				}).toEqual({
					extensions: 1,
					skills: 1,
					prompts: 1,
					themes: 1,
				});

				// Project auto-discovered has higher precedence than user auto-discovered,
				// so the surviving entry should be scoped to project.
				// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
				expect(result.extensions[0].metadata.scope).toBe("project");
				expect(result.skills[0].metadata.scope).toBe("project");
				expect(result.prompts[0].metadata.scope).toBe("project");
				expect(result.themes[0].metadata.scope).toBe("project");
			} finally {
				if (previousHome === undefined) {
					delete process.env.HOME;
				} else {
					process.env.HOME = previousHome;
				}
			}
		});

		// 测试场景：验证“should auto-discover project prompts with overrides”对应的行为、结果与边界。
		it("should auto-discover project prompts with overrides", async () => {
			/** 常量 promptsDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const promptsDir = join(tempDir, ".pi", "prompts");
			mkdirSync(promptsDir, { recursive: true });
			/** 常量 promptPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const promptPath = join(promptsDir, "is.md");
			writeFileSync(promptPath, "Is prompt");

			settingsManager.setProjectPromptTemplatePaths(["!prompts/is.md"]);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			expect(result.prompts.some((r) => r.path === promptPath && !r.enabled)).toBe(true);
		});

		// 测试场景：验证“should resolve directory with package.json pi.extensions in extensions setting”对应的行为、结果与边界。
		it("should resolve directory with package.json pi.extensions in extensions setting", async () => {
			// Create a package with pi.extensions in package.json
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const pkgDir = join(tempDir, "my-extensions-pkg");
			mkdirSync(join(pkgDir, "extensions"), { recursive: true });
			writeFileSync(
				join(pkgDir, "package.json"),
				JSON.stringify({
					name: "my-extensions-pkg",
					pi: {
						extensions: ["./extensions/clip.ts", "./extensions/cost.ts"],
					},
				}),
			);
			writeFileSync(join(pkgDir, "extensions", "clip.ts"), "export default function() {}");
			writeFileSync(join(pkgDir, "extensions", "cost.ts"), "export default function() {}");
			writeFileSync(join(pkgDir, "extensions", "helper.ts"), "export const x = 1;"); // Not in manifest, shouldn't be loaded

			// Add the directory to extensions setting (not packages setting)
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			settingsManager.setExtensionPaths([pkgDir]);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();

			// Should find the extensions declared in package.json pi.extensions
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(result.extensions.some((r) => r.path === join(pkgDir, "extensions", "clip.ts") && r.enabled)).toBe(
				true,
			);
			expect(result.extensions.some((r) => r.path === join(pkgDir, "extensions", "cost.ts") && r.enabled)).toBe(
				true,
			);

			// Should NOT find helper.ts (not declared in manifest)
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(result.extensions.some((r) => pathEndsWith(r.path, "helper.ts"))).toBe(false);
		});
	});

	// 用例分组：集中验证“auto-discovered skill metadata”相关功能。
	describe("auto-discovered skill metadata", () => {
		// 测试场景：验证“should use the agent dir as baseDir for user .pi/agent skills”对应的行为、结果与边界。
		it("should use the agent dir as baseDir for user .pi/agent skills", async () => {
			/** 常量 skillPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const skillPath = join(agentDir, "skills", "user-pi", "SKILL.md");
			mkdirSync(join(agentDir, "skills", "user-pi"), { recursive: true });
			writeFileSync(skillPath, "---\nname: user-pi\ndescription: user pi\n---\n");

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			/** 常量 skill 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const skill = result.skills.find((r) => r.path === skillPath);

			expect(skill?.metadata.source).toBe("auto");
			expect(skill?.metadata.scope).toBe("user");
			expect(skill?.metadata.baseDir).toBe(agentDir);
		});

		// 测试场景：验证“should use the project .pi dir as baseDir for project .pi skills”对应的行为、结果与边界。
		it("should use the project .pi dir as baseDir for project .pi skills", async () => {
			/** 常量 projectBaseDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const projectBaseDir = join(tempDir, ".pi");
			/** 常量 skillPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const skillPath = join(projectBaseDir, "skills", "project-pi", "SKILL.md");
			mkdirSync(join(projectBaseDir, "skills", "project-pi"), { recursive: true });
			writeFileSync(skillPath, "---\nname: project-pi\ndescription: project pi\n---\n");

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			/** 常量 skill 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const skill = result.skills.find((r) => r.path === skillPath);

			expect(skill?.metadata.source).toBe("auto");
			expect(skill?.metadata.scope).toBe("project");
			expect(skill?.metadata.baseDir).toBe(projectBaseDir);
		});

		// 测试场景：验证“should use ~/.agents as baseDir for user .agents skills”对应的行为、结果与边界。
		it("should use ~/.agents as baseDir for user .agents skills", async () => {
			/** 常量 previousHome 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const previousHome = process.env.HOME;
			process.env.HOME = tempDir;

			try {
				/** 常量 agentsBaseDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const agentsBaseDir = join(tempDir, ".agents");
				/** 常量 skillPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const skillPath = join(agentsBaseDir, "skills", "user-agents", "SKILL.md");
				mkdirSync(join(agentsBaseDir, "skills", "user-agents"), { recursive: true });
				writeFileSync(skillPath, "---\nname: user-agents\ndescription: user agents\n---\n");

				/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const result = await packageManager.resolve();
				/** 常量 skill 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const skill = result.skills.find((r) => r.path === skillPath);

				expect(skill?.metadata.source).toBe("auto");
				expect(skill?.metadata.scope).toBe("user");
				expect(skill?.metadata.baseDir).toBe(agentsBaseDir);
			} finally {
				if (previousHome === undefined) {
					delete process.env.HOME;
				} else {
					process.env.HOME = previousHome;
				}
			}
		});

		// 测试场景：验证“should use each project .agents dir as baseDir for project .agents skills”对应的行为、结果与边界。
		it("should use each project .agents dir as baseDir for project .agents skills", async () => {
			/** 常量 repoRoot 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const repoRoot = join(tempDir, "repo");
			/** 常量 nestedCwd 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const nestedCwd = join(repoRoot, "packages", "feature");
			mkdirSync(nestedCwd, { recursive: true });
			mkdirSync(join(repoRoot, ".git"), { recursive: true });

			/** 常量 repoAgentsBaseDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const repoAgentsBaseDir = join(repoRoot, ".agents");
			/** 常量 repoSkill 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const repoSkill = join(repoAgentsBaseDir, "skills", "repo", "SKILL.md");
			mkdirSync(join(repoAgentsBaseDir, "skills", "repo"), { recursive: true });
			writeFileSync(repoSkill, "---\nname: repo\ndescription: repo\n---\n");

			/** 常量 packageAgentsBaseDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const packageAgentsBaseDir = join(repoRoot, "packages", ".agents");
			/** 常量 packageSkill 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const packageSkill = join(packageAgentsBaseDir, "skills", "package", "SKILL.md");
			mkdirSync(join(packageAgentsBaseDir, "skills", "package"), { recursive: true });
			writeFileSync(packageSkill, "---\nname: package\ndescription: package\n---\n");

			/** 常量 pm 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pm = new DefaultPackageManager({
				cwd: nestedCwd,
				agentDir,
				settingsManager,
			});

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await pm.resolve();
			/** 常量 resolvedRepoSkill 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const resolvedRepoSkill = result.skills.find((r) => r.path === repoSkill);
			/** 常量 resolvedPackageSkill 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const resolvedPackageSkill = result.skills.find((r) => r.path === packageSkill);

			expect(resolvedRepoSkill?.metadata.source).toBe("auto");
			expect(resolvedRepoSkill?.metadata.scope).toBe("project");
			expect(resolvedRepoSkill?.metadata.baseDir).toBe(repoAgentsBaseDir);
			expect(resolvedPackageSkill?.metadata.source).toBe("auto");
			expect(resolvedPackageSkill?.metadata.scope).toBe("project");
			expect(resolvedPackageSkill?.metadata.baseDir).toBe(packageAgentsBaseDir);
		});
	});

	// 用例分组：集中验证“.agents/skills auto-discovery”相关功能。
	describe(".agents/skills auto-discovery", () => {
		// 测试场景：验证“should scan .agents/skills from cwd up to git repo root”对应的行为、结果与边界。
		it("should scan .agents/skills from cwd up to git repo root", async () => {
			/** 常量 repoRoot 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const repoRoot = join(tempDir, "repo");
			/** 常量 nestedCwd 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const nestedCwd = join(repoRoot, "packages", "feature");
			mkdirSync(nestedCwd, { recursive: true });
			mkdirSync(join(repoRoot, ".git"), { recursive: true });

			/** 常量 aboveRepoSkill 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const aboveRepoSkill = join(tempDir, ".agents", "skills", "above-repo", "SKILL.md");
			mkdirSync(join(tempDir, ".agents", "skills", "above-repo"), { recursive: true });
			writeFileSync(aboveRepoSkill, "---\nname: above-repo\ndescription: above\n---\n");

			/** 常量 repoRootSkill 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const repoRootSkill = join(repoRoot, ".agents", "skills", "repo-root", "SKILL.md");
			mkdirSync(join(repoRoot, ".agents", "skills", "repo-root"), { recursive: true });
			writeFileSync(repoRootSkill, "---\nname: repo-root\ndescription: repo\n---\n");

			/** 常量 nestedSkill 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const nestedSkill = join(repoRoot, "packages", ".agents", "skills", "nested", "SKILL.md");
			mkdirSync(join(repoRoot, "packages", ".agents", "skills", "nested"), { recursive: true });
			writeFileSync(nestedSkill, "---\nname: nested\ndescription: nested\n---\n");

			/** 常量 pm 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pm = new DefaultPackageManager({
				cwd: nestedCwd,
				agentDir,
				settingsManager,
			});

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await pm.resolve();
			expect(result.skills.some((r) => r.path === repoRootSkill && r.enabled)).toBe(true);
			expect(result.skills.some((r) => r.path === nestedSkill && r.enabled)).toBe(true);
			expect(result.skills.some((r) => r.path === aboveRepoSkill)).toBe(false);
		});

		// 测试场景：验证“should scan .agents/skills up to filesystem root when not in a git repo”对应的行为、结果与边界。
		it("should scan .agents/skills up to filesystem root when not in a git repo", async () => {
			/** 常量 nonRepoRoot 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const nonRepoRoot = join(tempDir, "non-repo");
			/** 常量 nestedCwd 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const nestedCwd = join(nonRepoRoot, "a", "b");
			mkdirSync(nestedCwd, { recursive: true });

			/** 常量 rootSkill 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const rootSkill = join(nonRepoRoot, ".agents", "skills", "root", "SKILL.md");
			mkdirSync(join(nonRepoRoot, ".agents", "skills", "root"), { recursive: true });
			writeFileSync(rootSkill, "---\nname: root\ndescription: root\n---\n");

			/** 常量 middleSkill 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const middleSkill = join(nonRepoRoot, "a", ".agents", "skills", "middle", "SKILL.md");
			mkdirSync(join(nonRepoRoot, "a", ".agents", "skills", "middle"), { recursive: true });
			writeFileSync(middleSkill, "---\nname: middle\ndescription: middle\n---\n");

			/** 常量 pm 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pm = new DefaultPackageManager({
				cwd: nestedCwd,
				agentDir,
				settingsManager,
			});

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await pm.resolve();
			expect(result.skills.some((r) => r.path === rootSkill && r.enabled)).toBe(true);
			expect(result.skills.some((r) => r.path === middleSkill && r.enabled)).toBe(true);
		});

		// 测试场景：验证“should ignore root markdown files in .agents/skills”对应的行为、结果与边界。
		it("should ignore root markdown files in .agents/skills", async () => {
			/** 常量 agentsSkillsDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const agentsSkillsDir = join(tempDir, ".agents", "skills");
			mkdirSync(join(agentsSkillsDir, "nested-skill"), { recursive: true });
			/** 常量 rootSkill 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const rootSkill = join(agentsSkillsDir, "root-file.md");
			/** 常量 nestedSkill 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const nestedSkill = join(agentsSkillsDir, "nested-skill", "SKILL.md");
			writeFileSync(rootSkill, "---\nname: root-file\ndescription: Root markdown file\n---\n");
			writeFileSync(nestedSkill, "---\nname: nested-skill\ndescription: Nested skill\n---\n");

			/** 常量 pm 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pm = new DefaultPackageManager({
				cwd: join(tempDir, "work"),
				agentDir,
				settingsManager,
			});
			mkdirSync(join(tempDir, "work"), { recursive: true });

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await pm.resolve();
			expect(result.skills.some((r) => r.path === rootSkill)).toBe(false);
			expect(result.skills.some((r) => r.path === nestedSkill && r.enabled)).toBe(true);
		});

		// 测试场景：验证“should keep ~/.agents/skills user-scoped when cwd is under home in a non-git directory”对应的行为、结果与边界。
		it("should keep ~/.agents/skills user-scoped when cwd is under home in a non-git directory", async () => {
			/** 常量 previousHome 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const previousHome = process.env.HOME;
			process.env.HOME = tempDir;

			try {
				/** 常量 cwd 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const cwd = join(tempDir, "scratch", "nested");
				/** 常量 localAgentDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const localAgentDir = join(tempDir, ".pi", "agent");
				/** 常量 localSettingsManager 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const localSettingsManager = SettingsManager.inMemory();
				mkdirSync(cwd, { recursive: true });
				mkdirSync(localAgentDir, { recursive: true });

				/** 常量 homeSkill 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const homeSkill = join(tempDir, ".agents", "skills", "home-skill", "SKILL.md");
				mkdirSync(join(tempDir, ".agents", "skills", "home-skill"), { recursive: true });
				writeFileSync(homeSkill, "---\nname: home-skill\ndescription: home\n---\n");

				/** 常量 pm 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const pm = new DefaultPackageManager({
					cwd,
					agentDir: localAgentDir,
					settingsManager: localSettingsManager,
				});

				/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const result = await pm.resolve();
				/** 常量 matchingSkills 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const matchingSkills = result.skills.filter((r) => r.path === homeSkill);
				expect(matchingSkills).toHaveLength(1);
				expect(matchingSkills[0]?.enabled).toBe(true);
				expect(matchingSkills[0]?.metadata.scope).toBe("user");
				expect(matchingSkills[0]?.metadata.source).toBe("auto");
			} finally {
				if (previousHome === undefined) {
					delete process.env.HOME;
				} else {
					process.env.HOME = previousHome;
				}
			}
		});

		// 测试场景：验证“should dedupe user skill entries when ~/.pi/agent/skills is a symlink to ~/.agents/skills”对应的行为、结果与边界。
		it("should dedupe user skill entries when ~/.pi/agent/skills is a symlink to ~/.agents/skills", async () => {
			/** 常量 previousHome 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const previousHome = process.env.HOME;
			process.env.HOME = tempDir;

			try {
				/** 常量 agentSkillsDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const agentSkillsDir = join(agentDir, "skills");
				/** 常量 agentsSkillsDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const agentsSkillsDir = join(tempDir, ".agents", "skills");
				mkdirSync(agentsSkillsDir, { recursive: true });
				// Use junction on Windows to avoid EPERM when symlink privileges are unavailable.
				// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
				const directoryLinkType = process.platform === "win32" ? "junction" : "dir";
				symlinkSync(agentsSkillsDir, agentSkillsDir, directoryLinkType);

				/** 常量 skillPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const skillPath = join(agentsSkillsDir, "foo", "SKILL.md");
				mkdirSync(join(agentsSkillsDir, "foo"), { recursive: true });
				writeFileSync(skillPath, "---\nname: foo\ndescription: foo\n---\n");

				/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const result = await packageManager.resolve();
				/** 常量 fooSkills 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const fooSkills = result.skills.filter((r) => pathEndsWith(r.path, "foo/SKILL.md"));

				expect(fooSkills).toHaveLength(1);
			} finally {
				if (previousHome === undefined) {
					delete process.env.HOME;
				} else {
					process.env.HOME = previousHome;
				}
			}
		});
	});

	// 用例分组：集中验证“ignore files”相关功能。
	describe("ignore files", () => {
		// 测试场景：验证“should respect .gitignore in skill directories”对应的行为、结果与边界。
		it("should respect .gitignore in skill directories", async () => {
			/** 常量 skillsDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const skillsDir = join(agentDir, "skills");
			mkdirSync(skillsDir, { recursive: true });
			writeFileSync(join(skillsDir, ".gitignore"), "venv\n__pycache__\n");

			/** 常量 goodSkillDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const goodSkillDir = join(skillsDir, "good-skill");
			mkdirSync(goodSkillDir, { recursive: true });
			writeFileSync(join(goodSkillDir, "SKILL.md"), "---\nname: good-skill\ndescription: Good\n---\nContent");

			/** 常量 ignoredSkillDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const ignoredSkillDir = join(skillsDir, "venv", "bad-skill");
			mkdirSync(ignoredSkillDir, { recursive: true });
			writeFileSync(join(ignoredSkillDir, "SKILL.md"), "---\nname: bad-skill\ndescription: Bad\n---\nContent");

			settingsManager.setSkillPaths(["skills"]);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			expect(result.skills.some((r) => r.path.includes("good-skill") && r.enabled)).toBe(true);
			expect(result.skills.some((r) => r.path.includes("venv") && r.enabled)).toBe(false);
		});

		// 测试场景：验证“should not apply parent .gitignore to .pi auto-discovery”对应的行为、结果与边界。
		it("should not apply parent .gitignore to .pi auto-discovery", async () => {
			writeFileSync(join(tempDir, ".gitignore"), ".pi\n");

			/** 常量 skillDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const skillDir = join(tempDir, ".pi", "skills", "auto-skill");
			mkdirSync(skillDir, { recursive: true });
			/** 常量 skillPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const skillPath = join(skillDir, "SKILL.md");
			writeFileSync(skillPath, "---\nname: auto-skill\ndescription: Auto\n---\nContent");

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			expect(result.skills.some((r) => r.path === skillPath && r.enabled)).toBe(true);
		});
	});

	// 用例分组：集中验证“resolveExtensionSources”相关功能。
	describe("resolveExtensionSources", () => {
		// 测试场景：验证“should resolve local paths”对应的行为、结果与边界。
		it("should resolve local paths", async () => {
			/** 常量 extPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extPath = join(tempDir, "ext.ts");
			writeFileSync(extPath, "export default function() {}");

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolveExtensionSources([extPath]);
			expect(result.extensions.some((r) => r.path === extPath && r.enabled)).toBe(true);
		});

		// 测试场景：验证“should handle directories with pi manifest”对应的行为、结果与边界。
		it("should handle directories with pi manifest", async () => {
			/** 常量 pkgDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pkgDir = join(tempDir, "my-package");
			mkdirSync(pkgDir, { recursive: true });
			writeFileSync(
				join(pkgDir, "package.json"),
				JSON.stringify({
					name: "my-package",
					pi: {
						extensions: ["./src/index.ts"],
						skills: ["./skills"],
					},
				}),
			);
			mkdirSync(join(pkgDir, "src"), { recursive: true });
			writeFileSync(join(pkgDir, "src", "index.ts"), "export default function() {}");
			mkdirSync(join(pkgDir, "skills", "my-skill"), { recursive: true });
			writeFileSync(
				join(pkgDir, "skills", "my-skill", "SKILL.md"),
				"---\nname: my-skill\ndescription: Test\n---\nContent",
			);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolveExtensionSources([pkgDir]);
			expect(result.extensions.some((r) => r.path === join(pkgDir, "src", "index.ts") && r.enabled)).toBe(true);
			// Skills with SKILL.md are returned as file paths
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(result.skills.some((r) => r.path === join(pkgDir, "skills", "my-skill", "SKILL.md") && r.enabled)).toBe(
				true,
			);
		});

		// 测试场景：验证“should keep pi manifest entries with leading tilde package-relative”对应的行为、结果与边界。
		it("should keep pi manifest entries with leading tilde package-relative", async () => {
			/** 常量 pkgDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pkgDir = join(tempDir, "tilde-manifest-package");
			/** 常量 directExtensionPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const directExtensionPath = join(pkgDir, "~extensions", "main.ts");
			/** 常量 slashExtensionPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const slashExtensionPath = join(pkgDir, "~", "extensions", "alt.ts");
			/** 常量 directSkillPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const directSkillPath = join(pkgDir, "~skills", "direct-skill", "SKILL.md");
			/** 常量 slashSkillPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const slashSkillPath = join(pkgDir, "~", "skills", "slash-skill", "SKILL.md");

			mkdirSync(join(pkgDir, "~extensions"), { recursive: true });
			mkdirSync(join(pkgDir, "~", "extensions"), { recursive: true });
			mkdirSync(join(pkgDir, "~skills", "direct-skill"), { recursive: true });
			mkdirSync(join(pkgDir, "~", "skills", "slash-skill"), { recursive: true });
			writeFileSync(directExtensionPath, "export default function() {}");
			writeFileSync(slashExtensionPath, "export default function() {}");
			writeFileSync(directSkillPath, "---\nname: direct-skill\ndescription: Direct\n---\nContent");
			writeFileSync(slashSkillPath, "---\nname: slash-skill\ndescription: Slash\n---\nContent");
			writeFileSync(
				join(pkgDir, "package.json"),
				JSON.stringify({
					name: "tilde-manifest-package",
					pi: {
						extensions: ["~extensions/main.ts", "~/extensions/alt.ts"],
						skills: ["~skills", "~/skills"],
					},
				}),
			);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolveExtensionSources([pkgDir]);

			expect(result.extensions.some((r) => r.path === directExtensionPath && r.enabled)).toBe(true);
			expect(result.extensions.some((r) => r.path === slashExtensionPath && r.enabled)).toBe(true);
			expect(result.skills.some((r) => r.path === directSkillPath && r.enabled)).toBe(true);
			expect(result.skills.some((r) => r.path === slashSkillPath && r.enabled)).toBe(true);
		});

		// 测试场景：验证“should handle directories with auto-discovery layout”对应的行为、结果与边界。
		it("should handle directories with auto-discovery layout", async () => {
			/** 常量 pkgDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pkgDir = join(tempDir, "auto-pkg");
			mkdirSync(join(pkgDir, "extensions"), { recursive: true });
			mkdirSync(join(pkgDir, "themes"), { recursive: true });
			writeFileSync(join(pkgDir, "extensions", "main.ts"), "export default function() {}");
			writeFileSync(join(pkgDir, "themes", "dark.json"), "{}");

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolveExtensionSources([pkgDir]);
			expect(result.extensions.some((r) => pathEndsWith(r.path, "main.ts") && r.enabled)).toBe(true);
			expect(result.themes.some((r) => pathEndsWith(r.path, "dark.json") && r.enabled)).toBe(true);
		});

		// 测试场景：验证“should stop recursing when a package skill directory contains SKILL.md”对应的行为、结果与边界。
		it("should stop recursing when a package skill directory contains SKILL.md", async () => {
			/** 常量 pkgDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pkgDir = join(tempDir, "skill-root-pkg");
			mkdirSync(join(pkgDir, "skills", "root-skill", "nested-skill"), { recursive: true });
			/** 常量 rootSkill 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const rootSkill = join(pkgDir, "skills", "root-skill", "SKILL.md");
			/** 常量 nestedSkill 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const nestedSkill = join(pkgDir, "skills", "root-skill", "nested-skill", "SKILL.md");
			writeFileSync(rootSkill, "---\nname: root-skill\ndescription: Root skill\n---\n");
			writeFileSync(nestedSkill, "---\nname: nested-skill\ndescription: Nested skill\n---\n");

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolveExtensionSources([pkgDir]);
			expect(result.skills.some((r) => r.path === rootSkill && r.enabled)).toBe(true);
			expect(result.skills.some((r) => r.path === nestedSkill)).toBe(false);
		});
	});

	// 用例分组：集中验证“progress callback”相关功能。
	describe("progress callback", () => {
		// 测试场景：验证“should emit progress events”对应的行为、结果与边界。
		it("should emit progress events", async () => {
			/** 常量 events 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const events: ProgressEvent[] = [];
			packageManager.setProgressCallback((event) => events.push(event));

			/** 常量 extPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extPath = join(tempDir, "ext.ts");
			writeFileSync(extPath, "export default function() {}");

			// Local paths don't trigger install progress, but we can verify the callback is set
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			await packageManager.resolveExtensionSources([extPath]);

			// For now just verify no errors - npm/git would trigger actual events
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(events.length).toBe(0);
		});
	});

	// 用例分组：集中验证“command spawning”相关功能。
	describe("command spawning", () => {
		// 测试场景：验证“should preserve argv entries containing spaces”对应的行为、结果与边界。
		it("should preserve argv entries containing spaces", () => {
			/** 常量 managerWithInternals 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const managerWithInternals = packageManager as unknown as {
				runCommandSync(command: string, args: string[]): string;
			};
			/** 常量 valueWithSpace 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const valueWithSpace = "C:\\Users\\A B\\.pi\\npm";
			/** 常量 output 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const output = managerWithInternals.runCommandSync(process.execPath, [
				"-e",
				"console.log(process.argv[1])",
				valueWithSpace,
			]);

			expect(output).toBe(valueWithSpace);
		});
	});

	// 用例分组：集中验证“npmCommand”相关功能。
	describe("npmCommand", () => {
		// 测试场景：验证“should use npmCommand argv for npm installs”对应的行为、结果与边界。
		it("should use npmCommand argv for npm installs", async () => {
			settingsManager = SettingsManager.inMemory({
				npmCommand: ["mise", "exec", "node@20", "--", "npm"],
			});
			packageManager = new DefaultPackageManager({
				cwd: tempDir,
				agentDir,
				settingsManager,
			});

			/** 常量 runCommandSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runCommandSpy = vi.spyOn(packageManager as any, "runCommand").mockResolvedValue(undefined);

			await packageManager.install("npm:@scope/pkg");

			expect(runCommandSpy).toHaveBeenCalledWith(
				"mise",
				[
					"exec",
					"node@20",
					"--",
					"npm",
					"install",
					"@scope/pkg",
					"--prefix",
					join(agentDir, "npm"),
					"--legacy-peer-deps",
				],
				undefined,
			);
		});

		// 测试场景：验证“should pass legacy peer deps when uninstalling npm packages”对应的行为、结果与边界。
		it("should pass legacy peer deps when uninstalling npm packages", async () => {
			mkdirSync(join(agentDir, "npm"), { recursive: true });
			/** 常量 runCommandSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runCommandSpy = vi.spyOn(packageManager as any, "runCommand").mockResolvedValue(undefined);

			await packageManager.remove("npm:@scope/pkg");

			expect(runCommandSpy).toHaveBeenCalledWith(
				"npm",
				["uninstall", "@scope/pkg", "--prefix", join(agentDir, "npm"), "--legacy-peer-deps"],
				undefined,
			);
		});

		// 测试场景：验证“should use bun --cwd for npm package installs”对应的行为、结果与边界。
		it("should use bun --cwd for npm package installs", async () => {
			settingsManager = SettingsManager.inMemory({
				npmCommand: ["mise", "exec", "bun@1", "--", "bun"],
			});
			packageManager = new DefaultPackageManager({
				cwd: tempDir,
				agentDir,
				settingsManager,
			});

			/** 常量 runCommandSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runCommandSpy = vi.spyOn(packageManager as any, "runCommand").mockResolvedValue(undefined);

			await packageManager.install("npm:@scope/pkg");

			expect(runCommandSpy).toHaveBeenCalledWith(
				"mise",
				["exec", "bun@1", "--", "bun", "install", "@scope/pkg", "--cwd", join(agentDir, "npm"), "--omit=peer"],
				undefined,
			);
		});

		// 测试场景：验证“should install git package dependencies with --omit=dev”对应的行为、结果与边界。
		it("should install git package dependencies with --omit=dev", async () => {
			/** 常量 source 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const source = "git:github.com/user/repo";
			/** 常量 targetDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const targetDir = join(agentDir, "git", "github.com", "user", "repo");
			/** 常量 runCommandSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runCommandSpy = vi
				.spyOn(packageManager as any, "runCommand")
				.mockImplementation(async (...callArgs: unknown[]) => {
					/** 常量 [command, args] 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const [command, args] = callArgs as [string, string[]];
					if (command === "git" && args[0] === "clone") {
						mkdirSync(targetDir, { recursive: true });
						writeFileSync(join(targetDir, "package.json"), JSON.stringify({ name: "repo", version: "1.0.0" }));
					}
				});

			await packageManager.install(source);

			expect(runCommandSpy).toHaveBeenCalledWith("npm", ["install", "--omit=dev"], { cwd: targetDir });
		});

		// 测试场景：验证“should reconcile an existing git checkout to a pinned ref during install”对应的行为、结果与边界。
		it("should reconcile an existing git checkout to a pinned ref during install", async () => {
			/** 常量 source 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const source = "git:github.com/user/repo@v2";
			/** 常量 targetDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const targetDir = join(agentDir, "git", "github.com", "user", "repo");
			mkdirSync(targetDir, { recursive: true });
			writeFileSync(join(targetDir, "package.json"), JSON.stringify({ name: "repo", version: "1.0.0" }));

			/** 常量 managerWithInternals 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const managerWithInternals = packageManager as unknown as PackageManagerInternals;
			vi.spyOn(managerWithInternals, "runCommandCapture").mockImplementation(async (_command, args) => {
				if (args[0] === "rev-parse" && args[1] === "HEAD") {
					return "old-head";
				}
				if (args[0] === "rev-parse" && args[1] === "FETCH_HEAD^{commit}") {
					return "new-head";
				}
				throw new Error(`Unexpected runCommandCapture args: ${args.join(" ")}`);
			});
			/** 常量 runCommandSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runCommandSpy = vi.spyOn(managerWithInternals, "runCommand").mockResolvedValue(undefined);

			await packageManager.install(source);

			expect(runCommandSpy).toHaveBeenCalledWith("git", ["fetch", "origin", "v2"], { cwd: targetDir });
			expect(runCommandSpy).toHaveBeenCalledWith("git", ["reset", "--hard", "FETCH_HEAD^{commit}"], {
				cwd: targetDir,
			});
			expect(runCommandSpy).toHaveBeenCalledWith("git", ["clean", "-fdx"], { cwd: targetDir });
			expect(runCommandSpy).toHaveBeenCalledWith("npm", ["install", "--omit=dev"], { cwd: targetDir });
		});

		// 测试场景：验证“should reconcile an existing git checkout to its update target when installing without a ref”对应的行为、结果与边界。
		it("should reconcile an existing git checkout to its update target when installing without a ref", async () => {
			/** 常量 source 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const source = "git:github.com/user/repo";
			/** 常量 targetDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const targetDir = join(agentDir, "git", "github.com", "user", "repo");
			/** 常量 fetchArgs 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const fetchArgs = ["fetch", "--prune", "--no-tags", "origin", "+refs/heads/main:refs/remotes/origin/main"];
			mkdirSync(targetDir, { recursive: true });

			/** 常量 managerWithInternals 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const managerWithInternals = packageManager as unknown as PackageManagerInternals;
			vi.spyOn(managerWithInternals, "getLocalGitUpdateTarget").mockResolvedValue({
				ref: "origin/HEAD",
				head: "new-head",
				fetchArgs,
			});
			vi.spyOn(managerWithInternals, "runCommandCapture").mockImplementation(async (_command, args) => {
				if (args[0] === "rev-parse" && args[1] === "HEAD") {
					return "old-head";
				}
				if (args[0] === "rev-parse" && args[1] === "origin/HEAD^{commit}") {
					return "new-head";
				}
				throw new Error(`Unexpected runCommandCapture args: ${args.join(" ")}`);
			});
			/** 常量 runCommandSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runCommandSpy = vi.spyOn(managerWithInternals, "runCommand").mockResolvedValue(undefined);

			await packageManager.install(source);

			expect(runCommandSpy).toHaveBeenCalledWith("git", fetchArgs, { cwd: targetDir });
			expect(runCommandSpy).toHaveBeenCalledWith("git", ["reset", "--hard", "origin/HEAD^{commit}"], {
				cwd: targetDir,
			});
			expect(runCommandSpy).toHaveBeenCalledWith("git", ["clean", "-fdx"], { cwd: targetDir });
		});

		// 测试场景：验证“should use plain install for git package dependencies when npmCommand is configured”对应的行为、结果与边界。
		it("should use plain install for git package dependencies when npmCommand is configured", async () => {
			settingsManager = SettingsManager.inMemory({
				npmCommand: ["pnpm"],
			});
			packageManager = new DefaultPackageManager({
				cwd: tempDir,
				agentDir,
				settingsManager,
			});

			/** 常量 source 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const source = "git:github.com/user/repo";
			/** 常量 targetDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const targetDir = join(agentDir, "git", "github.com", "user", "repo");
			/** 常量 runCommandSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runCommandSpy = vi
				.spyOn(packageManager as any, "runCommand")
				.mockImplementation(async (...callArgs: unknown[]) => {
					/** 常量 [command, args] 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const [command, args] = callArgs as [string, string[]];
					if (command === "git" && args[0] === "clone") {
						mkdirSync(targetDir, { recursive: true });
						writeFileSync(join(targetDir, "package.json"), JSON.stringify({ name: "repo", version: "1.0.0" }));
					}
				});

			await packageManager.install(source);

			expect(runCommandSpy).toHaveBeenCalledWith("pnpm", ["install"], { cwd: targetDir });
		});

		// 测试场景：验证“should update git package dependencies with --omit=dev”对应的行为、结果与边界。
		it("should update git package dependencies with --omit=dev", async () => {
			/** 常量 source 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const source = "git:github.com/user/repo";
			/** 常量 targetDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const targetDir = join(tempDir, ".pi", "git", "github.com", "user", "repo");
			mkdirSync(targetDir, { recursive: true });
			writeFileSync(join(targetDir, "package.json"), JSON.stringify({ name: "repo", version: "1.0.0" }));
			settingsManager.setProjectPackages([source]);

			vi.spyOn(packageManager as any, "runCommandCapture").mockImplementation(async (...callArgs: unknown[]) => {
				/** 常量 [_command, args] 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const [_command, args] = callArgs as [string, string[]];
				if (args[0] === "rev-parse" && args[1] === "--abbrev-ref" && args[2] === "@{upstream}") {
					return "origin/main";
				}
				if (args[0] === "rev-parse" && (args[1] === "@{upstream}" || args[1] === "@{upstream}^{commit}")) {
					return "remote-head";
				}
				if (args[0] === "rev-parse" && args[1] === "HEAD") {
					return "local-head";
				}
				throw new Error(`Unexpected runCommandCapture args: ${args.join(" ")}`);
			});
			/** 常量 runCommandSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runCommandSpy = vi.spyOn(packageManager as any, "runCommand").mockResolvedValue(undefined);

			await packageManager.update(source);

			expect(runCommandSpy).toHaveBeenCalledWith("npm", ["install", "--omit=dev"], { cwd: targetDir });
		});

		// 测试场景：验证“should use plain install through npmCommand argv when updating git package dependencies”对应的行为、结果与边界。
		it("should use plain install through npmCommand argv when updating git package dependencies", async () => {
			settingsManager = SettingsManager.inMemory({
				npmCommand: ["mise", "exec", "node@20", "--", "pnpm"],
			});
			packageManager = new DefaultPackageManager({
				cwd: tempDir,
				agentDir,
				settingsManager,
			});

			/** 常量 source 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const source = "git:github.com/user/repo";
			/** 常量 targetDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const targetDir = join(tempDir, ".pi", "git", "github.com", "user", "repo");
			mkdirSync(targetDir, { recursive: true });
			writeFileSync(join(targetDir, "package.json"), JSON.stringify({ name: "repo", version: "1.0.0" }));
			settingsManager.setProjectPackages([source]);

			vi.spyOn(packageManager as any, "runCommandCapture").mockImplementation(async (...callArgs: unknown[]) => {
				/** 常量 [_command, args] 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const [_command, args] = callArgs as [string, string[]];
				if (args[0] === "rev-parse" && args[1] === "--abbrev-ref" && args[2] === "@{upstream}") {
					return "origin/main";
				}
				if (args[0] === "rev-parse" && (args[1] === "@{upstream}" || args[1] === "@{upstream}^{commit}")) {
					return "remote-head";
				}
				if (args[0] === "rev-parse" && args[1] === "HEAD") {
					return "local-head";
				}
				throw new Error(`Unexpected runCommandCapture args: ${args.join(" ")}`);
			});
			/** 常量 runCommandSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runCommandSpy = vi.spyOn(packageManager as any, "runCommand").mockResolvedValue(undefined);

			await packageManager.update(source);

			expect(runCommandSpy).toHaveBeenCalledWith("mise", ["exec", "node@20", "--", "pnpm", "install"], {
				cwd: targetDir,
			});
		});

		// 测试场景：验证“should use npmCommand argv for npm root lookup and invalidate cached root when npmCommand changes”对应的行为、结果与边界。
		it("should use npmCommand argv for npm root lookup and invalidate cached root when npmCommand changes", () => {
			settingsManager = SettingsManager.inMemory({
				npmCommand: ["mise", "exec", "node@20", "--", "npm"],
			});
			packageManager = new DefaultPackageManager({
				cwd: tempDir,
				agentDir,
				settingsManager,
			});

			/** 常量 root20 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const root20 = join(tempDir, "node20", "lib", "node_modules");
			/** 常量 root22 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const root22 = join(tempDir, "node22", "lib", "node_modules");
			mkdirSync(join(root20, "@scope", "pkg"), { recursive: true });

			/** 常量 runCommandSyncSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runCommandSyncSpy = vi
				.spyOn(packageManager as any, "runCommandSync")
				.mockImplementation((...callArgs: unknown[]) => {
					/** 常量 [command, args] 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const [command, args] = callArgs as [string, string[]];
					if (command !== "mise") {
						throw new Error(`unexpected command ${command}`);
					}
					if (args[1] === "node@20") {
						return root20;
					}
					if (args[1] === "node@22") {
						return root22;
					}
					throw new Error(`unexpected args ${args.join(" ")}`);
				});

			expect(packageManager.getInstalledPath("npm:@scope/pkg", "user")).toBe(join(root20, "@scope", "pkg"));
			expect(runCommandSyncSpy).toHaveBeenNthCalledWith(1, "mise", ["exec", "node@20", "--", "npm", "root", "-g"]);

			settingsManager.setNpmCommand(["mise", "exec", "node@22", "--", "npm"]);

			expect(packageManager.getInstalledPath("npm:@scope/pkg", "user")).toBeUndefined();
			expect(runCommandSyncSpy).toHaveBeenNthCalledWith(2, "mise", ["exec", "node@22", "--", "npm", "root", "-g"]);
		});

		// 测试场景：验证“should install user npm packages into the pi-managed npm root”对应的行为、结果与边界。
		it("should install user npm packages into the pi-managed npm root", async () => {
			settingsManager = SettingsManager.inMemory({
				npmCommand: ["pnpm"],
				packages: ["npm:pnpm-pkg"],
			});
			packageManager = new DefaultPackageManager({
				cwd: tempDir,
				agentDir,
				settingsManager,
			});

			/** 常量 packagePath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const packagePath = join(agentDir, "npm", "node_modules", "pnpm-pkg");
			vi.spyOn(packageManager as any, "runCommandSync").mockImplementation(() => {
				throw new Error("legacy lookup unavailable");
			});
			/** 常量 runCommandSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runCommandSpy = vi
				.spyOn(packageManager as any, "runCommand")
				.mockImplementation(async (...callArgs: unknown[]) => {
					/** 常量 [command, args] 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const [command, args] = callArgs as [string, string[]];
					expect(command).toBe("pnpm");
					expect(args).toEqual([
						"install",
						"pnpm-pkg",
						"--prefix",
						join(agentDir, "npm"),
						"--config.auto-install-peers=false",
						"--config.strict-peer-dependencies=false",
						"--config.strict-dep-builds=false",
					]);
					mkdirSync(join(packagePath, "extensions"), { recursive: true });
					writeFileSync(join(packagePath, "package.json"), JSON.stringify({ name: "pnpm-pkg", version: "1.0.0" }));
					writeFileSync(join(packagePath, "extensions", "index.ts"), "export default function() {};");
				});

			/** 常量 first 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const first = await packageManager.resolve();
			/** 常量 second 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const second = await packageManager.resolve();

			expect(first.extensions.some((r) => r.path === join(packagePath, "extensions", "index.ts") && r.enabled)).toBe(
				true,
			);
			expect(
				second.extensions.some((r) => r.path === join(packagePath, "extensions", "index.ts") && r.enabled),
			).toBe(true);
			expect(runCommandSpy).toHaveBeenCalledTimes(1);
			expect(packageManager.getInstalledPath("npm:pnpm-pkg", "user")).toBe(packagePath);
		});

		// 测试场景：验证“should load legacy pnpm global package paths from pnpm list output”对应的行为、结果与边界。
		it("should load legacy pnpm global package paths from pnpm list output", async () => {
			settingsManager = SettingsManager.inMemory({
				npmCommand: ["pnpm"],
				packages: ["npm:pnpm-pkg"],
			});
			packageManager = new DefaultPackageManager({
				cwd: tempDir,
				agentDir,
				settingsManager,
			});

			/** 常量 pnpmRoot 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pnpmRoot = join(tempDir, "pnpm", "global", "v11");
			/** 常量 packagePath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const packagePath = join(pnpmRoot, "20-hash", "node_modules", "pnpm-pkg");
			mkdirSync(join(packagePath, "extensions"), { recursive: true });
			writeFileSync(join(packagePath, "package.json"), JSON.stringify({ name: "pnpm-pkg", version: "1.0.0" }));
			writeFileSync(join(packagePath, "extensions", "index.ts"), "export default function() {};");

			vi.spyOn(packageManager as any, "runCommandSync").mockImplementation((...callArgs: unknown[]) => {
				/** 常量 [command, args] 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const [command, args] = callArgs as [string, string[]];
				if (command !== "pnpm") {
					throw new Error(`unexpected command ${command}`);
				}
				if (args.join(" ") === "list -g --depth 0 --json") {
					return JSON.stringify([
						{
							path: pnpmRoot,
							dependencies: { "pnpm-pkg": { version: "1.0.0", path: packagePath } },
						},
					]);
				}
				throw new Error(`unexpected args ${args.join(" ")}`);
			});
			/** 常量 runCommandSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runCommandSpy = vi.spyOn(packageManager as any, "runCommand").mockResolvedValue(undefined);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();

			expect(
				result.extensions.some((r) => r.path === join(packagePath, "extensions", "index.ts") && r.enabled),
			).toBe(true);
			expect(runCommandSpy).not.toHaveBeenCalled();
			expect(packageManager.getInstalledPath("npm:pnpm-pkg", "user")).toBe(packagePath);
		});

		// 测试场景：验证“should resolve wrapped pnpm global package paths from pnpm list output”对应的行为、结果与边界。
		it("should resolve wrapped pnpm global package paths from pnpm list output", () => {
			settingsManager = SettingsManager.inMemory({
				npmCommand: ["mise", "exec", "node@20", "--", "pnpm"],
			});
			packageManager = new DefaultPackageManager({
				cwd: tempDir,
				agentDir,
				settingsManager,
			});

			/** 常量 pnpmRoot 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pnpmRoot = join(tempDir, "pnpm", "global", "v11");
			/** 常量 packagePath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const packagePath = join(pnpmRoot, "20-hash", "node_modules", "pnpm-pkg");
			mkdirSync(packagePath, { recursive: true });

			vi.spyOn(packageManager as any, "runCommandSync").mockImplementation((...callArgs: unknown[]) => {
				/** 常量 [command, args] 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const [command, args] = callArgs as [string, string[]];
				expect(command).toBe("mise");
				if (args.join(" ") === "exec node@20 -- pnpm list -g --depth 0 --json") {
					return JSON.stringify([{ path: pnpmRoot, dependencies: { "pnpm-pkg": { path: packagePath } } }]);
				}
				throw new Error(`unexpected args ${args.join(" ")}`);
			});

			expect(packageManager.getInstalledPath("npm:pnpm-pkg", "user")).toBe(packagePath);
		});

		// 测试场景：验证“should ignore malformed legacy pnpm global package lists”对应的行为、结果与边界。
		it("should ignore malformed legacy pnpm global package lists", () => {
			settingsManager = SettingsManager.inMemory({
				npmCommand: ["pnpm"],
			});
			packageManager = new DefaultPackageManager({
				cwd: tempDir,
				agentDir,
				settingsManager,
			});

			vi.spyOn(packageManager as any, "runCommandSync").mockReturnValue("not json");

			expect(packageManager.getInstalledPath("npm:pnpm-pkg", "user")).toBeUndefined();
		});
	});

	// 用例分组：集中验证“source parsing”相关功能。
	describe("source parsing", () => {
		// 测试场景：验证“should emit progress events on install attempt”对应的行为、结果与边界。
		it("should emit progress events on install attempt", async () => {
			/** 常量 events 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const events: ProgressEvent[] = [];
			packageManager.setProgressCallback((event) => events.push(event));

			// Use public install method which emits progress events
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			try {
				await packageManager.install("npm:nonexistent-package@1.0.0");
			} catch {
				// Expected to fail - package doesn't exist
				// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			}

			// Should have emitted start event before failure
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(events.some((e) => e.type === "start" && e.action === "install")).toBe(true);
			// Should have emitted error event
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(events.some((e) => e.type === "error")).toBe(true);
		});

		// 测试场景：验证“should recognize github URLs without git: prefix”对应的行为、结果与边界。
		it("should recognize github URLs without git: prefix", async () => {
			/** 常量 events 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const events: ProgressEvent[] = [];
			packageManager.setProgressCallback((event) => events.push(event));
			/** 常量 previousGitTerminalPrompt 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const previousGitTerminalPrompt = process.env.GIT_TERMINAL_PROMPT;
			process.env.GIT_TERMINAL_PROMPT = "0";

			try {
				// This should be parsed as a git source, not throw "unsupported"
				// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
				try {
					await packageManager.install("https://github.com/nonexistent/repo");
				} catch {
					// Expected to fail - repo doesn't exist
					// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
				}
			} finally {
				if (previousGitTerminalPrompt === undefined) {
					delete process.env.GIT_TERMINAL_PROMPT;
				} else {
					process.env.GIT_TERMINAL_PROMPT = previousGitTerminalPrompt;
				}
			}

			// Should have attempted clone, not thrown unsupported error
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(events.some((e) => e.type === "start" && e.action === "install")).toBe(true);
		});

		// 测试场景：验证“should parse package source types from docs examples”对应的行为、结果与边界。
		it("should parse package source types from docs examples", () => {
			/** parseNpm 封装当前回调或辅助步骤；参数 source: string 提供输入，返回值用于后续流程。示例：parseNpm(...)。 */
			const parseNpm = (source: string) => {
				/** 常量 parsed 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const parsed = (packageManager as any).parseSource(source);
				if (parsed.type !== "npm") {
					throw new Error(`Expected npm source: ${source}`);
				}
				return parsed;
			};

			expect(parseNpm("npm:@scope/pkg@1.2.3").pinned).toBe(true);
			expect(parseNpm("npm:@scope/pkg@^1.2.3").pinned).toBe(false);
			expect(parseNpm("npm:pkg").pinned).toBe(false);

			expect((packageManager as any).parseSource("git:github.com/user/repo@v1").type).toBe("git");
			expect((packageManager as any).parseSource("https://github.com/user/repo@v1").type).toBe("git");
			expect((packageManager as any).parseSource("git:git@github.com:user/repo@v1").type).toBe("git");
			expect((packageManager as any).parseSource("ssh://git@github.com/user/repo@v1").type).toBe("git");

			expect((packageManager as any).parseSource("/absolute/path/to/package").type).toBe("local");
			expect((packageManager as any).parseSource("./relative/path/to/package").type).toBe("local");
			expect((packageManager as any).parseSource("../relative/path/to/package").type).toBe("local");
		});

		// 测试场景：验证“should never parse dot-relative paths as git”对应的行为、结果与边界。
		it("should never parse dot-relative paths as git", () => {
			/** 常量 dotSlash 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const dotSlash = (packageManager as any).parseSource("./packages/agent-timers");
			expect(dotSlash.type).toBe("local");
			expect(dotSlash.path).toBe("./packages/agent-timers");

			/** 常量 dotDotSlash 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const dotDotSlash = (packageManager as any).parseSource("../packages/agent-timers");
			expect(dotDotSlash.type).toBe("local");
			expect(dotDotSlash.path).toBe("../packages/agent-timers");
		});
	});

	// 用例分组：集中验证“git install paths”相关功能。
	describe("git install paths", () => {
		// 测试场景：验证“should reject paths outside git install roots”对应的行为、结果与边界。
		it("should reject paths outside git install roots", () => {
			/** 常量 managerWithInternals 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const managerWithInternals = packageManager as unknown as PackageManagerInternals;
			/** 常量 traversalSource 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const traversalSource = {
				type: "git" as const,
				repo: "git@evil.example:../../victim/repo",
				host: "evil.example",
				path: "../../victim/repo",
				pinned: false,
			};

			/** 循环变量 scope 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const scope of ["user", "project", "temporary"] as const) {
				expect(() => managerWithInternals.getGitInstallPath(traversalSource, scope)).toThrow(
					"outside package install root",
				);
			}
		});
	});

	// 用例分组：集中验证“temporary install paths”相关功能。
	describe("temporary install paths", () => {
		// 测试场景：验证“should place temporary npm packages under the agent temp extension folder”对应的行为、结果与边界。
		it("should place temporary npm packages under the agent temp extension folder", () => {
			/** 常量 managerWithInternals 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const managerWithInternals = packageManager as unknown as PackageManagerInternals;
			/** 常量 source 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const source = managerWithInternals.parseSource("npm:left-pad");
			if (source.type !== "npm") {
				throw new Error("Expected npm source");
			}

			/** 常量 installPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const installPath = managerWithInternals.getNpmInstallPath(source, "temporary");
			/** 常量 tempRoot 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tempRoot = join(agentDir, "tmp", "extensions");

			expect(pathEndsWith(installPath, "node_modules/left-pad")).toBe(true);
			expect(relative(tempRoot, installPath).startsWith("..")).toBe(false);
			expect(installPath.startsWith(join(tmpdir(), "pi-extensions"))).toBe(false);
			if (process.platform !== "win32") {
				expect(statSync(tempRoot).mode & 0o777).toBe(0o700);
			}
		});
	});

	// 用例分组：集中验证“settings source normalization”相关功能。
	describe("settings source normalization", () => {
		// 测试场景：验证“should store global local packages relative to agent settings base”对应的行为、结果与边界。
		it("should store global local packages relative to agent settings base", () => {
			/** 常量 pkgDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pkgDir = join(tempDir, "packages", "local-global-pkg");
			mkdirSync(join(pkgDir, "extensions"), { recursive: true });
			writeFileSync(join(pkgDir, "extensions", "index.ts"), "export default function() {}");

			/** 常量 added 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const added = packageManager.addSourceToSettings("./packages/local-global-pkg");
			expect(added).toBe(true);

			/** 常量 settings 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const settings = settingsManager.getGlobalSettings();
			/** 常量 rel 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const rel = relative(agentDir, pkgDir);
			/** 常量 expected 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const expected = rel.startsWith(".") ? rel : `./${rel}`;
			expect(settings.packages?.[0]).toBe(expected);
		});

		// 测试场景：验证“should store project local packages relative to .pi settings base”对应的行为、结果与边界。
		it("should store project local packages relative to .pi settings base", () => {
			/** 常量 projectPkgDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const projectPkgDir = join(tempDir, "project-local-pkg");
			mkdirSync(join(projectPkgDir, "extensions"), { recursive: true });
			writeFileSync(join(projectPkgDir, "extensions", "index.ts"), "export default function() {}");

			/** 常量 added 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const added = packageManager.addSourceToSettings("./project-local-pkg", { local: true });
			expect(added).toBe(true);

			/** 常量 settings 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const settings = settingsManager.getProjectSettings();
			/** 常量 rel 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const rel = relative(join(tempDir, ".pi"), projectPkgDir);
			/** 常量 expected 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const expected = rel.startsWith(".") ? rel : `./${rel}`;
			expect(settings.packages?.[0]).toBe(expected);
		});

		// 测试场景：验证“should remove local package entries using equivalent path forms”对应的行为、结果与边界。
		it("should remove local package entries using equivalent path forms", () => {
			/** 常量 pkgDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pkgDir = join(tempDir, "remove-local-pkg");
			mkdirSync(join(pkgDir, "extensions"), { recursive: true });
			writeFileSync(join(pkgDir, "extensions", "index.ts"), "export default function() {}");

			packageManager.addSourceToSettings("./remove-local-pkg");
			/** 常量 removed 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const removed = packageManager.removeSourceFromSettings(`${pkgDir}/`);
			expect(removed).toBe(true);
			expect(settingsManager.getGlobalSettings().packages ?? []).toHaveLength(0);
		});

		// 测试场景：验证“should return false when adding the same git source with the same ref”对应的行为、结果与边界。
		it("should return false when adding the same git source with the same ref", () => {
			/** 常量 first 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const first = packageManager.addSourceToSettings("git:github.com/user/repo@v1");
			expect(first).toBe(true);

			/** 常量 second 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const second = packageManager.addSourceToSettings("git:github.com/user/repo@v1");
			expect(second).toBe(false);
			expect(settingsManager.getGlobalSettings().packages).toEqual(["git:github.com/user/repo@v1"]);
		});

		// 测试场景：验证“should update the ref when adding the same git source with a different ref”对应的行为、结果与边界。
		it("should update the ref when adding the same git source with a different ref", () => {
			packageManager.addSourceToSettings("git:github.com/user/repo@v1");

			/** 常量 updated 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const updated = packageManager.addSourceToSettings("git:github.com/user/repo@v2");
			expect(updated).toBe(true);
			expect(settingsManager.getGlobalSettings().packages).toEqual(["git:github.com/user/repo@v2"]);
		});

		// 测试场景：验证“should preserve package filters when replacing a package source ref”对应的行为、结果与边界。
		it("should preserve package filters when replacing a package source ref", () => {
			settingsManager.setPackages([
				{
					source: "git:github.com/user/repo@v1",
					extensions: ["extensions/main.ts"],
					skills: [],
					prompts: ["prompts/review.md"],
					themes: ["themes/dark.json"],
				},
			]);

			/** 常量 updated 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const updated = packageManager.addSourceToSettings("git:github.com/user/repo@v2");
			expect(updated).toBe(true);
			expect(settingsManager.getGlobalSettings().packages).toEqual([
				{
					source: "git:github.com/user/repo@v2",
					extensions: ["extensions/main.ts"],
					skills: [],
					prompts: ["prompts/review.md"],
					themes: ["themes/dark.json"],
				},
			]);
		});
	});

	// 用例分组：集中验证“HTTPS git URL parsing (old behavior)”相关功能。
	describe("HTTPS git URL parsing (old behavior)", () => {
		// 测试场景：验证“should parse HTTPS GitHub URLs correctly”对应的行为、结果与边界。
		it("should parse HTTPS GitHub URLs correctly", async () => {
			/** 常量 parsed 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const parsed = (packageManager as any).parseSource("https://github.com/user/repo");
			expect(parsed.type).toBe("git");
			expect(parsed.host).toBe("github.com");
			expect(parsed.path).toBe("user/repo");
			expect(parsed.pinned).toBe(false);
		});

		// 测试场景：验证“should parse HTTPS URLs with git: prefix”对应的行为、结果与边界。
		it("should parse HTTPS URLs with git: prefix", async () => {
			/** 常量 parsed 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const parsed = (packageManager as any).parseSource("git:https://github.com/user/repo");
			expect(parsed.type).toBe("git");
			expect(parsed.host).toBe("github.com");
			expect(parsed.path).toBe("user/repo");
		});

		// 测试场景：验证“should parse HTTPS URLs with ref”对应的行为、结果与边界。
		it("should parse HTTPS URLs with ref", async () => {
			/** 常量 parsed 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const parsed = (packageManager as any).parseSource("https://github.com/user/repo@v1.2.3");
			expect(parsed.type).toBe("git");
			expect(parsed.host).toBe("github.com");
			expect(parsed.path).toBe("user/repo");
			expect(parsed.ref).toBe("v1.2.3");
			expect(parsed.pinned).toBe(true);
		});

		// 测试场景：验证“should parse host/path shorthand only with git: prefix”对应的行为、结果与边界。
		it("should parse host/path shorthand only with git: prefix", async () => {
			/** 常量 parsed 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const parsed = (packageManager as any).parseSource("git:github.com/user/repo");
			expect(parsed.type).toBe("git");
			expect(parsed.host).toBe("github.com");
			expect(parsed.path).toBe("user/repo");
		});

		// 测试场景：验证“should treat host/path shorthand as local without git: prefix”对应的行为、结果与边界。
		it("should treat host/path shorthand as local without git: prefix", async () => {
			/** 常量 parsed 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const parsed = (packageManager as any).parseSource("github.com/user/repo");
			expect(parsed.type).toBe("local");
		});

		// 测试场景：验证“should parse HTTPS URLs with .git suffix”对应的行为、结果与边界。
		it("should parse HTTPS URLs with .git suffix", async () => {
			/** 常量 parsed 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const parsed = (packageManager as any).parseSource("https://github.com/user/repo.git");
			expect(parsed.type).toBe("git");
			expect(parsed.host).toBe("github.com");
			expect(parsed.path).toBe("user/repo");
		});

		// 测试场景：验证“should parse GitLab HTTPS URLs”对应的行为、结果与边界。
		it("should parse GitLab HTTPS URLs", async () => {
			/** 常量 parsed 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const parsed = (packageManager as any).parseSource("https://gitlab.com/user/repo");
			expect(parsed.type).toBe("git");
			expect(parsed.host).toBe("gitlab.com");
			expect(parsed.path).toBe("user/repo");
		});

		// 测试场景：验证“should parse Bitbucket HTTPS URLs”对应的行为、结果与边界。
		it("should parse Bitbucket HTTPS URLs", async () => {
			/** 常量 parsed 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const parsed = (packageManager as any).parseSource("https://bitbucket.org/user/repo");
			expect(parsed.type).toBe("git");
			expect(parsed.host).toBe("bitbucket.org");
			expect(parsed.path).toBe("user/repo");
		});

		// 测试场景：验证“should parse Codeberg HTTPS URLs”对应的行为、结果与边界。
		it("should parse Codeberg HTTPS URLs", async () => {
			/** 常量 parsed 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const parsed = (packageManager as any).parseSource("https://codeberg.org/user/repo");
			expect(parsed.type).toBe("git");
			expect(parsed.host).toBe("codeberg.org");
			expect(parsed.path).toBe("user/repo");
		});

		// 测试场景：验证“should generate correct package identity for protocol and git:-prefixed URLs”对应的行为、结果与边界。
		it("should generate correct package identity for protocol and git:-prefixed URLs", async () => {
			/** 常量 identity1 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const identity1 = (packageManager as any).getPackageIdentity("https://github.com/user/repo");
			/** 常量 identity2 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const identity2 = (packageManager as any).getPackageIdentity("https://github.com/user/repo@v1.0.0");
			/** 常量 identity3 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const identity3 = (packageManager as any).getPackageIdentity("git:github.com/user/repo");
			/** 常量 identity4 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const identity4 = (packageManager as any).getPackageIdentity("https://github.com/user/repo.git");

			// All should have the same identity (normalized)
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(identity1).toBe("git:github.com/user/repo");
			expect(identity2).toBe("git:github.com/user/repo");
			expect(identity3).toBe("git:github.com/user/repo");
			expect(identity4).toBe("git:github.com/user/repo");
		});

		// 测试场景：验证“should deduplicate git URLs with different supported formats”对应的行为、结果与边界。
		it("should deduplicate git URLs with different supported formats", async () => {
			/** 常量 pkgDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pkgDir = join(tempDir, "https-dedup-pkg");
			mkdirSync(join(pkgDir, "extensions"), { recursive: true });
			writeFileSync(join(pkgDir, "extensions", "test.ts"), "export default function() {}");

			// Mock the package as if it were cloned from different URL formats
			// In reality, these would all point to the same local dir after install
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			settingsManager.setPackages([
				"https://github.com/user/repo",
				"git:github.com/user/repo",
				"https://github.com/user/repo.git",
			]);

			// Since these URLs don't actually exist and we can't clone them,
			// we verify they produce the same identity
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const id1 = (packageManager as any).getPackageIdentity("https://github.com/user/repo");
			/** 常量 id2 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const id2 = (packageManager as any).getPackageIdentity("git:github.com/user/repo");
			/** 常量 id3 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const id3 = (packageManager as any).getPackageIdentity("https://github.com/user/repo.git");

			expect(id1).toBe(id2);
			expect(id2).toBe(id3);
		});

		// 测试场景：验证“should handle HTTPS URLs with refs in resolve”对应的行为、结果与边界。
		it("should handle HTTPS URLs with refs in resolve", async () => {
			// This tests that the ref is properly extracted and stored
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const parsed = (packageManager as any).parseSource("https://github.com/user/repo@main");
			expect(parsed.ref).toBe("main");
			expect(parsed.pinned).toBe(true);

			/** 常量 parsed2 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const parsed2 = (packageManager as any).parseSource("https://github.com/user/repo@feature/branch");
			expect(parsed2.ref).toBe("feature/branch");
		});
	});

	// 用例分组：集中验证“pattern filtering in top-level arrays”相关功能。
	describe("pattern filtering in top-level arrays", () => {
		// 测试场景：验证“should exclude extensions with ! pattern”对应的行为、结果与边界。
		it("should exclude extensions with ! pattern", async () => {
			/** 常量 extDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extDir = join(agentDir, "extensions");
			mkdirSync(extDir, { recursive: true });
			writeFileSync(join(extDir, "keep.ts"), "export default function() {}");
			writeFileSync(join(extDir, "remove.ts"), "export default function() {}");

			settingsManager.setExtensionPaths(["extensions", "!**/remove.ts"]);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			expect(result.extensions.some((r) => isEnabled(r, "keep.ts"))).toBe(true);
			expect(result.extensions.some((r) => isDisabled(r, "remove.ts"))).toBe(true);
		});

		// 测试场景：验证“should filter themes with glob patterns”对应的行为、结果与边界。
		it("should filter themes with glob patterns", async () => {
			/** 常量 themesDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const themesDir = join(agentDir, "themes");
			mkdirSync(themesDir, { recursive: true });
			writeFileSync(join(themesDir, "dark.json"), "{}");
			writeFileSync(join(themesDir, "light.json"), "{}");
			writeFileSync(join(themesDir, "funky.json"), "{}");

			settingsManager.setThemePaths(["themes", "!funky.json"]);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			expect(result.themes.some((r) => isEnabled(r, "dark.json"))).toBe(true);
			expect(result.themes.some((r) => isEnabled(r, "light.json"))).toBe(true);
			expect(result.themes.some((r) => isDisabled(r, "funky.json"))).toBe(true);
		});

		// 测试场景：验证“should filter prompts with exclusion pattern”对应的行为、结果与边界。
		it("should filter prompts with exclusion pattern", async () => {
			/** 常量 promptsDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const promptsDir = join(agentDir, "prompts");
			mkdirSync(promptsDir, { recursive: true });
			writeFileSync(join(promptsDir, "review.md"), "Review code");
			writeFileSync(join(promptsDir, "explain.md"), "Explain code");

			settingsManager.setPromptTemplatePaths(["prompts", "!explain.md"]);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			expect(result.prompts.some((r) => isEnabled(r, "review.md"))).toBe(true);
			expect(result.prompts.some((r) => isDisabled(r, "explain.md"))).toBe(true);
		});

		// 测试场景：验证“should filter skills with exclusion pattern”对应的行为、结果与边界。
		it("should filter skills with exclusion pattern", async () => {
			/** 常量 skillsDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const skillsDir = join(agentDir, "skills");
			mkdirSync(join(skillsDir, "good-skill"), { recursive: true });
			mkdirSync(join(skillsDir, "bad-skill"), { recursive: true });
			writeFileSync(
				join(skillsDir, "good-skill", "SKILL.md"),
				"---\nname: good-skill\ndescription: Good\n---\nContent",
			);
			writeFileSync(
				join(skillsDir, "bad-skill", "SKILL.md"),
				"---\nname: bad-skill\ndescription: Bad\n---\nContent",
			);

			settingsManager.setSkillPaths(["skills", "!**/bad-skill"]);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			expect(result.skills.some((r) => isEnabled(r, "good-skill", "includes"))).toBe(true);
			expect(result.skills.some((r) => isDisabled(r, "bad-skill", "includes"))).toBe(true);
		});

		// 测试场景：验证“should work without patterns (backward compatible)”对应的行为、结果与边界。
		it("should work without patterns (backward compatible)", async () => {
			/** 常量 extDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extDir = join(agentDir, "extensions");
			mkdirSync(extDir, { recursive: true });
			/** 常量 extPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extPath = join(extDir, "my-ext.ts");
			writeFileSync(extPath, "export default function() {}");

			settingsManager.setExtensionPaths(["extensions/my-ext.ts"]);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			expect(result.extensions.some((r) => r.path === extPath && r.enabled)).toBe(true);
		});
	});

	// 用例分组：集中验证“pattern filtering in pi manifest”相关功能。
	describe("pattern filtering in pi manifest", () => {
		// 测试场景：验证“should support glob patterns in manifest extensions”对应的行为、结果与边界。
		it("should support glob patterns in manifest extensions", async () => {
			/** 常量 pkgDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pkgDir = join(tempDir, "manifest-pkg");
			mkdirSync(join(pkgDir, "extensions"), { recursive: true });
			mkdirSync(join(pkgDir, "node_modules/dep/extensions"), { recursive: true });
			writeFileSync(join(pkgDir, "extensions", "local.ts"), "export default function() {}");
			writeFileSync(join(pkgDir, "node_modules/dep/extensions", "remote.ts"), "export default function() {}");
			writeFileSync(join(pkgDir, "node_modules/dep/extensions", "skip.ts"), "export default function() {}");
			writeFileSync(
				join(pkgDir, "package.json"),
				JSON.stringify({
					name: "manifest-pkg",
					pi: {
						extensions: ["extensions", "node_modules/dep/extensions", "!**/skip.ts"],
					},
				}),
			);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolveExtensionSources([pkgDir]);
			expect(result.extensions.some((r) => isEnabled(r, "local.ts"))).toBe(true);
			expect(result.extensions.some((r) => isEnabled(r, "remote.ts"))).toBe(true);
			expect(result.extensions.some((r) => pathEndsWith(r.path, "skip.ts"))).toBe(false);
		});

		// 测试场景：验证“should support glob patterns in manifest skills”对应的行为、结果与边界。
		it("should support glob patterns in manifest skills", async () => {
			/** 常量 pkgDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pkgDir = join(tempDir, "skill-manifest-pkg");
			mkdirSync(join(pkgDir, "skills/good-skill"), { recursive: true });
			mkdirSync(join(pkgDir, "skills/bad-skill"), { recursive: true });
			writeFileSync(
				join(pkgDir, "skills/good-skill", "SKILL.md"),
				"---\nname: good-skill\ndescription: Good\n---\nContent",
			);
			writeFileSync(
				join(pkgDir, "skills/bad-skill", "SKILL.md"),
				"---\nname: bad-skill\ndescription: Bad\n---\nContent",
			);
			writeFileSync(
				join(pkgDir, "package.json"),
				JSON.stringify({
					name: "skill-manifest-pkg",
					pi: {
						skills: ["skills", "!**/bad-skill"],
					},
				}),
			);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolveExtensionSources([pkgDir]);
			expect(result.skills.some((r) => isEnabled(r, "good-skill", "includes"))).toBe(true);
			expect(result.skills.some((r) => r.path.includes("bad-skill"))).toBe(false);
		});

		// 测试场景：验证“should expand positive glob manifest entries before collecting skills”对应的行为、结果与边界。
		it("should expand positive glob manifest entries before collecting skills", async () => {
			/** 常量 pkgDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pkgDir = join(tempDir, "skill-manifest-glob-pkg");
			mkdirSync(join(pkgDir, "plugins/pdf-to-markdown/skills/pdf-to-markdown"), { recursive: true });
			mkdirSync(join(pkgDir, "plugins/nutrient-dws/skills/document-processor-api"), { recursive: true });
			writeFileSync(
				join(pkgDir, "plugins/pdf-to-markdown/skills/pdf-to-markdown", "SKILL.md"),
				"---\nname: pdf-to-markdown\ndescription: PDF to Markdown\n---\nContent",
			);
			writeFileSync(
				join(pkgDir, "plugins/nutrient-dws/skills/document-processor-api", "SKILL.md"),
				"---\nname: document-processor-api\ndescription: DWS\n---\nContent",
			);
			writeFileSync(
				join(pkgDir, "package.json"),
				JSON.stringify({
					name: "skill-manifest-glob-pkg",
					pi: {
						skills: ["./plugins/*/skills"],
					},
				}),
			);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolveExtensionSources([pkgDir]);
			expect(result.skills.some((r) => isEnabled(r, "pdf-to-markdown", "includes"))).toBe(true);
			expect(result.skills.some((r) => isEnabled(r, "document-processor-api", "includes"))).toBe(true);
		});
	});

	// 用例分组：集中验证“pattern filtering in package filters”相关功能。
	describe("pattern filtering in package filters", () => {
		// 测试场景：验证“should apply user filters on top of manifest filters (not replace)”对应的行为、结果与边界。
		it("should apply user filters on top of manifest filters (not replace)", async () => {
			// Manifest excludes baz.ts, user excludes bar.ts
			// Result should exclude BOTH
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const pkgDir = join(tempDir, "layered-pkg");
			mkdirSync(join(pkgDir, "extensions"), { recursive: true });
			writeFileSync(join(pkgDir, "extensions", "foo.ts"), "export default function() {}");
			writeFileSync(join(pkgDir, "extensions", "bar.ts"), "export default function() {}");
			writeFileSync(join(pkgDir, "extensions", "baz.ts"), "export default function() {}");
			writeFileSync(
				join(pkgDir, "package.json"),
				JSON.stringify({
					name: "layered-pkg",
					pi: {
						extensions: ["extensions", "!**/baz.ts"],
					},
				}),
			);

			// User filter adds exclusion for bar.ts
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			settingsManager.setPackages([
				{
					source: pkgDir,
					extensions: ["!**/bar.ts"],
					skills: [],
					prompts: [],
					themes: [],
				},
			]);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			// foo.ts should be included (not excluded by anyone)
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(result.extensions.some((r) => isEnabled(r, "foo.ts"))).toBe(true);
			// bar.ts should be excluded (by user)
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(result.extensions.some((r) => isDisabled(r, "bar.ts"))).toBe(true);
			// baz.ts should be excluded (by manifest)
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(result.extensions.some((r) => pathEndsWith(r.path, "baz.ts"))).toBe(false);
		});

		// 测试场景：验证“should exclude extensions from package with ! pattern”对应的行为、结果与边界。
		it("should exclude extensions from package with ! pattern", async () => {
			/** 常量 pkgDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pkgDir = join(tempDir, "pattern-pkg");
			mkdirSync(join(pkgDir, "extensions"), { recursive: true });
			writeFileSync(join(pkgDir, "extensions", "foo.ts"), "export default function() {}");
			writeFileSync(join(pkgDir, "extensions", "bar.ts"), "export default function() {}");
			writeFileSync(join(pkgDir, "extensions", "baz.ts"), "export default function() {}");

			settingsManager.setPackages([
				{
					source: pkgDir,
					extensions: ["!**/baz.ts"],
					skills: [],
					prompts: [],
					themes: [],
				},
			]);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			expect(result.extensions.some((r) => isEnabled(r, "foo.ts"))).toBe(true);
			expect(result.extensions.some((r) => isEnabled(r, "bar.ts"))).toBe(true);
			expect(result.extensions.some((r) => isDisabled(r, "baz.ts"))).toBe(true);
		});

		// 测试场景：验证“should filter themes from package”对应的行为、结果与边界。
		it("should filter themes from package", async () => {
			/** 常量 pkgDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pkgDir = join(tempDir, "theme-pkg");
			mkdirSync(join(pkgDir, "themes"), { recursive: true });
			writeFileSync(join(pkgDir, "themes", "nice.json"), "{}");
			writeFileSync(join(pkgDir, "themes", "ugly.json"), "{}");

			settingsManager.setPackages([
				{
					source: pkgDir,
					extensions: [],
					skills: [],
					prompts: [],
					themes: ["!ugly.json"],
				},
			]);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			expect(result.themes.some((r) => isEnabled(r, "nice.json"))).toBe(true);
			expect(result.themes.some((r) => isDisabled(r, "ugly.json"))).toBe(true);
		});

		// 测试场景：验证“should combine include and exclude patterns”对应的行为、结果与边界。
		it("should combine include and exclude patterns", async () => {
			/** 常量 pkgDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pkgDir = join(tempDir, "combo-pkg");
			mkdirSync(join(pkgDir, "extensions"), { recursive: true });
			writeFileSync(join(pkgDir, "extensions", "alpha.ts"), "export default function() {}");
			writeFileSync(join(pkgDir, "extensions", "beta.ts"), "export default function() {}");
			writeFileSync(join(pkgDir, "extensions", "gamma.ts"), "export default function() {}");

			settingsManager.setPackages([
				{
					source: pkgDir,
					extensions: ["**/alpha.ts", "**/beta.ts", "!**/beta.ts"],
					skills: [],
					prompts: [],
					themes: [],
				},
			]);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			expect(result.extensions.some((r) => isEnabled(r, "alpha.ts"))).toBe(true);
			expect(result.extensions.some((r) => isDisabled(r, "beta.ts"))).toBe(true);
			expect(result.extensions.some((r) => isDisabled(r, "gamma.ts"))).toBe(true);
		});

		// 测试场景：验证“should work with direct paths (no patterns)”对应的行为、结果与边界。
		it("should work with direct paths (no patterns)", async () => {
			/** 常量 pkgDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pkgDir = join(tempDir, "direct-pkg");
			mkdirSync(join(pkgDir, "extensions"), { recursive: true });
			writeFileSync(join(pkgDir, "extensions", "one.ts"), "export default function() {}");
			writeFileSync(join(pkgDir, "extensions", "two.ts"), "export default function() {}");

			settingsManager.setPackages([
				{
					source: pkgDir,
					extensions: ["extensions/one.ts"],
					skills: [],
					prompts: [],
					themes: [],
				},
			]);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			expect(result.extensions.some((r) => isEnabled(r, "one.ts"))).toBe(true);
			expect(result.extensions.some((r) => isDisabled(r, "two.ts"))).toBe(true);
		});

		// 测试场景：验证“should resolve autoload-disabled project package entries as deltas over global packages”对应的行为、结果与边界。
		it("should resolve autoload-disabled project package entries as deltas over global packages", async () => {
			/** 常量 pkgDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pkgDir = join(agentDir, "npm", "node_modules", "pi-tools");
			mkdirSync(join(pkgDir, "extensions"), { recursive: true });
			writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ name: "pi-tools", version: "1.0.0" }));
			writeFileSync(join(pkgDir, "extensions", "foo.ts"), "export default function() {}");
			writeFileSync(join(pkgDir, "extensions", "bar.ts"), "export default function() {}");
			settingsManager.setPackages(["npm:pi-tools"]);
			settingsManager.setProjectPackages([
				{ source: "npm:pi-tools", autoload: false, extensions: ["-extensions/foo.ts"] },
			]);
			/** 常量 runCommandSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runCommandSpy = vi
				.spyOn(packageManager as unknown as PackageManagerInternals, "runCommand")
				.mockRejectedValue(new Error("unexpected install"));

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			/** 常量 states 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const states = Object.fromEntries(
				result.extensions.map((resource) => [
					resource.path,
					{ enabled: resource.enabled, scope: resource.metadata.scope },
				]),
			);
			expect(runCommandSpy).not.toHaveBeenCalled();
			expect(states[join(pkgDir, "extensions", "foo.ts")]).toEqual({ enabled: false, scope: "project" });
			expect(states[join(pkgDir, "extensions", "bar.ts")]).toEqual({ enabled: true, scope: "user" });
		});

		// 测试场景：验证“should resolve autoload-disabled package entries as positive-only without a global package”对应的行为、结果与边界。
		it("should resolve autoload-disabled package entries as positive-only without a global package", async () => {
			/** 常量 pkgDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pkgDir = join(tempDir, "positive-only-pkg");
			mkdirSync(join(pkgDir, "extensions"), { recursive: true });
			mkdirSync(join(pkgDir, "skills", "foo"), { recursive: true });
			writeFileSync(join(pkgDir, "extensions", "foo.ts"), "export default function() {}");
			writeFileSync(join(pkgDir, "extensions", "bar.ts"), "export default function() {}");
			writeFileSync(join(pkgDir, "skills", "foo", "SKILL.md"), "# Foo\n");
			settingsManager.setProjectPackages([
				{ source: relative(join(tempDir, ".pi"), pkgDir), autoload: false, extensions: ["+extensions/foo.ts"] },
			]);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();

			expect(result.extensions.map((resource) => resource.path)).toEqual([join(pkgDir, "extensions", "foo.ts")]);
			expect(result.skills).toEqual([]);
		});
	});

	// 用例分组：集中验证“force-include patterns”相关功能。
	describe("force-include patterns", () => {
		// 测试场景：验证“should force-include extensions with + pattern after exclusion”对应的行为、结果与边界。
		it("should force-include extensions with + pattern after exclusion", async () => {
			/** 常量 extDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extDir = join(agentDir, "extensions");
			mkdirSync(extDir, { recursive: true });
			writeFileSync(join(extDir, "keep.ts"), "export default function() {}");
			writeFileSync(join(extDir, "excluded.ts"), "export default function() {}");
			writeFileSync(join(extDir, "force-back.ts"), "export default function() {}");

			// Exclude all, then force-include one back
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			settingsManager.setExtensionPaths(["extensions", "!extensions/*.ts", "+extensions/force-back.ts"]);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			expect(result.extensions.some((r) => isDisabled(r, "keep.ts"))).toBe(true);
			expect(result.extensions.some((r) => isDisabled(r, "excluded.ts"))).toBe(true);
			expect(result.extensions.some((r) => isEnabled(r, "force-back.ts"))).toBe(true);
		});

		// 测试场景：验证“should force-include overrides exclude in package filters”对应的行为、结果与边界。
		it("should force-include overrides exclude in package filters", async () => {
			/** 常量 pkgDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pkgDir = join(tempDir, "force-pkg");
			mkdirSync(join(pkgDir, "extensions"), { recursive: true });
			writeFileSync(join(pkgDir, "extensions", "alpha.ts"), "export default function() {}");
			writeFileSync(join(pkgDir, "extensions", "beta.ts"), "export default function() {}");
			writeFileSync(join(pkgDir, "extensions", "gamma.ts"), "export default function() {}");

			settingsManager.setPackages([
				{
					source: pkgDir,
					extensions: ["!**/*.ts", "+extensions/beta.ts"],
					skills: [],
					prompts: [],
					themes: [],
				},
			]);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			expect(result.extensions.some((r) => isDisabled(r, "alpha.ts"))).toBe(true);
			expect(result.extensions.some((r) => isEnabled(r, "beta.ts"))).toBe(true);
			expect(result.extensions.some((r) => isDisabled(r, "gamma.ts"))).toBe(true);
		});

		// 测试场景：验证“should force-include multiple resources”对应的行为、结果与边界。
		it("should force-include multiple resources", async () => {
			/** 常量 pkgDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pkgDir = join(tempDir, "multi-force-pkg");
			mkdirSync(join(pkgDir, "skills/skill-a"), { recursive: true });
			mkdirSync(join(pkgDir, "skills/skill-b"), { recursive: true });
			mkdirSync(join(pkgDir, "skills/skill-c"), { recursive: true });
			writeFileSync(join(pkgDir, "skills/skill-a", "SKILL.md"), "---\nname: skill-a\ndescription: A\n---\nContent");
			writeFileSync(join(pkgDir, "skills/skill-b", "SKILL.md"), "---\nname: skill-b\ndescription: B\n---\nContent");
			writeFileSync(join(pkgDir, "skills/skill-c", "SKILL.md"), "---\nname: skill-c\ndescription: C\n---\nContent");

			settingsManager.setPackages([
				{
					source: pkgDir,
					extensions: [],
					skills: ["!**/*", "+skills/skill-a", "+skills/skill-c"],
					prompts: [],
					themes: [],
				},
			]);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			expect(result.skills.some((r) => isEnabled(r, "skill-a", "includes"))).toBe(true);
			expect(result.skills.some((r) => isDisabled(r, "skill-b", "includes"))).toBe(true);
			expect(result.skills.some((r) => isEnabled(r, "skill-c", "includes"))).toBe(true);
		});

		// 测试场景：验证“should force-include after specific exclusion”对应的行为、结果与边界。
		it("should force-include after specific exclusion", async () => {
			/** 常量 extDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extDir = join(agentDir, "extensions");
			mkdirSync(extDir, { recursive: true });
			writeFileSync(join(extDir, "a.ts"), "export default function() {}");
			writeFileSync(join(extDir, "b.ts"), "export default function() {}");

			// Specifically exclude b.ts, then force it back
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			settingsManager.setExtensionPaths(["extensions", "!extensions/b.ts", "+extensions/b.ts"]);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			expect(result.extensions.some((r) => isEnabled(r, "a.ts"))).toBe(true);
			expect(result.extensions.some((r) => isEnabled(r, "b.ts"))).toBe(true);
		});

		// 测试场景：验证“should handle force-include in manifest patterns”对应的行为、结果与边界。
		it("should handle force-include in manifest patterns", async () => {
			/** 常量 pkgDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pkgDir = join(tempDir, "manifest-force-pkg");
			mkdirSync(join(pkgDir, "extensions"), { recursive: true });
			writeFileSync(join(pkgDir, "extensions", "one.ts"), "export default function() {}");
			writeFileSync(join(pkgDir, "extensions", "two.ts"), "export default function() {}");
			writeFileSync(join(pkgDir, "extensions", "three.ts"), "export default function() {}");
			writeFileSync(
				join(pkgDir, "package.json"),
				JSON.stringify({
					name: "manifest-force-pkg",
					pi: {
						extensions: ["extensions", "!**/two.ts", "+extensions/two.ts"],
					},
				}),
			);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolveExtensionSources([pkgDir]);
			expect(result.extensions.some((r) => isEnabled(r, "one.ts"))).toBe(true);
			expect(result.extensions.some((r) => isEnabled(r, "two.ts"))).toBe(true);
			expect(result.extensions.some((r) => isEnabled(r, "three.ts"))).toBe(true);
		});

		// 测试场景：验证“should force-include themes”对应的行为、结果与边界。
		it("should force-include themes", async () => {
			/** 常量 themesDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const themesDir = join(agentDir, "themes");
			mkdirSync(themesDir, { recursive: true });
			writeFileSync(join(themesDir, "dark.json"), "{}");
			writeFileSync(join(themesDir, "light.json"), "{}");
			writeFileSync(join(themesDir, "special.json"), "{}");

			settingsManager.setThemePaths(["themes", "!themes/*.json", "+themes/special.json"]);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			expect(result.themes.some((r) => isDisabled(r, "dark.json"))).toBe(true);
			expect(result.themes.some((r) => isDisabled(r, "light.json"))).toBe(true);
			expect(result.themes.some((r) => isEnabled(r, "special.json"))).toBe(true);
		});

		// 测试场景：验证“should force-include prompts”对应的行为、结果与边界。
		it("should force-include prompts", async () => {
			/** 常量 promptsDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const promptsDir = join(agentDir, "prompts");
			mkdirSync(promptsDir, { recursive: true });
			writeFileSync(join(promptsDir, "review.md"), "Review");
			writeFileSync(join(promptsDir, "explain.md"), "Explain");
			writeFileSync(join(promptsDir, "debug.md"), "Debug");

			settingsManager.setPromptTemplatePaths(["prompts", "!prompts/*.md", "+prompts/debug.md"]);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			expect(result.prompts.some((r) => isDisabled(r, "review.md"))).toBe(true);
			expect(result.prompts.some((r) => isDisabled(r, "explain.md"))).toBe(true);
			expect(result.prompts.some((r) => isEnabled(r, "debug.md"))).toBe(true);
		});
	});

	// 用例分组：集中验证“force-exclude patterns”相关功能。
	describe("force-exclude patterns", () => {
		// 测试场景：验证“should force-exclude top-level resources”对应的行为、结果与边界。
		it("should force-exclude top-level resources", async () => {
			/** 常量 extDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extDir = join(agentDir, "extensions");
			mkdirSync(extDir, { recursive: true });
			writeFileSync(join(extDir, "alpha.ts"), "export default function() {}");
			writeFileSync(join(extDir, "beta.ts"), "export default function() {}");

			settingsManager.setExtensionPaths(["extensions", "+extensions/alpha.ts", "-extensions/alpha.ts"]);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			expect(result.extensions.some((r) => isDisabled(r, "alpha.ts"))).toBe(true);
			expect(result.extensions.some((r) => isEnabled(r, "beta.ts"))).toBe(true);
		});

		// 测试场景：验证“should force-exclude in package filters”对应的行为、结果与边界。
		it("should force-exclude in package filters", async () => {
			/** 常量 pkgDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pkgDir = join(tempDir, "force-exclude-pkg");
			mkdirSync(join(pkgDir, "extensions"), { recursive: true });
			writeFileSync(join(pkgDir, "extensions", "alpha.ts"), "export default function() {}");
			writeFileSync(join(pkgDir, "extensions", "beta.ts"), "export default function() {}");

			settingsManager.setPackages([
				{
					source: pkgDir,
					extensions: ["extensions/*.ts", "+extensions/alpha.ts", "-extensions/alpha.ts"],
					skills: [],
					prompts: [],
					themes: [],
				},
			]);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			expect(result.extensions.some((r) => isDisabled(r, "alpha.ts"))).toBe(true);
			expect(result.extensions.some((r) => isEnabled(r, "beta.ts"))).toBe(true);
		});
	});

	// 用例分组：集中验证“package deduplication”相关功能。
	describe("package deduplication", () => {
		// 测试场景：验证“should dedupe same local package in global and project (project wins)”对应的行为、结果与边界。
		it("should dedupe same local package in global and project (project wins)", async () => {
			/** 常量 pkgDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pkgDir = join(tempDir, "shared-pkg");
			mkdirSync(join(pkgDir, "extensions"), { recursive: true });
			writeFileSync(join(pkgDir, "extensions", "shared.ts"), "export default function() {}");

			// Same package in both global and project
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			settingsManager.setPackages([pkgDir]); // global
			settingsManager.setProjectPackages([pkgDir]); // project

			// Debug: verify settings are stored correctly
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const globalSettings = settingsManager.getGlobalSettings();
			/** 常量 projectSettings 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const projectSettings = settingsManager.getProjectSettings();
			expect(globalSettings.packages).toEqual([pkgDir]);
			expect(projectSettings.packages).toEqual([pkgDir]);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			// Should only appear once (deduped), with project scope
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const sharedPaths = result.extensions.filter((r) => r.path.includes("shared-pkg"));
			expect(sharedPaths.length).toBe(1);
			expect(sharedPaths[0].metadata.scope).toBe("project");
		});

		// 测试场景：验证“should keep both if different packages”对应的行为、结果与边界。
		it("should keep both if different packages", async () => {
			/** 常量 pkg1Dir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pkg1Dir = join(tempDir, "pkg1");
			/** 常量 pkg2Dir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pkg2Dir = join(tempDir, "pkg2");
			mkdirSync(join(pkg1Dir, "extensions"), { recursive: true });
			mkdirSync(join(pkg2Dir, "extensions"), { recursive: true });
			writeFileSync(join(pkg1Dir, "extensions", "from-pkg1.ts"), "export default function() {}");
			writeFileSync(join(pkg2Dir, "extensions", "from-pkg2.ts"), "export default function() {}");

			settingsManager.setPackages([pkg1Dir]); // global
			settingsManager.setProjectPackages([pkg2Dir]); // project

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			expect(result.extensions.some((r) => r.path.includes("pkg1"))).toBe(true);
			expect(result.extensions.some((r) => r.path.includes("pkg2"))).toBe(true);
		});

		// 测试场景：验证“should dedupe SSH and HTTPS URLs for same repo”对应的行为、结果与边界。
		it("should dedupe SSH and HTTPS URLs for same repo", async () => {
			// Same repository, different URL formats
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const httpsUrl = "https://github.com/user/repo";
			/** 常量 sshUrl 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const sshUrl = "git:git@github.com:user/repo";

			/** 常量 httpsIdentity 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const httpsIdentity = (packageManager as any).getPackageIdentity(httpsUrl);
			/** 常量 sshIdentity 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const sshIdentity = (packageManager as any).getPackageIdentity(sshUrl);

			// Both should resolve to the same identity
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(httpsIdentity).toBe("git:github.com/user/repo");
			expect(sshIdentity).toBe("git:github.com/user/repo");
			expect(httpsIdentity).toBe(sshIdentity);
		});

		// 测试场景：验证“should dedupe SSH and HTTPS with refs”对应的行为、结果与边界。
		it("should dedupe SSH and HTTPS with refs", async () => {
			/** 常量 httpsUrl 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const httpsUrl = "https://github.com/user/repo@v1.0.0";
			/** 常量 sshUrl 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const sshUrl = "git:git@github.com:user/repo@v1.0.0";

			/** 常量 httpsIdentity 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const httpsIdentity = (packageManager as any).getPackageIdentity(httpsUrl);
			/** 常量 sshIdentity 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const sshIdentity = (packageManager as any).getPackageIdentity(sshUrl);

			// Identity should ignore ref (version)
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(httpsIdentity).toBe("git:github.com/user/repo");
			expect(sshIdentity).toBe("git:github.com/user/repo");
			expect(httpsIdentity).toBe(sshIdentity);
		});

		// 测试场景：验证“should dedupe SSH URL with ssh:// protocol and git@ format”对应的行为、结果与边界。
		it("should dedupe SSH URL with ssh:// protocol and git@ format", async () => {
			/** 常量 sshProtocol 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const sshProtocol = "ssh://git@github.com/user/repo";
			/** 常量 gitAt 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const gitAt = "git:git@github.com:user/repo";

			/** 常量 sshProtocolIdentity 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const sshProtocolIdentity = (packageManager as any).getPackageIdentity(sshProtocol);
			/** 常量 gitAtIdentity 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const gitAtIdentity = (packageManager as any).getPackageIdentity(gitAt);

			// Both SSH formats should resolve to same identity
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(sshProtocolIdentity).toBe("git:github.com/user/repo");
			expect(gitAtIdentity).toBe("git:github.com/user/repo");
			expect(sshProtocolIdentity).toBe(gitAtIdentity);
		});

		// 测试场景：验证“should dedupe all supported URL formats for same repo”对应的行为、结果与边界。
		it("should dedupe all supported URL formats for same repo", async () => {
			/** 常量 urls 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const urls = [
				"https://github.com/user/repo",
				"https://github.com/user/repo.git",
				"ssh://git@github.com/user/repo",
				"git:https://github.com/user/repo",
				"git:github.com/user/repo",
				"git:git@github.com:user/repo",
				"git:git@github.com:user/repo.git",
			];

			/** 常量 identities 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const identities = urls.map((url) => (packageManager as any).getPackageIdentity(url));

			// All should produce the same identity
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const uniqueIdentities = [...new Set(identities)];
			expect(uniqueIdentities.length).toBe(1);
			expect(uniqueIdentities[0]).toBe("git:github.com/user/repo");
		});

		// 测试场景：验证“should keep different repos separate (HTTPS vs SSH)”对应的行为、结果与边界。
		it("should keep different repos separate (HTTPS vs SSH)", async () => {
			/** 常量 repo1Https 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const repo1Https = "https://github.com/user/repo1";
			/** 常量 repo2Ssh 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const repo2Ssh = "git:git@github.com:user/repo2";

			/** 常量 id1 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const id1 = (packageManager as any).getPackageIdentity(repo1Https);
			/** 常量 id2 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const id2 = (packageManager as any).getPackageIdentity(repo2Ssh);

			// Different repos should have different identities
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(id1).toBe("git:github.com/user/repo1");
			expect(id2).toBe("git:github.com/user/repo2");
			expect(id1).not.toBe(id2);
		});
	});

	// 用例分组：集中验证“multi-file extension discovery (issue #1102)”相关功能。
	describe("multi-file extension discovery (issue #1102)", () => {
		// 测试场景：验证“should only load index.ts from subdirectories, not helper modules”对应的行为、结果与边界。
		it("should only load index.ts from subdirectories, not helper modules", async () => {
			// Regression test: packages with multi-file extensions in subdirectories
			// should only load the index.ts entry point, not helper modules like agents.ts
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const pkgDir = join(tempDir, "multifile-pkg");
			mkdirSync(join(pkgDir, "extensions", "subagent"), { recursive: true });

			// Main entry point
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			writeFileSync(
				join(pkgDir, "extensions", "subagent", "index.ts"),
				`import { helper } from "./agents.ts";
export default function(api) { api.registerTool({ name: "test", description: "test", execute: async () => helper() }); }`,
			);
			// Helper module (should NOT be loaded as standalone extension)
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			writeFileSync(
				join(pkgDir, "extensions", "subagent", "agents.ts"),
				`export function helper() { return "helper"; }`,
			);
			// Top-level extension file (should be loaded)
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			writeFileSync(join(pkgDir, "extensions", "standalone.ts"), "export default function(api) {}");

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolveExtensionSources([pkgDir]);

			// Should find the index.ts and standalone.ts
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(result.extensions.some((r) => pathEndsWith(r.path, "subagent/index.ts") && r.enabled)).toBe(true);
			expect(result.extensions.some((r) => pathEndsWith(r.path, "standalone.ts") && r.enabled)).toBe(true);

			// Should NOT find agents.ts as a standalone extension
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(result.extensions.some((r) => pathEndsWith(r.path, "agents.ts"))).toBe(false);
		});

		// 测试场景：验证“should respect package.json pi.extensions manifest in subdirectories”对应的行为、结果与边界。
		it("should respect package.json pi.extensions manifest in subdirectories", async () => {
			/** 常量 pkgDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pkgDir = join(tempDir, "manifest-subdir-pkg");
			mkdirSync(join(pkgDir, "extensions", "custom"), { recursive: true });

			// Subdirectory with its own manifest
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			writeFileSync(
				join(pkgDir, "extensions", "custom", "package.json"),
				JSON.stringify({
					pi: {
						extensions: ["./main.ts"],
					},
				}),
			);
			writeFileSync(join(pkgDir, "extensions", "custom", "main.ts"), "export default function(api) {}");
			writeFileSync(join(pkgDir, "extensions", "custom", "utils.ts"), "export const util = 1;");

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolveExtensionSources([pkgDir]);

			// Should find main.ts declared in manifest
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(result.extensions.some((r) => pathEndsWith(r.path, "custom/main.ts") && r.enabled)).toBe(true);

			// Should NOT find utils.ts (not declared in manifest)
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(result.extensions.some((r) => pathEndsWith(r.path, "utils.ts"))).toBe(false);
		});

		// 测试场景：验证“should handle mixed top-level files and subdirectories”对应的行为、结果与边界。
		it("should handle mixed top-level files and subdirectories", async () => {
			/** 常量 pkgDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pkgDir = join(tempDir, "mixed-pkg");
			mkdirSync(join(pkgDir, "extensions", "complex"), { recursive: true });

			// Top-level extension
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			writeFileSync(join(pkgDir, "extensions", "simple.ts"), "export default function(api) {}");

			// Subdirectory with index.ts + helpers
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			writeFileSync(
				join(pkgDir, "extensions", "complex", "index.ts"),
				"import { a } from './a.ts'; export default function(api) {}",
			);
			writeFileSync(join(pkgDir, "extensions", "complex", "a.ts"), "export const a = 1;");
			writeFileSync(join(pkgDir, "extensions", "complex", "b.ts"), "export const b = 2;");

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolveExtensionSources([pkgDir]);

			// Should find simple.ts and complex/index.ts
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(result.extensions.some((r) => pathEndsWith(r.path, "simple.ts") && r.enabled)).toBe(true);
			expect(result.extensions.some((r) => pathEndsWith(r.path, "complex/index.ts") && r.enabled)).toBe(true);

			// Should NOT find helper modules
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(result.extensions.some((r) => pathEndsWith(r.path, "complex/a.ts"))).toBe(false);
			expect(result.extensions.some((r) => pathEndsWith(r.path, "complex/b.ts"))).toBe(false);

			// Total should be exactly 2
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(result.extensions.filter((r) => r.enabled).length).toBe(2);
		});

		// 测试场景：验证“should skip subdirectories without index.ts or manifest”对应的行为、结果与边界。
		it("should skip subdirectories without index.ts or manifest", async () => {
			/** 常量 pkgDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pkgDir = join(tempDir, "no-entry-pkg");
			mkdirSync(join(pkgDir, "extensions", "broken"), { recursive: true });

			// Subdirectory with no index.ts and no manifest
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			writeFileSync(join(pkgDir, "extensions", "broken", "helper.ts"), "export const x = 1;");
			writeFileSync(join(pkgDir, "extensions", "broken", "another.ts"), "export const y = 2;");

			// Valid top-level extension
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			writeFileSync(join(pkgDir, "extensions", "valid.ts"), "export default function(api) {}");

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolveExtensionSources([pkgDir]);

			// Should only find the valid top-level extension
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(result.extensions.some((r) => pathEndsWith(r.path, "valid.ts") && r.enabled)).toBe(true);
			expect(result.extensions.filter((r) => r.enabled).length).toBe(1);
		});
	});

	// 用例分组：集中验证“offline mode and network timeouts”相关功能。
	describe("offline mode and network timeouts", () => {
		// 测试场景：验证“should update npm range packages using the configured spec”对应的行为、结果与边界。
		it("should update npm range packages using the configured spec", async () => {
			/** 常量 installedPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const installedPath = join(tempDir, ".pi", "npm", "node_modules", "example");
			mkdirSync(installedPath, { recursive: true });
			writeFileSync(join(installedPath, "package.json"), JSON.stringify({ name: "example", version: "1.0.0" }));
			settingsManager.setProjectPackages(["npm:example@^1.0.0"]);

			/** 常量 runCommandCaptureSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runCommandCaptureSpy = vi
				.spyOn(packageManager as any, "runCommandCapture")
				.mockResolvedValue('["1.0.0","1.2.0"]');
			/** 常量 runCommandSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runCommandSpy = vi.spyOn(packageManager as any, "runCommand").mockResolvedValue(undefined);

			await packageManager.update("npm:example");

			expect(runCommandCaptureSpy).toHaveBeenCalledWith(
				"npm",
				["view", "example@^1.0.0", "version", "--json"],
				expect.objectContaining({ cwd: tempDir, timeoutMs: expect.any(Number) }),
			);
			expect(runCommandSpy).toHaveBeenCalledWith(
				"npm",
				["install", "example@^1.0.0", "--prefix", join(tempDir, ".pi", "npm"), "--legacy-peer-deps"],
				undefined,
			);
		});

		// 测试场景：验证“should skip project npm update when installed version matches latest”对应的行为、结果与边界。
		it("should skip project npm update when installed version matches latest", async () => {
			/** 常量 installedPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const installedPath = join(tempDir, ".pi", "npm", "node_modules", "example");
			mkdirSync(installedPath, { recursive: true });
			writeFileSync(join(installedPath, "package.json"), JSON.stringify({ name: "example", version: "1.3.1" }));
			settingsManager.setProjectPackages(["npm:example@^1.0.0"]);

			/** 常量 runCommandCaptureSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runCommandCaptureSpy = vi
				.spyOn(packageManager as any, "runCommandCapture")
				.mockResolvedValue('["1.0.0","1.3.1","1.0.2"]');
			/** 常量 runCommandSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runCommandSpy = vi.spyOn(packageManager as any, "runCommand").mockResolvedValue(undefined);

			await packageManager.update("npm:example");

			expect(runCommandCaptureSpy).toHaveBeenCalledWith(
				"npm",
				["view", "example@^1.0.0", "version", "--json"],
				expect.objectContaining({ cwd: tempDir, timeoutMs: expect.any(Number) }),
			);
			expect(runCommandSpy).not.toHaveBeenCalled();
		});

		// 测试场景：验证“should migrate legacy user npm installs into the managed npm root during update”对应的行为、结果与边界。
		it("should migrate legacy user npm installs into the managed npm root during update", async () => {
			/** 常量 legacyRoot 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const legacyRoot = join(tempDir, "legacy-global", "node_modules");
			/** 常量 legacyPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const legacyPath = join(legacyRoot, "legacy-pkg");
			/** 常量 managedPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const managedPath = join(agentDir, "npm", "node_modules", "legacy-pkg");
			mkdirSync(legacyPath, { recursive: true });
			writeFileSync(join(legacyPath, "package.json"), JSON.stringify({ name: "legacy-pkg", version: "1.0.0" }));
			settingsManager.setPackages(["npm:legacy-pkg"]);

			vi.spyOn(packageManager as any, "getGlobalNpmRoot").mockReturnValue(legacyRoot);
			/** 常量 runCommandCaptureSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runCommandCaptureSpy = vi.spyOn(packageManager as any, "runCommandCapture").mockResolvedValue('"1.0.0"');
			/** 常量 runCommandSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runCommandSpy = vi
				.spyOn(packageManager as any, "runCommand")
				.mockImplementation(async (...callArgs: unknown[]) => {
					/** 常量 [command, args] 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const [command, args] = callArgs as [string, string[]];
					expect(command).toBe("npm");
					expect(args).toEqual([
						"install",
						"legacy-pkg@latest",
						"--prefix",
						join(agentDir, "npm"),
						"--legacy-peer-deps",
					]);
					mkdirSync(managedPath, { recursive: true });
					writeFileSync(
						join(managedPath, "package.json"),
						JSON.stringify({ name: "legacy-pkg", version: "1.0.0" }),
					);
				});

			expect(packageManager.getInstalledPath("npm:legacy-pkg", "user")).toBe(legacyPath);

			await packageManager.update("npm:legacy-pkg");

			expect(runCommandCaptureSpy).not.toHaveBeenCalled();
			expect(runCommandSpy).toHaveBeenCalledTimes(1);
			expect(packageManager.getInstalledPath("npm:legacy-pkg", "user")).toBe(managedPath);
		});

		// 测试场景：验证“should batch npm updates per scope and run git updates in parallel while skipping pinned npm and current packages”对应的行为、结果与边界。
		it("should batch npm updates per scope and run git updates in parallel while skipping pinned npm and current packages", async () => {
			/** 常量 userOldPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const userOldPath = join(agentDir, "npm", "node_modules", "user-old");
			/** 常量 userCurrentPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const userCurrentPath = join(agentDir, "npm", "node_modules", "user-current");
			/** 常量 userUnknownPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const userUnknownPath = join(agentDir, "npm", "node_modules", "user-unknown");
			/** 常量 projectOldPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const projectOldPath = join(tempDir, ".pi", "npm", "node_modules", "project-old");
			/** 常量 projectCurrentPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const projectCurrentPath = join(tempDir, ".pi", "npm", "node_modules", "project-current");
			/** 常量 installPaths 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const installPaths = [userOldPath, userCurrentPath, userUnknownPath, projectOldPath, projectCurrentPath];
			/** 循环变量 installPath 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const installPath of installPaths) {
				mkdirSync(installPath, { recursive: true });
			}
			writeFileSync(join(userOldPath, "package.json"), JSON.stringify({ name: "user-old", version: "1.0.0" }));
			writeFileSync(
				join(userCurrentPath, "package.json"),
				JSON.stringify({ name: "user-current", version: "1.0.0" }),
			);
			writeFileSync(
				join(userUnknownPath, "package.json"),
				JSON.stringify({ name: "user-unknown", version: "1.0.0" }),
			);
			writeFileSync(join(projectOldPath, "package.json"), JSON.stringify({ name: "project-old", version: "1.0.0" }));
			writeFileSync(
				join(projectCurrentPath, "package.json"),
				JSON.stringify({ name: "project-current", version: "1.0.0" }),
			);

			settingsManager.setPackages([
				"npm:user-old",
				"npm:user-current",
				"npm:user-unknown",
				"npm:user-pinned@1.0.0",
				"git:github.com/example/user-repo-a",
				"git:github.com/example/user-repo-b",
				"git:github.com/example/user-repo-pinned@v1",
			]);
			settingsManager.setProjectPackages([
				"npm:project-old",
				"npm:project-current",
				"npm:project-missing",
				"git:github.com/example/project-repo-a",
			]);

			/** 常量 runCommandCaptureSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runCommandCaptureSpy = vi
				.spyOn(packageManager as any, "runCommandCapture")
				.mockImplementation(async (...callArgs: unknown[]) => {
					/** 常量 [_command, args] 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const [_command, args] = callArgs as [string, string[]];
					if (args[0] !== "view") {
						throw new Error(`Unexpected runCommandCapture args: ${args.join(" ")}`);
					}
					switch (args[1]) {
						case "user-old":
						case "project-old":
							return '"2.0.0"';
						case "user-current":
						case "project-current":
							return '"1.0.0"';
						case "user-unknown":
							throw new Error("registry unavailable");
						default:
							throw new Error(`Unexpected package lookup: ${args[1]}`);
					}
				});

			/** 变量 activeNpmUpdates 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			let activeNpmUpdates = 0;
			/** 变量 maxConcurrentNpmUpdates 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			let maxConcurrentNpmUpdates = 0;
			/** 常量 runCommandSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runCommandSpy = vi
				.spyOn(packageManager as any, "runCommand")
				.mockImplementation(async (...callArgs: unknown[]) => {
					/** 常量 [command, args] 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const [command, args] = callArgs as [string, string[]];
					if (command !== "npm") {
						throw new Error(`Unexpected runCommand call: ${command} ${args.join(" ")}`);
					}
					activeNpmUpdates += 1;
					maxConcurrentNpmUpdates = Math.max(maxConcurrentNpmUpdates, activeNpmUpdates);
					await new Promise((resolve) => setTimeout(resolve, 20));
					activeNpmUpdates -= 1;
				});

			/** 变量 activeGitUpdates 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			let activeGitUpdates = 0;
			/** 变量 maxConcurrentGitUpdates 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			let maxConcurrentGitUpdates = 0;
			/** 常量 updateGitSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const updateGitSpy = vi.spyOn(packageManager as any, "updateGit").mockImplementation(async () => {
				activeGitUpdates += 1;
				maxConcurrentGitUpdates = Math.max(maxConcurrentGitUpdates, activeGitUpdates);
				await new Promise((resolve) => setTimeout(resolve, 20));
				activeGitUpdates -= 1;
			});

			await packageManager.update();

			expect(runCommandCaptureSpy).toHaveBeenCalledTimes(5);
			expect(runCommandSpy).toHaveBeenCalledTimes(2);
			expect(runCommandSpy).toHaveBeenNthCalledWith(
				1,
				"npm",
				[
					"install",
					"user-old@latest",
					"user-unknown@latest",
					"--prefix",
					join(agentDir, "npm"),
					"--legacy-peer-deps",
				],
				undefined,
			);
			expect(runCommandSpy).toHaveBeenNthCalledWith(
				2,
				"npm",
				[
					"install",
					"project-old@latest",
					"project-missing@latest",
					"--prefix",
					join(tempDir, ".pi", "npm"),
					"--legacy-peer-deps",
				],
				undefined,
			);
			expect(updateGitSpy).toHaveBeenCalledTimes(4);
			expect(maxConcurrentNpmUpdates).toBeGreaterThan(1);
			expect(maxConcurrentGitUpdates).toBeGreaterThan(1);
		});

		// 测试场景：验证“should suggest npm source prefixes for update lookups”对应的行为、结果与边界。
		it("should suggest npm source prefixes for update lookups", async () => {
			settingsManager.setProjectPackages(["npm:example"]);

			await expect(packageManager.update("example")).rejects.toThrow(
				"No matching package found for example. Did you mean npm:example?",
			);
		});

		// 测试场景：验证“should suggest git source prefixes for update lookups”对应的行为、结果与边界。
		it("should suggest git source prefixes for update lookups", async () => {
			settingsManager.setProjectPackages(["git:github.com/example/repo"]);

			await expect(packageManager.update("github.com/example/repo")).rejects.toThrow(
				"No matching package found for github.com/example/repo. Did you mean git:github.com/example/repo?",
			);
		});

		// 测试场景：验证“should skip installing missing package sources when offline”对应的行为、结果与边界。
		it("should skip installing missing package sources when offline", async () => {
			process.env.PI_OFFLINE = "1";
			settingsManager.setProjectPackages(["npm:missing-package", "git:github.com/example/missing-repo"]);

			/** 常量 installParsedSourceSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const installParsedSourceSpy = vi.spyOn(packageManager as any, "installParsedSource");

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			/** 常量 allResources 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const allResources = [...result.extensions, ...result.skills, ...result.prompts, ...result.themes];
			expect(allResources.some((r) => r.metadata.origin === "package")).toBe(false);
			expect(installParsedSourceSpy).not.toHaveBeenCalled();
		});

		// 测试场景：验证“should skip refreshing temporary git sources when offline”对应的行为、结果与边界。
		it("should skip refreshing temporary git sources when offline", async () => {
			process.env.PI_OFFLINE = "1";
			/** 常量 gitSource 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const gitSource = "git:github.com/example/repo";
			/** 常量 parsedGitSource 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const parsedGitSource = (packageManager as any).parseSource(gitSource);
			/** 常量 installedPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const installedPath = (packageManager as any).getGitInstallPath(parsedGitSource, "temporary") as string;

			mkdirSync(join(installedPath, "extensions"), { recursive: true });
			writeFileSync(join(installedPath, "extensions", "index.ts"), "export default function() {};");

			/** 常量 refreshTemporaryGitSourceSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const refreshTemporaryGitSourceSpy = vi.spyOn(packageManager as any, "refreshTemporaryGitSource");

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolveExtensionSources([gitSource], { temporary: true });
			expect(result.extensions.some((r) => pathEndsWith(r.path, "extensions/index.ts") && r.enabled)).toBe(true);
			expect(refreshTemporaryGitSourceSpy).not.toHaveBeenCalled();
		});

		// 测试场景：验证“should not run npm view during resolve for installed unpinned packages”对应的行为、结果与边界。
		it("should not run npm view during resolve for installed unpinned packages", async () => {
			process.env.PI_OFFLINE = "1";
			/** 常量 installedPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const installedPath = join(tempDir, ".pi", "npm", "node_modules", "example");
			mkdirSync(join(installedPath, "extensions"), { recursive: true });
			writeFileSync(join(installedPath, "package.json"), JSON.stringify({ name: "example", version: "1.0.0" }));
			writeFileSync(join(installedPath, "extensions", "index.ts"), "export default function() {};");
			settingsManager.setProjectPackages(["npm:example@^1.0.0"]);

			/** 常量 runCommandCaptureSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runCommandCaptureSpy = vi.spyOn(packageManager as any, "runCommandCapture");

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await packageManager.resolve();
			expect(result.extensions.some((r) => pathEndsWith(r.path, "extensions/index.ts") && r.enabled)).toBe(true);
			expect(runCommandCaptureSpy).not.toHaveBeenCalled();
		});

		// 测试场景：验证“should reinstall pinned npm packages when installed version does not match”对应的行为、结果与边界。
		it("should reinstall pinned npm packages when installed version does not match", async () => {
			/** 常量 installedPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const installedPath = join(tempDir, ".pi", "npm", "node_modules", "example");
			mkdirSync(installedPath, { recursive: true });
			writeFileSync(join(installedPath, "package.json"), JSON.stringify({ name: "example", version: "1.0.0" }));
			settingsManager.setProjectPackages(["npm:example@2.0.0"]);

			/** 常量 installParsedSourceSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const installParsedSourceSpy = vi
				.spyOn(packageManager as any, "installParsedSource")
				.mockResolvedValue(undefined);

			await packageManager.resolve();
			expect(installParsedSourceSpy).toHaveBeenCalledTimes(1);
		});

		// 测试场景：验证“should not check package updates when offline”对应的行为、结果与边界。
		it("should not check package updates when offline", async () => {
			process.env.PI_OFFLINE = "1";
			/** 常量 runCommandCaptureSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runCommandCaptureSpy = vi.spyOn(packageManager as any, "runCommandCapture");

			/** 常量 updates 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const updates = await packageManager.checkForAvailableUpdates();
			expect(updates).toEqual([]);
			expect(runCommandCaptureSpy).not.toHaveBeenCalled();
		});

		// 测试场景：验证“should report updates for installed unpinned npm packages”对应的行为、结果与边界。
		it("should report updates for installed unpinned npm packages", async () => {
			/** 常量 installedPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const installedPath = join(tempDir, ".pi", "npm", "node_modules", "example");
			mkdirSync(installedPath, { recursive: true });
			writeFileSync(join(installedPath, "package.json"), JSON.stringify({ name: "example", version: "1.0.0" }));
			settingsManager.setProjectPackages(["npm:example"]);

			vi.spyOn(packageManager as any, "runCommandCapture").mockResolvedValue('"1.2.3"');

			/** 常量 updates 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const updates = await packageManager.checkForAvailableUpdates();
			expect(updates).toEqual([
				{
					source: "npm:example",
					displayName: "example",
					type: "npm",
					scope: "project",
				},
			]);
		});

		// 测试场景：验证“should skip pinned packages when checking for updates”对应的行为、结果与边界。
		it("should skip pinned packages when checking for updates", async () => {
			/** 常量 installedNpmPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const installedNpmPath = join(tempDir, ".pi", "npm", "node_modules", "example");
			mkdirSync(installedNpmPath, { recursive: true });
			writeFileSync(join(installedNpmPath, "package.json"), JSON.stringify({ name: "example", version: "1.0.0" }));
			/** 常量 parsedGitSource 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const parsedGitSource = (packageManager as any).parseSource("git:github.com/example/repo@v1");
			/** 常量 installedGitPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const installedGitPath = (packageManager as any).getGitInstallPath(parsedGitSource, "project") as string;
			mkdirSync(installedGitPath, { recursive: true });

			settingsManager.setProjectPackages(["npm:example@1.0.0", "git:github.com/example/repo@v1"]);

			/** 常量 runCommandCaptureSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runCommandCaptureSpy = vi.spyOn(packageManager as any, "runCommandCapture");
			/** 常量 gitUpdateSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const gitUpdateSpy = vi.spyOn(packageManager as any, "gitHasAvailableUpdate");

			/** 常量 updates 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const updates = await packageManager.checkForAvailableUpdates();
			expect(updates).toEqual([]);
			expect(runCommandCaptureSpy).not.toHaveBeenCalled();
			expect(gitUpdateSpy).not.toHaveBeenCalled();
		});

		// 测试场景：验证“should use npm view to fetch latest version”对应的行为、结果与边界。
		it("should use npm view to fetch latest version", async () => {
			/** 常量 runCommandCaptureSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runCommandCaptureSpy = vi.spyOn(packageManager as any, "runCommandCapture").mockResolvedValue('"1.2.3"');

			/** 常量 latest 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const latest = await (packageManager as any).getLatestNpmVersion("example");
			expect(latest).toBe("1.2.3");
			expect(runCommandCaptureSpy).toHaveBeenCalledTimes(1);
			expect(runCommandCaptureSpy).toHaveBeenCalledWith(
				"npm",
				["view", "example", "version", "--json"],
				expect.objectContaining({ cwd: tempDir, timeoutMs: expect.any(Number) }),
			);
		});

		// 测试场景：验证“should use npmCommand argv for npm update checks”对应的行为、结果与边界。
		it("should use npmCommand argv for npm update checks", async () => {
			settingsManager = SettingsManager.inMemory({
				npmCommand: ["mise", "exec", "node@20", "--", "npm"],
			});
			packageManager = new DefaultPackageManager({
				cwd: tempDir,
				agentDir,
				settingsManager,
			});

			/** 常量 runCommandCaptureSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runCommandCaptureSpy = vi.spyOn(packageManager as any, "runCommandCapture").mockResolvedValue('"1.2.3"');

			/** 常量 latest 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const latest = await (packageManager as any).getLatestNpmVersion("@scope/pkg");
			expect(latest).toBe("1.2.3");
			expect(runCommandCaptureSpy).toHaveBeenCalledWith(
				"mise",
				["exec", "node@20", "--", "npm", "view", "@scope/pkg", "version", "--json"],
				expect.objectContaining({ cwd: tempDir }),
			);
		});

		// 测试场景：验证“should wait for close before resolving captured stdout”对应的行为、结果与边界。
		it("should wait for close before resolving captured stdout", async () => {
			/** 常量 managerWithInternals 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const managerWithInternals = packageManager as unknown as {
				spawnCaptureCommand(
					command: string,
					args: string[],
					options?: { cwd?: string; env?: Record<string, string> },
				): MockSpawnedProcess;
				runCommandCapture(
					command: string,
					args: string[],
					options?: { cwd?: string; timeoutMs?: number; env?: Record<string, string> },
				): Promise<string>;
			};
			/** 常量 child 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const child = new MockSpawnedProcess();
			vi.spyOn(managerWithInternals, "spawnCaptureCommand").mockReturnValue(child);

			/** 变量 settled 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			let settled = false;
			/** 常量 capturePromise 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const capturePromise = managerWithInternals.runCommandCapture("git", ["rev-parse", "HEAD"]).then((value) => {
				settled = true;
				return value;
			});

			child.emit("exit", 0, null);
			await Promise.resolve();
			expect(settled).toBe(false);

			child.stdout.write("abc123\n");
			child.stdout.end();
			child.emit("close", 0, null);

			await expect(capturePromise).resolves.toBe("abc123");
		});
	});
});
