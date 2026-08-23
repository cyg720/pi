/**
 * 【文件职责】工具路径解析辅助：把模型给出的工具路径参数规范化并转为绝对路径；
 *              读文件场景额外提供多“变体”探测，兼容模型转录中常见的字符偏差。
 * 【技术维度】Unicode 空格归一化（各类特殊空格 → 普通空格）；@ 前缀剥离（文件引用语法）；
 *              NFD 规范化与弯引号替换的候选枚举。
 * 【产品维度】提升工具调用成功率：模型输出的路径常带不可见空格或引用前缀，
 *              这里统一清洗，避免“文件明明存在却读不到”的体验问题。
 * 【逻辑维度】normalizeToolPath 清洗 → resolveToolPath 经环境转绝对路径 →
 *              resolveReadToolPath 生成 5 个变体逐个探测存在性，全部未命中回退原始解析结果。
 * 【关键边界】变体探测仅用于读取场景；getOrThrow 在环境层失败时会抛出异常（此处为受控边界）；
 *              AM/PM 时间样式文件名使用窄不换行空格（macOS 截图命名习惯）。
 * 【新手阅读建议】半分钟读完：重点记住两个导出函数的分工——通用解析 vs 带容错的读取解析。
 */
import type { ExecutionEnv } from "../types.ts";
import { getOrThrow } from "../types.ts";

// 需要归一化为普通空格的 Unicode 特殊空格集合
const UNICODE_SPACES = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;
const NARROW_NO_BREAK_SPACE = "\u202F";

// 工具路径规范化（私有）：替换特殊空格；剥掉开头的 @ 引用前缀
function normalizeToolPath(path: string): string {
	const normalized = path.replace(UNICODE_SPACES, " ");
	return normalized.startsWith("@") ? normalized.slice(1) : normalized;
}

/**
 * 解析工具路径为绝对路径（中文说明）：先规范化再经执行环境的 absolutePath 转换；
 * 失败时抛出底层 FileError。参数 env —— 执行环境；path —— 模型给的路径；signal —— 中止信号。
 */
export async function resolveToolPath(env: ExecutionEnv, path: string, signal?: AbortSignal): Promise<string> {
	return getOrThrow(await env.absolutePath(normalizeToolPath(path), signal));
}

/**
 * 解析“读取”用路径并做存在性容错（中文说明）：
 * 依次尝试原解析结果、AM/PM 窄空格变体、NFD 规范化、弯引号替换及其组合，
 * 返回第一个确实存在的变体；都不存在时返回原始解析路径（让后续读取报错更直观）。
 */
export async function resolveReadToolPath(env: ExecutionEnv, path: string, signal?: AbortSignal): Promise<string> {
	const resolved = await resolveToolPath(env, path, signal);
	const variants = [
		resolved,
		resolved.replace(/ (AM|PM)\./gi, `${NARROW_NO_BREAK_SPACE}$1.`),
		resolved.normalize("NFD"),
		resolved.replace(/'/g, "\u2019"),
		resolved.normalize("NFD").replace(/'/g, "\u2019"),
	];

	for (const variant of new Set(variants)) {
		if (getOrThrow(await env.exists(variant, signal))) return variant;
	}
	return resolved;
}
