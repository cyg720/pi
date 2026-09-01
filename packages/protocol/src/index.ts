/**
 * 【文件职责】实现 `@earendil-works/pi-protocol` 包中的 `index` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `./cbor/index.ts`、`./codec.ts`、`./framing.ts`、`./schemas.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为远程 pi 会话定义传输无关的 CBOR 通信协议；本文件负责其中与 `index` 对应的子能力。
 * 【逻辑维度】本文件通过重导出汇总相邻模块的公开符号，使调用方可以从稳定入口访问各项能力。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看各条重导出语句，再进入对应子模块阅读具体类型与实现。
 */
export * from "./cbor/index.ts";
export * from "./codec.ts";
export * from "./framing.ts";
export * from "./schemas.ts";
