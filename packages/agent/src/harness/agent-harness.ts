/**
 * 【文件职责】实现 AgentHarness：会话感知的高层代理门面——把 Session（持久化会话树）、AgentLoop
 *              （低层循环）、压缩/分支摘要、技能与提示词模板、事件钩子体系装配为一个可二次开发的完整运行时。
 * 【技术维度】阶段机（idle/turn/compaction/branch_summary/retry）+ 待写入缓冲保证会话一致性；
 *              泛型四参数定制上下文/技能/模板/工具；on() 钩子按 AgentHarnessEventResultMap 类型约束返回值；
 *              StreamFn 注入实现请求级选项快照与补丁。
 * 【产品维度】这是构建自定义智能体应用的推荐入口：prompt/skill/promptFromTemplate 发起任务，
 *              steer/followUp/nextTurn 排队插话，compact/navigateTree 管理长对话，abort/setModel 等 API
 *              覆盖运行期全部控制需求。
 * 【逻辑维度】构造时校验并登记工具 → 私有基础设施（事件分发、钩子链、轮次状态、循环配置、失败兜底）→
 *              公开 API 三大类：发起运行（prompt/skill/template）、队列控制（steer/followUp/nextTurn/abort）、
 *              会话与配置管理（compact/navigateTree/model/tools/resources/streamOptions 访问器）。
 * 【关键边界】同一时刻仅允许一个运行（非 idle 抛 busy）；钩子抛错统一包装为 AgentHarnessError(hook)；
 *              运行期间的会话修改先入 pendingSessionWrites，在 turn_end/agent_end 时统一落盘；
 *              钩子返回值“后者覆盖前者”（均非 undefined 时取最后一个）。
 * 【新手阅读建议】先读 AgentHarnessTurnState 与 createTurnState 了解每轮快照包含什么 → 再读 executeTurn
 *              主流程 → 然后是 compact/navigateTree 两个重头戏 → 最后浏览各类 getter/setter。
 */
import {
	type AssistantMessage,
	contentText,
	type ImageContent,
	type Model,
	type Models,
	type RetryCallbacks,
	type RetryPolicy,
	type UserMessage,
} from "@earendil-works/pi-ai";
import { runAgentLoop } from "../agent-loop.ts";
import type {
	AgentContext,
	AgentEvent,
	AgentLoopConfig,
	AgentMessage,
	AgentTool,
	QueueMode,
	StreamFn,
	ThinkingLevel,
} from "../types.ts";
import { collectEntriesForBranchSummary, generateBranchSummary } from "./compaction/branch-summarization.ts";
import { compact, DEFAULT_COMPACTION_SETTINGS, prepareCompaction } from "./compaction/compaction.ts";
import { convertToLlm } from "./messages.ts";
import { formatPromptTemplateInvocation } from "./prompt-templates.ts";
import { formatSkillInvocation } from "./skills.ts";
import type {
	AbortResult,
	AgentHarnessEvent,
	AgentHarnessEventResultMap,
	AgentHarnessOptions,
	AgentHarnessOwnEvent,
	AgentHarnessPhase,
	AgentHarnessResources,
	AgentHarnessStreamOptions,
	AgentHarnessStreamOptionsPatch,
	AgentHarnessSystemPrompt,
	AgentHarnessTool,
	AgentHarnessToolContextSource,
	CompactResult,
	NavigateTreeResult,
	PendingSessionWrite,
	PromptTemplate,
	Session,
	Skill,
} from "./types.ts";
import { AgentHarnessError, BranchSummaryError, CompactionError, SessionError, toError } from "./types.ts";

// 构造用户消息（私有）：文本 + 可选图片附件，时间戳为当前毫秒
function createUserMessage(text: string, images?: ImageContent[]): UserMessage {
	const content: Array<{ type: "text"; text: string } | ImageContent> = [{ type: "text", text }];
	if (images) content.push(...images);
	return { role: "user", content, timestamp: Date.now() };
}

// 构造失败占位助手消息（私有）：空文本 + stopReason(aborted/error) + 错误信息 + 全零用量
function createFailureMessage(model: Model<any>, error: unknown, aborted: boolean): AssistantMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text: "" }],
		api: model.api,
		provider: model.provider,
		model: model.id,
		stopReason: aborted ? "aborted" : "error",
		errorMessage: error instanceof Error ? error.message : String(error),
		timestamp: Date.now(),
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
	};
}

// 深拷贝流选项（私有）：headers 与 metadata 复制顶层，避免共享引用被意外篡改
function cloneStreamOptions(streamOptions?: AgentHarnessStreamOptions): AgentHarnessStreamOptions {
	return {
		...streamOptions,
		headers: streamOptions?.headers ? { ...streamOptions.headers } : undefined,
		metadata: streamOptions?.metadata ? { ...streamOptions.metadata } : undefined,
	};
}

// 找出重复出现的名字（私有）：返回去重后的重复名列表
function findDuplicateNames(names: string[]): string[] {
	const seen = new Set<string>();
	const duplicates = new Set<string>();
	for (const name of names) {
		if (seen.has(name)) duplicates.add(name);
		seen.add(name);
	}
	return [...duplicates];
}

/**
 * 应用流选项补丁（私有）：标量字段用 Object.hasOwn 判定“是否提供”（允许显式 undefined 清除）；
 * headers/metadata 支持键级删除（值为 undefined 即删），清空后置整体为 undefined。
 */
function applyStreamOptionsPatch(
	base: AgentHarnessStreamOptions,
	patch?: AgentHarnessStreamOptionsPatch,
): AgentHarnessStreamOptions {
	const result = cloneStreamOptions(base);
	if (!patch) return result;

	if (Object.hasOwn(patch, "transport")) result.transport = patch.transport;
	if (Object.hasOwn(patch, "timeoutMs")) result.timeoutMs = patch.timeoutMs;
	if (Object.hasOwn(patch, "maxRetries")) result.maxRetries = patch.maxRetries;
	if (Object.hasOwn(patch, "maxRetryDelayMs")) result.maxRetryDelayMs = patch.maxRetryDelayMs;
	if (Object.hasOwn(patch, "cacheRetention")) result.cacheRetention = patch.cacheRetention;

	if (Object.hasOwn(patch, "headers")) {
		if (patch.headers === undefined) {
			result.headers = undefined;
		} else {
			const headers = { ...(result.headers ?? {}) };
			for (const [key, value] of Object.entries(patch.headers)) {
				if (value === undefined) delete headers[key];
				else headers[key] = value;
			}
			result.headers = Object.keys(headers).length > 0 ? headers : undefined;
		}
	}

	if (Object.hasOwn(patch, "metadata")) {
		if (patch.metadata === undefined) {
			result.metadata = undefined;
		} else {
			const metadata = { ...(result.metadata ?? {}) };
			for (const [key, value] of Object.entries(patch.metadata)) {
				if (value === undefined) delete metadata[key];
				else metadata[key] = value;
			}
			result.metadata = Object.keys(metadata).length > 0 ? metadata : undefined;
		}
	}

	return result;
}

