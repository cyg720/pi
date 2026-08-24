/**
 * 文件职责：验证扩展在加载、session_start 和命令执行阶段动态注册提供商后，活动会话立即采用新配置。
 * 技术维度：使用真实 ModelRuntime/ResourceLoader、内存 SessionManager、临时认证目录和伪流函数执行集成测试。
 * 产品维度：支持扩展按项目或命令切换代理地址及原生 pi-ai 提供商，而无需重载或重启会话。
 * 逻辑维度：先创建最小原生提供商和会话工厂，再从不同扩展生命周期注册覆盖并捕获实际请求 baseUrl。
 * 关键边界：测试不会发送模型请求；streamFunction 读取 baseUrl 后主动抛错，所有会话需显式 dispose。
 * 新手阅读建议：先看 createSession 的组装链，再比较字符串覆盖注册与 Provider 对象注册两种形式。
 */
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Provider } from "@earendil-works/pi-ai";
import { getModel } from "@earendil-works/pi-ai/compat";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { ModelRuntime } from "../src/core/model-runtime.ts";
import { DefaultResourceLoader } from "../src/core/resource-loader.ts";
import type { ExtensionFactory } from "../src/core/sdk.ts";
import { createAgentSession } from "../src/core/sdk.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";

/**
 * 构造仅用于动态注册测试的原生 Anthropic 提供商。
 * @param baseUrl 希望模型请求采用的基础地址。
 * @returns 带固定认证、模型列表和不可调用流函数的 Provider；例如 `nativeAnthropicProvider("http://localhost")`。
 */
function nativeAnthropicProvider(baseUrl: string): Provider {
	// model 复制内置模型元数据并覆盖待验证的基础地址。
	const model = { ...getModel("anthropic", "claude-sonnet-4-5")!, baseUrl };
	return {
		id: "anthropic",
		name: "Native Anthropic",
		baseUrl,
		auth: {
			apiKey: {
				name: "Test API key",
				resolve: async () => ({ auth: { apiKey: "test-key" }, source: "test" }),
			},
		},
		getModels: () => [model],
		stream: () => {
			throw new Error("unused");
		},
		streamSimple: () => {
			throw new Error("unused");
		},
	};
}

