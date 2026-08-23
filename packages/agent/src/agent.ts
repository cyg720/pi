/**
 * 【文件职责】实现 Agent 类：低层 agent-loop 的有状态封装。负责持有对话记录、维护运行状态、
 *              分发生命周期事件、执行工具，并对外提供 steer（转向）/followUp（追问）两条消息队列。
 * 【技术维度】基于类的状态管理 + 存取器属性；AbortController 实现中止；Promise 手工 resolve 实现 waitForIdle；
 *              事件按订阅顺序 await 分发。
 * 【产品维度】这是应用直接操作的核心对象：发提示、中途插话、排队追问、中止、重置都通过它完成；
 *              二次开发自定义代理行为时最先打交道的就是本类。
 * 【逻辑维度】构造时装配配置与队列 → prompt/continue 启动运行 → runWithLifecycle 管理生命周期 →
 *              createLoopConfig 组装低层循环配置 → processEvents 归约事件并通知监听器 → finishRun 收尾。
 * 【关键边界】同一时刻只允许一个活动运行（重复 prompt/continue 会抛错）；错误会合成一条带 stopReason 的事件序列保证收尾完整。
 * 【新手阅读建议】先读 AgentOptions 与 constructor 了解可配置面，再读 prompt/steer/followUp/abort 四个入口，
 *              最后读 processEvents 理解状态如何随事件演进。
 */
import type {
	ImageContent,
	Message,
	Model,
	SimpleStreamOptions,
	TextContent,
	ThinkingBudgets,
	Transport,
} from "@earendil-works/pi-ai";
import { runAgentLoop, runAgentLoopContinue } from "./agent-loop.ts";
import { getDefaultStreamFn } from "./stream-fn.ts";
import type {
	AfterToolCallContext,
	AfterToolCallResult,
	AgentContext,
	AgentEvent,
	AgentLoopConfig,
	AgentLoopTurnUpdate,
	AgentMessage,
	AgentState,
	AgentTool,
	BeforeToolCallContext,
	BeforeToolCallResult,
	PrepareNextTurnContext,
	QueueMode,
	StreamFn,
	ToolExecutionMode,
} from "./types.ts";

// 重新导出 QueueMode 类型，方便使用方从本模块获取
export type { QueueMode } from "./types.ts";

/**
 * 默认的 AgentMessage → LLM 消息转换器：只保留 user / assistant / toolResult 三种标准角色，
 * 过滤掉应用注入的自定义消息。参数 messages —— 代理层消息数组；返回 LLM 可理解的消息数组。
 */
function defaultConvertToLlm(messages: AgentMessage[]): Message[] {
	return messages.filter(
		(message) => message.role === "user" || message.role === "assistant" || message.role === "toolResult",
	);
}

