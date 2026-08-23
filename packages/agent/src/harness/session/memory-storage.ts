/**
 * 【文件职责】SessionStorage 的纯内存实现（InMemorySessionStorage）：用数组 + 索引 Map 在内存中维护
 *              会话树条目，支持标签缓存、叶子指针、统计汇总与“到根/压缩点”的路径查询。
 * 【技术维度】Map 索引实现 O(1) 条目查找；uuidv7 随机尾生成短 ID；类型收窄过滤 findEntries。
 * 【产品维度】主要服务于测试与临时会话场景——无需落盘即可完整演练会话树的全部行为；
 *              也是自定义存储实现的参考样板。
 * 【逻辑维度】构造时重建索引/标签/叶子 → appendEntry/setLeafId 增量更新 →
 *              getPathToRootOrCompaction 沿 parentId 上溯（遇无 retainedTail 的压缩点继续回溯）。
 * 【关键边界】数据不持久化、进程退出即失；构造时若叶子指向不存在条目会抛 SessionError；
 *              短 ID 生成最多重试 100 次，失败退回完整 uuidv7。
 * 【新手阅读建议】先读 4 个私有工具函数（标签缓存与 ID 生成）→ 再按接口顺序读类方法 →
 *              重点理解 getPathToRootOrCompaction 的回溯规则。
 */
import { uuidv7 } from "@earendil-works/pi-ai";
import {
	type LeafEntry,
	type SessionEntryCursorOptions,
	SessionError,
	type SessionMetadata,
	type SessionStorage,
	type SessionTreeEntry,
} from "../types.ts";

/**
 * 更新标签缓存（私有）：仅处理 label 条目；label 有值则设置 targetId→label，
 * 为空/undefined 则删除该映射（表示清除标签）。
 */
function updateLabelCache(labelsById: Map<string, string>, entry: SessionTreeEntry): void {
	if (entry.type !== "label") return;
	const label = entry.label?.trim();
	if (label) {
		labelsById.set(entry.targetId, label);
	} else {
		labelsById.delete(entry.targetId);
	}
}

// 从条目列表构建完整标签缓存（私有）
function buildLabelsById(entries: SessionTreeEntry[]): Map<string, string> {
	const labelsById = new Map<string, string>();
	for (const entry of entries) {
		updateLabelCache(labelsById, entry);
	}
	return labelsById;
}

/**
 * 生成未冲突的条目短 ID（私有）：取 uuidv7 的随机尾 8 位；前缀是时间戳派生的近乎常量，
 * 所以短 ID 必须来自随机尾。最多尝试 100 次仍冲突则退回完整 UUID。参数 byId 提供查重能力。
 */
function generateEntryId(byId: { has(id: string): boolean }): string {
	for (let i = 0; i < 100; i++) {
		// The uuidv7 prefix is timestamp-derived and nearly constant between calls,
		// so short ids must come from the random tail.
		const id = uuidv7().slice(-8);
		if (!byId.has(id)) return id;
	}
	return uuidv7();
}

// 计算某条目追加后的新叶子（私有）：leaf 条目取其 targetId，其余条目即自身 ID
function leafIdAfterEntry(entry: SessionTreeEntry): string | null {
	return entry.type === "leaf" ? entry.targetId : entry.id;
}

/**
 * InMemorySessionStorage（中文说明）：内存版会话存储。
 * 构造时可注入既有条目与元信息（便于恢复/测试）；内部维护 entries 数组、byId 索引、
 * labelsById 标签缓存与 leafId 当前叶子。
 */
