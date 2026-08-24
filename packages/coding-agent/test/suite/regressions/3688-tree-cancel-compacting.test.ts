/**
 * 文件职责：回归验证扩展取消会话树导航后，会话不会残留压缩状态且叶节点不变。
 * 技术维度：使用 Vitest、编码代理 Harness、扩展事件钩子和内存会话树消息夹具。
 * 产品维度：防止取消分支切换后界面卡在“压缩中”或意外改变当前对话位置。
 * 逻辑维度：注册取消钩子，构造三条消息树，尝试导航后检查取消结果、状态和叶节点。
 * 关键边界：只覆盖 summarize=false 的取消路径；Harness 必须在用例结束后清理。
 * 新手阅读建议：先画出 first→reply→second 链，再看 targetId 与 currentLeafId 在导航前后的关系。
 */
import { afterEach, describe, expect, it } from "vitest";
import { assistantMsg, userMsg } from "../../utilities.ts";
import { createHarness, type Harness } from "../harness.ts";

/** 第 3688 号问题的树导航取消与压缩状态回归测试组。 */
describe("issue #3688 tree cancellation compaction state", () => {
	/** 当前测试组创建的 Harness 集合，用于统一资源清理。 */
	const harnesses: Harness[] = [];

	/** 用例后逐个清理 Harness，确保会话与扩展监听器不泄漏。 */
	afterEach(() => {
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
	});

	/** 验证 session_before_tree 返回 cancel 后，导航取消且当前叶节点保持不变。 */
	it("clears branch summary state when session_before_tree cancels navigation", async () => {
		/** 安装取消树导航扩展的测试 Harness。 */
		const harness = await createHarness({
			extensionFactories: [
				// pi 是扩展 API；注册钩子后每次树导航前都返回取消结果。
				(pi) => {
					pi.on("session_before_tree", () => ({ cancel: true }));
				},
			],
		});
		harnesses.push(harness);

		/** 树导航想返回的第一条用户消息 ID。 */
		const targetId = harness.sessionManager.appendMessage(userMsg("first"));
		harness.sessionManager.appendMessage(assistantMsg("reply"));
		/** 导航前的当前叶节点 ID，对应第二条用户消息。 */
		const currentLeafId = harness.sessionManager.appendMessage(userMsg("second"));

		expect(harness.sessionManager.getLeafId()).toBe(currentLeafId);

		/** 被扩展取消的导航结果；应明确返回 cancelled=true。 */
		const result = await harness.session.navigateTree(targetId, { summarize: false });

		expect(result).toEqual({ cancelled: true });
		expect(harness.session.isCompacting).toBe(false);
		expect(harness.sessionManager.getLeafId()).toBe(currentLeafId);
	});
});
