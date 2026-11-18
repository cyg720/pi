# 2026-11-18 main 合并更新

`LG-Workbench` 的合并提交为 `dbc6ee9c5`。第一父提交为 `6a3a30122`，第二父提交为 `05fd3fbda`。从 origin 刷新 main 后，远端与本地 main 一致。按 `git rev-list --count 6a3a30122..05fd3fbda` 核对，共纳入 **437 个提交**，不含本地合并提交。净改动 1,493 个文件，新增 176,144 行、删除 13,594 行，包含源码、测试、生成内容和设计文档。

12 个一级包的版本为 1.5.2，合并范围还含 1.5.1 与 1.5.2 发布后标为 Unreleased 的变更。下表按合并后的源码和原始日志整理。

| 范围 | 主要变化 |
| --- | --- |
| p2 | 增加并改进项目与会话树、侧栏新建项目、最近目录、附件和产物预览。产物移到服务端，Code Mode 可查看产物。MCP 可按会话位置配置，支持 Radius 备份。合并过程中的 Rooms 实验最终被移除。p2 版本 0.0.3，仍为实验原型。 |
| p2-mac | 新增 Swift/WebKit 实验外壳，提供原生窗口、本机服务接入和登录。 |
| p3 | 新增 p2 后继项目，已有 `p3` 命令、无界面服务、每会话 worker、版本化插件 API 与本地发布构建。当前要求 Node 24.4+。页面和后续切片仍在设计中，单可执行文件是当前发布方向。 |
| Chord v2 | 新增命名实时查询、列集合、exists/join、带书签的实时分页列表、对象与路由准入。worker 退出等已排队提交收尾后再发布。 |
| Durable | 新增持久信号、工具停放与唤醒、执行前审批门、afterTools/onYield 子任务及队列 onAbort 选项。补 JSONL 真正只读打开、图片输入适配和调度竞态修复。 |
| 模型 | GPT-6.2 Astra/Sol、Claude Fable 5.2、Qwen Token Plan 网关与目录更新。修复 Codex WebSocket 到期、套接字错误重试及 strict 工具参数兼容。 |
| CLI / TUI / Env | 改善会话替换与模型配置诊断、取消和 find 相对路径行为。TUI 复用只读渲染数组，改善长记录滚动与终端图像覆盖。Env 在子进程退出后继续读完被链路背压阻塞的输出。 |

主要依据：[p2](../apps/p2/README.md)、[p2-mac](../apps/p2-mac/README.md)、[p3](../apps/p3/README.md)、[p3 切片](../apps/p3/docs/slices/README.md)、[Chord](../packages/chord/CHANGELOG.md)、[Durable](../packages/durable/CHANGELOG.md)、[AI](../packages/ai/CHANGELOG.md)、[CLI](../packages/coding-agent/CHANGELOG.md)、[TUI](../packages/tui/CHANGELOG.md)、[Env](../packages/env/CHANGELOG.md)。

接入本地工作台时，优先核对以下接口变化。

- `runEndTask` / `RunEndTask` 改为 `hookTask` / `HookTask`。直接调用工具的包装层需要处理 `ToolPark`，等待状态的 `until` 可能缺省。新数据库中的任务版本应由新 Harness 读取。
- `beforeTool` 可以在调用前等待审批信号，唤醒会重新判断。项目范围、谁可提交决定、停止后的处理仍由工作台明确。普通审查对话的业务结论和工具审批继续分别处理。
- Code Mode 的命名空间来自 `Extension.namespace`，旧按名称前缀配置的接口已移除。自定义 TUI 组件修改渲染结果前要先复制数组。

源码阅读入口：[Durable 等待规范](../packages/durable/docs/suspendable/spec.md)、[审批示例](../packages/durable/test/examples/44-approval-gate.ts)、[离线导览](index.html)。[上一批合并记录](history/2026-11-07-UPSTREAM-UPDATE.md)对应 1.5.0 基线。
