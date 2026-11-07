import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const ctx = vm.createContext({ window: {}, structuredClone });
for (const file of ["fixtures.js", "review-rounds.js", "session-options.js", "operations.js", "usage.js", "workspace-state.js"]) {
  vm.runInContext(readFileSync(new URL(file, import.meta.url), "utf8"), ctx);
}
const { WorkbenchReviewRounds: rounds, WorkbenchSessionOptions: options, WorkbenchOperations: ops, WorkbenchUsage: usage, WorkbenchWorkspace: codec, WorkbenchFixtures: fixtures } = ctx.window;
const sample = () => ({ ...structuredClone(fixtures.sessions[2]), draft: "新要求", draftRevision: 3, attachments: [], messages: [] });

test("context defaults apply to new branches, remain fixed for existing sessions and survive refresh", () => {
  const source = sample();
  const ref = source.model;
  source.contextDefaults = { [ref]: 32000 };
  const defaults = { [ref]: 64000 };
  const intent = ops.prepare("branch", source, { requestId: "context-branch", targetId: "s80", limits: {}, contextDefaults: defaults });
  defaults[ref] = 128000;
  const sessions = [source];
  assert.equal(ops.commit(intent, sessions, []).status, "committed");
  assert.equal(sessions[1].contextDefaults[ref], 64000);
  assert.equal(source.contextDefaults[ref], 32000);
  assert.equal(rounds.next(source, {}), true);
  assert.equal(source.contextDefaults[ref], 32000);
  const restored = codec.decode(codec.encode({ ...structuredClone(fixtures), sessions }, { project: source.project, view: "overview" }), fixtures);
  assert.equal(restored.data.sessions[0].contextDefaults[ref], 32000);
  assert.equal(restored.data.sessions[1].contextDefaults[ref], 64000);
});

test("new round seals old identity and draft, has independent context, and cannot bypass settlement", () => {
  const s = sample();
  rounds.ensure(s);
  const oldId = s.conversationId;
  const intent = ops.prepare("round", s, { requestId: "req1", targetId: s.id, limits: {} });
  const records = [];
  assert.equal(ops.commit(intent, [s], records).status, "committed");
  assert.equal(s.round, 2);
  assert.notEqual(s.conversationId, oldId);
  assert.equal(s.parentRoundId, s.reviewRounds[0].roundId);
  assert.equal(s.reviewRounds[0].draft, "新要求");
  assert.equal(s.draft, "新要求");
  assert.equal(s.reviewRounds[0].sealed, true);
  assert.equal(ops.commit(intent, [s], records).status, "committed");
  assert.equal(s.round, 2);
  assert.equal(ops.commit({ ...intent, targetAgent: "code" }, [s], records).status, "rejected");
  s.status = "published";
  s.settling = true;
  assert.equal(rounds.next(s, {}), false);
  s.settling = false;
  s.reviewRounds[0].status = "running";
  assert.equal(rounds.next(s, {}), false);
});

test("branch freezes cutoff and authors, excludes tool/private fields, deduplicates ancestor context", () => {
  const s = sample();
  s.agent = "code";
  s.messages = [{ role: "user", text: "问题", secret: "secret" }, { role: "tool", text: "工具原始结果" }, { role: "agent", text: "回复", thinking: "hidden" }];
  const intent = ops.prepare("branch", s, { requestId: "branch1", targetId: "s80", targetAgent: "review", limits: {} });
  s.messages.push({ role: "user", text: "迟到消息" });
  s.draft = "新编辑";
  const sessions = [s], records = [];
  const receipt = ops.commit(intent, sessions, records);
  const child = sessions[1];
  assert.equal(receipt.status, "committed");
  assert.equal(child.branchContext.length, 2);
  assert.equal(child.draft, "新要求");
  assert.equal(s.draft, "新编辑");
  assert.equal(JSON.stringify(child).includes("secret"), false);
  assert.equal(JSON.stringify(child).includes("hidden"), false);
  const grandchild = options.branch(child, "code", "s81", {});
  assert.equal(grandchild.branchContext.length, 2);
  assert.equal(grandchild.branchContext[0].origin, child.branchContext[0].origin);
  assert.equal(grandchild.snapshot, undefined);
  assert.equal(grandchild.queue.length, 0);
});

