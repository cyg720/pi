# @earendil-works/pi-agent-core

具备工具执行和事件流的有状态代理。基于`@earendil-works/pi-ai`构建。

## 安装

```bash
npm install @earendil-works/pi-agent-core
```

## 快速入门

```typescript
import { Agent } from "@earendil-works/pi-agent-core";
import { createModels } from "@earendil-works/pi-ai";
import { anthropicProvider } from "@earendil-works/pi-ai/providers/anthropic";

const models = createModels();
models.setProvider(anthropicProvider());
const model = models.getModel("anthropic", "claude-sonnet-4-6");
if (!model) throw new Error("Model not found");

const agent = new Agent({
  initialState: {
    systemPrompt: "You are a helpful assistant.",
    model,
  },
  streamFn: models.streamSimple.bind(models),
});

agent.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    // Stream just the new text chunk
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

await agent.prompt("Hello!");
```

## 核心概念

### 代理消息与LLM消息的区别

该代理与`AgentMessage`协同工作，后者是一种灵活的类型，可包含：
- 标准LLM消息（`user`、`assistant`、`toolResult`）
- 通过声明合并自定义应用特定的消息类型

LLMs仅能理解`user`、`assistant`和`toolResult`。`convertToLlm`函数通过在每次LLM调用前对消息进行过滤和转换，弥合了这一差距。

### 消息流

```
AgentMessage[] → transformContext() → AgentMessage[] → convertToLlm() → Message[] → LLM
                    (optional)                           (required)
```

1. **transformContext**：修剪旧消息，注入外部上下文
2. **convertToLlm**：过滤掉仅UI相关的消息，将自定义类型转换为LLM格式

## 事件流

代理会为UI更新发出事件。理解事件序列有助于构建响应式界面。

### prompt()事件序列

当你调用`prompt("Hello")`时：

```
prompt("Hello")
├─ agent_start
├─ turn_start
├─ message_start   { message: userMessage }      // Your prompt
├─ message_end     { message: userMessage }
├─ message_start   { message: assistantMessage } // LLM starts responding
├─ message_update  { message: partial... }       // Streaming chunks
├─ message_update  { message: partial... }
├─ message_end     { message: assistantMessage } // Complete response
├─ turn_end        { message, toolResults: [] }
└─ agent_end       { messages: [...] }
```

### 带工具调用时

如果助手调用了工具，循环将继续：

```
prompt("Read config.json")
├─ agent_start
├─ turn_start
├─ message_start/end  { userMessage }
├─ message_start      { assistantMessage with toolCall }
├─ message_update...
├─ message_end        { assistantMessage }
├─ tool_execution_start  { toolCallId, toolName, args }
├─ tool_execution_update { partialResult }           // If tool streams
├─ tool_execution_end    { toolCallId, result }
├─ message_start/end  { toolResultMessage }
├─ turn_end           { message, toolResults: [toolResult] }
│
├─ turn_start                                        // Next turn
├─ message_start      { assistantMessage }           // LLM responds to tool result
├─ message_update...
├─ message_end
├─ turn_end
└─ agent_end
```

工具执行模式可配置：

- `parallel`（默认）：工具调用先预检顺序执行，允许的工具并发执行，每个工具最终化后立即发出`tool_execution_end`，然后按助手源顺序发出工具结果消息和`turn_end.toolResults`
- `sequential`：工具调用依次执行，符合历史行为

在并行模式下，工具完成事件按工具完成顺序发出，但持久化工具结果消息仍按助手源顺序排列。

该模式可通过`toolExecution`在代理配置中全局设置，或通过`executionMode`在`AgentTool`上为单个工具设置。如果批次中的任何工具调用目标工具启用了`executionMode: "sequential"`，则无论全局设置如何，整个批次将顺序执行。

`beforeToolCall`钩子在`tool_execution_start`和验证参数解析后运行。它可以阻塞执行并将`terminate: true`附加到被阻塞的结果。`afterToolCall`钩子在工具执行完成后运行，且在`tool_execution_end`和最终工具结果消息事件发出前运行。

