/**
 * Tests for terminal image detection and line handling
 */
/**
 * 文件职责：验证终端图像转义序列识别、终端能力探测、Kitty 光标控制、Image 组件布局和 OSC 8 超链接。
 * 技术维度：使用 Node test/assert、环境变量隔离、iTerm2/Kitty 控制序列以及终端单元格像素尺寸模拟。
 * 产品维度：避免图像控制码被当作超长文本处理，并为不同终端选择安全的图像、真彩色和超链接能力。
 * 逻辑维度：先覆盖图像行正反例，再检测各终端能力，最后验证渲染尺寸、光标移动和超链接包装。
 * 关键边界：能力判断依赖环境变量；每个修改能力缓存和单元格尺寸的用例必须在 finally 中恢复。
 * 新手阅读建议：先看 isImageLine 的协议前缀，再看 detectCapabilities 的环境分支，最后阅读 renderImage 和 Image。
 */

import assert from "node:assert";
import { describe, it } from "node:test";
import { Image } from "../src/components/image.ts";
import {
	deleteAllKittyImages,
	deleteKittyImage,
	detectCapabilities,
	encodeKitty,
	hyperlink,
	isImageLine,
	renderImage,
	resetCapabilitiesCache,
	setCapabilities,
	setCellDimensions,
} from "../src/terminal-image.ts";

/** 会影响终端能力探测且需要在测试中隔离的环境变量名列表。 */
const ENV_KEYS = [
	"TERM",
	"TERM_PROGRAM",
	"TERMINAL_EMULATOR",
	"COLORTERM",
	"TMUX",
	"KITTY_WINDOW_ID",
	"GHOSTTY_RESOURCES_DIR",
	"WEZTERM_PANE",
	"ITERM_SESSION_ID",
	"WT_SESSION",
	"CMUX_WORKSPACE_ID",
	"WARP_SESSION_ID",
	"WARP_TERMINAL_SESSION_UUID",
] as const;

/** 在清空相关环境变量后应用覆盖并执行回调，最后恢复原值。参数 overrides 为环境值、fn 为测试函数；无返回值。例如：withEnv({}, fn)。 */
function withEnv(overrides: Record<string, string | undefined>, fn: () => void): void {
	/** 执行回调前保存的相关环境变量值映射。 */
	const saved: Record<string, string | undefined> = {};
	// key 依次表示每个需要隔离的终端环境变量名。
	for (const key of ENV_KEYS) {
		saved[key] = process.env[key];
		delete process.env[key];
	}
	try {
		// k 和 v 分别表示本次覆盖的环境变量名及其可选值。
		for (const [k, v] of Object.entries(overrides)) {
			if (v === undefined) delete process.env[k];
			else process.env[k] = v;
		}
		fn();
	} finally {
		// key 依次表示需要恢复到 saved 原值的环境变量名。
		for (const key of ENV_KEYS) {
			if (saved[key] === undefined) delete process.env[key];
			else process.env[key] = saved[key];
		}
	}
}

