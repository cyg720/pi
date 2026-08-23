/**
 * 【文件职责】把可用技能列表格式化为系统提示词片段：以 XML 风格的 <available_skills> 清单告知模型
 *              有哪些技能、各自用途与文件位置，便于模型在任务匹配时自行读取技能文件。
 * 【技术维度】字符串模板拼接 + 简单 XML 转义；纯函数实现，无副作用。
 * 【产品维度】是“技能按需加载”机制的关键一环——系统提示词只放索引（名称/描述/路径），
 *              全文按需读取，节省上下文空间。
 * 【逻辑维度】过滤掉 disableModelInvocation 的技能 → 无可见技能返回空串 → 否则生成说明文字与逐项 <skill> 块。
 * 【关键边界】名称/描述/路径会做 XML 转义防止破坏结构；返回空串表示“本会话无可用技能”，调用方应据此跳过拼接。
 * 【新手阅读建议】半分钟读完：重点理解为什么只列索引不贴全文，以及 escapeXml 的必要性。
 */
import type { Skill } from "./types.ts";

// 把技能列表渲染为系统提示词文本段（中文说明）：
// 参数 skills —— 已加载的技能数组；返回提示词片段（无可用技能时为空串）。
export function formatSkillsForSystemPrompt(skills: Skill[]): string {
	// 仅保留允许模型调用的技能
	const visibleSkills = skills.filter((skill) => !skill.disableModelInvocation);
	if (visibleSkills.length === 0) return "";

	// 说明行 + 清单容器
	const lines = [
		"The following skills provide specialized instructions for specific tasks.",
		"Read the full skill file when the task matches its description.",
		"When a skill file references a relative path, resolve it against the skill directory (parent of SKILL.md / dirname of the path) and use that absolute path in tool commands.",
		"",
		"<available_skills>",
	];

	for (const skill of visibleSkills) {
		// 逐项输出名称、描述、位置（均转义）
		lines.push("  <skill>");
		lines.push(`    <name>${escapeXml(skill.name)}</name>`);
		lines.push(`    <description>${escapeXml(skill.description)}</description>`);
		lines.push(`    <location>${escapeXml(skill.filePath)}</location>`);
		lines.push("  </skill>");
	}

	lines.push("</available_skills>");
	return lines.join("\n");
}

// XML 特殊字符转义（私有）：& < > " ' 五个字符替换为实体，防止注入破坏标签结构
function escapeXml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}
