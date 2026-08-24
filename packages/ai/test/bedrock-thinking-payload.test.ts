/**
 * 文件职责：验证 Bedrock Claude 自适应/固定预算思考载荷、GovCloud 差异、缓存点及最大输出令牌。
 * 技术维度：使用 Vitest、真实 Bedrock 适配器、onPayload 提前中止和带凭据条件的在线 E2E 测试。
 * 产品维度：确保不同 Claude 版本和推理档位获得正确 thinking 配置，并支持应用推理配置 ARN。
 * 逻辑维度：capturePayload 截获请求，主体用例覆盖模型/区域差异，在线用例检查输出上限，末尾检查 ARN。
 * 关键边界：在线长输出用例可能产生费用并需 AWS 凭据；GovCloud 不支持 summarized display；模型名参与识别。
 * 新手阅读建议：先看 BedrockThinkingPayload 与 capturePayload，再按自适应、GovCloud、E2E、应用配置阅读。
 */
import { describe, expect, it } from "vitest";
import { type BedrockOptions, stream as streamBedrock } from "../src/api/bedrock-converse-stream.ts";
import { getModel } from "../src/compat.ts";
import type { Context, Model } from "../src/types.ts";
import { hasBedrockCredentials } from "./bedrock-utils.ts";

/** 本测试关心的 Bedrock additionalModelRequestFields 结构。 */
interface BedrockThinkingPayload {
	additionalModelRequestFields?: {
		thinking?: { type: string; budget_tokens?: number; display?: string };
		output_config?: { effort?: string };
		anthropic_beta?: string[];
	};
}

/** onPayload 捕获成功后用于阻止真实请求的专用异常。 */
class PayloadCaptured extends Error {
	/** 创建名称明确的捕获终止异常。 */
	constructor() {
		super("payload captured");
		this.name = "PayloadCaptured";
	}
}

/**
 * 创建最小用户会话上下文。
 * @returns 含 Hello 用户消息的 Context。
 */
function makeContext(): Context {
	return {
		messages: [{ role: "user", content: "Hello", timestamp: Date.now() }],
	};
}

/**
 * 截获指定 Bedrock 模型的思考请求载荷。
 * @param model 被测模型。
 * @param options 可选区域和推理档位。
 * @returns onPayload 捕获的载荷。
 */
async function capturePayload(
	model: Model<"bedrock-converse-stream">,
	options?: BedrockOptions,
): Promise<BedrockThinkingPayload> {
	/** onPayload 保存的思考载荷。 */
	let capturedPayload: BedrockThinkingPayload | undefined;
	/** 发出请求前会被 PayloadCaptured 中止的事件流。 */
	const s = streamBedrock(model, makeContext(), {
		...options,
		reasoning: options?.reasoning ?? "high",
		onPayload: (payload) => {
			capturedPayload = payload as BedrockThinkingPayload;
			throw new PayloadCaptured();
		},
	});

	for await (const event of s) {
		if (event.type === "error") {
			break;
		}
	}

	if (!capturedPayload) {
		throw new Error("Expected Bedrock payload to be captured before request abort");
	}

	return capturedPayload;
}