describe("isImageLine", () => {
	describe("iTerm2 image protocol", () => {
		// 测试场景：验证“should detect iTerm2 image escape sequence at start of line”对应的终端图像行为。
		it("should detect iTerm2 image escape sequence at start of line", () => {
			// iTerm2 image escape sequence: ESC ]1337;File=...
			/** 位于行首的最小 iTerm2 图像控制序列。 */
			const iterm2ImageLine = "\x1b]1337;File=size=100,100;inline=1:base64encodeddata==\x07";
			assert.strictEqual(isImageLine(iterm2ImageLine), true);
		});

		// 测试场景：验证“should detect iTerm2 image escape sequence with text before it”对应的终端图像行为。
		it("should detect iTerm2 image escape sequence with text before it", () => {
			// Simulating a line that has text then image data (bug scenario)
			/** 文本前后混有 iTerm2 图像控制序列的行。 */
			const lineWithTextAndImage = "Some text \x1b]1337;File=size=100,100;inline=1:base64data==\x07 more text";
			assert.strictEqual(isImageLine(lineWithTextAndImage), true);
		});

		// 测试场景：验证“should detect iTerm2 image escape sequence in middle of long line”对应的终端图像行为。
		it("should detect iTerm2 image escape sequence in middle of long line", () => {
			// Simulate a very long line with image data in the middle
			/** 图像序列位于较长文本中间的测试行。 */
			const longLineWithImage =
				"Text before image..." + "\x1b]1337;File=inline=1:verylongbase64data==" + "...text after";
			assert.strictEqual(isImageLine(longLineWithImage), true);
		});

		// 测试场景：验证“should detect iTerm2 image escape sequence at end of line”对应的终端图像行为。
		it("should detect iTerm2 image escape sequence at end of line", () => {
			/** 图像序列位于普通文本末尾的测试行。 */
			const lineWithImageAtEnd = "Regular text ending with \x1b]1337;File=inline=1:base64data==\x07";
			assert.strictEqual(isImageLine(lineWithImageAtEnd), true);
		});

		// 测试场景：验证“should detect minimal iTerm2 image escape sequence”对应的终端图像行为。
		it("should detect minimal iTerm2 image escape sequence", () => {
			/** 只含必要字段的最小 iTerm2 图像行。 */
			const minimalImageLine = "\x1b]1337;File=:\x07";
			assert.strictEqual(isImageLine(minimalImageLine), true);
		});
	});

	describe("Kitty image protocol", () => {
		// 测试场景：验证“should detect Kitty image escape sequence at start of line”对应的终端图像行为。
		it("should detect Kitty image escape sequence at start of line", () => {
			// Kitty image escape sequence: ESC _G
			/** 位于行首的 Kitty 图像传输与显示序列。 */
			const kittyImageLine = "\x1b_Ga=T,f=100,t=f,d=base64data...\x1b\\\x1b_Gm=i=1;\x1b\\";
			assert.strictEqual(isImageLine(kittyImageLine), true);
		});

		// 测试场景：验证“should detect Kitty image escape sequence with text before it”对应的终端图像行为。
		it("should detect Kitty image escape sequence with text before it", () => {
			// Bug scenario: text + image data in same line
			/** 普通文本与 Kitty 图像序列混合的行。 */
			const lineWithTextAndKittyImage = "Output: \x1b_Ga=T,f=100;data...\x1b\\\x1b_Gm=i=1;\x1b\\";
			assert.strictEqual(isImageLine(lineWithTextAndKittyImage), true);
		});

		// 测试场景：验证“should detect Kitty image escape sequence with padding”对应的终端图像行为。
		it("should detect Kitty image escape sequence with padding", () => {
			// Kitty protocol adds padding to escape sequences
			/** 两侧带空格填充的 Kitty 图像序列。 */
			const kittyWithPadding = "  \x1b_Ga=T,f=100...\x1b\\\x1b_Gm=i=1;\x1b\\  ";
			assert.strictEqual(isImageLine(kittyWithPadding), true);
		});
	});

	describe("Bug regression tests", () => {
		// 测试场景：验证“should detect image sequences in very long lines (304k+ chars)”对应的终端图像行为。
		it("should detect image sequences in very long lines (304k+ chars)", () => {
			// This simulates the crash scenario: a line with 304,401 chars
			// containing image escape sequences somewhere
			/** 模拟 Base64 数据的 100 字符片段。 */
			const base64Char = "A".repeat(100); // 100 chars of base64-like data
			/** iTerm2 图像序列头。 */
			const imageSequence = "\x1b]1337;File=size=800,600;inline=1:";

			// Build a long line with image sequence
			/** 长度超过 30 万字符且包含图像序列的回归输入。 */
			const longLine =
				"Text prefix " +
				imageSequence +
				base64Char.repeat(3000) + // ~300,000 chars
				" suffix";

			assert.strictEqual(longLine.length > 300000, true);
			assert.strictEqual(isImageLine(longLine), true);
		});

		// 测试场景：验证“should detect image sequences when terminal doesn't support images”对应的终端图像行为。
		it("should detect image sequences when terminal doesn't support images", () => {
			// The bug occurred when getImageEscapePrefix() returned null
			// isImageLine should still detect image sequences regardless
			/** 即使终端不支持图片也应识别的图像行。 */
			const lineWithImage = "Read image file [image/jpeg]\x1b]1337;File=inline=1:base64data==\x07";
			assert.strictEqual(isImageLine(lineWithImage), true);
		});

		// 测试场景：验证“should detect image sequences with ANSI codes before them”对应的终端图像行为。
		it("should detect image sequences with ANSI codes before them", () => {
			// Text might have ANSI styling before image data
			/** ANSI 样式码之后包含图像序列的行。 */
			const lineWithAnsiAndImage = "\x1b[31mError output \x1b]1337;File=inline=1:image==\x07";
			assert.strictEqual(isImageLine(lineWithAnsiAndImage), true);
		});

		// 测试场景：验证“should detect image sequences with ANSI codes after them”对应的终端图像行为。
		it("should detect image sequences with ANSI codes after them", () => {
			/** 图像序列之后包含 ANSI 重置码的行。 */
			const lineWithImageAndAnsi = "\x1b_Ga=T,f=100:data...\x1b\\\x1b_Gm=i=1;\x1b\\\x1b[0m reset";
			assert.strictEqual(isImageLine(lineWithImageAndAnsi), true);
		});
	});

	describe("Negative cases - lines without images", () => {
		// 测试场景：验证“should not detect images in plain text lines”对应的终端图像行为。
		it("should not detect images in plain text lines", () => {
			/** 不含任何转义序列的普通文本。 */
			const plainText = "This is just a regular text line without any escape sequences";
			assert.strictEqual(isImageLine(plainText), false);
		});

		// 测试场景：验证“should not detect images in lines with only ANSI codes”对应的终端图像行为。
		it("should not detect images in lines with only ANSI codes", () => {
			/** 只含颜色 ANSI 控制码的文本。 */
			const ansiText = "\x1b[31mRed text\x1b[0m and \x1b[32mgreen text\x1b[0m";
			assert.strictEqual(isImageLine(ansiText), false);
		});

		// 测试场景：验证“should not detect images in lines with cursor movement codes”对应的终端图像行为。
		it("should not detect images in lines with cursor movement codes", () => {
			/** 只含光标移动控制码的文本。 */
			const cursorCodes = "\x1b[1A\x1b[2KLine cleared and moved up";
			assert.strictEqual(isImageLine(cursorCodes), false);
		});

		// 测试场景：验证“should not detect images in lines with partial iTerm2 sequences”对应的终端图像行为。
		it("should not detect images in lines with partial iTerm2 sequences", () => {
			// Similar prefix but missing the complete sequence
			/** 缺少 ESC 前缀的不完整协议文本。 */
			const partialSequence = "Some text with ]1337;File but missing ESC at start";
			assert.strictEqual(isImageLine(partialSequence), false);
		});

		// 测试场景：验证“should not detect images in lines with partial Kitty sequences”对应的终端图像行为。
		it("should not detect images in lines with partial Kitty sequences", () => {
			// Similar prefix but missing the complete sequence
			/** 缺少 ESC 前缀的不完整协议文本。 */
			const partialSequence = "Some text with _G but missing ESC at start";
			assert.strictEqual(isImageLine(partialSequence), false);
		});

		// 测试场景：验证“should not detect images in empty lines”对应的终端图像行为。
		it("should not detect images in empty lines", () => {
			assert.strictEqual(isImageLine(""), false);
		});

		// 测试场景：验证“should not detect images in lines with newlines only”对应的终端图像行为。
		it("should not detect images in lines with newlines only", () => {
			assert.strictEqual(isImageLine("\n"), false);
			assert.strictEqual(isImageLine("\n\n"), false);
		});
	});

	describe("Mixed content scenarios", () => {
		// 测试场景：验证“should detect images when line has both Kitty and iTerm2 sequences”对应的终端图像行为。
		it("should detect images when line has both Kitty and iTerm2 sequences", () => {
			/** 同时包含 Kitty 和 iTerm2 控制序列的行。 */
			const mixedLine = "Kitty: \x1b_Ga=T...\x1b\\\x1b_Gm=i=1;\x1b\\ iTerm2: \x1b]1337;File=inline=1:data==\x07";
			assert.strictEqual(isImageLine(mixedLine), true);
		});

		// 测试场景：验证“should detect image in line with multiple text and image segments”对应的终端图像行为。
		it("should detect image in line with multiple text and image segments", () => {
			/** 包含多个文本与 iTerm2 图像段的行。 */
			const complexLine = "Start \x1b]1337;File=img1==\x07 middle \x1b]1337;File=img2==\x07 end";
			assert.strictEqual(isImageLine(complexLine), true);
		});

		// 测试场景：验证“should not falsely detect image in line with file path containing keywords”对应的终端图像行为。
		it("should not falsely detect image in line with file path containing keywords", () => {
			// File path might contain "1337" or "File" but without escape sequences
			/** 包含 File 和 1337 关键字但没有控制码的普通路径。 */
			const filePathLine = "/path/to/File_1337_backup/image.jpg";
			assert.strictEqual(isImageLine(filePathLine), false);
		});
	});
});

