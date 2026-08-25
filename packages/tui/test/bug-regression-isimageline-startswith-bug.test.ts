/**
 * Bug regression test for isImageLine() crash scenario
 *
 * Bug: When isImageLine() used startsWith() and terminal doesn't support images,
 * it would return false for lines containing image escape sequences, causing TUI to
 * crash with "Rendered line exceeds terminal width" error.
 *
 * Fix: Changed to use includes() to detect escape sequences anywhere in the line.
 *
 * This test demonstrates:
 * 1. The bug scenario with the old implementation
 * 2. That the fix works correctly
 */
/**
 * 文件职责：回归验证 isImageLine 能在任意位置识别 Kitty/iTerm2 图片转义序列，避免超长行宽度检查崩溃。
 * 技术维度：使用 Node test/assert、动态加载终端图片模块，并构造包含 ANSI 与数十万字符 Base64 的行。
 * 产品维度：确保不支持图片的终端读取图片工具输出时不会因把转义数据当普通文本而崩溃。
 * 逻辑维度：先复现旧 startsWith 缺陷，再验证两种协议、工具输出、真实崩溃长度和负例。
 * 关键边界：只检测协议转义前缀片段而不解码图片；超长字符串会临时占用内存；普通路径不得误判。
 * 新手阅读建议：先读旧实现复现用例理解根因，再看 Kitty/iTerm2 正例，最后用负例确认检测没有过宽。
 */

import assert from "node:assert";
import { describe, it } from "node:test";