/** 覆盖 Claude 4.8/5 系列、GovCloud 和推理档位的思考字段。 */
describe("Bedrock thinking payload", () => {
	it("uses adaptive thinking for Claude Opus 4.8 when reasoning is enabled", async () => {
		/** 复用元数据的现有 Opus 4.6 模型。 */
		const baseModel = getModel("amazon-bedrock", "global.anthropic.claude-opus-4-6-v1");
		/** 模拟 Opus 4.8 Global 标识的模型。 */
		const model: Model<"bedrock-converse-stream"> = {
			...baseModel,
			id: "global.anthropic.claude-opus-4-8-v1",
			name: "Claude Opus 4.8 (Global)",
		};

		/** 默认 high 推理产生的载荷。 */
		const payload = await capturePayload(model);

		expect(payload.additionalModelRequestFields?.thinking).toEqual({ type: "adaptive", display: "summarized" });
		expect(payload.additionalModelRequestFields?.output_config).toEqual({ effort: "high" });
		expect(payload.additionalModelRequestFields?.anthropic_beta).toBeUndefined();
	});

	it("maps xhigh reasoning to effort=xhigh for Claude Opus 4.8", async () => {
		/** 复用元数据的现有 Opus 4.6 模型。 */
		const baseModel = getModel("amazon-bedrock", "global.anthropic.claude-opus-4-6-v1");
		/** 模拟 Opus 4.8 的模型。 */
		const model: Model<"bedrock-converse-stream"> = {
			...baseModel,
			id: "global.anthropic.claude-opus-4-8-v1",
			name: "Claude Opus 4.8 (Global)",
		};

		/** xhigh 推理载荷。 */
		const payload = await capturePayload(model, { reasoning: "xhigh" });

		expect(payload.additionalModelRequestFields?.thinking).toEqual({ type: "adaptive", display: "summarized" });
		expect(payload.additionalModelRequestFields?.output_config).toEqual({ effort: "xhigh" });
		expect(payload.additionalModelRequestFields?.anthropic_beta).toBeUndefined();
	});

	it("uses adaptive thinking for Claude Fable 5 when reasoning is enabled", async () => {
		/** Fable 5 内置模型。 */
		const model = getModel("amazon-bedrock", "global.anthropic.claude-fable-5");

		/** Fable 5 high 推理载荷。 */
		const payload = await capturePayload(model);

		expect(payload.additionalModelRequestFields?.thinking).toEqual({ type: "adaptive", display: "summarized" });
		expect(payload.additionalModelRequestFields?.output_config).toEqual({ effort: "high" });
		expect(payload.additionalModelRequestFields?.anthropic_beta).toBeUndefined();
	});

	it("uses adaptive thinking for Claude Sonnet 5 when reasoning is enabled", async () => {
		/** Sonnet 5 内置模型。 */
		const model = getModel("amazon-bedrock", "global.anthropic.claude-sonnet-5");

		/** Sonnet 5 high 推理载荷。 */
		const payload = await capturePayload(model);

		expect(payload.additionalModelRequestFields?.thinking).toEqual({ type: "adaptive", display: "summarized" });
		expect(payload.additionalModelRequestFields?.output_config).toEqual({ effort: "high" });
		expect(payload.additionalModelRequestFields?.anthropic_beta).toBeUndefined();
	});

	it("uses adaptive thinking for Claude Opus 5 when reasoning is enabled", async () => {
		/** Opus 5 内置模型。 */
		const model = getModel("amazon-bedrock", "global.anthropic.claude-opus-5");

		/** Opus 5 high 推理载荷。 */
		const payload = await capturePayload(model);

		expect(payload.additionalModelRequestFields?.thinking).toEqual({ type: "adaptive", display: "summarized" });
		expect(payload.additionalModelRequestFields?.output_config).toEqual({ effort: "high" });
		expect(payload.additionalModelRequestFields?.anthropic_beta).toBeUndefined();
	});

	it("maps xhigh reasoning to effort=xhigh for Claude Opus 5", async () => {
		/** Opus 5 内置模型。 */
		const model = getModel("amazon-bedrock", "global.anthropic.claude-opus-5");

		/** Opus 5 xhigh 载荷。 */
		const payload = await capturePayload(model, { reasoning: "xhigh" });

		expect(payload.additionalModelRequestFields?.thinking).toEqual({ type: "adaptive", display: "summarized" });
		expect(payload.additionalModelRequestFields?.output_config).toEqual({ effort: "xhigh" });
		expect(payload.additionalModelRequestFields?.anthropic_beta).toBeUndefined();
	});

	it("maps xhigh reasoning to effort=xhigh for Claude Fable 5", async () => {
		/** Fable 5 内置模型。 */
		const model = getModel("amazon-bedrock", "global.anthropic.claude-fable-5");

		/** Fable 5 xhigh 载荷。 */
		const payload = await capturePayload(model, { reasoning: "xhigh" });

		expect(payload.additionalModelRequestFields?.thinking).toEqual({ type: "adaptive", display: "summarized" });
		expect(payload.additionalModelRequestFields?.output_config).toEqual({ effort: "xhigh" });
	});

	it("omits display for GovCloud model ids on non-adaptive Claude thinking", async () => {
		/** 复用固定预算 Claude 元数据的基础模型。 */
		const baseModel = getModel("amazon-bedrock", "us.anthropic.claude-sonnet-4-5-20250929-v1:0");
		/** 模拟 GovCloud 模型 ID。 */
		const model: Model<"bedrock-converse-stream"> = {
			...baseModel,
			id: "us-gov.anthropic.claude-sonnet-4-5-20250929-v1:0",
			name: "Claude Sonnet 4.5 (GovCloud)",
		};

		/** GovCloud 固定预算思考载荷。 */
		const payload = await capturePayload(model);

		expect(payload.additionalModelRequestFields?.thinking).toEqual({ type: "enabled", budget_tokens: 16384 });
		expect(payload.additionalModelRequestFields?.anthropic_beta).toEqual(["interleaved-thinking-2025-05-14"]);
	});

	it("omits display for GovCloud regions on adaptive Claude thinking", async () => {
		/** 复用自适应 Claude 元数据的基础模型。 */
		const baseModel = getModel("amazon-bedrock", "global.anthropic.claude-opus-4-6-v1");
		/** 模拟 Opus 4.8 的模型。 */
		const model: Model<"bedrock-converse-stream"> = {
			...baseModel,
			id: "global.anthropic.claude-opus-4-8-v1",
			name: "Claude Opus 4.8 (Global)",
		};

		/** 显式 GovCloud 区域下的自适应思考载荷。 */
		const payload = await capturePayload(model, { region: "us-gov-west-1" });

		expect(payload.additionalModelRequestFields?.thinking).toEqual({ type: "adaptive" });
		expect(payload.additionalModelRequestFields?.output_config).toEqual({ effort: "high" });
		expect(payload.additionalModelRequestFields?.anthropic_beta).toBeUndefined();
	});
});

