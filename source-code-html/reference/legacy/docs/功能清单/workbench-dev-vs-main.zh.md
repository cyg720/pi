> 历史资料：来自随附 workbench-dev / bfd39aee / 2026-10-20 导览。当前 checkout 无此路径；内容不能作为当前接口。

# workbench-dev 与本地 main 的代码差异清单

核对日期：2026-10-20（Asia/Shanghai）。这是两个已提交 Git 快照的对比，不是远端最新状态，也不包括本次文档整理的未提交改动。

## 1. 先看结论

workbench-dev 已包含此次本地 main 的全部历史，在其上增加 2 个提交。新增的是“浏览器工作台 → HTTP 契约 → 本地宿主 → 原生会话适配”四层，以及少量原生包修补与工程保障；不是用旧分支整体替换主干。

- 对比得到 **1816 个路径变化：1782 新增、34 修改、0 删除**（禁用 rename 推断）。数量包含大量文档、固定模型数据、测试及二进制资料，不能解读为 1816 项产品功能。
- 工作台按既有源码专题整理为 **43 项功能**：前端 13、协议 4、服务端 20、适配层 6。其稳定编号分别为 WBW、WBP、WBS、WBR。
- 原清单 587 个编号完整保留；新增 43 项工作台与 10 项当前源码能力，共 **640 项、23 模块**。新增编号不是“分支独有功能数”：例如 Durable 睡眠、AI 遥测已存在于 main。
- 完整逐文件清单见 [CSV（1816 行）](workbench-dev-vs-main.files.csv)；全域功能见 [pi-feature-catalog.zh.md](pi-feature-catalog.zh.md)。

## 2. 比较基线与历史关系

| 项目 | 固定值 |
| --- | --- |
| 当前分支 | workbench-dev |
| 当前 HEAD | bfd39aeeb0d53b4c8b6e5a60fdf82f2c850348f5 |
| 本地 main | d2e7d8b7c1d31d3661f769d5caef7ba8d50c3e03 |
| 共同祖先 | d2e7d8b7c1d31d3661f769d5caef7ba8d50c3e03 |
| main 独有 / workbench-dev 独有提交 | 0 / 2 |
| 工作区起始状态 | 干净；本次仅整理 docs，未切换分支、fetch、合并或修改业务代码 |

| 分支新增提交 | 说明 |
| --- | --- |
| bfd39aeeb0d53b4c8b6e5a60fdf82f2c850348f5 | docs: update offline source guide for workbench-dev |
| c9e4363e72308747e817da34112162f8ddfdc574 | feat: integrate workbench with latest main |

整合方式的历史说明见 [docs/workbench/MAIN-INTEGRATION.md](../../docs/workbench/MAIN-INTEGRATION.md)。该文档记录此前从 main 建支、按内容接入工作台的过程；其中测试结果属于当时验证，不自动算作本次复跑。

## 3. 按目录汇总

| 目录 | 总数 | 新增 | 修改 | 删除 | 二进制 | 实际内容 |
| --- | --- | --- | --- | --- | --- | --- |
| 根目录 | 10 | 4 | 6 | 0 | 0 | workspace 注册、构建/检查脚本、精确依赖、格式/类型覆盖与历史交付清单。 |
| apps/agent-server | 124 | 124 | 0 | 0 | 2 | 新增 HTTP 宿主、身份与授权、持久会话、worker、文件/终端/配置、十模块执行及测试。 |
| apps/agent-web | 187 | 187 | 0 | 0 | 0 | 新增浏览器工作台、页签、会话、检查器、配置、模块表单、双语与前端测试。 |
| deploy | 1 | 1 | 0 | 0 | 0 | 工作台部署与备份恢复说明。 |
| docs/doc-html | 87 | 87 | 0 | 0 | 8 | 中文离线源码导览、生成器、测试、历史图与课件资源。 |
| docs/workbench | 1261 | 1261 | 0 | 0 | 69 | 工作台历史设计、覆盖表、交付证明和验证资产；不把每份报告或截图算成运行功能。 |
| docs/其他 | 1 | 1 | 0 | 0 | 0 | 当前稳定功能编号 Markdown 清单。 |
| packages/agent-protocol | 10 | 10 | 0 | 0 | 0 | 新增浏览器传输 DTO、严格解析、事件归约与终端契约。 |
| packages/agent-runtime-adapter | 24 | 24 | 0 | 0 | 0 | 新增原生 AgentSession 装配、模型和工具上限、事件转换与运行操作。 |
| packages/ai | 46 | 43 | 3 | 0 | 0 | 重试状态码识别补丁、两份测试调整；43 个新增文件是固定模型数据（含 manifest）。 |
| packages/chord | 2 | 0 | 2 | 0 | 0 | Progress 单调计时与定时精度修正及测试；不是新增整个 Chord。 |
| packages/coding-agent | 6 | 2 | 4 | 0 | 0 | 原生工作台设置白名单、异步 diff 注入、grep 相对路径语义与定向测试。 |
| packages/durable | 8 | 5 | 3 | 0 | 0 | Windows 命令 supervisor、进程树收尾、文件队列导出及取消/超时测试。 |
| packages/env | 2 | 0 | 2 | 0 | 0 | 连接子进程显式 env 与隐藏窗口，以及相应 README。 |
| packages/evals | 15 | 3 | 12 | 0 | 0 | 工作台窄导出、纯参数解析、grep 评测、TUI oracle、Docker 工具及类型覆盖。 |
| packages/tui | 2 | 1 | 1 | 0 | 0 | contain 滚动边界修复与回归用例。 |
| scripts | 22 | 21 | 1 | 0 | 0 | 工作台构建/检查/测试/恢复、ConPTY 门禁、forge 验证、Windows 路径规范化。 |
| vendor | 8 | 8 | 0 | 0 | 1 | 固定 node-forge 定向回移包、来源补丁、指纹、许可和重建工具锁。 |

文本增删行和二进制标记逐文件见 CSV。压缩 JSON、内嵌 HTML 与交付资料会放大行数，不能据此判断开发工作量。

