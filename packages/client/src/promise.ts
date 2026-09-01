/**
 * 【文件职责】实现 `@earendil-works/pi-client` 包中的 `promise` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 语言内建能力与本文件声明，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为远程 pi 会话提供基于 CBOR 帧字节的传输无关客户端能力；本文件负责其中与 `promise` 对应的子能力。
 * 【逻辑维度】对外入口包括 `PromiseResolvers`、`createPromiseResolvers`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `PromiseResolvers`、`createPromiseResolvers` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
export interface PromiseResolvers<T> {
	promise: Promise<T>;
	resolve(value: T | PromiseLike<T>): void;
	reject(reason?: unknown): void;
}

/** Remove in favor of `Promise.withResolvers()` when the repository's TypeScript lib baseline moves to ES2024. */
export function createPromiseResolvers<T>(): PromiseResolvers<T> {
	let resolve!: PromiseResolvers<T>["resolve"];
	let reject!: PromiseResolvers<T>["reject"];
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
}
