/**
 * 文件职责：跨提供商验证流式请求被中止后，助手消息中的 Token 与费用统计符合各协议实际能力。
 * 技术维度：使用 Vitest 条件跳过、AbortController、异步事件迭代和 API Key/OAuth 提供商矩阵执行在线契约测试。
 * 产品维度：保障用户中止长输出后，界面和费用统计不会显示错误用量，同时兼容只在终块返回 usage 的服务。
 * 逻辑维度：共享函数在累计 1000 字符后中止并按 API/提供商分支断言，再对每个有凭据模型重复执行。
 * 关键边界：用例依赖真实网络与密钥；不同提供商上报时机不同；小米流式 usage 已知缺失，因此相关用例固定跳过。
 * 新手阅读建议：先看 testTokensOnAbort 的三类断言分支，再浏览 API Key 矩阵，最后阅读 OAuth 与已知限制说明。
 */
import { describe, expect, it } from "vitest";
import { getModel, getModels, stream } from "../src/compat.ts";
import type { Api, Context, Model, StreamOptions } from "../src/types.ts";

/** 在标准流选项上允许提供商专属字段。 */
type StreamOptionsWithExtras = StreamOptions & Record<string, unknown>;

import { hasAzureOpenAICredentials, resolveAzureDeploymentName } from "./azure-utils.ts";
import { hasBedrockCredentials } from "./bedrock-utils.ts";
import { hasCloudflareAiGatewayCredentials, hasCloudflareWorkersAICredentials } from "./cloudflare-utils.ts";
import { resolveApiKey } from "./oauth.ts";

// Resolve OAuth tokens at module level (async, runs before tests)
// 模块加载时解析 OAuth 令牌，测试注册阶段据此决定是否跳过。
/** 三个 OAuth 提供商并行解析得到的令牌。 */
const oauthTokens = await Promise.all([
	resolveApiKey("anthropic"),
	resolveApiKey("github-copilot"),
	resolveApiKey("openai-codex"),
]);
/** 按顺序解构出的 Anthropic、Copilot 与 Codex 令牌。 */
const [anthropicOAuthToken, githubCopilotToken, openaiCodexToken] = oauthTokens;

/** 在输出达到阈值后中止，并按提供商能力检查 usage。返回完成 Promise。示例：await testTokensOnAbort(llm)。 */
async function testTokensOnAbort<TApi extends Api>(llm: Model<TApi>, options: StreamOptionsWithExtras = {}) {
	/** 请求长诗以确保有足够流式内容触发中止。 */
	const context: Context = {
		messages: [
			{
				role: "user",
				content: "Write a long poem with 20 stanzas about the beauty of nature.",
				timestamp: Date.now(),
			},
		],
		systemPrompt: "You are a helpful assistant.",
	};

	/** 控制当前在线请求的中止控制器。 */
	const controller = new AbortController();
	/** 当前模型返回的异步事件流。 */
	const response = stream(llm, context, { ...options, signal: controller.signal });

	/** 标记中止是否已经触发。 */
	let abortFired = false;
	/** 累计文本和思考增量以判断中止阈值。 */
	let text = "";
	/** event 是当前流事件；达到 1000 字符前持续累计增量，之后触发一次中止。 */
	for await (const event of response) {
		if (!abortFired && (event.type === "text_delta" || event.type === "thinking_delta")) {
			text += event.delta;
			if (text.length >= 1000) {
				abortFired = true;
				controller.abort();
			}
		}
	}

	/** 事件流收敛后的 aborted 助手消息。 */
	const msg = await response.result();

	expect(msg.stopReason).toBe("aborted");

	// OpenAI providers, OpenAI Codex, zai, and Amazon Bedrock only send usage in the final chunk,
	// OpenAI 系列、Codex、zAI 和 Bedrock 只在最终数据块发送 usage，
	// so when aborted they have no token stats. Anthropic and Google send usage information early in the stream.
	// 因而中止后没有统计；Anthropic 与 Google 会在流早期发送 usage。
	// MiniMax and Kimi report input tokens but not output tokens differently on aborted requests.
	// MiniMax 与 Kimi 对中止请求的输入、输出 Token 上报方式也不同。
	if (
		llm.api === "openai-completions" ||
		llm.api === "mistral-conversations" ||
		llm.api === "openai-responses" ||
		llm.api === "azure-openai-responses" ||
		llm.api === "openai-codex-responses" ||
		llm.provider === "zai" ||
		llm.provider === "amazon-bedrock" ||
		llm.provider === "vercel-ai-gateway"
	) {
		expect(msg.usage.input).toBe(0);
		expect(msg.usage.output).toBe(0);
	} else if (llm.provider === "minimax") {
		// MiniMax M2.7 does not report token usage for aborted requests.
		// MiniMax M2.7 不上报被中止请求的 Token 用量。
		expect(msg.usage.input).toBe(0);
		expect(msg.usage.output).toBe(0);
	} else if (llm.provider === "kimi-coding") {
		// Kimi reports input tokens early but output tokens only in the final chunk.
		// Kimi 提前上报输入 Token，但输出 Token 只在最终数据块出现。
		expect(msg.usage.input).toBeGreaterThan(0);
		expect(msg.usage.output).toBe(0);
	} else {
		expect(msg.usage.input).toBeGreaterThan(0);
		expect(msg.usage.output).toBeGreaterThan(0);

		// Some providers (Copilot) have zero cost rates
		// Copilot 等提供商的费用单价可能为零，此时不检查正费用。
		if (llm.cost.input > 0) {
			expect(msg.usage.cost.input).toBeGreaterThan(0);
			expect(msg.usage.cost.total).toBeGreaterThan(0);
		}
	}
}

