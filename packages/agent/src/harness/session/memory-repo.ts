/**
 * 【文件职责】SessionRepo 的纯内存实现（InMemorySessionRepo）：在内存 Map 中管理多个会话的生命周期
 *              （创建/打开/列出/删除/分叉），配合 InMemorySessionStorage 构成完整的内存版会话体系。
 * 【技术维度】Map 管理会话注册表；复用 repo-utils 的公共工具（ID 生成、时间戳、fork 条目筛选、Session 包装）。
 * 【产品维度】为测试与嵌入式场景提供零依赖的会话管理能力；也是实现自定义会话仓库（数据库等）的最小参考样例。
 * 【逻辑维度】create/open 直接操作 Map → fork 通过 getEntriesToFork 复制源会话条目再建新存储。
 * 【关键边界】数据仅存内存，进程结束即失；open 不存在的会话抛 SessionError(not_found)；
 *              fork 出的新会话与源会话互不影响（深复制条目数组）。
 * 【新手阅读建议】半分钟读完：对照 SessionRepo 接口逐个看 5 个方法即可，重点在 fork 的条目复制流程。
 */
import { type Session, SessionError, type SessionMetadata, type SessionRepo } from "../types.ts";
import { InMemorySessionStorage } from "./memory-storage.ts";
import { createSessionId, createTimestamp, getEntriesToFork, toSession } from "./repo-utils.ts";

/**
 * InMemorySessionRepo（中文说明）：内存会话仓库。
 * sessions —— 会话 ID → Session 实例 的注册表；泛型固定为基础元信息与简单创建选项。
 */
export class InMemorySessionRepo implements SessionRepo<SessionMetadata, { id?: string }, void> {
	// 会话 ID → 会话实例 的注册表
	private sessions = new Map<string, Session<SessionMetadata>>();

	// 创建新会话：可指定 id，否则自动生成；用空存储初始化并登记
	async create(options: { id?: string } = {}): Promise<Session<SessionMetadata>> {
		const metadata: SessionMetadata = {
			id: options.id ?? createSessionId(),
			createdAt: createTimestamp(),
		};
		const storage = new InMemorySessionStorage({ metadata });
		const session = toSession(storage);
		this.sessions.set(metadata.id, session);
		return session;
	}

	// 打开既有会话：不存在时抛 not_found
	async open(metadata: SessionMetadata): Promise<Session<SessionMetadata>> {
		const session = this.sessions.get(metadata.id);
		if (!session) {
			throw new SessionError("not_found", `Session not found: ${metadata.id}`);
		}
		return session;
	}

	// 列出全部会话的元信息（并发读取各会话的元数据）
	async list(): Promise<SessionMetadata[]> {
		return Promise.all([...this.sessions.values()].map((session) => session.getMetadata()));
	}

	// 删除会话：从注册表移除（原实例仍被引用者持有则继续可用）
	async delete(metadata: SessionMetadata): Promise<void> {
		this.sessions.delete(metadata.id);
	}

	/**
	 * 分叉会话（中文说明）：按 entryId/position 从源会话截取历史条目，
	 * 以这些条目创建新的独立会话；id 可自定义。参数 sourceMetadata —— 源会话元信息；
	 * options —— 分叉选项。返回新 Session。
	 */
	async fork(
		sourceMetadata: SessionMetadata,
		options: { entryId?: string; position?: "before" | "at"; id?: string },
	): Promise<Session<SessionMetadata>> {
		// 打开源会话（不存在会抛错）
		const source = await this.open(sourceMetadata);
		// 计算需要复制的条目集合
		const forkedEntries = await getEntriesToFork(source.getStorage(), options);
		const metadata: SessionMetadata = {
			id: options.id ?? createSessionId(),
			createdAt: createTimestamp(),
		};
		// 用复制的条目构建新存储与会话
		const storage = new InMemorySessionStorage({ metadata, entries: forkedEntries });
		const session = toSession(storage);
		this.sessions.set(metadata.id, session);
		return session;
	}
}
