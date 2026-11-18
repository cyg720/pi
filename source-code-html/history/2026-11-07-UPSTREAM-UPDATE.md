# 2026-11-07 上游合并更新说明

本次核对的是本地已经合并的代码，不是对远端当前状态的查询。

| 项目 | 已核实值 |
| --- | --- |
| 分支及合并提交 | LG-Workbench / cf43eea7e741ae899ad4609233084c43ec5274f9 |
| 合并前本地父提交 | e49e3d5e871f83bc9ad164a5e6255d3e628c57bb |
| 合入上游父提交 | 085c84e98e7f4c950f2be606466fff4f75d8fe7c |
| 新增上游可达提交 | 526，按 HEAD^1..HEAD^2 计算，含上游合并与文档提交 |
| 合并净变更 | 2,974 文件，新增 427,720 行、删除 37,583 行 |
| 核心包 | 12 个一级 packages 包，版本 1.5.0 |
| 新应用 | apps/p2，版本 0.0.1 |
| 版本边界 | 1.5.0 发布日志日期 2026-11-02；本次还包含其后的 Unreleased |

上述行数包括文档、测试、生成内容和新增应用，不是纯业务代码量。PRD、prototype 和项目记忆已在合并前提交，不计为此次上游功能。

## 主要变化

### 1. 新增 p2 实验应用

新增基于 Chord v2 插件和 Durable 的自托管 Web/TUI 应用，包含项目与会话树、分支、模型连接、MCP OAuth、文件与产物、远程环境、终端、子智能体和 code mode 编排。工具执行与工具 UI 由对应插件提供。

上游 README 明确 p2 是将被替换的实验原型，API 和数据格式可能变化，不建议依赖它构建正式系统。它与本分支的 `prototype/`、PRD 和旧 WBW/WBP/WBS/WBR 工作台不是同一实现。本次不迁移或改写产品需求，也不启动 p2。

服务端要求 Node >=22.19；TUI launcher 要求 Node >=26.5.1。`P2_FAKE` 只替换模型，工具仍能操作真实文件。

依据：[p2 README](../apps/p2/README.md)、[工具界面](../apps/p2/docs/tool-ui.md)、[工作流](../apps/p2/docs/workflows.md)。

### 2. Chord v2 替换旧对象运行时

契约、Host、对象激活、持久文档、job、注册表、远程路由及插件系统按层重构。新增 HTTP、worker、插件、app kit、Web/React/TUI surfaces，以及实验性 store 复制。

远程对象以 `hostAddress` 定位；工厂只声明、Host 激活。状态使用 `defineState`、`self.state` 与 `self.tx`；原生资源由 `self.open` 管理。插件重载重启受影响对象，旧调用沿旧代码收尾；worker 基础代码来自 server 启动时快照。旧 `contract.ts`、`host.ts` 等顶层路径和 cell 迁移教程不能直接使用。

依据：[Chord README](../packages/chord/README.md)、[Host](../packages/chord/src/host/README.md)、[插件与宿主教程](../packages/chord/docs/guide-plugins-hosts/book.md)。

### 3. 新增 pi-schema，并迁移工具参数校验

新增无 eval 的 JSON Schema 构造器、闭包编译校验、错误路径与可选转换。AI、Durable 等使用它校验工具参数。AI 根入口不再导出 TypeBox；普通 SDK 调用者需迁移导入。CLI 扩展加载器仍提供其文档注明的 TypeBox 兼容导入，不能把这项兼容推到所有入口。

原 TypeBox 自定义 refinement、codec 和格式注册不等于 JSON Schema 支持。合入 HEAD 的 Unreleased 又补齐 BigInt/Undefined 转换，因此阅读时必须同时看 1.5.0 与 Unreleased，不能只照搬发布日志中的早期限制。

依据：[Schema README](../packages/schema/README.md)、[AI 变更日志](../packages/ai/CHANGELOG.md)、[扩展文档](../packages/coding-agent/docs/extensions.md)。

### 4. Durable 的提交、观察和恢复有破坏性变更

- `Storage.commit(batches, receive, context)` 替代旧单提交接口；逐批次返回耐久回执，区分业务拒绝与存储结果未知。自定义存储适配器必须迁移。
- 分组提交减少存储往返；流式 partial 可先显示再落盘，默认 `progress.persistWithinMs` 为 1000ms。可见状态不再保证已经落盘。
- `watchEvents()` 移除。使用 `Conversation.watch()`、`ConversationTranscript` 和 `entries()` 显示历史，用 `context()` 读取模型活动上下文。默认窗口从最新 50 条开始，超过 100 条收缩。
- Watch 监听和结束原因改为 `kind` 标签；文档退休是通知字段，地址观察可继续等待新文档。`subscribeCommits` 改为 `observeCommits`。
- 达到 `restartLimit` 后任务结束并显示失败，不再停放等待 `retryTask()`；该接口已移除。中断模型请求计入重试，外部工具副作用仍需核对。
- 增加 continue、turnLimit、whenIdle、事务内 submit、afterRun 任务、Tx.submission 和逐会话压缩设置。回答已提交不代表 afterRun 子任务已经结束。

依据：[Durable 变更日志](../packages/durable/CHANGELOG.md)、[分组提交](../packages/durable/docs/group-commit.md)、[存储类型](../packages/durable/src/types.ts)。

### 5. 模型目录与请求处理

模型目录从 `scripts/generate-models.ts` 迁到 `packages/ai/catalog/`，按 sources、providers、families 组织；接入 models.dev v2 并调整模型数据、能力和默认选择。增加增量 JSON/工具参数解析，减少长输出的重复解析与内存占用。

Unreleased 包含 Anthropic message threads、懒加载 OAuth/Bedrock 入口、OpenRouter 输出预算和 Azure 上下文窗口修正。OpenAI Completions 在只有历史工具调用时不再默认发送空 tools 数组；依赖旧行为的网关需配置 `compat.requiresToolsWithToolHistory`。

依据：[模型目录维护](../packages/ai/catalog/README.md)、[AI 变更日志](../packages/ai/CHANGELOG.md)。

### 6. CLI、工具、终端和远程环境

CLI 增加 `pi auth login/logout`、扩展更新日志、自定义自更新命令与新的工具 UI 状态能力。read 改为流式读文件，grep 由 rg 提供上下文，edit 保留未修改行的换行格式并在写入前计算局部 diff。修复模板单引号、Unicode 截断、退出时 OAuth 刷新保存、叠加层清理、分支 thinking level 和全屏 Kitty 图像问题。MCP 回调关闭会清理剩余连接；Env 修复宿主失联时 Stop/timeout 不能及时结束远程调用。

依据：[CLI 变更日志](../packages/coding-agent/CHANGELOG.md)、[MCP 日志](../packages/mcp/CHANGELOG.md)、[Env 日志](../packages/env/CHANGELOG.md)、[TUI 日志](../packages/tui/CHANGELOG.md)。

## 对本地计划的影响

既有 PRD 仍是需求记录，不能据本次合并认定其中任务已经完成。实施前至少复核 Durable 存储适配、视图/历史、任务失败与提交核对方案，以及是否复用 Chord v2 的现成基础设施。p2 可以作为源码参考，但其官方实验边界必须保留。

本说明是主要变化与迁移重点，不是 526 个提交的逐项审计。完整提交和改动文件见导览 Git 时间线；本轮验证范围见 [VALIDATION.md](VALIDATION.md)。
