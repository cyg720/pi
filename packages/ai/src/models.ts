import { lazyStream } from "./api/lazy.ts";
import { defaultProviderAuthContext as defaultAuthContext } from "./auth/context.ts";
import { InMemoryCredentialStore } from "./auth/credential-store.ts";
import { type AuthResolutionOverrides, ModelsError, resolveProviderAuth } from "./auth/resolve.ts";
import type {
	AuthCheck,
	AuthContext,
	AuthInteraction,
	AuthResult,
	AuthType,
	Credential,
	CredentialStore,
	ProviderAuth,
} from "./auth/types.ts";
import { InMemoryModelsStore, type ModelsStore, type ProviderModelsStore } from "./models-store.ts";
import type {
	Api,
	ApiStreamOptions,
	AssistantMessage,
	AssistantMessageEventStream,
	Context,
	Model,
	ModelCostRates,
	ModelThinkingLevel,
	ProviderHeaders,
	ProviderStreams,
	SimpleStreamOptions,
	StreamOptions,
	Usage,
} from "./types.ts";

export { ModelsError, type ModelsErrorCode } from "./auth/resolve.ts";

/**
 * 【文件职责】实现模型集合（Models）运行时：管理供应商注册表、解析认证、刷新模型目录、
 *              登录/登出、按模型分发流式/补全请求，以及计算成本与思考级别支持判断；
 *              并提供 createProvider 从“零件”装配供应商。
 * 【技术维度】泛型 API 分发（model.api 驱动的多 API 供应商）；懒流式（lazyStream）；
 *              OAuth 凭据刷新与会话安全写（modify）；动态模型目录的并发刷新去重。
 * 【产品维度】是上层应用使用模型能力的统一入口：列模型、验配置、拿认证、发请求全在此完成，
 *              兼容静态目录与动态远程目录两种供应商形态。
 * 【逻辑维度】类型与接口（Provider/Models/MutableModels）→ ModelsImpl 实现（认证/刷新/分发）→
 *              createProvider 工厂（单 API 或按 API 分派）→ 工具函数（hasApi/成本/思考级别）。
 * 【关键边界】供应商未配置时 getAuth 返回 undefined、请求路径抛 ModelsError(auth)；
 *              刷新失败保留旧列表并尽力恢复缓存；calculateCost 按输入 token 阶梯计价并
 *              对 1h 缓存写入按 2 倍输入价计费。
 * 【新手阅读建议】先读 Provider 与 Models 两个接口了解契约 → 再读 ModelsImpl 的 applyAuth/
 *              refresh/getAvailable → 最后看 createProvider 的分派机制与成本计算。
 */
/** 刷新模型目录的上下文（中文说明）：credential 生效凭据（OAuth 会先刷新）；
 * store 单供应商存储；allowNetwork 是否允许联网；force 跳过新鲜度检查立即拉取。 */
export interface RefreshModelsContext {
	/** Effective configured credential. OAuth credentials are refreshed before network access. */
	// 生效的已配置凭据（网络访问前会先刷新 OAuth 令牌）
	credential?: Credential;
	/** Persistent model storage scoped to this provider ID. */
	// 该供应商 ID 作用域的持久模型存储
	store: ProviderModelsStore;
	/** False during offline/cache-only initialization. */
	// 离线/仅缓存初始化时为 false
	allowNetwork: boolean;
	/** Bypass provider freshness checks and fetch immediately when network access is allowed. */
	// 允许联网时跳过新鲜度检查立即拉取
	force?: boolean;
	signal?: AbortSignal;
}

/** 刷新选项（中文说明）：allowNetwork 默认 true；force 立即拉取。 */
export interface ModelsRefreshOptions {
	allowNetwork?: boolean;
	/** Bypass provider freshness checks and fetch immediately when network access is allowed. */
	force?: boolean;
	signal?: AbortSignal;
}

/** 刷新结果（中文说明）：aborted 是否被中止；errors 各供应商错误映射。 */
export interface ModelsRefreshResult {
	aborted: boolean;
	// 是否被中止信号打断
	errors: ReadonlyMap<string, Error>;
	// 供应商 ID → 错误 的映射（失败供应商在此登记，不抛异常）
}

/** 流式选项扩展（中文说明）：transformHeaders 在供应商分发前改写请求头。 */
export interface ModelsStreamTransforms {
	/** Transform fully assembled model/auth/request headers before provider dispatch. */
	// 在分发到供应商前变换组装好的模型/认证/请求头
	transformHeaders?: (headers: ProviderHeaders) => ProviderHeaders | Promise<ProviderHeaders>;
}

