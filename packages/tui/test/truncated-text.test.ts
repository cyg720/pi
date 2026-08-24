/**
 * 文件职责：验证 TruncatedText 组件在固定宽度下的水平/垂直填充、截断、ANSI 样式和换行处理。
 * 技术维度：使用 Node test/assert、Chalk 强制真彩色和 visibleWidth 计算不可见 ANSI 后的宽度。
 * 产品维度：保证终端卡片文本在不同内容和样式下保持整齐，不破坏颜色也不溢出布局。
 * 逻辑维度：九个用例覆盖普通填充、垂直空行、长文本、彩色文本、精确适配、空值和多行。
 * 关键边界：宽度按可见字符计算，ANSI 不占列；组件只显示第一行，截断时使用三个点。
 * 新手阅读建议：先理解 paddingX/paddingY，再比较 visibleWidth 与去 ANSI 后文本的不同断言。
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { Chalk } from "chalk";
import { TruncatedText } from "../src/components/truncated-text.ts";
import { visibleWidth } from "../src/utils.ts";

// Force full color in CI so ANSI assertions are deterministic
// 中文说明：CI 中强制启用真彩色，使 ANSI 转义序列断言保持确定。
// 测试专用 Chalk 实例，level=3 表示真彩色。
const chalk = new Chalk({ level: 3 });

describe("TruncatedText component", () => {
	it("pads output lines to exactly match width", () => {
		// 水平内边距为 1 的短文本组件。
		const text = new TruncatedText("Hello world", 1, 0);
		// 以 50 列渲染出的行数组。
		const lines = text.render(50);

		// Should have exactly one content line (no vertical padding)
		// 中文说明：未设置垂直内边距，因此只应有一行正文。
		assert.strictEqual(lines.length, 1);

		// Line should be exactly 50 visible characters
		// 中文说明：行尾空格应把可见宽度补足为 50。
		// 第一行的可见终端宽度。
		const visibleLen = visibleWidth(lines[0]);
		assert.strictEqual(visibleLen, 50);
	});

	it("pads output with vertical padding lines to width", () => {
		// 上下各两行垂直内边距的组件。
		const text = new TruncatedText("Hello", 0, 2);
		// 以 40 列渲染的五行结果。
		const lines = text.render(40);

		// Should have 2 padding lines + 1 content line + 2 padding lines = 5 total
		// 中文说明：上下各两行加一行正文，共五行。
		assert.strictEqual(lines.length, 5);

		// All lines should be exactly 40 characters
		// 中文说明：正文和空白填充行都必须占满 40 列。
		for (const line of lines) {
			assert.strictEqual(visibleWidth(line), 40);
		}
	});

	it("truncates long text and pads to width", () => {
		// 明显超过目标宽度的长文本。
		const longText = "This is a very long piece of text that will definitely exceed the available width";
		// 带水平内边距的长文本组件。
		const text = new TruncatedText(longText, 1, 0);
		// 以 30 列渲染后的单行结果。
		const lines = text.render(30);

		assert.strictEqual(lines.length, 1);

		// Should be exactly 30 characters
		// 中文说明：截断和填充后仍须严格占 30 个可见列。
		assert.strictEqual(visibleWidth(lines[0]), 30);

		// Should contain ellipsis
		// 中文说明：超长内容必须以省略号提示被截断。
		// 移除 ANSI 后用于检查省略号的纯文本。
		const stripped = lines[0].replace(/\x1b\[[0-9;]*m/g, "");
		assert.ok(stripped.includes("..."));
	});

	it("preserves ANSI codes in output and pads correctly", () => {
		// 红色 Hello 与蓝色 world 组成的 ANSI 文本。
		const styledText = `${chalk.red("Hello")} ${chalk.blue("world")}`;
		// 彩色短文本组件。
		const text = new TruncatedText(styledText, 1, 0);
		// 40 列渲染结果。
		const lines = text.render(40);

		assert.strictEqual(lines.length, 1);

		// Should be exactly 40 visible characters (ANSI codes don't count)
		// 中文说明：ANSI 控制码不计入 40 列可见宽度。
		assert.strictEqual(visibleWidth(lines[0]), 40);

		// Should preserve the color codes
		// 中文说明：渲染后仍应含颜色转义序列。
		assert.ok(lines[0].includes("\x1b["));
	});

	it("truncates styled text and adds reset code before ellipsis", () => {
		// 会被截断的红色长文本。
		const longStyledText = chalk.red("This is a very long red text that will be truncated");
		// 彩色长文本组件。
		const text = new TruncatedText(longStyledText, 1, 0);
		// 20 列渲染结果。
		const lines = text.render(20);

		assert.strictEqual(lines.length, 1);

		// Should be exactly 20 visible characters
		// 中文说明：颜色代码存在时仍需保持 20 列。
		assert.strictEqual(visibleWidth(lines[0]), 20);

		// Should contain reset code before ellipsis
		// 中文说明：省略号前先重置颜色，防止后续终端文本继续变红。
		assert.ok(lines[0].includes("\x1b[0m..."));
	});

	it("handles text that fits exactly", () => {
		// With paddingX=1, available width is 30-2=28
		// 中文说明：左右各一列内边距后，正文可用宽度为 28。
		// "Hello world" is 11 chars, fits comfortably
		// 中文说明：11 字符文本无需截断即可放入 28 列。
		// 恰好无需截断的短文本组件。
		const text = new TruncatedText("Hello world", 1, 0);
		// 30 列渲染结果。
		const lines = text.render(30);

		assert.strictEqual(lines.length, 1);
		assert.strictEqual(visibleWidth(lines[0]), 30);

		// Should NOT contain ellipsis
		// 中文说明：可完整容纳的文本不应出现省略号。
		// 去除 ANSI 后的纯文本。
		const stripped = lines[0].replace(/\x1b\[[0-9;]*m/g, "");
		assert.ok(!stripped.includes("..."));
	});

	it("handles empty text", () => {
		// 空正文组件，仍需输出占满宽度的一行。
		const text = new TruncatedText("", 1, 0);
		// 空正文的 30 列渲染结果。
		const lines = text.render(30);

		assert.strictEqual(lines.length, 1);
		assert.strictEqual(visibleWidth(lines[0]), 30);
	});

	it("stops at newline and only shows first line", () => {
		// 包含三行的输入文本。
		const multilineText = "First line\nSecond line\nThird line";
		// 多行输入组件。
		const text = new TruncatedText(multilineText, 1, 0);
		// 40 列渲染结果，只应含第一行。
		const lines = text.render(40);

		assert.strictEqual(lines.length, 1);
		assert.strictEqual(visibleWidth(lines[0]), 40);

		// Should only contain "First line"
		// 中文说明：组件约定忽略首个换行后的全部文本。
		// 去 ANSI 并去首尾空格后的首行文本。
		const stripped = lines[0].replace(/\x1b\[[0-9;]*m/g, "").trim();
		assert.ok(stripped.includes("First line"));
		assert.ok(!stripped.includes("Second line"));
		assert.ok(!stripped.includes("Third line"));
	});

	it("truncates first line even with newlines in text", () => {
		// 第一行本身超长且还包含第二行的输入。
		const longMultilineText = "This is a very long first line that needs truncation\nSecond line";
		// 多行长文本组件。
		const text = new TruncatedText(longMultilineText, 1, 0);
		// 25 列渲染结果。
		const lines = text.render(25);

		assert.strictEqual(lines.length, 1);
		assert.strictEqual(visibleWidth(lines[0]), 25);

		// Should contain ellipsis and not second line
		// 中文说明：第一行应截断并显示省略号，第二行始终不渲染。
		// 去除 ANSI 后的结果文本。
		const stripped = lines[0].replace(/\x1b\[[0-9;]*m/g, "");
		assert.ok(stripped.includes("..."));
		assert.ok(!stripped.includes("Second line"));
	});
});
