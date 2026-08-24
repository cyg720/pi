/**
 * Tests for keyboard input handling
 */
/**
 * 文件职责：验证终端键盘输入的解析、标准化和快捷键匹配，覆盖 Kitty、modifyOtherKeys 与传统转义序列。
 * 技术维度：使用 Vitest 驱动键盘协议测试，通过临时环境变量切换协议分支并检查按键解码结果。
 * 产品维度：保证不同终端和键盘布局下的快捷键行为一致，避免用户输入被误判或丢失。
 * 逻辑维度：先提供环境隔离辅助函数，再按协议分别验证 matchesKey、可打印字符解码与 parseKey。
 * 关键边界：转义序列和环境变量具有全局性；每个用例必须恢复环境，且断言依赖终端协议的精确字节。
 * 新手阅读建议：先理解 Key 与协议环境变量，再看普通字符解析，最后阅读 Kitty 修饰键和兼容序列用例。
 */

import assert from "node:assert";
import { describe, it } from "node:test";
import {
	decodeKittyPrintable,
	decodePrintableKey,
	Key,
	matchesKey,
	parseKey,
	setKittyProtocolActive,
} from "../src/keys.ts";

/** 在临时条件下执行 withEnv 对应步骤；参数 name、value、fn 按签名提供所需输入；返回值供调用方继续执行或断言。示例：withEnv(..., ..., ...)。 */
function withEnv(name: string, value: string | undefined, fn: () => void): void {
	/** 常量 previous 保存需要在结束时恢复的原始值；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const previous = process.env[name];
	if (value === undefined) delete process.env[name];
	else process.env[name] = value;
	try {
		fn();
	} finally {
		if (previous === undefined) delete process.env[name];
		else process.env[name] = previous;
	}
}

/** 在临时条件下执行 withEnvVars 对应步骤；参数 vars、string | undefined>、fn 按签名提供所需输入；返回值供调用方继续执行或断言。示例：withEnvVars(..., ..., ...)。 */
function withEnvVars(vars: Record<string, string | undefined>, fn: () => void): void {
	/** 常量 entries 保存“entries”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const entries = Object.entries(vars);
	/** 常量 run 保存“run”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const run = (index: number): void => {
		if (index >= entries.length) {
			fn();
			return;
		}
		/** 常量 [name, value] 保存“[name, value]”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const [name, value] = entries[index]!;
		withEnv(name, value, () => run(index + 1));
	};
	run(0);
}

// 用例分组：集中验证“matchesKey”相关功能。
describe("matchesKey", () => {
	// 用例分组：集中验证“Kitty protocol with alternate keys (non-Latin layouts)”相关功能。
	describe("Kitty protocol with alternate keys (non-Latin layouts)", () => {
		// Kitty protocol flag 4 (Report alternate keys) sends:
		// CSI codepoint:shifted:base ; modifier:event u
		// Where base is the key in standard PC-101 layout
		// 中文说明：上方英文注释描述“Kitty protocol flag 4 (Report alternate keys) sends: CS”相关前提、步骤或边界；下面代码按该说明执行。

		// 测试场景：验证“should match Ctrl+c when pressing Ctrl+С (Cyrillic) with base layout key”对应的行为、返回值与边界条件。
		it("should match Ctrl+c when pressing Ctrl+С (Cyrillic) with base layout key", () => {
			setKittyProtocolActive(true);
			// Cyrillic 'с' = codepoint 1089, Latin 'c' = codepoint 99
			// Format: CSI 1089::99;5u (codepoint::base;modifier with ctrl=4, +1=5)
			// 中文说明：上方英文注释描述“Cyrillic 'с' = codepoint 1089, Latin 'c' = codepoint 99”相关前提、步骤或边界；下面代码按该说明执行。
			const cyrillicCtrlC = "\x1b[1089::99;5u";
			assert.strictEqual(matchesKey(cyrillicCtrlC, "ctrl+c"), true);
			setKittyProtocolActive(false);
		});

		// 测试场景：验证“should match Ctrl+d when pressing Ctrl+В (Cyrillic) with base layout key”对应的行为、返回值与边界条件。
		it("should match Ctrl+d when pressing Ctrl+В (Cyrillic) with base layout key", () => {
			setKittyProtocolActive(true);
			// Cyrillic 'в' = codepoint 1074, Latin 'd' = codepoint 100
			// 中文说明：上方英文注释描述“Cyrillic 'в' = codepoint 1074, Latin 'd' = codepoint 10”相关前提、步骤或边界；下面代码按该说明执行。
			const cyrillicCtrlD = "\x1b[1074::100;5u";
			assert.strictEqual(matchesKey(cyrillicCtrlD, "ctrl+d"), true);
			setKittyProtocolActive(false);
		});

		// 测试场景：验证“should match Ctrl+z when pressing Ctrl+Я (Cyrillic) with base layout key”对应的行为、返回值与边界条件。
		it("should match Ctrl+z when pressing Ctrl+Я (Cyrillic) with base layout key", () => {
			setKittyProtocolActive(true);
			// Cyrillic 'я' = codepoint 1103, Latin 'z' = codepoint 122
			// 中文说明：上方英文注释描述“Cyrillic 'я' = codepoint 1103, Latin 'z' = codepoint 12”相关前提、步骤或边界；下面代码按该说明执行。
			const cyrillicCtrlZ = "\x1b[1103::122;5u";
			assert.strictEqual(matchesKey(cyrillicCtrlZ, "ctrl+z"), true);
			setKittyProtocolActive(false);
		});

		// 测试场景：验证“should match Ctrl+Shift+p with base layout key”对应的行为、返回值与边界条件。
		it("should match Ctrl+Shift+p with base layout key", () => {
			setKittyProtocolActive(true);
			// Cyrillic 'з' = codepoint 1079, Latin 'p' = codepoint 112
			// ctrl=4, shift=1, +1 = 6
			// 中文说明：上方英文注释描述“Cyrillic 'з' = codepoint 1079, Latin 'p' = codepoint 11”相关前提、步骤或边界；下面代码按该说明执行。
			const cyrillicCtrlShiftP = "\x1b[1079::112;6u";
			assert.strictEqual(matchesKey(cyrillicCtrlShiftP, "ctrl+shift+p"), true);
			setKittyProtocolActive(false);
		});

		// 测试场景：验证“should still match direct codepoint when no base layout key”对应的行为、返回值与边界条件。
		it("should still match direct codepoint when no base layout key", () => {
			setKittyProtocolActive(true);
			// Latin ctrl+c without base layout key (terminal doesn't support flag 4)
			// 中文说明：上方英文注释描述“Latin ctrl+c without base layout key (terminal doesn't ”相关前提、步骤或边界；下面代码按该说明执行。
			const latinCtrlC = "\x1b[99;5u";
			assert.strictEqual(matchesKey(latinCtrlC, "ctrl+c"), true);
			setKittyProtocolActive(false);
		});

		// 测试场景：验证“should match super-modified Kitty bindings, including combined modifiers”对应的行为、返回值与边界条件。
		it("should match super-modified Kitty bindings, including combined modifiers", () => {
			setKittyProtocolActive(true);
			assert.strictEqual(matchesKey("\x1b[107;9u", "super+k"), true);
			assert.strictEqual(matchesKey("\x1b[13;9u", "super+enter"), true);
			assert.strictEqual(matchesKey("\x1b[107;13u", Key.ctrlSuper("k")), true);
			assert.strictEqual(matchesKey("\x1b[107;13u", "ctrl+super+k"), true);
			assert.strictEqual(matchesKey("\x1b[107;14u", "ctrl+shift+super+k"), true);
			assert.strictEqual(matchesKey("\x1b[107;13u", "super+k"), false);
			assert.strictEqual(parseKey("\x1b[107;9u"), "super+k");
			assert.strictEqual(parseKey("\x1b[13;9u"), "super+enter");
			assert.strictEqual(parseKey("\x1b[107;13u"), "ctrl+super+k");
			assert.strictEqual(parseKey("\x1b[107;14u"), "shift+ctrl+super+k");
			setKittyProtocolActive(false);
		});

		// 测试场景：验证“should match digit bindings via Kitty CSI-u”对应的行为、返回值与边界条件。
		it("should match digit bindings via Kitty CSI-u", () => {
			setKittyProtocolActive(true);
			assert.strictEqual(matchesKey("\x1b[49u", "1"), true);
			assert.strictEqual(matchesKey("\x1b[49;5u", "ctrl+1"), true);
			assert.strictEqual(matchesKey("\x1b[49;5u", "ctrl+2"), false);
			assert.strictEqual(parseKey("\x1b[49u"), "1");
			assert.strictEqual(parseKey("\x1b[49;5u"), "ctrl+1");
			setKittyProtocolActive(false);
		});

		// 测试场景：验证“should normalize Kitty keypad functional keys to logical digits, symbols, and navigation”对应的行为、返回值与边界条件。
		it("should normalize Kitty keypad functional keys to logical digits, symbols, and navigation", () => {
			setKittyProtocolActive(true);
			assert.strictEqual(matchesKey("\x1b[57400u", "1"), true);
			assert.strictEqual(matchesKey("\x1b[57410u", "/"), true);
			assert.strictEqual(matchesKey("\x1b[57417u", "left"), true);
			assert.strictEqual(matchesKey("\x1b[57426u", "delete"), true);
			assert.strictEqual(parseKey("\x1b[57399u"), "0");
			assert.strictEqual(parseKey("\x1b[57409u"), ".");
			assert.strictEqual(parseKey("\x1b[57413u"), "+");
			assert.strictEqual(parseKey("\x1b[57416u"), ",");
			assert.strictEqual(parseKey("\x1b[57417u"), "left");
			assert.strictEqual(parseKey("\x1b[57418u"), "right");
			assert.strictEqual(parseKey("\x1b[57419u"), "up");
			assert.strictEqual(parseKey("\x1b[57420u"), "down");
			assert.strictEqual(parseKey("\x1b[57421u"), "pageUp");
			assert.strictEqual(parseKey("\x1b[57422u"), "pageDown");
			assert.strictEqual(parseKey("\x1b[57423u"), "home");
			assert.strictEqual(parseKey("\x1b[57424u"), "end");
			assert.strictEqual(parseKey("\x1b[57425u"), "insert");
			assert.strictEqual(parseKey("\x1b[57426u"), "delete");
			setKittyProtocolActive(false);
		});

		// 测试场景：验证“should handle shifted key in format”对应的行为、返回值与边界条件。
		it("should handle shifted key in format", () => {
			setKittyProtocolActive(true);
			// Format with shifted key: CSI codepoint:shifted:base;modifier u
			// Latin 'c' with shifted 'C' (67) and base 'c' (99)
			// 中文说明：上方英文注释描述“Format with shifted key: CSI codepoint:shifted:base;mod”相关前提、步骤或边界；下面代码按该说明执行。
			const shiftedKey = "\x1b[99:67:99;2u"; // shift modifier = 1, +1 = 2
			assert.strictEqual(matchesKey(shiftedKey, "shift+c"), true);
			setKittyProtocolActive(false);
		});

		// 测试场景：验证“should handle event type in format”对应的行为、返回值与边界条件。
		it("should handle event type in format", () => {
			setKittyProtocolActive(true);
			// Format with event type: CSI codepoint::base;modifier:event u
			// Cyrillic ctrl+c release event (event type 3)
			// 中文说明：上方英文注释描述“Format with event type: CSI codepoint::base;modifier:ev”相关前提、步骤或边界；下面代码按该说明执行。
			const releaseEvent = "\x1b[1089::99;5:3u";
			assert.strictEqual(matchesKey(releaseEvent, "ctrl+c"), true);
			setKittyProtocolActive(false);
		});

		// 测试场景：验证“should handle full format with shifted key, base key, and event type”对应的行为、返回值与边界条件。
		it("should handle full format with shifted key, base key, and event type", () => {
			setKittyProtocolActive(true);
			// Full format: CSI codepoint:shifted:base;modifier:event u
			// Cyrillic 'С' (shifted) with base 'c', Ctrl+Shift pressed, repeat event
			// Cyrillic 'с' = 1089, Cyrillic 'С' = 1057, Latin 'c' = 99
			// ctrl=4, shift=1, +1 = 6, repeat event = 2
			// 中文说明：上方英文注释描述“Full format: CSI codepoint:shifted:base;modifier:event ”相关前提、步骤或边界；下面代码按该说明执行。
			const fullFormat = "\x1b[1089:1057:99;6:2u";
			assert.strictEqual(matchesKey(fullFormat, "ctrl+shift+c"), true);
			setKittyProtocolActive(false);
		});

		// 测试场景：验证“should prefer codepoint for Latin letters even when base layout differs”对应的行为、返回值与边界条件。
		it("should prefer codepoint for Latin letters even when base layout differs", () => {
			setKittyProtocolActive(true);
			// Dvorak Ctrl+K reports codepoint 'k' (107) and base layout 'v' (118)
			// 中文说明：上方英文注释描述“Dvorak Ctrl+K reports codepoint 'k' (107) and base layo”相关前提、步骤或边界；下面代码按该说明执行。
			const dvorakCtrlK = "\x1b[107::118;5u";
			assert.strictEqual(matchesKey(dvorakCtrlK, "ctrl+k"), true);
			assert.strictEqual(matchesKey(dvorakCtrlK, "ctrl+v"), false);
			setKittyProtocolActive(false);
		});

		// 测试场景：验证“should prefer codepoint for symbol keys even when base layout differs”对应的行为、返回值与边界条件。
		it("should prefer codepoint for symbol keys even when base layout differs", () => {
			setKittyProtocolActive(true);
			// Dvorak Ctrl+/ reports codepoint '/' (47) and base layout '[' (91)
			// 中文说明：上方英文注释描述“Dvorak Ctrl+/ reports codepoint '/' (47) and base layou”相关前提、步骤或边界；下面代码按该说明执行。
			const dvorakCtrlSlash = "\x1b[47::91;5u";
			assert.strictEqual(matchesKey(dvorakCtrlSlash, "ctrl+/"), true);
			assert.strictEqual(matchesKey(dvorakCtrlSlash, "ctrl+["), false);
			setKittyProtocolActive(false);
		});

		// 测试场景：验证“should not match wrong key even with base layout”对应的行为、返回值与边界条件。
		it("should not match wrong key even with base layout", () => {
			setKittyProtocolActive(true);
			// Cyrillic ctrl+с with base 'c' should NOT match ctrl+d
			// 中文说明：上方英文注释描述“Cyrillic ctrl+с with base 'c' should NOT match ctrl+d”相关前提、步骤或边界；下面代码按该说明执行。
			const cyrillicCtrlC = "\x1b[1089::99;5u";
			assert.strictEqual(matchesKey(cyrillicCtrlC, "ctrl+d"), false);
			setKittyProtocolActive(false);
		});

		// 测试场景：验证“should not match wrong modifiers even with base layout”对应的行为、返回值与边界条件。
		it("should not match wrong modifiers even with base layout", () => {
			setKittyProtocolActive(true);
			// Cyrillic ctrl+с should NOT match ctrl+shift+c
			// 中文说明：上方英文注释描述“Cyrillic ctrl+с should NOT match ctrl+shift+c”相关前提、步骤或边界；下面代码按该说明执行。
			const cyrillicCtrlC = "\x1b[1089::99;5u";
			assert.strictEqual(matchesKey(cyrillicCtrlC, "ctrl+shift+c"), false);
			setKittyProtocolActive(false);
		});
	});

	// 用例分组：集中验证“modifyOtherKeys matching”相关功能。
	describe("modifyOtherKeys matching", () => {
		// 测试场景：验证“should match xterm modifyOtherKeys Ctrl+c”对应的行为、返回值与边界条件。
		it("should match xterm modifyOtherKeys Ctrl+c", () => {
			setKittyProtocolActive(false);
			assert.strictEqual(matchesKey("\x1b[27;5;99~", "ctrl+c"), true);
			assert.strictEqual(parseKey("\x1b[27;5;99~"), "ctrl+c");
		});

		// 测试场景：验证“should match xterm modifyOtherKeys Ctrl+d”对应的行为、返回值与边界条件。
		it("should match xterm modifyOtherKeys Ctrl+d", () => {
			setKittyProtocolActive(false);
			assert.strictEqual(matchesKey("\x1b[27;5;100~", "ctrl+d"), true);
			assert.strictEqual(parseKey("\x1b[27;5;100~"), "ctrl+d");
		});

		// 测试场景：验证“should match xterm modifyOtherKeys Ctrl+z”对应的行为、返回值与边界条件。
		it("should match xterm modifyOtherKeys Ctrl+z", () => {
			setKittyProtocolActive(false);
			assert.strictEqual(matchesKey("\x1b[27;5;122~", "ctrl+z"), true);
			assert.strictEqual(parseKey("\x1b[27;5;122~"), "ctrl+z");
		});

		// 测试场景：验证“should match xterm modifyOtherKeys Enter variants”对应的行为、返回值与边界条件。
		it("should match xterm modifyOtherKeys Enter variants", () => {
			setKittyProtocolActive(false);
			assert.strictEqual(matchesKey("\x1b[27;5;13~", "ctrl+enter"), true);
			assert.strictEqual(matchesKey("\x1b[27;2;13~", "shift+enter"), true);
			assert.strictEqual(matchesKey("\x1b[27;3;13~", "alt+enter"), true);
			assert.strictEqual(parseKey("\x1b[27;5;13~"), "ctrl+enter");
			assert.strictEqual(parseKey("\x1b[27;2;13~"), "shift+enter");
			assert.strictEqual(parseKey("\x1b[27;3;13~"), "alt+enter");
		});

		// 测试场景：验证“should match xterm modifyOtherKeys Tab variants”对应的行为、返回值与边界条件。
		it("should match xterm modifyOtherKeys Tab variants", () => {
			setKittyProtocolActive(false);
			assert.strictEqual(matchesKey("\x1b[27;2;9~", "shift+tab"), true);
			assert.strictEqual(matchesKey("\x1b[27;5;9~", "ctrl+tab"), true);
			assert.strictEqual(matchesKey("\x1b[27;3;9~", "alt+tab"), true);
			assert.strictEqual(parseKey("\x1b[27;2;9~"), "shift+tab");
			assert.strictEqual(parseKey("\x1b[27;5;9~"), "ctrl+tab");
			assert.strictEqual(parseKey("\x1b[27;3;9~"), "alt+tab");
		});

		// 测试场景：验证“should match xterm modifyOtherKeys Backspace variants”对应的行为、返回值与边界条件。
		it("should match xterm modifyOtherKeys Backspace variants", () => {
			setKittyProtocolActive(false);
			assert.strictEqual(matchesKey("\x1b[27;1;127~", "backspace"), true);
			assert.strictEqual(matchesKey("\x1b[27;5;127~", "ctrl+backspace"), true);
			assert.strictEqual(matchesKey("\x1b[27;3;127~", "alt+backspace"), true);
			assert.strictEqual(parseKey("\x1b[27;1;127~"), "backspace");
			assert.strictEqual(parseKey("\x1b[27;5;127~"), "ctrl+backspace");
			assert.strictEqual(parseKey("\x1b[27;3;127~"), "alt+backspace");
		});

		// 测试场景：验证“should match xterm modifyOtherKeys Escape”对应的行为、返回值与边界条件。
		it("should match xterm modifyOtherKeys Escape", () => {
			setKittyProtocolActive(false);
			assert.strictEqual(matchesKey("\x1b[27;1;27~", "escape"), true);
			assert.strictEqual(parseKey("\x1b[27;1;27~"), "escape");
		});

		// 测试场景：验证“should match xterm modifyOtherKeys Space variants”对应的行为、返回值与边界条件。
		it("should match xterm modifyOtherKeys Space variants", () => {
			setKittyProtocolActive(false);
			assert.strictEqual(matchesKey("\x1b[27;1;32~", "space"), true);
			assert.strictEqual(matchesKey("\x1b[27;5;32~", "ctrl+space"), true);
			assert.strictEqual(parseKey("\x1b[27;1;32~"), "space");
			assert.strictEqual(parseKey("\x1b[27;5;32~"), "ctrl+space");
		});

		// 测试场景：验证“should match xterm modifyOtherKeys symbol combos”对应的行为、返回值与边界条件。
		it("should match xterm modifyOtherKeys symbol combos", () => {
			setKittyProtocolActive(false);
			assert.strictEqual(matchesKey("\x1b[27;5;47~", "ctrl+/"), true);
			assert.strictEqual(parseKey("\x1b[27;5;47~"), "ctrl+/");
		});

		// 测试场景：验证“should match xterm modifyOtherKeys digit combos”对应的行为、返回值与边界条件。
		it("should match xterm modifyOtherKeys digit combos", () => {
			setKittyProtocolActive(false);
			assert.strictEqual(matchesKey("\x1b[27;5;49~", "ctrl+1"), true);
			assert.strictEqual(matchesKey("\x1b[27;2;49~", "shift+1"), true);
			assert.strictEqual(parseKey("\x1b[27;5;49~"), "ctrl+1");
			assert.strictEqual(parseKey("\x1b[27;2;49~"), "shift+1");
		});

		// 测试场景：验证“should match xterm modifyOtherKeys shifted uppercase letters”对应的行为、返回值与边界条件。
		it("should match xterm modifyOtherKeys shifted uppercase letters", () => {
			setKittyProtocolActive(false);
			assert.strictEqual(matchesKey("\x1b[27;2;69~", "shift+e"), true);
			assert.strictEqual(matchesKey("\x1b[27;6;69~", "ctrl+shift+e"), true);
			assert.strictEqual(parseKey("\x1b[27;2;69~"), "shift+e");
			assert.strictEqual(parseKey("\x1b[27;6;69~"), "shift+ctrl+e");
		});

		// 测试场景：验证“should match Ctrl+Alt+letter via CSI-u when kitty inactive”对应的行为、返回值与边界条件。
		it("should match Ctrl+Alt+letter via CSI-u when kitty inactive", () => {
			setKittyProtocolActive(false);
			assert.strictEqual(matchesKey("\x1b[104;7u", "ctrl+alt+h"), true);
			assert.strictEqual(parseKey("\x1b[104;7u"), "ctrl+alt+h");
		});

		// 测试场景：验证“should match Ctrl+Alt+letter via xterm modifyOtherKeys”对应的行为、返回值与边界条件。
		it("should match Ctrl+Alt+letter via xterm modifyOtherKeys", () => {
			setKittyProtocolActive(false);
			assert.strictEqual(matchesKey("\x1b[27;7;104~", "ctrl+alt+h"), true);
			assert.strictEqual(parseKey("\x1b[27;7;104~"), "ctrl+alt+h");
		});
	});

	// 用例分组：集中验证“Legacy key matching”相关功能。
	describe("Legacy key matching", () => {
		// 测试场景：验证“should match legacy Ctrl+c”对应的行为、返回值与边界条件。
		it("should match legacy Ctrl+c", () => {
			setKittyProtocolActive(false);
			// Ctrl+c sends ASCII 3 (ETX)
			// 中文说明：上方英文注释描述“Ctrl+c sends ASCII 3 (ETX)”相关前提、步骤或边界；下面代码按该说明执行。
			assert.strictEqual(matchesKey("\x03", "ctrl+c"), true);
		});

		// 测试场景：验证“should match legacy Ctrl+d”对应的行为、返回值与边界条件。
		it("should match legacy Ctrl+d", () => {
			setKittyProtocolActive(false);
			// Ctrl+d sends ASCII 4 (EOT)
			// 中文说明：上方英文注释描述“Ctrl+d sends ASCII 4 (EOT)”相关前提、步骤或边界；下面代码按该说明执行。
			assert.strictEqual(matchesKey("\x04", "ctrl+d"), true);
		});

		// 测试场景：验证“should match escape key”对应的行为、返回值与边界条件。
		it("should match escape key", () => {
			assert.strictEqual(matchesKey("\x1b", "escape"), true);
		});

		// 测试场景：验证“should match legacy linefeed as enter”对应的行为、返回值与边界条件。
		it("should match legacy linefeed as enter", () => {
			setKittyProtocolActive(false);
			assert.strictEqual(matchesKey("\n", "enter"), true);
			assert.strictEqual(parseKey("\n"), "enter");
		});

		// 测试场景：验证“should treat linefeed as shift+enter when kitty active”对应的行为、返回值与边界条件。
		it("should treat linefeed as shift+enter when kitty active", () => {
			setKittyProtocolActive(true);
			assert.strictEqual(matchesKey("\n", "shift+enter"), true);
			assert.strictEqual(matchesKey("\n", "enter"), false);
			assert.strictEqual(parseKey("\n"), "shift+enter");
			setKittyProtocolActive(false);
		});

		// 测试场景：验证“should parse ctrl+space”对应的行为、返回值与边界条件。
		it("should parse ctrl+space", () => {
			setKittyProtocolActive(false);
			assert.strictEqual(matchesKey("\x00", "ctrl+space"), true);
			assert.strictEqual(parseKey("\x00"), "ctrl+space");
		});

		// 测试场景：验证“should match legacy Ctrl+symbol”对应的行为、返回值与边界条件。
		it("should match legacy Ctrl+symbol", () => {
			setKittyProtocolActive(false);
			// Ctrl+\ sends ASCII 28 (File Separator) in legacy terminals
			// 中文说明：上方英文注释描述“Ctrl+\ sends ASCII 28 (File Separator) in legacy termin”相关前提、步骤或边界；下面代码按该说明执行。
			assert.strictEqual(matchesKey("\x1c", "ctrl+\\"), true);
			assert.strictEqual(parseKey("\x1c"), "ctrl+\\");
			// Ctrl+] sends ASCII 29 (Group Separator) in legacy terminals
			// 中文说明：上方英文注释描述“Ctrl+] sends ASCII 29 (Group Separator) in legacy termi”相关前提、步骤或边界；下面代码按该说明执行。
			assert.strictEqual(matchesKey("\x1d", "ctrl+]"), true);
			assert.strictEqual(parseKey("\x1d"), "ctrl+]");
			// Ctrl+_ sends ASCII 31 (Unit Separator) in legacy terminals
			// Ctrl+- is on the same physical key on US keyboards
			// 中文说明：上方英文注释描述“Ctrl+_ sends ASCII 31 (Unit Separator) in legacy termin”相关前提、步骤或边界；下面代码按该说明执行。
			assert.strictEqual(matchesKey("\x1f", "ctrl+_"), true);
			assert.strictEqual(matchesKey("\x1f", "ctrl+-"), true);
			assert.strictEqual(parseKey("\x1f"), "ctrl+-");
		});

		// 测试场景：验证“should match legacy Ctrl+Alt+symbol”对应的行为、返回值与边界条件。
		it("should match legacy Ctrl+Alt+symbol", () => {
			setKittyProtocolActive(false);
			// Ctrl+Alt+[ sends ESC followed by ESC (Ctrl+[ = ESC)
			// 中文说明：上方英文注释描述“Ctrl+Alt+[ sends ESC followed by ESC (Ctrl+[ = ESC)”相关前提、步骤或边界；下面代码按该说明执行。
			assert.strictEqual(matchesKey("\x1b\x1b", "ctrl+alt+["), true);
			assert.strictEqual(parseKey("\x1b\x1b"), "ctrl+alt+[");
			// Ctrl+Alt+\ sends ESC followed by ASCII 28
			// 中文说明：上方英文注释描述“Ctrl+Alt+\ sends ESC followed by ASCII 28”相关前提、步骤或边界；下面代码按该说明执行。
			assert.strictEqual(matchesKey("\x1b\x1c", "ctrl+alt+\\"), true);
			assert.strictEqual(parseKey("\x1b\x1c"), "ctrl+alt+\\");
			// Ctrl+Alt+] sends ESC followed by ASCII 29
			// 中文说明：上方英文注释描述“Ctrl+Alt+] sends ESC followed by ASCII 29”相关前提、步骤或边界；下面代码按该说明执行。
			assert.strictEqual(matchesKey("\x1b\x1d", "ctrl+alt+]"), true);
			assert.strictEqual(parseKey("\x1b\x1d"), "ctrl+alt+]");
			// Ctrl+_ sends ASCII 31 (Unit Separator) in legacy terminals
			// Ctrl+- is on the same physical key on US keyboards
			// 中文说明：上方英文注释描述“Ctrl+_ sends ASCII 31 (Unit Separator) in legacy termin”相关前提、步骤或边界；下面代码按该说明执行。
			assert.strictEqual(matchesKey("\x1b\x1f", "ctrl+alt+_"), true);
			assert.strictEqual(matchesKey("\x1b\x1f", "ctrl+alt+-"), true);
			assert.strictEqual(parseKey("\x1b\x1f"), "ctrl+alt+-");
		});

		// 测试场景：验证“should treat raw 0x08 as plain backspace outside Windows Terminal”对应的行为、返回值与边界条件。
		it("should treat raw 0x08 as plain backspace outside Windows Terminal", () => {
			setKittyProtocolActive(false);
			withEnv("WT_SESSION", undefined, () => {
				assert.strictEqual(matchesKey("\x7f", "backspace"), true);
				assert.strictEqual(matchesKey("\x7f", "ctrl+backspace"), false);
				assert.strictEqual(parseKey("\x7f"), "backspace");
				assert.strictEqual(matchesKey("\x08", "backspace"), true);
				assert.strictEqual(matchesKey("\x08", "ctrl+backspace"), false);
				assert.strictEqual(parseKey("\x08"), "backspace");
				assert.strictEqual(matchesKey("\x08", "ctrl+h"), true);
			});
		});

		// 测试场景：验证“should treat raw 0x08 as ctrl+backspace in local Windows Terminal”对应的行为、返回值与边界条件。
		it("should treat raw 0x08 as ctrl+backspace in local Windows Terminal", () => {
			setKittyProtocolActive(false);
			withEnvVars(
				{
					WT_SESSION: "test-session",
					SSH_CONNECTION: undefined,
					SSH_CLIENT: undefined,
					SSH_TTY: undefined,
				},
				() => {
					assert.strictEqual(matchesKey("\x08", "ctrl+backspace"), true);
					assert.strictEqual(matchesKey("\x08", "backspace"), false);
					assert.strictEqual(parseKey("\x08"), "ctrl+backspace");
					assert.strictEqual(matchesKey("\x08", "ctrl+h"), true);
				},
			);
		});

		// 测试场景：验证“should treat raw 0x08 as plain backspace in Windows Terminal over SSH”对应的行为、返回值与边界条件。
		it("should treat raw 0x08 as plain backspace in Windows Terminal over SSH", () => {
			setKittyProtocolActive(false);
			withEnvVars(
				{
					WT_SESSION: "test-session",
					SSH_CONNECTION: "1 2 3 4",
					SSH_CLIENT: "1 2 3",
					SSH_TTY: "/dev/pts/1",
				},
				() => {
					assert.strictEqual(matchesKey("\x08", "ctrl+backspace"), false);
					assert.strictEqual(matchesKey("\x08", "backspace"), true);
					assert.strictEqual(parseKey("\x08"), "backspace");
					assert.strictEqual(matchesKey("\x08", "ctrl+h"), true);
				},
			);
		});

		// 测试场景：验证“should parse legacy alt-prefixed sequences when kitty inactive”对应的行为、返回值与边界条件。
		it("should parse legacy alt-prefixed sequences when kitty inactive", () => {
			setKittyProtocolActive(false);
			assert.strictEqual(matchesKey("\x1b ", "alt+space"), true);
			assert.strictEqual(parseKey("\x1b "), "alt+space");
			assert.strictEqual(matchesKey("\x1b\b", "alt+backspace"), true);
			assert.strictEqual(parseKey("\x1b\b"), "alt+backspace");
			assert.strictEqual(matchesKey("\x1b\x03", "ctrl+alt+c"), true);
			assert.strictEqual(parseKey("\x1b\x03"), "ctrl+alt+c");
			assert.strictEqual(matchesKey("\x1bB", "alt+left"), true);
			assert.strictEqual(parseKey("\x1bB"), "alt+left");
			assert.strictEqual(matchesKey("\x1bF", "alt+right"), true);
			assert.strictEqual(parseKey("\x1bF"), "alt+right");
			assert.strictEqual(matchesKey("\x1ba", "alt+a"), true);
			assert.strictEqual(parseKey("\x1ba"), "alt+a");
			assert.strictEqual(matchesKey("\x1b1", "alt+1"), true);
			assert.strictEqual(parseKey("\x1b1"), "alt+1");
			assert.strictEqual(matchesKey("\x1b,", "alt+,"), true);
			assert.strictEqual(parseKey("\x1b,"), "alt+,");
			assert.strictEqual(matchesKey("\x1b.", "alt+."), true);
			assert.strictEqual(parseKey("\x1b."), "alt+.");
			assert.strictEqual(matchesKey("\x1by", "alt+y"), true);
			assert.strictEqual(parseKey("\x1by"), "alt+y");
			assert.strictEqual(matchesKey("\x1bz", "alt+z"), true);
			assert.strictEqual(parseKey("\x1bz"), "alt+z");

			setKittyProtocolActive(true);
			assert.strictEqual(matchesKey("\x1b ", "alt+space"), false);
			assert.strictEqual(parseKey("\x1b "), undefined);
			assert.strictEqual(matchesKey("\x1b\b", "alt+backspace"), true);
			assert.strictEqual(parseKey("\x1b\b"), "alt+backspace");
			assert.strictEqual(matchesKey("\x1b\x03", "ctrl+alt+c"), false);
			assert.strictEqual(parseKey("\x1b\x03"), undefined);
			assert.strictEqual(matchesKey("\x1bB", "alt+left"), false);
			assert.strictEqual(parseKey("\x1bB"), undefined);
			assert.strictEqual(matchesKey("\x1bF", "alt+right"), false);
			assert.strictEqual(parseKey("\x1bF"), undefined);
			assert.strictEqual(matchesKey("\x1ba", "alt+a"), false);
			assert.strictEqual(parseKey("\x1ba"), undefined);
			assert.strictEqual(matchesKey("\x1b1", "alt+1"), false);
			assert.strictEqual(parseKey("\x1b1"), undefined);
			assert.strictEqual(matchesKey("\x1b,", "alt+,"), false);
			assert.strictEqual(parseKey("\x1b,"), undefined);
			assert.strictEqual(matchesKey("\x1b.", "alt+."), false);
			assert.strictEqual(parseKey("\x1b."), undefined);
			assert.strictEqual(matchesKey("\x1by", "alt+y"), false);
			assert.strictEqual(parseKey("\x1by"), undefined);
			setKittyProtocolActive(false);
		});

		// 测试场景：验证“should match arrow keys”对应的行为、返回值与边界条件。
		it("should match arrow keys", () => {
			assert.strictEqual(matchesKey("\x1b[A", "up"), true);
			assert.strictEqual(matchesKey("\x1b[B", "down"), true);
			assert.strictEqual(matchesKey("\x1b[C", "right"), true);
			assert.strictEqual(matchesKey("\x1b[D", "left"), true);
		});

		// 测试场景：验证“should match SS3 arrows and home/end”对应的行为、返回值与边界条件。
		it("should match SS3 arrows and home/end", () => {
			assert.strictEqual(matchesKey("\x1bOA", "up"), true);
			assert.strictEqual(matchesKey("\x1bOB", "down"), true);
			assert.strictEqual(matchesKey("\x1bOC", "right"), true);
			assert.strictEqual(matchesKey("\x1bOD", "left"), true);
			assert.strictEqual(matchesKey("\x1bOH", "home"), true);
			assert.strictEqual(matchesKey("\x1bOF", "end"), true);
		});

		// 测试场景：验证“should match legacy function keys and clear”对应的行为、返回值与边界条件。
		it("should match legacy function keys and clear", () => {
			assert.strictEqual(matchesKey("\x1bOP", "f1"), true);
			assert.strictEqual(matchesKey("\x1b[24~", "f12"), true);
			assert.strictEqual(matchesKey("\x1b[E", "clear"), true);
		});

		// 测试场景：验证“should match alt+arrows”对应的行为、返回值与边界条件。
		it("should match alt+arrows", () => {
			assert.strictEqual(matchesKey("\x1bp", "alt+up"), true);
			assert.strictEqual(matchesKey("\x1bp", "up"), false);
		});

		// 测试场景：验证“should match rxvt modifier sequences”对应的行为、返回值与边界条件。
		it("should match rxvt modifier sequences", () => {
			assert.strictEqual(matchesKey("\x1b[a", "shift+up"), true);
			assert.strictEqual(matchesKey("\x1bOa", "ctrl+up"), true);
			assert.strictEqual(matchesKey("\x1b[2$", "shift+insert"), true);
			assert.strictEqual(matchesKey("\x1b[2^", "ctrl+insert"), true);
			assert.strictEqual(matchesKey("\x1b[7$", "shift+home"), true);
		});
	});
});

// 用例分组：集中验证“decodeKittyPrintable”相关功能。
describe("decodeKittyPrintable", () => {
	// 测试场景：验证“should decode Kitty keypad functional keys to printable characters”对应的行为、返回值与边界条件。
	it("should decode Kitty keypad functional keys to printable characters", () => {
		assert.strictEqual(decodeKittyPrintable("\x1b[57399u"), "0");
		assert.strictEqual(decodeKittyPrintable("\x1b[57400u"), "1");
		assert.strictEqual(decodeKittyPrintable("\x1b[57409u"), ".");
		assert.strictEqual(decodeKittyPrintable("\x1b[57410u"), "/");
		assert.strictEqual(decodeKittyPrintable("\x1b[57411u"), "*");
		assert.strictEqual(decodeKittyPrintable("\x1b[57412u"), "-");
		assert.strictEqual(decodeKittyPrintable("\x1b[57413u"), "+");
		assert.strictEqual(decodeKittyPrintable("\x1b[57415u"), "=");
		assert.strictEqual(decodeKittyPrintable("\x1b[57416u"), ",");
		assert.strictEqual(decodeKittyPrintable("\x1b[57417u"), undefined);
	});
});

// 用例分组：集中验证“decodePrintableKey”相关功能。
describe("decodePrintableKey", () => {
	// 测试场景：验证“should decode printable xterm modifyOtherKeys sequences”对应的行为、返回值与边界条件。
	it("should decode printable xterm modifyOtherKeys sequences", () => {
		assert.strictEqual(decodePrintableKey("\x1b[27;2;69~"), "E");
		assert.strictEqual(decodePrintableKey("\x1b[27;2;196~"), "Ä");
		assert.strictEqual(decodePrintableKey("\x1b[27;2;32~"), " ");
		assert.strictEqual(decodePrintableKey("\x1b[27;2;13~"), undefined);
		assert.strictEqual(decodePrintableKey("\x1b[27;6;69~"), undefined);
	});
});

// 用例分组：集中验证“parseKey”相关功能。
describe("parseKey", () => {
	// 用例分组：集中验证“Kitty protocol with alternate keys”相关功能。
	describe("Kitty protocol with alternate keys", () => {
		// 测试场景：验证“should return Latin key name when base layout key is present”对应的行为、返回值与边界条件。
		it("should return Latin key name when base layout key is present", () => {
			setKittyProtocolActive(true);
			// Cyrillic ctrl+с with base layout 'c'
			// 中文说明：上方英文注释描述“Cyrillic ctrl+с with base layout 'c'”相关前提、步骤或边界；下面代码按该说明执行。
			const cyrillicCtrlC = "\x1b[1089::99;5u";
			assert.strictEqual(parseKey(cyrillicCtrlC), "ctrl+c");
			setKittyProtocolActive(false);
		});

		// 测试场景：验证“should prefer codepoint for Latin letters when base layout differs”对应的行为、返回值与边界条件。
		it("should prefer codepoint for Latin letters when base layout differs", () => {
			setKittyProtocolActive(true);
			// Dvorak Ctrl+K reports codepoint 'k' (107) and base layout 'v' (118)
			// 中文说明：上方英文注释描述“Dvorak Ctrl+K reports codepoint 'k' (107) and base layo”相关前提、步骤或边界；下面代码按该说明执行。
			const dvorakCtrlK = "\x1b[107::118;5u";
			assert.strictEqual(parseKey(dvorakCtrlK), "ctrl+k");
			setKittyProtocolActive(false);
		});

		// 测试场景：验证“should prefer codepoint for symbol keys when base layout differs”对应的行为、返回值与边界条件。
		it("should prefer codepoint for symbol keys when base layout differs", () => {
			setKittyProtocolActive(true);
			// Dvorak Ctrl+/ reports codepoint '/' (47) and base layout '[' (91)
			// 中文说明：上方英文注释描述“Dvorak Ctrl+/ reports codepoint '/' (47) and base layou”相关前提、步骤或边界；下面代码按该说明执行。
			const dvorakCtrlSlash = "\x1b[47::91;5u";
			assert.strictEqual(parseKey(dvorakCtrlSlash), "ctrl+/");
			setKittyProtocolActive(false);
		});

		// 测试场景：验证“should return key name from codepoint when no base layout”对应的行为、返回值与边界条件。
		it("should return key name from codepoint when no base layout", () => {
			setKittyProtocolActive(true);
			/** 常量 latinCtrlC 保存“latinCtrlC”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const latinCtrlC = "\x1b[99;5u";
			assert.strictEqual(parseKey(latinCtrlC), "ctrl+c");
			setKittyProtocolActive(false);
		});

		// 测试场景：验证“should parse shifted uppercase CSI-u letters as shift+letter”对应的行为、返回值与边界条件。
		it("should parse shifted uppercase CSI-u letters as shift+letter", () => {
			setKittyProtocolActive(true);
			assert.strictEqual(matchesKey("\x1b[69;2u", "shift+e"), true);
			assert.strictEqual(parseKey("\x1b[69;2u"), "shift+e");
			setKittyProtocolActive(false);
		});

		// 测试场景：验证“should ignore Kitty CSI-u with unsupported modifiers”对应的行为、返回值与边界条件。
		it("should ignore Kitty CSI-u with unsupported modifiers", () => {
			setKittyProtocolActive(true);
			assert.strictEqual(parseKey("\x1b[99;17u"), undefined);
			setKittyProtocolActive(false);
		});
	});

	// 用例分组：集中验证“Legacy key parsing”相关功能。
	describe("Legacy key parsing", () => {
		// 测试场景：验证“should parse legacy Ctrl+letter”对应的行为、返回值与边界条件。
		it("should parse legacy Ctrl+letter", () => {
			setKittyProtocolActive(false);
			assert.strictEqual(parseKey("\x03"), "ctrl+c");
			assert.strictEqual(parseKey("\x04"), "ctrl+d");
		});

		// 测试场景：验证“should parse special keys”对应的行为、返回值与边界条件。
		it("should parse special keys", () => {
			assert.strictEqual(parseKey("\x1b"), "escape");
			assert.strictEqual(parseKey("\t"), "tab");
			assert.strictEqual(parseKey("\r"), "enter");
			assert.strictEqual(parseKey("\n"), "enter");
			assert.strictEqual(parseKey("\x00"), "ctrl+space");
			assert.strictEqual(parseKey(" "), "space");
			assert.strictEqual(parseKey("1"), "1");
			assert.strictEqual(matchesKey("1", "1"), true);
		});

		// 测试场景：验证“should parse arrow keys”对应的行为、返回值与边界条件。
		it("should parse arrow keys", () => {
			assert.strictEqual(parseKey("\x1b[A"), "up");
			assert.strictEqual(parseKey("\x1b[B"), "down");
			assert.strictEqual(parseKey("\x1b[C"), "right");
			assert.strictEqual(parseKey("\x1b[D"), "left");
		});

		// 测试场景：验证“should parse SS3 arrows and home/end”对应的行为、返回值与边界条件。
		it("should parse SS3 arrows and home/end", () => {
			assert.strictEqual(parseKey("\x1bOA"), "up");
			assert.strictEqual(parseKey("\x1bOB"), "down");
			assert.strictEqual(parseKey("\x1bOC"), "right");
			assert.strictEqual(parseKey("\x1bOD"), "left");
			assert.strictEqual(parseKey("\x1bOH"), "home");
			assert.strictEqual(parseKey("\x1bOF"), "end");
		});

		// 测试场景：验证“should parse legacy function and modifier sequences”对应的行为、返回值与边界条件。
		it("should parse legacy function and modifier sequences", () => {
			assert.strictEqual(parseKey("\x1bOP"), "f1");
			assert.strictEqual(parseKey("\x1b[24~"), "f12");
			assert.strictEqual(parseKey("\x1b[E"), "clear");
			assert.strictEqual(parseKey("\x1b[2^"), "ctrl+insert");
			assert.strictEqual(parseKey("\x1bp"), "alt+up");
		});

		// 测试场景：验证“should parse double bracket pageUp”对应的行为、返回值与边界条件。
		it("should parse double bracket pageUp", () => {
			assert.strictEqual(parseKey("\x1b[[5~"), "pageUp");
		});
	});
});
