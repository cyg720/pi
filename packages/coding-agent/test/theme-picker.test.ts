/**
 * 文件职责：验证主题选择器使用 JSON 内容中的 name，而不是主题文件名。
 * 技术维度：使用 Vitest、环境变量替身、临时主题目录和真实主题发现函数。
 * 产品维度：用户可自由命名主题文件，界面仍显示主题声明的正式名称。
 * 逻辑维度：每例创建代理目录，写入文件名 foo、内容名 bar 的主题并检查发现结果。
 * 关键边界：测试修改 PI_CODING_AGENT_DIR 并删除临时目录，结束时必须恢复环境。
 * 新手阅读建议：重点比较 foo.json、customTheme.name 和最终返回的 bar。
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	getAvailableThemes,
	getAvailableThemesWithPaths,
	setRegisteredThemes,
} from "../src/modes/interactive/theme/theme.ts";

/** 测试读写的主题 JSON 最小结构。 */
type ThemeFile = {
	/** 选择器显示名称。 */
	name: string;
	/** 可选主题变量。 */
	vars?: Record<string, string | number>;
	/** 颜色键值表。 */
	colors: Record<string, string | number>;
};

/** 主题选择器测试组。 */
describe("theme picker", () => {
	/** 当前测试组的临时根目录。 */
	let tempRoot: string;

	/** 创建隔离代理目录、替换环境变量并清空注册主题。 */
	beforeEach(() => {
		tempRoot = mkdtempSync(join(tmpdir(), "pi-theme-picker-"));
		/** 模拟的 PI 代理配置目录。 */
		const agentDir = join(tempRoot, "agent");
		vi.stubEnv("PI_CODING_AGENT_DIR", agentDir);
		mkdirSync(join(agentDir, "themes"), { recursive: true });
		setRegisteredThemes([]);
	});

	/** 恢复注册表、删除临时目录并取消环境替身。 */
	afterEach(() => {
		setRegisteredThemes([]);
		rmSync(tempRoot, { recursive: true, force: true });
		vi.unstubAllEnvs();
	});

	/** 验证内容名 bar 可见，文件名 foo 不会成为主题名。 */
	it("uses custom theme content names instead of file names", () => {
		/** 内置暗色主题的可编辑对象。 */
		const darkTheme = JSON.parse(
			readFileSync(new URL("../src/modes/interactive/theme/dark.json", import.meta.url), "utf-8"),
		) as ThemeFile;
		/** 名称改为 bar 的自定义主题。 */
		const customTheme: ThemeFile = {
			...darkTheme,
			name: "bar",
		};

		/** 文件名故意为 foo.json 的自定义主题路径。 */
		const themePath = join(process.env.PI_CODING_AGENT_DIR!, "themes", "foo.json");
		writeFileSync(themePath, JSON.stringify(customTheme, null, 2));

		expect(getAvailableThemes()).toContain("bar");
		expect(getAvailableThemes()).not.toContain("foo");
		expect(getAvailableThemesWithPaths()).toContainEqual({ name: "bar", path: themePath });
		// theme 是发现结果，文件名 foo 不应出现在 name 字段。
		expect(getAvailableThemesWithPaths().some((theme) => theme.name === "foo")).toBe(false);
	});
});
