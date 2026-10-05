# 扩展示例

pi-coding-agent的扩展示例。

## 用法

```bash
# Load an extension with --extension flag
pi --extension examples/extensions/permission-gate.ts

# Or copy to extensions directory for auto-discovery
cp permission-gate.ts ~/.pi/agent/extensions/
```
  
## 示例

### 生命周期与安全

| 扩展 | 描述 |
|------|------|
| `permission-gate.ts` | 危险bash命令（如rm -rf、sudo等）执行前提示确认 |
| `project-trust.ts` | 展示`project_trust`事件，用于用户/全局和CLI扩展 |
| `protected-paths.ts` | 阻止向受保护路径（.env、.git/、node_modules/）写入 |
| `confirm-destructive.ts` | 确认会话中破坏性操作（如clear、switch、fork）前的执行 |
| `dirty-repo-guard.ts` | 阻止有未提交git更改时的会话变更 |
| `sandbox/` | 使用`@anthropic-ai/sandbox-runtime`进行OS级沙箱，支持项目级配置 |
| `gondolin/` | 将内置工具和`!`命令路由到Gondolin微虚拟机中 |

### 自定义工具

| 扩展 | 描述 |
|------|------|
| `todo.ts` | 待办事项列表工具 + `/todos`命令，支持自定义渲染和状态持久化 |
| `hello.ts` | 最简自定义工具示例 |
| `question.ts` | 展示`ctx.ui.select()`，用于自定义UI提问用户 |
| `questionnaire.ts` | 多问题输入，带标签栏在问题间导航 |
| `tool-override.ts` | 重写内置工具（例如，为`read`添加日志/访问控制） |
| `dynamic-tools.ts` | 启动后（`session_start`）和运行时通过命令注册工具，支持提示片段和工具特定提示指南 |
| `structured-output.ts` | 最终结构化输出工具，返回`terminate: true`，使代理能在工具调用后结束 |
| `built-in-tool-renderer.ts` | 为内置工具（如read、bash、edit、write）提供紧凑渲染，同时保持原有行为 |
| `minimal-mode.ts` | 重写内置工具渲染，实现极简显示（仅工具调用，折叠模式下无输出） |
| `truncated-tool.ts` | 用proper输出截断包装ripgrep（50KB/2000行） |
| `ssh.ts` | 通过SSH和可插拔操作将所有工具代理到远程机器 |
| `subagent/` | 将任务委托给具有隔离上下文窗口的专用子代理 |

### 命令与UI
| 扩展名 | 描述 |
|---------|-------------|
| `preset.ts` | 通过 `--preset` 标志和 `/preset` 命令为模型、思考等级、工具和指令设置命名预设 |
| `plan-mode/` | 通过 `/plan` 命令和步骤跟踪实现 Claude Code 风格的计划模式，仅支持只读探索 |
| `tools.ts` | 通过 `/tools` 命令启用/禁用工具，并支持会话持久化 |
| `handoff.ts` | 通过 `/handoff <goal>` 将上下文转移到新的聚焦会话 |
| `qna.ts` | 通过 `ctx.ui.setEditorText()` 从最后的响应中提取问题并进入编辑器 |
| `status-line.ts` | 通过 `ctx.ui.setStatus()` 在页脚显示轮次进度，并支持主题颜色 |
| `github-issue-autocomplete.ts` | 通过堆叠自定义自动补全提供程序，预加载来自 `gh issue list` 的开放问题，添加 `#1234` 问题补全 |
| `widget-placement.ts` | 通过 `ctx.ui.setWidget()` 的位置显示编辑器上方和下方的控件 |
| `hidden-thinking-label.ts` | 通过 `ctx.ui.setHiddenThinkingLabel()` 自定义折叠的思考标签 |
| `working-indicator.ts` | 通过 `ctx.ui.setWorkingIndicator()` 自定义流式处理的工作指示器 |
| `model-status.ts` | 通过 `model_select` 事件钩子在状态栏显示模型变更 |
| `snake.ts` | 带有自定义 UI、键盘处理和会话持久化的蛇形游戏 |
| `tic-tac-toe.ts` | 与 `executionMode: "sequential"` 工具配合，防止共享光标状态的竞态条件，实现与代理的井字游戏 |
| `send-user-message.ts` | 展示 `pi.sendUserMessage()`，演示从扩展发送用户消息 |
| `timed-confirm.ts` | 演示 `ctx.ui.confirm()` 和 `ctx.ui.select()` 对话框的自动关闭，使用 AbortSignal |
| `rpc-demo.ts` | 练习所有 RPC 支持的扩展 UI 方法；与 [`examples/rpc-extension-ui.ts`](../rpc-extension-ui.ts) 配对 |
| `modal-editor.ts` | 通过 `ctx.ui.setEditorComponent()` 实现自定义 vim 风格的模态编辑器 |
| `rainbow-editor.ts` | 通过自定义编辑器实现彩虹文字动画效果 |
| `notify.ts` | 代理完成时通过 OSC 777 向桌面推送通知（Ghostty、iTerm2、WezTerm） |
| `titlebar-spinner.ts` | 代理工作时在终端标题中显示盲文旋转动画 |
| `summarize.ts` | 使用 GPT-5.2 总结对话并在短暂 UI 中显示 |
| `custom-footer.ts` | 自定义页脚，通过 `ctx.ui.setFooter()` 显示 Git 分支和令牌统计信息 |
| `custom-header.ts` | 通过 `ctx.ui.setHeader()` 添加自定义页眉 |
| `overlay-test.ts` | 测试叠加层合成，支持内联文本输入和边缘情况 |
| `overlay-qa-tests.ts` | 全面的叠加层QA测试：锚点、边距、堆叠、溢出、动画 |
| `doom-overlay/` | DOOM 游戏以叠加层形式运行，35 FPS（演示实时游戏渲染） |
| `shutdown-command.ts` | 添加 `/quit` 命令，演示 `ctx.shutdown()` |
| `reload-runtime.ts` | 添加 `/reload-runtime` 和 `reload_runtime` 工具，展示安全重载流程 |
| `interactive-shell.ts` | 通过 `user_bash` 插件运行交互式命令（vim、htop），支持完整终端 |
| `inline-bash.ts` | 通过 `input` 事件转换扩展 `!{command}` 模式在提示中的应用 |
| `input-transform-streaming.ts` | 通过 `streamingBehavior` 跳过昂贵的输入预处理，实现流式转向 |

