/**
 * 【文件职责】OAuth 兼容类型入口（仅类型）：为 coding-agent 扩展的 OAuth 声明提供再导出。
 * 【技术维度】纯类型再导出（export type），无运行时逻辑。
 * 【产品维度】让扩展作者从单一入口引用 OAuth 相关类型，无需关心内部目录。
 * 【逻辑维度】从 compat/extension-oauth-types.ts 转发全部 OAuth 类型。
 * 【关键边界】仅作类型兼容存在；具体实现见 auth/ 目录各模块。
 * 【新手阅读建议】半分钟读完：记住这里只导类型、无逻辑即可。
 */
/** Type-only compatibility entry point for coding-agent extension OAuth declarations. */
// 仅类型的兼容入口：为 coding-agent 扩展 OAuth 声明提供统一出口
export type {
	OAuthAuthInfo,
	OAuthCredentials,
	OAuthDeviceCodeInfo,
	OAuthLoginCallbacks,
	OAuthPrompt,
	OAuthSelectOption,
	OAuthSelectPrompt,
} from "./compat/extension-oauth-types.ts";
