/**
 * 【文件职责】模型目录持久化存储接口与内存实现：按供应商 ID 保存远程模型目录的快照
 *              （含 Last-Modified/ETag/检查时间），供动态模型目录的离线恢复与条件刷新。
 * 【技术维度】纯接口 + 内存实现；structuredClone 深拷贝避免外部引用篡改。
 * 【产品维度】支持“缓存友好”的模型目录更新：启动时先用缓存模型，再按条件刷新网络目录。
 * 【逻辑维度】ModelsStore 定义三方法契约 → ProviderModelsStore 是单供应商作用域视图 →
 *              InMemoryModelsStore 用 Map 实现并做克隆读写。
 * 【关键边界】read/write/delete 均为异步；读取会返回克隆（修改不影响存储）；
 *              内存实现数据不跨进程持久化。
 * 【新手阅读建议】半分钟读完：理解三个接口的关系（全局 vs 单供应商）与克隆语义即可。
 */
import type { Api, Model } from "./types.ts";

/** 模型目录存储条目（中文说明）：models 模型列表；lastModified 远端目录 Last-Modified 时间戳；
 * checkedAt 上次完成远端检查的时间；etag 远端 ETag（原样保存、回显为 If-None-Match）。 */
export interface ModelsStoreEntry {
	// 模型列表
	models: readonly Model<Api>[];
	/** Unix timestamp from the remote catalog's Last-Modified header. */
	// 来自远端目录 Last-Modified 头的 Unix 时间戳
	lastModified?: number;
	/** Unix timestamp of the last completed remote check. */
	// 上次完成远端检查的 Unix 时间戳
	checkedAt?: number;
	/**
	 * Opaque validator from the remote catalog's ETag header, stored verbatim
	 * (quotes included) and echoed back as If-None-Match.
	 */
	// 远端目录 ETag 头的原样校验值（含引号），请求时回显为 If-None-Match
	etag?: string;
}

/** Persistent model catalogs keyed by provider ID. */
/** 按供应商 ID 键控的持久模型目录存储接口（中文说明）。 */
export interface ModelsStore {
	// 读取某供应商的目录条目
	read(providerId: string): Promise<ModelsStoreEntry | undefined>;
	// 写入某供应商的目录条目
	write(providerId: string, entry: ModelsStoreEntry): Promise<void>;
	// 删除某供应商的目录条目
	delete(providerId: string): Promise<void>;
}

/** ModelsStore scoped to one provider. Providers cannot access other providers' catalogs. */
/** 单供应商作用域的模型存储视图（中文说明）：供应商只能访问自己的目录。 */
export interface ProviderModelsStore {
	// 读取本供应商的目录条目
	read(): Promise<ModelsStoreEntry | undefined>;
	// 写入本供应商的目录条目
	write(entry: ModelsStoreEntry): Promise<void>;
	// 删除本供应商的目录条目
	delete(): Promise<void>;
}

/** 内存模型存储实现（中文说明）：条目存于 Map，读写均做结构化克隆。 */
export class InMemoryModelsStore implements ModelsStore {
	// 供应商 ID → 目录条目
	private readonly entries = new Map<string, ModelsStoreEntry>();

	// 读取：返回克隆（不存在则 undefined）
	async read(providerId: string): Promise<ModelsStoreEntry | undefined> {
		const entry = this.entries.get(providerId);
		return entry ? structuredClone(entry) : undefined;
	}

	// 写入：保存克隆，隔离外部引用
	async write(providerId: string, entry: ModelsStoreEntry): Promise<void> {
		this.entries.set(providerId, structuredClone(entry));
	}

	// 删除
	async delete(providerId: string): Promise<void> {
		this.entries.delete(providerId);
	}
}
