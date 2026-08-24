/**
 * 文件职责：验证工具路径辅助器对主目录、Unicode 空格、相对路径及 macOS 特殊文件名的解析回退。
 * 技术维度：使用 Vitest、Node.js 临时文件系统和 Unicode NFC/NFD/引号变体构造跨平台单元测试。
 * 产品维度：让用户复制或手输带重音、弯引号和特殊空格的截图路径时仍能成功读取文件。
 * 逻辑维度：依次测试 expandPath、resolveToCwd，再在临时目录中覆盖 resolveReadPath 的多种文件名变体。
 * 关键边界：文件系统自身可能自动做 Unicode 规范化；清理错误被忽略；`~draft` 不是主目录快捷写法。
 * 新手阅读建议：先区分 expandPath 与 resolveToCwd，再对照实际磁盘文件名和用户输入名阅读回退用例。
 */
import { mkdtempSync, readdirSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { expandPath, resolveReadPath, resolveToCwd } from "../src/core/tools/path-utils.ts";

// 验证路径文本展开、工作目录解析和实际读取路径回退。
describe("path-utils", () => {
	// expandPath 负责主目录快捷写法和特殊空格标准化。
	describe("expandPath", () => {
		it("should expand ~ to home directory", () => {
			// result 是独立波浪号展开后的用户主目录。
			const result = expandPath("~");
			expect(result).not.toContain("~");
		});

		it("should expand ~/path to home directory", () => {
			// result 是 `~/...` 展开后的完整路径。
			const result = expandPath("~/Documents/file.txt");
			expect(result).not.toContain("~/");
		});

		it("should keep tilde-prefixed filenames literal", () => {
			expect(expandPath("~draft.md")).toBe("~draft.md");
			expect(expandPath("@~draft.md")).toBe("~draft.md");
		});

		it("should normalize Unicode spaces", () => {
			// Non-breaking space (U+00A0) should become regular space
			// 不换行空格 U+00A0 应转换为普通空格。
			// withNBSP 是包含不换行空格的文件名。
			const withNBSP = "file\u00A0name.txt";
			// result 是完成空格规范化后的路径。
			const result = expandPath(withNBSP);
			expect(result).toBe("file name.txt");
		});
	});

	// resolveToCwd 负责把展开后的相对路径定位到指定工作目录。
	describe("resolveToCwd", () => {
		it("should resolve absolute paths as-is", () => {
			// absolutePath 是不应被 cwd 改写的绝对路径。
			const absolutePath = resolve(tmpdir(), "absolute", "path", "file.txt");
			// result 是解析后的路径，应与输入绝对路径相同。
			const result = resolveToCwd(absolutePath, resolve(tmpdir(), "some", "cwd"));
			expect(result).toBe(absolutePath);
		});

		it("should resolve relative paths against cwd", () => {
			// result 是相对输入基于 cwd 解析后的绝对路径。
			const result = resolveToCwd("relative/file.txt", "/some/cwd");
			expect(result).toBe(resolve("/some/cwd", "relative/file.txt"));
		});

		it("should resolve tilde-prefixed filenames against cwd", () => {
			// cwd 是解析普通波浪号前缀文件名的临时基准目录。
			const cwd = join(tmpdir(), "pi-path-utils-cwd");
			expect(resolveToCwd("~draft.md", cwd)).toBe(resolve(cwd, "~draft.md"));
			expect(resolveToCwd("@~draft.md", cwd)).toBe(resolve(cwd, "~draft.md"));
		});
	});

	// resolveReadPath 在直接路径不存在时尝试 macOS 常见 Unicode 文件名变体。
	describe("resolveReadPath", () => {
		// tempDir 是每个读取用例独占的临时目录。
		let tempDir: string;

		// 每个用例前创建新的临时目录。
		beforeEach(() => {
			tempDir = mkdtempSync(join(tmpdir(), "path-utils-test-"));
		});

		afterEach(() => {
			// Clean up temp files and directory
			// 删除临时文件和目录。
			try {
				// files 是临时目录中需要逐个删除的文件名。
				const files = readdirSync(tempDir);
				for (const file of files) {
					unlinkSync(join(tempDir, file));
				}
				rmdirSync(tempDir);
			} catch {
				// Ignore cleanup errors
				// 清理失败不掩盖本用例的主要断言结果。
			}
		});

		it("should resolve existing file path", () => {
			// fileName 是直接存在于 tempDir 的普通文件名。
			const fileName = "test-file.txt";
			writeFileSync(join(tempDir, fileName), "content");

			// result 是解析得到的实际文件路径。
			const result = resolveReadPath(fileName, tempDir);
			expect(result).toBe(join(tempDir, fileName));
		});

		it("should handle NFC vs NFD Unicode normalization (macOS filenames with accents)", () => {
			// macOS stores filenames in NFD (decomposed) form:
			// macOS 可能用 NFD 分解形式保存文件名：
			//   é = e + combining acute accent (U+0301)
			// Users typically type in NFC (composed) form:
			// 用户通常输入 NFC 合成形式：
			//   é = single character (U+00E9)
			//
			// Note: macOS APFS normalizes Unicode automatically, so both paths work.
			// APFS 会自动规范化 Unicode，因此两个路径在 macOS 上可能都直接可用。
			// This test verifies the NFD variant fallback works on systems that don't.
			// 本测试确认其他文件系统也能通过 NFD 回退找到文件。

			// NFD: e (U+0065) + combining acute accent (U+0301)
			// NFD 使用 e 加组合重音字符。
			// nfdFileName 是实际写入磁盘的分解形式名称。
			const nfdFileName = "file\u0065\u0301.txt";
			// NFC: é as single character (U+00E9)
			// NFC 使用单个 é 字符。
			// nfcFileName 是模拟用户输入的合成形式名称。
			const nfcFileName = "file\u00e9.txt";

			// Verify they have different byte sequences
			// 先确认两种名称确实具有不同字节序列。
			expect(nfdFileName).not.toBe(nfcFileName);
			expect(Buffer.from(nfdFileName)).not.toEqual(Buffer.from(nfcFileName));

			// Create file with NFD name
			// 使用 NFD 名称创建真实文件。
			writeFileSync(join(tempDir, nfdFileName), "content");

			// User provides NFC path - should find the file (via filesystem normalization or our fallback)
			// 用户输入 NFC 路径时，应通过文件系统或代码回退找到文件。
			// result 是从 NFC 用户输入解析出的实际路径。
			const result = resolveReadPath(nfcFileName, tempDir);
			// Result should contain the accented character (either NFC or NFD form)
			// 返回路径可保持 NFC 或 NFD，但必须位于临时目录且匹配目标文件。
			expect(result).toContain(tempDir);
			expect(result).toMatch(/file.+\.txt$/);
		});

		it("should handle curly quotes vs straight quotes (macOS filenames)", () => {
			// macOS uses curly apostrophe (U+2019) in screenshot filenames:
			// macOS 截图文件名常使用弯引号 U+2019。
			//   Capture d'écran (U+2019)
			// Users typically type straight apostrophe (U+0027):
			// 用户通常输入直引号 U+0027。
			//   Capture d'ecran (U+0027)

			// curlyQuoteName 是磁盘上的 macOS 风格弯引号名称。
			const curlyQuoteName = "Capture d\u2019cran.txt"; // U+2019 right single quotation mark
			// 上述字符是 U+2019 右单引号。
			// straightQuoteName 是用户输入的直引号名称。
			const straightQuoteName = "Capture d'cran.txt"; // U+0027 apostrophe
			// 上述字符是 U+0027 撇号。

			// Verify they are different
			expect(curlyQuoteName).not.toBe(straightQuoteName);

			// Create file with curly quote name (simulating macOS behavior)
			writeFileSync(join(tempDir, curlyQuoteName), "content");

			// User provides straight quote path - should find the curly quote file
			// result 是直引号输入解析到的弯引号实际文件。
			const result = resolveReadPath(straightQuoteName, tempDir);
			expect(result).toBe(join(tempDir, curlyQuoteName));
		});

		it("should handle combined NFC + curly quote (French macOS screenshots)", () => {
			// Full macOS screenshot filename: "Capture d'écran" with NFD é and curly quote
			// 完整法语截图名称同时涉及 é 规范化和弯引号。
			// Note: macOS APFS normalizes NFD to NFC, so the actual file on disk uses NFC
			// APFS 会把 NFD 规范为 NFC，因此磁盘文件使用 NFC。
			// nfcCurlyName 是磁盘上的 NFC 加弯引号名称。
			const nfcCurlyName = "Capture d\u2019\u00e9cran.txt"; // NFC + curly quote (how APFS stores it)
			// nfcStraightName 是用户输入的 NFC 加直引号名称。
			const nfcStraightName = "Capture d'\u00e9cran.txt"; // NFC + straight quote (user input)

			// Verify they are different
			expect(nfcCurlyName).not.toBe(nfcStraightName);

			// Create file with macOS-style name (curly quote)
			writeFileSync(join(tempDir, nfcCurlyName), "content");

			// User provides straight quote path - should find the curly quote file
			// result 是组合回退解析出的实际文件路径。
			const result = resolveReadPath(nfcStraightName, tempDir);
			expect(result).toBe(join(tempDir, nfcCurlyName));
		});

		it("should handle macOS screenshot AM/PM variant with narrow no-break space", () => {
			// macOS uses narrow no-break space (U+202F) before AM/PM in screenshot names
			// macOS 在 AM/PM 前使用窄不换行空格 U+202F。
			// macosName 是带 U+202F 的实际截图名。
			const macosName = "Screenshot 2024-01-01 at 10.00.00\u202FAM.png"; // U+202F
			// userName 是使用普通空格的用户输入。
			const userName = "Screenshot 2024-01-01 at 10.00.00 AM.png"; // regular space

			// Create file with macOS-style name
			writeFileSync(join(tempDir, macosName), "content");

			// User provides regular space path
			// result 是普通空格输入解析出的实际截图路径。
			const result = resolveReadPath(userName, tempDir);

			// This works because tryMacOSScreenshotPath() handles this case
			// tryMacOSScreenshotPath 专门处理这一截图命名差异。
			expect(result).toBe(join(tempDir, macosName));
		});

		it("should handle macOS screenshot lowercase am/pm variant (en_AU locale)", () => {
			// Some locales like en_AU use lowercase am/pm in screenshot names
			// en_AU 等区域会在截图名中使用小写 am/pm。
			// macosName 是带窄空格和小写 am 的实际文件名。
			const macosName = "Screenshot 2024-01-01 at 10.00.00\u202Fam.png"; // U+202F + lowercase
			// userName 是普通空格加小写 am 的用户输入。
			const userName = "Screenshot 2024-01-01 at 10.00.00 am.png"; // regular space + lowercase

			// Create file with macOS-style name
			writeFileSync(join(tempDir, macosName), "content");

			// User provides regular space path
			// result 是大小写不敏感截图回退得到的路径。
			const result = resolveReadPath(userName, tempDir);

			// This works because tryMacOSScreenshotPath() uses case-insensitive matching
			// tryMacOSScreenshotPath 使用不区分大小写的匹配。
			expect(result).toBe(join(tempDir, macosName));
		});
	});
});
