/**
 * 【文件职责】会话历史压缩（compaction）的核心实现：估算上下文 token、判断是否需要压缩、
 *              选择切割点（cut point）、准备压缩数据，并调用摘要模型生成/迭代更新结构化摘要。
 * 【技术维度】token 保守启发式估算（字符数/4 + 图片固定估值）；基于供应商 usage 的精确回溯；
 *              Result 风格错误；带重试的独立 LLM 摘要请求（禁缓存写、隔离 sessionId）。
 * 【产品维度】解决长对话撑爆上下文窗口的问题：把早期历史折叠成结构化“检查点摘要”，
 *              让模型在有限窗口内持续工作而不丢失目标与进度。
 * 【逻辑维度】estimateTokens/calculateContextTokens → shouldCompact 判定 → findCutPoint 选切割点 →
 *              prepareCompaction 产出准备数据 → compact 调 generateSummaryWithUsage（或拆轮双摘要）生成结果。
 * 【关键边界】toolResult 不作为切割点；切进一轮时按 turnStartIndex 拆分并单独生成前缀摘要；
 *              摘要 maxTokens 取 reserveTokens 的 80%（轮前缀取 50%）；中止与失败分别映射为不同错误码。
 * 【新手阅读建议】先读 CompactionSettings 与 DEFAULT_COMPACTION_SETTINGS 了解阈值语义 →
 *              再读 estimateContextTokens/findCutPoint 掌握算法 → 最后读 prepareCompaction 与 compact 主流程。
 */
import {
	type AssistantMessage,
	type Context,
	contentText,
	type ImageContent,
	type Model,
	type Models,
	type RetryCallbacks,
	type RetryPolicy,
	retryAssistantCall,
	type SimpleStreamOptions,
	type TextContent,
	type Usage,
	uuidv7,
} from "@earendil-works/pi-ai";
import type { AgentMessage, ThinkingLevel } from "../../types.ts";
import {
	convertToLlm,
	createBranchSummaryMessage,
	createCompactionSummaryMessage,
	createCustomMessage,
} from "../messages.ts";
import { buildSessionContext } from "../session/session.ts";
import { type CompactionEntry, CompactionError, err, ok, type Result, type SessionTreeEntry } from "../types.ts";
import {
	computeFileLists,
	createFileOps,
	extractFileOpsFromMessage,
	type FileOperations,
	formatFileOperations,
	serializeConversation,
} from "./utils.ts";

/** File-operation details stored on generated compaction entries. */
/** 压缩条目的详情结构（中文说明）：随压缩条目持久化的文件清单，供后续压缩继承累积。 */
export interface CompactionDetails {
	/** Files read in the compacted history. */
	// 被压缩历史中读过的文件
	readFiles: string[];
	/** Files modified in the compacted history. */
	modifiedFiles: string[];
}
// 安全 JSON 序列化（私有）：失败返回 [unserializable]
function safeJsonStringify(value: unknown): string {
	try {
		return JSON.stringify(value) ?? "undefined";
	} catch {
		return "[unserializable]";
	}
}

/**
 * 提取文件操作（私有）：以上一次压缩的持久化清单为基线（仅非钩子产生的条目），
 * 再叠加待摘要消息中的工具调用文件操作。参数 messages —— 待摘要消息；
 * entries —— 全部路径条目；prevCompactionIndex —— 上一次压缩的下标（-1 表示无）。
 */
function extractFileOperations(
	messages: AgentMessage[],
	entries: SessionTreeEntry[],
	prevCompactionIndex: number,
): FileOperations {
	const fileOps = createFileOps();
	if (prevCompactionIndex >= 0) {
		// 继承上次压缩记录的文件清单
		const prevCompaction = entries[prevCompactionIndex] as CompactionEntry;
		if (!prevCompaction.fromHook && prevCompaction.details) {
			const details = prevCompaction.details as CompactionDetails;
			if (Array.isArray(details.readFiles)) {
				for (const f of details.readFiles) fileOps.read.add(f);
			}
			if (Array.isArray(details.modifiedFiles)) {
				for (const f of details.modifiedFiles) fileOps.edited.add(f);
			}
		}
	}
	for (const msg of messages) {
		extractFileOpsFromMessage(msg, fileOps);
	}

	return fileOps;
}

/**
 * 条目 → 消息（私有）：message/custom_message/branch_summary/compaction 分别还原为对应 AgentMessage，
 * 其余条目返回 undefined。
 */
function getMessageFromEntry(entry: SessionTreeEntry): AgentMessage | undefined {
	if (entry.type === "message") {
		return entry.message as AgentMessage;
	}
	if (entry.type === "custom_message") {
		return createCustomMessage(
			entry.customType,
			entry.content as string | (TextContent | ImageContent)[],
			entry.display,
			entry.details,
			entry.timestamp,
		);
	}
	if (entry.type === "branch_summary") {
		return createBranchSummaryMessage(entry.summary, entry.fromId, entry.timestamp);
	}
	if (entry.type === "compaction") {
		return createCompactionSummaryMessage(entry.summary, entry.tokensBefore, entry.timestamp);
	}
	return undefined;
}

