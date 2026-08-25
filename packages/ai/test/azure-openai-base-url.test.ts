/**
 * 文件职责：验证 Azure OpenAI Responses 客户端的基础 URL 规范化和关键请求兼容选项。
 * 技术维度：使用 Vitest 提升式 mock 捕获 AzureOpenAI 构造参数及 responses.create 请求载荷。
 * 产品维度：确保用户提供不同 Azure 域名、路径或资源名时都能连接正确端点，并遵守服务限制。
 * 逻辑维度：隔离 Azure 环境变量，通过 captureClientBaseUrl 触发请求，再覆盖 URL、缓存键、存储和 strict 模式。
 * 关键边界：Azure 域名会被规范化，非 Azure 代理路径和查询参数需保留；无效 URL 返回错误结果。
 * 新手阅读建议：先看 mock 捕获哪些字段，再读 captureClientBaseUrl，最后按 URL 与载荷两组用例阅读。
 */
import { Type } from "typebox";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stream as streamAzureOpenAIResponses } from "../src/api/azure-openai-responses.ts";
import { getModel } from "../src/compat.ts";
import type { Context, Model } from "../src/types.ts";

/** AzureOpenAI 构造函数中本测试关心的配置字段。 */
interface CapturedAzureClientOptions {
	apiKey: string;
	apiVersion: string;
	dangerouslyAllowBrowser: boolean;
	defaultHeaders?: Record<string, string>;
	baseURL: string;
}

/** Responses create 请求中本测试关心的可选字段。 */
interface CapturedAzureResponsesPayload {
	prompt_cache_key?: string;
	store?: boolean;
	tools?: Array<{ strict?: boolean }>;
}

/** 记录 Azure 客户端构造调用和最后一次 Responses 请求。 */
const azureMock = vi.hoisted(() => ({
	constructorCalls: [] as CapturedAzureClientOptions[],
	lastParams: undefined as CapturedAzureResponsesPayload | undefined,
}));

vi.mock("openai", () => {
	/** 捕获配置和请求后立即失败的假 Azure OpenAI 客户端。 */
	class AzureOpenAI {
		/** 最小 Responses API；create 保存参数后抛错以结束测试流。 */
		responses = {
			create: (params: CapturedAzureResponsesPayload) => {
				azureMock.lastParams = params;
				throw new Error("mock create");
			},
		};

		/** @param config 被测适配器生成的 Azure 客户端配置。 */
		constructor(config: CapturedAzureClientOptions) {
			azureMock.constructorCalls.push(config);
		}
	}

	return { AzureOpenAI };
});

/** 所有 Azure 场景复用的最小用户上下文。 */
const context: Context = {
	messages: [{ role: "user", content: "hello", timestamp: Date.now() }],
};

/** 测试前已有的 Azure 基础 URL，结束后恢复。 */
const originalAzureOpenAIBaseUrl = process.env.AZURE_OPENAI_BASE_URL;
/** 测试前已有的 Azure 资源名。 */
const originalAzureOpenAIResourceName = process.env.AZURE_OPENAI_RESOURCE_NAME;
/** 测试前已有的 Azure API 版本。 */
const originalAzureOpenAIApiVersion = process.env.AZURE_OPENAI_API_VERSION;
/** 测试前已有的 Azure API 密钥。 */
const originalAzureOpenAIApiKey = process.env.AZURE_OPENAI_API_KEY;

/** 每个用例前清空捕获记录和 Azure 环境变量。 */
beforeEach(() => {
	azureMock.constructorCalls.length = 0;
	azureMock.lastParams = undefined;
	delete process.env.AZURE_OPENAI_BASE_URL;
	delete process.env.AZURE_OPENAI_RESOURCE_NAME;
	delete process.env.AZURE_OPENAI_API_VERSION;
	delete process.env.AZURE_OPENAI_API_KEY;
});

