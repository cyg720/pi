import { createModelRegistry, getModelRuntime } from "./model-runtime-test-utils.ts";
/**
 * Test harness for AgentSession runtime testing.
 *
 * Provides:
 * - A faux stream function with declarative response sequencing
 * - A one-call factory for a fully wired AgentSession with real in-memory dependencies
 * - Event capture for assertions
 */
/**
 * 文件职责：提供 AgentSession 运行时测试复用的 faux 模型流、响应描述、事件捕获和完整会话夹具。
 * 技术维度：使用 pi-agent-core、pi-ai 事件流、内存会话/设置、临时认证与可注入资源加载器。
 * 产品维度：让复杂代理行为在不调用真实模型的情况下可重复验证，降低扩展、压缩和队列测试成本。
 * 逻辑维度：定义 faux 模型与响应，生成逐块流事件，再组装 Agent、注册表、Session 和清理函数。
 * 关键边界：响应序列不能为空且会循环复用；流分块含随机长度，测试不应依赖具体 delta 边界。
 * 新手阅读建议：先看 FauxResponse 和 buildAssistantMessage，再读 createFauxStreamFn，最后跟随 createHarness 装配。
 */

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Agent } from "@earendil-works/pi-agent-core";
import type {
	AssistantMessage,
	AssistantMessageEvent,
	AssistantMessageEventStream,
	Context,
	Model,
	SimpleStreamOptions,
	StopReason,
	TextContent,
	ThinkingContent,
	ToolCall,
	Usage,
} from "@earendil-works/pi-ai";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { AgentSession, type AgentSessionEvent } from "../src/core/agent-session.ts";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import type { Settings } from "../src/core/settings-manager.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";
import type { InlineExtension, ResourceLoader } from "../src/index.ts";
import {
	type CreateTestExtensionsResultInput,
	createTestExtensionsResult,
	createTestResourceLoader,
} from "./utilities.ts";

// ============================================================================
// Faux model
// faux 模型定义。
// ============================================================================

/** faux 模型使用的提供商编号。 */
const FAUX_PROVIDER = "faux";
/** 默认 faux 模型编号。 */
const FAUX_MODEL_ID = "faux-1";
/** faux 模型声明的 API 类型，复用 Anthropic 消息事件结构。 */
const FAUX_API = "anthropic-messages" as const;

