#!/usr/bin/env node
<<<<<<< HEAD
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
=======
import { setupCli } from "./cli/setup.ts";
>>>>>>> main
import { main } from "./main.ts";

setupCli();
main(process.argv.slice(2));
