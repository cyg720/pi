/**
 * 文件职责：验证 OpenAI Responses 兼容层的 reasoning、工具选择、会话亲和头、缓存键和服务等级成本。
 * 技术维度：使用 Vitest、fetch spy、SSE 响应、TypeBox 工具模式和多提供商模型元数据执行离线请求断言。
 * 产品维度：保证 OpenAI 及兼容代理服务收到正确请求字段，并按会话稳定路由且准确计算 Token 成本。
 * 逻辑维度：先定义请求头捕获器，再测试默认 payload、模型差异、亲和格式、显式覆盖和成本倍率。
 * 关键边界：prompt_cache_key 最长 64 字符；不同代理使用不同会话头，cacheRetention=none 时不得发送亲和信息。
 * 新手阅读建议：先读 captureOpenAIResponseHeaders，再看 reasoning 与 toolChoice，最后对比三种亲和格式。
 */
import { Type } from "typebox";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stream as streamOpenAIResponses } from "../src/api/openai-responses.ts";
import { getModel } from "../src/compat.ts";
import type { Model } from "../src/types.ts";

/** fetch init 允许出现的几种请求头表示形式。 */
type CapturedHeaders = Headers | string[][] | Record<string, string | readonly string[]> | undefined;

/** 描述本文件会从 Responses 请求体读取的会话亲和字段。 */
interface CapturedResponsesPayload {
	/** OpenAI 缓存路由键，最长 64 字符。 */
	prompt_cache_key?: string;
	/** 某些兼容端点接受的会话编号字段。 */
	session_id?: string;
}

/** 从多种 Headers 表示中按名称取值。参数 headers 为请求头、name 为目标名；返回字符串或 null。例如：getHeader(headers, "session_id")。 */
function getHeader(headers: CapturedHeaders, name: string): string | null {
	if (!headers) return null;
	if (headers instanceof Headers) return headers.get(name);

	/** 待查询请求头名称的小写形式，用于不区分大小写比较。 */
	const lowerName = name.toLowerCase();
	if (Array.isArray(headers)) {
		/** 数组形式 headers 中第一个名称匹配项。 */
		const match = headers.find(([key]) => key?.toLowerCase() === lowerName);
		return match?.[1] ?? null;
	}

	for (const [key, value] of Object.entries(headers)) {
		if (key.toLowerCase() === lowerName) return typeof value === "string" ? value : value.join(", ");
	}
	return null;
}

/** 发起一次模拟 Responses 请求并捕获会话头。参数 options 为流选项、model 为目标模型；返回三类头值。例如：await captureOpenAIResponseHeaders({ sessionId: "s" })。 */
async function captureOpenAIResponseHeaders(
	options: Parameters<typeof streamOpenAIResponses>[2],
	model: Model<"openai-responses"> = getModel("openai", "gpt-5.4"),
): Promise<{
	/** session_id 请求头值。 */
	sessionId: string | null;
	/** x-client-request-id 请求头值。 */
	clientRequestId: string | null;
	/** x-session-id 请求头值。 */
	xSessionId: string | null;
}> {
	/** 记录 fetch 实际收到的三类会话亲和请求头。 */
	const captured = {
		sessionId: null as string | null,
		clientRequestId: null as string | null,
		xSessionId: null as string | null,
	};
	vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
		captured.sessionId = getHeader(init?.headers, "session_id");
		captured.clientRequestId = getHeader(init?.headers, "x-client-request-id");
		captured.xSessionId = getHeader(init?.headers, "x-session-id");
		return new Response("data: [DONE]\n\n", {
			status: 200,
			headers: { "content-type": "text/event-stream" },
		});
	});

	/** 当前 OpenAI Responses 调用返回的助手事件流。 */
	const stream = streamOpenAIResponses(
		model,
		{
			systemPrompt: "sys",
			messages: [{ role: "user", content: "hi", timestamp: Date.now() }],
		},
		{ apiKey: "test-key", ...options },
	);

	// event 依次表示流中的增量事件，完成或错误后停止消费。
	for await (const event of stream) {
		if (event.type === "done" || event.type === "error") break;
	}

	return captured;
}

