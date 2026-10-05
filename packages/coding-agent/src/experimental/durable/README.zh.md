# 持久化

`@earendil-works/pi-durable`上的一个小型本地编码代理。一个进程拥有模型运行时、持久化框架、SQLite存储和TUI。它重用pi的模型运行时、认证、设置、系统提示、快捷键、主题和交互组件；该代理本身即为持久化框架，内置`CodingTools`。

```bash
node --import ./packages/coding-agent/src/experimental/source-resolver.ts packages/coding-agent/src/experimental/durable/main.ts
node --import ./packages/coding-agent/src/experimental/source-resolver.ts packages/coding-agent/src/experimental/durable/main.ts --continue
```

会话以pi的默认模型和思考等级从`settings.json`开始。`--continue`为当前目录打开最新会话。会话存储于`~/.pi/agent/experimental/durable-sessions/<cwd-hash>/<session>/session.sqlite`；一把锁防止第二个进程介入（由崩溃遗留的锁在10秒后失效，下次启动会等待该锁）。使用pi自身登录；凭据共享。

## 显示内容

- **持久化：**每个流式部分、工具输出、队列和轮次均被提交。在工具调用中途终止进程并重新启动`--continue`：中断的调用获得中断结果，轮次继续。TUI不处理恢复，仅渲染对话视图。
- **单一视图：**TUI渲染`Conversation.viewState()`，即转录结构挂载及内置文档（`pi.live`，`pi.inbox`，`pi.agent`，`pi.usage`）。流式、工具进度、队列、重试、压缩状态、模型和用量均来自此处。
- **子代理：**`subagent`工具在子对话中执行任务，该子对话由调用拥有。`/agents`可切换到任何对话，即使子代理正在工作，编辑器也可与其交互：在忙碌时引导，或在调用返回后继续聊天。按Esc可中止当前显示对话的工作；中止主轮次会中止其子代理。
- **任务图：**一个实时面板`Harness.taskGraph()`，默认显示并可通过`/tasks`切换；显示每个实时任务、其等待项及拥有的对话。

## 命令

- submit：空闲时提示，忙碌时引导
- 跟随键（`app.message.followUp`）：排队后续任务
- Esc：中止当前显示对话的工作，包括手动压缩
- `/model`或模型键：为当前对话选择模型
- 思考键（Shift+Tab）：循环思考等级
- `/compact [instructions]`：总结较早上下文；当上下文符合`compaction.keepRecentTokens`时报告“无压缩内容”
- `/agents`：切换对话
- `/tasks`：隐藏或显示任务面板
- 工具展开键（Ctrl+O）：展开工具输出和压缩摘要
- 清除键（Ctrl+C）或Ctrl+D：立即退出，与pi的先清空Ctrl+C不同；飞行中的工作恢复使用`--continue`

## 布局

| 文件 | 角色 |
| --- | --- |
| `main.ts` | 参数、打开、运行、关闭 |
| `sessions.ts` | 会话目录和锁 |
| `runtime.ts` | 框架、注册表、设置、环境；纯`DurableView`和`DurableController` |
| `prompt.ts` | pi的系统提示部分（工具、规则、文档、AGENTS.md、技能、cwd）作为扩展 |
| `subagent.ts` | 前景子代理工具 |
| `tui.ts` | 使用pi的交互组件进行渲染 |

压缩阈值、重试策略、队列模式和请求超时来自pi的`settings.json`，启动时加载，每次使用通过框架设置获取器读取。pi的HTTP调度器配置同pi；若无则部分提供方流式传输会提前结束。

未显示的轮次若无答案会显示提示；重启后恢复的轮次不显示，因仅监控本进程提交的请求。

未包含：会话列表和恢复选择器、分支和树导航、扩展、提示模板、图片、`/login`。

