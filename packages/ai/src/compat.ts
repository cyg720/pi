/**
 * Temporary compatibility entrypoint preserving the old global pi-ai API
 * surface: api-dispatch `stream()`/`complete()` with env API key injection,
 * the api-registry, generated catalog reads (`getModel`/`getModels`/
 * `getProviders`), per-API lazy stream wrappers, and image generation.
 *
 * Existing apps switch imports from "@earendil-works/pi-ai" to
 * "@earendil-works/pi-ai/compat" unchanged; new code uses `createModels()`
 * and the provider factories. This module is deleted with the coding-agent
 * ModelManager migration.
 */

/**
 * 【文件职责】临时兼容入口：保留旧的全局 pi-ai API 表面——按 api 分派的 stream()/complete()、
 *              环境变量密钥注入、api 注册表、生成目录读取（getModel/getModels/getProviders）、
 *              各 API 懒流包装与图片生成。
 * 【技术维度】模块级副作用注册（加载即注册内置 API）；懒加载包装；环境密钥注入；
 *              内置供应商优先分派 + 注册表兜底的双路径。
 * 【产品维度】让既有应用把 import 改为 "@earendil-works/pi-ai/compat" 即可无缝迁移；
 *              新代码应使用 createModels() 与供应商工厂。本模块将在 coding-agent
 *              ModelManager 迁移完成后删除。
 * 【逻辑维度】重导出各懒 API → api 注册表（register/get/unregister）→ faux 注册 →
 *              内置 API 注册 → 兼容分派（内置供应商优先、Cloudflare 认证特判、环境密钥注入）。
 * 【关键边界】注册表重复注册内置 API 不覆盖已有条目；faux 注册带随机 sourceId 便于整组注销；
 *              getModel/getModels/getProviders 均为 @deprecated 别名。
 * 【新手阅读建议】先读文件头注释了解临时性 → 再读 registerApiProvider 与内置注册 →
 *              最后看 stream/streamSimple 的分派与密钥注入逻辑。
 */
export * from "./api/anthropic-messages.lazy.ts";
export * from "./api/azure-openai-responses.lazy.ts";
export * from "./api/bedrock-converse-stream.lazy.ts";
export * from "./api/google-generative-ai.lazy.ts";
export * from "./api/google-vertex.lazy.ts";
export * from "./api/mistral-conversations.lazy.ts";
export * from "./api/openai-codex-responses.lazy.ts";
export * from "./api/openai-completions.lazy.ts";
export * from "./api/openai-responses.lazy.ts";
export * from "./api/pi-messages.lazy.ts";
export * from "./env-api-keys.ts";
// 环境密钥工具
export * from "./image-models.ts";
// 图片模型查询
export * from "./images.ts";
// 图片生成入口
export * from "./images-api-registry.ts";
// 图片 API 注册表
export * from "./index.ts";
// 核心导出（见 index.ts）
export * from "./legacy-api-aliases.ts";
// 旧式全局别名
export * from "./providers/images/register-builtins.ts";

import { anthropicMessagesApi } from "./api/anthropic-messages.lazy.ts";
import { azureOpenAIResponsesApi } from "./api/azure-openai-responses.lazy.ts";
import { bedrockConverseStreamApi } from "./api/bedrock-converse-stream.lazy.ts";
import { googleGenerativeAIApi } from "./api/google-generative-ai.lazy.ts";
import { googleVertexApi } from "./api/google-vertex.lazy.ts";
import { mistralConversationsApi } from "./api/mistral-conversations.lazy.ts";
import { openAICodexResponsesApi } from "./api/openai-codex-responses.lazy.ts";
import { openAICompletionsApi } from "./api/openai-completions.lazy.ts";
import { openAIResponsesApi } from "./api/openai-responses.lazy.ts";
import { piMessagesApi } from "./api/pi-messages.lazy.ts";
import { getEnvApiKey } from "./env-api-keys.ts";
import type { ModelsApiStreamOptions } from "./models.ts";
import { builtinModels, getBuiltinModel, getBuiltinModels, getBuiltinProviders } from "./providers/all.ts";

export type { BuiltinProvider } from "./providers/all.ts";

import { createFauxCore, type FauxProviderRegistration, type RegisterFauxProviderOptions } from "./providers/faux.ts";
import type {
	Api,
	ApiStreamOptions,
	AssistantMessage,
	AssistantMessageEventStream,
	Context,
	Model,
	ProviderStreamOptions,
	ProviderStreams,
	SimpleStreamOptions,
	StreamFunction,
	StreamOptions,
} from "./types.ts";

// 已废弃：静态目录读取（建议改用 getBuiltinModel 或 Models.getModel）
/** @deprecated Static catalog read. Use `getBuiltinModel` from "@earendil-works/pi-ai/providers/all" or `Models.getModel()`. */
export const getModel = getBuiltinModel;

/** @deprecated Static catalog read. Use `getBuiltinModels` from "@earendil-works/pi-ai/providers/all" or `Models.getModels()`. */
export const getModels = getBuiltinModels;

/** @deprecated Static catalog read. Use `getBuiltinProviders` from "@earendil-works/pi-ai/providers/all" or `Models.getProviders()`. */
export const getProviders = getBuiltinProviders;

