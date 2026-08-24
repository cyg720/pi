/**
 * 文件职责：回归验证 SettingsManager 保存无关字段时不会覆盖用户在磁盘上外部修改的数组设置。
 * 技术维度：使用 Vitest、真实用户/项目 settings.json、异步 flush 和字段级脏状态追踪。
 * 产品维度：防止用户手工编辑 packages、extensions 或 prompts 后，被界面中的另一项设置修改悄悄回滚。
 * 逻辑维度：创建配置，启动管理器，外部改写磁盘，再改无关或同一字段并检查最终合并结果。
 * 关键边界：只有会话内显式修改的字段覆盖磁盘；同字段内存修改应胜出，无关外部字段应保留。
 * 新手阅读建议：先读英文 bug 四步及中文说明，再比较“无关字段保留”与“同字段内存覆盖”两类用例。
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SettingsManager } from "../src/core/settings-manager.ts";

/**
 * Tests for the fix to a bug where external file changes to arrays were overwritten.
 *
 * The bug scenario was:
 * 1. Pi starts with settings.json containing packages: ["npm:some-pkg"]
 * 2. User externally edits file to packages: []
 * 3. User changes an unrelated setting (e.g., theme) via UI
 * 4. save() would overwrite packages back to ["npm:some-pkg"] from stale in-memory state
 *
 * The fix tracks which fields were explicitly modified during the session, and only
 * those fields override file values during save().
 * 中文说明：修复通过追踪会话内明确修改的字段，只让这些字段在保存时覆盖最新磁盘值。
 */
