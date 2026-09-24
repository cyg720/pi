<<<<<<< HEAD
/**
 * 【文件职责】实现 `@earendil-works/pi-server` 包中的 `errors` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `@earendil-works/pi-protocol`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为 pi 的实验性服务端提供实现；本文件负责其中与 `errors` 对应的子能力。
 * 【逻辑维度】对外入口包括 `PiServerOperationErrorCode`、`INTERNAL_SERVER_ERROR_MESSAGE`、`NOT_IMPLEMENTED_MESSAGE`、`PiServerError`、`SessionBusyError`、`SessionLockedError`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `PiServerOperationErrorCode`、`INTERNAL_SERVER_ERROR_MESSAGE`、`NOT_IMPLEMENTED_MESSAGE`、`PiServerError`、`SessionBusyError`、`SessionLockedError` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import type { JsonValue, ProtocolErrorCode } from "@earendil-works/pi-protocol";
=======
import type { RemoteServiceErrorCode } from "@earendil-works/chord";
>>>>>>> main

type ServerOperationErrorCode =
	| RemoteServiceErrorCode
	| "wrong_server"
	| "session_not_found"
	| "session_ambiguous"
	| "session_not_attached"
	| "server_draining";

export const INTERNAL_SERVER_ERROR_MESSAGE = "Internal server error";

/** A host or lifecycle error that can safely cross the protocol boundary. */
export class ServerError extends Error {
	readonly code: ServerOperationErrorCode;

	constructor(code: ServerOperationErrorCode, message: string) {
		super(message);
		this.name = "ServerError";
		this.code = code;
	}
}

export class WrongServerError extends ServerError {
	constructor() {
		super("wrong_server", "Request was addressed to another server");
		this.name = "WrongServerError";
	}
}

export class SessionNotFoundError extends ServerError {
	constructor(message = "Session was not found") {
		super("session_not_found", message);
		this.name = "SessionNotFoundError";
	}
}

export class SessionAmbiguousError extends ServerError {
	constructor() {
		super("session_ambiguous", "Session ID matches more than one session");
		this.name = "SessionAmbiguousError";
	}
}

export class SessionNotAttachedError extends ServerError {
	constructor() {
		super("session_not_attached", "Session is not attached to this client");
		this.name = "SessionNotAttachedError";
	}
}

export class ServerDrainingError extends ServerError {
	constructor() {
		super("server_draining", "Server is draining");
		this.name = "ServerDrainingError";
	}
}
