/**
 * 文件职责：验证 Markdown 终端组件对列表、表格、代码块、引用、标题、链接、样式和流式围栏的渲染。
 * 技术维度：使用 Node test、Chalk、无头 xterm 与虚拟终端，对 ANSI 样式、行宽、边框和单元格属性做精确断言。
 * 产品维度：保证模型输出在终端中可读、可换行且不泄漏样式，并兼容超链接能力和流式未完成内容。
 * 逻辑维度：先定义单元格与 ANSI 辅助函数，再按 Markdown 语法分组测试布局，最后覆盖终端样式和流式边界。
 * 关键边界：测试依赖固定主题、终端能力和精确字符宽度；修改渲染规则时需同时检查 ANSI 与去样式文本。
 * 新手阅读建议：先看列表和简单表格用例理解输出结构，再读样式恢复与链接，最后看虚拟终端和流式围栏回归。
 */
import assert from "node:assert";
import { afterEach, describe, it } from "node:test";
import type { Terminal as XtermTerminalType } from "@xterm/headless";
import { Chalk } from "chalk";
import { Markdown } from "../src/components/markdown.ts";
import { resetCapabilitiesCache, setCapabilities } from "../src/terminal-image.ts";
import { type Component, TUI } from "../src/tui.ts";
import { defaultMarkdownTheme } from "./test-themes.ts";
import { VirtualTerminal } from "./virtual-terminal.ts";

// Force full color in CI so ANSI assertions are deterministic
// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
const chalk = new Chalk({ level: 3 });

