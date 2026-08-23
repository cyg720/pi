import type { ProviderEnv, ProviderHeaders } from "../types.ts";

/**
 * Request auth for a single model request. If a value cannot be expressed as
 * `apiKey`, `headers`, or `baseUrl`, it is provider config, not auth.
 */
/**
 * 【文件职责】认证体系的核心类型契约：凭据（API key / OAuth）、凭据存储、认证上下文、
 *              认证解析结果、登录交互与两种认证方法（apiKey/oauth）的形状。
 * 【技术维度】类型标签联合（Credential）；序列化读写（modify 唯一写路径）；
 *              环境/文件访问抽象（AuthContext，可注入测试与浏览器）。
 * 【产品维度】是登录/刷新/请求认证的公共语言：应用凭据存储与 Models 认证解析都依此对接。
 * 【逻辑维度】ModelAuth/AuthResult 请求认证 → Credential 存储形态 → CredentialStore 契约 →
 *              AuthContext/AuthInteraction 交互 → ApiKeyAuth/OAuthAuth 两种认证方法 → ProviderAuth。
 * 【关键边界】凭据仅能经 modify 序列化更新（防并发重复刷新）；read 缺失返回 undefined、
 *              仅存储失败才 reject；OAuth 的 refresh 与 toAuth 分离使刷新可加锁。
 * 【新手阅读建议】先读 Credential/CredentialStore 理解存储模型 → 再读 ApiKeyAuth/OAuthAuth
 *              了解两种认证方法 → 最后看 AuthPrompt/AuthEvent 的交互形态。
 */
/** 单次模型请求的认证（中文说明）：若值不能表达为 apiKey/headers/baseUrl 则属于供应商配置而非认证。 */
export interface ModelAuth {
	apiKey?: string;
	// API 密钥
	headers?: ProviderHeaders;
	// 认证请求头（含 null 抑制值）
	baseUrl?: string;
	// 认证决定的请求基础地址（如 Copilot 会话专属端点）
}

/**
 * Stored api-key credential. `env` holds provider-scoped environment/config
 * values such as Cloudflare account/gateway ids.
 */
/** 已存 API 密钥凭据（中文说明）：env 保存供应商作用域配置（如 Cloudflare 账号/网关 ID）。 */
export interface ApiKeyCredential {
	type: "api_key";
	// 类型标签
	key?: string;
	// 密钥本体（环境凭据场景可为空）
	env?: ProviderEnv;
	// 供应商作用域环境/配置值
}

/** OAuth token data returned by extension compatibility flows. */
/** 扩展兼容流程返回的 OAuth 令牌数据（中文说明）。 */
export interface OAuthCredentials {
	refresh: string;
	// 刷新令牌
	access: string;
	// 访问令牌
	expires: number;
	// 访问令牌过期时间戳（毫秒）
	[key: string]: unknown;
}

/** Stored canonical OAuth credential. */
/** 规范化存储的 OAuth 凭据（中文说明）：带 type 标签。 */
export interface OAuthCredential extends OAuthCredentials {
	type: "oauth";
}

/** One type-tagged credential per provider — the shape of today's auth.json. */
// 单供应商单凭据的联合类型（即当前 auth.json 的形态）
export type Credential = ApiKeyCredential | OAuthCredential;

/** Non-secret credential metadata for account/status enumeration. */
/** 凭据元信息（中文说明）：用于账号/状态枚举，不含敏感数据。 */
export interface CredentialInfo {
	providerId: string;
	type: Credential["type"];
}

/**
 * App-owned credential storage, keyed by `Provider.id`, one credential per
 * provider. `modify` is the only write path, so every mutation is a
 * serialized read-modify-write; `Models.getAuth()` runs OAuth refresh inside
 * `modify` so concurrent requests cannot double-refresh a rotated token. The
 * app persists a credential after login via
 * `modify(provider.id, async () => credential)`. Login/logout orchestration
 * is app-owned.
 *
 * Error semantics: `read` resolves `undefined` for missing entries. Methods
 * reject only on storage failure; `Models` wraps such rejections in
 * `ModelsError` with code "auth". Best-effort stores that serve an in-memory
 * view and record persistence errors internally (like coding-agent's
 * AuthStorage) are valid implementations.
 */
