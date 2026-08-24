/**
 * 文件职责：验证 DefaultResourceLoader 对扩展、技能、提示词、主题、上下文文件和系统提示的发现与合并。
 * 技术维度：使用 Vitest、临时目录、文件系统夹具、符号链接和配置对象测试资源扫描流程。
 * 产品维度：确保用户项目与个人目录中的自定义资源能按优先级稳定加载，并给出冲突或信任提示。
 * 逻辑维度：每个用例建立隔离目录，写入不同资源组合，执行 reload 后检查发现结果、覆盖顺序和诊断信息。
 * 关键边界：符号链接测试受操作系统权限影响；临时路径和资源优先级必须与真实加载规则保持一致。
 * 新手阅读建议：先看最小 reload 用例，再看项目/用户目录优先级，最后阅读信任、冲突和 override 回调。
 */
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { ExtensionRunner } from "../src/core/extensions/runner.ts";
import { DefaultResourceLoader } from "../src/core/resource-loader.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";
import type { Skill } from "../src/core/skills.ts";
import { createSyntheticSourceInfo } from "../src/core/source-info.ts";

import { createModelRegistry } from "./model-runtime-test-utils.ts";

// 用例分组：集中验证“DefaultResourceLoader”相关功能。
describe("DefaultResourceLoader", () => {
	/** 变量 tempDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	let tempDir: string;
	/** 变量 agentDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	let agentDir: string;
	/** 变量 cwd 保存“cwd”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	let cwd: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `rl-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		agentDir = join(tempDir, "agent");
		cwd = join(tempDir, "project");
		mkdirSync(agentDir, { recursive: true });
		mkdirSync(cwd, { recursive: true });
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	// 用例分组：集中验证“reload”相关功能。
	describe("reload", () => {
		// 测试场景：验证“should initialize with empty results before reload”对应的行为、返回值与边界条件。
		it("should initialize with empty results before reload", () => {
			/** 常量 loader 保存“loader”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const loader = new DefaultResourceLoader({ cwd, agentDir });

			expect(loader.getExtensions().extensions).toEqual([]);
			expect(loader.getSkills().skills).toEqual([]);
			expect(loader.getPrompts().prompts).toEqual([]);
			expect(loader.getThemes().themes).toEqual([]);
		});

		// 测试场景：验证“should discover skills from agentDir”对应的行为、返回值与边界条件。
		it("should discover skills from agentDir", async () => {
			/** 常量 skillsDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const skillsDir = join(agentDir, "skills");
			mkdirSync(skillsDir, { recursive: true });
			writeFileSync(
				join(skillsDir, "test-skill.md"),
				`---
name: test-skill
description: A test skill
---
Skill content here.`,
			);

			/** 常量 loader 保存“loader”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const loader = new DefaultResourceLoader({ cwd, agentDir });
			await loader.reload();

			/** 常量 { skills } 保存“{ skills }”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const { skills } = loader.getSkills();
			expect(skills.some((s) => s.name === "test-skill")).toBe(true);
		});

		// 测试场景：验证“should ignore extra markdown files in auto-discovered skill dirs”对应的行为、返回值与边界条件。
		it("should ignore extra markdown files in auto-discovered skill dirs", async () => {
			/** 常量 skillDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const skillDir = join(agentDir, "skills", "pi-skills", "browser-tools");
			mkdirSync(skillDir, { recursive: true });
			writeFileSync(
				join(skillDir, "SKILL.md"),
				`---
name: browser-tools
description: Browser tools
---
Skill content here.`,
			);
			writeFileSync(join(skillDir, "EFFICIENCY.md"), "No frontmatter here");

			/** 常量 loader 保存“loader”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const loader = new DefaultResourceLoader({ cwd, agentDir });
			await loader.reload();

			/** 常量 { skills, diagnostics } 保存“{ skills, diagnostics }”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const { skills, diagnostics } = loader.getSkills();
			expect(skills.some((s) => s.name === "browser-tools")).toBe(true);
			expect(diagnostics.some((d) => d.path?.endsWith("EFFICIENCY.md"))).toBe(false);
		});

		// 测试场景：验证“should discover prompts from agentDir”对应的行为、返回值与边界条件。
		it("should discover prompts from agentDir", async () => {
			/** 常量 promptsDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const promptsDir = join(agentDir, "prompts");
			mkdirSync(promptsDir, { recursive: true });
			writeFileSync(
				join(promptsDir, "test-prompt.md"),
				`---
description: A test prompt
---
Prompt content.`,
			);

			/** 常量 loader 保存“loader”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const loader = new DefaultResourceLoader({ cwd, agentDir });
			await loader.reload();

			/** 常量 { prompts } 保存当前场景使用或生成的文本；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const { prompts } = loader.getPrompts();
			expect(prompts.some((p) => p.name === "test-prompt")).toBe(true);
		});

		// 测试场景：验证“should prefer project resources over user on name collisions”对应的行为、返回值与边界条件。
		it("should prefer project resources over user on name collisions", async () => {
			/** 常量 userPromptsDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const userPromptsDir = join(agentDir, "prompts");
			/** 常量 projectPromptsDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const projectPromptsDir = join(cwd, ".pi", "prompts");
			mkdirSync(userPromptsDir, { recursive: true });
			mkdirSync(projectPromptsDir, { recursive: true });
			/** 常量 userPromptPath 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const userPromptPath = join(userPromptsDir, "commit.md");
			/** 常量 projectPromptPath 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const projectPromptPath = join(projectPromptsDir, "commit.md");
			writeFileSync(userPromptPath, "User prompt");
			writeFileSync(projectPromptPath, "Project prompt");

			/** 常量 userSkillDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const userSkillDir = join(agentDir, "skills", "collision-skill");
			/** 常量 projectSkillDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const projectSkillDir = join(cwd, ".pi", "skills", "collision-skill");
			mkdirSync(userSkillDir, { recursive: true });
			mkdirSync(projectSkillDir, { recursive: true });
			/** 常量 userSkillPath 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const userSkillPath = join(userSkillDir, "SKILL.md");
			/** 常量 projectSkillPath 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const projectSkillPath = join(projectSkillDir, "SKILL.md");
			writeFileSync(
				userSkillPath,
				`---
name: collision-skill
description: user
---
User skill`,
			);
			writeFileSync(
				projectSkillPath,
				`---
name: collision-skill
description: project
---
Project skill`,
			);

			/** 常量 baseTheme 保存“baseTheme”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const baseTheme = JSON.parse(
				readFileSync(join(process.cwd(), "src", "modes", "interactive", "theme", "dark.json"), "utf-8"),
			) as { name: string; vars?: Record<string, string> };
			baseTheme.name = "collision-theme";
			/** 常量 userThemePath 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const userThemePath = join(agentDir, "themes", "collision.json");
			/** 常量 projectThemePath 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const projectThemePath = join(cwd, ".pi", "themes", "collision.json");
			mkdirSync(join(agentDir, "themes"), { recursive: true });
			mkdirSync(join(cwd, ".pi", "themes"), { recursive: true });
			writeFileSync(userThemePath, JSON.stringify(baseTheme, null, 2));
			if (baseTheme.vars) {
				baseTheme.vars.accent = "#ff00ff";
			}
			writeFileSync(projectThemePath, JSON.stringify(baseTheme, null, 2));

			/** 常量 loader 保存“loader”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const loader = new DefaultResourceLoader({ cwd, agentDir });
			await loader.reload();

			/** 常量 prompt 保存当前场景使用或生成的文本；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const prompt = loader.getPrompts().prompts.find((p) => p.name === "commit");
			expect(prompt?.filePath).toBe(projectPromptPath);

			/** 常量 skill 保存“skill”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const skill = loader.getSkills().skills.find((s) => s.name === "collision-skill");
			expect(skill?.filePath).toBe(projectSkillPath);

			/** 常量 theme 保存“theme”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const theme = loader.getThemes().themes.find((t) => t.name === "collision-theme");
			expect(theme?.sourcePath).toBe(projectThemePath);
		});

		// 测试场景：验证“should load symlinked user and project extensions once”对应的行为、返回值与边界条件。
		it("should load symlinked user and project extensions once", async () => {
			/** 常量 sharedExtDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const sharedExtDir = join(tempDir, "shared-extensions");
			mkdirSync(sharedExtDir, { recursive: true });
			writeFileSync(
				join(sharedExtDir, "shared.ts"),
				`export default function(pi) {
	pi.registerCommand("shared", {
		description: "shared command",
		handler: async () => {},
	});
}`,
			);

			mkdirSync(agentDir, { recursive: true });
			mkdirSync(join(cwd, ".pi"), { recursive: true });
			symlinkSync(sharedExtDir, join(agentDir, "extensions"), "dir");
			symlinkSync(sharedExtDir, join(cwd, ".pi", "extensions"), "dir");

			/** 常量 loader 保存“loader”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const loader = new DefaultResourceLoader({ cwd, agentDir });
			await loader.reload();

			/** 常量 extensionsResult 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const extensionsResult = loader.getExtensions();
			expect(extensionsResult.extensions).toHaveLength(1);
			expect(extensionsResult.errors).toEqual([]);

			// mergePaths processes project paths before user paths, so the project
			// alias is the canonical survivor.
			// 中文说明：上方英文注释描述“mergePaths processes project paths before user paths, s”相关前提、步骤或边界；下面代码按该说明执行。
			expect(extensionsResult.extensions[0].path).toBe(join(cwd, ".pi", "extensions", "shared.ts"));
		});

		// 测试场景：验证“should load user extensions before trust and reuse them after trust resolves”对应的行为、返回值与边界条件。
		it("should load user extensions before trust and reuse them after trust resolves", async () => {
			/** 常量 userExtDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const userExtDir = join(agentDir, "extensions");
			/** 常量 projectExtDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const projectExtDir = join(cwd, ".pi", "extensions");
			mkdirSync(userExtDir, { recursive: true });
			mkdirSync(projectExtDir, { recursive: true });
			/** 常量 loadCountKey 保存认证或环境配置数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const loadCountKey = `__piTrustPreloadCount_${Date.now()}_${Math.random().toString(36).slice(2)}`;
			/** 常量 globalState 保存“globalState”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const globalState = globalThis as typeof globalThis & Record<string, number | undefined>;

			writeFileSync(
				join(userExtDir, "user.ts"),
				`globalThis[${JSON.stringify(loadCountKey)}] = (globalThis[${JSON.stringify(loadCountKey)}] ?? 0) + 1;
export default function(pi) {
	pi.on("project_trust", () => ({ trusted: "yes" }));
	pi.registerCommand("user-trust", {
		description: "user trust",
		handler: async () => {},
	});
}`,
			);
			writeFileSync(
				join(projectExtDir, "project.ts"),
				`export default function(pi) {
	pi.registerCommand("project-trusted", {
		description: "project trusted",
		handler: async () => {},
	});
}`,
			);

			/** 常量 loader 保存“loader”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const loader = new DefaultResourceLoader({ cwd, agentDir });
			await loader.reload({
				resolveProjectTrust: async ({ extensionsResult }) => {
					expect(extensionsResult.extensions.map((extension) => extension.path)).toEqual([
						join(userExtDir, "user.ts"),
					]);
					return true;
				},
			});

			/** 常量 extensionsResult 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const extensionsResult = loader.getExtensions();
			expect(extensionsResult.extensions.map((extension) => extension.path)).toEqual([
				join(cwd, ".pi", "extensions", "project.ts"),
				join(userExtDir, "user.ts"),
			]);
			expect(globalState[loadCountKey]).toBe(1);
		});

		// 测试场景：验证“should keep both extensions loaded when command names collide”对应的行为、返回值与边界条件。
		it("should keep both extensions loaded when command names collide", async () => {
			/** 常量 userExtDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const userExtDir = join(agentDir, "extensions");
			/** 常量 projectExtDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const projectExtDir = join(cwd, ".pi", "extensions");
			mkdirSync(userExtDir, { recursive: true });
			mkdirSync(projectExtDir, { recursive: true });

			writeFileSync(
				join(projectExtDir, "project.ts"),
				`export default function(pi) {
	pi.registerCommand("deploy", {
		description: "project deploy",
		handler: async () => {},
	});
	pi.registerCommand("project-only", {
		description: "project only",
		handler: async () => {},
	});
}`,
			);

			writeFileSync(
				join(userExtDir, "user.ts"),
				`export default function(pi) {
	pi.registerCommand("deploy", {
		description: "user deploy",
		handler: async () => {},
	});
	pi.registerCommand("user-only", {
		description: "user only",
		handler: async () => {},
	});
}`,
			);

			/** 常量 loader 保存“loader”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const loader = new DefaultResourceLoader({ cwd, agentDir });
			await loader.reload();

			/** 常量 extensionsResult 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const extensionsResult = loader.getExtensions();
			expect(extensionsResult.extensions).toHaveLength(2);
			expect(extensionsResult.errors.some((e) => e.error.includes('Command "/deploy" conflicts'))).toBe(false);

			/** 常量 sessionManager 保存“sessionManager”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const sessionManager = SessionManager.inMemory();
			/** 常量 authStorage 保存认证或环境配置数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const authStorage = AuthStorage.create(join(tempDir, "auth.json"));
			/** 常量 modelRegistry 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const modelRegistry = await createModelRegistry(authStorage);
			/** 常量 runner 保存“runner”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner(
				extensionsResult.extensions,
				extensionsResult.runtime,
				cwd,
				sessionManager,
				modelRegistry,
			);

			expect(runner.getCommand("deploy:1")?.description).toBe("project deploy");
			expect(runner.getCommand("deploy:2")?.description).toBe("user deploy");
			expect(runner.getCommand("project-only")?.description).toBe("project only");
			expect(runner.getCommand("user-only")?.description).toBe("user only");

			/** 常量 commands 保存“commands”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const commands = runner.getRegisteredCommands();
			expect(commands.map((command) => command.invocationName)).toEqual([
				"deploy:1",
				"project-only",
				"deploy:2",
				"user-only",
			]);
		});

		// 测试场景：验证“should honor overrides for auto-discovered resources”对应的行为、返回值与边界条件。
		it("should honor overrides for auto-discovered resources", async () => {
			/** 常量 settingsManager 保存控制当前行为的配置选项；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const settingsManager = SettingsManager.inMemory();
			settingsManager.setExtensionPaths(["-extensions/disabled.ts"]);
			settingsManager.setSkillPaths(["-skills/skip-skill"]);
			settingsManager.setPromptTemplatePaths(["-prompts/skip.md"]);
			settingsManager.setThemePaths(["-themes/skip.json"]);

			/** 常量 extensionsDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const extensionsDir = join(agentDir, "extensions");
			mkdirSync(extensionsDir, { recursive: true });
			writeFileSync(join(extensionsDir, "disabled.ts"), "export default function() {}");

			/** 常量 skillDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const skillDir = join(agentDir, "skills", "skip-skill");
			mkdirSync(skillDir, { recursive: true });
			writeFileSync(
				join(skillDir, "SKILL.md"),
				`---
name: skip-skill
description: Skip me
---
Content`,
			);

			/** 常量 promptsDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const promptsDir = join(agentDir, "prompts");
			mkdirSync(promptsDir, { recursive: true });
			writeFileSync(join(promptsDir, "skip.md"), "Skip prompt");

			/** 常量 themesDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const themesDir = join(agentDir, "themes");
			mkdirSync(themesDir, { recursive: true });
			writeFileSync(join(themesDir, "skip.json"), "{}");

			/** 常量 loader 保存“loader”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const loader = new DefaultResourceLoader({ cwd, agentDir, settingsManager });
			await loader.reload();

			/** 常量 { extensions } 保存“{ extensions }”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const { extensions } = loader.getExtensions();
			/** 常量 { skills } 保存“{ skills }”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const { skills } = loader.getSkills();
			/** 常量 { prompts } 保存当前场景使用或生成的文本；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const { prompts } = loader.getPrompts();
			/** 常量 { themes } 保存“{ themes }”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const { themes } = loader.getThemes();

			expect(extensions.some((e) => e.path.endsWith("disabled.ts"))).toBe(false);
			expect(skills.some((s) => s.name === "skip-skill")).toBe(false);
			expect(prompts.some((p) => p.name === "skip")).toBe(false);
			expect(themes.some((t) => t.sourcePath?.endsWith("skip.json"))).toBe(false);
		});

		// 测试场景：验证“should discover AGENTS.md context files”对应的行为、返回值与边界条件。
		it("should discover AGENTS.md context files", async () => {
			writeFileSync(join(cwd, "AGENTS.md"), "# Project Guidelines\n\nBe helpful.");

			/** 常量 loader 保存“loader”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const loader = new DefaultResourceLoader({ cwd, agentDir });
			await loader.reload();

			/** 常量 { agentsFiles } 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const { agentsFiles } = loader.getAgentsFiles();
			expect(agentsFiles.some((f) => f.path.includes("AGENTS.md"))).toBe(true);
		});

		// 测试场景：验证“should skip AGENTS.md and CLAUDE.md discovery when noContextFiles is true”对应的行为、返回值与边界条件。
		it("should skip AGENTS.md and CLAUDE.md discovery when noContextFiles is true", async () => {
			writeFileSync(join(cwd, "AGENTS.md"), "# Project Guidelines\n\nBe helpful.");
			writeFileSync(join(cwd, "CLAUDE.md"), "# Claude Guidelines\n\nBe helpful.");

			/** 常量 loader 保存“loader”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const loader = new DefaultResourceLoader({ cwd, agentDir, noContextFiles: true });
			await loader.reload();

			/** 常量 { agentsFiles } 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const { agentsFiles } = loader.getAgentsFiles();
			expect(agentsFiles).toEqual([]);
		});

		// 测试场景：验证“should discover SYSTEM.md from cwd/.pi”对应的行为、返回值与边界条件。
		it("should discover SYSTEM.md from cwd/.pi", async () => {
			/** 常量 piDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const piDir = join(cwd, ".pi");
			mkdirSync(piDir, { recursive: true });
			writeFileSync(join(piDir, "SYSTEM.md"), "You are a helpful assistant.");

			/** 常量 loader 保存“loader”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const loader = new DefaultResourceLoader({ cwd, agentDir });
			await loader.reload();

			expect(loader.getSystemPrompt()).toBe("You are a helpful assistant.");
		});

		// 测试场景：验证“should skip project resources that require trust when project is not trusted”对应的行为、返回值与边界条件。
		it("should skip project resources that require trust when project is not trusted", async () => {
			/** 常量 piDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const piDir = join(cwd, ".pi");
			/** 常量 extensionsDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const extensionsDir = join(piDir, "extensions");
			/** 常量 skillDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const skillDir = join(piDir, "skills", "project-skill");
			/** 常量 promptsDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const promptsDir = join(piDir, "prompts");
			/** 常量 themesDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const themesDir = join(piDir, "themes");
			mkdirSync(extensionsDir, { recursive: true });
			mkdirSync(skillDir, { recursive: true });
			mkdirSync(promptsDir, { recursive: true });
			mkdirSync(themesDir, { recursive: true });
			writeFileSync(join(piDir, "SYSTEM.md"), "Project system prompt.");
			writeFileSync(join(agentDir, "SYSTEM.md"), "Global system prompt.");
			writeFileSync(join(agentDir, "AGENTS.md"), "Global instructions");
			writeFileSync(join(cwd, "AGENTS.md"), "Project instructions");
			writeFileSync(join(extensionsDir, "project.ts"), `throw new Error("should not load");`);
			writeFileSync(
				join(skillDir, "SKILL.md"),
				`---
name: project-skill
description: Project skill
---
Project skill content`,
			);
			writeFileSync(join(promptsDir, "project.md"), "Project prompt");
			/** 常量 themeData 保存“themeData”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const themeData = JSON.parse(
				readFileSync(join(process.cwd(), "src", "modes", "interactive", "theme", "dark.json"), "utf-8"),
			) as { name: string };
			themeData.name = "project-theme";
			writeFileSync(join(themesDir, "project.json"), JSON.stringify(themeData, null, 2));
			/** 常量 settingsManager 保存控制当前行为的配置选项；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const settingsManager = SettingsManager.create(cwd, agentDir, { projectTrusted: false });

			/** 常量 loader 保存“loader”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const loader = new DefaultResourceLoader({ cwd, agentDir, settingsManager });
			await loader.reload();

			expect(loader.getSystemPrompt()).toBe("Global system prompt.");
			expect(loader.getAgentsFiles().agentsFiles.some((file) => file.path === join(agentDir, "AGENTS.md"))).toBe(
				true,
			);
			expect(loader.getAgentsFiles().agentsFiles.some((file) => file.path === join(cwd, "AGENTS.md"))).toBe(true);
			expect(loader.getExtensions().extensions).toHaveLength(0);
			expect(loader.getExtensions().errors).toEqual([]);
			expect(loader.getSkills().skills.some((skill) => skill.name === "project-skill")).toBe(false);
			expect(loader.getPrompts().prompts.some((prompt) => prompt.name === "project")).toBe(false);
			expect(loader.getThemes().themes.some((theme) => theme.name === "project-theme")).toBe(false);
		});

		// 测试场景：验证“should discover APPEND_SYSTEM.md”对应的行为、返回值与边界条件。
		it("should discover APPEND_SYSTEM.md", async () => {
			/** 常量 piDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const piDir = join(cwd, ".pi");
			mkdirSync(piDir, { recursive: true });
			writeFileSync(join(piDir, "APPEND_SYSTEM.md"), "Additional instructions.");

			/** 常量 loader 保存“loader”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const loader = new DefaultResourceLoader({ cwd, agentDir });
			await loader.reload();

			expect(loader.getAppendSystemPrompt()).toContain("Additional instructions.");
		});
	});

	// 用例分组：集中验证“extendResources”相关功能。
	describe("extendResources", () => {
		// 测试场景：验证“should load skills and prompts with extension metadata”对应的行为、返回值与边界条件。
		it("should load skills and prompts with extension metadata", async () => {
			/** 常量 extraSkillDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const extraSkillDir = join(tempDir, "extra-skills", "extra-skill");
			mkdirSync(extraSkillDir, { recursive: true });
			/** 常量 skillPath 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const skillPath = join(extraSkillDir, "SKILL.md");
			writeFileSync(
				skillPath,
				`---
name: extra-skill
description: Extra skill
---
Extra content`,
			);

			/** 常量 extraPromptDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const extraPromptDir = join(tempDir, "extra-prompts");
			mkdirSync(extraPromptDir, { recursive: true });
			/** 常量 promptPath 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const promptPath = join(extraPromptDir, "extra.md");
			writeFileSync(
				promptPath,
				`---
description: Extra prompt
---
Extra prompt content`,
			);

			/** 常量 loader 保存“loader”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const loader = new DefaultResourceLoader({ cwd, agentDir });
			await loader.reload();

			loader.extendResources({
				skillPaths: [
					{
						path: extraSkillDir,
						metadata: {
							source: "extension:extra",
							scope: "temporary",
							origin: "top-level",
							baseDir: extraSkillDir,
						},
					},
				],
				promptPaths: [
					{
						path: promptPath,
						metadata: {
							source: "extension:extra",
							scope: "temporary",
							origin: "top-level",
							baseDir: extraPromptDir,
						},
					},
				],
			});

			/** 常量 { skills } 保存“{ skills }”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const { skills } = loader.getSkills();
			/** 常量 loadedSkill 保存“loadedSkill”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const loadedSkill = skills.find((skill) => skill.name === "extra-skill");
			expect(loadedSkill).toBeDefined();
			expect(loadedSkill?.sourceInfo?.source).toBe("extension:extra");
			expect(loadedSkill?.sourceInfo?.path).toBe(skillPath);

			/** 常量 { prompts } 保存当前场景使用或生成的文本；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const { prompts } = loader.getPrompts();
			/** 常量 loadedPrompt 保存当前场景使用或生成的文本；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const loadedPrompt = prompts.find((prompt) => prompt.name === "extra");
			expect(loadedPrompt).toBeDefined();
			expect(loadedPrompt?.sourceInfo?.source).toBe("extension:extra");
			expect(loadedPrompt?.sourceInfo?.path).toBe(promptPath);
		});

		// 测试场景：验证“should load extension resources returned as file URLs”对应的行为、返回值与边界条件。
		it("should load extension resources returned as file URLs", async () => {
			/** 常量 extraSkillDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const extraSkillDir = join(tempDir, "extra skills", "file-url-skill");
			mkdirSync(extraSkillDir, { recursive: true });
			/** 常量 skillPath 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const skillPath = join(extraSkillDir, "SKILL.md");
			writeFileSync(
				skillPath,
				`---
name: file-url-skill
description: File URL skill
---
Extra content`,
			);

			/** 常量 loader 保存“loader”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const loader = new DefaultResourceLoader({ cwd, agentDir });
			await loader.reload();

			loader.extendResources({
				skillPaths: [
					{
						path: pathToFileURL(extraSkillDir).href,
						metadata: {
							source: "extension:file-url",
							scope: "temporary",
							origin: "top-level",
							baseDir: extraSkillDir,
						},
					},
				],
			});

			/** 常量 { skills, diagnostics } 保存“{ skills, diagnostics }”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const { skills, diagnostics } = loader.getSkills();
			expect(diagnostics).toEqual([]);
			/** 常量 loadedSkill 保存“loadedSkill”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const loadedSkill = skills.find((skill) => skill.name === "file-url-skill");
			expect(loadedSkill).toBeDefined();
			expect(loadedSkill?.filePath).toBe(skillPath);
			expect(loadedSkill?.sourceInfo?.source).toBe("extension:file-url");
		});
	});

	// 用例分组：集中验证“noSkills option”相关功能。
	describe("noSkills option", () => {
		// 测试场景：验证“should skip skill discovery when noSkills is true”对应的行为、返回值与边界条件。
		it("should skip skill discovery when noSkills is true", async () => {
			/** 常量 skillsDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const skillsDir = join(agentDir, "skills");
			mkdirSync(skillsDir, { recursive: true });
			writeFileSync(
				join(skillsDir, "test-skill.md"),
				`---
name: test-skill
description: A test skill
---
Content`,
			);

			/** 常量 loader 保存“loader”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const loader = new DefaultResourceLoader({ cwd, agentDir, noSkills: true });
			await loader.reload();

			/** 常量 { skills } 保存“{ skills }”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const { skills } = loader.getSkills();
			expect(skills).toEqual([]);
		});

		// 测试场景：验证“should still load additional skill paths when noSkills is true”对应的行为、返回值与边界条件。
		it("should still load additional skill paths when noSkills is true", async () => {
			/** 常量 customSkillDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const customSkillDir = join(tempDir, "custom-skills");
			mkdirSync(customSkillDir, { recursive: true });
			writeFileSync(
				join(customSkillDir, "custom.md"),
				`---
name: custom
description: Custom skill
---
Content`,
			);

			/** 常量 loader 保存“loader”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const loader = new DefaultResourceLoader({
				cwd,
				agentDir,
				noSkills: true,
				additionalSkillPaths: [customSkillDir],
			});
			await loader.reload();

			/** 常量 { skills } 保存“{ skills }”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const { skills } = loader.getSkills();
			expect(skills.some((s) => s.name === "custom")).toBe(true);
		});
	});

	// 用例分组：集中验证“override functions”相关功能。
	describe("override functions", () => {
		// 测试场景：验证“should apply skillsOverride”对应的行为、返回值与边界条件。
		it("should apply skillsOverride", async () => {
			/** 常量 injectedSkill 保存“injectedSkill”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const injectedSkill: Skill = {
				name: "injected",
				description: "Injected skill",
				filePath: "/fake/path",
				baseDir: "/fake",
				sourceInfo: createSyntheticSourceInfo("/fake/path", { source: "custom" }),
				disableModelInvocation: false,
			};
			/** 常量 loader 保存“loader”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const loader = new DefaultResourceLoader({
				cwd,
				agentDir,
				skillsOverride: () => ({
					skills: [injectedSkill],
					diagnostics: [],
				}),
			});
			await loader.reload();

			/** 常量 { skills } 保存“{ skills }”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const { skills } = loader.getSkills();
			expect(skills).toHaveLength(1);
			expect(skills[0].name).toBe("injected");
		});

		// 测试场景：验证“should apply systemPromptOverride”对应的行为、返回值与边界条件。
		it("should apply systemPromptOverride", async () => {
			/** 常量 loader 保存“loader”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const loader = new DefaultResourceLoader({
				cwd,
				agentDir,
				systemPromptOverride: () => "Custom system prompt",
			});
			await loader.reload();

			expect(loader.getSystemPrompt()).toBe("Custom system prompt");
		});
	});

	// 用例分组：集中验证“extension conflict detection”相关功能。
	describe("extension conflict detection", () => {
		// 测试场景：验证“should detect tool conflicts between extensions”对应的行为、返回值与边界条件。
		it("should detect tool conflicts between extensions", async () => {
			// Create two extensions that register the same tool
			// 中文说明：上方英文注释描述“Create two extensions that register the same tool”相关前提、步骤或边界；下面代码按该说明执行。
			const ext1Dir = join(agentDir, "extensions", "ext1");
			/** 常量 ext2Dir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const ext2Dir = join(agentDir, "extensions", "ext2");
			mkdirSync(ext1Dir, { recursive: true });
			mkdirSync(ext2Dir, { recursive: true });

			writeFileSync(
				join(ext1Dir, "index.ts"),
				`
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
export default function(pi: ExtensionAPI) {
  pi.registerTool({
    name: "duplicate-tool",
    description: "First",
    parameters: Type.Object({}),
    execute: async () => ({ result: "1" }),
  });
}`,
			);

			writeFileSync(
				join(ext2Dir, "index.ts"),
				`
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
export default function(pi: ExtensionAPI) {
  pi.registerTool({
    name: "duplicate-tool",
    description: "Second",
    parameters: Type.Object({}),
    execute: async () => ({ result: "2" }),
  });
}`,
			);

			/** 常量 loader 保存“loader”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const loader = new DefaultResourceLoader({ cwd, agentDir });
			await loader.reload();

			/** 常量 { errors } 保存“{ errors }”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const { errors } = loader.getExtensions();
			expect(errors.some((e) => e.error.includes("duplicate-tool") && e.error.includes("conflicts"))).toBe(true);
		});

		// 测试场景：验证“should prefer explicit CLI extensions over discovered extensions when commands and tools conflict”对应的行为、返回值与边界条件。
		it("should prefer explicit CLI extensions over discovered extensions when commands and tools conflict", async () => {
			/** 常量 globalExtDir 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const globalExtDir = join(agentDir, "extensions");
			mkdirSync(globalExtDir, { recursive: true });
			/** 常量 explicitExtPath 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const explicitExtPath = join(tempDir, "explicit-extension.ts");

			writeFileSync(
				join(globalExtDir, "global.ts"),
				`
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
export default function(pi: ExtensionAPI) {
  pi.registerTool({
    name: "duplicate-tool",
    description: "global tool",
    parameters: Type.Object({}),
    execute: async () => ({ result: "global" }),
  });
  pi.registerCommand("deploy", {
    description: "global command",
    handler: async () => {},
  });
}`,
			);

			writeFileSync(
				explicitExtPath,
				`
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
export default function(pi: ExtensionAPI) {
  pi.registerTool({
    name: "duplicate-tool",
    description: "explicit tool",
    parameters: Type.Object({}),
    execute: async () => ({ result: "explicit" }),
  });
  pi.registerCommand("deploy", {
    description: "explicit command",
    handler: async () => {},
  });
}`,
			);

			/** 常量 loader 保存“loader”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const loader = new DefaultResourceLoader({
				cwd,
				agentDir,
				additionalExtensionPaths: [explicitExtPath],
			});
			await loader.reload();

			/** 常量 extensionsResult 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const extensionsResult = loader.getExtensions();
			expect(extensionsResult.extensions[0]?.path).toBe(explicitExtPath);

			/** 常量 sessionManager 保存“sessionManager”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const sessionManager = SessionManager.inMemory();
			/** 常量 authStorage 保存认证或环境配置数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const authStorage = AuthStorage.create(join(tempDir, "auth-explicit.json"));
			/** 常量 modelRegistry 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const modelRegistry = await createModelRegistry(authStorage);
			/** 常量 runner 保存“runner”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner(
				extensionsResult.extensions,
				extensionsResult.runtime,
				cwd,
				sessionManager,
				modelRegistry,
			);

			expect(runner.getCommand("deploy:1")?.description).toBe("explicit command");
			expect(runner.getCommand("deploy:2")?.description).toBe("global command");
			expect(runner.getToolDefinition("duplicate-tool")?.description).toBe("explicit tool");
		});
	});
});
