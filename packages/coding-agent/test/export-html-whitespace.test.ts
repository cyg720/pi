/**
 * 文件职责：验证 HTML 导出保留工具输出内部空白，同时不引入模板源码排版空白。
 * 技术维度：使用 Vitest、CSS 源码正则、ANSI 到 HTML 转换和自定义工具渲染器替身。
 * 产品维度：保证命令输出对齐、颜色和换行在导出页面正确显示，且没有多余空白行。
 * 逻辑维度：检查 CSS white-space 规则，验证 ANSI 行紧邻输出，再测试裁剪 TUI 首尾空行。
 * 关键边界：CSS 测试依赖选择器文本结构；组件和主题均为最小替身，不执行浏览器布局。
 * 新手阅读建议：先区分 pre-wrap 与 pre，再看最后用例如何把 ANSI 组件转换为 expanded HTML。
 */
import type { Component } from "@earendil-works/pi-tui";
import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { ansiLinesToHtml } from "../src/core/export-html/ansi-to-html.ts";
import { createToolHtmlRenderer } from "../src/core/export-html/tool-renderer.ts";
import type { ToolDefinition } from "../src/core/extensions/types.ts";
import type { Theme } from "../src/modes/interactive/theme/theme.ts";

/** HTML 导出工具空白处理测试组。 */
describe("export HTML tool output whitespace", () => {
	/** 验证普通输出容器使用 pre-wrap、ANSI 行使用 pre，且父容器不错误继承该规则。 */
	it("preserves whitespace for plain-text tool output lines without preserving template whitespace", () => {
		/** HTML 导出模板的完整 CSS 源码文本。 */
		const css = readFileSync(new URL("../src/core/export-html/template.css", import.meta.url), "utf-8");

		expect(css).toMatch(
			/\.output-preview > div:not\(\.expand-hint\),\s*\.output-full > div:not\(\.expand-hint\) \{[\s\S]*?white-space:\s*pre-wrap;/,
		);
		expect(css).toMatch(/\.ansi-line\s*\{[\s\S]*?white-space:\s*pre;/);
		expect(css).not.toMatch(/\.output-preview,\s*\.output-full\s*\{[\s\S]*?white-space:\s*pre-wrap;/);
	});

	/** 验证两条 ANSI 行转换后直接相邻，不夹入 JavaScript 模板换行。 */
	it("does not insert source whitespace between ANSI-rendered lines", () => {
		expect(ansiLinesToHtml(["one", "two"])).toBe('<div class="ansi-line">one</div><div class="ansi-line">two</div>');
	});

	/** 验证自定义 TUI 结果开头和结尾的纯间距行不会进入导出 HTML。 */
	it("trims TUI spacing lines from custom tool result HTML", () => {
		/** 渲染四行的最小组件；首尾为空，中间含红色 ANSI 文本和普通文本。 */
		const component: Component = { render: () => ["", "\u001b[31mone\u001b[0m", "two", ""], invalidate: () => {} };
		/** 带自定义 renderResult 的测试工具定义；unknown 中转仅用于构造最小夹具。 */
		const tool = {
			name: "custom",
			label: "custom",
			description: "custom",
			renderResult: () => component,
		} as unknown as ToolDefinition;
		/** 使用固定工具定义、空主题和 /tmp 工作目录创建的 HTML 渲染器。 */
		const renderer = createToolHtmlRenderer({
			/** 忽略查询参数并始终返回当前测试工具。 */
			getToolDefinition: () => tool,
			theme: {} as Theme,
			cwd: "/tmp",
		});

		expect(renderer.renderResult("id", "custom", [], undefined, false)?.expanded).toBe(
			'<div class="ansi-line"><span style="color:#800000">one</span></div><div class="ansi-line">two</div>',
		);
	});
});
