/**
 * 文件职责：验证 Gemini 3 历史工具调用在缺少 thoughtSignature 时不会被注入伪签名或历史说明。
 * 技术维度：使用 Vitest、Google 共享消息转换器和泛型模型工厂覆盖 Gen AI 与 Vertex 两条 API。
 * 产品维度：避免无签名工具调用被错误改写，确保跨模型或同模型多轮历史能被 Google 服务正确接受。
 * 逻辑维度：构造两条工具调用的助手消息，转换为 contents，再检查函数调用、文本与签名字段。
 * 关键边界：仅同供应商同模型的有效签名应保留；非 Gemini 3 模型也不得自动补充签名。
 * 新手阅读建议：先看 makeContext 中两条工具调用，再比较四个用例的模型身份和 thoughtSignature 输入。
 */
import { describe, expect, it } from "vitest";
import { convertMessages } from "../src/api/google-shared.ts";
import type { Context, Model } from "../src/types.ts";

/** 功能：创建 Gemini 测试模型；参数 api、provider、可选 id；返回：对应 API 泛型模型。示例：makeGemini3Model("google-generative-ai", "google")。 */
function makeGemini3Model<TApi extends "google-generative-ai" | "google-vertex">(
	api: TApi,
	provider: Model<TApi>["provider"],
	id = "gemini-3-pro-preview",
): Model<TApi> {
	return {
		id,
		name: "Gemini 3 Pro Preview",
		api,
		provider,
		baseUrl: "https://example.com",
		reasoning: true,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128000,
		maxTokens: 8192,
	};
}

/** 功能：创建包含两个工具调用的历史上下文；参数 model 身份、可选 thoughtSignature；返回：Context。示例：makeContext(model, sig)。 */
function makeContext(model: { api: string; provider: string; id: string }, thoughtSignature?: string): Context {
	// 用户与助手消息共用的时间戳，保持固定顺序。
	const now = Date.now();
	return {
		messages: [
			{ role: "user", content: "Hi", timestamp: now },
			{
				role: "assistant",
				content: [
					{
						type: "toolCall",
						id: "call_1",
						name: "bash",
						arguments: { command: "echo hi" },
						...(thoughtSignature && { thoughtSignature }),
					},
					{
						type: "toolCall",
						id: "call_2",
						name: "bash",
						arguments: { command: "ls -la" },
					},
				],
				api: model.api,
				provider: model.provider,
				model: model.id,
				usage: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 0,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
				},
				stopReason: "toolUse",
				timestamp: now,
			},
		],
	};
}

describe("google-shared convertMessages — Gemini 3 unsigned tool calls", () => {
	it("does not add skip_thought_signature_validator for unsigned Google Gen AI tool calls", () => {
		// 当前请求使用的 Gemini 3 Google Gen AI 模型。
		const model = makeGemini3Model("google-generative-ai", "google");
		// 使用不同历史模型 id 转换出的 Google contents。
		const contents = convertMessages(model, makeContext({ ...model, id: "other-model" }));

		// 转换后的助手模型轮次。
		const modelTurn = contents.find((c) => c.role === "model");
		expect(modelTurn).toBeTruthy();

		// 模型轮次内的全部函数调用部分。
		const functionCallParts = modelTurn?.parts?.filter((p) => p.functionCall !== undefined) ?? [];
		expect(functionCallParts).toHaveLength(2);
		expect(functionCallParts[0]?.thoughtSignature).toBeUndefined();
		expect(functionCallParts[1]?.thoughtSignature).toBeUndefined();
		expect(JSON.stringify(modelTurn)).not.toContain("skip_thought_signature_validator");

		// 模型轮次内的全部文本部分。
		const textParts = modelTurn?.parts?.filter((p) => p.text !== undefined) ?? [];
		// 可能由兼容逻辑注入的 Historical context 文本；本场景应为空。
		const historicalText = textParts.filter((p) => p.text?.includes("Historical context"));
		expect(historicalText).toHaveLength(0);
	});

	it("does not add skip_thought_signature_validator for unsigned Vertex tool calls", () => {
		// Vertex API 的 Gemini 3 测试模型。
		const model = makeGemini3Model("google-vertex", "google-vertex");
		// 同模型历史转换出的 Vertex contents。
		const contents = convertMessages(model, makeContext(model));
		// 转换后的模型轮次。
		const modelTurn = contents.find((c) => c.role === "model");
		// Vertex 模型轮次中的函数调用部分。
		const functionCallParts = modelTurn?.parts?.filter((p) => p.functionCall !== undefined) ?? [];

		expect(functionCallParts).toHaveLength(2);
		expect(functionCallParts[0]?.thoughtSignature).toBeUndefined();
		expect(functionCallParts[1]?.thoughtSignature).toBeUndefined();
		expect(JSON.stringify(modelTurn)).not.toContain("skip_thought_signature_validator");
	});

	it("preserves valid thoughtSignature when present for the same provider and model", () => {
		// 同供应商同模型的 Gemini 3 测试模型。
		const model = makeGemini3Model("google-generative-ai", "google");
		// 第一条工具调用携带的有效 Base64 思考签名。
		const validSig = "AAAAAAAAAAAAAAAAAAAAAA==";
		// 包含有效签名的历史转换结果。
		const contents = convertMessages(model, makeContext(model, validSig));
		// 转换后的模型轮次。
		const modelTurn = contents.find((c) => c.role === "model");
		// 两条函数调用部分，用于比较签名保留范围。
		const functionCallParts = modelTurn?.parts?.filter((p) => p.functionCall !== undefined) ?? [];

		expect(functionCallParts).toHaveLength(2);
		expect(functionCallParts[0]?.thoughtSignature).toBe(validSig);
		expect(functionCallParts[1]?.thoughtSignature).toBeUndefined();
	});

	it("does not add a thoughtSignature for non-Gemini-3 models", () => {
		// 非 Gemini 3 的 2.5 Flash 测试模型。
		const model = makeGemini3Model("google-generative-ai", "google", "gemini-2.5-flash");
		// 不同历史模型 id 转换出的 contents。
		const contents = convertMessages(model, makeContext({ ...model, id: "other-model" }));
		// 转换后的模型轮次。
		const modelTurn = contents.find((c) => c.role === "model");
		// 首个函数调用部分；找不到时为 undefined 并使断言失败。
		const fcPart = modelTurn?.parts?.find((p) => p.functionCall !== undefined);

		expect(fcPart).toBeTruthy();
		expect(fcPart?.thoughtSignature).toBeUndefined();
	});
});
