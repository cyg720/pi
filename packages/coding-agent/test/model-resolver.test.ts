/**
 * 文件职责：验证命令行模型模式解析、范围诊断、模型匹配、默认回退与初始模型选择。
 * 技术维度：使用 Vitest 和内存 ModelRegistry，通过静态模型夹具测试通配符、提供商限定与思考等级解析。
 * 产品维度：保证用户输入模型名称或模式时得到明确、稳定的选择结果和可理解的错误提示。
 * 逻辑维度：先定义多提供商模型集合，再分别测试 parseModelPattern、resolveCliModel 和 findInitialModel。
 * 关键边界：同名模型可能跨提供商产生歧义；模式匹配、默认列表和保存状态的优先级不能混淆。
 * 新手阅读建议：先看 mockModels 的差异，再看模式解析表格，最后跟踪 resolveCliModel 到初始模型回退。
 */
import type { Model } from "@earendil-works/pi-ai";
import { describe, expect, test, vi } from "vitest";
import {
	defaultModelPerProvider,
	findInitialModel,
	parseModelPattern,
	resolveCliModel,
	resolveModelScope,
	resolveModelScopeWithDiagnostics,
} from "../src/core/model-resolver.ts";

// Mock models for testing
// 中文说明：上方英文注释描述“Mock models for testing”相关前提、步骤或边界；下面代码按该说明执行。
const mockModels: Model<"anthropic-messages">[] = [
	{
		id: "claude-sonnet-4-5",
		name: "Claude Sonnet 4.5",
		api: "anthropic-messages",
		provider: "anthropic",
		baseUrl: "https://api.anthropic.com",
		reasoning: true,
		input: ["text", "image"],
		cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
		contextWindow: 200000,
		maxTokens: 8192,
	},
	{
		id: "gpt-4o",
		name: "GPT-4o",
		api: "anthropic-messages", // Using same type for simplicity
		provider: "openai",
		baseUrl: "https://api.openai.com",
		reasoning: false,
		input: ["text", "image"],
		cost: { input: 5, output: 15, cacheRead: 0.5, cacheWrite: 5 },
		contextWindow: 128000,
		maxTokens: 4096,
	},
];

// Mock OpenRouter models with colons in IDs
// 中文说明：上方英文注释描述“Mock OpenRouter models with colons in IDs”相关前提、步骤或边界；下面代码按该说明执行。
const mockOpenRouterModels: Model<"anthropic-messages">[] = [
	{
		id: "qwen/qwen3-coder:exacto",
		name: "Qwen3 Coder Exacto",
		api: "anthropic-messages",
		provider: "openrouter",
		baseUrl: "https://openrouter.ai/api/v1",
		reasoning: true,
		input: ["text"],
		cost: { input: 1, output: 2, cacheRead: 0.1, cacheWrite: 1 },
		contextWindow: 128000,
		maxTokens: 8192,
	},
	{
		id: "openai/gpt-4o:extended",
		name: "GPT-4o Extended",
		api: "anthropic-messages",
		provider: "openrouter",
		baseUrl: "https://openrouter.ai/api/v1",
		reasoning: false,
		input: ["text", "image"],
		cost: { input: 5, output: 15, cacheRead: 0.5, cacheWrite: 5 },
		contextWindow: 128000,
		maxTokens: 4096,
	},
];

