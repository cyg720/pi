/**
 * 文件职责：验证选择列表的多行描述规范化、主列宽约束、截断和描述对齐。
 * 技术维度：使用 Node 测试运行器、无样式测试主题和终端可见宽度计算。
 * 产品维度：让命令与描述列表在不同文本长度和自定义截断策略下保持整齐易读。
 * 逻辑维度：构造不同 items 与宽度选项，渲染后比较文本内容和描述起始列。
 * 关键边界：测试主题不加入 ANSI 样式；列位置按可见宽度而非字符串索引判断。
 * 新手阅读建议：先看 visibleIndexOf，再按默认、最小、最大和自定义截断四类场景阅读。
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { SelectList } from "../src/components/select-list.ts";
import { visibleWidth } from "../src/utils.ts";

// testTheme 的所有样式函数原样返回文本，便于断言布局。
const testTheme = {
	// text 是当前主题片段，各回调均不改变内容。
	selectedPrefix: (text: string) => text,
	selectedText: (text: string) => text,
	description: (text: string) => text,
	scrollInfo: (text: string) => text,
	noMatch: (text: string) => text,
};

/** 计算 text 在 line 中的可见列位置；找不到时断言失败。 */
const visibleIndexOf = (line: string, text: string): number => {
	// index 是普通字符串中的起始索引。
	const index = line.indexOf(text);
	assert.notEqual(index, -1);
	return visibleWidth(line.slice(0, index));
};

describe("SelectList", () => {
	// 验证多行描述被合并为单行；无参数，无返回值。
	it("normalizes multiline descriptions to single line", () => {
		// items 是含三行描述的单选项列表。
		const items = [
			{
				value: "test",
				label: "test",
				description: "Line one\nLine two\nLine three",
			},
		];

		// list 是最多显示五项的选择列表。
		const list = new SelectList(items, 5, testTheme);
		// rendered 是 100 列宽度下的渲染行。
		const rendered = list.render(100);

		assert.ok(rendered.length > 0);
		assert.ok(!rendered[0].includes("\n"));
		assert.ok(rendered[0].includes("Line one Line two Line three"));
	});

	// 验证主文本截断后两条描述仍对齐；无参数，无返回值。
	it("keeps descriptions aligned when the primary text is truncated", () => {
		// items 包含一个短标签和一个需截断的长标签。
		const items = [
			{ value: "short", label: "short", description: "short description" },
			{
				value: "very-long-command-name-that-needs-truncation",
				label: "very-long-command-name-that-needs-truncation",
				description: "long description",
			},
		];

		// list 和 rendered 是默认列宽策略的列表与输出。
		const list = new SelectList(items, 5, testTheme);
		const rendered = list.render(80);

		assert.equal(visibleIndexOf(rendered[0], "short description"), visibleIndexOf(rendered[1], "long description"));
	});

	// 验证最小主列宽把描述固定推到第 14 个字符串位置；无参数，无返回值。
	it("uses the configured minimum primary column width", () => {
		// items 包含两个很短的标签。
		const items = [
			{ value: "a", label: "a", description: "first" },
			{ value: "bb", label: "bb", description: "second" },
		];

		const list = new SelectList(items, 5, testTheme, {
			minPrimaryColumnWidth: 12,
			maxPrimaryColumnWidth: 20,
		});
		const rendered = list.render(80);

		assert.equal(rendered[0].indexOf("first"), 14);
		assert.equal(rendered[1].indexOf("second"), 14);
	});

	// 验证最大主列宽限制长标签并保持描述列；无参数，无返回值。
	it("uses the configured maximum primary column width", () => {
		// items 包含长短两个标签。
		const items = [
			{
				value: "very-long-command-name-that-needs-truncation",
				label: "very-long-command-name-that-needs-truncation",
				description: "first",
			},
			{ value: "short", label: "short", description: "second" },
		];

		const list = new SelectList(items, 5, testTheme, {
			minPrimaryColumnWidth: 12,
			maxPrimaryColumnWidth: 20,
		});
		const rendered = list.render(80);

		assert.equal(visibleIndexOf(rendered[0], "first"), 22);
		assert.equal(visibleIndexOf(rendered[1], "second"), 22);
	});

	// 验证自定义省略号截断仍保持描述对齐；无参数，无返回值。
	it("allows overriding primary truncation while preserving description alignment", () => {
		// items 包含需要自定义截断的长标签和短标签。
		const items = [
			{
				value: "very-long-command-name-that-needs-truncation",
				label: "very-long-command-name-that-needs-truncation",
				description: "first",
			},
			{ value: "short", label: "short", description: "second" },
		];

		const list = new SelectList(items, 5, testTheme, {
			minPrimaryColumnWidth: 12,
			maxPrimaryColumnWidth: 12,
			// text 是主标签，maxWidth 是可用列数；回调以省略号截断。
			truncatePrimary: ({ text, maxWidth }) => {
				if (text.length <= maxWidth) {
					return text;
				}

				return `${text.slice(0, Math.max(0, maxWidth - 1))}…`;
			},
		});
		const rendered = list.render(80);

		assert.ok(rendered[0].includes("…"));
		assert.equal(visibleIndexOf(rendered[0], "first"), visibleIndexOf(rendered[1], "second"));
	});
});
