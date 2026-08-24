/**
 * 文件职责：端到端验证各内置供应商完成请求后都会在助手消息上暴露非空 responseId。
 * 技术维度：使用 Vitest 条件跳过、模型目录、OAuth/环境凭据和 complete API 覆盖多种供应商协议。
 * 产品维度：让日志追踪、问题排查和供应商支持能够使用真实响应标识关联一次模型调用。
 * 逻辑维度：统一帮助函数发起固定提示；各 describe 按凭据条件选择模型与附加选项执行相同断言。
 * 关键边界：这是在线测试，会消耗真实额度；无凭据场景跳过，Azure 还需要部署名映射。
 * 新手阅读建议：先读 expectResponseId 的统一断言，再看各供应商只负责准备模型、凭据和额外选项。
 */
import { describe, expect, it } from "vitest";
import { complete, getModel } from "../src/compat.ts";
import type { Api, Context, Model, StreamOptions } from "../src/types.ts";
import { hasAzureOpenAICredentials, resolveAzureDeploymentName } from "./azure-utils.ts";
import { resolveApiKey } from "./oauth.ts";

// 允许供应商特有附加字段的流选项类型。
type StreamOptionsWithExtras = StreamOptions & Record<string, unknown>;

// 并行解析 Copilot 与 OpenAI Codex 的可选 OAuth 凭据。
const oauthTokens = await Promise.all([resolveApiKey("github-copilot"), resolveApiKey("openai-codex")]);
// 两个 OAuth 结果按请求顺序解构；任一缺失时对应在线测试跳过。
const [githubCopilotToken, openaiCodexToken] = oauthTokens;

/** 功能：完成固定提示并断言 responseId；参数 model、options；返回：完成 Promise。示例：await expectResponseId(llm, { apiKey })。 */
async function expectResponseId<TApi extends Api>(model: Model<TApi>, options: StreamOptionsWithExtras = {}) {
	// 所有供应商共用的简短测试上下文。
	const context: Context = {
		systemPrompt: "You are a helpful assistant. Be concise.",
		messages: [{ role: "user", content: "Reply with exactly: response id test", timestamp: Date.now() }],
	};

	// 真实供应商返回的助手消息。
	const response = await complete(model, context, options);

	expect(response.stopReason, response.errorMessage).not.toBe("error");
	expect(response.responseId).toBeTruthy();
	expect(typeof response.responseId).toBe("string");
}

describe("responseId E2E Tests", () => {
	describe.skipIf(!process.env.GEMINI_API_KEY)("Google Provider", () => {
		// Google Gemini API 的低成本测试模型。
		const llm = getModel("google", "gemini-2.5-flash");

		it("should expose responseId", { retry: 3, timeout: 30000 }, async () => {
			await expectResponseId(llm);
		});
	});

	describe("Google Vertex Provider", () => {
		// Vertex 项目 id，兼容两种常见环境变量名。
		const vertexProject = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
		// Vertex 区域配置。
		const vertexLocation = process.env.GOOGLE_CLOUD_LOCATION;
		// Vertex 可选 API key，区别于 ADC 凭据。
		const vertexApiKey = process.env.GOOGLE_CLOUD_API_KEY;
		// ADC 测试所需项目和区域是否齐备。
		const isVertexConfigured = Boolean(vertexProject && vertexLocation);
		// 传给 Vertex 请求的项目与区域选项。
		const vertexOptions = { project: vertexProject, location: vertexLocation } as const;
		// Vertex Gemini 测试模型。
		const llm = getModel("google-vertex", "gemini-3-flash-preview");

		it.skipIf(!isVertexConfigured)("should expose responseId with ADC", { retry: 3, timeout: 30000 }, async () => {
			await expectResponseId(llm, vertexOptions);
		});

		it.skipIf(!vertexApiKey)("should expose responseId with API key", { retry: 3, timeout: 30000 }, async () => {
			await expectResponseId(llm, { apiKey: vertexApiKey! });
		});
	});

	describe.skipIf(!process.env.OPENAI_API_KEY)("OpenAI Completions Provider", () => {
		// 去除原模型兼容配置后的基础元数据。
		const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini");
		void _compat;
		// 强制走 openai-completions API 的模型副本。
		const llm: Model<"openai-completions"> = {
			...baseModel,
			api: "openai-completions",
		};

		it("should expose responseId", { retry: 3, timeout: 30000 }, async () => {
			await expectResponseId(llm);
		});
	});

	describe.skipIf(!process.env.OPENAI_API_KEY)("OpenAI Responses Provider", () => {
		// OpenAI Responses 路径测试模型。
		const llm = getModel("openai", "gpt-5-mini");

		it("should expose responseId", { retry: 3, timeout: 30000 }, async () => {
			await expectResponseId(llm);
		});
	});

	describe.skipIf(!process.env.ANTHROPIC_API_KEY)("Anthropic Provider", () => {
		// Anthropic 原生测试模型。
		const llm = getModel("anthropic", "claude-sonnet-4-5");

		it("should expose responseId", { retry: 3, timeout: 30000 }, async () => {
			await expectResponseId(llm);
		});
	});

	describe.skipIf(!hasAzureOpenAICredentials())("Azure OpenAI Responses Provider", () => {
		// Azure OpenAI Responses 测试模型。
		const llm = getModel("azure-openai-responses", "gpt-4o-mini");
		// 环境中与模型 id 对应的可选 Azure 部署名。
		const azureDeploymentName = resolveAzureDeploymentName(llm.id);
		// 仅在部署名存在时传入的 Azure 附加选项。
		const azureOptions = azureDeploymentName ? { azureDeploymentName } : {};

		it("should expose responseId", { retry: 3, timeout: 30000 }, async () => {
			await expectResponseId(llm, azureOptions);
		});
	});

	describe.skipIf(!process.env.MISTRAL_API_KEY)("Mistral Provider", () => {
		// Mistral 测试模型。
		const llm = getModel("mistral", "devstral-medium-latest");

		it("should expose responseId", { retry: 3, timeout: 30000 }, async () => {
			await expectResponseId(llm);
		});
	});

	describe("GitHub Copilot Provider", () => {
		it.skipIf(!githubCopilotToken)("OpenAI path should expose responseId", { retry: 3, timeout: 30000 }, async () => {
			// Copilot OpenAI 协议路径测试模型。
			const llm = getModel("github-copilot", "gpt-5.3-codex");
			await expectResponseId(llm, { apiKey: githubCopilotToken });
		});

		it.skipIf(!githubCopilotToken)(
			"Anthropic path should expose responseId",
			{ retry: 3, timeout: 30000 },
			async () => {
				// Copilot Anthropic 协议路径测试模型。
				const llm = getModel("github-copilot", "claude-sonnet-4.6");
				await expectResponseId(llm, { apiKey: githubCopilotToken });
			},
		);
	});

	describe("OpenAI Codex Provider", () => {
		it.skipIf(!openaiCodexToken)("should expose responseId", { retry: 3, timeout: 30000 }, async () => {
			// OpenAI Codex OAuth 路径测试模型。
			const llm = getModel("openai-codex", "gpt-5.5");
			await expectResponseId(llm, { apiKey: openaiCodexToken });
		});
	});
});
