import { openAICompletionsApi } from "../api/openai-completions.lazy.ts";
import { envApiKeyAuth } from "../auth/helpers.ts";
import { createProvider, type Provider } from "../models.ts";
import { XIAOMI_TOKEN_PLAN_AMS_MODELS } from "./xiaomi-token-plan-ams.models.ts";

/**
 * 【文件职责】小米 Token Plan（AMS 区）供应商工厂。
 * 【新手阅读建议】看供应商注册结构。
 */
export function xiaomiTokenPlanAmsProvider(): Provider<"openai-completions"> {
	return createProvider({
		id: "xiaomi-token-plan-ams",
		name: "Xiaomi Token Plan AMS",
		baseUrl: "https://token-plan-ams.xiaomimimo.com/v1",
		auth: { apiKey: envApiKeyAuth("Xiaomi Token Plan AMS API key", ["XIAOMI_TOKEN_PLAN_AMS_API_KEY"]) },
		models: Object.values(XIAOMI_TOKEN_PLAN_AMS_MODELS),
		api: openAICompletionsApi(),
	});
}