describe("detectCapabilities", () => {
	// 测试场景：验证“defaults to hyperlinks: false for unknown terminals”对应的终端图像行为。
	it("defaults to hyperlinks: false for unknown terminals", () => {
		withEnv({}, () => {
			/** 当前环境组合探测出的终端能力。 */
			const caps = detectCapabilities();
			assert.strictEqual(caps.hyperlinks, false);
			assert.strictEqual(caps.images, null);
		});
	});

	// 测试场景：验证“enables hyperlinks under tmux when the client forwards them”对应的终端图像行为。
	it("enables hyperlinks under tmux when the client forwards them", () => {
		withEnv({ TMUX: "/tmp/tmux-1000/default,1234,0", TERM_PROGRAM: "ghostty" }, () => {
			/** 当前环境组合探测出的终端能力。 */
			const caps = detectCapabilities(() => true);
			assert.strictEqual(caps.hyperlinks, true);
			assert.strictEqual(caps.images, null);
		});
	});

	// 测试场景：验证“disables hyperlinks under tmux when the client does not forward them”对应的终端图像行为。
	it("disables hyperlinks under tmux when the client does not forward them", () => {
		withEnv({ TMUX: "/tmp/tmux-1000/default,1234,0", TERM_PROGRAM: "ghostty" }, () => {
			/** 当前环境组合探测出的终端能力。 */
			const caps = detectCapabilities(() => false);
			assert.strictEqual(caps.hyperlinks, false);
			assert.strictEqual(caps.images, null);
		});
	});

	// 测试场景：验证“checks tmux capability when TERM starts with 'tmux'”对应的终端图像行为。
	it("checks tmux capability when TERM starts with 'tmux'", () => {
		withEnv({ TERM: "tmux-256color", TERM_PROGRAM: "iterm.app" }, () => {
			/** 当前环境组合探测出的终端能力。 */
			const caps = detectCapabilities(() => true);
			assert.strictEqual(caps.hyperlinks, true);
			assert.strictEqual(caps.images, null);

			/** 同一环境在 tmux 不转发能力时的第二次探测结果。 */
			const caps2 = detectCapabilities(() => false);
			assert.strictEqual(caps2.hyperlinks, false);
		});
	});

	// 测试场景：验证“forces hyperlinks: false when TERM starts with 'screen'”对应的终端图像行为。
	it("forces hyperlinks: false when TERM starts with 'screen'", () => {
		withEnv({ TERM: "screen-256color" }, () => {
			/** 当前环境组合探测出的终端能力。 */
			const caps = detectCapabilities();
			assert.strictEqual(caps.hyperlinks, false);
			assert.strictEqual(caps.images, null);
		});
	});

	// 测试场景：验证“enables hyperlinks for Ghostty”对应的终端图像行为。
	it("enables hyperlinks for Ghostty", () => {
		withEnv({ TERM_PROGRAM: "ghostty" }, () => {
			/** 当前环境组合探测出的终端能力。 */
			const caps = detectCapabilities();
			assert.strictEqual(caps.hyperlinks, true);
		});
	});

	// 测试场景：验证“does not disable Ghostty images solely because cmux is present”对应的终端图像行为。
	it("does not disable Ghostty images solely because cmux is present", () => {
		withEnv({ TERM_PROGRAM: "ghostty", CMUX_WORKSPACE_ID: "workspace" }, () => {
			/** 当前环境组合探测出的终端能力。 */
			const caps = detectCapabilities();
			assert.strictEqual(caps.images, "kitty");
			assert.strictEqual(caps.hyperlinks, true);
		});
	});

	// 测试场景：验证“enables hyperlinks for Kitty”对应的终端图像行为。
	it("enables hyperlinks for Kitty", () => {
		withEnv({ KITTY_WINDOW_ID: "1" }, () => {
			/** 当前环境组合探测出的终端能力。 */
			const caps = detectCapabilities();
			assert.strictEqual(caps.hyperlinks, true);
		});
	});

	// 测试场景：验证“enables hyperlinks for WezTerm”对应的终端图像行为。
	it("enables hyperlinks for WezTerm", () => {
		withEnv({ WEZTERM_PANE: "0" }, () => {
			/** 当前环境组合探测出的终端能力。 */
			const caps = detectCapabilities();
			assert.strictEqual(caps.hyperlinks, true);
		});
	});

	// 测试场景：验证“enables images and hyperlinks for Warp via TERM_PROGRAM”对应的终端图像行为。
	it("enables images and hyperlinks for Warp via TERM_PROGRAM", () => {
		withEnv({ TERM_PROGRAM: "WarpTerminal" }, () => {
			/** 当前环境组合探测出的终端能力。 */
			const caps = detectCapabilities();
			assert.strictEqual(caps.images, "kitty");
			assert.strictEqual(caps.trueColor, true);
			assert.strictEqual(caps.hyperlinks, true);
		});
	});

	// 测试场景：验证“enables images and hyperlinks for Warp via WARP_SESSION_ID”对应的终端图像行为。
	it("enables images and hyperlinks for Warp via WARP_SESSION_ID", () => {
		withEnv({ WARP_SESSION_ID: "some-session-id" }, () => {
			/** 当前环境组合探测出的终端能力。 */
			const caps = detectCapabilities();
			assert.strictEqual(caps.images, "kitty");
			assert.strictEqual(caps.trueColor, true);
			assert.strictEqual(caps.hyperlinks, true);
		});
	});

	// 测试场景：验证“enables images and hyperlinks for Warp via WARP_TERMINAL_SESSION_UUID”对应的终端图像行为。
	it("enables images and hyperlinks for Warp via WARP_TERMINAL_SESSION_UUID", () => {
		withEnv({ WARP_TERMINAL_SESSION_UUID: "d0e1a2e5-7ca7-44cd-9037-ac7222011161" }, () => {
			/** 当前环境组合探测出的终端能力。 */
			const caps = detectCapabilities();
			assert.strictEqual(caps.images, "kitty");
			assert.strictEqual(caps.trueColor, true);
			assert.strictEqual(caps.hyperlinks, true);
		});
	});

	// 测试场景：验证“disables images for Warp inside tmux”对应的终端图像行为。
	it("disables images for Warp inside tmux", () => {
		withEnv(
			{
				TERM_PROGRAM: "WarpTerminal",
				TMUX: "/tmp/tmux-1000/default,1234,0",
				TERM: "tmux-256color",
			},
			() => {
				/** 当前环境组合探测出的终端能力。 */
				const caps = detectCapabilities(() => true);
				assert.strictEqual(caps.images, null);
				assert.strictEqual(caps.hyperlinks, true);
			},
		);
	});

	// 测试场景：验证“enables hyperlinks for iTerm2”对应的终端图像行为。
	it("enables hyperlinks for iTerm2", () => {
		withEnv({ TERM_PROGRAM: "iterm.app" }, () => {
			/** 当前环境组合探测出的终端能力。 */
			const caps = detectCapabilities();
			assert.strictEqual(caps.hyperlinks, true);
		});
	});

	// 测试场景：验证“enables hyperlinks for VSCode”对应的终端图像行为。
	it("enables hyperlinks for VSCode", () => {
		withEnv({ TERM_PROGRAM: "vscode" }, () => {
			/** 当前环境组合探测出的终端能力。 */
			const caps = detectCapabilities();
			assert.strictEqual(caps.hyperlinks, true);
		});
	});

	// 测试场景：验证“enables truecolor and hyperlinks for Windows Terminal outside multiplexers”对应的终端图像行为。
	it("enables truecolor and hyperlinks for Windows Terminal outside multiplexers", () => {
		withEnv({ WT_SESSION: "session", TERM: "xterm-256color" }, () => {
			/** 当前环境组合探测出的终端能力。 */
			const caps = detectCapabilities();
			assert.strictEqual(caps.trueColor, true);
			assert.strictEqual(caps.hyperlinks, true);
			assert.strictEqual(caps.images, null);
		});
	});

	// 测试场景：验证“enables truecolor without hyperlinks for JetBrains terminal”对应的终端图像行为。
	it("enables truecolor without hyperlinks for JetBrains terminal", () => {
		withEnv({ TERMINAL_EMULATOR: "JetBrains-JediTerm", TERM: "xterm-256color" }, () => {
			/** 当前环境组合探测出的终端能力。 */
			const caps = detectCapabilities();
			assert.strictEqual(caps.trueColor, true);
			assert.strictEqual(caps.hyperlinks, false);
			assert.strictEqual(caps.images, null);
		});
	});

	// 测试场景：验证“does not inherit Windows Terminal truecolor through tmux”对应的终端图像行为。
	it("does not inherit Windows Terminal truecolor through tmux", () => {
		withEnv({ WT_SESSION: "session", TMUX: "/tmp/tmux-1000/default,1234,0", TERM: "tmux-256color" }, () => {
			/** 当前环境组合探测出的终端能力。 */
			const caps = detectCapabilities(() => false);
			assert.strictEqual(caps.trueColor, false);
			assert.strictEqual(caps.hyperlinks, false);
			assert.strictEqual(caps.images, null);
		});
	});

	// 测试场景：验证“trusts explicit truecolor hints through tmux”对应的终端图像行为。
	it("trusts explicit truecolor hints through tmux", () => {
		withEnv({ COLORTERM: "truecolor", TMUX: "/tmp/tmux-1000/default,1234,0", TERM: "tmux-256color" }, () => {
			/** 当前环境组合探测出的终端能力。 */
			const caps = detectCapabilities(() => false);
			assert.strictEqual(caps.trueColor, true);
			assert.strictEqual(caps.hyperlinks, false);
			assert.strictEqual(caps.images, null);
		});
	});
});

