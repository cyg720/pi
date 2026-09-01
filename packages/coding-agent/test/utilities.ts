/**
 * 文件职责：为 coding-agent 测试提供真实凭据解析、消息夹具、扩展/资源加载器、会话装配和会话树构造。
 * 技术维度：组合文件权限、内存/文件 SessionManager、扩展运行时、Agent、模型注册表和真实 OAuth 刷新。
 * 产品维度：让不同测试复用一致环境，并在需要时安全读取用户凭据执行明确标记的真实模型测试。
 * 逻辑维度：先处理认证文件，再提供消息与扩展夹具，随后创建测试会话，最后构造分支会话树。
 * 关键边界：部分函数会读写 ~/.pi/agent/auth.json；真实 API 测试必须按凭据跳过；调用方必须 cleanup。
 * 新手阅读建议：普通单元测试先看消息/资源加载器；只有在线测试再阅读凭据解析与 createTestSession。
 */
import { createModelRegistry, getModelRuntime } from "./model-runtime-test-utils.ts";
/**
 * Shared test utilities for coding-agent tests.
 */
/** coding-agent 多个测试文件共享的夹具与装配助手。 */

import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Agent } from "@earendil-works/pi-agent-core";
import type { OAuthCredentials } from "@earendil-works/pi-ai";
import { getModel, streamSimple } from "@earendil-works/pi-ai/compat";
import { builtinProviders } from "@earendil-works/pi-ai/providers/all";
import { AgentSession } from "../src/core/agent-session.ts";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { createEventBus } from "../src/core/event-bus.ts";
import type {
	Extension,
	ExtensionFactory,
	InlineExtension,
	LoadExtensionsResult,
} from "../src/core/extensions/index.ts";
import { createExtensionRuntime, loadExtensionFromFactory } from "../src/core/extensions/loader.ts";
import type { ResourceLoader } from "../src/core/resource-loader.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";
import { createCodingTools } from "../src/index.ts";

/**
 * API key for authenticated tests. Tests using this should be wrapped in
 * describe.skipIf(!API_KEY)
 */
/** 在线认证测试使用的 Anthropic OAuth 或 API Key；缺失时必须跳过。 */
export const API_KEY = process.env.ANTHROPIC_OAUTH_TOKEN || process.env.ANTHROPIC_API_KEY;

// ============================================================================
// OAuth API key resolution from ~/.pi/agent/auth.json
// ============================================================================
// 从 ~/.pi/agent/auth.json 解析 OAuth 或 API Key 凭据。

/** 用户真实 pi 认证文件路径。 */
const AUTH_PATH = join(homedir(), ".pi", "agent", "auth.json");

/** 认证文件中的普通 API Key 条目。 */
type ApiKeyCredential = {
	type: "api_key";
	key: string;
};

/** 认证文件中的 OAuth 条目。 */
type OAuthCredentialEntry = {
	type: "oauth";
} & OAuthCredentials;

/** 支持的认证条目联合。 */
type AuthCredential = ApiKeyCredential | OAuthCredentialEntry;

/** 提供商标识到凭据的认证文件数据。 */
type AuthStorageData = Record<string, AuthCredential>;

/**
 * 读取真实认证文件，缺失或解析失败时返回空对象。
 * @returns 提供商凭据映射。
 * @example const storage = loadAuthStorage();
 */
function loadAuthStorage(): AuthStorageData {
	if (!existsSync(AUTH_PATH)) {
		return {};
	}
	try {
		/** 真实认证文件文本。 */
		const content = readFileSync(AUTH_PATH, "utf-8");
		return JSON.parse(content);
	} catch {
		return {};
	}
}

/**
 * 以严格目录/文件权限写回真实认证文件。
 * @param storage 待持久化凭据映射。
 * @returns 无返回值。
 */
function saveAuthStorage(storage: AuthStorageData): void {
	/** ~/.pi/agent 配置目录。 */
	const configDir = dirname(AUTH_PATH);
	if (!existsSync(configDir)) {
		mkdirSync(configDir, { recursive: true, mode: 0o700 });
	}
	writeFileSync(AUTH_PATH, JSON.stringify(storage, null, 2), "utf-8");
	chmodSync(AUTH_PATH, 0o600);
}

/**
 * Resolve API key for a provider from ~/.pi/agent/auth.json
 *
 * For API key credentials, returns the key directly.
 * For OAuth credentials, returns the access token (refreshing if expired and saving back).
 *
 */
/** 从真实认证文件读取提供商密钥；OAuth 过期时刷新并写回。 */
/**
 * @param provider 提供商标识。
 * @returns 可用于请求的 API Key，缺少条目或 OAuth 方法时为 undefined。
 * @example await resolveApiKey("github-copilot");
 */
