import { openrouterImagesApi } from "../api/openrouter-images.lazy.ts";
import { envApiKeyAuth, lazyOAuth } from "../auth/helpers.ts";
import { loadOpenRouterOAuth } from "../auth/oauth/load.ts";
import { IMAGE_MODELS } from "../image-models.generated.ts";
import { createImagesProvider, type ImagesProvider } from "../images-models.ts";

/**
 * 【文件职责】OpenRouter 图片供应商工厂。
 * 【新手阅读建议】看图片供应商注册结构。
 */
export function openrouterImagesProvider(): ImagesProvider {
	return createImagesProvider({
		id: "openrouter",
		name: "OpenRouter",
		auth: {
			apiKey: envApiKeyAuth("OpenRouter API key", ["OPENROUTER_API_KEY"]),
			oauth: lazyOAuth({
				name: "OpenRouter OAuth",
				loginLabel: "Sign in with OpenRouter",
				load: loadOpenRouterOAuth,
			}),
		},
		models: Object.values(IMAGE_MODELS.openrouter),
		api: openrouterImagesApi(),
	});
}
