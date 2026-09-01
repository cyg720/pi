/**
 * 【文件职责】定义 agent 包的核心公共类型：流式函数契约（StreamFn）、工具执行模式、工具前后钩子的上下文与返回值、
 *              低层循环配置（AgentLoopConfig）、思考强度档位、自定义消息体系、代理状态（AgentState）、
 *              工具定义（AgentTool）与事件流（AgentEvent）。
 * 【技术维度】纯 TypeScript 类型声明：联合类型、泛型约束、Extract 工具类型，以及利用 TS“声明合并”实现的开放扩展点。
 * 【产品维度】是 Agent 运行时的“通用语言”：二次开发自定义工具、自定义消息、订阅事件、拦截工具调用都以这些类型为契约。
 * 【逻辑维度】脉络：StreamFn → 执行/队列模式 → 工具钩子上下文 → AgentLoopConfig（全部可定制钩子）→ ThinkingLevel
 *              → 自定义消息 → AgentState → 工具结果与回调 → AgentTool → AgentContext → AgentEvent。
 * 【关键边界】所有回调契约约定“不得抛出异常”（抛出会破坏低层循环的事件序列）；改字段语义直接影响 agent-loop 行为。
 * 【新手阅读建议】先读 AgentEvent 与 AgentState 了解运行时全貌；再读 AgentLoopConfig 掌握可定制点；最后精读 AgentTool 学习写自己的工具。
 */
import type {
	Api,
	AssistantMessage,
	AssistantMessageEvent,
	AssistantMessageEventStream,
	Context,
	ImageContent,
	Message,
	Model,
	SimpleStreamOptions,
	TextContent,
	Tool,
	ToolResultMessage,
	Usage,
} from "@earendil-works/pi-ai";
import type { Static, TSchema } from "typebox";

/**
 * Stream function used by the agent loop. `Models.streamSimple` satisfies
 * this shape.
 *
 * Contract:
 * - Must not throw or return a rejected promise for request/model/runtime failures.
 * - Must return an AssistantMessageEventStream.
 * - Failures must be encoded in the returned stream via protocol events and a
 *   final AssistantMessage with stopReason "error" or "aborted" and errorMessage.
 */
/**
 * 流式生成函数契约（中文说明）：
 * 参数 model —— 本次请求使用的模型对象；context —— 发送给模型的完整上下文（系统提示词 + 消息 + 工具）；
 * options —— 可选的流式选项。返回 AssistantMessageEventStream 事件流（可直接返回或以 Promise 包装返回）。
 * 使用示例：@earendil-works/pi-ai 包的 Models.streamSimple 即满足此签名，可作为默认 StreamFn 注入。
 */
export type StreamFn = (
	model: Model<Api>,
	context: Context,
	options?: SimpleStreamOptions,
) => AssistantMessageEventStream | Promise<AssistantMessageEventStream>;

/**
 * Configuration for how tool calls from a single assistant message are executed.
 *
 * - "sequential": each tool call is prepared, executed, and finalized before the next one starts.
 * - "parallel": tool calls are prepared sequentially, then allowed tools execute concurrently.
 *   `tool_execution_end` is emitted in tool completion order after each tool is finalized,
 *   while tool-result message artifacts are emitted later in assistant source order.
 */
/**
 * 工具执行模式（中文说明）："sequential" 严格串行，一个工具完整执行完才开始下一个；
 * "parallel" 准备阶段串行校验、执行阶段并发，结束事件按完成顺序发出，但工具结果消息仍按原始顺序产出。
 */
export type ToolExecutionMode = "sequential" | "parallel";

/**
 * Controls how many queued user messages are injected when the agent loop reaches a queue drain point.
 *
 * - "all": drain and inject every queued message at that point.
 * - "one-at-a-time": drain and inject only the oldest queued message, leaving the rest queued for later drain points.
 */
/**
 * 排队消息消费模式（中文说明）："all" 在消费点一次性取出并注入全部排队用户消息；
 * "one-at-a-time" 每个消费点只注入最旧的一条，其余继续排队等待后续消费点。
 */
