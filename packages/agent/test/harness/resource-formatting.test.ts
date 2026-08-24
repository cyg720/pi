/**
 * 文件职责：验证技能调用和提示词模板调用被格式化为代理可消费的文本协议。
 * 技术维度：使用 Vitest 对纯字符串转换函数做精确快照式断言。
 * 产品维度：保证技能内容、相对引用提示及用户附加指令完整进入模型上下文。
 * 逻辑维度：分别构造技能资源与模板参数，调用格式化函数并比较完整输出文本。
 * 关键边界：断言对换行和标签格式高度敏感；协议文本改动时必须确认下游解析或提示效果。
 * 新手阅读建议：先比较输入对象与期望字符串的字段映射，再进入两个格式化函数查看拼接规则。
 */
import { describe, expect, it } from "vitest";
import { formatPromptTemplateInvocation } from "../../src/harness/prompt-templates.ts";
import { formatSkillInvocation } from "../../src/harness/skills.ts";

/** 资源格式化辅助函数测试组。 */
describe("resource formatting helpers", () => {
	/** 验证技能元数据、目录提示、正文和附加指令按固定顺序拼接。 */
	it("formats skill invocations with additional instructions", () => {
		/** 模拟技能资源；字段均为确定测试值，filePath 用于推导引用基准目录。 */
		const skill = {
			name: "inspect",
			description: "Inspect things",
			content: "Use inspection tools.",
			filePath: "/project/.pi/skills/inspect/SKILL.md",
		};

		expect(formatSkillInvocation(skill, "Check errors.")).toBe(
			'<skill name="inspect" location="/project/.pi/skills/inspect/SKILL.md">\nReferences are relative to /project/.pi/skills/inspect.\n\nUse inspection tools.\n</skill>\n\nCheck errors.',
		);
	});

	/** 验证位置参数 $1 与聚合参数 $ARGUMENTS 会按调用参数正确展开。 */
	it("formats prompt template invocations with positional arguments", () => {
		expect(
			formatPromptTemplateInvocation({ name: "review", content: "Review $1 with $ARGUMENTS" }, ["a.ts", "care"]),
		).toBe("Review a.ts with a.ts care");
	});
});
