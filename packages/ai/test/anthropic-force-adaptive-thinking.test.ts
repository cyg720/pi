/**
 * 文件职责：验证 Anthropic 模型可通过 compat.forceAdaptiveThinking 强制启用或关闭自适应思考载荷。
 * 技术维度：使用 Vitest、模型目录、载荷拦截回调和无效本地端点，在发网前检查请求结构。
 * 产品维度：支持企业代理和第三方模型 id 使用新思考协议，同时允许内置模型显式回退旧协议。
 * 逻辑维度：构造自定义模型与上下文，捕获载荷，覆盖默认、强制开启、内置模型、Kimi 和关闭场景。
 * 关键边界：自定义 id 不匹配内置自适应规则；未设置 reasoning 时始终发送 disabled。
 * 新手阅读建议：先看 makeCustomModel 的 id 设计，再比较 thinking 与 output_config 在各用例中的差别。
 */
import { describe, expect, it } from "vitest";
import { getModel, streamSimple } from "../src/compat.ts";
import type { Context, Model, SimpleStreamOptions } from "../src/types.ts";

// 被捕获 Anthropic 请求中与思考模式相关的最小字段集合。
interface AnthropicThinkingPayload {
	thinking?: { type: string; budget_tokens?: number; display?: string };
	output_config?: { effort?: string };
}

// 载荷捕获完成的哨兵错误，用来阻止真实网络请求。
class PayloadCaptured extends Error {
	/** 功能：创建载荷捕获哨兵；参数：无；返回：PayloadCaptured 实例。示例：throw new PayloadCaptured()。 */
	constructor() {
		super("payload captured");
		this.name = "PayloadCaptured";
	}
}

/** 功能：创建单条用户消息上下文；参数：无；返回：Context。示例：streamSimple(model, makeContext(), options)。 */
function makeContext(): Context {
	return {
		messages: [{ role: "user", content: "Hello", timestamp: Date.now() }],
	};
}

/** 功能：创建不匹配内置规则的代理模型；参数 compat 为可选兼容设置；返回：Anthropic 模型。示例：makeCustomModel({ forceAdaptiveThinking: true })。 */
function makeCustomModel(compat?: Model<"anthropic-messages">["compat"]): Model<"anthropic-messages"> {
	return {
		// Id intentionally does not match any built-in adaptive substring. This
		// 中文说明：该 id 故意不包含任何内置自适应模型关键字。
		// mirrors corporate proxy schemes such as `anthropic--claude-opus-latest`.
		// 中文说明：这种双连字符形式模拟企业代理常见的模型重命名规则。
		id: "vendor--claude-opus-latest",
		name: "Vendor Proxy Opus Latest",
		api: "anthropic-messages",
		provider: "vendor-proxy",
		baseUrl: "http://127.0.0.1:9",
		reasoning: true,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 200000,
		maxTokens: 32000,
		compat,
	};
}

/** 功能：在请求发送前捕获思考载荷；参数 model、options；返回：AnthropicThinkingPayload。示例：await capturePayload(model, { reasoning: "medium" })。 */
async function capturePayload(
	model: Model<"anthropic-messages">,
	options?: SimpleStreamOptions,
): Promise<AnthropicThinkingPayload> {
	// onPayload 回调写入的载荷；未捕获时保持 undefined。
	let capturedPayload: AnthropicThinkingPayload | undefined;

	// 强制使用不可连接本地端点的模型副本，避免误发真实请求。
	const payloadCaptureModel: Model<"anthropic-messages"> = {
		...model,
		baseUrl: "http://127.0.0.1:9",
	};

	// 待执行的简单消息流；onPayload 抛出哨兵后停止。
	const s = streamSimple(payloadCaptureModel, makeContext(), {
		...options,
		apiKey: "fake-key",
		onPayload: (payload) => {
			capturedPayload = payload as AnthropicThinkingPayload;
			throw new PayloadCaptured();
		},
	});

	await s.result();

	if (!capturedPayload) {
		throw new Error("Expected payload to be captured before request failure");
	}

	return capturedPayload;
}

describe("Anthropic forceAdaptiveThinking compat override", () => {
	it("sends legacy thinking payload for custom model ids by default", async () => {
		// 未设置兼容覆盖时捕获的中等思考载荷。
		const payload = await capturePayload(makeCustomModel(), { reasoning: "medium" });

		expect(payload.thinking?.type).toBe("enabled");
		expect(payload.output_config).toBeUndefined();
	});

	it("sends adaptive thinking payload when compat.forceAdaptiveThinking is true", async () => {
		// 强制开启自适应思考时捕获的载荷。
		const payload = await capturePayload(makeCustomModel({ forceAdaptiveThinking: true }), { reasoning: "medium" });

		expect(payload.thinking).toEqual({ type: "adaptive", display: "summarized" });
		expect(payload.output_config).toEqual({ effort: "medium" });
	});

	it("uses adaptive thinking with native xhigh effort for Claude Fable 5", async () => {
		// 内置 Claude Fable 5 在 xhigh 推理级别下的载荷。
		const payload = await capturePayload(getModel("anthropic", "claude-fable-5"), { reasoning: "xhigh" });

		expect(payload.thinking).toEqual({ type: "adaptive", display: "summarized" });
		expect(payload.output_config).toEqual({ effort: "xhigh" });
	});

	it.each([
		["kimi-for-coding", "medium", "medium"],
		["k3", "max", "max"],
		["kimi-for-coding-highspeed", "medium", "medium"],
	] as const)(
		"uses adaptive thinking effort without a token budget for Kimi Coding %s",
		async (modelId, reasoning, effort) => {
			// 当前 Kimi 模型与推理级别生成的自适应载荷。
			const payload = await capturePayload(getModel("kimi-coding", modelId), { reasoning });

			expect(payload.thinking).toEqual({ type: "adaptive", display: "summarized" });
			expect(payload.output_config).toEqual({ effort });
		},
	);

	it("allows built-in adaptive models to opt out with compat.forceAdaptiveThinking false", async () => {
		// 复制内置自适应模型并显式关闭强制开关的模型元数据。
		const model: Model<"anthropic-messages"> = {
			...getModel("anthropic", "claude-opus-4-8"),
			compat: { forceAdaptiveThinking: false },
		};
		// 关闭覆盖后的中等思考载荷，应回到 legacy enabled。
		const payload = await capturePayload(model, { reasoning: "medium" });

		expect(payload.thinking?.type).toBe("enabled");
		expect(payload.output_config).toBeUndefined();
	});

	it("preserves thinking.type=disabled when reasoning is off regardless of override", async () => {
		// 开启自适应兼容但不请求 reasoning 时捕获的载荷。
		const payload = await capturePayload(makeCustomModel({ forceAdaptiveThinking: true }));

		expect(payload.thinking).toEqual({ type: "disabled" });
		expect(payload.output_config).toBeUndefined();
	});
});
