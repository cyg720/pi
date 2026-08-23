/**
 * 【文件职责】SessionStorage 的 JSONL 文件实现（JsonlSessionStorage）：首行为会话头（JSON），
 *              其后每行一个会话树条目；启动时全量加载进内存，写入采用“追加一行”的方式落盘。
 * 【技术维度】JSON Lines 持久化格式（版本 3）；严格的头部/条目校验并抛 SessionError；
 *              内存索引（byId/labelsById）+ 追加写保证性能与崩溃安全。
 * 【产品维度】这是 pi 默认的会话文件格式：用户可用文本编辑器查看/迁移会话历史，
 *              也便于第三方工具解析（docs 中的 session-format 即此结构）。
 * 【逻辑维度】静态 open（读文件重建状态）/create（写新头文件）→ 各接口方法：读走内存、
 *              写先 appendFile 落盘再更新内存 → getPathToRootOrCompaction 与内存版同规则。
 * 【关键边界】仅依赖 FileSystem 的四个方法（可适配远程存储）；头部 version 必须=3；
 *              leaf 条目 targetId 只能为 string|null；文件损坏时抛 invalid_session/invalid_entry。
 * 【新手阅读建议】先看 SessionHeader 与两个 parse 函数了解文件契约 → 再对比 memory-storage.ts 阅读类方法
 *              （逻辑几乎一致，差异只在“先落盘”）。
 */
import { uuidv7 } from "@earendil-works/pi-ai";
import type {
	FileSystem,
	JsonlSessionMetadata,
	LeafEntry,
	SessionEntryCursorOptions,
	SessionStorage,
	SessionTreeEntry,
} from "../types.ts";
import { SessionError, toError } from "../types.ts";
import { getFileSystemResultOrThrow } from "./repo-utils.ts";

/** 本存储所需的文件系统能力子集（中文说明）：只要求读文本/按行读/覆盖写/追加写，便于最小化适配。 */
type JsonlSessionStorageFileSystem = Pick<FileSystem, "readTextFile" | "readTextLines" | "writeFile" | "appendFile">;

/** 会话文件头（中文说明）：固定 type=session、version=3，含会话 ID、创建时间、工作目录、
 * 可选父会话路径与自由元数据。 */
interface SessionHeader {
	type: "session";
	version: 3;
	id: string;
	timestamp: string;
	cwd: string;
	parentSession?: string;
	metadata?: Record<string, unknown>;
}

/**
 * 更新标签缓存（私有）：与 memory-storage.ts 相同——label 条目设置或清除 targetId→label 映射。
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

// 从条目列表构建标签缓存（私有）
function buildLabelsById(entries: SessionTreeEntry[]): Map<string, string> {
	const labelsById = new Map<string, string>();
	for (const entry of entries) {
		updateLabelCache(labelsById, entry);
	}
	return labelsById;
}

/**
 * 生成未冲突的条目短 ID（私有）：取 uuidv7 随机尾 8 位，最多重试 100 次，失败退回完整 UUID。
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

// 构造“整个文件无效”错误（私有）
function invalidSession(filePath: string, message: string, cause?: Error): SessionError {
	return new SessionError("invalid_session", `Invalid JSONL session file ${filePath}: ${message}`, cause);
}

// 构造“某行无效”错误（私有）：lineNumber 从 1 计
function invalidEntry(filePath: string, lineNumber: number, message: string, cause?: Error): SessionError {
	return new SessionError(
		"invalid_entry",
		`Invalid JSONL session file ${filePath}: line ${lineNumber} ${message}`,
		cause,
	);
}

/**
 * 解析头行（私有）：JSON 解析失败/非对象/type≠session/version≠3/缺 id·timestamp·cwd/
 * parentSession 非 string/metadata 非对象 均抛 invalid_session。返回规范化后的 SessionHeader。
 */
