# Pico5规范

Pico5是一个耐用且可扩展的代理框架。本文件为规范性文件。

Pico5使用现有的包类型如下：

```ts
import type {
  AttachedReplicatedState,
  Context,
  Draft,
  JsonRepresentation,
  JsonValue,
  ReplicatedState,
} from "@earendil-works/chord";
import type { Op } from "@earendil-works/chord/delta";
import type {
  AssistantMessage,
  CacheRetention,
  DeferredHandle,
  Message,
  Models,
  ModelThinkingLevel,
  TextContent,
  Tool,
  ToolCall,
  ToolReference,
  ToolResultMessage,
  Transport,
  UserMessage,
} from "@earendil-works/pi-ai";
import type { ExecutionEnv } from "@earendil-works/pi-durable/env";

type JsonObject = { [key: string]: JsonValue };
type TaskOutcomeError = { message: string; detail?: JsonValue };
```

Pico5的目标转录合同为pi-ai PR中的`SystemMessage`合同[#9548](https://github.com/earendil-works/pi/pull/9548)。`Message`在PR落地后包含该类型。

核心规则是：

> A会话原子提交不可变条目、完整任务记录和
> Chord跟踪的文档。只有已提交的状态可被观察。

## 1.术语和不变量

- A **会话**拥有一个突变线、对话、条目、任务、提交和文档。
- A **对话**是一个转录范围。它可能派生出另一个对话。
- 一个 **条目**是不可变的转录记录。
- A **任务**是一个与一个对话关联的耐用状态机。
- A **文档**是通过Chord操作和偶尔的完整基础表示的可变JSON状态。
- A **定义**是一个描述一个文档或文档家族的类型化令牌。
- A **源**将已提交的文档更改暴露给Chord，而不暴露可变对象。
- A **轮询**是一个助手响应及其调用的工具。一个 **运行**是从被接受的输入到最终答案的轮询序列；轮询边界（第6节）位于其轮询之间。当一个运行活跃时，对话处于忙碌状态。

必需的不变量：

1. 一个会话提交是原子的，跨所有记录和文档写入。
2. 文档更新仅在其存储提交成功后才发布。
3. 所有可见的进度都是持久的。没有易失性发布路径。
4. 外部效果不会在会话突变事务内运行。
5. 条目和ID是不可变的，且在一次已提交的写入后永远不会被重复使用。
6. 文档草稿在它们的事务回调结算时完全撤销：会话同步准备或中止每个开放更改。分配到草稿中的值是按值复制的，并且必须是严格的JSON。
7. 突变线在存储结算和已提交状态采纳期间保持持有。提交/关闭观察者仅同步运行以捕获不可变状态；文档状态和用户回调在稍后、脱离线程时运行。
8. 不确定的存储失败对开放会话是致命的。它不发布任何内容，必须重新打开。准备和检查点失败发生在存储准入之前，并正常回滚。

## 2.核心记录

具体的JSON表示可能增加记账字段，但必须保持这些合同。

```ts
declare const idBrand: unique symbol;
type Id<Kind extends string, Type = unknown> = number & {
  readonly [idBrand]: {
    readonly kind: Kind;
    readonly type: Type;
  };
};
type ConversationId = Id<"conversation">;
type EntryId = Id<"entry">;
type TaskId<Result = unknown> = Id<"task", Result>;
type SubmissionId = Id<"submission">;
type DocumentId = Id<"document">;

declare const seqBrand: unique symbol;
/** Strictly increases between commits; gaps are permitted. */
type Seq = number & { readonly [seqBrand]: "sequence" };
const ROOT_CONVERSATION_ID = 1 as ConversationId;

type ConversationOwnership =
  | { readonly kind: "ownerless" }
  | { readonly kind: "task"; readonly taskId: TaskId };

type ConversationRecord = {
  readonly id: ConversationId;
  readonly parent?: {
    readonly conversationId: ConversationId;
    readonly at: EntryId;
  };
  readonly owner?: {
    readonly conversationId: ConversationId;
    readonly taskId: TaskId;
  };
};
```

引用的pi-ai成员是：

```ts
interface SystemMessage {
  role: "system";
  content: string | TextContent[];
  sections?: Record<string, string | null>;
  toolsAdded?: Tool[];
  toolsRemoved?: ToolReference[];
  timestamp: number;
}
```

在pi-ai中，`content`是引导消息和后续消息的附加说明文本的基本提示。`sections`是一个有序命名补丁：字符串添加或替换部分，而`null`删除它。`toolsRemoved`在一条消息内先于`toolsAdded`应用。按转录顺序重放每个系统消息可获得有效的提示和工具集。

Pico总是写入`content: ""`。每个提示部分，包括前言，都是从对话代理解析的命名部分（第7.4节）。

```ts
type ContextEdit = {
  readonly target: EntryId;
} & (
  | { readonly action: "omit"; readonly messages?: never }
  | { readonly action: "replace"; readonly messages: readonly Message[] }
);

type EntryRecord = {
  readonly id: EntryId;
  readonly conversationId: ConversationId;
  readonly kind: string;
  readonly model?: readonly Message[];
  readonly data?: JsonValue;
  readonly head?: EntryId;
  readonly edits?: readonly ContextEdit[];
  readonly byTaskId?: TaskId;
};

type EntryDraft = Omit<EntryRecord, "id" | "conversationId" | "byTaskId" | "head"> & {
  readonly head?: EntryId | "self";
};

type SubmissionRecordBase = {
  readonly id: SubmissionId;
  readonly conversationId: ConversationId;
  readonly requestId?: string;
};

type SubmissionRecord =
  | (SubmissionRecordBase & {
      readonly type: "input";
    } & (
      | {
          readonly status: "queued";
          readonly entry?: never;
          readonly answer?: never;
          readonly reason?: never;
          readonly detail?: never;
        }
      | {
          readonly status: "placed";
          readonly entry: EntryId;
          readonly answer?: never;
          readonly reason?: never;
          readonly detail?: never;
        }
      | {
          readonly status: "done";
          readonly entry: EntryId;
          readonly answer: EntryId;
          readonly reason?: never;
          readonly detail?: never;
        }
      | {
          readonly status: "unanswered";
          readonly entry?: EntryId;
          readonly answer?: never;
          readonly reason: string;
          readonly detail?: JsonValue;
        }
    ))
  | (SubmissionRecordBase & {
      readonly type: "write";
    } & (
      | {
          readonly status: "queued";
          readonly entry?: never;
          readonly answer?: never;
          readonly reason?: never;
          readonly detail?: never;
        }
      | {
          readonly status: "done";
          readonly entry: EntryId;
          readonly answer?: never;
          readonly reason?: never;
          readonly detail?: never;
        }
      | {
          readonly status: "unanswered";
          readonly entry?: never;
          readonly answer?: never;
          readonly reason: string;
          readonly detail?: JsonValue;
        }
    ));

type SubmissionSettlement =
  | { readonly status: "done"; readonly answer: EntryId }
  | { readonly status: "unanswered"; readonly reason: string; readonly detail?: JsonValue };

type SubmissionCreate = SubmissionRecord extends infer Record
  ? Record extends SubmissionRecord
    ? Omit<Record, "id">
    : never
  : never;
```

ID品牌仅在编译时有效。ID和序列在内存、JSON、JSONL和SQLite中保持为普通数字。代码仅在受信任的创建或解码边界应用品牌。独特的序列品牌防止实体ID被用作文档提交点。

对话历史的父级和任务所有权是分开的：

- `parent`控制继承条目和历史文档。
- `owner`记录任务归属并连接范围以支持子树中止和空闲遍历。它不是访问控制能力。
- 创建时总是显式提供`ConversationOwnership`。会话从命名任务派生持久所有者的对话；调用者永远不会构造持久所有者对。

对话的所有者在拥有任务终止后仍被记录。

### 2.1 条目和上下文

条目ID是会话全局且有序的。`parent.at`是父历史中可见于子对话的条目。
活动转录是最新适用的`head`起始范围到尾部的原始条目范围。条目上的头部会改变后续上下文；它不会从存储中移除较旧的条目。分叉遍历是先遍历子条目，再通过每个`parent.at`帽遍历父条目。

上下文推导：

1. 找到截止日期之前或之前的最新可见条目`H`，该条目具有`head`。
2. 让`from = H.head`，或转录起始点，当`H`不存在时。
3. 从`from`扫描到截止日期之间的可见条目。
4. 对于每个目标，在该范围内，最新编辑胜出。`omit`不贡献模型消息；`replace`贡献其`messages`而非目标的。
5. 如果`H`存在，上下文条目是`H`，然后是范围内的非头部条目。否则，它们是该范围本身。
6. 保留每个位置系统消息及其工具/节的更改。
7. 将每个助手的工具结果（在下一个助手消息之前找到）直接按工具调用顺序放在其后，置于任何中间用户或系统消息之前。提供程序协议要求结果必须紧跟其调用。
8. 为每个没有结果的调用合成错误结果，例如在分叉切割或中断尾部之后。删除没有前置调用的工具结果。
9. 排除无模型条目和具有`aborted`、`error`或`deferred`停止原因的助手消息，以供未来提供程序请求使用。

视图携带原始活动条目。UI缩减和模型上下文缩减是独立的消费者。较旧的存储历史记录可通过拥有`Conversation`对象的基于游标的`entries()`扫描获取。

### 2.2 公共框架表面

这是v1面向主机的API。Pico5尚未实现，但实现必须暴露此形状，而不是在包
24.

中发明不同的外观。
```ts
type ModelRef = {
  readonly provider: string;
  readonly modelId: string;
};

type UserInput = UserMessage["content"];

type SubmissionDraft = {
  readonly requestId?: string;
} & (
  | {
      readonly type: "input";
      readonly content: UserInput;
      readonly whenBusy?: "steer" | "followUp" | "reject";
      readonly entry?: never;
    }
  | {
      readonly type: "write";
      readonly entry: EntryDraft;
      readonly content?: never;
      readonly whenBusy?: never;
    }
);

type InputSubmissionDraft = Extract<SubmissionDraft, { readonly type: "input" }>;

/** Runs inside the creating commit, after the creation hook and the `agent` change. */
type ConversationInit = (tx: Tx, conversationId: ConversationId) => void | Promise<void>;

type ConversationCreateOptions = {
  readonly ownership: ConversationOwnership;
  /** Applied in the creating commit after the creation hook's copy, before `init`. */
  readonly agent?: AgentChange;
  readonly init?: ConversationInit;
};

type AnyTask = {
  readonly definition: {
    readonly name: string;
    readonly version: number;
    readonly initial: unknown;
    readonly phases: Readonly<Record<string, unknown>>;
    readonly abort: unknown;
    readonly migrate?: unknown;
    readonly hooks?: object;
  };
};

type HarnessOptions<Tool extends ToolRegistration = ToolRegistration> = {
  readonly models: Models; // the pi-ai Models interface
  readonly registry: RegistryReader<Tool>; // section 7.1
  readonly settings?: HarnessSettings;
  /** Builds a conversation's environment. Never called on the Session line; may be async. */
  readonly env?: (
    target: { readonly conversationId: ConversationId; readonly cwd?: string; readonly read: DocumentReader },
    context: Context,
  ) => ExecutionEnv | undefined | Promise<ExecutionEnv | undefined>;
  /** Runs in every commit that creates or forks a conversation, after the built-in creation hook (below). */
  readonly conversationCreated?: (tx: Tx, conversation: ConversationRecord) => void | Promise<void>;
  readonly now?: () => number;
  readonly onReport?: (error: unknown) => void;
};

/** Curated pi-ai request options; absent fields use pi-ai defaults. */
type ConversationStreamOptions = {
  transport?: Transport;
  timeoutMs?: number;
  /** Provider/SDK retries inside one request attempt. */
  maxRetries?: number;
  maxRetryDelayMs?: number;
  headers?: Record<string, string>;
  metadata?: JsonObject;
  cacheRetention?: CacheRetention;
  deferred?: boolean | { window?: "15m" | "1h" | "24h" };
};

/** Durable generation attempt retries; the JSON shape of pi-ai `RetryPolicy`. */
type ConversationRetryPolicy = {
  enabled: boolean;
  maxRetries: number;
  baseDelayMs: number;
  maxAgentDelayMs?: number;
};

/** Automatic compaction thresholds (section 8.7); manual compaction ignores `enabled`. */
type CompactionPolicy = {
  /** Threshold and overflow compaction. */
  enabled: boolean;
  /** Room kept free for the answer: generation blocks to compact above `contextWindow - reserveTokens`. */
  reserveTokens: number;
  /** Approximate size of the recent context a summary keeps verbatim. */
  keepRecentTokens: number;
  /** Background compaction starts `backgroundTokens` below the blocking threshold; `0` disables it. */
  backgroundTokens: number;
};

type ToolExecutionMode = "parallel" | "sequential";

/** How many queued items of one mode a boundary selects (section 6). */
type QueueMode = "all" | "one-at-a-time";

/** Read at every resolution and never copied; getters are fine. Synchronous: some readers run on the Session line. */
type HarnessSettings = {
  /** Default extension selection; absent: every installed extension, in install order. */
  readonly extensions?: readonly Extension[];
  readonly stream?: ConversationStreamOptions;
  readonly retry?: Partial<ConversationRetryPolicy>;
  readonly compaction?: Partial<CompactionPolicy>;
  readonly toolExecution?: ToolExecutionMode;
  readonly steeringMode?: QueueMode;
  readonly followUpMode?: QueueMode;
};

/** Resolved: every field over its built-in default, object fields merged. */
type Settings = {
  readonly extensions?: readonly Extension[]; // default: every installed extension, in install order
  readonly stream: ConversationStreamOptions; // default {}
  readonly retry: ConversationRetryPolicy; // { enabled: true, maxRetries: 3, baseDelayMs: 2000, maxAgentDelayMs: 60000 }
  readonly compaction: CompactionPolicy; // { enabled: true, reserveTokens: 16384, keepRecentTokens: 20000, backgroundTokens: 32768 }
  readonly toolExecution: ToolExecutionMode; // "parallel"
  readonly steeringMode: QueueMode; // "one-at-a-time"
  readonly followUpMode: QueueMode; // "one-at-a-time"
};

/** Stored choices of one conversation; names, not objects. Unset fields follow the host. */
type AgentState = {
  model?: ModelRef;
  thinkingLevel?: ModelThinkingLevel;
  /** An array selects exactly these extensions, in order. An object edits the host default selection. */
  extensions?: string[] | { add?: string[]; remove?: string[] };
  /** Filters the selected extensions' tools. An array offers exactly these, in order. */
  tools?: string[] | { remove: string[] };
  /** Rendered after every extension section, as the section `instructions`. */
  instructions?: string;
  /** Directory within the environment's file system, passed to `HarnessOptions.env`. */
  cwd?: string;
};

/** Built-in rewindable agent document; see below. */
declare const AgentDoc: RewindableConversationDocToken<AgentState>;

/** Objects are handles for their names. */
type AgentChange = {
  readonly model?: ModelRef | null;
  readonly thinkingLevel?: ModelThinkingLevel | null;
  readonly extensions?:
    | readonly Extension[]
    | { readonly add?: readonly Extension[]; readonly remove?: readonly Extension[] }
    | null;
  readonly tools?: readonly ToolRegistration[] | { readonly remove: readonly ToolRegistration[] } | null;
  readonly instructions?: string | null;
  readonly cwd?: string | null;
};

/** One change in any commit. A given field replaces the stored one; `null` clears it; `undefined` changes nothing. */
function configure(tx: Tx, conversationId: ConversationId, change: AgentChange): Promise<void>;

/** A conversation's agent resolved against a registry snapshot and the settings (section 7.1). */
type Agent<Tool extends ToolRegistration = ToolRegistration> = {
  readonly model?: ModelRef;
  readonly thinkingLevel: ModelThinkingLevel;
  readonly extensions: readonly Extension<Tool>[];
  readonly tools: readonly Tool[];
  /** Extension sections, then `instructions` when set. */
  readonly sections: readonly PromptSection<Tool>[];
  readonly instructions?: string;
  readonly cwd?: string;
};

/** Entry whose `data` has type `D`; `never` means the kind carries no data. */
type TypedEntry<D extends JsonValue> = Omit<EntryRecord, "data"> &
  ([D] extends [never] ? { readonly data?: never } : { readonly data: D });

type TypedEntryDraft<D extends JsonValue> = Omit<EntryDraft, "kind" | "data"> &
  ([D] extends [never] ? { readonly data?: never } : { readonly data: D });

interface Entry<D extends JsonValue = never> {
  readonly kind: string;
  is(entry: EntryRecord | undefined): entry is TypedEntry<D>;
}

function defineEntry<D extends JsonValue = never>(kind: string): Entry<D>;

type ContextView = {
  readonly head: EntryRecord | undefined;
  readonly entries: readonly EntryRecord[];
  /** Per entry of `entries`, its model messages after edits and rule 9, before rules 7 and 8. */
  readonly contributions: readonly (readonly Message[])[];
  readonly messages: readonly Message[];
};

type SettledSubmissionRecord = SubmissionRecord & {
  readonly status: "done" | "unanswered";
};

interface Submission {
  readonly id: SubmissionId;
  status(context: Context): Promise<SubmissionRecord>;
  wait(context: Context): Promise<SettledSubmissionRecord>;
  abort(context: Context): Promise<"aborted" | "already_placed" | "settled">;
}

type SettledTask<R> = TaskRecord<JsonValue, JsonValue, R> & {
  readonly state: Extract<TaskState<JsonValue, R>, { status: "terminal" }>;
};

type TaskInspection = {
  readonly record: TaskRecord<JsonValue, JsonValue, JsonValue>;
  readonly state:
    | { readonly kind: "running" }
    | { readonly kind: "ready"; readonly migrates: boolean }
    | { readonly kind: "waiting"; readonly on: readonly TaskId[] }
    /** Outcome held until its ordinary owned work drains (section 5.5). */
    | { readonly kind: "completing" }
    | {
        readonly kind: "blocked";
        readonly reason: "missing_task" | "task_too_old" | "migration_failed";
        readonly error?: unknown;
      };
};

type HarnessInspection = {
  readonly scheduling: "paused" | "running" | "closing";
  readonly tasks: readonly TaskInspection[];
  /** Queued and placed submissions in ID order. */
  readonly submissions: readonly SubmissionRecord[];
};

type ConversationWatch = WatchHandle<ConversationView>;

type HooksOf<K> = K extends Task<infer _I, infer _S, infer _R, infer H>
  ? H
  : never;

interface Conversation {
  readonly id: ConversationId;
  submit(submission: SubmissionDraft, context: Context): Promise<Submission>;
  /** Resolved with the current registry snapshot and settings. */
  agent(context: Context): Promise<Agent>;
  /** `configure()` in its own commit. */
  configure(change: AgentChange, context: Context): Promise<void>;

  commit<T>(
    change: (tx: Tx) => T | Promise<T>,
    context: Context,
  ): Promise<T>;
  context(context: Context): Promise<ContextView>;
  entries(
    query: Omit<EntryQuery, "conversationId">,
    limit: number,
    cursor: Cursor | undefined,
    context: Context,
  ): Promise<Page<EntryRecord, Cursor>>;
  fork(
    at: EntryId,
    options: ConversationCreateOptions,
    context: Context,
  ): Promise<Conversation>;
  compact(instructions: string | undefined, context: Context): Promise<TaskId<CompactionResult>>;
  reset(handoff: string | undefined, context: Context): Promise<void>;
  /** `{ background: true }` also aborts background work under the conversation (section 5.4). */
  abort(context: Context, options?: { readonly background?: boolean }): Promise<void>;
  waitForIdle(context: Context): Promise<void>;
  viewState(context: Context): Promise<AttachedReplicatedState<ConversationView>>;
  watch(context: Context): Promise<ConversationWatch>;
}

interface Harness extends Session {
  resume(): void;

  root(
    context: Context,
    options?: { readonly agent?: AgentChange; readonly init?: ConversationInit },
  ): Promise<Conversation>;
  conversation(id: ConversationId, context: Context): Promise<Conversation | undefined>;
  createConversation(options: ConversationCreateOptions, context: Context): Promise<Conversation>;

  getTask<R>(id: TaskId<R>, context: Context): Promise<TaskRecord<JsonValue, JsonValue, R> | undefined>;
  inspect(context: Context): Promise<HarnessInspection>;
  submission(id: SubmissionId, context: Context): Promise<Submission | undefined>;
  abortSubmission(
    id: SubmissionId,
    context: Context,
    conversationId?: ConversationId,
  ): Promise<"aborted" | "already_placed" | "settled" | "not_found">;
  abortTask(id: TaskId, context: Context): Promise<"marked" | "terminal">;
  waitForTask<R>(id: TaskId<R>, context: Context): Promise<SettledTask<R>>;
  waitForIdle(context: Context): Promise<void>;
  /** Session total of every conversation's `pi.usage` (section 8.6). */
  usage(context: Context): Promise<UsageState>;
  /** Live tasks as a structural view (section 9.5). */
  taskGraph(context: Context): Promise<AttachedReplicatedState<TaskGraph>>;
  watchTaskGraph(context: Context): Promise<TaskGraphWatch>;
}

declare const Harness: {
  open<Tool extends ToolRegistration>(
    storage: Storage,
    options: HarnessOptions<Tool>,
    context: Context,
  ): Promise<Harness>;
};
```

此设计有意保留了有用的Pico3主机形状。它去除了Pico3的固定`rewindable()`/`sticky()`访问器、命名空间路由器、语义视图事件和手动Chord视图桥接。类型化的Pico5文档和结构化对话监视器替换了这些表面。`submit()`持久化地接受用户输入或被动条目写入，并返回一个`Submission`，该条目跟踪其结算。

`Harness.open()`将会话绑定到一个应用程序拥有的注册表（第7.1节）。`createRegistry()`始终持有内置任务定义（第8节），并拒绝注册表快照中缺少任何定义的注册表。Open将存活的`running`任务更改为`pending`，保持`waiting`任务等待，并重新评估`failFast`对于`completing`和`waiting`任务（第5.5节）。它永远不会因任务定义缺失或不可迁移而迁移或终止任务。此类任务保持`pending`或`waiting`状态，并处于**阻塞**状态：调度程序跳过它，并在注册表更改时重新考虑它（第5.4节）。任何被恢复操作触及的内置文档通过其普通类型化访问路径迁移。Open不会扫描或迁移其他文档。Open期间没有处理器分发。应用程序应在Open之前安装其扩展，以便恢复工作可以立即继续；Open之后的安装也会解除阻塞。

根对话始终具有保留ID `ROOT_CONVERSATION_ID`（`1`）。`root(context, { agent, init })`在根不存在时懒惰地创建它：当会话线上有一个提交时，创建无所有者根，运行创建钩子（下方），应用`agent`与`configure()`，并运行`init(tx, rootId)`。如果根已存在，忽略`agent`和`init`，不发生写入。重新打开通过其保留ID找到相同的根。没有模型的代理对话会产生持久的`no_model`生成失败。

`resume()`在运行时是幂等的，仅启用调度。它不重复Open时的协调，并在关闭后抛出异常。必须在任何任务运行之前发生的工作，例如安装扩展或播种，会在`resume()`之前完成。请求进度的调用也会启用调度，因此它们永远不会等待暂停的框架：`Conversation.submit()`，`Conversation.compact()`，
`Conversation.abort()`、`Submission.wait()`、`Harness.waitForTask()`、`Harness.waitForIdle()`和`Conversation.waitForIdle()`。恢复的工作从它们开始。只读取的查看器永远不会启用调度：`inspect()`、`getTask()`、`submission()`、`Submission.status()`、`usage()`，文档读取、每次会话读取、状态和观看，以及任务图。

`createConversation({ ownership, agent, init })`和`fork(at, { ownership, agent, init })`原子提交：会话、其显式选择的所有权、创建钩子的文档、`agent`变更，以及`init`的每次写入。第一次输入是一个普通的`submit()`。请求ID使对相同会话的重试`submit()`恰好一次；必须在两次调用之间崩溃的主机首先通过`init`写入的关键字再次找到其会话。主机调用者必须选择无主或任务所有权；无论是Harness还是会话句柄都不能从调用上下文中推断所有权。
raw `tx.createConversation()` 和 `tx.forkConversation()`，例如在工具提交中。它在 `tx.createConversation()` 和 `tx.forkConversation()` 内部运行，在它们返回之前，因此同一回调中稍后的 `configure()` 会覆盖其副本。它创建空的 `pi.live`、`pi.inbox` 和 `pi.usage`，创建具有全新 provider 面向 UUIDv7 的 `pi.provider`，并处理 `pi.agent`：

- A fork 会保留其父 `pi.agent` 的 `asOf` 副本（第 3.7 节），无论其所有权如何。
- A 新的任务拥有对话会获得存储 `pi.agent` 的副本
拥有者任务的对话，每个字段，包括`instructions`。对拥有者的后续更改不会影响子级。拥有者未设置的字段保持未设置，并跟随宿主。

-  新的无拥有者对话会获得一个空的`pi.agent`，`{}`。

`HarnessOptions.conversationCreated`，如果提供，则与新记录在同一提交中运行，对于每个创建路径，这样宿主可以在每个对话中创建其应用程序所需的文档；记录的`parent`
and `owner` 用于区分分支和任务拥有的对话。表读取抛出 `ReadAfterWrite` 错误，如 `init` 所示，抛出错误会导致创建提交失败。随后的便利功能会应用其 `agent` 变更并运行 `init`。扩展没有创建钩子，因此其钩子和部分会将缺失的文档视为默认文档。由普通会话创建的对话没有内置文档。

```ts
// In a tool's commit. The child starts as a copy of this conversation's agent: model, extensions, tools, cwd.
const child = await tx.createConversation({ ownership: { kind: "task", taskId: api.taskId } });
// A cheaper model, only the read tool, and its own worktree; everything else stays as copied.
await configure(tx, child.id, { model: haiku, tools: [readTool], cwd: worktree });
```

`init` 在对话创建后运行，这是一个表写操作，因此表读取会抛出 `ReadAfterWrite`（第4节）。文档访问保持不变。
内置代理文档最终版本为 1：

| 字段          | 值                          |
|---------------|-----------------------------|
| kind          | `pi.agent`            |
| version       | `1`（无需迁移）|
| scope/history/fork | conversation, `rewindable`, `asOf` |
| schema        | `AgentState`            |
| `initial()` | `{}`          |
| checkpoint    | 每次变更后完整保存           |
| view mount    | `docs["pi.agent"]`            |

它仅存储用户为对话选择的内容：扩展名和工具名，从不存储代码，也不存储除 `instructions` 以外的任何提示文本。代码来自
根据名称从注册表中解析代理时（第7.1节）。

`configure(tx, id, change)`在任何提交中编辑它，包括创建或分叉对话的提交；`Conversation.configure()`在自己的提交中进行此操作。`Conversation.agent()`使用当前注册表快照和设置解析它，将缺失的文档读取为`{}`；它从不写入。

`configure()`替换整个字段：给定字段替换存储的字段，`null`清空它，`undefined`保留它。扩展和工具对象代表它们的名称，因此，如果重新安装了已安装的扩展对象，它仍然会选择它。

```ts
await root.configure({ tools: { remove: [editTool] } }, context);
await root.configure({ tools: { remove: [bashTool] } }, context); // edit is offered again
await root.configure({ tools: null }, context); // every tool of the selected extensions again
```

因此，UI切换项读取当前值并写入新值。`extensions`对象`{ add, remove }`始终编辑主机默认选择（第7.1节），而不是复制的选择，无论它是数组还是`{ add, remove }`对象；要编辑复制的选择，写入由解析的代理`extensions`计算的数组。

没有检查存储的扩展或工具名称是否已安装。文档
记录选择；注册表记录了该进程当前可以执行的内容。因此，存储的名称可能会被卸载，例如在扩展程序重新加载时、重启后安装前，或由缺乏扩展程序的进程打开的分叉中。解析会跳过它，文档不会因为注册表的移动而被重写，名称在重新安装后再次生效。

更改不会启动生成，也不会追加系统条目。请求准备阶段会将期望的提示和工具与转录历史进行比较，并追加所需的位置系统基线或增量（第7.4节）。

内置提供程序文档在版本1时最终确定：

| 字段          | 值                                                         |
|---------------|------------------------------------------------------------|
| kind          | `pi.provider`                                           |
| version       | `1`（无迁移）                                  |
| scope/history/fork | conversation、`latest`、`initial`         |
| schema        | `{ sessionId: string }`                                           |
| `initial()` | `{ sessionId: uuidv7() }`                                         |
| checkpoint    | 每次变更后都基于完整基线                                     |
| view mount    | `docs["pi.provider"]`                                           |

UUID是面向提供程序的会话身份，不是数字持久UUID `ConversationId`，也不是包含应用程序的会话ID。每个新创建、任务拥有、原始创建或分叉的会话都会在其创建提交中获得自己的UUID；分叉永远不会复制其父UUID。生成请求和压缩汇总会将其作为`options.sessionId`传递给pi-ai。重置、压缩、模型更改和重新打开都不会改变它。对于没有文档的遗留会话，系统会在其首次生成或压缩提供程序请求之前，在会话行上创建并持久化该UUID。因此，并发调用者会观察到一个胜出者。提供程序行为仍然适用：例如，Codex会在`cacheRetention`为`"none"`时抑制缓存/会话身份。

缺失的工具实现永远不会导致请求失败。请求准备阶段只会提供已解析的工具。如果回放的工具状态仍然提供一个已不再解析的工具，追加的系统增量会在`toolsRemoved`中列出该工具；当它再次解析时，后续增量会添加其当前声明。当模型调用其请求中未提供的工具，或其工具任务运行时该工具实现无法解析（第7.3节），会返回一个带有错误诊断代码`tool_unavailable`（第7.3节）的错误工具结果，表示该工具不可用，运行继续以便模型可以响应（第8.3节）。

`HarnessOptions.settings`包含运行时策略：默认扩展选择、请求选项、重试、压缩阈值、工具执行和队列模式。没有任何内容会被复制或存储。每个读取者都会将其解析为`Settings`，每个缺失字段覆盖其内置默认值和对象字段，按键合并，然后使用该值进行决策（第7.1节列出了读取者）。因此，带有getter的方法的设置对象会遵循用户的偏好，无需会话写入。设置是同步的，因为队列模式在会话行读取。`stream`会转发给生成请求；`stream.maxRetries`是单个请求内的提供程序重试，而`retry`管理持久生成尝试（第8.3节）。设置更改不会提交，也不会发出事件。

```ts
// The user's settings, read live through getters.
class UserSettings implements HarnessSettings {
  readonly manager: SettingsManager;
  constructor(manager: SettingsManager) {
    this.manager = manager;
  }
  get stream() {
    return { timeoutMs: this.manager.get("timeoutMs") };
  }
  get compaction() {
    return { enabled: this.manager.get("autoCompact") };
  }
}
manager.set("autoCompact", false); // no Session write; every conversation follows at its next threshold check
```
  
`HarnessOptions.env`根据会话ID、代理的`cwd`和已提交文档的`DocumentReader`构建会话的执行环境。运行时绝不会在会话行调用它，而是在每次使用时调用：

- 工具任务会为每次执行调用它，并将结果作为`api.env`（第7.3节）传递。恢复后的重试会获得该时间点的会话环境，包括其当前`cwd`。抛出异常会变成该调用的普通错误结果。

- 生成`prepare`会为节渲染器（`input.env`，第7.4节）调用它一次。抛出异常会被报告，节会以`env: undefined`渲染。

- `runtime.env(context)`会为自定义任务调用它，并拒绝其错误。

如果没有`env`选项，或当它返回`undefined`时，不会存在环境。主机会缓存昂贵的内容，例如每个目录一个环境。扩展程序读取构建的环境，如`env.cwd`，而不是描述符。需要超过目录级会话的应用程序会将其保存在自己的文档中，并通过`target.read`读取：

```ts
// Absent: the conversation runs locally. Only conversations with this document run in a container.
// Subagents do not copy it: their creator writes it too when they should run in the container.
const ContainerDoc = defineDoc<{ image: string }>({
  kind: "app.container", version: 1, scope: "conversation", history: "latest", fork: "current",
  initial: () => ({ image: "node:22" }),
});
const harness = await Harness.open(storage, {
  models,
  registry,
  env: async ({ conversationId, cwd, read }, context) => {
    const container = await read.snapshot(ContainerDoc, conversationId, context);
    return container !== undefined
      ? containers.env(container.image, cwd ?? "/work", context)
      : localEnv(cwd ?? process.cwd()); // cached NodeExecutionEnv per directory
  },
}, context);
```

代理和设置的变化在它们的解析器解析它们时生效（第7.1节）。生成准备会在每次请求时解析一次代理，并固定该轮次的提示、提供的工具、模型和请求选项。在轮次运行期间所做的更改会在下一次准备时生效。模型已经调用过的工具在它的工具任务运行时会被解析；当它的名称不再属于代理的工具列表，因为过滤器、选择器或注册表发生了变化，调用会产生`tool_unavailable`（第7.3节）。重试策略在生成对尝试结果进行分类时被读取，因为它决定了下一次尝试（第8.3节）。

`Conversation.commit()`是一个与该对话绑定的会话提交。`tx.createTask()`默认将`TaskOptions.conversationId`绑定到该对话。`Conversation.entries()`将查询绑定到该对话并分页其分支感知的存储历史；调用者不能替换另一个对话ID。通用的会话级文档操作仍然可以直接在`Harness`上进行，因为`Harness extends Session`。

`fork()`需要一个具体的可见父条目和明确的所有权，然后应用第3.7节。`compact()`允许在一个提交中进行手动压缩任务并返回其ID，
不是它的未来摘要条目。该任务是对话拥有的，而不是背景，因此 `Conversation.abort()` 取消了它，并且空闲等待包括它。它不接管运行控制，因此它不会使对话繁忙：对话在它摘要时继续工作，而它的摘要通过写入
提交，空闲时立即执行，否则在下一个边界（第8.7节）执行。`reset()` 持久地允许写入提交`pi.reset`条目（第8.1节）与`head: "self"`，携带交接文本作为用户消息（如有提供），然后解析；忙时，放置顺序跟随
第6节，可能会在后面出现。通过观察其在对话中的位置。空闲等待并不能保证排队的被动写入被放置。

`abortTask()`提交`abortRequested`，然后发出信号并加入活动运行；
然后调度程序开始中止调用，并标记拥有前景的
子树在下一个版本控制提交中（第5.4节）。`Conversation.abort()`撤消排队的输入提交，标记由普通所有权选择的非后台任务
遍历，发出信号，并且仅在该作用域处于普通空闲状态后才解决。
被动写入和后台子树得以保留。会话空闲表示从该会话中没有选择到活跃的非后台任务。Harness空闲对每个无所有者根会话采用相同的遍历方式。等待、截止时间阻塞以及`completing`的工作仍然处于活跃状态，因此不算空闲。取消空闲等待只会中止该等待者。

会话句柄是无状态的；通过`id`进行比较。主机通过查找和扫描发现会话。没有创建监听器；任务图视图（第9.5节，`inspect()`）和空闲等待报告了活跃的工作。

`submit()`在持久化准入后返回，而非结算。输入提交会创建一个用户消息，其携带Harness时钟的提交时间戳，该时间戳在放置时即为准入时间；`whenBusy`默认为`followUp`。写入提交使用第6节中的有序被动路径，且永远不会开始生成。`Submission.wait()`仅在其答案或终端失败后才结算输入；写入提交在条目被放置或写入变得无法放置时结算。取消`wait()`只会取消该等待。它不会撤回提交；`Submission.abort()`是显式的排队撤回操作。`Harness.submission()`在重新打开后重新获取提交；结算后记录仍可查询。

`abortTask()`持久化请求取消，并在标记被提交且任何活跃运行调用已加入，或在已结算的无活跃普通所有工作阻塞任务被处理为`orphaned`（第5.4节）后返回`marked`。中止调用开始于任务的普通所有工作不再活跃时；`completing`任务仅被标记，其最终记录保持其持有的结果（第5.5节，`abortRequested: true`）。它不会等待终端结算。`waitForTask()`观察终端接收。中止已处于终端状态的任务返回`terminal`；未知ID被拒绝。显式任务中止包括后台任务。取消任务或空闲等待不会中止工作。
`inspect()`返回会话线上的实时工作，用于恢复决策、查看和诊断。它不写入任何内容，不启用调度，也不运行任何任务代码。每个实时任务在其当前注册表下携带其状态：`running`表示活动调用；`completing`表示待定结果；`waiting`表示其仍在等待的实时任务，即其`on`的实时部分，或，当被中止标记时，其实时普通拥有的工作（第5.5节）；`ready`表示在下一次调度通过时会保留它，`migrates`表示其定义更新且具有`migrate`；或`blocked`（第5.4节）。迁移仅在调度程序尝试后或新定义没有`migrate`时才显示为失败；检查永远不会运行以查明原因。阻塞原因由派生得出，不会存储。排队和放置的提交完成视图。已完成的任务、已结算的提交、转录和文档使用其各自的API。

`Conversation.viewState()`返回其当前结构挂载作为一次性只读Chord状态。`Conversation.watch()`原子地捕获该不可变修订版本并注册以供稍后精确的完整提交帧使用。其`WatchHandle`使用与第9.2节中`watchDoc()`相同的序列化异步、有界缓冲合同。两者都不携带语义事件，也不拥有第二个持久化权限。

`close()`密封突变准入和任务预留，发出调用信号，并结束每个文档状态、视图状态和监视，在该密封处：一个在关闭期间发布时不会向它们提供任何内容的提交，其状态保持其最后值。在会话线外，它允许已准入的存储提交结算，加入任务、工具和钩子调用，包括忽略其信号的代码，然后关闭存储。一旦`close()`解决，此承载工具的任何调用代码都不会运行且没有处理程序持有存储，因此新的承载工具可以打开相同的存储。已运行的监视回调仍为调用者所有且可以独立完成。关闭不写入任务结果。取消`close()`调用仅取消该等待；关闭继续进行，且每个后续`close()`都等待相同的关闭。

处理程序属于已打开的承载工具且必须在重新打开后重新获取。一旦关闭开始，每个新的承载工具、对话和提交操作都将被拒绝，`resume()`抛出异常。对于在密封时已排队在会话线上的操作，提交将结算（第4节）且读取将完成。等待、状态和监视将被拒绝，除两个无需后续提交的情况外：`Submission.wait()`的已结算提交解析，以及对缺失文档的获取解析`undefined`。其中的`inspect()`报告`scheduling: "closing"`。

## 3. 文档

### 3.1 定义

范围直接决定了文档所有权和生命周期。只有对话文档声明历史和分叉行为。

```ts
type LatestConversationSemantics = {
  readonly scope: "conversation";
  readonly history: "latest";
  readonly fork: "current" | "initial";
};

type RewindableConversationSemantics = {
  readonly scope: "conversation";
  readonly history: "rewindable";
  readonly fork: "asOf" | "current" | "initial";
};

type DocumentSemantics =
  | { readonly scope: "session" }
  | LatestConversationSemantics
  | RewindableConversationSemantics
  | { readonly scope: "task" };

type CheckpointInfo = {
  /** Deltas already stored after the newest base, excluding this change. */
  readonly deltasSinceBase: number;
};

type CommonDocDefinition<T extends JsonObject> = {
  readonly kind: string;
  readonly version: number;
  initial(): T;
  migrate?(value: JsonObject, fromVersion: number): T;
  checkpointWhen?(value: Readonly<T>, ops: readonly Op[], info: CheckpointInfo): boolean;
};

type DocDefinition<T extends JsonObject> =
  CommonDocDefinition<T> & DocumentSemantics;

type DocFamilyDefinition<T extends JsonObject, I extends JsonValue> =
  Omit<CommonDocDefinition<T>, "initial"> & DocumentSemantics & {
    readonly family: true;
    initial(seed: I): T;
  };

declare const docType: unique symbol;
interface DocToken<T extends JsonObject, D extends DocDefinition<T>> {
  readonly definition: D;
  readonly [docType]?: T;
}
interface DocFamilyToken<
  T extends JsonObject,
  I extends JsonValue,
  D extends DocFamilyDefinition<T, I>,
> {
  readonly definition: D;
  readonly [docType]?: T;
}

type SessionDocToken<T extends JsonObject> = DocToken<
  T,
  CommonDocDefinition<T> & { readonly scope: "session" }
>;
type ConversationDocToken<T extends JsonObject> = DocToken<
  T,
  CommonDocDefinition<T> & (LatestConversationSemantics | RewindableConversationSemantics)
>;
type RewindableConversationDocToken<T extends JsonObject> = DocToken<
  T,
  CommonDocDefinition<T> & RewindableConversationSemantics
>;
type TaskDocToken<T extends JsonObject> = DocToken<
  T,
  CommonDocDefinition<T> & { readonly scope: "task" }
>;

type SessionDocFamilyToken<T extends JsonObject, I extends JsonValue> = DocFamilyToken<
  T,
  I,
  DocFamilyDefinition<T, I> & { readonly scope: "session" }
>;
type ConversationDocFamilyToken<T extends JsonObject, I extends JsonValue> = DocFamilyToken<
  T,
  I,
  DocFamilyDefinition<T, I> & (LatestConversationSemantics | RewindableConversationSemantics)
>;
type RewindableConversationDocFamilyToken<T extends JsonObject, I extends JsonValue> = DocFamilyToken<
  T,
  I,
  DocFamilyDefinition<T, I> & RewindableConversationSemantics
>;
type TaskDocFamilyToken<T extends JsonObject, I extends JsonValue> = DocFamilyToken<
  T,
  I,
  DocFamilyDefinition<T, I> & { readonly scope: "task" }
>;

function defineDoc<T extends JsonObject>(
  definition: CommonDocDefinition<T> & { readonly scope: "session" },
): SessionDocToken<T>;
function defineDoc<T extends JsonObject>(
  definition: CommonDocDefinition<T> & LatestConversationSemantics,
): ConversationDocToken<T>;
function defineDoc<T extends JsonObject>(
  definition: CommonDocDefinition<T> & RewindableConversationSemantics,
): RewindableConversationDocToken<T>;
function defineDoc<T extends JsonObject>(
  definition: CommonDocDefinition<T> & { readonly scope: "task" },
): TaskDocToken<T>;

function defineDocFamily<T extends JsonObject, I extends JsonValue>(
  definition: Omit<CommonDocDefinition<T>, "initial"> & {
    readonly family: true;
    readonly scope: "session";
    initial(seed: I): T;
  },
): SessionDocFamilyToken<T, I>;
function defineDocFamily<T extends JsonObject, I extends JsonValue>(
  definition: Omit<CommonDocDefinition<T>, "initial"> & LatestConversationSemantics & {
    readonly family: true;
    initial(seed: I): T;
  },
): ConversationDocFamilyToken<T, I>;
function defineDocFamily<T extends JsonObject, I extends JsonValue>(
  definition: Omit<CommonDocDefinition<T>, "initial"> & RewindableConversationSemantics & {
    readonly family: true;
    initial(seed: I): T;
  },
): RewindableConversationDocFamilyToken<T, I>;
function defineDocFamily<T extends JsonObject, I extends JsonValue>(
  definition: Omit<CommonDocDefinition<T>, "initial"> & {
    readonly family: true;
    readonly scope: "task";
    initial(seed: I): T;
  },
): TaskDocFamilyToken<T, I>;
```

验证规则：

- 版本为正整数。
- 类型访问在令牌范围或对话历史/分叉策略与已持久化实例不一致时拒绝。迁移不能重新解释这些生命周期语义。
- 会话文档为当前仅文档且属于会话。关闭和重新打开会话不会使其退役。
- 对话文档声明`history`和`fork`；`fork: "asOf"`要求`history: "rewindable"`。
- 任务文档为当前仅文档，永远不会被对话分叉复制，并在其任务变为终端时原子退役。
- `initial()`和`migrate()`返回JSON对象。

`checkpointWhen()`仅选择完整的存储基础以限制回放。它不改变范围、生命周期、历史或分叉语义。

当内置定义实现时，声明具体的内置文档分组和语义。通用文档机制不针对模型、工具、收件箱或演示状态做特殊处理。

### 3.2 记录和生命周期

每个已持久的文档实例有一个`DocumentRecord`：

```ts
type DocumentRecord = {
  readonly id: DocumentId;      // unique incarnation
  readonly kind: string;        // stable definition kind
  readonly key?: string;        // families only
  readonly createdAt: Seq;      // stamped by the committing storage
  readonly retiredAt?: Seq;
} & (
  | { readonly scope: { readonly kind: "session" } }
  | ({ readonly scope: { readonly kind: "conversation"; readonly conversationId: ConversationId } } & (
      | { readonly history: "latest"; readonly fork: "current" | "initial" }
      | {
          readonly history: "rewindable";
          readonly fork: "asOf" | "current" | "initial";
        }
    ))
  | { readonly scope: { readonly kind: "task"; readonly taskId: TaskId } }
);

type DocumentCreate = DocumentRecord extends infer Record
  ? Record extends DocumentRecord
    ? Omit<Record, "createdAt" | "retiredAt">
    : never
  : never;
```

`id`永不重复使用。退役并重新创建相同的逻辑种类、范围和家族密钥会创建新的实例。成员资格是半开区间`createdAt <= at < retiredAt`；未退役的实例没有上界。A
在同一个提交中，创建的退休对象具有空生命周期。

一个单例通过种类和作用域逻辑上进行标识。一个家族通过
逻辑上按种类、范围和`key`进行分类。该记录保留了范围和对话内容。
history/fork语义不可用，扩展代码不会使现有数据
消失。定义版本属于存储的基础和增量，因为一个实例可能包含由多个定义版本书写的记录。
`DocumentCreate` 不是另一个持久化记录；它是没有存储分配生命周期字段的相同作用域联合。
### 3.3 访问与创建

不存在可变的 `session.document()` API。

```ts
interface Session extends DocumentObserver {
  commit<T>(change: (tx: Tx) => T | Promise<T>, context: Context): Promise<T>;
  close(context: Context): Promise<void>;
  subscribeCommits(listener: (publication: CommitPublication, context: Context) => void): () => void;
  subscribeClose(listener: () => void): () => void;

  snapshot<T extends JsonObject>(token: SessionDocToken<T>, context: Context): Promise<Readonly<T> | undefined>;
  snapshot<T extends JsonObject>(token: ConversationDocToken<T>, conversationId: ConversationId, context: Context): Promise<Readonly<T> | undefined>;
  snapshot<T extends JsonObject>(token: TaskDocToken<T>, taskId: TaskId, context: Context): Promise<Readonly<T> | undefined>;
  snapshot<T extends JsonObject, I extends JsonValue>(token: SessionDocFamilyToken<T, I>, key: string, context: Context): Promise<Readonly<T> | undefined>;
  snapshot<T extends JsonObject, I extends JsonValue>(token: ConversationDocFamilyToken<T, I>, conversationId: ConversationId, key: string, context: Context): Promise<Readonly<T> | undefined>;
  snapshot<T extends JsonObject, I extends JsonValue>(token: TaskDocFamilyToken<T, I>, taskId: TaskId, key: string, context: Context): Promise<Readonly<T> | undefined>;

  snapshotAsOf<T extends JsonObject>(token: RewindableConversationDocToken<T>, conversationId: ConversationId, at: EntryId, context: Context): Promise<Readonly<T> | undefined>;
  snapshotAsOf<T extends JsonObject, I extends JsonValue>(token: RewindableConversationDocFamilyToken<T, I>, conversationId: ConversationId, key: string, at: EntryId, context: Context): Promise<Readonly<T> | undefined>;

  documentState<T extends JsonObject>(token: SessionDocToken<T>, context: Context): Promise<DocumentState<T> | undefined>;
  documentState<T extends JsonObject>(token: ConversationDocToken<T>, conversationId: ConversationId, context: Context): Promise<DocumentState<T> | undefined>;
  documentState<T extends JsonObject>(token: TaskDocToken<T>, taskId: TaskId, context: Context): Promise<DocumentState<T> | undefined>;
  documentState<T extends JsonObject, I extends JsonValue>(token: SessionDocFamilyToken<T, I>, key: string, context: Context): Promise<DocumentState<T> | undefined>;
  documentState<T extends JsonObject, I extends JsonValue>(token: ConversationDocFamilyToken<T, I>, conversationId: ConversationId, key: string, context: Context): Promise<DocumentState<T> | undefined>;
  documentState<T extends JsonObject, I extends JsonValue>(token: TaskDocFamilyToken<T, I>, taskId: TaskId, key: string, context: Context): Promise<DocumentState<T> | undefined>;
}

interface Tx {
  conversation(id: ConversationId): Promise<ConversationRecord | undefined>;
  entry(id: EntryId): Promise<EntryRecord | undefined>;
  /** Undefined when the entry is absent or has another kind. */
  entry<D extends JsonValue>(token: Entry<D>, id: EntryId): Promise<TypedEntry<D> | undefined>;
  task(id: TaskId): Promise<TaskRecord<JsonValue, JsonValue, JsonValue> | undefined>;
  scanConversations(query: ConversationQuery, limit: number, cursor?: Cursor): Promise<Page<ConversationRecord, Cursor>>;
  scanEntries(query: EntryQuery, limit: number, cursor?: Cursor): Promise<Page<EntryRecord, Cursor>>;
  scanTasks(query: TaskQuery, limit: number, cursor?: Cursor): Promise<Page<TaskRecord<JsonValue, JsonValue, JsonValue>, Cursor>>;
  submissionByRequest(conversationId: ConversationId, requestId: string): Promise<SubmissionRecord | undefined>;

  createConversation(options: { readonly ownership: ConversationOwnership }): Promise<ConversationRecord>;
  forkConversation(
    parentConversationId: ConversationId,
    at: EntryId,
    options: { readonly ownership: ConversationOwnership },
  ): Promise<ConversationRecord>;
  appendEntry(conversationId: ConversationId, value: EntryDraft): Promise<EntryRecord>;
  /** The token supplies `kind` and types `data`. */
  appendEntry<D extends JsonValue>(
    token: Entry<D>, conversationId: ConversationId, value: TypedEntryDraft<D>,
  ): Promise<TypedEntry<D>>;
  createTask<I, S extends { phase: string }, R, H extends object>(
    task: Task<I, S, R, H>, input: I, options: TaskOptions,
  ): Promise<TaskId<R>>;
  /** Raw submission record; no admission rules (busy check, inbox, placement). Hosts use `Conversation.submit()`. */
  createSubmission(create: SubmissionCreate): Promise<SubmissionRecord>;
  /** Settle a queued or placed submission; only a placed input can be answered. A settled one stays unchanged. */
  settleSubmission(id: SubmissionId, settlement: SubmissionSettlement): void;
  /** Newest visible entry of the conversation that carries a `head`. */
  latestHeadMarker(conversationId: ConversationId): Promise<(EntryRecord & { readonly head: EntryId }) | undefined>;
  /** Record a queued submission's placement at `entry`: an input becomes `placed`, a write `done` (section 6). The caller appends the entry and edits `pi.inbox` and `pi.live`. */
  placeSubmission(id: SubmissionId, entry: EntryId): void;

  doc<T extends JsonObject>(token: SessionDocToken<T>): Promise<Draft<T>>;
  doc<T extends JsonObject>(token: ConversationDocToken<T>, conversationId: ConversationId): Promise<Draft<T>>;
  doc<T extends JsonObject>(token: TaskDocToken<T>, taskId: TaskId): Promise<Draft<T>>;
  doc<T extends JsonObject, I extends JsonValue>(token: SessionDocFamilyToken<T, I>, key: string, seed: I): Promise<Draft<T>>;
  doc<T extends JsonObject, I extends JsonValue>(token: ConversationDocFamilyToken<T, I>, conversationId: ConversationId, key: string, seed: I): Promise<Draft<T>>;
  doc<T extends JsonObject, I extends JsonValue>(token: TaskDocFamilyToken<T, I>, taskId: TaskId, key: string, seed: I): Promise<Draft<T>>;

  retireDoc<T extends JsonObject>(token: SessionDocToken<T>): Promise<void>;
  retireDoc<T extends JsonObject>(token: ConversationDocToken<T>, conversationId: ConversationId): Promise<void>;
  retireDoc<T extends JsonObject>(token: TaskDocToken<T>, taskId: TaskId): Promise<void>;
  retireDoc<T extends JsonObject, I extends JsonValue>(token: SessionDocFamilyToken<T, I>, key: string): Promise<void>;
  retireDoc<T extends JsonObject, I extends JsonValue>(token: ConversationDocFamilyToken<T, I>, conversationId: ConversationId, key: string): Promise<void>;
  retireDoc<T extends JsonObject, I extends JsonValue>(token: TaskDocFamilyToken<T, I>, taskId: TaskId, key: string): Promise<void>;
}
```

ID 创建的事务方法是异步的，因为远程存储可能会持久地分配全局唯一的数字 ID。会话创建始终需要显式的所有权；没有事务包装器会注入执行任务。对于任务所有权，调用者仅提供一个类型化的任务 ID。会话从任务的最终候选记录中推导出持久化的所有者会话。所有者任务可能在同一个事务中更早地提交或暂存。在
存储准入，会话拒绝缺失、`completing`终端，或被中止标记的新任务或会话的所有者，判断依据为其在该事务中的最终候选记录。因此，任务不能在其提交完成时创建拥有工作。显式`conversationId`与其所有者会话不同的子任务，以及带有`background: true`的子任务，均以相同方式被拒绝。现有所有者边在所有者完成后仍保持有效。会话创建返回一个惰性记录，永远不会返回操作句柄。`forkConversation()`还会验证一个可见条目并应用第3.7节。只有公共类型的`tx.doc()`支持获取或创建。内部分叉复制可能会直接从存储值创建新实例，而无需定义。`tx.doc()`接收定义令牌，该令牌为其静态类型、初始化器、迁移和检查点策略提供支持。保留作用域的令牌重载要求调用者仅提供具体会话/任务ID，以及对于家族，其键和创建种子。普通定义不
注册文档和普通文档不会在 open 时被扫描。

- 现有实例根据 3.6 节的内容进行懒加载重建和迁移。通过 `tx.doc()` 进行的迁移会放在其包含的事务中进行预置。
- 缺失的单例会调用令牌的 `initial()`。缺失的家庭成员会调用 `initial(seed)`。创建操作会存储一个初始基础。
- 对一个逻辑地址的首次获取会在等待前被缓存。该事务中后续的获取会返回相同的草稿；对于缺失的家庭成员，首次调用的分离种子会胜出，后续种子会被忽略。
- `snapshot()`、`snapshotAsOf()`、`documentState()` 和 `watchDoc()` 从不创建或持久化迁移。当请求的化身不存在时，它们会返回 `undefined`，并且仅在内存中对重建的值进行迁移。
- 任务范围的 `tx.doc()` 会验证到事务的最新候选任务记录，回退到已提交状态。这种内部验证不是调用者表读取，也不会触发 `ReadAfterWrite`。其对话是基于任务记录推导的。
- `retireDoc()` 会解析逻辑地址而不会创建它。已获取草稿的退役会持久化其最终内容后再退役。同一事务中该地址的后续 `tx.doc()` 会创建一个带有新草稿和 ID 的新化身。
- 终端候选会拒绝后续的任务文档访问。终端结算会退役所有现有任务文档和同一事务中更早创建的任务文档。
- `snapshot()` 返回当前可共享的不可变修订版本。对它的任何变异或保留的后代都不支持；需要可变所有权的调用者必须先复制它。
- `documentState()` 返回一个绑定到已提交化身的可丢弃只读 Chord 状态。
- `tx.doc()` 返回一个可撤销的 Astra 覆盖 `Draft<T>`，用于该事务。
- 历史读取永远不会创建过去的文档。

`snapshotAsOf()` 仅对可回滚的对话文档可用。它
验证 `at` 是否可通过请求对话的祖先链可见，选择拥有该条目的祖先对话，然后查找其创建/退役时间区间包含该条目提交的逻辑唯一/家族实例。它从不以今天的实例开始，也不创建实例。当不存在此类实例时，返回 `undefined`。

在 `B` 分支 `A` 于 `E` 条目后，查询 `B` 在继承 `E` 中的状态时，读取 `A` 的历史实例；`B` 的复制实例创建时间更晚。如果实例被退役并重新创建，历史查询会选择目标提交时仍存活的实例。

### 3.4 变更所有权

Pico 直接使用 Chord Delta 的 Astra 不可变事务形状：

```ts
interface Prepared<T extends object> {
  readonly base: T;
  readonly value: T;
  readonly ops: readonly Op[];
  readonly baseRevision: number;
  abort(): void;
}
interface Change<T extends object> {
  readonly state: Draft<T>;
  prepare(): Prepared<T>;
  abort(): void;
}
interface Tracker<T extends object> {
  readonly value: T;
  readonly revision: number;
  beginChange(): Change<T>;
  prepareReplace(value: T): Prepared<T>;
  adopt(prepared: Prepared<T>): void;
}
```

每个加载的文档拥有一个跟踪器，其 `value` 是其当前的不可变修订版本。不可变性是一个受信任的所有权合约，而非运行时冻结：修订版本及其子版本在转移给跟踪器后必须永远不可变。`prepare()` 撤销草稿，发出独立自包含的操作，然后在存储准入前，使用优化的不可变应用器计算 `value`。未变更的子树与 `base` 结构共享。操作放置负载也可与 `value` 共享；对已准备的操作或不可变修订版本的修改不被支持。Astra 保留一个空操作批次用于它证明为无操作的变更，但 Pico 对非空结构批次不做额外的完整值相等性检查。

`abort()` 是幂等的。`adopt()` 仅接受来自该跟踪器当前修订版本的已准备结果，然后仅执行同步指针交换到已计算的不可变 `value`。它不做差异计算、应用、分配或回调。Session 行允许每个跟踪器最多一个打开的变更，并确保准备、存储结算和采纳之间没有结果过期。

首次 `tx.doc()` 获取调用 `tracker.beginChange()` 并缓存该变更的草稿，供后续可能异步的 Session 回调使用。

事务行为：

```text
begin transaction
  acquire and memoize document changes by logical address
  mutate revocable Astra overlay drafts
callback settles
  seal Tx; synchronously prepare or abort every open change, revoking every draft
  if any acquisition is pending: abort open changes, reject, then drain and abort it
callback fails with no pending acquisition
  abort every open change; persist and publish nothing
callback succeeds with no pending acquisition
  prepare every open change -> immutable next revision + self-contained Chord Op[]
  Session evaluates each required/ordinary document write exactly once
  Storage.commit persists the atomic batch while the Session line remains held
storage succeeds
  adopt every prepared change by pointer swap and enqueue immutable revision/ops publication
  commit listeners, including conversation view mounts (section 9.3), capture it synchronously
  release the line; invoke listeners later
storage fails
  abort every prepared change, poison Session, and publish nothing
```

一个待定获取在密封后解决时永远不会暴露草稿；其变更被中止，其承诺被拒绝。Session 在释放行前会观察到每一次此类结算。初始化器、迁移和替换根来自调用方代码：Session 将每个根复制到独占内核所有权中，拒绝任何非严格 JSON 值，然后其成为不可变跟踪器修订版本。加载和分支复制根已从存储中分离为严格 JSON，进入跟踪器时无需再复制。Chord 的 `track()` 和 `prepareReplace()` 在 O(1) 时间内接管所有权，无需遍历，因此它们收到的每个根必须来自这些来源之一。迁移回调永远不会接收活的跟踪器修订版本。

准备、验证或检查点失败发生在存储准入前，正常回滚。Session 对已准备的操作或选定的基础不做严格 JSON 遍历：根在进入时被检查，Chord 检查每个草稿放置，因此每个修订版本、操作负载和基础都是通过构造严格 JSON。跟踪器品牌和 `baseRevision` 强制执行所有权和过期性；Session 从不替换调用方创建的已准备值。已准备的不可变候选值本身成为采纳和发布值。存储仅在 Session 选择基础时才接收该完整值；否则仅接收已准备的操作批次。现有当前版本文档带有空批次则写入和发布无内容。非空结构批次的最终值与其基础深度相等时仍为有效持久变更和发布。创建和必需版本转换在准备批次为空时仍写入基础；与基础值相等的版本基础不会发出观察更新。

赋值到草稿中的值被立即按值复制。重复放置是独立的。Chord 在复制时检查每个放置，当值不是严格 JSON 时（`undefined` 数组元素或嵌套对象值、非有限数字、函数、符号、大整数、访问器、符号键、稀疏数组或）会抛出异常，变更前处理。
对象的原型既不是 `Object.prototype` 也不是 `null`。直接将 `undefined` 赋值给对象属性会删除该属性。草稿读取、草稿写入以及所有 `Tx` 操作在回调结束后都会被拒绝。准备好的不可变值仍可被会话拥有的检查点和存储准备读取。

```ts
let escaped: Draft<LiveState> | undefined;
await session.commit(async tx => {
  escaped = await tx.doc(LiveDoc, conversationId);
}, context);
escaped!.generation = undefined; // throws: the draft was revoked
```

在回调结束前对草稿进行突变的即发即弃工作可能会静默地进入该事务，且不受支持。

### 3.5 基础和检查点

创建操作总会存储一个完整的基线。

对于普通后续突变，仅凭定义即可决定存储记录是否为基线：

```ts
const useBase = definition.checkpointWhen?.(candidateValue, ops, { deltasSinceBase }) ?? false;
```

会话在跟踪器准备后，仅对这个谓词进行一次精确评估。
`deltasSinceBase` 计数存储在化身最新基线之后的变更量，不包括正在评估的变更。存储在呈现当前值时报告该计数；会话在每次采纳写入后递增它，并在每次基线后重置它，因此评估过程中不会进行存储读取。创建和版本转换需要基线，不会调用它。会话随后仅向存储提供所选表示形式：

```text
required or predicate true -> base with complete value
otherwise                  -> delta with the prepared Chord operation batch
```

除非定义选择了检查点，否则 Chord 根替换操作仍为变更量，且不授权回收。谓词失败会在存储准入前中止已准备的事务。存储不会执行定义代码，也不会接收带有所选变更量的未使用完整候选值。

-  对于会话、任务和最新对话文档，已提交的基线允许物理回收较旧记录。
-  对于可回滚的对话文档，基线绑定回放但不允许删除可寻址的历史记录。
-  一个从不检查点的定义可能会创建无限回放尾部。这是定义中的 bug，而不是后端启发式。
-  存储不会计算编码字节，不与 `initial()` 比较，也不自行创建检查点。

定义可以直接限制回放：

```ts
checkpointWhen: (_value, _ops, info) => info.deltasSinceBase >= 31
```

高变更率的实时文档在变为空时可以进行检查点：

```ts
checkpointWhen: (value, _ops) =>
  value.generation === undefined &&
  value.tools === undefined
```

### 3.6 版本和迁移

一个迁移回调处理所有受支持的旧版本。

```text
stored == token -> use value
stored < token  -> call migrate(value, storedVersion)
stored > token  -> reject typed access
no migrate      -> reject older stored version
```

`migrate()` 是纯函数，返回完整当前版本值。迁移是按需访问驱动的：`tx.doc()`、`snapshot()`、`snapshotAsOf()`、`documentState()` 和 `watchDoc()` 通过调用时提供的令牌重建并迁移。运行时不会扫描普通文档。

-  只读访问仅在内存中迁移，且从不写入。它可能会缓存该迁移的不可变修订版本及其旧存储版本标记的跟踪器；下一次成功的 `tx.doc()` 访问仍需写入所需的当前版本基线。缓存的跟踪器仅服务于其值被材料化时的版本令牌。使用其他版本的访问（如从重新加载的扩展代码中加载的令牌）会丢弃缓存并重新加载存储值，因此每个令牌要么从存储版本迁移，要么拒绝更新版本。迁移总是从分离的存储值开始。
`tx.doc()` 在其包含事务中阶段化迁移；回调失败则不会持久化任何内容，且后续草稿编辑会合并为一个最终必需的基线。
-  可回滚历史不会被重写。当前和历史重建值在回放后迁移。
-  任何存储版本迁移后的首次 `tx.doc()` 事务仍会写入必需的当前版本基线，即使迁移的 JSON 深度相等。
-  分支获取的是从存储中获得的选定存储值/版本，而不是从类型化迁移跟踪器缓存中获得。子项复制该存储对，并在后续类型化访问时迁移。
-  未访问的文档和定义不可用的文档会保留其存储实例、版本和字节。

### 3.7 分支

对话分支指向一个具体的可见条目 `E`。

子项转录包含通过 `E` 的条目，即使同一提交也追加了后续条目。`E` 的文档状态是包含 `E` 的提交的最终状态。不同的文档状态需要单独的提交。

每个对话文档都遵循其历史/分支策略所持久化的
`DocumentRecord`:

| conversation setting | child value |
|---|---|
| `fork: "asOf"` | parent value at `E`'s commit |
| `fork: "current"` | 在执行分支提交时选择的已提交父值 |
| `fork: "initial"` | 无复制实例；首次访问子项时初始化 |
| `current` 和 `asOf` 复制逻辑上存在的对话单例和家庭
实例，保留未知定义及其存储版本。复制的值会成为具有新ID和初始基础的独立子实例。
`initial`不会复制任何实例；子实例中的首次访问会根据
提供的定义。任务文档和任务永远不会被复制。会话文档保持共享且不可回滚。

分叉复制读取已提交的存储值，而不是类型化的跟踪缓存。因此，创建分叉的事务如果也写入父级的`fork: "current"`文档，则会拒绝；先提交父级变更，以便分叉有一个明确的存储源版本。

分叉会将后台的`document.copy`命令置于准备阶段，命令中携带了子项创建记录和确切的源版本/时间点。存储会根据每个源版本/时间点生成相应的材料。
并将其存储的值和版本持久化，作为子项独立的初始基准；
远程存储在服务器端执行。每个副本读取已提交的预批次
源状态独立于写入数组的顺序。选定的源在同一个批次中不能被创建、更改或退役。复制操作保持原子性，与
对话、覆盖、注册表写入和其他变异。

未访问的副本仅在会话内存中保留其描述符。在创建事务内进行类型访问时，会惰性地读取分离的源数据，在需要时迁移。
required，替换为一个普通的子项，包含最终准备好的值。无定义的副本发布明确的 `document.copy` 元数据，而不是值。该元数据宣布了基于存储的初始状态，绝不会被解释为文档值。文档状态、观察器和挂载的视图通过在会话线上原子地捕获其基线和订阅来“水合”：一个后来的提交（已存在）成为基线，而注册后提交的则被交付。发布
and watches 是收敛机制，而不是审计流。已挂载的聚合必须获取其所有文档基线并在一次
会话行操作，使其永远不会暴露来自一个提交的混合内容。
## 4. 交易和存储所有权

会话提交回调可能是异步的。它拥有会话突变
划过回调执行、准备、存储结算、已承诺基准采用和发布排队。承诺观察者在该行运行；文档状态和用户回调稍后运行。
外部模型、流程、工具、网络和人为影响在外部运行。
`subscribeCommits()` 观察采用后的完整不可变发布，同步进行。`subscribeClose()` 在开始时同步观察，采用密封后；Harness 停止计时并在此处发出任务调用信号。两者均返回幂等销毁器；其监听器不得抛出、阻塞或调用 Session API。文档状态订阅者和监听器仍稍后运行，脱离主线程。

```ts
await session.commit(async tx => {
  const conversation = await tx.conversation(conversationId); // table read
  const live = await tx.doc(LiveDoc, conversationId);

  await tx.appendEntry(conversationId, message);     // first table write
  delete live.generation;                            // document mutation remains valid
  await tx.createTask(Follow, {}, { ownership: { kind: "conversation" }, conversationId }); // further table writes are fine
}, context);
```

会话线程在提交回调开始前发生变异采用。关闭密封变异采用和任务
预订。已批准的提交会在存储关闭前完成结算。一旦提交被批准，调用方的取消操作不会中断存储结算或撤销提交。取消等待关闭操作不会重新开启准入。

表规则：

- 表是对话、条目、任务和提交。
- 允许在第一次写入表之前读取表。
- 任何在第一次写入表之后的表读取都会抛出 `ReadAfterWrite`。
- 文档访问和读取你的写入内容在表写入后仍然可用。
- 创建方法会返回其创建的ID/记录；调用方无需读取回来。

存储所有权：

- 提交参数在 `Storage.commit()` 结算前会被借用。
- 任何结算后保留的内容都会先被分离。
- 内存存储会递归复制保留的JSON容器。
- JSONL和SQLite通过序列化和解码索引分离。
- 每次存储读取都会返回一个分离的JSON值。
- 不可变字符串可以共享；可变数组和对象不可以。

## 5. 任务

### 5.1 定义

```ts
type TaskOutcome<R> =
  | { readonly status: "completed"; readonly result: R }
  | { readonly status: "failed"; readonly error: TaskOutcomeError; readonly result?: R }
  | { readonly status: "aborted"; readonly reason?: string; readonly result?: R }
  | { readonly status: "orphaned"; readonly reason: string }
  | { readonly status: "faulted"; readonly error: TaskOutcomeError };

type JoinPolicy = "failFast" | "allSettled";

type TaskState<S, R> =
  | { readonly status: "pending"; readonly checkpoint: S }
  | { readonly status: "running"; readonly checkpoint: S }
  /** Parked without an invocation until every task in `on` is terminal; then resumes at `checkpoint` (section 5.5). */
  | {
      readonly status: "waiting";
      readonly checkpoint: S;
      readonly on: readonly TaskId[];
      readonly policy: JoinPolicy;
    }
  /** Outcome decided; terminal once no ordinary owned work below is live (section 5.5). Runs no more code. */
  | { readonly status: "completing"; readonly outcome: TaskOutcome<R> }
  | { readonly status: "terminal"; readonly outcome: TaskOutcome<R> };

/** Who owns a task: its conversation (a top-level task) or another task of the same conversation. */
type TaskOwnership = { readonly kind: "conversation" } | { readonly kind: "task"; readonly taskId: TaskId };

type TaskRecord<I, S, R> = {
  readonly id: TaskId<R>;
  readonly conversationId: ConversationId;
  readonly kind: string;
  readonly version: number;
  readonly input: I;
  /** Owning task; absent for a task its conversation owns. Immutable. */
  readonly owner?: TaskId;
  readonly background: boolean;
  readonly abortRequested: boolean;
} & (
  | {
      readonly state: Extract<TaskState<S, R>, { status: "pending" | "running" | "waiting" }>;
      readonly memos?: Readonly<Record<string, JsonValue>>;
    }
  | {
      readonly state: Extract<TaskState<S, R>, { status: "completing" | "terminal" }>;
      readonly memos?: never;
    }
);

type RunningTask<I, S, R> = TaskRecord<I, S, R> & {
  readonly state: Extract<TaskState<S, R>, { status: "running" }>;
};

/**
 * State a task commits for itself: a replacement checkpoint, a wait, or its outcome. A returned `terminal` state
 * becomes `completing` while ordinary owned work below is live (section 5.5).
 */
type NextTaskState<S, R> = Extract<TaskState<S, R>, { status: "running" | "waiting" | "terminal" }>;

interface HookRunner<H extends object> {
  each<K extends keyof H>(name: K, invoke: (handler: NonNullable<H[K]>) => void | Promise<void>): Promise<void>;
}

type PhaseHandler<I, P, S, R, H extends object> = (
  task: RunningTask<I, P, R>,
  runtime: TaskRuntime<I, S, R, H>,
  context: Context,
) => Promise<void>;

interface TaskRuntime<I, S, R, H extends object> extends DocumentObserver, DocumentReader {
  readonly taskId: TaskId<R>;
  readonly conversationId: ConversationId;
  readonly signal: AbortSignal;
  /** Registry snapshot of the current phase; refreshed at every phase boundary. */
  readonly registry: RegistrySnapshot;
  /** The task's conversation's agent, resolved once for this phase (section 7.1). */
  agent(context: Context): Promise<Agent>;
  /** `HarnessOptions.settings`, resolved at each access. */
  readonly settings: Settings;
  readonly models: Models;
  readonly hooks: HookRunner<H>;
  /** Calls `HarnessOptions.env` for the task's conversation; rejects with its error. */
  env(context: Context): Promise<ExecutionEnv | undefined>;

  commit(
    change: (
      tx: Tx,
      current: RunningTask<I, S, R>,
    ) => NextTaskState<S, R> | undefined | Promise<NextTaskState<S, R> | undefined>,
    context: Context,
  ): Promise<void>;

  memo<T extends JsonValue>(name: string, context: Context): Promise<T | undefined>;
  memo<T extends JsonValue>(name: string, candidate: T, context: Context): Promise<T>;
  conversation(id: ConversationId, context: Context): Promise<ConversationHandle | undefined>;
  /** Committed task record. */
  getTask<T>(id: TaskId<T>, context: Context): Promise<TaskRecord<JsonValue, JsonValue, T> | undefined>;
  /** Terminal receipt; rejects when the invocation ends. */
  waitForTask<T>(id: TaskId<T>, context: Context): Promise<SettledTask<T>>;
  /** Outcomes of terminal tasks, in order; rejects when one is not terminal. Used after a wait (section 5.5). */
  outcomes<T>(ids: readonly TaskId<T>[], context: Context): Promise<TaskOutcome<T>[]>;
  /** Committed entry visible from the task's conversation. */
  entry(id: EntryId, context: Context): Promise<EntryRecord | undefined>;
  entry<D extends JsonValue>(token: Entry<D>, id: EntryId, context: Context): Promise<TypedEntry<D> | undefined>;
  /** Committed raw active transcript and model context, optionally cut off at `at`. */
  context(conversationId: ConversationId, context: Context, at?: EntryId): Promise<ContextView>;
  /** The Harness clock. */
  now(): number;
  /** Forward a non-fatal failure to `HarnessOptions.onReport`. */
  report(error: unknown): void;
  sleep(until: number, context: Context): Promise<void>;
}

type TaskDefinition<I, S extends { phase: string }, R, H extends object> = {
  readonly name: string;
  readonly version: number;
  initial(input: I): S;
  readonly phases: {
    [P in S["phase"]]: PhaseHandler<I, Extract<S, { phase: P }>, S, R, H>;
  };
  abort(task: RunningTask<I, S, R>, runtime: TaskRuntime<I, S, R, H>, context: Context): Promise<void>;
  migrate?(input: JsonValue, checkpoint: JsonValue, fromVersion: number): {
    input: I;
    checkpoint: S;
  };
  readonly hooks?: H;
};

interface Task<I, S extends { phase: string }, R, H extends object> {
  readonly definition: TaskDefinition<I, S, R, H>;
}

type TaskOptions = {
  /** Required: a task always names its owner (section 5.5). */
  readonly ownership: TaskOwnership;
  /** Default: the owner task's conversation, or the transaction's bound conversation. */
  readonly conversationId?: ConversationId;
  /** Conversation-owned tasks only: excluded from conversation abort and idle, and from cascades. */
  readonly background?: boolean;
};

function defineTask<I, S extends { phase: string }, R, H extends object = {}>(
  definition: TaskDefinition<I, S, R, H>,
): Task<I, S, R, H>;
```

`TaskId<R>`是带有擦除结果类型标识的数值任务ID本身。它替代了独立的任务引用包装器：`createTask()`返回`TaskId<R>`，类型推断根据该ID等待`R`，且结果无关的操作接受`TaskId<unknown>`。任务的`conversationId`在创建后是不可变的；替换操作将现有任务移动到另一个会话时会在存储准入前被拒绝，因此已持久化会话所有者边不会变质。

阶段映射是全面且阶段受限的。处理程序可能在一个效果周围执行多个提交，但每个持久化检查点都是完整替换。`TaskRuntime.commit()`在会话线上重新读取并控制当前持久化任务，然后调用其回调。当调用结束、运行时关闭、任务终止或运行调用的任务带有中止标记时，它会拒绝。它的`tx.createTask()`默认为任务的会话，且每次追加的条目都记录任务为`byTaskId`。当回调返回状态时，运行时在同一提交中替换任务的状态，因此检查点或结果与回调的条目、文档和子任务是原子的，并且会根据任务的检查点和结果类型进行类型检查。返回空状态则保持状态不变。终止或完成状态会丢弃备忘。`waiting`状态即使检查点未变也会结束调用；它拒绝`on`命名缺失的任务、任务本身或其所有者链上的任务，因为这些任务永远不会首先完成，且空`on`会在下次调度时恢复。`pending`永远不会被返回；只有协调和移交操作会写入它。

`Tx`没有任务替换操作。任务只通过其运行时改变自身状态。调度器负责预留、协调、移交、故障和孤儿处理；`abortTask()`负责中止标记。其他代码通过`abortTask()`停止任务，并通过`waitForTask()`读取其结果。

```ts
// Intent, effect, outcome.
prepare: async (task, runtime, context) => {
  await runtime.commit(() => ({ status: "running", checkpoint: { phase: "charge", key: newKey() } }), context);
},
charge: async (task, runtime, context) => {
  const receipt = await payments.charge(task.state.checkpoint.key); // idempotent by key
  await runtime.commit(async (tx, current) => {
    const entry = await tx.appendEntry(current.conversationId, receiptEntry(receipt));
    return { status: "terminal", outcome: { status: "completed", result: { entryId: entry.id } } };
  }, context);
},
// The abort handler decides the outcome; returning without one faults the task.
abort: async (task, runtime, context) => {
  await payments.cancel(task.state.checkpoint);
  await runtime.commit(() => ({ status: "terminal", outcome: { status: "aborted", reason: "user" } }), context);
},
```
`memo(name, candidate)`是一个受控提交；`memo(name)`读取已提交的记录。`sleep(until)`会将已提交的记录与运行时`now`时钟进行比较，当调用被信号量或上下文取消时拒绝。通过运行时获取的监视器在调用结束时停止。`snapshot()`/`snapshotAsOf()`读取已提交的文档，例如用于供应`PromptInput.read`（第7.4节）。`getTask()`和`entry()`通过单次查找读取已提交的记录；`waitForTask()`等待终止收据，例如由工具创建的子任务。`context()`在会话线上捕获其边界，并从线下不可变条目派生视图，如`Conversation.context()`所示。与所有运行时操作一样，这些在调用结束时拒绝。

预留会永久改变`pending`，或在可能恢复时将`waiting`变为`running`。一次调用按顺序运行阶段处理程序；检查点提交保留`running`。在每个阶段之前，包括第一个阶段，调度器会在会话线上运行一步回调。它读取已提交的任务，并同步将刚刚返回的阶段应用以下任一匹配规则：它在同一个提交中写入任何故障或移交，并与运行时清理（第5.4节）一起处理调度器编写的输出，该输出可能在回调内部等待文档访问。当规则停止调用时，它结束调用。因此，调用排队较早的运行时提交要么在步骤之前落地并计入，要么在步骤之后到达并拒绝。在第一个阶段之前，仅适用规则1–3：

1. 终止、`completing`或`waiting`：停止。
2. 会话关闭：停止；保留检查点和任何中止标记以便重新开启。
3. 带有持久中止标记的运行模式：结束并加入运行调用；任务的普通所有工作不再活跃后，一个新的中止调用开始（第5.5节）。
4. 未捕获的错误：写入终止`faulted`。
5. 检查点改变，包括同一阶段内的进度：刷新注册表快照，并根据需要移交（第5.4节）或在同一任务调用中调用阶段处理程序。
6. 检查点不变：由于没有持久进展，因此将终端写入`faulted`  
一个中止调用仅运行一次中止处理程序。处理完毕后，步骤将应用规则1、2和4；如果处理程序返回且没有终端结果，则任务出错。当存储拒绝步骤的错误或移交写入时，调用仍会结束；任务保持`running`状态，下一个保留将再次运行它。

打开时，正在运行的任务协调会将存活的`running`任务改回`pending`，保留其检查点和中止标记；`waiting`任务保持等待状态，`completing`和`waiting`任务将重新评估（第5.5节）。任务迁移在保留期间运行，与`pending`或`waiting`->`running`原子执行。一个回调处理所有受支持的旧版本。定义缺失、版本过旧或迁移失败的任务保持`pending`或`waiting`状态，直到安装合适的定义或任务被中止（第5.4节）。

`close()`表示运行时关闭，密封准入和保留，通知调用，并结束状态和监视。在会话行之外，它会处理已准入的提交并加入调用，然后关闭存储。已运行的监视回调保持调用者拥有。后续运行时提交会被拒绝，关闭写入不会产生任务结果。关闭不会启动新的阶段或中止调用。它不会设置中止标记、终止任务、退役任务文档或发布文档退役。托管层在关闭Harness之前会撤回服务并断开客户端，例如通过处置其Chord面相主机（参见Chord使用指南）；重新连接到已重新打开的会话会恢复最后提交的状态并从其持久检查点继续恢复。

### 5.2 效果三明治

```text
commit intent phase
perform external effect
commit outcome or next phase
```
  
在意图阶段重新打开意味着效果可能已经发生。阶段处理程序会安全重试、轮询外部句柄或记录中断。延迟提供者由包含其句柄和下次轮询时间的持久阶段表示。

运行时拥有的备忘录是存储在活任务信封中的小型先写入者胜出值。候选插入和读取胜出者是一次会话提交，因此并发候选者会返回相同的持久胜出者。备忘录会随检查点保留并在终端替换中消失。批量进展应放在文档中。

### 5.3 终端任务

终端任务记录是持久结果收据。其结果可能直接包含小型值或引用条目：

```ts
{ status: "completed", result: { entryId: toolResultId } }
```
  
终端转换原子执行：

1. 写入终端任务记录。  
2. 追加任何结果条目。  
3. 退役所有该任务范围内的文档。  
4. 解决任何由任务结算的提交。

一个拥有普通工作且处于活状态的任务会在`completing`持有（第5.5节，规则4）处分裂此过程：任务写入的结果自己的写入落在持有中，且第1、3项及其等待者在最终提交中跟随。

执行检查点和备忘录会从终端表示中消失。终端记录仍可查询等待、等待者、检查和重新打开。没有独立的任务依赖：顺序来自任务等待其他任务（第5.5节）。中止标记允许待处理工作到达其中止处理程序，或在定义不可用时到达其`orphaned`结算。

### 5.4 调度器、中止和所有权

调度器会串行保留合格任务，然后在会话行外运行处理程序。一个内存中的`TaskInvocation`包含模式、中止控制器和完成承诺。

中止协议：

```text
commit abortRequested
signal and join active run invocation
wait until ordinary owned work is no longer live (section 5.5)
start a fresh abort invocation
abort handler commits terminal outcome
```
  
一个运行调用在持久中止标记出现后可能不会提交。每个运行时操作在其拥有调用结束后都会拒绝，即使会话仍保持打开，且调用的信号和处理程序上下文在结束时中止。调用仅在最后一个处理程序返回后结束，因此这仅取消已分离的残余，例如未等待的`waitForTask()`或与处理程序上下文一起启动的获取；它们不能再写入任何内容。从一个阶段处理程序返回不会结束继续进入另一个阶段的调用。调用模式是易失的且从重新打开的持久标记派生。取消一个调用者的`Context`仅取消
该调用或等待；它不会永久中止共享工作，除非调用的API提交了中止标记。

一个任务可能会创建拥有对话和拥有任务（第5.5节）。对话是持久作用域；任务是根据空闲进行计数的活工作单位，并由中止标记。历史父级与所有权遍历无关。

普通遍历从明确地址的对话开始，访问其对话拥有的任务，跟随每个非后台任务拥有的任务，然后跟随每个非后台任务拥有的对话。它在遍历完成后跟随所有者边。
所有者变为终端，但后台任务是一个边界：普通遍历会跳过该任务及其完整拥有的子树。直接对话操作无论其所有者如何，均从该对话内部开始。直接中止一个正在运行的后台任务，包括该任务及其普通拥有的子树；嵌套的后台所有者仍保持边界。`close()`停止每次调用，无论前台还是后台，均不写入结果，因此工作在重新打开时继续。必须永久取消所有内容的主机将`inspect()`列出的每个正在运行的任务全部中止。
`Conversation.abort()` 会取消排队的输入，并标记通过普通遍历选择的非后台活跃任务。配合 `{ background: true }`，它会跨越后台边界：标记遍历过程中忽略后台标志时遇到的每一个活跃任务，并取消到达的每一个对话的排队输入。然后它会等待所有被标记的任务都处于终端状态，且对话处于普通空闲状态；之后创建的后台工作既不被标记也不被等待。`Conversation.waitForIdle()` 会等待遍历中不再包含任何活跃的非后台任务。Idle Harness 会从每一个无所有者对话的根节点执行相同的遍历，而不是全局统计任务，因此普通工作在后台所有者之下不会阻塞它。显式的 `waitForTask()` 会无论任务的后台标志如何，都等待其引用的任务。

中止标记会以幂等的方式传递到前台所有者的工作中。持久的取消意图是一个活跃所有者的自身记录：它的中止标记，或者持有的非 `completed` 的 `completing` 结果（见5.5节）。终端所有者永远不会
cascades: 它仅在普通拥有工作耗尽后才变为终端状态，因此其意图已应用，后续在它拥有的对话中启动的工作（例如用户对已完成的子代理进行查询）正常运行，并可通过普通遍历从上层访问。其拥有的对话中排队的输入保持排队状态，如同一次运行失败（见第6节）。调度器在后续的重新协商提交和再次打开时推导标记，因此中间崩溃不会丢失任何内容；Session线上已排队的工作可能会导致一次额外的提交。每个存活的非后台任务，其拥有链（向上通过拥有任务和拥有对话）到达一个已取消的存活拥有者，且未先经过一个本身没有取消意图的后台任务，都会获得一个中止标记，包括该级联之后创建的工作。在它们自己的提交中推导标记可使它们不进入拥有者的提交，后者可能已写入相关任务。该级联到达的每个对话都像`Conversation.abort()`一样处理：其排队的输入提交变为`unanswered`，原因标记为`aborted`，并离开其收件箱，而排队的写入保持不变。级联从已取消任务下方开始，因此该任务自身的对话保持其队列。持有的结果`failed`、`faulted`、`orphaned`和`aborted`记录与中止标记相同的持久取消意图；`completed`没有。对话记录和拥有者边框永远不会随任务退役。活动调用在提交后被信号通知。终端收据保证该任务的普通拥有工作已耗尽；其下方的后台工作可能继续。

每个运行调用的启动通过`TaskRecord.kind`从调度器当前注册表快照中解析任务定义：

```text
definition missing                 -> stay pending, blocked: missing_task
stored version newer than it       -> stay pending, blocked: task_too_old
stored version older than it       -> migrate(input, checkpoint, storedVersion)
  failure                           -> stay pending, blocked: migration_failed
  success                           -> commit migrated record + running atomically
equal version                       -> commit running
```

中止调用以相同方式解析定义。当定义可以接受该任务时，其中止处理程序运行；否则该任务将如下面所述被遗弃。

失败的迁移通过`onReport`报告一次，并且只有在注册表解析出该任务类型的另一个定义对象后才重试。

框架绝不会仅仅因为注册表代码缺失或
不兼容，既不能在打开时也不能在之后。一个没有中止标记的阻塞任务会保持其持久记录不变，保持活动状态，仍然阻塞普通的空闲等待，并且在注册表发生变化时会被重新考虑。阻塞原因来源于运行时状态，而不是持久化的任务状态。文档迁移仍然是访问驱动的。

中止一个阻塞任务无法运行其中止处理程序，因为该代码缺失或无法接受该任务。因此，运行时将其结算为终端`orphaned`，而不是`aborted`：`aborted`表示该任务自己的中止处理程序运行并决定了结果，而`orphaned`表示没有任务代码运行，因此该任务开始的外部影响可能仍然未清理。被遗弃的`reason`是阻塞原因（`missing_task`、`task_too_old`或`migration_failed`）。当`abortTask()`发现没有活动调用、没有存活的普通拥有的工作，且当前快照无法接受该任务时，标记提交会直接结算它；否则，调度器会在它保留中止调用时结算它，即在拥有的工作已耗尽之后（第5.5节），因此永远不会持有遗弃的结果。只有中止（直接、通过对话或级联）才会遗弃任务；单独缺失定义永远不会这样做。遗弃提交会执行任务代码无法执行的清理：受影响的输入提交变为未回答并附带原因，任何匹配的活动运行控制会被清除，且任务范围的文档退役。终端任务记录和未回答的提交会携带原因；唯一被写入的转录条目是已提交生成部分的转换（下文）。

运行任务出错时会执行相同的控制/提交清理，并带有`faulted`结果；在普通拥有的工作存活期间出错会保留，其清理会在最终提交中运行（第5.5节，规则4）。

调度器对运行或任务类型一无所知。运行时拥有提交、运行控制和内置任务，因此它给调度器提供了一个钩子，调度器会在提交使其自己写入的结果（`faulted`和`orphaned`）成为终端时调用该钩子，即持有时的最终提交。该钩子忽略类型不是内置运行、工具或压缩类型的任务，因此它永远不会在其他地方创建`pi.live`。当
`pi.live.run`命名了该任务（第8节）：一个已承诺的生成部分会变成一个已中止的`pi.assistant`条目，完全按照生成中止处理程序转换的方式，这样转录会保留模型的输出，`pi.usage`会计算其花费（调度器的承诺没有任务范围，因此该条目没有`byTaskId`）；其输入会变成`unanswered`，原因可能是`faulted`（详情：错误信息）或阻塞原因；`run`、`generation`和`tools`会被移除。故障来自任务错误或格式不正确的提供者数据，例如响应中的非JSON值，或Storage拒绝的提交（`StorageRejected`）。不确定的存储故障会毒化Session并写入无结果。对于`pi.tool`任务，它会标记任务的工具槽`done`，但不创建条目；运行继续，上下文推导会合成缺失的结果（第2.1节）。对于`pi.compaction`任务，它会移除任务的压缩状态（第8.7节）。一个任务为自己提交的结果会自行结算。Harness还会提供`runtime.hooks`和`runtime.agent()`每个阶段的代理解析（第7.1节）；调度器仅将其每个阶段的注册表快照传递给它。

在每个正常阶段边界（第5.1节，规则5）时，步骤会刷新调用的注册表快照。如果通过名称解析的任务定义与调用开始时的定义不同，且新定义可以保留该任务（相同版本，或更高版本带`migrate`），则调用会移交：步骤会将任务连同其检查点、备忘录和中止标记重新提交到`pending`，并结束该调用，新的保留会启动一个基于新定义的新调用，应用上述保留规则。如果定义缺失或无法保留任务，调用会继续使用旧定义运行，通过`onReport`对每个解析的定义报告一次，并在下一个边界重新考虑。一个从未结算的处理程序永远不会移交。

### 5.5 结构化并发
任务和对话构成一个所有权树。每个任务在创建时都会指明其所有者，`tx.createTask(task, input, { ownership })`，且必须拥有`TaskOwnership`：其对话（`{ kind: "conversation" }`，顶级任务）或另一个任务（`{ kind: "task", taskId }`，子任务）。每个对话要么无所有者，要么由一个任务拥有（第2.2节）。子任务始终存在于其所有者的对话中；只有被拥有的对话会跨越对话边界。所有者边是不可变的。

任务`T`的“普通拥有效务”是指通过普通遍历能到达的任务`T`以下的所有任务：包括任务`T`所拥有的任务、对话`T`所拥有的任务，以及递归到这些任务中所有非后台任务。后台任务及其以下的所有内容都被排除在外。对话拥有的任务可以是后台任务；子任务不可以。

由此树结构可得出两条规则：

**中止向下传递**（第5.4节）。一个活跃所有者的取消意图（其中止标记，或持有的非`completed`结果）会标记其普通拥有效务。后台任务除非被直接中止或通过`Conversation.abort(context, { background: true })`中止，否则是边界。

**拥有效务不能超出其所有者的完成状态。** 任务只有在其普通拥有效务被完全消耗后才会完成：

1. A终端状态或调度器写入的终端结果（`faulted`，`orphaned`），在任务的普通拥有效务仍活跃时被记录为`{ status: "completing", outcome }`。调度器会在稍后的提交中写入最终的`terminal`记录，此时普通拥有效务已无，该判断会在每次提交后进行，包括在持有期间新创建的工作。是否工作处于活跃状态，由提交候选记录判断，因此例如任务在自己拥有的对话中创建的任务，会持有其活跃状态。在打开时，会重新评估每个`completing`任务。
2. A持有的结果是最终状态：不会再有阶段、运行时提交或中止处理程序运行，无需定义，任务不会被保留或迁移，`abortTask()`仅标记它并返回`marked`，取消其下方工作。最终记录会保持持有的结果和标记。
3. A持有的非`completed`结果是取消意图，因此下方工作会被中止、消耗，然后任务变为终端状态。持有的`completed`结果会等待工作正常完成。
4. 写操作在持有期间分割。任务提交的终端记录会将除终端状态、任务文档退役和等待者外的所有写入（如工具的结果条目和槽位）都写入持有期间。只有终端状态、任务文档退役和等待者会被推迟到最终提交。调度器写入的结果仅在持有期间写入记录；其运行时清理（第5.4节）会在最终提交中运行，因此发生故障的任务会保持`pi.live.run`直到其工具被消耗。
5. 等待者、空闲等待、检查和普通遍历会将`completing`任务视为活跃状态，直到其最终提交。

新拥有效务需要一个活跃所有者：`createTask`和`createConversation`拒绝`completing`、`terminal`或在提交最终候选中被标记为中止的任务（第3.3节）。对话在其所有者完成之后仍然可用：例如，在其上启动的新运行（如对已完成的子代理进行查询），是该对话的普通工作，可通过上级遍历到达，不属于任何完成状态。

**等待。** 阶段可能会提交`{ status: "waiting", checkpoint, on, policy }`。任务在没有调用的情况下停止，并在`checkpoint`中所有任务`on`都变为终端状态后恢复。`on`可以命名任何任务，包括已经变为终端状态的任务；任务`owner`不是等待任务的所有者时，需要`policy: "allSettled"`。`on`不能命名缺失的任务、其自身或其所有者链上的任务（第5.1节）。使用`failFast`时，`on`中第一个持有或以非`completed`结果结束的任务会在调度器的下一次协调提交中给`on`中所有其他活跃任务都加上中止标记。等待任务自身不会被标记：它会在`on`全部变为终端状态后恢复，并读取其结果`runtime.outcomes()`。任务可以在等待前创建子任务并继续运行阶段，并可以按顺序等待其子任务的任意子集。
**中止顺序自下而上。** 任务的中止调用只有在其普通拥有的工作不再存活时才会开始，因此中止处理程序只能看到其下方的最终结果。对等待任务的中止标记使其可以在同一规则下提前离开等待，进入其中止处理程序；它在`on`中不拥有的任务不会被等待。顺序根据已提交的记录判断：子任务在其终止提交之后运行，顺序不受影响。中止处理程序不能返回`waiting`，也不能创建拥有的子任务，因为其任务已被中止标记（第3.3节）：它会内联补偿，或创建后台对话拥有的任务，这些任务不受级联影响，并使用`runtime.waitForTask()`等待它们，该标记持有其调用。

以示例`Checkout`任务的级联为例，它等待四个`Payment`子任务的`failFast`：过期的卡片支付失败；三个存活的支付获得中止标记并在各自的中止处理程序中退款；一旦所有四个都处于终止状态，`Checkout`恢复运行，读取`[aborted, failed, aborted, aborted]`到`outcomes()`，并决定其自身的结局。`abortTask(Checkout)`则标记`Checkout`，级联标记存活的支付，它们的中止处理程序运行
首先，然后 `Checkout.abort` 运行并看到它们的最终结果。

##  6. 提交和收件箱

提交记录等待可接受的主机对象。准入是 Harness 内部的；边界将排队的提交与 `tx.placeSubmission()` 进行绑定，并运行任务以用 `tx.settleSubmission()` 回答它们的输入。排队的提交等待在内置收件箱文档中，一个有序的带标记项列表：

```ts
type InboxItem =
  | { readonly id: SubmissionId; readonly mode: "steer" | "followUp"; readonly content: UserInput }
  /** `entry` is the write's `EntryDraft`, stored as plain JSON. */
  | { readonly id: SubmissionId; readonly mode: "write"; readonly entry: JsonObject };

type InboxState = { items: InboxItem[] };
```

| 字段 | 值 |
|---|---|
| 类型 | `pi.inbox` |
| 版本 | `1` |
| 范围/历史/分支 | 对话，`latest`，`initial` |
| `initial()` | `{ items: [] }` |
| 检查点 | 基础完整，当 `items` 为空时 |
| 视图挂载 | `docs["pi.inbox"]` |
| 创建时间 | 每个 Harness 对话（第 2.2 节） |

项目按 ID 顺序排列。排队的输入存储其内容；其 `pi.user` 项在放置时获得 Harness 时钟的时间戳。排队的提交属于它们的对话，因此分支从空收件箱开始。

运行控制位于内置的实时文档 `pi.live`（第 8 节）中。其
optional `run` 是当前负责运行的任务名称及其放置的输入提交ID。`run !== undefined` 定义了 `busy`；获取或创建空闲文档时不会定义。该值在生成、工具和工具人之间协作时保持不变：`taskId` 命名了最终确定生成的任务
输入，包括工具轮运行期间，然后是下一代。工具任务永远不会拥有运行；当前轮次的工具任务列在 `pi.live.tools` 中。ID 列表是可变状态，因为边界会向活动运行添加已放置的转向输入；每个终端路径
准确地处理列出的输入。

入站和终端转换：

| 操作 | 提交状态 | 其他写入 |
|---|---|---|
| 输入，空收件箱空闲状态 | `placed`，带用户输入 | 创建运行和生成 |
| 写入，空收件箱空闲状态 | `done`，带输入 | 追加输入；不运行 |
| 输入或撰写，忙碌或非空收件箱 | `queued` | 附加收件箱项目 |
| 边界位置用户项目 | `placed`，带条目 | 将ID添加到当前或后续运行 |
| 边界位置写入 | `done`，带入口 | 追加入口 |
| 运行答案 | 输入 `done`，带必需的答案入口 | 删除 `run`，或交给继任者 |
| 运行失败或任务中止 | 输入 `unanswered`，带原因 | 删除 `run`；收件箱不变 |
| 挂起项撤回 | `unanswered`，原因 `aborted` | 删除收件箱项 |
| 陈旧头部写入 | `unanswered`，原因 `stale` | 删除收件箱项 |

`requestId` 在任何写入前对同一会话进行去重；复用一个用于另一种提交类型会被拒绝。繁忙输入带有 `whenBusy: "reject"` 写入无记录并报告 `ConversationBusy`。空闲输入以模式 `steer` 排队，当 `whenBusy` 是 `steer` 时，否则为 `followUp`。

空闲会话带非空收件箱（例如运行失败后），将每个新提交排队在等待项之后，并在同一提交中运行最终边界。顺序保持：失败前排队的后续项优先于新输入。
`Submission`会等待`done`或`unanswered`；中止提取仅撤销仍排队的提交，对已放置的输入报告`already_placed`，对任何终端提交报告`settled`。会话中止提取会撤销排队的引导/后续提交，但保留写入以便后续放置。

边界选择由项ID确定，其设置为`steeringMode`和`followUpMode`（第2.2节），在Session行上读取每个边界的设置：`one-at-a-time`选择该模式的第一个项，`all`选择该模式的所有项。

| 边界                      | 写入 | 引导     | 后续     |
|-------------------------|------|----------|----------|
| `postTools`        | 全部 | 按模式第一个/全部 | 无      |
| `final`        | 全部 | 按模式第一个/全部 | 按模式第一个/全部 |

选定的边界会先放置其选定的写入项（按ID顺序），然后放置其选定的用户项（按ID顺序）。因此，任何在重置或压缩摘要之前排队的用户项会排在其后，并在新上下文中运行。排队的用户项永远不会因头部而过期。

头部写入（无论是否排队或一次性放置），其目标早于活动范围的起始点，即最新头部标记的`head`，会被视为过期：放置它会带回头部切割的历史记录。在同一个边界中，较早放置的头部计数：在排队重置后，任何针对较早条目的排队摘要都会被视为过期。`head: "self"`写入永远不会过期。

压缩摘要属于头部写入（第8.7节），因此仅凭此规则即可按切割位置对压缩操作进行排序：切割早于活动范围起始点的摘要会被视为过期，而切割在或之后的摘要会被放置，无论何时被选中。例如：背景压缩B在尾部100处选择并在70处切割。当它进行摘要时，阻塞压缩A在150处切割并追加其摘要。B的摘要最终会报告`stale`，因为70早于150。如果A在60处切割，B会被放置在A之后：B在选择时已总结了其上下文，即最新摘要加上70之前的条目，这覆盖了A摘要的所有内容。只要只有压缩摘要和重置作为头部，较早的切割就会过期；应用编辑在压缩摘要期间放置的头部会被丢失，应用头部可以被撤销（第12节）。

`postTools`边界选择`head: "self"`写入（重置）时，行为与`final`相同：它也会选择后续项，且当前运行以`unanswered`作为输入，原因报告为`reset`，因为其上下文在答案之前被切割。在`final`边界放置的重置会跟随答案，因此输入已经是`done`。

在普通`postTools`中，即使没有排队触发器，生成也会继续；选定的引导ID会加入该继续过程。终止或交接工具轮询（第8.5节）会使用最终行为。在`final`中，当前运行已放置的输入提交会首先结算，除非`onYield`继续过程保持它们开放（下文说明）；选定的用户ID会启动下一个继任生成，这些ID作为新运行的输入。写入永远不会因自身触发生成。没有用户触发的最终边界会使会话处于空闲状态，除非有`onYield`继续过程（第8.3节），该继续过程仅在边界未选择任何用户项和重置时适用。

仅成功运行结束会应用最终边界：答案`terminate`或`handoff`。失败、运行任务的中止处理程序、故障和孤儿会结算运行的输入`unanswered`，并单独保留收件箱`Conversation.abort()`（`pi.inbox`中排队的项会一直可见，直到下一次提交的边界或它们被撤销）。

选定和过期的项会按位置移除，同时保留项的顺序。Chord的Astra操作生成器必须表达分散的移除操作，而不携带保留的值；ID不会被用于替代收件箱的位置语义。

## 7. 扩展、钩子、工具和系统提示

### 7.1 扩展、注册表和代理解析

扩展代码通过一个应用程序拥有的扩展注册表到达运行框架。扩展是一个命名的工具包、提示部分、钩子、工具和部分包装器以及任务定义的捆绑。注册表是进程本地的，可能比运行框架生命周期更长，且不会持久化；持久状态保留在会话、条目、任务和文档中。会话会选择扩展
by name in its `pi.agent` document (section 2.2).

```ts
type DocumentReader = Pick<Session, "snapshot" | "snapshotAsOf">;

type PromptInput<Tool extends ToolRegistration = ToolRegistration> = {
  readonly conversationId: ConversationId;
  /** The request's resolution; `agent.tools` are the tools offered in this request. */
  readonly agent: Agent<Tool>;
  /** Built by `HarnessOptions.env` for this preparation (section 2.2). */
  readonly env: ExecutionEnv | undefined;
  /** Sections already in effect after replaying the active transcript. */
  readonly shown: Readonly<Record<string, string>>;
  /** Committed document reads. */
  readonly read: DocumentReader;
};

type PromptSection<Tool extends ToolRegistration = ToolRegistration> = {
  readonly key: string;
  render(input: PromptInput<Tool>, context: Context): string | undefined | Promise<string | undefined>;
  /** Default true: wrap the text as `<key>\n...\n</key>`. */
  readonly tag?: boolean;
};

/** Built by `hook()`; matches tasks by name. */
type HookRegistration = { readonly task: string; readonly handlers: object };

/** Built by `wrapTool()` and `wrapSection()`; targets a tool name or a section key. */
type Wrap<Tool extends ToolRegistration = ToolRegistration> =
  | { readonly tool: string; wrap(tool: Tool): Tool }
  | { readonly section: string; wrap(section: PromptSection<Tool>): PromptSection<Tool> };

interface Extension<Tool extends ToolRegistration = ToolRegistration> {
  readonly name: string;
  readonly tools?: readonly Tool[];
  readonly sections?: readonly PromptSection<Tool>[];
  readonly hooks?: readonly HookRegistration[];
  /** Apply where this extension is selected, in order. */
  readonly wraps?: readonly Wrap<Tool>[];
  /** Resolved by name for every task, whichever conversations select this extension. */
  readonly tasks?: readonly AnyTask[];
}

function defineExtension<Tool extends ToolRegistration = ToolRegistration>(extension: Extension<Tool>): Extension<Tool>;
function section<Tool extends ToolRegistration = ToolRegistration>(
  key: string,
  render: PromptSection<Tool>["render"],
  options?: { readonly tag?: boolean },
): PromptSection<Tool>;
function hook<K extends AnyTask>(task: K, handlers: Partial<HooksOf<K>>): HookRegistration;
function wrapTool<Tool extends ToolRegistration>(tool: Tool, wrapper: (tool: Tool) => Tool): Wrap<Tool>;
function wrapSection<Tool extends ToolRegistration = ToolRegistration>(
  key: string,
  wrapper: (section: PromptSection<Tool>) => PromptSection<Tool>,
): Wrap<Tool>;

interface RegistryReader<Tool extends ToolRegistration = ToolRegistration> {
  /** Immutable view of the whole current registry. */
  snapshot(): RegistrySnapshot<Tool>;
  /** Called synchronously after every publication; wakes the scheduler to reconsider blocked tasks. */
  subscribe(listener: () => void): () => void;
}

interface RegistrySnapshot<Tool extends ToolRegistration = ToolRegistration> {
  installed(): readonly Extension<Tool>[];
  extension(name: string): Extension<Tool> | undefined;
  /** Every installed tool with its extension, in install order. Names may repeat across extensions. */
  tools(): readonly { readonly extension: Extension<Tool>; readonly tool: Tool }[];
  sections(): readonly { readonly extension: Extension<Tool>; readonly section: PromptSection<Tool> }[];
  /** Built-in and installed task definitions. */
  tasks(): readonly AnyTask[];
  task(name: string): AnyTask | undefined;
}

interface Registry<Tool extends ToolRegistration = ToolRegistration> extends RegistryReader<Tool> {
  /** Installs `extension`, or replaces the installed extension with its name in place. Publishes at once. */
  install(extension: Extension<Tool>): void;
  /** Removes the installed extension with `extension.name`, whichever object it is. A later install appends. */
  uninstall(extension: Extension): void;
}

function createRegistry<Tool extends ToolRegistration = ToolRegistration>(): Registry<Tool>;
```

`Tool`参数允许应用程序将其工具附加元数据（例如提示片段）并在其部分渲染器中读取。该框架仅依赖`ToolRegistration`；其自身表面（例如`runtime.agent()`）使用默认设置。元数据字段必须是可选的：注册表不会检查它们，并且可以安装默认类型的扩展。派生自工具的Pi-ai声明仅保留pi-ai `Tool`字段（`toToolDeclaration`），因此应用程序元数据永远不会进入转录。

```ts
type CodingAgentTool = ToolRegistration & { readonly promptSnippet?: string };
// The renderer sees CodingAgentTool: no cast needed to read promptSnippet.
export const ToolList = defineExtension<CodingAgentTool>({
  name: "tool-list",
  sections: [section("tools", ({ agent }) => agent.tools.map((tool) => `- ${tool.name}: ${tool.promptSnippet ?? tool.description}`).join("\n") || undefined)],
});
const registry = createRegistry<CodingAgentTool>();
```

规则：

-  第8节的内置任务始终存在且不是扩展的一部分：`tasks()`包含它们，且没有任何内容可以卸载或替换它们。任何扩展都会针对它们注册钩子。
-  工具名称和部分键在一个扩展内是唯一的；跨扩展它们可能会重复。部分键匹配`^[a-z][a-z0-9_-]*$`，且`instructions`键保留用于代理指令（如下）。
-  任务名称在内置任务和每个已安装的扩展中都是唯一的。`install()`在注册表替换后验证注册表，包括上述规则，并在无效时抛出异常而不发布任何内容。`defineExtension()`和`section()`不进行任何检查。
-  发布是同步的，不调用任何扩展回调，并通知订阅者。没有批量操作：扩展是重载的单位，并且再次安装它会将其工具、部分、钩子、包装器和任务在一次发布中替换为其安装位置的内容。
-  扩展、工具和任务定义是不可变的，且包装器是纯函数：包装器返回新对象且永远不会修改其输入。
-  作为选择或包装器目标传递的扩展或工具对象代表其名称：`settings.extensions`持有旧的`Skills`对象会解析为已安装的`skills`扩展。

快照是一个普通的不可变值；不会释放任何内容。调度程序在每个阶段处理程序调用时获取一个快照并通过运行时传递；处理程序和钩子读取该快照且不会获取自己的。在每个正常阶段
边界，调度器会获取一个全新的实例，任务定义的传递方式与第5.4节相同。不同的阶段可能会观察到不同的注册表状态；没有要求一个运行实例在其生成和工具任务的整个生命周期内始终看到单一的注册表状态。

```ts
export const ContextFiles = defineExtension({ name: "context-files", sections: [section("agents-md", renderAgentsMd)] });
export const Skills = defineExtension({ name: "skills", sections: [section("skills", renderSkills)] });
export const Coding = defineExtension({
  name: "coding",
  sections: [
    section("preamble", () => "You are an expert coding assistant.", { tag: false }),
    // The environment the host built for this conversation, in the conversation's directory.
    section("cwd", (input) => input.env && `Working directory: ${input.env.cwd}`),
  ],
});
export const Permissions = defineExtension({
  name: "permissions",
  hooks: [hook(ToolTask, { beforeTool: async (call) => (isDangerous(call) ? { block: "Needs approval" } : undefined) })],
});
// A role and a review loop, for conversations that select it.
export const Reviewer = defineExtension({
  name: "reviewer",
  sections: [section("role", () => "You review diffs. Report problems as a list. Never edit files.")],
  hooks: [hook(GenerationTask, { onYield: requestSecondPass })],
});

const registry = createRegistry();
for (const extension of [CodingTools, Coding, ContextFiles, Skills, Permissions, Reviewer]) registry.install(extension);
const harness = await Harness.open(storage, {
  models,
  registry,
  // Reviewer is installed but not selected by default: only conversations that select it get its role and hooks.
  settings: { extensions: [CodingTools, Coding, ContextFiles, Skills, Permissions] },
  env: ({ cwd }) => localEnv(cwd ?? process.cwd()), // cached NodeExecutionEnv per directory
}, context);
// The conversation remembers its model and directory; a restart elsewhere keeps both.
const root = await harness.root(context, { agent: { model: sonnet, cwd: process.cwd() } });
```

注册表不会跟踪哪些正在运行的工作仍然使用已被替换或未安装的扩展。已经开始的工作会继续使用其已获取的代码，因此，一个在`uninstall()`之后立即释放资源的扩展可能导致仍在运行的调用失败，并返回普通错误结果。需要优雅处置的扩展会自行管理其资源的生命周期，例如通过引用计数。

**解决方法。** 会话的`Agent`会根据其存储的`pi.agent`（缺失字段则全部未设置）、注册表快照和已解析的设置进行解析：

```text
extensions  base = settings.extensions ?? every installed extension; in that order
            array: exactly these, in array order; { add, remove }: base, then add appended, minus remove
            duplicates keep their first position; names not installed are skipped
tools       the selected extensions' tools in extension order; a later same-name tool replaces an earlier one in place
            then every selected extension's tool wrappers, in extension order, then in each extension's order
            then the filter: an array keeps exactly these names in its order, a repeated name at its first position;
            { remove } drops these names
sections    the selected extensions' sections, same-key replacement in place, then their section wrappers,
            then `instructions` when set
hooks       the selected extensions' hooks for the task's name, in extension order
model       stored, else none: the request fails no_model
thinking    stored, else "off"
cwd         stored, else undefined
```

一个会抛出异常或返回名称不同的工具或节的包装器会放弃对该解析的目标：该工具不会被提供，调用它会产生`tool_unavailable`；失败会通过`onReport`报告。一个找不到目标的包装器会什么也不做，因此在没有`bash`的情况下，可能会选择`Timing`。当`instructions`被设置时，`Agent.sections`会以带有标记节`instructions`的文本结束渲染；包装器不会应用于它。

后来的扩展的同名工具会覆盖早期的工具，对于同时选择这两个工具的会话而言，包装器会应用于胜出的工具：

```ts
export const Timing = defineExtension({
  name: "timing",
  wraps: [wrapTool(bashTool, (tool) => ({
    ...tool,
    execute: async (args, api, context) => {
      const start = Date.now();
      try {
        return await tool.execute(args, api, context);
      } finally {
        metrics.record("bash", Date.now() - start);
      }
    },
  }))],
});
// A bash inside a Python virtualenv for one conversation: it replaces CodingTools' bash in place,
// and Timing, if selected, wraps it.
export const Venv = defineExtension({
  name: "venv",
  tools: [createBashTool({ commandPrefix: "source .venv/bin/activate" })],
});
registry.install(Venv); // installed, but not in the default selection
await conversation.configure({ extensions: { add: [Venv] } }, context);
```

**谁解析什么，何时解析。** 每个读取器在每个决策中解析一次：

| 读取器 | 解析内容 | 何时解析 |
|---|---|---|
| 生成`prepare` | 代理（工具、节、模型、思考等级）、流选项、压缩阈值 | 每个请求一次；模型、流选项和提供的工具在请求检查点（第8.3节）时固定 |
| 每个任务阶段 | 扩展选择用于钩子；`runtime.agent()` | 在每个阶段处理器中最多解析一次，首次钩子分发或`agent()`调用时，基于该阶段的快照和已提交的`pi.agent`（Session线上提交），以及调用上下文；其余阶段固定 |
| 工具任务 | 接受调用的实现 | 在 `call` 和 `execute`：在阶段代理的 `tools` 中查找名称，当前工具筛选后的选择；例如，准备后被移除的工具：`tool_unavailable` 不存在。重新打开时的回放策略使用相同的查找（第7.3节） |
| 生成，工具轮次开始时 | 工具执行模式 | 每轮次一次（第8.3节） |
| 生成，压缩 | 重试策略 | 每次尝试的分类 |
| 压缩 `select` | 模型、思考层级、流选项、压缩阈值 | 一次；摘要请求在重试过程中保持固定（第8.7节） |
| 边界和空闲准入，在会话线上 | 队列模式 | 每个边界（第6节） |
| 工具任务，`prepare`，`runtime.env()` | 环境 | 每次调用（第2.2节） |

注册表安装和设置更改不提交，因此不会发出任何内容（第9.4节）。当设置或已安装的扩展更改时，会话的默认选择会发生变化；其下一次准备会追加系统增量（第7.4节）。通过 `Conversation.agent()` 解析工具或模型的用户界面会再次解析。

### 7.2 引用

引用是在任务提交决策前由任务发出的类型化问题。引用由任务定义并带有扩展，由 `hook(task, handlers)`（第7.1节）构建。任务会询问其会话选择的扩展的引用。`hook()` 由任务令牌类型化，但分发与任务名称匹配，因此引用在任务重新加载时仍能存活；保持引用签名在不同任务版本间兼容是任务作者的责任。引用按扩展顺序执行；在消费提交前发生崩溃可能会重新运行它们。中止错误始终传播。

| 引用 | 组成 | 普通抛出 |
|---|---|---|
| `beforeRequest` | 替换链 | 报告，继续 |
| `afterResponse` | 所有观察者 | 报告，继续 |
| `onYield` | 首个延续胜出 | 报告，继续 |
| `beforeTool` | 参数替换链；首个块胜出 | 阻塞工具并附带错误文本 |
| `afterTool` | 结果替换链 | 报告，继续 |
| `afterTools` | 所有观察者 | 报告，继续 |
| `beforeCompact` | 首个决策胜出 | 报告，继续 |

引用使用任务备忘录进行持久化且遵循首次写入胜出的决策。没有公共语义事件通道；当前用户界面状态是文档状态。

```ts
type HookResult<T> = T | undefined | Promise<T | undefined>;

/** What a hook may use: committed reads and the asking task's memos. */
interface HookApi extends DocumentReader {
  readonly taskId: TaskId;
  readonly conversationId: ConversationId;
  memo<T extends JsonValue>(name: string, context: Context): Promise<T | undefined>;
  memo<T extends JsonValue>(name: string, candidate: T, context: Context): Promise<T>;
}

interface GenerationHooks {
  /** Before every request attempt, including recovery; the result is used for that request only. */
  beforeRequest(
    request: { readonly messages: readonly Message[] },
    api: HookApi,
    context: Context,
  ): HookResult<{ readonly messages: readonly Message[] }>;
  /** Every terminal provider message, before classification. */
  afterResponse(message: AssistantMessage, api: HookApi, context: Context): void | Promise<void>;
  /** A final answer; `continue` appends a user message and continues the run. */
  onYield(answer: AssistantMessage, api: HookApi, context: Context): HookResult<{ readonly continue: UserInput }>;
  /** After every tool of the round is terminal; `results` are the round's result entries in call order. */
  afterTools(assistant: EntryId, results: readonly EntryId[], api: HookApi, context: Context): void | Promise<void>;
}

interface ToolHooks {
  /** Before intent; replaces the arguments or blocks the call with error text. */
  beforeTool(
    call: ToolCall,
    api: HookApi,
    context: Context,
  ): HookResult<{ readonly arguments?: JsonObject; readonly block?: string }>;
  /** After execution, before the result entry; replaces the result. */
  afterTool(
    call: ToolCall,
    result: ToolExecutionResult,
    api: HookApi,
    context: Context,
  ): HookResult<ToolExecutionResult>;
}

interface CompactionHooks {
  /**
   * After range selection, before summarizing; the first decision wins. `entries` are the active entries the summary
   * replaces, the head marker first, and `messages` their model context, the summarizer's source; `firstKept` is the
   * first entry kept verbatim.
   */
  beforeCompact(
    compaction: {
      readonly reason: CompactionReason;
      readonly entries: readonly EntryRecord[];
      readonly messages: readonly Message[];
      readonly firstKept: EntryId;
      readonly instructions?: string;
    },
    api: HookApi,
    context: Context,
  ): HookResult<{ readonly decline: true } | { readonly summary: string }>;
}
```
  
`GenerationTask`、`ToolTask` 和 `CompactionTask` 是导出的内置任务令牌，其 `H` 参数是这些接口。`runtime.hooks.each(name, invoke)` calls `invoke` with every handler under `name` 是阶段解析的引用：那些由任务会话选择的扩展的引用，按任务名称和扩展顺序（第7.1节）。来自 `invoke` 的普通抛出通过 `onReport` 和 `each` 报告并继续到下一个处理程序；一旦调用被触发，错误会传播。任务以不同方式组合（如 `beforeTool` 将抛出转换为阻塞，或在首个决策后停止）则在自己的 `invoke` 内部完成。引用接收任务的运行时作为 `HookApi`；引用备忘录和任务自身的备忘录共享一个命名空间，因此引用作者需为备忘录名称添加前缀。

选择决定会话的行为；扩展自身的文档保存该行为的状态：

```ts
const PlanModeDoc = defineDoc<{ enabled: boolean }>({
  kind: "app.plan-mode", version: 1, scope: "conversation", history: "latest", fork: "current",
  initial: () => ({ enabled: false }),
});
export const PlanMode = defineExtension({
  name: "plan-mode",
  hooks: [hook(ToolTask, {
    // An absent document means plan mode is off.
    beforeTool: async (call, api, context) =>
      (await api.snapshot(PlanModeDoc, api.conversationId, context))?.enabled && writes(call)
        ? { block: "Plan mode: read-only" }
        : undefined,
  })],
});
// PlanMode is in the default selection; /plan toggles this conversation's state.
await root.commit(async (tx) => {
  (await tx.doc(PlanModeDoc, root.id)).enabled = true;
}, context);
```
  
### 7.3 工具

```ts
type ToolControl = {
  readonly addTools?: readonly string[];
  readonly terminate?: true;
  readonly handoff?: string;
};

/** Remark about a call for the model and the UI; never part of the tool's data. */
type ToolDiagnostic = {
  readonly severity: "info" | "warn" | "error";
  readonly message: string;
  readonly code?: string;
};

type ToolExecutionResult<TDetails extends JsonValue = JsonValue> = {
  readonly content?: ToolResultMessage["content"];
  readonly isError?: boolean;
  readonly details?: TDetails;
  readonly diagnostics?: readonly ToolDiagnostic[];
  /** Spend of the execution itself, such as a model call; stored on the result and in `pi.usage.tools`. */
  readonly usage?: Usage;
  readonly control?: ToolControl;
};

interface ConversationHandle {
  readonly id: ConversationId;
  submit(submission: InputSubmissionDraft, context: Context): Promise<Submission>;
  abort(context: Context): Promise<void>;
  waitForIdle(context: Context): Promise<void>;
}

interface ToolExecutionApi<TDetails extends JsonValue = JsonValue> extends DocumentObserver, DocumentReader {
  readonly taskId: TaskId;
  readonly conversationId: ConversationId;
  readonly callId: string;
  /** The tool task's phase snapshot. */
  readonly registry: RegistrySnapshot;
  /** The calling conversation's agent, as the tool task's phase resolved it. */
  agent(context: Context): Promise<Agent>;
  /** Built by `HarnessOptions.env` for this call. */
  readonly env: ExecutionEnv | undefined;
  output(chunk: string | Uint8Array): void;
  diagnostic(diagnostic: ToolDiagnostic): void;
  details(value: TDetails, context: Context): Promise<void>;
  commit<T>(change: (tx: Tx) => T | Promise<T>, context: Context): Promise<T>;
  memo<T extends JsonValue>(name: string, context: Context): Promise<T | undefined>;
  memo<T extends JsonValue>(name: string, candidate: T, context: Context): Promise<T>;
  createTask<I, S extends { phase: string }, R, H extends object>(
    task: Task<I, S, R, H>,
    input: I,
    options: Omit<TaskOptions, "conversationId">,
    context: Context,
  ): Promise<TaskId<R>>;
  getTask<R>(id: TaskId<R>, context: Context): Promise<TaskRecord<JsonValue, JsonValue, R> | undefined>;
  waitForTask<R>(id: TaskId<R>, context: Context): Promise<SettledTask<R>>;
  conversation(id: ConversationId, context: Context): Promise<ConversationHandle | undefined>;
}

type ToolRegistration<TParameters extends TSchema = TSchema, TDetails extends JsonValue = JsonValue> =
  Tool<TParameters> & {
  readonly replay?: "safe" | "unsafe";
  readonly executionMode?: ToolExecutionMode;
  /** Pure repair of commonly malformed arguments; runs before validation, which still checks its result. */
  prepareArguments?(args: unknown): Static<TParameters>;
  readonly outputLimits?: {
    readonly maxBytes?: number;
    readonly maxLines?: number;
    readonly retain?: "head" | "tail";
  };
  execute(
    args: Static<TParameters>,
    api: ToolExecutionApi<TDetails>,
    context: Context,
  ): Promise<ToolExecutionResult<TDetails>>;
};

/** Identity function that infers `TParameters` from `parameters` and `TDetails` from the reported details. */
function defineTool<TParameters extends TSchema, TDetails extends JsonValue = JsonValue>(
  tool: ToolRegistration<TParameters, TDetails>,
): ToolRegistration<TParameters, TDetails>;
```
  
`execute()` 接收 `args` 类型的 `parameters`：控制台会验证调用参数是否符合该模式后再运行。`defineTool()` 使内联工具字面量推断其类型，如 `tools: [defineTool({ ... })]` 所示。`execute` 是方法，因此不同类型的工具共享一个 `tools` 数组。

省略的 `replay` 是 `unsafe`。省略的 `outputLimits` 是 50 KiB、2000 行和 `retain: "head"`。省略的 `executionMode` 遵循设置的 `toolExecution`；一次 `sequential` 调用使其整个轮次顺序执行（第8.3节）。

工具只能通过 `api.env` 访问文件和进程，绝不会通过构建工具时捕获的环境。工具任务为每次调用使用 `HarnessOptions.env`（来自会话 ID 和 `cwd`，第2.2节），因此会话的目录或沙箱无需包装。来自
`env` 变成一个普通的错误结果。恢复后重新运行会获取到当时的环境。`api` 是一个普通的对象，因此包装器可以展开它。需要环境但未收到环境的工具会抛出异常，产生一个普通的错误结果。

运行中的工具会将输出和细节报告给 UI，反映其最终结果的两个部分，以及诊断信息（如下）：

- `output(chunk)` 会追加运行时的文本输出，类似于 stdout。如果 `execute()` 省略了 `content`，则最终保留的输出会变成一个文本内容项；没有输出则为空的内容列表。保留的输出是流中完整行的精确切片（对于 `head` 是首行，对于 `tail` 是末行），包含尾随的换行符；如果单行长度超过 `maxBytes`，则会在字符边界处按字节限制截断。除了制表符和换行符之外的控制字符会被从保留文本中移除；接受一个数据块不会对每个数据块进行单独的清理。

- `details(value)` 会用一个完整的 JSON 值替换运行时的细节，不会合并键。如果 `execute()` 省略了 `details`，则最后一个值会成为最终的 `details`，因此渲染器会处理从第一次更新到最终结果的细节形状。

工具运行时都不会将这些内容发送到模型中。`output()` 同步地将 UTF-8 输出接受到该调用拥有的有界缓冲区中，并在调用结束时抛出异常。节流提交会发布保留的输出、丢弃的字节数/行数，以及当前的细节和诊断信息，存储在它的 `pi.live.tools` 位置。节流是自适应的，类似于环境的 shell 输出捕获：空闲期后的第一次变更会立即提交；每次提交则至少延迟 `settings.progress.outputIntervalMs`（默认 100 毫秒）以及按 100 KiB/s 的写入量延迟，因此大规模重写会获得成比例更长的暂停。延迟期间的变更会合并到下一次提交中。节流是 Harness 策略，不属于 `outputLimits`，后者只限制保留的内容。显式的文本内容在显式的结果内容中会受到与转录持久化前相同的限制；非文本内容会按照其 pi-ai 类型声明进行保留。当限制导致文本被丢弃时，Harness 会添加一个 `warn` 诊断，代码为 `truncated`，说明丢弃的行和字节数。

诊断信息是一个通道，不是文本。关于调用的备注，例如截断的输出、溢出路径、已修正的路径、磁盘上已更改的文件或已限制的搜索，会通过 `api.diagnostic()` 或 `ToolExecutionResult.diagnostics` 传递，永远不会进入模型作为工具数据的文本内容中。Harness 会添加它拥有的诊断，工具只会添加它单独知道的内容。每个诊断信息对模型都是可见的；仅对 UI 有用的信息应放入 `details`。`diagnostic()` 同步地将诊断记录在工具的槽中，并在节流提交后抛出异常。结算时，结果的诊断信息是通过 `api` 记录的，然后是结果中的诊断信息，最后是 Harness 的诊断信息。如果有任何诊断信息，结果内容会以一个文本项结束：

```text
<harness>
[warn] output truncated: 51,204 lines, 2,301,112 bytes dropped
</harness>
```


每个诊断信息对应一个 `[severity] message` 行，`pi.tool-result` 会存储结构化列表（可能为空），作为 `data: { diagnostics }`（见 8.1 节）。存储的消息正是模型看到的内容，而 UI 和代码则读取列表。`warn` 诊断不会设置 `isError`。

`output()` 从不会将完整的输出溢出到文件，因为溢出需要文件系统，该文件系统可能是远程的或不可用的。必须保留完整输出的工具会通过 `ExecutionEnv` 或 `FileSystem` 溢出，并在诊断中报告结果路径，以及在渲染器需要时在细节中报告。环境的 shell 流会将原始输出块传递给工具，并在字节或行数阈值超过时将完整输出溢出到文件；它不会保留自己的有界视图，因此 `output()` 是唯一限制输出的地方，输出会被限制、清理并节流。`bash` 工具会将这些块传递给 `output()`，并将溢出路径作为诊断报告，且在非零退出或超时时抛出异常；错误结果仍然携带保留的输出和诊断信息。

在一个输出通过慢速链路移动的环境中（例如另一个主机上的环境），并不需要移动所有的输出。`api.outputWindow` 命名尾部为尾部保留
调用会保留其进度提交的速率；`bash`工具将其视为`ShellExecOptions.window`。环境随后可能会省略输出，并在后续片段中将省略情况报告为`info.skipped`：已解码字节数、换行数，以及省略的文本是否以换行符结尾。它可能仅省略超过窗口的输出，至少以一个字节或一行计，将所有后续输出合并到同一片段中，因此省略的文本永远不会成为保留的尾部，任何进度提交都不会看到间隙。`output(chunk, skipped)`会将省略情况计入丢弃计数，因此保留的尾部、丢弃计数和`truncated`诊断与每个字节都已到达时相同；仅是采样进度的时刻不同。环境应以不超过该速率交付，因为进度提交采样不会更快。保留头部的调用没有窗口。替换`output`以转换文本的包装器将`outputWindow`转换为`undefined`，因此不会省略的文本绕过其转换。

`exec`接受字符串或argv数组。字符串会通过环境的shell运行。数组则直接运行其第一个元素，其余作为参数，不使用shell，因此主机从数据（如文件名）构建命令时，不会为特定shell对它进行引号处理。每个`onOutput`片段会命名其来源流；`bash`工具会忽略它，而需要将stdout和stderr分开收集的主机则会分别收集它们，自行界定，收集到足够内容后中止调用。`openBinaryReader`打开一个常规文件进行位置读取，因此主机读取有界定范围的内容而不是整个文件，并且每次读取都能看到其打开的文件，即使路径被重命名；`noFollow`拒绝将符号链接作为最终路径组件。其`scanLines`会在环境内对文件进行一次遍历，报告换行数、行跨度的字节范围以及该跨度及其第一行的解码大小，因此调用方可以在不移动文件的情况下计数和定位行。`openDirReader`按文件系统顺序分页目录，仅读取其返回条目的元数据，跳过同时被移除的条目。所有操作在
它们的上下文被中止，且仅该调用的工作停止：超时或中止仅会终止该命令的进程。`cleanup()`会终止环境仍在运行且属于其所有者关闭流程的每一个命令，而非仅针对单一请求。`watch`会报告加载资源（如指令或技能）的主机对文件和目录的变更；Durable本身不会调用它。目标可能缺失，创建它即视为变更；递归目标会覆盖其子树（除排除项外），且不会跟随其下方的符号链接。当`watch`解析完成时，覆盖范围即建立，因此在加载前监控的主机不会因加载期间的变更而丢失。变更以报告路径的形式到达（每个覆盖其子树；调用可能为虚假触发），表现为`overflow`（覆盖范围曾不确定，需重新扫描全部内容），或最终的`error`。`native`监视器会在约两秒内报告变更；`polling`则通过快照对比，因为其文件系统（如网络或FUSE文件系统）无法报告其他位置的变更，可能错过两次快照间被撤销的变更。`NodeExecutionEnv`仅使用事件触发重新扫描并报告快照间的差异，因此无论平台发送何种事件，替换文件、重命名父目录及随内容创建的目录都会被报告。环境受信任，非隔离边界：在打开前检查规范路径并不能防止并发重命名或符号链接交换，因此限制路径的调用仅为卫生考虑，而非安全。

`details()`承诺在对应或合并的文档提交后解析完成。在正常结算过程中，工具任务会停止限流并等待飞行中的提交；最终的终端提交（追加结果条目）即为最终刷新，会结算所有仍在等待的`details()`承诺。中止和关闭需遵守调用及会话准入门禁：未提交的缓冲更新可能被丢弃，而准入的提交则会完成结算。取消、回调、准备跟踪器及检查点失败均发生在存储准入之前，不会
污染会话。致命的会话规则之后，不确定的存储故障随之发生。

工具带有扩展（第7.1节），并具有名称、描述、JSON模式、重播策略和执行函数。`wrapTool(tool, wrapper)`装饰工具而不替换它。每个解析将该名称的胜出工具与所选扩展的包装器（第7.1节）组合；包装器永远不会捕获基础，因此重新加载基础会保留其包装器。复合提供声明、参数验证、重播策略和执行。

只有在请求提供了该工具的情况下，工具调用才被接受。生成会将此与通过请求的`cutoff`从提交的模型上下文中重播的工具集进行检查；`beforeRequest`替换不会改变它。它会用第2.2节中描述的`tool_unavailable`结果响应一个未提供工具的调用，且没有工具任务。准备后代理变更不会影响此检查（第2.2节）。工具任务在该阶段代理解析的`tools`中解析被调用的名称，应用工具过滤器。它使用该实现直到执行结束：一个阶段处理器解析、验证、运行
`beforeTool`，记录意图，执行并提交结果，因此不存在将解析与结算分隔的阶段边界。例如，名称未解析，可能是因为其扩展名被卸载或取消选择，或者工具过滤器在请求准备后将其丢弃，将产生 `tool_unavailable`。
实现的 `prepareArguments`（如有），首先会修复调用的参数，例如将 `edits` 作为 JSON 字符串发送；存储的调用会保留模型发送的内容。参数会在 `beforeTool` 之前和之后，根据已解析实现的模式进行验证；如果验证失败，或抛出修复操作，将产生 `invalid_arguments` 错误结果。

经过钩子和验证后，工具任务会持久化记录最终参数和已解析的回放策略，然后执行。恢复操作不会重新运行 `beforeTool`，并将相同的存储参数传递给 `execute()`。一个回放安全的工具可以根据这些参数重建提交内容（当该转换为纯函数时）。随机值、时间戳、可变文档/配置读取或其他派生
必须保持稳定的输入首先被记录在持久化的备忘、检查点或任务输入中。一个后台报告任务会接收其自身持久化输入中的最终消息，以便能够独立完成。恢复机制不会让已更改的注册表声明去修改已存储的重播策略。

工具获取的对话句柄仅接受输入提交；工具使用普通的事务写入来处理被动条目。

工具在一个持久化任务中执行。它可能：

- 发布有界运行输出和详细信息到其`pi.live.tools`槽位；
- 提交备忘；
- 创建并等待任务；
- 原子地创建或分叉明确拥有的对话，通过`commit()`；
- 观察其拥有令牌/引用的文档；
- 通过`commit()`对授权文档进行变异；
- 返回有界模型内容和独立的诊断细节。

工具操作使用调用任务的准入和调用生命周期门禁。任务创建默认使用该任务的对话。可信文档和对话访问遵循第3.3节和第9.2节；没有额外的子树
授权层。拥有全局会话类型的ID足以在可信代码中使用。

工具没有会话创建的便捷方法。它们在`commit()`内部创建或分叉会话，明确声明其所有权，原子地安排任何相关文档/任务写入，并仅接收惰性记录。在提交完成后，`conversation(id)`获得一个与调用绑定的操作句柄，用于提交、显式中止和空闲等待，而不会改变所有权。提交回调函数不得调用`conversation()`或使用之前获取的句柄：在变更线被持有期间，禁止嵌套会话操作和外部影响。句柄的操作在调用结束后被拒绝。由`submit()`返回的`Submission`以相同方式与调用绑定；这些方法拒绝后，允许提交的记录保持持久性。与调用绑定的文档监视在调用结束后停止。

一个前台子代理会话明确由其工具任务拥有。
交易会创建或分叉子节点；所有者边是其持久化记录，因此安全回放的重试会先找到`scanConversations({ ownerTaskId })`子节点，然后再创建。结算后，工具重新获取子节点，提交时请求ID由其任务ID派生，重试会保留该ID，并等待提交结果。提供方调用ID在会话内不唯一，不得用作请求ID。终止或异常终止工具任务会级联影响其拥有范围。工具会在运行详情中报告子节点，例如`api.details({ conversationId })`，这样看到该调用的UI可以关联子节点的视图或事件。

```ts
export const Subagent = defineExtension({
  name: "subagent",
  tools: [defineTool({
    name: "subagent",
    description: "Delegate a self-contained task to a subagent and get its answer back.",
    parameters: Type.Object({ task: Type.String() }),
    replay: "safe",
    execute: async (args, api, context) => {
      const { task } = args;
      const child = await api.commit(async (tx) => {
        const existing = (await tx.scanConversations({ ownerTaskId: api.taskId }, 1)).items[0];
        if (existing !== undefined) return existing.id;
        // Starts as a copy of this conversation's agent: model, thinking level, cwd, extensions, tools.
        const created = await tx.createConversation({ ownership: { kind: "task", taskId: api.taskId } });
        // Without this extension, the child is not offered this tool.
        await configure(tx, created.id, { extensions: { remove: [Subagent] } });
        return created.id;
      }, context);
      await api.details({ conversationId: child }, context);
      const handle = (await api.conversation(child, context))!;
      const request = { type: "input", content: task, requestId: `subagent:${api.taskId}` } as const;
      const settled = await (await handle.submit(request, context)).wait(context);
      if (settled.status !== "done" || settled.type !== "input") throw new Error(`Subagent failed: ${settled.status}`);
      return { content: [{ type: "text", text: await answerText(api, settled.answer, context) }] };
    },
  })],
});
```

`{ remove: [Subagent] }`编辑主机默认选择（第2.2节）。此处主对话保持其选择未设置，因此其选择也未设置。任何存储了选择的父节点（数组或`{ add, remove }`对象），会在提交前根据`(await api.agent(context)).extensions`计算子节点的数组。

持久化后台子代理会超出父节点的生命周期，可后续被消息传递、引导、停止和列出。一个交易（在应用注册文档中通过子代理名称去重后），会在父节点创建一个背景对话拥有的锚定任务`A`，一个由`A`拥有的子对话`C`，以及从名称映射到`C`的注册表映射。`A`立即完成；它持有`completing`，而`C`执行普通工作（第5.5节），然后保持终止状态。其记录保持`background`，因此父节点的普通中止和空闲遍历会停止于此，而`Conversation.abort(context, { background: true })`仍可通过它达到`C`的工作，`Harness.waitForIdle()`不会等待它。后续运行`C`是`C`的普通工作；终止的所有者不会级联。

每个发往子代理的消息，由父节点背景对话拥有的报告任务传递，该任务在工具交易中创建，并以工具任务ID索引，确保调用重试不会创建另一个。报告任务向`C`提交，请求ID由其自身任务ID派生，等待提交结算后，将答案作为输入以`whenBusy: "followUp"`形式发给父节点，使用另一个由其
任务ID。在任一重试之前发生崩溃；在任一重试之后发生崩溃则返回现有的`Submission`，因此子进程收到一次消息，父进程收到一次答案。因此报告者无需事务级准入；`tx.createSubmission()`直接写入原始记录，不遵循准入规则。应用程序的名称文档使用`fork: "initial"`，以便父进程的分支不会继承它。用户界面从该文档中列出子代理；当子进程的`pi.live.run`被设置时，它正在工作。仅凭所有者边即可驱动回滚和空闲遍历。锚点和报告者任务定义随子代理扩展一起提供，因此待处理报告者在主机再次安装后可恢复运行：

```ts
export const SubagentTools = defineExtension({ name: "subagent-tools", tasks: [Anchor, Reporter], tools: [subagentTool] });

// In subagentTool's spawn commit, after the name checks:
const anchor = await tx.createTask(Anchor, null, { ownership: { kind: "conversation" }, background: true });
// Owned by a task of the parent: starts as a copy of the parent's agent.
const child = await tx.createConversation({ ownership: { kind: "task", taskId: anchor } });
await configure(tx, child.id, {
  extensions: { remove: [SubagentTools] },
  instructions: `You are the subagent "${name}". Answer the main agent's requests.`,
});
```

工具结果可能请求`addTools`、`terminate`或`handoff`。生成的`tools`阶段（第8.5节）将命名工具添加到对话存储工具过滤器中；它们在下一次准备时生效。轮询仅在每一轮结果都请求`terminate`时终止，如同pi代理循环；`tools`阶段随后使用最终边界。任何`handoff`在轮询中，最后一个按调用顺序请求的，以相同方式结束运行，同时追加一个`pi.reset`条目，其中包含`head: "self"`和作为用户消息的手册文本（第8.1节），这正是`reset(handoff)`所写的内容。

结果的`usage`存储在工具结果消息中，并在结果提交时添加到对话的`pi.usage.tools[toolName]`中（第8.6节）。运行拥有对话的工具不得再次报告该对话的花费：子进程自身的`pi.usage`已将其计入（第12节）。

重新打开时，工具仅在存储的意图策略和当前声明（解析为`call`）都为`safe`时才会重新运行。当前`unsafe`声明可能拒绝存储安全重播；当前安全声明永远不会升级存储的不安全内容。不再解析的工具被视为`unsafe`。其他所有孤儿效应都会产生一个包含持久部分输出的中断结果。已完成、失败和中止的工具终端结果
保留其工具结果条目 ID 以供生成的 `tools` 阶段使用。

错误结果是 Harness 自己设置 `isError` 并携带一个 `error` 诊断，诊断代码之一为 `tool_unavailable`、`invalid_arguments`、`blocked`、`interrupted`、`aborted` 或 `tool_error`（来自 `execute()` 的异常）以及错误文本作为其消息。其内容是持久的部分输出（如果有），`details` 是工具最后报告的值（如果有）。

`@earendil-works/pi-durable/tools` 提供 `read`、`write`、`edit` 和 `bash` 工厂，这些工厂是从代理 Harness 工具移植而来的，并且 `CodingTools` 扩展包含了所有四个。它们仅使用 `api.env`；没有任何内容会自动安装它们。`read` 目前还不返回图像。它通过 `openBinaryReader` 读取文件：图像检测读取了头部（以及 PNG 的块头部），`scanLines` 计数并定位了所选行，仅读取和解码了显示的头部，因此其成本和传输受输出限制以及文件内一次遍历环境的约束。其结果与解码整个文件、将其拆分为行、
截断选择。文件在读取时发生变化，则会再次读取一次，然后失败。`edit`和`write`将它们对单个文件的读取-修改-写入操作序列化在进程内，以环境的`FileSystem.id`（等ID看到相同的文件路径）和规范路径为键，因此两个使用新鲜环境对象的调用仍然排队，而其他文件和文件系统永远不会等待。这并不是针对`bash`或其他进程的锁。

### 7.4 系统提示和动态工具

Pico没有持久化的提示部分。对话的解决代理为每个请求生成所需的部分；转录的`pi.system`条目是模型所见内容的唯一持久记录。Pico直接将提示和工具的更改存储为PR #9548 `SystemMessage`值，始终带有空的`content`：

```ts
type SystemEntry = EntryRecord & {
  readonly kind: "pi.system";
  readonly model: readonly [SystemMessage];
};

