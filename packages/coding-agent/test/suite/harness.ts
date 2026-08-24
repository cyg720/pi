/**
 * 文件职责：为 coding-agent 新测试套件创建隔离的 AgentSession、假模型提供商、认证、设置和资源加载环境。
 * 技术维度：组合 pi-agent-core、pi-ai faux provider、内存管理器、临时目录及扩展运行器引用。
 * 产品维度：让会话、工具、扩展、重试和压缩等复杂行为能在不使用真实模型或密钥的情况下稳定回归。
 * 逻辑维度：提供消息文本读取助手，定义 Harness 契约，创建临时目录，再由 createHarness 装配并返回资源。
 * 关键边界：每个 Harness 必须调用 cleanup；假响应需由测试预先设置；临时目录和提供商注册都是进程级资源。
 * 新手阅读建议：先看 HarnessOptions 与 Harness 接口，再沿 createHarness 的“提供商—注册表—Agent—Session”顺序阅读。
 */
import { createInMemoryModelRegistry, createModelRegistry, getModelRuntime } from "../model-runtime-test-utils.ts";
/**
 * Local test harness for the new coding-agent test suite.
 */
/** coding-agent 新测试套件使用的本地、无真实网络测试夹具。 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentMessage, AgentTool } from "@earendil-works/pi-agent-core";
import { Agent } from "@earendil-works/pi-agent-core";
import type {
	FauxModelDefinition,
	FauxProviderRegistration,
	FauxResponseStep,
	Model,
} from "@earendil-works/pi-ai/compat";
import { registerFauxProvider, streamSimple } from "@earendil-works/pi-ai/compat";
import { AgentSession, type AgentSessionEvent } from "../../src/core/agent-session.ts";
import { AuthStorage } from "../../src/core/auth-storage.ts";
import type { ExtensionRunner } from "../../src/core/extensions/index.ts";
import { convertToLlm } from "../../src/core/messages.ts";
import { SessionManager } from "../../src/core/session-manager.ts";
import type { Settings } from "../../src/core/settings-manager.ts";
import { SettingsManager } from "../../src/core/settings-manager.ts";
import type { InlineExtension, ResourceLoader } from "../../src/index.ts";
import {
	type CreateTestExtensionsResultInput,
	createTestExtensionsResult,
	createTestResourceLoader,
} from "../utilities.ts";

/** 消息内容数组中可拼接为文本的片段。 */
type MessageTextPart = { type: "text"; text: string };

/**
 * 从未知消息中提取所有文字内容。
 * @param message 可能是代理消息或其他未知值。
 * @returns 字符串内容，或以换行拼接的 text 片段；无有效内容时返回空串。
 * @example getMessageText({ content: "hello" });
 */
export function getMessageText(message: unknown): string {
	if (!message || typeof message !== "object" || !("content" in message)) {
		return "";
	}
	/** 缩窄后取得的消息内容，可能是字符串或结构化片段数组。 */
	const content = (message as { content?: string | Array<{ type: string; text?: string }> }).content;
	if (content === undefined) {
		return "";
	}
	if (typeof content === "string") {
		return content;
	}
	return content
		.filter((part): part is MessageTextPart => part.type === "text")
		.map((part) => part.text)
		.join("\n");
}

/**
 * 读取夹具会话中全部用户消息文本。
 * @param harness 已创建的测试夹具。
 * @returns 按会话顺序排列的用户文本数组。
 * @example const prompts = getUserTexts(harness);
 */
export function getUserTexts(harness: Harness): string[] {
	return harness.session.messages
		.filter((message) => message.role === "user")
		.map((message) => getMessageText(message));
}

/**
 * 读取夹具会话中全部助手消息文本。
 * @param harness 已创建的测试夹具。
 * @returns 按会话顺序排列的助手文本数组。
 * @example const replies = getAssistantTexts(harness);
 */
export function getAssistantTexts(harness: Harness): string[] {
	return harness.session.messages
		.filter((message) => message.role === "assistant")
		.map((message) => getMessageText(message));
}

