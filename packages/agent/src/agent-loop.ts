/**
 * Agent loop that works with AgentMessage throughout.
 * Transforms to Message[] only at the LLM call boundary.
 */
/**
 * 【文件职责】实现低层代理循环（agent loop）：驱动“流式请求助手回复 → 执行工具调用 → 注入转向/追问消息 →
 *              再请求”的完整循环；全流程使用 AgentMessage，仅在调用 LLM 边界才转换为 Message[]。
 * 【技术维度】异步事件驱动：EventStream 封装事件流；AbortSignal 支持中止；串行/并行两种工具执行策略；
 *              钩子链（transformContext → convertToLlm → beforeToolCall → execute → afterToolCall）逐层定制。
 * 【产品维度】这是智能体“思考-行动”循环的心脏：模型每说一句话要调哪些工具、结果如何回灌、用户如何中途插话，全部在此编排。
 * 【逻辑维度】入口 agentLoop/agentLoopContinue（事件流版）与 runAgentLoop/runAgentLoopContinue（Promise 版）→
 *              共享主循环 runLoop（外层处理追问、内层处理转向与工具）→ streamAssistantResponse 流式请求 →
 *              工具准备/执行/收尾三段式（prepareToolCall / executePreparedToolCall / finalizeExecutedToolCall）。
 * 【关键边界】回调契约禁止抛异常；stopReason 为 length 时所有工具调用按失败处理（参数可能被截断）；
 *              并行模式下结束事件按完成顺序、结果消息按原始顺序产出。
 * 【新手阅读建议】先读 runLoop 理解双层 while 循环骨架 → 再读 streamAssistantResponse 看消息如何进出上下文 →
 *              最后读工具三段式函数掌握工具调用全生命周期。
 */

import {
	type AssistantMessage,
	type Context,
	EventStream,
	type ToolResultMessage,
	validateToolArguments,
} from "@earendil-works/pi-ai";
import { getDefaultStreamFn } from "./stream-fn.ts";
import type {
	AgentContext,
	AgentEvent,
	AgentLoopConfig,
	AgentMessage,
	AgentTool,
	AgentToolCall,
	AgentToolResult,
	StreamFn,
} from "./types.ts";

/** 事件汇类型（中文说明）：循环产出的每个 AgentEvent 都通过此回调交出去；可同步可异步。 */
export type AgentEventSink = (event: AgentEvent) => Promise<void> | void;

/**
 * Start an agent loop with a new prompt message.
 * The prompt is added to the context and events are emitted for it.
 */
// 以“新提示”启动代理循环（事件流版）：提示消息会并入上下文并发出相应事件。
// 参数 prompts —— 初始提示消息数组；context —— 初始上下文；config —— 循环配置；
// signal —— 中止信号；streamFn —— 流式函数。返回事件流（agent_end 时结束，结果为本次新增消息）。
// 使用示例：agentLoop([{role:"user",content:[...]}], ctx, cfg, signal, streamFn).forEach(...)
export function agentLoop(
	prompts: AgentMessage[],
	context: AgentContext,
	config: AgentLoopConfig,
	signal: AbortSignal | undefined,
	streamFn: StreamFn,
): EventStream<AgentEvent, AgentMessage[]> {
	// 创建以 agent_end 为终止事件的事件流
	const stream = createAgentStream();

	// 后台启动 Promise 版循环，把事件推入流、结束时以新增消息收尾
	void runAgentLoop(
		prompts,
		context,
		config,
		async (event) => {
			stream.push(event);
		},
		signal,
		streamFn,
	).then((messages) => {
		stream.end(messages);
	});

	return stream;
}

/**
 * Continue an agent loop from the current context without adding a new message.
 * Used for retries - context already has user message or tool results.
 *
 * **Important:** The last message in context must convert to a `user` or `toolResult` message
 * via `convertToLlm`. If it doesn't, the LLM provider will reject the request.
 * This cannot be validated here since `convertToLlm` is only called once per turn.
 */
