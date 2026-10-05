# vacation

一个带 TUI（终端用户界面）的持久化假期规划智能体，基于 `@earendil-works/pi-durable` 构建。它复制了 [`../durable`](../durable) 中的持久化编程智能体，将编程工具和 pi 的编程提示词替换为假期规划工具和提示词。它看起来像编程智能体，只是因为复用了 pi 的交互式 TUI 组件。

在 pi 源码工作目录中，执行 `npm install` 和 `npm run build` 后：

```bash
node packages/coding-agent/src/experimental/vacation/main.ts
node packages/coding-agent/src/experimental/vacation/main.ts --continue
```

如果未构建，预加载源码解析器，让工作区包从 `src` 而不是 `dist` 加载：

```bash
node --import ./packages/coding-agent/src/experimental/source-resolver.ts packages/coding-agent/src/experimental/vacation/main.ts
```

新会话采用 `settings.json` 中 pi 的默认模型和思考级别。`--continue` 打开当前目录的最新会话。会话保存在 `~/.pi/agent/experimental/vacation-sessions/<cwd-hash>/<session>/session.sqlite` 下。使用 pi 本身登录；凭据是共享的。

## 演示内容

- **后台子智能体：** `research` 工具在独立对话中启动子智能体，并立即返回。后台任务传递请求，并将子智能体的报告作为新消息发布到主对话。因此研究期间，你可以继续与主智能体聊天。
- **并行持久化工具调用：** 子智能体的 `search` 调用并行执行，每个调用在任务面板中都是独立任务。结果是预设的；每个主题耗时不同。
- **恢复：** `search` 可以安全重跑。在搜索运行期间终止进程，再使用 `--continue` 启动：已完成的搜索会保留，未完成的搜索会重跑，报告仍会送达。请求 ID 防止重启后重复发送请求或报告。
- **持久化编程智能体的其他功能：** 转向指令、后续消息、`/agents`、`/compact`、`/tasks`、`/model`。

## 试用

1. “为两个人规划在维也纳度过的周末。把研究交给子智能体。”
2. 搜索运行期间，向主智能体询问其他内容。
3. 只剩火车搜索时按 Ctrl+C，然后使用 `--continue` 再次启动。
4. 使用 `/agents` 查看子智能体或发送转向指令，再次使用 `/agents` 返回主智能体。

## 文件布局

| 文件 | 职责 |
| --- | --- |
| `vacation.ts` | 假期扩展：`search`、`research`、报告任务和提示词 |
| `main.ts` | 参数、打开、运行、关闭 |
| `sessions.ts` | 会话目录和锁 |
| `harness-setup.ts` | HTTP 设置、配置、注册表和初始模型 |
| `runtime.ts` | Harness 以及普通的 `DurableView` 和 `DurableController` |
| `tui.ts` | 使用 pi 的交互式组件渲染 |