// API 流式选项 = 底层 API 选项 + 请求头变换钩子
export type ModelsApiStreamOptions<TApi extends Api> = ApiStreamOptions<TApi> & ModelsStreamTransforms;
// 简化流式选项 = 底层简化选项 + 请求头变换钩子
export type ModelsSimpleStreamOptions = SimpleStreamOptions & ModelsStreamTransforms;

/**
 * A provider is the concrete runtime unit. It owns id/name/base metadata,
 * auth methods, model listing, and stream behavior.
 *
 * `TApi` lets concrete provider factories declare which APIs their models
 * use (e.g. `openaiProvider(): Provider<"openai-responses" | "openai-completions">`),
 * giving typed model lists to direct factory users. Inside a `Models`
 * collection providers are held as `Provider<Api>`.
 */
/**
 * 供应商（中文说明）：具体运行时单元——拥有 id/名称/元数据、认证方法、模型清单与流式行为。
 * 泛型 TApi 让工厂能声明模型使用的 API 集合，从而给模型列表提供类型。
 */
export interface Provider<TApi extends Api = Api> {
	readonly id: string;
	// 供应商唯一标识
	readonly name: string;
	// 显示名称

	readonly baseUrl?: string;
	// 可选的 API 基础地址（覆盖模型默认）
	readonly headers?: ProviderHeaders;
	// 可选的静态请求头

	/**
	 * Required: at least one of `apiKey`/`oauth`. Every provider has auth
	 * semantics — even providers with only ambient credentials (env vars, AWS
	 * profiles, ADC files) and keyless local servers provide `apiKey` auth
	 * whose `resolve()` reports whether the provider is configured.
	 * `Models.getAuth()` returns undefined when the provider is unconfigured.
	 */
	// 认证方法（apiKey 和/或 oauth）；所有供应商都有认证语义（含仅环境凭据与免密钥本地服务）
	readonly auth: ProviderAuth;

	/**
	 * Current known models, sync. Static providers return their catalog;
	 * dynamic providers return the list as of the last `refreshModels()`
	 * (empty before the first). Must not throw; `Models` treats a throwing
	 * implementation as having no models.
	 */
	// 当前已知模型（同步）：静态供应商返回目录；动态供应商返回最近一次刷新结果（首次前为空）；不得抛错
	getModels(): readonly Model<TApi>[];

	/**
	 * Dynamic providers only: restore the provider-scoped stored catalog and optionally fetch
	 * a newer list using the effective credential. Implementations must retain their previous
	 * list on failure and honor the shared abort signal for network requests.
	 */
	// 动态供应商专用：恢复缓存目录并可选拉取更新；失败保留旧列表、尊重共享中止信号
	refreshModels?(context: RefreshModelsContext): Promise<void>;

	/**
	 * Optional provider policy for credential-specific model availability.
	 * `getModels()` remains the complete synchronous catalog; `Models.getAvailable()`
	 * applies this filter after confirming that provider auth is configured.
	 */
	// 可选的凭据相关可用性过滤：getModels 保持完整目录，getAvailable 在认证就绪后应用此过滤
	filterModels?(models: readonly Model<TApi>[], credential: Credential | undefined): readonly Model<TApi>[];

	// 流式请求：按模型调用对应 API 实现
	stream<T extends TApi>(
		model: Model<T>,
		context: Context,
		options?: ApiStreamOptions<T>,
	): AssistantMessageEventStream;

	// 简化流式请求
	streamSimple(model: Model<TApi>, context: Context, options?: SimpleStreamOptions): AssistantMessageEventStream;
}

/**
 * Runtime collection of providers plus auth application and stream
 * convenience. Providers own stream behavior; `Models` resolves auth and
 * delegates each request to the provider that owns the model.
 */
/**
 * 模型集合运行时（中文说明）：供应商集合 + 认证应用 + 流式便捷层。
 * 供应商拥有流式行为；Models 负责解析认证并把每个请求委托给拥有该模型的供应商。
 */
export interface Models {
	getProviders(): readonly Provider[];
	// 全部供应商
	getProvider(id: string): Provider | undefined;
	// 按 ID 查供应商

