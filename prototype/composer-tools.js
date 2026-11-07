/* Prototype-only approval choices and project sample references. No disk/API access. */
(() => {
  "use strict";
  const modes = {
    manual: { name: "手动审批", description: "重要操作由你确认", icon: "clock" },
    auto: { name: "自动审批", description: "由 AI 审核，必要时再询问你", icon: "shield" },
    full: { name: "完全访问", description: "不经审批，直接在本机运行", icon: "shield" },
  };
  let context;
  let opened;
  const mode = record => Object.hasOwn(modes, record.approvalMode) ? record.approvalMode : "auto";
  function references(record, files) {
    const seen = new Set();
    return (Array.isArray(record.attachments) ? record.attachments : []).filter(item => {
      if (!item || !["file", "folder"].includes(item.kind) || typeof item.path !== "string") return false;
      const key = `${item.kind}:${item.path}`;
      const valid = files.some(file => item.kind === "file" ? file.path === item.path : file.path.startsWith(item.path + "/"));
      if (!valid || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map(({ kind, path }) => ({ kind, path }));
  }
  function message(record, files, text) {
    const items = references(record, files);
    return text + (items.length ? "\n\n参考项目样例：\n" + items.map(item => `[${item.kind === "file" ? "文件" : "文件夹"}] ${item.path}`).join("\n") : "");
  }
  function controls(record, locked = false) {
    const { esc, icon } = context;
    const selected = mode(record);
    return `<div class="composer-tools"><button type="button" class="icon-button context-add" data-composer-action="add" aria-label="添加文件、文件夹或 Skill" aria-haspopup="dialog" aria-expanded="false">${icon("plus")}</button><button type="button" class="approval-trigger ${selected === "full" ? "full-access" : ""}" data-composer-action="approval" aria-label="审批方式：${esc(modes[selected].name)}" aria-haspopup="dialog" aria-expanded="false" ${locked ? 'disabled title="当前执行或队列结束后可修改演示审批方式"' : ""}>${icon(modes[selected].icon)}<span>${modes[selected].name}</span>${icon("down")}</button></div>`;
  }
  function chips(record, files) {
    const { esc, icon } = context;
    return `<div class="context-chips">${references(record, files).map(item => `<span class="context-chip" title="项目样例：${esc(item.path)}">${icon(item.kind)}<span>${esc(item.path)}</span><button type="button" data-composer-action="remove" data-kind="${item.kind}" data-path="${esc(item.path)}" aria-label="移除 ${esc(item.path)}">${icon("close")}</button></span>`).join("")}</div>`;
  }
  function close(restoreFocus = false) {
    if (!opened) return;
    const { trigger, menu } = opened;
    opened = null;
    menu.remove();
    trigger.setAttribute("aria-expanded", "false");
    if (restoreFocus && trigger.isConnected) trigger.focus();
  }
  function open(trigger, kind) {
    close();
    const { esc, icon } = context;
    const record = context.record();
    if (!record) return;
    const menu = document.createElement("div");
    menu.className = "composer-popup";
    menu.setAttribute("role", "dialog");
    menu.setAttribute("aria-label", kind === "approval" ? "如何审批 Agent 的操作" : "添加上下文");
    menu.setAttribute("popover", "manual");
    if (kind === "approval") {
      menu.innerHTML = `<div class="composer-popup-heading"><span>如何审批 Agent 的操作？</span><button type="button" data-composer-action="learn">了解更多</button></div>${Object.entries(modes).map(([id, item]) => `<button type="button" class="composer-popup-item ${id === "full" ? "full-access" : ""}" data-composer-action="set-approval" data-mode="${id}" aria-pressed="${mode(record) === id}">${icon(item.icon)}<span><strong>${item.name}</strong><small>${item.description}</small></span><span class="popup-check">${mode(record) === id ? icon("check") : ""}</span></button>`).join("")}<p class="composer-popup-note">仅演示选择，未接入真实审批或执行权限。</p>`;
    } else if (kind === "add") {
      menu.innerHTML = `<div class="composer-popup-heading">添加上下文</div><button type="button" class="composer-popup-item" data-composer-action="files">${icon("file")}<span>文件</span>${icon("chevron")}</button><button type="button" class="composer-popup-item" data-composer-action="folders">${icon("folder")}<span>文件夹</span>${icon("chevron")}</button><button type="button" class="composer-popup-item" disabled>${icon("layers")}<span>Skill</span><small>即将支持</small></button><p class="composer-popup-note">选择当前项目样例，不读取本机磁盘。</p>`;
    } else {
      const files = context.files();
      const paths = kind === "files" ? files.map(file => file.path) : [...new Set(files.flatMap(file => file.path.split("/").slice(0, -1).map((_, index, parts) => parts.slice(0, index + 1).join("/"))))];
      const selected = references(record, files);
      const type = kind === "files" ? "file" : "folder";
      menu.innerHTML = `<div class="composer-popup-heading"><button type="button" data-composer-action="back">${icon("back")} 返回</button><span>选择${type === "file" ? "文件" : "文件夹"}</span></div><div class="context-picker-list">${paths.map(path => `<button type="button" class="composer-popup-item" data-composer-action="pick" data-kind="${type}" data-path="${esc(path)}" aria-pressed="${selected.some(item => item.kind === type && item.path === path)}">${icon(type)}<span>${esc(path)}</span><span class="popup-check">${selected.some(item => item.kind === type && item.path === path) ? icon("check") : ""}</span></button>`).join("") || '<p class="composer-popup-note">当前项目没有可选样例。</p>'}</div><p class="composer-popup-note">再次点击取消选择；可继续选择多项。</p>`;
    }
    document.body.append(menu);
    if (menu.showPopover) menu.showPopover();
    const rect = trigger.getBoundingClientRect();
    menu.style.width = `${Math.min(kind === "approval" ? 340 : 300, innerWidth - 20)}px`;
    menu.style.maxHeight = `${Math.max(100, Math.min(380, rect.top - 14 > 160 ? rect.top - 14 : innerHeight - rect.bottom - 14))}px`;
    menu.style.left = `${Math.max(10, Math.min(rect.left, innerWidth - menu.offsetWidth - 10))}px`;
    menu.style.top = `${rect.top - menu.offsetHeight - 8 >= 8 ? rect.top - menu.offsetHeight - 8 : Math.min(rect.bottom + 8, innerHeight - menu.offsetHeight - 10)}px`;
    opened = { trigger, menu, kind, record };
    trigger.setAttribute("aria-expanded", "true");
    menu.querySelector("button:not(:disabled)")?.focus();
  }
  function connect(options) {
    context = options;
    document.addEventListener("click", event => {
      const target = event.target.closest("[data-composer-action]");
      if (!target || target.disabled) return;
      event.preventDefault();
      const action = target.dataset.composerAction;
      const record = context.record();
      if (!record) return;
      if (["add", "approval"].includes(action)) {
        if (opened?.trigger === target) close(true); else open(target, action);
        return;
      }
      if (["files", "folders", "back"].includes(action) && opened) { open(opened.trigger, action === "back" ? "add" : action); return; }
      if (action === "learn") { context.notify("手动由你确认；自动由 AI 审核；完全访问跳过审批。本原型只演示选择，不执行真实操作。"); return; }
      if (action === "set-approval") {
        if (context.locked() || !Object.hasOwn(modes, target.dataset.mode)) return;
        record.approvalMode = target.dataset.mode;
        close(); context.changed();
        document.querySelector(".approval-trigger")?.focus();
      }
      if (["pick", "remove"].includes(action)) {
        const item = { kind: target.dataset.kind, path: target.dataset.path };
        const current = references(record, context.files());
        const exists = current.some(ref => ref.kind === item.kind && ref.path === item.path);
        record.attachments = exists ? current.filter(ref => ref.kind !== item.kind || ref.path !== item.path) : action === "pick" ? references({ attachments: [...current, item] }, context.files()) : current;
        const kind = opened?.kind;
        close(); context.changed();
        const trigger = document.querySelector(".context-add");
        if (action === "pick" && trigger) open(trigger, kind); else trigger?.focus();
      }
    });
    document.addEventListener("pointerdown", event => {
      if (opened && !opened.menu.contains(event.target) && !opened.trigger.contains(event.target)) close();
    });
    document.addEventListener("keydown", event => {
      if (!opened) return;
      if (event.key === "Escape") { event.preventDefault(); close(true); }
      else if (event.key === "Tab") close(true);
      else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const buttons = [...opened.menu.querySelectorAll("button:not(:disabled)")];
        const index = buttons.indexOf(document.activeElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }
    });
    window.addEventListener("resize", () => close());
    document.addEventListener("scroll", event => { if (opened && !opened.menu.contains(event.target)) close(); }, true);
  }
  window.WorkbenchComposerTools = { controls, chips, close, connect, mode, references, message };
})();