// 从现有上下文续跑代理循环（事件流版），不新增消息；常用于重试场景。
// 重要约束：最后一条消息经 convertToLlm 转换后必须是 user 或 toolResult，否则会被供应商拒绝；
// 本函数无法提前校验（convertToLlm 每轮只调用一次）。
export function agentLoopContinue(
	context: AgentContext,
	config: AgentLoopConfig,
	signal: AbortSignal | undefined,
	streamFn: StreamFn,
): EventStream<AgentEvent, AgentMessage[]> {
	// 防御：空上下文无法续跑
	if (context.messages.length === 0) {
		throw new Error("Cannot continue: no messages in context");
	}

	// 防御：不能从助手消息续跑
	if (context.messages[context.messages.length - 1].role === "assistant") {
		throw new Error("Cannot continue from message role: assistant");
	}

	const stream = createAgentStream();

	void runAgentLoopContinue(
		context,
		config,
		async (event) => {
			stream.push(event);
		},
		signal,
		streamFn,
	).then((messages) => {
		stream.end(messages);
	});

	return stream;
}

/**
 * 以“新提示”启动循环的 Promise 版（中文说明）：
 * 先把提示并入上下文副本，发出 agent_start / turn_start / 每条提示的 message_start+message_end，
 * 再进入共享主循环 runLoop；返回本次运行新增的全部消息。
 */
export async function runAgentLoop(
	prompts: AgentMessage[],
	context: AgentContext,
	config: AgentLoopConfig,
	emit: AgentEventSink,
	signal: AbortSignal | undefined,
	streamFn: StreamFn,
): Promise<AgentMessage[]> {
	// 本次运行新增的消息（从提示开始累计）
	const newMessages: AgentMessage[] = [...prompts];
	// 上下文副本：原消息 + 提示消息
	const currentContext: AgentContext = {
		...context,
		messages: [...context.messages, ...prompts],
	};

	// 代理与首轮生命周期开启
	await emit({ type: "agent_start" });
	await emit({ type: "turn_start" });
	for (const prompt of prompts) {
		// 每条提示消息发出开始/结束事件
		await emit({ type: "message_start", message: prompt });
		await emit({ type: "message_end", message: prompt });
	}

	// 进入主循环；未传流式函数时回退全局默认
	await runLoop(currentContext, newMessages, config, signal, emit, streamFn ?? getDefaultStreamFn());
	return newMessages;
}

/**
 * 续跑循环的 Promise 版（中文说明）：不新增消息，直接基于现有上下文继续；
 * 前置校验与事件流版相同（非空、末条非 assistant）。返回本次新增消息。
 */
export async function runAgentLoopContinue(
	context: AgentContext,
	config: AgentLoopConfig,
	emit: AgentEventSink,
	signal: AbortSignal | undefined,
	streamFn: StreamFn,
): Promise<AgentMessage[]> {
	if (context.messages.length === 0) {
		throw new Error("Cannot continue: no messages in context");
	}

	if (context.messages[context.messages.length - 1].role === "assistant") {
		throw new Error("Cannot continue from message role: assistant");
	}

	// 续跑没有初始提示，新增消息从空开始
	const newMessages: AgentMessage[] = [];
	// 浅复制上下文，避免污染调用方对象
	const currentContext: AgentContext = { ...context };

	await emit({ type: "agent_start" });
	await emit({ type: "turn_start" });

	await runLoop(currentContext, newMessages, config, signal, emit, streamFn ?? getDefaultStreamFn());
	return newMessages;
}

// 创建代理事件流（私有）：以 agent_end 为终止事件，其 messages 字段作为流的最终结果
function createAgentStream(): EventStream<AgentEvent, AgentMessage[]> {
	return new EventStream<AgentEvent, AgentMessage[]>(
		(event: AgentEvent) => event.type === "agent_end",
		(event: AgentEvent) => (event.type === "agent_end" ? event.messages : []),
	);
}

/**
 * Main loop logic shared by agentLoop and agentLoopContinue.
 */
