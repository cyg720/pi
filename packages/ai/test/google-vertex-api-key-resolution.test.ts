/**
 * 文件职责：验证 Google Vertex 在占位密钥、真实 API Key、ADC 和自定义 baseUrl 间选择正确客户端配置。
 * 技术维度：使用 Vitest 提升桩模拟 @google/genai 客户端与流响应，并捕获 GoogleGenAI 构造参数。
 * 产品维度：让用户可使用本地 ADC、API Key 或代理端点访问 Vertex，避免把认证占位符当真实密钥发送。
 * 逻辑维度：重置环境和调用记录，再覆盖两类占位符、真实密钥、默认地址和不同认证下的自定义地址。
 * 关键边界：生成的 Vertex 占位 baseUrl 不应转发；已含 API 版本的自定义地址必须禁用 SDK 自动追加版本。
 * 新手阅读建议：先看 GoogleGenAI 桩如何保存 config，再逐项比较 constructorCalls 中 apiKey/project/httpOptions。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// googleGenAiMock 记录每次伪 GoogleGenAI 客户端的构造配置。
const googleGenAiMock = vi.hoisted(() => ({
	constructorCalls: [] as Array<Record<string, unknown>>,
}));

// 用可预测的流和构造参数捕获器替换真实 Google Gen AI SDK。
vi.mock("@google/genai", () => {
	/** Fake GoogleGenAI 客户端，用于离线返回最小成功响应并记录认证配置。 */
	class GoogleGenAI {
		// models 模拟 SDK 模型资源，只实现 generateContentStream。
		models = {
			generateContentStream: async function* () {
				yield {
					responseId: "vertex-response-id",
					candidates: [
						{
							content: { parts: [{ text: "ok" }] },
							finishReason: "STOP",
						},
					],
					usageMetadata: {
						promptTokenCount: 1,
						candidatesTokenCount: 1,
						totalTokenCount: 2,
					},
				};
			},
		};

		/** 参数 config 为 Vertex 客户端配置；记录后创建实例，无额外返回。 */
		constructor(config: Record<string, unknown>) {
			googleGenAiMock.constructorCalls.push(config);
		}
	}

	return {
		GoogleGenAI,
		ResourceScope: {
			COLLECTION: "COLLECTION",
		},
		ThinkingLevel: {
			THINKING_LEVEL_UNSPECIFIED: "THINKING_LEVEL_UNSPECIFIED",
			MINIMAL: "MINIMAL",
			LOW: "LOW",
			MEDIUM: "MEDIUM",
			HIGH: "HIGH",
		},
	};
});

import { stream as streamGoogleVertex } from "../src/api/google-vertex.ts";
import { getModel } from "../src/compat.ts";
import type { Context, Model } from "../src/types.ts";

// model 是使用生成目录默认 Vertex 地址的 Gemini 测试模型。
const model = getModel("google-vertex", "gemini-3-flash-preview");
// context 是所有流用例共享的单条用户消息。
const context: Context = {
	messages: [{ role: "user", content: "hello", timestamp: Date.now() }],
};

// originalGoogleCloudApiKey 保存进程原始环境值，测试结束时恢复。
const originalGoogleCloudApiKey = process.env.GOOGLE_CLOUD_API_KEY;

// 每个用例前清空构造记录并移除环境 API Key。
beforeEach(() => {
	googleGenAiMock.constructorCalls.length = 0;
	delete process.env.GOOGLE_CLOUD_API_KEY;
});

// 每个用例后准确恢复原 GOOGLE_CLOUD_API_KEY 状态。
afterEach(() => {
	if (originalGoogleCloudApiKey === undefined) {
		delete process.env.GOOGLE_CLOUD_API_KEY;
	} else {
		process.env.GOOGLE_CLOUD_API_KEY = originalGoogleCloudApiKey;
	}
});