/** 常量 allModels 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
const allModels = [...mockModels, ...mockOpenRouterModels];

// 用例分组：集中验证“parseModelPattern”相关功能。
describe("parseModelPattern", () => {
	// 用例分组：集中验证“simple patterns without colons”相关功能。
	describe("simple patterns without colons", () => {
		// 测试场景：验证“exact match returns model with undefined thinking level”对应的行为、返回值与边界条件。
		test("exact match returns model with undefined thinking level", () => {
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = parseModelPattern("claude-sonnet-4-5", allModels);
			expect(result.model?.id).toBe("claude-sonnet-4-5");
			expect(result.thinkingLevel).toBeUndefined();
			expect(result.warning).toBeUndefined();
		});

		// 测试场景：验证“partial match returns best model with undefined thinking level”对应的行为、返回值与边界条件。
		test("partial match returns best model with undefined thinking level", () => {
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = parseModelPattern("sonnet", allModels);
			expect(result.model?.id).toBe("claude-sonnet-4-5");
			expect(result.thinkingLevel).toBeUndefined();
			expect(result.warning).toBeUndefined();
		});

		// 测试场景：验证“no match returns undefined model and thinking level”对应的行为、返回值与边界条件。
		test("no match returns undefined model and thinking level", () => {
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = parseModelPattern("nonexistent", allModels);
			expect(result.model).toBeUndefined();
			expect(result.thinkingLevel).toBeUndefined();
			expect(result.warning).toBeUndefined();
		});
	});

	// 用例分组：集中验证“patterns with valid thinking levels”相关功能。
	describe("patterns with valid thinking levels", () => {
		// 测试场景：验证“sonnet:high returns sonnet with high thinking level”对应的行为、返回值与边界条件。
		test("sonnet:high returns sonnet with high thinking level", () => {
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = parseModelPattern("sonnet:high", allModels);
			expect(result.model?.id).toBe("claude-sonnet-4-5");
			expect(result.thinkingLevel).toBe("high");
			expect(result.warning).toBeUndefined();
		});

		// 测试场景：验证“gpt-4o:medium returns gpt-4o with medium thinking level”对应的行为、返回值与边界条件。
		test("gpt-4o:medium returns gpt-4o with medium thinking level", () => {
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = parseModelPattern("gpt-4o:medium", allModels);
			expect(result.model?.id).toBe("gpt-4o");
			expect(result.thinkingLevel).toBe("medium");
			expect(result.warning).toBeUndefined();
		});

		// 测试场景：验证“all valid thinking levels work”对应的行为、返回值与边界条件。
		test("all valid thinking levels work", () => {
			/** 循环变量 level 表示当前遍历项或索引，只在本循环体内有效。 */
			for (const level of ["off", "minimal", "low", "medium", "high", "xhigh", "max"]) {
				/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
				const result = parseModelPattern(`sonnet:${level}`, allModels);
				expect(result.model?.id).toBe("claude-sonnet-4-5");
				expect(result.thinkingLevel).toBe(level);
				expect(result.warning).toBeUndefined();
			}
		});
	});

	// 用例分组：集中验证“patterns with invalid thinking levels”相关功能。
	describe("patterns with invalid thinking levels", () => {
		// 测试场景：验证“sonnet:random returns sonnet with undefined thinking level and warning”对应的行为、返回值与边界条件。
		test("sonnet:random returns sonnet with undefined thinking level and warning", () => {
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = parseModelPattern("sonnet:random", allModels);
			expect(result.model?.id).toBe("claude-sonnet-4-5");
			expect(result.thinkingLevel).toBeUndefined();
			expect(result.warning).toContain("Invalid thinking level");
			expect(result.warning).toContain("random");
		});

		// 测试场景：验证“gpt-4o:invalid returns gpt-4o with undefined thinking level and warning”对应的行为、返回值与边界条件。
		test("gpt-4o:invalid returns gpt-4o with undefined thinking level and warning", () => {
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = parseModelPattern("gpt-4o:invalid", allModels);
			expect(result.model?.id).toBe("gpt-4o");
			expect(result.thinkingLevel).toBeUndefined();
			expect(result.warning).toContain("Invalid thinking level");
		});
	});

	// 用例分组：集中验证“OpenRouter models with colons in IDs”相关功能。
	describe("OpenRouter models with colons in IDs", () => {
		// 测试场景：验证“qwen3-coder:exacto matches the model with undefined thinking level”对应的行为、返回值与边界条件。
		test("qwen3-coder:exacto matches the model with undefined thinking level", () => {
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = parseModelPattern("qwen/qwen3-coder:exacto", allModels);
			expect(result.model?.id).toBe("qwen/qwen3-coder:exacto");
			expect(result.thinkingLevel).toBeUndefined();
			expect(result.warning).toBeUndefined();
		});

		// 测试场景：验证“openrouter/qwen/qwen3-coder:exacto matches with provider prefix”对应的行为、返回值与边界条件。
		test("openrouter/qwen/qwen3-coder:exacto matches with provider prefix", () => {
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = parseModelPattern("openrouter/qwen/qwen3-coder:exacto", allModels);
			expect(result.model?.id).toBe("qwen/qwen3-coder:exacto");
			expect(result.model?.provider).toBe("openrouter");
			expect(result.thinkingLevel).toBeUndefined();
			expect(result.warning).toBeUndefined();
		});

		// 测试场景：验证“qwen3-coder:exacto:high matches model with high thinking level”对应的行为、返回值与边界条件。
		test("qwen3-coder:exacto:high matches model with high thinking level", () => {
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = parseModelPattern("qwen/qwen3-coder:exacto:high", allModels);
			expect(result.model?.id).toBe("qwen/qwen3-coder:exacto");
			expect(result.thinkingLevel).toBe("high");
			expect(result.warning).toBeUndefined();
		});

		// 测试场景：验证“openrouter/qwen/qwen3-coder:exacto:high matches with provider and thinking level”对应的行为、返回值与边界条件。
		test("openrouter/qwen/qwen3-coder:exacto:high matches with provider and thinking level", () => {
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = parseModelPattern("openrouter/qwen/qwen3-coder:exacto:high", allModels);
			expect(result.model?.id).toBe("qwen/qwen3-coder:exacto");
			expect(result.model?.provider).toBe("openrouter");
			expect(result.thinkingLevel).toBe("high");
			expect(result.warning).toBeUndefined();
		});

		// 测试场景：验证“gpt-4o:extended matches the extended model with undefined thinking level”对应的行为、返回值与边界条件。
		test("gpt-4o:extended matches the extended model with undefined thinking level", () => {
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = parseModelPattern("openai/gpt-4o:extended", allModels);
			expect(result.model?.id).toBe("openai/gpt-4o:extended");
			expect(result.thinkingLevel).toBeUndefined();
			expect(result.warning).toBeUndefined();
		});
	});

	// 用例分组：集中验证“invalid thinking levels with OpenRouter models”相关功能。
	describe("invalid thinking levels with OpenRouter models", () => {
		// 测试场景：验证“qwen3-coder:exacto:random returns model with undefined thinking level and warning”对应的行为、返回值与边界条件。
		test("qwen3-coder:exacto:random returns model with undefined thinking level and warning", () => {
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = parseModelPattern("qwen/qwen3-coder:exacto:random", allModels);
			expect(result.model?.id).toBe("qwen/qwen3-coder:exacto");
			expect(result.thinkingLevel).toBeUndefined();
			expect(result.warning).toContain("Invalid thinking level");
			expect(result.warning).toContain("random");
		});

		// 测试场景：验证“qwen3-coder:exacto:high:random returns model with undefined thinking level and warning”对应的行为、返回值与边界条件。
		test("qwen3-coder:exacto:high:random returns model with undefined thinking level and warning", () => {
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = parseModelPattern("qwen/qwen3-coder:exacto:high:random", allModels);
			expect(result.model?.id).toBe("qwen/qwen3-coder:exacto");
			expect(result.thinkingLevel).toBeUndefined();
			expect(result.warning).toContain("Invalid thinking level");
			expect(result.warning).toContain("random");
		});
	});

	// 用例分组：集中验证“edge cases”相关功能。
	describe("edge cases", () => {
		// 测试场景：验证“empty pattern matches via partial matching”对应的行为、返回值与边界条件。
		test("empty pattern matches via partial matching", () => {
			// Empty string is included in all model IDs, so partial matching finds a match
			// 中文说明：上方英文注释描述“Empty string is included in all model IDs, so partial m”相关前提、步骤或边界；下面代码按该说明执行。
			const result = parseModelPattern("", allModels);
			expect(result.model).not.toBeNull();
			expect(result.thinkingLevel).toBeUndefined();
		});

		// 测试场景：验证“pattern ending with colon treats empty suffix as invalid”对应的行为、返回值与边界条件。
		test("pattern ending with colon treats empty suffix as invalid", () => {
			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = parseModelPattern("sonnet:", allModels);
			// Empty string after colon is not a valid thinking level
			// So it tries to match "sonnet:" which won't match, then tries "sonnet"
			// 中文说明：上方英文注释描述“Empty string after colon is not a valid thinking level ”相关前提、步骤或边界；下面代码按该说明执行。
			expect(result.model?.id).toBe("claude-sonnet-4-5");
			expect(result.warning).toContain("Invalid thinking level");
		});
	});
});