const baseline: SystemMessage = {
  role: "system",
  content: "",
  sections: { preamble: renderedPreamble, cwd: renderedCwd },
  toolsAdded: allEffectiveTools,
  timestamp: now,
};

const delta: SystemMessage = {
  role: "system",
  content: "",
  sections: { cwd: nextRenderedCwd, legacy: null },
  toolsRemoved: [{ name: "read" }],
  toolsAdded: [nextRead],
  timestamp: now,
};
```

生成准备针对其阶段快照执行以下步骤：

1. 解析对话的代理（第7.1节）并重播活动
2. 所需工具是代理的`tools`，按顺序排列。  
3. 使用`HarnessOptions.env`（第2.2节）构建环境，并按顺序使用`PromptInput`渲染代理的`sections`：对话、代理、环境、展示部分和一个`DocumentReader`（任务运行时）用于已承诺的文档。结果是所需的部分。  
4. 将所需部分和工具声明与回放状态进行比较，若存在差异，则追加一个位置参数`pi.system`条目。

准备阶段不会重新检查转录内容后再追加：只有框架通过提交、运行任务、边界和阻塞式压缩向繁忙的对话写入内容（仅在生成过程中等待时追加，见第8.7节），因此读取的转录内容仍然是当前有效的（见第12节）。

模型和思维层级是请求选项，而非提示状态。

所选扩展部分和代理的`instructions`是提示文本的唯一来源，没有单独的构建器。`section(key, render, { tag })` builds a section, and `wrapSection(key, wrapper)`装饰一个部分，按解析结果（如工具包装器）组合。部分按代理顺序渲染：扩展顺序，同键后续扩展部分会就地替换先前部分，最后是`instructions`（见第7.1节）。若`render`返回`undefined`，则该部分被省略。若`tag`被省略或为true，则文本按`<key>\n...\n</key>`格式包裹。若部分抛出异常，则保留其展示文本（如有），并进行报告；请求仍会被发送。生成调用被取消后抛出的异常会传播；部分自身异常（如超时获取）被视为普通失败。若无部分，则所需部分集为空。

一个最简提示是一个未标记的部分：

```ts
const Chat = defineExtension({
  name: "chat",
  sections: [section("preamble", () => "You are a helpful assistant.", { tag: false })],
});
registry.install(Chat);
```
  
对话的提示会随其扩展选择、`instructions`、`input.env`和`input.read`而变化。不应看到技能的子代理不会选择技能扩展，且cwd部分会渲染。
`input.env.cwd`; 没有检查该部分是否在子代理中运行。

渲染器必须对相同的输入具有确定性：如果渲染的文本发生任何变化，例如嵌入时间戳，会附加系统时间偏移并使提供程序的提示缓存失效。

回放按转录顺序应用消息。非空的 `content` 会追加指令。字符串部分会添加或替换该名称，而不会移动现有部分；`null` 会移除它，稍后重新添加时会将其追加到有序部分映射中。在单条消息内，工具移除操作会在添加操作之前执行，因此同名替换会获得新的声明和位置。

准备阶段会比较两个值及其顺序。如果可以在不改变顺序的前提下进行补丁，则会发出最小补丁。如果显示的顺序和期望的顺序不同，会提交两条 `pi.system` 记录：第一条使用 `null` 移除所有显示的部分，第二条按期望顺序重新添加所有期望的部分。这样可以确保仅涉及顺序的更改以及请求之间的删除/添加操作能够精确回放；单纯重述相等值是不够的。

PR #9548 `SystemMessage` 始终是一个补丁，而不是重置：它不能移除之前的 `content`，也不能单纯通过重述当前值来恢复部分顺序。因此，当头部移除了先前可见的基准线（即活动上下文带有头部标记且该标记之后未追加 `pi.system` 记录，即其ID更高），新的 `pi.system` 记录会为每个仍被保留的早期 `pi.system` 记录添加 `ContextEdit` 省略项。其消息本身则是一个完整的基准线，包含所有期望的部分及其顺序和所有有效的工具声明。模型上下文回放会看到新的基准线，而不是被省略的保留偏移量。即使重述了回放的值，准备阶段也会写入该基准线，确保每个后续准备阶段都能找到 `pi.system` 记录位于标记之后。头部重基准线优先于普通顺序/值补丁。如果没有头部裁剪，顺序不匹配则使用上述两条记录的移除/添加序列；只有在顺序已经匹配时，准备阶段才会发出最小更改值和 `null` 移除记录。

工具更改单独计划，并基于最后一个计划条目或在部分不变时基于自己的条目进行。声明会与 pi-ai `declarationsEqual()` 进行比较并以 `toToolDeclaration()` 形式写入，因此应用元数据永远不会进入转录。更改后的声明会在同一消息中被移除并重新添加。回放会保留已保留的工具并在其后追加新增工具；如果这样无法得到期望顺序，则消息会移除所有提供的工具并按顺序重新添加期望工具。头部重基准线会添加所有期望工具。

存储在历史 `SystemMessage.sections` 中的渲染字符串即使当前渲染器发生变化也保持权威性。pi-ai 会决定是否将消息按位置发送给有能力的提供程序或将它们折叠到一个引导系统消息中；Pico 不会为其存储的转录内容重写以兼容提供程序。

###  7.5 扩展重新加载

通过注册表在进程中重新加载扩展代码。主机会在安装名称下安装新的扩展对象，替换旧对象，一次发布完成。运行时保持不变；无需关闭或重新打开。

```ts
registry.install(SkillsV2); // same name: conversations selecting skills render v2 at their next request
registry.uninstall(Skills); // selecting conversations get a system delta removing its section; nothing is rewritten
// Restart: the host installs its extensions again; stored names resolve against them.
```

-  新阶段调用和工具任务会立即使用新扩展；正在运行的调用会在其下一个阶段边界看到它。
-  已经运行的工作会保留其快照直到其阶段处理器稳定，且固定工具会保留其实现直到其执行稳定。替换操作不会发出信号或中断它。旧代码使用的资源由扩展负责（见第7.1节）。
-  以名称替换的任务定义会在其下一个正常阶段边界移交（见第5.4节）。任务定义必须在持久化输入或检查点状态的含义发生变化时增加其版本，并迁移支持的旧状态；迁移失败会阻塞任务而非终止任务。
-  被替换的扩展会保留其安装位置，因此重新加载不会移动其钩子、工具和部分相对于其他扩展的位置；在扩展内部，新对象的顺序适用。将任务定义从一个扩展移动到
另一个在两次安装之间留下一个间隙，其待处理任务被阻塞。

- 文档定义被显式传递给类型化访问，无需注册；更改的令牌在其下一次访问时生效。

如果旧扩展代码忽略取消且从未完成，新工作已经使用了替换方案。Harness关闭仍然会加入每次调用。强制终止任意非合作的JavaScript需要工作/进程隔离；该主机终止进程并从持久状态重新打开Session。旧的和新的Harness实例绝不能同时拥有同一个Session：打开新的一个
在旧版本的`close()`解决后，当其调用代码不再运行时（第2.2节）。

## 8. 内置任务

初始实现提供：

| 类型 | 职责 |
|---|---|
| `pi.generation` | 准备系统提示和工具，请求或轮询模型，重试，分类响应 |
| `pi.tool` | 验证、挂钩、执行，持久化输出和细节，追加结果 |
| `pi.compaction` | 选择一段转录内容，总结，放置带标题的摘要 |
生成过程使用 `HarnessOptions.models`，不带 Pico 特定的模型适配器。它解析 `models.getModel(ref.provider, ref.modelId)`，根据准备好的提示/消息/工具构建 pi-ai `Context`，并携带任务调用的中止信号、代理的思考等级和设置的流选项调用 `models.streamSimple()`。延迟继续调用 `models.fetchDeferred()` 和 `models.cancelDeferred()`，使用相同的模型和信号。缺失的模型和同步/流式 pi-ai 错误被归类到持久生成结果中。

生成和工具进度通过持久文档提交进行节流。崩溃可能导致仅丢失未提交的节流窗口。恢复过程将已提交的部分转换为正常的中断/中止转录条目，清除呈现状态，然后根据任务阶段重试或终止。重试截止时间、尝试次数、压缩和工具进度是当前文档状态，供晚加入者参考；已完成尝试的使用/会计信息是条目或终端细节。截断和溢出路径是工具诊断（第7.3节）。

压缩通过追加带有头部的摘要条目更改模型上下文。
不删除转录历史。

### 8.1 内置条目

内置条目种类不携带 `data`，除了 `pi.tool-result`，其令牌为 `Entry<{ diagnostics: ToolDiagnostic[] }>`；每个工具结果携带 `data`，当其没有诊断时携带空列表（第7.3节），以及 `pi.compaction`，其令牌为 `Entry<{ reason: CompactionReason }>`。每种类别均以 `Entry` 令牌导出。

| 类型 | `model` | 由谁编写 |
|---|---|---|
| `pi.user` | `[UserMessage]`，从入站或放置时 Harness 时钟的时间戳 | 提交，`onYield` 继续 |
| `pi.assistant` | `[AssistantMessage]` 带有任何终止原因 | 生成 |
| `pi.system` | `[SystemMessage]` 带有 `content: ""`（第7.4节） | 生成准备 |
| `pi.tool-result` | `[ToolResultMessage]` | 工具任务；生成未在请求中提供工具调用的调用 |
| `pi.reset` | 不存在，或 `[UserMessage]` 带有移交文本；始终为 `head: "self"` | `reset()`，生成 `tools` 阶段用于 `handoff` |
| `pi.compaction` | `[UserMessage]` 带有包裹摘要；`head` 是第一个保留条目 | 压缩任务（第8.7节） |

每个生成响应均成为 `pi.assistant` 条目：答案、失败尝试及其错误文本和使用情况，以及转换后的部分条目带终止原因 `aborted`。上下文推导（第2.1节，规则9）将失败和中止消息排除在后续请求之外，因此不存在单独的使用或通知种类。

### 8.2 实时文档

```ts
type LiveState = {
  /** Run control (section 6); present exactly while the conversation is busy. */
  run?: { taskId: TaskId; inputs: SubmissionId[] };
  /** Presentation of the current generation attempt. */
  generation?: {
    attempt: number;
    /** Committed throttled partial of the in-flight response. */
    message?: JsonRepresentation<AssistantMessage>;
    /** Durable backoff before the next attempt. */
    retry?: { at: number; error: string };
    /** Provider-side deferred response being polled. */
    deferred?: { pollAt: number };
  };
  /** The current tool round in call order, from the tool-calling answer until the generation's `tools` phase ends it. */
  tools?: {
    callId: string;
    name: string;
    /**
     * Absent for a call not started yet (sequential round, `pending`) and for a call its request did not offer,
     * which starts `done` with the `entry` generation wrote.
     */
    taskId?: TaskId;
    status: "pending" | "running" | "done";
    /** Retained running output and what the bounds dropped. */
    output?: string;
    droppedBytes?: number;
    droppedLines?: number;
    /** Last `details()` value. */
    details?: JsonValue;
    /** Diagnostics recorded through `api.diagnostic()`. */
    diagnostics?: ToolDiagnostic[];
    /** Result entry once done; absent when the tool task faulted or was orphaned. */
    entry?: EntryId;
  }[];
  /** Live compaction tasks in task ID order; absent when none (section 8.7). */
  compactions?: CompactionStatus[];
};

