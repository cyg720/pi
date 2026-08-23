/**
 * 【文件职责】定义 Harness 层的扩展消息体系：bash 执行记录、自定义消息、分支摘要、压缩摘要四类 AgentMessage，
 *              通过声明合并注册进 CustomAgentMessages，并提供它们 → 标准 LLM 消息的转换函数。
 * 【技术维度】TS 接口 + declare module 声明合并（扩展类型联合）；模板字符串常量做摘要包裹；
 *              纯函数式的 convertToLlm 映射与过滤。
 * 【产品维度】让“终端命令输出、UI 通知、历史压缩/分支摘要”都能进入统一会话流，模型据此理解此前发生过什么。
 * 【逻辑维度】先声明四类消息接口 → 注册到 CustomAgentMessages → 提供各自工厂函数 →
 *              convertToLlm 把它们映射为 user 消息（或过滤掉）。
 * 【关键边界】excludeFromContext 的 bash 记录不会进入 LLM；未知角色默认丢弃；摘要前后缀必须成对使用。
 * 【新手阅读建议】先看四个 interface 了解消息形状，再看 convertToLlm 理解它们如何变成模型可见内容。
 */
import type { ImageContent, Message, TextContent } from "@earendil-works/pi-ai";
import type { AgentMessage } from "../types.ts";

// 压缩摘要前缀：告诉模型“此前的对话历史已被压缩为以下摘要”，以 <summary> 标签开始
export const COMPACTION_SUMMARY_PREFIX = `The conversation history before this point was compacted into the following summary:

<summary>
`;

// 压缩摘要后缀：<summary> 标签结束（与前缀成对使用）
export const COMPACTION_SUMMARY_SUFFIX = `
</summary>`;

// 分支摘要前缀：说明“以下是从某分支返回时的摘要”，以 <summary> 标签开始
export const BRANCH_SUMMARY_PREFIX = `The following is a summary of a branch that this conversation came back from:

<summary>
`;

// 分支摘要后缀：</summary> 标签结束
export const BRANCH_SUMMARY_SUFFIX = `</summary>`;

/**
 * bash 执行消息（中文说明）：记录一次本地 shell 命令的执行情况，
 * 用于把命令行为写入会话流，让模型/用户了解执行过什么命令及结果。
 */
export interface BashExecutionMessage {
	// 固定角色标识："bashExecution"
	role: "bashExecution";
	// 执行的命令文本
	command: string;
	// 命令输出内容（可能被截断）
	output: string;
	// 退出码；取消或未退出时为 undefined
	exitCode: number | undefined;
	// 是否被用户取消
	cancelled: boolean;
	// 输出是否被截断
	truncated: boolean;
	// 截断时完整输出的落盘路径（可选）
	fullOutputPath?: string;
	// 毫秒时间戳
	timestamp: number;
	// 为 true 时该消息不进入 LLM 上下文（仅供 UI 展示）
	excludeFromContext?: boolean;
}

/**
 * 自定义消息（中文说明）：应用注入的通用私有消息，可携带任意 details；
 * display 控制是否在 UI 中显示，content 会原样转为 user 文本进入上下文。
 */
export interface CustomMessage<T = unknown> {
	// 固定角色标识："custom"
	role: "custom";
	// 自定义类型名，用于区分不同用途
	customType: string;
	// 内容：纯字符串或文本/图片内容块数组
	content: string | (TextContent | ImageContent)[];
	// 是否在 UI 中展示
	display: boolean;
	// 附加结构化数据（不进入 LLM）
	details?: T;
	// 毫秒时间戳
	timestamp: number;
}

/**
 * 分支摘要消息（中文说明）：从某个分支返回主线时插入的摘要说明，
 * fromId 标记来源分支节点，帮助模型理解“绕路”的历史。
 */
export interface BranchSummaryMessage {
	// 固定角色标识："branchSummary"
	role: "branchSummary";
	// 摘要正文
	summary: string;
	// 来源分支节点 ID
	fromId: string;
	// 毫秒时间戳
	timestamp: number;
}

/** 压缩摘要消息（中文说明）：历史压缩后插入的摘要；tokensBefore 记录压缩前的 token 规模。 */
export interface CompactionSummaryMessage {
	// 固定角色标识："compactionSummary"
	role: "compactionSummary";
	// 摘要正文
	summary: string;
	// 压缩前的 token 数量
	tokensBefore: number;
	// 毫秒时间戳
	timestamp: number;
}

// 通过声明合并把上述四类消息注册进 AgentMessage 联合类型
declare module "../types.ts" {
	interface CustomAgentMessages {
		bashExecution: BashExecutionMessage;
		custom: CustomMessage;
		branchSummary: BranchSummaryMessage;
		compactionSummary: CompactionSummaryMessage;
	}
}

