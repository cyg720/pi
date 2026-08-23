import { anthropicMessagesApi } from "../api/anthropic-messages.lazy.ts";
import { envApiKeyAuth } from "../auth/helpers.ts";
import { createProvider, type Provider } from "../models.ts";
import { VERCEL_AI_GATEWAY_MODELS } from "./vercel-ai-gateway.models.ts";

/**
 * 【文件职责】Vercel AI Gateway 供应商工厂（路由偏好支持）。
 * 【新手阅读建议】看供应商注册结构。
 */
export function vercelAIGatewayProvider(): Provider<"anthropic-messages"> {
	return createProvider({
		id: "vercel-ai-gateway",
		name: "Vercel AI Gateway",
		baseUrl: "https://ai-gateway.vercel.sh",
		auth: { apiKey: envApiKeyAuth("Vercel AI Gateway API key", ["AI_GATEWAY_API_KEY"]) },
		models: Object.values(VERCEL_AI_GATEWAY_MODELS),
		api: anthropicMessagesApi(),
	});
}
