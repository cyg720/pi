/**
 * 文件职责：验证内置模型目录为当前支持 Anthropic 自适应思考的模型设置正确兼容标记。
 * 技术维度：使用 Vitest、跨提供方模型遍历、TypeScript 类型守卫和模型 ID 正则白名单。
 * 产品维度：确保兼容模型自动使用自适应思考，同时避免旧模型被错误强制启用。
 * 逻辑维度：收集全部模型，筛选 Anthropic Messages 与标记项，比较期望子集和允许名称模式。
 * 关键边界：期望清单随模型目录更新；正则限制的是当前已知系列，不验证真实提供方响应。
 * 新手阅读建议：先看 EXPECTED 清单，再按 getAllModels、两次 filter、map、sort 的管道阅读。
 */
import { describe, expect, it } from "vitest";
import { getModels, getProviders } from "../src/compat.ts";
import type { Api, Model } from "../src/types.ts";

/** 当前必须启用自适应思考的提供方/模型 ID 清单；测试允许实际标记集合包含更多合法项。 */
const EXPECTED_CURRENT_ADAPTIVE_THINKING_MODELS = [
	"anthropic/claude-fable-5",
	"anthropic/claude-opus-4-8",
	"anthropic/claude-opus-5",
	"anthropic/claude-sonnet-5",
	"cloudflare-ai-gateway/claude-fable-5",
	"kimi-coding/kimi-for-coding",
	"kimi-coding/k3",
	"kimi-coding/kimi-for-coding-highspeed",
	"opencode/claude-opus-4-8",
	"opencode/claude-opus-5",
	"vercel-ai-gateway/anthropic/claude-opus-4.8",
	"vercel-ai-gateway/anthropic/claude-opus-5",
	"vercel-ai-gateway/anthropic/claude-opus-5-fast",
	"vercel-ai-gateway/anthropic/claude-sonnet-5",
];

/**
 * 汇总所有提供方的模型目录。
 * @returns 统一视为 Model<Api> 的模型数组；元素数量由当前生成目录决定。
 * @example `getAllModels().filter((model) => model.provider === "anthropic")`。
 */
function getAllModels(): Model<Api>[] {
	// provider 是 getProviders 返回的一个提供方 ID，用于读取该提供方全部模型。
	return getProviders().flatMap((provider) => getModels(provider) as Model<Api>[]);
}

/** Anthropic 自适应思考模型元数据测试组。 */
describe("Anthropic adaptive thinking model metadata", () => {
	/** 验证必需模型均被标记，且所有被标记模型都属于当前允许的系列。 */
	it("marks built-in Anthropic Messages models that use adaptive thinking", () => {
		/** 经过 API、兼容标记筛选并转成 provider/id 后排序的模型清单。 */
		const flaggedModels = getAllModels()
			// model 是任意 API 模型；类型守卫只保留 Anthropic Messages 模型。
			.filter((model): model is Model<"anthropic-messages"> => model.api === "anthropic-messages")
			// model 已收窄为 Anthropic Messages；只保留明确强制自适应思考的项。
			.filter((model) => model.compat?.forceAdaptiveThinking === true)
			// model 转为稳定的“提供方/模型 ID”文本，便于跨目录比较。
			.map((model) => `${model.provider}/${model.id}`)
			.sort();

		expect(flaggedModels).toEqual(expect.arrayContaining([...EXPECTED_CURRENT_ADAPTIVE_THINKING_MODELS].sort()));
		expect(flaggedModels).toEqual(
			// modelId 是一个已标记 ID；正则只允许当前自适应思考模型系列。
			flaggedModels.filter((modelId) =>
				/(opus[-.](4[-.][678]|5)|sonnet[-.]4[-.]6|sonnet[-.]5|fable[-.]5|kimi-coding\/)/.test(modelId),
			),
		);
	});
});