type CompactionStatus = {
  taskId: TaskId<CompactionResult>;
  reason: CompactionReason;
  /** Whether a generation waits for it: a compaction the generation owns. */
  blocking: boolean;
  attempt: number;
  /** Durable backoff before the next summarization attempt. */
  retry?: { at: number; error: string };
};
```

| 字段 | 值 |
|---|---|
| 类型 | `pi.live` |
| 版本 | `1` |
| 范围/历史/分支 | 对话，`latest`，`initial` |
| `initial()` | `{}` |
| 检查点 | 任何时候运行中均无内容：`generation` 不存在且无 `running` 工具槽位 |
| 视图挂载 | `docs["pi.live"]` |
| 创建时间 | 每次 Harness 对话（第2.2节） |

空闲时，最终边界处，生成将控制权交给工具轮询（每个槽位仍为 `pending` 或 `done`）之间，
工具的顺序轮次，每当没有并行轮次的工具时  
`running`。一个槽位仅在 `running` 时保持输出，因此每个基础都很小，并且存储的增量链跨最多一代，包括其重试和延迟轮询，或一个轮次工具的重叠执行。保留的头部输出随 Chord 字符串追加而增长。滑动尾部通常变成前端修剪加追加；当 Chord 的有界重叠搜索未找到共享部分时（如高度重复的输出或窗口大于其 64 KiB 扫描范围），提交将保留的窗口写入一组。无论哪种方式，每个提交最多写入一个窗口，且限流器限制了速率。

生成 `tools`，每个 `pending` 槽位在提交追加工具调用答案的调用中创建；一个调用未在请求中提供时，以 `done` 开始其结果条目。工具任务在其意图提交中设置其槽位 `running`，发布限流输出和细节，且在其终端提交中设置 `done` 和 `entry`，移除 `output`、`droppedBytes`、`droppedLines`、`details` 和 `diagnostics`（结果条目现在携带，见第 7.3 节）。生成的 `tools` 阶段移除 `tools`。槽位更新仅在任务的 `taskId` 槽位存在时生效；否则，持久化部分输出、细节和诊断为空。

压缩状态在创建任务的提交中添加，并在
在决定其结果的提交中：任务自身的结局提交，即使该结局保持为`completing`（第5.5节），或调度程序的清理（第5.4节）。它保持精简：摘要文本存在于任务的放置中，绝不会在这里。部分数据在赋值前会被标准化为严格的JSON。每个运行任务的终端路径会在决定运行输入的提交中移除`run`、`generation`和`tools`。`tx.settleSubmission()`会为每个输入的新状态进行阶段化，并在组装过程中解决交易的最新候选提交记录，回退到已提交状态，类似于任务文档验证（第3.3节），因此它不是调用者表读取操作，且在提交的首次表写之后仍能正常工作。

### 8.3 生成

```ts
type GenerationInput = {};
type GenerationCheckpoint =
  | {
      phase: "prepare";
      attempt: number;
      /** The blocking compaction this generation waited for; it starts no other compaction. */
      compacted?: TaskId<CompactionResult>;
      /** Error text of the overflow that started `compacted`; checked once when `prepare` resumes. */
      overflow?: string;
    }
  | {
      phase: "request";
      attempt: number;
      compacted?: TaskId<CompactionResult>;
      model: ModelRef;
      thinkingLevel: ModelThinkingLevel;
      streamOptions: ConversationStreamOptions;
      /** Newest entry included in the request. */
      cutoff: EntryId;
    }
  | { phase: "retry"; attempt: number; compacted?: TaskId<CompactionResult>; until: number }
  | {
      phase: "poll";
      attempt: number;
      compacted?: TaskId<CompactionResult>;
      model: ModelRef;
      cutoff: EntryId;
      handle: DeferredHandle;
      pollAt: number;
    }
  | {
      /** Waiting on the round's tool tasks; `waiting` holds this checkpoint (section 8.5). */
      phase: "tools";
      assistant: EntryId;
      tools: TaskId<ToolTaskResult>[];
      /** Calls of a sequential round not started yet, in call order. */
      pending: string[];
    };
