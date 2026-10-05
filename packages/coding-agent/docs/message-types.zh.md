# 消息类型

Pi在SDK状态、生命周期事件、RPC响应和持久化会话消息条目中使用`AgentMessage`值。本页定义了这些共享消息及其内容块。

消息时间戳为毫秒级的Unix时间戳。它们与[会话条目](session-format.md#entry-base)上的ISO 8601时间戳不同。

源定义：

- [`packages/ai/src/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/ai/src/types.ts)定义了面向提供方的消息和内容块。
- [`packages/agent/src/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/agent/src/types.ts)定义了可扩展的`AgentMessage`联合体。
- [`packages/coding-agent/src/core/messages.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/messages.ts)增加了编码代理消息角色。

## 内容块

### 文本内容

```typescript
interface TextContent {
  type: "text";
  text: string;
  textSignature?: string;
}
```

`textSignature`包含提供方特定的消息元数据。将其视为不可见内容。

### 图像内容

```typescript
interface ImageContent {
  type: "image";
  data: string;
  mimeType: string;
}
```

`data`是base64编码的图像数据。`mimeType`标识其媒体类型，例如`image/png`或`image/jpeg`。

### 思考内容

```typescript
interface ThinkingContent {
  type: "thinking";
  thinking: string;
  thinkingSignature?: string;
  redacted?: boolean;
}
```

思考签名包含提供方特定的回放数据。将其视为不可见内容。已删除的块可能没有可见的思考文本，但仍保留加密的有效载荷`thinkingSignature`。

### 工具调用

```typescript
interface ToolCall {
  type: "toolCall";
  id: string;
  name: string;
  arguments: Record<string, any>;
  thoughtSignature?: string;
  namespace?: string;
}
```

`thoughtSignature`是提供方特定的。`namespace`标识OpenAI响应命名空间，用于动态加载或命名空间工具。

## 使用情况

助手消息始终包含使用情况。工具结果在工具执行嵌套模型工作时也可以包含使用情况。

```typescript
interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cacheWrite1h?: number;
  reasoning?: number;
  totalTokens: number;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
}
```

当存在时，`reasoning`已包含在`output`中；不要重复添加。`cacheWrite1h`是保留一小时的内容`cacheWrite`的子集。

## 基础消息

### 系统消息

```typescript
interface SystemMessage {
  role: "system";
  content: string | TextContent[];
  sections?: Record<string, string | null>;
  toolsAdded?: Tool[];
  toolsRemoved?: ToolReference[];
  replace?: boolean;
  timestamp: number;
}
```

引导系统消息声明了初始提示和工具。后续系统消息可以追加指令、替换或删除命名提示部分、添加或删除工具。按顺序回放它们可获得当前状态。带有`replace: true`的消息会丢弃先前状态并建立全新的基准。

### 用户消息

```typescript
interface UserMessage {
  role: "user";
  content: string | (TextContent | ImageContent)[];
  timestamp: number;
}
```


### 助手消息

```typescript
interface AssistantMessage {
  role: "assistant";
  content: (TextContent | ThinkingContent | ToolCall)[];
  api: string;
  provider: string;
  model: string;
  responseModel?: string;
  responseId?: string;
  providerThinkingLevel?: string;
  diagnostics?: AssistantMessageDiagnostic[];
  usage: Usage;
  stopReason: "pending" | "stop" | "length" | "toolUse" | "error" | "aborted" | "deferred";
  deferred?: DeferredHandle;
  errorMessage?: string;
  rawStopReason?: string;
  endTurn?: boolean;
  timestamp: number;
}
```

`responseModel`记录了提供方响应模型的具体内容，当其与请求的模型不同时。`responseId`、`providerThinkingLevel`、`diagnostics`和`rawStopReason`保留了提供方或运行时的详细信息。

`"pending"`用于流式传输时的助手消息片段。完成的消息`message_end`带有终止停止原因，Pi不会将`"pending"`助手消息持久化到会话JSONL中。

`"deferred"`响应包含`DeferredHandle`，其中包含检索该响应所需的数据：

```typescript
interface DeferredHandle {
  provider: string;
  modelId: string;
  api: string;
  id: string;
  expiresAt?: number;
  pollAfterMs?: number;
  data?: JsonValue;
}
```

### 工具结果消息

```typescript
interface ToolResultMessage<TDetails = any> {
  role: "toolResult";
  toolCallId: string;
  toolName: string;
  content: (TextContent | ImageContent)[];
  details?: TDetails;
  usage?: Usage;
  isError: boolean;
  timestamp: number;
}
```

`details`是工具特定的。可选的`usage`报告了工具执行的嵌套模型工作，有助于全会话统计，但不属于主要模型调用的使用情况。

## 编码代理消息

编码代理包扩展了`AgentMessage`，增加了四个角色。

### Bash执行消息

由直接shell命令创建，包括RPC[`bash`](rpc-commands.md#bash)命令。它不是LLM工具结果。

```typescript
interface BashExecutionMessage {
  role: "bashExecution";
  command: string;
  output: string;
  exitCode: number | undefined;
  cancelled: boolean;
  truncated: boolean;
  fullOutputPath?: string;
  excludeFromContext?: boolean;
  timestamp: number;
}
```

除非`excludeFromContext`为真，否则Pi会在下一次模型请求前将该消息转换为用户角色文本。

### 自定义消息

由扩展发送上下文消息时创建。

```typescript
interface CustomMessage<T = unknown> {
  role: "custom";
  customType: string;
  content: string | (TextContent | ImageContent)[];
  display: boolean;
  details?: T;
  timestamp: number;
}
```

Pi会将其内容转换为用户消息用于模型请求。`display`控制终端渲染；`details`不会发送到模型。

### 分支摘要消息

```typescript
interface BranchSummaryMessage {
  role: "branchSummary";
  summary: string;
  fromId: string | null;
  timestamp: number;
}
```

Pi从持久化的`branch_summary`条目创建此上下文消息。

### 压缩摘要消息

```typescript
interface CompactionSummaryMessage {
  role: "compactionSummary";
  summary: string;
  tokensBefore: number;
  timestamp: number;
}
```

Pi从持久化的`compaction`条目创建此上下文消息。

## 代理消息联合体

在编码代理中，联合体等同于：

```typescript
type AgentMessage =
  | SystemMessage
  | UserMessage
  | AssistantMessage
  | ToolResultMessage
  | BashExecutionMessage
  | CustomMessage
  | BranchSummaryMessage
  | CompactionSummaryMessage;
```

在较低级别的代理包中，`AgentMessage`是`Message | CustomAgentMessages[keyof CustomAgentMessages]`。应用程序可以通过TypeScript声明合并添加角色，因此消费者在接收增强主机的消息时应容忍未知的自定义角色。

