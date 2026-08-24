import { describe, expect, it } from "vitest";
import { complete, getModel, stream } from "../src/compat.ts";
import type { Api, Context, Model, StreamOptions } from "../src/types.ts";

/** 在标准 StreamOptions 上允许提供商专属附加字段。 */
type StreamOptionsWithExtras = StreamOptions & Record<string, unknown>;

import { hasAzureOpenAICredentials, resolveAzureDeploymentName } from "./azure-utils.ts";
import { hasBedrockCredentials } from "./bedrock-utils.ts";
import { resolveApiKey } from "./oauth.ts";

// Resolve OAuth tokens at module level (async, runs before tests)
// 在模块加载阶段异步解析 OAuth 令牌，测试开始前即可决定是否跳过。
/** 可用的 OpenAI Codex OAuth 令牌；未登录时为 undefined。 */
const [openaiCodexToken] = await Promise.all([resolveApiKey("openai-codex")]);

/** 测试收到一定文本后中止流并继续对话。llm 为目标模型，options 为提供商选项；无返回值。示例：await testAbortSignal(llm)。 */
async function testAbortSignal<TApi extends Api>(llm: Model<TApi>, options: StreamOptionsWithExtras = {}) {
	/** 包含初始问题且会在中止后继续追加消息的上下文。 */
	const context: Context = {
		messages: [
			{
				role: "user",
				content: "What is 15 + 27? Think step by step. Then list 50 first names.",
				timestamp: Date.now(),
			},
		],
		systemPrompt: "You are a helpful assistant.",
	};

	/** 标记控制器是否已触发，防止继续消费后续事件。 */
	let abortFired = false;
	/** 累计文本与思考增量，用于达到中止阈值。 */
	let text = "";
	/** 控制当前流式请求的中止控制器。 */
	const controller = new AbortController();
	/** 当前模型返回的异步事件流。 */
	const response = await stream(llm, context, { ...options, signal: controller.signal });
	for await (const event of response) {
		if (abortFired) return;
		if (event.type === "text_delta" || event.type === "thinking_delta") {
			text += event.delta;
		}
		if (text.length >= 50) {
			controller.abort();
			abortFired = true;
		}
	}
	/** 流结束后收敛得到的助手消息。 */
	const msg = await response.result();

	// If we get here without throwing, the abort didn't work
	// 若执行到这里没有异常，仍需确认停止原因为 aborted，证明中止生效。
	expect(msg.stopReason).toBe("aborted");
	expect(msg.content.length).toBeGreaterThan(0);

	context.messages.push(msg);
	context.messages.push({
		role: "user",
		content: "Please continue, but only generate 5 names.",
		timestamp: Date.now(),
	});

	/** 把中止消息和新用户消息加入上下文后得到的正常后续响应。 */
	const followUp = await complete(llm, context, options);
	expect(followUp.stopReason).toBe("stop");
	expect(followUp.content.length).toBeGreaterThan(0);
}

/** 测试请求开始前已中止的控制器。llm 为目标模型；返回完成 Promise。示例：await testImmediateAbort(llm)。 */
async function testImmediateAbort<TApi extends Api>(llm: Model<TApi>, options: StreamOptionsWithExtras = {}) {
	/** 在请求发出前就会被中止的控制器。 */
	const controller = new AbortController();

	controller.abort();

	/** 最小用户消息上下文。 */
	const context: Context = {
		messages: [{ role: "user", content: "Hello", timestamp: Date.now() }],
	};

	/** 立即中止请求返回的助手消息。 */
	const response = await complete(llm, context, { ...options, signal: controller.signal });
	expect(response.stopReason).toBe("aborted");
}

