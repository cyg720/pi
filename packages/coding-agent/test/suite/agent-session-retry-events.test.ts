import type { AgentTool } from "@earendil-works/pi-agent-core";
import { fauxAssistantMessage, fauxThinking, fauxToolCall } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { afterEach, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./harness.ts";

/** 把详细事件转换为可稳定比较的标签，并合并连续 message_update。返回顺序数组。示例：normalizeEventOrder(harness.events)。 */
function normalizeEventOrder(events: Harness["events"]): string[] {
	/** 规范化后的事件标签列表。 */
	const normalized: string[] = [];
	for (const event of events) {
		/** 当前事件带角色或工具名的可读标签。 */
		const label =
			event.type === "message_start" || event.type === "message_end"
				? `${event.type}:${event.message.role}`
				: event.type === "tool_execution_start" || event.type === "tool_execution_end"
					? `${event.type}:${event.toolName}`
					: event.type;
		if (label === "message_update" && normalized[normalized.length - 1] === "message_update") {
			continue;
		}
		normalized.push(label);
	}
	return normalized;
}

describe("AgentSession retry and event characterization", () => {
	/** 当前文件创建且需在 afterEach 中清理的 Harness。 */
	const harnesses: Harness[] = [];

	/** 每个用例结束后清理全部 Harness。 */
	afterEach(() => {
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
	});

	/** 验证一次瞬时错误后重试成功并发出正确事件。 */
	it("retries after a transient error and succeeds", async () => {
		/** 启用快速重试的测试工具箱。 */
		const harness = await createHarness({ settings: { retry: { enabled: true, maxRetries: 3, baseDelayMs: 1 } } });
		harnesses.push(harness);
		/** 重试开始和结束事件的简化记录。 */
		const retryEvents: string[] = [];
		harness.session.subscribe((event) => {
			if (event.type === "auto_retry_start") retryEvents.push(`start:${event.attempt}`);
			if (event.type === "auto_retry_end") retryEvents.push(`end:${event.success}`);
		});

		harness.setResponses([
			fauxAssistantMessage("", { stopReason: "error", errorMessage: "overloaded_error" }),
			fauxAssistantMessage("recovered"),
		]);

		await harness.session.prompt("test");

		expect(retryEvents).toEqual(["start:1", "end:true"]);
		expect(harness.eventsOfType("agent_end").map((event) => event.willRetry)).toEqual([true, false]);
		expect(harness.faux.state.callCount).toBe(2);
		expect(harness.session.isRetrying).toBe(false);
	});

	/** 验证连续两次瞬时失败后最后一次尝试成功。 */
	it("retries multiple transient failures and succeeds on the final attempt", async () => {
		/** 允许三次重试的测试工具箱。 */
		const harness = await createHarness({ settings: { retry: { enabled: true, maxRetries: 3, baseDelayMs: 1 } } });
		harnesses.push(harness);
		/** 重试开始和结束事件的简化记录。 */
		const retryEvents: string[] = [];
		harness.session.subscribe((event) => {
			if (event.type === "auto_retry_start") retryEvents.push(`start:${event.attempt}`);
			if (event.type === "auto_retry_end") retryEvents.push(`end:${event.success}`);
		});

		harness.setResponses([
			fauxAssistantMessage("", { stopReason: "error", errorMessage: "overloaded_error" }),
			fauxAssistantMessage("", { stopReason: "error", errorMessage: "overloaded_error" }),
			fauxAssistantMessage("success"),
		]);

		await harness.session.prompt("test");

		expect(retryEvents).toEqual(["start:1", "start:2", "end:true"]);
		expect(harness.faux.state.callCount).toBe(3);
	});

	/** 验证耗尽最大重试次数后发出失败事件。 */
	it("exhausts max retries and emits a failure event", async () => {
		/** 最多重试两次的测试工具箱。 */
		const harness = await createHarness({ settings: { retry: { enabled: true, maxRetries: 2, baseDelayMs: 1 } } });
		harnesses.push(harness);
		/** 重试开始和结束事件的简化记录。 */
		const retryEvents: string[] = [];
		harness.session.subscribe((event) => {
			if (event.type === "auto_retry_start") retryEvents.push(`start:${event.attempt}`);
			if (event.type === "auto_retry_end") retryEvents.push(`end:${event.success}`);
		});

		harness.setResponses([
			fauxAssistantMessage("", { stopReason: "error", errorMessage: "overloaded_error" }),
			fauxAssistantMessage("", { stopReason: "error", errorMessage: "overloaded_error" }),
			fauxAssistantMessage("", { stopReason: "error", errorMessage: "overloaded_error" }),
		]);

		await harness.session.prompt("test");

		expect(retryEvents).toEqual(["start:1", "start:2", "end:false"]);
		expect(harness.eventsOfType("agent_end").map((event) => event.willRetry)).toEqual([true, true, false]);
		expect(harness.faux.state.callCount).toBe(3);
		expect(harness.session.isRetrying).toBe(false);
	});

	/** 验证扩展延迟处理助手 message_end 时 prompt 仍等待重试完成。 */
	it("prompt waits for retry completion even when assistant message_end handling is delayed", async () => {
		/** 带 40ms message_end 扩展延迟的 Harness。 */
		const harness = await createHarness({
			settings: { retry: { enabled: true, maxRetries: 3, baseDelayMs: 1 } },
			extensionFactories: [
				(pi) => {
					pi.on("message_end", async (event) => {
						if (event.message.role === "assistant") {
							await new Promise((resolve) => setTimeout(resolve, 40));
						}
					});
				},
			],
		});
		harnesses.push(harness);
		harness.setResponses([
			fauxAssistantMessage("", { stopReason: "error", errorMessage: "overloaded_error" }),
			fauxAssistantMessage("recovered"),
		]);

		await harness.session.prompt("test");

		expect(harness.faux.state.callCount).toBe(2);
		expect(harness.session.isRetrying).toBe(false);
	});

	/** 验证关闭重试设置后瞬时错误只调用一次模型。 */
	it("does not retry when retry is disabled", async () => {
		/** 显式关闭重试的 Harness。 */
		const harness = await createHarness({ settings: { retry: { enabled: false } } });
		harnesses.push(harness);
		harness.setResponses([fauxAssistantMessage("", { stopReason: "error", errorMessage: "overloaded_error" })]);

		await harness.session.prompt("test");

		expect(harness.faux.state.callCount).toBe(1);
		expect(harness.eventsOfType("auto_retry_start")).toEqual([]);
	});

	/** 验证不可重试的认证错误不会触发自动重试。 */
	it("does not retry non-retryable errors", async () => {
		/** 启用重试但将收到 invalid_api_key 的 Harness。 */
		const harness = await createHarness({ settings: { retry: { enabled: true, maxRetries: 3, baseDelayMs: 1 } } });
		harnesses.push(harness);
		harness.setResponses([fauxAssistantMessage("", { stopReason: "error", errorMessage: "invalid_api_key" })]);

		await harness.session.prompt("test");

		expect(harness.faux.state.callCount).toBe(1);
		expect(harness.eventsOfType("auto_retry_start")).toEqual([]);
	});

	/** 验证 abortRetry 可取消重试等待并结束 prompt。 */
	it("cancels retry sleep when abortRetry is called", async () => {
		/** 使用较长退避以留出取消窗口的 Harness。 */
		const harness = await createHarness({ settings: { retry: { enabled: true, maxRetries: 3, baseDelayMs: 100 } } });
		harnesses.push(harness);
		harness.setResponses([fauxAssistantMessage("", { stopReason: "error", errorMessage: "overloaded_error" })]);

		/** 在首次 auto_retry_start 时完成的同步 Promise。 */
		const sawRetryStart = new Promise<void>((resolve) => {
			/** 首次重试开始后立即移除的事件订阅。 */
			const unsubscribe = harness.session.subscribe((event) => {
				if (event.type === "auto_retry_start") {
					unsubscribe();
					resolve();
				}
			});
		});

		/** 正在等待重试的 prompt Promise。 */
		const promptPromise = harness.session.prompt("test");
		await sawRetryStart;
		harness.session.abortRetry();
		await promptPromise;

		expect(harness.session.isRetrying).toBe(false);
		expect(harness.eventsOfType("auto_retry_end").map((event) => event.finalError)).toContain("Retry cancelled");
		expect(harness.faux.state.callCount).toBe(1);
	});

	/** 验证重试恢复产生工具调用时等待整个工具循环。 */
	it("waits for the full loop when retry recovery produces tool calls", async () => {
		/** echo 工具实际收到的文本。 */
		const toolRuns: string[] = [];
		/** 返回 echo 文本的测试工具。 */
		const echoTool: AgentTool = {
			name: "echo",
			label: "Echo",
			description: "Echo text back",
			parameters: Type.Object({ text: Type.String() }),
			execute: async (_toolCallId, params) => {
				/** 从未知参数中安全读取的 text。 */
				const text = typeof params === "object" && params !== null && "text" in params ? String(params.text) : "";
				toolRuns.push(text);
				return { content: [{ type: "text", text: `echo:${text}` }], details: { text } };
			},
		};
		/** 启用工具与快速重试的 Harness。 */
		const harness = await createHarness({
			tools: [echoTool],
			settings: { retry: { enabled: true, maxRetries: 3, baseDelayMs: 1 } },
		});
		harnesses.push(harness);
		harness.setResponses([
			fauxAssistantMessage("", { stopReason: "error", errorMessage: "overloaded_error" }),
			fauxAssistantMessage([fauxToolCall("echo", { text: "hello" })], { stopReason: "toolUse" }),
			fauxAssistantMessage("final answer"),
		]);

		await harness.session.prompt("test");

		expect(harness.faux.state.callCount).toBe(3);
		expect(toolRuns).toEqual(["hello"]);
		expect(harness.session.isStreaming).toBe(false);
		await harness.session.prompt("follow-up");
		expect(harness.faux.state.callCount).toBe(4);
	});

	/** 验证扩展事件处理完成后才通知公共订阅者。 */
	it("emits extension events before public event subscribers", async () => {
		/** 扩展与公共事件的实际触发顺序。 */
		const order: string[] = [];
		/** 注册 message_start/message_end 扩展监听器的 Harness。 */
		const harness = await createHarness({
			extensionFactories: [
				(pi) => {
					pi.on("message_start", async (event) => {
						order.push(`extension:${event.type}:${event.message.role}`);
					});
					pi.on("message_end", async (event) => {
						order.push(`extension:${event.type}:${event.message.role}`);
					});
				},
			],
		});
		harnesses.push(harness);
		harness.session.subscribe((event) => {
			if (event.type === "message_start" || event.type === "message_end") {
				order.push(`public:${event.type}:${event.message.role}`);
			}
		});
		harness.setResponses([fauxAssistantMessage("done")]);

		await harness.session.prompt("hi");

		expect(order).toEqual([
			"extension:message_start:user",
			"public:message_start:user",
			"extension:message_end:user",
			"public:message_end:user",
			"extension:message_start:assistant",
			"public:message_start:assistant",
			"extension:message_end:assistant",
			"public:message_end:assistant",
		]);
	});

	/** 验证无工具单轮 prompt 的完整事件顺序。 */
	it("emits the expected event order for a single prompt", async () => {
		/** 使用默认配置的 Harness。 */
		const harness = await createHarness();
		harnesses.push(harness);
		harness.setResponses([fauxAssistantMessage("hello")]);

		await harness.session.prompt("hi");

		expect(normalizeEventOrder(harness.events)).toEqual([
			"agent_start",
			"turn_start",
			"message_start:user",
			"message_end:user",
			"message_start:assistant",
			"message_update",
			"message_end:assistant",
			"turn_end",
			"agent_end",
			"agent_settled",
		]);
	});

	/** 验证含工具调用的两轮 Agent 循环事件顺序。 */
	it("emits the expected event order for a tool call turn", async () => {
		/** echo 工具实际收到的文本。 */
		const toolRuns: string[] = [];
		/** 返回 echo 文本的测试工具。 */
		const echoTool: AgentTool = {
			name: "echo",
			label: "Echo",
			description: "Echo text back",
			parameters: Type.Object({ text: Type.String() }),
			execute: async (_toolCallId, params) => {
				/** 从未知参数中安全读取的 text。 */
				const text = typeof params === "object" && params !== null && "text" in params ? String(params.text) : "";
				toolRuns.push(text);
				return { content: [{ type: "text", text: `echo:${text}` }], details: { text } };
			},
		};
		/** 只注册 echo 工具的 Harness。 */
		const harness = await createHarness({ tools: [echoTool] });
		harnesses.push(harness);
		harness.setResponses([
			fauxAssistantMessage([fauxToolCall("echo", { text: "hello" })], { stopReason: "toolUse" }),
			fauxAssistantMessage("done"),
		]);

		await harness.session.prompt("hi");

		expect(toolRuns).toEqual(["hello"]);
		expect(normalizeEventOrder(harness.events)).toEqual([
			"agent_start",
			"turn_start",
			"message_start:user",
			"message_end:user",
			"message_start:assistant",
			"message_update",
			"message_end:assistant",
			"tool_execution_start:echo",
			"tool_execution_end:echo",
			"message_start:toolResult",
			"message_end:toolResult",
			"turn_end",
			"turn_start",
			"message_start:assistant",
			"message_update",
			"message_end:assistant",
			"turn_end",
			"agent_end",
			"agent_settled",
		]);
	});

	/** 验证思考、文本与工具参数都产生对应 message_update 增量。 */
	it("emits streaming deltas for text, thinking, and tool calls in message_update events", async () => {
		/** 使用默认配置的 Harness。 */
		const harness = await createHarness();
		harnesses.push(harness);
		harness.setResponses([
			fauxAssistantMessage(
				[fauxThinking("plan"), { type: "text", text: "answer" }, fauxToolCall("echo", { text: "hello" })],
				{
					stopReason: "toolUse",
				},
			),
		]);

		await harness.session.prompt("hi").catch(() => {});

		/** 全部 message_update 中的具体助手事件类型。 */
		const updateTypes = harness.eventsOfType("message_update").map((event) => event.assistantMessageEvent.type);
		expect(updateTypes).toContain("thinking_delta");
		expect(updateTypes).toContain("text_delta");
		expect(updateTypes).toContain("toolcall_delta");
	});

	/** 验证错误响应仍产生一次 agent_end，最后进入 agent_settled。 */
	it("emits agent_end for error responses", async () => {
		/** 使用默认配置的 Harness。 */
		const harness = await createHarness();
		harnesses.push(harness);
		harness.setResponses([fauxAssistantMessage("", { stopReason: "error", errorMessage: "broken" })]);

		await harness.session.prompt("hi");

		expect(harness.eventsOfType("agent_end")).toHaveLength(1);
		expect(harness.events[harness.events.length - 1]?.type).toBe("agent_settled");
	});

	/** 验证中止运行也产生 agent_end，并持久化 aborted 助手消息。 */
	it("emits agent_end for aborted runs and persists the aborted assistant message", async () => {
		/** 返回超长文本以留出中止窗口的 Harness。 */
		const harness = await createHarness();
		harnesses.push(harness);
		harness.setResponses([fauxAssistantMessage("x".repeat(20_000))]);

		/** 在首次 message_update 时完成的同步 Promise。 */
		const sawMessageUpdate = new Promise<void>((resolve) => {
			/** 首次更新后立即移除的事件订阅。 */
			const unsubscribe = harness.session.subscribe((event) => {
				if (event.type === "message_update") {
					unsubscribe();
					resolve();
				}
			});
		});

		/** 尚在流式输出的 prompt Promise。 */
		const promptPromise = harness.session.prompt("hi");
		await sawMessageUpdate;
		await harness.session.abort();
		await promptPromise;

		expect(harness.eventsOfType("agent_end")).toHaveLength(1);
		expect(harness.events[harness.events.length - 1]?.type).toBe("agent_settled");
		/** 中止后会话中的最后一条消息。 */
		const lastMessage = harness.session.messages[harness.session.messages.length - 1];
		expect(lastMessage?.role).toBe("assistant");
		if (lastMessage?.role === "assistant") {
			expect(lastMessage.stopReason).toBe("aborted");
		}
	});
});
/**
 * 文件职责：使用伪提供商刻画 AgentSession 的自动重试、工具循环和公共/扩展事件顺序。
 * 技术维度：基于 Harness、确定性 faux 消息、TypeBox 工具和事件订阅执行无真实网络的行为回归测试。
 * 产品维度：保障重试不会漏发或乱序事件，调用方可稳定驱动 UI、扩展和后续 prompt。
 * 逻辑维度：先规范化高频 message_update，再覆盖重试成功/失败/取消、工具恢复、事件优先级、流式增量和中止持久化。
 * 关键边界：每个 Harness 必须 cleanup；重试延迟缩短用于测试；连续 message_update 会合并为一个顺序标记。
 * 新手阅读建议：先看 normalizeEventOrder，再读前三个重试场景，随后比较单轮和工具轮事件序列，最后看中止用例。
 */
