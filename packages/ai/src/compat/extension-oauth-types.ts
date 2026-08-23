import type { OAuthCredentials } from "../auth/types.ts";

/** Legacy extension OAuth prompt. */
export interface OAuthPrompt {
	message: string;
	placeholder?: string;
	allowEmpty?: boolean;
}

/** Legacy extension OAuth authorization link. */
/**
 * 【文件职责】扩展 OAuth 兼容类型：为 coding-agent 扩展提供 OAuth 相关的
 *              信息/凭据/设备码/登录回调/提示等类型。
 * 【技术维度】纯类型定义。
 * 【产品维度】是扩展与核心 OAuth 体系的类型契约。
 * 【新手阅读建议】按需查阅各类型字段即可。
 */
export interface OAuthAuthInfo {
	url: string;
	instructions?: string;
}

/** Legacy extension OAuth device-code notification. */
export interface OAuthDeviceCodeInfo {
	userCode: string;
	verificationUri: string;
	intervalSeconds?: number;
	expiresInSeconds?: number;
}

export interface OAuthSelectOption {
	id: string;
	label: string;
}

export interface OAuthSelectPrompt {
	message: string;
	options: OAuthSelectOption[];
}

/** Callback surface retained only for coding-agent extension compatibility. */
export interface OAuthLoginCallbacks {
	onAuth(info: OAuthAuthInfo): void;
	onDeviceCode(info: OAuthDeviceCodeInfo): void;
	onPrompt(prompt: OAuthPrompt): Promise<string>;
	onProgress?(message: string): void;
	onManualCodeInput?(): Promise<string>;
	onSelect(prompt: OAuthSelectPrompt): Promise<string | undefined>;
	signal?: AbortSignal;
}

export type { OAuthCredentials };
