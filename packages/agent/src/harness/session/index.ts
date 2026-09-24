<<<<<<< HEAD
/**
 * 【文件职责】实现 `@earendil-works/pi-agent-core` 包中的 `harness/session/index` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `./context.ts`、`./jsonl.ts`、`./memory.ts`、`./session.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为通用智能体提供传输抽象、状态管理与附件能力；本文件负责其中与 `harness/session/index` 对应的子能力。
 * 【逻辑维度】本文件通过重导出汇总相邻模块的公开符号，使调用方可以从稳定入口访问各项能力。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看各条重导出语句，再进入对应子模块阅读具体类型与实现。
 */
export * from "./context.ts";
=======
>>>>>>> main
export type {
	CommittedEntryWrite,
	CommittedListAppendWrite,
	CommittedListDeleteWrite,
	CommittedUsageWrite,
	CommittedValueDeleteWrite,
	CommittedValueSetWrite,
	CommittedWrite,
	CommitValidationState,
	PreparedCommit,
} from "./commit.ts";
export { commitWrite, insertEntry, insertUsage, prepareStorageCommit, validateCommittedWrites } from "./commit.ts";
export { createForkSnapshot, type ForkSourceSnapshot } from "./fork.ts";
export { type ForkCurrentStatePlan, projectForkCurrentStateWrite } from "./fork-policy.ts";
export {
	JSONL_STORAGE_VERSION,
	type JsonlSessionCreateOptions,
	type JsonlSessionListOptions,
	type JsonlSessionMetadata,
	JsonlSessionRepo,
	type JsonlSessionRepoOptions,
} from "./jsonl/index.ts";
export type { MemorySessionRepoOptions } from "./memory.ts";
export { MemorySessionRepo } from "./memory.ts";
export {
	SessionBranchExistsError,
	SessionInvalidBranchError,
	SessionInvariantError,
	SessionPendingAssistantMessageError,
	SessionUnknownTargetError,
	StorageBackedSession,
	type StorageBackedSessionOptions,
} from "./session.ts";
export * from "./types.ts";
export * from "./values.ts";