// 同上，但压缩条目不转换（压缩摘要本身不再进入下一轮被摘要的内容）
function getMessageFromEntryForCompaction(entry: SessionTreeEntry): AgentMessage | undefined {
	if (entry.type === "compaction") {
		return undefined;
	}
	return getMessageFromEntry(entry);
}

/** Generated compaction data ready to be persisted as a compaction entry. */
/** 压缩结果（中文说明）：可持久化为 compaction 条目的完整数据。 */
export interface CompactionResult<T = unknown> {
	/** Summary text that replaces compacted history in future context. */
	// 摘要正文：替代被压缩的历史进入未来上下文
	summary: string;
	/** Entry id where retained history starts. Optional during Pi 2.0 transition. */
	// 保留历史的起始条目 ID
	firstKeptEntryId?: string;
	/** Estimated context tokens before compaction. */
	// 压缩前估算的上下文 token 数
	tokensBefore: number;
	/** Usage from the LLM call(s) that generated this summary, if available. */
	// 生成本摘要的 LLM 用量（如有）
	usage?: Usage;
	/** Retained recent messages stored directly on the compaction entry. Optional during Pi 2.0 transition. */
	// 直接存于压缩条目上的近期保留消息
	retainedTail?: AgentMessage[];
	/** Optional implementation-specific details stored with the compaction entry. */
	// 实现自定义的附加详情（此处为 CompactionDetails）
	details?: T;
}

/**
 * 带重试的简单补全（中文说明）：摘要属于独立请求——隔离路由（新随机 sessionId）并禁止缓存写，
 * 避免产生无法复用的缓存成本。参数 models/model/context/options/retry/callbacks。
 * 返回最终的助手消息（含 stopReason）。
 */
export async function completeSimpleWithRetries(
	models: Models,
	model: Model<any>,
	context: Context,
	options: SimpleStreamOptions,
	retry?: RetryPolicy,
	callbacks?: RetryCallbacks,
): Promise<AssistantMessage> {
	// Summaries are standalone requests, so isolate routing and avoid cache writes that cannot be reused.
	// 合成请求选项：禁用缓存保留 + 独立会话 ID
	const requestOptions: SimpleStreamOptions = {
		...options,
		cacheRetention: "none",
		sessionId: uuidv7(),
	};
	return retryAssistantCall(
		() => models.completeSimple(model, context, requestOptions),
		retry,
		requestOptions.signal,
		callbacks,
	);
}

// 合并两次用量统计（私有）：各维度相加；可选字段（cacheWrite1h/reasoning）任一存在才输出
function combineUsage(first: Usage, second: Usage): Usage {
	return {
		input: first.input + second.input,
		output: first.output + second.output,
		cacheRead: first.cacheRead + second.cacheRead,
		cacheWrite: first.cacheWrite + second.cacheWrite,
		...(first.cacheWrite1h !== undefined || second.cacheWrite1h !== undefined
			? { cacheWrite1h: (first.cacheWrite1h ?? 0) + (second.cacheWrite1h ?? 0) }
			: {}),
		...(first.reasoning !== undefined || second.reasoning !== undefined
			? { reasoning: (first.reasoning ?? 0) + (second.reasoning ?? 0) }
			: {}),
		totalTokens: first.totalTokens + second.totalTokens,
		cost: {
			input: first.cost.input + second.cost.input,
			output: first.cost.output + second.cost.output,
			cacheRead: first.cost.cacheRead + second.cost.cacheRead,
			cacheWrite: first.cost.cacheWrite + second.cost.cacheWrite,
			total: first.cost.total + second.cost.total,
		},
	};
}

/** Compaction thresholds and retention settings. */
/** 压缩设置（中文说明）：控制自动压缩的开关与阈值。 */
export interface CompactionSettings {
	/** Enable automatic compaction decisions. */
	// 是否启用自动压缩判定
	enabled: boolean;
	/** Tokens reserved for summary prompt and output. */
	// 为摘要提示词与输出预留的 token 空间
	reserveTokens: number;
	/** Approximate recent-context tokens to keep after compaction. */
	// 压缩后希望保留的近期上下文 token 量
	keepRecentTokens: number;
}

/** Default compaction settings used by the harness. */
/** Harness 默认压缩设置：启用；预留 16K；保留最近约 20K token。 */
export const DEFAULT_COMPACTION_SETTINGS: CompactionSettings = {
	enabled: true,
	reserveTokens: 16384,
	keepRecentTokens: 20000,
};

/** Calculate total context tokens from provider usage. */
// 由供应商用量计算总上下文 token：优先 totalTokens，缺省时四项相加
export function calculateContextTokens(usage: Usage): number {
	return usage.totalTokens || usage.input + usage.output + usage.cacheRead + usage.cacheWrite;
}

