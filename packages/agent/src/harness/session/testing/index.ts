<<<<<<< HEAD
/**
 * 【文件职责】实现 `@earendil-works/pi-agent-core` 包中的 `harness/session/testing/index` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `./conformance.ts`、`./types.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为通用智能体提供传输抽象、状态管理与附件能力；本文件负责其中与 `harness/session/testing/index` 对应的子能力。
 * 【逻辑维度】本文件通过重导出汇总相邻模块的公开符号，使调用方可以从稳定入口访问各项能力。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看各条重导出语句，再进入对应子模块阅读具体类型与实现。
 */
export { createSessionBackendConformance } from "./conformance.ts";
export type {
	SessionBackendConformanceCase,
	SessionBackendFixture,
	SessionBackendFixtureFactory,
} from "./types.ts";
=======
export { STORAGE_BENCHMARK_DATASETS } from "./benchmark/datasets.ts";
export {
	SESSION_REPO_CATALOG_BENCHMARK_DATASETS,
	SESSION_REPO_CATALOG_READ_BENCHMARK_SCENARIOS,
	SESSION_REPO_CATALOG_WRITE_BENCHMARK_SCENARIOS,
	SESSION_REPO_FORK_BENCHMARK_DATASETS,
	SESSION_REPO_FORK_WRITE_BENCHMARK_SCENARIOS,
	type SessionRepoCatalogBenchmarkDataset,
	seedSessionRepoCatalogBenchmark,
	seedSessionRepoForkBenchmark,
	sessionRepoBenchmarkSessionId,
} from "./benchmark/session-repo.ts";
export {
	generateStorageBenchmarkSeedTransactions,
	STORAGE_READ_BENCHMARK_SCENARIOS,
	STORAGE_WRITE_BENCHMARK_SCENARIOS,
	seedStorageBenchmark,
} from "./benchmark/storage.ts";
export {
	createSessionRepoConformance,
	createSessionRepoForkBehaviorConformance,
	createSessionRepoForkConformance,
	createSessionRepoForkCoordinationConformance,
	createSessionRepoForkDestinationReservationConformance,
	createSessionRepoForkSourceSnapshotConformance,
	createSessionRepoLifecycleConformance,
	createSessionRepoMessageConformance,
	createSessionRepoOwnershipConformance,
	createSessionRepoStreamingForkConformance,
} from "./conformance/session-repo.ts";
export { createStorageConformance } from "./conformance/storage.ts";
export { CommitDiscarded, GatingStorage } from "./gating-storage.ts";
export { InstrumentedStorage } from "./instrumented-storage.ts";
export { StorageDecorator } from "./storage-decorator.ts";
export type { ConformanceCase, StorageFixture } from "./types.ts";
>>>>>>> main
