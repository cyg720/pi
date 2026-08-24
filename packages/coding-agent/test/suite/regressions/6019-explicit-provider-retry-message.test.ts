/**
 * 文件职责：回归验证提供方明确提示“可重试”的错误消息会触发编码代理自动重试。
 * 技术维度：使用 Vitest 参数化测试、faux 提供方与测试 Harness 模拟 OpenAI 和 Bedrock 响应。
 * 产品维度：在提供方临时内部错误时自动恢复任务，避免用户手工重复提交。
 * 逻辑维度：准备两类错误文本，依次返回错误与成功响应，然后检查调用次数和重试事件。
 * 关键边界：分类依赖提供方错误文本特征；使用伪响应，不覆盖真实网络传输。
 * 新手阅读建议：先对比两条错误文本，再沿 setResponses、prompt、事件断言阅读重试生命周期。
 */
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import { createHarness } from "../harness.ts";

/** OpenAI 明确建议重试的标准错误文本样本；请求 ID 已脱敏。 */
const openAIExplicitRetryMessage =
	"An error occurred while processing your request. You can retry your request, or contact us through our help center at help.openai.com if the error persists. Please include the request ID req_******** in your message.";
/** Bedrock 以 JSON 文本返回的明确重试提示样本。 */
const bedrockExplicitRetryMessage =
	'{"message":"The system encountered an unexpected error during processing. Try your request again."}';

/** 第 6019 号问题的显式提供方重试消息测试组。 */
describe("regression: issue 6019 explicit provider retry messages", () => {
	/** _provider 仅用于用例名称，errorMessage 是当前提供方的受测错误文本。 */
	it.each([
		["openai", openAIExplicitRetryMessage],
		["bedrock", bedrockExplicitRetryMessage],
	])("retries %s explicit retry guidance", async (_provider, errorMessage) => {
		/** 开启快速自动重试的 Harness；最多三次，基础延迟为 1 毫秒。 */
		const harness = await createHarness({ settings: { retry: { enabled: true, maxRetries: 3, baseDelayMs: 1 } } });
		try {
			harness.setResponses([
				fauxAssistantMessage("", { stopReason: "error", errorMessage }),
				fauxAssistantMessage("recovered"),
			]);

			await harness.session.prompt("test");

			expect(harness.faux.state.callCount).toBe(2);
			// event 是重试开始事件；这里只提取触发重试的错误消息。
			expect(harness.eventsOfType("auto_retry_start").map((event) => event.errorMessage)).toEqual([errorMessage]);
			// event 是重试结束事件；成功字段应表明第二次响应已恢复。
			expect(harness.eventsOfType("auto_retry_end").map((event) => event.success)).toEqual([true]);
		} finally {
			harness.cleanup();
		}
	});
});