// API 流函数宽类型（模型/上下文/通用选项 → 事件流）
export type ApiStreamFunction = (
	model: Model<Api>,
	context: Context,
	options?: StreamOptions,
) => AssistantMessageEventStream;

// API 简化流函数宽类型
export type ApiStreamSimpleFunction = (
	model: Model<Api>,
	context: Context,
	options?: SimpleStreamOptions,
) => AssistantMessageEventStream;

/** API 提供器（中文说明）：api 标识 + 泛型绑定的 stream/streamSimple。 */
export interface ApiProvider<TApi extends Api = Api, TOptions extends StreamOptions = StreamOptions> {
	api: TApi;
	// API 标识
	stream: StreamFunction<TApi, TOptions>;
	// 流实现
	streamSimple: StreamFunction<TApi, SimpleStreamOptions>;
	// 简化流实现
}

// 内部存储形态（窄类型，分派用）
interface ApiProviderInternal {
	api: Api;
	stream: ApiStreamFunction;
	streamSimple: ApiStreamSimpleFunction;
}

// 注册条目：实现 + 可选来源标识
type RegisteredApiProvider = {
	provider: ApiProviderInternal;
	// 实现
	sourceId?: string;
	// 来源标识（faux 注册时用于整组注销）
};

// API 注册表：api → 条目
const apiProviderRegistry = new Map<string, RegisteredApiProvider>();

// 包装流实现（私有）：分发前校验 model.api 与注册 api 一致
function wrapStream<TApi extends Api, TOptions extends StreamOptions>(
	api: TApi,
	stream: StreamFunction<TApi, TOptions>,
): ApiStreamFunction {
	return (model, context, options) => {
		if (model.api !== api) {
			throw new Error(`Mismatched api: ${model.api} expected ${api}`);
		}
		return stream(model as Model<TApi>, context, options as TOptions);
	};
}

// 包装简化流实现（私有）
function wrapStreamSimple<TApi extends Api>(
	api: TApi,
	streamSimple: StreamFunction<TApi, SimpleStreamOptions>,
): ApiStreamSimpleFunction {
	return (model, context, options) => {
		if (model.api !== api) {
			throw new Error(`Mismatched api: ${model.api} expected ${api}`);
		}
		return streamSimple(model as Model<TApi>, context, options);
	};
}

// 注册 API 提供器（公开）：sourceId 便于批量注销
export function registerApiProvider<TApi extends Api, TOptions extends StreamOptions>(
	provider: ApiProvider<TApi, TOptions>,
	sourceId?: string,
): void {
	apiProviderRegistry.set(provider.api, {
		provider: {
			api: provider.api,
			stream: wrapStream(provider.api, provider.stream),
			streamSimple: wrapStreamSimple(provider.api, provider.streamSimple),
		},
		sourceId,
	});
}

// 按 api 查询实现（公开）
export function getApiProvider(api: Api): ApiProviderInternal | undefined {
	return apiProviderRegistry.get(api)?.provider;
}

// 列出全部已注册实现（公开）
export function getApiProviders(): ApiProviderInternal[] {
	return Array.from(apiProviderRegistry.values(), (entry) => entry.provider);
}

// 按来源标识批量注销（公开）：faux 卸载时用
export function unregisterApiProviders(sourceId: string): void {
	for (const [api, entry] of apiProviderRegistry.entries()) {
		if (entry.sourceId === sourceId) {
			apiProviderRegistry.delete(api);
		}
	}
}

// 清空注册表（私有）
function clearApiProviders(): void {
	apiProviderRegistry.clear();
}

// 注册假供应商（公开，测试/离线用）：创建 faux 核心并以随机 sourceId 注册；
// 返回带 unregister 的句柄
export function registerFauxProvider(options: RegisterFauxProviderOptions = {}): FauxProviderRegistration {
	const core = createFauxCore(options);
	const sourceId = `faux-provider-${Math.random().toString(36).slice(2, 10)}`;
	registerApiProvider({ api: core.api, stream: core.stream, streamSimple: core.streamSimple }, sourceId);
	return {
		api: core.api,
		models: core.models,
		getModel: core.getModel,
		state: core.state,
		setResponses: core.setResponses,
		appendResponses: core.appendResponses,
		getPendingResponseCount: core.getPendingResponseCount,
		unregister() {
			unregisterApiProviders(sourceId);
		},
	};
}

// 内置 API 清单：api 标识 + 懒实现
const BUILTIN_APIS: [Api, ProviderStreams][] = [
	["anthropic-messages", anthropicMessagesApi()],
	["openai-completions", openAICompletionsApi()],
	["openai-responses", openAIResponsesApi()],
	["openai-codex-responses", openAICodexResponsesApi()],
	["azure-openai-responses", azureOpenAIResponsesApi()],
	["google-generative-ai", googleGenerativeAIApi()],
	["google-vertex", googleVertexApi()],
	["mistral-conversations", mistralConversationsApi()],
	["bedrock-converse-stream", bedrockConverseStreamApi()],
	["pi-messages", piMessagesApi()],
];

