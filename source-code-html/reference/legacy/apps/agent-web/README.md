> 历史资料：来自随附 workbench-dev / bfd39aee / 2026-10-20 导览。当前 checkout 无此路径；内容不能作为当前接口。

# Pi Workbench · R07

## 同仓库迁移

当前应用位于 `apps/agent-web`，包名 `@pi-workbench/web`。原 `web-workbench-design` 保留不变。一期草稿保留；新增 coding-agent 工作台通过同源 `/api` 接入原生宿主，实际能力和权限由宿主配置决定。无宿主时显示离线状态。

在此目录运行 `npm run check`、`npm run lint`，以及 `node tests/<name>.test.mjs` 定向测试。依赖由仓库根目录统一管理，安装遵守根 `AGENTS.md`。六个测试入口为 `workbench`、`i18n`、`config-effectiveness`、`select`、`workspace-state`、`workspace-interactions`。源码路径验证必须找到本仓库 `packages`，不再静默跳过。

迁移与验收记录见 `WORKLOG.md`。下文为保留的一期功能与历史验证说明；不代表新增后端或真实浏览器验证。

## 原生 Coding-agent 设置

「设置」入口中的独立原生设置区域使用 `GET /api/settings?scope=global|project&workspaceId=...` 与 revision 检查的 `PUT /api/settings`。它与一期十模块 `/api/config`、浏览器 fields/document 草稿相互独立。只提供非秘密白名单：默认模型提供方/模型、思考等级、工具名称、Codemode mode/inlineBudget；勾选继承删除当前范围的覆盖值。

宿主必须显式启用 native settings；项目范围还必须得到宿主的 project trust 授权。浏览器不能授予信任、添加凭据或扩大 allowedModels/allowedTools。全局设置位于该主体的 native agentDir，项目设置位于已授权工作目录的 `.pi/settings.json`。

保存只影响下一次运行时创建。当前已打开会话不会被悄然修改或重载；已有会话保存的模型、思考和工具选择，以及宿主显式选项，仍可能覆盖这些默认值。页面展示保存修订、解析值与来源，不把保存成功称为当前运行已生效。409 冲突必须重新读取后编辑；无宿主、未启用或不可信项目不可保存。

定向验证：`node tests/agent-native-settings.test.mjs`（前端事件/HTTP契约），实际 native settings 持久化和下次运行消费由宿主/适配器测试单独验证。真实浏览器和外部付费模型仍未在当前环境验收。

## 以下为迁移前一期历史说明

R01 B 深色开发工作台的组件化实现。固定源码版本：`7d75a0e3eb273dff753d49c066ea29fbe7b3b6f6`。

## 范围与运行边界

涵盖除 `packages/coding-agent` 外的全部 **10 个包的 UI 配置/检查入口**：AI、Agent core、Durable、MCP、Codemode、Env、Chord、Telemetry、TUI 和私有 Evals。共有 **129 项源码能力索引、31 个配置分组、153 个字段**。

**这不是 129 项 Pi runtime 全部接通。** 此版本是静态浏览器前端，没有应用服务端、模型调用、持久化 Harness、MCP 会话、SSH、终端、QuickJS/WASM 执行或评测 runner。源码索引覆盖与运行功能实现是两种不同状态。

所有包页面提供真实可编辑的配置草稿和源码链接。包字段是分组的配置片段；回调、运行时句柄、凭据及授权需未来宿主适配器补齐。导出是带格式版本与源码版本的 `pi-workbench-draft` 文档，不是可直接传给任一 Pi SDK 的完整配置。

- 不依赖、不导入、不执行 `coding-agent`。Durable 自己的扩展、设置、工具、Codemode 独立在范围内。
- Evals 因依赖排除的 coding-agent，只提供配置与示例报告检查入口。
- Codemode 是 QuickJS 能力限制运行时，不代表 OS 级隔离。此版本不会执行其源码草稿。
- 没有伪造连接、模型响应、执行进度、token 消耗、持久化提交或测量数据。示例都有标签。
- 无密钥输入专用表单；不要在任意自由文本框内输入凭据或私人数据。已知敏感字段和原型污染键在 JSON 解析时拒绝，但这不是通用秘密检测器。