export type QueueMode = "all" | "one-at-a-time";

/** A single tool call content block emitted by an assistant message. */
/** 中文说明：助手消息里的单个“工具调用”内容块（从内容联合类型中筛选 type === "toolCall" 的成员）。 */
export type AgentToolCall = Extract<AssistantMessage["content"][number], { type: "toolCall" }>;

/**
 * Result returned from `beforeToolCall`.
 *
 * Returning `{ block: true }` prevents the tool from executing. The loop emits an error tool result instead.
 * `reason` becomes the text shown in that error result. If omitted, a default blocked message is used.
 */
/**
 * beforeToolCall 钩子的返回值（中文说明）：返回 { block: true } 可阻止该工具真正执行，
 * 循环会改为生成一条错误工具结果作为替代；reason 即错误结果中展示的文字，缺省用默认拦截文案。
 */
export interface BeforeToolCallResult {
	// 是否阻止本次工具调用（true = 拦截，不实际执行）
	block?: boolean;
	// 拦截原因文案；省略时使用内置默认文案
	reason?: string;
	/**
	 * Hint that the agent should stop after the current tool batch when this call is blocked.
	 * Early termination only happens when every finalized tool result in the batch sets this to true.
	 */
	terminate?: boolean;
}

/**
 * Partial override returned from `afterToolCall`.
 *
 * Merge semantics are field-by-field:
 * - `content`: if provided, replaces the tool result content array in full
 * - `details`: if provided, replaces the tool result details value in full
 * - `isError`: if provided, replaces the tool result error flag
 * - `usage`: if provided, replaces the tool result usage
 * - `terminate`: if provided, replaces the early-termination hint
 *
 * Omitted fields keep the original executed tool result values.
 * There is no deep merge for `content`, `details`, or `usage`.
 */
/**
 * afterToolCall 钩子返回的“部分覆盖”结果（中文说明）：按字段整体替换已执行的工具结果，
 * 未提供的字段保持原值；content/details/usage 均为整体替换，不做深层合并。
 */
export interface AfterToolCallResult {
	// 覆盖后的内容数组（文本/图片）；提供时整体替换原 content
	content?: (TextContent | ImageContent)[];
	// 覆盖后的结构化详情（供日志或 UI 使用）；提供时整体替换原 details
	details?: unknown;
	// 覆盖后的错误标记；true 表示此工具结果按错误处理
	isError?: boolean;
	/** Usage from the final tool execution itself, if available. Not used for main LLM context accounting. */
	// 工具自身执行的用量统计（如有）；仅作参考，不计入主对话的 token 核算
	usage?: Usage;
	/**
	 * Hint that the agent should stop after the current tool batch.
	 * Early termination only happens when every finalized tool result in the batch sets this to true.
	 */
	// 提示代理在本批工具结束后停止；只有当批内全部工具结果都置 true 才会提前终止
	terminate?: boolean;
}

/** Context passed to `beforeToolCall`. */
/** 中文说明：beforeToolCall（工具执行前）钩子收到的上下文对象。 */
export interface BeforeToolCallContext {
	/** The assistant message that requested the tool call. */
	// 发起这次工具调用的助手消息
	assistantMessage: AssistantMessage;
	/** The raw tool call block from `assistantMessage.content`. */
	// 助手消息里原始的工具调用块（含工具名、调用 ID、原始参数）
	toolCall: AgentToolCall;
	/** Validated tool arguments for the target tool schema. */
	// 已通过目标工具 schema 校验的参数对象
	args: unknown;
	/** Current agent context at the time the tool call is prepared. */
	// 工具调用准备时刻的代理上下文快照
	context: AgentContext;
}