## 4. 工作台新增功能（按一次请求的业务顺序）

典型调用：浏览器 Composer → host-client → HTTP 身份/来源/工作区授权 → protocol 校验 → WorkerManager → createWorkbenchRuntime → AgentSession → 模型/工具 → 安全事件投影 → 持久化序号 → SSE → 浏览器归约。取消、恢复、文件与配置走各自分支，不是每次请求都会执行全部路径。

### 4.1 浏览器工作台（13 项）

| 稳定编号 / 功能 | 作用与入口 | 条件及限制 | 源码依据 / 测试阅读线索 |
| --- | --- | --- | --- |
| WBW-01 页面启动、路由与多页签 | 装配工作台，按业务页面打开、切换、关闭页签并同步深链接。 入口：bootstrap / workspace-router / TabBar | 关闭页签与清除草稿不同；键盘菜单、右侧工作区和窄屏布局分别维护。 | [apps/agent-web/src/app/bootstrap.ts](../../apps/agent-web/src/app/bootstrap.ts)；按模块测试核对，未宣称逐项覆盖 |
| WBW-02 原生会话列表与聊天 | 创建或选择会话，提交提示，呈现消息和运行状态。 入口：#/coding-agent → Sessions → Composer | 浏览器通过宿主操作会话；没有宿主时显示不可连接，不生成假模型回复。 | [apps/agent-web/src/features/coding-agent/Chat.ts](../../apps/agent-web/src/features/coding-agent/Chat.ts)；按模块测试核对，未宣称逐项覆盖 |
| WBW-03 HTTP 客户端与 SSE 事件恢复 | 请求同源 API，消费带序号的事件并恢复浏览器状态。 入口：host-client / host-events | 事件回放与快照兜底处理断线；最终 message_end 替换增量拼接结果，避免重复文本。 | [apps/agent-web/src/features/coding-agent/derived.ts](../../apps/agent-web/src/features/coding-agent/derived.ts)；按模块测试核对，未宣称逐项覆盖 |
| WBW-04 图片附件与输入校验 | 将用户选择的图片整理为提示附件，并反馈类型或容量错误。 入口：Attachments → prompt 请求 | 前端反馈不替代服务端严格校验；图片能力仍由宿主模型声明。 | [apps/agent-web/src/features/coding-agent/Attachments.ts](../../apps/agent-web/src/features/coding-agent/Attachments.ts)；按模块测试核对，未宣称逐项覆盖 |
| WBW-05 运行、上下文、变更与资源检查器 | 检查工具、队列、用量、上下文投影、文件差异与运行时信息。 入口：Inspector / RuntimePanel | canonical-projection 是当前分支模型上下文；未知费用保留未知，不由 token 数伪造账单。 | [apps/agent-web/src/features/coding-agent/ChangesInspector.ts](../../apps/agent-web/src/features/coding-agent/ChangesInspector.ts)；按模块测试核对，未宣称逐项覆盖 |
| WBW-06 文件浏览、搜索和编辑冲突 | 在授权工作区内浏览、查找、新建和修改文件。 入口：FilesInspector → workspace files API | 保存带 etag；冲突时重新读取，不把浏览器编辑内容自动覆盖新版本。 | [apps/agent-web/src/features/coding-agent/FilesInspector.ts](../../apps/agent-web/src/features/coding-agent/FilesInspector.ts)；按模块测试核对，未宣称逐项覆盖 |
| WBW-07 终端面板与显式创建 | 操作宿主允许的 PTY，发送输入、调整尺寸并观察退出。 入口：Terminal → terminal routes | 查看面板不启动 shell；只有宿主启用且用户创建后才有真实终端。 | [apps/agent-web/src/features/coding-agent/Terminal.ts](../../apps/agent-web/src/features/coding-agent/Terminal.ts)；按模块测试核对，未宣称逐项覆盖 |
| WBW-08 原生设置、模型与诊断入口 | 提供会话、模型、参考资料、原生设置和诊断的独立入口。 入口：Entries → NativeSettings / Models / Diagnostics | native settings 仅保存非秘密白名单；保存影响下一次 runtime 创建，项目范围需要宿主信任。参考清单不是全部已接通的 API。 | [apps/agent-web/src/features/coding-agent/Entries.ts](../../apps/agent-web/src/features/coding-agent/Entries.ts)；测试：[apps/agent-web/tests/agent-native-settings.test.mjs](../../apps/agent-web/tests/agent-native-settings.test.mjs) |
| WBW-09 内存草稿、JSON 编辑与导入导出 | 保留页内配置与未应用文本，校验整份草稿后再原子导入。 入口：drafts / store / JsonEditor | 浏览器草稿刷新会丢失；导出 pi-workbench-draft 不等于可直接传给 SDK 的完整配置。 | [apps/agent-web/src/components/ImportDialog.ts](../../apps/agent-web/src/components/ImportDialog.ts)；按模块测试核对，未宣称逐项覆盖 |
| WBW-10 保存配置、继承解析与生效回执 | 读取 global/workspace/session 配置，显示来源与实际操作回执。 入口：SavedConfiguration → resolution / receipt | revisionVector 约束继承快照；保存成功、参数发出和行为实测是不同证据。 | [apps/agent-web/src/features/saved-config/SavedConfiguration.ts](../../apps/agent-web/src/features/saved-config/SavedConfiguration.ts)；按模块测试核对，未宣称逐项覆盖 |
| WBW-11 十模块页面与显式运行 | 将模块表单、能力索引、示例和宿主 operation 组合成独立页面。 入口：ModuleOperations → /api/modules/capabilities | 按宿主支持状态开放操作；本地 fixture、真实模型和外部 daemon 的结果须按各自边界理解。 | [apps/agent-web/src/features/FeaturePage.ts](../../apps/agent-web/src/features/FeaturePage.ts)；按模块测试核对，未宣称逐项覆盖 |
| WBW-12 能力、字段与固定模型目录 | 提供参数元数据、源码链接、模型选择与能力帮助。 入口：data/catalog / feature-specs / models.json | 目录来自源码快照；可选择不代表当前账号能调用，字段可编辑不代表已运行验证。 | [apps/agent-web/src/data/catalog/agent-spec.ts](../../apps/agent-web/src/data/catalog/agent-spec.ts)；按模块测试核对，未宣称逐项覆盖 |
| WBW-13 双语、可访问控件与响应式样式 | 集中管理中英文文案、DOM 控件、选择器和布局。 入口：i18n / Select / Field / styles | 语言切换保留编辑状态；文本、属性和交互分别更新。 | [apps/agent-web/src/components/AgentAvatar.ts](../../apps/agent-web/src/components/AgentAvatar.ts)；测试：[apps/agent-web/tests/agent-native-settings.test.mjs](../../apps/agent-web/tests/agent-native-settings.test.mjs) |

