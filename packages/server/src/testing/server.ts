/**
 * 【文件职责】实现 `@earendil-works/pi-server` 包中的 `testing/server` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `../server.ts`、`../types.ts`、`./service.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为 pi 的实验性服务端提供实现；本文件负责其中与 `testing/server` 对应的子能力。
 * 【逻辑维度】对外入口包括 `TestServerOptions`、`TestServer`、`createTestServer`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `TestServerOptions`、`TestServer`、`createTestServer` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import { PiServer } from "../server.ts";
import type { PiServerOptions, PiServerService } from "../types.ts";
import { TestServerService } from "./service.ts";

export interface TestServerOptions extends PiServerOptions {
	service?: PiServerService;
}

export interface TestServer {
	server: PiServer;
	service: PiServerService;
}

/** Create an unstarted PiServer with deterministic defaults for transport conformance tests. */
export function createTestServer(options: TestServerOptions): TestServer {
	const service = options.service ?? new TestServerService();
	return {
		server: new PiServer(service, {
			listeners: options.listeners,
			maxFrameLength: options.maxFrameLength,
			handshakeTimeoutMs: options.handshakeTimeoutMs,
			serverId: options.serverId,
			onError: options.onError,
		}),
		service,
	};
}