describe("Kitty image cursor movement", () => {
	// 测试场景：验证“can request no terminal-side cursor movement”对应的终端图像行为。
	it("can request no terminal-side cursor movement", () => {
		/** encodeKitty 生成的完整控制序列。 */
		const sequence = encodeKitty("AAAA", { columns: 2, rows: 2, moveCursor: false });
		assert.ok(sequence.startsWith("\x1b_Ga=T,f=100,q=2,C=1,c=2,r=2;"));
	});

	// 测试场景：验证“suppresses Kitty replies for delete commands”对应的终端图像行为。
	it("suppresses Kitty replies for delete commands", () => {
		assert.strictEqual(deleteKittyImage(42), "\x1b_Ga=d,d=I,i=42,q=2\x1b\\");
		assert.strictEqual(deleteAllKittyImages(), "\x1b_Ga=d,d=A,q=2\x1b\\");
	});

	// 测试场景：验证“preserves renderImage's default terminal-side cursor movement”对应的终端图像行为。
	it("preserves renderImage's default terminal-side cursor movement", () => {
		setCapabilities({ images: "kitty", trueColor: true, hyperlinks: true });
		setCellDimensions({ widthPx: 10, heightPx: 10 });
		try {
			/** 当前图片渲染或超链接包装结果。 */
			const result = renderImage("AAAA", { widthPx: 20, heightPx: 20 }, { maxWidthCells: 2 });
			assert.ok(result);
			assert.ok(!result.sequence.includes(",C=1,"));
			assert.strictEqual(result.rows, 2);
		} finally {
			resetCapabilitiesCache();
			setCellDimensions({ widthPx: 9, heightPx: 18 });
		}
	});

	// 测试场景：验证“can opt renderImage into no terminal-side cursor movement”对应的终端图像行为。
	it("can opt renderImage into no terminal-side cursor movement", () => {
		setCapabilities({ images: "kitty", trueColor: true, hyperlinks: true });
		setCellDimensions({ widthPx: 10, heightPx: 10 });
		try {
			/** 当前图片渲染或超链接包装结果。 */
			const result = renderImage("AAAA", { widthPx: 20, heightPx: 20 }, { maxWidthCells: 2, moveCursor: false });
			assert.ok(result);
			assert.ok(result.sequence.includes(",C=1,"));
			assert.strictEqual(result.rows, 2);
		} finally {
			resetCapabilitiesCache();
			setCellDimensions({ widthPx: 9, heightPx: 18 });
		}
	});

	// 测试场景：验证“honors maxHeightCells by reducing rendered width”对应的终端图像行为。
	it("honors maxHeightCells by reducing rendered width", () => {
		setCapabilities({ images: "kitty", trueColor: true, hyperlinks: true });
		setCellDimensions({ widthPx: 10, heightPx: 10 });
		try {
			/** 当前图片渲染或超链接包装结果。 */
			const result = renderImage("AAAA", { widthPx: 10, heightPx: 100 }, { maxWidthCells: 10, maxHeightCells: 5 });
			assert.ok(result);
			assert.strictEqual(result.rows, 5);
			assert.ok(result.sequence.includes(",c=1,r=5"));
		} finally {
			resetCapabilitiesCache();
			setCellDimensions({ widthPx: 9, heightPx: 18 });
		}
	});

	// 测试场景：验证“caps Image component height to a square pixel box by default”对应的终端图像行为。
	it("caps Image component height to a square pixel box by default", () => {
		setCapabilities({ images: "kitty", trueColor: true, hyperlinks: true });
		setCellDimensions({ widthPx: 10, heightPx: 20 });
		try {
			/** 使用固定像素尺寸创建的 Image 组件。 */
			const image = new Image(
				"AAAA",
				"image/png",
				{ fallbackColor: (value) => value },
				{ maxWidthCells: 10 },
				{ widthPx: 10, heightPx: 100 },
			);
			/** Image.render 返回的终端行数组。 */
			const lines = image.render(12);
			assert.strictEqual(lines.length, 5);
			assert.ok(lines[0].includes(",c=1,r=5"));
		} finally {
			resetCapabilitiesCache();
			setCellDimensions({ widthPx: 9, heightPx: 18 });
		}
	});

	// 测试场景：验证“places image sequence on first line with empty padding rows”对应的终端图像行为。
	it("places image sequence on first line with empty padding rows", () => {
		setCapabilities({ images: "kitty", trueColor: true, hyperlinks: true });
		setCellDimensions({ widthPx: 10, heightPx: 10 });
		try {
			/** 使用固定像素尺寸创建的 Image 组件。 */
			const image = new Image(
				"AAAA",
				"image/png",
				{ fallbackColor: (value) => value },
				{ maxWidthCells: 2 },
				{ widthPx: 20, heightPx: 20 },
			);
			/** Image.render 返回的终端行数组。 */
			const lines = image.render(4);
			/** Image 组件为 Kitty 协议分配的数字编号。 */
			const imageId = image.getImageId();
			assert.strictEqual(typeof imageId, "number");
			assert.ok(lines[0].startsWith("\x1b_G"));
			assert.ok(lines[0].includes(",C=1,"));
			assert.ok(lines[0].includes(`,i=${imageId}`));
			assert.ok(lines[0].endsWith("\x1b\\"));
			assert.deepStrictEqual(lines.slice(1, lines.length), [""]);
		} finally {
			resetCapabilitiesCache();
			setCellDimensions({ widthPx: 9, heightPx: 18 });
		}
	});
});