### 4.2 HTTP 与事件契约（4 项）

| 稳定编号 / 功能 | 作用与入口 | 条件及限制 | 源码依据 / 测试阅读线索 |
| --- | --- | --- | --- |
| WBP-01 浏览器安全 DTO 与请求响应类型 | 定义会话、消息、工作区、配置、能力与运行请求的传输结构。 入口：@pi-workbench/protocol | wire v1 与 npm 包版本不同；私有磁盘路径和凭据不应进入浏览器 DTO。 | [packages/agent-protocol/src/index.ts](../../packages/agent-protocol/src/index.ts)；测试：[apps/agent-server/test/config-receipts.test.ts](../../apps/agent-server/test/config-receipts.test.ts) |
| WBP-02 严格 JSON、提示与配置校验 | 拒绝未知字段、非法标识、危险对象结构与过量图片。 入口：parsePromptRequest / parseConfigWriteRequest / parseFileWriteRequest | 最多 8 张图片，单张 5 MiB、合计 7 MiB；revision/etag 用于冲突检查。解析不代替所有者授权。 | [packages/agent-protocol/src/validation.ts](../../packages/agent-protocol/src/validation.ts)；按模块测试核对，未宣称逐项覆盖 |
| WBP-03 单调事件序号与消息归约 | 用完整消息和事件序号建立可恢复的浏览器投影。 入口：events.ts | 先持久化再广播；增量是临时呈现，最终消息为权威结果。 | [packages/agent-protocol/src/events.ts](../../packages/agent-protocol/src/events.ts)；按模块测试核对，未宣称逐项覆盖 |
| WBP-04 终端屏幕与输入输出协议 | 描述终端尺寸、状态、屏幕和控制请求。 入口：terminal.ts | 协议支持不证明平台 PTY 已安装或宿主已授权。 | [packages/agent-protocol/src/terminal.ts](../../packages/agent-protocol/src/terminal.ts)；按模块测试核对，未宣称逐项覆盖 |

### 4.3 本地宿主与模块执行（20 项）