/** 每个用例后逐项恢复原始 Azure 环境变量。 */
afterEach(() => {
	if (originalAzureOpenAIBaseUrl === undefined) {
		delete process.env.AZURE_OPENAI_BASE_URL;
	} else {
		process.env.AZURE_OPENAI_BASE_URL = originalAzureOpenAIBaseUrl;
	}

	if (originalAzureOpenAIResourceName === undefined) {
		delete process.env.AZURE_OPENAI_RESOURCE_NAME;
	} else {
		process.env.AZURE_OPENAI_RESOURCE_NAME = originalAzureOpenAIResourceName;
	}

	if (originalAzureOpenAIApiVersion === undefined) {
		delete process.env.AZURE_OPENAI_API_VERSION;
	} else {
		process.env.AZURE_OPENAI_API_VERSION = originalAzureOpenAIApiVersion;
	}

	if (originalAzureOpenAIApiKey === undefined) {
		delete process.env.AZURE_OPENAI_API_KEY;
	} else {
		process.env.AZURE_OPENAI_API_KEY = originalAzureOpenAIApiKey;
	}
});

/**
 * 通过环境变量设置基础 URL，并返回客户端最终收到的规范化 URL。
 * @param baseUrl 用户配置的原始 URL。
 * @returns AzureOpenAI 构造参数中的 baseURL。
 * @example await captureClientBaseUrl("https://my-resource.openai.azure.com");
 */
async function captureClientBaseUrl(baseUrl: string): Promise<string> {
	process.env.AZURE_OPENAI_BASE_URL = baseUrl;
	/** 用于触发 Azure Responses 适配器的内置模型。 */
	const model = getModel("azure-openai-responses", "gpt-4o-mini");
	await streamAzureOpenAIResponses(model, context, { apiKey: "test-api-key" }).result();
	expect(azureMock.constructorCalls).toHaveLength(1);
	return azureMock.constructorCalls[0].baseURL;
}

