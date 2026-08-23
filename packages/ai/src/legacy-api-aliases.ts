/**
 * 【文件职责】旧式全局流式 API 的兼容别名层：把早期"streamXxx / streamSimpleXxx"全局函数
 *              映射到各 API 模块的懒加载实现，全部标记 @deprecated 引导迁移。
 * 【技术维度】模块加载时即调用各 lazy Api 工厂取得实现，再以类型断言导出为 StreamFunction 别名。
 * 【产品维度】保证旧代码无需改动即可继续工作，同时为新式 `api/xxx` 子路径 API 提供明确迁移提示。
 * 【逻辑维度】顶部批量实例化各 API 实现 → 逐供应商导出 stream 与 streamSimple 两个别名。
 * 【关键边界】仅作兼容存在：新代码请使用 `@earendil-works/pi-ai/api/xxx` 或 `xxxApi().stream`；
 *              每个别名上方的 @deprecated 注释即其替代指引。
 * 【新手阅读建议】不必逐行阅读：理解“每个别名 = 旧名字 → 新实现”的一对一映射模式即可，
 *              需要某个供应商能力时按替代指引迁移到对应新模块。
 */
import { anthropicMessagesApi } from "./api/anthropic-messages.lazy.ts";
import type { AnthropicOptions } from "./api/anthropic-messages.ts";
import { azureOpenAIResponsesApi } from "./api/azure-openai-responses.lazy.ts";
import type { AzureOpenAIResponsesOptions } from "./api/azure-openai-responses.ts";
import { googleGenerativeAIApi } from "./api/google-generative-ai.lazy.ts";
import type { GoogleOptions } from "./api/google-generative-ai.ts";
import { googleVertexApi } from "./api/google-vertex.lazy.ts";
import type { GoogleVertexOptions } from "./api/google-vertex.ts";
import { mistralConversationsApi } from "./api/mistral-conversations.lazy.ts";
import type { MistralOptions } from "./api/mistral-conversations.ts";
import { openAICodexResponsesApi } from "./api/openai-codex-responses.lazy.ts";
import type { OpenAICodexResponsesOptions } from "./api/openai-codex-responses.ts";
import { openAICompletionsApi } from "./api/openai-completions.lazy.ts";
import type { OpenAICompletionsOptions } from "./api/openai-completions.ts";
import { openAIResponsesApi } from "./api/openai-responses.lazy.ts";
import type { OpenAIResponsesOptions } from "./api/openai-responses.ts";
import type { SimpleStreamOptions, StreamFunction } from "./types.ts";

// 以下均为旧式全局别名的底层实现（模块加载时实例化一次）
const anthropicMessagesStreams = anthropicMessagesApi();
const azureOpenAIResponsesStreams = azureOpenAIResponsesApi();
const googleGenerativeAIStreams = googleGenerativeAIApi();
const googleVertexStreams = googleVertexApi();
const mistralConversationsStreams = mistralConversationsApi();
const openAICodexResponsesStreams = openAICodexResponsesApi();
const openAICompletionsStreams = openAICompletionsApi();
const openAIResponsesStreams = openAIResponsesApi();

// ===== Anthropic 旧式别名（已废弃，使用 api/anthropic-messages 子路径） =====
/** @deprecated Use `stream` from `@earendil-works/pi-ai/api/anthropic-messages` or `anthropicMessagesApi().stream`. */
export const streamAnthropic = anthropicMessagesStreams.stream as StreamFunction<
	"anthropic-messages",
	AnthropicOptions
>;
/** @deprecated Use `streamSimple` from `@earendil-works/pi-ai/api/anthropic-messages` or `anthropicMessagesApi().streamSimple`. */
export const streamSimpleAnthropic = anthropicMessagesStreams.streamSimple as StreamFunction<
	"anthropic-messages",
	SimpleStreamOptions
>;

// ===== Azure OpenAI Responses 旧式别名 =====
/** @deprecated Use `stream` from `@earendil-works/pi-ai/api/azure-openai-responses` or `azureOpenAIResponsesApi().stream`. */
export const streamAzureOpenAIResponses = azureOpenAIResponsesStreams.stream as StreamFunction<
	"azure-openai-responses",
	AzureOpenAIResponsesOptions