describe("SettingsManager - External Edit Preservation", () => {
	// 本测试固定的临时根目录。
	const testDir = join(process.cwd(), "test-settings-bug-tmp");
	// 用户级代理配置目录。
	const agentDir = join(testDir, "agent");
	// 项目目录，项目设置位于其 .pi 子目录。
	const projectDir = join(testDir, "project");

	// 功能：重建用户和项目配置目录；参数：无；返回：无。示例：每个用例前自动调用。
	beforeEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
		mkdirSync(agentDir, { recursive: true });
		mkdirSync(join(projectDir, ".pi"), { recursive: true });
	});

	// 功能：删除固定测试目录；参数：无；返回：无。示例：每个用例后自动调用。
	afterEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
	});

	it("should preserve file changes to packages array when changing unrelated setting", async () => {
		// 用户级 settings.json 路径。
		const settingsPath = join(agentDir, "settings.json");

		// Initial state: packages has one item
		// 中文说明：初始 packages 数组包含一个 npm 包。
		writeFileSync(
			settingsPath,
			JSON.stringify({
				theme: "dark",
				packages: ["npm:pi-mcp-adapter"],
			}),
		);

		// Pi starts up, loads settings into memory
		// 中文说明：管理器启动时把初始设置读入内存。
		// 已加载旧 packages 值的设置管理器。
		const manager = SettingsManager.create(projectDir, agentDir);

		// At this point, globalSettings.packages = ["npm:pi-mcp-adapter"]
		// 中文说明：此时内存仍保留启动时的 packages 值。
		expect(manager.getPackages()).toEqual(["npm:pi-mcp-adapter"]);

		// User externally edits settings.json to remove the package
		// 中文说明：模拟用户在进程外把 packages 清空。
		// 从磁盘读取的可变当前设置对象。
		const currentSettings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		currentSettings.packages = []; // User wants to remove this!
		writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 2));

		// Verify file was changed
		// 中文说明：先确认外部写入确实落盘。
		expect(JSON.parse(readFileSync(settingsPath, "utf-8")).packages).toEqual([]);

		// User changes an UNRELATED setting via UI (this triggers save)
		// 中文说明：界面只修改无关 theme 字段并触发保存。
		manager.setTheme("light");
		await manager.flush();

		// With the fix, packages should be preserved as [] (not reverted to startup value)
		// 中文说明：修复后 packages 应保持磁盘空数组，不回退旧内存值。
		// flush 后重新读取的设置对象。
		const savedSettings = JSON.parse(readFileSync(settingsPath, "utf-8"));

		expect(savedSettings.packages).toEqual([]);
		expect(savedSettings.theme).toBe("light");
	});

	it("should preserve file changes to extensions array when changing unrelated setting", async () => {
		// 第二个用户设置场景的 settings.json 路径。
		const settingsPath = join(agentDir, "settings.json");

		writeFileSync(
			settingsPath,
			JSON.stringify({
				theme: "dark",
				extensions: ["/old/extension.ts"],
			}),
		);

		// 启动时加载旧 extensions 的管理器。
		const manager = SettingsManager.create(projectDir, agentDir);

		// User externally updates extensions
		// 中文说明：模拟用户从外部替换 extensions 数组。
		// 外部修改前读取的设置对象。
		const currentSettings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		currentSettings.extensions = ["/new/extension.ts"];
		writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 2));

		// Change unrelated setting
		// 中文说明：只修改无关的默认思考级别并保存。
		manager.setDefaultThinkingLevel("high");
		await manager.flush();

		// 保存后重新读取的用户设置。
		const savedSettings = JSON.parse(readFileSync(settingsPath, "utf-8"));

		// With the fix, extensions should be preserved (not reverted to startup value)
		// 中文说明：修复后外部 extensions 值必须保留。
		expect(savedSettings.extensions).toEqual(["/new/extension.ts"]);
	});

	it("should preserve external project settings changes when updating unrelated project field", async () => {
		// 项目级 settings.json 路径。
		const projectSettingsPath = join(projectDir, ".pi", "settings.json");
		writeFileSync(
			projectSettingsPath,
			JSON.stringify({
				extensions: ["./old-extension.ts"],
				prompts: ["./old-prompt.md"],
			}),
		);

		// 加载项目初始设置的管理器。
		const manager = SettingsManager.create(projectDir, agentDir);

		// 外部修改前读取的项目设置。
		const currentProjectSettings = JSON.parse(readFileSync(projectSettingsPath, "utf-8"));
		currentProjectSettings.prompts = ["./new-prompt.md"];
		writeFileSync(projectSettingsPath, JSON.stringify(currentProjectSettings, null, 2));

		manager.setProjectExtensionPaths(["./updated-extension.ts"]);
		await manager.flush();

		// 保存后重新读取的项目设置。
		const savedProjectSettings = JSON.parse(readFileSync(projectSettingsPath, "utf-8"));
		expect(savedProjectSettings.prompts).toEqual(["./new-prompt.md"]);
		expect(savedProjectSettings.extensions).toEqual(["./updated-extension.ts"]);
	});

	it("should let in-memory project changes override external changes for the same project field", async () => {
		// 同字段冲突场景的项目设置路径。
		const projectSettingsPath = join(projectDir, ".pi", "settings.json");
		writeFileSync(
			projectSettingsPath,
			JSON.stringify({
				extensions: ["./initial-extension.ts"],
			}),
		);

		// 加载初始 extensions 的管理器。
		const manager = SettingsManager.create(projectDir, agentDir);

		// 外部修改前读取的项目设置对象。
		const currentProjectSettings = JSON.parse(readFileSync(projectSettingsPath, "utf-8"));
		currentProjectSettings.extensions = ["./external-extension.ts"];
		writeFileSync(projectSettingsPath, JSON.stringify(currentProjectSettings, null, 2));

		manager.setProjectExtensionPaths(["./in-memory-extension.ts"]);
		await manager.flush();

		// flush 后重新读取的项目设置；同字段内存值应胜出。
		const savedProjectSettings = JSON.parse(readFileSync(projectSettingsPath, "utf-8"));
		expect(savedProjectSettings.extensions).toEqual(["./in-memory-extension.ts"]);
	});
});
