/**
 * 【文件职责】标准认证构造辅助：envApiKeyAuth 生成"存储密钥优先 + 环境变量兜底"的 apiKey 认证；
 *              lazyOAuth 包装动态导入的 OAuth 实现（首用加载）。
 * 【技术维度】闭包惰性加载（promise 缓存）；变量说明符动态导入（打包器不解析）。
 * 【产品维度】让供应商定义以最小样板声明认证，同时把 Node 专属流程代码挡在包外。
 * 【逻辑维度】envApiKeyAuth：login 提示密钥、resolve 依次尝试存储密钥与环境变量；
 *              lazyOAuth：首次调用时加载实现并缓存，转发四个方法。
 * 【关键边界】envApiKeyAuth 非标准解析（IAM/ADC 等）需自定义 ApiKeyAuth；
 *              lazyOAuth 的 load 失败在首次调用时暴露。
 * 【新手阅读建议】先读 envApiKeyAuth 的 resolve 顺序，再看 lazyOAuth 的惰性加载。
 */
import type { ApiKeyAuth, OAuthAuth } from "./types.ts";

/**
 * Standard api-key auth: a stored credential key wins, otherwise the first
 * set env var resolves. Includes a `login` that prompts for the key.
 * Providers with non-standard resolution (provider env, ambient files, IAM)
 * write their own `ApiKeyAuth`.
 */
// 标准 api-key 认证（公开）：已存密钥优先，否则首个已设置的环境变量；
// 附带提示输入密钥的 login。非标准解析（IAM/ADC 等）的供应商需自定义。
export function envApiKeyAuth(name: string, envVars: readonly string[]): ApiKeyAuth {
	return {
		name,
		login: async (interaction) => {
			const key = await interaction.prompt({ type: "secret", message: `Enter ${name}` });
			return { type: "api_key", key };
		},
		resolve: async ({ ctx, credential }) => {
			if (credential?.key) {
				return { auth: { apiKey: credential.key }, env: credential.env, source: "stored credential" };
			}
			for (const envVar of envVars) {
				const value = await ctx.env(envVar);
				if (value) return { auth: { apiKey: value }, source: envVar };
			}
			return undefined;
		},
	};
}

/**
 * Wraps a dynamically imported `OAuthAuth` so provider definitions can
 * advertise OAuth without importing the implementation. The flow loads on
 * first `login`/`refresh`/`toAuth` call; callers keep Node-only flow code out
 * of bundles by loading through a bundler-opaque dynamic import (variable
 * specifier, see the bedrock lazy wrapper).
 */
// 懒 OAuth 包装（公开）：让供应商可声明 OAuth 而不必静态导入实现；
// 首次 login/refresh/toAuth 时经打包器不透明的动态导入加载并缓存
export function lazyOAuth(input: { name: string; loginLabel?: string; load: () => Promise<OAuthAuth> }): OAuthAuth {
	let promise: Promise<OAuthAuth> | undefined;
	const loaded = () => {
		promise ??= input.load();
		return promise;
	};
	return {
		name: input.name,
		loginLabel: input.loginLabel,
		login: async (interaction) => (await loaded()).login(interaction),
		refresh: async (credential) => (await loaded()).refresh(credential),
		toAuth: async (credential) => (await loaded()).toAuth(credential),
	};
}
