/**
 * 文件职责：静态验证 HTML 导出模板包含技能调用块的解析、分栏和 Markdown 渲染逻辑。
 * 技术维度：使用 Vitest、同步读取模板源码和正则匹配进行轻量结构回归检查。
 * 产品维度：确保导出的会话清晰区分技能说明与用户提示，并在侧栏保留可导航信息。
 * 逻辑维度：加载 template.js 文本，分别检查 XML 剥离、兄弟块、Markdown 解析和侧栏标记。
 * 关键边界：只验证关键代码片段存在，不执行浏览器渲染；模板重构时需同步调整断言。
 * 新手阅读建议：先读 templateJs 的来源，再把四个用例分别对应到导出页面的正文和侧栏。
 */
import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

/** HTML 导出技能块源码结构测试组。 */
describe("export HTML skill block rendering", () => {
	/** 被检查的 HTML 导出模板 JavaScript 源码文本。 */
	const templateJs = readFileSync(new URL("../src/core/export-html/template.js", import.meta.url), "utf-8");

	/** 验证模板会解析技能包装 XML，只显示用户真正输入的提示。 */
	it("strips skill wrapper XML from user message rendering", () => {
		// Skill commands store a structural wrapper in the raw user message:
		// 技能命令会在原始用户消息中保存一个结构化包装层：
		//   <skill name="..." location="...">\n...\n</skill>\n\nactual prompt
		// 上行示例中 XML 后面的 actual prompt 才是用户可见提示。
		// The export renderer must detect that wrapper and render only the user-visible prompt,
		// 导出渲染器必须识别包装层，并只渲染用户可见提示，
		// not the Pi-generated <skill>...</skill> XML tags.
		// 不应显示 Pi 自动生成的 <skill> 标签。
		expect(templateJs).toMatch(/parseSkillBlock/);
		expect(templateJs).toMatch(/skillBlock\.userMessage/);
	});

	/** 验证技能说明与用户消息渲染成同级块，而非互相嵌套。 */
	it("renders skill invocation and user message as separate sibling blocks", () => {
		// The skill block and user message should render as separate entry-level elements,
		// 技能块与用户消息应渲染为两个独立的条目级元素，
		// matching the TUI layout where SkillInvocationMessageComponent and
		// 与 TUI 中 SkillInvocationMessageComponent 和
		// UserMessageComponent are siblings, not nested.
		// UserMessageComponent 互为兄弟组件而非嵌套的布局保持一致。
		expect(templateJs).toMatch(/skill-invocation/);

		// When a skill block has a userMessage, the user-message div must be emitted
		// 技能块含 userMessage 时，必须在技能块之后单独输出 user-message div，
		// as a separate block after the skill-invocation div, containing the user-authored text.
		// 其中保存用户输入的文本。
		// Verify the code checks hasUserContent so the user-message div is only omitted
		// 检查代码使用 hasUserContent，确保只有在没有用户提示也没有图片时才省略该 div。
		// when the skill block has no user prompt and no images.
		// 该条件边界由上一行中文说明概括。
		expect(templateJs).toMatch(/hasUserContent/);
	});

	/** 验证技能正文通过安全 Markdown 解析，而不是按原始纯文本转义。 */
	it("renders skill content as markdown, not raw text", () => {
		// The skill block body is markdown (from the SKILL.md file).
		// 技能块正文来自 SKILL.md，因此内容格式是 Markdown。
		// It should be rendered through safeMarkedParse, not escaped as raw text.
		// 应使用 safeMarkedParse 安全渲染，不能仅按原始文本转义。
		expect(templateJs).toMatch(/safeMarkedParse\(skillBlock\.content\)/);
	});

	/** 验证侧栏树同时保留技能名称和用户提示。 */
	it("shows skill name and user message in the sidebar tree", () => {
		// The sidebar tree should display both the skill name and the user prompt,
		// 侧栏树应同时显示技能名称和用户提示，
		// not just one or the other.
		// 不能只保留其中一项。
		expect(templateJs).toMatch(/tree-role-skill/);
	});
});
