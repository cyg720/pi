/**
 * 【文件职责】实现 `@earendil-works/pi-agent-core` 包中的 `harness/session/jsonl/codec` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `../../types.ts`、`../state.ts`、`../types.ts`、`./errors.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为通用智能体提供传输抽象、状态管理与附件能力；本文件负责其中与 `harness/session/jsonl/codec` 对应的子能力。
 * 【逻辑维度】对外入口包括 `parseHeader`、`encodeHeader`、`metadataFromHeader`、`parseMutation`、`encodeMutation`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `parseHeader`、`encodeHeader`、`metadataFromHeader`、`parseMutation`、`encodeMutation` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import { err, ok, type Result } from "../../types.ts";
import { JSONL_FORMAT_VERSION, type JsonlStorageHeader } from "./types.ts";

export interface LegacyV3SessionHeader {
	type: "session";
	version: 3;
	id: string;
	timestamp: string;
	cwd: string;
	parentSession?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeIntegerAtLeast(value: unknown, minimum: number): value is number {
	return Number.isSafeInteger(value) && (value as number) >= minimum;
}

export function isLegacyV3SessionHeader(value: unknown): value is LegacyV3SessionHeader {
	return (
		isRecord(value) &&
		value.type === "session" &&
		value.version === 3 &&
		typeof value.id === "string" &&
		typeof value.cwd === "string" &&
		typeof value.timestamp === "string" &&
		Number.isFinite(Date.parse(value.timestamp)) &&
		(value.parentSession === undefined || typeof value.parentSession === "string")
	);
}

export function isJsonlStorageHeader(value: unknown): value is JsonlStorageHeader {
	return (
		isRecord(value) &&
		value.kind === "header" &&
		value.v === JSONL_FORMAT_VERSION &&
		typeof value.id === "string" &&
		typeof value.cwd === "string" &&
		isSafeIntegerAtLeast(value.storageVersion, 1) &&
		isSafeIntegerAtLeast(value.createdAt, 0) &&
		(value.nextSeq === undefined || isSafeIntegerAtLeast(value.nextSeq, 1)) &&
		(value.parentSessionId === undefined || typeof value.parentSessionId === "string") &&
		(value.legacyParentSessionPath === undefined || typeof value.legacyParentSessionPath === "string")
	);
}

export type JsonlParsedSessionHeader =
	| { format: "v4"; header: JsonlStorageHeader }
	| { format: "v3-legacy"; header: LegacyV3SessionHeader };

export function parseJsonlSessionHeader(line: string): Result<JsonlParsedSessionHeader, Error> {
	let value: unknown;
	try {
		value = JSON.parse(line);
	} catch (error) {
		return err(new Error("Invalid JSONL session header: not valid JSON", { cause: error }));
	}
	if (isJsonlStorageHeader(value)) return ok({ format: "v4", header: value });
	if (isLegacyV3SessionHeader(value)) return ok({ format: "v3-legacy", header: value });
	return err(new Error("Unsupported JSONL session header"));
}
