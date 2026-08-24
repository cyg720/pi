/**
 * 文件职责：对所有受支持模型提供商执行统一的文本生成、工具调用、流式事件、推理、多轮和图像输入端到端验证。
 * 技术维度：使用 Vitest、pi-ai 兼容层、TypeBox 工具模式、OAuth/API Key 凭据以及可选的本地 Ollama 子进程。
 * 产品维度：确认不同供应商在相同产品能力下表现一致，帮助用户发现鉴权、协议兼容或模型能力回归。
 * 逻辑维度：先定义通用能力测试函数，再按提供商和模型注册条件测试，最后覆盖 OAuth、Bedrock 与本地 Ollama 场景。
 * 关键边界：多数用例会访问真实付费接口并受环境变量控制；本地 Ollama 测试还会拉取模型和启动进程，不应作为普通单元测试运行。
 * 新手阅读建议：先读六个通用测试函数理解统一契约，再按自己关心的提供商定位 describe 分组，最后查看 Ollama 生命周期管理。
 */
import { type ChildProcess, execSync, spawn } from "child_process";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { Type } from "typebox";
import { fileURLToPath } from "url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { complete, getModel, stream } from "../src/compat.ts";
import type { Api, Context, ImageContent, Model, StreamOptions, Tool, ToolResultMessage } from "../src/types.ts";

type StreamOptionsWithExtras = StreamOptions & Record<string, unknown>;

import { StringEnum } from "../src/utils/typebox-helpers.ts";
import { hasAzureOpenAICredentials, resolveAzureDeploymentName } from "./azure-utils.ts";
import { hasBedrockCredentials } from "./bedrock-utils.ts";
import { hasCloudflareAiGatewayCredentials, hasCloudflareWorkersAICredentials } from "./cloudflare-utils.ts";
import { resolveApiKey } from "./oauth.ts";