// 内置 API 的注册实例快照：用于检测"是否被外部覆盖"
const builtinApiProviderInstances = new Map<Api, ReturnType<typeof getApiProvider>>();

/**
 * Registers the builtin API implementations into the api-registry without
 * clobbering existing entries: compat may load after a test or extension has
 * already registered an override for a builtin api id.
 */
// 注册内置 API 实现（公开）：不覆盖已存在条目（测试/扩展可能已注册覆盖实现）
export function registerBuiltInApiProviders(): void {
	for (const [api, streams] of BUILTIN_APIS) {
		if (!getApiProvider(api)) {
			registerApiProvider({ api, stream: streams.stream, streamSimple: streams.streamSimple });
		}
		builtinApiProviderInstances.set(api, getApiProvider(api));
	}
}

// 重置注册表（公开）：清空后重新注册内置实现（测试用）
export function resetApiProviders(): void {
	clearApiProviders();
	builtinApiProviderInstances.clear();
	registerBuiltInApiProviders();
}

registerBuiltInApiProviders();

// 内置模型集合（compat 专用实例）
const compatModels = builtinModels();
// 环境凭据就绪标记：表示无需 API 密钥（ADC/AWS 等环境认证）
const AMBIENT_AUTH_MARKER = "<authenticated>";

// 是否显式提供了非空密钥（私有）
function hasExplicitApiKey(apiKey: string | undefined): apiKey is string {
	return typeof apiKey === "string" && apiKey.trim().length > 0;
}

// 注入环境密钥（私有）：无显式密钥时从环境变量解析；环境凭据标记不注入
function withEnvApiKey<TOptions extends StreamOptions>(
	model: Model<Api>,
	options: TOptions | undefined,
): TOptions | undefined {
	if (hasExplicitApiKey(options?.apiKey)) return options;
	const apiKey = getEnvApiKey(model.provider, options?.env);
	if (!apiKey || apiKey === AMBIENT_AUTH_MARKER) return options;
	return { ...options, apiKey } as TOptions;
}

// Cloudflare 认证是否已就绪（私有）：有密钥或 cf-aig-authorization 头
function hasResolvedCloudflareAuth(options: StreamOptions | undefined): boolean {
	return hasExplicitApiKey(options?.apiKey) || typeof options?.headers?.["cf-aig-authorization"] === "string";
}

// 判断模型是否由内置供应商服务（私有）：api 未被外部覆盖且供应商在兼容模型集合中
function getBuiltinProviderForModel(model: Model<Api>) {
	if (getApiProvider(model.api) !== builtinApiProviderInstances.get(model.api)) return undefined;
	const provider = compatModels.getProvider(model.provider);
	return provider?.getModels().some((candidate) => candidate.api === model.api) ? provider : undefined;
}

// 解析注册表中的实现（私有）：未注册抛错
function resolveApiProvider(api: Api) {
	const provider = getApiProvider(api);
	if (!provider) {
		throw new Error(`No API provider registered for api: ${api}`);
	}
	return provider;
}

// 兼容流入口（公开）：内置供应商优先（Cloudflare 走认证特判）；
// 否则走注册表分派；均注入环境密钥
export function stream<TApi extends Api>(
	model: Model<TApi>,
	context: Context,
	options?: ProviderStreamOptions,
): AssistantMessageEventStream {
	const builtinProvider = getBuiltinProviderForModel(model);
	if (builtinProvider) {
		if (model.provider.startsWith("cloudflare-") && !hasResolvedCloudflareAuth(options)) {
			return compatModels.stream(model, context, options as ModelsApiStreamOptions<TApi> | undefined);
		}
		return builtinProvider.stream(model, context, withEnvApiKey(model, options) as ApiStreamOptions<TApi>);
	}
	const provider = resolveApiProvider(model.api);
	return provider.stream(model, context, withEnvApiKey(model, options) as StreamOptions);
}

// 兼容补全入口（公开）：取流结果
export async function complete<TApi extends Api>(
	model: Model<TApi>,
	context: Context,
	options?: ProviderStreamOptions,
): Promise<AssistantMessage> {
	const s = stream(model, context, options);
	return s.result();
}

// 兼容简化流入口（公开）：逻辑同 stream
export function streamSimple<TApi extends Api>(
	model: Model<TApi>,
	context: Context,
	options?: SimpleStreamOptions,
): AssistantMessageEventStream {
	const builtinProvider = getBuiltinProviderForModel(model);
	if (builtinProvider) {
		if (model.provider.startsWith("cloudflare-") && !hasResolvedCloudflareAuth(options)) {
			return compatModels.streamSimple(model, context, options);
		}
		return builtinProvider.streamSimple(model, context, withEnvApiKey(model, options));
	}
	const provider = resolveApiProvider(model.api);
	return provider.streamSimple(model, context, withEnvApiKey(model, options));
}

// 兼容简化补全入口（公开）
export async function completeSimple<TApi extends Api>(
	model: Model<TApi>,
	context: Context,
	options?: SimpleStreamOptions,
): Promise<AssistantMessage> {
	const s = streamSimple(model, context, options);
	return s.result();
}