工具、被阻塞的`beforeToolCall`结果和`afterToolCall`覆盖可以返回`terminate: true`，以提示自动后续LLM调用应被跳过。只有当该批次中每个最终化工具结果均设置了`terminate: true`时，循环才会提前停止。混合批次将继续正常执行。

当你使用`Agent`类时，助手`message_end`处理被视为工具预检开始前的屏障。这意味着`beforeToolCall`会看到代理状态，其中已包含请求工具调用的助手消息。

### 请求准备和回合最终化

`prepareRequest`在每次对话提供者请求之前立即运行，包括首次请求。用于在已发出待处理输入后安装规范持久化上下文：

```typescript
agent.prepareRequest = async ({ context }) => ({
  context: { ...context, messages: await session.loadModelContext() },
});
```

`prepareRequest`不会轮询队列。在它运行期间处于排队状态会等待下一次正常排队轮询。

`finishTurn`在所有工具结果最终化后运行，但在`turn_end`之前。它对正常、错误和中止响应均有效：

```typescript
agent.finishTurn = async ({ message }) => {
  if (message.stopReason === "error" || message.stopReason === "aborted") return;
  if (shouldEndRun(message)) return { action: "end" };
  return needsAnotherResponse(message) ? { action: "continue" } : undefined;
};
```

返回`undefined`会保留正常调度。`{ action: "end" }`在`turn_end`后立即停止，不会轮询转向或后续队列，也不会准备另一个请求。对于正常响应，`{ action: "continue" }`确保会有一个下一个提供者请求。如果工具结果、转向或后续请求已导致该请求，则它们满足决策，不会发出额外请求；否则循环会发出一个仅上下文请求。错误和中止响应仍是硬退出，因此忽略其决策。`finishTurn`在下一次请求后再次运行，因此无条件返回`{ action: "continue" }`会创建无限循环。

要从已移除的`shouldStopAfterTurn`迁移，返回`{ action: "end" }`。保护错误和中止响应以保留旧钩子仅在正常响应时调用，尤其当谓词有副作用或假设成功响应时：

```typescript
finishTurn: async (turn, signal) => {
  if (turn.message.stopReason === "error" || turn.message.stopReason === "aborted") return;
  return (await shouldStop(turn, signal)) ? { action: "end" } : undefined;
},
```

每个提供者回合遵循此生命周期：

```text
selected input events
→ prepareRequest
→ provider response
→ tool results
→ finishTurn
→ turn_end
→ existing continuation scheduling or agent_end
```

### continue()和排队输入
`continue()`保持其原有的排队行为。空队列和系统专用转录将被拒绝，不会消耗队列。非助手尾部将继续使用现有上下文：引导在启动时被轮询，而后续输入将等待响应自然结束。

```typescript
agent.followUp({ role: "user", content: "After the retry", timestamp: Date.now() });
await agent.continue(); // The first request retries the existing user/toolResult tail.
```

无法直接发送助手尾部，因此`continue()`会回退为一个排队的引导批次，然后是一个排队的后续批次。排队模式仍然控制所选批次是否包含一条消息或所有消息：

```typescript
agent.steer({ role: "user", content: "Continue from here", timestamp: Date.now() });
await agent.continue(); // Uses the queued message only because the tail is assistant.
```

### 事件类型

| 事件 | 描述 |
|-------|-------------|
| `agent_start` | 代理开始处理 |
| `agent_end` | 运行的最终事件。此事件的等待订阅者仍计入结算 |
| `turn_start` | 新一轮开始（一次LLM调用+工具执行） |
| `turn_end` | 轮次完成，包含助手消息和工具结果 |
| `message_start` | 任何消息开始（用户、助手、工具结果） |
| `message_update` | **仅助手。** 包含`assistantMessageEvent`及增量 |
| `message_end` | 消息完成 |
| `tool_execution_start` | 工具开始 |
| `tool_execution_update` | 工具流式进度 |
| `tool_execution_end` | 工具完成 |

