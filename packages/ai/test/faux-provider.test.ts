/**
 * 文件职责：验证 faux 测试提供商的注册、响应队列、模型覆盖、用量与缓存模拟、流事件和中止行为。
 * 技术维度：使用 Vitest、统一 complete/stream 接口、伪消息内容块、可控分块速率与 AbortController。
 * 产品维度：为代理和模型功能测试提供零网络、零费用且可重复的模型替身，避免测试依赖真实服务。
 * 逻辑维度：先覆盖注册与响应工厂，再验证用量和会话缓存，最后检查精确流事件、错误和三类中途中止。
 * 关键边界：注册项必须在 afterEach 注销，响应队列按顺序消费；固定 tokenSize 用例依赖确定事件顺序。
 * 新手阅读建议：先读 collectEvents 和首个注册用例，再看响应队列与缓存，最后阅读流式分块和 AbortController。
 */

import { afterEach, describe, expect, it } from "vitest";
import {
	complete,
	fauxAssistantMessage,
	fauxText,
	fauxThinking,
	fauxToolCall,
	registerFauxProvider,
	stream,
	Type,
} from "../src/compat.ts";
import type { AssistantMessageEvent, Context } from "../src/types.ts";

/** 消费模型流并收集全部事件。参数 streamResult 为 stream 返回值；返回 AssistantMessageEvent 数组。例如：await collectEvents(stream(model, context))。 */
async function collectEvents(streamResult: ReturnType<typeof stream>): Promise<AssistantMessageEvent[]> {
	/** 变量 events：当前模型流产生的事件数组或事件类型数组；仅在当前模块、函数或测试中有效。 */
	const events: AssistantMessageEvent[] = [];
	for await (const event of streamResult) {
		/** 循环变量 event：当前从 faux 流读取的事件。 */
		events.push(event);
	}
	return events;
}

/** 变量 registrations：本测试文件创建且待 afterEach 注销的 faux 注册项；仅在当前模块、函数或测试中有效。 */
const registrations: Array<{ unregister: () => void }> = [];

afterEach(() => {
	for (const registration of registrations.splice(0)) {
		/** 循环变量 registration：当前需要注销的 faux 提供商注册项。 */
		registration.unregister();
	}
});

