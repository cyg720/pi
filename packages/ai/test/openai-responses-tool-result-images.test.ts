/**
 * 文件职责：验证 Responses API 会把工具返回的图片保留在 function_call_output 中，而不是拆成后续用户消息。
 * 技术维度：使用 Vitest、TypeBox、Base64 图片和多提供商兼容层执行带图片工具结果的在线集成测试。
 * 产品维度：保证模型能同时理解工具返回的文字与图片，避免多模态工具链在不同提供商下丢失上下文。
 * 逻辑维度：准备工具与图片，完成首次工具调用，再回填工具结果并检查第二次请求载荷和最终回复。
 * 关键边界：测试依赖真实凭据并可能被跳过；目标模型必须支持图片输入；测试图片来自本地固定数据。
 * 新手阅读建议：先看 verifyToolResultImagesStayInFunctionCallOutput 的两轮请求，再看末尾各提供商如何复用它。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ResponseFunctionCallOutputItemList } from "openai/resources/responses/responses.js";
import { Type } from "typebox";
import { describe, expect, it } from "vitest";
import type { Api, Context, Model, StreamOptions, Tool, ToolResultMessage } from "../src/compat.ts";
import { complete, getModel } from "../src/compat.ts";
import { hasAzureOpenAICredentials, resolveAzureDeploymentName } from "./azure-utils.ts";
import { resolveApiKey } from "./oauth.ts";

/** 在通用流选项上容纳不同提供商的附加字段，字段含义由对应适配器决定。 */
type StreamOptionsWithExtras = StreamOptions & Record<string, unknown>;

/** 当前测试文件的绝对路径，用于兼容 ES 模块中没有 __filename 的情况。 */
const __filename = fileURLToPath(import.meta.url);
/** 当前测试文件所在目录，用于定位固定测试图片。 */
const __dirname = dirname(__filename);

/** 并行解析可选提供商的 OAuth 凭据；缺少凭据时对应测试会跳过。 */
const oauthTokens = await Promise.all([resolveApiKey("github-copilot"), resolveApiKey("openai-codex")]);
/** GitHub Copilot 与 OpenAI Codex 的凭据，值为空表示当前环境不可运行对应在线测试。 */
const [githubCopilotToken, openaiCodexToken] = oauthTokens;

/** 无参数图片工具的 TypeBox 输入结构。 */
const getImageSchema = Type.Object({});
/** 模拟返回图片与描述的工具定义，供模型在首轮请求中调用。 */
const getImageTool: Tool<typeof getImageSchema> = {
	name: "get_circle_with_description",
	description: "Returns a red circle image with a short text description.",
	parameters: getImageSchema,
};

/** 测试只关心 input 字段的 Responses 请求载荷最小结构。 */
type CapturedResponsePayload = { input?: unknown[] };
/** function_call_output 项的最小结构，output 既可能是字符串，也可能是内容数组。 */
type FunctionCallOutputItem = {
	type: "function_call_output";
	output: string | ResponseFunctionCallOutputItemList;
};
/** 工具输出中的文字内容项。 */
type InputTextItem = { type: "input_text"; text: string };
/** 工具输出中的图片内容项，image_url 应为 data URL。 */
type InputImageItem = { type: "input_image"; image_url: string };

/**
 * 验证指定 Responses 模型能原样传递工具返回的文字和图片。
 * @param model 待测试的模型定义，必须使用兼容层支持的 API 类型。
 * @param options 提供商专用流选项，例如凭据、部署名或推理强度。
 * @returns 测试完成后无返回值；不支持图片的模型会提前结束。
 * @example await verifyToolResultImagesStayInFunctionCallOutput(getModel("openai", "gpt-5-mini"));
 */
