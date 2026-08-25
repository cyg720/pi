/**
 * 文件职责：跨提供商验证上下文中缺少对应结果的孤立工具调用会被安全过滤，后续用户请求仍能成功。
 * 技术维度：使用 Vitest 条件跳过、共享泛型测试函数、TypeBox 工具定义以及 API Key/OAuth 两类凭据矩阵。
 * 产品维度：保障用户取消工具或切换问题后不会因历史工具调用不完整而导致整个对话报错。
 * 逻辑维度：先构造 calculate 工具与共享两步对话，再为每个可用提供商选择模型和专属选项执行契约。
 * 关键边界：用例调用真实模型且最多重试三次；第一轮必须产生工具调用；第二轮允许直接文本或新的工具调用。
 * 新手阅读建议：先完整阅读 testToolCallWithoutResult 的五个步骤，再浏览提供商矩阵，重点比较 Azure、OAuth 和推理选项。
 */
import { Type } from "typebox";
import { describe, expect, it } from "vitest";
import { complete, getModel } from "../src/compat.ts";
import type { Api, Context, Model, StreamOptions, Tool } from "../src/types.ts";

/** 在标准流选项上允许提供商专属字段。 */
type StreamOptionsWithExtras = StreamOptions & Record<string, unknown>;

import { hasAzureOpenAICredentials, resolveAzureDeploymentName } from "./azure-utils.ts";
import { hasBedrockCredentials } from "./bedrock-utils.ts";
import { hasCloudflareAiGatewayCredentials, hasCloudflareWorkersAICredentials } from "./cloudflare-utils.ts";
import { resolveApiKey } from "./oauth.ts";

// Resolve OAuth tokens at module level (async, runs before tests)
// 模块加载时解析 OAuth 凭据，以便测试注册阶段决定跳过状态。
/** 三个 OAuth 提供商并行解析得到的令牌数组。 */
const oauthTokens = await Promise.all([
	resolveApiKey("anthropic"),
	resolveApiKey("github-copilot"),
	resolveApiKey("openai-codex"),
]);
/** 按固定顺序解构出的 Anthropic、Copilot 和 Codex 令牌。 */
const [anthropicOAuthToken, githubCopilotToken, openaiCodexToken] = oauthTokens;

// Simple calculate tool
// 用于要求模型产生确定性工具调用的简单计算工具。
/** calculate 工具的参数结构，只接受表达式字符串。 */
const calculateSchema = Type.Object({
	expression: Type.String({ description: "The mathematical expression to evaluate" }),
});

/** 仅定义协议、不实际执行的 calculate 工具。 */
const calculateTool: Tool = {
	name: "calculate",
	description: "Evaluate mathematical expressions",
	parameters: calculateSchema,
};

