/**
 * 文件职责：对所有 Anthropic Messages 路由执行急切工具输入流式传输兼容性的真实端到端探测。
 * 技术维度：使用 Vitest 动态生成参数化用例，通过统一 complete API、TypeBox 工具模式和真实提供商凭据发起请求。
 * 产品维度：提前发现模型目录或代理路由不支持 eager_input_streaming，避免用户调用工具时出现线上协议错误。
 * 逻辑维度：收集全部模型，按提供商选择低成本代表模型，再分别验证生成配置与强制开启配置。
 * 关键边界：需要真实 API 密钥并会产生网络请求和少量费用；无凭据的提供商会跳过，失败用例最多重试两次。
 * 新手阅读建议：先看模型筛选和优先级，再看 expectToolEnabledRequestAccepted 发出的最小工具请求。
 */
import { Type } from "typebox";
import { describe, expect, it } from "vitest";
import { type BuiltinProvider, complete, getModels, getProviders } from "../src/compat.ts";
import { getEnvApiKey } from "../src/env-api-keys.ts";
import type { Api, KnownProvider, Model, ProviderStreamOptions, Tool } from "../src/types.ts";
import { resolveApiKey } from "./oauth.ts";

// githubCopilotToken 通过 OAuth 测试辅助器解析，可能因未登录而为 undefined。
const githubCopilotToken = await resolveApiKey("github-copilot");

// echoToolSchema 定义探测工具唯一的字符串参数，便于模型稳定生成合法调用。
const echoToolSchema = Type.Object({
	value: Type.String({ description: "The value to echo" }),
});

// echoTool 是端到端请求中提供给模型的最小回显工具定义。
const echoTool: Tool<typeof echoToolSchema> = {
	name: "echo_value",
	description: "Echo a string value",
	parameters: echoToolSchema,
};

// AnthropicEagerE2ECase 描述一条包含提供商、模型和可选凭据的动态探测用例。
interface AnthropicEagerE2ECase {
	name: string;
	provider: BuiltinProvider;
	model: Model<"anthropic-messages">;
	apiKey: string | undefined;
}

/**
 * 获取指定提供商的端到端测试密钥。
 * @param provider 已知提供商名称；Copilot 使用 OAuth，其余读取环境变量。
 * @returns 可用密钥或 undefined；例如 `getE2EApiKey("anthropic")`。
 */
function getE2EApiKey(provider: KnownProvider): string | undefined {
	if (provider === "github-copilot") {
		return githubCopilotToken;
	}
	return getEnvApiKey(provider);
}

/**
 * 筛选某个内置提供商中使用 anthropic-messages API 的模型。
 * @param provider 内置提供商标识。
 * @returns 类型已收窄的模型数组；例如 `getAnthropicMessagesModels("anthropic")`。
 */
function getAnthropicMessagesModels(provider: BuiltinProvider): Model<"anthropic-messages">[] {
	// models 是提供商目录中的全部 API 类型模型。
	const models = getModels(provider) as Model<Api>[];
	return models.filter((model) => model.api === "anthropic-messages") as Model<"anthropic-messages">[];
}

// anthropicMessagesCases 展开所有提供商与其 Anthropic Messages 模型，并附加可用凭据。
const anthropicMessagesCases: AnthropicEagerE2ECase[] = getProviders().flatMap((provider) =>
	getAnthropicMessagesModels(provider).map((model) => ({
		name: `${provider}/${model.id}`,
		provider,
		model,
		apiKey: getE2EApiKey(provider),
	})),
);

/**
 * 计算模型作为低成本兼容性探针的排序分数，值越小越优先。
 * @param model 待评估的 Anthropic Messages 模型。
 * @returns 基于输入输出价格和 Claude 4 系列偏好的数值优先级；例如 Haiku 4 通常最小。
 */
function getProbePriority(model: Model<"anthropic-messages">): number {
	// modelId 是统一小写后的模型标识，便于做系列名称匹配。
	const modelId = model.id.toLowerCase();
	// cost 是输入与输出百万令牌价格之和，作为基础排序值。
	const cost = model.cost.input + model.cost.output;
	// priority 从成本开始，再按稳定且便宜的新 Claude 路由给予负向奖励。
	let priority = cost;

	// Prefer current Claude 4 Haiku routes when present: they are cheap and avoid
	// 优先选择当前 Claude 4 Haiku 路由：成本低，也避开可能已被上游移除的旧 Claude 3.x 别名。
	// stale Claude 3.x aliases that can remain in catalogs after upstream removal.
	// 模型目录可能暂时保留旧别名，因此需要额外降低新模型的排序分数。
	if (modelId.includes("haiku") && (modelId.includes("4-5") || modelId.includes("4.5"))) {
		priority -= 1000;
	} else if (modelId.includes("sonnet") && (modelId.includes("4-") || modelId.includes("4."))) {
		priority -= 750;
	} else if (modelId.includes("claude") && (modelId.includes("4-") || modelId.includes("4."))) {
		priority -= 500;
	}

	return priority;
}

