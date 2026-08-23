import { defaultProviderAuthContext as defaultAuthContext } from "./auth/context.ts";
import { InMemoryCredentialStore } from "./auth/credential-store.ts";
import { type AuthResolutionOverrides, ModelsError, resolveProviderAuth } from "./auth/resolve.ts";
import type { AuthContext, AuthResult, CredentialStore, ProviderAuth } from "./auth/types.ts";
import type { CreateModelsOptions } from "./models.ts";
import type { AssistantImages, ImagesApi, ImagesContext, ImagesModel, ImagesOptions, ProviderImages } from "./types.ts";

/**
 * An image-generation provider: the image-side counterpart of `Provider`.
 * Owns id/name metadata, auth, model listing, and generation behavior.
 */
/**
 * 【文件职责】图片生成模型集合（ImagesModels）运行时：图片侧的供应商/认证/刷新/生成分派，
 *              与聊天侧 Models 结构对称（见 models.ts）。
 * 【技术维度】泛型认证解析复用；动态目录刷新并发去重；错误统一转为带 stopReason:"error" 的
 *              AssistantImages（承诺绝不 reject）。
 * 【产品维度】让应用以统一入口生成图片：认证就绪则合并密钥/头/环境变量后委托供应商。
 * 【逻辑维度】类型与接口（ImagesProvider/ImagesModels/MutableImagesModels）→ ImagesModelsImpl
 *              （认证/刷新/生成）→ createImagesModels / createImagesProvider 两个工厂。
 * 【关键边界】generateImages 绝不 reject：任何失败都合成 error 结果返回；
 *              刷新带 provider id 时失败抛 ModelsError(model_source)，全量刷新用 allSettled 尽力而为。
 * 【新手阅读建议】先读 ImagesProvider 与 ImagesModels 接口 → 再看 Impl 的 generateImages
 *              与 refresh → 最后看 createImagesProvider。
 */
/**
 * 图片供应商（中文说明）：聊天侧 Provider 的图片对应物——
 * 拥有 id/名称、认证、模型清单与生成行为。
 */
export interface ImagesProvider {
	readonly id: string;
	// 供应商唯一标识
	readonly name: string;
	// 显示名称

	/**
	 * Required: at least one of `apiKey`/`oauth`. Same semantics as chat
	 * providers; `ImagesModels.getAuth()` returns undefined when the provider
	 * is unconfigured.
	 */
	// 认证方法（apiKey/oauth 至少其一）；未配置时 getAuth 返回 undefined
	readonly auth: ProviderAuth;

	/**
	 * Current known models, sync. Static providers return their catalog;
	 * dynamic providers return the list as of the last `refreshModels()`
	 * (empty before the first). Must not throw; `ImagesModels` treats a
	 * throwing implementation as having no models.
	 */
	// 当前已知模型（同步）；动态供应商返回最近刷新结果；不得抛错
	getModels(): readonly ImagesModel<ImagesApi>[];

	/**
	 * Dynamic providers only: fetch and update the model list. May reject
	 * (network); on rejection the model list stays at its last-known state
	 * and a later call retries.
	 */
	// 动态供应商专用：拉取并更新模型列表；失败保留上次列表且下次可重试
	refreshModels?(): Promise<void>;

	// 生成图片：由供应商实现完成实际调用
	// 生成图片：解析并合并认证后委托拥有该模型的供应商；绝不 reject，
	// 失败以 stopReason:"error" 的 AssistantImages 返回
	generateImages(
		model: ImagesModel<ImagesApi>,
		context: ImagesContext,
		options?: ImagesOptions,
	): Promise<AssistantImages>;
}

/**
 * Runtime collection of image-generation providers plus auth application and
 * generation convenience: the image-side counterpart of `Models`.
 */
/**
 * 图片模型集合（中文说明）：聊天侧 Models 的图片对应物——
 * 供应商集合 + 认证应用 + 生成便捷层。
 */
export interface ImagesModels {
	getProviders(): readonly ImagesProvider[];
	// 全部图片供应商
	getProvider(id: string): ImagesProvider | undefined;
	// 按 ID 查供应商

	/**
	 * Sync read of last-known models from one provider or all providers.
	 * Best-effort: a provider whose `getModels()` throws yields no models.
	 */
	// 读取某（或全部）供应商最近已知模型；尽力而为
	getModels(provider?: string): readonly ImagesModel<ImagesApi>[];

	/** Sync runtime model lookup against last-known lists. */
	getModel(provider: string, id: string): ImagesModel<ImagesApi> | undefined;
	// 同步查找模型

