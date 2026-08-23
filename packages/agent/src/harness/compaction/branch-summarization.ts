/**
 * 【文件职责】分支摘要（branch summarization）的实现：当用户从会话树的一个分支跳回另一分支时，
 *              收集被“遗落”分支的条目，在 token 预算内准备数据，并调用摘要模型生成结构化分支摘要。
 * 【技术维度】公共祖先计算（两条树路径的最近交汇点）；逆序预算装箱（从最新往旧收，保留边界摘要）；
 *              复用 compaction 的估算/序列化/重试补全设施。
 * 【产品维度】支撑“分支探索后返回”的体验：切换分支不会丢失探索过程的关键结论，
 *              摘要以 <branch-summary> 形式注入新位置，模型可继续衔接工作。
 * 【逻辑维度】collectEntriesForBranchSummary 找公共祖先并收集区间条目 → prepareBranchEntries 在预算内
 *              选消息并继承文件操作 → generateBranchSummary 组装提示词调用模型 → 结果带文件清单。
 * 【关键边界】toolResult 不参与摘要；token 预算默认 = 上下文窗口 - 16384；输出上限固定 2048 token；
 *              无内容时返回 "No content to summarize"；中止与失败分别映射错误码。
 * 【新手阅读建议】先看 BranchPreparation/CollectEntriesResult 两个结构 → 再读 collectEntriesForBranchSummary
 *              的祖先算法 → 最后读 prepareBranchEntries 的预算裁剪规则。
 */
import { contentText, type Model, type Models, type RetryCallbacks, type RetryPolicy } from "@earendil-works/pi-ai";

import type { AgentMessage } from "../../types.ts";
import {
	convertToLlm,
	createBranchSummaryMessage,
	createCompactionSummaryMessage,
	createCustomMessage,
} from "../messages.ts";
import type { BranchSummaryResult, Session, SessionTreeEntry } from "../types.ts";
import { BranchSummaryError, err, ok, type Result, SessionError } from "../types.ts";
import { completeSimpleWithRetries, estimateTokens, SUMMARIZATION_SYSTEM_PROMPT } from "./compaction.ts";
import {
	computeFileLists,
	createFileOps,
	extractFileOpsFromMessage,
	type FileOperations,
	formatFileOperations,
	serializeConversation,
} from "./utils.ts";

/** File-operation details stored on generated branch summary entries. */
/** 分支摘要条目的详情结构（中文说明）：随条目持久化的文件清单，供后续摘要继承。 */
export interface BranchSummaryDetails {
	/** Files read while exploring the summarized branch. */
	// 探索该分支期间读取过的文件
	readFiles: string[];
	/** Files modified while exploring the summarized branch. */
	// 探索该分支期间修改过的文件
	modifiedFiles: string[];
}

// 重新导出 FileOperations 类型
export type { FileOperations } from "./utils.ts";

/** Prepared branch content for summarization. */
/** 分支摘要准备数据（中文说明）：选出的消息、提取的文件操作与估算总 token。 */
export interface BranchPreparation {
	/** Messages selected for the branch summary. */
	// 参与摘要的消息（时间顺序）
	messages: AgentMessage[];
	/** File operations extracted from the branch. */
	// 从该分支提取的文件操作
	fileOps: FileOperations;
	/** Estimated token count for selected messages. */
	// 选中消息的估算 token 总量
	totalTokens: number;
}

/** Entries selected for branch summarization. */
/** 条目收集结果（中文说明）：待摘要条目（按时间顺序）与新旧叶子的最深公共祖先 ID。 */
export interface CollectEntriesResult {
	/** Entries to summarize in chronological order. */
	entries: SessionTreeEntry[];
	/** Deepest common ancestor between the previous leaf and target entry. */
	commonAncestorId: string | null;
}

/** Options for generating a branch summary. */
/** 分支摘要生成选项（中文说明）：模型集合/模型、中止信号、指令定制（追加或替换）、预留 token 与重试配置。 */
export interface GenerateBranchSummaryOptions {
	/** Provider collection the summarization request goes through; owns auth resolution. */
	// 摘要请求经过的供应商集合（负责认证解析）
	models: Models;
	/** Model used for summarization. */
	// 摘要使用的模型
	model: Model<any>;
	/** Abort signal for the summarization request. */
	// 中止信号
	signal: AbortSignal;
	/** Optional instructions appended to or replacing the default prompt. */
	// 自定义指令：默认追加到默认提示词之后
	customInstructions?: string;
	/** Replace the default prompt with custom instructions instead of appending them. */
	// 为 true 且提供自定义指令时整体替换默认提示词
	replaceInstructions?: boolean;
	/** Tokens reserved for prompt and model output. Defaults to 16384. */
	// 提示与输出的预留 token；默认 16384
	reserveTokens?: number;
	/** Optional retry policy for transient summarization errors. */
	// 瞬态错误的可选重试策略
	retry?: RetryPolicy;
	/** Optional callbacks for retry reporting. */
	// 重试上报回调
	callbacks?: RetryCallbacks;
}