/** Context passed to `afterToolCall`. */
/** 中文说明：afterToolCall（工具执行后、结果产出前）钩子收到的上下文，可用于改写工具结果。 */
export interface AfterToolCallContext {
	/** The assistant message that requested the tool call. */
	// 发起这次工具调用的助手消息
	assistantMessage: AssistantMessage;
	/** The raw tool call block from `assistantMessage.content`. */
	// 原始的工具调用块
	toolCall: AgentToolCall;
	/** Validated tool arguments for the target tool schema. */
	// 校验后的工具参数
	args: unknown;
	/** The executed tool result before any `afterToolCall` overrides are applied. */
	// 实际执行得到的工具结果（尚未应用任何覆盖）
	result: AgentToolResult<any>;
	/** Whether the executed tool result is currently treated as an error. */
	// 该结果当前是否按错误处理
	isError: boolean;
	/** Current agent context at the time the tool call is finalized. */
	// 工具收尾时刻的代理上下文快照
	context: AgentContext;
}

/** Context passed to `shouldStopAfterTurn`. */
/** 中文说明：shouldStopAfterTurn（判断本轮结束后是否停止）钩子的上下文。 */
export interface ShouldStopAfterTurnContext {
	/** The assistant message that completed the turn. */
	// 刚刚完成本轮回复的助手消息
	message: AssistantMessage;
	/** Tool result messages passed to the preceding `turn_end` event. */
	// 随本轮 turn_end 事件发出的工具结果消息列表
	toolResults: ToolResultMessage[];
	/** Current agent context after the turn's assistant message and tool results have been appended. */
	// 已追加本轮助手消息与工具结果后的最新代理上下文
	context: AgentContext;
	/** Messages that this loop invocation will return if it exits at this point. Prompt runs include the initial prompt messages; continuation runs do not include pre-existing context messages. */
	// 本次循环若立即退出将返回的消息集合；prompt 运行包含初始提示消息，续跑运行不含已有上下文消息
	newMessages: AgentMessage[];
}

/** Replacement runtime state used by the agent loop before starting another provider request. */
/** 中文说明：下一轮模型请求开始前可替换的运行状态（由 prepareNextTurn 钩子返回）。 */
export interface AgentLoopTurnUpdate {
	/** Context for the next provider request. */
	// 下一轮使用的上下文；省略则沿用当前值
	context?: AgentContext;
	/** Model for the next provider request. */
	// 下一轮使用的模型；省略则沿用当前值
	model?: Model<any>;
	/** Thinking level for the next provider request. */
	// 下一轮的思考强度档位；省略则沿用当前值
	thinkingLevel?: ThinkingLevel;
}

/** prepareNextTurn 钩子的入参上下文：直接复用 shouldStopAfterTurn 的结构，无额外字段。 */
export interface PrepareNextTurnContext extends ShouldStopAfterTurnContext {}

/**
 * 低层代理循环的完整配置（中文说明）：继承 SimpleStreamOptions 的全部流式选项，
 * 并补充模型、消息转换、上下文变换、密钥解析、转向/追问消息队列、工具执行模式与前后钩子等可定制点。
 * 二次开发最常见的定制位置：convertToLlm（自定义消息如何变成 LLM 消息）、beforeToolCall/afterToolCall（工具拦截与改写）。
 */
export interface AgentLoopConfig extends SimpleStreamOptions {
	// 本轮运行必填：使用的模型对象
	model: Model<any>;

	/**
	 * Converts AgentMessage[] to LLM-compatible Message[] before each LLM call.
	 *
	 * Each AgentMessage must be converted to a UserMessage, AssistantMessage, or ToolResultMessage
	 * that the LLM can understand. AgentMessages that cannot be converted (e.g., UI-only notifications,
	 * status messages) should be filtered out.
	 *
	 * Contract: must not throw or reject. Return a safe fallback value instead.
	 * Throwing interrupts the low-level agent loop without producing a normal event sequence.
	 *
	 * @example
	 * ```typescript
	 * convertToLlm: (messages) => messages.flatMap(m => {
	 *   if (m.role === "custom") {
	 *     // Convert custom message to user message
	 *     return [{ role: "user", content: m.content, timestamp: m.timestamp }];
	 *   }
	 *   if (m.role === "notification") {
	 *     // Filter out UI-only messages
	 *     return [];
	 *   }
	 *   // Pass through standard LLM messages
	 *   return [m];
	 * })
	 * ```
	 */
	// 中文说明：每次 LLM 调用前把 AgentMessage[] 转成 LLM 认识的 Message[]；
	// 无法转换的消息（如纯 UI 通知）应被过滤掉；契约：禁止抛出异常或返回 rejected Promise。
	convertToLlm: (messages: AgentMessage[]) => Message[] | Promise<Message[]>;

