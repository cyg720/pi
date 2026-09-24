<<<<<<< HEAD
/**
 * 【文件职责】消息内容文本提取：从消息的 content（文本/图片/思考/工具调用块）中
 *              提取并拼接全部纯文本。
 * 【技术维度】类型守卫过滤 text 块；分隔符拼接。
 * 【产品维度】为摘要、显示、日志等需要"纯文本视图"的场景提供统一入口。
 * 【逻辑维度】字符串直接返回；数组过滤 text 块后按分隔符拼接。
 * 【关键边界】仅提取 type === "text" 的块；图片/思考/工具调用不参与。
 * 【新手阅读建议】半分钟读完即可。
 */
import type { ImageContent, TextContent, ThinkingContent, ToolCall } from "../types.ts";
=======
import type { ImageContent, SystemMessage, TextContent, ThinkingContent, ToolCall } from "../types.ts";
>>>>>>> main

type Content = TextContent | ImageContent | ThinkingContent | ToolCall;

/** Extract and join text from message content. */
// 提取并拼接消息内容中的纯文本（公开）：字符串原样返回；数组取全部 text 块按分隔符连接
export function contentText(content: string | readonly Content[], separator = "\n"): string {
	if (typeof content === "string") return content;
	return content
		.filter((block) => block.type === "text")
		.map((block) => block.text)
		.join(separator);
}

/** Render a system message as a complete prompt: its content followed by its sections. */
export function getSystemMessageText(message: SystemMessage): string {
	const parts = [contentText(message.content)];
	for (const text of Object.values(message.sections ?? {})) {
		if (text !== null) parts.push(text);
	}
	return parts.filter((part) => part.length > 0).join("\n\n");
}

/**
 * Render a later system message for APIs that accept system messages mid-conversation.
 * Section changes are framed by name so the model can relate them to the leading prompt.
 * This framing is request-time only and may change between versions.
 */
export function renderSystemMessageUpdate(message: SystemMessage): string {
	const parts: string[] = [];
	const text = contentText(message.content);
	if (text.length > 0) parts.push(text);
	for (const [name, value] of Object.entries(message.sections ?? {})) {
		parts.push(
			value === null
				? `Removed system prompt section "${name}".`
				: `Updated system prompt section "${name}":\n\n${value}`,
		);
	}
	return parts.join("\n\n");
}