	/**
	 * Ask dynamic providers to re-fetch their model lists. With a provider id,
	 * rejects with `ModelsError` ("model_source") on that provider's fetch
	 * failure; without one, refreshes all providers concurrently best-effort.
	 * Static providers (no `refreshModels`) are no-ops.
	 */
	// 刷新模型列表：带 provider 时失败抛 ModelsError(model_source)；
	// 不带时并发全量尽力而为（静态供应商无操作）
	refresh(provider?: string): Promise<void>;

	/**
	 * Resolve request auth by provider id or image model. Same contract as
	 * `Models.getAuth()`: undefined when unknown/unconfigured, rejects with
	 * `ModelsError` ("oauth"/"auth") on real failures.
	 */
	// 解析认证（重载：按供应商 ID 或按图片模型）；契约同 Models.getAuth
	// 重载声明：按供应商 ID
	getAuth(providerId: string, overrides?: AuthResolutionOverrides): Promise<AuthResult | undefined>;
	getAuth(model: ImagesModel<ImagesApi>, overrides?: AuthResolutionOverrides): Promise<AuthResult | undefined>;

	/**
	 * Generate images through the owning provider with auth resolved and
	 * merged (explicit options win per field). Never rejects; failures are
	 * returned as an `AssistantImages` with `stopReason: "error"`.
	 */
	generateImages(
		model: ImagesModel<ImagesApi>,
		context: ImagesContext,
		options?: ImagesOptions,
	): Promise<AssistantImages>;
}

/** 可写图片模型集合（中文说明）：可增删图片供应商。 */
export interface MutableImagesModels extends ImagesModels {
	/** Upsert/replace by provider.id. Provider ids are unique. */
	// 按 provider.id 新增或替换（ID 唯一）
	setProvider(provider: ImagesProvider): void;
	deleteProvider(id: string): void;
	// 删除供应商
	clearProviders(): void;
	// 清空供应商
}

/** ImagesModelsImpl（中文说明）：ImagesModels 接口的具体实现。 */
class ImagesModelsImpl implements MutableImagesModels {
	private providers = new Map<string, ImagesProvider>();
	// 图片供应商注册表
	private credentials: CredentialStore;
	// 凭据存储
	private authContext: AuthContext;
	// 认证上下文

	constructor(options?: CreateModelsOptions) {
		this.credentials = options?.credentials ?? new InMemoryCredentialStore();
		this.authContext = options?.authContext ?? defaultAuthContext();
	}

	// 新增/替换供应商
	setProvider(provider: ImagesProvider): void {
		this.providers.set(provider.id, provider);
	}

	// 删除供应商
	deleteProvider(id: string): void {
		this.providers.delete(id);
	}

	// 清空供应商
	clearProviders(): void {
		this.providers.clear();
	}

	// 全部图片供应商
	getProviders(): readonly ImagesProvider[] {
		return Array.from(this.providers.values());
	}

	// 按 ID 查供应商
	getProvider(id: string): ImagesProvider | undefined {
		return this.providers.get(id);
	}

	// 读取模型：单供应商容错；全部供应商逐个聚合
	getModels(provider?: string): readonly ImagesModel<ImagesApi>[] {
		if (provider !== undefined) {
			const entry = this.providers.get(provider);
			if (!entry) return [];
			try {
				return entry.getModels();
			} catch {
				return [];
			}
		}

		const models: ImagesModel<ImagesApi>[] = [];
		for (const entry of this.providers.values()) {
			try {
				models.push(...entry.getModels());
			} catch {
				// Best-effort: ill-behaved providers yield no models.
			}
		}
		return models;
	}

	// 按 ID 查找模型
	getModel(provider: string, id: string): ImagesModel<ImagesApi> | undefined {
		return this.getModels(provider).find((model) => model.id === id);
	}

	// 刷新：单供应商失败包装为 ModelsError(model_source)；全量用 allSettled 绝不 reject
	async refresh(provider?: string): Promise<void> {
		if (provider !== undefined) {
			const entry = this.providers.get(provider);
			if (!entry?.refreshModels) return;
			try {
				await entry.refreshModels();
			} catch (error) {
				if (error instanceof ModelsError) throw error;
				throw new ModelsError("model_source", `Model refresh failed for ${provider}`, { cause: error });
			}
			return;
		}

		// Cannot reject: the async mapper turns even sync throws from ill-behaved
		// providers into rejections, and allSettled captures all of them.
		await Promise.allSettled(Array.from(this.providers.values(), async (entry) => entry.refreshModels?.()));
	}

