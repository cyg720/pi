/**
 * 文件职责：验证 OpenAI Completions 的提示缓存键、长期保留、会话亲和头和显式头覆盖规则。
 * 技术维度：使用 Vitest 提升式 OpenAI SDK mock，捕获客户端配置与 chat.completions 请求载荷。
 * 产品维度：提高同一会话的缓存命中与路由稳定性，同时适配 OpenAI、OpenRouter 和自定义代理格式。
 * 逻辑维度：创建模型和请求捕获助手，再覆盖缓存开关、环境变量、64 字符限制及三种亲和格式。
 * 关键边界：cacheRetention=none 禁用全部缓存/亲和数据；非 OpenAI 端点需显式兼容；显式头优先。
 * 新手阅读建议：先看 captureRequest 捕获 payload/headers，再按缓存字段、通用亲和、OpenRouter 格式阅读。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stream as streamOpenAICompletions } from "../src/api/openai-completions.ts";
import { getModel } from "../src/compat.ts";
import type { Model } from "../src/types.ts";

/** FakeOpenAI 构造函数中本测试关心的配置。 */
interface FakeOpenAIClientOptions {
	apiKey: string;
	baseURL: string;
	dangerouslyAllowBrowser: boolean;
	defaultHeaders?: Record<string, string>;
}

/** Completions 请求中本测试关心的缓存和会话字段。 */
interface CapturedCompletionsPayload {
	prompt_cache_key?: string;
	prompt_cache_retention?: "24h" | "in-memory" | null;
	session_id?: string;
}

/** 保存最后一次请求载荷和客户端选项的提升式 mock 状态。 */
const mockState = vi.hoisted(() => ({
	lastParams: undefined as CapturedCompletionsPayload | undefined,
	lastClientOptions: undefined as FakeOpenAIClientOptions | undefined,
}));

