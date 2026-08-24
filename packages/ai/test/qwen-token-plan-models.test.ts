/**
 * 文件职责：验证 Qwen Token Plan 国内外提供方包含全部文本模型并排除图片模型。
 * 技术维度：使用 Vitest 参数化测试、生成模型目录和数组包含关系断言。
 * 产品维度：确保订阅套餐的聊天模型选择完整，同时避免不可由文本接口调用的图片模型混入。
 * 逻辑维度：维护文本与图片期望清单，分别遍历两个提供方检查应包含与应排除项。
 * 关键边界：清单随产品目录变化需同步更新；只验证本地目录，不请求真实套餐服务。
 * 新手阅读建议：先比较 TEXT_MODELS 与 IMAGE_MODELS，再看两个 it.each 的相反断言。
 */
import { describe, expect, it } from "vitest";
import { getModels } from "../src/compat.ts";

/** 两个 Qwen Token Plan 提供方都应公开的文本生成模型 ID 清单。 */
const TEXT_MODELS = [
	"MiniMax-M2.5",
	"deepseek-v3.2",
	"deepseek-v4-flash",
	"deepseek-v4-pro",
	"glm-5",
	"glm-5.1",
	"glm-5.2",
	"kimi-k2.5",
	"kimi-k2.6",
	"kimi-k2.7-code",
	"qwen3.6-flash",
	"qwen3.6-plus",
	"qwen3.7-max",
	"qwen3.7-plus",
	"qwen3.8-max-preview",
];

/** 必须从文本模型目录排除的图片生成模型 ID 清单。 */
const IMAGE_MODELS = ["qwen-image-2.0", "qwen-image-2.0-pro", "wan2.7-image", "wan2.7-image-pro"];

/** Qwen Token Plan 模型目录归属测试组。 */
describe("Qwen Token Plan models", () => {
	/** provider 是国际或国内套餐键；逐项验证全部文本模型都存在。 */
	it.each(["qwen-token-plan", "qwen-token-plan-cn"] as const)("exposes all text models on %s", (provider) => {
		/** 当前提供方公开的全部模型 ID。 */
		const modelIds = getModels(provider).map((model) => model.id);
		// expected 是文本模型期望清单中的一个 ID。
		for (const expected of TEXT_MODELS) {
			expect(modelIds, `${provider} should include ${expected}`).toContain(expected);
		}
	});

	/** provider 是国际或国内套餐键；逐项验证图片模型均不存在。 */
	it.each(["qwen-token-plan", "qwen-token-plan-cn"] as const)("omits image models from %s", (provider) => {
		/** 当前提供方公开的全部模型 ID。 */
		const modelIds = getModels(provider).map((model) => model.id);
		// excluded 是图片模型排除清单中的一个 ID。
		for (const excluded of IMAGE_MODELS) {
			expect(modelIds, `${provider} should not include ${excluded}`).not.toContain(excluded);
		}
	});
});