### Git 集成

| 插件 | 描述 |
|-----------|-------------|
| `git-checkpoint.ts` | 在每次操作时创建 Git stash 快照，便于代码恢复 |
| `auto-commit-on-exit.ts` | 退出时自动提交，使用最后的助手消息作为提交信息 |

### 系统提示与压缩

| 插件 | 描述 |
|-----------|-------------|
| `pirate.ts` | 演示 `systemPromptAppend`，动态修改系统提示 |
| `claude-rules.ts` | 扫描 `.claude/rules/` 文件夹，将规则列表添加到系统提示中 |
| `custom-compaction.ts` | 自定义压缩，总结整个对话内容 |
| `trigger-compact.ts` | 当上下文使用量超过 100k 令牌时触发压缩，并添加 `/trigger-compact` 命令 |

### 系统集成

| 插件 | 描述 |
|-----------|-------------|
| `mac-system-theme.ts` | 同步 pi 主题与 macOS 深色/浅色模式 |

### 资源

| 插件 | 描述 |
|-----------|-------------|
| `dynamic-resources/` | 通过 `resources_discover` 加载技能、提示和主题 |

### 消息与通信

| 插件 | 描述 |
|-----------|-------------|
| `message-renderer.ts` | 通过 `registerMessageRenderer` 实现自定义消息渲染，支持颜色和可展开的详细信息 |
| `entry-renderer.ts` | 仅 TUI 会话入口渲染，通过 `appendEntry` 和 `registerEntryRenderer` 实现 |
| `debug-provider.ts` | 通过 `/debug-provider` 切换原始提供者流捕获，仅 TUI 会话中可查看每个助手消息 |
| `event-bus.ts` | 通过 `pi.events` 实现插件间通信 |

### 会话元数据

| 插件 | 描述 |
|-----------|-------------|
| `session-name.ts` | 通过 `setSessionName` 为会话选择器命名会话 |
| `bookmark.ts` | 通过 `setLabel` 为 `/tree` 导航添加带标签的书签条目 |

### 自定义提供者

| 插件 | 描述 |
|-----------|-------------|
| `custom-provider-anthropic/` | 支持 OAuth 的自定义 Anthropic 提供者，采用自定义流式实现 |
| `custom-provider-gitlab-duo/` | 使用 pi-ai 内置的 Anthropic/OpenAI 流式代理的 GitLab Duo 提供者 |
| `jev-router.ts` | 通过 `registerVirtualModel` 虚拟模型，计划使用 Codex Sol 或 Terra（由 Jev 分类器选择），首次编辑后切换到 Luna |

### 外部依赖

| 插件 | 描述 |
|-----------|-------------|
| `with-deps/` | 具有独立 package.json 和依赖项的插件（演示 jiti 模块解析） |
| `file-trigger.ts` | 监听触发文件并将其内容注入对话 |

## 编写插件

请参阅 [docs/extensions.md](../../docs/extensions.md) 以获取完整文档。

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  // Subscribe to lifecycle events
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "bash" && event.input.command?.includes("rm -rf")) {
      const ok = await ctx.ui.confirm("Dangerous!", "Allow rm -rf?");
      if (!ok) return { block: true, reason: "Blocked by user" };
    }
  });

  // Register custom tools
  pi.registerTool({
    name: "greet",
    label: "Greeting",
    description: "Generate a greeting",
    parameters: Type.Object({
      name: Type.String({ description: "Name to greet" }),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return {
        content: [{ type: "text", text: `Hello, ${params.name}!` }],
        details: {},
      };
    },
  });

  // Register commands
  pi.registerCommand("hello", {
    description: "Say hello",
    handler: async (args, ctx) => {
      ctx.ui.notify("Hello!", "info");
    },
  });
}
```

## 键模式

**为字符串参数使用 StringEnum**（Google API 兼容性要求）：
```typescript
import { StringEnum } from "@earendil-works/pi-ai";

// Good
action: StringEnum(["list", "add"] as const)

// Bad - doesn't work with Google
action: Type.Union([Type.Literal("list"), Type.Literal("add")])
```

**通过 details 实现状态持久化**：
```typescript
// Store state in tool result details for proper forking support
return {
  content: [{ type: "text", text: "Done" }],
  details: { todos: [...todos], nextId },  // Persisted in session
};

// Reconstruct on session events
pi.on("session_start", async (_event, ctx) => {
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type === "message" && entry.message.toolName === "my_tool") {
      const details = entry.message.details;
      // Reconstruct state from details
    }
  }
});
```


