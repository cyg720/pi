/**
 * 文件职责：回归验证内存设置管理器在直接或资源加载器触发 reload 后保留初始配置。
 * 技术维度：使用 Vitest、临时代理目录、SettingsManager.inMemory 和 DefaultResourceLoader。
 * 产品维度：保证嵌入式调用方提供的运行时设置不会因资源刷新而意外恢复默认值。
 * 逻辑维度：创建临时目录，分别执行直接 reload、资源 reload 和 setter/flush/reload 后断言。
 * 关键边界：测试禁用扩展、技能、模板、主题和上下文加载；临时目录在每例后递归删除。
 * 新手阅读建议：先比较三个 settingsManager 初始对象，再观察 reload 入口不同而期望保持一致。
 */
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DefaultResourceLoader } from "../../../src/core/resource-loader.ts";
import { SettingsManager } from "../../../src/core/settings-manager.ts";

describe("regression #3616: in-memory settings survive reload", () => {
	// tempDir 是每个用例独享的临时项目根目录。
	let tempDir: string;
	// agentDir 是 tempDir 下的代理配置目录。
	let agentDir: string;

	// 每个用例前创建唯一临时代理目录；无参数，无返回值。
	beforeEach(() => {
		tempDir = join(tmpdir(), `pi-settings-inmemory-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		agentDir = join(tempDir, "agent");
		mkdirSync(agentDir, { recursive: true });
	});

	// 每个用例后安全删除已创建的临时根目录；无参数，无返回值。
	afterEach(() => {
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	// 验证内存设置直接 reload 后所有初始值保持不变；无参数，无返回值。
	it("preserves initial settings after direct reload", async () => {
		// settingsManager 是含思考、图片和压缩初始值的内存管理器。
		const settingsManager = SettingsManager.inMemory({
			defaultThinkingLevel: "high",
			images: { autoResize: false },
			compaction: { enabled: false },
		});

		await settingsManager.reload();

		expect(settingsManager.getDefaultThinkingLevel()).toBe("high");
		expect(settingsManager.getImageAutoResize()).toBe(false);
		expect(settingsManager.getCompactionEnabled()).toBe(false);
		expect(settingsManager.getGlobalSettings()).toEqual({
			defaultThinkingLevel: "high",
			images: { autoResize: false },
			compaction: { enabled: false },
		});
	});

	// 验证资源加载器 reload 不会覆盖注入的内存设置；无参数，无返回值。
	it("preserves initial settings when DefaultResourceLoader reloads", async () => {
		// settingsManager 是交给资源加载器复用的内存设置管理器。
		const settingsManager = SettingsManager.inMemory({
			defaultThinkingLevel: "high",
			images: { autoResize: false },
			compaction: { enabled: false },
		});
		// resourceLoader 仅启用设置刷新，关闭其他所有资源类型。
		const resourceLoader = new DefaultResourceLoader({
			cwd: tempDir,
			agentDir,
			settingsManager,
			noExtensions: true,
			noSkills: true,
			noPromptTemplates: true,
			noThemes: true,
			noContextFiles: true,
		});

		await resourceLoader.reload();

		expect(settingsManager.getDefaultThinkingLevel()).toBe("high");
		expect(settingsManager.getImageAutoResize()).toBe(false);
		expect(settingsManager.getCompactionEnabled()).toBe(false);
	});

	// 验证无关 setter 与 flush/reload 不会丢失其他初始内存字段；无参数，无返回值。
	it("preserves initial settings after an unrelated setter, flush, and reload", async () => {
		// settingsManager 初始只关闭图片缩放和压缩，稍后另设主题。
		const settingsManager = SettingsManager.inMemory({
			images: { autoResize: false },
			compaction: { enabled: false },
		});

		settingsManager.setTheme("dark");
		await settingsManager.flush();
		await settingsManager.reload();

		expect(settingsManager.getTheme()).toBe("dark");
		expect(settingsManager.getImageAutoResize()).toBe(false);
		expect(settingsManager.getCompactionEnabled()).toBe(false);
		expect(settingsManager.getGlobalSettings()).toEqual({
			images: { autoResize: false },
			compaction: { enabled: false },
			theme: "dark",
		});
	});
});
