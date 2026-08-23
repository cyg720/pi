/**
 * 【文件职责】pi-ai 包的总出口（barrel 文件）：集中转发核心类型、流式 API 选项、认证体系、
 *              模型目录与存储、会话资源与工具函数；不含生成目录/供应商工厂/API 注册表等重量级模块。
 * 【技术维度】纯 TypeScript ESM 再导出（export * 与具名导出组合），无实现逻辑。
 * 【产品维度】对外暴露稳定统一的 API 表面；二次开发者从这里取用全部核心能力。
 * 【逻辑维度】按“typebox → 各供应商 API 选项 → 认证 → 扩展 OAuth 类型 → 模型/存储 → 工具函数”分组导出。
 * 【关键边界】仅导出“核心、无副作用”的子集：供应商工厂在 providers/*、API 实现在 api/*、
 *              旧式全局 API 在 compat；新增公开模块必须在此登记。
 * 【新手阅读建议】第一站读本文件建立能力清单认知，再顺着导出跳转到感兴趣的源文件精读。
 */
export type { Static, TSchema } from "typebox";
export { Type } from "typebox";

// Core only, side-effect free: no generated catalogs, no provider factories,
// no api-registry, no OAuth implementations, no compat. Provider factories
// live under "@earendil-works/pi-ai/providers/*", API implementations under
// "@earendil-works/pi-ai/api/*", the old global API under
// "@earendil-works/pi-ai/compat".
// 仅导出核心且无副作用的能力：不含生成目录/供应商工厂/API 注册表/OAuth 实现/compat；
// 供应商工厂在 providers/*，API 实现在 api/*，旧式全局 API 在 compat。
export type { AnthropicEffort, AnthropicOptions, AnthropicThinkingDisplay } from "./api/anthropic-messages.ts";
export type { AzureOpenAIResponsesOptions } from "./api/azure-openai-responses.ts";
export type { BedrockOptions, BedrockThinkingDisplay } from "./api/bedrock-converse-stream.ts";
export type { GoogleOptions } from "./api/google-generative-ai.ts";
export type { GoogleThinkingLevel } from "./api/google-shared.ts";
export type { GoogleVertexOptions } from "./api/google-vertex.ts";
export * from "./api/lazy.ts";
export type { MistralOptions } from "./api/mistral-conversations.ts";
export type { OpenAICodexResponsesOptions, OpenAICodexWebSocketDebugStats } from "./api/openai-codex-responses.ts";
export type { OpenAICompletionsOptions } from "./api/openai-completions.ts";
export type { OpenAIResponsesOptions } from "./api/openai-responses.ts";
export type { PiMessagesEvent, PiMessagesOptions, PiMessagesRewriteImpact } from "./api/pi-messages.ts";
export * from "./auth/context.ts";
export * from "./auth/credential-store.ts";
export * from "./auth/helpers.ts";
export * from "./auth/types.ts";
export type {
	OAuthAuthInfo,
	OAuthDeviceCodeInfo,
	OAuthLoginCallbacks,
	OAuthPrompt,
	OAuthSelectOption,
	OAuthSelectPrompt,
} from "./compat/extension-oauth-types.ts";
export * from "./images-models.ts";
export * from "./models.ts";
export * from "./models-store.ts";
export * from "./providers/faux.ts";
export * from "./session-resources.ts";
export * from "./types.ts";
export * from "./utils/diagnostics.ts";
export * from "./utils/event-stream.ts";
export * from "./utils/json-parse.ts";
export * from "./utils/overflow.ts";
export * from "./utils/retry.ts";
export { contentText } from "./utils/text.ts";
export * from "./utils/typebox-helpers.ts";
export { uuidv7 } from "./utils/uuid.ts";
export * from "./utils/validation.ts";