// 用例分组：集中验证“resolveModelScopeWithDiagnostics”相关功能。
describe("resolveModelScopeWithDiagnostics", () => {
	// 测试场景：验证“returns scoped models and structured diagnostics without writing console warnings”对应的行为、返回值与边界条件。
	test("returns scoped models and structured diagnostics without writing console warnings", async () => {
		/** 常量 warn 保存“warn”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			/** 常量 registry 保存“registry”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const registry = {
				getAvailable: () => allModels,
			} as unknown as Parameters<typeof resolveModelScopeWithDiagnostics>[1];

			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = await resolveModelScopeWithDiagnostics(["sonnet:high", "gpt-4o:invalid", "missing"], registry);

			expect(result.scopedModels.map((scoped) => scoped.model.id)).toEqual(["claude-sonnet-4-5", "gpt-4o"]);
			expect(result.scopedModels[0].thinkingLevel).toBe("high");
			expect(result.scopedModels[1].thinkingLevel).toBeUndefined();
			expect(result.diagnostics).toEqual([
				{
					type: "warning",
					message: 'Invalid thinking level "invalid" in pattern "gpt-4o:invalid". Using default instead.',
					code: "invalid-thinking-level",
					pattern: "gpt-4o:invalid",
				},
				{
					type: "warning",
					message: 'No models match pattern "missing"',
					code: "no-match",
					pattern: "missing",
				},
			]);
			expect(warn).not.toHaveBeenCalled();
		} finally {
			warn.mockRestore();
		}
	});

	// 测试场景：验证“resolveModelScope preserves CLI warning output”对应的行为、返回值与边界条件。
	test("resolveModelScope preserves CLI warning output", async () => {
		/** 常量 warn 保存“warn”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			/** 常量 registry 保存“registry”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const registry = {
				getAvailable: () => allModels,
			} as unknown as Parameters<typeof resolveModelScope>[1];

			/** 常量 scopedModels 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const scopedModels = await resolveModelScope(["missing"], registry);

			expect(scopedModels).toEqual([]);
			expect(warn).toHaveBeenCalledOnce();
			expect(warn.mock.calls[0][0]).toContain('Warning: No models match pattern "missing"');
		} finally {
			warn.mockRestore();
		}
	});

	// 测试场景：验证“resolves bracketed model ids as exact references before glob matching”对应的行为、返回值与边界条件。
	test("resolves bracketed model ids as exact references before glob matching", async () => {
		/** 常量 bracketedModel 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const bracketedModel: Model<"anthropic-messages"> = {
			id: "bracketed-model[1m]",
			name: "Bracketed Model",
			api: "anthropic-messages",
			provider: "custom",
			baseUrl: "https://example.invalid",
			reasoning: true,
			input: ["text"],
			cost: { input: 1, output: 2, cacheRead: 0.1, cacheWrite: 1 },
			contextWindow: 128000,
			maxTokens: 8192,
		};
		/** 常量 registry 保存“registry”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const registry = {
			getAvailable: () => [...allModels, bracketedModel],
		} as unknown as Parameters<typeof resolveModelScopeWithDiagnostics>[1];

		/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const result = await resolveModelScopeWithDiagnostics(["custom/bracketed-model[1m]"], registry);

		expect(result.scopedModels.map((scoped) => scoped.model.id)).toEqual(["bracketed-model[1m]"]);
		expect(result.diagnostics).toEqual([]);
	});

	// 测试场景：验证“resolves bracketed model ids with thinking levels as exact references before glob matching”对应的行为、返回值与边界条件。
	test("resolves bracketed model ids with thinking levels as exact references before glob matching", async () => {
		/** 常量 bracketedModel 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const bracketedModel: Model<"anthropic-messages"> = {
			id: "bracketed-model[1m]",
			name: "Bracketed Model",
			api: "anthropic-messages",
			provider: "custom",
			baseUrl: "https://example.invalid",
			reasoning: true,
			input: ["text"],
			cost: { input: 1, output: 2, cacheRead: 0.1, cacheWrite: 1 },
			contextWindow: 128000,
			maxTokens: 8192,
		};
		/** 常量 registry 保存“registry”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const registry = {
			getAvailable: () => [...allModels, bracketedModel],
		} as unknown as Parameters<typeof resolveModelScopeWithDiagnostics>[1];

		/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const result = await resolveModelScopeWithDiagnostics(["custom/bracketed-model[1m]:high"], registry);

		expect(result.scopedModels.map((scoped) => scoped.model.id)).toEqual(["bracketed-model[1m]"]);
		expect(result.scopedModels[0].thinkingLevel).toBe("high");
		expect(result.diagnostics).toEqual([]);
	});
});

// 用例分组：集中验证“resolveCliModel”相关功能。
describe("resolveCliModel", () => {
	// 测试场景：验证“resolves --model provider/id without --provider”对应的行为、返回值与边界条件。
	test("resolves --model provider/id without --provider", () => {
		/** 常量 registry 保存“registry”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const registry = {
			getModels: () => allModels,
		} as unknown as Parameters<typeof resolveCliModel>[0]["modelRuntime"];

		/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const result = resolveCliModel({
			cliModel: "openai/gpt-4o",
			modelRuntime: registry,
		});

		expect(result.error).toBeUndefined();
		expect(result.model?.provider).toBe("openai");
		expect(result.model?.id).toBe("gpt-4o");
	});

	// 测试场景：验证“resolves fuzzy patterns within an explicit provider”对应的行为、返回值与边界条件。
	test("resolves fuzzy patterns within an explicit provider", () => {
		/** 常量 registry 保存“registry”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const registry = {
			getModels: () => allModels,
		} as unknown as Parameters<typeof resolveCliModel>[0]["modelRuntime"];

		/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const result = resolveCliModel({
			cliProvider: "openai",
			cliModel: "4o",
			modelRuntime: registry,
		});

		expect(result.error).toBeUndefined();
		expect(result.model?.provider).toBe("openai");
		expect(result.model?.id).toBe("gpt-4o");
	});

	// 测试场景：验证“supports --model <pattern>:<thinking> (without explicit --thinking)”对应的行为、返回值与边界条件。
	test("supports --model <pattern>:<thinking> (without explicit --thinking)", () => {
		/** 常量 registry 保存“registry”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const registry = {
			getModels: () => allModels,
		} as unknown as Parameters<typeof resolveCliModel>[0]["modelRuntime"];

		/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const result = resolveCliModel({
			cliModel: "sonnet:high",
			modelRuntime: registry,
		});

		expect(result.error).toBeUndefined();
		expect(result.model?.id).toBe("claude-sonnet-4-5");
		expect(result.thinkingLevel).toBe("high");
	});

	// 测试场景：验证“prefers exact model id match over provider inference (OpenRouter-style ids)”对应的行为、返回值与边界条件。
	test("prefers exact model id match over provider inference (OpenRouter-style ids)", () => {
		/** 常量 registry 保存“registry”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const registry = {
			getModels: () => allModels,
		} as unknown as Parameters<typeof resolveCliModel>[0]["modelRuntime"];

		/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const result = resolveCliModel({
			cliModel: "openai/gpt-4o:extended",
			modelRuntime: registry,
		});

		expect(result.error).toBeUndefined();
		expect(result.model?.provider).toBe("openrouter");
		expect(result.model?.id).toBe("openai/gpt-4o:extended");
	});

	// 测试场景：验证“does not strip invalid :suffix as thinking level in --model (treat as raw id)”对应的行为、返回值与边界条件。
	test("does not strip invalid :suffix as thinking level in --model (treat as raw id)", () => {
		/** 常量 registry 保存“registry”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const registry = {
			getModels: () => allModels,
		} as unknown as Parameters<typeof resolveCliModel>[0]["modelRuntime"];

		/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const result = resolveCliModel({
			cliProvider: "openai",
			cliModel: "gpt-4o:extended",
			modelRuntime: registry,
		});

		expect(result.error).toBeUndefined();
		expect(result.model?.provider).toBe("openai");
		expect(result.model?.id).toBe("gpt-4o:extended");
	});

	// 测试场景：验证“allows custom model ids for explicit providers without double prefixing”对应的行为、返回值与边界条件。
	test("allows custom model ids for explicit providers without double prefixing", () => {
		/** 常量 registry 保存“registry”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const registry = {
			getModels: () => allModels,
		} as unknown as Parameters<typeof resolveCliModel>[0]["modelRuntime"];

		/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const result = resolveCliModel({
			cliProvider: "openrouter",
			cliModel: "openrouter/openai/ghost-model",
			modelRuntime: registry,
		});

		expect(result.error).toBeUndefined();
		expect(result.model?.provider).toBe("openrouter");
		expect(result.model?.id).toBe("openai/ghost-model");
	});

	// 测试场景：验证“returns a clear error when there are no models”对应的行为、返回值与边界条件。
	test("returns a clear error when there are no models", () => {
		/** 常量 registry 保存“registry”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const registry = {
			getModels: () => [],
		} as unknown as Parameters<typeof resolveCliModel>[0]["modelRuntime"];

		/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const result = resolveCliModel({
			cliProvider: "openai",
			cliModel: "gpt-4o",
			modelRuntime: registry,
		});

		expect(result.model).toBeUndefined();
		expect(result.error).toContain("No models available");
	});

	// 测试场景：验证“prefers provider/model split over gateway model with matching id”对应的行为、返回值与边界条件。
	test("prefers provider/model split over gateway model with matching id", () => {
		// When a user writes "zai/glm-5", and both a zai provider model (id: "glm-5")
		// and a gateway model (id: "zai/glm-5") exist, prefer the zai provider model.
		// 中文说明：上方英文注释描述“When a user writes "zai/glm-5", and both a zai provider”相关前提、步骤或边界；下面代码按该说明执行。
		const zaiModel: Model<"anthropic-messages"> = {
			id: "glm-5",
			name: "GLM-5",
			api: "anthropic-messages",
			provider: "zai",
			baseUrl: "https://open.bigmodel.cn/api/paas/v4",
			reasoning: true,
			input: ["text"],
			cost: { input: 1, output: 2, cacheRead: 0.1, cacheWrite: 1 },
			contextWindow: 128000,
			maxTokens: 8192,
		};
		/** 常量 gatewayModel 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const gatewayModel: Model<"anthropic-messages"> = {
			id: "zai/glm-5",
			name: "GLM-5",
			api: "anthropic-messages",
			provider: "vercel-ai-gateway",
			baseUrl: "https://ai-gateway.vercel.sh",
			reasoning: true,
			input: ["text"],
			cost: { input: 1, output: 2, cacheRead: 0.1, cacheWrite: 1 },
			contextWindow: 128000,
			maxTokens: 8192,
		};
		/** 常量 registry 保存“registry”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const registry = {
			getModels: () => [...allModels, zaiModel, gatewayModel],
			hasConfiguredAuth: () => true,
		} as unknown as Parameters<typeof resolveCliModel>[0]["modelRuntime"];

		/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const result = resolveCliModel({
			cliModel: "zai/glm-5",
			modelRuntime: registry,
		});

		expect(result.error).toBeUndefined();
		expect(result.model?.provider).toBe("zai");
		expect(result.model?.id).toBe("glm-5");
	});

	// 测试场景：验证“prefers an authenticated exact raw model id over an unauthenticated inferred provider”对应的行为、返回值与边界条件。
	test("prefers an authenticated exact raw model id over an unauthenticated inferred provider", () => {
		/** 常量 commandcodeModel 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const commandcodeModel: Model<"anthropic-messages"> = {
			id: "xiaomi/mimo-v2.5-pro",
			name: "Xiaomi MiMo via Commandcode",
			api: "anthropic-messages",
			provider: "commandcode",
			baseUrl: "https://example.invalid",
			reasoning: false,
			input: ["text"],
			cost: { input: 1, output: 2, cacheRead: 0.1, cacheWrite: 1 },
			contextWindow: 128000,
			maxTokens: 8192,
		};
		/** 常量 xiaomiModel 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const xiaomiModel: Model<"anthropic-messages"> = {
			id: "mimo-v2.5-pro",
			name: "Xiaomi MiMo",
			api: "anthropic-messages",
			provider: "xiaomi",
			baseUrl: "https://api.xiaomimimo.com",
			reasoning: false,
			input: ["text"],
			cost: { input: 1, output: 2, cacheRead: 0.1, cacheWrite: 1 },
			contextWindow: 128000,
			maxTokens: 8192,
		};
		/** 常量 registry 保存“registry”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const registry = {
			getModels: () => [...allModels, commandcodeModel, xiaomiModel],
			hasConfiguredAuth: (provider: string) => provider === "commandcode",
		} as unknown as Parameters<typeof resolveCliModel>[0]["modelRuntime"];

		/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const result = resolveCliModel({
			cliModel: "xiaomi/mimo-v2.5-pro",
			modelRuntime: registry,
		});

		expect(result.error).toBeUndefined();
		expect(result.model?.provider).toBe("commandcode");
		expect(result.model?.id).toBe("xiaomi/mimo-v2.5-pro");
	});

	// 测试场景：验证“resolves provider-prefixed fuzzy patterns (openrouter/qwen -> openrouter model)”对应的行为、返回值与边界条件。
	test("resolves provider-prefixed fuzzy patterns (openrouter/qwen -> openrouter model)", () => {
		/** 常量 registry 保存“registry”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const registry = {
			getModels: () => allModels,
		} as unknown as Parameters<typeof resolveCliModel>[0]["modelRuntime"];

		/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const result = resolveCliModel({
			cliModel: "openrouter/qwen",
			modelRuntime: registry,
		});

		expect(result.error).toBeUndefined();
		expect(result.model?.provider).toBe("openrouter");
		expect(result.model?.id).toBe("qwen/qwen3-coder:exacto");
	});

	// 用例分组：集中验证“custom model fallback with :thinking suffix (#5552)”相关功能。
	describe("custom model fallback with :thinking suffix (#5552)", () => {
		// Models for a provider that has registered models but the specific model ID
		// is not in the registry (triggers buildFallbackModel path).
		// 中文说明：上方英文注释描述“Models for a provider that has registered models but th”相关前提、步骤或边界；下面代码按该说明执行。
		const neuralwattModel: Model<"anthropic-messages"> = {
			id: "some-base-model",
			name: "Some Base Model",
			api: "anthropic-messages",
			provider: "neuralwatt",
			baseUrl: "https://api.neuralwatt.com",
			reasoning: false,
			input: ["text"],
			cost: { input: 1, output: 2, cacheRead: 0.1, cacheWrite: 1 },
			contextWindow: 128000,
			maxTokens: 8192,
		};

		/** 常量 modelsWithNeuralwatt 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const modelsWithNeuralwatt = [...allModels, neuralwattModel];

		// 测试场景：验证“strips :thinking suffix from custom model id in fallback path”对应的行为、返回值与边界条件。
		test("strips :thinking suffix from custom model id in fallback path", () => {
			/** 常量 registry 保存“registry”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const registry = {
				getModels: () => modelsWithNeuralwatt,
			} as unknown as Parameters<typeof resolveCliModel>[0]["modelRuntime"];

			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = resolveCliModel({
				cliModel: "neuralwatt/zai-org/GLM-5.1-FP8:high",
				modelRuntime: registry,
			});

			expect(result.error).toBeUndefined();
			expect(result.model?.provider).toBe("neuralwatt");
			// The :high suffix must NOT leak into the model id sent to the API
			// 中文说明：上方英文注释描述“The :high suffix must NOT leak into the model id sent t”相关前提、步骤或边界；下面代码按该说明执行。
			expect(result.model?.id).toBe("zai-org/GLM-5.1-FP8");
			expect(result.model?.reasoning).toBe(true);
			expect(result.thinkingLevel).toBe("high");
		});

		// 测试场景：验证“custom model without thinking suffix works normally in fallback path”对应的行为、返回值与边界条件。
		test("custom model without thinking suffix works normally in fallback path", () => {
			/** 常量 registry 保存“registry”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const registry = {
				getModels: () => modelsWithNeuralwatt,
			} as unknown as Parameters<typeof resolveCliModel>[0]["modelRuntime"];

			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = resolveCliModel({
				cliModel: "neuralwatt/zai-org/GLM-5.1-FP8",
				modelRuntime: registry,
			});

			expect(result.error).toBeUndefined();
			expect(result.model?.provider).toBe("neuralwatt");
			expect(result.model?.id).toBe("zai-org/GLM-5.1-FP8");
			expect(result.thinkingLevel).toBeUndefined();
		});

		// 测试场景：验证“all valid thinking levels work in fallback path”对应的行为、返回值与边界条件。
		test("all valid thinking levels work in fallback path", () => {
			/** 常量 registry 保存“registry”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const registry = {
				getModels: () => modelsWithNeuralwatt,
			} as unknown as Parameters<typeof resolveCliModel>[0]["modelRuntime"];

			/** 循环变量 level 表示当前遍历项或索引，只在本循环体内有效。 */
			for (const level of ["off", "minimal", "low", "medium", "high", "xhigh", "max"]) {
				/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
				const result = resolveCliModel({
					cliModel: `neuralwatt/zai-org/GLM-5.1-FP8:${level}`,
					modelRuntime: registry,
				});

				expect(result.error).toBeUndefined();
				expect(result.model?.id).toBe("zai-org/GLM-5.1-FP8");
				expect(result.thinkingLevel).toBe(level);
			}
		});

		// 测试场景：验证“invalid thinking suffix on custom model is treated as part of model id”对应的行为、返回值与边界条件。
		test("invalid thinking suffix on custom model is treated as part of model id", () => {
			/** 常量 registry 保存“registry”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const registry = {
				getModels: () => modelsWithNeuralwatt,
			} as unknown as Parameters<typeof resolveCliModel>[0]["modelRuntime"];

			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = resolveCliModel({
				cliModel: "neuralwatt/zai-org/GLM-5.1-FP8:banana",
				modelRuntime: registry,
			});

			expect(result.error).toBeUndefined();
			expect(result.model?.provider).toBe("neuralwatt");
			// Invalid suffix stays in the id (it's not a thinking level)
			// 中文说明：上方英文注释描述“Invalid suffix stays in the id (it's not a thinking lev”相关前提、步骤或边界；下面代码按该说明执行。
			expect(result.model?.id).toBe("zai-org/GLM-5.1-FP8:banana");
			expect(result.thinkingLevel).toBeUndefined();
		});

		// 测试场景：验证“explicit --provider with custom model:thinking strips suffix correctly”对应的行为、返回值与边界条件。
		test("explicit --provider with custom model:thinking strips suffix correctly", () => {
			/** 常量 registry 保存“registry”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const registry = {
				getModels: () => modelsWithNeuralwatt,
			} as unknown as Parameters<typeof resolveCliModel>[0]["modelRuntime"];

			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = resolveCliModel({
				cliProvider: "neuralwatt",
				cliModel: "zai-org/GLM-5.1-FP8:high",
				modelRuntime: registry,
			});

			expect(result.error).toBeUndefined();
			expect(result.model?.provider).toBe("neuralwatt");
			expect(result.model?.id).toBe("zai-org/GLM-5.1-FP8");
			expect(result.thinkingLevel).toBe("high");
		});

		// 测试场景：验证“with explicit --thinking, :suffix is kept as part of model id”对应的行为、返回值与边界条件。
		test("with explicit --thinking, :suffix is kept as part of model id", () => {
			/** 常量 registry 保存“registry”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const registry = {
				getModels: () => modelsWithNeuralwatt,
			} as unknown as Parameters<typeof resolveCliModel>[0]["modelRuntime"];

			/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const result = resolveCliModel({
				cliModel: "neuralwatt/zai-org/GLM-5.1-FP8:high",
				cliThinking: "medium",
				modelRuntime: registry,
			});

			expect(result.error).toBeUndefined();
			expect(result.model?.provider).toBe("neuralwatt");
			// :high is kept as part of the model id since --thinking was explicit
			// 中文说明：上方英文注释描述“:high is kept as part of the model id since --thinking ”相关前提、步骤或边界；下面代码按该说明执行。
			expect(result.model?.id).toBe("zai-org/GLM-5.1-FP8:high");
			expect(result.thinkingLevel).toBeUndefined();
		});
	});
});

// 用例分组：集中验证“default model selection”相关功能。
describe("default model selection", () => {
	// 测试场景：验证“openai defaults track current models”对应的行为、返回值与边界条件。
	test("openai defaults track current models", () => {
		expect(defaultModelPerProvider.openai).toBe("gpt-5.5");
		expect(defaultModelPerProvider["openai-codex"]).toBe("gpt-5.5");
	});

	// 测试场景：验证“zai, minimax, cerebras, and ant-ling defaults track current models”对应的行为、返回值与边界条件。
	test("zai, minimax, cerebras, and ant-ling defaults track current models", () => {
		expect(defaultModelPerProvider.zai).toBe("glm-5.1");
		expect(defaultModelPerProvider.minimax).toBe("MiniMax-M2.7");
		expect(defaultModelPerProvider["minimax-cn"]).toBe("MiniMax-M2.7");
		expect(defaultModelPerProvider.cerebras).toBe("zai-glm-4.7");
		expect(defaultModelPerProvider["ant-ling"]).toBe("Ring-2.6-1T");
	});

	// 测试场景：验证“ai-gateway default tracks current model”对应的行为、返回值与边界条件。
	test("ai-gateway default tracks current model", () => {
		expect(defaultModelPerProvider["vercel-ai-gateway"]).toBe("zai/glm-5.1");
	});

	// 测试场景：验证“findInitialModel accepts explicit provider custom model ids”对应的行为、返回值与边界条件。
	test("findInitialModel accepts explicit provider custom model ids", async () => {
		/** 常量 registry 保存“registry”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const registry = {
			getModels: () => allModels,
		} as unknown as Parameters<typeof findInitialModel>[0]["modelRuntime"];

		/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const result = await findInitialModel({
			cliProvider: "openrouter",
			cliModel: "openrouter/openai/ghost-model",
			scopedModels: [],
			isContinuing: false,
			modelRuntime: registry,
		});

		expect(result.model?.provider).toBe("openrouter");
		expect(result.model?.id).toBe("openai/ghost-model");
	});

	// 测试场景：验证“findInitialModel selects ai-gateway default when available”对应的行为、返回值与边界条件。
	test("findInitialModel selects ai-gateway default when available", async () => {
		/** 常量 aiGatewayModel 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const aiGatewayModel: Model<"anthropic-messages"> = {
			id: "anthropic/claude-opus-4-6",
			name: "Claude Opus 4.6",
			api: "anthropic-messages",
			provider: "vercel-ai-gateway",
			baseUrl: "https://ai-gateway.vercel.sh",
			reasoning: true,
			input: ["text", "image"],
			cost: { input: 5, output: 15, cacheRead: 0.5, cacheWrite: 5 },
			contextWindow: 200000,
			maxTokens: 8192,
		};

		/** 常量 registry 保存“registry”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const registry = {
			getAvailable: async () => [aiGatewayModel],
		} as unknown as Parameters<typeof findInitialModel>[0]["modelRuntime"];

		/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const result = await findInitialModel({
			scopedModels: [],
			isContinuing: false,
			modelRuntime: registry,
		});

		expect(result.model?.provider).toBe("vercel-ai-gateway");
		expect(result.model?.id).toBe("anthropic/claude-opus-4-6");
	});

	// 测试场景：验证“findInitialModel ignores an unauthenticated saved default”对应的行为、返回值与边界条件。
	test("findInitialModel ignores an unauthenticated saved default", async () => {
		/** 常量 savedDeepSeekModel 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const savedDeepSeekModel: Model<"anthropic-messages"> = {
			id: "deepseek-v4-flash",
			name: "DeepSeek V4 Flash",
			api: "anthropic-messages",
			provider: "deepseek",
			baseUrl: "https://api.deepseek.com",
			reasoning: true,
			input: ["text"],
			cost: { input: 1, output: 2, cacheRead: 0.1, cacheWrite: 1 },
			contextWindow: 128000,
			maxTokens: 8192,
		};
		/** 常量 localDeepSeekModel 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const localDeepSeekModel: Model<"anthropic-messages"> = {
			...savedDeepSeekModel,
			provider: "spark-two",
			baseUrl: "http://spark-two:8000/v1",
		};
		/** 常量 registry 保存“registry”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const registry = {
			getModel: (provider: string, modelId: string) =>
				provider === savedDeepSeekModel.provider && modelId === savedDeepSeekModel.id
					? savedDeepSeekModel
					: undefined,
			hasConfiguredAuth: (provider: string) => provider === "spark-two",
			getAvailable: async () => [localDeepSeekModel],
		} as unknown as Parameters<typeof findInitialModel>[0]["modelRuntime"];

		/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const result = await findInitialModel({
			scopedModels: [],
			isContinuing: false,
			defaultProvider: "deepseek",
			defaultModelId: "deepseek-v4-flash",
			modelRuntime: registry,
		});

		expect(result.model?.provider).toBe("spark-two");
		expect(result.model?.id).toBe("deepseek-v4-flash");
	});
});
