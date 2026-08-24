/**
 * 文件职责：验证 Google 共享消息转换器按 Gemini 版本正确组织图片工具结果。
 * 技术维度：使用 Vitest、泛型模型夹具、统一 Context 和 convertMessages 纯转换函数。
 * 产品维度：保证模型能把图片结果与对应工具调用关联，避免多工具响应错位或丢图。
 * 逻辑维度：构造含三个工具调用及文本/图片结果的上下文，对比 Gemini 2.x 与 3.x 输出轮次。
 * 关键边界：只覆盖 Google Generative AI 协议；图片数据为占位 Base64，不进行解码。
 * 新手阅读建议：先看 makeContext 的调用顺序，再比较两例 contents 长度和图片所在层级。
 */
import { describe, expect, it } from "vitest";
import { convertMessages } from "../src/api/google-shared.ts";
import type { Context, Model } from "../src/types.ts";

/**
 * 创建指定提供商和标识的 Google 测试模型。
 * 参数：api 为协议，provider 为提供商，id 为模型标识。
 * 返回值：支持文本和图片的 Model。
 * 使用示例：`makeModel("google-generative-ai", "google", id)`。
 */
function makeModel<TApi extends "google-generative-ai">(
	api: TApi,
	provider: Model<TApi>["provider"],
	id: string,
): Model<TApi> {
	return {
		id,
		name: id,
		api,
		provider,
		baseUrl: "https://example.com",
		reasoning: true,
		input: ["text", "image"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128000,
		maxTokens: 8192,
	};
}

/**
 * 创建三个读取工具调用及对应文本、图片、文本结果的上下文。
 * 参数：model 提供消息记录需要的 api、provider 和 id。
 * 返回值：固定顺序的 Context。
 * 使用示例：`makeContext(model)`。
 */
function makeContext(model: { api: string; provider: string; id: string }): Context {
	// now 是所有相关消息共享的时间戳，避免时间因素影响顺序。
	const now = Date.now();
	return {
		messages: [
			{ role: "user", content: "read the files", timestamp: now },
			{
				role: "assistant",
				content: [
					{ type: "toolCall", id: "call_a", name: "read", arguments: { path: "a.txt" } },
					{ type: "toolCall", id: "call_img", name: "read", arguments: { path: "image.png" } },
					{ type: "toolCall", id: "call_b", name: "read", arguments: { path: "b.txt" } },
				],
				api: model.api,
				provider: model.provider,
				model: model.id,
				usage: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 0,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
				},
				stopReason: "toolUse",
				timestamp: now,
			},
			{
				role: "toolResult",
				toolCallId: "call_a",
				toolName: "read",
				content: [{ type: "text", text: "alpha text" }],
				isError: false,
				timestamp: now,
			},
			{
				role: "toolResult",
				toolCallId: "call_img",
				toolName: "read",
				content: [{ type: "image", data: "abc", mimeType: "image/png" }],
				isError: false,
				timestamp: now,
			},
			{
				role: "toolResult",
				toolCallId: "call_b",
				toolName: "read",
				content: [{ type: "text", text: "beta text" }],
				isError: false,
				timestamp: now,
			},
		],
	};
}

describe("google-shared image tool result routing", () => {
	// 验证 Gemini 2.x 把图片工具结果拆成独立合成用户轮次；无参数，无返回值。
	it("keeps separate synthetic image turn for Gemini 2.x Google API models", () => {
		// model 是 Gemini 2.5 Flash 的测试配置。
		const model = makeModel("google-generative-ai", "google", "gemini-2.5-flash");
		// contents 是转换后的 Google API 对话轮次数组。
		const contents = convertMessages(model, makeContext(model));

		expect(contents).toHaveLength(5);
		// part 是第三轮的当前内容部分，预期均为函数响应。
		expect(contents[2].parts?.every((part) => part.functionResponse)).toBe(true);
		expect(contents[3].parts?.[0]?.text).toBe("Tool result image:");
		expect(contents[3].parts?.[1]?.inlineData).toBeTruthy();
		expect(contents[4].parts?.[0]?.functionResponse).toBeTruthy();
	});

	// 验证 Gemini 3 把图片嵌套在对应 functionResponse 中；无参数，无返回值。
	it("nests image tool results for Gemini 3 Google API models", () => {
		// model 是 Gemini 3 Pro Preview 的测试配置。
		const model = makeModel("google-generative-ai", "google", "gemini-3-pro-preview");
		// contents 是按 Gemini 3 规则合并后的三轮对话。
		const contents = convertMessages(model, makeContext(model));

		expect(contents).toHaveLength(3);
		// toolResultTurn 是同时容纳三个工具结果的第三轮。
		const toolResultTurn = contents[2];
		expect(toolResultTurn.parts).toHaveLength(3);
		// imageResponse 是第二个工具调用对应且内嵌图片的函数响应。
		const imageResponse = toolResultTurn.parts?.[1]?.functionResponse;
		expect(imageResponse).toBeTruthy();
		expect(imageResponse?.parts).toHaveLength(1);
		expect(imageResponse?.parts?.[0]?.inlineData).toBeTruthy();
	});
});
