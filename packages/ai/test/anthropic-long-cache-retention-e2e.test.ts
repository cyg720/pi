/**
 * 文件职责：端到端验证所有 Anthropic Messages 模型目录覆盖，并为每个供应商探测长缓存保留能力。
 * 技术维度：使用 Vitest 条件跳过、真实供应商凭据、生成模型目录和 complete API 发起在线请求。
 * 产品维度：确保声明支持长缓存的模型在真实服务端接受 cacheRetention=long，降低长提示重复成本。
 * 逻辑维度：枚举模型，按供应商选择低成本代表，强制开启兼容标记，再逐个执行短回复探针。
 * 关键边界：有密钥的用例会产生真实费用和网络请求；模型选择优先低成本但仍可能随目录变化。
 * 新手阅读建议：先读覆盖性测试，再理解 getProbePriority 的选择策略，最后看在线探针参数。
 */
import { describe, expect, it } from "vitest";
import { type BuiltinProvider, complete, getModels, getProviders } from "../src/compat.ts";
import { getEnvApiKey } from "../src/env-api-keys.ts";
import type { Api, KnownProvider, Model, ProviderStreamOptions } from "../src/types.ts";
import { resolveApiKey } from "./oauth.ts";

// GitHub Copilot 凭据；支持 OAuth 解析，模块加载时只执行一次。
const githubCopilotToken = await resolveApiKey("github-copilot");

// 单个长缓存端到端用例的数据结构。
interface AnthropicLongCacheRetentionE2ECase {
	name: string;
	provider: BuiltinProvider;
	model: Model<"anthropic-messages">;
	apiKey: string | undefined;
}

/** 功能：取得指定供应商的端到端密钥；参数 provider；返回：密钥或 undefined。示例：getE2EApiKey("anthropic")。 */
function getE2EApiKey(provider: KnownProvider): string | undefined {
	if (provider === "github-copilot") {
		return githubCopilotToken;
	}
	return getEnvApiKey(provider);
}

/** 功能：筛出供应商的 anthropic-messages 模型；参数 provider；返回：已收窄类型的模型数组。示例：getAnthropicMessagesModels("anthropic")。 */
function getAnthropicMessagesModels(provider: BuiltinProvider): Model<"anthropic-messages">[] {
	// 供应商的全部 API 类型模型，随后按 api 字段过滤。
	const models = getModels(provider) as Model<Api>[];
	return models.filter((model) => model.api === "anthropic-messages") as Model<"anthropic-messages">[];
}

// 所有内置供应商的 Anthropic Messages 用例；名称、模型和可用密钥在此集中绑定。
const anthropicMessagesCases: AnthropicLongCacheRetentionE2ECase[] = getProviders().flatMap((provider) =>
	getAnthropicMessagesModels(provider).map((model) => ({
		name: `${provider}/${model.id}`,
		provider,
		model,
		apiKey: getE2EApiKey(provider),
	})),
);

/** 功能：计算在线探针的模型优先级；参数 model；返回：越小越优的数值。示例：getProbePriority(model)。 */
function getProbePriority(model: Model<"anthropic-messages">): number {
	// 小写模型 id，便于不区分大小写地识别 Claude 系列。
	const modelId = model.id.toLowerCase();
	// 输入与输出单价之和，作为默认低成本排序依据。
	const cost = model.cost.input + model.cost.output;
	// 可调整优先级；Claude 4 的轻量模型会获得额外负权重。
	let priority = cost;

	if (modelId.includes("haiku") && (modelId.includes("4-5") || modelId.includes("4.5"))) {
		priority -= 1000;
	} else if (modelId.includes("sonnet") && (modelId.includes("4-") || modelId.includes("4."))) {
		priority -= 750;
	} else if (modelId.includes("claude") && (modelId.includes("4-") || modelId.includes("4."))) {
		priority -= 500;
	}

	return priority;
}

/** 功能：每个供应商选择一个最低优先级探针；参数 cases；返回：代表用例数组。示例：selectOneCasePerProvider(allCases)。 */
function selectOneCasePerProvider(cases: AnthropicLongCacheRetentionE2ECase[]): AnthropicLongCacheRetentionE2ECase[] {
	// 按供应商分组的用例映射。
	const byProvider = new Map<BuiltinProvider, AnthropicLongCacheRetentionE2ECase[]>();
	for (const testCase of cases) {
		// 当前供应商已收集的用例；首次出现时使用空数组。
		const providerCases = byProvider.get(testCase.provider) ?? [];
		providerCases.push(testCase);
		byProvider.set(testCase.provider, providerCases);
	}

	return Array.from(byProvider.values()).map(
		(providerCases) =>
			providerCases.sort(
				(a, b) => getProbePriority(a.model) - getProbePriority(b.model) || a.model.id.localeCompare(b.model.id),
			)[0],
	);
}

// 每个供应商最终选中的单个在线探针用例。
const probeCases = selectOneCasePerProvider(anthropicMessagesCases);

/** 功能：复制模型并强制声明长缓存支持；参数 model；返回：带兼容标记的新模型。示例：withLongCacheRetention(testCase.model)。 */
function withLongCacheRetention(model: Model<"anthropic-messages">): Model<"anthropic-messages"> {
	return {
		...model,
		compat: {
			...model.compat,
			supportsLongCacheRetention: true,
		},
	};
}

/** 功能：向真实服务发送长缓存请求并断言接受；参数 model、apiKey；返回：完成 Promise。示例：await expectLongCacheRetentionAccepted(model, key)。 */
async function expectLongCacheRetentionAccepted(
	model: Model<"anthropic-messages">,
	apiKey: string | undefined,
): Promise<void> {
	// 在线请求选项；关闭思考以压低输出成本，并把最大输出限制为 128。
	const options: ProviderStreamOptions = {
		apiKey,
		cacheRetention: "long",
		maxTokens: 128,
		thinkingEnabled: false,
	};
	// 真实供应商返回的助手响应。
	const response = await complete(
		model,
		{
			systemPrompt: "You are a concise assistant.",
			messages: [
				{
					role: "user",
					content: "Reply with exactly: long cache retention accepted",
					timestamp: Date.now(),
				},
			],
		},
		options,
	);

	expect(response.errorMessage, response.errorMessage).toBeFalsy();
	expect(response.stopReason, response.errorMessage).not.toBe("error");
}

describe("Anthropic Messages long cache retention E2E", () => {
	it("covers every generated anthropic-messages model", () => {
		// 直接从生成模型目录计算的 provider/model 名称全集。
		const expectedModels = getProviders().flatMap((provider) =>
			getAnthropicMessagesModels(provider).map((model) => `${provider}/${model.id}`),
		);
		expect(anthropicMessagesCases.map((testCase) => testCase.name).sort()).toEqual(expectedModels.sort());
	});

	describe("forced long cache retention probe", () => {
		for (const testCase of probeCases) {
			// 当前供应商代表模型的长缓存兼容副本。
			const model = withLongCacheRetention(testCase.model);

			it.skipIf(!testCase.apiKey)(`${testCase.name} accepts long cache retention`, { retry: 2 }, async () => {
				await expectLongCacheRetentionAccepted(model, testCase.apiKey);
			});
		}
	});
});