`Agent.subscribe()`监听器按注册顺序等待。`agent_end`表示不会再发出循环事件，但`await agent.waitForIdle()`和`await agent.prompt(...)`仅在`agent_end`监听器完成后才结算。

## 代理选项

```typescript
const agent = new Agent({
  // Initial state. systemPrompt and tools become the leading system message
  // unless messages already starts with one.
  initialState: {
    systemPrompt: string,
    model: Model<any>,
    thinkingLevel: "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max",
    tools: AgentTool<any>[],
    messages: AgentMessage[],
  },

  // Convert AgentMessage[] to LLM Message[] (required for custom message types)
  convertToLlm: (messages) => messages.filter(...),

  // Transform context before convertToLlm (for pruning, compaction)
  transformContext: async (messages, signal) => pruneOldMessages(messages),

  // Steering mode: "one-at-a-time" (default) or "all"
  steeringMode: "one-at-a-time",

  // Follow-up mode: "one-at-a-time" (default) or "all"
  followUpMode: "one-at-a-time",

  // Required stream function. Receives a TranscriptContext: the prompt and tools
  // are in the transcript's system messages, not on the context.
  streamFn: models.streamSimple.bind(models),

  // Session ID for provider caching
  sessionId: "session-123",

  // Dynamic API key resolution (for expiring OAuth tokens)
  getApiKey: async (provider) => refreshToken(),

  // Tool execution mode: "parallel" (default) or "sequential"
  toolExecution: "parallel",

  // Preflight each tool call after args are validated. Can block execution.
  beforeToolCall: async ({ toolCall, args, context }) => {
    if (toolCall.name === "bash") {
      return { block: true, reason: "bash is disabled", terminate: true };
    }
  },

  // Postprocess each tool result before final tool events are emitted.
  afterToolCall: async ({ toolCall, result, isError, context }) => {
    if (toolCall.name === "notify_done" && !isError) {
      return { terminate: true };
    }
    if (!isError) {
      return { details: { ...result.details, audited: true } };
    }
  },

  // Rebuild finalized context immediately before every provider request.
  prepareRequest: async ({ context }, signal) => {
    return { context: { ...context, messages: await loadCanonicalMessages(signal) } };
  },

  // Finalize a completed turn before turn_end is emitted.
  // `continue` ensures one next request; existing tool/queue scheduling can satisfy it.
  // `end` ends this run after turn_end without polling queues.
  finishTurn: async ({ message, toolResults }, signal) => {
    return shouldContinue(message, toolResults) ? { action: "continue" } : undefined;
  },

  // Custom thinking budgets for token-based providers
  thinkingBudgets: {
    minimal: 128,
    low: 512,
    medium: 1024,
    high: 2048,
  },
});
```

## 代理状态

```typescript
interface AgentState {
  model: Model<any>;
  thinkingLevel: ThinkingLevel;
  tools: AgentTool<any>[];
  messages: AgentMessage[];
  readonly isStreaming: boolean;
  readonly streamingMessage?: AgentMessage;
  readonly pendingToolCalls: ReadonlySet<string>;
  readonly errorMessage?: string;
}
```

通过`agent.state`访问状态。

将`agent.state.tools = [...]`或`agent.state.messages = [...]`赋值时，会先复制顶层数组再存储。修改返回的数组会修改当前代理状态。

转录拥有系统提示和工具声明：开头的系统消息是提示，后续系统消息对其进行补丁（参见pi-ai中的`SystemMessage`）。`agent.state.systemPrompt`只读，回放转录。`agent.state.tools`是可执行加载包；每次请求前，循环会将其与转录声明的工具进行比对，如果不同，则在系统消息中公告变更（当存在系统消息时合并到待处理系统消息中）。pi-ai的`getCurrentSystemMessage(messages)`返回回放头部，包括声明的工具，适用于任何消息数组，包括带有自定义消息角色的代理转录。

要中途更改提示，追加带有`content`（添加说明）或`sections`（命名替换）的系统消息：

