/**
 * Test context overflow error handling across providers.
 *
 * Context overflow occurs when the input (prompt + history) exceeds
 * the model's context window. This is different from output token limits.
 *
 * Expected behavior: All providers should return stopReason: "error"
 * with an errorMessage that indicates the context was too large,
 * OR (for z.ai) return successfully with usage.input > contextWindow.
 *
 * The isContextOverflow() function must return true for all providers.
 */
/**
 * 文件职责：跨提供商验证输入超过模型上下文窗口时的错误归一化与 isContextOverflow 检测。
 * 技术维度：使用 Vitest 调用真实或本地模型接口，并按环境凭据动态跳过不可运行的集成测试。
 * 产品维度：确保超长会话能被统一识别，从而让上层触发压缩或向用户提供明确错误。
 * 逻辑维度：先生成超长文本和统一结果结构，再按提供商验证错误形式，最后覆盖 Ollama、LM Studio 与 llama.cpp。
 * 关键边界：多数用例依赖真实密钥、网络和服务端错误文案；本地模型还依赖已安装进程及端口状态。
 * 新手阅读建议：先看 generateOverflowContent 与 testContextOverflow，再选一个云提供商用例，最后读本地服务探测。
 */

import type { ChildProcess } from "child_process";
import { execSync, spawn } from "child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { complete, getModel, getModels } from "../src/compat.ts";
import type { AssistantMessage, Context, Model, Usage } from "../src/types.ts";
import { isContextOverflow } from "../src/utils/overflow.ts";
import { hasAzureOpenAICredentials } from "./azure-utils.ts";
import { hasBedrockCredentials } from "./bedrock-utils.ts";
import { resolveApiKey } from "./oauth.ts";

// Resolve OAuth tokens at module level (async, runs before tests)
// 在模块初始化阶段并行解析 OAuth 令牌，使相关用例可据令牌是否存在决定跳过。
const oauthTokens = await Promise.all([resolveApiKey("github-copilot"), resolveApiKey("openai-codex")]);
/** 常量 [githubCopilotToken, openaiCodexToken] 保存令牌或用量数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
const [githubCopilotToken, openaiCodexToken] = oauthTokens;

// Lorem ipsum paragraph for realistic token estimation
// 使用内容变化较多的示例段落，使令牌数量估算更接近真实输入。
const LOREM_IPSUM = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. `;

// Generate a string that will exceed the context window
// Using chars/4 as token estimate (works better with varied text than repeated chars)
// 生成长度明确超过上下文窗口的字符串，用于稳定触发溢出场景。
function generateOverflowContent(contextWindow: number): string {
	/** 常量 targetTokens 保存令牌或用量数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const targetTokens = contextWindow + 10000; // Exceed by 10k tokens
	/** 常量 targetChars 保存“targetChars”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const targetChars = targetTokens * 4 * 1.5;
	/** 常量 repetitions 保存“repetitions”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const repetitions = Math.ceil(targetChars / LOREM_IPSUM.length);
	return LOREM_IPSUM.repeat(repetitions);
}

/** OverflowResult 描述当前测试步骤返回的结构化数据及字段约束。 */
interface OverflowResult {
	provider: string;
	model: string;
	contextWindow: number;
	stopReason: string;
	errorMessage: string | undefined;
	usage: Usage;
	hasUsageData: boolean;
	response: AssistantMessage;
}

