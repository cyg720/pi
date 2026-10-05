# 子代理示例

将任务委托给具有隔离上下文窗口的专用子代理。

## 功能

- **隔离上下文**：每个子代理在独立的`pi`进程中运行  
- **流式输出**：实时查看工具调用和进度  
- **并行流式输出**：所有并行任务同时流式更新  
- **Markdown渲染**：最终输出以正确格式渲染（展开视图）  
- **使用统计**：显示每代理的轮数、令牌、成本和上下文使用情况  
- **中止支持**：Ctrl+C会传播到终止子代理进程

## 结构

```
subagent/
├── README.md            # This file
├── index.ts             # The extension (entry point)
├── agents.ts            # Agent discovery logic
├── agents/              # Sample agent definitions
│   ├── scout.md         # Fast recon, returns compressed context
│   ├── planner.md       # Creates implementation plans
│   ├── reviewer.md      # Code review
│   └── worker.md        # General-purpose (full capabilities)
└── prompts/             # Workflow presets (prompt templates)
    ├── implement.md     # scout -> planner -> worker
    ├── scout-and-plan.md    # scout -> planner (no implementation)
    └── implement-and-review.md  # worker -> reviewer -> worker
```
  
## 安装

从仓库根目录，创建符号链接：

```bash
# Symlink the extension (must be in a subdirectory with index.ts)
mkdir -p ~/.pi/agent/extensions/subagent
ln -sf "$(pwd)/packages/coding-agent/examples/extensions/subagent/index.ts" ~/.pi/agent/extensions/subagent/index.ts
ln -sf "$(pwd)/packages/coding-agent/examples/extensions/subagent/agents.ts" ~/.pi/agent/extensions/subagent/agents.ts

# Symlink agents
mkdir -p ~/.pi/agent/agents
for f in packages/coding-agent/examples/extensions/subagent/agents/*.md; do
  ln -sf "$(pwd)/$f" ~/.pi/agent/agents/$(basename "$f")
done

# Symlink workflow prompts
mkdir -p ~/.pi/agent/prompts
for f in packages/coding-agent/examples/extensions/subagent/prompts/*.md; do
  ln -sf "$(pwd)/$f" ~/.pi/agent/prompts/$(basename "$f")
done
```
  
## 安全模型

该工具会执行一个带有委派系统提示和工具/模型配置的独立`pi`子进程。

**项目本地代理**（`.pi/agents/*.md`）是受仓库控制的提示，可指示模型读取文件、运行bash命令等。

**默认行为**：仅加载`~/.pi/agent/agents`中的用户级代理。

要启用项目本地代理，请传递`agentScope: "both"`（或`"project"`）。仅对可信任的仓库执行此操作。

交互式运行时，工具会在运行项目本地代理前提示确认（对未受信任的项目）。受信任的项目可跳过额外提示。设置`confirmProjectAgents: false`可禁用确认提示。

## 用法

### 单代理  
```
Use scout to find all authentication code
```
  
### 并行执行  
```
Run 2 scouts in parallel: one to find models, one to find providers
```
  
### 链式工作流  
```
Use a chain: first have scout find the read tool, then have planner suggest improvements
```
  
### 工作流提示  
```
/implement add Redis caching to the session store
/scout-and-plan refactor auth to support OAuth
/implement-and-review add input validation to API endpoints
```
  
## 工具模式

| 模式 | 参数 | 描述 |
|------|-----------|-------------|
| 单代理 | `{ agent, task }` | 一个代理，一个任务 |
| 并行 | `{ tasks: [...] }` | 多个代理并发运行（最多8个，最多4个并发） |
| 链式 | `{ chain: [...] }` | 顺序执行，使用`{previous}`占位符 |

## 输出显示

**折叠视图**（默认）：  
- 状态图标（✓/✗/⏳）和代理名称  
- 最后5-10个项目（工具调用和文本）  
- 使用统计：`3 turns ↑input ↓output RcacheRead WcacheWrite $cost ctx:contextTokens model`

**展开视图**（Ctrl+O）：  
- 完整任务文本  
- 所有工具调用及其格式化参数  
- 最终输出以Markdown渲染  
- 每任务使用统计（链式/并行）

**并行模式流式输出**：  
- 显示所有任务的实时状态（⏳运行中，✓完成，✗失败）  
- 每个任务进度实时更新  
- 显示“2/3完成，1个运行中”状态  
- 每个完成任务的最终输出返回给父模型，单任务限制50KB  
- 子进程提前退出时，返回stderr/错误消息中的故障诊断

**工具调用格式化**（模仿内置工具）：  
-   
`$ command`用于bash  
-   
`read ~/path:1-10`用于read  
-   
`grep /pattern/ in ~/path`用于grep  
- 等。

## 代理定义

代理是带YAML前置说明的Markdown文件：

```markdown
---
name: my-agent
description: What this agent does
tools: read, grep, find, ls
model: claude-haiku-4-5
---

System prompt for the agent goes here.
```
  
当`model`省略时，子代理继承分派会话的活跃模型和思考等级。

**位置**：  
- `~/.pi/agent/agents/*.md` - 用户级（始终加载）  
- `.pi/agents/*.md` - 项目级（仅在`agentScope: "project"`或`"both"`时）  
项目代理与同名用户代理冲突时会覆盖用户代理（`agentScope: "both"`）。

## 示例代理

| 代理 | 用途 | 模型 | 工具 |
|-------|---------|-------|-------|
| `scout` | 快速代码库重构 | Haiku | read, grep, find, ls, bash |
| `planner` | 实施计划 | Sonnet | read, grep, find, ls |
| `reviewer` | 代码审查 | Sonnet | read, grep, find, ls, bash |
| `worker` | 通用型 | Sonnet | （所有默认工具） |

## 工作流提示

| 提示 | 流程 |
|--------|------|
| `/implement <query>` | 探险者 → 计划者 → 工作者 |
| `/scout-and-plan <query>` | 探险者 → 计划者 |
| `/implement-and-review <query>` | 工作者 → 审阅者 → 工作者 |

## 错误处理

- **退出码≠0**：工具返回错误及stderr/输出  
- **stopReason "error"**：将LLM错误及错误信息传播  
- **stopReason "aborted"**：用户中止（Ctrl+C）杀死子进程并抛出错误
- **链式模式**：在第一步失败时停止，并报告失败的步骤

## 局限性

- 输出已截断，折叠视图中仅显示最后10个项目（展开可查看全部）

- 并行模式的可见输出每个任务限制为50KB；完整结果保留在工具详情中

- 每次调用时发现新的代理（允许会话中途编辑）

- 并行模式限制为8个任务，最多4个并发

