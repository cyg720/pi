import type { AnthropicOptions } from "./api/anthropic-messages.ts";
import type { AzureOpenAIResponsesOptions } from "./api/azure-openai-responses.ts";
import type { BedrockOptions } from "./api/bedrock-converse-stream.ts";
import type { GoogleOptions } from "./api/google-generative-ai.ts";
import type { GoogleVertexOptions } from "./api/google-vertex.ts";
import type { MistralOptions } from "./api/mistral-conversations.ts";
import type { OpenAICodexResponsesOptions } from "./api/openai-codex-responses.ts";
import type { OpenAICompletionsOptions } from "./api/openai-completions.ts";
import type { OpenAIResponsesOptions } from "./api/openai-responses.ts";
import type { PiMessagesOptions } from "./api/pi-messages.ts";
import type { AssistantMessageDiagnostic } from "./utils/diagnostics.ts";
import type { AssistantMessageEventStream } from "./utils/event-stream.ts";

export type { AssistantMessageEventStream } from "./utils/event-stream.ts";

/**
 * 【文件职责】pi-ai 核心类型契约：API/供应商/模型/消息/用量/选项/流事件等全部公共类型，
 *              以及各 API 的兼容性配置（OpenAI/Anthropic/Bedrock/OpenRouter 路由等）。
 * 【技术维度】类型别名/联合/条件映射（ApiOptionsMap→ApiStreamOptions）；接口继承与泛型；
 *              字符串字面量联合 + 开放字符串（KnownApi | string）兼顾类型安全与扩展。
 * 【产品维度】是包内所有模块共同的语言：模型目录、API 实现、上层应用全部依此对接。
 * 【逻辑维度】标识联合（API/供应商）→ 通用选项 → API 选项映射 → 流契约 → 图片体系 →
 *              消息内容与用量 → 消息联合 → 事件协议 → 各 API 兼容配置 → 模型接口。
 * 【关键边界】StreamFunction 契约：失败必须编码进事件流而非抛出；Headers 的 null 值表示
 *              抑制同名默认头；compat 字段按 TApi 条件收窄。
 * 【新手阅读建议】先读 Message/Model/StreamOptions 三大核心 → 再读事件协议 →
 *              最后按需查阅各 Compat 配置（自定义供应商时必看）。
 */
// 已知 API 标识联合（内置 API 名称）
export type KnownApi =
	| "openai-completions"
	| "mistral-conversations"
	| "openai-responses"
	| "azure-openai-responses"
	| "openai-codex-responses"
	| "anthropic-messages"
	| "bedrock-converse-stream"
	| "google-generative-ai"
	| "google-vertex"
	| "pi-messages";

export type Api = KnownApi | (string & {});
// API 类型：已知值或任意字符串（允许自定义 API 扩展）

// 已知图片生成 API
export type KnownImagesApi = "openrouter-images";

// 图片 API 类型（可扩展）
export type ImagesApi = KnownImagesApi | (string & {});

// 已知供应商 ID 联合（内置供应商）
export type KnownProvider =
	| "amazon-bedrock"
	| "ant-ling"
	| "anthropic"
	| "google"
	| "google-vertex"
	| "openai"
	| "azure-openai-responses"
	| "openai-codex"
	| "radius"
	| "nvidia"
	| "deepseek"
	| "github-copilot"
	| "xai"
	| "groq"
	| "cerebras"
	| "openrouter"
	| "vercel-ai-gateway"
	| "zai"
	| "zai-coding-cn"
	| "mistral"
	| "minimax"
	| "minimax-cn"
	| "moonshotai"
	| "moonshotai-cn"
	| "huggingface"
	| "fireworks"
	| "together"
	| "opencode"
	| "opencode-go"
	| "kimi-coding"
	| "cloudflare-workers-ai"
	| "cloudflare-ai-gateway"
	| "qwen-token-plan"
	| "qwen-token-plan-cn"
	| "xiaomi"
	| "xiaomi-token-plan-cn"
	| "xiaomi-token-plan-ams"
	| "xiaomi-token-plan-sgp";
export type ProviderId = KnownProvider | string;
// 供应商 ID 类型（可扩展）

// 已知图片供应商
export type KnownImagesProvider = "openrouter";

export type ImagesProviderId = KnownImagesProvider | string;
// 图片供应商 ID 类型

// 思考强度（不含 off）：minimal~max 共六档
export type ThinkingLevel = "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
export type ModelThinkingLevel = "off" | ThinkingLevel;
// 模型思考强度：含 off（关闭）
export type ThinkingLevelMap = Partial<Record<ModelThinkingLevel, string | null>>;
// 思考级别映射：pi 档位 → 供应商具体取值；null 表示该档不受支持
export type ChatTemplateKwargValue =
// chat 模板参数字面量类型：可含 $var 引用 pi 控制的思考开关/强度
	| string
	| number
	| boolean
	| null
	| {
			$var: "thinking.enabled" | "thinking.effort";
			omitWhenOff?: boolean;
	  };

/** Token budgets for each thinking level (token-based providers only) */
/** 各思考级别的 token 预算（中文说明）：仅按 token 计费的供应商使用。 */
export interface ThinkingBudgets {
	minimal?: number;
	// minimal 档预算
	low?: number;
	// low 档预算
	medium?: number;
	// medium 档预算
	high?: number;
	// high 档预算
}

