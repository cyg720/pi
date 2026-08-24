/**
 * 文件职责：跨提供商验证 Usage.totalTokens 等于输入、输出、缓存读取与缓存写入令牌之和。
 * 技术维度：使用 Vitest、统一 complete 接口和长系统提示触发缓存，按凭据条件执行在线集成测试。
 * 产品维度：保证上层用 totalTokens 计算下一轮上下文大小时不会因提供商差异得到错误结果。
 * 逻辑维度：先构造两轮共享提示的缓存请求，再记录并断言 usage，随后对各提供商重复执行。
 * 关键边界：用例依赖真实密钥、网络和提供商缓存策略；缓存活动只对明确支持的 Anthropic 场景强制要求。
 * 新手阅读建议：先读 testTotalTokensWithCache 和断言辅助函数，再选一个提供商分组，最后比较 OAuth 与网关场景。
 */
/**
 * Test totalTokens field across all providers.
 *
 * totalTokens represents the total number of tokens processed by the LLM,
 * including input (with cache) and output (with thinking). This is the
 * base for calculating context size for the next request.
 *
 * - OpenAI Completions: Uses native total_tokens field
 * - OpenAI Responses: Uses native total_tokens field
 * - Google: Uses native totalTokenCount field
 * - Anthropic: Computed as input + output + cacheRead + cacheWrite
 * - Other OpenAI-compatible providers: Uses native total_tokens field
 */
// 中文说明：上方英文注释给出本段功能、前提或边界，下面代码按该说明执行。

import { describe, expect, it } from "vitest";
import { complete, getModel } from "../src/compat.ts";
import type { Api, Context, Model, StreamOptions, Usage } from "../src/types.ts";

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

// Generate a long system prompt to trigger caching (>2k bytes for most providers)
// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
const LONG_SYSTEM_PROMPT = `You are a helpful assistant. Be concise in your responses.

Here is some additional context that makes this system prompt long enough to trigger caching:

${Array(50)
	.fill(
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
	)
	.join("\n\n")}

Remember: Always be helpful and concise.`;