// 验证 Vertex 认证标记和自定义端点到 SDK 配置的映射。
describe("google-vertex api key resolution", () => {
	// `<authenticated>` 只是 ADC 标记，不应进入 apiKey 字段。
	it("falls back to ADC when options.apiKey is a placeholder marker", async () => {
		// stream 使用占位密钥与显式项目/区域创建。
		const stream = streamGoogleVertex(model, context, {
			apiKey: "<authenticated>",
			project: "test-project",
			location: "us-central1",
		});

		await stream.result();

		expect(googleGenAiMock.constructorCalls).toHaveLength(1);
		expect(googleGenAiMock.constructorCalls[0]).toMatchObject({
			vertexai: true,
			project: "test-project",
			location: "us-central1",
			apiVersion: "v1",
		});
		expect(googleGenAiMock.constructorCalls[0]).not.toHaveProperty("apiKey");
	});

	// 旧 `gcp-vertex-credentials` 标记也代表 ADC。
	it("falls back to ADC when options.apiKey is the gcp-vertex-credentials marker", async () => {
		// stream 使用旧式 ADC 标记创建。
		const stream = streamGoogleVertex(model, context, {
			apiKey: "gcp-vertex-credentials",
			project: "test-project",
			location: "us-central1",
		});

		await stream.result();

		expect(googleGenAiMock.constructorCalls).toHaveLength(1);
		expect(googleGenAiMock.constructorCalls[0]).toMatchObject({
			vertexai: true,
			project: "test-project",
			location: "us-central1",
			apiVersion: "v1",
		});
		expect(googleGenAiMock.constructorCalls[0]).not.toHaveProperty("apiKey");
	});

	// 环境中的占位 API Key 同样不得覆盖 ADC 项目认证。
	it("falls back to ADC when GOOGLE_CLOUD_API_KEY is a placeholder marker", async () => {
		process.env.GOOGLE_CLOUD_API_KEY = "<authenticated>";

		// stream 不传请求密钥，让解析器检查环境占位值。
		const stream = streamGoogleVertex(model, context, {
			project: "test-project",
			location: "us-central1",
		});

		await stream.result();

		expect(googleGenAiMock.constructorCalls).toHaveLength(1);
		expect(googleGenAiMock.constructorCalls[0]).toMatchObject({
			vertexai: true,
			project: "test-project",
			location: "us-central1",
			apiVersion: "v1",
		});
		expect(googleGenAiMock.constructorCalls[0]).not.toHaveProperty("apiKey");
	});

	// 真实 API Key 应创建密钥客户端且无需项目和区域。
	it("still uses the API key client for real API keys", async () => {
		// stream 使用形状类似真实 Google Key 的固定测试值。
		const stream = streamGoogleVertex(model, context, {
			apiKey: "AIzaSyExampleRealisticLookingApiKey123456",
		});

		await stream.result();

		expect(googleGenAiMock.constructorCalls).toHaveLength(1);
		expect(googleGenAiMock.constructorCalls[0]).toMatchObject({
			vertexai: true,
			apiKey: "AIzaSyExampleRealisticLookingApiKey123456",
			apiVersion: "v1",
		});
		expect(googleGenAiMock.constructorCalls[0]).not.toHaveProperty("project");
		expect(googleGenAiMock.constructorCalls[0]).not.toHaveProperty("location");
	});

	// 模型目录生成的默认 Vertex 占位地址不应作为 httpOptions 转发。
	it("does not forward generated Vertex base URL placeholders", async () => {
		// stream 使用默认模型和 ADC 选项。
		const stream = streamGoogleVertex(model, context, {
			project: "test-project",
			location: "us-central1",
		});

		await stream.result();

		expect(googleGenAiMock.constructorCalls).toHaveLength(1);
		expect(googleGenAiMock.constructorCalls[0]?.httpOptions).toBeUndefined();
	});

	// ADC 客户端应把用户自定义代理地址放入 COLLECTION 范围 httpOptions。
	it("forwards custom baseUrl to the ADC client", async () => {
		// customModel 用明确代理地址覆盖生成模型地址。
		const customModel: Model<"google-vertex"> = { ...model, baseUrl: "https://proxy.example.com" };
		// stream 使用自定义模型和 ADC 项目认证。
		const stream = streamGoogleVertex(customModel, context, {
			project: "test-project",
			location: "us-central1",
		});

		await stream.result();

		expect(googleGenAiMock.constructorCalls).toHaveLength(1);
		expect(googleGenAiMock.constructorCalls[0]).toMatchObject({
			vertexai: true,
			project: "test-project",
			location: "us-central1",
			apiVersion: "v1",
			httpOptions: {
				baseUrl: "https://proxy.example.com",
				baseUrlResourceScope: "COLLECTION",
			},
		});
	});

	// API Key 客户端也应使用相同自定义代理地址。
	it("forwards custom baseUrl to the API key client", async () => {
		// customModel 是带代理地址的模型副本。
		const customModel: Model<"google-vertex"> = { ...model, baseUrl: "https://proxy.example.com" };
		// stream 使用自定义模型和真实形状测试 Key。
		const stream = streamGoogleVertex(customModel, context, {
			apiKey: "AIzaSyExampleRealisticLookingApiKey123456",
		});

		await stream.result();

		expect(googleGenAiMock.constructorCalls).toHaveLength(1);
		expect(googleGenAiMock.constructorCalls[0]).toMatchObject({
			vertexai: true,
			apiKey: "AIzaSyExampleRealisticLookingApiKey123456",
			apiVersion: "v1",
			httpOptions: {
				baseUrl: "https://proxy.example.com",
				baseUrlResourceScope: "COLLECTION",
			},
		});
	});

	// 自定义地址已含 `/v1/...` 时，应设置空 apiVersion 防止 SDK 重复拼接。
	it("does not append apiVersion when custom baseUrl already includes one", async () => {
		// customModel 的代理地址已包含完整 Vertex v1 资源前缀。
		const customModel: Model<"google-vertex"> = {
			...model,
			baseUrl: "https://proxy.example.com/v1/projects/test-project/locations/global",
		};
		// stream 使用完整自定义地址和 ADC 项目认证。
		const stream = streamGoogleVertex(customModel, context, {
			project: "test-project",
			location: "us-central1",
		});

		await stream.result();

		expect(googleGenAiMock.constructorCalls).toHaveLength(1);
		expect(googleGenAiMock.constructorCalls[0]).toMatchObject({
			httpOptions: {
				baseUrl: "https://proxy.example.com/v1/projects/test-project/locations/global",
				baseUrlResourceScope: "COLLECTION",
				apiVersion: "",
			},
		});
	});
});
