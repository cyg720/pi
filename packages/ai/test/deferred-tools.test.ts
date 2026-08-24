/**
 * 文件职责：验证延迟工具在 Anthropic、Kimi、OpenAI Responses、Codex 与普通提供商之间的序列化和计数。
 * 技术维度：使用 Vitest、TypeBox 工具模式、跨提供商消息转换、payload 捕获异常和上下文 Token 估算。
 * 产品维度：让大型工具集合按需加载，减少提示词成本，同时在切换模型或读取历史时保持工具可用性。
 * 逻辑维度：先构造统一工具历史和 payload 捕获器，再分别断言各 API 的延迟标记、引用和兼容回退。
 * 关键边界：只有明确支持的模型启用延迟加载；已使用工具必须立即提供，缺失工具不能从历史标记复活。
 * 新手阅读建议：先读 makeContext 与 capturePayload，再看 Anthropic 标记，随后对比 Kimi 和 OpenAI tool search。
 */
import { Type } from "typebox";
import { describe, expect, it } from "vitest";
import { convertMessages } from "../src/api/openai-completions.ts";
import { getModel, streamSimple } from "../src/compat.ts";
import type { Api, AssistantMessage, Context, Model, Tool, ToolResultMessage, UserMessage } from "../src/types.ts";
import { estimateContextTokens } from "../src/utils/estimate.ts";

/** Anthropic 请求中工具定义的测试投影。 */
interface AnthropicToolPayload {
	/** 发送给 Anthropic 的工具名称。 */
	name: string;
	/** 可选工具描述。 */
	description?: string;
	/** 是否只在模型请求时加载完整定义。 */
	defer_loading?: boolean;
}

/** Anthropic 消息内容块中本文件读取字段的测试投影。 */
interface AnthropicContentBlock {
	/** 内容块类别。 */
	type: string;
	/** 文本块内容。 */
	text?: string;
	/** tool_result 对应的工具调用编号。 */
	tool_use_id?: string;
	/** 工具结果文本或含 tool_reference 的内容数组。 */
	content?: string | Array<{ type: string; tool_name?: string }>;
	/** 图片等二进制内容的来源描述。 */
	source?: {
		/** 来源编码类别。 */
		type: string;
		/** 媒体 MIME 类型。 */
		media_type: string;
		/** Base64 数据。 */
		data: string;
	};
}

/** Anthropic 请求体中工具与消息字段的测试投影。 */
interface AnthropicPayload {
	/** 顶层工具定义列表。 */
	tools?: AnthropicToolPayload[];
	/** 请求消息及其字符串或内容块。 */
	messages: Array<{
		content: string | AnthropicContentBlock[];
	}>;
}

/** OpenAI 客户端工具搜索调用项的测试投影。 */
interface OpenAIToolSearchCall {
	/** 固定为客户端工具搜索调用类型。 */
	type: "tool_search_call";
	/** 搜索调用编号。 */
	call_id?: string | null;
	/** 执行方，预期为 client。 */
	execution?: string;
	/** 搜索状态。 */
	status?: string | null;
}

/** OpenAI 客户端工具搜索输出项的测试投影。 */
interface OpenAIToolSearchOutput {
	/** 固定为工具搜索输出类型。 */
	type: "tool_search_output";
	/** 与搜索调用匹配的编号。 */
	call_id?: string | null;
	/** 执行方。 */
	execution?: string;
	/** 输出状态。 */
	status?: string | null;
	/** 搜索发现并延迟加载的工具定义。 */
	tools: Array<{ type: string; name: string; defer_loading?: boolean }>;
}

/** OpenAI Responses 请求体中工具与输入项的测试投影。 */
interface OpenAIPayload {
	/** 顶层普通或 function 工具定义。 */
	tools?: Array<{ name?: string; function?: { name: string } }>;
	/** 输入中的工具搜索调用、输出或其他项。 */
	input?: Array<OpenAIToolSearchCall | OpenAIToolSearchOutput | { type?: string }>;
}

/** Kimi system 工具定义的测试投影。 */
interface KimiTool {
	/** Kimi 工具固定使用 function 类型。 */
	type: "function";
	/** 函数名称、描述和 JSON Schema 参数。 */
	function: {
		name: string;
		description?: string;
		parameters?: Record<string, unknown>;
	};
}

