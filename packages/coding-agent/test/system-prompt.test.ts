/**
 * 文件职责：验证系统提示对空工具、默认工具、自定义工具和附加行为指南的文本组织。
 * 技术维度：使用 Vitest 和 buildSystemPrompt 纯函数对生成字符串进行局部匹配断言。
 * 产品维度：确保模型准确获知可用工具、文档路径规则和项目自定义操作规范。
 * 逻辑维度：按工具来源分组测试，再检查 promptGuidelines 的追加、去空和去重。
 * 关键边界：只断言关键片段而非完整提示，减少无关措辞变化导致的脆弱测试。
 * 新手阅读建议：先比较 empty/default/custom 三组工具，再看最后两例指南规范化。
 */
import { describe, expect, test } from "vitest";
import { buildSystemPrompt } from "../src/core/system-prompt.ts";

describe("buildSystemPrompt", () => {
	describe("empty tools", () => {
		// 验证显式空工具列表显示 (none)；无参数，无返回值。
		test("shows (none) for empty tools list", () => {
			// prompt 是无工具、上下文文件和技能时生成的系统提示。
			const prompt = buildSystemPrompt({
				selectedTools: [],
				contextFiles: [],
				skills: [],
				cwd: process.cwd(),
			});

			expect(prompt).toContain("Available tools:\n(none)");
		});

		// 验证即使没有工具也保留清晰展示文件路径的通用指南；无参数，无返回值。
		test("shows file paths guideline even with no tools", () => {
			// prompt 是空工具环境下的完整系统提示。
			const prompt = buildSystemPrompt({
				selectedTools: [],
				contextFiles: [],
				skills: [],
				cwd: process.cwd(),
			});

			expect(prompt).toContain("Show file paths clearly");
		});
	});

	describe("default tools", () => {
		// 验证提供默认工具摘要时四个工具均出现在提示中；无参数，无返回值。
		test("includes all default tools when snippets are provided", () => {
			// prompt 是包含 read、bash、edit、write 摘要的系统提示。
			const prompt = buildSystemPrompt({
				toolSnippets: {
					read: "Read file contents",
					bash: "Execute bash commands",
					edit: "Make surgical edits",
					write: "Create or overwrite files",
				},
				contextFiles: [],
				skills: [],
				cwd: process.cwd(),
			});

			expect(prompt).toContain("- read:");
			expect(prompt).toContain("- bash:");
			expect(prompt).toContain("- edit:");
			expect(prompt).toContain("- write:");
		});

		// 验证提示明确区分 pi 文档/示例根路径与当前工作目录；无参数，无返回值。
		test("instructs models to resolve pi docs and examples under absolute base paths", () => {
			// prompt 是使用默认工具与内置路径指南的系统提示。
			const prompt = buildSystemPrompt({
				contextFiles: [],
				skills: [],
				cwd: process.cwd(),
			});

			expect(prompt).toContain(
				"- When reading pi docs or examples, resolve docs/... under Additional docs and examples/... under Examples, not the current working directory",
			);
			expect(prompt).toContain("environment variables (docs/environment-variables.md)");
		});
	});

	describe("custom tool snippets", () => {
		// 验证有 promptSnippet 的自定义工具显示在工具段；无参数，无返回值。
		test("includes custom tools in available tools section when promptSnippet is provided", () => {
			// prompt 是同时选择 read 和 dynamic_tool 的系统提示。
			const prompt = buildSystemPrompt({
				selectedTools: ["read", "dynamic_tool"],
				toolSnippets: {
					dynamic_tool: "Run dynamic test behavior",
				},
				contextFiles: [],
				skills: [],
				cwd: process.cwd(),
			});

			expect(prompt).toContain("- dynamic_tool: Run dynamic test behavior");
		});

		// 验证缺少摘要的自定义工具不会产生误导性提示项；无参数，无返回值。
		test("omits custom tools from available tools section when promptSnippet is not provided", () => {
			// prompt 选择 dynamic_tool 但不提供其摘要。
			const prompt = buildSystemPrompt({
				selectedTools: ["read", "dynamic_tool"],
				contextFiles: [],
				skills: [],
				cwd: process.cwd(),
			});

			expect(prompt).not.toContain("dynamic_tool");
		});
	});

	describe("prompt guidelines", () => {
		// 验证自定义指南追加到默认指南；无参数，无返回值。
		test("appends promptGuidelines to default guidelines", () => {
			// prompt 包含一条项目自定义工具使用指南。
			const prompt = buildSystemPrompt({
				selectedTools: ["read", "dynamic_tool"],
				promptGuidelines: ["Use dynamic_tool for project summaries."],
				contextFiles: [],
				skills: [],
				cwd: process.cwd(),
			});

			expect(prompt).toContain("- Use dynamic_tool for project summaries.");
		});

		// 验证指南去除首尾空白、忽略空项并去重；无参数，无返回值。
		test("deduplicates and trims promptGuidelines", () => {
			// prompt 输入两条内容相同但空白不同的指南和一个空项。
			const prompt = buildSystemPrompt({
				selectedTools: ["read", "dynamic_tool"],
				promptGuidelines: ["Use dynamic_tool for summaries.", "  Use dynamic_tool for summaries.  ", "   "],
				contextFiles: [],
				skills: [],
				cwd: process.cwd(),
			});

			expect(prompt.match(/- Use dynamic_tool for summaries\./g)).toHaveLength(1);
		});
	});
});
