# CLI 集成

默认情况下，运行 `pi` 会打开交互式终端界面。当输入或输出被管道传输或重定向时，Pi 会使用打印模式。您也可以为脚本和应用程序显式选择打印、JSON 或 RPC 模式。

所有四种模式都使用相同的代理、会话、资源和工具。模式决定了输入如何进入 Pi、输出如何暴露，以及进程是否保持可用以执行更多命令。

SDK 不是 CLI 模式。它将代理直接嵌入到 Node.js 或 Bun 进程中。当直接的 TypeScript 访问比进程边界更可取时，请参见 [SDK](sdk.md)。

## 选择模式

| 模式 | 界面 | 生命周期 | 适用场景 |
|---|---|---|---|
| 交互式 | 终端用户界面 | 直到用户退出 | 人员直接操作 Pi 时 |
| 打印 | 最终文本输出到 stdout | 单次调用 | 脚本需要最终助手响应时 |
| JSON | stdout 上的 JSONL 事件 | 单次调用 | 进程需要结构化运行进度时 |
| RPC | JSONL 命令、响应和事件 | 长生命周期 | 进程需要双向控制时 |

CLI 选项仍然独立于模式选择工作目录、模型、工具、资源和会话持久性。有关完整的启动选项，请参见 [命令行](cli.md)。

## 输出到 stdout

打印模式运行提供的提示，将最终助手文本写入 stdout 并退出：

```bash
pi --print "Summarize the changes in this repository"
```

当仅需要最终文本时（包括命令替换、管道和一次性作业），使用打印模式。不暴露中间事件。

打印模式将错误写入 stderr。带有 `error` 或 `aborted` 停止原因的最终助手响应会产生非零退出状态。

当未显式选择模式时，非 TTY 的 stdin 或 stdout 也会选择打印模式。这允许管道输入输出而无需添加 `--print`。

## 流式传输 JSON 事件

JSON 模式在 stdout 上输出会话头，随后是代理和会话事件，以换行符分隔的 JSON 形式：

```bash
pi --mode json "Review this repository" > events.jsonl
```

这是结构化的事件输出，而不是单个 JSON 结果，也不限制模型响应的格式。

所有提示在进程启动时提供。进程会为该次运行流式传输事件然后退出；不接受后续命令。

失败或中止的助手响应会出现在事件流中，但本身不会产生非零退出状态。检查事件以判断成功或失败。如果调用抛出错误，Pi 仍会以非零状态退出。

流式 `message_update` 记录包含增量变化而非不断增长的消息快照。从增量事件中组装实时输出，然后用 `message_end` 的权威消息替换。

`agent_end` 可以自动恢复或排队后续工作。`agent_settled` 标记当前运行的自动工作结束。

stdout 专用于 JSONL。诊断和应用日志写入 stderr。有关帧结构、事件形状和重建规则，请参见 [JSON 事件流](json.md)。

## 通过 RPC 控制 Pi

RPC 模式保持 Pi 运行，而另一个进程发送命令并接收响应和事件：

```bash
pi --mode rpc --no-session
```

命令以写入 stdin 的 JSON 对象形式发送。响应和事件以写入 stdout 的 JSON 对象形式返回。每条记录占用一行。

需要关联的命令可添加 `id`。匹配的响应会重复该 ID。事件通常没有命令 ID，因为它们描述的是会话活动而非单个请求。

成功的 `prompt` 响应表示提示已被接受、排队或处理。这并不意味着运行已完成。继续通过 `agent_settled` 消费事件以判断完成。

RPC 命令可以更改模型、检查状态、管理会话、运行 shell 命令并响应扩展 UI 请求。

扩展对话形成请求-响应子协议。其他扩展 UI 更新是通知，客户端可以选择显示或忽略。仅限 TUI 的扩展功能在非交互模式下不可用或降级。

对于 Node.js 或 TypeScript 集成，优先使用 `RpcClient` 从 `@earendil-works/pi-coding-agent`。它启动 Pi RPC 子进程，关联请求，暴露类型化命令方法，并将会话事件传递给监听器。
[RPC客户端示例](../examples/rpc-client.ts)发送一个提示，流式传输文本和工具活动，等待`agent_settled`，然后关闭子进程。该示例包含在仓库的TypeScript检查中。

`RpcClient.promptAndWait()`在发送提示之前安装其事件监听器，避免与快速完成发生竞争。对于单独的操作，请在调用`prompt()`之前订阅，并且仅在运行活动期间调用`waitForIdle()`。

客户端需要一个可运行的Pi CLI的路径。仓库示例指向`dist/cli.js`，因此在从检出运行该示例之前，必须先构建该包。

如果您构建的客户端不包含`RpcClient`，请先从[RPC协议](rpc.md)开始，然后使用[RPC命令](rpc-commands.md)和[JSON事件流](json.md)作为线协议参考。

## Fork和重品牌Pi

源代码分支可以通过`package.json`更改CLI名称和配置目录：

```json
{
  "piConfig": {
    "name": "my-agent",
    "configDir": ".my-agent"
  }
}
```

将顶级`bin`字段更改为设置可执行名称。这些设置会影响CLI横幅、配置路径和派生环境变量名称。

## 示例和参考

- [RPC客户端](../examples/rpc-client.ts)：带类型Node.js集成
- [RPC扩展UI](../examples/rpc-extension-ui.ts)：带扩展对话框的自定义终端客户端
- [命令行](cli.md)：启动选项和模式选择
- [JSON事件流](json.md)：JSON事件参考
- [RPC协议](rpc.md)：RPC生命周期、帧、错误和关闭
- [RPC命令](rpc-commands.md)：命令和响应参考
- [RPC扩展UI](rpc-extension-ui.md)：扩展交互子协议
- [SDK示例](../examples/sdk/)：进程内TypeScript集成

