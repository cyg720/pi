/**
 * 【文件职责】定义内置执行工具（bash/read/write/edit）所需的上下文接口：目前只承载一个执行环境实例。
 * 【技术维度】单字段接口；依赖倒置——工具不直接依赖 Node/Bun 实现，而是面向 ExecutionEnv 抽象。
 * 【产品维度】让同一套内置工具既能跑在本机（NodeExecutionEnv），也能跑在容器/远程等自定义环境中，
 *              是二次开发替换运行环境时的关键接缝。
 * 【逻辑维度】仅一个类型声明，无逻辑流程。
 * 【关键边界】新增内置工具需要的能力（如网络访问）应扩展此接口而非绕过它；
 *              env 生命周期由 Harness 管理，工具内部不要缓存跨请求引用。
 * 【新手阅读建议】半分钟读完：记住“工具通过 context.env 访问文件系统与 shell”即可。
 */
import type { ExecutionEnv } from "../types.ts";

/** Filesystem and shell context required by the built-in execution tools. */
/** 执行工具上下文（中文说明）：内置文件/命令类工具运行所需的最小能力集合。 */
export interface ExecutionToolContext {
	// 执行环境：提供文件系统能力与命令执行能力
	env: ExecutionEnv;
}
