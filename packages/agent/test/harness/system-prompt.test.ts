/**
 * 文件职责：验证系统提示中的技能列表排序、禁用过滤和 XML 转义。
 * 技术维度：使用 Vitest、技能对象夹具和精确多行字符串断言。
 * 产品维度：让模型只看到允许调用的技能，并防止特殊字符破坏提示 XML 结构。
 * 逻辑维度：准备两个可见技能和一个禁用技能，覆盖正常列表、全禁用和特殊字符三种情况。
 * 关键边界：disableModelInvocation 只影响模型可见性；文件路径和名称都必须进行 XML 转义。
 * 新手阅读建议：先比较三个技能夹具，再对照期望 XML 中的顺序和转义实体。
 */
import { describe, expect, it } from "vitest";
import { formatSkillsForSystemPrompt } from "../../src/harness/system-prompt.ts";

/** 第一个模型可见技能，description 故意含 XML 特殊字符。 */
const visibleSkill = {
	name: "visible",
	description: "Use <this> & that",
	content: "visible content",
	filePath: "/skills/visible/SKILL.md",
};

/** 第二个模型可见技能，用于验证顺序。 */
const secondSkill = {
	name: "second",
	description: "Second skill",
	content: "second content",
	filePath: "/skills/second/SKILL.md",
};

/** 禁止模型调用的技能，格式化时必须跳过。 */
const disabledSkill = {
	name: "hidden",
	description: "Hidden",
	content: "hidden content",
	filePath: "/skills/hidden/SKILL.md",
	disableModelInvocation: true,
};

/** 系统提示技能列表格式化测试组。 */
describe("formatSkillsForSystemPrompt", () => {
	/** 验证过滤禁用技能、保留输入顺序并转义可见描述。 */
	it("formats visible skills in order and skips model-disabled skills", () => {
		expect(formatSkillsForSystemPrompt([visibleSkill, disabledSkill, secondSkill])).toBe(
			`The following skills provide specialized instructions for specific tasks.
Read the full skill file when the task matches its description.
When a skill file references a relative path, resolve it against the skill directory (parent of SKILL.md / dirname of the path) and use that absolute path in tool commands.

<available_skills>
  <skill>
    <name>visible</name>
    <description>Use &lt;this&gt; &amp; that</description>
    <location>/skills/visible/SKILL.md</location>
  </skill>
  <skill>
    <name>second</name>
    <description>Second skill</description>
    <location>/skills/second/SKILL.md</location>
  </skill>
</available_skills>`,
		);
	});

	/** 验证没有任何模型可见技能时返回空字符串。 */
	it("returns an empty string when no skills are model-visible", () => {
		expect(formatSkillsForSystemPrompt([disabledSkill])).toBe("");
	});

	/** 验证名称、描述和路径中的 XML 特殊字符全部转义。 */
	it("escapes XML in all model-visible skill fields", () => {
		expect(
			formatSkillsForSystemPrompt([
				{
					name: "a&b",
					description: `Quote "double" and 'single'`,
					content: "content",
					filePath: '/skills/<bad>&"quote"/SKILL.md',
				},
			]),
		).toContain(
			"<name>a&amp;b</name>\n    <description>Quote &quot;double&quot; and &apos;single&apos;</description>\n    <location>/skills/&lt;bad&gt;&amp;&quot;quote&quot;/SKILL.md</location>",
		);
	});
});
