/**
 * 文件职责：回归验证同名技能冲突时采用“项目 > 用户 > 包”的优先级，并报告被覆盖来源。
 * 技术维度：使用 Vitest、临时目录、动态 package.json/SKILL.md 夹具和 DefaultResourceLoader。
 * 产品维度：让用户和项目可以可靠覆盖依赖包自带技能，同时获得可诊断的冲突信息。
 * 逻辑维度：帮助函数创建三种来源技能与设置；四个用例检查获胜路径、描述和 loserPath。
 * 关键边界：名称完全相同才构成冲突；每个用例必须独占 agentDir/cwd 并清理临时包。
 * 新手阅读建议：先记住项目、用户、包的优先级，再看四个用例如何逐层增加来源。
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DefaultResourceLoader } from "../../../src/core/resource-loader.ts";

describe("issue #2781 skill collision precedence: user skills should override package skills", () => {
	// 当前用例所有文件的临时根目录。
	let tempDir: string;
	// 用户级代理目录，承载用户技能与设置。
	let agentDir: string;
	// 项目工作目录，承载 .pi 项目技能。
	let cwd: string;

	// 功能：创建隔离用户和项目目录；参数：无；返回：无。示例：每个用例前自动调用。
	beforeEach(() => {
		tempDir = join(tmpdir(), `pi-2781-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		agentDir = join(tempDir, "agent");
		cwd = join(tempDir, "project");
		mkdirSync(agentDir, { recursive: true });
		mkdirSync(cwd, { recursive: true });
	});

	// 功能：递归删除当前夹具；参数：无；返回：无。示例：每个用例后自动调用。
	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	/** 功能：创建声明一个技能的假包；参数 name、description；返回：包目录。示例：createPackageWithSkill("web-fetch", "Package")。 */
	function createPackageWithSkill(name: string, description: string): string {
		// 当前假包的根目录。
		const pkgDir = join(tempDir, `fake-package-${name}`);
		// 包内技能目录。
		const skillDir = join(pkgDir, "skills", name);
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(
			join(pkgDir, "package.json"),
			JSON.stringify({ name: `fake-pkg-${name}`, version: "1.0.0", pi: { skills: [`skills/${name}`] } }, null, 2),
		);
		writeFileSync(
			join(skillDir, "SKILL.md"),
			`---\nname: ${name}\ndescription: ${description}\n---\nPackage skill content`,
		);
		return pkgDir;
	}

	/** 功能：创建用户级技能；参数 name、description；返回：SKILL.md 路径。示例：createUserSkill("web-fetch", "User")。 */
	function createUserSkill(name: string, description: string): string {
		// 用户技能目录。
		const skillDir = join(agentDir, "skills", name);
		mkdirSync(skillDir, { recursive: true });
		// 用户 SKILL.md 绝对路径。
		const skillPath = join(skillDir, "SKILL.md");
		writeFileSync(skillPath, `---\nname: ${name}\ndescription: ${description}\n---\nUser skill content`);
		return skillPath;
	}

	/** 功能：创建项目级技能；参数 name、description；返回：SKILL.md 路径。示例：createProjectSkill("web-fetch", "Project")。 */
	function createProjectSkill(name: string, description: string): string {
		// 项目 .pi 下的技能目录。
		const skillDir = join(cwd, ".pi", "skills", name);
		mkdirSync(skillDir, { recursive: true });
		// 项目 SKILL.md 绝对路径。
		const skillPath = join(skillDir, "SKILL.md");
		writeFileSync(skillPath, `---\nname: ${name}\ndescription: ${description}\n---\nProject skill content`);
		return skillPath;
	}

	/** 功能：把假包写入指定范围的 settings.json；参数 pkgDir、scope；返回：无。示例：createSettingsWithPackage(dir, "user")。 */
	function createSettingsWithPackage(pkgDir: string, scope: "user" | "project"): void {
		// 用户范围使用 agentDir，项目范围使用 cwd/.pi。
		const settingsDir = scope === "user" ? agentDir : join(cwd, ".pi");
		mkdirSync(settingsDir, { recursive: true });
		writeFileSync(join(settingsDir, "settings.json"), JSON.stringify({ packages: [pkgDir] }, null, 2));
	}

	it("user auto-discovered skill should override package skill with same name", async () => {
		// 同名技能所在假包目录。
		const pkgDir = createPackageWithSkill("web-fetch", "Package web-fetch skill");
		// 预期获胜的用户技能路径。
		const userSkillPath = createUserSkill("web-fetch", "User web-fetch override");
		createSettingsWithPackage(pkgDir, "user");

		// 汇总包与用户资源的加载器。
		const loader = new DefaultResourceLoader({ cwd, agentDir });
		await loader.reload();

		// 加载后的技能集合。
		const { skills } = loader.getSkills();
		// 名称为 web-fetch 的最终胜出技能。
		const webFetch = skills.find((s) => s.name === "web-fetch");
		expect(webFetch).toBeDefined();
		expect(webFetch!.filePath).toBe(userSkillPath);
		expect(webFetch!.description).toBe("User web-fetch override");
	});

	it("project auto-discovered skill should override package skill with same name", async () => {
		// 同名技能所在假包目录。
		const pkgDir = createPackageWithSkill("web-fetch", "Package web-fetch skill");
		// 预期获胜的项目技能路径。
		const projectSkillPath = createProjectSkill("web-fetch", "Project web-fetch override");
		createSettingsWithPackage(pkgDir, "user");

		// 汇总包与项目资源的加载器。
		const loader = new DefaultResourceLoader({ cwd, agentDir });
		await loader.reload();

		// 加载后的技能集合。
		const { skills } = loader.getSkills();
		// 名称为 web-fetch 的最终胜出技能。
		const webFetch = skills.find((s) => s.name === "web-fetch");
		expect(webFetch).toBeDefined();
		expect(webFetch!.filePath).toBe(projectSkillPath);
		expect(webFetch!.description).toBe("Project web-fetch override");
	});

	it("project skill should override user skill which should override package skill", async () => {
		// 最低优先级同名包技能所在目录。
		const pkgDir = createPackageWithSkill("web-fetch", "Package web-fetch skill");
		createUserSkill("web-fetch", "User web-fetch override");
		// 最高优先级项目技能路径。
		const projectSkillPath = createProjectSkill("web-fetch", "Project web-fetch override");
		createSettingsWithPackage(pkgDir, "user");

		// 同时汇总三种来源的加载器。
		const loader = new DefaultResourceLoader({ cwd, agentDir });
		await loader.reload();

		// 加载后的技能集合。
		const { skills } = loader.getSkills();
		// 三方冲突后的最终 web-fetch 技能。
		const webFetch = skills.find((s) => s.name === "web-fetch");
		expect(webFetch).toBeDefined();
		expect(webFetch!.filePath).toBe(projectSkillPath);
		expect(webFetch!.description).toBe("Project web-fetch override");
	});

	it("collision diagnostics should report package skill as loser when user skill wins", async () => {
		// 冲突诊断场景的假包目录。
		const pkgDir = createPackageWithSkill("web-fetch", "Package web-fetch skill");
		createUserSkill("web-fetch", "User web-fetch override");
		createSettingsWithPackage(pkgDir, "user");

		// 产生碰撞诊断的资源加载器。
		const loader = new DefaultResourceLoader({ cwd, agentDir });
		await loader.reload();

		// 资源加载后的全部诊断。
		const { diagnostics } = loader.getSkills();
		// 与 web-fetch 对应的 collision 诊断。
		const collision = diagnostics.find((d) => d.type === "collision" && d.collision?.name === "web-fetch");
		expect(collision).toBeDefined();
		expect(collision!.collision!.loserPath).toContain("fake-package");
	});
});