// 通配订阅的事件类型标识："*" 表示接收所有事件
const SUBSCRIBER_EVENT_TYPE = "*";

// 处理器通用类型（内部）：任意事件 + 可选中止信号，返回值任意
type AgentHarnessHandler = (event: any, signal?: AbortSignal) => Promise<any> | any;

// 统一错误归一化（私有）：已是目标类型则原样返回；Session/Compaction/BranchSummary 错误映射到对应码；其余用 fallbackCode
function normalizeHarnessError(error: unknown, fallbackCode: AgentHarnessError["code"]): AgentHarnessError {
	if (error instanceof AgentHarnessError) return error;
	const cause = toError(error);
	if (cause instanceof SessionError) return new AgentHarnessError("session", cause.message, cause);
	if (cause instanceof CompactionError) return new AgentHarnessError("compaction", cause.message, cause);
	if (cause instanceof BranchSummaryError) return new AgentHarnessError("branch_summary", cause.message, cause);
	return new AgentHarnessError(fallbackCode, cause.message, cause);
}

// 钩子错误归一化（私有）：默认归类为 hook 错误
function normalizeHookError(error: unknown): AgentHarnessError {
	return normalizeHarnessError(error, "hook");
}

/**
 * 轮次状态快照（中文说明）：一轮运行期间使用的全部不可变输入——
 * 从会话重建的消息、资源副本、解析后的工具上下文、流选项副本、系统提示词、模型与思考级别、全量与激活工具。
 */
interface AgentHarnessTurnState<
	TContext extends object | undefined,
	TSkill extends Skill = Skill,
	TPromptTemplate extends PromptTemplate = PromptTemplate,
	TTool extends AgentHarnessTool<TContext> = AgentHarnessTool<TContext>,
> {
	messages: AgentMessage[];
	resources: AgentHarnessResources<TSkill, TPromptTemplate>;
	toolContext: TContext;
	streamOptions: AgentHarnessStreamOptions;
	sessionId: string;
	systemPrompt: string;
	model: Model<any>;
	thinkingLevel: ThinkingLevel;
	tools: TTool[];
	activeTools: TTool[];
}

/**
 * AgentHarness（中文说明）：面向应用的高层代理运行时。
 * 四个泛型分别定制：TContext 工具上下文形状、TSkill 技能类型、TPromptTemplate 模板类型、TTool 工具类型。
 * 内部通过阶段机协调 prompt/压缩/树导航互斥，通过 pendingSessionWrites 保证运行中修改的落盘时机。
 */
export class AgentHarness<
	TContext extends object | undefined = undefined,
	TSkill extends Skill = Skill,
	TPromptTemplate extends PromptTemplate = PromptTemplate,
	TTool extends AgentHarnessTool<TContext> = AgentHarnessTool<TContext>,
