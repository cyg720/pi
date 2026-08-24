/**
 * 文件职责：验证各模型提供商能否正确接收并理解工具结果中的纯图片或图文混合内容。
 * 技术维度：使用 Vitest、统一 complete 接口、TypeBox 工具定义、Base64 PNG 数据和多提供商模型配置。
 * 产品维度：保障扩展工具返回截图、图表等图片后，模型能继续识别视觉内容并回答用户。
 * 逻辑维度：两个共享函数分别执行纯图片与图文工具循环，再按凭据条件为每个提供商运行相同断言。
 * 关键边界：大部分用例会调用真实付费 API；模型必须声明支持 image，少数已知多模态质量问题被显式跳过。
 * 新手阅读建议：先读 handleToolWithImageResult 的两次请求流程，再比较混合内容版本，最后看提供商参数差异。
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Type } from "typebox";
import { describe, expect, it } from "vitest";
import type { Api, Context, Model, Tool, ToolResultMessage } from "../src/compat.ts";
import { complete, getModel } from "../src/compat.ts";
import type { StreamOptions } from "../src/types.ts";

/** 流配置扩展类型：允许测试向基础 StreamOptions 附加提供商专用选项。 */
type StreamOptionsWithExtras = StreamOptions & Record<string, unknown>;

import { hasAzureOpenAICredentials, resolveAzureDeploymentName } from "./azure-utils.ts";
import { hasBedrockCredentials } from "./bedrock-utils.ts";
import { resolveApiKey } from "./oauth.ts";

// Resolve OAuth tokens at module level (async, runs before tests)
/** 变量 oauthTokens：模块加载时并行解析的三种 OAuth 凭据；只在当前模块、函数或测试分组内使用。 */
// 中文说明：以上英文注释补充了本测试步骤的意图、预期结果或已知提供商限制。
const oauthTokens = await Promise.all([
	resolveApiKey("anthropic"),
	resolveApiKey("github-copilot"),
	resolveApiKey("openai-codex"),
]);
/** 解构变量：分别保存 Anthropic、GitHub Copilot 与 OpenAI Codex 的 OAuth 凭据，缺失时为 undefined。 */
const [anthropicOAuthToken, githubCopilotToken, openaiCodexToken] = oauthTokens;

/**
 * Test that tool results containing only images work correctly across all providers.
 * This verifies that:
 * 1. Tool results can contain image content blocks
 * 2. Providers correctly pass images from tool results to the LLM
 * 3. The LLM can see and describe images returned by tools
 */
