/**
 * 文件职责：验证 Xiaomi MiMo 模型在 API 计费与令牌套餐提供方之间的目录归属。
 * 技术维度：使用 Vitest 参数化测试，通过兼容层查询单个模型和提供方模型集合。
 * 产品维度：避免 API 专属模型错误出现在套餐入口，防止用户选择无法计费或不可用的模型。
 * 逻辑维度：先确认 API 提供方含目标模型，再逐个确认三个套餐提供方均排除它们。
 * 关键边界：只校验本地目录可见性，不验证小米服务端账户权限或实际调用结果。
 * 新手阅读建议：先理解 provider 是模型来源分组，再对比两个测试的“应存在”和“不应存在”关系。
 */
import { describe, expect, it } from "vitest";
import { getModel, getModels } from "../src/compat.ts";

/** Xiaomi MiMo 模型目录归属测试组。 */
describe("Xiaomi MiMo models", () => {
	/** 对两个 API 计费模型逐一检查；modelId 只能取参数数组中的两个字面量。 */
	it.each(["mimo-v2-flash", "mimo-v2-omni"] as const)("keeps %s on the API billing provider", (modelId) => {
		expect(getModel("xiaomi", modelId)).toBeDefined();
	});

	/** 对三个令牌套餐地区提供方逐一检查；provider 是当前受测的提供方键。 */
	it.each(["xiaomi-token-plan-cn", "xiaomi-token-plan-ams", "xiaomi-token-plan-sgp"] as const)(
		"omits API-billing-only models from %s",
		(provider) => {
			/** 当前套餐提供方公开的全部模型 ID；只在本用例内用于排除断言。 */
			const modelIds = getModels(provider).map((model) => model.id);
			expect(modelIds).not.toContain("mimo-v2-flash");
			expect(modelIds).not.toContain("mimo-v2-omni");
		},
	);
});