	/**
	 * Optional transform applied to the context before `convertToLlm`.
	 *
	 * Use this for operations that work at the AgentMessage level:
	 * - Context window management (pruning old messages)
	 * - Injecting context from external sources
	 *
	 * Contract: must not throw or reject. Return the original messages or another
	 * safe fallback value instead.
	 *
	 * @example
	 * ```typescript
	 * transformContext: async (messages) => {
	 *   if (estimateTokens(messages) > MAX_TOKENS) {
	 *     return pruneOldMessages(messages);
	 *   }
	 *   return messages;
	 * }
	 * ```
	 */
	// 中文说明：可选的上下文预变换（在 convertToLlm 之前、AgentMessage 粒度上操作），
	// 典型用途：裁剪旧消息控制窗口大小、注入外部信息；同样禁止抛异常。
	transformContext?: (messages: AgentMessage[], signal?: AbortSignal) => Promise<AgentMessage[]>;

	/**
	 * Resolves an API key dynamically for each LLM call.
	 *
	 * Useful for short-lived OAuth tokens (e.g., GitHub Copilot) that may expire
	 * during long-running tool execution phases.
	 *
	 * Contract: must not throw or reject. Return undefined when no key is available.
	 */
	// 中文说明：动态解析每次 LLM 调用的 API 密钥；适合短期 OAuth 令牌在长工具执行期过期的情况；
	// 无可用密钥时返回 undefined。
	getApiKey?: (provider: string) => Promise<string | undefined> | string | undefined;

	/**
	 * Called after each turn fully completes and `turn_end` has been emitted.
	 *
	 * If it returns true, the loop emits `agent_end` and exits before polling steering or follow-up queues,
	 * without starting another LLM call. The current assistant response and any tool executions finish normally.
	 * This callback sees the completed-turn context and runs before `prepareNextTurn`.
	 *
	 * Use this to request a graceful stop after the current turn, e.g. before context gets too full.
	 *
	 * Contract: must not throw or reject. Throwing interrupts the low-level agent loop without producing a normal event sequence.
	 */
	// 中文说明：每轮完全结束并发出 turn_end 后调用；返回 true 则发出 agent_end 并优雅退出（不再发起新的 LLM 调用），
	// 常用于“上下文快满时请求停止”。
	shouldStopAfterTurn?: (context: ShouldStopAfterTurnContext) => boolean | Promise<boolean>;

	/**
	 * Called after `turn_end` when the loop will continue, immediately before the next turn starts.
	 * Return replacement context/model/thinking state to affect that turn.
	 * Return undefined to keep using the current context/config.
	 */
	// 中文说明：在 turn_end 之后、决定是否发起下一轮之前调用；返回要替换的上下文/模型/思考强度，
	// 返回 undefined 表示全部沿用当前配置。
	prepareNextTurn?: (
		context: PrepareNextTurnContext,
	) => AgentLoopTurnUpdate | undefined | Promise<AgentLoopTurnUpdate | undefined>;

	/**
	 * Returns steering messages to inject into the conversation mid-run.
	 *
	 * Called after the current assistant turn finishes executing its tool calls, unless `shouldStopAfterTurn` exits first.
	 * If messages are returned, they are added to the context before the next LLM call.
	 * Tool calls from the current assistant message are not skipped.
	 *
	 * Use this for "steering" the agent while it's working.
	 *
	 * Contract: must not throw or reject. Return [] when no steering messages are available.
	 */
	// 中文说明：运行中途“转向”消息来源——本轮工具执行完后调用，返回的消息会在下一次 LLM 调用前注入；
	// 没有转向消息时返回空数组 []。
	getSteeringMessages?: () => Promise<AgentMessage[]>;