// 共享主循环（私有）：双层 while 结构——
// 内层：有工具调用或有转向消息就继续（流式回复 → 执行工具 → prepareNextTurn → shouldStopAfterTurn → 取转向消息）；
// 外层：内层退出后检查追问队列，非空则继续内层，否则结束并发出 agent_end。
async function runLoop(
	initialContext: AgentContext,
	newMessages: AgentMessage[],
	initialConfig: AgentLoopConfig,
	signal: AbortSignal | undefined,
	emit: AgentEventSink,
	streamFunction: StreamFn,
): Promise<void> {
	// 当前上下文（可能被 prepareNextTurn 替换）
	let currentContext = initialContext;
	// 当前配置（可能被 prepareNextTurn 替换）
	let config = initialConfig;
	// 首轮标志：首轮的 turn_start 已在外层入口发出，内层不再重复
	let firstTurn = true;
	// Check for steering messages at start (user may have typed while waiting)
	// 启动时先取一次转向消息（用户可能在等待期间已输入）
	let pendingMessages: AgentMessage[] = (await config.getSteeringMessages?.()) || [];

	// Outer loop: continues when queued follow-up messages arrive after agent would stop
	// 外层循环：代理本应停止时若追问队列非空则继续
	while (true) {
		// 是否还有工具调用需要继续循环
		let hasMoreToolCalls = true;

		// Inner loop: process tool calls and steering messages
		// 内层循环：处理工具调用与转向消息
		while (hasMoreToolCalls || pendingMessages.length > 0) {
			if (!firstTurn) {
				// 非首轮才补发 turn_start
				await emit({ type: "turn_start" });
			} else {
				firstTurn = false;
			}

			// Process pending messages (inject before next assistant response)
			// 注入待处理消息（在下一次助手回复之前进入上下文）
			if (pendingMessages.length > 0) {
				for (const message of pendingMessages) {
					await emit({ type: "message_start", message });
					await emit({ type: "message_end", message });
					currentContext.messages.push(message);
					newMessages.push(message);
				}
				pendingMessages = [];
			}

			// Stream assistant response
			// 流式获取助手回复
			const message = await streamAssistantResponse(currentContext, config, signal, emit, streamFunction);
			newMessages.push(message);

			// 出错或被中止：直接结束本轮与整个运行
			if (message.stopReason === "error" || message.stopReason === "aborted") {
				await emit({ type: "turn_end", message, toolResults: [] });
				await emit({ type: "agent_end", messages: newMessages });
				return;
			}

			// Check for tool calls
			// 抽取本条消息中的全部工具调用
			const toolCalls = message.content.filter((c) => c.type === "toolCall");

			// 本轮的工具结果消息集合
			const toolResults: ToolResultMessage[] = [];
			hasMoreToolCalls = false;
			if (toolCalls.length > 0) {
				// A "length" stop means the output was cut off by the token limit, so
				// every tool call in the message may carry truncated arguments. Fail
				// them all instead of executing potentially borked calls.
				// stopReason 为 length 说明输出被 token 上限截断，工具参数可能不完整：
				// 全部按失败处理而不是冒险执行
				const executedToolBatch =
					message.stopReason === "length"
						? await failToolCallsFromTruncatedMessage(toolCalls, emit)
						: await executeToolCalls(currentContext, message, config, signal, emit);
				toolResults.push(...executedToolBatch.messages);
				// 批内全部工具都要求终止时提前结束循环
				hasMoreToolCalls = !executedToolBatch.terminate;

				// 工具结果写回上下文与新增消息
				for (const result of toolResults) {
					currentContext.messages.push(result);
					newMessages.push(result);
				}
			}

			// 本轮结束
			await emit({ type: "turn_end", message, toolResults });

			// 组装 prepareNextTurn 上下文并调用；返回值可替换上下文/模型/思考强度
			const nextTurnContext = {
				message,
				toolResults,
				context: currentContext,
				newMessages,
			};
			const nextTurnSnapshot = await config.prepareNextTurn?.(nextTurnContext);
			if (nextTurnSnapshot) {
				currentContext = nextTurnSnapshot.context ?? currentContext;
				config = {
					...config,
					model: nextTurnSnapshot.model ?? config.model,
					// 思考强度：off 映射为 undefined（不下发），其余原样
					reasoning:
						nextTurnSnapshot.thinkingLevel === undefined
							? config.reasoning
							: nextTurnSnapshot.thinkingLevel === "off"
								? undefined
								: nextTurnSnapshot.thinkingLevel,
				};
			}

			// 钩子请求停止：优雅退出
			if (
				await config.shouldStopAfterTurn?.({
					message,
					toolResults,
					context: currentContext,
					newMessages,
				})
			) {
				await emit({ type: "agent_end", messages: newMessages });
				return;
			}

			// 取下一批转向消息，决定内层是否继续
			pendingMessages = (await config.getSteeringMessages?.()) || [];
		}

		// Agent would stop here. Check for follow-up messages.
		// 代理本应停止：检查追问队列
		const followUpMessages = (await config.getFollowUpMessages?.()) || [];
		if (followUpMessages.length > 0) {
			// Set as pending so inner loop processes them
			// 作为待处理消息交给内层循环
			pendingMessages = followUpMessages;
			continue;
		}

		// No more messages, exit
		// 无更多消息：退出
		break;
	}

	await emit({ type: "agent_end", messages: newMessages });
}