/** 执行并收集 testContextOverflow 对应步骤；参数 model、apiKey 按签名提供所需输入；返回值供调用方继续执行或断言。示例：testContextOverflow(..., ...)。 */
async function testContextOverflow(model: Model<any>, apiKey: string): Promise<OverflowResult> {
	/** 常量 overflowContent 保存当前场景使用或生成的文本；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const overflowContent = generateOverflowContent(model.contextWindow);

	/** 常量 context 保存本次请求或会话的上下文；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const context: Context = {
		systemPrompt: "You are a helpful assistant.",
		messages: [
			{
				role: "user",
				content: overflowContent,
				timestamp: Date.now(),
			},
		],
	};

	/** 常量 response 保存当前调用返回的响应；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const response = await complete(model, context, { apiKey });

	/** 常量 hasUsageData 保存令牌或用量数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const hasUsageData = response.usage.input > 0 || response.usage.cacheRead > 0;

	return {
		provider: model.provider,
		model: model.id,
		contextWindow: model.contextWindow,
		stopReason: response.stopReason,
		errorMessage: response.errorMessage,
		usage: response.usage,
		hasUsageData,
		response,
	};
}

/** 输出 logResult 对应步骤；参数 result 按签名提供所需输入；返回值供调用方继续执行或断言。示例：logResult(...)。 */
function logResult(result: OverflowResult) {
	console.log(`\n${result.provider} / ${result.model}:`);
	console.log(`  contextWindow: ${result.contextWindow}`);
	console.log(`  stopReason: ${result.stopReason}`);
	console.log(`  errorMessage: ${result.errorMessage}`);
	console.log(`  usage: ${JSON.stringify(result.usage)}`);
	console.log(`  hasUsageData: ${result.hasUsageData}`);
}

// =============================================================================
// Anthropic
// Expected pattern: "prompt is too long: X tokens > Y maximum"
// =============================================================================
// 上方记录该提供商预期的错误文案，下面的正则断言据此判断。

// 用例分组：集中验证“Context overflow error handling”相关功能。
describe("Context overflow error handling", () => {
	describe.skipIf(!process.env.ANTHROPIC_API_KEY)("Anthropic (API Key)", () => {
		// 测试场景：验证“claude-haiku-4-5 - should detect overflow via isContextOverflow”对应的行为、返回值与边界条件。
		it("claude-haiku-4-5 - should detect overflow via isContextOverflow", async () => {
			/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const model = getModel("anthropic", "claude-haiku-4-5");
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = await testContextOverflow(model, process.env.ANTHROPIC_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(result.errorMessage).toMatch(/prompt is too long/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	describe.skipIf(!process.env.ANTHROPIC_OAUTH_TOKEN)("Anthropic (OAuth)", () => {
		// 测试场景：验证“claude-sonnet-4 - should detect overflow via isContextOverflow”对应的行为、返回值与边界条件。
		it("claude-sonnet-4 - should detect overflow via isContextOverflow", async () => {
			/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const model = getModel("anthropic", "claude-sonnet-4-6");
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = await testContextOverflow(model, process.env.ANTHROPIC_OAUTH_TOKEN!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(result.errorMessage).toMatch(/prompt is too long/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	// =============================================================================
	// GitHub Copilot (OAuth)
	// Tests both Google and Anthropic models via Copilot
	// =============================================================================
	// 通过同一入口覆盖 Google 与 Anthropic 两类后端模型。

	// 用例分组：集中验证“GitHub Copilot (OAuth)”相关功能。
	describe("GitHub Copilot (OAuth)", () => {
		// Google model via Copilot
		// 通过 Copilot 路由 Google 模型，验证其溢出错误可被统一识别。
		it.skipIf(!githubCopilotToken)(
			"gemini-2.5-pro - should detect overflow via isContextOverflow",
			async () => {
				/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
				const model = getModel("github-copilot", "gemini-2.5-pro");
				/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
				const result = await testContextOverflow(model, githubCopilotToken!);
				logResult(result);

				expect(result.stopReason).toBe("error");
				expect(result.errorMessage).toMatch(/exceeds the limit of \d+/i);
				expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
			},
			120000,
		);

		// Anthropic model via Copilot
		// 通过 Copilot 路由 Anthropic 模型，验证其溢出错误可被统一识别。
		it.skipIf(!githubCopilotToken)(
			"claude-sonnet-4 - should detect overflow via isContextOverflow",
			async () => {
				/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
				const model = getModel("github-copilot", "claude-sonnet-4.6");
				/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
				const result = await testContextOverflow(model, githubCopilotToken!);
				logResult(result);

				expect(result.stopReason).toBe("error");
				expect(result.errorMessage).toMatch(/exceeds the limit of \d+|input is too long/i);
				expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
			},
			120000,
		);
	});

	// =============================================================================
	// OpenAI
	// Expected pattern: "exceeds the context window"
	// =============================================================================
	// 上方记录该提供商预期的错误文案，下面的正则断言据此判断。

	describe.skipIf(!process.env.OPENAI_API_KEY)("OpenAI Completions", () => {
		// 测试场景：验证“gpt-4o-mini - should detect overflow via isContextOverflow”对应的行为、返回值与边界条件。
		it("gpt-4o-mini - should detect overflow via isContextOverflow", async () => {
			/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const model = { ...getModel("openai", "gpt-4o-mini") };
			model.api = "openai-completions" as any;
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = await testContextOverflow(model, process.env.OPENAI_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(result.errorMessage).toMatch(/maximum context length/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	describe.skipIf(!process.env.OPENAI_API_KEY)("OpenAI Responses", () => {
		// 测试场景：验证“gpt-4o - should detect overflow via isContextOverflow”对应的行为、返回值与边界条件。
		it("gpt-4o - should detect overflow via isContextOverflow", async () => {
			/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const model = getModel("openai", "gpt-4o");
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = await testContextOverflow(model, process.env.OPENAI_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(result.errorMessage).toMatch(/exceeds the context window/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	describe.skipIf(!hasAzureOpenAICredentials())("Azure OpenAI Responses", () => {
		// 测试场景：验证“gpt-4o-mini - should detect overflow via isContextOverflow”对应的行为、返回值与边界条件。
		it("gpt-4o-mini - should detect overflow via isContextOverflow", async () => {
			/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const model = getModel("azure-openai-responses", "gpt-4o-mini");
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = await testContextOverflow(model, process.env.AZURE_OPENAI_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(result.errorMessage).toMatch(/context|maximum/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	// =============================================================================
	// Google
	// Expected pattern: "input token count (X) exceeds the maximum"
	// =============================================================================
	// 上方记录该提供商预期的错误文案，下面的正则断言据此判断。

	describe.skipIf(!process.env.GEMINI_API_KEY)("Google", () => {
		// 测试场景：验证“gemini-2.0-flash - should detect overflow via isContextOverflow”对应的行为、返回值与边界条件。
		it("gemini-2.0-flash - should detect overflow via isContextOverflow", async () => {
			/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const model = getModel("google", "gemini-2.0-flash");
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = await testContextOverflow(model, process.env.GEMINI_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(result.errorMessage).toMatch(/input token count.*exceeds the maximum/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	// =============================================================================
	// Uses same API as Google, expects same error pattern
	// =============================================================================
	// 该提供商复用 Google API，预期返回相同形式的溢出错误。

	// =============================================================================
	// =============================================================================
	// 中文说明：上方英文注释描述“=======================================================”相关前提、步骤或边界；下面代码按该说明执行。

	// =============================================================================
	// OpenAI Codex (OAuth)
	// Uses ChatGPT Plus/Pro subscription via OAuth
	// =============================================================================
	// 通过 OAuth 使用订阅凭据，不读取普通 OpenAI API Key。

	// 用例分组：集中验证“OpenAI Codex (OAuth)”相关功能。
	describe("OpenAI Codex (OAuth)", () => {
		it.skipIf(!openaiCodexToken)(
			"gpt-5.5 - should detect overflow via isContextOverflow",
			async () => {
				/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
				const model = getModel("openai-codex", "gpt-5.5");
				/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
				const result = await testContextOverflow(model, openaiCodexToken!);
				logResult(result);

				expect(result.stopReason).toBe("error");
				expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
			},
			120000,
		);
	});

	// =============================================================================
	// Amazon Bedrock
	// Expected pattern: "Input is too long for requested model"
	// =============================================================================
	// 上方记录该提供商预期的错误文案，下面的正则断言据此判断。

	describe.skipIf(!hasBedrockCredentials())("Amazon Bedrock", () => {
		// 测试场景：验证“claude-sonnet-4-5 - should detect overflow via isContextOverflow”对应的行为、返回值与边界条件。
		it("claude-sonnet-4-5 - should detect overflow via isContextOverflow", async () => {
			/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const model = getModel("amazon-bedrock", "global.anthropic.claude-sonnet-4-5-20250929-v1:0");
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = await testContextOverflow(model, "");
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	// =============================================================================
	// xAI
	// Expected pattern: "maximum prompt length is X but the request contains Y"
	// =============================================================================
	// 上方记录该提供商预期的错误文案，下面的正则断言据此判断。

	describe.skipIf(!process.env.XAI_API_KEY)("xAI", () => {
		// 测试场景：验证“grok-4.3 - should detect overflow via isContextOverflow”对应的行为、返回值与边界条件。
		it("grok-4.3 - should detect overflow via isContextOverflow", async () => {
			/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const model = getModel("xai", "grok-4.3");
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = await testContextOverflow(model, process.env.XAI_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(result.errorMessage).toMatch(/maximum prompt length is \d+/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	// =============================================================================
	// Groq
	// Expected pattern: "reduce the length of the messages"
	// =============================================================================
	// 上方记录该提供商预期的错误文案，下面的正则断言据此判断。

	describe.skipIf(!process.env.GROQ_API_KEY)("Groq", () => {
		// 测试场景：验证“llama-3.3-70b-versatile - should detect overflow via isContextOverflow”对应的行为、返回值与边界条件。
		it("llama-3.3-70b-versatile - should detect overflow via isContextOverflow", async () => {
			/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const model = getModel("groq", "llama-3.3-70b-versatile");
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = await testContextOverflow(model, process.env.GROQ_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(result.errorMessage).toMatch(/reduce the length of the messages/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	// =============================================================================
	// Cerebras
	// Expected: 400/413 status code with no body
	// =============================================================================
	// 中文说明：上方英文注释描述“=======================================================”相关前提、步骤或边界；下面代码按该说明执行。

	describe.skipIf(!process.env.CEREBRAS_API_KEY)("Cerebras", () => {
		// 测试场景：验证“available model - should detect overflow via isContextOverflow”对应的行为、返回值与边界条件。
		it("available model - should detect overflow via isContextOverflow", async () => {
			/** 常量 preferredCerebrasModelIds 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const preferredCerebrasModelIds: string[] = ["gpt-oss-120b", "zai-glm-4.7", "llama3.1-8b"];
			/** 常量 cerebrasModels 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const cerebrasModels = getModels("cerebras");
			/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const model =
				cerebrasModels.find((candidate) => preferredCerebrasModelIds.includes(candidate.id)) ?? cerebrasModels[0];
			if (!model) {
				throw new Error("No Cerebras models available");
			}

			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = await testContextOverflow(model, process.env.CEREBRAS_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			// Cerebras returns status code with no body (400, 413, or 429 for token rate limit)
			// 中文说明：上方英文注释描述“Cerebras returns status code with no body (400, 413, or”相关前提、步骤或边界；下面代码按该说明执行。
			expect(result.errorMessage).toMatch(/4(00|13|29).*\(no body\)/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	// =============================================================================
	// Hugging Face
	// Uses OpenAI-compatible Inference Router
	// =============================================================================
	// 该服务使用 OpenAI 兼容接口，仍需验证具体错误能被统一识别。

	describe.skipIf(!process.env.HF_TOKEN)("Hugging Face", () => {
		// 测试场景：验证“Kimi-K2.5 - should detect overflow via isContextOverflow”对应的行为、返回值与边界条件。
		it("Kimi-K2.5 - should detect overflow via isContextOverflow", async () => {
			/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const model = getModel("huggingface", "moonshotai/Kimi-K2.5");
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = await testContextOverflow(model, process.env.HF_TOKEN!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	// =============================================================================
	// Together AI
	// Uses OpenAI-compatible Chat Completions API
	// =============================================================================
	// 该服务使用 OpenAI 兼容接口，仍需验证具体错误能被统一识别。

	describe.skipIf(!process.env.TOGETHER_API_KEY)("Together AI", () => {
		// 测试场景：验证“Kimi-K2.6 - should detect overflow via isContextOverflow”对应的行为、返回值与边界条件。
		it("Kimi-K2.6 - should detect overflow via isContextOverflow", async () => {
			/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const model = getModel("together", "moonshotai/Kimi-K2.6");
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = await testContextOverflow(model, process.env.TOGETHER_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	// =============================================================================
	// z.ai
	// Special case: may return explicit overflow error text, may accept overflow silently,
	// or may rate limit instead
	// =============================================================================
	// 该提供商可能返回显式错误、静默接受超长输入或限流，因此需按停止原因分支判断。

	describe.skipIf(!process.env.ZAI_API_KEY)("z.ai", () => {
		// 测试场景：验证“glm-4.5-air - should detect overflow via isContextOverflow when z.ai reports it”对应的行为、返回值与边界条件。
		it("glm-4.5-air - should detect overflow via isContextOverflow when z.ai reports it", async () => {
			/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const model = getModel("zai", "glm-4.5-air");
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = await testContextOverflow(model, process.env.ZAI_API_KEY!);
			logResult(result);

			// z.ai behavior is inconsistent:
			// - Sometimes returns explicit overflow error text via non-standard finish_reason handling
			// - Sometimes accepts overflow and returns successfully with usage.input > contextWindow
			// - Sometimes returns rate limit error
			// 该提供商可能返回显式错误、静默接受超长输入或限流，因此需按停止原因分支判断。
			if (result.stopReason === "error") {
				if (result.errorMessage?.match(/model_context_window_exceeded/i)) {
					expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
				} else {
					console.log("  z.ai returned non-overflow error (possibly rate limited), skipping overflow detection");
				}
			} else if (result.stopReason === "stop") {
				if (result.hasUsageData && result.usage.input > model.contextWindow) {
					expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
				} else {
					console.log("  z.ai returned stop without overflow usage data, skipping overflow detection");
				}
			}
		}, 120000);
	});

	// =============================================================================
	// Mistral
	// =============================================================================
	// 中文说明：上方英文注释描述“=======================================================”相关前提、步骤或边界；下面代码按该说明执行。

	describe.skipIf(!process.env.MISTRAL_API_KEY)("Mistral", () => {
		// 测试场景：验证“devstral-medium-latest - should detect overflow via isContextOverflow”对应的行为、返回值与边界条件。
		it("devstral-medium-latest - should detect overflow via isContextOverflow", async () => {
			/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const model = getModel("mistral", "devstral-medium-latest");
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = await testContextOverflow(model, process.env.MISTRAL_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(result.errorMessage).toMatch(/too large for model with \d+ maximum context length/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	// =============================================================================
	// MiniMax
	// Expected pattern: TBD - need to test actual error message
	// =============================================================================
	// 上方记录该提供商预期的错误文案，下面的正则断言据此判断。

	describe.skipIf(!process.env.MINIMAX_API_KEY)("MiniMax", () => {
		// 测试场景：验证“MiniMax-M2.7 - should detect overflow via isContextOverflow”对应的行为、返回值与边界条件。
		it("MiniMax-M2.7 - should detect overflow via isContextOverflow", async () => {
			/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const model = getModel("minimax", "MiniMax-M2.7");
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = await testContextOverflow(model, process.env.MINIMAX_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	// =============================================================================
	// Xiaomi MiMo
	// =============================================================================
	// 中文说明：上方英文注释描述“=======================================================”相关前提、步骤或边界；下面代码按该说明执行。

	describe.skipIf(!process.env.XIAOMI_API_KEY)("Xiaomi MiMo (API billing)", () => {
		// Xiaomi silently truncates oversized input to fill the context window exactly,
		// then returns finish_reason "length" with output=0 (no room left to generate).
		// This is a detectable overflow signal but uses stopReason "length" rather than "error".
		// 小米接口会静默截断超长输入并填满窗口，再以 length 结束且不生成输出。
		it("mimo-v2.5-pro - should detect overflow via isContextOverflow", async () => {
			/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const model = getModel("xiaomi", "mimo-v2.5-pro");
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = await testContextOverflow(model, process.env.XIAOMI_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("length");
			expect(result.usage.output).toBe(0);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	describe.skipIf(!process.env.XIAOMI_TOKEN_PLAN_CN_API_KEY)("Xiaomi MiMo Token Plan (CN)", () => {
		// 测试场景：验证“mimo-v2.5-pro - should detect overflow via isContextOverflow”对应的行为、返回值与边界条件。
		it("mimo-v2.5-pro - should detect overflow via isContextOverflow", async () => {
			/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const model = getModel("xiaomi-token-plan-cn", "mimo-v2.5-pro");
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = await testContextOverflow(model, process.env.XIAOMI_TOKEN_PLAN_CN_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("length");
			expect(result.usage.output).toBe(0);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	describe.skipIf(!process.env.XIAOMI_TOKEN_PLAN_AMS_API_KEY)("Xiaomi MiMo Token Plan (AMS)", () => {
		// 测试场景：验证“mimo-v2.5-pro - should detect overflow via isContextOverflow”对应的行为、返回值与边界条件。
		it("mimo-v2.5-pro - should detect overflow via isContextOverflow", async () => {
			/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const model = getModel("xiaomi-token-plan-ams", "mimo-v2.5-pro");
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = await testContextOverflow(model, process.env.XIAOMI_TOKEN_PLAN_AMS_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("length");
			expect(result.usage.output).toBe(0);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	describe.skipIf(!process.env.XIAOMI_TOKEN_PLAN_SGP_API_KEY)("Xiaomi MiMo Token Plan (SGP)", () => {
		// 测试场景：验证“mimo-v2.5-pro - should detect overflow via isContextOverflow”对应的行为、返回值与边界条件。
		it("mimo-v2.5-pro - should detect overflow via isContextOverflow", async () => {
			/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const model = getModel("xiaomi-token-plan-sgp", "mimo-v2.5-pro");
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = await testContextOverflow(model, process.env.XIAOMI_TOKEN_PLAN_SGP_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("length");
			expect(result.usage.output).toBe(0);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	describe.skipIf(!process.env.QWEN_TOKEN_PLAN_API_KEY)("Qwen Token Plan", () => {
		// 测试场景：验证“qwen3.7-max - should detect overflow via isContextOverflow”对应的行为、返回值与边界条件。
		it("qwen3.7-max - should detect overflow via isContextOverflow", async () => {
			/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const model = getModel("qwen-token-plan", "qwen3.7-max");
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = await testContextOverflow(model, process.env.QWEN_TOKEN_PLAN_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(result.errorMessage).toMatch(/input length/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	describe.skipIf(!process.env.QWEN_TOKEN_PLAN_CN_API_KEY)("Qwen Token Plan (CN)", () => {
		// 测试场景：验证“qwen3.7-max - should detect overflow via isContextOverflow”对应的行为、返回值与边界条件。
		it("qwen3.7-max - should detect overflow via isContextOverflow", async () => {
			/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const model = getModel("qwen-token-plan-cn", "qwen3.7-max");
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = await testContextOverflow(model, process.env.QWEN_TOKEN_PLAN_CN_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(result.errorMessage).toMatch(/input length/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	// =============================================================================
	// Kimi For Coding
	// =============================================================================
	// 中文说明：上方英文注释描述“=======================================================”相关前提、步骤或边界；下面代码按该说明执行。

	describe.skipIf(!process.env.KIMI_API_KEY)("Kimi For Coding", () => {
		// 测试场景：验证“kimi-for-coding - should detect overflow via isContextOverflow”对应的行为、返回值与边界条件。
		it("kimi-for-coding - should detect overflow via isContextOverflow", async () => {
			/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const model = getModel("kimi-coding", "kimi-for-coding");
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = await testContextOverflow(model, process.env.KIMI_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	// =============================================================================
	// Vercel AI Gateway - Unified API for multiple providers
	// =============================================================================
	// 网关统一转发多个提供商，本用例验证转发不会破坏溢出识别。

	describe.skipIf(!process.env.AI_GATEWAY_API_KEY)("Vercel AI Gateway", () => {
		// 测试场景：验证“google/gemini-2.5-flash via AI Gateway - should detect overflow via isContextOverflow”对应的行为、返回值与边界条件。
		it("google/gemini-2.5-flash via AI Gateway - should detect overflow via isContextOverflow", async () => {
			/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const model = getModel("vercel-ai-gateway", "google/gemini-2.5-flash");
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = await testContextOverflow(model, process.env.AI_GATEWAY_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	// =============================================================================
	// OpenRouter - Multiple backend providers
	// Expected pattern: "maximum context length is X tokens"
	// =============================================================================
	// 上方记录该提供商预期的错误文案，下面的正则断言据此判断。

	describe.skipIf(!process.env.OPENROUTER_API_KEY)("OpenRouter", () => {
		// Anthropic backend
		// 本用例选择上方标明的网关后端，检查其上下文长度错误。
		it("anthropic/claude-sonnet-4 via OpenRouter - should detect overflow via isContextOverflow", async () => {
			/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const model = getModel("openrouter", "anthropic/claude-sonnet-4");
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = await testContextOverflow(model, process.env.OPENROUTER_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(result.errorMessage).toMatch(/maximum context length is \d+ tokens/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);

		// DeepSeek backend
		// 本用例选择上方标明的网关后端，检查其上下文长度错误。
		it("deepseek/deepseek-v3.2 via OpenRouter - should detect overflow via isContextOverflow", async () => {
			/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const model = getModel("openrouter", "deepseek/deepseek-v3.2");
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = await testContextOverflow(model, process.env.OPENROUTER_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(result.errorMessage).toMatch(/maximum context length is \d+ tokens/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);

		// Mistral backend
		// 本用例选择上方标明的网关后端，检查其上下文长度错误。
		it("mistralai/mistral-large-2512 via OpenRouter - should detect overflow via isContextOverflow", async () => {
			/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const model = getModel("openrouter", "mistralai/mistral-large-2512");
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = await testContextOverflow(model, process.env.OPENROUTER_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(result.errorMessage).toMatch(/maximum context length is \d+ tokens/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);

		// Google backend
		// 本用例选择上方标明的网关后端，检查其上下文长度错误。
		it("google/gemini-2.5-flash via OpenRouter - should detect overflow via isContextOverflow", async () => {
			/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const model = getModel("openrouter", "google/gemini-2.5-flash");
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = await testContextOverflow(model, process.env.OPENROUTER_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(result.errorMessage).toMatch(/maximum context length is \d+ tokens/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);

		// Meta/Llama backend
		// 本用例选择上方标明的网关后端，检查其上下文长度错误。
		it("meta-llama/llama-4-scout via OpenRouter - should detect overflow via isContextOverflow", async () => {
			/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const model = getModel("openrouter", "meta-llama/llama-4-scout");
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = await testContextOverflow(model, process.env.OPENROUTER_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(result.errorMessage).toMatch(/maximum context length is \d+ tokens/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	// =============================================================================
	// Ollama (local)
	// =============================================================================
	// 中文说明：上方英文注释描述“=======================================================”相关前提、步骤或边界；下面代码按该说明执行。

	// Check if ollama is installed and local LLM tests are enabled
	// 仅在允许本地模型测试且系统能找到 Ollama 时启用这一组用例。
	let ollamaInstalled = false;
	if (!process.env.PI_NO_LOCAL_LLM) {
		try {
			execSync("which ollama", { stdio: "ignore" });
			ollamaInstalled = true;
		} catch {
			ollamaInstalled = false;
		}
	}

	describe.skipIf(!ollamaInstalled)("Ollama (local)", () => {
		/** 变量 ollamaProcess 保存当前用例管理的子进程；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		let ollamaProcess: ChildProcess | null = null;
		/** 变量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		let model: Model<"openai-completions">;

		beforeAll(async () => {
			// Check if model is available, if not pull it
			// 测试前检查目标模型；若本地不存在则尝试拉取。
			try {
				execSync("ollama list | grep -q 'gpt-oss:20b'", { stdio: "ignore" });
			} catch {
				console.log("Pulling gpt-oss:20b model for Ollama overflow tests...");
				try {
					execSync("ollama pull gpt-oss:20b", { stdio: "inherit" });
				} catch (_e) {
					console.warn("Failed to pull gpt-oss:20b model, tests will be skipped");
					return;
				}
			}

			// Start ollama server
			// 启动 Ollama 服务进程，供后续兼容接口请求使用。
			ollamaProcess = spawn("ollama", ["serve"], {
				detached: false,
				stdio: "ignore",
			});

			// Wait for server to be ready
			// 轮询标签接口，直到本地服务可以正常响应。
			await new Promise<void>((resolve) => {
				/** 处理 checkServer 对应步骤；无参数；返回值供调用方继续执行或断言。示例：checkServer()。 */
				const checkServer = async () => {
					try {
						/** 常量 response 保存当前调用返回的响应；取值由声明类型和当前场景约束，注意隔离可变状态。 */
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
				setTimeout(checkServer, 1000);
			});

			model = {
				id: "gpt-oss:20b",
				api: "openai-completions",
				provider: "ollama",
				baseUrl: "http://localhost:11434/v1",
				reasoning: true,
				input: ["text"],
				contextWindow: 128000,
				maxTokens: 16000,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				name: "Ollama GPT-OSS 20B",
			};
		}, 60000);

		afterAll(() => {
			if (ollamaProcess) {
				ollamaProcess.kill("SIGTERM");
				ollamaProcess = null;
			}
		});

		// 测试场景：验证“gpt-oss:20b - should detect overflow via isContextOverflow (ollama silently truncates)”对应的行为、返回值与边界条件。
		it("gpt-oss:20b - should detect overflow via isContextOverflow (ollama silently truncates)", async () => {
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = await testContextOverflow(model, "ollama");
			logResult(result);

			// Ollama silently truncates input instead of erroring
			// It returns stopReason "stop" with truncated usage
			// We cannot detect overflow via error message, only via usage comparison
			// Ollama 会静默截断输入，只能结合用量判断是否溢出。
			if (result.stopReason === "stop" && result.hasUsageData) {
				// Ollama truncated - check if reported usage is less than what we sent
				// This is a "silent overflow" - we can detect it if we know expected input size
				// 中文说明：上方英文注释描述“Ollama truncated - check if reported usage is less than”相关前提、步骤或边界；下面代码按该说明执行。
				console.log("  Ollama silently truncated input to", result.usage.input, "tokens");
				// For now, we accept this behavior - Ollama doesn't give us a way to detect overflow
				// 当前接受 Ollama 无法明确报告溢出的限制，不把静默截断视为失败。
			} else if (result.stopReason === "error") {
				expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
			}
		}, 300000); // 5 min timeout for local model
	});

	// =============================================================================
	// LM Studio (local) - Skip if not running or local LLM tests disabled
	// =============================================================================
	// 中文说明：上方英文注释描述“=======================================================”相关前提、步骤或边界；下面代码按该说明执行。

	/** 变量 lmStudioRunning 保存“lmStudioRunning”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	let lmStudioRunning = false;
	if (!process.env.PI_NO_LOCAL_LLM) {
		try {
			execSync("curl -s --max-time 1 http://localhost:1234/v1/models > /dev/null", { stdio: "ignore" });
			lmStudioRunning = true;
		} catch {
			lmStudioRunning = false;
		}
	}

	describe.skipIf(!lmStudioRunning)("LM Studio (local)", () => {
		// 测试场景：验证“should detect overflow via isContextOverflow”对应的行为、返回值与边界条件。
		it("should detect overflow via isContextOverflow", async () => {
			/** 常量 model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const model: Model<"openai-completions"> = {
				id: "local-model",
				api: "openai-completions",
				provider: "lm-studio",
				baseUrl: "http://localhost:1234/v1",
				reasoning: false,
				input: ["text"],
				contextWindow: 8192,
				maxTokens: 2048,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				name: "LM Studio Local Model",
			};

			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = await testContextOverflow(model, "lm-studio");
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	// =============================================================================
	// llama.cpp server (local) - Skip if not running or not exposing /v1/completions
	// =============================================================================
	// 中文说明：上方英文注释描述“=======================================================”相关前提、步骤或边界；下面代码按该说明执行。

	/** 变量 llamaCppRunning 保存“llamaCppRunning”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	let llamaCppRunning = false;
	if (!process.env.PI_NO_LOCAL_LLM) {
		try {
			execSync("curl -s --max-time 1 http://localhost:8081/health > /dev/null", { stdio: "ignore" });
			/** 常量 probeStatus 保存“probeStatus”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const probeStatus = execSync(
				'curl -s --max-time 1 -o /dev/null -w \'%{http_code}\' -X POST http://localhost:8081/v1/completions -H \'content-type: application/json\' -d \'{"model":"local-model","prompt":"ping","max_tokens":1}\'',
				{ encoding: "utf8" },
			).trim();
			llamaCppRunning = probeStatus !== "404" && probeStatus !== "405" && probeStatus !== "000";
		} catch {
			llamaCppRunning = false;
		}
	}

	describe.skipIf(!llamaCppRunning)("llama.cpp (local)", () => {
		// 测试场景：验证“should detect overflow via isContextOverflow”对应的行为、返回值与边界条件。
		it("should detect overflow via isContextOverflow", async () => {
			// Using small context (4096) to match server --ctx-size setting
			// 使用较小上下文窗口，与 llama.cpp 服务的上下文大小设置一致。
			const model: Model<"openai-completions"> = {
				id: "local-model",
				api: "openai-completions",
				provider: "llama.cpp",
				baseUrl: "http://localhost:8081/v1",
				reasoning: false,
				input: ["text"],
				contextWindow: 4096,
				maxTokens: 2048,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				name: "llama.cpp Local Model",
			};

			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = await testContextOverflow(model, "llama.cpp");
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});
});
