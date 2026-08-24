/**
 * 文件职责：验证扩展提供的分支摘要 Usage 会持久化并计入会话总量。
 * 技术维度：使用 Vitest、Harness、扩展树导航钩子和会话统计 API。
 * 产品维度：扩展自定义摘要时仍能向用户准确展示 token 与费用统计。
 * 逻辑维度：钩子返回摘要和用量，构造分支并导航，检查摘要条目与会话 totals。
 * 关键边界：使用固定假用量；Harness 必须清理，测试只覆盖扩展提供摘要路径。
 * 新手阅读建议：先看 usage，再跟踪它从钩子 summary 到 summaryEntry 和 stats。
 */
import type { Usage } from "@earendil-works/pi-ai/compat";
import { afterEach, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./suite/harness.ts";
import { assistantMsg, userMsg } from "./utilities.ts";

/** 分支摘要扩展测试组。 */
describe("Branch summary extensions", () => {
	/** 当前测试组创建的 Harness。 */
	const harnesses: Harness[] = [];

	/** 每例后清理全部 Harness。 */
	afterEach(() => {
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
	});

	/** 验证钩子返回的 usage 进入摘要条目和会话统计。 */
	it("persists extension-provided summary usage in session totals", async () => {
		/** 扩展提供的固定 token 和费用用量。 */
		const usage: Usage = {
			input: 10,
			output: 20,
			cacheRead: 30,
			cacheWrite: 40,
			totalTokens: 100,
			cost: { input: 0.1, output: 0.2, cacheRead: 0.3, cacheWrite: 0.4, total: 1 },
		};
		/** 注册 session_before_tree 摘要钩子的 Harness。 */
		const harness = await createHarness({
			extensionFactories: [
				// pi 是扩展 API，用来注册树导航前钩子。
				(pi) => {
					pi.on("session_before_tree", () => ({
						summary: {
							summary: "Summary provided by extension",
							usage,
						},
					}));
				},
			],
		});
		harnesses.push(harness);

		/** 导航目标：第一分支用户消息 ID。 */
		const targetId = harness.sessionManager.appendMessage(userMsg("first branch"));
		harness.sessionManager.appendMessage(assistantMsg("first reply"));
		harness.sessionManager.appendMessage(userMsg("abandoned branch work"));
		harness.sessionManager.appendMessage(assistantMsg("abandoned reply"));

		/** 导航和摘要结果。 */
		const result = await harness.session.navigateTree(targetId, { summarize: true });
		/** 扩展生成的可选摘要条目。 */
		const summaryEntry = result.summaryEntry;

		expect(summaryEntry?.type).toBe("branch_summary");
		expect(summaryEntry?.fromHook).toBe(true);
		expect(summaryEntry?.summary).toBe("Summary provided by extension");
		expect(summaryEntry?.usage).toEqual(usage);

		/** 包含普通消息与摘要用量的会话统计。 */
		const stats = harness.session.getSessionStats();
		expect(stats.tokens).toEqual({ input: 12, output: 22, cacheRead: 30, cacheWrite: 40, total: 104 });
		expect(stats.cost).toBe(1);
	});
});