/**
 * 应用拥有的凭据存储（中文说明）：按 Provider.id 键控、每供应商一条；
 * modify 是唯一写路径（序列化读改写）；OAuth 刷新在 modify 内执行以杜绝并发双刷。
 * 错误语义：read 缺失返回 undefined；仅存储故障才 reject。
 */
export interface CredentialStore {
	/**
	 * Read the stored credential, possibly expired. Display/status use;
	 * resolved request auth comes from `Models.getAuth()`.
	 */
	read(providerId: string): Promise<Credential | undefined>;
	// 读取已存凭据（可能已过期）；展示/状态用；请求认证应走 Models.getAuth()

	/**
	 * List stored credential metadata without resolving or exposing secrets.
	 * Implementations must not execute configured API-key commands while listing.
	 */
	list(): Promise<readonly CredentialInfo[]>;
	// 列出凭据元信息（不解析、不暴露密钥；列出时不得执行配置的 api-key 命令）

	/**
	 * Serialized write — the only write path. `fn` sees the current credential
	 * because correct writes (refresh, login-during-refresh) depend on it;
	 * return the new credential, or undefined to leave the entry unchanged.
	 * Mutual exclusion per provider id, cross-process too where the backing
	 * store supports it (e.g. a file lock). Resolves with the post-write
	 * credential. Rejections from `fn` propagate.
	 */
	modify(
	// 序列化写——唯一写路径：fn 可见当前凭据（刷新/登录竞态依赖它）；
	// 返回新凭据，undefined 表示不改动；按供应商 ID 互斥（支持处可跨进程）；
	// 返回写后凭据；fn 的 rejection 向上传播
		providerId: string,
		fn: (current: Credential | undefined) => Promise<Credential | undefined>,
	): Promise<Credential | undefined>;

	/** Remove a credential (logout). Implementations serialize this against `modify`. */
	delete(providerId: string): Promise<void>;
	// 删除凭据（登出）；与 modify 串行化
}

/** Environment access for auth resolution. Injectable for tests and browsers. */
/** 认证解析的环境访问（中文说明）：可注入测试与浏览器环境。 */
export interface AuthContext {
	env(name: string): Promise<string | undefined>;
	// 读取环境变量
	/** Check whether a file exists. Supports a leading `~`. Always false in browsers. */
	fileExists(path: string): Promise<boolean>;
	// 检查文件是否存在（支持 ~ 前缀；浏览器恒 false）
}

/** Result of resolving auth for a model. */
/** 认证解析结果（中文说明）：auth 请求认证；env 解析出的供应商环境值；source 状态 UI 标签。 */
export interface AuthResult {
	auth: ModelAuth;
	/** Provider-scoped environment/config values resolved from credentials and ambient context. */
	env?: ProviderEnv;
	/** Human-readable label for status UI: "ANTHROPIC_API_KEY", "OAuth", "~/.aws/credentials". */
	source?: string;
}

/** 认证可用性检查结果（中文说明）：source 来源标签；type 类型。 */
export interface AuthCheck {
	source?: string;
	type: "api_key" | "oauth";
}

// 认证类型
export type AuthType = "api_key" | "oauth";

/**
 * Prompt shown to the user during login. `signal` lets the flow cancel a
 * pending prompt when an out-of-band event resolves the step, e.g. a
 * `manual_code` prompt raced against a callback server, aborted when the
 * callback wins.
 */
/**
 * 登录期间向用户展示的提示（中文说明）：text 文本输入 / secret 密文输入 /
 * select 选项选择 / manual_code 手动输入设备码；signal 可让流程在带外事件
 * 解决该步骤时取消挂起的提示（如回调服务器抢先成功）。
 */
export type AuthPrompt = { signal?: AbortSignal } & (
	| { type: "text"; message: string; placeholder?: string }
	| { type: "secret"; message: string; placeholder?: string }
	| { type: "select"; message: string; options: readonly { id: string; label: string; description?: string }[] }
	| { type: "manual_code"; message: string; placeholder?: string }
);

export interface AuthInfoLink {
	url: string;
	label?: string;
}

