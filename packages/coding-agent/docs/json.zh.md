# JSON 事件流

JSON 模式为一次调用输出结构化的进度信息：

```bash
pi --mode json "Review this repository"
```

Pi 先写入一个会话头，接着写入会话事件，最后在提示完成之后退出。RPC 模式输出的会话事件形状相同，但没有会话头，因为它是一种双向、长连接的协议。详见 [RPC 模式](rpc.md)。

本页是 JSON 模式和 RPC 模式共享事件的权威参考。消息值使用 [共享的消息类型](message-types.md)。

## 帧和进程 I/O

该流使用严格的 JSONL 帧。每条记录是一个以 LF（`\n`）结尾的 JSON 对象。只按 LF 分割记录，并可选地去掉前面的回车。Unicode 换行和段落分隔符可以出现在 JSON 字符串内，不是记录边界。

Node.js `readline` 不适合该流，因为它也识别这些 Unicode 分隔符。请使用字节或 UTF-8 流解码器，并按 LF 分割。

持续读取 stdout。停止消费记录的读取器可能会导致 Pi 在管道缓冲区填满时停滞。stdout 专用于 JSONL；诊断和应用日志输出到 stderr。

## 会话头

JSON 模式的第一条记录是当前的 [会话头](session-format.md#sessionheader)：

```json
{"type":"session","version":3,"id":"uuid","timestamp":"2024-12-03T14:00:00.000Z","cwd":"/path"}
```

RPC 模式不输出此记录。请使用 [`get_state`](rpc-commands.md#get_state) 获取当前会话 ID 和文件。

## 事件序列

一次基本运行会产生类似以下记录：

```json
{"type":"agent_start"}
{"type":"turn_start"}
{"type":"message_start","message":{"role":"user","content":"Review this repository","timestamp":1733234401000}}
{"type":"message_end","message":{"role":"user","content":"Review this repository","timestamp":1733234401000}}
{"type":"message_start","message":{"role":"assistant","content":[],"stopReason":"pending","...":"..."}}
{"type":"message_update","usage":{"...":"..."},"assistantMessageEvent":{"type":"text_delta","contentIndex":0,"delta":"Hello"}}
{"type":"message_end","message":{"role":"assistant","...":"..."}}
{"type":"turn_end","message":{"role":"assistant","...":"..."},"toolResults":[]}
{"type":"agent_end","messages":[{"...":"..."}],"willRetry":false}
{"type":"agent_settled"}
```

`agent_end` 表示一个低级代理运行已结束。自动重试、溢出恢复、压缩重试、路由或后续工作仍可能继续。`agent_settled` 表示 Pi 对该会话级运行没有剩余的自动工作。

## 代理和轮到谁的事件

| 事件 | 字段 | 含义 |
|---|---|---|
| `agent_start` | 无 | 一个低级代理运行已开始。 |
| `agent_end` | `messages`, `willRetry` | 该低级运行已结束。`messages` 包含该运行生成的消息。 |
| `agent_settled` | 无 | Pi 不会通过重试、压缩恢复或排队消息继续自动执行。 |
| `turn_start` | None | 一个助手的轮询开始了。 |
| `turn_end` | `message`, `toolResults` | 一个助手的响应及其产生的工具调用和结果完成了。 |

一个轮询包括一个助手的响应，以及该响应产生的任何工具调用和工具结果。

##  消息事件

| 事件 | 字段 | 含义 |
|---|---|---|
| `message_start` | `message` | 一条消息开始了。 |
| `message_update` | `usage`, `assistantMessageEvent` | 助手消息发出内容块更新。 |
| `message_end` | `message` | 一条消息完成了。这是权威的最终消息。 |

###  恢复流式消息

线上的`message_update`记录是增量式的。它们省略了SDK事件的累计`message`字段和每一个`assistantMessageEvent.partial`快照，以保持流的大小线性增长。

嵌套事件之一为：

| 类型 | 除`type`之外的字段 | 含义 |
|---|---|---|
| `start` | 无 | 提供商流开始了；其累计`partial`字段在线上被移除。 |
| `text_start` | `contentIndex` | 文本块开始了。 |
| `text_delta` | `contentIndex`, `delta` | 向块中追加文本。 |
| `text_end` | `contentIndex`, `content` | 文本块以权威内容结束。 |
| `thinking_start` | `contentIndex` | 思考块开始了。 |
| `thinking_delta` | `contentIndex`, `delta` | 向思考块中追加思考文本。 |
| `thinking_end` | `contentIndex`, `content` | 思考块以权威内容结束。 |
| `toolcall_start` | `contentIndex`, `id`, `toolName` | 工具调用块开始了。 |
| `toolcall_delta` | `contentIndex`, `delta` | 追加序列化参数数据。 |
| `toolcall_end` | `contentIndex`, `toolCall` | 工具调用以完整的`ToolCall`结束。 |
| `done` | `reason`, `message` | 提供商流成功完成。 |
| `error` | `reason`, `error` | 提供商流以错误或中止消息结束。 |
正常的代理循环将提供者级别的`start`、`done`和`error`转换为`message_start`和`message_end`会话事件，而不是以`message_update`的形式发出。它们仍通过导出的`JsonAgentSessionEvent`转换对构造匹配会话事件的调用者保持允许状态。

使用`contentIndex`标识内容块。缓冲`delta`字段以供现场显示，但用`text_end`、`thinking_end`或`toolcall_end`中完成的内容替换重建数据。当其到达时，用`message_end.message`替换整个部分消息。

顶层`usage`是助手响应的最新累计提供商报告使用量。当提供商在流式传输过程中未报告使用量时，其值可以保持为零直到完成。

```json
{"type":"message_update","usage":{"input":100,"output":1,"cacheRead":0,"cacheWrite":0,"totalTokens":101,"cost":{"input":0,"output":0,"cacheRead":0,"cacheWrite":0,"total":0}},"assistantMessageEvent":{"type":"text_delta","contentIndex":0,"delta":"Hello "}}
```
  
## 工具执行事件

| 事件 | 字段 | 含义 |
|---|---|---|
| `tool_execution_start` | `toolCallId`、`toolName`、`args` | 工具执行开始。 |
| `tool_execution_update` | `toolCallId`、`toolName`、`args`、`partialResult` | 工具报告部分结果。 |
| `tool_execution_end` | `toolCallId`、`toolName`、`result`、`isError` | 工具执行完成。 |

使用`toolCallId`关联生命周期。`partialResult`是工具提供的最新部分结果。它是否替换或扩展更早的更新取决于该工具的结果合同。

```json
{"type":"tool_execution_start","toolCallId":"call_abc123","toolName":"bash","args":{"command":"ls -la"}}
{"type":"tool_execution_update","toolCallId":"call_abc123","toolName":"bash","args":{"command":"ls -la"},"partialResult":{"content":[{"type":"text","text":"partial output"}],"details":{}}}
{"type":"tool_execution_end","toolCallId":"call_abc123","toolName":"bash","result":{"content":[{"type":"text","text":"complete output"}],"details":{}},"isError":false}
```
  
## 队列和状态事件

| 事件 | 字段 | 含义 |
|---|---|---|
| `queue_update` | `steering`、`followUp` | 待处理的转向或后续队列发生变化。两个字段均包含当前完整的队列。 |
| `entry_appended` | `entry` | 通过`pi.appendEntry()`附加了一个自定义会话条目。 |
| `session_info_changed` | `name` | 会话显示名称发生变化。缺少`name`表示其被清除。 |
| `thinking_level_changed` | `level` | 活动思考级别发生变化。 |

`entry`的值使用了持久化的[会话条目类型](session-format.md#entry-types)。

## 压缩事件

`compaction_start`报告压缩开始的原因：

```json
{"type":"compaction_start","reason":"threshold"}
```
  
`reason`是`"manual"`、`"threshold"`或`"overflow"`。

`compaction_end`包含压缩成功的结果：

```json
{
  "type": "compaction_end",
  "reason": "threshold",
  "result": {
    "summary": "Summary of conversation...",
    "firstKeptEntryId": "abc123",
    "tokensBefore": 150000,
    "estimatedTokensAfter": 32000,
    "usage": {"...": "..."},
    "details": {}
  },
  "aborted": false,
  "willRetry": false
}
```
  
如果压缩被中止，`result`缺失且`aborted`为true。如果失败，`result`缺失，`aborted`为false，`errorMessage`描述了失败。成功溢出恢复会将`willRetry`设置为true，然后Pi重试提示。

有关结果语义，请参见[压缩和分支摘要](compaction.md)。

## 重试事件

助手轮询重试发出：

```json
{"type":"auto_retry_start","attempt":1,"maxAttempts":3,"delayMs":2000,"errorMessage":"529 overloaded"}
{"type":"auto_retry_end","success":true,"attempt":2}
```
  
最终失败时，`auto_retry_end`包含`success: false`和一个`finalError`字符串。

压缩和分支摘要重试发出：

```json
{"type":"summarization_retry_scheduled","attempt":1,"maxAttempts":3,"delayMs":2000,"errorMessage":"terminated"}
{"type":"summarization_retry_attempt_start","source":"compaction","reason":"threshold"}
{"type":"summarization_retry_finished"}
```
  
对于分支摘要，`source`是`"branchSummary"`，`reason`缺失。`reason`在压缩重试时是`"manual"`、`"threshold"`或`"overflow"`。

## 仅RPC事件

直接RPC [`bash`](rpc-commands.md#bash)命令为每个输出片段发出一个`bash_execution_update`。其可选的`id`与命令ID匹配。最终命令响应可能包含截断的输出，但这些事件会流式传输所有输出：

```json
{"type":"bash_execution_update","id":"req-1","delta":"total 48\n"}
```
  
RPC在扩展处理器抛出时还会添加`extension_error`：

```json
{"type":"extension_error","extensionPath":"/path/to/extension.ts","event":"tool_call","error":"Error message"}
```
  
扩展UI记录是独立的RPC子协议，不是`AgentSessionEvent`的值。请参见[RPC扩展UI](rpc-extension-ui.md)。

## TypeScript类型

SDK的`AgentSessionEvent`包含累积的流式快照，供进程内消费者使用。JSON和RPC仅转换`message_update`：

```typescript
type WithoutPartial<T> = T extends { partial: unknown } ? Omit<T, "partial"> : T;

type JsonAssistantMessageEvent<T> = T extends { type: "toolcall_start"; partial: unknown }
  ? WithoutPartial<T> & { id: string; toolName: string }
  : WithoutPartial<T>;

type JsonAgentSessionEvent =
  | Exclude<AgentSessionEvent, { type: "message_update" }>
  | {
      type: "message_update";
      usage: Usage;
      assistantMessageEvent: JsonAssistantMessageEvent<AssistantMessageEvent>;
    };
```
  
使用从`@earendil-works/pi-coding-agent`导出的`JsonAgentSessionEvent`类型。其实现位于[`json-event.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/modes/json-event.ts)。

## 示例

打印一次运行完成的消息：

```bash
pi --mode json "List files" 2>/dev/null | jq -c 'select(.type == "message_end")'
```