// 提取有效的助手消息用量（私有）：排除 aborted/error 且 token 数必须大于 0
function getAssistantUsage(msg: AgentMessage): Usage | undefined {
	if (msg.role === "assistant" && "usage" in msg) {
		const assistantMsg = msg as AssistantMessage;
		if (
			assistantMsg.stopReason !== "aborted" &&
			assistantMsg.stopReason !== "error" &&
			assistantMsg.usage &&
			calculateContextTokens(assistantMsg.usage) > 0
		) {
			return assistantMsg.usage;
		}
	}
	return undefined;
}

/** Return usage from the last valid assistant message in session entries. */
// 从条目列表末尾向前找第一个带有效用量的助手消息
export function getLastAssistantUsage(entries: SessionTreeEntry[]): Usage | undefined {
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (entry.type === "message") {
			const usage = getAssistantUsage(entry.message as AgentMessage);
			if (usage) return usage;
		}
	}
	return undefined;
}

/** Estimated context-token usage for a message list. */
/** 上下文用量估算结果（中文说明）：总估算值 + 其中来自供应商精确用量与启发式尾部的分解。 */
export interface ContextUsageEstimate {
	/** Estimated total context tokens. */
	// 估算的总 token 数
	tokens: number;
	/** Tokens reported by the most recent assistant usage block. */
	// 最近一次助手用量报告的 token 数
	usageTokens: number;
	/** Estimated tokens after the most recent assistant usage block. */
	// 该消息之后（尾部）的启发式估算 token 数
	trailingTokens: number;
	/** Index of the message that provided usage, or null when none exists. */
	// 提供用量的消息下标；无则 null
	lastUsageIndex: number | null;
}

// 从消息数组末尾向前找第一个有效助手用量及其下标（私有）
function getLastAssistantUsageInfo(messages: AgentMessage[]): { usage: Usage; index: number } | undefined {
	for (let i = messages.length - 1; i >= 0; i--) {
		const usage = getAssistantUsage(messages[i]);
		if (usage) return { usage, index: i };
	}
	return undefined;
}

/** Estimate context tokens for messages using provider usage when available. */
/**
 * 估算消息列表的上下文 token（中文说明）：有供应商用量时以“该次精确值 + 之后消息的启发式估算”合成；
 * 完全没有用量时全部逐条启发式估算。参数 messages —— 消息列表；返回 ContextUsageEstimate。
 */
export function estimateContextTokens(messages: AgentMessage[]): ContextUsageEstimate {
	const usageInfo = getLastAssistantUsageInfo(messages);

	if (!usageInfo) {
		let estimated = 0;
		for (const message of messages) {
			estimated += estimateTokens(message);
		}
		return {
			tokens: estimated,
			usageTokens: 0,
			trailingTokens: estimated,
			lastUsageIndex: null,
		};
	}

	const usageTokens = calculateContextTokens(usageInfo.usage);
	let trailingTokens = 0;
	for (let i = usageInfo.index + 1; i < messages.length; i++) {
		trailingTokens += estimateTokens(messages[i]);
	}

	return {
		tokens: usageTokens + trailingTokens,
		usageTokens,
		trailingTokens,
		lastUsageIndex: usageInfo.index,
	};
}

/** Return whether context usage exceeds the configured compaction threshold. */
// 是否应触发压缩：启用且当前 token 超过“窗口 - 预留”水位线
export function shouldCompact(contextTokens: number, contextWindow: number, settings: CompactionSettings): boolean {
	if (!settings.enabled) return false;
	return contextTokens > contextWindow - settings.reserveTokens;
}

// 单张图片的字符当量估值（用于启发式 token 估算）
const ESTIMATED_IMAGE_CHARS = 4800;

// 估算字符串或内容块的字符量（私有）：文本按长度计、图片按固定当量计
function estimateTextAndImageContentChars(content: string | Array<{ type: string; text?: string }>): number {
	if (typeof content === "string") {
		return content.length;
	}

	let chars = 0;
	for (const block of content) {
		if (block.type === "text" && block.text) {
			chars += block.text.length;
		} else if (block.type === "image") {
			chars += ESTIMATED_IMAGE_CHARS;
		}
	}
	return chars;
}

/** Estimate token count for one message using a conservative character heuristic. */
/**
 * 单条消息的 token 启发式估算（中文说明）：按角色分别累计字符数再除以 4 向上取整——
 * user/custom/toolResult 统计文本+图片；assistant 统计正文+思考+工具调用（参数 JSON 化）；
 * bashExecution 为命令+输出；两类摘要为 summary 长度。
 */
