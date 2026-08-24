/**
 * 文件职责：验证 Cloudflare 流包装器在分发前替换模型 baseUrl 中的账户和网关占位符。
 * 技术维度：使用 Vitest、模型夹具、依赖注入的流函数和 AssistantMessageEventStream。
 * 产品维度：确保用户的 Cloudflare AI Gateway 请求发送到正确租户路径，缺配置时保留可诊断 URL。
 * 逻辑维度：构造固定模型与上下文，分别测试环境齐全时替换和环境缺失时保持原值。
 * 关键边界：不发送真实网络请求；只覆盖 ACCOUNT_ID 与 GATEWAY_ID 两个占位符。
 * 新手阅读建议：先看 model.baseUrl 模板，再比较两个测试传给 streamSimple 的 env。
 */
import { describe, expect, it } from "vitest";
import { cloudflareStreams } from "../src/providers/cloudflare-stream.ts";
import type { Api, Context, Model } from "../src/types.ts";
import { AssistantMessageEventStream } from "../src/utils/event-stream.ts";

/** 含 Cloudflare 路径占位符的最小模型夹具。 */
const model: Model<Api> = {
	id: "model",
	name: "model",
	api: "openai-completions",
	provider: "cloudflare-ai-gateway",
	baseUrl: "https://gateway.ai.cloudflare.com/v1/{CLOUDFLARE_ACCOUNT_ID}/{CLOUDFLARE_GATEWAY_ID}/openai",
	reasoning: false,
	input: ["text"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 1000,
	maxTokens: 100,
};

/** 无消息的固定请求上下文。 */
const context: Context = { messages: [] };

/** Cloudflare 流 URL 物化测试组。 */
describe("Cloudflare provider streams", () => {
	/** 验证 stream 和 streamSimple 都收到替换后的真实路径。 */
	it("materializes the model endpoint before dispatch", () => {
		/** 两个底层流函数捕获到的 baseUrl。 */
		const captured: string[] = [];
		/** 注入捕获函数后的 Cloudflare 流包装器。 */
		const streams = cloudflareStreams({
			/** requestModel 是物化后的模型，记录 URL 后返回空流。 */
			stream: (requestModel) => {
				captured.push(requestModel.baseUrl);
				return new AssistantMessageEventStream();
			},
			/** requestModel 是简单流收到的物化模型。 */
			streamSimple: (requestModel) => {
				captured.push(requestModel.baseUrl);
				return new AssistantMessageEventStream();
			},
		});
		/** 用于替换两个路径占位符的环境值。 */
		const env = {
			CLOUDFLARE_ACCOUNT_ID: "account",
			CLOUDFLARE_GATEWAY_ID: "gateway",
		};

		streams.stream(model, context, { env });
		streams.streamSimple(model, context, { env });

		expect(captured).toEqual([
			"https://gateway.ai.cloudflare.com/v1/account/gateway/openai",
			"https://gateway.ai.cloudflare.com/v1/account/gateway/openai",
		]);
	});

	/** 验证缺少提供方环境时不擅自删除或改写占位符。 */
	it("keeps placeholders when the provider env does not resolve them", () => {
		/** 底层函数最后捕获到的 URL。 */
		let captured: string | undefined;
		/** 注入相同捕获逻辑的流包装器。 */
		const streams = cloudflareStreams({
			stream: (requestModel) => {
				captured = requestModel.baseUrl;
				return new AssistantMessageEventStream();
			},
			streamSimple: (requestModel) => {
				captured = requestModel.baseUrl;
				return new AssistantMessageEventStream();
			},
		});

		streams.streamSimple(model, context, {});

		expect(captured).toBe(model.baseUrl);
	});
});