/** 中文说明：执行“工具只返回图片”的完整两步模型调用。参数 model 为被测模型、options 为可选流配置；无有意义返回值。例如：await handleToolWithImageResult(model)。 */
async function handleToolWithImageResult<TApi extends Api>(model: Model<TApi>, options?: StreamOptionsWithExtras) {
	// Check if the model supports images
	// 中文说明：以上英文注释补充了本测试步骤的意图、预期结果或已知提供商限制。
	if (!model.input.includes("image")) {
		console.log(`Skipping tool image result test - model ${model.id} doesn't support images`);
		return;
	}

	// Read the test image
	/** 变量 imagePath：红色圆形测试图片的文件路径；只在当前模块、函数或测试分组内使用。 */
	// 中文说明：以上英文注释补充了本测试步骤的意图、预期结果或已知提供商限制。
	const imagePath = join(__dirname, "data", "red-circle.png");
	/** 变量 imageBuffer：从磁盘读取的原始 PNG 字节；只在当前模块、函数或测试分组内使用。 */
	const imageBuffer = readFileSync(imagePath);
	/** 变量 base64Image：可放入图片内容块的 Base64 字符串；只在当前模块、函数或测试分组内使用。 */
	const base64Image = imageBuffer.toString("base64");

	// Define a tool that returns only an image (no text)
	/** 变量 getImageSchema：无参数测试工具的 TypeBox 模式；只在当前模块、函数或测试分组内使用。 */
	// 中文说明：以上英文注释补充了本测试步骤的意图、预期结果或已知提供商限制。
	const getImageSchema = Type.Object({});
	/** 变量 getImageTool：要求模型调用的取图工具定义；只在当前模块、函数或测试分组内使用。 */
	const getImageTool: Tool<typeof getImageSchema> = {
		name: "get_circle",
		description: "Returns a circle image for visualization",
		parameters: getImageSchema,
	};

	/** 变量 context：当前两轮工具调用共享并持续追加消息的上下文；只在当前模块、函数或测试分组内使用。 */
	const context: Context = {
		systemPrompt: "You are a helpful assistant that uses tools when asked.",
		messages: [
			{
				role: "user",
				content: "Call the get_circle tool to get an image, and describe what you see, shapes, colors, etc.",
				timestamp: Date.now(),
			},
		],
		tools: [getImageTool],
	};

	// First request - LLM should call the tool
	/** 变量 firstResponse：模型第一次应包含工具调用的响应；只在当前模块、函数或测试分组内使用。 */
	// 中文说明：以上英文注释补充了本测试步骤的意图、预期结果或已知提供商限制。
	const firstResponse = await complete(model, context, options);
	expect(firstResponse.stopReason).toBe("toolUse");

	// Find the tool call
	/** 变量 toolCall：从第一次响应中找到的 get_circle 工具调用；只在当前模块、函数或测试分组内使用。 */
	// 中文说明：以上英文注释补充了本测试步骤的意图、预期结果或已知提供商限制。
	const toolCall = firstResponse.content.find((b) => b.type === "toolCall");
	expect(toolCall).toBeTruthy();
	if (!toolCall || toolCall.type !== "toolCall") {
		throw new Error("Expected tool call");
	}
	expect(toolCall.name).toBe("get_circle");

	// Add the tool call to context
	// 中文说明：以上英文注释补充了本测试步骤的意图、预期结果或已知提供商限制。
	context.messages.push(firstResponse);

	// Create tool result with ONLY an image (no text)
	/** 变量 toolResult：使用同一调用编号构造的图片或图文工具结果；只在当前模块、函数或测试分组内使用。 */
	// 中文说明：以上英文注释补充了本测试步骤的意图、预期结果或已知提供商限制。
	const toolResult: ToolResultMessage = {
		role: "toolResult",
		toolCallId: toolCall.id,
		toolName: toolCall.name,
		content: [
			{
				type: "image",
				data: base64Image,
				mimeType: "image/png",
			},
		],
		isError: false,
		timestamp: Date.now(),
	};

	context.messages.push(toolResult);

	// Second request - LLM should describe the image from the tool result
	/** 变量 secondResponse：模型读取工具结果后的最终响应；只在当前模块、函数或测试分组内使用。 */
	// 中文说明：以上英文注释补充了本测试步骤的意图、预期结果或已知提供商限制。
	const secondResponse = await complete(model, context, options);
	expect(secondResponse.stopReason).toBe("stop");
	expect(secondResponse.errorMessage).toBeFalsy();

	// Verify the LLM can see and describe the image
	/** 变量 textContent：最终响应中的首个文本内容块；只在当前模块、函数或测试分组内使用。 */
	// 中文说明：以上英文注释补充了本测试步骤的意图、预期结果或已知提供商限制。
	const textContent = secondResponse.content.find((b) => b.type === "text");
	expect(textContent).toBeTruthy();
	if (textContent && textContent.type === "text") {
		/** 变量 lowerContent：转为小写后用于稳定断言的回复文本；只在当前模块、函数或测试分组内使用。 */
		const lowerContent = textContent.text.toLowerCase();
		// Should mention red and circle since that's what the image shows
		// 中文说明：以上英文注释补充了本测试步骤的意图、预期结果或已知提供商限制。
		expect(lowerContent).toContain("red");
		expect(lowerContent).toContain("circle");
	}
}

/**
 * Test that tool results containing both text and images work correctly across all providers.
 * This verifies that:
 * 1. Tool results can contain mixed content blocks (text + images)
 * 2. Providers correctly pass both text and images from tool results to the LLM
 * 3. The LLM can see both the text and images in tool results
 */
