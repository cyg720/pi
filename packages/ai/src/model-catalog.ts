<<<<<<< HEAD
/**
 * 【文件职责】模型目录的类型系统与扁平化工具：把"按 API 分组"的模型数据转换为
 *              单一"模型 ID → Model"查找表，同时保留每个模型的 API 类型绑定。
 * 【技术维度】高级类型体操：映射类型/条件类型/联合类型推导（ModelId/ModelApi/ModelCatalog）；
 *              flattenModelCatalog 用 Object.assign 展开分组。
 * 【产品维度】让生成器（generate-models）产出的分组数据在运行时无摩擦地变为
 *              类型安全的模型目录，供模型查询与界面使用。
 * 【逻辑维度】类型推导三层 → flattenModelCatalog 运行时扁平化。
 * 【关键边界】模型 ID 必须在组内唯一，否则类型映射会错；扁平化是浅合并（同名键后者覆盖）。
 * 【新手阅读建议】新手不必精读类型体操：先看 ModelCatalog 形状与 flattenModelCatalog 的用法即可。
 */
import type { Api, Model, ProviderId } from "./types.ts";
=======
import type {
	Api,
	ClassifierApi,
	ClassifierModel,
	ImageApi,
	ImageModel,
	Model,
	ModelType,
	ProviderId,
} from "./types.ts";
>>>>>>> main

// 模型分组类型：API 名 → 模型 ID → 模型元数据
export type ModelGroups = Record<string, Record<string, object>>;

<<<<<<< HEAD
// 全部模型 ID 的联合类型（跨组）
type ModelId<TGroups extends ModelGroups> = {
=======
type ModelKey<TGroups extends ModelGroups> = {
>>>>>>> main
	[TApi in keyof TGroups]: keyof TGroups[TApi];
}[keyof TGroups] &
	string;

<<<<<<< HEAD
// 某模型 ID 所属的 API 名（按 ID 在组中的归属反推）
type ModelApi<TGroups extends ModelGroups, TModelId extends ModelId<TGroups>> = {
	[TApi in keyof TGroups]: TModelId extends keyof TGroups[TApi] ? TApi : never;
}[keyof TGroups] &
	Api;

// 扁平化目录类型：模型 ID → 绑定所属 API 类型的 Model（并固定 provider）
export type ModelCatalog<TGroups extends ModelGroups, TProvider extends ProviderId> = {
	[TModelId in ModelId<TGroups>]: Model<ModelApi<TGroups, TModelId>> & {
		id: TModelId;
=======
type KeyForType<TGroups extends ModelGroups, TType extends ModelType> = Extract<
	ModelKey<TGroups>,
	`${TType}:${string}`
>;

type ModelId<TKey extends string> = TKey extends `${ModelType}:${infer TModelId}` ? TModelId : never;

type ApiForKey<TGroups extends ModelGroups, TKey extends ModelKey<TGroups>> = {
	[TApi in keyof TGroups]: TKey extends keyof TGroups[TApi] ? TApi : never;
}[keyof TGroups];

export type ChatModelCatalog<TGroups extends ModelGroups, TProvider extends ProviderId> = {
	[TKey in KeyForType<TGroups, "chat"> as ModelId<TKey>]: Model<ApiForKey<TGroups, TKey> & Api> & {
		id: ModelId<TKey>;
>>>>>>> main
		provider: TProvider;
	};
};

<<<<<<< HEAD
// 把分组数据扁平化为单一目录（公开）：Object.assign 展开各组的模型记录
export function flattenModelCatalog<const TProvider extends ProviderId, const TGroups extends ModelGroups>(
=======
export type ImageModelCatalog<TGroups extends ModelGroups, TProvider extends ProviderId> = {
	[TKey in KeyForType<TGroups, "image"> as ModelId<TKey>]: ImageModel<ApiForKey<TGroups, TKey> & ImageApi> & {
		id: ModelId<TKey>;
		provider: TProvider;
	};
};

export type ClassifierModelCatalog<TGroups extends ModelGroups, TProvider extends ProviderId> = {
	[TKey in KeyForType<TGroups, "classifier"> as ModelId<TKey>]: ClassifierModel<
		ApiForKey<TGroups, TKey> & ClassifierApi
	> & {
		id: ModelId<TKey>;
		provider: TProvider;
	};
};

function flattenModelCatalog(groups: ModelGroups, type: ModelType): Record<string, object> {
	return Object.fromEntries(
		Object.values(groups)
			.flatMap((models) => Object.values(models))
			.filter((model) => (model as { type?: unknown }).type === type)
			.map((model) => [(model as { id: string }).id, model]),
	);
}

export function flattenChatModelCatalog<const TProvider extends ProviderId, const TGroups extends ModelGroups>(
>>>>>>> main
	_provider: TProvider,
	groups: TGroups,
): ChatModelCatalog<TGroups, TProvider> {
	return flattenModelCatalog(groups, "chat") as ChatModelCatalog<TGroups, TProvider>;
}

export function flattenImageModelCatalog<const TProvider extends ProviderId, const TGroups extends ModelGroups>(
	_provider: TProvider,
	groups: TGroups,
): ImageModelCatalog<TGroups, TProvider> {
	return flattenModelCatalog(groups, "image") as ImageModelCatalog<TGroups, TProvider>;
}

export function flattenClassifierModelCatalog<const TProvider extends ProviderId, const TGroups extends ModelGroups>(
	_provider: TProvider,
	groups: TGroups,
): ClassifierModelCatalog<TGroups, TProvider> {
	return flattenModelCatalog(groups, "classifier") as ClassifierModelCatalog<TGroups, TProvider>;
}