/** 登录过程通知事件（中文说明）：info 信息 / auth_url 授权链接 / device_code 设备码 / progress 进度。 */
export type AuthEvent =
	| { type: "info"; message: string; links?: readonly AuthInfoLink[] }
	| { type: "auth_url"; url: string; instructions?: string }
	| {
			type: "device_code";
			userCode: string;
			verificationUri: string;
			intervalSeconds?: number;
			expiresInSeconds?: number;
	  }
	| { type: "progress"; message: string };

/**
 * Login interaction callbacks serving both api-key and OAuth flows.
 *
 * `prompt()` returns the entered/selected string (`select` returns the option
 * id). Rejects on cancel/abort. `signal` aborts the whole login flow;
 * per-prompt cancellation uses `AuthPrompt.signal`.
 */
/**
 * 登录交互回调（中文说明）：prompt 返回输入/选择结果（select 返回选项 id），
 * 取消/中止时 reject；signal 中止整个登录流程，单提示取消走 AuthPrompt.signal。
 */
export interface AuthInteraction {
	signal?: AbortSignal;

	prompt(prompt: AuthPrompt): Promise<string>;
	notify(event: AuthEvent): void;
}

/**
 * Api-key auth: stored key/provider env plus ambient sources (env vars, AWS
 * profiles, ADC files). Ambient-only providers omit `login`.
 */
/**
 * API 密钥认证（中文说明）：已存密钥/供应商环境 + 环境凭据源（环境变量/AWS 配置/ADC）；
 * 仅环境凭据的供应商省略 login。
 */
export interface ApiKeyAuth {
	/** Display name, e.g. "Anthropic API key". */
	name: string;

	/** Interactive setup (prompt for key/provider env). Absent = ambient-only. */
	login?(interaction: AuthInteraction): Promise<ApiKeyCredential>;

	/**
	 * Optional side-effect-free availability check. Use this when `resolve()` may
	 * execute commands or perform other request-time work. Missing means Models
	 * checks availability by resolving auth.
	 */
	check?(input: { ctx: AuthContext; credential?: ApiKeyCredential }): Promise<AuthCheck | undefined>;

	/**
	 * Resolve auth from the stored credential and/or ambient sources, merging
	 * per field (`credential.key ?? env("...")`, `credential.env?.NAME ?? env("...")`).
	 * undefined = not configured. Resolution is provider-scoped; model-specific
	 * endpoint preparation happens after auth has been resolved.
	 */
	resolve(input: { ctx: AuthContext; credential?: ApiKeyCredential }): Promise<AuthResult | undefined>;
}

/**
 * OAuth auth. The `refresh`/`toAuth` split lets `Models` own the locked
 * refresh pattern: `refresh` produces a credential, `toAuth` derives request
 * auth from whatever credential ends up stored.
 */
/**
 * OAuth 认证（中文说明）：refresh 与 toAuth 分离——refresh 产出凭据（加锁执行），
 * toAuth 从最终存储的凭据派生请求认证（支持按凭据定 baseUrl，如 Copilot）。
 */
export interface OAuthAuth {
	/** Display name, e.g. "Anthropic (Claude Pro/Max)". */
	name: string;

	/** Selector label for the subscription login option, e.g. "Sign in with SuperGrok or X Premium". */
	loginLabel?: string;

	login(interaction: AuthInteraction): Promise<OAuthCredential>;

	/**
	 * Exchange the refresh token. Network call; throws on failure
	 * (invalid_grant etc.). `Models` runs this under the store lock.
	 */
	refresh(credential: OAuthCredential, signal?: AbortSignal): Promise<OAuthCredential>;

	/**
	 * Side-effect-free derivation of request auth from a valid credential.
	 * Covers per-credential baseUrl (GitHub Copilot). Async so lazy wrappers
	 * can load the implementation on first use.
	 */
	toAuth(credential: OAuthCredential): Promise<ModelAuth>;
}

/**
 * Provider auth. At least one of `apiKey`/`oauth` must be present: even
 * ambient-credential providers and keyless local servers provide `apiKey`
 * auth whose `resolve()` reports whether the provider is configured.
 */
/** 供应商认证集合（中文说明）：apiKey 与 oauth 至少其一（环境凭据/免密钥供应商也有 apiKey 语义）。 */
export interface ProviderAuth {
	apiKey?: ApiKeyAuth;
	oauth?: OAuthAuth;
}
