/**
 * 【文件职责】实现 `@earendil-works/pi-agent-core` 包中的 `harness/session/jsonl/types` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `../../types.ts`、`../types.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为通用智能体提供传输抽象、状态管理与附件能力；本文件负责其中与 `harness/session/jsonl/types` 对应的子能力。
 * 【逻辑维度】对外入口包括 `JsonlSessionRepoFileSystem`、`JsonlSessionRepoOptions`、`JsonlSessionMetadata`、`JsonlSessionCreateOptions`、`JsonlSessionListOptions`、`JsonlV4Header`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `JsonlSessionRepoFileSystem`、`JsonlSessionRepoOptions`、`JsonlSessionMetadata`、`JsonlSessionCreateOptions`、`JsonlSessionListOptions`、`JsonlV4Header` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import type { FileSystem } from "../../types.ts";
import type { SessionCreateOptions, SessionMetadata } from "../types.ts";

export const JSONL_FORMAT_VERSION = 4;
export const JSONL_STORAGE_VERSION = 1;

export interface JsonlStorageHeader {
	v: typeof JSONL_FORMAT_VERSION;
	kind: "header";
	id: string;
	storageVersion: number;
	createdAt: number;
	cwd: string;
	parentSessionId?: string;
	legacyParentSessionPath?: string;
	/** Sequence high-water mark written by snapshot rewrites. */
	nextSeq?: number;
}

export interface JsonlStorageOptions {
	fileSystem: FileSystem;
	path: string;
	now?: () => number;
}

export interface JsonlSessionMetadata extends SessionMetadata {
	cwd: string;
	path: string;
	/** Filesystem modification time as milliseconds since Unix epoch. */
	modifiedAt: number;
}

export interface JsonlSessionCreateOptions extends SessionCreateOptions {
	cwd: string;
}

export interface JsonlSessionListOptions {
	cwd?: string;
}

export interface JsonlSessionRepoOptions {
	fileSystem: FileSystem;
	sessionsRoot: string;
	now?: () => number;
}
