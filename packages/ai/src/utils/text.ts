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
