/**
 * 【文件职责】提供全局默认流式函数（StreamFn）的注册与获取：宿主应用安装一次默认实现，
 *              Agent 与低层循环在未显式指定 streamFn 时自动兜底使用（index.ts 从本文件导出 setDefaultStreamFn）。
 * 【技术维度】模块级单例变量 + setter/getter，零外部依赖；与 proxy.ts 内容相同，属同一机制的两个入口文件。
 * 【产品维度】让核心包不依赖具体供应商目录即可拥有默认模型调用能力，宿主按运行环境自行装配。
 * 【逻辑维度】setDefaultStreamFn 安装/清除 → getDefaultStreamFn 未配置时抛出带指引的错误。
 * 【关键边界】进程级全局状态；未配置直接取用会抛错；多配置并存场景应显式传参。
 * 【新手阅读建议】半分钟读完：记住 setDefaultStreamFn / getDefaultStreamFn 这一对函数的作用即可。
 */
import type { StreamFn } from "./types.ts";

// 进程级全局的默认流式函数；undefined 表示尚未配置
let defaultStreamFn: StreamFn | undefined;

/**
 * Configure the fallback used by Agent and low-level loops when callers omit streamFn.
 *
 * Hosts that provide a default model runtime can install its stream function here
 * without making pi-agent-core depend on a provider catalog or compatibility layer.
 */
// 设置缺省流式函数：调用方省略 streamFn 时的兜底实现。
// 参数 streamFn —— 要安装的实现；传 undefined 表示清除。
// 使用示例：setDefaultStreamFn(Models.streamSimple.bind(Models))
export function setDefaultStreamFn(streamFn: StreamFn | undefined): void {
	// 写入模块级单例
	defaultStreamFn = streamFn;
}

// 获取当前默认流式函数；未配置时抛出带修复指引的错误
export function getDefaultStreamFn(): StreamFn {
	// 防御：未配置时给出可操作的错误提示
	if (!defaultStreamFn) {
		throw new Error("No default stream function configured. Pass streamFn explicitly or call setDefaultStreamFn().");
	}
	return defaultStreamFn;
}