	getAuth(providerId: string, overrides?: AuthResolutionOverrides): Promise<AuthResult | undefined>;
	getAuth(model: ImagesModel<ImagesApi>, overrides?: AuthResolutionOverrides): Promise<AuthResult | undefined>;
	// 实现：解析认证（按 ID 或按模型）
	async getAuth(
		providerOrModel: string | ImagesModel<ImagesApi>,
		overrides?: AuthResolutionOverrides,
	): Promise<AuthResult | undefined> {
		const providerId = typeof providerOrModel === "string" ? providerOrModel : providerOrModel.provider;
		const provider = this.providers.get(providerId);
		if (!provider) return undefined;
		return resolveProviderAuth(provider, this.credentials, this.authContext, overrides);
	}

	// 生成图片（实现核心）：查供应商 → 解析认证 → 合并密钥/头/环境变量（显式选项优先）→
	// 委托供应商；任何异常都合成 stopReason:"error" 结果返回，绝不 reject
	async generateImages(
		model: ImagesModel<ImagesApi>,
		context: ImagesContext,
		options?: ImagesOptions,
	): Promise<AssistantImages> {
		try {
			const provider = this.providers.get(model.provider);
			if (!provider) {
				throw new ModelsError("provider", `Unknown provider: ${model.provider}`);
			}

			const resolution = await this.getAuth(model, {
				apiKey: options?.apiKey,
				env: options?.env,
			});
			const auth = resolution?.auth;
			if (!auth) {
				return provider.generateImages(model, context, options);
			}

			const requestModel = auth.baseUrl ? { ...model, baseUrl: auth.baseUrl } : model;

			// Explicit request options win per-field; headers/env merge per key.
			const apiKey = options?.apiKey ?? auth.apiKey;
			const headers = auth.headers || options?.headers ? { ...auth.headers, ...options?.headers } : undefined;
			const env =
				resolution.env || options?.env ? { ...(resolution.env ?? {}), ...(options?.env ?? {}) } : undefined;

			return await provider.generateImages(requestModel, context, { ...options, apiKey, headers, env });
		} catch (error) {
			return {
				api: model.api,
				provider: model.provider,
				model: model.id,
				output: [],
				stopReason: "error",
				errorMessage: error instanceof Error ? error.message : String(error),
				timestamp: Date.now(),
			};
		}
	}
}

// 创建可写图片模型集合
export function createImagesModels(options?: CreateModelsOptions): MutableImagesModels {
	return new ImagesModelsImpl(options);
}

/** 创建图片供应商的选项（中文说明）：基础元信息 + 认证 + 模型列表 + 可选动态拉取 + 图片 API 实现。 */
export interface CreateImagesProviderOptions {
	id: string;
	// 供应商 ID
	/** Display name. Default: `id`. */
	// 显示名称；缺省用 id
	name?: string;
	/** Required — every provider has auth semantics, even ambient/keyless ones. */
	// 必填——所有供应商都有认证语义（含环境凭据与免密钥场景）
	auth: ProviderAuth;
	/** Initial model list (empty for purely dynamic providers). */
	// 初始模型列表（纯动态供应商可传空）
	models: readonly ImagesModel<ImagesApi>[];
	/**
	 * Dynamic providers: fetch the current list. Stored on success; concurrent
	 * calls share one in-flight fetch. May reject: the stored list then stays
	 * at its last-known state, the rejection propagates to the caller of
	 * `refreshModels()` (wrapped as ModelsError "model_source" by
	 * `ImagesModels.refresh(provider)`), and a later call retries.
	 */
	refreshModels?: () => Promise<readonly ImagesModel<ImagesApi>[]>;
	// 动态拉取模型列表：成功即存储；并发共享同一进行中的拉取；失败保留旧列表并允许重试
	api: ProviderImages;
	// 图片 API 实现
}

/** Builds an image-generation provider from parts. */
// 从零件装配图片供应商（公开）：模型列表 + 可选的动态刷新 + 生成实现
export function createImagesProvider(input: CreateImagesProviderOptions): ImagesProvider {
	let models = input.models;
	// 当前模型列表（动态刷新后更新）
	let inflightRefresh: Promise<void> | undefined;
	// 进行中的刷新 Promise（并发去重）
	const refreshModels = input.refreshModels;

	return {
		id: input.id,
		name: input.name ?? input.id,
		auth: input.auth,
		getModels: () => models,
	// 动态刷新实现：并发去重；刷新结束清空 in-flight 标记
		refreshModels: refreshModels
			? () => {
					inflightRefresh ??= (async () => {
						try {
							models = await refreshModels();
						} finally {
							inflightRefresh = undefined;
						}
					})();
					return inflightRefresh;
				}
			: undefined,
	// 生成实现：直接委托图片 API
		generateImages: (model, context, options) => input.api.generateImages(model, context, options),
	};
}
