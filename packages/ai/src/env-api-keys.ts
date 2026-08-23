// NEVER convert to top-level imports - breaks browser/Vite builds
/**
 * 【文件职责】环境变量 API 密钥发现：为各供应商查找可用密钥环境变量、检测“环境凭据
 *              （ADC/AWS）”是否就绪，兼容浏览器构建（node 模块动态导入）。
 * 【技术维度】node:fs/os/path 的动态导入（避免浏览器打包问题）；供应商→环境变量映射表；
 *              默认凭据路径探测；结果缓存。
 * 【产品维度】支持零配置启动：用户只设一个 OPENAI_API_KEY 等变量即可使用对应供应商，
 *              Vertex/Bedrock 还能用 ADC/AWS 环境凭据免密钥。
 * 【逻辑维度】动态加载 node 模块 → hasVertexAdcCredentials 探测 → getApiKeyEnvVars 查表 →
 *              findEnvKeys 过滤已配置项 → getEnvApiKey 综合判断（含环境凭据标记）。
 * 【关键边界】ANTHROPIC_AUTH_TOKEN 参与发现但不作为 apiKey（需走 Bearer 头）；
 *              Vertex 需"凭据+项目+区域"三者齐备才返回 "<authenticated>"；
 *              browser 下 fs 永不可用会缓存 false。
 * 【新手阅读建议】先看 getApiKeyEnvVars 映射表 → 再看 findEnvKeys/getEnvApiKey 主流程 →
 *              最后看两个环境凭据特判分支。
 */
// node:fs 的 existsSync 动态引用（浏览器下为 null）
let _existsSync: typeof import("node:fs").existsSync | null = null;
let _homedir: typeof import("node:os").homedir | null = null;
// node:os 的 homedir 动态引用
let _join: typeof import("node:path").join | null = null;
// node:path 的 join 动态引用

type DynamicImport = (specifier: string) => Promise<unknown>;

// 动态导入函数（规避静态导入的浏览器打包问题）
const dynamicImport: DynamicImport = (specifier) => import(specifier);
// node:fs 说明符（拼接以避免某些打包器的静态分析误判）
const NODE_FS_SPECIFIER = "node:" + "fs";
const NODE_OS_SPECIFIER = "node:" + "os";
// node:os 说明符
const NODE_PATH_SPECIFIER = "node:" + "path";
// node:path 说明符

// 仅在 Node/Bun 环境下预先加载这些 node 模块
// Eagerly load in Node.js/Bun environment only
if (typeof process !== "undefined" && (process.versions?.node || process.versions?.bun)) {
	dynamicImport(NODE_FS_SPECIFIER).then((m) => {
		_existsSync = (m as typeof import("node:fs")).existsSync;
	});
	dynamicImport(NODE_OS_SPECIFIER).then((m) => {
		_homedir = (m as typeof import("node:os")).homedir;
	});
	dynamicImport(NODE_PATH_SPECIFIER).then((m) => {
		_join = (m as typeof import("node:path")).join;
	});
}

import type { KnownProvider, ProviderEnv } from "./types.ts";
import { getProviderEnvValue } from "./utils/provider-env.ts";

// Anthropic OAuth Bearer 令牌环境变量
export const ANTHROPIC_AUTH_TOKEN_ENV = "ANTHROPIC_AUTH_TOKEN";
export const ANTHROPIC_OAUTH_TOKEN_ENV = "ANTHROPIC_OAUTH_TOKEN";
// Anthropic OAuth 令牌环境变量
export const ANTHROPIC_API_KEY_ENV = "ANTHROPIC_API_KEY";
// Anthropic API 密钥环境变量

// Vertex ADC 凭据存在性缓存；null 表示未探测
let cachedVertexAdcCredentialsExists: boolean | null = null;

