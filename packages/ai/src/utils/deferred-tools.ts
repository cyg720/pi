/**
 * 【文件职责】延迟工具（deferred tools）拆分：根据对话记录把工具集合分为"立即可用"与
 *              "由对话加载"两类，供支持按需加载工具的供应商（如 Kimi）使用。
 * 【技术维度】名称归一化钩子；遍历消息收集 usedNames/deferredNames；Map 去重。
 * 【产品维度】支持"工具按需激活"：未使用过的工具不随请求发送，减少每次请求的上下文体积。
 * 【逻辑维度】去重工具 → 遍历对话标记已用/已引入工具名 → 拆分为 immediate 与 deferred。
 * 【关键边界】工具结果中 addedToolNames 且未被助手调用过的工具归入 deferred；
 *              仅当 enabled 时执行拆分，否则全部 immediate。
 * 【新手阅读建议】半分钟读完：理解两个集合（立即/延迟）的划分依据即可。
 */
import type { Context, Tool } from "../types.ts";

// 工具名归一化函数类型（供应商可注入大小写/别名规范化）
type ToolNameNormalizer = (name: string) => string;

// 默认归一化：原样
const identityToolName: ToolNameNormalizer = (name) => name;

/** Split current tools into prefix and transcript-loaded definitions. */
// 拆分工具为"前缀（立即）"与"对话加载（延迟）"两组（公开）：
// enabled 为 false 时全部立即；否则按对话记录判定
export function splitDeferredTools(
	context: Context,
	enabled: boolean,
	normalizeName: ToolNameNormalizer = identityToolName,
): { immediate: Tool[]; deferred: Map<string, Tool> } {
	// 按归一化名称去重
	const uniqueTools = new Map<string, Tool>();
	for (const tool of context.tools ?? []) uniqueTools.set(normalizeName(tool.name), tool);
	if (!enabled) return { immediate: [...uniqueTools.values()], deferred: new Map() };

	// 收集对话中已用工具名与新增工具名
	const deferredNames = new Set<string>();
	const usedNames = new Set<string>();
	for (const message of context.messages) {
		if (message.role === "assistant") {
			for (const block of message.content) {
				if (block.type === "toolCall") usedNames.add(normalizeName(block.name));
			}
		} else if (message.role === "toolResult") {
			for (const name of message.addedToolNames ?? []) {
				const normalizedName = normalizeName(name);
				if (!usedNames.has(normalizedName)) deferredNames.add(normalizedName);
			}
		}
	}

	// 拆分：延迟集合优先于立即集合
	const immediate: Tool[] = [];
	const deferred = new Map<string, Tool>();
	for (const [name, tool] of uniqueTools) {
		if (deferredNames.has(name)) deferred.set(name, tool);
		else immediate.push(tool);
	}
	return { immediate, deferred };
}
