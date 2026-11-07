import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const context = vm.createContext({ window: {}, structuredClone });
for (const file of ["fixtures.js", "review-rounds.js", "workspace-state.js", "turn-navigation.js"]) {
  vm.runInContext(readFileSync(new URL(file, import.meta.url), "utf8"), context);
}
const { WorkbenchReviewRounds: rounds, WorkbenchWorkspace: codec, WorkbenchFixtures: fixtures, WorkbenchTurnNavigation: navigation } = context.window;
const sample = () => ({ id: "s99", project: "p1", title: "审查", agent: "review", model: "test/model", round: 1, status: "published", snapshot: "SNAP-ONE", outcome: "fail", criteria: "原标准", material: "src/services/export.ts", requirement: "原要求", draft: "补充要求", queue: [], messages: [], limit: 30 });

test("new review round keeps conversation identity and immutable old report", () => {
  const s = sample();
  assert.equal(rounds.next(s, { limit: 40 }), true);
  assert.equal(s.id, "s99");
  assert.equal(s.title, "审查");
  assert.equal(s.round, 2);
  assert.equal(s.status, "idle");
  assert.equal(s.snapshot, undefined);
  assert.equal(s.requirement, "补充要求");
  assert.equal(s.reviewRounds[0].limit, 30);
  s.criteria = "新标准";
  s.viewedRound = 1;
  const old = rounds.displayed(s);
  assert.equal(old.criteria, "原标准");
  assert.equal(old.snapshot, "SNAP-ONE");
  assert.equal(old.outcome, "fail");
  assert.equal(old.archived, true);
  assert.equal(s.status, "idle");
  assert.equal(rounds.next(s, {}), false);
});

test("active work and pending queues cannot be archived as a new round", () => {
  for (const status of ["running", "capturing", "finishing", "stopping", "unknown", "blocked", "idle", "waiting"]) {
    const s = { ...sample(), status };
    assert.equal(rounds.next(s, {}), false);
    assert.equal(s.round, 1);
  }
  assert.equal(rounds.next({ ...sample(), queue: ["未处理"] }, {}), false);
});

test("refresh keeps historical round and its material tab without adding sessions", () => {
  const data = structuredClone(fixtures);
  const s = sample();
  data.sessions.push(s);
  rounds.next(s, {});
  s.viewedRound = 1;
  const state = { project: "p1", session: s.id, view: "session", inspector: "materials", viewers: { p1: { tabs: [{ id: "file-100", key: JSON.stringify(["src/services/export.ts", "materials", "SNAP-ONE"]), path: "src/services/export.ts", source: "materials", label: "第 1 轮" }], active: "file-100", open: true } } };
  const result = codec.decode(codec.encode(data, state), fixtures);
  assert.equal(result.data.sessions.length, data.sessions.length);
  const restored = result.data.sessions.find(item => item.id === s.id);
  assert.equal(restored.status, "idle");
  assert.equal(rounds.displayed(restored).snapshot, "SNAP-ONE");
  assert.equal(result.state.viewers.p1.tabs.length, 1);
  restored.viewedRound = restored.round;
  assert.equal(rounds.displayed(restored).criteria, "原标准");
  assert.equal(rounds.displayed(restored).archived, undefined);
});

test("message navigation binds each prompt only to its own replies", () => {
  const entries = navigation.entries([{ role: "agent", text: "欢迎" }, { role: "user", text: "第一问" }, { role: "agent", text: "第一答" }, { role: "user", text: "第二问" }]);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].index, 1);
  assert.equal(entries[0].reply, "第一答");
  assert.equal(entries[1].reply, "");
});

test("stopped round without materials does not borrow the next round snapshot", () => {
  const s = sample();
  s.status = "stopped";
  delete s.snapshot;
  delete s.outcome;
  rounds.next(s, {});
  s.snapshot = "NEW-SNAPSHOT";
  s.outcome = "pass";
  s.viewedRound = 1;
  const old = rounds.displayed(s);
  assert.equal(old.snapshot, undefined);
  assert.equal(old.outcome, undefined);
  assert.equal(old.status, "stopped");
});
