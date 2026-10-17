# Pi 全量功能清单（模块 > 功能）

## 阅读说明

| 项目 | 说明 |
| --- | --- |
| 核对日期 | 2026-10-12（Asia/Shanghai）。 |
| 当前版本口径 | 以本地仓库 HEAD `6cd9d957a` 与当前源码为准；`pi-coding-agent` 包版本为 `1.1.0`，另含各包 Unreleased 改动。以本次本地合并结果为准，不代表这些源码能力都已发布。 |
| 清单范围 | 覆盖普通 Pi CLI、SDK、11 个有 package.json 的顶层工作区包、扩展与集成示例，以及不能独立归入产品模块的工程和平台能力。 |
| 清单规模 | 19 个模块、587 项功能条目、64 处来源文档或源码，并补充 18 项能力边界说明；条目包含不同层级的库、集成和示例能力，不代表 587 个互不重叠的 CLI 功能。 |
| 功能粒度 | 按可使用、可集成或可配置的能力拆分；不把每个内部函数、类型、模型 ID、翻译文件或测试用例都当作独立功能。类似配置归并在对应功能内。 |
| 层级 | 二级标题为模块；每个表格行是一项功能。CLI 的多个业务模块都归属于 `packages/coding-agent`，并不意味着它们都是独立 npm 包。 |
| 状态：内置 | 普通 CLI 或对应库已经提供；仍可能需要模型凭据、平台能力或用户主动调用。 |
| 状态：可选 | 已实现，但需配置、注册、显式启用，或满足外部服务条件。 |
| 状态：库 | 可供开发者调用的能力；不意味着 CLI 有相同名称的命令。 |
| 状态：示例 | 仓库附带的参考实现，需自行加载或集成；不是普通 CLI 默认功能。 |
| 状态：实验 | README 或入口明确标注为实验性；不能视为稳定发行接口。 |
| 证据 | 各行“依据”指向仓库内文档或源码，可用于继续核对详细参数。没有把规划文档中的待实现内容当作现有功能。 |
| 验证范围 | 本次为静态功能梳理与 Markdown 文档检查；没有调用收费模型、启动 MCP 服务、执行扩展示例或逐项开展运行测试。 |

## 模块总览

| 模块 | 主要职责 | 归属 |
| --- | --- | --- |
| 01 CLI 交互与运行模式 | 输入任务、终端交互、流式呈现、一次性执行。 | coding-agent |
| 02 文件、搜索与命令工具 | 文件读写、精确修改、搜索、Shell 执行及工具选择。 | coding-agent |
| 03 会话、历史与上下文 | 保存恢复、树与分叉、压缩、导出分享。 | coding-agent |
| 04 模型选择、认证与本地模型 | 模型目录、推理级别、凭据、虚拟路由、llama.cpp。 | coding-agent + ai |
| 05 配置、技能、模板、主题与包 | 全局及项目设置、资源发现、定制和分发。 | coding-agent |
| 06 扩展系统 | 工具、事件、UI、状态、命令、提供商等扩展接口。 | coding-agent |
| 07 MCP 接入与协议客户端 | 外部工具、资源、连接、认证与工具暴露策略。 | coding-agent + mcp |
| 08 Codemode 脚本编排 | 用 JavaScript 组合工具、处理结果、调用非聊天模型。 | coding-agent + codemode |
| 09 SDK、RPC 与 JSON 集成 | 嵌入应用、跨进程控制、结构化事件和远程 UI。 | coding-agent |
| 10 Agent 核心运行时 | 多轮模型与工具循环、队列、事件及生命周期。 | agent |
| 11 AI 统一模型接口 | 多提供商模型访问、统一消息、流式输出和类型化工具。 | ai |
| 12 AI 提供商接入清单 | 当前内置提供商及各接入方向的作用。 | ai + coding-agent 内置扩展 |
| 13 TUI 终端界面库 | 渲染、组件、布局、焦点、键鼠与终端能力。 | tui |
| 14 Chord 类型化对象与跨宿主运行时 | 对象契约、身份、引用生命周期、状态复制、插件热重载和子进程管理。 | chord |
| 15 Durable 持久化运行时 | 提交、恢复、多会话、任务图、子任务和存储。 | durable（实验） |
| 16 Telemetry 遥测 | 显式调用跟踪、参考适配器和类型化诊断模式。 | telemetry |
| 17 Evals 行为评测 | 宿主评测、文档对照实验、隔离执行及报告。 | evals |
| 18 Env 远程执行环境 | SSH 连接、守护进程部署、远程文件与命令、监听与断连处理。 | env（Durable 配套库） |
| 19 其他 | 扩展与库示例、平台与工程支持、能力边界。 | 跨模块或非独立产品能力 |

## 01 CLI 交互与运行模式

| 编号 | 功能 | 详细作用 | 入口／条件 | 状态 | 依据 |
| --- | --- | --- | --- | --- | --- |
| UI-01 | 交互式任务执行 | 在指定工作目录与模型持续对话，由模型结合文件和工具完成编码、文稿、数据处理等多步任务；工作目录用于资源发现和默认路径解析。 | `pi` | 内置 | [使用说明][usage] |
| UI-02 | 一次性文本模式 | 执行给定任务，输出最后的助手文本后退出，适合 Shell 脚本、流水线和批处理。输入或输出重定向时可自动进入此模式。 | `--print` / `-p` | 内置 | [CLI][cli] |
| UI-03 | JSON 事件模式 | 将单次运行的消息、工具、压缩、重试等过程输出为 JSONL，便于外部程序观察与保存；不是只输出最终答案。 | `--mode json` | 内置 | [JSON][json] |
| UI-04 | 长驻 RPC 模式 | 进程持续读取 stdin 中的 JSONL 命令并输出响应与事件，供 IDE、其他语言或自定义界面控制。 | `--mode rpc` | 内置 | [RPC][rpc] |
| UI-05 | 命令行初始提示 | 支持位置参数提供任务，并用 `--` 终止参数解析，让以连字符开头的提示也能正确传入。 | `pi [options] -- [message]` | 内置 | [CLI][cli] |
| UI-06 | 管道内容输入 | 把 stdin 文本放在初始提示前，例如将 Git diff、日志或命令结果直接交给模型分析。 | `command` 的输出通过管道交给 Pi | 内置 | [CLI][cli] |
| UI-07 | 文件附件与路径补全 | 在编辑器中用 `@` 搜索文件、Tab 补全路径，或在 CLI 使用 `@path` 注入文本或图片。RPC 启动参数不接受 `@file`。 | 编辑器、CLI | 内置 | [使用说明][usage]、[CLI][cli] |
| UI-08 | 图片输入 | 支持兼容终端的图片粘贴和拖入；模型是否能理解图片取决于视觉输入能力，终端能否显示图片是另一项能力。 | 粘贴快捷键、文件附件 | 内置 | [使用说明][usage]、[模型][models] |
| UI-09 | 多行编辑与外部编辑器 | 支持换行、长提示编辑，并可打开配置的外部编辑器后将文本带回当前输入框。 | Shift+Enter、`externalEditor` | 内置 | [快捷键][keys] |
| UI-10 | 输入历史与编辑动作 | 按行、按词或按字符移动、删除和撤销；支持删除文本恢复与轮换以及历史提示浏览，减少重复输入。 | 可配置 `tui.editor.*` 动作 | 内置 | [快捷键][keys] |
| UI-11 | 实时工作记录 | 持续展示用户输入、助手输出、工具参数、运行结果及错误；页脚反映模型、目录、上下文与用量。 | 交互界面 | 内置 | [使用说明][usage] |
| UI-12 | 工具结果展开／折叠 | 在紧凑浏览与完整工具输出之间切换，避免长命令输出淹没对话，同时保留查看细节的入口。 | 默认 Ctrl+O | 内置 | [使用说明][usage] |
| UI-13 | 推理内容显示控制 | 显示或隐藏提供商返回的 thinking 内容；只改变呈现，不等于改变模型的推理级别。 | Ctrl+T、`hideThinkingBlock` | 内置 | [设置][settings] |
| UI-14 | 运行中纠偏 | 忙碌时输入新要求作为 steering，在当前助手响应及工具批次完成后影响下一次回答。 | 忙碌时 Enter | 内置 | [使用说明][usage] |
| UI-15 | 后续任务队列 | 将请求排到当前任务结束后处理，区别于立即影响下一轮的纠偏消息；可设置逐条或整批投递。 | follow-up 快捷键、`followUpMode` | 内置 | [使用说明][usage]、[设置][settings] |
| UI-16 | 队列取回 | 将排队消息恢复到编辑器，让用户修改、合并或取消尚未处理的内容。 | dequeue 快捷键 | 内置 | [快捷键][keys] |
| UI-17 | 取消、退出与挂起 | 取消当前工作、清空编辑器后退出、空编辑器退出；支持 Unix 作业控制的平台还可挂起并返回。 | Esc、Ctrl+C、Ctrl+D；挂起受平台限制 | 内置 | [快捷键][keys] |
| UI-18 | 全屏终端布局 | 固定编辑区和状态区，让历史记录在独立视口内滚动，支持滚轮、拖动滚动条和回到底部跟随输出。 | 默认 `fullscreen` | 内置 | [设置][settings]、[TUI][tui] |
| UI-19 | 普通终端布局 | 使用终端原有滚动历史，适合偏好终端自身选择、复制和 scrollback 的用户。 | `--tui-mode regular` | 内置 | [使用说明][usage] |
| UI-20 | 记录搜索与消息跳转 | 在全屏模式搜索已渲染记录，跳转上一个／下一个匹配或消息位置，快速定位长会话中的内容。 | `tui.altScreen.search` 等动作 | 内置 | [快捷键][keys] |
| UI-21 | 选择复制与回答复制 | 全屏拖选可自动复制；也能复制最后助手回答、树中选中消息或登录 URL。 | `/copy`、复制快捷键 | 内置 | [快捷键][keys] |
| UI-22 | 斜杠命令发现 | 输入 `/` 搜索内置命令、扩展命令、模板和技能；当前菜单随加载资源变化。 | `/` | 内置 | [命令参考][slash] |
| UI-23 | Markdown 与 Mermaid 展示 | 在终端呈现 Markdown 和代码；Mermaid 可设置关闭、仅最终渲染或流式渲染。 | `markdown.*` | 内置 | [设置][settings] |
| UI-24 | 启动信息与诊断 | 查看已加载资源、版本、活动快捷键和更新日志；`/debug` 导出终端渲染与会话数据便于排错。 | `/hotkeys`、`/changelog`、`/debug` | 内置 | [使用说明][usage]、[命令参考][slash] |
| UI-25 | 终端程序状态报告 | 向支持 OSC 7501 的终端／仪表盘报告 working、blocked、done、error、idle；仅发送会话名、对话框标题或错误首行，不发送提示及回答，默认先探测支持。 | `PI_PROGRAM_STATUS=1` 强制开启，`0` 关闭 | 内置／终端相关 | [终端设置][terminal] |
| UI-26 | 输出留白与导航键分离 | outputPad 同时作用于消息、工具、! 命令及摘要；Home／End 始终移动编辑器行首尾，全屏记录首尾使用 Ctrl+Home／Ctrl+End。 | `outputPad`、可配置快捷键 | 内置 | [设置][settings]、[快捷键][keys] |

## 02 文件、搜索与命令工具

| 编号 | 功能 | 详细作用 | 入口／条件 | 状态 | 依据 |
| --- | --- | --- | --- | --- | --- |
| TOOL-01 | 读取文件 | 让模型读取工作文件中的文本及支持的图片，是理解代码、配置、文档和截图的基础。 | `read`，默认启用 | 内置 | [工具清单][cli]、[工具源码][tools] |
| TOOL-02 | 执行 Shell | 执行终端命令，供模型调用编译器、测试、Git 或其他系统程序，并将输出作为工具结果继续推理。 | `bash`，默认启用 | 内置 | [工具清单][cli] |
| TOOL-03 | 执行 PowerShell | 在 Windows 直接执行 PowerShell 命令，适配 Windows 原生命令与对象管道；需纳入工具选择。 | `powershell` | 可选 | [设置][settings] |
| TOOL-04 | 精确文本替换 | 基于原文片段修改既有文件，适合局部代码变更；不是让模型不经读取就任意猜测补丁位置。 | `edit`，默认启用 | 内置 | [工具清单][cli] |
| TOOL-05 | 新建／覆盖文件 | 将完整内容写入目标文件，用于创建代码、配置或文档，也可覆盖已有文件。 | `write`，默认启用 | 内置 | [工具清单][cli] |
| TOOL-06 | 文件内容搜索 | 根据查询定位文件内容中的匹配，缩小代码阅读范围，避免逐个打开文件。 | `grep`，需启用 | 可选 | [工具清单][cli] |
| TOOL-07 | 路径模式搜索 | 使用 glob 模式寻找文件路径，例如按后缀或目录寻找测试、配置和入口。 | `find`，需启用 | 可选 | [工具清单][cli] |
| TOOL-08 | 目录列举 | 查看目录内容，帮助模型了解工程结构和可访问文件。 | `ls`，需启用 | 可选 | [工具清单][cli] |
| TOOL-09 | 工具允许／排除选择 | 用名称或 `*` 模式选择／排除工具；纯 `+name`／`-name` 列表增减默认集合，不能与普通名称混用，增减项不接受通配符。MCP 的间接可调用范围另有规则。 | `--tools`、`--exclude-tools`、`--no-builtin-tools`、`--no-tools` | 内置 | [CLI][cli] |
| TOOL-10 | 默认工具增量配置 | 全局／项目 defaultTools 支持增删继承集合；CLI 纯增减列表也基于最终默认集合工作，`/reload` 后仍保持显式减去的工具关闭。含普通名称的 CLI 列表替换选择。 | `defaultTools`、`pi -t +codemode,-write` | 内置 | [设置][settings]、[CLI][cli] |
| TOOL-11 | 只读工具组合 | SDK 提供 read、grep、find、ls 的组合便于构建审查任务；这只是工具选择，不是操作系统权限隔离。 | `createReadOnlyTools()` | 库 | [工具源码][tools] |
| TOOL-12 | 用户主动执行命令 | `!` 执行命令并将结果放入对话；`!!` 执行命令但不把输出发给模型，便于区分任务证据与本地操作。 | 编辑器中的 `!`、`!!` | 内置 | [使用说明][usage] |
| TOOL-13 | Shell 环境定制 | 设置 Shell 可执行文件和统一命令前缀，例如进入虚拟环境或添加初始化步骤。 | `shellPath`、`shellCommandPrefix` | 可选 | [设置][settings] |
| TOOL-14 | 大结果截断 | 向模型提供有限结果并在相应工具中保留完整输出路径，避免大日志消耗过多上下文；各工具上限并不相同。 | 工具截断辅助函数、Shell／MCP／Codemode | 内置／库 | [工具源码][tools]、[Codemode][code] |
| TOOL-15 | 文件修改串行保护 | 对同一文件的读取—修改—写入过程排队，避免并行工具修改互相覆盖；自定义写文件工具可复用。 | `withFileMutationQueue()` | 库 | [扩展][ext] |
| TOOL-16 | 可替换执行后端 | 工具工厂暴露读写、搜索与命令 operations，使宿主或扩展能把相同工具接到 SSH、容器或虚拟机。 | `create*Tool()` 与 operations | 库 | [工具源码][tools]、[示例][examples] |
| TOOL-17 | 执行时长持久化 | 使用单调时钟记录实际 execute 耗时并写入工具结果；恢复会话后仍能显示 Took，不包含前后 Hook 耗时，未执行的调用没有时长。 | `durationMs`、bash／PowerShell 显示 | 内置／库 | [Agent 更新记录][agentlog]、[更新记录][clilog] |

## 03 会话、历史与上下文

| 编号 | 功能 | 详细作用 | 入口／条件 | 状态 | 依据 |
| --- | --- | --- | --- | --- | --- |
| SES-01 | 自动持久化 | 将会话保存为本地 JSONL 记录，按工作目录组织，退出后可继续；普通 CLI 与 Durable 的 SQLite 会话属于不同体系。 | 默认开启 | 内置 | [会话][sessions] |
| SES-02 | 最近会话续接 | 在当前项目恢复最近一次会话，减少重复说明工作背景。 | `--continue` / `-c` | 内置 | [会话][sessions] |
| SES-03 | 会话选择器 | 搜索、排序、显示路径、筛选有名称的会话，并支持重命名和删除已有会话。 | `/resume`、`--resume` | 内置 | [会话][sessions]、[快捷键][keys] |
| SES-04 | 按路径或 ID 打开 | 已知文件路径、完整或部分 ID 时直接定位会话；跨项目匹配会按 CLI 规则处理分叉。 | `--session` | 内置 | [CLI][cli] |
| SES-05 | 确定性会话 ID | 用指定 ID 打开已有项目会话或创建新会话，便于外部程序稳定引用同一任务。 | `--session-id` | 内置 | [CLI][cli] |
| SES-06 | 新会话 | 在同一进程开启新工作上下文，避免把上一项任务的历史继续传给模型。 | `/new` | 内置 | [命令参考][slash] |
| SES-07 | 会话命名 | 为会话设置易识别名称，便于在列表和状态栏辨认工作主题。 | `/name`、`--name` | 内置 | [会话][sessions] |
| SES-08 | 会话统计 | 查看 ID、文件、消息数、token、模型成本等信息，判断上下文压力与任务消耗。 | `/session` | 内置 | [会话][sessions] |
| SES-09 | 会话树导航 | 在同一个会话文件的不同历史节点间切换；离开的分支仍保留，选中旧用户消息可编辑后形成新分支。 | `/tree` | 内置 | [会话][sessions] |
| SES-10 | 树筛选与标签 | 按用户消息、无工具结果、已标记节点或全部条目筛选；支持折叠分支、编辑标签和查看标签时间。 | 树界面快捷键 | 内置 | [快捷键][keys] |
| SES-11 | 历史分叉 | 从较早的用户消息建立独立会话，适合探索另一条实现方向并保持旧会话完整。 | `/fork`、`--fork` | 内置 | [会话][sessions] |
| SES-12 | 当前分支克隆 | 将当前活动分支复制到新会话，从现有状态开始独立工作。 | `/clone` | 内置 | [会话][sessions] |
| SES-13 | 分支摘要 | 离开分支时可生成摘要并带到目标分支，使试验结果保留而无需重发全部历史。 | `/tree` 相关流程 | 内置 | [压缩][compact] |
| SES-14 | 手动上下文压缩 | 总结较早历史并保留近期消息，可附加“必须保留哪些信息”的要求；原始记录不删除。 | `/compact [instructions]` | 内置 | [压缩][compact] |
| SES-15 | 自动上下文压缩 | 接近模型上下文阈值时自动总结，在新请求与多轮工具执行边界检查，保留模型输出空间。 | `compaction.enabled` 等设置 | 内置 | [压缩][compact] |
| SES-16 | 模型专属压缩参数 | 按精确模型覆盖预留和近期保留 token，适配不同模型窗口大小。 | `compaction.modelOverrides` | 可选 | [设置][settings] |
| SES-17 | 溢出／长度恢复 | 在适用的上下文溢出或过早长度终止情形下尝试压缩并重试，通过上下文编辑排除失败尝试，仍保留原始审计记录。 | 自动恢复路径 | 内置 | [压缩][compact] |
| SES-18 | 分支上下文重建 | 仅选择当前分支及其压缩、系统提示和工具变更生成模型上下文，不把其他分支全量发给模型。 | `SessionManager` | 内置／库 | [SDK][sdk]、[会话][sessions] |
| SES-19 | 无持久化会话 | 仅在内存运行，不产生可续接会话文件，适合临时调用和由宿主自行管理历史的场景。 | `--no-session`、`SessionManager.inMemory()` | 可选 | [CLI][cli]、[SDK][sdk] |
| SES-20 | 自定义存储目录 | 用 CLI、环境变量或设置指定会话位置，以适应项目归档或自动化目录管理。 | `--session-dir` 等 | 可选 | [会话][sessions] |
| SES-21 | 会话导入 | 从 JSONL 文件导入并恢复工作，便于转移已有会话记录。 | `/import`、SDK runtime | 内置 | [命令参考][slash]、[SDK][sdk] |
| SES-22 | HTML／JSONL 导出 | 输出可阅读 HTML 或可处理 JSONL；命令行还可直接把已有会话文件导出为 HTML。 | `/export`、`--export` | 内置 | [CLI][cli]、[会话][sessions] |
| SES-23 | 会话分享 | 上传记录生成查看链接；有 Radius 认证时使用组织 artifact，否则通过 GitHub CLI 创建私有 gist。 | `/share`，需相应外部服务 | 可选 | [使用说明][usage] |
| SES-24 | 私有问题报告 | 收集环境、错误与可选会话／摘要，支持上传或导出 ZIP，失败时可退回本地导出。 | `/bug [description]` | 内置 | [会话][sessions] |
| SES-25 | 摘要序列化排除推理块 | 压缩、分支摘要及 bug 报告序列化不再包含 thinking，避免不在实时上下文中的重放推理使摘要请求反而大于原上下文。 | serializeConversation | 内置 | [更新记录][clilog] |

