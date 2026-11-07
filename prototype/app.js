/* 独立静态原型。工作位置和演示记录本地保存，连接及授权表单只在内存中。 */
(() => {
  "use strict";
  const data = structuredClone(window.WorkbenchFixtures);
  const models = window.WorkbenchModels;
  const rounds = window.WorkbenchReviewRounds;
  const operations = window.WorkbenchOperations;
  const usage = window.WorkbenchUsage;
  const turns = window.WorkbenchTurnNavigation;
  const composerTools = window.WorkbenchComposerTools;
  const messageQueue = window.WorkbenchMessageQueue;
  const state = {
    project: "p1", session: "s1", view: "session", inspector: "files", inspectorOpen: true, agentView: "list", sidebarCollapsed: false,
    settingsTab: "providers", provider: "openai", providerQuery: "", providerFilter: "all",
    back: null, preview: null, connected: true, defaultModel: models.defaultRef("openai"), projectSearch: {}, viewers: {},
    contextLimits: {}, config: {}, configDrafts: {}, auth: {}, newSessionDraft: {}, newSessionDrafts: {}, globalCap: 4, powershell: "pwsh", bash: "", commandTimeout: 120,
    reviewLimit: 30, checkLimit: 5, timeLimit: 20, diffScope: "run", diffSession: "s1", counter: 10,
  };
  for (const [id, name, auth] of data.providers) {
    state.config[id] = { name, auth: auth.split(","), configured: ["openai", "deepseek", "anthropic"].includes(id), enabled: true, verified: id === "openai", favorite: true, favorites: (models.catalog[id] || []).slice(0, 2).map(model => model.id), mode: auth.split(",")[0], values: {} };
  }
  let resetWorkspace = false;
  let saveTimer;
  let storageWarning = false;
  try {
    const restored = window.WorkbenchWorkspace.decode(localStorage.getItem(window.WorkbenchWorkspace.key), data);
    if (restored) { Object.assign(data, restored.data); Object.assign(state, restored.state); }
  } catch { /* 存储禁用时仍可使用内存原型。 */ }
  for (const record of [...data.sessions, state.newSessionDraft, ...Object.values(state.newSessionDrafts)]) models.migrate(record);
  for (const record of data.sessions) { rounds.ensure(record); window.WorkbenchReviewChat.migrate(record); }
  data.operationReceipts ||= [];
  function saveWorkspace() {
    clearTimeout(saveTimer);
    if (resetWorkspace) return false;
    if (state.newSessionDraft.project) state.newSessionDrafts[state.newSessionDraft.project] = state.newSessionDraft;
    const currentProject = data.projects.find(p => p.id === state.project);
    if (currentProject && state.view !== "settings") {
      currentProject.inspector = state.inspector;
      const owner = state.view === "session" ? data.sessions.find(s => s.id === state.session) : currentProject;
      if (owner) { owner.diffScope = state.diffScope; owner.diffSession = state.diffSession; }
    }
    try {
      localStorage.setItem(window.WorkbenchWorkspace.key, window.WorkbenchWorkspace.encode(data, state));
      return true;
    } catch {
      if (!storageWarning) { storageWarning = true; toast("浏览器无法保存工作位置，本次刷新可能无法恢复。"); }
      return false;
    }
  }
  window.addEventListener("pagehide", saveWorkspace);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") saveWorkspace(); });
  const app = document.querySelector("#app");
  const dialog = document.querySelector("#dialog");
  let toastTimer;
  const icons = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>',
    moon: '<path d="M20.5 13.2A8.5 8.5 0 0 1 10.8 3.5a8.5 8.5 0 1 0 9.7 9.7Z"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    list: '<path d="M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    down: '<path d="m5 9 7 7 7-7"/>',
    folder: '<path d="M3 7V5h6l2 2h10v12H3V7Z"/>',
    file: '<path d="M5 3h9l5 5v13H5V3Z"/><path d="M14 3v6h5M8 13h8M8 17h6"/>',
    code: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    settings: '<path d="m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3H9Z"/><circle cx="12" cy="12" r="3"/>',
    sidebar: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    circle: '<circle cx="12" cy="12" r="8"/>',
    arrow: '<path d="M12 19V5m-6 6 6-6 6 6"/>',
    back: '<path d="m10 5-7 7 7 7M3 12h18"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
    search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    branch: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M6 7v10m12-10c0 5-12 4-12 9"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  };
  const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.file}</svg>`;
  const esc = (value = "") => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const button = (label, action, extra = "", style = "") => `<button type="button" class="btn ${style}" data-action="${action}" ${extra}>${label}</button>`;
  const project = () => data.projects.find(p => p.id === state.project);
  const session = () => data.sessions.find(s => s.id === state.session);
  const busy = s => ["running", "capturing", "stopping", "finishing"].includes(s.status);
  const labels = { running: "执行中", idle: "未开始", done: "已完成", stopped: "已停止", stopping: "正在停止", waiting: "待确认标准", capturing: "正在取材", finishing: "正在收尾", published: "报告已发布", unknown: "结果待核对", blocked: "资源冲突", failed: "执行失败" };
  const badge = s => `<span class="pill"><i class="dot ${s.status}"></i>${labels[s.status] || s.status}</span>`;
  const agentName = s => s.agent === "code" ? "lg-codeing-agent" : "lg-examine";
  const avatar = s => `<span class="agent-avatar ${s.agent === "review" ? "review" : ""}">${icon(s.agent === "code" ? "code" : "shield")}</span>`;
  const availableModels = () => Object.entries(state.config).filter(([, c]) => c.configured && c.enabled).flatMap(([id]) => (models.catalog[id] || []).map(model => `${id}/${model.id}`));
  const modelName = models.name;
  const field = (title, name, value = "", type = "text", help = "") => `<label class="field"><span>${title}</span><input type="${type}" name="${name}" value="${esc(value)}" ${type === "password" ? 'autocomplete="off" placeholder="仅填演示值；留空保留"' : ""}>${help ? `<small>${help}</small>` : ""}</label>`;
  const area = (title, name, value = "", hint = "") => `<label class="field"><span>${title}</span><textarea name="${name}" placeholder="${esc(hint)}">${esc(value)}</textarea></label>`;
  function toast(message) {
    const element = document.querySelector("#toast");
    element.textContent = message;
    element.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove("show"), 3400);
  }
  function modal(title, content) {
    dialog.innerHTML = `<div class="dialog-heading"><h2 id="dialog-title">${title}</h2><button class="icon-button" data-action="close-dialog" aria-label="关闭">${icon("close")}</button></div>${content}`;
    if (!dialog.open) dialog.showModal();
  }
  function sidebar() {
    return `<aside class="sidebar"><div class="brand"><span class="brand-mark">${icon("layers")}</span><div class="brand-copy"><strong>LG Workbench</strong><small>YOUR AGENT WORKSPACE</small></div><button class="icon-button sidebar-toggle" data-action="toggle-sidebar" aria-label="${state.sidebarCollapsed ? "展开左侧栏" : "收起左侧栏"}" title="${state.sidebarCollapsed ? "展开左侧栏" : "收起左侧栏"}" aria-expanded="${!state.sidebarCollapsed}">${icon("sidebar")}</button></div>
      <div class="side-actions"><button class="side-button outline" data-action="new-project" aria-label="新建项目" title="新建项目">${icon("plus")}<span>新建项目</span><span class="key">＋</span></button></div>
      <nav class="rail-projects" aria-label="项目快捷入口">${data.projects.map(p => `<button class="rail-project" aria-haspopup="menu" aria-expanded="false" data-action="project" data-id="${p.id}" title="${esc(p.name)}" aria-label="打开项目：${esc(p.name)}" aria-current="${state.project === p.id}"><span>${esc([...p.name].slice(0, 2).join(""))}</span>${data.sessions.some(s => s.project === p.id && busy(s)) ? '<i class="dot running"></i>' : ""}</button>`).join("")}</nav>
      <div class="side-label"><span>项目空间</span><span>${String(data.projects.length).padStart(2, "0")}</span></div><nav class="project-scroll" aria-label="项目与会话">${data.projects.map(p => {
        const sessions = data.sessions.filter(s => s.project === p.id);
        const running = sessions.filter(busy).length;
        return `<div class="project-group"><div class="project-row" data-record-kind="project" data-record-id="${p.id}"><button class="fold" data-action="fold" data-id="${p.id}" aria-label="${p.expanded ? "折叠" : "展开"}${esc(p.name)}" aria-expanded="${p.expanded}">${icon(p.expanded ? "down" : "chevron")}</button><button class="project-name truncate" data-action="project" data-id="${p.id}" title="${esc(p.name)}">${esc(p.name)}</button>${running ? `<span class="count">${running} 运行</span>` : ""}<button class="add-session" data-action="new-session" data-project="${p.id}" aria-label="在${esc(p.name)}新建会话">${icon("plus")}</button></div>${p.expanded ? sessions.map(s => `<button class="session-row ${s.id === state.session && state.view === "session" ? "active" : ""}" data-record-kind="session" data-record-id="${s.id}" data-action="session" data-id="${s.id}" title="${esc(s.title)} · ${labels[s.status]}"><i class="dot ${s.status}"></i><span class="label">${esc(s.title)}</span><span class="agent-mini">${s.agent === "code" ? "编码" : "审查"}</span></button>`).join("") + (!sessions.length ? '<div class="muted" style="font-size:10px;padding:10px 25px">还没有会话</div>' : "") : ""}</div>`;
      }).join("")}</nav>${sidebarAgents()}<div class="sidebar-footer"><div class="connection row"><i class="dot ${state.connected ? "running" : "waiting"}"></i>${state.connected ? "本地工作台 · 演示连接" : "连接已断开 · 演示"}</div><div class="sidebar-settings-row"><button class="side-button ${state.view === "settings" ? "selected" : ""}" data-action="settings" aria-label="设置" title="设置">${icon("settings")}<span>设置</span><span class="key">1.0</span></button><button class="icon-button theme-toggle" data-action="toggle-theme" aria-label="${document.documentElement.dataset.theme === "dark" ? "切换亮色主题" : "切换暗色主题"}" title="${document.documentElement.dataset.theme === "dark" ? "切换亮色主题" : "切换暗色主题"}">${icon(document.documentElement.dataset.theme === "dark" ? "sun" : "moon")}</button></div></div></aside>`;
  }
  function sidebarAgents() {
    return `<section class="agent-dock" aria-label="智能体"><div class="agent-dock-heading"><button class="agent-directory" data-action="agents" aria-label="打开智能体目录" title="查看智能体目录">智能体 <span>${data.agents.length}</span>${icon("chevron")}</button><div class="agent-view-toggle" role="group" aria-label="智能体显示方式">${["list", "grid"].map(mode => `<button class="icon-button" data-action="agent-view" data-mode="${mode}" aria-label="${mode === "list" ? "列表模式" : "方块模式"}" title="${mode === "list" ? "列表模式" : "方块模式"}" aria-pressed="${state.agentView === mode}">${icon(mode)}</button>`).join("")}</div></div><div class="agent-dock-items ${state.agentView}" role="list" aria-label="可用智能体">${data.agents.map(agent => `<div role="listitem"><button class="agent-shortcut" data-action="new-session" data-project="${esc(state.project)}" data-agent="${esc(agent.id)}" aria-label="使用${esc(agent.name)}新建会话" title="${agentName({agent: agent.id})} · ${esc(agent.description)}">${avatar({agent: agent.id})}<span class="agent-shortcut-text"><strong>${esc(agent.name)}</strong><small>${esc(agent.description)}</small></span></button></div>`).join("")}</div></section>`;
  }
  function render() {
    composerTools.close();
    closeProjectFlyout();
    closeRecordMenu();
    const p = project() || { id: "", name: "未选择项目", path: "" };
    const s = session();
    const isFull = !p.id || ["settings", "agents"].includes(state.view);
    const viewer = viewerState();
    state.preview = !isFull && viewer.open ? viewer.tabs.find(tab => tab.id === viewer.active) || null : null;
    const crumb = state.view === "settings" ? "设置" : state.view === "agents" ? "智能体目录" : state.view === "overview" ? "项目总览" : state.view === "create" ? "新会话" : s?.title;
    app.innerHTML = `<div class="shell ${state.sidebarCollapsed ? "sidebar-collapsed" : ""}">${sidebar()}<main class="workspace"><header class="topbar"><div class="topbar-location"><div class="breadcrumb">${icon(state.view === "settings" ? "settings" : "folder")}<button data-action="project" data-id="${p.id}">${esc(p.name)}</button><span class="slash">/</span><strong class="current-crumb">${esc(crumb)}</strong></div>${p.path ? `<div class="topbar-path mono" title="${esc(p.path)}">${esc(p.path)}</div>` : ""}</div><div class="toolbar">${!isFull && viewer.tabs.length && !viewer.open ? button(`${icon("file")} 查看文件 · ${viewer.tabs.length}`, "show-viewer", "", "small") : ""}<span class="prototype-label">交互原型 · 演示数据</span><button class="icon-button" data-action="scenarios" aria-label="打开演示场景" title="演示场景">${icon("more")}</button>${state.view === "settings" ? button(`${icon("back")} 返回工作台`, "back-settings", "", "small") : `<button class="icon-button" data-action="toggle-inspector" aria-label="显示或隐藏文件面板" title="文件面板">${icon("panel")}</button>`}</div></header>${operationNotice()}${!state.connected ? '<div class="offline-strip">浏览器连接已断开，保留最后已知状态。切换场景可模拟重新连接；断线不等于任务失败。</div>' : ""}<div class="main-grid ${isFull ? "full" : ""} ${state.inspectorOpen ? "show-inspector" : "hide-inspector"}"><section class="content" aria-label="工作区">${state.view === "settings" ? settings() : state.view === "agents" ? agents() : !p.id ? `<div class="empty"><h2>还没有项目</h2><p>新建一个项目，开始工作。</p>${button("新建项目", "new-project", "", "primary")}</div>` : workspaceContent()}</section>${isFull ? "" : inspector()}</div><footer class="status-bar">${sessionMetadata(state.view === "session" && s ? rounds.displayed(s) : null)}</footer></main></div>`;
    document.querySelector(".viewer-tab.active")?.scrollIntoView({ block: "nearest", inline: "nearest" });
    turns.attach();
    if (state.view === "session" && s && Number.isInteger(s.locatedMessage)) document.getElementById(`message-${s.locatedMessage}`)?.scrollIntoView({ block: "start" });
    saveWorkspace();
  }
  function viewerState() {
    return state.viewers[state.project] ||= { tabs: [], active: null, open: false };
  }
  function openPreview(descriptor) {
    const viewer = viewerState();
    const source = descriptor.source;
    const s = session() ? rounds.displayed(session()) : null;
    const scope = source === "materials" ? s?.snapshot || s?.id : source === "changes" ? `${state.diffScope}:${state.diffScope === "run" ? state.diffSession : ""}` : "current";
    const key = JSON.stringify([descriptor.path, source === "search" ? "files" : source, scope]);
    const label = source === "materials" ? `历史材料 · ${s?.snapshot || "来源未知"}` : source === "changes" ? state.diffScope === "run" ? `执行差异 · ${data.sessions.find(x => x.id === state.diffSession)?.title || "未选择执行"}` : "当前工作区差异" : "项目当前文件";
    let tab = viewer.tabs.find(item => item.key === key);
    if (!tab) {
      tab = { id: `file-${++state.counter}`, key };
      viewer.tabs.push(tab);
    }
    Object.assign(tab, { line: null, query: "", matchCase: false }, descriptor, { label });
    viewer.active = tab.id;
    viewer.open = true;
    render();
    document.querySelector(".search-selected-line")?.scrollIntoView({ block: "center" });
  }
  function workspaceContent() {
    const viewer = viewerState();
    return `<div class="workbench-panes ${state.preview ? "with-viewer" : ""}"><section class="conversation-pane" aria-label="${state.view === "overview" ? "项目总览区" : "会话区"}">${state.view === "overview" ? overview() : state.view === "create" ? newSessionView() : sessionView()}${state.view === "session" ? turnNavigation() : ""}</section>${state.preview ? `<section class="file-viewer" aria-label="文件内容查看区"><div class="viewer-toolbar"><div class="viewer-tabs" aria-label="已打开文件">${viewer.tabs.map(tab => `<div class="viewer-tab ${tab.id === viewer.active ? "active" : ""}"><button class="viewer-tab-name" data-action="viewer-tab" data-id="${tab.id}" aria-pressed="${tab.id === viewer.active}" title="${esc(tab.path)} · ${esc(tab.label)}">${icon("file")}<span>${esc(tab.path.split("/").pop())}</span>${["materials", "changes"].includes(tab.source) ? `<small>${tab.source === "materials" ? "快照" : "差异"}</small>` : ""}</button><button class="icon-button" data-action="close-file-tab" data-id="${tab.id}" aria-label="关闭 ${esc(tab.path)} · ${esc(tab.label)}">${icon("close")}</button></div>`).join("")}</div><button class="icon-button viewer-hide" data-action="hide-viewer" aria-label="隐藏文件查看区" title="隐藏查看区，保留文件标签">${icon("panel")}</button></div>${preview()}</section>` : ""}</div>`;
  }
  function overview() {
    const p = project();
    const sessions = data.sessions.filter(s => s.project === p.id);
    return `<div class="content-scroll"><div class="page"><div class="eyebrow">PROJECT OVERVIEW</div><div class="page-heading spread"><div><h1>${esc(p.name)}</h1><p>${esc(p.note)}</p></div>${button(`${icon("plus")} 新建会话`, "new-session", `data-project="${p.id}"`, "primary")}</div><div class="row muted mono">${icon("folder")}${esc(p.path)}</div><div class="project-stats"><div><strong>${sessions.length}</strong><span>独立会话</span></div><div><strong>${sessions.filter(busy).length}</strong><span>正在执行</span></div><div><strong>${new Set(sessions.map(s => s.agent)).size}</strong><span>参与智能体</span></div></div><div class="section-heading"><h2>项目会话</h2><small>各自运行，共同参与</small></div>${sessions.length ? sessions.map(s => `<div class="task-row">${avatar(s)}<div class="grow"><strong>${esc(s.title)}</strong><small>${agentName(s)} · ${s.model.split("/")[0]}</small></div>${badge(s)}<button class="icon-button" data-action="session" data-id="${s.id}" aria-label="打开${esc(s.title)}">${icon("chevron")}</button></div>`).join("") : `<div class="empty">${icon("layers")}<h2>让第一位智能体参与进来</h2><p>项目已经就绪。按这次工作的需要，选择编码或审查智能体。</p>${button("选择智能体", "new-session", `data-project="${p.id}"`, "primary")}</div>`}<div class="notice info">一个项目可以同时运行多个独立会话。修改源目录与读取已保存的审查快照可以并行。</div></div></div>`;
  }
  function agents() {
    return `<div class="content-scroll"><div class="page"><div class="eyebrow">BUILT-IN AGENTS</div><div class="page-heading"><h1>为工作选择合适的智能体</h1><p>能力独立于项目。同一个智能体，可以参与不同项目的不同会话。</p></div><div class="card-grid">${["code", "review"].map(agent => `<article class="card agent-card">${avatar({agent})}<h2>${agent === "code" ? "编码智能体" : "验收与对抗审查"}</h2><div class="mono muted">${agentName({agent})}</div><p style="margin-top:15px">${agent === "code" ? "读取项目规则，定位问题、修改代码、执行检查，并留下可查看的文件差异。" : "独立核对交付物，寻找遗漏与反例，用材料和检查证据形成版本报告。"}</p><div class="row"><span class="tag">独立会话</span><span class="tag">持久运行</span></div>${button("选择项目并使用", "new-session", `data-agent="${agent}"`, "primary")}</article>`).join("")}</div><p class="footer-note">1.0 内置两个智能体。新建项目不需要绑定智能体；不提供自动派单和自定义智能体编辑器。</p></div></div>`;
  }
  function sessionMetadata(s) {
    if (!s) return '<span>交互原型 · 未接真实用量</span>';
    const count = s.messages.filter(message => message.role === "user").length;
    const value = usage.read(s);
    const number = value => value === null ? "—" : String(value);
    return `<button class="usage-stats" data-action="usage-details" aria-label="查看统计来源与未知状态"><span class="usage-group">${icon("clock")}<span>${count + " 条消息"} ${number(value.steps)} 步 · ${number(value.speed)} tok/s</span></span><span class="usage-group">${icon("layers")}<span>${number(value.tokens)} tok · 缓存命中 ${value.cache === null ? "—" : value.cache + "% · 部分"}</span></span><span class="usage-group"><svg class="usage-ring" viewBox="0 0 24 24" aria-hidden="true"><circle class="ring-track" cx="12" cy="12" r="9"/><circle class="ring-value" cx="12" cy="12" r="9" pathLength="100" stroke-dasharray="${value.context === null ? "0 100" : `${Math.min(value.context, 100)} ${100-Math.min(value.context, 100)}`}"/></svg><span>${value.context === null ? "—" : "约 " + value.context + "%"}</span></span></button><div class="usage-meta">${s.archived ? '<span>历史轮次</span>' : ""}${badge(s)}<span>${value.demo ? "演示统计 · 部分" : "统计未知"}</span></div>`;
  }
  function operationNotice() {
    const ref = state.pendingOperation;
    if (!ref) return "";
    const result = operations.lookup(ref, data.operationReceipts);
    return `<div class="operation-notice" role="status"><span>${result.status === "committed" ? "已查到原请求结果。当前页面和新草稿保持不变。" : "请求结果未知。刷新只查询，不会重新创建。"} · 静态演示</span>${result.status === "committed" ? button("查看已创建结果", "open-operation", "", "small") : button("查询原请求", "query-operation", "", "small")}${button("关闭提示", "dismiss-operation", "", "small subtle")}</div>`;
  }
  function runCreation(type, source, agent, simulation = "", sourceReportId = "") {
    if (state.pendingOperation) { toast("先查询或关闭上一次创建提示。"); return; }
    const reviewContext = "";
    const intent = operations.prepare(type, source, { requestId: crypto.randomUUID(), targetId: type === "branch" ? `s${++state.counter}` : source.id, targetAgent: agent,
      limits: { limit: state.reviewLimit, checkLimit: state.checkLimit, timeLimit: state.timeLimit }, reviewContext, sourceReportId, contextDefaults: state.contextLimits });
    state.pendingOperation = operations.reference(intent);
    if (!saveWorkspace()) { state.pendingOperation = null; toast("创建前未能保存请求，尚未创建。请检查浏览器存储。"); return; }
    if (simulation === "before") { render(); return; }
    const previousSessions = structuredClone(data.sessions);
    const previousReceipts = structuredClone(data.operationReceipts);
    const previousView = source.viewedRound;
    const result = operations.commit(intent, data.sessions, data.operationReceipts);
    if (result.status !== "committed") { state.pendingOperation = null; render(); toast("原轮未完全收尾、版本已变或来源失效，未创建。"); return; }
    if (simulation === "after" && type === "round") source.viewedRound = previousView || intent.sourceRound;
    if (!saveWorkspace()) {
      data.sessions = previousSessions; data.operationReceipts = previousReceipts;
      toast("结果未能保存，保留原页面；查询原请求后再操作。"); render(); return;
    }
    if (simulation === "after") { render(); return; }
    state.pendingOperation = null;
    if (type === "branch") navigateSession(result.targetId);
    else { state.inspector = "materials"; render(); }
    toast("已建立独立分支，背景已固定；原会话和草稿保留，未自动执行。");
  }
  function sessionOptions(s) {
    const choices = availableModels();
    const levels = models.levels(s.model);
    const locked = !state.connected || Boolean(window.WorkbenchSessionOptions.modelLock(s));
    return `<div class="new-conversation-options session-options" data-session-options="${s.id}" title="切换智能体会创建新分支；模型和思考等级用于后续执行"><select id="session-agent" aria-label="会话智能体" ${!state.connected ? "disabled" : ""}><option value="code" ${s.agent === "code" ? "selected" : ""}>编码智能体</option><option value="review" ${s.agent === "review" ? "selected" : ""}>审查智能体</option></select><select id="session-model" aria-label="会话模型" ${locked || !choices.length ? "disabled" : ""}>${!choices.includes(s.model) ? `<option value="${esc(s.model)}" selected disabled>${esc(modelName(s.model))} · 不可用</option>` : ""}${choices.map(model => `<option value="${esc(model)}" ${s.model === model ? "selected" : ""}>${esc(modelName(model))}</option>`).join("")}</select><select id="session-thinking" aria-label="会话思考等级" ${locked || !choices.includes(s.model) || levels.length < 2 ? "disabled" : ""}>${levels.length ? levels.map(level => `<option value="${level}" ${level === s.thinking ? "selected" : ""}>${models.label(s.model, level)}</option>`).join("") : '<option value="">能力未知</option>'}</select></div>`;
  }
  function branchHistory(s) {
    if (!s.branchFrom) return "";
    const original = data.sessions.find(item => item.id === s.branchFrom && item.project === s.project);
    return `<div class="branch-origin">${icon("branch")}<span>分支自：${esc(s.branchTitle)}${original ? "" : "（原会话已删除）"}</span>${original ? button("查看原会话", "session", `data-id="${original.id}"`, "small subtle") : ""}</div>${s.branchContext?.length ? `<details class="tool-group branch-history"><summary>冻结的分支背景 · ${s.branchContext.length} 条（不作审查证据） ${icon("down")}</summary><div class="branch-messages">${s.branchContext.map(message => `<article><strong>${message.role === "user" ? "你" : agentName(message)}</strong><p class="message-text">${esc(message.text)}</p></article>`).join("")}</div></details>` : ""}`;
  }
  function warning(s) {
    if (s.recoveryBlocked) return `<div class="notice error">历史执行仍有未收尾记录，当前会话暂不能执行。${button("查看待核对记录", "old-round-details", "", "small")}</div>`;
    if (s.status === "unknown") return `<div class="notice error">上次命令可能已产生效果，但没有保存完整结果。请核对日志和材料，再结束旧执行。<div class="row">${button("查看核对详情", "reconcile", "", "small")}${button("查看日志", "logs", "", "small")}</div></div>`;
    if (s.status === "blocked") return `<div class="notice">${esc(s.blockReason || "目录被其他编码会话占用。本次请求尚未开始，不会自动排队。")}<div class="row">${s.blocker ? button("查看占用会话", "session", `data-id="${s.blocker}"`, "small") : ""}${button("重新尝试", "retry", "", "small")}</div></div>`;
    if (s.status === "stopping") return '<div class="notice">正在停止此会话，等待后台任务、进程和归档收尾。其他会话继续运行。</div>';
    if (["failed", "stopped"].includes(s.status)) return `<div class="notice">${s.status === "failed" ? "本次执行失败，已有记录保留。" : "执行已停止，历史与已发生的文件修改保留。"}可以检查现状后继续发送消息。</div>`;
    return "";
  }
  function sessionView() {
    const s = session();
    if (!s) return overview();
    if (s.agent === "review") return reviewView(s);
    if (!s.messages.length) return `<div class="new-conversation"><div class="new-conversation-inner">${branchHistory(s)}${warning(s)}<div class="new-conversation-heading"><h1>从一个明确的任务开始</h1><p>描述任务、约束和验收要求。</p></div>${composer(s)}</div></div>`;
    return `<div class="content-scroll chat-scroll">${branchHistory(s)}${warning(s)}${s.messages.map((m, i) => `<article class="message" id="message-${i}" data-turn tabindex="-1">${m.role === "user" ? '<span class="avatar-user">我</span>' : avatar(s)}<div class="message-main"><div class="message-name">${m.role === "user" ? "你" : "lg-codeing-agent"}<time>${i ? "刚刚" : "10:42"}</time>${m.mode ? `<span class="tag">${esc(m.mode)}</span>` : ""}</div><div class="message-text">${esc(m.text)}</div></div></article>`).join("")}${s.messages.length ? `<article class="message">${avatar(s)}<div class="message-main"><div class="message-name">执行过程 <span class="tag">样例记录</span></div><details class="tool-group" open><summary><span class="row">${icon("code")} 已读取规则并定位导出实现</span><span>3 个步骤 ${icon("down")}</span></summary><div class="tool-step"><span class="check-circle">${icon("check")}</span><span class="mono">read</span><span>AGENTS.md</span><span class="elapsed">0.2s</span></div><div class="tool-step"><span class="check-circle">${icon("check")}</span><span class="mono">search</span><span>exportTickets</span><span class="elapsed">0.4s</span></div><div class="tool-step"><span class="check-circle">${icon("check")}</span><span class="mono">read</span><span>src/services/export.ts</span><span class="elapsed">0.1s</span></div></details><p class="message-text">接下来按三个验收点完成修改：</p><ol class="plan-list"><li><span class="check-circle">${icon("check")}</span>让导出使用当前筛选条件</li><li><span class="number">2</span>补齐 UTF-8 BOM 与空数据处理</li><li><span class="number">3</span>运行导出检查，核对变更范围</li></ol>${s.status === "running" ? '<div class="working"><i class="dot running"></i>正在处理导出边界… <span class="muted">演示状态</span></div>' : s.status === "done" ? `<div class="notice info">样例执行已完成。检查：3 项通过；未连接真实测试环境。${button("查看本次变更", "changes", "", "small")}</div>` : ""}</div></article>` : '<div class="empty"><h2>从一个明确的任务开始</h2><p>描述你希望完成的改动、约束和验收要求。</p></div>'}</div>${composer(s)}`;
  }
  function composer(s) {
    const queueLocked = !state.connected || ["stopping", "unknown"].includes(s.status) || s.recoveryBlocked;
    const queued = s.queue.length ? `<div class="queue" aria-label="待发送消息"><div class="spread"><span>排队消息 · ${s.queue.length} · 当前任务完成后依次发送</span><div>${!busy(s) ? button("继续队列", "continue-queue", queueLocked ? "disabled" : "", "small") : ""}${button("清空", "clear-queue", queueLocked ? "disabled" : "", "subtle small")}</div></div>${s.queue.map((text, i) => `<div class="queue-item"><span class="queue-copy" title="${esc(text)}">${esc(text)}</span><div class="queue-actions"><button class="text-button" data-action="insert-queued" data-index="${i}" ${queueLocked || s.status !== "running" ? "disabled" : ""} title="等当前模型请求或工具步骤结束后插入，不中断当前操作">立即插入</button><button class="text-button" data-action="edit-queued" data-index="${i}" ${queueLocked ? "disabled" : ""}>编辑</button><button class="text-button" data-action="withdraw" data-index="${i}" ${queueLocked ? "disabled" : ""}>撤回</button></div></div>`).join("")}</div>` : "";
    const disabled = !state.connected || ["stopping", "unknown"].includes(s.status);
    return `<div class="composer-wrap">${queued}${composerTools.chips(s, data.files[s.project] || [])}<div class="composer"><textarea id="composer" data-session="${s.id}" aria-label="任务输入" placeholder="${s.status === "running" ? "继续发送消息，默认排队；可在队列中立即插入…" : "描述下一步，或补充当前任务的要求…"}" ${disabled ? "disabled" : ""}>${esc(s.draft)}</textarea><div class="composer-toolbar"><div class="row">${composerTools.controls(s, !state.connected || Boolean(window.WorkbenchSessionOptions.modelLock(s)))}</div><div class="row composer-send-options">${sessionOptions(s)}${busy(s) ? button(`${icon("stop")} 停止`, "stop", `data-id="${s.id}" ${s.status === "stopping" ? "disabled" : ""}`, "small") : ""}<button class="send" data-action="send" aria-label="发送任务" ${disabled ? "disabled" : ""}>${icon("arrow")}</button></div></div></div><div class="composer-footnote"><span>${busy(s) ? "Enter 排队发送 · 可从队列立即插入 · Shift + Enter 换行" : "Enter 发送 · Shift + Enter 换行"}</span></div></div>`;
  }
  function turnNavigation() {
    const s = session();
    if (!s) return "";
    const items = turns.entries(s.messages).map(item => ({ ...item, action: "turn-jump" }));
    if (!items.length) return "";
    return `<nav class="turn-navigation" aria-label="对话消息快速定位"><div class="turn-ticks">${items.map((item, i) => `<button class="turn-tick" data-action="${item.action}" data-message-index="${item.index}" data-preview-title="${esc(item.title)}" data-preview-reply="${esc(item.reply || "暂无回复")}" aria-label="${esc(`定位第 ${i + 1} 条消息：${item.title}`)}"></button>`).join("")}</div><div class="turn-preview" aria-hidden="true"><strong></strong><p></p></div></nav>`;
  }
  function reviewView(s) {
    if (!s.messages.length) return `<div class="new-conversation"><div class="new-conversation-inner">${branchHistory(s)}${warning(s)}<div class="new-conversation-heading"><h1>想审查什么？</h1><p>直接说明要求，提供需要检查的内容。</p></div>${composer(s)}</div></div>`;
    return `<div class="content-scroll chat-scroll">${branchHistory(s)}${warning(s)}${s.messages.map((m, i) => `<article class="message" id="message-${i}" data-turn tabindex="-1">${m.role === "user" ? '<span class="avatar-user">我</span>' : avatar(s)}<div class="message-main"><div class="message-name">${m.role === "user" ? "你" : agentName(s)}${m.mode ? `<span class="tag">${esc(m.mode)}</span>` : ""}</div><div class="message-text">${esc(m.text)}</div></div></article>`).join("")}${s.status === "running" ? '<div class="working"><i class="dot running"></i>正在审查… <span class="muted">演示状态</span></div>' : ""}</div>${composer(s)}`;
  }
  function inspector() {
    const s = state.view === "session" && session() ? rounds.displayed(session()) : null;
    const tabs = [["files", "文件"], ["search", "搜索"], ["changes", "变更"], ...(s?.agent === "review" ? [["materials", "历史材料"]] : [])];
    if (!tabs.some(([key]) => key === state.inspector)) state.inspector = "files";
    const files = data.files[state.project] || [];
    const list = state.inspector === "materials" ? files.filter(f => s.snapshot && (s.material || "").includes(f.path)) : state.inspector === "changes" ? files.filter(f => f.change && (state.diffScope === "workspace" || state.diffSession === "s1")) : files;
    let content = "";
    if (state.inspector === "search") {
      const search = state.projectSearch[state.project] ||= { query: "", path: "", matchCase: false };
      content = `<div class="project-search"><label class="search-box">${icon("search")}<input id="project-search-query" aria-label="搜索项目文件内容" placeholder="搜索文件内容" value="${esc(search.query)}" maxlength="200"><button class="search-option" data-action="search-case" aria-label="区分大小写" aria-pressed="${search.matchCase}" title="区分大小写">Aa</button><button class="icon-button" data-action="search-clear" aria-label="清空搜索" title="清空搜索">${icon("close")}</button></label><label class="search-path"><span>文件范围</span><input id="project-search-path" aria-label="按路径包含文字筛选" placeholder="路径包含，如 src/" value="${esc(search.path)}"></label><p class="field-hint">当前项目文件 · 只读样例，不搜索审查快照</p></div><div id="project-search-results" aria-live="polite">${searchResults()}</div>`;
    } else {
      if (state.inspector === "changes") content += `<select id="diff-scope" aria-label="差异范围"><option value="run" ${state.diffScope === "run" ? "selected" : ""}>指定执行差异</option><option value="workspace" ${state.diffScope === "workspace" ? "selected" : ""}>当前工作区差异</option></select>${state.diffScope === "run" ? `<select id="diff-session" aria-label="差异所属执行">${data.sessions.filter(x => x.project === state.project && x.agent === "code").map(x => `<option value="${x.id}" ${state.diffSession === x.id ? "selected" : ""}>${esc(x.title)} · 本次执行</option>`).join("")}</select>` : ""}<p class="field-hint" style="margin-bottom:13px">${state.diffScope === "run" ? "样例归档差异；外部修改的归因可能不确定。" : "工作区可能包含用户与其他会话的修改。"}</p>`;
      if (state.inspector === "materials") content += `<span class="tag green">${esc(s.snapshot || "尚未取材")}</span><p class="field-hint" style="margin:10px 0">${s.snapshot ? "历史只读快照 · 不代表后续消息或当前文件" : "可在对话中提供材料，或通过＋选择项目文件。原型不读取磁盘。"}</p>`;
      let folder = null;
      content += list.map(f => {
        const dir = f.path.includes("/") ? f.path.slice(0, f.path.lastIndexOf("/")) : "";
        const header = dir && folder !== dir ? `<div class="file-folder">${icon("down")}${icon("folder")}${esc(dir)}</div>` : "";
        folder = dir;
        return `${header}<button class="file-row${dir ? " nested" : ""}" data-action="file" data-path="${esc(f.path)}" data-source="${state.inspector}" title="${esc(f.path)}">${icon("file")}<span class="file-name">${esc(f.path.split("/").pop())}</span>${f.change && state.inspector !== "materials" ? `<span class="change-marker ${f.change === "A" ? "add" : ""}">${f.change}</span>` : ""}${state.inspector === "changes" ? `<span class="diff-stat"><span class="plus">+${f.plus}</span> <span class="minus">−${f.minus}</span></span>` : ""}</button>`;
      }).join("") || '<p class="field-hint">此范围暂无文件。新项目只保存演示资料。</p>';
    }
    return `<aside class="inspector" aria-label="项目资源"><div class="tabs">${tabs.map(([key, title]) => `<button class="tab ${state.inspector === key ? "active" : ""}" data-action="inspector-tab" data-tab="${key}">${title}</button>`).join("")}</div><div class="inspector-body">${content}</div></aside>`;
  }
  function matchingRanges(text, query, matchCase) {
    if (!query) return [];
    const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), matchCase ? "gu" : "giu");
    return [...text.matchAll(pattern)].map(match => [match.index, match.index + match[0].length]);
  }
  function highlighted(text, ranges) {
    let result = "";
    let end = 0;
    for (const [start, next] of ranges) {
      result += esc(text.slice(end, start)) + `<mark>${esc(text.slice(start, next))}</mark>`;
      end = next;
    }
    return result + esc(text.slice(end));
  }
  function searchResults() {
    const search = state.projectSearch[state.project];
    const files = data.files[state.project] || [];
    if (!files.length) return '<p class="search-empty">此项目暂无文件。</p>';
    if (!search.query) return '<p class="search-empty">输入关键词，搜索当前项目文件内容。</p>';
    const groups = files.filter(file => file.path.toLowerCase().includes(search.path.toLowerCase())).map(file => ({
      path: file.path,
      lines: file.text.split("\n").map((text, index) => ({ text, line: index + 1, ranges: matchingRanges(text, search.query, search.matchCase) })).filter(line => line.ranges.length),
    })).filter(file => file.lines.length);
    const count = groups.reduce((total, file) => total + file.lines.reduce((sum, line) => sum + line.ranges.length, 0), 0);
    return `<p class="search-count">${groups.length} 个文件中有 ${count} 处匹配</p>${groups.length ? groups.map(file => `<details class="search-file" open><summary title="${esc(file.path)}">${icon("file")}<span>${esc(file.path)}</span><small>${file.lines.reduce((sum, line) => sum + line.ranges.length, 0)}</small></summary>${file.lines.map(line => `<button class="search-hit" data-action="search-hit" data-path="${esc(file.path)}" data-line="${line.line}" aria-label="打开 ${esc(file.path)} 第 ${line.line} 行" title="第 ${line.line} 行：${esc(line.text)}"><span class="search-line-number">${line.line}</span><span class="search-snippet">${highlighted(line.text, line.ranges)}</span></button>`).join("")}</details>`).join("") : '<p class="search-empty">没有匹配内容，试试其他关键词或文件范围。</p>'}`;
  }
  function preview() {
    const { path, source } = state.preview;
    const scope = JSON.parse(state.preview.key)[2];
    if (source === "materials" && !data.sessions.some(s => s.project === state.project && s.agent === "review" && [s, ...(s.reviewRounds || [])].some(r => r.snapshot === scope && (r.material || "").includes(path)))) return '<div class="empty">此快照材料缺失，未改用当前文件。可关闭此标签或返回原轮次核对。</div>';
    if (source === "changes" && scope !== "workspace:" && scope !== "run:s1") return '<div class="empty">此执行没有归档差异样例，未改用当前工作区。</div>';
    const file = (data.files[state.project] || []).find(f => f.path === path);
    if (!file) return '<div class="empty">此文件不存在或来源已失效。标签已保留，可关闭后重新选择文件。</div>';
    const snapshot = source === "materials";
    const diff = source === "changes";
    const text = snapshot ? file.before || file.text : file.text;
    return `<div class="preview-header"><div class="spread"><div><h2 title="${esc(file.path)}">${esc(file.path)}</h2><p class="field-hint" style="margin-top:8px">${esc(state.preview.label)} · 样例 · 只读</p></div></div></div><div class="content-scroll"><pre class="preview-code">${diff ? (file.before || "// 原版本\n").split("\n").map(line => `<span class="diff-line remove">− ${esc(line)}</span>`).join("") + file.text.split("\n").map(line => `<span class="diff-line add">+ ${esc(line)}</span>`).join("") : text.split("\n").map((line, i) => `<span class="code-line ${state.preview.line === i + 1 ? "search-selected-line" : ""}" data-line="${i + 1}"><span class="line-number">${i + 1}</span><span>${source === "search" ? highlighted(line, matchingRanges(line, state.preview.query, state.preview.matchCase)) : esc(line)}</span></span>`).join("")}</pre></div>`;
  }
  function settings() {
    const tabs = [["providers", "模型连接"], ["models", "常用与默认模型"], ["basic", "基础配置"]];
    return `<section class="settings"><div class="settings-head"><div class="eyebrow">WORKSPACE SETTINGS</div><h1>设置</h1><p>统一配置模型连接和全局运行参数，所有项目共用。原型不保存真实密钥。</p><nav class="settings-tabs" aria-label="设置分类">${tabs.map(([id, title]) => `<button data-action="settings-tab" data-tab="${id}" class="${state.settingsTab === id ? "active" : ""}">${title}</button>`).join("")}</nav></div>${state.settingsTab === "providers" ? `<div class="provider-layout"><aside class="provider-sidebar"><label class="search-box">${icon("search")}<input id="provider-search" value="${esc(state.providerQuery)}" placeholder="搜索 42 个接入项" aria-label="搜索模型厂商"></label><div class="provider-filter">${[["all", "全部"], ["configured", "已配置"], ["new", "未配置"]].map(([id, text]) => `<button data-action="provider-filter" data-filter="${id}" class="${state.providerFilter === id ? "active" : ""}">${text}</button>`).join("")}</div><div class="provider-list" id="provider-list">${providerList()}</div></aside><div class="provider-content">${providerForm()}</div></div>` : simpleSettings()}</section>`;
  }
  function providerList() {
    return data.providers.filter(([id, name]) => `${id} ${name}`.toLowerCase().includes(state.providerQuery.toLowerCase()) && (state.providerFilter === "all" || (state.providerFilter === "configured" ? state.config[id].configured : !state.config[id].configured))).map(([id, name]) => `<button class="provider-item ${state.provider === id ? "active" : ""}" data-action="provider" data-id="${id}"><span class="provider-letter">${esc(name[0])}</span><span class="grow"><strong>${name}</strong><small>${state.configDrafts[id] ? "有未保存修改" : state.config[id].configured ? state.config[id].enabled ? "已配置" : "已停用" : "未配置"}</small></span>${state.config[id].configured && state.config[id].enabled ? '<i class="dot running"></i>' : ""}</button>`).join("") || '<div class="field-hint" style="padding:12px">没有匹配的接入项</div>';
  }
  function providerForm() {
    const id = state.provider;
    const c = state.config[id];
    const draft = state.configDrafts[id] || {};
    const v = { ...c.values, ...draft };
    const mode = v.mode || c.mode;
    const modeNames = { key: "API Key", oauth: "OAuth 授权", aws: "AWS 认证", azure: "Azure 连接", vertex: "Google Vertex", cloudflare: "Cloudflare Token", gateway: "Cloudflare Gateway" };
    let auth = "";
    if (mode === "oauth") {
      const status = state.auth[id];
      auth = `<div class="auth-box"><h3>浏览器授权 · 模拟流程</h3><p class="field-hint" style="margin-top:8px">保留厂商交互入口；此原型不会打开真实授权链接或获取令牌。</p>${status === "pending" ? `<div class="code">DEMO-2026</div><p class="field-hint">演示授权会话已建立，可模拟填写授权结果或取消。</p>${field("手动验证码（演示）", "authCode", "", "text", "不填写真实验证码")}${button("模拟授权成功", "auth-success", "", "small primary")} ${button("取消授权", "auth-cancel", "", "small")}` : status === "success" ? '<p style="margin-top:12px" class="tag green">模拟授权已完成 · 未保存真实令牌</p>' : `${button("开始模拟授权", "auth-start", "", "small")}${status === "canceled" ? '<p class="field-hint">授权已取消，原配置不变。</p>' : ""}`}</div>`;
    } else if (mode === "aws") {
      auth = `<label class="field"><span>凭据方式</span><select name="credentialMode">${["Bearer Token", "AWS Profile", "AWS 凭据链"].map(x => `<option ${v.credentialMode === x ? "selected" : ""}>${x}</option>`).join("")}</select></label>${field("区域", "region", v.region || "us-east-1")}${v.credentialMode === "AWS Profile" ? field("Profile 名称", "profile", v.profile || "default") : v.credentialMode === "AWS 凭据链" ? '<div class="notice info">真实产品会使用明确启用的服务端凭据链；原型不读取本机 AWS 配置。</div>' : field("Bearer Token", "secret", "", "password")}`;
    } else if (mode === "vertex") {
      auth = `<label class="field"><span>凭据方式</span><select name="credentialMode">${["API Key", "ADC", "服务账号文件"].map(x => `<option ${v.credentialMode === x ? "selected" : ""}>${x}</option>`).join("")}</select></label><div class="field-inline">${field("Google Cloud 项目 ID", "cloudProject", v.cloudProject || "")}${field("地区", "region", v.region || "us-central1")}</div>${v.credentialMode === "服务账号文件" ? field("服务端凭据文件路径", "credentialPath", v.credentialPath || "") : v.credentialMode === "ADC" ? '<div class="notice info">真实产品从服务端已准备的 ADC 读取认证；这里不访问本机凭据。</div>' : field("API Key", "secret", "", "password")}`;
    } else if (mode === "azure") {
      auth = `${field("API Key", "secret", "", "password")}${field("资源名或 Base URL", "baseUrl", v.baseUrl || "")}${field("API 版本", "apiVersion", v.apiVersion || "")}${area("模型 ID → 部署名", "deployments", v.deployments || "", "填写目录中的模型 ID = 你的部署名")}`;
    } else if (["cloudflare", "gateway"].includes(mode)) {
      auth = `${field("API Token", "secret", "", "password")}${field("Account ID", "accountId", v.accountId || "")}${mode === "gateway" ? field("Gateway ID", "gatewayId", v.gatewayId || "") : ""}`;
    } else {
      auth = `${field("API Key", "secret", "", "password", c.configured ? "已保存演示凭据，不回显。留空保留；保存后输入框清空。" : "请只输入任意演示值，不要输入真实密钥。")}${["openai", "deepseek", "anthropic", "openrouter"].includes(id) ? field("自定义 API 地址（可选）", "baseUrl", v.baseUrl || "", "url", "留空使用该厂商默认地址；专用授权地址不在此覆盖。") : '<p class="field-hint">此接入项沿用专用默认地址，原型不提供通用地址覆盖。</p>'}`;
    }
    return `<div class="provider-form"><div class="provider-title"><span class="provider-letter">${c.name[0]}</span><div><h2>${c.name}</h2><p>${id} ${id === "openai-codex" ? "· legacy" : ""}</p></div><span class="tag ${c.configured && c.enabled ? "green" : ""}">${c.configured ? c.enabled ? "已配置" : "已停用" : "未配置"}</span></div><form id="provider-form"><div class="form-section"><h3>连接与认证</h3><label class="field"><span>认证方式</span><select name="mode">${c.auth.map(m => `<option value="${m}" ${m === mode ? "selected" : ""}>${modeNames[m]}</option>`).join("")}</select></label>${auth}<label class="check-label"><input type="checkbox" name="enabled" ${v.enabled === undefined ? c.enabled ? "checked" : "" : v.enabled ? "checked" : ""}>启用此连接</label></div><div class="divider"></div><div class="spread"><h3>模型目录</h3>${button("刷新目录", "refresh-models", "", "small subtle")}</div><p class="field-hint" style="margin-top:7px">当前 pi-ai 源码目录 · ${(models.catalog[id] || []).length} 个聊天模型。能力按源码标注，未联网验证。${c.refreshed ? "已重新展示本地目录。" : ""}</p><div style="max-height:320px;overflow:auto">${(models.catalog[id] || []).map(model => `<div class="model-row">${icon("layers")}<div class="grow"><strong>${esc(model.name)}</strong><small>${esc(model.id)}</small><small>${model.reasoning ? "思考档：" + model.levels.map(level => models.label(`${id}/${model.id}`, level)).join(" / ") : "不支持思考"}</small><small>目录上下文：${models.tokens(model.contextWindow)} · 最大输出：${models.tokens(model.maxTokens)}</small><small>使用上限：${models.tokens(state.contextLimits[`${id}/${model.id}`] || model.contextWindow)}${state.contextLimits[`${id}/${model.id}`] ? " · 自定义" : " · 跟随目录"} <button class="text-button" type="button" data-action="model-context" data-ref="${esc(`${id}/${model.id}`)}">配置上下文</button></small></div><button class="text-button" data-action="favorite-provider" data-model="${esc(model.id)}">${c.favorites.includes(model.id) ? "已选常用" : "设为常用"}</button></div>`).join("") || '<p class="field-hint">当前源码没有静态聊天模型目录，需接入真实服务后获取。</p>'}</div><div class="notice info">上下文设置修改后，仅对新建会话生效。</div><p class="field-hint">验证状态：${c.verified ? "模拟验证成功" : c.testFailed ? "模拟验证失败，请检查参数" : "尚未验证"} · 测试仅为模拟。</p><div class="settings-actions"><button class="btn primary" type="submit">保存当前</button>${button("保存全部修改", "save-all")}${button("测试所选模型", "test-model")}${button("清除凭据", "clear-credential", "", "subtle")}</div></form><p class="footer-note">每个接入项一份连接，可使用多个模型。全部修改只保留在内存，刷新恢复演示样例。</p></div>`;
  }
  function simpleSettings() {
    const tab = state.settingsTab;
    const content = tab === "models" ? `<div class="settings-simple"><h2 id="settings-default" tabindex="-1">常用与默认模型</h2><p class="field-hint" style="margin:12px 0 22px">默认值只用于新会话；不会替换已有会话的模型。</p><form id="default-form"><label class="field"><span>全局默认模型</span><select name="defaultModel">${availableModels().length ? availableModels().map(model => `<option value="${esc(model)}" ${state.defaultModel === model ? "selected" : ""}>${esc(modelName(model))}</option>`).join("") : '<option value="">没有已启用连接</option>'}</select></label><button class="btn primary" ${!availableModels().length ? "disabled" : ""}>保存默认模型</button></form><div class="section-heading"><h2 id="settings-configured" tabindex="-1">已配置模型</h2></div>${Object.entries(state.config).filter(([, c]) => c.configured).map(([id, c]) => `<div class="model-row"><div class="grow"><strong>${c.name}</strong><small>${c.enabled ? "已启用" : "已停用"} · ${c.favorites.length ? `已选 ${c.favorites.length} 个常用模型` : "未选常用"}</small></div><button class="text-button" data-action="provider-settings" data-id="${id}">管理模型</button></div>`).join("")}</div>`
    : `<div class="settings-simple"><h2>基础配置</h2><p class="field-hint" style="margin:12px 0 22px">所有项目共用，不提供项目覆盖。运行参数与限额仅在本次演示中保存，刷新恢复默认值。</p><form id="basic-form"><h3 id="settings-commands" tabindex="-1" style="margin-bottom:18px">命令运行</h3>${field("PowerShell 程序路径", "powershell", state.powershell)}${field("Bash 程序路径（可选）", "bash", state.bash)}${field("命令默认超时（秒）", "commandTimeout", state.commandTimeout, "number")}<div class="divider"></div><h3 id="settings-capacity" tabindex="-1" style="margin-bottom:18px">全局执行限额</h3>${field("全局同时执行上限", "globalCap", state.globalCap, "number")}<p class="field-hint">降低上限不会停止已运行的任务；新任务等待空出名额。</p><button class="btn primary" type="submit">保存基础配置</button></form><div class="divider"></div><h3 id="settings-environment" tabindex="-1">环境状态</h3><p class="field-hint" style="margin:12px 0">以下为环境状态示例，未探测你的电脑。</p>${[["PowerShell", "可用 · 示例", "green"], ["Git", "可用 · 示例", "green"], ["ripgrep / rg", "可用 · 示例", "green"], ["Bash", "未配置 · 示例", "amber"]].map(([name, label, color]) => `<div class="environment-row"><div>${name}<small>服务端本机环境</small></div><span class="tag ${color}">${label}</span></div>`).join("")}<div class="notice">缺少命令工具时显示环境说明，不自动安装。平台数据与项目工作目录分开保存。</div>${button("查看维护说明", "maintenance")}</div>`;
    const sections = tab === "models" ? [["default", "常用与默认模型"], ["configured", "已配置模型"]] : [["commands", "命令运行"], ["capacity", "全局执行限额"], ["environment", "环境状态"]];
    return `<div class="provider-layout settings-directory-layout"><nav class="provider-sidebar settings-directory" aria-label="配置目录">${sections.map(([id, label], index) => `<button type="button" class="provider-item ${index === 0 ? "active" : ""}" data-action="settings-section" data-section="settings-${id}" aria-controls="settings-${id}" ${index === 0 ? 'aria-current="location"' : ""}>${label}</button>`).join("")}</nav>${content}</div>`;
  }
  function navigateSession(id) {
    const s = data.sessions.find(x => x.id === id);
    if (!s) return;
    window.WorkbenchReviewChat.migrate(s);
    state.project = s.project; state.session = id; state.view = "session"; state.preview = null;
    restoreResourceView(s);
    project().expanded = true;
    render();
  }
  function restoreResourceView(owner = project()) {
    state.inspector = project()?.inspector || (owner?.agent === "review" ? "materials" : "files");
    state.diffScope = owner?.diffScope === "workspace" ? "workspace" : "run";
    state.diffSession = data.sessions.find(s => s.id === owner?.diffSession && s.project === state.project && s.agent === "code")?.id || data.sessions.find(s => s.project === state.project && s.agent === "code")?.id || "";
  }
  function openSettings() {
    if (state.view !== "settings") state.back = { view: state.view, project: state.project, session: state.session, preview: state.preview, inspector: state.inspector };
    state.view = "settings"; state.preview = null; render();
  }
  function newSession(projectId = state.project, agent) {
    if (!data.projects.some(p => p.id === projectId)) { toast("请先新建项目。"); return; }
    if (state.newSessionDraft.project) state.newSessionDrafts[state.newSessionDraft.project] = state.newSessionDraft;
    if (state.newSessionDraft.project !== projectId) state.newSessionDraft = state.newSessionDrafts[projectId] || {
      project: projectId, agent: "code", model: state.defaultModel,
      thinking: "medium", task: "",
    };
    if (agent) state.newSessionDraft.agent = agent;
    state.project = projectId; state.session = null; state.view = "create"; state.inspector = "files";
    restoreResourceView();
    project().expanded = true;
    viewerState().open = false;
    render();
    document.querySelector("#new-task")?.focus();
  }
  function newSessionView() {
    const v = state.newSessionDraft;
    const choices = availableModels();
    const selectedModel = v.model || "";
    const missingModel = !choices.includes(selectedModel);
    const levels = missingModel ? [] : models.levels(selectedModel);
    v.thinking = missingModel ? "" : models.normalize(selectedModel, v.thinking);
    return `<div class="new-conversation"><div class="new-conversation-inner"><div class="new-conversation-heading">${icon("layers")}<h1>这次想完成什么？</h1><p>选择智能体，直接开始这次工作。</p></div><form id="new-session-form"><div class="new-conversation-project"><label><span>项目</span><select name="project" aria-label="所属项目">${data.projects.map(p => `<option value="${p.id}" ${p.id === state.project ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label></div>${composerTools.chips(v, data.files[state.project] || [])}<div class="composer"><textarea id="new-task" name="task" aria-label="新会话任务" placeholder="描述任务、要求，以及你期望的结果…">${esc(v.task || "")}</textarea><div class="composer-toolbar">${composerTools.controls(v)}<div class="new-conversation-options"><select name="agent" aria-label="智能体"><option value="code" ${v.agent !== "review" ? "selected" : ""}>编码智能体</option><option value="review" ${v.agent === "review" ? "selected" : ""}>审查智能体</option></select><select name="model" aria-label="模型">${missingModel ? `<option value="" selected disabled>${selectedModel ? "原模型不可用，请重新选择" : "尚无可用模型"}</option>` : ""}${choices.map(m => `<option value="${m}" ${m === selectedModel ? "selected" : ""}>${esc(modelName(m))}</option>`).join("")}</select><select name="thinking" aria-label="思考档" ${levels.length < 2 ? "disabled" : ""}>${levels.length ? levels.map(level => `<option value="${level}" ${level === v.thinking ? "selected" : ""}>${models.label(selectedModel, level)}</option>`).join("") : '<option value="">能力未知</option>'}</select></div><button type="submit" class="send" aria-label="发送新任务" ${!choices.length || !state.connected ? "disabled" : ""}>${icon("arrow")}</button></div></div><div class="composer-footnote"><span>Enter 发送 · Shift + Enter 换行</span><span>${v.agent === "review" ? "发送后直接发起审查" : "发送后创建会话"}</span></div>${missingModel ? `<div class="notice">${choices.length ? "原模型已不可用，请手动选择模型。" : "先配置一个模型连接，任务草稿会保留。"}${button("去配置模型", "configure-from-create", "", "small")}</div>` : ""}</form></div></div>`;
  }
  function canStart(s, needsSource = false) {
    if (!state.connected) return "当前连接已断开，请先恢复连接。";
    if (s.pendingApproval || s.settling) return "尚有审批或后台收尾未处理，请先核对。";
    if (data.sessions.some(item => item.project === s.project && (item.recoveryBlocked || item.reviewRounds?.some(rounds.unsettled)))) return "项目历史执行仍有待核对记录，请先处理，未自动恢复执行。";
    const id = s.model.split("/")[0];
    if (!models.get(s.model) || !state.config[id]?.configured || !state.config[id].enabled) return "原模型连接不可用，请去设置修复；不会自动换模型。";
    const running = data.sessions.filter(x => x.id !== s.id && busy(x));
    const owner = data.sessions.find(x => x.id !== s.id && x.project === s.project && rounds.unsettled(x) && (x.agent === "code" || x.reviewChat || !x.snapshot));
    s.blocker = owner?.id;
    if ((s.agent === "code" || needsSource) && owner) return `工作目录由“${owner.title}”占用。本次尚未开始，请在其收尾后重试。`;
    if (running.length >= state.globalCap) return "执行名额已满。本次尚未开始，空出名额后可手动重试。";
    return "";
  }
  function start(s, needsSource = false) {
    const reason = canStart(s, needsSource || s.reviewChat);
    if (reason) { s.blockReason = reason; s.status = "blocked"; render(); return false; }
    if (s.reviewChat) { needsSource = false; delete s.usageSample; }
    s.status = needsSource ? "capturing" : "running";
    s.generation = (s.generation || 0) + 1;
    const generation = s.generation;
    render();
    if (needsSource) setTimeout(() => {
      if (s.generation !== generation || s.status !== "capturing") return;
      s.snapshot = `SNAP-DEMO-${s.id}-${s.round}`; s.status = "running"; render();
    }, 850);
    return true;
  }
  function complete(s, outcome) {
    if (!s || !["running", "capturing"].includes(s.status)) { toast("请选择正在执行的会话，再模拟完成。"); return; }
    if (messageQueue.boundary(s)) { render(); toast("已在步骤边界接收插队消息，当前任务继续；处理后再模拟完成。"); return; }
    s.generation = (s.generation || 0) + 1;
    const generation = s.generation;
    s.status = "finishing";
    render();
    setTimeout(() => {
      if (s.generation !== generation || s.status !== "finishing") return;
      if (s.agent === "review") { s.status = "done"; s.messages.push({ role: "agent", text: window.WorkbenchReviewChat.result(outcome) }); }
      else {
        s.status = "done";
        s.messages.push({ role: "agent", text: "演示执行已完成。样例记录显示已处理筛选、UTF-8 BOM 与空数据分支，检查结果可在右侧查看。原型未实际修改文件或执行命令。" });
      }
      if (s.queue.length && start(s)) { const next = s.queue.shift(); s.messages.push({ role: "user", text: next, mode: "队列已消费" }); }
      render();
    }, 650);
  }
  function saveProvider(id, draft) {
    const c = state.config[id];
    if (data.sessions.some(s => rounds.unsettled(s) && s.model.startsWith(`${id}/`))) return `${c.name}：连接仍被会话或队列使用`;
    const mode = draft.mode || c.mode;
    if (mode === "oauth" && !c.configured && state.auth[id] !== "success") return `${c.name}：请先完成模拟授权`;
    const needsKey = !["oauth"].includes(mode) && !["AWS Profile", "AWS 凭据链", "ADC", "服务账号文件"].includes(draft.credentialMode);
    if (!c.configured && needsKey && !draft.secret) return `${c.name}：请填写演示凭据`;
    const required = mode === "aws" ? ["region"] : mode === "vertex" ? ["cloudProject", "region", ...(draft.credentialMode === "服务账号文件" ? ["credentialPath"] : [])] : mode === "azure" ? ["baseUrl", "apiVersion", "deployments"] : mode === "gateway" ? ["accountId", "gatewayId"] : mode === "cloudflare" ? ["accountId"] : [];
    if (required.some(key => !draft[key]?.trim())) return `${c.name}：请补齐专用连接字段`;
    const { secret: _secret, authCode: _code, ...safe } = draft;
    c.values = safe; c.mode = mode; c.configured = true; c.enabled = draft.enabled !== false; c.verified = false; c.testFailed = false;
    delete state.configDrafts[id];
    return "";
  }
  let projectFlyout = null;
  let projectFlyoutTimer;
  function closeProjectFlyout(restoreFocus = false) {
    clearTimeout(projectFlyoutTimer);
    if (!projectFlyout) return;
    const { trigger, menu, title } = projectFlyout;
    projectFlyout = null;
    menu.remove();
    trigger.setAttribute("aria-expanded", "false");
    trigger.removeAttribute("aria-controls");
    trigger.title = title;
    if (restoreFocus && trigger.isConnected) trigger.focus();
  }
  function openProjectFlyout(trigger, focusFirst = false) {
    if (!state.sidebarCollapsed) return;
    clearTimeout(projectFlyoutTimer);
    if (projectFlyout?.trigger === trigger) {
      if (focusFirst) projectFlyout.menu.querySelector("button").focus();
      return;
    }
    closeProjectFlyout();
    const p = data.projects.find(item => item.id === trigger.dataset.id);
    if (!p) return;
    const sessions = data.sessions.filter(item => item.project === p.id);
    const menu = document.createElement("div");
    menu.className = "project-flyout";
    menu.id = "project-flyout";
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", `${p.name}的会话`);
    menu.innerHTML = `<div class="project-flyout-heading">${icon("folder")}<strong>${esc(p.name)}</strong><span>${sessions.length}</span></div><button class="project-flyout-new" role="menuitem" data-action="new-session" data-project="${p.id}">${icon("plus")}<span>新建会话</span></button><div class="project-flyout-list">${sessions.map(s => `<button class="project-flyout-session ${state.session === s.id && state.view === "session" ? "active" : ""}" role="menuitem" data-action="session" data-id="${s.id}" title="${esc(s.title)} · ${labels[s.status]}"><i class="dot ${s.status}"></i><span class="grow"><strong>${esc(s.title)}</strong><small>${s.agent === "code" ? "编码" : "审查"} · ${labels[s.status]}</small></span>${state.session === s.id && state.view === "session" ? icon("check") : ""}</button>`).join("") || '<p class="project-flyout-empty">还没有会话</p>'}</div>`;
    document.body.append(menu);
    const rect = trigger.getBoundingClientRect();
    menu.style.left = `${Math.min(rect.right + 10, innerWidth - menu.offsetWidth - 10)}px`;
    menu.style.top = `${Math.max(10, Math.min(rect.top, innerHeight - menu.offsetHeight - 10))}px`;
    projectFlyout = { trigger, menu, title: trigger.title };
    trigger.title = "";
    trigger.setAttribute("aria-expanded", "true");
    trigger.setAttribute("aria-controls", menu.id);
    if (focusFirst) menu.querySelector("button").focus();
  }
  document.addEventListener("pointerover", event => {
    const trigger = event.target.closest(".rail-project");
    if (trigger) openProjectFlyout(trigger);
    if (event.target.closest(".project-flyout")) clearTimeout(projectFlyoutTimer);
  });
  document.addEventListener("pointerout", event => {
    if (!projectFlyout || !event.target.closest(".rail-project,.project-flyout")) return;
    if (projectFlyout.trigger.contains(event.relatedTarget) || projectFlyout.menu.contains(event.relatedTarget)) return;
    clearTimeout(projectFlyoutTimer);
    projectFlyoutTimer = setTimeout(() => closeProjectFlyout(), 220);
  });
  document.addEventListener("pointerdown", event => {
    if (!event.target.closest(".rail-project,.project-flyout")) closeProjectFlyout();
  });
  document.addEventListener("keydown", event => {
    const trigger = event.target.closest(".rail-project");
    if (trigger && ["ArrowRight", "ArrowDown", " "].includes(event.key)) {
      event.preventDefault(); openProjectFlyout(trigger, true); return;
    }
    if (!projectFlyout) return;
    if (event.key === "Escape") { event.preventDefault(); closeProjectFlyout(true); return; }
    if (!projectFlyout.menu.contains(event.target)) return;
    if (["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const items = [...projectFlyout.menu.querySelectorAll("button")];
      const index = items.indexOf(document.activeElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next].focus();
    }
  });
  document.addEventListener("focusin", event => {
    if (projectFlyout && !projectFlyout.menu.contains(event.target) && event.target !== projectFlyout.trigger) closeProjectFlyout();
  });
  document.addEventListener("scroll", event => {
    if (projectFlyout && !projectFlyout.menu.contains(event.target)) closeProjectFlyout();
  }, true);
  window.addEventListener("resize", () => closeProjectFlyout());
  function recordTarget(kind, id) {
    return (kind === "project" ? data.projects : data.sessions).find(item => item.id === id);
  }
  function recordOccupied(kind, id) {
    return data.sessions.some(s => (kind === "project" ? s.project === id : s.id === id) && (rounds.unsettled(s) || s.reviewRounds?.some(rounds.unsettled)));
  }
  function closeRecordMenu() {
    document.querySelector("#record-menu")?.remove();
  }
  function showRecordMenu(row, x, y) {
    closeRecordMenu();
    const kind = row.dataset.recordKind, id = row.dataset.recordId;
    const target = recordTarget(kind, id);
    if (!target) return;
    const menu = document.createElement("div");
    menu.id = "record-menu"; menu.className = "record-menu"; menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", (kind === "project" ? target.name : target.title) + "的操作");
    const occupied = recordOccupied(kind, id);
    menu.innerHTML = `<button role="menuitem" data-action="record-rename" data-kind="${kind}" data-id="${id}">重命名</button>${kind === "session" ? `<button role="menuitem" data-action="record-branch" data-id="${id}" ${!state.connected ? 'disabled title="连接恢复后可新建分支"' : ""}>新会话分支</button>` : ""}<button role="menuitem" class="delete-record" data-action="record-delete" data-kind="${kind}" data-id="${id}" ${occupied ? 'disabled title="执行、待核对状态或队列未结束，暂不能删除"' : ""}>删除</button>${occupied ? '<p>请先结束执行并清空队列后再删除</p>' : ""}`;
    document.body.append(menu);
    menu.style.left = Math.max(8, Math.min(x, innerWidth - menu.offsetWidth - 8)) + "px";
    menu.style.top = Math.max(8, Math.min(y, innerHeight - menu.offsetHeight - 8)) + "px";
    menu.querySelector("button").focus();
    menu.addEventListener("keydown", event => {
      if (event.key === "Escape" || event.key === "Tab") {
        closeRecordMenu(); (row.matches("button") ? row : row.querySelector(".project-name"))?.focus();
        if (event.key === "Escape") event.preventDefault();
      }
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const items = [...menu.querySelectorAll("button:not(:disabled)")];
        const current = items.indexOf(document.activeElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items[next].focus();
      }
    });
  }
  document.addEventListener("contextmenu", event => {
    const row = event.target.closest("[data-record-kind]");
    if (!row) return;
    event.preventDefault(); showRecordMenu(row, event.clientX, event.clientY);
  });
  document.addEventListener("keydown", event => {
    const row = event.target.closest("[data-record-kind]");
    if (row && (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey))) {
      event.preventDefault(); const rect = row.getBoundingClientRect(); showRecordMenu(row, rect.left + 20, rect.bottom);
    }
  });
  document.addEventListener("pointerdown", event => { if (!event.target.closest("#record-menu")) closeRecordMenu(); });
  document.addEventListener("scroll", closeRecordMenu, true);
  window.addEventListener("resize", closeRecordMenu);
  document.addEventListener("wheel", event => {
    const tabs = event.target.closest(".viewer-tabs");
    if (!tabs || event.ctrlKey || tabs.scrollWidth <= tabs.clientWidth) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? tabs.clientWidth : 1;
    const next = Math.max(0, Math.min(tabs.scrollWidth - tabs.clientWidth, tabs.scrollLeft + delta * scale));
    if (next === tabs.scrollLeft) return;
    event.preventDefault();
    tabs.scrollLeft = next;
  }, { passive: false });
  function deleteRecord(kind, id) {
    if (!recordTarget(kind, id)) { dialog.close(); return; }
    if (recordOccupied(kind, id)) { dialog.close(); toast("执行状态发生变化，暂不能删除。"); return; }
    const removed = data.sessions.filter(s => kind === "project" ? s.project === id : s.id === id);
    const ids = new Set(removed.map(s => s.id));
    const locationRemoved = ids.has(state.session) || (kind === "project" && state.project === id);
    data.sessions = data.sessions.filter(s => !ids.has(s.id));
    for (const s of data.sessions) for (const key of ["parent", "source", "blocker"]) if (ids.has(s[key])) delete s[key];
    for (const viewer of Object.values(state.viewers)) {
      viewer.tabs = viewer.tabs.filter(tab => {
        const scope = JSON.parse(tab.key)[2];
        return !removed.some(s => tab.source === "materials" ? (scope === (s.snapshot || s.id) || s.reviewRounds?.some(item => item.snapshot === scope)) : tab.source === "changes" && scope === "run:" + s.id);
      });
      if (!viewer.tabs.some(tab => tab.id === viewer.active)) viewer.active = viewer.tabs[0]?.id || null;
      if (!viewer.tabs.length) viewer.open = false;
    }
    if (kind === "project") {
      data.projects = data.projects.filter(p => p.id !== id);
      delete data.files[id]; delete state.viewers[id]; delete state.projectSearch[id];
      delete state.newSessionDrafts[id];
      if (state.newSessionDraft.project === id) state.newSessionDraft = {};
      if (state.project === id) state.project = data.projects[0]?.id || null;
    }
    if (locationRemoved) { state.session = null; state.view = "overview"; state.inspector = "files"; }
    if (state.back && (ids.has(state.back.session) || (kind === "project" && state.back.project === id))) state.back = { project: state.project, session: null, view: "overview", inspector: "files" };
    if (ids.has(state.diffSession)) state.diffSession = data.sessions.find(s => s.project === state.project && s.agent === "code")?.id || "";
    state.preview = null; dialog.close(); render(); toast("已删除原型记录，磁盘文件不受影响。");
  }
  function formValues(form) {
    const value = Object.fromEntries(new FormData(form));
    if (form.id === "new-session-form") {
      value.approvalMode = composerTools.mode(state.newSessionDraft);
      value.attachments = value.project === state.newSessionDraft.project ? composerTools.references(state.newSessionDraft, data.files[value.project] || []) : [];
    }
    if (form.id === "provider-form") value.enabled = form.elements.enabled.checked;
    return value;
  }
  document.addEventListener("input", event => {
    const el = event.target;
    if (["project-search-query", "project-search-path"].includes(el.id)) {
      state.projectSearch[state.project][el.id === "project-search-query" ? "query" : "path"] = el.value;
      document.querySelector("#project-search-results").innerHTML = searchResults();
    }
    if (el.id === "composer") { const s = data.sessions.find(x => x.id === el.dataset.session); if (s) { s.draft = el.value; s.draftRevision = (s.draftRevision || 0) + 1; } }
    if (el.id === "provider-search") { state.providerQuery = el.value; document.querySelector("#provider-list").innerHTML = providerList(); }
    if (el.closest("#provider-form")) state.configDrafts[state.provider] = formValues(el.closest("form"));
    if (el.closest("#new-session-form") && el.name !== "project") state.newSessionDraft = formValues(el.closest("form"));
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveWorkspace, 200);
  });
  function createSessionBranch(source, agent) {
    if (!source || !state.connected) { toast("连接恢复后可新建分支。"); return; }
    runCreation("branch", source, agent);
  }
  document.addEventListener("change", event => {
    const el = event.target;
    if (el.closest("[data-session-options]")) {
      const s = session();
      if (!s || el.closest("[data-session-options]").dataset.sessionOptions !== s.id) return;
      if (!state.connected) { render(); toast("连接恢复后再切换。"); return; }
      if (el.id === "session-agent") {
        if (el.value === s.agent) return;
        createSessionBranch(s, el.value);
        return;
      }
      const reason = window.WorkbenchSessionOptions.modelLock(s);
      if (reason) { render(); toast(reason); return; }
      if (el.id === "session-model" && availableModels().includes(el.value)) {
        s.model = el.value; s.thinking = models.normalize(s.model, s.thinking);
        if (s.usageSample) { delete s.usageSample.contextTokens; delete s.usageSample.contextWindow; delete s.usageSample.output; delete s.usageSample.durationMs; }
      }
      if (el.id === "session-thinking" && availableModels().includes(s.model) && models.levels(s.model).includes(el.value)) s.thinking = el.value;
      render();
      return;
    }
    if (el.closest("#provider-form")) {
      state.configDrafts[state.provider] = formValues(el.closest("form"));
      if (["mode", "credentialMode"].includes(el.name)) render();
    }
    if (el.closest("#new-session-form")) {
      if (el.name === "project") { newSession(el.value); return; }
      state.newSessionDraft = formValues(el.closest("form"));
      if (["agent", "project", "model"].includes(el.name)) render();
      else saveWorkspace();
    }
    if (el.id === "diff-scope") { state.diffScope = el.value; state.preview = null; render(); }
    if (el.id === "diff-session") { state.diffSession = el.value; state.preview = null; render(); }
  });
  document.addEventListener("keydown", event => {
    if (event.target.id === "new-task" && event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault(); document.querySelector("#new-session-form").requestSubmit(); return;
    }
    if (event.target.id === "composer" && event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault(); send();
    }
  });
  function send() {
    const s = session();
    const draft = s.draft.trim();
    const text = composerTools.message(s, data.files[s.project] || [], draft);
    if (!draft) { toast("先填写任务内容。"); return; }
    if (!busy(s) && s.queue.length) { toast("先继续或清空保留队列，再发送新任务。"); return; }
    if (s.recoveryBlocked || s.pendingApproval || s.settling || !state.connected || ["stopping", "unknown"].includes(s.status)) { toast("当前状态不能提交，请先处理连接或核对状态。"); return; }
    if (messageQueue.enqueue(s, text)) { s.draft = ""; s.attachments = []; render(); toast("已排队。可在队列中立即插入，不中断当前步骤。"); return; }
    if (!busy(s) && !start(s)) return;
    s.messages.push({ role: "user", text }); s.draft = ""; s.attachments = [];
    s.messages.push({ role: "agent", text: "已接收这项任务。原型展示模拟执行；可在右上角“演示场景”推进完成、失败或待核对状态。" });
    render(); toast("演示执行已开始，可从右上角场景菜单推进结果。");
  }
  document.addEventListener("submit", event => {
    event.preventDefault();
    const form = event.target;
    const values = formValues(form);
    if (form.id === "queue-edit-form") {
      const target = data.sessions.find(item => item.id === form.dataset.session);
      if (!state.connected || !target || ["stopping", "unknown"].includes(target.status) || target.recoveryBlocked || !messageQueue.edit(target, Number(form.dataset.index), form.dataset.revision, values.text)) { toast("内容为空、队列已变化或状态不可用，请关闭后重新选择。"); return; }
      dialog.close(); render(); toast("已更新排队消息，顺序不变。"); return;
    }
    if (form.id === "rename-form") {
      const target = recordTarget(form.dataset.kind, form.dataset.id);
      const name = values.name.trim();
      if (!target || !name) { toast("名称不能为空。"); return; }
      if ([...name].length > 80 || /[\u0000-\u001f\u007f-\u009f]/u.test(name)) { toast("名称最多 80 个字符，不能包含控制字符。"); return; }
      target[form.dataset.kind === "project" ? "name" : "title"] = name;
      dialog.close(); render(); toast("名称已更新。");
    }
    if (form.id === "project-form") {
      if (!values.name?.trim() || !values.path?.trim()) { toast("请填写项目名称和目录。"); return; }
      if ([...values.name.trim()].length > 80 || /[\u0000-\u001f\u007f-\u009f]/u.test(values.name)) { toast("名称最多 80 个字符，不能包含控制字符。"); return; }
      const normalized = values.path.replaceAll("\\", "/").replace(/\/$/, "").toLowerCase();
      const existing = data.projects.find(p => p.path.toLowerCase() === normalized);
      if (existing) { toast("该演示目录已关联项目，不重复创建。"); return; }
      const id = `p${++state.counter}`;
      data.projects.push({id, name: values.name.trim(), note: values.note || "", path: values.path, expanded: true}); data.files[id] = [];
      state.project = id; state.session = null; state.view = "overview"; state.preview = null; dialog.close(); render(); toast("已创建演示项目，未在磁盘创建目录。");
    }
    if (form.id === "new-session-form") {
      state.newSessionDraft = values;
      if (!values.task?.trim()) { toast("先填写任务内容。"); return; }
      if (!state.connected) { toast("当前连接已断开，请先恢复连接。"); return; }
      if (!availableModels().includes(values.model)) { toast("请选择可用模型，或先配置模型连接。"); return; }
      values.thinking = models.normalize(values.model, values.thinking);
      const id = `s${++state.counter}`;
      data.sessions.push({id, contextDefaults: structuredClone(state.contextLimits), project: values.project, title: [...values.task.trim().replace(/\s+/g, " ")].slice(0, 28).join(""), agent: values.agent, model: values.model, thinking: values.thinking, approvalMode: values.approvalMode, attachments: values.attachments, material: values.agent === "review" ? composerTools.references(values, data.files[values.project] || []).map(item => item.path).join("\n") : "", status: "idle", draft: values.task.trim(), reviewChat: values.agent === "review", requirement: values.agent === "review" ? values.task.trim() : "", queue: [], messages: [], round: values.agent === "review" ? 1 : 0, limit: state.reviewLimit, checkLimit: state.checkLimit, timeLimit: state.timeLimit});
      delete state.newSessionDrafts[values.project]; state.newSessionDraft = {}; navigateSession(id);
      send();
    }
    if (form.id === "provider-form") {
      state.configDrafts[state.provider] = values;
      const error = saveProvider(state.provider, values);
      if (error) { toast(error); return; }
      render(); toast("当前连接已模拟保存，未进行调用验证。");
    }
    if (form.id === "context-form") {
      const ref = form.dataset.ref;
      if (!models.get(ref)) { toast("模型已不可用。"); return; }
      const error = models.contextError(ref, values.contextLimit);
      if (error) { toast(error); return; }
      if (values.contextLimit.trim()) state.contextLimits[ref] = Number(values.contextLimit);
      else delete state.contextLimits[ref];
      dialog.close(); render(); toast("上下文默认值已模拟保存，仅对新建会话生效。"); return;
    }
    if (form.id === "default-form") { state.defaultModel = values.defaultModel; toast("默认模型已保存，仅影响新会话。"); }
    if (form.id === "basic-form") {
      const numeric = ["commandTimeout", "globalCap"];
      if (numeric.some(key => !Number.isSafeInteger(Number(values[key])) || Number(values[key]) <= 0)) { toast("超时和限额必须为正整数。"); return; }
      const powershell = values.powershell.trim();
      const bash = values.bash.trim();
      if (!powershell) { toast("请填写 PowerShell 程序路径。"); return; }
      const commandChanged = powershell !== state.powershell || bash !== state.bash || Number(values.commandTimeout) !== state.commandTimeout;
      if (commandChanged && data.sessions.some(s => rounds.unsettled(s))) { toast("仍有执行、待核对记录或队列，暂不能修改全局命令参数；结束后再保存。"); return; }
      state.powershell = powershell; state.bash = bash;
      for (const key of numeric) state[key] = Number(values[key]);
      toast("基础配置已全局模拟保存，既有执行保持不变；刷新恢复默认值。");
    }
  });
  document.addEventListener("click", event => {
    const el = event.target.closest("[data-action]");
    if (!el || el.disabled) return;
    event.preventDefault();
    const action = el.dataset.action;
    const s = session();
    if (action === "query-operation") { render(); toast("只查询本地演示回执，没有重发创建。"); return; }
    if (action === "dismiss-operation") { state.pendingOperation = null; render(); return; }
    if (action === "open-operation") {
      const receipt = operations.lookup(state.pendingOperation, data.operationReceipts);
      const target = data.sessions.find(item => item.id === receipt.targetId && item.project === receipt.project);
      if (!target || receipt.status !== "committed") { toast("原结果不存在，当前页面保留。"); return; }
      if (target.agent === "review") target.viewedRound = receipt.resultRound;
      state.pendingOperation = null; navigateSession(target.id); return;
    }
    if (action === "usage-details") {
      const shown = s ? rounds.displayed(s) : null;
      const value = usage.read(shown);
      modal("统计来源", `<div class="stack"><p>消息数只计当前会话的用户消息，分支背景不计。没有用量回执时显示未知；旧材料记录不是当前请求回执。</p><p>${value.demo ? "当前为手动选中的回执样例，不是真实调用。累计包含模型、工具自身消耗及独立审批账；不重复相加嵌套工具。" : "未接真实模型回执：步数、速度、Token、缓存及上下文均未知，显示 —。"}</p><p>缓存全零可能是字段未返回，不能当成 0% 命中；有记录也标部分。速度缺少输出量或时长时未知。上下文有窗口和内容记录时才显示约数。</p><p>历史统计保留原来源，不借最新请求或模型窗口。无真实回执不能当成零费用。</p></div>`); return;
    }
    if (action === "old-round-details") {
      modal("历史执行待核对", `<p class="dialog-description">旧记录仍有未收尾操作。仅演示核对后结束旧执行，不自动重跑。</p>${button("已核对，结束旧执行", "resolve-old-round", "", "primary")}`); return;
    }
    if (action === "resolve-old-round") {
      for (const old of s.reviewRounds || []) if (rounds.unsettled(old)) { old.status = "stopped"; old.queue = []; old.settling = false; old.pendingApproval = false; old.sealed = true; }
      s.recoveryBlocked = false; dialog.close(); render(); return;
    }
    if (action === "record-branch") {
      const source = data.sessions.find(item => item.id === el.dataset.id);
      closeRecordMenu();
      if (source) createSessionBranch(source, source.agent);
      return;
    }
    if (action === "record-rename" || action === "record-delete") {
      const kind = el.dataset.kind, id = el.dataset.id;
      const target = recordTarget(kind, id);
      closeRecordMenu();
      if (!target) return;
      const name = kind === "project" ? target.name : target.title;
      if (action === "record-rename") {
        modal("重命名" + (kind === "project" ? "项目" : "会话"), `<form id="rename-form" data-kind="${kind}" data-id="${id}">${field("名称", "name", name)}<div class="dialog-actions">${button("取消", "close-dialog")}<button class="btn primary" type="submit">保存名称</button></div></form>`);
        dialog.querySelector('input[name="name"]').select();
      } else {
        if (recordOccupied(kind, id)) { toast("请先停止执行、处理待核对状态并清空队列，再删除。"); return; }
        modal("删除" + (kind === "project" ? "项目" : "会话"), `<p class="dialog-description">删除“${esc(name)}”${kind === "project" ? "及其所有会话" : "及其历史记录"}？只移除原型记录，不删除磁盘文件。</p><div class="dialog-actions">${button("取消", "close-dialog")}${button("确认删除", "record-confirm-delete", `data-kind="${kind}" data-id="${id}"`, "danger")}</div>`);
      }
    }
    if (action === "record-confirm-delete") deleteRecord(el.dataset.kind, el.dataset.id);
    if (action === "toggle-sidebar") {
      closeProjectFlyout();
      state.sidebarCollapsed = !state.sidebarCollapsed;
      app.querySelector(".shell").classList.toggle("sidebar-collapsed", state.sidebarCollapsed);
      el.title = state.sidebarCollapsed ? "展开左侧栏" : "收起左侧栏";
      el.setAttribute("aria-label", el.title);
      el.setAttribute("aria-expanded", String(!state.sidebarCollapsed));
      window.dispatchEvent(new Event("workbench-layout"));
      saveWorkspace();
    }
    if (action === "toggle-theme") {
      const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = theme;
      el.innerHTML = icon(theme === "dark" ? "sun" : "moon");
      el.title = theme === "dark" ? "切换亮色主题" : "切换暗色主题";
      el.setAttribute("aria-label", el.title);
      try { localStorage.setItem("lg-workbench.theme.v1", theme); }
      catch { toast("本次主题已切换，浏览器未能保存偏好。"); }
    }
    if (action === "close-dialog") dialog.close();
    if (action === "fold") { const p = data.projects.find(x => x.id === el.dataset.id); p.expanded = !p.expanded; render(); }
    if (action === "project") { state.project = el.dataset.id; state.session = null; state.view = "overview"; state.preview = null; restoreResourceView(); render(); }
    if (action === "session") { if (dialog.open) dialog.close(); navigateSession(el.dataset.id); }
    if (action === "agents") { state.view = "agents"; state.preview = null; render(); }
    if (action === "agent-view" && ["list", "grid"].includes(el.dataset.mode)) { state.agentView = el.dataset.mode; render(); }
    if (action === "new-project") modal("新建项目", `<p class="dialog-description">先建立项目，再按工作需要选择智能体。此处不会操作真实目录。</p><form id="project-form">${field("项目名称", "name")}${area("项目目标（可选）", "note")}<label class="field"><span>工作目录方式</span><select name="directoryMode"><option>关联已有目录</option><option>创建空目录</option></select></label>${field("服务端本机目录", "path", "D:/workspace/", "text", "原型只保存路径文字，不访问本机文件。真实产品会检查目录身份。")}<div class="dialog-actions">${button("取消", "close-dialog")}<button class="btn primary">创建项目</button></div></form>`);
    if (action === "new-session") newSession(el.dataset.project || state.project, el.dataset.agent);
    if (action === "settings") openSettings();
    if (action === "back-settings") { Object.assign(state, state.back || {view:"overview"}); render(); }
    if (action === "configure-from-create") { state.newSessionDraft = formValues(document.querySelector("#new-session-form")); state.settingsTab = "providers"; openSettings(); }
    if (action === "settings-tab") { state.settingsTab = el.dataset.tab; render(); }
    if (action === "settings-section") {
      const target = document.getElementById(el.dataset.section);
      const pane = target?.closest(".settings-simple");
      if (!pane) return;
      pane.scrollTo({ top: pane.scrollTop + target.getBoundingClientRect().top - pane.getBoundingClientRect().top - 28, behavior: "instant" });
      target.focus({ preventScroll: true });
      for (const item of document.querySelectorAll(".settings-directory button")) {
        item.classList.toggle("active", item === el);
        if (item === el) item.setAttribute("aria-current", "location");
        else item.removeAttribute("aria-current");
      }
    }
    if (action === "toggle-inspector") { state.inspectorOpen = !state.inspectorOpen; render(); }
    if (action === "inspector-tab") { state.inspector = el.dataset.tab; state.preview = null; render(); }
    if (action === "search-case") { state.projectSearch[state.project].matchCase = !state.projectSearch[state.project].matchCase; render(); }
    if (action === "search-clear") { state.projectSearch[state.project].query = ""; state.preview = null; render(); document.querySelector("#project-search-query").focus(); }
    if (action === "search-hit") {
      const search = state.projectSearch[state.project];
      openPreview({ path: el.dataset.path, source: "search", line: Number(el.dataset.line), query: search.query, matchCase: search.matchCase });
    }
    if (action === "changes") { state.inspector = "changes"; state.inspectorOpen = true; render(); }
    if (action === "file") openPreview({path:el.dataset.path,source:el.dataset.source});
    if (action === "hide-viewer") { viewerState().open = false; render(); }
    if (action === "show-viewer") { viewerState().open = true; render(); }
    if (action === "viewer-tab") { viewerState().active = el.dataset.id; render(); }
    if (action === "close-file-tab") {
      const viewer = viewerState();
      const index = viewer.tabs.findIndex(tab => tab.id === el.dataset.id);
      if (index >= 0) viewer.tabs.splice(index, 1);
      if (viewer.active === el.dataset.id) viewer.active = viewer.tabs[Math.min(index, viewer.tabs.length - 1)]?.id || null;
      if (!viewer.tabs.length) viewer.open = false;
      render();
    }
    if (action === "send") send();
    if (action === "stop") {
      const target = data.sessions.find(x => x.id === el.dataset.id);
      if (!target || !busy(target) || target.status === "stopping") return;
      target.generation = (target.generation || 0) + 1; const generation = target.generation;
      messageQueue.cancel(target);
      target.status = "stopping"; target.queue = []; render();
      setTimeout(() => { if (target.generation !== generation || target.status !== "stopping") return; target.status = "stopped"; render(); toast(`“${target.title}”已模拟停止，其他会话不受影响。`); }, 800);
    }
    if (["withdraw", "clear-queue", "continue-queue", "insert-queued", "edit-queued"].includes(action) && (!s || !state.connected || s.recoveryBlocked || ["stopping", "unknown"].includes(s.status))) { toast("连接或执行状态未确认，请先核对。"); return; }
    if (action === "insert-queued") {
      if (!messageQueue.insert(s, Number(el.dataset.index))) { toast("消息已被处理，或当前不在执行中。"); return; }
      render(); toast("等待当前步骤结束后插入，未停止或重启当前任务。");
    }
    if (action === "edit-queued") {
      const index = Number(el.dataset.index);
      if (!Number.isInteger(index) || typeof s.queue[index] !== "string") return;
      modal("编辑排队消息", `<form id="queue-edit-form" data-session="${s.id}" data-index="${index}" data-revision="${esc(JSON.stringify(s.queue))}">${area("消息内容", "text", s.queue[index])}<p class="field-hint">保留排队顺序，不影响输入框草稿。</p><div class="dialog-actions">${button("取消", "close-dialog")}<button class="btn primary" type="submit">保存修改</button></div></form>`);
    }
    if (action === "withdraw") { s.queue.splice(Number(el.dataset.index), 1); render(); toast("已撤回尚未消费的输入。"); }
    if (action === "clear-queue") { s.queue = []; render(); toast("已清空该会话待执行输入。"); }
    if (action === "continue-queue" && !busy(s) && s.queue.length && start(s)) { s.messages.push({role:"user",text:s.queue.shift(),mode:"继续队列"}); render(); }
    if (action === "retry") {
      if (s.draft.trim()) send();
      else start(s, s.agent === "review" && (data.files[s.project] || []).some(f => (s.material || "").includes(f.path)));
    }
    if (action === "change-model") {
      if (!state.connected || window.WorkbenchSessionOptions.modelLock(s)) { toast(window.WorkbenchSessionOptions.modelLock(s) || "连接恢复后再切换。"); return; }
      modal("选择会话模型", `<p class="dialog-description">保留会话智能体身份，仅更换后续执行使用的模型。</p><div class="scenario-list">${availableModels().map(model => `<button data-action="set-session-model" data-model="${model}">${esc(modelName(model))}</button>`).join("") || "没有可用模型，请先配置连接。"}</div>`);
    }
    if (action === "set-session-model") {
      if (!state.connected || window.WorkbenchSessionOptions.modelLock(s) || !availableModels().includes(el.dataset.model)) return;
      s.model = el.dataset.model; s.thinking = models.normalize(s.model, s.thinking);
      if (s.usageSample) { delete s.usageSample.contextTokens; delete s.usageSample.contextWindow; delete s.usageSample.output; delete s.usageSample.durationMs; }
      dialog.close(); render();
    }
    if (action === "logs") modal("执行日志 · 样例", `<p class="dialog-description">本例未实际启动命令，以下仅展示日志交互。</p><pre class="preview-code" style="padding:10px;background:var(--panel)">[10:43:02] 开始检查导出结果\n[10:43:03] PASS 筛选条件一致\n[10:43:03] PASS 中文编码\n[10:43:04] FAIL 空数据反馈\n退出码：1\n日志完整性：完整（模拟）</pre>`);
    if (action === "turn-jump") {
      const message = document.getElementById(`message-${el.dataset.messageIndex}`);
      message?.scrollIntoView({ block: "start" });
      message?.focus({ preventScroll: true });
      s.locatedMessage = Number(el.dataset.messageIndex); saveWorkspace();
      for (const tick of document.querySelectorAll(".turn-tick")) tick.setAttribute("aria-current", String(tick === el));
    }
    if (action === "provider") { state.provider = el.dataset.id; render(); }
    if (action === "provider-settings") { state.provider = el.dataset.id; state.settingsTab = "providers"; render(); }
    if (action === "provider-filter") { state.providerFilter = el.dataset.filter; render(); }
    if (action === "save-all") {
      const results = Object.entries(state.configDrafts).map(([id, draft]) => saveProvider(id, draft));
      render(); modal("批量保存结果", `<p class="dialog-description">逐项保存，失败项保留修改；成功不代表调用验证通过。</p>${results.length ? results.map(error => `<div class="notice ${error ? "error" : "info"}">${esc(error || "一项连接已模拟保存")}</div>`).join("") : '<p class="muted">暂无未保存修改。</p>'}`);
    }
    if (action === "auth-start") { if (data.sessions.some(x => busy(x) && x.model.startsWith(`${state.provider}/`))) {toast("连接仍在使用，结束执行后再重新授权。");return;} state.auth[state.provider]="pending";render(); }
    if (action === "auth-success") { state.auth[state.provider]="success";render();toast("模拟授权完成，点击保存当前让配置生效。"); }
    if (action === "auth-cancel") { state.auth[state.provider]="canceled";render(); }
    if (action === "refresh-models") { state.config[state.provider].refreshed=true;render();toast("已重新展示本地源码目录，未联网刷新。"); }
    if (action === "model-context") {
      const ref = el.dataset.ref;
      const model = models.get(ref);
      if (!model) return;
      modal("模型上下文", `<h3>${esc(model.name)}</h3><p class="field-hint">${esc(ref)}</p><div class="notice info">源码目录上下文：${models.tokens(model.contextWindow)}<br>最大输出：${models.tokens(model.maxTokens)}。这是目录标注，未联网验证。</div><form id="context-form" data-ref="${esc(ref)}">${field("上下文使用上限（tokens，可选）", "contextLimit", state.contextLimits[ref] || "", "number", "留空跟随目录；可调小，不能超过目录窗口。所有项目共用；保存后仅对新建会话和新分支生效。")}<p class="field-hint">此值用于平台规划上下文预算，不是实际发送量，也不能扩大厂商容量。输出预留和压缩策略需运行层另行处理。已有会话及其后续复核轮次保持原值。本原型不执行压缩、不改历史统计；刷新恢复全局默认值，已建会话保留创建时的选择。</p><div class="dialog-actions">${button("取消", "close-dialog")}<button class="btn primary" type="submit">保存模型配置</button></div></form>`);
    }
    if (action === "favorite-provider") { const c = state.config[state.provider]; const model = el.dataset.model; c.favorites = c.favorites.includes(model) ? c.favorites.filter(x => x !== model) : [...c.favorites, model]; render(); }
    if (action === "test-model") {
      if (!state.config[state.provider].configured || !state.config[state.provider].enabled) {toast("先保存并启用连接，再测试模型。");return;}
      const entries = models.catalog[state.provider] || [];
      if (!entries.length) { toast("当前源码没有可测试的静态聊天模型。"); return; }
      modal("测试所选模型", `<p class="dialog-description">真实产品会发起一次模型请求，可能产生费用。本原型仅模拟，不联网、不计费。</p><label class="field"><span>测试模型</span><select aria-label="测试模型">${entries.map(model => `<option value="${esc(model.id)}">${esc(model.name)}</option>`).join("")}</select></label><div class="dialog-actions">${button("模拟验证失败","test-result",'data-result="failed"')}${button("模拟验证成功","test-result",'data-result="success"',"primary")}</div>`);
    }
    if (action === "test-result") { const c=state.config[state.provider]; c.verified=el.dataset.result==="success";c.testFailed=!c.verified;dialog.close();render();toast(c.verified?"模拟验证成功。":"模拟验证失败，已有配置仍保留。"); }
    if (action === "clear-credential") {
      if (data.sessions.some(x => (busy(x)||x.queue.length)&&x.model.startsWith(`${state.provider}/`))) {toast("连接仍被执行或队列使用，暂不能清除。");return;}
      modal("清除演示凭据", `<p class="dialog-description">清除后，该连接无法发起新任务。旧会话保留原模型引用，不自动切换模型。</p><div class="dialog-actions">${button("取消","close-dialog")}${button("清除","confirm-clear","","danger")}</div>`);
    }
    if (action === "confirm-clear") { state.config[state.provider].configured=false;state.config[state.provider].verified=false;delete state.auth[state.provider];delete state.configDrafts[state.provider];dialog.close();render(); }
    if (action === "maintenance") modal("本地维护说明", '<div class="stack"><p>真实产品备份前需停止服务，备份配置、数据库、材料快照、日志和报告引用链。凭据单独保管。</p><p>关闭浏览器不会停止服务端任务。服务停机期间不执行，重启后检查未完成工作。</p><p class="field-hint">本原型没有数据库或后台进程；工作位置和演示记录保存于当前浏览器。刷新恢复原页面，场景菜单可重置演示数据。</p></div>');
    if (action === "reconcile") modal("核对未知执行结果", `<p class="dialog-description">核对原操作、文件现状与日志。结束旧执行后，编码可重新提交，审查可继续发消息。</p><div class="notice">此处仅演示人工核对流程，不自动重跑未知命令。</div><div class="dialog-actions">${button("继续查看","close-dialog")}${button("已核对，结束旧执行","resolve-unknown","","primary")}</div>`);
    if (action === "resolve-unknown") { messageQueue.cancel(s); s.status="stopped";s.queue=[];dialog.close();render();toast("已模拟结束旧执行，保留原记录。"); }
    if (action === "scenarios") modal("演示场景", `<p class="dialog-description">仅用于预览状态。不会调用模型、操作文件或启动进程。</p><div class="scenario-list">${[["complete","完成当前执行"],["pass","审查回复：通过"],["fail","审查回复：不通过"],["unknown-report","审查回复：暂不能判定"],["unsafe","命令中断：结果待核对"],["failure","当前执行失败，保留草稿和队列"],["offline",state.connected?"模拟浏览器断线":"模拟重新连接"],["no-model","首次使用：暂无模型连接"],["usage-unknown","统计：缺少用量回执"],["usage-partial","统计：部分回执 / 缓存字段不全"],["usage-estimate","统计：带上下文估算的演示回执"],["receipt-branch","分支：创建成功但响应丢失"],["request-unknown","分支：请求中断且查无结果"],["reset","重置全部演示数据"]].map(([id,label])=>`<button data-action="scenario" data-scenario="${id}">${label}</button>`).join("")}</div>`);
    if (action === "scenario") {
      dialog.close();const type=el.dataset.scenario;
      if (type==="reset") {
        try { localStorage.removeItem(window.WorkbenchWorkspace.key); }
        catch { toast("浏览器无法清除记录，请检查本地存储设置。"); return; }
        resetWorkspace = true; clearTimeout(saveTimer); location.reload(); return;
      }
      if (type==="offline") {state.connected=!state.connected;render();return;}
      if (type==="no-model") {for(const c of Object.values(state.config))c.configured=false;for(const x of data.sessions){if(busy(x))x.status="stopped";x.queue=[];}state.view="overview";state.preview=null;render();return;}
      if (!s || state.view!=="session") {toast("先选择一个会话，再切换执行场景。");return;}
      if (type.startsWith("usage-")) { const shown = rounds.displayed(s); if (shown.archived) { toast("历史轮统计只读。"); return; } s.usageSample = usage.example(type.slice(6)); render(); return; }
      if (type === "receipt-branch" || type === "request-unknown") {
        if (!state.connected || rounds.displayed(s).archived) { toast("请回到当前轮并恢复连接。"); return; }
        runCreation("branch", s, s.agent, type === "request-unknown" ? "before" : "after"); return;
      }
      if (rounds.displayed(s).archived || s.recoveryBlocked) { toast("历史轮只读；请先回到当前轮并完成核对。"); return; }
      if (type==="complete") {complete(s);return;}
      if (["pass","fail","unknown-report"].includes(type)) {if(s.agent!=="review"){toast("请先选择审查会话。");return;}if(s.status!=="running"){toast("请先发送消息，开始审查。");return;}complete(s,type==="unknown-report"?"unknown":type);return;}
      if (type === "failure") messageQueue.cancel(s);
      s.generation=(s.generation||0)+1;s.status=type==="unsafe"?"unknown":"failed";render();
    }
  });
  composerTools.connect({
    esc, icon,
    record: () => state.view === "create" ? state.newSessionDraft : state.view === "session" ? session() : null,
    files: () => data.files[state.project] || [],
    locked: () => !state.connected || (state.view === "session" && Boolean(window.WorkbenchSessionOptions.modelLock(session()))),
    changed: render,
    notify: toast,
  });
  render();
})();