/** 执行“工具调用后缺少结果，再发送新问题”的共享契约。返回完成 Promise。示例：await testToolCallWithoutResult(model)。 */
async function testToolCallWithoutResult<TApi extends Api>(model: Model<TApi>, options: StreamOptionsWithExtras = {}) {
	// Step 1: Create context with the calculate tool
	// 步骤 1：创建包含 calculate 工具的空对话上下文。
	/** 两次模型请求之间复用的上下文。 */
	const context: Context = {
		systemPrompt: "You are a helpful assistant. Use the calculate tool when asked to perform calculations.",
		messages: [],
		tools: [calculateTool],
	};

	// Step 2: Ask the LLM to make a tool call
	// 步骤 2：要求模型明确调用 calculate 工具。
	context.messages.push({
		role: "user",
		content: "Please calculate 25 * 18 using the calculate tool.",
		timestamp: Date.now(),
	});

	// Step 3: Get the assistant's response (should contain a tool call)
	// 步骤 3：获取应包含工具调用的首个助手响应。
	/** 包含预期 calculate 工具调用的首轮响应。 */
	const firstResponse = await complete(model, context, options);
	context.messages.push(firstResponse);

	console.log("First response:", JSON.stringify(firstResponse, null, 2));

	// Verify the response contains a tool call
	// 检查首轮响应确实包含工具调用。
	/** 首轮响应是否至少包含一个 toolCall 内容块。 */
	const hasToolCall = firstResponse.content.some((block) => block.type === "toolCall");
	expect(hasToolCall).toBe(true);

	if (!hasToolCall) {
		throw new Error("Expected assistant to make a tool call, but none was found");
	}

	// Step 4: Send a user message WITHOUT providing tool result
	// 步骤 4：不提供工具结果，直接追加新的用户问题。
	// This simulates the scenario where a tool call was aborted/cancelled
	// 该结构模拟工具调用被用户中止或取消的真实场景。
	context.messages.push({
		role: "user",
		content: "Never mind, just tell me what is 2+2?",
		timestamp: Date.now(),
	});

	// Step 5: The fix should filter out the orphaned tool call, and the request should succeed
	// 步骤 5：实现应过滤孤立工具调用，使新请求成功。
	/** 过滤孤立调用后得到的第二轮响应。 */
	const secondResponse = await complete(model, context, options);
	console.log("Second response:", JSON.stringify(secondResponse, null, 2));

	// The request should succeed (not error) - that's the main thing we're testing
	// 核心断言是第二轮请求不能以 error 结束。
	expect(secondResponse.stopReason).not.toBe("error");

	// Should have some content in the response
	// 第二轮响应还应包含至少一个内容块。
	expect(secondResponse.content.length).toBeGreaterThan(0);

	// The LLM may choose to answer directly or make a new tool call - either is fine
	// 模型可以直接回答，也可以发起新的工具调用，两者都有效。
	// The important thing is it didn't fail with the orphaned tool call error
	// 关键是不能因之前的孤立工具调用而失败。
	/** 第二轮响应中所有文本块拼接出的文本。 */
	const textContent = secondResponse.content
		.filter((block) => block.type === "text")
		.map((block) => (block.type === "text" ? block.text : ""))
		.join(" ");
	/** 第二轮响应中新工具调用的数量。 */
	const toolCalls = secondResponse.content.filter((block) => block.type === "toolCall").length;
	expect(toolCalls || textContent.length).toBeGreaterThan(0);
	console.log("Answer:", textContent);

	// Verify the stop reason is either "stop" or "toolUse" (new tool call)
	// 停止原因只允许正常结束或发起新工具调用。
	expect(["stop", "toolUse"]).toContain(secondResponse.stopReason);
}