## 04 模型选择、认证与本地模型

| 编号 | 功能 | 详细作用 | 入口／条件 | 状态 | 依据 |
| --- | --- | --- | --- | --- | --- |
| MOD-01 | 搜索并选择模型 | 按模型名称、ID、提供商或模糊模式选择可用聊天模型，可在会话中更换。 | `/model`、`--model` | 内置 | [模型][models]、[CLI][cli] |
| MOD-02 | 默认模型保存 | 将所选模型保存为新会话默认值；当前会话的模型变化单独记录并在恢复时还原。 | 模型选择器保存动作 | 内置 | [模型][models] |
| MOD-03 | 模型循环范围 | 定义常用模型集合和顺序，支持通配符、搜索筛选、整提供商开关及前后切换。 | `/scoped-models`、`--models` | 内置 | [快捷键][keys] |
| MOD-04 | 推理级别选择 | 在所选模型支持的 off、minimal、low、medium、high、xhigh、max 中选择；不支持的级别会被限制或调整。 | `/thinking`、`--thinking` | 内置 | [模型][models] |
| MOD-05 | 按模型记忆推理设置 | 配置全局、按模型默认推理级别及 token 预算，避免所有模型都套用同一预算。 | `modelThinkingLevels`、`thinkingBudgets` | 可选 | [设置][settings] |
| MOD-06 | API Key 登录与登出 | 通过交互流程保存或删除提供商凭据，也可使用环境变量而不保存到文件。 | `/login`、`/logout` | 内置 | [模型][models] |
| MOD-07 | OAuth／订阅认证 | 对支持的提供商走浏览器或设备认证流程，保存令牌并在需要时刷新；可用性受提供商和账户限制。 | 提供商登录流程 | 可选 | [AI 接口][ai] |
| MOD-08 | 云平台凭据 | 接入 AWS 环境凭据、profile、角色或 Google ADC／服务账号等已有云认证机制。 | Bedrock、Vertex AI | 可选 | [AI 接口][ai] |
| MOD-09 | 凭据检查与输出 | 在自动化中检测 ready、not_ready、invalid，或解析 API key／bearer token；可控制刷新和剩余有效期要求。 | `pi auth check` 等 | 内置 | [CLI][cli] |
| MOD-10 | 多来源认证优先级 | 区分进程覆盖、保存凭据、模型配置和环境凭据，避免配置同时存在时选错来源。 | `--api-key`、`auth.json`、`models.json` | 内置 | [模型][models] |
| MOD-11 | 模型目录更新与缓存 | 使用随包目录，并可叠加较新在线目录及缓存；手动刷新用于获得新模型能力信息。 | `pi update --models` | 内置 | [模型][models] |
| MOD-12 | 禁用自动联网 | 停止自动模型目录更新等网络行为，继续利用本地缓存；不等于阻断模型请求或工具联网。 | `--offline`、`PI_OFFLINE` | 可选 | [CLI][cli] |
| MOD-13 | 兼容端点配置 | 接入 Ollama、LM Studio、vLLM、SGLang 或兼容代理，自定义 baseUrl、API 协议和模型表。 | `models.json` | 可选 | [模型][models] |
| MOD-14 | 模型元数据覆盖 | 修改现有模型的上下文、输入或其他描述而不替换整个提供商目录；未知模型 ID 的覆盖被忽略。 | `modelOverrides` | 可选 | [模型][models] |
| MOD-15 | 动态密钥与请求头 | 配置环境变量插值、字面量或命令生成值，以衔接外部密钥管理；模型配置中的命令在请求时执行。 | `apiKey`、headers 配置 | 可选 | [模型][models] |
| MOD-16 | 按推理级别设置采样 | 在支持的 OpenAI 兼容 API 中按推理级别覆盖 temperature 等采样参数，并与模型和请求级参数合并。 | `samplingParamsByThinkingLevel` | 可选 | [模型][models] |
| MOD-17 | 图片尺寸与编码限制 | 控制新附件和工具图片的缩放、大小与 JPEG 质量；图片历史写入后不会因换模型而重新编码。 | `inputLimits.images.resize`、`images.*` | 可选 | [模型][models]、[设置][settings] |
| MOD-18 | 提示缓存预热 | 对声明缓存寿命且预计有足够收益的模型刷新提示缓存；预热计入用量，但不进入模型对话内容。 | `cacheWarming` | 内置／可配置 | [设置][settings] |
| MOD-19 | 网络传输与重试配置 | 设置代理、HTTP／WebSocket 超时、传输方式、暂时错误退避与重试次数；具体传输依赖提供商支持。 | `transport`、`retry.*` 等 | 内置／可配置 | [设置][settings] |
| MOD-20 | 虚拟模型路由 | 暴露一个可选择的逻辑模型，在每次请求时按任务、成本或上下文选择真实模型和推理级别。 | `registerVirtualModel()` | 可选 | [虚拟模型][virtual] |
| MOD-21 | 路由状态与用量区分 | 保存虚拟选择、每轮实际模型与分支路由状态，恢复后继续路由；状态跨压缩保留，费用按实际模型统计。 | 虚拟模型状态 | 可选 | [虚拟模型][virtual] |
| MOD-22 | llama.cpp 路由器连接 | 保存本地 router URL 和可选密钥，并把可用模型接入正常模型选择流程。 | `/login llama.cpp` | 可选 | [llama.cpp][llama] |
| MOD-23 | 本地模型加载／卸载 | 观察路由器真实状态，主动加载、卸载模型，并处理睡眠或自动加载模型；不删除磁盘模型文件。 | `/llama` | 可选 | [llama.cpp][llama] |
| MOD-24 | Hugging Face 模型下载 | 在界面搜索仓库、选择量化版本或输入精确仓库标识；由 llama.cpp 服务端实际下载。 | `/llama` 的下载操作 | 可选 | [llama.cpp][llama] |
| MOD-25 | 本地分类推理 | 把 llama.cpp 聊天模型作为 choice、bool、score 分类器，读取候选标签的 token 概率而不是生成普通长回答。 | Codemode 或扩展分类 API | 可选 | [llama.cpp][llama] |
| MOD-26 | llama.cpp 原生决策模型 | 识别 router 元数据中 decisions 输出类型，将 Julia-1、Laya、Kev、lev、OpenJev 等只列作分类模型，通过 /v1/systemone 原生调用；无需先加载即可识别睡眠模型。 | llama.cpp 0.6.0+；`typesafe-system-one` | 可选 | [llama.cpp][llama] |
| MOD-27 | OpenAI Decisions 凭据边界 | gpt-6-luna 用 API key 做分类及图像判断；若 openai 已通过 /login 保存 OAuth，即使有 OPENAI_API_KEY 也不列为可用，需退出该登录后使用 key。 | `models.classify()`；非 `/model` 聊天选项 | 可选 | [模型][models] |
| MOD-28 | 订阅刷新与本地回调恢复 | 已经开始的 OAuth 刷新会完成并保存轮换令牌，避免取消请求造成凭据失效；Anthropic 登录默认回调端口被占用时改用空闲 loopback 端口。 | OAuth 登录与刷新 | 内置认证行为 | [AI 更新记录][ailog] |
| MOD-29 | 按 OpenRouter 密钥更新目录 | 交互启动、打开 /model、登录及 update --models 时刷新并保存个性化聊天目录；离线、print、RPC 使用缓存，外部换 key 后需下次刷新才替换旧目录。代理无 /models/user 或拒绝 key 时退回全目录。 | OpenRouter 目录刷新 | 内置／可选认证 | [提供商][providers] |

## 05 配置、技能、模板、主题与包

| 编号 | 功能 | 详细作用 | 入口／条件 | 状态 | 依据 |
| --- | --- | --- | --- | --- | --- |
| CFG-01 | 用户／项目分层设置 | 用户偏好保存在 agent 目录，项目 `.pi` 设置按规则覆盖；资源数组可组合加载。 | `settings.json`、`/settings` | 内置 | [配置][config] |
| CFG-02 | Agent 目录重定位 | 改变认证、模型配置、资源和默认会话等用户数据的根目录，方便隔离运行配置。 | `PI_CODING_AGENT_DIR`、SDK `agentDir` | 可选 | [配置][config] |
| CFG-03 | 项目信任决策 | 在加载项目可执行扩展和受保护资源前征求或读取信任决定；支持目录继承、扩展决策与单次 CLI 覆盖。 | `/trust`、`--approve`、`--no-approve` | 内置 | [安全边界][security] |
| CFG-04 | 无界面信任策略 | Print、JSON、RPC 没有内置询问界面时，按明确覆盖、已保存决定或全局策略决定是否加载项目资源。 | `defaultProjectTrust` | 内置 | [安全边界][security] |
| CFG-05 | 分层工程指令 | 自动发现 agent 目录、当前目录和父目录的 AGENTS／CLAUDE 指令，形成工作约束。 | 上下文文件 | 内置 | [配置][config] |
| CFG-06 | 同目录指令覆盖 | `AGENTS.override.md` 替代同目录普通指令文件，不会消除其他目录的指令。 | `AGENTS.override.md` | 可选 | [配置][config] |
| CFG-07 | 系统提示替换／追加 | 通过文件或 CLI 替换默认提示，或添加补充要求；受信任项目同名系统文件优先于用户文件。 | `SYSTEM.md`、`APPEND_SYSTEM.md`、CLI 选项 | 可选 | [配置][config] |
| CFG-08 | 资源路径和过滤 | 从目录、文件、glob 或包加载资源，支持排除与精确包含／排除；!pattern、+path、-path 内的 ~ 也展开为用户目录，避免带前缀路径无法匹配。 | extensions、skills、prompts、themes 设置 | 可选 | [设置][settings]、[更新记录][clilog] |
| CFG-09 | 禁用资源类别 | 单次启动可关闭扩展、技能、模板、主题或上下文文件发现，显式路径按各选项规则仍可加载。 | `--no-extensions` 等 | 内置 | [CLI][cli] |
| CFG-10 | 运行中重载 | 重新读取快捷键、扩展、技能、模板、主题和上下文配置，方便开发和调整资源。 | `/reload` | 内置 | [命令参考][slash] |
| CFG-11 | 技能渐进加载 | 初始只将技能名称、描述和路径告知模型，真正需要时才读完整 SKILL.md，减少常驻上下文。 | 用户／项目技能目录 | 内置 | [技能][skills] |
| CFG-12 | 显式技能调用 | 用 `/skill:name` 强制载入指定技能，可附带任务参数，避免依赖模型自行识别。 | `/skill:name` | 内置 | [技能][skills] |
| CFG-13 | 仅手动技能 | 隐藏技能的自动模型选择入口，但保留显式命令调用；技能命令菜单开关不等于禁止手动输入。 | `disable-model-invocation` | 可选 | [技能][skills] |
| CFG-14 | 技能目录兼容 | 支持 `.pi/skills` 和 Agent Skills 的 `.agents/skills` 等位置，递归发现技能，并允许携带脚本、参考和资产。 | 技能目录与包 | 内置 | [技能][skills] |
| CFG-15 | 技能校验与冲突诊断 | 检查 frontmatter、描述与名称等格式，报告警告或拒绝不完整技能；同名冲突保留先发现项。 | 技能加载器 | 内置 | [技能][skills] |
| CFG-16 | Markdown 提示模板 | 将 Markdown 文件变成可补全的 `/命令`，适合复用审查、总结等固定提示。 | prompts 目录 | 内置 | [模板][templates] |
| CFG-17 | 模板参数展开 | 支持位置参数、全部参数、默认值和参数切片，并按类似 Shell 的引用规则解析带空格参数。 | `$1`、`$@`、`${1:-default}` 等 | 内置 | [模板][templates] |
| CFG-18 | 快捷键配置 | 以动作名称绑定一个或多个组合键，空数组可禁用；重载后生效，支持不同平台的默认映射。 | `keybindings.json` | 内置 | [快捷键][keys] |
| CFG-19 | 内置主题与自动明暗 | system 主题根据终端颜色生成配色，也可选择 dark、light 或明暗主题对并响应外观变化。 | `/settings`、`--use-theme` | 内置 | [主题][themes] |
| CFG-20 | 自定义主题 | 用 JSON 定义语义颜色、变量和导出背景；支持 RGB、ANSI、OKLCH、OKHSL 与终端默认色。 | themes 目录 | 可选 | [主题][themes] |
| CFG-21 | 主题重载与格式检查 | 活动用户主题可热更新，其他来源可 `/reload`；重复名称、循环变量等错误会报告。 | 主题加载器 | 内置 | [主题][themes] |
| CFG-22 | Pi 资源包安装 | 从 npm、Git、仓库 URL 或本地路径安装／引用扩展、技能、模板和主题组合。 | `pi install` | 内置 | [资源包][packages] |
| CFG-23 | 资源包列举、移除与更新 | 管理已配置包和设置条目，支持全体或指定包更新，以及全局／项目范围。 | `pi list/remove/update --extensions` | 内置 | [资源包][packages]、[CLI][cli] |
| CFG-24 | 包资源交互筛选 | 选择一个包中哪些扩展、技能、模板、主题加载，同时管理内置扩展开关。 | `pi config` | 内置 | [资源包][packages] |
| CFG-25 | 包清单与依赖集成 | `package.json` 的 `pi` 字段声明资源路径；扩展可携带自身依赖，并按宿主包 peer 约定复用 Pi 运行时。 | `pi` manifest | 可选 | [资源包][packages] |
| CFG-26 | 包版本固定与去重 | 固定 npm 版本、Git tag／commit，按包名、仓库 URL 或绝对路径识别同一包，避免等价来源重复加载。 | 包源规范 | 内置 | [资源包][packages] |
| CFG-27 | 临时试用扩展包 | 只在当前进程加载指定资源包，便于试验而不写入长期设置。 | `pi -e <source>` | 可选 | [资源包][packages] |
| CFG-28 | 编辑器 JSON Schema | models、settings、keybindings、theme 的生成 schema 已发布到 pi.dev，供编辑器验证和补全；仓库 schemas 产物由 TypeScript 定义生成。 | `$schema: https://pi.dev/schemas/*.schema.json` | 开发／配置支持 | [设置][settings]、[Schema 生成器][schemas] |
| CFG-29 | 严格主题属性检查 | 启动和 reload 使用一致 schema 校验，拒绝未知顶层及 colors／export 字段，自定义复用颜色放 vars；建议 $schema 改为官方 pi.dev 地址。 | `https://pi.dev/schemas/theme.schema.json` | 内置 | [主题][themes] |

## 06 扩展系统

| 编号 | 功能 | 详细作用 | 入口／条件 | 状态 | 依据 |
| --- | --- | --- | --- | --- | --- |
| EXT-01 | TypeScript／JavaScript 扩展加载 | 以工厂函数注册能力，单文件或目录入口均可；jiti 使本地 TypeScript 扩展无需单独编译，异步工厂会等待完成。 | extensions 目录、`-e` | 可选 | [扩展][ext] |
| EXT-02 | 生命周期事件 | 观察或调整资源发现、会话、输入、模型、消息、工具和运行生命周期；按注册顺序调用并可取消订阅。 | `pi.on()` | 库 | [扩展][ext] |
| EXT-03 | 输入变换 | 在普通输入进入代理前处理内容、命令或引用，可按流式状态选择不同处理逻辑。 | `input` 事件 | 库 | [扩展][ext]、[示例][examples] |
| EXT-04 | 系统提示与上下文变换 | before_agent_start 的 messageType 区分用户 prompt/images 与自定义起始 message；两类运行都可添加消息和提示区块，后续工具轮次保持该运行的系统提示修改。 | before_agent_start、context、context_with_system | 库 | [扩展][ext] |
| EXT-05 | 最终消息改写 | 在完成消息边界替换内容，同时保留消息角色，便于过滤或规范化输出。 | `message_end` | 库 | [扩展][ext] |
| EXT-06 | 自定义模型工具 | 注册带 TypeBox 参数、执行函数、模型内容和 UI details 的工具；支持进度、错误和用量上报。 | `registerTool()` | 库 | [扩展][ext] |
| EXT-07 | 工具输入拦截 | 校验后、执行前改写参数或阻止调用，适合审批和路径保护；处理器失败时阻止执行。 | `tool_call` | 库 | [扩展][ext] |
| EXT-08 | 工具结果处理 | 修改或脱敏结果，各处理器可看到先前修改；结构化结果需与文本一并处理。 | `tool_result` | 库 | [扩展][ext] |
| EXT-09 | 结构化工具输出 | 同时提供模型可读文本和可编程数据，使 Codemode 等调用者无需解析展示文本。 | `outputSchema`、`structuredContent` | 库 | [扩展][ext] |
| EXT-10 | 嵌套工具调用 | 一个工具可经统一管线调用其他工具，保留参数校验、前后 Hook、父调用 ID 和进度事件。 | `ctx.executeTool()` | 库 | [扩展][ext] |
| EXT-11 | 嵌套调用记录与用量汇总 | 外层结果保存有界的嵌套调用元数据，供导出和压缩文件跟踪使用；嵌套用量自动向外汇总。 | `nestedCalls`、结果 `usage` | 库 | [扩展][ext] |
| EXT-12 | 工具暴露级别 | 区分 direct、model-only、codemode、deferred、hidden，分别控制声明、嵌套可调用性、延迟发现和隐藏。 | 工具 `exposure` | 库 | [扩展][ext] |
| EXT-13 | 命名空间、别名与行为提示 | namespace 组织工具并提供长指导，aliases 支持按服务别名或脚本标识符查找；annotations 标注只读、破坏性和幂等等提示，不代表已验证安全属性。 | namespace.aliases、annotations | 库 | [扩展][ext] |
| EXT-14 | 动态工具激活 | 在工具已注册的前提下调整活跃集合，变更在下次请求前写入会话，支持按需加载能力。 | `getActiveTools()`、`setActiveTools()` | 库 | [扩展][ext] |
| EXT-15 | 模型可见工具集整形 | 编排工具可改写声明或隐藏声明，并通过 getPromptGuidelines 读取工具指导。默认系统提示不再提及被隐藏工具，编排工具负责将其指导带入自己的声明。 | `prepareLoadout()`、`ToolLoadout.getPromptGuidelines()` | 库 | [扩展][ext] |
| EXT-16 | 自定义命令、参数和快捷键 | 注册斜杠命令及参数补全、命令行长参数和快捷键，将常见工作流变成直接操作。 | `registerCommand/Flag/Shortcut()` | 库 | [扩展][ext] |
| EXT-17 | 工具呈现覆盖 | 为工具调用与结果提供紧凑或详细显示，并可为尚未注册的 MCP 工具匹配渲染器；适用于 TUI 和 HTML 导出。 | `renderCall`、`renderResult`、`registerToolRenderer()` | 库 | [扩展][ext] |
| EXT-18 | 对话框与通知 | 向用户提供选择、确认、输入、多行编辑、状态和通知；RPC 可转发支持的 UI 请求。 | `ctx.ui` | 库 | [扩展][ext]、[RPC UI][rpcui] |
| EXT-19 | 自定义终端界面 | 插入组件、覆盖层、编辑器、页眉页脚、工作指示器和补全器，创建专用交互。 | `ctx.ui.custom()` 等 | 库 | [扩展][ext]、[示例][examples] |
| EXT-20 | 会话状态持久化 | 工具 details 保存随分支变化的状态，自定义条目保存不发模型的数据，自定义消息保存可见上下文。 | `appendEntry()`、`sendMessage()` | 库 | [扩展][ext] |
| EXT-21 | 自定义消息与条目渲染 | 将扩展保存的消息或非模型条目显示为专门界面，例如调试记录、状态卡片。 | message／entry renderer | 库 | [示例][examples] |
| EXT-22 | 会话控制与安全切换 | 命令上下文可等待空闲、重载、导航与替换会话；替换后应使用新上下文和重新绑定监听。 | `ExtensionCommandContext` | 库 | [扩展][ext] |
| EXT-23 | 继续／结束运行控制 | 在轮次结束或最终收尾前请求下一次模型调用；工具结果可提示批次结束后无需再回答。 | `turn_end`、`agent_before_settle`、`terminate` | 库 | [扩展][ext] |
| EXT-24 | 确定最终静止及取消状态 | 区别低层 agent_end 与自动恢复、排队任务完成后的 agent_settled；其 aborted 字段表明是否因取消结束，供通知、JSON 消费端和仪表盘正确分类。 | `agent_settled.aborted` | 库 | [JSON 事件][json]、[更新记录][clilog] |
| EXT-25 | 提供商和虚拟模型扩展 | 注册自定义流式协议、认证和模型发现，或逐请求进行模型路由，复用 Pi 会话和选择器。 | `registerProvider()`、`registerVirtualModel()` | 库 | [扩展][ext]、[虚拟模型][virtual] |
| EXT-26 | 动态 MCP 服务注册 | 扩展按当前环境注册或移除服务器，连接由内置 MCP 支持管理；注册本身不写入配置文件。 | `registerMcpServer()`、`unregisterMcpServer()` | 库 | [扩展][ext] |
| EXT-27 | 扩展间事件总线 | 在同一进程的多个扩展间传递事件，减少彼此直接引用内部实现。 | `pi.events` | 库 | [扩展][ext] |
| EXT-28 | 原始提供商事件观察 | 在标准化前读取解析后的提供商事件以排查专有字段；不是原始网络字节，也不会默认持久化。 | `provider_stream_event` | 库 | [扩展][ext] |
| EXT-29 | 缓存预热决策覆盖 | 根据宿主策略允许或停止空闲缓存刷新，以控制收益和额外用量。 | `cache_warming_decision` | 库 | [扩展][ext] |
| EXT-30 | 用户命令重定向与资源清理 | 拦截 `!` 执行到替代后端，并通过 session_start／session_shutdown 管理进程、监听等资源。 | `user_bash`、关闭事件 | 库 | [扩展][ext] |
| EXT-31 | 工具呈现的耗时与留白上下文 | 渲染器读取最终结果 durationMs 和 outputPad，使自定义工具显示与普通工具的耗时和横向留白一致；工具结束事件也携带耗时。 | 工具 render context、tool_execution_end | 库 | [更新记录][clilog] |
| EXT-32 | 间接工具可达范围声明 | 编排工具用 reachesTools 返回 all 或可指向工具／命名空间的输入词，MCP 据此等待所需连接并判断替代 codemode／tool_search 是否真能访问 MCP。 | ToolDefinition.reachesTools、getAllTools | 库 | [扩展][ext] |
| EXT-33 | 运行启动期排队与取消 | 压缩检查及 before_agent_start 阶段已计为 busy；sendMessage 进入当前启动的运行，sendUserMessage 需 deliverAs，期间 abort 会在运行启动后取消，防止重入创建第二次运行。 | ctx.isIdle、sendMessage、sendUserMessage | 库 | [更新记录][clilog] |