// 各供应商共享的基础选项
// Base options all providers share
// 提示缓存保留策略：无/短/长
export type CacheRetention = "none" | "short" | "long";

// 传输方式：SSE / WebSocket / WebSocket+缓存 / 自动
export type Transport = "sse" | "websocket" | "websocket-cached" | "auto";

/** Provider-scoped environment overrides. Values take precedence over process.env. */
// 供应商作用域环境变量覆盖（优先于 process.env）
export type ProviderEnv = Record<string, string>;
export type ProviderHeaders = Record<string, string | null>;
// 请求头类型：null 值表示抑制同名默认头
export type SessionAffinityFormat = "openai" | "openai-nosession" | "openrouter";
// 会话亲和头格式：openai 带 session_id；openai-nosession 不带；openrouter 用 x-session-id

/** 供应商 HTTP 响应元信息（中文说明）：供 onResponse 回调观察。 */
export interface ProviderResponse {
	status: number;
	// HTTP 状态码
	headers: Record<string, string>;
	// 响应头
}

/**
 * 流式请求选项（中文说明）：所有供应商共享的基类选项——
 * 采样参数、中止、密钥、传输、缓存、会话、载荷/响应回调、头、超时、重试与元数据。
 */
export interface StreamOptions {
	temperature?: number;
	// 采样温度
	maxTokens?: number;
	// 最大输出 token 数
	signal?: AbortSignal;
	// 中止信号
	apiKey?: string;
	// 显式 API 密钥（优先于认证解析）
	/**
	 * Preferred transport for providers that support multiple transports.
	 * Providers that do not support this option ignore it.
	 */
	transport?: Transport;
	// 首选传输方式（不支持多传输的供应商忽略）
	/**
	 * Prompt cache retention preference. Providers map this to their supported values.
	 * Default: "short".
	 */
	cacheRetention?: CacheRetention;
	// 缓存保留偏好；默认 "short"
	/**
	 * Optional session identifier for providers that support session-based caching.
	 * Providers can use this to enable prompt caching, request routing, or other
	 * session-aware features. Ignored by providers that don't support it.
	 */
	sessionId?: string;
	// 会话 ID：支持会话缓存的供应商可用它启用提示缓存/路由等
	/**
	 * Optional callback for inspecting or replacing provider payloads before sending.
	 * Return undefined to keep the payload unchanged.
	 */
	onPayload?: (payload: unknown, model: Model<Api>) => unknown | undefined | Promise<unknown | undefined>;
	// 载荷回调：发送前检查/替换载荷；返回 undefined 保持原样
	/**
	 * Optional callback invoked after an HTTP response is received and before
	 * its body stream is consumed.
	 */
	onResponse?: (response: ProviderResponse, model: Model<Api>) => void | Promise<void>;
	// 响应回调：收到 HTTP 响应且尚未消费 body 时触发
	/**
	 * Optional custom HTTP headers to include in API requests.
	 * Merged with provider defaults; caller values override default headers.
	 * On AWS Bedrock these are injected via a Smithy `build`-step middleware so
	 * they are covered by SigV4 signing; reserved headers (`x-amz-*`,
	 * `authorization`, `host`) are silently ignored to preserve SigV4 / bearer auth.
	 * A null value suppresses a provider/API default header with the same name.
	 */
	headers?: ProviderHeaders;
	// 自定义请求头：与默认头合并、调用方优先；Bedrock 走 SigV4 签名中间件；
	// null 值抑制同名默认头
	/**
	 * HTTP request timeout in milliseconds for providers/SDKs that support it.
	 * For example, OpenAI and Anthropic SDK clients default to 10 minutes.
	 */
	timeoutMs?: number;
	// HTTP 请求超时（毫秒）；OpenAI/Anthropic SDK 默认 10 分钟
	/**
	 * WebSocket connect timeout in milliseconds for providers that support
	 * WebSocket transports. This covers the connection/open handshake only;
	 * stream idleness after connection uses timeoutMs.
	 */
	websocketConnectTimeoutMs?: number;
	// WebSocket 建连超时（毫秒）；连接后的空闲用 timeoutMs
	/**
	 * Maximum retry attempts for providers/SDKs that support client-side retries.
	 * For example, OpenAI and Anthropic SDK clients default to 2.
	 */
	maxRetries?: number;
	// 客户端重试次数上限
	/**
	 * Maximum delay in milliseconds to wait for a retry when the server requests a long wait.
	 * If the server's requested delay exceeds this value, the request fails immediately
	 * with an error containing the requested delay, allowing higher-level retry logic
	 * to handle it with user visibility.
	 * Default: 60000 (60 seconds). Set to 0 to disable the cap.
	 */
	maxRetryDelayMs?: number;
	// 服务端要求长等待时的最大等待上限（毫秒）；超限立即失败并携带请求延迟；
	// 默认 60000，设 0 关闭上限
	/**
	 * Optional metadata to include in API requests.
	 * Providers extract the fields they understand and ignore the rest.
	 * For example, Anthropic uses `user_id` for abuse tracking and rate limiting.
	 */
	metadata?: Record<string, unknown>;
	// 元数据：供应商提取认识的字段（如 Anthropic 的 user_id）
	/**
	 * Provider-scoped environment values. These take precedence over process.env for
	 * provider configuration such as regional settings, endpoint placeholders, and
	 * proxy variables.
	 */
	env?: ProviderEnv;
	// 供应商作用域环境变量
}

