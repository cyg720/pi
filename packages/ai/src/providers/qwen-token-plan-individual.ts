/**
 * 【文件职责】实现 `@earendil-works/pi-ai` 包中的 `providers/qwen-token-plan-individual` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `../api/openai-completions.lazy.ts`、`../auth/helpers.ts`、`../models.ts`、`./qwen-token-plan-individual.models.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为不同大模型提供统一 API、模型发现和供应商配置能力；本文件负责其中与 `providers/qwen-token-plan-individual` 对应的子能力。
 * 【逻辑维度】对外入口包括 `qwenTokenPlanIndividualProvider`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `qwenTokenPlanIndividualProvider` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import { openAICompletionsApi } from "../api/openai-completions.lazy.ts";
import { envApiKeyAuth } from "../auth/helpers.ts";
import { createProvider, type Provider } from "../models.ts";
import { QWEN_TOKEN_PLAN_INDIVIDUAL_MODELS } from "./qwen-token-plan-individual.models.ts";

export function qwenTokenPlanIndividualProvider(): Provider<"openai-completions"> {
	return createProvider({
		id: "qwen-token-plan-individual",
		name: "Qwen Token Plan Individual",
		baseUrl: "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1",
		auth: { apiKey: envApiKeyAuth("Qwen Token Plan Individual API key", ["QWEN_TOKEN_PLAN_API_KEY"]) },
		models: Object.values(QWEN_TOKEN_PLAN_INDIVIDUAL_MODELS),
		api: openAICompletionsApi(),
	});
}