/**
 * Stream an assistant response from the LLM.
 * This is where AgentMessage[] gets transformed to Message[] for the LLM.
 */
// 流式获取助手回复（私有）：AgentMessage[] 在这里被转换为 LLM 的 Message[]。
// 流程：transformContext（可选）→ convertToLlm → 组装 LLM Context → 解析 API key → 调用流式函数 →
// 按事件维护上下文中的“进行中消息”并在 done/error 时落定。
async function streamAssistantResponse(
	context: AgentContext,
	config: AgentLoopConfig,
	signal: AbortSignal | undefined,
	emit: AgentEventSink,
	streamFunction: StreamFn,
): Promise<AssistantMessage> {
	// Apply context transform if configured (AgentMessage[] → AgentMessage[])
	// 可选的上下文预变换（仍在 AgentMessage 粒度）
	let messages = context.messages;
	if (config.transformContext) {
		messages = await config.transformContext(messages, signal);
	}

	// Convert to LLM-compatible messages (AgentMessage[] → Message[])
	// 转换为 LLM 兼容消息
	const llmMessages = await config.convertToLlm(messages);

	// Build LLM context
	// 组装 LLM 上下文：系统提示词 + 转换后的消息 + 工具
	const llmContext: Context = {
		systemPrompt: context.systemPrompt,
		messages: llmMessages,
		tools: context.tools,
	};

	// Resolve API key (important for expiring tokens)
	// 解析 API 密钥（动态钩子优先，回退静态配置；对会过期的令牌很关键）
	const resolvedApiKey =
		(config.getApiKey ? await config.getApiKey(config.model.provider) : undefined) || config.apiKey;

	// 调用流式函数发起请求（配置整体透传并覆盖密钥与信号）
	const response = await streamFunction(config.model, llmContext, {
		...config,
		apiKey: resolvedApiKey,
		signal,
	});

	// 当前进行中的部分助手消息
	let partialMessage: AssistantMessage | null = null;
	// 是否已把部分消息放入上下文
	let addedPartial = false;

	for await (const event of response) {
		switch (event.type) {
			case "start":
				// 流开始：登记部分消息并发出 message_start
				partialMessage = event.partial;
				context.messages.push(partialMessage);
				addedPartial = true;
				await emit({ type: "message_start", message: { ...partialMessage } });
				break;

			case "text_start":
			case "text_delta":
			case "text_end":
			case "thinking_start":
			case "thinking_delta":
			case "thinking_end":
			case "toolcall_start":
			case "toolcall_delta":
			case "toolcall_end":
				// 各类增量事件：用最新部分消息替换上下文末尾并转发 message_update
				if (partialMessage) {
					partialMessage = event.partial;
					context.messages[context.messages.length - 1] = partialMessage;
					await emit({
						type: "message_update",
						assistantMessageEvent: event,
						message: { ...partialMessage },
					});
				}
				break;

			case "done":
			case "error": {
				// 结束/出错：取最终消息落定上下文并发出 message_end
				const finalMessage = await response.result();
				if (addedPartial) {
					context.messages[context.messages.length - 1] = finalMessage;
				} else {
					context.messages.push(finalMessage);
				}
				if (!addedPartial) {
					await emit({ type: "message_start", message: { ...finalMessage } });
				}
				await emit({ type: "message_end", message: finalMessage });
				return finalMessage;
			}
		}
	}

	// 流未发 done/error 就耗尽的兜底路径
	const finalMessage = await response.result();
	if (addedPartial) {
		context.messages[context.messages.length - 1] = finalMessage;
	} else {
		context.messages.push(finalMessage);
		await emit({ type: "message_start", message: { ...finalMessage } });
	}
	await emit({ type: "message_end", message: finalMessage });
	return finalMessage;
}

