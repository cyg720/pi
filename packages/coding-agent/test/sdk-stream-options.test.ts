/**
 * 文件职责：验证 createAgentSession 把设置、单次请求和扩展 Header 钩子正确合并为提供商流选项。
 * 技术维度：使用真实 SDK 会话、临时配置目录、动态扩展源码和自定义 Provider 流函数捕获 SimpleStreamOptions。
 * 产品维度：保障超时、WebSocket 连接、重试和请求头配置按预期生效，且显式请求选项拥有最高优先级。
 * 逻辑维度：构造捕获模型与完成流，创建隔离会话并截获选项，再逐项测试默认值、覆盖和 Header 组装。
 * 关键边界：测试提供商不会发网；扩展文件只在指定用例写入；每次必须释放会话并注销提供商。
 * 新手阅读建议：先看 captureStreamOptions 的依赖组装和捕获点，再比较 settings 与 requestOptions 的优先级。
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type Api,
	type AssistantMessage,
	createAssistantMessageEventStream,
	type Model,
	type SimpleStreamOptions,
} from "@earendil-works/pi-ai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { createAgentSession } from "../src/core/sdk.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import { type Settings, SettingsManager } from "../src/core/settings-manager.ts";

import { createModelRegistry, getModelRuntime } from "./model-runtime-test-utils.ts";

// 验证 SDK 会话创建后传给实际提供商的最终流选项。
describe("createAgentSession stream options", () => {
	// tempDir 是当前用例所有文件的清理根目录。
	let tempDir: string;
	// cwd 是模拟项目工作目录。
	let cwd: string;
	// agentDir 保存认证、模型配置和可选扩展文件。
	let agentDir: string;

	// 每个用例前创建隔离的项目与 agent 目录。
	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "pi-sdk-stream-options-"));
		cwd = join(tempDir, "project");
		agentDir = join(tempDir, "agent");
		mkdirSync(cwd, { recursive: true });
		mkdirSync(agentDir, { recursive: true });
	});

	// 每个用例后删除全部临时资源。
	afterEach(() => {
		if (tempDir) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	/** 构造用于捕获选项的模型；参数 api 为待测协议；返回带固定 Header 的 Model。 */
	function createModel(api: Api): Model<Api> {
		return {
			id: "capture-model",
			name: "Capture Model",
			api,
			provider: "capture-provider",
			baseUrl: "https://capture.invalid/v1",
			reasoning: false,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 128000,
			maxTokens: 4096,
			headers: { "x-model": "model" },
		};
	}

	/** 创建立即产出 done 助手消息的事件流；参数 api 为消息协议；返回可消费流。 */
	function createDoneStream(api: Api) {
		// stream 是提供商桩返回的助手消息事件流。
		const stream = createAssistantMessageEventStream();
		// message 是结束该流的固定成功助手消息。
		const message: AssistantMessage = {
			role: "assistant",
			content: [{ type: "text", text: "ok" }],
			api,
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
	 * 创建会话、执行一次流请求并返回提供商收到的最终选项。
	 * @param api 待测提供商 API。
	 * @param settings 会话级设置。
	 * @param requestOptions 单次请求显式选项。
	 * @param extensionSource 可选 before_provider_headers 扩展源码。
	 * @returns 捕获的 SimpleStreamOptions；例如 `await captureStreamOptions("openai-completions", {})`。
	 */
	async function captureStreamOptions(
		api: Api,
		settings: Partial<Settings>,
		requestOptions: SimpleStreamOptions = {},
		extensionSource?: string,
	): Promise<SimpleStreamOptions | undefined> {
		// model 是本次捕获使用的固定模型。
		const model = createModel(api);
		// settingsManager 保存待测试的会话级选项。
		const settingsManager = SettingsManager.inMemory(settings);
		if (extensionSource) {
			// extensionsDir 是写入动态 Header 扩展的临时目录。
			const extensionsDir = join(agentDir, "extensions");
			mkdirSync(extensionsDir, { recursive: true });
			writeFileSync(join(extensionsDir, "headers.ts"), extensionSource);
		}

		// authStorage 为捕获提供商保存固定测试 API 密钥。
		const authStorage = AuthStorage.create(join(agentDir, "auth.json"));
		await authStorage.modify(model.provider, async () => ({ type: "api_key", key: "test-api-key" }));
		// modelRegistry 是可注册捕获提供商的测试模型注册表。
		const modelRegistry = await createModelRegistry(authStorage, join(agentDir, "models.json"));
		// capturedOptions 在提供商 streamSimple 被调用时赋值。
		let capturedOptions: SimpleStreamOptions | undefined;

		modelRegistry.registerProvider(model.provider, {
			api,
			headers: { "x-provider": "provider" },
			streamSimple: (_model, _context, providerOptions) => {
				capturedOptions = providerOptions;
				return createDoneStream(api);
			},
		});

		// modelRuntime 是会话消费上述模型注册表的运行时适配器。
		const modelRuntime = getModelRuntime(modelRegistry);
		// sessionManager 使用项目 cwd 的内存会话，避免写历史文件。
		const sessionManager = SessionManager.inMemory(cwd);
		// session 是最终执行待测 streamFunction 的 SDK 会话。
		const { session } = await createAgentSession({
			cwd,
			agentDir,
			model,
			modelRuntime,
			settingsManager,
			sessionManager,
		});

		try {
			// stream 是会话层合并选项后从捕获提供商获得的完成流。
			const stream = await session.agent.streamFunction(model, { messages: [] }, requestOptions);
			await stream.result();
			return capturedOptions;
		} finally {
			session.dispose();
			modelRegistry.unregisterProvider(model.provider);
		}
	}

	// Codex 的 HTTP 空闲超时应映射到通用 timeoutMs。
	it("forwards httpIdleTimeoutMs as timeoutMs for OpenAI Codex", async () => {
		// options 是提供商最终收到的超时设置。
		const options = await captureStreamOptions("openai-codex-responses", { httpIdleTimeoutMs: 1234 });

		expect(options?.timeoutMs).toBe(1234);
	});

	// 其他提供商也应默认继承 httpIdleTimeoutMs。
	it("defaults timeoutMs from httpIdleTimeoutMs for all providers", async () => {
		// options 是 OpenAI Completions 提供商收到的默认超时。
		const options = await captureStreamOptions("openai-completions", { httpIdleTimeoutMs: 1234 });

		expect(options?.timeoutMs).toBe(1234);
	});

	// 单次请求 timeoutMs 即使为 0 也应覆盖设置值。
	it("lets request timeoutMs override httpIdleTimeoutMs for OpenAI Codex", async () => {
		// options 是显式覆盖后的最终流选项。
		const options = await captureStreamOptions(
			"openai-codex-responses",
			{ httpIdleTimeoutMs: 1234 },
			{ timeoutMs: 0 },
		);

		expect(options?.timeoutMs).toBe(0);
	});

	// WebSocket 连接超时应从会话设置传给 Codex 提供商。
	it("forwards websocketConnectTimeoutMs from settings", async () => {
		// options 包含设置层的 WebSocket 连接超时。
		const options = await captureStreamOptions("openai-codex-responses", { websocketConnectTimeoutMs: 1234 });

		expect(options?.websocketConnectTimeoutMs).toBe(1234);
	});

	// 单次请求 WebSocket 超时优先于设置值。
	it("lets request websocketConnectTimeoutMs override settings", async () => {
		// options 是显式 0 覆盖设置 1234 后的结果。
		const options = await captureStreamOptions(
			"openai-codex-responses",
			{ websocketConnectTimeoutMs: 1234 },
			{ websocketConnectTimeoutMs: 0 },
		);

		expect(options?.websocketConnectTimeoutMs).toBe(0);
	});

	// 提供商级重试次数和最大延迟应展开到流选项。
	it("forwards provider retry settings", async () => {
		// options 是从嵌套 retry.provider 设置映射后的结果。
		const options = await captureStreamOptions("openai-completions", {
			retry: { provider: { maxRetries: 2, maxRetryDelayMs: 3000 } },
		});

		expect(options?.maxRetries).toBe(2);
		expect(options?.maxRetryDelayMs).toBe(3000);
	});

	// Header 钩子应看到已合并 Header 并原地修改，内部 transform 不应下传提供商。
	it("runs before_provider_headers on assembled headers without forwarding the transform", async () => {
		// options 是提供商 Header、模型 Header、显式 Header 和扩展 Header 的合并结果。
		const options = await captureStreamOptions(
			"openai-completions",
			{},
			{ headers: { "x-explicit": "explicit" } },
			`export default function (pi) {
				pi.on("before_provider_headers", (event) => {
					event.headers["x-hook"] = [
						event.headers["x-provider"],
						event.headers["x-model"],
						event.headers["x-explicit"],
					].join(":");
				});
			}`,
		);

		expect(options?.headers).toMatchObject({
			"x-provider": "provider",
			"x-model": "model",
			"x-explicit": "explicit",
			"x-hook": "provider:model:explicit",
		});
		expect(options).not.toHaveProperty("transformHeaders");
	});
});
