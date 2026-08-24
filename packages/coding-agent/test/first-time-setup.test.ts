/**
 * 文件职责：验证首次启动引导的触发条件以及分析统计开关和追踪标识的生命周期。
 * 技术维度：使用 Vitest、临时设置文件、环境变量隔离和内存 SettingsManager。
 * 产品维度：只在实验功能和默认配置场景展示引导，并让统计功能保持明确的用户选择。
 * 逻辑维度：第一组覆盖四种引导条件，第二组检查分析默认值、启用、禁用和再次启用。
 * 关键边界：测试会临时修改 PI_EXPERIMENTAL 与代理目录，并在 afterEach 中恢复。
 * 新手阅读建议：先看 beforeEach 的默认“应引导”环境，再逐个观察哪项条件使结果变为 false。
 */
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { shouldRunFirstTimeSetup } from "../src/cli/startup-ui.ts";
import { ENV_AGENT_DIR } from "../src/config.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";

describe("shouldRunFirstTimeSetup", () => {
	// originalPiExperimental 保存测试前实验功能环境值。
	const originalPiExperimental = process.env.PI_EXPERIMENTAL;
	// originalAgentDir 保存测试前代理目录环境值。
	const originalAgentDir = process.env[ENV_AGENT_DIR];
	// tempDir 是每个用例独享的临时设置目录。
	let tempDir: string;
	// settingsPath 是 tempDir 下的 settings.json 路径。
	let settingsPath: string;

	// 每例前创建无设置文件、启用实验功能且使用默认代理目录的环境；无参数，无返回值。
	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "pi-first-time-setup-"));
		settingsPath = join(tempDir, "settings.json");
		process.env.PI_EXPERIMENTAL = "1";
		delete process.env[ENV_AGENT_DIR];
	});

	// 每例后删除临时目录并恢复两个环境变量；无参数，无返回值。
	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
		if (originalPiExperimental === undefined) {
			delete process.env.PI_EXPERIMENTAL;
		} else {
			process.env.PI_EXPERIMENTAL = originalPiExperimental;
		}
		if (originalAgentDir === undefined) {
			delete process.env[ENV_AGENT_DIR];
		} else {
			process.env[ENV_AGENT_DIR] = originalAgentDir;
		}
	});

	// 验证全部首次引导条件满足时返回 true；无参数，无返回值。
	it("returns true when experimental, default agent dir, and no settings.json", () => {
		expect(shouldRunFirstTimeSetup(settingsPath)).toBe(true);
	});

	// 验证关闭实验功能时不运行首次引导；无参数，无返回值。
	it("returns false when experimental features are disabled", () => {
		delete process.env.PI_EXPERIMENTAL;

		expect(shouldRunFirstTimeSetup(settingsPath)).toBe(false);
	});

	// 验证自定义代理目录时不运行首次引导；无参数，无返回值。
	it("returns false when a custom agent dir is set", () => {
		process.env[ENV_AGENT_DIR] = tempDir;

		expect(shouldRunFirstTimeSetup(settingsPath)).toBe(false);
	});

	// 验证设置文件已存在时不重复运行首次引导；无参数，无返回值。
	it("returns false when settings.json already exists", () => {
		writeFileSync(settingsPath, "{}", "utf-8");

		expect(shouldRunFirstTimeSetup(settingsPath)).toBe(false);
	});
});

describe("analytics settings", () => {
	// 验证分析统计默认关闭且没有追踪标识；无参数，无返回值。
	it("defaults to disabled with no tracking identifier", () => {
		// manager 是没有初始设置的内存设置管理器。
		const manager = SettingsManager.inMemory();

		expect(manager.getEnableAnalytics()).toBe(false);
		expect(manager.getTrackingId()).toBeUndefined();
	});

	// 验证首次选择启用分析时生成 UUID 形式追踪标识；无参数，无返回值。
	it("generates a tracking identifier on opt-in", () => {
		// manager 是用于启用分析的独立内存设置管理器。
		const manager = SettingsManager.inMemory();

		manager.setEnableAnalytics(true);

		expect(manager.getEnableAnalytics()).toBe(true);
		expect(manager.getTrackingId()).toMatch(/^[0-9a-f-]{36}$/);
	});

	// 验证明确关闭分析不会生成追踪标识；无参数，无返回值。
	it("does not generate a tracking identifier on opt-out", () => {
		// manager 是用于显式关闭分析的独立内存设置管理器。
		const manager = SettingsManager.inMemory();

		manager.setEnableAnalytics(false);

		expect(manager.getEnableAnalytics()).toBe(false);
		expect(manager.getTrackingId()).toBeUndefined();
	});

	// 验证关闭后再次启用会复用原追踪标识；无参数，无返回值。
	it("keeps the tracking identifier when toggling analytics", () => {
		// manager 是用于连续切换分析开关的内存设置管理器。
		const manager = SettingsManager.inMemory();

		manager.setEnableAnalytics(true);
		// trackingId 保存首次启用时生成的标识，供再次启用后比较。
		const trackingId = manager.getTrackingId();
		manager.setEnableAnalytics(false);
		manager.setEnableAnalytics(true);

		expect(manager.getTrackingId()).toBe(trackingId);
	});
});
