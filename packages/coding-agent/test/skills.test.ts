/**
 * 文件职责：验证技能目录扫描、元数据校验、提示词格式化、路径选项和同名冲突处理。
 * 技术维度：使用 Vitest、文件夹夹具、YAML frontmatter 解析结果与 XML 字符串断言覆盖技能加载模块。
 * 产品维度：保证用户安装或自定义技能时能得到稳定发现、清晰诊断，并只向模型展示允许调用的技能。
 * 逻辑维度：依次测试单目录加载、提示词生成、组合加载选项，以及多个来源发生名称冲突时的优先级。
 * 关键边界：测试读取固定夹具和用户主目录下可能存在的默认技能；路径数量比较不依赖具体本机技能内容。
 * 新手阅读建议：先读 createTestSkill，再看 loadSkillsFromDir 的输入输出，随后阅读 XML 格式与冲突用例。
 */
import { homedir } from "os";
import { join, resolve } from "path";
import { describe, expect, it } from "vitest";
import type { ResourceDiagnostic } from "../src/core/diagnostics.ts";
import { formatSkillsForPrompt, loadSkills, loadSkillsFromDir, type Skill } from "../src/core/skills.ts";
import { createSyntheticSourceInfo } from "../src/core/source-info.ts";

/** 通用技能测试夹具的绝对目录。 */
const fixturesDir = resolve(__dirname, "fixtures/skills");
/** 包含两个同名技能来源的冲突测试夹具目录。 */
const collisionFixturesDir = resolve(__dirname, "fixtures/skills-collision");

/** 构造格式化测试所需的最小技能对象。参数 options 提供名称、描述、路径与可见性；返回 Skill。例如：createTestSkill({...})。 */
function createTestSkill(options: {
	/** 技能在注册表中的唯一名称。 */
	name: string;
	/** 向用户和模型说明用途的简短描述。 */
	description: string;
	/** SKILL.md 的完整路径。 */
	filePath: string;
	/** 技能资源解析使用的根目录。 */
	baseDir: string;
	/** 为 true 时不把技能暴露给模型主动调用。 */
	disableModelInvocation?: boolean;
	/** 可选来源标签，默认使用 test。 */
	source?: string;
}): Skill {
	return {
		name: options.name,
		description: options.description,
		filePath: options.filePath,
		baseDir: options.baseDir,
		sourceInfo: createSyntheticSourceInfo(options.filePath, { source: options.source ?? "test" }),
		disableModelInvocation: options.disableModelInvocation ?? false,
	};
}