```typescript
await agent.prompt([
  { role: "system", content: "", sections: { skills: "<skills>...</skills>" }, timestamp: Date.now() },
  { role: "user", content: "Continue", timestamp: Date.now() },
]);
```

流式传输时，`agent.state.streamingMessage`包含当前部分助手消息。

`agent.state.isStreaming`保持`true`状态，直到运行完全结束，包括等待`agent_end`订阅者。

## 方法

### 提示

```typescript
// Text prompt
await agent.prompt("Hello");

// With images
await agent.prompt("What's in this image?", [
  { type: "image", data: base64Data, mimeType: "image/jpeg" }
]);

// AgentMessage directly
await agent.prompt({ role: "user", content: "Hello", timestamp: Date.now() });

// Continue existing non-assistant input; an assistant tail may use queued input as fallback
await agent.continue();
```

### 状态管理

```typescript
agent.state.model = getModel("openai", "gpt-4o");
agent.state.thinkingLevel = "medium";
agent.state.tools = [myTool];
agent.toolExecution = "sequential";
agent.beforeToolCall = async ({ toolCall }) => undefined;
agent.afterToolCall = async ({ toolCall, result }) => undefined;
agent.prepareRequest = async ({ context }) => ({
  context: { ...context, messages: await loadCanonicalMessages() },
});
agent.finishTurn = async () => undefined;
agent.state.messages = newMessages; // top-level array is copied
agent.state.messages.push(message);
const nextQueuedMessages = agent.peekQueuedMessages(); // respects queue modes; does not consume
agent.reset();
```

### 会话和思考预算

```typescript
agent.sessionId = "session-123";

agent.thinkingBudgets = {
  minimal: 128,
  low: 512,
  medium: 1024,
  high: 2048,
};
```

### 控制

```typescript
agent.abort();           // Cancel current operation
await agent.waitForIdle(); // Wait for completion
```

### 事件

```typescript
const unsubscribe = agent.subscribe(async (event, signal) => {
  if (event.type === "agent_end") {
    // Final barrier work for the run
    await flushSessionState(signal);
  }
});
unsubscribe();
```

## 引导和后续

引导消息允许你在工具运行时中断代理。后续消息允许你在代理本应停止时排队工作。

```typescript
agent.steeringMode = "one-at-a-time";
agent.followUpMode = "one-at-a-time";

// While agent is running tools
agent.steer({
  role: "user",
  content: "Stop! Do this instead.",
  timestamp: Date.now(),
});

// After the agent finishes its current work
agent.followUp({
  role: "user",
  content: "Also summarize the result.",
  timestamp: Date.now(),
});

const steeringMode = agent.steeringMode;
const followUpMode = agent.followUpMode;

agent.clearSteeringQueue();
agent.clearFollowUpQueue();
agent.clearAllQueues();
```

使用clearSteeringQueue、clearFollowUpQueue或clearAllQueues清除排队消息。

检测到引导消息后，轮次完成：
1. 当前助手消息的所有工具调用已完成
2. 注入引导消息
3. LLM在下一轮回复

仅在没有更多工具调用且没有引导消息时才检查后续消息。如果有排队的后续消息，会注入并运行另一轮。

## 自定义消息类型

通过合并声明扩展`AgentMessage`：

```typescript
declare module "@earendil-works/pi-agent-core" {
  interface CustomAgentMessages {
    notification: { role: "notification"; text: string; timestamp: number };
  }
}

// Now valid
const msg: AgentMessage = { role: "notification", text: "Info", timestamp: Date.now() };
```

在`convertToLlm`中处理自定义类型：

```typescript
const agent = new Agent({
  streamFn: models.streamSimple.bind(models),
  convertToLlm: (messages) => messages.flatMap(m => {
    if (m.role === "notification") return []; // Filter out
    return [m];
  }),
});
```

## 工具

使用`AgentTool`定义工具：

