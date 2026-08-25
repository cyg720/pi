/**
 * 文件职责：跨模型提供商验证空数组、空字符串、纯空白和空助手消息的兼容处理。
 * 技术维度：使用 Vitest 调用统一 complete 接口，并依据环境凭据跳过不可运行的在线集成测试。
 * 产品维度：避免空消息导致请求崩溃，使不同提供商至少返回规范助手响应或明确错误。
 * 逻辑维度：四个辅助函数构造不同空消息，随后为各云端与 OAuth 提供商重复执行同一断言集。
 * 关键边界：大多数用例需要真实密钥和网络；允许提供商选择成功处理或返回 error，不能据此比较内容质量。
 * 新手阅读建议：先读四个 testEmpty 辅助函数，再选一个 API Key 提供商分组，最后看 OAuth 分组。
 */
import { describe, expect, it } from "vitest";
import { complete, getModel } from "../src/compat.ts";
import type { Api, AssistantMessage, Context, Model, StreamOptions, UserMessage } from "../src/types.ts";

type StreamOptionsWithExtras = StreamOptions & Record<string, unknown>;

import { hasAzureOpenAICredentials, resolveAzureDeploymentName } from "./azure-utils.ts";
import { hasBedrockCredentials } from "./bedrock-utils.ts";
import { hasCloudflareAiGatewayCredentials, hasCloudflareWorkersAICredentials } from "./cloudflare-utils.ts";
import { resolveApiKey } from "./oauth.ts";

