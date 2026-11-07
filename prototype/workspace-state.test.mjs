import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const context = vm.createContext({ window: {}, structuredClone });
for (const file of ["fixtures.js", "review-rounds.js", "workspace-state.js"]) {
  vm.runInContext(readFileSync(new URL(file, import.meta.url), "utf8"), context);
}
const codec = context.window.WorkbenchWorkspace;
const fixtures = context.window.WorkbenchFixtures;
const roundtrip = (state, data = fixtures) => codec.decode(codec.encode(data, state), fixtures);
const tab = (id, source = "files", scope = "current") => ({
  id, key: JSON.stringify(["src/services/export.ts", source, scope]),
  path: "src/services/export.ts", source, label: scope, line: 4, query: "export", matchCase: false,
});

test("new conversation draft survives refresh and settings return without creating a session", () => {
  const result = roundtrip({ project: "p2", view: "create", session: null,
    newSessionDraft: { project: "p2", agent: "review", model: "deepseek/review-demo", thinking: "深入思考", title: "审查需求", task: "核对调研结论", secret: "not-saved" },
    back: { project: "p2", view: "create" } });
  assert.equal(result.state.view, "create");
  assert.equal(result.state.back.view, "create");
  assert.equal(result.state.newSessionDraft.task, "核对调研结论");
  assert.equal(result.state.newSessionDraft.agent, "review");
  assert.equal(result.state.newSessionDraft.secret, undefined);
  assert.equal(result.data.sessions.length, fixtures.sessions.length);
});

test("refresh keeps project/session, tab order, active tab, source and hidden viewer", () => {
  const result = roundtrip({ project: "p1", session: "s3", view: "session", inspector: "materials",
    viewers: { p1: { tabs: [tab("file-12"), tab("file-13", "materials", "SNAP-1025-01")], active: "file-13", open: false } } });
  assert.equal(result.state.session, "s3");
  assert.equal(result.state.viewers.p1.tabs.length, 2);
  assert.equal(result.state.viewers.p1.tabs[1].label, "SNAP-1025-01");
  assert.equal(result.state.viewers.p1.active, "file-13");
  assert.equal(result.state.viewers.p1.open, false);
  assert.ok(result.state.counter >= 13);
});

test("new projects, sessions and drafts survive without storing provider credentials", () => {
  const data = structuredClone(fixtures);
  data.projects.push({ id: "p20", name: "新项目", path: "D:/demo", expanded: true, secret: "not-saved" });
  data.sessions.push({ id: "s21", project: "p20", title: "新任务", agent: "code", model: "openai/coding-demo", status: "idle", draft: "草稿", queue: [], messages: [] });
  const state = { project: "p20", session: "s21", view: "session", config: { secret: "not-saved" }, configDrafts: { token: "not-saved" }, auth: { code: "not-saved" } };
  const raw = codec.encode(data, state);
  assert.equal(raw.includes("not-saved"), false);
  const result = codec.decode(raw, fixtures);
  assert.equal(result.state.project, "p20");
  assert.equal(result.state.session, "s21");
  assert.equal(result.data.sessions.find(s => s.id === "s21").draft, "草稿");
  assert.deepEqual(Array.from(result.data.files.p20), []);
});

test("settings location and return target survive with project searches isolated", () => {
  const result = roundtrip({ project: "p2", session: "s4", view: "settings", settingsTab: "runtime",
    back: { project: "p2", session: "s4", view: "session", inspector: "files" },
    projectSearch: { p1: { query: "export", path: "src", matchCase: true }, p2: { query: "结论", path: "", matchCase: false } } });
  assert.equal(result.state.settingsTab, "basic");
  assert.equal(result.state.back.session, "s4");
  assert.equal(result.state.projectSearch.p2.query, "结论");
  assert.equal(result.state.projectSearch.p1.query, "export");
});

test("merged settings restore globally without requiring any project", () => {
  for (const settingsTab of ["runtime", "limits", "environment", "basic"]) {
    const data = structuredClone(fixtures);
    data.projects = []; data.sessions = [];
    const result = roundtrip({ view: "settings", settingsTab, settingsProject: "p1" }, data);
    assert.equal(result.state.settingsTab, "basic");
    assert.equal(result.state.view, "settings");
    assert.equal(result.state.settingsProject, undefined);
    assert.equal(result.state.project, null);
  }
});

test("project drafts keep their own text, model, approval and materials across refresh", () => {
  const result = roundtrip({ project: "p2", view: "create", newSessionDraft: { project: "p2", task: "调研草稿" },
    newSessionDrafts: {
      p1: { project: "p1", task: "编码草稿", agent: "code", model: "openai/coding-demo", approvalMode: "manual", attachments: [{ kind: "file", path: "AGENTS.md" }] },
      p2: { project: "p2", task: "调研草稿", agent: "review", attachments: [{ kind: "file", path: "research.md" }] },
    } });
  assert.equal(result.state.newSessionDrafts.p1.task, "编码草稿");
  assert.equal(result.state.newSessionDrafts.p1.approvalMode, "manual");
  assert.equal(result.state.newSessionDrafts.p1.attachments[0].path, "AGENTS.md");
  assert.equal(result.state.newSessionDrafts.p2.attachments[0].path, "research.md");
  assert.equal(result.state.newSessionDraft.task, "调研草稿");
});

