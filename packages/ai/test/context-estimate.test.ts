/**
 * 文件职责：验证上下文令牌估算在消息按时间插入后选择正确的助手用量基准。
 * 技术维度：使用 Vitest、统一 Context/Usage 类型和简单选项构建器测试估算纯逻辑。
 * 产品维度：避免错误沿用过期用量导致生成上限过小或超出模型上下文窗口。
 * 逻辑维度：构造用量对象和助手消息，分别覆盖过期用量被忽略与新用量重新生效。
 * 关键边界：文本估算按当前近似算法计算，不等同于提供商分词器的精确令牌数。
 * 新手阅读建议：先理解两个夹具函数和固定模型窗口，再比较两组消息时间戳的先后关系。
 */
import { describe, expect, it } from "vitest";
import { buildBaseOptions } from "../src/api/simple-options.ts";
import type { AssistantMessage, Context, Model, Usage } from "../src/types.ts";
import { estimateContextTokens } from "../src/utils/estimate.ts";

/**
 * 创建零成本、仅输入令牌非零的用量对象。
 * 参数：totalTokens 为输入和总令牌数。
 * 返回值：完整 Usage 对象。
 * 使用示例：`createUsage(2_000)`。
 */
function createUsage(totalTokens: number): Usage {
	return {
		input: totalTokens,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
	};
}

/**
 * 创建带指定时间戳和用量的固定助手消息。
 * 参数：timestamp 为消息时间，totalTokens 为该响应记录的上下文用量。
 * 返回值：内容为 kept 的 AssistantMessage。
 * 使用示例：`createAssistant(400, 2_000)`。
 */
function createAssistant(timestamp: number, totalTokens: number): AssistantMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text: "kept" }],
		api: "openai-responses",
		provider: "openai",
		model: "test-model",
		usage: createUsage(totalTokens),
		stopReason: "stop",
		timestamp,
	};
}

// model 是具有 10000 令牌上下文窗口的固定 Responses 测试模型。
const model: Model<"openai-responses"> = {
	id: "test-model",
	name: "Test Model",
	api: "openai-responses",
	provider: "openai",
	baseUrl: "https://api.openai.com/v1",
	reasoning: false,
	input: ["text"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 10_000,
	maxTokens: 8_000,
};

describe("context token estimation", () => {
	// 验证时间更早的助手用量在其前方插入较新消息后会被视为过期；无参数，无返回值。
	it("ignores stale assistant usage after a newer message is inserted before it", () => {
		// context 包含时间顺序被插入消息打乱的旧助手用量和长尾提示词。
		const context: Context = {
			systemPrompt: "system",
			messages: [
				{ role: "user", content: "summary", timestamp: 200 },
				createAssistant(100, 9_500),
				{ role: "user", content: "x".repeat(4_000), timestamp: 300 },
			],
		};

		expect(estimateContextTokens(context)).toEqual({
			tokens: 1_005,
			usageTokens: 0,
			trailingTokens: 1_005,
			lastUsageIndex: null,
		});
		expect(buildBaseOptions(model, context).maxTokens).toBe(4_899);
	});

	// 验证插入上下文后产生的新助手响应可重新作为用量基准；无参数，无返回值。
	it("uses assistant usage again after a response to the inserted context", () => {
		// context 包含旧助手响应、插入提示、新助手响应和一条尾部用户消息。
		const context: Context = {
			messages: [
				{ role: "user", content: "summary", timestamp: 200 },
				createAssistant(100, 9_500),
				{ role: "user", content: "new prompt", timestamp: 300 },
				createAssistant(400, 2_000),
				{ role: "user", content: "tail", timestamp: 500 },
			],
		};

		expect(estimateContextTokens(context)).toEqual({
			tokens: 2_001,
			usageTokens: 2_000,
			trailingTokens: 1,
			lastUsageIndex: 3,
		});
	});
});
