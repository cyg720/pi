// Scenario labels aligned with the current durable/test/examples filenames.
export const exampleNotes = {
  "agent-examples": {
    "mcp-codemode": [
      "Agent 接入 MCP 与脚本编排",
      "启动一个 stdio MCP 客户端，把远程工具包装为 AgentTool，再让 codemode 脚本通过 runToolCall 复用前后 Hook。主入口展示流式输出与连接清理。"
    ]
  },
  "durable-examples": {
    "00-conversation.ts": [
      "会话与原子条目",
      "阅读会话的创建、条目追加和提交边界。"
    ],
    "01-documents.ts": [
      "类型化文档状态",
      "阅读 defineDoc 与事务中的文档修改，区分不可变条目和可变文档。"
    ],
    "02-forks.ts": [
      "历史分叉",
      "阅读从历史条目创建独立会话及文档的 fork 策略。"
    ],
    "03-owned-conversations.ts": [
      "拥有者与子会话",
      "阅读任务拥有的会话与创建、查询的 ownership 契约。"
    ],
    "04-watches.ts": [
      "Watch 与提交观察",
      "阅读如何订阅提交后的变化并关闭观察者。"
    ],
    "05-harness.ts": [
      "Harness 开启与调度",
      "阅读从 Storage 打开 Harness 并驱动会话的最小组合。"
    ],
    "06-configuration.ts": [
      "会话级 Agent 配置",
      "阅读模型、工具、扩展与工作目录的配置及继承。"
    ],
    "07-harness-conversations.ts": [
      "Harness 多会话",
      "阅读会话创建、查找和管理的宿主接口。"
    ],
    "08-context.ts": [
      "Context 与取消",
      "阅读显式 Chord Context 在等待和执行中的取消边界。"
    ],
    "09-registry-reload.ts": [
      "注册表在线替换",
      "阅读安装同名扩展后的替换与新阶段解析行为。"
    ],
    "10-extension-state.ts": [
      "扩展文档与初始化",
      "阅读扩展自有文档以及会话初始化时的一致性处理。"
    ],
    "11-tasks.ts": [
      "任务定义与检查点",
      "阅读持久任务的阶段、状态与提交检查点。"
    ],
    "12-recovery.ts": [
      "任务重启恢复",
      "阅读存储重开后任务从已提交状态恢复的演练。"
    ],
    "13-chat.ts": [
      "最小问答",
      "从一次输入到最终回答，理解 Submission 与生成任务的串接。"
    ],
    "14-system-prompt.ts": [
      "系统提示区块",
      "阅读 section 组合与系统提示变化的记录方式。"
    ],
    "15-real-model.ts": [
      "真实模型流式回答",
      "展示 OpenAI 流式响应的接入，需要模型凭据；索引生成不会执行它。"
    ],
    "16-coding-tools.ts": [
      "编码工具与 JSONL",
      "在 JSONL 存储上演练一轮 read/write/edit/bash 工具使用。"
    ],
    "17-print.ts": [
      "Print 输出",
      "提交问题并打印最终答案，了解无 TUI 的宿主路径。"
    ],
    "18-json.ts": [
      "JSON 事件与结构操作",
      "对比 Agent 事件与原始 view operations，支持 SQLite、JSONL 和内存后端。"
    ],
    "19-inbox.ts": [
      "忙碌时队列与撤回",
      "演练 steer、follow-up、write 和 queued submission 的撤回。"
    ],
    "20-late-join.ts": [
      "中途加入观察",
      "在运行中附着 view 和事件流，通过快照接上当前状态。"
    ],
    "21-subagent-foreground.ts": [
      "前台子智能体",
      "展示安全重放的子会话工具，调用拥有子会话并等待答案，子事件挂在调用下。"
    ],
    "22-subagent-background.ts": [
      "后台子智能体",
      "展示持久子会话的启动、投递、停止、列举和答案回传，使用后台任务跨越主会话取消。"
    ],
    "23-child-tasks.ts": [
      "子任务等待与失败收尾",
      "以结账与支付任务演练 failFast、abort 与重启恢复。"
    ],
    "24-compaction.ts": [
      "后台和溢出压缩",
      "演练长对话的手动、后台与上下文溢出压缩。"
    ],
    "25-coding-agent.ts": [
      "编码 Agent 组合",
      "组合 CodingTools、实时 settings 和随会话工作目录变化的环境。"
    ],
    "26-plan-mode.ts": [
      "只读计划模式",
      "以扩展文档保存计划模式状态，再用 configure 切换工具能力。"
    ],
    "27-reviewer.ts": [
      "独立审查会话",
      "为审查者设置独立模型、工具、扩展、工作目录与审查循环。"
    ],
    "28-sandbox-per-conversation.ts": [
      "每会话独立环境",
      "通过应用文档为不同会话选择独立执行环境。"
    ],
    "29-tool-override.ts": [
      "同名工具覆写与包装",
      "演练按会话覆写 bash，以及 wrapper 包装最终胜出的实现。"
    ],
    "30-reload-and-restart.ts": [
      "重载与重启",
      "演练调用执行中更新扩展，以及重启后恢复已存选择。"
    ]
  }
};
