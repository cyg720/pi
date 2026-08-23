/**
 * 【文件职责】Google Vertex AI API 的懒加载入口：首次流调用时才动态加载实现模块。
 * 【技术维度】lazyApi 包装动态 import（宿主 import 缓存去重）。
 * 【产品维度】延迟加载实现，失败以流错误呈现。
 * 【新手阅读建议】半分钟读完；实现见 google-vertex.ts。
 */
import type { ProviderStreams } from "../types.ts";
import { lazyApi } from "./lazy.ts";

// 返回懒加载的 Google Vertex 流实现（公开）
export const googleVertexApi = (): ProviderStreams => lazyApi(() => import("./google-vertex.ts"));
