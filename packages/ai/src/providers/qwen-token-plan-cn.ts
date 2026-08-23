import { openAICompletionsApi } from "../api/openai-completions.lazy.ts";
import { envApiKeyAuth } from "../auth/helpers.ts";
import { createProvider, type Provider } from "../models.ts";
import { QWEN_TOKEN_PLAN_CN_MODELS } from "./qwen-token-plan-cn.models.ts";

/**
 * 【文件职责】Qwen Token Plan（中国站）供应商工厂。
 * 【新手阅读建议】看供应商注册结构。
 */
export function qwenTokenPlanCnProvider(): Provider<"openai-completions"> {
	return createProvider({
		id: "qwen-token-plan-cn",
		name: "Qwen Token Plan CN",
		baseUrl: "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
		auth: { apiKey: envApiKeyAuth("Qwen Token Plan CN API key", ["QWEN_TOKEN_PLAN_CN_API_KEY"]) },
		models: Object.values(QWEN_TOKEN_PLAN_CN_MODELS),
		api: openAICompletionsApi(),
	});
}
