/**
 * 【文件职责】实现 `@earendil-works/pi-server` 包中的 `transports/unix/types` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `../../types.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为 pi 的实验性服务端提供实现；本文件负责其中与 `transports/unix/types` 对应的子能力。
 * 【逻辑维度】对外入口包括 `UnixListenerOptions`、`UnixServerOptions`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `UnixListenerOptions`、`UnixServerOptions` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import type { PiServerOptions } from "../../types.ts";

export interface UnixListenerOptions {
	path: string;
	/** Socket filesystem permissions. Defaults to owner read/write only (0o600). */
	mode?: number;
	/** Maximum framed bytes queued per connection before a slow peer is disconnected. */
	maxPendingBytes?: number;
	gracefulCloseTimeoutMs?: number;
	/** Used to derive and validate maxPendingBytes. Must match the server when customized. */
	maxFrameLength?: number;
	onError?: (error: Error) => void;
}

export interface UnixServerOptions extends Omit<PiServerOptions, "listeners">, UnixListenerOptions {}