type GenerationResult = { entryId: EntryId };
```
  
`pi.generation`是版本1，起始于`{ phase: "prepare", attempt: 1 }`。  
运行的输入存在于`pi.live.run`中，而非任务输入。

- `prepare`运行第7.4节的代理解析阶段，并一次性解决设置。当代理没有模型或`models.getModel()`不知道时，任务会以`no_model`失败。当其恢复为`overflow`且其压缩未完成为`entryId`时，运行会以`model_error`失败，并将溢出文本作为详情。否则，一个提交会追加计划的`pi.system`条目，并移动到`request`，以新尾部`cutoff`、代理的模型和思考等级以及设置流的形式存在。
选项。这些在此请求尝试中保持固定；重试将再次准备。`compacted` 继续到 `request`、`retry`、`poll`，以及下一个 `prepare`。

-  在该提交之前，`prepare` 检查压缩阈值（第8.7节）：当设置的压缩策略已启用，模型的 `contextWindow` 为正，且 `compacted` 不存在时。估算从最新助手消息开始，该消息在提交的模型上下文中被追加到头部标记之后（所有符合条件的消息均无此标记），且其使用量不为零：pi-ai `calculateContextTokens()` 加上其使用量，加上 pi-ai `estimateMessageTokens()` 乘以其后每个上下文消息和计划系统消息。其请求包含该标记，因为只有在没有请求在飞行时才会放置头部。如果没有该消息，每个消息都将被估算。这两个阈值仅在范围选择找到裁剪时才适用。

  -  超过 `contextWindow - reserveTokens` 时，阻塞阈值：代替追加，一个提交创建一个由生成拥有的压缩，原因 `threshold`，添加其状态，并在 `waiting` 上提交 `allSettled` 和检查点 `{ phase: "prepare", attempt, compacted }`。无论结果如何，`prepare` 然后再次运行并发送请求。

  -  超过 `contextWindow - reserveTokens - backgroundTokens` 且
`backgroundTokens > 0`和`pi.live`中没有压缩状态：将提交移动到`request`的同时，也会创建一个由对话拥有的后台压缩，原因是`threshold`，并添加其状态。生成过程不会等待它。重试策略在尝试结果分类时读取，因为它决定了下一次尝试（第7.1节）。

- `request`和`poll`通过`models.getModel()`解决检查点的模型；未知模型会以`no_model`失败任务，例如`prepare`。`request`在解决模型之前会先转换遗留的部分（见下文）。

- `request`首先将`pi.live`中断尝试遗留的已提交部分转换为`pi.assistant`的中止条目。然后通过`cutoff`流式传输模型上下文，使用调用信号、思考级别为`reasoning`（`off`省略）、对话的持久化提供者`sessionId`以及固定的`streamOptions`，最多每`settings.progress.partialIntervalMs`（默认100毫秒）提交部分。在流式传输之前，`beforeRequest`链可能会仅替换此请求的消息。恢复会重新发送相同的消息，使用相同的固定模型、思考级别和流选项，并重新运行`beforeRequest`。

- `afterResponse`在分类之前会观察每条终端消息，来自`request`或`poll`；仍被延迟的结果不是终端消息。
- 在分类之前，处理程序会停止部分节流并等待任何正在飞行中的部分提交，因此不会出现过期的部分。终端消息将在一次提交中进行分类，同时也会清除部分提交：
  - `stop`/`length`：在提交之前，`onYield`链运行；第一个`{ continue }`获胜。提交会追加答案并应用最终边界（第6节）。如果有延续且未选择用户项或重置，则会追加一个`pi.user`条目，包含延续内容，创建一个继任生成，并将其交给`pi.live.run`，保持输入开放。否则，它会结算运行的输入`done`，移除`run`和`generation`，并为所选用户项启动继任运行（如果有）；已丢弃的延续不会重试。两者均以`{ entryId }`完成。

  - `toolUse`至少包含一个工具调用：提交会追加助手条目并启动下面描述的工具轮次，进入`waiting`阶段的`tools`。不包含调用的`toolUse`消息将像`stop`一样进行分类。

  - `error`中pi-ai `isContextOverflow()`识别的内容，同时启用设置的压缩策略，`compacted`缺失，并且范围选择找到一个切片：提交会追加错误条目，移除`generation`，创建一个由生成拥有的压缩条目（理由为`overflow`），添加其状态，
并提交 `waiting`，使用 `allSettled` 和检查点 `{ phase: "prepare", attempt, compacted, overflow }`；恢复请求不计入重试策略。任何其他溢出，包括第二次溢出，都不会重试，失败方式如同以下不可重试的错误。`stop` 或 `length` 响应永远不会被归类为溢出；下一个阈值检查处理静默溢出。
  - `error` 接受 `isRetryableAssistantError()`，同时设置的重试策略允许另一次尝试（`enabled` 和 `attempt <= maxRetries`，因此 `maxRetries` 计入第一次尝试后的重试次数）：追加错误条目并移动到
`retry`与`until = now + retryDelayMs(policy, attempt)`。
  - 任何其他`error`，或`aborted`没有中止标记：追加错误条目，解决输入`unanswered`与`model_error`，移除`run`和`generation`，然后失败。
  - `deferred`：移动到`poll`与`pollAt = now + (handle.pollAfterMs ?? 5000)`。
- `retry`休眠直到`until`，然后返回`prepare`进行下一次尝试，因此回退期间所做的代理和设置更改生效。
- `poll` 等待 `pollAt` 并调用 `models.fetchDeferred()`。一个仍被延迟的结果将 `pollAt` 严格推迟；其他任何结果均按上述分类。
-  中止处理程序在 `poll` 中模型已知时调用 `models.cancelDeferred()`（报告失败），将已提交的部分转换，与 `aborted` 一起解决输入 `unanswered`，移除 `run` 和 `generation`，并结束 `aborted`。

工具轮询在提交中开始，追加工具调用答案：

1.  提供的工具通过 `cutoff` 从已提交的模型上下文中重播 pi-ai `getCurrentTools()`：`request` 已经持有它，`poll` 又推导了一次。对未提供的工具的调用在此获得 `tool_unavailable` 结果条目，没有任务。
2.  其他所有调用获得由生成器拥有的 `pi.tool` 任务，输入为 `{ assistant, callId }`。当轮询开始时读取的设置的 `toolExecution` 是 `sequential` 或任何已调用的工具（从阶段代理解析工具任务时确定）具有 `executionMode: "sequential"` 时，轮询顺序执行：仅第一个调用现在获得其任务，其余等待在 `pending`。否则，所有调用同时获得其任务，并且它们并行运行。检查点的 `tools` 列出到目前为止创建的任务，并且每启动一个顺序调用就增加一个，而 `pending` 则减少。
3. 生成提交`waiting`的任务工具，使用`allSettled`和`tools`检查点（第8.5节）；`pi.live.run`保持不变。
4. `pi.live.tools`接收本轮的插槽（第8.2节），`generation`被移除。

输入提交以以下原因之一结算`unanswered`：`no_model`，`model_error`（详情：提供方错误文本），`aborted`，`faulted`（详情：错误消息），或孤儿阻塞原因（第5.4节）。故障和孤儿结算将已提交的部分转换为中止的`pi.assistant`条目，如同中止处理程序。

### 8.4 工具

```ts
type ToolTaskInput = { assistant: EntryId; callId: string };
type ToolTaskCheckpoint =
  | { phase: "call" }
  | { phase: "execute"; arguments: JsonObject; replay: "safe" | "unsafe" };