/** 覆盖 Azure URL 规范化、请求限制和环境变量回退规则。 */
describe("azure-openai-responses base URL normalization", () => {
	it("normalizes Cognitive Services root endpoints to /openai/v1", async () => {
		const baseURL = await captureClientBaseUrl("https://marc-quicktests-resource.cognitiveservices.azure.com");
		/** baseURL 是 Cognitive Services 根地址经适配器规范化后的客户端基础地址。 */
		expect(baseURL).toBe("https://marc-quicktests-resource.cognitiveservices.azure.com/openai/v1");
	});

	it("normalizes Microsoft Foundry root endpoints to /openai/v1", async () => {
		const baseURL = await captureClientBaseUrl("https://marc-quicktests-resource.ai.azure.com");
		/** baseURL 是 Microsoft Foundry 根地址规范化后的客户端基础地址。 */
		expect(baseURL).toBe("https://marc-quicktests-resource.ai.azure.com/openai/v1");
	});

	it("normalizes Azure OpenAI root endpoints to /openai/v1", async () => {
		const baseURL = await captureClientBaseUrl("https://my-resource.openai.azure.com");
		/** baseURL 是 Azure OpenAI 根地址规范化后的版本化 API 地址。 */
		expect(baseURL).toBe("https://my-resource.openai.azure.com/openai/v1");
	});

	it("normalizes /openai to /openai/v1", async () => {
		const baseURL = await captureClientBaseUrl("https://my-resource.cognitiveservices.azure.com/openai");
		/** baseURL 是已有 openai 路径补齐 v1 后的地址。 */
		expect(baseURL).toBe("https://my-resource.cognitiveservices.azure.com/openai/v1");
	});

	it("preserves /openai/v1 endpoints", async () => {
		const baseURL = await captureClientBaseUrl("https://my-resource.cognitiveservices.azure.com/openai/v1");
		/** baseURL 是已规范的 Azure 地址，预期保持原值。 */
		expect(baseURL).toBe("https://my-resource.cognitiveservices.azure.com/openai/v1");
	});

	it("normalizes /openai/v1/responses to /openai/v1", async () => {
		const baseURL = await captureClientBaseUrl("https://my-resource.services.ai.azure.com/openai/v1/responses");
		/** baseURL 是移除具体 responses 资源段后的通用 v1 基础地址。 */
		expect(baseURL).toBe("https://my-resource.services.ai.azure.com/openai/v1");
	});

	it("preserves explicit non-Azure proxy paths", async () => {
		const baseURL = await captureClientBaseUrl("https://my-proxy.example.com/v1");
		/** baseURL 是非 Azure 代理地址，适配器不应改写其自定义路径。 */
		expect(baseURL).toBe("https://my-proxy.example.com/v1");
	});

	it("strips query params when normalizing Azure host URLs", async () => {
		const baseURL = await captureClientBaseUrl("https://my-resource.openai.azure.com/openai?api-version=2024-12-01");
		/** baseURL 是去除 Azure 查询参数并补齐标准路径后的地址。 */
		expect(baseURL).toBe("https://my-resource.openai.azure.com/openai/v1");
	});

	it("preserves query params on non-Azure proxy URLs", async () => {
		const baseURL = await captureClientBaseUrl("https://my-proxy.example.com/v1?custom=true");
		/** baseURL 是带自定义查询参数的非 Azure 代理地址，预期完整保留。 */
		expect(baseURL).toBe("https://my-proxy.example.com/v1?custom=true");
	});

	it("throws on invalid URLs", async () => {
		process.env.AZURE_OPENAI_BASE_URL = "not-a-url";
		/** 用于触发无效 URL 校验的 Azure 模型。 */
		const model = getModel("azure-openai-responses", "gpt-4o-mini");
		/** 无效 URL 产生的标准错误结果。 */
		const result = await streamAzureOpenAIResponses(model, context, { apiKey: "test-api-key" }).result();
		expect(result.stopReason).toBe("error");
		expect(result.errorMessage).toContain("Invalid Azure OpenAI base URL");
	});

	it("clamps prompt_cache_key to OpenAI's 64-character limit", async () => {
		/** 缓存键长度场景的 Azure 模型。 */
		const model = getModel("azure-openai-responses", "gpt-4o-mini");
		await streamAzureOpenAIResponses(model, context, {
			apiKey: "test-api-key",
			azureBaseUrl: "https://my-resource.openai.azure.com",
			sessionId: "x".repeat(67),
		}).result();

		expect(azureMock.lastParams?.prompt_cache_key).toBe("x".repeat(64));
	});

	it("disables server-side response storage", async () => {
		/** 服务端存储选项场景的 Azure 模型。 */
		const model = getModel("azure-openai-responses", "gpt-4o-mini");
		await streamAzureOpenAIResponses(model, context, {
			apiKey: "test-api-key",
			azureBaseUrl: "https://my-resource.openai.azure.com",
		}).result();

		expect(azureMock.lastParams?.store).toBe(false);
	});

	it("honors supportsStrictMode: false", async () => {
		/** 复制兼容配置前的内置模型。 */
		const baseModel = getModel("azure-openai-responses", "gpt-4o-mini");
		/** 显式关闭 strict 工具模式的模型。 */
		const model: Model<"azure-openai-responses"> = {
			...baseModel,
			compat: { ...baseModel.compat, supportsStrictMode: false },
		};

		await streamAzureOpenAIResponses(
			model,
			{
				...context,
				tools: [
					{
						name: "preferred",
						description: "Preferred constrained tool",
						parameters: Type.Object({ value: Type.String() }),
						constrainedSampling: { type: "json_schema", strict: "prefer" },
					},
				],
			},
			{ apiKey: "test-api-key", azureBaseUrl: "https://my-resource.openai.azure.com" },
		).result();

		expect(azureMock.lastParams?.tools?.[0]).not.toHaveProperty("strict");
	});

	it("builds correct default URL from AZURE_OPENAI_RESOURCE_NAME", async () => {
		process.env.AZURE_OPENAI_RESOURCE_NAME = "my-resource";
		/** 仅依赖资源名构建默认 URL 的 Azure 模型。 */
		const model = getModel("azure-openai-responses", "gpt-4o-mini");
		await streamAzureOpenAIResponses(model, context, { apiKey: "test-api-key" }).result();
		expect(azureMock.constructorCalls).toHaveLength(1);
		expect(azureMock.constructorCalls[0].baseURL).toBe("https://my-resource.openai.azure.com/openai/v1");
	});
});