function parseHeaderLine(line: string, filePath: string): SessionHeader {
	let parsed: unknown;
	try {
		parsed = JSON.parse(line);
	} catch (error) {
		throw invalidSession(filePath, "first line is not a valid session header", toError(error));
	}
	if (typeof parsed !== "object" || parsed === null) {
		throw invalidSession(filePath, "first line is not a valid session header");
	}
	const header = parsed as Partial<SessionHeader>;
	if (header.type !== "session") throw invalidSession(filePath, "first line is not a valid session header");
	if (header.version !== 3) throw invalidSession(filePath, "unsupported session version");
	if (typeof header.id !== "string" || !header.id) throw invalidSession(filePath, "session header is missing id");
	if (typeof header.timestamp !== "string" || !header.timestamp) {
		throw invalidSession(filePath, "session header is missing timestamp");
	}
	if (typeof header.cwd !== "string" || !header.cwd) throw invalidSession(filePath, "session header is missing cwd");
	if (header.parentSession !== undefined && typeof header.parentSession !== "string") {
		throw invalidSession(filePath, "session header parentSession must be a string");
	}
	if (
		header.metadata !== undefined &&
		(typeof header.metadata !== "object" || header.metadata === null || Array.isArray(header.metadata))
	) {
		throw invalidSession(filePath, "session header metadata must be an object");
	}
	return {
		type: "session",
		version: 3,
		id: header.id,
		timestamp: header.timestamp,
		cwd: header.cwd,
		parentSession: header.parentSession,
		metadata: header.metadata,
	};
}

/**
 * 解析条目行（私有）：校验 JSON 合法性、必有的 type/id/timestamp、parentId 为 string|null、
 * leaf 条目的 targetId 为 string|null；不通过抛 invalid_entry。返回宽泛校验后的条目对象。
 */
function parseEntryLine(line: string, filePath: string, lineNumber: number): SessionTreeEntry {
	let parsed: unknown;
	try {
		parsed = JSON.parse(line);
	} catch (error) {
		throw invalidEntry(filePath, lineNumber, "is not valid JSON", toError(error));
	}
	if (typeof parsed !== "object" || parsed === null) {
		throw invalidEntry(filePath, lineNumber, "is not a valid session entry");
	}
	const entry = parsed as {
		type?: unknown;
		id?: unknown;
		parentId?: unknown;
		timestamp?: unknown;
		targetId?: unknown;
	};
	if (typeof entry.type !== "string") throw invalidEntry(filePath, lineNumber, "is missing entry type");
	if (typeof entry.id !== "string" || !entry.id) throw invalidEntry(filePath, lineNumber, "is missing entry id");
	if (entry.parentId !== null && typeof entry.parentId !== "string") {
		throw invalidEntry(filePath, lineNumber, "has invalid parentId");
	}
	if (typeof entry.timestamp !== "string" || !entry.timestamp) {
		throw invalidEntry(filePath, lineNumber, "is missing timestamp");
	}
	if (entry.type === "leaf" && entry.targetId !== null && typeof entry.targetId !== "string") {
		throw invalidEntry(filePath, lineNumber, "has invalid targetId");
	}
	return entry as SessionTreeEntry;
}

// 追加条目后的新叶子（私有）：leaf 条目取 targetId，其余取自身 id
function leafIdAfterEntry(entry: SessionTreeEntry): string | null {
	return entry.type === "leaf" ? entry.targetId : entry.id;
}

// 头对象 + 文件路径 → 完整元信息（私有）
function headerToSessionMetadata(header: SessionHeader, path: string): JsonlSessionMetadata {
	return {
		id: header.id,
		createdAt: header.timestamp,
		cwd: header.cwd,
		path,
		parentSessionPath: header.parentSession,
		metadata: header.metadata,
	};
}

/**
 * 仅读取会话元信息（中文说明）：只读首行解析头部，避免加载整个文件；
 * 文件为空或缺头时抛 invalid_session。参数 fs —— 文件系统能力；filePath —— 会话文件路径。
 */