export function estimateTokens(message: AgentMessage): number {
	let chars = 0;

	switch (message.role) {
		case "user": {
			chars = estimateTextAndImageContentChars(
				(message as { content: string | Array<{ type: string; text?: string }> }).content,
			);
			return Math.ceil(chars / 4);
		}
		case "assistant": {
			const assistant = message as AssistantMessage;
			for (const block of assistant.content) {
				if (block.type === "text") {
					chars += block.text.length;
				} else if (block.type === "thinking") {
					chars += block.thinking.length;
				} else if (block.type === "toolCall") {
					chars += block.name.length + safeJsonStringify(block.arguments).length;
				}
			}
			return Math.ceil(chars / 4);
		}
		case "custom":
		case "toolResult": {
			chars = estimateTextAndImageContentChars(message.content);
			return Math.ceil(chars / 4);
		}
		case "bashExecution": {
			chars = message.command.length + message.output.length;
			return Math.ceil(chars / 4);
		}
		case "branchSummary":
		case "compactionSummary": {
			chars = message.summary.length;
			return Math.ceil(chars / 4);
		}
	}

	return 0;
}

/**
 * 找出区间内的合法切割点下标（私有）：可作为切割起点的包括 user/assistant/bashExecution/
 * custom/branchSummary/compactionSummary 消息以及 branch_summary、custom_message 条目；
 * toolResult 及其余管理类条目不可作为切割点。
 */
function findValidCutPoints(entries: SessionTreeEntry[], startIndex: number, endIndex: number): number[] {
	const cutPoints: number[] = [];
	for (let i = startIndex; i < endIndex; i++) {
		const entry = entries[i];
		switch (entry.type) {
			case "message": {
				const role = entry.message.role;
				switch (role) {
					case "bashExecution":
					case "custom":
					case "branchSummary":
					case "compactionSummary":
					case "user":
					case "assistant":
						cutPoints.push(i);
						break;
					case "toolResult":
						break;
				}
				break;
			}
			case "thinking_level_change":
			case "model_change":
			case "active_tools_change":
			case "compaction":
			case "branch_summary":
			case "custom":
			case "custom_message":
			case "label":
			case "session_info":
			case "leaf":
				break;
		}
		if (entry.type === "branch_summary" || entry.type === "custom_message") {
			cutPoints.push(i);
		}
	}
	return cutPoints;
}

/** Find the user-visible message that starts the turn containing an entry. */
/**
 * 向前查找包含某条目的一轮的起点（中文说明）：从 entryIndex 向 startIndex 方向扫描，
 * 第一个 branch_summary/custom_message 条目或 user/bashExecution 消息即为轮起点；找不到返回 -1。
 */
export function findTurnStartIndex(entries: SessionTreeEntry[], entryIndex: number, startIndex: number): number {
	for (let i = entryIndex; i >= startIndex; i--) {
		const entry = entries[i];
		if (entry.type === "branch_summary" || entry.type === "custom_message") {
			return i;
		}
		if (entry.type === "message") {
			const role = entry.message.role;
			if (role === "user" || role === "bashExecution") {
				return i;
			}
		}
	}
	return -1;
}

/** Cut point selected for compaction. */
/** 切割点结果（中文说明）：firstKeptEntryIndex 压缩后保留的第一条；turnStartIndex 被切开轮的起点（未切开为 -1）；isSplitTurn 是否切开了一轮。 */
export interface CutPointResult {
	/** Index of the first entry retained after compaction. */
	firstKeptEntryIndex: number;
	/** Index of the turn-start entry when the cut splits a turn, otherwise -1. */
	turnStartIndex: number;
	/** Whether the selected cut point splits an in-progress turn. */
	isSplitTurn: boolean;
}

/** Find the compaction cut point that keeps approximately the requested recent-token budget. */
/**
 * 选择压缩切割点（中文说明）：从区间末尾反向累计消息 token，达到 keepRecentTokens 后
 * 选取不早于当前位置的第一个合法切割点；随后向前跳过紧邻的管理类条目使边界整洁；
 * 若切点不是 user 消息则视为切开一轮，需另行计算轮起点。
 * 参数 entries —— 路径条目；startIndex/endIndex —— 搜索区间；keepRecentTokens —— 近期保留预算。
 */
