#!/usr/bin/env node
/**
 * CLI entry point for the refactored coding agent.
 * Uses main.ts with AgentSession and new mode modules.
 *
 * Test with: npx tsx src/cli-new.ts [args...]
 */
/**
 * 【文件职责】CLI 入口：解析参数并启动交互/一次性/服务模式，是 coding-agent 的可执行入口。
 * 【产品维度】用户启动 pi 的第一站。
 * 【逻辑维度】参数解析 → 模式分派（交互/一次性/HTTP/LLM）→ 启动会话运行时。
 * 【新手阅读建议】看 main 与参数定义。
 */
import { APP_NAME } from "./config.ts";
import { configureHttpDispatcher } from "./core/http-dispatcher.ts";
import { main } from "./main.ts";

process.title = APP_NAME;
process.env.PI_CODING_AGENT = "true";
process.env.AI_AGENT = "pi";
process.emitWarning = (() => {}) as typeof process.emitWarning;

// Configure undici's global dispatcher before provider SDKs issue requests.
// Runtime settings are applied once SettingsManager has loaded global/project settings.
configureHttpDispatcher();

main(process.argv.slice(2));