## 07 MCP 接入与协议客户端

| 编号 | 功能 | 详细作用 | 入口／条件 | 状态 | 依据 |
| --- | --- | --- | --- | --- | --- |
| MCP-01 | 本地 stdio 服务 | 启动本地 MCP 程序，用标准输入输出交换请求，支持命令、参数、环境与工作目录配置。 | `mcp.json`、`pi mcp add -- <command>` | 可选 | [MCP 接入][mcp] |
| MCP-02 | 远程 Streamable HTTP | 连接远端 MCP 服务，支持自定义请求头、bearer token 与 OAuth；不支持旧版 HTTP+SSE 接法。 | `pi mcp add --url` | 可选 | [MCP 接入][mcp] |
| MCP-03 | 全局／项目 MCP 配置 | 全局服务可供所有项目使用，受信任项目可覆盖同名配置，也可仅覆盖启用和暴露策略。 | agent 目录及 `.pi/mcp.json` | 内置 | [MCP 接入][mcp] |
| MCP-04 | 服务增删命令 | 从 Shell 添加、替换或移除 MCP 配置，支持本地范围；删除配置不自动删除已存 OAuth 凭据。 | `pi mcp add/remove` | 内置 | [CLI][cli] |
| MCP-05 | 连接与能力诊断 | 连接已启用服务并报告状态、工具与错误；连接阶段不再枚举所有资源，JSON 用 resources:true 表示支持资源，不再返回资源和模板数量。 | `pi mcp list [--json]` | 内置 | [更新记录][clilog]、[MCP][mcp] |
| MCP-06 | 会话内服务管理 | 即时展示状态、来源、工具数、资源支持标志、错误与 stderr 尾部；连接、启停和重连期间实时更新且仍可操作，不再统计全部资源数量。 | `/mcp` | 内置扩展 | [MCP][mcp]、[更新记录][clilog] |
| MCP-07 | 后台连接与按需等待 | 启动时后台连接；间接调用通过 reachesTools 声明确定需等待哪些服务器，搜索或列举工具等待全部相关连接；资源按需查询，不因枚举资源阻挡工具注册。 | MCP 生命周期、tool_call | 内置 | [扩展][ext]、[更新记录][clilog] |
| MCP-08 | OAuth 登录、刷新与取消 | 发现认证服务，执行 PKCE／客户端注册并保存刷新令牌；Esc 可在各阶段取消，会话关闭会中止登录，每次授权服务请求有 15 秒超时，CLI timeout 限制整个登录过程。 | `/mcp login`、`pi mcp login --timeout` | 可选 | [MCP 接入][mcp]、[更新记录][clilog] |
| MCP-09 | OAuth 高级兼容配置 | 支持预注册 client ID、可选密钥、回调端口、scope、客户端元数据文档及指定认证元数据地址。 | `oauth` 配置 | 可选 | [MCP 接入][mcp] |
| MCP-10 | 按服务身份隔离凭据 | 以服务名称和 URL 关联认证，同 URL 的不同账户名称可独立登录；登出删除该身份凭据。 | `mcp-auth.json` | 内置 | [MCP 接入][mcp] |
| MCP-11 | 直接、延迟与脚本暴露 | direct 直接声明；deferred 通过 tool_search 发现；默认 codemode 通过脚本发现；hidden 不可达。 | `exposure` | 内置 | [MCP 接入][mcp] |
| MCP-12 | 按工具覆盖暴露 | 对单个工具名或通配模式覆盖服务器策略，例如只直接展示搜索、隐藏删除工具。 | `toolExposure` | 可选 | [MCP 接入][mcp] |
| MCP-13 | 工具发现与动态变化 | 拉取分页工具列表，处理工具列表变更通知，使新增工具可用、被撤回工具不可达。 | MCP 工具注册管线 | 内置 | [MCP 接入][mcp] |
| MCP-14 | 工具命名防冲突 | 将服务和工具名规范化为模型可用名称，同服务规范化冲突使用后缀区分，服务名冲突会报告。 | `mcp__<server>__<tool>` | 内置 | [MCP 接入][mcp] |
| MCP-15 | 资源枚举 | 列出服务器公开资源，支持服务筛选和分页，帮助模型发现不以工具形式暴露的数据。 | `list_mcp_resources` | 可选自动注册 | [MCP 接入][mcp] |
| MCP-16 | 资源模板枚举 | 获取参数化 URI 模板，以访问无法逐条枚举的资源。 | `list_mcp_resource_templates` | 可选自动注册 | [MCP 接入][mcp] |
| MCP-17 | 资源读取 | 按服务和 URI 获取资源；文本与图片作为内容返回，其他二进制保存临时文件并提供路径。 | `read_mcp_resource` | 可选自动注册 | [MCP 接入][mcp] |
| MCP-18 | 内容与大输出处理 | 工具文本、图片、结构化结果进入统一工具管线；直接文本过大时截断并保留完整文件，脚本可先处理完整结果。 | CallToolResult 转换 | 内置 | [MCP 接入][mcp] |
| MCP-19 | 权限 Hook 与嵌套追踪 | MCP 和 Codemode 中的 MCP 调用都经过普通工具事件，扩展可统一审批、记录及处理结果。 | `tool_call`、`tool_result` | 库 | [MCP 接入][mcp] |
| MCP-20 | 超时、进度和取消 | 请求具有超时，进度通知可续期；取消信号可传播到协议层，长工具不会只依赖固定等待。 | MCP 客户端 | 库 | [MCP 库][mcplib] |
| MCP-21 | HTTP 会话与流恢复 | 管理 HTTP session、服务端 GET 流重连和 Last-Event-ID 响应流恢复；不能等同于安全重做有副作用的工具调用。 | StreamableHttpTransport | 库 | [MCP 库][mcplib] |
| MCP-22 | 断连重连与日志 | 断开的连接在后续调用时重连；服务日志写入 mcp.log 并轮转。读取资源可按规则重试，工具业务调用不盲目重试。 | 内置 MCP 管理器 | 内置 | [MCP 接入][mcp] |
| MCP-23 | stdio 进程组关闭 | 关闭 stdin，逐步发送终止信号到进程组，尽量回收经 npx／uvx 启动的子进程。 | StdioTransport | 库 | [MCP 库][mcplib] |
| MCP-24 | 传输无关客户端 | 独立包负责 JSON-RPC 初始化、请求关联、服务器请求、根目录查询和通用通知，可脱离 Pi 使用。 | `McpClient` | 库 | [MCP 库][mcplib] |
| MCP-25 | 内存测试传输 | 在同一进程构造成对传输，测试客户端与适配器而不启动真实外部服务。 | `createInMemoryTransportPair()` | 库 | [MCP 库][mcplib] |
| MCP-26 | 替换或单次禁用内置适配器 | 同名 /mcp 扩展可接管会话集成；配置可长期禁用 builtin:mcp，--no-mcp 可单次禁止内置连接、工具及命令，但不影响替代扩展；Shell 级 mcp 命令仍用内置实现。 | `pi config`、`--no-mcp` | 可选 | [MCP 接入][mcp]、[CLI][cli] |
| MCP-27 | MCP 通配选择与可达性区分 | --tools 未含 mcp__ 前缀项时保留 MCP 的间接调用范围，但未匹配工具不直接声明；出现前缀项后按模式过滤 MCP。--exclude-tools 可统一排除，资源工具也按 MCP 处理。 | `--tools read,codemode,mcp__radius__*`、`--exclude-tools` | 可选 | [CLI][cli]、[MCP][mcp] |

## 08 Codemode 脚本编排

| 编号 | 功能 | 详细作用 | 入口／条件 | 状态 | 依据 |
| --- | --- | --- | --- | --- | --- |
| CODE-01 | JavaScript 工具编排 | 模型提交原始 JavaScript，以异步函数体运行，可顺序调用工具并把结果继续作为下一步输入。 | `codemode`，默认未激活 | 可选 | [Codemode][code] |
| CODE-02 | 并行调用与结果聚合 | 用 Promise.allSettled 等方式并行执行独立调用，筛选、排序或聚合后只输出重要部分。 | `tools.<name>()` | 可选 | [Codemode][code] |
| CODE-03 | 压缩模型上下文开销 | 嵌套调用结果先留在脚本内，模型只收到脚本主动输出和返回值，适合大量 API 数据处理。 | `text()`、`return` | 可选 | [Codemode][code] |
| CODE-04 | QuickJS/WASM 隔离 | 脚本没有 Node、直接文件、网络、计时器或模块能力，外部访问仅通过注入工具和 globals。工具自身的副作用仍真实发生。 | CodemodeSandbox | 库 | [Codemode 库][codelib] |
| CODE-05 | 工具列表与相关性检索 | 通过 ALL_TOOLS 查看工具名和说明，或按 BM25 与命名空间检索相关工具，避免所有描述常驻提示。 | `ALL_TOOLS`、`searchTools()` | 可选 | [Codemode][code] |
| CODE-06 | 按需查看工具接口 | 获取指定工具的 TypeScript 声明和说明，或命名空间的完整指导，降低猜接口风险。 | `describeTool()`、`describeNamespace()` | 可选 | [Codemode][code] |
| CODE-07 | 延迟工具直接激活 | tool_search 搜索未声明工具并让结果在下一次模型调用中直接可用，已加载工具随分支保存。 | `tool_search` | 可选 | [CLI][cli] |
| CODE-08 | 工具声明预算 | 控制内嵌声明 token 预算，超出部分仍可检索；only 模式将其他活跃工具的模型入口集中到脚本。 | `codemode.inlineBudget`、`codemode.mode` | 可选 | [设置][settings] |
| CODE-09 | 分块文本、日志和提前结束 | text 和 return 的多个文本项带序号分隔；console 调用集中放在末尾 console_output 块，每次调用占一行；exit 成功结束并保留输出和存储写入，便于区分结果与调试日志。 | `text()`、`console.*()`、`return`、`exit()` | 库／可选 | [Codemode][code] |
| CODE-10 | 图片输出与临时保存 | image 接收 base64 data URL 或图片内容块，将图片交给模型并保存临时文件供后续操作；不接受远程图片 URL。 | `image()` | 可选 | [Codemode][code] |
| CODE-11 | 分支持久小型状态 | store/load 保存 JSON 值，成功脚本才提交写入；CLI 会话恢复和分支读取各自路径上的值。 | `store()`、`load()` | 可选 | [Codemode][code] |
| CODE-12 | 非聊天模型发现 | 查看聊天、图像和分类模型目录与可用认证；脚本只执行分类和图像操作，不能通过该 models 对象调用聊天模型。 | `models.getAvailableOfType()` 等 | 可选 | [Codemode][code] |
| CODE-13 | 文本／图像类型化分类 | 对 JSON 状态以及模型支持的 images 进行类别、布尔或评分判断；read 图片所得内容块可直接传入。图像支持须由分类模型声明，不支持时返回错误。 | `models.classify(model, { state, images, questions })` | 可选 | [Codemode][code] |
| CODE-14 | 图像生成与参考图编辑 | 用提示及可选图片调用图像模型，返回图片与可能的文本；具体输入能力由模型决定。 | `models.generateImages()` | 可选 | [Codemode][code] |
| CODE-15 | 模型调用并发与费用 | 每脚本的非聊天模型调用最多四路并发，其余排队；报告的用量归入外层工具和会话成本。 | models globals | 内置于该集成 | [Codemode][code] |
| CODE-16 | 输出预算与硬限制 | 可指定 max_output_tokens 和 timeout_ms；CLI 默认 VM 256 MB，输出和 store 另有容量上限，超限会报错。 | 首行 `// @options:` | 可选 | [Codemode][code] |
| CODE-17 | 取消与失败结果 | Node／Bun worker 可因超时或取消而终止；失败保留已产生输出，取消未等待调用，已完成外部动作不回滚。远程和 inline 后端有独立中断限制，不能套用 worker 的终止保证。 | AbortSignal、执行结果 | 库 | [Codemode 库][codelib] |
| CODE-18 | 独立沙箱嵌入 | 其他应用可注入工具、globals、store 和内存限制，使用独立 Codemode 包，无需依赖 Pi CLI。 | `CodemodeSandbox` | 库 | [Codemode 库][codelib] |
| CODE-19 | 声明生成与源码格式校验 | 输入属性描述和 integer、上下界、长度、pattern、default 等约束显示为注释标签，超过预算先省略标签；MCP 结果展开实际结构而非未定义的 CallToolResult<T>，不替代运行时参数验证。 | renderDeclarations、schemaToType、parseCodemodeSource | 库 | [Codemode][codelib]、[更新记录][codelog] |
| CODE-20 | 打包宿主支持 | 显式提供 WASM 和 worker 入口，使沙箱可用于单文件或 Bun 编译宿主。 | `wasm`、`workerUrl` | 库 | [Codemode 库][codelib] |
| CODE-21 | 图片工具结果组合 | tools.read 读取图片时返回含 type、data、mimeType、note 的图片块，可交给 image 输出或视觉分类，不再把图片丢成纯文本结果。 | `tools.read()` → `image()`／`models.classify()` | 可选 | [Codemode][code] |
| CODE-22 | Cloudflare 远程沙箱 | 在独立部署 Worker 的 Durable Object 中运行 VM，工具和调用记录保留在 Agent 宿主，经 Workers RPC 回调；可按会话或按次分配对象，避免计算长时间阻塞会话对象。 | `RemoteCodemodeSandbox`、`/portable`、`/cloudflare` | 库／需部署 | [Codemode 库][codelib] |
| CODE-23 | 同线程可移植沙箱 | 在调用线程运行 QuickJS，用于可接受同步计算阻塞的 WebAssembly 环境；Cloudflare 提供编译模块辅助入口，不需要额外部署沙箱 Worker。 | `InlineCodemodeSandbox`、`createInlineCodemodeSandbox()` | 库 | [Codemode 库][codelib] |
| CODE-24 | 远程 CPU 与内存预算 | Cloudflare 默认中断轮询预算 100000、每 VM 内存 32 MiB，服务端限制请求上限；纯计算时用预算而非定时器保障结束，取消立即结束调用方等待，远端至下一工具调用或预算耗尽才停。 | `interruptBudget`、远端 maxMemoryLimitBytes | 库 | [Codemode 库][codelib] |
| CODE-25 | 沙箱内置对象与悬空 Promise 防护 | 冻结 VM 内置对象防止原型篡改破坏宿主管线；没有工具在途且无法再结算的 Promise 立即失败，避免不可完成的脚本无限等待。 | QuickJS 执行器 | 库 | [Codemode 库][codelib]、[更新记录][clilog] |
| CODE-26 | 确定性脚本运行入口 | start 允许宿主自行处理每个 onCall 并用 deliver 提交结果，支持从持久日志重跑；execute 保持原语义，只有宿主另行持久化才有跨进程恢复能力。 | sandbox.start、run.deliver、run.result | 库 | [Codemode][codelib] |
| CODE-27 | 可重放的时间、随机与顺序 | start 固定 startedAt、seed、UTC，按连续结果序号处理结果，禁用 WeakRef／FinalizationRegistry；同指纹、脚本、初始环境和结果序列可重复产生同样调用。 | startedAt、seed、onStarted、onIdle | 库 | [Codemode][codelib] |
| CODE-28 | 结构化失败结果判断 | 有 schema 且返回自有结构化值的工具可在失败时正常 resolve，例如 bash 非零 exit_code；无此值的失败、拦截或无效参数才 reject，脚本须检查退出码或 isError。 | tools 调用与输出 schema | 可选／接口约定 | [更新记录][clilog] |

## 09 SDK、RPC 与 JSON 集成

