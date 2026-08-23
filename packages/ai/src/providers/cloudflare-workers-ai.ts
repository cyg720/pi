import { openAICompletionsApi } from "../api/openai-completions.lazy.ts";
import { createProvider, type Provider } from "../models.ts";
import { cloudflareWorkersAIAuth } from "./cloudflare-auth.ts";
import { cloudflareStreams } from "./cloudflare-stream.ts";
import { CLOUDFLARE_WORKERS_AI_MODELS } from "./cloudflare-workers-ai.models.ts";

/**
 * 【文件职责】Cloudflare Workers AI 供应商工厂。
 * 【新手阅读建议】看供应商注册结构。
 */
export function cloudflareWorkersAIProvider(): Provider<"openai-completions"> {
	return createProvider({
		id: "cloudflare-workers-ai",
		name: "Cloudflare Workers AI",
		auth: { apiKey: cloudflareWorkersAIAuth() },
		models: Object.values(CLOUDFLARE_WORKERS_AI_MODELS),
		api: cloudflareStreams(openAICompletionsApi()),
	});
}
