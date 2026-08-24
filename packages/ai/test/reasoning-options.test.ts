/**
 * 文件职责：验证 models.dev effort 推理选项到 Pi 思考等级映射的精确转换规则。
 * 技术维度：使用 Vitest 对纯函数返回对象及 undefined 分支进行单元测试。
 * 产品维度：避免界面展示模型未验证的思考等级或错误推断“关闭思考”能力。
 * 逻辑维度：分别覆盖含 none、无 none，以及仅开关/预算/无等价值三类输入。
 * 关键边界：只测试 effort 转换；toggle 与 budget_tokens 留给具体适配器实现。
 * 新手阅读建议：逐项对照输入 values 和输出七个键，重点区分 null 与 undefined。
 */
import { describe, expect, it } from "vitest";
import { getEffortThinkingLevelMap } from "../scripts/models-dev-reasoning-options.ts";

/** effort 思考等级映射测试组。 */
describe("getEffortThinkingLevelMap", () => {
	/** 验证只公开已验证等级，none 映射到 off，缺失等级明确为 null。 */
	it("exposes only verified effort values and none", () => {
		expect(
			getEffortThinkingLevelMap([{ type: "toggle" }, { type: "effort", values: ["none", "low", "high", "max"] }]),
		).toEqual({
			off: "none",
			minimal: null,
			low: "low",
			medium: null,
			high: "high",
			xhigh: null,
			max: "max",
		});
	});

	/** 验证 effort 列表不含 none 时不会自行推断关闭值。 */
	it("does not infer thinking-off from an effort list", () => {
		expect(getEffortThinkingLevelMap([{ type: "effort", values: ["low", "high", "max"] }])).toEqual({
			off: null,
			minimal: null,
			low: "low",
			medium: null,
			high: "high",
			xhigh: null,
			max: "max",
		});
	});

	/** 验证开关、token 预算以及无 Pi 等价值不会生成 effort 映射。 */
	it("leaves toggle and budget controls for their adapter-specific implementations", () => {
		expect(getEffortThinkingLevelMap([{ type: "toggle" }])).toBeUndefined();
		expect(getEffortThinkingLevelMap([{ type: "budget_tokens", min: 1024, max: 32000 }])).toBeUndefined();
		expect(getEffortThinkingLevelMap([{ type: "effort", values: [null, "default"] }])).toBeUndefined();
	});
});
