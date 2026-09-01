/**
 * 【文件职责】通用知识评测：用一组通用知识题目评估模型表现。
 * 【产品维度】衡量模型整体知识水平。
 * 【新手阅读建议】看题目集与评分。
 */
import { expect } from "vitest";
import { describeEval } from "vitest-evals";
import { createPiCodingAgentHarness } from "./pi-harness.ts";

const piCodingAgentHarness = createPiCodingAgentHarness({ noTools: "all" });

describeEval("Pi Coding Agent smoke", { harness: piCodingAgentHarness }, (it) => {
	it("runs a basic prompt end to end", async ({ run }) => {
		const result = await run("What's the capital of France? Respond with only the city name.");

		expect(result.output.trim()).toBe("Paris");
		expect(result.errors).toEqual([]);
		expect(result.usage.provider).toBe(process.env.PI_PROVIDER);
		expect(result.usage.model).toBe(process.env.PI_MODEL);
		expect(result.usage.totalTokens).toBeGreaterThan(0);
	});
});
