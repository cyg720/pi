/**
 * 【文件职责】实现 `@earendil-works/pi-agent-core` 包中的 `harness/session/jsonl/types` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `../../types.ts`、`../types.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为通用智能体提供传输抽象、状态管理与附件能力；本文件负责其中与 `harness/session/jsonl/types` 对应的子能力。
 * 【逻辑维度】对外入口包括 `JsonlSessionRepoFileSystem`、`JsonlSessionRepoOptions`、`JsonlSessionMetadata`、`JsonlSessionCreateOptions`、`JsonlSessionListOptions`、`JsonlV4Header`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `JsonlSessionRepoFileSystem`、`JsonlSessionRepoOptions`、`JsonlSessionMetadata`、`JsonlSessionCreateOptions`、`JsonlSessionListOptions`、`JsonlV4Header` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import type { FileSystem } from "../../types.ts";
import type { JsonValue, SessionCreateOptions, SessionMetadata } from "../types.ts";

export type JsonlSessionRepoFileSystem = Pick<
	FileSystem,
	| "absolutePath"
	| "joinPath"
	| "readTextFile"
	| "readTextLines"
	| "writeFile"
	| "appendFile"
	| "renameFile"
	| "fileInfo"
	| "listDir"
	| "exists"
	| "createDir"
	| "remove"
>;

export interface JsonlSessionRepoOptions {
	fs: JsonlSessionRepoFileSystem;
	/** Root containing coding-agent-compatible cwd-encoded session directories. */
	sessionsRoot: string;
}

export interface JsonlSessionMetadata extends SessionMetadata {
	cwd: string;
	path: string;
	/** Filesystem modification time as milliseconds since Unix epoch. */
	modifiedAt: number;
	sourceFormat: 3 | 4;
	/** Present only when a v3 parent path could not be resolved to a session id. */
	legacyParentSessionPath?: string;
	/** Opaque application-owned metadata. */
	metadata?: Record<string, JsonValue>;
}

export interface JsonlSessionCreateOptions extends SessionCreateOptions {
	cwd: string;
	metadata?: Record<string, JsonValue>;
}

export interface JsonlSessionListOptions {
	cwd?: string;
}

export interface JsonlV4Header {
	kind: "header";
	version: 4;
	id: string;
	createdAt: number;
	cwd: string;
	parentSessionId?: string;
	/** Preserved only when a v3 parent path could not be resolved to a session id. */
	legacyParentSessionPath?: string;
	metadata?: Record<string, JsonValue>;
}
