/**
 * 文件职责：验证 Anthropic 的 AUTH_TOKEN、OAUTH_TOKEN 和显式 Authorization Header 采用不同认证解析与请求塑形。
 * 技术维度：使用 Vitest 提升状态、模拟 @anthropic-ai/sdk、最小 SSE 响应和真实 Models/Provider 流链路。
 * 产品维度：支持网关 Bearer Token 与 Anthropic OAuth 并存，确保显式请求头可覆盖环境认证且不误启 OAuth Beta。
 * 逻辑维度：先模拟 SDK 并捕获构造/请求参数，再测试提供商解析、直接流和 authContext 贯穿行为。
 * 关键边界：AUTH_TOKEN 只生成 Authorization Header；OAUTH_TOKEN 使用 authToken 并启用 OAuth Beta；测试不发网。
 * 新手阅读建议：先看 FakeAnthropic 捕获点，再比较六个用例中 apiKey、authToken、defaultHeaders 和 Beta 头。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { stream as streamAnthropic } from "../src/api/anthropic-messages.ts";
import { ANTHROPIC_AUTH_TOKEN_ENV, ANTHROPIC_OAUTH_TOKEN_ENV } from "../src/env-api-keys.ts";
import { createModels } from "../src/models.ts";
import { anthropicProvider } from "../src/providers/anthropic.ts";
import type { Context, Model } from "../src/types.ts";

// mockState 保存最近一次 SDK 构造选项和 messages.create 参数。
const mockState = vi.hoisted(() => ({
	constructorOpts: undefined as Record<string, unknown> | undefined,
	createParams: undefined as Record<string, unknown> | undefined,
}));

// 用最小伪 SDK 替换 Anthropic 客户端，避免真实网络并暴露认证参数。
vi.mock("@anthropic-ai/sdk", () => {
	/** 创建包含 start/delta/stop 的最小成功 SSE Response；无参数；返回 Response。 */
	function createSseResponse(): Response {
		// body 是三段 Anthropic SSE 事件拼接后的响应正文。
		const body = [
			`event: message_start\ndata: ${JSON.stringify({
				type: "message_start",
				message: {
					id: "msg_test",
					usage: { input_tokens: 1, output_tokens: 0 },
				},
			})}\n`,
			`event: message_delta\ndata: ${JSON.stringify({
				type: "message_delta",
				delta: { stop_reason: "end_turn" },
				usage: { output_tokens: 1 },
			})}\n`,
			`event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n`,
		].join("\n");

		return new Response(body, {
			status: 200,
			headers: { "content-type": "text/event-stream" },
		});
	}

	/**
	 * FakeAnthropic 模拟 SDK 客户端并捕获构造与消息请求参数。
	 * 设计目的：离线观察认证塑形；核心功能：返回成功 SSE；使用场景：本文件流测试。
	 */
	class FakeAnthropic {
		/** 参数 opts 为客户端构造选项；保存后创建实例，无额外返回。 */
		constructor(opts: Record<string, unknown>) {
			mockState.constructorOpts = opts;
		}
		// messages 模拟 SDK 的消息资源，只实现 create/asResponse 链路。
		messages = {
			create: (params: Record<string, unknown>) => {
				mockState.createParams = params;
				return {
					asResponse: async () => createSseResponse(),
				};
			},
		};
	}

	return { default: FakeAnthropic };
});

// context 是全部流用例共享的系统提示和单条用户消息。
const context: Context = {
	systemPrompt: "System prompt.",
	messages: [{ role: "user", content: "Hello", timestamp: Date.now() }],
};