	/**
	 * Sync read of last-known models from one provider or all providers.
	 * Best-effort: a provider whose `getModels()` throws yields no models.
	 */
	// 同步读取某（或全部）供应商最近已知的模型列表；尽力而为（getModels 抛错的供应商产出空列表）
	getModels(provider?: string): readonly Model<Api>[];

	/**
	 * Sync runtime model lookup against last-known lists. Dynamic model lists
	 * are typed as `Model<Api>`; narrow with the `hasApi()` type guard.
	 */
	// 同步查找模型；动态列表类型为 Model<Api>，可用 hasApi() 收窄
	getModel(provider: string, id: string): Model<Api> | undefined;

	/**
	 * Refresh every configured dynamic provider concurrently. Provider errors and cancellation
	 * are returned without rejecting; static and unconfigured providers are skipped.
	 */
	// 并发刷新全部已配置的动态供应商；错误与取消以结果返回而不 reject；跳过静态/未配置供应商
	refresh(options?: ModelsRefreshOptions): Promise<ModelsRefreshResult>;

	/** Check whether a provider has complete auth configuration without refreshing OAuth. */
	// 检查供应商认证配置是否完整（不刷新 OAuth）
	checkAuth(providerId: string): Promise<AuthCheck | undefined>;

	/** Return models whose providers have complete auth configuration. */
	// 返回认证配置完整的供应商的模型（应用 filterModels）
	getAvailable(providerId?: string): Promise<readonly Model<Api>[]>;

	/**
	 * Resolve provider-scoped auth by provider id, or provider auth plus static
	 * model headers when passed a model. Includes a source label for status UI.
	 * Resolves `undefined` when the provider is unknown or unconfigured.
	 * Rejects with `ModelsError`: code "oauth" when a token refresh fails (the
	 * stored credential is preserved for retry; re-login fixes it), code "auth"
	 * when api-key resolution or the credential store fails. Request paths
	 * surface rejections as stream errors.
	 */
	// 解析供应商作用域认证（重载：按供应商 ID 或按模型）；含状态 UI 用的来源标签；
	// 未知/未配置供应商返回 undefined；刷新失败抛 ModelsError(oauth)，密钥解析失败抛 ModelsError(auth)
	// 重载声明：按供应商 ID
	getAuth(providerId: string, overrides?: AuthResolutionOverrides): Promise<AuthResult | undefined>;
	getAuth(model: Model<Api>, overrides?: AuthResolutionOverrides): Promise<AuthResult | undefined>;

	/** Run a provider-owned login flow and persist its returned credential. */
	// 运行供应商的登录流程并持久化返回的凭据
	login(providerId: string, type: AuthType, interaction: AuthInteraction): Promise<Credential>;

	/** Remove the stored credential for a provider. */
	logout(providerId: string): Promise<void>;
	// 移除供应商已存凭据

	// 流式请求：解析认证后委托供应商 stream
	// 流式请求：懒加载认证后委托供应商
	stream<TApi extends Api>(
		model: Model<TApi>,
		context: Context,
		options?: ModelsApiStreamOptions<TApi>,
	): AssistantMessageEventStream;

	// 补全请求：等待流结束返回完整助手消息
	complete<TApi extends Api>(
		model: Model<TApi>,
		context: Context,
		options?: ModelsApiStreamOptions<TApi>,
	): Promise<AssistantMessage>;

	// 简化流式请求
	streamSimple(model: Model<Api>, context: Context, options?: ModelsSimpleStreamOptions): AssistantMessageEventStream;
	// 简化补全请求
	completeSimple(model: Model<Api>, context: Context, options?: ModelsSimpleStreamOptions): Promise<AssistantMessage>;
}

/** 可写模型集合（中文说明）：可增删供应商。 */
export interface MutableModels extends Models {
	/** Upsert/replace by provider.id. Provider ids are unique. */
	// 按 provider.id 新增或替换供应商（ID 唯一）
	setProvider(provider: Provider): void;
	deleteProvider(id: string): void;
	// 删除供应商
	clearProviders(): void;
	// 清空全部供应商
}

/** 创建选项（中文说明）：三个子系统均可注入（缺省用内存实现/默认认证上下文）。 */
export interface CreateModelsOptions {
	credentials?: CredentialStore;
	// 凭据存储
	modelsStore?: ModelsStore;
	// 模型目录存储
	authContext?: AuthContext;
	// 认证上下文
}

