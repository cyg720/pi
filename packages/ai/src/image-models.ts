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
for (const [provider, models] of Object.entries(IMAGE_MODELS)) {
	const providerModels = new Map<string, ImagesModel<ImagesApi>>();
	for (const [id, model] of Object.entries(models)) {
		providerModels.set(id, model as ImagesModel<ImagesApi>);
	}
	imageModelRegistry.set(provider, providerModels);
}

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
	provider: TProvider,
): ImagesModel<ImageModelApi<TProvider, keyof (typeof IMAGE_MODELS)[TProvider]>>[] {
	const models = imageModelRegistry.get(provider);
	return models
		? (Array.from(models.values()) as ImagesModel<ImageModelApi<TProvider, keyof (typeof IMAGE_MODELS)[TProvider]>>[])
		: [];
}
