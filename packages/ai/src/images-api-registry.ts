<<<<<<< HEAD
/**
 * 【文件职责】图片 API 实现注册表：按 api 标识注册/查询图片生成实现；
 *              通过 wrap 层在分派时校验模型 api 与实现一致。
 * 【技术维度】Map 注册表；泛型封装函数把宽类型收窄为具体实现签名。
 * 【产品维度】解耦图片生成分发逻辑与具体供应商实现：新增图片供应商只需 registerImagesApiProvider。
 * 【逻辑维度】类型定义 → 注册表 → wrapGenerateImages 包装 → register/get 两个公开函数。
 * 【关键边界】同一 api 重复注册会覆盖；分发前强制校验 model.api 匹配，防止类型谎言导致的运行时错配。
 * 【新手阅读建议】半分钟读完：理解注册→查找→包装校验三层即可。
 */
import type { AssistantImages, ImagesApi, ImagesContext, ImagesFunction, ImagesModel, ImagesOptions } from "./types.ts";
=======
import type { AssistantImages, ImageApi, ImageModel, ImagesContext, ImagesFunction, ImagesOptions } from "./types.ts";
>>>>>>> main

/** 图片 API 函数类型（中文说明）：宽类型形式——模型与选项不绑定具体 api。 */
export type ImagesApiFunction = (
	model: ImageModel<ImageApi>,
	context: ImagesContext,
	options?: ImagesOptions,
) => Promise<AssistantImages>;

<<<<<<< HEAD
/** 图片 API 提供器（中文说明）：api 标识 + 对应实现（泛型绑定）。 */
export interface ImagesApiProvider<TApi extends ImagesApi = ImagesApi, TOptions extends ImagesOptions = ImagesOptions> {
	// API 标识
	api: TApi;
	// 生成图片实现
	generateImages: ImagesFunction<TApi, TOptions>;
=======
export interface ImagesApiProvider<TApi extends ImageApi = ImageApi, TOptions extends ImagesOptions = ImagesOptions> {
	api: TApi;
	generateImages: ImagesFunction<TOptions>;
>>>>>>> main
}

// 内部存储形态（窄类型，分派用）
interface ImagesApiProviderInternal {
	api: ImageApi;
	generateImages: ImagesApiFunction;
}

// 注册条目：实现 + 可选来源标识
type RegisteredImagesApiProvider = {
	provider: ImagesApiProviderInternal;
	sourceId?: string;
};

// 注册表：api → 条目
const imagesApiProviderRegistry = new Map<string, RegisteredImagesApiProvider>();

<<<<<<< HEAD
// 包装实现（私有）：分发前校验 model.api 与注册 api 一致
function wrapGenerateImages<TApi extends ImagesApi, TOptions extends ImagesOptions>(
	api: TApi,
	generateImages: ImagesFunction<TApi, TOptions>,
=======
function wrapGenerateImages<TOptions extends ImagesOptions>(
	api: ImageApi,
	generateImages: ImagesFunction<TOptions>,
>>>>>>> main
): ImagesApiFunction {
	return (model, context, options) => {
		if (model.api !== api) {
			throw new Error(`Mismatched api: ${model.api} expected ${api}`);
		}
		return generateImages(model, context, options as TOptions);
	};
}

<<<<<<< HEAD
// 注册图片 API 实现（公开）：sourceId 记录来源（调试/溯源）
export function registerImagesApiProvider<TApi extends ImagesApi, TOptions extends ImagesOptions>(
=======
export function registerImagesApiProvider<TApi extends ImageApi, TOptions extends ImagesOptions>(
>>>>>>> main
	provider: ImagesApiProvider<TApi, TOptions>,
	sourceId?: string,
): void {
	imagesApiProviderRegistry.set(provider.api, {
		provider: {
			api: provider.api,
			generateImages: wrapGenerateImages(provider.api, provider.generateImages),
		},
		sourceId,
	});
}

<<<<<<< HEAD
// 按 api 查询实现（公开）：未注册返回 undefined
export function getImagesApiProvider(api: ImagesApi): ImagesApiProviderInternal | undefined {
=======
export function getImagesApiProvider(api: ImageApi): ImagesApiProviderInternal | undefined {
>>>>>>> main
	return imagesApiProviderRegistry.get(api)?.provider;
}