export function findCutPoint(
	entries: SessionTreeEntry[],
	startIndex: number,
	endIndex: number,
	keepRecentTokens: number,
): CutPointResult {
	const cutPoints = findValidCutPoints(entries, startIndex, endIndex);

	if (cutPoints.length === 0) {
		return { firstKeptEntryIndex: startIndex, turnStartIndex: -1, isSplitTurn: false };
	}
	let accumulatedTokens = 0;
	// 默认切到最早的合法点（尽量多压）
	let cutIndex = cutPoints[0];

	// 反向累计直到满足近期保留预算
	for (let i = endIndex - 1; i >= startIndex; i--) {
		const entry = entries[i];
		if (entry.type !== "message") continue;
		const messageTokens = estimateTokens(entry.message as AgentMessage);
		accumulatedTokens += messageTokens;
		if (accumulatedTokens >= keepRecentTokens) {
			for (let c = 0; c < cutPoints.length; c++) {
				if (cutPoints[c] >= i) {
					cutIndex = cutPoints[c];
					break;
				}
			}
			break;
		}
	}
	// 向前吞掉紧邻的非消息/非压缩条目，保持边界干净
	while (cutIndex > startIndex) {
		const prevEntry = entries[cutIndex - 1];
		if (prevEntry.type === "compaction") {
			break;
		}
		if (prevEntry.type === "message") {
			break;
		}
		cutIndex--;
	}
	const cutEntry = entries[cutIndex];
	const isUserMessage = cutEntry.type === "message" && cutEntry.message.role === "user";
	const turnStartIndex = isUserMessage ? -1 : findTurnStartIndex(entries, cutIndex, startIndex);

	return {
		firstKeptEntryIndex: cutIndex,
		turnStartIndex,
		isSplitTurn: !isUserMessage && turnStartIndex !== -1,
	};
}

// 摘要任务的系统提示词：只输出结构化摘要，不得续写对话
export const SUMMARIZATION_SYSTEM_PROMPT = `You are a context summarization assistant. Your task is to read a conversation between a user and an AI assistant, then produce a structured summary following the exact format specified.

Do NOT continue the conversation. Do NOT respond to any questions in the conversation. ONLY output the structured summary.`;

// 首次摘要提示词：规定 Goal/Constraints/Progress/Key Decisions/Next Steps/Critical Context 六节格式
const SUMMARIZATION_PROMPT = `The messages above are a conversation to summarize. Create a structured context checkpoint summary that another LLM will use to continue the work.

Use this EXACT format:

## Goal
[What is the user trying to accomplish? Can be multiple items if the session covers different tasks.]

## Constraints & Preferences
- [Any constraints, preferences, or requirements mentioned by user]
- [Or "(none)" if none were mentioned]

## Progress
### Done
- [x] [Completed tasks/changes]

### In Progress
- [ ] [Current work]

### Blocked
- [Issues preventing progress, if any]

## Key Decisions
- **[Decision]**: [Brief rationale]

## Next Steps
1. [Ordered list of what should happen next]

## Critical Context
- [Any data, examples, or references needed to continue]
- [Or "(none)" if not applicable]

Keep each section concise. Preserve exact file paths, function names, and error messages.`;

// 迭代更新摘要提示词：在 <previous-summary> 基础上合并新信息并遵循同样的六节格式
const UPDATE_SUMMARIZATION_PROMPT = `The messages above are NEW conversation messages to incorporate into the existing summary provided in <previous-summary> tags.

Update the existing structured summary with new information. RULES:
- PRESERVE all existing information from the previous summary
- ADD new progress, decisions, and context from the new messages
- UPDATE the Progress section: move items from "In Progress" to "Done" when completed
- UPDATE "Next Steps" based on what was accomplished
- PRESERVE exact file paths, function names, and error messages
- If something is no longer relevant, you may remove it

Use this EXACT format:

## Goal
[Preserve existing goals, add new ones if the task expanded]

## Constraints & Preferences
- [Preserve existing, add new ones discovered]

## Progress
### Done
- [x] [Include previously done items AND newly completed items]

### In Progress
- [ ] [Current work - update based on progress]

### Blocked
- [Current blockers - remove if resolved]

## Key Decisions
- **[Decision]**: [Brief rationale] (preserve all previous, add new)

## Next Steps
1. [Update based on current state]

## Critical Context
- [Preserve important context, add new if needed]

Keep each section concise. Preserve exact file paths, function names, and error messages.`;

/** Generate or update a conversation summary for compaction. */
/**
 * 生成或更新对话摘要（简化版，不含用量）（中文说明）：内部委托 generateSummaryWithUsage，
 * 只取文本部分。参数含义见该函数。返回 ok(摘要文本) 或 err(CompactionError)。
 */
export async function generateSummary(
	currentMessages: AgentMessage[],
	models: Models,
	model: Model<any>,
	reserveTokens: number,
	signal?: AbortSignal,
	customInstructions?: string,
	previousSummary?: string,
	thinkingLevel?: ThinkingLevel,
	retry?: RetryPolicy,
	callbacks?: RetryCallbacks,
): Promise<Result<string, CompactionError>> {
	const result = await generateSummaryWithUsage(
		currentMessages,
		models,
		model,
		reserveTokens,
		signal,
		customInstructions,
		previousSummary,
		thinkingLevel,
		retry,
		callbacks,
	);
	return result.ok ? ok(result.value.text) : err(result.error);
}