type ToolTaskResult = { entryId: EntryId; control?: ToolControl };
```

`pi.tool`为版本1，起始于`{ phase: "call" }`。由于终端记录保持，输入保持较小；调用从辅助条目读取。

- `call`使用`runtime.entry()`读取调用，根据阶段代理`tools`（第7.3节）解析工具，使用pi-ai `validateToolArguments()`验证参数，运行`beforeTool`链，并再次验证（第7.3节）。一次提交则记录意图：它将最终参数和工具回放策略移动到`execute`，并设置插槽`running`。相同的处理程序执行工具，运行`afterTool`链，并提交结果；它在执行前构建`api.env`与`HarnessOptions.env`（第2.2节）。对于未解析的工具、无效参数或阻塞
提交相应的错误结果，而非意图。
- `execute`仅通过恢复可达。当存储的和当前策略，如`call`解析所示，均为`safe`时，它再次使用存储的参数执行，不带`beforeTool`，并如同`call`般结束。否则，它会从槽的持久化部分输出、详细信息和诊断中提交一个`interrupted`错误结果，并以`failed`结束，伴随`{ entryId }`。

- 结果提交限定内容，追加诊断块（第7.3节），追加一个`pi.tool-result`条目，内容为`model: [{ role: "toolResult", toolCallId, toolName, content, details, isError, timestamp }]`和`data: { diagnostics }`，标记槽为`done`，并以`{ entryId, control }`完成。一个`isError`结果仍然会完成。

- 来自`execute()`的抛出，或来自`HarnessOptions.env`构建其环境时的抛出，会变成`tool_error`结果，任务以`failed`结束，伴随`{ entryId }`；一旦调用被信号触发，它将代替传播。结束`failed`，如同`aborted`，会记录取消意图（第5.4节），因此，该调用所拥有的对话，已不再受任何监督，将被中止。返回的`isError`结果仍然会完成，其调用所拥有的工作
无论哪种方式，运行都会继续进行结果条目。一个拥有普通对话的任务在提交其结果时仍然具有普通工作，其结果条目已经写入`completing`（第5.5节）；
生成恢复仅在工具任务终止时进行。
- 中止处理程序将从插槽的持久性提交一个`aborted`错误结果
部分输出、详细信息和诊断结束`aborted`，随后是`{ entryId }`。

### 8.5 工具调用轮次

当生成任务所等待的所有工具任务都进入终态后，生成任务在其`tools`阶段恢复执行。如果顺序调用轮次的`pending`中还有调用，则通过一次提交创建下一次调用的自有工具任务，并使用缩短后的`pending`再次等待。否则，它通过`runtime.getTask()`读取工具记录，从`pi.live.tools`槽位读取本轮结果条目，运行`afterTools`观察者，然后进行一次提交：

- 对每个`addTools`名称，修改对话所存储的`pi.agent`中的`tools`：数组中尚无该名称时将其追加；`{ remove }`则移除该名称。当`tools`未设置时，所有工具本来就可用，因此不写入任何内容。下一次准备阶段解析该工具时会将其提供给模型。
- 当本轮所有结果都请求`terminate`，或任一结果请求`handoff`时，追加交接的`pi.reset`条目（若有），以工具调用回复将本次运行的输入结算为`done`，移除`run`和`tools`，并应用最终边界。
- 否则，移除`tools`并应用`postTools`边界。如果该边界放置了重置，本次运行的输入会以原因`reset`结算为`unanswered`，所选用户条目启动后继运行（第6节）。否则，所选引导输入ID加入`pi.live.run`；随后创建由对话拥有的下一次生成任务，并将本次运行交给它。

生成任务以工具调用回复的`{ entryId }`完成。只有其工具任务进入终态后，才运行它的中止处理程序（第5.5节）。对于仍在`pending`中、从未启动的每个调用，追加一个`aborted`错误结果；已启动但任务发生故障或成为孤儿的调用保留其`done`槽位，但没有结果条目（第8.2节）。然后，以原因`aborted`将输入结算为`unanswered`，移除`run`、`generation`和`tools`，并以`aborted`结束。因此，对生成任务调用`abortTask()`会中止整个工具调用轮次。

### 8.6 使用

```ts
type UsageState = {
  /** Assistant entries and compaction summarization attempts, keyed `provider/modelId`. */
  models: Record<string, Usage>;
  /** Tool results, keyed by tool name; their usage has no model identity. */
  tools: Record<string, Usage>;
};
```

| 字段 | 值 |
|---|---|
| 类型 | `pi.usage` |
| 版本 | `1` |
| 范围/历史/分叉 | 对话、`latest`、`initial` |
| `initial()` | `{ models: {}, tools: {} }` |
| 检查点 | 每次变更后均完成基础 |
| 视图挂载 | `docs["pi.usage"]` |
| 创建时间 | 每次Harness对话（第2.2节）时创建 |
`pi.usage` 是本次对话自身支出的账本。每个 `pi.assistant` 条目记录的内置写入器会将其消息的 `usage` 添加到 `models` 下，位于该消息自身的 `provider/model` 之下；每个 `pi.tool-result` 条目的写入器在 `usage` 的情况下，会将其添加到 `tools` 中，且在同一提交中完成。每个压缩任务的汇总尝试会将其响应的 `usage` 添加到 `models` 中（见第8.7节）；该支出没有条目，无论汇总是否成功、失败或过期。失败和中止的尝试都会计数。分叉从零开始，因此不会重复计算支出。`Harness.usage()` 将每个对话的文档汇总到会话总支出中；其他总支出（如所有权子树）是基于 `scanConversations()` 的应用级汇总。没有任何内容会跨对话存储总支出。

###  8.7 压缩

```ts
type CompactionReason = "manual" | "threshold" | "overflow";
type CompactionInput = { reason: CompactionReason; instructions?: string };
/** The pinned summarization request. */
type SummaryRequest = {
  attempt: number;
  model: ModelRef;
  thinkingLevel: ModelThinkingLevel;
  streamOptions: ConversationStreamOptions;
  maxTokens: number;
  /** Newest entry of the context the range was selected from. */
  tail: EntryId;
  /** First entry kept verbatim; the summary's `head`. */
  firstKept: EntryId;
};
type CompactionCheckpoint =
  | { phase: "select" }
  | ({ phase: "summarize" } & SummaryRequest)
  | ({ phase: "retry"; until: number } & SummaryRequest);
