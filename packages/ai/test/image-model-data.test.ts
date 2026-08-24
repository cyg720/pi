/**
 * 文件职责：验证 OpenRouter 图片模型目录解析器对严格输入的拒绝与成功转换。
 * 技术维度：使用 Vitest、参数化测试和固定模型 JSON 夹具测试纯解析函数。
 * 产品维度：防止空目录、畸形目录或非图片模型进入图片生成功能。
 * 逻辑维度：准备有效模型，覆盖缺失/空输入、无可用图片模型和正常解析。
 * 关键边界：不请求 OpenRouter；strict=true 时空结果必须抛错。
 * 新手阅读建议：先看 validImageModel 的模态，再比较三个测试如何改变 payload。
 */
import { describe, expect, it } from "vitest";
import { parseOpenRouterImageModels } from "../scripts/generate-image-models.ts";

/** 最小有效图片模型夹具，支持文本/图片输入并输出图片。 */
const validImageModel = {
	id: "example/image-model",
	name: "Example Image Model",
	architecture: {
		input_modalities: ["text", "image"],
		output_modalities: ["image"],
	},
	pricing: {
		prompt: "0.000001",
		completion: "0.000002",
	},
};

/** OpenRouter 图片模型解析测试组。 */
describe("OpenRouter image model parsing", () => {
	/** payload 依次为空对象、空 data 和错误类型 data，严格模式均应拒绝。 */
	it.each([{}, { data: [] }, { data: "invalid" }])("rejects a missing or empty strict catalog", (payload) => {
		expect(() => parseOpenRouterImageModels(payload, true)).toThrow("missing or empty image model list");
	});

	/** 验证只有文本输出的条目被过滤后，严格模式报告无可用图片模型。 */
	it("rejects a strict catalog with no usable image models", () => {
		expect(() =>
			parseOpenRouterImageModels(
				{
					data: [
						{
							...validImageModel,
							architecture: { input_modalities: ["text"], output_modalities: ["text"] },
						},
					],
				},
				true,
			),
		).toThrow("no usable image models");
	});

	/** 验证有效目录保留 ID 并规范化输入、输出模态。 */
	it("parses a non-empty image model catalog", () => {
		expect(parseOpenRouterImageModels({ data: [validImageModel] }, true)).toEqual([
			expect.objectContaining({
				id: "example/image-model",
				input: ["text", "image"],
				output: ["image"],
			}),
		]);
	});
});