export async function loadJsonlSessionMetadata(
	fs: JsonlSessionStorageFileSystem,
	filePath: string,
): Promise<JsonlSessionMetadata> {
	const lines = getFileSystemResultOrThrow(
		await fs.readTextLines(filePath, { maxLines: 1 }),
		`Failed to read session header ${filePath}`,
	);
	const line = lines[0];
	if (line?.trim()) return headerToSessionMetadata(parseHeaderLine(line, filePath), filePath);
	throw invalidSession(filePath, "missing session header");
}

/**
 * 全量加载会话文件（私有）：读全文 → 过滤空行 → 解析头 → 逐行解析条目并推导最终叶子；
 * 空文件抛 invalid_session。返回 { header, entries, leafId }。
 */
async function loadJsonlStorage(
	fs: JsonlSessionStorageFileSystem,
	filePath: string,
): Promise<{
	header: SessionHeader;
	entries: SessionTreeEntry[];
	leafId: string | null;
}> {
	const content = getFileSystemResultOrThrow(await fs.readTextFile(filePath), `Failed to read session ${filePath}`);
	// 去掉空行后逐行处理
	const lines = content.split("\n").filter((line) => line.trim());
	if (lines.length === 0) {
		throw invalidSession(filePath, "missing session header");
	}

	const header = parseHeaderLine(lines[0]!, filePath);
	const entries: SessionTreeEntry[] = [];
	let leafId: string | null = null;
	for (let i = 1; i < lines.length; i++) {
		const entry = parseEntryLine(lines[i]!, filePath, i + 1);
		entries.push(entry);
		leafId = leafIdAfterEntry(entry);
	}
	return { header, entries, leafId };
}

/**
 * JsonlSessionStorage（中文说明）：基于 JSONL 文件的会话存储实现。
 * 私有构造——统一经静态 open/create 获得实例；内部维护内存索引，所有写入先落盘后更新内存。
 */
export class JsonlSessionStorage implements SessionStorage<JsonlSessionMetadata> {
	// 注入的文件系统能力子集
	private readonly fs: JsonlSessionStorageFileSystem;
	// 会话文件路径
	private readonly filePath: string;
	// 由头部派生的元信息（不可变）
	private readonly metadata: JsonlSessionMetadata;
	// 全部条目（内存副本，顺序与文件一致）
	private entries: SessionTreeEntry[];
	// 条目 ID 索引
	private byId: Map<string, SessionTreeEntry>;
	// 标签缓存
	private labelsById: Map<string, string>;
	// 当前叶子指针
	private currentLeafId: string | null;

	private constructor(
		fs: JsonlSessionStorageFileSystem,
		filePath: string,
		header: SessionHeader,
		entries: SessionTreeEntry[],
		leafId: string | null,
	) {
		this.fs = fs;
		this.filePath = filePath;
		this.metadata = headerToSessionMetadata(header, this.filePath);
		this.entries = entries;
		this.byId = new Map(entries.map((entry) => [entry.id, entry]));
		this.labelsById = buildLabelsById(entries);
		this.currentLeafId = leafId;
	}

	// 打开既有会话文件：全量读取并校验
	static async open(fs: JsonlSessionStorageFileSystem, filePath: string): Promise<JsonlSessionStorage> {
		const loaded = await loadJsonlStorage(fs, filePath);
		return new JsonlSessionStorage(fs, filePath, loaded.header, loaded.entries, loaded.leafId);
	}

	/**
	 * 创建新会话文件（中文说明）：写出会话头行（version 3）后返回空存储实例；
	 * options 提供 cwd/sessionId 及可选父路径与元数据。
	 */
	static async create(
		fs: JsonlSessionStorageFileSystem,
		filePath: string,
		options: {
			cwd: string;
			sessionId: string;
			parentSessionPath?: string;
			metadata?: Record<string, unknown>;
		},
	): Promise<JsonlSessionStorage> {
		const header: SessionHeader = {
			type: "session",
			version: 3,
			id: options.sessionId,
			timestamp: new Date().toISOString(),
			cwd: options.cwd,
			parentSession: options.parentSessionPath,
			metadata: options.metadata,
		};
		getFileSystemResultOrThrow(
			await fs.writeFile(filePath, `${JSON.stringify(header)}\n`),
			`Failed to create session ${filePath}`,
		);
		return new JsonlSessionStorage(fs, filePath, header, [], null);
	}

