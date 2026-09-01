/**
 * 【文件职责】实现 `@earendil-works/pi-server` 包中的 `connection` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `@earendil-works/pi-protocol`、`./types.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为 pi 的实验性服务端提供实现；本文件负责其中与 `connection` 对应的子能力。
 * 【逻辑维度】对外入口包括 `ByteConnection`、`ByteConnectionHandler`、`ByteConnectionAcceptor`、`ConnectionStage`、`ConnectionState`、`isTerminalConnection`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `ByteConnection`、`ByteConnectionHandler`、`ByteConnectionAcceptor`、`ConnectionStage`、`ConnectionState`、`isTerminalConnection` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import type { ClientMessageDecoder } from "@earendil-works/pi-protocol";

import type { MaybePromise } from "./types.ts";

/** An established, authorized ordered byte connection. */
export interface ByteConnection {
	readonly closed: boolean;
	send(chunk: Uint8Array): Promise<void>;
	close(finalChunk?: Uint8Array): MaybePromise<void>;
}

export interface ByteConnectionHandler {
	onData(chunk: Uint8Array): void;
	onClose(): void;
	onError(error: Error): void;
}

export type ByteConnectionAcceptor = (connection: ByteConnection) => ByteConnectionHandler;

export type ConnectionStage = "awaitingHello" | "handshaking" | "ready" | "closing" | "closed";

export interface ConnectionState {
	id: string;
	connection: ByteConnection;
	decoder: ClientMessageDecoder;
	sessionIds: Set<string>;
	stage: ConnectionStage;
	disconnected: boolean;
	handshakeComplete: boolean;
	handshake?: Promise<void>;
	handshakeTimeout: NodeJS.Timeout;
}

export function isTerminalConnection(state: ConnectionState): boolean {
	return state.disconnected || state.stage === "closing" || state.stage === "closed";
}
