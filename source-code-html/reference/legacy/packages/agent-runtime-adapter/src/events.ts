import { normalizeToolResult, sanitizeToolValue } from "./tool-data.ts";
import type { RuntimeMessage } from "./types.ts";

export function normalizeMessage(value: unknown, id: string, costKnown = true): RuntimeMessage | undefined {
	if (!value || typeof value !== "object") return undefined;
	let message = value as Record<string, unknown>;
	const role = message.role === "toolResult" ? "tool" : message.role;
	if (role !== "user" && role !== "assistant" && role !== "tool") return undefined;
	if (role === "tool") message = { ...message, content: sanitizeToolValue(message.content) };
	const timestamp = typeof message.timestamp === "number" ? message.timestamp : 0;
	const images = Array.isArray(message.content)
		? message.content.flatMap((part: unknown) => {
				if (!part || typeof part !== "object") return [];
				const content = part as Record<string, unknown>;
				return content.type === "image" && typeof content.mimeType === "string"
					? [{ mimeType: content.mimeType }]
					: [];
			})
		: [];
	const toolCalls = Array.isArray(message.content)
		? message.content.flatMap((part: unknown) => {
				if (!part || typeof part !== "object") return [];
				const call = part as Record<string, unknown>;
				return call.type === "toolCall" && typeof call.id === "string" && typeof call.name === "string"
					? [{ id: call.id, name: call.name, arguments: sanitizeToolValue(call.arguments) }]
					: [];
			})
		: [];
	const thinking = Array.isArray(message.content)
		? message.content
				.flatMap((part: unknown) => {
					if (!part || typeof part !== "object") return [];
					const content = part as Record<string, unknown>;
					return content.type === "thinking" && typeof content.thinking === "string" ? [content.thinking] : [];
				})
				.join("\n")
		: "";
	const rawUsage =
		message.usage && typeof message.usage === "object" ? (message.usage as Record<string, unknown>) : undefined;
	const usageNumber = (key: string): number => {
		const value = rawUsage?.[key];
		return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
	};
	const rawCost =
		rawUsage?.cost && typeof rawUsage.cost === "object"
			? (rawUsage.cost as Record<string, unknown>).total
			: undefined;
	const text =
		typeof message.content === "string"
			? message.content
			: Array.isArray(message.content)
				? message.content
						.flatMap((part: unknown) => {
							if (!part || typeof part !== "object") return [];
							const content = part as Record<string, unknown>;
							return content.type === "text" && typeof content.text === "string" ? [content.text] : [];
						})
						.join("\n")
				: "";
	return {
		id,
		role,
		text,
		...(images.length ? { images } : {}),
		...(toolCalls.length ? { toolCalls } : {}),
		...(role === "tool" ? { toolResult: normalizeToolResult(message) } : {}),
		...(thinking ? { thinking } : {}),
		...(typeof message.toolCallId === "string" ? { toolCallId: message.toolCallId } : {}),
		...(rawUsage
			? {
					usage: {
						inputTokens: usageNumber("input"),
						outputTokens: usageNumber("output"),
						cacheReadTokens: usageNumber("cacheRead"),
						cacheWriteTokens: usageNumber("cacheWrite"),
						totalTokens: usageNumber("totalTokens"),
						cost: costKnown && typeof rawCost === "number" && Number.isFinite(rawCost) ? rawCost : null,
					},
				}
			: {}),
		timestamp,
		...(typeof message.toolName === "string" ? { toolName: message.toolName } : {}),
		...(typeof message.isError === "boolean" ? { isError: message.isError } : {}),
		...(typeof message.stopReason === "string" ? { stopReason: message.stopReason } : {}),
	};
}
