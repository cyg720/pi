/**
 * 【文件职责】GitHub Copilot 动态请求头构造：根据消息内容推断发起方（用户/代理）与
 *              是否包含图片，生成 X-Initiator、Openai-Intent 等必需头。
 * 【技术维度】消息角色分析 + 内容块类型检查。
 * 【产品维度】让 Copilot 端点正确识别请求类型（用户主动 vs 代理续写）并启用视觉能力。
 * 【逻辑维度】inferCopilotInitiator 判定 → hasCopilotVisionInput 检查图片 →
 *              buildCopilotDynamicHeaders 组装最终头。
 * 【关键边界】X-Initiator 按最后一条消息角色判定；图片头仅在确实含图片时添加。
 * 【新手阅读建议】半分钟读完：三个函数一条线即可。
 */
import type { Message } from "../types.ts";

// Copilot expects X-Initiator to indicate whether the request is user-initiated
// or agent-initiated (e.g. follow-up after assistant/tool messages).
// 推断请求发起方（公开）：Copilot 依据 X-Initiator 区分用户发起还是代理发起
// （如助手/工具消息后的续写）。最后一条非 user 消息视为代理发起。
export function inferCopilotInitiator(messages: Message[]): "user" | "agent" {
	const last = messages[messages.length - 1];
	return last && last.role !== "user" ? "agent" : "user";
}

// Copilot requires Copilot-Vision-Request header when sending images
// 检查消息是否含图片（公开）：发送图片时 Copilot 要求 Copilot-Vision-Request 头
export function hasCopilotVisionInput(messages: Message[]): boolean {
	return messages.some((msg) => {
		if (msg.role === "user" && Array.isArray(msg.content)) {
			return msg.content.some((c) => c.type === "image");
		}
		if (msg.role === "toolResult" && Array.isArray(msg.content)) {
			return msg.content.some((c) => c.type === "image");
		}
		return false;
	});
}

// 组装 Copilot 动态请求头（公开）：发起方 + 意图 + 视觉开关
export function buildCopilotDynamicHeaders(params: {
	messages: Message[];
	hasImages: boolean;
}): Record<string, string> {
	const headers: Record<string, string> = {
		"X-Initiator": inferCopilotInitiator(params.messages),
		"Openai-Intent": "conversation-edits",
	};

	if (params.hasImages) {
		headers["Copilot-Vision-Request"] = "true";
	}

	return headers;
}
