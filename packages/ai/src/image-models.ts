<<<<<<< HEAD
/**
 * 【文件职责】图片模型查询层：把生成文件（image-models.generated.ts）中的分组模型数据
 *              载入内存注册表，提供按供应商/模型 ID 的类型安全查询。
 * 【技术维度】生成数据驱动的运行时注册表（Map of Map）；条件类型从生成数据推导模型 API。
 * 【产品维度】让应用以类型安全的方式枚举/查询内置图片模型目录。
 * 【逻辑维度】模块加载时构建注册表 → getImageModel 单查 → getImageProviders 列供应商 →
 *              getImageModels 列某供应商全部模型。
 * 【关键边界】查询不存在的模型返回 undefined（由类型系统在编译期拦截大部分误用）；
 *              本文件依赖生成文件，重新生成目录后无需改动。
 * 【新手阅读建议】半分钟读完：记住三个 getXxx 查询函数的用途即可。
 */
import { IMAGE_MODELS } from "./image-models.generated.ts";
import type { ImagesApi, ImagesModel, KnownImagesProvider } from "./types.ts";

// 图片模型注册表：供应商 → 模型 ID → 模型
const imageModelRegistry: Map<string, Map<string, ImagesModel<ImagesApi>>> = new Map();

// 模块加载时从生成数据构建注册表
=======
import { IMAGE_MODELS } from "./models.generated.ts";
import type { ImageApi, ImageModel } from "./types.ts";

/**
 * Compat reads of the generated catalog restricted to image models. New code
 * uses `Models.getModelOfType("image", ...)` or `getBuiltinImageModel()` from `providers/all`.
 */

type Catalog = typeof IMAGE_MODELS;
type ImageModelIds<TProvider extends keyof Catalog> = keyof Catalog[TProvider];

/** Built-in providers with at least one image model in the generated catalog. */
export type BuiltinImageProvider = {
	[TProvider in keyof Catalog]: [ImageModelIds<TProvider>] extends [never] ? never : TProvider;
}[keyof Catalog];

type BuiltinImageModel<
	TProvider extends BuiltinImageProvider,
	TModelId extends ImageModelIds<TProvider>,
> = Catalog[TProvider][TModelId] extends ImageModel<infer TApi extends ImageApi> ? ImageModel<TApi> : never;

const imageModelsByProvider = new Map<string, Map<string, ImageModel<ImageApi>>>();
>>>>>>> main
for (const [provider, models] of Object.entries(IMAGE_MODELS)) {
	const imageModels = new Map<string, ImageModel<ImageApi>>();
	for (const model of Object.values(models as Record<string, ImageModel<ImageApi>>)) {
		imageModels.set(model.id, model);
	}
	if (imageModels.size > 0) imageModelsByProvider.set(provider, imageModels);
}

<<<<<<< HEAD
// 从生成数据推导模型所属 API 类型（保证查询结果类型精确）
type ImageModelApi<
	TProvider extends KnownImagesProvider,
	TModelId extends keyof (typeof IMAGE_MODELS)[TProvider],
> = (typeof IMAGE_MODELS)[TProvider][TModelId] extends { api: infer TApi }
	? TApi extends ImagesApi
		? TApi
		: never
	: never;

// 按供应商 + 模型 ID 查询单个图片模型（公开，类型安全）
export function getImageModel<
	TProvider extends KnownImagesProvider,
	TModelId extends keyof (typeof IMAGE_MODELS)[TProvider],
>(provider: TProvider, modelId: TModelId): ImagesModel<ImageModelApi<TProvider, TModelId>> {
	const providerModels = imageModelRegistry.get(provider);
	return providerModels?.get(modelId as string) as ImagesModel<ImageModelApi<TProvider, TModelId>>;
}

// 列出全部已知图片供应商（公开）
export function getImageProviders(): KnownImagesProvider[] {
	return Array.from(imageModelRegistry.keys()) as KnownImagesProvider[];
}

// 列出某供应商的全部图片模型（公开，类型安全）
export function getImageModels<TProvider extends KnownImagesProvider>(
=======
/** @deprecated Static catalog read. Use `getBuiltinImageModel` from "@earendil-works/pi-ai/providers/all" or `Models.getModelOfType("image", ...)`. */
export function getImageModel<TProvider extends BuiltinImageProvider, TModelId extends ImageModelIds<TProvider>>(
>>>>>>> main
	provider: TProvider,
	modelId: TModelId,
): BuiltinImageModel<TProvider, TModelId> {
	return imageModelsByProvider.get(provider)?.get(modelId as string) as BuiltinImageModel<TProvider, TModelId>;
}

/** @deprecated Static catalog read. Use `Models.getProviders()`. */
export function getImageProviders(): BuiltinImageProvider[] {
	return Array.from(imageModelsByProvider.keys()) as BuiltinImageProvider[];
}

/** @deprecated Static catalog read. Use `getBuiltinImageModels` from "@earendil-works/pi-ai/providers/all" or `Models.getModelsOfType("image")`. */
export function getImageModels<TProvider extends BuiltinImageProvider>(
	provider: TProvider,
): BuiltinImageModel<TProvider, ImageModelIds<TProvider>>[] {
	const models = imageModelsByProvider.get(provider);
	return models ? (Array.from(models.values()) as BuiltinImageModel<TProvider, ImageModelIds<TProvider>>[]) : [];
}
