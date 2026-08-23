/**
 * 【文件职责】Bun 独立二进制的 OAuth 流程注册：把静态内嵌的 OAuth 实现（按供应商）
 *              注册到统一的加载器注册表，供独立 Bun 构建使用。
 * 【技术维度】registerBundledOAuthFlowLoaders 批量注册；惰性加载器（函数返回实现）。
 * 【产品维度】让单文件 Bun 可执行程序无需外部模块即可拥有完整 OAuth 登录能力。
 * 【逻辑维度】按供应商 ID 映射到各自 OAuth 实现 → 一次性注册。
 * 【关键边界】仅用于 Bun 二进制环境；radius 使用工厂（createRadiusOAuth）因其需要参数。
 * 【新手阅读建议】半分钟读完：理解它是"供应商 → OAuth 实现"的注册清单即可。
 */
import { anthropicOAuth } from "./auth/oauth/anthropic.ts";
import { githubCopilotOAuth } from "./auth/oauth/github-copilot.ts";
import { kimiCodingOAuth } from "./auth/oauth/kimi-coding.ts";
import { registerBundledOAuthFlowLoaders } from "./auth/oauth/load.ts";
import { openaiCodexOAuth } from "./auth/oauth/openai-codex.ts";
import { openRouterOAuth } from "./auth/oauth/openrouter.ts";
import { createRadiusOAuth } from "./auth/oauth/radius.ts";
import { xaiOAuth } from "./auth/oauth/xai.ts";

/** Register OAuth flows statically embedded in the standalone Bun binary. */
// 注册静态内嵌在 Bun 独立二进制中的 OAuth 流程（公开）
export function registerBunOAuthFlows(): void {
	registerBundledOAuthFlowLoaders({
		anthropic: () => anthropicOAuth,
		openaiCodex: () => openaiCodexOAuth,
		githubCopilot: () => githubCopilotOAuth,
		openrouter: () => openRouterOAuth,
		kimiCoding: () => kimiCodingOAuth,
		xai: () => xaiOAuth,
		radius: createRadiusOAuth,
	});
}