/** 覆盖图片转义位于行中间时的崩溃回归和误判边界。 */
describe("Bug regression: isImageLine() crash with image escape sequences", () => {
	describe("Bug scenario: Terminal without image support", () => {
		it("old implementation would return false, causing crash", () => {
			/**
			 * OLD IMPLEMENTATION (buggy):
			 * ```typescript
			 * export function isImageLine(line: string): boolean {
			 *   const prefix = getImageEscapePrefix();
			 *   return prefix !== null && line.startsWith(prefix);
			 * }
			 * ```
			 *
			 * When terminal doesn't support images:
			 * - getImageEscapePrefix() returns null
			 * - isImageLine() returns false even for lines containing image sequences
			 * - TUI performs width check on line containing 300KB+ of base64 data
			 * - Crash: "Rendered line exceeds terminal width (304401 > 115)"
			 */
			/** 上方旧实现说明：无图片能力时 prefix 为 null，导致包含大块 Base64 的行错误进入宽度检查。 */

			// Simulate old implementation behavior
			// 用局部函数模拟旧版 startsWith 实现。
			/**
			 * 模拟旧版仅在已知前缀且行首匹配时判断为图片。
			 * @param line 待检测终端行。
			 * @param imageEscapePrefix 当前终端图片前缀或 null。
			 * @returns 旧实现的检测结果。
			 */
			const oldIsImageLine = (line: string, imageEscapePrefix: string | null): boolean => {
				return imageEscapePrefix !== null && line.startsWith(imageEscapePrefix);
			};

			// When terminal doesn't support images, prefix is null
			// 终端不支持图片时，旧实现取得的前缀为 null。
			/** 模拟终端无图片能力时的前缀。 */
			const terminalWithoutImageSupport = null;

			// Line containing image escape sequence with text before it (common bug scenario)
			// 图片转义前带有工具文字，是实际常见触发形式。
			/** 带普通前缀文字的 iTerm2 图片行。 */
			const lineWithImageSequence =
				"Read image file [image/jpeg]\x1b]1337;File=size=800,600;inline=1:base64data...\x07";

			// Old implementation would return false (BUG!)
			// 旧实现会错误返回 false，从而触发后续崩溃。
			/** 旧实现对该行的错误检测结果。 */
			const oldResult = oldIsImageLine(lineWithImageSequence, terminalWithoutImageSupport);
			assert.strictEqual(
				oldResult,
				false,
				"Bug: old implementation returns false for line containing image sequence when terminal has no image support",
			);
		});

		it("new implementation returns true correctly", async () => {
			/** 动态加载的当前 isImageLine 实现。 */
			const { isImageLine } = await import("../src/terminal-image.ts");

			// Line containing image escape sequence with text before it
			// 图片转义序列前包含普通文本。
			/** 当前实现应识别的 iTerm2 图片行。 */
			const lineWithImageSequence =
				"Read image file [image/jpeg]\x1b]1337;File=size=800,600;inline=1:base64data...\x07";

			// New implementation should return true (FIX!)
			// 新实现使用 includes，应正确返回 true。
			/** 当前实现的检测结果。 */
			const newResult = isImageLine(lineWithImageSequence);
			assert.strictEqual(newResult, true, "Fix: new implementation returns true for line containing image sequence");
		});

		it("new implementation detects Kitty sequences in any position", async () => {
			/** 动态加载的当前图片行检测函数。 */
			const { isImageLine } = await import("../src/terminal-image.ts");

			/** Kitty 转义位于不同行位置及超长行中的正例。 */
			const scenarios = [
				"At start: \x1b_Ga=T,f=100,data...\x1b\\",
				"Prefix \x1b_Ga=T,data...\x1b\\",
				"Suffix text \x1b_Ga=T,data...\x1b\\ suffix",
				"Middle \x1b_Ga=T,data...\x1b\\ more text",
				// Very long line (simulating 300KB+ crash scenario)
				// 模拟超过 300KB 的真实崩溃输入。
				`Text before \x1b_Ga=T,f=100${"A".repeat(300000)} text after`,
			];

			/** line 是包含 Kitty 图像控制序列的当前边界样本，均应识别为图像行。 */
			for (const line of scenarios) {
				assert.strictEqual(isImageLine(line), true, `Should detect Kitty sequence in: ${line.slice(0, 50)}...`);
			}
		});

		it("new implementation detects iTerm2 sequences in any position", async () => {
			/** 动态加载的当前图片行检测函数。 */
			const { isImageLine } = await import("../src/terminal-image.ts");

			/** iTerm2 转义位于不同行位置及超长行中的正例。 */
			const scenarios = [
				"At start: \x1b]1337;File=size=100,100:base64...\x07",
				"Prefix \x1b]1337;File=inline=1:data==\x07",
				"Suffix text \x1b]1337;File=inline=1:data==\x07 suffix",
				"Middle \x1b]1337;File=inline=1:data==\x07 more text",
				// Very long line (simulating 304KB crash scenario)
				// 模拟约 304KB 的崩溃输入。
				`Text before \x1b]1337;File=size=800,600;inline=1:${"B".repeat(300000)} text after`,
			];

			/** line 是包含 iTerm2 图像控制序列的当前边界样本，均应识别为图像行。 */
			for (const line of scenarios) {
				assert.strictEqual(isImageLine(line), true, `Should detect iTerm2 sequence in: ${line.slice(0, 50)}...`);
			}
		});
	});

	describe("Integration: Tool execution scenario", () => {
		/**
		 * This simulates what happens when the `read` tool reads an image file.
		 * The tool result contains both text and image content:
		 *
		 * ```typescript
		 * {
		 *   content: [
		 *     { type: "text", text: "Read image file [image/jpeg]\n800x600" },
		 *     { type: "image", data: "base64...", mimeType: "image/jpeg" }
		 *   ]
		 * }
		 * ```
		 *
		 * When this is rendered, the image component creates escape sequences.
		 * If isImageLine() doesn't detect them, TUI crashes.
		 */
		/** 上方说明：read 工具的文字与图片会被合并渲染，检测失败会让 Base64 进入普通文本宽度计算。 */

		it("detects image sequences in read tool output", async () => {
			/** 动态加载的当前图片行检测函数。 */
			const { isImageLine } = await import("../src/terminal-image.ts");

			// Simulate output when read tool processes an image
			// The line might have text from the read result plus the image escape sequence
			// 模拟 read 工具文字说明与图片转义位于同一行。
			/** read 工具合并输出的 iTerm2 图片行。 */
			const toolOutputLine = "Read image file [image/jpeg]\x1b]1337;File=size=800,600;inline=1:base64image...\x07";

			assert.strictEqual(isImageLine(toolOutputLine), true, "Should detect image sequence in tool output line");
		});

		it("detects Kitty sequences from Image component", async () => {
			/** 动态加载的当前图片行检测函数。 */
			const { isImageLine } = await import("../src/terminal-image.ts");

			// Kitty image component creates multi-line output with escape sequences
			// Kitty 图片组件会生成包含多个控制序列的输出行。
			/** Kitty 图片组件生成的组合转义行。 */
			const kittyLine = "\x1b_Ga=T,f=100,t=f,d=base64data...\x1b\\\x1b_Gm=i=1;\x1b\\";

			assert.strictEqual(isImageLine(kittyLine), true, "Should detect Kitty image component output");
		});

		it("handles ANSI codes before image sequences", async () => {
			/** 动态加载的当前图片行检测函数。 */
			const { isImageLine } = await import("../src/terminal-image.ts");

			// Line might have styling (error, warning, etc.) before image data
			// 图片数据前可能存在错误、警告或粗体 ANSI 样式。
			/** 带不同 ANSI 样式前缀的图片行。 */
			const lines = [
				"\x1b[31mError\x1b[0m: \x1b]1337;File=inline=1:base64==\x07",
				"\x1b[33mWarning\x1b[0m: \x1b_Ga=T,data...\x1b\\",
				"\x1b[1mBold\x1b[0m \x1b]1337;File=:base64==\x07\x1b[0m",
			];

			/** line 是带 ANSI 修饰的当前图像序列样本，用于确认前缀不会妨碍识别。 */
			for (const line of lines) {
				assert.strictEqual(
					isImageLine(line),
					true,
					`Should detect image sequence after ANSI codes: ${line.slice(0, 30)}...`,
				);
			}
		});
	});

	describe("Crash scenario simulation", () => {
		it("does NOT crash on very long lines with image sequences", async () => {
			/** 动态加载的当前图片行检测函数。 */
			const { isImageLine } = await import("../src/terminal-image.ts");

			/**
			 * Simulate the exact crash scenario:
			 * - Line is 304,401 characters (the crash log showed 58649 > 115)
			 * - Contains image escape sequence somewhere in the middle
			 * - Old implementation would return false, causing TUI to do width check
			 * - New implementation returns true, skipping width check (preventing crash)
			 */
			/** 上方说明：构造超过 300KB 且中间含转义的行，当前实现应跳过普通宽度检查。 */

			/** 重复构造超长 Base64 数据的短片段。 */
			const base64Char = "A".repeat(100);
			/** iTerm2 图片序列头。 */
			const iterm2Sequence = "\x1b]1337;File=size=800,600;inline=1:";

			// Build a line that would cause the crash
			// 构造旧实现会触发宽度异常的超长行。
			/** 约 304,000 字符图片数据的终端行。 */
			const crashLine =
				"Output: " +
				iterm2Sequence +
				base64Char.repeat(3040) + // ~304,000 chars
				// 上一段重复数据约为 304,000 个字符。
				" end of output";

			// Verify line is very long
			// 确认夹具足以覆盖真实超长输入。
			assert(crashLine.length > 300000, "Test line should be > 300KB");

			// New implementation should detect it (prevents crash)
			// 新实现检测成功即可阻止后续普通文本宽度检查。
			/** 当前实现对超长图片行的检测结果。 */
			const detected = isImageLine(crashLine);
			assert.strictEqual(detected, true, "Should detect image sequence in very long line, preventing TUI crash");
		});

		it("handles lines exactly matching crash log dimensions", async () => {
			/** 动态加载的当前图片行检测函数。 */
			const { isImageLine } = await import("../src/terminal-image.ts");

			/**
			 * Crash log showed: line 58649 chars wide, terminal width 115
			 * Let's create a line with similar characteristics
			 */
			/** 上方说明：复刻日志中的 58,649 字符行与 115 列终端条件。 */

			/** 崩溃日志记录的目标行宽。 */
			const targetWidth = 58649;
			/** 图片序列前的普通文本。 */
			const prefix = "Text";
			/** Kitty 图片序列头。 */
			const sequence = "\x1b_Ga=T,f=100";
			/** 行尾普通文本。 */
			const suffix = "End";
			/** 补齐目标宽度的 Base64 样式字符。 */
			const padding = "A".repeat(targetWidth - prefix.length - sequence.length - suffix.length);
			/** 精确达到目标宽度且含 Kitty 序列的行。 */
			const line = `${prefix}${sequence}${padding}${suffix}`;

			assert.strictEqual(line.length, 58649);
			assert.strictEqual(isImageLine(line), true, "Should detect image sequence in 58649-char line");
		});
	});

	describe("Negative cases: Don't false positive", () => {
		it("does not detect images in regular long text", async () => {
			/** 动态加载的当前图片行检测函数。 */
			const { isImageLine } = await import("../src/terminal-image.ts");

			// Very long line WITHOUT image sequences
			// 不含任何图片转义的超长普通文本。
			/** 验证不会误判的 100,000 字符普通行。 */
			const longText = "A".repeat(100000);

			assert.strictEqual(isImageLine(longText), false, "Should not detect images in plain long text");
		});

		it("does not detect images in lines with file paths", async () => {
			/** 动态加载的当前图片行检测函数。 */
			const { isImageLine } = await import("../src/terminal-image.ts");

			/** 含相似单词或数字但不含真实转义的文件路径。 */
			const filePaths = [
				"/path/to/1337/image.jpg",
				"/usr/local/bin/File_converter",
				"~/Documents/1337File_backup.png",
				"./_G_test_file.txt",
			];

			/** path 是普通文件路径样本，名称虽含控制序列片段但不应被误判为图像。 */
			for (const path of filePaths) {
				assert.strictEqual(isImageLine(path), false, `Should not falsely detect image sequence in path: ${path}`);
			}
		});
	});
});