/** 仅在存在 Bedrock 凭据时验证自适应 Claude 可输出超过 SDK 默认 4096 令牌。 */
describe.skipIf(!hasBedrockCredentials())("Bedrock Claude max tokens E2E", () => {
	it(
		"uses the model maxTokens cap instead of Bedrock's 4096-token default for adaptive Claude models",
		{ retry: 2, timeout: 180000 },
		async () => {
			/** 在线测试复用的自适应 Claude 模型。 */
			const baseModel = getModel("amazon-bedrock", "global.anthropic.claude-sonnet-4-6");
			/** 将 maxTokens 设为 6000 的模型。 */
			const model: Model<"bedrock-converse-stream"> = {
				...baseModel,
				maxTokens: 6000,
			};

			/** 要求输出 5200 个 token 的真实 Bedrock 响应。 */
			const response = await streamBedrock(
				model,
				{
					systemPrompt: "You are a deterministic text generator. Follow the requested output format exactly.",
					messages: [
						{
							role: "user",
							content:
								"Output exactly 5200 repetitions of the token alpha, separated by single spaces. Do not number them. Do not use markdown. Do not add any other text.",
							timestamp: Date.now(),
						},
					],
				},
				{ reasoning: "low" },
			).result();

			expect(response.stopReason, response.errorMessage).not.toBe("error");
			expect(response.usage.output).toBeGreaterThan(4096);
		},
	);
});

/** 覆盖应用推理配置 ARN 通过 model.name 识别底层 Claude 能力。 */
describe("Application inference profile support", () => {
	it("uses adaptive thinking when model.name contains the model name but ARN does not", async () => {
		/** 复用自适应 Claude 元数据的基础模型。 */
		const baseModel = getModel("amazon-bedrock", "global.anthropic.claude-opus-4-6-v1");
		/** ID 为通用 ARN、名称标明 Opus 4.6 的模型。 */
		const model: Model<"bedrock-converse-stream"> = {
			...baseModel,
			id: "arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/my-profile",
			name: "Claude Opus 4.6",
		};

		/** 应按 model.name 生成的自适应思考载荷。 */
		const payload = await capturePayload(model);

		expect(payload.additionalModelRequestFields?.thinking).toEqual({ type: "adaptive", display: "summarized" });
		expect(payload.additionalModelRequestFields?.output_config).toEqual({ effort: "high" });
	});

	it("injects cache points when model.name identifies a supported Claude model", async () => {
		/** 复用支持缓存点 Claude 元数据的基础模型。 */
		const baseModel = getModel("amazon-bedrock", "global.anthropic.claude-opus-4-6-v1");
		/** ID 为通用 ARN、名称标明 Sonnet 4.6 的模型。 */
		const model: Model<"bedrock-converse-stream"> = {
			...baseModel,
			id: "arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/my-profile",
			name: "Claude Sonnet 4.6",
		};

		/** 捕获包含 system/messages 缓存点的原始载荷。 */
		let capturedPayload: any;
		/** 在 onPayload 处停止的 Bedrock 事件流。 */
		const s = streamBedrock(
			model,
			{
				systemPrompt: "You are helpful.",
				messages: [{ role: "user", content: "Hello", timestamp: Date.now() }],
			},
			{
				onPayload: (payload) => {
					capturedPayload = payload;
					throw new PayloadCaptured();
				},
			},
		);

		for await (const event of s) {
			if (event.type === "error") break;
		}

		// System prompt should have a cache point
		// 系统提示末尾应注入缓存点。
		expect(capturedPayload.system).toHaveLength(2);
		expect(capturedPayload.system[1]).toHaveProperty("cachePoint");

		// Last user message should have a cache point
		// 最后一条用户消息末尾也应注入缓存点。
		/** 捕获载荷中的最后一条消息。 */
		const lastMsg = capturedPayload.messages[capturedPayload.messages.length - 1];
		/** 最后一条消息的最后一个内容块。 */
		const lastContent = lastMsg.content[lastMsg.content.length - 1];
		expect(lastContent).toHaveProperty("cachePoint");
	});

	it("falls back to fixed-budget thinking for non-adaptive Claude via model.name", async () => {
		/** 复用固定预算 Claude 元数据的基础模型。 */
		const baseModel = getModel("amazon-bedrock", "us.anthropic.claude-sonnet-4-5-20250929-v1:0");
		/** ID 为通用 ARN、名称标明 Sonnet 4.5 的模型。 */
		const model: Model<"bedrock-converse-stream"> = {
			...baseModel,
			id: "arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/my-profile",
			name: "Claude Sonnet 4.5",
		};

		/** 应按 model.name 生成的固定预算思考载荷。 */
		const payload = await capturePayload(model);

		expect(payload.additionalModelRequestFields?.thinking).toMatchObject({
			type: "enabled",
			budget_tokens: expect.any(Number),
		});
		expect(payload.additionalModelRequestFields?.anthropic_beta).toEqual(["interleaved-thinking-2025-05-14"]);
	});
});