/** 常量 __filename 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const __filename = fileURLToPath(import.meta.url);
/** 常量 __dirname 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const __dirname = dirname(__filename);

// Resolve OAuth tokens at module level (async, runs before tests)
// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
const oauthTokens = await Promise.all([
	resolveApiKey("anthropic"),
	resolveApiKey("github-copilot"),
	resolveApiKey("openai-codex"),
]);
/** 常量 [anthropicOAuthToken, githubCopilotToken, openaiCodexToken] 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const [anthropicOAuthToken, githubCopilotToken, openaiCodexToken] = oauthTokens;

// Calculator tool definition (same as examples)
// Note: Using StringEnum helper because Google's API doesn't support anyOf/const patterns
// that Type.Enum generates. Google requires { type: "string", enum: [...] } format.
// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
const calculatorSchema = Type.Object({
	a: Type.Number({ description: "First number" }),
	b: Type.Number({ description: "Second number" }),
	operation: StringEnum(["add", "subtract", "multiply", "divide"], {
		description: "The operation to perform. One of 'add', 'subtract', 'multiply', 'divide'.",
	}),
});

/** 常量 calculatorTool 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const calculatorTool: Tool<typeof calculatorSchema> = {
	name: "math_operation",
	description: "Perform basic arithmetic operations",
	parameters: calculatorSchema,
};

async function basicTextGeneration<TApi extends Api>(model: Model<TApi>, options?: StreamOptionsWithExtras) {
	/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const context: Context = {
		systemPrompt: "You are a helpful assistant. Be concise.",
		messages: [{ role: "user", content: "Reply with exactly: 'Hello test successful'", timestamp: Date.now() }],
	};
	/** 常量 response 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const response = await complete(model, context, options);

	expect(response.role).toBe("assistant");
	expect(response.content).toBeTruthy();
	expect(response.usage.input + response.usage.cacheRead).toBeGreaterThan(0);
	expect(response.usage.output).toBeGreaterThan(0);
	expect(response.errorMessage).toBeFalsy();
	expect(response.content.map((b) => (b.type === "text" ? b.text : "")).join("")).toContain("Hello test successful");

	context.messages.push(response);
	context.messages.push({ role: "user", content: "Now say 'Goodbye test successful'", timestamp: Date.now() });

	/** 常量 secondResponse 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const secondResponse = await complete(model, context, options);

	expect(secondResponse.role).toBe("assistant");
	expect(secondResponse.content).toBeTruthy();
	expect(secondResponse.usage.input + secondResponse.usage.cacheRead).toBeGreaterThan(0);
	expect(secondResponse.usage.output).toBeGreaterThan(0);
	expect(secondResponse.errorMessage).toBeFalsy();
	expect(secondResponse.content.map((b) => (b.type === "text" ? b.text : "")).join("")).toContain(
		"Goodbye test successful",
	);
}

async function handleToolCall<TApi extends Api>(model: Model<TApi>, options?: StreamOptionsWithExtras) {
	/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const context: Context = {
		systemPrompt: "You are a helpful assistant that uses tools when asked.",
		messages: [
			{
				role: "user",
				content: "Calculate 15 + 27 using the math_operation tool.",
				timestamp: Date.now(),
			},
		],
		tools: [calculatorTool],
	};

	/** 常量 s 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const s = await stream(model, context, options);
	/** 变量 hasToolStart 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let hasToolStart = false;
	/** 变量 hasToolDelta 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let hasToolDelta = false;
	/** 变量 hasToolEnd 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let hasToolEnd = false;
	/** 变量 accumulatedToolArgs 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let accumulatedToolArgs = "";
	/** 变量 index 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let index = 0;
	for await (const event of s) {
		if (event.type === "toolcall_start") {
			hasToolStart = true;
			/** 常量 toolCall 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const toolCall = event.partial.content[event.contentIndex];
			index = event.contentIndex;
			expect(toolCall.type).toBe("toolCall");
			if (toolCall.type === "toolCall") {
				expect(toolCall.name).toBe("math_operation");
				expect(toolCall.id).toBeTruthy();
			}
		}
		if (event.type === "toolcall_delta") {
			hasToolDelta = true;
			/** 常量 toolCall 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const toolCall = event.partial.content[event.contentIndex];
			expect(event.contentIndex).toBe(index);
			expect(toolCall.type).toBe("toolCall");
			if (toolCall.type === "toolCall") {
				expect(toolCall.name).toBe("math_operation");
				accumulatedToolArgs += event.delta;
				// Check that we have a parsed arguments object during streaming
				// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
				expect(toolCall.arguments).toBeDefined();
				expect(typeof toolCall.arguments).toBe("object");
				// The arguments should be partially populated as we stream
				// At minimum it should be an empty object, never undefined
				// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
				expect(toolCall.arguments).not.toBeNull();
			}
		}
		if (event.type === "toolcall_end") {
			hasToolEnd = true;
			/** 常量 toolCall 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const toolCall = event.partial.content[event.contentIndex];
			expect(event.contentIndex).toBe(index);
			expect(toolCall.type).toBe("toolCall");
			if (toolCall.type === "toolCall") {
				expect(toolCall.name).toBe("math_operation");
				JSON.parse(accumulatedToolArgs);
				expect(toolCall.arguments).not.toBeUndefined();
				expect((toolCall.arguments as any).a).toBe(15);
				expect((toolCall.arguments as any).b).toBe(27);
				expect((toolCall.arguments as any).operation).oneOf(["add", "subtract", "multiply", "divide"]);
			}
		}
	}

	expect(hasToolStart).toBe(true);
	expect(hasToolDelta).toBe(true);
	expect(hasToolEnd).toBe(true);

	/** 常量 response 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const response = await s.result();
	expect(response.stopReason).toBe("toolUse");
	expect(response.content.some((b) => b.type === "toolCall")).toBeTruthy();
	/** 常量 toolCall 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const toolCall = response.content.find((b) => b.type === "toolCall");
	if (toolCall && toolCall.type === "toolCall") {
		expect(toolCall.name).toBe("math_operation");
		expect(toolCall.id).toBeTruthy();
	} else {
		throw new Error("No tool call found in response");
	}
}

async function handleStreaming<TApi extends Api>(model: Model<TApi>, options?: StreamOptionsWithExtras) {
	/** 变量 textStarted 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let textStarted = false;
	/** 变量 textChunks 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let textChunks = "";
	/** 变量 textCompleted 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let textCompleted = false;

	/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const context: Context = {
		messages: [{ role: "user", content: "Count from 1 to 3", timestamp: Date.now() }],
		systemPrompt: "You are a helpful assistant.",
	};

	/** 常量 s 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const s = stream(model, context, options);

	for await (const event of s) {
		if (event.type === "text_start") {
			textStarted = true;
		} else if (event.type === "text_delta") {
			textChunks += event.delta;
		} else if (event.type === "text_end") {
			textCompleted = true;
		}
	}

	/** 常量 response 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const response = await s.result();

	expect(textStarted).toBe(true);
	expect(textChunks.length).toBeGreaterThan(0);
	expect(textCompleted).toBe(true);
	expect(response.content.some((b) => b.type === "text")).toBeTruthy();
}

async function handleThinking<TApi extends Api>(model: Model<TApi>, options?: StreamOptionsWithExtras) {
	/** 变量 thinkingStarted 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let thinkingStarted = false;
	/** 变量 thinkingChunks 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let thinkingChunks = "";
	/** 变量 thinkingCompleted 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let thinkingCompleted = false;

	/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const context: Context = {
		messages: [
			{
				role: "user",
				content: `Think long and hard about ${(Math.random() * 255) | 0} + 27. Think step by step. Then output the result.`,
				timestamp: Date.now(),
			},
		],
		systemPrompt: "You are a helpful assistant.",
	};

	/** 常量 s 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const s = stream(model, context, options);

	for await (const event of s) {
		if (event.type === "thinking_start") {
			thinkingStarted = true;
		} else if (event.type === "thinking_delta") {
			thinkingChunks += event.delta;
		} else if (event.type === "thinking_end") {
			thinkingCompleted = true;
		}
	}

	/** 常量 response 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const response = await s.result();

	expect(response.stopReason, `Error: ${response.errorMessage}`).toBe("stop");
	expect(thinkingStarted).toBe(true);
	expect(thinkingChunks.length).toBeGreaterThan(0);
	expect(thinkingCompleted).toBe(true);
	expect(response.content.some((b) => b.type === "thinking")).toBeTruthy();
}

async function handleImage<TApi extends Api>(model: Model<TApi>, options?: StreamOptionsWithExtras) {
	// Check if the model supports images
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
	if (!model.input.includes("image")) {
		console.log(`Skipping image test - model ${model.id} doesn't support images`);
		return;
	}

	// Read the test image
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
	const imagePath = join(__dirname, "data", "red-circle.png");
	/** 常量 imageBuffer 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const imageBuffer = readFileSync(imagePath);
	/** 常量 base64Image 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const base64Image = imageBuffer.toString("base64");

	/** 常量 imageContent 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const imageContent: ImageContent = {
		type: "image",
		data: base64Image,
		mimeType: "image/png",
	};

	/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const context: Context = {
		messages: [
			{
				role: "user",
				content: [
					{
						type: "text",
						text: "What do you see in this image? Please describe the shape (circle, rectangle, square, triangle, ...) and color (red, blue, green, ...). You MUST reply in English.",
					},
					imageContent,
				],
				timestamp: Date.now(),
			},
		],
		systemPrompt: "You are a helpful assistant.",
	};

	/** 常量 response 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const response = await complete(model, context, options);

	// Check the response mentions red and circle
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
	expect(response.content.length > 0).toBeTruthy();
	/** 常量 textContent 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const textContent = response.content.find((b) => b.type === "text");
	if (textContent && textContent.type === "text") {
		/** 常量 lowerContent 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const lowerContent = textContent.text.toLowerCase();
		expect(lowerContent).toContain("red");
		expect(lowerContent).toContain("circle");
	}
}

async function multiTurn<TApi extends Api>(model: Model<TApi>, options?: StreamOptionsWithExtras) {
	/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const context: Context = {
		systemPrompt: "You are a helpful assistant that can use tools to answer questions.",
		messages: [
			{
				role: "user",
				content: "Think about this briefly, then calculate 42 * 17 and 453 + 434 using the math_operation tool.",
				timestamp: Date.now(),
			},
		],
		tools: [calculatorTool],
	};

	// Collect all text content from all assistant responses
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
	let allTextContent = "";
	/** 变量 hasSeenThinking 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let hasSeenThinking = false;
	/** 变量 hasSeenToolCalls 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let hasSeenToolCalls = false;
	/** 常量 maxTurns 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const maxTurns = 5; // Prevent infinite loops

	/** 循环变量 turn 表示当前遍历项或索引，仅在循环体内有效。 */
	for (let turn = 0; turn < maxTurns; turn++) {
		/** 常量 response 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const response = await complete(model, context, options);

		// Add the assistant response to context
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		context.messages.push(response);

		// Process content blocks
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		const results: ToolResultMessage[] = [];
		/** 循环变量 block 表示当前遍历项或索引，仅在循环体内有效。 */
		for (const block of response.content) {
			if (block.type === "text") {
				allTextContent += block.text;
			} else if (block.type === "thinking") {
				hasSeenThinking = true;
			} else if (block.type === "toolCall") {
				hasSeenToolCalls = true;

				// Process the tool call
				// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
				expect(block.name).toBe("math_operation");
				expect(block.id).toBeTruthy();
				expect(block.arguments).toBeTruthy();

				/** 常量 { a, b, operation } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const { a, b, operation } = block.arguments;
				/** 变量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				let result: number;
				switch (operation) {
					case "add":
						result = a + b;
						break;
					case "multiply":
						result = a * b;
						break;
					default:
						result = 0;
				}

				// Add tool result to context
				// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
				results.push({
					role: "toolResult",
					toolCallId: block.id,
					toolName: block.name,
					content: [{ type: "text", text: `${result}` }],
					isError: false,
					timestamp: Date.now(),
				});
			}
		}
		context.messages.push(...results);

		// If we got a stop response with text content, we're likely done
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		expect(response.stopReason, `Error: ${response.errorMessage}`).not.toBe("error");
		if (response.stopReason === "stop") {
			break;
		}
	}

	// Verify we got either thinking content or tool calls (or both)
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
	expect(hasSeenThinking || hasSeenToolCalls).toBe(true);

	// The accumulated text should reference both calculations
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
	expect(allTextContent).toBeTruthy();
	expect(allTextContent.includes("714")).toBe(true);
	expect(allTextContent.includes("887")).toBe(true);
}

// 用例分组：集中验证“Generate E2E Tests”相关功能。
describe("Generate E2E Tests", () => {
	describe.skipIf(!process.env.GEMINI_API_KEY)("Gemini Provider (gemini-2.5-flash)", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("google", "gemini-2.5-flash");

		// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
		it("should complete basic text generation", { retry: 3 }, async () => {
			await basicTextGeneration(llm);
		});

		// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
		it("should handle tool calling", { retry: 3 }, async () => {
			await handleToolCall(llm);
		});

		// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
		it("should handle streaming", { retry: 3 }, async () => {
			await handleStreaming(llm);
		});

		// 测试场景：验证“should handle thinking”对应的行为、结果与边界。
		it("should handle thinking", { retry: 3 }, async () => {
			await handleThinking(llm, { thinking: { enabled: true, budgetTokens: 1024 } });
		});

		// 测试场景：验证“should handle multi-turn with thinking and tools”对应的行为、结果与边界。
		it("should handle multi-turn with thinking and tools", { retry: 3 }, async () => {
			await multiTurn(llm, { thinking: { enabled: true, budgetTokens: 2048 } });
		});

		// 测试场景：验证“should handle image input”对应的行为、结果与边界。
		it("should handle image input", { retry: 3 }, async () => {
			await handleImage(llm);
		});
	});

	// 用例分组：集中验证“Google Vertex Provider (gemini-3-flash-preview)”相关功能。
	describe("Google Vertex Provider (gemini-3-flash-preview)", () => {
		/** 常量 vertexProject 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const vertexProject = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
		/** 常量 vertexLocation 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const vertexLocation = process.env.GOOGLE_CLOUD_LOCATION;
		/** 常量 vertexApiKey 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const vertexApiKey = process.env.GOOGLE_CLOUD_API_KEY;
		/** 常量 isVertexConfigured 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const isVertexConfigured = Boolean(vertexProject && vertexLocation);
		/** 常量 vertexOptions 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const vertexOptions = { project: vertexProject, location: vertexLocation } as const;
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("google-vertex", "gemini-3-flash-preview");

		it.skipIf(!isVertexConfigured)("should complete basic text generation", { retry: 3 }, async () => {
			await basicTextGeneration(llm, vertexOptions);
		});

		it.skipIf(!vertexApiKey)("should complete basic text generation with Vertex API key", { retry: 3 }, async () => {
			await basicTextGeneration(llm, { apiKey: vertexApiKey! });
		});

		it.skipIf(!isVertexConfigured)("should handle tool calling", { retry: 3 }, async () => {
			await handleToolCall(llm, vertexOptions);
		});

		it.skipIf(!isVertexConfigured)("should handle thinking", { retry: 3 }, async () => {
			/** 常量 { ThinkingLevel } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const { ThinkingLevel } = await import("@google/genai");
			await handleThinking(llm, {
				...vertexOptions,
				thinking: { enabled: true, budgetTokens: 1024, level: ThinkingLevel.LOW },
			});
		});

		it.skipIf(!isVertexConfigured)("should handle streaming", { retry: 3 }, async () => {
			await handleStreaming(llm, vertexOptions);
		});

		it.skipIf(!isVertexConfigured)("should handle multi-turn with thinking and tools", { retry: 3 }, async () => {
			/** 常量 { ThinkingLevel } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const { ThinkingLevel } = await import("@google/genai");
			await multiTurn(llm, {
				...vertexOptions,
				thinking: { enabled: true, budgetTokens: 1024, level: ThinkingLevel.MEDIUM },
			});
		});

		it.skipIf(!isVertexConfigured)("should handle image input", { retry: 3 }, async () => {
			await handleImage(llm, vertexOptions);
		});
	});

	describe.skipIf(!process.env.OPENAI_API_KEY)("OpenAI Completions Provider (gpt-4o-mini)", () => {
		/** 常量 { compat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini");
		void _compat;
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm: Model<"openai-completions"> = {
			...baseModel,
			api: "openai-completions",
		};

		// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
		it("should complete basic text generation", { retry: 3 }, async () => {
			await basicTextGeneration(llm);
		});

		// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
		it("should handle tool calling", { retry: 3 }, async () => {
			await handleToolCall(llm);
		});

		// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
		it("should handle streaming", { retry: 3 }, async () => {
			await handleStreaming(llm);
		});

		// 测试场景：验证“should handle image input”对应的行为、结果与边界。
		it("should handle image input", { retry: 3 }, async () => {
			await handleImage(llm);
		});
	});

	describe.skipIf(!process.env.DEEPSEEK_API_KEY)(
		"DeepSeek Provider (deepseek-v4-flash via OpenAI Completions)",
		() => {
			/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const llm = getModel("deepseek", "deepseek-v4-flash");

			// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
			it("should complete basic text generation", { retry: 3 }, async () => {
				await basicTextGeneration(llm);
			});

			// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
			it("should handle tool calling", { retry: 3 }, async () => {
				await handleToolCall(llm);
			});

			// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
			it("should handle streaming", { retry: 3 }, async () => {
				await handleStreaming(llm);
			});

			// 测试场景：验证“should handle thinking mode”对应的行为、结果与边界。
			it("should handle thinking mode", { retry: 3 }, async () => {
				await handleThinking(llm, { reasoningEffort: "high" });
			});

			// 测试场景：验证“should handle multi-turn with thinking and tools”对应的行为、结果与边界。
			it("should handle multi-turn with thinking and tools", { retry: 3 }, async () => {
				await multiTurn(llm, { reasoningEffort: "high" });
			});
		},
	);

	describe.skipIf(!process.env.OPENAI_API_KEY)("OpenAI Responses Provider (gpt-5.4)", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("openai", "gpt-5.4");

		// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
		it("should complete basic text generation", { retry: 3 }, async () => {
			await basicTextGeneration(llm);
		});

		// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
		it("should handle tool calling", { retry: 3 }, async () => {
			await handleToolCall(llm);
		});

		// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
		it("should handle streaming", { retry: 3 }, async () => {
			await handleStreaming(llm);
		});

		// 测试场景：验证“should handle thinking”对应的行为、结果与边界。
		it("should handle thinking", { retry: 2 }, async () => {
			await handleThinking(llm, { reasoningEffort: "high" });
		});

		// 测试场景：验证“should handle multi-turn with thinking and tools”对应的行为、结果与边界。
		it("should handle multi-turn with thinking and tools", { retry: 3 }, async () => {
			await multiTurn(llm, { reasoningEffort: "high" });
		});

		// 测试场景：验证“should handle image input”对应的行为、结果与边界。
		it("should handle image input", { retry: 3 }, async () => {
			await handleImage(llm);
		});
	});

	describe.skipIf(!process.env.ANTHROPIC_API_KEY)("Anthropic Provider (claude-haiku-4-5)", () => {
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = getModel("anthropic", "claude-haiku-4-5");

		// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
		it("should complete basic text generation", { retry: 3 }, async () => {
			await basicTextGeneration(model, { thinkingEnabled: true });
		});

		// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
		it("should handle tool calling", { retry: 3 }, async () => {
			await handleToolCall(model);
		});

		// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
		it("should handle streaming", { retry: 3 }, async () => {
			await handleStreaming(model);
		});

		// 测试场景：验证“should handle image input”对应的行为、结果与边界。
		it("should handle image input", { retry: 3 }, async () => {
			await handleImage(model);
		});
	});

	describe.skipIf(!hasAzureOpenAICredentials())("Azure OpenAI Responses Provider (gpt-4o-mini)", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("azure-openai-responses", "gpt-4o-mini");
		/** 常量 azureDeploymentName 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const azureDeploymentName = resolveAzureDeploymentName(llm.id);
		/** 常量 azureOptions 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const azureOptions = azureDeploymentName ? { azureDeploymentName } : {};

		// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
		it("should complete basic text generation", { retry: 3 }, async () => {
			await basicTextGeneration(llm, azureOptions);
		});

		// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
		it("should handle tool calling", { retry: 3 }, async () => {
			await handleToolCall(llm, azureOptions);
		});

		// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
		it("should handle streaming", { retry: 3 }, async () => {
			await handleStreaming(llm, azureOptions);
		});

		// 测试场景：验证“should handle image input”对应的行为、结果与边界。
		it("should handle image input", { retry: 3 }, async () => {
			await handleImage(llm, azureOptions);
		});
	});

	describe.skipIf(!process.env.XAI_API_KEY)("xAI Provider (grok-4.3 via OpenAI Completions)", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("xai", "grok-4.3");

		// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
		it("should complete basic text generation", { retry: 3 }, async () => {
			await basicTextGeneration(llm);
		});

		// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
		it("should handle tool calling", { retry: 3 }, async () => {
			await handleToolCall(llm);
		});

		// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
		it("should handle streaming", { retry: 3 }, async () => {
			await handleStreaming(llm);
		});

		// 测试场景：验证“should handle thinking mode”对应的行为、结果与边界。
		it("should handle thinking mode", { retry: 3 }, async () => {
			await handleThinking(llm, { reasoningEffort: "medium" });
		});

		// 测试场景：验证“should handle multi-turn with thinking and tools”对应的行为、结果与边界。
		it("should handle multi-turn with thinking and tools", { retry: 3 }, async () => {
			await multiTurn(llm, { reasoningEffort: "medium" });
		});
	});

	describe.skipIf(!process.env.GROQ_API_KEY)("Groq Provider (gpt-oss-20b via OpenAI Completions)", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("groq", "openai/gpt-oss-20b");

		// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
		it("should complete basic text generation", { retry: 3 }, async () => {
			await basicTextGeneration(llm);
		});

		// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
		it("should handle tool calling", { retry: 3 }, async () => {
			await handleToolCall(llm);
		});

		// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
		it("should handle streaming", { retry: 3 }, async () => {
			await handleStreaming(llm);
		});

		// 测试场景：验证“should handle thinking mode”对应的行为、结果与边界。
		it("should handle thinking mode", { retry: 3 }, async () => {
			await handleThinking(llm, { reasoningEffort: "medium" });
		});

		// 测试场景：验证“should handle multi-turn with thinking and tools”对应的行为、结果与边界。
		it("should handle multi-turn with thinking and tools", { retry: 3 }, async () => {
			await multiTurn(llm, { reasoningEffort: "medium" });
		});
	});

	describe.skipIf(!process.env.CEREBRAS_API_KEY)("Cerebras Provider (gpt-oss-120b via OpenAI Completions)", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("cerebras", "gpt-oss-120b");

		// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
		it("should complete basic text generation", { retry: 3 }, async () => {
			await basicTextGeneration(llm);
		});

		// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
		it("should handle tool calling", { retry: 3 }, async () => {
			await handleToolCall(llm);
		});

		// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
		it("should handle streaming", { retry: 3 }, async () => {
			await handleStreaming(llm);
		});

		// 测试场景：验证“should handle thinking mode”对应的行为、结果与边界。
		it("should handle thinking mode", { retry: 3 }, async () => {
			await handleThinking(llm, { reasoningEffort: "medium" });
		});

		// 测试场景：验证“should handle multi-turn with thinking and tools”对应的行为、结果与边界。
		it("should handle multi-turn with thinking and tools", { retry: 3 }, async () => {
			await multiTurn(llm, { reasoningEffort: "medium" });
		});
	});

	describe.skipIf(!hasCloudflareWorkersAICredentials())(
		"Cloudflare Workers AI Provider (Kimi K2.6 via OpenAI Completions)",
		() => {
			/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const llm = getModel("cloudflare-workers-ai", "@cf/moonshotai/kimi-k2.6");

			// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
			it("should complete basic text generation", { retry: 3 }, async () => {
				await basicTextGeneration(llm);
			});

			// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
			it("should handle tool calling", { retry: 3 }, async () => {
				await handleToolCall(llm);
			});

			// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
			it("should handle streaming", { retry: 3 }, async () => {
				await handleStreaming(llm);
			});

			// 测试场景：验证“should handle thinking mode”对应的行为、结果与边界。
			it("should handle thinking mode", { retry: 3 }, async () => {
				await handleThinking(llm, { reasoningEffort: "medium" });
			});

			// 测试场景：验证“should handle multi-turn with thinking and tools”对应的行为、结果与边界。
			it("should handle multi-turn with thinking and tools", { retry: 3 }, async () => {
				await multiTurn(llm, { reasoningEffort: "medium" });
			});
		},
	);

	describe.skipIf(!hasCloudflareAiGatewayCredentials())(
		"Cloudflare AI Gateway → Workers AI (Kimi K2.6 via /compat)",
		() => {
			/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const llm = getModel("cloudflare-ai-gateway", "workers-ai/@cf/moonshotai/kimi-k2.6");

			// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
			it("should complete basic text generation", { retry: 3 }, async () => {
				await basicTextGeneration(llm);
			});

			// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
			it("should handle tool calling", { retry: 3 }, async () => {
				await handleToolCall(llm);
			});

			// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
			it("should handle streaming", { retry: 3 }, async () => {
				await handleStreaming(llm);
			});

			// 测试场景：验证“should handle thinking mode”对应的行为、结果与边界。
			it("should handle thinking mode", { retry: 3 }, async () => {
				await handleThinking(llm, { reasoningEffort: "medium" });
			});

			// 测试场景：验证“should handle multi-turn with thinking and tools”对应的行为、结果与边界。
			it("should handle multi-turn with thinking and tools", { retry: 3 }, async () => {
				await multiTurn(llm, { reasoningEffort: "medium" });
			});
		},
	);

	describe.skipIf(!hasCloudflareAiGatewayCredentials() || !process.env.OPENAI_API_KEY)(
		"Cloudflare AI Gateway → OpenAI BYOK (gpt-5.1 via /openai responses)",
		() => {
			/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const llm = getModel("cloudflare-ai-gateway", "gpt-5.1");
			/** 常量 options 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const options = { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } };
			/** 常量 thinkingOptions 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const thinkingOptions = {
				...options,
				thinkingEnabled: true,
				reasoningEffort: "medium",
			} satisfies StreamOptionsWithExtras;

			// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
			it("should complete basic text generation", { retry: 3 }, async () => {
				await basicTextGeneration(llm, options);
			});

			// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
			it("should handle tool calling", { retry: 3 }, async () => {
				await handleToolCall(llm, options);
			});

			// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
			it("should handle streaming", { retry: 3 }, async () => {
				await handleStreaming(llm, options);
			});

			// 测试场景：验证“should handle thinking mode”对应的行为、结果与边界。
			it("should handle thinking mode", { retry: 3 }, async () => {
				await handleThinking(llm, thinkingOptions);
			});

			// 测试场景：验证“should handle multi-turn with thinking and tools”对应的行为、结果与边界。
			it("should handle multi-turn with thinking and tools", { retry: 3 }, async () => {
				await multiTurn(llm, thinkingOptions);
			});
		},
	);

	describe.skipIf(!hasCloudflareAiGatewayCredentials() || !process.env.ANTHROPIC_API_KEY)(
		"Cloudflare AI Gateway → Anthropic BYOK (claude-sonnet-4-5 via /anthropic messages)",
		() => {
			/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const llm = getModel("cloudflare-ai-gateway", "claude-sonnet-4-5");
			/** 常量 options 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const options = { headers: { Authorization: `Bearer ${process.env.ANTHROPIC_API_KEY}` } };
			/** 常量 thinkingOptions 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const thinkingOptions = {
				...options,
				thinkingEnabled: true,
				reasoningEffort: "high",
			} satisfies StreamOptionsWithExtras;

			// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
			it("should complete basic text generation", { retry: 3 }, async () => {
				await basicTextGeneration(llm, options);
			});

			// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
			it("should handle tool calling", { retry: 3 }, async () => {
				await handleToolCall(llm, options);
			});

			// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
			it("should handle streaming", { retry: 3 }, async () => {
				await handleStreaming(llm, options);
			});

			// 测试场景：验证“should handle thinking mode”对应的行为、结果与边界。
			it("should handle thinking mode", { retry: 3 }, async () => {
				await handleThinking(llm, thinkingOptions);
			});

			// 测试场景：验证“should handle multi-turn with thinking and tools”对应的行为、结果与边界。
			it("should handle multi-turn with thinking and tools", { retry: 3 }, async () => {
				await multiTurn(llm, thinkingOptions);
			});
		},
	);

	describe.skipIf(!process.env.HF_TOKEN)("Hugging Face Provider (Kimi-K2.5 via OpenAI Completions)", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("huggingface", "moonshotai/Kimi-K2.5");

		// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
		it("should complete basic text generation", { retry: 3 }, async () => {
			await basicTextGeneration(llm);
		});

		// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
		it("should handle tool calling", { retry: 3 }, async () => {
			await handleToolCall(llm);
		});

		// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
		it("should handle streaming", { retry: 3 }, async () => {
			await handleStreaming(llm);
		});

		// 测试场景：验证“should handle thinking mode”对应的行为、结果与边界。
		it("should handle thinking mode", { retry: 3 }, async () => {
			await handleThinking(llm, { reasoningEffort: "medium" });
		});

		// 测试场景：验证“should handle multi-turn with thinking and tools”对应的行为、结果与边界。
		it("should handle multi-turn with thinking and tools", { retry: 3 }, async () => {
			await multiTurn(llm, { reasoningEffort: "medium" });
		});
	});

	describe.skipIf(!process.env.TOGETHER_API_KEY)("Together AI Provider (Kimi-K2.6 via OpenAI Completions)", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("together", "moonshotai/Kimi-K2.6");

		// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
		it("should complete basic text generation", { retry: 3 }, async () => {
			await basicTextGeneration(llm);
		});

		// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
		it("should handle tool calling", { retry: 3 }, async () => {
			await handleToolCall(llm);
		});

		// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
		it("should handle streaming", { retry: 3 }, async () => {
			await handleStreaming(llm);
		});

		// 测试场景：验证“should handle thinking mode”对应的行为、结果与边界。
		it("should handle thinking mode", { retry: 3 }, async () => {
			await handleThinking(llm, { reasoningEffort: "high" });
		});

		// 测试场景：验证“should handle multi-turn with thinking and tools”对应的行为、结果与边界。
		it("should handle multi-turn with thinking and tools", { retry: 3 }, async () => {
			await multiTurn(llm, { reasoningEffort: "high" });
		});

		// 测试场景：验证“should handle image input”对应的行为、结果与边界。
		it("should handle image input", { retry: 3 }, async () => {
			await handleImage(llm);
		});
	});

	describe.skipIf(!process.env.NVIDIA_API_KEY)("NVIDIA NIM Provider (Nemotron 3 Super via OpenAI Completions)", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("nvidia", "nvidia/nemotron-3-super-120b-a12b");

		// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
		it("should complete basic text generation", { retry: 3 }, async () => {
			await basicTextGeneration(llm);
		});

		// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
		it("should handle tool calling", { retry: 3 }, async () => {
			await handleToolCall(llm);
		});

		// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
		it("should handle streaming", { retry: 3 }, async () => {
			await handleStreaming(llm);
		});

		// 测试场景：验证“should handle thinking mode”对应的行为、结果与边界。
		it("should handle thinking mode", { retry: 3 }, async () => {
			await handleThinking(llm, { reasoningEffort: "high" });
		});

		// 测试场景：验证“should handle multi-turn with thinking and tools”对应的行为、结果与边界。
		it("should handle multi-turn with thinking and tools", { retry: 3 }, async () => {
			await multiTurn(llm, { reasoningEffort: "high" });
		});
	});

	describe.skipIf(!process.env.OPENROUTER_API_KEY)("OpenRouter Provider (glm-4.5v via OpenAI Completions)", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("openrouter", "z-ai/glm-4.5v");

		// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
		it("should complete basic text generation", { retry: 3 }, async () => {
			await basicTextGeneration(llm);
		});

		// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
		it("should handle tool calling", { retry: 3 }, async () => {
			await handleToolCall(llm);
		});

		// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
		it("should handle streaming", { retry: 3 }, async () => {
			await handleStreaming(llm);
		});

		// 测试场景：验证“should handle thinking mode”对应的行为、结果与边界。
		it("should handle thinking mode", { retry: 3 }, async () => {
			await handleThinking(llm, { reasoningEffort: "medium" });
		});

		// 测试场景：验证“should handle multi-turn with thinking and tools”对应的行为、结果与边界。
		it("should handle multi-turn with thinking and tools", { retry: 2 }, async () => {
			await multiTurn(llm, { reasoningEffort: "medium" });
		});

		// 测试场景：验证“should handle image input”对应的行为、结果与边界。
		it("should handle image input", { retry: 3 }, async () => {
			await handleImage(llm);
		});
	});

	describe.skipIf(!process.env.AI_GATEWAY_API_KEY)(
		"Vercel AI Gateway Provider (google/gemini-2.5-flash via Anthropic Messages)",
		() => {
			/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const llm = getModel("vercel-ai-gateway", "google/gemini-2.5-flash");

			// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
			it("should complete basic text generation", { retry: 3 }, async () => {
				await basicTextGeneration(llm);
			});

			// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
			it("should handle tool calling", { retry: 3 }, async () => {
				await handleToolCall(llm);
			});

			// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
			it("should handle streaming", { retry: 3 }, async () => {
				await handleStreaming(llm);
			});

			// 测试场景：验证“should handle image input”对应的行为、结果与边界。
			it("should handle image input", { retry: 3 }, async () => {
				await handleImage(llm);
			});

			// 测试场景：验证“should handle multi-turn with tools”对应的行为、结果与边界。
			it("should handle multi-turn with tools", { retry: 3 }, async () => {
				await multiTurn(llm);
			});
		},
	);

	describe.skipIf(!process.env.AI_GATEWAY_API_KEY)(
		"Vercel AI Gateway Provider (anthropic/claude-opus-4.5 via Anthropic Messages)",
		() => {
			/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const llm = getModel("vercel-ai-gateway", "anthropic/claude-opus-4.5");

			// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
			it("should complete basic text generation", { retry: 3 }, async () => {
				await basicTextGeneration(llm);
			});

			// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
			it("should handle tool calling", { retry: 3 }, async () => {
				await handleToolCall(llm);
			});

			// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
			it("should handle streaming", { retry: 3 }, async () => {
				await handleStreaming(llm);
			});

			// 测试场景：验证“should handle image input”对应的行为、结果与边界。
			it("should handle image input", { retry: 3 }, async () => {
				await handleImage(llm);
			});

			// 测试场景：验证“should handle multi-turn with tools”对应的行为、结果与边界。
			it("should handle multi-turn with tools", { retry: 3 }, async () => {
				await multiTurn(llm);
			});
		},
	);

	describe.skipIf(!process.env.AI_GATEWAY_API_KEY)(
		"Vercel AI Gateway Provider (openai/gpt-5.1-codex-max via Anthropic Messages)",
		() => {
			/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const llm = getModel("vercel-ai-gateway", "openai/gpt-5.1-codex-max");

			// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
			it("should complete basic text generation", { retry: 3 }, async () => {
				await basicTextGeneration(llm);
			});

			// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
			it("should handle tool calling", { retry: 3 }, async () => {
				await handleToolCall(llm);
			});

			// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
			it("should handle streaming", { retry: 3 }, async () => {
				await handleStreaming(llm);
			});

			// 测试场景：验证“should handle image input”对应的行为、结果与边界。
			it("should handle image input", { retry: 3 }, async () => {
				await handleImage(llm);
			});

			// 测试场景：验证“should handle multi-turn with tools”对应的行为、结果与边界。
			it("should handle multi-turn with tools", { retry: 3 }, async () => {
				await multiTurn(llm);
			});
		},
	);

	describe.skipIf(!process.env.ZAI_API_KEY)("zAI Provider (glm-5.1 via OpenAI Completions)", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("zai", "glm-5.1");

		// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
		it("should complete basic text generation", { retry: 3 }, async () => {
			await basicTextGeneration(llm);
		});

		// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
		it("should handle tool calling", { retry: 3 }, async () => {
			await handleToolCall(llm);
		});

		// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
		it("should handle streaming", { retry: 3 }, async () => {
			await handleStreaming(llm);
		});

		// 测试场景：验证“should handle thinking mode”对应的行为、结果与边界。
		it("should handle thinking mode", { retry: 3 }, async () => {
			await handleThinking(llm, { reasoningEffort: "medium" });
		});

		// 测试场景：验证“should handle multi-turn with thinking and tools”对应的行为、结果与边界。
		it("should handle multi-turn with thinking and tools", { retry: 3 }, async () => {
			await multiTurn(llm, { reasoningEffort: "medium" });
		});

		// 测试场景：验证“should handle image input”对应的行为、结果与边界。
		it("should handle image input", { retry: 3 }, async () => {
			await handleImage(llm);
		});
	});

	describe.skipIf(!process.env.MISTRAL_API_KEY)("Mistral Provider (devstral-medium-latest)", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("mistral", "devstral-medium-latest");

		// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
		it("should complete basic text generation", { retry: 3 }, async () => {
			await basicTextGeneration(llm);
		});

		// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
		it("should handle tool calling", { retry: 3 }, async () => {
			await handleToolCall(llm);
		});

		// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
		it("should handle streaming", { retry: 3 }, async () => {
			await handleStreaming(llm);
		});

		// 测试场景：验证“should handle thinking mode”对应的行为、结果与边界。
		it("should handle thinking mode", { retry: 3 }, async () => {
			/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const llm = getModel("mistral", "magistral-medium-latest");
			await handleThinking(llm, { promptMode: "reasoning" });
		});

		// 测试场景：验证“should handle multi-turn with thinking and tools”对应的行为、结果与边界。
		it("should handle multi-turn with thinking and tools", { retry: 3 }, async () => {
			/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const llm = getModel("mistral", "magistral-medium-latest");
			await multiTurn(llm, { promptMode: "reasoning" });
		});
	});

	describe.skipIf(!process.env.MISTRAL_API_KEY)("Mistral Provider (pixtral-12b with image support)", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("mistral", "pixtral-12b");

		// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
		it("should complete basic text generation", { retry: 3 }, async () => {
			await basicTextGeneration(llm);
		});

		// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
		it("should handle tool calling", { retry: 3 }, async () => {
			await handleToolCall(llm);
		});

		// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
		it("should handle streaming", { retry: 3 }, async () => {
			await handleStreaming(llm);
		});

		// 测试场景：验证“should handle image input”对应的行为、结果与边界。
		it("should handle image input", { retry: 3 }, async () => {
			await handleImage(llm);
		});
	});

	describe.skipIf(!process.env.MINIMAX_API_KEY)("MiniMax Provider (MiniMax-M2.7 via Anthropic Messages)", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("minimax", "MiniMax-M2.7");

		// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
		it("should complete basic text generation", { retry: 3 }, async () => {
			await basicTextGeneration(llm);
		});

		// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
		it("should handle tool calling", { retry: 3 }, async () => {
			await handleToolCall(llm);
		});

		// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
		it("should handle streaming", { retry: 3 }, async () => {
			await handleStreaming(llm);
		});

		// 测试场景：验证“should handle thinking mode”对应的行为、结果与边界。
		it("should handle thinking mode", { retry: 3 }, async () => {
			await handleThinking(llm, { thinkingEnabled: true, thinkingBudgetTokens: 2048 });
		});

		// 测试场景：验证“should handle multi-turn with thinking and tools”对应的行为、结果与边界。
		it("should handle multi-turn with thinking and tools", { retry: 3 }, async () => {
			await multiTurn(llm, { thinkingEnabled: true, thinkingBudgetTokens: 2048 });
		});
	});

	describe.skipIf(!process.env.KIMI_API_KEY)(
		"Kimi For Coding Provider (kimi-for-coding via Anthropic Messages)",
		() => {
			/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const llm = getModel("kimi-coding", "kimi-for-coding");

			// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
			it("should complete basic text generation", { retry: 3 }, async () => {
				await basicTextGeneration(llm);
			});

			// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
			it("should handle tool calling", { retry: 3 }, async () => {
				await handleToolCall(llm);
			});

			// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
			it("should handle streaming", { retry: 3 }, async () => {
				await handleStreaming(llm);
			});

			// 测试场景：验证“should handle thinking mode”对应的行为、结果与边界。
			it("should handle thinking mode", { retry: 3 }, async () => {
				await handleThinking(llm, { thinkingEnabled: true, thinkingBudgetTokens: 2048 });
			});

			// 测试场景：验证“should handle multi-turn with thinking and tools”对应的行为、结果与边界。
			it("should handle multi-turn with thinking and tools", { retry: 3 }, async () => {
				await multiTurn(llm, { thinkingEnabled: true, thinkingBudgetTokens: 2048 });
			});
		},
	);

	describe.skipIf(!process.env.XIAOMI_API_KEY)(
		"Xiaomi MiMo (API billing) Provider (Xiaomi MiMo-V2.5-Pro via Anthropic Messages)",
		() => {
			/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const llm = getModel("xiaomi", "mimo-v2.5-pro");
			/** 常量 thinkingOptions 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const thinkingOptions = {
				thinkingEnabled: true,
				reasoningEffort: "high",
			} satisfies StreamOptionsWithExtras;

			// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
			it("should complete basic text generation", { retry: 3 }, async () => {
				await basicTextGeneration(llm);
			});

			// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
			it("should handle tool calling", { retry: 3 }, async () => {
				await handleToolCall(llm);
			});

			// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
			it("should handle streaming", { retry: 3 }, async () => {
				await handleStreaming(llm);
			});

			// 测试场景：验证“should handle thinking mode”对应的行为、结果与边界。
			it("should handle thinking mode", { retry: 3 }, async () => {
				await handleThinking(llm, thinkingOptions);
			});

			// 测试场景：验证“should handle multi-turn with thinking and tools”对应的行为、结果与边界。
			it("should handle multi-turn with thinking and tools", { retry: 3 }, async () => {
				await multiTurn(llm, thinkingOptions);
			});
		},
	);

	describe.skipIf(!process.env.XIAOMI_TOKEN_PLAN_CN_API_KEY)(
		"Xiaomi MiMo Token Plan Provider (Xiaomi MiMo-V2.5-Pro via Anthropic Messages, CN region)",
		() => {
			/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const llm = getModel("xiaomi-token-plan-cn", "mimo-v2.5-pro");
			/** 常量 thinkingOptions 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const thinkingOptions = {
				thinkingEnabled: true,
				reasoningEffort: "high",
			} satisfies StreamOptionsWithExtras;

			// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
			it("should complete basic text generation", { retry: 3 }, async () => {
				await basicTextGeneration(llm);
			});

			// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
			it("should handle tool calling", { retry: 3 }, async () => {
				await handleToolCall(llm);
			});

			// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
			it("should handle streaming", { retry: 3 }, async () => {
				await handleStreaming(llm);
			});

			// 测试场景：验证“should handle thinking mode”对应的行为、结果与边界。
			it("should handle thinking mode", { retry: 3 }, async () => {
				await handleThinking(llm, thinkingOptions);
			});

			// 测试场景：验证“should handle multi-turn with thinking and tools”对应的行为、结果与边界。
			it("should handle multi-turn with thinking and tools", { retry: 3 }, async () => {
				await multiTurn(llm, thinkingOptions);
			});
		},
	);

	describe.skipIf(!process.env.XIAOMI_TOKEN_PLAN_AMS_API_KEY)(
		"Xiaomi MiMo Token Plan Provider (Xiaomi MiMo-V2.5-Pro via Anthropic Messages, AMS region)",
		() => {
			/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const llm = getModel("xiaomi-token-plan-ams", "mimo-v2.5-pro");
			/** 常量 thinkingOptions 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const thinkingOptions = {
				thinkingEnabled: true,
				reasoningEffort: "high",
			} satisfies StreamOptionsWithExtras;

			// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
			it("should complete basic text generation", { retry: 3 }, async () => {
				await basicTextGeneration(llm);
			});

			// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
			it("should handle tool calling", { retry: 3 }, async () => {
				await handleToolCall(llm);
			});

			// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
			it("should handle streaming", { retry: 3 }, async () => {
				await handleStreaming(llm);
			});

			// 测试场景：验证“should handle thinking mode”对应的行为、结果与边界。
			it("should handle thinking mode", { retry: 3 }, async () => {
				await handleThinking(llm, thinkingOptions);
			});

			// 测试场景：验证“should handle multi-turn with thinking and tools”对应的行为、结果与边界。
			it("should handle multi-turn with thinking and tools", { retry: 3 }, async () => {
				await multiTurn(llm, thinkingOptions);
			});
		},
	);

	describe.skipIf(!process.env.XIAOMI_TOKEN_PLAN_SGP_API_KEY)(
		"Xiaomi MiMo Token Plan Provider (Xiaomi MiMo-V2.5-Pro via Anthropic Messages, SGP region)",
		() => {
			/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const llm = getModel("xiaomi-token-plan-sgp", "mimo-v2.5-pro");
			/** 常量 thinkingOptions 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const thinkingOptions = {
				thinkingEnabled: true,
				reasoningEffort: "high",
			} satisfies StreamOptionsWithExtras;

			// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
			it("should complete basic text generation", { retry: 3 }, async () => {
				await basicTextGeneration(llm);
			});

			// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
			it("should handle tool calling", { retry: 3 }, async () => {
				await handleToolCall(llm);
			});

			// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
			it("should handle streaming", { retry: 3 }, async () => {
				await handleStreaming(llm);
			});

			// 测试场景：验证“should handle thinking mode”对应的行为、结果与边界。
			it("should handle thinking mode", { retry: 3 }, async () => {
				await handleThinking(llm, thinkingOptions);
			});

			// 测试场景：验证“should handle multi-turn with thinking and tools”对应的行为、结果与边界。
			it("should handle multi-turn with thinking and tools", { retry: 3 }, async () => {
				await multiTurn(llm, thinkingOptions);
			});
		},
	);

	describe.skipIf(!process.env.QWEN_TOKEN_PLAN_API_KEY)(
		"Qwen Token Plan Provider (Qwen3.7-Max, international)",
		() => {
			/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const llm = getModel("qwen-token-plan", "qwen3.7-max");
			/** 常量 thinkingOptions 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const thinkingOptions = {
				thinkingEnabled: true,
				reasoningEffort: "high",
			} satisfies StreamOptionsWithExtras;

			// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
			it("should complete basic text generation", { retry: 3 }, async () => {
				await basicTextGeneration(llm);
			});

			// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
			it("should handle tool calling", { retry: 3 }, async () => {
				await handleToolCall(llm);
			});

			// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
			it("should handle streaming", { retry: 3 }, async () => {
				await handleStreaming(llm);
			});

			// 测试场景：验证“should handle thinking mode”对应的行为、结果与边界。
			it("should handle thinking mode", { retry: 3 }, async () => {
				await handleThinking(llm, thinkingOptions);
			});

			// 测试场景：验证“should handle multi-turn with thinking and tools”对应的行为、结果与边界。
			it("should handle multi-turn with thinking and tools", { retry: 3 }, async () => {
				await multiTurn(llm, thinkingOptions);
			});
		},
	);

	describe.skipIf(!process.env.QWEN_TOKEN_PLAN_CN_API_KEY)("Qwen Token Plan Provider (Qwen3.7-Max, CN region)", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("qwen-token-plan-cn", "qwen3.7-max");
		/** 常量 thinkingOptions 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const thinkingOptions = {
			thinkingEnabled: true,
			reasoningEffort: "high",
		} satisfies StreamOptionsWithExtras;

		// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
		it("should complete basic text generation", { retry: 3 }, async () => {
			await basicTextGeneration(llm);
		});

		// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
		it("should handle tool calling", { retry: 3 }, async () => {
			await handleToolCall(llm);
		});

		// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
		it("should handle streaming", { retry: 3 }, async () => {
			await handleStreaming(llm);
		});

		// 测试场景：验证“should handle thinking mode”对应的行为、结果与边界。
		it("should handle thinking mode", { retry: 3 }, async () => {
			await handleThinking(llm, thinkingOptions);
		});

		// 测试场景：验证“should handle multi-turn with thinking and tools”对应的行为、结果与边界。
		it("should handle multi-turn with thinking and tools", { retry: 3 }, async () => {
			await multiTurn(llm, thinkingOptions);
		});
	});

	describe.skipIf(!process.env.ANT_LING_API_KEY)("Ant Ling Provider (Ling 2.6 Flash via OpenAI Completions)", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("ant-ling", "Ling-2.6-flash");

		// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
		it("should complete basic text generation", { retry: 3 }, async () => {
			await basicTextGeneration(llm);
		});

		// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
		it("should handle tool calling", { retry: 3 }, async () => {
			await handleToolCall(llm);
		});

		// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
		it("should handle streaming", { retry: 3 }, async () => {
			await handleStreaming(llm);
		});

		// 测试场景：验证“should handle thinking mode”对应的行为、结果与边界。
		it("should handle thinking mode", { retry: 3 }, async () => {
			/** 常量 ringModel 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const ringModel = getModel("ant-ling", "Ring-2.6-1T");
			await handleThinking(ringModel, { reasoningEffort: "high" });
		});
	});

	// =========================================================================
	// OAuth-based providers (credentials from ~/.pi/agent/oauth.json)
	// Tokens are resolved at module level (see oauthTokens above)
	// =========================================================================
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

	// 用例分组：集中验证“Anthropic OAuth Provider (claude-sonnet-4-6)”相关功能。
	describe("Anthropic OAuth Provider (claude-sonnet-4-6)", () => {
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = getModel("anthropic", "claude-sonnet-4-6");

		it.skipIf(!anthropicOAuthToken)("should complete basic text generation", { retry: 3 }, async () => {
			await basicTextGeneration(model, { apiKey: anthropicOAuthToken });
		});

		it.skipIf(!anthropicOAuthToken)("should handle tool calling", { retry: 3 }, async () => {
			await handleToolCall(model, { apiKey: anthropicOAuthToken });
		});

		it.skipIf(!anthropicOAuthToken)("should handle streaming", { retry: 3 }, async () => {
			await handleStreaming(model, { apiKey: anthropicOAuthToken });
		});

		it.skipIf(!anthropicOAuthToken)("should handle thinking", { retry: 3 }, async () => {
			await handleThinking(model, { apiKey: anthropicOAuthToken, thinkingEnabled: true });
		});

		it.skipIf(!anthropicOAuthToken)("should handle multi-turn with thinking and tools", { retry: 3 }, async () => {
			await multiTurn(model, { apiKey: anthropicOAuthToken, thinkingEnabled: true });
		});

		it.skipIf(!anthropicOAuthToken)("should handle image input", { retry: 3 }, async () => {
			await handleImage(model, { apiKey: anthropicOAuthToken });
		});
	});

	// 用例分组：集中验证“Anthropic OAuth Provider (claude-opus-4-6 with adaptive thinking)”相关功能。
	describe("Anthropic OAuth Provider (claude-opus-4-6 with adaptive thinking)", () => {
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = getModel("anthropic", "claude-opus-4-6");

		it.skipIf(!anthropicOAuthToken)("should complete basic text generation", { retry: 3 }, async () => {
			await basicTextGeneration(model, { apiKey: anthropicOAuthToken });
		});

		it.skipIf(!anthropicOAuthToken)("should handle tool calling", { retry: 3 }, async () => {
			await handleToolCall(model, { apiKey: anthropicOAuthToken });
		});

		it.skipIf(!anthropicOAuthToken)("should handle streaming", { retry: 3 }, async () => {
			await handleStreaming(model, { apiKey: anthropicOAuthToken });
		});

		it.skipIf(!anthropicOAuthToken)("should handle adaptive thinking with effort high", { retry: 3 }, async () => {
			await handleThinking(model, { apiKey: anthropicOAuthToken, thinkingEnabled: true, effort: "high" });
		});

		it.skipIf(!anthropicOAuthToken)("should handle adaptive thinking with effort medium", { retry: 3 }, async () => {
			await handleThinking(model, { apiKey: anthropicOAuthToken, thinkingEnabled: true, effort: "medium" });
		});

		it.skipIf(!anthropicOAuthToken)(
			"should handle multi-turn with adaptive thinking and tools",
			{ retry: 3 },
			async () => {
				await multiTurn(model, { apiKey: anthropicOAuthToken, thinkingEnabled: true, effort: "high" });
			},
		);

		it.skipIf(!anthropicOAuthToken)("should handle image input", { retry: 3 }, async () => {
			await handleImage(model, { apiKey: anthropicOAuthToken });
		});
	});

	// 用例分组：集中验证“GitHub Copilot Provider (gpt-5.3-codex via OpenAI Completions)”相关功能。
	describe("GitHub Copilot Provider (gpt-5.3-codex via OpenAI Completions)", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("github-copilot", "gpt-5.3-codex");

		it.skipIf(!githubCopilotToken)("should complete basic text generation", { retry: 3 }, async () => {
			await basicTextGeneration(llm, { apiKey: githubCopilotToken });
		});

		it.skipIf(!githubCopilotToken)("should handle tool calling", { retry: 3 }, async () => {
			await handleToolCall(llm, { apiKey: githubCopilotToken });
		});

		it.skipIf(!githubCopilotToken)("should handle streaming", { retry: 3 }, async () => {
			await handleStreaming(llm, { apiKey: githubCopilotToken });
		});

		it.skipIf(!githubCopilotToken)("should handle thinking", { retry: 2 }, async () => {
			/** 常量 thinkingModel 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const thinkingModel = getModel("github-copilot", "gpt-5-mini");
			await handleThinking(thinkingModel, { apiKey: githubCopilotToken, reasoningEffort: "high" });
		});

		it.skipIf(!githubCopilotToken)("should handle multi-turn with thinking and tools", { retry: 3 }, async () => {
			/** 常量 thinkingModel 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const thinkingModel = getModel("github-copilot", "gpt-5-mini");
			await multiTurn(thinkingModel, { apiKey: githubCopilotToken, reasoningEffort: "high" });
		});

		it.skipIf(!githubCopilotToken)("should handle image input", { retry: 3 }, async () => {
			await handleImage(llm, { apiKey: githubCopilotToken });
		});
	});

	// 用例分组：集中验证“GitHub Copilot Provider (claude-sonnet-4 via Anthropic Messages)”相关功能。
	describe("GitHub Copilot Provider (claude-sonnet-4 via Anthropic Messages)", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("github-copilot", "claude-sonnet-4.6");

		it.skipIf(!githubCopilotToken)("should complete basic text generation", { retry: 3 }, async () => {
			await basicTextGeneration(llm, { apiKey: githubCopilotToken });
		});

		it.skipIf(!githubCopilotToken)("should handle tool calling", { retry: 3 }, async () => {
			await handleToolCall(llm, { apiKey: githubCopilotToken });
		});

		it.skipIf(!githubCopilotToken)("should handle streaming", { retry: 3 }, async () => {
			await handleStreaming(llm, { apiKey: githubCopilotToken });
		});

		it.skipIf(!githubCopilotToken)("should handle thinking", { retry: 2 }, async () => {
			await handleThinking(llm, { apiKey: githubCopilotToken, thinkingEnabled: true });
		});

		it.skipIf(!githubCopilotToken)("should handle multi-turn with thinking and tools", { retry: 3 }, async () => {
			await multiTurn(llm, { apiKey: githubCopilotToken, thinkingEnabled: true });
		});

		it.skipIf(!githubCopilotToken)("should handle image input", { retry: 3 }, async () => {
			await handleImage(llm, { apiKey: githubCopilotToken });
		});
	});

	// 用例分组：集中验证“OpenAI Codex Provider (gpt-5.4)”相关功能。
	describe("OpenAI Codex Provider (gpt-5.4)", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("openai-codex", "gpt-5.4");

		it.skipIf(!openaiCodexToken)("should complete basic text generation", { retry: 3 }, async () => {
			await basicTextGeneration(llm, { apiKey: openaiCodexToken });
		});

		it.skipIf(!openaiCodexToken)("should handle tool calling", { retry: 3 }, async () => {
			await handleToolCall(llm, { apiKey: openaiCodexToken });
		});

		it.skipIf(!openaiCodexToken)("should handle streaming", { retry: 3 }, async () => {
			await handleStreaming(llm, { apiKey: openaiCodexToken });
		});

		it.skipIf(!openaiCodexToken)("should handle thinking", { retry: 3 }, async () => {
			await handleThinking(llm, { apiKey: openaiCodexToken, reasoningEffort: "high" });
		});

		it.skipIf(!openaiCodexToken)("should handle multi-turn with thinking and tools", { retry: 3 }, async () => {
			await multiTurn(llm, { apiKey: openaiCodexToken });
		});

		it.skipIf(!openaiCodexToken)("should handle image input", { retry: 3 }, async () => {
			await handleImage(llm, { apiKey: openaiCodexToken });
		});
	});

	// 用例分组：集中验证“OpenAI Codex Provider (gpt-5.5)”相关功能。
	describe("OpenAI Codex Provider (gpt-5.5)", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("openai-codex", "gpt-5.5");

		it.skipIf(!openaiCodexToken)("should complete basic text generation", { retry: 3 }, async () => {
			await basicTextGeneration(llm, { apiKey: openaiCodexToken });
		});

		it.skipIf(!openaiCodexToken)("should handle tool calling", { retry: 3 }, async () => {
			await handleToolCall(llm, { apiKey: openaiCodexToken });
		});

		it.skipIf(!openaiCodexToken)("should handle streaming", { retry: 3 }, async () => {
			await handleStreaming(llm, { apiKey: openaiCodexToken });
		});

		it.skipIf(!openaiCodexToken)("should handle thinking with reasoningEffort xhigh", { retry: 3 }, async () => {
			await handleThinking(llm, { apiKey: openaiCodexToken, reasoningEffort: "xhigh" });
		});

		it.skipIf(!openaiCodexToken)("should handle multi-turn with thinking and tools", { retry: 3 }, async () => {
			await multiTurn(llm, { apiKey: openaiCodexToken, reasoningEffort: "xhigh" });
		});

		it.skipIf(!openaiCodexToken)("should handle image input", { retry: 3 }, async () => {
			await handleImage(llm, { apiKey: openaiCodexToken });
		});
	});

	// 用例分组：集中验证“OpenAI Codex Provider (gpt-5.5 via WebSocket)”相关功能。
	describe("OpenAI Codex Provider (gpt-5.5 via WebSocket)", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("openai-codex", "gpt-5.5");
		/** 常量 wsOptions 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const wsOptions = { apiKey: openaiCodexToken, transport: "websocket" as const };

		it.skipIf(!openaiCodexToken)("should complete basic text generation", { retry: 3 }, async () => {
			await basicTextGeneration(llm, wsOptions);
		});

		it.skipIf(!openaiCodexToken)("should handle tool calling", { retry: 3 }, async () => {
			await handleToolCall(llm, wsOptions);
		});

		it.skipIf(!openaiCodexToken)("should handle streaming", { retry: 3 }, async () => {
			await handleStreaming(llm, wsOptions);
		});

		it.skipIf(!openaiCodexToken)("should handle thinking with reasoningEffort xhigh", { retry: 3 }, async () => {
			await handleThinking(llm, { ...wsOptions, reasoningEffort: "xhigh" });
		});

		it.skipIf(!openaiCodexToken)("should handle multi-turn with thinking and tools", { retry: 3 }, async () => {
			await multiTurn(llm, { ...wsOptions, reasoningEffort: "xhigh" });
		});

		it.skipIf(!openaiCodexToken)("should handle image input", { retry: 3 }, async () => {
			await handleImage(llm, wsOptions);
		});
	});

	describe.skipIf(!hasBedrockCredentials())("Amazon Bedrock Provider (claude-sonnet-4-5)", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("amazon-bedrock", "global.anthropic.claude-sonnet-4-5-20250929-v1:0");

		// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
		it("should complete basic text generation", { retry: 3 }, async () => {
			await basicTextGeneration(llm);
		});

		// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
		it("should handle tool calling", { retry: 3 }, async () => {
			await handleToolCall(llm);
		});

		// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
		it("should handle streaming", { retry: 3 }, async () => {
			await handleStreaming(llm);
		});

		// 测试场景：验证“should handle thinking”对应的行为、结果与边界。
		it("should handle thinking", { retry: 3 }, async () => {
			await handleThinking(llm, { reasoning: "medium" });
		});

		// 测试场景：验证“should handle multi-turn with thinking and tools”对应的行为、结果与边界。
		it("should handle multi-turn with thinking and tools", { retry: 3 }, async () => {
			await multiTurn(llm, { reasoning: "high" });
		});

		// 测试场景：验证“should handle image input”对应的行为、结果与边界。
		it("should handle image input", { retry: 3 }, async () => {
			await handleImage(llm);
		});
	});

	describe.skipIf(!hasBedrockCredentials())("Amazon Bedrock Provider (claude-opus-4-6 interleaved thinking)", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("amazon-bedrock", "global.anthropic.claude-opus-4-6-v1");

		// 测试场景：验证“should use adaptive thinking without anthropic_beta”对应的行为、结果与边界。
		it("should use adaptive thinking without anthropic_beta", { retry: 3 }, async () => {
			/** 变量 capturedPayload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			let capturedPayload: unknown;
			/** 常量 response 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const response = await complete(
				llm,
				{
					systemPrompt: "You are a helpful assistant that uses tools when asked.",
					messages: [
						{
							role: "user",
							content: "Think first, then calculate 15 + 27 using the math_operation tool.",
							timestamp: Date.now(),
						},
					],
					tools: [calculatorTool],
				},
				{
					reasoning: "xhigh",
					interleavedThinking: true,
					onPayload: (payload) => {
						capturedPayload = payload;
					},
				},
			);

			expect(response.stopReason, `Error: ${response.errorMessage}`).not.toBe("error");
			expect(capturedPayload).toBeTruthy();

			/** 常量 payload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const payload = capturedPayload as {
				additionalModelRequestFields?: {
					thinking?: { type?: string; display?: string };
					output_config?: { effort?: string };
					anthropic_beta?: string[];
				};
			};

			expect(payload.additionalModelRequestFields?.thinking).toEqual({
				type: "adaptive",
				display: "summarized",
			});
			expect(payload.additionalModelRequestFields?.output_config).toEqual({ effort: "max" });
			expect(payload.additionalModelRequestFields?.anthropic_beta).toBeUndefined();
		});

		// 测试场景：验证“should pass requestMetadata to the SDK payload”对应的行为、结果与边界。
		it("should pass requestMetadata to the SDK payload", { retry: 3 }, async () => {
			/** 常量 llmSonnet 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const llmSonnet = getModel("amazon-bedrock", "global.anthropic.claude-sonnet-4-5-20250929-v1:0");
			/** 变量 capturedPayload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			let capturedPayload: unknown;
			/** 常量 metadata 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const metadata = { app: "pi-test", env: "ci" };
			/** 常量 response 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const response = await complete(
				llmSonnet,
				{
					messages: [
						{
							role: "user",
							content: "Say hi.",
							timestamp: Date.now(),
						},
					],
				},
				{
					requestMetadata: metadata,
					onPayload: (payload) => {
						capturedPayload = payload;
					},
				},
			);

			expect(response.stopReason, `Error: ${response.errorMessage}`).not.toBe("error");
			expect(capturedPayload).toBeTruthy();
			expect((capturedPayload as { requestMetadata?: unknown }).requestMetadata).toEqual(metadata);
		});

		// 测试场景：验证“should omit requestMetadata from payload when not provided”对应的行为、结果与边界。
		it("should omit requestMetadata from payload when not provided", { retry: 3 }, async () => {
			/** 常量 llmSonnet 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const llmSonnet = getModel("amazon-bedrock", "global.anthropic.claude-sonnet-4-5-20250929-v1:0");
			/** 变量 capturedPayload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			let capturedPayload: unknown;
			/** 常量 response 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const response = await complete(
				llmSonnet,
				{
					messages: [
						{
							role: "user",
							content: "Say hi.",
							timestamp: Date.now(),
						},
					],
				},
				{
					onPayload: (payload) => {
						capturedPayload = payload;
					},
				},
			);

			expect(response.stopReason, `Error: ${response.errorMessage}`).not.toBe("error");
			expect(capturedPayload).toBeTruthy();
			expect("requestMetadata" in (capturedPayload as object)).toBe(false);
		});
	});

	// Check if ollama is installed and local LLM tests are enabled
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
	let ollamaInstalled = false;
	if (!process.env.PI_NO_LOCAL_LLM) {
		try {
			execSync("which ollama", { stdio: "ignore" });
			ollamaInstalled = true;
		} catch {
			ollamaInstalled = false;
		}
	}

	describe.skipIf(!ollamaInstalled)("Ollama Provider (gpt-oss-20b via OpenAI Completions)", () => {
		/** 变量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let llm: Model<"openai-completions">;
		/** 变量 ollamaProcess 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let ollamaProcess: ChildProcess | null = null;

		beforeAll(async () => {
			// Check if model is available, if not pull it
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			try {
				execSync("ollama list | grep -q 'gpt-oss:20b'", { stdio: "ignore" });
			} catch {
				console.log("Pulling gpt-oss:20b model for Ollama tests...");
				try {
					execSync("ollama pull gpt-oss:20b", { stdio: "inherit" });
				} catch (_e) {
					console.warn("Failed to pull gpt-oss:20b model, tests will be skipped");
					return;
				}
			}

			// Start ollama server
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			ollamaProcess = spawn("ollama", ["serve"], {
				detached: false,
				stdio: "ignore",
			});

			// Wait for server to be ready
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			await new Promise<void>((resolve) => {
				/** checkServer 封装当前回调或辅助步骤；参数 无 提供输入，返回值用于后续流程。示例：checkServer()。 */
				const checkServer = async () => {
					try {
						/** 常量 response 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
						const response = await fetch("http://localhost:11434/api/tags");
						if (response.ok) {
							resolve();
						} else {
							setTimeout(checkServer, 500);
						}
					} catch {
						setTimeout(checkServer, 500);
					}
				};
				setTimeout(checkServer, 1000); // Initial delay
			});

			llm = {
				id: "gpt-oss:20b",
				api: "openai-completions",
				provider: "ollama",
				baseUrl: "http://localhost:11434/v1",
				reasoning: true,
				input: ["text"],
				contextWindow: 128000,
				maxTokens: 16000,
				cost: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
				},
				name: "Ollama GPT-OSS 20B",
			};
		}, 30000); // 30 second timeout for setup

		afterAll(() => {
			// Kill ollama server
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			if (ollamaProcess) {
				ollamaProcess.kill("SIGTERM");
				ollamaProcess = null;
			}
		});

		// 测试场景：验证“should complete basic text generation”对应的行为、结果与边界。
		it("should complete basic text generation", { retry: 3 }, async () => {
			await basicTextGeneration(llm, { apiKey: "test" });
		});

		// 测试场景：验证“should handle tool calling”对应的行为、结果与边界。
		it("should handle tool calling", { retry: 3 }, async () => {
			await handleToolCall(llm, { apiKey: "test" });
		});

		// 测试场景：验证“should handle streaming”对应的行为、结果与边界。
		it("should handle streaming", { retry: 3 }, async () => {
			await handleStreaming(llm, { apiKey: "test" });
		});

		// 测试场景：验证“should handle thinking mode”对应的行为、结果与边界。
		it("should handle thinking mode", { retry: 3 }, async () => {
			await handleThinking(llm, { apiKey: "test", reasoningEffort: "medium" });
		});

		// 测试场景：验证“should handle multi-turn with thinking and tools”对应的行为、结果与边界。
		it("should handle multi-turn with thinking and tools", { retry: 3 }, async () => {
			await multiTurn(llm, { apiKey: "test", reasoningEffort: "medium" });
		});
	});
});