/** 测试立即中止后的空助手消息不会阻止下一次请求。返回完成 Promise。示例：await testAbortThenNewMessage(llm)。 */
async function testAbortThenNewMessage<TApi extends Api>(llm: Model<TApi>, options: StreamOptionsWithExtras = {}) {
	// First request: abort immediately before any response content arrives
	// 第一次请求在任何响应内容到达前立即中止。
	/** 第一次请求使用且已中止的控制器。 */
	const controller = new AbortController();
	controller.abort();

	/** 会被追加中止助手消息和后续用户消息的上下文。 */
	const context: Context = {
		messages: [{ role: "user", content: "Hello, how are you?", timestamp: Date.now() }],
	};

	/** 第一次立即中止得到的空助手消息。 */
	const abortedResponse = await complete(llm, context, { ...options, signal: controller.signal });
	expect(abortedResponse.stopReason).toBe("aborted");
	// The aborted message has empty content since we aborted before anything arrived
	// 因为在内容到达前中止，所以助手消息内容应为空。
	expect(abortedResponse.content.length).toBe(0);

	// Add the aborted assistant message to context (this is what happens in the real coding agent)
	// 将中止助手消息加入上下文，模拟 coding-agent 的真实会话行为。
	context.messages.push(abortedResponse);

	// Second request: send a new message - this should work even with the aborted message in context
	// 第二次发送新消息；即使上下文含空中止消息也应正常完成。
	context.messages.push({
		role: "user",
		content: "What is 2 + 2?",
		timestamp: Date.now(),
	});

	/** 中止后新用户消息得到的正常响应。 */
	const followUp = await complete(llm, context, options);
	expect(followUp.stopReason).toBe("stop");
	expect(followUp.content.length).toBeGreaterThan(0);
}

