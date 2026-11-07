/* 只保存静态原型的工作位置和演示记录，不保存模型连接或授权表单。 */
(() => {
  "use strict";
  const key = "lg-workbench.workspace.v1";
  const projectFields = { id: "string", name: "string", path: "string", note: "string", expanded: "boolean", inspector: "string", diffScope: "string", diffSession: "string" };
  const sessionFields = Object.fromEntries([
    ..."id project title agent model thinking status draft parent snapshot criteria material requirement checks args expected dependencies source outcome blocker blockReason branchFrom branchTitle branchCutoff approvalMode roundId conversationId reportId parentRoundId parentReportId sourceReportId diffScope diffSession".split(" ").map(name => [name, "string"]),
    ..."round viewedRound limit checkLimit timeLimit timeout version generation draftRevision branchRound locatedMessage".split(" ").map(name => [name, "number"]),
    ..."settling pendingApproval recoveryBlocked reviewChat".split(" ").map(name => [name, "boolean"]),
  ]);
  const stateFields = Object.fromEntries([
    ..."project session view inspector agentView settingsTab provider providerQuery providerFilter diffScope diffSession".split(" ").map(name => [name, "string"]),
    ["inspectorOpen", "boolean"], ["sidebarCollapsed", "boolean"], ["counter", "number"],
  ]);
  const tabFields = { id: "string", key: "string", path: "string", source: "string", label: "string", line: "number", query: "string", matchCase: "boolean" };
  const searchFields = { query: "string", path: "string", matchCase: "boolean" };
  const createFields = { project: "string", agent: "string", model: "string", thinking: "string", task: "string", approvalMode: "string" };
  const locationFields = { project: "string", session: "string", view: "string", inspector: "string" };
  const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const list = value => Array.isArray(value) ? value : [];
  const contextDefaults = value => Object.fromEntries(Object.entries(record(value) ? value : {}).filter(([ref, limit]) => ref.includes("/") && Number.isSafeInteger(limit) && limit > 0));
  function pick(value, fields) {
    return Object.fromEntries(Object.entries(fields).filter(([name, type]) =>
      record(value) && typeof value[name] === type && (type !== "number" || Number.isFinite(value[name]))
    ).map(([name]) => [name, value[name]]));
  }
  function attachments(value, files = []) {
    const seen = new Set();
    return list(value).map(item => pick(item, { kind: "string", path: "string" })).filter(item => {
      const key = `${item.kind}:${item.path}`;
      if (seen.has(key) || !["file", "folder"].includes(item.kind) || !files.some(file => item.kind === "file" ? file.path === item.path : file.path.startsWith(item.path + "/"))) return false;
      seen.add(key);
      return true;
    });
  }
  function encode(data, state) {
    const saved = pick(state, stateFields);
    saved.pendingOperation = window.WorkbenchOperations?.reference(state.pendingOperation) || null;
    saved.back = pick(state.back, locationFields);
    saved.newSessionDraft = pick(state.newSessionDraft, createFields);
    saved.newSessionDraft.attachments = attachments(state.newSessionDraft?.attachments, data.files[state.newSessionDraft?.project]);
    saved.newSessionDrafts = Object.fromEntries(data.projects.map(p => {
      const draft = state.newSessionDrafts?.[p.id];
      return [p.id, { ...pick(draft, createFields), attachments: attachments(draft?.attachments, data.files[p.id]) }];
    }));
    saved.projectSearch = Object.fromEntries(data.projects.map(p => [p.id, pick(state.projectSearch?.[p.id], searchFields)]));
    saved.viewers = Object.fromEntries(data.projects.map(p => {
      const viewer = state.viewers?.[p.id];
      return [p.id, { tabs: list(viewer?.tabs).map(tab => pick(tab, tabFields)), active: viewer?.active, open: viewer?.open === true }];
    }));
    return JSON.stringify({ version: 1, state: saved, operationReceipts: window.WorkbenchOperations?.clean(data.operationReceipts) || [],
      projects: data.projects.map(p => pick(p, projectFields)),
      sessions: data.sessions.map(s => ({ ...pick(s, sessionFields),
        contextDefaults: contextDefaults(s.contextDefaults),
        reviewRounds: window.WorkbenchReviewRounds.history(s.reviewRounds, s.round),
        usageSample: window.WorkbenchUsage?.clean(s.usageSample) || null,
        attachments: attachments(s.attachments, data.files[s.project]),
        queue: list(s.queue).filter(item => typeof item === "string"),
        messages: list(s.messages).map(message => pick(message, { role: "string", text: "string", mode: "string" })),
        branchContext: list(s.branchContext).map(message => pick(message, { role: "string", text: "string", agent: "string", origin: "string" })),
      })),
    });
  }
  function decode(raw, fixtures) {
    try {
      const saved = JSON.parse(raw);
      if (!record(saved) || saved.version !== 1 || !Array.isArray(saved.projects) || !Array.isArray(saved.sessions) || !record(saved.state)) return null;
      const data = structuredClone(fixtures);
      data.operationReceipts = window.WorkbenchOperations?.clean(saved.operationReceipts) || [];
      const projectIds = new Set();
      const projects = saved.projects.map(p => pick(p, projectFields)).filter(p => {
        if (!/^p\d{1,9}$/.test(p.id) || !p.name || !p.path || projectIds.has(p.id)) return false;
        projectIds.add(p.id);
        return true;
      });
      if (!projects.length && saved.projects.length) return null;
      data.projects = projects;
      for (const p of projects) if (!["files", "search", "changes", "materials"].includes(p.inspector)) p.inspector = "files";
      for (const p of projects) data.files[p.id] ||= [];
      const sessionIds = new Set();
      data.sessions = saved.sessions.filter(record).map(s => {
        const value = pick(s, sessionFields);
        value.contextDefaults = contextDefaults(s.contextDefaults);
        value.reviewRounds = window.WorkbenchReviewRounds.history(s.reviewRounds, value.round);
        value.usageSample = window.WorkbenchUsage?.clean(s.usageSample) || null;
        if (!Number.isInteger(value.viewedRound) || value.viewedRound < 1) value.viewedRound = value.round;
        value.draft ||= "";
        value.approvalMode = ["manual", "auto", "full"].includes(value.approvalMode) ? value.approvalMode : "auto";
        value.attachments = attachments(s.attachments, data.files[value.project]);
        value.queue = list(s.queue).filter(item => typeof item === "string");
        value.branchContext = list(s.branchContext).map(message => pick(message, { role: "string", text: "string", agent: "string", origin: "string" }))
          .filter(message => ["user", "agent"].includes(message.role) && typeof message.text === "string" && ["code", "review"].includes(message.agent));
        value.messages = list(s.messages).map(m => pick(m, { role: "string", text: "string", mode: "string" }))
          .filter(m => ["user", "agent"].includes(m.role) && typeof m.text === "string");
        // 刷新会丢弃前端计时器，不能伪称已停止、已取材或已发布。
        if (["capturing", "stopping", "finishing"].includes(value.status)) value.status = "unknown";
        for (const old of value.reviewRounds) {
          if (["running", "capturing", "stopping", "finishing"].includes(old.status)) old.status = "unknown";
        }
        if (value.reviewRounds.some(window.WorkbenchReviewRounds.unsettled)) value.recoveryBlocked = true;
        if (!["idle", "running", "waiting", "done", "stopped", "published", "unknown", "blocked", "failed"].includes(value.status)) value.status = "idle";
        return value;
      }).filter(s => {
        if (!/^s\d{1,9}$/.test(s.id) || sessionIds.has(s.id) || !projectIds.has(s.project) || !["code", "review"].includes(s.agent) || !s.title || !s.model) return false;
        sessionIds.add(s.id);
        return true;
      });
      function location(value) {
        const result = pick(value, stateFields);
        result.project = projectIds.has(result.project) ? result.project : projects[0]?.id || null;
        const session = data.sessions.find(s => s.id === result.session && s.project === result.project);
        result.session = session?.id || null;
        if (!["session", "overview", "settings", "agents", "create"].includes(result.view)) result.view = "overview";
        if (result.view === "session" && !session) result.view = "overview";
        if (result.view === "create" && !result.project) result.view = "overview";
        if (!["files", "search", "changes", ...(session?.agent === "review" ? ["materials"] : [])].includes(result.inspector)) result.inspector = "files";
        return result;
      }
      const state = location(saved.state);
      state.pendingOperation = window.WorkbenchOperations?.reference(saved.state.pendingOperation) || null;
      state.newSessionDraft = pick(saved.state.newSessionDraft, createFields);
      if (!projectIds.has(state.newSessionDraft.project)) state.newSessionDraft = {};
      state.newSessionDraft.approvalMode = ["manual", "auto", "full"].includes(state.newSessionDraft.approvalMode) ? state.newSessionDraft.approvalMode : "auto";
      state.newSessionDraft.attachments = attachments(saved.state.newSessionDraft?.attachments, data.files[state.newSessionDraft.project]);
      if (!["code", "review"].includes(state.newSessionDraft.agent)) state.newSessionDraft.agent = "code";
      state.newSessionDrafts = {};
      for (const p of projects) {
        const draft = saved.state.newSessionDrafts?.[p.id];
        if (draft?.project !== p.id) continue;
        state.newSessionDrafts[p.id] = { ...pick(draft, createFields), attachments: attachments(draft.attachments, data.files[p.id]) };
      }
      state.back = location(pick(saved.state.back, locationFields));
      if (state.back.view === "settings") state.back.view = "overview";
      if (!["list", "grid"].includes(state.agentView)) state.agentView = "list";
      if (["runtime", "limits", "environment"].includes(state.settingsTab)) state.settingsTab = "basic";
      if (!["providers", "models", "basic"].includes(state.settingsTab)) state.settingsTab = "providers";
      if (!data.providers.some(([id]) => id === state.provider)) state.provider = "openai";
      if (!["all", "configured", "new"].includes(state.providerFilter)) state.providerFilter = "all";
      if (!["run", "workspace"].includes(state.diffScope)) state.diffScope = "run";
      if (!data.sessions.some(s => s.id === state.diffSession && s.project === state.project && s.agent === "code")) state.diffSession = data.sessions.find(s => s.project === state.project && s.agent === "code")?.id || "";
      state.projectSearch = {};
      state.viewers = {};
      let maxId = Math.max(10, ...projects.map(p => Number(p.id.slice(1))), ...data.sessions.map(s => Number(s.id.slice(1))));
      for (const p of projects) {
        state.projectSearch[p.id] = { query: "", path: "", matchCase: false, ...pick(saved.state.projectSearch?.[p.id], searchFields) };
        const viewer = saved.state.viewers?.[p.id];
        const ids = new Set();
        const keys = new Set();
        const tabs = list(viewer?.tabs).map(tab => pick(tab, tabFields)).filter(tab => {
          if (!/^file-\d{1,9}$/.test(tab.id) || !tab.key || !tab.path || !tab.label || ids.has(tab.id) || keys.has(tab.key) || !["files", "search", "changes", "materials"].includes(tab.source)) return false;
          let identity;
          try { identity = JSON.parse(tab.key); } catch { return false; }
          if (!Array.isArray(identity) || identity.length !== 3 || identity[0] !== tab.path || identity[1] !== (tab.source === "search" ? "files" : tab.source)) return false;
          const scope = identity[2];
          if (typeof scope !== "string") return false;
          if (tab.source === "materials" && data.sessions.some(s => s.project !== p.id && ((s.snapshot || s.id) === scope || s.reviewRounds.some(item => item.snapshot === scope)))) return false;
          if (tab.source === "changes" && scope !== "workspace:" && (!/^run:s\d+$/.test(scope) || data.sessions.some(s => s.project !== p.id && `run:${s.id}` === scope))) return false;
          if (["files", "search"].includes(tab.source) && scope !== "current") return false;
          tab.query ||= "";
          tab.matchCase = tab.matchCase === true;
          if (!Number.isInteger(tab.line) || tab.line <= 0) delete tab.line;
          ids.add(tab.id); keys.add(tab.key);
          maxId = Math.max(maxId, Number(tab.id.slice(5)));
          return true;
        });
        state.viewers[p.id] = { tabs, active: tabs.find(tab => tab.id === viewer?.active)?.id || tabs[0]?.id || null, open: tabs.length > 0 && viewer?.open === true };
      }
      state.counter = Math.max(maxId, Number.isSafeInteger(state.counter) && state.counter < 1000000000 ? state.counter : 10);
      return { data, state };
    } catch {
      return null;
    }
  }
  window.WorkbenchWorkspace = { key, encode, decode };
})();
