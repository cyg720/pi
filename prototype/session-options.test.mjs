import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const context = vm.createContext({ window: {}, structuredClone });
for (const file of ["fixtures.js", "review-rounds.js", "workspace-state.js", "session-options.js"]) {
  vm.runInContext(readFileSync(new URL(file, import.meta.url), "utf8"), context);
}
const { branch, modelLock } = context.window.WorkbenchSessionOptions;
const codec = context.window.WorkbenchWorkspace;
const fixtures = context.window.WorkbenchFixtures;

test("agent switch forks context and draft without moving the running task or queue", () => {
  const source = structuredClone(fixtures.sessions[0]);
  source.draft = "请核查边界";
  source.queue = ["稍后执行"];
  const before = structuredClone(source);
  const child = branch(source, "review", "s40", { limit: 30 });
  assert.equal(child.project, source.project);
  assert.equal(child.branchFrom, source.id);
  assert.equal(child.status, "idle");
  assert.equal(child.requirement, source.draft);
  assert.equal(child.draft, source.draft);
  assert.equal(child.queue.length, 0);
  assert.equal(child.messages.length, 0);
  assert.equal(child.branchContext.length, source.messages.length);
  assert.equal(child.branchContext[1].agent, "code");
  child.branchContext[0].text = "分支里的改动";
  assert.deepEqual(source, before);
  assert.equal(branch(source, "invalid", "s41", {}), null);
});

test("explicit branch keeps the same agent and model with independent history and no execution", () => {
  for (const agent of ["code", "review"]) {
    const source = structuredClone(fixtures.sessions.find(s => s.agent === agent));
    source.draft = "继续检查";
    source.queue = ["不复制队列"];
    const child = branch(source, agent, "s45", {});
    assert.equal(child.agent, source.agent);
    assert.equal(child.model, source.model);
    assert.equal(child.thinking, source.thinking);
    assert.equal(child.branchFrom, source.id);
    assert.equal(child.draft, source.draft);
    assert.equal(child.status, "idle");
    assert.equal(child.queue.length, 0);
    assert.notEqual(child.branchContext, source.messages);
    assert.equal(child.snapshot, undefined);
  }
});

test("review branch back to coding carries context but not frozen evidence or results", () => {
  const source = structuredClone(fixtures.sessions.find(s => s.agent === "review"));
  source.status = "published";
  source.snapshot = "frozen-original";
  source.branchContext = [{ role: "agent", agent: "code", text: "原编码答复" }];
  const child = branch(source, "code", "s40", {}, "已发布报告正文");
  assert.equal(child.branchContext[0].agent, "code");
  assert.equal(child.branchContext.at(-1).agent, "review");
  assert.equal(child.branchContext.at(-1).text, "已发布报告正文");
  for (const key of ["snapshot", "outcome", "parent", "criteria", "material", "generation"]) assert.equal(child[key], undefined);
  assert.equal(child.round, 0);
  assert.equal(child.status, "idle");
});

test("refresh preserves branch origin, context authors and settings even when origin is deleted", () => {
  const data = structuredClone(fixtures);
  const source = data.sessions[0];
  const child = branch(source, "review", "s40", {});
  child.model = "openai/gpt-5.4";
  child.thinking = "high";
  data.sessions = [...data.sessions.filter(s => s.id !== source.id), child];
  const restored = codec.decode(codec.encode(data, { project: child.project, session: child.id, view: "session" }), fixtures);
  const result = restored.data.sessions.find(s => s.id === child.id);
  assert.equal(restored.state.session, child.id);
  assert.equal(result.branchFrom, source.id);
  assert.equal(result.branchTitle, source.title);
  assert.equal(result.branchContext[1].agent, "code");
  assert.equal(result.model, child.model);
  assert.equal(result.thinking, "high");
});

test("model changes cannot rewrite active tasks, queued inputs, unknown results or closed reviews", () => {
  const source = { agent: "code", status: "stopped", queue: [] };
  assert.equal(modelLock(source), "");
  for (const status of ["running", "capturing", "stopping", "finishing", "unknown"]) assert.ok(modelLock({ ...source, status }));
  assert.ok(modelLock({ ...source, queue: ["待执行"] }));
  for (const status of ["published", "stopped", "failed"]) assert.ok(modelLock({ ...source, agent: "review", status }));
  for (const status of ["idle", "waiting"]) assert.equal(modelLock({ ...source, agent: "review", status }), "");
});
