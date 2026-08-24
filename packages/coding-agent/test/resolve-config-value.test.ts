/**
 * 文件职责：验证配置值解析支持字面量、环境变量模板、Shell 命令、缓存及 Windows stdin 传输。
 * 技术维度：使用 Vitest、临时计数文件、环境变量、Shell 模块模拟和配置解析缓存。
 * 产品维度：让用户可安全地从环境或命令取得密钥等配置，并控制命令执行次数与平台差异。
 * 逻辑维度：搭建隔离目录后依次测试模板、作用域、命令、失败、缓存、动态环境和 Windows 模拟。
 * 关键边界：命令用 ! 前缀、环境用 $ 前缀；成功和失败命令都会缓存，环境值不会缓存。
 * 新手阅读建议：先掌握三类输入前缀，再重点阅读缓存计数文件和最后的平台模拟用例。
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
	clearConfigValueCache,
	resolveConfigValue,
	resolveConfigValueUncached,
} from "../src/core/resolve-config-value.ts";
import * as shellModule from "../src/utils/shell.ts";

describe("resolveConfigValue", () => {
	// 当前用例命令计数文件所在的临时目录。
	let tempDir: string;

	// 功能：创建临时目录并清空解析缓存；参数：无；返回：无。示例：每个用例前自动调用。
	beforeEach(() => {
		tempDir = join(tmpdir(), `pi-config-value-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		mkdirSync(tempDir, { recursive: true });
		clearConfigValueCache();
	});

	// 功能：删除目录、清缓存并恢复模拟；参数：无；返回：无。示例：每个用例后自动调用。
	afterEach(() => {
		if (existsSync(tempDir)) rmSync(tempDir, { recursive: true });
		clearConfigValueCache();
		vi.restoreAllMocks();
	});

	test("resolves literals, environment templates, and escapes", () => {
		process.env.TEST_CONFIG_LEFT = "left";
		process.env.TEST_CONFIG_RIGHT = "right";
		try {
			expect(resolveConfigValue("literal-key")).toBe("literal-key");
			expect(resolveConfigValue("$TEST_CONFIG_LEFT")).toBe("left");
			expect(resolveConfigValue("$" + "{TEST_CONFIG_LEFT}_$TEST_CONFIG_RIGHT")).toBe("left_right");
			expect(resolveConfigValue("$$TEST_CONFIG_LEFT")).toBe("$TEST_CONFIG_LEFT");
			expect(resolveConfigValue("$!literal-$TEST_CONFIG_RIGHT")).toBe("!literal-right");
		} finally {
			delete process.env.TEST_CONFIG_LEFT;
			delete process.env.TEST_CONFIG_RIGHT;
		}
	});

	test("uses credential-scoped environment before process.env", () => {
		process.env.TEST_CONFIG_SCOPED = "process";
		try {
			expect(resolveConfigValue("$TEST_CONFIG_SCOPED", { TEST_CONFIG_SCOPED: "credential" })).toBe("credential");
		} finally {
			delete process.env.TEST_CONFIG_SCOPED;
		}
	});

	test("executes shell commands and trims their output", () => {
		expect(resolveConfigValue("!echo '  spaced-key  '")).toBe("spaced-key");
		expect(resolveConfigValue("!printf 'line1\\nline2'")).toBe("line1\nline2");
		expect(resolveConfigValue("!echo 'hello world' | tr ' ' '-'")).toBe("hello-world");
	});

	test.each(["!exit 1", "!nonexistent-command-12345", "!printf ''"])(
		"returns undefined when command resolution fails: %s",
		(command) => {
			expect(resolveConfigValue(command)).toBeUndefined();
		},
	);

	test("caches successful and failed commands until explicitly cleared", () => {
		// 记录 Shell 实际执行次数的文件。
		const counterFile = join(tempDir, "counter");
		writeFileSync(counterFile, "0");
		// 转成 Bash 可用正斜杠并转义双引号后的路径。
		const escapedPath = counterFile.replace(/\\/g, "/").replace(/"/g, '\\"');
		// 每次真实执行会递增计数并输出 value 的成功命令。
		const success = `!sh -c 'count=$(cat "${escapedPath}"); echo $((count + 1)) > "${escapedPath}"; echo value'`;

		expect(resolveConfigValue(success)).toBe("value");
		expect(resolveConfigValue(success)).toBe("value");
		expect(readFileSync(counterFile, "utf-8").trim()).toBe("1");

		clearConfigValueCache();
		expect(resolveConfigValue(success)).toBe("value");
		expect(readFileSync(counterFile, "utf-8").trim()).toBe("2");

		// 每次真实执行会递增计数后失败的命令。
		const failure = `!sh -c 'count=$(cat "${escapedPath}"); echo $((count + 1)) > "${escapedPath}"; exit 1'`;
		expect(resolveConfigValue(failure)).toBeUndefined();
		expect(resolveConfigValue(failure)).toBeUndefined();
		expect(readFileSync(counterFile, "utf-8").trim()).toBe("3");
	});

	test("does not cache environment values", () => {
		process.env.TEST_CONFIG_DYNAMIC = "first";
		try {
			expect(resolveConfigValue("$TEST_CONFIG_DYNAMIC")).toBe("first");
			process.env.TEST_CONFIG_DYNAMIC = "second";
			expect(resolveConfigValue("$TEST_CONFIG_DYNAMIC")).toBe("second");
		} finally {
			delete process.env.TEST_CONFIG_DYNAMIC;
		}
	});

	test("uncached resolution executes a command on every call", () => {
		// 无缓存场景的命令执行计数文件。
		const counterFile = join(tempDir, "uncached-counter");
		writeFileSync(counterFile, "0");
		// 适合嵌入 Bash 字符串的计数路径。
		const escapedPath = counterFile.replace(/\\/g, "/").replace(/"/g, '\\"');
		// 每次无缓存解析都会递增计数并输出 value 的命令。
		const command = `!sh -c 'count=$(cat "${escapedPath}"); echo $((count + 1)) > "${escapedPath}"; echo value'`;
		expect(resolveConfigValueUncached(command)).toBe("value");
		expect(resolveConfigValueUncached(command)).toBe("value");
		expect(readFileSync(counterFile, "utf-8").trim()).toBe("2");
	});

	test("uses stdin when the configured Windows shell requires it", () => {
		if (process.platform === "win32") return;
		// 原始 process.platform 属性描述符，用于 finally 恢复。
		const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");
		vi.spyOn(shellModule, "getShellConfig").mockReturnValue({
			shell: "/bin/bash",
			args: ["-s"],
			commandTransport: "stdin",
		});
		try {
			Object.defineProperty(process, "platform", { configurable: true, value: "win32" });
			// 避免模板字符串在测试源码阶段展开的 ${name} 文本。
			const expansion = "$" + "{name}";
			expect(resolveConfigValueUncached(`!name='World'; echo "Hello, ${expansion}!"`)).toBe("Hello, World!");
		} finally {
			if (platformDescriptor) Object.defineProperty(process, "platform", platformDescriptor);
		}
	});
});