// 合并请求头（私有）：override 覆盖 base 中同名键（大小写不敏感）
function mergeHeaders(
	base: ProviderHeaders | undefined,
	override: ProviderHeaders | undefined,
): ProviderHeaders | undefined {
	if (!base && !override) return undefined;
	const merged = { ...base };
	for (const [name, value] of Object.entries(override ?? {})) {
		const lowerName = name.toLowerCase();
		for (const existingName of Object.keys(merged)) {
			if (existingName.toLowerCase() === lowerName) delete merged[existingName];
		}
		merged[name] = value;
	}
	return merged;
}

/**
 * ModelsImpl（中文说明）：Models 接口的具体实现——
 * 内部持有供应商 Map、凭据存储、模型目录存储与认证上下文。
 */
class ModelsImpl implements MutableModels {
	private providers = new Map<string, Provider>();
	// 供应商注册表
	private credentials: CredentialStore;
	// 凭据存储
	private modelsStore: ModelsStore;
	// 模型目录存储
	private authContext: AuthContext;
	// 认证上下文

	constructor(options?: CreateModelsOptions) {
		this.credentials = options?.credentials ?? new InMemoryCredentialStore();
		this.modelsStore = options?.modelsStore ?? new InMemoryModelsStore();
		this.authContext = options?.authContext ?? defaultAuthContext();
	}

