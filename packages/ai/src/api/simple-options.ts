/**
 * 【文件职责】共享的流式选项构建工具：把简化选项（SimpleStreamOptions）转换为各供应商
 *              通用的 StreamOptions，并负责 maxTokens 的上下文钳制与思考强度映射。
 * 【技术维度】上下文估算驱动的 maxTokens 钳制；思考预算（默认/自定义）与输出空间划分。
 * 【产品维度】统一各供应商 API 的选项处理，避免重复实现并保证上下文安全。
 * 【逻辑维度】clampMaxTokensToContext 钳制 → buildBaseOptions 组装基类选项 →
 *              clampReasoning 降档 → adjustMaxTokensForThinking 拆分思考/输出预算。
 * 【关键边界】上下文预留 4096 token 安全余量；maxTokens 至少 1；
 *              xhigh/max 思考档位被钳制为 high；思考预算与输出需互不挤占。
 * 【新手阅读建议】先读 buildBaseOptions 的字段映射 → 再读两个 clamp/adjust 函数的边界处理。
 */
import type {
	Api,
	Context,
	Model,
	SimpleStreamOptions,
	StreamOptions,
	ThinkingBudgets,
	ThinkingLevel,
} from "../types.ts";
import { estimateContextTokens } from "../utils/estimate.ts";

// 上下文安全余量：请求内容预留的 token 空间（防止 maxTokens 挤爆窗口）
const CONTEXT_SAFETY_TOKENS = 4096;
// maxTokens 下限
const MIN_MAX_TOKENS = 1;

// 把 maxTokens 钳制到上下文窗口内（公开）：可用空间 = 窗口 - 估算用量 - 安全余量
export function clampMaxTokensToContext(model: Model<Api>, context: Context, maxTokens: number): number {
	if (model.contextWindow <= 0) return Math.max(MIN_MAX_TOKENS, maxTokens);
	const available = model.contextWindow - estimateContextTokens(context).tokens - CONTEXT_SAFETY_TOKENS;
	return Math.min(maxTokens, Math.max(MIN_MAX_TOKENS, available));
}

// 组装基础流选项（公开）：把简化选项逐字段映射为通用 StreamOptions，
// 并把 maxTokens 按上下文钳制（缺省用模型上限）
export function buildBaseOptions(
	model: Model<Api>,
	context: Context,
	options?: SimpleStreamOptions,
	apiKey?: string,
): StreamOptions {
	return {
		temperature: options?.temperature,
		maxTokens: clampMaxTokensToContext(model, context, options?.maxTokens ?? model.maxTokens),
		signal: options?.signal,
		apiKey: apiKey || options?.apiKey,
		transport: options?.transport,
		cacheRetention: options?.cacheRetention,
		sessionId: options?.sessionId,
		headers: options?.headers,
		onPayload: options?.onPayload,
		onResponse: options?.onResponse,
		timeoutMs: options?.timeoutMs,
		websocketConnectTimeoutMs: options?.websocketConnectTimeoutMs,
		maxRetries: options?.maxRetries,
		maxRetryDelayMs: options?.maxRetryDelayMs,
		metadata: options?.metadata,
		env: options?.env,
	};
}

// 思考强度降档（公开）：xhigh/max 统一降为 high（多数供应商不支持更高档）
export function clampReasoning(effort: ThinkingLevel | undefined): Exclude<ThinkingLevel, "xhigh" | "max"> | undefined {
	return effort === "xhigh" || effort === "max" ? "high" : effort;
}

// 思考与输出的 token 预算划分（公开）：把模型输出上限拆为 maxTokens（总输出）
// 与 thinkingBudget（思考预算）。缺省调用方上限时使用模型上限并让思考容纳其中；
// 自定义预算可覆盖默认档位预算。
export function adjustMaxTokensForThinking(
	// Undefined means no explicit caller cap. Use the model cap and fit thinking inside it.
	// undefined 表示调用方未设上限：用模型上限并把思考纳入其中
	baseMaxTokens: number | undefined,
	modelMaxTokens: number,
	reasoningLevel: ThinkingLevel,
	customBudgets?: ThinkingBudgets,
): { maxTokens: number; thinkingBudget: number } {
	// 各思考档位的默认思考预算
	const defaultBudgets: ThinkingBudgets = {
		minimal: 1024,
		low: 2048,
		medium: 8192,
		high: 16384,
	};
	const budgets = { ...defaultBudgets, ...customBudgets };

	// 输出保底 token（思考不能挤占全部输出空间）
	const minOutputTokens = 1024;
	const level = clampReasoning(reasoningLevel)!;
	let thinkingBudget = budgets[level]!;
	// 总输出上限：显式上限 + 思考预算（思考与输出共享同一 token 预算），再钳制到模型上限
	const maxTokens =
		baseMaxTokens === undefined ? modelMaxTokens : Math.min(baseMaxTokens + thinkingBudget, modelMaxTokens);

	// 思考预算吃满输出空间时收缩，保留输出保底
	if (maxTokens <= thinkingBudget) {
		thinkingBudget = Math.max(0, maxTokens - minOutputTokens);
	}

	return { maxTokens, thinkingBudget };
}