>;
/** @deprecated Use `streamSimple` from `@earendil-works/pi-ai/api/azure-openai-responses` or `azureOpenAIResponsesApi().streamSimple`. */
export const streamSimpleAzureOpenAIResponses = azureOpenAIResponsesStreams.streamSimple as StreamFunction<
	"azure-openai-responses",
	SimpleStreamOptions
>;

// ===== Google Gemini 旧式别名 =====
/** @deprecated Use `stream` from `@earendil-works/pi-ai/api/google-generative-ai` or `googleGenerativeAIApi().stream`. */
export const streamGoogle = googleGenerativeAIStreams.stream as StreamFunction<"google-generative-ai", GoogleOptions>;
/** @deprecated Use `streamSimple` from `@earendil-works/pi-ai/api/google-generative-ai` or `googleGenerativeAIApi().streamSimple`. */
export const streamSimpleGoogle = googleGenerativeAIStreams.streamSimple as StreamFunction<
	"google-generative-ai",
	SimpleStreamOptions
>;

// ===== Google Vertex 旧式别名 =====
/** @deprecated Use `stream` from `@earendil-works/pi-ai/api/google-vertex` or `googleVertexApi().stream`. */
export const streamGoogleVertex = googleVertexStreams.stream as StreamFunction<"google-vertex", GoogleVertexOptions>;
/** @deprecated Use `streamSimple` from `@earendil-works/pi-ai/api/google-vertex` or `googleVertexApi().streamSimple`. */
export const streamSimpleGoogleVertex = googleVertexStreams.streamSimple as StreamFunction<
	"google-vertex",
	SimpleStreamOptions
>;

// ===== Mistral Conversations 旧式别名 =====
/** @deprecated Use `stream` from `@earendil-works/pi-ai/api/mistral-conversations` or `mistralConversationsApi().stream`. */
export const streamMistral = mistralConversationsStreams.stream as StreamFunction<
	"mistral-conversations",
	MistralOptions
>;
/** @deprecated Use `streamSimple` from `@earendil-works/pi-ai/api/mistral-conversations` or `mistralConversationsApi().streamSimple`. */
export const streamSimpleMistral = mistralConversationsStreams.streamSimple as StreamFunction<
	"mistral-conversations",
	SimpleStreamOptions
>;

// ===== OpenAI Codex Responses 旧式别名 =====
/** @deprecated Use `stream` from `@earendil-works/pi-ai/api/openai-codex-responses` or `openAICodexResponsesApi().stream`. */
export const streamOpenAICodexResponses = openAICodexResponsesStreams.stream as StreamFunction<
	"openai-codex-responses",
	OpenAICodexResponsesOptions
>;
/** @deprecated Use `streamSimple` from `@earendil-works/pi-ai/api/openai-codex-responses` or `openAICodexResponsesApi().streamSimple`. */
export const streamSimpleOpenAICodexResponses = openAICodexResponsesStreams.streamSimple as StreamFunction<
	"openai-codex-responses",
	SimpleStreamOptions
>;

// ===== OpenAI Completions 旧式别名 =====
/** @deprecated Use `stream` from `@earendil-works/pi-ai/api/openai-completions` or `openAICompletionsApi().stream`. */
export const streamOpenAICompletions = openAICompletionsStreams.stream as StreamFunction<
	"openai-completions",
	OpenAICompletionsOptions
>;
/** @deprecated Use `streamSimple` from `@earendil-works/pi-ai/api/openai-completions` or `openAICompletionsApi().streamSimple`. */
export const streamSimpleOpenAICompletions = openAICompletionsStreams.streamSimple as StreamFunction<
	"openai-completions",
	SimpleStreamOptions
>;

// ===== OpenAI Responses 旧式别名 =====
/** @deprecated Use `stream` from `@earendil-works/pi-ai/api/openai-responses` or `openAIResponsesApi().stream`. */
export const streamOpenAIResponses = openAIResponsesStreams.stream as StreamFunction<
	"openai-responses",
	OpenAIResponsesOptions
>;
/** @deprecated Use `streamSimple` from `@earendil-works/pi-ai/api/openai-responses` or `openAIResponsesApi().streamSimple`. */
export const streamSimpleOpenAIResponses = openAIResponsesStreams.streamSimple as StreamFunction<
	"openai-responses",
	SimpleStreamOptions
>;
