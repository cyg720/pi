/**
 * 【文件职责】Session 类与“会话树 → 模型上下文”的构建管线：把持久化的会话树条目
 *              重放/变换为模型可见的消息序列，并提供各类条目的追加 API 与树移动（moveTo）。
 * 【技术维度】不可变路径回溯 + 管线式变换（默认压缩变换 + 自定义 transforms/projectors）；
 *              satisfies 保证条目形状精确；委托模式包装 SessionStorage。
 * 【产品维度】支撑会话恢复、分支切换、历史压缩等核心体验：模型每次看到的上下文都由此管线从会话树推导。
 * 【逻辑维度】模块级纯函数（deriveSessionContextState / defaultContextEntryTransform / buildContextEntries /
 *              sessionEntryToContextMessages / buildSessionContext）→ Session 类封装存储并暴露追加与查询方法。
 * 【关键边界】自定义 custom 条目默认不进入模型上下文（需注册 projector）；appendLabel 目标必须存在；
 *              moveTo 的 summary 会作为 branch_summary 条目挂在目标节点之下。
 * 【新手阅读建议】先读 5 个导出纯函数理解上下文推导规则 → 再读 Session 类的 appendXxx 系列（结构雷同）→
 *              最后精读 defaultContextEntryTransform 的两种压缩裁剪策略。
 */
import type { ImageContent, TextContent, Usage } from "@earendil-works/pi-ai";
import type { AgentMessage } from "../../types.ts";
import { createBranchSummaryMessage, createCompactionSummaryMessage, createCustomMessage } from "../messages.ts";
import type {
	ActiveToolsChangeEntry,
	BranchSummaryEntry,
	CompactionEntry,
	CustomEntry,
	CustomMessageEntry,
	LabelEntry,
	MessageEntry,
	ModelChangeEntry,
	SessionContext,
	SessionEntryCursorOptions,
	SessionInfoEntry,
	SessionMetadata,
	SessionStats,
	SessionStorage,
	SessionTreeEntry,
	ThinkingLevelChangeEntry,
} from "../types.ts";
import { SessionError } from "../types.ts";

/** 上下文条目变换器类型（中文说明）：接收路径条目数组，返回加工后的条目数组（在默认压缩变换之后执行）。 */
export type ContextEntryTransform = (entries: readonly SessionTreeEntry[]) => readonly SessionTreeEntry[];

/**
 * 自定义条目投影器类型（中文说明）：把 custom 条目映射为零或多条 AgentMessage；
 * 返回 undefined 视为空。参数依次为条目、下标、完整条目数组。
 */
export type CustomEntryContextMessageProjector = (
	entry: CustomEntry,
	index: number,
	entries: readonly SessionTreeEntry[],
) => readonly AgentMessage[] | undefined;

/** 上下文构建选项（中文说明）：可叠加变换器与按 customType 注册的投影器。 */
export interface SessionContextBuildOptions {
	/** Additional entry transforms applied after the default compaction transform. */
	// 追加的条目变换器（在默认压缩变换之后应用）
	entryTransforms?: readonly ContextEntryTransform[];
	/** Optional custom-entry projectors. Custom entries are omitted from model context by default. */
	// 自定义条目投影器；未注册类型的 custom 条目默认不进模型上下文
	entryProjectors?: Readonly<Record<string, CustomEntryContextMessageProjector>>;
}

/**
 * 从路径条目推导会话状态（私有）：顺序扫描取最后一次出现的思考级别、模型信息（优先 model_change，
 * 其次 assistant 消息自带字段）与启用工具名单。返回不含 messages 的 SessionContext 其余部分。
 */
function deriveSessionContextState(pathEntries: readonly SessionTreeEntry[]): Omit<SessionContext, "messages"> {
	let thinkingLevel = "off";
	let model: { provider: string; modelId: string } | null = null;
	let activeToolNames: string[] | null = null;

	for (const entry of pathEntries) {
		if (entry.type === "thinking_level_change") {
			thinkingLevel = entry.thinkingLevel;
		} else if (entry.type === "model_change") {
			model = { provider: entry.provider, modelId: entry.modelId };
		} else if (entry.type === "message" && entry.message.role === "assistant") {
			model = { provider: entry.message.provider, modelId: entry.message.model };
		} else if (entry.type === "active_tools_change") {
			activeToolNames = [...entry.activeToolNames];
		}
	}

	return { thinkingLevel, model, activeToolNames };
}

