/**
 * 文件职责：系统验证 ModelRegistry 对内置与自定义模型、供应商覆盖、动态注册、兼容配置和鉴权解析的组合行为。
 * 技术维度：使用 Vitest、临时文件系统、AuthStorage 和真实模型元数据，在隔离目录中生成 models.json 与 auth.json。
 * 产品维度：保证用户自定义代理地址、模型参数和凭据来源能可靠生效，并在刷新或扩展注册后保持一致。
 * 逻辑维度：先构造临时配置辅助函数，再覆盖 baseUrl 与模型合并、逐模型覆盖、动态供应商生命周期，最后测试 API Key 命令和环境变量解析。
 * 关键边界：部分鉴权测试会执行本地 shell 命令并修改临时环境变量；afterEach 必须删除临时目录、清缓存并恢复 mock。
 * 新手阅读建议：先读 providerConfig/writeRawModelsJson，再看覆盖合并规则；理解注册生命周期后，最后阅读 API key 优先级和请求时解析用例。
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
	AnthropicMessagesCompat,
	Api,
	Context,
	Model,
	OpenAICompletionsCompat,
} from "@earendil-works/pi-ai/compat";
import { getApiProvider, getSupportedThinkingLevels } from "@earendil-works/pi-ai/compat";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { clearApiKeyCache, type ModelRegistry, type ProviderConfigInput } from "../src/core/model-registry.ts";

import { createModelRegistry } from "./model-runtime-test-utils.ts";

// 用例分组：集中验证“ModelRegistry”相关功能。
describe("ModelRegistry", () => {
	/** 变量 tempDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let tempDir: string;
	/** 变量 modelsJsonPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let modelsJsonPath: string;
	/** 变量 authStorage 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let authStorage: AuthStorage;

	beforeEach(() => {
		tempDir = join(tmpdir(), `pi-test-model-registry-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		mkdirSync(tempDir, { recursive: true });
		modelsJsonPath = join(tempDir, "models.json");
		authStorage = AuthStorage.create(join(tempDir, "auth.json"));
	});

	afterEach(() => {
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true });
		}
		clearApiKeyCache();
		vi.restoreAllMocks();
	});

	/** Create minimal provider config  */
	// 中文说明：上方英文注释给出本段功能、前提或边界，下面代码按该说明执行。
	function providerConfig(
		baseUrl: string,
		models: Array<{ id: string; name?: string }>,
		api: string = "anthropic-messages",
	): ProviderConfigInput {
		return {
			baseUrl,
			apiKey: "test-key",
			api: api as Api,
			models: models.map((m) => ({
				id: m.id,
				name: m.name ?? m.id,
				reasoning: false,
				input: ["text"],
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				contextWindow: 100000,
				maxTokens: 8000,
			})),
		};
	}

	/** writeModelsJson 执行当前测试辅助步骤；参数 providers、ReturnType<typeof providerConfig>> 按签名提供输入，返回值供调用方断言。示例：writeModelsJson(..., ...)。 */
	function writeModelsJson(providers: Record<string, ReturnType<typeof providerConfig>>) {
		writeFileSync(modelsJsonPath, JSON.stringify({ providers }));
	}

	/** getModelsForProvider 执行当前测试辅助步骤；参数 registry、provider 按签名提供输入，返回值供调用方断言。示例：getModelsForProvider(..., ...)。 */
	function getModelsForProvider(registry: ModelRegistry, provider: string) {
		return registry.getAll().filter((m) => m.provider === provider);
	}

	/** toShPath 执行当前测试辅助步骤；参数 value 按签名提供输入，返回值供调用方断言。示例：toShPath(...)。 */
	function toShPath(value: string): string {
		return value.replace(/\\/g, "/").replace(/"/g, '\\"');
	}

	/** Create a baseUrl-only override (no custom models) */
	// 中文说明：上方英文注释给出本段功能、前提或边界，下面代码按该说明执行。
	function overrideConfig(baseUrl: string, headers?: Record<string, string>) {
		return { baseUrl, ...(headers && { headers }) };
	}

	/** Write raw providers config (for mixed override/replacement scenarios) */
	// 中文说明：上方英文注释给出本段功能、前提或边界，下面代码按该说明执行。
	function writeRawModelsJson(providers: Record<string, unknown>) {
		writeFileSync(modelsJsonPath, JSON.stringify({ providers }));
	}

	/** 常量 openAiModel 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const openAiModel: Model<Api> = {
		id: "test-openai-model",
		name: "Test OpenAI Model",
		api: "openai-completions",
		provider: "openai",
		baseUrl: "https://api.openai.com/v1",
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128000,
		maxTokens: 4096,
	};

	/** 常量 emptyContext 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const emptyContext: Context = {
		messages: [],
	};

	// 用例分组：集中验证“baseUrl override (no custom models)”相关功能。
	describe("baseUrl override (no custom models)", () => {
		// 测试场景：验证“overriding baseUrl keeps all built-in models”对应的行为、结果与边界。
		test("overriding baseUrl keeps all built-in models", async () => {
			writeRawModelsJson({
				anthropic: overrideConfig("https://my-proxy.example.com/v1"),
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 anthropicModels 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const anthropicModels = getModelsForProvider(registry, "anthropic");

			// Should have multiple built-in models, not just one
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(anthropicModels.length).toBeGreaterThan(1);
			expect(anthropicModels.some((m) => m.id.includes("claude"))).toBe(true);
		});

		// 测试场景：验证“overriding baseUrl changes URL on all built-in models”对应的行为、结果与边界。
		test("overriding baseUrl changes URL on all built-in models", async () => {
			writeRawModelsJson({
				anthropic: overrideConfig("https://my-proxy.example.com/v1"),
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 anthropicModels 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const anthropicModels = getModelsForProvider(registry, "anthropic");

			// All models should have the new baseUrl
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			for (const model of anthropicModels) {
				expect(model.baseUrl).toBe("https://my-proxy.example.com/v1");
			}
		});

		// 测试场景：验证“overriding headers resolves at request time”对应的行为、结果与边界。
		test("overriding headers resolves at request time", async () => {
			writeRawModelsJson({
				anthropic: overrideConfig("https://my-proxy.example.com/v1", {
					"X-Custom-Header": "custom-value",
				}),
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 anthropicModels 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const anthropicModels = getModelsForProvider(registry, "anthropic");

			/** 循环变量 model 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const model of anthropicModels) {
				/** 常量 auth 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const auth = await registry.getApiKeyAndHeaders(model);
				expect(auth.ok).toBe(true);
				if (auth.ok) {
					expect(auth.headers?.["X-Custom-Header"]).toBe("custom-value");
				}
			}
		});

		// 测试场景：验证“headers-only override resolves at request time”对应的行为、结果与边界。
		test("headers-only override resolves at request time", async () => {
			writeRawModelsJson({
				anthropic: {
					headers: {
						"X-Custom-Header": "custom-value",
					},
				},
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			expect(registry.getError()).toBeUndefined();
			/** 常量 anthropicModels 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const anthropicModels = getModelsForProvider(registry, "anthropic");

			/** 循环变量 model 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const model of anthropicModels) {
				/** 常量 auth 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const auth = await registry.getApiKeyAndHeaders(model);
				expect(auth.ok).toBe(true);
				if (auth.ok) {
					expect(auth.headers?.["X-Custom-Header"]).toBe("custom-value");
				}
			}
		});

		// 测试场景：验证“unconfigured compatibility auth includes static model headers”对应的行为、结果与边界。
		test("unconfigured compatibility auth includes static model headers", async () => {
			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 base 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const base = registry.getAll()[0];
			/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const model = {
				...base,
				provider: "missing-provider",
				headers: { "X-Static-Model": "static-value" },
			};

			/** 常量 auth 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const auth = await registry.getApiKeyAndHeaders(model);

			expect(auth).toEqual({ ok: true, headers: { "X-Static-Model": "static-value" } });
		});

		// 测试场景：验证“baseUrl-only override does not affect other providers”对应的行为、结果与边界。
		test("baseUrl-only override does not affect other providers", async () => {
			writeRawModelsJson({
				anthropic: overrideConfig("https://my-proxy.example.com/v1"),
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 googleModels 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const googleModels = getModelsForProvider(registry, "google");

			// Google models should still have their original baseUrl
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(googleModels.length).toBeGreaterThan(0);
			expect(googleModels[0].baseUrl).not.toBe("https://my-proxy.example.com/v1");
		});

		// 测试场景：验证“can mix baseUrl override and models merge”对应的行为、结果与边界。
		test("can mix baseUrl override and models merge", async () => {
			writeRawModelsJson({
				// baseUrl-only for anthropic
				// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
				anthropic: overrideConfig("https://anthropic-proxy.example.com/v1"),
				// Add custom model for google (merged with built-ins)
				// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
				google: providerConfig(
					"https://google-proxy.example.com/v1",
					[{ id: "gemini-custom" }],
					"google-generative-ai",
				),
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);

			// Anthropic: multiple built-in models with new baseUrl
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const anthropicModels = getModelsForProvider(registry, "anthropic");
			expect(anthropicModels.length).toBeGreaterThan(1);
			expect(anthropicModels[0].baseUrl).toBe("https://anthropic-proxy.example.com/v1");

			// Google: built-ins plus custom model
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const googleModels = getModelsForProvider(registry, "google");
			expect(googleModels.length).toBeGreaterThan(1);
			expect(googleModels.some((m) => m.id === "gemini-custom")).toBe(true);
		});

		// 测试场景：验证“refresh() picks up baseUrl override changes”对应的行为、结果与边界。
		test("refresh() picks up baseUrl override changes", async () => {
			writeRawModelsJson({
				anthropic: overrideConfig("https://first-proxy.example.com/v1"),
			});
			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);

			expect(getModelsForProvider(registry, "anthropic")[0].baseUrl).toBe("https://first-proxy.example.com/v1");

			// Update and refresh
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			writeRawModelsJson({
				anthropic: overrideConfig("https://second-proxy.example.com/v1"),
			});
			await registry.refresh();

			expect(getModelsForProvider(registry, "anthropic")[0].baseUrl).toBe("https://second-proxy.example.com/v1");
		});
	});

	// 用例分组：集中验证“custom models merge behavior”相关功能。
	describe("custom models merge behavior", () => {
		// 测试场景：验证“built-in provider custom models inherit api and baseUrl without explicit fields”对应的行为、结果与边界。
		test("built-in provider custom models inherit api and baseUrl without explicit fields", async () => {
			// Built-in providers already have api/baseUrl on every model, and auth
			// comes from env vars / auth storage. No need to specify them.
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			writeRawModelsJson({
				openrouter: {
					models: [
						{
							id: "fake-provider/fake-model",
							name: "Fake model",
							reasoning: true,
							input: ["text"],
						},
					],
				},
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			expect(registry.getError()).toBeUndefined();

			/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const model = registry.find("openrouter", "fake-provider/fake-model");
			expect(model).toBeDefined();
			expect(model?.api).toBe("openai-completions");
			expect(model?.baseUrl).toBe("https://openrouter.ai/api/v1");
		});

		// 测试场景：验证“non-built-in provider custom models still require baseUrl”对应的行为、结果与边界。
		test("non-built-in provider custom models still require baseUrl", async () => {
			writeRawModelsJson({
				"my-custom-provider": {
					apiKey: "test-key",
					models: [
						{
							id: "my-model",
							api: "openai-completions",
							reasoning: false,
							input: ["text"],
						},
					],
				},
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			expect(registry.getError()).toContain("baseUrl");
		});

		// 测试场景：验证“reports every provider composition error”对应的行为、结果与边界。
		test("reports every provider composition error", async () => {
			writeRawModelsJson({
				"broken-one": { api: "openai-completions", models: [{ id: "one" }] },
				"broken-two": { api: "openai-completions", models: [{ id: "two" }] },
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 error 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const error = registry.getError();

			expect(error).toContain('Provider "broken-one"');
			expect(error).toContain('Provider "broken-two"');
		});

		// 测试场景：验证“custom provider with same name as built-in merges with built-in models”对应的行为、结果与边界。
		test("custom provider with same name as built-in merges with built-in models", async () => {
			writeModelsJson({
				anthropic: providerConfig("https://my-proxy.example.com/v1", [{ id: "claude-custom" }]),
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 anthropicModels 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const anthropicModels = getModelsForProvider(registry, "anthropic");

			expect(anthropicModels.length).toBeGreaterThan(1);
			expect(anthropicModels.some((m) => m.id === "claude-custom")).toBe(true);
			expect(anthropicModels.some((m) => m.id.includes("claude"))).toBe(true);
		});

		// 测试场景：验证“custom model with same id replaces built-in model by id”对应的行为、结果与边界。
		test("custom model with same id replaces built-in model by id", async () => {
			writeModelsJson({
				openrouter: providerConfig(
					"https://my-proxy.example.com/v1",
					[{ id: "anthropic/claude-sonnet-4" }],
					"openai-completions",
				),
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 models 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const models = getModelsForProvider(registry, "openrouter");
			/** 常量 sonnetModels 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const sonnetModels = models.filter((m) => m.id === "anthropic/claude-sonnet-4");

			expect(sonnetModels).toHaveLength(1);
			expect(sonnetModels[0].baseUrl).toBe("https://my-proxy.example.com/v1");
		});

		// 测试场景：验证“custom provider with same name as built-in does not affect other built-in providers”对应的行为、结果与边界。
		test("custom provider with same name as built-in does not affect other built-in providers", async () => {
			writeModelsJson({
				anthropic: providerConfig("https://my-proxy.example.com/v1", [{ id: "claude-custom" }]),
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);

			expect(getModelsForProvider(registry, "google").length).toBeGreaterThan(0);
			expect(getModelsForProvider(registry, "openai").length).toBeGreaterThan(0);
		});

		// 测试场景：验证“provider-level baseUrl applies to both built-in and custom models”对应的行为、结果与边界。
		test("provider-level baseUrl applies to both built-in and custom models", async () => {
			writeModelsJson({
				anthropic: providerConfig("https://merged-proxy.example.com/v1", [{ id: "claude-custom" }]),
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 anthropicModels 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const anthropicModels = getModelsForProvider(registry, "anthropic");

			/** 循环变量 model 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const model of anthropicModels) {
				expect(model.baseUrl).toBe("https://merged-proxy.example.com/v1");
			}
		});

		// 测试场景：验证“provider-level compat applies to custom models”对应的行为、结果与边界。
		test("provider-level compat applies to custom models", async () => {
			writeRawModelsJson({
				demo: {
					baseUrl: "https://example.com/v1",
					apiKey: "DEMO_KEY",
					api: "openai-completions",
					compat: {
						supportsUsageInStreaming: false,
						maxTokensField: "max_tokens",
					},
					models: [
						{
							id: "demo-model",
							reasoning: false,
							input: ["text"],
							cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
							contextWindow: 1000,
							maxTokens: 100,
						},
					],
				},
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 compat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const compat = registry.find("demo", "demo-model")?.compat as OpenAICompletionsCompat | undefined;

			expect(compat?.supportsUsageInStreaming).toBe(false);
			expect(compat?.maxTokensField).toBe("max_tokens");
		});

		// 测试场景：验证“model-level compat overrides provider-level compat for custom models”对应的行为、结果与边界。
		test("model-level compat overrides provider-level compat for custom models", async () => {
			writeRawModelsJson({
				demo: {
					baseUrl: "https://example.com/v1",
					apiKey: "DEMO_KEY",
					api: "openai-completions",
					compat: {
						supportsUsageInStreaming: false,
						maxTokensField: "max_tokens",
					},
					models: [
						{
							id: "demo-model",
							reasoning: false,
							input: ["text"],
							cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
							contextWindow: 1000,
							maxTokens: 100,
							compat: {
								supportsUsageInStreaming: true,
								maxTokensField: "max_completion_tokens",
							},
						},
					],
				},
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 compat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const compat = registry.find("demo", "demo-model")?.compat as OpenAICompletionsCompat | undefined;

			expect(compat?.supportsUsageInStreaming).toBe(true);
			expect(compat?.maxTokensField).toBe("max_completion_tokens");
		});

		// 测试场景：验证“provider-level compat applies to built-in models”对应的行为、结果与边界。
		test("provider-level compat applies to built-in models", async () => {
			writeRawModelsJson({
				openrouter: {
					compat: {
						supportsUsageInStreaming: false,
						supportsStrictMode: false,
					},
				},
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 models 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const models = getModelsForProvider(registry, "openrouter");

			expect(models.length).toBeGreaterThan(0);
			/** 循环变量 model 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const model of models) {
				/** 常量 compat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const compat = model.compat as OpenAICompletionsCompat | undefined;
				expect(compat?.supportsUsageInStreaming).toBe(false);
				expect(compat?.supportsStrictMode).toBe(false);
			}
		});

		// 测试场景：验证“model schema accepts thinkingLevelMap and compat schema accepts supportsStrictMode and cacheControlFormat”对应的行为、结果与边界。
		test("model schema accepts thinkingLevelMap and compat schema accepts supportsStrictMode and cacheControlFormat", async () => {
			writeRawModelsJson({
				demo: {
					baseUrl: "https://example.com/v1",
					apiKey: "DEMO_KEY",
					api: "openai-completions",
					models: [
						{
							id: "demo-model",
							reasoning: true,
							input: ["text"],
							cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
							contextWindow: 1000,
							maxTokens: 100,
							thinkingLevelMap: {
								minimal: null,
								high: "max",
							},
							compat: {
								supportsStrictMode: false,
								cacheControlFormat: "anthropic",
							},
						},
					],
				},
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const model = registry.find("demo", "demo-model");
			/** 常量 compat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const compat = model?.compat as OpenAICompletionsCompat | undefined;

			expect(registry.getError()).toBeUndefined();
			expect(model?.thinkingLevelMap).toEqual({ minimal: null, high: "max" });
			expect(compat?.supportsStrictMode).toBe(false);
			expect(compat?.cacheControlFormat).toBe("anthropic");
		});

		// 测试场景：验证“compat schema accepts chat template thinking configuration”对应的行为、结果与边界。
		test("compat schema accepts chat template thinking configuration", async () => {
			writeRawModelsJson({
				demo: {
					baseUrl: "https://example.com/v1",
					apiKey: "DEMO_KEY",
					api: "openai-completions",
					models: [
						{
							id: "demo-model",
							reasoning: true,
							input: ["text"],
							cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
							contextWindow: 1000,
							maxTokens: 100,
							compat: {
								thinkingFormat: "chat-template",
								chatTemplateKwargs: {
									preserve_thinking: true,
									thinking: { $var: "thinking.enabled" },
								},
							},
						},
					],
				},
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 compat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const compat = registry.find("demo", "demo-model")?.compat as OpenAICompletionsCompat | undefined;

			expect(registry.getError()).toBeUndefined();
			expect(compat?.thinkingFormat).toBe("chat-template");
			expect(compat?.chatTemplateKwargs).toEqual({
				preserve_thinking: true,
				thinking: { $var: "thinking.enabled" },
			});
		});

		// 测试场景：验证“compat schema accepts Anthropic eager tool input streaming flag”对应的行为、结果与边界。
		test("compat schema accepts Anthropic eager tool input streaming flag", async () => {
			writeRawModelsJson({
				demo: {
					baseUrl: "https://example.com",
					apiKey: "DEMO_KEY",
					api: "anthropic-messages",
					compat: {
						supportsEagerToolInputStreaming: false,
					},
					models: [
						{
							id: "demo-model",
							reasoning: true,
							input: ["text"],
							cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
							contextWindow: 1000,
							maxTokens: 100,
						},
					],
				},
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 compat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const compat = registry.find("demo", "demo-model")?.compat as AnthropicMessagesCompat | undefined;

			expect(registry.getError()).toBeUndefined();
			expect(compat?.supportsEagerToolInputStreaming).toBe(false);
		});

		// 测试场景：验证“compat schema accepts long cache retention flag”对应的行为、结果与边界。
		test("compat schema accepts long cache retention flag", async () => {
			writeRawModelsJson({
				demo: {
					baseUrl: "https://example.com",
					apiKey: "DEMO_KEY",
					api: "anthropic-messages",
					compat: {
						supportsLongCacheRetention: false,
					},
					models: [
						{
							id: "demo-model",
							reasoning: true,
							input: ["text"],
							cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
							contextWindow: 1000,
							maxTokens: 100,
						},
					],
				},
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 compat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const compat = registry.find("demo", "demo-model")?.compat as AnthropicMessagesCompat | undefined;

			expect(registry.getError()).toBeUndefined();
			expect(compat?.supportsLongCacheRetention).toBe(false);
		});

		// 测试场景：验证“model-level baseUrl overrides provider-level baseUrl for custom models”对应的行为、结果与边界。
		test("model-level baseUrl overrides provider-level baseUrl for custom models", async () => {
			writeRawModelsJson({
				"opencode-go": {
					baseUrl: "https://opencode.ai/zen/go/v1",
					apiKey: "TEST_KEY",
					models: [
						{
							id: "minimax-m2.5",
							api: "anthropic-messages",
							baseUrl: "https://opencode.ai/zen/go",
							reasoning: true,
							input: ["text"],
							cost: { input: 0.3, output: 1.2, cacheRead: 0.03, cacheWrite: 0 },
							contextWindow: 204800,
							maxTokens: 131072,
						},
						{
							id: "glm-5",
							api: "openai-completions",
							reasoning: true,
							input: ["text"],
							cost: { input: 1, output: 3.2, cacheRead: 0.2, cacheWrite: 0 },
							contextWindow: 204800,
							maxTokens: 131072,
						},
					],
				},
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 m25 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const m25 = registry.find("opencode-go", "minimax-m2.5");
			/** 常量 glm5 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const glm5 = registry.find("opencode-go", "glm-5");

			expect(m25?.baseUrl).toBe("https://opencode.ai/zen/go");
			expect(glm5?.baseUrl).toBe("https://opencode.ai/zen/go/v1");
		});

		// 测试场景：验证“modelOverrides still apply when provider also defines models”对应的行为、结果与边界。
		test("modelOverrides still apply when provider also defines models", async () => {
			writeRawModelsJson({
				openrouter: {
					baseUrl: "https://my-proxy.example.com/v1",
					apiKey: "OPENROUTER_API_KEY",
					api: "openai-completions",
					models: [
						{
							id: "custom/openrouter-model",
							name: "Custom OpenRouter Model",
							reasoning: false,
							input: ["text"],
							cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
							contextWindow: 128000,
							maxTokens: 16384,
						},
					],
					modelOverrides: {
						"anthropic/claude-sonnet-4": {
							name: "Overridden Built-in Sonnet",
						},
					},
				},
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 models 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const models = getModelsForProvider(registry, "openrouter");

			expect(models.some((m) => m.id === "custom/openrouter-model")).toBe(true);
			expect(
				models.some((m) => m.id === "anthropic/claude-sonnet-4" && m.name === "Overridden Built-in Sonnet"),
			).toBe(true);
		});

		// 测试场景：验证“refresh() reloads merged custom models from disk”对应的行为、结果与边界。
		test("refresh() reloads merged custom models from disk", async () => {
			writeModelsJson({
				anthropic: providerConfig("https://first-proxy.example.com/v1", [{ id: "claude-custom" }]),
			});
			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			expect(getModelsForProvider(registry, "anthropic").some((m) => m.id === "claude-custom")).toBe(true);

			// Update and refresh
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			writeModelsJson({
				anthropic: providerConfig("https://second-proxy.example.com/v1", [{ id: "claude-custom-2" }]),
			});
			await registry.refresh();

			/** 常量 anthropicModels 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const anthropicModels = getModelsForProvider(registry, "anthropic");
			expect(anthropicModels.some((m) => m.id === "claude-custom")).toBe(false);
			expect(anthropicModels.some((m) => m.id === "claude-custom-2")).toBe(true);
			expect(anthropicModels.some((m) => m.id.includes("claude"))).toBe(true);
		}, 60_000);

		// 测试场景：验证“removing custom models from models.json keeps built-in provider models”对应的行为、结果与边界。
		test("removing custom models from models.json keeps built-in provider models", async () => {
			writeModelsJson({
				anthropic: providerConfig("https://proxy.example.com/v1", [{ id: "claude-custom" }]),
			});
			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			expect(getModelsForProvider(registry, "anthropic").some((m) => m.id === "claude-custom")).toBe(true);

			// Remove custom models and refresh
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			writeModelsJson({});
			await registry.refresh();

			/** 常量 anthropicModels 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const anthropicModels = getModelsForProvider(registry, "anthropic");
			expect(anthropicModels.some((m) => m.id === "claude-custom")).toBe(false);
			expect(anthropicModels.some((m) => m.id.includes("claude"))).toBe(true);
		});
	});

	// 用例分组：集中验证“modelOverrides (per-model customization)”相关功能。
	describe("modelOverrides (per-model customization)", () => {
		// 测试场景：验证“model override applies to a single built-in model”对应的行为、结果与边界。
		test("model override applies to a single built-in model", async () => {
			writeRawModelsJson({
				openrouter: {
					modelOverrides: {
						"anthropic/claude-sonnet-4": {
							name: "Custom Sonnet Name",
						},
					},
				},
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 models 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const models = getModelsForProvider(registry, "openrouter");

			/** 常量 sonnet 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const sonnet = models.find((m) => m.id === "anthropic/claude-sonnet-4");
			expect(sonnet?.name).toBe("Custom Sonnet Name");

			// Other models should be unchanged
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const opus = models.find((m) => m.id === "anthropic/claude-opus-4");
			expect(opus?.name).not.toBe("Custom Sonnet Name");
		});

		// 测试场景：验证“model override with compat.openRouterRouting”对应的行为、结果与边界。
		test("model override with compat.openRouterRouting", async () => {
			writeRawModelsJson({
				openrouter: {
					modelOverrides: {
						"anthropic/claude-sonnet-4": {
							compat: {
								openRouterRouting: { only: ["amazon-bedrock"] },
							},
						},
					},
				},
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 models 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const models = getModelsForProvider(registry, "openrouter");

			/** 常量 sonnet 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const sonnet = models.find((m) => m.id === "anthropic/claude-sonnet-4");
			/** 常量 compat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const compat = sonnet?.compat as OpenAICompletionsCompat | undefined;
			expect(compat?.openRouterRouting).toEqual({ only: ["amazon-bedrock"] });
		});

		// 测试场景：验证“model override deep merges compat settings”对应的行为、结果与边界。
		test("model override deep merges compat settings", async () => {
			writeRawModelsJson({
				openrouter: {
					modelOverrides: {
						"anthropic/claude-sonnet-4": {
							compat: {
								openRouterRouting: { order: ["anthropic", "together"] },
							},
						},
					},
				},
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 models 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const models = getModelsForProvider(registry, "openrouter");
			/** 常量 sonnet 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const sonnet = models.find((m) => m.id === "anthropic/claude-sonnet-4");

			// Should have both the new routing AND preserve other compat settings
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const compat = sonnet?.compat as OpenAICompletionsCompat | undefined;
			expect(compat?.openRouterRouting).toEqual({ order: ["anthropic", "together"] });
		});

		// 测试场景：验证“multiple model overrides on same provider”对应的行为、结果与边界。
		test("multiple model overrides on same provider", async () => {
			writeRawModelsJson({
				openrouter: {
					modelOverrides: {
						"anthropic/claude-sonnet-4": {
							compat: { openRouterRouting: { only: ["amazon-bedrock"] } },
						},
						"anthropic/claude-opus-4": {
							compat: { openRouterRouting: { only: ["anthropic"] } },
						},
					},
				},
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 models 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const models = getModelsForProvider(registry, "openrouter");

			/** 常量 sonnet 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const sonnet = models.find((m) => m.id === "anthropic/claude-sonnet-4");
			/** 常量 opus 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const opus = models.find((m) => m.id === "anthropic/claude-opus-4");

			/** 常量 sonnetCompat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const sonnetCompat = sonnet?.compat as OpenAICompletionsCompat | undefined;
			/** 常量 opusCompat 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const opusCompat = opus?.compat as OpenAICompletionsCompat | undefined;
			expect(sonnetCompat?.openRouterRouting).toEqual({ only: ["amazon-bedrock"] });
			expect(opusCompat?.openRouterRouting).toEqual({ only: ["anthropic"] });
		});

		// 测试场景：验证“model override combined with baseUrl override”对应的行为、结果与边界。
		test("model override combined with baseUrl override", async () => {
			writeRawModelsJson({
				openrouter: {
					baseUrl: "https://my-proxy.example.com/v1",
					modelOverrides: {
						"anthropic/claude-sonnet-4": {
							name: "Proxied Sonnet",
						},
					},
				},
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 models 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const models = getModelsForProvider(registry, "openrouter");
			/** 常量 sonnet 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const sonnet = models.find((m) => m.id === "anthropic/claude-sonnet-4");

			// Both overrides should apply
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(sonnet?.baseUrl).toBe("https://my-proxy.example.com/v1");
			expect(sonnet?.name).toBe("Proxied Sonnet");

			// Other models should have the baseUrl but not the name override
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			const opus = models.find((m) => m.id === "anthropic/claude-opus-4");
			expect(opus?.baseUrl).toBe("https://my-proxy.example.com/v1");
			expect(opus?.name).not.toBe("Proxied Sonnet");
		});

		// 测试场景：验证“model override for non-existent model ID is ignored”对应的行为、结果与边界。
		test("model override for non-existent model ID is ignored", async () => {
			writeRawModelsJson({
				openrouter: {
					modelOverrides: {
						"nonexistent/model-id": {
							name: "This should not appear",
						},
					},
				},
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 models 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const models = getModelsForProvider(registry, "openrouter");

			// Should not create a new model
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(models.find((m) => m.id === "nonexistent/model-id")).toBeUndefined();
			// Should not crash or show error
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(registry.getError()).toBeUndefined();
		});

		// 测试场景：验证“model override can change cost fields partially”对应的行为、结果与边界。
		test("model override can change cost fields partially", async () => {
			writeRawModelsJson({
				openrouter: {
					modelOverrides: {
						"anthropic/claude-sonnet-4": {
							cost: { input: 99 },
						},
					},
				},
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 models 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const models = getModelsForProvider(registry, "openrouter");
			/** 常量 sonnet 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const sonnet = models.find((m) => m.id === "anthropic/claude-sonnet-4");

			// Input cost should be overridden
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(sonnet?.cost.input).toBe(99);
			// Other cost fields should be preserved from built-in
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			expect(sonnet?.cost.output).toBeGreaterThan(0);
		});

		// 测试场景：验证“model override can add headers at request time”对应的行为、结果与边界。
		test("model override can add headers at request time", async () => {
			writeRawModelsJson({
				openrouter: {
					modelOverrides: {
						"anthropic/claude-sonnet-4": {
							headers: { "X-Custom-Model-Header": "value" },
						},
					},
				},
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 models 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const models = getModelsForProvider(registry, "openrouter");
			/** 常量 sonnet 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const sonnet = models.find((m) => m.id === "anthropic/claude-sonnet-4");
			expect(sonnet).toBeDefined();

			/** 常量 auth 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const auth = await registry.getApiKeyAndHeaders(sonnet!);
			expect(auth.ok).toBe(true);
			if (auth.ok) {
				expect(auth.headers?.["X-Custom-Model-Header"]).toBe("value");
			}
		});

		// 测试场景：验证“refresh() picks up model override changes”对应的行为、结果与边界。
		test("refresh() picks up model override changes", async () => {
			writeRawModelsJson({
				openrouter: {
					modelOverrides: {
						"anthropic/claude-sonnet-4": {
							name: "First Name",
						},
					},
				},
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			expect(
				getModelsForProvider(registry, "openrouter").find((m) => m.id === "anthropic/claude-sonnet-4")?.name,
			).toBe("First Name");

			// Update and refresh
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			writeRawModelsJson({
				openrouter: {
					modelOverrides: {
						"anthropic/claude-sonnet-4": {
							name: "Second Name",
						},
					},
				},
			});
			await registry.refresh();

			expect(
				getModelsForProvider(registry, "openrouter").find((m) => m.id === "anthropic/claude-sonnet-4")?.name,
			).toBe("Second Name");
		});

		// 测试场景：验证“removing model override restores built-in values”对应的行为、结果与边界。
		test("removing model override restores built-in values", async () => {
			writeRawModelsJson({
				openrouter: {
					modelOverrides: {
						"anthropic/claude-sonnet-4": {
							name: "Custom Name",
						},
					},
				},
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 customName 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const customName = getModelsForProvider(registry, "openrouter").find(
				(m) => m.id === "anthropic/claude-sonnet-4",
			)?.name;
			expect(customName).toBe("Custom Name");

			// Remove override and refresh
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			writeRawModelsJson({});
			await registry.refresh();

			/** 常量 restoredName 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const restoredName = getModelsForProvider(registry, "openrouter").find(
				(m) => m.id === "anthropic/claude-sonnet-4",
			)?.name;
			expect(restoredName).not.toBe("Custom Name");
		});
	});

	// 用例分组：集中验证“dynamic provider lifecycle”相关功能。
	describe("dynamic provider lifecycle", () => {
		// 测试场景：验证“getProviderDisplayName resolves registered, OAuth, built-in, and fallback names”对应的行为、结果与边界。
		test("getProviderDisplayName resolves registered, OAuth, built-in, and fallback names", async () => {
			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);

			expect(registry.getProviderDisplayName("openai")).toBe("OpenAI");
			expect(registry.getProviderDisplayName("github-copilot")).toBe("GitHub Copilot");
			expect(registry.getProviderDisplayName("zai")).toBe("Z.AI");
			expect(registry.getProviderDisplayName("unknown-provider")).toBe("unknown-provider");

			registry.registerProvider("named-provider", {
				name: "Named Provider",
				baseUrl: "https://provider.test/v1",
				apiKey: "test-key",
				api: "openai-completions",
				models: [
					{
						id: "demo-model",
						name: "Demo Model",
						reasoning: false,
						input: ["text"],
						cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
						contextWindow: 128000,
						maxTokens: 4096,
					},
				],
			});
			expect(registry.getProviderDisplayName("named-provider")).toBe("Named Provider");

			registry.registerProvider("oauth-provider", {
				baseUrl: "https://provider.test/v1",
				api: "openai-completions",
				oauth: {
					name: "OAuth Provider",
					login: async () => ({ access: "access", refresh: "refresh", expires: Date.now() + 60_000 }),
					refreshToken: async (credentials) => credentials,
					getApiKey: (credentials) => credentials.access,
				},
				models: [
					{
						id: "demo-model",
						name: "Demo Model",
						reasoning: false,
						input: ["text"],
						cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
						contextWindow: 128000,
						maxTokens: 4096,
					},
				],
			});
			expect(registry.getProviderDisplayName("oauth-provider")).toBe("OAuth Provider");
		});

		// 测试场景：验证“modelOverrides apply to dynamically registered provider models”对应的行为、结果与边界。
		test("modelOverrides apply to dynamically registered provider models", async () => {
			writeRawModelsJson({
				"extension-provider": {
					modelOverrides: {
						"extension-model": {
							name: "Overridden Extension Model",
							thinkingLevelMap: {
								off: null,
								minimal: null,
								low: null,
								medium: null,
								xhigh: "max",
							},
							headers: { "x-model-override": "enabled" },
						},
					},
				},
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			registry.registerProvider("extension-provider", {
				baseUrl: "https://provider.test/v1",
				apiKey: "test-key",
				api: "openai-completions",
				models: [
					{
						id: "extension-model",
						name: "Extension Model",
						reasoning: true,
						input: ["text"],
						cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
						contextWindow: 128000,
						maxTokens: 4096,
					},
				],
			});

			/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const model = registry.find("extension-provider", "extension-model");
			expect(model).toBeDefined();
			if (!model) {
				throw new Error("extension model was not registered");
			}
			expect(model.name).toBe("Overridden Extension Model");
			expect(model.thinkingLevelMap).toEqual({
				off: null,
				minimal: null,
				low: null,
				medium: null,
				xhigh: "max",
			});
			expect(getSupportedThinkingLevels(model)).toEqual(["high", "xhigh"]);
			expect(await registry.getApiKeyAndHeaders(model)).toMatchObject({
				ok: true,
				headers: { "x-model-override": "enabled" },
			});
		});

		// 测试场景：验证“stored API key env propagates to request auth and resolves headers”对应的行为、结果与边界。
		test("stored API key env propagates to request auth and resolves headers", async () => {
			await authStorage.modify("cloudflare-ai-gateway", async () => ({
				type: "api_key",
				key: "$CLOUDFLARE_API_KEY",
				env: {
					CLOUDFLARE_API_KEY: "stored-cf-token",
					CLOUDFLARE_ACCOUNT_ID: "stored-account",
					CLOUDFLARE_GATEWAY_ID: "stored-gateway",
				},
			}));
			writeRawModelsJson({
				"cloudflare-ai-gateway": {
					headers: { "x-account": "$CLOUDFLARE_ACCOUNT_ID" },
				},
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const model = registry.getAll().find((m) => m.provider === "cloudflare-ai-gateway");
			expect(model).toBeDefined();

			/** 常量 auth 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const auth = await registry.getApiKeyAndHeaders(model!);

			expect(auth).toEqual({
				ok: true,
				apiKey: undefined,
				headers: {
					"cf-aig-authorization": "Bearer stored-cf-token",
					"x-account": "stored-account",
				},
				env: {
					CLOUDFLARE_ACCOUNT_ID: "stored-account",
					CLOUDFLARE_GATEWAY_ID: "stored-gateway",
				},
			});
		});

		// 测试场景：验证“registerProvider treats uppercase apiKey and headers as literals”对应的行为、结果与边界。
		test("registerProvider treats uppercase apiKey and headers as literals", async () => {
			/** 常量 envKeys 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const envKeys = ["CUSTOM_NAME", "BEARER", "MODEL_TOKEN"];
			/** 常量 savedEnv 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const savedEnv: Record<string, string | undefined> = {};
			/** 循环变量 key 表示当前遍历项或索引，仅在循环体内有效。 */
			for (const key of envKeys) {
				savedEnv[key] = process.env[key];
				process.env[key] = `env-${key}`;
			}
			/** 常量 warnSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			try {
				/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const registry = await createModelRegistry(authStorage, modelsJsonPath);

				registry.registerProvider("literal-provider", {
					...providerConfig("https://provider.test/v1", [{ id: "demo-model" }], "openai-completions"),
					apiKey: "CUSTOM_NAME",
					headers: { Authorization: "BEARER" },
					models: [
						{
							id: "demo-model",
							name: "demo-model",
							reasoning: false,
							input: ["text"],
							cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
							contextWindow: 100000,
							maxTokens: 8000,
							headers: { "x-model-token": "MODEL_TOKEN" },
						},
					],
				});

				expect(await registry.getApiKeyForProvider("literal-provider")).toBe("CUSTOM_NAME");
				/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const model = registry.find("literal-provider", "demo-model");
				expect(model).toBeDefined();
				expect(await registry.getApiKeyAndHeaders(model!)).toMatchObject({
					ok: true,
					apiKey: "CUSTOM_NAME",
					headers: {
						Authorization: "BEARER",
						"x-model-token": "MODEL_TOKEN",
					},
				});
				expect(warnSpy).not.toHaveBeenCalled();
			} finally {
				/** 循环变量 key 表示当前遍历项或索引，仅在循环体内有效。 */
				for (const key of envKeys) {
					if (savedEnv[key] === undefined) {
						delete process.env[key];
					} else {
						process.env[key] = savedEnv[key];
					}
				}
			}
		});

		// 测试场景：验证“failed registerProvider does not persist invalid streamSimple config”对应的行为、结果与边界。
		test("failed registerProvider does not persist invalid streamSimple config", async () => {
			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);

			expect(() =>
				registry.registerProvider("broken-provider", {
					streamSimple: (() => {
						throw new Error("should not run");
					}) as any,
				}),
			).toThrow('Provider broken-provider: "api" is required when registering streamSimple.');

			await expect(registry.refresh()).resolves.toBeUndefined();
		});

		// 测试场景：验证“failed registerProvider does not remove existing provider models”对应的行为、结果与边界。
		test("failed registerProvider does not remove existing provider models", async () => {
			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);

			registry.registerProvider("demo-provider", {
				baseUrl: "https://provider.test/v1",
				apiKey: "test-key",
				api: "openai-completions",
				models: [
					{
						id: "demo-model",
						name: "Demo Model",
						reasoning: false,
						input: ["text"],
						cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
						contextWindow: 128000,
						maxTokens: 4096,
					},
				],
			});

			expect(registry.find("demo-provider", "demo-model")).toBeDefined();

			expect(() =>
				registry.registerProvider("demo-provider", {
					baseUrl: "https://provider.test/v2",
					apiKey: "test-key",
					models: [
						{
							id: "broken-model",
							name: "Broken Model",
							reasoning: false,
							input: ["text"],
							cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
							contextWindow: 128000,
							maxTokens: 4096,
						},
					],
				}),
			).toThrow('Provider demo-provider, model broken-model: no "api" specified.');

			expect(registry.find("demo-provider", "demo-model")).toBeDefined();
			await expect(registry.refresh()).resolves.toBeUndefined();
			expect(registry.find("demo-provider", "demo-model")).toBeDefined();
		});

		// 测试场景：验证“unregisterProvider removes the runtime OAuth overlay without mutating global state”对应的行为、结果与边界。
		test("unregisterProvider removes the runtime OAuth overlay without mutating global state", async () => {
			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);

			registry.registerProvider("anthropic", {
				oauth: {
					name: "Custom Anthropic OAuth",
					login: async () => ({
						access: "custom-access-token",
						refresh: "custom-refresh-token",
						expires: Date.now() + 60_000,
					}),
					refreshToken: async (credentials) => credentials,
					getApiKey: (credentials) => credentials.access,
				},
			});

			expect(registry.getRegisteredProviderConfig("anthropic")?.oauth?.name).toBe("Custom Anthropic OAuth");

			registry.unregisterProvider("anthropic");

			expect(registry.getRegisteredProviderConfig("anthropic")).toBeUndefined();
		});

		// 测试场景：验证“streamSimple overlays do not mutate the global compat API registry”对应的行为、结果与边界。
		test("streamSimple overlays do not mutate the global compat API registry", async () => {
			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);

			registry.registerProvider("stream-override-provider", {
				api: "openai-completions",
				streamSimple: () => {
					throw new Error("custom streamSimple override");
				},
			});

			/** 变量 threwCustomOverride 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			let threwCustomOverride = false;
			try {
				getApiProvider("openai-completions")?.streamSimple(openAiModel, emptyContext);
			} catch (error) {
				// error 是自定义流覆盖主动抛出的异常，用于确认覆盖仍生效。
				threwCustomOverride = error instanceof Error && error.message === "custom streamSimple override";
			}
			expect(threwCustomOverride).toBe(false);

			registry.unregisterProvider("stream-override-provider");

			/** 变量 threwCustomOverrideAfterUnregister 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			let threwCustomOverrideAfterUnregister = false;
			try {
				getApiProvider("openai-completions")?.streamSimple(openAiModel, emptyContext);
			} catch (error) {
				// error 是注销注册表后再次调用自定义覆盖时捕获的异常。
				threwCustomOverrideAfterUnregister =
					error instanceof Error && error.message === "custom streamSimple override";
			}
			expect(threwCustomOverrideAfterUnregister).toBe(false);
		});

		// 用例分组：集中验证“dynamic provider override persistence”相关功能。
		describe("dynamic provider override persistence", () => {
			// 测试场景：验证“baseUrl-only override keeps built-in provider models after refresh”对应的行为、结果与边界。
			test("baseUrl-only override keeps built-in provider models after refresh", async () => {
				/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const registry = await createModelRegistry(authStorage, modelsJsonPath);

				registry.registerProvider("anthropic", { baseUrl: "https://proxy.test/anthropic" });
				await registry.refresh();

				/** 常量 anthropicModels 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const anthropicModels = getModelsForProvider(registry, "anthropic");
				expect(anthropicModels.length).toBeGreaterThan(1);
				expect(anthropicModels.every((m) => m.baseUrl === "https://proxy.test/anthropic")).toBe(true);
			});

			// 测试场景：验证“models-only override replaces built-in provider models after refresh”对应的行为、结果与边界。
			test("models-only override replaces built-in provider models after refresh", async () => {
				/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const registry = await createModelRegistry(authStorage, modelsJsonPath);

				registry.registerProvider("anthropic", {
					...providerConfig("https://custom.test/anthropic", [{ id: "custom-claude" }], "anthropic-messages"),
					baseUrl: "https://custom.test/anthropic",
				});
				await registry.refresh();

				expect(getModelsForProvider(registry, "anthropic").map((m) => m.id)).toEqual(["custom-claude"]);
				expect(registry.find("anthropic", "custom-claude")?.baseUrl).toBe("https://custom.test/anthropic");
			});

			// 测试场景：验证“models plus baseUrl override replaces built-in provider models after refresh”对应的行为、结果与边界。
			test("models plus baseUrl override replaces built-in provider models after refresh", async () => {
				/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const registry = await createModelRegistry(authStorage, modelsJsonPath);

				registry.registerProvider("anthropic", {
					...providerConfig("https://custom.test/anthropic", [{ id: "custom-claude" }], "anthropic-messages"),
					baseUrl: "https://custom.test/anthropic",
				});
				registry.registerProvider("anthropic", { baseUrl: "https://proxy.test/anthropic" });
				await registry.refresh();

				expect(getModelsForProvider(registry, "anthropic").map((m) => m.id)).toEqual(["custom-claude"]);
				expect(registry.find("anthropic", "custom-claude")?.baseUrl).toBe("https://proxy.test/anthropic");
			});

			// 测试场景：验证“models-only custom provider registration survives refresh”对应的行为、结果与边界。
			test("models-only custom provider registration survives refresh", async () => {
				/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const registry = await createModelRegistry(authStorage, modelsJsonPath);

				registry.registerProvider(
					"custom-provider",
					providerConfig("https://custom.test/v1", [{ id: "custom-a" }, { id: "custom-b" }], "openai-completions"),
				);
				await registry.refresh();

				expect(getModelsForProvider(registry, "custom-provider").map((m) => m.id)).toEqual([
					"custom-a",
					"custom-b",
				]);
			});

			// 测试场景：验证“baseUrl-only override keeps custom provider models after refresh”对应的行为、结果与边界。
			test("baseUrl-only override keeps custom provider models after refresh", async () => {
				/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const registry = await createModelRegistry(authStorage, modelsJsonPath);

				registry.registerProvider(
					"custom-provider",
					providerConfig("https://custom.test/v1", [{ id: "custom-a" }, { id: "custom-b" }], "openai-completions"),
				);
				registry.registerProvider("custom-provider", { baseUrl: "https://proxy.test/custom" });
				await registry.refresh();

				expect(getModelsForProvider(registry, "custom-provider").map((m) => m.id)).toEqual([
					"custom-a",
					"custom-b",
				]);
				expect(
					getModelsForProvider(registry, "custom-provider").every(
						(m) => m.baseUrl === "https://proxy.test/custom",
					),
				).toBe(true);
			});

			// 测试场景：验证“headers-only override keeps custom provider models after refresh”对应的行为、结果与边界。
			test("headers-only override keeps custom provider models after refresh", async () => {
				/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const registry = await createModelRegistry(authStorage, modelsJsonPath);

				registry.registerProvider(
					"custom-provider",
					providerConfig("https://custom.test/v1", [{ id: "custom-a" }, { id: "custom-b" }], "openai-completions"),
				);
				registry.registerProvider("custom-provider", { headers: { "x-proxy": "enabled" } });
				await registry.refresh();

				/** 常量 models 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const models = getModelsForProvider(registry, "custom-provider");
				expect(models.map((m) => m.id)).toEqual(["custom-a", "custom-b"]);
				expect(models.every((m) => m.baseUrl === "https://custom.test/v1")).toBe(true);
				expect(await registry.getApiKeyAndHeaders(models[0])).toMatchObject({
					ok: true,
					headers: { "x-proxy": "enabled" },
				});
			});
		});
	});

	// 用例分组：集中验证“API key resolution”相关功能。
	describe("API key resolution", () => {
		/** Create provider config with custom apiKey */
		// 中文说明：上方英文注释给出本段功能、前提或边界，下面代码按该说明执行。
		function providerWithApiKey(apiKey: string) {
			return {
				baseUrl: "https://example.com/v1",
				apiKey,
				api: "anthropic-messages",
				models: [
					{
						id: "test-model",
						name: "Test Model",
						reasoning: false,
						input: ["text"],
						cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
						contextWindow: 100000,
						maxTokens: 8000,
					},
				],
			};
		}

		// 测试场景：验证“apiKey with ! prefix executes command and uses stdout”对应的行为、结果与边界。
		test("apiKey with ! prefix executes command and uses stdout", async () => {
			writeRawModelsJson({
				"custom-provider": providerWithApiKey("!echo test-api-key-from-command"),
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 apiKey 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const apiKey = await registry.getApiKeyForProvider("custom-provider");

			expect(apiKey).toBe("test-api-key-from-command");
		});

		// 测试场景：验证“apiKey with ! prefix trims whitespace from command output”对应的行为、结果与边界。
		test("apiKey with ! prefix trims whitespace from command output", async () => {
			writeRawModelsJson({
				"custom-provider": providerWithApiKey("!echo '  spaced-key  '"),
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 apiKey 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const apiKey = await registry.getApiKeyForProvider("custom-provider");

			expect(apiKey).toBe("spaced-key");
		});

		// 测试场景：验证“apiKey with ! prefix handles multiline output (uses trimmed result)”对应的行为、结果与边界。
		test("apiKey with ! prefix handles multiline output (uses trimmed result)", async () => {
			writeRawModelsJson({
				"custom-provider": providerWithApiKey("!printf 'line1\\nline2'"),
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 apiKey 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const apiKey = await registry.getApiKeyForProvider("custom-provider");

			expect(apiKey).toBe("line1\nline2");
		});

		// 测试场景：验证“apiKey with ! prefix returns undefined on command failure”对应的行为、结果与边界。
		test("apiKey with ! prefix returns undefined on command failure", async () => {
			writeRawModelsJson({
				"custom-provider": providerWithApiKey("!exit 1"),
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 apiKey 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const apiKey = await registry.getApiKeyForProvider("custom-provider");

			expect(apiKey).toBeUndefined();
		});

		// 测试场景：验证“apiKey with ! prefix returns undefined on nonexistent command”对应的行为、结果与边界。
		test("apiKey with ! prefix returns undefined on nonexistent command", async () => {
			writeRawModelsJson({
				"custom-provider": providerWithApiKey("!nonexistent-command-12345"),
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 apiKey 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const apiKey = await registry.getApiKeyForProvider("custom-provider");

			expect(apiKey).toBeUndefined();
		});

		// 测试场景：验证“apiKey with ! prefix returns undefined on empty output”对应的行为、结果与边界。
		test("apiKey with ! prefix returns undefined on empty output", async () => {
			writeRawModelsJson({
				"custom-provider": providerWithApiKey("!printf ''"),
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 apiKey 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const apiKey = await registry.getApiKeyForProvider("custom-provider");

			expect(apiKey).toBeUndefined();
		});

		// 测试场景：验证“apiKey with $ prefix resolves to env value”对应的行为、结果与边界。
		test("apiKey with $ prefix resolves to env value", async () => {
			/** 常量 originalEnv 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const originalEnv = process.env.TEST_API_KEY_12345;
			process.env.TEST_API_KEY_12345 = "env-api-key-value";

			try {
				writeRawModelsJson({
					"custom-provider": providerWithApiKey("$TEST_API_KEY_12345"),
				});

				/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const registry = await createModelRegistry(authStorage, modelsJsonPath);
				/** 常量 apiKey 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const apiKey = await registry.getApiKeyForProvider("custom-provider");

				expect(apiKey).toBe("env-api-key-value");
			} finally {
				if (originalEnv === undefined) {
					delete process.env.TEST_API_KEY_12345;
				} else {
					process.env.TEST_API_KEY_12345 = originalEnv;
				}
			}
		});

		// 测试场景：验证“apiKey with braced env syntax resolves to env value”对应的行为、结果与边界。
		test("apiKey with braced env syntax resolves to env value", async () => {
			/** 常量 originalEnv 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const originalEnv = process.env.TEST_BRACED_API_KEY_12345;
			process.env.TEST_BRACED_API_KEY_12345 = "braced-env-api-key-value";
			/** 常量 bracedKey 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const bracedKey = "$" + "{TEST_BRACED_API_KEY_12345}";

			try {
				writeRawModelsJson({
					"custom-provider": providerWithApiKey(bracedKey),
				});

				/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const registry = await createModelRegistry(authStorage, modelsJsonPath);
				/** 常量 apiKey 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const apiKey = await registry.getApiKeyForProvider("custom-provider");

				expect(apiKey).toBe("braced-env-api-key-value");
			} finally {
				if (originalEnv === undefined) {
					delete process.env.TEST_BRACED_API_KEY_12345;
				} else {
					process.env.TEST_BRACED_API_KEY_12345 = originalEnv;
				}
			}
		});

		// 测试场景：验证“apiKey interpolates braced env references inside literals”对应的行为、结果与边界。
		test("apiKey interpolates braced env references inside literals", async () => {
			/** 常量 originalPartA 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const originalPartA = process.env.TEST_INTERPOLATED_PART_A_12345;
			/** 常量 originalPartB 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const originalPartB = process.env.TEST_INTERPOLATED_PART_B_12345;
			process.env.TEST_INTERPOLATED_PART_A_12345 = "left";
			process.env.TEST_INTERPOLATED_PART_B_12345 = "right";
			/** 常量 interpolatedKey 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const interpolatedKey = ["$", "{TEST_INTERPOLATED_PART_A_12345}_$", "{TEST_INTERPOLATED_PART_B_12345}"].join(
				"",
			);

			try {
				writeRawModelsJson({
					"custom-provider": providerWithApiKey(interpolatedKey),
				});

				/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const registry = await createModelRegistry(authStorage, modelsJsonPath);
				/** 常量 apiKey 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const apiKey = await registry.getApiKeyForProvider("custom-provider");

				expect(apiKey).toBe("left_right");
			} finally {
				if (originalPartA === undefined) {
					delete process.env.TEST_INTERPOLATED_PART_A_12345;
				} else {
					process.env.TEST_INTERPOLATED_PART_A_12345 = originalPartA;
				}
				if (originalPartB === undefined) {
					delete process.env.TEST_INTERPOLATED_PART_B_12345;
				} else {
					process.env.TEST_INTERPOLATED_PART_B_12345 = originalPartB;
				}
			}
		});

		// 测试场景：验证“apiKey with $$ prefix escapes a leading dollar”对应的行为、结果与边界。
		test("apiKey with $$ prefix escapes a leading dollar", async () => {
			writeRawModelsJson({
				"custom-provider": providerWithApiKey("$$TEST_API_KEY_12345"),
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 apiKey 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const apiKey = await registry.getApiKeyForProvider("custom-provider");

			expect(apiKey).toBe("$TEST_API_KEY_12345");
		});

		// 测试场景：验证“apiKey with $! escapes a literal bang and still interpolates later env refs”对应的行为、结果与边界。
		test("apiKey with $! escapes a literal bang and still interpolates later env refs", async () => {
			/** 常量 originalEnv 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const originalEnv = process.env.TEST_API_KEY_12345;
			process.env.TEST_API_KEY_12345 = "env-api-key-value";

			try {
				writeRawModelsJson({
					"custom-provider": providerWithApiKey("$!literal-$TEST_API_KEY_12345"),
				});

				/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const registry = await createModelRegistry(authStorage, modelsJsonPath);
				/** 常量 apiKey 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const apiKey = await registry.getApiKeyForProvider("custom-provider");

				expect(apiKey).toBe("!literal-env-api-key-value");
			} finally {
				if (originalEnv === undefined) {
					delete process.env.TEST_API_KEY_12345;
				} else {
					process.env.TEST_API_KEY_12345 = originalEnv;
				}
			}
		});

		// 测试场景：验证“plain apiKey is used directly even when it matches an env var”对应的行为、结果与边界。
		test("plain apiKey is used directly even when it matches an env var", async () => {
			/** 常量 originalEnv 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const originalEnv = process.env.TEST_API_KEY_12345;
			process.env.TEST_API_KEY_12345 = "env-api-key-value";

			try {
				writeRawModelsJson({
					"custom-provider": providerWithApiKey("TEST_API_KEY_12345"),
				});

				/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const registry = await createModelRegistry(authStorage, modelsJsonPath);
				/** 常量 apiKey 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const apiKey = await registry.getApiKeyForProvider("custom-provider");

				expect(apiKey).toBe("TEST_API_KEY_12345");
			} finally {
				if (originalEnv === undefined) {
					delete process.env.TEST_API_KEY_12345;
				} else {
					process.env.TEST_API_KEY_12345 = originalEnv;
				}
			}
		});

		// 测试场景：验证“apiKey as literal value is used directly when not an env var”对应的行为、结果与边界。
		test("apiKey as literal value is used directly when not an env var", async () => {
			// Make sure this isn't an env var
			// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
			delete process.env.literal_api_key_value;

			writeRawModelsJson({
				"custom-provider": providerWithApiKey("literal_api_key_value"),
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 apiKey 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const apiKey = await registry.getApiKeyForProvider("custom-provider");

			expect(apiKey).toBe("literal_api_key_value");
		});

		// 测试场景：验证“apiKey command can use shell features like pipes”对应的行为、结果与边界。
		test("apiKey command can use shell features like pipes", async () => {
			writeRawModelsJson({
				"custom-provider": providerWithApiKey("!echo 'hello world' | tr ' ' '-'"),
			});

			/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registry = await createModelRegistry(authStorage, modelsJsonPath);
			/** 常量 apiKey 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const apiKey = await registry.getApiKeyForProvider("custom-provider");

			expect(apiKey).toBe("hello-world");
		});

		// 用例分组：集中验证“request-time resolution”相关功能。
		describe("request-time resolution", () => {
			// 测试场景：验证“command is executed on every provider lookup”对应的行为、结果与边界。
			test("command is executed on every provider lookup", async () => {
				/** 常量 counterFile 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const counterFile = join(tempDir, "counter");
				writeFileSync(counterFile, "0");

				/** 常量 counterPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const counterPath = toShPath(counterFile);
				/** 常量 command 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const command = `!sh -c 'count=$(cat "${counterPath}"); echo $((count + 1)) > "${counterPath}"; echo "key-value"'`;
				writeRawModelsJson({
					"custom-provider": providerWithApiKey(command),
				});

				/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const registry = await createModelRegistry(authStorage, modelsJsonPath);
				await registry.getApiKeyForProvider("custom-provider");
				await registry.getApiKeyForProvider("custom-provider");
				await registry.getApiKeyForProvider("custom-provider");

				/** 常量 count 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const count = parseInt(readFileSync(counterFile, "utf-8").trim(), 10);
				expect(count).toBe(3);
			});

			// 测试场景：验证“commands are re-executed across registry instances”对应的行为、结果与边界。
			test("commands are re-executed across registry instances", async () => {
				/** 常量 counterFile 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const counterFile = join(tempDir, "counter");
				writeFileSync(counterFile, "0");

				/** 常量 counterPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const counterPath = toShPath(counterFile);
				/** 常量 command 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const command = `!sh -c 'count=$(cat "${counterPath}"); echo $((count + 1)) > "${counterPath}"; echo "key-value"'`;
				writeRawModelsJson({
					"custom-provider": providerWithApiKey(command),
				});

				/** 常量 registry1 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const registry1 = await createModelRegistry(authStorage, modelsJsonPath);
				await registry1.getApiKeyForProvider("custom-provider");

				/** 常量 registry2 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const registry2 = await createModelRegistry(authStorage, modelsJsonPath);
				await registry2.getApiKeyForProvider("custom-provider");

				/** 常量 count 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const count = parseInt(readFileSync(counterFile, "utf-8").trim(), 10);
				expect(count).toBe(2);
			});

			// 测试场景：验证“different commands resolve independently”对应的行为、结果与边界。
			test("different commands resolve independently", async () => {
				writeRawModelsJson({
					"provider-a": providerWithApiKey("!echo key-a"),
					"provider-b": providerWithApiKey("!echo key-b"),
				});

				/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const registry = await createModelRegistry(authStorage, modelsJsonPath);

				/** 常量 keyA 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const keyA = await registry.getApiKeyForProvider("provider-a");
				/** 常量 keyB 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const keyB = await registry.getApiKeyForProvider("provider-b");

				expect(keyA).toBe("key-a");
				expect(keyB).toBe("key-b");
			});

			// 测试场景：验证“failed commands are retried”对应的行为、结果与边界。
			test("failed commands are retried", async () => {
				/** 常量 counterFile 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const counterFile = join(tempDir, "counter");
				writeFileSync(counterFile, "0");

				/** 常量 counterPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const counterPath = toShPath(counterFile);
				/** 常量 command 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const command = `!sh -c 'count=$(cat "${counterPath}"); echo $((count + 1)) > "${counterPath}"; exit 1'`;
				writeRawModelsJson({
					"custom-provider": providerWithApiKey(command),
				});

				/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const registry = await createModelRegistry(authStorage, modelsJsonPath);
				/** 常量 key1 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const key1 = await registry.getApiKeyForProvider("custom-provider");
				/** 常量 key2 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const key2 = await registry.getApiKeyForProvider("custom-provider");

				expect(key1).toBeUndefined();
				expect(key2).toBeUndefined();

				/** 常量 count 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const count = parseInt(readFileSync(counterFile, "utf-8").trim(), 10);
				expect(count).toBe(2);
			});

			// 测试场景：验证“provider auth status reports apiKey environment variables from models.json”对应的行为、结果与边界。
			test("provider auth status reports apiKey environment variables from models.json", async () => {
				/** 常量 envVarName 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const envVarName = "TEST_API_KEY_STATUS_TEST_98765";
				/** 常量 originalEnv 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const originalEnv = process.env[envVarName];

				try {
					process.env[envVarName] = "status-test-key";

					writeRawModelsJson({
						"custom-provider": providerWithApiKey(`$${envVarName}`),
					});

					/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const registry = await createModelRegistry(authStorage, modelsJsonPath);

					expect(registry.getProviderAuthStatus("custom-provider")).toEqual({
						configured: true,
						source: "environment",
						label: envVarName,
					});
				} finally {
					if (originalEnv === undefined) {
						delete process.env[envVarName];
					} else {
						process.env[envVarName] = originalEnv;
					}
				}
			});

			// 测试场景：验证“provider auth status reports interpolated apiKey environment variables”对应的行为、结果与边界。
			test("provider auth status reports interpolated apiKey environment variables", async () => {
				/** 常量 envVarNameA 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const envVarNameA = "TEST_API_KEY_STATUS_PART_A_98765";
				/** 常量 envVarNameB 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const envVarNameB = "TEST_API_KEY_STATUS_PART_B_98765";
				/** 常量 originalEnvA 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const originalEnvA = process.env[envVarNameA];
				/** 常量 originalEnvB 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const originalEnvB = process.env[envVarNameB];
				process.env[envVarNameA] = "left";
				process.env[envVarNameB] = "right";
				/** 常量 interpolatedKey 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const interpolatedKey = ["$", "{", envVarNameA, "}_$", "{", envVarNameB, "}"].join("");

				try {
					writeRawModelsJson({
						"custom-provider": providerWithApiKey(interpolatedKey),
					});

					/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const registry = await createModelRegistry(authStorage, modelsJsonPath);

					expect(registry.getProviderAuthStatus("custom-provider")).toEqual({
						configured: true,
						source: "environment",
						label: `${envVarNameA}, ${envVarNameB}`,
					});
				} finally {
					if (originalEnvA === undefined) {
						delete process.env[envVarNameA];
					} else {
						process.env[envVarNameA] = originalEnvA;
					}
					if (originalEnvB === undefined) {
						delete process.env[envVarNameB];
					} else {
						process.env[envVarNameB] = originalEnvB;
					}
				}
			});

			// 测试场景：验证“provider auth status reports non-env apiKey values from models.json as a config key”对应的行为、结果与边界。
			test("provider auth status reports non-env apiKey values from models.json as a config key", async () => {
				writeRawModelsJson({
					"custom-provider": providerWithApiKey("literal_api_key_value"),
				});

				/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const registry = await createModelRegistry(authStorage, modelsJsonPath);

				expect(registry.getProviderAuthStatus("custom-provider")).toEqual({
					configured: true,
					source: "models_json_key",
				});
			});

			// 测试场景：验证“missing explicit env apiKey keeps provider unavailable”对应的行为、结果与边界。
			test("missing explicit env apiKey keeps provider unavailable", async () => {
				/** 常量 envVarName 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const envVarName = "TEST_API_KEY_MISSING_TEST_98765";
				/** 常量 originalEnv 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const originalEnv = process.env[envVarName];
				delete process.env[envVarName];

				try {
					writeRawModelsJson({
						"custom-provider": providerWithApiKey(`$${envVarName}`),
					});

					/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const registry = await createModelRegistry(authStorage, modelsJsonPath);

					expect(registry.getProviderAuthStatus("custom-provider")).toEqual({ configured: false });
					expect(registry.getAvailable().some((model) => model.provider === "custom-provider")).toBe(false);
				} finally {
					if (originalEnv === undefined) {
						delete process.env[envVarName];
					} else {
						process.env[envVarName] = originalEnv;
					}
				}
			});

			// 测试场景：验证“provider auth status reports command apiKey values from models.json without executing them”对应的行为、结果与边界。
			test("provider auth status reports command apiKey values from models.json without executing them", async () => {
				/** 常量 counterFile 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const counterFile = join(tempDir, "status-counter");
				writeFileSync(counterFile, "0");
				/** 常量 counterPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const counterPath = toShPath(counterFile);
				/** 常量 command 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const command = `!sh -c 'echo 1 > "${counterPath}"; echo key-value'`;
				writeRawModelsJson({
					"custom-provider": providerWithApiKey(command),
				});

				/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const registry = await createModelRegistry(authStorage, modelsJsonPath);

				expect(registry.getProviderAuthStatus("custom-provider")).toEqual({
					configured: true,
					source: "models_json_command",
				});
				expect(readFileSync(counterFile, "utf-8")).toBe("0");
			});

			// 测试场景：验证“environment variables are not cached (changes are picked up)”对应的行为、结果与边界。
			test("environment variables are not cached (changes are picked up)", async () => {
				/** 常量 envVarName 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const envVarName = "TEST_API_KEY_CACHE_TEST_98765";
				/** 常量 originalEnv 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const originalEnv = process.env[envVarName];

				try {
					process.env[envVarName] = "first-value";

					writeRawModelsJson({
						"custom-provider": providerWithApiKey(`$${envVarName}`),
					});

					/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const registry = await createModelRegistry(authStorage, modelsJsonPath);

					/** 常量 key1 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const key1 = await registry.getApiKeyForProvider("custom-provider");
					expect(key1).toBe("first-value");

					process.env[envVarName] = "second-value";

					/** 常量 key2 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const key2 = await registry.getApiKeyForProvider("custom-provider");
					expect(key2).toBe("second-value");
				} finally {
					if (originalEnv === undefined) {
						delete process.env[envVarName];
					} else {
						process.env[envVarName] = originalEnv;
					}
				}
			});

			// 测试场景：验证“getAvailable does not execute command-backed apiKey resolution”对应的行为、结果与边界。
			test("getAvailable does not execute command-backed apiKey resolution", async () => {
				/** 常量 counterFile 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const counterFile = join(tempDir, "counter");
				writeFileSync(counterFile, "0");

				/** 常量 counterPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const counterPath = toShPath(counterFile);
				/** 常量 command 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const command = `!sh -c 'count=$(cat "${counterPath}"); echo $((count + 1)) > "${counterPath}"; echo "key-value"'`;
				writeRawModelsJson({
					"custom-provider": providerWithApiKey(command),
				});

				/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const registry = await createModelRegistry(authStorage, modelsJsonPath);
				/** 常量 available 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const available = registry.getAvailable();

				expect(available.some((m) => m.provider === "custom-provider")).toBe(true);
				/** 常量 count 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const count = parseInt(readFileSync(counterFile, "utf-8").trim(), 10);
				expect(count).toBe(0);
			});

			// 测试场景：验证“getAvailable filters GitHub Copilot OAuth models to account picker availability”对应的行为、结果与边界。
			test("getAvailable filters GitHub Copilot OAuth models to account picker availability", async () => {
				await authStorage.modify("github-copilot", async () => ({
					type: "oauth",
					refresh: "github-access-token",
					access: "tid=test;exp=9999999999;proxy-ep=proxy.individual.githubcopilot.com;",
					expires: Date.now() + 60_000,
					availableModelIds: ["gpt-4.1"],
				}));

				/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const registry = await createModelRegistry(authStorage, modelsJsonPath);

				expect(
					registry
						.getAvailable()
						.filter((m) => m.provider === "github-copilot")
						.map((m) => m.id),
				).toEqual(["gpt-4.1"]);
			});

			// 测试场景：验证“getApiKeyAndHeaders resolves authHeader on every request”对应的行为、结果与边界。
			test("getApiKeyAndHeaders resolves authHeader on every request", async () => {
				/** 常量 tokenFile 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const tokenFile = join(tempDir, "token");
				writeFileSync(tokenFile, "token-1");
				/** 常量 tokenPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const tokenPath = toShPath(tokenFile);

				writeRawModelsJson({
					"custom-provider": {
						...providerWithApiKey(`!sh -c 'cat "${tokenPath}"'`),
						authHeader: true,
					},
				});

				/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const registry = await createModelRegistry(authStorage, modelsJsonPath);
				/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const model = registry.find("custom-provider", "test-model");
				expect(model).toBeDefined();

				/** 常量 auth1 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const auth1 = await registry.getApiKeyAndHeaders(model!);
				expect(auth1).toEqual({
					ok: true,
					apiKey: "token-1",
					headers: { Authorization: "Bearer token-1" },
				});

				writeFileSync(tokenFile, "token-2");

				/** 常量 auth2 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const auth2 = await registry.getApiKeyAndHeaders(model!);
				expect(auth2).toEqual({
					ok: true,
					apiKey: "token-2",
					headers: { Authorization: "Bearer token-2" },
				});
			});

			// 测试场景：验证“getApiKeyAndHeaders resolves configured auth exactly once”对应的行为、结果与边界。
			test("getApiKeyAndHeaders resolves configured auth exactly once", async () => {
				/** 常量 counterFile 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const counterFile = join(tempDir, "auth-counter");
				writeFileSync(counterFile, "0");
				/** 常量 counterPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const counterPath = toShPath(counterFile);
				writeRawModelsJson({
					"custom-provider": {
						...providerWithApiKey(
							`!sh -c 'count=$(cat "${counterPath}"); count=$((count + 1)); echo "$count" > "${counterPath}"; echo "token-$count"'`,
						),
						authHeader: true,
					},
				});

				/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const registry = await createModelRegistry(authStorage, modelsJsonPath);
				/** 常量 auth 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const auth = await registry.getApiKeyAndHeaders(registry.find("custom-provider", "test-model")!);

				expect(auth).toEqual({
					ok: true,
					apiKey: "token-1",
					headers: { Authorization: "Bearer token-1" },
				});
				expect(readFileSync(counterFile, "utf-8").trim()).toBe("1");
			});

			// 测试场景：验证“stored credentials bypass lower-priority configured auth commands”对应的行为、结果与边界。
			test("stored credentials bypass lower-priority configured auth commands", async () => {
				/** 常量 counterFile 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const counterFile = join(tempDir, "fallback-counter");
				writeFileSync(counterFile, "0");
				/** 常量 counterPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const counterPath = toShPath(counterFile);
				writeRawModelsJson({
					"custom-provider": providerWithApiKey(`!sh -c 'echo 1 > "${counterPath}"; echo fallback-key'`),
				});
				await authStorage.modify("custom-provider", async () => ({ type: "api_key", key: "stored-key" }));

				/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const registry = await createModelRegistry(authStorage, modelsJsonPath);
				/** 常量 auth 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const auth = await registry.getApiKeyAndHeaders(registry.find("custom-provider", "test-model")!);

				expect(auth).toMatchObject({ ok: true, apiKey: "stored-key" });
				expect(readFileSync(counterFile, "utf-8").trim()).toBe("0");
			});

			// 测试场景：验证“getApiKeyAndHeaders preserves the legacy missing-key authHeader error”对应的行为、结果与边界。
			test("getApiKeyAndHeaders preserves the legacy missing-key authHeader error", async () => {
				writeRawModelsJson({
					"custom-provider": {
						baseUrl: "https://example.test/v1",
						api: "openai-completions",
						authHeader: true,
						models: [{ id: "test-model" }],
					},
				});

				/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const registry = await createModelRegistry(authStorage, modelsJsonPath);
				/** 常量 auth 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const auth = await registry.getApiKeyAndHeaders(registry.find("custom-provider", "test-model")!);

				expect(auth).toEqual({ ok: false, error: 'No API key found for "custom-provider"' });
			});

			// 测试场景：验证“getApiKeyAndHeaders returns an error for failed authHeader resolution”对应的行为、结果与边界。
			test("getApiKeyAndHeaders returns an error for failed authHeader resolution", async () => {
				writeRawModelsJson({
					"custom-provider": {
						...providerWithApiKey("!exit 1"),
						authHeader: true,
					},
				});

				/** 常量 registry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const registry = await createModelRegistry(authStorage, modelsJsonPath);
				/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const model = registry.find("custom-provider", "test-model");
				expect(model).toBeDefined();

				/** 常量 auth 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const auth = await registry.getApiKeyAndHeaders(model!);
				expect(auth.ok).toBe(false);
				if (!auth.ok) {
					expect(auth.error).toContain('Failed to resolve API key for provider "custom-provider"');
				}
			});
		});
	});
});
