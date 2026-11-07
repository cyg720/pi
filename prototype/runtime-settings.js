/* Settings design only. Does not call providers, execute tools or change Durable. */
(() => {
  "use strict";
  const groups = [
    { id: "retry", title: "模型请求与重试", help: "网络中断、临时限流、服务端故障可重试；密钥错误、余额不足不盲目重试。上下文超限走压缩。", fields: [
      { key: "retry.enabled", label: "异常自动重试", type: "boolean", value: true },
      { key: "retry.maxRetries", label: "最大重试次数", value: 3, min: 0, max: 10, help: "不含首次请求；0 表示不重试。" },
      { key: "retry.baseDelayMs", label: "首次重试间隔（秒）", value: 2, min: 1, max: 600, scale: 1000 },
      { key: "retry.maxAgentDelayMs", label: "最大重试间隔（秒）", value: 60, min: 1, max: 3600, scale: 1000, help: "每次间隔翻倍，达到上限后不再增长。" },
    ] },
    { id: "compaction", title: "上下文自动压缩", help: "接近模型上下文上限时，先总结旧内容，再继续任务。按模型的有效窗口检查阈值，不改变已保存历史。", fields: [
      { key: "compaction.enabled", label: "自动压缩", type: "boolean", value: true },
      { key: "compaction.reserveTokens", label: "预留空间（tokens）", value: 16384, min: 0, max: 2000000, help: "剩余空间低于此值时，阻塞当前生成并压缩。" },
      { key: "compaction.keepRecentTokens", label: "保留近期内容（tokens）", value: 20000, min: 0, max: 2000000 },
      { key: "compaction.backgroundTokens", label: "提前后台压缩空间（tokens）", value: 32768, min: 0, max: 2000000, help: "比阻塞阈值提前多少 tokens 开始；0 关闭后台压缩。" },
    ] },
    { id: "network", title: "网络与代理", help: "作用于服务端模型连接。不是浏览器断线重连，也不是命令执行超时。代理及超时统一接入仍需平台实现。", fields: [
      { key: "httpProxy", label: "HTTP / HTTPS 代理地址", type: "text", value: "", help: "留空跟随服务端环境。原型只填示例，不输入用户名、密码。" },
      { key: "httpIdleTimeoutMs", label: "HTTP 空闲超时（秒）", value: 300, min: 0, max: 3600, scale: 1000, help: "0 关闭空闲超时；模型连接可单独覆盖请求超时。" },
    ] },
    { id: "images", title: "图片输入", help: "沿用 coding-agent 的图片处理配置；平台材料处理需接入。仅对支持图片输入的模型有效。", fields: [
      { key: "images.autoResize", label: "发送前自动缩放图片", type: "boolean", value: true, help: "最长宽高不超过 2000 × 2000，原始文件不变。" },
      { key: "images.blockImages", label: "禁止把图片发送给模型", type: "boolean", value: false, help: "禁止后应提示材料未发送，不能静默当成已读取。" },
    ] },
    { id: "codemode", title: "编码工具高级配置", help: "仅用于编码智能体。来自 coding-agent，Durable 工具注册需另行接入；不会扩大审查智能体的写入能力。", fields: [
      { key: "codemode.mode", label: "工具调用方式", type: "select", value: "on", options: [["on", "直接工具与 Code Mode 并用"], ["only", "统一通过 Code Mode 调用"]] },
      { key: "codemode.inlineBudget", label: "工具说明预算（估算 tokens）", value: 3000, min: 0, max: 100000, help: "超出预算的工具通过搜索发现；0 只展示命名空间。" },
    ] },
    { id: "recovery", title: "异常恢复", help: "连续崩溃且任务状态没有进展时暂停，等待核对。与模型请求重试分开。", fields: [
      { key: "restartLimit", label: "连续无进展重启上限", value: 5, min: 1, max: 100, help: "不是自动重跑已产生副作用的命令；达到上限后需人工核对。" },
    ] },
  ];
  function connectionFields(hasWebsocket) {
    return [
      { key: "timeoutMs", label: "模型请求超时（秒）", value: "", min: 1, max: 3600, scale: 1000, optional: true, help: "留空跟随基础配置。各适配器超时语义不同，不是整项任务时长。" },
      { key: "maxRetries", label: "适配器内部重试次数（高级）", value: 0, min: 0, max: 5, help: "建议保持 0，由 Durable 统一重试；大于 0 会叠加请求次数。" },
      { key: "maxRetryDelayMs", label: "服务端重试等待上限（秒）", value: 60, min: 0, max: 3600, scale: 1000, help: "适配器内部重试时使用；超过就报错。0 取消上限，不代表关闭重试。" },
      { key: "cacheRetention", label: "提示词缓存偏好", type: "select", value: "short", options: [["none", "不请求缓存"], ["short", "短期缓存（默认）"], ["long", "长期缓存"]], help: "由适配器映射，厂商可能忽略，不保证命中或固定时长。" },
      ...(hasWebsocket ? [
        { key: "transport", label: "传输方式", type: "select", value: "auto", options: [["auto", "自动（推荐）"], ["sse", "SSE"], ["websocket", "WebSocket"], ["websocket-cached", "WebSocket · 缓存上下文"]], help: "当前 Codex Responses 适配器支持。连接失败可能回退 SSE；开始输出后失败由请求重试处理。" },
        { key: "websocketConnectTimeoutMs", label: "WebSocket 握手超时（秒）", value: 15, min: 0, max: 300, scale: 1000, help: "0 关闭握手超时。此字段需要平台请求适配层接入。" },
      ] : []),
    ];
  }
  function modelFields(model) {
    if (!model) return [];
    return [
      { key: "thinkingLevel", label: "新会话默认思考等级", type: "select", value: "", options: [["", "跟随模型默认"], ...model.levels.map(level => [level, ({off:"关闭思考",minimal:"最低",low:"低",medium:"中",high:"高",xhigh:"极高",max:"最高"})[level]])] },
      ...(model.api !== "openai-codex-responses" ? [{ key: "maxTokens", label: "最大输出预算（tokens）", value: "", min: 1, max: model.maxTokens, optional: true, help: `留空跟随目录（${model.maxTokens}）。思考与正文预算如何合并由适配器决定，实际请求还会按剩余上下文裁剪。需平台适配。` }] : []),
      ...(!model.reasoning ? [{ key: "temperature", label: "随机程度（Temperature）", value: "", min: 0, max: 1, step: 0.1, optional: true, help: "留空跟随模型。0–1 为本平台保守输入范围，服务端仍需校验；不对思考模型开放统一覆盖。需平台适配。" }] : []),
      ...["reserveTokens", "keepRecentTokens", "backgroundTokens"].map(key => ({ key: `compaction.${key}`, label: ({reserveTokens:"此模型压缩预留空间",keepRecentTokens:"此模型保留近期内容",backgroundTokens:"此模型提前后台压缩空间"})[key] + "（tokens）", value: "", optional: true, min: 0, max: Math.max(0, model.contextWindow - 1), help: "留空跟随全局压缩配置。正式发送前还需按此会话保存的有效窗口校验，不能只依据目录窗口。" })),
      ...(model.budgetControl ? ["minimal", "low", "medium", "high"].map(level => ({ key: `thinkingBudgets.${level}`, label: `${({minimal:"最低",low:"低",medium:"中",high:"高"})[level]}档思考预算（tokens）`, value: "", optional: true, min: 1024, max: Math.max(1024, model.maxTokens - 1024), help: "留空跟随适配器预算；自适应思考模型不显示此项。Durable 标准请求类型尚未提供该字段，需平台适配。" })) : []),
    ];
  }
  function parse(fields, raw) {
    const values = {}, payload = {}, errors = {};
    for (const field of fields) {
      const input = raw[field.key] ?? field.value;
      let value = input;
      if (field.type === "boolean") value = input === true || input === "true";
      else if (field.type === "select") {
        if (!field.options.some(([key]) => key === input)) errors[field.key] = "请选择有效选项。";
      } else if (field.type === "text") {
        value = String(input).trim();
        if (value) {
          try {
            const url = new URL(value);
            if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error();
          } catch { errors[field.key] = "请输入不含用户名和密码的 HTTP / HTTPS 地址。"; }
        }
      } else {
        value = String(input).trim();
        if (value === "" && field.optional) { values[field.key] = ""; continue; }
        value = value === "" ? NaN : Number(value);
        if (!Number.isFinite(value) || (!field.step && !Number.isSafeInteger(value)) || value < field.min || value > field.max) errors[field.key] = `请输入 ${field.min}–${field.max} 之间的${field.step ? "数字" : "整数"}。`;
      }
      values[field.key] = value;
      if (field.key === "thinkingLevel" && value === "") continue;
      payload[field.key] = field.scale ? value * field.scale : value;
    }
    if (values["retry.enabled"] && values["retry.maxRetries"] > 0 && values["retry.baseDelayMs"] > values["retry.maxAgentDelayMs"]) errors["retry.maxAgentDelayMs"] = "最大间隔不能小于首次间隔。";
    return { values, payload, errors };
  }
  function retryPreview(values) {
    if (!values["retry.enabled"] || !values["retry.maxRetries"]) return "不自动重试。";
    const waits = Array.from({length: values["retry.maxRetries"]}, (_, index) => Math.min(values["retry.baseDelayMs"] * 2 ** index, values["retry.maxAgentDelayMs"]));
    return `失败后依次等待 ${waits.join("、")} 秒；包含首次请求，最多 ${waits.length + 1} 次尝试。`;
  }
  window.WorkbenchRuntimeSettings = { groups, connectionFields, modelFields, parse, retryPreview };
})();