// 宽化的流选项（未知键透传）
export type ProviderStreamOptions = StreamOptions & Record<string, unknown>;

/**
 * Maps known APIs to their full provider-specific stream option types.
 * Type-only imports from API implementation modules are erased at emit, so
 * this is tree-shake safe.
 */
/** API → 完整供应商选项 的映射表（中文说明）：仅类型导入、构建期擦除，摇树安全。 */
export interface ApiOptionsMap {
	"anthropic-messages": AnthropicOptions;
	"openai-completions": OpenAICompletionsOptions;
	"openai-responses": OpenAIResponsesOptions;
	"openai-codex-responses": OpenAICodexResponsesOptions;
	"azure-openai-responses": AzureOpenAIResponsesOptions;
	"google-generative-ai": GoogleOptions;
	"google-vertex": GoogleVertexOptions;
	"mistral-conversations": MistralOptions;
	"bedrock-converse-stream": BedrockOptions;
	"pi-messages": PiMessagesOptions;
}

/**
 * Full stream options for an API. Known APIs resolve to their concrete option
 * type; custom API strings fall back to the generic shape.
 */
// API 流选项（中文说明）：已知 API 解析为其具体选项类型；自定义 API 回退通用形态
export type ApiStreamOptions<TApi extends Api> = TApi extends keyof ApiOptionsMap
	? ApiOptionsMap[TApi]
	: StreamOptions & Record<string, unknown>;

/**
 * The uniform stream contract of an API implementation module: every module
 * under `src/api/` exports exactly `stream` and `streamSimple`, so the module
 * itself satisfies this interface. Lazy wrappers (`lazyApi()`) and provider
 * factories pass these around as values. This is the untyped dispatch shape;
 * per-API option typing lives on the implementation modules themselves and on
 * `Provider.stream()` via `ApiStreamOptions`.
 */
/**
 * API 实现模块的统一流契约（中文说明）：每个 src/api/ 下模块恰好导出
 * stream 与 streamSimple，因此模块本身满足此接口；懒包装与供应商工厂以值传递。
 * 这是无类型分派形态；具体选项类型在各实现模块与 Provider.stream 上。
 */
export interface ProviderStreams {
	stream(model: Model<Api>, context: Context, options?: StreamOptions): AssistantMessageEventStream;
	streamSimple(model: Model<Api>, context: Context, options?: SimpleStreamOptions): AssistantMessageEventStream;
}

/**
 * The uniform contract of an image-generation API implementation module:
 * every image API module under `src/api/` exports exactly `generateImages`,
 * so the module itself satisfies this interface. Lazy wrappers and image
 * provider factories pass these around as values.
 */
/** 图片生成 API 实现模块的统一契约（中文说明）：每个图片 API 模块导出 generateImages。 */
export interface ProviderImages {
	generateImages(
		model: ImagesModel<ImagesApi>,
		context: ImagesContext,
		options?: ImagesOptions,
	): Promise<AssistantImages>;
}

/** 图片生成选项（中文说明）：与 StreamOptions 结构平行（密钥/回调/头/超时/重试/元数据）。 */
export interface ImagesOptions {
	signal?: AbortSignal;
	apiKey?: string;
	/**
	 * Provider-scoped environment values. These take precedence over process.env for
	 * provider configuration such as endpoint placeholders and proxy variables.
	 */
	env?: ProviderEnv;
	/**
	 * Optional callback for inspecting or replacing provider payloads before sending.
	 * Return undefined to keep the payload unchanged.
	 */
	onPayload?: (payload: unknown, model: ImagesModel<ImagesApi>) => unknown | undefined | Promise<unknown | undefined>;
	/**
	 * Optional callback invoked after an HTTP response is received.
	 */
	onResponse?: (response: ProviderResponse, model: ImagesModel<ImagesApi>) => void | Promise<void>;
	/**
	 * Optional custom HTTP headers to include in API requests.
	 * Merged with provider defaults; can override default headers.
	 * A null value suppresses a provider/API default header with the same name.
	 */
	headers?: ProviderHeaders;
	/**
	 * HTTP request timeout in milliseconds for providers/SDKs that support it.
	 */
	timeoutMs?: number;
	/**
	 * Maximum retry attempts for providers/SDKs that support client-side retries.
	 */
	maxRetries?: number;
	/**
	 * Maximum delay in milliseconds to wait for a retry when the server requests a long wait.
	 * If the server's requested delay exceeds this value, the request fails immediately
	 * with an error containing the requested delay, allowing higher-level retry logic
	 * to handle it with user visibility.
	 * Default: 60000 (60 seconds). Set to 0 to disable the cap.
	 */
	maxRetryDelayMs?: number;
	/**
	 * Optional metadata to include in API requests.
	 * Providers extract the fields they understand and ignore the rest.
	 */
	metadata?: Record<string, unknown>;
}

// 宽化的图片选项
export type ProviderImagesOptions = ImagesOptions & Record<string, unknown>;

// Unified options with reasoning passed to streamSimple() and completeSimple()
/**
 * 简化流式选项（中文说明）：在基础选项上补充思考强度与各级 token 预算，
 * 供 streamSimple/completeSimple 使用。
 */
