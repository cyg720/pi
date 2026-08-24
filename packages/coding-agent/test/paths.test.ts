/**
 * 文件职责：验证路径工具对真实路径、符号链接、相对路径、文件 URL 和本地依赖标识的处理规则。
 * 技术维度：使用 Vitest 与 Node.js fs、os、path、url API，在临时目录中执行跨平台路径测试。
 * 产品维度：保障用户从命令行、配置和技能入口提供的路径能被安全、一致地定位到本地资源。
 * 逻辑维度：按 canonicalizePath、getCwdRelativePath、resolvePath 和 isLocalPath 四组能力组织用例。
 * 关键边界：符号链接权限和路径格式受操作系统影响；POSIX 与 Windows 专属断言会按平台跳过。
 * 新手阅读建议：先看 createTempDir 的隔离方式，再依次比较“规范化、解析、本地性判断”三个概念。
 */
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { canonicalizePath, getCwdRelativePath, isLocalPath, normalizePath, resolvePath } from "../src/utils/paths.ts";

// tempDir 保存当前用例创建的临时目录；空字符串表示没有待清理目录。
let tempDir: string;

// 每个用例结束后删除临时目录，防止测试文件残留到系统临时目录。
afterEach(() => {
	if (tempDir) {
		rmSync(tempDir, { recursive: true, force: true });
		tempDir = "";
	}
});

/**
 * 创建并记录一个带唯一后缀的测试临时目录。
 * @returns 新目录的绝对路径；例如用例可调用 `const dir = createTempDir()` 后写入文件。
 */
function createTempDir(): string {
	tempDir = mkdtempSync(join(tmpdir(), "pi-paths-"));
	return tempDir;
}

// 验证存在与不存在的路径在真实路径规范化过程中的差异。
describe("canonicalizePath", () => {
	// 普通文件应返回文件系统解析后的真实绝对路径。
	it("returns the real path for a regular file", () => {
		// dir 是当前用例独占的临时目录。
		const dir = createTempDir();
		// file 是实际创建并参与规范化的普通文件路径。
		const file = join(dir, "file.txt");
		writeFileSync(file, "hello");
		expect(canonicalizePath(file)).toBe(realpathSync(file));
	});

	// 文件符号链接应解析到其目标文件。
	it("resolves symlinks to their targets", () => {
		// dir 隔离保存目标文件和符号链接。
		const dir = createTempDir();
		// target 是符号链接指向的真实文件。
		const target = join(dir, "target.txt");
		// link 是提供给 canonicalizePath 的符号链接路径。
		const link = join(dir, "link.txt");
		writeFileSync(target, "hello");
		symlinkSync(target, link);
		expect(canonicalizePath(link)).toBe(realpathSync(target));
	});

	// 目录符号链接也应解析为目标目录的真实路径。
	it("resolves directory symlinks", () => {
		// dir 是本用例的临时父目录。
		const dir = createTempDir();
		// targetDir 是链接指向的真实目录。
		const targetDir = join(dir, "target-dir");
		// linkDir 是待解析的目录符号链接。
		const linkDir = join(dir, "link-dir");
		mkdirSync(targetDir);
		symlinkSync(targetDir, linkDir, "dir");
		expect(canonicalizePath(linkDir)).toBe(realpathSync(targetDir));
	});

	// 不存在的目标无法调用 realpath，应保留调用者给出的原路径。
	it("falls back to the raw path when the target does not exist", () => {
		// dir 提供不存在路径的临时父目录。
		const dir = createTempDir();
		// nonexistent 是刻意不创建的目标路径。
		const nonexistent = join(dir, "no-such-file");
		expect(canonicalizePath(nonexistent)).toBe(nonexistent);
	});

	// 悬空链接的目标不存在，因此也应回退到链接本身。
	it("falls back to the raw path for a dangling symlink", () => {
		// dir 隔离保存悬空符号链接。
		const dir = createTempDir();
		// target 是刻意不创建的链接目标。
		const target = join(dir, "target.txt");
		// link 是存在但无法解析目标的符号链接。
		const link = join(dir, "link.txt");
		// Create a symlink whose target does not exist.
		// 创建目标不存在的符号链接，用于触发 realpath 失败分支。
		symlinkSync(target, link);
		// realpathSync would throw, so canonicalizePath returns the link path.
		// realpathSync 会抛错，因此 canonicalizePath 应返回原始链接路径。
		expect(canonicalizePath(link)).toBe(link);
	});
});