| 编号 | 功能 | 详细作用 | 入口／条件 | 状态 | 依据 |
| --- | --- | --- | --- | --- | --- |
| INT-01 | 进程内创建会话 | 在 Node.js／Bun 应用中直接创建 AgentSession，复用 Pi 的模型、工具、配置、会话和扩展，而无需启动终端。 | `createAgentSession()` | 库 | [SDK][sdk] |
| INT-02 | 提交文本、图片与队列 | 直接 prompt、steer、followUp，并显式决定忙碌时行为；可获取最后助手文本。 | AgentSession | 库 | [SDK][sdk] |
| INT-03 | 等待、取消和销毁 | 等待真正空闲，或取消工作并等待结束；销毁会话时清除监听和旧扩展上下文。 | `waitForIdle()`、`abort()`、`dispose()` | 库 | [SDK][sdk] |
| INT-04 | 会话事件订阅 | 接收文本增量、工具进度、队列、重试、压缩及最终静止事件，以驱动自己的界面。 | `session.subscribe()` | 库 | [SDK][sdk] |
| INT-05 | 宿主依赖注入 | 替换 ModelRuntime、SettingsManager、SessionManager、ResourceLoader 与工具集合，让宿主控制存储和资源边界。 | createAgentSession 选项 | 库 | [SDK][sdk] |
| INT-06 | 内联扩展 | 在宿主代码中直接定义扩展工厂，可设置诊断名称、可替代标记或内置扩展身份。 | `DefaultResourceLoader` | 库 | [SDK][sdk] |
| INT-07 | 会话运行时替换 | 在同一宿主中新建、切换、分叉或导入会话，按目标工作目录重新创建服务；旧订阅需要重绑。 | `AgentSessionRuntime` | 库 | [SDK][sdk] |
| INT-08 | SDK 接入 MCP／Codemode | 显式把 MCP、Codemode、tool_search 工厂加入资源加载器并绑定扩展；SDK 不自动照搬 CLI 内置扩展。 | 对应 `create*Extension()` | 库 | [SDK][sdk] |
| INT-09 | 类型化子进程客户端 | 启动 Pi RPC 子进程，关联命令响应、暴露类型化方法并分发事件，省去自行维护管道协议。 | `RpcClient` | 库 | [RPC][rpc] |
| INT-10 | RPC 输入与任务控制 | prompt／steer／follow_up 发送任务；abort 等待空闲；clear_queue 返回排队文本供客户端恢复编辑。接受提示不代表任务完成。 | RPC 五类输入控制命令 | 内置协议 | [RPC 命令][rpccmd] |
| INT-11 | RPC 状态与消息查询 | 读取当前模型、流式状态、压缩状态、队列模式及当前消息，供外部 UI 初始化或刷新。 | `get_state`、`get_messages` | 内置协议 | [RPC 命令][rpccmd] |
| INT-12 | RPC 模型控制 | 列举可用模型、设置模型或循环切换，返回实际配置模型对象。 | `get_available_models`、`set_model`、`cycle_model` | 内置协议 | [RPC 命令][rpccmd] |
| INT-13 | RPC 推理控制 | 查询当前模型支持的推理级别，设置或循环切换，避免客户端硬编码所有模型都支持同一档位。 | 三个 thinking 命令 | 内置协议 | [RPC 命令][rpccmd] |
| INT-14 | RPC 队列策略 | 动态设置 steering 和 follow-up 为整批或逐条投递，适配不同外部工作流。 | `set_steering_mode`、`set_follow_up_mode` | 内置协议 | [RPC 命令][rpccmd] |
| INT-15 | RPC 压缩与重试控制 | 手动压缩并读取摘要和用量，切换自动压缩／重试，取消正在等待的重试。 | `compact`、`set_auto_compaction`、`set_auto_retry`、`abort_retry` | 内置协议 | [RPC 命令][rpccmd] |
| INT-16 | RPC Shell 执行 | 主动运行命令并接收流式输出，可选择是否进入下次模型上下文；可单独取消运行中的命令。 | `bash`、`abort_bash` | 内置协议 | [RPC 命令][rpccmd] |
| INT-17 | RPC 会话管理 | 创建、切换、分叉、克隆和命名会话，并获取可分叉用户消息；相关操作可能被扩展取消。 | `new_session`、`switch_session`、`fork`、`clone` 等 | 内置协议 | [RPC 命令][rpccmd] |
| INT-18 | RPC 增量原始历史 | 按 entry ID 游标读取追加条目，包含压缩前历史和被离开的分支；返回 leafId 帮助判断当前分支是否变化。 | `get_entries` | 内置协议 | [RPC 命令][rpccmd] |
| INT-19 | RPC 会话树 | 返回条目及 children、标签和活动叶子，供客户端实现历史导航界面；查询树本身不执行导航。 | `get_tree` | 内置协议 | [RPC 命令][rpccmd] |
| INT-20 | RPC 统计、答案与导出 | 读取会话用量和上下文统计、最后助手文本，或导出 HTML 文件。 | `get_session_stats`、`get_last_assistant_text`、`export_html` | 内置协议 | [RPC 命令][rpccmd] |
| INT-21 | RPC 可扩展命令发现 | 枚举扩展、模板和技能命令及来源元数据，再通过 prompt 调用；不包含只由 TUI 处理的内置命令。 | `get_commands` | 内置协议 | [RPC 命令][rpccmd] |
| INT-22 | RPC 对话框转发 | 把扩展 select、confirm、input、editor 转为请求／响应，使非终端客户端也能与扩展交互。 | extension_ui_request／response | 内置协议 | [RPC UI][rpcui] |
| INT-23 | RPC 状态与编辑器通知 | 转发通知、状态文本、文本 widget、标题和编辑器设值；终端组件、主题和自定义编辑器不在支持范围内。 | RPC UI 单向通知 | 内置协议 | [RPC UI][rpcui] |
| INT-24 | JSONL 分帧、背压与关闭 | stdout 保留给协议，按 LF 拆记录、按 ID 关联异步响应；客户端持续读取以免阻塞，关闭 stdin 可有序退出。 | RPC 传输约定 | 内置协议 | [RPC][rpc] |

## 10 Agent 核心运行时

| 编号 | 功能 | 详细作用 | 入口／条件 | 状态 | 依据 |
| --- | --- | --- | --- | --- | --- |
| AG-01 | 有状态 Agent | 保存模型、推理级别、可执行工具、消息、流式状态与待完成调用，供应用构建自己的智能体。 | `Agent` | 库 | [Agent][agent] |
| AG-02 | 多轮工具循环 | 模型回答要求工具时先执行工具、加入结果，再调用模型，直到正常完成、错误、中止或调度控制结束。 | `prompt()`、`continue()` | 库 | [Agent][agent] |
| AG-03 | 上下文预处理 | 在模型格式转换前裁剪、注入或变换应用消息，便于构建检索或自定义历史管理。 | `transformContext()` | 库 | [Agent][agent] |
| AG-04 | 自定义消息类型 | 扩展应用消息并转换成模型可识别的 user、assistant、toolResult 等结构，或过滤仅 UI 使用的消息。 | `convertToLlm()` | 库 | [Agent][agent] |
| AG-05 | 文本与图片提示 | 支持文本、图片内容块或完整 AgentMessage 输入，让宿主以统一入口提供多模态任务。 | `Agent.prompt()` | 库 | [Agent][agent] |
| AG-06 | 并行工具批次 | 默认先顺序完成工具预检，再并行执行通过的调用；完成事件按完成顺序，历史结果仍按模型原始顺序保存。 | `toolExecution: parallel` | 库 | [Agent][agent] |
| AG-07 | 串行工具约束 | 全局或单工具可要求串行；批次中存在串行工具时整批串行，保护共享可变状态。 | `executionMode: sequential` | 库 | [Agent][agent] |
| AG-08 | 工具前后 Hook | 执行前阻止调用、执行后替换或标注结果，使权限、审计和结果规范化逻辑无需侵入工具。 | `beforeToolCall`、`afterToolCall` | 库 | [Agent][agent] |
| AG-09 | 工具进度与错误反馈 | 工具可流式报告部分结果，抛错会转为模型可见错误，便于模型修正参数或换方法。 | `onUpdate`、工具异常处理 | 库 | [Agent][agent] |
| AG-10 | 终止结果提示 | 当一批所有最终工具结果都要求 terminate 时，跳过后续模型请求；混合批次仍正常继续。 | `terminate: true` | 库 | [Agent][agent] |
| AG-11 | 请求准备屏障 | 每次模型请求前安装权威上下文，使持久化会话状态能成为实际请求来源。 | `prepareRequest()` | 库 | [Agent][agent] |
| AG-12 | 轮次收尾决策 | 在助手与工具结果完成后决定结束或再请求一次；错误和中止仍是硬退出。 | `finishTurn()` | 库 | [Agent][agent] |
| AG-13 | Steering／follow-up 队列 | 分开管理当前任务纠偏和后续任务，支持逐条／整批、窥视和清理队列。 | `steer()`、`followUp()` 等 | 库 | [Agent][agent] |
| AG-14 | 有序事件与异步订阅 | 发布 agent、turn、message、tool 全流程事件；Agent 的订阅按注册顺序等待，允许宿主把落盘操作作为屏障。 | `subscribe()` | 库 | [Agent][agent] |
| AG-15 | 取消与真正空闲 | 传播取消并等待整个运行结算，包括 agent_end 订阅完成，而不只等待最后一块文本。 | `abort()`、`waitForIdle()` | 库 | [Agent][agent] |
| AG-16 | 系统提示和工具变更记录 | 用系统消息记录提示与工具声明变化，请求前将可执行集合与会话声明对齐，支持准确重放。 | Agent transcript | 库 | [Agent][agent] |
| AG-17 | 动态认证与会话亲和 | 宿主提供动态凭据解析、sessionId 和推理预算，将认证刷新及提供商缓存接入循环。 | Agent 选项 | 库 | [Agent][agent] |
| AG-18 | 底层无类循环 | 直接使用异步事件流驱动循环，便于定制宿主；底层流不会像 Agent 类那样等待消费者处理事件。 | `agentLoop()`、`agentLoopContinue()` | 库 | [Agent][agent] |
| AG-19 | 浏览器后端代理 | 浏览器侧把流请求交给后端代理，让业务服务管理模型认证与访问。 | `streamProxy()` | 库 | [Agent][agent] |
| AG-20 | 工具执行耗时事件 | AgentToolCallOutcome、工具结果消息和 tool_execution_end 附带 execute 的单调时钟耗时，不包含 Hook；未实际执行的调用不产生该字段。 | `durationMs` | 库 | [Agent 更新记录][agentlog] |

## 11 AI 统一模型接口

| 编号 | 功能 | 详细作用 | 入口／条件 | 状态 | 依据 |
| --- | --- | --- | --- | --- | --- |
| AI-01 | 提供商集合 | 用一个 Models 实例管理多个提供商，把认证、模型目录和协议实现组合起来，按模型所属提供商分发调用。 | `createModels()`、`setProvider()` | 库 | [AI][ai] |
| AI-02 | 统一流式／完整回答 | 使用相同 Context 调用各提供商，既可消费文本／推理／工具增量，也可等待完整 AssistantMessage。 | `stream()`、`complete()` | 库 | [AI][ai] |
| AI-03 | 简化推理接口 | 用统一 reasoning 级别调用不同协议，降低宿主对提供商特定推理参数的依赖。 | `streamSimple()`、`completeSimple()` | 库 | [AI][ai] |
| AI-04 | 提供商专属参数 | 需要细控时按 API 类型传递推理预算、采样、缓存和协议参数，保留类型检查。 | `hasApi()`、ApiOptionsMap | 库 | [AI][ai] |
| AI-05 | 标准内容块与消息 | 统一用户、助手、工具结果、文本、图片、推理和工具调用结构，便于跨模型和宿主共享数据。 | Context、Message、Content 类型 | 库 | [AI][ai] |
| AI-06 | 模型目录查询 | 查询全部／单提供商模型、指定 ID、能力、窗口与成本；聊天、图像和分类按类型分别读取。 | `getModels()`、`getModelsOfType()` 等 | 库 | [AI][ai] |
| AI-07 | 静态类型化目录 | 不创建运行时也能读取随包目录，并获得提供商和模型 ID 的类型提示。 | `getBuiltin*()` | 库 | [AI][ai] |
| AI-08 | 动态目录与离线恢复 | 提供商可从服务端更新模型；目录存储允许缓存恢复、强制刷新、指定提供商及取消，读取始终返回最新已知值。 | `refresh()`、ModelsStore | 库 | [AI][ai] |
| AI-09 | 认证解析与可用性检查 | 根据提供商规则解析保存凭据、OAuth、环境或云认证，可在不请求模型时检查认证。 | `getAuth()`、`checkAuth()`、`getAvailable()` | 库 | [AI][ai] |
| AI-10 | 可注入凭据存储 | 默认内存存储，可注入持久存储；序列化 read-modify-write 用于避免并发刷新同一令牌。 | CredentialStore | 库 | [AI][ai] |
| AI-11 | 通用登录交互 | 提供商通过 prompt／notify 驱动密钥输入、选择、授权 URL、设备码或手动回调，宿主决定如何展示。 | AuthInteraction、`login()`／`logout()` | 库 | [AI][ai] |
| AI-12 | 请求头最终变换 | 在认证头、模型头和调用方头合并后统一变换，便于加入请求 ID、网关信息或移除指定头。 | `transformHeaders` | 库 | [AI][ai] |
| AI-13 | 请求级环境覆盖 | 在同一进程针对不同请求覆盖 provider 环境、云账号、代理等配置，减少进程级环境耦合。 | 请求 `env` | 库 | [AI][ai] |
| AI-14 | 工具参数 schema | 使用 TypeBox 声明参数并在执行前验证／转换，使模型生成的参数符合工具契约。 | `Type`、`validateToolCall()` | 库 | [AI][ai] |
| AI-15 | 严格结构约束 | 支持提供商端 JSON Schema 约束；prefer 允许退化，require 在不支持时失败。 | `constrainedSampling` | 库／模型相关 | [AI][ai] |
| AI-16 | 语法约束工具 | 对支持的 OpenAI 工具格式使用 Lark／regex 限制原始文本输入，可用于补丁或脚本语法。 | grammar variants | 库／模型相关 | [AI][ai] |
| AI-17 | 工具参数增量解析 | 在参数尚未流完时解析部分 JSON，便于 UI 提前显示路径和内容进度；完整执行仍需最终校验。 | `toolcall_delta` | 库 | [AI][ai] |
| AI-18 | 完整流事件规范 | 区分 start、块开始、delta、块结束、done 和 error，以 contentIndex 处理交错内容块。 | AssistantMessageEvent | 库 | [AI][ai] |
| AI-19 | 紧凑可持久化消息帧 | 将流事件编码成增量帧，并通过纯 reducer 重建部分消息，避免每个 token 都复制整个累积响应。 | AssistantMessageFrameEncoder | 库 | [AI][ai] |
| AI-20 | 视觉输入 | 将用户或工具结果中的图片交给支持视觉的聊天模型；模型元数据表示是否具备图片输入能力。 | ImageContent | 库／模型相关 | [AI][ai] |
| AI-21 | 图像生成接口 | 用图像模型生成图片或处理参考图，返回图片及可能的文本；当前文档列出的内置图像提供商为 OpenRouter。 | `generateImages()` | 库／可选 | [AI][ai] |
| AI-22 | 结构化及视觉分类接口 | 输入 JSON 状态、多项 choice／bool／score 问题及可选 images，获取概率、置信度或期望分值；图像能力由模型 input 和 API 共同限定，不支持时返回错误结果。 | `classify()`、`ClassifierContext.images` | 库／可选 | [AI][ai] |
| AI-23 | Token、缓存和分档成本统计 | 统一输入、输出、缓存读写及费用；按模型目录的提示长度价格档计费，修正长提示成本低估。未报告数据不能视为实测零值；OpenRouter 时段价格尚未建模。 | Usage、模型 cost tiers | 库 | [AI][ai]、[AI 更新记录][ailog] |
| AI-24 | 停止原因与错误归一化 | 区分正常停止、长度限制、工具使用、错误和取消，失败结果可携带已收到的内容和用量。 | stopReason、error 事件 | 库 | [AI][ai] |
| AI-25 | 请求取消与续接 | AbortSignal 中断请求，保留部分响应供后续上下文使用；不会把“取消”误当成正常完成。 | `signal` | 库 | [AI][ai] |
| AI-26 | 提供商请求／事件调试 | 观察实际请求负载、响应及标准化前已解析事件，帮助分析网关兼容性和字段差异。 | `onPayload`、`onResponse`、`onProviderStreamEvent` | 库 | [AI][ai] |
| AI-27 | 自定义或混合协议提供商 | 组合模型、认证和 chat／image／classifier 实现；同一提供商可按模型 API 分派不同协议。 | `createProvider()` | 库 | [AI][ai] |
| AI-28 | 兼容端点适配 | 对 role、token 字段、推理格式、会话亲和、严格工具等已验证差异设置兼容标志。 | `compat`、`thinkingLevelMap` | 库 | [AI][ai] |
| AI-29 | 跨提供商历史转接 | 保留对话与工具记录，转换不能跨协议直接使用的推理等内容，使同一任务可切换提供商继续。 | 消息规范化 | 库 | [AI][ai] |
| AI-30 | 系统消息增量状态 | 首条系统消息提供提示和工具，后续系统消息追加／替换命名区块及工具；协议适配器按能力处理变化。 | `normalizeContext()`、系统消息工具函数 | 库 | [AI][ai] |
| AI-31 | JSON 上下文序列化 | 消息和模型定义为可序列化数据，应用可自行存入数据库、文件或其他存储再恢复。 | Context、Model | 库 | [AI][ai] |
| AI-32 | Faux 测试提供商 | 使用预设响应、thinking、工具调用、流速和模拟用量构建确定性测试，无需真实模型凭据。 | `fauxProvider()` | 库／测试 | [AI][ai] |
| AI-33 | 浏览器与按需打包 | 可只导入所需提供商和轻量 models 入口，避免携带全部 SDK；浏览器不支持 Bedrock 调用和 Node OAuth 登录。 | 子路径导出、lazy API | 库 | [AI][ai] |
| AI-34 | 旧接口迁移入口 | compat 子路径暂存旧全局模型接口，供已有应用迁移；新接口以 Models 实例和 provider 工厂为主。 | `@earendil-works/pi-ai/compat` | 兼容入口 | [AI][ai] |
| AI-35 | 统一响应耗时 | AssistantMessageEventStream 从请求开始到最终消息记录 durationMs，代理流也使用相同流类型；后续获取的 deferred 结果不补计时，自定义流函数须返回该具体流类型。 | `AssistantMessage.durationMs` | 库 | [AI 更新记录][ailog] |
| AI-36 | Decisions 协议适配 | 把 JSON 状态、可选图片及 choice／score／bool 问题映射到 OpenAI Decisions；bool 转 predicate，拒答使整次结果失败，按输入 token 和目录价格统计费用。 | `openai-decisions`、`gpt-6-luna` | 库／API key | [AI][ai] |
| AI-37 | 宿主登录名称定制 | 宿主可替换 ChatGPT 登录的 agent name 提示及 Codex 浏览器 originator，供嵌入式产品展示自身身份。 | `LoginOptions.agentName` | 库 | [AI 更新记录][ailog] |
| AI-38 | 按密钥个性化 OpenRouter 目录 | 独立函数用 /models/user 缩小聊天目录并覆盖该 key 的上下文、输出与价格；与通用静态模型目录分离，供非 CLI 宿主复用。 | personalizeOpenRouterCatalog | 库 | [AI 更新记录][ailog] |
| AI-39 | 动态目录跟随配置端点 | refresh 上下文传入注册提供商的最终 baseUrl，包括 wrappers 对 models.json 的覆盖，让动态目录使用同一地域／代理端点。 | RefreshModelsContext.baseUrl | 库 | [AI 更新记录][ailog] |

## 12 AI 提供商接入清单

