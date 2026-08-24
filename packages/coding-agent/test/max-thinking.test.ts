/**
 * 文件职责：验证 max 思考等级可被 CLI、设置和旧版主题兼容处理。
 * 技术维度：使用 Vitest、内存设置、临时主题 JSON 和文件系统路径操作。
 * 产品维度：让用户选择最高思考强度，并确保旧主题仍可显示对应边框。
 * 逻辑维度：一例检查参数和设置，另一例删除主题新字段后验证回退到 xhigh。
 * 关键边界：测试会创建并删除系统临时目录；旧主题回退仅验证边框颜色。
 * 新手阅读建议：先看设置用例，再看第二例如何人工构造缺字段的旧主题。
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { isValidThinkingLevel } from "../src/cli/args.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";
import { loadThemeFromPath } from "../src/modes/interactive/theme/theme.ts";

/** 本文件创建的临时目录清单，每例后全部删除。 */
const tempDirs: string[] = [];

/** 清理所有由当前测试文件登记的临时目录。 */
afterEach(() => {
	// dir 均由本文件在系统临时目录中创建。
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

/** max 思考等级兼容性测试组。 */
describe("max thinking level", () => {
	/** 验证 CLI 接受 max，设置管理器也能保存并读回。 */
	it("is accepted by CLI and settings", async () => {
		expect(isValidThinkingLevel("max")).toBe(true);

		/** 不写磁盘的设置管理器。 */
		const settings = SettingsManager.inMemory();
		settings.setDefaultThinkingLevel("max");
		await settings.flush();
		expect(settings.getDefaultThinkingLevel()).toBe("max");
	});

	/** 验证旧主题缺少 thinkingMax 时复用 thinkingXhigh 配色。 */
	it("falls back to thinkingXhigh for legacy themes", () => {
		/** 本例专属的临时主题目录。 */
		const testDir = mkdtempSync(join(tmpdir(), "pi-max-theme-"));
		tempDirs.push(testDir);
		/** 当前测试文件目录，用于定位内置暗色主题。 */
		const currentDir = dirname(fileURLToPath(import.meta.url));
		/** 从 dark.json 解析出的可编辑主题对象。 */
		const darkTheme = JSON.parse(
			readFileSync(join(currentDir, "../src/modes/interactive/theme/dark.json"), "utf8"),
		) as { name: string; colors: Record<string, unknown> };
		darkTheme.name = "legacy-theme";
		delete darkTheme.colors.thinkingMax;
		/** 模拟旧版主题的临时文件路径。 */
		const themePath = join(testDir, "legacy-theme.json");
		writeFileSync(themePath, JSON.stringify(darkTheme));

		/** 从缺少 thinkingMax 的文件加载出的主题。 */
		const legacyTheme = loadThemeFromPath(themePath);
		expect(legacyTheme.getThinkingBorderColor("max")("border")).toBe(
			legacyTheme.getThinkingBorderColor("xhigh")("border"),
		);
	});
});