// 探测 Vertex ADC 凭据（私有）：显式凭据路径 → 默认路径 ~/.config/gcloud/
// application_default_credentials.json；node 模块未就绪时按环境决定是否缓存
function hasVertexAdcCredentials(env?: ProviderEnv): boolean {
	const explicitCredentialsPath = env?.GOOGLE_APPLICATION_CREDENTIALS;
	if (explicitCredentialsPath) {
		return _existsSync ? _existsSync(explicitCredentialsPath) : false;
	}

	if (cachedVertexAdcCredentialsExists === null) {
		// If node modules haven't loaded yet (async import race at startup),
		// node 模块尚未就绪（启动期异步导入竞态）：不缓存并返回 false，
		// 下次就绪后重试；浏览器环境才永久缓存 false
		// return false WITHOUT caching so the next call retries once they're ready.
		// Only cache false permanently in a browser environment where fs is never available.
		if (!_existsSync || !_homedir || !_join) {
			const isNode = typeof process !== "undefined" && (process.versions?.node || process.versions?.bun);
			if (!isNode) {
				// Definitively in a browser — safe to cache false permanently
				cachedVertexAdcCredentialsExists = false;
			}
			return false;
		}

		// Check GOOGLE_APPLICATION_CREDENTIALS env var first (standard way)
		// 优先检查标准环境变量 GOOGLE_APPLICATION_CREDENTIALS
		const gacPath = getProviderEnvValue("GOOGLE_APPLICATION_CREDENTIALS", env);
		if (gacPath) {
			cachedVertexAdcCredentialsExists = _existsSync(gacPath);
		} else {
			// Fall back to default ADC path (lazy evaluation)
		// 回退到默认 ADC 路径（懒求值）
			cachedVertexAdcCredentialsExists = _existsSync(
				_join(_homedir(), ".config", "gcloud", "application_default_credentials.json"),
			);
		}
	}
	return cachedVertexAdcCredentialsExists;
}

// 供应商 → 密钥环境变量名列表（私有）：未知供应商返回 undefined
function getApiKeyEnvVars(provider: string): readonly string[] | undefined {
	if (provider === "github-copilot") {
		return ["COPILOT_GITHUB_TOKEN"];
	}

	// ANTHROPIC_AUTH_TOKEN 参与发现/状态显示，但 getEnvApiKey 会跳过它：
	// 请求必须把它作为 Authorization: Bearer 传递
	// ANTHROPIC_AUTH_TOKEN participates in env discovery/status, but
	// getEnvApiKey() skips it because requests must pass it as Authorization: Bearer.
	if (provider === "anthropic") {
		return [ANTHROPIC_AUTH_TOKEN_ENV, ANTHROPIC_OAUTH_TOKEN_ENV, ANTHROPIC_API_KEY_ENV];
	}

	const envMap: Record<string, string> = {
		"ant-ling": "ANT_LING_API_KEY",
		"qwen-token-plan": "QWEN_TOKEN_PLAN_API_KEY",
		"qwen-token-plan-cn": "QWEN_TOKEN_PLAN_CN_API_KEY",
		openai: "OPENAI_API_KEY",
		"azure-openai-responses": "AZURE_OPENAI_API_KEY",
		nvidia: "NVIDIA_API_KEY",
		deepseek: "DEEPSEEK_API_KEY",
		google: "GEMINI_API_KEY",
		"google-vertex": "GOOGLE_CLOUD_API_KEY",
		groq: "GROQ_API_KEY",
		cerebras: "CEREBRAS_API_KEY",
		xai: "XAI_API_KEY",
		radius: "RADIUS_API_KEY",
		openrouter: "OPENROUTER_API_KEY",
		"vercel-ai-gateway": "AI_GATEWAY_API_KEY",
		zai: "ZAI_API_KEY",
		"zai-coding-cn": "ZAI_CODING_CN_API_KEY",
		mistral: "MISTRAL_API_KEY",
		minimax: "MINIMAX_API_KEY",
		"minimax-cn": "MINIMAX_CN_API_KEY",
		moonshotai: "MOONSHOT_API_KEY",
		"moonshotai-cn": "MOONSHOT_API_KEY",
		huggingface: "HF_TOKEN",
		fireworks: "FIREWORKS_API_KEY",
		together: "TOGETHER_API_KEY",
		opencode: "OPENCODE_API_KEY",
		"opencode-go": "OPENCODE_API_KEY",
		"kimi-coding": "KIMI_API_KEY",
		"cloudflare-workers-ai": "CLOUDFLARE_API_KEY",
		"cloudflare-ai-gateway": "CLOUDFLARE_API_KEY",
		xiaomi: "XIAOMI_API_KEY",
		"xiaomi-token-plan-cn": "XIAOMI_TOKEN_PLAN_CN_API_KEY",
		"xiaomi-token-plan-ams": "XIAOMI_TOKEN_PLAN_AMS_API_KEY",
		"xiaomi-token-plan-sgp": "XIAOMI_TOKEN_PLAN_SGP_API_KEY",
	};

	const envVar = envMap[provider];
	return envVar ? [envVar] : undefined;
}