| 编号 | 提供商／功能 | 详细作用 | 接入标识／条件 | 状态 | 依据 |
| --- | --- | --- | --- | --- | --- |
| PROV-01 | OpenAI | 接入聊天／工具与 ChatGPT 登录路径，并支持 Decisions 分类 API 的 gpt-6-luna；分类需 API key，使用 ChatGPT OAuth 时该分类模型不列为可用。 | `openai`；分类 API `openai-decisions` | 可选 | [AI][ai]、[注册表][allproviders] |
| PROV-02 | OpenAI Codex 旧接入 | 保留旧 Codex Responses／订阅认证接入，文档标为 legacy，区别于 OpenAI provider 的新登录路径。 | `openai-codex` | 可选／legacy | [AI][ai] |
| PROV-03 | Anthropic | 接入 Claude Messages、工具、推理与认证；当前新增 Haiku 5.5，含长提示分档定价、adaptive thinking 的 xhigh／max、逐消息 effort 及会话中系统和工具变化。 | `anthropic`、`claude-haiku-5-5` | 可选 | [AI][ai]、[AI 更新记录][ailog] |
| PROV-04 | Google Gemini | 接入 Google Generative AI 的聊天、图像输入与函数调用等模型能力。 | `google` | 可选 | [AI][ai] |
| PROV-05 | Google Vertex AI | 在 Google Cloud 环境使用 Gemini，通过 API key 或 ADC 等方式解析身份和区域。 | `google-vertex` | 可选 | [AI][ai] |
| PROV-06 | Azure OpenAI／Foundry | provider 已更名为 azure，同时支持 OpenAI Responses 和 Foundry Chat Completions，内置 DeepSeek V4 Pro；部署映射适用于两种 API，原 AZURE_OPENAI 环境变量保持不变。 | `azure`；`azure-openai-responses` 仅保留为 API 标识 | 可选 | [提供商配置][providers]、[AI 更新记录][ailog] |
| PROV-07 | Amazon Bedrock | 通过 AWS Converse Stream 接入模型并复用 AWS 凭据链；Node 环境调用，不是浏览器后端。 | `amazon-bedrock` | 可选 | [AI][ai] |
| PROV-08 | Radius | 接入 Pi 网关与 API key／OAuth；获取或缓存的组织模型目录替换随包默认目录，避免继续显示组织管理员已禁用的模型。 | `radius` | 可选 | [AI][ai]、[AI 更新记录][ailog] |
| PROV-09 | OpenRouter | 统一调用聊天、图像和分类模型；有 key 时聊天目录按该 key 的 guardrails、区域与权限缩小并覆盖窗口、输出上限和价格，图像及分类目录不筛选。 | `openrouter`、`/models/user` | 可选 | [提供商配置][providers] |
| PROV-10 | Vercel AI Gateway | 经 Vercel 网关接入模型，并提供目录中对应的分类模型能力。 | `vercel-ai-gateway` | 可选 | [AI][ai] |
| PROV-11 | GitHub Copilot | 使用 Copilot OAuth 或相应环境令牌访问账户可用模型，按模型选择底层 API。 | `github-copilot` | 可选 | [AI][ai] |
| PROV-12 | Cloudflare AI Gateway | 根据账号和网关配置解析端点，让请求通过 Cloudflare AI Gateway。 | `cloudflare-ai-gateway` | 可选 | [AI][ai] |
| PROV-13 | Cloudflare Workers AI | 使用账号下的 Workers AI 模型；目录还包括 Jev／Clef 等分类能力。 | `cloudflare-workers-ai` | 可选 | [AI][ai] |
| PROV-14 | TypeSafe | 接入 System One 分类接口，针对结构化状态输出判断概率，而非普通聊天。 | `typesafe` | 可选 | [AI][ai] |
| PROV-15 | DeepSeek | 为 DeepSeek 模型提供认证、目录和兼容推理／工具消息转换。 | `deepseek` | 可选 | [AI][ai] |
| PROV-16 | Ant Ling | 接入蚂蚁 Ling 模型，并使用相应 API key 和推理格式。 | `ant-ling` | 可选 | [AI][ai] |
| PROV-17 | NVIDIA NIM | 接入 NVIDIA 托管推理端点中的目录模型，用统一 API 处理其聊天与工具交互。 | `nvidia` | 可选 | [AI][ai] |
| PROV-18 | Mistral | 接入 Mistral Conversations 协议及模型能力。 | `mistral` | 可选 | [AI][ai] |
| PROV-19 | xAI | 将 Grok 等目录模型接入统一模型与推理控制。 | `xai` | 可选 | [AI][ai] |
| PROV-20 | Groq | 接入 Groq 托管推理服务，复用统一工具、消息与流式消费方式。 | `groq` | 可选 | [AI][ai] |
| PROV-21 | Cerebras | 接入 Cerebras 推理服务及其 OpenAI 兼容差异处理。 | `cerebras` | 可选 | [AI][ai] |
| PROV-22 | Together AI | 使用 Together 的模型目录与 API key，通过兼容接口统一调用。 | `together` | 可选 | [AI][ai] |
| PROV-23 | Baseten | 接入 Baseten 模型端点及其思考／chat template 参数兼容配置。 | `baseten` | 可选 | [AI][ai] |
| PROV-24 | Fireworks | 在同一提供商下支持 OpenAI 与 Anthropic 兼容模型 API。 | `fireworks` | 可选 | [AI][ai] |
| PROV-25 | Hugging Face | 使用 HF_TOKEN 接入仓库目录中支持的 Hugging Face 推理模型。 | `huggingface` | 可选 | [AI][ai] |
| PROV-26 | Meta | 接入 Meta Model API，使用 Responses 兼容协议。 | `meta` | 可选 | [AI][ai] |
| PROV-27 | OpenCode Zen | 接入 Zen 目录和凭据，按模型分派协议；也包含文档列出的分类模型。 | `opencode` | 可选 | [AI][ai] |
| PROV-28 | OpenCode Go | 以独立 provider 和目录接入 OpenCode Go，避免与 Zen 的模型集合混淆。 | `opencode-go` | 可选 | [AI][ai] |
| PROV-29 | Moonshot 国际／中国 | 分开接入两个区域端点，统一消息调用但保留独立 provider 身份。 | `moonshotai`、`moonshotai-cn` | 可选 | [AI][ai] |
| PROV-30 | Kimi For Coding | 使用 Kimi 编码订阅端点的 Anthropic 兼容接口，与普通 Moonshot 接入区分。 | `kimi-coding` | 可选 | [AI][ai] |
| PROV-31 | MiniMax 国际／中国 | 提供区域化模型与认证入口，用户选择匹配账号的服务。 | `minimax`、`minimax-cn` | 可选 | [AI][ai] |
| PROV-32 | ZAI Coding 国际／中国 | 接入不同区域 Coding Plan 的模型和凭据配置。 | `zai`、`zai-coding-cn` | 可选 | [AI][ai] |
| PROV-33 | Qwen 国际目录 | 接入原有国际 Token Plan 模型集合。 | `qwen-token-plan` | 可选 | [AI][ai] |
| PROV-34 | Qwen Individual | 国际端点上提供 Individual 对应的较窄模型目录，凭据仍以该 provider 身份存储。 | `qwen-token-plan-individual` | 可选 | [AI][ai] |
| PROV-35 | Qwen 中国 | 为中国 Token Plan 提供独立端点和认证变量。 | `qwen-token-plan-cn` | 可选 | [AI][ai] |
| PROV-36 | Xiaomi MiMo API 计费 | 接入按 API 计费的 MiMo 服务，与区域 Token Plan 分开。 | `xiaomi` | 可选 | [AI][ai] |
| PROV-37 | Xiaomi 区域 Token Plan | 分别配置中国、阿姆斯特丹、新加坡服务，避免不同区域凭据和端点混用。 | `xiaomi-token-plan-cn/ams/sgp` 三个 provider | 可选 | [AI][ai]、[注册表][allproviders] |
| PROV-38 | llama.cpp 本地服务 | CLI 内置扩展动态提供本地聊天和分类模型，可管理模型生命周期。 | `llama.cpp` 扩展 | 可选 | [llama.cpp][llama] |
| PROV-39 | 其他兼容端点 | 自定义 Ollama、LM Studio、vLLM、SGLang 或企业代理，无需每种部署都新增一个内置 provider。 | `models.json`／`createProvider()` | 可选 | [模型][models] |

## 13 TUI 终端界面库

| 编号 | 功能 | 详细作用 | 入口／条件 | 状态 | 依据 |
| --- | --- | --- | --- | --- | --- |
| TUI-01 | 可交换渲染器 | 同一 TUI 接口支持主屏和备用屏实现，业务组件可在终端原生历史或应用视口之间复用。 | TuiMainScreen、TuiAltScreen | 库 | [TUI][tui] |
| TUI-02 | 差异渲染与同步输出 | 主屏按变化行、备用屏按变化视口行更新，并使用同步输出包围刷新，减少闪烁与无效输出。 | requestRender 与渲染循环 | 库 | [TUI][tui] |
| TUI-03 | 组件生命周期 | 用 render、可选键鼠处理和 invalidate 构建组件，组合到父容器并管理焦点。 | Component、TUI | 库 | [TUI][tui] |
| TUI-04 | 基础容器与背景盒 | Container 组织子组件，Box 增加背景及内边距，Spacer 提供垂直间距。 | Container、Box、Spacer | 库 | [TUI][tui] |
| TUI-05 | 横向／纵向约束布局 | 分配固定或可伸缩区域，支持最小／最大尺寸及响应式可见性，用于固定状态栏和多面板。 | VStack、HStack；备用屏 | 库 | [TUI][tui] |
| TUI-06 | 嵌套独立滚动 | 每个 ScrollView 管理自身滚动、末端跟随和溢出滚动链，鼠标所在区域决定滚动目标。 | ScrollView | 库 | [TUI][tui] |
| TUI-07 | 搜索、消息定位与滚动条 | 视口支持文本搜索、匹配高亮、OSC 133 标记跳转、滚动条拖动和回到底部按钮。 | TuiAltScreen | 库 | [TUI][tui] |
| TUI-08 | 覆盖层 | 在已有内容上显示对话框、菜单或临时组件，支持锚点、百分比、绝对位置、边距及堆叠。 | `showOverlay()` | 库 | [TUI][tui] |
| TUI-09 | 覆盖层焦点控制 | 临时隐藏、恢复、置前、释放或转移焦点，支持不捕获焦点的悬浮内容。 | OverlayHandle | 库 | [TUI][tui] |
| TUI-10 | 归一化鼠标事件 | 处理点击、按压、拖动、移动、滚轮及修饰键，按组件几何位置命中并支持拖动捕获。 | handleMouse、MouseRegion | 库 | [TUI][tui] |
| TUI-11 | 文本选择与超链接 | 备用屏支持拖选、边缘自动滚动扩选、OSC 52 复制和 OSC 8 链接点击。 | TuiAltScreen | 库 | [TUI][tui] |
| TUI-12 | 单行／多行文本组件 | 自动换行或按宽度截断，支持主题和内边距，适合消息、标题及状态文本。 | Text、TruncatedText | 库 | [TUI][tui] |
| TUI-13 | 单行输入框 | 提供光标、横向滚动和基本编辑，备用屏允许点击定位光标。 | Input | 库 | [TUI][tui] |
| TUI-14 | 多行编辑器 | 支持软换行、补全、粘贴、滚动、点击定位和输入事件，构成 CLI 提示编辑区。 | Editor | 库 | [TUI][tui] |
| TUI-15 | 大段粘贴处理 | 支持 bracketed paste，并将大量粘贴内容以标记方式呈现，避免编辑区被长文本撑满。 | Editor | 库 | [TUI][tui] |
| TUI-16 | 命令与文件补全 | 组合斜杠命令、路径和 @ 附件候选，支持相对路径与用户目录。 | CombinedAutocompleteProvider | 库 | [TUI][tui] |
| TUI-17 | Markdown 与语法高亮 | 显示标题、列表、引用、链接、代码等，支持自定义高亮和渲染缓存；HTML 标签显示为文本。 | Markdown | 库 | [TUI][tui] |
| TUI-18 | 加载与可取消进度组件 | 显示运行指示器，可响应取消并暴露 AbortSignal 供异步任务使用。 | Loader、CancellableLoader | 库 | [TUI][tui] |
| TUI-19 | 列表与设置控件 | 候选筛选、键鼠选择、分页，以及设置值轮换和子菜单，适合模型和偏好选择器。 | SelectList、SettingsList | 库 | [TUI][tui] |
| TUI-20 | 终端图片渲染 | 支持 Kitty／iTerm2 图片协议及 PNG、JPEG、GIF、WebP；不支持时用占位文本，备用屏 iTerm2 图片有降级限制。 | Image | 库 | [TUI][tui] |
| TUI-21 | 输入法与硬件光标切换 | Focusable 和 CURSOR_MARKER 定位输入法候选窗口；renderFakeCursor 标记绘制光标，开启 showHardwareCursor 时移除紧随定位标记的绘制光标，只显示终端光标。 | Focusable、CURSOR_MARKER、`renderFakeCursor()` | 库 | [TUI][tui] |
| TUI-22 | 键盘协议与组合键识别 | 解析普通按键、修饰键及 Kitty 键盘协议，提供统一匹配函数和 Key 辅助对象。 | `matchesKey()`、Key | 库 | [TUI][tui] |
| TUI-23 | 色彩转换与混合 | 支持 ANSI、sRGB、OKLCH、OKHSL，并根据终端输出真彩或 256 色，供主题和自定义组件使用。 | Color、parseColor、mixColors | 库 | [TUI][tui] |
| TUI-24 | ANSI 安全文本布局 | 忽略控制码计算可见宽度，在截断和换行时保留颜色与链接边界，防止越界绘制。 | visibleWidth、truncateToWidth、wrapTextWithAnsi | 库 | [TUI][tui] |
| TUI-25 | 终端抽象与测试终端 | ProcessTerminal 对接真实 stdin/stdout，VirtualTerminal 供测试；可记录原始 ANSI 输出排查渲染。 | Terminal、`PI_TUI_WRITE_LOG` | 库／测试 | [TUI][tui] |
| TUI-26 | 程序状态协议接口 | Terminal 新增 setProgramStatus，formatProgramStatus 编码 OSC 7501 状态；ProcessTerminal 启动时探测支持，自定义终端即使不支持也需提供可空操作的实现。 | `Terminal.setProgramStatus()`、`formatProgramStatus()` | 库 | [TUI 更新记录][tuilog] |
| TUI-27 | 动态内边距与选择清理 | Box／Text 可运行中调整横向内边距；备用屏可显式清除文本选择及多次点击状态，便于宿主替换 transcript 时避免旧高亮残留。 | `setPaddingX()`、`TuiAltScreen.resetTextSelection()` | 库 | [TUI 更新记录][tuilog] |

## 14 Chord 类型化对象与跨宿主运行时

| 编号 | 功能 | 详细作用 | 入口／条件 | 状态 | 依据 |
| --- | --- | --- | --- | --- | --- |
| CHR-01 | 本地／远程类型契约 | 以 TypeBox runtime schema 描述对象输入、状态、方法及远程变体，推导 TypeScript 类型；local 可声明原生 opaque 成员，remote 只传受校验数据。 | local、remote、method、opaque | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-02 | 规范化对象身份 | 对象按 type、规范化 input、principalKey 定位；应用默认值、移除未知输入并省略等于默认值的字段，使相同地址共享 record。改变默认值语义需新类型名。 | canonical input、principalKey | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-03 | 契约版本兼容检查 | 同版本要求提供者覆盖消费者所需字段和方法；跨版本通过 accepts 适配，缺少适配或漏升版本的破坏性变更拒绝绑定。 | serve options.accepts、contract_mismatch | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-04 | 按需创建与稳定句柄 | get 返回句柄而非对象；相同地址并发访问共享激活，句柄成员保持稳定并分派到相应代码代次，重载保留对象身份。 | createHost、host.serve、ctx.get | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-05 | 异步资源与依赖激活 | 同步工厂只声明资源和依赖，随后等待资源打开及依赖就绪；失败向依赖者传播，下次 get 可重试，无持有者的未完成激活会释放。 | self.get、self.resources、handle.ready | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-06 | 启动就绪屏障 | load／install 默认等待本批 eager 对象激活；awaitEager:false 先启动而不等待，host.ready 再等待当前 eager 集合，支持 worker 本地启动与父连接接纳分阶段完成。 | host.load／install／ready | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-07 | 主体身份隔离 | 每个 principal key 获得自己的对象，连接由接受方赋身份，调用者不能自行伪造；宿主内部以 host 主体共享内部对象。 | principalKey、host.accept | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-08 | 远程能力变体 | 工厂按身份选择 viewer／participant 等已声明变体，只暴露对应方法和状态；业务方法仍须校验参数与资源归属。 | remote variants、handle.kind | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-09 | 身份撤销与对象失效 | 撤销匹配主体后强制释放相关对象、取消在途调用并更新或关闭连接；句柄进入 gone，重新 get 才能以新授权建立对象。 | host.invalidatePrincipal | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-10 | 句柄状态和延迟调用 | 可观察 loading、live、released、gone；loading 时方法等待就绪并尊重取消，变体缺失成员及释放后的调用明确报错。 | ready、onStatus、shape、release | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-11 | 有主引用生命周期 | 对象、调用、连接或宿主持有引用；最后引用释放后可 linger 再销毁，依次取消任务、移除监听、关闭资源和释放依赖，宿主内拒绝循环引用。 | self.get、ctx.get、eager、linger | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-12 | 命名单元状态与原子修改 | 状态以命名 cell 保存并跨重载保留；change 使用草稿，成功发布一次修订，抛错不生效；replace 可选择完整替换或结构差异。 | self.state、cell、change、replace | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-13 | 派生状态 | 同步 derivation 从多个状态源计算视图，依赖变化时更新，重载保留派生节点并替换计算函数。 | self.derive、derivation | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-14 | 订阅式远程状态复制 | 订阅后先取快照再收 Delta，重连或重载发 reset；最后订阅离开后清空远端缓存，避免新订阅读取旧值。 | state.subscribe、events、snap／ops／reset | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-15 | 资源修订与独占替换 | 资源 rev 或 deps 未变则重用；普通新资源在准备期打开，独占资源在切换屏障交换，失败时尝试恢复旧资源。 | resource({ rev, deps, exclusive, open, close }) | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-16 | 跨重载监听保持 | 同来源和相同 select 保留订阅，只替换回调，避免 Durable 单订阅源被重复打开；来源选择变化可改名重新声明。 | self.listen、listener | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-17 | 后台代码任务 | self.tasks 保存长驻任务声明，重载时取消旧任务并启动新代码；任务发起的 Chord 调用使用短 root，不把整个长任务锁在一代。 | self.tasks、ctx.signal | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-18 | 调用树与代次固定 | 短 root 携带 rootId 和 epoch，嵌套跨宿主调用使用同代代码，结束释放调用范围持有；过期或外来上下文会被拒绝。 | host.root、方法 ctx | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-19 | 注册表原子切换 | eager 对象贡献注册项，各 epoch 维护完整表；旧请求继续读旧表，重载原子替换，重复键按冲突策略报错。 | defineRegistry、self.register、host.registry | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-20 | 按宿主拆分插件 | 插件按 server／worker／browser 等宿主拆 facet，通过 defineFacet 注册对象工厂；加载代码为受信任的进程内代码。 | defineFacet、host.load、host.install | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-21 | 模块代际加载 | nodeLoader 对 facet 模块目录传播缓存破坏查询参数，使相对导入也获得新代码；模块不会被卸载，不提供插件安全隔离。 | @earendil-works/chord/node、nodeLoader | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-22 | 兼容代码热替换 | 按 load、prepare、必要时 gate、commit、retire 流程更新；准备期禁止状态写入并校验契约，兼容变化无需等待旧 root 完成即可提交。 | host.reload | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-23 | 状态升级与安全切换 | 状态 schema 或语义变化需提升 version 并 migrate；等待已进入对象的 root 离开，对尚未进入的旧 root 返回 upgrade_conflict，超时中止重载。 | state.version、state.migrate、gate | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-24 | 两代共存与退休 | 最多保留 current 和 previous epoch，旧 root 使用旧行为直到完成或被强制退休；无法匹配的代次返回 superseded，不偷偷替换代码执行。 | epoch、retire | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-25 | 多插件联合重载 | 同批准备相互依赖的新工厂和契约，使生产者与消费者可一起升级，失败保留原运行状态。 | host.reload([a, b]) | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-26 | 跨宿主重载协调 | 协调宿主对直接子宿主进行准备、投票和提交，报告各子宿主结果；落后 worker 在路由前对齐代次，浏览器通过 shape／reset 感知变化。 | reload options.remote、report.children | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-27 | 内存、IPC 和 WebSocket 链路 | 以 JSON 帧连接浏览器、Node 和多个宿主；提供内存测试链路、Node IPC 以及结构化 WebSocket 适配，不依赖旧 CBOR Pi 协议包。 | memoryLinkPair、ipcLink、webSocketLink、acceptWebSockets | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-28 | 按前缀路由与中继 | server 可按目标名前缀解析或启动 worker，路由前后检查 authorize，并把浏览器或其他 worker 的对象访问转发到目标。 | host.route、authorize、resolve | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-29 | 链路验证与失连处理 | 校验帧 schema、重复 ID 和控制帧来源，ping 检测失活；断链释放持有，在途调用报 unavailable，不保证请求是否执行，也不自动重放。 | link、connection、pingTimeout | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-30 | 子宿主进程管理 | Node manager 串行启动、停止和替换子进程，等待控制 ready，处理 fatal；根据 activeCalls、viewers、durableTasks 和 idleFor 执行 keepAlive 策略。 | createHostManager、forkDriver、childControl | 库／当前源码 | [进程管理源码][chordmanager]、[规范][chordspec] |
| CHR-31 | 跨进程所有权锁 | 子进程在打开存储前获取内核锁，Linux／Android 用抽象 socket，Windows 用命名管道，其他平台用探测式 socket 文件，限制同锁名多进程占用。 | processLock、childControl().lock() | 库／当前源码 | [进程管理源码][chordmanager]、[规范][chordspec] |
| CHR-32 | Durable 宿主组合 | 可把 Harness 作为 eager local 资源，注册表贡献 Durable 扩展；正在运行的 Durable 阶段保持自己的快照，下阶段再使用新扩展。 | Chord guide 的 Durable 集成模式 | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-33 | 独立事务 JSON Delta | 保留不依赖 host 的 track、结构差异和 immutable apply，支持字符串追加／前截断、数组 splice／排列、设置和删除。 | @earendil-works/chord/delta | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-34 | 准备与采用分离 | prepare 计算候选值和操作，adopt 才切换权威修订；适合先持久化后通知消费者，修改草稿会复制新赋值容器。 | track、prepare、adopt | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-35 | 独立可复制状态 | replicatedState 可自主管理值，也可挂到权威 revision source 按已提交帧发布；Durable 文档和视图继续复用，未随旧服务 runtime 删除。 | replicatedState、ReplicatedStateSource | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-36 | 有界完整值订阅 | 独立 replicatedState 的每订阅异步回调串行，最多保留 100 个待投递完整值，超限折叠为最新值；取消清空待处理但不取消正在执行回调。 | replicatedState().subscribe | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-37 | 显式取消与上下文值 | 保留 Context、AbortSignal 桥接及调用范围数据，辅助跨层传播取消；与对象方法 ctx 的 root／epoch 职责配合。 | @earendil-works/chord/context | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |
| CHR-38 | 类型化失败原因 | 用 ChordError 区分无权限、无效输入、未就绪、失效句柄、契约冲突、升级冲突、代次退休和不可达，供宿主决定重新获取或重试。 | ChordError、isChordError、reason | 库／当前源码 | [指南][chordguide]、[规范][chordspec]、[Chord][chord] |