| 稳定编号 / 功能 | 作用与入口 | 条件及限制 | 源码依据 / 测试阅读线索 |
| --- | --- | --- | --- |
| WBS-01 回环 HTTP 服务装配与关闭 | 准备仓外数据根、锁、服务组件和请求收尾，提供同源静态资源。 入口：startServer(ServerOptions) / start:workbench | 只绑定 127.0.0.1 或 ::1；close 等待所拥有的工作收尾。Windows IPC 停机与强杀不同。 | [apps/agent-server/src/index.ts](../../apps/agent-server/src/index.ts)；测试：[apps/agent-web/tests/agent-native-settings-integration.test.mjs](../../apps/agent-web/tests/agent-native-settings-integration.test.mjs) |
| WBS-02 逐请求身份、工作区授权与来源检查 | 核验身份、会话所有者、工作区权限与 Host/Origin，记录最小审计。 入口：authenticate → route → authorizeWorkspace | configured 默认拒绝匿名业务 API；faux local-owner 仅开发用。Origin 防护不能代替认证。 | [apps/agent-server/src/audit.ts](../../apps/agent-server/src/audit.ts)；按模块测试核对，未宣称逐项覆盖 |
| WBS-03 会话、幂等请求与持久事件 | 保存工作区、消息、运行与事件序号，使断线后可回放。 入口：SessionStore / EventStreams | 同一 requestId 避免重复提交；重启将未结束运行标为中断，不自动重新调用模型。 | [apps/agent-server/src/events.ts](../../apps/agent-server/src/events.ts)；测试：[apps/agent-server/test/restore.test.ts](../../apps/agent-server/test/restore.test.ts) |
| WBS-04 每会话 worker 与 IPC 生命周期 | 隔离会话运行进程，转交 prompt、abort 和运行时操作，汇总事件。 入口：WorkerManager → worker-process → worker | 子进程使用白名单环境；进程分离不是 OS 沙箱。运行结束要考虑 agent_settled 与取消。 | [apps/agent-server/src/worker-messages.ts](../../apps/agent-server/src/worker-messages.ts)；测试：[apps/agent-server/test/fixtures/gated-worker.ts](../../apps/agent-server/test/fixtures/gated-worker.ts) |
| WBS-05 模型工具选择、会话树与导出 | 转交队列、模型/思考/工具选择、分支、压缩、上下文与 JSONL 导出。 入口：/api/sessions/:id/runtime/:action | 所有权检查先于运行；工具选择不可超过宿主允许集合，分叉会创建独立会话记录。 | [apps/agent-server/src/fork-session.ts](../../apps/agent-server/src/fork-session.ts)；按模块测试核对，未宣称逐项覆盖 |
| WBS-06 授权文件读写、搜索与 etag | 解析工作区相对路径，限制链接与越界读写并检测冲突。 入口：/api/workspaces/:id/files | etag 保证基于读取版本保存；路径保护不是任意 shell 的系统隔离。 | [apps/agent-server/src/files.ts](../../apps/agent-server/src/files.ts)；测试：[apps/agent-server/test/server.test.ts](../../apps/agent-server/test/server.test.ts) |
| WBS-07 三层模块配置与修订校验 | 持久化按主体隔离的 global/workspace/session 配置并解析继承。 入口：/api/config | PUT 替换 values；null 是值。选择保存版本或完整 revisionVector，过期运行结果不登记为当前生效。 | [apps/agent-server/src/config-fields.ts](../../apps/agent-server/src/config-fields.ts)；测试：[apps/agent-server/test/config-schema.test.ts](../../apps/agent-server/test/config-schema.test.ts) |
| WBS-08 原生 global/project 设置 | 把安全白名单设置交给原生设置读写与锁定路径。 入口：/api/settings | 独立于 /api/config；projectTrusted 由宿主给出，浏览器不能提升信任。null patch 删除当前覆盖。 | [apps/agent-server/src/native-settings-routes.ts](../../apps/agent-server/src/native-settings-routes.ts)；按模块测试核对，未宣称逐项覆盖 |
| WBS-09 Linux PTY / Windows ConPTY 与屏幕 | 管理显式创建的终端、屏幕、输入、resize、退出及拥有者断连清理。 入口：TerminalManager / windows-worker | Windows x64 使用校验过的 ConPTY 资源；默认关闭，不能把 cwd 当作权限沙箱。 | [apps/agent-server/src/terminal-routes.ts](../../apps/agent-server/src/terminal-routes.ts)；测试：[apps/agent-server/test/fixtures/windows-terminal-owner.ts](../../apps/agent-server/test/fixtures/windows-terminal-owner.ts) |
| WBS-10 模块能力发布、字段证据与操作门控 | 公开可用 operation、读取保存配置并标记字段消费与实测结果。 入口：/api/modules/capabilities / /api/modules/:module/:operation | supported 依赖宿主配置；发送、消费、行为观察和未验证分别记录，不能仅凭成功响应宣称全部参数有效。 | [apps/agent-server/src/module-routes.ts](../../apps/agent-server/src/module-routes.ts)；测试：[apps/agent-server/test/modules-ai-transport.test.ts](../../apps/agent-server/test/modules-ai-transport.test.ts) |
| WBS-11 AI 真实生成与边界实验 | 使用宿主固定模型生成；另用受控响应检查请求、传输、deferred、图像和分类协议。 入口：ai/generate；request-boundary；transport-boundary | 真实 generate 采用受控 SSE；工具声明只返回建议调用，不执行工具。fixture 结果不能当真实推理。 | [apps/agent-server/src/modules/ai-deferred.ts](../../apps/agent-server/src/modules/ai-deferred.ts)；测试：[apps/agent-server/test/modules-ai-transport.test.ts](../../apps/agent-server/test/modules-ai-transport.test.ts) |
| WBS-12 Agent 循环与真实单次执行 | 在本地 faux 或宿主模型上运行原生 Agent，处理工具、排队与取消。 入口：agent/tool-run；agent/live-run | live-run 不是持久聊天；工具是宿主允许的 read/write/edit 子集，write/edit 可真实改工作区。 | [apps/agent-server/src/modules/agent-live.ts](../../apps/agent-server/src/modules/agent-live.ts)；测试：[apps/agent-server/test/agent-tool-binding.test.ts](../../apps/agent-server/test/agent-tool-binding.test.ts) |
| WBS-13 Durable 持久任务、检查与显式恢复 | 按主体和工作区保存 JSONL，运行、只读检查、显式恢复提交，并演练调度/压缩/扩展。 入口：durable/live-run；live-inspect；live-resume | run 要求新的 operationId；inspect 不推理，resume 复用输入。写工具不默认 replay-safe；宿主额外授权的原生工具独立限制。 | [apps/agent-server/src/durable-storage.ts](../../apps/agent-server/src/durable-storage.ts)；测试：[apps/agent-server/test/modules-durable-policies.test.ts](../../apps/agent-server/test/modules-durable-policies.test.ts) |
| WBS-14 QuickJS 执行与确定性重放演练 | 运行有界脚本、局部 echo 工具与 store 快照，比较固定时钟和随机种子。 入口：codemode/execute；codemode/replay | 返回 storeWrites 不自动持久化；没有任意文件、网络或 shell 工具。 | [apps/agent-server/src/modules/codemode.ts](../../apps/agent-server/src/modules/codemode.ts)；按模块测试核对，未宣称逐项覆盖 |
| WBS-15 MCP 内存、stdio 与 HTTP 传输演练 | 通过实际 MCP SDK 验证初始化、请求关联、取消与受控传输行为。 入口：mcp/roundtrip；mcp/stdio；mcp/http | stdio 只运行固定 Node fixture，HTTP 注入 fetch；不能据此声称外部 OAuth 或服务连通。 | [apps/agent-server/src/modules/mcp-transports.ts](../../apps/agent-server/src/modules/mcp-transports.ts)；测试：[apps/agent-server/test/modules-mcp-transports.test.ts](../../apps/agent-server/test/modules-mcp-transports.test.ts) |
| WBS-16 Env 规划、协议演练与受控 daemon | 分开演示 SSH 规划、本地文件、协议对端，以及显式 provision 的真实 Linux daemon。 入口：env/connection-plan；runtime；live-runtime；local-file | live-runtime 才触达宿主授权 daemon；浏览器不能提供任意可执行命令、SSH 目标或挂载。 | [apps/agent-server/src/modules/env-identity.ts](../../apps/agent-server/src/modules/env-identity.ts)；测试：[apps/agent-server/test/modules-env-runtime.test.ts](../../apps/agent-server/test/modules-env-runtime.test.ts) |
| WBS-17 Chord 1.3 对象与复制状态演练 | 创建受控 host、契约、对象持有、状态复制与 JSON delta。 入口：chord/host；chord/delta | 局部 host 与进程内链路不代表远端身份或生产 WebSocket 验收；使用 1.3 state/resource API。 | [apps/agent-server/src/modules/chord-host.ts](../../apps/agent-server/src/modules/chord-host.ts)；测试：[apps/agent-server/test/modules-chord.test.ts](../../apps/agent-server/test/modules-chord.test.ts) |
| WBS-18 TUI 无头组件与内存遥测 | 验证文本宽度、嵌套滚动、组件渲染与真实内存 span/schema。 入口：tui/headless；overscroll；text；telemetry/span；schema | 无头终端与内存 span 不等于真实终端视觉或外部遥测 exporter 已验收。 | [apps/agent-server/src/modules/local.ts](../../apps/agent-server/src/modules/local.ts)；测试：[apps/agent-server/test/modules-chord.test.ts](../../apps/agent-server/test/modules-chord.test.ts) |
| WBS-19 评测计划、配对报告与显式 Docker 评测 | 解析选择、展开计划、校验报告，并在受信镜像与模型下发现或执行真实评测。 入口：evals/plan；report；selection；live-discover；live-evaluate | discover 不请求模型；evaluate 可产生真实用量，只允许宿主批准的镜像、文件与参数。缺失配对阻止总提升结论。 | [apps/agent-server/src/modules/evals-live.ts](../../apps/agent-server/src/modules/evals-live.ts)；按模块测试核对，未宣称逐项覆盖 |
| WBS-20 停机备份跨目录恢复 | 离线复制校验备份，重写受控会话路径及 Durable 命名空间。 入口：scripts/restore-workbench.mjs | 目标必须尚不存在，拒绝链接、重叠和仓内路径；不改消息内容，不恢复凭据，不自动续跑。 | [apps/agent-server/src/durable-storage.ts](../../apps/agent-server/src/durable-storage.ts)；测试：[apps/agent-server/test/restore.test.ts](../../apps/agent-server/test/restore.test.ts) |

