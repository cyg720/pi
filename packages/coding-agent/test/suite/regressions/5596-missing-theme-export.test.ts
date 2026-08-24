/**
 * 文件职责：回归验证配置主题缺失时 HTML 导出使用当前回退主题且不改写用户设置。
 * 技术维度：使用 Vitest、faux 提供商、AgentSession、内存认证与模型注册表进行集成测试。
 * 产品维度：避免主题文件删除后会话无法导出，同时保留用户原主题名便于恢复。
 * 逻辑维度：构建虚拟会话并生成消息，初始化缺失主题，导出 HTML 后检查文件和设置。
 * 关键边界：使用临时目录和虚拟模型；afterEach 恢复深色主题并执行全部清理函数。
 * 新手阅读建议：先看 faux 模型注册，再跟随 AgentSession 构造、prompt、initTheme 和 export。
 */
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Agent } from "@earendil-works/pi-agent-core";
import { fauxAssistantMessage, registerFauxProvider, streamSimple } from "@earendil-works/pi-ai/compat";
import { afterEach, describe, expect, it } from "vitest";
import { AgentSession } from "../../../src/core/agent-session.ts";
import { AuthStorage } from "../../../src/core/auth-storage.ts";
import { convertToLlm } from "../../../src/core/messages.ts";
import { SessionManager } from "../../../src/core/session-manager.ts";
import { SettingsManager } from "../../../src/core/settings-manager.ts";
import { initTheme } from "../../../src/modes/interactive/theme/theme.ts";
import { createInMemoryModelRegistry, getModelRuntime } from "../../model-runtime-test-utils.ts";
import { createTestResourceLoader } from "../../utilities.ts";

describe("regression #5596: missing configured theme export", () => {
	// cleanups 保存会话、提供商和临时目录的释放函数。
	const cleanups: Array<() => void> = [];

	// 每例后逆序执行清理并恢复深色主题；无参数，无返回值。
	afterEach(() => {
		while (cleanups.length > 0) {
			cleanups.pop()?.();
		}
		initTheme("dark");
	});

	// 验证缺失配置主题时仍能用回退主题导出且保留设置值；无参数，无返回值。
	it("exports with the active fallback theme when the configured theme is missing", async () => {
		// tempDir 是会话、设置和导出文件的临时根目录。
		const tempDir = mkdtempSync(join(tmpdir(), "pi-5596-"));
		// faux 是注册一个无推理模型的虚拟提供商控制器。
		const faux = registerFauxProvider({
			models: [{ id: "faux-1", reasoning: false }],
		});
		faux.setResponses([fauxAssistantMessage("hello")]);

		// model 是 faux 提供商唯一的测试模型。
		const model = faux.getModel();
		// authStorage 保存虚拟 API 密钥的内存认证表。
		const authStorage = AuthStorage.inMemory();
		await authStorage.modify(model.provider, async () => ({ type: "api_key", key: "faux-key" }));
		// modelRegistry 是绑定内存认证的运行时模型注册表。
		const modelRegistry = await createInMemoryModelRegistry(authStorage);
		modelRegistry.registerProvider(model.provider, {
			baseUrl: model.baseUrl,
			apiKey: "faux-key",
			api: faux.api,
			// registeredModel 是当前 faux 模型，回调复制注册所需字段。
			models: faux.models.map((registeredModel) => ({
				id: registeredModel.id,
				name: registeredModel.name,
				api: registeredModel.api,
				reasoning: registeredModel.reasoning,
				input: registeredModel.input,
				cost: registeredModel.cost,
				contextWindow: registeredModel.contextWindow,
				maxTokens: registeredModel.maxTokens,
				baseUrl: registeredModel.baseUrl,
			})),
		});

		// settingsManager 故意配置不存在的主题名。
		const settingsManager = SettingsManager.inMemory({ theme: "missing-theme" });
		// sessionManager 把临时目录作为会话存储位置。
		const sessionManager = SessionManager.create(tempDir, join(tempDir, "sessions"));
		// agent 使用 faux 流函数和固定系统提示构造底层代理。
		const agent = new Agent({
			getApiKey: () => "faux-key",
			initialState: {
				model,
				systemPrompt: "You are a test assistant.",
				tools: [],
			},
			convertToLlm,
			streamFn: streamSimple,
		});
		// session 组合代理、设置、模型运行时和资源加载器。
		const session = new AgentSession({
			agent,
			sessionManager,
			settingsManager,
			cwd: tempDir,
			modelRuntime: getModelRuntime(modelRegistry),
			resourceLoader: createTestResourceLoader(),
		});
		cleanups.push(() => {
			session.dispose();
			faux.unregister();
			if (existsSync(tempDir)) {
				rmSync(tempDir, { recursive: true, force: true });
			}
		});

		await session.prompt("hi");
		initTheme(settingsManager.getTheme());

		// outputPath 是待生成的 HTML 文件路径。
		const outputPath = join(tempDir, "export.html");
		await expect(session.exportToHtml(outputPath)).resolves.toBe(outputPath);
		expect(existsSync(outputPath)).toBe(true);
		expect(settingsManager.getTheme()).toBe("missing-theme");
	});
});
