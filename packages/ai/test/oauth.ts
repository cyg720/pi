/**
 * Test helper for resolving API keys from ~/.pi/agent/auth.json
 *
 * Supports both API key and OAuth credentials.
 * OAuth tokens are automatically refreshed if expired and saved back to auth.json.
 */
/**
 * 文件职责：为测试从用户 auth.json 读取 API 密钥或 OAuth 凭据，并在过期时刷新保存。
 * 技术维度：使用 Node 文件系统、联合类型、内置提供商 OAuth 适配器和严格文件权限。
 * 产品维度：让真实提供商测试复用 CLI 登录状态，减少重复配置密钥和手工刷新令牌。
 * 逻辑维度：安全加载认证表，按凭据类型直接返回密钥或刷新 OAuth 后转换为认证信息。
 * 关键边界：会读取并可能改写用户 `~/.pi/agent/auth.json`；解析或刷新失败时返回 undefined。
 * 新手阅读建议：先看四个认证类型，再读加载/保存函数，最后跟随 resolveApiKey 的类型分支。
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import type { OAuthCredentials } from "../src/auth/types.ts";
import { builtinProviders } from "../src/providers/all.ts";

// AUTH_PATH 是用户代理认证文件的固定位置。
const AUTH_PATH = join(homedir(), ".pi", "agent", "auth.json");

/** 描述直接保存的 API 密钥凭据。 */
type ApiKeyCredential = {
	// type 是用于联合类型判别的固定 api_key 标签。
	type: "api_key";
	// key 是提供商请求使用的原始 API 密钥。
	key: string;
};

/** 描述带 oauth 判别标签的完整 OAuth 凭据条目。 */
type OAuthCredentialEntry = {
	// type 是用于联合类型判别的固定 oauth 标签。
	type: "oauth";
} & OAuthCredentials;

/** 表示认证文件中允许出现的两种凭据。 */
type AuthCredential = ApiKeyCredential | OAuthCredentialEntry;

/** 表示以提供商标识为键的认证文件内容。 */
type AuthStorage = Record<string, AuthCredential>;

/**
 * 从磁盘加载认证表。
 * 参数：无。
 * 返回值：解析成功的 AuthStorage；文件缺失或无效时返回空对象。
 * 使用示例：`const storage = loadAuthStorage()`。
 */
function loadAuthStorage(): AuthStorage {
	if (!existsSync(AUTH_PATH)) {
		return {};
	}
	try {
		// content 是认证文件的 UTF-8 JSON 文本。
		const content = readFileSync(AUTH_PATH, "utf-8");
		return JSON.parse(content);
	} catch {
		return {};
	}
}

/**
 * 以仅限用户访问的权限保存认证表。
 * 参数：storage 为完整提供商认证映射。
 * 返回值：无。
 * 使用示例：OAuth 刷新后调用 `saveAuthStorage(storage)`。
 */
function saveAuthStorage(storage: AuthStorage): void {
	// configDir 是 auth.json 所在目录，不存在时以 0700 权限创建。
	const configDir = dirname(AUTH_PATH);
	if (!existsSync(configDir)) {
		mkdirSync(configDir, { recursive: true, mode: 0o700 });
	}
	writeFileSync(AUTH_PATH, JSON.stringify(storage, null, 2), "utf-8");
	chmodSync(AUTH_PATH, 0o600);
}

/**
 * Resolve API key for a provider from ~/.pi/agent/auth.json
 *
 * For API key credentials, returns the key directly.
 * For OAuth credentials, returns the access token (refreshing if expired and saving back).
 *
 */
/**
 * 从 auth.json 解析指定提供商的 API 密钥。
 * API key 凭据直接返回；OAuth 凭据过期时自动刷新并回写。
 * 参数：provider 为内置提供商标识。
 * 返回值：可用于请求的密钥，凭据不存在或刷新失败时为 undefined。
 * 使用示例：`await resolveApiKey("anthropic")`。
 */
export async function resolveApiKey(provider: string): Promise<string | undefined> {
	// storage 是当前磁盘认证表的内存副本。
	const storage = loadAuthStorage();
	// entry 是目标提供商的可选凭据条目。
	const entry = storage[provider];

	if (!entry) return undefined;

	if (entry.type === "api_key") {
		return entry.key;
	}

	if (entry.type === "oauth") {
		// oauth 是目标内置提供商声明的 OAuth 操作实现。
		const oauth = builtinProviders().find((candidate) => candidate.id === provider)?.auth.oauth;
		if (!oauth) return undefined;
		// credential 保存当前或刷新后的 OAuth 凭据。
		let credential = entry;
		try {
			if (Date.now() >= credential.expires) credential = await oauth.refresh(credential);
		} catch (error) {
			// error 是刷新过程中抛出的未知错误，仅记录后返回无密钥结果。
			console.log(JSON.stringify(error));
			return undefined;
		}
		storage[provider] = credential;
		saveAuthStorage(storage);
		return (await oauth.toAuth(credential)).apiKey;
	}

	return undefined;
}
