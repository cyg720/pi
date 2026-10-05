# RPC命令

本参考列出了在[RPC模式](rpc.md)下接受的stdin命令。每个命令和响应均为一个JSON对象。共享消息值使用[消息类型](message-types.md)。

## 提示

### prompt

将用户提示发送给代理。命令响应在提示被接受、排队或处理后发出。事件将继续异步流式传输。

```json
{"id": "req-1", "type": "prompt", "message": "Hello, world!"}
```

带图片：
```json
{"type": "prompt", "message": "What's in this image?", "images": [{"type": "image", "data": "base64-encoded-data", "mimeType": "image/png"}]}
```

**流式传输中**：如果代理正在流式传输，您必须指定`streamingBehavior`以排队消息：

```json
{"type": "prompt", "message": "New instruction", "streamingBehavior": "steer"}
```

- `"steer"`：在代理运行时排队消息。它在当前助手轮次完成其工具调用后被传递，然后是下一个LLM调用。
- `"followUp"`：等待代理完成。消息仅在代理停止时传递。

如果代理正在流式传输且未指定`streamingBehavior`，命令将返回错误。

**扩展命令**：如果消息是扩展命令（例如`/mycommand`），它即使在流式传输中也会立即执行。扩展命令通过`pi.sendMessage()`管理自己的LLM交互。

**输入扩展**：技能命令（`/skill:name`）和提示模板（`/template`）在发送/排队前会被扩展。

响应：
```json
{"id": "req-1", "type": "response", "command": "prompt", "success": true, "data": {"disposition": "started"}}
```

`data.disposition`是`"handled"`，如果扩展命令或输入处理器消费了提示，是`"queued"`，如果Pi在运行期间排队了它，或`"started"`，如果Pi接受它以启动运行。这描述了提交的提示，而不是由扩展或保证完成的独立工作。

`success: true`表示提示被接受、排队或立即处理。`success: false`表示提示在被接受前被拒绝。接受后失败的报告通过正常事件和消息流进行，而不是作为对相同请求ID的第二个`response`。

`images`字段是可选的。每张图片使用`ImageContent`格式：`{"type": "image", "data": "base64-encoded-data", "mimeType": "image/png"}`。

### steer

在代理运行时排队一个转向消息。它在当前助手轮次完成其工具调用后被传递，然后是下一个LLM调用。技能命令和提示模板会被扩展。不允许使用扩展命令（使用`prompt`代替）。
```json
{"type": "steer", "message": "Stop and do this instead"}
```

附带图片：
```json
{"type": "steer", "message": "Look at this instead", "images": [{"type": "image", "data": "base64-encoded-data", "mimeType": "image/png"}]}
```

`images`字段为可选。每张图片使用`ImageContent`格式（与`prompt`相同）。

回复：
```json
{"type": "response", "command": "steer", "success": true, "data": {"disposition": "queued"}}
```

`data.disposition`是`"handled"`，如果输入处理器消费了此指令，或者`"queued"`，如果Pi将其排队（包括在处理器转换它之后）。这并不保证该消息保持在队列中。