describe("Tool Call Without Result Tests", () => {
	// =========================================================================
	// 以下是使用环境变量 API Key 的提供商矩阵。
	// API Key-based providers
	// 使用 API Key 的提供商。
	// =========================================================================

	describe.skipIf(!process.env.GEMINI_API_KEY)("Google Provider", () => {
		/** Google 契约使用的 Gemini 模型。 */
		const model = getModel("google", "gemini-2.5-flash");

		it("should filter out tool calls without corresponding tool results", { retry: 3, timeout: 30000 }, async () => {
			await testToolCallWithoutResult(model);
		});
	});

	describe.skipIf(!process.env.OPENAI_API_KEY)("OpenAI Completions Provider", () => {
		/** 去除 compat 元数据后的 OpenAI 基础模型。 */
		const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini")!;
		void _compat;
		/** 强制使用 Completions API 的模型定义。 */
		const model: Model<"openai-completions"> = {
			...baseModel,
			api: "openai-completions",
		};

		it("should filter out tool calls without corresponding tool results", { retry: 3, timeout: 30000 }, async () => {
			await testToolCallWithoutResult(model);
		});
	});

	describe.skipIf(!process.env.OPENAI_API_KEY)("OpenAI Responses Provider", () => {
		/** OpenAI Responses 契约使用的模型。 */
		const model = getModel("openai", "gpt-5-mini");

		it("should filter out tool calls without corresponding tool results", { retry: 3, timeout: 30000 }, async () => {
			await testToolCallWithoutResult(model);
		});
	});

	describe.skipIf(!hasAzureOpenAICredentials())("Azure OpenAI Responses Provider", () => {
		/** Azure Responses 契约使用的模型。 */
		const model = getModel("azure-openai-responses", "gpt-4o-mini");
		/** 从模型 ID 解析的 Azure 部署名。 */
		const azureDeploymentName = resolveAzureDeploymentName(model.id);
		/** 有部署名时传递的 Azure 专属选项。 */
		const azureOptions = azureDeploymentName ? { azureDeploymentName } : {};

		it("should filter out tool calls without corresponding tool results", { retry: 3, timeout: 30000 }, async () => {
			await testToolCallWithoutResult(model, azureOptions);
		});
	});

	describe.skipIf(!process.env.ANTHROPIC_API_KEY)("Anthropic Provider", () => {
		/** Anthropic 契约使用的 Claude 模型。 */
		const model = getModel("anthropic", "claude-haiku-4-5");

		it("should filter out tool calls without corresponding tool results", { retry: 3, timeout: 30000 }, async () => {
			await testToolCallWithoutResult(model);
		});
	});

	describe.skipIf(!process.env.XAI_API_KEY)("xAI Provider", () => {
		/** xAI 契约使用的 Grok 模型。 */
		const model = getModel("xai", "grok-4.3");

		it("should filter out tool calls without corresponding tool results", { retry: 3, timeout: 30000 }, async () => {
			await testToolCallWithoutResult(model);
		});
	});

	describe.skipIf(!process.env.GROQ_API_KEY)("Groq Provider", () => {
		/** Groq 契约使用的模型。 */
		const model = getModel("groq", "openai/gpt-oss-20b");

		it("should filter out tool calls without corresponding tool results", { retry: 3, timeout: 30000 }, async () => {
			await testToolCallWithoutResult(model);
		});
	});

	describe.skipIf(!process.env.CEREBRAS_API_KEY)("Cerebras Provider", () => {
		/** Cerebras 契约使用的模型。 */
		const model = getModel("cerebras", "gpt-oss-120b");

		it("should filter out tool calls without corresponding tool results", { retry: 3, timeout: 30000 }, async () => {
			await testToolCallWithoutResult(model);
		});
	});

	describe.skipIf(!hasCloudflareWorkersAICredentials())("Cloudflare Workers AI Provider", () => {
		/** Cloudflare Workers AI 契约使用的模型。 */
		const model = getModel("cloudflare-workers-ai", "@cf/moonshotai/kimi-k2.6");

		it("should filter out tool calls without corresponding tool results", { retry: 3, timeout: 30000 }, async () => {
			await testToolCallWithoutResult(model);
		});
	});

	describe.skipIf(!hasCloudflareAiGatewayCredentials())("Cloudflare AI Gateway Provider", () => {
		/** Cloudflare AI Gateway 契约使用的模型。 */
		const model = getModel("cloudflare-ai-gateway", "workers-ai/@cf/moonshotai/kimi-k2.6");

		it("should filter out tool calls without corresponding tool results", { retry: 3, timeout: 30000 }, async () => {
			await testToolCallWithoutResult(model);
		});
	});

	describe.skipIf(!process.env.HF_TOKEN)("Hugging Face Provider", () => {
		/** Hugging Face 契约使用的模型。 */
		const model = getModel("huggingface", "moonshotai/Kimi-K2.5");

		it("should filter out tool calls without corresponding tool results", { retry: 3, timeout: 30000 }, async () => {
			await testToolCallWithoutResult(model);
		});
	});

	describe.skipIf(!process.env.TOGETHER_API_KEY)("Together AI Provider", () => {
		/** Together AI 契约使用的模型。 */
		const model = getModel("together", "moonshotai/Kimi-K2.6");

		it("should filter out tool calls without corresponding tool results", { retry: 3, timeout: 30000 }, async () => {
			await testToolCallWithoutResult(model, { reasoningEffort: "high" });
		});
	});

	describe.skipIf(!process.env.ZAI_API_KEY)("zAI Provider", () => {
		/** zAI 契约使用的 GLM 模型。 */
		const model = getModel("zai", "glm-4.5-air");

		it("should filter out tool calls without corresponding tool results", { retry: 3, timeout: 30000 }, async () => {
			await testToolCallWithoutResult(model);
		});
	});

	describe.skipIf(!process.env.MISTRAL_API_KEY)("Mistral Provider", () => {
		/** Mistral 契约使用的模型。 */
		const model = getModel("mistral", "devstral-medium-latest");

		it("should filter out tool calls without corresponding tool results", { retry: 3, timeout: 30000 }, async () => {
			await testToolCallWithoutResult(model);
		});
	});

	describe.skipIf(!process.env.MINIMAX_API_KEY)("MiniMax Provider", () => {
		/** MiniMax 契约使用的模型。 */
		const model = getModel("minimax", "MiniMax-M2.7");

		it("should filter out tool calls without corresponding tool results", { retry: 3, timeout: 30000 }, async () => {
			await testToolCallWithoutResult(model);
		});
	});

	describe.skipIf(!process.env.XIAOMI_API_KEY)("Xiaomi MiMo (API billing) Provider", () => {
		/** 小米按量计费端点使用的模型。 */
		const model = getModel("xiaomi", "mimo-v2.5-pro");

		it("should filter out tool calls without corresponding tool results", { retry: 3, timeout: 30000 }, async () => {
			await testToolCallWithoutResult(model);
		});
	});

	describe.skipIf(!process.env.XIAOMI_TOKEN_PLAN_CN_API_KEY)("Xiaomi MiMo Token Plan (CN) Provider", () => {
		/** 小米中国区 Token 套餐端点使用的模型。 */
		const model = getModel("xiaomi-token-plan-cn", "mimo-v2.5-pro");

		it("should filter out tool calls without corresponding tool results", { retry: 3, timeout: 30000 }, async () => {
			await testToolCallWithoutResult(model);
		});
	});

	describe.skipIf(!process.env.XIAOMI_TOKEN_PLAN_AMS_API_KEY)("Xiaomi MiMo Token Plan (AMS) Provider", () => {
		/** 小米阿姆斯特丹 Token 套餐端点使用的模型。 */
		const model = getModel("xiaomi-token-plan-ams", "mimo-v2.5-pro");

		it("should filter out tool calls without corresponding tool results", { retry: 3, timeout: 30000 }, async () => {
			await testToolCallWithoutResult(model);
		});
	});

	describe.skipIf(!process.env.XIAOMI_TOKEN_PLAN_SGP_API_KEY)("Xiaomi MiMo Token Plan (SGP) Provider", () => {
		/** 小米新加坡 Token 套餐端点使用的模型。 */
		const model = getModel("xiaomi-token-plan-sgp", "mimo-v2.5-pro");

		it("should filter out tool calls without corresponding tool results", { retry: 3, timeout: 30000 }, async () => {
			await testToolCallWithoutResult(model);
		});
	});

	describe.skipIf(!process.env.QWEN_TOKEN_PLAN_API_KEY)("Qwen Token Plan Provider", () => {
		/** Qwen 国际 Token 套餐端点使用的模型。 */
		const model = getModel("qwen-token-plan", "qwen3.7-max");

		it("should filter out tool calls without corresponding tool results", { retry: 3, timeout: 30000 }, async () => {
			await testToolCallWithoutResult(model);
		});
	});

	describe.skipIf(!process.env.QWEN_TOKEN_PLAN_CN_API_KEY)("Qwen Token Plan (CN) Provider", () => {
		/** Qwen 中国区 Token 套餐端点使用的模型。 */
		const model = getModel("qwen-token-plan-cn", "qwen3.7-max");

		it("should filter out tool calls without corresponding tool results", { retry: 3, timeout: 30000 }, async () => {
			await testToolCallWithoutResult(model);
		});
	});

	describe.skipIf(!process.env.KIMI_API_KEY)("Kimi For Coding Provider", () => {
		/** Kimi Coding 契约使用的模型。 */
		const model = getModel("kimi-coding", "kimi-for-coding");

		it("should filter out tool calls without corresponding tool results", { retry: 3, timeout: 30000 }, async () => {
			await testToolCallWithoutResult(model);
		});
	});

	describe.skipIf(!process.env.AI_GATEWAY_API_KEY)("Vercel AI Gateway Provider", () => {
		/** Vercel AI Gateway 契约使用的路由模型。 */
		const model = getModel("vercel-ai-gateway", "google/gemini-2.5-flash");

		it("should filter out tool calls without corresponding tool results", { retry: 3, timeout: 30000 }, async () => {
			await testToolCallWithoutResult(model);
		});
	});

	describe.skipIf(!hasBedrockCredentials())("Amazon Bedrock Provider", () => {
		/** Amazon Bedrock 契约使用的 Claude 模型。 */
		const model = getModel("amazon-bedrock", "global.anthropic.claude-sonnet-4-5-20250929-v1:0");

		it("should filter out tool calls without corresponding tool results", { retry: 3, timeout: 30000 }, async () => {
			await testToolCallWithoutResult(model);
		});
	});

	// =========================================================================
	// 以下是从本地 OAuth 存储读取凭据的提供商矩阵。
	// OAuth-based providers (credentials from ~/.pi/agent/oauth.json)
	// OAuth 凭据来自 ~/.pi/agent/oauth.json。
	// =========================================================================

	describe("Anthropic OAuth Provider", () => {
		/** Anthropic OAuth 契约使用的 Claude 模型。 */
		const model = getModel("anthropic", "claude-haiku-4-5");

		it.skipIf(!anthropicOAuthToken)(
			"should filter out tool calls without corresponding tool results",
			{ retry: 3, timeout: 30000 },
			async () => {
				await testToolCallWithoutResult(model, { apiKey: anthropicOAuthToken });
			},
		);
	});

	describe("GitHub Copilot Provider", () => {
		it.skipIf(!githubCopilotToken)(
			"claude-haiku-4.5 - should filter out tool calls without corresponding tool results",
			{ retry: 3, timeout: 30000 },
			async () => {
				/** GitHub Copilot Haiku 契约使用的模型。 */
				const model = getModel("github-copilot", "claude-haiku-4.5");
				await testToolCallWithoutResult(model, { apiKey: githubCopilotToken });
			},
		);

		it.skipIf(!githubCopilotToken)(
			"claude-sonnet-4 - should filter out tool calls without corresponding tool results",
			{ retry: 3, timeout: 30000 },
			async () => {
				/** GitHub Copilot Sonnet 契约使用的模型。 */
				const model = getModel("github-copilot", "claude-sonnet-4.6");
				await testToolCallWithoutResult(model, { apiKey: githubCopilotToken });
			},
		);
	});

	describe("OpenAI Codex Provider", () => {
		it.skipIf(!openaiCodexToken)(
			"gpt-5.5 - should filter out tool calls without corresponding tool results",
			{ retry: 3, timeout: 30000 },
			async () => {
				/** OpenAI Codex OAuth 契约使用的模型。 */
				const model = getModel("openai-codex", "gpt-5.5");
				await testToolCallWithoutResult(model, { apiKey: openaiCodexToken });
			},
		);
	});
});
/**
 * 文件职责：跨提供商验证上下文中缺少对应结果的孤立工具调用会被安全过滤，后续用户请求仍能成功。
 * 技术维度：使用 Vitest 条件跳过、共享泛型测试函数、TypeBox 工具定义以及 API Key/OAuth 两类凭据矩阵。
 * 产品维度：保障用户取消工具或切换问题后不会因历史工具调用不完整而导致整个对话报错。
 * 逻辑维度：先构造 calculate 工具与共享两步对话，再为每个可用提供商选择模型和专属选项执行契约。
 * 关键边界：用例调用真实模型且最多重试三次；第一轮必须产生工具调用；第二轮允许直接文本或新的工具调用。
 * 新手阅读建议：先完整阅读 testToolCallWithoutResult 的五个步骤，再浏览提供商矩阵，重点比较 Azure、OAuth 和推理选项。
 */
