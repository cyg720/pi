import { openAICompletionsApi } from "../api/openai-completions.lazy.ts";
import { envApiKeyAuth } from "../auth/helpers.ts";
import { createProvider, type Provider } from "../models.ts";
import { XIAOMI_TOKEN_PLAN_SGP_MODELS } from "./xiaomi-token-plan-sgp.models.ts";

/**
 * 【文件职责】小米 Token Plan（新加坡区）供应商工厂。
 * 【新手阅读建议】看供应商注册结构。
 */
export function xiaomiTokenPlanSgpProvider(): Provider<"openai-completions"> {
	return createProvider({
		id: "xiaomi-token-plan-sgp",
		name: "Xiaomi Token Plan SGP",
		baseUrl: "https://token-plan-sgp.xiaomimimo.com/v1",
		auth: { apiKey: envApiKeyAuth("Xiaomi Token Plan SGP API key", ["XIAOMI_TOKEN_PLAN_SGP_API_KEY"]) },
		models: Object.values(XIAOMI_TOKEN_PLAN_SGP_MODELS),
		api: openAICompletionsApi(),
	});
}
