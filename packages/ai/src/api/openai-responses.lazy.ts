/**
 * 【文件职责】OpenAI Responses API 的懒加载入口。
 * 【技术维度】lazyApi 包装动态 import。
 * 【新手阅读建议】半分钟读完；实现见 openai-responses.ts（共享逻辑在 openai-responses-shared.ts）。
 */
/**
 * 【文件职责】OpenAI Responses API 的懒加载入口。
 * 【技术维度】lazyApi 包装动态 import。
 * 【新手阅读建议】半分钟读完；实现见 openai-responses.ts（共享逻辑在 openai-responses-shared.ts）。
 */
import type { ProviderStreams } from "../types.ts";
import { lazyApi } from "./lazy.ts";

// 返回懒加载的 OpenAI Responses 流实现（公开）
export const openAIResponsesApi = (): ProviderStreams => lazyApi(() => import("./openai-responses.ts"));