/**
 * 为每个提供商选出一个优先级最高的代表用例。
 * @param cases 可包含同一提供商多个模型的候选列表。
 * @returns 每个提供商恰好一个用例；例如用于控制真实请求数量。
 */
function selectOneCasePerProvider(cases: AnthropicEagerE2ECase[]): AnthropicEagerE2ECase[] {
	// byProvider 按提供商收集候选模型，键不会超出内置提供商集合。
	const byProvider = new Map<BuiltinProvider, AnthropicEagerE2ECase[]>();
	for (const testCase of cases) {
		// providerCases 是当前提供商已收集的候选列表，新键使用空数组。
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

// generatedCompatCases 用生成目录中的原始兼容配置为每个提供商选择一个探针。
const generatedCompatCases = selectOneCasePerProvider(anthropicMessagesCases);
// forcedEagerProbeCases 排除明确不支持该能力的模型，再为每个提供商选一个强制探针。
const forcedEagerProbeCases = selectOneCasePerProvider(
	anthropicMessagesCases.filter((testCase) => testCase.model.compat?.supportsEagerToolInputStreaming !== false),
);

/**
 * 返回强制启用急切工具输入流式能力的模型副本。
 * @param model 原始模型元数据，不会被修改。
 * @returns compat 标记为 true 的浅复制模型；例如 `withEagerToolInputStreaming(model)`。
 */
function withEagerToolInputStreaming(model: Model<"anthropic-messages">): Model<"anthropic-messages"> {
	return {
		...model,
		compat: {
			...model.compat,
			supportsEagerToolInputStreaming: true,
		},
	};
}

/**
 * 发送一次带工具的真实请求并断言提供商接受该配置。
 * @param model 待探测的模型及兼容设置。
 * @param apiKey 可选凭据；调用方会在缺失时跳过用例。
 * @returns 成功断言后完成的 Promise；例如 `await expectToolEnabledRequestAccepted(model, key)`。
 */
async function expectToolEnabledRequestAccepted(
	model: Model<"anthropic-messages">,
	apiKey: string | undefined,
): Promise<void> {
	// options 限制输出长度并关闭 thinking，使探针便宜且聚焦工具协议。
	const options: ProviderStreamOptions = {
		apiKey,
		maxTokens: 128,
		thinkingEnabled: false,
	};
	// response 是统一 complete API 收集到的最终助手响应。
	const response = await complete(
		model,
		{
			systemPrompt: "You are a concise assistant. Use tools when useful.",
			messages: [
				{
					role: "user",
					content: "Call echo_value with value set to eager-input-streaming-compat.",
					timestamp: Date.now(),
				},
			],
			tools: [echoTool],
		},
		options,
	);

	expect(response.errorMessage, response.errorMessage).toBeFalsy();
	expect(response.stopReason, response.errorMessage).not.toBe("error");
}

// 验证模型目录覆盖率和两种 eager_input_streaming 配置路径。
describe("Anthropic Messages eager tool input streaming E2E", () => {
	// 动态用例清单必须覆盖目录中的每个 Anthropic Messages 模型。
	it("covers every generated anthropic-messages model", () => {
		// expectedModels 从原始模型目录重新生成预期的 provider/model 标识集合。
		const expectedModels = getProviders().flatMap((provider) =>
			getAnthropicMessagesModels(provider).map((model) => `${provider}/${model.id}`),
		);
		expect(anthropicMessagesCases.map((testCase) => testCase.name).sort()).toEqual(expectedModels.sort());
	});

	// 按生成模型兼容设置，对每个有凭据的提供商执行代表请求。
	describe("generated compatibility settings", () => {
		// testCase 是当前提供商按成本选出的代表模型及其可选凭据。
		for (const testCase of generatedCompatCases) {
			it.skipIf(!testCase.apiKey)(`${testCase.name} accepts configured tool streaming`, { retry: 2 }, async () => {
				await expectToolEnabledRequestAccepted(testCase.model, testCase.apiKey);
			});
		}
	});

	// 强制打开能力标记，验证尚未明确禁用的路由是否实际接受协议字段。
	describe("forced eager_input_streaming probe", () => {
		for (const testCase of forcedEagerProbeCases) {
			// model 是仅当前探针使用的强制兼容配置副本。
			const model = withEagerToolInputStreaming(testCase.model);

			it.skipIf(!testCase.apiKey)(
				`${testCase.name} accepts forced eager_input_streaming`,
				{ retry: 2 },
				async () => {
					await expectToolEnabledRequestAccepted(model, testCase.apiKey);
				},
			);
		}
	});
});
