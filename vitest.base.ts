/**
 * 文件职责：集中定义全仓库 Vitest 使用的工作区源码路径和当前包名解析别名。
 * 技术维度：使用 ESM import.meta.url、URL 到文件路径转换、Vitest defineConfig 与正则匹配。
 * 产品维度：让跨包测试始终覆盖本次修改的源码，而不是误用已发布或已构建版本。
 * 逻辑维度：先计算各包关键入口的绝对路径，再把公开包名及动态提供方子路径映射到这些入口。
 * 关键边界：路径与仓库目录结构强绑定；新增公共子路径时需显式增加别名规则。
 * 新手阅读建议：先把 workspaceSourcePaths 视为路径字典，再逐条对应 alias 的 find 与 replacement。
 */
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** 各工作区包的源码入口绝对路径表；as const 保留键和值的只读精确类型。 */
export const workspaceSourcePaths = {
	/** pi-ai 主入口路径。 */
	aiIndex: fileURLToPath(new URL("./packages/ai/src/index.ts", import.meta.url)),
	/** pi-ai 兼容 API 入口路径。 */
	aiCompat: fileURLToPath(new URL("./packages/ai/src/compat.ts", import.meta.url)),
	/** pi-ai OAuth 入口路径。 */
	aiOAuth: fileURLToPath(new URL("./packages/ai/src/oauth.ts", import.meta.url)),
	/** pi-ai 提供方模块所在目录，动态别名会在其后追加文件名。 */
	aiProviders: fileURLToPath(new URL("./packages/ai/src/providers", import.meta.url)),
	/** pi-agent-core 主入口路径。 */
	agentIndex: fileURLToPath(new URL("./packages/agent/src/index.ts", import.meta.url)),
	/** pi-coding-agent 主入口路径。 */
	codingAgentIndex: fileURLToPath(new URL("./packages/coding-agent/src/index.ts", import.meta.url)),
	/** pi-tui 主入口路径。 */
	tuiIndex: fileURLToPath(new URL("./packages/tui/src/index.ts", import.meta.url)),
} as const;

/** 全仓库 Vitest 基础配置；各包可通过 mergeConfig 继续叠加自己的测试规则。 */
export default defineConfig({
	resolve: {
		/** 当前 @earendil-works 包名到工作区 TypeScript 源码的解析规则。 */
		alias: [
			{ find: /^@earendil-works\/pi-ai$/, replacement: workspaceSourcePaths.aiIndex },
			{ find: /^@earendil-works\/pi-ai\/compat$/, replacement: workspaceSourcePaths.aiCompat },
			{ find: /^@earendil-works\/pi-ai\/oauth$/, replacement: workspaceSourcePaths.aiOAuth },
			{
				/** 捕获 providers/ 后的提供方名称，要求至少一个字符。 */
				find: /^@earendil-works\/pi-ai\/providers\/(.+)$/,
				/** 用捕获名称拼出提供方源码文件；$1 由上方正则的第一组替换。 */
				replacement: `${workspaceSourcePaths.aiProviders}/$1.ts`,
			},
			{ find: /^@earendil-works\/pi-agent-core$/, replacement: workspaceSourcePaths.agentIndex },
			{ find: /^@earendil-works\/pi-tui$/, replacement: workspaceSourcePaths.tuiIndex },
		],
	},
});