// Resolve OAuth tokens at module level (async, runs before tests)
// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
const oauthTokens = await Promise.all([
	resolveApiKey("anthropic"),
	resolveApiKey("github-copilot"),
	resolveApiKey("openai-codex"),
]);
/** 常量 [anthropicOAuthToken, githubCopilotToken, openaiCodexToken] 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const [anthropicOAuthToken, githubCopilotToken, openaiCodexToken] = oauthTokens;

/** 使用给定模型发送完全空的用户内容并验证结果；llm 为目标模型，options 为可选流参数；成功时无返回值。示例：await testEmptyMessage(model)。 */
async function testEmptyMessage<TApi extends Api>(llm: Model<TApi>, options: StreamOptionsWithExtras = {}) {
	// Test with completely empty content array
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
	const emptyMessage: UserMessage = {
		role: "user",
		content: [],
		timestamp: Date.now(),
	};

	/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const context: Context = {
		messages: [emptyMessage],
	};

	/** 常量 response 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const response = await complete(llm, context, options);

	// Should either handle gracefully or return an error
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
	expect(response).toBeDefined();
	expect(response.role).toBe("assistant");
	// Should handle empty string gracefully
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
	if (response.stopReason === "error") {
		expect(response.errorMessage).toBeDefined();
	} else {
		expect(response.content).toBeDefined();
	}
}

/** 使用给定模型发送空字符串内容并验证兼容性；llm 为目标模型，options 为可选流参数；成功时无返回值。示例：await testEmptyStringMessage(model)。 */
async function testEmptyStringMessage<TApi extends Api>(llm: Model<TApi>, options: StreamOptionsWithExtras = {}) {
	// Test with empty string content
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
	const context: Context = {
		messages: [
			{
				role: "user",
				content: "",
				timestamp: Date.now(),
			},
		],
	};

	/** 常量 response 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const response = await complete(llm, context, options);

	expect(response).toBeDefined();
	expect(response.role).toBe("assistant");

	// Should handle empty string gracefully
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
	if (response.stopReason === "error") {
		expect(response.errorMessage).toBeDefined();
	} else {
		expect(response.content).toBeDefined();
	}
}

/** 使用给定模型发送仅含空白字符的内容；llm 为目标模型，options 为可选流参数；成功时无返回值。示例：await testWhitespaceOnlyMessage(model)。 */
async function testWhitespaceOnlyMessage<TApi extends Api>(llm: Model<TApi>, options: StreamOptionsWithExtras = {}) {
	// Test with whitespace-only content
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
	const context: Context = {
		messages: [
			{
				role: "user",
				content: "   \n\t  ",
				timestamp: Date.now(),
			},
		],
	};

	/** 常量 response 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const response = await complete(llm, context, options);

	expect(response).toBeDefined();
	expect(response.role).toBe("assistant");

	// Should handle whitespace-only gracefully
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
	if (response.stopReason === "error") {
		expect(response.errorMessage).toBeDefined();
	} else {
		expect(response.content).toBeDefined();
	}
}

/** 验证对话历史中的空助手消息可被处理；llm 为目标模型，options 为可选流参数；成功时无返回值。示例：await testEmptyAssistantMessage(model)。 */
async function testEmptyAssistantMessage<TApi extends Api>(llm: Model<TApi>, options: StreamOptionsWithExtras = {}) {
	// Test with empty assistant message in conversation flow
	// User -> Empty Assistant -> User
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
	const emptyAssistant: AssistantMessage = {
		role: "assistant",
		content: [],
		api: llm.api,
		provider: llm.provider,
		model: llm.id,
		usage: {
			input: 10,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 10,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop",
		timestamp: Date.now(),
	};

	/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const context: Context = {
		messages: [
			{
				role: "user",
				content: "Hello, how are you?",
				timestamp: Date.now(),
			},
			emptyAssistant,
			{
				role: "user",
				content: "Please respond this time.",
				timestamp: Date.now(),
			},
		],
	};

	/** 常量 response 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const response = await complete(llm, context, options);

	expect(response).toBeDefined();
	expect(response.role).toBe("assistant");

	// Should handle empty assistant message in context gracefully
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
	if (response.stopReason === "error") {
		expect(response.errorMessage).toBeDefined();
	} else {
		expect(response.content).toBeDefined();
		expect(response.content.length).toBeGreaterThan(0);
	}
}

// 用例分组：集中验证“AI Providers Empty Message Tests”相关功能。
describe("AI Providers Empty Message Tests", () => {
	describe.skipIf(!process.env.GEMINI_API_KEY)("Google Provider Empty Messages", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("google", "gemini-2.5-flash");

		// 测试场景：验证“should handle empty content array”对应的行为、结果与边界。
		it("should handle empty content array", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyMessage(llm);
		});

		// 测试场景：验证“should handle empty string content”对应的行为、结果与边界。
		it("should handle empty string content", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyStringMessage(llm);
		});

		// 测试场景：验证“should handle whitespace-only content”对应的行为、结果与边界。
		it("should handle whitespace-only content", { retry: 3, timeout: 30000 }, async () => {
			await testWhitespaceOnlyMessage(llm);
		});

		// 测试场景：验证“should handle empty assistant message in conversation”对应的行为、结果与边界。
		it("should handle empty assistant message in conversation", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyAssistantMessage(llm);
		});
	});

	describe.skipIf(!process.env.OPENAI_API_KEY)("OpenAI Completions Provider Empty Messages", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("openai", "gpt-4o-mini");

		// 测试场景：验证“should handle empty content array”对应的行为、结果与边界。
		it("should handle empty content array", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyMessage(llm);
		});

		// 测试场景：验证“should handle empty string content”对应的行为、结果与边界。
		it("should handle empty string content", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyStringMessage(llm);
		});

		// 测试场景：验证“should handle whitespace-only content”对应的行为、结果与边界。
		it("should handle whitespace-only content", { retry: 3, timeout: 30000 }, async () => {
			await testWhitespaceOnlyMessage(llm);
		});

		// 测试场景：验证“should handle empty assistant message in conversation”对应的行为、结果与边界。
		it("should handle empty assistant message in conversation", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyAssistantMessage(llm);
		});
	});

	describe.skipIf(!process.env.OPENAI_API_KEY)("OpenAI Responses Provider Empty Messages", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("openai", "gpt-5-mini");

		// 测试场景：验证“should handle empty content array”对应的行为、结果与边界。
		it("should handle empty content array", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyMessage(llm);
		});

		// 测试场景：验证“should handle empty string content”对应的行为、结果与边界。
		it("should handle empty string content", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyStringMessage(llm);
		});

		// 测试场景：验证“should handle whitespace-only content”对应的行为、结果与边界。
		it("should handle whitespace-only content", { retry: 3, timeout: 30000 }, async () => {
			await testWhitespaceOnlyMessage(llm);
		});

		// 测试场景：验证“should handle empty assistant message in conversation”对应的行为、结果与边界。
		it("should handle empty assistant message in conversation", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyAssistantMessage(llm);
		});
	});

	describe.skipIf(!hasAzureOpenAICredentials())("Azure OpenAI Responses Provider Empty Messages", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("azure-openai-responses", "gpt-4o-mini");
		/** 常量 azureDeploymentName 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const azureDeploymentName = resolveAzureDeploymentName(llm.id);
		/** 常量 azureOptions 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const azureOptions = azureDeploymentName ? { azureDeploymentName } : {};

		// 测试场景：验证“should handle empty content array”对应的行为、结果与边界。
		it("should handle empty content array", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyMessage(llm, azureOptions);
		});

		// 测试场景：验证“should handle empty string content”对应的行为、结果与边界。
		it("should handle empty string content", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyStringMessage(llm, azureOptions);
		});

		// 测试场景：验证“should handle whitespace-only content”对应的行为、结果与边界。
		it("should handle whitespace-only content", { retry: 3, timeout: 30000 }, async () => {
			await testWhitespaceOnlyMessage(llm, azureOptions);
		});

		// 测试场景：验证“should handle empty assistant message in conversation”对应的行为、结果与边界。
		it("should handle empty assistant message in conversation", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyAssistantMessage(llm, azureOptions);
		});
	});

	describe.skipIf(!process.env.ANTHROPIC_API_KEY)("Anthropic Provider Empty Messages", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("anthropic", "claude-haiku-4-5");

		// 测试场景：验证“should handle empty content array”对应的行为、结果与边界。
		it("should handle empty content array", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyMessage(llm);
		});

		// 测试场景：验证“should handle empty string content”对应的行为、结果与边界。
		it("should handle empty string content", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyStringMessage(llm);
		});

		// 测试场景：验证“should handle whitespace-only content”对应的行为、结果与边界。
		it("should handle whitespace-only content", { retry: 3, timeout: 30000 }, async () => {
			await testWhitespaceOnlyMessage(llm);
		});

		// 测试场景：验证“should handle empty assistant message in conversation”对应的行为、结果与边界。
		it("should handle empty assistant message in conversation", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyAssistantMessage(llm);
		});
	});

	describe.skipIf(!process.env.XAI_API_KEY)("xAI Provider Empty Messages", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("xai", "grok-4.3");

		// 测试场景：验证“should handle empty content array”对应的行为、结果与边界。
		it("should handle empty content array", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyMessage(llm);
		});

		// 测试场景：验证“should handle empty string content”对应的行为、结果与边界。
		it("should handle empty string content", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyStringMessage(llm);
		});

		// 测试场景：验证“should handle whitespace-only content”对应的行为、结果与边界。
		it("should handle whitespace-only content", { retry: 3, timeout: 30000 }, async () => {
			await testWhitespaceOnlyMessage(llm);
		});

		// 测试场景：验证“should handle empty assistant message in conversation”对应的行为、结果与边界。
		it("should handle empty assistant message in conversation", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyAssistantMessage(llm);
		});
	});

	describe.skipIf(!process.env.GROQ_API_KEY)("Groq Provider Empty Messages", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("groq", "openai/gpt-oss-20b");

		// 测试场景：验证“should handle empty content array”对应的行为、结果与边界。
		it("should handle empty content array", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyMessage(llm);
		});

		// 测试场景：验证“should handle empty string content”对应的行为、结果与边界。
		it("should handle empty string content", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyStringMessage(llm);
		});

		// 测试场景：验证“should handle whitespace-only content”对应的行为、结果与边界。
		it("should handle whitespace-only content", { retry: 3, timeout: 30000 }, async () => {
			await testWhitespaceOnlyMessage(llm);
		});

		// 测试场景：验证“should handle empty assistant message in conversation”对应的行为、结果与边界。
		it("should handle empty assistant message in conversation", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyAssistantMessage(llm);
		});
	});

	describe.skipIf(!process.env.CEREBRAS_API_KEY)("Cerebras Provider Empty Messages", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("cerebras", "gpt-oss-120b");

		// 测试场景：验证“should handle empty content array”对应的行为、结果与边界。
		it("should handle empty content array", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyMessage(llm);
		});

		// 测试场景：验证“should handle empty string content”对应的行为、结果与边界。
		it("should handle empty string content", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyStringMessage(llm);
		});

		// 测试场景：验证“should handle whitespace-only content”对应的行为、结果与边界。
		it("should handle whitespace-only content", { retry: 3, timeout: 30000 }, async () => {
			await testWhitespaceOnlyMessage(llm);
		});

		// 测试场景：验证“should handle empty assistant message in conversation”对应的行为、结果与边界。
		it("should handle empty assistant message in conversation", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyAssistantMessage(llm);
		});
	});

	describe.skipIf(!hasCloudflareWorkersAICredentials())("Cloudflare Workers AI Provider Empty Messages", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("cloudflare-workers-ai", "@cf/moonshotai/kimi-k2.6");

		// 测试场景：验证“should handle empty content array”对应的行为、结果与边界。
		it("should handle empty content array", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyMessage(llm);
		});

		// 测试场景：验证“should handle empty string content”对应的行为、结果与边界。
		it("should handle empty string content", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyStringMessage(llm);
		});

		// 测试场景：验证“should handle whitespace-only content”对应的行为、结果与边界。
		it("should handle whitespace-only content", { retry: 3, timeout: 30000 }, async () => {
			await testWhitespaceOnlyMessage(llm);
		});

		// 测试场景：验证“should handle empty assistant message in conversation”对应的行为、结果与边界。
		it("should handle empty assistant message in conversation", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyAssistantMessage(llm);
		});
	});

	describe.skipIf(!hasCloudflareAiGatewayCredentials())("Cloudflare AI Gateway Provider Empty Messages", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("cloudflare-ai-gateway", "workers-ai/@cf/moonshotai/kimi-k2.6");

		// 测试场景：验证“should handle empty content array”对应的行为、结果与边界。
		it("should handle empty content array", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyMessage(llm);
		});

		// 测试场景：验证“should handle empty string content”对应的行为、结果与边界。
		it("should handle empty string content", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyStringMessage(llm);
		});

		// 测试场景：验证“should handle whitespace-only content”对应的行为、结果与边界。
		it("should handle whitespace-only content", { retry: 3, timeout: 30000 }, async () => {
			await testWhitespaceOnlyMessage(llm);
		});

		// 测试场景：验证“should handle empty assistant message in conversation”对应的行为、结果与边界。
		it("should handle empty assistant message in conversation", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyAssistantMessage(llm);
		});
	});

	describe.skipIf(!process.env.HF_TOKEN)("Hugging Face Provider Empty Messages", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("huggingface", "moonshotai/Kimi-K2.5");

		// 测试场景：验证“should handle empty content array”对应的行为、结果与边界。
		it("should handle empty content array", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyMessage(llm);
		});

		// 测试场景：验证“should handle empty string content”对应的行为、结果与边界。
		it("should handle empty string content", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyStringMessage(llm);
		});

		// 测试场景：验证“should handle whitespace-only content”对应的行为、结果与边界。
		it("should handle whitespace-only content", { retry: 3, timeout: 30000 }, async () => {
			await testWhitespaceOnlyMessage(llm);
		});

		// 测试场景：验证“should handle empty assistant message in conversation”对应的行为、结果与边界。
		it("should handle empty assistant message in conversation", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyAssistantMessage(llm);
		});
	});

	describe.skipIf(!process.env.TOGETHER_API_KEY)("Together AI Provider Empty Messages", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("together", "moonshotai/Kimi-K2.6");

		// 测试场景：验证“should handle empty content array”对应的行为、结果与边界。
		it("should handle empty content array", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyMessage(llm);
		});

		// 测试场景：验证“should handle empty string content”对应的行为、结果与边界。
		it("should handle empty string content", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyStringMessage(llm);
		});

		// 测试场景：验证“should handle whitespace-only content”对应的行为、结果与边界。
		it("should handle whitespace-only content", { retry: 3, timeout: 30000 }, async () => {
			await testWhitespaceOnlyMessage(llm);
		});

		// 测试场景：验证“should handle empty assistant message in conversation”对应的行为、结果与边界。
		it("should handle empty assistant message in conversation", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyAssistantMessage(llm);
		});
	});

	describe.skipIf(!process.env.ZAI_API_KEY)("zAI Provider Empty Messages", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("zai", "glm-4.5-air");

		// 测试场景：验证“should handle empty content array”对应的行为、结果与边界。
		it("should handle empty content array", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyMessage(llm);
		});

		// 测试场景：验证“should handle empty string content”对应的行为、结果与边界。
		it("should handle empty string content", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyStringMessage(llm);
		});

		// 测试场景：验证“should handle whitespace-only content”对应的行为、结果与边界。
		it("should handle whitespace-only content", { retry: 3, timeout: 30000 }, async () => {
			await testWhitespaceOnlyMessage(llm);
		});

		// 测试场景：验证“should handle empty assistant message in conversation”对应的行为、结果与边界。
		it("should handle empty assistant message in conversation", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyAssistantMessage(llm);
		});
	});

	describe.skipIf(!process.env.MISTRAL_API_KEY)("Mistral Provider Empty Messages", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("mistral", "devstral-medium-latest");

		// 测试场景：验证“should handle empty content array”对应的行为、结果与边界。
		it("should handle empty content array", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyMessage(llm);
		});

		// 测试场景：验证“should handle empty string content”对应的行为、结果与边界。
		it("should handle empty string content", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyStringMessage(llm);
		});

		// 测试场景：验证“should handle whitespace-only content”对应的行为、结果与边界。
		it("should handle whitespace-only content", { retry: 3, timeout: 30000 }, async () => {
			await testWhitespaceOnlyMessage(llm);
		});

		// 测试场景：验证“should handle empty assistant message in conversation”对应的行为、结果与边界。
		it("should handle empty assistant message in conversation", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyAssistantMessage(llm);
		});
	});

	describe.skipIf(!process.env.MINIMAX_API_KEY)("MiniMax Provider Empty Messages", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("minimax", "MiniMax-M2.7");

		// 测试场景：验证“should handle empty content array”对应的行为、结果与边界。
		it("should handle empty content array", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyMessage(llm);
		});

		// 测试场景：验证“should handle empty string content”对应的行为、结果与边界。
		it("should handle empty string content", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyStringMessage(llm);
		});

		// 测试场景：验证“should handle whitespace-only content”对应的行为、结果与边界。
		it("should handle whitespace-only content", { retry: 3, timeout: 30000 }, async () => {
			await testWhitespaceOnlyMessage(llm);
		});

		// 测试场景：验证“should handle empty assistant message in conversation”对应的行为、结果与边界。
		it("should handle empty assistant message in conversation", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyAssistantMessage(llm);
		});
	});

	describe.skipIf(!process.env.XIAOMI_API_KEY)("Xiaomi MiMo (API billing) Provider Empty Messages", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("xiaomi", "mimo-v2.5-pro");

		// 测试场景：验证“should handle empty content array”对应的行为、结果与边界。
		it("should handle empty content array", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyMessage(llm);
		});

		// 测试场景：验证“should handle empty string content”对应的行为、结果与边界。
		it("should handle empty string content", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyStringMessage(llm);
		});

		// 测试场景：验证“should handle whitespace-only content”对应的行为、结果与边界。
		it("should handle whitespace-only content", { retry: 3, timeout: 30000 }, async () => {
			await testWhitespaceOnlyMessage(llm);
		});

		// 测试场景：验证“should handle empty assistant message in conversation”对应的行为、结果与边界。
		it("should handle empty assistant message in conversation", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyAssistantMessage(llm);
		});
	});

	describe.skipIf(!process.env.XIAOMI_TOKEN_PLAN_CN_API_KEY)(
		"Xiaomi MiMo Token Plan (CN) Provider Empty Messages",
		() => {
			/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const llm = getModel("xiaomi-token-plan-cn", "mimo-v2.5-pro");

			// 测试场景：验证“should handle empty content array”对应的行为、结果与边界。
			it("should handle empty content array", { retry: 3, timeout: 30000 }, async () => {
				await testEmptyMessage(llm);
			});

			// 测试场景：验证“should handle empty string content”对应的行为、结果与边界。
			it("should handle empty string content", { retry: 3, timeout: 30000 }, async () => {
				await testEmptyStringMessage(llm);
			});

			// 测试场景：验证“should handle whitespace-only content”对应的行为、结果与边界。
			it("should handle whitespace-only content", { retry: 3, timeout: 30000 }, async () => {
				await testWhitespaceOnlyMessage(llm);
			});

			// 测试场景：验证“should handle empty assistant message in conversation”对应的行为、结果与边界。
			it("should handle empty assistant message in conversation", { retry: 3, timeout: 30000 }, async () => {
				await testEmptyAssistantMessage(llm);
			});
		},
	);

	describe.skipIf(!process.env.XIAOMI_TOKEN_PLAN_AMS_API_KEY)(
		"Xiaomi MiMo Token Plan (AMS) Provider Empty Messages",
		() => {
			/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const llm = getModel("xiaomi-token-plan-ams", "mimo-v2.5-pro");

			// 测试场景：验证“should handle empty content array”对应的行为、结果与边界。
			it("should handle empty content array", { retry: 3, timeout: 30000 }, async () => {
				await testEmptyMessage(llm);
			});

			// 测试场景：验证“should handle empty string content”对应的行为、结果与边界。
			it("should handle empty string content", { retry: 3, timeout: 30000 }, async () => {
				await testEmptyStringMessage(llm);
			});

			// 测试场景：验证“should handle whitespace-only content”对应的行为、结果与边界。
			it("should handle whitespace-only content", { retry: 3, timeout: 30000 }, async () => {
				await testWhitespaceOnlyMessage(llm);
			});

			// 测试场景：验证“should handle empty assistant message in conversation”对应的行为、结果与边界。
			it("should handle empty assistant message in conversation", { retry: 3, timeout: 30000 }, async () => {
				await testEmptyAssistantMessage(llm);
			});
		},
	);

	describe.skipIf(!process.env.XIAOMI_TOKEN_PLAN_SGP_API_KEY)(
		"Xiaomi MiMo Token Plan (SGP) Provider Empty Messages",
		() => {
			/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const llm = getModel("xiaomi-token-plan-sgp", "mimo-v2.5-pro");

			// 测试场景：验证“should handle empty content array”对应的行为、结果与边界。
			it("should handle empty content array", { retry: 3, timeout: 30000 }, async () => {
				await testEmptyMessage(llm);
			});

			// 测试场景：验证“should handle empty string content”对应的行为、结果与边界。
			it("should handle empty string content", { retry: 3, timeout: 30000 }, async () => {
				await testEmptyStringMessage(llm);
			});

			// 测试场景：验证“should handle whitespace-only content”对应的行为、结果与边界。
			it("should handle whitespace-only content", { retry: 3, timeout: 30000 }, async () => {
				await testWhitespaceOnlyMessage(llm);
			});

			// 测试场景：验证“should handle empty assistant message in conversation”对应的行为、结果与边界。
			it("should handle empty assistant message in conversation", { retry: 3, timeout: 30000 }, async () => {
				await testEmptyAssistantMessage(llm);
			});
		},
	);

	describe.skipIf(!process.env.QWEN_TOKEN_PLAN_API_KEY)("Qwen Token Plan Provider Empty Messages", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("qwen-token-plan", "qwen3.7-max");

		// 测试场景：验证“should handle empty content array”对应的行为、结果与边界。
		it("should handle empty content array", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyMessage(llm);
		});

		// 测试场景：验证“should handle empty string content”对应的行为、结果与边界。
		it("should handle empty string content", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyStringMessage(llm);
		});

		// 测试场景：验证“should handle whitespace-only content”对应的行为、结果与边界。
		it("should handle whitespace-only content", { retry: 3, timeout: 30000 }, async () => {
			await testWhitespaceOnlyMessage(llm);
		});

		// 测试场景：验证“should handle empty assistant message in conversation”对应的行为、结果与边界。
		it("should handle empty assistant message in conversation", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyAssistantMessage(llm);
		});
	});

	describe.skipIf(!process.env.QWEN_TOKEN_PLAN_CN_API_KEY)("Qwen Token Plan (CN) Provider Empty Messages", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("qwen-token-plan-cn", "qwen3.7-max");

		// 测试场景：验证“should handle empty content array”对应的行为、结果与边界。
		it("should handle empty content array", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyMessage(llm);
		});

		// 测试场景：验证“should handle empty string content”对应的行为、结果与边界。
		it("should handle empty string content", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyStringMessage(llm);
		});

		// 测试场景：验证“should handle whitespace-only content”对应的行为、结果与边界。
		it("should handle whitespace-only content", { retry: 3, timeout: 30000 }, async () => {
			await testWhitespaceOnlyMessage(llm);
		});

		// 测试场景：验证“should handle empty assistant message in conversation”对应的行为、结果与边界。
		it("should handle empty assistant message in conversation", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyAssistantMessage(llm);
		});
	});

	describe.skipIf(!process.env.KIMI_API_KEY)("Kimi For Coding Provider Empty Messages", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("kimi-coding", "kimi-for-coding");

		// 测试场景：验证“should handle empty content array”对应的行为、结果与边界。
		it("should handle empty content array", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyMessage(llm);
		});

		// 测试场景：验证“should handle empty string content”对应的行为、结果与边界。
		it("should handle empty string content", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyStringMessage(llm);
		});

		// 测试场景：验证“should handle whitespace-only content”对应的行为、结果与边界。
		it("should handle whitespace-only content", { retry: 3, timeout: 30000 }, async () => {
			await testWhitespaceOnlyMessage(llm);
		});

		// 测试场景：验证“should handle empty assistant message in conversation”对应的行为、结果与边界。
		it("should handle empty assistant message in conversation", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyAssistantMessage(llm);
		});
	});

	describe.skipIf(!process.env.AI_GATEWAY_API_KEY)("Vercel AI Gateway Provider Empty Messages", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("vercel-ai-gateway", "google/gemini-2.5-flash");

		// 测试场景：验证“should handle empty content array”对应的行为、结果与边界。
		it("should handle empty content array", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyMessage(llm);
		});

		// 测试场景：验证“should handle empty string content”对应的行为、结果与边界。
		it("should handle empty string content", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyStringMessage(llm);
		});

		// 测试场景：验证“should handle whitespace-only content”对应的行为、结果与边界。
		it("should handle whitespace-only content", { retry: 3, timeout: 30000 }, async () => {
			await testWhitespaceOnlyMessage(llm);
		});

		// 测试场景：验证“should handle empty assistant message in conversation”对应的行为、结果与边界。
		it("should handle empty assistant message in conversation", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyAssistantMessage(llm);
		});
	});

	describe.skipIf(!hasBedrockCredentials())("Amazon Bedrock Provider Empty Messages", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("amazon-bedrock", "global.anthropic.claude-sonnet-4-5-20250929-v1:0");

		// 测试场景：验证“should handle empty content array”对应的行为、结果与边界。
		it("should handle empty content array", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyMessage(llm);
		});

		// 测试场景：验证“should handle empty string content”对应的行为、结果与边界。
		it("should handle empty string content", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyStringMessage(llm);
		});

		// 测试场景：验证“should handle whitespace-only content”对应的行为、结果与边界。
		it("should handle whitespace-only content", { retry: 3, timeout: 30000 }, async () => {
			await testWhitespaceOnlyMessage(llm);
		});

		// 测试场景：验证“should handle empty assistant message in conversation”对应的行为、结果与边界。
		it("should handle empty assistant message in conversation", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyAssistantMessage(llm);
		});
	});

	// =========================================================================
	// OAuth-based providers (credentials from ~/.pi/agent/oauth.json)
	// =========================================================================
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

	// 用例分组：集中验证“Anthropic OAuth Provider Empty Messages”相关功能。
	describe("Anthropic OAuth Provider Empty Messages", () => {
		/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const llm = getModel("anthropic", "claude-haiku-4-5");

		it.skipIf(!anthropicOAuthToken)("should handle empty content array", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyMessage(llm, { apiKey: anthropicOAuthToken });
		});

		it.skipIf(!anthropicOAuthToken)("should handle empty string content", { retry: 3, timeout: 30000 }, async () => {
			await testEmptyStringMessage(llm, { apiKey: anthropicOAuthToken });
		});

		it.skipIf(!anthropicOAuthToken)(
			"should handle whitespace-only content",
			{ retry: 3, timeout: 30000 },
			async () => {
				await testWhitespaceOnlyMessage(llm, { apiKey: anthropicOAuthToken });
			},
		);

		it.skipIf(!anthropicOAuthToken)(
			"should handle empty assistant message in conversation",
			{ retry: 3, timeout: 30000 },
			async () => {
				await testEmptyAssistantMessage(llm, { apiKey: anthropicOAuthToken });
			},
		);
	});

	// 用例分组：集中验证“GitHub Copilot Provider Empty Messages”相关功能。
	describe("GitHub Copilot Provider Empty Messages", () => {
		it.skipIf(!githubCopilotToken)(
			"claude-haiku-4.5 - should handle empty content array",
			{ retry: 3, timeout: 30000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("github-copilot", "claude-haiku-4.5");
				await testEmptyMessage(llm, { apiKey: githubCopilotToken });
			},
		);

		it.skipIf(!githubCopilotToken)(
			"claude-haiku-4.5 - should handle empty string content",
			{ retry: 3, timeout: 30000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("github-copilot", "claude-haiku-4.5");
				await testEmptyStringMessage(llm, { apiKey: githubCopilotToken });
			},
		);

		it.skipIf(!githubCopilotToken)(
			"claude-haiku-4.5 - should handle whitespace-only content",
			{ retry: 3, timeout: 30000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("github-copilot", "claude-haiku-4.5");
				await testWhitespaceOnlyMessage(llm, { apiKey: githubCopilotToken });
			},
		);

		it.skipIf(!githubCopilotToken)(
			"claude-haiku-4.5 - should handle empty assistant message in conversation",
			{ retry: 3, timeout: 30000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("github-copilot", "claude-haiku-4.5");
				await testEmptyAssistantMessage(llm, { apiKey: githubCopilotToken });
			},
		);

		it.skipIf(!githubCopilotToken)(
			"claude-sonnet-4 - should handle empty content array",
			{ retry: 3, timeout: 30000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("github-copilot", "claude-sonnet-4.6");
				await testEmptyMessage(llm, { apiKey: githubCopilotToken });
			},
		);

		it.skipIf(!githubCopilotToken)(
			"claude-sonnet-4 - should handle empty string content",
			{ retry: 3, timeout: 30000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("github-copilot", "claude-sonnet-4.6");
				await testEmptyStringMessage(llm, { apiKey: githubCopilotToken });
			},
		);

		it.skipIf(!githubCopilotToken)(
			"claude-sonnet-4 - should handle whitespace-only content",
			{ retry: 3, timeout: 30000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("github-copilot", "claude-sonnet-4.6");
				await testWhitespaceOnlyMessage(llm, { apiKey: githubCopilotToken });
			},
		);

		it.skipIf(!githubCopilotToken)(
			"claude-sonnet-4 - should handle empty assistant message in conversation",
			{ retry: 3, timeout: 30000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("github-copilot", "claude-sonnet-4.6");
				await testEmptyAssistantMessage(llm, { apiKey: githubCopilotToken });
			},
		);
	});

	// 用例分组：集中验证“OpenAI Codex Provider Empty Messages”相关功能。
	describe("OpenAI Codex Provider Empty Messages", () => {
		it.skipIf(!openaiCodexToken)(
			"gpt-5.5 - should handle empty content array",
			{ retry: 3, timeout: 30000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("openai-codex", "gpt-5.5");
				await testEmptyMessage(llm, { apiKey: openaiCodexToken });
			},
		);

		it.skipIf(!openaiCodexToken)(
			"gpt-5.5 - should handle empty string content",
			{ retry: 3, timeout: 30000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("openai-codex", "gpt-5.5");
				await testEmptyStringMessage(llm, { apiKey: openaiCodexToken });
			},
		);

		it.skipIf(!openaiCodexToken)(
			"gpt-5.5 - should handle whitespace-only content",
			{ retry: 3, timeout: 30000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("openai-codex", "gpt-5.5");
				await testWhitespaceOnlyMessage(llm, { apiKey: openaiCodexToken });
			},
		);

		it.skipIf(!openaiCodexToken)(
			"gpt-5.5 - should handle empty assistant message in conversation",
			{ retry: 3, timeout: 30000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("openai-codex", "gpt-5.5");
				await testEmptyAssistantMessage(llm, { apiKey: openaiCodexToken });
			},
		);
	});
});
