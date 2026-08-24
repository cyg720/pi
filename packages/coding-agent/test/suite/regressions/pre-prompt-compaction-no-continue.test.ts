/**
 * 文件职责：回归验证新提示词触发预压缩时不会错误续写上一条因长度停止的助手消息。
 * 技术维度：使用 Vitest、faux 模型测试夹具、会话消息构造和事件监听模拟上下文溢出。
 * 产品维度：保证长会话压缩后用户的新问题被当作独立请求处理，而不是继续旧回答。
 * 逻辑维度：构造满窗口历史，注册压缩摘要扩展，提交新提示词并检查调用与事件结果。
 * 关键边界：使用虚拟提供商且上下文窗口刻意设得很小；测试结束必须清理夹具与模拟函数。
 * 新手阅读建议：先看 createUsage，再按“创建夹具、填充历史、提交提示词、断言事件”阅读。
 */
import { type AssistantMessage, fauxAssistantMessage } from "@earendil-works/pi-ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHarness, getUserTexts, type Harness } from "../harness.ts";

/**
 * 创建指定总令牌数的零成本用量对象。
 * 参数：totalTokens 为输入和总用量，测试中用于制造上下文溢出。
 * 返回值：符合助手消息用量结构的对象。
 * 使用示例：`createUsage(100)`。
 */
function createUsage(totalTokens: number) {
	return {
		input: totalTokens,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
	};
}

describe("pre-prompt compaction regression", () => {
	// 保存本测试组创建的所有夹具，便于 afterEach 统一清理临时资源。
	const harnesses: Harness[] = [];

	// 恢复模拟函数并清理全部夹具；无参数，无返回值。
	afterEach(() => {
		vi.restoreAllMocks();
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
	});

	// 验证溢出压缩后新提示词不会调用 agent.continue；无参数，无返回值。
	it("compacts length-stop overflow before a new prompt without continuing from an assistant message", async () => {
		// harness 提供小上下文窗口、虚拟模型和自定义压缩摘要扩展。
		const harness = await createHarness({
			models: [{ id: "faux-1", contextWindow: 100, maxTokens: 100 }],
			settings: { compaction: { enabled: true, keepRecentTokens: 1, reserveTokens: 0 } },
			extensionFactories: [
				// pi 是扩展 API；回调按压缩准备信息返回固定摘要。
				(pi) => {
					// event 包含本次压缩准备结果，返回值覆盖默认压缩内容。
					pi.on("session_before_compact", async (event) => ({
						compaction: {
							summary: "pre-prompt summary",
							firstKeptEntryId: event.preparation.firstKeptEntryId,
							tokensBefore: event.preparation.tokensBefore,
							details: {},
						},
					}));
				},
			],
		});
		harnesses.push(harness);

		// now 是构造历史消息时间戳的统一基准。
		const now = Date.now();
		// model 是夹具当前使用的虚拟模型配置。
		const model = harness.getModel();
		harness.sessionManager.appendMessage({
			role: "user",
			content: [{ type: "text", text: "previous prompt" }],
			timestamp: now - 1000,
		});
		// lengthStopAssistant 模拟上一条因达到长度上限而停止且占满上下文的助手消息。
		const lengthStopAssistant: AssistantMessage = {
			...fauxAssistantMessage("length-stop assistant response", { stopReason: "length", timestamp: now - 500 }),
			api: model.api,
			provider: model.provider,
			model: model.id,
			usage: createUsage(100),
		};
		harness.sessionManager.appendMessage(lengthStopAssistant);
		harness.session.agent.state.messages = harness.sessionManager.buildSessionContext().messages;
		harness.setResponses([fauxAssistantMessage("answered next prompt")]);
		// continueSpy 监视旧助手消息续写入口，本路径预期不会调用。
		const continueSpy = vi.spyOn(harness.session.agent, "continue");

		await expect(harness.session.prompt("next prompt")).resolves.toBeUndefined();

		expect(continueSpy).not.toHaveBeenCalled();
		expect(harness.eventsOfType("compaction_end").at(-1)).toMatchObject({
			reason: "overflow",
			aborted: false,
			willRetry: true,
		});
		expect(getUserTexts(harness)).toContain("next prompt");
		expect(harness.faux.state.callCount).toBe(1);
	});
});
