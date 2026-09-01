/**
 * 【文件职责】实现 `@earendil-works/pi-client` 包中的 `errors` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `@earendil-works/pi-protocol`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为远程 pi 会话提供基于 CBOR 帧字节的传输无关客户端能力；本文件负责其中与 `errors` 对应的子能力。
 * 【逻辑维度】对外入口包括 `PiServerError`、`PiDisconnectedError`、`PiClientDisposedError`、`PiSessionOwnershipError`、`PiSessionDetachedError`、`toError`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `PiServerError`、`PiDisconnectedError`、`PiClientDisposedError`、`PiSessionOwnershipError`、`PiSessionDetachedError`、`toError` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import type { JsonValue, ProtocolError, ProtocolErrorCode } from "@earendil-works/pi-protocol";

export class PiServerError extends Error {
	readonly code: ProtocolErrorCode;
	readonly details: JsonValue | undefined;

	constructor(error: ProtocolError) {
		super(error.message);
		this.name = "PiServerError";
		this.code = error.code;
		this.details = error.details;
	}
}

export class PiDisconnectedError extends Error {
	constructor(message = "Pi client is disconnected") {
		super(message);
		this.name = "PiDisconnectedError";
	}
}

export class PiClientDisposedError extends Error {
	constructor() {
		super("Pi client is disposed");
		this.name = "PiClientDisposedError";
	}
}

export class PiSessionOwnershipError extends Error {
	readonly sessionId: string;

	constructor(sessionId: string, message: string) {
		super(message);
		this.name = "PiSessionOwnershipError";
		this.sessionId = sessionId;
	}
}

export class PiSessionDetachedError extends Error {
	readonly sessionId: string;

	constructor(sessionId: string) {
		super(`Session ${sessionId} is not attached`);
		this.name = "PiSessionDetachedError";
		this.sessionId = sessionId;
	}
}

export function toError(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error));
}

export function toDisconnectedError(error: unknown): PiDisconnectedError {
	const cause = toError(error);
	return cause instanceof PiDisconnectedError ? cause : new PiDisconnectedError(cause.message);
}