## 已实现的浏览器交互

| 包 | 本地实现 | 未接入 / 示例边界 |
|---|---|---|
| AI | 固定源码 1,544 条聊天模型目录、提供商/搜索/模型选择、模型输出上限校验、无推理模型禁用 reasoning、基础/高级字段、上下文 JSON、配置快照 | 网络刷新、auth、流式/完整响应、图像生成、分类、deferred、真实工具与用量需宿主 |
| Agent core | 配置、上下文/工具 JSON、逐项事件检查 | 时间线为示例；不启动代理循环、队列或 hook |
| Durable | conversation/settings/tools 配置、示例任务状态筛选、任务关系表 | storage、提交/恢复、fork/reset/compaction、watch/task graph、独立扩展与工具需适配器 |
| MCP | transport/client 配置、tools/resources/ping JSON-RPC 方法检查器 | 协商、请求、进度、分页、OAuth、stdio/HTTP 会话未连接；不宣称支持未实现的 prompts API |
| Codemode | 限额/store/replay/tool声明/源码编辑、文本级 @options 与 tools 引用检查 | 不执行脚本；文本检查不是 JS parser 或权限验证 |
| Env | SSH/daemon/PTY 配置、连接目标预览与信任清单 | 不接受主机密钥、不部署 daemon、不连接 SSH、不执行命令 |
| Chord | 合同/host/state/link 配置、顶层 JSON 状态差异 helper | 差异 helper 不是 Chord wire delta 编码器；host/RPC/复制/reload 未接入 |
| Telemetry | context/schema 配置、span 示例结构构建/清空 | 没有真实 span 采集或 exporter；示例不含伪造测量 |
| TUI | renderer/viewport 配置、8 种浏览器文字组件示意 | 完整组件能力列于源码索引；示意不是真实终端 renderer |
| Evals | plan/report 配置、成对文档提升示例报告 | 运行禁用：依赖 coding-agent、模型及容器 |

公共交互：10 页路由、键盘导航 tabs、能力搜索、固定版本源码链接、逐页草稿保留、未应用 JSON 编辑文本保留、作用域重置、完整草稿导入/导出。

内存草稿跨页面保留，**刷新页面会丢失**；仅界面语言偏好可保存在 localStorage；没有草稿、编辑文本或凭据的持久化，没有 IndexedDB、cookie 或远程存储。导入必须符合源码版本和全部包字段，先完整验证再原子替换；256 KiB 大小限制、32 层 JSON 深度限制、已知凭据/原型污染键拦截、字段类型/枚举/数值/嵌套 JSON 语法校验。JSON 对象编辑器只校验语法与安全形状，不声称通过 SDK 运行时语义验证。

## 中英文界面与配置生效检查

- 全新访问默认简体中文；左侧栏底部可切换 English，只有语言偏好会尝试本地保存。存储不可用时仍能切换。
- 集中、类型化的中英文文案覆盖十个包的导航、能力说明、字段帮助、状态、弹窗及校验信息；API 标识符、模型名和导出内容不翻译。
- 语言切换只更新文本与无障碍属性，不重新渲染页面，所以路由、选中页签、表单值、未应用 JSON 文本和示例工具状态不丢失。
- 字段与独立 JSON 文档不会自动互相覆盖。快照展示兼容性提示；导出前完整校验，避免生成无法重新导入的文件。
- 已逐字段检查 153 项本地编辑/导出/导入链路；这不表示模型、MCP、SSH 或 SDK 运行时已接通。详细检查见 `docs/config-effectiveness.json`。

## 多页签工作区（R06）

