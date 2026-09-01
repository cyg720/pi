/**
 * 【文件职责】实现 `@earendil-works/pi-ai` 包中的 `models-store` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `./types.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为不同大模型提供统一 API、模型发现和供应商配置能力；本文件负责其中与 `models-store` 对应的子能力。
 * 【逻辑维度】对外入口包括 `ModelsStoreEntry`、`ModelsStoreOperationOptions`、`ModelsStore`、`InMemoryModelsStore`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `ModelsStoreEntry`、`ModelsStoreOperationOptions`、`ModelsStore`、`InMemoryModelsStore` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import type { Api, Model } from "./types.ts";

export interface ModelsStoreEntry {
	models: readonly Model<Api>[];
	/** Unix timestamp from the remote catalog's Last-Modified header. */
	lastModified?: number;
	/** Unix timestamp of the last completed remote check. */
	checkedAt?: number;
	/**
	 * Opaque validator from the remote catalog's ETag header, stored verbatim
	 * (quotes included) and echoed back as If-None-Match.
	 */
	etag?: string;
}

export interface ModelsStoreOperationOptions {
	signal?: AbortSignal;
}

/** Persistent model catalogs keyed by provider ID. */
export interface ModelsStore {
	read(providerId: string, options?: ModelsStoreOperationOptions): Promise<ModelsStoreEntry | undefined>;
	write(providerId: string, entry: ModelsStoreEntry, options?: ModelsStoreOperationOptions): Promise<void>;
	delete(providerId: string, options?: ModelsStoreOperationOptions): Promise<void>;
}

export class InMemoryModelsStore implements ModelsStore {
	private readonly entries = new Map<string, ModelsStoreEntry>();

	async read(providerId: string, options?: ModelsStoreOperationOptions): Promise<ModelsStoreEntry | undefined> {
		options?.signal?.throwIfAborted();
		const entry = this.entries.get(providerId);
		return entry ? structuredClone(entry) : undefined;
	}

	async write(providerId: string, entry: ModelsStoreEntry, options?: ModelsStoreOperationOptions): Promise<void> {
		options?.signal?.throwIfAborted();
		this.entries.set(providerId, structuredClone(entry));
	}

	async delete(providerId: string, options?: ModelsStoreOperationOptions): Promise<void> {
		options?.signal?.throwIfAborted();
		this.entries.delete(providerId);
	}
}
