// Per-tier provider regression for issues/provider-error-body-passthrough.
//
// Routes a 403-with-body error through the real provider catch path for one
// representative per tier (Success Criterion 7): a body-blind text provider
// (openai-completions), a status-only provider (openai-responses), and a
// body-blind Bedrock provider. Each asserts the resulting errorMessage carries
// both the HTTP status and the body reason. The image-provider tier is covered
// by provider-error-body-passthrough.test.ts; the already-correct happy path
// (no double body / no duplicated status) is asserted via the shared helper in
// error-body.test.ts.
// 按提供商层级验证错误正文透传：让三类代表提供商走真实 catch 路径，并断言状态码与正文原因均被保留；图片层由其他测试覆盖。

/**
 * 文件职责：回归验证 OpenAI Completions、Responses 与 Bedrock 的 HTTP 错误正文不会在适配层丢失或重复。
 * 技术维度：使用 Vitest 提升式 mock、假 SDK 错误和真实提供商流的异常处理路径。
 * 产品维度：让用户看到网关或上游拒绝的实际原因，而不是只有状态码或 UnknownError。
 * 逻辑维度：模拟 OpenAI 与 Bedrock 错误，消费完整流，再分别断言正文、前缀、去重和流式响应体边界。
 * 关键边界：只覆盖每层代表实现；假错误需保持 SDK 关键字段形状；测试不会发出网络请求。
 * 新手阅读建议：先看 FakeAPIError 与两个 mock，再看 drainResult，最后逐个比较三类提供商断言。
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { streamSimple as streamSimpleBedrock } from "../src/api/bedrock-converse-stream.ts";
import { stream as streamOpenAICompletions } from "../src/api/openai-completions.ts";
import { stream as streamOpenAIResponses } from "../src/api/openai-responses.ts";
import type { Context, Model } from "../src/types.ts";

// openai SDK APIError shape: "<status> status code (no body)" message, the
// parsed body kept on `.error`.
// OpenAI SDK 的 APIError 把消息写成“状态码且无正文”，但已解析正文仍保存在 error 字段。
/** 模拟 OpenAI SDK 的 APIError 最小字段形状。 */
class FakeAPIError extends Error {
	/** HTTP 状态码。 */
	status: number;
	/** SDK 保留的已解析响应正文。 */
	error: unknown;
	/** @param status HTTP 状态码。@param parsedBody 已解析的错误正文。 */
	constructor(status: number, parsedBody: unknown) {
		super(`${status} status code (no body)`);
		this.name = "PermissionDeniedError";
		this.status = status;
		this.error = parsedBody;
	}
}

/** Bedrock mock 下一次 send 应拒绝的错误对象。 */
const bedrockMock = vi.hoisted(() => ({
	sendError: undefined as unknown,
}));

/** OpenAI mock 下一次请求使用的可变解析正文。 */
const openaiMock = vi.hoisted(() => ({
	// Default parsed body; individual tests may override before invoking.
	// 默认正文可由单个用例在调用前覆盖。
	parsedBody: { error: "blocked by gateway WAF" } as unknown,
}));

vi.mock("openai", () => {
	/**
	 * 创建带 withResponse 方法的 Promise，并在调用时抛出假 403 错误。
	 * @returns 模拟 OpenAI SDK create 返回的可链式 Promise。
	 */
	function throwingCreate() {
		/** 被补充 withResponse 方法的占位 Promise。 */
		const promise = Promise.resolve(undefined) as unknown as { withResponse: () => Promise<never> };
		promise.withResponse = async () => {
			throw new FakeAPIError(403, openaiMock.parsedBody);
		};
		return promise;
	}
	/** 同时暴露 chat.completions 与 responses 创建接口的假 OpenAI 客户端。 */
	class FakeOpenAI {
		/** Completions API 最小入口。 */
		chat = { completions: { create: throwingCreate } };
		/** Responses API 最小入口。 */
		responses = { create: throwingCreate };
	}
	return { default: FakeOpenAI };
});

vi.mock("@aws-sdk/client-bedrock-runtime", () => {
	/** 模拟 AWS SDK 服务异常基类。 */
	class BedrockRuntimeServiceException extends Error {}

	/** 将 send 固定拒绝为 bedrockMock.sendError 的假客户端。 */
	class BedrockRuntimeClient {
		/** 被生产代码注册中间件时使用的空栈。 */
		middlewareStack = { add: () => {} };
		/** @returns 永远以当前假错误拒绝的 Promise。 */
		send(): Promise<never> {
			return Promise.reject(bedrockMock.sendError);
		}
	}

	/** 保存命令输入的假 ConverseStreamCommand。 */
	class ConverseStreamCommand {
		/** 原始命令输入。 */
		readonly input: unknown;
		/** @param input 被测代码生成的 Bedrock 请求。 */
		constructor(input: unknown) {
			this.input = input;
		}
	}

	return {
		BedrockRuntimeClient,
		BedrockRuntimeServiceException,
		ConverseStreamCommand,
		StopReason: {
			END_TURN: "end_turn",
			STOP_SEQUENCE: "stop_sequence",
			MAX_TOKENS: "max_tokens",
			MODEL_CONTEXT_WINDOW_EXCEEDED: "model_context_window_exceeded",
			TOOL_USE: "tool_use",
		},
		CachePointType: { DEFAULT: "default" },
		CacheTTL: { ONE_HOUR: "ONE_HOUR" },
		ConversationRole: { ASSISTANT: "assistant", USER: "user" },
		ImageFormat: { JPEG: "jpeg", PNG: "png", GIF: "gif", WEBP: "webp" },
		ToolResultStatus: { ERROR: "error", SUCCESS: "success" },
	};
});

import { getModel } from "../src/compat.ts";

