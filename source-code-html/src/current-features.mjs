// Changes beyond the previous dev guide, grounded in current source and changelogs.
export const currentFeatures = {
  chord: [
    ['watch', 'Watch 句柄、快照与结束原因', ['watch.ts'], '提供共享的 Watch、WatchHandle 与 WatchEnd，实现有界积压、快照恢复和显式结束。', 'Watch / WatchHandle / WatchEnd', 'retired 由显式退休帧表示，不从 null 值推断；结束后释放监听者。'],
    ['output', '有界输出与进度节奏', ['output.ts'], '共享 OutputBuffer、boundOutput 和 Progress，控制流式输出窗口及提交频率。', '@earendil-works/chord/output', 'ProgressClock 可注入 now/setTimer，当前默认 Date.now 和 setTimeout；定时回调再次检查时钟。节奏按提交起点计算，限制输出不代表回滚已经产生的操作。'],
    ['sqlite', '通用 SQLite、迁移与驱动', ['sqlite/'], '提供数据库契约、原子迁移、前缀校验以及 Node / Cloudflare 驱动。', '@earendil-works/chord/sqlite', '从 Durable 迁入共享层；Durable 自身存储与 schema 迁移仍在 durable，版本从 1 连续递增。']
  ],
  durable: [
    ['indexeddb', '浏览器 IndexedDB 存储', ['storage/indexeddb.ts'], '在浏览器中持久保存会话、文档、条目与任务。', '@earendil-works/pi-durable/storage/indexeddb', '与 memory、JSONL、SQLite 共用 Storage 契约；使用前核对浏览器 IndexedDB 可用性。'],
    ['read-only', '只读 Harness 与存储提交采用', ['harness/harness.ts', 'harness/types.ts', 'session/session.ts', 'types.ts'], '作为查看器打开其他进程驱动的会话，并约束持久提交与内存状态采用的顺序。', 'HarnessOptions.readOnly / Storage.commit(writes, adopt, context)', 'readOnly 不恢复运行任务，拒绝写入和运行；存储持久化后、下次提交前同步调用 adopt(seq) 一次。采用后拒绝会使 Session 失败，不能回滚已采用状态。'],
    ['sleep', '持久睡眠、宿主时钟与唤醒', ['tasks.ts', 'harness/scheduler.ts', 'harness/harness.ts'], '任务结束阶段进入 sleeping，到期从持久 checkpoint 继续；wake/onWake 让宿主决定下次运行。', 'sleepUntil / setTimer / Harness.wake / onWake', 'sleepUntil 替代旧 TaskRuntime.sleep；睡眠不持有 invocation。SQLite schema v2 不能由 1.3.0 或更早版本打开。'],
    ['crash-guard', '崩溃循环保护与任务显式重试', ['harness/scheduler.ts', 'harness/task-graph.ts', 'harness/harness.ts', 'session/'], '计算未提交新状态的重启次数，到 restartLimit 后停放任务并显示原因。', 'settings.restartLimit / retryTask / inspect', '默认连续 5 次；正常关闭写回 pending 不计数，新状态提交重置计数。设置 Infinity 才保持无限重启行为。'],
    ['telemetry', '持久任务与提交遥测', ['harness/telemetry.ts', 'harness/harness.ts', 'harness/scheduler.ts'], '记录接纳、phase、提交、嵌套重放、指标与固定报告字段，显式传播 span。', 'HarnessOptions.telemetry / DURABLE_TELEMETRY_SCHEMA', '遥测不保存提示正文作为常规属性；业务状态仍以持久提交为准。'],
    ['live-settings', '动态模型设置与失败后队列策略', ['harness/harness.ts', 'harness/generation.ts', 'harness/submissions.ts', 'harness/types.ts'], '在使用时读取宿主提供的 models/settings 函数，并按模型覆盖压缩阈值、处理失败后排队输入。', 'HarnessOptions.models/settings；afterFailedRun；compaction.modelOverrides', 'keep/continue/withdraw 控制失败后输入；热替换不等于自动重跑已经失败的任务。']
  ],
  ai: [
    ['client-identity', '客户端身份、User-Agent 与归因', ['utils/identity.ts', 'models.ts'], '为请求设置客户端身份，统一 User-Agent 与提供商归因头。', 'createModels({ identity }) / withClientIdentity / formatUserAgent', '调用级身份覆盖默认值；认证凭据与客户端归因是不同机制。CLI 已通过 pi-ai 传递身份。'],
    ['telemetry', '模型请求与轮询的显式遥测', ['telemetry.ts', 'models.ts'], '提供 AI_TELEMETRY_SCHEMA 与 request/poll span、首事件、用量和指标。', 'telemetry?: TelemetrySpan', '已替代 telemetryContext，无兼容别名；取消标记与 provider_error 分开，未知费用不推算。']
  ],
  coding: [
    ['native-settings', '工作台原生设置白名单桥接', ['core/workbench-config.ts', 'core/settings-manager.ts'], '通过原生设置读写接口提供受控的模型、工具和 codemode 默认项。', 'readWorkbenchSettings / patchWorkbenchSettings', 'global/project 与项目信任分开；null patch 删除覆盖，不注入任意凭据或资源。'],
    ['summary-budget', '摘要输出预算与触发阈值分离', ['core/compaction/'], '摘要使用模型输出上限，避免推理消耗固定上限导致摘要失败。', 'generateSummary / generateSummaryWithUsage', 'reserveTokens 控制压缩触发，不能继续当作摘要输出 token 上限。']
  ],
  engineering: [
    ['workbench', '工作台源码解析、构建检查与恢复工具', ['workbench-', 'test-workbench.mjs', 'check-workbench.mjs', 'restore-workbench.mjs', 'prepare-workbench-conpty.mjs'], '组织工作台源码运行、限定测试、原生资源准备及离线数据恢复。', 'build:workbench / test:workbench / restore-workbench', '原生资源按指纹验证；测试使用白名单环境，外部模型与浏览器验收单独记录。']
  ]
};
