/**
 * 文件职责：静态验证 HTML 导出模板对 Markdown URL、属性值和树元数据进行 XSS 防护。
 * 技术维度：使用 Vitest、模板源码读取和正则断言检查清洗、转义代码是否存在。
 * 产品维度：防止恶意会话内容在用户打开导出 HTML 时执行脚本或突破属性边界。
 * 逻辑维度：加载 template.js，逐项检查链接、图片、控制字符、ID、树字段和模型名。
 * 关键边界：这是源码结构回归测试，不替代浏览器级安全测试；模板重构需同步断言。
 * 新手阅读建议：按 URL→属性→树元数据顺序阅读，理解 allow-list 与 escapeHtml 的分工。
 */
import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

/** HTML 导出 Markdown 与属性转义测试组。 */
describe("export HTML markdown link sanitization", () => {
	/** 被静态检查的完整导出模板源码。 */
	const templateJs = readFileSync(new URL("../src/core/export-html/template.js", import.meta.url), "utf-8");

	/** 验证链接渲染器使用协议白名单清洗 href。 */
	it("overrides the marked link renderer to use scheme allow-list sanitization", () => {
		expect(templateJs).toMatch(/link\s*\(\s*token\s*\)/);
		expect(templateJs).toMatch(/sanitizeMarkdownUrl\(token\.href\)/);
		expect(templateJs).toMatch(/\^\(https\?\|mailto\|tel\|ftp\)/);
	});

	/** 验证图片渲染器同样清洗 URL。 */
	it("overrides the marked image renderer to use scheme allow-list sanitization", () => {
		expect(templateJs).toMatch(/image\s*\(\s*token\s*\)/);
		expect(templateJs).toMatch(/sanitizeMarkdownUrl\(token\.href\)/);
	});

	/** 验证检查和输出 URL 前删除 C0 控制字符，而非依赖危险协议黑名单。 */
	it("strips C0 controls before checking and emitting markdown URLs", () => {
		expect(templateJs).toContain("replace(/[\\x00-\\x1f\\x7f]/g, '')");
		expect(templateJs).not.toMatch(/\^\\s\*\(javascript\|vbscript\|data\):/i);
	});

	/** 验证自定义链接渲染器对 href 做 HTML 转义。 */
	it("escapes href attributes in the custom link renderer", () => {
		// The link renderer must escape href values to prevent attribute breakout
		// 链接渲染器必须转义 href，防止突破属性边界。
		expect(templateJs).toMatch(/escapeHtml\(href\)/);
	});

	/** 验证图片 MIME 类型进入属性前被转义。 */
	it("escapes image mimeType attributes", () => {
		// Image mimeType must be escaped to prevent attribute breakout
		// 图片 mimeType 必须转义，防止突破属性边界。
		expect(templateJs).not.toMatch(/\$\{img\.mimeType\}/);
		expect(templateJs).toMatch(/escapeHtml\(img\.mimeType/);
	});

	/** 验证 Base64 图片数据进入 src 属性前被转义。 */
	it("escapes image data attributes", () => {
		// Image data is embedded in src attributes and must not allow attribute breakout.
		// 图片数据嵌入 src 属性，不能允许突破属性边界。
		expect(templateJs).not.toMatch(/;base64,\$\{img\.data\}"/);
		expect(templateJs).toMatch(/;base64,\$\{escapeHtml\(img\.data \|\| (?:''|"")\)\}"/);
	});

	/** 验证会话条目 ID 进入 id 与 data 属性前被转义。 */
	it("escapes entry IDs before inserting them into attributes", () => {
		// Session entry IDs are embedded in id and data-entry-id attributes.
		// 会话条目 ID 会写入 id 与 data-entry-id 属性。
		expect(templateJs).not.toMatch(/id="\$\{entryId\}"/);
		expect(templateJs).not.toMatch(/data-entry-id="\$\{entryId\}"/);
		expect(templateJs).toMatch(/entry-\$\{escapeHtml\(entry\.id\)\}/);
		expect(templateJs).toMatch(/data-entry-id="\$\{escapeHtml\(entryId\)\}"/);
	});

	/** 验证树视图的工具、角色、模型、思考等级与类型字段全部转义。 */
	it("escapes tree metadata rendered from session fields", () => {
		// The tree renders session metadata via innerHTML, so dynamic fields must be escaped.
		// 树通过 innerHTML 渲染会话元数据，因此动态字段必须转义。
		expect(templateJs).not.toMatch(/\[\$\{msg\.toolName \|\| 'tool'\}\]/);
		expect(templateJs).not.toMatch(/\[\$\{msg\.role\}\]/);
		expect(templateJs).not.toMatch(/\[model: \$\{entry\.modelId\}\]/);
		expect(templateJs).not.toMatch(/\[thinking: \$\{entry\.thinkingLevel\}\]/);
		expect(templateJs).not.toMatch(/\[\$\{entry\.type\}\]/);
		expect(templateJs).toMatch(/\$\{escapeHtml\(msg\.toolName \|\| 'tool'\)\}/);
		expect(templateJs).toMatch(/\$\{escapeHtml\(msg\.role\)\}/);
		expect(templateJs).toMatch(/\$\{escapeHtml\(entry\.modelId\)\}/);
		expect(templateJs).toMatch(/\$\{escapeHtml\(entry\.thinkingLevel\)\}/);
		expect(templateJs).toMatch(/\$\{escapeHtml\(entry\.type\)\}/);
	});

	/** 验证导出页头中的模型名称列表被转义。 */
	it("escapes model names in the exported header", () => {
		// Assistant message provider/model values are collected from the session and rendered with innerHTML.
		// 助手提供方/模型值来自会话并通过 innerHTML 渲染，必须转义。
		expect(templateJs).not.toMatch(/\$\{globalStats\.models\.join\(', '\) \|\| 'unknown'\}/);
		expect(templateJs).toMatch(/\$\{escapeHtml\(globalStats\.models\.join\(', '\) \|\| 'unknown'\)\}/);
	});
});
