/**
 * 文件职责：验证 ExtensionRunner 的扩展事件、快捷键冲突、工具命令收集、上下文、错误隔离与提供商注册。
 * 技术维度：使用 Vitest、临时扩展源码、动态加载器、内存会话和模型注册表进行扩展运行时集成测试。
 * 产品维度：确保第三方扩展可以安全接入，同时不会覆盖保留快捷键、破坏其他处理器或污染核心状态。
 * 逻辑维度：建立扩展运行环境和默认动作后，按项目信任、快捷键、工具命令、事件链、注册与上下文分组测试。
 * 关键边界：扩展源码位于模板字符串中，只能作为测试夹具看待；冲突规则依赖当前默认键位与注册顺序。
 * 新手阅读建议：先看 beforeEach 和两个动作对象，再读快捷键/工具收集，最后看事件链和提供商即时注册。
 */
import { createModelRegistry } from "./model-runtime-test-utils.ts";
/**
 * Tests for ExtensionRunner - conflict detection, error handling, tool wrapping.
 */
// 中文说明：上方英文注释给出本段功能、前提或边界，下面代码按该说明执行。

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { createExtensionRuntime, discoverAndLoadExtensions, loadExtensions } from "../src/core/extensions/loader.ts";
import { ExtensionRunner, emitProjectTrustEvent } from "../src/core/extensions/runner.ts";
import type {
	ExtensionActions,
	ExtensionContextActions,
	ExtensionUIContext,
	ProviderConfig,
} from "../src/core/extensions/types.ts";
import { KeybindingsManager, type KeyId } from "../src/core/keybindings.ts";
import type { ModelRegistry } from "../src/core/model-registry.ts";
import { SessionManager } from "../src/core/session-manager.ts";