// 全零用量常量：用于合成失败消息时的占位统计（各维度 token 数与成本均为 0）
const EMPTY_USAGE = {
	input: 0,
	output: 0,
	cacheRead: 0,
	cacheWrite: 0,
	totalTokens: 0,
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

// 默认模型描述对象：所有字段均为“未知”占位值；未配置模型时使用，避免空引用
const DEFAULT_MODEL = {
	id: "unknown",
	name: "unknown",
	api: "unknown",
	provider: "unknown",
	baseUrl: "",
	reasoning: false,
	input: [],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 0,
	maxTokens: 0,
} satisfies Model<any>;

/**
 * 内部可变状态类型（中文说明）：把 AgentState 中只读字段改为可写版本，
 * 供类内部自由更新；对外仍以只读的 AgentState 暴露。
 */
type MutableAgentState = Omit<AgentState, "isStreaming" | "streamingMessage" | "pendingToolCalls" | "errorMessage"> & {
	// 是否正在流式处理
	isStreaming: boolean;
	// 当前流式生成的部分消息
	streamingMessage?: AgentMessage;
	// 执行中的工具调用 ID 集合
	pendingToolCalls: Set<string>;
	// 最近一次失败的错误信息
	errorMessage?: string;
};

/**
 * 创建可变代理状态（中文说明）：根据初始配置生成 MutableAgentState。
 * tools/messages 使用存取器属性——赋新数组时会复制顶层数组，防止外部引用被共享篡改。
 * 参数 initialState —— 可选的初始值；返回内部可变状态对象。
 */
function createMutableAgentState(
	initialState?: Partial<Omit<AgentState, "pendingToolCalls" | "isStreaming" | "streamingMessage" | "errorMessage">>,
): MutableAgentState {
	// 工具列表：复制初始数组或空数组
	let tools = initialState?.tools?.slice() ?? [];
	// 对话记录：复制初始数组或空数组
	let messages = initialState?.messages?.slice() ?? [];

	return {
		// 系统提示词，缺省为空串
		systemPrompt: initialState?.systemPrompt ?? "",
		// 当前模型，缺省用“未知”占位模型
		model: initialState?.model ?? DEFAULT_MODEL,
		// 思考强度，缺省关闭
		thinkingLevel: initialState?.thinkingLevel ?? "off",
		get tools() {
			return tools;
		},
		set tools(nextTools: AgentTool<any>[]) {
			// 赋值时复制顶层数组，隔离外部引用
			tools = nextTools.slice();
		},
		get messages() {
			return messages;
		},
		set messages(nextMessages: AgentMessage[]) {
			// 赋值时复制顶层数组，隔离外部引用
			messages = nextMessages.slice();
		},
		// 初始不在流式状态
		isStreaming: false,
		// 初始无流式消息
		streamingMessage: undefined,
		// 初始无执行中工具
		pendingToolCalls: new Set<string>(),
		// 初始无错误
		errorMessage: undefined,
	};
}

/** Options for constructing an {@link Agent}. */
/** 中文说明：创建 {@link Agent} 的选项集合——除必填 streamFn 外全部可选，覆盖状态、转换钩子、工具钩子、队列模式与会话参数。 */
export interface AgentOptions {
	// 初始状态（系统提示词、模型、工具、消息等）；只读字段不可在此设置
	initialState?: Partial<Omit<AgentState, "pendingToolCalls" | "isStreaming" | "streamingMessage" | "errorMessage">>;
	// 自定义消息 → LLM 消息的转换函数；缺省用 defaultConvertToLlm
	convertToLlm?: (messages: AgentMessage[]) => Message[] | Promise<Message[]>;
	// 可选的上下文预变换（裁剪旧消息、注入外部上下文）
	transformContext?: (messages: AgentMessage[], signal?: AbortSignal) => Promise<AgentMessage[]>;
	// 必填：流式生成函数；也可先 setDefaultStreamFn 再省略（见构造函数兜底）
	streamFn: StreamFn;
	// 动态解析 API 密钥（适配短期 OAuth 令牌）
	getApiKey?: (provider: string) => Promise<string | undefined> | string | undefined;
	// 观测回调：每次请求载荷发出时触发
	onPayload?: SimpleStreamOptions["onPayload"];
	// 观测回调：收到响应时触发
	onResponse?: SimpleStreamOptions["onResponse"];
	// 工具执行前拦截钩子；返回 block:true 可阻止执行
	beforeToolCall?: (context: BeforeToolCallContext, signal?: AbortSignal) => Promise<BeforeToolCallResult | undefined>;
	// 工具执行后改写钩子；可部分覆盖工具结果
	afterToolCall?: (context: AfterToolCallContext, signal?: AbortSignal) => Promise<AfterToolCallResult | undefined>;
	// 下一轮前回调（简化签名：只有中止信号）；返回要替换的状态
	prepareNextTurn?: (
		signal?: AbortSignal,
	) => Promise<AgentLoopTurnUpdate | undefined> | AgentLoopTurnUpdate | undefined;
	// 下一轮前回调（带轮次上下文签名）；与 prepareNextTurn 二选一即可
	prepareNextTurnWithContext?: (
		context: PrepareNextTurnContext,
		signal?: AbortSignal,
	) => Promise<AgentLoopTurnUpdate | undefined> | AgentLoopTurnUpdate | undefined;
	// 转向队列消费模式；默认 one-at-a-time
	steeringMode?: QueueMode;
	// 追问队列消费模式；默认 one-at-a-time
	followUpMode?: QueueMode;
	// 会话 ID：转发给支持缓存亲和的供应商后端
	sessionId?: string;
	// 各思考级别的 token 预算
	thinkingBudgets?: ThinkingBudgets;
	// 首选传输方式（如 sse/websocket/auto），转发给流式函数
	transport?: Transport;
	// 供应商要求重试延迟的上限（毫秒）
	maxRetryDelayMs?: number;
	// 多工具调用执行策略；默认 parallel
	toolExecution?: ToolExecutionMode;
}

/**
 * 待处理消息队列（中文说明）：内部 FIFO 队列，分别服务于“转向”和“追问”两类消息；
 * drain 行为由 mode 决定：all 一次全取，one-at-a-time 每次只取最旧一条。
 */
class PendingMessageQueue {
	// 队列内暂存的消息数组
	private messages: AgentMessage[] = [];
	// 消费模式："all" 或 "one-at-a-time"
	public mode: QueueMode;

	// 构造函数：传入消费模式
	constructor(mode: QueueMode) {
		this.mode = mode;
	}

	// 入队一条消息
	enqueue(message: AgentMessage): void {
		this.messages.push(message);
	}

	// 队列是否非空
	hasItems(): boolean {
		return this.messages.length > 0;
	}

	// 取出待注入的消息：mode 为 all 时清空整个队列，否则只取第一条
	drain(): AgentMessage[] {
		if (this.mode === "all") {
			// 复制全部并清空
			const drained = this.messages.slice();
			this.messages = [];
			return drained;
		}

		// 只取最旧的一条
		const first = this.messages[0];
		if (!first) {
			// 队列为空时返回空数组
			return [];
		}
		this.messages = this.messages.slice(1);
		return [first];
	}

	// 清空队列
	clear(): void {
		this.messages = [];
	}
}

/**
 * 一次活动运行的句柄（中文说明）：
 * promise —— 运行完全结束（含事件监听器收尾）后 resolve；
 * resolve —— 手工解除等待；abortController —— 用于中止本次运行。
 */
type ActiveRun = {
	promise: Promise<void>;
	resolve: () => void;
	abortController: AbortController;
};

/**
 * Stateful wrapper around the low-level agent loop.
 *
 * `Agent` owns the current transcript, emits lifecycle events, executes tools,
 * and exposes queueing APIs for steering and follow-up messages.
 */
/**
 * Agent 类（中文说明）：低层循环的有状态门面。
 * 职责：保存对话记录与运行时状态、把低层事件归约为状态更新并分发给订阅者、
 * 提供 prompt/continue 启动运行、steer/followUp 排队插话、abort 中止、reset 重置等 API。
 * 适用场景：任何需要“多轮对话 + 工具调用 + 中途人工干预”的智能体应用主体。
 */
export class Agent {
	// 内部可变状态（对外经 state 存取器暴露为只读视图）
	private _state: MutableAgentState;
	// 事件监听器集合：按订阅顺序 await 调用
	private readonly listeners = new Set<(event: AgentEvent, signal: AbortSignal) => Promise<void> | void>();
	// “转向”消息队列：本轮结束后立即注入
	private readonly steeringQueue: PendingMessageQueue;
	// “追问”消息队列：代理本应停止时才注入
	private readonly followUpQueue: PendingMessageQueue;

	// 消息转换函数（构造时可替换）
	public convertToLlm: (messages: AgentMessage[]) => Message[] | Promise<Message[]>;
	// 可选上下文预变换
	public transformContext?: (messages: AgentMessage[], signal?: AbortSignal) => Promise<AgentMessage[]>;
	// 实际使用的流式函数
	public streamFunction: StreamFn;
	// 动态密钥解析器
	public getApiKey?: (provider: string) => Promise<string | undefined> | string | undefined;
	// 请求载荷观测回调
	public onPayload?: SimpleStreamOptions["onPayload"];
	// 响应观测回调
	public onResponse?: SimpleStreamOptions["onResponse"];
	// 工具执行前钩子
	public beforeToolCall?: (
		context: BeforeToolCallContext,
		signal?: AbortSignal,
	) => Promise<BeforeToolCallResult | undefined>;
	// 工具执行后钩子
	public afterToolCall?: (
		context: AfterToolCallContext,
		signal?: AbortSignal,
	) => Promise<AfterToolCallResult | undefined>;
	// 下一轮准备钩子（简化签名）
	public prepareNextTurn?: (
		signal?: AbortSignal,
	) => Promise<AgentLoopTurnUpdate | undefined> | AgentLoopTurnUpdate | undefined;
	// 下一轮准备钩子（带上下文签名）
	public prepareNextTurnWithContext?: (
		context: PrepareNextTurnContext,
		signal?: AbortSignal,
	) => Promise<AgentLoopTurnUpdate | undefined> | AgentLoopTurnUpdate | undefined;
	// 当前活动运行句柄；undefined 表示空闲
	private activeRun?: ActiveRun;
	/** Session identifier forwarded to providers for cache-aware backends. */
	// 会话 ID：转发给具备缓存亲和能力的供应商后端
	public sessionId?: string;
	/** Optional per-level thinking token budgets forwarded to the stream function. */
	// 各思考级别 token 预算：随请求转发给流式函数
	public thinkingBudgets?: ThinkingBudgets;
	/** Preferred transport forwarded to the stream function. */
	// 首选传输方式：随请求转发给流式函数
	public transport: Transport;
	/** Optional cap for provider-requested retry delays. */
	// 供应商请求的重试延迟上限（毫秒），可不设
	public maxRetryDelayMs?: number;
	/** Tool execution strategy for assistant messages that contain multiple tool calls. */
	// 一条助手消息包含多个工具调用时的执行策略（默认并行）
	public toolExecution: ToolExecutionMode;

	// 构造函数：装配所有配置；缺省项逐个回退到内置默认值
	constructor(options: AgentOptions) {
		// Older compiled consumers may omit options or streamFn even though the current API requires them.
		// 兼容旧的编译产物可能不传 options/streamFn 的情况
		const runtimeOptions: Partial<AgentOptions> = options ?? {};
		// 初始化内部可变状态
		this._state = createMutableAgentState(runtimeOptions.initialState);
		// 未提供转换函数则使用默认过滤版
		this.convertToLlm = runtimeOptions.convertToLlm ?? defaultConvertToLlm;
		this.transformContext = runtimeOptions.transformContext;
		// 流式函数：优先用显式传入的，否则取全局默认
		this.streamFunction = runtimeOptions.streamFn ?? getDefaultStreamFn();
		this.getApiKey = runtimeOptions.getApiKey;
		this.onPayload = runtimeOptions.onPayload;
		this.onResponse = runtimeOptions.onResponse;
		this.beforeToolCall = runtimeOptions.beforeToolCall;
		this.afterToolCall = runtimeOptions.afterToolCall;
		this.prepareNextTurn = runtimeOptions.prepareNextTurn;
		this.prepareNextTurnWithContext = runtimeOptions.prepareNextTurnWithContext;
		// 转向/追问队列：默认都是一次取一条
		this.steeringQueue = new PendingMessageQueue(runtimeOptions.steeringMode ?? "one-at-a-time");
		this.followUpQueue = new PendingMessageQueue(runtimeOptions.followUpMode ?? "one-at-a-time");
		this.sessionId = runtimeOptions.sessionId;
		this.thinkingBudgets = runtimeOptions.thinkingBudgets;
		// 传输方式默认 auto（由底层自行选择）
		this.transport = runtimeOptions.transport ?? "auto";
		this.maxRetryDelayMs = runtimeOptions.maxRetryDelayMs;
		// 工具执行默认并行
		this.toolExecution = runtimeOptions.toolExecution ?? "parallel";
	}

	/**
	 * Subscribe to agent lifecycle events.
	 *
	 * Listener promises are awaited in subscription order and are included in
	 * the current run's settlement. Listeners also receive the active abort
	 * signal for the current run.
	 *
	 * `agent_end` is the final emitted event for a run, but the agent does not
	 * become idle until all awaited listeners for that event have settled.
	 */
	// 订阅生命周期事件：监听器按订阅顺序被 await；返回取消订阅函数。
	// 使用示例：const off = agent.subscribe((e) => console.log(e.type)); off() 取消。
	subscribe(listener: (event: AgentEvent, signal: AbortSignal) => Promise<void> | void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/**
	 * Current agent state.
	 *
	 * Assigning `state.tools` or `state.messages` copies the provided top-level array.
	 */
	// 当前代理状态的只读视图（赋值 tools/messages 会复制顶层数组）
	get state(): AgentState {
		return this._state;
	}

	/** Controls how queued steering messages are drained. */
	// 设置转向队列消费模式
	set steeringMode(mode: QueueMode) {
		this.steeringQueue.mode = mode;
	}

	// 读取转向队列消费模式
	get steeringMode(): QueueMode {
		return this.steeringQueue.mode;
	}

	/** Controls how queued follow-up messages are drained. */
	// 设置追问队列消费模式
	set followUpMode(mode: QueueMode) {
		this.followUpQueue.mode = mode;
	}

	// 读取追问队列消费模式
	get followUpMode(): QueueMode {
		return this.followUpQueue.mode;
	}

	/** Queue a message to be injected after the current assistant turn finishes. */
	// 入队一条“转向”消息：本轮助手回合结束后立即注入对话
	steer(message: AgentMessage): void {
		this.steeringQueue.enqueue(message);
	}

	/** Queue a message to run only after the agent would otherwise stop. */
	// 入队一条“追问”消息：仅当代理即将停止时才会取出继续运行
	followUp(message: AgentMessage): void {
		this.followUpQueue.enqueue(message);
	}

	/** Remove all queued steering messages. */
	// 清空转向队列
	clearSteeringQueue(): void {
		this.steeringQueue.clear();
	}

	/** Remove all queued follow-up messages. */
	// 清空追问队列
	clearFollowUpQueue(): void {
		this.followUpQueue.clear();
	}

	/** Remove all queued steering and follow-up messages. */
	// 清空全部队列（转向 + 追问）
	clearAllQueues(): void {
		this.clearSteeringQueue();
		this.clearFollowUpQueue();
	}

	/** Returns true when either queue still contains pending messages. */
	// 任一队列仍有待处理消息时返回 true
	hasQueuedMessages(): boolean {
		return this.steeringQueue.hasItems() || this.followUpQueue.hasItems();
	}

	/** Active abort signal for the current run, if any. */
	// 当前活动运行的中止信号；空闲时为 undefined
	get signal(): AbortSignal | undefined {
		return this.activeRun?.abortController.signal;
	}

	/** Abort the current run, if one is active. */
	// 中止当前运行（若有）
	abort(): void {
		this.activeRun?.abortController.abort();
	}

	/**
	 * Resolve when the current run and all awaited event listeners have finished.
	 *
	 * This resolves after `agent_end` listeners settle.
	 */
	// 等待当前运行彻底结束（agent_end 监听器全部完成后 resolve）；空闲时立即返回
	waitForIdle(): Promise<void> {
		return this.activeRun?.promise ?? Promise.resolve();
	}

	/** Clear transcript state, runtime state, and queued messages. */
	// 重置：清空对话记录、运行时状态与全部排队消息
	reset(): void {
		this._state.messages = [];
		this._state.isStreaming = false;
		this._state.streamingMessage = undefined;
		this._state.pendingToolCalls = new Set<string>();
		this._state.errorMessage = undefined;
		this.clearFollowUpQueue();
		this.clearSteeringQueue();
	}

	/** Start a new prompt from text, a single message, or a batch of messages. */
	// 发起新提示（重载 1：传消息或消息数组）
	async prompt(message: AgentMessage | AgentMessage[]): Promise<void>;
	// 发起新提示（重载 2：传纯文本与可选图片）
	async prompt(input: string, images?: ImageContent[]): Promise<void>;
	// 统一实现：归一化输入后启动运行；已有活动运行时抛错
	async prompt(input: string | AgentMessage | AgentMessage[], images?: ImageContent[]): Promise<void> {
		if (this.activeRun) {
			throw new Error(
				"Agent is already processing a prompt. Use steer() or followUp() to queue messages, or wait for completion.",
			);
		}
		// 把字符串/单消息/批量输入统一转成消息数组
		const messages = this.normalizePromptInput(input, images);
		await this.runPromptMessages(messages);
	}

	/** Continue from the current transcript. The last message must be a user or tool-result message. */
	// 从现有记录续跑：最后一条必须是用户或工具结果消息；若最后是助手消息，
	// 则尝试消费转向/追问队列代替
	async continue(): Promise<void> {
		if (this.activeRun) {
			throw new Error("Agent is already processing. Wait for completion before continuing.");
		}

		// 取出最后一条消息判断续跑方式
		const lastMessage = this._state.messages[this._state.messages.length - 1];
		if (!lastMessage) {
			throw new Error("No messages to continue from");
		}

		if (lastMessage.role === "assistant") {
			// 优先消费转向队列
			const queuedSteering = this.steeringQueue.drain();
			if (queuedSteering.length > 0) {
				// skipInitialSteeringPoll：避免刚注入的消息被首轮转向轮询重复消费
				await this.runPromptMessages(queuedSteering, { skipInitialSteeringPoll: true });
				return;
			}

			// 其次消费追问队列
			const queuedFollowUps = this.followUpQueue.drain();
			if (queuedFollowUps.length > 0) {
				await this.runPromptMessages(queuedFollowUps);
				return;
			}

			// 既无队列消息也不允许从助手消息续跑
			throw new Error("Cannot continue from message role: assistant");
		}

		// 正常情况：从用户/工具结果消息续跑
		await this.runContinuation();
	}

	/**
	 * 提示输入归一化（私有）：把三种输入形式统一为 AgentMessage[]。
	 * input 为数组时原样返回；为单条消息时包成数组；为字符串时构造含文本与可选图片的用户消息。
	 */
	private normalizePromptInput(
		input: string | AgentMessage | AgentMessage[],
		images?: ImageContent[],
	): AgentMessage[] {
		if (Array.isArray(input)) {
			return input;
		}

		if (typeof input !== "string") {
			return [input];
		}

		// 文本内容块开头，随后追加图片内容块
		const content: Array<TextContent | ImageContent> = [{ type: "text", text: input }];
		if (images && images.length > 0) {
			content.push(...images);
		}
		return [{ role: "user", content, timestamp: Date.now() }];
	}

	/**
	 * 以“新消息启动”方式运行循环（私有）：
	 * 在生命周期包装内调用 runAgentLoop；options.skipInitialSteeringPoll 控制是否跳过首轮转向轮询。
	 */
	private async runPromptMessages(
		messages: AgentMessage[],
		options: { skipInitialSteeringPoll?: boolean } = {},
	): Promise<void> {
		await this.runWithLifecycle(async (signal) => {
			await runAgentLoop(
				messages,
				this.createContextSnapshot(),
				this.createLoopConfig(options),
				(event) => this.processEvents(event),
				signal,
				this.streamFunction,
			);
		});
	}

	// 以“续跑”方式运行循环（私有）：不新增用户消息，直接让模型基于现有记录继续
	private async runContinuation(): Promise<void> {
		await this.runWithLifecycle(async (signal) => {
			await runAgentLoopContinue(
				this.createContextSnapshot(),
				this.createLoopConfig(),
				(event) => this.processEvents(event),
				signal,
				this.streamFunction,
			);
		});
	}

	// 创建上下文快照（私有）：复制当前系统提示词、消息与工具列表，避免低层循环直接持有内部引用
	private createContextSnapshot(): AgentContext {
		return {
			systemPrompt: this._state.systemPrompt,
			messages: this._state.messages.slice(),
			tools: this._state.tools.slice(),
		};
	}

	/**
	 * 组装低层循环配置（私有）：把 Agent 的公开字段映射为 AgentLoopConfig；
	 * 其中转向队列通过 getSteeringMessages 回调按需 drain，skipInitialSteeringPoll 仅跳过第一次轮询。
	 */
	private createLoopConfig(options: { skipInitialSteeringPoll?: boolean } = {}): AgentLoopConfig {
		// 是否跳过首轮转向轮询（局部标志，用后即复位）
		let skipInitialSteeringPoll = options.skipInitialSteeringPoll === true;
		return {
			model: this._state.model,
			// 思考强度为 off 时不下发 reasoning 字段
			reasoning: this._state.thinkingLevel === "off" ? undefined : this._state.thinkingLevel,
			sessionId: this.sessionId,
			onPayload: this.onPayload,
			onResponse: this.onResponse,
			transport: this.transport,
			thinkingBudgets: this.thinkingBudgets,
			maxRetryDelayMs: this.maxRetryDelayMs,
			toolExecution: this.toolExecution,
			beforeToolCall: this.beforeToolCall,
			afterToolCall: this.afterToolCall,
			// 统一适配两种 prepareNextTurn 签名：优先带上下文版本
			prepareNextTurn:
				this.prepareNextTurnWithContext || this.prepareNextTurn
					? async (context) => {
							if (this.prepareNextTurnWithContext) {
								return await this.prepareNextTurnWithContext(context, this.signal);
							}
							return await this.prepareNextTurn?.(this.signal);
						}
					: undefined,
			convertToLlm: this.convertToLlm,
			transformContext: this.transformContext,
			getApiKey: this.getApiKey,
			// 转向消息来源：必要时跳过首次轮询，之后每次都 drain 转向队列
			getSteeringMessages: async () => {
				if (skipInitialSteeringPoll) {
					skipInitialSteeringPoll = false;
					return [];
				}
				return this.steeringQueue.drain();
			},
			// 追问消息来源：每次 drain 追问队列
			getFollowUpMessages: async () => this.followUpQueue.drain(),
		};
	}

	/**
	 * 生命周期包装（私有）：登记活动运行 → 置流式状态 → 执行主体 → 异常走失败兜底 → finally 收尾。
	 * executor 接收本次运行的中止信号。
	 */
	private async runWithLifecycle(executor: (signal: AbortSignal) => Promise<void>): Promise<void> {
		if (this.activeRun) {
			throw new Error("Agent is already processing.");
		}

		// 为本次运行创建独立的中止控制器
		const abortController = new AbortController();
		// 手工 resolve 的 Promise：waitForIdle 依赖它等待收尾完成
		let resolvePromise = () => {};
		const promise = new Promise<void>((resolve) => {
			resolvePromise = resolve;
		});
		this.activeRun = { promise, resolve: resolvePromise, abortController };

		// 进入流式状态并清空上次的中间态
		this._state.isStreaming = true;
		this._state.streamingMessage = undefined;
		this._state.errorMessage = undefined;

		try {
			await executor(abortController.signal);
		} catch (error) {
			// 循环抛异常属于异常路径：合成完整的失败事件序列
			await this.handleRunFailure(error, abortController.signal.aborted);
		} finally {
			// 无论成败都要收尾
			this.finishRun();
		}
	}

	/**
	 * 运行失败兜底（私有）：构造一条带 stopReason（aborted/error）与错误信息的合成助手消息，
	 * 并依次发出 message_start/message_end/turn_end/agent_end，保证事件序列完整、UI 能正常收尾。
	 */
	private async handleRunFailure(error: unknown, aborted: boolean): Promise<void> {
		// 合成的失败助手消息：空文本 + 错误说明
		const failureMessage = {
			role: "assistant",
			content: [{ type: "text", text: "" }],
			api: this._state.model.api,
			provider: this._state.model.provider,
			model: this._state.model.id,
			usage: EMPTY_USAGE,
			stopReason: aborted ? "aborted" : "error",
			errorMessage: error instanceof Error ? error.message : String(error),
			timestamp: Date.now(),
		} satisfies AgentMessage;
		await this.processEvents({ type: "message_start", message: failureMessage });
		await this.processEvents({ type: "message_end", message: failureMessage });
		await this.processEvents({ type: "turn_end", message: failureMessage, toolResults: [] });
		await this.processEvents({ type: "agent_end", messages: [failureMessage] });
	}

	// 运行收尾（私有）：退出流式状态、清理中间态、resolve 等待者并清除活动运行句柄
	private finishRun(): void {
		this._state.isStreaming = false;
		this._state.streamingMessage = undefined;
		this._state.pendingToolCalls = new Set<string>();
		this.activeRun?.resolve();
		this.activeRun = undefined;
	}

	/**
	 * Reduce internal state for a loop event, then await listeners.
	 *
	 * `agent_end` only means no further loop events will be emitted. The run is
	 * considered idle later, after all awaited listeners for `agent_end` finish
	 * and `finishRun()` clears runtime-owned state.
	 */
	// 事件处理器（私有）：先把事件归约进内部状态，再按订阅顺序 await 所有监听器。
	// 各分支：message_* 维护流式消息与记录；tool_execution_* 维护执行中集合；
	// turn_end 记录错误信息；agent_end 清理流式消息。
	private async processEvents(event: AgentEvent): Promise<void> {
		switch (event.type) {
			case "message_start":
				// 新消息开始：作为当前流式消息
				this._state.streamingMessage = event.message;
				break;

			case "message_update":
				// 流式增量：更新当前流式消息
				this._state.streamingMessage = event.message;
				break;

			case "message_end":
				// 消息完结：清除流式标记并把消息写入记录
				this._state.streamingMessage = undefined;
				this._state.messages.push(event.message);
				break;

			case "tool_execution_start": {
				// 工具开始执行：加入执行中集合（新建副本保持不可变更新）
				const pendingToolCalls = new Set(this._state.pendingToolCalls);
				pendingToolCalls.add(event.toolCallId);
				this._state.pendingToolCalls = pendingToolCalls;
				break;
			}

			case "tool_execution_end": {
				// 工具执行结束：移出执行中集合
				const pendingToolCalls = new Set(this._state.pendingToolCalls);
				pendingToolCalls.delete(event.toolCallId);
				this._state.pendingToolCalls = pendingToolCalls;
				break;
			}

			case "turn_end":
				// 本轮出错：把错误信息记入全局状态供 UI 展示
				if (event.message.role === "assistant" && event.message.errorMessage) {
					this._state.errorMessage = event.message.errorMessage;
				}
				break;

			case "agent_end":
				// 运行结束：清除残留的流式消息
				this._state.streamingMessage = undefined;
				break;
		}

		// 取当前运行的中止信号传给监听器；无活动运行说明调用时序异常
		const signal = this.activeRun?.abortController.signal;
		if (!signal) {
			throw new Error("Agent listener invoked outside active run");
		}
		for (const listener of this.listeners) {
			await listener(event, signal);
		}
	}
}
