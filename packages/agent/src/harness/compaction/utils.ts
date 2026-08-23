/**
 * 【文件职责】压缩（compaction）与分支摘要的辅助工具：统计会话涉及的文件操作、
 *              把文件清单格式化为摘要元信息，以及把 LLM 消息序列序列化为纯文本供摘要模型阅读。
 * 【技术维度】Set 聚合去重；防御式遍历消息内容块；JSON 安全序列化；超长文本截断。
 * 【产品维度】让自动生成的“历史摘要”包含关键上下文（读过/改过哪些文件、对话说了什么），
 *              压缩后模型仍能了解此前工作脉络。
 * 【逻辑维度】FileOperations 三类集合的创建/提取/汇总 → formatFileOperations 生成 XML 风格标签 →
 *              serializeConversation 按 [User]/[Assistant]/[Tool result] 分节拼装纯文本。
 * 【关键边界】仅识别 read/write/edit 三种工具名且参数需含字符串 path；工具结果超 2000 字符截断；
 *              无法 JSON 序列化的值显示为 [unserializable]。
 * 【新手阅读建议】先看 FileOperations 与三个文件操作函数 → 再读 serializeConversation 理解摘要输入的样子。
 */
import { contentText, type Message } from "@earendil-works/pi-ai";
import type { AgentMessage } from "../../types.ts";

/** File paths touched by a session branch or compaction range. */
/** 文件操作记录（中文说明）：某段会话/压缩范围内触及的文件路径集合，按操作类型分组。 */
export interface FileOperations {
	/** Files read but not necessarily modified. */
	// 只读过的文件（不一定被修改）
	read: Set<string>;
	/** Files written by full-file write operations. */
	// 被 write 工具整体写入的文件
	written: Set<string>;
	/** Files modified by edit operations. */
	// 被 edit 工具局部修改的文件
	edited: Set<string>;
}

/** Create an empty file-operation accumulator. */
// 创建空的文件操作累积器：三个集合均为空
export function createFileOps(): FileOperations {
	return {
		read: new Set(),
		written: new Set(),
		edited: new Set(),
	};
}

/** Add file operations from assistant tool calls to an accumulator. */
/**
 * 从助手消息的工具调用中提取文件操作并并入累积器（中文说明）：
 * 只处理 assistant 消息中带 path 参数的 toolCall 内容块；
 * 按工具名分流——read→read 集合、write→written、edit→edited，其余忽略。
 * 参数 message —— 待分析的代理消息；fileOps —— 目标累积器。
 */
export function extractFileOpsFromMessage(message: AgentMessage, fileOps: FileOperations): void {
	if (message.role !== "assistant") return;
	if (!("content" in message) || !Array.isArray(message.content)) return;

	for (const block of message.content) {
		// 跳过非对象或非工具调用块
		if (typeof block !== "object" || block === null) continue;
		if (!("type" in block) || block.type !== "toolCall") continue;
		if (!("arguments" in block) || !("name" in block)) continue;

		const args = block.arguments as Record<string, unknown> | undefined;
		if (!args) continue;

		const path = typeof args.path === "string" ? args.path : undefined;
		if (!path) continue;

		switch (block.name) {
			case "read":
				fileOps.read.add(path);
				break;
			case "write":
				fileOps.written.add(path);
				break;
			case "edit":
				fileOps.edited.add(path);
				break;
		}
	}
}

/** Compute sorted read-only and modified file lists from accumulated operations. */
/**
 * 计算只读与已修改文件清单（中文说明）：modified = edited ∪ written；
 * readOnly 为 read 中未被修改的部分；两组均按字母排序。返回 { readFiles, modifiedFiles }。
 */
export function computeFileLists(fileOps: FileOperations): { readFiles: string[]; modifiedFiles: string[] } {
	const modified = new Set([...fileOps.edited, ...fileOps.written]);
	const readOnly = [...fileOps.read].filter((f) => !modified.has(f)).sort();
	const modifiedFiles = [...modified].sort();
	return { readFiles: readOnly, modifiedFiles };
}

/** Format file lists as summary metadata tags. */
/**
 * 把文件清单格式化为摘要附带的元信息标签（中文说明）：
 * 分别生成 <read-files> 与 <modified-files> XML 块；两组皆空时返回空串；
 * 有内容时以两个换行开头便于拼接在摘要正文之后。
 */
export function formatFileOperations(readFiles: string[], modifiedFiles: string[]): string {
	const sections: string[] = [];
	if (readFiles.length > 0) {
		sections.push(`<read-files>\n${readFiles.join("\n")}\n</read-files>`);
	}
	if (modifiedFiles.length > 0) {
		sections.push(`<modified-files>\n${modifiedFiles.join("\n")}\n</modified-files>`);
	}
	if (sections.length === 0) return "";
	return `\n\n${sections.join("\n\n")}`;
}

// 工具结果进入摘要时的最大字符数
const TOOL_RESULT_MAX_CHARS = 2000;

// 安全的 JSON 序列化（私有）：失败时返回 [unserializable]，undefined 显示为字面量
function safeJsonStringify(value: unknown): string {
	try {
		return JSON.stringify(value) ?? "undefined";
	} catch {
		return "[unserializable]";
	}
}

// 截断文本到 maxChars 并附加省略提示（私有）：注明被丢弃的字符数
function truncateForSummary(text: string, maxChars: number): string {
	if (text.length <= maxChars) return text;
	const truncatedChars = text.length - maxChars;
	return `${text.slice(0, maxChars)}\n\n[... ${truncatedChars} more characters truncated]`;
}

/** Serialize LLM messages to plain text for summarization prompts. */
/**
 * 把 LLM 消息序列化为纯文本对话稿（中文说明）：作为摘要模型的输入——
 * user → [User]:；assistant 依次输出思考、正文、工具调用三段；toolResult → [Tool result]:（超长截断）。
 * 各段之间以空行分隔；无内容的消息跳过。参数 messages —— 标准消息数组；返回拼接后的文本。
 */
export function serializeConversation(messages: Message[]): string {
	const parts: string[] = [];

	for (const msg of messages) {
		if (msg.role === "user") {
			// 用户消息：取纯文本内容
			const content = contentText(msg.content, "");
			if (content) parts.push(`[User]: ${content}`);
		} else if (msg.role === "assistant") {
			// 助手消息：分别收集思考与工具调用
			const thinkingParts: string[] = [];
			const toolCalls: string[] = [];

			for (const block of msg.content) {
				if (block.type === "thinking") {
					thinkingParts.push(block.thinking);
				} else if (block.type === "toolCall") {
					// 参数序列化为 k=v 形式
					const args = block.arguments as Record<string, unknown>;
					const argsStr = Object.entries(args)
						.map(([k, v]) => `${k}=${safeJsonStringify(v)}`)
						.join(", ");
					toolCalls.push(`${block.name}(${argsStr})`);
				}
			}

			if (thinkingParts.length > 0) {
				parts.push(`[Assistant thinking]: ${thinkingParts.join("\n")}`);
			}
			if (msg.content.some((block) => block.type === "text")) {
				parts.push(`[Assistant]: ${contentText(msg.content)}`);
			}
			if (toolCalls.length > 0) {
				parts.push(`[Assistant tool calls]: ${toolCalls.join("; ")}`);
			}
		} else if (msg.role === "toolResult") {
			// 工具结果：超过上限则截断
			const content = contentText(msg.content, "");
			if (content) {
				parts.push(`[Tool result]: ${truncateForSummary(content, TOOL_RESULT_MAX_CHARS)}`);
			}
		}
	}

	return parts.join("\n\n");
}