### 4.4 原生会话适配（6 项）

| 稳定编号 / 功能 | 作用与入口 | 条件及限制 | 源码依据 / 测试阅读线索 |
| --- | --- | --- | --- |
| WBR-01 受控装配原生 AgentSession | 创建或恢复原生会话，把模型、设置、工具、扩展组合成 WorkbenchRuntime。 入口：createWorkbenchRuntime | cwd、agentDir、sessionDir 为授权绝对路径；默认不启用工具，不读取真实凭据存储。 | [packages/agent-runtime-adapter/src/index.ts](../../packages/agent-runtime-adapter/src/index.ts)；测试：[apps/agent-server/test/agent-tool-binding.test.ts](../../apps/agent-server/test/agent-tool-binding.test.ts) |
| WBR-02 固定模型运行时与请求来源限制 | 提供显式 faux 或宿主配置的模型，阻止替换身份及越权目标。 入口：configured model runtime / faux provider | allowedOrigins 与 redirect:error 限制请求；不回退到其他模型，未知费用保持 null。 | [packages/agent-runtime-adapter/src/models.ts](../../packages/agent-runtime-adapter/src/models.ts)；按模块测试核对，未宣称逐项覆盖 |
| WBR-03 运行操作、分叉、压缩与上下文投影 | 实现模型/工具切换、树导航、分叉、压缩、导出和上下文查询。 入口：WorkbenchRuntime 方法 | 分支投影不同于全历史；已有会话选择优先于新的默认设置。 | [packages/agent-runtime-adapter/src/operations.ts](../../packages/agent-runtime-adapter/src/operations.ts)；按模块测试核对，未宣称逐项覆盖 |
| WBR-04 原生事件到浏览器安全投影 | 转换消息、thinking、工具结果、费用、队列和结束事件。 入口：RuntimeEvent → worker IPC | message_end 为最终消息，agent_settled 才表示自动收尾结束；私有 sessionFile 不转发浏览器。 | [packages/agent-runtime-adapter/src/events.ts](../../packages/agent-runtime-adapter/src/events.ts)；测试：[packages/agent-runtime-adapter/test/workspace-tools.test.ts](../../packages/agent-runtime-adapter/test/workspace-tools.test.ts) |
| WBR-05 工作区文件工具与差异隔离 | 将原生 read/write/edit 限定在授权工作区并生成有界差异。 入口：createWorkspaceTools | allowedTools 是权限上限，tools 是激活子集；限制路径和容量不等于 OS 沙箱。 | [packages/agent-runtime-adapter/src/workspace-diff-worker.ts](../../packages/agent-runtime-adapter/src/workspace-diff-worker.ts)；测试：[packages/agent-runtime-adapter/test/workspace-diff.test.ts](../../packages/agent-runtime-adapter/test/workspace-diff.test.ts) |
| WBR-06 显式 MCP / codemode 扩展装配 | 按宿主选项注册内置扩展，连接工具发现、脚本编排和状态查询。 入口：WorkbenchExtensionsOptions | MCP 需要显式工厂与许可；local echo 仅 faux 测试，脚本能力仍受工具上限约束。 | [packages/agent-runtime-adapter/src/extensions.ts](../../packages/agent-runtime-adapter/src/extensions.ts)；按模块测试核对，未宣称逐项覆盖 |

表中测试是源码关联的阅读线索，不代表每个编号已有独立自动化测试，更不代表本次逐项运行过真实服务。完整源码、引用关系和测试索引可在 [离线导航](../doc-html/index.html) 按稳定编号查找。

## 5. 对 main 原生能力的修改

