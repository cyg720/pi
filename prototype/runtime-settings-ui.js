/* Adds scoped, memory-only settings forms to the static workbench. */
(() => {
  "use strict";
  const settings = window.WorkbenchRuntimeSettings;
  const models = window.WorkbenchModels;
  const saved = new Map(), drafts = new Map(), definitions = new Map();
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
  const boundary = "仅演示配置，未连接模型或执行引擎。保存后本页及切换页面保留，刷新恢复默认；不改变现有会话。";
  const effective = "正式接入规则：模型默认参数仅新会话生效；运行策略在新任务 / 新审查轮次固定，已有任务恢复沿用原值。";
  function control(field, value) {
    const name = esc(field.key);
    const help = field.help ? `<small>${esc(field.help)}</small>` : "";
    if (field.type === "boolean") return `<label class="check-label"><input name="${name}" type="checkbox" ${value ? "checked" : ""}><span>${esc(field.label)}${help}</span></label>`;
    return `<label class="field"><span>${esc(field.label)}</span>${field.type === "select" ? `<select name="${name}" aria-label="${esc(field.label)}">${field.options.map(([key, label]) => `<option value="${esc(key)}" ${value === key ? "selected" : ""}>${esc(label)}</option>`).join("")}</select>` : `<input name="${name}" aria-label="${esc(field.label)}" type="${field.type === "text" ? "text" : "number"}" value="${esc(value)}" ${field.type === "text" ? "" : `min="${field.min}" max="${field.max}" step="${field.step || 1}"`} ${field.optional ? 'placeholder="跟随默认"' : ""}>`}${help}</label>`;
  }
  function section(key, title, fields, help) {
    definitions.set(key, { title, fields, help });
    const values = drafts.get(key) || saved.get(key) || {};
    return `<section class="runtime-section" data-runtime-key="${esc(key)}"><h3 id="settings-runtime-${esc(key)}" tabindex="-1">${esc(title)}</h3><p class="field-hint">${esc(help)}</p><form class="runtime-form" data-runtime-key="${esc(key)}" novalidate>${fields.map(field => control(field, values[field.key] ?? field.value)).join("")}<div class="runtime-buttons"><button type="submit" class="btn primary">保存此组（演示）</button><button type="button" class="btn" data-runtime-reset="${esc(key)}">恢复默认</button></div><p class="runtime-feedback" role="status" aria-live="polite"></p><details><summary>查看参数映射</summary><pre class="runtime-preview">${esc(JSON.stringify(settings.parse(fields, values).payload, null, 2))}</pre></details></form></section>`;
  }
  function collect(form) {
    const result = {};
    for (const input of form.querySelectorAll("input[name],select[name]")) result[input.name] = input.type === "checkbox" ? input.checked : input.value;
    return result;
  }
  function preview(form) {
    const { fields } = definitions.get(form.dataset.runtimeKey);
    const parsed = settings.parse(fields, collect(form));
    form.querySelector(".runtime-preview").textContent = JSON.stringify(parsed.payload, null, 2);
    const retryToggle = form.querySelector('[name="retry.enabled"]');
    if (retryToggle) for (const input of form.querySelectorAll('input[type="number"]')) input.disabled = !retryToggle.checked;
    const compactionToggle = form.querySelector('[name="compaction.enabled"]');
    if (compactionToggle) for (const input of form.querySelectorAll('input[type="number"]')) input.disabled = !compactionToggle.checked;
  }
  function addDirectory(directory, key, label) {
    directory.insertAdjacentHTML("beforeend", `<button type="button" class="provider-item" data-action="settings-section" data-section="settings-runtime-${esc(key)}" aria-controls="settings-runtime-${esc(key)}">${esc(label)}</button>`);
  }
  function enhance() {
    const pane = document.querySelector(".settings-simple");
    if (pane && document.querySelector("#basic-form") && !pane.dataset.runtimeEnhanced) {
      pane.dataset.runtimeEnhanced = "true";
      const directory = document.querySelector(".settings-directory");
      pane.insertAdjacentHTML("beforeend", `<div class="notice info">${boundary}<br>${effective}</div>`);
      for (const group of settings.groups) {
        addDirectory(directory, group.id, group.title);
        pane.insertAdjacentHTML("beforeend", section(group.id, group.title, group.fields, group.help));
      }
      pane.querySelectorAll(".runtime-form").forEach(preview);
    }
    const provider = document.querySelector("#provider-form");
    if (provider && !provider.dataset.runtimeEnhanced) {
      provider.dataset.runtimeEnhanced = "true";
      const id = document.querySelector(".provider-list .provider-item.active")?.dataset.id;
      if (!id) return;
      const entries = models.catalog[id] || [];
      provider.parentElement.insertAdjacentHTML("beforeend", section(`connection:${id}`, "请求高级配置", settings.connectionFields(entries.some(model => model.api === "openai-codex-responses")), `${boundary} ${effective} 不支持的适配器可能忽略对应参数。`));
      for (const button of provider.querySelectorAll('[data-action="model-context"]')) {
        const ref = button.dataset.ref;
        button.parentElement.insertAdjacentHTML("afterend", `<button type="button" class="text-button runtime-model-button" data-runtime-model="${esc(ref)}">模型高级参数</button>`);
      }
    }
  }
  const dialog = document.createElement("dialog");
  dialog.id = "runtime-dialog";
  dialog.setAttribute("aria-label", "模型高级参数");
  document.body.append(dialog);
  document.addEventListener("click", event => {
    const modelButton = event.target.closest("[data-runtime-model]");
    if (modelButton) {
      const ref = modelButton.dataset.runtimeModel;
      const model = models.get(ref);
      if (!model) return;
      dialog.innerHTML = `<div class="dialog-heading"><h2>${esc(model.name)}</h2><button type="button" class="icon-button" data-runtime-close aria-label="关闭模型高级参数">×</button></div><p class="field-hint">${esc(model.id)} · ${esc(model.api)}</p>${section(`model:${ref}`, "模型高级参数", settings.modelFields(model), `${boundary} 默认思考等级只展示源码支持的选项。未确认支持自定义预算的模型不开放预算输入。`)}<p class="field-hint">修改仅作为新会话默认值；不会改写历史上下文、统计或当前审查轮。</p>`;
      dialog.showModal();
    }
    if (event.target.closest("[data-runtime-close]")) dialog.close();
    const reset = event.target.closest("[data-runtime-reset]");
    if (reset) {
      const key = reset.dataset.runtimeReset;
      const { fields, title, help } = definitions.get(key);
      drafts.delete(key); saved.delete(key);
      const parent = reset.closest(".runtime-section");
      parent.outerHTML = section(key, title, fields, help);
      const next = [...document.querySelectorAll(".runtime-form")].find(form => form.dataset.runtimeKey === key);
      preview(next);
      next.querySelector(".runtime-feedback").textContent = "本组已恢复默认；未改变其他配置。";
      next.querySelector("button[type=submit]").focus();
    }
  });
  document.addEventListener("input", event => {
    const form = event.target.closest(".runtime-form");
    if (!form) return;
    drafts.set(form.dataset.runtimeKey, collect(form));
    preview(form);
    const feedback = form.querySelector(".runtime-feedback");
    feedback.classList.remove("error");
    feedback.textContent = "有未保存修改。";
  });
  document.addEventListener("submit", event => {
    const form = event.target.closest(".runtime-form");
    if (!form) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const key = form.dataset.runtimeKey;
    const { fields } = definitions.get(key);
    const parsed = settings.parse(fields, collect(form));
    const errors = Object.entries(parsed.errors);
    const feedback = form.querySelector(".runtime-feedback");
    for (const input of form.querySelectorAll("input,select")) input.setAttribute("aria-invalid", String(Boolean(parsed.errors[input.name])));
    feedback.classList.toggle("error", errors.length > 0);
    if (errors.length) {
      feedback.textContent = errors.map(([key, message]) => `${fields.find(field => field.key === key).label}：${message}`).join("\n");
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    saved.set(key, parsed.values); drafts.delete(key);
    feedback.textContent = "已保存演示值；刷新恢复默认，不发送请求。";
    if (key === "retry") feedback.textContent += "\n" + settings.retryPreview(parsed.values);
    if (key.startsWith("connection:") && parsed.values.maxRetries > 0) {
      const retryFields = settings.groups.find(group => group.id === "retry").fields;
      const retry = settings.parse(retryFields, saved.get("retry") || {}).values;
      const count = (retry["retry.enabled"] ? retry["retry.maxRetries"] + 1 : 1) * (parsed.values.maxRetries + 1);
      feedback.textContent += `\n当前两层重试最多组合 ${count} 次请求尝试，不含适配器协议回退。建议内部重试保持 0。`;
    }
    preview(form);
  }, true);
  new MutationObserver(enhance).observe(document.querySelector("#app"), {childList:true,subtree:true});
  enhance();
})();