describe("skills", () => {
	describe("loadSkillsFromDir", () => {
		// 合法 SKILL.md 应加载完整元数据且不产生诊断。
		it("should load a valid skill", () => {
			/** 合法夹具返回的技能与诊断。 */
			const { skills, diagnostics } = loadSkillsFromDir({
				dir: join(fixturesDir, "valid-skill"),
				source: "test",
			});

			expect(skills).toHaveLength(1);
			expect(skills[0].name).toBe("valid-skill");
			expect(skills[0].description).toBe("A valid skill for testing purposes.");
			expect(skills[0].sourceInfo.source).toBe("test");
			expect(diagnostics).toHaveLength(0);
		});

		// frontmatter 中的名称允许与父目录不同。
		it("should allow names that don't match parent directory", () => {
			/** 名称不匹配夹具的加载结果。 */
			const { skills, diagnostics } = loadSkillsFromDir({
				dir: join(fixturesDir, "name-mismatch"),
				source: "test",
			});

			expect(skills).toHaveLength(1);
			expect(skills[0].name).toBe("different-name");
			expect(
				diagnostics.some((d: ResourceDiagnostic) => d.message.includes("does not match parent directory")),
			).toBe(false);
		});

		// 名称含非法字符时仍加载技能，但应给出警告。
		it("should warn when name contains invalid characters", () => {
			/** 非法字符名称夹具的加载结果。 */
			const { skills, diagnostics } = loadSkillsFromDir({
				dir: join(fixturesDir, "invalid-name-chars"),
				source: "test",
			});

			expect(skills).toHaveLength(1);
			expect(diagnostics.some((d: ResourceDiagnostic) => d.message.includes("invalid characters"))).toBe(true);
		});

		// 超过 64 字符的名称应产生长度诊断。
		it("should warn when name exceeds 64 characters", () => {
			/** 超长名称夹具的加载结果。 */
			const { skills, diagnostics } = loadSkillsFromDir({
				dir: join(fixturesDir, "long-name"),
				source: "test",
			});

			expect(skills).toHaveLength(1);
			expect(diagnostics.some((d: ResourceDiagnostic) => d.message.includes("exceeds 64 characters"))).toBe(true);
		});

		// 缺少必填描述的技能应被跳过并报告原因。
		it("should warn and skip skill when description is missing", () => {
			/** 缺少描述夹具的加载结果。 */
			const { skills, diagnostics } = loadSkillsFromDir({
				dir: join(fixturesDir, "missing-description"),
				source: "test",
			});

			expect(skills).toHaveLength(0);
			expect(diagnostics.some((d: ResourceDiagnostic) => d.message.includes("description is required"))).toBe(true);
		});

		// 未识别的 frontmatter 字段不应阻止技能加载。
		it("should ignore unknown frontmatter fields", () => {
			/** 带未知字段夹具的加载结果。 */
			const { skills, diagnostics } = loadSkillsFromDir({
				dir: join(fixturesDir, "unknown-field"),
				source: "test",
			});

			expect(skills).toHaveLength(1);
			expect(diagnostics).toHaveLength(0);
		});

		// 扫描器应递归发现嵌套目录中的技能。
		it("should load nested skills recursively", () => {
			/** 嵌套技能夹具的加载结果。 */
			const { skills, diagnostics } = loadSkillsFromDir({
				dir: join(fixturesDir, "nested"),
				source: "test",
			});

			expect(skills).toHaveLength(1);
			expect(skills[0].name).toBe("child-skill");
			expect(diagnostics).toHaveLength(0);
		});

		// 当前目录已有根 SKILL.md 时，不应继续把其子目录技能重复加载。
		it("should prefer a directory's root SKILL.md over nested SKILL.md files", () => {
			/** 同时具有根技能和嵌套技能的加载结果。 */
			const { skills, diagnostics } = loadSkillsFromDir({
				dir: join(fixturesDir, "root-skill-preferred"),
				source: "test",
			});

			expect(skills).toHaveLength(1);
			expect(skills[0].name).toBe("root-skill-preferred");
			expect(skills[0].description).toBe("Root skill should win.");
			expect(diagnostics).toHaveLength(0);
		});

		// 没有 frontmatter 的文件因缺少描述而被跳过。
		it("should skip files without frontmatter", () => {
			/** 无 frontmatter 夹具的加载结果。 */
			const { skills, diagnostics } = loadSkillsFromDir({
				dir: join(fixturesDir, "no-frontmatter"),
				source: "test",
			});

			// no-frontmatter has no description, so it should be skipped
			// no-frontmatter 没有描述，因此应被跳过。
			expect(skills).toHaveLength(0);
			expect(diagnostics.some((d: ResourceDiagnostic) => d.message.includes("description is required"))).toBe(true);
		});

		// YAML 语法无效时应报告位置并跳过技能。
		it("should warn and skip skill when YAML frontmatter is invalid", () => {
			/** 无效 YAML 夹具的加载结果。 */
			const { skills, diagnostics } = loadSkillsFromDir({
				dir: join(fixturesDir, "invalid-yaml"),
				source: "test",
			});

			expect(skills).toHaveLength(0);
			expect(diagnostics.some((d: ResourceDiagnostic) => d.message.includes("at line"))).toBe(true);
		});

		// YAML 多行描述应保留换行和完整文本。
		it("should preserve multiline descriptions from YAML", () => {
			/** 多行描述夹具的加载结果。 */
			const { skills, diagnostics } = loadSkillsFromDir({
				dir: join(fixturesDir, "multiline-description"),
				source: "test",
			});

			expect(skills).toHaveLength(1);
			expect(skills[0].description).toContain("\n");
			expect(skills[0].description).toContain("This is a multiline description.");
			expect(diagnostics).toHaveLength(0);
		});

		// 名称中连续短横线应产生格式警告。
		it("should warn when name contains consecutive hyphens", () => {
			/** 连续短横线名称夹具的加载结果。 */
			const { skills, diagnostics } = loadSkillsFromDir({
				dir: join(fixturesDir, "consecutive-hyphens"),
				source: "test",
			});

			expect(skills).toHaveLength(1);
			expect(diagnostics.some((d: ResourceDiagnostic) => d.message.includes("consecutive hyphens"))).toBe(true);
		});

		// 从夹具根目录扫描时应找到所有拥有描述的技能。
		it("should load all skills from fixture directory", () => {
			/** 整个技能夹具目录中成功加载的技能。 */
			const { skills } = loadSkillsFromDir({
				dir: fixturesDir,
				source: "test",
			});

			// Should load all skills that have descriptions (even with warnings)
			// 应加载所有包含描述的技能，即使它们伴随警告。
			// valid-skill, name-mismatch, invalid-name-chars, long-name, unknown-field, nested/child-skill, consecutive-hyphens
			// 上一行列出预期可加载的各个夹具目录。
			// NOT: missing-description, no-frontmatter (both missing descriptions)
			// 不应包含 missing-description 与 no-frontmatter，因为两者都缺少描述。
			expect(skills.length).toBeGreaterThanOrEqual(6);
		});

		// 不存在的目录应被视为空来源，而不是抛出异常。
		it("should return empty for non-existent directory", () => {
			/** 不存在目录的空加载结果。 */
			const { skills, diagnostics } = loadSkillsFromDir({
				dir: "/non/existent/path",
				source: "test",
			});

			expect(skills).toHaveLength(0);
			expect(diagnostics).toHaveLength(0);
		});

		// 未显式声明名称时，应从技能父目录名推导。
		it("should use parent directory name when name not in frontmatter", () => {
			// The no-frontmatter fixture has no name in frontmatter, so it should use "no-frontmatter"
			// no-frontmatter 未声明名称，因此理论上应使用目录名 no-frontmatter。
			// But it also has no description, so it won't load
			// 但该夹具同时缺少描述，所以不会实际加载。
			// Let's test with a valid skill that relies on directory name
			// 改用同样依赖目录名且描述合法的技能验证此规则。
			/** 依靠父目录名确定技能名称的加载结果。 */
			const { skills } = loadSkillsFromDir({
				dir: join(fixturesDir, "valid-skill"),
				source: "test",
			});

			expect(skills).toHaveLength(1);
			expect(skills[0].name).toBe("valid-skill");
		});

		// disable-model-invocation 字段应解析为模型可见性开关。
		it("should parse disable-model-invocation frontmatter field", () => {
			/** 禁止模型调用夹具的加载结果。 */
			const { skills, diagnostics } = loadSkillsFromDir({
				dir: join(fixturesDir, "disable-model-invocation"),
				source: "test",
			});

			expect(skills).toHaveLength(1);
			expect(skills[0].name).toBe("disable-model-invocation");
			expect(skills[0].disableModelInvocation).toBe(true);
			// Should not warn about unknown field
			// 该字段属于已知配置，不应产生未知字段警告。
			expect(diagnostics.some((d: ResourceDiagnostic) => d.message.includes("unknown frontmatter field"))).toBe(
				false,
			);
		});

		// 未指定模型调用开关时应默认允许模型看到技能。
		it("should default disableModelInvocation to false when not specified", () => {
			/** 未声明可见性开关的合法技能加载结果。 */
			const { skills } = loadSkillsFromDir({
				dir: join(fixturesDir, "valid-skill"),
				source: "test",
			});

			expect(skills).toHaveLength(1);
			expect(skills[0].disableModelInvocation).toBe(false);
		});
	});

	describe("formatSkillsForPrompt", () => {
		// 没有可用技能时不应向系统提示词添加空容器。
		it("should return empty string for no skills", () => {
			/** 空技能列表格式化后的结果。 */
			const result = formatSkillsForPrompt([]);
			expect(result).toBe("");
		});

		// 单个可见技能应转换为包含名称、描述和位置的 XML。
		it("should format skills as XML", () => {
			/** 用于基础 XML 格式验证的技能列表。 */
			const skills: Skill[] = [
				createTestSkill({
					name: "test-skill",
					description: "A test skill.",
					filePath: "/path/to/skill/SKILL.md",
					baseDir: "/path/to/skill",
				}),
			];

			/** 生成的技能提示词文本。 */
			const result = formatSkillsForPrompt(skills);

			expect(result).toContain("<available_skills>");
			expect(result).toContain("</available_skills>");
			expect(result).toContain("<skill>");
			expect(result).toContain("<name>test-skill</name>");
			expect(result).toContain("<description>A test skill.</description>");
			expect(result).toContain("<location>/path/to/skill/SKILL.md</location>");
		});

		// XML 前应包含指导模型读取技能文件的说明文字。
		it("should include intro text before XML", () => {
			/** 用于引导文字验证的技能列表。 */
			const skills: Skill[] = [
				createTestSkill({
					name: "test-skill",
					description: "A test skill.",
					filePath: "/path/to/skill/SKILL.md",
					baseDir: "/path/to/skill",
				}),
			];

			/** 完整技能提示词。 */
			const result = formatSkillsForPrompt(skills);
			/** available_skills XML 根标签的起始位置。 */
			const xmlStart = result.indexOf("<available_skills>");
			/** XML 根标签之前的模型使用说明。 */
			const introText = result.substring(0, xmlStart);

			expect(introText).toContain("The following skills provide specialized instructions");
			expect(introText).toContain("Use the read tool to load a skill's file");
		});

		// 描述中的 XML 特殊字符必须转义，避免破坏提示词结构。
		it("should escape XML special characters", () => {
			/** 描述含尖括号、与号和引号的技能列表。 */
			const skills: Skill[] = [
				createTestSkill({
					name: "test-skill",
					description: 'A skill with <special> & "characters".',
					filePath: "/path/to/skill/SKILL.md",
					baseDir: "/path/to/skill",
				}),
			];

			/** 转义后的技能提示词。 */
			const result = formatSkillsForPrompt(skills);

			expect(result).toContain("&lt;special&gt;");
			expect(result).toContain("&amp;");
			expect(result).toContain("&quot;characters&quot;");
		});

		// 多个技能应分别生成独立 skill 元素。
		it("should format multiple skills", () => {
			/** 两个不同名称和路径的可见技能。 */
			const skills: Skill[] = [
				createTestSkill({
					name: "skill-one",
					description: "First skill.",
					filePath: "/path/one/SKILL.md",
					baseDir: "/path/one",
				}),
				createTestSkill({
					name: "skill-two",
					description: "Second skill.",
					filePath: "/path/two/SKILL.md",
					baseDir: "/path/two",
				}),
			];

			/** 包含两个 skill 元素的提示词。 */
			const result = formatSkillsForPrompt(skills);

			expect(result).toContain("<name>skill-one</name>");
			expect(result).toContain("<name>skill-two</name>");
			expect((result.match(/<skill>/g) || []).length).toBe(2);
		});

		// 禁止模型调用的技能应从提示词中剔除，但仍可由用户显式调用。
		it("should exclude skills with disableModelInvocation from prompt", () => {
			/** 同时包含可见与隐藏技能的列表。 */
			const skills: Skill[] = [
				createTestSkill({
					name: "visible-skill",
					description: "A visible skill.",
					filePath: "/path/visible/SKILL.md",
					baseDir: "/path/visible",
				}),
				createTestSkill({
					name: "hidden-skill",
					description: "A hidden skill.",
					filePath: "/path/hidden/SKILL.md",
					baseDir: "/path/hidden",
					disableModelInvocation: true,
				}),
			];

			/** 过滤隐藏技能后的提示词。 */
			const result = formatSkillsForPrompt(skills);

			expect(result).toContain("<name>visible-skill</name>");
			expect(result).not.toContain("<name>hidden-skill</name>");
			expect((result.match(/<skill>/g) || []).length).toBe(1);
		});

		// 所有技能都隐藏时应返回空字符串。
		it("should return empty string when all skills have disableModelInvocation", () => {
			/** 仅包含禁止模型调用技能的列表。 */
			const skills: Skill[] = [
				createTestSkill({
					name: "hidden-skill",
					description: "A hidden skill.",
					filePath: "/path/hidden/SKILL.md",
					baseDir: "/path/hidden",
					disableModelInvocation: true,
				}),
			];

			/** 全部过滤后的空提示词。 */
			const result = formatSkillsForPrompt(skills);
			expect(result).toBe("");
		});
	});

	describe("loadSkills with options", () => {
		/** 不含默认技能的测试 agent 目录。 */
		const emptyAgentDir = resolve(__dirname, "fixtures/empty-agent");
		/** 不含项目技能的测试工作目录。 */
		const emptyCwd = resolve(__dirname, "fixtures/empty-cwd");

		// 显式 skillPaths 应作为临时来源加载。
		it("should load from explicit skillPaths", () => {
			/** 显式指定合法技能路径后的组合加载结果。 */
			const { skills, diagnostics } = loadSkills({
				agentDir: emptyAgentDir,
				cwd: emptyCwd,
				skillPaths: [join(fixturesDir, "valid-skill")],
				includeDefaults: true,
			});
			expect(skills).toHaveLength(1);
			expect(skills[0].sourceInfo.scope).toBe("temporary");
			expect(diagnostics).toHaveLength(0);
		});

		// 显式路径不存在时应给出诊断而不抛错。
		it("should warn when skill path does not exist", () => {
			/** 指定不存在技能路径后的加载结果。 */
			const { skills, diagnostics } = loadSkills({
				agentDir: emptyAgentDir,
				cwd: emptyCwd,
				skillPaths: ["/non/existent/path"],
				includeDefaults: true,
			});
			expect(skills).toHaveLength(0);
			expect(diagnostics.some((d: ResourceDiagnostic) => d.message.includes("does not exist"))).toBe(true);
		});

		// skillPaths 中的波浪号应展开为当前用户主目录。
		it("should expand ~ in skillPaths", () => {
			/** 用户默认技能目录的完整路径。 */
			const homeSkillsDir = join(homedir(), ".pi/agent/skills");
			/** 使用波浪号路径加载得到的技能。 */
			const { skills: withTilde } = loadSkills({
				agentDir: emptyAgentDir,
				cwd: emptyCwd,
				skillPaths: ["~/.pi/agent/skills"],
				includeDefaults: true,
			});
			/** 使用等价绝对路径加载得到的技能。 */
			const { skills: withoutTilde } = loadSkills({
				agentDir: emptyAgentDir,
				cwd: emptyCwd,
				skillPaths: [homeSkillsDir],
				includeDefaults: true,
			});
			expect(withTilde.length).toBe(withoutTilde.length);
		});
	});

	describe("collision handling", () => {
		// 同名技能冲突时应保留先加载来源，并为后续来源生成警告。
		it("should detect name collisions and keep first skill", () => {
			// Load from first directory
			// 加载优先级更高的第一个技能来源。
			/** 第一个来源目录的技能加载结果。 */
			const first = loadSkillsFromDir({
				dir: join(collisionFixturesDir, "first"),
				source: "first",
			});

			/** 第二个来源目录的同名技能加载结果。 */
			const second = loadSkillsFromDir({
				dir: join(collisionFixturesDir, "second"),
				source: "second",
			});

			// Simulate the collision behavior from loadSkills()
			// 模拟 loadSkills() 按先到先得规则合并技能的行为。
			/** 已接受技能的名称到对象映射。 */
			const skillMap = new Map<string, Skill>();
			/** 后加载同名技能产生的冲突警告。 */
			const collisionWarnings: Array<{ skillPath: string; message: string }> = [];

			for (const skill of first.skills) {
				skillMap.set(skill.name, skill);
			}

			for (const skill of second.skills) {
				/** 已由更高优先级来源注册的同名技能。 */
				const existing = skillMap.get(skill.name);
				if (existing) {
					collisionWarnings.push({
						skillPath: skill.filePath,
						message: `name collision: "${skill.name}" already loaded from ${existing.filePath}`,
					});
				} else {
					skillMap.set(skill.name, skill);
				}
			}

			expect(skillMap.size).toBe(1);
			expect(skillMap.get("calendar")?.sourceInfo.source).toBe("first");
			expect(collisionWarnings).toHaveLength(1);
			expect(collisionWarnings[0].message).toContain("name collision");
		});
	});
});