/** Kimi 消息中本文件读取字段的测试投影。 */
interface KimiMessage {
	/** 消息角色。 */
	role: string;
	/** 可选消息内容。 */
	content?: unknown;
	/** system 消息中携带的延迟工具定义。 */
	tools?: KimiTool[];
}

/** Kimi 请求体的测试投影。 */
interface KimiPayload {
	/** 首轮立即提供的工具。 */
	tools?: KimiTool[];
	/** 转换后的 Kimi 消息序列。 */
	messages: KimiMessage[];
}

/** 用于在 onPayload 回调中提前停止网络流程的内部捕获异常。 */
class PayloadCaptured extends Error {}

/** 构造最小字符串参数工具。参数 name 为工具名；返回 Tool。例如：makeTool("read")。 */
function makeTool(name: string): Tool {
	return {
		name,
		description: `The ${name} tool`,
		parameters: Type.Object({ value: Type.String() }),
	};
}

/** 构造固定文本用户消息。参数 timestamp 为毫秒时间；返回 UserMessage。例如：makeUserMessage(1)。 */
function makeUserMessage(timestamp: number): UserMessage {
	return { role: "user", content: "Hello", timestamp };
}

/** 构造调用 base_tool 的固定助手消息。无参数；返回 AssistantMessage。例如：makeAssistantToolCall()。 */
function makeAssistantToolCall(): AssistantMessage {
	return {
		role: "assistant",
		content: [{ type: "toolCall", id: "call_1", name: "base_tool", arguments: {} }],
		api: "anthropic-messages",
		provider: "anthropic",
		model: "claude-opus-4-6",
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "toolUse",
		timestamp: 2,
	};
}

/** 构造带新增工具标记的固定结果。参数 addedToolNames 为工具名列表；返回 ToolResultMessage。例如：makeToolResult(["late"])。 */
function makeToolResult(addedToolNames: string[]): ToolResultMessage {
	return {
		role: "toolResult",
		toolCallId: "call_1",
		toolName: "base_tool",
		content: [{ type: "text", text: "done" }],
		addedToolNames,
		isError: false,
		timestamp: 3,
	};
}

/** 构造包含工具调用、结果和后续用户消息的上下文。参数 tools 为活动工具、addedToolNames 为延迟标记；返回 Context。例如：makeContext(tools)。 */
function makeContext(tools: Tool[], addedToolNames = ["late_tool"]): Context {
	return {
		messages: [makeUserMessage(1), makeAssistantToolCall(), makeToolResult(addedToolNames), makeUserMessage(4)],
		tools,
	};
}

/** 构造可选启用 Kimi 延迟工具模式的模型。参数 deferredToolsMode 为 kimi 或缺省；返回 Model。例如：makeKimiModel("kimi")。 */
function makeKimiModel(deferredToolsMode?: "kimi"): Model<"openai-completions"> {
	return {
		id: "deferred-tools-model",
		name: "Deferred Tools Model",
		api: "openai-completions",
		provider: "moonshotai",
		baseUrl: "http://127.0.0.1:9/v1",
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128000,
		maxTokens: 4096,
		compat: deferredToolsMode ? { deferredToolsMode } : undefined,
	};
}

/** 通过 onPayload 截获实际请求体。参数 model、context、apiKey 为调用输入；返回泛型 payload。例如：await capturePayload<ModelPayload>(model, context)。 */
async function capturePayload<T>(model: Model<Api>, context: Context, apiKey = "fake-key"): Promise<T> {
	/** onPayload 捕获的泛型请求体；回调执行前为 undefined。 */
	let captured: T | undefined;
	/** 用于触发请求体生成的简单助手事件流。 */
	const stream = streamSimple({ ...model, baseUrl: "http://127.0.0.1:9" }, context, {
		apiKey,
		onPayload: (payload) => {
			captured = payload as T;
			throw new PayloadCaptured();
		},
	});
	await stream.result();
	if (!captured) throw new Error("Expected payload capture");
	return captured;
}

/** 查找包含 tool_result 的 Anthropic 消息内容。参数 payload 为请求体；返回内容块数组，缺失时抛错。 */
function findAnthropicToolResultContent(payload: AnthropicPayload): AnthropicContentBlock[] {
	// message 依次表示 Anthropic 请求中的每条消息。
	for (const message of payload.messages) {
		if (typeof message.content !== "string" && message.content.some((block) => block.type === "tool_result")) {
			return message.content;
		}
	}
	throw new Error("No tool result in payload");
}