> {
	// 关联的会话对象（持久化）
	private session: Session;
	// 供应商集合（公开只读，供压缩等外部复用）
	readonly models: Models;
	// 当前阶段：idle/turn/compaction/branch_summary/retry
	private phase: AgentHarnessPhase = "idle";
	// 当前运行的中止控制器
	private runAbortController?: AbortController;
	// 当前运行的完成 Promise（waitForIdle 用）；undefined 表示空闲
	private runPromise?: Promise<void>;
	// 运行期间暂存的会话写入操作，turn_end/agent_end 时统一落盘
	private pendingSessionWrites: PendingSessionWrite[] = [];
	// 当前模型
	private model: Model<any>;
	// 当前思考强度
	private thinkingLevel: ThinkingLevel;
	// 系统提示词（静态串或动态函数）
	private systemPrompt: AgentHarnessSystemPrompt<TContext, TSkill, TPromptTemplate, TTool> | undefined;
	// 工具上下文来源（静态值或零参提供器）
	private toolContext: AgentHarnessToolContextSource<TContext> | undefined;
	// 基线流选项（每轮快照后可被钩子打补丁）
	private streamOptions: AgentHarnessStreamOptions;
	// 压缩/分支摘要的重试策略
	private retry: RetryPolicy | undefined;
	// 技能与模板资源
	private resources: AgentHarnessResources<TSkill, TPromptTemplate>;
	// 工具注册表：名称 → 工具
	private tools = new Map<string, TTool>();
	// 激活工具名单（子集）
	private activeToolNames: string[];
	// “转向”消息队列（运行中插话）
	private steerQueue: UserMessage[] = [];
	// 转向队列消费模式
	private steeringQueueMode: QueueMode;
	// “追问”消息队列（本应停止时消费）
	private followUpQueue: UserMessage[] = [];
	// 追问队列消费模式
	private followUpQueueMode: QueueMode;
	// “下一轮”消息队列（下次 prompt 时随提示一起注入）
	private nextTurnQueue: AgentMessage[] = [];
	// 事件处理器注册表：事件类型（含 "*" 通配）→ 处理器集合
	private handlers = new Map<string, Set<AgentHarnessHandler>>();

	// 构造函数：装配依赖并做工具名唯一性/存在性校验
	constructor(options: AgentHarnessOptions<TContext, TSkill, TPromptTemplate, TTool>) {
		this.session = options.session;
		this.models = options.models;
		this.resources = options.resources ?? {};
		this.streamOptions = cloneStreamOptions(options.streamOptions);
		this.retry = options.retry;
		this.systemPrompt = options.systemPrompt;
		this.toolContext = options.toolContext;
		// 工具名必须唯一
		this.validateUniqueNames(
			(options.tools ?? []).map((tool) => tool.name),
			"Duplicate tool name(s)",
		);
		for (const tool of options.tools ?? []) {
			this.tools.set(tool.name, tool);
		}
		this.model = options.model;
		this.thinkingLevel = options.thinkingLevel ?? "off";
		// 激活名单缺省为全部工具
		this.activeToolNames = options.activeToolNames
			? [...options.activeToolNames]
			: (options.tools ?? []).map((tool) => tool.name);
		this.validateUniqueNames(this.activeToolNames, "Duplicate active tool name(s)");
		this.validateToolNames(this.activeToolNames);
		// 两类队列默认一次消费一条
		this.steeringQueueMode = options.steeringMode ?? "one-at-a-time";
		this.followUpQueueMode = options.followUpMode ?? "one-at-a-time";
	}

	// 取某事件类型的处理器集合（私有）
	private getHandlers(type: string): Set<AgentHarnessHandler> | undefined {
		return this.handlers.get(type);
	}

	// 向通配订阅者广播 Harness 自有事件（私有）：监听器抛错包装为 hook 错误
	private async emitOwn(event: AgentHarnessOwnEvent<TSkill, TPromptTemplate>, signal?: AbortSignal): Promise<void> {
		for (const listener of this.getHandlers(SUBSCRIBER_EVENT_TYPE) ?? []) {
			try {
				await listener(event, signal);
			} catch (error) {
				throw normalizeHookError(error);
			}
		}
	}

	// 向通配订阅者广播任意事件（含低层 Agent 事件）（私有）
	private async emitAny(event: AgentHarnessEvent<TSkill, TPromptTemplate>, signal?: AbortSignal): Promise<void> {
		for (const listener of this.getHandlers(SUBSCRIBER_EVENT_TYPE) ?? []) {
			try {
				await listener(event, signal);
			} catch (error) {
				throw normalizeHookError(error);
			}
		}
	}

	/**
	 * 调用某事件类型的专用钩子链（私有）：按注册顺序执行，非 undefined 的返回值相互覆盖（取最后一个）；
	 * 无处理器或全部返回 undefined 则返回 undefined。返回值经 AgentHarnessEventResultMap 类型约束。
	 */
	private async emitHook<TType extends keyof AgentHarnessEventResultMap>(
		event: Extract<AgentHarnessOwnEvent, { type: TType }>,
	): Promise<AgentHarnessEventResultMap[TType] | undefined> {
		const handlers = this.getHandlers(event.type as TType);
		if (!handlers || handlers.size === 0) return undefined;
		let lastResult: AgentHarnessEventResultMap[TType] | undefined;
		for (const handler of handlers) {
			try {
				const result = await handler(event);
				if (result !== undefined) {
					lastResult = result;
				}
			} catch (error) {
				throw normalizeHookError(error);
			}
		}
		return lastResult;
	}

	// 组装重试回调（私有）：把压缩/分支摘要的重试过程转成对应事件广播
	private retryCallbacks(operation: "compaction" | "branch_summary"): RetryCallbacks {
		return {
			onRetryScheduled: (attempt, maxAttempts, delayMs, errorMessage) =>
				this.emitOwn({ type: "retry_scheduled", operation, attempt, maxAttempts, delayMs, errorMessage }),
			onRetryAttemptStart: () => this.emitOwn({ type: "retry_attempt_start", operation }),
			onRetryFinished: () => this.emitOwn({ type: "retry_finished", operation }),
		};
	}

	/**
	 * before_provider_request 钩子链（私有）：每个处理器可对流选项打补丁，逐个叠加；
	 * 返回最终生效的选项。无处理器时原样返回克隆。
	 */
	private async emitBeforeProviderRequest(
		model: Model<any>,
		sessionId: string,
		streamOptions: AgentHarnessStreamOptions,
	): Promise<AgentHarnessStreamOptions> {
		const handlers = this.getHandlers("before_provider_request");
		let current = cloneStreamOptions(streamOptions);
		if (!handlers || handlers.size === 0) return current;
		for (const handler of handlers) {
			try {
				const result = await handler({
					type: "before_provider_request",
					model,
					sessionId,
					streamOptions: cloneStreamOptions(current),
				});
				if (result?.streamOptions) {
					current = applyStreamOptionsPatch(current, result.streamOptions);
				}
			} catch (error) {
				throw normalizeHookError(error);
			}
		}
		return current;
	}

	// before_provider_payload 钩子链（私有）：任一处理器可替换整个请求载荷
	private async emitBeforeProviderPayload(model: Model<any>, payload: unknown): Promise<unknown> {
		const handlers = this.getHandlers("before_provider_payload");
		let current = payload;
		if (!handlers || handlers.size === 0) return current;
		for (const handler of handlers) {
			try {
				const result = await handler({ type: "before_provider_payload", model, payload: current });
				if (result !== undefined) {
					current = result.payload;
				}
			} catch (error) {
				throw normalizeHookError(error);
			}
		}
		return current;
	}

	// 广播三条队列当前内容快照（私有）
	private async emitQueueUpdate(): Promise<void> {
		await this.emitOwn({
			type: "queue_update",
			steer: [...this.steerQueue],
			followUp: [...this.followUpQueue],
			nextTurn: [...this.nextTurnQueue],
		});
	}

	/**
	 * 创建运行完成句柄（私有）：初始化 runPromise 并返回收尾函数——
	 * 收尾时清空 runPromise 引用并 resolve，使 waitForIdle 的等待者释放。
	 */
	private startRunPromise(): () => void {
		let finish = () => {};
		this.runPromise = new Promise<void>((resolve) => {
			finish = resolve;
		});
		return () => {
			this.runPromise = undefined;
			finish();
		};
	}

	// 解析工具上下文（私有）：来源是函数则调用（可异步），否则直接返回静态值
	private async resolveToolContext(): Promise<TContext> {
		if (typeof this.toolContext === "function") {
			return await (this.toolContext as () => TContext | Promise<TContext>)();
		}
		return this.toolContext as TContext;
	}

	// 把带 context 参数的工具包装为标准 AgentTool（私有）：闭包注入已解析的上下文
	private bindToolContext(tool: TTool, context: TContext): AgentTool {
		return {
			...tool,
			execute: (toolCallId, params, signal, onUpdate) => tool.execute(toolCallId, params, signal, onUpdate, context),
		};
	}

	/**
	 * 创建本轮状态快照（私有）：从会话重建消息上下文 → 解析资源/元数据/工具上下文 →
	 * 计算激活工具 → 解析系统提示词（静态串或调用动态函数；缺省为通用提示）→ 打包返回。
	 */
	private async createTurnState(): Promise<AgentHarnessTurnState<TContext, TSkill, TPromptTemplate, TTool>> {
		const context = await this.session.buildContext();
		const resources = this.getResources();
		const sessionMetadata = await this.session.getMetadata();
		const toolContext = await this.resolveToolContext();
		const tools = [...this.tools.values()];
		const activeTools = this.activeToolNames
			.map((name) => this.tools.get(name))
			.filter((tool): tool is TTool => tool !== undefined);
		let systemPrompt = "You are a helpful assistant.";
		if (typeof this.systemPrompt === "string") {
			systemPrompt = this.systemPrompt;
		} else if (this.systemPrompt) {
			systemPrompt = await this.systemPrompt({
				session: this.session,
				model: this.model,
				thinkingLevel: this.thinkingLevel,
				activeTools,
				resources,
			});
		}
		return {
			messages: context.messages,
			resources,
			toolContext,
			streamOptions: cloneStreamOptions(this.streamOptions),
			sessionId: sessionMetadata.id,
			systemPrompt,
			model: this.model,
			thinkingLevel: this.thinkingLevel,
			tools,
			activeTools,
		};
	}

	// 由轮次状态组装低层 AgentContext（私有）：systemPrompt 可被 before_agent_start 结果覆盖；工具绑定上下文
	private createContext(
		turnState: AgentHarnessTurnState<TContext, TSkill, TPromptTemplate, TTool>,
		systemPrompt?: string,
	): AgentContext {
		return {
			systemPrompt: systemPrompt ?? turnState.systemPrompt,
			messages: turnState.messages.slice(),
			tools: turnState.activeTools.map((tool) => this.bindToolContext(tool, turnState.toolContext)),
		};
	}

	/**
	 * 创建注入 Harness 能力的 StreamFn（私有）：每次模型请求都会——
	 * 取最新轮次状态快照 → before_provider_request 钩子调整选项 → 经 models.streamSimple 发起请求 →
	 * onPayload 走 before_provider_payload 钩子、onResponse 广播 after_provider_response。
	 */
	private createStreamFn(
		getTurnState: () => AgentHarnessTurnState<TContext, TSkill, TPromptTemplate, TTool>,
	): StreamFn {
		return async (model, context, streamOptions) => {
			const turnState = getTurnState();
			const snapshotOptions: AgentHarnessStreamOptions = { ...turnState.streamOptions };
			const requestOptions = await this.emitBeforeProviderRequest(model, turnState.sessionId, snapshotOptions);
			return this.models.streamSimple(model, context, {
				cacheRetention: requestOptions.cacheRetention,
				headers: requestOptions.headers,
				maxRetries: requestOptions.maxRetries,
				maxRetryDelayMs: requestOptions.maxRetryDelayMs,
				metadata: requestOptions.metadata,
				onPayload: async (payload) => await this.emitBeforeProviderPayload(model, payload),
				onResponse: async (response) => {
					const headers = { ...(response.headers as Record<string, string>) };
					await this.emitOwn(
						{ type: "after_provider_response", status: response.status, headers },
						streamOptions?.signal,
					);
				},
				reasoning: streamOptions?.reasoning,
				signal: streamOptions?.signal,
				sessionId: turnState.sessionId,
				timeoutMs: requestOptions.timeoutMs,
				transport: requestOptions.transport,
			});
		};
	}

	/**
	 * 按模式取出队列消息（私有）：all 全取 / one-at-a-time 取一条；
	 * 取出后广播 queue_update，若广播抛错则把消息塞回队列再上抛。参数 queue 目标队列；mode 消费模式。
	 */
	private async drainQueuedMessages(queue: AgentMessage[], mode: QueueMode): Promise<AgentMessage[]> {
		const messages = mode === "all" ? queue.splice(0) : queue.splice(0, 1);
		if (messages.length === 0) return messages;
		try {
			await this.emitQueueUpdate();
			return messages;
		} catch (error) {
			queue.unshift(...messages);
			throw normalizeHookError(error);
		}
	}

	/**
	 * 组装低层循环配置（私有）：把 Harness 能力桥接到 AgentLoopConfig——
	 * context/tool_call/tool_result 分别桥接为 transformContext/beforeToolCall/afterToolCall 钩子；
	 * prepareNextTurn 在每轮结束前先落盘挂起的会话写入并重建下一轮状态；
	 * getSteering/getFollowUp 桥接两条内部队列。
	 */
	private createLoopConfig(
		getTurnState: () => AgentHarnessTurnState<TContext, TSkill, TPromptTemplate, TTool>,
		setTurnState: (turnState: AgentHarnessTurnState<TContext, TSkill, TPromptTemplate, TTool>) => void,
	): AgentLoopConfig {
		const turnState = getTurnState();
		return {
			model: turnState.model,
			reasoning: turnState.thinkingLevel === "off" ? undefined : turnState.thinkingLevel,
			convertToLlm,
			// context 钩子：允许改写即将发送的消息数组
			transformContext: async (messages) => {
				const result = await this.emitHook({ type: "context", messages: [...messages] });
				return result?.messages ?? messages;
			},
			// tool_call 钩子：允许拦截执行
			beforeToolCall: async ({ toolCall, args }) => {
				const result = await this.emitHook({
					type: "tool_call",
					toolCallId: toolCall.id,
					toolName: toolCall.name,
					input: args as Record<string, unknown>,
				});
				return result ? { block: result.block, reason: result.reason } : undefined;
			},
			// tool_result 钩子：允许修补结果
			afterToolCall: async ({ toolCall, args, result, isError }) => {
				const patch = await this.emitHook({
					type: "tool_result",
					toolCallId: toolCall.id,
					toolName: toolCall.name,
					input: args as Record<string, unknown>,
					content: result.content,
					details: result.details,
					isError,
					usage: result.usage,
				});
				return patch
					? {
							content: patch.content,
							details: patch.details,
							isError: patch.isError,
							usage: patch.usage,
							terminate: patch.terminate,
						}
					: undefined;
			},
			// 下一轮前：先落盘挂起写入，再用最新会话/配置重建轮次状态
			prepareNextTurn: async () => {
				await this.flushPendingSessionWrites();
				const nextTurnState = await this.createTurnState();
				setTurnState(nextTurnState);
				return {
					context: this.createContext(nextTurnState),
					model: nextTurnState.model,
					thinkingLevel: nextTurnState.thinkingLevel,
				};
			},
			getSteeringMessages: async () => this.drainQueuedMessages(this.steerQueue, this.steeringQueueMode),
			getFollowUpMessages: async () => this.drainQueuedMessages(this.followUpQueue, this.followUpQueueMode),
		};
	}

	// 校验名字唯一性（私有）：有重复即抛 invalid_argument
	private validateUniqueNames(names: string[], message: string): void {
		const duplicates = findDuplicateNames(names);
		if (duplicates.length > 0)
			throw new AgentHarnessError("invalid_argument", `${message}: ${duplicates.join(", ")}`);
	}

	// 校验激活工具名单（私有）：名字需唯一且都已在注册表中
	private validateToolNames(toolNames: string[], tools: Map<string, TTool> = this.tools): void {
		this.validateUniqueNames(toolNames, "Duplicate active tool name(s)");
		const missing = toolNames.filter((name) => !tools.has(name));
		if (missing.length > 0) throw new AgentHarnessError("invalid_argument", `Unknown tool(s): ${missing.join(", ")}`);
	}

	/**
	 * 落盘挂起的会话写入（私有）：按 FIFO 顺序把缓冲中的草稿逐条转为真正的会话条目；
	 * 支持 message/model_change/thinking_level_change/active_tools_change/custom/custom_message/
	 * label/session_info/leaf 九种类型。
	 */
	private async flushPendingSessionWrites(): Promise<void> {
		while (this.pendingSessionWrites.length > 0) {
			const write = this.pendingSessionWrites[0]!;
			if (write.type === "message") {
				await this.session.appendMessage(write.message);
			} else if (write.type === "model_change") {
				await this.session.appendModelChange(write.provider, write.modelId);
			} else if (write.type === "thinking_level_change") {
				await this.session.appendThinkingLevelChange(write.thinkingLevel);
			} else if (write.type === "active_tools_change") {
				await this.session.appendActiveToolsChange(write.activeToolNames);
			} else if (write.type === "custom") {
				await this.session.appendCustomEntry(write.customType, write.data);
			} else if (write.type === "custom_message") {
				await this.session.appendCustomMessageEntry(write.customType, write.content, write.display, write.details);
			} else if (write.type === "label") {
				await this.session.appendLabel(write.targetId, write.label);
			} else if (write.type === "session_info") {
				await this.session.appendSessionName(write.name ?? "");
			} else if (write.type === "leaf") {
				await this.session.getStorage().setLeafId(write.targetId);
			}
			this.pendingSessionWrites.shift();
		}
	}

	/**
	 * 低层事件处理入口（私有）：message_end 时把消息写入会话；turn_end 先广播事件、
	 * 记录可能的钩子错误、落盘挂起写入后再抛出该错误，最后发 save_point；
	 * agent_end 时落盘并把阶段复位为 idle，随后广播事件与 settled；
	 * 其余事件直接透传给订阅者。
	 */
	private async handleAgentEvent(event: AgentEvent, signal?: AbortSignal): Promise<void> {
		if (event.type === "message_end") {
			await this.session.appendMessage(event.message);
			await this.emitAny(event, signal);
			return;
		}
		if (event.type === "turn_end") {
			let eventError: unknown;
			try {
				await this.emitAny(event, signal);
			} catch (error) {
				// 订阅者出错也要保证先落盘再报错
				eventError = error;
			}
			const hadPendingMutations = this.pendingSessionWrites.length > 0;
			await this.flushPendingSessionWrites();
			if (eventError) throw eventError;
			await this.emitOwn({ type: "save_point", hadPendingMutations });
			return;
		}
		if (event.type === "agent_end") {
			await this.flushPendingSessionWrites();
			this.phase = "idle";
			await this.emitAny(event, signal);
			await this.emitOwn({ type: "settled", nextTurnCount: this.nextTurnQueue.length }, signal);
			return;
		}
		await this.emitAny(event, signal);
	}

	/**
	 * 运行失败的兜底事件序列（私有）：合成失败助手消息并依次走完
	 * message_start/message_end/turn_end/agent_end 四步处理，保证订阅者收到完整生命周期。
	 * 返回 [failureMessage]。
	 */
	private async emitRunFailure(
		model: Model<any>,
		error: unknown,
		aborted: boolean,
		signal: AbortSignal,
	): Promise<AgentMessage[]> {
		const failureMessage = createFailureMessage(model, error, aborted);
		await this.handleAgentEvent({ type: "message_start", message: failureMessage }, signal);
		await this.handleAgentEvent({ type: "message_end", message: failureMessage }, signal);
		await this.handleAgentEvent({ type: "turn_end", message: failureMessage, toolResults: [] }, signal);
		await this.handleAgentEvent({ type: "agent_end", messages: [failureMessage] }, signal);
		return [failureMessage];
	}

	/**
	 * 执行一轮完整运行（私有核心）：组装初始消息（nextTurn 队列优先 + 用户消息）→
	 * before_agent_start 钩子可追加消息或覆盖系统提示词 → 启动 runAgentLoop（事件经 handleAgentEvent）→
	 * 循环异常走 emitRunFailure 兜底（兜底再失败则聚合两个错误上抛）→ 成功则返回最后一条助手消息；
	 * finally 中落盘挂起写入并清理中止控制器。
	 */
	private async executeTurn(
		turnState: AgentHarnessTurnState<TContext, TSkill, TPromptTemplate, TTool>,
		text: string,
		options?: { images?: ImageContent[] },
	): Promise<AssistantMessage> {
		// 运行中可被 prepareNextTurn 替换的可变引用
		let activeTurnState = turnState;
		let messages: AgentMessage[] = [createUserMessage(text, options?.images)];
		// nextTurn 队列非空：先于用户消息注入
		if (this.nextTurnQueue.length > 0) {
			const queuedMessages = this.nextTurnQueue.splice(0);
			try {
				await this.emitQueueUpdate();
			} catch (error) {
				this.nextTurnQueue.unshift(...queuedMessages);
				throw normalizeHookError(error);
			}
			messages = [...queuedMessages, messages[0]!];
		}
		// 启动前钩子：可改写提示词/追加消息
		const beforeResult = await this.emitHook({
			type: "before_agent_start",
			prompt: text,
			images: options?.images,
			systemPrompt: turnState.systemPrompt,
			resources: turnState.resources,
		});
		if (beforeResult?.messages) messages = [...messages, ...beforeResult.messages];

		const abortController = new AbortController();
		const getTurnState = () => activeTurnState;
		const setTurnState = (nextTurnState: AgentHarnessTurnState<TContext, TSkill, TPromptTemplate, TTool>) => {
			activeTurnState = nextTurnState;
		};
		this.runAbortController = abortController;
		const runResultPromise = (async () => {
			try {
				return await runAgentLoop(
					messages,
					this.createContext(turnState, beforeResult?.systemPrompt),
					this.createLoopConfig(getTurnState, setTurnState),
					(event) => this.handleAgentEvent(event, abortController.signal),
					abortController.signal,
					this.createStreamFn(getTurnState),
				);
			} catch (error) {
				try {
					// 主流程失败：合成失败事件序列保证生命周期完整
					return await this.emitRunFailure(
						activeTurnState.model,
						error,
						abortController.signal.aborted,
						abortController.signal,
					);
				} catch (failureError) {
					// 兜底也失败：聚合两个错误
					const cause = new AggregateError(
						[toError(error), toError(failureError)],
						"Agent run failed and failure reporting failed",
					);
					throw new AgentHarnessError("unknown", cause.message, cause);
				}
			}
		})();
		try {
			const newMessages = await runResultPromise;
			// 从后向前找第一条助手消息作为本轮答复
			for (let i = newMessages.length - 1; i >= 0; i--) {
				const message = newMessages[i]!;
				if (message.role === "assistant") {
					return message;
				}
			}
			throw new AgentHarnessError("invalid_state", "AgentHarness prompt completed without an assistant message");
		} finally {
			try {
				await this.flushPendingSessionWrites();
			} finally {
				this.runAbortController = undefined;
			}
		}
	}

	/**
	 * 发起新提示（公开）：非 idle 抛 busy；进入 turn 阶段 → 建轮次状态 → executeTurn →
	 * 异常归一化并复位 idle → finally 结束运行句柄。返回最后一条助手消息。
	 */
	async prompt(text: string, options?: { images?: ImageContent[] }): Promise<AssistantMessage> {
		if (this.phase !== "idle") throw new AgentHarnessError("busy", "AgentHarness is busy");
		this.phase = "turn";
		const finishRunPromise = this.startRunPromise();
		try {
			const turnState = await this.createTurnState();
			return await this.executeTurn(turnState, text, options);
		} catch (error) {
			this.phase = "idle";
			throw normalizeHarnessError(error, "unknown");
		} finally {
			finishRunPromise();
		}
	}

	/**
	 * 显式调用技能（公开）：在资源中按名查找技能，格式化为 <skill> 提示词并发起一轮运行。
	 * 技能不存在抛 invalid_argument。
	 */
	async skill(name: string, additionalInstructions?: string): Promise<AssistantMessage> {
		if (this.phase !== "idle") throw new AgentHarnessError("busy", "AgentHarness is busy");
		this.phase = "turn";
		const finishRunPromise = this.startRunPromise();
		try {
			const turnState = await this.createTurnState();
			const skill = (turnState.resources.skills ?? []).find((candidate) => candidate.name === name);
			if (!skill) throw new AgentHarnessError("invalid_argument", `Unknown skill: ${name}`);
			return await this.executeTurn(turnState, formatSkillInvocation(skill, additionalInstructions));
		} catch (error) {
			this.phase = "idle";
			throw normalizeHarnessError(error, "unknown");
		} finally {
			finishRunPromise();
		}
	}

	/**
	 * 从提示词模板发起运行（公开）：按名查找模板并用位置参数渲染后执行；
	 * 模板不存在抛 invalid_argument。
	 */
	async promptFromTemplate(name: string, args: string[] = []): Promise<AssistantMessage> {
		if (this.phase !== "idle") throw new AgentHarnessError("busy", "AgentHarness is busy");
		this.phase = "turn";
		const finishRunPromise = this.startRunPromise();
		try {
			const turnState = await this.createTurnState();
			const template = (turnState.resources.promptTemplates ?? []).find((candidate) => candidate.name === name);
			if (!template) throw new AgentHarnessError("invalid_argument", `Unknown prompt template: ${name}`);
			return await this.executeTurn(turnState, formatPromptTemplateInvocation(template, args));
		} catch (error) {
			this.phase = "idle";
			throw normalizeHarnessError(error, "unknown");
		} finally {
			finishRunPromise();
		}
	}

	// 入队一条“转向”消息：仅在运行中可用；入队后广播队列更新
	async steer(text: string, options?: { images?: ImageContent[] }): Promise<void> {
		if (this.phase === "idle") throw new AgentHarnessError("invalid_state", "Cannot steer while idle");
		this.steerQueue.push(createUserMessage(text, options?.images));
		await this.emitQueueUpdate();
	}

	// 入队一条“追问”消息：仅在运行中可用
	async followUp(text: string, options?: { images?: ImageContent[] }): Promise<void> {
		if (this.phase === "idle") throw new AgentHarnessError("invalid_state", "Cannot follow up while idle");
		this.followUpQueue.push(createUserMessage(text, options?.images));
		await this.emitQueueUpdate();
	}

	// 入队一条“下一轮”消息：空闲时也可用，下次 prompt 时最先注入
	async nextTurn(text: string, options?: { images?: ImageContent[] }): Promise<void> {
		this.nextTurnQueue.push(createUserMessage(text, options?.images));
		await this.emitQueueUpdate();
	}

	// 直接追加任意消息到会话：空闲立即写盘；运行中进待写缓冲
	async appendMessage(message: AgentMessage): Promise<void> {
		try {
			if (this.phase === "idle") {
				await this.session.appendMessage(message);
			} else {
				this.pendingSessionWrites.push({ type: "message", message });
			}
		} catch (error) {
			throw normalizeHarnessError(error, "session");
		}
	}

	/**
	 * 手动触发历史压缩（公开）：准备压缩数据 → session_before_compact 钩子可取消或提供现成结果 →
	 * 否则调用 compact 生成 → 写入 compaction 条目 → 广播 session_compact。
	 * 返回 CompactResult。
	 */
	async compact(customInstructions?: string): Promise<CompactResult> {
		if (this.phase !== "idle") throw new AgentHarnessError("busy", "compact() requires idle harness");
		this.phase = "compaction";
		try {
			const model = this.model;
			if (!model) throw new AgentHarnessError("invalid_state", "No model set for compaction");
			const branchEntries = await this.session.getBranch();
			const preparationResult = prepareCompaction(branchEntries, DEFAULT_COMPACTION_SETTINGS);
			if (!preparationResult.ok) throw preparationResult.error;
			const preparation = preparationResult.value;
			if (!preparation) throw new AgentHarnessError("compaction", "Nothing to compact");
			// 钩子可取消或自带压缩结果
			const hookResult = await this.emitHook({
				type: "session_before_compact",
				preparation,
				branchEntries,
				customInstructions,
				signal: new AbortController().signal,
			});
			if (hookResult?.cancel) throw new AgentHarnessError("compaction", "Compaction cancelled");
			const provided = hookResult?.compaction;
			const compactResult = provided
				? { ok: true as const, value: provided }
				: await compact(
						preparation,
						this.models,
						model,
						customInstructions,
						undefined,
						this.thinkingLevel,
						this.retry,
						this.retryCallbacks("compaction"),
					);
			if (!compactResult.ok) throw compactResult.error;
			const result = compactResult.value;
			// 持久化压缩条目（fromHook 标记是否来自钩子）
			const entryId = await this.session.appendCompaction(
				result.summary,
				result.firstKeptEntryId,
				result.tokensBefore,
				result.details,
				provided !== undefined,
				result.usage,
				result.retainedTail,
			);
			const entry = await this.session.getEntry(entryId);
			if (entry?.type === "compaction") {
				await this.emitOwn({ type: "session_compact", compactionEntry: entry, fromHook: provided !== undefined });
			}
			return result;
		} catch (error) {
			throw normalizeHarnessError(error, "compaction");
		} finally {
			this.phase = "idle";
		}
	}

	/**
	 * 在会话树中移动到目标条目（公开）：收集旧分支条目 → session_before_tree 钩子可取消/
	 * 自带摘要/定制指令 → 需要且可能时生成分支摘要 → 计算新叶子（目标是 user/custom_message
	 * 时回到其父节点并把原文回填编辑器）→ moveTo 落盘并广播 session_tree。
	 */
	async navigateTree(
		targetId: string,
		options?: { summarize?: boolean; customInstructions?: string; replaceInstructions?: boolean; label?: string },
	): Promise<NavigateTreeResult> {
		if (this.phase !== "idle") throw new AgentHarnessError("busy", "navigateTree() requires idle harness");
		this.phase = "branch_summary";
		try {
			const oldLeafId = await this.session.getLeafId();
			// 已在目标处：无需动作
			if (oldLeafId === targetId) return { cancelled: false };
			const targetEntry = await this.session.getEntry(targetId);
			if (!targetEntry) throw new AgentHarnessError("invalid_argument", `Entry ${targetId} not found`);
			const { entries, commonAncestorId } = await collectEntriesForBranchSummary(this.session, oldLeafId, targetId);
			const preparation = {
				targetId,
				oldLeafId,
				commonAncestorId,
				entriesToSummarize: entries,
				userWantsSummary: options?.summarize ?? false,
				customInstructions: options?.customInstructions,
				replaceInstructions: options?.replaceInstructions,
				label: options?.label,
			};
			const signal = new AbortController().signal;
			const hookResult = await this.emitHook({ type: "session_before_tree", preparation, signal });
			if (hookResult?.cancel) return { cancelled: true };
			let summaryEntry: NavigateTreeResult["summaryEntry"];
			let summaryText: string | undefined = hookResult?.summary?.summary;
			let summaryDetails: unknown = hookResult?.summary?.details;
			let summaryUsage = hookResult?.summary?.usage;
			if (!summaryText && options?.summarize && entries.length > 0) {
				// 无钩子摘要且用户要求摘要：调用模型生成
				const model = this.model;
				if (!model) throw new AgentHarnessError("invalid_state", "No model set for branch summary");
				const branchSummary = await generateBranchSummary(entries, {
					models: this.models,
					model,
					signal: new AbortController().signal,
					customInstructions: hookResult?.customInstructions ?? options?.customInstructions,
					replaceInstructions: hookResult?.replaceInstructions ?? options?.replaceInstructions,
					retry: this.retry,
					callbacks: this.retryCallbacks("branch_summary"),
				});
				if (!branchSummary.ok) {
					// 摘要被中止视为取消导航
					if (branchSummary.error.code === "aborted") return { cancelled: true };
					throw new AgentHarnessError("branch_summary", branchSummary.error.message, branchSummary.error);
				}
				summaryText = branchSummary.value.summary;
				summaryUsage = branchSummary.value.usage;
				summaryDetails = {
					readFiles: branchSummary.value.readFiles,
					modifiedFiles: branchSummary.value.modifiedFiles,
				};
			}
			let editorText: string | undefined;
			let newLeafId: string | null;
			if (targetEntry.type === "message" && targetEntry.message.role === "user") {
				// 目标是用户消息：回到其父节点并把原文回填编辑器供重新发送
				newLeafId = targetEntry.parentId;
				editorText = contentText(targetEntry.message.content, "");
			} else if (targetEntry.type === "custom_message") {
				newLeafId = targetEntry.parentId;
				editorText = contentText(targetEntry.content, "");
			} else {
				newLeafId = targetId;
			}
			const summaryId = await this.session.moveTo(
				newLeafId,
				summaryText
					? {
							summary: summaryText,
							details: summaryDetails,
							usage: summaryUsage,
							fromHook: hookResult?.summary !== undefined,
						}
					: undefined,
			);
			if (summaryId) {
				const entry = await this.session.getEntry(summaryId);
				if (entry?.type === "branch_summary") summaryEntry = entry;
			}
			await this.emitOwn({
				type: "session_tree",
				newLeafId: await this.session.getLeafId(),
				oldLeafId,
				summaryEntry,
				fromHook: hookResult?.summary !== undefined,
			});
			return { cancelled: false, editorText, summaryEntry };
		} catch (error) {
			throw normalizeHarnessError(error, "branch_summary");
		} finally {
			this.phase = "idle";
		}
	}

	// 读取当前模型
	getModel(): Model<any> {
		return this.model;
	}

	// 设置模型：空闲立即记录变更条目，运行中进缓冲；广播 model_update
	async setModel(model: Model<any>): Promise<void> {
		try {
			const previousModel = this.model;
			if (this.phase === "idle") {
				await this.session.appendModelChange(model.provider, model.id);
			} else {
				this.pendingSessionWrites.push({ type: "model_change", provider: model.provider, modelId: model.id });
			}
			this.model = model;
			await this.emitOwn({ type: "model_update", model, previousModel, source: "set" });
		} catch (error) {
			throw normalizeHarnessError(error, "session");
		}
	}

	// 读取思考强度
	getThinkingLevel(): ThinkingLevel {
		return this.thinkingLevel;
	}

	// 设置思考强度：同 setModel 的落盘策略
	async setThinkingLevel(level: ThinkingLevel): Promise<void> {
		try {
			const previousLevel = this.thinkingLevel;
			if (this.phase === "idle") {
				await this.session.appendThinkingLevelChange(level);
			} else {
				this.pendingSessionWrites.push({ type: "thinking_level_change", thinkingLevel: level });
			}
			this.thinkingLevel = level;
			await this.emitOwn({ type: "thinking_level_update", level, previousLevel });
		} catch (error) {
			throw normalizeHarnessError(error, "session");
		}
	}

	// 获取全部已注册工具（数组副本）
	getTools(): TTool[] {
		return [...this.tools.values()];
	}

	/**
	 * 整体替换工具集（公开）：校验唯一性与激活名单有效性后生效；
	 * 名单变化写入会话（或缓冲）并广播 tools_update。
	 */
	async setTools(tools: TTool[], activeToolNames?: string[]): Promise<void> {
		try {
			this.validateUniqueNames(
				tools.map((tool) => tool.name),
				"Duplicate tool name(s)",
			);
			const nextTools = new Map(tools.map((tool) => [tool.name, tool]));
			const nextActiveToolNames = activeToolNames ? [...activeToolNames] : this.activeToolNames;
			this.validateToolNames(nextActiveToolNames, nextTools);
			const previousToolNames = [...this.tools.keys()];
			const previousActiveToolNames = [...this.activeToolNames];
			if (this.phase === "idle") {
				await this.session.appendActiveToolsChange(nextActiveToolNames);
			} else {
				this.pendingSessionWrites.push({ type: "active_tools_change", activeToolNames: [...nextActiveToolNames] });
			}
			this.tools = nextTools;
			this.activeToolNames = [...nextActiveToolNames];
			await this.emitOwn({
				type: "tools_update",
				toolNames: [...this.tools.keys()],
				previousToolNames,
				activeToolNames: [...this.activeToolNames],
				previousActiveToolNames,
				source: "set",
			});
		} catch (error) {
			throw normalizeHarnessError(error, "invalid_argument");
		}
	}

	// 获取当前激活的工具实例列表
	getActiveTools(): TTool[] {
		return this.activeToolNames.map((name) => this.tools.get(name)!);
	}

	// 仅替换激活名单（不改变注册表）：语义同 setTools 的名单部分
	async setActiveTools(toolNames: string[]): Promise<void> {
		try {
			this.validateToolNames(toolNames);
			const previousToolNames = [...this.tools.keys()];
			const previousActiveToolNames = [...this.activeToolNames];
			if (this.phase === "idle") {
				await this.session.appendActiveToolsChange(toolNames);
			} else {
				this.pendingSessionWrites.push({ type: "active_tools_change", activeToolNames: [...toolNames] });
			}
			this.activeToolNames = [...toolNames];
			await this.emitOwn({
				type: "tools_update",
				toolNames: [...this.tools.keys()],
				previousToolNames,
				activeToolNames: [...this.activeToolNames],
				previousActiveToolNames,
				source: "set",
			});
		} catch (error) {
			throw normalizeHarnessError(error, "invalid_argument");
		}
	}

	// 读取转向队列模式
	getSteeringMode(): QueueMode {
		return this.steeringQueueMode;
	}

	// 设置转向队列模式（即时生效）
	async setSteeringMode(mode: QueueMode): Promise<void> {
		this.steeringQueueMode = mode;
	}

	// 读取追问队列模式
	getFollowUpMode(): QueueMode {
		return this.followUpQueueMode;
	}

	// 设置追问队列模式
	async setFollowUpMode(mode: QueueMode): Promise<void> {
		this.followUpQueueMode = mode;
	}

	// 获取资源副本（技能与模板数组浅拷贝，防外部篡改）
	getResources(): AgentHarnessResources<TSkill, TPromptTemplate> {
		return {
			skills: this.resources.skills?.slice(),
			promptTemplates: this.resources.promptTemplates?.slice(),
		};
	}

	// 整体替换资源并广播 resources_update（同样以副本保存）
	async setResources(resources: AgentHarnessResources<TSkill, TPromptTemplate>): Promise<void> {
		const previousResources = this.getResources();
		this.resources = {
			skills: resources.skills?.slice(),
			promptTemplates: resources.promptTemplates?.slice(),
		};
		await this.emitOwn({ type: "resources_update", resources: this.getResources(), previousResources });
	}

	// 获取流选项副本
	getStreamOptions(): AgentHarnessStreamOptions {
		return cloneStreamOptions(this.streamOptions);
	}

	// 替换基线流选项（副本保存）
	async setStreamOptions(streamOptions: AgentHarnessStreamOptions): Promise<void> {
		this.streamOptions = cloneStreamOptions(streamOptions);
	}

	/**
	 * 中止当前运行（公开）：清空两条队列并触发中止 → 依次广播 queue_update、等待运行结束、
	 * 广播 abort 事件；三步中任何钩子错误都会收集并以 AggregateError 归一后抛出。
	 * 返回被清除的两条队列内容。
	 */
	async abort(): Promise<AbortResult> {
		const clearedSteer = [...this.steerQueue];
		const clearedFollowUp = [...this.followUpQueue];
		this.steerQueue = [];
		this.followUpQueue = [];
		this.runAbortController?.abort();
		const errors: Error[] = [];
		try {
			await this.emitQueueUpdate();
		} catch (error) {
			errors.push(toError(error));
		}
		try {
			await this.waitForIdle();
		} catch (error) {
			errors.push(toError(error));
		}
		try {
			await this.emitOwn({ type: "abort", clearedSteer, clearedFollowUp });
		} catch (error) {
			errors.push(toError(error));
		}
		if (errors.length > 0) {
			const cause = errors.length === 1 ? errors[0]! : new AggregateError(errors, "Abort completed with errors");
			throw normalizeHarnessError(cause, "hook");
		}
		return { clearedSteer, clearedFollowUp };
	}

	// 等待当前运行完全结束；空闲时立即返回
	async waitForIdle(): Promise<void> {
		await this.runPromise;
	}

	/**
	 * 订阅全部事件（公开）：监听器同时收到低层 Agent 事件与 Harness 自有事件；
	 * 返回取消订阅函数。
	 */
	subscribe(
		listener: (event: AgentHarnessEvent<TSkill, TPromptTemplate>, signal?: AbortSignal) => Promise<void> | void,
	): () => void {
		let handlers = this.handlers.get(SUBSCRIBER_EVENT_TYPE);
		if (!handlers) {
			handlers = new Set();
			this.handlers.set(SUBSCRIBER_EVENT_TYPE, handlers);
		}
		handlers.add(listener as AgentHarnessHandler);
		return () => handlers!.delete(listener as AgentHarnessHandler);
	}

	/**
	 * 注册特定类型的钩子（公开）：返回类型受 AgentHarnessEventResultMap 约束；
	 * 同类型多个钩子按注册顺序执行，非 undefined 返回值相互覆盖。返回移除函数。
	 */
	on<TType extends keyof AgentHarnessEventResultMap>(
		type: TType,
		handler: (
			event: Extract<AgentHarnessOwnEvent, { type: TType }>,
		) => Promise<AgentHarnessEventResultMap[TType]> | AgentHarnessEventResultMap[TType],
	): () => void {
		let handlers = this.handlers.get(type);
		if (!handlers) {
			handlers = new Set();
			this.handlers.set(type, handlers);
		}
		handlers.add(handler as AgentHarnessHandler);
		return () => handlers!.delete(handler as AgentHarnessHandler);
	}
}