	/**
	 * Returns follow-up messages to process after the agent would otherwise stop.
	 *
	 * Called when the agent has no more tool calls and no steering messages.
	 * If messages are returned, they're added to the context and the agent
	 * continues with another turn.
	 *
	 * Use this for follow-up messages that should wait until the agent finishes.
	 *
	 * Contract: must not throw or reject. Return [] when no follow-up messages are available.
	 */
	// 中文说明：“追问”消息来源——当代理本应停止（无工具调用、无转向消息）时调用，
	// 返回非空则继续新一轮；没有追问时返回 []。
	getFollowUpMessages?: () => Promise<AgentMessage[]>;

	/**
	 * Tool execution mode.
	 * - "sequential": execute tool calls one by one
	 * - "parallel": preflight tool calls sequentially, then execute allowed tools concurrently;
	 *   emit `tool_execution_end` in tool completion order after each tool is finalized,
	 *   then emit tool-result message artifacts later in assistant source order
	 *
	 * Default: "parallel"
	 */
	// 中文说明：工具执行模式，默认 "parallel"（并行）；可按需改为 "sequential"（串行）。
	toolExecution?: ToolExecutionMode;

	/**
	 * Called before a tool is executed, after arguments have been validated.
	 *
	 * Return `{ block: true }` to prevent execution. The loop emits an error tool result instead.
	 * A blocked result can also set `terminate: true` to participate in the batch early-termination rule.
	 * The hook receives the agent abort signal and is responsible for honoring it.
	 */
	// 中文说明：工具执行前钩子（参数校验之后调用）；返回 { block: true } 可拦截执行；
	// 钩子会收到中止信号 signal，需自行遵守。
	beforeToolCall?: (context: BeforeToolCallContext, signal?: AbortSignal) => Promise<BeforeToolCallResult | undefined>;

	/**
	 * Called after a tool finishes executing, before `tool_execution_end` and tool-result message events are emitted.
	 *
	 * Return an `AfterToolCallResult` to override parts of the executed tool result:
	 * - `content` replaces the full content array
	 * - `details` replaces the full details payload
	 * - `isError` replaces the error flag
	 * - `usage` replaces the tool result usage
	 * - `terminate` replaces the early-termination hint
	 *
	 * Any omitted fields keep their original values. No deep merge is performed.
	 * The hook receives the agent abort signal and is responsible for honoring it.
	 */
	// 中文说明：工具执行后钩子（在结束事件发出前调用）；可返回部分覆盖结果改写 content/details/isError/usage/terminate；
	// 未提供的字段保持原值，不做深层合并。
	afterToolCall?: (context: AfterToolCallContext, signal?: AbortSignal) => Promise<AfterToolCallResult | undefined>;
}

/**
 * Thinking/reasoning level for models that support it.
 * Note: "xhigh" and "max" are only supported by selected model families. Use model
 * thinking-level metadata from @earendil-works/pi-ai to detect support for a concrete model.
 */
/**
 * 思考/推理强度档位（中文说明）：从关闭到最强共七档；其中 "xhigh" 与 "max" 仅部分模型家族支持，
 * 具体模型是否支持请查询 @earendil-works/pi-ai 提供的模型思考级别元数据。
 */
export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

/**
 * Extensible interface for custom app messages.
 * Apps can extend via declaration merging:
 *
 * @example
 * ```typescript
 * declare module "@mariozechner/agent" {
 *   interface CustomAgentMessages {
 *     artifact: ArtifactMessage;
 *     notification: NotificationMessage;
 *   }
 * }
 * ```
 */
/**
 * 自定义消息注册表（中文说明）：应用通过 TS 声明合并向此接口添加字段来注册新的消息类型，
 * 如示例中的 artifact、notification。这是扩展 AgentMessage 联合类型的唯一入口。
 */
export interface CustomAgentMessages {
	// Empty by default - apps extend via declaration merging
	// 默认为空——由应用方通过声明合并进行扩展
}

/**
 * AgentMessage: Union of LLM messages + custom messages.
 * This abstraction allows apps to add custom message types while maintaining
 * type safety and compatibility with the base LLM messages.
 */
