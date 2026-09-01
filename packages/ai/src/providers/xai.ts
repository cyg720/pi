/**
 * 【文件职责】实现 `@earendil-works/pi-ai` 包中的 `providers/xai` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `../api/openai-responses.lazy.ts`、`../auth/helpers.ts`、`../auth/oauth/load.ts`、`../models.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为不同大模型提供统一 API、模型发现和供应商配置能力；本文件负责其中与 `providers/xai` 对应的子能力。
 * 【逻辑维度】对外入口包括 `xaiProvider`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `xaiProvider` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import { openAIResponsesApi } from "../api/openai-responses.lazy.ts";
import { envApiKeyAuth, lazyOAuth } from "../auth/helpers.ts";
import { loadXaiOAuth } from "../auth/oauth/load.ts";
import { createProvider, type Provider } from "../models.ts";
import { XAI_MODELS } from "./xai.models.ts";

export function xaiProvider(): Provider<"openai-responses"> {
	return createProvider({
		id: "xai",
		name: "xAI",
		baseUrl: "https://api.x.ai/v1",
		auth: {
			apiKey: envApiKeyAuth("xAI API key", ["XAI_API_KEY"]),
			oauth: lazyOAuth({
				name: "xAI (Grok/X subscription)",
				isSubscription: true,
				loginLabel: "Sign in with SuperGrok or X Premium",
				load: loadXaiOAuth,
			}),
		},
		models: Object.values(XAI_MODELS),
		api: openAIResponsesApi(),
	});
}
