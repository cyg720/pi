/**
 * 文件职责：验证 OpenAI 模型对 xhigh 推理强度的支持与拒绝行为。
 * 技术维度：使用 Vitest、统一模型目录和异步流事件接口覆盖 Responses 与 Completions 协议。
 * 产品维度：确保用户选择最高推理强度时，兼容模型正常工作，不兼容模型给出明确错误。
 * 逻辑维度：生成随机算术上下文，分别消费支持与不支持模型的流并检查最终结果。
 * 关键边界：测试依赖真实 OpenAI 密钥；随机题目只用于触发推理，不用于验证算术正确性。
 * 新手阅读建议：先理解 makeContext，再对比 GPT-5.5 成功路径和 GPT-5 mini 的两条错误路径。
 */
import { describe, expect, it } from "vitest";
import { getModel, stream } from "../src/compat.ts";
import type { Context, Model } from "../src/types.ts";

/**
 * 创建能触发逐步推理的测试上下文。
 * 参数：无。
 * 返回值：包含一条随机加法问题的 Context。
 * 使用示例：`stream(model, makeContext(), { reasoningEffort: "xhigh" })`。
 */
function makeContext(): Context {
	return {
		messages: [
			{
				role: "user",
				content: `What is ${(Math.random() * 100) | 0} + ${(Math.random() * 100) | 0}? Think step by step.`,
				timestamp: Date.now(),
			},
		],
	};
}

describe.skipIf(!process.env.OPENAI_API_KEY)("xhigh reasoning", () => {
	describe("gpt 5.5 (supports xhigh)", () => {
		// Note: codex models only support the responses API, not chat completions
		// 注意：Codex 系列模型只支持 Responses API，不支持聊天补全协议。
		// 验证支持 xhigh 的模型能完成流式请求；无参数，无返回值。
		it("should work with openai-responses", async () => {
			// 读取支持 xhigh 的 GPT-5.5 模型配置。
			const model = getModel("openai", "gpt-5.5");
			// 创建 xhigh 推理强度的异步事件流。
			const s = stream(model, makeContext(), { reasoningEffort: "xhigh" });
			// 记录流中是否观察到思考事件，初始值为 false。
			let hasThinking = false;

			// event 是当前流事件；遍历直到流结束，并识别思考开始或增量事件。
			for await (const event of s) {
				if (event.type === "thinking_start" || event.type === "thinking_delta") {
					hasThinking = true;
				}
			}

			// 获取流结束后的完整助手响应。
			const response = await s.result();
			// b 是当前响应内容块；回调用于确认至少存在一个文本块。
			expect(response.stopReason, `Error: ${response.errorMessage}`).toBe("stop");
			expect(response.content.some((b) => b.type === "text")).toBe(true);
			expect(hasThinking || response.content.some((b) => b.type === "thinking")).toBe(true);
		});
	});

	describe("gpt-5-mini (does not support xhigh)", () => {
		// 验证 Responses 协议会拒绝不支持的 xhigh 强度；无参数，无返回值。
		it("should error with openai-responses when using xhigh", async () => {
			// 读取不支持 xhigh 的 GPT-5 mini 模型配置。
			const model = getModel("openai", "gpt-5-mini");
			// 创建预期最终返回错误的异步事件流。
			const s = stream(model, makeContext(), { reasoningEffort: "xhigh" });

			// 下划线变量表示无需检查的流事件，仅用于完整消费事件流。
			for await (const _ of s) {
				// drain events
				// 消费事件，不对单个事件做断言。
			}

			// 获取流的错误响应并检查错误原因。
			const response = await s.result();
			expect(response.stopReason).toBe("error");
			expect(response.errorMessage).toContain("xhigh");
		});

		// 验证 Completions 协议同样会拒绝 xhigh 强度；无参数，无返回值。
		it("should error with openai-completions when using xhigh", async () => {
			// _compat 是刻意剔除的兼容配置，baseModel 保留构造测试模型所需的其余字段。
			const { compat: _compat, ...baseModel } = getModel("openai", "gpt-5-mini");
			void _compat;
			// 将基础配置改造成 Completions 协议模型，以覆盖另一条兼容分支。
			const model: Model<"openai-completions"> = {
				...baseModel,
				api: "openai-completions",
			};
			// 创建预期返回 xhigh 不受支持错误的事件流。
			const s = stream(model, makeContext(), { reasoningEffort: "xhigh" });

			// 下划线变量表示无需检查的流事件，仅用于等待流结束。
			for await (const _ of s) {
				// drain events
				// 消费事件，不对单个事件做断言。
			}

			// 获取完整错误响应，供停止原因和消息断言使用。
			const response = await s.result();
			expect(response.stopReason).toBe("error");
			expect(response.errorMessage).toContain("xhigh");
		});
	});
});
