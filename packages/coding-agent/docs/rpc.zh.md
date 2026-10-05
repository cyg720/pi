# RPC模式

RPC模式将Pi作为长时间运行的子进程运行，通过stdin和stdout上的JSON记录进行控制。适用于语言无关的集成、进程隔离、IDE和自定义用户界面。

对于Node.js或Bun的进程内集成，建议使用[SDK](sdk.md)。对于基于子进程的TypeScript集成，建议使用导出的`RpcClient`，它启动Pi、关联响应、暴露类型化命令方法，并将事件传递给监听器。

| 接口 | 进程边界 | 控制模型 | 最佳适用场景 |
|---|---|---|---|
| [SDK](sdk.md) | 进程内 | 直接的TypeScript方法和事件 | 需要完整API访问的Node.js或Bun主机 |
| RPC | 子进程 | JSONL命令、响应和事件 | 其他语言、隔离进程、IDE或自定义客户端 |

## 启动RPC模式

```bash
pi --mode rpc --no-session
```

正常的CLI选项仍然选择工作目录、模型、工具、资源和会话行为。常见选择包括`--provider`、`--model`、`--name`、`--no-session`和`--session-dir`。有关完整且版本特定的接口，请参见[命令行](cli.md)；`pi --help`是已安装版本的权威来源。

