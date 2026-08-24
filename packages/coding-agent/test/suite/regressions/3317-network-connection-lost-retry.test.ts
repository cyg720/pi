/**
 * 文件职责：回归验证“Network connection lost.”临时错误会触发重试并保留恢复后的助手文本。
 * 技术维度：使用 Vitest、faux 响应、Harness 集合和 afterEach 统一清理异步测试资源。
 * 产品维度：网络短暂断开时自动继续用户任务，并让界面正确显示重试状态和最终回答。
 * 逻辑维度：创建快速重试 Harness，依次返回错误与成功，检查调用、事件和助手文本。
 * 关键边界：只模拟固定错误文本，不建立真实连接；所有 Harness 必须在用例后清理。
 * 新手阅读建议：先看 setResponses 的两个阶段，再对照重试事件与 recovered 文本断言。
 */
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { afterEach, describe, expect, it } from "vitest";
import { createHarness, getAssistantTexts, type Harness } from "../harness.ts";

/** 第 3317 号问题的网络断线重试回归测试组。 */
describe("issue #3317 network connection lost retry", () => {
	/** 当前测试组创建且待清理的 Harness；数组应在 afterEach 结束后为空。 */
	const harnesses: Harness[] = [];

	/** 每个用例后清理所有 Harness，避免会话、临时目录或监听器泄漏。 */
	afterEach(() => {
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
	});

	/** 验证固定断线错误只导致一次重试，第二次响应成功并进入会话文本。 */
	it('retries transient "Network connection lost." failures', async () => {
		/** 启用快速重试的测试 Harness；基础延迟仅 1 毫秒。 */
		const harness = await createHarness({
			settings: { retry: { enabled: true, maxRetries: 3, baseDelayMs: 1 } },
		});
		harnesses.push(harness);
		harness.setResponses([
			fauxAssistantMessage("", { stopReason: "error", errorMessage: "Network connection lost." }),
			fauxAssistantMessage("recovered after reconnect"),
		]);

		await harness.session.prompt("test");

		expect(harness.faux.state.callCount).toBe(2);
		// event 是自动重试开始事件；映射后核对触发错误文本。
		expect(harness.eventsOfType("auto_retry_start").map((event) => event.errorMessage)).toEqual([
			"Network connection lost.",
		]);
		// event 是自动重试结束事件；本例只应有一个成功事件。
		expect(harness.eventsOfType("auto_retry_end").map((event) => event.success)).toEqual([true]);
		expect(getAssistantTexts(harness)).toContain("recovered after reconnect");
	});
});
