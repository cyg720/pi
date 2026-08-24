/**
 * 文件职责：验证 Git 依赖地址解析对协议 URL、显式 git 简写和危险路径的接受规则。
 * 技术维度：使用 Vitest 和 parseGitUrl 纯函数覆盖 HTTPS、SSH、引用版本与路径校验。
 * 产品维度：支持常见仓库安装地址，同时阻止目录穿越、绝对路径和非法字节造成安全风险。
 * 逻辑维度：按协议地址、git 前缀简写、危险输入和无前缀简写四组断言解析结果。
 * 关键边界：简写只有带 `git:` 前缀才被接受；危险路径一律返回 null 而不是尝试修正。
 * 新手阅读建议：先比较同一仓库的协议与简写结果，再阅读危险输入列表理解安全边界。
 */
import { describe, expect, it } from "vitest";
import { parseGitUrl } from "../src/utils/git.ts";

describe("Git URL Parsing", () => {
	describe("protocol URLs (accepted without git: prefix)", () => {
		// 验证普通 HTTPS 地址解析为主机、路径和规范仓库地址；无参数，无返回值。
		it("should parse HTTPS URL", () => {
			// result 是 HTTPS 地址的结构化解析结果。
			const result = parseGitUrl("https://github.com/user/repo");
			expect(result).toMatchObject({
				host: "github.com",
				path: "user/repo",
				repo: "https://github.com/user/repo",
			});
		});

		// 验证带用户信息的 ssh:// 地址保持 SSH 仓库形式；无参数，无返回值。
		it("should parse ssh:// URL", () => {
			// result 是 SSH 协议地址的结构化解析结果。
			const result = parseGitUrl("ssh://git@github.com/user/repo");
			expect(result).toMatchObject({
				host: "github.com",
				path: "user/repo",
				repo: "ssh://git@github.com/user/repo",
			});
		});

		// 验证协议地址尾部的 @ref 被分离为版本引用；无参数，无返回值。
		it("should parse protocol URL with ref", () => {
			// result 是包含 v1.0.0 引用的 HTTPS 解析结果。
			const result = parseGitUrl("https://github.com/user/repo@v1.0.0");
			expect(result).toMatchObject({
				host: "github.com",
				path: "user/repo",
				ref: "v1.0.0",
				repo: "https://github.com/user/repo",
			});
		});
	});

	describe("shorthand URLs (accepted only with git: prefix)", () => {
		// 验证显式 git: 前缀允许 SCP 风格 SSH 简写；无参数，无返回值。
		it("should parse git@host:path with git: prefix", () => {
			// result 是去除 git: 标记后的 SCP 风格解析结果。
			const result = parseGitUrl("git:git@github.com:user/repo");
			expect(result).toMatchObject({
				host: "github.com",
				path: "user/repo",
				repo: "git@github.com:user/repo",
			});
		});

		// 验证带 git: 的 host/path 简写规范化为 HTTPS；无参数，无返回值。
		it("should parse host/path shorthand with git: prefix", () => {
			// result 是主机路径简写的结构化解析结果。
			const result = parseGitUrl("git:github.com/user/repo");
			expect(result).toMatchObject({
				host: "github.com",
				path: "user/repo",
				repo: "https://github.com/user/repo",
			});
		});

		// 验证 SCP 简写尾部引用能被正确拆分；无参数，无返回值。
		it("should parse shorthand with ref and git: prefix", () => {
			// result 是包含版本引用的 SCP 风格解析结果。
			const result = parseGitUrl("git:git@github.com:user/repo@v1.0.0");
			expect(result).toMatchObject({
				host: "github.com",
				path: "user/repo",
				ref: "v1.0.0",
				repo: "git@github.com:user/repo",
			});
		});
	});

	// 验证目录穿越、绝对路径、反斜杠和空字节输入全部被拒绝；无参数，无返回值。
	it("should reject unsafe git install path inputs", () => {
		// source 是当前危险 Git 地址样例。
		for (const source of [
			"git:git@evil.example:../../victim/repo",
			"https://evil.example/..%2F..%2Fvictim/repo",
			"https://evil.example/..%2F..%2Fvictim/repo%",
			"git:git@evil.example:/absolute/repo",
			"git:git@evil.example:user\\repo/name",
			"git:git@evil.example:user/repo\0name",
		]) {
			expect(parseGitUrl(source)).toBeNull();
		}
	});

	describe("unsupported without git: prefix", () => {
		// 验证无 git: 标记的 SCP 风格地址被拒绝；无参数，无返回值。
		it("should reject git@host:path without git: prefix", () => {
			expect(parseGitUrl("git@github.com:user/repo")).toBeNull();
		});

		// 验证无 git: 标记的 host/path 简写被拒绝；无参数，无返回值。
		it("should reject host/path shorthand without git: prefix", () => {
			expect(parseGitUrl("github.com/user/repo")).toBeNull();
		});

		// 验证缺少主机的 user/repo 简写被拒绝；无参数，无返回值。
		it("should reject user/repo shorthand", () => {
			expect(parseGitUrl("user/repo")).toBeNull();
		});
	});
});