// 用例分组：集中验证“ExtensionRunner”相关功能。
describe("ExtensionRunner", () => {
	/** 变量 tempDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let tempDir: string;
	/** 变量 extensionsDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let extensionsDir: string;
	/** 变量 sessionManager 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let sessionManager: SessionManager;
	/** 变量 modelRegistry 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let modelRegistry: ModelRegistry;
	/** 常量 defaultKeybindings 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const defaultKeybindings = new KeybindingsManager().getEffectiveConfig();

	beforeEach(async () => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-runner-test-"));
		extensionsDir = path.join(tempDir, "extensions");
		fs.mkdirSync(extensionsDir);
		sessionManager = SessionManager.inMemory();
		/** 常量 authStorage 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const authStorage = AuthStorage.create(path.join(tempDir, "auth.json"));
		modelRegistry = await createModelRegistry(authStorage);
	});

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	/** 常量 providerModelConfig 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const providerModelConfig: ProviderConfig = {
		baseUrl: "https://provider.test/v1",
		apiKey: "provider-test-key",
		api: "openai-completions",
		models: [
			{
				id: "instant-model",
				name: "Instant Model",
				reasoning: false,
				input: ["text"],
				cost: {
					input: 1,
					output: 2,
					cacheRead: 0.1,
					cacheWrite: 1.25,
					tiers: [
						{
							inputTokensAbove: 272000,
							input: 2,
							output: 3,
							cacheRead: 0.2,
							cacheWrite: 2.5,
						},
					],
				},
				contextWindow: 128000,
				maxTokens: 4096,
			},
		],
	};

	/** 常量 extensionActions 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const extensionActions: ExtensionActions = {
		sendMessage: () => {},
		sendUserMessage: () => {},
		appendEntry: () => {},
		setSessionName: () => {},
		getSessionName: () => undefined,
		setLabel: () => {},
		getActiveTools: () => [],
		getAllTools: () => [],
		setActiveTools: () => {},
		refreshTools: () => {},
		getCommands: () => [],
		setModel: async () => false,
		getThinkingLevel: () => "off",
		setThinkingLevel: () => {},
	};

	/** 常量 extensionContextActions 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const extensionContextActions: ExtensionContextActions = {
		getModel: () => undefined,
		isIdle: () => true,
		isProjectTrusted: () => true,
		getSignal: () => undefined,
		abort: () => {},
		hasPendingMessages: () => false,
		shutdown: () => {},
		getContextUsage: () => undefined,
		compact: () => {},
		getSystemPrompt: () => "",
	};

	// 用例分组：集中验证“project_trust”相关功能。
	describe("project_trust", () => {
		// 测试场景：验证“continues past undecided handlers and returns the first yes/no decision”对应的行为、结果与边界。
		it("continues past undecided handlers and returns the first yes/no decision", async () => {
			/** 常量 undecidedPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const undecidedPath = path.join(extensionsDir, "undecided.ts");
			/** 常量 decidedPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const decidedPath = path.join(extensionsDir, "decided.ts");
			fs.writeFileSync(
				undecidedPath,
				`export default function(pi) {
	pi.on("project_trust", () => ({ trusted: "undecided", remember: true }));
}`,
			);
			fs.writeFileSync(
				decidedPath,
				`export default function(pi) {
	pi.on("project_trust", () => ({ trusted: "no", remember: true }));
}`,
			);

			/** 常量 extensionsResult 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extensionsResult = await loadExtensions([undecidedPath, decidedPath], tempDir);
			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await emitProjectTrustEvent(
				extensionsResult,
				{ type: "project_trust", cwd: tempDir },
				{
					cwd: tempDir,
					mode: "tui",
					hasUI: false,
					ui: {
						select: async () => undefined,
						confirm: async () => false,
						input: async () => undefined,
						notify: () => {},
					},
				},
			);

			expect(result.result).toEqual({ trusted: "no", remember: true });
			expect(result.errors).toEqual([]);
		});
	});

	// 用例分组：集中验证“shortcut conflicts”相关功能。
	describe("shortcut conflicts", () => {
		// 测试场景：验证“warns when extension shortcut conflicts with built-in”对应的行为、结果与边界。
		it("warns when extension shortcut conflicts with built-in", async () => {
			/** 常量 extCode 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extCode = `
				export default function(pi) {
					pi.registerShortcut("ctrl+c", {
						description: "Conflicts with built-in",
						handler: async () => {},
					});
				}
			`;
			fs.writeFileSync(path.join(extensionsDir, "conflict.ts"), extCode);

			/** 常量 warnSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await discoverAndLoadExtensions([], tempDir, tempDir);
			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner(result.extensions, result.runtime, tempDir, sessionManager, modelRegistry);
			/** 常量 shortcuts 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const shortcuts = runner.getShortcuts(defaultKeybindings);

			expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("conflicts with built-in"));
			expect(shortcuts.has("ctrl+c")).toBe(false);

			warnSpy.mockRestore();
		});

		// 测试场景：验证“allows a shortcut when the reserved set no longer contains the default key”对应的行为、结果与边界。
		it("allows a shortcut when the reserved set no longer contains the default key", async () => {
			/** 常量 extCode 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extCode = `
				export default function(pi) {
					pi.registerShortcut("ctrl+p", {
						description: "Uses freed default",
						handler: async () => {},
					});
				}
			`;
			fs.writeFileSync(path.join(extensionsDir, "rebinding.ts"), extCode);

			/** 常量 warnSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await discoverAndLoadExtensions([], tempDir, tempDir);
			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner(result.extensions, result.runtime, tempDir, sessionManager, modelRegistry);
			/** 常量 keybindings 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const keybindings = { ...defaultKeybindings, "app.model.cycleForward": "ctrl+n" as KeyId };
			/** 常量 shortcuts 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const shortcuts = runner.getShortcuts(keybindings);

			expect(shortcuts.has("ctrl+p")).toBe(true);
			expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining("conflicts with built-in"));

			warnSpy.mockRestore();
		});

		// 测试场景：验证“warns but allows when extension uses non-reserved built-in shortcut”对应的行为、结果与边界。
		it("warns but allows when extension uses non-reserved built-in shortcut", async () => {
			/** 常量 pasteImageKey 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const pasteImageKey = Array.isArray(defaultKeybindings["app.clipboard.pasteImage"])
				? (defaultKeybindings["app.clipboard.pasteImage"][0] ?? "")
				: defaultKeybindings["app.clipboard.pasteImage"];
			/** 常量 extCode 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extCode = `
				export default function(pi) {
					pi.registerShortcut("${pasteImageKey}", {
						description: "Overrides non-reserved",
						handler: async () => {},
					});
				}
			`;
			fs.writeFileSync(path.join(extensionsDir, "non-reserved.ts"), extCode);

			/** 常量 warnSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await discoverAndLoadExtensions([], tempDir, tempDir);
			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner(result.extensions, result.runtime, tempDir, sessionManager, modelRegistry);
			/** 常量 shortcuts 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const shortcuts = runner.getShortcuts(defaultKeybindings);

			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining("built-in shortcut for app.clipboard.pasteImage"),
			);
			expect(shortcuts.has(pasteImageKey as KeyId)).toBe(true);

			warnSpy.mockRestore();
		});

		// 测试场景：验证“blocks shortcuts for reserved actions even when rebound”对应的行为、结果与边界。
		it("blocks shortcuts for reserved actions even when rebound", async () => {
			/** 常量 extCode 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extCode = `
				export default function(pi) {
					pi.registerShortcut("ctrl+x", {
						description: "Conflicts with rebound reserved",
						handler: async () => {},
					});
				}
			`;
			fs.writeFileSync(path.join(extensionsDir, "rebound-reserved.ts"), extCode);

			/** 常量 warnSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await discoverAndLoadExtensions([], tempDir, tempDir);
			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner(result.extensions, result.runtime, tempDir, sessionManager, modelRegistry);
			/** 常量 keybindings 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const keybindings = { ...defaultKeybindings, "app.interrupt": "ctrl+x" as KeyId };
			/** 常量 shortcuts 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const shortcuts = runner.getShortcuts(keybindings);

			expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("conflicts with built-in"));
			expect(shortcuts.has("ctrl+x")).toBe(false);

			warnSpy.mockRestore();
		});

		// 测试场景：验证“blocks shortcuts when reserved key is also bound to non-reserved actions”对应的行为、结果与边界。
		it("blocks shortcuts when reserved key is also bound to non-reserved actions", async () => {
			/** 常量 extCode 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extCode = `
				export default function(pi) {
					pi.registerShortcut("ctrl+p", {
						description: "Conflicts with shared reserved default",
						handler: async () => {},
					});
				}
			`;
			fs.writeFileSync(path.join(extensionsDir, "shared-reserved.ts"), extCode);

			/** 常量 warnSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await discoverAndLoadExtensions([], tempDir, tempDir);
			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner(result.extensions, result.runtime, tempDir, sessionManager, modelRegistry);
			/** 常量 shortcuts 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const shortcuts = runner.getShortcuts(defaultKeybindings);

			expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("conflicts with built-in"));
			expect(shortcuts.has("ctrl+p")).toBe(false);

			warnSpy.mockRestore();
		});

		// 测试场景：验证“blocks shortcuts when reserved action has multiple keys”对应的行为、结果与边界。
		it("blocks shortcuts when reserved action has multiple keys", async () => {
			/** 常量 extCode 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extCode = `
				export default function(pi) {
					pi.registerShortcut("ctrl+y", {
						description: "Conflicts with multi-key reserved",
						handler: async () => {},
					});
				}
			`;
			fs.writeFileSync(path.join(extensionsDir, "multi-reserved.ts"), extCode);

			/** 常量 warnSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await discoverAndLoadExtensions([], tempDir, tempDir);
			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner(result.extensions, result.runtime, tempDir, sessionManager, modelRegistry);
			/** 常量 keybindings 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const keybindings = { ...defaultKeybindings, "app.clear": ["ctrl+x", "ctrl+y"] as KeyId[] };
			/** 常量 shortcuts 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const shortcuts = runner.getShortcuts(keybindings);

			expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("conflicts with built-in"));
			expect(shortcuts.has("ctrl+y")).toBe(false);

			warnSpy.mockRestore();
		});

		// 测试场景：验证“warns but allows when non-reserved action has multiple keys”对应的行为、结果与边界。
		it("warns but allows when non-reserved action has multiple keys", async () => {
			/** 常量 extCode 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extCode = `
				export default function(pi) {
					pi.registerShortcut("ctrl+y", {
						description: "Overrides multi-key non-reserved",
						handler: async () => {},
					});
				}
			`;
			fs.writeFileSync(path.join(extensionsDir, "multi-non-reserved.ts"), extCode);

			/** 常量 warnSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await discoverAndLoadExtensions([], tempDir, tempDir);
			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner(result.extensions, result.runtime, tempDir, sessionManager, modelRegistry);
			/** 常量 keybindings 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const keybindings = { ...defaultKeybindings, "app.clipboard.pasteImage": ["ctrl+x", "ctrl+y"] as KeyId[] };
			/** 常量 shortcuts 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const shortcuts = runner.getShortcuts(keybindings);

			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining("built-in shortcut for app.clipboard.pasteImage"),
			);
			expect(shortcuts.has("ctrl+y")).toBe(true);

			warnSpy.mockRestore();
		});

		// 测试场景：验证“warns when two extensions register same shortcut”对应的行为、结果与边界。
		it("warns when two extensions register same shortcut", async () => {
			// Use a non-reserved shortcut
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const extCode1 = `
				export default function(pi) {
					pi.registerShortcut("ctrl+shift+x", {
						description: "First extension",
						handler: async () => {},
					});
				}
			`;
			/** 常量 extCode2 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extCode2 = `
				export default function(pi) {
					pi.registerShortcut("ctrl+shift+x", {
						description: "Second extension",
						handler: async () => {},
					});
				}
			`;
			fs.writeFileSync(path.join(extensionsDir, "ext1.ts"), extCode1);
			fs.writeFileSync(path.join(extensionsDir, "ext2.ts"), extCode2);

			/** 常量 warnSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await discoverAndLoadExtensions([], tempDir, tempDir);
			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner(result.extensions, result.runtime, tempDir, sessionManager, modelRegistry);
			/** 常量 shortcuts 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const shortcuts = runner.getShortcuts(defaultKeybindings);

			expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("shortcut conflict"));
			// Last one wins
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(shortcuts.has("ctrl+shift+x")).toBe(true);

			warnSpy.mockRestore();
		});
	});

	// 用例分组：集中验证“tool collection”相关功能。
	describe("tool collection", () => {
		// 测试场景：验证“collects tools from multiple extensions”对应的行为、结果与边界。
		it("collects tools from multiple extensions", async () => {
			/** toolCode 封装当前回调或辅助步骤；参数 name: string 提供输入，返回值用于后续流程。示例：toolCode(...)。 */
			const toolCode = (name: string) => `
				import { Type } from "typebox";
				export default function(pi) {
					pi.registerTool({
						name: "${name}",
						label: "${name}",
						description: "Test tool",
						parameters: Type.Object({}),
						execute: async () => ({ content: [{ type: "text", text: "ok" }], details: {} }),
					});
				}
			`;
			fs.writeFileSync(path.join(extensionsDir, "tool-a.ts"), toolCode("tool_a"));
			fs.writeFileSync(path.join(extensionsDir, "tool-b.ts"), toolCode("tool_b"));

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await discoverAndLoadExtensions([], tempDir, tempDir);
			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner(result.extensions, result.runtime, tempDir, sessionManager, modelRegistry);
			/** 常量 tools 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tools = runner.getAllRegisteredTools();

			expect(tools.length).toBe(2);
			expect(tools.map((t) => t.definition.name).sort()).toEqual(["tool_a", "tool_b"]);
		});

		// 测试场景：验证“keeps first tool when two extensions register the same name”对应的行为、结果与边界。
		it("keeps first tool when two extensions register the same name", async () => {
			/** 常量 first 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const first = `
				import { Type } from "typebox";
				export default function(pi) {
					pi.registerTool({
						name: "shared",
						label: "shared",
						description: "first",
						parameters: Type.Object({}),
						execute: async () => ({ content: [{ type: "text", text: "ok" }], details: {} }),
					});
				}
			`;
			/** 常量 second 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const second = `
				import { Type } from "typebox";
				export default function(pi) {
					pi.registerTool({
						name: "shared",
						label: "shared",
						description: "second",
						parameters: Type.Object({}),
						execute: async () => ({ content: [{ type: "text", text: "ok" }], details: {} }),
					});
				}
			`;
			fs.writeFileSync(path.join(extensionsDir, "a-first.ts"), first);
			fs.writeFileSync(path.join(extensionsDir, "b-second.ts"), second);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await discoverAndLoadExtensions([], tempDir, tempDir);
			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner(result.extensions, result.runtime, tempDir, sessionManager, modelRegistry);
			/** 常量 tools 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tools = runner.getAllRegisteredTools();

			expect(tools).toHaveLength(1);
			expect(tools[0]?.definition.description).toBe("first");
		});
	});

	// 用例分组：集中验证“command collection”相关功能。
	describe("command collection", () => {
		// 测试场景：验证“collects commands from multiple extensions”对应的行为、结果与边界。
		it("collects commands from multiple extensions", async () => {
			/** cmdCode 封装当前回调或辅助步骤；参数 name: string 提供输入，返回值用于后续流程。示例：cmdCode(...)。 */
			const cmdCode = (name: string) => `
				export default function(pi) {
					pi.registerCommand("${name}", {
						description: "Test command",
						handler: async () => {},
					});
				}
			`;
			fs.writeFileSync(path.join(extensionsDir, "cmd-a.ts"), cmdCode("cmd-a"));
			fs.writeFileSync(path.join(extensionsDir, "cmd-b.ts"), cmdCode("cmd-b"));

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await discoverAndLoadExtensions([], tempDir, tempDir);
			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner(result.extensions, result.runtime, tempDir, sessionManager, modelRegistry);
			/** 常量 commands 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const commands = runner.getRegisteredCommands();

			expect(commands.length).toBe(2);
			expect(commands.map((c) => c.name).sort()).toEqual(["cmd-a", "cmd-b"]);
			expect(commands.map((c) => c.invocationName).sort()).toEqual(["cmd-a", "cmd-b"]);
		});

		// 测试场景：验证“gets command by invocation name”对应的行为、结果与边界。
		it("gets command by invocation name", async () => {
			/** 常量 cmdCode 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const cmdCode = `
				export default function(pi) {
					pi.registerCommand("my-cmd", {
						description: "My command",
						handler: async () => {},
					});
				}
			`;
			fs.writeFileSync(path.join(extensionsDir, "cmd.ts"), cmdCode);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await discoverAndLoadExtensions([], tempDir, tempDir);
			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner(result.extensions, result.runtime, tempDir, sessionManager, modelRegistry);

			/** 常量 cmd 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const cmd = runner.getCommand("my-cmd");
			expect(cmd).toBeDefined();
			expect(cmd?.name).toBe("my-cmd");
			expect(cmd?.invocationName).toBe("my-cmd");
			expect(cmd?.description).toBe("My command");

			/** 常量 missing 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const missing = runner.getCommand("not-exists");
			expect(missing).toBeUndefined();
		});

		// 测试场景：验证“suffixes duplicate extension commands in insertion order”对应的行为、结果与边界。
		it("suffixes duplicate extension commands in insertion order", async () => {
			/** cmdCode 封装当前回调或辅助步骤；参数 description: string 提供输入，返回值用于后续流程。示例：cmdCode(...)。 */
			const cmdCode = (description: string) => `
				export default function(pi) {
					pi.registerCommand("shared-cmd", {
						description: "${description}",
						handler: async () => {},
					});
				}
			`;
			fs.writeFileSync(path.join(extensionsDir, "cmd-a.ts"), cmdCode("First command"));
			fs.writeFileSync(path.join(extensionsDir, "cmd-b.ts"), cmdCode("Second command"));

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await discoverAndLoadExtensions([], tempDir, tempDir);
			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner(result.extensions, result.runtime, tempDir, sessionManager, modelRegistry);
			/** 常量 commands 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const commands = runner.getRegisteredCommands();
			/** 常量 diagnostics 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const diagnostics = runner.getCommandDiagnostics();

			expect(commands).toHaveLength(2);
			expect(commands.map((command) => command.name)).toEqual(["shared-cmd", "shared-cmd"]);
			expect(commands.map((command) => command.invocationName)).toEqual(["shared-cmd:1", "shared-cmd:2"]);
			expect(commands.map((command) => command.description)).toEqual(["First command", "Second command"]);
			expect(diagnostics).toEqual([]);
			expect(runner.getCommand("shared-cmd:1")?.description).toBe("First command");
			expect(runner.getCommand("shared-cmd:2")?.description).toBe("Second command");
		});
	});

	// 用例分组：集中验证“context creation”相关功能。
	describe("context creation", () => {
		// 测试场景：验证“exposes the current abort signal on ExtensionContext”对应的行为、结果与边界。
		it("exposes the current abort signal on ExtensionContext", async () => {
			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await discoverAndLoadExtensions([], tempDir, tempDir);
			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner(result.extensions, result.runtime, tempDir, sessionManager, modelRegistry);
			/** 常量 controller 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const controller = new AbortController();

			runner.bindCore(extensionActions, {
				...extensionContextActions,
				getSignal: () => controller.signal,
			});

			/** 常量 ctx 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const ctx = runner.createContext();
			expect(ctx.signal).toBe(controller.signal);
			expect(ctx.signal?.aborted).toBe(false);

			controller.abort();
			expect(ctx.signal?.aborted).toBe(true);
		});

		// 测试场景：验证“exposes print mode and hasUI false by default”对应的行为、结果与边界。
		it("exposes print mode and hasUI false by default", async () => {
			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await discoverAndLoadExtensions([], tempDir, tempDir);
			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner(result.extensions, result.runtime, tempDir, sessionManager, modelRegistry);
			runner.bindCore(extensionActions, extensionContextActions);

			/** 常量 ctx 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const ctx = runner.createContext();
			expect(ctx.mode).toBe("print");
			expect(ctx.hasUI).toBe(false);
		});

		// 测试场景：验证“exposes project trust state on ExtensionContext”对应的行为、结果与边界。
		it("exposes project trust state on ExtensionContext", async () => {
			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await discoverAndLoadExtensions([], tempDir, tempDir);
			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner(result.extensions, result.runtime, tempDir, sessionManager, modelRegistry);
			runner.bindCore(extensionActions, {
				...extensionContextActions,
				isProjectTrusted: () => false,
			});

			/** 常量 ctx 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const ctx = runner.createContext();
			expect(ctx.isProjectTrusted()).toBe(false);
		});

		// 测试场景：验证“exposes rpc mode with hasUI true when an RPC UI context is provided”对应的行为、结果与边界。
		it("exposes rpc mode with hasUI true when an RPC UI context is provided", async () => {
			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await discoverAndLoadExtensions([], tempDir, tempDir);
			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner(result.extensions, result.runtime, tempDir, sessionManager, modelRegistry);
			runner.bindCore(extensionActions, extensionContextActions);
			runner.setUIContext({} as ExtensionUIContext, "rpc");

			/** 常量 ctx 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const ctx = runner.createContext();
			expect(ctx.mode).toBe("rpc");
			expect(ctx.hasUI).toBe(true);
		});

		// 测试场景：验证“exposes tui mode with hasUI true when a TUI UI context is provided”对应的行为、结果与边界。
		it("exposes tui mode with hasUI true when a TUI UI context is provided", async () => {
			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await discoverAndLoadExtensions([], tempDir, tempDir);
			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner(result.extensions, result.runtime, tempDir, sessionManager, modelRegistry);
			runner.bindCore(extensionActions, extensionContextActions);
			runner.setUIContext({} as ExtensionUIContext, "tui");

			/** 常量 ctx 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const ctx = runner.createContext();
			expect(ctx.mode).toBe("tui");
			expect(ctx.hasUI).toBe(true);
		});
	});

	// 用例分组：集中验证“error handling”相关功能。
	describe("error handling", () => {
		// 测试场景：验证“calls error listeners when handler throws”对应的行为、结果与边界。
		it("calls error listeners when handler throws", async () => {
			/** 常量 extCode 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extCode = `
				export default function(pi) {
					pi.on("context", async () => {
						throw new Error("Handler error!");
					});
				}
			`;
			fs.writeFileSync(path.join(extensionsDir, "throws.ts"), extCode);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await discoverAndLoadExtensions([], tempDir, tempDir);
			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner(result.extensions, result.runtime, tempDir, sessionManager, modelRegistry);

			/** 常量 errors 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const errors: Array<{ extensionPath: string; event: string; error: string }> = [];
			runner.onError((err) => {
				errors.push(err);
			});

			// Emit context event which will trigger the throwing handler
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			await runner.emitContext([]);

			expect(errors.length).toBe(1);
			expect(errors[0].error).toContain("Handler error!");
			expect(errors[0].event).toBe("context");
		});
	});

	// 用例分组：集中验证“message and entry renderers”相关功能。
	describe("message and entry renderers", () => {
		// 测试场景：验证“gets message renderer by type”对应的行为、结果与边界。
		it("gets message renderer by type", async () => {
			/** 常量 extCode 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extCode = `
				export default function(pi) {
					pi.registerMessageRenderer("my-type", (message, options, theme) => null);
				}
			`;
			fs.writeFileSync(path.join(extensionsDir, "renderer.ts"), extCode);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await discoverAndLoadExtensions([], tempDir, tempDir);
			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner(result.extensions, result.runtime, tempDir, sessionManager, modelRegistry);

			/** 常量 renderer 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const renderer = runner.getMessageRenderer("my-type");
			expect(renderer).toBeDefined();

			/** 常量 missing 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const missing = runner.getMessageRenderer("not-exists");
			expect(missing).toBeUndefined();
		});

		// 测试场景：验证“gets entry renderer by type”对应的行为、结果与边界。
		it("gets entry renderer by type", async () => {
			/** 常量 extCode 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extCode = `
				export default function(pi) {
					pi.registerEntryRenderer("my-entry", (entry, options, theme) => null);
				}
			`;
			fs.writeFileSync(path.join(extensionsDir, "entry-renderer.ts"), extCode);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await discoverAndLoadExtensions([], tempDir, tempDir);
			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner(result.extensions, result.runtime, tempDir, sessionManager, modelRegistry);

			expect(runner.getEntryRenderer("my-entry")).toBeDefined();
			expect(runner.getEntryRenderer("not-exists")).toBeUndefined();
		});
	});

	// 用例分组：集中验证“flags”相关功能。
	describe("flags", () => {
		// 测试场景：验证“collects flags from extensions”对应的行为、结果与边界。
		it("collects flags from extensions", async () => {
			/** 常量 extCode 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extCode = `
				export default function(pi) {
					pi.registerFlag("my-flag", {
						description: "My flag",
						handler: async () => {},
					});
				}
			`;
			fs.writeFileSync(path.join(extensionsDir, "with-flag.ts"), extCode);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await discoverAndLoadExtensions([], tempDir, tempDir);
			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner(result.extensions, result.runtime, tempDir, sessionManager, modelRegistry);
			/** 常量 flags 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const flags = runner.getFlags();

			expect(flags.has("my-flag")).toBe(true);
		});

		// 测试场景：验证“keeps first flag when two extensions register the same name”对应的行为、结果与边界。
		it("keeps first flag when two extensions register the same name", async () => {
			/** 常量 first 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const first = `
				export default function(pi) {
					pi.registerFlag("shared-flag", {
						description: "first",
						type: "boolean",
						default: true,
					});
				}
			`;
			/** 常量 second 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const second = `
				export default function(pi) {
					pi.registerFlag("shared-flag", {
						description: "second",
						type: "boolean",
						default: false,
					});
				}
			`;
			fs.writeFileSync(path.join(extensionsDir, "a-first.ts"), first);
			fs.writeFileSync(path.join(extensionsDir, "b-second.ts"), second);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await discoverAndLoadExtensions([], tempDir, tempDir);
			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner(result.extensions, result.runtime, tempDir, sessionManager, modelRegistry);
			/** 常量 flags 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const flags = runner.getFlags();

			expect(flags.get("shared-flag")?.description).toBe("first");
			expect(result.runtime.flagValues.get("shared-flag")).toBe(true);
		});

		// 测试场景：验证“can set flag values”对应的行为、结果与边界。
		it("can set flag values", async () => {
			/** 常量 extCode 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extCode = `
				export default function(pi) {
					pi.registerFlag("test-flag", {
						description: "Test flag",
						handler: async () => {},
					});
				}
			`;
			fs.writeFileSync(path.join(extensionsDir, "flag.ts"), extCode);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await discoverAndLoadExtensions([], tempDir, tempDir);
			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner(result.extensions, result.runtime, tempDir, sessionManager, modelRegistry);

			// Setting a flag value should not throw
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			runner.setFlagValue("--test-flag", true);

			// The flag values are stored in the shared runtime
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(result.runtime.flagValues.get("--test-flag")).toBe(true);
		});
	});

	// 用例分组：集中验证“before_agent_start”相关功能。
	describe("before_agent_start", () => {
		// 测试场景：验证“keeps ctx.getSystemPrompt() in sync with chained system prompt updates”对应的行为、结果与边界。
		it("keeps ctx.getSystemPrompt() in sync with chained system prompt updates", async () => {
			/** 常量 extCode1 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extCode1 = `
				export default function(pi) {
					pi.on("before_agent_start", async (_event, ctx) => {
						return {
							systemPrompt: ctx.getSystemPrompt() + "\\nfirst",
						};
					});
				}
			`;
			/** 常量 extCode2 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extCode2 = `
				export default function(pi) {
					pi.on("before_agent_start", async (_event, ctx) => {
						return {
							systemPrompt: ctx.getSystemPrompt() + "\\nsecond",
						};
					});
				}
			`;
			fs.writeFileSync(path.join(extensionsDir, "before-agent-start-1.ts"), extCode1);
			fs.writeFileSync(path.join(extensionsDir, "before-agent-start-2.ts"), extCode2);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await discoverAndLoadExtensions([], tempDir, tempDir);
			expect(result.errors).toEqual([]);
			expect(result.extensions).toHaveLength(2);
			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner(result.extensions, result.runtime, tempDir, sessionManager, modelRegistry);
			/** 常量 errors 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const errors: string[] = [];
			runner.onError((error) => errors.push(error.error));
			runner.bindCore(extensionActions, extensionContextActions);

			/** 常量 chained 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const chained = await runner.emitBeforeAgentStart("hello", undefined, "base", {
				cwd: tempDir,
			});

			expect(errors).toEqual([]);

			expect(chained).toEqual({
				messages: undefined,
				systemPrompt: "base\nfirst\nsecond",
			});
		});
	});

	// 用例分组：集中验证“tool_result chaining”相关功能。
	describe("tool_result chaining", () => {
		// 测试场景：验证“chains content modifications across handlers”对应的行为、结果与边界。
		it("chains content modifications across handlers", async () => {
			/** 常量 extCode1 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extCode1 = `
				export default function(pi) {
					pi.on("tool_result", async (event) => {
						return {
							content: [...event.content, { type: "text", text: "ext1" }],
						};
					});
				}
			`;
			/** 常量 extCode2 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extCode2 = `
				export default function(pi) {
					pi.on("tool_result", async (event) => {
						return {
							content: [...event.content, { type: "text", text: "ext2" }],
						};
					});
				}
			`;
			fs.writeFileSync(path.join(extensionsDir, "tool-result-1.ts"), extCode1);
			fs.writeFileSync(path.join(extensionsDir, "tool-result-2.ts"), extCode2);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await discoverAndLoadExtensions([], tempDir, tempDir);
			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner(result.extensions, result.runtime, tempDir, sessionManager, modelRegistry);

			/** 常量 chained 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const chained = await runner.emitToolResult({
				type: "tool_result",
				toolName: "my_tool",
				toolCallId: "call-1",
				input: {},
				content: [{ type: "text", text: "base" }],
				details: { initial: true },
				isError: false,
			});

			expect(chained).toBeDefined();
			/** 常量 chainedContent 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const chainedContent = chained?.content;
			expect(chainedContent).toBeDefined();
			expect(chainedContent![0]).toEqual({ type: "text", text: "base" });
			expect(chainedContent).toHaveLength(3);
			/** 常量 appendedText 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const appendedText = chainedContent!
				.slice(1)
				.filter((item): item is { type: "text"; text: string } => item.type === "text")
				.map((item) => item.text);
			expect(appendedText.sort()).toEqual(["ext1", "ext2"]);
		});

		// 测试场景：验证“preserves previous modifications when later handlers return partial patches”对应的行为、结果与边界。
		it("preserves previous modifications when later handlers return partial patches", async () => {
			/** 常量 extCode1 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extCode1 = `
				export default function(pi) {
					pi.on("tool_result", async () => {
						return {
							content: [{ type: "text", text: "first" }],
							details: { source: "ext1" },
						};
					});
				}
			`;
			/** 常量 extCode2 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extCode2 = `
				export default function(pi) {
					pi.on("tool_result", async () => {
						return {
							isError: true,
						};
					});
				}
			`;
			fs.writeFileSync(path.join(extensionsDir, "tool-result-partial-1.ts"), extCode1);
			fs.writeFileSync(path.join(extensionsDir, "tool-result-partial-2.ts"), extCode2);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await discoverAndLoadExtensions([], tempDir, tempDir);
			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner(result.extensions, result.runtime, tempDir, sessionManager, modelRegistry);

			/** 常量 chained 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const chained = await runner.emitToolResult({
				type: "tool_result",
				toolName: "my_tool",
				toolCallId: "call-2",
				input: {},
				content: [{ type: "text", text: "base" }],
				details: { initial: true },
				isError: false,
			});

			expect(chained).toEqual({
				content: [{ type: "text", text: "first" }],
				details: { source: "ext1" },
				isError: true,
			});
		});
	});

	// 用例分组：集中验证“provider registration”相关功能。
	describe("provider registration", () => {
		// 测试场景：验证“bindCore ignores invalid queued registrations and reports extension error”对应的行为、结果与边界。
		it("bindCore ignores invalid queued registrations and reports extension error", async () => {
			/** 常量 runtime 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runtime = createExtensionRuntime();
			runtime.registerProvider(
				"broken-provider",
				{
					streamSimple: (() => {
						throw new Error("should not run");
					}) as any,
				},
				"/tmp/broken-extension.ts",
			);

			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner([], runtime, tempDir, sessionManager, modelRegistry);
			/** 常量 errors 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const errors: string[] = [];
			runner.onError((error) => errors.push(`${error.extensionPath}: ${error.error}`));

			expect(() => runner.bindCore(extensionActions, extensionContextActions)).not.toThrow();
			expect(errors).toEqual([
				'/tmp/broken-extension.ts: Provider broken-provider: "api" is required when registering streamSimple.',
			]);
			await expect(modelRegistry.refresh()).resolves.toBeUndefined();
		});

		// 测试场景：验证“pre-bind unregister removes all queued registrations for a provider”对应的行为、结果与边界。
		it("pre-bind unregister removes all queued registrations for a provider", () => {
			/** 常量 runtime 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runtime = createExtensionRuntime();

			runtime.registerProvider("queued-provider", providerModelConfig);
			runtime.registerProvider("queued-provider", {
				...providerModelConfig,
				models: [
					{
						id: "instant-model-2",
						name: "Instant Model 2",
						reasoning: false,
						input: ["text"],
						cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
						contextWindow: 128000,
						maxTokens: 4096,
					},
				],
			});
			expect(runtime.pendingProviderRegistrations).toHaveLength(2);

			runtime.unregisterProvider("queued-provider");
			expect(runtime.pendingProviderRegistrations).toHaveLength(0);
		});

		// 测试场景：验证“post-bind register and unregister take effect immediately”对应的行为、结果与边界。
		it("post-bind register and unregister take effect immediately", () => {
			/** 常量 runtime 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runtime = createExtensionRuntime();
			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner([], runtime, tempDir, sessionManager, modelRegistry);

			runner.bindCore(extensionActions, extensionContextActions);
			expect(runtime.pendingProviderRegistrations).toHaveLength(0);

			runtime.registerProvider("instant-provider", providerModelConfig);
			expect(runtime.pendingProviderRegistrations).toHaveLength(0);
			expect(modelRegistry.find("instant-provider", "instant-model")?.cost.tiers).toEqual([
				{
					inputTokensAbove: 272000,
					input: 2,
					output: 3,
					cacheRead: 0.2,
					cacheWrite: 2.5,
				},
			]);

			runtime.unregisterProvider("instant-provider");
			expect(modelRegistry.find("instant-provider", "instant-model")).toBeUndefined();
		});
	});

	// 用例分组：集中验证“command context”相关功能。
	describe("command context", () => {
		// 测试场景：验证“passes fork options through to the bound handler”对应的行为、结果与边界。
		it("passes fork options through to the bound handler", async () => {
			/** 常量 runtime 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runtime = createExtensionRuntime();
			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner([], runtime, tempDir, sessionManager, modelRegistry);
			/** 常量 fork 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const fork = vi.fn(async () => ({ cancelled: false }));

			runner.bindCommandContext({
				waitForIdle: async () => {},
				newSession: async () => ({ cancelled: false }),
				fork,
				navigateTree: async () => ({ cancelled: false }),
				switchSession: async () => ({ cancelled: false }),
				reload: async () => {},
			});

			/** 常量 commandContext 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const commandContext = runner.createCommandContext();
			await commandContext.fork("entry-1");
			expect(fork).toHaveBeenCalledWith("entry-1", undefined);

			await commandContext.fork("entry-2", { position: "at" });
			expect(fork).toHaveBeenLastCalledWith("entry-2", { position: "at" });
		});
	});

	// 用例分组：集中验证“hasHandlers”相关功能。
	describe("hasHandlers", () => {
		// 测试场景：验证“returns true when handlers exist for event type”对应的行为、结果与边界。
		it("returns true when handlers exist for event type", async () => {
			/** 常量 extCode 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extCode = `
				export default function(pi) {
					pi.on("tool_call", async () => undefined);
				}
			`;
			fs.writeFileSync(path.join(extensionsDir, "handler.ts"), extCode);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await discoverAndLoadExtensions([], tempDir, tempDir);
			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner(result.extensions, result.runtime, tempDir, sessionManager, modelRegistry);

			expect(runner.hasHandlers("tool_call")).toBe(true);
			expect(runner.hasHandlers("agent_end")).toBe(false);
		});
	});

	// 用例分组：集中验证“before_provider_headers”相关功能。
	describe("before_provider_headers", () => {
		// 测试场景：验证“lets a handler mutate headers in place and preserves existing headers”对应的行为、结果与边界。
		it("lets a handler mutate headers in place and preserves existing headers", async () => {
			/** 常量 extCode 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const extCode = `
				export default function(pi) {
					pi.on("before_provider_headers", (event) => {
						event.headers["X-Turn-Index"] = "3";
					});
				}
			`;
			fs.writeFileSync(path.join(extensionsDir, "headers.ts"), extCode);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await discoverAndLoadExtensions([], tempDir, tempDir);
			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner(result.extensions, result.runtime, tempDir, sessionManager, modelRegistry);

			expect(runner.hasHandlers("before_provider_headers")).toBe(true);

			/** 常量 headers 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const headers = await runner.emitBeforeProviderHeaders({ "User-Agent": "kimchi/1.0" });
			expect(headers["X-Turn-Index"]).toBe("3");
			expect(headers["User-Agent"]).toBe("kimchi/1.0");
		});

		// 测试场景：验证“isolates a throwing handler and still applies the others”对应的行为、结果与边界。
		it("isolates a throwing handler and still applies the others", async () => {
			/** 常量 throwing 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const throwing = `
				export default function(pi) {
					pi.on("before_provider_headers", () => {
						throw new Error("header handler boom");
					});
				}
			`;
			/** 常量 good 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const good = `
				export default function(pi) {
					pi.on("before_provider_headers", (event) => {
						event.headers["X-Good"] = "yes";
					});
				}
			`;
			fs.writeFileSync(path.join(extensionsDir, "a-throwing.ts"), throwing);
			fs.writeFileSync(path.join(extensionsDir, "b-good.ts"), good);

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await discoverAndLoadExtensions([], tempDir, tempDir);
			/** 常量 runner 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const runner = new ExtensionRunner(result.extensions, result.runtime, tempDir, sessionManager, modelRegistry);
			/** 常量 errors 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const errors: Array<{ event: string; error: string }> = [];
			runner.onError((err) => errors.push(err));

			/** 常量 headers 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const headers = await runner.emitBeforeProviderHeaders({ "User-Agent": "x" });

			expect(headers["X-Good"]).toBe("yes");
			expect(headers["User-Agent"]).toBe("x");
			expect(errors).toHaveLength(1);
			expect(errors[0].event).toBe("before_provider_headers");
			expect(errors[0].error).toContain("header handler boom");
		});
	});
});
