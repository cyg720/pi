/**
 * 文件职责：验证会话重载后会采用最新的顶层提示模板配置，防止旧资源设置继续生效。
 * 技术维度：使用 Vitest、临时目录、内存鉴权存储与 faux 模型提供商构造完整会话运行时。
 * 产品维度：保障用户修改 settings.json 后无需重启即可正确启用或停用提示模板。
 * 逻辑维度：创建测试提示模板与运行时，确认初始可见，写入排除配置，重载后再次断言。
 * 关键边界：测试必须释放会话、注销提供商并删除临时目录，避免跨用例状态污染。
 * 新手阅读建议：先看主测试的三段断言，再沿 createRuntime 了解服务和会话如何组装。
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerFauxProvider } from "@earendil-works/pi-ai/compat";
import { afterEach, describe, expect, it } from "vitest";
import {
	type CreateAgentSessionRuntimeFactory,
	createAgentSessionFromServices,
	createAgentSessionRuntime,
	createAgentSessionServices,
} from "../../../src/core/agent-session-runtime.ts";
import { AuthStorage } from "../../../src/core/auth-storage.ts";
import { ModelRuntime } from "../../../src/core/model-runtime.ts";
import { SessionManager } from "../../../src/core/session-manager.ts";

describe("issue #2753 reload stale resource settings", () => {
	// 保存本套件产生的清理函数；元素无参数且无返回值，每个用例结束后按后进先出顺序执行。
	const cleanups: Array<() => void> = [];

	// 功能：清空清理栈并释放当前用例资源；参数：无；返回：无。示例：Vitest 会在每个用例后自动调用。
	afterEach(() => {
		while (cleanups.length > 0) {
			cleanups.pop()?.();
		}
	});

	it("applies updated top-level prompt settings on reload after startup", async () => {
		// 当前用例独占的临时根目录；随机后缀用于避免并行测试发生路径冲突。
		const tempDir = join(tmpdir(), `pi-2753-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		// 模拟用户级代理配置目录，必须位于本用例临时根目录内。
		const agentDir = join(tempDir, "agent");
		// 存放提示模板的目录；其相对位置需符合资源加载器约定。
		const promptsDir = join(agentDir, "prompts");
		mkdirSync(promptsDir, { recursive: true });
		writeFileSync(join(promptsDir, "test.md"), "Echo test prompt\n");

		// 注册仅供测试使用的模型提供商；用例结束时必须调用 unregister。
		const faux = registerFauxProvider({
			models: [{ id: "faux-1", reasoning: false }],
		});
		// 内存鉴权存储，避免读取或改写用户真实凭据。
		const authStorage = AuthStorage.inMemory();
		await authStorage.modify(faux.getModel().provider, async () => ({ type: "api_key", key: "faux-key" }));
		// 模型运行时负责把测试凭据与代理目录中的模型配置连接起来。
		const modelRuntime = await ModelRuntime.create({
			credentials: authStorage,
			modelsPath: join(agentDir, "models.json"),
		});

		/**
		 * 功能：按测试参数创建可重载的会话运行时；参数：工作目录、会话管理器和启动事件；返回：完整运行时对象。
		 * 使用示例：createAgentSessionRuntime(createRuntime, options) 会调用本工厂完成会话装配。
		 */
		const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
			// 本次会话所需的服务集合，包含模型、资源加载器与诊断信息。
			const services = await createAgentSessionServices({
				cwd,
				agentDir,
				modelRuntime,
				resourceLoaderOptions: {
					extensionFactories: [
						(pi) => {
							// pi 是扩展注册上下文；此回调把 faux 提供商及其模型元数据加入会话且不返回值。
							pi.registerProvider(faux.getModel().provider, {
								baseUrl: faux.getModel().baseUrl,
								apiKey: "faux-key",
								api: faux.api,
								models: faux.models.map((registeredModel) => ({
									// registeredModel 是单个测试模型；回调返回扩展 API 所需的元数据对象。
									id: registeredModel.id,
									name: registeredModel.name,
									api: registeredModel.api,
									reasoning: registeredModel.reasoning,
									input: registeredModel.input,
									cost: registeredModel.cost,
									contextWindow: registeredModel.contextWindow,
									maxTokens: registeredModel.maxTokens,
								})),
							});
						},
					],
					noSkills: true,
					noThemes: true,
				},
			});
			return {
				...(await createAgentSessionFromServices({
					services,
					sessionManager,
					sessionStartEvent,
					model: faux.getModel(),
				})),
				services,
				diagnostics: services.diagnostics,
			};
		};
		// 供断言使用的实际运行时；其 session 支持 reload，services 暴露最新设置。
		const runtime = await createAgentSessionRuntime(createRuntime, {
			cwd: tempDir,
			agentDir,
			sessionManager: SessionManager.create(tempDir),
		});

		cleanups.push(() => {
			// 清理回调无参数、无返回值，确保异常断言后也不会留下全局提供商或临时文件。
			runtime.session.dispose();
			faux.unregister();
			if (existsSync(tempDir)) {
				rmSync(tempDir, { recursive: true, force: true });
			}
		});

		// map 回调接收单个提示模板并返回其名称，用于简化包含关系断言。
		expect(runtime.session.promptTemplates.map((prompt) => prompt.name)).toContain("test");
		// 上述映射回调接收单个提示模板并返回其名称，用于简化包含关系断言。

		writeFileSync(join(agentDir, "settings.json"), `${JSON.stringify({ prompts: ["-prompts/test.md"] }, null, 2)}\n`);

		await runtime.session.reload();

		expect(runtime.services.settingsManager.getGlobalSettings().prompts).toEqual(["-prompts/test.md"]);
		// map 回调同样只读取名称，验证重载后 test 模板已经被排除。
		expect(runtime.session.promptTemplates.map((prompt) => prompt.name)).not.toContain("test");
		// 上述映射回调同样只读取名称，验证重载后 test 模板已经被排除。
	});
});
