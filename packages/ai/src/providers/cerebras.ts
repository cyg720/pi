import { openAICompletionsApi } from "../api/openai-completions.lazy.ts";
import { envApiKeyAuth } from "../auth/helpers.ts";
import { createProvider, type Provider } from "../models.ts";
import { CEREBRAS_MODELS } from "./cerebras.models.ts";

/**
 * 【文件职责】Cerebras 供应商工厂（OpenAI 兼容）。
 * 【新手阅读建议】看供应商注册结构。
 */
export function cerebrasProvider(): Provider<"openai-completions"> {
	return createProvider({
		id: "cerebras",
		name: "Cerebras",
		baseUrl: "https://api.cerebras.ai/v1",
		auth: { apiKey: envApiKeyAuth("Cerebras API key", ["CEREBRAS_API_KEY"]) },
		models: Object.values(CEREBRAS_MODELS),
		api: openAICompletionsApi(),
	});
}
