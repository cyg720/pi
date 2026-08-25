/**
 * 文件职责：验证 OpenAI Completions 兼容层对工具选择、推理参数、流式分片、模型兼容元数据和用量字段的转换。
 * 技术维度：使用 Vitest 模块替身、TypeBox 工具模式及伪 OpenAI 异步流，直接捕获发送给 SDK 的请求参数。
 * 产品维度：防止不同 OpenAI 兼容供应商因非标准字段、推理格式或流式行为差异导致工具调用和计费显示错误。
 * 逻辑维度：先建立可配置的假 SDK 和参数捕获辅助函数，再按工具、z.ai、分片合并、推理回放、缓存用量及模板参数分组断言。
 * 关键边界：测试只验证本地转换，不访问网络；mockState 在每个用例前必须清空，构造的分片顺序代表供应商真实协议边界。
 * 新手阅读建议：先读 FakeOpenAI 与 captureSimpleParams，随后阅读基础 tool_choice 用例，再按供应商名称选择兼容性分组，最后看用量和模板参数。
 */
import { Type } from "typebox";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { convertMessages } from "../src/api/openai-completions.ts";
import { getModel, stream, streamSimple } from "../src/compat.ts";
import type { AssistantMessage, Model, SimpleStreamOptions, Tool, ToolResultMessage } from "../src/types.ts";

