/**
 * 文件职责：验证 AgentHarness 的队列、钩子、工具上下文、资源更新、会话持久化、压缩与重试行为。
 * 技术维度：使用 Vitest、内存会话、faux provider、可控 Promise 和类型化测试工具进行离线集成测试。
 * 产品维度：保证应用通过 Harness 编排代理时，消息、工具、资源和长会话摘要能够稳定协同。
 * 逻辑维度：先定义伪模型与消息辅助函数，再覆盖运行队列和钩子，随后测试工具上下文、压缩、重试及泛型资源。
 * 关键边界：异步监听器和队列测试依赖严格时序；伪提供商响应必须按调用次数完整配置，避免意外耗尽。
 * 新手阅读建议：先看 newFaux、deferred 与消息工厂，再读基础 prompt/queue 用例，最后看压缩重试和泛型类型保持。
 */
import {
	createModels,
	type FauxProviderHandle,
	fauxAssistantMessage,
	fauxProvider,
	fauxToolCall,
	type RegisterFauxProviderOptions,
	type Usage,
} from "@earendil-works/pi-ai";
import { getModel } from "@earendil-works/pi-ai/compat";
import { describe, expect, it } from "vitest";
import { AgentHarness } from "../../src/harness/agent-harness.ts";
import { NodeExecutionEnv } from "../../src/harness/env/nodejs.ts";
import { InMemorySessionStorage } from "../../src/harness/session/memory-storage.ts";
import { Session } from "../../src/harness/session/session.ts";
import type { AgentHarnessTool, PromptTemplate, Skill } from "../../src/harness/types.ts";
import type { AgentMessage, AgentTool } from "../../src/types.ts";
import { calculateTool, createCalculateToolWithUsage } from "../utils/calculate.ts";
import { getCurrentTimeTool } from "../utils/get-current-time.ts";

interface AppSkill extends Skill {
	source: "project" | "user";
}

interface AppPromptTemplate extends PromptTemplate {
	source: "project" | "user";
}

/** Shared collection; each faux provider gets a unique id so coexisting fakes route correctly. */
// 中文说明：上方英文注释给出本段功能、前提或边界，下面代码按该说明执行。
const models = createModels();
/** 变量 fauxCount 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
let fauxCount = 0;

/** newFaux 执行当前测试辅助步骤；参数 options 按签名提供输入，返回值供调用方断言。示例：newFaux(...)。 */
function newFaux(options: RegisterFauxProviderOptions = {}): FauxProviderHandle {
	/** 常量 faux 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const faux = fauxProvider({ provider: `faux-${++fauxCount}`, ...options });
	models.setProvider(faux.provider);
	return faux;
}

/** textFromUserMessages 执行当前测试辅助步骤；参数 messages 按签名提供输入，返回值供调用方断言。示例：textFromUserMessages(...)。 */
function textFromUserMessages(messages: Array<{ role: string; content: unknown }>): string[] {
	return messages.flatMap((message) => {
		if (message.role !== "user") return [];
		if (typeof message.content === "string") return [message.content];
		if (!Array.isArray(message.content)) return [];
		return message.content.flatMap((part) => {
			if (!part || typeof part !== "object" || !("type" in part) || part.type !== "text") return [];
			return "text" in part && typeof part.text === "string" ? [part.text] : [];
		});
	});
}

/** deferred 执行当前测试辅助步骤；参数 无 按签名提供输入，返回值供调用方断言。示例：deferred()。 */
function deferred(): { promise: Promise<void>; resolve: () => void } {
	/** resolve 封装当前回调或辅助步骤；参数 无 提供输入，返回值用于后续流程。示例：resolve()。 */
	let resolve = () => {};
	/** 常量 promise 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const promise = new Promise<void>((resolvePromise) => {
		resolve = resolvePromise;
	});
	return { promise, resolve };
}

/** getReasoning 执行当前测试辅助步骤；参数 options 按签名提供输入，返回值供调用方断言。示例：getReasoning(...)。 */
function getReasoning(options: unknown): unknown {
	if (!options || typeof options !== "object" || !("reasoning" in options)) return undefined;
	return options.reasoning;
}

/** createUsage 执行当前测试辅助步骤；参数 input、output、cacheRead 、cacheWrite  按签名提供输入，返回值供调用方断言。示例：createUsage(..., ..., ..., ...)。 */
function createUsage(input: number, output: number, cacheRead = 0, cacheWrite = 0): Usage {
	return {
		input,
		output,
		cacheRead,
		cacheWrite,
		totalTokens: input + output + cacheRead + cacheWrite,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
	};
}

/** createUserMessage 执行当前测试辅助步骤；参数 text 按签名提供输入，返回值供调用方断言。示例：createUserMessage(...)。 */
function createUserMessage(text: string): AgentMessage {
	return { role: "user", content: [{ type: "text", text }], timestamp: Date.now() };
}

/** createAssistantMessage 执行当前测试辅助步骤；参数 text 按签名提供输入，返回值供调用方断言。示例：createAssistantMessage(...)。 */
function createAssistantMessage(text: string): AgentMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		api: "faux",
		provider: "faux",
		model: "faux-1",
		usage: createUsage(100, 50),
		stopReason: "stop",
		timestamp: Date.now(),
	};
}