test("pending refresh only queries receipt, never creates and never clears later draft", () => {
  const data = structuredClone(fixtures);
  const s = data.sessions[2];
  const intent = ops.prepare("round", s, { requestId: "pending1", targetId: s.id, limits: {} });
  const state = { project: s.project, session: s.id, view: "session", pendingOperation: ops.reference(intent) };
  let restored = codec.decode(codec.encode(data, state), fixtures);
  assert.equal(ops.lookup(restored.state.pendingOperation, restored.data.operationReceipts).status, "unknown");
  assert.equal(restored.data.sessions[2].round, 1);
  ops.commit(intent, data.sessions, data.operationReceipts ||= []);
  s.draft = "响应到达前的新草稿";
  s.viewedRound = 1;
  restored = codec.decode(codec.encode(data, state), fixtures);
  assert.equal(ops.lookup(restored.state.pendingOperation, restored.data.operationReceipts).status, "committed");
  assert.equal(restored.data.sessions[2].round, 2);
  assert.equal(restored.data.sessions[2].viewedRound, 1);
  assert.equal(restored.data.sessions[2].draft, "响应到达前的新草稿");
});

test("later reference report does not rewind parent and invalid source is rejected", () => {
  const s = sample(); rounds.ensure(s); rounds.next(s, {});
  s.status = "published"; s.outcome = "pass"; rounds.ensure(s);
  const previous = s.roundId;
  const firstReport = s.reviewRounds[0].reportId;
  assert.equal(rounds.next(s, {}, { sourceReportId: firstReport }), true);
  assert.equal(s.parentRoundId, previous);
  assert.equal(s.sourceReportId, firstReport);
  s.status = "published";
  assert.equal(rounds.next(s, {}, { sourceReportId: "another-review" }), false);
});

test("stats are unknown without receipts; partial cache, compaction and separate approval costs stay explicit", () => {
  assert.equal(usage.read(sample()).tokens, null);
  const s = sample(); s.usageSample = usage.example("partial");
  const value = usage.read(s);
  assert.equal(value.tokens, 170);
  assert.equal(value.cache, 40);
  assert.equal(value.partial, true);
  s.usageSample.models = [{ input: 100, output: 20, cacheRead: 0, cacheWrite: 0 }];
  assert.equal(usage.read(s).cache, null);
  s.usageSample.contextWindow = 0;
  assert.equal(usage.read(s).context, null);
});

test("missing historical view never shows current data and old unsafe work blocks restart", () => {
  const s = sample(); rounds.next(s, {}); s.viewedRound = 999;
  assert.equal(rounds.displayed(s).missing, true);
  assert.equal(rounds.displayed(s).snapshot, undefined);
  s.reviewRounds[0].status = "finishing";
  const data = structuredClone(fixtures); data.sessions = [s];
  const restored = codec.decode(codec.encode(data, { project: s.project, session: s.id, view: "session" }), fixtures);
  assert.equal(restored.data.sessions[0].recoveryBlocked, true);
  assert.equal(restored.data.sessions[0].reviewRounds[0].status, "unknown");
});

test("review totals stop at viewed round and speed/window never leak from the current round", () => {
  const s = sample(); s.usageSample = usage.example("estimate");
  rounds.next(s, {});
  assert.equal(usage.read(s).tokens, null);
  s.usageSample = usage.example("partial");
  assert.equal(usage.read(s).tokens, 340);
  assert.equal(usage.read(s).context, null);
  s.viewedRound = 1;
  assert.equal(usage.read(rounds.displayed(s)).tokens, 170);
  assert.equal(usage.read(rounds.displayed(s)).context, 10);
});
