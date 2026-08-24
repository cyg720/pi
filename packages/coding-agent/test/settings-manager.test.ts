/**
 * 文件职责：验证 SettingsManager 对全局与项目设置的加载、合并、保存、重载、迁移和默认值处理。
 * 技术维度：使用 Vitest 和 Node.js 文件系统在临时目录构造 settings.json，并调用 SettingsManager 公共接口。
 * 产品维度：保障用户配置在外部编辑、项目覆盖、信任切换和界面保存时不会丢失或被错误覆盖。
 * 逻辑维度：按设置保留、包迁移、重载、信任、目录创建、编辑器、输出、Shell 与会话目录分组测试。
 * 关键边界：用例直接改写测试目录和进程环境变量；afterEach 必须恢复环境，非法设置应保持安全默认值。
 * 新手阅读建议：先读 beforeEach 理解两级目录，再看“preserves externally added settings”和“project trust”分组。
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_HTTP_IDLE_TIMEOUT_MS } from "../src/core/http-dispatcher.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";

/** 测试分组：SettingsManager。 */
describe("SettingsManager", () => {
	/** 变量 testDir：本测试文件统一使用的临时根目录；仅在当前测试或分组范围内使用。 */
	const testDir = join(process.cwd(), "test-settings-tmp");
	/** 变量 agentDir：模拟用户级 agent 配置的目录；仅在当前测试或分组范围内使用。 */
	const agentDir = join(testDir, "agent");
	/** 变量 projectDir：模拟当前项目的目录；仅在当前测试或分组范围内使用。 */
	const projectDir = join(testDir, "project");

	beforeEach(() => {
		// Clean up and create fresh directories
		// 中文说明：清理旧测试目录并创建全局配置目录和项目 .pi 目录。
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
		mkdirSync(agentDir, { recursive: true });
		mkdirSync(join(projectDir, ".pi"), { recursive: true });
	});

	afterEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
	});

	/** 测试分组：preserves externally added settings。 */
	describe("preserves externally added settings", () => {
		/** 测试场景：should preserve enabledModels when changing thinking level。 */
		it("should preserve enabledModels when changing thinking level", async () => {
			// Create initial settings file
			// 中文说明：写入启动前存在的初始全局设置。
			/** 变量 settingsPath：当前场景使用的全局 settings.json 路径；仅在当前测试或分组范围内使用。 */
			const settingsPath = join(agentDir, "settings.json");
			writeFileSync(
				settingsPath,
				JSON.stringify({
					theme: "dark",
					defaultModel: "claude-sonnet",
				}),
			);

			// Create SettingsManager (simulates pi starting up)
			// 中文说明：创建管理器，模拟 pi 启动并读取当前设置。
			/** 变量 manager：当前场景创建的 SettingsManager 被测实例；仅在当前测试或分组范围内使用。 */
			const manager = SettingsManager.create(projectDir, agentDir);

			// Simulate user editing settings.json externally to add enabledModels
			// 中文说明：模拟用户在进程外修改设置文件并新增 enabledModels。
			/** 变量 currentSettings：从磁盘重新读取并准备外部修改的设置对象；仅在当前测试或分组范围内使用。 */
			const currentSettings = JSON.parse(readFileSync(settingsPath, "utf-8"));
			currentSettings.enabledModels = ["claude-opus-4-5", "gpt-5.2-codex"];
			writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 2));

			// User changes thinking level via Shift+Tab
			// 中文说明：模拟用户通过界面快捷键修改思考等级并刷新到磁盘。
			manager.setDefaultThinkingLevel("high");
			await manager.flush();

			// Verify enabledModels is preserved
			// 中文说明：确认外部新增字段与管理器修改的字段同时保留。
			/** 变量 savedSettings：管理器刷新后从磁盘读取的最终设置对象；仅在当前测试或分组范围内使用。 */
			const savedSettings = JSON.parse(readFileSync(settingsPath, "utf-8"));
			expect(savedSettings.enabledModels).toEqual(["claude-opus-4-5", "gpt-5.2-codex"]);
			expect(savedSettings.defaultThinkingLevel).toBe("high");
			expect(savedSettings.theme).toBe("dark");
			expect(savedSettings.defaultModel).toBe("claude-sonnet");
		});

		/** 测试场景：should preserve custom settings when changing theme。 */
		it("should preserve custom settings when changing theme", async () => {
			/** 变量 settingsPath：当前场景使用的全局 settings.json 路径；仅在当前测试或分组范围内使用。 */
			const settingsPath = join(agentDir, "settings.json");
			writeFileSync(
				settingsPath,
				JSON.stringify({
					defaultModel: "claude-sonnet",
				}),
			);

			/** 变量 manager：当前场景创建的 SettingsManager 被测实例；仅在当前测试或分组范围内使用。 */
			const manager = SettingsManager.create(projectDir, agentDir);

			// User adds custom settings externally
			// 中文说明：模拟用户从外部加入 Shell 与扩展自定义设置。
			/** 变量 currentSettings：从磁盘重新读取并准备外部修改的设置对象；仅在当前测试或分组范围内使用。 */
			const currentSettings = JSON.parse(readFileSync(settingsPath, "utf-8"));
			currentSettings.shellPath = "/bin/zsh";
			currentSettings.extensions = ["/path/to/extension.ts"];
			writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 2));

			// User changes theme
			// 中文说明：通过管理器只修改主题。
			manager.setTheme("light");
			await manager.flush();

			// Verify all settings preserved
			// 中文说明：确认无关自定义设置未在保存主题时丢失。
			/** 变量 savedSettings：管理器刷新后从磁盘读取的最终设置对象；仅在当前测试或分组范围内使用。 */
			const savedSettings = JSON.parse(readFileSync(settingsPath, "utf-8"));
			expect(savedSettings.shellPath).toBe("/bin/zsh");
			expect(savedSettings.extensions).toEqual(["/path/to/extension.ts"]);
			expect(savedSettings.theme).toBe("light");
		});

		/** 测试场景：should let in-memory changes override file changes for same key。 */
		it("should let in-memory changes override file changes for same key", async () => {
			/** 变量 settingsPath：当前场景使用的全局 settings.json 路径；仅在当前测试或分组范围内使用。 */
			const settingsPath = join(agentDir, "settings.json");
			writeFileSync(
				settingsPath,
				JSON.stringify({
					theme: "dark",
				}),
			);

			/** 变量 manager：当前场景创建的 SettingsManager 被测实例；仅在当前测试或分组范围内使用。 */
			const manager = SettingsManager.create(projectDir, agentDir);

			// User externally sets thinking level to "low"
			// 中文说明：先模拟外部把同一键修改为 low。
			/** 变量 currentSettings：从磁盘重新读取并准备外部修改的设置对象；仅在当前测试或分组范围内使用。 */
			const currentSettings = JSON.parse(readFileSync(settingsPath, "utf-8"));
			currentSettings.defaultThinkingLevel = "low";
			writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 2));

			// But then changes it via UI to "high"
			// 中文说明：随后模拟界面内存状态把该键改为 high。
			manager.setDefaultThinkingLevel("high");
			await manager.flush();

			// In-memory change should win
			// 中文说明：确认当前进程中的显式修改优先于磁盘旧值。
			/** 变量 savedSettings：管理器刷新后从磁盘读取的最终设置对象；仅在当前测试或分组范围内使用。 */
			const savedSettings = JSON.parse(readFileSync(settingsPath, "utf-8"));
			expect(savedSettings.defaultThinkingLevel).toBe("high");
		});
	});

	/** 测试分组：packages migration。 */
	describe("packages migration", () => {
		/** 测试场景：should keep local-only extensions in extensions array。 */
		it("should keep local-only extensions in extensions array", () => {
			/** 变量 settingsPath：当前场景使用的全局 settings.json 路径；仅在当前测试或分组范围内使用。 */
			const settingsPath = join(agentDir, "settings.json");
			writeFileSync(
				settingsPath,
				JSON.stringify({
					extensions: ["/local/ext.ts", "./relative/ext.ts"],
				}),
			);

			/** 变量 manager：当前场景创建的 SettingsManager 被测实例；仅在当前测试或分组范围内使用。 */
			const manager = SettingsManager.create(projectDir, agentDir);

			expect(manager.getPackages()).toEqual([]);
			expect(manager.getExtensionPaths()).toEqual(["/local/ext.ts", "./relative/ext.ts"]);
		});

		/** 测试场景：should handle packages with filtering objects。 */
		it("should handle packages with filtering objects", () => {
			/** 变量 settingsPath：当前场景使用的全局 settings.json 路径；仅在当前测试或分组范围内使用。 */
			const settingsPath = join(agentDir, "settings.json");
			writeFileSync(
				settingsPath,
				JSON.stringify({
					packages: [
						"npm:simple-pkg",
						{
							source: "npm:shitty-extensions",
							extensions: ["extensions/oracle.ts"],
							skills: [],
						},
					],
				}),
			);

			/** 变量 manager：当前场景创建的 SettingsManager 被测实例；仅在当前测试或分组范围内使用。 */
			const manager = SettingsManager.create(projectDir, agentDir);

			/** 变量 packages：通过管理器读取的包配置数组；仅在当前测试或分组范围内使用。 */
			const packages = manager.getPackages();
			expect(packages).toHaveLength(2);
			expect(packages[0]).toBe("npm:simple-pkg");
			expect(packages[1]).toEqual({
				source: "npm:shitty-extensions",
				extensions: ["extensions/oracle.ts"],
				skills: [],
			});
		});
	});

	/** 测试分组：reload。 */
	describe("reload", () => {
		/** 测试场景：should reload global settings from disk。 */
		it("should reload global settings from disk", async () => {
			/** 变量 settingsPath：当前场景使用的全局 settings.json 路径；仅在当前测试或分组范围内使用。 */
			const settingsPath = join(agentDir, "settings.json");
			writeFileSync(
				settingsPath,
				JSON.stringify({
					theme: "dark",
					extensions: ["/before.ts"],
				}),
			);

			/** 变量 manager：当前场景创建的 SettingsManager 被测实例；仅在当前测试或分组范围内使用。 */
			const manager = SettingsManager.create(projectDir, agentDir);

			writeFileSync(
				settingsPath,
				JSON.stringify({
					theme: "light",
					extensions: ["/after.ts"],
					defaultModel: "claude-sonnet",
				}),
			);

			await manager.reload();

			expect(manager.getTheme()).toBe("light");
			expect(manager.getExtensionPaths()).toEqual(["/after.ts"]);
			expect(manager.getDefaultModel()).toBe("claude-sonnet");
		});

		/** 测试场景：should keep previous settings when file is invalid。 */
		it("should keep previous settings when file is invalid", async () => {
			/** 变量 settingsPath：当前场景使用的全局 settings.json 路径；仅在当前测试或分组范围内使用。 */
			const settingsPath = join(agentDir, "settings.json");
			writeFileSync(settingsPath, JSON.stringify({ theme: "dark" }));

			/** 变量 manager：当前场景创建的 SettingsManager 被测实例；仅在当前测试或分组范围内使用。 */
			const manager = SettingsManager.create(projectDir, agentDir);

			writeFileSync(settingsPath, "{ invalid json");
			await manager.reload();

			expect(manager.getTheme()).toBe("dark");
		});
	});

	/** 测试分组：theme setting。 */
	describe("theme setting", () => {
		/** 测试场景：stores slash-separated automatic theme settings separately from fixed theme names。 */
		it("stores slash-separated automatic theme settings separately from fixed theme names", async () => {
			/** 变量 settingsPath：当前场景使用的全局 settings.json 路径；仅在当前测试或分组范围内使用。 */
			const settingsPath = join(agentDir, "settings.json");
			writeFileSync(settingsPath, JSON.stringify({ theme: "light/dark" }));

			/** 变量 manager：当前场景创建的 SettingsManager 被测实例；仅在当前测试或分组范围内使用。 */
			const manager = SettingsManager.create(projectDir, agentDir);

			expect(manager.getTheme()).toBeUndefined();
			expect(manager.getThemeSetting()).toBe("light/dark");

			manager.setTheme("solarized-light/tokyo-night");
			await manager.flush();

			/** 变量 savedSettings：管理器刷新后从磁盘读取的最终设置对象；仅在当前测试或分组范围内使用。 */
			const savedSettings = JSON.parse(readFileSync(settingsPath, "utf-8"));
			expect(savedSettings.theme).toBe("solarized-light/tokyo-night");
		});
	});

	/** 测试分组：error tracking。 */
	describe("error tracking", () => {
		/** 测试场景：should collect and clear load errors via drainErrors。 */
		it("should collect and clear load errors via drainErrors", () => {
			/** 变量 globalSettingsPath：全局 settings.json 的绝对路径；仅在当前测试或分组范围内使用。 */
			const globalSettingsPath = join(agentDir, "settings.json");
			/** 变量 projectSettingsPath：项目 .pi/settings.json 的绝对路径；仅在当前测试或分组范围内使用。 */
			const projectSettingsPath = join(projectDir, ".pi", "settings.json");
			writeFileSync(globalSettingsPath, "{ invalid global json");
			writeFileSync(projectSettingsPath, "{ invalid project json");

			/** 变量 manager：当前场景创建的 SettingsManager 被测实例；仅在当前测试或分组范围内使用。 */
			const manager = SettingsManager.create(projectDir, agentDir);
			/** 变量 errors：从管理器一次性取出的设置加载错误；仅在当前测试或分组范围内使用。 */
			const errors = manager.drainErrors();

			expect(errors).toHaveLength(2);
			expect(errors.map((e) => e.scope).sort()).toEqual(["global", "project"]);
			expect(manager.drainErrors()).toEqual([]);
		});
	});

	/** 测试分组：project trust。 */
	describe("project trust", () => {
		/** 测试场景：should skip project settings when project is not trusted。 */
		it("should skip project settings when project is not trusted", () => {
			writeFileSync(join(agentDir, "settings.json"), JSON.stringify({ theme: "global" }));
			writeFileSync(join(projectDir, ".pi", "settings.json"), JSON.stringify({ theme: "project" }));

			/** 变量 manager：当前场景创建的 SettingsManager 被测实例；仅在当前测试或分组范围内使用。 */
			const manager = SettingsManager.create(projectDir, agentDir, { projectTrusted: false });

			expect(manager.isProjectTrusted()).toBe(false);
			expect(manager.getTheme()).toBe("global");
			expect(manager.getProjectSettings()).toEqual({});
		});

		/** 测试场景：should reload project settings after trust changes to true。 */
		it("should reload project settings after trust changes to true", () => {
			writeFileSync(join(agentDir, "settings.json"), JSON.stringify({ theme: "global" }));
			writeFileSync(join(projectDir, ".pi", "settings.json"), JSON.stringify({ theme: "project" }));
			/** 变量 manager：当前场景创建的 SettingsManager 被测实例；仅在当前测试或分组范围内使用。 */
			const manager = SettingsManager.create(projectDir, agentDir, { projectTrusted: false });

			manager.setProjectTrusted(true);

			expect(manager.isProjectTrusted()).toBe(true);
			expect(manager.getTheme()).toBe("project");
		});

		/** 测试场景：should fail project settings writes when project is not trusted。 */
		it("should fail project settings writes when project is not trusted", async () => {
			/** 变量 projectSettingsPath：项目 .pi/settings.json 的绝对路径；仅在当前测试或分组范围内使用。 */
			const projectSettingsPath = join(projectDir, ".pi", "settings.json");
			writeFileSync(projectSettingsPath, JSON.stringify({ packages: ["npm:existing"] }));
			/** 变量 manager：当前场景创建的 SettingsManager 被测实例；仅在当前测试或分组范围内使用。 */
			const manager = SettingsManager.create(projectDir, agentDir, { projectTrusted: false });

			expect(() => manager.setProjectPackages(["npm:new"])).toThrow(
				"Project is not trusted; refusing to write project settings",
			);
			await manager.flush();

			expect(manager.getProjectSettings()).toEqual({});
			expect(JSON.parse(readFileSync(projectSettingsPath, "utf-8"))).toEqual({ packages: ["npm:existing"] });
		});

		/** 测试场景：should read default project trust from global settings only。 */
		it("should read default project trust from global settings only", () => {
			writeFileSync(join(agentDir, "settings.json"), JSON.stringify({ defaultProjectTrust: "always" }));
			writeFileSync(join(projectDir, ".pi", "settings.json"), JSON.stringify({ defaultProjectTrust: "never" }));

			/** 变量 manager：当前场景创建的 SettingsManager 被测实例；仅在当前测试或分组范围内使用。 */
			const manager = SettingsManager.create(projectDir, agentDir);

			expect(manager.getDefaultProjectTrust()).toBe("always");
		});

		/** 测试场景：should default invalid project trust settings to ask。 */
		it("should default invalid project trust settings to ask", () => {
			writeFileSync(join(agentDir, "settings.json"), JSON.stringify({ defaultProjectTrust: "sometimes" }));

			/** 变量 manager：当前场景创建的 SettingsManager 被测实例；仅在当前测试或分组范围内使用。 */
			const manager = SettingsManager.create(projectDir, agentDir);

			expect(manager.getDefaultProjectTrust()).toBe("ask");
		});
	});

	/** 测试分组：project settings directory creation。 */
	describe("project settings directory creation", () => {
		/** 测试场景：should not create .pi folder when only reading project settings。 */
		it("should not create .pi folder when only reading project settings", () => {
			// Create agent dir with global settings, but NO .pi folder in project
			// 中文说明：准备只有全局设置、项目中没有 .pi 目录的场景。
			/** 变量 settingsPath：当前场景使用的全局 settings.json 路径；仅在当前测试或分组范围内使用。 */
			const settingsPath = join(agentDir, "settings.json");
			writeFileSync(settingsPath, JSON.stringify({ theme: "dark" }));

			// Delete the .pi folder that beforeEach created
			// 中文说明：删除公共准备阶段创建的项目 .pi 目录。
			rmSync(join(projectDir, ".pi"), { recursive: true });

			// Create SettingsManager (reads both global and project settings)
			// 中文说明：创建会尝试读取全局和项目设置的管理器。
			/** 变量 manager：当前场景创建的 SettingsManager 被测实例；仅在当前测试或分组范围内使用。 */
			const manager = SettingsManager.create(projectDir, agentDir);

			// .pi folder should NOT have been created just from reading
			// 中文说明：确认只读加载不会产生项目配置目录。
			expect(existsSync(join(projectDir, ".pi"))).toBe(false);

			// Settings should still be loaded from global
			// 中文说明：确认缺少项目目录时仍能使用全局设置。
			expect(manager.getTheme()).toBe("dark");
		});

		/** 测试场景：should create .pi folder when writing project settings。 */
		it("should create .pi folder when writing project settings", async () => {
			// Create agent dir with global settings, but NO .pi folder in project
			// 中文说明：准备只有全局设置、项目中没有 .pi 目录的场景。
			/** 变量 settingsPath：当前场景使用的全局 settings.json 路径；仅在当前测试或分组范围内使用。 */
			const settingsPath = join(agentDir, "settings.json");
			writeFileSync(settingsPath, JSON.stringify({ theme: "dark" }));

			// Delete the .pi folder that beforeEach created
			// 中文说明：删除公共准备阶段创建的项目 .pi 目录。
			rmSync(join(projectDir, ".pi"), { recursive: true });

			/** 变量 manager：当前场景创建的 SettingsManager 被测实例；仅在当前测试或分组范围内使用。 */
			const manager = SettingsManager.create(projectDir, agentDir);

			// .pi folder should NOT exist yet
			// 中文说明：写入项目前再次确认目录尚不存在。
			expect(existsSync(join(projectDir, ".pi"))).toBe(false);

			// Write a project-specific setting
			// 中文说明：写入项目级包设置以触发目录创建。
			manager.setProjectPackages([{ source: "npm:test-pkg" }]);
			await manager.flush();

			// Now .pi folder should exist
			// 中文说明：确认项目设置写入后自动创建 .pi 目录。
			expect(existsSync(join(projectDir, ".pi"))).toBe(true);

			// And settings file should be created
			// 中文说明：确认目录中同时创建 settings.json 文件。
			expect(existsSync(join(projectDir, ".pi", "settings.json"))).toBe(true);
		});
	});

	/** 测试分组：httpIdleTimeoutMs。 */
	describe("httpIdleTimeoutMs", () => {
		/** 测试场景：should default to 5 minutes。 */
		it("should default to 5 minutes", () => {
			/** 变量 manager：当前场景创建的 SettingsManager 被测实例；仅在当前测试或分组范围内使用。 */
			const manager = SettingsManager.create(projectDir, agentDir);
			expect(manager.getHttpIdleTimeoutMs()).toBe(DEFAULT_HTTP_IDLE_TIMEOUT_MS);
		});

		/** 测试场景：should use merged global and project settings。 */
		it("should use merged global and project settings", () => {
			writeFileSync(join(agentDir, "settings.json"), JSON.stringify({ httpIdleTimeoutMs: 300000 }));
			writeFileSync(join(projectDir, ".pi", "settings.json"), JSON.stringify({ httpIdleTimeoutMs: 0 }));

			/** 变量 manager：当前场景创建的 SettingsManager 被测实例；仅在当前测试或分组范围内使用。 */
			const manager = SettingsManager.create(projectDir, agentDir);

			expect(manager.getHttpIdleTimeoutMs()).toBe(0);
		});

		/** 测试场景：should reject invalid timeout values。 */
		it("should reject invalid timeout values", () => {
			writeFileSync(join(agentDir, "settings.json"), JSON.stringify({ httpIdleTimeoutMs: -1 }));
			/** 变量 manager：当前场景创建的 SettingsManager 被测实例；仅在当前测试或分组范围内使用。 */
			const manager = SettingsManager.create(projectDir, agentDir);

			expect(() => manager.getHttpIdleTimeoutMs()).toThrow("Invalid httpIdleTimeoutMs setting");
		});
	});

	/** 测试分组：externalEditor。 */
	describe("externalEditor", () => {
		/** 变量 originalVisual：测试开始时 VISUAL 环境变量的原值；仅在当前测试或分组范围内使用。 */
		const originalVisual = process.env.VISUAL;
		/** 变量 originalEditor：测试开始时 EDITOR 环境变量的原值；仅在当前测试或分组范围内使用。 */
		const originalEditor = process.env.EDITOR;
		/** 变量 originalPlatform：测试开始时 process.platform 的属性描述符；仅在当前测试或分组范围内使用。 */
		const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");

		/** 设置测试使用的编辑器环境变量。参数 visual 与 editor 可传命令或 undefined；无返回值。例如：setEditorEnv("vim", "nano")。 */
		function setEditorEnv(visual?: string, editor?: string): void {
			if (visual === undefined) delete process.env.VISUAL;
			else process.env.VISUAL = visual;
			if (editor === undefined) delete process.env.EDITOR;
			else process.env.EDITOR = editor;
		}

		afterEach(() => {
			setEditorEnv(originalVisual, originalEditor);
			if (originalPlatform) {
				Object.defineProperty(process, "platform", originalPlatform);
			}
		});

		/** 测试场景：should resolve editor commands by precedence。 */
		it("should resolve editor commands by precedence", () => {
			setEditorEnv("vim", "nano");
			expect(SettingsManager.inMemory({ externalEditor: "code --wait" }).getExternalEditorCommand()).toBe(
				"code --wait",
			);
			expect(SettingsManager.inMemory().getExternalEditorCommand()).toBe("vim");

			setEditorEnv(undefined, "emacs");
			expect(SettingsManager.inMemory().getExternalEditorCommand()).toBe("emacs");
		});

		/** 测试场景：should fall back to platform defaults。 */
		it("should fall back to platform defaults", () => {
			setEditorEnv();
			Object.defineProperty(process, "platform", { value: "win32" });
			expect(SettingsManager.inMemory().getExternalEditorCommand()).toBe("notepad");

			Object.defineProperty(process, "platform", { value: "darwin" });
			expect(SettingsManager.inMemory().getExternalEditorCommand()).toBe("nano");

			Object.defineProperty(process, "platform", { value: "linux" });
			expect(SettingsManager.inMemory().getExternalEditorCommand()).toBe("nano");
		});
	});

	/** 测试分组：outputPad。 */
	describe("outputPad", () => {
		/** 测试场景：should default to 1 and persist binary values。 */
		it("should default to 1 and persist binary values", async () => {
			/** 变量 manager：当前场景创建的 SettingsManager 被测实例；仅在当前测试或分组范围内使用。 */
			const manager = SettingsManager.create(projectDir, agentDir);

			expect(manager.getOutputPad()).toBe(1);

			manager.setOutputPad(0);
			await manager.flush();

			expect(manager.getOutputPad()).toBe(0);
			/** 变量 savedSettings：管理器刷新后从磁盘读取的最终设置对象；仅在当前测试或分组范围内使用。 */
			const savedSettings = JSON.parse(readFileSync(join(agentDir, "settings.json"), "utf-8"));
			expect(savedSettings.outputPad).toBe(0);
		});

		/** 测试场景：should treat unsupported outputPad values as default padding。 */
		it("should treat unsupported outputPad values as default padding", () => {
			writeFileSync(join(agentDir, "settings.json"), JSON.stringify({ outputPad: 2 }));

			/** 变量 manager：当前场景创建的 SettingsManager 被测实例；仅在当前测试或分组范围内使用。 */
			const manager = SettingsManager.create(projectDir, agentDir);

			expect(manager.getOutputPad()).toBe(1);
		});
	});

	/** 测试分组：shellCommandPrefix。 */
	describe("shellCommandPrefix", () => {
		/** 测试场景：should load shellCommandPrefix from settings。 */
		it("should load shellCommandPrefix from settings", () => {
			/** 变量 settingsPath：当前场景使用的全局 settings.json 路径；仅在当前测试或分组范围内使用。 */
			const settingsPath = join(agentDir, "settings.json");
			writeFileSync(settingsPath, JSON.stringify({ shellCommandPrefix: "shopt -s expand_aliases" }));

			/** 变量 manager：当前场景创建的 SettingsManager 被测实例；仅在当前测试或分组范围内使用。 */
			const manager = SettingsManager.create(projectDir, agentDir);

			expect(manager.getShellCommandPrefix()).toBe("shopt -s expand_aliases");
		});

		/** 测试场景：should return undefined when shellCommandPrefix is not set。 */
		it("should return undefined when shellCommandPrefix is not set", () => {
			/** 变量 settingsPath：当前场景使用的全局 settings.json 路径；仅在当前测试或分组范围内使用。 */
			const settingsPath = join(agentDir, "settings.json");
			writeFileSync(settingsPath, JSON.stringify({ theme: "dark" }));

			/** 变量 manager：当前场景创建的 SettingsManager 被测实例；仅在当前测试或分组范围内使用。 */
			const manager = SettingsManager.create(projectDir, agentDir);

			expect(manager.getShellCommandPrefix()).toBeUndefined();
		});

		/** 测试场景：should preserve shellCommandPrefix when saving unrelated settings。 */
		it("should preserve shellCommandPrefix when saving unrelated settings", async () => {
			/** 变量 settingsPath：当前场景使用的全局 settings.json 路径；仅在当前测试或分组范围内使用。 */
			const settingsPath = join(agentDir, "settings.json");
			writeFileSync(settingsPath, JSON.stringify({ shellCommandPrefix: "shopt -s expand_aliases" }));

			/** 变量 manager：当前场景创建的 SettingsManager 被测实例；仅在当前测试或分组范围内使用。 */
			const manager = SettingsManager.create(projectDir, agentDir);
			manager.setTheme("light");
			await manager.flush();

			/** 变量 savedSettings：管理器刷新后从磁盘读取的最终设置对象；仅在当前测试或分组范围内使用。 */
			const savedSettings = JSON.parse(readFileSync(settingsPath, "utf-8"));
			expect(savedSettings.shellCommandPrefix).toBe("shopt -s expand_aliases");
			expect(savedSettings.theme).toBe("light");
		});
	});

	/** 测试分组：getSessionDir。 */
	describe("getSessionDir", () => {
		/** 测试场景：should return undefined when not set。 */
		it("should return undefined when not set", () => {
			writeFileSync(join(agentDir, "settings.json"), JSON.stringify({ theme: "dark" }));
			/** 变量 manager：当前场景创建的 SettingsManager 被测实例；仅在当前测试或分组范围内使用。 */
			const manager = SettingsManager.create(projectDir, agentDir);
			expect(manager.getSessionDir()).toBeUndefined();
		});

		/** 测试场景：should return global sessionDir。 */
		it("should return global sessionDir", () => {
			writeFileSync(join(agentDir, "settings.json"), JSON.stringify({ sessionDir: "/tmp/sessions" }));
			/** 变量 manager：当前场景创建的 SettingsManager 被测实例；仅在当前测试或分组范围内使用。 */
			const manager = SettingsManager.create(projectDir, agentDir);
			expect(manager.getSessionDir()).toBe("/tmp/sessions");
		});

		/** 测试场景：should return project sessionDir, overriding global。 */
		it("should return project sessionDir, overriding global", () => {
			writeFileSync(join(agentDir, "settings.json"), JSON.stringify({ sessionDir: "/global/sessions" }));
			writeFileSync(join(projectDir, ".pi", "settings.json"), JSON.stringify({ sessionDir: "./sessions" }));
			/** 变量 manager：当前场景创建的 SettingsManager 被测实例；仅在当前测试或分组范围内使用。 */
			const manager = SettingsManager.create(projectDir, agentDir);
			expect(manager.getSessionDir()).toBe("./sessions");
		});

		/** 测试场景：should expand ~ in sessionDir。 */
		it("should expand ~ in sessionDir", () => {
			writeFileSync(join(agentDir, "settings.json"), JSON.stringify({ sessionDir: "~/sessions" }));
			/** 变量 manager：当前场景创建的 SettingsManager 被测实例；仅在当前测试或分组范围内使用。 */
			const manager = SettingsManager.create(projectDir, agentDir);
			expect(manager.getSessionDir()).toBe(join(homedir(), "sessions"));
		});
	});

	/** 测试分组：getShellPath。 */
	describe("getShellPath", () => {
		/** 测试场景：should return undefined when not set。 */
		it("should return undefined when not set", () => {
			writeFileSync(join(agentDir, "settings.json"), JSON.stringify({ theme: "dark" }));
			/** 变量 manager：当前场景创建的 SettingsManager 被测实例；仅在当前测试或分组范围内使用。 */
			const manager = SettingsManager.create(projectDir, agentDir);
			expect(manager.getShellPath()).toBeUndefined();
		});

		/** 测试场景：should return an absolute shellPath unchanged。 */
		it("should return an absolute shellPath unchanged", () => {
			writeFileSync(join(agentDir, "settings.json"), JSON.stringify({ shellPath: "/bin/zsh" }));
			/** 变量 manager：当前场景创建的 SettingsManager 被测实例；仅在当前测试或分组范围内使用。 */
			const manager = SettingsManager.create(projectDir, agentDir);
			expect(manager.getShellPath()).toBe("/bin/zsh");
		});

		/** 测试场景：should expand ~ in shellPath。 */
		it("should expand ~ in shellPath", () => {
			writeFileSync(
				join(agentDir, "settings.json"),
				JSON.stringify({ shellPath: "~/.local/bin/agent-shell-sandbox" }),
			);
			/** 变量 manager：当前场景创建的 SettingsManager 被测实例；仅在当前测试或分组范围内使用。 */
			const manager = SettingsManager.create(projectDir, agentDir);
			expect(manager.getShellPath()).toBe(join(homedir(), ".local/bin/agent-shell-sandbox"));
		});

		/** 测试场景：should expand a bare ~ in shellPath。 */
		it("should expand a bare ~ in shellPath", () => {
			writeFileSync(join(agentDir, "settings.json"), JSON.stringify({ shellPath: "~" }));
			/** 变量 manager：当前场景创建的 SettingsManager 被测实例；仅在当前测试或分组范围内使用。 */
			const manager = SettingsManager.create(projectDir, agentDir);
			expect(manager.getShellPath()).toBe(homedir());
		});
	});
});
