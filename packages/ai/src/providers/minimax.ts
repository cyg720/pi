import { anthropicMessagesApi } from "../api/anthropic-messages.lazy.ts";
import { envApiKeyAuth } from "../auth/helpers.ts";
import { createProvider, type Provider } from "../models.ts";
import { MINIMAX_MODELS } from "./minimax.models.ts";

/**
 * 【文件职责】MiniMax 供应商工厂。
 * 【新手阅读建议】看供应商注册结构。
 */
export function minimaxProvider(): Provider<"anthropic-messages"> {
	return createProvider({
		id: "minimax",
		name: "MiniMax",
		baseUrl: "https://api.minimax.io/anthropic",
		auth: { apiKey: envApiKeyAuth("MiniMax API key", ["MINIMAX_API_KEY"]) },
		models: Object.values(MINIMAX_MODELS),
		api: anthropicMessagesApi(),
	});
}
