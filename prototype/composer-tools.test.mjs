import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const context = vm.createContext({ window: {}, structuredClone });
for (const file of ["fixtures.js", "review-rounds.js", "workspace-state.js", "session-options.js", "composer-tools.js"]) {
  vm.runInContext(readFileSync(new URL(file, import.meta.url), "utf8"), context);
}
const tools = context.window.WorkbenchComposerTools;
const codec = context.window.WorkbenchWorkspace;
const fixtures = context.window.WorkbenchFixtures;
const refs = [{ kind: "file", path: "src/services/export.ts" }, { kind: "folder", path: "src/services" }];

test("sample references deduplicate and cannot cross project file sets", () => {
  const record = { attachments: [...refs, refs[0], null, { kind: "folder", path: "src/service" }, { kind: "file", path: "../secret" }] };
  assert.equal(tools.references(record, fixtures.files.p1).length, 2);
  assert.equal(tools.references(record, fixtures.files.p2).length, 0);
  const message = tools.message(record, fixtures.files.p1, "请检查");
  assert.ok(message.includes("[文件] src/services/export.ts"));
  assert.ok(message.includes("[文件夹] src/services"));
  assert.ok(!message.includes("../secret"));
  assert.equal(tools.mode({ approvalMode: "invalid" }), "auto");
});

test("refresh retains approval and draft refs while discarding invalid entries", () => {
  const data = structuredClone(fixtures);
  data.sessions[0].approvalMode = "manual";
  data.sessions[0].attachments = refs;
  const state = { project: "p1", view: "create", newSessionDraft: { project: "p1", task: "检查", approvalMode: "full", attachments: [...refs, { kind: "file", path: "not-exist" }] } };
  const restored = codec.decode(codec.encode(data, state), fixtures);
  assert.equal(restored.state.newSessionDraft.approvalMode, "full");
  assert.equal(restored.state.newSessionDraft.attachments.length, 2);
  assert.equal(restored.data.sessions[0].approvalMode, "manual");
  assert.equal(restored.data.sessions[0].attachments.length, 2);
});

test("fork copies draft references without sharing mutable selection or execution", () => {
  const source = structuredClone(fixtures.sessions[0]);
  source.attachments = structuredClone(refs);
  source.approvalMode = "manual";
  const child = context.window.WorkbenchSessionOptions.branch(source, "review", "s42", {});
  child.attachments.pop();
  assert.equal(source.attachments.length, 2);
  assert.equal(child.approvalMode, "manual");
  assert.equal(child.status, "idle");
});