export interface SimpleStreamOptions extends StreamOptions {
	reasoning?: ThinkingLevel;
	// 思考强度（不含 off；off 通过省略字段表达）
	/** Custom token budgets for thinking levels (token-based providers only) */
	// 各思考级别的自定义 token 预算（仅按 token 计费的供应商）
	thinkingBudgets?: ThinkingBudgets;
}

// Generic StreamFunction with typed options.
//
// Contract:
// - Must return an AssistantMessageEventStream.
// - Once invoked, request/model/runtime failures should be encoded in the
//   returned stream, not thrown.
// - Error termination must produce an AssistantMessage with stopReason
//   "error" or "aborted" and errorMessage, emitted via the stream protocol.
/**
 * 泛型流式函数（中文说明）：契约——必须返回 AssistantMessageEventStream；
 * 请求/模型/运行时失败必须编码进流而非抛出；错误终止需以 stopReason
 * "error"/"aborted" 与 errorMessage 的助手消息结束。
 */
export type StreamFunction<TApi extends Api = Api, TOptions extends StreamOptions = StreamOptions> = (
	model: Model<TApi>,
	context: Context,
	options?: TOptions,
) => AssistantMessageEventStream;

// 泛型图片生成函数：返回 Promise<AssistantImages>
export type ImagesFunction<TApi extends ImagesApi = ImagesApi, TOptions extends ImagesOptions = ImagesOptions> = (
	model: ImagesModel<TApi>,
	context: ImagesContext,
	options?: TOptions,
) => Promise<AssistantImages>;

/** 文本签名 V1（中文说明）：OpenAI responses 消息元数据（旧 ID 字符串或此 JSON）。 */
export interface TextSignatureV1 {
	v: 1;
	id: string;
	// 模型 ID
	phase?: "commentary" | "final_answer";
}

/** 文本内容块（中文说明）：text 正文；textSignature 可选签名（供多轮连续性回传）。 */
export interface TextContent {
	type: "text";
	text: string;
	textSignature?: string; // e.g., for OpenAI responses, message metadata (legacy id string or TextSignatureV1 JSON)
}

/** 思考内容块（中文说明）：thinking 思考文本；redacted 为 true 表示被安全过滤、
 * 密文存于 thinkingSignature 供多轮回传。 */
export interface ThinkingContent {
	type: "thinking";
	thinking: string;
	thinkingSignature?: string; // e.g., for OpenAI responses, the reasoning item ID
	/** When true, the thinking content was redacted by safety filters. The opaque
	 *  encrypted payload is stored in `thinkingSignature` so it can be passed back
	 *  to the API for multi-turn continuity. */
	redacted?: boolean;
}

/** 图片内容块（中文说明）：data 为 base64 编码图片；mimeType 类型。 */
export interface ImageContent {
	type: "image";
	data: string; // base64 encoded image data
	mimeType: string; // e.g., "image/jpeg", "image/png"
}

/** 工具调用块（中文说明）：id 调用 ID；name 工具名；arguments 参数对象；
 * thoughtSignature 为 Google 专属的思考上下文复用签名。 */
export interface ToolCall {
	type: "toolCall";
	id: string;
	name: string;
	// 模型名称
	arguments: Record<string, any>;
	thoughtSignature?: string; // Google-specific: opaque signature for reusing thought context
}

/** 用量统计（中文说明）：input/output/cacheRead/cacheWrite 为 token 数；
 * cacheWrite1h 为 1h 保留的写入子集（仅 Anthropic 上报）；reasoning 为推理 token
 * （output 的子集）；cost 为按模型费率计算的成本。 */
export interface Usage {
	input: number;
	// 输入 token 数
	output: number;
	// 输出 token 数
	cacheRead: number;
	// 缓存读取 token 数
	cacheWrite: number;
	// 缓存写入 token 数
	/** Subset of `cacheWrite` written with 1h retention. Only Anthropic reports this split. */
	cacheWrite1h?: number;
	// 1h 保留写入的子集（仅 Anthropic 上报该拆分）
	/**
	 * Reasoning/thinking tokens, when the provider reports them. This is a subset of
	 * `output`: `output` already includes these tokens. Set to a number (possibly 0) by
	 * providers that expose a reasoning breakdown; left undefined by providers that don't.
	 */
	reasoning?: number;
	// 推理/思考 token（output 的子集；供应商上报时才有）
	totalTokens: number;
	// 总 token 数
	cost: {
	// 成本明细（按模型费率计算）
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		total: number;
	};
}

// 停止原因：正常结束/达长度上限/请求工具/错误/被中止
export type StopReason = "stop" | "length" | "toolUse" | "error" | "aborted";

/** 用户消息（中文说明）：role 固定 user；content 为文本或文本/图片块数组。 */
export interface UserMessage {
	role: "user";
	content: string | (TextContent | ImageContent)[];
	timestamp: number; // Unix timestamp in milliseconds
}

/** 助手消息（中文说明）：content 为文本/思考/工具调用块；含 api/provider/model 溯源、
 * 用量、停止原因、错误信息与诊断；responseModel/responseId 为上游返回的实际模型与响应 ID。 */
