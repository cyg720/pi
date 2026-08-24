/**
 * 文件职责：验证各供应商环境变量密钥的发现顺序与 API 密钥选择规则。
 * 技术维度：使用 Vitest 直接修改 process.env，并在每个用例后精确恢复原始环境状态。
 * 产品维度：避免把通用 GitHub 或 Anthropic 授权令牌误当 API 密钥，同时保持兼容的回退顺序。
 * 逻辑维度：先保存七个环境变量，再分别覆盖 Copilot、ZAI 与 Anthropic 的发现和选择场景。
 * 关键边界：测试修改进程全局环境；afterEach 必须区分“原值未定义”和“原值为空字符串”。
 * 新手阅读建议：先看顶部保存与恢复逻辑，再按每个供应商阅读环境变量优先级断言。
 */
import { afterEach, describe, expect, it } from "vitest";
import { findEnvKeys, getEnvApiKey } from "../src/env-api-keys.ts";

// 测试开始前的 Copilot 专用 GitHub 令牌，用于恢复环境。
const originalCopilotGitHubToken = process.env.COPILOT_GITHUB_TOKEN;
// 测试开始前的 GitHub CLI 通用令牌。
const originalGhToken = process.env.GH_TOKEN;
// 测试开始前的通用 GitHub 令牌。
const originalGitHubToken = process.env.GITHUB_TOKEN;
// 测试开始前的 ZAI 中国 Coding Plan 密钥。
const originalZaiCodingCnApiKey = process.env.ZAI_CODING_CN_API_KEY;
// 测试开始前的 Anthropic 授权令牌；它可被发现但不可作为 API key 返回。
const originalAnthropicAuthToken = process.env.ANTHROPIC_AUTH_TOKEN;
// 测试开始前的 Anthropic OAuth 令牌。
const originalAnthropicOauthToken = process.env.ANTHROPIC_OAUTH_TOKEN;
// 测试开始前的 Anthropic 标准 API 密钥。
const originalAnthropicApiKey = process.env.ANTHROPIC_API_KEY;

// 功能：逐项恢复七个环境变量；参数：无；返回：无。示例：Vitest 每个用例后自动调用。
afterEach(() => {
	if (originalCopilotGitHubToken === undefined) {
		delete process.env.COPILOT_GITHUB_TOKEN;
	} else {
		process.env.COPILOT_GITHUB_TOKEN = originalCopilotGitHubToken;
	}

	if (originalGhToken === undefined) {
		delete process.env.GH_TOKEN;
	} else {
		process.env.GH_TOKEN = originalGhToken;
	}

	if (originalGitHubToken === undefined) {
		delete process.env.GITHUB_TOKEN;
	} else {
		process.env.GITHUB_TOKEN = originalGitHubToken;
	}

	if (originalZaiCodingCnApiKey === undefined) {
		delete process.env.ZAI_CODING_CN_API_KEY;
	} else {
		process.env.ZAI_CODING_CN_API_KEY = originalZaiCodingCnApiKey;
	}

	if (originalAnthropicAuthToken === undefined) {
		delete process.env.ANTHROPIC_AUTH_TOKEN;
	} else {
		process.env.ANTHROPIC_AUTH_TOKEN = originalAnthropicAuthToken;
	}

	if (originalAnthropicOauthToken === undefined) {
		delete process.env.ANTHROPIC_OAUTH_TOKEN;
	} else {
		process.env.ANTHROPIC_OAUTH_TOKEN = originalAnthropicOauthToken;
	}

	if (originalAnthropicApiKey === undefined) {
		delete process.env.ANTHROPIC_API_KEY;
	} else {
		process.env.ANTHROPIC_API_KEY = originalAnthropicApiKey;
	}
});

describe("environment API keys", () => {
	it("does not treat generic GitHub tokens as GitHub Copilot credentials", () => {
		delete process.env.COPILOT_GITHUB_TOKEN;
		process.env.GH_TOKEN = "gh-token";
		process.env.GITHUB_TOKEN = "github-token";

		expect(findEnvKeys("github-copilot")).toBeUndefined();
		expect(getEnvApiKey("github-copilot")).toBeUndefined();
	});

	it("resolves GitHub Copilot credentials from COPILOT_GITHUB_TOKEN", () => {
		process.env.COPILOT_GITHUB_TOKEN = "copilot-token";
		process.env.GH_TOKEN = "gh-token";
		process.env.GITHUB_TOKEN = "github-token";

		expect(findEnvKeys("github-copilot")).toEqual(["COPILOT_GITHUB_TOKEN"]);
		expect(getEnvApiKey("github-copilot")).toBe("copilot-token");
	});

	it("resolves ZAI China Coding Plan credentials from ZAI_CODING_CN_API_KEY", () => {
		process.env.ZAI_CODING_CN_API_KEY = "zai-coding-cn-token";

		expect(findEnvKeys("zai-coding-cn")).toEqual(["ZAI_CODING_CN_API_KEY"]);
		expect(getEnvApiKey("zai-coding-cn")).toBe("zai-coding-cn-token");
	});

	it("reports ANTHROPIC_AUTH_TOKEN but preserves OAuth token API key lookup", () => {
		process.env.ANTHROPIC_AUTH_TOKEN = "auth-token";
		process.env.ANTHROPIC_OAUTH_TOKEN = "oauth-token";
		process.env.ANTHROPIC_API_KEY = "api-key";

		expect(findEnvKeys("anthropic")).toEqual(["ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_OAUTH_TOKEN", "ANTHROPIC_API_KEY"]);
		expect(getEnvApiKey("anthropic")).toBe("oauth-token");
	});

	it("does not return ANTHROPIC_AUTH_TOKEN as an API key", () => {
		process.env.ANTHROPIC_AUTH_TOKEN = "auth-token";
		delete process.env.ANTHROPIC_OAUTH_TOKEN;
		delete process.env.ANTHROPIC_API_KEY;

		expect(findEnvKeys("anthropic")).toEqual(["ANTHROPIC_AUTH_TOKEN"]);
		expect(getEnvApiKey("anthropic")).toBeUndefined();
	});

	it("preserves ANTHROPIC_OAUTH_TOKEN as an API key", () => {
		delete process.env.ANTHROPIC_AUTH_TOKEN;
		process.env.ANTHROPIC_OAUTH_TOKEN = "oauth-token";
		delete process.env.ANTHROPIC_API_KEY;

		expect(findEnvKeys("anthropic")).toEqual(["ANTHROPIC_OAUTH_TOKEN"]);
		expect(getEnvApiKey("anthropic")).toBe("oauth-token");
	});

	it("falls back to ANTHROPIC_API_KEY for API key lookup", () => {
		delete process.env.ANTHROPIC_AUTH_TOKEN;
		delete process.env.ANTHROPIC_OAUTH_TOKEN;
		process.env.ANTHROPIC_API_KEY = "api-key";

		expect(getEnvApiKey("anthropic")).toBe("api-key");
	});
});