/** getCellItalic 执行当前测试辅助步骤；参数 terminal、row、col 按签名提供输入，返回值供调用方断言。示例：getCellItalic(..., ..., ...)。 */
function getCellItalic(terminal: VirtualTerminal, row: number, col: number): number {
	/** 常量 xterm 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const xterm = (terminal as unknown as { xterm: XtermTerminalType }).xterm;
	/** 常量 buffer 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const buffer = xterm.buffer.active;
	/** 常量 line 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const line = buffer.getLine(buffer.viewportY + row);
	assert.ok(line, `Missing buffer line at row ${row}`);
	/** 常量 cell 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const cell = line.getCell(col);
	assert.ok(cell, `Missing cell at row ${row} col ${col}`);
	return cell.isItalic();
}

/** getCellUnderline 执行当前测试辅助步骤；参数 terminal、row、col 按签名提供输入，返回值供调用方断言。示例：getCellUnderline(..., ..., ...)。 */
function getCellUnderline(terminal: VirtualTerminal, row: number, col: number): number {
	/** 常量 xterm 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const xterm = (terminal as unknown as { xterm: XtermTerminalType }).xterm;
	/** 常量 buffer 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const buffer = xterm.buffer.active;
	/** 常量 line 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const line = buffer.getLine(buffer.viewportY + row);
	assert.ok(line, `Missing buffer line at row ${row}`);
	/** 常量 cell 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const cell = line.getCell(col);
	assert.ok(cell, `Missing cell at row ${row} col ${col}`);
	return cell.isUnderline();
}

/** stripAnsi 执行当前测试辅助步骤；参数 line 按签名提供输入，返回值供调用方断言。示例：stripAnsi(...)。 */
function stripAnsi(line: string): string {
	return line.replace(/\x1b\[[0-9;]*m/g, "");
}

// 用例分组：集中验证“Markdown component”相关功能。
describe("Markdown component", () => {
	// 用例分组：集中验证“Lists”相关功能。
	describe("Lists", () => {
		// 测试场景：验证“should render simple nested list”对应的行为、结果与边界。
		it("should render simple nested list", () => {
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown(
				`- Item 1
  - Nested 1.1
  - Nested 1.2
- Item 2`,
				0,
				0,
				defaultMarkdownTheme,
			);

			/** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const lines = markdown.render(80);

			// Check that we have content
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			assert.ok(lines.length > 0);

			// Strip ANSI codes for checking
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));

			// Check structure
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			assert.ok(plainLines.some((line) => line.includes("- Item 1")));
			assert.ok(plainLines.some((line) => line.includes("    - Nested 1.1")));
			assert.ok(plainLines.some((line) => line.includes("    - Nested 1.2")));
			assert.ok(plainLines.some((line) => line.includes("- Item 2")));
		});

		// 测试场景：验证“should render deeply nested list”对应的行为、结果与边界。
		it("should render deeply nested list", () => {
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown(
				`- Level 1
  - Level 2
    - Level 3
      - Level 4`,
				0,
				0,
				defaultMarkdownTheme,
			);

			/** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const lines = markdown.render(80);
			/** 常量 plainLines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));

			// Check proper indentation
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			assert.ok(plainLines.some((line) => line.includes("- Level 1")));
			assert.ok(plainLines.some((line) => line.includes("    - Level 2")));
			assert.ok(plainLines.some((line) => line.includes("        - Level 3")));
			assert.ok(plainLines.some((line) => line.includes("            - Level 4")));
		});

		// 测试场景：验证“should render ordered nested list”对应的行为、结果与边界。
		it("should render ordered nested list", () => {
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown(
				`1. First
   1. Nested first
   2. Nested second
2. Second`,
				0,
				0,
				defaultMarkdownTheme,
			);

			/** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const lines = markdown.render(80);
			/** 常量 plainLines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));

			assert.ok(plainLines.some((line) => line.includes("1. First")));
			assert.ok(plainLines.some((line) => line.includes("    1. Nested first")));
			assert.ok(plainLines.some((line) => line.includes("    2. Nested second")));
			assert.ok(plainLines.some((line) => line.includes("2. Second")));
		});

		// 测试场景：验证“should normalize ordered list markers by default”对应的行为、结果与边界。
		it("should normalize ordered list markers by default", () => {
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown("1. alpha\n1. beta\n1. gamma", 0, 0, defaultMarkdownTheme);

			/** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const lines = markdown.render(80).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, ["1. alpha", "2. beta", "3. gamma"]);
		});

		// 测试场景：验证“should preserve source list markers when configured”对应的行为、结果与边界。
		it("should preserve source list markers when configured", () => {
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown(
				"  4. forth\n  3. third\n\n10) ten\n7) seven\n\n+ plus\n* star\n- minus\n+",
				0,
				0,
				defaultMarkdownTheme,
				undefined,
				{
					preserveOrderedListMarkers: true,
				},
			);

			/** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const lines = markdown.render(80).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, [
				"4. forth",
				"3. third",
				"",
				"10) ten",
				"7) seven",
				"",
				"+ plus",
				"* star",
				"- minus",
				"+",
			]);
		});

		// 测试场景：验证“should render mixed ordered and unordered nested lists”对应的行为、结果与边界。
		it("should render mixed ordered and unordered nested lists", () => {
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown(
				`1. Ordered item
   - Unordered nested
   - Another nested
2. Second ordered
   - More nested`,
				0,
				0,
				defaultMarkdownTheme,
			);

			/** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const lines = markdown.render(80);
			/** 常量 plainLines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));

			assert.ok(plainLines.some((line) => line.includes("1. Ordered item")));
			assert.ok(plainLines.some((line) => line.includes("    - Unordered nested")));
			assert.ok(plainLines.some((line) => line.includes("2. Second ordered")));
		});

		// 测试场景：验证“should render blank lines between loose list items”对应的行为、结果与边界。
		it("should render blank lines between loose list items", () => {
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown(
				`1. Lorem ipsum dolor sit amet.

   Ut enim ad minim veniam.

2. Duis aute irure dolor.

   Excepteur sint occaecat cupidatat.

3. Beep boop`,
				0,
				0,
				defaultMarkdownTheme,
			);

			/** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const lines = markdown.render(80).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, [
				"1. Lorem ipsum dolor sit amet.",
				"",
				"   Ut enim ad minim veniam.",
				"",
				"2. Duis aute irure dolor.",
				"",
				"   Excepteur sint occaecat cupidatat.",
				"",
				"3. Beep boop",
			]);
		});

		// 测试场景：验证“should render task list markers”对应的行为、结果与边界。
		it("should render task list markers", () => {
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown("- [ ] beep\n- [x] boop", 0, 0, defaultMarkdownTheme);

			/** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const lines = markdown.render(80).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, ["- [ ] beep", "- [x] boop"]);
		});

		// 测试场景：验证“should maintain numbering when code blocks are not indented (LLM output)”对应的行为、结果与边界。
		it("should maintain numbering when code blocks are not indented (LLM output)", () => {
			// When code blocks aren't indented, marked parses each item as a separate list.
			// We use token.start to preserve the original numbering.
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const markdown = new Markdown(
				`1. First item

\`\`\`typescript
// code block
\`\`\`

2. Second item

\`\`\`typescript
// another code block
\`\`\`

3. Third item`,
				0,
				0,
				defaultMarkdownTheme,
			);

			/** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const lines = markdown.render(80);
			/** 常量 plainLines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trim());

			// Find all lines that start with a number and period
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const numberedLines = plainLines.filter((line) => /^\d+\./.test(line));

			// Should have 3 numbered items
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			assert.strictEqual(numberedLines.length, 3, `Expected 3 numbered items, got: ${numberedLines.join(", ")}`);

			// Check the actual numbers
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			assert.ok(numberedLines[0].startsWith("1."), `First item should be "1.", got: ${numberedLines[0]}`);
			assert.ok(numberedLines[1].startsWith("2."), `Second item should be "2.", got: ${numberedLines[1]}`);
			assert.ok(numberedLines[2].startsWith("3."), `Third item should be "3.", got: ${numberedLines[2]}`);
		});

		// 测试场景：验证“should indent wrapped unordered list lines”对应的行为、结果与边界。
		it("should indent wrapped unordered list lines", () => {
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown("- alpha beta gamma delta epsilon", 0, 0, defaultMarkdownTheme);

			/** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const lines = markdown.render(20).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, ["- alpha beta gamma", "  delta epsilon"]);
		});

		// 测试场景：验证“should indent wrapped ordered list lines”对应的行为、结果与边界。
		it("should indent wrapped ordered list lines", () => {
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown("1. alpha beta gamma delta epsilon", 0, 0, defaultMarkdownTheme);

			/** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const lines = markdown.render(20).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, ["1. alpha beta gamma", "   delta epsilon"]);
		});

		// 测试场景：验证“should indent wrapped ordered list lines with multi-digit markers”对应的行为、结果与边界。
		it("should indent wrapped ordered list lines with multi-digit markers", () => {
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown("10. alpha beta gamma delta epsilon", 0, 0, defaultMarkdownTheme);

			/** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const lines = markdown.render(21).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, ["10. alpha beta gamma", "    delta epsilon"]);
		});

		// 测试场景：验证“should indent wrapped nested list lines”对应的行为、结果与边界。
		it("should indent wrapped nested list lines", () => {
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown(`- parent\n  - alpha beta gamma delta epsilon`, 0, 0, defaultMarkdownTheme);

			/** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const lines = markdown.render(24).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, ["- parent", "    - alpha beta gamma", "      delta epsilon"]);
		});

		// 测试场景：验证“should indent wrapped nested list lines under ordered parents”对应的行为、结果与边界。
		it("should indent wrapped nested list lines under ordered parents", () => {
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown(`1. parent\n   - alpha beta gamma delta epsilon`, 0, 0, defaultMarkdownTheme);

			/** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const lines = markdown.render(24).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, ["1. parent", "    - alpha beta gamma", "      delta epsilon"]);
		});

		// 测试场景：验证“should render and wrap blockquotes inside list items”对应的行为、结果与边界。
		it("should render and wrap blockquotes inside list items", () => {
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown("- > alpha beta gamma delta epsilon zeta", 0, 0, defaultMarkdownTheme);

			/** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const lines = markdown.render(24).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, ["- │ alpha beta gamma", "  │ delta epsilon zeta"]);
		});

		// 测试场景：验证“should render and wrap code blocks inside list items”对应的行为、结果与边界。
		it("should render and wrap code blocks inside list items", () => {
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown(
				"- ```ts\n  alpha beta gamma delta epsilon zeta\n  ```",
				0,
				0,
				defaultMarkdownTheme,
			);

			/** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const lines = markdown.render(24).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, ["- ```ts", "    alpha beta gamma", "  delta epsilon zeta", "  ```"]);
		});
	});

	// 用例分组：集中验证“Tables”相关功能。
	describe("Tables", () => {
		// 测试场景：验证“should render simple table”对应的行为、结果与边界。
		it("should render simple table", () => {
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown(
				`| Name | Age |
| --- | --- |
| Alice | 30 |
| Bob | 25 |`,
				0,
				0,
				defaultMarkdownTheme,
			);

			/** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const lines = markdown.render(80);
			/** 常量 plainLines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));

			// Check table structure
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			assert.ok(plainLines.some((line) => line.includes("Name")));
			assert.ok(plainLines.some((line) => line.includes("Age")));
			assert.ok(plainLines.some((line) => line.includes("Alice")));
			assert.ok(plainLines.some((line) => line.includes("Bob")));
			// Check for table borders
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			assert.ok(plainLines.some((line) => line.includes("│")));
			assert.ok(plainLines.some((line) => line.includes("─")));
		});

		// 测试场景：验证“should render row dividers between data rows”对应的行为、结果与边界。
		it("should render row dividers between data rows", () => {
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown(
				`| Name | Age |
| --- | --- |
| Alice | 30 |
| Bob | 25 |`,
				0,
				0,
				defaultMarkdownTheme,
			);

			/** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const lines = markdown.render(80);
			/** 常量 plainLines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));
			/** 常量 dividerLines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const dividerLines = plainLines.filter((line) => line.includes("┼"));

			assert.strictEqual(dividerLines.length, 2, "Expected header + row divider");
		});

		// 测试场景：验证“should keep column width at least the longest word”对应的行为、结果与边界。
		it("should keep column width at least the longest word", () => {
			/** 常量 longestWord 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const longestWord = "superlongword";
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown(
				`| Column One | Column Two |
| --- | --- |
| ${longestWord} short | otherword |
| small | tiny |`,
				0,
				0,
				defaultMarkdownTheme,
			);

			/** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const lines = markdown.render(32);
			/** 常量 plainLines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));
			/** 常量 dataLine 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const dataLine = plainLines.find((line) => line.includes(longestWord));
			assert.ok(dataLine, "Expected data row containing longest word");

			/** 常量 segments 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const segments = dataLine.split("│").slice(1, -1);
			/** 常量 [firstSegment] 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const [firstSegment] = segments;
			assert.ok(firstSegment, "Expected first column segment");
			/** 常量 firstColumnWidth 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const firstColumnWidth = firstSegment.length - 2;

			assert.ok(
				firstColumnWidth >= longestWord.length,
				`Expected first column width >= ${longestWord.length}, got ${firstColumnWidth}`,
			);
		});

		// 测试场景：验证“should render table with alignment”对应的行为、结果与边界。
		it("should render table with alignment", () => {
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown(
				`| Left | Center | Right |
| :--- | :---: | ---: |
| A | B | C |
| Long text | Middle | End |`,
				0,
				0,
				defaultMarkdownTheme,
			);

			/** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const lines = markdown.render(80);
			/** 常量 plainLines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));

			// Check headers
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			assert.ok(plainLines.some((line) => line.includes("Left")));
			assert.ok(plainLines.some((line) => line.includes("Center")));
			assert.ok(plainLines.some((line) => line.includes("Right")));
			// Check content
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			assert.ok(plainLines.some((line) => line.includes("Long text")));
		});

		// 测试场景：验证“should handle tables with varying column widths”对应的行为、结果与边界。
		it("should handle tables with varying column widths", () => {
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown(
				`| Short | Very long column header |
| --- | --- |
| A | This is a much longer cell content |
| B | Short |`,
				0,
				0,
				defaultMarkdownTheme,
			);

			/** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const lines = markdown.render(80);

			// Should render without errors
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			assert.ok(lines.length > 0);

			/** 常量 plainLines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));
			assert.ok(plainLines.some((line) => line.includes("Very long column header")));
			assert.ok(plainLines.some((line) => line.includes("This is a much longer cell content")));
		});

		// 测试场景：验证“should wrap table cells when table exceeds available width”对应的行为、结果与边界。
		it("should wrap table cells when table exceeds available width", () => {
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown(
				`| Command | Description | Example |
| --- | --- | --- |
| npm install | Install all dependencies | npm install |
| npm run build | Build the project | npm run build |`,
				0,
				0,
				defaultMarkdownTheme,
			);

			// Render at narrow width that forces wrapping
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const lines = markdown.render(50);
			/** 常量 plainLines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

			// All lines should fit within width
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			for (const line of plainLines) {
				assert.ok(line.length <= 50, `Line exceeds width 50: "${line}" (length: ${line.length})`);
			}

			// Content should still be present (possibly wrapped across lines)
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const allText = plainLines.join(" ");
			assert.ok(allText.includes("Command"), "Should contain 'Command'");
			assert.ok(allText.includes("Description"), "Should contain 'Description'");
			assert.ok(allText.includes("npm install"), "Should contain 'npm install'");
			assert.ok(allText.includes("Install"), "Should contain 'Install'");
		});

		// 测试场景：验证“should wrap long cell content to multiple lines”对应的行为、结果与边界。
		it("should wrap long cell content to multiple lines", () => {
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown(
				`| Header |
| --- |
| This is a very long cell content that should wrap |`,
				0,
				0,
				defaultMarkdownTheme,
			);

			// Render at width that forces the cell to wrap
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const lines = markdown.render(25);
			/** 常量 plainLines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

			// Should have multiple data rows due to wrapping
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const dataRows = plainLines.filter((line) => line.startsWith("│") && !line.includes("─"));
			assert.ok(dataRows.length > 2, `Expected wrapped rows, got ${dataRows.length} rows`);

			// All content should be preserved (may be split across lines)
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const allText = plainLines.join(" ");
			assert.ok(allText.includes("very long"), "Should preserve 'very long'");
			assert.ok(allText.includes("cell content"), "Should preserve 'cell content'");
			assert.ok(allText.includes("should wrap"), "Should preserve 'should wrap'");
		});

		// 测试场景：验证“should wrap long unbroken tokens inside table cells (not only at line start)”对应的行为、结果与边界。
		it("should wrap long unbroken tokens inside table cells (not only at line start)", () => {
			// Pin to no-hyperlinks so width checks work on plain text without OSC 8 sequences.
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			setCapabilities({ images: null, trueColor: false, hyperlinks: false });
			/** 常量 url 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const url = "https://example.com/this/is/a/very/long/url/that/should/wrap";
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown(
				`| Value |
| --- |
| prefix ${url} |`,
				0,
				0,
				defaultMarkdownTheme,
			);

			/** 常量 width 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const width = 30;
			/** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const lines = markdown.render(width);
			resetCapabilitiesCache();
			/** 常量 plainLines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

			/** 循环变量 line 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const line of plainLines) {
				assert.ok(line.length <= width, `Line exceeds width ${width}: "${line}" (length: ${line.length})`);
			}

			// Borders should stay intact (exactly 2 vertical borders for a 1-col table)
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const tableLines = plainLines.filter((line) => line.startsWith("│"));
			assert.ok(tableLines.length > 0, "Expected table rows to render");
			/** 循环变量 line 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const line of tableLines) {
				/** 常量 borderCount 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const borderCount = line.split("│").length - 1;
				assert.strictEqual(borderCount, 2, `Expected 2 borders, got ${borderCount}: "${line}"`);
			}

			// Strip box drawing characters + whitespace so we can assert the URL is preserved
			// even if it was split across multiple wrapped lines.
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const extracted = plainLines.join("").replace(/[│├┤─\s]/g, "");
			assert.ok(extracted.includes("prefix"), "Should preserve 'prefix'");
			assert.ok(extracted.includes(url), "Should preserve URL");
		});

		// 测试场景：验证“should wrap styled inline code inside table cells without breaking borders”对应的行为、结果与边界。
		it("should wrap styled inline code inside table cells without breaking borders", () => {
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown(
				`| Code |
| --- |
| \`averyveryveryverylongidentifier\` |`,
				0,
				0,
				defaultMarkdownTheme,
			);

			/** 常量 width 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const width = 20;
			/** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const lines = markdown.render(width);
			/** 常量 joinedOutput 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const joinedOutput = lines.join("\n");
			assert.ok(joinedOutput.includes("\x1b[33m"), "Inline code should be styled (yellow)");

			/** 常量 plainLines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());
			/** 循环变量 line 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const line of plainLines) {
				assert.ok(line.length <= width, `Line exceeds width ${width}: "${line}" (length: ${line.length})`);
			}

			/** 常量 tableLines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tableLines = plainLines.filter((line) => line.startsWith("│"));
			/** 循环变量 line 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const line of tableLines) {
				/** 常量 borderCount 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const borderCount = line.split("│").length - 1;
				assert.strictEqual(borderCount, 2, `Expected 2 borders, got ${borderCount}: "${line}"`);
			}
		});

		// 测试场景：验证“should handle extremely narrow width gracefully”对应的行为、结果与边界。
		it("should handle extremely narrow width gracefully", () => {
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown(
				`| A | B | C |
| --- | --- | --- |
| 1 | 2 | 3 |`,
				0,
				0,
				defaultMarkdownTheme,
			);

			// Very narrow width
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const lines = markdown.render(15);
			/** 常量 plainLines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

			// Should not crash and should produce output
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			assert.ok(lines.length > 0, "Should produce output");

			// Lines should not exceed width
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			for (const line of plainLines) {
				assert.ok(line.length <= 15, `Line exceeds width 15: "${line}" (length: ${line.length})`);
			}
		});

		// 测试场景：验证“should render table correctly when it fits naturally”对应的行为、结果与边界。
		it("should render table correctly when it fits naturally", () => {
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown(
				`| A | B |
| --- | --- |
| 1 | 2 |`,
				0,
				0,
				defaultMarkdownTheme,
			);

			// Wide width where table fits naturally
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const lines = markdown.render(80);
			/** 常量 plainLines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

			// Should have proper table structure
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const headerLine = plainLines.find((line) => line.includes("A") && line.includes("B"));
			assert.ok(headerLine, "Should have header row");
			assert.ok(headerLine?.includes("│"), "Header should have borders");

			/** 常量 separatorLine 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const separatorLine = plainLines.find((line) => line.includes("├") && line.includes("┼"));
			assert.ok(separatorLine, "Should have separator row");

			/** 常量 dataLine 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const dataLine = plainLines.find((line) => line.includes("1") && line.includes("2"));
			assert.ok(dataLine, "Should have data row");
		});

		// 测试场景：验证“should respect paddingX when calculating table width”对应的行为、结果与边界。
		it("should respect paddingX when calculating table width", () => {
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown(
				`| Column One | Column Two |
| --- | --- |
| Data 1 | Data 2 |`,
				2, // paddingX = 2
				0,
				defaultMarkdownTheme,
			);

			// Width 40 with paddingX=2 means contentWidth=36
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const lines = markdown.render(40);
			/** 常量 plainLines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

			// All lines should respect width
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			for (const line of plainLines) {
				assert.ok(line.length <= 40, `Line exceeds width 40: "${line}" (length: ${line.length})`);
			}

			// Table rows should have left padding
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const tableRow = plainLines.find((line) => line.includes("│"));
			assert.ok(tableRow?.startsWith("  "), "Table should have left padding");
		});

		// 测试场景：验证“should not add a trailing blank line when table is the last rendered block”对应的行为、结果与边界。
		it("should not add a trailing blank line when table is the last rendered block", () => {
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown(
				`| Name |
| --- |
| Alice |`,
				0,
				0,
				defaultMarkdownTheme,
			);

			/** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const lines = markdown.render(80);
			/** 常量 plainLines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

			assert.notStrictEqual(
				plainLines.at(-1),
				"",
				`Expected table to end without a blank line: ${JSON.stringify(plainLines)}`,
			);
		});
	});

	// 用例分组：集中验证“Combined features”相关功能。
	describe("Combined features", () => {
		// 测试场景：验证“should render lists and tables together”对应的行为、结果与边界。
		it("should render lists and tables together", () => {
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown(
				`# Test Document

- Item 1
  - Nested item
- Item 2

| Col1 | Col2 |
| --- | --- |
| A | B |`,
				0,
				0,
				defaultMarkdownTheme,
			);

			/** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const lines = markdown.render(80);
			/** 常量 plainLines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));

			// Check heading
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			assert.ok(plainLines.some((line) => line.includes("Test Document")));
			// Check list
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			assert.ok(plainLines.some((line) => line.includes("- Item 1")));
			assert.ok(plainLines.some((line) => line.includes("    - Nested item")));
			// Check table
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			assert.ok(plainLines.some((line) => line.includes("Col1")));
			assert.ok(plainLines.some((line) => line.includes("│")));
		});
	});

	// 用例分组：集中验证“Backslash escapes”相关功能。
	describe("Backslash escapes", () => {
		// 测试场景：验证“should normalize escaped punctuation by default”对应的行为、结果与边界。
		it("should normalize escaped punctuation by default", () => {
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown(String.raw`"\"`, 0, 0, defaultMarkdownTheme);

			/** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const lines = markdown.render(80).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, [`""`]);
		});

		// 测试场景：验证“should preserve source backslash escapes when configured”对应的行为、结果与边界。
		it("should preserve source backslash escapes when configured", () => {
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown(String.raw`"\"`, 0, 0, defaultMarkdownTheme, undefined, {
				preserveBackslashEscapes: true,
			});

			/** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const lines = markdown.render(80).map((line) => stripAnsi(line).trimEnd());

			assert.deepStrictEqual(lines, [String.raw`"\"`]);
		});
	});

	// 用例分组：集中验证“Pre-styled text (thinking traces)”相关功能。
	describe("Pre-styled text (thinking traces)", () => {
		// 测试场景：验证“should preserve gray italic styling after inline code”对应的行为、结果与边界。
		it("should preserve gray italic styling after inline code", () => {
			// This replicates how thinking content is rendered in assistant-message.ts
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const markdown = new Markdown(
				"This is thinking with `inline code` and more text after",
				1,
				0,
				defaultMarkdownTheme,
				{
					color: (text) => chalk.gray(text),
					italic: true,
				},
			);

			/** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const lines = markdown.render(80);
			/** 常量 joinedOutput 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const joinedOutput = lines.join("\n");

			// Should contain the inline code block
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			assert.ok(joinedOutput.includes("inline code"));

			// The output should have ANSI codes for gray (90) and italic (3)
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			assert.ok(joinedOutput.includes("\x1b[90m"), "Should have gray color code");
			assert.ok(joinedOutput.includes("\x1b[3m"), "Should have italic code");

			// Verify that inline code is styled (theme uses yellow)
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const hasCodeColor = joinedOutput.includes("\x1b[33m");
			assert.ok(hasCodeColor, "Should style inline code");
		});

		// 测试场景：验证“should preserve gray italic styling after bold text”对应的行为、结果与边界。
		it("should preserve gray italic styling after bold text", () => {
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown(
				"This is thinking with **bold text** and more after",
				1,
				0,
				defaultMarkdownTheme,
				{
					color: (text) => chalk.gray(text),
					italic: true,
				},
			);

			/** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const lines = markdown.render(80);
			/** 常量 joinedOutput 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const joinedOutput = lines.join("\n");

			// Should contain bold text
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			assert.ok(joinedOutput.includes("bold text"));

			// The output should have ANSI codes for gray (90) and italic (3)
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			assert.ok(joinedOutput.includes("\x1b[90m"), "Should have gray color code");
			assert.ok(joinedOutput.includes("\x1b[3m"), "Should have italic code");

			// Should have bold codes (1 or 22 for bold on/off)
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			assert.ok(joinedOutput.includes("\x1b[1m"), "Should have bold code");
		});

		// 测试场景：验证“should not leak styles into following lines when rendered in TUI”对应的行为、结果与边界。
		it("should not leak styles into following lines when rendered in TUI", async () => {
			/** MarkdownWithInput 把 Markdown 输出与一行普通输入拼接，用于检查样式是否泄漏到下一行。 */
			class MarkdownWithInput implements Component {
				/** markdownLineCount 保存最近一次渲染产生的 Markdown 行数，取值为非负整数。 */
				public markdownLineCount = 0;
				/** markdown 是被包装的 Markdown 组件，仅在本夹具内部使用。 */
				private readonly markdown: Markdown;

				/** 初始化包装组件；参数 markdown 为待测 Markdown 实例。例如：new MarkdownWithInput(markdown)。 */
				constructor(markdown: Markdown) {
					this.markdown = markdown;
				}

				/** 渲染 Markdown 并追加 INPUT；参数 width 为终端宽度，返回完整行数组。例如：component.render(80)。 */
				render(width: number): string[] {
					/** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const lines = this.markdown.render(width);
					this.markdownLineCount = lines.length;
					return [...lines, "INPUT"];
				}

				/** 将失效通知转发给 Markdown；无参数和返回值。例如：component.invalidate()。 */
				invalidate(): void {
					this.markdown.invalidate();
				}
			}

			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown("This is thinking with `inline code`", 1, 0, defaultMarkdownTheme, {
				color: (text) => chalk.gray(text),
				italic: true,
			});

			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 6);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 component 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const component = new MarkdownWithInput(markdown);
			tui.addChild(component);
			tui.start();
			await terminal.waitForRender();

			assert.ok(component.markdownLineCount > 0);
			/** 常量 inputRow 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const inputRow = component.markdownLineCount;
			assert.strictEqual(getCellItalic(terminal, inputRow, 0), 0);
			tui.stop();
		});
	});

	// 用例分组：集中验证“Spacing after code blocks”相关功能。
	describe("Spacing after code blocks", () => {
		// 测试场景：验证“should have only one blank line between code block and following paragraph”对应的行为、结果与边界。
		it("should have only one blank line between code block and following paragraph", () => {
			/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const markdown = new Markdown(
				`hello world

\`\`\`js
const hello = "world";
\`\`\`

again, hello world`,
				0,
				0,
				defaultMarkdownTheme,
			);

			/** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const lines = markdown.render(80);
			/** 常量 plainLines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

			/** 常量 closingBackticksIndex 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const closingBackticksIndex = plainLines.indexOf("```");
			assert.ok(closingBackticksIndex !== -1, "Should have closing backticks");

			/** afterBackticks 是反引号结束位置之后的渲染文本片段；取值范围由本用例输入和相邻类型约束。 */
			const afterBackticks = plainLines.slice(closingBackticksIndex + 1);
			/** emptyLineCount 是目标片段中空白行的数量；取值范围由本用例输入和相邻类型约束。 */
			const emptyLineCount = afterBackticks.findIndex((line) => line !== "");

			assert.strictEqual(
				emptyLineCount,
				1,
				`Expected 1 empty line after code block, but found ${emptyLineCount}. Lines after backticks: ${JSON.stringify(afterBackticks.slice(0, 5))}`,
			);
		});

		it("should normalize paragraph and code block spacing to one blank line", () => {
			/** cases 是本用例依次验证的 Markdown 输入样例数组；取值范围由本用例输入和相邻类型约束。 */
			const cases = [
				`hello this is text
\`\`\`
code block
\`\`\`
more text`,
				`hello this is text

\`\`\`
code block
\`\`\`

more text`,
			];
			/** expectedLines 是每个输入样例预期占用的渲染行数；取值范围由本用例输入和相邻类型约束。 */
			const expectedLines = ["hello this is text", "", "```", "  code block", "```", "", "more text"];

			/** text 是当前 Markdown 边界输入样例；取值来自 cases，仅在本轮断言中使用。 */
			for (const text of cases) {
				/** markdown 是使用测试主题构造的 Markdown 渲染组件；取值范围由本用例输入和相邻类型约束。 */
				const markdown = new Markdown(text, 0, 0, defaultMarkdownTheme);
				/** lines 是组件在指定终端宽度下产生的带样式渲染行数组；取值范围由本用例输入和相邻类型约束。 */
				const lines = markdown.render(80);
				/** plainLines 是移除 ANSI 控制码后的可读渲染行数组；取值范围由本用例输入和相邻类型约束。 */
				const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

				assert.deepStrictEqual(
					plainLines,
					expectedLines,
					`Unexpected spacing for markdown: ${JSON.stringify(text)}`,
				);
			}
		});

		it("should not add a trailing blank line when code block is the last rendered block", () => {
			/** cases 是本用例依次验证的 Markdown 输入样例数组；取值范围由本用例输入和相邻类型约束。 */
			const cases = ["```js\nconst hello = 'world';\n```", "hello world\n\n```js\nconst hello = 'world';\n```"];

			/** text 是当前 Markdown 边界输入样例；取值来自 cases，仅在本轮断言中使用。 */
			for (const text of cases) {
				/** markdown 是使用测试主题构造的 Markdown 渲染组件；取值范围由本用例输入和相邻类型约束。 */
				const markdown = new Markdown(text, 0, 0, defaultMarkdownTheme);
				/** lines 是组件在指定终端宽度下产生的带样式渲染行数组；取值范围由本用例输入和相邻类型约束。 */
				const lines = markdown.render(80);
				/** plainLines 是移除 ANSI 控制码后的可读渲染行数组；取值范围由本用例输入和相邻类型约束。 */
				const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

				assert.notStrictEqual(
					plainLines.at(-1),
					"",
					`Expected code block to end without a blank line: ${JSON.stringify(plainLines)}`,
				);
			}
		});
	});

	describe("Spacing after dividers", () => {
		it("should have only one blank line between divider and following paragraph", () => {
			/** markdown 是使用测试主题构造的 Markdown 渲染组件；取值范围由本用例输入和相邻类型约束。 */
			const markdown = new Markdown(
				`hello world

---

again, hello world`,
				0,
				0,
				defaultMarkdownTheme,
			);

			/** lines 是组件在指定终端宽度下产生的带样式渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const lines = markdown.render(80);
			/** plainLines 是移除 ANSI 控制码后的可读渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

			/** dividerIndex 是分隔线所在渲染行的索引；取值范围由本用例输入和相邻类型约束。 */
			const dividerIndex = plainLines.findIndex((line) => line.includes("─"));
			assert.ok(dividerIndex !== -1, "Should have divider");

			/** afterDivider 是分隔线之后的渲染行切片；取值范围由本用例输入和相邻类型约束。 */
			const afterDivider = plainLines.slice(dividerIndex + 1);
			/** emptyLineCount 是目标片段中空白行的数量；取值范围由本用例输入和相邻类型约束。 */
			const emptyLineCount = afterDivider.findIndex((line) => line !== "");

			assert.strictEqual(
				emptyLineCount,
				1,
				`Expected 1 empty line after divider, but found ${emptyLineCount}. Lines after divider: ${JSON.stringify(afterDivider.slice(0, 5))}`,
			);
		});

		it("should not add a trailing blank line when divider is the last rendered block", () => {
			/** markdown 是使用测试主题构造的 Markdown 渲染组件；取值范围由本用例输入和相邻类型约束。 */
			const markdown = new Markdown("---", 0, 0, defaultMarkdownTheme);
			/** lines 是组件在指定终端宽度下产生的带样式渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const lines = markdown.render(80);
			/** plainLines 是移除 ANSI 控制码后的可读渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

			assert.notStrictEqual(
				plainLines.at(-1),
				"",
				`Expected divider to end without a blank line: ${JSON.stringify(plainLines)}`,
			);
		});
	});

	describe("Spacing after headings", () => {
		it("should have only one blank line between heading and following paragraph", () => {
			/** markdown 是使用测试主题构造的 Markdown 渲染组件；取值范围由本用例输入和相邻类型约束。 */
			const markdown = new Markdown(
				`# Hello

This is a paragraph`,
				0,
				0,
				defaultMarkdownTheme,
			);

			/** lines 是组件在指定终端宽度下产生的带样式渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const lines = markdown.render(80);
			/** plainLines 是移除 ANSI 控制码后的可读渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

			/** headingIndex 是标题所在渲染行的索引；取值范围由本用例输入和相邻类型约束。 */
			const headingIndex = plainLines.findIndex((line) => line.includes("Hello"));
			assert.ok(headingIndex !== -1, "Should have heading");

			/** afterHeading 是标题之后的渲染行切片；取值范围由本用例输入和相邻类型约束。 */
			const afterHeading = plainLines.slice(headingIndex + 1);
			/** emptyLineCount 是目标片段中空白行的数量；取值范围由本用例输入和相邻类型约束。 */
			const emptyLineCount = afterHeading.findIndex((line) => line !== "");

			assert.strictEqual(
				emptyLineCount,
				1,
				`Expected 1 empty line after heading, but found ${emptyLineCount}. Lines after heading: ${JSON.stringify(afterHeading.slice(0, 5))}`,
			);
		});

		it("should not add a trailing blank line when heading is the last rendered block", () => {
			/** markdown 是使用测试主题构造的 Markdown 渲染组件；取值范围由本用例输入和相邻类型约束。 */
			const markdown = new Markdown("# Hello", 0, 0, defaultMarkdownTheme);
			/** lines 是组件在指定终端宽度下产生的带样式渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const lines = markdown.render(80);
			/** plainLines 是移除 ANSI 控制码后的可读渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

			assert.notStrictEqual(
				plainLines.at(-1),
				"",
				`Expected heading to end without a blank line: ${JSON.stringify(plainLines)}`,
			);
		});
	});

	describe("Spacing after blockquotes", () => {
		it("should have only one blank line between blockquote and following paragraph", () => {
			/** markdown 是使用测试主题构造的 Markdown 渲染组件；取值范围由本用例输入和相邻类型约束。 */
			const markdown = new Markdown(
				`hello world

> This is a quote

again, hello world`,
				0,
				0,
				defaultMarkdownTheme,
			);

			/** lines 是组件在指定终端宽度下产生的带样式渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const lines = markdown.render(80);
			/** plainLines 是移除 ANSI 控制码后的可读渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

			/** quoteIndex 是引用块起始渲染行的索引；取值范围由本用例输入和相邻类型约束。 */
			const quoteIndex = plainLines.findIndex((line) => line.includes("This is a quote"));
			assert.ok(quoteIndex !== -1, "Should have blockquote");

			/** afterQuote 是引用块之后的渲染行切片；取值范围由本用例输入和相邻类型约束。 */
			const afterQuote = plainLines.slice(quoteIndex + 1);
			/** emptyLineCount 是目标片段中空白行的数量；取值范围由本用例输入和相邻类型约束。 */
			const emptyLineCount = afterQuote.findIndex((line) => line !== "");

			assert.strictEqual(
				emptyLineCount,
				1,
				`Expected 1 empty line after blockquote, but found ${emptyLineCount}. Lines after quote: ${JSON.stringify(afterQuote.slice(0, 5))}`,
			);
		});

		it("should not add a trailing blank line when blockquote is the last rendered block", () => {
			/** markdown 是使用测试主题构造的 Markdown 渲染组件；取值范围由本用例输入和相邻类型约束。 */
			const markdown = new Markdown("> This is a quote", 0, 0, defaultMarkdownTheme);
			/** lines 是组件在指定终端宽度下产生的带样式渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const lines = markdown.render(80);
			/** plainLines 是移除 ANSI 控制码后的可读渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

			assert.notStrictEqual(
				plainLines.at(-1),
				"",
				`Expected blockquote to end without a blank line: ${JSON.stringify(plainLines)}`,
			);
		});
	});

	describe("Blockquotes with multiline content", () => {
		it("should apply consistent styling to all lines in lazy continuation blockquote", () => {
			// Markdown "lazy continuation" - second line without > is still part of the quote
			/** markdown 是使用测试主题构造的 Markdown 渲染组件；取值范围由本用例输入和相邻类型约束。 */
			const markdown = new Markdown(
				`>Foo
bar`,
				0,
				0,
				defaultMarkdownTheme,
				{
					color: (text) => chalk.magenta(text), // This should NOT be applied to blockquotes
				},
			);

			/** lines 是组件在指定终端宽度下产生的带样式渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const lines = markdown.render(80);

			// Both lines should have the quote border
			/** plainLines 是移除 ANSI 控制码后的可读渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));
			/** quotedLines 是从输出中筛选出的引用内容行数组；取值范围由本用例输入和相邻类型约束。 */
			const quotedLines = plainLines.filter((line) => line.startsWith("│ "));
			assert.strictEqual(quotedLines.length, 2, `Expected 2 quoted lines, got: ${JSON.stringify(plainLines)}`);

			// Both lines should have italic (from theme.quote styling)
			/** fooLine 是包含 foo 文本的渲染行；取值范围由本用例输入和相邻类型约束。 */
			const fooLine = lines.find((line) => line.includes("Foo"));
			/** barLine 是包含 bar 文本的渲染行；取值范围由本用例输入和相邻类型约束。 */
			const barLine = lines.find((line) => line.includes("bar"));
			assert.ok(fooLine, "Should have Foo line");
			assert.ok(barLine, "Should have bar line");

			// Check that both have italic (\x1b[3m) - blockquotes use theme styling, not default message color
			assert.ok(fooLine?.includes("\x1b[3m"), `Foo line should have italic: ${fooLine}`);
			assert.ok(barLine?.includes("\x1b[3m"), `bar line should have italic: ${barLine}`);

			// Blockquotes should NOT have the default message color (magenta)
			assert.ok(!fooLine?.includes("\x1b[35m"), `Foo line should NOT have magenta color: ${fooLine}`);
			assert.ok(!barLine?.includes("\x1b[35m"), `bar line should NOT have magenta color: ${barLine}`);
		});

		it("should apply consistent styling to explicit multiline blockquote", () => {
			/** markdown 是使用测试主题构造的 Markdown 渲染组件；取值范围由本用例输入和相邻类型约束。 */
			const markdown = new Markdown(
				`>Foo
>bar`,
				0,
				0,
				defaultMarkdownTheme,
				{
					color: (text) => chalk.cyan(text), // This should NOT be applied to blockquotes
				},
			);

			/** lines 是组件在指定终端宽度下产生的带样式渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const lines = markdown.render(80);

			// Both lines should have the quote border
			/** plainLines 是移除 ANSI 控制码后的可读渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));
			/** quotedLines 是从输出中筛选出的引用内容行数组；取值范围由本用例输入和相邻类型约束。 */
			const quotedLines = plainLines.filter((line) => line.startsWith("│ "));
			assert.strictEqual(quotedLines.length, 2, `Expected 2 quoted lines, got: ${JSON.stringify(plainLines)}`);

			// Both lines should have italic (from theme.quote styling)
			/** fooLine 是包含 foo 文本的渲染行；取值范围由本用例输入和相邻类型约束。 */
			const fooLine = lines.find((line) => line.includes("Foo"));
			/** barLine 是包含 bar 文本的渲染行；取值范围由本用例输入和相邻类型约束。 */
			const barLine = lines.find((line) => line.includes("bar"));
			assert.ok(fooLine?.includes("\x1b[3m"), `Foo line should have italic: ${fooLine}`);
			assert.ok(barLine?.includes("\x1b[3m"), `bar line should have italic: ${barLine}`);

			// Blockquotes should NOT have the default message color (cyan)
			assert.ok(!fooLine?.includes("\x1b[36m"), `Foo line should NOT have cyan color: ${fooLine}`);
			assert.ok(!barLine?.includes("\x1b[36m"), `bar line should NOT have cyan color: ${barLine}`);
		});

		it("should render list content inside blockquotes", () => {
			/** markdown 是使用测试主题构造的 Markdown 渲染组件；取值范围由本用例输入和相邻类型约束。 */
			const markdown = new Markdown(
				`> 1. bla bla
> - nested bullet`,
				0,
				0,
				defaultMarkdownTheme,
			);

			/** lines 是组件在指定终端宽度下产生的带样式渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const lines = markdown.render(80);
			/** plainLines 是移除 ANSI 控制码后的可读渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));
			/** quotedLines 是从输出中筛选出的引用内容行数组；取值范围由本用例输入和相邻类型约束。 */
			const quotedLines = plainLines.filter((line) => line.startsWith("│ "));

			assert.ok(
				quotedLines.some((line) => line.includes("1. bla bla")),
				`Missing ordered list item: ${JSON.stringify(quotedLines)}`,
			);
			assert.ok(
				quotedLines.some((line) => line.includes("- nested bullet")),
				`Missing unordered list item: ${JSON.stringify(quotedLines)}`,
			);
		});

		it("should wrap long blockquote lines and add border to each wrapped line", () => {
			/** longText 是用于触发自动换行的长文本输入；取值范围由本用例输入和相邻类型约束。 */
			const longText = "This is a very long blockquote line that should wrap to multiple lines when rendered";
			/** markdown 是使用测试主题构造的 Markdown 渲染组件；取值范围由本用例输入和相邻类型约束。 */
			const markdown = new Markdown(`> ${longText}`, 0, 0, defaultMarkdownTheme);

			// Render at narrow width to force wrapping
			/** lines 是组件在指定终端宽度下产生的带样式渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const lines = markdown.render(30);
			/** plainLines 是移除 ANSI 控制码后的可读渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

			// Filter to non-empty lines (exclude trailing blank line after blockquote)
			/** contentLines 是去除装饰或空行后保留的正文行数组；取值范围由本用例输入和相邻类型约束。 */
			const contentLines = plainLines.filter((line) => line.length > 0);

			// Should have multiple lines due to wrapping
			assert.ok(contentLines.length > 1, `Expected multiple wrapped lines, got: ${JSON.stringify(contentLines)}`);

			// Every content line should start with the quote border
			/** line 是当前渲染文本行；循环逐行检查宽度或内容边界。 */
			for (const line of contentLines) {
				assert.ok(line.startsWith("│ "), `Wrapped line should have quote border: "${line}"`);
			}

			// All content should be preserved
			/** allText 是合并全部正文行得到的纯文本；取值范围由本用例输入和相邻类型约束。 */
			const allText = contentLines.join(" ");
			assert.ok(allText.includes("very long"), "Should preserve 'very long'");
			assert.ok(allText.includes("blockquote"), "Should preserve 'blockquote'");
			assert.ok(allText.includes("multiple"), "Should preserve 'multiple'");
		});

		it("should properly indent wrapped blockquote lines with styling", () => {
			/** markdown 是使用测试主题构造的 Markdown 渲染组件；取值范围由本用例输入和相邻类型约束。 */
			const markdown = new Markdown(
				"> This is styled text that is long enough to wrap",
				0,
				0,
				defaultMarkdownTheme,
				{
					color: (text) => chalk.yellow(text), // This should NOT be applied to blockquotes
					italic: true,
				},
			);

			/** lines 是组件在指定终端宽度下产生的带样式渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const lines = markdown.render(25);
			/** plainLines 是移除 ANSI 控制码后的可读渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());

			// Filter to non-empty lines
			/** contentLines 是去除装饰或空行后保留的正文行数组；取值范围由本用例输入和相邻类型约束。 */
			const contentLines = plainLines.filter((line) => line.length > 0);

			// All lines should have the quote border
			/** line 是当前渲染文本行；循环逐行检查宽度或内容边界。 */
			for (const line of contentLines) {
				assert.ok(line.startsWith("│ "), `Line should have quote border: "${line}"`);
			}

			// Check that italic is applied (from theme.quote)
			/** allOutput 是合并全部渲染行得到的输出文本；取值范围由本用例输入和相邻类型约束。 */
			const allOutput = lines.join("\n");
			assert.ok(allOutput.includes("\x1b[3m"), "Should have italic");

			// Blockquotes should NOT have the default message color (yellow)
			assert.ok(!allOutput.includes("\x1b[33m"), "Should NOT have yellow color from default style");
		});

		it("should render inline formatting inside blockquotes and reapply quote styling after", () => {
			/** markdown 是使用测试主题构造的 Markdown 渲染组件；取值范围由本用例输入和相邻类型约束。 */
			const markdown = new Markdown("> Quote with **bold** and `code`", 0, 0, defaultMarkdownTheme);

			/** lines 是组件在指定终端宽度下产生的带样式渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const lines = markdown.render(80);
			/** plainLines 是移除 ANSI 控制码后的可读渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));

			// Should have the quote border
			assert.ok(
				plainLines.some((line) => line.startsWith("│ ")),
				"Should have quote border",
			);

			// Content should be preserved
			/** allPlain 是移除 ANSI 后合并得到的完整纯文本；取值范围由本用例输入和相邻类型约束。 */
			const allPlain = plainLines.join(" ");
			assert.ok(allPlain.includes("Quote with"), "Should preserve 'Quote with'");
			assert.ok(allPlain.includes("bold"), "Should preserve 'bold'");
			assert.ok(allPlain.includes("code"), "Should preserve 'code'");

			/** allOutput 是合并全部渲染行得到的输出文本；取值范围由本用例输入和相邻类型约束。 */
			const allOutput = lines.join("\n");

			// Should have bold styling (\x1b[1m)
			assert.ok(allOutput.includes("\x1b[1m"), "Should have bold styling");

			// Should have code styling (yellow = \x1b[33m from defaultMarkdownTheme)
			assert.ok(allOutput.includes("\x1b[33m"), "Should have code styling (yellow)");

			// Should have italic from quote styling (\x1b[3m)
			assert.ok(allOutput.includes("\x1b[3m"), "Should have italic from quote styling");
		});
	});

	describe("Heading with inline code", () => {
		it("should preserve heading styling after inline code", () => {
			/** markdown 是使用测试主题构造的 Markdown 渲染组件；取值范围由本用例输入和相邻类型约束。 */
			const markdown = new Markdown("### Why `sourceInfo` should not be optional", 0, 0, defaultMarkdownTheme);

			/** lines 是组件在指定终端宽度下产生的带样式渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const lines = markdown.render(80);
			/** joinedOutput 是合并带样式渲染行得到的单一输出字符串；取值范围由本用例输入和相邻类型约束。 */
			const joinedOutput = lines.join("\n");

			// The heading theme is bold+cyan. After the yellow inline code, the heading
			// styling (bold+cyan) must be restored so subsequent text is styled correctly.
			// bold = \x1b[1m, cyan = \x1b[36m, yellow = \x1b[33m
			assert.ok(joinedOutput.includes("\x1b[33m"), "Should have yellow for inline code");

			// Find the position of "should not be optional" in the raw output.
			// It must be preceded by heading style codes (bold+cyan), not appear unstyled.
			/** afterCodeIndex 是代码块结束后目标文本的字符索引；取值范围由本用例输入和相邻类型约束。 */
			const afterCodeIndex = joinedOutput.indexOf("should not be optional");
			assert.ok(afterCodeIndex > 0, "Should contain text after inline code");

			// Look at the ANSI codes between the code span end and "should not be optional".
			// There should be bold (\x1b[1m) and cyan (\x1b[36m) re-applied.
			/** precedingChunk 是目标索引之前用于检查间距的输出片段；取值范围由本用例输入和相邻类型约束。 */
			const precedingChunk = joinedOutput.slice(Math.max(0, afterCodeIndex - 40), afterCodeIndex);
			assert.ok(
				precedingChunk.includes("\x1b[1m"),
				`Should re-apply bold before text after code: ${precedingChunk}`,
			);
			assert.ok(
				precedingChunk.includes("\x1b[36m"),
				`Should re-apply cyan before text after code: ${precedingChunk}`,
			);
		});

		it("should preserve heading styling after inline code for h1", () => {
			/** markdown 是使用测试主题构造的 Markdown 渲染组件；取值范围由本用例输入和相邻类型约束。 */
			const markdown = new Markdown("# Title with `code` inside", 0, 0, defaultMarkdownTheme);

			/** lines 是组件在指定终端宽度下产生的带样式渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const lines = markdown.render(80);
			/** joinedOutput 是合并带样式渲染行得到的单一输出字符串；取值范围由本用例输入和相邻类型约束。 */
			const joinedOutput = lines.join("\n");

			/** afterCodeIndex 是代码块结束后目标文本的字符索引；取值范围由本用例输入和相邻类型约束。 */
			const afterCodeIndex = joinedOutput.indexOf("inside");
			assert.ok(afterCodeIndex > 0, "Should contain text after inline code");

			/** precedingChunk 是目标索引之前用于检查间距的输出片段；取值范围由本用例输入和相邻类型约束。 */
			const precedingChunk = joinedOutput.slice(Math.max(0, afterCodeIndex - 40), afterCodeIndex);
			// H1 uses heading + bold + underline
			assert.ok(precedingChunk.includes("\x1b[1m"), `Should re-apply bold for h1: ${precedingChunk}`);
			assert.ok(precedingChunk.includes("\x1b[36m"), `Should re-apply cyan for h1: ${precedingChunk}`);
			assert.ok(precedingChunk.includes("\x1b[4m"), `Should re-apply underline for h1: ${precedingChunk}`);
		});

		it("should not leak h1 underline into padding when inline code is the last token", async () => {
			/** markdown 是使用测试主题构造的 Markdown 渲染组件；取值范围由本用例输入和相邻类型约束。 */
			const markdown = new Markdown("# Important distinction from `open()`", 0, 0, defaultMarkdownTheme);
			/** terminal 是记录光标写入和清屏行为的测试终端；取值范围由本用例输入和相邻类型约束。 */
			const terminal = new VirtualTerminal(80, 4);
			/** tui 是承载 Markdown 组件并驱动差异渲染的测试界面；取值范围由本用例输入和相邻类型约束。 */
			const tui = new TUI(terminal);
			tui.addChild(markdown);
			tui.start();
			await terminal.waitForRender();

			/** renderedLine 是终端最终保存的当前渲染行；取值范围由本用例输入和相邻类型约束。 */
			const renderedLine = markdown.render(80)[0];
			assert.ok(renderedLine, "Should render heading line");
			/** contentWidth 是去除边框后可供正文使用的终端列数；取值范围由本用例输入和相邻类型约束。 */
			const contentWidth = renderedLine.replace(/\x1b\[[0-9;]*m/g, "").trimEnd().length;
			assert.ok(contentWidth > 0, "Should have visible heading content");

			/** col 是当前终端列索引；从 0 递增到内容宽度减一。 */
			for (let col = contentWidth; col < 80; col++) {
				assert.strictEqual(getCellUnderline(terminal, 0, col), 0, `Expected no underline in padding at col ${col}`);
			}

			tui.stop();
		});

		it("should preserve heading styling after bold text", () => {
			/** markdown 是使用测试主题构造的 Markdown 渲染组件；取值范围由本用例输入和相邻类型约束。 */
			const markdown = new Markdown("## Heading with **bold** and more", 0, 0, defaultMarkdownTheme);

			/** lines 是组件在指定终端宽度下产生的带样式渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const lines = markdown.render(80);
			/** joinedOutput 是合并带样式渲染行得到的单一输出字符串；取值范围由本用例输入和相邻类型约束。 */
			const joinedOutput = lines.join("\n");

			/** afterBoldIndex 是粗体片段结束后目标文本的字符索引；取值范围由本用例输入和相邻类型约束。 */
			const afterBoldIndex = joinedOutput.indexOf("and more");
			assert.ok(afterBoldIndex > 0, "Should contain text after bold");

			/** precedingChunk 是目标索引之前用于检查间距的输出片段；取值范围由本用例输入和相邻类型约束。 */
			const precedingChunk = joinedOutput.slice(Math.max(0, afterBoldIndex - 40), afterBoldIndex);
			assert.ok(precedingChunk.includes("\x1b[1m"), `Should re-apply bold for h2: ${precedingChunk}`);
			assert.ok(precedingChunk.includes("\x1b[36m"), `Should re-apply cyan for h2: ${precedingChunk}`);
		});
	});

	describe("Strikethrough syntax", () => {
		it("should render ~~text~~ as strikethrough", () => {
			/** markdown 是使用测试主题构造的 Markdown 渲染组件；取值范围由本用例输入和相邻类型约束。 */
			const markdown = new Markdown("Use ~~strikethrough~~ here", 0, 0, defaultMarkdownTheme);

			/** lines 是组件在指定终端宽度下产生的带样式渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const lines = markdown.render(80);
			/** joinedOutput 是合并带样式渲染行得到的单一输出字符串；取值范围由本用例输入和相邻类型约束。 */
			const joinedOutput = lines.join("\n");
			/** joinedPlain 是合并纯文本渲染行得到的单一字符串；取值范围由本用例输入和相邻类型约束。 */
			const joinedPlain = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "")).join(" ");

			assert.ok(joinedOutput.includes("\x1b[9m"), "Should apply strikethrough styling");
			assert.ok(joinedPlain.includes("strikethrough"), "Should include struck text content");
			assert.ok(!joinedPlain.includes("~~strikethrough~~"), "Should not render delimiters as text");
		});

		it("should keep ~text~ as plain text", () => {
			/** markdown 是使用测试主题构造的 Markdown 渲染组件；取值范围由本用例输入和相邻类型约束。 */
			const markdown = new Markdown("Use ~strikethrough~ literally", 0, 0, defaultMarkdownTheme);

			/** lines 是组件在指定终端宽度下产生的带样式渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const lines = markdown.render(80);
			/** joinedOutput 是合并带样式渲染行得到的单一输出字符串；取值范围由本用例输入和相邻类型约束。 */
			const joinedOutput = lines.join("\n");
			/** joinedPlain 是合并纯文本渲染行得到的单一字符串；取值范围由本用例输入和相邻类型约束。 */
			const joinedPlain = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, "")).join(" ");

			assert.ok(joinedPlain.includes("~strikethrough~"), "Single-tilde delimiters should remain visible");
			assert.ok(!joinedOutput.includes("\x1b[9m"), "Single-tilde text should not use strikethrough styling");
		});
	});

	describe("Links", () => {
		afterEach(() => {
			resetCapabilitiesCache();
		});

		it("should not duplicate URL for autolinked emails", () => {
			// Hyperlinks capability does not affect the mailto: display check.
			setCapabilities({ images: null, trueColor: false, hyperlinks: false });
			/** markdown 是使用测试主题构造的 Markdown 渲染组件；取值范围由本用例输入和相邻类型约束。 */
			const markdown = new Markdown("Contact user@example.com for help", 0, 0, defaultMarkdownTheme);

			/** lines 是组件在指定终端宽度下产生的带样式渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const lines = markdown.render(80);
			/** plainLines 是移除 ANSI 控制码后的可读渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));
			/** joinedPlain 是合并纯文本渲染行得到的单一字符串；取值范围由本用例输入和相邻类型约束。 */
			const joinedPlain = plainLines.join(" ");

			// Should contain the email once, not duplicated with mailto:
			assert.ok(joinedPlain.includes("user@example.com"), "Should contain email");
			assert.ok(!joinedPlain.includes("mailto:"), "Should not show mailto: prefix for autolinked emails");
		});

		it("should not duplicate URL for bare URLs", () => {
			setCapabilities({ images: null, trueColor: false, hyperlinks: false });
			/** markdown 是使用测试主题构造的 Markdown 渲染组件；取值范围由本用例输入和相邻类型约束。 */
			const markdown = new Markdown("Visit https://example.com for more", 0, 0, defaultMarkdownTheme);

			/** lines 是组件在指定终端宽度下产生的带样式渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const lines = markdown.render(80);
			/** plainLines 是移除 ANSI 控制码后的可读渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));
			/** joinedPlain 是合并纯文本渲染行得到的单一字符串；取值范围由本用例输入和相邻类型约束。 */
			const joinedPlain = plainLines.join(" ");

			// URL should appear only once
			/** urlCount 是输出文本中目标 URL 的出现次数；取值范围由本用例输入和相邻类型约束。 */
			const urlCount = (joinedPlain.match(/https:\/\/example\.com/g) || []).length;
			assert.strictEqual(urlCount, 1, "URL should appear exactly once");
		});

		it("should show URL in parentheses when hyperlinks are not supported", () => {
			setCapabilities({ images: null, trueColor: false, hyperlinks: false });
			/** markdown 是使用测试主题构造的 Markdown 渲染组件；取值范围由本用例输入和相邻类型约束。 */
			const markdown = new Markdown("[click here](https://example.com)", 0, 0, defaultMarkdownTheme);

			/** lines 是组件在指定终端宽度下产生的带样式渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const lines = markdown.render(80);
			/** plainLines 是移除 ANSI 控制码后的可读渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));
			/** joinedPlain 是合并纯文本渲染行得到的单一字符串；取值范围由本用例输入和相邻类型约束。 */
			const joinedPlain = plainLines.join(" ");

			assert.ok(joinedPlain.includes("click here"), "Should contain link text");
			assert.ok(joinedPlain.includes("(https://example.com)"), "Should show URL in parentheses");
		});

		it("should show mailto URL in parentheses when hyperlinks are not supported", () => {
			setCapabilities({ images: null, trueColor: false, hyperlinks: false });
			/** markdown 是使用测试主题构造的 Markdown 渲染组件；取值范围由本用例输入和相邻类型约束。 */
			const markdown = new Markdown("[Email me](mailto:test@example.com)", 0, 0, defaultMarkdownTheme);

			/** lines 是组件在指定终端宽度下产生的带样式渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const lines = markdown.render(80);
			/** plainLines 是移除 ANSI 控制码后的可读渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));
			/** joinedPlain 是合并纯文本渲染行得到的单一字符串；取值范围由本用例输入和相邻类型约束。 */
			const joinedPlain = plainLines.join(" ");

			assert.ok(joinedPlain.includes("Email me"), "Should contain link text");
			assert.ok(joinedPlain.includes("(mailto:test@example.com)"), "Should show mailto URL in parentheses");
		});

		it("should emit OSC 8 hyperlink sequence when terminal supports hyperlinks", () => {
			setCapabilities({ images: null, trueColor: false, hyperlinks: true });
			/** markdown 是使用测试主题构造的 Markdown 渲染组件；取值范围由本用例输入和相邻类型约束。 */
			const markdown = new Markdown("[click here](https://example.com)", 0, 0, defaultMarkdownTheme);

			/** lines 是组件在指定终端宽度下产生的带样式渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const lines = markdown.render(80);
			/** joined 是合并全部渲染行得到的单一字符串；取值范围由本用例输入和相邻类型约束。 */
			const joined = lines.join("");

			// OSC 8 open: ESC ] 8 ; ; <url> ESC \
			assert.ok(joined.includes("\x1b]8;;https://example.com\x1b\\"), "Should contain OSC 8 open sequence");
			// OSC 8 close: ESC ] 8 ; ; ESC \
			assert.ok(joined.includes("\x1b]8;;\x1b\\"), "Should contain OSC 8 close sequence");
			// Visible text is present
			/** plainLines 是移除 ANSI 控制码后的可读渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const plainLines = lines.map((line) => line.replace(/\x1b[^a-zA-Z]*[a-zA-Z]|\x1b\].*?\x1b\\/g, ""));
			assert.ok(plainLines.join("").includes("click here"), "Should contain link text");
			// URL is NOT printed inline as plain text
			/** rawPlain 是保留原始空白结构但移除 ANSI 的输出文本；取值范围由本用例输入和相邻类型约束。 */
			const rawPlain = lines.map((line) =>
				line.replace(/\x1b\]8;;[^\x1b]*\x1b\\/g, "").replace(/\x1b\[[0-9;]*m/g, ""),
			);
			assert.ok(!rawPlain.join("").includes("(https://example.com)"), "URL should not appear inline in parentheses");
		});

		it("should use OSC 8 for mailto links when terminal supports hyperlinks", () => {
			setCapabilities({ images: null, trueColor: false, hyperlinks: true });
			/** markdown 是使用测试主题构造的 Markdown 渲染组件；取值范围由本用例输入和相邻类型约束。 */
			const markdown = new Markdown("[Email me](mailto:test@example.com)", 0, 0, defaultMarkdownTheme);

			/** lines 是组件在指定终端宽度下产生的带样式渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const lines = markdown.render(80);
			/** joined 是合并全部渲染行得到的单一字符串；取值范围由本用例输入和相邻类型约束。 */
			const joined = lines.join("");

			assert.ok(
				joined.includes("\x1b]8;;mailto:test@example.com\x1b\\"),
				"Should contain OSC 8 open with mailto URL",
			);
			assert.ok(joined.includes("\x1b]8;;\x1b\\"), "Should contain OSC 8 close sequence");
		});

		it("should use OSC 8 for bare URLs when terminal supports hyperlinks", () => {
			setCapabilities({ images: null, trueColor: false, hyperlinks: true });
			/** markdown 是使用测试主题构造的 Markdown 渲染组件；取值范围由本用例输入和相邻类型约束。 */
			const markdown = new Markdown("Visit https://example.com for more", 0, 0, defaultMarkdownTheme);

			/** lines 是组件在指定终端宽度下产生的带样式渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const lines = markdown.render(80);
			/** joined 是合并全部渲染行得到的单一字符串；取值范围由本用例输入和相邻类型约束。 */
			const joined = lines.join("");

			assert.ok(joined.includes("\x1b]8;;https://example.com\x1b\\"), "Should contain OSC 8 hyperlink");
			// URL should not also appear as raw parenthetical text
			/** rawPlain 是保留原始空白结构但移除 ANSI 的输出文本；取值范围由本用例输入和相邻类型约束。 */
			const rawPlain = lines.map((line) =>
				line.replace(/\x1b\]8;;[^\x1b]*\x1b\\/g, "").replace(/\x1b\[[0-9;]*m/g, ""),
			);
			assert.ok(!rawPlain.join("").includes("(https://example.com)"), "URL should not appear twice");
		});
	});

	describe("HTML-like tags in text", () => {
		it("should render content with HTML-like tags as text", () => {
			// When the model emits something like <thinking>content</thinking> in regular text,
			// marked might treat it as HTML and hide the content
			/** markdown 是使用测试主题构造的 Markdown 渲染组件；取值范围由本用例输入和相邻类型约束。 */
			const markdown = new Markdown(
				"This is text with <thinking>hidden content</thinking> that should be visible",
				0,
				0,
				defaultMarkdownTheme,
			);

			/** lines 是组件在指定终端宽度下产生的带样式渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const lines = markdown.render(80);
			/** plainLines 是移除 ANSI 控制码后的可读渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));
			/** joinedPlain 是合并纯文本渲染行得到的单一字符串；取值范围由本用例输入和相邻类型约束。 */
			const joinedPlain = plainLines.join(" ");

			// The content inside the tags should be visible
			assert.ok(
				joinedPlain.includes("hidden content") || joinedPlain.includes("<thinking>"),
				"Should render HTML-like tags or their content as text, not hide them",
			);
		});

		it("should render HTML tags in code blocks correctly", () => {
			/** markdown 是使用测试主题构造的 Markdown 渲染组件；取值范围由本用例输入和相邻类型约束。 */
			const markdown = new Markdown("```html\n<div>Some HTML</div>\n```", 0, 0, defaultMarkdownTheme);

			/** lines 是组件在指定终端宽度下产生的带样式渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const lines = markdown.render(80);
			/** plainLines 是移除 ANSI 控制码后的可读渲染行数组；取值范围由本用例输入和相邻类型约束。 */
			const plainLines = lines.map((line) => line.replace(/\x1b\[[0-9;]*m/g, ""));
			/** joinedPlain 是合并纯文本渲染行得到的单一字符串；取值范围由本用例输入和相邻类型约束。 */
			const joinedPlain = plainLines.join("\n");

			// HTML in code blocks should be visible
			assert.ok(
				joinedPlain.includes("<div>") && joinedPlain.includes("</div>"),
				"Should render HTML in code blocks",
			);
		});
	});

	describe("Streaming code fences", () => {
		it("stabilizes partial closing fence rendering", () => {
			const cases = [
				{
					input: "```ts\nconst x = 1;\n``",
					expected: ["```ts", "  const x = 1;", "```"],
				},
				{
					input: "```md\nnot a closing fence:\n``\n```",
					expected: ["```md", "  not a closing fence:", "  ``", "```"],
				},
				{
					input: "```ts\n``",
					expected: ["```ts", "", "```"],
				},
				{
					input: "````\n```",
					expected: ["```", "", "```"],
				},
				{
					input: "~~~~~\n~~~~",
					expected: ["```", "", "```"],
				},
				{
					input: "```md\nnot a closing fence:\n``\n```\n\nafter",
					expected: ["```md", "  not a closing fence:", "  ``", "```", "", "after"],
				},
			];

			/** 循环变量 { 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const { input, expected } of cases) {
				/** 常量 markdown 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const markdown = new Markdown(input, 0, 0, defaultMarkdownTheme);
				/** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const lines = markdown.render(80).map((line) => stripAnsi(line).trimEnd());

				assert.deepStrictEqual(lines, expected);
			}

			/** 常量 partial 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const partial = new Markdown("```ts\nconst x = 1;\n``", 0, 0, defaultMarkdownTheme);
			/** complete 是由测试控制的异步完成回调；取值范围由本用例输入和相邻类型约束。 */
			const complete = new Markdown("```ts\nconst x = 1;\n```", 0, 0, defaultMarkdownTheme);

			assert.strictEqual(partial.render(80).length, complete.render(80).length);
		});
	});
});
