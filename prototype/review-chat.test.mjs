import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const context = vm.createContext({ window: {}, structuredClone });
for (const file of ["fixtures.js", "review-rounds.js", "workspace-state.js", "session-options.js", "message-queue.js", "review-chat.js"]) {
  vm.runInContext(readFileSync(new URL(file, import.meta.url), "utf8"), context);
}
const w = context.window;

test("old review requests and results become messages once, keeping references and unsent text", () => {
  const data = structuredClone(w.WorkbenchFixtures);
  const s = data.sessions.find(s => s.id === "s3");
  s.draft = "请再检查错误码";
  s.reviewRounds = [{ round: 1, status: "published", requirement: "旧请求", outcome: "unknown", snapshot: "old", material: "docs/api.md", messages: [] }];
  s.round = 2; s.viewedRound = 1;
  w.WorkbenchReviewChat.migrate(s);
  assert.equal(s.status, "done");
  assert.equal(s.draft, "请再检查错误码");
  assert.ok(s.messages.some(m => m.text.includes("旧请求")));
  assert.ok(s.messages.some(m => m.text.includes("暂不能判定")));
  assert.ok(s.messages.some(m => m.text.includes("通过")));
  assert.equal(s.reviewRounds[0].snapshot, "old");
  assert.equal(w.WorkbenchReviewRounds.displayed(s), s);
  const saved = w.WorkbenchWorkspace.decode(w.WorkbenchWorkspace.encode(data, { project: s.project, session: s.id, view: "session" }), data);
  const restored = saved.data.sessions.find(item => item.id === s.id);
  const before = JSON.stringify(restored);
  w.WorkbenchReviewChat.migrate(restored);
  assert.equal(JSON.stringify(restored), before);
  assert.equal(restored.reviewChat, true);
});

test("review branches stay idle and isolated; source draft is not sent by conversion", () => {
  const source = structuredClone(w.WorkbenchFixtures.sessions[0]);
  source.draft = "审查导出";
  const child = w.WorkbenchSessionOptions.branch(source, "review", "new", {});
  w.WorkbenchReviewChat.migrate(child);
  assert.equal(child.messages.length, 0);
  assert.equal(child.status, "idle");
  assert.equal(child.draft, source.draft);
  assert.equal(child.snapshot, undefined);
  assert.equal(child.queue.length, 0);
});

test("review chat uses queue and boundary insert, and releases settings after completion", () => {
  const s = { agent: "review", reviewChat: true, status: "running", messages: [], queue: [], generation: 4 };
  assert.equal(w.WorkbenchMessageQueue.enqueue(s, "补充要求"), true);
  assert.equal(w.WorkbenchMessageQueue.insert(s, 0), true);
  assert.equal(w.WorkbenchMessageQueue.boundary(s), 1);
  assert.equal(s.generation, 4);
  s.status = "done";
  assert.equal(w.WorkbenchSessionOptions.modelLock(s), "");
  s.status = "unknown";
  assert.ok(w.WorkbenchSessionOptions.modelLock(s));
});

test("conversion preserves unresolved operations and does not fabricate completion", () => {
  const s = { agent: "review", status: "unknown", round: 1, requirement: "检查", messages: [], queue: ["稍后"], recoveryBlocked: true };
  w.WorkbenchReviewChat.migrate(s);
  assert.equal(s.status, "unknown");
  assert.equal(s.queue.length, 1);
  assert.equal(s.recoveryBlocked, true);
  assert.equal(s.messages.some(m => m.text.includes("审查结论")), false);
});