/** 常量 mockState 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const mockState = vi.hoisted(() => ({
	lastParams: undefined as unknown,
	chunks: undefined as
		| Array<null | {
				id?: string;
				choices?: Array<{ delta: Record<string, unknown>; finish_reason: string | null; usage?: unknown }>;
				usage?: {
					prompt_tokens: number;
					completion_tokens: number;
					prompt_tokens_details: { cached_tokens: number; cache_write_tokens?: number };
					completion_tokens_details: { reasoning_tokens: number };
				};
		  }>
		| undefined,
}));

vi.mock("openai", () => {
	/**
	 * 供模块替身使用的最小 OpenAI 客户端，只实现被测代码需要的聊天补全入口。
	 * 使用场景：捕获请求参数，并把 mockState 中配置的分片作为异步流返回。
	 */
	class FakeOpenAI {
		/** 模拟 SDK 的 chat.completions.create 调用树；值固定为本测试定义的内存对象。 */
		chat = {
			completions: {
				create: (params: unknown) => {
					mockState.lastParams = params;
					/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const stream = {
						/** 依次产出模拟响应块；无参数，返回可异步遍历的块序列，用于替代真实网络流。 */
						async *[Symbol.asyncIterator]() {
							/** 常量 chunks 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
							const chunks = mockState.chunks ?? [
								{
									choices: [{ delta: {}, finish_reason: "stop" }],
									usage: {
										prompt_tokens: 1,
										completion_tokens: 1,
										prompt_tokens_details: { cached_tokens: 0 },
										completion_tokens_details: { reasoning_tokens: 0 },
									},
								},
							];
							/** 循环变量 chunk 表示当前遍历项或索引，仅在循环体内有效。 */
							for (const chunk of chunks) {
								yield chunk;
							}
						},
					};
					/** 常量 promise 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
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

/** 常量 localOpenAICompletionsModel 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const localOpenAICompletionsModel = {
	api: "openai-completions",
	provider: "local-vllm",
	baseUrl: "http://localhost:8000/v1",
	reasoning: true,
	input: ["text"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 128000,
	maxTokens: 8192,
} satisfies Omit<Model<"openai-completions">, "id" | "name" | "compat">;

type CapturedParams = {
	chat_template_kwargs?: Record<string, unknown>;
	thinking?: unknown;
	reasoning_effort?: string;
};

/** captureSimpleParams 执行当前测试辅助步骤；参数 无 按签名提供输入，返回值供调用方断言。示例：captureSimpleParams()。 */
async function captureSimpleParams(
	model: Model<"openai-completions">,
	reasoning?: SimpleStreamOptions["reasoning"],
): Promise<CapturedParams> {
	/** 变量 payload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let payload: unknown;

	await streamSimple(
		model,
		{
			messages: [{ role: "user", content: "Hi", timestamp: Date.now() }],
		},
		{
			apiKey: "test",
			reasoning,
			onPayload: (params: unknown) => {
				payload = params;
			},
		},
	).result();

	return (payload ?? mockState.lastParams) as CapturedParams;
}

// 用例分组：集中验证“openai-completions tool_choice”相关功能。
describe("openai-completions tool_choice", () => {
	beforeEach(() => {
		mockState.lastParams = undefined;
		mockState.chunks = undefined;
	});

	// 测试场景：验证“forwards toolChoice from simple options to payload”对应的行为、结果与边界。
	it("forwards toolChoice from simple options to payload", async () => {
		/** 常量 { compat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini")!;
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = { ...baseModel, api: "openai-completions" } as const;
		/** 常量 tools 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tools: Tool[] = [
			{
				name: "ping",
				description: "Ping tool",
				parameters: Type.Object({
					ok: Type.Boolean(),
				}),
			},
		];
		/** 变量 payload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let payload: unknown;

		await streamSimple(
			model,
			{
				messages: [
					{
						role: "user",
						content: "Call ping with ok=true",
						timestamp: Date.now(),
					},
				],
				tools,
			},
			{
				apiKey: "test",
				toolChoice: "required",
				onPayload: (params: unknown) => {
					payload = params;
				},
			} as unknown as Parameters<typeof streamSimple>[2],
		).result();

		/** 常量 params 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const params = (payload ?? mockState.lastParams) as { tool_choice?: string; tools?: unknown[] };
		expect(params.tool_choice).toBe("required");
		expect(Array.isArray(params.tools)).toBe(true);
		expect(params.tools?.length ?? 0).toBeGreaterThan(0);
	});

	// 测试场景：验证“omits strict when compat disables strict mode”对应的行为、结果与边界。
	it("omits strict when compat disables strict mode", async () => {
		/** 常量 { compat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini")!;
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = {
			...baseModel,
			api: "openai-completions",
			compat: { supportsStrictMode: false },
		} as const;
		/** 常量 tools 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tools: Tool[] = [
			{
				name: "ping",
				description: "Ping tool",
				parameters: Type.Object({
					ok: Type.Boolean(),
				}),
			},
		];
		/** 变量 payload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let payload: unknown;

		await streamSimple(
			model,
			{
				messages: [
					{
						role: "user",
						content: "Call ping with ok=true",
						timestamp: Date.now(),
					},
				],
				tools,
			},
			{
				apiKey: "test",
				onPayload: (params: unknown) => {
					payload = params;
				},
			} as unknown as Parameters<typeof streamSimple>[2],
		).result();

		/** 常量 params 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const params = (payload ?? mockState.lastParams) as { tools?: Array<{ function?: Record<string, unknown> }> };
		/** 常量 tool 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tool = params.tools?.[0]?.function;
		expect(tool).toBeTruthy();
		expect(tool?.strict).toBeUndefined();
		expect("strict" in (tool ?? {})).toBe(false);
	});

	// 测试场景：验证“maps groq qwen3 reasoning levels to default reasoning_effort”对应的行为、结果与边界。
	it("maps groq qwen3 reasoning levels to default reasoning_effort", async () => {
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = getModel("groq", "qwen/qwen3-32b")!;
		/** 变量 payload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let payload: unknown;

		await streamSimple(
			model,
			{
				messages: [
					{
						role: "user",
						content: "Hi",
						timestamp: Date.now(),
					},
				],
			},
			{
				apiKey: "test",
				reasoning: "medium",
				onPayload: (params: unknown) => {
					payload = params;
				},
			},
		).result();

		/** 常量 params 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const params = (payload ?? mockState.lastParams) as { reasoning_effort?: string };
		expect(params.reasoning_effort).toBe("default");
	});

	// 测试场景：验证“keeps normal reasoning_effort for groq models without compat mapping”对应的行为、结果与边界。
	it("keeps normal reasoning_effort for groq models without compat mapping", async () => {
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = getModel("groq", "openai/gpt-oss-20b")!;
		/** 变量 payload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let payload: unknown;

		await streamSimple(
			model,
			{
				messages: [
					{
						role: "user",
						content: "Hi",
						timestamp: Date.now(),
					},
				],
			},
			{
				apiKey: "test",
				reasoning: "medium",
				onPayload: (params: unknown) => {
					payload = params;
				},
			},
		).result();

		/** 常量 params 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const params = (payload ?? mockState.lastParams) as { reasoning_effort?: string };
		expect(params.reasoning_effort).toBe("medium");
	});

	// 测试场景：验证“enables tool_stream for supported z.ai models with tools”对应的行为、结果与边界。
	it("enables tool_stream for supported z.ai models with tools", async () => {
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = getModel("zai", "glm-5.1")!;
		/** 常量 tools 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tools: Tool[] = [
			{
				name: "ping",
				description: "Ping tool",
				parameters: Type.Object({
					ok: Type.Boolean(),
				}),
			},
		];
		/** 变量 payload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let payload: unknown;

		await streamSimple(
			model,
			{
				messages: [
					{
						role: "user",
						content: "Call ping with ok=true",
						timestamp: Date.now(),
					},
				],
				tools,
			},
			{
				apiKey: "test",
				onPayload: (params: unknown) => {
					payload = params;
				},
			},
		).result();

		/** 常量 params 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const params = (payload ?? mockState.lastParams) as { tool_stream?: boolean };
		expect(params.tool_stream).toBe(true);
	});

	// 测试场景：验证“stores z.ai tool_stream support in model compat metadata”对应的行为、结果与边界。
	it("stores z.ai tool_stream support in model compat metadata", () => {
		expect(getModel("zai", "glm-5.1")?.compat?.zaiToolStream).toBe(true);
		expect(getModel("zai", "glm-4.7")?.compat?.zaiToolStream).toBe(true);
		expect(getModel("zai", "glm-4.7")?.compat?.zaiToolStream).toBe(true);
		expect(getModel("zai", "glm-5-turbo")?.compat?.zaiToolStream).toBe(true);
		expect(getModel("zai", "glm-4.5-air")?.compat?.zaiToolStream).toBeUndefined();
	});

	// 测试场景：验证“stores z.ai GLM-5.2 effort metadata”对应的行为、结果与边界。
	it("stores z.ai GLM-5.2 effort metadata", () => {
		/** 循环变量 provider 表示当前遍历项或索引，仅在循环体内有效。 */
		for (const provider of ["zai", "zai-coding-cn"] as const) {
			/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const model = getModel(provider, "glm-5.2")!;
			expect(model.compat?.supportsReasoningEffort).toBe(true);
			expect(model.thinkingLevelMap).toEqual({
				minimal: null,
				low: "high",
				medium: "high",
				high: "high",
				max: "max",
			});
		}
	});

	// 测试场景：验证“maps z.ai GLM-5.2 thinking levels to reasoning_effort”对应的行为、结果与边界。
	it("maps z.ai GLM-5.2 thinking levels to reasoning_effort", async () => {
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = getModel("zai", "glm-5.2")!;
		/** 常量 cases 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const cases = [
			{ reasoning: "low", effort: "high" },
			{ reasoning: "medium", effort: "high" },
			{ reasoning: "high", effort: "high" },
			{ reasoning: "max", effort: "max" },
		] as const;

		/** 循环变量 testCase 表示当前遍历项或索引，仅在循环体内有效。 */
		for (const testCase of cases) {
			/** 变量 payload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			let payload: unknown;

			await streamSimple(
				model,
				{
					messages: [
						{
							role: "user",
							content: "Hi",
							timestamp: Date.now(),
						},
					],
				},
				{
					apiKey: "test",
					reasoning: testCase.reasoning,
					onPayload: (params: unknown) => {
						payload = params;
					},
				},
			).result();

			/** 常量 params 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const params = (payload ?? mockState.lastParams) as { thinking?: unknown; reasoning_effort?: string };
			expect(params.thinking).toEqual({ type: "enabled", clear_thinking: false });
			expect(params.reasoning_effort).toBe(testCase.effort);
		}
	});

	// 测试场景：验证“preserves z.ai thinking when replaying reasoning_content”对应的行为、结果与边界。
	it("preserves z.ai thinking when replaying reasoning_content", async () => {
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = getModel("zai", "glm-5.2")!;
		/** 常量 assistantMessage 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const assistantMessage: AssistantMessage = {
			role: "assistant",
			api: "openai-completions",
			provider: "zai",
			model: "glm-5.2",
			content: [
				{ type: "thinking", thinking: "prior reasoning", thinkingSignature: "reasoning_content" },
				{ type: "toolCall", id: "call_1", name: "read", arguments: { path: "README.md" } },
			],
			usage: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 0,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "toolUse",
			timestamp: Date.now(),
		};
		/** 常量 toolResult 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const toolResult: ToolResultMessage = {
			role: "toolResult",
			toolCallId: "call_1",
			toolName: "read",
			content: [{ type: "text", text: "contents" }],
			isError: false,
			timestamp: Date.now(),
		};
		/** 变量 payload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let payload: unknown;

		await streamSimple(
			model,
			{
				messages: [
					{ role: "user", content: "Read README.md", timestamp: Date.now() },
					assistantMessage,
					toolResult,
					{ role: "user", content: "Continue", timestamp: Date.now() },
				],
			},
			{
				apiKey: "test",
				reasoning: "high",
				onPayload: (params: unknown) => {
					payload = params;
				},
			},
		).result();

		/** 常量 params 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const params = (payload ?? mockState.lastParams) as {
			messages?: Array<Record<string, unknown>>;
			thinking?: unknown;
		};
		/** 常量 replayedAssistant 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const replayedAssistant = params.messages?.find((message) => message.role === "assistant");
		expect(replayedAssistant).toMatchObject({ reasoning_content: "prior reasoning" });
		expect(params.thinking).toEqual({ type: "enabled", clear_thinking: false });
	});

	// 测试场景：验证“omits z.ai GLM-5.2 reasoning_effort when thinking is off”对应的行为、结果与边界。
	it("omits z.ai GLM-5.2 reasoning_effort when thinking is off", async () => {
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = getModel("zai", "glm-5.2")!;
		/** 变量 payload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let payload: unknown;

		await streamSimple(
			model,
			{
				messages: [
					{
						role: "user",
						content: "Hi",
						timestamp: Date.now(),
					},
				],
			},
			{
				apiKey: "test",
				onPayload: (params: unknown) => {
					payload = params;
				},
			},
		).result();

		/** 常量 params 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const params = (payload ?? mockState.lastParams) as { thinking?: unknown; reasoning_effort?: string };
		expect(params.thinking).toEqual({ type: "disabled" });
		expect(params.reasoning_effort).toBeUndefined();
	});

	// 测试场景：验证“omits tool_stream for unsupported z.ai models”对应的行为、结果与边界。
	it("omits tool_stream for unsupported z.ai models", async () => {
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = getModel("zai", "glm-4.5-air")!;
		/** 常量 tools 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tools: Tool[] = [
			{
				name: "ping",
				description: "Ping tool",
				parameters: Type.Object({
					ok: Type.Boolean(),
				}),
			},
		];
		/** 变量 payload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let payload: unknown;

		await streamSimple(
			model,
			{
				messages: [
					{
						role: "user",
						content: "Call ping with ok=true",
						timestamp: Date.now(),
					},
				],
				tools,
			},
			{
				apiKey: "test",
				onPayload: (params: unknown) => {
					payload = params;
				},
			},
		).result();

		/** 常量 params 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const params = (payload ?? mockState.lastParams) as { tool_stream?: boolean };
		expect(params.tool_stream).toBeUndefined();
	});

	// 测试场景：验证“respects explicit z.ai tool_stream compat override”对应的行为、结果与边界。
	it("respects explicit z.ai tool_stream compat override", async () => {
		/** 常量 baseModel 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const baseModel = getModel("zai", "glm-4.5-air")!;
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = {
			...baseModel,
			compat: {
				...baseModel.compat,
				zaiToolStream: true,
			},
		} as const;
		/** 常量 tools 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tools: Tool[] = [
			{
				name: "ping",
				description: "Ping tool",
				parameters: Type.Object({
					ok: Type.Boolean(),
				}),
			},
		];
		/** 变量 payload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let payload: unknown;

		await streamSimple(
			model,
			{
				messages: [
					{
						role: "user",
						content: "Call ping with ok=true",
						timestamp: Date.now(),
					},
				],
				tools,
			},
			{
				apiKey: "test",
				onPayload: (params: unknown) => {
					payload = params;
				},
			},
		).result();

		/** 常量 params 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const params = (payload ?? mockState.lastParams) as { tool_stream?: boolean };
		expect(params.tool_stream).toBe(true);
	});

	// 测试场景：验证“omits tool_stream when no tools are provided”对应的行为、结果与边界。
	it("omits tool_stream when no tools are provided", async () => {
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = getModel("zai", "glm-5.1")!;
		/** 变量 payload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let payload: unknown;

		await streamSimple(
			model,
			{
				messages: [
					{
						role: "user",
						content: "Hi",
						timestamp: Date.now(),
					},
				],
			},
			{
				apiKey: "test",
				onPayload: (params: unknown) => {
					payload = params;
				},
			},
		).result();

		/** 常量 params 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const params = (payload ?? mockState.lastParams) as { tool_stream?: boolean };
		expect(params.tool_stream).toBeUndefined();
	});

	// 测试场景：验证“maps non-standard provider finish_reason values to stopReason error”对应的行为、结果与边界。
	it("maps non-standard provider finish_reason values to stopReason error", async () => {
		mockState.chunks = [
			{
				choices: [{ delta: { content: "partial" }, finish_reason: null }],
			},
			{
				choices: [{ delta: {}, finish_reason: "network_error" }],
				usage: {
					prompt_tokens: 1,
					completion_tokens: 1,
					prompt_tokens_details: { cached_tokens: 0 },
					completion_tokens_details: { reasoning_tokens: 0 },
				},
			},
		];

		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = getModel("zai", "glm-5.1")!;
		/** 常量 response 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const response = await streamSimple(
			model,
			{
				messages: [
					{
						role: "user",
						content: "Hi",
						timestamp: Date.now(),
					},
				],
			},
			{ apiKey: "test" },
		).result();

		expect(response.stopReason).toBe("error");
		expect(response.errorMessage).toBe("Provider finish_reason: network_error");
	});

	// 测试场景：验证“ignores null stream chunks from openai-compatible providers”对应的行为、结果与边界。
	it("ignores null stream chunks from openai-compatible providers", async () => {
		mockState.chunks = [
			null,
			{
				id: "chatcmpl-test",
				choices: [{ delta: { content: "OK" }, finish_reason: null }],
			},
			{
				id: "chatcmpl-test",
				choices: [{ delta: {}, finish_reason: "stop" }],
				usage: {
					prompt_tokens: 3,
					completion_tokens: 1,
					prompt_tokens_details: { cached_tokens: 0 },
					completion_tokens_details: { reasoning_tokens: 0 },
				},
			},
		];

		/** 常量 { compat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini")!;
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = { ...baseModel, api: "openai-completions" } as const;
		/** 常量 response 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const response = await streamSimple(
			model,
			{
				messages: [
					{
						role: "user",
						content: "Reply with exactly OK",
						timestamp: Date.now(),
					},
				],
			},
			{ apiKey: "test" },
		).result();

		expect(response.stopReason).toBe("stop");
		expect(response.errorMessage).toBeUndefined();
		expect(response.responseId).toBe("chatcmpl-test");
		expect(response.usage.totalTokens).toBe(4);
		expect(response.content).toEqual([{ type: "text", text: "OK" }]);
	});

	// 测试场景：验证“errors when a stream ends after only null finish_reason chunks”对应的行为、结果与边界。
	it("errors when a stream ends after only null finish_reason chunks", async () => {
		mockState.chunks = [
			{
				id: "chatcmpl-truncated",
				choices: [{ delta: { content: "partial answer" }, finish_reason: null }],
			},
			{
				id: "chatcmpl-truncated",
				choices: [{ delta: { content: "partial answer" }, finish_reason: null }],
			},
		];

		/** 常量 { compat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini")!;
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = { ...baseModel, api: "openai-completions" } as const;
		/** 常量 response 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const response = await streamSimple(
			model,
			{
				messages: [
					{
						role: "user",
						content: "Reply with a longer sentence",
						timestamp: Date.now(),
					},
				],
			},
			{ apiKey: "test" },
		).result();

		expect(response.stopReason).toBe("error");
		expect(response.errorMessage).toBe("Stream ended without finish_reason");
	});

	// 测试场景：验证“coalesces tool call deltas by stable index when provider mutates ids mid-stream”对应的行为、结果与边界。
	it("coalesces tool call deltas by stable index when provider mutates ids mid-stream", async () => {
		mockState.chunks = [
			{
				id: "chatcmpl-kimi-bad-stream",
				choices: [
					{
						delta: {
							tool_calls: [
								{
									index: 0,
									id: "functions.read:0",
									type: "function",
									function: { name: "read", arguments: "" },
								},
							],
						},
						finish_reason: null,
					},
				],
			},
			{
				id: "chatcmpl-kimi-bad-stream",
				choices: [
					{
						delta: {
							tool_calls: [
								{
									index: 0,
									id: "chatcmpl-tool-a",
									type: "function",
									function: { name: null, arguments: '{"path":"README' },
								},
							],
						},
						finish_reason: null,
					},
				],
			},
			{
				id: "chatcmpl-kimi-bad-stream",
				choices: [
					{
						delta: {
							tool_calls: [
								{
									index: 0,
									id: "chatcmpl-tool-b",
									type: "function",
									function: { name: null, arguments: '.md"}' },
								},
							],
						},
						finish_reason: "tool_calls",
					},
				],
				usage: {
					prompt_tokens: 10,
					completion_tokens: 5,
					prompt_tokens_details: { cached_tokens: 0 },
					completion_tokens_details: { reasoning_tokens: 0 },
				},
			},
		];

		/** 常量 { compat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini")!;
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = { ...baseModel, api: "openai-completions" } as const;
		/** 常量 tool 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tool: Tool = {
			name: "read",
			description: "Read a file",
			parameters: Type.Object({
				path: Type.String(),
			}),
		};
		/** 常量 s 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const s = streamSimple(
			model,
			{
				messages: [
					{
						role: "user",
						content: "Read README.md",
						timestamp: Date.now(),
					},
				],
				tools: [tool],
			},
			{ apiKey: "test" },
		);

		/** 常量 toolCallContentIndexes 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const toolCallContentIndexes: number[] = [];
		/** event 是流中的当前事件；这里只收集工具调用生命周期事件的内容索引。 */
		for await (const event of s) {
			if (event.type === "toolcall_start" || event.type === "toolcall_delta" || event.type === "toolcall_end") {
				toolCallContentIndexes.push(event.contentIndex);
			}
		}

		/** 常量 response 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const response = await s.result();
		expect(response.stopReason).toBe("toolUse");
		expect(toolCallContentIndexes).toEqual([0, 0, 0, 0, 0]);
		expect(response.content).toHaveLength(1);
		/** 常量 toolCall 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const toolCall = response.content[0];
		expect(toolCall.type).toBe("toolCall");
		if (toolCall.type !== "toolCall") {
			throw new Error("Expected toolCall content");
		}
		expect(toolCall.id).toBe("functions.read:0");
		expect(toolCall.name).toBe("read");
		expect(toolCall.arguments).toEqual({ path: "README.md" });
		expect(toolCall).not.toHaveProperty("streamIndex");
		expect(toolCall).not.toHaveProperty("partialArgs");
	});

	// 测试场景：验证“accumulates mixed content, reasoning, and parallel tool call deltas independently”对应的行为、结果与边界。
	it("accumulates mixed content, reasoning, and parallel tool call deltas independently", async () => {
		mockState.chunks = [
			{
				id: "chatcmpl-mixed-deltas",
				choices: [
					{
						delta: {
							content: "answer 1",
							reasoning_content: "think 1",
							tool_calls: [
								{
									index: 0,
									id: "tc_read_initial",
									type: "function",
									function: { name: "read", arguments: '{"path":"README' },
								},
								{
									index: 1,
									id: "tc_grep_initial",
									type: "function",
									function: { name: "grep", arguments: '{"pattern":"TODO' },
								},
								{
									id: "tc_list_no_index",
									type: "function",
									function: { name: "list", arguments: '{"path":"packages' },
								},
								{
									id: "tc_write_no_index",
									type: "function",
									function: { name: "write", arguments: '{"path":"out' },
								},
							],
						},
						finish_reason: null,
					},
				],
			},
			{
				id: "chatcmpl-mixed-deltas",
				choices: [
					{
						delta: {
							content: " answer 2",
							tool_calls: [
								{
									index: 1,
									id: "tc_grep_changed",
									type: "function",
									function: { arguments: '","path":"src' },
								},
								{
									id: "tc_write_no_index",
									type: "function",
									function: { arguments: '.txt","content":"ok"}' },
								},
								{
									id: "tc_list_no_index",
									type: "function",
									function: { arguments: '/ai"}' },
								},
							],
						},
						finish_reason: null,
					},
				],
			},
			{
				id: "chatcmpl-mixed-deltas",
				choices: [
					{
						delta: {
							content: "\n",
							reasoning_content: " think 2",
							tool_calls: [
								{
									index: 0,
									id: "tc_read_changed",
									type: "function",
									function: { arguments: '.md"}' },
								},
								{
									index: 1,
									type: "function",
									function: { arguments: '"}' },
								},
							],
						},
						finish_reason: "tool_calls",
					},
				],
				usage: {
					prompt_tokens: 10,
					completion_tokens: 8,
					prompt_tokens_details: { cached_tokens: 0 },
					completion_tokens_details: { reasoning_tokens: 2 },
				},
			},
		];

		/** 常量 { compat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini")!;
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = { ...baseModel, api: "openai-completions" } as const;
		/** 常量 tools 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tools: Tool[] = [
			{
				name: "read",
				description: "Read a file",
				parameters: Type.Object({ path: Type.String() }),
			},
			{
				name: "grep",
				description: "Search a file",
				parameters: Type.Object({ pattern: Type.String(), path: Type.String() }),
			},
			{
				name: "list",
				description: "List a directory",
				parameters: Type.Object({ path: Type.String() }),
			},
			{
				name: "write",
				description: "Write a file",
				parameters: Type.Object({ path: Type.String(), content: Type.String() }),
			},
		];
		/** 常量 s 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const s = streamSimple(
			model,
			{
				messages: [
					{
						role: "user",
						content: "Think, answer, and use tools.",
						timestamp: Date.now(),
					},
				],
				tools,
			},
			{ apiKey: "test" },
		);

		/** 常量 eventTypes 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const eventTypes: string[] = [];
		/** 常量 toolEventsByContentIndex 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const toolEventsByContentIndex = new Map<number, string[]>();
		/** event 是流中的当前事件；循环按内容索引归组工具调用事件并保留完整类型顺序。 */
		for await (const event of s) {
			eventTypes.push(event.type);
			if (event.type === "toolcall_start" || event.type === "toolcall_delta" || event.type === "toolcall_end") {
				/** 常量 events 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const events = toolEventsByContentIndex.get(event.contentIndex) ?? [];
				events.push(event.type);
				toolEventsByContentIndex.set(event.contentIndex, events);
			}
		}

		/** 常量 response 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const response = await s.result();
		expect(response.stopReason).toBe("toolUse");
		expect(eventTypes.filter((type) => type === "text_start")).toHaveLength(1);
		expect(eventTypes.filter((type) => type === "text_delta")).toHaveLength(3);
		expect(eventTypes.filter((type) => type === "text_end")).toHaveLength(1);
		expect(eventTypes.filter((type) => type === "thinking_start")).toHaveLength(1);
		expect(eventTypes.filter((type) => type === "thinking_delta")).toHaveLength(2);
		expect(eventTypes.filter((type) => type === "thinking_end")).toHaveLength(1);
		expect(eventTypes.filter((type) => type === "toolcall_start")).toHaveLength(4);
		expect(eventTypes.filter((type) => type === "toolcall_delta")).toHaveLength(9);
		expect(eventTypes.filter((type) => type === "toolcall_end")).toHaveLength(4);
		expect(toolEventsByContentIndex.get(2)).toEqual([
			"toolcall_start",
			"toolcall_delta",
			"toolcall_delta",
			"toolcall_end",
		]);
		expect(toolEventsByContentIndex.get(3)).toEqual([
			"toolcall_start",
			"toolcall_delta",
			"toolcall_delta",
			"toolcall_delta",
			"toolcall_end",
		]);
		expect(toolEventsByContentIndex.get(4)).toEqual([
			"toolcall_start",
			"toolcall_delta",
			"toolcall_delta",
			"toolcall_end",
		]);
		expect(toolEventsByContentIndex.get(5)).toEqual([
			"toolcall_start",
			"toolcall_delta",
			"toolcall_delta",
			"toolcall_end",
		]);

		expect(response.content).toHaveLength(6);
		expect(response.content[0]).toEqual({ type: "text", text: "answer 1 answer 2\n" });
		expect(response.content[1]).toEqual({
			type: "thinking",
			thinking: "think 1 think 2",
			thinkingSignature: "reasoning_content",
		});
		/** 常量 readCall 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const readCall = response.content[2];
		/** 常量 grepCall 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const grepCall = response.content[3];
		/** 常量 listCall 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const listCall = response.content[4];
		/** 常量 writeCall 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const writeCall = response.content[5];
		expect(readCall.type).toBe("toolCall");
		expect(grepCall.type).toBe("toolCall");
		expect(listCall.type).toBe("toolCall");
		expect(writeCall.type).toBe("toolCall");
		if (
			readCall.type !== "toolCall" ||
			grepCall.type !== "toolCall" ||
			listCall.type !== "toolCall" ||
			writeCall.type !== "toolCall"
		) {
			throw new Error("Expected toolCall content");
		}
		expect(readCall.id).toBe("tc_read_initial");
		expect(readCall.name).toBe("read");
		expect(readCall.arguments).toEqual({ path: "README.md" });
		expect(readCall).not.toHaveProperty("streamIndex");
		expect(readCall).not.toHaveProperty("partialArgs");
		expect(grepCall.id).toBe("tc_grep_initial");
		expect(grepCall.name).toBe("grep");
		expect(grepCall.arguments).toEqual({ pattern: "TODO", path: "src" });
		expect(grepCall).not.toHaveProperty("streamIndex");
		expect(grepCall).not.toHaveProperty("partialArgs");
		expect(listCall.id).toBe("tc_list_no_index");
		expect(listCall.name).toBe("list");
		expect(listCall.arguments).toEqual({ path: "packages/ai" });
		expect(listCall).not.toHaveProperty("streamIndex");
		expect(listCall).not.toHaveProperty("partialArgs");
		expect(writeCall.id).toBe("tc_write_no_index");
		expect(writeCall.name).toBe("write");
		expect(writeCall.arguments).toEqual({ path: "out.txt", content: "ok" });
		expect(writeCall).not.toHaveProperty("streamIndex");
		expect(writeCall).not.toHaveProperty("partialArgs");
	});

	// 测试场景：验证“uses system messages for non-OpenAI/Anthropic OpenRouter reasoning model instructions”对应的行为、结果与边界。
	it("uses system messages for non-OpenAI/Anthropic OpenRouter reasoning model instructions", async () => {
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = getModel("openrouter", "deepseek/deepseek-v4-pro")!;
		/** 变量 payload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let payload: unknown;

		await streamSimple(
			model,
			{
				systemPrompt: "Follow instructions.",
				messages: [{ role: "user", content: "Hi", timestamp: Date.now() }],
			},
			{
				apiKey: "test",
				onPayload: (params: unknown) => {
					payload = params;
				},
			},
		).result();

		/** 常量 params 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const params = payload as { messages?: Array<{ role?: string }> };
		expect(params.messages?.[0]?.role).toBe("system");
	});

	// 测试场景：验证“keeps developer messages for OpenAI and Anthropic OpenRouter reasoning model instructions”对应的行为、结果与边界。
	it("keeps developer messages for OpenAI and Anthropic OpenRouter reasoning model instructions", async () => {
		/** 循环变量 model 表示当前遍历项或索引，仅在循环体内有效。 */
		for (const model of [
			getModel("openrouter", "openai/gpt-5.2-codex"),
			getModel("openrouter", "anthropic/claude-sonnet-4.5"),
		]) {
			expect(model).toBeDefined();
			/** 变量 payload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			let payload: unknown;

			await streamSimple(
				model!,
				{
					systemPrompt: "Follow instructions.",
					messages: [{ role: "user", content: "Hi", timestamp: Date.now() }],
				},
				{
					apiKey: "test",
					onPayload: (params: unknown) => {
						payload = params;
					},
				},
			).result();

			/** 常量 params 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const params = payload as { messages?: Array<{ role?: string }> };
			expect(params.messages?.[0]?.role).toBe("developer");
		}
	});

	// 测试场景：验证“keeps developer messages for OpenAI reasoning model instructions”对应的行为、结果与边界。
	it("keeps developer messages for OpenAI reasoning model instructions", async () => {
		/** 常量 { compat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const { compat: _compat, ...baseModel } = getModel("openai", "gpt-5.5")!;
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = { ...baseModel, api: "openai-completions" } as const;
		/** 变量 payload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let payload: unknown;

		await streamSimple(
			model,
			{
				systemPrompt: "Follow instructions.",
				messages: [{ role: "user", content: "Hi", timestamp: Date.now() }],
			},
			{
				apiKey: "test",
				onPayload: (params: unknown) => {
					payload = params;
				},
			},
		).result();

		/** 常量 params 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const params = payload as { messages?: Array<{ role?: string }> };
		expect(params.messages?.[0]?.role).toBe("developer");
	});

	// 测试场景：验证“stores OpenRouter Kimi K2.6 reasoning replay compat in built-in metadata”对应的行为、结果与边界。
	it("stores OpenRouter Kimi K2.6 reasoning replay compat in built-in metadata", () => {
		// `:free` variant delisted from the OpenRouter API; the generator override
		// matches any `moonshotai/kimi-k2.6*` variant that is listed.
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		const model = getModel("openrouter", "moonshotai/kimi-k2.6")!;
		expect(model.compat?.supportsDeveloperRole).toBe(false);
		expect(model.compat?.requiresReasoningContentOnAssistantMessages).toBe(true);
	});

	// 测试场景：验证“stores Xiaomi MiMo reasoning replay compat in built-in metadata”对应的行为、结果与边界。
	it("stores Xiaomi MiMo reasoning replay compat in built-in metadata", () => {
		/** 常量 providers 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const providers = ["xiaomi", "xiaomi-token-plan-cn", "xiaomi-token-plan-ams", "xiaomi-token-plan-sgp"] as const;

		/** 循环变量 provider 表示当前遍历项或索引，仅在循环体内有效。 */
		for (const provider of providers) {
			/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const model = getModel(provider, "mimo-v2.5-pro")!;
			expect(model.compat?.requiresReasoningContentOnAssistantMessages).toBe(true);
			expect(model.compat?.thinkingFormat).toBe("deepseek");
			expect(model.compat?.maxTokensField).toBeUndefined();
			expect(model.compat?.supportsDeveloperRole).toBeUndefined();
		}
	});

	// 测试场景：验证“stores Qwen Token Plan reasoning replay compat in built-in metadata”对应的行为、结果与边界。
	it("stores Qwen Token Plan reasoning replay compat in built-in metadata", () => {
		/** 常量 providers 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const providers = ["qwen-token-plan", "qwen-token-plan-cn"] as const;

		/** 循环变量 provider 表示当前遍历项或索引，仅在循环体内有效。 */
		for (const provider of providers) {
			/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const model = getModel(provider, "qwen3.7-max")!;
			expect(model.compat?.thinkingFormat).toBe("qwen");
			expect(model.compat?.requiresReasoningContentOnAssistantMessages).toBeUndefined();
			expect(model.compat?.supportsDeveloperRole).toBe(false);
			expect(model.compat?.supportsStore).toBe(false);
		}
	});

	// 测试场景：验证“replays Xiaomi MiMo assistant tool calls with empty reasoning_content when thinking is missing”对应的行为、结果与边界。
	it("replays Xiaomi MiMo assistant tool calls with empty reasoning_content when thinking is missing", async () => {
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = getModel("xiaomi", "mimo-v2.5-pro")!;
		/** 常量 assistantMessage 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const assistantMessage: AssistantMessage = {
			role: "assistant",
			api: "openai-completions",
			provider: "xiaomi",
			model: "mimo-v2.5-pro",
			content: [{ type: "toolCall", id: "call_1", name: "read", arguments: { path: "README.md" } }],
			usage: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 0,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "toolUse",
			timestamp: Date.now(),
		};
		/** 常量 toolResult 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const toolResult: ToolResultMessage = {
			role: "toolResult",
			toolCallId: "call_1",
			toolName: "read",
			content: [{ type: "text", text: "contents" }],
			isError: false,
			timestamp: Date.now(),
		};
		/** 变量 payload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let payload: unknown;

		await streamSimple(
			model,
			{
				messages: [
					{ role: "user", content: "Read README.md", timestamp: Date.now() },
					assistantMessage,
					toolResult,
				],
			},
			{
				apiKey: "test",
				reasoning: "high",
				onPayload: (params: unknown) => {
					payload = params;
				},
			},
		).result();

		/** 常量 params 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const params = (payload ?? mockState.lastParams) as {
			messages?: Array<Record<string, unknown>>;
			thinking?: { type?: string };
			reasoning_effort?: string;
		};
		/** 常量 replayedAssistant 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const replayedAssistant = params.messages?.find((message) => message.role === "assistant");
		expect(replayedAssistant).toMatchObject({ role: "assistant", reasoning_content: "" });
		expect(params.thinking).toEqual({ type: "enabled" });
		expect(params.reasoning_effort).toBe("high");
	});

	// 测试场景：验证“normalizes OpenCode Go reasoning deltas to reasoning_content for replay”对应的行为、结果与边界。
	it("normalizes OpenCode Go reasoning deltas to reasoning_content for replay", async () => {
		mockState.chunks = [
			{
				id: "chatcmpl-opencode-go-reasoning",
				choices: [{ delta: { reasoning: "think" }, finish_reason: "stop" }],
			},
		];

		/** 常量 { compat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const { compat: _compat, ...baseModel } = getModel("opencode-go", "kimi-k2.6")!;
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = { ...baseModel, api: "openai-completions" } as const;
		/** 常量 response 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const response = await streamSimple(
			model,
			{
				messages: [{ role: "user", content: "Use reasoning.", timestamp: Date.now() }],
			},
			{ apiKey: "test" },
		).result();

		expect(response.content).toEqual([
			{
				type: "thinking",
				thinking: "think",
				thinkingSignature: "reasoning_content",
			},
		]);
	});

	// 测试场景：验证“keeps non-OpenCode Go reasoning deltas on the original reasoning field”对应的行为、结果与边界。
	it("keeps non-OpenCode Go reasoning deltas on the original reasoning field", async () => {
		mockState.chunks = [
			{
				id: "chatcmpl-reasoning",
				choices: [{ delta: { reasoning: "think" }, finish_reason: "stop" }],
			},
		];

		/** 常量 { compat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini")!;
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = { ...baseModel, api: "openai-completions" } as const;
		/** 常量 response 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const response = await streamSimple(
			model,
			{
				messages: [{ role: "user", content: "Use reasoning.", timestamp: Date.now() }],
			},
			{ apiKey: "test" },
		).result();

		expect(response.content).toEqual([
			{
				type: "thinking",
				thinking: "think",
				thinkingSignature: "reasoning",
			},
		]);
	});

	// 测试场景：验证“replays OpenCode Go reasoning thinking blocks as reasoning_content”对应的行为、结果与边界。
	it("replays OpenCode Go reasoning thinking blocks as reasoning_content", () => {
		/** 常量 { compat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const { compat: _compat, ...baseModel } = getModel("opencode-go", "kimi-k2.6")!;
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = { ...baseModel, api: "openai-completions" } as Model<"openai-completions">;
		/** 常量 messages 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const messages = convertMessages(
			model,
			{
				messages: [
					{
						role: "assistant",
						api: "openai-completions",
						provider: "opencode-go",
						model: "kimi-k2.6",
						content: [
							{ type: "thinking", thinking: "think", thinkingSignature: "reasoning" },
							{ type: "toolCall", id: "call_1", name: "read", arguments: { path: "README.md" } },
						],
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
				],
			},
			{
				...model.compat,
				supportsStore: false,
				supportsDeveloperRole: false,
				supportsReasoningEffort: true,
				supportsUsageInStreaming: true,
				maxTokensField: "max_completion_tokens",
				requiresToolResultName: false,
				requiresAssistantAfterToolResult: false,
				requiresThinkingAsText: false,
				requiresReasoningContentOnAssistantMessages: false,
				thinkingFormat: "openai",
				openRouterRouting: {},
				vercelGatewayRouting: {},
				chatTemplateKwargs: {},
				zaiToolStream: false,
				supportsStrictMode: true,
				supportsOpenAIGrammarTools: false,
				sendSessionAffinityHeaders: false,
				sessionAffinityFormat: "openai",
				supportsLongCacheRetention: true,
			},
		);

		expect(messages[0]).toMatchObject({ role: "assistant", reasoning_content: "think" });
		expect(messages[0]).not.toHaveProperty("reasoning");
	});

	// 测试场景：验证“sends thinking disabled for OpenCode Go Kimi K2.6 when thinking is off”对应的行为、结果与边界。
	it("sends thinking disabled for OpenCode Go Kimi K2.6 when thinking is off", async () => {
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = getModel("opencode-go", "kimi-k2.6")!;
		/** 变量 payload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let payload: unknown;

		await streamSimple(
			model,
			{
				messages: [{ role: "user", content: "Hi", timestamp: Date.now() }],
			},
			{
				apiKey: "test",
				onPayload: (params: unknown) => {
					payload = params;
				},
			},
		).result();

		/** 常量 params 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const params = (payload ?? mockState.lastParams) as { thinking?: unknown; reasoning_effort?: string };
		expect(params.thinking).toEqual({ type: "disabled" });
		expect(params.reasoning_effort).toBeUndefined();
	});

	// 测试场景：验证“sends thinking enabled for OpenCode Go Kimi K2.6 when thinking is enabled”对应的行为、结果与边界。
	it("sends thinking enabled for OpenCode Go Kimi K2.6 when thinking is enabled", async () => {
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = getModel("opencode-go", "kimi-k2.6")!;
		/** 变量 payload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let payload: unknown;

		await streamSimple(
			model,
			{
				messages: [{ role: "user", content: "Hi", timestamp: Date.now() }],
			},
			{
				apiKey: "test",
				reasoning: "high",
				onPayload: (params: unknown) => {
					payload = params;
				},
			},
		).result();

		/** 常量 params 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const params = (payload ?? mockState.lastParams) as { thinking?: unknown; reasoning_effort?: string };
		expect(params.thinking).toEqual({ type: "enabled" });
		expect(params.reasoning_effort).toBeUndefined();
	});

	// 测试场景：验证“omits disabled thinking for Moonshot Kimi K2.7 Code models”对应的行为、结果与边界。
	it("omits disabled thinking for Moonshot Kimi K2.7 Code models", async () => {
		/** 常量 cases 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const cases = [getModel("moonshotai", "kimi-k2.7-code"), getModel("moonshotai-cn", "kimi-k2.7-code")];

		/** 循环变量 model 表示当前遍历项或索引，仅在循环体内有效。 */
		for (const model of cases) {
			expect(model).toBeDefined();
			/** 变量 payload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			let payload: unknown;

			await streamSimple(
				model!,
				{
					messages: [{ role: "user", content: "Hi", timestamp: Date.now() }],
				},
				{
					apiKey: "test",
					onPayload: (params: unknown) => {
						payload = params;
					},
				},
			).result();

			/** 常量 params 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const params = (payload ?? mockState.lastParams) as { thinking?: unknown; reasoning_effort?: string };
			expect(params.thinking).toBeUndefined();
			expect(params.reasoning_effort).toBeUndefined();
		}
	});

	// 测试场景：验证“keeps disabled thinking for Moonshot Kimi K2.6 when thinking is off”对应的行为、结果与边界。
	it("keeps disabled thinking for Moonshot Kimi K2.6 when thinking is off", async () => {
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = getModel("moonshotai-cn", "kimi-k2.6")!;
		/** 变量 payload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let payload: unknown;

		await streamSimple(
			model,
			{
				messages: [{ role: "user", content: "Hi", timestamp: Date.now() }],
			},
			{
				apiKey: "test",
				onPayload: (params: unknown) => {
					payload = params;
				},
			},
		).result();

		/** 常量 params 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const params = (payload ?? mockState.lastParams) as { thinking?: unknown; reasoning_effort?: string };
		expect(params.thinking).toEqual({ type: "disabled" });
		expect(params.reasoning_effort).toBeUndefined();
	});

	// 测试场景：验证“sends max_tokens for OpenCode completions models”对应的行为、结果与边界。
	it("sends max_tokens for OpenCode completions models", async () => {
		/** 常量 cases 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const cases = [getModel("opencode-go", "kimi-k2.6")!, getModel("opencode", "grok-build-0.1")!] as const;

		/** 循环变量 model 表示当前遍历项或索引，仅在循环体内有效。 */
		for (const model of cases) {
			/** 变量 payload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			let payload: unknown;
			expect(model.compat?.maxTokensField).toBe("max_tokens");

			await streamSimple(
				model,
				{
					messages: [{ role: "user", content: "Hi", timestamp: Date.now() }],
				},
				{
					apiKey: "test",
					maxTokens: 123,
					onPayload: (params: unknown) => {
						payload = params;
					},
				},
			).result();

			/** 常量 params 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const params = (payload ?? mockState.lastParams) as { max_tokens?: number; max_completion_tokens?: number };
			expect(params.max_tokens).toBe(123);
			expect(params.max_completion_tokens).toBeUndefined();
		}
	});

	// 测试场景：验证“omits reasoning effort for OpenCode Grok Build”对应的行为、结果与边界。
	it("omits reasoning effort for OpenCode Grok Build", async () => {
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = getModel("opencode", "grok-build-0.1")!;
		/** 变量 payload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let payload: unknown;

		await streamSimple(
			model,
			{
				messages: [{ role: "user", content: "Hi", timestamp: Date.now() }],
			},
			{
				apiKey: "test",
				reasoning: "high",
				onPayload: (params: unknown) => {
					payload = params;
				},
			},
		).result();

		/** 常量 params 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const params = (payload ?? mockState.lastParams) as { reasoning_effort?: string };
		expect(params.reasoning_effort).toBeUndefined();
	});

	// 测试场景：验证“does not double-count reasoning tokens in completion usage”对应的行为、结果与边界。
	it("does not double-count reasoning tokens in completion usage", async () => {
		mockState.chunks = [
			{
				id: "chatcmpl-reasoning-usage",
				choices: [{ delta: {}, finish_reason: "stop" }],
				usage: {
					prompt_tokens: 10,
					completion_tokens: 33,
					prompt_tokens_details: { cached_tokens: 0 },
					completion_tokens_details: { reasoning_tokens: 21 },
				},
			},
		];

		/** 常量 { compat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini")!;
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = { ...baseModel, api: "openai-completions" } as const;
		/** 常量 response 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const response = await streamSimple(
			model,
			{
				messages: [
					{
						role: "user",
						content: "Use reasoning.",
						timestamp: Date.now(),
					},
				],
			},
			{ apiKey: "test" },
		).result();

		expect(response.usage.input).toBe(10);
		expect(response.usage.output).toBe(33);
		expect(response.usage.totalTokens).toBe(43);
	});

	// 测试场景：验证“preserves prompt_tokens_details cache read/write fields from chunk usage”对应的行为、结果与边界。
	it("preserves prompt_tokens_details cache read/write fields from chunk usage", async () => {
		mockState.chunks = [
			{
				id: "chatcmpl-cache-write",
				choices: [{ delta: { content: "OK" }, finish_reason: null }],
			},
			{
				id: "chatcmpl-cache-write",
				choices: [{ delta: {}, finish_reason: "stop" }],
				usage: {
					prompt_tokens: 100,
					completion_tokens: 5,
					prompt_tokens_details: { cached_tokens: 50, cache_write_tokens: 30 },
					completion_tokens_details: { reasoning_tokens: 0 },
				},
			},
		];

		/** 常量 { compat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini")!;
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = { ...baseModel, api: "openai-completions" } as const;
		/** 常量 response 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const response = await streamSimple(
			model,
			{
				messages: [
					{
						role: "user",
						content: "Reply with exactly OK",
						timestamp: Date.now(),
					},
				],
			},
			{ apiKey: "test" },
		).result();

		// cached_tokens is documented as cache reads; cache_write_tokens is separate.
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		expect(response.usage.input).toBe(20);
		expect(response.usage.cacheRead).toBe(50);
		expect(response.usage.cacheWrite).toBe(30);
		expect(response.usage.totalTokens).toBe(105);
	});

	// 测试场景：验证“preserves prompt_tokens_details cache read/write fields from choice usage fallback”对应的行为、结果与边界。
	it("preserves prompt_tokens_details cache read/write fields from choice usage fallback", async () => {
		mockState.chunks = [
			{
				id: "chatcmpl-cache-write-choice",
				choices: [{ delta: { content: "OK" }, finish_reason: null }],
			},
			{
				id: "chatcmpl-cache-write-choice",
				choices: [
					{
						delta: {},
						finish_reason: "stop",
						usage: {
							prompt_tokens: 100,
							completion_tokens: 5,
							prompt_tokens_details: { cached_tokens: 50, cache_write_tokens: 30 },
							completion_tokens_details: { reasoning_tokens: 0 },
						},
					},
				],
			},
		];

		/** 常量 { compat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini")!;
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = { ...baseModel, api: "openai-completions" } as const;
		/** 常量 response 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const response = await streamSimple(
			model,
			{
				messages: [
					{
						role: "user",
						content: "Reply with exactly OK",
						timestamp: Date.now(),
					},
				],
			},
			{ apiKey: "test" },
		).result();

		// cached_tokens is documented as cache reads; cache_write_tokens is separate.
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		expect(response.usage.input).toBe(20);
		expect(response.usage.cacheRead).toBe(50);
		expect(response.usage.cacheWrite).toBe(30);
		expect(response.usage.totalTokens).toBe(105);
	});

	// 测试场景：验证“uses OpenRouter reasoning object instead of reasoning_effort”对应的行为、结果与边界。
	it("uses OpenRouter reasoning object instead of reasoning_effort", async () => {
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = getModel("openrouter", "deepseek/deepseek-r1")!;
		/** 变量 payload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let payload: unknown;

		await streamSimple(
			model,
			{
				messages: [
					{
						role: "user",
						content: "Hi",
						timestamp: Date.now(),
					},
				],
			},
			{
				apiKey: "test",
				reasoning: "high",
				onPayload: (params: unknown) => {
					payload = params;
				},
			},
		).result();

		/** 常量 params 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const params = (payload ?? mockState.lastParams) as {
			reasoning?: { effort?: string };
			reasoning_effort?: string;
		};
		expect(params.reasoning).toEqual({ effort: "high" });
		expect(params.reasoning_effort).toBeUndefined();
	});

	// 测试场景：验证“uses configurable chat template boolean thinking kwargs”对应的行为、结果与边界。
	it("uses configurable chat template boolean thinking kwargs", async () => {
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = {
			...localOpenAICompletionsModel,
			id: "deepseek-ai/DeepSeek-V3.1",
			name: "DeepSeek V3.1 via vLLM",
			compat: {
				thinkingFormat: "chat-template",
				supportsReasoningEffort: false,
				chatTemplateKwargs: { thinking: { $var: "thinking.enabled" } },
			},
		} satisfies Model<"openai-completions">;

		/** 循环变量 testCase 表示当前遍历项或索引，仅在循环体内有效。 */
		for (const testCase of [
			{ reasoning: "high" as const, expected: true },
			{ reasoning: undefined, expected: false },
		]) {
			/** 常量 params 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const params = await captureSimpleParams(model, testCase.reasoning);

			expect(params.chat_template_kwargs).toEqual({ thinking: testCase.expected });
			expect(params.thinking).toBeUndefined();
			expect(params.reasoning_effort).toBeUndefined();
		}
	});

	// 测试场景：验证“uses qwen chat template thinking kwargs”对应的行为、结果与边界。
	it("uses qwen chat template thinking kwargs", async () => {
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = {
			...localOpenAICompletionsModel,
			id: "Qwen/Qwen3-Coder",
			name: "Qwen3 Coder via vLLM",
			compat: {
				thinkingFormat: "qwen-chat-template",
				supportsReasoningEffort: false,
			},
		} satisfies Model<"openai-completions">;

		/** 循环变量 testCase 表示当前遍历项或索引，仅在循环体内有效。 */
		for (const testCase of [
			{ reasoning: "high" as const, expected: true },
			{ reasoning: undefined, expected: false },
		]) {
			/** 常量 params 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const params = await captureSimpleParams(model, testCase.reasoning);

			expect(params.chat_template_kwargs).toEqual({
				enable_thinking: testCase.expected,
				preserve_thinking: true,
			});
			expect(params.reasoning_effort).toBeUndefined();
		}
	});

	// 测试场景：验证“uses configurable chat template effort kwargs with static kwargs”对应的行为、结果与边界。
	it("uses configurable chat template effort kwargs with static kwargs", async () => {
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = {
			...localOpenAICompletionsModel,
			id: "unsloth/gpt-oss-120b-GGUF",
			name: "GPT OSS via vLLM",
			thinkingLevelMap: { xhigh: "max" },
			compat: {
				thinkingFormat: "chat-template",
				supportsReasoningEffort: false,
				chatTemplateKwargs: {
					preserve_thinking: true,
					reasoning_effort: { $var: "thinking.effort", omitWhenOff: true },
				},
			},
		} satisfies Model<"openai-completions">;

		/** 常量 params 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const params = await captureSimpleParams(model, "xhigh");

		expect(params.chat_template_kwargs).toEqual({ preserve_thinking: true, reasoning_effort: "max" });
		expect(params.reasoning_effort).toBeUndefined();
	});

	// 测试场景：验证“uses Ant Ling compatibility metadata”对应的行为、结果与边界。
	it("uses Ant Ling compatibility metadata", async () => {
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = getModel("ant-ling", "Ring-2.6-1T")!;
		/** 变量 payload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let payload: unknown;

		expect(model.compat).toMatchObject({
			supportsStore: false,
			supportsDeveloperRole: false,
			supportsReasoningEffort: false,
			maxTokensField: "max_tokens",
			thinkingFormat: "ant-ling",
			supportsLongCacheRetention: false,
		});
		expect(model.compat?.supportsStrictMode).toBeUndefined();
		expect(model.compat?.requiresReasoningContentOnAssistantMessages).toBeUndefined();

		await streamSimple(
			model,
			{
				systemPrompt: "Follow instructions.",
				messages: [{ role: "user", content: "Hi", timestamp: Date.now() }],
			},
			{
				apiKey: "test",
				maxTokens: 123,
				reasoning: "high",
				cacheRetention: "long",
				sessionId: "ant-ling-session",
				onPayload: (params: unknown) => {
					payload = params;
				},
			},
		).result();

		/** 常量 params 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const params = (payload ?? mockState.lastParams) as {
			max_tokens?: number;
			max_completion_tokens?: number;
			messages?: Array<{ role?: string }>;
			reasoning?: { effort?: string };
			reasoning_effort?: string;
			store?: boolean;
			prompt_cache_key?: string;
			prompt_cache_retention?: string;
		};
		expect(params.max_tokens).toBe(123);
		expect(params.max_completion_tokens).toBeUndefined();
		expect(params.messages?.[0]?.role).toBe("system");
		expect(params.reasoning).toEqual({ effort: "high" });
		expect(params.reasoning_effort).toBeUndefined();
		expect(params.store).toBeUndefined();
		expect(params.prompt_cache_key).toBeUndefined();
		expect(params.prompt_cache_retention).toBeUndefined();
	});

	// 测试场景：验证“omits Ant Ling reasoning for unmapped direct reasoning efforts and non-reasoning models”对应的行为、结果与边界。
	it("omits Ant Ling reasoning for unmapped direct reasoning efforts and non-reasoning models", async () => {
		/** 常量 ring 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const ring = getModel("ant-ling", "Ring-2.6-1T")!;
		/** 变量 payload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let payload: unknown;

		await stream(
			ring,
			{
				messages: [{ role: "user", content: "Hi", timestamp: Date.now() }],
			},
			{
				apiKey: "test",
				reasoningEffort: "medium",
				onPayload: (params: unknown) => {
					payload = params;
				},
			},
		).result();

		expect((payload ?? mockState.lastParams) as { reasoning?: unknown }).not.toHaveProperty("reasoning");

		/** 常量 ling 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const ling = getModel("ant-ling", "Ling-2.6-flash")!;
		await streamSimple(
			ling,
			{
				messages: [{ role: "user", content: "Hi", timestamp: Date.now() }],
			},
			{
				apiKey: "test",
				reasoning: "high",
				onPayload: (params: unknown) => {
					payload = params;
				},
			},
		).result();

		expect((payload ?? mockState.lastParams) as { reasoning?: unknown }).not.toHaveProperty("reasoning");
	});
});
