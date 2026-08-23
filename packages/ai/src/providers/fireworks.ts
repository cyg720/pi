import { anthropicMessagesApi } from "../api/anthropic-messages.lazy.ts";
import { openAICompletionsApi } from "../api/openai-completions.lazy.ts";
import { envApiKeyAuth } from "../auth/helpers.ts";
import { createProvider, type Provider } from "../models.ts";
import { FIREWORKS_MODELS } from "./fireworks.models.ts";

/**
 * 【文件职责】Fireworks 供应商工厂（Anthropic/OpenAI 兼容）。
 * 【新手阅读建议】看供应商注册结构。
 */
export function fireworksProvider(): Provider<"anthropic-messages" | "openai-completions"> {
	return createProvider({
		id: "fireworks",
		name: "Fireworks",
		baseUrl: "https://api.fireworks.ai/inference",
		auth: { apiKey: envApiKeyAuth("Fireworks API key", ["FIREWORKS_API_KEY"]) },
		models: Object.values(FIREWORKS_MODELS),
		api: {
			"anthropic-messages": anthropicMessagesApi(),
			"openai-completions": openAICompletionsApi(),
		},
	});
}
