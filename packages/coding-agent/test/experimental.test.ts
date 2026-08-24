/**
 * 文件职责：验证实验功能只在 PI_EXPERIMENTAL 环境变量精确等于字符串 1 时启用。
 * 技术维度：使用 Vitest 和 Node.js process.env，逐项覆盖未设置、空值及常见真假文本。
 * 产品维度：防止用户误输入其他值时意外开启不稳定功能，并保持开关规则明确可预测。
 * 逻辑维度：保存原环境值，每例后恢复，再为五种变量状态调用判断函数。
 * 关键边界：判断严格区分字符串，不接受 true 等别名；测试会修改当前进程环境变量。
 * 新手阅读建议：先看 afterEach 的恢复逻辑，再按 false、false、true、false、false 的用例矩阵阅读。
 */
import { afterEach, describe, expect, it } from "vitest";
import { areExperimentalFeaturesEnabled } from "../src/core/experimental.ts";

/** 实验功能环境开关测试组。 */
describe("areExperimentalFeaturesEnabled", () => {
	/** 测试开始前 PI_EXPERIMENTAL 的原值；每个用例后精确恢复。 */
	const originalPiExperimental = process.env.PI_EXPERIMENTAL;

	/** 恢复原始环境变量，避免一个用例的设置泄漏到其他测试。 */
	afterEach(() => {
		if (originalPiExperimental === undefined) {
			delete process.env.PI_EXPERIMENTAL;
		} else {
			process.env.PI_EXPERIMENTAL = originalPiExperimental;
		}
	});

	/** 验证变量完全不存在时禁用实验功能。 */
	it("returns false when PI_EXPERIMENTAL is unset", () => {
		delete process.env.PI_EXPERIMENTAL;

		expect(areExperimentalFeaturesEnabled()).toBe(false);
	});

	/** 验证空字符串不会被当成启用。 */
	it("returns false when PI_EXPERIMENTAL is empty", () => {
		process.env.PI_EXPERIMENTAL = "";

		expect(areExperimentalFeaturesEnabled()).toBe(false);
	});

	/** 验证唯一有效启用值字符串 1 返回 true。 */
	it("returns true when PI_EXPERIMENTAL is set to 1", () => {
		process.env.PI_EXPERIMENTAL = "1";

		expect(areExperimentalFeaturesEnabled()).toBe(true);
	});

	/** 验证字符串 0 明确禁用。 */
	it("returns false when PI_EXPERIMENTAL is set to 0", () => {
		process.env.PI_EXPERIMENTAL = "0";

		expect(areExperimentalFeaturesEnabled()).toBe(false);
	});

	/** 验证看似布尔值的字符串 true 也不会启用。 */
	it("returns false when PI_EXPERIMENTAL is set to a non-1 value", () => {
		process.env.PI_EXPERIMENTAL = "true";

		expect(areExperimentalFeaturesEnabled()).toBe(false);
	});
});
