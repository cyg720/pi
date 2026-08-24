/**
 * 文件职责：验证不同提供商和模型系列暴露的 thinking 等级集合，重点覆盖 xhigh、max 和不可关闭推理。
 * 技术维度：使用 Vitest 参数化用例读取真实生成模型目录，并调用 getSupportedThinkingLevels 做纯函数断言。
 * 产品维度：确保界面只向用户展示模型实际支持的推理强度，避免请求被拒绝或错误显示“关闭”选项。
 * 逻辑维度：按 Anthropic、OpenAI/Codex、DeepSeek、Kimi、Grok、OpenRouter 和 Bedrock 模型逐项校验。
 * 关键边界：等级顺序也是公开行为；同一模型在不同 API/提供商路由下可能具有不同能力。
 * 新手阅读建议：先比较同系列新旧 Claude，再看同一 DeepSeek 模型在原生、OpenCode 和 OpenRouter 的差异。
 */
import { describe, expect, it } from "vitest";
import { getModel, getSupportedThinkingLevels } from "../src/compat.ts";

// 验证模型元数据与 API 兼容规则共同计算出的可用推理等级。
describe("getSupportedThinkingLevels", () => {
	// Opus 4.6 支持 max，但旧协议能力不含 xhigh。
	it("includes max but not xhigh for Anthropic Opus 4.6 on anthropic-messages API", () => {
		// model 是 Anthropic 原生 Opus 4.6。
		const model = getModel("anthropic", "claude-opus-4-6");
		expect(model).toBeDefined();
		expect(getSupportedThinkingLevels(model!)).toContain("max");
		expect(getSupportedThinkingLevels(model!)).not.toContain("xhigh");
	});

	// Opus 4.8 新增 xhigh 且继续支持 max。
	it("includes xhigh and max for Anthropic Opus 4.8 on anthropic-messages API", () => {
		// model 是 Anthropic 原生 Opus 4.8。
		const model = getModel("anthropic", "claude-opus-4-8");
		expect(model).toBeDefined();
		expect(getSupportedThinkingLevels(model!)).toContain("xhigh");
		expect(getSupportedThinkingLevels(model!)).toContain("max");
	});

	// Opus 5 同时支持 xhigh 与 max。
	it("includes xhigh and max for Anthropic Opus 5 on anthropic-messages API", () => {
		// model 是 Anthropic 原生 Opus 5。
		const model = getModel("anthropic", "claude-opus-5");
		expect(model).toBeDefined();
		expect(getSupportedThinkingLevels(model!)).toContain("xhigh");
		expect(getSupportedThinkingLevels(model!)).toContain("max");
	});

	// Sonnet 4.6 支持 max 但不支持 xhigh。
	it("includes max but not xhigh for Anthropic Sonnet 4.6 on anthropic-messages API", () => {
		// model 是 Anthropic 原生 Sonnet 4.6。
		const model = getModel("anthropic", "claude-sonnet-4-6");
		expect(model).toBeDefined();
		expect(getSupportedThinkingLevels(model!)).toContain("max");
		expect(getSupportedThinkingLevels(model!)).not.toContain("xhigh");
	});

	// Sonnet 5 支持 xhigh 和 max。
	it("includes xhigh and max for Anthropic Sonnet 5 on anthropic-messages API", () => {
		// model 是 Anthropic 原生 Sonnet 5。
		const model = getModel("anthropic", "claude-sonnet-5");
		expect(model).toBeDefined();
		expect(getSupportedThinkingLevels(model!)).toContain("xhigh");
		expect(getSupportedThinkingLevels(model!)).toContain("max");
	});

	// Fable 5 支持高等级推理，但推理不可关闭。
	it("includes xhigh and max but not off for Anthropic Claude Fable 5 on anthropic-messages API", () => {
		// model 是 Anthropic 原生 Fable 5。
		const model = getModel("anthropic", "claude-fable-5");
		expect(model).toBeDefined();
		expect(getSupportedThinkingLevels(model!)).toContain("xhigh");
		expect(getSupportedThinkingLevels(model!)).toContain("max");
		expect(getSupportedThinkingLevels(model!)).not.toContain("off");
	});

	// 较旧 Sonnet 4.5 不应意外继承 xhigh/max。
	it("does not include xhigh or max for Claude Sonnet 4.5", () => {
		// model 是作为旧能力基线的 Sonnet 4.5。
		const model = getModel("anthropic", "claude-sonnet-4-5");
		expect(model).toBeDefined();
		expect(getSupportedThinkingLevels(model!)).not.toContain("xhigh");
		expect(getSupportedThinkingLevels(model!)).not.toContain("max");
	});

	// 多个 Codex GPT 系列都应支持 xhigh。
	it.each(["gpt-5.4", "gpt-5.5", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"] as const)(
		"includes xhigh for openai-codex %s models",
		(modelId) => {
			// model 是当前参数化 ID 对应的 OpenAI Codex 模型。
			const model = getModel("openai-codex", modelId);
			expect(model).toBeDefined();
			expect(getSupportedThinkingLevels(model!)).toContain("xhigh");
		},
	);

	// OpenAI 5.6 三种档位公开完整 off 到 max 等级顺序。
	it.each(["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"] as const)(
		"includes xhigh and max for OpenAI %s models",
		(modelId) => {
			// model 是当前 OpenAI 5.6 档位模型。
			const model = getModel("openai", modelId);
			expect(model).toBeDefined();
			expect(getSupportedThinkingLevels(model!)).toEqual(["off", "low", "medium", "high", "xhigh", "max"]);
		},
	);

	// GPT-5.5 Pro 只提供中、高和超高，不含 off/low/max。
	it("includes only medium/high/xhigh for OpenAI GPT-5.5 Pro", () => {
		// model 是 OpenAI 原生 GPT-5.5 Pro。
		const model = getModel("openai", "gpt-5.5-pro");
		expect(model).toBeDefined();
		expect(getSupportedThinkingLevels(model!)).toEqual(["medium", "high", "xhigh"]);
	});

	// OpenRouter 路由的 GPT-5.5 Pro 应保持同一等级集合。
	it("includes only medium/high/xhigh for OpenRouter GPT-5.5 Pro", () => {
		// model 是 OpenRouter 上的 GPT-5.5 Pro。
		const model = getModel("openrouter", "openai/gpt-5.5-pro");
		expect(model).toBeDefined();
		expect(getSupportedThinkingLevels(model!)).toEqual(["medium", "high", "xhigh"]);
	});

	// DeepSeek 原生 V4 Flash 支持关闭、高和 max。
	it("includes only high/max plus off for DeepSeek V4 Flash on the DeepSeek provider", () => {
		// model 是 DeepSeek 原生 V4 Flash。
		const model = getModel("deepseek", "deepseek-v4-flash");
		expect(model).toBeDefined();
		expect(getSupportedThinkingLevels(model!)).toEqual(["off", "high", "max"]);
	});

	// OpenCode Go 的同模型也使用 off/high/max。
	it("includes only high/max plus off for DeepSeek V4 Flash on opencode-go", () => {
		// model 是 OpenCode Go 路由的 DeepSeek V4 Flash。
		const model = getModel("opencode-go", "deepseek-v4-flash");
		expect(model).toBeDefined();
		expect(getSupportedThinkingLevels(model!)).toEqual(["off", "high", "max"]);
	});

	// OpenCode Go Kimi K2.6 仅支持关闭或高推理。
	it("includes only high plus off for OpenCode Go Kimi K2.6", () => {
		// model 是 OpenCode Go 的 Kimi K2.6。
		const model = getModel("opencode-go", "kimi-k2.6");
		expect(model).toBeDefined();
		expect(getSupportedThinkingLevels(model!)).toEqual(["off", "high"]);
	});

	// Moonshot 国内外 Kimi K2.7 Code 均为始终推理模型，不含 off。
	it("excludes thinking off for Moonshot Kimi K2.7 Code models", () => {
		// cases 包含国际与中国区两个 Moonshot 路由。
		const cases = [getModel("moonshotai", "kimi-k2.7-code"), getModel("moonshotai-cn", "kimi-k2.7-code")];

		for (const model of cases) {
			expect(model).toBeDefined();
			expect(getSupportedThinkingLevels(model!)).toEqual(["minimal", "low", "medium", "high"]);
		}
	});

	// Moonshot Kimi K3 两个区域都使用已验证的 low/high/max。
	it.each(["moonshotai", "moonshotai-cn"] as const)("uses the verified effort options for %s Kimi K3", (provider) => {
		// model 是当前区域提供商的 Kimi K3。
		const model = getModel(provider, "kimi-k3");
		expect(model).toBeDefined();
		expect(getSupportedThinkingLevels(model!)).toEqual(["low", "high", "max"]);
	});

	// Kimi Coding K3 同样只提供 low/high/max。
	it("includes only low, high, max for Kimi Coding K3", () => {
		// model 是 Kimi Coding 路由的 K3。
		const model = getModel("kimi-coding", "k3");
		expect(model).toBeDefined();
		expect(getSupportedThinkingLevels(model!)).toEqual(["low", "high", "max"]);
	});

	// Grok Build 固定使用 high，不提供其他选择。
	it("includes only high for OpenCode Grok Build", () => {
		// model 是 OpenCode 的 Grok Build。
		const model = getModel("opencode", "grok-build-0.1");
		expect(model).toBeDefined();
		expect(getSupportedThinkingLevels(model!)).toEqual(["high"]);
	});

	// OpenRouter DeepSeek V4 Flash 与原生路由不同，使用 off/high/xhigh。
	it("includes only high/xhigh plus off for DeepSeek V4 Flash on OpenRouter", () => {
		// model 是 OpenRouter 路由的 DeepSeek V4 Flash。
		const model = getModel("openrouter", "deepseek/deepseek-v4-flash");
		expect(model).toBeDefined();
		expect(getSupportedThinkingLevels(model!)).toEqual(["off", "high", "xhigh"]);
	});

	// OpenRouter OpenAI-Completions 路由的 Opus 4.6 有 max 但无 xhigh。
	it("includes max but not xhigh for OpenRouter Opus 4.6 (openai-completions API)", () => {
		// model 是 OpenRouter 上的 Claude Opus 4.6。
		const model = getModel("openrouter", "anthropic/claude-opus-4.6");
		expect(model).toBeDefined();
		expect(getSupportedThinkingLevels(model!)).toContain("max");
		expect(getSupportedThinkingLevels(model!)).not.toContain("xhigh");
	});

	// Bedrock Opus 5 支持 xhigh 和 max。
	it("includes xhigh and max for Bedrock Claude Opus 5", () => {
		// model 是 Amazon Bedrock 全局 Opus 5。
		const model = getModel("amazon-bedrock", "global.anthropic.claude-opus-5");
		expect(model).toBeDefined();
		expect(getSupportedThinkingLevels(model!)).toContain("xhigh");
		expect(getSupportedThinkingLevels(model!)).toContain("max");
	});

	// Bedrock Fable 5 支持 xhigh/max，但也不可关闭推理。
	it("includes xhigh and max but not off for Bedrock Claude Fable 5", () => {
		// model 是 Amazon Bedrock 全局 Fable 5。
		const model = getModel("amazon-bedrock", "global.anthropic.claude-fable-5");
		expect(model).toBeDefined();
		expect(getSupportedThinkingLevels(model!)).toContain("xhigh");
		expect(getSupportedThinkingLevels(model!)).toContain("max");
		expect(getSupportedThinkingLevels(model!)).not.toContain("off");
	});
});