## 15 Durable 持久化运行时

| 编号 | 功能 | 详细作用 | 入口／条件 | 状态 | 依据 |
| --- | --- | --- | --- | --- | --- |
| DUR-01 | 持久 Harness | 将会话、生成、工具任务和业务状态统一运行在存储之上，提交成功后才向观察者发布。 | `Harness.open()` | 实验／库 | [Durable][durable] |
| DUR-02 | 原子提交 | 同一事务内可追加条目、修改文档和创建任务，确保这些变化全部生效或全部不生效。 | `conversation.commit()` | 实验／库 | [Durable][durable] |
| DUR-03 | 不可变会话记录 | 用户消息、助手回答、工具结果、系统变更、重置和自定义条目构成不可变 transcript。 | Conversation、Entry | 实验／库 | [Durable][durable] |
| DUR-04 | 持久输入与等待 | 提交输入后返回 Submission，可查询并等待 answered／unanswered 等结算；取消等待不自动取消工作。 | `submit()`、`wait()` | 实验／库 | [Durable][durable] |
| DUR-05 | 输入幂等去重 | 同 requestId 的重试返回已有 submission，适合进程重启后避免再次提交同一任务。 | submission `requestId` | 实验／库 | [Durable][durable] |
| DUR-06 | 重启恢复 | 重开存储并启动 scheduler 后，从已提交任务状态继续；未完成工作不会因关闭进程自动消失。 | `resume()` | 实验／库 | [Durable][durable] |
| DUR-07 | 持久任务状态机 | 任务每阶段保存 checkpoint，可暂停、等待其他任务，再由调度器继续执行。 | Task 定义与 registry | 实验／库 | [Durable][durable] |
| DUR-08 | 模型生成与工具子任务 | 每轮生成为 pi.generation，其工具调用是被拥有的 pi.tool 任务；父任务等待工具后继续回答。 | 内置生成／工具任务 | 实验／库 | [Durable][durable] |
| DUR-09 | 工具安全重放 | 执行意图先提交；崩溃后仅 replay:safe 工具自动重跑，其他调用向模型报告 interrupted 与已提交输出。 | 工具 replay 声明 | 实验／库 | [Durable][durable] |
| DUR-10 | 持久工具输出 | 工具可边执行边提交输出、details 和 usage，界面订阅已提交状态而不直接依赖进程内事件。 | `api.output()` 等 | 实验／库 | [Durable][durable] |
| DUR-11 | 基础编码与图片读取工具 | CodingTools 提供 read、write、edit、bash，通过 ExecutionEnv 访问文件和进程；read 已能返回符合尺寸及编码上限的 PNG／JPEG／GIF／WebP 图片块，超限转换另需处理器。 | `@earendil-works/pi-durable/tools` | 实验／库 | [Durable][durable] |
| DUR-12 | 执行环境抽象 | 按会话目录或容器构造环境，统一文件、进程操作，允许不同会话使用不同存储／沙箱后端。 | ExecutionEnv、NodeExecutionEnv | 实验／库 | [Durable][durable] |
| DUR-13 | 宿主文件和进程访问 | 环境支持二进制区间读取、目录分页及无 Shell 的 argv 执行，并区分 stdout/stderr 输出。 | 环境 reader、exec | 实验／库 | [Durable][durable] |
| DUR-14 | 按环境文件修改排队 | 以环境 ID 和路径协调 edit／write，避免同一底层文件被并行读改写覆盖。 | ExecutionEnv `id` | 实验／库 | [Durable][durable] |
| DUR-15 | 扩展注册表 | 具名扩展组合工具、提示区块、Hook、包装器和任务；会话保存名称而不是执行代码对象。 | Registry、defineExtension | 实验／库 | [Durable][durable] |
| DUR-16 | 扩展在线替换 | 安装同名扩展原位替换；运行中的调用保留旧代码，下一阶段或请求使用新定义。 | `registry.install/uninstall()` | 实验／库 | [Durable][durable] |
| DUR-17 | 工具覆写与装饰 | 后注册同名工具替换先前工具，wrapper 包装最终生效工具，可组合环境切换与耗时统计等功能。 | wraps、wrapTool | 实验／库 | [Durable][durable] |
| DUR-18 | 会话级 Agent 配置 | 每会话保存模型、推理、扩展、工具、指令和工作目录；未设置项跟随宿主，子会话和 fork 按规则继承。 | `configure()`、pi.agent | 实验／库 | [Durable][durable] |
| DUR-19 | 系统提示区块增量 | 按选中扩展渲染提示区块，把提示和工具变化写入位置化系统条目，以保留可重放状态和缓存前缀。 | `section()` | 实验／库 | [Durable][durable] |
| DUR-20 | 动态运行设置 | 宿主控制重试、超时、压缩、进度间隔和工具并发；getter 可使策略在运行中变化。 | Harness `settings` | 实验／库 | [Durable][durable] |
| DUR-21 | 结构化对话视图 | 一次读取活动记录与 pi.live、pi.inbox、pi.usage 等文档，供 TUI 或其他界面一致渲染。 | `viewState()` | 实验／库 | [Durable][durable] |
| DUR-22 | 精确提交观察 | 订阅值和该次提交的 Chord 操作，支持远程复制；慢观察者积压超过上限时替换成最新完整视图。 | `watch()` | 实验／库 | [Durable][durable] |
| DUR-23 | 晚加入与事件适配 | 新消费者先拿当前快照，再收提交派生的 Agent 风格事件；不会从头重放所有运行过程。 | `watchEvents()` | 实验／库 | [Durable][durable] |
| DUR-24 | 流输出提交节流 | 默认按一定间隔提交部分回答与工具输出，可权衡存储压力和崩溃时未提交输出窗口。 | `settings.progress` | 实验／库 | [Durable][durable] |
| DUR-25 | 忙碌输入与显示写入 | steer、follow-up、忙碌拒绝和输入撤回仍支持；只有 kind/data 的显示写入忙碌时也立即提交，只有排队 reset 可挡住它；带 model/head/edits 的写入仍等边界。 | whenBusy、pi.inbox、submit(write) | 实验／库 | [Durable][durable] |
| DUR-26 | 上下文重置与交接 | 从空上下文或 handoff 说明开始新上下文，旧记录仍留存；工具也可请求交接。 | `reset()`、`control.handoff` | 实验／库 | [Durable][durable] |
| DUR-27 | 手动与后台压缩 | 可并行生成摘要并在空闲或轮次边界安放，过期摘要按 stale 处理；支持提前后台压缩。 | `compact()`、`backgroundTokens` | 实验／库 | [Durable][durable] |
| DUR-28 | 溢出恢复与自定义压缩 | 模型拒绝过长上下文时压缩后重试一次；扩展可以阻止或提供自己的摘要。 | CompactionTask、beforeCompact | 实验／库 | [Durable][durable] |
| DUR-29 | 生成与工具 Hook | 在请求前、响应后、工具前后和模型让出时修改行为，可阻止工具、改参数、替换结果或继续任务。 | GenerationTask／ToolTask hooks | 实验／库 | [Durable][durable] |
| DUR-30 | 多会话与历史分叉 | 一个 Harness 管理多个独立会话，可从父会话某条目处分叉，保留当时 Agent 配置并生成新的 provider 身份。 | `createConversation()`、`fork()` | 实验／库 | [Durable][durable] |
| DUR-31 | 任务拥有的子会话 | 任务可以拥有子会话，父任务失败或取消时沿拥有关系终止子工作；为实现前台子智能体提供原语。 | ownership task | 实验／库 | [Durable][durable] |
| DUR-32 | 后台任务边界 | background 任务使其拥有的工作不阻塞父会话空闲，也不跟随普通父取消，适合后台研究与结果回传。 | `background: true` | 实验／库 | [Durable][durable] |
| DUR-33 | 子任务等待策略 | allSettled 等全部结束；failFast 遇到失败提前中止其他子任务，任务等待期间不持续占用执行代码。 | waiting 状态与 policy | 实验／库 | [Durable][durable] |
| DUR-34 | 结构化取消与收尾 | 自底向上中止被拥有工作；父结果已决定但子工作未结束时处于 completing，全部收尾才变成终态。 | abort、completing | 实验／库 | [Durable][durable] |
| DUR-35 | 实时任务图 | 显示活跃任务、拥有关系、等待集合、后台标记与拥有的会话，方便构建任务面板和排错。 | `taskGraph()`、`watchTaskGraph()` | 实验／库 | [Durable][durable] |
| DUR-36 | 自定义类型化文档 | 与 transcript 同事务保存业务 JSON，支持 latest／rewindable 历史及 initial／current／asOf 分叉策略。 | `defineDoc()`、snapshotAsOf | 实验／库 | [Durable][durable] |
| DUR-37 | 文档初始化与单独订阅 | 会话创建回调或 init 在创建事务中初始化文档；可仅订阅某份文档而非整个会话。 | conversationCreated、watchDoc | 实验／库 | [Durable][durable] |
| DUR-38 | 会话亲和与累计费用 | 持久保存每会话 provider session ID，并按模型和工具汇总用量；嵌套调用用量归到自己的工具，外层再次转报会重复计费。失败、中止和摘要请求也可计入。 | pi.provider、pi.usage | 实验／库 | [Durable][durable] |
| DUR-39 | 内存／SQLite／JSONL 存储 | 可选择临时内存、SQLite WAL 或追加式 JSONL，支持相应耐久参数；包本身要求单进程拥有存储，不提供跨进程锁。 | storage 子路径 | 实验／库 | [Durable][durable] |
| DUR-40 | 可移植存储与一致性测试 | 注入异步 SQLite 或文件系统适配到其他运行环境，并用公共 conformance 验证存储和执行环境契约。 | testing、portable storage | 实验／库 | [Durable][durable] |
| DUR-41 | PowerShell 工具工厂 | 用 argv 直接运行 pwsh 或 Windows PowerShell，配置 UTF-8 输出，复用 bash 的保留窗口、落盘和错误行为；需宿主注册，不改变 CodingTools 默认四工具集合。 | `createPowerShellTool()` | 实验／库 | [Durable 更新记录][durlog] |
| DUR-42 | 图片定向、转换与缩放 | 可选 Photon WASM 处理器解码图片，按 EXIF 转正、BMP 转 PNG，并缩放到模型限制；默认限制 2000×2000 和 4.5 MB base64。非视觉模型得到占位说明。 | `createCodingTools({ images })`、`/images` | 实验／库 | [Durable][durable] |
| DUR-43 | Node 图片后台处理 | /images/node 默认在 worker 准备图片，避免大图阻塞事件循环；空闲 30 秒释放线程及 WASM 内存。Cloudflare／通用加载器在调用线程处理，不保证相同隔离。 | `createNodePhotonImages({ worker, idleMs })` | 实验／库 | [Durable][durable] |
| DUR-44 | 持久嵌套工具调用 | executeTool 为每次嵌套调用创建由调用者拥有的 pi.tool 任务，执行校验、Hook、输出限制与重放策略；返回程序结果而不直接写入模型 transcript。 | `ToolExecutionApi.executeTool()` | 实验／库 | [Durable][durable] |
| DUR-45 | 嵌套调用键与恢复 | 调用键默认按顺序，也可显式指定；可重放调用者重启后重新连接既有子调用，避免重复创建。NestedCallDoc 暂存结果到调用者结算，任务记录保留小型回执。 | `executeTool(..., { key })`、NestedCallDoc | 实验／库 | [Durable][durable] |
| DUR-46 | 结构化工具输出分流 | output 给模型、structuredOutput 给调用程序、details 给 UI；schema 校验失败使嵌套调用报错，模型发起调用只丢弃无效结构化值并报告宿主。无 schema 时从有界输出推导程序结果。 | `structuredOutputSchema`、`structuredOutput`、`retainedOutput()` | 实验／库 | [Durable][durable] |
| DUR-47 | 工具调用者范围控制 | callers 限制工具可由模型、其他工具或两者调用；modelTools 只缩小模型可见集合，不移除允许的嵌套调用，不能越过总工具集合增加能力。 | `ToolRegistration.callers`、`pi.agent.modelTools`、`Agent.callable` | 实验／库 | [Durable][durable] |
| DUR-48 | 嵌套进度与父子关联 | pi.live.nestedTools 展示参数和完成摘要，事件带 taskId、parentTaskId、parentToolCallId；progress:false 隐藏运行输出，调用者结束前会取消未结束嵌套工作。 | 嵌套工具状态与事件 | 实验／库 | [Durable][durable] |
| DUR-49 | 重启时放弃临时任务 | abandonOnRestart 标记仅被内存等待的工作，在后续 Harness 调度前连同拥有的任务终止；非重放安全工具的嵌套和 createTask 子任务默认获得该标记。 | `TaskOptions.abandonOnRestart` | 实验／库 | [Durable][durable] |
| DUR-50 | 查询和取消直接拥有任务 | 读取任务当前直接拥有的活跃任务副本，或取消其中指定任务并等到终态，便于工具可靠清理跨尝试遗留的工作。 | `TaskRuntime.ownedTasks()`、`abortOwned()` | 实验／库 | [Durable 更新记录][durlog] |
| DUR-51 | 历史位置上下文读取 | 读取某个可见历史条目时的模型上下文，与从该处分叉的起始视图一致，无需为只读检查实际创建新会话。 | `Conversation.context(context, { at })` | 实验／库 | [Durable 更新记录][durlog] |
| DUR-52 | 双向游标分页 | 会话、记录、任务和 submission 扫描支持 ascending／descending；游标延续原顺序，不能混用反向参数。默认记录从新到旧，其余从旧到新。 | `ScanOrder`、`Conversation.entries()` | 实验／库 | [Durable 更新记录][durlog] |
| DUR-53 | 任务时间与尝试耗时 | 任务 startedAt／endedAt 保存首次运行和终态墙钟时间；工具 durationMs 为该次实际执行的单调时钟耗时，未执行及被中断／取消的调用不填，旧记录也可能缺失。 | TaskRecord、pi.tool-result | 实验／库 | [Durable 更新记录][durlog] |
| DUR-54 | 共享模型访问入口 | 工具及 Hook 使用 Harness 的模型目录、认证和请求变换执行自己的模型调用，避免重复建立不一致的模型客户端。 | `ToolExecutionApi.models`、`HookApi.models` | 实验／库 | [Durable 更新记录][durlog] |
| DUR-55 | Cloudflare SQLite 存储 | 在 SQLite-backed Durable Object 上以其存储事务提交会话，提供现成适配器，宿主无需自行实现 SQLite facade。 | `openDurableObjectSqliteStorage(ctx.storage)` | 实验／库 | [Durable][durable] |
| DUR-56 | 增量上下文与有界缓存 | 重复读取同一会话仅扫描和推导新条目；空闲上下文及无人观察的文档默认十分钟后可释放，设置为 0 可在空闲或使用后释放，再访问时从存储加载。 | `contextRetentionMs`、`documentRetentionMs` | 实验／库 | [Durable 更新记录][durlog] |
| DUR-57 | 存储故障关闭与可观察恢复 | 普通存储异常使整个 Harness 失败并关闭，后续调用和等待拒绝为 SessionFailed，观察流以 session_failed 结束；closed 告知完成原因。无自动重试，宿主可重开并用 requestId 恢复。 | `SessionFailed`、`harness.closed` | 实验／库 | [Durable][durable] |
| DUR-58 | 请求错误与监听器隔离 | StorageRequestError 只让无效请求失败；用户监听器异常经 onReport 报告而不阻断其他监听器，回调事务失败回滚。调度基础提交或 registry snapshot 故障仍可使整个 Harness 失败。 | StorageRequestError、onReport | 实验／库 | [Durable][durable]、[Durable 更新记录][durlog] |
| DUR-59 | 文件变更监听与按行扫描 | ExecutionEnv 可监听文件／目录、递归与排除路径，报告 overflow/error；Node 在 Windows 和网络／FUSE 文件系统轮询。scanLines 在环境内扫描行跨度，read 避免整文件载入。 | `FileSystem.watch()`、`BinaryReader.scanLines()` | 实验／库 | [Durable 更新记录][durlog] |
| DUR-60 | 远程输出窗口与省略计数 | Shell 可在源端省略保留尾部以外的输出并报告 skipped；工具传递 outputWindow，使远程后端减少无用传输且保持截断统计。 | `ShellExecOptions.window`、`ToolExecutionApi.outputWindow` | 实验／库 | [Durable 更新记录][durlog] |
| DUR-61 | 活跃任务索引与规模控制 | 调度只遍历相关拥有关系和候选集合，结束任务仅在仍有后代活跃时保留索引，减少长驻 Harness 的历史任务内存与全表扫描开销。 | scheduler ownership indexes | 实验／库 | [Durable 更新记录][durlog] |
| DUR-62 | 可恢复 Codemode 工具 | 独立扩展将脚本工具接入 Harness，脚本调用均为持久嵌套工具；崩溃后可继续脚本，不再运行已经完成并记入日志的调用。 | @earendil-works/pi-durable/codemode、createCodemodeExtension | 实验／库 | [Durable][durable] |
| DUR-63 | 脚本结果日志与分歧检查 | 每次交付 VM 前先持久化结果，重启按顺序重放并凭 key 重新附着调用；脚本分歧、沙箱指纹／模块版本改变或已过 deadline 会使调用失败，在途子调用遵守自己的 replay 策略。 | 确定性 start + Codemode journal | 实验／库 | [Durable][durable] |
| DUR-64 | 持久脚本发现与命名空间 | codemode 提示区块按预算展示 TypeScript 工具声明，name prefix 划分 namespaces，脚本用 searchTools／describeTool／describeNamespace 查其他工具。 | createCodemodeExtension options | 实验／库 | [Durable][durable] |
| DUR-65 | 持久脚本模型调用与输出 | models 目录、分类和图像生成由内部嵌套工具处理，模型调用最多四路；支持图像保存、分块日志和超长结果临时文件，可传 RemoteCodemodeSandbox 运行于 Cloudflare。 | models.*、models:false、max_output_tokens | 实验／库 | [Durable][durable]、[更新记录][durlog] |
| DUR-66 | 脚本分支状态 | store/load 按 conversation 持久保存 JSON，fork 读取分叉条目时的值；关闭沙箱是宿主停机而非脚本最终结果，下进程可恢复。 | Codemode store/load | 实验／库 | [Durable][durable] |
| DUR-67 | 延迟声明工具与搜索加载 | deferred 工具暂不向模型声明但仍可由工具调用；tool_search 用 BM25 搜索并以 control.addTools 加入 modelTools，加载顺序追加，分支和压缩后保留。 | createToolSearchExtension、ToolRegistration.deferred | 实验／库 | [Durable][durable]、[更新记录][durlog] |
| DUR-68 | 自定义输入记录 | 输入可携带 entry.kind/data，以业务类型存入 transcript，同时把 content 作为用户消息发给模型；仍支持启动、纠偏、排队及结算，类型不得使用 pi. 前缀。 | InputEntry、submit(input) | 实验／库 | [Durable][durable] |
| DUR-69 | 压缩失败状态与阻塞策略 | pi.live.compactionFailure 保留最近失败直到新摘要成功；compaction_end 携带 error。阻塞阈值压缩失败会使生成以 model_error 结束，不再继续发送超限请求；无内容或 Hook 拒绝可继续。 | compactionFailure、compaction_end | 实验／库 | [Durable][durable] |

## 16 Telemetry 遥测