	// 新增/替换供应商
	setProvider(provider: Provider): void {
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

	// 全部供应商
	getProviders(): readonly Provider[] {
		return Array.from(this.providers.values());
	}

	// 按 ID 查供应商
	getProvider(id: string): Provider | undefined {
		return this.providers.get(id);
	}

	// 读取模型：单供应商尽力而为；全部供应商时逐个容错聚合
	getModels(provider?: string): readonly Model<Api>[] {
		if (provider !== undefined) {
			const entry = this.providers.get(provider);
			if (!entry) return [];
			try {
				return entry.getModels();
			} catch {
				return [];
			}
		}

		const models: Model<Api>[] = [];
		for (const entry of this.providers.values()) {
			try {
				models.push(...entry.getModels());
			} catch {
				// Best-effort: ill-behaved providers yield no models.
			}
		}
		return models;
	}

	// 在供应商模型列表中按 ID 查找
	getModel(provider: string, id: string): Model<Api> | undefined {
		return this.getModels(provider).find((model) => model.id === id);
	}

	// 并发刷新动态供应商：先读/刷凭据再调用 refreshModels；
	// 主流程失败时用缓存凭据做离线恢复；错误逐供应商登记
	async refresh(options: ModelsRefreshOptions = {}): Promise<ModelsRefreshResult> {
		const allowNetwork = options.allowNetwork ?? true;
		const errors = new Map<string, Error>();
		const refreshable = Array.from(this.providers.values()).filter(
			(provider): provider is Provider & Required<Pick<Provider, "refreshModels">> =>
				provider.refreshModels !== undefined,
		);

		await Promise.all(
			refreshable.map(async (provider) => {
				if (options.signal?.aborted) return;
				const store: ProviderModelsStore = {
					read: () => this.modelsStore.read(provider.id),
					write: (entry) => this.modelsStore.write(provider.id, entry),
					delete: () => this.modelsStore.delete(provider.id),
				};
				let stored: Credential | undefined;
				try {
					stored = await this.readCredential(provider.id);
					const credential = await this.resolveRefreshCredential(provider, stored, allowNetwork, options.signal);
					if (!credential) return;
					await provider.refreshModels({
						credential,
						store,
						allowNetwork,
						force: options.force,
						signal: options.signal,
					});
				} catch (error) {
					if (!options.signal?.aborted) {
						errors.set(
							provider.id,
							error instanceof Error
								? error
								: new ModelsError("model_source", `Model refresh failed for ${provider.id}`, { cause: error }),
						);
					}
					try {
						await provider.refreshModels({
							credential: stored,
							store,
							allowNetwork: false,
							signal: options.signal,
						});
					} catch {
						// Preserve the original auth/network error; cache restoration is best-effort here.
					}
				}
			}),
		);

		return { aborted: options.signal?.aborted ?? false, errors };
	}

	// 解析刷新用凭据（私有）：OAuth 临近过期且允许联网时经 modify 并发安全刷新；
	// apiKey 走 resolve 解析；无凭据来源返回 undefined
	private async resolveRefreshCredential(
		provider: Provider,
		stored: Credential | undefined,
		allowNetwork: boolean,
		signal?: AbortSignal,
	): Promise<Credential | undefined> {
		if (stored?.type === "oauth") {
			const oauth = provider.auth.oauth;
			if (!oauth) return undefined;
			if (!allowNetwork || Date.now() < stored.expires) return stored;
			if (signal?.aborted) return undefined;
			const post = await this.credentials.modify(provider.id, async (current) => {
				if (current?.type !== "oauth" || Date.now() < current.expires) return undefined;
				return oauth.refresh(current, signal);
			});
			return post?.type === "oauth" ? post : undefined;
		}

		const apiKey = provider.auth.apiKey;
		if (!apiKey) return undefined;
		const credential = stored?.type === "api_key" ? stored : undefined;
		const result = await apiKey.resolve({ ctx: this.authContext, credential });
		if (!result) return undefined;
		return { type: "api_key", key: result.auth.apiKey, env: result.env };
	}

	// 读取凭据（私有）：存储读取失败包装为 ModelsError(auth)
	private async readCredential(providerId: string): Promise<Credential | undefined> {
		try {
			return await this.credentials.read(providerId);
		} catch (error) {
			throw new ModelsError("auth", `Credential store read failed for ${providerId}`, { cause: error });
		}
	}

	// 检查单供应商认证（私有）：OAuth 直接判有无方法；apiKey 优先走 check，否则走通用解析
	private async checkProviderAuth(
		provider: Provider,
		credential: Credential | undefined,
	): Promise<AuthCheck | undefined> {
		if (credential?.type === "oauth") {
			return provider.auth.oauth ? { source: "OAuth", type: "oauth" } : undefined;
		}
		const apiKey = provider.auth.apiKey;
		if (!apiKey) return undefined;
		if (apiKey.check) {
			try {
				return await apiKey.check({
					ctx: this.authContext,
					credential: credential?.type === "api_key" ? credential : undefined,
				});
			} catch (error) {
				throw new ModelsError("auth", `API key auth check failed for provider ${provider.id}`, { cause: error });
			}
		}

		const resolution = await resolveProviderAuth(provider, this.credentials, this.authContext);
		return resolution ? { source: resolution.source, type: "api_key" } : undefined;
	}

	// 对外检查认证
	async checkAuth(providerId: string): Promise<AuthCheck | undefined> {
		const provider = this.providers.get(providerId);
		if (!provider) return undefined;
		return this.checkProviderAuth(provider, await this.readCredential(providerId));
	}

	// 可用模型：并发检查各供应商认证，认证就绪者应用 filterModels 后返回模型
	async getAvailable(providerId?: string): Promise<readonly Model<Api>[]> {
		const providers = providerId
			? [this.providers.get(providerId)].filter((entry) => entry !== undefined)
			: this.getProviders();
		const checks = await Promise.all(
			providers.map(async (provider) => {
				const credential = await this.readCredential(provider.id);
				return { provider, credential, auth: await this.checkProviderAuth(provider, credential) };
			}),
		);
		return checks.flatMap(({ provider, credential, auth }) => {
			if (!auth) return [];
			const models = provider.getModels();
			return provider.filterModels?.(models, credential) ?? models;
		});
	}

	getAuth(providerId: string, overrides?: AuthResolutionOverrides): Promise<AuthResult | undefined>;
	getAuth(model: Model<Api>, overrides?: AuthResolutionOverrides): Promise<AuthResult | undefined>;
	// 实现：解析认证；传入模型时把模型级静态头合并进认证头
	async getAuth(
		providerOrModel: string | Model<Api>,
		overrides?: AuthResolutionOverrides,
	): Promise<AuthResult | undefined> {
		const providerId = typeof providerOrModel === "string" ? providerOrModel : providerOrModel.provider;
		const provider = this.providers.get(providerId);
		if (!provider) return undefined;
		const result = await resolveProviderAuth(provider, this.credentials, this.authContext, overrides);
		if (!result || typeof providerOrModel === "string" || !providerOrModel.headers) return result;
		return {
			...result,
			auth: {
				...result.auth,
				headers: mergeHeaders(result.auth.headers, providerOrModel.headers),
			},
		};
	}

	// 登录：按类型取认证方法、执行登录、经 modify 持久化凭据
	async login(providerId: string, type: AuthType, interaction: AuthInteraction): Promise<Credential> {
		const provider = this.providers.get(providerId);
		if (!provider) throw new ModelsError("provider", `Unknown provider: ${providerId}`);
		const method = type === "oauth" ? provider.auth.oauth : provider.auth.apiKey;
		if (!method?.login) {
			throw new ModelsError("auth", `${provider.name} does not support ${type} login`);
		}
		const credential = await method.login(interaction);
		try {
			await this.credentials.modify(providerId, async () => credential);
		} catch (error) {
			throw new ModelsError("auth", `Credential store modify failed for ${providerId}`, { cause: error });
		}
		return credential;
	}

	// 登出：删除凭据
	async logout(providerId: string): Promise<void> {
		try {
			await this.credentials.delete(providerId);
		} catch (error) {
			throw new ModelsError("auth", `Credential store delete failed for ${providerId}`, { cause: error });
		}
	}

	// 按模型找供应商（私有）：不存在抛 ModelsError(provider)
	private requireProvider(model: Model<Api>): Provider {
		const provider = this.providers.get(model.provider);
		if (!provider) {
			throw new ModelsError("provider", `Unknown provider: ${model.provider}`);
		}
		return provider;
	}

	// 应用认证（私有核心）：解析认证 → 按字段合并显式选项/认证头/变换钩子 →
	// 组装请求模型（覆盖 baseUrl）与请求选项（密钥/头/环境变量）
	private async applyAuth<TOptions extends StreamOptions & ModelsStreamTransforms>(
		model: Model<Api>,
		options: TOptions | undefined,
	): Promise<{ requestModel: Model<Api>; requestOptions: StreamOptions | undefined }> {
		this.requireProvider(model);
		const resolution = await this.getAuth(model, {
			apiKey: options?.apiKey,
			env: options?.env,
		});
		if (!resolution) {
			throw new ModelsError("auth", `Provider is not configured: ${model.provider}`);
		}
		const auth = resolution.auth;

		// Explicit request options win per-field; the Models-only transform runs last.
		// 显式请求选项逐字段优先；Models 级变换钩子最后执行
		const apiKey = options?.apiKey ?? auth.apiKey;
		let headers = mergeHeaders(auth.headers, options?.headers);
		if (options?.transformHeaders) headers = await options.transformHeaders(headers ?? {});
		const env = resolution.env || options?.env ? { ...(resolution.env ?? {}), ...(options?.env ?? {}) } : undefined;
		const requestModel = auth.baseUrl ? { ...model, baseUrl: auth.baseUrl } : model;
		const { transformHeaders: _transformHeaders, ...providerOptions } = options ?? {};
		const requestOptions = { ...providerOptions, apiKey, headers, env } as StreamOptions;

		return { requestModel, requestOptions };
	}

	stream<TApi extends Api>(
		model: Model<TApi>,
		context: Context,
		options?: ModelsApiStreamOptions<TApi>,
	): AssistantMessageEventStream {
		return lazyStream(model, async () => {
			const provider = this.requireProvider(model);
			const { requestModel, requestOptions } = await this.applyAuth(
				model,
				options as ModelsApiStreamOptions<Api> | undefined,
			);
			return provider.stream(requestModel as Model<TApi>, context, requestOptions as ApiStreamOptions<TApi>);
		});
	}

	// 补全请求：取流结果
	async complete<TApi extends Api>(
		model: Model<TApi>,
		context: Context,
		options?: ModelsApiStreamOptions<TApi>,
	): Promise<AssistantMessage> {
		return this.stream(model, context, options).result();
	}

	// 简化流式请求
	streamSimple(model: Model<Api>, context: Context, options?: ModelsSimpleStreamOptions): AssistantMessageEventStream {
		return lazyStream(model, async () => {
			const provider = this.requireProvider(model);
			const { requestModel, requestOptions } = await this.applyAuth(model, options);
			return provider.streamSimple(requestModel, context, requestOptions as SimpleStreamOptions);
		});
	}

	// 简化补全请求
	async completeSimple(
		model: Model<Api>,
		context: Context,
		options?: ModelsSimpleStreamOptions,
	): Promise<AssistantMessage> {
		return this.streamSimple(model, context, options).result();
	}
}

// 创建可写模型集合
export function createModels(options?: CreateModelsOptions): MutableModels {
	return new ModelsImpl(options);
}

/** 创建供应商的选项（中文说明）：基础元信息 + 认证 + 静态模型基线 + 可选的动态拉取与 API 实现。 */
export interface CreateProviderOptions<TApi extends Api = Api> {
	id: string;
	// 供应商 ID
	/** Display name. Default: `id`. */
	// 显示名称；缺省用 id
	name?: string;
	baseUrl?: string;
	// 基础地址
	headers?: ProviderHeaders;
	// 静态请求头
	/** Required — every provider has auth semantics, even ambient/keyless ones. */
	// 必填——所有供应商都有认证语义（含环境凭据与免密钥场景）
	auth: ProviderAuth;
	/** Static baseline model list (empty for purely dynamic providers). */
	// 静态基线模型列表（纯动态供应商可传空）
	models: readonly Model<TApi>[];
	/** Fetch a dynamic model overlay. createProvider restores/persists it through ModelsStore. */
	// 拉取动态模型覆盖层；createProvider 会经 ModelsStore 恢复/持久化
	fetchModels?: (context: RefreshModelsContext) => Promise<readonly Model<TApi>[]>;
	filterModels?: (models: readonly Model<TApi>[], credential: Credential | undefined) => readonly Model<TApi>[];
	// 凭据相关可用性过滤
	/** Single implementation, or map keyed by `model.api` for mixed-API providers. */
	// API 实现：单个实现，或按 model.api 键控的映射（支持混合 API 供应商）
	api: ProviderStreams | Partial<Record<TApi, ProviderStreams>>;
}

/**
 * Builds a provider from parts. Built-in provider factories and models.json
 * custom providers both go through this. A single `api` streams all models;
 * an `api` map dispatches on `model.api`, and a model whose api has no entry
 * produces a stream error.
 */
// 从零件装配供应商（公开）：内置供应商工厂与 models.json 自定义供应商都走此函数；
// 单个 api 服务全部模型；api 映射按 model.api 分派（无对应条目则流错误）
export function createProvider<TApi extends Api = Api>(input: CreateProviderOptions<TApi>): Provider<TApi> {
	const baselineModels = input.models;
	// 静态基线模型
	let dynamicModels: readonly Model<TApi>[] = [];
	// 动态覆盖模型（刷新后更新）
	let inflightRefresh: Promise<void> | undefined;
	// 进行中的刷新 Promise（并发去重）
	const fetchModels = input.fetchModels;
	const currentModels = (): readonly Model<TApi>[] => {
	// 当前模型 = 基线 + 动态覆盖（按 id 覆盖或追加）
		const merged = [...baselineModels];
		for (const model of dynamicModels) {
			const index = merged.findIndex((entry) => entry.id === model.id);
			if (index >= 0) merged[index] = model;
			else merged.push(model);
		}
		return merged;
	};
	const single =
		typeof (input.api as ProviderStreams).stream === "function" ? (input.api as ProviderStreams) : undefined;
	const byApi = single ? undefined : (input.api as Partial<Record<string, ProviderStreams>>);

	const apiFor = (model: Model<Api>): ProviderStreams | undefined => single ?? byApi?.[model.api];

	// 按模型分发到 API 实现（私有）：无对应实现则产出带错误的事件流
	const dispatch = (
		model: Model<Api>,
		run: (streams: ProviderStreams) => AssistantMessageEventStream,
	): AssistantMessageEventStream => {
		const streams = apiFor(model);
		if (!streams) {
			return lazyStream(model, async () => {
				throw new ModelsError("stream", `Provider ${input.id} has no API implementation for "${model.api}"`);
			});
		}
		return run(streams);
	};

	return {
		id: input.id,
		name: input.name ?? input.id,
		baseUrl: input.baseUrl,
		headers: input.headers,
		auth: input.auth,
		getModels: currentModels,
	// 动态刷新实现：先恢复缓存目录，允许联网时拉取新列表并持久化；并发去重
		refreshModels: fetchModels
			? (context) => {
					inflightRefresh ??= (async () => {
						try {
							const stored = await context.store.read();
							if (stored) {
								dynamicModels = stored.models
									.filter((model) => model.provider === input.id)
									.map((model) => model as Model<TApi>);
							}
							if (!context.allowNetwork || context.signal?.aborted) return;
							const refreshed = await fetchModels(context);
							if (context.signal?.aborted) return;
							dynamicModels = refreshed;
							await context.store.write({ models: refreshed, checkedAt: Date.now() });
						} finally {
							inflightRefresh = undefined;
						}
					})();
					return inflightRefresh;
				}
			: undefined,
		filterModels: input.filterModels,
		stream: (model, context, options) => dispatch(model, (streams) => streams.stream(model, context, options)),
		streamSimple: (model, context, options) =>
			dispatch(model, (streams) => streams.streamSimple(model, context, options)),
	};
}

/**
 * Runtime-checked narrowing for dynamically looked-up models:
 *
 * ```ts
 * const model = models.getModel("anthropic", "claude-opus-4-7");
 * if (model && hasApi(model, "anthropic-messages")) {
 *   // model: Model<"anthropic-messages">, stream options fully typed
 * }
 * ```
 */
/**
 * 运行时校验的类型收窄（公开）：动态查到的模型经此判断后获得完整类型。
 * 使用示例：if (hasApi(model, "anthropic-messages")) { …model 已收窄为 Model<"anthropic-messages"> }
 */
export function hasApi<TApi extends Api>(model: Model<Api>, api: TApi): model is Model<TApi> {
	return model.api === api;
}

// 计算请求成本（公开）：按输入 token 匹配最高适用阶梯费率；
// 1h 缓存写入按输入价 2 倍计费，其余按各自费率；结果写回 usage.cost
export function calculateCost<TApi extends Api>(model: Model<TApi>, usage: Usage): Usage["cost"] {
	const inputTokens = usage.input + usage.cacheRead + usage.cacheWrite;
	let rates: ModelCostRates = model.cost;
	let matchedThreshold = -1;
	for (const tier of model.cost.tiers ?? []) {
		if (inputTokens > tier.inputTokensAbove && tier.inputTokensAbove > matchedThreshold) {
			rates = tier;
			matchedThreshold = tier.inputTokensAbove;
		}
	}

	// Anthropic charges 2x base input for 1h cache writes.
	// Anthropic 对 1h 缓存写入按基础输入价 2 倍计费
	const longWrite = usage.cacheWrite1h ?? 0;
	const shortWrite = usage.cacheWrite - longWrite;
	usage.cost.input = (rates.input / 1000000) * usage.input;
	usage.cost.output = (rates.output / 1000000) * usage.output;
	usage.cost.cacheRead = (rates.cacheRead / 1000000) * usage.cacheRead;
	usage.cost.cacheWrite = (rates.cacheWrite * shortWrite + rates.input * 2 * longWrite) / 1000000;
	usage.cost.total = usage.cost.input + usage.cost.output + usage.cost.cacheRead + usage.cost.cacheWrite;
	return usage.cost;
}

// 全部思考强度档位（按强度递增排序）
const EXTENDED_THINKING_LEVELS: ModelThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];