describe("AI Providers Abort Tests", () => {
	describe.skipIf(!process.env.GEMINI_API_KEY)("Google Provider Abort", () => {
		/** Google 中止契约使用的 Gemini 模型。 */
		const llm = getModel("google", "gemini-2.5-flash");

		it("should abort mid-stream", { retry: 3 }, async () => {
			await testAbortSignal(llm, { thinking: { enabled: true } });
		});

		it("should handle immediate abort", { retry: 3 }, async () => {
			await testImmediateAbort(llm, { thinking: { enabled: true } });
		});
	});

	describe.skipIf(!process.env.OPENAI_API_KEY)("OpenAI Completions Provider Abort", () => {
		/** 去除 compat 元数据后的 OpenAI 基础模型。 */
		const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini")!;
		void _compat;
		/** 强制走 openai-completions API 的模型定义。 */
		const llm: Model<"openai-completions"> = {
			...baseModel,
			api: "openai-completions",
		};

		it("should abort mid-stream", { retry: 3 }, async () => {
			await testAbortSignal(llm);
		});

		it("should handle immediate abort", { retry: 3 }, async () => {
			await testImmediateAbort(llm);
		});
	});

	describe.skipIf(!process.env.OPENAI_API_KEY)("OpenAI Responses Provider Abort", () => {
		/** OpenAI Responses 中止契约使用的模型。 */
		const llm = getModel("openai", "gpt-5-mini");

		it("should abort mid-stream", { retry: 3 }, async () => {
			await testAbortSignal(llm);
		});

		it("should handle immediate abort", { retry: 3 }, async () => {
			await testImmediateAbort(llm);
		});
	});

	describe.skipIf(!hasAzureOpenAICredentials())("Azure OpenAI Responses Provider Abort", () => {
		/** Azure OpenAI Responses 中止契约使用的模型。 */
		const llm = getModel("azure-openai-responses", "gpt-4o-mini");
		/** 根据模型 ID 解析的 Azure 部署名。 */
		const azureDeploymentName = resolveAzureDeploymentName(llm.id);
		/** 仅在部署名存在时传递的 Azure 专属选项。 */
		const azureOptions = azureDeploymentName ? { azureDeploymentName } : {};

		it("should abort mid-stream", { retry: 3 }, async () => {
			await testAbortSignal(llm, azureOptions);
		});

		it("should handle immediate abort", { retry: 3 }, async () => {
			await testImmediateAbort(llm, azureOptions);
		});
	});

	describe.skipIf(!process.env.ANTHROPIC_OAUTH_TOKEN)("Anthropic Provider Abort", () => {
		/** Anthropic 中止契约使用的 Claude 模型。 */
		const llm = getModel("anthropic", "claude-opus-4-1-20250805");

		it("should abort mid-stream", { retry: 3 }, async () => {
			await testAbortSignal(llm, { thinkingEnabled: true, thinkingBudgetTokens: 2048 });
		});

		it("should handle immediate abort", { retry: 3 }, async () => {
			await testImmediateAbort(llm, { thinkingEnabled: true, thinkingBudgetTokens: 2048 });
		});
	});

	describe.skipIf(!process.env.MISTRAL_API_KEY)("Mistral Provider Abort", () => {
		/** Mistral 中止契约使用的模型。 */
		const llm = getModel("mistral", "devstral-medium-latest");

		it("should abort mid-stream", { retry: 3 }, async () => {
			await testAbortSignal(llm);
		});

		it("should handle immediate abort", { retry: 3 }, async () => {
			await testImmediateAbort(llm);
		});
	});

	describe.skipIf(!process.env.TOGETHER_API_KEY)("Together AI Provider Abort", () => {
		/** Together AI 中止契约使用的 Kimi 模型。 */
		const llm = getModel("together", "moonshotai/Kimi-K2.6");

		it("should abort mid-stream", { retry: 3 }, async () => {
			await testAbortSignal(llm, { reasoningEffort: "high" });
		});

		it("should handle immediate abort", { retry: 3 }, async () => {
			await testImmediateAbort(llm, { reasoningEffort: "high" });
		});
	});

	describe.skipIf(!process.env.MINIMAX_API_KEY)("MiniMax Provider Abort", () => {
		/** MiniMax 中止契约使用的模型。 */
		const llm = getModel("minimax", "MiniMax-M2.7");

		it("should abort mid-stream", { retry: 3 }, async () => {
			await testAbortSignal(llm);
		});

		it("should handle immediate abort", { retry: 3 }, async () => {
			await testImmediateAbort(llm);
		});
	});

	describe.skipIf(!process.env.XIAOMI_API_KEY)("Xiaomi MiMo (API billing) Provider Abort", () => {
		/** 小米按量计费端点中止契约使用的模型。 */
		const llm = getModel("xiaomi", "mimo-v2.5-pro");

		it("should abort mid-stream", { retry: 3 }, async () => {
			await testAbortSignal(llm);
		});

		it("should handle immediate abort", { retry: 3 }, async () => {
			await testImmediateAbort(llm);
		});
	});

	describe.skipIf(!process.env.XIAOMI_TOKEN_PLAN_CN_API_KEY)("Xiaomi MiMo Token Plan (CN) Provider Abort", () => {
		/** 小米中国区 Token 套餐端点使用的模型。 */
		const llm = getModel("xiaomi-token-plan-cn", "mimo-v2.5-pro");

		it("should abort mid-stream", { retry: 3 }, async () => {
			await testAbortSignal(llm);
		});

		it("should handle immediate abort", { retry: 3 }, async () => {
			await testImmediateAbort(llm);
		});
	});

	describe.skipIf(!process.env.XIAOMI_TOKEN_PLAN_AMS_API_KEY)("Xiaomi MiMo Token Plan (AMS) Provider Abort", () => {
		/** 小米阿姆斯特丹 Token 套餐端点使用的模型。 */
		const llm = getModel("xiaomi-token-plan-ams", "mimo-v2.5-pro");

		it("should abort mid-stream", { retry: 3 }, async () => {
			await testAbortSignal(llm);
		});

		it("should handle immediate abort", { retry: 3 }, async () => {
			await testImmediateAbort(llm);
		});
	});

	describe.skipIf(!process.env.XIAOMI_TOKEN_PLAN_SGP_API_KEY)("Xiaomi MiMo Token Plan (SGP) Provider Abort", () => {
		/** 小米新加坡 Token 套餐端点使用的模型。 */
		const llm = getModel("xiaomi-token-plan-sgp", "mimo-v2.5-pro");

		it("should abort mid-stream", { retry: 3 }, async () => {
			await testAbortSignal(llm);
		});

		it("should handle immediate abort", { retry: 3 }, async () => {
			await testImmediateAbort(llm);
		});
	});

	describe.skipIf(!process.env.QWEN_TOKEN_PLAN_API_KEY)("Qwen Token Plan Provider Abort", () => {
		/** Qwen 国际 Token 套餐端点使用的模型。 */
		const llm = getModel("qwen-token-plan", "qwen3.7-max");

		it("should abort mid-stream", { retry: 3 }, async () => {
			await testAbortSignal(llm);
		});

		it("should handle immediate abort", { retry: 3 }, async () => {
			await testImmediateAbort(llm);
		});
	});

	describe.skipIf(!process.env.QWEN_TOKEN_PLAN_CN_API_KEY)("Qwen Token Plan (CN) Provider Abort", () => {
		/** Qwen 中国区 Token 套餐端点使用的模型。 */
		const llm = getModel("qwen-token-plan-cn", "qwen3.7-max");

		it("should abort mid-stream", { retry: 3 }, async () => {
			await testAbortSignal(llm);
		});

		it("should handle immediate abort", { retry: 3 }, async () => {
			await testImmediateAbort(llm);
		});
	});

	describe.skipIf(!process.env.KIMI_API_KEY)("Kimi For Coding Provider Abort", () => {
		/** Kimi Coding 中止契约使用的模型。 */
		const llm = getModel("kimi-coding", "kimi-for-coding");

		it("should abort mid-stream", { retry: 3 }, async () => {
			await testAbortSignal(llm);
		});

		it("should handle immediate abort", { retry: 3 }, async () => {
			await testImmediateAbort(llm);
		});
	});

	describe.skipIf(!process.env.AI_GATEWAY_API_KEY)("Vercel AI Gateway Provider Abort", () => {
		/** Vercel AI Gateway 中止契约使用的路由模型。 */
		const llm = getModel("vercel-ai-gateway", "google/gemini-2.5-flash");

		it("should abort mid-stream", { retry: 3 }, async () => {
			await testAbortSignal(llm);
		});

		it("should handle immediate abort", { retry: 3 }, async () => {
			await testImmediateAbort(llm);
		});
	});

	describe("OpenAI Codex Provider Abort", () => {
		it.skipIf(!openaiCodexToken)("should abort mid-stream", { retry: 3 }, async () => {
			/** OpenAI Codex 中途中止场景使用的模型。 */
			const llm = getModel("openai-codex", "gpt-5.5");
			await testAbortSignal(llm, { apiKey: openaiCodexToken });
		});

		it.skipIf(!openaiCodexToken)("should handle immediate abort", { retry: 3 }, async () => {
			/** OpenAI Codex 立即中止场景使用的模型。 */
			const llm = getModel("openai-codex", "gpt-5.5");
			await testImmediateAbort(llm, { apiKey: openaiCodexToken });
		});
	});

	describe.skipIf(!hasBedrockCredentials())("Amazon Bedrock Provider Abort", () => {
		/** Amazon Bedrock 中止契约使用的 Claude 模型。 */
		const llm = getModel("amazon-bedrock", "global.anthropic.claude-sonnet-4-5-20250929-v1:0");

		it("should abort mid-stream", { retry: 3 }, async () => {
			await testAbortSignal(llm, { reasoning: "medium" });
		});

		it("should handle immediate abort", { retry: 3 }, async () => {
			await testImmediateAbort(llm);
		});

		it("should handle abort then new message", { retry: 3 }, async () => {
			await testAbortThenNewMessage(llm);
		});
	});
});
/**
 * 文件职责：跨多个 AI 提供商验证流式中止、立即中止，以及中止消息进入上下文后的后续请求行为。
 * 技术维度：使用 Vitest 条件跳过、AbortController、异步事件迭代和共享泛型测试函数覆盖不同 API 适配器。
 * 产品维度：保障用户停止生成时请求及时结束，并且会话仍可继续，不因空的 aborted 助手消息而损坏。
 * 逻辑维度：先定义三种中止共享流程，再为每个具备凭据的提供商选择模型和专属选项执行相同契约。
 * 关键边界：多数用例需要真实凭据和网络；中途停止以累计 50 个字符为触发条件；单个在线用例最多重试三次。
 * 新手阅读建议：先看 testImmediateAbort，再看 testAbortSignal 和 testAbortThenNewMessage，最后比较各提供商选项差异。
 */