// 验证不同扩展生命周期内的提供商注册都会同步更新活动模型。
describe("AgentSession dynamic provider registration", () => {
	// tempDir 是每个用例的工作目录和清理根目录。
	let tempDir: string;
	// agentDir 位于 tempDir 内，保存认证和模型配置。
	let agentDir: string;

	// 每个用例前创建隔离的 agent 目录。
	beforeEach(() => {
		tempDir = join(tmpdir(), `pi-dynamic-provider-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		agentDir = join(tempDir, "agent");
		mkdirSync(agentDir, { recursive: true });
	});

	// 用例结束后递归删除所有临时资源。
	afterEach(() => {
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	/**
	 * 用给定扩展工厂创建完整 AgentSession。
	 * @param extensionFactories 要在资源加载阶段安装的扩展列表。
	 * @returns 已加载扩展的会话；例如 `await createSession([(pi) => ...])`。
	 */
	async function createSession(extensionFactories: ExtensionFactory[]) {
		// settingsManager 读取临时项目与 agent 目录的设置。
		const settingsManager = SettingsManager.create(tempDir, agentDir);
		// sessionManager 使用内存模式，避免产生会话文件。
		const sessionManager = SessionManager.inMemory();
		// authStorage 保存当前用例的假 Anthropic 密钥。
		const authStorage = AuthStorage.create(join(agentDir, "auth.json"));
		await authStorage.modify("anthropic", async () => ({ type: "api_key", key: "test-key" }));
		// modelRuntime 提供扩展可动态修改的提供商与模型注册表。
		const modelRuntime = await ModelRuntime.create({
			credentials: authStorage,
			modelsPath: join(agentDir, "models.json"),
		});
		// resourceLoader 负责加载本用例传入的扩展工厂。
		const resourceLoader = new DefaultResourceLoader({
			cwd: tempDir,
			agentDir,
			settingsManager,
			extensionFactories,
		});
		await resourceLoader.reload();

		// session 是用上述依赖创建的活动代理会话。
		const { session } = await createAgentSession({
			cwd: tempDir,
			agentDir,
			model: getModel("anthropic", "claude-sonnet-4-5")!,
			settingsManager,
			sessionManager,
			modelRuntime,
			resourceLoader,
		});

		return session;
	}

	/**
	 * 截获下一次 prompt 实际传给流函数的模型基础地址。
	 * @param session 由 createSession 创建的测试会话。
	 * @returns 捕获的 baseUrl 或 undefined；例如 `await capturePromptBaseUrl(session)`。
	 */
	async function capturePromptBaseUrl(
		session: Awaited<ReturnType<typeof createSession>>,
	): Promise<string | undefined> {
		// baseUrl 在伪流函数被调用时从实际模型中读取。
		let baseUrl: string | undefined;
		session.agent.streamFunction = async (model) => {
			baseUrl = model.baseUrl;
			throw new Error("stop");
		};
		await session.prompt("hello");
		return baseUrl;
	}

	// 扩展顶层字符串形式的覆盖应在首个提示前生效。
	it("applies top-level registerProvider overrides to the active model", async () => {
		// session 加载一个顶层覆盖 Anthropic baseUrl 的扩展。
		const session = await createSession([
			(pi) => {
				pi.registerProvider("anthropic", { baseUrl: "http://localhost:8080/top-level" });
			},
		]);

		expect(session.model?.baseUrl).toBe("http://localhost:8080/top-level");
		expect(await capturePromptBaseUrl(session)).toBe("http://localhost:8080/top-level");

		session.dispose();
	});

	// session_start 事件中的覆盖应在 bindExtensions 后立即更新模型。
	it("applies session_start registerProvider overrides to the active model", async () => {
		// session 的扩展仅在 session_start 回调内注册覆盖。
		const session = await createSession([
			(pi) => {
				pi.on("session_start", () => {
					pi.registerProvider("anthropic", { baseUrl: "http://localhost:8080/session-start" });
				});
			},
		]);

		await session.bindExtensions({});

		expect(session.model?.baseUrl).toBe("http://localhost:8080/session-start");
		expect(await capturePromptBaseUrl(session)).toBe("http://localhost:8080/session-start");

		session.dispose();
	});

	// 顶层也可直接注册完整的 pi-ai Provider 对象。
	it("registers native pi-ai providers during extension loading", async () => {
		// session 加载原生 Provider 对象形式的扩展。
		const session = await createSession([
			(pi) => {
				pi.registerProvider(nativeAnthropicProvider("http://localhost:8080/native-top-level"));
			},
		]);

		expect(session.model?.baseUrl).toBe("http://localhost:8080/native-top-level");
		expect(await capturePromptBaseUrl(session)).toBe("http://localhost:8080/native-top-level");

		session.dispose();
	});

	// 命令执行中注册覆盖后，当前会话无需 reload 即可使用新地址。
	it("applies command-time registerProvider overrides without reload", async () => {
		// session 注册一个执行时覆盖提供商的 /use-proxy 命令。
		const session = await createSession([
			(pi) => {
				pi.registerCommand("use-proxy", {
					description: "Use proxy",
					handler: async () => {
						pi.registerProvider("anthropic", { baseUrl: "http://localhost:8080/command" });
					},
				});
			},
		]);

		await session.bindExtensions({});
		await session.prompt("/use-proxy");

		expect(session.model?.baseUrl).toBe("http://localhost:8080/command");
		expect(await capturePromptBaseUrl(session)).toBe("http://localhost:8080/command");

		session.dispose();
	});

	// 命令处理器也可即时注册完整原生 Provider。
	it("registers native pi-ai providers at command time", async () => {
		// session 注册一个执行时安装原生提供商的 /use-native 命令。
		const session = await createSession([
			(pi) => {
				pi.registerCommand("use-native", {
					description: "Use native provider",
					handler: async () => {
						pi.registerProvider(nativeAnthropicProvider("http://localhost:8080/native-command"));
					},
				});
			},
		]);

		await session.bindExtensions({});
		await session.prompt("/use-native");

		expect(session.model?.baseUrl).toBe("http://localhost:8080/native-command");
		expect(await capturePromptBaseUrl(session)).toBe("http://localhost:8080/native-command");

		session.dispose();
	});
});