/**
 * Fail all tool calls from an assistant message that was truncated by the
 * output token limit. Streamed tool-call arguments are finalized with a
 * best-effort JSON salvage parser, so a truncated message can yield tool calls
 * whose arguments parse and validate but are silently incomplete. None of them
 * are safe to execute; report each as an error so the model can re-issue them.
 */
// 截断消息的失败处理（私有）：stopReason=length 时输出被 token 上限截断，
// 流式工具参数经“尽力修复”的 JSON 解析后可能看似合法实则残缺，一律不执行，
// 逐个报告为错误结果，让模型用完整参数重新发起调用。
async function failToolCallsFromTruncatedMessage(
	toolCalls: AgentToolCall[],
	emit: AgentEventSink,
): Promise<ExecutedToolCallBatch> {
	// 生成的错误工具结果消息集合
	const messages: ToolResultMessage[] = [];
	for (const toolCall of toolCalls) {
		// 仍按正常流程发出 start 事件，保证 UI 一致
		await emit({
			type: "tool_execution_start",
			toolCallId: toolCall.id,
			toolName: toolCall.name,
			args: toolCall.arguments,
		});
		// 构造“因截断未执行”的失败结果
		const finalized: FinalizedToolCallOutcome = {
			toolCall,
			result: createErrorToolResult(
				`Tool call "${toolCall.name}" was not executed: the response hit the output token limit, so its arguments may be truncated. Re-issue the tool call with complete arguments.`,
			),
			isError: true,
		};
		await emitToolExecutionEnd(finalized, emit);
		const toolResultMessage = createToolResultMessage(finalized);
		await emitToolResultMessage(toolResultMessage, emit);
		messages.push(toolResultMessage);
	}
	return { messages, terminate: false };
}

/**
 * Execute tool calls from an assistant message.
 */
// 工具调用执行调度（私有）：任一工具声明为 sequential 或全局配置为 sequential 时走串行，否则并行。
async function executeToolCalls(
	currentContext: AgentContext,
	assistantMessage: AssistantMessage,
	config: AgentLoopConfig,
	signal: AbortSignal | undefined,
	emit: AgentEventSink,
): Promise<ExecutedToolCallBatch> {
	// 本条消息中的全部工具调用
	const toolCalls = assistantMessage.content.filter((c) => c.type === "toolCall");
	// 是否存在声明为串行的工具
	const hasSequentialToolCall = toolCalls.some(
		(tc) => currentContext.tools?.find((t) => t.name === tc.name)?.executionMode === "sequential",
	);
	if (config.toolExecution === "sequential" || hasSequentialToolCall) {
		return executeToolCallsSequential(currentContext, assistantMessage, toolCalls, config, signal, emit);
	}
	return executeToolCallsParallel(currentContext, assistantMessage, toolCalls, config, signal, emit);
}

/** 一次工具批次执行结果（中文说明）：messages —— 工具结果消息；terminate —— 是否批内全部要求终止。 */
type ExecutedToolCallBatch = {
	messages: ToolResultMessage[];
	terminate: boolean;
};

