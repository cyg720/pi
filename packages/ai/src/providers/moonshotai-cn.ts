import { openAICompletionsApi } from "../api/openai-completions.lazy.ts";
import { envApiKeyAuth } from "../auth/helpers.ts";
import { createProvider, type Provider } from "../models.ts";
import { MOONSHOTAI_CN_MODELS } from "./moonshotai-cn.models.ts";

/**
 * 【文件职责】Moonshot AI（中国站）供应商工厂。
 * 【新手阅读建议】看供应商注册结构。
 */
export function moonshotaiCnProvider(): Provider<"openai-completions"> {
	return createProvider({
		id: "moonshotai-cn",
		name: "Moonshot AI CN",
		baseUrl: "https://api.moonshot.cn/v1",
		auth: { apiKey: envApiKeyAuth("Moonshot AI API key", ["MOONSHOT_API_KEY"]) },
		models: Object.values(MOONSHOTAI_CN_MODELS),
		api: openAICompletionsApi(),
	});
}