vi.mock("openai", () => {
	/** 捕获客户端选项并返回单块成功流的假 OpenAI 客户端。 */
	class FakeOpenAI {
		/** 最小 chat.completions API。 */
		chat = {
			completions: {
				create: (params: CapturedCompletionsPayload) => {
					mockState.lastParams = params;
					/** 产出一次 stop 块与固定用量的异步流。 */
					const stream = {
						/** 产出固定停止响应；无参数，返回可异步遍历的一次性响应块序列。 */
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
					/** 兼容 SDK withResponse 链的 Promise。 */
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

		/** @param options 被测适配器传入的客户端配置。 */
		constructor(options: FakeOpenAIClientOptions) {
			mockState.lastClientOptions = options;
		}
	}

	return { default: FakeOpenAI };
});

/** 覆盖 Completions 缓存和会话亲和字段的生成与优先级。 */
describe("openai-completions prompt caching", () => {
	/** 测试前已有的 PI_CACHE_RETENTION 环境值。 */
	const originalEnv = process.env.PI_CACHE_RETENTION;

	/** 每个用例前清空捕获状态和缓存环境覆盖。 */
	beforeEach(() => {
		mockState.lastParams = undefined;
		mockState.lastClientOptions = undefined;
		delete process.env.PI_CACHE_RETENTION;
	});

	/** 每个用例后恢复原始缓存环境值。 */
	afterEach(() => {
		if (originalEnv === undefined) {
			delete process.env.PI_CACHE_RETENTION;
		} else {
			process.env.PI_CACHE_RETENTION = originalEnv;
		}
	});

	/**
	 * 从内置 OpenAI 模型创建可覆盖字段的 Completions 模型。
	 * @param overrides 模型端点、提供商或 compat 覆盖。
	 * @returns API 强制为 openai-completions 的测试模型。
	 */
	function createModel(overrides: Partial<Model<"openai-completions">> = {}): Model<"openai-completions"> {
		/** 去除原 compat 后保留的内置模型字段。 */
		const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini");
		return {
			...(baseModel as Omit<Model<"openai-completions">, "api">),
			api: "openai-completions",
			...overrides,
		};
	}

	/**
	 * 发起一次请求并返回捕获的载荷与默认头。
	 * @param options 缓存保留、会话 ID 和显式请求头。
	 * @param model 被测模型。
	 * @returns 捕获的 payload 和 headers。
	 */
	async function captureRequest(
		options?: {
			cacheRetention?: "none" | "short" | "long";
			sessionId?: string;
			headers?: Record<string, string>;
		},
		model: Model<"openai-completions"> = createModel(),
	) {
		await streamOpenAICompletions(
			model,
			{
				systemPrompt: "sys",
				messages: [{ role: "user", content: "hi", timestamp: Date.now() }],
			},
			{ apiKey: "test-key", ...options },
		).result();

		return {
			payload: mockState.lastParams,
			headers: mockState.lastClientOptions?.defaultHeaders ?? {},
		};
	}

	it("sets prompt_cache_key for direct OpenAI requests when caching is enabled", async () => {
		/** payload 是开启缓存时捕获的直接 OpenAI 请求体。 */
		const { payload } = await captureRequest({ sessionId: "session-123" });

		expect(payload?.prompt_cache_key).toBe("session-123");
		expect(payload?.prompt_cache_retention).toBeUndefined();
	});

	it("sets prompt_cache_retention to 24h for direct OpenAI requests when cacheRetention is long", async () => {
		/** payload 是启用长期缓存时捕获的请求体，应包含 24 小时保留策略。 */
		const { payload } = await captureRequest({ cacheRetention: "long", sessionId: "session-456" });

		expect(payload?.prompt_cache_key).toBe("session-456");
		expect(payload?.prompt_cache_retention).toBe("24h");
	});

	it("clamps prompt_cache_key to OpenAI's 64-character limit", async () => {
		/** 超过 OpenAI 限制三字符的会话 ID。 */
		const sessionId = "x".repeat(67);
		/** payload 是使用超长会话 ID 构造的请求体，用于验证缓存键截断。 */
		const { payload } = await captureRequest({ sessionId });

		expect(payload?.prompt_cache_key).toBe("x".repeat(64));
	});

	it("omits prompt cache fields when cacheRetention is none", async () => {
		/** payload 是明确关闭缓存时的请求体，不应带任何提示缓存字段。 */
		const { payload } = await captureRequest({ cacheRetention: "none", sessionId: "session-789" });

		expect(payload?.prompt_cache_key).toBeUndefined();
		expect(payload?.prompt_cache_retention).toBeUndefined();
	});

	it("omits prompt cache fields for non-OpenAI base URLs without compatible long retention", async () => {
		/** 不支持长期缓存的自定义代理模型。 */
		const model = createModel({
			baseUrl: "https://proxy.example.com/v1",
			compat: { supportsLongCacheRetention: false },
		});
		/** payload 是不支持长期缓存的代理模型请求体，缓存字段应被省略。 */
		const { payload } = await captureRequest({ cacheRetention: "long", sessionId: "session-proxy" }, model);

		expect(payload?.prompt_cache_key).toBeUndefined();
		expect(payload?.prompt_cache_retention).toBeUndefined();
	});

	it("uses PI_CACHE_RETENTION for direct OpenAI requests", async () => {
		process.env.PI_CACHE_RETENTION = "long";
		/** payload 是由环境变量启用长期缓存后捕获的直接 OpenAI 请求体。 */
		const { payload } = await captureRequest({ sessionId: "session-env" });

		expect(payload?.prompt_cache_key).toBe("session-env");
		expect(payload?.prompt_cache_retention).toBe("24h");
	});

	it("sends known session-affinity headers when compat.sendSessionAffinityHeaders is enabled", async () => {
		/** 开启通用会话亲和头的自定义代理模型。 */
		const model = createModel({
			baseUrl: "https://proxy.example.com/v1",
			compat: { sendSessionAffinityHeaders: true },
		});
		/** headers 是启用会话亲和时捕获的请求头集合。 */
		const { headers } = await captureRequest({ sessionId: "session-affinity" }, model);

		expect(headers.session_id).toBe("session-affinity");
		expect(headers["x-client-request-id"]).toBe("session-affinity");
		expect(headers["x-session-affinity"]).toBe("session-affinity");
	});

	it.each(["accounts/fireworks/models/glm-5p2", "accounts/fireworks/routers/glm-5p2-fast"] as const)(
		"sends Fireworks session affinity for %s",
		async (modelId) => {
			const model = getModel("fireworks", modelId);
			const { headers } = await captureRequest({ sessionId: "fireworks-session" }, model);

			expect(headers["x-session-affinity"]).toBe("fireworks-session");
		},
	);

	it("uses OpenAI no-session format when configured", async () => {
		/** 使用 OpenAI no-session 亲和格式的模型。 */
		const model = createModel({
			compat: { sendSessionAffinityHeaders: true, sessionAffinityFormat: "openai-nosession" },
		});
		/** payload 与 headers 是 openai-nosession 格式下捕获的请求体和请求头。 */
		const { payload, headers } = await captureRequest({ sessionId: "session-nosession" }, model);

		expect(payload?.session_id).toBeUndefined();
		expect(payload?.prompt_cache_key).toBe("session-nosession");
		expect(headers.session_id).toBeUndefined();
		expect(headers["x-client-request-id"]).toBe("session-nosession");
		expect(headers["x-session-affinity"]).toBe("session-nosession");
		expect(headers["x-session-id"]).toBeUndefined();
	});

	it("uses OpenRouter session-affinity header when configured", async () => {
		/** 使用 OpenRouter 单一 x-session-id 格式的代理模型。 */
		const model = createModel({
			baseUrl: "https://proxy.example.com/v1",
			compat: { sendSessionAffinityHeaders: true, sessionAffinityFormat: "openrouter" },
		});
		/** payload 与 headers 是显式 OpenRouter 亲和格式下捕获的请求数据。 */
		const { payload, headers } = await captureRequest({ sessionId: "session-proxy" }, model);

		expect(payload?.session_id).toBeUndefined();
		expect(payload?.prompt_cache_key).toBeUndefined();
		expect(headers["x-session-id"]).toBe("session-proxy");
		expect(headers.session_id).toBeUndefined();
		expect(headers["x-client-request-id"]).toBeUndefined();
		expect(headers["x-session-affinity"]).toBeUndefined();
	});

	it("auto-detects OpenRouter session-affinity header for OpenRouter endpoints", async () => {
		/** 可从 provider/baseUrl 自动判断 OpenRouter 格式的模型。 */
		const model = createModel({
			provider: "openrouter",
			baseUrl: "https://openrouter.ai/api/v1",
			compat: { sendSessionAffinityHeaders: true },
		});
		/** payload 与 headers 是 OpenRouter 兼容模型请求数据，用于确认不发送 OpenAI 私有字段。 */
		const { payload, headers } = await captureRequest({ sessionId: "session-openrouter" }, model);

		expect(payload?.session_id).toBeUndefined();
		expect(payload?.prompt_cache_key).toBeUndefined();
		expect(headers["x-session-id"]).toBe("session-openrouter");
		expect(headers.session_id).toBeUndefined();
		expect(headers["x-client-request-id"]).toBeUndefined();
		expect(headers["x-session-affinity"]).toBeUndefined();
	});

	it("omits OpenRouter session-affinity data when disabled", async () => {
		/** 未开启亲和兼容开关的 OpenRouter 模型。 */
		const model = createModel({
			provider: "openrouter",
			baseUrl: "https://openrouter.ai/api/v1",
		});
		/** payload 与 headers 是按基础地址识别出的 OpenRouter 请求数据。 */
		const { payload, headers } = await captureRequest({ sessionId: "session-openrouter" }, model);

		expect(payload?.session_id).toBeUndefined();
		expect(payload?.prompt_cache_key).toBeUndefined();
		expect(headers["x-session-id"]).toBeUndefined();
	});

	it("omits session-affinity headers when cacheRetention is none", async () => {
		/** 开启亲和头但请求禁用缓存的代理模型。 */
		const model = createModel({
			baseUrl: "https://proxy.example.com/v1",
			compat: { sendSessionAffinityHeaders: true },
		});
		/** headers 是关闭缓存时捕获的亲和请求头，相关会话字段应省略。 */
		const { headers } = await captureRequest({ cacheRetention: "none", sessionId: "session-affinity" }, model);

		expect(headers.session_id).toBeUndefined();
		expect(headers["x-client-request-id"]).toBeUndefined();
		expect(headers["x-session-affinity"]).toBeUndefined();
	});

	it("lets explicit headers override generated session-affinity headers", async () => {
		/** 用于验证显式头最高优先级的代理模型。 */
		const model = createModel({
			baseUrl: "https://proxy.example.com/v1",
			compat: { sendSessionAffinityHeaders: true },
		});
		/** headers 是带调用方自定义亲和头时捕获的结果，用于验证显式值优先。 */
		const { headers } = await captureRequest(
			{
				sessionId: "session-affinity",
				headers: {
					session_id: "override-session",
					"x-client-request-id": "override-request",
					"x-session-affinity": "override-affinity",
				},
			},
			model,
		);

		expect(headers.session_id).toBe("override-session");
		expect(headers["x-client-request-id"]).toBe("override-request");
		expect(headers["x-session-affinity"]).toBe("override-affinity");
	});
});