| 编号 | 功能 | 详细作用 | 入口／条件 | 状态 | 依据 |
| --- | --- | --- | --- | --- | --- |
| TEL-01 | 显式调用跟踪 | 通过上下文创建父子 span，记录一次操作及子操作关系，不依赖全局 current-span 状态。 | TelemetryContext | 库 | [Telemetry][telemetry] |
| TEL-02 | 回调管理生命周期 | span 在回调返回／拒绝时结算，自动记录成功或错误，避免调用者忘记 end。 | `startSpan()` | 库 | [Telemetry][telemetry] |
| TEL-03 | 属性、事件与状态 | 附加操作参数、过程中事件和最终结果；属性合并、状态后写覆盖，并在结算后保持惰性。 | TelemetrySpan | 库 | [Telemetry][telemetry] |
| TEL-04 | 无操作遥测 | 关闭记录时仍以同样接口执行原业务回调，不收集名称或数据。 | NOOP_TELEMETRY_CONTEXT | 库 | [Telemetry][telemetry] |
| TEL-05 | 内存参考适配器 | 在进程内记录确定性的 span ID、父子关系、事件及结束顺序，适合测试和本地诊断；不记录时间戳。 | InMemoryTelemetryContext | 库 | [Telemetry][telemetry] |
| TEL-06 | 自定义后端适配 | 将通用接口连接 OpenTelemetry、Sentry 或日志系统，采样、导出和 flush 由适配器负责，包内不自带 exporter。 | adapter contract | 库 | [Telemetry][telemetry] |
| TEL-07 | 类型化诊断 schema | 声明 span、属性、事件及允许值，在编译期发现未知字段和缺失必填字段。 | defineTelemetrySchema、createTypedSpanStarter | 库 | [Telemetry][telemetry] |
| TEL-08 | 起始与完成属性 | 区分开始时必需信息和完成时可选补充，允许正常失败或取消情况下部分结果不可用。 | startAttributes／endAttributes | 库 | [Telemetry][telemetry] |
| TEL-09 | schema 元数据 | 标注描述、示例、敏感性、基数和父子规则，为文档、测试与适配器治理提供依据；不执行运行时权限检查。 | schema metadata | 库 | [Telemetry][telemetry] |
| TEL-10 | 适配器一致性测试 | 验证单次调用、返回值保持、异步生命周期、父子关系及后端失败不影响业务等契约。 | testing 子路径 | 库／测试 | [Telemetry][telemetry] |
| TEL-11 | Pi 领域诊断词汇 | agent 包提供 AI 请求与 harness 的 schema 和 typed helpers，ai 包负责传递显式上下文。 | AGENT_TELEMETRY_SCHEMAS | 库 | [Telemetry][telemetry] |

## 17 Evals 行为评测

| 编号 | 功能 | 详细作用 | 入口／条件 | 状态 | 依据 |
| --- | --- | --- | --- | --- | --- |
| EV-01 | 宿主行为评测 | 在当前机器运行 vitest-evals 场景，衡量模型执行工作流的实际结果，与普通单元测试用途不同。 | `eval:host` | 开发工具 | [Evals][evals] |
| EV-02 | 文档效果对照 | 对同一任务比较 with_docs 和 without_docs，量化随包文档对任务完成率的影响。 | `eval:docs` | 开发工具 | [Evals][evals] |
| EV-03 | 当前工作区包评测 | 打包当前仓库内部包并构建实验镜像，避免无意测到 npm 上其他版本。 | consumer-install／Docker 流程 | 开发工具 | [Evals][evals] |
| EV-04 | 场景发现与计划 | 在两种镜像中发现相同 case 集合，并预先展开变体、模型、重复次数的完整运行计划。 | plan、discovery | 开发工具 | [Evals][evals] |
| EV-05 | 每次运行隔离 | 每个实验臂使用新容器、home、agent 目录、工作区和会话目录，并隔离评测定义与答案材料。 | Docker runner | 开发工具 | [Evals][evals] |
| EV-06 | 工具暴露限制 | 文档实验默认只给 read、write、edit、grep、find、ls，减少 Shell 或搜索带来的混杂因素；容器仍需访问模型网络。 | documentation harness | 开发工具 | [Evals][evals] |
| EV-07 | 重复运行与交替顺序 | 支持指定重复次数，并交替对照运行顺序，帮助观察不稳定性和顺序偏差。 | runs-per-variant | 开发工具 | [Evals][evals] |
| EV-08 | 精确配对与异常屏蔽 | 只有两臂都有唯一有效分数才纳入比较；缺失或异常配对会阻止输出误导性的总体提升率。 | report | 开发工具 | [Evals][evals] |
| EV-09 | 结果与会话归档 | 保存协议、预期队列、观测 JSONL、Vitest JSON、原始 Pi 会话及文本／JSON 比较报告，支持复查。 | `.eval/<run>/` | 开发工具 | [Evals][evals] |
| EV-10 | 自定义场景和确定性评分 | 通过 describeEval、run 和 judge 定义任务与评分；低分作为实验数据，基础设施错误另行报告。 | evals 目录 | 开发工具 | [Evals][evals] |

## 18 Env 远程执行环境

| 编号 | 功能 | 详细作用 | 入口／条件 | 状态 | 依据 |
| --- | --- | --- | --- | --- | --- |
| ENV-01 | 远程执行与本地代理分离 | 文件和命令在远端运行，Durable worker、存储与模型凭据保留本地；实现与远端 NodeExecutionEnv 对齐的契约。 | RemoteExecutionEnv | 库 | [Env][env] |
| ENV-02 | SSH 立即／惰性连接 | connectSsh 立即探测和部署；sshConnection 在首次操作时执行，连接失败成为该操作的错误，下一操作重新尝试。 | connectSsh、sshConnection | 库 | [Env][env] |
| ENV-03 | 平台探测与守护进程部署 | 识别远端 OS 和架构，从随包二进制选择 Rust daemon；以 SHA-256 命名、缺失时部署且每次启动前校验。 | detectPlatform、deployDaemon、packagedDaemon | 库 | [Env][env]、[导出接口][envapi] |
| ENV-04 | 主机密钥显式信任 | 扫描指纹供所有者独立核对，接受或移除后保存在应用独立 known-hosts 中；连接严格检查固定别名，不自动信任未知或已变密钥。 | scanHostKey、acceptHostKey、forgetHostKey | 库／需宿主交互 | [Env][env]、[导出接口][envapi] |
| ENV-05 | SSH 连接约束 | 使用 BatchMode、严格 host-key 验证，禁用转发、共享连接及配置中的命令，不转发本地 locale，减少 SSH 用户配置对执行行为的意外影响。 | sshArguments、SshTarget | 库 | [Env][env] |
| ENV-06 | 跨平台远程运行 | 支持 Linux、macOS、Android Termux、Windows 的 x86-64／arm64；Windows 探测部署经 PowerShell，字符串命令用 Git Bash，argv 命令直接执行。 | 远端 daemon + SSH | 平台支持 | [Env][env] |
| ENV-07 | 路径与文件操作 | 按远端规则解析相对路径、home、file URI 和 Windows 驱动器路径；支持元数据、读写追加、截断、重命名、建删目录、临时目录及 fsync。 | RemoteExecutionEnv 文件接口 | 库 | [语义][envsem]、[协议][envproto] |
| ENV-08 | 区间读取与目录分页 | 在远端打开文件句柄读取字节范围、扫描行跨度、分批取目录项；noFollow 可拒绝最终路径符号链接，避免大文件和目录全量传回。 | openBinaryReader、scanLines、openDirReader | 库 | [协议][envproto] |
| ENV-09 | 命令执行与环境定制 | 支持 Shell 字符串或无 Shell argv，设置 cwd、环境继承、shellEnv 和超时；按 stdout／stderr 区分输出，完整超长结果可落盘远端。 | exec、spill、inheritEnv | 库 | [语义][envsem] |
| ENV-10 | 输出窗口与传输背压 | 在远端合并节流输出，只传保留窗口并报告省略字节／换行；没有窗口时限制积压并反向减速命令，控制消息优先于批量输出。 | window、skipped、协议发送队列 | 库 | [协议][envproto] |
| ENV-11 | 远程文件监听 | daemon 在文件旁执行快照差异与原生事件／轮询，支持递归和排除；失去原生覆盖会报告 overflow 并轮询，断连后新 daemon 重新建立监听并提示重扫。 | RemoteWatcher、watch | 库 | [语义][envsem]、[协议][envproto] |
| ENV-12 | 取消与断线进程回收 | 单请求取消 exec 会终止进程组；cleanup 按杀进程结果收尾。每五秒 ping，daemon 在三十秒无字节或 stdin 关闭时清理其进程组并退出。 | Context 取消、cleanup、liveness | 库 | [协议][envproto] |
| ENV-13 | 连接丢失与句柄失效 | 丢线请求以 lost:true 失败，后续请求可新建 daemon；旧文件句柄拒绝使用，不偷偷转到新连接或重放已经发出的副作用操作。 | Connection、isConnectionLost | 库 | [协议][envproto]、[导出接口][envapi] |
| ENV-14 | 二进制分帧与并发请求 | 协议 v1 用长度前缀、请求 ID、JSON 元数据及原始二进制 payload，单帧上限 16 MiB；支持事件、取消、ping，并过滤 SSH 启动杂音。 | pi-env serve、Connection | 库 | [协议][envproto] |
| ENV-15 | 执行环境一致性验证 | 仓库提供 Durable conformance、随机操作差分及真实 SSH 可选测试，比较 RemoteExecutionEnv 与同平台 NodeExecutionEnv 行为。 | PI_ENV_DAEMON、PI_ENV_SSH_HOST | 开发测试支持 | [Env][env] |
| ENV-16 | 远程交互伪终端 | 在 daemon 中启动指定程序或用户 login shell，提供按序原始字节输出、输入及退出码，用于编辑器或完整交互终端，区别于 exec 文本输出。 | openTerminal、RemoteTerminal | 库／非 Windows | [Env][env]、[终端接口][envterminal] |
| ENV-17 | 终端尺寸与前台任务 | resize 更新行列并发 SIGWINCH；foreground 查询前台进程组及可用名称，区分 shell 提示与运行中的编辑器／任务，不列后台作业。 | RemoteTerminal.resize／foreground | 库／非 Windows | [终端接口][envterminal]、[协议][envproto] |
| ENV-18 | 本地 daemon 终端与关闭 | localDaemon 可直接连接本机随包 daemon，无需 SSH；close 或连接丢失终止终端工作，exited 报告结果，关闭后输入丢弃。Windows 目前不支持 PTY。 | localDaemon、RemoteTerminal.close／exited | 库／平台相关 | [Env][env]、[终端接口][envterminal] |

## 19 其他：扩展与库示例、平台与工程支持

| 编号 | 功能 | 详细作用 | 入口／条件 | 状态 | 依据 |
| --- | --- | --- | --- | --- | --- |
| OTH-01 | 危险命令确认示例 | 在 bash 调用前识别示例中的危险命令并询问用户，演示如何用 Hook 自建审批；不是默认完整权限系统。 | `permission-gate.ts` | 示例 | [扩展示例][examples] |
| OTH-02 | 项目信任 Hook 示例 | 演示用户或 CLI 扩展参与项目信任决策的入口和时机。 | `project-trust.ts` | 示例 | [扩展示例][examples] |
| OTH-03 | 受保护路径示例 | 在工具管线上阻止修改 `.env`、`.git`、node_modules 等示例路径，展示精细规则。 | `protected-paths.ts` | 示例 | [扩展示例][examples] |
| OTH-04 | 会话破坏性操作确认 | 在清空、切换、分叉等会话操作前弹出确认，避免用户误操作丢失当前工作位置。 | `confirm-destructive.ts` | 示例 | [扩展示例][examples] |
| OTH-05 | 未提交变更保护 | 检测 Git 工作区存在未提交变更时阻止会话切换类操作，展示工作区检查与生命周期结合。 | `dirty-repo-guard.ts` | 示例 | [扩展示例][examples] |
| OTH-06 | 操作系统沙箱示例 | 集成 sandbox-runtime，并读取项目配置限制命令运行环境；需对应平台和依赖。 | `sandbox/` | 示例／外部依赖 | [扩展示例][examples] |
| OTH-07 | Gondolin 微虚拟机 | 将所覆盖内置文件工具和用户 `!` 命令交给 Linux micro-VM，Pi 界面留在宿主；不覆盖所有扩展执行。 | `gondolin/` | 示例／外部依赖 | [隔离运行][containers] |
| OTH-08 | Todo 列表 | 模型通过工具维护任务项，用户通过 `/todos` 查看，展示自定义渲染和分支状态恢复。 | `todo.ts` | 示例 | [扩展示例][examples] |
| OTH-09 | 最小自定义工具 | 提供最小 greeting 工具，演示参数 schema、execute 与 content/details 的基本组成。 | `hello.ts` | 示例 | [扩展示例][examples] |
| OTH-10 | 用户问题选择器 | 模型需要澄清时显示选项，展示扩展如何把工具执行与用户回答连接起来。 | `question.ts` | 示例 | [扩展示例][examples] |
| OTH-11 | 多问题问卷 | 用标签栏在多道问题间切换，集中收集任务参数，避免只支持单次简单确认。 | `questionnaire.ts` | 示例 | [扩展示例][examples] |
| OTH-12 | 内置工具覆写 | 覆盖已有工具加入日志、访问控制等行为，复用原工具而非重新实现全部操作。 | `tool-override.ts` | 示例 | [扩展示例][examples] |
| OTH-13 | 运行时动态注册工具 | 在启动事件或命令处理时注册工具，并配置模型提示片段和工具指南。 | `dynamic-tools.ts` | 示例 | [扩展示例][examples] |
| OTH-14 | 结构化最终结果 | 以终止型工具提交最终结构化结果，避免模型再生成一段不必要文本。 | `structured-output.ts` | 示例 | [扩展示例][examples] |
| OTH-15 | 自定义内置工具显示 | 改变 read、bash、edit、write 的紧凑显示，或仅保留调用不显示折叠结果，工具行为不变。 | `built-in-tool-renderer.ts`、`minimal-mode.ts` | 示例 | [扩展示例][examples] |
| OTH-16 | 自定义搜索输出截断 | 包装 ripgrep 并正确处理超长结果，展示面向模型的输出预算和完整结果路径。 | `truncated-tool.ts` | 示例 | [扩展示例][examples] |
| OTH-17 | SSH 工具后端 | 通过可替换 operations 把工具执行委派到远程机器，复用本地工具的接口与展示。 | `ssh.ts` | 示例 | [扩展示例][examples] |
| OTH-18 | 子智能体独立上下文 | 每个子智能体运行于独立 Pi 进程，以专门提示、模型和工具处理子任务，避免全部细节挤入主上下文。 | `subagent/` | 示例 | [子智能体示例][subagents] |
| OTH-19 | 子智能体并行与链式工作流 | 支持单任务、多个并行任务，以及以上一步结果驱动下一步的 chain；附 scout、planner、worker、reviewer 角色和工作流模板。 | subagent tool、配套 prompts | 示例 | [子智能体示例][subagents] |
| OTH-20 | 子智能体进度、用量与取消 | 展示每个子进程的工具、输出、token 和成本，取消向子进程传播。 | subagent 扩展 UI | 示例 | [子智能体示例][subagents] |
| OTH-21 | 命名配置预设 | 一次选择模型、推理级别、工具和指令组合，便于切换审查、实现等工作方式。 | `preset.ts`、`/preset` | 示例 | [扩展示例][examples] |
| OTH-22 | 只读计划模式 | 以只读探索和步骤追踪组织计划阶段，再进入执行阶段；普通 CLI 默认没有此工作流。 | `plan-mode/`、`/plan` | 示例 | [扩展示例][examples] |
| OTH-23 | 交互式工具开关 | 在界面选择启用／禁用工具并保存到会话，便于运行中调整模型能力。 | `tools.ts`、`/tools` | 示例 | [扩展示例][examples] |
| OTH-24 | 目标式会话交接 | 将当前上下文整理成面向新目标的交接，创建更聚焦的新会话。 | `handoff.ts`、`/handoff` | 示例 | [扩展示例][examples] |
| OTH-25 | 回答问题提取 | 从助手最后回答中提取待回答问题写回输入框，让用户逐项补充信息。 | `qna.ts` | 示例 | [扩展示例][examples] |
| OTH-26 | GitHub issue 输入补全 | 从 gh issue list 预载 issue，在输入中提供 `#编号` 补全，展示可堆叠补全器。 | `github-issue-autocomplete.ts` | 示例 | [扩展示例][examples] |
| OTH-27 | 页脚状态与模型状态 | 显示轮次进度或模型切换后的状态文本，并使用主题色。 | `status-line.ts`、`model-status.ts` | 示例 | [扩展示例][examples] |
| OTH-28 | 自定义头部与底部 | 替换启动头部或页脚，例如显示 Git 分支和 token 统计。 | `custom-header.ts`、`custom-footer.ts` | 示例 | [扩展示例][examples] |
| OTH-29 | Widget 位置控制 | 将持续状态块放在编辑器上方或下方，而不是不断新增聊天消息。 | `widget-placement.ts` | 示例 | [扩展示例][examples] |
| OTH-30 | 工作指示与折叠推理标签 | 定制运行中的视觉指示和隐藏推理标签，使 UI 与扩展工作流一致。 | `working-indicator.ts`、`hidden-thinking-label.ts` | 示例 | [扩展示例][examples] |
| OTH-31 | 程序化用户消息 | 从扩展主动发送用户消息进入会话，用于外部事件或自定义交互触发任务。 | `send-user-message.ts` | 示例 | [扩展示例][examples] |
| OTH-32 | 限时对话框 | 用 AbortSignal 自动关闭确认和选择对话框，避免长时间无人响应。 | `timed-confirm.ts` | 示例 | [扩展示例][examples] |
| OTH-33 | RPC 扩展 UI 演示 | 成对展示代理端 UI 请求和外部客户端处理，验证可转发的选择、输入及通知。 | `rpc-demo.ts`、`rpc-extension-ui.ts` | 示例 | [RPC UI][rpcui] |
| OTH-34 | 模态／动画编辑器 | 实现类似 Vim 的模式编辑器或动态彩色文本，展示替换核心编辑组件的方法。 | `modal-editor.ts`、`rainbow-editor.ts` | 示例 | [扩展示例][examples] |
| OTH-35 | 完成通知与标题动画 | 借助支持的终端协议发送完成通知，或在终端标题中显示运行指示。 | `notify.ts`、`titlebar-spinner.ts` | 示例 | [扩展示例][examples] |
| OTH-36 | 临时摘要窗口 | 调用示例指定模型总结会话，并在临时 UI 中展示，不必作为普通对话消息输出。 | `summarize.ts` | 示例 | [扩展示例][examples] |
| OTH-37 | 贪吃蛇和井字棋 | 展示实时键盘 UI、会话状态保存及顺序工具调用如何支持小游戏。 | `snake.ts`、`tic-tac-toe.ts` | 示例 | [扩展示例][examples] |
| OTH-38 | 覆盖层交互与 DOOM | 展示覆盖层布局、堆叠、动画和实时绘制；DOOM 是扩展示范，不是编码代理核心业务。 | `overlay-test.ts`、`overlay-qa-tests.ts`、`doom-overlay/` | 示例 | [扩展示例][examples] |
| OTH-39 | 自定义退出与安全重载 | 展示命令如何请求 orderly shutdown，以及如何在重载后避免使用旧 runtime。 | `shutdown-command.ts`、`reload-runtime.ts` | 示例 | [扩展示例][examples] |
| OTH-40 | 交互 Shell 接管 | 临时把终端交给 vim、htop 等交互程序，而非仅收集非交互命令输出。 | `interactive-shell.ts` | 示例 | [扩展示例][examples] |
| OTH-41 | 提示内命令展开 | 展开输入中的 `!{command}` 并进行输入预处理，展示将程序结果嵌入提示的方法。 | `inline-bash.ts` | 示例 | [扩展示例][examples] |
| OTH-42 | 忙碌输入轻量预处理 | 按 streamingBehavior 跳过昂贵输入转换，避免运行中纠偏被额外预处理拖慢。 | `input-transform-streaming.ts` | 示例 | [扩展示例][examples] |
| OTH-43 | Git 检查点 | 在轮次边界创建 stash 检查点并在分叉时恢复代码状态；这只是扩展示例，普通会话分叉不自动回滚文件。 | `git-checkpoint.ts` | 示例 | [扩展示例][examples] |
| OTH-44 | 退出自动提交 | 使用最后助手内容形成提交说明并在退出时提交；需主动加载，Pi 默认不会因此自动提交。 | `auto-commit-on-exit.ts` | 示例 | [扩展示例][examples] |
| OTH-45 | 系统提示附加与规则扫描 | 动态附加提示，或扫描 `.claude/rules` 并提供规则索引，展示外部约定接入。 | `pirate.ts`、`claude-rules.ts` | 示例 | [扩展示例][examples] |
| OTH-46 | 自定义摘要和压缩触发 | 替换摘要实现，或按自设阈值和命令启动压缩。 | `custom-compaction.ts`、`trigger-compact.ts` | 示例 | [扩展示例][examples] |
| OTH-47 | macOS 系统主题同步 | 响应 macOS 外观选择主题，演示操作系统信号与 Pi UI 联动。 | `mac-system-theme.ts` | 示例 | [扩展示例][examples] |
| OTH-48 | 动态资源发现 | 在资源发现阶段提供额外技能、模板和主题，允许扩展按环境补充资源。 | `dynamic-resources/` | 示例 | [扩展示例][examples] |
| OTH-49 | 自定义消息／条目展示 | 为扩展消息和不进入模型上下文的记录定制颜色、折叠与详情。 | `message-renderer.ts`、`entry-renderer.ts` | 示例 | [扩展示例][examples] |
| OTH-50 | 提供商流调试查看器 | 按需记录原始解析事件，并按助手消息聚合为 TUI 诊断条目。 | `debug-provider.ts` | 示例 | [扩展示例][examples] |
| OTH-51 | 扩展通信示范 | 展示如何通过事件总线协调多个扩展，而不共享私有状态。 | `event-bus.ts` | 示例 | [扩展示例][examples] |
| OTH-52 | 会话命名与书签 | 由扩展设置会话名称和节点标签，使 session picker 与 tree 更易定位。 | `session-name.ts`、`bookmark.ts` | 示例 | [扩展示例][examples] |
| OTH-53 | 自定义 Anthropic／GitLab Duo | 演示自定义认证、流处理或通过代理复用已有 Anthropic／OpenAI 实现。 | 两个 custom-provider 示例目录 | 示例 | [扩展示例][examples] |
| OTH-54 | 分类器驱动模型路由 | 用 Jev 判断规划阶段所需模型，并在首次修改后切换到更便宜模型，状态保存在当前分支。 | `jev-router.ts` | 示例 | [虚拟模型][virtual] |
| OTH-55 | 有依赖扩展与文件触发 | 展示扩展自己的 package.json 依赖解析，以及监听文件后将其内容注入对话。 | `with-deps/`、`file-trigger.ts` | 示例 | [扩展示例][examples] |
| OTH-56 | SDK 完整演练集 | 14 个示例覆盖最小调用、模型、提示、技能、工具、扩展、上下文、模板、认证、设置、会话、完全替换宿主、runtime 切换、MCP／Codemode。 | `examples/sdk/01`—`14` | 示例 | [SDK][sdk] |
| OTH-57 | Agent + MCP + Codemode 组合 | 将独立 MCP 工具与脚本沙箱包装为 AgentTool，嵌套执行仍走 runToolCall 的前后 Hook。 | `packages/agent/examples/mcp-codemode` | 示例 | [Agent][agent] |
| OTH-58 | Durable 基础示例 | 00—13 展示会话、文档、分叉、拥有关系、Chord 状态、watch、Harness、配置、上下文、热重载、扩展状态、任务和恢复。 | `durable/test/examples/` | 实验／示例 | [Durable][durable] |
| OTH-59 | Durable 输出与队列示例 | 14—21 展示问答、系统提示、真实流式模型、编码工具、print／JSON 输出、忙碌收件箱和晚加入观察。 | `durable/test/examples/` | 实验／示例 | [Durable][durable] |
| OTH-60 | Durable 子智能体示例 | 22—23 演示前台子任务拥有关系，以及后台子智能体的创建、投递、等待、停止、列举和重启安全回报。 | foreground／background 示例 | 实验／示例 | [Durable][durable] |
| OTH-61 | Durable 高级工作流示例 | 24—31 覆盖子任务失败收尾、压缩、编码代理、计划模式、审查者、每会话独立环境、工具包装和重载恢复。 | `durable/test/examples/` | 实验／示例 | [Durable][durable] |
| OTH-73 | Windows 原生支持 | 原生模块配置控制台输入、读取修饰键并异步访问文本／图片剪贴板，提供 x64 与 arm64 预构建。 | tui/native/win32 | 平台支持 | [Windows 原生][nativewin] |
| OTH-74 | macOS 原生支持 | 通过 AppKit 获取修饰键及文本、图片、文件路径剪贴板，支持 Intel 与 Apple Silicon。 | tui/native/darwin | 平台支持 | [macOS 原生][nativemac] |
| OTH-75 | Linux 剪贴板支持 | X11 使用原生 XCB 异步读取；不可用时降级，Wayland 使用 wl-paste，写入使用既有命令或终端路径。 | tui/native/linux | 平台支持 | [Linux 原生][nativelinux] |
| OTH-76 | Windows／WSL 快捷键适配 | 针对终端保留组合键提供不同默认绑定，并区分 Windows 无 Unix 挂起与 WSL 的作业控制。 | Windows、WSL | 平台支持 | [快捷键][keys] |
| OTH-77 | tmux、Termux 和终端配置指南 | 仓库提供复用器、Android Termux、图片、按键等配置指导；属于部署兼容说明，不是额外的移动应用。 | 平台文档 | 文档支持 | [终端配置][terminal]、[tmux][tmux]、[Termux][termux] |
| OTH-78 | 整进程 Docker 隔离方案 | 把 Pi、工具和扩展全部放入容器，通过挂载与网络配置决定可访问资源；这是外部隔离方案。 | Docker | 外部集成指南 | [隔离运行][containers] |
| OTH-79 | Docker Sandboxes 凭据代理方案 | 管理沙箱运行完整 Pi，并由代理替换占位凭据，使真实 provider key 可留在宿主。 | Docker Sandboxes | 外部集成指南 | [隔离运行][containers] |
| OTH-80 | OpenShell 策略隔离方案 | 通过外部网关与 sandbox 管理文件、进程、网络、凭据和推理路由，适合需要系统级边界的运行方式。 | OpenShell | 外部集成指南 | [隔离运行][containers] |
| OTH-81 | 安装与自更新 | 提供多平台安装入口和 npm 安装；managed 安装的 pi update 仅保留新版本和升级前版本，避免长期堆积；包管理器安装走其对应升级路径。 | installer、`pi update` | 工程／产品支持 | [项目 README][root]、[更新记录][clilog] |
| OTH-82 | Nix 安装与固定版本 | 使用 stable、tag 或源码版本构建／安装，离线构建用仓库固定的模型目录修订。 | Nix flake | 工程支持 | [项目 README][root] |
| OTH-83 | 独立二进制与源码归档 | 发布流程可构建含运行资产的独立程序，并从带校验信息的发行源码重建。 | scripts/build-binaries.sh | 工程支持 | [项目 README][root] |
| OTH-84 | 依赖供应链检查 | 固定直接外部依赖，检查锁文件及安装锁，默认忽略依赖生命周期脚本，并进行相应审计。 | npm scripts、install-lock | 工程支持 | [项目 README][root]、[开发规范][rules] |
| OTH-85 | 静态检查与定向测试 | 根 check 检查格式、类型及依赖等；测试按包和具体文件运行，交互测试另有专门流程。 | `npm run check`、包测试入口 | 工程支持 | [开发规范][rules] |
| OTH-86 | 模型目录生成 | 从生成脚本维护模型目录和各 provider 数据，避免直接手改生成文件，并提供固定目录更新流程。 | ai/scripts/generate-models.ts | 工程支持 | [开发规范][rules]、[AI][ai] |
| OTH-87 | 安装与发布验证 | 仓库提供本地包构建、隔离 consumer 安装及 release smoke 流程，检查 npm／Bun 分发路径。 | release:local 等 | 工程支持 | [项目 README][root] |
| OTH-88 | 安装遥测与保留分析设置 | enableInstallTelemetry 控制匿名安装／更新报告及部分归因头；enableAnalytics 字段仍保留，但原实验首启入口已删除，不能据旧文档将其列作现有首启分析流程。 | enableInstallTelemetry、enableAnalytics | 可配置支持／保留字段 | [设置][settings]、[CLI 变更][clilog] |
| OTH-89 | 当前仓库中文离线导览 | docs/doc-html 提供离线源码、功能、目录、历史和二次开发导览，已随本地文档提交保留；属于本仓库附加文档，生成内容是否同步需单独核查，不能等同于当前源码事实。 | `docs/doc-html/index.html` | 本地文档产物 | [离线导览][offlineguide] |

