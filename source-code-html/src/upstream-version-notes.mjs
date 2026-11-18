// Claims are matched against the English changelog section, not inferred from commit titles.
export const upstreamVersionNotes = {
  Unreleased: {
    title: '1.5.2 之后：任务等待、实时查询与模型更新',
    intro: '当前核心包版本为 1.5.2。以下是合入源码中的未发布变化，完整范围见首页更新说明。',
    audience: 'Durable 应用、Chord 插件、CLI 扩展与模型网关维护者。',
    points: [
      { package: 'durable', needle: 'defineSignal', title: '信号和工具等待', before: '工具执行只返回结果。', after: '工具可以落盘等待，以信号、到期或子任务唤醒。', why: '等待可以跨重启，期间释放调用。', action: '适配 ToolPark、可省略的 until 与新的钩子类型。' },
      { package: 'chord', needle: 'Named queries', title: '声明命名查询与实时列表', before: '主要按表和普通观察器组织读模型。', after: '新增命名实时查询、列表书签和跨插件列集合。', why: '列表加载更多时保持已加载结果实时更新。', action: '阅读 Chord 第 14 切片和相应示例。' },
      { package: 'tui', needle: 'readonly string[]', title: '渲染结果只读并复用', before: '扩展可能原地修改子组件返回内容。', after: 'Container 可返回缓存的只读数组。', why: '长记录滚动减少重复渲染与复制。', action: '需要修改结果时先复制数组。' },
      { package: 'ai', needle: 'GPT-6.2 Astra', title: '新模型与推理档位', before: '上版目录默认模型为 GPT-6.1 Sol。', after: '新增 GPT-6.2 Astra 和 Sol，模型窗口和档位按接入项区分。', why: '同名模型经不同 API 提供时能力可能不同。', action: '从实际 provider 和模型 ID 查询属性。' }
    ]
  },
  '1.5.0': {
    title: 'Schema 校验迁移、分组提交与流式性能',
    intro: '2026-11-02 的 1.5.0；Chord v2 与 p2 的完整合并进展还应结合当前源码和提交时间线阅读。',
    audience: 'SDK、工具扩展、存储适配器与会话 UI 开发者。',
    points: [
      { package: 'ai', needle: 'no longer re-exports TypeBox', title: 'AI 根入口不再导出 TypeBox', before: '从 pi-ai 导入 Type、Static、TSchema。', after: '使用 pi-schema 构造器，或自行从 typebox 导入。', why: '统一普通 JSON Schema 与工具参数转换。', action: '区分普通 SDK 和 CLI 扩展加载器的兼容入口。' },
      { package: 'durable', needle: 'commit(batches, receive, context)', title: 'Storage 批量提交契约', before: '每次写一份 writes 并 adopt。', after: '接收多个 batches，逐项 receive(index, seq)，返回 stored/refused。', why: '多会话共享存储往返，保持每个提交独立结果。', action: '迁移自定义 Storage 并运行 conformance，检查业务拒绝与 I/O 未知结果。' },
      { package: 'durable', needle: 'Removed `watchEvents()`', title: '视图替代事件拼装', before: '界面消费消息和工具事件自行重建状态。', after: 'Conversation.watch 和 ConversationTranscript 提供有界窗口、缺口和历史补载。', why: '重连后直接恢复可见状态，避免重复组装。', action: '历史使用 entries；模型活动上下文使用 context；审计不要使用合并后的 watch。' },
      { package: 'durable', needle: 'Restart-limited tasks no longer park', title: '重启上限后明确结束', before: '任务停放并等待显式重试。', after: '任务结束，以 runFailure、工具错误或任务报告公开原因。', why: '防止会话永远 busy。', action: '移除 retryTask 调用；核对新工作接纳和结果未知窗口。' },
      { package: 'ai', needle: 'StreamingJsonParser', title: '工具参数增量解析', before: '大工具参数反复解析累积文本。', after: '逐片段解析并产生 JsonChange。', why: '降低长输出的重复计算与内存占用。', action: '消费统一工具调用流，勿自行拼装不完整 JSON 后提前执行。' }
    ]
  }
};