export class InMemorySessionStorage<TMetadata extends SessionMetadata = SessionMetadata>
	implements SessionStorage<TMetadata>
{
	// 会话元信息（不可变）
	private readonly metadata: TMetadata;
	// 全部条目的有序数组
	private entries: SessionTreeEntry[];
	// 条目 ID → 条目 的索引
	private byId: Map<string, SessionTreeEntry>;
	// 目标条目 ID → 标签文本 的缓存
	private labelsById: Map<string, string>;
	// 当前活动叶子节点 ID；null 表示空会话
	private leafId: string | null;

	// 构造：复制传入条目并重建全部索引；校验最终叶子必须存在
	constructor(options?: { entries?: SessionTreeEntry[]; metadata?: TMetadata }) {
		this.entries = options?.entries ? [...options.entries] : [];
		this.byId = new Map(this.entries.map((entry) => [entry.id, entry]));
		this.labelsById = buildLabelsById(this.entries);
		this.leafId = null;
		for (const entry of this.entries) this.leafId = leafIdAfterEntry(entry);
		if (this.leafId !== null && !this.byId.has(this.leafId)) {
			throw new SessionError("invalid_session", `Entry ${this.leafId} not found`);
		}
		this.metadata = options?.metadata ?? ({ id: uuidv7(), createdAt: new Date().toISOString() } as TMetadata);
	}

	// 返回会话元信息
	async getMetadata(): Promise<TMetadata> {
		return this.metadata;
	}

	// 返回当前叶子 ID；指向失效时报 invalid_session
	async getLeafId(): Promise<string | null> {
		if (this.leafId !== null && !this.byId.has(this.leafId)) {
			throw new SessionError("invalid_session", `Entry ${this.leafId} not found`);
		}
		return this.leafId;
	}

	// 设置新叶子：目标必须存在；同时追加一条 leaf 条目以记录切换历史
	async setLeafId(leafId: string | null): Promise<void> {
		if (leafId !== null && !this.byId.has(leafId)) {
			throw new SessionError("not_found", `Entry ${leafId} not found`);
		}
		const entry: LeafEntry = {
			type: "leaf",
			id: generateEntryId(this.byId),
			parentId: this.leafId,
			timestamp: new Date().toISOString(),
			targetId: leafId,
		};
		this.entries.push(entry);
		this.byId.set(entry.id, entry);
		this.leafId = leafId;
	}

	// 生成一个未使用的新条目 ID
	async createEntryId(): Promise<string> {
		return generateEntryId(this.byId);
	}

	// 追加条目：同步维护索引、标签缓存与叶子指针
	async appendEntry(entry: SessionTreeEntry): Promise<void> {
		this.entries.push(entry);
		this.byId.set(entry.id, entry);
		updateLabelCache(this.labelsById, entry);
		this.leafId = leafIdAfterEntry(entry);
	}

	// 按 ID 查条目；不存在返回 undefined
	async getEntry(id: string): Promise<SessionTreeEntry | undefined> {
		return this.byId.get(id);
	}

	// 按类型筛选全部条目（泛型保证返回类型的精确性）
	async findEntries<TType extends SessionTreeEntry["type"]>(
		type: TType,
	): Promise<Array<Extract<SessionTreeEntry, { type: TType }>>> {
		return this.entries.filter((entry): entry is Extract<SessionTreeEntry, { type: TType }> => entry.type === type);
	}

	// 查询某条目的当前标签
	async getLabel(id: string): Promise<string | undefined> {
		return this.labelsById.get(id);
	}

	// 取会话名：最后一条 session_info 条目中的 name（去空白后非空才有效）
	async getSessionName(): Promise<string | undefined> {
		const entries = await this.findEntries("session_info");
		return entries[entries.length - 1]?.name?.trim() || undefined;
	}

	/**
	 * 汇总会话统计（私有实现）：遍历条目累计消息数与用量——
	 * assistant 消息取 message.usage；compaction/branch_summary 条目取 entry.usage；
	 * 字段缺失或类型不对的用量直接跳过。cached=input 缓存读，uncached=input+cacheWrite。
	 */
	async getSessionStats() {
		let messageCount = 0;
		let cachedTokens = 0;
		let uncachedTokens = 0;
		let totalTokens = 0;
		let costTotal = 0;
		for (const entry of this.entries) {
			if (entry.type === "message") {
				messageCount += 1;
			}
			const usage =
				entry.type === "message"
					? entry.message.role === "assistant"
						? entry.message.usage
						: undefined
					: entry.type === "compaction" || entry.type === "branch_summary"
						? entry.usage
						: undefined;
			if (
				!usage ||
				typeof usage.input !== "number" ||
				typeof usage.output !== "number" ||
				typeof usage.cacheRead !== "number" ||
				typeof usage.cacheWrite !== "number" ||
				typeof usage.cost?.total !== "number"
			) {
				continue;
			}
			cachedTokens += usage.cacheRead;
			uncachedTokens += usage.input + usage.cacheWrite;
			totalTokens += usage.input + usage.output + usage.cacheRead + usage.cacheWrite;
			costTotal += usage.cost.total;
		}
		return {
			messageCount,
			cachedTokens,
			uncachedTokens,
			totalTokens,
			costTotal,
		};
	}

	/**
	 * 查询从叶子到根或最近压缩点的路径（中文说明）：
	 * 沿 parentId 向上收集条目；遇到带 retainedTail 的压缩点即停（其后历史已被尾部覆盖）；
	 * 遇到不带 retainedTail 的压缩点则继续回溯到其 firstKeptEntryId 处停止。
	 * 参数 leafId —— 起点叶子；null 返回空数组。
	 */
	async getPathToRootOrCompaction(leafId: string | null): Promise<SessionTreeEntry[]> {
		if (leafId === null) return [];
		const path: SessionTreeEntry[] = [];
		// 回溯提前停止的目标条目 ID
		let stopAtEntryId: string | null = null;
		let current = this.byId.get(leafId);
		if (!current) throw new SessionError("not_found", `Entry ${leafId} not found`);
		while (current) {
			path.unshift(current);
			if (stopAtEntryId !== null && current.id === stopAtEntryId) break;
			if (current.type === "compaction") {
				if (current.retainedTail) break;
				stopAtEntryId = current.firstKeptEntryId ?? null;
			}
			if (!current.parentId) break;
			const parent = this.byId.get(current.parentId);
			if (!parent) throw new SessionError("invalid_session", `Entry ${current.parentId} not found`);
			current = parent;
		}
		return path;
	}

	// 分页读取全部条目：afterEntrySeq 起始下标，limit 数量上限
	async getEntries(options?: SessionEntryCursorOptions): Promise<SessionTreeEntry[]> {
		const start = options?.afterEntrySeq ?? 0;
		const end = options?.limit === undefined ? undefined : start + options.limit;
		return this.entries.slice(start, end);
	}
}