/** 查找第一个 Anthropic tool_result 块。参数 payload 为请求体；返回内容块，缺失时抛错。 */
function findAnthropicToolResult(payload: AnthropicPayload): AnthropicContentBlock {
	/** 当前查找到的 Anthropic 工具结果块。 */
	const result = findAnthropicToolResultContent(payload).find((block) => block.type === "tool_result");
	if (!result) throw new Error("No tool result in payload");
	return result;
}

/** 从 Responses 工具定义中提取普通或 function 工具名。参数 payload 为请求体；返回名称数组。例如：openAIToolNames(payload)。 */
function openAIToolNames(payload: OpenAIPayload): string[] {
	return (payload.tools ?? []).map((tool) => tool.name ?? tool.function?.name ?? "");
}

/** 构造含测试账户编号的 Codex JWT 形状令牌。无参数；返回字符串。例如：makeCodexToken()。 */
function makeCodexToken(): string {
	return `header.${btoa(JSON.stringify({ "https://api.openai.com/auth": { chatgpt_account_id: "account" } }))}.signature`;
}

describe("deferred tools", () => {
	// 测试场景：验证“loads an Anthropic tool at its tool-result marker”对应的延迟工具行为。
	it("loads an Anthropic tool at its tool-result marker", async () => {
		/** 当前用例构造的工具历史上下文。 */
		const context = makeContext([makeTool("base_tool"), makeTool("late_tool")]);
		/** 当前模型序列化得到的请求 payload。 */
		const payload = await capturePayload<AnthropicPayload>(getModel("anthropic", "claude-opus-4-6"), context);

		expect(payload.tools).toMatchObject([{ name: "base_tool" }, { name: "late_tool", defer_loading: true }]);
		expect(findAnthropicToolResult(payload).content).toEqual([{ type: "tool_reference", tool_name: "late_tool" }]);
	});

	// 测试场景：验证“preserves tool output as sibling content after emitting references”对应的延迟工具行为。
	it("preserves tool output as sibling content after emitting references", async () => {
		/** 当前用例构造的工具历史上下文。 */
		const context = makeContext([makeTool("base_tool"), makeTool("late_tool")]);
		/** 从上下文中取出并按用例修改的助手消息。 */
		const assistant = context.messages[1] as AssistantMessage;
		assistant.content = [
			{ type: "toolCall", id: "call_1", name: "base_tool", arguments: {} },
			{ type: "toolCall", id: "call_2", name: "base_tool", arguments: {} },
		];
		/** 上下文中第一个工具结果消息。 */
		const firstResult = context.messages[2] as ToolResultMessage;
		firstResult.content = [
			{ type: "text", text: "work completed" },
			{ type: "image", mimeType: "image/png", data: "aW1hZ2U=" },
		];
		context.messages.splice(3, 0, {
			...makeToolResult([]),
			toolCallId: "call_2",
			content: [{ type: "text", text: "second result" }],
		});

		/** 当前模型序列化得到的请求 payload。 */
		const payload = await capturePayload<AnthropicPayload>(getModel("anthropic", "claude-opus-4-6"), context);

		expect(findAnthropicToolResultContent(payload)).toMatchObject([
			{
				type: "tool_result",
				tool_use_id: "call_1",
				content: [{ type: "tool_reference", tool_name: "late_tool" }],
			},
			{ type: "tool_result", tool_use_id: "call_2", content: "second result" },
			{ type: "text", text: "work completed" },
			{
				type: "image",
				source: { type: "base64", media_type: "image/png", data: "aW1hZ2U=" },
			},
		]);
	});

	// 测试场景：验证“loads a tool introduced by OpenAI history after switching to Anthropic”对应的延迟工具行为。
	it("loads a tool introduced by OpenAI history after switching to Anthropic", async () => {
		/** 当前用例构造的工具历史上下文。 */
		const context = makeContext([makeTool("base_tool"), makeTool("late_tool")]);
		/** 从上下文中取出并按用例修改的助手消息。 */
		const assistant = context.messages[1] as AssistantMessage;
		assistant.api = "openai-responses";
		assistant.provider = "openai";
		assistant.model = "gpt-5.4";

		/** 当前模型序列化得到的请求 payload。 */
		const payload = await capturePayload<AnthropicPayload>(getModel("anthropic", "claude-opus-4-8"), context);

		expect(payload.tools).toMatchObject([{ name: "base_tool" }, { name: "late_tool", defer_loading: true }]);
		expect(findAnthropicToolResult(payload).content).toEqual([{ type: "tool_reference", tool_name: "late_tool" }]);
	});

	// 测试场景：验证“does not resurrect a marked tool missing from Context.tools”对应的延迟工具行为。
	it("does not resurrect a marked tool missing from Context.tools", async () => {
		/** 当前用例构造的工具历史上下文。 */
		const context = makeContext([makeTool("base_tool")]);
		/** 当前模型序列化得到的请求 payload。 */
		const payload = await capturePayload<AnthropicPayload>(getModel("anthropic", "claude-opus-4-6"), context);

		expect(payload.tools?.map((tool) => tool.name)).toEqual(["base_tool"]);
		/** Anthropic 工具结果内容，可为字符串或内容块数组。 */
		const content = findAnthropicToolResult(payload).content;
		expect(Array.isArray(content) && content.some((block) => block.type === "tool_reference")).toBe(false);
	});

	// 测试场景：验证“keeps a tool immediate when it was used before its marker”对应的延迟工具行为。
	it("keeps a tool immediate when it was used before its marker", async () => {
		/** 当前用例构造的工具历史上下文。 */
		const context = makeContext([makeTool("base_tool"), makeTool("late_tool")]);
		/** 从上下文中取出并按用例修改的助手消息。 */
		const assistant = context.messages[1] as AssistantMessage;
		assistant.content = [{ type: "toolCall", id: "call_1", name: "late_tool", arguments: {} }];
		/** 当前模型序列化得到的请求 payload。 */
		const payload = await capturePayload<AnthropicPayload>(getModel("anthropic", "claude-opus-4-6"), context);

		expect(payload.tools?.map((tool) => tool.name)).toEqual(["base_tool", "late_tool"]);
		expect(payload.tools?.every((tool) => !tool.defer_loading)).toBe(true);
	});

	// 测试场景：验证“normalizes OAuth names before checking prior tool usage”对应的延迟工具行为。
	it("normalizes OAuth names before checking prior tool usage", async () => {
		/** 当前用例构造的工具历史上下文。 */
		const context = makeContext([makeTool("base_tool"), makeTool("read")], ["read"]);
		/** 从上下文中取出并按用例修改的助手消息。 */
		const assistant = context.messages[1] as AssistantMessage;
		assistant.content = [{ type: "toolCall", id: "call_1", name: "Read", arguments: {} }];
		/** 当前模型序列化得到的请求 payload。 */
		const payload = await capturePayload<AnthropicPayload>(
			getModel("anthropic", "claude-opus-4-6"),
			context,
			"sk-ant-oat-fake",
		);

		expect(payload.tools?.map((tool) => tool.name)).toEqual(["base_tool", "Read"]);
		expect(payload.tools?.every((tool) => !tool.defer_loading)).toBe(true);
		/** Anthropic 工具结果内容，可为字符串或内容块数组。 */
		const content = findAnthropicToolResult(payload).content;
		expect(Array.isArray(content) && content.some((block) => block.type === "tool_reference")).toBe(false);
	});

	// 测试场景：验证“matches OAuth-canonicalized markers to active tools”对应的延迟工具行为。
	it("matches OAuth-canonicalized markers to active tools", async () => {
		/** 当前用例构造的工具历史上下文。 */
		const context = makeContext([makeTool("base_tool"), makeTool("read")], ["Read"]);
		/** 当前模型序列化得到的请求 payload。 */
		const payload = await capturePayload<AnthropicPayload>(
			getModel("anthropic", "claude-opus-4-6"),
			context,
			"sk-ant-oat-fake",
		);

		expect(payload.tools).toMatchObject([{ name: "base_tool" }, { name: "Read", defer_loading: true }]);
		/** Anthropic 工具结果内容，可为字符串或内容块数组。 */
		const content = findAnthropicToolResult(payload).content;
		expect(
			Array.isArray(content) &&
				content.some((block) => block.type === "tool_reference" && block.tool_name === "Read"),
		).toBe(true);
	});

	// 测试场景：验证“deduplicates active tools after OAuth canonicalization”对应的延迟工具行为。
	it("deduplicates active tools after OAuth canonicalization", async () => {
		/** 当前用例构造的工具历史上下文。 */
		const context: Context = {
			messages: [makeUserMessage(1)],
			tools: [makeTool("read"), { ...makeTool("Read"), description: "Canonical definition" }],
		};
		/** 当前模型序列化得到的请求 payload。 */
		const payload = await capturePayload<AnthropicPayload>(
			getModel("anthropic", "claude-opus-4-6"),
			context,
			"sk-ant-oat-fake",
		);

		expect(payload.tools).toMatchObject([{ name: "Read", description: "Canonical definition" }]);
	});

	// 测试场景：验证“uses the normal tool list when Anthropic tool references are unsupported”对应的延迟工具行为。
	it("uses the normal tool list when Anthropic tool references are unsupported", async () => {
		/** 当前用例构造的工具历史上下文。 */
		const context = makeContext([makeTool("base_tool"), makeTool("late_tool")]);
		/** 不支持 Anthropic 工具引用的模型列表。 */
		const models: Model<"anthropic-messages">[] = [
			getModel("anthropic", "claude-haiku-4-5"),
			{ ...getModel("anthropic", "claude-opus-4-6"), id: "claude-sonnet-4-20250514" },
		];

		// model 依次表示每个不支持工具引用的 Anthropic 模型。
		for (const model of models) {
			/** 当前模型序列化得到的请求 payload。 */
			const payload = await capturePayload<AnthropicPayload>(model, context);
			expect(payload.tools?.map((tool) => tool.name)).toEqual(["base_tool", "late_tool"]);
			expect(payload.tools?.every((tool) => !tool.defer_loading)).toBe(true);
		}
	});

	// 测试场景：验证“keeps one immediate Anthropic tool when every current tool is marked”对应的延迟工具行为。
	it("keeps one immediate Anthropic tool when every current tool is marked", async () => {
		/** 当前用例构造的工具历史上下文。 */
		const context = makeContext([makeTool("late_tool")]);
		/** 当前模型序列化得到的请求 payload。 */
		const payload = await capturePayload<AnthropicPayload>(getModel("anthropic", "claude-opus-4-6"), context);

		expect(payload.tools).toMatchObject([{ name: "late_tool" }]);
		expect(payload.tools?.[0]?.defer_loading).toBeUndefined();
		/** Anthropic 工具结果内容，可为字符串或内容块数组。 */
		const content = findAnthropicToolResult(payload).content;
		expect(Array.isArray(content) && content.some((block) => block.type === "tool_reference")).toBe(false);
	});

	// 测试场景：验证“supports explicit Anthropic compatibility overrides”对应的延迟工具行为。
	it("supports explicit Anthropic compatibility overrides", async () => {
		/** 当前用例构造或遍历的目标模型。 */
		const model: Model<"anthropic-messages"> = {
			...getModel("anthropic", "claude-opus-4-6"),
			provider: "anthropic-proxy",
			compat: { supportsToolReferences: true },
		};
		/** 当前用例构造的工具历史上下文。 */
		const context = makeContext([makeTool("base_tool"), makeTool("late_tool")]);
		/** 当前模型序列化得到的请求 payload。 */
		const payload = await capturePayload<AnthropicPayload>(model, context);

		expect(payload.tools?.find((tool) => tool.name === "late_tool")?.defer_loading).toBe(true);
	});

	// 测试场景：验证“serializes Kimi deferred tools as system tool definitions”对应的延迟工具行为。
	it("serializes Kimi deferred tools as system tool definitions", async () => {
		/** 当前用例构造的工具历史上下文。 */
		const context = makeContext([makeTool("base_tool"), makeTool("late_tool")]);
		/** 当前模型序列化得到的请求 payload。 */
		const payload = await capturePayload<KimiPayload>(makeKimiModel("kimi"), context);

		expect(payload.tools?.map((tool) => tool.function.name)).toEqual(["base_tool"]);
		/** Kimi 消息列表中首个 tool 结果的位置。 */
		const toolResultIndex = payload.messages.findIndex((message) => message.role === "tool");
		/** Kimi 延迟工具 system 消息的位置。 */
		const systemToolIndex = payload.messages.findIndex((message) => message.tools !== undefined);
		expect(toolResultIndex).toBeGreaterThanOrEqual(0);
		expect(systemToolIndex).toBeGreaterThan(toolResultIndex);
		expect(payload.messages[systemToolIndex]?.tools?.map((tool) => tool.function.name)).toEqual(["late_tool"]);
	});

	// 测试场景：验证“emits Kimi deferred schemas after all tool results in a batch”对应的延迟工具行为。
	it("emits Kimi deferred schemas after all tool results in a batch", () => {
		/** 当前用例构造的工具历史上下文。 */
		const context = makeContext([makeTool("base_tool"), makeTool("late_tool"), makeTool("later_tool")]);
		context.messages.splice(3, 0, {
			...makeToolResult(["later_tool"]),
			toolCallId: "call_2",
		});

		/** convertMessages 生成的 Kimi API 消息数组。 */
		const messages = convertMessages(makeKimiModel("kimi"), context, {
			supportsStore: false,
			supportsDeveloperRole: false,
			supportsReasoningEffort: false,
			supportsUsageInStreaming: true,
			maxTokensField: "max_tokens",
			requiresToolResultName: false,
			requiresAssistantAfterToolResult: false,
			requiresThinkingAsText: false,
			requiresReasoningContentOnAssistantMessages: false,
			thinkingFormat: "openai",
			openRouterRouting: {},
			vercelGatewayRouting: {},
			chatTemplateKwargs: {},
			zaiToolStream: false,
			supportsStrictMode: false,
			supportsOpenAIGrammarTools: false,
			cacheControlFormat: undefined,
			sendSessionAffinityHeaders: false,
			deferredToolsMode: "kimi",
			sessionAffinityFormat: "openai",
			supportsLongCacheRetention: false,
		});

		expect(messages.map((message) => message.role)).toEqual(["user", "assistant", "tool", "tool", "system", "user"]);
		expect((messages[4] as { tools?: KimiTool[] }).tools?.map((tool) => tool.function.name)).toEqual([
			"late_tool",
			"later_tool",
		]);
	});

	// 测试场景：验证“leaves OpenAI Completions tools unchanged without Kimi mode”对应的延迟工具行为。
	it("leaves OpenAI Completions tools unchanged without Kimi mode", async () => {
		/** 当前用例构造的工具历史上下文。 */
		const context = makeContext([makeTool("base_tool"), makeTool("late_tool")]);
		/** 当前模型序列化得到的请求 payload。 */
		const payload = await capturePayload<KimiPayload>(makeKimiModel(), context);

		expect(payload.tools?.map((tool) => tool.function.name)).toEqual(["base_tool", "late_tool"]);
		expect(payload.messages.some((message) => message.tools !== undefined)).toBe(false);
	});

	// 测试场景：验证“loads an OpenAI Responses tool through client tool search”对应的延迟工具行为。
	it("loads an OpenAI Responses tool through client tool search", async () => {
		/** 当前用例构造的工具历史上下文。 */
		const context = makeContext([makeTool("base_tool"), makeTool("late_tool")]);
		/** 当前模型序列化得到的请求 payload。 */
		const payload = await capturePayload<OpenAIPayload>(getModel("openai", "gpt-5.4"), context);
		/** Responses 输入中的客户端 tool_search_call 项。 */
		const searchCall = payload.input?.find((item): item is OpenAIToolSearchCall => item.type === "tool_search_call");
		/** Responses 输入中的客户端 tool_search_output 项。 */
		const searchOutput = payload.input?.find(
			(item): item is OpenAIToolSearchOutput => item.type === "tool_search_output",
		);

		expect(openAIToolNames(payload)).toEqual(["base_tool"]);
		expect(searchCall).toMatchObject({ execution: "client", status: "completed" });
		expect(searchOutput?.call_id).toBe(searchCall?.call_id);
		expect(searchOutput?.tools).toMatchObject([{ type: "function", name: "late_tool", defer_loading: true }]);
	});

	// 参数化场景：逐个验证不支持工具搜索的 OpenAI 模型回退到完整工具列表。
	it.each(["gpt-5.2", "gpt-5.4-nano", "gpt-5.5-pro"] as const)(
		"uses the normal tool list for unsupported OpenAI model %s",
		async (modelId) => {
			/** 当前用例构造的工具历史上下文。 */
			const context = makeContext([makeTool("base_tool"), makeTool("late_tool")]);
			/** 当前模型序列化得到的请求 payload。 */
			const payload = await capturePayload<OpenAIPayload>(getModel("openai", modelId), context);

			expect(openAIToolNames(payload)).toEqual(["base_tool", "late_tool"]);
			expect(payload.input?.some((item) => item.type === "tool_search_output")).toBe(false);
		},
	);

	// 测试场景：验证“uses the normal tool list when OpenAI tool search is explicitly disabled”对应的延迟工具行为。
	it("uses the normal tool list when OpenAI tool search is explicitly disabled", async () => {
		/** 当前用例构造或遍历的目标模型。 */
		const model: Model<"openai-responses"> = {
			...getModel("openai", "gpt-5.4"),
			provider: "openai-proxy",
			compat: { supportsToolSearch: false },
		};
		/** 当前用例构造的工具历史上下文。 */
		const context = makeContext([makeTool("base_tool"), makeTool("late_tool")]);
		/** 当前模型序列化得到的请求 payload。 */
		const payload = await capturePayload<OpenAIPayload>(model, context);

		expect(openAIToolNames(payload)).toEqual(["base_tool", "late_tool"]);
		expect(payload.input?.some((item) => item.type === "tool_search_output")).toBe(false);
	});

	// 测试场景：验证“uses tool search only for supported Codex models”对应的延迟工具行为。
	it("uses tool search only for supported Codex models", async () => {
		/** 当前用例构造的工具历史上下文。 */
		const context = makeContext([makeTool("base_tool"), makeTool("late_tool")]);
		/** 支持 Codex tool search 的模型请求体。 */
		const supported = await capturePayload<OpenAIPayload>(
			getModel("openai-codex", "gpt-5.4"),
			context,
			makeCodexToken(),
		);
		/** 不支持 Codex tool search 的模型请求体。 */
		const unsupported = await capturePayload<OpenAIPayload>(
			getModel("openai-codex", "gpt-5.3-codex-spark"),
			context,
			makeCodexToken(),
		);

		expect(openAIToolNames(supported)).toEqual(["base_tool"]);
		expect(supported.input?.some((item) => item.type === "tool_search_output")).toBe(true);
		expect(openAIToolNames(unsupported)).toEqual(["base_tool", "late_tool"]);
		expect(unsupported.input?.some((item) => item.type === "tool_search_output")).toBe(false);
	});

	// 测试场景：验证“leaves providers without deferred loading unchanged”对应的延迟工具行为。
	it("leaves providers without deferred loading unchanged", async () => {
		/** 当前用例构造的工具历史上下文。 */
		const context = makeContext([makeTool("base_tool"), makeTool("late_tool")]);
		/** 当前模型序列化得到的请求 payload。 */
		const payload = await capturePayload<OpenAIPayload>(getModel("groq", "llama-3.3-70b-versatile"), context);
		expect(openAIToolNames(payload)).toEqual(["base_tool", "late_tool"]);
	});

	// 测试场景：验证“counts definitions marked after the latest usage checkpoint”对应的延迟工具行为。
	it("counts definitions marked after the latest usage checkpoint", () => {
		/** 从上下文中取出并按用例修改的助手消息。 */
		const assistant: AssistantMessage = {
			...makeAssistantToolCall(),
			content: [{ type: "text", text: "done" }],
			usage: {
				input: 50,
				output: 50,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 100,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "stop",
		};
		/** 没有延迟工具定义时的上下文 Token 估算。 */
		const plain = estimateContextTokens({ messages: [assistant, makeUserMessage(4)], tools: [] });
		/** 带长描述、用于放大 Token 差异的延迟工具。 */
		const lateTool = { ...makeTool("late_tool"), description: "x".repeat(4000) };
		/** 加入延迟工具标记后的上下文 Token 估算。 */
		const marked = estimateContextTokens({
			messages: [assistant, makeToolResult(["late_tool"])],
			tools: [lateTool],
		});

		expect(marked.tokens).toBeGreaterThan(plain.tokens + 500);
		expect(marked.trailingTokens).toBeGreaterThan(plain.trailingTokens + 500);
	});
});