/**
 * 默认的上下文条目变换（中文说明）：处理最近一次压缩——
 * - 无压缩：原样返回副本；
 * - 压缩带 retainedTail：只保留 [压缩条目, 压缩之后]；
 * - 压缩带 firstKeptEntryId：保留 [压缩条目, 该 ID 起到压缩前的条目, 压缩之后]。
 * 参数 pathEntries —— 叶子到根/压缩点的路径条目。返回裁剪后的条目数组。
 */
export function defaultContextEntryTransform(pathEntries: readonly SessionTreeEntry[]): SessionTreeEntry[] {
	// 找最近一次压缩条目
	let compaction: CompactionEntry | null = null;
	for (const entry of pathEntries) {
		if (entry.type === "compaction") {
			compaction = entry;
		}
	}
	if (!compaction) {
		return [...pathEntries];
	}

	// 输出以压缩条目开头
	const entries: SessionTreeEntry[] = [compaction];
	const compactionIdx = pathEntries.findIndex((entry) => entry.type === "compaction" && entry.id === compaction.id);
	if (compaction.retainedTail) {
		// 有保留尾：直接接压缩之后的全部条目
		for (let i = compactionIdx + 1; i < pathEntries.length; i++) {
			entries.push(pathEntries[i]!);
		}
		return entries;
	}
	if (compaction.firstKeptEntryId) {
		// 无保留尾：从 firstKeptEntryId 起补回压缩前仍有效的条目
		let foundFirstKept = false;
		for (let i = 0; i < compactionIdx; i++) {
			const entry = pathEntries[i]!;
			if (entry.id === compaction.firstKeptEntryId) foundFirstKept = true;
			if (foundFirstKept) entries.push(entry);
		}
	}
	for (let i = compactionIdx + 1; i < pathEntries.length; i++) {
		entries.push(pathEntries[i]!);
	}
	return entries;
}

/**
 * 构建上下文条目序列（中文说明）：先应用默认压缩变换，再依序应用 options.entryTransforms。
 * 参数 pathEntries —— 路径条目；options —— 构建选项。返回最终参与上下文的条目数组。
 */
export function buildContextEntries(
	pathEntries: readonly SessionTreeEntry[],
	options: SessionContextBuildOptions = {},
): SessionTreeEntry[] {
	let entries = defaultContextEntryTransform(pathEntries);
	for (const transform of options.entryTransforms ?? []) {
		entries = [...transform(entries)];
	}
	return entries;
}

/**
 * 单个条目 → 模型消息（中文说明）：message 直接透传；custom_message 还原为 CustomMessage；
 * compaction 变成摘要消息 + 可选保留尾；branch_summary 变成分支摘要消息；
 * custom 经注册的投影器投影（未注册则为空）；其余条目产出空数组。
 */
export function sessionEntryToContextMessages(
	entry: SessionTreeEntry,
	index: number,
	entries: readonly SessionTreeEntry[],
	options: SessionContextBuildOptions = {},
): AgentMessage[] {
	if (entry.type === "message") {
		return [entry.message as AgentMessage];
	}
	if (entry.type === "custom_message") {
		return [
			createCustomMessage(
				entry.customType,
				entry.content as string | (TextContent | ImageContent)[],
				entry.display,
				entry.details,
				entry.timestamp,
			),
		];
	}
	if (entry.type === "compaction") {
		return [
			createCompactionSummaryMessage(entry.summary, entry.tokensBefore, entry.timestamp),
			...(entry.retainedTail ?? []),
		];
	}
	if (entry.type === "branch_summary" && entry.summary) {
		return [createBranchSummaryMessage(entry.summary, entry.fromId, entry.timestamp)];
	}
	if (entry.type === "custom") {
		return [...(options.entryProjectors?.[entry.customType]?.(entry, index, entries) ?? [])];
	}
	return [];
}

/**
 * 构建完整会话上下文（中文说明）：推导状态（思考级别/模型/工具）+ 变换条目 + 展开为消息序列。
 * 参数 pathEntries —— 路径条目；options —— 构建选项。返回 SessionContext。
 */
export function buildSessionContext(
	pathEntries: readonly SessionTreeEntry[],
	options: SessionContextBuildOptions = {},
): SessionContext {
	const state = deriveSessionContextState(pathEntries);
	const contextEntries = buildContextEntries(pathEntries, options);
	const messages = contextEntries.flatMap((entry, index) =>
		sessionEntryToContextMessages(entry, index, contextEntries, options),
	);
	return { ...state, messages };
}

