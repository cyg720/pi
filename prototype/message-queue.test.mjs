import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const context = vm.createContext({ window: {}, structuredClone });
for (const file of ["fixtures.js", "review-rounds.js", "workspace-state.js", "message-queue.js"]) {
  vm.runInContext(readFileSync(new URL(file, import.meta.url), "utf8"), context);
}
const queue = context.window.WorkbenchMessageQueue;

test("running sends queue in order; inserting waits for a boundary without restarting the run", () => {
  const s = { agent: "code", status: "running", generation: 7, queue: [], messages: [] };
  assert.equal(queue.enqueue(s, "第一条"), true);
  queue.enqueue(s, "第二条");
  assert.equal(s.messages.length, 0);
  assert.equal(queue.insert(s, 1), true);
  assert.equal(s.queue.join(), "第一条");
  assert.equal(s.messages[0].mode, queue.pending);
  assert.equal(s.status, "running");
  assert.equal(s.generation, 7);
  assert.equal(queue.boundary(s), 1);
  assert.equal(queue.boundary(s), 0);
  assert.equal(s.messages[0].mode, "已在步骤边界插入 · 演示");
});

test("invalid indices and unavailable states cannot insert or enqueue", () => {
  const s = { agent: "code", status: "running", queue: ["保留"], messages: [] };
  for (const index of [-1, 2, NaN, 0.5]) assert.equal(queue.insert(s, index), false);
  for (const status of ["stopping", "unknown", "failed", "done"]) {
    s.status = status;
    assert.equal(queue.insert(s, 0), false);
    assert.equal(queue.enqueue(s, "不接收"), false);
  }
  s.status = "running"; s.agent = "review";
  assert.equal(queue.insert(s, 0), false);
  assert.equal(s.queue[0], "保留");
});

test("queued edits reject stale snapshots and leave the composer draft alone", () => {
  const s = { queue: ["原文", "下一条"], draft: "未发送草稿" };
  const revision = JSON.stringify(s.queue);
  assert.equal(queue.edit(s, 0, revision, "修改后"), true);
  assert.equal(queue.edit(s, 0, revision, "旧弹窗"), false);
  assert.equal(queue.edit(s, 1, JSON.stringify(s.queue), "   "), false);
  assert.equal(s.draft, "未发送草稿");
});

test("refresh preserves queue order and pending insert; stopping cancels without delivery", () => {
  const data = structuredClone(context.window.WorkbenchFixtures);
  const s = data.sessions[0]; s.queue = []; s.status = "running";
  queue.enqueue(s, "先排队"); queue.enqueue(s, "先插入"); queue.insert(s, 1);
  const codec = context.window.WorkbenchWorkspace;
  const restored = codec.decode(codec.encode(data, { project: s.project, session: s.id, view: "session" }), data).data.sessions[0];
  assert.equal(restored.queue[0], "先排队");
  assert.equal(restored.messages.at(-1).mode, queue.pending);
  queue.cancel(restored);
  assert.equal(restored.messages.at(-1).mode, "未送达 · 已取消插入");
  assert.equal(queue.boundary(restored), 0);
  assert.equal(s.messages.at(-1).mode, queue.pending);
});