/** Generate or update a conversation summary and return its provider usage. */
/**
 * 生成或更新对话摘要（含用量）（中文说明）：
 * 流程：maxTokens=80%×reserveTokens → 选首次/更新提示词（可追加自定义关注点）→
 * convertToLlm + serializeConversation 组装 <conversation>（及可选 <previous-summary>）→
 * 带重试调用模型 → aborted/error 分别转错误码；成功返回文本与用量。
 * 参数 currentMessages 待摘要消息；models/model 摘要所用模型集合与模型；reserveTokens 预算；
 * signal 中止信号；customInstructions 自定义关注点；previousSummary 上次摘要；thinkingLevel 思考强度；
 * retry 重试策略；callbacks 重试回调。
 */
export async function generateSummaryWithUsage(
	currentMessages: AgentMessage[],
	models: Models,
	model: Model<any>,
	reserveTokens: number,
	signal?: AbortSignal,
	customInstructions?: string,
	previousSummary?: string,
	thinkingLevel?: ThinkingLevel,
	retry?: RetryPolicy,
	callbacks?: RetryCallbacks,
): Promise<Result<{ text: string; usage: Usage }, CompactionError>> {
	const maxTokens = Math.min(
		Math.floor(0.8 * reserveTokens),
		model.maxTokens > 0 ? model.maxTokens : Number.POSITIVE_INFINITY,
	);
	// 有旧摘要则走增量更新提示词
	let basePrompt = previousSummary ? UPDATE_SUMMARIZATION_PROMPT : SUMMARIZATION_PROMPT;
	if (customInstructions) {
		basePrompt = `${basePrompt}\n\nAdditional focus: ${customInstructions}`;
	}
	const llmMessages = convertToLlm(currentMessages);
	const conversationText = serializeConversation(llmMessages);
	// 组装最终提示词：对话稿（+可选旧摘要）+ 格式指令
	let promptText = `<conversation>\n${conversationText}\n</conversation>\n\n`;
	if (previousSummary) {
		promptText += `<previous-summary>\n${previousSummary}\n</previous-summary>\n\n`;
	}
	promptText += basePrompt;

	const summarizationMessages = [
		{
			role: "user" as const,
			content: [{ type: "text" as const, text: promptText }],
			timestamp: Date.now(),
		},
	];

	// 支持推理的模型且明确要求思考强度时才下发 reasoning
	const completionOptions =
		model.reasoning && thinkingLevel && thinkingLevel !== "off"
			? { maxTokens, signal, reasoning: thinkingLevel }
			: { maxTokens, signal };

	const response = await completeSimpleWithRetries(
		models,
		model,
		{ systemPrompt: SUMMARIZATION_SYSTEM_PROMPT, messages: summarizationMessages },
		completionOptions,
		retry,
		callbacks,
	);
	if (response.stopReason === "aborted") {
		return err(new CompactionError("aborted", response.errorMessage || "Summarization aborted"));
	}
	if (response.stopReason === "error") {
		return err(
			new CompactionError(
				"summarization_failed",
				`Summarization failed: ${response.errorMessage || "Unknown error"}`,
			),
		);
	}

	const textContent = contentText(response.content);

	return ok({ text: textContent, usage: response.usage });
}

/** Prepared inputs for a compaction run. */
/** 压缩准备数据（中文说明）：compact 执行所需的全部输入，由 prepareCompaction 产出。 */
export interface CompactionPreparation {
	/** Entry id where retained history starts. */
	// 保留历史的起始条目 ID
	firstKeptEntryId: string;
	/** Messages summarized into the history summary. */
	// 将被摘要为历史总结的消息
	messagesToSummarize: AgentMessage[];
	/** Prefix messages summarized separately when compaction splits a turn. */
	// 切开一轮时单独摘要的轮前缀消息
	turnPrefixMessages: AgentMessage[];
	/** Recent messages retained after compaction and stored on the compaction entry. */
	// 压缩后直接保留并存入条目的近期消息
	retainedTail: AgentMessage[];
	/** Whether compaction splits a turn. */
	// 是否切开了一轮
	isSplitTurn: boolean;
	/** Estimated context tokens before compaction. */
	// 压缩前的估算 token 数
	tokensBefore: number;
	/** Previous compaction summary used for iterative updates. */
	// 用于迭代更新的上一次摘要
	previousSummary?: string;
	/** File operations extracted from summarized history. */
	// 从被摘要历史提取的文件操作
	fileOps: FileOperations;
	/** Settings used to prepare compaction. */
	// 本次压缩使用的设置
	settings: CompactionSettings;
}

/** Prepare session entries for compaction, or return undefined when compaction is not applicable. */
/**
 * 准备压缩数据（中文说明）：
 * 空路径或末条已是压缩 → 返回 undefined（无需压缩）；
 * 否则定位上一次压缩确定摘要边界 → 估算 tokensBefore → findCutPoint 定切割点 →
 * 收集三类消息（待摘要/轮前缀/保留尾）→ 提取文件操作 → 返回准备数据。
 * 首保留条目缺 ID 时报 invalid_session。
 */
