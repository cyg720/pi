/**
 * 文件职责：端到端回归验证 OpenRouter 补全流会保留提供商返回的缓存写入令牌用量。
 * 技术维度：使用 Vitest、真实 OpenRouter 请求、载荷钩子和临时 cache_control 标记触发缓存。
 * 产品维度：保证用户能准确看到提示词缓存创建用量，从而评估延迟和费用优化效果。
 * 逻辑维度：创建唯一长系统提示词，给最后一条用户内容加缓存标记，连续请求两次并检查用量。
 * 关键边界：依赖真实 API 密钥、网络和提供商缓存行为，可能产生费用且设置了重试与长超时。
 * 新手阅读建议：先看长提示词生成函数，再理解 onPayload 如何修改用户消息，最后看两次调用断言。
 */
import { describe, expect, it } from "vitest";
import { completeSimple, getModel } from "../src/compat.ts";

/**
 * 创建足够长且本次测试唯一的系统提示词以触发缓存。
 * 参数：无。
 * 返回值：包含随机 nonce 和重复稳定前缀的字符串。
 * 使用示例：`systemPrompt: createLongSystemPrompt()`。
 */
function createLongSystemPrompt(): string {
	// nonce 由当前时间和随机数组成，避免不同测试运行复用旧缓存。
	const nonce = `${Date.now()}-${Math.random()}`;
	return `You are a concise assistant.\nCache nonce: ${nonce}\n\n${Array(80)
		.fill(
			"Prompt-caching probe content. Keep this exact text stable across requests so the provider can reuse prefix tokens and report cache read and cache write usage.",
		)
		.join("\n\n")}`;
}

describe.skipIf(!process.env.OPENROUTER_API_KEY)("OpenRouter cache_write repro E2E", () => {
	// 验证连续请求中至少一次报告缓存写入用量；无参数，无返回值。
	it(
		"regression: preserves cache_write_tokens on openai-completions stream path",
		{ retry: 2, timeout: 90000 },
		async () => {
			// model 是通过 OpenRouter 调用的 Gemini 2.5 Flash 模型配置。
			const model = getModel("openrouter", "google/gemini-2.5-flash");
			// context 保存两次请求共用的长系统提示词和固定用户消息。
			const context = {
				systemPrompt: createLongSystemPrompt(),
				messages: [
					{
						role: "user" as const,
						content: "Reply with exactly: OK",
						timestamp: Date.now(),
					},
				],
			};

			// options 保存认证、确定性生成设置和注入缓存标记的载荷钩子。
			const options = {
				apiKey: process.env.OPENROUTER_API_KEY!,
				maxTokens: 32,
				temperature: 0,
				// payload 是提供商请求载荷；回调为最后一条用户文本添加 ephemeral 缓存标记并原样返回。
				onPayload: (payload: unknown) => {
					// params 是仅描述本测试会访问字段的宽松载荷视图。
					const params = payload as {
						messages?: Array<{
							role?: string;
							content?: string | Array<{ type?: string; text?: string; cache_control?: { type: string } }>;
						}>;
					};
					// messages 是载荷中的可选消息数组；缺失时不做修改。
					const messages = params.messages;
					if (!Array.isArray(messages)) return payload;

					// i 从末尾向前寻找最后一条用户消息，避免修改更早的上下文。
					for (let i = messages.length - 1; i >= 0; i--) {
						// msg 是当前候选消息；非 user 角色直接跳过。
						const msg = messages[i];
						if (msg.role !== "user") continue;
						if (typeof msg.content === "string") {
							msg.content = [{ type: "text", text: msg.content, cache_control: { type: "ephemeral" } }];
							break;
						}
						if (!Array.isArray(msg.content)) continue;
						// j 从消息内容末尾查找最后一个文本块。
						for (let j = msg.content.length - 1; j >= 0; j--) {
							// part 是当前内容块；只给文本块添加缓存控制字段。
							const part = msg.content[j];
							if (part.type === "text") {
								part.cache_control = { type: "ephemeral" };
								break;
							}
						}
						break;
					}
					return payload;
				},
			};

			// first 是首次请求结果，预期负责创建可复用缓存。
			const first = await completeSimple(model, context, options);
			expect(first.stopReason, first.errorMessage).toBe("stop");

			// second 是相同上下文的第二次请求结果，可能读取或继续报告缓存。
			const second = await completeSimple(model, context, options);
			expect(second.stopReason, second.errorMessage).toBe("stop");

			// Regression expectation: cache_write_tokens from provider usage must be preserved.
			// 回归要求：提供商用量中的 cache_write_tokens 必须保留下来。
			// With the cache_control marker above, at least one of the two calls should create cache.
			// 加入上述 cache_control 标记后，两次调用中至少一次应创建缓存。
			// hasCacheWrite 表示任一次请求报告了大于零的缓存写入令牌。
			const hasCacheWrite = first.usage.cacheWrite > 0 || second.usage.cacheWrite > 0;
			expect(hasCacheWrite).toBe(true);
		},
	);
});