export interface AssistantMessage {
	role: "assistant";
	content: (TextContent | ThinkingContent | ToolCall)[];
	api: Api;
	provider: ProviderId;
	// 所属供应商
	model: string;
	responseModel?: string; // Concrete `chunk.model` when different from the requested `model` (e.g. OpenRouter `auto` -> `anthropic/...`)
	responseId?: string; // Provider-specific response/message identifier when the upstream API exposes one
	diagnostics?: AssistantMessageDiagnostic[]; // Redacted provider/runtime diagnostics for failures and recoveries.
	usage: Usage;
	stopReason: StopReason;
	errorMessage?: string;
	timestamp: number; // Unix timestamp in milliseconds
}

/** 工具结果消息（中文说明）：content 支持文本与图片；usage 仅作参考不计入主对话核算；
 * addedToolNames 标记从此处起新可用的工具；isError 标记错误。 */
export interface ToolResultMessage<TDetails = any> {
	role: "toolResult";
	toolCallId: string;
	toolName: string;
	content: (TextContent | ImageContent)[]; // Supports text and images
	details?: TDetails;
	/** Usage from the tool execution itself, if available. Not part of main LLM context accounting. */
	usage?: Usage;
	/**
	 * Names from `Context.tools` that became available after this result.
	 * Providers with native deferred tool loading use this as the load point;
	 * other providers ignore it and use `Context.tools` normally.
	 */
	addedToolNames?: string[];
	isError: boolean;
	timestamp: number; // Unix timestamp in milliseconds
}

// 标准消息联合
export type Message = UserMessage | AssistantMessage | ToolResultMessage;

// 图片输入内容块
export type ImagesInputContent = TextContent | ImageContent;
export type ImagesOutputContent = TextContent | ImageContent;
// 图片输出内容块

/** 图片生成上下文（中文说明）：input 为输入内容块数组。 */
export interface ImagesContext {
	input: ImagesInputContent[];
}

// 图片停止原因
export type ImagesStopReason = "stop" | "error" | "aborted";

/** 图片生成结果（中文说明）：output 生成内容；用法与错误信息同助手消息。 */
export interface AssistantImages {
	api: ImagesApi;
	provider: ImagesProviderId;
	model: string;
	output: ImagesOutputContent[];
	responseId?: string;
	usage?: Usage;
	stopReason: ImagesStopReason;
	errorMessage?: string;
	timestamp: number; // Unix timestamp in milliseconds
}

import type { TSchema } from "typebox";

/** OpenAI grammar variants for constrained sampling. */
// 受约束采样语法格式（OpenAI 的 Lark/正则）
export type GrammarFormat = "openai_lark" | "openai_regex";

export type GrammarVariants = Partial<Record<GrammarFormat, string>>;
// 各供应商语法的变体编码

/**
 * Optional provider-side constrained sampling configs for a tool.
 *
 * The `json_schema` value roughly maps to the concept of `strict` in APIs which is
 * implemented as json-schema constrained sampling by APIs. Grammar variants let
 * callers provide provider-specific encodings of the same intended language.
 */
/**
 * 工具的可选供应商端受约束采样配置（中文说明）：json_schema 大体对应 API 的 strict；
 * grammar 让调用方为同一意图语言提供供应商专属编码。
 */
export type ConstrainedSamplingConfig =
	| {
			type: "json_schema";
			strict: "prefer" | "require";
	  }
	| {
			type: "grammar";
			variants: GrammarVariants;
	  };

/** 工具定义（中文说明）：name/description/parameters（typebox schema）；
 * constrainedSampling 可选开启受约束采样。 */
export interface Tool<TParameters extends TSchema = TSchema> {
	name: string;
	description: string;
	parameters: TParameters;
	constrainedSampling?: false | ConstrainedSamplingConfig;
}

/** 模型请求上下文（中文说明）：可选系统提示词 + 消息 + 可选工具。 */
export interface Context {
	systemPrompt?: string;
	messages: Message[];
	tools?: Tool[];
}

/**
 * Event protocol for AssistantMessageEventStream.
 *
 * Streams should emit `start` before partial updates, then terminate with either:
 * - `done` carrying the final successful AssistantMessage, or
 * - `error` carrying the final AssistantMessage with stopReason "error" or "aborted"
 *   and errorMessage.
 */
/**
 * 流事件协议（中文说明）：流先发 start，随后是各增量事件，
 * 最终以 done（成功）或 error（aborted/error）终止。
 */
export type AssistantMessageEvent =
	| { type: "start"; partial: AssistantMessage }
	| { type: "text_start"; contentIndex: number; partial: AssistantMessage }
	| { type: "text_delta"; contentIndex: number; delta: string; partial: AssistantMessage }
	| { type: "text_end"; contentIndex: number; content: string; partial: AssistantMessage }
	| { type: "thinking_start"; contentIndex: number; partial: AssistantMessage }
	| { type: "thinking_delta"; contentIndex: number; delta: string; partial: AssistantMessage }
	| { type: "thinking_end"; contentIndex: number; content: string; partial: AssistantMessage }
	| { type: "toolcall_start"; contentIndex: number; partial: AssistantMessage }
	| { type: "toolcall_delta"; contentIndex: number; delta: string; partial: AssistantMessage }
	| { type: "toolcall_end"; contentIndex: number; toolCall: ToolCall; partial: AssistantMessage }
	| { type: "done"; reason: Extract<StopReason, "stop" | "length" | "toolUse">; message: AssistantMessage }
	| { type: "error"; reason: Extract<StopReason, "aborted" | "error">; error: AssistantMessage };

