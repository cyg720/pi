/**
 * 【文件职责】实现 `@earendil-works/pi-server` 包中的 `errors` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `@earendil-works/pi-protocol`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为 pi 的实验性服务端提供实现；本文件负责其中与 `errors` 对应的子能力。
 * 【逻辑维度】对外入口包括 `PiServerOperationErrorCode`、`INTERNAL_SERVER_ERROR_MESSAGE`、`NOT_IMPLEMENTED_MESSAGE`、`PiServerError`、`SessionBusyError`、`SessionLockedError`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `PiServerOperationErrorCode`、`INTERNAL_SERVER_ERROR_MESSAGE`、`NOT_IMPLEMENTED_MESSAGE`、`PiServerError`、`SessionBusyError`、`SessionLockedError` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import type { JsonValue, ProtocolErrorCode } from "@earendil-works/pi-protocol";

export type PiServerOperationErrorCode = Extract<
	ProtocolErrorCode,
	"busy" | "session_locked" | "not_found" | "invalid_request" | "not_implemented"
>;

export const INTERNAL_SERVER_ERROR_MESSAGE = "Internal server error";
export const NOT_IMPLEMENTED_MESSAGE = "Operation is not implemented";

/** A service/runtime error that can safely cross the protocol boundary. */
export class PiServerError extends Error {
	readonly code: PiServerOperationErrorCode;
	readonly details: JsonValue | undefined;

	constructor(code: PiServerOperationErrorCode, message: string, details?: JsonValue) {
		super(message);
		this.name = "PiServerError";
		this.code = code;
		this.details = details;
	}
}

export class SessionBusyError extends PiServerError {
	constructor(message = "Session is busy", details?: JsonValue) {
		super("busy", message, details);
		this.name = "SessionBusyError";
	}
}

export class SessionLockedError extends PiServerError {
	constructor(message = "Session is locked", details?: JsonValue) {
		super("session_locked", message, details);
		this.name = "SessionLockedError";
	}
}

export class SessionNotFoundError extends PiServerError {
	constructor(message = "Session was not found", details?: JsonValue) {
		super("not_found", message, details);
		this.name = "SessionNotFoundError";
	}
}

export class NotImplementedError extends PiServerError {
	constructor() {
		super("not_implemented", NOT_IMPLEMENTED_MESSAGE);
		this.name = "NotImplementedError";
	}
}

/** An unsafe failure whose cause is retained for reporting but never serialized. */
export class InternalServerError extends Error {
	constructor(cause: unknown) {
		super(INTERNAL_SERVER_ERROR_MESSAGE, { cause });
		this.name = "InternalServerError";
	}
}
