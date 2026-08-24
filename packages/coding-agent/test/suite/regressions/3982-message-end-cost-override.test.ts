/**
 * 文件职责：回归验证扩展可在 message_end 阶段替换最终助手消息的费用。
 * 技术维度：使用 Vitest、faux 模型、编码代理 Harness 和扩展事件钩子。
 * 产品维度：允许企业网关或自定义计费扩展纠正会话中展示和累计的模型成本。
 * 逻辑维度：注册费用覆盖钩子，生成助手响应，再同时检查会话消息与事件中的费用。
 * 关键边界：只修改助手消息，固定覆盖 total 为 0.123；Harness 必须在用例后清理。
 * 新手阅读建议：先看 message_end 返回的新 message，再比较两个位置的最终费用断言。
 */
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { afterEach, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "../harness.ts";

/** 第 3982 号问题的消息结束费用覆盖测试组。 */
describe("regression #3982: message_end cost override", () => {
	/** 当前测试组创建的 Harness 集合。 */
	const harnesses: Harness[] = [];

	/** 每例结束后清理所有 Harness 资源。 */
	afterEach(() => {
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
	});

	/** 验证钩子修改后的费用同时进入会话消息和 message_end 事件记录。 */
	it("allows extensions to replace finalized assistant usage cost", async () => {
		/** 注册 message_end 费用覆盖钩子的测试 Harness。 */
		const harness = await createHarness({
			extensionFactories: [
				// pi 是扩展 API，用于注册消息结束事件。
				(pi) => {
					// event 包含最终消息；非助手消息不参与本次覆盖。
					pi.on("message_end", (event) => {
						if (event.message.role !== "assistant") return;

						return {
							message: {
								...event.message,
								usage: {
									...event.message.usage,
									cost: {
										...event.message.usage.cost,
										total: 0.123,
									},
								},
							},
						};
					});
				},
			],
		});
		harnesses.push(harness);
		harness.setResponses([fauxAssistantMessage("hello")]);

		await harness.session.prompt("hi");

		/** 会话中找到的最终助手消息。 */
		const assistantMessage = harness.session.messages.find((message) => message.role === "assistant");
		expect(assistantMessage?.role).toBe("assistant");
		if (assistantMessage?.role !== "assistant") {
			throw new Error("missing assistant message");
		}
		expect(assistantMessage.usage.cost.total).toBe(0.123);

		/** 事件日志中对应助手消息的 message_end 事件。 */
		const messageEnd = harness.eventsOfType("message_end").find((event) => event.message.role === "assistant");
		expect(messageEnd?.message.role).toBe("assistant");
		if (messageEnd?.message.role !== "assistant") {
			throw new Error("missing assistant message_end event");
		}
		expect(messageEnd.message.usage.cost.total).toBe(0.123);
	});
});