// anthropicModel 是不启用推理的固定测试模型元数据。
const anthropicModel: Model<"anthropic-messages"> = {
	id: "claude-test",
	name: "Claude Test",
	api: "anthropic-messages",
	provider: "anthropic",
	baseUrl: "https://api.anthropic.com",
	reasoning: false,
	input: ["text"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 100000,
	maxTokens: 4096,
};

// 每个用例后清空 SDK 捕获状态，防止沿用上次参数。
afterEach(() => {
	mockState.constructorOpts = undefined;
	mockState.createParams = undefined;
});

// 验证 Anthropic 环境认证类型的解析优先级和请求塑形。
describe("Anthropic auth token env", () => {
	// AUTH_TOKEN 应解析为 Bearer Authorization Header，并优先于后续环境变量。
	it("resolves ANTHROPIC_AUTH_TOKEN as a bearer Authorization header", async () => {
		// provider 是待测试认证解析器的内置 Anthropic 提供商。
		const provider = anthropicProvider();
		// auth 是模拟环境下解析出的授权对象与来源。
		const auth = await provider.auth.apiKey?.resolve({
			ctx: {
				env: async (name) =>
					({
						ANTHROPIC_AUTH_TOKEN: "auth-token",
						ANTHROPIC_OAUTH_TOKEN: "oauth-token",
						ANTHROPIC_API_KEY: "api-key",
					})[name],
				fileExists: async () => false,
			},
		});

		expect(auth).toEqual({
			auth: { headers: { Authorization: "Bearer auth-token" } },
			source: ANTHROPIC_AUTH_TOKEN_ENV,
		});
	});

	// OAUTH_TOKEN 应保留为 apiKey 形状，供后续 OAuth 请求塑形识别。
	it("preserves ANTHROPIC_OAUTH_TOKEN as OAuth-shaped API auth", async () => {
		// provider 提供 OAuth 环境变量解析逻辑。
		const provider = anthropicProvider();
		// auth 是只有 OAuth/API key 环境值时的解析结果。
		const auth = await provider.auth.apiKey?.resolve({
			ctx: {
				env: async (name) =>
					({
						ANTHROPIC_OAUTH_TOKEN: "oauth-token",
						ANTHROPIC_API_KEY: "api-key",
					})[name],
				fileExists: async () => false,
			},
		});

		expect(auth).toEqual({
			auth: { apiKey: "oauth-token" },
			source: ANTHROPIC_OAUTH_TOKEN_ENV,
		});
	});

	// 直接提供 Authorization Header 不应触发 SDK OAuth 模式或 OAuth Beta 头。
	it("uses Authorization headers without OAuth-mode request shaping", async () => {
		// stream 是带显式 Bearer Header 的 Anthropic 请求流。
		const stream = streamAnthropic(anthropicModel, context, {
			headers: { Authorization: "Bearer gateway-token" },
		});
		await stream.result();

		expect(mockState.constructorOpts?.apiKey).toBeNull();
		expect(mockState.constructorOpts?.authToken).toBeNull();
		// headers 是伪 SDK 构造器收到的默认请求头。
		const headers = mockState.constructorOpts?.defaultHeaders as Record<string, string | null>;
		expect(headers.Authorization).toBe("Bearer gateway-token");
		expect(headers["anthropic-beta"] ?? "").not.toContain("oauth-2025-04-20");
		expect(mockState.createParams?.system).toEqual([expect.objectContaining({ text: "System prompt." })]);
	});

	// Models 的 authContext 应把 AUTH_TOKEN 贯穿到最终请求 Header。
	it("threads authContext ANTHROPIC_AUTH_TOKEN through request headers", async () => {
		// models 是使用自定义环境解析上下文的模型注册表。
		const models = createModels({
			authContext: {
				env: async (name) => (name === "ANTHROPIC_AUTH_TOKEN" ? "ctx-token" : undefined),
				fileExists: async () => false,
			},
		});
		models.setProvider(anthropicProvider());

		await models.streamSimple(anthropicModel, context).result();

		expect(mockState.constructorOpts?.apiKey).toBeNull();
		expect(mockState.constructorOpts?.authToken).toBeNull();
		// headers 是经 Models 授权链合并后的 SDK 默认头。
		const headers = mockState.constructorOpts?.defaultHeaders as Record<string, string>;
		expect(headers.Authorization).toBe("Bearer ctx-token");
		expect(headers["anthropic-beta"] ?? "").not.toContain("oauth-2025-04-20");
		expect(mockState.createParams?.system).toEqual([expect.objectContaining({ text: "System prompt." })]);
	});

	// OAUTH_TOKEN 经过 Models 链路后仍应使用 authToken 并附加 OAuth Beta。
	it("preserves OAuth request shaping for ANTHROPIC_OAUTH_TOKEN", async () => {
		// models 只提供 OAuth Token 环境值。
		const models = createModels({
			authContext: {
				env: async (name) => (name === "ANTHROPIC_OAUTH_TOKEN" ? "sk-ant-oat-test" : undefined),
				fileExists: async () => false,
			},
		});
		models.setProvider(anthropicProvider());

		await models.streamSimple(anthropicModel, context).result();

		expect(mockState.constructorOpts?.apiKey).toBeNull();
		expect(mockState.constructorOpts?.authToken).toBe("sk-ant-oat-test");
		// headers 是 OAuth 模式生成的 SDK 默认头。
		const headers = mockState.constructorOpts?.defaultHeaders as Record<string, string>;
		expect(headers["anthropic-beta"]).toContain("oauth-2025-04-20");
	});

	// 单次请求显式 Authorization Header 应覆盖 authContext 的 AUTH_TOKEN。
	it("lets explicit request headers override ANTHROPIC_AUTH_TOKEN", async () => {
		// models 默认可从上下文解析 ctx-token。
		const models = createModels({
			authContext: {
				env: async (name) => (name === "ANTHROPIC_AUTH_TOKEN" ? "ctx-token" : undefined),
				fileExists: async () => false,
			},
		});
		models.setProvider(anthropicProvider());

		await models
			.streamSimple(anthropicModel, context, { headers: { Authorization: "Bearer explicit-token" } })
			.result();

		// headers 是最终传入 SDK 的合并 Header，应含 explicit-token。
		const headers = mockState.constructorOpts?.defaultHeaders as Record<string, string>;
		expect(headers.Authorization).toBe("Bearer explicit-token");
	});
});