## 能力边界与容易混淆的地方

| 项目 | 当前结论 | 对清单的影响 | 依据 |
| --- | --- | --- | --- |
| 普通 CLI 的计划模式和子智能体 | 根 README 明确说明未作为默认功能提供，仓库附带可加载扩展示例。 | 列入“其他”的示例；Durable 的相应原语单独标为实验。 | [项目 README][root]、[示例][examples] |
| 内置权限系统 | Pi 以启动用户和进程的权限运行，不内置完整的文件／进程／网络／凭据访问审批系统。 | 工具 allowlist、项目 trust、审批扩展示例不能等同于系统沙箱。 | [安全边界][security] |
| 项目信任保护范围 | 主要控制项目配置和资源加载；sessionDir 在信任前读取，AGENTS 等上下文文件也不以信任为前提。 | 不能把“拒绝信任”理解为“目录内内容完全不会影响模型”。 | [配置][config]、[安全边界][security] |
| 技能 allowed-tools 字段 | 文档列为实验性元数据；Pi 不因此获得一套通用安全隔离机制。 | 技能是指导与资源包，不是强制权限执行环境。 | [技能][skills]、[安全边界][security] |
| 默认工具集合 | 普通 CLI 默认 read、bash、edit、write；其他内置工具按设置启用。MCP 可激活 codemode／tool_search。 | “仓库内置”与“当前会话默认可调用”分别标注。 | [CLI][cli] |
| SDK 内置扩展 | SDK 不自动加载 CLI 的 MCP、Codemode、tool_search，需显式加入工厂并完成绑定。 | CLI 可用并不代表最小 SDK 示例自动具备全部能力。 | [SDK][sdk] |
| MCP 完整度 | 当前集成支持工具与资源，但不渲染 MCP Apps；独立 MCP README 将 sampling、tasks、旧 SSE 等排除在初始核心之外。 | 不把“支持 MCP”写成“支持 MCP 的全部规范和应用 UI”。 | [MCP][mcp]、[MCP 库][mcplib] |
| 图像生成保存行为 | 模型接口返回图像内容；Codemode 的 `image()` 会另存临时文件。models.md 中“生成图不落盘”与 codemode.md 的表述层级不同且容易混淆。 | 清单将生成接口和 image 输出／临时保存分开，不承诺永久资产库。 | [模型][models]、[Codemode][code] |
| 模型硬输入限制 | 目录可以声明 request bytes 或每请求图片数，但文档明确 Pi 尚不据此重写或拒绝全部历史。 | 图片缩放支持不等于所有元数据限制均被运行时强制执行。 | [模型][models] |
| 分类和图像模型 | 不出现在普通聊天 `/model` 选择器，须通过 Codemode／扩展／库的专用接口使用。 | 不把这些模型列成可直接替代聊天 Agent 的模型。 | [模型][models] |
| 自动重试 | 模型暂时错误、MCP 重连和 Chord 断链是不同机制，Chord 在途请求断链后无法保证是否已执行。 | 不承诺工具副作用自动重放，重试需由业务决定。 | [设置][settings]、[MCP][mcp]、[Chord 规范][chordspec] |
| 普通会话分叉 | 分叉保存对话分支，不自动恢复 Git 工作目录。 | 代码恢复另见 git-checkpoint 示例。 | [会话][sessions]、[示例][examples] |
| Durable 存储锁 | Durable 仍要求单进程拥有存储；新 Chord node 提供独立 processLock，须宿主显式集成。 | 旧 experimental 宿主已删除，不能把其目录锁视为当前 CLI 能力。 | [Durable][durable]、[Chord 规范][chordspec] |
| 外部生态 | Slack／聊天自动化指向独立 pi-chat 仓库；会话发布到 Hugging Face 使用外部工具。 | 不作为本仓库内置业务模块。 | [项目 README][root] |
| 其他代理常见功能 | 普通内置工具清单未提供通用浏览器自动化、专用网页搜索、语音转写、邮件客户端或定时任务调度模块。 | 可借 Shell、MCP、技能或扩展实现，但不能将可扩展性写成现成功能。 | [CLI][cli]、[扩展][ext] |
| Chord 热重载边界 | 当前仅协调直接子宿主，commit 决策未持久化，重连不能续接旧 holds；loader 不回收旧模块且不隔离插件。 | 跨进程能力已实现，但不承诺崩溃下原子集群升级、无限层级重载或沙箱。 | [规范][chordspec] |
| Chord 数据所有权 | track、replicatedState 和 replace 接管可信不可变 JSON，发布值并未冻结。 | 消费者不得修改共享对象，跨可变信任边界须复制或序列化。 | [Chord][chord] |
| PTY 平台范围 | Env 远程文件／exec 支持 Windows，但新增交互 PTY 暂不支持。 | 不把已有 Windows daemon 支持等同于完整远程终端支持。 | [Env][env] |

## 已移除或替换的能力（不计入当前功能数）

| 原条目／模块 | 当前状态 | 影响与依据 |
| --- | --- | --- |
| CL-01—CL-10、SV-01—SV-10、PT-01—PT-08 | pi-client、pi-server、pi-protocol 已删除且不再发布。 | 旧 Unix 服务路由、attachment、CBOR 协议不再作为现有模块列出；普通 CLI JSONL RPC 仍保留。[Chord 变更][chordlog] |
| 原 CH-01—CH-20 | 旧 facet/service runtime 由 typed host runtime 替换；保留的 Delta／replicatedState 重新列入新表。 | 删除 defineService、createFacetHost、远程 service helpers、bundler 和旧 node bundle loader；新模块使用 CHR 编号，不能把同名 defineFacet 当作旧接口兼容。[Chord 变更][chordlog] |
| OTH-62—OTH-64 | experimental/durable 与 vacation 源码应用已删除。 | Durable 包及其 test/examples 仍在，独立实验 TUI、/agents、/tasks 和 Vacation 应用不再列作当前入口。[CLI 变更][clilog] |
| OTH-65—OTH-72 | 实验 server/client/plugin 栈及 pi-example-plugin 已删除。 | PI_EXPERIMENTAL 旧入口、实验 Session／Transcript 服务和 source-only exports 不再可用；Chord 是新底层库，不等于旧应用已迁移完成。[CLI 变更][clilog] |
| MCP_TYPESCRIPT_PREAMBLE、mcpStructuredContentSchema | 从 Codemode 导出移除。 | 结果类型改由工具 output schema 自包含展开，不再依赖共享 MCP TypeScript 前导定义。[Codemode 变更][codelog] |

## 本次更新记录（2026-10-12，第二次合并）

| 范围 | 据实调整 |
| --- | --- |
| 核对基线 | 从上一版 fe2b9da4c 对比到本次本地合并提交 6cd9d957a；包版本仍为 1.1.0，新改动主要在 Unreleased，未联网拉取或切换分支。 |
| 模块结构 | 移除三个已删除包的活动模块，Chord 全面重写；其后模块重新编号，其他模块保留功能 ID，OTH-62—72 留空并在历史表说明。 |
| CLI／AI／MCP | 更新 OpenRouter 按 key 目录、schema 发布地址、自定义消息启动事件、启动期 busy、reachesTools、namespace 别名、资源能力诊断及压缩序列化。 |
| Codemode／Durable | 补充确定性 start、持久脚本日志恢复、延迟工具搜索、自定义输入和压缩失败；修正结构化失败结果的 resolve／reject 边界。 |
| Env | 新增远程／本地 PTY、交互输入输出、尺寸和前台进程查询，注明 Windows 暂不支持。 |
| 发布与验证 | 静态核对源码、文档和差异，验证表格、编号、来源路径及包覆盖；不将库能力外推到 CLI，不逐项调用服务或运行功能。 |

## 来源与维护说明

| 项目 | 说明 |
| --- | --- |
| 首要来源 | 各 package README、coding-agent 的 CLI／设置／扩展／SDK／RPC／MCP 等参考文档，并核对工具工厂、提供商注册、包导出和已移除源码。 |
| 来源优先级 | 当前源码和接口声明优先于旧示例中的过时片段；出现文档冲突时按具体调用层级说明，不把一层能力外推到另一层。 |
| 提供商口径 | 模块 12 按接入家族归并区域 provider，非模型数量统计；模型清单和可用账户能力以实际目录与凭据为准。 |
| 示例口径 | 模块 19 将相近的展示示例及 SDK／Durable 演练集归并；示例 API、角色和提示不是普通 CLI 新增的独立内置模块。 |
| 本地导览口径 | 现有 HTML 导览仅用于辅助检查遗漏；最终功能说明主要回链到原始包文档，不把导览内自动文件归属索引计作独立功能。 |
| 更新方式 | 升级仓库后重新核对 CLI 选项、工具集合、内置扩展、provider 注册、各包 README、CHANGELOG 与实际导出，再更新版本口径和对应行。 |

[root]: ../../README.md
[rules]: ../../AGENTS.md
[usage]: ../../packages/coding-agent/docs/usage.md
[cli]: ../../packages/coding-agent/docs/cli.md
[slash]: ../../packages/coding-agent/docs/slash-commands.md
[json]: ../../packages/coding-agent/docs/json.md
[keys]: ../../packages/coding-agent/docs/keybindings.md
[settings]: ../../packages/coding-agent/docs/settings.md
[sessions]: ../../packages/coding-agent/docs/sessions.md
[compact]: ../../packages/coding-agent/docs/compaction.md
[models]: ../../packages/coding-agent/docs/models.md
[virtual]: ../../packages/coding-agent/docs/virtual-models.md
[llama]: ../../packages/coding-agent/docs/llama-cpp.md
[config]: ../../packages/coding-agent/docs/configuration.md
[security]: ../../packages/coding-agent/docs/security.md
[skills]: ../../packages/coding-agent/docs/skills.md
[templates]: ../../packages/coding-agent/docs/prompt-templates.md
[themes]: ../../packages/coding-agent/docs/themes.md
[packages]: ../../packages/coding-agent/docs/packages.md
[ext]: ../../packages/coding-agent/docs/extensions.md
[examples]: ../../packages/coding-agent/examples/extensions/README.md
[tools]: ../../packages/coding-agent/src/core/tools/index.ts
[mcp]: ../../packages/coding-agent/docs/mcp.md
[mcplib]: ../../packages/mcp/README.md
[code]: ../../packages/coding-agent/docs/codemode.md
[codelib]: ../../packages/codemode/README.md
[sdk]: ../../packages/coding-agent/docs/sdk.md
[rpc]: ../../packages/coding-agent/docs/rpc.md
[rpccmd]: ../../packages/coding-agent/docs/rpc-commands.md
[rpcui]: ../../packages/coding-agent/docs/rpc-extension-ui.md
[agent]: ../../packages/agent/README.md
[ai]: ../../packages/ai/README.md
[allproviders]: ../../packages/ai/src/providers/all.ts
[tui]: ../../packages/tui/README.md
[chord]: ../../packages/chord/README.md
[durable]: ../../packages/durable/README.md
[telemetry]: ../../packages/telemetry/README.md
[evals]: ../../packages/evals/README.md
[subagents]: ../../packages/coding-agent/examples/extensions/subagent/README.md
[nativewin]: ../../packages/tui/native/win32/README.md
[nativemac]: ../../packages/tui/native/darwin/README.md
[nativelinux]: ../../packages/tui/native/linux/README.md
[terminal]: ../../packages/coding-agent/docs/terminal-setup.md
[tmux]: ../../packages/coding-agent/docs/tmux.md
[termux]: ../../packages/coding-agent/docs/termux.md
[containers]: ../../packages/coding-agent/docs/containerization.md
[offlineguide]: ../../docs/doc-html/README.md

[env]: ../../packages/env/README.md
[envsem]: ../../packages/env/docs/semantics.md
[envproto]: ../../packages/env/docs/protocol.md
[envapi]: ../../packages/env/src/index.ts
[providers]: ../../packages/coding-agent/docs/providers.md
[schemas]: ../../packages/coding-agent/scripts/generate-schemas.ts
[clilog]: ../../packages/coding-agent/CHANGELOG.md
[ailog]: ../../packages/ai/CHANGELOG.md
[agentlog]: ../../packages/agent/CHANGELOG.md
[durlog]: ../../packages/durable/CHANGELOG.md
[tuilog]: ../../packages/tui/CHANGELOG.md
[codelog]: ../../packages/codemode/CHANGELOG.md

[chordguide]: ../../packages/chord/docs/guide.md
[chordspec]: ../../packages/chord/docs/spec.md
[chordlog]: ../../packages/chord/CHANGELOG.md
[chordmanager]: ../../packages/chord/src/manager.ts
[envterminal]: ../../packages/env/src/terminal.ts
