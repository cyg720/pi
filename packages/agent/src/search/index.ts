/**
 * 【文件职责】实现 `@earendil-works/pi-agent-core` 包中的 `search/index` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `../harness/session/types.ts`、`./scanning.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为通用智能体提供传输抽象、状态管理与附件能力；本文件负责其中与 `search/index` 对应的子能力。
 * 【逻辑维度】对外入口包括 `SessionSearchOptions`、`SessionSearchHit`、`SessionSearch`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `SessionSearchOptions`、`SessionSearchHit`、`SessionSearch` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import type { Entry } from "../harness/session/types.ts";

export type {
	ScanningReadable,
	ScanningReadableOptions,
	ScanningReadableSource,
	ScanningSearchTextProjector,
	ScanningSessionSearchHit,
	ScanningSessionSearchOptions,
	SessionSearchCandidate,
} from "./scanning.ts";
export { createScanningSessionSearch, scanningEntries } from "./scanning.ts";

export interface SessionSearchOptions {
	/** Restrict results to specific canonical entry types. */
	readonly entryTypes?: readonly Entry["type"][];
	/** Maximum number of hits to return. */
	readonly limit?: number;
	/** Abort signal for cancellation, e.g. search-as-you-type. */
	readonly signal?: AbortSignal;
}

export interface SessionSearchHit {
	/** Logical identifier of the session that owns the entry. */
	readonly sessionId: string;
	/** Logical identifier of the entry within that session. */
	readonly entryId: string;
}

export interface SessionSearch<T extends SessionSearchHit = SessionSearchHit> {
	search(text: string, options?: SessionSearchOptions): AsyncIterable<T>;
}
