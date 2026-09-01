/**
 * 【文件职责】实现 `@earendil-works/pi-ai` 包中的 `providers/cloudflare-ai-gateway` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `../api/anthropic-messages.lazy.ts`、`../api/openai-completions.lazy.ts`、`../api/openai-responses.lazy.ts`、`../models.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为不同大模型提供统一 API、模型发现和供应商配置能力；本文件负责其中与 `providers/cloudflare-ai-gateway` 对应的子能力。
 * 【逻辑维度】对外入口包括 `cloudflareAIGatewayProvider`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `cloudflareAIGatewayProvider` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import { anthropicMessagesApi } from "../api/anthropic-messages.lazy.ts";
import { openAICompletionsApi } from "../api/openai-completions.lazy.ts";
import { openAIResponsesApi } from "../api/openai-responses.lazy.ts";
import { createProvider, type Provider } from "../models.ts";
import { CLOUDFLARE_AI_GATEWAY_MODELS } from "./cloudflare-ai-gateway.models.ts";
import { cloudflareAIGatewayAuth } from "./cloudflare-auth.ts";
import { cloudflareStreams } from "./cloudflare-stream.ts";

type CloudflareAIGatewayApi = "anthropic-messages" | "openai-completions" | "openai-responses";

export function cloudflareAIGatewayProvider(): Provider<CloudflareAIGatewayApi> {
	return createProvider<CloudflareAIGatewayApi>({
		id: "cloudflare-ai-gateway",
		name: "Cloudflare AI Gateway",
		auth: { apiKey: cloudflareAIGatewayAuth() },
		models: Object.values(CLOUDFLARE_AI_GATEWAY_MODELS),
		api: {
			"anthropic-messages": cloudflareStreams(anthropicMessagesApi()),
			"openai-completions": cloudflareStreams(openAICompletionsApi()),
			"openai-responses": cloudflareStreams(openAIResponsesApi()),
		},
	});
}
