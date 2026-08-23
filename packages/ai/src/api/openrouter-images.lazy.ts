/**
 * 【文件职责】OpenRouter 图片生成 API 的懒加载入口：首次调用时才动态加载实现模块。
 * 【技术维度】动态 import 包装（针对图片提供器）。
 * 【产品维度】延迟加载实现，失败以流错误呈现。
 * 【新手阅读建议】半分钟读完；实现见 openrouter-images.ts。
 */
import type { ImagesModel, ProviderImages } from "../types.ts";

// 返回懒加载的 OpenRouter 图片生成实现（公开）
export const openrouterImagesApi = (): ProviderImages => ({
	generateImages: async (model, context, options) =>
		(await import("./openrouter-images.ts")).generateImages(
			model as ImagesModel<"openrouter-images">,
			context,
			options,
		),
});