	// 元信息
	async getMetadata(): Promise<JsonlSessionMetadata> {
		return this.metadata;
	}

	// 当前叶子 ID；指向失效时报 invalid_session
	async getLeafId(): Promise<string | null> {
		if (this.currentLeafId !== null && !this.byId.has(this.currentLeafId)) {
			throw new SessionError("invalid_session", `Entry ${this.currentLeafId} not found`);
		}
		return this.currentLeafId;
	}

	// 设置新叶子：目标必须存在；追加 leaf 行落盘后再更新内存
	async setLeafId(leafId: string | null): Promise<void> {
		if (leafId !== null && !this.byId.has(leafId)) {
			throw new SessionError("not_found", `Entry ${leafId} not found`);
		}
		const entry: LeafEntry = {
			type: "leaf",
			id: generateEntryId(this.byId),
			parentId: this.currentLeafId,
			timestamp: new Date().toISOString(),
			targetId: leafId,
		};
		getFileSystemResultOrThrow(
			await this.fs.appendFile(this.filePath, `${JSON.stringify(entry)}\n`),
			`Failed to append session leaf ${entry.id}`,
		);
		this.entries.push(entry);
		this.byId.set(entry.id, entry);
		this.currentLeafId = leafId;
	}

	// 生成未使用的新条目 ID
	async createEntryId(): Promise<string> {
		return generateEntryId(this.byId);
	}

	// 追加条目：先追加一行落盘，成功后才更新内存索引/缓存/叶子
	async appendEntry(entry: SessionTreeEntry): Promise<void> {
		getFileSystemResultOrThrow(
			await this.fs.appendFile(this.filePath, `${JSON.stringify(entry)}\n`),
			`Failed to append session entry ${entry.id}`,
		);
		this.entries.push(entry);
		this.byId.set(entry.id, entry);
		updateLabelCache(this.labelsById, entry);
		this.currentLeafId = leafIdAfterEntry(entry);
	}

	// 按 ID 取条目
	async getEntry(id: string): Promise<SessionTreeEntry | undefined> {
		return this.byId.get(id);
	}

	// 按类型筛选条目（泛型收窄）
	async findEntries<TType extends SessionTreeEntry["type"]>(
		type: TType,
	): Promise<Array<Extract<SessionTreeEntry, { type: TType }>>> {
		return this.entries.filter((entry): entry is Extract<SessionTreeEntry, { type: TType }> => entry.type === type);
	}

	// 查询标签
	async getLabel(id: string): Promise<string | undefined> {
		return this.labelsById.get(id);
	}

	// 会话名：最后一条 session_info 的 name
	async getSessionName(): Promise<string | undefined> {
		const entries = await this.findEntries("session_info");
		return entries[entries.length - 1]?.name?.trim() || undefined;
	}

	/**
	 * 汇总统计（私有实现）：遍历内存条目累计消息数与用量；assistant 消息与压缩/分支摘要条目
	 * 提供用量，字段不完整则跳过。语义与 memory-storage.ts 一致。
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
	 * 叶子到根/压缩点的路径（私有实现）：回溯规则与 memory-storage.ts 相同——
	 * 带 retainedTail 的压缩点即停；否则回溯到 firstKeptEntryId 处停止。
	 */
	async getPathToRootOrCompaction(leafId: string | null): Promise<SessionTreeEntry[]> {
		if (leafId === null) return [];
		const path: SessionTreeEntry[] = [];
		// 回溯提前停止的目标
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

	// 分页读取全部条目
	async getEntries(options?: SessionEntryCursorOptions): Promise<SessionTreeEntry[]> {
		const start = options?.afterEntrySeq ?? 0;
		const end = options?.limit === undefined ? undefined : start + options.limit;
		return this.entries.slice(start, end);
	}
}
