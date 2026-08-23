import type { InlineExtension } from "../core/extensions/types.ts";
import llamaExtension from "./llama/index.ts";

/**
 * 【文件职责】扩展入口：加载/注册扩展并接入会话（与 core/extensions 配合）。
 * 【产品维度】第三方扩展的接入面。
 * 【新手阅读建议】看扩展加载与注册流程。
 */
export const builtInExtensions: InlineExtension[] = [{ name: "llama.cpp", factory: llamaExtension, hidden: true }];
