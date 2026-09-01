/**
 * 【文件职责】实现 `@earendil-works/pi-server` 包中的 `testing/index` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `./client.ts`、`./server.ts`、`./service.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为 pi 的实验性服务端提供实现；本文件负责其中与 `testing/index` 对应的子能力。
 * 【逻辑维度】本文件通过重导出汇总相邻模块的公开符号，使调用方可以从稳定入口访问各项能力。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看各条重导出语句，再进入对应子模块阅读具体类型与实现。
 */
export type { WireChannel } from "./client.ts";
export { connectUnixTestClient, ProtocolTestClient } from "./client.ts";
export type { TestServer, TestServerOptions } from "./server.ts";
export { createTestServer } from "./server.ts";
export { Deferred, TEST_MODEL, TestServerService, TestSessionRuntime } from "./service.ts";