```typescript
import { Type } from "typebox";

const readFileTool: AgentTool = {
  name: "read_file",
  label: "Read File",  // For UI display
  description: "Read a file's contents",
  parameters: Type.Object({
    path: Type.String({ description: "File path" }),
  }),
  // Override execution mode for this tool (optional).
  // "sequential" forces the entire batch to run one at a time.
  // "parallel" allows concurrent execution with other tool calls.
  // If omitted, the global toolExecution config applies.
  executionMode: "sequential",
  execute: async (toolCallId, params, signal, onUpdate) => {
    const content = await fs.readFile(params.path, "utf-8");

    // Optional: stream progress
    onUpdate?.({ content: [{ type: "text", text: "Reading..." }], details: {} });

    // Optional: add `terminate: true` here to skip the automatic follow-up LLM call
    // when every finalized tool result in the batch does the same.
    return {
      content: [{ type: "text", text: content }],
      details: { path: params.path, size: content.length },
    };
  },
};

agent.state.tools = [readFileTool];
```

### 错误处理

**抛出错误**当工具失败时。不要将错误消息作为内容返回。

```typescript
execute: async (toolCallId, params, signal, onUpdate) => {
  if (!fs.existsSync(params.path)) {
    throw new Error(`File not found: ${params.path}`);
  }
  // Return content only on success
  return { content: [{ type: "text", text: "..." }] };
}
```

抛出的错误会被代理捕获，并以工具错误的形式报告给LLM，使用`isError: true`。
`terminate: true` 从 `execute()`、被阻塞的 `beforeToolCall` 或 `afterToolCall` 返回，提示代理应在当前工具批次后停止。此提示仅在批次中所有最终工具结果均终止时生效。该提示为运行时仅有效；发出的 `toolResult` 转录消息仍为标准的 LLM 工具结果。

### MCP 和代码模式

`@earendil-works/pi-mcp` 连接到 MCP 服务器，`@earendil-works/pi-codemode` 运行由模型编写的 JavaScript 调用工具。[examples/mcp-codemode](examples/mcp-codemode) 将两者封装为 `AgentTool`s：每个 MCP 工具对应一个工具，以及一个 `codemode` 工具，其脚本通过 `runToolCall()` 调用代理的工具，因此 `beforeToolCall` 和 `afterToolCall` 也适用于这些调用。
## 代理使用

对于通过后端代理的浏览器应用：

```typescript
import { Agent, streamProxy } from "@earendil-works/pi-agent-core";

const agent = new Agent({
  streamFn: (model, context, options) =>
    streamProxy(model, context, {
      ...options,
      authToken: "...",
      proxyUrl: "https://your-server.com",
    }),
});
```

## 低级API

对于无需Agent类的直接控制：

```typescript
import { agentLoop, agentLoopContinue } from "@earendil-works/pi-agent-core";

const context: AgentContext = {
  messages: [{ role: "system", content: "You are helpful.", timestamp: Date.now() }],
  tools: [],
};

const config: AgentLoopConfig = {
  model: getModel("openai", "gpt-4o"),
  convertToLlm: (msgs) => msgs.filter(m => ["user", "assistant", "toolResult"].includes(m.role)),
  toolExecution: "parallel",  // overridden by per-tool executionMode if set
  beforeToolCall: async ({ toolCall, args, context }) => undefined,
  afterToolCall: async ({ toolCall, result, isError, context }) => undefined,
};

const userMessage = { role: "user", content: "Hello", timestamp: Date.now() };

const streamFn = models.streamSimple.bind(models);
for await (const event of agentLoop([userMessage], context, config, undefined, streamFn)) {
  console.log(event.type);
}

// Continue from existing context
for await (const event of agentLoopContinue(context, config, undefined, streamFn)) {
  console.log(event.type);
}
```

这些低级流是观察性的。它们保持事件顺序，但不会等待您的异步事件处理完成后再继续后续的生产阶段。如果您需要消息处理作为工具预检的屏障，请改用`Agent`类，而不是直接使用`agentLoop()`或`agentLoopContinue()`。

## 许可证

MIT

