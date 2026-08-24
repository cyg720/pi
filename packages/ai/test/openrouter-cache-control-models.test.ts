/**
 * 文件职责：验证 OpenRouter 上 Anthropic “latest”模型别名的提示词缓存控制元数据。
 * 技术维度：使用 Vitest 参数化测试，逐个读取兼容层模型并检查嵌套配置字段。
 * 产品维度：确保这些模型启用 Anthropic 格式缓存，减少重复提示词带来的延迟与费用。
 * 逻辑维度：维护受测模型 ID 常量列表，并对列表中每项执行同一条元数据断言。
 * 关键边界：只检查本地模型目录配置，不会验证 OpenRouter 远端实际缓存行为。
 * 新手阅读建议：先看模型 ID 列表，再跟进 getModel 如何合并 compat 配置，最后理解 it.each 参数化方式。
 */
import { describe, expect, it } from "vitest";
import { getModel } from "../src/compat.ts";

/** 需要使用 Anthropic 缓存格式的 OpenRouter 最新模型别名；只读元组可防止测试意外改写。 */
const OPENROUTER_ANTHROPIC_LATEST_MODEL_IDS = [
	"~anthropic/claude-fable-latest",
	"~anthropic/claude-haiku-latest",
	"~anthropic/claude-opus-latest",
	"~anthropic/claude-sonnet-latest",
] as const;

/** OpenRouter 缓存控制元数据测试组。 */
describe("OpenRouter Anthropic cache control metadata", () => {
	/** 对每个模型 ID 验证兼容配置；modelId 始终来自上方只读列表。 */
	it.each(OPENROUTER_ANTHROPIC_LATEST_MODEL_IDS)("enables cache control for %s", (modelId) => {
		expect(getModel("openrouter", modelId).compat?.cacheControlFormat).toBe("anthropic");
	});
});