// 验证绝对路径只有在工作目录内部时才会转换为安全的相对路径。
describe("getCwdRelativePath", () => {
	// 以两个点开头但不是父目录段的名称应被视为普通文件名。
	it("keeps cwd-relative names that start with dots", () => {
		// cwd 模拟调用者当前工作目录。
		const cwd = join(tmpdir(), "pi-paths-cwd");
		expect(getCwdRelativePath(join(cwd, "..config", "AGENTS.md"), cwd)).toBe(join("..config", "AGENTS.md"));
	});

	// 真正越过工作目录边界的父级遍历应返回 undefined。
	it("rejects parent-directory traversals", () => {
		// cwd 是用于判断越界的基准目录。
		const cwd = join(tmpdir(), "pi-paths-cwd");
		expect(getCwdRelativePath(join(cwd, "..", "AGENTS.md"), cwd)).toBeUndefined();
	});
});

// 验证用户输入路径和 file URL 转换为本机绝对路径的规则。
describe("resolvePath", () => {
	// 仅独立的波浪号或 `~/` 前缀代表用户主目录，普通名称不展开。
	it("expands only home tilde shortcuts", () => {
		// cwd 是解析非主目录相对路径时的基准目录。
		const cwd = join(tmpdir(), "pi-paths-cwd");
		expect(normalizePath("~")).toBe(homedir());
		expect(normalizePath("~/file.txt")).toBe(join(homedir(), "file.txt"));
		expect(resolvePath("~draft.md", cwd)).toBe(resolve(cwd, "~draft.md"));
		expect(normalizePath("~draft.md")).toBe("~draft.md");
	});

	// 相对路径应基于字符串目录或 file URL 形式的目录解析。
	it("resolves relative paths against the base directory", () => {
		// cwd 同时作为普通路径和 file URL 两种基准输入。
		const cwd = join(tmpdir(), "pi-paths-cwd");
		expect(resolvePath("subdir/file.txt", cwd)).toBe(resolve(cwd, "subdir/file.txt"));
		expect(resolvePath("subdir/file.txt", pathToFileURL(cwd).href)).toBe(resolve(cwd, "subdir/file.txt"));
	});

	// 完整 file URL 应解码为空格等字符并转换为本机路径。
	it("accepts file URLs", () => {
		// dir 是构造带空格路径的临时目录。
		const dir = createTempDir();
		// filePath 是预期解析结果，不要求文件实际存在。
		const filePath = join(dir, "file with spaces.txt");
		expect(resolvePath(pathToFileURL(filePath).href, join(dir, "base"))).toBe(resolve(filePath));
	});

	// 百分号编码不完整的 file URL 必须抛出错误而不是静默误解析。
	it("throws for invalid file URLs", () => {
		expect(() => resolvePath("file:///%E0%A4%A")).toThrow();
	});

	// POSIX 绝对路径中的百分号序列是文件名文本，不应误当成 URL 编码。
	it("preserves POSIX absolute paths with literal percent sequences", () => {
		if (process.platform === "win32") {
			return;
		}

		// dir 是包含各类百分号文件名的临时父目录。
		const dir = createTempDir();
		// filePath 逐个表示合法、类似转义和格式不完整的百分号文件名。
		for (const filePath of [join(dir, "report%2026.md"), join(dir, "foo%2Fbar"), join(dir, "malformed%A.md")]) {
			expect(resolvePath(filePath, join(dir, "base"))).toBe(resolve(filePath));
		}
	});

	// Windows file URL 的 pathname 字符串不能再次按原生盘符路径解释。
	it("does not treat Windows file URL pathname strings as native paths", () => {
		if (process.platform !== "win32") {
			return;
		}

		// dir 是构造 Windows file URL 的临时目录。
		const dir = createTempDir();
		// filePath 是带盘符的预期本机路径。
		const filePath = join(dir, "dir", "SKILL.md");
		// pathname 是 URL 对象暴露的 `/C:/...` 风格路径部分，并非本机绝对路径。
		const pathname = pathToFileURL(filePath).pathname;
		expect(pathname).toMatch(/^\/[A-Za-z]:/);
		expect(resolvePath(pathname, "E:\\project")).toBe(resolve(pathname));
	});
});

// 验证包名、文件路径和远程协议在本地资源判断中的分类。
describe("isLocalPath", () => {
	// 无协议的普通名称按本地引用处理。
	it("returns true for bare names", () => {
		expect(isLocalPath("my-package")).toBe(true);
	});

	// 点号开头的相对路径属于本地文件系统。
	it("returns true for relative paths", () => {
		expect(isLocalPath("./foo")).toBe(true);
	});

	// file 协议明确指向本地文件系统资源。
	it("returns true for file URLs", () => {
		expect(isLocalPath("file:///tmp/foo")).toBe(true);
	});

	// npm 协议描述包管理器资源，不是直接本地路径。
	it("returns false for npm: protocol", () => {
		expect(isLocalPath("npm:package")).toBe(false);
	});

	// git 协议描述远程仓库资源，不是本地路径。
	it("returns false for git: protocol", () => {
		expect(isLocalPath("git://repo")).toBe(false);
	});

	// HTTPS 地址是远程网络资源，应返回 false。
	it("returns false for https: protocol", () => {
		expect(isLocalPath("https://example.com")).toBe(false);
	});
});