/** 创建测试夹具时可覆盖的模型、设置、工具、扩展和认证选项。 */
export interface HarnessOptions {
	/** 假提供商要注册的模型；省略时使用默认模型。 */
	models?: FauxModelDefinition[];
	/** 内存设置管理器的部分初始设置。 */
	settings?: Partial<Settings>;
	/** Agent 初始系统提示词。 */
	systemPrompt?: string;
	/** 可供会话使用的工具实现。 */
	tools?: AgentTool[];
	/** 初始启用的工具名。 */
	initialActiveToolNames?: string[];
	/** 允许启用的工具白名单。 */
	allowedToolNames?: string[];
	/** 强制排除的工具名。 */
	excludedToolNames?: string[];
	/** 可完全替换默认测试资源加载器。 */
	resourceLoader?: ResourceLoader;
	/** 要加载的内联扩展工厂或预构造扩展结果。 */
	extensionFactories?: Array<InlineExtension | CreateTestExtensionsResultInput>;
	/** 是否为假模型配置认证，默认 true。 */
	withConfiguredAuth?: boolean;
	/** 要写入临时 models.json 的自定义模型配置。 */
	modelsJson?: Record<string, unknown>;
}

/** createHarness 返回的完整测试资源及常用操作。 */
export interface Harness {
	/** 被测 AgentSession。 */
	session: AgentSession;
	/** 保存消息和会话树的内存管理器。 */
	sessionManager: SessionManager;
	/** 可在用例中动态覆盖设置的内存管理器。 */
	settingsManager: SettingsManager;
	/** 假模型认证存储。 */
	authStorage: AuthStorage;
	/** 可设置脚本响应的假提供商注册句柄。 */
	faux: FauxProviderRegistration;
	/** 假提供商注册的非空模型列表。 */
	models: [Model<string>, ...Model<string>[]];
	/** 不传标识时返回默认假模型。 */
	getModel(): Model<string>;
	/** 按标识返回假模型，找不到时为 undefined。 */
	getModel(modelId: string): Model<string> | undefined;
	/** 替换所有待消费的假响应步骤。 */
	setResponses: (responses: FauxResponseStep[]) => void;
	/** 在现有队列尾部追加假响应步骤。 */
	appendResponses: (responses: FauxResponseStep[]) => void;
	/** 返回尚未消费的假响应数量。 */
	getPendingResponseCount: () => number;
	/** 会话订阅捕获的全部事件。 */
	events: AgentSessionEvent[];
	/** 按事件类型筛选并保持精确 TypeScript 类型。 */
	eventsOfType<T extends AgentSessionEvent["type"]>(type: T): Extract<AgentSessionEvent, { type: T }>[];
	/** 本夹具专属临时目录。 */
	tempDir: string;
	/** 释放会话、注销提供商并删除临时目录。 */
	cleanup: () => void;
}

/**
 * 创建测试套件专属临时目录。
 * @returns 位于系统临时目录下的唯一绝对路径。
 * @example const tempDir = createTempDir();
 */
