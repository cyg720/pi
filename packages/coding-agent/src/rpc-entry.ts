#!/usr/bin/env node
/**
 * 【文件职责】RPC 模式入口：以 RPC 服务模式启动 coding-agent（进程标题/环境标记/禁用告警，
 *              配置 HTTP 调度器后进入 main）。
 * 【技术维度】进程环境准备 + 入口转发。
 * 【产品维度】是服务器/IDE 集成使用的独立入口。
 * 【逻辑维度】设置进程标题 → 标记运行环境 → 配置 HTTP → 以 rpc 模式调 main。
 * 【新手阅读建议】半分钟读完即可。
 */
import { APP_NAME } from "./config.ts";
import { configureHttpDispatcher } from "./core/http-dispatcher.ts";
import { main } from "./main.ts";

process.title = `${APP_NAME}-rpc`;
process.env.PI_CODING_AGENT = "true";
process.env.AI_AGENT = "pi";
process.emitWarning = (() => {}) as typeof process.emitWarning;

configureHttpDispatcher();

main(["--mode", "rpc", ...process.argv.slice(2)]);