/**
 * `entryId` of a blocking compaction's summary, or the `submissionId` of a conversation-owned compaction's summary
 * write; both absent when nothing was compacted.
 */
type CompactionResult = { entryId?: EntryId; submissionId?: SubmissionId };
```
  
`pi.compaction` 是版本1，起始于 `{ phase: "select" }`。压缩操作会用一个摘要条目替换模型上下文中的旧前缀，该摘要条目的 `head` 是第一个保留的条目（见2.1节）。原始历史记录保留在存储中。启动压缩任务有三种方式；任务本身相同，仅所有权和放置方式不同：

| 启动者         | 所有者      | 背景任务 | 生成延迟 | 放置方式       |
|----------------|-------------|----------|----------|----------------|
| `Conversation.compact()` | 对话        | 无       | 无       | 提交写入       |
| 超过背景阈值的生成 | 对话 | 是 | 否 | 写入提交 |
| 超过阻塞阈值，或溢出 | 生成 | 否 | 是 | 直接追加 |

在对话运行等待时，仅运行阻塞型压缩。其他操作不会获取运行控制权：对话在它们进行摘要时会继续工作，其摘要与任何被动写入一样被处理。压缩操作之间不会协调；多个压缩可能同时运行，第6节将决定它们摘要之间的关系。

**范围选择**是`ContextView`的纯函数，其`contributions`会在每次编辑范围内活动条目模型消息（第2.1节，规则4和9）后提供，包括由较旧范围内标记携带的编辑，以及设置的`keepRecentTokens`。

1. Cut候选条目是指那些贡献以用户或助手消息开始的非标记条目。工具结果和系统条目永远不会成为候选条目，因此保留的助手消息会保留其工具结果。用户条目在前一个助手调用的结果（在它之后）出现之前也不会成为候选条目（第2.1节，规则7）。

2. 从最新到最旧的非标记条目开始，为每个贡献添加pi-ai `estimateMessageTokens()`。在总和达到`keepRecentTokens`的第一个条目处，剪裁操作将选择该条目在转录顺序中第一个或后续的候选条目，或者如果没有后续条目，则选择最新候选条目。

3. 当总和从未达到`keepRecentTokens`时，无需进行压缩，或者
当切点前没有非标记条目贡献模型消息时。

汇总的条目包括头标记（如果有），以及切点前的非标记条目。它们的消息是它们的贡献，顺序与第2.1节规则7和8相同，因此较早的汇总会再次与后续历史一起汇总。上下文小于`keepRecentTokens`时不会进行压缩，因此当窗口中`contextWindow - reserveTokens`在其下方时，溢出可能在任何阈值压缩之前发生。

```text
1 user   2 assistant (read)   3 tool result, 30k tokens   4 assistant   5 user   6 assistant
keepRecentTokens 20k: the walk from 6 reaches 20k at 3; the first candidate at or after 3 is 4.
The summary covers 1-3; the model context becomes [summary, 4, 5, 6].
```

阶段：

- `select`负责处理阶段的代理解析，一次性解析设置，并捕获已提交的上下文。如果代理没有模型或`models.getModel()`不知道，任务将以`no_model`失败。如果没有内容需要压缩，则以`{}`完成。否则，`beforeCompact`钩子（第7.2节）将使用汇总条目和消息运行；以第一个决策为准。`{ decline: true }`以`{}`完成，并将`{ summary }`放在同一提交的下方。如果没有决策，一个提交将尝试1次进入`summarize`，携带代理的模型和思考级别、设置的流选项、`maxTokens` = `min(floor(0.8 * reserveTokens), model.maxTokens)`（仅当模型值为正时有效）、捕获的尾部以及切点作为`firstKept`。

- `summarize`再次从上下文`tail`（不可变）中派生汇总消息，并将它们序列化为文本：`[User]: ...`，
`[Assistant thinking]: ...`, `[Assistant]: ...`,
`[Assistant tool calls]: name(key=json, ...)`, and `[Tool result]: ...`
已截断为2000个字符；系统消息已省略。该请求没有工具，只有两条消息：一条系统消息包含内置摘要系统提示，一条用户消息包含用`<conversation>`标签序列化的文本，后跟内置摘要提示，以及当输入包含指令时的`Additional focus: <instructions>`。它使用固定思维等级`reasoning`，持久化会话提供者`sessionId`，以及固定流选项（不包含`deferred`），并使用`cacheRetention: "none"`和固定`maxTokens`。像Codex这样的提供者在禁用缓存时可能会隐藏该身份。恢复会重新发送相同的请求。响应被归类在一个提交中，将其使用情况添加到`pi.usage`（第8.6节）：
  - `stop`，文本非空且无工具调用：文本即摘要，放置如下。
  - `error`，当`isRetryableAssistantError()`接受时，而设置的重试策略在分类时允许另一次尝试：移动到`retry`，使用`until = now + retryDelayMs(policy, attempt)`, and set the status's `attempt` and `retry`。
  - 任何其他情况，包括`length`停止，都会导致摘要不完整：以`model_error`失败。
- `retry`休眠至`until`，然后携带下次尝试和相同的固定请求返回`summarize`。

内置提示是编码代理的结构化检查点格式。提示还要求模型在对话开始时携带之前的摘要。

**放置。** 摘要条目为

```ts
{
  kind: "pi.compaction",
  head: firstKept,
  model: [{ role: "user", content: [{ type: "text", text: wrapped }], timestamp: now }],
  data: { reason },
}
```

其中`wrapped`为`"The conversation history before this point was compacted
into the following summary:\n\n<summary>\n"`，摘要，以及`"\n</summary>"`。放置该条目的提交同时也移除任务状态并提交任务的`completed`结果：

