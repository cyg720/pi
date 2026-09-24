/**
 * 【文件职责】图片生成的高层入口：加载内置图片供应商注册，并按模型的 api 字段把生成请求
 *              分派到已注册的图片 API 实现。
 * 【技术维度】模块加载时副作用导入注册表；注册表按 api 查找；类型泛型保证模型与 API 匹配。
 * 【产品维度】让上层应用以统一签名 generateImages(model, context, options) 生成图片，
 *              无需关心具体供应商实现。
 * 【逻辑维度】import 内置注册 → resolveImagesApiProvider 按 api 查表（未注册抛错）→ 委托执行。
 * 【关键边界】api 未注册时抛明确错误；options 类型按 TApi 泛型收窄。
 * 【新手阅读建议】半分钟读完：记住 generateImages 是唯一对外入口即可，实现在各供应商目录。
 */
import "./providers/images/register-builtins.ts";

import { getImagesApiProvider } from "./images-api-registry.ts";
import type { AssistantImages, ImageApi, ImageModel, ImagesContext, ProviderImagesOptions } from "./types.ts";

<<<<<<< HEAD
// 按 api 查找已注册的图片实现（私有）：未注册抛错
function resolveImagesApiProvider(api: ImagesApi) {
=======
function resolveImagesApiProvider(api: ImageApi) {
>>>>>>> main
	const provider = getImagesApiProvider(api);
	if (!provider) {
		throw new Error(`No API provider registered for api: ${api}`);
	}
	return provider;
}

<<<<<<< HEAD
// 生成图片（公开）：泛型 TApi 保证模型与选项类型一致；委托给注册的图片实现
export async function generateImages<TApi extends ImagesApi>(
	model: ImagesModel<TApi>,
=======
/**
 * Global image generation dispatched on `model.api` through the images api
 * registry. Auth must be passed explicitly via `options.apiKey`; prefer
 * `Models.generateImages()`, which resolves provider auth.
 */
export async function generateImages(
	model: ImageModel<ImageApi>,
>>>>>>> main
	context: ImagesContext,
	options?: ProviderImagesOptions,
): Promise<AssistantImages> {
	const provider = resolveImagesApiProvider(model.api);
	return provider.generateImages(model, context, options);
}