/**
 * Session（中文说明）：某个会话存储的门面类——提供元信息/叶子/条目查询、上下文构建、
 * 各类条目的安全追加（自动生成 id/parentId/timestamp）以及 moveTo 树移动。
 * 泛型 TMetadata 对应底层存储的元信息类型。
 */
export class Session<TMetadata extends SessionMetadata = SessionMetadata> {
	// 底层存储实例
	private storage: SessionStorage<TMetadata>;
	// 实例级上下文构建选项（与方法级选项合并使用）
	private contextBuildOptions: SessionContextBuildOptions;

	constructor(storage: SessionStorage<TMetadata>, contextBuildOptions: SessionContextBuildOptions = {}) {
		this.storage = storage;
		this.contextBuildOptions = contextBuildOptions;
	}

	// 获取会话元信息
	getMetadata(): Promise<TMetadata> {
		return this.storage.getMetadata();
	}

	// 暴露底层存储（供 fork 等高级用法）
	getStorage(): SessionStorage<TMetadata> {
		return this.storage;
	}

	// 当前叶子 ID
	getLeafId(): Promise<string | null> {
		return this.storage.getLeafId();
	}

	// 按 ID 取条目
	getEntry(id: string): Promise<SessionTreeEntry | undefined> {
		return this.storage.getEntry(id);
	}

	// 分页读取全部条目
	getEntries(options?: SessionEntryCursorOptions): Promise<SessionTreeEntry[]> {
		return this.storage.getEntries(options);
	}

	// 取分支路径：fromId 缺省用当前叶子；返回该叶子到根/压缩点的条目序列
	async getBranch(fromId?: string): Promise<SessionTreeEntry[]> {
		const leafId = fromId ?? (await this.storage.getLeafId());
		return this.storage.getPathToRootOrCompaction(leafId);
	}

	// 构建当前上下文条目（合并实例级与方法级选项）
	async buildContextEntries(options: SessionContextBuildOptions = {}): Promise<SessionTreeEntry[]> {
		return buildContextEntries(await this.getBranch(), this.mergeContextBuildOptions(options));
	}

	// 构建完整模型上下文（状态 + 消息）
	async buildContext(options: SessionContextBuildOptions = {}): Promise<SessionContext> {
		return buildSessionContext(await this.getBranch(), this.mergeContextBuildOptions(options));
	}

	// 合并实例级与方法级构建选项（私有）：transforms 拼接、projectors 键合并（后者覆盖前者）
	private mergeContextBuildOptions(options: SessionContextBuildOptions): SessionContextBuildOptions {
		return {
			entryTransforms: [...(this.contextBuildOptions.entryTransforms ?? []), ...(options.entryTransforms ?? [])],
			entryProjectors: {
				...(this.contextBuildOptions.entryProjectors ?? {}),
				...(options.entryProjectors ?? {}),
			},
		};
	}

	// 查询条目标签
	getLabel(id: string): Promise<string | undefined> {
		return this.storage.getLabel(id);
	}

	// 会话统计（消息数/token/成本）
	getSessionStats(): Promise<SessionStats> {
		return this.storage.getSessionStats();
	}

	// 会话名称
	async getSessionName(): Promise<string | undefined> {
		return this.storage.getSessionName();
	}

	// 追加条目的统一入口（私有）：写入存储后返回条目 ID
	private async appendTypedEntry<TEntry extends SessionTreeEntry>(entry: TEntry): Promise<string> {
		await this.storage.appendEntry(entry);
		return entry.id;
	}

	// 追加一条消息条目
	async appendMessage(message: AgentMessage): Promise<string> {
		return this.appendTypedEntry({
			type: "message",
			id: await this.storage.createEntryId(),
			parentId: await this.storage.getLeafId(),
			timestamp: new Date().toISOString(),
			message,
		} satisfies MessageEntry);
	}

	// 追加思考级别变更条目
	async appendThinkingLevelChange(thinkingLevel: string): Promise<string> {
		return this.appendTypedEntry({
			type: "thinking_level_change",
			id: await this.storage.createEntryId(),
			parentId: await this.storage.getLeafId(),
			timestamp: new Date().toISOString(),
			thinkingLevel,
		} satisfies ThinkingLevelChangeEntry);
	}

	// 追加模型切换条目
	async appendModelChange(provider: string, modelId: string): Promise<string> {
		return this.appendTypedEntry({
			type: "model_change",
			id: await this.storage.createEntryId(),
			parentId: await this.storage.getLeafId(),
			timestamp: new Date().toISOString(),
			provider,
			modelId,
		} satisfies ModelChangeEntry);
	}

