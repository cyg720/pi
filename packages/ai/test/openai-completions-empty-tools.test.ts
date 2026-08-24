/**
 * 文件职责：回归验证 OpenAI Completions 对空工具数组、最大令牌和 Cloudflare 网关兼容字段的序列化。
 * 技术维度：使用 Vitest 提升式 OpenAI SDK mock，捕获请求参数和客户端选项并返回固定异步流。
 * 产品维度：避免 DashScope 等兼容后端拒绝 tools: []，同时保证令牌上限、网关认证和会话亲和正确。
 * 逻辑维度：mock chat.completions，先覆盖工具字段和 maxTokens，再检查 Cloudflare URL、认证和工具历史。
 * 关键边界：无工具历史时空数组应省略，有工具历史时需保留；Cloudflare 环境变量会在进程中临时设置。
 * 新手阅读建议：先看顶部回归说明和前两个空工具用例，再读 maxTokens，最后关注 Cloudflare 特例。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getModel, streamSimple } from "../src/compat.ts";

// Empty tools arrays must NOT be serialized as `tools: []` — some OpenAI-compatible
// backends (e.g. DashScope / Aliyun Qwen via compatible-mode) reject the request with
// `"[] is too short - 'tools'"` (HTTP 400) when `--no-tools` produces an empty array.
// Regression for https://github.com/earendil-works/pi-mono/issues/<issue-number>
// 空工具数组不能无条件序列化为 tools: []；部分兼容后端会返回 HTTP 400，但存在工具历史时仍需保留该字段。

/** 保存最后一次 Completions 请求参数和客户端构造选项。 */
const mockState = vi.hoisted(() => ({
	lastParams: undefined as unknown,
	lastClientOptions: undefined as unknown,
}));

vi.mock("openai", () => {
	/** 捕获选项并提供固定成功流的假 OpenAI 客户端。 */
	class FakeOpenAI {
		/** @param options 被测适配器生成的客户端配置。 */
		constructor(options: unknown) {
			mockState.lastClientOptions = options;
		}

		/** 最小 chat.completions API。 */
		chat = {
			completions: {
				create: (params: unknown) => {
					mockState.lastParams = params;
					/** 只产出一次 stop 与固定用量的异步流。 */
					const stream = {
						async *[Symbol.asyncIterator]() {
							yield {
								choices: [{ delta: {}, finish_reason: "stop" }],
								usage: {
									prompt_tokens: 1,
									completion_tokens: 1,
									prompt_tokens_details: { cached_tokens: 0 },
									completion_tokens_details: { reasoning_tokens: 0 },
								},
							};
						},
					};
					/** 兼容 SDK withResponse 的流 Promise。 */
					const promise = Promise.resolve(stream) as Promise<typeof stream> & {
						withResponse: () => Promise<{
							data: typeof stream;
							response: { status: number; headers: Headers };
						}>;
					};
					promise.withResponse = async () => ({
						data: stream,
						response: { status: 200, headers: new Headers() },
					});
					return promise;
				},
			},
		};
	}

	return { default: FakeOpenAI };
});

