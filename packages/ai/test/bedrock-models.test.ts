/**
 * A test suite to ensure all configured Amazon Bedrock models are usable.
 *
 * This is here to make sure we got correct model identifiers from models.dev and other sources.
 * Because Amazon Bedrock requires cross-region inference in some models,
 * plain model identifiers are not always usable and it requires tweaking of model identifiers to use cross-region inference.
 * See https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html#inference-profiles-support-system for more details.
 *
 * This test suite is not enabled by default unless AWS credentials and `BEDROCK_EXTENSIVE_MODEL_TEST` environment variables are set.
 * This test suite takes ~2 minutes to run. Because not all models are available in all regions,
 * it's recommended to use `us-west-2` region for best coverage for running this test suite.
 *
 * You can run this test suite with:
 * ```bash
 * $ AWS_REGION=us-west-2 BEDROCK_EXTENSIVE_MODEL_TEST=1 AWS_PROFILE=... npm test -- ./test/bedrock-models.test.ts
 * ```
 */
/**
 * 文件职责：验证模型目录中配置的 Amazon Bedrock 模型标识和基础调用能力是否可用。
 * 技术维度：使用 Vitest、Bedrock 凭据探测、模型目录查询和统一 complete 接口执行断言。
 * 产品维度：降低用户选择 Bedrock 模型后因区域推理配置错误而无法对话的风险。
 * 逻辑维度：先检查模型目录和 Opus 5 推理配置，再在显式开启时逐个发送真实请求。
 * 关键边界：全模型请求依赖有效 AWS 凭据和环境变量，且会访问真实服务并产生耗时或费用。
 * 新手阅读建议：先看两个离线目录断言，再结合顶部运行说明理解条件测试和跨区域模型标识。
 */

import { describe, expect, it } from "vitest";
import { complete, getModels } from "../src/compat.ts";
import type { Context } from "../src/types.ts";
import { hasBedrockCredentials } from "./bedrock-utils.ts";

describe("Amazon Bedrock Models", () => {
	// 保存当前目录中全部 Bedrock 模型，供本测试组的目录与真实请求用例复用。
	const models = getModels("amazon-bedrock");

	// 验证模型目录至少提供一个 Bedrock 模型；无参数，无返回值示例：目录为空时测试失败。
	it("should get all available Bedrock models", () => {
		expect(models.length).toBeGreaterThan(0);
		console.log(`Found ${models.length} Bedrock models`);
	});

	// 验证 Opus 5 只暴露可调用的全局推理配置标识；无参数，无返回值。
	it("exposes Claude Opus 5 through an inference profile only", () => {
		// model 表示当前被检查的目录项；回调返回其标识是否为全局推理配置。
		expect(models.some((model) => model.id === "global.anthropic.claude-opus-5")).toBe(true);
		// model 表示当前被检查的目录项；回调用于排除不可直接调用的裸模型标识。
		expect(models.some((model) => model.id === "anthropic.claude-opus-5")).toBe(false);
	});

	// 只有具备凭据并显式开启广泛模型测试时，才注册会访问真实服务的用例。
	if (hasBedrockCredentials() && process.env.BEDROCK_EXTENSIVE_MODEL_TEST) {
		// model 是当前待验证的 Bedrock 模型，每个模型都会生成一个独立用例。
		for (const model of models) {
			// 向当前模型发送最小请求；参数由闭包中的 model 提供，无返回值示例：响应异常时断言失败。
			it(`should make a simple request with ${model.id}`, { timeout: 10_000 }, async () => {
				// 构造统一对话上下文，要求模型仅返回简短的 OK 文本。
				const context: Context = {
					systemPrompt: "You are a helpful assistant. Be extremely concise.",
					messages: [
						{
							role: "user",
							content: "Reply with exactly: 'OK'",
							timestamp: Date.now(),
						},
					],
				};

				// 保存统一完成接口返回的助手消息，用于检查内容、用量和错误信息。
				const response = await complete(model, context);

				expect(response.role).toBe("assistant");
				expect(response.content).toBeTruthy();
				expect(response.content.length).toBeGreaterThan(0);
				expect(response.usage.input + response.usage.cacheRead).toBeGreaterThan(0);
				expect(response.usage.output).toBeGreaterThan(0);
				expect(response.errorMessage).toBeFalsy();

				// 提取响应中的全部文本块；b 是当前内容块，最终得到去除首尾空白的文本。
				const textContent = response.content
					.filter((b) => b.type === "text")
					.map((b) => (b.type === "text" ? b.text : ""))
					.join("")
					.trim();
				expect(textContent).toBeTruthy();
				console.log(`${model.id}: ${textContent.substring(0, 100)}`);
			});
		}
	}
});