	// 追加启用工具变更条目（复制传入数组防共享）
	async appendActiveToolsChange(activeToolNames: string[]): Promise<string> {
		return this.appendTypedEntry({
			type: "active_tools_change",
			id: await this.storage.createEntryId(),
			parentId: await this.storage.getLeafId(),
			timestamp: new Date().toISOString(),
			activeToolNames: [...activeToolNames],
		} satisfies ActiveToolsChangeEntry);
	}

	/**
	 * 追加压缩条目（中文说明）：summary 摘要、firstKeptEntryId 保留起点、tokensBefore 压缩前规模、
	 * details 自由详情、fromHook 是否由钩子产生、usage LLM 用量、retainedTail 保留尾部消息。
	 */
	async appendCompaction<T = unknown>(
		summary: string,
		firstKeptEntryId: string | undefined,
		tokensBefore: number,
		details?: T,
		fromHook?: boolean,
		usage?: Usage,
		retainedTail?: AgentMessage[],
	): Promise<string> {
		return this.appendTypedEntry({
			type: "compaction",
			id: await this.storage.createEntryId(),
			parentId: await this.storage.getLeafId(),
			timestamp: new Date().toISOString(),
			summary,
			firstKeptEntryId,
			tokensBefore,
			retainedTail,
			details,
			usage,
			fromHook,
		} satisfies CompactionEntry<T>);
	}

	// 追加自定义数据条目（默认不进模型上下文）
	async appendCustomEntry(customType: string, data?: unknown): Promise<string> {
		return this.appendTypedEntry({
			type: "custom",
			id: await this.storage.createEntryId(),
			parentId: await this.storage.getLeafId(),
			timestamp: new Date().toISOString(),
			customType,
			data,
		} satisfies CustomEntry);
	}

	// 追加自定义消息条目（可通过 CustomMessage 投影进上下文）
	async appendCustomMessageEntry<T = unknown>(
		customType: string,
		content: string | (TextContent | ImageContent)[],
		display: boolean,
		details?: T,
	): Promise<string> {
		return this.appendTypedEntry({
			type: "custom_message",
			id: await this.storage.createEntryId(),
			parentId: await this.storage.getLeafId(),
			timestamp: new Date().toISOString(),
			customType,
			content,
			display,
			details,
		} satisfies CustomMessageEntry<T>);
	}

	// 设置/清除标签：目标条目必须存在；label 为 undefined 表示清除
	async appendLabel(targetId: string, label: string | undefined): Promise<string> {
		if (!(await this.storage.getEntry(targetId))) {
			throw new SessionError("not_found", `Entry ${targetId} not found`);
		}
		return this.appendTypedEntry({
			type: "label",
			id: await this.storage.createEntryId(),
			parentId: await this.storage.getLeafId(),
			timestamp: new Date().toISOString(),
			targetId,
			label,
		} satisfies LabelEntry);
	}

	// 重命名会话：清洗换行与首尾空白后写入 session_info 条目
	async appendSessionName(name: string): Promise<string> {
		const sanitizedName = name.replace(/[\r\n]+/g, " ").trim();
		return this.appendTypedEntry({
			type: "session_info",
			id: await this.storage.createEntryId(),
			parentId: await this.storage.getLeafId(),
			timestamp: new Date().toISOString(),
			name: sanitizedName,
		} satisfies SessionInfoEntry);
	}

	/**
	 * 移动叶子指针（中文说明）：把活动位置切到 entryId（null 表示清空）；
	 * 若提供 summary 则在其下追加一条 branch_summary 条目并返回其 ID，用于记录分支摘要。
	 * 目标不存在时抛 not_found。
	 */
	async moveTo(
		entryId: string | null,
		summary?: { summary: string; details?: unknown; usage?: Usage; fromHook?: boolean },
	): Promise<string | undefined> {
		if (entryId !== null && !(await this.storage.getEntry(entryId))) {
			throw new SessionError("not_found", `Entry ${entryId} not found`);
		}
		await this.storage.setLeafId(entryId);
		if (!summary) return undefined;
		return this.appendTypedEntry({
			type: "branch_summary",
			id: await this.storage.createEntryId(),
			parentId: entryId,
			timestamp: new Date().toISOString(),
			fromId: entryId ?? "root",
			summary: summary.summary,
			details: summary.details,
			usage: summary.usage,
			fromHook: summary.fromHook,
		} satisfies BranchSummaryEntry);
	}
}
