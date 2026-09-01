/**
 * 【文件职责】实现 `@earendil-works/pi-client` 包中的 `transport` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 语言内建能力与本文件声明，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为远程 pi 会话提供基于 CBOR 帧字节的传输无关客户端能力；本文件负责其中与 `transport` 对应的子能力。
 * 【逻辑维度】对外入口包括 `ByteTransport`、`ByteTransportHandlers`、`ByteTransportFactory`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `ByteTransport`、`ByteTransportHandlers`、`ByteTransportFactory` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
export interface ByteTransport {
	/** Sends one byte chunk. Calls must be delivered in invocation order. */
	send(chunk: Uint8Array): Promise<void>;
	/** Closes the transport. Implementations must make repeated calls harmless. */
	close(): void;
}

export interface ByteTransportHandlers {
	/** Delivers an arbitrary inbound byte chunk. */
	onData(chunk: Uint8Array): void;
	/** Reports an orderly terminal close. */
	onClose(): void;
	/** Reports a terminal transport failure. */
	onError(error: Error): void;
}

/** Creates a fresh connected, authenticated transport. Exactly one terminal handler is expected. */
export type ByteTransportFactory = (handlers: ByteTransportHandlers) => ByteTransport | Promise<ByteTransport>;
