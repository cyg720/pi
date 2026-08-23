/**
 * 【文件职责】agent 包的总出口（barrel 文件）：集中转发各模块的公开 API，
 *              使用方通过单一入口即可获得 Agent、循环、Harness、会话存储、上下文压缩、内置工具等全部能力。
 * 【技术维度】纯 TypeScript ESM 再导出（export * 与具名导出组合），不含任何实现逻辑。
 * 【产品维度】对外暴露稳定统一的 API 表面；二次开发者通常从这里检索包的全部可用功能。
 * 【逻辑维度】按“核心 Agent → 循环 → 压缩 → 消息/提示词/技能/会话/工具 → Harness 类型 → 工具函数 → 代理 → 流默认值 → 类型”分组导出。
 * 【关键边界】本文件只做转发；新增公开模块必须在此登记导出，否则外部无法引用；注意避免导出名冲突。
 * 【新手阅读建议】第一站读本文件建立全局认知，再顺着导出项跳转到感兴趣的源文件深入阅读。
 */
// 核心代理（Core Agent）
export { uuidv7 } from "@earendil-works/pi-ai";
export * from "./agent.ts";
// 循环控制函数（Loop functions）
export * from "./agent-loop.ts";
export * from "./harness/agent-harness.ts";
export {
	type BranchPreparation,
	type BranchSummaryDetails,
	type CollectEntriesResult,
	collectEntriesForBranchSummary,
	generateBranchSummary,
	prepareBranchEntries,
} from "./harness/compaction/branch-summarization.ts";
export {
	calculateContextTokens,
	compact,
	DEFAULT_COMPACTION_SETTINGS,
	estimateContextTokens,
	estimateTokens,
	findCutPoint,
	findTurnStartIndex,
	generateSummary,
	generateSummaryWithUsage,
	getLastAssistantUsage,
	prepareCompaction,
	serializeConversation,
	shouldCompact,
} from "./harness/compaction/compaction.ts";
export * from "./harness/messages.ts";
export * from "./harness/prompt-templates.ts";
export * from "./harness/session/jsonl-repo.ts";
export * from "./harness/session/jsonl-storage.ts";
export * from "./harness/session/memory-repo.ts";
export * from "./harness/session/memory-storage.ts";
export * from "./harness/session/repo-utils.ts";
export * from "./harness/session/session.ts";
export * from "./harness/skills.ts";
export * from "./harness/system-prompt.ts";
export * from "./harness/tools/index.ts";
// Harness 高层封装（Harness）
export * from "./harness/types.ts";
export * from "./harness/utils/shell-output.ts";
export * from "./harness/utils/truncate.ts";
// 代理工具（Proxy utilities）
export * from "./proxy.ts";
// 流式默认值（Stream defaults）
export { setDefaultStreamFn } from "./stream-fn.ts";
// 公共类型（Types）
export * from "./types.ts";