// 串行执行工具调用（私有）：逐个“start → 准备 → 执行 → 收尾 → end → 结果消息”，
// 中止信号触发时提前跳出循环
async function executeToolCallsSequential(
	currentContext: AgentContext,
	assistantMessage: AssistantMessage,
	toolCalls: AgentToolCall[],
	config: AgentLoopConfig,
	signal: AbortSignal | undefined,
	emit: AgentEventSink,
): Promise<ExecutedToolCallBatch> {
	// 已收尾的调用结果（用于判断 terminate）
	const finalizedCalls: FinalizedToolCallOutcome[] = [];
	// 工具结果消息集合
	const messages: ToolResultMessage[] = [];

	for (const toolCall of toolCalls) {
		// 发出开始执行事件
		await emit({
			type: "tool_execution_start",
			toolCallId: toolCall.id,
			toolName: toolCall.name,
			args: toolCall.arguments,
		});

		// 准备阶段（查找工具/参数处理/校验/前置钩子）
		const preparation = await prepareToolCall(currentContext, assistantMessage, toolCall, config, signal);
		let finalized: FinalizedToolCallOutcome;
		if (preparation.kind === "immediate") {
			// 立即失败（未找到/被拦截/校验失败/中止）
			finalized = {
				toolCall,
				result: preparation.result,
				isError: preparation.isError,
			};
		} else {
			// 真正执行并收尾（含后置钩子）
			const executed = await executePreparedToolCall(preparation, signal, emit);
			finalized = await finalizeExecutedToolCall(
				currentContext,
				assistantMessage,
				preparation,
				executed,
				config,
				signal,
			);
		}

		// 发出结束事件与结果消息
		await emitToolExecutionEnd(finalized, emit);
		const toolResultMessage = createToolResultMessage(finalized);
		await emitToolResultMessage(toolResultMessage, emit);
		finalizedCalls.push(finalized);
		messages.push(toolResultMessage);

		// 中止时停止后续工具
		if (signal?.aborted) {
			break;
		}
	}

	return {
		messages,
		terminate: shouldTerminateToolBatch(finalizedCalls),
	};
}

// 并行执行工具调用（私有）：准备工作仍按序进行（保证事件顺序），
// 允许执行的工具并发跑；结束事件按完成顺序发出，结果消息按原始调用顺序产出
async function executeToolCallsParallel(
	currentContext: AgentContext,
	assistantMessage: AssistantMessage,
	toolCalls: AgentToolCall[],
	config: AgentLoopConfig,
	signal: AbortSignal | undefined,
	emit: AgentEventSink,
): Promise<ExecutedToolCallBatch> {
	// 每项是“已完成结果”或“异步执行函数”
	const finalizedCalls: FinalizedToolCallEntry[] = [];

	for (const toolCall of toolCalls) {
		// 按原始顺序发出 start 事件
		await emit({
			type: "tool_execution_start",
			toolCallId: toolCall.id,
			toolName: toolCall.name,
			args: toolCall.arguments,
		});

		const preparation = await prepareToolCall(currentContext, assistantMessage, toolCall, config, signal);
		if (preparation.kind === "immediate") {
			// 立即失败：直接收尾，不进入并发队列
			const finalized = {
				toolCall,
				result: preparation.result,
				isError: preparation.isError,
			} satisfies FinalizedToolCallOutcome;
			await emitToolExecutionEnd(finalized, emit);
			finalizedCalls.push(finalized);
			if (signal?.aborted) {
				break;
			}
			continue;
		}

		// 推入并发执行闭包
		finalizedCalls.push(async () => {
			const executed = await executePreparedToolCall(preparation, signal, emit);
			const finalized = await finalizeExecutedToolCall(
				currentContext,
				assistantMessage,
				preparation,
				executed,
				config,
				signal,
			);
			await emitToolExecutionEnd(finalized, emit);
			return finalized;
		});
		if (signal?.aborted) {
			break;
		}
	}

	// 等待全部完成；函数项此时才真正并发执行
	const orderedFinalizedCalls = await Promise.all(
		finalizedCalls.map((entry) => (typeof entry === "function" ? entry() : Promise.resolve(entry))),
	);
	// 按原始顺序生成结果消息
	const messages: ToolResultMessage[] = [];
	for (const finalized of orderedFinalizedCalls) {
		const toolResultMessage = createToolResultMessage(finalized);
		await emitToolResultMessage(toolResultMessage, emit);
		messages.push(toolResultMessage);
	}

	return {
		messages,
		terminate: shouldTerminateToolBatch(orderedFinalizedCalls),
	};
}

/** 已就绪的工具调用（中文说明）：工具已找到、参数已校验，等待执行。 */
type PreparedToolCall = {
	kind: "prepared";
	toolCall: AgentToolCall;
	tool: AgentTool<any>;
	args: unknown;
};

/** 立即出结果的工具调用（中文说明）：无需执行即有结论（未找到/被拦截/校验失败/中止）。 */
type ImmediateToolCallOutcome = {
	kind: "immediate";
	result: AgentToolResult<any>;
	isError: boolean;
};