/** 测试默认使用的零成本 faux 模型定义。 */
export const fauxModel: Model<typeof FAUX_API> = {
	id: FAUX_MODEL_ID,
	name: "Faux Model",
	api: FAUX_API,
	provider: FAUX_PROVIDER,
	baseUrl: "http://localhost:0",
	reasoning: false,
	input: ["text", "image"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 128000,
	maxTokens: 16384,
};

// ============================================================================
// Response description
// faux 响应描述。
// ============================================================================

export interface FauxResponse {
	/** Text content blocks. String shorthand becomes a single text block. */
	/** 文本内容；字符串简写会转换为单个文本块。 */
	text?: string;
	/** Tool calls to include in the response. */
	/** 响应中包含的工具调用列表。 */
	/** 每项包含可选调用编号、工具名称和结构化参数。 */
	toolCalls?: Array<{ id?: string; name: string; args: Record<string, unknown> }>;
	/** Thinking content. */
	/** 可选思考内容。 */
	thinking?: string;
	/** Stop reason. Defaults to "stop", or "toolUse" if toolCalls are present, or "error" if error is set. */
	/** 停止原因；默认 stop，有工具调用时为 toolUse，有错误时为 error。 */
	stopReason?: StopReason;
	/** Error message. Sets stopReason to "error" if not explicitly set. */
	/** 错误文本；未显式指定停止原因时会将其设为 error。 */
	error?: string;
	/** Usage numbers. Merged with defaults (input: 100, output: 50). */
	/** Token 用量；会与 input 100、output 50 等默认值合并。 */
	usage?: Partial<Usage>;
	/** Delay in ms before the response starts. */
	/** 响应开始前的延迟毫秒数。 */
	delayMs?: number;
	/** Model overrides (provider, model id) for responses that should look like they came from a different model. */
	/** 可覆盖 provider 和模型编号，使响应表现为来自其他模型。 */
	/** provider 与 id 均可单独缺省。 */
	model?: { provider?: string; id?: string };
}

/** Shorthand: a string becomes a simple text response. */
/** 简写类型：字符串会被视为简单文本响应。 */
export type FauxResponseInput = FauxResponse | string;

// ============================================================================
// Faux stream function
// faux 流函数。
// ============================================================================

/** 把字符串简写转换为 FauxResponse。参数 input 为字符串或对象；返回规范对象。例如：normalizeResponse("ok")。 */
function normalizeResponse(input: FauxResponseInput): FauxResponse {
	if (typeof input === "string") {
		return { text: input };
	}
	return input;
}

/** 用默认值补齐 Token 与成本统计。参数 partial 为可选部分用量；返回完整 Usage。例如：buildUsage({ input: 10 })。 */
function buildUsage(partial?: Partial<Usage>): Usage {
	/** 补齐后的输入 Token 数，默认 100。 */
	const input = partial?.input ?? 100;
	/** 补齐后的输出 Token 数，默认 50。 */
	const output = partial?.output ?? 50;
	/** 补齐后的缓存读取 Token 数，默认 0。 */
	const cacheRead = partial?.cacheRead ?? 0;
	/** 补齐后的缓存写入 Token 数，默认 0。 */
	const cacheWrite = partial?.cacheWrite ?? 0;
	return {
		input,
		output,
		cacheRead,
		cacheWrite,
		totalTokens: partial?.totalTokens ?? input + output + cacheRead + cacheWrite,
		cost: partial?.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
	};
}

/** 未显式提供工具调用编号时使用的递增计数器。 */
let toolCallIdCounter = 0;

/** 根据响应描述构造完整助手消息。参数 resp 为 FauxResponse；返回 AssistantMessage。例如：buildAssistantMessage({ text: "ok" })。 */
function buildAssistantMessage(resp: FauxResponse): AssistantMessage {
	/** 按响应描述逐步收集的思考、文本和工具调用内容块。 */
	const content: (TextContent | ThinkingContent | ToolCall)[] = [];

	if (resp.thinking) {
		content.push({ type: "thinking", thinking: resp.thinking });
	}
	if (resp.text !== undefined) {
		content.push({ type: "text", text: resp.text });
	}
	if (resp.toolCalls) {
		// tc 依次表示当前响应中的每个工具调用描述。
		for (const tc of resp.toolCalls) {
			content.push({
				type: "toolCall",
				id: tc.id ?? `faux_tc_${++toolCallIdCounter}`,
				name: tc.name,
				arguments: tc.args,
			});
		}
	}

	// If no content was added at all, add empty text
	// 若未添加任何内容且不是错误，补充一个空文本块。
	if (content.length === 0 && !resp.error) {
		content.push({ type: "text", text: "" });
	}

	/** 根据显式值、错误或工具调用推导的停止原因。 */
	let stopReason: StopReason;
	if (resp.stopReason) {
		stopReason = resp.stopReason;
	} else if (resp.error) {
		stopReason = "error";
	} else if (resp.toolCalls && resp.toolCalls.length > 0) {
		stopReason = "toolUse";
	} else {
		stopReason = "stop";
	}

	return {
		role: "assistant",
		content,
		api: FAUX_API,
		provider: resp.model?.provider ?? FAUX_PROVIDER,
		model: resp.model?.id ?? FAUX_MODEL_ID,
		usage: buildUsage(resp.usage),
		stopReason,
		errorMessage: resp.error,
		timestamp: Date.now(),
	};
}

// ============================================================================
// Token-level streaming
// Token 级流式事件。
// ============================================================================

/** Split a string into chunks of varying size (3-5 chars) for simulating token-by-token streaming. */
/** 将字符串拆为 3 至 5 字符分片以模拟逐 Token 输出。参数 text 为原文；返回分片数组。例如：chunkString("hello")。 */
function chunkString(text: string): string[] {
	/** 模拟 Token 流时生成的字符串分片列表。 */
	const chunks: string[] = [];
	/** 当前处理的字符或内容块索引，从 0 开始。 */
	let i = 0;
	while (i < text.length) {
		/** 本轮随机分片长度，只取 3、4 或 5。 */
		const size = 3 + Math.floor(Math.random() * 3); // 3, 4, or 5
		chunks.push(text.slice(i, i + size));
		i += size;
	}
	return chunks.length > 0 ? chunks : [""];
}

/**
 * Stream a complete AssistantMessage through an EventStream with realistic
 * intermediate delta events for each content block.
 */
/** 将完整助手消息按内容块推入事件流。参数 stream 为目标流、message 为消息；无返回值。例如：streamWithDeltas(stream, message)。 */
function streamWithDeltas(stream: AssistantMessageEventStream, message: AssistantMessage): void {
	/** 消息停止原因是否属于 error 或 aborted。 */
	const isError = message.stopReason === "error" || message.stopReason === "aborted";

	// Build partial progressively as we stream content blocks
	// 在流式遍历内容块时逐步构建 partial 消息。
	/** 随增量事件逐步补齐的助手消息副本。 */
	const partial: AssistantMessage = { ...message, content: [] };
	stream.push({ type: "start", partial: { ...partial } });

	// i 是当前内容块索引，从 0 递增到消息内容末尾。
	for (let i = 0; i < message.content.length; i++) {
		/** 当前索引对应的助手内容块。 */
		const block = message.content[i];

		if (block.type === "thinking") {
			partial.content = [...partial.content, { type: "thinking", thinking: "" }];
			stream.push({ type: "thinking_start", contentIndex: i, partial: { ...partial } });

			// chunk 是当前思考文本的一个 3 至 5 字符模拟 Token 分片。
			for (const chunk of chunkString(block.thinking)) {
				(partial.content[i] as ThinkingContent).thinking += chunk;
				stream.push(makeEvent("thinking_delta", i, chunk, partial));
			}

			stream.push({
				type: "thinking_end",
				contentIndex: i,
				content: block.thinking,
				partial: { ...partial },
			});
		} else if (block.type === "text") {
			partial.content = [...partial.content, { type: "text", text: "" }];
			stream.push({ type: "text_start", contentIndex: i, partial: { ...partial } });

			// chunk 是当前文本内容的一个 3 至 5 字符模拟 Token 分片。
			for (const chunk of chunkString(block.text)) {
				(partial.content[i] as TextContent).text += chunk;
				stream.push(makeEvent("text_delta", i, chunk, partial));
			}

			stream.push({
				type: "text_end",
				contentIndex: i,
				content: block.text,
				partial: { ...partial },
			});
		} else if (block.type === "toolCall") {
			/** 工具调用参数序列化后的 JSON 文本。 */
			const argsJson = JSON.stringify(block.arguments);
			partial.content = [...partial.content, { type: "toolCall", id: block.id, name: block.name, arguments: {} }];
			stream.push({ type: "toolcall_start", contentIndex: i, partial: { ...partial } });

			// chunk 是工具参数 JSON 的一个模拟 Token 分片。
			for (const chunk of chunkString(argsJson)) {
				stream.push(makeEvent("toolcall_delta", i, chunk, partial));
			}

			// Final toolcall has the real parsed arguments
			// 工具调用结束事件使用已经解析完成的真实参数。
			(partial.content[i] as ToolCall).arguments = block.arguments;
			stream.push({
				type: "toolcall_end",
				contentIndex: i,
				toolCall: block,
				partial: { ...partial },
			});
		}
	}

	if (isError) {
		stream.push({ type: "error", reason: message.stopReason as "error" | "aborted", error: message });
	} else {
		stream.push({ type: "done", reason: message.stopReason as "stop" | "length" | "toolUse", message });
	}
}

/** 构造内容增量事件。参数为事件类型、内容索引、增量和当前消息；返回 AssistantMessageEvent。例如：makeEvent("text_delta",0,"a",partial)。 */
function makeEvent(
	type: "text_delta" | "thinking_delta" | "toolcall_delta",
	contentIndex: number,
	delta: string,
	partial: AssistantMessage,
): AssistantMessageEvent {
	return { type, contentIndex, delta, partial: { ...partial } };
}

// ============================================================================
// Stream function factory
// 流函数工厂。
// ============================================================================

export interface FauxStreamFnState {
	/** Number of times the stream function has been called. */
	/** 流函数累计调用次数。 */
	callCount: number;
	/** The context passed to each call, in order. */
	/** 按调用顺序保存的输入上下文。 */
	contexts: Context[];
}

/**
 * Create a faux stream function from a sequence of response descriptions.
 *
 * The function cycles through responses in order. If more calls are made than
 * responses provided, it wraps around.
 *
 * Returns the stream function and a state object for inspection.
 */
/** 从响应序列创建循环 faux 流。参数 responses 不可为空；返回 streamFn 与可观察 state。例如：createFauxStreamFn(["ok"])。 */
export function createFauxStreamFn(responses: FauxResponseInput[]): {
	/** 接收模型、上下文和可选设置并返回助手消息事件流的函数。 */
	streamFn: (model: Model<any>, context: Context, options?: SimpleStreamOptions) => AssistantMessageEventStream;
	/** 可供测试检查的调用次数与上下文状态。 */
	state: FauxStreamFnState;
} {
	if (responses.length === 0) {
		throw new Error("createFauxStreamFn requires at least one response");
	}

	/** 记录 faux 流调用次数和每次上下文的可观察状态。 */
	const state: FauxStreamFnState = { callCount: 0, contexts: [] };

	/** 按响应序列生成助手事件流的函数；接收模型、上下文和选项，返回 AssistantMessageEventStream。 */
	/** 接收模型、上下文和可选流设置，按响应序列返回事件流。例如：streamFn(model, context)。 */
	const streamFn = (_model: Model<any>, context: Context, _options?: SimpleStreamOptions) => {
		/** 按调用次数循环选择响应的数组下标。 */
		const index = state.callCount % responses.length;
		state.callCount++;
		state.contexts.push(context);

		/** 规范化后的当前 faux 响应描述。 */
		const resp = normalizeResponse(responses[index]);
		/** 由当前响应描述构造的完整助手消息。 */
		const message = buildAssistantMessage(resp);
		/** 当前模型调用返回的助手消息事件流。 */
		const stream = createAssistantMessageEventStream();

		/** 向事件流同步推送全部增量和结束事件的无参函数。 */
		/** 将完整消息拆成增量事件并推入当前流。无参数、无返回值。例如：emit()。 */
		const emit = () => {
			streamWithDeltas(stream, message);
		};

		if (resp.delayMs && resp.delayMs > 0) {
			setTimeout(emit, resp.delayMs);
		} else {
			queueMicrotask(emit);
		}

		return stream;
	};

	return { streamFn, state };
}

// ============================================================================
// Session harness
// 会话测试夹具。
// ============================================================================

export interface HarnessOptions {
	/** Response sequence for the faux provider. Default: single "ok" response. */
	/** faux 提供商的响应序列，默认只有一个 ok 响应。 */
	responses?: FauxResponseInput[];
	/** Model to use. Default: fauxModel. */
	/** 使用的模型，默认 fauxModel。 */
	model?: Model<any>;
	/** Context window override (applied to the model). */
	/** 应用到模型的可选上下文窗口覆盖值。 */
	contextWindow?: number;
	/** Settings overrides (retry, compaction, etc.). */
	/** 重试、压缩等设置覆盖项。 */
	settings?: Partial<Settings>;
	/** System prompt. Default: "You are a test assistant." */
	/** 系统提示词，默认使用测试助手文本。 */
	systemPrompt?: string;
	/** Custom tools to register on the agent. */
	/** 注册到 Agent 的自定义工具。 */
	tools?: AgentTool[];
	/** Base tools override (replaces built-in read/bash/edit/write). */
	/** 基础工具覆盖映射，会替代内置 read/bash/edit/write。 */
	baseToolsOverride?: Record<string, AgentTool>;
	/** Optional resource loader override. */
	/** 可选资源加载器覆盖。 */
	resourceLoader?: ResourceLoader;
	/** Inline extensions to load into the session resource loader. */
	/** 加载到会话资源加载器的内联扩展。 */
	extensionFactories?: Array<InlineExtension | CreateTestExtensionsResultInput>;
}

/** 汇集会话、底层依赖、捕获状态和清理能力的测试夹具。 */
export interface Harness {
	/** 供测试直接调用的 AgentSession。 */
	session: AgentSession;
	/** 会话内部使用的底层 Agent。 */
	agent: Agent;
	/** 保存消息树的内存会话管理器。 */
	sessionManager: SessionManager;
	/** 读取和覆盖会话设置的管理器。 */
	settingsManager: SettingsManager;
	/** Faux stream function state (call count, captured contexts). */
	/** faux 流的调用次数和上下文捕获状态。 */
	faux: FauxStreamFnState;
	/** All events emitted by the session, in order. */
	/** 会话按顺序发出的全部事件。 */
	events: AgentSessionEvent[];
	/** Filter captured events by type. */
	/** 按事件类型过滤捕获结果。 */
	eventsOfType<T extends AgentSessionEvent["type"]>(type: T): Extract<AgentSessionEvent, { type: T }>[];
	/** Temp directory (cleaned up by cleanup()). */
	/** cleanup 会删除的临时目录。 */
	tempDir: string;
	/** Dispose session and remove temp directory. */
	/** 释放会话并删除临时目录的函数。 */
	cleanup: () => void;
}

/** 创建并返回夹具专用临时目录。无参数；返回绝对路径。例如：createTempDir()。 */
function createTempDir(): string {
	/** 当前夹具创建的临时目录。 */
	const tempDir = join(tmpdir(), `pi-harness-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(tempDir, { recursive: true });
	return tempDir;
}

/** 使用明确资源加载器装配完整夹具。参数为选项、加载器和临时目录；返回 Harness。例如：await createHarnessWithResourceLoader(options, loader, dir)。 */
async function createHarnessWithResourceLoader(
	options: HarnessOptions,
	resourceLoader: ResourceLoader,
	tempDir: string,
): Promise<Harness> {
	/** 选项提供的模型，缺省为 fauxModel。 */
	const baseModel = options.model ?? fauxModel;
	/** 应用可选上下文窗口覆盖后的最终模型。 */
	const model: Model<any> = options.contextWindow ? { ...baseModel, contextWindow: options.contextWindow } : baseModel;

	/** 根据响应序列创建的 faux 流函数及其可观察状态。 */
	const { streamFn, state: fauxState } = createFauxStreamFn(options.responses ?? ["ok"]);

	/** 使用 faux 流函数和测试工具创建的底层 Agent。 */
	const agent = new Agent({
		getApiKey: () => "faux-key",
		initialState: {
			model,
			systemPrompt: options.systemPrompt ?? "You are a test assistant.",
			tools: options.tools ?? [],
		},
		streamFn: streamFn,
	});

	/** 夹具使用的内存会话管理器。 */
	const sessionManager = SessionManager.inMemory();
	/** 读取并应用测试覆盖项的设置管理器。 */
	const settingsManager = SettingsManager.create(tempDir, tempDir);

	if (options.settings) {
		settingsManager.applyOverrides(options.settings);
	}

	/** 在临时目录中保存 faux 凭据的认证存储。 */
	const authStorage = AuthStorage.create(join(tempDir, "auth.json"));
	await authStorage.modify(model.provider, async () => ({ type: "api_key", key: "faux-key" }));
	/** 注册最终 faux 模型并为会话提供认证的模型注册表。 */
	const modelRegistry = await createModelRegistry(authStorage, tempDir);
	modelRegistry.registerProvider(model.provider, {
		baseUrl: model.baseUrl,
		api: model.api,
		models: [
			{
				id: model.id,
				name: model.name,
				api: model.api,
				reasoning: model.reasoning,
				input: model.input,
				cost: model.cost,
				contextWindow: model.contextWindow,
				maxTokens: model.maxTokens,
				baseUrl: model.baseUrl,
			},
		],
	});

	/** 装配完成的 AgentSession。 */
	const session = new AgentSession({
		agent,
		sessionManager,
		settingsManager,
		cwd: tempDir,
		modelRuntime: getModelRuntime(modelRegistry),
		resourceLoader,
		baseToolsOverride: options.baseToolsOverride,
	});

	/** 按触发顺序捕获的全部 AgentSession 事件。 */
	const events: AgentSessionEvent[] = [];
	session.subscribe((event) => {
		events.push(event);
	});

	/** 释放会话并删除临时目录的清理函数。 */
	const cleanup = () => {
		session.dispose();
		if (existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true });
		}
	};

	return {
		session,
		agent,
		sessionManager,
		settingsManager,
		faux: fauxState,
		events,
		/** 参数 type 是目标事件类型；返回匹配事件数组；示例：`harness.eventsOfType("message_end")`。 */
		eventsOfType<T extends AgentSessionEvent["type"]>(type: T) {
			return events.filter((e): e is Extract<AgentSessionEvent, { type: T }> => e.type === type);
		},
		tempDir,
		cleanup,
	};
}

/** 创建不含内联扩展的标准夹具。参数 options 为响应、模型、设置和资源覆盖；返回 Harness。例如：await createHarness()。 */
export async function createHarness(options: HarnessOptions = {}): Promise<Harness> {
	if (options.extensionFactories?.length) {
		throw new Error("createHarness does not support extensionFactories. Use createHarnessWithExtensions().");
	}

	/** 当前夹具创建的临时目录。 */
	const tempDir = createTempDir();
	return await createHarnessWithResourceLoader(options, options.resourceLoader ?? createTestResourceLoader(), tempDir);
}

/** 创建并加载内联扩展的测试夹具。参数 options 含扩展工厂等配置；返回 Harness。例如：await createHarnessWithExtensions(options)。 */
export async function createHarnessWithExtensions(options: HarnessOptions = {}): Promise<Harness> {
	/** 当前夹具创建的临时目录。 */
	const tempDir = createTempDir();
	/** 根据内联扩展工厂构建的测试扩展加载结果。 */
	const extensionsResult = await createTestExtensionsResult(options.extensionFactories ?? [], tempDir);
	/** 显式选项或测试默认值提供的资源加载器。 */
	const resourceLoader = options.resourceLoader ?? createTestResourceLoader({ extensionsResult });
	return await createHarnessWithResourceLoader(options, resourceLoader, tempDir);
}