- 左侧 10 个包菜单打开独立页签；再次选择只激活，不会重复打开。同一页的内部「配置 / 源码能力」选择、表单、未应用 JSON、示例工具输入在切换、关闭后重开时保留。
- 每个页签可单独关闭；保留关闭 × 按钮，移除 ⋯ 按钮；右键、ContextMenu 键或 Shift+F10 打开「关闭页签 / 关闭其他 / 全部关闭」。关闭其他以操作的页签为目标。关闭当前页时优先选择右邻，再选左邻；全部关闭后显示空白工作区，可用左侧菜单重新打开。
- R07 按批注将右键菜单相邻选项间隔设为 5px。
- ArrowLeft / ArrowRight、Home / End 切换工作区页签，Delete 关闭当前页签。菜单可用方向键、Home / End、Escape / Tab；点外部、焦点离开或滚动会关闭菜单。
- 关闭操作只改变页签，不删除配置。逐页显式重置只重建该页；导入成功使所有缓存页重新读取导入数据。草稿仍仅在内存中，刷新会丢失。
- URL 只用 replaceState 同步当前页签，不堆积历史。启动时接受包深链接；启动后的 hash / 浏览器前进后退仅激活仍打开的页签，不会复活已关闭页签。全部关闭为 #/workspace；刷新此地址保持空工作区。
- R07 移除顶部产品栏，工作台从视口顶部开始；全局语言选择移至左侧栏底部，保留浏览器草稿提示，源码快照移至 Pi 工作区版本区域。窄屏侧栏底部仍保留语言切换。右侧 280px 预留工作区可折叠成窄栏；1200px 及以下默认收起，展开为非模态浮层，不挤压正文；Escape 可收起。这里只是预留位置，没有伪装成可用的工具或服务。
- 已查看用户本轮红字批注原图后实现。真实浏览器视觉、指针和辅助技术 QA 仍未完成；结构 / 事件模拟测试不是截图或真浏览器验证。

## 组件架构

- `src/app/`：bootstrap、启动深链接与工作区 URL 同步、页面注册表
- `src/layout/`：Shell、Sidebar、TabBar、TabContextMenu、WorkspacePanel、侧栏语言控件
- `src/components/`：DOM、安全文本、Button、Panel、Tabs、Field、JsonEditor、Table、Snapshot、Capabilities、ImportDialog
- `src/features/<package>/`：10 个独立页面；模型、参数、上下文、timeline、协议、task graph、diff、span、terminal 等独立组件
- `src/state/`：内存草稿 store、未应用编辑文本与独立页签状态管理器
- `src/services/`：JSON/字段/导入导出验证与固定源码 URL
- `src/data/catalog/`：每包独立能力和字段数据；没有大分派函数
- `src/i18n/`：集中双语文案、类型安全翻译、非破坏性 DOM 文本绑定
- `src/types/`：共享类型
- `src/styles/`：token、layout、component、feature 样式；CSS 独立打包
- `src/models.json`：从固定源码 `packages/ai/src/models.generated.ts` 静态提取的模型数据，不代表当前在线供应情况
- `tests/`：Node 逻辑测试及轻量 mocked DOM 测试，无测试依赖新增

主入口只负责启动；页面注册与渲染、状态、数据、事件处理分离。业务 TypeScript 组件保持小模块；双语文案分块管理，模型目录为生成数据。

## 开发

要求 Node >=22.19.0，ESM。依赖版本锁定在 package.json：TypeScript 7.0.2、esbuild 0.28.2、Biome 2.3.5。

```sh
npm install
npm run check
npm run lint
npm test
npm run build
```

静态产物位于 `dist/`，通过任意本地静态 HTTP 服务器预览。无需运行 Pi 源码 checkout；源码路径存在性检查仅在其相邻 checkout 可用时执行。

## 验证记录与限制

- TypeScript 类型检查通过
- esbuild JS/CSS 构建通过
- Biome 格式与推荐 lint 检查通过
- Node 导入/导出、路由、状态、模型、边界与 mocked DOM 测试见 `npm test`
- 所有 129 项能力的源码文件存在性已对固定 Pi checkout 检查
- 已读取用户提供的 R01 B 截图像素后实现，不采用 R02 布局
- **真实浏览器视觉/交互 QA 未完成**：此执行环境 Chromium 启动被 OS socket 权限限制；mocked DOM 测试不是视觉或浏览器测试。发布平台截图由发布流程另行检查，不伪造截图
- Pi SDK、网络、终端、SSH、持久化 runtime、模型、OAuth 和后端集成测试均未运行

详细源码功能审计见 `docs/source-audit.md`；精确 UI 能力状态见 `docs/implementation-coverage.md`。