/** 执行结果（中文说明）：工具真正运行后的结果与错误标记。 */
type ExecutedToolCallOutcome = {
	result: AgentToolResult<any>;
	isError: boolean;
};

/** 收尾结果（中文说明）：关联原调用 + 最终结果 + 错误标记，是产出工具结果消息的依据。 */
type FinalizedToolCallOutcome = {
	toolCall: AgentToolCall;
	result: AgentToolResult<any>;
	isError: boolean;
};

/** 并行批次条目（中文说明）：已完成的结果，或一个返回结果的异步闭包。 */
type FinalizedToolCallEntry = FinalizedToolCallOutcome | (() => Promise<FinalizedToolCallOutcome>);

// 判断本批是否应提前终止：批非空且每个结果都显式 terminate === true
function shouldTerminateToolBatch(finalizedCalls: FinalizedToolCallOutcome[]): boolean {
	return finalizedCalls.length > 0 && finalizedCalls.every((finalized) => finalized.result.terminate === true);
}

// 参数预处理（私有）：若工具声明了 prepareArguments 则对原始参数做兼容修正；无变化时原样返回
function prepareToolCallArguments(tool: AgentTool<any>, toolCall: AgentToolCall): AgentToolCall {
	if (!tool.prepareArguments) {
		return toolCall;
	}
	const preparedArguments = tool.prepareArguments(toolCall.arguments);
	if (preparedArguments === toolCall.arguments) {
		return toolCall;
	}
	return {
		...toolCall,
		arguments: preparedArguments as Record<string, any>,
	};
}

/**
 * 工具调用准备阶段（私有）：查找工具 → 参数预处理 → schema 校验 → beforeToolCall 前置钩子（可拦截）→
 * 中止检查。任何一步失败都以 kind:"immediate" 立即返回错误结果，不再执行。
 */
async function prepareToolCall(
	currentContext: AgentContext,
	assistantMessage: AssistantMessage,
	toolCall: AgentToolCall,
	config: AgentLoopConfig,
	signal: AbortSignal | undefined,
): Promise<PreparedToolCall | ImmediateToolCallOutcome> {
	// 按名称查找工具
	const tool = currentContext.tools?.find((t) => t.name === toolCall.name);
	if (!tool) {
		return {
			kind: "immediate",
			result: createErrorToolResult(`Tool ${toolCall.name} not found`),
			isError: true,
		};
	}

	try {
		// 参数兼容修正 + schema 校验
		const preparedToolCall = prepareToolCallArguments(tool, toolCall);
		const validatedArgs = validateToolArguments(tool, preparedToolCall);
		if (config.beforeToolCall) {
			// 前置钩子：可返回 block:true 拦截执行
			const beforeResult = await config.beforeToolCall(
				{
					assistantMessage,
					toolCall,
					args: validatedArgs,
					context: currentContext,
				},
				signal,
			);
			if (signal?.aborted) {
				return {
					kind: "immediate",
					result: createErrorToolResult("Operation aborted"),
					isError: true,
				};
			}
			if (beforeResult?.block) {
				return {
					kind: "immediate",
					result: createErrorToolResult(beforeResult.reason || "Tool execution was blocked"),
					isError: true,
				};
			}
		}
		if (signal?.aborted) {
			return {
				kind: "immediate",
				result: createErrorToolResult("Operation aborted"),
				isError: true,
			};
		}
		return {
			kind: "prepared",
			toolCall,
			tool,
			args: validatedArgs,
		};
	} catch (error) {
		// 校验或钩子抛错：转为错误结果
		return {
			kind: "immediate",
			result: createErrorToolResult(error instanceof Error ? error.message : String(error)),
			isError: true,
		};
	}
}

/**
 * 工具执行阶段（私有）：调用 tool.execute 并收集进度更新事件；
 * acceptingUpdates 保证工具 Promise 结束后到达的更新被忽略；执行抛错统一转为错误结果。
 */
