import type { ProviderEnv } from "../types.ts";
import type {
	ApiKeyAuth,
	ApiKeyCredential,
	AuthContext,
	AuthResult,
	Credential,
	CredentialStore,
	OAuthAuth,
	OAuthCredential,
	ProviderAuth,
} from "./types.ts";

/**
 * 【文件职责】认证解析核心（resolveProviderAuth）：统一 Models 与 ImagesModels 的认证解析——
 *              已存凭据优先，否则查环境凭据源；OAuth 过期时加锁全局刷新。
 * 【技术维度】双层检查锁（乐观过期检查 + 锁内权威检查）；凭据存储 modify 串行化；
 *              ModelsError 统一错误分类。
 * 【产品维度】保证登录/刷新/请求认证的一致性与并发安全，错误码可程序化处理。
 * 【逻辑维度】overrides 优先（显式 apiKey/env）→ 已存凭据（OAuth 刷新 / apiKey 解析）→
 *              环境凭据源兜底。
 * 【关键边界】已存凭据拥有供应商认证（无静默环境回退）；刷新失败抛 ModelsError(oauth)；
 *              凭据类型无对应处理器时返回 undefined。
 * 【新手阅读建议】先读 ModelsError 与 resolveProviderAuth 主流程 → 再精读
 *              resolveStoredOAuth 的双层检查锁。
 */
// 模型系统错误码：模型来源/校验/供应商/流/认证/OAuth
export type ModelsErrorCode = "model_source" | "model_validation" | "provider" | "stream" | "auth" | "oauth";

/** 认证解析覆盖项（中文说明）：显式密钥与环境变量覆盖。 */
export interface AuthResolutionOverrides {
	apiKey?: string;
	// 显式 API 密钥
	env?: ProviderEnv;
	// 显式环境变量覆盖
}

/** 模型系统统一错误（中文说明）：code 分类 + 可选 cause。 */
export class ModelsError extends Error {
	readonly code: ModelsErrorCode;

	constructor(code: ModelsErrorCode, message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = "ModelsError";
		this.code = code;
	}
}

/**
 * Auth resolution shared by the `Models` and `ImagesModels` collections.
 * A stored credential owns the provider: ambient/env is consulted only when
 * nothing is stored. No silent env fallback after a failed refresh or for a
 * credential type without a matching handler.
 */
/**
 * 解析供应商认证（公开）：显式 apiKey 覆盖优先；否则读已存凭据（OAuth 需刷新、
 * apiKey 走 resolve）；无凭据时查环境凭据源（env 变量/AWS 配置/ADC）。
 * 已存凭据拥有供应商：无静默环境回退。
 */
export async function resolveProviderAuth(
	provider: { id: string; auth: ProviderAuth },
	credentials: CredentialStore,
	authContext: AuthContext,
	overrides?: AuthResolutionOverrides,
): Promise<AuthResult | undefined> {
	const requestAuthContext = overrides?.env ? overlayEnvAuthContext(authContext, overrides.env) : authContext;

	if (overrides?.apiKey !== undefined && provider.auth.apiKey) {
		return resolveApiKey(requestAuthContext, provider.auth.apiKey, provider.id, {
			type: "api_key",
			key: overrides.apiKey,
			env: overrides.env,
		});
	}

	const stored = await readCredential(credentials, provider.id);
	if (stored) {
		if (stored.type === "oauth" && provider.auth.oauth) {
			return resolveStoredOAuth(credentials, provider.id, provider.auth.oauth, stored);
		}
		if (stored.type === "api_key" && provider.auth.apiKey) {
			const credential = overrides?.env ? { ...stored, env: { ...stored.env, ...overrides.env } } : stored;
			return resolveApiKey(requestAuthContext, provider.auth.apiKey, provider.id, credential);
		}
		return undefined;
	}

	// Ambient (env vars, AWS profiles, ADC files).
	// 环境凭据源兜底（环境变量/AWS 配置/ADC 文件）
	return provider.auth.apiKey
		? resolveApiKey(requestAuthContext, provider.auth.apiKey, provider.id, undefined)
		: undefined;
}

// 叠加环境覆盖的认证上下文（私有）：env 覆盖优先，fileExists 透传
function overlayEnvAuthContext(base: AuthContext, env: ProviderEnv): AuthContext {
	return {
		env: async (name) => env[name] || (await base.env(name)),
		fileExists: (path) => base.fileExists(path),
	};
}

/**
 * OAuth resolution with double-checked locking (same pattern as today's
 * AuthStorage): valid tokens cost zero locks; expired tokens lock, re-check
 * expiry under the lock, refresh once globally, and persist the rotated
 * credential before release.
 */
/**
 * OAuth 解析（私有）：有效令牌零锁；过期时加锁、锁内复检、全局仅刷新一次并持久化后释放。
 * 登出竞态（当前非 oauth）与并发刷新均安全。
 */
async function resolveStoredOAuth(
	credentials: CredentialStore,
	providerId: string,
	oauth: OAuthAuth,
	stored: OAuthCredential,
): Promise<AuthResult | undefined> {
	let credential = stored;

	if (Date.now() >= credential.expires) {
		// Optimistic check said expired; the authoritative check runs under the lock.
		// 乐观检查认为已过期；权威检查在锁内执行
		let post: Credential | undefined;
		try {
			post = await credentials.modify(providerId, async (current) => {
				if (current?.type !== "oauth") return undefined; // logged out meanwhile
				if (Date.now() < current.expires) return undefined; // another process/request refreshed
				try {
					return await oauth.refresh(current);
				} catch (error) {
					throw new ModelsError("oauth", `OAuth refresh failed for ${providerId}`, { cause: error });
				}
			});
		} catch (error) {
			if (error instanceof ModelsError) throw error;
			throw new ModelsError("auth", `Credential store modify failed for ${providerId}`, { cause: error });
		}
		if (post?.type !== "oauth") return undefined; // logged out meanwhile
		credential = post;
	}

	try {
		return { auth: await oauth.toAuth(credential), source: "OAuth" };
	} catch (error) {
		throw new ModelsError("oauth", `OAuth auth derivation failed for ${providerId}`, { cause: error });
	}
}

// apiKey 解析（私有）：委托认证方法的 resolve，失败包装为 ModelsError(auth)
async function resolveApiKey(
	authContext: AuthContext,
	apiKey: ApiKeyAuth,
	providerId: string,
	credential: ApiKeyCredential | undefined,
): Promise<AuthResult | undefined> {
	try {
		return await apiKey.resolve({ ctx: authContext, credential });
	} catch (error) {
		throw new ModelsError("auth", `API key auth failed for provider ${providerId}`, { cause: error });
	}
}

// 读取凭据（私有）：存储失败包装为 ModelsError(auth)
async function readCredential(credentials: CredentialStore, providerId: string): Promise<Credential | undefined> {
	try {
		return await credentials.read(providerId);
	} catch (error) {
		throw new ModelsError("auth", `Credential store read failed for ${providerId}`, { cause: error });
	}
}