function createTempDir(): string {
	/** 由时间戳和随机片段组成的低冲突目录路径。 */
	const tempDir = join(tmpdir(), `pi-suite-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(tempDir, { recursive: true });
	return tempDir;
}

/**
 * 装配一套可独立清理的 coding-agent 测试运行环境。
 * @param options 模型、设置、工具、扩展和认证等可选覆盖。
 * @returns 可控制假响应并观察会话状态与事件的 Harness。
 * @example const harness = await createHarness(); try { ... } finally { harness.cleanup(); }
 */
export async function createHarness(options: HarnessOptions = {}): Promise<Harness> {
	/** 当前夹具所有文件操作使用的临时目录。 */
	const tempDir = createTempDir();
	/** 注册到全局兼容层的假提供商句柄。 */
	const fauxProvider: FauxProviderRegistration = registerFauxProvider({
		models: options.models,
	});
	fauxProvider.setResponses([]);
	/** 当前夹具默认使用的第一个假模型。 */
	const model = fauxProvider.getModel();
	/** 工具名到工具实例的映射，未提供工具时保持 undefined。 */
	const toolMap = options.tools ? Object.fromEntries(options.tools.map((tool) => [tool.name, tool])) : undefined;
	/** 是否模拟已配置认证；默认开启。 */
	const withConfiguredAuth = options.withConfiguredAuth ?? true;
	/** Agent 回调通过此可变引用访问 Session 建立后的扩展运行器。 */
	const extensionRunnerRef: { current?: ExtensionRunner } = {};

	/** 保存测试会话条目的内存管理器。 */
	const sessionManager = SessionManager.inMemory();
	/** 保存并允许覆盖测试设置的内存管理器。 */
	const settingsManager = SettingsManager.inMemory(options.settings);

	/** 不读写用户凭据文件的内存认证存储。 */
	const authStorage = AuthStorage.inMemory();
	if (withConfiguredAuth) {
		await authStorage.modify(model.provider, async () => ({ type: "api_key", key: "faux-key" }));
	}
	/** 自定义模型配置存在时写入的临时 models.json 路径。 */
	const modelsPath = options.modelsJson === undefined ? undefined : join(tempDir, "models.json");
	if (modelsPath) writeFileSync(modelsPath, JSON.stringify(options.modelsJson));
	/** 使用临时配置文件或纯内存配置创建的模型注册表。 */
	const modelRegistry = modelsPath
		? await createModelRegistry(authStorage, modelsPath)
		: await createInMemoryModelRegistry(authStorage);
	if (withConfiguredAuth) {
		modelRegistry.registerProvider(model.provider, {
			baseUrl: model.baseUrl,
			apiKey: "faux-key",
			api: fauxProvider.api,
			models: fauxProvider.models.map((registeredModel) => ({
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
	}

	/** 使用假模型流并把扩展钩子接入请求、响应和上下文阶段的 Agent。 */
	const agent = new Agent({
		getApiKey: () => (withConfiguredAuth ? "faux-key" : undefined),
		streamFn: streamSimple,
		initialState: {
			model,
			systemPrompt: options.systemPrompt ?? "You are a test assistant.",
			tools: [],
		},
		convertToLlm,
		onPayload: async (payload) => {
			/** 当前扩展运行器，Session 初始化完成前可能为空。 */
			const runner = extensionRunnerRef.current;
			if (!runner?.hasHandlers("before_provider_request")) {
				return payload;
			}
			return runner.emitBeforeProviderRequest(payload);
		},
		onResponse: async (response) => {
			/** 当前扩展运行器，用于派发提供商响应元数据。 */
			const runner = extensionRunnerRef.current;
			if (!runner?.hasHandlers("after_provider_response")) {
				return;
			}
			await runner.emit({
				type: "after_provider_response",
				status: response.status,
				headers: response.headers,
			});
		},
		transformContext: async (messages: AgentMessage[]) => {
			/** 当前扩展运行器，用于按扩展规则变换模型上下文。 */
			const runner = extensionRunnerRef.current;
			if (!runner) return messages;
			return runner.emitContext(messages);
		},
	});
	/** 根据传入扩展工厂构造的测试扩展加载结果。 */
	const extensionsResult = options.extensionFactories
		? await createTestExtensionsResult(options.extensionFactories, tempDir)
		: undefined;
	/** 最终资源加载器：显式传入者优先，否则使用测试默认实现。 */
	const resourceLoader =
		options.resourceLoader ?? createTestResourceLoader(extensionsResult ? { extensionsResult } : undefined);

	/** 装配完成的被测会话。 */
	const session = new AgentSession({
		agent,
		sessionManager,
		settingsManager,
		cwd: tempDir,
		modelRuntime: getModelRuntime(modelRegistry),
		resourceLoader,
		baseToolsOverride: toolMap,
		initialActiveToolNames: options.initialActiveToolNames,
		allowedToolNames: options.allowedToolNames,
		excludedToolNames: options.excludedToolNames,
		extensionRunnerRef,
	});

	/** 按发生顺序收集的会话事件。 */
	const events: AgentSessionEvent[] = [];
	session.subscribe((event) => {
		events.push(event);
	});

	return {
		session,
		sessionManager,
		settingsManager,
		authStorage,
		faux: fauxProvider,
		models: fauxProvider.models,
		getModel: fauxProvider.getModel,
		setResponses: fauxProvider.setResponses,
		appendResponses: fauxProvider.appendResponses,
		getPendingResponseCount: fauxProvider.getPendingResponseCount,
		events,
		/**
		 * 按精确类型返回已经捕获的会话事件。
		 * @param type 目标 AgentSessionEvent.type。
		 * @returns 类型缩窄后的事件数组。
		 */
		eventsOfType<T extends AgentSessionEvent["type"]>(type: T) {
			return events.filter((event): event is Extract<AgentSessionEvent, { type: T }> => event.type === type);
		},
		tempDir,
		/** 释放本 Harness 拥有的所有进程级和文件系统资源。 */
		cleanup() {
			session.dispose();
			fauxProvider.unregister();
			if (existsSync(tempDir)) {
				rmSync(tempDir, { recursive: true });
			}
		},
	};
}
