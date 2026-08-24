/**
 * 文件职责：验证 Bedrock 工具 strict 能力门控及消息转换对未知、空白和非法 Unicode 内容的处理。
 * 技术维度：使用 Vitest 提升式 AWS SDK mock，通过 onPayload 捕获真实适配器生成的 Converse 请求。
 * 产品维度：避免不支持能力的模型收到非法请求，并让畸形历史消息安全降级而不是导致会话崩溃。
 * 逻辑维度：mock Bedrock 客户端，capturePayload 截获请求，再分别测试约束采样和各角色内容清洗规则。
 * 关键边界：不会发出 AWS 请求；用户空内容替换为 <empty>，助手无有效内容会被跳过；测试含旧 any 夹具。
 * 新手阅读建议：先看 capturePayload 如何在已中止信号下截获载荷，再比较用户、助手和工具结果规则。
 */
import { Type } from "typebox";
import { describe, expect, it, vi } from "vitest";

/** 保存每次假 Bedrock 客户端构造配置。 */
const bedrockMock = vi.hoisted(() => ({
	constructorCalls: [] as Array<Record<string, unknown>>,
}));

vi.mock("@aws-sdk/client-bedrock-runtime", () => {
	/** 模拟 AWS SDK 服务异常类型。 */
	class BedrockRuntimeServiceException extends Error {}

	/** 记录配置并阻止真实发送的假 Bedrock 客户端。 */
	class BedrockRuntimeClient {
		/** @param config 被测适配器生成的客户端配置。 */
		constructor(config: Record<string, unknown>) {
			bedrockMock.constructorCalls.push(config);
		}

		/** @returns 永远以固定错误拒绝的 Promise。 */
		send(): Promise<never> {
			return Promise.reject(new Error("mock send"));
		}
	}

	/** 保存输入的假 ConverseStreamCommand。 */
	class ConverseStreamCommand {
		/** 原始请求输入。 */
		readonly input: unknown;

		/** @param input Bedrock Converse 请求。 */
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

import { stream as streamBedrock } from "../src/api/bedrock-converse-stream.ts";
import { getModel } from "../src/compat.ts";
import type { Context, Message } from "../src/types.ts";

/** 支持 Bedrock 原生 strict 工具的基础测试模型。 */
const baseModel = getModel("amazon-bedrock", "us.anthropic.claude-sonnet-4-5-20250929-v1:0");

/**
 * 启动一次已中止 Bedrock 流并返回 onPayload 捕获的请求。
 * @param context 待转换的统一会话上下文。
 * @param model 被测 Bedrock 模型，默认使用 baseModel。
 * @returns 发送前的 Converse 请求载荷。
 * @example await capturePayload({ messages: [] });
 */
async function capturePayload(context: Context, model = baseModel): Promise<unknown> {
	/** onPayload 回调保存的请求载荷。 */
	let capturedPayload: unknown;
	/** 使用已中止信号的 Bedrock 事件流。 */
	const s = streamBedrock(model, context, {
		cacheRetention: "none",
		signal: AbortSignal.abort(),
		onPayload: (payload) => {
			capturedPayload = payload;
			return payload;
		},
	});
	for await (const event of s) {
		if (event.type === "error") break;
	}
	return capturedPayload;
}

/** 覆盖模型能力对 Bedrock strict 工具字段的控制。 */
describe("Bedrock constrained sampling", () => {
	it("gates native strict tool use by model capability", async () => {
		/** 要求 JSON Schema strict 的工具上下文。 */
		const context: Context = {
			messages: [{ role: "user", content: "Use the tool", timestamp: Date.now() }],
			tools: [
				{
					name: "lookup",
					description: "Look up a value",
					parameters: Type.Object({ value: Type.String() }),
					constrainedSampling: { type: "json_schema", strict: "require" },
				},
			],
		};
		/** 支持 strict 的基础模型请求载荷。 */
		const payload = await capturePayload(context);
		/** 从载荷中缩窄得到的工具配置。 */
		const toolConfig = (payload as { toolConfig: { tools: Array<{ toolSpec: { strict?: boolean } }> } }).toolConfig;
		expect(toolConfig.tools[0].toolSpec.strict).toBe(true);

		context.tools![0].constrainedSampling = { type: "json_schema", strict: "prefer" };
		/** 不支持 strict 的 Nova 模型请求载荷。 */
		const novaPayload = await capturePayload(context, getModel("amazon-bedrock", "amazon.nova-lite-v1:0"));
		/** Nova 载荷中的工具配置。 */
		const novaToolConfig = (
			novaPayload as {
				toolConfig: { tools: Array<{ toolSpec: { strict?: boolean } }> };
			}
		).toolConfig;
		expect(novaToolConfig.tools[0].toolSpec.strict).toBeUndefined();
	});
});

/** 覆盖 Bedrock 消息转换对未知、空白和非法字符内容的容错规则。 */
describe("bedrock convertMessages skips unknown content types", () => {
	it("skips unknown user content blocks instead of throwing", async () => {
		/** 同时包含有效文字与未知块的用户消息。 */
		const messages: Message[] = [
			{
				role: "user",
				content: [
					{ type: "text", text: "hello" },
					{ type: "unknown", data: "foo" },
				] as any,
				timestamp: Date.now(),
			},
		];
		/** 转换后的 Bedrock 请求载荷。 */
		const payload = await capturePayload({ messages });
		expect(payload).toBeDefined();
		/** 缩窄后的消息数组载荷。 */
		const p = payload as { messages: Array<{ role: string; content: unknown[] }> };
		expect(p.messages).toHaveLength(1);
		expect(p.messages[0].content).toHaveLength(1);
		expect(p.messages[0].content[0]).toEqual({ text: "hello" });
	});

	it("skips unknown assistant content blocks instead of throwing", async () => {
		/** 同时包含有效文字与未知块的助手消息。 */
		const messages: Message[] = [
			{
				role: "assistant",
				content: [
					{ type: "text", text: "hello" },
					{ type: "unknown", data: "foo" },
				] as any,
				api: "bedrock-converse-stream",
				provider: "amazon-bedrock",
				model: baseModel.id,
				usage: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 0,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
				},
				stopReason: "stop",
				timestamp: Date.now(),
			},
		];
		/** 转换后的助手消息载荷。 */
		const payload = await capturePayload({ messages });
		expect(payload).toBeDefined();
		/** 缩窄后的助手消息数组。 */
		const p = payload as { messages: Array<{ role: string; content: unknown[] }> };
		expect(p.messages).toHaveLength(1);
		expect(p.messages[0].content).toHaveLength(1);
		expect(p.messages[0].content[0]).toEqual({ text: "hello" });
	});

	it("replaces user messages with only unknown content blocks with a placeholder", async () => {
		/** 只含未知块的用户消息。 */
		const messages: Message[] = [
			{
				role: "user",
				content: [{ type: "unknown", data: "foo" }] as any,
				timestamp: Date.now(),
			},
		];
		/** 未知用户内容转换后的载荷。 */
		const payload = await capturePayload({ messages });
		expect(payload).toBeDefined();
		/** 应含 <empty> 占位符的消息数组。 */
		const p = payload as { messages: Array<{ role: string; content: unknown[] }> };
		expect(p.messages).toHaveLength(1);
		expect(p.messages[0].content).toEqual([{ text: "<empty>" }]);
	});

	it("replaces blank user string content with a placeholder", async () => {
		/** 空白用户字符串转换后的载荷。 */
		const payload = await capturePayload({
			messages: [{ role: "user", content: "   ", timestamp: Date.now() }],
		});
		expect(payload).toBeDefined();
		/** 空白字符串场景的消息数组。 */
		const p = payload as { messages: Array<{ role: string; content: unknown[] }> };
		expect(p.messages).toHaveLength(1);
		expect(p.messages[0].content).toEqual([{ text: "<empty>" }]);
	});

	it("filters blank user text blocks when other content remains", async () => {
		/** 同时含空白和有效文字块的用户载荷。 */
		const payload = await capturePayload({
			messages: [
				{
					role: "user",
					content: [
						{ type: "text", text: "" },
						{ type: "text", text: "hello" },
					],
					timestamp: Date.now(),
				},
			],
		});
		expect(payload).toBeDefined();
		/** 过滤空白块后的消息数组。 */
		const p = payload as { messages: Array<{ role: string; content: unknown[] }> };
		expect(p.messages).toHaveLength(1);
		expect(p.messages[0].content).toEqual([{ text: "hello" }]);
	});

	it("replaces user content emptied by surrogate sanitization with a placeholder", async () => {
		/** 只有孤立高代理项字符的用户载荷。 */
		const payload = await capturePayload({
			messages: [{ role: "user", content: String.fromCharCode(0xd83d), timestamp: Date.now() }],
		});
		expect(payload).toBeDefined();
		/** 清洗后应回填占位符的消息数组。 */
		const p = payload as { messages: Array<{ role: string; content: unknown[] }> };
		expect(p.messages).toHaveLength(1);
		expect(p.messages[0].content).toEqual([{ text: "<empty>" }]);
	});

	it("skips assistant text blocks emptied by surrogate sanitization", async () => {
		/** 只有非法代理项文字的助手消息。 */
		const messages: Message[] = [
			{
				role: "assistant",
				content: [{ type: "text", text: String.fromCharCode(0xd83d) }],
				api: "bedrock-converse-stream",
				provider: "amazon-bedrock",
				model: baseModel.id,
				usage: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 0,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
				},
				stopReason: "stop",
				timestamp: Date.now(),
			},
		];
		/** 清洗助手消息后的载荷。 */
		const payload = await capturePayload({ messages });
		expect(payload).toBeDefined();
		/** 应为空的助手消息数组。 */
		const p = payload as { messages: Array<{ role: string; content: unknown[] }> };
		expect(p.messages).toHaveLength(0);
	});

	it("replaces blank tool result content with a placeholder", async () => {
		/** 文字内容为空的工具结果消息。 */
		const messages: Message[] = [
			{
				role: "toolResult",
				toolCallId: "tool-1",
				toolName: "tool",
				content: [{ type: "text", text: "" }],
				isError: false,
				timestamp: Date.now(),
			},
		];
		/** 空工具结果转换后的载荷。 */
		const payload = await capturePayload({ messages });
		expect(payload).toBeDefined();
		/** 缩窄到 toolResult 内容的消息数组。 */
		const p = payload as {
			messages: Array<{ role: string; content: Array<{ toolResult: { content: unknown[] } }> }>;
		};
		expect(p.messages).toHaveLength(1);
		expect(p.messages[0].content[0].toolResult.content).toEqual([{ text: "<empty>" }]);
	});

	it("skips assistant messages with only unknown content blocks", async () => {
		/** 只含未知块的助手消息。 */
		const messages: Message[] = [
			{
				role: "assistant",
				content: [{ type: "unknown", data: "foo" }] as any,
				api: "bedrock-converse-stream",
				provider: "amazon-bedrock",
				model: baseModel.id,
				usage: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 0,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
				},
				stopReason: "stop",
				timestamp: Date.now(),
			},
		];
		/** 未知助手内容转换后的载荷。 */
		const payload = await capturePayload({ messages });
		expect(payload).toBeDefined();
		/** 应完全跳过助手消息的载荷数组。 */
		const p = payload as { messages: Array<{ role: string; content: unknown[] }> };
		expect(p.messages).toHaveLength(0);
	});
});