/** Collect entries that should be summarized before navigating to a different session tree entry. */
/**
 * 收集需要摘要的分支条目（中文说明）：
 * 计算旧叶子路径与目标路径的最深公共祖先，再从旧叶子沿 parent 链回溯至祖先，
 * 收集其间全部条目并反转为时间顺序。oldLeafId 为空表示无历史可摘要。
 * 参数 session —— 会话对象；oldLeafId —— 原叶子；targetId —— 要跳转到的目标条目。
 */
export async function collectEntriesForBranchSummary(
	session: Session,
	oldLeafId: string | null,
	targetId: string,
): Promise<CollectEntriesResult> {
	if (!oldLeafId) {
		return { entries: [], commonAncestorId: null };
	}
	// 旧叶子路径上的全部条目 ID 集合
	const oldPath = new Set((await session.getBranch(oldLeafId)).map((e) => e.id));
	const targetPath = await session.getBranch(targetId);
	let commonAncestorId: string | null = null;
	for (let i = targetPath.length - 1; i >= 0; i--) {
		if (oldPath.has(targetPath[i].id)) {
			commonAncestorId = targetPath[i].id;
			break;
		}
	}
	const entries: SessionTreeEntry[] = [];
	let current: string | null = oldLeafId;

	while (current && current !== commonAncestorId) {
		const entry = await session.getEntry(current);
		if (!entry) throw new SessionError("invalid_session", `Entry ${current} not found`);
		entries.push(entry as SessionTreeEntry);
		current = entry.parentId;
	}
	// 反转为时间正序
	entries.reverse();

	return { entries, commonAncestorId };
}

/**
 * 条目 → 消息（私有，供摘要用）：message 中排除 toolResult；
 * custom_message/branch_summary/compaction 分别还原为对应消息；管理类条目忽略。
 */
function getMessageFromEntry(entry: SessionTreeEntry): AgentMessage | undefined {
	switch (entry.type) {
		case "message":
			if (entry.message.role === "toolResult") return undefined;
			return entry.message;

		case "custom_message":
			return createCustomMessage(entry.customType, entry.content, entry.display, entry.details, entry.timestamp);

		case "branch_summary":
			return createBranchSummaryMessage(entry.summary, entry.fromId, entry.timestamp);

		case "compaction":
			return createCompactionSummaryMessage(entry.summary, entry.tokensBefore, entry.timestamp);
		case "thinking_level_change":
		case "model_change":
		case "active_tools_change":
		case "custom":
		case "label":
		case "session_info":
		case "leaf":
			return undefined;
	}
}

/** Prepare branch entries for summarization within an optional token budget. */
/**
 * 在 token 预算内准备分支摘要数据（中文说明）：
 * 先继承非钩子产生的既有分支摘要中的文件清单基线；再从最新向最旧逐条转换消息并累计估算 token——
 * 超出预算即停止，但若边界恰是压缩/分支摘要条目且已用不足预算九成则仍收入该边界摘要。
 * 参数 entries —— 待处理条目（时间序）；tokenBudget —— 预算（0 表示不限制）。
 */
export function prepareBranchEntries(entries: SessionTreeEntry[], tokenBudget: number = 0): BranchPreparation {
	const messages: AgentMessage[] = [];
	const fileOps = createFileOps();
	let totalTokens = 0;
	// 第一遍：继承既有分支摘要记录的文件操作
	for (const entry of entries) {
		if (entry.type === "branch_summary" && !entry.fromHook && entry.details) {
			const details = entry.details as BranchSummaryDetails;
			if (Array.isArray(details.readFiles)) {
				for (const f of details.readFiles) fileOps.read.add(f);
			}
			if (Array.isArray(details.modifiedFiles)) {
				for (const f of details.modifiedFiles) {
					fileOps.edited.add(f);
				}
			}
		}
	}
	// 第二遍：从新到旧装箱
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		const message = getMessageFromEntry(entry);
		if (!message) continue;
		extractFileOpsFromMessage(message, fileOps);

		const tokens = estimateTokens(message);
		if (tokenBudget > 0 && totalTokens + tokens > tokenBudget) {
			// 超预算：仅当边界是压缩/分支摘要且余量充足时才收入，随后截断
			if (entry.type === "compaction" || entry.type === "branch_summary") {
				if (totalTokens < tokenBudget * 0.9) {
					messages.unshift(message);
					totalTokens += tokens;
				}
			}
			break;
		}

		messages.unshift(message);
		totalTokens += tokens;
	}

	return { messages, fileOps, totalTokens };
}

