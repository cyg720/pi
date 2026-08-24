/**
 * 文件职责：验证 Together 模型目录中的默认配置、推理控制映射和环境密钥解析。
 * 技术维度：使用 Vitest、统一模型目录兼容入口和环境变量密钥辅助函数执行静态断言。
 * 产品维度：确保用户选择 Together 模型时获得正确端点、能力、费用和推理档位。
 * 逻辑维度：检查 Kimi 完整模型元数据，对比三个推理模型，再测试 TOGETHER_API_KEY。
 * 关键边界：不发起真实网络请求；用例会临时修改环境变量并在 afterEach 恢复原值。
 * 新手阅读建议：先看 Kimi 的完整配置断言，再比较三种 thinkingLevelMap，最后看密钥解析。
 */
import { afterEach, describe, expect, it } from "vitest";
import { getModel } from "../src/compat.ts";
import { findEnvKeys, getEnvApiKey } from "../src/env-api-keys.ts";

// originalTogetherApiKey 保存测试启动前的 Together 密钥，可能未定义。
const originalTogetherApiKey = process.env.TOGETHER_API_KEY;

// 每个用例后恢复原始 Together 环境密钥；无参数，无返回值。
afterEach(() => {
	if (originalTogetherApiKey === undefined) {
		delete process.env.TOGETHER_API_KEY;
	} else {
		process.env.TOGETHER_API_KEY = originalTogetherApiKey;
	}
});

describe("Together models", () => {
	// 验证默认 Kimi K2.6 的协议、能力、窗口、费用和兼容配置；无参数，无返回值。
	it("registers the default Kimi K2.6 model via OpenAI-compatible Chat Completions API", () => {
		// model 是从统一目录取得的 Together Kimi K2.6 配置。
		const model = getModel("together", "moonshotai/Kimi-K2.6");

		expect(model).toBeDefined();
		expect(model.api).toBe("openai-completions");
		expect(model.provider).toBe("together");
		expect(model.baseUrl).toBe("https://api.together.ai/v1");
		expect(model.reasoning).toBe(true);
		expect(model.thinkingLevelMap).toEqual({ minimal: null, low: null, medium: null });
		expect(model.input).toEqual(["text", "image"]);
		expect(model.contextWindow).toBe(262144);
		expect(model.maxTokens).toBe(131000);
		expect(model.cost).toEqual({
			input: 1.2,
			output: 4.5,
			cacheRead: 0.2,
			cacheWrite: 0,
		});
		expect(model.compat).toEqual({
			supportsStore: false,
			supportsDeveloperRole: false,
			supportsReasoningEffort: false,
			maxTokensField: "max_tokens",
			thinkingFormat: "together",
			supportsStrictMode: false,
			supportsLongCacheRetention: false,
		});
	});

	// 验证不同 Together 模型只暴露其 API 实际支持的推理档位；无参数，无返回值。
	it("models Together reasoning controls from the Together API surface", () => {
		// gptOss 是使用 OpenAI 推理格式且支持 low 到 high 的模型。
		const gptOss = getModel("together", "openai/gpt-oss-120b");
		expect(gptOss.thinkingLevelMap).toEqual({
			off: null,
			minimal: null,
			low: "low",
			medium: "medium",
			high: "high",
			max: null,
			xhigh: null,
		});
		expect(gptOss.compat).toMatchObject({
			supportsReasoningEffort: true,
			thinkingFormat: "openai",
		});

		// deepSeekV4 是只在 high 档启用 Together 思考格式的模型。
		const deepSeekV4 = getModel("together", "deepseek-ai/DeepSeek-V4-Pro");
		expect(deepSeekV4.thinkingLevelMap).toEqual({
			minimal: null,
			low: null,
			medium: null,
			high: "high",
			xhigh: null,
		});
		expect(deepSeekV4.compat).toMatchObject({
			supportsReasoningEffort: true,
			thinkingFormat: "together",
		});

		// minimax 是不支持显式推理强度的模型。
		const minimax = getModel("together", "MiniMaxAI/MiniMax-M2.7");
		expect(minimax.thinkingLevelMap).toEqual({ off: null, minimal: null, low: null, medium: null });
		expect(minimax.compat?.thinkingFormat).toBeUndefined();
		expect(minimax.compat?.supportsReasoningEffort).toBe(false);
	});

	// 验证 Together 提供商声明并读取标准环境密钥；无参数，无返回值。
	it("resolves TOGETHER_API_KEY from the environment", () => {
		process.env.TOGETHER_API_KEY = "test-together-key";

		expect(findEnvKeys("together")).toEqual(["TOGETHER_API_KEY"]);
		expect(getEnvApiKey("together")).toBe("test-together-key");
	});
});
