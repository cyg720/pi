#!/usr/bin/env node
/**
 * 【文件职责】Bun 独立二进制入口：注册静态 OAuth 流程 → 恢复沙箱环境变量 →
 *              注册 Bedrock 实现 → 转入标准 CLI。此入口解决动态导入在单文件二进制
 *              中无法打包的问题。
 * 【技术维度】模块级副作用顺序执行；顶层 await 动态导入。
 * 【产品维度】让单文件 Bun 构建具备完整能力（OAuth/Bedrock/环境）。
 * 【逻辑维度】进程标题/告警禁用 → 注册 OAuth → 恢复环境 → 注册 Bedrock → 进 CLI。
 * 【新手阅读建议】按执行顺序读即可。
 */
import { registerBunOAuthFlows } from "@earendil-works/pi-ai/bun-oauth";
import { APP_NAME } from "../config.ts";

process.title = APP_NAME;
process.emitWarning = (() => {}) as typeof process.emitWarning;

registerBunOAuthFlows();

import { restoreSandboxEnv } from "./restore-sandbox-env.ts";

restoreSandboxEnv();

await import("./register-bedrock.ts");
await import("../cli.ts");