describe("hyperlink", () => {
	// 测试场景：验证“wraps text in OSC 8 open and close sequences”对应的终端图像行为。
	it("wraps text in OSC 8 open and close sequences", () => {
		/** 当前图片渲染或超链接包装结果。 */
		const result = hyperlink("click me", "https://example.com");
		assert.strictEqual(result, "\x1b]8;;https://example.com\x1b\\click me\x1b]8;;\x1b\\");
	});

	// 测试场景：验证“preserves ANSI styling inside the hyperlink”对应的终端图像行为。
	it("preserves ANSI styling inside the hyperlink", () => {
		/** 保留在超链接内部的 ANSI 样式文本。 */
		const styled = "\x1b[4m\x1b[34mclick me\x1b[0m";
		/** 当前图片渲染或超链接包装结果。 */
		const result = hyperlink(styled, "https://example.com");
		assert.ok(result.startsWith("\x1b]8;;https://example.com\x1b\\"));
		assert.ok(result.includes(styled));
		assert.ok(result.endsWith("\x1b]8;;\x1b\\"));
	});

	// 测试场景：验证“works with empty text”对应的终端图像行为。
	it("works with empty text", () => {
		/** 当前图片渲染或超链接包装结果。 */
		const result = hyperlink("", "https://example.com");
		assert.strictEqual(result, "\x1b]8;;https://example.com\x1b\\\x1b]8;;\x1b\\");
	});

	// 测试场景：验证“works with file:// URIs”对应的终端图像行为。
	it("works with file:// URIs", () => {
		/** 当前图片渲染或超链接包装结果。 */
		const result = hyperlink("README.md", "file:///home/user/README.md");
		assert.ok(result.includes("file:///home/user/README.md"));
		assert.ok(result.includes("README.md"));
	});
});