/** 中文说明：执行“工具同时返回文字与图片”的完整两步模型调用。参数 model 为被测模型、options 为可选流配置；无有意义返回值。例如：await handleToolWithTextAndImageResult(model, options)。 */
async function handleToolWithTextAndImageResult<TApi extends Api>(
	model: Model<TApi>,
	options?: StreamOptionsWithExtras,
) {
	// Check if the model supports images
	// 中文说明：以上英文注释补充了本测试步骤的意图、预期结果或已知提供商限制。
	if (!model.input.includes("image")) {
		console.log(`Skipping tool text+image result test - model ${model.id} doesn't support images`);
		return;
	}

	// Read the test image
	/** 变量 imagePath：红色圆形测试图片的文件路径；只在当前模块、函数或测试分组内使用。 */
	// 中文说明：以上英文注释补充了本测试步骤的意图、预期结果或已知提供商限制。
	const imagePath = join(__dirname, "data", "red-circle.png");
	/** 变量 imageBuffer：从磁盘读取的原始 PNG 字节；只在当前模块、函数或测试分组内使用。 */
	const imageBuffer = readFileSync(imagePath);
	/** 变量 base64Image：可放入图片内容块的 Base64 字符串；只在当前模块、函数或测试分组内使用。 */
	const base64Image = imageBuffer.toString("base64");

	// Define a tool that returns both text and an image
	/** 变量 getImageSchema：无参数测试工具的 TypeBox 模式；只在当前模块、函数或测试分组内使用。 */
	// 中文说明：以上英文注释补充了本测试步骤的意图、预期结果或已知提供商限制。
	const getImageSchema = Type.Object({});
	/** 变量 getImageTool：要求模型调用的取图工具定义；只在当前模块、函数或测试分组内使用。 */
	const getImageTool: Tool<typeof getImageSchema> = {
		name: "get_circle_with_description",
		description: "Returns a circle image with a text description",
		parameters: getImageSchema,
	};

	/** 变量 context：当前两轮工具调用共享并持续追加消息的上下文；只在当前模块、函数或测试分组内使用。 */
	const context: Context = {
		systemPrompt: "You are a helpful assistant that uses tools when asked.",
		messages: [
			{
				role: "user",
				content:
					"Use the get_circle_with_description tool and tell me what you learned. Also say what color the shape is.",
				timestamp: Date.now(),
			},
		],
		tools: [getImageTool],
	};

	// First request - LLM should call the tool
	/** 变量 firstResponse：模型第一次应包含工具调用的响应；只在当前模块、函数或测试分组内使用。 */
	// 中文说明：以上英文注释补充了本测试步骤的意图、预期结果或已知提供商限制。
	const firstResponse = await complete(model, context, options);
	expect(firstResponse.stopReason).toBe("toolUse");

	// Find the tool call
	/** 变量 toolCall：从第一次响应中找到的 get_circle 工具调用；只在当前模块、函数或测试分组内使用。 */
	// 中文说明：以上英文注释补充了本测试步骤的意图、预期结果或已知提供商限制。
	const toolCall = firstResponse.content.find((b) => b.type === "toolCall");
	expect(toolCall).toBeTruthy();
	if (!toolCall || toolCall.type !== "toolCall") {
		throw new Error("Expected tool call");
	}
	expect(toolCall.name).toBe("get_circle_with_description");

	// Add the tool call to context
	// 中文说明：以上英文注释补充了本测试步骤的意图、预期结果或已知提供商限制。
	context.messages.push(firstResponse);

	// Create tool result with BOTH text and image
	/** 变量 toolResult：使用同一调用编号构造的图片或图文工具结果；只在当前模块、函数或测试分组内使用。 */
	// 中文说明：以上英文注释补充了本测试步骤的意图、预期结果或已知提供商限制。
	const toolResult: ToolResultMessage = {
		role: "toolResult",
		toolCallId: toolCall.id,
		toolName: toolCall.name,
		content: [
			{
				type: "text",
				text: "This is a geometric shape with specific properties: it has a diameter of 100 pixels.",
			},
			{
				type: "image",
				data: base64Image,
				mimeType: "image/png",
			},
		],
		isError: false,
		timestamp: Date.now(),
	};

	context.messages.push(toolResult);

	// Second request - LLM should describe both the text and image from the tool result
	/** 变量 secondResponse：模型读取工具结果后的最终响应；只在当前模块、函数或测试分组内使用。 */
	// 中文说明：以上英文注释补充了本测试步骤的意图、预期结果或已知提供商限制。
	const secondResponse = await complete(model, context, options);
	expect(secondResponse.stopReason).toBe("stop");
	expect(secondResponse.errorMessage).toBeFalsy();

	// Verify the LLM can see both text and image
	/** 变量 textContent：最终响应中的首个文本内容块；只在当前模块、函数或测试分组内使用。 */
	// 中文说明：以上英文注释补充了本测试步骤的意图、预期结果或已知提供商限制。
	const textContent = secondResponse.content.find((b) => b.type === "text");
	expect(textContent).toBeTruthy();
	if (textContent && textContent.type === "text") {
		/** 变量 lowerContent：转为小写后用于稳定断言的回复文本；只在当前模块、函数或测试分组内使用。 */
		const lowerContent = textContent.text.toLowerCase();
		// Should mention details from the text (diameter/pixels)
		// 中文说明：以上英文注释补充了本测试步骤的意图、预期结果或已知提供商限制。
		expect(lowerContent.match(/diameter|100|pixel/)).toBeTruthy();
		// Should also mention the visual properties (red and circle)
		// 中文说明：以上英文注释补充了本测试步骤的意图、预期结果或已知提供商限制。
		expect(lowerContent).toContain("red");
		expect(lowerContent).toContain("circle");
	}
}