/**
 * Compatibility settings for OpenAI-compatible completions APIs.
 * Use this to override URL-based auto-detection for custom providers.
 */
/** OpenAI 兼容补全 API 的兼容设置（中文说明）：覆盖基于 URL 的自动探测。 */
export interface OpenAICompletionsCompat {
	/** Whether the provider supports the `store` field. Default: auto-detected from URL. */
	supportsStore?: boolean;
	/** Whether the provider supports the `developer` role (vs `system`). Default: auto-detected from URL. */
	supportsDeveloperRole?: boolean;
	/** Whether the provider supports `reasoning_effort`. Default: auto-detected from URL. */
	supportsReasoningEffort?: boolean;
	/** Whether the provider supports `stream_options: { include_usage: true }` for token usage in streaming responses. Default: true. */
	supportsUsageInStreaming?: boolean;
	/** Which field to use for max tokens. Default: auto-detected from URL. */
	maxTokensField?: "max_completion_tokens" | "max_tokens";
	/** Whether tool results require the `name` field. Default: auto-detected from URL. */
	requiresToolResultName?: boolean;
	/** Whether a user message after tool results requires an assistant message in between. Default: auto-detected from URL. */
	requiresAssistantAfterToolResult?: boolean;
	/** Whether thinking blocks must be converted to text blocks with <thinking> delimiters. Default: auto-detected from URL. */
	requiresThinkingAsText?: boolean;
	/** Whether all replayed assistant messages must include an empty reasoning_content field when reasoning is enabled. Default: auto-detected from URL. */
	requiresReasoningContentOnAssistantMessages?: boolean;
	/** Format for reasoning/thinking parameter. "openai" uses reasoning_effort, "openrouter" uses reasoning: { effort }, "deepseek" uses thinking: { type } plus reasoning_effort when supported, "together" uses reasoning: { enabled } plus reasoning_effort when supported, "zai" uses thinking: { type }, "qwen" uses top-level enable_thinking: boolean, "qwen-chat-template" uses chat_template_kwargs.enable_thinking and preserve_thinking, "chat-template" uses configurable chat_template_kwargs, "string-thinking" uses top-level thinking: string, and "ant-ling" uses reasoning: { effort } only when the mapped effort is non-null. Default: "openai". */
	thinkingFormat?:
		| "openai"
		| "openrouter"
		| "deepseek"
		| "together"
		| "zai"
		| "qwen"
		| "chat-template"
		| "qwen-chat-template"
		| "string-thinking"
		| "ant-ling";
	/** Kwargs to send as `chat_template_kwargs` when `thinkingFormat` is `chat-template`. Use `{ "$var": "thinking.enabled" }` or `{ "$var": "thinking.effort" }` for pi-controlled thinking values. */
	chatTemplateKwargs?: Record<string, ChatTemplateKwargValue>;
	/** OpenRouter-compatible routing preferences sent as the `provider` request field. */
	openRouterRouting?: OpenRouterRouting;
	/** Vercel AI Gateway routing preferences. Only used when baseUrl points to Vercel AI Gateway. */
	vercelGatewayRouting?: VercelGatewayRouting;
	/** Whether z.ai supports top-level `tool_stream: true` for streaming tool call deltas. Default: false. */
	zaiToolStream?: boolean;
	/** Whether the provider supports OpenAI custom tools with Lark/regex grammar formats. When false, grammar-constrained tools fall back to normal function tools. Default: false; the generated model catalog enables it for capable models. */
	supportsOpenAIGrammarTools?: boolean;
	/** Whether the provider supports the `strict` field in tool definitions. Default: true. */
	supportsStrictMode?: boolean;
	/** Cache control convention for prompt caching. "anthropic" applies Anthropic-style `cache_control` markers to the system prompt, last tool definition, and last user, assistant, or tool-result text content. */
	cacheControlFormat?: "anthropic";
	/** Whether to send session-affinity data from `options.sessionId`. Default: false. */
	sendSessionAffinityHeaders?: boolean;
	/** Provider-specific deferred tool serialization mode. */
	deferredToolsMode?: "kimi";
	/** Session-affinity header format: `openai` sends `session_id`, `x-client-request-id`, and `x-session-affinity`; `openai-nosession` sends `x-client-request-id` and `x-session-affinity`; `openrouter` sends `x-session-id`. Does not affect the `prompt_cache_key` body param, which is governed by cache retention. Default: auto-detected. */
	sessionAffinityFormat?: SessionAffinityFormat;
	/** Whether the provider supports long prompt cache retention (`prompt_cache_retention: "24h"` or Anthropic-style `cache_control.ttl: "1h"`, depending on format). Default: true. */
	supportsLongCacheRetention?: boolean;
}