describe("openai-responses provider defaults", () => {
	// 每个用例后恢复 fetch 等所有 Vitest spy。
	afterEach(() => {
		vi.restoreAllMocks();
	});

	// 测试场景：验证“omits reasoning when no reasoning is requested”对应的 Responses 兼容行为。
	it("omits reasoning when no reasoning is requested", async () => {
		/** 当前用例查询到的 OpenAI 或兼容模型。 */
		const model = getModel("github-copilot", "gpt-5-mini");
		/** onPayload 捕获的实际请求体，用于检查字段是否存在和值是否正确。 */
		let capturedPayload: unknown;

		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("data: [DONE]\n\n", {
				status: 200,
				headers: { "content-type": "text/event-stream" },
			}),
		);

		/** 当前 OpenAI Responses 调用返回的助手事件流。 */
		const stream = streamOpenAIResponses(
			model,
			{
				systemPrompt: "sys",
				messages: [{ role: "user", content: "hi", timestamp: Date.now() }],
			},
			{
				apiKey: "test-key",
				onPayload: (payload) => {
					capturedPayload = payload;
				},
			},
		);

		// event 依次表示流中的增量事件，完成或错误后停止消费。
		for await (const event of stream) {
			if (event.type === "done" || event.type === "error") break;
		}

		expect(capturedPayload).not.toBeNull();
		expect(capturedPayload).not.toMatchObject({
			reasoning: expect.anything(),
		});
	});

	// 测试场景：验证“forwards required tool choice”对应的 Responses 兼容行为。
	it("forwards required tool choice", async () => {
		/** onPayload 捕获的实际请求体，用于检查字段是否存在和值是否正确。 */
		let capturedPayload: unknown;

		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("data: [DONE]\n\n", {
				status: 200,
				headers: { "content-type": "text/event-stream" },
			}),
		);

		/** 当前 OpenAI Responses 调用返回的助手事件流。 */
		const stream = streamOpenAIResponses(
			getModel("openai", "gpt-5.4"),
			{
				messages: [
					{
						role: "user",
						content: "Do not call ping. Respond with text instead.",
						timestamp: Date.now(),
					},
				],
				tools: [
					{
						name: "ping",
						description: "Ping",
						parameters: Type.Object({ value: Type.String() }),
					},
				],
			},
			{
				apiKey: "test-key",
				toolChoice: "required",
				onPayload: (payload) => {
					capturedPayload = payload;
				},
			},
		);

		// event 依次表示流中的增量事件，完成或错误后停止消费。
		for await (const event of stream) {
			if (event.type === "done" || event.type === "error") break;
		}

		expect(capturedPayload).toMatchObject({
			tool_choice: "required",
			tools: [expect.objectContaining({ name: "ping" })],
		});
	});

	// 参数化场景：对列出的模型或服务等级逐项验证相同兼容规则。
	it.each([
		"gpt-5.1",
		"gpt-5.2",
		"gpt-5.3-codex",
		"gpt-5.4",
		"gpt-5.4-mini",
		"gpt-5.4-nano",
		"gpt-5.5",
		"gpt-5.6-sol",
		"gpt-5.6-terra",
		"gpt-5.6-luna",
	] as const)("sends none reasoning effort for OpenAI %s when no reasoning is requested", async (modelId) => {
		/** 当前用例查询到的 OpenAI 或兼容模型。 */
		const model = getModel("openai", modelId);
		/** onPayload 捕获的实际请求体，用于检查字段是否存在和值是否正确。 */
		let capturedPayload: unknown;

		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("data: [DONE]\n\n", {
				status: 200,
				headers: { "content-type": "text/event-stream" },
			}),
		);

		/** 当前 OpenAI Responses 调用返回的助手事件流。 */
		const stream = streamOpenAIResponses(
			model,
			{
				systemPrompt: "sys",
				messages: [{ role: "user", content: "hi", timestamp: Date.now() }],
			},
			{
				apiKey: "test-key",
				onPayload: (payload) => {
					capturedPayload = payload;
				},
			},
		);

		// event 依次表示流中的增量事件，完成或错误后停止消费。
		for await (const event of stream) {
			if (event.type === "done" || event.type === "error") break;
		}

		expect(capturedPayload).toMatchObject({
			reasoning: { effort: "none" },
		});
	});

	// 参数化场景：对列出的模型或服务等级逐项验证相同兼容规则。
	it.each(["gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-5-pro", "gpt-5.2-pro", "gpt-5.4-pro", "gpt-5.5-pro"] as const)(
		"omits reasoning effort for OpenAI %s when off is unsupported",
		async (modelId) => {
			/** 当前用例查询到的 OpenAI 或兼容模型。 */
			const model = getModel("openai", modelId);
			/** onPayload 捕获的实际请求体，用于检查字段是否存在和值是否正确。 */
			let capturedPayload: unknown;

			vi.spyOn(globalThis, "fetch").mockResolvedValue(
				new Response("data: [DONE]\n\n", {
					status: 200,
					headers: { "content-type": "text/event-stream" },
				}),
			);

			/** 当前 OpenAI Responses 调用返回的助手事件流。 */
			const stream = streamOpenAIResponses(
				model,
				{
					systemPrompt: "sys",
					messages: [{ role: "user", content: "hi", timestamp: Date.now() }],
				},
				{
					apiKey: "test-key",
					onPayload: (payload) => {
						capturedPayload = payload;
					},
				},
			);

			// event 依次表示流中的增量事件，完成或错误后停止消费。
			for await (const event of stream) {
				if (event.type === "done" || event.type === "error") break;
			}

			expect(capturedPayload).not.toMatchObject({
				reasoning: expect.anything(),
			});
		},
	);

	// 测试场景：验证“sets cache-affinity headers for official OpenAI Responses requests with a sessionId”对应的 Responses 兼容行为。
	it("sets cache-affinity headers for official OpenAI Responses requests with a sessionId", async () => {
		/** 记录 fetch 实际收到的三类会话亲和请求头。 */
		const captured = await captureOpenAIResponseHeaders({ sessionId: "session-123" });

		expect(captured.sessionId).toBe("session-123");
		expect(captured.clientRequestId).toBe("session-123");
	});

	// 测试场景：验证“clamps prompt_cache_key to OpenAI's 64-character limit”对应的 Responses 兼容行为。
	it("clamps prompt_cache_key to OpenAI's 64-character limit", async () => {
		/** 超过 OpenAI 缓存键长度限制的测试会话编号。 */
		const sessionId = "x".repeat(67);
		/** onPayload 捕获的实际请求体，用于检查字段是否存在和值是否正确。 */
		let capturedPayload: Pick<CapturedResponsesPayload, "prompt_cache_key"> | undefined;
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("data: [DONE]\n\n", {
				status: 200,
				headers: { "content-type": "text/event-stream" },
			}),
		);

		/** 当前 OpenAI Responses 调用返回的助手事件流。 */
		const stream = streamOpenAIResponses(
			getModel("openai", "gpt-5.4"),
			{
				systemPrompt: "sys",
				messages: [{ role: "user", content: "hi", timestamp: Date.now() }],
			},
			{
				apiKey: "test-key",
				sessionId,
				onPayload: (payload) => {
					capturedPayload = payload as Pick<CapturedResponsesPayload, "prompt_cache_key">;
				},
			},
		);

		// event 依次表示流中的增量事件，完成或错误后停止消费。
		for await (const event of stream) {
			if (event.type === "done" || event.type === "error") break;
		}

		expect(capturedPayload?.prompt_cache_key).toBe("x".repeat(64));
	});

	// 测试场景：验证“sets cache-affinity headers for proxy OpenAI Responses requests with a sessionId”对应的 Responses 兼容行为。
	it("sets cache-affinity headers for proxy OpenAI Responses requests with a sessionId", async () => {
		/** 显式模拟兼容代理端点及亲和格式的模型副本。 */
		const proxyModel: Model<"openai-responses"> = {
			...getModel("openai", "gpt-5.4"),
			provider: "opencode",
			baseUrl: "https://proxy.example.com/v1",
		};
		/** 记录 fetch 实际收到的三类会话亲和请求头。 */
		const captured = await captureOpenAIResponseHeaders({ sessionId: "session-123" }, proxyModel);

		expect(captured.sessionId).toBe("session-123");
		expect(captured.clientRequestId).toBe("session-123");
	});

	// 测试场景：验证“uses OpenRouter session-affinity header when configured”对应的 Responses 兼容行为。
	it("uses OpenRouter session-affinity header when configured", async () => {
		/** 显式模拟兼容代理端点及亲和格式的模型副本。 */
		const proxyModel: Model<"openai-responses"> = {
			...getModel("openai", "gpt-5.4"),
			provider: "proxy",
			baseUrl: "https://proxy.example.com/v1",
			compat: { sessionAffinityFormat: "openrouter" },
		};
		/** onPayload 捕获的实际请求体，用于检查字段是否存在和值是否正确。 */
		let capturedPayload: CapturedResponsesPayload | undefined;
		/** 记录 fetch 实际收到的三类会话亲和请求头。 */
		const captured = await captureOpenAIResponseHeaders(
			{
				sessionId: "session-proxy",
				onPayload: (payload) => {
					capturedPayload = payload as CapturedResponsesPayload;
				},
			},
			proxyModel,
		);

		expect(captured.sessionId).toBeNull();
		expect(captured.clientRequestId).toBeNull();
		expect(captured.xSessionId).toBe("session-proxy");
		expect(capturedPayload?.session_id).toBeUndefined();
		expect(capturedPayload?.prompt_cache_key).toBe("session-proxy");
	});

	// 测试场景：验证“auto-detects OpenRouter session-affinity header for OpenRouter Responses endpoints”对应的 Responses 兼容行为。
	it("auto-detects OpenRouter session-affinity header for OpenRouter Responses endpoints", async () => {
		/** 指向 OpenRouter Responses 端点、用于自动检测亲和格式的模型。 */
		const openRouterModel: Model<"openai-responses"> = {
			...getModel("openai", "gpt-5.4"),
			provider: "openrouter",
			baseUrl: "https://openrouter.ai/api/v1",
		};
		/** onPayload 捕获的实际请求体，用于检查字段是否存在和值是否正确。 */
		let capturedPayload: CapturedResponsesPayload | undefined;
		/** 记录 fetch 实际收到的三类会话亲和请求头。 */
		const captured = await captureOpenAIResponseHeaders(
			{
				sessionId: "session-openrouter",
				onPayload: (payload) => {
					capturedPayload = payload as CapturedResponsesPayload;
				},
			},
			openRouterModel,
		);

		expect(captured.sessionId).toBeNull();
		expect(captured.clientRequestId).toBeNull();
		expect(captured.xSessionId).toBe("session-openrouter");
		expect(capturedPayload?.session_id).toBeUndefined();
		expect(capturedPayload?.prompt_cache_key).toBe("session-openrouter");
	});

	// 测试场景：验证“uses OpenAI no-session format when configured”对应的 Responses 兼容行为。
	it("uses OpenAI no-session format when configured", async () => {
		/** 显式模拟兼容代理端点及亲和格式的模型副本。 */
		const proxyModel: Model<"openai-responses"> = {
			...getModel("openai", "gpt-5.4"),
			provider: "proxy",
			baseUrl: "https://proxy.example.com/v1",
			compat: { sessionAffinityFormat: "openai-nosession" },
		};
		/** onPayload 捕获的实际请求体，用于检查字段是否存在和值是否正确。 */
		let capturedPayload: CapturedResponsesPayload | undefined;
		/** 记录 fetch 实际收到的三类会话亲和请求头。 */
		const captured = await captureOpenAIResponseHeaders(
			{
				sessionId: "session-proxy",
				onPayload: (payload) => {
					capturedPayload = payload as CapturedResponsesPayload;
				},
			},
			proxyModel,
		);

		expect(captured.sessionId).toBeNull();
		expect(captured.clientRequestId).toBe("session-proxy");
		expect(captured.xSessionId).toBeNull();
		expect(capturedPayload?.session_id).toBeUndefined();
		expect(capturedPayload?.prompt_cache_key).toBe("session-proxy");
	});

	// 测试场景：验证“uses OpenAI no-session format for OpenCode Responses models”对应的 Responses 兼容行为。
	it("uses OpenAI no-session format for OpenCode Responses models", async () => {
		/** 当前用例查询到的 OpenAI 或兼容模型。 */
		const model = getModel("opencode", "gpt-5.4");
		/** onPayload 捕获的实际请求体，用于检查字段是否存在和值是否正确。 */
		let capturedPayload: CapturedResponsesPayload | undefined;
		/** 记录 fetch 实际收到的三类会话亲和请求头。 */
		const captured = await captureOpenAIResponseHeaders(
			{
				sessionId: "session-opencode",
				onPayload: (payload) => {
					capturedPayload = payload as CapturedResponsesPayload;
				},
			},
			model,
		);

		expect(model.compat?.sessionAffinityFormat).toBe("openai-nosession");
		expect(captured.sessionId).toBeNull();
		expect(captured.clientRequestId).toBe("session-opencode");
		expect(captured.xSessionId).toBeNull();
		expect(capturedPayload?.prompt_cache_key).toBe("session-opencode");
	});

	// 测试场景：验证“can omit OpenAI session_id header while preserving other affinity data”对应的 Responses 兼容行为。
	it("can omit OpenAI session_id header while preserving other affinity data", async () => {
		/** 显式模拟兼容代理端点及亲和格式的模型副本。 */
		const proxyModel: Model<"openai-responses"> = {
			...getModel("openai", "gpt-5.4"),
			provider: "opencode",
			baseUrl: "https://proxy.example.com/v1",
			compat: { sessionAffinityFormat: "openai-nosession" },
		};
		/** onPayload 捕获的实际请求体，用于检查字段是否存在和值是否正确。 */
		let capturedPayload: CapturedResponsesPayload | undefined;
		/** 记录 fetch 实际收到的三类会话亲和请求头。 */
		const captured = await captureOpenAIResponseHeaders(
			{
				sessionId: "session-123",
				onPayload: (payload) => {
					capturedPayload = payload as CapturedResponsesPayload;
				},
			},
			proxyModel,
		);

		expect(captured.sessionId).toBeNull();
		expect(captured.clientRequestId).toBe("session-123");
		expect(capturedPayload?.prompt_cache_key).toBe("session-123");
	});

	// 测试场景：验证“lets explicit headers override the default OpenAI cache-affinity headers”对应的 Responses 兼容行为。
	it("lets explicit headers override the default OpenAI cache-affinity headers", async () => {
		/** 记录 fetch 实际收到的三类会话亲和请求头。 */
		const captured = await captureOpenAIResponseHeaders({
			sessionId: "session-123",
			headers: {
				session_id: "override-session",
				"x-client-request-id": "override-request",
			},
		});

		expect(captured.sessionId).toBe("override-session");
		expect(captured.clientRequestId).toBe("override-request");
	});

	// 测试场景：验证“omits OpenAI cache-affinity headers when cacheRetention is none”对应的 Responses 兼容行为。
	it("omits OpenAI cache-affinity headers when cacheRetention is none", async () => {
		/** 记录 fetch 实际收到的三类会话亲和请求头。 */
		const captured = await captureOpenAIResponseHeaders({ cacheRetention: "none", sessionId: "session-123" });

		expect(captured.sessionId).toBeNull();
		expect(captured.clientRequestId).toBeNull();
	});

	// 参数化场景：对列出的模型或服务等级逐项验证相同兼容规则。
	it.each([
		["gpt-5.4", "priority", 2],
		["gpt-5.5", "priority", 2.5],
		["gpt-5.5", "flex", 0.5],
	] as const)("applies %s %s service-tier cost multiplier", async (modelId, serviceTier, multiplier) => {
		/** 当前用例查询到的 OpenAI 或兼容模型。 */
		const model = getModel("openai", modelId);
		/** 构造成本断言使用的输入与输出 Token 数。 */
		const tokenCount = 100_000;
		/** 把 Token 数换算为每百万 Token 计价单位的比例。 */
		const tokenScale = tokenCount / 1_000_000;
		/** 包含 completed 事件、服务等级和用量的模拟 SSE 文本。 */
		const sse = `${[
			`data: ${JSON.stringify({
				type: "response.completed",
				response: {
					status: "completed",
					service_tier: serviceTier,
					usage: {
						input_tokens: tokenCount,
						output_tokens: tokenCount,
						total_tokens: tokenCount * 2,
						input_tokens_details: { cached_tokens: 0 },
					},
				},
			})}`,
		].join("\n\n")}\n\n`;

		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(sse, {
				status: 200,
				headers: { "content-type": "text/event-stream" },
			}),
		);

		/** 当前 OpenAI Responses 调用返回的助手事件流。 */
		const stream = streamOpenAIResponses(
			model,
			{
				systemPrompt: "sys",
				messages: [{ role: "user", content: "hi", timestamp: Date.now() }],
			},
			{ apiKey: "test-key", serviceTier },
		);

		/** 消费完整 SSE 后得到的助手消息结果。 */
		const result = await stream.result();

		expect(result.usage.cost.input).toBe(model.cost.input * multiplier * tokenScale);
		expect(result.usage.cost.output).toBe(model.cost.output * multiplier * tokenScale);
		expect(result.usage.cost.total).toBe((model.cost.input + model.cost.output) * multiplier * tokenScale);
	});
});
