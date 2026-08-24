/**
 * 文件职责：提供图片生成提供商的端到端通用测试，包括基础生成、混合输出和图片输入。
 * 技术维度：使用 Vitest、统一图片模型目录、Base64 图片夹具和 generateImages 接口。
 * 产品维度：验证用户能生成图片、接收文字说明，并基于已有图片创建变体。
 * 逻辑维度：三个辅助函数覆盖能力并按模型声明跳过，当前测试组在有 OpenRouter 密钥时运行。
 * 关键边界：会访问真实服务并可能产生费用；用例设置重试，模型不支持的能力只记录并返回。
 * 新手阅读建议：先看三个辅助函数与能力检查，再看 describe 如何为同一模型复用它们。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getImageModel } from "../src/image-models.ts";
import { generateImages } from "../src/images.ts";
import type { ImageContent, ImagesContext, ImagesModel, ProviderImagesOptions } from "../src/types.ts";

// __filename 是当前 ESM 测试文件绝对路径。
const __filename = fileURLToPath(import.meta.url);
// __dirname 是测试目录，用于定位图片夹具。
const __dirname = dirname(__filename);

/** 表示提供商选项并允许端到端测试传入额外字段。 */
type ImagesOptionsWithExtras = ProviderImagesOptions & Record<string, unknown>;

/**
 * 验证模型能完成最小图片生成。
 * 参数：model 为图片模型，options 为可选提供商设置。
 * 返回值：断言完成 Promise。
 * 使用示例：`await basicImageGeneration(model)`。
 */
async function basicImageGeneration<TApi extends string>(model: ImagesModel<TApi>, options?: ImagesOptionsWithExtras) {
	// context 是要求生成白底红圆的纯文本输入。
	const context: ImagesContext = {
		input: [{ type: "text", text: "Generate a simple red circle on a plain white background. No text." }],
	};

	// response 是图片生成接口返回的完整结果。
	const response = await generateImages(model, context, options);

	expect(response.stopReason, `Error: ${response.errorMessage}`).toBe("stop");
	expect(response.errorMessage).toBeFalsy();
	// item 是当前输出项，回调用于确认存在图片。
	expect(response.output.some((item) => item.type === "image")).toBe(true);
	expect(response.timestamp).toBeGreaterThan(0);
}

/**
 * 在模型支持文字输出时验证同时返回文本与图片。
 * 参数：model 为图片模型，options 为可选设置。
 * 返回值：断言或能力跳过完成 Promise。
 * 使用示例：`await handleTextAndImageOutput(model)`。
 */
async function handleTextAndImageOutput<TApi extends string>(
	model: ImagesModel<TApi>,
	options?: ImagesOptionsWithExtras,
) {
	if (!model.output.includes("text")) {
		console.log(`Skipping text+image output test - model ${model.id} doesn't support text output`);
		return;
	}

	// context 要求生成红圆并附简短文字说明。
	const context: ImagesContext = {
		input: [{ type: "text", text: "Generate a red circle and include a brief description of the image." }],
	};

	// response 是预期包含文字与图片的生成结果。
	const response = await generateImages(model, context, options);

	expect(response.stopReason, `Error: ${response.errorMessage}`).toBe("stop");
	expect(response.output.some((item) => item.type === "image")).toBe(true);
	expect(response.output.some((item) => item.type === "text" && item.text.trim().length > 0)).toBe(true);
}

/**
 * 在模型支持图片输入时验证基于夹具生成变体。
 * 参数：model 为图片模型，options 为可选设置。
 * 返回值：断言或能力跳过完成 Promise。
 * 使用示例：`await handleImageInput(model)`。
 */
async function handleImageInput<TApi extends string>(model: ImagesModel<TApi>, options?: ImagesOptionsWithExtras) {
	if (!model.input.includes("image")) {
		console.log(`Skipping image input test - model ${model.id} doesn't support image input`);
		return;
	}

	// imagePath 是红圆 PNG 测试夹具路径。
	const imagePath = join(__dirname, "data", "red-circle.png");
	// imageBuffer 是从磁盘读取的原始 PNG 字节。
	const imageBuffer = readFileSync(imagePath);
	// imageContent 是转成 Base64 的统一图片输入块。
	const imageContent: ImageContent = {
		type: "image",
		data: imageBuffer.toString("base64"),
		mimeType: "image/png",
	};

	// context 同时包含变体说明和原图片。
	const context: ImagesContext = {
		input: [{ type: "text", text: "Create a variation of this image with a blue background." }, imageContent],
	};

	// response 是基于图片输入生成的变体结果。
	const response = await generateImages(model, context, options);

	expect(response.stopReason, `Error: ${response.errorMessage}`).toBe("stop");
	expect(response.output.some((item) => item.type === "image")).toBe(true);
}

describe("Images E2E Tests", () => {
	describe.skipIf(!process.env.OPENROUTER_API_KEY)(
		"OpenRouter Images Provider (google/gemini-2.5-flash-image)",
		() => {
			// model 是 OpenRouter 的 Gemini 2.5 Flash 图片模型。
			const model = getImageModel("openrouter", "google/gemini-2.5-flash-image");

			// 验证基础图片生成；无参数，无返回值。
			it("should generate a basic image", { retry: 3 }, async () => {
				await basicImageGeneration(model);
			});

			// 验证模型能同时输出文字和图片；无参数，无返回值。
			it("should handle text plus image output", { retry: 3 }, async () => {
				await handleTextAndImageOutput(model);
			});

			// 验证模型接受图片输入并生成变体；无参数，无返回值。
			it("should handle image input", { retry: 3 }, async () => {
				await handleImageInput(model);
			});
		},
	);
});
