/**
 * 文件职责：回归验证请求没有显式 API key 时，分支摘要仍可使用运行环境的隐式认证。
 * 技术维度：使用 Vitest、Harness、自定义流函数和内存消息树模拟摘要请求。
 * 产品维度：避免云环境角色或其他隐式凭据用户在分支导航时无法生成摘要。
 * 逻辑维度：关闭配置认证，替换流函数确认 apiKey 未定义，构造分支后导航并检查摘要。
 * 关键边界：使用伪流而非真实隐式认证；只验证请求允许缺少显式 key。
 * 新手阅读建议：先看 streamFunction 的 options 断言，再跟踪 targetId 到 summaryEntry。
 */
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { afterEach, describe, expect, it } from "vitest";
import { assistantMsg, userMsg } from "../../utilities.ts";
import { createHarness, type Harness } from "../harness.ts";

/** 第 6324 号问题的分支摘要隐式认证测试组。 */
describe("issue #6324 branch summary ambient auth", () => {
	/** 当前测试组创建的 Harness 集合。 */
	const harnesses: Harness[] = [];

	/** 每例结束后清理所有 Harness。 */
	afterEach(() => {
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
	});

	/** 验证无配置认证时摘要流不收到 apiKey，但导航仍成功。 */
	it("summarizes tree branches when request auth has no API key", async () => {
		/** 禁用配置凭据的测试 Harness。 */
		const harness = await createHarness({ withConfiguredAuth: false });
		harnesses.push(harness);

		/** 摘要流函数被调用的次数。 */
		let streamCallCount = 0;
		/** model 是摘要模型，_context 本例不检查，options 应无显式 apiKey。 */
		harness.session.agent.streamFunction = (model, _context, options) => {
			streamCallCount++;
			expect(options?.apiKey).toBeUndefined();

			/** 立即推送完成消息的可控事件流。 */
			const stream = createAssistantMessageEventStream();
			stream.push({
				type: "done",
				reason: "stop",
				message: {
					role: "assistant",
					content: [{ type: "text", text: "branch summary text" }],
					api: model.api,
					provider: model.provider,
					model: model.id,
					usage: {
						input: 1,
						output: 1,
						cacheRead: 0,
						cacheWrite: 0,
						totalTokens: 2,
						cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.25 },
					},
					stopReason: "stop",
					timestamp: Date.now(),
				},
			});
			return stream;
		};

		/** 分支导航目标的第一条用户消息 ID。 */
		const targetId = harness.sessionManager.appendMessage(userMsg("first branch"));
		harness.sessionManager.appendMessage(assistantMsg("first reply"));
		harness.sessionManager.appendMessage(userMsg("abandoned branch work"));
		harness.sessionManager.appendMessage(assistantMsg("abandoned reply"));

		/** 启用摘要的树导航结果。 */
		const result = await harness.session.navigateTree(targetId, { summarize: true });

		expect(result.cancelled).toBe(false);
		expect(streamCallCount).toBe(1);
		expect(result.summaryEntry?.type).toBe("branch_summary");
		expect(result.summaryEntry?.summary).toContain("branch summary text");
		expect(result.summaryEntry?.usage?.cost.total).toBe(0.25);
	});
});
