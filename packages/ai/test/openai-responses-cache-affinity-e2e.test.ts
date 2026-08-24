/**
 * 文件职责：端到端验证 OpenAI Responses 请求携带对齐的会话缓存亲和标识时可正常完成。
 * 技术维度：使用 Vitest 条件跳过、真实 OpenAI API、兼容层 complete 与固定 UUID 会话标识。
 * 产品维度：确认同一会话可稳定命中服务端缓存路径，降低长对话延迟且不破坏响应。
 * 逻辑维度：有密钥时构造模型、会话和上下文，发起请求后检查无错误且包含指定文本。
 * 关键边界：会访问真实服务并可能产生费用；允许最多重试两次，结果受网络与账户权限影响。
 * 新手阅读建议：先看 skipIf 的费用保护，再比较 sessionId、context 与 complete 第三个参数的关系。
 */
import { describe, expect, it } from "vitest";
import { complete, getModel } from "../src/compat.ts";
import type { Context } from "../src/types.ts";

/** OpenAI Responses 缓存亲和在线测试组；未配置密钥时整组跳过。 */
describe.skipIf(!process.env.OPENAI_API_KEY)("openai responses cache affinity e2e", () => {
	/** 使用固定会话 ID 发送真实请求，并允许网络型失败重试两次。 */
	it("handles direct OpenAI Responses requests with aligned cache-affinity identifiers", { retry: 2 }, async () => {
		/** 当前目录中的 OpenAI GPT-5.4 模型配置。 */
		const model = getModel("openai", "gpt-5.4");
		/** 固定 UUIDv7 风格会话标识，用于同时驱动相关缓存亲和字段。 */
		const sessionId = "0195d6e4-4cf9-7f44-a2d8-f8f7f49ee9d3";
		/** 单轮测试上下文；要求模型返回确定短语，便于可靠断言。 */
		const context: Context = {
			systemPrompt: "You are a helpful assistant. Reply exactly as requested.",
			messages: [
				{
					role: "user",
					content: "Reply with exactly: openai cache affinity e2e success",
					timestamp: Date.now(),
				},
			],
		};

		/** 真实 OpenAI 完成响应；失败详情通过 stopReason 与 errorMessage 暴露。 */
		const response = await complete(model, context, {
			apiKey: process.env.OPENAI_API_KEY!,
			sessionId,
		});

		expect(response.stopReason, response.errorMessage).not.toBe("error");
		expect(response.errorMessage).toBeUndefined();
		// block 是响应内容块；只拼接文本块，其他类型以空字符串处理。
		expect(response.content.map((block) => (block.type === "text" ? block.text : "")).join("")).toContain(
			"openai cache affinity e2e success",
		);
	});
});
