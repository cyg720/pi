/**
 * 文件职责：验证 OpenAI Completions 兼容端点使用 Anthropic 风格 cache_control 时，标记被放在正确消息和工具位置。
 * 技术维度：使用 Vitest 模拟 OpenAI SDK 流、TypeBox 工具参数和捕获请求载荷执行离线测试。
 * 产品维度：让 OpenRouter 等兼容模型获得提示缓存节省，同时允许用户通过 cacheRetention=none 完全关闭缓存标记。
 * 逻辑维度：定义捕获类型与 SDK 桩，发送统一上下文，再测试自定义模型、目录模型、工具结果和禁用缓存。
 * 关键边界：只有 compat.cacheControlFormat=anthropic 生效；对话标记应放在最后可缓存消息而非固定用户消息。
 * 新手阅读建议：先看 capturePayload 生成的请求，再用 expectAnthropicCacheMarkers 理解三处缓存标记。
 */
import { Type } from "typebox";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { stream as streamOpenAICompletions } from "../src/api/openai-completions.ts";
import { getModel } from "../src/compat.ts";
import type { Message, Model } from "../src/types.ts";

// CacheControl 描述 Anthropic 风格临时缓存标记及可选 TTL。
interface CacheControl {
	type: "ephemeral";
	ttl?: string;
}

// TextPart 描述 OpenAI 多段文本内容中可附缓存标记的结构。
interface TextPart {
	type: "text";
	text: string;
	cache_control?: CacheControl;
}

// ToolWithCacheControl 描述工具定义上可选的缓存标记。
interface ToolWithCacheControl {
	type: string;
	cache_control?: CacheControl;
}

// CapturedParams 是本测试从伪 SDK 中读取的最小 Chat Completions 请求体。
interface CapturedParams {
	messages: Array<{
		role: string;
		content: string | TextPart[] | null;
	}>;
	tools?: ToolWithCacheControl[];
}

// mockState 保存最近一次 chat.completions.create 参数。
const mockState = vi.hoisted(() => ({
	lastParams: undefined as CapturedParams | undefined,
}));