/** 测试分组：faux 提供商的同步完成与流式行为。 */
describe("faux provider", () => {
	/** 测试场景：验证当前注册、队列、缓存、流事件或中止语义。 */
	it("registers a custom provider and estimates usage", async () => {
		/** 变量 registration：当前场景创建的 faux 提供商注册句柄；仅在当前模块、函数或测试中有效。 */
		const registration = registerFauxProvider();
		registrations.push(registration);
		registration.setResponses([fauxAssistantMessage("hello world")]);

		/** 变量 context：当前请求使用的最小消息上下文；仅在当前模块、函数或测试中有效。 */
		const context: Context = {
			systemPrompt: "Be concise.",
			messages: [{ role: "user", content: "hi there", timestamp: Date.now() }],
		};

		/** 变量 response：complete 返回的助手消息；仅在当前模块、函数或测试中有效。 */
		const response = await complete(registration.getModel(), context);
		expect(response.content).toEqual([{ type: "text", text: "hello world" }]);
		expect(response.usage.input).toBeGreaterThan(0);
		expect(response.usage.output).toBeGreaterThan(0);
		expect(response.usage.totalTokens).toBe(response.usage.input + response.usage.output);
		expect(registration.state.callCount).toBe(1);
	});

	/** 测试场景：验证当前注册、队列、缓存、流事件或中止语义。 */
	it("supports helper blocks for text, thinking, and tool calls", async () => {
		/** 变量 registration：当前场景创建的 faux 提供商注册句柄；仅在当前模块、函数或测试中有效。 */
		const registration = registerFauxProvider();
		registrations.push(registration);
		registration.setResponses([
			fauxAssistantMessage([fauxThinking("think"), fauxToolCall("echo", { text: "hi" }), fauxText("done")], {
				stopReason: "toolUse",
			}),
		]);

		/** 变量 response：complete 返回的助手消息；仅在当前模块、函数或测试中有效。 */
		const response = await complete(registration.getModel(), {
			messages: [{ role: "user", content: "hi", timestamp: Date.now() }],
		});

		expect(response.content).toEqual([
			{ type: "thinking", thinking: "think" },
			{ type: "toolCall", id: expect.any(String), name: "echo", arguments: { text: "hi" } },
			{ type: "text", text: "done" },
		]);
		expect(response.stopReason).toBe("toolUse");
	});

	/** 测试场景：验证当前注册、队列、缓存、流事件或中止语义。 */
	it("supports multiple models with per-model reasoning and model-aware factories", async () => {
		/** 变量 registration：当前场景创建的 faux 提供商注册句柄；仅在当前模块、函数或测试中有效。 */
		const registration = registerFauxProvider({
			models: [
				{ id: "faux-fast", name: "Faux Fast", reasoning: false },
				{ id: "faux-thinker", name: "Faux Thinker", reasoning: true },
			],
		});
		registrations.push(registration);
		registration.setResponses([
			(_context, _options, _state, model) => fauxAssistantMessage(`${model.id}:${String(model.reasoning)}`),
			(_context, _options, _state, model) => fauxAssistantMessage(`${model.id}:${String(model.reasoning)}`),
		]);

		expect(registration.models.map((model) => model.id)).toEqual(["faux-fast", "faux-thinker"]);
		expect(registration.getModel()).toBe(registration.models[0]);
		expect(registration.getModel("faux-fast")?.reasoning).toBe(false);
		expect(registration.getModel("faux-thinker")?.reasoning).toBe(true);

		/** 变量 fast：faux-fast 模型返回的响应；仅在当前模块、函数或测试中有效。 */
		const fast = await complete(registration.getModel("faux-fast")!, {
			messages: [{ role: "user", content: "hi", timestamp: Date.now() }],
		});
		/** 变量 thinker：faux-thinker 模型返回的响应；仅在当前模块、函数或测试中有效。 */
		const thinker = await complete(registration.getModel("faux-thinker")!, {
			messages: [{ role: "user", content: "hi", timestamp: Date.now() }],
		});

		expect(fast.content).toEqual([{ type: "text", text: "faux-fast:false" }]);
		expect(thinker.content).toEqual([{ type: "text", text: "faux-thinker:true" }]);
	});

	/** 测试场景：验证当前注册、队列、缓存、流事件或中止语义。 */
	it("rewrites api, provider, and model on returned messages", async () => {
		/** 变量 registration：当前场景创建的 faux 提供商注册句柄；仅在当前模块、函数或测试中有效。 */
		const registration = registerFauxProvider({
			api: "faux:test",
			provider: "faux-provider",
			models: [{ id: "faux-model" }],
		});
		registrations.push(registration);
		registration.setResponses([fauxAssistantMessage("hello")]);

		/** 变量 response：complete 返回的助手消息；仅在当前模块、函数或测试中有效。 */
		const response = await complete(registration.getModel(), {
			messages: [{ role: "user", content: "hi", timestamp: Date.now() }],
		});

		expect(response.api).toBe("faux:test");
		expect(response.provider).toBe("faux-provider");
		expect(response.model).toBe("faux-model");
	});

	/** 测试场景：验证当前注册、队列、缓存、流事件或中止语义。 */
	it("consumes queued responses in order and errors when exhausted", async () => {
		/** 变量 registration：当前场景创建的 faux 提供商注册句柄；仅在当前模块、函数或测试中有效。 */
		const registration = registerFauxProvider();
		registrations.push(registration);
		registration.setResponses([fauxAssistantMessage("first"), fauxAssistantMessage("second")]);

		/** 变量 context：当前请求使用的最小消息上下文；仅在当前模块、函数或测试中有效。 */
		const context: Context = {
			messages: [{ role: "user", content: "hi", timestamp: Date.now() }],
		};

		/** 变量 first：响应队列中的第一次调用结果；仅在当前模块、函数或测试中有效。 */
		const first = await complete(registration.getModel(), context);
		/** 变量 second：响应队列中的第二次调用结果；仅在当前模块、函数或测试中有效。 */
		const second = await complete(registration.getModel(), context);
		/** 变量 exhausted：响应队列耗尽后的错误结果；仅在当前模块、函数或测试中有效。 */
		const exhausted = await complete(registration.getModel(), context);

		expect(first.content).toEqual([{ type: "text", text: "first" }]);
		expect(second.content).toEqual([{ type: "text", text: "second" }]);
		expect(exhausted.stopReason).toBe("error");
		expect(exhausted.errorMessage).toBe("No more faux responses queued");
		expect(registration.getPendingResponseCount()).toBe(0);
		expect(registration.state.callCount).toBe(3);
	});

	/** 测试场景：验证当前注册、队列、缓存、流事件或中止语义。 */
	it("can replace and append queued responses", async () => {
		/** 变量 registration：当前场景创建的 faux 提供商注册句柄；仅在当前模块、函数或测试中有效。 */
		const registration = registerFauxProvider();
		registrations.push(registration);
		registration.setResponses([fauxAssistantMessage("first")]);

		/** 变量 context：当前请求使用的最小消息上下文；仅在当前模块、函数或测试中有效。 */
		const context: Context = {
			messages: [{ role: "user", content: "hi", timestamp: Date.now() }],
		};

		expect((await complete(registration.getModel(), context)).content).toEqual([{ type: "text", text: "first" }]);
		expect(registration.getPendingResponseCount()).toBe(0);

		registration.setResponses([fauxAssistantMessage("second")]);
		expect(registration.getPendingResponseCount()).toBe(1);
		expect((await complete(registration.getModel(), context)).content).toEqual([{ type: "text", text: "second" }]);

		registration.appendResponses([fauxAssistantMessage("third"), fauxAssistantMessage("fourth")]);
		expect(registration.getPendingResponseCount()).toBe(2);
		expect((await complete(registration.getModel(), context)).content).toEqual([{ type: "text", text: "third" }]);
		expect((await complete(registration.getModel(), context)).content).toEqual([{ type: "text", text: "fourth" }]);
		expect(registration.getPendingResponseCount()).toBe(0);
	});

	/** 测试场景：验证当前注册、队列、缓存、流事件或中止语义。 */
	it("supports async response factories", async () => {
		/** 变量 registration：当前场景创建的 faux 提供商注册句柄；仅在当前模块、函数或测试中有效。 */
		const registration = registerFauxProvider();
		registrations.push(registration);
		registration.setResponses([
			async (context, _options, state) => fauxAssistantMessage(`${context.messages.length}:${state.callCount}`),
		]);

		/** 变量 response：complete 返回的助手消息；仅在当前模块、函数或测试中有效。 */
		const response = await complete(registration.getModel(), {
			messages: [{ role: "user", content: "hi", timestamp: Date.now() }],
		});

		expect(response.content).toEqual([{ type: "text", text: "1:1" }]);
	});

	/** 测试场景：验证当前注册、队列、缓存、流事件或中止语义。 */
	it("emits an error when a response factory throws", async () => {
		/** 变量 registration：当前场景创建的 faux 提供商注册句柄；仅在当前模块、函数或测试中有效。 */
		const registration = registerFauxProvider();
		registrations.push(registration);
		registration.setResponses([
			() => {
				throw new Error("boom");
			},
		]);

		/** 变量 events：当前模型流产生的事件数组或事件类型数组；仅在当前模块、函数或测试中有效。 */
		const events = await collectEvents(
			stream(registration.getModel(), { messages: [{ role: "user", content: "hi", timestamp: Date.now() }] }),
		);

		expect(events).toHaveLength(1);
		expect(events[0].type).toBe("error");
		if (events[0].type === "error") {
			expect(events[0].error.stopReason).toBe("error");
			expect(events[0].error.errorMessage).toBe("boom");
		}
	});

	/** 测试场景：验证当前注册、队列、缓存、流事件或中止语义。 */
	it("estimates prompt and output tokens from serialized context", async () => {
		/** 变量 registration：当前场景创建的 faux 提供商注册句柄；仅在当前模块、函数或测试中有效。 */
		const registration = registerFauxProvider();
		registrations.push(registration);
		registration.setResponses([fauxAssistantMessage("done")]);

		/** 变量 tool：用于 Token 估算的 echo 工具定义；仅在当前模块、函数或测试中有效。 */
		const tool = {
			name: "echo",
			description: "Echo back text",
			parameters: Type.Object({ text: Type.String() }),
		};
		/** 变量 context：当前请求使用的最小消息上下文；仅在当前模块、函数或测试中有效。 */
		const context: Context = {
			systemPrompt: "sys",
			messages: [
				{
					role: "user",
					content: [
						{ type: "text", text: "hello" },
						{ type: "image", mimeType: "image/png", data: "abcd" },
					],
					timestamp: 1,
				},
				fauxAssistantMessage("prior"),
				{
					role: "toolResult",
					toolCallId: "tool-1",
					toolName: "echo",
					content: [{ type: "text", text: "tool out" }],
					isError: false,
					timestamp: 2,
				},
			],
			tools: [tool],
		};

		/** 变量 response：complete 返回的助手消息；仅在当前模块、函数或测试中有效。 */
		const response = await complete(registration.getModel(), context);
		/** 变量 promptText：按 faux 序列化规则手工拼接的提示文本；仅在当前模块、函数或测试中有效。 */
		const promptText = [
			"system:sys",
			"user:hello\n[image:image/png:4]",
			"assistant:prior",
			"toolResult:echo\ntool out",
			`tools:${JSON.stringify([tool])}`,
		].join("\n\n");
		/** 变量 expectedPromptTokens：按每四字符一个 Token 估算的预期输入量；仅在当前模块、函数或测试中有效。 */
		const expectedPromptTokens = Math.ceil(promptText.length / 4);
		/** 变量 expectedOutputTokens：按每四字符一个 Token 估算的预期输出量；仅在当前模块、函数或测试中有效。 */
		const expectedOutputTokens = Math.ceil("done".length / 4);

		expect(response.usage.input).toBe(expectedPromptTokens);
		expect(response.usage.output).toBe(expectedOutputTokens);
		expect(response.usage.cacheRead).toBe(0);
		expect(response.usage.cacheWrite).toBe(0);
		expect(response.usage.totalTokens).toBe(expectedPromptTokens + expectedOutputTokens);
	});

	/** 测试场景：验证当前注册、队列、缓存、流事件或中止语义。 */
	it("does not share cache across sessions or requests without sessionId", async () => {
		/** 变量 registration：当前场景创建的 faux 提供商注册句柄；仅在当前模块、函数或测试中有效。 */
		const registration = registerFauxProvider();
		registrations.push(registration);
		registration.setResponses([
			fauxAssistantMessage("first"),
			fauxAssistantMessage("second"),
			fauxAssistantMessage("third"),
		]);

		/** 变量 context：当前请求使用的最小消息上下文；仅在当前模块、函数或测试中有效。 */
		const context: Context = {
			messages: [{ role: "user", content: "hello", timestamp: Date.now() }],
		};

		/** 变量 first：响应队列中的第一次调用结果；仅在当前模块、函数或测试中有效。 */
		const first = await complete(registration.getModel(), context, {
			sessionId: "session-1",
			cacheRetention: "short",
		});
		expect(first.usage.cacheWrite).toBeGreaterThan(0);
		context.messages.push(first);
		context.messages.push({ role: "user", content: "follow up", timestamp: Date.now() + 1 });

		/** 变量 second：响应队列中的第二次调用结果；仅在当前模块、函数或测试中有效。 */
		const second = await complete(registration.getModel(), context, {
			sessionId: "session-2",
			cacheRetention: "short",
		});
		expect(second.usage.cacheRead).toBe(0);
		expect(second.usage.cacheWrite).toBeGreaterThan(0);

		/** 变量 third：不带 sessionId 请求得到的第三次响应；仅在当前模块、函数或测试中有效。 */
		const third = await complete(registration.getModel(), context);
		expect(third.usage.cacheRead).toBe(0);
		expect(third.usage.cacheWrite).toBe(0);
	});

	/** 测试场景：验证当前注册、队列、缓存、流事件或中止语义。 */
	it("simulates prompt caching per sessionId", async () => {
		/** 变量 registration：当前场景创建的 faux 提供商注册句柄；仅在当前模块、函数或测试中有效。 */
		const registration = registerFauxProvider();
		registrations.push(registration);
		registration.setResponses([fauxAssistantMessage("first"), fauxAssistantMessage("second")]);

		/** 变量 context：当前请求使用的最小消息上下文；仅在当前模块、函数或测试中有效。 */
		const context: Context = {
			systemPrompt: "Be concise.",
			messages: [{ role: "user", content: "hello", timestamp: Date.now() }],
		};

		/** 变量 first：响应队列中的第一次调用结果；仅在当前模块、函数或测试中有效。 */
		const first = await complete(registration.getModel(), context, {
			sessionId: "session-1",
			cacheRetention: "short",
		});
		expect(first.usage.cacheRead).toBe(0);
		expect(first.usage.cacheWrite).toBeGreaterThan(0);

		context.messages.push(first);
		context.messages.push({ role: "user", content: "follow up", timestamp: Date.now() + 1 });

		/** 变量 second：响应队列中的第二次调用结果；仅在当前模块、函数或测试中有效。 */
		const second = await complete(registration.getModel(), context, {
			sessionId: "session-1",
			cacheRetention: "short",
		});
		expect(second.usage.cacheRead).toBeGreaterThan(0);
		expect(second.usage.input + second.usage.cacheRead).toBeGreaterThan(second.usage.input);
	});

	/** 测试场景：验证当前注册、队列、缓存、流事件或中止语义。 */
	it("does not simulate caching when cacheRetention is none", async () => {
		/** 变量 registration：当前场景创建的 faux 提供商注册句柄；仅在当前模块、函数或测试中有效。 */
		const registration = registerFauxProvider();
		registrations.push(registration);
		registration.setResponses([fauxAssistantMessage("first"), fauxAssistantMessage("second")]);

		/** 变量 context：当前请求使用的最小消息上下文；仅在当前模块、函数或测试中有效。 */
		const context: Context = {
			messages: [{ role: "user", content: "hello", timestamp: Date.now() }],
		};

		await complete(registration.getModel(), context, { sessionId: "session-1", cacheRetention: "none" });
		context.messages.push(fauxAssistantMessage("first"));
		context.messages.push({ role: "user", content: "follow up", timestamp: Date.now() + 1 });
		/** 变量 second：响应队列中的第二次调用结果；仅在当前模块、函数或测试中有效。 */
		const second = await complete(registration.getModel(), context, {
			sessionId: "session-1",
			cacheRetention: "none",
		});
		expect(second.usage.cacheRead).toBe(0);
		expect(second.usage.cacheWrite).toBe(0);
	});

	/** 测试场景：验证当前注册、队列、缓存、流事件或中止语义。 */
	it("streams thinking, text, and partial tool call deltas", async () => {
		/** 变量 registration：当前场景创建的 faux 提供商注册句柄；仅在当前模块、函数或测试中有效。 */
		const registration = registerFauxProvider();
		registrations.push(registration);
		registration.setResponses([
			fauxAssistantMessage(
				[
					fauxThinking("thinking text"),
					fauxText("answer text"),
					fauxToolCall("echo", { text: "hi", count: 12 }, { id: "tool-1" }),
				],
				{ stopReason: "toolUse" },
			),
		]);

		/** 变量 events：当前模型流产生的事件数组或事件类型数组；仅在当前模块、函数或测试中有效。 */
		const events: string[] = [];
		/** 变量 toolCallDeltas：流中收到的工具参数 JSON 分块；仅在当前模块、函数或测试中有效。 */
		const toolCallDeltas: string[] = [];
		/** 变量 s：当前正在消费的 faux 助手事件流；仅在当前模块、函数或测试中有效。 */
		const s = stream(registration.getModel(), { messages: [{ role: "user", content: "hi", timestamp: Date.now() }] });
		for await (const event of s) {
			/** 循环变量 event：当前从 faux 流读取的事件。 */
			events.push(event.type);
			if (event.type === "toolcall_delta") {
				toolCallDeltas.push(event.delta);
			}
		}

		expect(events).toContain("thinking_start");
		expect(events).toContain("thinking_delta");
		expect(events).toContain("text_start");
		expect(events).toContain("text_delta");
		expect(events).toContain("toolcall_start");
		expect(events).toContain("toolcall_delta");
		expect(events).toContain("toolcall_end");
		expect(toolCallDeltas.length).toBeGreaterThan(1);
		expect(JSON.parse(toolCallDeltas.join(""))).toEqual({ text: "hi", count: 12 });
	});

	/** 测试场景：验证当前注册、队列、缓存、流事件或中止语义。 */
	it("streams an exact event order for fixed-size chunks", async () => {
		/** 变量 registration：当前场景创建的 faux 提供商注册句柄；仅在当前模块、函数或测试中有效。 */
		const registration = registerFauxProvider({ tokenSize: { min: 1, max: 1 } });
		registrations.push(registration);
		registration.setResponses([
			fauxAssistantMessage([fauxThinking("go"), fauxText("ok"), fauxToolCall("echo", {}, { id: "tool-1" })], {
				stopReason: "toolUse",
			}),
		]);

		/** 变量 events：当前模型流产生的事件数组或事件类型数组；仅在当前模块、函数或测试中有效。 */
		const events = await collectEvents(
			stream(registration.getModel(), { messages: [{ role: "user", content: "hi", timestamp: Date.now() }] }),
		);

		expect(events.map((event) => event.type)).toEqual([
			"start",
			"thinking_start",
			"thinking_delta",
			"thinking_end",
			"text_start",
			"text_delta",
			"text_end",
			"toolcall_start",
			"toolcall_delta",
			"toolcall_end",
			"done",
		]);
	});

	/** 测试场景：验证当前注册、队列、缓存、流事件或中止语义。 */
	it("streams multiple tool calls in one message", async () => {
		/** 变量 registration：当前场景创建的 faux 提供商注册句柄；仅在当前模块、函数或测试中有效。 */
		const registration = registerFauxProvider();
		registrations.push(registration);
		registration.setResponses([
			fauxAssistantMessage(
				[
					fauxToolCall("echo", { text: "one" }, { id: "tool-1" }),
					fauxToolCall("echo", { text: "two" }, { id: "tool-2" }),
				],
				{ stopReason: "toolUse" },
			),
		]);

		/** 变量 events：当前模型流产生的事件数组或事件类型数组；仅在当前模块、函数或测试中有效。 */
		const events = await collectEvents(
			stream(registration.getModel(), { messages: [{ role: "user", content: "hi", timestamp: Date.now() }] }),
		);

		expect(events.filter((event) => event.type === "toolcall_start")).toHaveLength(2);
		expect(events.filter((event) => event.type === "toolcall_end")).toHaveLength(2);
	});

	/** 测试场景：验证当前注册、队列、缓存、流事件或中止语义。 */
	it("streams an explicit assistant error message as a terminal error", async () => {
		/** 变量 registration：当前场景创建的 faux 提供商注册句柄；仅在当前模块、函数或测试中有效。 */
		const registration = registerFauxProvider({ tokenSize: { min: 2, max: 2 } });
		registrations.push(registration);
		registration.setResponses([
			{
				...fauxAssistantMessage("partial"),
				stopReason: "error",
				errorMessage: "upstream failed",
			},
		]);

		/** 变量 events：当前模型流产生的事件数组或事件类型数组；仅在当前模块、函数或测试中有效。 */
		const events = await collectEvents(
			stream(registration.getModel(), { messages: [{ role: "user", content: "hi", timestamp: Date.now() }] }),
		);

		expect(events.map((event) => event.type)).toEqual(["start", "text_start", "text_delta", "text_end", "error"]);
		/** 变量 terminal：事件流最后一个错误或中止事件；仅在当前模块、函数或测试中有效。 */
		const terminal = events[events.length - 1];
		expect(terminal.type).toBe("error");
		if (terminal.type === "error") {
			expect(terminal.reason).toBe("error");
			expect(terminal.error.stopReason).toBe("error");
			expect(terminal.error.errorMessage).toBe("upstream failed");
		}
	});

	/** 测试场景：验证当前注册、队列、缓存、流事件或中止语义。 */
	it("streams an explicit assistant aborted message as a terminal error", async () => {
		/** 变量 registration：当前场景创建的 faux 提供商注册句柄；仅在当前模块、函数或测试中有效。 */
		const registration = registerFauxProvider({ tokenSize: { min: 2, max: 2 } });
		registrations.push(registration);
		registration.setResponses([
			{
				...fauxAssistantMessage("partial"),
				stopReason: "aborted",
				errorMessage: "Request was aborted",
			},
		]);

		/** 变量 events：当前模型流产生的事件数组或事件类型数组；仅在当前模块、函数或测试中有效。 */
		const events = await collectEvents(
			stream(registration.getModel(), { messages: [{ role: "user", content: "hi", timestamp: Date.now() }] }),
		);

		expect(events.map((event) => event.type)).toEqual(["start", "text_start", "text_delta", "text_end", "error"]);
		/** 变量 terminal：事件流最后一个错误或中止事件；仅在当前模块、函数或测试中有效。 */
		const terminal = events[events.length - 1];
		expect(terminal.type).toBe("error");
		if (terminal.type === "error") {
			expect(terminal.reason).toBe("aborted");
			expect(terminal.error.stopReason).toBe("aborted");
			expect(terminal.error.errorMessage).toBe("Request was aborted");
		}
	});

	/** 测试场景：验证当前注册、队列、缓存、流事件或中止语义。 */
	it("supports aborting before the first chunk", async () => {
		/** 变量 registration：当前场景创建的 faux 提供商注册句柄；仅在当前模块、函数或测试中有效。 */
		const registration = registerFauxProvider({ tokensPerSecond: 50, tokenSize: { min: 3, max: 3 } });
		registrations.push(registration);
		registration.setResponses([fauxAssistantMessage("abcdefghijklmnopqrstuvwxyz")]);

		/** 变量 controller：控制当前流中止时机的 AbortController；仅在当前模块、函数或测试中有效。 */
		const controller = new AbortController();
		controller.abort();
		/** 变量 events：当前模型流产生的事件数组或事件类型数组；仅在当前模块、函数或测试中有效。 */
		const events = await collectEvents(
			stream(
				registration.getModel(),
				{ messages: [{ role: "user", content: "hi", timestamp: Date.now() }] },
				{ signal: controller.signal },
			),
		);

		expect(events).toHaveLength(1);
		expect(events[0].type).toBe("error");
		if (events[0].type === "error") {
			expect(events[0].reason).toBe("aborted");
			expect(events[0].error.stopReason).toBe("aborted");
		}
	});

	/** 测试场景：验证当前注册、队列、缓存、流事件或中止语义。 */
	it("supports aborting mid-text stream when paced", async () => {
		/** 变量 registration：当前场景创建的 faux 提供商注册句柄；仅在当前模块、函数或测试中有效。 */
		const registration = registerFauxProvider({ tokensPerSecond: 100, tokenSize: { min: 3, max: 3 } });
		registrations.push(registration);
		registration.setResponses([fauxAssistantMessage("abcdefghijklmnopqrstuvwxyz")]);

		/** 变量 controller：控制当前流中止时机的 AbortController；仅在当前模块、函数或测试中有效。 */
		const controller = new AbortController();
		/** 变量 events：当前模型流产生的事件数组或事件类型数组；仅在当前模块、函数或测试中有效。 */
		const events: string[] = [];
		/** 变量 textDeltaCount：中止前收到的文本增量数量；仅在当前模块、函数或测试中有效。 */
		let textDeltaCount = 0;
		/** 变量 s：当前正在消费的 faux 助手事件流；仅在当前模块、函数或测试中有效。 */
		const s = stream(
			registration.getModel(),
			{ messages: [{ role: "user", content: "hi", timestamp: Date.now() }] },
			{ signal: controller.signal },
		);
		for await (const event of s) {
			/** 循环变量 event：当前从 faux 流读取的事件。 */
			events.push(event.type);
			if (event.type === "text_delta") {
				textDeltaCount++;
				controller.abort();
			}
		}

		expect(textDeltaCount).toBe(1);
		expect(events).toContain("text_start");
		expect(events).toContain("text_delta");
		expect(events).toContain("error");
		expect(events).not.toContain("text_end");
	});

	/** 测试场景：验证当前注册、队列、缓存、流事件或中止语义。 */
	it("supports aborting mid-thinking stream when paced", async () => {
		/** 变量 registration：当前场景创建的 faux 提供商注册句柄；仅在当前模块、函数或测试中有效。 */
		const registration = registerFauxProvider({ tokensPerSecond: 100, tokenSize: { min: 3, max: 3 } });
		registrations.push(registration);
		registration.setResponses([
			{
				...fauxAssistantMessage("ignored"),
				content: [{ type: "thinking", thinking: "abcdefghijklmnopqrstuvwxyz" }],
			},
		]);

		/** 变量 controller：控制当前流中止时机的 AbortController；仅在当前模块、函数或测试中有效。 */
		const controller = new AbortController();
		/** 变量 events：当前模型流产生的事件数组或事件类型数组；仅在当前模块、函数或测试中有效。 */
		const events: string[] = [];
		/** 变量 thinkingDeltaCount：中止前收到的思考增量数量；仅在当前模块、函数或测试中有效。 */
		let thinkingDeltaCount = 0;
		/** 变量 s：当前正在消费的 faux 助手事件流；仅在当前模块、函数或测试中有效。 */
		const s = stream(
			registration.getModel(),
			{ messages: [{ role: "user", content: "hi", timestamp: Date.now() }] },
			{ signal: controller.signal },
		);
		for await (const event of s) {
			/** 循环变量 event：当前从 faux 流读取的事件。 */
			events.push(event.type);
			if (event.type === "thinking_delta") {
				thinkingDeltaCount++;
				controller.abort();
			}
		}

		expect(thinkingDeltaCount).toBe(1);
		expect(events).toContain("thinking_start");
		expect(events).toContain("thinking_delta");
		expect(events).toContain("error");
		expect(events).not.toContain("thinking_end");
	});

	/** 测试场景：验证当前注册、队列、缓存、流事件或中止语义。 */
	it("supports aborting mid-toolcall stream when paced", async () => {
		/** 变量 registration：当前场景创建的 faux 提供商注册句柄；仅在当前模块、函数或测试中有效。 */
		const registration = registerFauxProvider({ tokensPerSecond: 100, tokenSize: { min: 3, max: 3 } });
		registrations.push(registration);
		registration.setResponses([
			{
				...fauxAssistantMessage("done"),
				content: [
					{
						type: "toolCall",
						id: "tool-1",
						name: "echo",
						arguments: { text: "abcdefghijklmnopqrstuvwxyz", count: 123456789 },
					},
				],
				stopReason: "toolUse",
			},
		]);

		/** 变量 controller：控制当前流中止时机的 AbortController；仅在当前模块、函数或测试中有效。 */
		const controller = new AbortController();
		/** 变量 events：当前模型流产生的事件数组或事件类型数组；仅在当前模块、函数或测试中有效。 */
		const events: string[] = [];
		/** 变量 toolCallDeltaCount：中止前收到的工具调用增量数量；仅在当前模块、函数或测试中有效。 */
		let toolCallDeltaCount = 0;
		/** 变量 s：当前正在消费的 faux 助手事件流；仅在当前模块、函数或测试中有效。 */
		const s = stream(
			registration.getModel(),
			{ messages: [{ role: "user", content: "hi", timestamp: Date.now() }] },
			{ signal: controller.signal },
		);
		for await (const event of s) {
			/** 循环变量 event：当前从 faux 流读取的事件。 */
			events.push(event.type);
			if (event.type === "toolcall_delta") {
				toolCallDeltaCount++;
				controller.abort();
			}
		}

		expect(toolCallDeltaCount).toBe(1);
		expect(events).toContain("toolcall_start");
		expect(events).toContain("toolcall_delta");
		expect(events).toContain("error");
		expect(events).not.toContain("toolcall_end");
	});

	/** 测试场景：验证当前注册、队列、缓存、流事件或中止语义。 */
	it("unregisters the provider", async () => {
		/** 变量 registration：当前场景创建的 faux 提供商注册句柄；仅在当前模块、函数或测试中有效。 */
		const registration = registerFauxProvider();
		registration.setResponses([fauxAssistantMessage("hello")]);
		registration.unregister();

		await expect(
			complete(registration.getModel(), { messages: [{ role: "user", content: "hi", timestamp: Date.now() }] }),
		).rejects.toThrow(`No API provider registered for api: ${registration.api}`);
	});
});