有关如何控制转向消息的处理方式，请参见[set_steering_mode](#set_steering_mode)。

### 后续处理

排队一个后续消息，在代理完成处理后进行处理。仅在代理没有更多工具调用或转向消息时发送。技能命令和提示模板会进行扩展。不允许使用扩展命令（请使用`prompt`代替）。

```json
{"type": "follow_up", "message": "After you're done, also do this"}
```

附带图片：
```json
{"type": "follow_up", "message": "Also check this image", "images": [{"type": "image", "data": "base64-encoded-data", "mimeType": "image/png"}]}
```

`images`字段为可选。每张图片使用`ImageContent`格式（与`prompt`相同）。

回复：
```json
{"type": "response", "command": "follow_up", "success": true, "data": {"disposition": "queued"}}
```

`data.disposition`与`"handled"`或`"queued"`对`steer`的含义相同，应用于此后续消息。

有关如何控制后续消息的处理方式，请参见[set_follow_up_mode](#set_follow_up_mode)。

### 中止

中止当前操作，等待会话空闲后再进行回复。

```json
{"type": "abort"}
```

回复：
```json
{"type": "response", "command": "abort", "success": true}
```

### 清空队列

移除排队的转向和后续消息，并返回其文本。

```json
{"type": "clear_queue"}
```

回复：
```json
{
  "type": "response",
  "command": "clear_queue",
  "success": true,
  "data": {
    "steering": ["Change direction"],
    "followUp": ["Summarize when finished"]
  }
}
```

为实现交互式Esc行为，请在发送`clear_queue`之前发送`abort`，然后在客户端编辑器中恢复返回的文本。`abort`会在会话中继续处理排队的消息。

### 新会话

启动一个全新的会话。可以通过`session_before_switch`扩展事件处理器进行取消。

```json
{"type": "new_session"}
```

可选的父会话跟踪：
```json
{"type": "new_session", "parentSession": "/path/to/parent-session.jsonl"}
```

回复：
```json
{"type": "response", "command": "new_session", "success": true, "data": {"cancelled": false}}
```

如果扩展被取消：
```json
{"type": "response", "command": "new_session", "success": true, "data": {"cancelled": true}}
```

## 状态

### 获取状态

获取当前会话状态。

```json
{"type": "get_state"}
```

回复：
```json
{
  "type": "response",
  "command": "get_state",
  "success": true,
  "data": {
    "model": {...},
    "thinkingLevel": "medium",
    "isStreaming": false,
    "isCompacting": false,
    "steeringMode": "all",
    "followUpMode": "one-at-a-time",
    "sessionFile": "/path/to/session.jsonl",
    "sessionId": "abc123",
    "sessionName": "my-feature-work",
    "autoCompactionEnabled": true,
    "messageCount": 5,
    "pendingMessageCount": 0
  }
}
```

`model`字段是一个完整的[模型](#model-object)对象，如果没有选择模型，则省略。`sessionName`字段是通过`set_session_name`设置的显示名称，如果没有设置则省略。

### get_messages

获取对话中的所有消息。

```json
{"type": "get_messages"}
```

响应：
```json
{
  "type": "response",
  "command": "get_messages",
  "success": true,
  "data": {"messages": [...]}
}
```

消息是`AgentMessage`对象（参见[消息类型](message-types.md)）。

## 模型

### set_model

切换到特定的模型。

```json
{"type": "set_model", "provider": "anthropic", "modelId": "claude-sonnet-4-20250514"}
```

响应包含完整的[模型](#model-object)对象：
```json
{
  "type": "response",
  "command": "set_model",
  "success": true,
  "data": {...}
}
```

### cycle_model

切换到下一个可用的模型。如果只有一个模型可用，则返回`null`数据。

```json
{"type": "cycle_model"}
```

响应：
```json
{
  "type": "response",
  "command": "cycle_model",
  "success": true,
  "data": {
    "model": {...},
    "thinkingLevel": "medium",
    "isScoped": false
  }
}
```

`model`字段是一个完整的[模型](#model-object)对象。

### get_available_models

列出所有已配置的模型。

```json
{"type": "get_available_models"}
```

响应包含一个完整的[模型](#model-object)对象数组：
```json
{
  "type": "response",
  "command": "get_available_models",
  "success": true,
  "data": {
    "models": [...]
  }
}
```

## 思考

### set_thinking_level

为支持该功能的模型设置推理/思考级别。

```json
{"type": "set_thinking_level", "level": "high"}
```

级别：`"off"`、`"minimal"`、`"low"`、`"medium"`、`"high"`、`"xhigh"`、`"max"`

`"xhigh"`和`"max"`仅在所选模型支持时才会暴露。部分模型（包括GPT-5.6）会同时暴露两者。

响应：
```json
{"type": "response", "command": "set_thinking_level", "success": true}
```

### cycle_thinking_level

循环切换可用的思考级别。如果模型不支持思考，则返回`null`数据。

```json
{"type": "cycle_thinking_level"}
```

响应：
```json
{
  "type": "response",
  "command": "cycle_thinking_level",
  "success": true,
  "data": {"level": "high"}
}
```

### get_available_thinking_levels

列出当前模型支持的思考级别。如果模型不支持推理功能，则返回`["off"]`。

```json
{"type": "get_available_thinking_levels"}
```

响应：
```json
{
  "type": "response",
  "command": "get_available_thinking_levels",
  "success": true,
  "data": {
    "levels": ["off", "minimal", "low", "medium", "high"]
  }
}
```

## 队列模式

<a id="set_steering_mode"></a>
### set_steering_mode

控制转向消息（来自`steer`）的传递方式。

```json
{"type": "set_steering_mode", "mode": "one-at-a-time"}
```

模式：
- `"all"`：在当前助手轮次执行完所有工具调用后再传递所有转向消息
- `"one-at-a-time"`：每个完成的助手轮次传递一条转向消息（默认）

响应：
```json
{"type": "response", "command": "set_steering_mode", "success": true}
```

<a id="set_follow_up_mode"></a>
### set_follow_up_mode

控制后续消息（来自`follow_up`）的传递方式。

```json
{"type": "set_follow_up_mode", "mode": "one-at-a-time"}
```

模式：
- `"all"`：当代理完成时传递所有后续消息
- `"one-at-a-time"`：每个代理完成传递一条后续消息（默认）

响应：
```json
{"type": "response", "command": "set_follow_up_mode", "success": true}
```

## 压缩

### compact

手动压缩对话上下文以减少令牌使用。

```json
{"type": "compact"}
```

带有自定义指令：
```json
{"type": "compact", "customInstructions": "Focus on code changes"}
```

响应：
```json
{
  "type": "response",
  "command": "compact",
  "success": true,
  "data": {
    "summary": "Summary of conversation...",
    "firstKeptEntryId": "abc123",
    "tokensBefore": 150000,
    "estimatedTokensAfter": 32000,
    "usage": {
      "input": 32000,
      "output": 1200,
      "cacheRead": 0,
      "cacheWrite": 0,
      "totalTokens": 33200,
      "cost": {"input": 0.01, "output": 0.02, "cacheRead": 0, "cacheWrite": 0, "total": 0.03}
    },
    "details": {}
  }
}
```

`estimatedTokensAfter`是对压缩后重建的消息上下文的启发式估算，不是提供者精确的令牌计数。`usage`报告生成摘要的LLM调用，可能由自定义压缩处理器省略。

### set_auto_compaction

启用或禁用当上下文接近满时的自动压缩。

```json
{"type": "set_auto_compaction", "enabled": true}
```

响应：
```json
{"type": "response", "command": "set_auto_compaction", "success": true}
```

## 重试

### set_auto_retry

启用或禁用对瞬时错误（过载、速率限制、5xx）的自动重试。

```json
{"type": "set_auto_retry", "enabled": true}
```

响应：
```json
{"type": "response", "command": "set_auto_retry", "success": true}
```

### abort_retry

中止正在进行的重试（取消延迟并停止重试）。

```json
{"type": "abort_retry"}
```

响应：
```json
{"type": "response", "command": "abort_retry", "success": true}
```

## Bash

### bash

执行shell命令并将输出添加到对话上下文。命令运行时以`bash_execution_update`事件流式输出；响应包含最终结果。

```json
{"id": "req-1", "type": "bash", "command": "ls -la"}
```

将`excludeFromContext`设置为`true`，当命令输出应存储在会话中但下次提示时从模型上下文中省略。

包含一个`id`以关联此命令的流式`bash_execution_update`事件。

响应：
```json
{
  "id": "req-1",
  "type": "response",
  "command": "bash",
  "success": true,
  "data": {
    "output": "total 48\ndrwxr-xr-x ...",
    "exitCode": 0,
    "cancelled": false,
    "truncated": false
  }
}
```

如果输出被截断，包含`fullOutputPath`：
```json
{
  "type": "response",
  "command": "bash",
  "success": true,
  "data": {
    "output": "truncated output...",
    "exitCode": 0,
    "cancelled": false,
    "truncated": true,
    "fullOutputPath": "/tmp/pi-bash-abc123.log"
  }
}
```

**bash结果如何传递给LLM：**

执行`bash`命令会立即返回`BashResult`。内部会创建并存储`BashExecutionMessage`到代理的消息状态中。
当发送下一个`prompt`命令时，Pi会在将上下文消息发送给模型之前对其进行转换。除非`excludeFromContext`为真，否则`BashExecutionMessage`将转换为以下格式的`UserMessage`：

````
Ran `ls -la`
```
total 48
drwxr-xr-x ...
```
````

这意味着：
1. 包含的bash输出将在**下一个提示**中发送到模型，而不是立即发送。
2. 多个bash命令可以在一个提示之前运行；Pi会包含每个没有设置`excludeFromContext`的输出。

### abort_bash

中止正在运行的bash命令。

```json
{"type": "abort_bash"}
```

回复：
```json
{"type": "response", "command": "abort_bash", "success": true}
```

## 会话

### get_session_stats

获取令牌使用情况、成本统计和当前上下文窗口使用情况。

```json
{"type": "get_session_stats"}
```

回复：
```json
{
  "type": "response",
  "command": "get_session_stats",
  "success": true,
  "data": {
    "sessionFile": "/path/to/session.jsonl",
    "sessionId": "abc123",
    "userMessages": 5,
    "assistantMessages": 5,
    "toolCalls": 12,
    "toolResults": 12,
    "totalMessages": 22,
    "tokens": {
      "input": 50000,
      "output": 10000,
      "cacheRead": 40000,
      "cacheWrite": 5000,
      "total": 105000
    },
    "cost": 0.45,
    "contextUsage": {
      "tokens": 60000,
      "contextWindow": 200000,
      "percent": 30
    }
  }
}
```

`tokens`和`cost`包含助手消息、工具报告的使用情况以及跨完整会话的压缩/分支摘要生成。`contextUsage`包含实际当前上下文窗口估计值，用于压缩和页脚显示。

`contextUsage`在没有模型或上下文窗口可用时被省略。`contextUsage.tokens`和`contextUsage.percent`是`null`，直到新的压缩后助手回复提供有效的使用数据。

### export_html

将会话导出为HTML文件。

```json
{"type": "export_html"}
```

自定义路径：
```json
{"type": "export_html", "outputPath": "/tmp/session.html"}
```

回复：
```json
{
  "type": "response",
  "command": "export_html",
  "success": true,
  "data": {"path": "/tmp/session.html"}
}
```

### switch_session

加载不同的会话文件。可以通过`session_before_switch`扩展事件处理器取消。

```json
{"type": "switch_session", "sessionPath": "/path/to/session.jsonl"}
```

回复：
```json
{"type": "response", "command": "switch_session", "success": true, "data": {"cancelled": false}}
```

如果扩展取消了切换：
```json
{"type": "response", "command": "switch_session", "success": true, "data": {"cancelled": true}}
```

### fork

从当前活动分支的先前用户消息创建一个新分支。可以通过`session_before_fork`扩展事件处理器取消。返回正在被分叉的消息文本。

```json
{"type": "fork", "entryId": "abc123"}
```

回复：
```json
{
  "type": "response",
  "command": "fork",
  "success": true,
  "data": {"text": "The original prompt text...", "cancelled": false}
}
```

如果扩展取消了分叉：
```json
{
  "type": "response",
  "command": "fork",
  "success": true,
  "data": {"cancelled": true}
}
```

### clone

将当前活动分支复制为新的会话，位置不变。可以通过`session_before_fork`扩展事件处理器取消。

```json
{"type": "clone"}
```

回复：
```json
{
  "type": "response",
  "command": "clone",
  "success": true,
  "data": {"cancelled": false}
}
```

如果扩展取消了克隆：
```json
{
  "type": "response",
  "command": "clone",
  "success": true,
  "data": {"cancelled": true}
}
```

### get_fork_messages

获取可用于分叉的用户消息。
```json
{"type": "get_fork_messages"}
```

Response:
```json
{
  "type": "response",
  "command": "get_fork_messages",
  "success": true,
  "data": {
    "messages": [
      {"entryId": "abc123", "text": "First prompt..."},
      {"entryId": "def456", "text": "Second prompt..."}
    ]
  }
}
```

### get_entries

获取会话条目，按追加顺序排列（不包括会话头）。会话是一个只追加的条目树，具有稳定的ID，因此条目ID可作为持久游标使用：将您上次看到的最后一个条目ID作为`since`传递，以获取仅在它之后的条目，即使在客户端重启后也是如此。与`get_messages`不同，这包括预压缩历史记录和废弃的分支。

```json
{"type": "get_entries"}
```

使用游标：
```json
{"type": "get_entries", "since": "abc123"}
```

Response:
```json
{
  "type": "response",
  "command": "get_entries",
  "success": true,
  "data": {
    "entries": [
      {"type": "message", "id": "def456", "parentId": "abc123", "timestamp": "...", "message": {"role": "user", "...": "..."}}
    ],
    "leafId": "def456"
  }
}
```

`leafId`是当前叶子条目的ID（`null`为空会话），因此客户端可以在一次往返中判断活动分支是否移动。如果`since`与任何条目ID不匹配，响应为`success: false`。

### get_tree

获取会话作为条目的树。每个节点是`{entry, children, label?, labelTimestamp?}`。结果是数组，因为导航API可以创建多个根；带有断裂父链的孤立条目也会作为根出现。

```json
{"type": "get_tree"}
```

Response:
```json
{
  "type": "response",
  "command": "get_tree",
  "success": true,
  "data": {
    "tree": [
      {
        "entry": {"type": "message", "id": "abc123", "parentId": null, "...": "..."},
        "children": [
          {"entry": {"type": "message", "id": "def456", "parentId": "abc123", "...": "..."}, "children": []}
        ]
      }
    ],
    "leafId": "def456"
  }
}
```

### get_last_assistant_text
获取最后一条助手消息的文本内容。

```json
{"type": "get_last_assistant_text"}
```

回复：
```json
{
  "type": "response",
  "command": "get_last_assistant_text",
  "success": true,
  "data": {"text": "The assistant's response..."}
}
```

如果不存在助手文本，则`text`的值为`null`。

### set_session_name

为当前会话设置一个显示名称。名称会出现在会话列表中，并有助于识别会话。

```json
{"type": "set_session_name", "name": "my-feature-work"}
```

回复：
```json
{
  "type": "response",
  "command": "set_session_name",
  "success": true
}
```

当前会话名称可通过`get_state`在`sessionName`字段中获取。要在启动RPC模式时设置初始名称，请将`--name <name>`或`-n <name>`传递给`pi --mode rpc`进程。

## 可发现的命令

### get_commands

获取可用命令（扩展命令、提示模板和技能）。可以通过`prompt`命令运行其中一个命令，方法是将其名称前缀为`/`。

```json
{"type": "get_commands"}
```

回复：
```json
{
  "type": "response",
  "command": "get_commands",
  "success": true,
  "data": {
    "commands": [
      {
        "name": "fix-tests",
        "description": "Fix failing tests",
        "source": "prompt",
        "sourceInfo": {
          "path": "/home/user/myproject/.pi/agent/prompts/fix-tests.md",
          "source": "local",
          "scope": "project",
          "origin": "top-level"
        }
      }
    ]
  }
}
```

每个命令都有：
- `name`：命令名称（使用`/name`）
- `description`：可读性描述（扩展命令可选）
- `source`：命令类型：
  - `"extension"`：通过 `pi.registerCommand()` 进行注册
  - `"prompt"`：从提示模板 `.md` 文件加载
  - `"skill"`：从技能目录加载（名称以 `skill:` 开头）
- `sourceInfo`：注册该命令的资源的元数据：
  - `path`：资源的绝对路径
  - `source`：Pi 是如何发现它的，例如 `"local"`、`"auto"` 或 `"cli"`
  - `scope`：`"user"`、`"project"` 或 `"temporary"`
  - `origin`：直接加载资源的 `"top-level"` 或 `"package"` 包资源
  - `baseDir`：适用时的包基础目录

**注意**：内置 TUI 命令（`/settings`、`/hotkeys` 等）不包括在内。它们仅在交互模式下处理，如果通过 `prompt` 发送将不会执行。

<a id="model-object"></a>
##  模型对象

模型命令返回完整的配置模型定义。成本以每百万个令牌的美元计。

```json
{
  "id": "claude-sonnet-4-20250514",
  "name": "Claude Sonnet 4",
  "api": "anthropic-messages",
  "provider": "anthropic",
  "baseUrl": "https://api.anthropic.com",
  "reasoning": true,
  "input": ["text", "image"],
  "contextWindow": 200000,
  "maxTokens": 16384,
  "cost": {
    "input": 3.0,
    "output": 15.0,
    "cacheRead": 0.3,
    "cacheWrite": 3.75
  }
}
```

有关模型配置，请参见 [配置兼容端点](models.md#configure-a-compatible-endpoint)。对于 TypeScript，请使用从 `@earendil-works/pi-ai` 导出的 `Model` 类型。

