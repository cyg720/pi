/**
 * 文件职责：验证 xAI Responses 模型目录、推理档位和兼容请求的端点、认证及字段。
 * 技术维度：使用 Vitest、fetch 模拟、SSE 完成响应和 xaiProvider 流接口捕获 Request。
 * 产品维度：保证 Grok 4.5 使用新 Responses API，而旧或退役模型不会误暴露。
 * 逻辑维度：检查模型目录与能力，模拟成功请求并断言 URL、头、缓存、推理和 developer 输入。
 * 关键边界：不访问真实 xAI；每例后恢复 fetch 模拟，完成事件不含实际文本输出。
 * 新手阅读建议：先看 completedResponse 和 captureRequest，再读三个用例从目录到请求逐层验证。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OpenAIResponsesOptions } from "../src/api/openai-responses.ts";
import { getSupportedThinkingLevels } from "../src/models.ts";
import { XAI_MODELS } from "../src/providers/xai.models.ts";
import { xaiProvider } from "../src/providers/xai.ts";
import type { Context, Model } from "../src/types.ts";

/** 描述测试捕获的 HTTP 请求关键字段。 */
type CapturedRequest = {
	// url 是完整请求地址。
	url: string;
	// headers 是规范化后的请求头。
	headers: Headers;
	// body 是解析后的 JSON 请求体。
	body: Record<string, unknown>;
};

/** 创建只包含 response.completed 的成功 SSE 响应；无参数，返回 Response。 */
function completedResponse(): Response {
	// event 是模拟 xAI 完成事件对象。
	const event = {
		type: "response.completed",
		sequence_number: 0,
		response: {
			id: "resp_xai_test",
			status: "completed",
			output: [],
			usage: {
				input_tokens: 1,
				output_tokens: 1,
				total_tokens: 2,
				input_tokens_details: { cached_tokens: 0 },
			},
		},
	};
	return new Response(`data: ${JSON.stringify(event)}\n\ndata: [DONE]\n\n`, {
		status: 200,
		headers: { "content-type": "text/event-stream" },
	});
}

/**
 * 模拟 fetch 并捕获 xAI 提供商发送的请求。
 * 参数：model、context、options 分别为模型、上下文和 Responses 选项。
 * 返回值：捕获请求 Promise。
 */
async function captureRequest(
	model: Model<"openai-responses">,
	context: Context,
	options: OpenAIResponsesOptions,
): Promise<CapturedRequest> {
	// captured 保存 fetch 观察到的请求，调用前允许未定义。
	let captured: CapturedRequest | undefined;
	// input 和 init 是 fetch 参数，回调将其规范化为 Request。
	vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
		// request 是便于读取 URL、头和正文的标准请求对象。
		const request = new Request(input, init);
		captured = {
			url: request.url,
			headers: request.headers,
			body: JSON.parse(await request.clone().text()) as Record<string, unknown>,
		};
		return completedResponse();
	});

	// result 是假 SSE 完成后的助手结果。
	const result = await xaiProvider().stream(model, context, options).result();
	expect(result.stopReason, result.errorMessage).toBe("stop");
	expect(captured).toBeDefined();
	return captured!;
}

describe("xAI Responses provider", () => {
	// 每例后恢复 fetch 等模拟；无参数，无返回值。
	afterEach(() => {
		vi.restoreAllMocks();
	});

	// 验证退役和重复模型不在内置目录；无参数，无返回值。
	it("excludes retired and redundant models from the built-in catalog", () => {
		// modelId 是当前不应出现的模型标识。
		for (const modelId of [
			"grok-3",
			"grok-3-fast",
			"grok-4.20-0309-non-reasoning",
			"grok-4.20-0309-reasoning",
			"grok-code-fast-1",
		]) {
			expect(Object.keys(XAI_MODELS)).not.toContain(modelId);
		}
	});

	// 验证仅 Grok 4.5 使用 Responses 和 low/medium/high；无参数，无返回值。
	it("uses Responses with low/medium/high efforts only for Grok 4.5", () => {
		expect(XAI_MODELS["grok-4.5"].api).toBe("openai-responses");
		expect(getSupportedThinkingLevels(XAI_MODELS["grok-4.5"])).toEqual(["low", "medium", "high"]);
		expect(XAI_MODELS["grok-4.3"].api).toBe("openai-completions");
	});

	// 验证真实请求形状符合 xAI Responses 兼容要求；无参数，无返回值。
	it("uses /responses with bearer auth and xAI-compatible request fields", async () => {
		// captured 是提供商发送前被 fetch 模拟截获的请求。
		const captured = await captureRequest(
			XAI_MODELS["grok-4.5"],
			{
				systemPrompt: "You are a careful coding assistant.",
				messages: [{ role: "user", content: "hello", timestamp: 1 }],
			},
			{
				apiKey: "xai-test-token",
				sessionId: "pi-session-123",
				cacheRetention: "long",
				reasoningEffort: "medium",
			},
		);

		expect(captured.url).toBe("https://api.x.ai/v1/responses");
		expect(captured.headers.get("authorization")).toBe("Bearer xai-test-token");
		expect(captured.headers.get("session_id")).toBe("pi-session-123");
		expect(captured.body).toMatchObject({
			model: "grok-4.5",
			store: false,
			stream: true,
			prompt_cache_key: "pi-session-123",
			reasoning: { effort: "medium" },
			include: ["reasoning.encrypted_content"],
		});
		expect(captured.body).not.toHaveProperty("prompt_cache_retention");
		expect(captured.body.input).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					role: "developer",
					content: "You are a careful coding assistant.",
				}),
			]),
		);
	});
});