/**
 * 把 bash 执行消息渲染为文本（中文说明）：依次拼出命令、输出代码块、取消/退出码说明、截断提示。
 * 参数 msg —— bash 执行消息；返回可直接放进 user 内容的文本。
 */
export function bashExecutionToText(msg: BashExecutionMessage): string {
	// 先写执行的命令
	let text = `Ran \`${msg.command}\`\n`;
	if (msg.output) {
		// 有输出则放入代码块
		text += `\`\`\`\n${msg.output}\n\`\`\``;
	} else {
		text += "(no output)";
	}
	if (msg.cancelled) {
		// 被取消的标注
		text += "\n\n(command cancelled)";
	} else if (msg.exitCode !== null && msg.exitCode !== undefined && msg.exitCode !== 0) {
		// 非零退出码标注
		text += `\n\nCommand exited with code ${msg.exitCode}`;
	}
	if (msg.truncated && msg.fullOutputPath) {
		// 截断时提示完整输出位置
		text += `\n\n[Output truncated. Full output: ${msg.fullOutputPath}]`;
	}
	return text;
}

/**
 * 创建分支摘要消息（中文说明）：参数 summary —— 摘要正文；fromId —— 来源分支节点 ID；
 * timestamp —— ISO 时间字符串（内部转毫秒数）。返回 BranchSummaryMessage。
 */
export function createBranchSummaryMessage(summary: string, fromId: string, timestamp: string): BranchSummaryMessage {
	return {
		role: "branchSummary",
		summary,
		fromId,
		timestamp: new Date(timestamp).getTime(),
	};
}

/**
 * 创建压缩摘要消息（中文说明）：参数 summary —— 摘要正文；tokensBefore —— 压缩前 token 数；
 * timestamp —— ISO 时间字符串。返回 CompactionSummaryMessage。
 */
export function createCompactionSummaryMessage(
	summary: string,
	tokensBefore: number,
	timestamp: string,
): CompactionSummaryMessage {
	return {
		role: "compactionSummary",
		summary,
		tokensBefore,
		timestamp: new Date(timestamp).getTime(),
	};
}

/**
 * 创建自定义消息（中文说明）：参数 customType —— 类型名；content —— 字符串或内容块数组；
 * display —— 是否 UI 展示；details —— 附加数据；timestamp —— ISO 时间字符串。返回 CustomMessage。
 */
export function createCustomMessage(
	customType: string,
	content: string | (TextContent | ImageContent)[],
	display: boolean,
	details: unknown | undefined,
	timestamp: string,
): CustomMessage {
	return {
		role: "custom",
		customType,
		content,
		display,
		details,
		timestamp: new Date(timestamp).getTime(),
	};
}

/**
 * Harness 默认的 convertToLlm 实现（中文说明）：把各类扩展消息转换为标准 LLM 消息——
 * bashExecution 转为 user 文本（excludeFromContext 则丢弃）、custom 转 user、
 * 两类摘要用前后缀包成 user 文本；user/assistant/toolResult 原样通过；其余未知角色丢弃。
 * 参数 messages —— 代理层消息；返回仅含标准角色的 Message[]。
 */
export function convertToLlm(messages: AgentMessage[]): Message[] {
	return messages
		.map((m): Message | undefined => {
			switch (m.role) {
				case "bashExecution":
					// 标记排除的不进上下文
					if (m.excludeFromContext) {
						return undefined;
					}
					return {
						role: "user",
						content: [{ type: "text", text: bashExecutionToText(m) }],
						timestamp: m.timestamp,
					};
				case "custom": {
					// 字符串内容包装成单个文本块
					const content = typeof m.content === "string" ? [{ type: "text" as const, text: m.content }] : m.content;
					return {
						role: "user",
						content,
						timestamp: m.timestamp,
					};
				}
				case "branchSummary":
					// 分支摘要：加前后缀后作为 user 文本
					return {
						role: "user",
						content: [{ type: "text" as const, text: BRANCH_SUMMARY_PREFIX + m.summary + BRANCH_SUMMARY_SUFFIX }],
						timestamp: m.timestamp,
					};
				case "compactionSummary":
					// 压缩摘要：加前后缀后作为 user 文本
					return {
						role: "user",
						content: [
							{ type: "text" as const, text: COMPACTION_SUMMARY_PREFIX + m.summary + COMPACTION_SUMMARY_SUFFIX },
						],
						timestamp: m.timestamp,
					};
				case "user":
				case "assistant":
				case "toolResult":
					// 标准消息直接透传
					return m;
				default:
					// 未知角色一律丢弃
					return undefined;
			}
		})
		.filter((m): m is Message => m !== undefined);
}
