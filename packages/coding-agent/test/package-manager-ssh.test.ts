/**
 * 文件职责：验证包管理器对 HTTPS、SSH 和 git 前缀简写来源的解析与身份归一化。
 * 技术维度：使用 Vitest、临时目录和内存设置管理器，对内部解析方法进行针对性断言。
 * 产品维度：确保用户用不同 Git 地址安装同一扩展时能获得一致、可预测的包身份。
 * 逻辑维度：每个用例创建隔离包管理器，按 URL 类型验证解析字段，最后比较规范化身份。
 * 关键边界：没有 git: 前缀的 SCP 风格和 host/path 简写按本地路径处理；测试不访问网络。
 * 新手阅读建议：依次阅读协议 URL、git 简写、无前缀边界和身份归一化四组测试。
 */
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DefaultPackageManager } from "../src/core/package-manager.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";

describe("Package Manager git source parsing", () => {
	// 当前测试的临时工作目录；仅在 beforeEach 到 afterEach 之间有效。
	let tempDir: string;
	// 模拟代理配置目录，作为包管理器的 agentDir 参数。
	let agentDir: string;
	// 内存设置管理器，避免测试读取用户配置文件。
	let settingsManager: SettingsManager;
	// 被测默认包管理器实例；每个用例重新创建。
	let packageManager: DefaultPackageManager;

	// 功能：为每个测试创建隔离目录与包管理器；参数：无；返回：无。示例：由 Vitest 自动调用。
	beforeEach(() => {
		tempDir = join(tmpdir(), `pm-ssh-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		mkdirSync(tempDir, { recursive: true });
		agentDir = join(tempDir, "agent");
		mkdirSync(agentDir, { recursive: true });

		settingsManager = SettingsManager.inMemory();
		packageManager = new DefaultPackageManager({
			cwd: tempDir,
			agentDir,
			settingsManager,
		});
	});

	// 功能：删除本用例临时目录；参数：无；返回：无。示例：由 Vitest 在用例结束后调用。
	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	describe("protocol URLs without git: prefix", () => {
		it("should parse https:// URL", () => {
			// HTTPS 来源的解析结果；应被识别为 Git 仓库。
			const parsed = (packageManager as any).parseSource("https://github.com/user/repo");
			expect(parsed.type).toBe("git");
			expect(parsed.host).toBe("github.com");
			expect(parsed.path).toBe("user/repo");
		});

		it("should parse ssh:// URL", () => {
			// SSH 协议来源的解析结果；repo 字段需保留完整地址。
			const parsed = (packageManager as any).parseSource("ssh://git@github.com/user/repo");
			expect(parsed.type).toBe("git");
			expect(parsed.host).toBe("github.com");
			expect(parsed.path).toBe("user/repo");
			expect(parsed.repo).toBe("ssh://git@github.com/user/repo");
		});
	});

	describe("shorthand URLs with git: prefix", () => {
		it("should parse git@host:path format", () => {
			// 带 git: 标记的 SCP 风格来源；没有版本引用时 pinned 为 false。
			const parsed = (packageManager as any).parseSource("git:git@github.com:user/repo");
			expect(parsed.type).toBe("git");
			expect(parsed.host).toBe("github.com");
			expect(parsed.path).toBe("user/repo");
			expect(parsed.repo).toBe("git@github.com:user/repo");
			expect(parsed.pinned).toBe(false);
		});

		it("should parse host/path shorthand", () => {
			// 带 git: 标记的 host/path 简写解析结果。
			const parsed = (packageManager as any).parseSource("git:github.com/user/repo");
			expect(parsed.type).toBe("git");
			expect(parsed.host).toBe("github.com");
			expect(parsed.path).toBe("user/repo");
		});

		it("should parse shorthand with ref", () => {
			// 包含 @ref 的简写解析结果；明确版本应标记为 pinned。
			const parsed = (packageManager as any).parseSource("git:git@github.com:user/repo@v1.0.0");
			expect(parsed.type).toBe("git");
			expect(parsed.ref).toBe("v1.0.0");
			expect(parsed.pinned).toBe(true);
		});
	});

	describe("unsupported without git: prefix", () => {
		it("should treat git@host:path as local without git: prefix", () => {
			// 无 git: 前缀的 SCP 风格输入；按产品约定视为本地来源。
			const parsed = (packageManager as any).parseSource("git@github.com:user/repo");
			expect(parsed.type).toBe("local");
		});

		it("should treat host/path shorthand as local without git: prefix", () => {
			// 无 git: 前缀的 host/path 输入；避免把普通相对路径误判为远程仓库。
			const parsed = (packageManager as any).parseSource("github.com/user/repo");
			expect(parsed.type).toBe("local");
		});
	});

	describe("identity normalization", () => {
		it("should normalize protocol and shorthand-prefixed URLs to same identity", () => {
			// git: SCP 简写归一化后的身份。
			const prefixed = (packageManager as any).getPackageIdentity("git:git@github.com:user/repo");
			// HTTPS 地址归一化后的身份。
			const https = (packageManager as any).getPackageIdentity("https://github.com/user/repo");
			// SSH 协议地址归一化后的身份。
			const ssh = (packageManager as any).getPackageIdentity("ssh://git@github.com/user/repo");

			expect(prefixed).toBe("git:github.com/user/repo");
			expect(prefixed).toBe(https);
			expect(prefixed).toBe(ssh);
		});
	});
});
