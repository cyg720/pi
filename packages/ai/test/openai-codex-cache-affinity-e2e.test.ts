/**
 * 文件职责：端到端验证 OpenAI Codex SSE 请求使用一致缓存亲和标识时能够正常完成。
 * 技术维度：使用 Vitest 条件跳过、OAuth 密钥解析、真实 complete API 和固定会话 UUID。
 * 产品维度：确认 Codex 登录用户的同会话请求可稳定使用缓存且不影响回答内容。
 * 逻辑维度：模块加载时解析令牌，有令牌才构造模型与上下文，发起 SSE 请求并检查结果。
 * 关键边界：会访问真实服务并可能消耗额度；没有令牌时跳过，网络与账户状态会影响结果。
 * 新手阅读建议：先看 codexToken 如何控制 skipIf，再跟踪 sessionId 同时进入请求选项的过程。
 */
import { describe, expect, it } from "vitest";
import { complete, getModel } from "../src/compat.ts";
import type { Context } from "../src/types.ts";
import { resolveApiKey } from "./oauth.ts";

/** 当前环境解析出的 OpenAI Codex OAuth 令牌；缺失时在线用例跳过。 */
const codexToken = await resolveApiKey("openai-codex");

/** OpenAI Codex 缓存亲和在线测试组。 */
describe("openai-codex cache affinity e2e", () => {
	/** 通过 SSE 传输发送固定会话请求并验证无错误且包含指定短语。 */
	it.skipIf(!codexToken)("handles SSE requests with aligned cache-affinity identifiers", async () => {
		/** OpenAI Codex 提供方的 GPT-5.5 模型配置。 */
		const model = getModel("openai-codex", "gpt-5.5");
		/** 固定会话 UUID，用于生成对齐的缓存亲和标识。 */
		const sessionId = "0195d6e4-4cf9-7f44-a2d8-f8f7f49ee9d3";
		/** 要求返回确定短语的单轮上下文，便于端到端断言。 */
		const context: Context = {
			systemPrompt: "You are a helpful assistant. Reply exactly as requested.",
			messages: [
				{
					role: "user",
					content: "Reply with exactly: cache affinity e2e success",
					timestamp: Date.now(),
				},
			],
		};

		/** 使用 OAuth 令牌和 SSE 传输得到的真实完成响应。 */
		const response = await complete(model, context, {
			apiKey: codexToken,
			sessionId,
			transport: "sse",
		});

		expect(response.stopReason, response.errorMessage).not.toBe("error");
		expect(response.errorMessage).toBeUndefined();
		// block 是响应内容块；只连接文本块参与成功短语断言。
		expect(response.content.map((block) => (block.type === "text" ? block.text : "")).join("")).toContain(
			"cache affinity e2e success",
		);
	});
});