export function prepareCompaction(
	pathEntries: SessionTreeEntry[],
	settings: CompactionSettings,
): Result<CompactionPreparation | undefined, CompactionError> {
	if (pathEntries.length === 0 || pathEntries[pathEntries.length - 1].type === "compaction") {
		return ok(undefined);
	}

	// 从后向前找最近一次压缩
	let prevCompactionIndex = -1;
	for (let i = pathEntries.length - 1; i >= 0; i--) {
		if (pathEntries[i].type === "compaction") {
			prevCompactionIndex = i;
			break;
		}
	}

	let previousSummary: string | undefined;
	let boundaryStart = 0;
	if (prevCompactionIndex >= 0) {
		const prevCompaction = pathEntries[prevCompactionIndex] as CompactionEntry;
		previousSummary = prevCompaction.summary;
		const firstKeptEntryIndex = prevCompaction.firstKeptEntryId
			? pathEntries.findIndex((entry) => entry.id === prevCompaction.firstKeptEntryId)
			: -1;
		// 边界从上次保留起点开始；找不到则从压缩条目之后开始
		boundaryStart = firstKeptEntryIndex >= 0 ? firstKeptEntryIndex : prevCompactionIndex + 1;
	}
	const boundaryEnd = pathEntries.length;

	const tokensBefore = estimateContextTokens(buildSessionContext(pathEntries).messages).tokens;

	const cutPoint = findCutPoint(pathEntries, boundaryStart, boundaryEnd, settings.keepRecentTokens);
	const firstKeptEntry = pathEntries[cutPoint.firstKeptEntryIndex];
	if (!firstKeptEntry?.id) {
		return err(new CompactionError("invalid_session", "First kept entry has no UUID - session may need migration"));
	}
	const firstKeptEntryId = firstKeptEntry.id;

	// 切开轮时历史摘要止于轮起点，否则止于切点
	const historyEnd = cutPoint.isSplitTurn ? cutPoint.turnStartIndex : cutPoint.firstKeptEntryIndex;
	const messagesToSummarize: AgentMessage[] = [];
	for (let i = boundaryStart; i < historyEnd; i++) {
		const msg = getMessageFromEntryForCompaction(pathEntries[i]);
		if (msg) messagesToSummarize.push(msg);
	}
	// 切开轮时的前缀段（轮起点到切点之间）
	const turnPrefixMessages: AgentMessage[] = [];
	if (cutPoint.isSplitTurn) {
		for (let i = cutPoint.turnStartIndex; i < cutPoint.firstKeptEntryIndex; i++) {
			const msg = getMessageFromEntryForCompaction(pathEntries[i]);
			if (msg) turnPrefixMessages.push(msg);
		}
	}
	// 保留尾：切点到末尾的全部消息
	const retainedTail: AgentMessage[] = [];
	for (let i = cutPoint.firstKeptEntryIndex; i < boundaryEnd; i++) {
		const msg = getMessageFromEntryForCompaction(pathEntries[i]);
		if (msg) retainedTail.push(msg);
	}
	const fileOps = extractFileOperations(messagesToSummarize, pathEntries, prevCompactionIndex);
	if (cutPoint.isSplitTurn) {
		// 前缀段中的文件操作也并入统计
		for (const msg of turnPrefixMessages) {
			extractFileOpsFromMessage(msg, fileOps);
		}
	}

	return ok({
		firstKeptEntryId,
		messagesToSummarize,
		turnPrefixMessages,
		retainedTail,
		isSplitTurn: cutPoint.isSplitTurn,
		tokensBefore,
		previousSummary,
		fileOps,
		settings,
	});
}

// 轮前缀专用摘要提示词：聚焦原始请求、早期进展与理解后缀所需上下文
const TURN_PREFIX_SUMMARIZATION_PROMPT = `This is the PREFIX of a turn that was too large to keep. The SUFFIX (recent work) is retained.

Summarize the prefix to provide context for the retained suffix:

## Original Request
[What did the user ask for in this turn?]

## Early Progress
- [Key decisions and work done in the prefix]

## Context for Suffix
- [Information needed to understand the retained recent work]

Be concise. Focus on what's needed to understand the kept suffix.`;

// 重新导出序列化函数，方便从本模块统一引用
export { serializeConversation } from "./utils.ts";

/** Generate compaction summary data from prepared session history. */
/**
 * 执行压缩生成摘要（中文说明）：
 * - 普通情况：一次 generateSummaryWithUsage 生成（或迭代更新）摘要；
 * - 切开一轮：先生成历史摘要，再用 TURN_PREFIX_SUMMARIZATION_PROMPT 生成轮前缀摘要，
 *   两段拼接并以 "---" 分隔，用量合并。
 * 最后附加文件清单元信息标签并连同 details（readFiles/modifiedFiles）一并返回。
 */