- 阻塞式压缩直接追加条目并以`{ entryId }`完成。其生成器持有运行并等待，因此对话中不会写入其他内容。
- 对话拥有的压缩器以请求ID `compaction:<taskId>`将条目作为写入提交，严格遵循第6节：在空闲且收件箱为空的对话中，条目立即追加或在`stale`时稳定；在空闲但有排队项的对话中，条目排队并在最终边界运行；在忙碌的对话中，条目排队等待下次边界。其以`{ submissionId }`完成，且不会等待排队放置；
`Harness.submission()`观察放置。

下一代准备发现头部标记后无后续`pi.system`条目，写入完整的系统基线（第7.4节）。

**取消。** 中止处理器移除任务状态并以`aborted`结束；不写入任何条目。被中止或崩溃打断的尝试无已提交的响应，因此其使用量不计。手动压缩是其对话的普通工作：`Conversation.abort()`中止它。后台压缩可存活并仅通过`abortTask()`或`Conversation.abort(context, { background: true })`停止。阻塞式压缩在其生成器前以生成器方式中止（第5.5节）。已排队的摘要为写入提交：对话中止时保留，`Submission.abort()`撤回。

当阻塞式压缩因无`entryId`而结束（因未找到可压缩内容、被拒绝、失败、出错或直接中止），阈值生成器仍发送请求，溢出生成器以`model_error`失败（第8.3节）。

## 9. 文档观察与Chord

### 9.1 文档状态

Chord现有的复制状态层公开了该源采纳契约：

```ts
interface ReplicatedStateSourceFrame<T> {
  readonly cursor: number;
  readonly value: T;
  readonly ops: readonly Op[];
  readonly context: Context;
}

interface ReplicatedStateSourceAttachment<T> {
  /** Fixed immutable snapshot captured at the atomic attachment boundary. */
  readonly snapshot: { readonly value: T; readonly cursor: number };
  /** Install the sole listener and synchronously drain every buffered frame. */
  activate(listener: (frame: ReplicatedStateSourceFrame<T>) => void): void;
  dispose(): void;
}

interface ReplicatedStateSource<T> {
  /** Atomically capture a snapshot and begin buffering every later commit. */
  attach(): ReplicatedStateSourceAttachment<T>;
}

interface ReplicatedStateSourceOptions {
  readonly onError?: (error: Error) => void;
}

interface AttachedReplicatedState<T> extends ReplicatedState<T> {
  readonly value: T;
  dispose(): void;
}

function replicatedState<T>(
  source: ReplicatedStateSource<T>,
  options?: ReplicatedStateSourceOptions,
): AttachedReplicatedState<T>;

type DocumentState<T extends JsonObject> =
  AttachedReplicatedState<Readonly<T> | null>;

type WatchEnd =
  | { readonly reason: "stopped" | "cancelled" | "session_closed" | "retired" }
  | { readonly reason: "listener_error"; readonly error: Error };

interface WatchHandle<T> {
  /** Acquisition revision before start; latest delivered immutable revision afterward. */
  readonly value: T;
  /** Installs the sole serialized asynchronous listener. */
  start(listener: (value: T, ops: readonly Op[], context: Context) => Promise<void>): void;
  /** Idempotently stops future callbacks and returns this watch's terminal result. */
  stop(): Promise<WatchEnd>;
  /** Settles when the watch terminates; an already-running callback remains caller-owned. */
  readonly closed: Promise<WatchEnd>;
}

type DocumentWatch<T extends JsonObject> = WatchHandle<Readonly<T> | null>;

interface DocumentObserver {
  watchDoc<T extends JsonObject>(token: SessionDocToken<T>, context: Context): Promise<DocumentWatch<T> | undefined>;
  watchDoc<T extends JsonObject>(token: ConversationDocToken<T>, conversationId: ConversationId, context: Context): Promise<DocumentWatch<T> | undefined>;
  watchDoc<T extends JsonObject>(token: TaskDocToken<T>, taskId: TaskId, context: Context): Promise<DocumentWatch<T> | undefined>;
  watchDoc<T extends JsonObject, I extends JsonValue>(token: SessionDocFamilyToken<T, I>, key: string, context: Context): Promise<DocumentWatch<T> | undefined>;
  watchDoc<T extends JsonObject, I extends JsonValue>(token: ConversationDocFamilyToken<T, I>, conversationId: ConversationId, key: string, context: Context): Promise<DocumentWatch<T> | undefined>;
  watchDoc<T extends JsonObject, I extends JsonValue>(token: TaskDocFamilyToken<T, I>, taskId: TaskId, key: string, context: Context): Promise<DocumentWatch<T> | undefined>;
}
```

`documentState()`在将Pico的已提交文档流附加到Chord后返回。返回状态已与确切的可共享不可变修订版一起“水合”，无任何变异方法，并且会发布所有后续确切已提交修订版和操作批次，无需其他跟踪器、值拷贝或重比较。处置仅注销该观察；Pico仍是唯一文档变异者。

状态和观察获取从不创建；无查找返回`undefined`。成功获取绑定一个具体实例。退休发布一个JSON `null`根替换并终止该实例的流。如果状态仍暴露，消费者看到`null`，绝非过时状态。后续重建需要获取新状态或观察。

会话关闭结束每个状态于其封印：状态保留其最后值，并且在关闭期间的提交不会为其提供帧。

每个文档状态为其Chord交付序列分配独立的内存连续序列。Pico不通过`WatchHandle`持久化或暴露该序列。状态和观察独立于加载的跟踪器缓存保留不可变修订版。重新打开创建新状态生命周期和水合。

内部，状态附加使用Chord的同步原子快照和注册边界：快照包含附加前的每个提交，后续确切帧缓冲至激活。这防止快照与基于较新未见修订版的操作配对。

### 9.2 `watchDoc`

任务、钩子和工具可观察任何现有文档，前提是其代码拥有令牌和所有者/密钥。受信Session代码内无额外的子树权限系统。
`watchDoc()`在会话线上解析一个现有的具体实例，以O(1)时间捕获其当前不可变的跟踪修订版本，并为每个后续精确提交的修订版本和操作批次注册。当不存在时，它返回`undefined`。在`start()`之前，`watch.value`保持为获取修订版本，后续帧作为缓冲区。

```ts
const watch = await api.watchDoc(JobOutputDoc, producerTaskId, context);
if (watch === undefined) return;
try {
  await initializeConsumer(watch.value, context);
  watch.start(async (value, ops, deliveryContext) => {
    await consume(value, ops, deliveryContext);
  });
} catch (error) {
  await watch.stop();
  throw error;
}
```

`start()`安装唯一的监听器并安排交付；它绝不内联调用用户代码。每个回调接收精确不可变的提交值和产生该值的精确操作批次。在调用之前，`watch.value`会进阶到该值。观察器在开始其下一个回调之前等待监听器，但会话提交永远不会等待回调的结算。

观察器最多保留100个待提交的帧，不包括正在交付的帧。添加第101帧时，会用一个自包含的根替换完整的未交付后缀`[["r", newestValue]]`，使用最新的精确不可变修订版本和该提交的上下文。后续精确帧会像往常一样跟随该替换。另一个溢出会再次替换待处理后缀。不会进行序列化字节度量、值复制、操作回放或重计算。这是收敛观察，不是审计流；需要每个转换的消费者必须单独持久化这些事实。

`watch.value`和所有先前返回的修订版本在受信任的不可变性契约下将永远保持稳定。消费者不得变异它们或保留的后代。所选提交上下文的值被保留，不继承生产者的取消。回调拥有其自己的异步工作。

观察器始终与其原始实例绑定。退休会排队确切的终端`[["r", null]]`帧，或将其折叠到一个溢出替换中，值为`null`。在该回调结算后，观察器关闭为`retired`，不再跟随任何替换实例。

`stop()`是幂等的。它同步地注销、丢弃待处理帧，并阻止另一个回调启动，返回通用终端承诺。一个正在运行的回调不会被中止或加入，仍归调用者所有。获取`Context`管理观察器的生命周期。获取期间的取消会在拒绝前清理；后续取消和会话关闭会以类似方式停止未来交付。监听器失败会丢弃待处理工作，并仅关闭该观察器为`listener_error`。第一个终止原因胜出，且每个晚到的拒绝都会被观察到。

### 9.3 对话视图

公共视图是对话活动转录及其内置文档的固定结构挂载：

```ts
type ConversationView = {
  readonly conversation: ConversationRecord;
  /** Raw active entries, as `ContextView.entries` (section 2.1): the head marker, then the non-head entries from its head. */
  readonly entries: readonly EntryRecord[];
  /** `pi.agent`, `pi.live`, `pi.inbox`, `pi.provider`, and `pi.usage`, keyed by kind; absent documents are absent. */
  readonly docs: Readonly<Record<string, JsonObject>>;
};
```

这些类型及其字段是公共协议。第三方文档通过它们自己的Chord服务暴露，而不是挂载。

控制台最多为每个对话保持一个挂载。第一个`viewState()`、`watch()`或事件附件构建其修订版本，基于会话线上的已提交活动转录和文档；当最后一个观察者分离时，挂载被丢弃。挂载从会话的`subscribeCommits()`发布中派生每个下一个修订版本，如同`watchDoc()`：每个发布本身已经是持久的，因此视图仅显示已提交状态。触及对话的一个发布会生成一个Chord批次：

```text
document op ["s", ["generation", "message"], value]
-> view op ["s", ["docs", "pi.live", "generation", "message"], value]
```

没有头部的追加条目是`entries`末尾的拼接。追加头部标记`H`会使条目`H`紧跟当前非头部条目或之后`H.head`：保留的条目保持不变，拼接移除其他条目并在前端插入`H`。每个保留条目因为控制台写入者永远不会在当前范围之前目标头部，所以已经挂载。重置和交接会自己处理头部，压缩摘要目标当前范围的保留条目，且达到更远回溯的头部写入是过时的（第6节）。直接针对更远回溯的原始头部写入仅显示挂载条目（第12节）。

文档创建和退休设置和删除`docs`键。通过`parent.at`的父条目是不可变的，因此子挂载仅跟随其自身的对话。不触及任何挂载的发布不会创建修订版本；冗余非空批次仍然是真实的发布。挂载的文档修订
结构上遵循可信不可变性合约。挂载不进行语义投影，也不拥有持久化存储。

`Conversation.viewState()`将挂载暴露为一次性只读的Chord状态。`Conversation.watch()`通过第9.2节中序列化精确帧监视器暴露了相同的挂载，具有有界待处理帧和全值溢出替换。

### 9.4 代理事件（实验中）

`watchEvents(harness, conversationId, context): Promise<AgentEventStream>`，从包根目录导出，是一个实验性的适配器，将一个对话的已提交发布转换为类似于编码代理的`AgentSessionEvent`s形状的代理事件。它不拥有跟踪器或持久化存储，仅覆盖一个对话（而非其拥有的子树），且仅在使其为真的提交之后才发出事件。其协议可能随时变更，恕不另行通知。

```ts
type AgentEvent =
  | {
      type: "snapshot";
      entries: readonly EntryRecord[];
      run?: { inputs: readonly SubmissionId[] };
      /** Current generation attempt: its in-flight partial, retry backoff, or deferred poll. */
      generation?: { attempt: number; message?: AssistantMessage; retry?: { at: number; error: string }; deferred?: { pollAt: number } };
      tools: readonly ToolSlot[];
      /** `pi.live.compactions` (section 8.2). */
      compactions: readonly CompactionStatus[];
      inbox: readonly { id: SubmissionId; mode: InboxItem["mode"] }[];
      /** `pi.agent`; `{}` when absent. */
      agent: AgentState;
      usage: UsageState;
    }
  | { type: "run_start"; inputs: readonly SubmissionId[] }
  | { type: "run_end"; inputs: readonly SubmissionId[] }
  | { type: "turn_start" }
  | { type: "turn_end" }
  | { type: "message_start"; message: Message }
  | { type: "message_update"; usage: Usage; changes: readonly MessageChange[] }
  | { type: "message_end"; entry: EntryRecord }
  | { type: "tool_execution_start"; toolCallId: string; toolName: string; args: JsonObject }
  | {
      type: "tool_execution_update";
      toolCallId: string;
      toolName: string;
      /** A front trim and then an append of the retained window, or its replacement. */
      output?: { trimStart?: number; append?: string } | { set: string };
      details?: JsonValue;
      diagnostics?: readonly ToolDiagnostic[];
    }
  /** `entry` is absent when the tool task faulted or was orphaned. */
  | { type: "tool_execution_end"; toolCallId: string; toolName: string; entry?: EntryRecord }
  | { type: "inbox_update"; items: readonly { id: SubmissionId; mode: InboxItem["mode"] }[] }
  | { type: "submission"; record: SubmissionRecord }
  | { type: "auto_retry_start"; attempt: number; at: number; errorMessage: string }
  | { type: "auto_retry_end"; attempt: number }
  | { type: "deferred_poll"; pollAt: number }
  | { type: "entry_appended"; entry: EntryRecord }
  | { type: "agent_changed"; agent: AgentState }
  | { type: "usage_changed"; usage: UsageState }
  | { type: "task_failed"; taskId: TaskId; kind: string; message: string }
  | { type: "compaction_start"; taskId: TaskId; reason: CompactionReason; blocking: boolean }
  /** The task's receipt tells whether it produced a summary; the summary entry has its own events. */
  | { type: "compaction_end"; taskId: TaskId; reason: CompactionReason };

/** One change to the in-flight assistant message, relative to that message. */
type MessageChange =
  | { type: "text_start" | "thinking_start" | "toolcall_start"; contentIndex: number; block: AssistantMessage["content"][number] }
  | { type: "text_delta" | "thinking_delta"; contentIndex: number; delta: string }
  | { type: "toolcall_delta"; contentIndex: number; path: readonly (string | number)[]; delta: string }
  | { type: "block"; contentIndex: number; block: AssistantMessage["content"][number] }
  | { type: "message"; message: AssistantMessage };

interface AgentEventStream {
  /** The `snapshot` event at attachment. */
  readonly snapshot: Extract<AgentEvent, { type: "snapshot" }>;
  start(listener: (events: readonly AgentEvent[], context: Context) => Promise<void>): void;
  stop(): Promise<WatchEnd>;
  readonly closed: Promise<WatchEnd>;
}
```

每个事件相对于`snapshot`及其之前的事件而言，而非Pico的文档布局。`snapshot`替换了消费者持有的所有内容；其他事件均在其上叠加。附件捕获快照，并在Session线上原子性地注册以供后续发布。

