/**
 * 文件职责：验证终端界面模糊匹配与过滤排序算法的匹配条件和评分优先级。
 * 技术维度：使用 Node 原生 test/assert，对字符顺序、大小写、连续性、词边界和令牌重排做单元测试。
 * 产品维度：保证用户搜索模型、命令或列表项时得到直观且稳定的结果排序。
 * 逻辑维度：第一组覆盖单条 fuzzyMatch 评分，第二组覆盖 fuzzyFilter 的过滤、排序与自定义文本提取。
 * 关键边界：评分越小表示匹配越优；查询字符必须按顺序出现，但字母数字令牌允许重排匹配。
 * 新手阅读建议：先理解 matches 与 score 的含义，再按用例顺序观察哪些特征会改善评分。
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { fuzzyFilter, fuzzyMatch } from "../src/fuzzy.ts";

describe("fuzzyMatch", () => {
	it("empty query matches everything with score 0", () => {
		// 空查询的匹配结果；约定为命中且评分为零。
		const result = fuzzyMatch("", "anything");
		assert.strictEqual(result.matches, true);
		assert.strictEqual(result.score, 0);
	});

	it("query longer than text does not match", () => {
		// 查询比候选文本长时的结果；无法按顺序覆盖全部查询字符。
		const result = fuzzyMatch("longquery", "short");
		assert.strictEqual(result.matches, false);
	});

	it("exact match has good score", () => {
		// 完全相同字符串的匹配结果；连续匹配奖励使评分小于零。
		const result = fuzzyMatch("test", "test");
		assert.strictEqual(result.matches, true);
		assert.ok(result.score < 0); // Should be negative due to consecutive bonuses
		// 中文说明：连续字符奖励会降低评分，因此精确匹配的分数应为负数。
	});

	it("characters must appear in order", () => {
		// 查询字符按顺序散布在文本中时的结果，应成功匹配。
		const matchInOrder = fuzzyMatch("abc", "aXbXc");
		assert.strictEqual(matchInOrder.matches, true);

		// 查询字符在候选中逆序出现时的结果，应匹配失败。
		const matchOutOfOrder = fuzzyMatch("abc", "cba");
		assert.strictEqual(matchOutOfOrder.matches, false);
	});

	it("case insensitive matching", () => {
		// 大写查询匹配小写文本的结果。
		const result = fuzzyMatch("ABC", "abc");
		assert.strictEqual(result.matches, true);

		// 小写查询匹配大写文本的结果。
		const result2 = fuzzyMatch("abc", "ABC");
		assert.strictEqual(result2.matches, true);
	});

	it("consecutive matches score better than scattered matches", () => {
		// 连续出现 foo 的结果，预期评分更优。
		const consecutive = fuzzyMatch("foo", "foobar");
		// 使用分隔符打散 foo 的结果，仍匹配但评分较差。
		const scattered = fuzzyMatch("foo", "f_o_o_bar");

		assert.strictEqual(consecutive.matches, true);
		assert.strictEqual(scattered.matches, true);
		assert.ok(consecutive.score < scattered.score);
	});

	it("word boundary matches score better", () => {
		// 查询字符落在单词边界处的匹配结果。
		const atBoundary = fuzzyMatch("fb", "foo-bar");
		// 相同查询字符位于普通单词内部的匹配结果。
		const notAtBoundary = fuzzyMatch("fb", "afbx");

		assert.strictEqual(atBoundary.matches, true);
		assert.strictEqual(notAtBoundary.matches, true);
		assert.ok(atBoundary.score < notAtBoundary.score);
	});

	it("matches swapped alpha numeric tokens", () => {
		// 字母与数字令牌顺序不同但内容等价的模型名称匹配结果。
		const result = fuzzyMatch("codex52", "gpt-5.2-codex");
		assert.strictEqual(result.matches, true);
	});
});

describe("fuzzyFilter", () => {
	it("empty query returns all items unchanged", () => {
		// 输入水果列表；空查询应保持原有内容和顺序。
		const items = ["apple", "banana", "cherry"];
		// 使用恒等文本提取器得到的过滤结果。
		const result = fuzzyFilter(items, "", (x: string) => x);
		assert.deepStrictEqual(result, items);
	});

	it("filters out non-matching items", () => {
		// 被过滤的候选字符串列表。
		const items = ["apple", "banana", "cherry"];
		// 查询 an 的过滤结果，只有 banana 应命中。
		const result = fuzzyFilter(items, "an", (x: string) => x);
		assert.ok(result.includes("banana"));
		assert.ok(!result.includes("apple"));
		assert.ok(!result.includes("cherry"));
	});

	it("sorts results by match quality", () => {
		// 三个均可匹配 app、但连续程度不同的候选项。
		const items = ["a_p_p", "app", "application"];
		// 按模糊匹配质量排序后的结果。
		const result = fuzzyFilter(items, "app", (x: string) => x);

		// "app" should be first (exact consecutive match at start)
		// 中文说明：app 在开头精确连续命中，因此必须排在第一位。
		assert.strictEqual(result[0], "app");
	});

	it("prioritizes exact matches over longer prefix matches", () => {
		// 一个精确项和一个具有相同前缀的较长项。
		const items = ["clone", "cl"];
		// 查询 cl 后的排序结果；精确项优先。
		const result = fuzzyFilter(items, "cl", (x: string) => x);

		assert.deepStrictEqual(result, ["cl", "clone"]);
	});

	it("works with custom getText function", () => {
		// 带名称与编号的对象列表，用于验证自定义文本提取函数。
		const items = [
			{ name: "foo", id: 1 },
			{ name: "bar", id: 2 },
			{ name: "foobar", id: 3 },
		];
		// 根据 item.name 进行匹配的过滤结果。
		const result = fuzzyFilter(items, "foo", (item: { name: string; id: number }) => item.name);

		assert.strictEqual(result.length, 2);
		assert.ok(result.map((r) => r.name).includes("foo"));
		assert.ok(result.map((r) => r.name).includes("foobar"));
	});

	it("matches slash-separated provider/model queries against reordered text", () => {
		// 模型候选项；提取文本的顺序与用户的 provider/model 查询相反。
		const item = { id: "gpt-5.5", provider: "openai-codex" };
		// 组合 id 和 provider 后执行令牌重排匹配的结果。
		const result = fuzzyFilter([item], "openai-codex/gpt-5.5", (model) => `${model.id} ${model.provider}`);

		assert.deepStrictEqual(result, [item]);
	});
});