/** Compatibility settings for OpenAI Responses APIs. */
/** OpenAI Responses API 的兼容设置（中文说明）。 */
export interface OpenAIResponsesCompat {
	/** Whether the provider supports the `developer` role (vs `system`). Default: true. */
	supportsDeveloperRole?: boolean;
	/** Session-affinity header format: `openai` sends `session_id` and `x-client-request-id`; `openai-nosession` sends `x-client-request-id`; `openrouter` sends `x-session-id`. Does not affect the `prompt_cache_key` body param, which is governed by cache retention. Default: auto-detected. */
	sessionAffinityFormat?: SessionAffinityFormat;
	/** Whether the provider supports `prompt_cache_retention: "24h"`. Default: true. */
	supportsLongCacheRetention?: boolean;
	/** Whether the provider supports strict JSON-schema function tools. Defaults are API-specific; generated OpenAI models enable it explicitly. */
	supportsStrictMode?: boolean;
	/** Whether to emit OpenAI custom tools with Lark/regex grammar formats. When false, grammar-constrained tools fall back to normal function tools. Default: false; the generated model catalog enables it for capable models. */
	supportsOpenAIGrammarTools?: boolean;
	/** Whether the model supports client-executed tool search for deferred tools. Default: false. */
	supportsToolSearch?: boolean;
	/** Whether the model accepts `prompt_cache_options` (OpenAI GPT-5.6+ explicit prompt caching). Older OpenAI models reject the parameter. Default: false. */
	supportsExplicitPromptCacheMode?: boolean;
}

/** Compatibility settings for Anthropic Messages-compatible APIs. */
/** Anthropic Messages 兼容 API 的设置（中文说明）：工具流式/缓存/思考格式等开关。 */
export interface AnthropicMessagesCompat {
	/**
	 * Whether the provider accepts per-tool `eager_input_streaming`.
	 * When false, the Anthropic provider omits `tools[].eager_input_streaming`
	 * and sends the legacy `fine-grained-tool-streaming-2025-05-14` beta header
	 * for tool-enabled requests.
	 * Default: true.
	 */
	supportsEagerToolInputStreaming?: boolean;
	/** Whether the provider supports Anthropic long cache retention (`cache_control.ttl: "1h"`). Default: true. */
	supportsLongCacheRetention?: boolean;
	/**
	 * Whether to send the `x-session-affinity` header from `options.sessionId`
	 * when caching is enabled. Required for providers like Fireworks that use
	 * session affinity for prompt cache routing (requests to the same replica
	 * maximize cache hits).
	 * Default: false.
	 */
	sendSessionAffinityHeaders?: boolean;
	/**
	 * Whether the provider supports Anthropic-style `cache_control` markers on
	 * tool definitions. When false, `cache_control` is omitted from tool params.
	 * Some Anthropic-compatible providers (e.g., Fireworks) do not support this
	 * field on tools and may reject or ignore it.
	 * Default: true.
	 */
	supportsCacheControlOnTools?: boolean;
	/**
	 * Whether the model accepts the Anthropic `temperature` request field.
	 * Claude Opus 4.7+ rejects non-default temperature values.
	 * Default: true.
	 */
	supportsTemperature?: boolean;
	/**
	 * Whether to force adaptive thinking (`thinking.type: "adaptive"` plus
	 * `output_config.effort`) regardless of the model id. Built-in models that
	 * require adaptive thinking set this in generated metadata. Custom
	 * Anthropic-compatible providers can set this to `true` for any model whose
	 * upstream requires the adaptive format. Set to `false` to
	 * opt out on overridden built-in models.
	 * Default: false.
	 */
	forceAdaptiveThinking?: boolean;
	/** Whether to replay empty thinking signatures as `signature: ""` instead of converting thinking to text. Default: false. */
	allowEmptySignature?: boolean;
	/** Whether the provider supports Anthropic strict tool schemas. Default: false; generated Anthropic models enable it explicitly. */
	supportsStrictTools?: boolean;
	/**
	 * Whether the provider supports deferred tools loaded by `tool_reference`
	 * blocks in tool results. Default: true for first-party Anthropic models
	 * except Haiku and models older than Claude 4.5; false for other providers.
	 */
	supportsToolReferences?: boolean;
}

/** Compatibility settings for Amazon Bedrock models. */
/** Amazon Bedrock 模型兼容设置（中文说明）。 */
export interface BedrockCompat {
	/** Whether the model supports Bedrock strict tool schemas. Default: false. */
	supportsStrictMode?: boolean;
}

/**
 * OpenRouter provider routing preferences.
 * Controls which upstream providers OpenRouter routes requests to.
 * Sent as the `provider` field in the OpenRouter API request body.
 * @see https://openrouter.ai/docs/guides/routing/provider-selection
 */
/**
 * OpenRouter 路由偏好（中文说明）：作为请求体的 provider 字段发送，
 * 控制路由到哪些上游供应商及排序/过滤策略。
 */
