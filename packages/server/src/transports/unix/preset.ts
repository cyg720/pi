/**
 * 【文件职责】实现 `@earendil-works/pi-server` 包中的 `transports/unix/preset` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `../../server.ts`、`../../types.ts`、`./listener.ts`、`./types.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为 pi 的实验性服务端提供实现；本文件负责其中与 `transports/unix/preset` 对应的子能力。
 * 【逻辑维度】对外入口包括 `createUnixServer`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `createUnixServer` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import { PiServer } from "../../server.ts";
import type { PiServerService } from "../../types.ts";
import { createUnixListener } from "./listener.ts";
import type { UnixServerOptions } from "./types.ts";

/** Compose PiServer with one Unix-domain socket listener. */
export function createUnixServer(service: PiServerService, options: UnixServerOptions): PiServer {
	const listener = createUnixListener({
		path: options.path,
		mode: options.mode,
		maxFrameLength: options.maxFrameLength,
		maxPendingBytes: options.maxPendingBytes,
		gracefulCloseTimeoutMs: options.gracefulCloseTimeoutMs,
		onError: options.onError,
	});
	return new PiServer(service, {
		listeners: [listener],
		maxFrameLength: options.maxFrameLength,
		handshakeTimeoutMs: options.handshakeTimeoutMs,
		serverId: options.serverId,
		onError: options.onError,
	});
}