/** 测试分组：按模型提供商验证图片工具结果。 */
describe("Tool Results with Images", () => {
	/** 测试分组：按模型提供商验证图片工具结果。 */
	describe.skipIf(!process.env.GEMINI_API_KEY)("Google Provider (gemini-2.5-flash)", () => {
		/** 变量 llm：当前提供商分组使用的模型配置；只在当前模块、函数或测试分组内使用。 */
		const llm = getModel("google", "gemini-2.5-flash");

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it("should handle tool result with only image", { retry: 3, timeout: 30000 }, async () => {
			await handleToolWithImageResult(llm);
		});

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it("should handle tool result with text and image", { retry: 3, timeout: 30000 }, async () => {
			await handleToolWithTextAndImageResult(llm);
		});
	});

	/** 测试分组：按模型提供商验证图片工具结果。 */
	describe.skipIf(!process.env.OPENAI_API_KEY)("OpenAI Completions Provider (gpt-4o-mini)", () => {
		/** 解构变量：保留 OpenAI 基础模型字段，并丢弃本用例不需要的 compat 包装字段。 */
		const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini");
		void _compat;
		/** 变量 llm：当前提供商分组使用的模型配置；只在当前模块、函数或测试分组内使用。 */
		const llm: Model<"openai-completions"> = {
			...baseModel,
			api: "openai-completions",
		};

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it("should handle tool result with only image", { retry: 3, timeout: 30000 }, async () => {
			await handleToolWithImageResult(llm);
		});

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it("should handle tool result with text and image", { retry: 3, timeout: 30000 }, async () => {
			await handleToolWithTextAndImageResult(llm);
		});
	});

	/** 测试分组：按模型提供商验证图片工具结果。 */
	describe.skipIf(!process.env.OPENAI_API_KEY)("OpenAI Responses Provider (gpt-5-mini)", () => {
		/** 变量 llm：当前提供商分组使用的模型配置；只在当前模块、函数或测试分组内使用。 */
		const llm = getModel("openai", "gpt-5-mini");

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it("should handle tool result with only image", { retry: 3, timeout: 30000 }, async () => {
			await handleToolWithImageResult(llm);
		});

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it("should handle tool result with text and image", { retry: 3, timeout: 30000 }, async () => {
			await handleToolWithTextAndImageResult(llm);
		});
	});

	/** 测试分组：按模型提供商验证图片工具结果。 */
	describe.skipIf(!hasAzureOpenAICredentials())("Azure OpenAI Responses Provider (gpt-4o-mini)", () => {
		/** 变量 llm：当前提供商分组使用的模型配置；只在当前模块、函数或测试分组内使用。 */
		const llm = getModel("azure-openai-responses", "gpt-4o-mini");
		/** 变量 azureDeploymentName：由模型编号解析出的 Azure 部署名；只在当前模块、函数或测试分组内使用。 */
		const azureDeploymentName = resolveAzureDeploymentName(llm.id);
		/** 变量 azureOptions：仅在解析成功时传入的 Azure 部署选项；只在当前模块、函数或测试分组内使用。 */
		const azureOptions = azureDeploymentName ? { azureDeploymentName } : {};

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it("should handle tool result with only image", { retry: 3, timeout: 30000 }, async () => {
			await handleToolWithImageResult(llm, azureOptions);
		});

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it("should handle tool result with text and image", { retry: 3, timeout: 30000 }, async () => {
			await handleToolWithTextAndImageResult(llm, azureOptions);
		});
	});

	/** 测试分组：按模型提供商验证图片工具结果。 */
	describe.skipIf(!process.env.ANTHROPIC_API_KEY)("Anthropic Provider (claude-haiku-4-5)", () => {
		/** 变量 model：当前提供商分组使用的模型配置；只在当前模块、函数或测试分组内使用。 */
		const model = getModel("anthropic", "claude-haiku-4-5");

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it("should handle tool result with only image", { retry: 3, timeout: 30000 }, async () => {
			await handleToolWithImageResult(model);
		});

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it("should handle tool result with text and image", { retry: 3, timeout: 30000 }, async () => {
			await handleToolWithTextAndImageResult(model);
		});
	});

	/** 测试分组：按模型提供商验证图片工具结果。 */
	describe.skipIf(!process.env.OPENROUTER_API_KEY)("OpenRouter Provider (glm-4.5v)", () => {
		/** 变量 llm：当前提供商分组使用的模型配置；只在当前模块、函数或测试分组内使用。 */
		const llm = getModel("openrouter", "z-ai/glm-4.5v");

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it("should handle tool result with only image", { retry: 3, timeout: 30000 }, async () => {
			await handleToolWithImageResult(llm);
		});

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it("should handle tool result with text and image", { retry: 3, timeout: 30000 }, async () => {
			await handleToolWithTextAndImageResult(llm);
		});
	});

	/** 测试分组：按模型提供商验证图片工具结果。 */
	describe.skipIf(!process.env.MISTRAL_API_KEY)("Mistral Provider (pixtral-12b)", () => {
		/** 变量 llm：当前提供商分组使用的模型配置；只在当前模块、函数或测试分组内使用。 */
		const llm = getModel("mistral", "pixtral-12b");

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it("should handle tool result with only image", { retry: 5, timeout: 30000 }, async () => {
			await handleToolWithImageResult(llm);
		});

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it("should handle tool result with text and image", { retry: 5, timeout: 30000 }, async () => {
			await handleToolWithTextAndImageResult(llm);
		});
	});

	/** 测试分组：按模型提供商验证图片工具结果。 */
	describe.skipIf(!process.env.TOGETHER_API_KEY)("Together AI Provider (Kimi-K2.6)", () => {
		/** 变量 llm：当前提供商分组使用的模型配置；只在当前模块、函数或测试分组内使用。 */
		const llm = getModel("together", "moonshotai/Kimi-K2.6");
		/** 变量 options：当前提供商需要附加的推理配置；只在当前模块、函数或测试分组内使用。 */
		const options = { reasoningEffort: "high" } satisfies StreamOptionsWithExtras;

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it("should handle tool result with only image", { retry: 3, timeout: 30000 }, async () => {
			await handleToolWithImageResult(llm, options);
		});

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it("should handle tool result with text and image", { retry: 3, timeout: 30000 }, async () => {
			await handleToolWithTextAndImageResult(llm, options);
		});
	});

	/** 测试分组：按模型提供商验证图片工具结果。 */
	describe.skipIf(!process.env.XIAOMI_API_KEY)("Xiaomi MiMo (API billing) Provider (mimo-v2.5-pro)", () => {
		/** 变量 llm：当前提供商分组使用的模型配置；只在当前模块、函数或测试分组内使用。 */
		const llm = getModel("xiaomi", "mimo-v2.5-pro");

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it("should handle tool result with only image", { retry: 3, timeout: 30000 }, async () => {
			await handleToolWithImageResult(llm);
		});

		// FIXME(xiaomi): when a tool_result contains both a descriptive text block
		// and an image block, MiMo locks onto the text and ignores the image (it
		// reports the text-derived diameter but never mentions the image's color).
		// The image-only case above proves the image reaches the model, and the
		// text-only path obviously works, so this is a multimodal-fusion quality
		// issue in the model, not a transport bug. Re-enable when upstream model
		// quality improves.
		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		// 中文说明：以上英文注释补充了本测试步骤的意图、预期结果或已知提供商限制。
		it.skip("should handle tool result with text and image", { retry: 3, timeout: 30000 }, async () => {
			await handleToolWithTextAndImageResult(llm);
		});
	});

	/** 测试分组：按模型提供商验证图片工具结果。 */
	describe.skipIf(!process.env.XIAOMI_TOKEN_PLAN_CN_API_KEY)(
		"Xiaomi MiMo Token Plan (CN) Provider (mimo-v2.5-pro)",
		() => {
			/** 变量 llm：当前提供商分组使用的模型配置；只在当前模块、函数或测试分组内使用。 */
			const llm = getModel("xiaomi-token-plan-cn", "mimo-v2.5-pro");

			/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
			it("should handle tool result with only image", { retry: 3, timeout: 30000 }, async () => {
				await handleToolWithImageResult(llm);
			});

			// FIXME(xiaomi): see the API-billing block above — same multimodal-fusion
			// limitation applies to Token Plan endpoints (same model behind both).
			/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
			// 中文说明：以上英文注释补充了本测试步骤的意图、预期结果或已知提供商限制。
			it.skip("should handle tool result with text and image", { retry: 3, timeout: 30000 }, async () => {
				await handleToolWithTextAndImageResult(llm);
			});
		},
	);

	/** 测试分组：按模型提供商验证图片工具结果。 */
	describe.skipIf(!process.env.XIAOMI_TOKEN_PLAN_AMS_API_KEY)(
		"Xiaomi MiMo Token Plan (AMS) Provider (mimo-v2.5-pro)",
		() => {
			/** 变量 llm：当前提供商分组使用的模型配置；只在当前模块、函数或测试分组内使用。 */
			const llm = getModel("xiaomi-token-plan-ams", "mimo-v2.5-pro");

			/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
			it("should handle tool result with only image", { retry: 3, timeout: 30000 }, async () => {
				await handleToolWithImageResult(llm);
			});

			// FIXME(xiaomi): see the API-billing block above — same multimodal-fusion
			// limitation applies to Token Plan endpoints (same model behind both).
			/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
			// 中文说明：以上英文注释补充了本测试步骤的意图、预期结果或已知提供商限制。
			it.skip("should handle tool result with text and image", { retry: 3, timeout: 30000 }, async () => {
				await handleToolWithTextAndImageResult(llm);
			});
		},
	);

	/** 测试分组：按模型提供商验证图片工具结果。 */
	describe.skipIf(!process.env.XIAOMI_TOKEN_PLAN_SGP_API_KEY)(
		"Xiaomi MiMo Token Plan (SGP) Provider (mimo-v2.5-pro)",
		() => {
			/** 变量 llm：当前提供商分组使用的模型配置；只在当前模块、函数或测试分组内使用。 */
			const llm = getModel("xiaomi-token-plan-sgp", "mimo-v2.5-pro");

			/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
			it("should handle tool result with only image", { retry: 3, timeout: 30000 }, async () => {
				await handleToolWithImageResult(llm);
			});

			// FIXME(xiaomi): see the API-billing block above — same multimodal-fusion
			// limitation applies to Token Plan endpoints (same model behind both).
			/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
			// 中文说明：以上英文注释补充了本测试步骤的意图、预期结果或已知提供商限制。
			it.skip("should handle tool result with text and image", { retry: 3, timeout: 30000 }, async () => {
				await handleToolWithTextAndImageResult(llm);
			});
		},
	);

	/** 测试分组：按模型提供商验证图片工具结果。 */
	describe.skipIf(!process.env.QWEN_TOKEN_PLAN_API_KEY)("Qwen Token Plan Provider (qwen3.7-max)", () => {
		/** 变量 llm：当前提供商分组使用的模型配置；只在当前模块、函数或测试分组内使用。 */
		const llm = getModel("qwen-token-plan", "qwen3.7-max");

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it("should handle tool result with only image", { retry: 3, timeout: 30000 }, async () => {
			await handleToolWithImageResult(llm);
		});

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it("should handle tool result with text and image", { retry: 3, timeout: 30000 }, async () => {
			await handleToolWithTextAndImageResult(llm);
		});
	});

	/** 测试分组：按模型提供商验证图片工具结果。 */
	describe.skipIf(!process.env.QWEN_TOKEN_PLAN_CN_API_KEY)("Qwen Token Plan (CN) Provider (qwen3.7-max)", () => {
		/** 变量 llm：当前提供商分组使用的模型配置；只在当前模块、函数或测试分组内使用。 */
		const llm = getModel("qwen-token-plan-cn", "qwen3.7-max");

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it("should handle tool result with only image", { retry: 3, timeout: 30000 }, async () => {
			await handleToolWithImageResult(llm);
		});

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it("should handle tool result with text and image", { retry: 3, timeout: 30000 }, async () => {
			await handleToolWithTextAndImageResult(llm);
		});
	});

	/** 测试分组：按模型提供商验证图片工具结果。 */
	describe.skipIf(!process.env.KIMI_API_KEY)("Kimi For Coding Provider (kimi-for-coding)", () => {
		/** 变量 llm：当前提供商分组使用的模型配置；只在当前模块、函数或测试分组内使用。 */
		const llm = getModel("kimi-coding", "kimi-for-coding");

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it("should handle tool result with only image", { retry: 3, timeout: 30000 }, async () => {
			await handleToolWithImageResult(llm);
		});

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it("should handle tool result with text and image", { retry: 3, timeout: 30000 }, async () => {
			await handleToolWithTextAndImageResult(llm);
		});
	});

	/** 测试分组：按模型提供商验证图片工具结果。 */
	describe.skipIf(!process.env.AI_GATEWAY_API_KEY)("Vercel AI Gateway Provider (google/gemini-2.5-flash)", () => {
		/** 变量 llm：当前提供商分组使用的模型配置；只在当前模块、函数或测试分组内使用。 */
		const llm = getModel("vercel-ai-gateway", "google/gemini-2.5-flash");

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it("should handle tool result with only image", { retry: 3, timeout: 30000 }, async () => {
			await handleToolWithImageResult(llm);
		});

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it("should handle tool result with text and image", { retry: 3, timeout: 30000 }, async () => {
			await handleToolWithTextAndImageResult(llm);
		});
	});

	/** 测试分组：按模型提供商验证图片工具结果。 */
	describe.skipIf(!hasBedrockCredentials())("Amazon Bedrock Provider (claude-sonnet-4-5)", () => {
		/** 变量 llm：当前提供商分组使用的模型配置；只在当前模块、函数或测试分组内使用。 */
		const llm = getModel("amazon-bedrock", "global.anthropic.claude-sonnet-4-5-20250929-v1:0");

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it("should handle tool result with only image", { retry: 3, timeout: 30000 }, async () => {
			await handleToolWithImageResult(llm);
		});

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it("should handle tool result with text and image", { retry: 3, timeout: 30000 }, async () => {
			await handleToolWithTextAndImageResult(llm);
		});
	});

	// =========================================================================
	// OAuth-based providers (credentials from ~/.pi/agent/oauth.json)
	// =========================================================================

	/** 测试分组：按模型提供商验证图片工具结果。 */
	describe("Anthropic OAuth Provider (claude-sonnet-4-5)", () => {
		/** 变量 model：当前提供商分组使用的模型配置；只在当前模块、函数或测试分组内使用。 */
		const model = getModel("anthropic", "claude-sonnet-4-5");

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it.skipIf(!anthropicOAuthToken)(
			"should handle tool result with only image",
			{ retry: 3, timeout: 30000 },
			async () => {
				await handleToolWithImageResult(model, { apiKey: anthropicOAuthToken });
			},
		);

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it.skipIf(!anthropicOAuthToken)(
			"should handle tool result with text and image",
			{ retry: 3, timeout: 30000 },
			async () => {
				await handleToolWithTextAndImageResult(model, { apiKey: anthropicOAuthToken });
			},
		);
	});

	/** 测试分组：按模型提供商验证图片工具结果。 */
	describe("GitHub Copilot Provider", () => {
		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it.skipIf(!githubCopilotToken)(
			"claude-haiku-4.5 - should handle tool result with only image",
			{ retry: 3, timeout: 30000 },
			async () => {
				/** 变量 llm：当前提供商分组使用的模型配置；只在当前模块、函数或测试分组内使用。 */
				const llm = getModel("github-copilot", "claude-haiku-4.5");
				await handleToolWithImageResult(llm, { apiKey: githubCopilotToken });
			},
		);

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it.skipIf(!githubCopilotToken)(
			"claude-haiku-4.5 - should handle tool result with text and image",
			{ retry: 3, timeout: 30000 },
			async () => {
				/** 变量 llm：当前提供商分组使用的模型配置；只在当前模块、函数或测试分组内使用。 */
				const llm = getModel("github-copilot", "claude-haiku-4.5");
				await handleToolWithTextAndImageResult(llm, { apiKey: githubCopilotToken });
			},
		);

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it.skipIf(!githubCopilotToken)(
			"claude-sonnet-4 - should handle tool result with only image",
			{ retry: 3, timeout: 30000 },
			async () => {
				/** 变量 llm：当前提供商分组使用的模型配置；只在当前模块、函数或测试分组内使用。 */
				const llm = getModel("github-copilot", "claude-sonnet-4.6");
				await handleToolWithImageResult(llm, { apiKey: githubCopilotToken });
			},
		);

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it.skipIf(!githubCopilotToken)(
			"claude-sonnet-4 - should handle tool result with text and image",
			{ retry: 3, timeout: 30000 },
			async () => {
				/** 变量 llm：当前提供商分组使用的模型配置；只在当前模块、函数或测试分组内使用。 */
				const llm = getModel("github-copilot", "claude-sonnet-4.6");
				await handleToolWithTextAndImageResult(llm, { apiKey: githubCopilotToken });
			},
		);
	});

	/** 测试分组：按模型提供商验证图片工具结果。 */
	describe("OpenAI Codex Provider", () => {
		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it.skipIf(!openaiCodexToken)(
			"gpt-5.5 - should handle tool result with only image",
			{ retry: 3, timeout: 30000 },
			async () => {
				/** 变量 llm：当前提供商分组使用的模型配置；只在当前模块、函数或测试分组内使用。 */
				const llm = getModel("openai-codex", "gpt-5.5");
				await handleToolWithImageResult(llm, { apiKey: openaiCodexToken });
			},
		);

		/** 测试场景：验证当前模型的纯图片或图文工具结果处理能力。 */
		it.skipIf(!openaiCodexToken)(
			"gpt-5.5 - should handle tool result with text and image",
			{ retry: 3, timeout: 30000 },
			async () => {
				/** 变量 llm：当前提供商分组使用的模型配置；只在当前模块、函数或测试分组内使用。 */
				const llm = getModel("openai-codex", "gpt-5.5");
				await handleToolWithTextAndImageResult(llm, { apiKey: openaiCodexToken });
			},
		);
	});
});
