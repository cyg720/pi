/**
 * 【文件职责】实现 `@earendil-works/pi-agent-core` 包中的 `harness/session/testing/types` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `../types.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为通用智能体提供传输抽象、状态管理与附件能力；本文件负责其中与 `harness/session/testing/types` 对应的子能力。
 * 【逻辑维度】对外入口包括 `SessionBackendFixture`、`SessionBackendFixtureFactory`、`SessionBackendConformanceCase`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `SessionBackendFixture`、`SessionBackendFixtureFactory`、`SessionBackendConformanceCase` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import type { SessionRepo } from "../types.ts";

/** A fresh backend instance owned by one conformance case. */
export interface SessionBackendFixture extends AsyncDisposable {
	readonly repository: SessionRepo;
}

/** Creates an isolated fixture for one conformance case. */
export type SessionBackendFixtureFactory = () => Promise<SessionBackendFixture>;

/** A runner-independent conformance case that can be registered with any test framework. */
export interface SessionBackendConformanceCase {
	readonly group: string;
	readonly name: string;
	run(): Promise<void>;
}