export async function resolveApiKey(provider: string): Promise<string | undefined> {
	/** 当前真实认证文件数据。 */
	const storage = loadAuthStorage();
	/** 指定提供商的凭据条目。 */
	const entry = storage[provider];

	if (!entry) return undefined;

	if (entry.type === "api_key") {
		return entry.key;
	}

	if (entry.type === "oauth") {
		/** 内置提供商暴露的 OAuth 方法。 */
		const oauth = builtinProviders().find((candidate) => candidate.id === provider)?.auth.oauth;
		if (!oauth) return undefined;
		/** 当前或刷新后的 OAuth 凭据。 */
		let credential = entry;
		if (Date.now() >= credential.expires) {
			credential = await oauth.refresh(credential, new AbortController().signal);
			storage[provider] = credential;
			saveAuthStorage(storage);
		}
		return (await oauth.toAuth(credential)).apiKey;
	}

	return undefined;
}

/**
 * Check if a provider has credentials in ~/.pi/agent/auth.json
 */
/** 检查真实认证文件中是否存在指定提供商条目。 */
/** @param provider 提供商标识。@returns 存在任意凭据时为 true。 */
export function hasAuthForProvider(provider: string): boolean {
	/** 当前真实认证文件数据。 */
	const storage = loadAuthStorage();
	return provider in storage;
}

/** Path to the real pi agent config directory */
/** 真实 pi agent 配置目录路径。 */
export const PI_AGENT_DIR = join(homedir(), ".pi", "agent");

/**
 * Get an AuthStorage instance backed by ~/.pi/agent/auth.json
 * Use this for tests that need real OAuth credentials.
 */
/** 返回由真实 ~/.pi/agent/auth.json 支持的 AuthStorage，仅供明确的在线测试使用。 */
/** @returns 文件认证存储实例。 */
export function getRealAuthStorage(): AuthStorage {
	return AuthStorage.create(AUTH_PATH);
}

/**
 * Create a minimal user message for testing.
 */
/** 创建最小用户消息。 */
/** @param text 用户文本。@returns 带当前时间戳的用户消息。 */
export function userMsg(text: string) {
	return { role: "user" as const, content: text, timestamp: Date.now() };
}

/**
 * Create a minimal assistant message for testing.
 */
