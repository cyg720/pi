/**
 * 文件职责：验证 createAgentSession 为 OpenRouter、NVIDIA NIM 和 OpenCode 请求合并正确的归因与会话头。
 * 技术维度：使用 Vitest、临时 SDK 会话、自定义模型注册表和捕获 SimpleStreamOptions 的假流。
 * 产品维度：在用户允许遥测时向模型网关标明 pi 来源，同时尊重禁用设置和用户显式请求头。
 * 逻辑维度：创建模型与完成流夹具，captureHeaders 装配会话并截获头，再覆盖默认、禁用、路由与覆盖优先级。
 * 关键边界：显式请求头优先于提供商头和默认值；OpenRouter 路由的 NVIDIA 模型不能误加 NIM 头。
 * 新手阅读建议：先看 captureHeaders 的头合并捕获方式，再按 OpenRouter、NVIDIA、OpenCode 三组用例阅读。
 */
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type Api,
	type AssistantMessage,
	createAssistantMessageEventStream,
	type Model,
	type ProviderHeaders,
	type SimpleStreamOptions,
} from "@earendil-works/pi-ai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { createAgentSession } from "../src/core/sdk.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";

import { createModelRegistry, getModelRuntime } from "./model-runtime-test-utils.ts";

/** 覆盖 SDK 会话根据提供商、端点、遥测设置和显式配置生成的请求头。 */
describe("createAgentSession provider attribution headers", () => {
	/** 当前用例根临时目录。 */
	let tempDir: string;
	/** 模拟项目工作目录。 */
	let cwd: string;
	/** 模拟 agent 配置目录。 */
	let agentDir: string;
	/** 用例前已有的 PI_TELEMETRY 环境值。 */
	let originalTelemetryEnv: string | undefined;

	/** 每个用例前创建目录并临时清除遥测环境覆盖。 */
	beforeEach(() => {
		tempDir = join(tmpdir(), `pi-sdk-attribution-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		cwd = join(tempDir, "project");
		agentDir = join(tempDir, "agent");
		mkdirSync(cwd, { recursive: true });
		mkdirSync(agentDir, { recursive: true });
		originalTelemetryEnv = process.env.PI_TELEMETRY;
		delete process.env.PI_TELEMETRY;
	});

	/** 每个用例后恢复遥测环境并删除临时目录。 */
	afterEach(() => {
		if (originalTelemetryEnv === undefined) {
			delete process.env.PI_TELEMETRY;
		} else {
			process.env.PI_TELEMETRY = originalTelemetryEnv;
		}
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	/**
	 * 创建可指定提供商、端点和模型 ID 的最小模型。
	 * @param provider 提供商标识。
	 * @param baseUrl 请求基础地址。
	 * @param id 模型标识，默认由提供商生成。
	 * @returns OpenAI Completions 测试模型。
	 */
	function createModel(provider: string, baseUrl: string, id = `${provider}-test-model`): Model<Api> {
		return {
			id,
			name: `${provider} Test Model`,
			api: "openai-completions",
			provider,
			baseUrl,
			reasoning: false,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 128000,
			maxTokens: 4096,
		};
	}

	/**
	 * 创建已经结束的成功助手事件流。
	 * @returns 可直接 result() 的完成流。
	 * @example const stream = createDoneStream();
	 */
	function createDoneStream() {
		/** 要立即结束的助手消息事件流。 */
		const stream = createAssistantMessageEventStream();
		/** 固定 ok 文本和零用量的助手消息。 */
		const message: AssistantMessage = {
			role: "assistant",
			content: [{ type: "text", text: "ok" }],
			api: "openai-completions",
			provider: "capture-provider",
			model: "capture-model",
			usage: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 0,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "stop",
			timestamp: Date.now(),
		};
		stream.end(message);
		return stream;
	}

	/**
	 * 装配 SDK 会话并捕获提供商最终收到的请求头。
	 * @param model 决定默认归因规则的模型。
	 * @param options 遥测、提供商头、请求头和会话 ID 覆盖。
	 * @returns 合并后的 ProviderHeaders。
	 * @example await captureHeaders(createModel("openrouter", "https://openrouter.ai/api/v1"));
	 */
	async function captureHeaders(
		model: Model<Api>,
		options: {
			telemetryEnabled?: boolean;
			providerHeaders?: Record<string, string>;
			requestHeaders?: Record<string, string>;
			sessionId?: string;
		} = {},
	): Promise<ProviderHeaders | undefined> {
		/** 当前用例的设置管理器。 */
		const settingsManager = SettingsManager.create(cwd, agentDir);
		if (options.telemetryEnabled === false) {
			settingsManager.setEnableInstallTelemetry(false);
		}

		/** 保存目标提供商测试 API Key 的认证存储。 */
		const authStorage = AuthStorage.create(join(agentDir, "auth.json"));
		await authStorage.modify(model.provider, async () => ({ type: "api_key", key: "test-api-key" }));
		/** 注册捕获流实现的模型注册表。 */
		const modelRegistry = await createModelRegistry(authStorage, join(agentDir, "models.json"));
		/** streamSimple 最终收到的选项。 */
		let capturedOptions: SimpleStreamOptions | undefined;

		modelRegistry.registerProvider(model.provider, {
			api: model.api,
			headers: options.providerHeaders,
			streamSimple: (_model, _context, providerOptions) => {
				capturedOptions = providerOptions;
				return createDoneStream();
			},
		});

		/** 从注册表创建的模型运行时。 */
		const modelRuntime = getModelRuntime(modelRegistry);
		/** 可选固定会话 ID 的内存会话管理器。 */
		const sessionManager = SessionManager.inMemory(cwd);
		if (options.sessionId) {
			sessionManager.newSession({ id: options.sessionId });
		}

		/** 使用目标模型和捕获提供商创建的 SDK 会话。 */
		const { session } = await createAgentSession({
			cwd,
			agentDir,
			model,
			modelRuntime,
			settingsManager,
			sessionManager,
		});

		try {
			/** 直接调用 Agent 的最终流函数。 */
			const stream = await session.agent.streamFunction(
				model,
				{ messages: [] },
				{
					sessionId: session.sessionId,
					...(options.requestHeaders ? { headers: options.requestHeaders } : {}),
				},
			);
			await stream.result();
			return capturedOptions?.headers;
		} finally {
			session.dispose();
			modelRegistry.unregisterProvider(model.provider);
		}
	}

	it("adds default attribution headers for OpenRouter models", async () => {
		/** OpenRouter 默认归因场景捕获的头。 */
		const headers = await captureHeaders(createModel("openrouter", "https://openrouter.ai/api/v1"));

		expect(headers?.["HTTP-Referer"]).toBe("https://pi.dev");
		expect(headers?.["X-OpenRouter-Title"]).toBe("pi");
		expect(headers?.["X-OpenRouter-Categories"]).toBe("cli-agent");
	});

	it("does not add attribution headers when telemetry is disabled", async () => {
		/** 禁用遥测时捕获的 OpenRouter 头。 */
		const headers = await captureHeaders(createModel("openrouter", "https://openrouter.ai/api/v1"), {
			telemetryEnabled: false,
		});

		expect(headers?.["HTTP-Referer"]).toBeUndefined();
		expect(headers?.["X-OpenRouter-Title"]).toBeUndefined();
		expect(headers?.["X-OpenRouter-Categories"]).toBeUndefined();
	});

	it("adds attribution headers for custom providers routed through OpenRouter", async () => {
		/** 经 OpenRouter 端点路由的自定义提供商头。 */
		const headers = await captureHeaders(createModel("custom-openrouter", "https://openrouter.ai/api/v1"));

		expect(headers?.["HTTP-Referer"]).toBe("https://pi.dev");
		expect(headers?.["X-OpenRouter-Title"]).toBe("pi");
		expect(headers?.["X-OpenRouter-Categories"]).toBe("cli-agent");
	});

	it("preserves legacy OpenRouter base URL substring attribution matching", async () => {
		/** 使用旧式子串端点匹配时捕获的头。 */
		const headers = await captureHeaders(createModel("custom-openrouter", "not-a-url-openrouter.ai"));

		expect(headers?.["HTTP-Referer"]).toBe("https://pi.dev");
		expect(headers?.["X-OpenRouter-Title"]).toBe("pi");
		expect(headers?.["X-OpenRouter-Categories"]).toBe("cli-agent");
	});

	it("lets provider and request headers override the defaults", async () => {
		/** 同时有默认、提供商和请求覆盖时的最终头。 */
		const headers = await captureHeaders(createModel("openrouter", "https://openrouter.ai/api/v1"), {
			providerHeaders: {
				"HTTP-Referer": "https://provider.example",
				"X-OpenRouter-Categories": "provider-category",
			},
			requestHeaders: {
				"X-OpenRouter-Title": "request-title",
			},
		});

		expect(headers?.["HTTP-Referer"]).toBe("https://provider.example");
		expect(headers?.["X-OpenRouter-Title"]).toBe("request-title");
		expect(headers?.["X-OpenRouter-Categories"]).toBe("provider-category");
	});

	it("adds default attribution headers for direct NVIDIA NIM endpoints", async () => {
		/** 直接 NVIDIA NIM 端点的归因头。 */
		const headers = await captureHeaders(createModel("custom-nim", "https://integrate.api.nvidia.com/v1"));

		expect(headers?.["X-BILLING-INVOKE-ORIGIN"]).toBe("Pi");
	});

	it("adds default attribution headers for the NVIDIA provider", async () => {
		/** nvidia 提供商即使使用自定义端点也应生成的归因头。 */
		const headers = await captureHeaders(createModel("nvidia", "https://example.test/v1"));

		expect(headers?.["X-BILLING-INVOKE-ORIGIN"]).toBe("Pi");
	});

	it("does not add NVIDIA NIM attribution headers when telemetry is disabled", async () => {
		/** 禁用遥测时捕获的 NVIDIA 头。 */
		const headers = await captureHeaders(createModel("nvidia", "https://integrate.api.nvidia.com/v1"), {
			telemetryEnabled: false,
		});

		expect(headers?.["X-BILLING-INVOKE-ORIGIN"]).toBeUndefined();
	});

	it("lets provider and request headers override NVIDIA NIM defaults", async () => {
		/** 请求头覆盖提供商头和默认 NIM 头后的结果。 */
		const headers = await captureHeaders(createModel("nvidia", "https://integrate.api.nvidia.com/v1"), {
			providerHeaders: {
				"X-BILLING-INVOKE-ORIGIN": "Provider",
			},
			requestHeaders: {
				"X-BILLING-INVOKE-ORIGIN": "Request",
			},
		});

		expect(headers?.["X-BILLING-INVOKE-ORIGIN"]).toBe("Request");
	});

	it("does not add NVIDIA NIM attribution headers for NVIDIA models routed through OpenRouter", async () => {
		/** 通过 OpenRouter 路由 NVIDIA 模型时的头。 */
		const headers = await captureHeaders(
			createModel("openrouter", "https://openrouter.ai/api/v1", "nvidia/nemotron-3-super-120b-a12b"),
		);

		expect(headers?.["HTTP-Referer"]).toBe("https://pi.dev");
		expect(headers?.["X-BILLING-INVOKE-ORIGIN"]).toBeUndefined();
	});

	it("does not add NVIDIA NIM attribution headers for NVIDIA models routed through Vercel AI Gateway", async () => {
		/** 通过 Vercel 网关路由 NVIDIA 模型时的头。 */
		const headers = await captureHeaders(
			createModel("vercel-ai-gateway", "https://ai-gateway.vercel.sh/v1", "nvidia/nemotron-3-super-120b-a12b"),
		);

		expect(headers?.["X-BILLING-INVOKE-ORIGIN"]).toBeUndefined();
	});

	it("adds OpenCode session headers", async () => {
		/** 带固定会话 ID 的 OpenCode 请求头。 */
		const headers = await captureHeaders(createModel("opencode", "https://opencode.ai/zen/v1"), {
			sessionId: "opencode-session",
		});

		expect(headers?.["x-opencode-session"]).toBe("opencode-session");
		expect(headers?.["x-opencode-client"]).toBe("pi");
	});

	it("lets configured OpenCode headers override the defaults", async () => {
		/** 配置覆盖默认 OpenCode 会话头后的结果。 */
		const headers = await captureHeaders(createModel("opencode", "https://opencode.ai/zen/v1"), {
			sessionId: "opencode-session",
			providerHeaders: {
				"x-opencode-session": "configured-session",
				"x-opencode-client": "configured-client",
			},
		});

		expect(headers?.["x-opencode-session"]).toBe("configured-session");
		expect(headers?.["x-opencode-client"]).toBe("configured-client");
	});
});