/** 所有提供商用例共享的最小用户上下文。 */
const context: Context = {
	systemPrompt: "",
	messages: [{ role: "user", content: [{ type: "text", text: "hi" }], timestamp: 0 }],
	tools: [],
};

/** 用于覆盖 OpenAI-compatible Completions 错误路径的模型。 */
const completionsModel: Model<"openai-completions"> = {
	id: "test-model",
	name: "Test Model",
	api: "openai-completions",
	provider: "openrouter",
	baseUrl: "https://openrouter.ai/api/v1",
	reasoning: false,
	input: ["text"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 1000,
	maxTokens: 100,
};

/** 用于覆盖原生 OpenAI Responses 错误路径的模型。 */
const responsesModel: Model<"openai-responses"> = {
	id: "gpt-test",
	name: "GPT Test",
	api: "openai-responses",
	provider: "openai",
	baseUrl: "https://api.openai.com/v1",
	reasoning: false,
	input: ["text"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 1000,
	maxTokens: 100,
};

/**
 * 消费事件流直至结束并返回其最终结果。
 * @param stream 同时支持异步迭代和 result() 的助手流。
 * @returns 包含错误消息和停止原因的最终结果。
 * @example const output = await drainResult(stream);
 */
async function drainResult(stream: {
	[Symbol.asyncIterator](): AsyncIterator<unknown>;
	result(): Promise<{ errorMessage?: string; stopReason?: string }>;
}) {
	for await (const _event of stream) {
		void _event;
	}
	return stream.result();
}

/** 按提供商层级覆盖错误正文透传和去重回归。 */
describe("provider error body passthrough (per-tier regression)", () => {
	/** 每个用例前恢复默认 OpenAI 网关错误正文。 */
	beforeEach(() => {
		openaiMock.parsedBody = { error: "blocked by gateway WAF" };
	});

	it("openai-completions (body-blind text) surfaces status + body", async () => {
		/** Completions 流消费后的错误结果。 */
		const output = await drainResult(streamOpenAICompletions(completionsModel, context, { apiKey: "test" }));

		expect(output.stopReason).toBe("error");
		expect(output.errorMessage).toContain("403");
		expect(output.errorMessage).toContain("blocked by gateway WAF");
		expect(output.errorMessage).not.toBe("403 status code (no body)");
	});

	it("openai-completions does not double-print the OpenRouter metadata.raw extra", async () => {
		// OpenRouter returns the extra reason under error.error.metadata.raw, which
		// is part of the parsed body normalizeProviderError already surfaces. The
		// manual append must not duplicate it.
		// OpenRouter 的额外原因位于 metadata.raw，通用归一化已包含它，手工追加逻辑不得再次重复。
		openaiMock.parsedBody = {
			message: "Provider returned error",
			code: 403,
			metadata: { raw: "upstream WAF blocked policy XYZ" },
		};

		/** 含 metadata.raw 的 Completions 错误结果。 */
		const output = await drainResult(streamOpenAICompletions(completionsModel, context, { apiKey: "test" }));

		expect(output.errorMessage).toContain("upstream WAF blocked policy XYZ");
		/** 正文中特定上游原因出现的所有位置；应只有一次。 */
		const occurrences = output.errorMessage?.match(/upstream WAF blocked policy XYZ/g) ?? [];
		expect(occurrences).toHaveLength(1);
	});

	it("openai-responses (status-only) keeps the prefix and surfaces the body", async () => {
		/** Responses 流消费后的错误结果。 */
		const output = await drainResult(streamOpenAIResponses(responsesModel, context, { apiKey: "test" }));

		expect(output.stopReason).toBe("error");
		expect(output.errorMessage).toContain("OpenAI API error (403)");
		expect(output.errorMessage).toContain("blocked by gateway WAF");
	});

	it("bedrock (body-blind) surfaces the gateway body instead of Unknown: UnknownError", async () => {
		bedrockMock.sendError = Object.assign(new Error("UnknownError"), {
			name: "UnknownError",
			$metadata: { httpStatusCode: 403 },
			$response: { statusCode: 403, body: '{"message":"blocked by gateway WAF"}' },
		});

		/** Bedrock 测试使用的内置模型。 */
		const model = getModel("amazon-bedrock", "us.anthropic.claude-opus-4-8");
		/** Bedrock 网关错误流消费后的结果。 */
		const output = await drainResult(streamSimpleBedrock(model, { messages: context.messages }, {}));

		expect(output.stopReason).toBe("error");
		expect(output.errorMessage).toContain("403");
		expect(output.errorMessage).toContain("blocked by gateway WAF");
		expect(output.errorMessage).not.toContain("Unknown: UnknownError");
	});

	it("bedrock preserves the SDK validation message when the response body is a stream", async () => {
		bedrockMock.sendError = Object.assign(
			new Error(
				"Invocation of model ID anthropic.claude-opus-5 with on-demand throughput isn't supported. Retry with an inference profile.",
			),
			{
				name: "ValidationException",
				$metadata: { httpStatusCode: 400 },
				$response: {
					statusCode: 400,
					body: { pipe: () => undefined, _readableState: { buffer: [], length: 0 } },
				},
			},
		);

		/** 不支持按需吞吐场景的 Bedrock 模型。 */
		const model = getModel("amazon-bedrock", "global.anthropic.claude-opus-5");
		/** 响应体为流对象时的 Bedrock 错误结果。 */
		const output = await drainResult(streamSimpleBedrock(model, { messages: context.messages }, {}));

		expect(output.stopReason).toBe("error");
		expect(output.errorMessage).toContain("on-demand throughput isn't supported");
		expect(output.errorMessage).toContain("inference profile");
		expect(output.errorMessage).not.toContain("_readableState");
	});
});