/** 覆盖空工具字段、令牌上限与 Cloudflare 兼容请求。 */
describe("openai-completions empty tools handling", () => {
	/** 每个用例前清空捕获状态。 */
	beforeEach(() => {
		mockState.lastParams = undefined;
		mockState.lastClientOptions = undefined;
	});

	it("omits tools field when context.tools is an empty array", async () => {
		/** 去除原 compat 的内置 OpenAI 模型字段。 */
		const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini")!;
		/** 强制使用 Completions API 的测试模型。 */
		const model = { ...baseModel, api: "openai-completions" } as const;

		await streamSimple(
			model,
			{
				messages: [{ role: "user", content: "hi", timestamp: Date.now() }],
				tools: [],
			},
			{ apiKey: "test" },
		).result();

		/** 捕获的请求参数。 */
		const params = mockState.lastParams as { tools?: unknown };
		expect("tools" in (params as object)).toBe(false);
	});

	it("omits tools field when context.tools is undefined", async () => {
		/** 去除原 compat 的内置模型字段。 */
		const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini")!;
		/** 无 tools 字段场景的 Completions 模型。 */
		const model = { ...baseModel, api: "openai-completions" } as const;

		await streamSimple(
			model,
			{
				messages: [{ role: "user", content: "hi", timestamp: Date.now() }],
			},
			{ apiKey: "test" },
		).result();

		/** 捕获的请求参数。 */
		const params = mockState.lastParams as { tools?: unknown };
		expect("tools" in (params as object)).toBe(false);
	});

	it("sends default maxTokens", async () => {
		/** 去除原 compat 的内置模型字段。 */
		const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini")!;
		/** 默认 maxTokens 场景模型。 */
		const model = { ...baseModel, api: "openai-completions" } as const;

		await streamSimple(
			model,
			{
				messages: [{ role: "user", content: "hi", timestamp: Date.now() }],
			},
			{ apiKey: "test" },
		).result();

		/** 捕获的令牌字段。 */
		const params = mockState.lastParams as { max_tokens?: number; max_completion_tokens?: number };
		expect(params.max_tokens).toBeUndefined();
		expect(params.max_completion_tokens).toBe(model.maxTokens);
	});

	it("sends explicit maxTokens", async () => {
		/** 去除原 compat 的内置模型字段。 */
		const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini")!;
		/** 显式 maxTokens 场景模型。 */
		const model = { ...baseModel, api: "openai-completions" } as const;

		await streamSimple(
			model,
			{
				messages: [{ role: "user", content: "hi", timestamp: Date.now() }],
			},
			{ apiKey: "test", maxTokens: 1234 },
		).result();

		/** 捕获的令牌字段。 */
		const params = mockState.lastParams as { max_tokens?: number; max_completion_tokens?: number };
		expect(params.max_tokens).toBeUndefined();
		expect(params.max_completion_tokens).toBe(1234);
	});

	it("clamps default maxTokens to remaining context", async () => {
		/** 去除原 compat 的内置模型字段。 */
		const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini")!;
		/** 上下文窗口小于模型默认输出上限的模型。 */
		const model = { ...baseModel, api: "openai-completions", contextWindow: 10000, maxTokens: 8000 } as const;

		await streamSimple(
			model,
			{
				messages: [{ role: "user", content: "x".repeat(8000), timestamp: Date.now() }],
			},
			{ apiKey: "test" },
		).result();

		/** 捕获的默认令牌字段。 */
		const params = mockState.lastParams as { max_tokens?: number; max_completion_tokens?: number };
		expect(params.max_tokens).toBeUndefined();
		expect(params.max_completion_tokens).toBe(3904);
	});

	it("clamps explicit maxTokens to remaining context", async () => {
		/** 去除原 compat 的内置模型字段。 */
		const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini")!;
		/** 显式输出上限仍需按剩余上下文裁剪的模型。 */
		const model = { ...baseModel, api: "openai-completions", contextWindow: 10000, maxTokens: 8000 } as const;

		await streamSimple(
			model,
			{
				messages: [{ role: "user", content: "x".repeat(8000), timestamp: Date.now() }],
			},
			{ apiKey: "test", maxTokens: 7000 },
		).result();

		/** 捕获的显式令牌字段。 */
		const params = mockState.lastParams as { max_tokens?: number; max_completion_tokens?: number };
		expect(params.max_tokens).toBeUndefined();
		expect(params.max_completion_tokens).toBe(3904);
	});

	it("uses conservative OpenAI-compatible fields for Cloudflare AI Gateway /compat models", async () => {
		process.env.CLOUDFLARE_API_KEY = "cf-token";
		process.env.CLOUDFLARE_ACCOUNT_ID = "account-id";
		process.env.CLOUDFLARE_GATEWAY_ID = "gateway-id";
		/** 通过 Cloudflare /compat 调用 Workers AI 的模型。 */
		const model = getModel("cloudflare-ai-gateway", "workers-ai/@cf/moonshotai/kimi-k2.6")!;

		await streamSimple(
			model,
			{
				systemPrompt: "You are helpful.",
				messages: [{ role: "user", content: "hi", timestamp: Date.now() }],
			},
			{ maxTokens: 1234, reasoning: "high" },
		).result();

		/** Cloudflare 请求捕获的兼容字段。 */
		const params = mockState.lastParams as {
			messages: Array<{ role: string }>;
			max_tokens?: number;
			max_completion_tokens?: number;
			reasoning_effort?: string;
			store?: boolean;
		};
		expect(params.messages[0].role).toBe("system");
		expect(params.max_tokens).toBe(1234);
		expect(params.max_completion_tokens).toBeUndefined();
		expect(params.reasoning_effort).toBeUndefined();
		expect(params.store).toBeUndefined();

		/** Cloudflare OpenAI 客户端构造选项。 */
		const clientOptions = mockState.lastClientOptions as {
			baseURL?: string;
			defaultHeaders?: Record<string, unknown>;
		};
		expect(clientOptions.baseURL).toBe("https://gateway.ai.cloudflare.com/v1/account-id/gateway-id/compat");
		expect(clientOptions.defaultHeaders?.Authorization).toBeNull();
		expect(clientOptions.defaultHeaders?.["cf-aig-authorization"]).toBe("Bearer cf-token");
	});

	it("resolves Cloudflare AI Gateway base URL through provider auth", async () => {
		process.env.CLOUDFLARE_API_KEY = "cf-token";
		process.env.CLOUDFLARE_ACCOUNT_ID = "account-id";
		process.env.CLOUDFLARE_GATEWAY_ID = "gateway-id";
		/** 需要通过认证环境解析网关 URL 的模型。 */
		const model = getModel("cloudflare-ai-gateway", "workers-ai/@cf/moonshotai/kimi-k2.6")!;

		await streamSimple(model, {
			messages: [{ role: "user", content: "hi", timestamp: Date.now() }],
		}).result();

		/** 捕获的 Cloudflare 基础 URL。 */
		const clientOptions = mockState.lastClientOptions as { baseURL?: string };
		expect(clientOptions.baseURL).toBe("https://gateway.ai.cloudflare.com/v1/account-id/gateway-id/compat");
	});

	it("preserves inline upstream Authorization for Cloudflare AI Gateway BYOK requests", async () => {
		process.env.CLOUDFLARE_API_KEY = "cf-token";
		process.env.CLOUDFLARE_ACCOUNT_ID = "account-id";
		process.env.CLOUDFLARE_GATEWAY_ID = "gateway-id";
		/** 使用上游 OpenAI BYOK 的 Cloudflare 模型。 */
		const model = getModel("cloudflare-ai-gateway", "gpt-5.1")!;

		await streamSimple(
			model,
			{
				messages: [{ role: "user", content: "hi", timestamp: Date.now() }],
			},
			{ headers: { Authorization: "Bearer upstream-token" } },
		).result();

		/** 同时含 Cloudflare 与上游认证的客户端头。 */
		const clientOptions = mockState.lastClientOptions as { defaultHeaders?: Record<string, unknown> };
		expect(clientOptions.defaultHeaders?.Authorization).toBe("Bearer upstream-token");
		expect(clientOptions.defaultHeaders?.["cf-aig-authorization"]).toBe("Bearer cf-token");
	});

	it("sends session affinity headers for Workers AI through Cloudflare AI Gateway", async () => {
		process.env.CLOUDFLARE_API_KEY = "cf-token";
		process.env.CLOUDFLARE_ACCOUNT_ID = "account-id";
		process.env.CLOUDFLARE_GATEWAY_ID = "gateway-id";
		/** 需要会话亲和的 Workers AI 模型。 */
		const workersModel = getModel("cloudflare-ai-gateway", "workers-ai/@cf/moonshotai/kimi-k2.6")!;

		await streamSimple(
			workersModel,
			{
				messages: [{ role: "user", content: "hi", timestamp: Date.now() }],
			},
			{ sessionId: "session-1" },
		).result();

		/** 捕获的三种会话亲和头。 */
		const clientOptions = mockState.lastClientOptions as { defaultHeaders?: Record<string, string> };
		expect(clientOptions.defaultHeaders?.session_id).toBe("session-1");
		expect(clientOptions.defaultHeaders?.["x-client-request-id"]).toBe("session-1");
		expect(clientOptions.defaultHeaders?.["x-session-affinity"]).toBe("session-1");
	});

	it("still emits tools: [] for Anthropic/LiteLLM proxy when conversation has tool history", async () => {
		/** 去除原 compat 的内置模型字段。 */
		const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini")!;
		/** 工具历史回放使用的 Completions 模型。 */
		const model = { ...baseModel, api: "openai-completions" } as const;

		await streamSimple(
			model,
			{
				messages: [
					{ role: "user", content: "use the tool", timestamp: Date.now() },
					{
						role: "assistant",
						content: [
							{
								type: "toolCall",
								id: "t1",
								name: "noop",
								arguments: {},
							},
						],
						stopReason: "toolUse",
						usage: {
							input: 0,
							output: 0,
							cacheRead: 0,
							cacheWrite: 0,
							totalTokens: 0,
							cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
						},
						api: "openai-completions",
						provider: "openai",
						model: "gpt-4o-mini",
						timestamp: Date.now(),
					},
					{
						role: "toolResult",
						toolCallId: "t1",
						toolName: "noop",
						content: [{ type: "text", text: "done" }],
						isError: false,
						timestamp: Date.now(),
					},
				],
				tools: [],
			},
			{ apiKey: "test" },
		).result();

		/** 工具历史存在时捕获的 tools 字段。 */
		const params = mockState.lastParams as { tools?: unknown[] };
		expect(Array.isArray(params.tools)).toBe(true);
		expect(params.tools).toEqual([]);
	});
});