事件源自已提交的变更：

- /`run_start`/`run_end`：`pi.live.run`出现、被移除或被后续运行替换，且后续运行的第一个输入与之不同。加入当前运行和其任务之间的交接不属于运行事件。输入的成果是`submission`事件。

- /`turn_start`：创建了一个`pi.generation`任务。

`turn_end`：一个世代的
结果已提交，当它持有`completing`或变为终端，以先发生者为准，因此在持有期间创建的后继开始于其后。
- `message_start`：尝试的第一个已提交部分，或，对于没有已提交部分的消息条目，条目本身；`message_end`跟随具有`model`消息的每个条目。生成仅在其具有内容时才提交部分，并且每个内置路径在清除一个时追加其条目，因此每个开始的消息以它的条目结束。没有消息的条目是`entry_appended`。
- `message_update`：对已提交部分的Chord操作，翻译如下：将插入操作放入`content`开始阻塞，将追加操作放入块的`text`或`thinking`视为增量，将追加操作放入工具调用字符串内的`arguments`视为相对于`arguments`的路径的`toolcall_delta`，块内的任何其他更改发送该`block`，该条目已包含批次的后续更改，以及对`content`的任何其他更改发送整个`message`。每个更新都携带部分的当前`usage`，与编码代理的JSON模式相同；仅`usage`的更改不发送任何更改。仅增量传输，因此节流部分不会在链路上引起写放大。
- `tool_execution_start`：插槽变为`running`；`args`来自工具任务的意图检查点在同一提交中。变为`done`的插槽
没有运行（调用未提供、无效参数、块、故障前的意图）只获得`tool_execution_end`。`tool_execution_update`：输出追加、前端修剪以及保留窗口槽的替换，以及槽当前`details`和`diagnostics`发生变化时的情况；当安全回放重启工具时，发送`null`和`[]`。`tool_execution_end`：槽变为`done`，带有其`pi.tool-result`条目，该条目携带诊断信息，或在故障或孤儿情况后无条目。一个因运行结束而消失的未完成槽以相同提交追加结果条目结束，如同中止轮次未开始调用直接在其`message_start`之前，或无条目。
- `inbox_update`，`agent_changed`，`usage_changed`：文档已更改；已退役的文档读取其初始值，如同快照。注册表安装和设置更改不提交且不发出任何内容；显示已解决工具或已解决模型的用户界面再次通过`Conversation.agent()`进行解析。
- `auto_retry_start`/`auto_retry_end`，`deferred_poll`：`pi.live.generation`获得或丢失`retry`，或获得`deferred`或移动其`pollAt`。
- `task_failed`：对话任务的解决结果为`faulted`或`orphaned`。  
- `compaction_start`/`compaction_end`：状态出现在或消失于`pi.live.compactions`中。重试回退仅在快照的`compactions`中显示。排队摘要随后被放置，并带有其自身的`message_start`/`message_end`和`submission`事件。

一次提交产生一个批次，顺序如下：`tool_execution_start`，`message_start`的第一个部分，`message_update`，`tool_execution_update`，以及重试/延迟事件；然后是按追加顺序排列的条目及其`message_start`/`message_end`或`entry_appended`，其中工具结果的`tool_execution_end`直接在其`message_start`之前，如编码代理所示；然后是工具结束时没有条目的`tool_execution_end`；然后是`compaction_end`，`task_failed`，`turn_end`，`run_end`；然后是按ID顺序排列的`submission`事件；然后是`inbox_update`，`agent_changed`和`usage_changed`；最后是`compaction_start`，`run_start`和`turn_start`。流最多缓冲100个未送达的批次；添加另一个批次会用最新提交状态的批次替换所有未送达批次中的每一个`snapshot`。因此，流会收敛，但不保证每个转换；`Submission.wait()`报告确切结果。重新连接的消费者再次连接并从其`snapshot`开始；不会重播任何内容。传输背压和断开策略属于消费者。

打印模式等待其自身的输入`Submission`并打印其答案。一个TUI
`ConversationView`；事件可能会驱动瞬态动画。

### 9.5 任务图视图

任务图视图将会话中的每个实时任务显示为一个结构化值，用于用户界面和调试：哪些任务正在运行，哪些任务在等待，以及每个任务拥有哪些对话。它对于会话的任务而言，就像对话视图（第9.3节）对于单个对话而言。

```ts
type TaskGraphState =
  | { readonly status: "pending" | "running"; readonly phase: string }
  | {
      readonly status: "waiting";
      readonly phase: string;
      readonly on: readonly TaskId[];
      readonly policy: JoinPolicy;
    }
  /** Outcome held until its ordinary owned work drains (section 5.5). */
  | { readonly status: "completing"; readonly outcome: TaskOutcome<JsonValue>["status"] };

type TaskGraphNode = {
  readonly id: TaskId;
  readonly kind: string;
  readonly conversationId: ConversationId;
  /** Owner task; absent for a conversation-owned task. */
  readonly owner?: TaskId;
  readonly background: boolean;
  readonly abortRequested: boolean;
  readonly state: TaskGraphState;
  /** Conversations this task owns, in ID order. */
  readonly conversations: readonly ConversationId[];
};

type TaskGraph = {
  /** Every live task, keyed by its decimal ID. */
  readonly tasks: Readonly<Record<string, TaskGraphNode>>;
};

type TaskGraphWatch = WatchHandle<TaskGraph>;

interface Harness {
  taskGraph(context: Context): Promise<AttachedReplicatedState<TaskGraph>>;
  watchTaskGraph(context: Context): Promise<TaskGraphWatch>;
}
```

一个节点保存了已提交的任务记录，但不包括其输入、检查点负载、结果负载和备忘：`phase`是检查点的阶段，`on`和`policy`是存储的等待，`outcome`是持有的结果的状态。`running`是持久状态：开放更改在`running`任务之后存活到`pending`（第5.4节），因此它们显示为`pending`，直到调度程序再次为其保留，而`waiting`和`completing`任务保持其状态。一个待处理任务是否被阻塞，以及`on`中的哪些任务仍然存活，取决于注册表和图的其余部分；`inspect()`推导出这些信息。一个节点从创建其任务的提交一直存在到使任务终止的提交。所有者边是不可变的，因此一个节点的`conversations`仅在其存活期间增长。

图中仅包含实时任务。如果一个对话的拥有者任务已终止，例如背景子代理的对话在其锚点完成后，该对话没有节点列出；稍后该对话中的任务是一个顶层节点。一个将它放在其父节点下的用户界面会读取对话的所有者边。
`ConversationRecord.owner`，也由`ConversationView.conversation`携带。

Harness最多保持一个图挂载。第一个`taskGraph()`或`watchTaskGraph()`基于已提交的实时任务及其拥有的对话，在会话线上构建其修订版本，每个实时任务一个所有者扫描，并在执行过程中保持该线；挂载在最后一个观察者分离时被释放。它从`subscribeCommits()`的发布中推进，如同对话视图：一个更改节点的发布产生一个Chord批次，用于设置或删除`tasks[id]`，或设置节点的`conversations`。一个未更改任何节点的发布不会产生修订版本。任务和对话记录是不可变值；节点与它们共享无任何内容。

`taskGraph()`返回挂载为一次性只读Chord状态。`watchTaskGraph()`通过第9.2节所述的序列化精确帧观察返回。两者均为只读：均不启用调度。在密封时，端点终止它们，如同其他所有状态和观察（第2.2节所述）。

```ts
const graph = await harness.taskGraph(context);
graph.subscribe((value) => {
  for (const node of Object.values(value.tasks)) {
    const where = node.owner === undefined ? `conversation ${node.conversationId}` : `task ${node.owner}`;
    render(`${node.id} ${node.kind} ${node.state.status} under ${where}`);
  }
});
```
  
## 10. 存储合同

有序扫描基于游标。精确身份查找基于键值。

```ts
type Page<T, C> = {
  readonly items: readonly T[];
  readonly next?: C;
};

type Cursor = Readonly<Record<string, JsonValue>>;

type ConversationQuery = {
  readonly ownerConversationId?: ConversationId;
  readonly ownerTaskId?: TaskId;
};

type EntryQuery = {
  readonly conversationId: ConversationId;
  readonly minEntryId?: EntryId; // inclusive
  readonly maxEntryId?: EntryId; // inclusive
};

type TaskQuery = {
  readonly conversationId?: ConversationId;
  readonly kind?: string;
  readonly status?: "pending" | "running" | "waiting" | "completing" | "terminal";
  readonly abortRequested?: boolean;
  readonly background?: boolean;
};

type SubmissionQuery = {
  readonly conversationId?: ConversationId;
  readonly status?: SubmissionRecord["status"];
};

type DocumentPoint = Seq | "current";

type DocumentAddress = {
  readonly kind: string;
  readonly scope: DocumentRecord["scope"];
  readonly key?: string;
};

type DocumentQuery = {
  readonly scope: DocumentRecord["scope"];
  readonly at: DocumentPoint;
  readonly kind?: string;
};

type DocumentContent =
  | { readonly version: number; readonly kind: "base"; readonly value: JsonObject }
  | { readonly version: number; readonly kind: "delta"; readonly ops: readonly Op[] };

type StoredDocument = {
  readonly record: DocumentRecord;
  readonly version: number;
  readonly value: JsonObject;
  /** Deltas replayed after the selected base to materialize `value`. */
  readonly deltasSinceBase: number;
};

type StorageWrite =
  | { readonly type: "conversation"; readonly value: ConversationRecord }
  | { readonly type: "entry"; readonly value: EntryRecord }
  | { readonly type: "task"; readonly value: TaskRecord<JsonValue, JsonValue, JsonValue> }
  | { readonly type: "submission"; readonly value: SubmissionRecord }
  | {
      readonly type: "document.create";
      readonly record: DocumentCreate;
      readonly content: Extract<DocumentContent, { kind: "base" }>;
    }
  | {
      readonly type: "document.copy";
      readonly record: DocumentCreate;
      readonly source: { readonly id: DocumentId; readonly at: DocumentPoint };
    }
  | {
      readonly type: "document.change";
      readonly id: DocumentId;
      readonly content: DocumentContent;
    }
  | { readonly type: "document.retire"; readonly id: DocumentId };

/**
 * Trusts the owning Session to supply semantically valid records, references,
 * ancestry, and transitions. Enforces atomicity, global ID ownership, immutable
 * conversation/entry creation, document record consistency, and detached
 * values; Session serializes commits. Sequences strictly increase but may have
 * gaps. Once commit() resolves, later reads through that Storage observe it.
 */
interface Storage {
  commit(writes: readonly StorageWrite[], context: Context): Promise<Seq>;
  /** Allocate from the one global numeric namespace; the generic brand is compile-time only. */
  mintId<I extends Id<string>>(): Promise<I>;

  conversation(id: ConversationId, context: Context): Promise<ConversationRecord | undefined>;
  scanConversations(query: ConversationQuery, limit: number, cursor: Cursor | undefined, context: Context): Promise<Page<ConversationRecord, Cursor>>;

  entry(id: EntryId, context: Context): Promise<{ readonly entry: EntryRecord; readonly commitSeq: Seq } | undefined>;
  entry(conversationId: ConversationId, id: EntryId, context: Context): Promise<{ readonly entry: EntryRecord; readonly commitSeq: Seq } | undefined>;
  findLatestHeadMarker(conversationId: ConversationId, atOrBeforeEntryId: EntryId | undefined, context: Context): Promise<(EntryRecord & { readonly head: EntryId }) | undefined>;
  scanEntries(query: EntryQuery, limit: number, cursor: Cursor | undefined, context: Context): Promise<Page<EntryRecord, Cursor>>;

  task(id: TaskId, context: Context): Promise<TaskRecord<JsonValue, JsonValue, JsonValue> | undefined>;
  scanTasks(query: TaskQuery, limit: number, cursor: Cursor | undefined, context: Context): Promise<Page<TaskRecord<JsonValue, JsonValue, JsonValue>, Cursor>>;

  submission(id: SubmissionId, context: Context): Promise<SubmissionRecord | undefined>;
  scanSubmissions(query: SubmissionQuery, limit: number, cursor: Cursor | undefined, context: Context): Promise<Page<SubmissionRecord, Cursor>>;
  submissionByRequest(conversationId: ConversationId, requestId: string, context: Context): Promise<SubmissionRecord | undefined>;

  findDocument(address: DocumentAddress, at: DocumentPoint, context: Context): Promise<DocumentRecord | undefined>;
  document(id: DocumentId, at: DocumentPoint, context: Context): Promise<StoredDocument | undefined>;
  scanDocuments(query: DocumentQuery, limit: number, cursor: Cursor | undefined, context: Context): Promise<Page<DocumentRecord, Cursor>>;

  close(context: Context): Promise<void>;
}
```
  
`StorageRejected`表示在任何持久化效果之前被拒绝的批次，并保证未提交。会话通常会将此类批次回滚；
未知的存储准入失败仍然是致命的，因为其提交状态不确定。后端仅在回滚有保证时，才使用 `StorageRejected` 作为确定性 `document.copy` 源、重放和一致性失败的来源。

一个 `document.copy` 读取已提交的预批次源状态，独立于命令顺序。源必须是所选时间点上存活的对话文档，并且 kind/key/history/fork 必须与子创建记录匹配。存储在源的存储版本上持久化一个独立的完整子基础。批次不能创建、更改或退役所选源。后续源的更改、回收、退役或后端重新打开不会影响子项。

游标是后端拥有的 JSON 对象。调用者只能将它们在同一个存储上进行往返操作；跨存储或跨查询使用不受支持。会话拥有变更线，因此存储实现不会为第二个面向调用者的提交互斥锁。每个后端仍然将一个已准入的批次视为原子操作。

`findLatestHeadMarker()` 返回最新且可见的条目，该条目携带 `head`，且在可选的包含截止值之下。返回的条目是标记；其 `head` 值才是上下文的实际下界。`scanEntries()` 在最新优先顺序下分页包含 ID 范围，同时应用每个对话的血统上限。无边界时分页完整可见历史。要通过条目 `E` 读取上下文，需找到在 `E` 之前或之前的标记，然后从 `marker?.head` 扫描至 `E`。对于当前上下文，上界被省略。对话所有者过滤器已索引且为与操作。它们支持无需全对话扫描的所有权遍历；应用维护的注册表不能替代这些内核索引。

`entry(id)` 结合了精确全局查找与历史文档读取所需的提交序列。`entry(conversationId, id)` 仅在条目可通过请求对话的血统可见时返回该对。`limit` 始终是最大分页大小。`findDocument()` 在当前或历史成员身份下解析一个精确的逻辑 kind/scope/key 地址。缺失的键意味着单例，而非每个家庭成员。`scanDocuments()` 仅枚举在所选时间点上某一精确范围中存活的化身，并可能限制某一家庭/单例 kind。它使用升序化身 ID。没有普通的就绪时间全文档扫描。任务查询支持对话、kind、存活/终结状态、中止标记和后台状态。

`document(id, at)` 实体化一个特定化身且不会跟随同一逻辑地址的替换。调用者在不持有化身 ID 时用 `findDocument()` 解析地址。它选择最新适用的基础，应用其有序的 Chord delta 尾部，并返回分离的实体化值、存储定义版本及超过该基础的重放 delta 数量。基础/delta 记录为后端私有。查找从不扫描无关文档。未知 ID 返回 `undefined`。在 `"current"`，退役化身返回 `undefined`。对可回滚对话化身的数字查找在半开启生命周期外返回 `undefined`，并在其中重建所选值。对已知当前仅有的化身的数字查找拒绝而非依赖已回收内容。元数据成员身份历史可查询。缺失必需基础、delta 尾内版本变更或无法在可寻址生命周期内应用的操作是存储损坏，而非缺失。

一个规范化批次最多包含一个化身的创建/变更内容命令，并且也可能退役该化身。存储在退役独立于写数组顺序前应用内容。创建加退役用批次序列同时标记生命周期边界。在同一逻辑地址的退役加创建使新化身在该序列下成为当前。delta 不能跨越存储版本边界；版本转换必须是基础。

语义符合套件涵盖内存、SQLite 和 JSONL。

## 11. 后端

### 11.1 内存

内存存储是引用语义。它复制保留的写值和所有读结果。这刻意模拟了 SQLite 编码/解码和 JSONL 序列化自然创建的所有权边界；它不是防御性的
验证。它保留可回退的记录，并且仅在已提交的基础或退休后才回收最新的记录。

### 11.2 SQLite 存储

一个SQL事务即为一个会话提交。SQLite存储：

- 对话、条目、任务和提交记录；
- 文档记录；
- 按文档和提交序列索引的文档基础/增量。

实时任务转换替换一行记录。终端任务保持为小记录。
文档读取使用索引的基础加尾部范围。第一个实现直接存储Chord记录；它不将通用操作转换为SQLite JSON函数。

模式形状、WAL检查点周期和同步默认值是后端实现选择，通过符合性、重新打开、查询计划和存储基准进行验证。

### 11.3 JSONL

JSONL依赖于可移植的`FileSystem`能力，而非更广泛的`ExecutionEnv`。它使用可回收的侧车，但不将其暴露给框架。仅持久化无法提供所有权边界：任何解码的索引、物化值或内存中保留的缓存都必须与提交参数分离，并且不能直接通过读取暴露。JSONL后端不能简单地在内存表别名周围添加文件追加操作。

```text
main.jsonl       table writes, document records, and one marker per commit
doc-<id>.jsonl   one document incarnation
task-<id>.jsonl  live task replacements
```

发布协议：

1. 将准备好的完整记录追加到每个受影响的侧车。
2. 追加一个完整的主标记，列出这些记录。
3. 仅在标记写入成功后，在内存中发布。

每个提交都使用此协议；没有独立侧车的快速路径。
JSONL创建接受一个`fsync`选项，默认为`false`。如果没有`fsync`，它仅保证普通进程崩溃的一致性，而不保证电源、主机、内核或文件系统故障的生存。如果有`fsync: true`，后端会追加所有受影响的侧车记录，刷新每个受影响的侧车，然后才追加主标记。普通发布不会显式刷新`main.jsonl`；因此，已确认的尾部提交可能仍然丢失，但存活的标记不应超过其侧车数据。仅主表的提交没有侧车要刷新。在使用`fsync: true`进行破坏性回收之前，后端会先刷新`main.jsonl`一次，以便授权标记不会消失，而其替换或移除的内容仍然存在。如果该刷新失败，已提交的状态仍会发布，回收将被延迟。非空的临时替换也会在重命名前被刷新。

恢复：

- 移除撕裂的末行。
- 忽略并移除未确认的侧车尾部。
- 仅应用已确认的记录。
- 缺少必需的已确认数据即为损坏，打开失败。
- 稍后提交的最新基础或退休可能证明早期的物理记录已无必要。
- 任何不确定的追加失败都会使后端处于中毒状态。

仅在授权基础/退休提交后才开始回收。当侧车记录不存在时，直接移除侧车。否则，写入临时替换，重命名，并使缓存的文件描述符失效，以便将来追加无法针对未链接的inode。刷新`main.jsonl`以授权回收不会压缩它。`main.jsonl`在初始实现中不会被压缩。

## 12. API陷阱

这些是契约，而非添加防御机制的邀请：

- **分离的草稿工作：**在会话回调确定后，草稿读取、草稿写入和所有`Tx`操作都将被拒绝。在回调确定之前运行的“即发即忘”工作仍可能修改活动事务，且不受支持。
- **写入后读取：**在第一个表写入之前，读取所有必需的表行。文档草稿在之后仍可使用；表读取则不可用。
- **向繁忙的对话写入：**仅框架可向正在运行的对话追加内容。在生成准备请求期间，`Harness.commit()`或自定义任务追加的原始条目可能导致系统提示条目错位；应使用写提交。
- **失败运行后的排队项：**失败和任务中止不会影响收件箱。排队的后续事项等待在`pi.inbox`中，且其`wait()`不会结算，直到下次提交的边界放置它们或主机撤回它们。
压缩摘要的提交内容如下：当手动或后台压缩在空闲对话中完成时，其最终边界会放置等待的后续操作并启动运行。

- **压缩花费：**每次手动和后台压缩都会为每次尝试支付一个摘要请求费用，当其摘要因后续压缩进一步裁剪而过期时同样适用。

- **压缩期间的头部和编辑：**摘要反映其压缩选择范围时的上下文。应用编辑在摘要期间放置，例如用写入替换条目20，当摘要裁剪超过其目标时会丢失：摘要仍然描述旧条目20，编辑的目标已超出范围。应用头部同时放置，例如在85处裁剪以忘记条目10-84，当摘要在90处裁剪时会被撤销：该摘要仍然描述10-84。请在压缩前放置此类写入。

- **摘要时间戳：**排队摘要的用户消息携带的是其压缩完成的时间，而非放置时间。根据消息时间戳判断使用过期的代码，例如pi-ai `estimateContextTokens()`对视图消息的判断，可能会误判；控制台估算使用条目顺序（第8.3节）。

- **直接写入过去的原始头部：**使用`tx.appendEntry()`直接写入的目标条目在对话的活动范围发生变化之前，但挂载的视图只会保留其已持有的条目直到挂载重建。使用写入提交，其过期检查会拒绝该写入。

- **重复计算的子代理花费：**运行所属对话的工具不得报告该对话的使用情况于其结果中；子代理的`pi.usage`已对其进行计数，子树总和会重复计数。

- **拥有者持有的工作：**拥有活跃普通工作的任务会保持`completing`直到该工作结束（第5.5节）。前台工作作为扩展启动于子代理对话中会持有调用工具，并随其持有运行；在子代理工具完成期间查询子代理会延长持有。Esc或主机超时会结束它；不应持有其拥有者的任务会被创建为对话拥有并`background`。

- **由钩子创建的工作：**钩子在请求任务的调用上下文中运行，因此它们创建的由该任务拥有的工作会持有该任务。必须延迟任务完成的工作必须在任务提交其结果之前创建；在发布事件后响应的监听器无法延长它。运行任务拥有的工作不得在运行释放后写入日志。

- **中止处理器的补偿：**中止处理器不能创建拥有子任务，因为其任务已被标记为中止。在执行该效果的层级、该任务自身的中止处理器、内联或通过后台对话拥有任务中进行补偿，这些任务使用`waitForTask()`等待；非后台任务会被任何达到其对话的级联中止。

- **钩子记忆名称：**钩子与请求任务共享记忆名称命名空间，并与其他钩子共享。请为记忆名称添加前缀。

- **长事务：**异步提交回调会保持会话突变行。绝不要在其中等待模型、工具、进程、网络调用、人类、嵌套会话提交或会话等待者。使用当前`Tx`上的方法。

- **显式创建：**只有类型`tx.doc()`会创建缺失文档。快照、状态和监视查找会返回`undefined`。

- **家族初始化：**首次获取缺失家族地址会选择其种子。现有实例和后续调用会忽略种子；种子既不是身份也不是更新。

- **检查点饥饿：**如果`checkpointWhen()`永远不返回true，重播和仅当前文档存储可以在文档活跃期间无限增长。

- **错误的分支设置：**`current`、`initial`和`asOf`是产品语义，而非优化。更改其中一个会改变子对话行为。

- **模式稳定性：**文档种类和可见挂载路径是持久化/公共协议。值迁移不能重命名种类；种类更改需要显式复制和退役。传递不兼容的定义
断言相同类型的令牌是未支持的调用者误用；会话不
维护一个文档定义注册表以检测它。
- **受信任的不可变修订版本：**`snapshot()`，状态值，监视值和
它们的后代可能会共享跟踪器拥有的容器。绝不修改它们；当需要可变所有权时，先复制。不提供运行时冻结功能。
- **手表激活：**在`start()`之前，`watch.value`仍然是不变的
获取修订版本。首先从它初始化消费者。启动后，the
property 在每次传递不可变版本之前会推进到其回调；
每一个早期的引用都保持稳定。

- **缓冲的观察：**慢速或未启动的观察最多保留100个精确提交的帧。溢出会用一个完整的根替换未送达的后缀，因此中间的已提交状态可能会被省略。必须审计每个转换的消费者必须将每个事实持久化到不可变的条目或日志中，并明确扫描该历史记录。

- **观察停止：**监听器可以调用并等待`stop()`；它防止未来的
callbacks 但既不会中止也不会加入正在运行的回调。
- **持久化进度节奏：**客户端仅能看到已提交的进度。崩溃可能会丢失当前未提交的节流窗口。
- **大型终端结果：**终端任务记录仍可查询。将大型结果放入条目或生命周期更长的文档中，并仅在结果中保留它们的ID。绝不引用由同一结果退役的任务范围文档。
- **原始转录：**视图条目不是模型上下文。渲染编辑、只读条目和模型过滤需要适当的还原器。
- **保留 `pi.` 名称：**任务名称、文档类型和以 `pi.` 开头的条目类型属于约定俗成的内置项。没有强制执行；重复使用会与 Harness 行为冲突，例如 `pi.system` 条目被回放为系统消息。
- **早期资源释放：**卸载或替换扩展程序只会停止新使用。立即释放资源可能会导致仍在运行的调用失败。
- **在选择中排除守护进程：**与一个省略守护扩展（例如权限钩子）的数组选择进行对话时，该对话将不包含该扩展。扩展是整体选择的；没有全局注册表钩子或包装器。
- **选择的编辑和复制：**`{ add, remove }`始终编辑主机默认选择。写入到复制了其所有者的任何选择的子进程中（其所有者为数组或`{ add, remove }`对象），它会替换该选择，因此子进程获得的是带有编辑内容的主机默认选择，而不是所有者的选择。从解析后的代理计算子进程的数组（参见7.3节）。
- **复制为一次性操作：**新任务拥有的对话在创建时会复制其所有者的`pi.agent`；之后所有者的变化不会影响它。分支会保留其`asOf`副本（参见2.2节）。
- **恢复后的环境：**工具在恢复后重新运行时会再次构建其环境，使用当前对话的`cwd`，这可能与第一次尝试时不同。
- **移动默认选择：**当设置或已安装的扩展发生变化时，对话上的默认选择会随之改变；每次变化都会追加`pi.system`条目，并错过提供程序提示缓存。
- **提示文本不稳定：**输出会随内容实际变化而变化的节渲染器（例如通过嵌入时间），会追加系统增量并破坏提供程序提示缓存。
- **关闭时不合作的代码：**关闭会加入每个调用。如果任务处理器、工具或钩子忽略其信号，`close()`将保持挂起状态，Storage将保持打开状态，直到它返回；取消关闭等待不会结束它。
- **服务超出承载器生命周期：**关闭承载器之前，撤回Chord服务并断开客户端连接。由关闭结束的状态会保留其最后值，并且不会再更新。
- **致命的存储错误：**发生不确定的存储故障后，Session会被毒化。不要捕获该错误并继续使用它。
- **JSONL持久性：**默认的JSONL排序处理普通进程崩溃；
没有持久模式，它并不保证已确认的提交能在电源或主机故障时存活。

## 13. 非目标

Pico5 初始时没有：

- 整个会话 DOM；
- 可见的非持久化发布；
- 会话内核语义事件日志或独立维护的事件状态；
- 会话范围的可回退文档；
- 自动检查点启发式算法；
- 自动第三方视图挂载；
- CRDT/离线多写合并；
- 将任意 Chord 操作翻译为 SQL；
- JSONL 全局压缩或自动修复损坏；
- 已移除 Pico 原型的兼容层；
- 强制终止单个进程中非合作扩展代码。

