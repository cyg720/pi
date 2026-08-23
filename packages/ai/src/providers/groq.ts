import { openAICompletionsApi } from "../api/openai-completions.lazy.ts";
import { envApiKeyAuth } from "../auth/helpers.ts";
import { createProvider, type Provider } from "../models.ts";
import { GROQ_MODELS } from "./groq.models.ts";

/**
 * 【文件职责】Groq 供应商工厂（OpenAI 兼容）。
 * 【新手阅读建议】看供应商注册结构。
 */
export function groqProvider(): Provider<"openai-completions"> {
	return createProvider({
		id: "groq",
		name: "Groq",
		baseUrl: "https://api.groq.com/openai/v1",
		auth: { apiKey: envApiKeyAuth("Groq API key", ["GROQ_API_KEY"]) },
		models: Object.values(GROQ_MODELS),
		api: openAICompletionsApi(),
	});
}