async function executePreparedToolCall(
	prepared: PreparedToolCall,
	signal: AbortSignal | undefined,
	emit: AgentEventSink,
): Promise<ExecutedToolCallOutcome> {
	// 待完成的进度事件 Promise 列表
	const updateEvents: Promise<void>[] = [];
	// 是否仍接受进度更新
	let acceptingUpdates = true;

	try {
		const result = await prepared.tool.execute(
			prepared.toolCall.id,
			prepared.args as never,
			signal,
			(partialResult) => {
				if (!acceptingUpdates) return;
				updateEvents.push(
					Promise.resolve(
						emit({
							type: "tool_execution_update",
							toolCallId: prepared.toolCall.id,
							toolName: prepared.toolCall.name,
							args: prepared.toolCall.arguments,
							partialResult,
						}),
					),
				);
			},
		);
		acceptingUpdates = false;
		// 等全部进度事件发完再返回
		await Promise.all(updateEvents);
		return { result, isError: false };
	} catch (error) {
		acceptingUpdates = false;
		await Promise.all(updateEvents);
		return {
			result: createErrorToolResult(error instanceof Error ? error.message : String(error)),
			isError: true,
		};
	} finally {
		acceptingUpdates = false;
	}
}

/**
 * 工具收尾阶段（私有）：执行 afterToolCall 后置钩子，按字段覆盖执行结果；
 * 钩子自身抛错时把错误转为新的错误结果。返回最终收尾结果。
 */
async function finalizeExecutedToolCall(
	currentContext: AgentContext,
	assistantMessage: AssistantMessage,
	prepared: PreparedToolCall,
	executed: ExecutedToolCallOutcome,
	config: AgentLoopConfig,
	signal: AbortSignal | undefined,
): Promise<FinalizedToolCallOutcome> {
	// 当前结果与错误标记（可能被钩子覆盖）
	let result = executed.result;
	let isError = executed.isError;

	if (config.afterToolCall) {
		try {
			const afterResult = await config.afterToolCall(
				{
					assistantMessage,
					toolCall: prepared.toolCall,
					args: prepared.args,
					result,
					isError,
					context: currentContext,
				},
				signal,
			);
			if (afterResult) {
				// 字段级整体覆盖：未提供的字段保持原值
				result = {
					...result,
					content: afterResult.content ?? result.content,
					details: afterResult.details ?? result.details,
					usage: afterResult.usage ?? result.usage,
					terminate: afterResult.terminate ?? result.terminate,
				};
				isError = afterResult.isError ?? isError;
			}
		} catch (error) {
			result = createErrorToolResult(error instanceof Error ? error.message : String(error));
			isError = true;
		}
	}

	return {
		toolCall: prepared.toolCall,
		result,
		isError,
	};
}

// 构造错误型工具结果：单条文本内容 + 空详情
function createErrorToolResult(message: string): AgentToolResult<any> {
	return {
		content: [{ type: "text", text: message }],
		details: {},
	};
}

// 发出工具执行结束事件（私有）：字段直接取自收尾结果
async function emitToolExecutionEnd(finalized: FinalizedToolCallOutcome, emit: AgentEventSink): Promise<void> {
	await emit({
		type: "tool_execution_end",
		toolCallId: finalized.toolCall.id,
		toolName: finalized.toolCall.name,
		result: finalized.result,
		isError: finalized.isError,
	});
}

// 构造工具结果消息（私有）：把收尾结果规范化为 ToolResultMessage；
// 无类型工具（JS 扩展）可能返回无 content 的结果，这里归一化为空数组避免 null 进入会话历史
function createToolResultMessage(finalized: FinalizedToolCallOutcome): ToolResultMessage {
	return {
		role: "toolResult",
		toolCallId: finalized.toolCall.id,
		toolName: finalized.toolCall.name,
		// Untyped tools (JS extensions) can return results without content; normalize
		// so the null never enters session history or provider payloads.
		content: finalized.result.content ?? [],
		details: finalized.result.details,
		usage: finalized.result.usage,
		...(finalized.result.addedToolNames?.length ? { addedToolNames: finalized.result.addedToolNames } : {}),
		isError: finalized.isError,
		timestamp: Date.now(),
	};
}

// 发出工具结果消息事件（私有）：message_start + message_end 成对发出
async function emitToolResultMessage(toolResultMessage: ToolResultMessage, emit: AgentEventSink): Promise<void> {
	await emit({ type: "message_start", message: toolResultMessage });
	await emit({ type: "message_end", message: toolResultMessage });
}