export interface OpenRouterRouting {
	/** Whether to allow backup providers to serve requests. Default: true. */
	allow_fallbacks?: boolean;
	/** Whether to filter providers to only those that support all parameters in the request. Default: false. */
	require_parameters?: boolean;
	/** Data collection setting. "allow" (default): allow providers that may store/train on data. "deny": only use providers that don't collect user data. */
	data_collection?: "deny" | "allow";
	/** Whether to restrict routing to only ZDR (Zero Data Retention) endpoints. */
	zdr?: boolean;
	/** Whether to restrict routing to only models that allow text distillation. */
	enforce_distillable_text?: boolean;
	/** An ordered list of provider names/slugs to try in sequence, falling back to the next if unavailable. */
	order?: string[];
	/** List of provider names/slugs to exclusively allow for this request. */
	only?: string[];
	/** List of provider names/slugs to skip for this request. */
	ignore?: string[];
	/** A list of quantization levels to filter providers by (e.g., ["fp16", "bf16", "fp8", "fp6", "int8", "int4", "fp4", "fp32"]). */
	quantizations?: string[];
	/** Sorting strategy. Can be a string (e.g., "price", "throughput", "latency") or an object with `by` and `partition`. */
	sort?:
		| string
		| {
				/** The sorting metric: "price", "throughput", "latency". */
				by?: string;
				/** Partitioning strategy: "model" (default) or "none". */
				partition?: string | null;
		  };
	/** Maximum price per million tokens (USD). */
	max_price?: {
		/** Price per million prompt tokens. */
		prompt?: number | string;
		/** Price per million completion tokens. */
		completion?: number | string;
		/** Price per image. */
		image?: number | string;
		/** Price per audio unit. */
		audio?: number | string;
		/** Price per request. */
		request?: number | string;
	};
	/** Preferred minimum throughput (tokens/second). Can be a number (applies to p50) or an object with percentile-specific cutoffs. */
	preferred_min_throughput?:
		| number
		| {
				/** Minimum tokens/second at the 50th percentile. */
				p50?: number;
				/** Minimum tokens/second at the 75th percentile. */
				p75?: number;
				/** Minimum tokens/second at the 90th percentile. */
				p90?: number;
				/** Minimum tokens/second at the 99th percentile. */
				p99?: number;
		  };
	/** Preferred maximum latency (seconds). Can be a number (applies to p50) or an object with percentile-specific cutoffs. */
	preferred_max_latency?:
		| number
		| {
				/** Maximum latency in seconds at the 50th percentile. */
				p50?: number;
				/** Maximum latency in seconds at the 75th percentile. */
				p75?: number;
				/** Maximum latency in seconds at the 90th percentile. */
				p90?: number;
				/** Maximum latency in seconds at the 99th percentile. */
				p99?: number;
		  };
}

/**
 * Vercel AI Gateway routing preferences.
 * Controls which upstream providers the gateway routes requests to.
 * @see https://vercel.com/docs/ai-gateway/models-and-providers/provider-options
 */
/** Vercel AI Gateway 路由偏好（中文说明）：限制/排序上游供应商。 */
export interface VercelGatewayRouting {
	/** List of provider slugs to exclusively use for this request (e.g., ["bedrock", "anthropic"]). */
	only?: string[];
	/** List of provider slugs to try in order (e.g., ["anthropic", "openai"]). */
	order?: string[];
}

/** 模型成本费率（中文说明）：$/百万 token。 */
export interface ModelCostRates {
	input: number; // $/million tokens
	// 输入费率（$/百万 token）
	output: number; // $/million tokens
	// 输出费率
	cacheRead: number; // $/million tokens
	// 缓存读取费率
	cacheWrite: number; // $/million tokens
	// 缓存写入费率
}

/** 阶梯费率（中文说明）：输入用量超过 inputTokensAbove 时整请求采用此档。 */
export interface ModelCostTier extends ModelCostRates {
	/** Use this tier for requests whose total input usage exceeds this token count. */
	inputTokensAbove: number;
}

/** 模型成本（中文说明）：基础费率 + 可选阶梯。 */
export interface ModelCost extends ModelCostRates {
	/** Request-wide pricing tiers. The highest matching input threshold applies to the full request. */
	tiers?: ModelCostTier[];
}

// Model interface for the unified model system
/**
 * 模型接口（中文说明）：统一模型系统的核心——
 * id/name/api/provider/baseUrl/reasoning/输入输出能力/成本/窗口/上限/头/compat。
 */
export interface Model<TApi extends Api> {
	id: string;
	name: string;
	api: TApi;
	// 所属 API（决定流实现与选项类型）
	provider: ProviderId;
	baseUrl: string;
	// API 基础地址
	reasoning: boolean;
	// 是否支持推理
	/**
	 * Maps pi thinking levels to provider/model-specific values.
	 * Missing keys use provider defaults. null marks a level as unsupported.
	 */
	thinkingLevelMap?: ThinkingLevelMap;
	// 思考级别映射：缺省键用供应商默认；null 表示不支持
	input: ("text" | "image")[];
	// 支持的输入模态
	cost: ModelCost;
	// 成本费率
	contextWindow: number;
	// 上下文窗口（token）
	maxTokens: number;
	// 最大输出 token
	headers?: Record<string, string>;
	// 模型级请求头
	/** Compatibility overrides for OpenAI-compatible APIs. If not set, auto-detected from baseUrl. */
	compat?: TApi extends "openai-completions"
	// 兼容配置：按 api 条件收窄到对应 Compat 类型
		? OpenAICompletionsCompat
		: TApi extends "openai-responses" | "azure-openai-responses" | "openai-codex-responses"
			? OpenAIResponsesCompat
			: TApi extends "anthropic-messages"
				? AnthropicMessagesCompat
				: TApi extends "bedrock-converse-stream"
					? BedrockCompat
					: never;
}

/** 图片模型接口（中文说明）：在 Model 基础上替换 api/provider 类型并增加输出模态。 */
export interface ImagesModel<TApi extends ImagesApi>
	extends Omit<Model<Api>, "api" | "provider" | "reasoning" | "contextWindow" | "maxTokens" | "compat"> {
	api: TApi;
	provider: ImagesProviderId;
	output: ("text" | "image")[];
	// 支持的输出模态
}