export async function compact(
	preparation: CompactionPreparation,
	models: Models,
	model: Model<any>,
	customInstructions?: string,
	signal?: AbortSignal,
	thinkingLevel?: ThinkingLevel,
	retry?: RetryPolicy,
	callbacks?: RetryCallbacks,
): Promise<Result<CompactionResult, CompactionError>> {
	const {
		firstKeptEntryId,
		messagesToSummarize,
		turnPrefixMessages,
		retainedTail,
		isSplitTurn,
		tokensBefore,
		previousSummary,
		fileOps,
		settings,
	} = preparation;

	if (!firstKeptEntryId) {
		return err(new CompactionError("invalid_session", "First kept entry has no UUID - session may need migration"));
	}

	let summary: string;
	let summaryUsage: Usage;

	if (isSplitTurn && turnPrefixMessages.length > 0) {
		// 拆轮模式：历史摘要（可能为空提示占位）+ 轮前缀摘要
		let historyText = "No prior history.";
		let historyUsage: Usage | undefined;
		if (messagesToSummarize.length > 0) {
			const historyResult = await generateSummaryWithUsage(
				messagesToSummarize,
				models,
				model,
				settings.reserveTokens,
				signal,
				customInstructions,
				previousSummary,
				thinkingLevel,
				retry,
				callbacks,
			);
			if (!historyResult.ok) return err(historyResult.error);
			historyText = historyResult.value.text;
			historyUsage = historyResult.value.usage;
		}
		const turnPrefixResult = await generateTurnPrefixSummary(
			turnPrefixMessages,
			models,
			model,
			settings.reserveTokens,
			signal,
			thinkingLevel,
			retry,
			callbacks,
		);
		if (!turnPrefixResult.ok) return err(turnPrefixResult.error);
		summary = `${historyText}\n\n---\n\n**Turn Context (split turn):**\n\n${turnPrefixResult.value.text}`;
		summaryUsage = historyUsage
			? combineUsage(historyUsage, turnPrefixResult.value.usage)
			: turnPrefixResult.value.usage;
	} else {
		// 常规模式：单次摘要
		const summaryResult = await generateSummaryWithUsage(
			messagesToSummarize,
			models,
			model,
			settings.reserveTokens,
			signal,
			customInstructions,
			previousSummary,
			thinkingLevel,
			retry,
			callbacks,
		);
		if (!summaryResult.ok) return err(summaryResult.error);
		summary = summaryResult.value.text;
		summaryUsage = summaryResult.value.usage;
	}

	// 追加文件清单元信息
	const { readFiles, modifiedFiles } = computeFileLists(fileOps);
	summary += formatFileOperations(readFiles, modifiedFiles);

	return ok({
		summary,
		firstKeptEntryId,
		tokensBefore,
		usage: summaryUsage,
		retainedTail,
		details: { readFiles, modifiedFiles } as CompactionDetails,
	});
}

/**
 * 生成轮前缀摘要（私有）：流程与 generateSummaryWithUsage 类似，但使用轮前缀专属提示词，
 * maxTokens 取 reserveTokens 的 50%。返回文本与用量或错误。
 */
async function generateTurnPrefixSummary(
	messages: AgentMessage[],
	models: Models,
	model: Model<any>,
	reserveTokens: number,
	signal?: AbortSignal,
	thinkingLevel?: ThinkingLevel,
	retry?: RetryPolicy,
	callbacks?: RetryCallbacks,
): Promise<Result<{ text: string; usage: Usage }, CompactionError>> {
	const maxTokens = Math.min(
		Math.floor(0.5 * reserveTokens),
		model.maxTokens > 0 ? model.maxTokens : Number.POSITIVE_INFINITY,
	);
	const llmMessages = convertToLlm(messages);
	const conversationText = serializeConversation(llmMessages);
	const promptText = `<conversation>\n${conversationText}\n</conversation>\n\n${TURN_PREFIX_SUMMARIZATION_PROMPT}`;
	const summarizationMessages = [
		{
			role: "user" as const,
			content: [{ type: "text" as const, text: promptText }],
			timestamp: Date.now(),
		},
	];

	const completionOptions =
		model.reasoning && thinkingLevel && thinkingLevel !== "off"
			? { maxTokens, signal, reasoning: thinkingLevel }
			: { maxTokens, signal };
	const response = await completeSimpleWithRetries(
		models,
		model,
		{ systemPrompt: SUMMARIZATION_SYSTEM_PROMPT, messages: summarizationMessages },
		completionOptions,
		retry,
		callbacks,
	);
	if (response.stopReason === "aborted") {
		return err(new CompactionError("aborted", response.errorMessage || "Turn prefix summarization aborted"));
	}
	if (response.stopReason === "error") {
		return err(
			new CompactionError(
				"summarization_failed",
				`Turn prefix summarization failed: ${response.errorMessage || "Unknown error"}`,
			),
		);
	}

	return ok({
		text: contentText(response.content),
		usage: response.usage,
	});
}
