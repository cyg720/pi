import { cloudflareWorkersAISystemOneApi } from "../api/cloudflare-workers-ai-system-one.lazy.ts";
import { openAICompletionsApi } from "../api/openai-completions.lazy.ts";
import { createProvider, type Provider } from "../models.ts";
import { cloudflareWorkersAIAuth } from "./cloudflare-auth.ts";
import { cloudflareClassifier, cloudflareStreams } from "./cloudflare-stream.ts";
import {
	CLOUDFLARE_WORKERS_AI_CLASSIFIER_MODELS,
	CLOUDFLARE_WORKERS_AI_MODELS,
} from "./cloudflare-workers-ai.models.ts";

/**
 * 【文件职责】Cloudflare Workers AI 供应商工厂。
 * 【新手阅读建议】看供应商注册结构。
 */
export function cloudflareWorkersAIProvider(): Provider<"openai-completions"> {
	return createProvider<"openai-completions">({
		id: "cloudflare-workers-ai",
		name: "Cloudflare Workers AI",
		auth: { apiKey: cloudflareWorkersAIAuth() },
		models: [
			...Object.values(CLOUDFLARE_WORKERS_AI_MODELS),
			...Object.values(CLOUDFLARE_WORKERS_AI_CLASSIFIER_MODELS),
		],
		api: cloudflareStreams(openAICompletionsApi()),
		classifiers: {
			"cloudflare-workers-ai-system-one": cloudflareClassifier(cloudflareWorkersAISystemOneApi()),
		},
	});
}
