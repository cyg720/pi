/**
 * 【文件职责】Node.js 环境专用入口：导出基于 Node 的执行环境实现（NodeExecutionEnv），并转发本包全部公共 API。
 * 【技术维度】纯再导出（barrel）文件：先把平台相关的执行环境挂到 node 子路径入口，再透传 index.ts 的所有导出。
 * 【产品维度】让 Node 宿主通过 `…/agent/node` 一个 import 同时获得“全套能力 + 本地命令执行环境”，无需了解内部目录结构。
 * 【逻辑维度】第一行导出平台相关实现，第二行透传通用能力，顺序无副作用。
 * 【关键边界】仅适用于 Node 运行时；浏览器等非 Node 环境请勿引用此入口（nodejs.ts 会依赖 Node 内置模块）。
 * 【新手阅读建议】记住它是“Node 专用总入口”即可，真正的实现在 harness/env/nodejs.ts。
 */
export { NodeExecutionEnv } from "./harness/env/nodejs.ts";
export * from "./index.ts";