test("review preparation preserves its selected task and numeric timeout", () => {
  const data = structuredClone(fixtures);
  const review = data.sessions.find(s => s.agent === "review");
  Object.assign(review, { status: "idle", source: "s1", timeout: 95, requirement: "要求", material: "材料" });
  const restored = roundtrip({ project: review.project, session: review.id, view: "session" }, data).data.sessions.find(s => s.id === review.id);
  assert.equal(restored.source, "s1");
  assert.equal(restored.timeout, 95);
});

test("resource tabs belong to projects and difference filters belong to each session", () => {
  const data = structuredClone(fixtures);
  data.projects[0].inspector = "search";
  data.projects[1].inspector = "changes";
  Object.assign(data.sessions[0], { diffScope: "workspace", diffSession: "s1" });
  Object.assign(data.sessions[1], { diffScope: "run", diffSession: "s1" });
  const result = roundtrip({ project: "p1", session: "s1", view: "session" }, data);
  assert.equal(result.data.projects[0].inspector, "search");
  assert.equal(result.data.projects[1].inspector, "changes");
  assert.equal(result.data.sessions[0].diffScope, "workspace");
  assert.equal(result.data.sessions[1].diffScope, "run");
});

test("removed results tab falls back for current page, settings return and every project", () => {
  const data = structuredClone(fixtures);
  for (const p of data.projects) p.inspector = "results";
  const result = roundtrip({ project: "p1", session: "s1", view: "settings", inspector: "results",
    back: { project: "p1", session: "s1", view: "session", inspector: "results" },
    viewers: { p1: { tabs: [tab("file-12")], active: "file-12", open: true } } }, data);
  assert.equal(result.state.inspector, "files");
  assert.equal(result.state.back.inspector, "files");
  assert.ok(result.data.projects.every(p => p.inspector === "files"));
  assert.equal(result.state.viewers.p1.active, "file-12");
  assert.equal(result.state.viewers.p1.open, true);
  assert.equal(result.data.sessions.length, data.sessions.length);
});

test("invalid references fall back without borrowing another project's session or file", () => {
  const result = roundtrip({ project: "p2", session: "s1", view: "session",
    viewers: { p2: { tabs: [tab("file-12")], active: "file-12", open: true } } });
  assert.equal(result.state.project, "p2");
  assert.equal(result.state.session, null);
  assert.equal(result.state.view, "overview");
  assert.equal(result.state.viewers.p2.open, true);
  assert.equal(result.state.viewers.p2.tabs.length, 1);
  assert.equal(result.data.files.p2.some(file => file.path === result.state.viewers.p2.tabs[0].path), false);
  assert.equal(roundtrip({ project: "missing", session: "s4", view: "session" }).state.project, "p1");
});

test("missing archive keeps its tab for an error view, but another project's archive is rejected", () => {
  const result = roundtrip({ project: "p1", view: "overview", viewers: { p1: {
    tabs: [tab("file-15", "materials", "SNAP-missing"), tab("file-16", "materials", "SNAP-1025-04")], active: "file-15", open: true,
  } } });
  assert.equal(result.state.viewers.p1.tabs.length, 1);
  assert.equal(result.state.viewers.p1.active, "file-15");
});

test("invalid JSON, version and malformed records do not break startup", () => {
  for (const raw of ["{", "null", '{"version":99}', '{"version":1,"projects":{}}']) assert.equal(codec.decode(raw, fixtures), null);
  const raw = JSON.parse(codec.encode(fixtures, { project: "p1", session: "s1", view: "session" }));
  raw.sessions[0].messages = [null, { role: "user", text: {} }];
  raw.sessions[0].queue = [null, {}];
  raw.state.viewers = { p1: { tabs: [null, { path: "src/services/export.ts", id: "file-99" }], open: true } };
  const result = codec.decode(JSON.stringify(raw), fixtures);
  assert.equal(result.data.sessions[0].messages.length, 0);
  assert.equal(result.data.sessions[0].queue.length, 0);
  assert.equal(result.state.viewers.p1.tabs.length, 0);
});

test("refresh during simulated transitions does not pretend a pending timer completed", () => {
  const data = structuredClone(fixtures);
  data.sessions[0].status = "finishing";
  const result = roundtrip({ project: "p1", session: "s1", view: "session" }, data);
  assert.equal(result.data.sessions[0].status, "unknown");
});

test("renames and deletions survive refresh, including deleting the last project", () => {
  const data = structuredClone(fixtures);
  data.projects[0].name = "重命名项目";
  data.sessions[0].title = "重命名会话";
  data.sessions = data.sessions.filter(s => s.id !== "s3");
  const result = roundtrip({ project: "p1", session: "s3", view: "session" }, data);
  assert.equal(result.data.projects[0].name, "重命名项目");
  assert.equal(result.data.sessions[0].title, "重命名会话");
  assert.equal(result.state.session, null);
  assert.equal(result.state.view, "overview");
  data.projects = [];
  data.sessions = [];
  const empty = roundtrip({ project: "p1", session: "s1", view: "session" }, data);
  assert.equal(empty.data.projects.length, 0);
  assert.equal(empty.data.sessions.length, 0);
  assert.equal(empty.state.project, null);
  assert.equal(empty.state.view, "overview");
});
