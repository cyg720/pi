// Claims are matched against the English changelog section, not inferred from commit titles.
export const upstreamVersionNotes = {
  Unreleased: {
    title: '1.5.0 之后：请求续接、会话配置与工具修复',
    intro: '当前核心包版本 1.5.0，合并 HEAD 还包含这些未发布条目。完整合并范围另见首页的上游更新说明。',
    audience: '模型网关、CLI 工具与 Durable 应用维护者。',
    points: [
      { package: 'ai', needle: 'requiresToolsWithToolHistory', title: '历史工具消息不再强制空 tools 数组', before: '无当前工具、但历史含工具调用时仍发送空数组。', after: '默认省略 tools；旧网关可显式开启兼容选项。', why: '避免 vLLM 等端点拒绝空数组。', action: '核对网关要求，验证有工具历史而当前禁用工具的请求。' },
      { package: 'ai', needle: 'message threads', title: 'Anthropic 消息线程续接', before: '每次发送整个对话。', after: '适用时从上次响应继续，只发送新增消息；历史变化或服务端不能继续时回退完整请求。', why: '减少重复请求内容，缓存与 token 计数仍由提供商契约决定。', action: '结束会话清理资源；预热等重复请求使用 disableContinuation。' },
      { package: 'durable', needle: 'Per-conversation compaction settings', title: '逐会话压缩策略', before: '压缩主要由 Harness 策略控制。', after: '会话配置 compaction 并被子会话与分叉继承。', why: '不同会话可使用不同阈值和禁用策略。', action: '核对模型覆盖与会话 enabled:false 的优先级。' },
      { package: 'coding-agent', needle: 'streams the file', title: '大文件读取改为流式', before: '先把整个文件读入内存再截取。', after: '流式读取，只保留返回窗口；自定义 ReadOperations 可提供 createReadStream。', why: 'offset/limit 不再需要加载整个文件。', action: '验证大文件、偏移、行数限制和取消。' },
      { package: 'coding-agent', needle: 'computed before writing', title: '编辑先计算局部差异', before: '大文件可能写完后才因差异计算失败。', after: '保留未修改行的换行格式，在写入前计算变动附近的差异。', why: '减少内存并避免写入成功但 diff 失败的混淆。', action: '核对混合 CRLF/LF 与大文件编辑。' }
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
