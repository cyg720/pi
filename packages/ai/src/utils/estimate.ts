/**
 * 【文件职责】上下文 token 估算：用"供应商精确用量 + 尾部启发式"合成上下文 token 估算，
 *              供压缩决策/界面显示等使用（不替代真实计价）。
 * 【技术维度】字符数/4 的启发式（文本 4 字符≈1 token，图片按 4800 字符当量）；
 *              最近有效助手用量回溯（考虑压缩摘要等前缀消息的时效性）；
 *              工具定义 JSON 化估算；新增工具名（deferred tools）补充计入。
 * 【产品维度】驱动"何时压缩历史"的判断与上下文占用展示，避免请求撑爆窗口。
 * 【逻辑维度】estimateMessageTokens 单条 → getLastAssistantUsageInfo 找最近有效用量 →
 *              estimateMessages 合成 → estimateContextTokens 补系统提示词/工具/新增工具。
 * 【关键边界】估算值是近似值，仅用于决策；aborted/error 消息的用量不采用；
 *              压缩摘要等更新的前缀消息会使其之前的助手用量失效。
 * 【新手阅读建议】先读 ContextUsageEstimate 字段含义 → 再读 estimateMessageTokens →
 *              最后看 estimateContextTokens 的合成逻辑。
 */
import type { AssistantMessage, Context, ImageContent, Message, TextContent, Tool, Usage } from "../types.ts";

/** 上下文用量估算结果（中文说明）：tokens 估算总量；usageTokens 最近有效用量；
 * trailingTokens 该用量之后消息的估算；lastUsageIndex 提供用量的消息下标（无则 null）。 */
export interface ContextUsageEstimate {
	/** Estimated total context tokens. */
	// 估算的总上下文 token 数
	tokens: number;
	/** Tokens reported by the most recent applicable assistant usage block. */
	// 最近适用的助手用量块报告的 token 数
	usageTokens: number;
	/** Estimated tokens after the most recent applicable assistant usage block. */
	// 该用量之后（尾部）消息的估算 token 数
	trailingTokens: number;
	/** Index of the applicable message that provided usage, or null when none exists. */
	// 提供用量的消息下标；无则 null
	lastUsageIndex: number | null;
}

// 每 token 的字符数启发式
const CHARS_PER_TOKEN = 4;
// 单张图片的字符当量
const ESTIMATED_IMAGE_CHARS = 4800;

// 由用量计算总上下文 token（公开）：优先 totalTokens，缺省四段相加
export function calculateContextTokens(usage: Usage): number {
	return usage.totalTokens || usage.input + usage.output + usage.cacheRead + usage.cacheWrite;
}

// 安全 JSON 序列化（私有）
function safeJsonStringify(value: unknown): string {
	try {
		return JSON.stringify(value) ?? "undefined";
	} catch {
		return "[unserializable]";
	}
}

// 文本/图片内容字符量估算（私有）：文本按长度、图片按当量
function estimateTextAndImageContentChars(content: string | Array<TextContent | ImageContent>): number {
	if (typeof content === "string") return content.length;

	let chars = 0;
	for (const block of content) chars += block.type === "text" ? block.text.length : ESTIMATED_IMAGE_CHARS;
	return chars;
}

// 纯文本 token 估算（公开）：字符数/4 向上取整
export function estimateTextTokens(text: string): number {
	return Math.ceil(text.length / CHARS_PER_TOKEN);
}

// 文本/图片内容 token 估算（公开）
export function estimateTextAndImageContentTokens(content: string | Array<TextContent | ImageContent>): number {
	return Math.ceil(estimateTextAndImageContentChars(content) / CHARS_PER_TOKEN);
}

// 单条消息 token 估算（公开）：user/toolResult 统计文本+图片；
// assistant 统计正文+思考+工具调用（参数 JSON 化）
export function estimateMessageTokens(message: Message): number {
	let chars = 0;

	if (message.role === "user") return estimateTextAndImageContentTokens(message.content);
	if (message.role === "toolResult") return estimateTextAndImageContentTokens(message.content);

	for (const block of message.content) {
		if (block.type === "text") {
			chars += block.text.length;
		} else if (block.type === "thinking") {
			chars += block.thinking.length;
		} else {
			chars += block.name.length + safeJsonStringify(block.arguments).length;
		}
	}
	return Math.ceil(chars / CHARS_PER_TOKEN);
}