/**
 * 代理层统一消息类型（中文说明）：标准 LLM 消息与应用自定义消息的联合类型，
 * 让应用既能插入私有消息（如 UI 通知），又保持与底层 LLM 消息体系的类型兼容。
 */
export type AgentMessage = Message | CustomAgentMessages[keyof CustomAgentMessages];

/**
 * Public agent state.
 *
 * `tools` and `messages` use accessor properties so implementations can copy
 * assigned arrays before storing them.
 */
/**
 * 对外可见的代理运行状态（中文说明）：包含系统提示词、当前模型、思考级别、工具与消息列表以及流式中间态；
 * tools/messages 采用存取器属性实现，赋新数组时会复制顶层数组，避免外部引用被意外共享/篡改。
 */
export interface AgentState {
	/** System prompt sent with each model request. */
	// 随每次模型请求发送的系统提示词
	systemPrompt: string;
	/** Active model used for future turns. */
	// 当前生效模型（后续轮次将使用它）
	model: Model<any>;
	/** Requested reasoning level for future turns. */
	// 后续轮次请求的思考强度
	thinkingLevel: ThinkingLevel;
	/** Available tools. Assigning a new array copies the top-level array. */
	set tools(tools: AgentTool<any>[]);
	get tools(): AgentTool<any>[];
	/** Conversation transcript. Assigning a new array copies the top-level array. */
	set messages(messages: AgentMessage[]);
	get messages(): AgentMessage[];
	/**
	 * True while the agent is processing a prompt or continuation.
	 *
	 * This remains true until awaited `agent_end` listeners settle.
	 */
	// 是否正在处理提示或续跑；直到 agent_end 的监听器全部完成才变回 false
	readonly isStreaming: boolean;
	/** Partial assistant message for the current streamed response, if any. */
	// 当前正在流式生成的部分助手消息（无则为 undefined）
	readonly streamingMessage?: AgentMessage;
	/** Tool call ids currently executing. */
	// 正在执行中的工具调用 ID 集合（只读）
	readonly pendingToolCalls: ReadonlySet<string>;
	/** Error message from the most recent failed or aborted assistant turn, if any. */
	// 最近一次失败或被中止的助手轮次的错误信息（无则 undefined）
	readonly errorMessage?: string;
}

/** Final or partial result produced by a tool. */
/** 中文说明：工具产出的最终（或阶段性）结果。 */
export interface AgentToolResult<T> {
	/** Text or image content returned to the model. */
	// 返回给模型的文本/图片内容数组
	content: (TextContent | ImageContent)[];
	/** Arbitrary structured details for logs or UI rendering. */
	// 任意结构的详情数据，仅供日志或 UI 渲染，不进入模型上下文
	details: T;
	/** Usage from the final tool execution itself, if available. Not used for main LLM context accounting. */
	// 工具自身执行的用量统计（如有）；不计入主对话 token 核算
	usage?: Usage;
	/** Names of tools introduced by this result and available from this transcript point onward. */
	// 本次结果引入的新工具名列表（自此之后的对话中可用）
	addedToolNames?: string[];
	/**
	 * Hint that the agent should stop after the current tool batch.
	 * Early termination only happens when every finalized tool result in the batch sets this to true.
	 */
	// 提示在本批工具后停止；只有批内全部结果都为 true 才会提前终止
	terminate?: boolean;
}

/**
 * Callback used by tools to stream partial execution updates.
 *
 * The callback is scoped to the current `execute()` invocation. Calls made after
 * the tool promise settles are ignored.
 */
/**
 * 工具进度回调类型（中文说明）：工具在 execute() 执行期间用它推送部分结果实现进度流式更新；
 * 回调仅在本次 execute 内有效，工具 Promise 结束后再调用会被忽略。泛型 T 为 details 的类型。
 */
export type AgentToolUpdateCallback<T = any> = (partialResult: AgentToolResult<T>) => void;