| 差异项 | main 基线 | 本分支行为 | 功能编号 | 实现与验证依据 |
| --- | --- | --- | --- | --- |
| CORE-01 重试状态码边界 | main 按错误文字判断可重试状态。 | 本分支限定 429/500/502/503/504/520/524 的独立数字边界，避免请求 ID 或模型名称包含数字就触发重试；保留主干的网关/暂时故障语义。 | MOD-19 | [packages/ai/src/utils/retry.ts](../../packages/ai/src/utils/retry.ts)；[packages/ai/test/retry.test.ts](../../packages/ai/test/retry.test.ts) |
| CORE-02 进度提交计时 | 主干已有 OutputBuffer、boundOutput、Progress 和可注入时钟，默认使用 Date.now。 | 默认改用 performance.now，并对等待时间向上取整；依据提交起点限频，不承诺可变存储延迟下通知间隔完全相等。 | CHR-39 | [packages/chord/src/output.ts](../../packages/chord/src/output.ts)；[packages/chord/test/output.test.ts](../../packages/chord/test/output.test.ts) |
| CORE-03 编辑工具差异计算 | 原生 edit 内部直接计算修改摘要。 | 新增异步 computeDiff 注入，工作台可用独立 worker 生成有界 diff；文件写入先于 diff，异常不表示修改撤销。 | TOOL-04 / WBR-05 | [packages/coding-agent/src/core/tools/edit.ts](../../packages/coding-agent/src/core/tools/edit.ts)；[packages/coding-agent/test/tools.test.ts](../../packages/coding-agent/test/tools.test.ts) |
| CORE-04 grep 相对 glob | rg 子进程可能继承宿主 cwd，相对 glob 与搜索根不一致。 | 显式使用搜索目录/目标文件父目录作为 cwd；新增 nested/*.txt 真实文件搜索回归和随机 token 评测。find 工具本身没有这一补丁。 | TOOL-06 | [packages/coding-agent/src/core/tools/grep.ts](../../packages/coding-agent/src/core/tools/grep.ts)；[packages/evals/evals/grep.docs.eval.ts](../../packages/evals/evals/grep.docs.eval.ts) |
| CORE-05 原生设置桥接 | 主干有 SettingsManager，无工作台专用公开白名单 API。 | 新增 readWorkbenchSettings / patchWorkbenchSettings；仅模型、推理、工具与 codemode 默认项；project 范围需信任，null 删除覆盖，锁内更新并保留其他字段，损坏层不能被静默覆盖。 | WBS-08 / WBW-08 | [packages/coding-agent/src/core/workbench-config.ts](../../packages/coding-agent/src/core/workbench-config.ts)；[packages/agent-runtime-adapter/test/config.test.ts](../../packages/agent-runtime-adapter/test/config.test.ts) |
| CORE-06 Durable 命令树终止 | 主干 NodeExecutionEnv 直接管理命令进程。 | Windows 引入 IPC supervisor，宿主断开也触发清理；按所有权终止 taskkill/MSYS 子树。abort、timeout、cleanup 等待收尾，保留实际子进程结果；POSIX 仍使用进程组路径。 | DUR-12 | [packages/durable/src/env/node.ts](../../packages/durable/src/env/node.ts)；[packages/durable/test/env-node-conformance.test.ts](../../packages/durable/test/env-node-conformance.test.ts) |
| CORE-07 文件修改队列公开 | Durable 内部已有文件修改队列辅助函数。 | 从 durable/tools 导出 withFileMutationQueue，供工作台工具包装复用；不是新造一套存储事务。 | TOOL-15 | [packages/durable/src/tools/index.ts](../../packages/durable/src/tools/index.ts)；[packages/agent-runtime-adapter/test/workspace-tools.test.ts](../../packages/agent-runtime-adapter/test/workspace-tools.test.ts) |
| CORE-08 Env 传输环境 | 连接进程默认继承宿主环境。 | 新增 ConnectionOptions.env 明确替换环境，省略仍继承；Windows 隐藏窗口。筛选环境不等于隔离文件/网络权限。 | ENV-19 | [packages/env/src/connection.ts](../../packages/env/src/connection.ts)；[apps/agent-server/test/modules-env-runtime.test.ts](../../apps/agent-server/test/modules-env-runtime.test.ts) |
| CORE-09 嵌套滚动 contain | 在 contain 时仅退出局部循环，剩余滚动量仍可能进入主滚动兜底。 | 将剩余滚动量消耗为零，阻止隔离区域到边界后带动主区。 | TUI-06 | [packages/tui/src/tui-alt-screen.ts](../../packages/tui/src/tui-alt-screen.ts)；[packages/tui/test/tui-overscroll.test.ts](../../packages/tui/test/tui-overscroll.test.ts) |
| CORE-10 Evals 集成与评测可信度 | 原评测 CLI 和执行链为宿主使用形态；TUI oracle 只改 agent 内存状态。 | 抽出纯参数解析并发布 /workbench 窄入口。TUI oracle 写入 SessionManager 并验证投影用量，补齐 Terminal.setProgramStatus；增加 grep token 评测。 | EV-04 / EV-06 / EV-08 / WBS-19 | [packages/evals/src/workbench.ts](../../packages/evals/src/workbench.ts)；[packages/evals/evals/tui.docs.eval.ts](../../packages/evals/evals/tui.docs.eval.ts) |

补充：AI 的 openai-completions-tool-choice 测试改用显式模型 fixture，避免依赖已变更的目录模型；它不新增生产 API。Evals 的 custom-provider、models、openai-provider 三份评测及 Docker entrypoint 的若干变更是 import 排序/格式调整；TUI 评测则包含上表所述真实 oracle 修正，不能全部归为格式变化。

## 6. 构建、部署、依赖与验证工具

| 项目 | 具体变化 | 用途 / 边界 | 依据 |
| --- | --- | --- | --- |
| workspace 与构建 | 注册 4 个 @pi-workbench 私有工作区；build 与 build:offline 加入 protocol → runtime-adapter → server → web。 | 保留核心构建，再产生前端、宿主、worker 和资源；根配置补充 apps 类型/格式覆盖。 | [package.json](../../package.json) |
| 服务入口与恢复 | 新增 start:workbench、源码 loader、restore-workbench。 | 回环 HTTP 默认端口 4317；faux 为开发演练。恢复需离线、目标不存在、仓外数据根，不恢复凭据或自动重跑模型。 | [deploy/WORKBENCH.md](../../deploy/WORKBENCH.md) |
| Windows 终端 | ConPTY 资源、manifest、NOTICE、完整性准备与发布门禁。 | Windows x64 的 node-pty / ConPTY 与 Linux PTY；默认关闭。原生资源不是任意平台都可直接复用。 | [apps/agent-server/native/conpty/README.md](../../apps/agent-server/native/conpty/README.md) |
| 直接依赖 | 新增 node-pty 1.1.0、xterm 浏览器/Unicode 包；服务端使用 headless 5.5.0；根新增 proper-lockfile 4.1.2 与固定 forge tarball。 | 下方锁文件表只展示版本或来源确有变化的 node_modules 条目；已有依赖的 workspace 引用不都算新增安装。 | [package-lock.json](../../package-lock.json) |
| forge 回移 | node-forge 版本仍为 1.4.0，来源变为 vendor 固定 tarball，记录 piPatch 和 59 文件指纹。 | 回移嵌套 DigestAlgorithm 数量校验；root override 也用于 Gondolin，独立安装示例不继承它。不宣称全部漏洞清零。 | [vendor/node-forge/README.md](../../vendor/node-forge/README.md) |
| Docker 评测工具 | node:24-bookworm-slim；fd 10.3.0 固定架构归档和校验值，ripgrep 13.0.0-4+b2；允许特定覆盖 catalog 进入镜像。 | 预置工具避免 grep/find 运行时下载，解决旧 fd 参数能力差异；真实 Docker/模型评测需单独授权环境。 | [packages/evals/docker/Dockerfile](../../packages/evals/docker/Dockerfile) |
| 工程检查 | 根 check 增加 forge 与 workbench 检查；Windows 入口图路径统一正斜杠；限定工作台测试使用环境白名单。 | 增加类型、配置、原生资源和副作用边界检查；不能用 fixture 通过替代浏览器视觉或外部服务验收。 | [scripts/check-workbench.mjs](../../scripts/check-workbench.mjs) |
| 模型数据 | 新增 43 个 JSON：manifest 加 42 个 provider 数据快照。 | 用于固定模型目录与离线构建；模型目录生成源码和 models.generated.ts 未因此变成分支新增实现，也不是新增 43 家提供商。 | [packages/ai/src/providers/data/.manifest.json](../../packages/ai/src/providers/data/.manifest.json) |
| 文档与交付记录 | 新增部署指南、离线 HTML、历史架构图/课件、工作台覆盖报告和大量验证记录。 | 历史快照记录过去的检查；旧截图/导出文件不代表当前产品界面或所有功能均已验收。 | [docs/workbench/MAIN-INTEGRATION.md](../../docs/workbench/MAIN-INTEGRATION.md) |

### 锁文件中新增或改变来源的安装条目

| 安装路径 | main 版本 | 当前版本 | 说明 |
| --- | --- | --- | --- |
| node_modules/@pi-workbench/protocol | 无 | workspace link | 本地 workspace 符号链接 |
| node_modules/@pi-workbench/runtime-adapter | 无 | workspace link | 本地 workspace 符号链接 |
| node_modules/@pi-workbench/server | 无 | workspace link | 本地 workspace 符号链接 |
| node_modules/@pi-workbench/web | 无 | workspace link | 本地 workspace 符号链接 |
| node_modules/@xterm/addon-unicode-graphemes | 无 | 0.4.0 | 版本/来源变化 |
| node_modules/@xterm/addon-unicode11 | 无 | 0.8.0 | 版本/来源变化 |
| node_modules/@xterm/xterm | 无 | 5.5.0 | 版本/来源变化 |
| node_modules/node-forge | 1.4.0 | 1.4.0 | 固定本地 tarball |
| node_modules/node-pty | 无 | 1.1.0 | 版本/来源变化 |

## 7. 哪些不是该分支新实现

- main 不是落后于当前分支所用主干的旧祖先副本：其全部提交都已包含。本报告没有 fetch，不能据此声称已跟踪远端今天的最新代码。
- Chord 1.3 的 Ref、codeVersion、self.state/resource/on/task、异步 get 与水合；Chord SQLite；Durable 持久睡眠/崩溃保护/动态设置；AI 显式遥测等均来自已包含的 main 源码。清单补写它们是修正文档遗漏，不是分支增加这些实现。
- packages/agent、codemode、mcp、telemetry 的文件在两个快照间没有差异；新增工作台 operation 调用它们，不代表这些包的引擎被改写。
- 删除的旧 packages/client/server/protocol 等实验栈没有由本分支恢复；新的 agent-protocol、agent-runtime-adapter 和 apps 是不同目录和入口。
- CLI 的会话、模型、MCP、codemode 与库能力仍由原包提供；工作台将部分能力接入浏览器，并加宿主授权和状态管理，不能把表单字段全部写成可真实运行的功能。

## 8. 全部 34 个修改文件的审阅索引

| 文件 | 变更说明 |
| --- | --- |
| [.gitattributes](../../.gitattributes) | 保留历史验证资产、原生资源许可与补丁的字节形式。 |
| [.gitignore](../../.gitignore) | 允许跟踪工作台覆盖数据。 |
| [biome.json](../../biome.json) | 扩展工作台和评测相关静态检查范围。 |
| [package-lock.json](../../package-lock.json) | 工作区、终端依赖及 forge 本地来源，见第 6 节。 |
| [package.json](../../package.json) | 4 个工作区及构建、检查、运行脚本与依赖。 |
| [packages/ai/src/utils/retry.ts](../../packages/ai/src/utils/retry.ts) | CORE-01 重试状态码边界 |
| [packages/ai/test/openai-completions-tool-choice.test.ts](../../packages/ai/test/openai-completions-tool-choice.test.ts) | 固定本地测试模型 fixture，减少目录漂移。 |
| [packages/ai/test/retry.test.ts](../../packages/ai/test/retry.test.ts) | CORE-01 定向验证依据。 |
| [packages/chord/src/output.ts](../../packages/chord/src/output.ts) | CORE-02 进度提交计时 |
| [packages/chord/test/output.test.ts](../../packages/chord/test/output.test.ts) | CORE-02 定向验证依据。 |
| [packages/coding-agent/src/core/tools/edit.ts](../../packages/coding-agent/src/core/tools/edit.ts) | CORE-03 编辑工具差异计算 |
| [packages/coding-agent/src/core/tools/grep.ts](../../packages/coding-agent/src/core/tools/grep.ts) | CORE-04 grep 相对 glob |
| [packages/coding-agent/src/index.ts](../../packages/coding-agent/src/index.ts) | 导出原生工作台设置接口和类型。 |
| [packages/coding-agent/test/tools.test.ts](../../packages/coding-agent/test/tools.test.ts) | CORE-03/04：编辑及 grep 工具回归。 |
| [packages/durable/src/env/node.ts](../../packages/durable/src/env/node.ts) | CORE-06 Durable 命令树终止 |
| [packages/durable/src/tools/index.ts](../../packages/durable/src/tools/index.ts) | CORE-07 文件修改队列公开 |
| [packages/durable/test/env-node-conformance.test.ts](../../packages/durable/test/env-node-conformance.test.ts) | CORE-06 定向验证依据。 |
| [packages/env/README.md](../../packages/env/README.md) | 记录 ConnectionOptions.env。 |
| [packages/env/src/connection.ts](../../packages/env/src/connection.ts) | CORE-08 Env 传输环境 |
| [packages/evals/README.md](../../packages/evals/README.md) | 说明工作台纯入口与参数解析。 |
| [packages/evals/docker/Dockerfile](../../packages/evals/docker/Dockerfile) | 固定 Bookworm、fd、ripgrep。 |
| [packages/evals/docker/Dockerfile.dockerignore](../../packages/evals/docker/Dockerfile.dockerignore) | 允许指定覆盖 catalog 进入镜像。 |
| [packages/evals/docker/entrypoint.ts](../../packages/evals/docker/entrypoint.ts) | 主要为 import 排序和格式。 |
| [packages/evals/evals/custom-provider.docs.eval.ts](../../packages/evals/evals/custom-provider.docs.eval.ts) | import 排序，无新增场景。 |
| [packages/evals/evals/models.docs.eval.ts](../../packages/evals/evals/models.docs.eval.ts) | import/类型排序，无新增场景。 |
| [packages/evals/evals/openai-provider.docs.eval.ts](../../packages/evals/evals/openai-provider.docs.eval.ts) | import 排序，无新增场景。 |
| [packages/evals/evals/tui.docs.eval.ts](../../packages/evals/evals/tui.docs.eval.ts) | Terminal 契约与基于持久会话的上下文 oracle 修复。 |
| [packages/evals/package.json](../../packages/evals/package.json) | 新增 /workbench 导出。 |
| [packages/evals/src/cli.ts](../../packages/evals/src/cli.ts) | 复用提取的 CLI 参数解析。 |
| [packages/evals/tsconfig.json](../../packages/evals/tsconfig.json) | 补充评测及 highlight.js 类型声明检查。 |
| [packages/evals/vitest.evals.config.ts](../../packages/evals/vitest.evals.config.ts) | 格式与类型检查对齐。 |
| [packages/tui/src/tui-alt-screen.ts](../../packages/tui/src/tui-alt-screen.ts) | CORE-09 嵌套滚动 contain |
| [scripts/check-entry-graphs.mjs](../../scripts/check-entry-graphs.mjs) | Windows 反斜杠规范化，统一入口预算比较。 |
| [tsconfig.json](../../tsconfig.json) | 工作台/评测 TypeScript 检查范围。 |

## 9. 本次验证与阅读限制

本次为文档与离线索引维护，未改变业务源码、依赖、锁文件或运行中服务。

- 固定快照校验：CSV 的 1816 行与 Git name-status 逐项一致，全部 34 个修改文件都有中文说明；Markdown 本地链接及 122 处来源定义有效。
- 编号校验：原 587 个编号和模块归属保留；当前 640 项、23 模块、22 项边界；634 项关联源码，6 项保留为文档方案。
- 离线生成通过：425 个源码专题与索引、1274 个归属文件、6998 条历史、2213 份源码/文档快照。45 条学习路线、182 步、270 个 HTML 讲解页覆盖全部 640 个编号；旧 PPTX 继续标记过期，未冒充更新。
- 九个导览测试文件共 64 项通过，0 失败、0 跳过。覆盖稳定编号、工作台路线、源码/测试反向关联、目录、引用图、菜单位置、版本与生成快照。
- `npm.cmd run check` 完整通过：根检查、固定依赖、forge 指纹、运行依赖、相对导入、入口图、安装锁、类型、browser-smoke，以及四个工作台工作区检查。检查未改写业务文件。
- `git diff --check` 通过。文档保留在工作区，本次未提交。

历史 MAIN-INTEGRATION.md 的整合测试与之前的 build:offline 成功属于既有证据；本次不把它们计作重新执行，也未重跑真实模型、外部 MCP、SSH daemon、Docker 或真实浏览器视觉验收。

## 10. 如何复核与下次更新

以下为本次固定快照的只读 Git 命令；下次升级应重新解析 main 和 HEAD，生成新的文件表与功能说明，不能只改日期。PowerShell 可直接执行：

```powershell
git merge-base --is-ancestor d2e7d8b7c1d31d3661f769d5caef7ba8d50c3e03 bfd39aeeb0d53b4c8b6e5a60fdf82f2c850348f5
git rev-list --left-right --count d2e7d8b7c1d31d3661f769d5caef7ba8d50c3e03...bfd39aeeb0d53b4c8b6e5a60fdf82f2c850348f5
git diff --no-renames --name-status d2e7d8b7c1d31d3661f769d5caef7ba8d50c3e03 bfd39aeeb0d53b4c8b6e5a60fdf82f2c850348f5
git diff d2e7d8b7c1d31d3661f769d5caef7ba8d50c3e03 bfd39aeeb0d53b4c8b6e5a60fdf82f2c850348f5 -- packages/coding-agent/src/core/tools/grep.ts
```

维护原则：保留稳定编号；新增功能追加编号与显式映射；更改描述需同时核对公开入口、实现、调用者与测试。新增文档/截图/模型记录只计入文件差异，不能自动转换成运行功能。
