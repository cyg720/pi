/**
 * 文件职责：验证登录提供商选项从注册表投影，并在 OAuth/API key 选择器中准确显示认证状态来源。
 * 技术维度：使用 Vitest、TUI OAuthSelectorComponent、InteractiveMode 原型和 ANSI 清理函数。
 * 产品维度：让用户看到完整可用登录方式，并区分订阅、环境变量、models.json 密钥或命令认证。
 * 逻辑维度：初始化主题/按键，首例模拟提供商注册表，其余五例渲染不同 status 并检查文本。
 * 关键边界：选项由提供商自身 auth 声明决定，不应硬编码过滤；undefined 状态必须显示未配置。
 * 新手阅读建议：先看 providers 与 apiKeyOptions 的映射，再逐个比较 selector status 对应文案。
 */
import { setKeybindings } from "@earendil-works/pi-tui";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { KeybindingsManager } from "../src/core/keybindings.ts";
import { OAuthSelectorComponent } from "../src/modes/interactive/components/oauth-selector.ts";
import { InteractiveMode } from "../src/modes/interactive/interactive-mode.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

describe("OAuthSelectorComponent", () => {
	// 功能：初始化深色测试主题；参数：无；返回：无。示例：套件开始前调用一次。
	beforeAll(() => {
		initTheme("dark");
	});

	// 功能：重置全局按键绑定；参数：无；返回：无。示例：每个用例前调用。
	beforeEach(() => {
		setKeybindings(new KeybindingsManager());
	});

	it("projects provider-owned auth options without provider-specific filtering", () => {
		// 从 InteractiveMode 原型提取并类型收窄的登录选项方法。
		const getLoginProviderOptions = (
			InteractiveMode as unknown as {
				prototype: {
					getLoginProviderOptions(
						this: object,
						authType?: "oauth" | "api_key",
					): Array<{ id: string; name: string; authType: string; method?: { name: string; login?: unknown } }>;
				};
			}
		).prototype.getLoginProviderOptions;
		// 模拟 Anthropic 和 Vertex 的提供商注册数据。
		const providers = [
			{
				id: "anthropic",
				name: "Anthropic",
				auth: {
					oauth: { name: "Anthropic (Claude Pro/Max)", login: async () => ({}) },
					apiKey: { name: "Anthropic API key", login: async () => ({}) },
				},
			},
			{
				id: "google-vertex",
				name: "Google Vertex AI",
				auth: { apiKey: { name: "Google Cloud credentials" } },
			},
		];
		// 方法调用所需的最小交互模式上下文。
		const fakeThis = {
			session: {
				modelRuntime: {
					getProviders: () => providers,
					getProviderAuthStatus: () => ({ configured: false }),
					isUsingOAuth: () => false,
				},
			},
		};

		// 过滤 authType=api_key 后的选项列表。
		const apiKeyOptions = getLoginProviderOptions.call(fakeThis, "api_key");
		expect(apiKeyOptions).toMatchObject([
			{
				id: "anthropic",
				name: "Anthropic",
				authType: "api_key",
				method: { name: "Anthropic API key" },
			},
			{
				id: "google-vertex",
				name: "Google Vertex AI",
				authType: "api_key",
				method: { name: "Google Cloud credentials" },
			},
		]);
		expect(getLoginProviderOptions.call(fakeThis, "oauth")).toMatchObject([
			{ id: "anthropic", name: "Anthropic", authType: "oauth" },
		]);
	});

	it("renders an option without compiled auth status as unconfigured", () => {
		// status 未定义的 Google API key 选择器。
		const selector = new OAuthSelectorComponent(
			"login",
			[{ id: "google", name: "Google", authType: "api_key", status: undefined }],
			() => {},
			() => {},
		);

		// 去除 ANSI 后的选择器文本。
		const output = stripAnsi(selector.render(120).join("\n"));
		expect(output).toContain("unconfigured");
		expect(output).not.toContain("✓ configured");
	});

	it("shows OAuth auth distinctly in the API key selector", () => {
		// API key 页面中实际由 OAuth 配置的 Anthropic 选项。
		const selector = new OAuthSelectorComponent(
			"login",
			[{ id: "anthropic", name: "Anthropic", authType: "api_key", status: { type: "oauth", source: "OAuth" } }],
			() => {},
			() => {},
		);

		// 去除 ANSI 后的订阅认证文本。
		const output = stripAnsi(selector.render(120).join("\n"));
		expect(output).toContain("subscription configured");
	});

	it("shows environment API key auth as configured", () => {
		// 由 OPENAI_API_KEY 环境变量配置的 OpenAI 选项。
		const selector = new OAuthSelectorComponent(
			"login",
			[{ id: "openai", name: "OpenAI", authType: "api_key", status: { type: "api_key", source: "OPENAI_API_KEY" } }],
			() => {},
			() => {},
		);

		// 去除 ANSI 后的环境认证文本。
		const output = stripAnsi(selector.render(120).join("\n"));
		expect(output).toContain("✓ env: OPENAI_API_KEY");
		expect(output).not.toContain("unconfigured");
	});

	it("shows models.json API key auth as configured", () => {
		// 由 models.json 直接密钥配置的本地代理选项。
		const selector = new OAuthSelectorComponent(
			"login",
			[
				{
					id: "local-proxy",
					name: "local-proxy",
					authType: "api_key",
					status: { type: "api_key", source: "key in models.json" },
				},
			],
			() => {},
			() => {},
		);

		expect(stripAnsi(selector.render(120).join("\n"))).toContain("✓ key in models.json");
	});

	it("shows models.json command auth as configured", () => {
		// 由 models.json 命令动态解析密钥的代理选项。
		const selector = new OAuthSelectorComponent(
			"login",
			[
				{
					id: "op-proxy",
					name: "op-proxy",
					authType: "api_key",
					status: { type: "api_key", source: "command in models.json" },
				},
			],
			() => {},
			() => {},
		);

		expect(stripAnsi(selector.render(120).join("\n"))).toContain("✓ command in models.json");
	});
});