async function verifyToolResultImagesStayInFunctionCallOutput<TApi extends Api>(
	model: Model<TApi>,
	options?: StreamOptionsWithExtras,
) {
	if (!model.input.includes("image")) {
		console.log(`Skipping responses tool-result image test. Model ${model.id} does not support images.`);
		return;
	}

	/** 固定红色圆形测试图片的绝对路径。 */
	const imagePath = join(__dirname, "data", "red-circle.png");
	/** 图片的 Base64 文本，用于构造工具结果中的内联图片。 */
	const base64Image = readFileSync(imagePath).toString("base64");
	/** 与图片内容一致的工具文字描述，用于验证文字没有丢失。 */
	const toolText = "A red circle with a diameter of 100 pixels.";

	/** 两轮模型调用共享的会话上下文，首轮只包含用户请求和工具声明。 */
	const context: Context = {
		systemPrompt: "You are a helpful assistant that always uses the provided tool when asked.",
		messages: [
			{
				role: "user",
				content:
					"Call get_circle_with_description, then describe both the tool text and the image. Mention the color and shape.",
				timestamp: Date.now(),
			},
		],
		tools: [getImageTool],
	};

	/** 首轮响应应要求调用图片工具。 */
	const firstResponse = await complete(model, context, options);
	expect(firstResponse.stopReason, `Error: ${firstResponse.errorMessage}`).toBe("toolUse");

	/** 从首轮响应中提取唯一需要回填的工具调用。 */
	const toolCall = firstResponse.content.find((block) => block.type === "toolCall");
	expect(toolCall).toBeTruthy();
	if (!toolCall || toolCall.type !== "toolCall") {
		throw new Error("Expected tool call");
	}

	context.messages.push(firstResponse);
	context.messages.push({
		role: "toolResult",
		toolCallId: toolCall.id,
		toolName: toolCall.name,
		content: [
			{ type: "text", text: toolText },
			{ type: "image", data: base64Image, mimeType: "image/png" },
		],
		isError: false,
		timestamp: Date.now(),
	} satisfies ToolResultMessage);

	/** 保存第二轮真正发送给提供商的原始请求载荷。 */
	let capturedPayload: unknown;
	/** 第二轮响应应消费工具结果并生成自然语言回答。 */
	const secondResponse = await complete(model, context, {
		...options,
		onPayload: (payload) => {
			capturedPayload = payload;
		},
	});

	expect(secondResponse.stopReason, `Error: ${secondResponse.errorMessage}`).toBe("stop");
	expect(secondResponse.errorMessage).toBeFalsy();

	/** 将捕获值缩窄为本测试需要的最小载荷形状。 */
	const responsePayload = capturedPayload as CapturedResponsePayload | undefined;
	expect(Array.isArray(responsePayload?.input)).toBe(true);
	if (!Array.isArray(responsePayload?.input)) {
		throw new Error("Expected payload with input array");
	}
	/** 已确认存在的 Responses input 数组。 */
	const responseInput = responsePayload.input;

	/** 工具调用输出在 input 数组中的位置，后续还用于检查是否出现多余用户消息。 */
	const functionCallOutputIndex = responseInput.findIndex(
		(item) => (item as { type?: unknown } | null)?.type === "function_call_output",
	);
	expect(functionCallOutputIndex).toBeGreaterThanOrEqual(0);
	/** 包含工具文字和图片的 function_call_output 项。 */
	const functionCallOutput = responseInput[functionCallOutputIndex] as FunctionCallOutputItem | undefined;
	if (!functionCallOutput) {
		throw new Error("Expected function_call_output item");
	}

	expect(Array.isArray(functionCallOutput.output)).toBe(true);
	if (!Array.isArray(functionCallOutput.output)) {
		throw new Error("Expected function_call_output output to be a content array");
	}

	/** function_call_output 内的内容项数组。 */
	const outputItems = functionCallOutput.output;
	/** 从工具输出中找到的文字项。 */
	const textItem = outputItems.find((item) => (item as { type?: unknown } | null)?.type === "input_text") as
		| InputTextItem
		| undefined;
	/** 从工具输出中找到的图片项。 */
	const imageItem = outputItems.find((item) => (item as { type?: unknown } | null)?.type === "input_image") as
		| InputImageItem
		| undefined;

	expect(textItem).toBeTruthy();
	expect(imageItem).toBeTruthy();
	if (!textItem || !imageItem) {
		throw new Error("Expected both input_text and input_image in function_call_output");
	}

	expect(textItem.text).toContain(toolText);
	expect(imageItem.image_url.startsWith("data:image/png;base64,")).toBe(true);

	/** function_call_output 之后出现的用户消息；正确实现中应为空。 */
	const laterUserMessages = responseInput
		.slice(functionCallOutputIndex + 1)
		.filter((item) => (item as { role?: unknown } | null)?.role === "user");
	expect(laterUserMessages).toHaveLength(0);

	/** 第二轮模型回复的纯文本小写形式，便于做不区分大小写的关键词断言。 */
	const responseText = secondResponse.content
		.filter((block) => block.type === "text")
		.map((block) => block.text)
		.join(" ")
		.toLowerCase();
	expect(responseText).toContain("red");
	expect(responseText).toContain("circle");
}

/** 按提供商分组运行同一图片工具结果契约；无凭据的在线分组会自动跳过。 */
describe("Responses API tool result images", () => {
	describe.skipIf(!process.env.OPENAI_API_KEY)("OpenAI Responses Provider (gpt-5-mini)", () => {
		/** OpenAI 在线测试使用的轻量多模态模型。 */
		const model = getModel("openai", "gpt-5-mini");

		it("should send tool result images in function_call_output", { retry: 3, timeout: 30000 }, async () => {
			await verifyToolResultImagesStayInFunctionCallOutput(model, { reasoningEffort: "low" });
		});
	});

	describe.skipIf(!hasAzureOpenAICredentials())("Azure OpenAI Responses Provider (gpt-4o-mini)", () => {
		/** Azure Responses 在线测试使用的模型定义。 */
		const model = getModel("azure-openai-responses", "gpt-4o-mini");
		/** 从环境映射中解析出的 Azure 部署名。 */
		const azureDeploymentName = resolveAzureDeploymentName(model.id);
		/** 仅在解析到部署名时传递 Azure 专用选项。 */
		const azureOptions = azureDeploymentName ? { azureDeploymentName } : {};

		it("should send tool result images in function_call_output", { retry: 3, timeout: 30000 }, async () => {
			await verifyToolResultImagesStayInFunctionCallOutput(model, azureOptions);
		});
	});

	describe("GitHub Copilot Responses Provider (gpt-5-mini)", () => {
		/** GitHub Copilot 在线测试使用的模型定义。 */
		const model = getModel("github-copilot", "gpt-5-mini");

		it.skipIf(!githubCopilotToken)(
			"should send tool result images in function_call_output",
			{ retry: 3, timeout: 30000 },
			async () => {
				await verifyToolResultImagesStayInFunctionCallOutput(model, {
					apiKey: githubCopilotToken,
					reasoningEffort: "low",
				});
			},
		);
	});

	describe("OpenAI Codex Responses Provider (gpt-5.5)", () => {
		/** OpenAI Codex 在线测试使用的模型定义。 */
		const model = getModel("openai-codex", "gpt-5.5");

		it.skipIf(!openaiCodexToken)(
			"should send tool result images in function_call_output",
			{ retry: 3, timeout: 30000 },
			async () => {
				await verifyToolResultImagesStayInFunctionCallOutput(model, {
					apiKey: openaiCodexToken,
					reasoningEffort: "low",
				});
			},
		);
	});
});
