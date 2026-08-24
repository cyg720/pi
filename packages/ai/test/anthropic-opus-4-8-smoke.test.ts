/**
 * 文件职责：通过真实流式请求冒烟验证 Claude Opus 4.8 的自适应思考配置和签名返回。
 * 技术维度：使用 Vitest、Anthropic 流式事件、请求载荷钩子和统一消息类型完成端到端断言。
 * 产品维度：确保用户启用高强度推理时既能得到正确答案，也能收到可追踪的思考元数据。
 * 逻辑维度：构造固定算术题，捕获请求载荷，消费思考事件，再检查签名和最终文本。
 * 关键边界：依赖真实 Anthropic 密钥并可能产生费用；网络抖动通过有限重试缓解。
 * 新手阅读建议：先看载荷接口和 makeContext，再顺着“发起流、消费事件、检查结果”阅读。
 */
import { describe, expect, it } from "vitest";
import { getModel, streamSimple } from "../src/compat.ts";
import type { Context } from "../src/types.ts";

/** 描述本测试关心的 Anthropic 思考请求字段，未出现的字段保持可选。 */
interface AnthropicThinkingPayload {
	// thinking 表示思考模式配置，其中 type 预期为 adaptive。
	thinking?: { type: string };
	// output_config 表示输出配置，其中 effort 是请求的推理强度。
	output_config?: { effort?: string };
}

/**
 * 创建答案固定且能触发推理的对话上下文。
 * 参数：无。
 * 返回值：要求严格格式回答复合算术题的 Context。
 * 使用示例：`streamSimple(model, makeContext(), options)`。
 */
function makeContext(): Context {
	return {
		systemPrompt: "You are a precise assistant. Follow the user's instructions exactly.",
		messages: [
			{
				role: "user",
				content:
					"Compute 48291 * 7317 and 90844 - 17729, add the results, and determine whether the sum is divisible by 11. Reply with exactly this format and nothing else: sum=<sum>; divisibleBy11=<yes|no>",
				timestamp: Date.now(),
			},
		],
	};
}

describe.skipIf(!process.env.ANTHROPIC_API_KEY)("Anthropic Opus 4.8 smoke", () => {
	// 验证高推理强度的载荷、流事件、思考签名和最终答案；无参数，无返回值。
	it("streams Claude Opus 4.8 with reasoning enabled", { retry: 2, timeout: 30000 }, async () => {
		// 读取 Claude Opus 4.8 的目录配置。
		const model = getModel("anthropic", "claude-opus-4-8");
		// 保存发送前捕获的请求载荷；钩子执行前允许为 undefined。
		let capturedPayload: AnthropicThinkingPayload | undefined;
		// 创建开启高强度推理的简单事件流；payload 是即将发送的原始请求载荷。
		const s = streamSimple(model, makeContext(), {
			reasoning: "high",
			maxTokens: 1024,
			onPayload: (payload) => {
				capturedPayload = payload as AnthropicThinkingPayload;
				return payload;
			},
		});

		// 记录是否收到任一种思考生命周期事件，初始值为 false。
		let sawThinking = false;

		// event 是当前流事件；遍历完整事件流并标记思考相关事件。
		for await (const event of s) {
			if (event.type === "thinking_start" || event.type === "thinking_delta" || event.type === "thinking_end") {
				sawThinking = true;
			}
		}

		// 获取事件流完成后的完整响应。
		const response = await s.result();
		expect(response.stopReason, response.errorMessage).toBe("stop");
		expect(response.errorMessage).toBeFalsy();
		expect(capturedPayload?.thinking).toEqual({ type: "adaptive" });
		expect(capturedPayload?.output_config).toEqual({ effort: "high" });
		expect(sawThinking).toBe(true);

		// 查找首个思考内容块；block 表示当前响应内容块。
		const thinkingBlock = response.content.find((block) => block.type === "thinking");
		expect(thinkingBlock?.type).toBe("thinking");
		if (!thinkingBlock || thinkingBlock.type !== "thinking") {
			throw new Error("Expected thinking block from Claude Opus 4.8");
		}
		expect(typeof thinkingBlock.thinkingSignature).toBe("string");
		// 保存经过类型收窄后的思考签名，后续要求其为非空字符串。
		const thinkingSignature = thinkingBlock.thinkingSignature;
		if (!thinkingSignature) {
			throw new Error("Expected thinking signature from Claude Opus 4.8");
		}
		expect(thinkingSignature.length).toBeGreaterThan(0);

		// 提取并拼接全部文本块；block 表示当前被筛选或映射的内容块。
		const text = response.content
			.filter((block) => block.type === "text")
			.map((block) => block.text)
			.join("")
			.trim();
		expect(text).toBe("sum=353418362; divisibleBy11=yes");
	});
});
