/**
 * 【文件职责】实现 `@earendil-works/pi-agent-core` 包中的 `harness/session/jsonl/errors` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `../../types.ts`、`../types.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为通用智能体提供传输抽象、状态管理与附件能力；本文件负责其中与 `harness/session/jsonl/errors` 对应的子能力。
 * 【逻辑维度】对外入口包括 `JsonlDecodeError`、`fileResult`、`invalidFile`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `JsonlDecodeError`、`fileResult`、`invalidFile` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import type { FileError, Result } from "../../types.ts";
import { SessionError } from "../types.ts";

export class JsonlDecodeError extends Error {
	readonly kind: "syntax" | "schema";

	constructor(kind: "syntax" | "schema", message: string, cause?: Error) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = "JsonlDecodeError";
		this.kind = kind;
	}
}

export function fileResult<T>(result: Result<T, FileError>, message: string): T {
	if (!result.ok) {
		throw new SessionError(
			result.error.code === "not_found" ? "not_found" : "storage",
			`${message}: ${result.error.message}`,
			result.error,
		);
	}
	return result.value;
}

export function invalidFile(path: string, line: number, cause: Error): SessionError {
	return new SessionError("invalid_entry", `Invalid JSONL v4 session ${path}: line ${line} ${cause.message}`, cause);
}