RPC模式拒绝`@file`提示参数。请通过[`prompt`](rpc-commands.md#prompt)命令发送提示。

## 协议记录

协议包含四个记录家族：

| 方向 | 记录 | 用途 |
|---|---|---|
| stdin | 命令 | 请求Pi进行提示、检查状态、更改配置或管理会话 |
| stdout | `response` | 报告命令是否成功，并返回命令数据 |
| stdout | 会话事件 | 流式传输运行、消息、工具、队列、压缩和重试活动 |
| 双向 | 扩展UI记录 | 在Pi和客户端之间转发受支持的扩展交互 |

有关标准记录定义，请参见[RPC命令](rpc-commands.md)、[JSON事件流](json.md)和[RPC扩展UI](rpc-extension-ui.md)。

### 关联命令和响应

每个命令可接受一个可选的字符串`id`。匹配的响应会重复该字符串：

```json
{"id":"req-1","type":"get_state"}
{"id":"req-1","type":"response","command":"get_state","success":true,"data":{"...":"..."}}
```

在多个命令同时处于待处理状态时，应始终使用唯一ID。由于命令处理是异步的，客户端应通过ID进行关联，而不是通过响应顺序。

会话事件通常没有命令ID，因为它们描述的是会话活动。`bash_execution_update`是例外：当发起的[`bash`](rpc-commands.md#bash)命令有ID时，其输出事件会重复该ID。

一个`extension_ui_response`使用其`extension_ui_request`提供的ID。它不会产生正常的命令响应。

## 帧结构

RPC使用严格的JSONL帧结构。每个记录写入一个完整的JSON对象，并以LF（`\n`）终止。读取stdout作为字节或UTF-8流，并仅在LF处分割记录。可选地，移除前导的回车以接受CRLF输入。

不要使用通用的行读取器，它会将Unicode行或段落分隔符作为记录边界。特别是，Node.js `readline`也会在`U+2028`和`U+2029`处分割，而它们可能出现在有效的JSON字符串内部。

持续读取stdout。Pi尊重stdout的背压，但客户端停止读取可能会导致进程停滞。写入命令时也要尊重stdin的背压。stdout仅用于协议记录；诊断和应用日志记录到stderr。

## 运行生命周期

成功的`prompt`响应表示提示已被接受、排队或处理。但这并不意味着模型工作已完成：

```json
{"id":"req-2","type":"prompt","message":"Review this repository"}
{"id":"req-2","type":"response","command":"prompt","success":true,"data":{"disposition":"started"}}
```

`data.disposition`报告了提示的处理结果。如果是`"handled"`，则未为此提示启动运行，因此无需等待`agent_settled`。有关所有值，请参见[RPC命令](rpc-commands.md#prompt)。

在该响应之后，继续消费[事件](json.md)。`agent_end`标记了一个低级代理运行的结束，但重试、溢出恢复、压缩、引导或后续工作仍可能继续。当客户端需要知道Pi将不会自动继续时，等待`agent_settled`。

在发送提示之前订阅以避免错过快速完成。`RpcClient.promptAndWait()`会自动执行此操作。如果使用单独的`RpcClient`调用，请在`prompt()`之前安装事件监听器，并仅在运行活跃期间调用`waitForIdle()`。

## 错误
`success: false`：命令执行失败，返回一个响应。

```json
{"id":"req-3","type":"response","command":"set_model","success":false,"error":"Model not found: invalid/model"}
```

不规范的JSON将导致解析失败，不包含请求ID的响应。

```json
{"type":"response","command":"parse","success":false,"error":"Failed to parse command: Unexpected token..."}
```

成功的响应仅涵盖命令处理。提供方的失败和接受提示后的中止会出现在消息和事件流中。

客户端还必须处理子进程启动失败、意外退出、stderr诊断、取消以及自身的截止时间。不要将stderr解析为协议数据。

## 关闭

关闭子进程的stdin以请求有序关闭。Pi在退出前会释放活动运行时。客户端仍应处理进程信号和意外退出。

扩展也可以通过其扩展上下文请求关闭。Pi在当前命令完成后或活动运行输出`agent_settled`后完成关闭。

## 最简客户端

此Python示例使用二进制管道读取器，按换行符分割，不将Unicode分隔符视为协议边界：

```python
import json
import subprocess

process = subprocess.Popen(
    ["pi", "--mode", "rpc", "--no-session"],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
)

assert process.stdin is not None
assert process.stdout is not None

command = {"id": "prompt-1", "type": "prompt", "message": "Hello"}
process.stdin.write(json.dumps(command).encode("utf-8") + b"\n")
process.stdin.flush()

while line := process.stdout.readline():
    record = json.loads(line)
    if record.get("type") == "message_update":
        update = record["assistantMessageEvent"]
        if update["type"] == "text_delta":
            print(update["delta"], end="", flush=True)
    elif record.get("type") == "agent_settled":
        print()
        break

process.stdin.close()
process.wait()
```

对于维护中的TypeScript客户端，请使用已检查的[RPC客户端示例](../examples/rpc-client.ts)。它需要已构建的Pi CLI，因为示例仓库指向`dist/cli.js`。

## 参考

- [RPC命令](rpc-commands.md)：每个stdin命令和响应
- [JSON事件流](json.md)：共享stdout会话事件和流式重建
- [RPC扩展UI](rpc-extension-ui.md)：对话框、通知、响应和限制
- [消息类型](message-types.md)：响应和事件使用的消息和内容块
- [会话文件格式](session-format.md)：session命令返回的条目
- [`rpc-types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/modes/rpc/rpc-types.ts)：导出的TypeScript协议定义
- [`RpcClient`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/modes/rpc/rpc-client.ts)：子进程客户端实现

## 已移动的参考锚点

以前本页面上的详细参考现在有独立页面。这些锚点保留了现有链接。

<a id="prompt"></a>
<a id="steer"></a>
<a id="follow_up"></a>
<a id="abort"></a>
<a id="clear_queue"></a>
<a id="new_session"></a>
<a id="get_state"></a>
<a id="get_messages"></a>
<a id="set_model"></a>
<a id="cycle_model"></a>
<a id="get_available_models"></a>
<a id="set_thinking_level"></a>
<a id="cycle_thinking_level"></a>
<a id="get_available_thinking_levels"></a>
<a id="set_steering_mode"></a>
<a id="set_follow_up_mode"></a>
<a id="compact"></a>
<a id="set_auto_compaction"></a>
<a id="set_auto_retry"></a>
<a id="abort_retry"></a>
<a id="bash"></a>
<a id="abort_bash"></a>
<a id="get_session_stats"></a>
<a id="export_html"></a>
<a id="switch_session"></a>
<a id="fork"></a>
<a id="clone"></a>
<a id="get_fork_messages"></a>
<a id="get_entries"></a>
<a id="get_tree"></a>
<a id="get_last_assistant_text"></a>
<a id="set_session_name"></a>
<a id="get_commands"></a>

命令详情已移动到[RPC命令](rpc-commands.md)。

<a id="message_update-streaming"></a>
<a id="bash_execution_update"></a>
<a id="compaction_start--compaction_end"></a>
<a id="summarization_retry_scheduled--summarization_retry_attempt_start--summarization_retry_finished"></a>

事件详情已移动到[JSON事件流](json.md)。

<a id="extension-ui-protocol"></a>

扩展交互详情已移动到[RPC扩展UI](rpc-extension-ui.md)。

