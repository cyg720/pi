/**
 * 文件职责：验证 OpenAI Completions 消息转换器对工具结果图片和空工具输出的特殊编排规则。
 * 技术维度：使用 Vitest、真实模型元数据和手工构造的统一消息类型，检查转换后的 OpenAI 消息序列。
 * 产品维度：确保工具读取的图片能正确交给支持视觉的模型，并让无输出命令仍得到模型可理解的占位文本。
 * 逻辑维度：先定义兼容能力与工具结果工厂，再分别测试连续图片结果批处理和空结果占位两条路径。
 * 关键边界：图片数据为测试占位 Base64；兼容配置需覆盖所有必填字段，测试不发送真实 API 请求。
 * 新手阅读建议：先看 buildToolResult 的统一消息形状，再比较 convertMessages 前后的角色数组和内容块。
 */
import { describe, expect, it } from "vitest";
import { convertMessages } from "../src/api/openai-completions.ts";
import { getModel } from "../src/compat.ts";
import type {
	AssistantMessage,
	Context,
	Model,
	OpenAICompletionsCompat,
	ToolResultMessage,
	Usage,
} from "../src/types.ts";

// emptyUsage 是不产生任何计费令牌的固定使用量，供手工构造助手消息复用。
const emptyUsage: Usage = {
	input: 0,
	output: 0,
	cacheRead: 0,
	cacheWrite: 0,
	totalTokens: 0,
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

// compat 描述本组用例假定的 OpenAI Completions 能力开关，避免依赖提供商默认探测。
const compat: Omit<Required<OpenAICompletionsCompat>, "deferredToolsMode"> & {
	deferredToolsMode?: OpenAICompletionsCompat["deferredToolsMode"];
} = {
	supportsStore: true,
	supportsDeveloperRole: true,
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
	cacheControlFormat: "anthropic",
	sendSessionAffinityHeaders: false,
	sessionAffinityFormat: "openai",
	supportsLongCacheRetention: true,
};

/**
 * 构造一个同时包含说明文本和 PNG 图片的成功工具结果。
 * @param toolCallId 与助手消息中工具调用对应的唯一标识。
 * @param timestamp 工具完成时间的毫秒时间戳。
 * @returns 可传入消息上下文的 ToolResultMessage；例如 `buildToolResult("tool-1", Date.now())`。
 */
function buildToolResult(toolCallId: string, timestamp: number): ToolResultMessage {
	return {
		role: "toolResult",
		toolCallId,
		toolName: "read",
		content: [
			{ type: "text", text: "Read image file [image/png]" },
			{ type: "image", data: "ZmFrZQ==", mimeType: "image/png" },
		],
		isError: false,
		timestamp,
	};
}

/**
 * 构造一个文本为空且不含图片的成功工具结果。
 * @param toolCallId 与 bash 工具调用对应的唯一标识。
 * @param timestamp 工具完成时间的毫秒时间戳。
 * @returns 用于验证空输出占位行为的 ToolResultMessage；例如 `buildEmptyToolResult("tool-1", Date.now())`。
 */
function buildEmptyToolResult(toolCallId: string, timestamp: number): ToolResultMessage {
	return {
		role: "toolResult",
		toolCallId,
		toolName: "bash",
		content: [{ type: "text", text: "" }],
		isError: false,
		timestamp,
	};
}

// 汇总验证统一上下文转换为 OpenAI Completions 消息时的工具结果规则。
describe("openai-completions convertMessages", () => {
	// 连续工具结果中的图片应合并到工具消息之后的单个用户消息中。
	it("batches tool-result images after consecutive tool results", () => {
		// baseModel 是移除原有 compat 字段后的真实模型元数据，便于覆盖为本测试 API。
		const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini");
		// model 明确声明同时支持文本和图片输入，并使用 OpenAI Completions 转换器。
		const model: Model<"openai-completions"> = {
			...baseModel,
			api: "openai-completions",
			input: ["text", "image"],
		};

		// now 为整段对话提供统一基准时间，保持消息顺序清晰。
		const now = Date.now();
		// assistantMessage 包含两个连续的图片读取工具调用。
		const assistantMessage: AssistantMessage = {
			role: "assistant",
			content: [
				{ type: "toolCall", id: "tool-1", name: "read", arguments: { path: "img-1.png" } },
				{ type: "toolCall", id: "tool-2", name: "read", arguments: { path: "img-2.png" } },
			],
			api: model.api,
			provider: model.provider,
			model: model.id,
			usage: emptyUsage,
			stopReason: "toolUse",
			timestamp: now,
		};

		// context 模拟用户请求、助手调用和两个工具结果组成的完整对话。
		const context: Context = {
			messages: [
				{ role: "user", content: "Read the images", timestamp: now - 2 },
				assistantMessage,
				buildToolResult("tool-1", now + 1),
				buildToolResult("tool-2", now + 2),
			],
		};

		// messages 是转换为提供商协议后的消息数组。
		const messages = convertMessages(model, context, compat);
		// roles 提取角色顺序，便于确认图片用户消息位于所有工具消息之后。
		const roles = messages.map((message) => message.role);
		expect(roles).toEqual(["user", "assistant", "tool", "tool", "user"]);

		// imageMessage 是转换器追加的最后一条用户消息，负责承载两张图片。
		const imageMessage = messages[messages.length - 1];
		expect(imageMessage.role).toBe("user");
		expect(Array.isArray(imageMessage.content)).toBe(true);

		// imageParts 从多模态内容中筛选 OpenAI 使用的 image_url 图片块。
		const imageParts = (imageMessage.content as Array<{ type?: string }>).filter(
			(part) => part?.type === "image_url",
		);
		expect(imageParts.length).toBe(2);
	});

	// 没有文本和图片的工具结果应转换为明确占位符，而不是图片提示。
	it("uses '(no tool output)' placeholder for empty tool results without images", () => {
		// baseModel 提供真实模型的基础元数据，同时舍弃其原始兼容配置。
		const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini");
		// model 指定待测的消息转换 API 和可接受输入类型。
		const model: Model<"openai-completions"> = {
			...baseModel,
			api: "openai-completions",
			input: ["text", "image"],
		};

		// now 是用户、助手和工具消息时间戳的共同基准。
		const now = Date.now();
		// assistantMessage 模拟一次无标准输出的 bash 工具调用。
		const assistantMessage: AssistantMessage = {
			role: "assistant",
			content: [{ type: "toolCall", id: "tool-1", name: "bash", arguments: { command: "true" } }],
			api: model.api,
			provider: model.provider,
			model: model.id,
			usage: emptyUsage,
			stopReason: "toolUse",
			timestamp: now,
		};

		// context 包含单次工具调用及其空文本结果。
		const context: Context = {
			messages: [
				{ role: "user", content: "Run the command", timestamp: now - 1 },
				assistantMessage,
				buildEmptyToolResult("tool-1", now + 1),
			],
		};

		// messages 是供 OpenAI 接口消费的转换后消息序列。
		const messages = convertMessages(model, context, compat);
		// toolMessage 定位转换后的工具消息，并收窄到文本内容结构。
		const toolMessage = messages.find((m) => m.role === "tool") as { role: "tool"; content: string } | undefined;
		expect(toolMessage).toBeTruthy();
		expect(toolMessage?.content).toBe("(no tool output)");
		expect(toolMessage?.content).not.toContain("see attached image");
	});
});
