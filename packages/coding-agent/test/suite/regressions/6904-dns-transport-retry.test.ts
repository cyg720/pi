/**
 * 文件职责：回归验证第 6904 号问题中的 Bedrock DNS 传输失败会触发自动重试并恢复。
 * 技术维度：使用 Vitest、faux 模型提供方和编码代理测试 Harness 模拟连续响应与事件。
 * 产品维度：避免短暂 DNS 故障直接中断用户任务，并确保重试状态可被界面正确感知。
 * 逻辑维度：配置快速重试，先返回 DNS 错误再返回成功消息，最后检查调用次数及开始/结束事件。
 * 关键边界：使用伪提供方而非真实 DNS；错误识别依赖消息形态，测试不覆盖所有网络故障。
 * 新手阅读建议：先看两条 setResponses 的先后顺序，再对照 callCount 和两个重试事件断言。
 */
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import { createHarness } from "../harness.ts";

/** 模拟 undici 包装后的 Bedrock DNS 查询错误文本；用于触发可重试传输错误分类。 */
const wrappedDnsLookupError =
	"The pending stream has been canceled (caused by: getaddrinfo ENOTFOUND bedrock-runtime.us-east-1.amazonaws.com)";

/** 第 6904 号问题的 DNS 重试回归测试组。 */
describe("issue #6904 DNS transport failure retry", () => {
	/** 验证一次临时 DNS 失败后进行第二次调用，并分别发出开始和成功结束事件。 */
	it("retries a transient DNS lookup failure", async () => {
		/** 启用重试的测试 Harness；最多三次重试且基础延迟为 1 毫秒，使测试快速完成。 */
		const harness = await createHarness({ settings: { retry: { enabled: true, maxRetries: 3, baseDelayMs: 1 } } });
		try {
			harness.setResponses([
				fauxAssistantMessage("", { stopReason: "error", errorMessage: wrappedDnsLookupError }),
				fauxAssistantMessage("recovered after DNS retry"),
			]);

			await harness.session.prompt("test");

			expect(harness.faux.state.callCount).toBe(2);
			// event 是一次自动重试开始事件；映射后只比较其错误消息。
			expect(harness.eventsOfType("auto_retry_start").map((event) => event.errorMessage)).toEqual([
				wrappedDnsLookupError,
			]);
			// event 是一次自动重试结束事件；映射后确认该次重试最终成功。
			expect(harness.eventsOfType("auto_retry_end").map((event) => event.success)).toEqual([true]);
		} finally {
			harness.cleanup();
		}
	});
});
