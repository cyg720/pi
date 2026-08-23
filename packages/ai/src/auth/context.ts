/**
 * 【文件职责】默认认证上下文实现：从 process.env 读环境变量、经 node:fs 检查文件存在，
 *              （浏览器下二者分别返回 undefined/false），供认证解析使用。
 * 【技术维度】变量说明符动态导入 node 模块（浏览器打包安全）；globalThis 类型探测。
 * 【产品维度】让认证解析在 Node/Bun/浏览器环境中都有安全缺省实现。
 * 【逻辑维度】env 读 process.env（过滤空白值）→ fileExists 动态导入 fs/os（支持 ~ 展开）。
 * 【关键边界】node 模块导入失败静默返回 false；浏览器下 fs 不可用恒 false。
 * 【新手阅读建议】半分钟读完：理解 env/fileExists 两个方法的缺省行为即可。
 */
import type { AuthContext } from "./types.ts";

// node:fs/promises 的最小接口（私有）
interface NodeFsModule {
	access(path: string): Promise<void>;
}

// node:os 的最小接口（私有）
interface NodeOsModule {
	homedir(): string;
}

// 变量说明符：让浏览器打包器不尝试解析 node 内置模块
const importNodeModule = (specifier: string): Promise<unknown> => import(specifier);

// 读取 process.env（私有）：浏览器下为 undefined
function getProcessEnv(): Record<string, string | undefined> | undefined {
	const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
	return proc?.env;
}

/**
 * Default auth context: env vars from `process.env` (undefined in browsers),
 * file existence via node:fs (always false in browsers).
 */
// 默认认证上下文（公开）：env 从 process.env 读取（浏览器为 undefined）；
// fileExists 经 node:fs 检查（浏览器恒 false）
export function defaultProviderAuthContext(): AuthContext {
	return {
		async env(name: string): Promise<string | undefined> {
			const value = getProcessEnv()?.[name];
			return typeof value === "string" && value.trim().length > 0 ? value : undefined;
		},

		async fileExists(path: string): Promise<boolean> {
			try {
				const fs = (await importNodeModule("node:fs/promises")) as NodeFsModule;
				let resolved = path;
				if (resolved.startsWith("~")) {
					const os = (await importNodeModule("node:os")) as NodeOsModule;
					resolved = os.homedir() + resolved.slice(1);
				}
				await fs.access(resolved);
				return true;
			} catch {
				return false;
			}
		},
	};
}