/** 创建固定来源、固定用量的最小助手消息。 */
/** @param text 助手文本。@returns 可写入 SessionManager 的助手消息。 */
export function assistantMsg(text: string) {
	return {
		role: "assistant" as const,
		content: [{ type: "text" as const, text }],
		api: "anthropic-messages" as const,
		provider: "anthropic",
		model: "test",
		usage: {
			input: 1,
			output: 1,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 2,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop" as const,
		timestamp: Date.now(),
	};
}

/**
 * Options for creating a test session.
 */
/** 创建测试会话时可覆盖的持久化、提示词和设置。 */
export interface TestSessionOptions {
	/** Use in-memory session (no file persistence) */
	/** 是否使用不写文件的内存会话。 */
	inMemory?: boolean;
	/** Custom system prompt */
	/** 自定义系统提示词。 */
	systemPrompt?: string;
	/** Custom settings overrides */
	/** 设置管理器覆盖值。 */
	settingsOverrides?: Record<string, unknown>;
}

/**
 * Resources returned by createTestSession that need cleanup.
 */
/** createTestSession 返回并需要调用方清理的资源。 */
export interface TestSessionContext {
	/** 被测 AgentSession。 */
	session: AgentSession;
	/** 保存消息和会话树的管理器。 */
	sessionManager: SessionManager;
	/** 会话临时目录。 */
	tempDir: string;
	/** 释放会话并删除临时目录。 */
	cleanup: () => void;
}

/** 带可选来源路径的测试扩展工厂输入。 */
export interface CreateTestExtensionsResultInput {
	factory: ExtensionFactory;
	path?: string;
}

/** 可直接传入的内联扩展或带路径扩展输入。 */
type TestExtensionInput = InlineExtension | CreateTestExtensionsResultInput;

/**
 * 将扩展输入加载为无错误的测试扩展结果。
 * @param inputs 内联扩展或带路径工厂数组。
 * @param cwd 扩展加载工作目录。
 * @returns 扩展、空错误列表和共享运行时。
 */
export async function createTestExtensionsResult(
	inputs: TestExtensionInput[],
	cwd = process.cwd(),
): Promise<LoadExtensionsResult> {
	/** 测试扩展共享运行时。 */
	const runtime = createExtensionRuntime();
	/** 测试扩展共享事件总线。 */
	const eventBus = createEventBus();
	/** 已加载扩展列表。 */
	const extensions: Extension[] = [];

	for (const [index, input] of inputs.entries()) {
		/** 当前输入是否为带 factory 的对象。 */
		const isObject = typeof input !== "function";
		/** 对象输入是否提供内联名称。 */
		const hasName = isObject && "name" in input;
		/** 对象输入是否提供有效路径。 */
		const hasPath = isObject && "path" in input && typeof input.path === "string" && input.path !== "";
		/** 实际扩展工厂。 */
		const factory = isObject ? input.factory : input;
		/** 诊断和来源元数据使用的扩展路径。 */
		const extensionPath = hasName ? `<inline:${input.name}>` : hasPath ? input.path : `<inline:${index + 1}>`;

		extensions.push(await loadExtensionFromFactory(factory, cwd, eventBus, runtime, extensionPath));
	}

	return {
		extensions,
		errors: [],
		runtime,
	};
}

/** 测试资源加载器可预置的扩展结果。 */
export interface CreateTestResourceLoaderOptions {
	extensionsResult?: LoadExtensionsResult;
}

/**
 * 创建返回固定空技能、提示、主题和 AGENTS 文件的资源加载器。
 * @param options 可选预加载扩展结果。
 * @returns 无文件系统扫描的 ResourceLoader。
 */
export function createTestResourceLoader(options: CreateTestResourceLoaderOptions = {}): ResourceLoader {
	/** 显式提供或默认空扩展结果。 */
	const extensionsResult = options.extensionsResult ?? {
		extensions: [],
		errors: [],
		runtime: createExtensionRuntime(),
	};

	return {
		getExtensions: () => extensionsResult,
		getSkills: () => ({ skills: [], diagnostics: [] }),
		getPrompts: () => ({ prompts: [], diagnostics: [] }),
		getThemes: () => ({ themes: [], diagnostics: [] }),
		getAgentsFiles: () => ({ agentsFiles: [] }),
		getSystemPrompt: () => undefined,
		getSystemPromptSource: () => undefined,
		getAppendSystemPrompt: () => [],
		getAppendSystemPromptSources: () => [],
		extendResources: () => {},
		reload: async () => {},
	};
}

/**
 * Create an AgentSession for testing with proper setup and cleanup.
 * Use this for e2e tests that need real LLM calls.
 */
/** 创建配置完整且可清理的测试 AgentSession；在线调用时使用真实 API_KEY。 */
/** @param options 内存模式、系统提示和设置覆盖。@returns 会话上下文和清理函数。 */
export async function createTestSession(options: TestSessionOptions = {}): Promise<TestSessionContext> {
	/** 当前会话独立使用的临时目录。 */
	const tempDir = join(tmpdir(), `pi-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(tempDir, { recursive: true });

	/** 在线测试默认使用的 Anthropic 模型。 */
	const model = getModel("anthropic", "claude-sonnet-4-5")!;
	/** 使用真实密钥和 coding 工具的 Agent。 */
	const agent = new Agent({
		getApiKey: () => API_KEY,
		initialState: {
			model,
			systemPrompt: options.systemPrompt ?? "You are a helpful assistant. Be extremely concise.",
			tools: createCodingTools(process.cwd()),
		},
		streamFn: streamSimple,
	});

	/** 内存或文件模式会话管理器。 */
	const sessionManager = options.inMemory ? SessionManager.inMemory() : SessionManager.create(tempDir);
	/** 临时目录设置管理器。 */
	const settingsManager = SettingsManager.create(tempDir, tempDir);

	if (options.settingsOverrides) {
		settingsManager.applyOverrides(options.settingsOverrides);
	}

	/** 临时认证存储。 */
	const authStorage = AuthStorage.create(join(tempDir, "auth.json"));
	/** 会话模型注册表。 */
	const modelRegistry = await createModelRegistry(authStorage, tempDir);

	/** 装配完成的测试会话。 */
	const session = new AgentSession({
		agent,
		sessionManager,
		settingsManager,
		cwd: tempDir,
		modelRuntime: getModelRuntime(modelRegistry),
		resourceLoader: createTestResourceLoader(),
	});

	// Must subscribe to enable session persistence
	// 必须建立订阅才能启用会话持久化路径。
	session.subscribe(() => {});

	/** 释放会话并递归删除临时目录。 */
	const cleanup = () => {
		session.dispose();
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true });
		}
	};

	return { session, sessionManager, tempDir, cleanup };
}

/**
 * Build a session tree for testing using SessionManager.
 * Returns the IDs of all created entries.
 *
 * Example tree structure:
 * ```
 * u1 -> a1 -> u2 -> a2
 *          -> u3 -> a3  (branch from a1)
 * u4 -> a4              (another root)
 * ```
 */
/** 按描述构造包含分支的测试会话树，并返回文本到条目标识映射。 */
/** @param session 目标会话管理器。@param structure 消息及可选 branchFrom。@returns 文本到条目 ID 映射。 */
export function buildTestTree(
	session: SessionManager,
	structure: {
		messages: Array<{ role: "user" | "assistant"; text: string; branchFrom?: string }>;
	},
): Map<string, string> {
	/** 已创建消息文本到条目标识的映射。 */
	const ids = new Map<string, string>();

	// msg 是 structure.messages 中当前待写入会话树的消息描述。
	for (const msg of structure.messages) {
		if (msg.branchFrom) {
			/** 分支起点文本对应的条目标识。 */
			const branchFromId = ids.get(msg.branchFrom);
			if (!branchFromId) {
				throw new Error(`Cannot branch from unknown entry: ${msg.branchFrom}`);
			}
			session.branch(branchFromId);
		}

		/** 当前消息追加后得到的条目标识。 */
		const id =
			msg.role === "user" ? session.appendMessage(userMsg(msg.text)) : session.appendMessage(assistantMsg(msg.text));

		ids.set(msg.text, id);
	}

	return ids;
}
