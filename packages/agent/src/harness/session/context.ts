/**
 * 【文件职责】实现 `@earendil-works/pi-agent-core` 包中的 `harness/session/context` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `../../types.ts`、`../messages.ts`、`./types.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为通用智能体提供传输抽象、状态管理与附件能力；本文件负责其中与 `harness/session/context` 对应的子能力。
 * 【逻辑维度】对外入口包括 `SessionContext`、`ContextEntryTransform`、`CustomEntryContextMessageProjector`、`SessionContextBuildOptions`、`defaultContextEntryTransform`、`buildContextEntries`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `SessionContext`、`ContextEntryTransform`、`CustomEntryContextMessageProjector`、`SessionContextBuildOptions`、`defaultContextEntryTransform`、`buildContextEntries` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import type { AgentMessage } from "../../types.ts";
import type { Context } from "../context.ts";
import { createBranchSummaryMessage, createCompactionSummaryMessage } from "../messages.ts";
import type { CompactionEntry, Entry, EntryProjector } from "./types.ts";

export interface SessionContextBuildOptions {
	entryProjectors?: Readonly<Record<string, EntryProjector>>;
}

export function buildContextEntries(pathEntries: readonly Entry[]): Entry[] {
	let compaction: CompactionEntry | undefined;
	let compactionIndex = -1;
	for (let index = pathEntries.length - 1; index >= 0; index--) {
		const entry = pathEntries[index];
		if (entry?.type === "compaction") {
			compaction = entry;
			compactionIndex = index;
			break;
		}
	}
	return compaction === undefined ? [...pathEntries] : [compaction, ...pathEntries.slice(compactionIndex + 1)];
}

function isContextMessage(message: AgentMessage): boolean {
	return (
		message.role !== "assistant" ||
		(message.stopReason !== "error" && message.stopReason !== "aborted" && message.stopReason !== "deferred")
	);
}

export function sessionEntryToContextMessages(entry: Entry): AgentMessage[] {
	switch (entry.type) {
		case "message":
			return isContextMessage(entry.message) ? [entry.message] : [];
		case "compaction":
			return [
				createCompactionSummaryMessage(entry.summary, entry.tokensBefore, entry.timestamp),
				...entry.retainedTail.filter(isContextMessage),
			];
		case "branch_summary":
			return entry.summary ? [createBranchSummaryMessage(entry.summary, entry.fromId, entry.timestamp)] : [];
		case "custom":
			return [];
	}
}

export async function buildSessionContext(
	pathEntries: readonly Entry[],
	options: SessionContextBuildOptions | undefined,
	context: Context,
): Promise<AgentMessage[]> {
	options ??= {};
	const entries = buildContextEntries(pathEntries);
	const messages: AgentMessage[] = [];
	for (const entry of entries) {
		if (entry.type !== "custom") {
			messages.push(...sessionEntryToContextMessages(entry));
			continue;
		}
		const projector = options.entryProjectors?.[entry.customType];
		if (projector !== undefined) messages.push(...((await projector(entry, context)) ?? []));
	}
	return messages;
}