/**
 * Find configured environment variables that can provide an API key for a provider.
 *
 * This only reports actual API key variables. It intentionally excludes ambient
 * credential sources such as AWS profiles, AWS IAM credentials, and Google
 * Application Default Credentials.
 */
// 重载：已知供应商
export function findEnvKeys(provider: KnownProvider, env?: ProviderEnv): string[] | undefined;
// 重载：任意供应商字符串
export function findEnvKeys(provider: string, env?: ProviderEnv): string[] | undefined;
// 找出已配置的密钥环境变量（公开）：过滤出在 env/process.env 中存在的项；
// 故意排除 AWS 配置文件/角色、Google ADC 等环境凭据来源
export function findEnvKeys(provider: string, env?: ProviderEnv): string[] | undefined {
	const envVars = getApiKeyEnvVars(provider);
	if (!envVars) return undefined;

	const found = envVars.filter((envVar) => !!getProviderEnvValue(envVar, env));
	return found.length > 0 ? found : undefined;
}

/**
 * Get API key for provider from known environment variables, e.g. OPENAI_API_KEY.
 *
 * Will not return API keys for providers that require OAuth tokens.
 */
// 重载：已知供应商
export function getEnvApiKey(provider: KnownProvider, env?: ProviderEnv): string | undefined;
// 重载：任意供应商字符串
export function getEnvApiKey(provider: string, env?: ProviderEnv): string | undefined;
// 获取供应商的环境密钥（公开）：Anthropic 跳过 AUTH_TOKEN；
// Vertex/Bedrock 检测到环境凭据时返回 "<authenticated>" 标记
export function getEnvApiKey(provider: string, env?: ProviderEnv): string | undefined {
	const envKeys = findEnvKeys(provider, env);
	if (envKeys?.[0]) {
		const apiKeyEnv = provider === "anthropic" ? envKeys.find((key) => key !== ANTHROPIC_AUTH_TOKEN_ENV) : envKeys[0];
		if (apiKeyEnv) return getProviderEnvValue(apiKeyEnv, env);
	}

	// Vertex AI supports either an explicit API key or Application Default Credentials.
	// Vertex AI 支持显式密钥或 ADC；认证经 gcloud auth application-default login 配置
	// Auth is configured via `gcloud auth application-default login`.
	if (provider === "google-vertex") {
		const hasCredentials = hasVertexAdcCredentials(env);
		const hasProject = !!(
			getProviderEnvValue("GOOGLE_CLOUD_PROJECT", env) || getProviderEnvValue("GCLOUD_PROJECT", env)
		);
		const hasLocation = !!getProviderEnvValue("GOOGLE_CLOUD_LOCATION", env);

		if (hasCredentials && hasProject && hasLocation) {
			return "<authenticated>";
		}
	}

	if (provider === "amazon-bedrock") {
		// Amazon Bedrock supports multiple credential sources:
	// Amazon Bedrock 支持多种凭据来源：AWS_PROFILE / IAM 密钥对 /
	// AWS_BEARER_TOKEN_BEDROCK / ECS 任务角色（相对/完整 URI）/ IRSA 身份令牌文件
		// 1. AWS_PROFILE - named profile from ~/.aws/credentials
		// 2. AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY - standard IAM keys
		// 3. AWS_BEARER_TOKEN_BEDROCK - Bedrock bearer token
		// 4. AWS_CONTAINER_CREDENTIALS_RELATIVE_URI - ECS task roles
		// 5. AWS_CONTAINER_CREDENTIALS_FULL_URI - ECS task roles (full URI)
		// 6. AWS_WEB_IDENTITY_TOKEN_FILE - IRSA (IAM Roles for Service Accounts)
		if (
			getProviderEnvValue("AWS_PROFILE", env) ||
			(getProviderEnvValue("AWS_ACCESS_KEY_ID", env) && getProviderEnvValue("AWS_SECRET_ACCESS_KEY", env)) ||
			getProviderEnvValue("AWS_BEARER_TOKEN_BEDROCK", env) ||
			getProviderEnvValue("AWS_CONTAINER_CREDENTIALS_RELATIVE_URI", env) ||
			getProviderEnvValue("AWS_CONTAINER_CREDENTIALS_FULL_URI", env) ||
			getProviderEnvValue("AWS_WEB_IDENTITY_TOKEN_FILE", env)
		) {
			return "<authenticated>";
		}
	}

	return undefined;
}