async function testTotalTokensWithCache<TApi extends Api>(
	llm: Model<TApi>,
	options: StreamOptionsWithExtras = {},
): Promise<{ first: Usage; second: Usage }> {
	// First request - no cache
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
	const context1: Context = {
		systemPrompt: LONG_SYSTEM_PROMPT,
		messages: [
			{
				role: "user",
				content: "What is 2 + 2? Reply with just the number.",
				timestamp: Date.now(),
			},
		],
	};

	/** 常量 response1 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const response1 = await complete(llm, context1, options);
	expect(response1.stopReason).toBe("stop");

	// Second request - should trigger cache read (same system prompt, add conversation)
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
	const context2: Context = {
		systemPrompt: LONG_SYSTEM_PROMPT,
		messages: [
			...context1.messages,
			response1, // Include previous assistant response
			{
				role: "user",
				content: "What is 3 + 3? Reply with just the number.",
				timestamp: Date.now(),
			},
		],
	};

	/** 常量 response2 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const response2 = await complete(llm, context2, options);
	expect(response2.stopReason).toBe("stop");

	return { first: response1.usage, second: response2.usage };
}

/** logUsage 执行当前测试辅助步骤；参数 label、usage 按签名提供输入，返回值供调用方断言。示例：logUsage(..., ...)。 */
function logUsage(label: string, usage: Usage) {
	/** 常量 computed 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const computed = usage.input + usage.output + usage.cacheRead + usage.cacheWrite;
	console.log(`  ${label}:`);
	console.log(
		`    input: ${usage.input}, output: ${usage.output}, cacheRead: ${usage.cacheRead}, cacheWrite: ${usage.cacheWrite}`,
	);
	console.log(`    totalTokens: ${usage.totalTokens}, computed: ${computed}`);
}

/** assertTotalTokensEqualsComponents 执行当前测试辅助步骤；参数 usage 按签名提供输入，返回值供调用方断言。示例：assertTotalTokensEqualsComponents(...)。 */
function assertTotalTokensEqualsComponents(usage: Usage) {
	/** 常量 computed 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const computed = usage.input + usage.output + usage.cacheRead + usage.cacheWrite;
	expect(usage.totalTokens).toBe(computed);
}

// 用例分组：集中验证“totalTokens field”相关功能。
describe("totalTokens field", () => {
	// =========================================================================
	// Anthropic
	// =========================================================================
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

	describe.skipIf(!process.env.ANTHROPIC_API_KEY)("Anthropic (API Key)", () => {
		it(
			"claude-sonnet-4-5 - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("anthropic", "claude-sonnet-4-5");

				console.log(`\nAnthropic / ${llm.id}:`);
				/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: process.env.ANTHROPIC_API_KEY });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);

				// Anthropic should have cache activity
				// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
				const hasCache = second.cacheRead > 0 || second.cacheWrite > 0 || first.cacheWrite > 0;
				expect(hasCache).toBe(true);
			},
		);
	});

	// 用例分组：集中验证“Anthropic (OAuth)”相关功能。
	describe("Anthropic (OAuth)", () => {
		it.skipIf(!anthropicOAuthToken)(
			"claude-sonnet-4 - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("anthropic", "claude-sonnet-4-6");

				console.log(`\nAnthropic OAuth / ${llm.id}:`);
				/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: anthropicOAuthToken });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);

				// Anthropic should have cache activity
				// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
				const hasCache = second.cacheRead > 0 || second.cacheWrite > 0 || first.cacheWrite > 0;
				expect(hasCache).toBe(true);
			},
		);
	});

	// =========================================================================
	// OpenAI
	// =========================================================================
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

	describe.skipIf(!process.env.OPENAI_API_KEY)("OpenAI Completions", () => {
		it(
			"gpt-4o-mini - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				/** 常量 { compat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini")!;
				void _compat;
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm: Model<"openai-completions"> = {
					...baseModel,
					api: "openai-completions",
				};

				console.log(`\nOpenAI Completions / ${llm.id}:`);
				/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const { first, second } = await testTotalTokensWithCache(llm);

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	describe.skipIf(!process.env.OPENAI_API_KEY)("OpenAI Responses", () => {
		it(
			"claude-haiku-4.5 - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("openai", "gpt-4o");

				console.log(`\nOpenAI Responses / ${llm.id}:`);
				/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const { first, second } = await testTotalTokensWithCache(llm);

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	describe.skipIf(!hasAzureOpenAICredentials())("Azure OpenAI Responses", () => {
		it(
			"gpt-4o-mini - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("azure-openai-responses", "gpt-4o-mini");
				/** 常量 azureDeploymentName 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const azureDeploymentName = resolveAzureDeploymentName(llm.id);
				/** 常量 azureOptions 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const azureOptions = azureDeploymentName ? { azureDeploymentName } : {};

				console.log(`\nAzure OpenAI Responses / ${llm.id}:`);
				/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const { first, second } = await testTotalTokensWithCache(llm, azureOptions);

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// Google
	// =========================================================================
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

	describe.skipIf(!process.env.GEMINI_API_KEY)("Google", () => {
		it(
			"gemini-2.0-flash - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("google", "gemini-2.0-flash");

				console.log(`\nGoogle / ${llm.id}:`);
				/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const { first, second } = await testTotalTokensWithCache(llm);

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// xAI
	// =========================================================================
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

	describe.skipIf(!process.env.XAI_API_KEY)("xAI", () => {
		// 测试场景：验证“grok-4.3 - should return totalTokens equal to sum of components”对应的行为、结果与边界。
		it("grok-4.3 - should return totalTokens equal to sum of components", { retry: 3, timeout: 60000 }, async () => {
			/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const llm = getModel("xai", "grok-4.3");

			console.log(`\nxAI / ${llm.id}:`);
			/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const { first, second } = await testTotalTokensWithCache(llm, { apiKey: process.env.XAI_API_KEY });

			logUsage("First request", first);
			logUsage("Second request", second);

			assertTotalTokensEqualsComponents(first);
			assertTotalTokensEqualsComponents(second);
		});
	});

	// =========================================================================
	// Groq
	// =========================================================================
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

	describe.skipIf(!process.env.GROQ_API_KEY)("Groq", () => {
		it(
			"openai/gpt-oss-120b - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("groq", "openai/gpt-oss-120b");

				console.log(`\nGroq / ${llm.id}:`);
				/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: process.env.GROQ_API_KEY });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// Cerebras
	// =========================================================================
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

	describe.skipIf(!process.env.CEREBRAS_API_KEY)("Cerebras", () => {
		it(
			"gpt-oss-120b - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("cerebras", "gpt-oss-120b");

				console.log(`\nCerebras / ${llm.id}:`);
				/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: process.env.CEREBRAS_API_KEY });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// Cloudflare Workers AI
	// =========================================================================
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

	describe.skipIf(!hasCloudflareWorkersAICredentials())("Cloudflare Workers AI", () => {
		it(
			"@cf/moonshotai/kimi-k2.6 - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("cloudflare-workers-ai", "@cf/moonshotai/kimi-k2.6");

				console.log(`\nCloudflare Workers AI / ${llm.id}:`);
				/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const { first, second } = await testTotalTokensWithCache(llm, {
					apiKey: process.env.CLOUDFLARE_API_KEY,
				});

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// Cloudflare AI Gateway
	// =========================================================================
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

	describe.skipIf(!hasCloudflareAiGatewayCredentials())("Cloudflare AI Gateway", () => {
		it(
			"workers-ai/@cf/moonshotai/kimi-k2.6 - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("cloudflare-ai-gateway", "workers-ai/@cf/moonshotai/kimi-k2.6");

				console.log(`\nCloudflare AI Gateway / ${llm.id}:`);
				/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const { first, second } = await testTotalTokensWithCache(llm, {
					apiKey: process.env.CLOUDFLARE_API_KEY,
				});

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// Hugging Face
	// =========================================================================
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

	describe.skipIf(!process.env.HF_TOKEN)("Hugging Face", () => {
		// 测试场景：验证“Kimi-K2.5 - should return totalTokens equal to sum of components”对应的行为、结果与边界。
		it("Kimi-K2.5 - should return totalTokens equal to sum of components", { retry: 3, timeout: 60000 }, async () => {
			/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const llm = getModel("huggingface", "moonshotai/Kimi-K2.5");

			console.log(`\nHugging Face / ${llm.id}:`);
			/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const { first, second } = await testTotalTokensWithCache(llm, { apiKey: process.env.HF_TOKEN });

			logUsage("First request", first);
			logUsage("Second request", second);

			assertTotalTokensEqualsComponents(first);
			assertTotalTokensEqualsComponents(second);
		});
	});

	// =========================================================================
	// Together AI
	// =========================================================================
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

	describe.skipIf(!process.env.TOGETHER_API_KEY)("Together AI", () => {
		// 测试场景：验证“Kimi-K2.6 - should return totalTokens equal to sum of components”对应的行为、结果与边界。
		it("Kimi-K2.6 - should return totalTokens equal to sum of components", { retry: 3, timeout: 60000 }, async () => {
			/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const llm = getModel("together", "moonshotai/Kimi-K2.6");

			console.log(`\nTogether AI / ${llm.id}:`);
			/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const { first, second } = await testTotalTokensWithCache(llm, {
				apiKey: process.env.TOGETHER_API_KEY,
				reasoningEffort: "high",
			});

			logUsage("First request", first);
			logUsage("Second request", second);

			assertTotalTokensEqualsComponents(first);
			assertTotalTokensEqualsComponents(second);
		});
	});

	// =========================================================================
	// z.ai
	// =========================================================================
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

	describe.skipIf(!process.env.ZAI_API_KEY)("z.ai", () => {
		it(
			"glm-4.5-air - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("zai", "glm-4.5-air");

				console.log(`\nz.ai / ${llm.id}:`);
				/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: process.env.ZAI_API_KEY });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// Mistral
	// =========================================================================
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

	describe.skipIf(!process.env.MISTRAL_API_KEY)("Mistral", () => {
		it(
			"devstral-medium-latest - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("mistral", "devstral-medium-latest");

				console.log(`\nMistral / ${llm.id}:`);
				/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: process.env.MISTRAL_API_KEY });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// MiniMax
	// =========================================================================
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

	describe.skipIf(!process.env.MINIMAX_API_KEY)("MiniMax", () => {
		it(
			"MiniMax-M2.7 - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("minimax", "MiniMax-M2.7");

				console.log(`\nMiniMax / ${llm.id}:`);
				/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: process.env.MINIMAX_API_KEY });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// Xiaomi MiMo
	// =========================================================================
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

	describe.skipIf(!process.env.XIAOMI_API_KEY)("Xiaomi MiMo (API billing)", () => {
		it(
			"mimo-v2.5-pro - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("xiaomi", "mimo-v2.5-pro");

				console.log(`\nXiaomi MiMo / ${llm.id}:`);
				/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: process.env.XIAOMI_API_KEY });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// Xiaomi MiMo Token Plan CN
	// =========================================================================
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

	describe.skipIf(!process.env.XIAOMI_TOKEN_PLAN_CN_API_KEY)("Xiaomi MiMo Token Plan (CN)", () => {
		it(
			"mimo-v2.5-pro - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("xiaomi-token-plan-cn", "mimo-v2.5-pro");

				console.log(`\nXiaomi MiMo Token Plan CN / ${llm.id}:`);
				/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const { first, second } = await testTotalTokensWithCache(llm, {
					apiKey: process.env.XIAOMI_TOKEN_PLAN_CN_API_KEY,
				});

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// Xiaomi MiMo Token Plan AMS
	// =========================================================================
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

	describe.skipIf(!process.env.XIAOMI_TOKEN_PLAN_AMS_API_KEY)("Xiaomi MiMo Token Plan (AMS)", () => {
		it(
			"mimo-v2.5-pro - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("xiaomi-token-plan-ams", "mimo-v2.5-pro");

				console.log(`\nXiaomi MiMo Token Plan AMS / ${llm.id}:`);
				/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const { first, second } = await testTotalTokensWithCache(llm, {
					apiKey: process.env.XIAOMI_TOKEN_PLAN_AMS_API_KEY,
				});

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// Xiaomi MiMo Token Plan SGP
	// =========================================================================
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

	describe.skipIf(!process.env.XIAOMI_TOKEN_PLAN_SGP_API_KEY)("Xiaomi MiMo Token Plan (SGP)", () => {
		it(
			"mimo-v2.5-pro - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("xiaomi-token-plan-sgp", "mimo-v2.5-pro");

				console.log(`\nXiaomi MiMo Token Plan SGP / ${llm.id}:`);
				/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const { first, second } = await testTotalTokensWithCache(llm, {
					apiKey: process.env.XIAOMI_TOKEN_PLAN_SGP_API_KEY,
				});

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// Qwen Token Plan
	// =========================================================================
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

	describe.skipIf(!process.env.QWEN_TOKEN_PLAN_API_KEY)("Qwen Token Plan", () => {
		it(
			"qwen3.7-max - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("qwen-token-plan", "qwen3.7-max");

				console.log(`\nQwen Token Plan / ${llm.id}:`);
				/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const { first, second } = await testTotalTokensWithCache(llm, {
					apiKey: process.env.QWEN_TOKEN_PLAN_API_KEY,
				});

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// Qwen Token Plan CN
	// =========================================================================
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

	describe.skipIf(!process.env.QWEN_TOKEN_PLAN_CN_API_KEY)("Qwen Token Plan (CN)", () => {
		it(
			"qwen3.7-max - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("qwen-token-plan-cn", "qwen3.7-max");

				console.log(`\nQwen Token Plan CN / ${llm.id}:`);
				/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const { first, second } = await testTotalTokensWithCache(llm, {
					apiKey: process.env.QWEN_TOKEN_PLAN_CN_API_KEY,
				});

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// Kimi For Coding
	// =========================================================================
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

	describe.skipIf(!process.env.KIMI_API_KEY)("Kimi For Coding", () => {
		it(
			"kimi-for-coding - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("kimi-coding", "kimi-for-coding");

				console.log(`\nKimi For Coding / ${llm.id}:`);
				/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: process.env.KIMI_API_KEY });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// Vercel AI Gateway
	// =========================================================================
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

	describe.skipIf(!process.env.AI_GATEWAY_API_KEY)("Vercel AI Gateway", () => {
		it(
			"google/gemini-2.5-flash - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("vercel-ai-gateway", "google/gemini-2.5-flash");

				console.log(`\nVercel AI Gateway / ${llm.id}:`);
				/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: process.env.AI_GATEWAY_API_KEY });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// OpenRouter - Multiple backend providers
	// =========================================================================
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

	describe.skipIf(!process.env.OPENROUTER_API_KEY)("OpenRouter", () => {
		it(
			"anthropic/claude-sonnet-4 - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("openrouter", "anthropic/claude-sonnet-4");

				console.log(`\nOpenRouter / ${llm.id}:`);
				/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: process.env.OPENROUTER_API_KEY });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);

		it(
			"deepseek/deepseek-chat - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("openrouter", "deepseek/deepseek-chat");

				console.log(`\nOpenRouter / ${llm.id}:`);
				/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: process.env.OPENROUTER_API_KEY });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);

		it(
			"mistralai/mistral-small-3.2-24b-instruct - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("openrouter", "mistralai/mistral-small-3.2-24b-instruct");

				console.log(`\nOpenRouter / ${llm.id}:`);
				/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: process.env.OPENROUTER_API_KEY });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);

		it(
			"google/gemini-2.5-flash - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("openrouter", "google/gemini-2.5-flash");

				console.log(`\nOpenRouter / ${llm.id}:`);
				/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: process.env.OPENROUTER_API_KEY });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);

		it(
			"deepseek/deepseek-chat - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("openrouter", "deepseek/deepseek-chat");

				console.log(`\nOpenRouter / ${llm.id}:`);
				/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: process.env.OPENROUTER_API_KEY });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// GitHub Copilot (OAuth)
	// =========================================================================
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

	// 用例分组：集中验证“GitHub Copilot (OAuth)”相关功能。
	describe("GitHub Copilot (OAuth)", () => {
		it.skipIf(!githubCopilotToken)(
			"claude-haiku-4.5 - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("github-copilot", "claude-haiku-4.5");

				console.log(`\nGitHub Copilot / ${llm.id}:`);
				/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: githubCopilotToken });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);

		it.skipIf(!githubCopilotToken)(
			"claude-sonnet-4 - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("github-copilot", "claude-sonnet-4.6");

				console.log(`\nGitHub Copilot / ${llm.id}:`);
				/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: githubCopilotToken });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// =========================================================================
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

	// =========================================================================
	// =========================================================================
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

	describe.skipIf(!hasBedrockCredentials())("Amazon Bedrock", () => {
		it(
			"claude-sonnet-4-5 - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("amazon-bedrock", "global.anthropic.claude-sonnet-4-5-20250929-v1:0");

				console.log(`\nAmazon Bedrock / ${llm.id}:`);
				/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const { first, second } = await testTotalTokensWithCache(llm);

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// OpenAI Codex (OAuth)
	// =========================================================================
	// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

	// 用例分组：集中验证“OpenAI Codex (OAuth)”相关功能。
	describe("OpenAI Codex (OAuth)", () => {
		it.skipIf(!openaiCodexToken)(
			"gpt-5.5 - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				/** 常量 llm 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const llm = getModel("openai-codex", "gpt-5.5");

				console.log(`\nOpenAI Codex / ${llm.id}:`);
				/** 常量 { first, second } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: openaiCodexToken });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});
});