// 获取模型支持的思考强度（公开）：不支持推理只返回 off；
// xhigh/max 仅在思考级别映射表中显式存在时才可用
export function getSupportedThinkingLevels<TApi extends Api>(model: Model<TApi>): ModelThinkingLevel[] {
	if (!model.reasoning) return ["off"];

	return EXTENDED_THINKING_LEVELS.filter((level) => {
		const mapped = model.thinkingLevelMap?.[level];
		if (mapped === null) return false;
		if (level === "xhigh" || level === "max") return mapped !== undefined;
		return true;
	});
}

// 把思考强度钳制到模型支持的范围（公开）：先取支持集合；请求档不可用时
// 优先向更强档位找，再回退较弱档位，最终回退 off
export function clampThinkingLevel<TApi extends Api>(
	model: Model<TApi>,
	level: ModelThinkingLevel,
): ModelThinkingLevel {
	const availableLevels = getSupportedThinkingLevels(model);
	if (availableLevels.includes(level)) return level;

	const requestedIndex = EXTENDED_THINKING_LEVELS.indexOf(level);
	if (requestedIndex === -1) return availableLevels[0] ?? "off";

	for (let i = requestedIndex; i < EXTENDED_THINKING_LEVELS.length; i++) {
		const candidate = EXTENDED_THINKING_LEVELS[i];
		if (availableLevels.includes(candidate)) return candidate;
	}
	for (let i = requestedIndex - 1; i >= 0; i--) {
		const candidate = EXTENDED_THINKING_LEVELS[i];
		if (availableLevels.includes(candidate)) return candidate;
	}
	return availableLevels[0] ?? "off";
}

/**
 * Check if two models are equal by comparing both their id and provider.
 * Returns false if either model is null or undefined.
 */
// 判断两个模型是否相同（公开）：id 与 provider 均相同；任一为空返回 false
export function modelsAreEqual<TApi extends Api>(
	a: Model<TApi> | null | undefined,
	b: Model<TApi> | null | undefined,
): boolean {
	if (!a || !b) return false;
	return a.id === b.id && a.provider === b.provider;
}
