/**
 * 【文件职责】默认内存凭据存储：按供应商 ID 存储单条凭据，写操作经 Promise 链按供应商串行化；
 *              应用可注入持久化存储替代。
 * 【技术维度】Map 存储 + Promise 链互斥；modify 为唯一写路径（读-改-写）。
 * 【产品维度】提供开箱即用的凭据存储语义（登录/刷新互斥），持久化由应用自行接入。
 * 【逻辑维度】enqueue 按供应商串行排队 → read/list 直读 → modify 串行读改写 → delete 串行删除。
 * 【关键边界】modify 返回写后凭据（fn 返回 undefined 表示不改动并返回当前值）；
 *              内存数据不跨进程/重启持久化。
 * 【新手阅读建议】重点理解 enqueue 的串行化机制与 modify 的"返回当前值"语义。
 */
import type { Credential, CredentialInfo, CredentialStore } from "./types.ts";

/**
 * Default in-memory credential store. Apps inject persistent stores.
 * Keyed by `Provider.id`, one credential per provider; see `CredentialStore`.
 * Writes are serialized per provider through a promise chain.
 */
// 默认内存凭据存储（中文说明）：应用可注入持久化存储；
// 按 Provider.id 键控、每供应商一条；写入经 Promise 链按供应商串行化。
export class InMemoryCredentialStore implements CredentialStore {
	// 凭据表：供应商 ID → 凭据
	private credentials = new Map<string, Credential>();
	// 各供应商的写链（串行化用）
	private chains = new Map<string, Promise<unknown>>();

	/** Serialize tasks per provider id. */
	// 按供应商 ID 串行化任务（私有）：排队等前一任务完成
	private enqueue<T>(providerId: string, task: () => Promise<T>): Promise<T> {
		const previous = this.chains.get(providerId) ?? Promise.resolve();
		const next = (async () => {
			await previous.catch(() => {});
			return task();
		})();
		this.chains.set(
			providerId,
			next.catch(() => {}),
		);
		return next;
	}

	// 读取凭据
	async read(providerId: string): Promise<Credential | undefined> {
		return this.credentials.get(providerId);
	}

	// 列出凭据元信息（不含密钥）
	async list(): Promise<readonly CredentialInfo[]> {
		return [...this.credentials].map(([providerId, credential]) => ({ providerId, type: credential.type }));
	}

	// 序列化读改写：fn 返回新凭据则写入；undefined 不改动；返回写后（或当前）凭据
	modify(
		providerId: string,
		fn: (current: Credential | undefined) => Promise<Credential | undefined>,
	): Promise<Credential | undefined> {
		return this.enqueue(providerId, async () => {
			const current = this.credentials.get(providerId);
			const next = await fn(current);
			if (next !== undefined) this.credentials.set(providerId, next);
			return next ?? current;
		});
	}

	// 删除凭据（与 modify 串行化）
	delete(providerId: string): Promise<void> {
		return this.enqueue(providerId, async () => {
			this.credentials.delete(providerId);
		});
	}
}
