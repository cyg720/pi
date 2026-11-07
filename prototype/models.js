/* Browser view of the offline pi-ai catalog; never calls a provider. */
(() => {
  const catalog = window.WorkbenchModelCatalog;
  const labels = { off: "关闭思考", minimal: "最低", low: "低", medium: "中", high: "高", xhigh: "极高", max: "最高" };
  const byRef = new Map(Object.entries(catalog).flatMap(([provider, models]) => models.map(model => [`${provider}/${model.id}`, model])));
  const get = ref => byRef.get(ref);
  const preferred = { openai: "gpt-5.4", anthropic: "claude-sonnet-4-6", deepseek: "deepseek-v4-pro" };
  function defaultRef(provider) {
    const models = catalog[provider] || [];
    const model = models.find(item => item.id === preferred[provider]) || models[0];
    return model ? `${provider}/${model.id}` : "";
  }
  function normalize(ref, level) {
    const model = get(ref);
    if (!model) return "";
    return model.clamps[level] || model.clamps.medium;
  }
  function migrate(record) {
    if (!record.model) return;
    const split = record.model.indexOf("/");
    if (["coding-demo", "review-demo"].includes(record.model.slice(split + 1))) {
      record.model = defaultRef(record.model.slice(0, split)) || record.model;
    }
    record.thinking = normalize(record.model, record.thinking === "深入思考" ? "high" : record.thinking);
  }
  function contextError(ref, value) {
    if (value.trim() === "") return "";
    const ceiling = get(ref)?.contextWindow;
    if (!Number.isSafeInteger(ceiling) || ceiling <= 0) return "目录上下文未知，暂不能设置上限。";
    const limit = Number(value);
    return !Number.isSafeInteger(limit) || limit <= 0 || limit > ceiling ? `请输入 1 到 ${ceiling.toLocaleString("en-US")} 之间的整数。` : "";
  }
  window.WorkbenchModels = {
    catalog, get, defaultRef, normalize, migrate, contextError,
    tokens: value => Number.isSafeInteger(value) && value > 0 ? `${value.toLocaleString("en-US")} tokens` : "未知",
    name: ref => get(ref)?.name || ref.slice(ref.indexOf("/") + 1),
    levels: ref => get(ref)?.levels || [],
    label: (ref, level) => !get(ref) ? "能力未知" : !get(ref).reasoning ? "不支持思考" : labels[level] || level,
  };
})();
