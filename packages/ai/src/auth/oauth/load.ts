import type { OAuthAuth } from "../types.ts";

/**
 * Loads an OAuth flow module through a variable specifier so bundlers cannot
 * follow the import into Node-only flow code (`node:http` callback servers,
 * `node:crypto` PKCE). The `.ts`/`.js` rewrite keeps the trick working from
 * both source and built output.
 */
/**
 * 【文件职责】OAuth 流程的懒加载注册表：通过变量说明符动态导入各供应商 OAuth 模块
 *              （避免打包器追踪进 Node 专属流程代码），并支持 Bun 二进制静态注册。
 * 【技术维度】变量说明符导入 + .ts/.js 重写；bundledLoaders 覆盖注册表。
 * 【产品维度】让供应商声明 OAuth 而不必把 Node 专属代码打进浏览器/独立包。
 * 【逻辑维度】importOAuthModule 动态导入 → registerBundledOAuthFlowLoaders 注册覆盖 →
 *              各 loadXxxOAuth 优先覆盖、否则动态导入。
 * 【关键边界】覆盖一旦注册即优先；radius 为工厂（需 name/gateway 参数）。
 * 【新手阅读建议】理解"覆盖优先 + 动态导入兜底"的双路径即可。
 */
// 用变量说明符动态导入 OAuth 模块（私有）：打包器无法静态跟踪进 Node 专属流程代码
const importOAuthModule = (specifier: string): Promise<unknown> => {
	const runtimeSpecifier = import.meta.url.endsWith(".js") ? specifier.replace(/\.ts$/, ".js") : specifier;
	return import(runtimeSpecifier);
};

// 静态注册的 OAuth 流程加载器类型（Bun 二进制用）
type OAuthFlowLoaders = {
	anthropic: () => OAuthAuth | Promise<OAuthAuth>;
	openaiCodex: () => OAuthAuth | Promise<OAuthAuth>;
	githubCopilot: () => OAuthAuth | Promise<OAuthAuth>;
	openrouter: () => OAuthAuth | Promise<OAuthAuth>;
	kimiCoding: () => OAuthAuth | Promise<OAuthAuth>;
	xai: () => OAuthAuth | Promise<OAuthAuth>;
	radius: (options: { name: string; gateway: string }) => OAuthAuth | Promise<OAuthAuth>;
};

// 静态注册的加载器集合（undefined 表示未注册）
let bundledLoaders: OAuthFlowLoaders | undefined;

/** Registers statically bundled OAuth flows for standalone Bun binaries. */
// 注册静态打包的 OAuth 流程（公开）：供 Bun 独立二进制构建调用
export function registerBundledOAuthFlowLoaders(loaders: OAuthFlowLoaders): void {
	bundledLoaders = loaders;
}

// 加载 Anthropic OAuth（公开）：覆盖优先，否则动态导入
export const loadAnthropicOAuth = async (): Promise<OAuthAuth> => {
	if (bundledLoaders) return bundledLoaders.anthropic();
	return ((await importOAuthModule("./anthropic.ts")) as { anthropicOAuth: OAuthAuth }).anthropicOAuth;
};

// 加载 OpenAI Codex OAuth（公开）
export const loadOpenAICodexOAuth = async (): Promise<OAuthAuth> => {
	if (bundledLoaders) return bundledLoaders.openaiCodex();
	return ((await importOAuthModule("./openai-codex.ts")) as { openaiCodexOAuth: OAuthAuth }).openaiCodexOAuth;
};

// 加载 GitHub Copilot OAuth（公开）
export const loadGitHubCopilotOAuth = async (): Promise<OAuthAuth> => {
	if (bundledLoaders) return bundledLoaders.githubCopilot();
	return ((await importOAuthModule("./github-copilot.ts")) as { githubCopilotOAuth: OAuthAuth }).githubCopilotOAuth;
};

// 加载 OpenRouter OAuth（公开）
export const loadOpenRouterOAuth = async (): Promise<OAuthAuth> => {
	if (bundledLoaders) return bundledLoaders.openrouter();
	return ((await importOAuthModule("./openrouter.ts")) as { openRouterOAuth: OAuthAuth }).openRouterOAuth;
};

// 加载 Kimi Coding OAuth（公开）
export const loadKimiCodingOAuth = async (): Promise<OAuthAuth> => {
	if (bundledLoaders) return bundledLoaders.kimiCoding();
	return ((await importOAuthModule("./kimi-coding.ts")) as { kimiCodingOAuth: OAuthAuth }).kimiCodingOAuth;
};

// 加载 xAI OAuth（公开）
export const loadXaiOAuth = async (): Promise<OAuthAuth> => {
	if (bundledLoaders) return bundledLoaders.xai();
	return ((await importOAuthModule("./xai.ts")) as { xaiOAuth: OAuthAuth }).xaiOAuth;
};

// 加载 Radius OAuth（公开）：工厂形式，需 name/gateway 参数
export const loadRadiusOAuth = async (options: { name: string; gateway: string }): Promise<OAuthAuth> => {
	if (bundledLoaders) return bundledLoaders.radius(options);
	return (
		(await importOAuthModule("./radius.ts")) as {
			createRadiusOAuth: (input: { name: string; gateway: string }) => OAuthAuth;
		}
	).createRadiusOAuth(options);
};
