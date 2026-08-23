/**
 * 【文件职责】供应商环境变量解析：按"作用域覆盖 → 进程环境 → Bun 沙箱兜底"三级查找
 *              供应商配置所需的环境变量值。
 * 【技术维度】模块级缓存；Bun 特定兜底（读取 /proc/self/environ 修复空 process.env 缺陷）。
 * 【产品维度】保证在 Bun 独立二进制沙箱等特殊环境下仍能正确读取密钥/端点等配置。
 * 【逻辑维度】getProviderEnvValue 三级回退 → getBunSandboxEnvValue 仅在 Bun 且 env 为空时触发。
 * 【关键边界】Bun 兜底仅在 process.env 为空时启用且只读一次缓存；/proc 不可读时静默降级。
 * 【新手阅读建议】半分钟读完：记住"三级回退"查找顺序即可。
 */
import type { ProviderEnv } from "../types.ts";

// /proc/self/environ 解析结果缓存（Bun 沙箱场景）
let procEnvCache: Map<string, string> | null = null;

/**
 * Fallback for https://github.com/oven-sh/bun/issues/27802.
 * Bun compiled binaries can expose an empty process.env inside Linux sandboxes
 * even though /proc/self/environ contains the environment.
 *
 * This intentionally duplicates restoreSandboxEnv() in
 * packages/coding-agent/src/bun/restore-sandbox-env.ts. The ai package can be
 * used directly, without going through that entrypoint, so provider env lookup
 * must not depend on process.env having been patched.
 */
// Bun 沙箱环境变量读取（私有）：修复 bun 编译二进制在 Linux 沙箱内 process.env 为空的问题；
// 与 coding-agent 的 restoreSandboxEnv 互为副本——本包可被直接使用，不能依赖入口补丁
function getBunSandboxEnvValue(name: string): string | undefined {
	if (typeof process === "undefined" || !process.versions?.bun || Object.keys(process.env).length > 0) {
		return undefined;
	}

	if (procEnvCache === null) {
		procEnvCache = new Map();
		try {
			const { readFileSync } = require("node:fs") as {
				readFileSync(path: string, encoding: BufferEncoding): string;
			};
			const data = readFileSync("/proc/self/environ", "utf-8");
			for (const entry of data.split("\0")) {
				const idx = entry.indexOf("=");
				if (idx > 0) {
					procEnvCache.set(entry.slice(0, idx), entry.slice(idx + 1));
				}
			}
		} catch {
			// /proc/self/environ may not exist or may not be readable.
			// /proc/self/environ 可能不存在或不可读
		}
	}

	return procEnvCache.get(name);
}

/**
 * Resolve a provider env value from scoped overrides, normal process.env, then
 * the duplicated Bun sandbox fallback for direct pi-ai consumers.
 */
// 解析供应商环境变量（公开）：作用域覆盖 → process.env → Bun 沙箱兜底
export function getProviderEnvValue(name: string, env?: ProviderEnv): string | undefined {
	return (
		env?.[name] ||
		(typeof process !== "undefined" ? process.env[name] : undefined) ||
		getBunSandboxEnvValue(name) ||
		undefined
	);
}
