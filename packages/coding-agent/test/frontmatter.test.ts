/**
 * 文件职责：验证 YAML frontmatter 的解析、换行规范化、错误定位和正文剥离规则。
 * 技术维度：使用 Vitest 和项目 frontmatter 辅助函数处理 YAML 与 CRLF/LF 文本。
 * 产品维度：保证技能、提示模板等资源元数据可靠读取，同时保留正确正文。
 * 逻辑维度：覆盖普通键、多行值、非法 YAML、缺失边界、空元数据和 strip 行为。
 * 关键边界：未终止 frontmatter 按普通正文处理；无 frontmatter 时 strip 不应擅自 trim。
 * 新手阅读建议：先阅读标准解析用例，再依次看异常、边界和 stripFrontmatter 测试组。
 */
import { describe, expect, it } from "vitest";
import { parseFrontmatter, stripFrontmatter } from "../src/utils/frontmatter.ts";

/** parseFrontmatter 解析测试组。 */
describe("parseFrontmatter", () => {
	/** 验证键、单双引号、连字符键和正文。 */
	it("parses keys, strips quotes, and returns body", () => {
		/** 含标准 YAML 头和正文的输入。 */
		const input = "---\nname: \"skill-name\"\ndescription: 'A desc'\nfoo-bar: value\n---\n\nBody text";
		/** 解析出的元数据与正文。 */
		const { frontmatter, body } = parseFrontmatter<Record<string, string>>(input);
		expect(frontmatter.name).toBe("skill-name");
		expect(frontmatter.description).toBe("A desc");
		expect(frontmatter["foo-bar"]).toBe("value");
		expect(body).toBe("Body text");
	});

	/** 验证 CRLF 输入统一转换为 LF。 */
	it("normalizes newlines and handles CRLF", () => {
		/** 使用 Windows 换行的输入。 */
		const input = "---\r\nname: test\r\n---\r\nLine one\r\nLine two";
		/** 解析并规范化后的正文。 */
		const { body } = parseFrontmatter<Record<string, string>>(input);
		expect(body).toBe("Line one\nLine two");
	});

	/** 验证非法 YAML 抛出包含行列的错误。 */
	it("throws on invalid YAML frontmatter", () => {
		/** 缺少数组右括号的非法 YAML。 */
		const input = "---\nfoo: [bar\n---\nBody";
		expect(() => parseFrontmatter<Record<string, string>>(input)).toThrow(/at line 1, column 10/);
	});

	/** 验证 YAML `|` 多行文本保留内部换行。 */
	it("parses | multiline yaml syntax", () => {
		/** 含多行 description 的输入。 */
		const input = "---\ndescription: |\n  Line one\n  Line two\n---\n\nBody";
		/** 多行元数据和正文。 */
		const { frontmatter, body } = parseFrontmatter<Record<string, string>>(input);
		expect(frontmatter.description).toBe("Line one\nLine two\n");
		expect(body).toBe("Body");
	});

	/** 验证无起始标记或缺少结束标记时保留原始正文。 */
	it("returns original content when frontmatter is missing or unterminated", () => {
		/** 完全不含 frontmatter 的正文。 */
		const noFrontmatter = "Just text\nsecond line";
		/** 只有起始标记、没有结束标记的文本。 */
		const missingEnd = "---\nname: test\nBody without terminator";
		/** 无 frontmatter 输入的解析结果。 */
		const resultNoFrontmatter = parseFrontmatter<Record<string, string>>(noFrontmatter);
		/** 未终止输入的解析结果。 */
		const resultMissingEnd = parseFrontmatter<Record<string, string>>(missingEnd);
		expect(resultNoFrontmatter.body).toBe("Just text\nsecond line");
		expect(resultMissingEnd.body).toBe(
			"---\nname: test\nBody without terminator".replace(/\r\n/g, "\n").replace(/\r/g, "\n"),
		);
	});

	/** 验证仅含 YAML 注释的元数据解析为空对象。 */
	it("returns empty object for empty or comment-only frontmatter", () => {
		/** 仅有 YAML 注释的 frontmatter。 */
		const input = "---\n# just a comment\n---\nBody";
		/** 解析出的空元数据对象。 */
		const { frontmatter } = parseFrontmatter(input);
		expect(frontmatter).toEqual({});
	});
});

/** stripFrontmatter 正文提取测试组。 */
describe("stripFrontmatter", () => {
	/** 验证存在元数据时删除头并 trim 正文。 */
	it("removes frontmatter and trims body", () => {
		/** 含元数据和周围空白的正文。 */
		const input = "---\nkey: value\n---\n\nBody\n";
		expect(stripFrontmatter(input)).toBe("Body");
	});

	/** 验证无 frontmatter 时原样返回正文空白。 */
	it("returns body when no frontmatter present", () => {
		/** 需要保持首尾空白的普通正文。 */
		const input = "\n  No frontmatter body  \n";
		expect(stripFrontmatter(input)).toBe("\n  No frontmatter body  \n");
	});
});
