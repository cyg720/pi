/**
 * Workaround for https://github.com/oven-sh/bun/issues/27802
 *
 * Bun compiled binaries have an empty `process.env` when running inside
 * sandbox environments (e.g. nono on Linux/macOS). On Linux we can recover
 * the environment from `/proc/self/environ`.
 *
 * Keep this in sync with getBunSandboxEnvValue() in
 * packages/ai/src/utils/provider-env.ts. The ai package duplicates the lookup
 * for direct consumers that do not go through this coding-agent entrypoint.
 */

import { readFileSync } from "node:fs";

/**
 * Restore environment variables from `/proc/self/environ` when running
 * inside a sandbox where Bun's `process.env` is empty.
 */
/**
 * 【文件职责】恢复沙箱环境：修复 Bun 二进制在 Linux 沙箱中 process.env 为空的问题
 *              （读取 /proc/self/environ）。
 * 【新手阅读建议】看读取与恢复。
 */
export function restoreSandboxEnv(): void {
	if (!process.versions?.bun) return;

	// If process.env already has entries, nothing to fix.
	if (Object.keys(process.env).length > 0) return;

	try {
		const data = readFileSync("/proc/self/environ", "utf-8");
		for (const entry of data.split("\0")) {
			const idx = entry.indexOf("=");
			if (idx > 0) {
				process.env[entry.slice(0, idx)] = entry.slice(idx + 1);
			}
		}
	} catch {
		// /proc/self/environ may not be readable; ignore.
	}
}
