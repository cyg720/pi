/**
 * 【文件职责】Anthropic Messages API 的懒加载入口：首次流调用时才动态加载实现模块。
 * 【技术维度】lazyApi 包装动态 import（宿主 import 缓存去重）。
 * 【产品维度】延迟加载 Node 依赖、加速启动；失败以流错误呈现。
 * 【逻辑维度】anthropicMessagesApi() 返回懒包装的 ProviderStreams。
 * 【新手阅读建议】半分钟读完即可；实现见 anthropic-messages.ts。
 */
import type { ProviderStreams } from "../types.ts";
import { lazyApi } from "./lazy.ts";

// 返回懒加载的 Anthropic Messages 流实现（公开）
export const anthropicMessagesApi = (): ProviderStreams => lazyApi(() => import("./anthropic-messages.ts"));
