/**
 * 文件职责：验证分叉发行版不会运行官方包专属的首次设置流程。
 * 技术维度：使用 Vitest 模块模拟、临时目录和环境变量隔离 PACKAGE_NAME 判断。
 * 产品维度：避免第三方分叉包错误展示官方引导或修改不适用的用户配置。
 * 逻辑维度：模拟不同包名，每例创建设置路径并启用实验功能，断言仍不运行首次设置，最后清理。
 * 关键边界：测试会临时修改 PI_EXPERIMENTAL 并递归删除自身临时目录；必须在 afterEach 恢复。
 * 新手阅读建议：先看 vi.mock 如何只替换 PACKAGE_NAME，再理解环境变量为何不能改变分叉判断结果。
 */
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** 用分叉包名替换配置模块，其余真实导出保持不变。 */
vi.mock("../src/config.ts", async (importOriginal) => {
	/** 原配置模块的全部导出，类型保守为未知记录。 */
	const actual = await importOriginal();
	return {
		...(actual as Record<string, unknown>),
		PACKAGE_NAME: "@example/pi-coding-agent",
	};
});

import { shouldRunFirstTimeSetup } from "../src/cli/startup-ui.ts";

/** 分叉发行版首次设置判断测试组。 */
describe("shouldRunFirstTimeSetup in forked distributions", () => {
	/** 测试开始前 PI_EXPERIMENTAL 的原值；可能未定义，结束时必须精确恢复。 */
	const originalPiExperimental = process.env.PI_EXPERIMENTAL;
	/** 当前用例创建的唯一临时目录路径，由 beforeEach 赋值。 */
	let tempDir: string;
	/** 临时目录中的 settings.json 路径，文件不必真实存在。 */
	let settingsPath: string;

	/** 每例创建隔离路径并启用实验功能，证明跳过原因确实是分叉包名。 */
	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "pi-first-time-setup-fork-"));
		settingsPath = join(tempDir, "settings.json");
		process.env.PI_EXPERIMENTAL = "1";
	});

	/** 删除当前临时目录，并把 PI_EXPERIMENTAL 恢复为运行测试前的状态。 */
	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
		if (originalPiExperimental === undefined) {
			delete process.env.PI_EXPERIMENTAL;
		} else {
			process.env.PI_EXPERIMENTAL = originalPiExperimental;
		}
	});

	/** 验证包名不是官方名称时，即使实验功能开启且无设置文件也返回 false。 */
	it("returns false for a forked package", () => {
		expect(shouldRunFirstTimeSetup(settingsPath)).toBe(false);
	});
});
