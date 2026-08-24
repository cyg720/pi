/**
 * 文件职责：验证 HTML 高亮片段渲染器和交互主题语法着色的关键映射行为。
 * 技术维度：使用 Vitest、highlight.js 结果解析、终端真彩色能力模拟和 ANSI 字符串断言。
 * 产品维度：保证代码块在终端中颜色正确、实体解码安全，并能处理嵌套语法作用域。
 * 逻辑维度：第一组测试通用高亮渲染，第二组初始化深色主题后检查 diff 与常见语言样式。
 * 关键边界：断言依赖主题具体 RGB 值和 highlight.js 输出结构；用例后要重置能力缓存。
 * 新手阅读建议：先看 renderHighlightedHtml 的纯文本用例，再看需要主题初始化的 ANSI 用例。
 */
import { resetCapabilitiesCache, setCapabilities } from "@earendil-works/pi-tui";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { highlightCode, initTheme } from "../src/modes/interactive/theme/theme.ts";
import { highlight, renderHighlightedHtml, supportsLanguage } from "../src/utils/syntax-highlight.ts";

describe("syntax highlight renderer", () => {
	// 验证调用方提供的主题函数会包装对应语法作用域；无参数，无返回值。
	it("renders highlighted spans with the provided theme", () => {
		// rendered 是将 keyword 作用域映射为测试标记后的纯文本。
		const rendered = renderHighlightedHtml('<span class="hljs-keyword">const</span> value', {
			// text 是当前关键字文本，回调用可见标记展示主题映射结果。
			keyword: (text) => `[keyword:${text}]`,
		});
		expect(rendered).toBe("[keyword:const] value");
	});

	// 验证 highlight.js 输出中的命名、十六进制和十进制 HTML 实体解码；无参数，无返回值。
	it("decodes HTML entities emitted by highlight.js", () => {
		// rendered 是实体解码后的普通代码文本。
		const rendered = renderHighlightedHtml("&lt;tag attr=&quot;value&quot;&gt;&amp;#x41;&#65;&lt;/tag&gt;");
		expect(rendered).toBe('<tag attr="value">&#x41;A</tag>');
	});

	// 验证未映射的嵌套作用域继承父级字符串格式；无参数，无返回值。
	it("inherits parent formatting for unmapped nested scopes", () => {
		// interpolation 保存避免模板字面量直接插值的 `${x}` 示例文本。
		const interpolation = "$" + "{x}";
		// rendered 是嵌套 subst 作用域继承 string 主题后的结果。
		const rendered = renderHighlightedHtml(
			`<span class="hljs-string">a<span class="hljs-subst">${interpolation}</span>b</span>`,
			{
				// text 是当前字符串片段，回调用测试标记表示着色结果。
				string: (text) => `[string:${text}]`,
			},
		);
		expect(rendered).toBe(`[string:a][string:${interpolation}][string:b]`);
	});

	// 验证没有 hljs 作用域的嵌套 span 不会中断父级格式；无参数，无返回值。
	it("keeps parent formatting across unscoped nested spans", () => {
		// rendered 是跨 language-xml 子 span 保持 string 样式的结果。
		const rendered = renderHighlightedHtml('<span class="hljs-string">a<span class="language-xml">b</span>c</span>', {
			// text 是当前字符串片段，回调用测试标记表示着色结果。
			string: (text) => `[string:${text}]`,
		});
		expect(rendered).toBe("[string:a][string:b][string:c]");
	});

	// 验证公开 highlight 接口会调用 highlight.js 并应用主题；无参数，无返回值。
	it("highlights code through highlight.js", () => {
		expect(supportsLanguage("typescript")).toBe(true);
		// rendered 是 TypeScript 示例代码经过关键字和数字主题映射后的文本。
		const rendered = highlight("const value = 1", {
			language: "typescript",
			ignoreIllegals: true,
			theme: {
				// text 是关键字文本，回调返回便于断言的标记。
				keyword: (text) => `[keyword:${text}]`,
				// text 是数字文本，回调返回便于断言的标记。
				number: (text) => `[number:${text}]`,
			},
		});
		expect(rendered).toContain("[keyword:const]");
		expect(rendered).toContain("[number:1]");
	});
});

describe("theme syntax highlighting", () => {
	// 每个用例前启用真彩色能力并初始化深色主题；无参数，无返回值。
	beforeEach(() => {
		setCapabilities({ images: null, trueColor: true, hyperlinks: false });
		initTheme("dark");
	});

	// 每个用例后重置终端能力缓存，避免影响其他测试；无参数，无返回值。
	afterEach(() => {
		resetCapabilitiesCache();
	});

	// 验证 diff 删除行和新增行分别使用主题规定颜色；无参数，无返回值。
	it("colors diff additions and deletions in fenced diff blocks", () => {
		// lines 是 diff 源码按行转换后的 ANSI 着色字符串数组。
		const lines = highlightCode("-old\n+new\n", "diff");

		expect(lines[0]).toBe("\x1b[38;2;204;102;102m-old\x1b[39m");
		expect(lines[1]).toBe("\x1b[38;2;181;189;104m+new\x1b[39m");
	});

	// 验证正则、装饰器和 HTML 标签等默认作用域映射到主题样式；无参数，无返回值。
	it("keeps cli-highlight default styled scopes mapped to theme styles", () => {
		expect(highlightCode("const re = /foo+/gi;", "javascript")[0]).toContain(
			"\x1b[38;2;206;145;120m/foo+/gi\x1b[39m",
		);
		expect(highlightCode("@decorator", "python")[0]).toBe("\x1b[38;2;128;128;128m@decorator\x1b[39m");
		expect(highlightCode("<div></div>", "html")[0]).toContain("\x1b[38;2;86;156;214mdiv\x1b[39m");
	});
});