// 用返回单个停止片段的伪客户端替换 OpenAI SDK。
vi.mock("openai", () => {
	/** FakeOpenAI 捕获请求参数并返回满足 SDK withResponse 约定的异步流。 */
	class FakeOpenAI {
		// chat.completions.create 是被测代码实际调用的 SDK 路径。
		chat = {
			completions: {
				create: (params: CapturedParams) => {
					mockState.lastParams = params;
					// stream 是只产生一次 stop 片段的异步可迭代对象。
					const stream = {
						async *[Symbol.asyncIterator]() {
							yield {
								id: "chatcmpl-test",
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
					// promise 同时模拟 Promise 和 SDK 的 withResponse 扩展方法。
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

/**
 * 执行一次请求并返回伪 SDK 捕获的参数。
 * @param model 待测 OpenAI Completions 模型。
 * @param options 可选缓存保留策略。
 * @param messages 可选自定义历史，默认单条用户消息。
 * @returns CapturedParams；例如 `await capturePayload(model)`。
 */
async function capturePayload(
	model: Model<"openai-completions">,
	options?: { cacheRetention?: "none" | "short" | "long" },
	messages?: Message[],
): Promise<CapturedParams> {
	// timestamp 是默认消息和自定义工具轮次可共用的当前时间。
	const timestamp = Date.now();

	await streamOpenAICompletions(
		model,
		{
			systemPrompt: "System prompt",
			messages: messages ?? [{ role: "user", content: "Hello", timestamp }],
			tools: [
				{
					name: "read",
					description: "Read a file",
					parameters: Type.Object({
						path: Type.String(),
					}),
				},
			],
		},
		{ apiKey: "test-key", ...options },
	).result();

	if (!mockState.lastParams) {
		throw new Error("Expected payload to be captured");
	}

	return mockState.lastParams;
}

/** 从请求中查找 system 或 developer 指令消息；参数 params 为捕获请求；返回消息或 undefined。 */
function getInstructionMessage(params: CapturedParams) {
	return params.messages.find((message) => message.role === "system" || message.role === "developer");
}

/** 断言指令、工具和最后消息都带临时缓存标记；参数 params 为捕获请求；无返回值。 */
function expectAnthropicCacheMarkers(params: CapturedParams): void {
	// instructionMessage 是系统提示转换后的 system/developer 消息。
	const instructionMessage = getInstructionMessage(params);
	expect(instructionMessage).toBeDefined();
	expect(Array.isArray(instructionMessage?.content)).toBe(true);
	expect((instructionMessage?.content as TextPart[])[0]?.cache_control).toEqual({ type: "ephemeral" });

	expect(params.tools).toHaveLength(1);
	expect(params.tools?.[0]?.cache_control).toEqual({ type: "ephemeral" });

	// lastMessage 是对话中应承载缓存边界的最后一条消息。
	const lastMessage = params.messages[params.messages.length - 1];
	expect(lastMessage.role).toBe("user");
	expect(Array.isArray(lastMessage.content)).toBe(true);
	expect((lastMessage.content as TextPart[])[0]?.cache_control).toEqual({ type: "ephemeral" });
}

// 验证 OpenAI 兼容请求的 Anthropic 缓存标记格式和位置。
describe("openai-completions cacheControlFormat", () => {
	// 每个用例前清除此前捕获的请求参数。
	beforeEach(() => {
		mockState.lastParams = undefined;
	});

	// 自定义模型显式启用 anthropic 格式时应标记指令、工具和对话。
	it("applies Anthropic-style cache markers when model compat enables them", async () => {
		// model 是只启用缓存格式能力的自定义 OpenRouter 模型。
		const model: Model<"openai-completions"> = {
			id: "custom-qwen",
			name: "Custom Qwen",
			api: "openai-completions",
			provider: "openrouter",
			baseUrl: "https://example.com/v1",
			reasoning: true,
			input: ["text"],
			cost: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
			},
			contextWindow: 128000,
			maxTokens: 32000,
			compat: {
				cacheControlFormat: "anthropic",
			},
		};

		// params 是该模型最终发送给 SDK 的请求体。
		const params = await capturePayload(model);
		expectAnthropicCacheMarkers(params);
	});

	// 内置 OpenRouter Claude 模型也应保留生成目录中的缓存兼容设置。
	it("preserves Anthropic-style cache markers for OpenRouter Anthropic models", async () => {
		// model 是真实模型目录中的 OpenRouter Claude。
		const model = getModel("openrouter", "anthropic/claude-sonnet-4");
		// params 是目录模型生成的缓存请求体。
		const params = await capturePayload(model);
		expectAnthropicCacheMarkers(params);
	});

	// 历史以工具结果结尾时，对话缓存边界应移到工具消息。
	it("moves the conversation cache marker to a tool result", async () => {
		// model 是支持 Anthropic 缓存格式的 OpenRouter Claude。
		const model = getModel("openrouter", "anthropic/claude-sonnet-4");
		// timestamp 统一三条相关消息的时间。
		const timestamp = Date.now();
		// params 捕获一轮用户、工具调用和工具结果历史的请求。
		const params = await capturePayload(model, undefined, [
			{ role: "user", content: "Read the file", timestamp },
			{
				role: "assistant",
				content: [{ type: "toolCall", id: "call_1", name: "read", arguments: { path: "README.md" } }],
				api: "openai-completions",
				provider: "openrouter",
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
				timestamp,
			},
			{
				role: "toolResult",
				toolCallId: "call_1",
				toolName: "read",
				content: [{ type: "text", text: "file contents" }],
				isError: false,
				timestamp,
			},
		]);

		// userMessage 是原始用户消息，工具结果存在时不应承载缓存标记。
		const userMessage = params.messages.find((message) => message.role === "user");
		expect(userMessage?.content).toBe("Read the file");

		// toolMessage 是最后一条工具结果消息，应成为缓存边界。
		const toolMessage = params.messages[params.messages.length - 1];
		expect(toolMessage.role).toBe("tool");
		expect(Array.isArray(toolMessage.content)).toBe(true);
		expect((toolMessage.content as TextPart[])[0]?.cache_control).toEqual({ type: "ephemeral" });
	});

	// cacheRetention=none 应移除所有 Anthropic 风格标记并保持字符串内容。
	it("omits Anthropic-style cache markers when cacheRetention is none", async () => {
		// model 与首个用例相同，但请求会显式关闭缓存。
		const model: Model<"openai-completions"> = {
			id: "custom-qwen",
			name: "Custom Qwen",
			api: "openai-completions",
			provider: "openrouter",
			baseUrl: "https://example.com/v1",
			reasoning: true,
			input: ["text"],
			cost: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
			},
			contextWindow: 128000,
			maxTokens: 32000,
			compat: {
				cacheControlFormat: "anthropic",
			},
		};
		// params 是禁用缓存后的请求体。
		const params = await capturePayload(model, { cacheRetention: "none" });
		// instructionMessage 是禁用缓存后的指令消息。
		const instructionMessage = getInstructionMessage(params);

		expect(Array.isArray(instructionMessage?.content)).toBe(false);
		expect(params.tools?.[0]?.cache_control).toBeUndefined();
		expect(typeof params.messages[params.messages.length - 1]?.content).toBe("string");
	});
});