// 找最近"适用于当前前缀"的助手用量（私有）：跳过 aborted/error 与零用量；
// 压缩摘要等更新的前缀消息会让其之前的助手用量失效（timestamp 判定）
function getLastAssistantUsageInfo(messages: readonly Message[]): { usage: Usage; index: number } | undefined {
	let latestPrefixTimestamp = Number.NEGATIVE_INFINITY;
	let usageInfo: { usage: Usage; index: number } | undefined;

	for (let i = 0; i < messages.length; i++) {
		const message = messages[i];
		if (message.role === "assistant") {
			const assistant = message as AssistantMessage;
			// A newer prefix message was inserted after this response (for example, a
			// compaction summary), so its usage cannot describe the current prefix.
			const usageAppliesToPrefix = assistant.timestamp >= latestPrefixTimestamp;
			if (
				usageAppliesToPrefix &&
				assistant.stopReason !== "aborted" &&
				assistant.stopReason !== "error" &&
				calculateContextTokens(assistant.usage) > 0
			) {
				usageInfo = { usage: assistant.usage, index: i };
			}
		}
		latestPrefixTimestamp = Math.max(latestPrefixTimestamp, message.timestamp);
	}

	return usageInfo;
}

// 消息数组估算（私有）：有有效用量则"精确值+尾部估算"；否则全量启发式
function estimateMessages(messages: readonly Message[]): ContextUsageEstimate {
	const usageInfo = getLastAssistantUsageInfo(messages);
	if (usageInfo) {
		const usageTokens = calculateContextTokens(usageInfo.usage);
		let trailingTokens = 0;
		for (let i = usageInfo.index + 1; i < messages.length; i++) {
			trailingTokens += estimateMessageTokens(messages[i]);
		}
		return { tokens: usageTokens + trailingTokens, usageTokens, trailingTokens, lastUsageIndex: usageInfo.index };
	}

	let tokens = 0;
	for (const message of messages) tokens += estimateMessageTokens(message);
	return { tokens, usageTokens: 0, trailingTokens: tokens, lastUsageIndex: null };
}

// 工具定义 token 估算（私有）：整体 JSON 化后按文本估算
function estimateToolsTokens(tools: readonly Tool[] | undefined): number {
	if (!tools || tools.length === 0) return 0;
	return estimateTextTokens(safeJsonStringify(tools));
}

// 类型守卫：Context 还是消息数组（私有）
function isMessageArray(value: Context | readonly Message[]): value is readonly Message[] {
	return Array.isArray(value);
}

// 估算上下文 token（公开）：消息数组或 Context（含系统提示词/工具）；
// 有有效用量时额外计入"新增工具"（deferred tools）的补充 token
export function estimateContextTokens(context: Context | readonly Message[]): ContextUsageEstimate {
	if (isMessageArray(context)) return estimateMessages(context);

	const estimate = estimateMessages(context.messages);
	if (estimate.lastUsageIndex !== null) {
		// 统计用量之后工具结果引入的新工具名，为其补充估算
		const addedNames = new Set(
			context.messages
				.slice(estimate.lastUsageIndex + 1)
				.filter((message) => message.role === "toolResult")
				.flatMap((message) => message.addedToolNames ?? []),
		);
		const addedToolTokens = estimateToolsTokens(context.tools?.filter((tool) => addedNames.has(tool.name)));
		return {
			tokens: estimate.tokens + addedToolTokens,
			usageTokens: estimate.usageTokens,
			trailingTokens: estimate.trailingTokens + addedToolTokens,
			lastUsageIndex: estimate.lastUsageIndex,
		};
	}

	// 无有效用量：系统提示词 + 工具定义 补入前缀
	const prefixTokens =
		(context.systemPrompt ? estimateTextTokens(context.systemPrompt) : 0) + estimateToolsTokens(context.tools);

	return {
		tokens: estimate.tokens + prefixTokens,
		usageTokens: estimate.usageTokens,
		trailingTokens: estimate.trailingTokens + prefixTokens,
		lastUsageIndex: estimate.lastUsageIndex,
	};
}
