import { openAICompletionsApi } from "../api/openai-completions.lazy.ts";
import { envApiKeyAuth } from "../auth/helpers.ts";
import { createProvider, type Provider } from "../models.ts";
import { TOGETHER_MODELS } from "./together.models.ts";

/**
 * 【文件职责】Together AI 供应商工厂（OpenAI 兼容）。
 * 【新手阅读建议】看供应商注册结构。
 */
export function togetherProvider(): Provider<"openai-completions"> {
	return createProvider({
		id: "together",
		name: "Together",
		baseUrl: "https://api.together.ai/v1",
		auth: { apiKey: envApiKeyAuth("Together API key", ["TOGETHER_API_KEY"]) },
		models: Object.values(TOGETHER_MODELS),
		api: openAICompletionsApi(),
	});
}
