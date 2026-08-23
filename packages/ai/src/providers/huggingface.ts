import { openAICompletionsApi } from "../api/openai-completions.lazy.ts";
import { envApiKeyAuth } from "../auth/helpers.ts";
import { createProvider, type Provider } from "../models.ts";
import { HUGGINGFACE_MODELS } from "./huggingface.models.ts";

/**
 * 【文件职责】HuggingFace 供应商工厂。
 * 【新手阅读建议】看供应商注册结构。
 */
export function huggingfaceProvider(): Provider<"openai-completions"> {
	return createProvider({
		id: "huggingface",
		name: "Hugging Face",
		baseUrl: "https://router.huggingface.co/v1",
		auth: { apiKey: envApiKeyAuth("Hugging Face token", ["HF_TOKEN"]) },
		models: Object.values(HUGGINGFACE_MODELS),
		api: openAICompletionsApi(),
	});
}