/** Tool definition used by the agent runtime. */
/** 中文说明：代理运行时使用的工具定义：在 pi-ai 的 Tool 基础上增加 UI 标签、参数预处理、执行函数与执行模式覆盖。二次开发自定义工具主要就是实现此接口。 */
export interface AgentTool<TParameters extends TSchema = TSchema, TDetails = any> extends Tool<TParameters> {
	/** Human-readable label for UI display. */
	// 面向用户的展示名称（UI 用）
	label: string;
	/**
	 * Optional compatibility shim for raw tool-call arguments before schema validation.
	 * Must return an object that matches `TParameters`.
	 */
	// 可选：schema 校验前对原始参数做兼容性修正；必须返回符合 TParameters 的对象
	prepareArguments?: (args: unknown) => Static<TParameters>;
	/** Execute the tool call. Throw on failure instead of encoding errors in `content`. */
	// 执行工具的主体函数：失败时直接抛异常（不要把错误编码进 content）。
	// 参数 toolCallId —— 调用 ID；params —— 校验后的参数；signal —— 中止信号；onUpdate —— 进度回调
	execute: (
		toolCallId: string,
		params: Static<TParameters>,
		signal?: AbortSignal,
		onUpdate?: AgentToolUpdateCallback<TDetails>,
	) => Promise<AgentToolResult<TDetails>>;
	/**
	 * Per-tool execution mode override.
	 * - "sequential": this tool must execute one at a time with other tool calls.
	 * - "parallel": this tool can execute concurrently with other tool calls.
	 *
	 * If omitted, the default execution mode applies.
	 */
	// 单工具级执行模式覆盖："sequential" 必须独占串行，"parallel" 可并发；省略时用全局默认
	executionMode?: ToolExecutionMode;
}

/** Context snapshot passed into the low-level agent loop. */
/** 中文说明：传入低层代理循环的上下文快照：系统提示词 + 对模型可见的消息记录 + 本轮可用工具。 */
export interface AgentContext {
	/** System prompt included with the request. */
	// 随请求发送的系统提示词
	systemPrompt: string;
	/** Transcript visible to the model. */
	// 对模型可见的对话记录
	messages: AgentMessage[];
	/** Tools available for this run. */
	// 本轮可用的工具列表
	tools?: AgentTool<any>[];
}

/**
 * Events emitted by the Agent for UI updates.
 *
 * `agent_end` is the last event emitted for a run, but awaited `Agent.subscribe()`
 * listeners for that event are still part of run settlement. The agent becomes
 * idle only after those listeners finish.
 */
/**
 * Agent 向 UI 发出的事件联合类型（中文说明）：覆盖三层生命周期——
 * 代理级（agent_start/agent_end）、轮次级（turn_start/turn_end）、消息级（message_start/update/end），
 * 以及工具执行级（tool_execution_start/update/end）。agent_end 是一次运行的最后一个事件，
 * 但其 await 监听器完成后代理才算真正空闲。
 */
export type AgentEvent =
	// Agent lifecycle
	// 代理生命周期事件
	| { type: "agent_start" }
	| { type: "agent_end"; messages: AgentMessage[] }
	// Turn lifecycle - a turn is one assistant response + any tool calls/results
	// 轮次生命周期事件——一轮 = 一次助手回复 + 相关工具调用/结果
	| { type: "turn_start" }
	| { type: "turn_end"; message: AgentMessage; toolResults: ToolResultMessage[] }
	// Message lifecycle - emitted for user, assistant, and toolResult messages
	// 消息生命周期事件——用户/助手/工具结果消息均会触发
	| { type: "message_start"; message: AgentMessage }
	// Only emitted for assistant messages during streaming
	// 仅助手消息流式输出期间触发
	| { type: "message_update"; message: AgentMessage; assistantMessageEvent: AssistantMessageEvent }
	| { type: "message_end"; message: AgentMessage }
	// Tool execution lifecycle
	// 工具执行生命周期事件
	| { type: "tool_execution_start"; toolCallId: string; toolName: string; args: any }
	| { type: "tool_execution_update"; toolCallId: string; toolName: string; args: any; partialResult: any }
	| { type: "tool_execution_end"; toolCallId: string; toolName: string; result: any; isError: boolean };