// 用例分组：集中验证“AgentHarness”相关功能。
describe("AgentHarness", () => {
	// 测试场景：验证“constructs directly and exposes queue modes”对应的行为、结果与边界。
	it("constructs directly and exposes queue modes", () => {
		/** 常量 session 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const session = new Session(new InMemorySessionStorage());
		/** 常量 initialModel 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const initialModel = getModel("anthropic", "claude-sonnet-4-5");
		/** 常量 harness 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const harness = new AgentHarness({
			models,
			session,
			model: initialModel,
			thinkingLevel: "high",
			systemPrompt: "You are helpful.",
			steeringMode: "all",
			followUpMode: "all",
		});
		expect(harness.getModel()).toBe(initialModel);
		expect(harness.getThinkingLevel()).toBe("high");
		expect(harness.getSteeringMode()).toBe("all");
		expect(harness.getFollowUpMode()).toBe("all");
		harness.setSteeringMode("one-at-a-time");
		harness.setFollowUpMode("one-at-a-time");
		expect(harness.getSteeringMode()).toBe("one-at-a-time");
		expect(harness.getFollowUpMode()).toBe("one-at-a-time");
	});

	// 测试场景：验证“drains one queued steering message at a time and emits queue updates”对应的行为、结果与边界。
	it("drains one queued steering message at a time and emits queue updates", async () => {
		/** 常量 registration 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const registration = newFaux();
		/** 常量 userCounts 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const userCounts: number[] = [];
		registration.setResponses([
			(context) => {
				userCounts.push(context.messages.filter((message) => message.role === "user").length);
				return fauxAssistantMessage("first");
			},
			(context) => {
				userCounts.push(context.messages.filter((message) => message.role === "user").length);
				return fauxAssistantMessage("second");
			},
			(context) => {
				userCounts.push(context.messages.filter((message) => message.role === "user").length);
				return fauxAssistantMessage("third");
			},
		]);
		/** 常量 harness 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const harness = new AgentHarness({
			models,
			session: new Session(new InMemorySessionStorage()),
			model: registration.getModel(),
			steeringMode: "one-at-a-time",
		});
		/** 常量 steerQueueLengths 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const steerQueueLengths: number[] = [];
		/** 变量 queued 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let queued = false;
		harness.subscribe((event) => {
			if (event.type === "queue_update") {
				steerQueueLengths.push(event.steer.length);
			}
			if (event.type === "message_start" && event.message.role === "assistant" && !queued) {
				queued = true;
				harness.steer("one");
				harness.steer("two");
			}
		});

		await harness.prompt("hello");

		expect(userCounts).toEqual([1, 2, 3]);
		expect(steerQueueLengths).toEqual([1, 2, 1, 0]);
	});

	// 测试场景：验证“appends before_agent_start messages and persists them”对应的行为、结果与边界。
	it("appends before_agent_start messages and persists them", async () => {
		/** 常量 registration 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const registration = newFaux();
		/** 变量 requestText 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let requestText: string[] = [];
		registration.setResponses([
			(context) => {
				requestText = textFromUserMessages(context.messages);
				return fauxAssistantMessage("ok");
			},
		]);
		/** 常量 session 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const session = new Session(new InMemorySessionStorage());
		/** 常量 harness 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const harness = new AgentHarness({
			models,
			session,
			model: registration.getModel(),
		});
		harness.on("before_agent_start", () => ({
			messages: [{ role: "user", content: [{ type: "text", text: "hook" }], timestamp: Date.now() }],
		}));

		await harness.prompt("hello");

		/** 常量 persistedText 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const persistedText = (await session.getEntries()).flatMap((entry) => {
			if (entry.type !== "message" || entry.message.role !== "user") return [];
			/** 常量 content 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const content = entry.message.content;
			if (typeof content === "string") return [content];
			return content.flatMap((part) => (part.type === "text" ? [part.text] : []));
		});
		expect(requestText).toEqual(["hello", "hook"]);
		expect(persistedText).toEqual(["hello", "hook"]);
	});

	// 测试场景：验证“abort clears steer and follow-up queues but preserves next-turn messages”对应的行为、结果与边界。
	it("abort clears steer and follow-up queues but preserves next-turn messages", async () => {
		/** 常量 registration 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const registration = newFaux();
		/** 变量 releaseFirstResponse 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let releaseFirstResponse: (() => void) | undefined;
		/** 变量 abortedSignal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let abortedSignal: AbortSignal | undefined;
		/** 常量 firstResponseReleased 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const firstResponseReleased = new Promise<void>((resolve) => {
			releaseFirstResponse = resolve;
		});
		/** 常量 secondRequestText 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const secondRequestText: string[] = [];
		registration.setResponses([
			async (_context, options) => {
				abortedSignal = options?.signal;
				await firstResponseReleased;
				return fauxAssistantMessage("aborted-ish");
			},
			(context) => {
				secondRequestText.push(...textFromUserMessages(context.messages));
				return fauxAssistantMessage("second");
			},
		]);
		/** 常量 harness 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const harness = new AgentHarness({
			models,
			session: new Session(new InMemorySessionStorage()),
			model: registration.getModel(),
		});
		/** 常量 queueUpdates 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const queueUpdates: Array<{ steer: number; followUp: number; nextTurn: number }> = [];
		harness.subscribe((event) => {
			if (event.type === "queue_update") {
				queueUpdates.push({
					steer: event.steer.length,
					followUp: event.followUp.length,
					nextTurn: event.nextTurn.length,
				});
			}
		});

		/** 常量 firstPrompt 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const firstPrompt = harness.prompt("first");
		await new Promise((resolve) => setTimeout(resolve, 0));
		harness.steer("steer");
		harness.followUp("follow");
		harness.nextTurn("next");
		/** 常量 abortResultPromise 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const abortResultPromise = harness.abort();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(abortedSignal?.aborted).toBe(true);
		releaseFirstResponse?.();
		/** 常量 abortResult 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const abortResult = await abortResultPromise;
		await firstPrompt;
		await harness.prompt("second");

		expect(abortResult.clearedSteer).toHaveLength(1);
		expect(abortResult.clearedFollowUp).toHaveLength(1);
		expect(queueUpdates).toContainEqual({ steer: 0, followUp: 0, nextTurn: 1 });
		expect(secondRequestText).toEqual(["first", "next", "second"]);
	});

	// 测试场景：验证“drains follow-up messages one at a time after the agent would otherwise stop”对应的行为、结果与边界。
	it("drains follow-up messages one at a time after the agent would otherwise stop", async () => {
		/** 常量 registration 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const registration = newFaux();
		/** 常量 userCounts 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const userCounts: number[] = [];
		registration.setResponses([
			(context) => {
				userCounts.push(context.messages.filter((message) => message.role === "user").length);
				return fauxAssistantMessage("first");
			},
			(context) => {
				userCounts.push(context.messages.filter((message) => message.role === "user").length);
				return fauxAssistantMessage("second");
			},
			(context) => {
				userCounts.push(context.messages.filter((message) => message.role === "user").length);
				return fauxAssistantMessage("third");
			},
		]);
		/** 常量 harness 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const harness = new AgentHarness({
			models,
			session: new Session(new InMemorySessionStorage()),
			model: registration.getModel(),
			followUpMode: "one-at-a-time",
		});
		/** 常量 followUpQueueLengths 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const followUpQueueLengths: number[] = [];
		/** 变量 queued 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let queued = false;
		harness.subscribe((event) => {
			if (event.type === "queue_update") {
				followUpQueueLengths.push(event.followUp.length);
			}
			if (event.type === "message_start" && event.message.role === "assistant" && !queued) {
				queued = true;
				harness.followUp("one");
				harness.followUp("two");
			}
		});

		await harness.prompt("hello");

		expect(userCounts).toEqual([1, 2, 3]);
		expect(followUpQueueLengths).toEqual([1, 2, 1, 0]);
	});

	// 测试场景：验证“settles thrown hook failures with persisted assistant error messages”对应的行为、结果与边界。
	it("settles thrown hook failures with persisted assistant error messages", async () => {
		/** 常量 registration 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const registration = newFaux();
		registration.setResponses([() => fauxAssistantMessage("should not be used")]);
		/** 常量 session 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const session = new Session(new InMemorySessionStorage());
		/** 常量 harness 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const harness = new AgentHarness({
			models,
			session,
			model: registration.getModel(),
		});
		/** 常量 events 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const events: string[] = [];
		harness.subscribe((event) => {
			events.push(event.type);
		});
		harness.on("context", () => {
			throw new Error("context exploded");
		});

		/** 常量 response 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const response = await harness.prompt("hello");
		await expect(harness.prompt("after failure")).resolves.toMatchObject({ role: "assistant" });

		/** 常量 entries 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const entries = await session.getEntries();
		/** 常量 messages 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const messages = entries.flatMap((entry) => (entry.type === "message" ? [entry.message] : []));
		expect(response.stopReason).toBe("error");
		expect(response.errorMessage).toBe("context exploded");
		expect(messages[0]?.role).toBe("user");
		expect(messages[1]).toMatchObject({ role: "assistant", stopReason: "error", errorMessage: "context exploded" });
		expect(events).toContain("agent_end");
		expect(events).toContain("settled");
	});

	// 测试场景：验证“refreshes model, thinking level, resources, system prompt, and active tools at save points”对应的行为、结果与边界。
	it("refreshes model, thinking level, resources, system prompt, and active tools at save points", async () => {
		/** 常量 registration 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const registration = newFaux({
			models: [
				{ id: "first", reasoning: true },
				{ id: "second", reasoning: true },
			],
		});
		/** 常量 secondModel 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const secondModel = registration.getModel("second");
		if (!secondModel) throw new Error("missing second faux model");
		/** 常量 captured 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const captured: Array<{ modelId: string; reasoning: unknown; systemPrompt: string; tools: string[] }> = [];
		registration.setResponses([
			(context, options, _state, model) => {
				captured.push({
					modelId: model.id,
					reasoning: getReasoning(options),
					systemPrompt: context.systemPrompt ?? "",
					tools: context.tools?.map((tool) => tool.name) ?? [],
				});
				return fauxAssistantMessage(fauxToolCall("calculate", { expression: "1 + 1" }, { id: "call-1" }), {
					stopReason: "toolUse",
				});
			},
			(context, options, _state, model) => {
				captured.push({
					modelId: model.id,
					reasoning: getReasoning(options),
					systemPrompt: context.systemPrompt ?? "",
					tools: context.tools?.map((tool) => tool.name) ?? [],
				});
				return fauxAssistantMessage("done");
			},
		]);
		/** 常量 harness 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const harness = new AgentHarness<undefined, Skill, PromptTemplate, AgentTool>({
			models,
			session: new Session(new InMemorySessionStorage()),
			model: registration.getModel(),
			thinkingLevel: "off",
			resources: {
				skills: [{ name: "prompt", description: "prompt", content: "first prompt", filePath: "/skills/prompt" }],
			},
			systemPrompt: ({ resources }) => resources.skills?.[0]?.content ?? "missing prompt",
			tools: [calculateTool],
		});
		harness.subscribe((event) => {
			if (event.type === "tool_execution_start") {
				void harness.setModel(secondModel);
				void harness.setThinkingLevel("high");
				void harness.setResources({
					skills: [
						{ name: "prompt", description: "prompt", content: "second prompt", filePath: "/skills/prompt" },
					],
				});
				void harness.setTools([calculateTool, getCurrentTimeTool], [getCurrentTimeTool.name]);
			}
		});

		await harness.prompt("hello");

		expect(captured).toEqual([
			{ modelId: "first", reasoning: undefined, systemPrompt: "first prompt", tools: ["calculate"] },
			{ modelId: "second", reasoning: "high", systemPrompt: "second prompt", tools: ["get_current_time"] },
		]);
	});

	// 测试场景：验证“orders pending listener session writes after agent-emitted messages”对应的行为、结果与边界。
	it("orders pending listener session writes after agent-emitted messages", async () => {
		/** 常量 registration 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const registration = newFaux();
		registration.setResponses([() => fauxAssistantMessage("ok")]);
		/** 常量 session 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const session = new Session(new InMemorySessionStorage());
		/** 常量 harness 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const harness = new AgentHarness({
			models,
			session,
			model: registration.getModel(),
		});
		/** 变量 wrotePendingMessage 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let wrotePendingMessage = false;
		harness.subscribe(async (event) => {
			if (event.type === "message_end" && event.message.role === "assistant" && !wrotePendingMessage) {
				wrotePendingMessage = true;
				await harness.appendMessage({
					role: "custom",
					customType: "listener",
					content: "listener write",
					display: true,
					timestamp: Date.now(),
				} as AgentMessage);
			}
		});

		await harness.prompt("hello");

		/** 常量 entries 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const entries = await session.getEntries();
		/** 常量 roles 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const roles = entries.flatMap((entry) => (entry.type === "message" ? [entry.message.role] : []));
		expect(roles).toEqual(["user", "assistant", "custom"]);
	});

	// 测试场景：验证“waitForIdle waits for external run settlement and awaited listeners”对应的行为、结果与边界。
	it("waitForIdle waits for external run settlement and awaited listeners", async () => {
		/** 常量 registration 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const registration = newFaux();
		registration.setResponses([() => fauxAssistantMessage("ok")]);
		/** 常量 barrier 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const barrier = deferred();
		/** 常量 harness 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const harness = new AgentHarness({
			models,
			session: new Session(new InMemorySessionStorage()),
			model: registration.getModel(),
		});
		/** 变量 listenerFinished 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let listenerFinished = false;
		harness.subscribe(async (event) => {
			if (event.type === "agent_end") {
				await barrier.promise;
				listenerFinished = true;
			}
		});

		/** 常量 promptPromise 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const promptPromise = harness.prompt("hello");
		/** 变量 idleResolved 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let idleResolved = false;
		/** 常量 idlePromise 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const idlePromise = harness.waitForIdle().then(() => {
			idleResolved = true;
		});
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(idleResolved).toBe(false);
		expect(listenerFinished).toBe(false);
		barrier.resolve();
		await Promise.all([promptPromise, idlePromise]);
		expect(idleResolved).toBe(true);
		expect(listenerFinished).toBe(true);
	});

	// 测试场景：验证“runs tool_call and tool_result hooks through the direct loop”对应的行为、结果与边界。
	it("runs tool_call and tool_result hooks through the direct loop", async () => {
		/** 常量 registration 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const registration = newFaux();
		registration.setResponses([
			() =>
				fauxAssistantMessage(fauxToolCall("calculate", { expression: "2 + 2" }, { id: "call-1" }), {
					stopReason: "toolUse",
				}),
		]);
		/** 常量 session 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const session = new Session(new InMemorySessionStorage());
		/** 常量 toolUsage 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const toolUsage = createUsage(1, 2, 3, 4);
		/** 常量 patchedToolUsage 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const patchedToolUsage = createUsage(5, 6, 7, 8);
		/** 常量 calculateToolWithUsage 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const calculateToolWithUsage = createCalculateToolWithUsage(toolUsage);
		/** 常量 harness 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const harness = new AgentHarness({
			models,
			session,
			model: registration.getModel(),
			tools: [calculateToolWithUsage],
		});
		/** 常量 seenToolCalls 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const seenToolCalls: Array<{ id: string; name: string; expression: unknown }> = [];
		/** 变量 seenToolUsage 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let seenToolUsage: Usage | undefined;
		harness.on("tool_call", (event) => {
			seenToolCalls.push({ id: event.toolCallId, name: event.toolName, expression: event.input.expression });
			return undefined;
		});
		harness.on("tool_result", (event) => {
			expect(event.toolCallId).toBe("call-1");
			expect(event.toolName).toBe("calculate");
			seenToolUsage = event.usage;
			return {
				content: [{ type: "text", text: "patched result" }],
				details: { patched: true },
				usage: patchedToolUsage,
				terminate: true,
			};
		});

		await harness.prompt("hello");

		/** 常量 toolResult 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const toolResult = (await session.getEntries()).find(
			(entry) => entry.type === "message" && entry.message.role === "toolResult",
		);
		expect(seenToolCalls).toEqual([{ id: "call-1", name: "calculate", expression: "2 + 2" }]);
		expect(seenToolUsage).toEqual(toolUsage);
		expect(toolResult).toMatchObject({
			type: "message",
			message: {
				role: "toolResult",
				content: [{ type: "text", text: "patched result" }],
				details: { patched: true },
				usage: patchedToolUsage,
			},
		});
	});

	// 测试场景：验证“passes a static application context to harness tools”对应的行为、结果与边界。
	it("passes a static application context to harness tools", async () => {
		/** 常量 registration 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const registration = newFaux();
		registration.setResponses([
			() =>
				fauxAssistantMessage(fauxToolCall("context", { expression: "2 + 2" }, { id: "call-1" }), {
					stopReason: "toolUse",
				}),
		]);
		/** 常量 env 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const env = new NodeExecutionEnv({ cwd: process.cwd() });
		/** 常量 toolContext 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const toolContext = { env };
		/** 变量 receivedContext 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let receivedContext: typeof toolContext | undefined;
		/** 常量 contextTool 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const contextTool: AgentHarnessTool<typeof toolContext, typeof calculateTool.parameters, undefined> = {
			...calculateTool,
			name: "context",
			execute: async (toolCallId, params, signal, onUpdate, context) => {
				receivedContext = context;
				return { ...(await calculateTool.execute(toolCallId, params, signal, onUpdate)), terminate: true };
			},
		};
		/** 常量 harness 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const harness = new AgentHarness({
			models,
			session: new Session(new InMemorySessionStorage()),
			model: registration.getModel(),
			tools: [contextTool],
			toolContext,
		});

		await harness.prompt("hello");

		expect(receivedContext).toBe(toolContext);
	});

	// 测试场景：验证“resolves async tool context providers for each turn snapshot”对应的行为、结果与边界。
	it("resolves async tool context providers for each turn snapshot", async () => {
		/** 常量 registration 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const registration = newFaux();
		registration.setResponses([
			() =>
				fauxAssistantMessage(fauxToolCall("context", { expression: "1 + 1" }, { id: "call-1" }), {
					stopReason: "toolUse",
				}),
			() =>
				fauxAssistantMessage(fauxToolCall("context", { expression: "2 + 2" }, { id: "call-2" }), {
					stopReason: "toolUse",
				}),
			() => fauxAssistantMessage("done"),
		]);
		type ToolContext = { generation: number };
		/** 常量 generations 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const generations: number[] = [];
		/** 常量 contextTool 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const contextTool: AgentHarnessTool<ToolContext, typeof calculateTool.parameters, undefined> = {
			...calculateTool,
			name: "context",
			execute: async (toolCallId, params, signal, onUpdate, context) => {
				generations.push(context.generation);
				return await calculateTool.execute(toolCallId, params, signal, onUpdate);
			},
		};
		/** 变量 generation 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let generation = 0;
		/** 常量 harness 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const harness = new AgentHarness({
			models,
			session: new Session(new InMemorySessionStorage()),
			model: registration.getModel(),
			tools: [contextTool],
			toolContext: async (): Promise<ToolContext> => ({ generation: ++generation }),
		});

		await harness.prompt("hello");

		expect(generations).toEqual([1, 2]);
	});

	// 测试场景：验证“persists generated compaction usage”对应的行为、结果与边界。
	it("persists generated compaction usage", async () => {
		/** 常量 registration 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const registration = newFaux();
		registration.setResponses([fauxAssistantMessage("## Goal\nTest summary")]);
		/** 常量 session 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const session = new Session(new InMemorySessionStorage());
		await session.appendMessage(createUserMessage("one"));
		await session.appendMessage(createAssistantMessage("two"));
		/** 常量 harness 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const harness = new AgentHarness({
			models,
			session,
			model: registration.getModel(),
		});

		/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const result = await harness.compact();
		/** 常量 compaction 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const compaction = (await session.getEntries()).find((entry) => entry.type === "compaction");

		expect(result.usage?.totalTokens).toBeGreaterThan(0);
		expect(compaction?.type === "compaction" ? compaction.usage : undefined).toEqual(result.usage);
	});

	// 测试场景：验证“persists hook-provided compaction usage”对应的行为、结果与边界。
	it("persists hook-provided compaction usage", async () => {
		/** 常量 registration 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const registration = newFaux();
		/** 常量 usage 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const usage = createUsage(5, 6, 7, 8);
		/** 常量 session 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const session = new Session(new InMemorySessionStorage());
		await session.appendMessage(createUserMessage("one"));
		await session.appendMessage(createAssistantMessage("two"));
		/** 常量 harness 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const harness = new AgentHarness({
			models,
			session,
			model: registration.getModel(),
		});
		harness.on("session_before_compact", (event) => ({
			compaction: {
				summary: "hook summary",
				firstKeptEntryId: event.preparation.firstKeptEntryId,
				tokensBefore: event.preparation.tokensBefore,
				usage,
			},
		}));

		/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const result = await harness.compact();
		/** 常量 compaction 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const compaction = (await session.getEntries()).find((entry) => entry.type === "compaction");

		expect(result.usage).toEqual(usage);
		expect(compaction?.type === "compaction" ? compaction.usage : undefined).toEqual(usage);
	});

	// 用例分组：集中验证“summarization retries”相关功能。
	describe("summarization retries", () => {
		// 测试场景：验证“retries transient compaction errors and emits retry events”对应的行为、结果与边界。
		it("retries transient compaction errors and emits retry events", async () => {
			/** 常量 registration 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registration = newFaux();
			/** 变量 calls 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			let calls = 0;
			registration.setResponses([
				() => {
					calls++;
					return fauxAssistantMessage("", { stopReason: "error", errorMessage: "terminated" });
				},
				() => {
					calls++;
					return fauxAssistantMessage("## Goal\nRecovered summary");
				},
			]);
			/** 常量 session 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const session = new Session(new InMemorySessionStorage());
			await session.appendMessage(createUserMessage("one"));
			await session.appendMessage(createAssistantMessage("two"));
			/** 常量 harness 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const harness = new AgentHarness({
				models,
				session,
				model: registration.getModel(),
				retry: { enabled: true, maxRetries: 1, baseDelayMs: 0 },
			});
			/** 常量 retryEvents 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const retryEvents: string[] = [];
			harness.subscribe((event) => {
				if (
					event.type === "retry_scheduled" ||
					event.type === "retry_attempt_start" ||
					event.type === "retry_finished"
				) {
					retryEvents.push(`${event.type}:${event.operation}`);
				}
			});

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await harness.compact();

			expect(result.summary).toContain("Recovered summary");
			expect(calls).toBe(2);
			expect(retryEvents).toEqual([
				"retry_scheduled:compaction",
				"retry_attempt_start:compaction",
				"retry_finished:compaction",
			]);
		});

		// 测试场景：验证“does not retry non-retryable compaction errors”对应的行为、结果与边界。
		it("does not retry non-retryable compaction errors", async () => {
			/** 常量 registration 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registration = newFaux();
			/** 变量 calls 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			let calls = 0;
			registration.setResponses([
				() => {
					calls++;
					return fauxAssistantMessage("", { stopReason: "error", errorMessage: "insufficient_quota" });
				},
			]);
			/** 常量 session 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const session = new Session(new InMemorySessionStorage());
			await session.appendMessage(createUserMessage("one"));
			await session.appendMessage(createAssistantMessage("two"));
			/** 常量 harness 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const harness = new AgentHarness({
				models,
				session,
				model: registration.getModel(),
				retry: { enabled: true, maxRetries: 1, baseDelayMs: 0 },
			});
			/** 常量 retryEvents 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const retryEvents: string[] = [];
			harness.subscribe((event) => {
				if (
					event.type === "retry_scheduled" ||
					event.type === "retry_attempt_start" ||
					event.type === "retry_finished"
				) {
					retryEvents.push(event.type);
				}
			});

			await expect(harness.compact()).rejects.toThrow("insufficient_quota");

			expect(calls).toBe(1);
			expect(retryEvents).toEqual([]);
		});

		// 测试场景：验证“exhausts transient compaction retries after maxRetries failures”对应的行为、结果与边界。
		it("exhausts transient compaction retries after maxRetries failures", async () => {
			/** 常量 registration 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registration = newFaux();
			/** 变量 calls 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			let calls = 0;
			registration.setResponses(
				Array.from({ length: 4 }, () => () => {
					calls++;
					return fauxAssistantMessage("", { stopReason: "error", errorMessage: "terminated" });
				}),
			);
			/** 常量 session 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const session = new Session(new InMemorySessionStorage());
			await session.appendMessage(createUserMessage("one"));
			await session.appendMessage(createAssistantMessage("two"));
			/** 常量 harness 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const harness = new AgentHarness({
				models,
				session,
				model: registration.getModel(),
				retry: { enabled: true, maxRetries: 3, baseDelayMs: 0 },
			});
			/** 常量 retryEvents 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const retryEvents: string[] = [];
			harness.subscribe((event) => {
				if (
					event.type === "retry_scheduled" ||
					event.type === "retry_attempt_start" ||
					event.type === "retry_finished"
				) {
					retryEvents.push(`${event.type}:${event.operation}`);
				}
			});

			await expect(harness.compact()).rejects.toThrow("terminated");

			expect(calls).toBe(4);
			expect(retryEvents).toEqual([
				"retry_scheduled:compaction",
				"retry_attempt_start:compaction",
				"retry_scheduled:compaction",
				"retry_attempt_start:compaction",
				"retry_scheduled:compaction",
				"retry_attempt_start:compaction",
				"retry_finished:compaction",
			]);
		});

		// 测试场景：验证“retries transient branch summary errors and emits retry events”对应的行为、结果与边界。
		it("retries transient branch summary errors and emits retry events", async () => {
			/** 常量 registration 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const registration = newFaux();
			/** 变量 calls 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			let calls = 0;
			registration.setResponses([
				() => {
					calls++;
					return fauxAssistantMessage("", { stopReason: "error", errorMessage: "terminated" });
				},
				() => {
					calls++;
					return fauxAssistantMessage("## Goal\nRecovered branch summary");
				},
			]);
			/** 常量 session 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const session = new Session(new InMemorySessionStorage());
			/** 常量 targetId 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const targetId = await session.appendMessage(createUserMessage("first branch"));
			await session.appendMessage(createAssistantMessage("first reply"));
			await session.appendMessage(createUserMessage("abandoned work"));
			await session.appendMessage(createAssistantMessage("abandoned reply"));
			/** 常量 harness 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const harness = new AgentHarness({
				models,
				session,
				model: registration.getModel(),
				retry: { enabled: true, maxRetries: 1, baseDelayMs: 0 },
			});
			/** 常量 retryEvents 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const retryEvents: string[] = [];
			harness.subscribe((event) => {
				if (
					event.type === "retry_scheduled" ||
					event.type === "retry_attempt_start" ||
					event.type === "retry_finished"
				) {
					retryEvents.push(`${event.type}:${event.operation}`);
				}
			});

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await harness.navigateTree(targetId, { summarize: true });

			expect(result.summaryEntry?.summary).toContain("Recovered branch summary");
			expect(calls).toBe(2);
			expect(retryEvents).toEqual([
				"retry_scheduled:branch_summary",
				"retry_attempt_start:branch_summary",
				"retry_finished:branch_summary",
			]);
		});
	});

	// 测试场景：验证“persists generated branch summary usage”对应的行为、结果与边界。
	it("persists generated branch summary usage", async () => {
		/** 常量 registration 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const registration = newFaux();
		registration.setResponses([fauxAssistantMessage("## Goal\nBranch summary")]);
		/** 常量 session 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const session = new Session(new InMemorySessionStorage());
		/** 常量 targetId 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const targetId = await session.appendMessage(createUserMessage("first branch"));
		await session.appendMessage(createAssistantMessage("first reply"));
		await session.appendMessage(createUserMessage("abandoned work"));
		await session.appendMessage(createAssistantMessage("abandoned reply"));
		/** 常量 harness 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const harness = new AgentHarness({
			models,
			session,
			model: registration.getModel(),
		});

		/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const result = await harness.navigateTree(targetId, { summarize: true });

		expect(result.summaryEntry?.usage?.totalTokens).toBeGreaterThan(0);
	});

	// 测试场景：验证“persists hook-provided branch summary usage”对应的行为、结果与边界。
	it("persists hook-provided branch summary usage", async () => {
		/** 常量 registration 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const registration = newFaux();
		/** 常量 usage 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const usage = createUsage(13, 14, 15, 16);
		/** 常量 session 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const session = new Session(new InMemorySessionStorage());
		/** 常量 targetId 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const targetId = await session.appendMessage(createUserMessage("first branch"));
		await session.appendMessage(createAssistantMessage("first reply"));
		await session.appendMessage(createUserMessage("abandoned work"));
		await session.appendMessage(createAssistantMessage("abandoned reply"));
		/** 常量 harness 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const harness = new AgentHarness({
			models,
			session,
			model: registration.getModel(),
		});
		harness.on("session_before_tree", () => ({
			summary: { summary: "hook branch summary", usage },
		}));

		/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const result = await harness.navigateTree(targetId, { summarize: true });

		expect(result.summaryEntry?.usage).toEqual(usage);
	});

	// 测试场景：验证“preserves app tool types for getters and update events”对应的行为、结果与边界。
	it("preserves app tool types for getters and update events", async () => {
		/** 常量 session 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const session = new Session(new InMemorySessionStorage());
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = getModel("anthropic", "claude-sonnet-4-5");
		type AppTool = AgentTool<typeof calculateTool.parameters, undefined> & { source: "builtin" | "extension" };
		/** 常量 inspectTool 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const inspectTool: AppTool = { ...calculateTool, name: "inspect", source: "builtin" };
		/** 常量 searchTool 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const searchTool: AppTool = { ...calculateTool, name: "search", source: "extension" };
		/** 常量 harness 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const harness = new AgentHarness<undefined, AppSkill, AppPromptTemplate, AppTool>({
			models,
			session,
			model,
			tools: [inspectTool, searchTool],
			activeToolNames: ["inspect"],
		});
		/** 常量 updates 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const updates: Array<{
			toolNames: string[];
			previousToolNames: string[];
			activeToolNames: string[];
			previousActiveToolNames: string[];
			source: "set" | "restore";
		}> = [];
		harness.subscribe((event) => {
			if (event.type === "tools_update") {
				updates.push({
					toolNames: event.toolNames,
					previousToolNames: event.previousToolNames,
					activeToolNames: event.activeToolNames,
					previousActiveToolNames: event.previousActiveToolNames,
					source: event.source,
				});
				expect(harness.getActiveTools().map((tool) => tool.name)).toEqual(event.activeToolNames);
			}
		});

		/** 常量 tools 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tools = harness.getTools();
		/** 常量 activeTools 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const activeTools = harness.getActiveTools();
		tools.pop();
		activeTools.pop();
		expect(harness.getTools().map((tool) => tool.name)).toEqual(["inspect", "search"]);
		expect(harness.getActiveTools().map((tool) => tool.source)).toEqual(["builtin"]);

		await harness.setActiveTools(["search"]);
		await harness.setTools([searchTool], ["search"]);
		await expect(harness.setActiveTools(["missing"])).rejects.toMatchObject({ code: "invalid_argument" });
		await expect(harness.setActiveTools(["search", "search"])).rejects.toMatchObject({ code: "invalid_argument" });
		await expect(harness.setTools([inspectTool])).rejects.toMatchObject({ code: "invalid_argument" });
		await expect(harness.setTools([inspectTool, inspectTool], ["inspect"])).rejects.toMatchObject({
			code: "invalid_argument",
		});

		expect(updates).toEqual([
			{
				toolNames: ["inspect", "search"],
				previousToolNames: ["inspect", "search"],
				activeToolNames: ["search"],
				previousActiveToolNames: ["inspect"],
				source: "set",
			},
			{
				toolNames: ["search"],
				previousToolNames: ["inspect", "search"],
				activeToolNames: ["search"],
				previousActiveToolNames: ["search"],
				source: "set",
			},
		]);
		expect(harness.getTools().map((tool) => tool.source)).toEqual(["extension"]);
		expect(harness.getActiveTools().map((tool) => tool.name)).toEqual(["search"]);
		expect((await session.buildContext()).activeToolNames).toEqual(["search"]);
	});

	// 测试场景：验证“validates constructor tool names”对应的行为、结果与边界。
	it("validates constructor tool names", () => {
		/** 常量 session 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const session = new Session(new InMemorySessionStorage());
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = getModel("anthropic", "claude-sonnet-4-5");
		expect(
			() => new AgentHarness({ session, models, model, tools: [calculateTool], activeToolNames: ["missing"] }),
		).toThrow(/Unknown tool/);
		expect(
			() =>
				new AgentHarness({
					models,
					session,
					model,
					tools: [calculateTool, calculateTool],
					activeToolNames: [calculateTool.name],
				}),
		).toThrow(/Duplicate tool/);
		expect(
			() =>
				new AgentHarness({
					models,
					session,
					model,
					tools: [calculateTool],
					activeToolNames: [calculateTool.name, calculateTool.name],
				}),
		).toThrow(/Duplicate active tool/);
	});

	// 测试场景：验证“preserves app resource types for getters and update events”对应的行为、结果与边界。
	it("preserves app resource types for getters and update events", async () => {
		/** 常量 session 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const session = new Session(new InMemorySessionStorage());
		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model = getModel("anthropic", "claude-sonnet-4-5");
		/** 常量 harness 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const harness = new AgentHarness<undefined, AppSkill, AppPromptTemplate, AgentTool>({
			session,
			models,
			model,
		});
		/** 常量 skill 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const skill: AppSkill = {
			name: "inspect",
			description: "Inspect things",
			content: "Use inspection tools.",
			filePath: "/skills/inspect/SKILL.md",
			source: "project",
		};
		/** 常量 promptTemplate 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const promptTemplate: AppPromptTemplate = { name: "review", content: "Review $1", source: "user" };
		/** 常量 resources 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const resources = { skills: [skill], promptTemplates: [promptTemplate] };
		/** 常量 updates 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const updates: Array<{ resourcesSource?: string; previousSource?: string }> = [];
		harness.subscribe((event) => {
			if (event.type === "resources_update") {
				updates.push({
					resourcesSource: event.resources.skills?.[0]?.source,
					previousSource: event.previousResources.skills?.[0]?.source,
				});
			}
		});

		await harness.setResources(resources);
		await harness.setResources(resources);
		/** 常量 resolved 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const resolved = harness.getResources();

		expect(updates).toEqual([
			{ resourcesSource: "project", previousSource: undefined },
			{ resourcesSource: "project", previousSource: "project" },
		]);
		expect(resolved.skills?.[0]?.source).toBe("project");
		expect(resolved.promptTemplates?.[0]?.source).toBe("user");
		expect(resolved.skills).not.toBe(resources.skills);
		expect(resolved.promptTemplates).not.toBe(resources.promptTemplates);
	});
});