describe("Token Statistics on Abort", () => {
	describe.skipIf(!process.env.GEMINI_API_KEY)("Google Provider", () => {
		/** Google 用量测试使用的 Gemini 模型。 */
		const llm = getModel("google", "gemini-2.5-flash");

		it("should include token stats when aborted mid-stream", { retry: 3, timeout: 30000 }, async () => {
			await testTokensOnAbort(llm, { thinking: { enabled: true } });
		});
	});

	describe.skipIf(!process.env.OPENAI_API_KEY)("OpenAI Completions Provider", () => {
		/** 去除 compat 元数据后的 OpenAI 基础模型。 */
		const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini")!;
		void _compat;
		/** 强制使用 Completions API 的模型定义。 */
		const llm: Model<"openai-completions"> = {
			...baseModel,
			api: "openai-completions",
		};

		it("should include token stats when aborted mid-stream", { retry: 3, timeout: 30000 }, async () => {
			await testTokensOnAbort(llm);
		});
	});

	describe.skipIf(!process.env.OPENAI_API_KEY)("OpenAI Responses Provider", () => {
		/** OpenAI Responses 用量测试使用的模型。 */
		const llm = getModel("openai", "gpt-5.4-mini");

		it("should include token stats when aborted mid-stream", { retry: 3, timeout: 30000 }, async () => {
			await testTokensOnAbort(llm, { reasoningEffort: "low" });
		});
	});

	describe.skipIf(!hasAzureOpenAICredentials())("Azure OpenAI Responses Provider", () => {
		/** Azure Responses 用量测试使用的模型。 */
		const llm = getModel("azure-openai-responses", "gpt-4o-mini");
		/** 从模型 ID 解析出的 Azure 部署名。 */
		const azureDeploymentName = resolveAzureDeploymentName(llm.id);
		/** 有部署名时传递的 Azure 专属选项。 */
		const azureOptions = azureDeploymentName ? { azureDeploymentName } : {};

		it("should include token stats when aborted mid-stream", { retry: 3, timeout: 30000 }, async () => {
			await testTokensOnAbort(llm, azureOptions);
		});
	});

	describe.skipIf(!process.env.ANTHROPIC_API_KEY)("Anthropic Provider", () => {
		/** Anthropic 用量测试使用的 Claude 模型。 */
		const llm = getModel("anthropic", "claude-sonnet-4-6");

		it("should include token stats when aborted mid-stream", { retry: 3, timeout: 30000 }, async () => {
			await testTokensOnAbort(llm);
		});
	});

	describe.skipIf(!process.env.XAI_API_KEY)("xAI Provider", () => {
		/** xAI 用量测试使用的 Grok 模型。 */
		const llm = getModel("xai", "grok-4.3");

		it("should include token stats when aborted mid-stream", { retry: 3, timeout: 30000 }, async () => {
			await testTokensOnAbort(llm);
		});
	});

	describe.skipIf(!process.env.GROQ_API_KEY)("Groq Provider", () => {
		/** Groq 用量测试使用的模型。 */
		const llm = getModel("groq", "openai/gpt-oss-20b");

		it("should include token stats when aborted mid-stream", { retry: 3, timeout: 30000 }, async () => {
			await testTokensOnAbort(llm);
		});
	});

	describe.skipIf(!process.env.CEREBRAS_API_KEY)("Cerebras Provider", () => {
		/** 按优先级选择 Cerebras 模型时使用的 ID 列表。 */
		const preferredCerebrasModelIds: string[] = ["gpt-oss-120b", "zai-glm-4.7", "llama3.1-8b"];
		/** 当前目录中的全部 Cerebras 模型。 */
		const cerebrasModels = getModels("cerebras");
		/** 首个优先模型，若都不存在则回退到目录首项。 */
		const llm = cerebrasModels.find((model) => preferredCerebrasModelIds.includes(model.id)) ?? cerebrasModels[0];

		it("should include token stats when aborted mid-stream", { retry: 3, timeout: 30000 }, async () => {
			if (!llm) {
				throw new Error("No Cerebras models available");
			}

			await testTokensOnAbort(llm);
		});
	});

	describe.skipIf(!hasCloudflareWorkersAICredentials())("Cloudflare Workers AI Provider", () => {
		/** Cloudflare Workers AI 用量测试使用的模型。 */
		const llm = getModel("cloudflare-workers-ai", "@cf/moonshotai/kimi-k2.6");

		it("should include token stats when aborted mid-stream", { retry: 3, timeout: 30000 }, async () => {
			await testTokensOnAbort(llm);
		});
	});

	describe.skipIf(!hasCloudflareAiGatewayCredentials())("Cloudflare AI Gateway Provider", () => {
		/** Cloudflare AI Gateway 用量测试使用的模型。 */
		const llm = getModel("cloudflare-ai-gateway", "workers-ai/@cf/moonshotai/kimi-k2.6");

		it("should include token stats when aborted mid-stream", { retry: 3, timeout: 30000 }, async () => {
			await testTokensOnAbort(llm);
		});
	});

	describe.skipIf(!process.env.HF_TOKEN)("Hugging Face Provider", () => {
		/** Hugging Face 用量测试使用的模型。 */
		const llm = getModel("huggingface", "moonshotai/Kimi-K2.5");

		it("should include token stats when aborted mid-stream", { retry: 3, timeout: 30000 }, async () => {
			await testTokensOnAbort(llm);
		});
	});

	describe.skipIf(!process.env.TOGETHER_API_KEY)("Together AI Provider", () => {
		/** Together AI 用量测试使用的模型。 */
		const llm = getModel("together", "moonshotai/Kimi-K2.6");

		it("should include token stats when aborted mid-stream", { retry: 3, timeout: 30000 }, async () => {
			await testTokensOnAbort(llm);
		});
	});

	describe.skipIf(!process.env.ZAI_API_KEY)("zAI Provider", () => {
		/** zAI 用量测试使用的模型。 */
		const llm = getModel("zai", "glm-4.5-air");

		it("should include token stats when aborted mid-stream", { retry: 3, timeout: 30000 }, async () => {
			await testTokensOnAbort(llm);
		});
	});

	describe.skipIf(!process.env.MISTRAL_API_KEY)("Mistral Provider", () => {
		/** Mistral 用量测试使用的模型。 */
		const llm = getModel("mistral", "devstral-medium-latest");

		it("should include token stats when aborted mid-stream", { retry: 3, timeout: 30000 }, async () => {
			await testTokensOnAbort(llm);
		});
	});

	describe.skipIf(!process.env.MINIMAX_API_KEY)("MiniMax Provider", () => {
		/** MiniMax 用量测试使用的模型。 */
		const llm = getModel("minimax", "MiniMax-M2.7");

		it("should include token stats when aborted mid-stream", { retry: 3, timeout: 30000 }, async () => {
			await testTokensOnAbort(llm);
		});
	});

	describe.skipIf(!process.env.KIMI_API_KEY)("Kimi For Coding Provider", () => {
		/** Kimi Coding 用量测试使用的模型。 */
		const llm = getModel("kimi-coding", "kimi-for-coding");

		it("should include token stats when aborted mid-stream", { retry: 3, timeout: 30000 }, async () => {
			await testTokensOnAbort(llm);
		});
	});

	describe.skipIf(!process.env.AI_GATEWAY_API_KEY)("Vercel AI Gateway Provider", () => {
		/** Vercel AI Gateway 用量测试使用的路由模型。 */
		const llm = getModel("vercel-ai-gateway", "google/gemini-2.5-flash");

		it("should include token stats when aborted mid-stream", { retry: 3, timeout: 30000 }, async () => {
			await testTokensOnAbort(llm);
		});
	});

	describe.skipIf(!process.env.XIAOMI_API_KEY)("Xiaomi MiMo (API billing) Provider", () => {
		/** 小米按量计费端点的模型；当前流式用量用例固定跳过。 */
		const llm = getModel("xiaomi", "mimo-v2.5-pro");

		// FIXME(xiaomi): Xiaomi's Anthropic-compatible stream does not populate
		// 待修复：小米的 Anthropic 兼容流不会填充早期 usage，
		// usage in the message_start event the way Anthropic does — usage only
		// 与 Anthropic 不同，usage 只会在 message_stop 到达，
		// arrives at message_stop. Aborting mid-stream therefore loses input/output
		// 因此中途停止会丢失输入和输出 Token，
		// token counts. Non-streaming usage works (see total-tokens.test.ts).
		// 但非流式用量正常，参见 total-tokens.test.ts。
		// Re-enable once upstream sends usage in message_start.
		// 待上游在 message_start 提供 usage 后重新启用。
		it.skip("should include token stats when aborted mid-stream", { retry: 3, timeout: 30000 }, async () => {
			await testTokensOnAbort(llm);
		});
	});

	describe.skipIf(!process.env.XIAOMI_TOKEN_PLAN_CN_API_KEY)("Xiaomi MiMo Token Plan (CN) Provider", () => {
		/** 小米中国区 Token 套餐模型；当前流式用量用例固定跳过。 */
		const llm = getModel("xiaomi-token-plan-cn", "mimo-v2.5-pro");

		// FIXME(xiaomi): see the API-billing block above — same upstream streaming
		// 待修复：参见上面的按量计费说明，同样受上游流式 usage 限制，
		// usage limitation applies to Token Plan endpoints.
		// Token 套餐端点也受此影响。
		it.skip("should include token stats when aborted mid-stream", { retry: 3, timeout: 30000 }, async () => {
			await testTokensOnAbort(llm);
		});
	});

	describe.skipIf(!process.env.XIAOMI_TOKEN_PLAN_AMS_API_KEY)("Xiaomi MiMo Token Plan (AMS) Provider", () => {
		/** 小米阿姆斯特丹 Token 套餐模型；当前用例固定跳过。 */
		const llm = getModel("xiaomi-token-plan-ams", "mimo-v2.5-pro");

		// FIXME(xiaomi): see the API-billing block above — same upstream streaming
		// 待修复：参见上面的按量计费说明，同样受上游流式 usage 限制，
		// usage limitation applies to Token Plan endpoints.
		// Token 套餐端点也受此影响。
		it.skip("should include token stats when aborted mid-stream", { retry: 3, timeout: 30000 }, async () => {
			await testTokensOnAbort(llm);
		});
	});

	describe.skipIf(!process.env.XIAOMI_TOKEN_PLAN_SGP_API_KEY)("Xiaomi MiMo Token Plan (SGP) Provider", () => {
		/** 小米新加坡 Token 套餐模型；当前用例固定跳过。 */
		const llm = getModel("xiaomi-token-plan-sgp", "mimo-v2.5-pro");

		// FIXME(xiaomi): see the API-billing block above — same upstream streaming
		// 待修复：参见上面的按量计费说明，同样受上游流式 usage 限制，
		// usage limitation applies to Token Plan endpoints.
		// Token 套餐端点也受此影响。
		it.skip("should include token stats when aborted mid-stream", { retry: 3, timeout: 30000 }, async () => {
			await testTokensOnAbort(llm);
		});
	});

	describe.skipIf(!process.env.QWEN_TOKEN_PLAN_API_KEY)("Qwen Token Plan Provider", () => {
		/** Qwen 国际 Token 套餐用量测试使用的模型。 */
		const llm = getModel("qwen-token-plan", "qwen3.7-max");

		it("should include token stats when aborted mid-stream", { retry: 3, timeout: 30000 }, async () => {
			await testTokensOnAbort(llm);
		});
	});

	describe.skipIf(!process.env.QWEN_TOKEN_PLAN_CN_API_KEY)("Qwen Token Plan (CN) Provider", () => {
		/** Qwen 中国区 Token 套餐用量测试使用的模型。 */
		const llm = getModel("qwen-token-plan-cn", "qwen3.7-max");

		it("should include token stats when aborted mid-stream", { retry: 3, timeout: 30000 }, async () => {
			await testTokensOnAbort(llm);
		});
	});

	// =========================================================================
	// 以下是从本地 OAuth 文件读取凭据的提供商矩阵。
	// OAuth-based providers (credentials from ~/.pi/agent/oauth.json)
	// OAuth 凭据来自 ~/.pi/agent/oauth.json。
	// =========================================================================

	describe("Anthropic OAuth Provider", () => {
		/** Anthropic OAuth 用量测试使用的模型。 */
		const llm = getModel("anthropic", "claude-sonnet-4-6");

		it.skipIf(!anthropicOAuthToken)(
			"should include token stats when aborted mid-stream",
			{ retry: 3, timeout: 30000 },
			async () => {
				await testTokensOnAbort(llm, { apiKey: anthropicOAuthToken });
			},
		);
	});

	describe("GitHub Copilot Provider", () => {
		it.skipIf(!githubCopilotToken)(
			"claude-haiku-4.5 - should include token stats when aborted mid-stream",
			{ retry: 3, timeout: 30000 },
			async () => {
				/** GitHub Copilot Haiku 用量测试使用的模型。 */
				const llm = getModel("github-copilot", "claude-haiku-4.5");
				await testTokensOnAbort(llm, { apiKey: githubCopilotToken });
			},
		);

		it.skipIf(!githubCopilotToken)(
			"claude-sonnet-4 - should include token stats when aborted mid-stream",
			{ retry: 3, timeout: 30000 },
			async () => {
				/** GitHub Copilot Sonnet 用量测试使用的模型。 */
				const llm = getModel("github-copilot", "claude-sonnet-4.6");
				await testTokensOnAbort(llm, { apiKey: githubCopilotToken });
			},
		);
	});

	describe("OpenAI Codex Provider", () => {
		it.skipIf(!openaiCodexToken)(
			"gpt-5.5 - should include token stats when aborted mid-stream",
			{ retry: 3, timeout: 30000 },
			async () => {
				/** OpenAI Codex OAuth 用量测试使用的模型。 */
				const llm = getModel("openai-codex", "gpt-5.5");
				await testTokensOnAbort(llm, { apiKey: openaiCodexToken });
			},
		);
	});

	describe.skipIf(!hasBedrockCredentials())("Amazon Bedrock Provider", () => {
		/** Amazon Bedrock 用量测试使用的 Claude 模型。 */
		const llm = getModel("amazon-bedrock", "global.anthropic.claude-sonnet-4-5-20250929-v1:0");

		it("should include token stats when aborted mid-stream", { retry: 3, timeout: 30000 }, async () => {
			await testTokensOnAbort(llm);
		});
	});
});
/**
 * 文件职责：跨提供商验证流式请求被中止后，助手消息中的 Token 与费用统计符合各协议实际能力。
 * 技术维度：使用 Vitest 条件跳过、AbortController、异步事件迭代和 API Key/OAuth 提供商矩阵执行在线契约测试。
 * 产品维度：保障用户中止长输出后，界面和费用统计不会显示错误用量，同时兼容只在终块返回 usage 的服务。
 * 逻辑维度：共享函数在累计 1000 字符后中止并按 API/提供商分支断言，再对每个有凭据模型重复执行。
 * 关键边界：用例依赖真实网络与密钥；不同提供商上报时机不同；小米流式 usage 已知缺失，因此相关用例固定跳过。
 * 新手阅读建议：先看 testTokensOnAbort 的三类断言分支，再浏览 API Key 矩阵，最后阅读 OAuth 与已知限制说明。
 */