// 摘要正文前缀：说明这是对“返回前所探索分支”的总结
const BRANCH_SUMMARY_PREAMBLE = `The user explored a different conversation branch before returning here.
Summary of that exploration:

`;

// 分支摘要提示词：规定 Goal/Constraints/Progress/Key Decisions/Next Steps 五节格式
const BRANCH_SUMMARY_PROMPT = `Create a structured summary of this conversation branch for context when returning later.

Use this EXACT format:

## Goal
[What was the user trying to accomplish in this branch?]

## Constraints & Preferences
- [Any constraints, preferences, or requirements mentioned]
- [Or "(none)" if none were mentioned]

## Progress
### Done
- [x] [Completed tasks/changes]

### In Progress
- [ ] [Work that was started but not finished]

### Blocked
- [Issues preventing progress, if any]

## Key Decisions
- **[Decision]**: [Brief rationale]

## Next Steps
1. [What should happen next to continue this work]

Keep each section concise. Preserve exact file paths, function names, and error messages.`;

/** Generate a summary for abandoned branch entries. */
/**
 * 生成分支摘要（中文说明）：
 * 流程：预算=上下文窗口-reserveTokens → prepareBranchEntries 选消息 → 空则返回占位结果 →
 * serializeConversation 组装 <conversation> + 指令（支持追加/替换）→ maxTokens 固定 2048 调用模型 →
 * aborted/error 转错误码 → 成功则加 PREAMBLE 与文件清单标签返回。
 * 参数 entries —— 待摘要条目；options —— 生成选项。
 */
export async function generateBranchSummary(
	entries: SessionTreeEntry[],
	options: GenerateBranchSummaryOptions,
): Promise<Result<BranchSummaryResult, BranchSummaryError>> {
	const {
		models,
		model,
		signal,
		customInstructions,
		replaceInstructions,
		reserveTokens = 16384,
		retry,
		callbacks,
	} = options;
	const contextWindow = model.contextWindow || 128000;
	const tokenBudget = contextWindow - reserveTokens;

	const { messages, fileOps } = prepareBranchEntries(entries, tokenBudget);

	if (messages.length === 0) {
		return ok({ summary: "No content to summarize", readFiles: [], modifiedFiles: [] });
	}
	const llmMessages = convertToLlm(messages);
	const conversationText = serializeConversation(llmMessages);
	// 指令选择：替换 / 追加 / 默认
	let instructions: string;
	if (replaceInstructions && customInstructions) {
		instructions = customInstructions;
	} else if (customInstructions) {
		instructions = `${BRANCH_SUMMARY_PROMPT}\n\nAdditional focus: ${customInstructions}`;
	} else {
		instructions = BRANCH_SUMMARY_PROMPT;
	}
	const promptText = `<conversation>\n${conversationText}\n</conversation>\n\n${instructions}`;

	const summarizationMessages = [
		{
			role: "user" as const,
			content: [{ type: "text" as const, text: promptText }],
			timestamp: Date.now(),
		},
	];
	const response = await completeSimpleWithRetries(
		models,
		model,
		{ systemPrompt: SUMMARIZATION_SYSTEM_PROMPT, messages: summarizationMessages },
		{ signal, maxTokens: 2048 },
		retry,
		callbacks,
	);
	if (response.stopReason === "aborted") {
		return err(new BranchSummaryError("aborted", response.errorMessage || "Branch summary aborted"));
	}
	if (response.stopReason === "error") {
		return err(
			new BranchSummaryError(
				"summarization_failed",
				`Branch summary failed: ${response.errorMessage || "Unknown error"}`,
			),
		);
	}

	let summary = contentText(response.content);
	summary = BRANCH_SUMMARY_PREAMBLE + summary;
	const { readFiles, modifiedFiles } = computeFileLists(fileOps);
	summary += formatFileOperations(readFiles, modifiedFiles);

	return ok({
		summary: summary || "No summary generated",
		usage: response.usage,
		readFiles,
		modifiedFiles,
	});
}
