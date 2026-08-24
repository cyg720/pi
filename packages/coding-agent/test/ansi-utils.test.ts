/**
 * 文件职责：验证本地 stripAnsi 与参考实现兼容，并正确处理边界 ANSI 控制序列。
 * 技术维度：使用 Vitest、参考正则、组合输入生成和类型错误断言测试字符串清理函数。
 * 产品维度：确保工具输出去色后不残留控制字节或可见尾字节，避免日志和界面污染。
 * 逻辑维度：构建参考正则与输入集合，对比结果，再覆盖非字符串、RIS 和单字节序列。
 * 关键边界：参考实现聚焦 Chalk strip-ansi 兼容范围；未终止序列也必须按既定行为处理。
 * 新手阅读建议：先看 referenceStripAnsi，再看 getCompatibilityInputs 如何组合边界字符。
 */
import { describe, expect, it } from "vitest";
import { stripAnsi } from "../src/utils/ansi.ts";

/**
 * 构造与 Chalk strip-ansi 行为对齐的参考 ANSI 正则。
 * 参数：无。
 * 返回值：全局匹配 OSC 和 CSI 序列的 RegExp。
 * 使用示例：`const referenceRegex = referenceAnsiRegex()`。
 */
function referenceAnsiRegex(): RegExp {
	// ST 匹配三种字符串终止形式。
	const ST = "(?:\\u0007|\\u001B\\u005C|\\u009C)";
	// osc 匹配从 OSC 开始到字符串终止符的任意内容。
	const osc = `(?:\\u001B\\][\\s\\S]*?${ST})`;
	// csi 匹配常见控制序列引入器和参数字节范围。
	const csi = "[\\u001B\\u009B][[\\]()#;?]*(?:\\d{1,4}(?:[;:]\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]";
	return new RegExp(`${osc}|${csi}`, "g");
}

// referenceRegex 是供所有参考清理调用复用的预编译正则。
const referenceRegex = referenceAnsiRegex();

/**
 * 使用参考正则移除 ANSI 序列。
 * 参数：value 为待处理字符串。
 * 返回值：不含参考 ANSI 序列的文本。
 * 使用示例：`referenceStripAnsi("\\x1b[31mred")`。
 */
function referenceStripAnsi(value: string): string {
	if (!value.includes("\u001B") && !value.includes("\u009B")) {
		return value;
	}
	return value.replace(referenceRegex, "");
}

/**
 * 生成固定和组合的 ANSI 兼容性输入集合。
 * 参数：无。
 * 返回值：覆盖普通文本、控制序列和边界字节的字符串数组。
 * 使用示例：`for (const input of getCompatibilityInputs())`。
 */
function getCompatibilityInputs(): string[] {
	// inputs 先保存人工选择的常见与未终止序列样例。
	const inputs = [
		"plain",
		"a\x1b[31mred\x1b[0mz",
		"a\x1b]8;;https://example.com\x07link\x1b]8;;\x07z",
		"a\x1b]unterminated",
		"a\x1b]funterminated",
		"a\x1bPabc\x1b\\z",
		"a\x1b^abc\x07z",
		"a\x1b_abc\x9cz",
		"a\x90abc\x9cz",
		"a\x9dabc\x9cz",
		"a\x9b31mred",
		"a\x1b(0x",
		"a\x1b*0x",
		"a\x1b+c",
		"a\x1b/0x",
		"a\x1bcok",
		"a\x1b\\ok",
	];
	// chars 是与 ESC 和 CSI 组合生成额外边界输入的字符集合。
	const chars = [
		"a",
		"f",
		"0",
		"1",
		";",
		":",
		"[",
		"]",
		"(",
		")",
		"#",
		"?",
		"m",
		"P",
		"_",
		"\\",
		"\x07",
		"\x1b",
		"\x9b",
		"\x9c",
		"\x90",
		"\x9d",
	];

	// char 是当前与 ESC/CSI 前缀组合的测试字符。
	for (const char of chars) {
		inputs.push(`x\x1b${char}y`);
		inputs.push(`x\x9b${char}y`);
		// index 每隔三个字符取一个后缀，控制组合规模同时覆盖不同字节类型。
		for (let index = 0; index < chars.length; index += 3) {
			inputs.push(`x\x1b${char}${chars[index]}y`);
		}
	}

	return inputs;
}

describe("stripAnsi", () => {
	// 验证生成的所有输入都与参考清理结果一致；无参数，无返回值。
	it("matches chalk strip-ansi for generated compatibility inputs", () => {
		// input 是当前待比较的兼容性样例。
		for (const input of getCompatibilityInputs()) {
			expect(stripAnsi(input)).toBe(referenceStripAnsi(input));
		}
	});

	// 验证非字符串输入抛出与 Chalk 相同类型和消息；无参数，无返回值。
	it("throws the same TypeError as chalk strip-ansi for non-string values", () => {
		// stripAnsiUnknown 放宽参数类型，仅用于传入非法值测试运行时校验。
		const stripAnsiUnknown = stripAnsi as (value: unknown) => string;

		// value 是当前非法输入样例。
		for (const value of [undefined, null, 123, {}, Object("x")]) {
			// message 是参考实现针对当前值类型给出的预期错误文本。
			const message = `Expected a \`string\`, got \`${typeof value}\``;
			expect(() => stripAnsiUnknown(value)).toThrow(TypeError);
			expect(() => stripAnsiUnknown(value)).toThrow(message);
		}
	});

	// 验证 RIS 重置序列的最终字节不会泄漏到输出；无参数，无返回值。
	it("strips RIS without leaking the final byte", () => {
		expect(stripAnsi("\x1bcdone")).toBe("done");
	});

	// 验证两段单字节 ESC 序列范围都被完整移除；无参数，无返回值。
	it("strips single-byte ESC sequences without leaking final bytes", () => {
		// code 是从 g 到 m 的当前控制序列最终字节码。
		for (let code = "g".charCodeAt(0); code <= "m".charCodeAt(0); code++) {
			expect(stripAnsi(`\x1b${String.fromCharCode(code)}ok`)).toBe("ok");
		}
		// code 是从 r 到 t 的当前控制序列最终字节码。
		for (let code = "r".charCodeAt(0); code <= "t".charCodeAt(0); code++) {
			expect(stripAnsi(`\x1b${String.fromCharCode(code)}ok`)).toBe("ok");
		}
	});

	// 验证颜色和 OSC 超链接等工具常见序列同时被移除；无参数，无返回值。
	it("strips common ANSI sequences used in tool output", () => {
		// input 是混合颜色、重置、超链接和普通文本的工具输出。
		const input = "a\x1b[31mred\x1b[0m\x1b]8;;https://example.com\x07link\x1b]8;;\x07z";
		expect(stripAnsi(input)).toBe("aredlinkz");
	});
});
