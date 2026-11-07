import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const context = vm.createContext({ window: {}, structuredClone, crypto: webcrypto, TextEncoder });
vm.runInContext(readFileSync(new URL('./agent-studio-state.js', import.meta.url), 'utf8'), context);
const studio = context.window.WorkbenchStudio;

test('uploaded skill metadata is versioned per agent and never grants tools', () => {
  const original = studio.initial();
  const draft = studio.addSkill(original.review.versions[0], { name: '验收清单.zip', size: 128 }, 'skill-1');
  assert.equal(original.review.versions[0].uploadedSkills, undefined);
  const next = studio.save(original, 'review', 1, draft);
  const restored = studio.decode(JSON.stringify(next));
  assert.equal(restored.review.versions[1].uploadedSkills[0].name, '验收清单');
  assert.equal(restored.review.versions[1].capabilities.join(), original.review.versions[0].capabilities.join());
  assert.equal(restored.code.versions[0].uploadedSkills, undefined);
  assert.throws(() => studio.addSkill(draft, { name: '验收清单.zip', size: 128 }, 'skill-2'), /已添加/);
  assert.throws(() => studio.addSkill(draft, { name: '脚本.exe', size: 128 }, 'skill-2'), /ZIP/);
  restored.review.versions[1].uploadedSkills[0].enabled = 'yes';
  assert.equal(studio.decode(JSON.stringify(restored)), null);
});

test('skill category survives refresh only when recognized', () => {
  assert.equal(studio.pageReference({ agent: 'review', sectionId: 'skills', skillCategory: 'uploaded' }, 'demo').skillCategory, 'uploaded');
  assert.equal(studio.pageReference({ agent: 'review', sectionId: 'skills', skillCategory: 'bad' }, 'demo').skillCategory, undefined);
});

test('save makes an immutable version; old definition and other agent stay intact', () => {
  const original = studio.initial();
  const draft = structuredClone(original.code.versions[0]);
  draft.name = '工程助手';
  const next = studio.save(original, 'code', 1, draft);
  assert.equal(next.code.current, 2);
  assert.equal(next.code.versions[0].name, '编码智能体');
  assert.equal(next.code.versions[1].name, '工程助手');
  assert.equal(original.code.current, 1);
  assert.equal(next.review.current, 1);
});

test('stale version, invalid name and unsupported capability cannot be saved', () => {
  const original = studio.initial();
  const draft = structuredClone(original.review.versions[0]);
  assert.throws(() => studio.save(original, 'review', 0, draft), /版本/);
  draft.name = ' ';
  assert.throws(() => studio.save(original, 'review', 1, draft), /名称/);
  draft.name = '审查'; draft.capabilities.push('write');
  assert.throws(() => studio.save(original, 'review', 1, draft), /能力/);
});

test('evolution belongs to the agent; approval appends only a future version', () => {
  const original = studio.initial();
  original.code.versions[0].improvements.p1 = true;
  const next = studio.applyEvolution(original, 'code', 1);
  assert.equal(next.code.versions[1].improvements['delivery-boundaries'], true);
  assert.equal(next.code.versions[1].improvements.p1, undefined);
  assert.equal(next.review.versions[0].improvements['delivery-boundaries'], undefined);
  assert.equal(next.code.versions[0].improvements['delivery-boundaries'], undefined);
  assert.equal(next.code.versions[0].improvements.p1, true);
  assert.throws(() => studio.applyEvolution(next, 'code', 2), /已应用/);
});

test('corrupt and identity-tampered cache is rejected', () => {
  assert.equal(studio.decode('{'), null);
  const original = studio.initial();
  assert.ok(studio.decode(JSON.stringify(original)));
  original.review.id = 'lg-codeing-agent';
  assert.equal(studio.decode(JSON.stringify(original)), null);
});

test('saving edited configuration drops legacy project flags only from the new version', () => {
  const original = studio.initial();
  original.code.versions[0].improvements.p1 = true;
  const next = studio.save(original, 'code', 1, original.code.versions[0]);
  assert.equal(Object.keys(next.code.versions[1].improvements).length, 0);
  assert.equal(next.code.versions[0].improvements.p1, true);
});

test('saving cannot replace damaged or removed persisted definitions with memory', () => {
  const original = studio.initial();
  assert.equal(studio.readForSave(null, original).code.current, 1);
  assert.throws(() => studio.readForSave('{', original), /损坏/);
  const next = studio.save(original, 'code', 1, original.code.versions[0]);
  assert.throws(() => studio.readForSave(null, next), /移除/);
  assert.equal(studio.readForSave(JSON.stringify(next), original).code.current, 2);
});

test('agent traces include valid source projects, never another agent or deleted project', () => {
  const data = { projects: [{ id: 'p1' }, { id: 'p2' }], sessions: [
    { id: 'a', project: 'p1', agent: 'code' },
    { id: 'b', project: 'p2', agent: 'code' },
    { id: 'c', project: 'p1', agent: 'review' },
    { id: 'd', project: 'deleted', agent: 'code' },
  ] };
  assert.equal(studio.records(data, 'code').map(item => item.id).join(), 'a,b');
  assert.equal(studio.records(data, 'review').map(item => item.id).join(), 'c');
  assert.equal(studio.records({ projects: [], sessions: data.sessions }, 'code').length, 0);
});

test('cached improvement records must contain boolean states', () => {
  const original = studio.initial();
  original.code.versions[0].improvements.p1 = { enabled: true };
  assert.equal(studio.decode(JSON.stringify(original)), null);
  assert.throws(() => studio.save(studio.initial(), 'constructor', 1, {}));
});

test('lost save acknowledgement is looked up by original request without another version', async () => {
  const original = studio.initial();
  const draft = structuredClone(original.code.versions[0]);
  draft.role = '先检查边界';
  const intent = await studio.prepareSave('code', 1, draft, 'request-1');
  assert.equal(JSON.stringify(intent).includes(draft.role), false);
  const next = await studio.commitSave(original, intent, draft);
  const restored = studio.decode(JSON.stringify(next));
  assert.equal(studio.lookupSave(restored, intent).version, 2);
  assert.equal((await studio.commitSave(restored, intent, draft)).code.current, 2);
  assert.equal(original.code.current, 1);
  assert.equal(studio.lookupSave(original, intent), null);
  assert.throws(() => studio.lookupSave(restored, { ...intent, fingerprint: 'different' }), /不匹配/);
  await assert.rejects(studio.commitSave(restored, intent, { ...draft, role: '后来修改' }), /不匹配/);
});

test('saved version strips project scope and arbitrary fields; malformed receipts are rejected', async () => {
  const original = studio.initial();
  const draft = { ...original.review.versions[0], scope: 'p1', project: 'p1', apiKey: 'not-config' };
  const intent = await studio.prepareSave('review', 1, draft, 'request-2');
  const next = await studio.commitSave(original, intent, draft);
  assert.equal(next.review.versions[1].scope, undefined);
  assert.equal(next.review.versions[1].apiKey, undefined);
  assert.equal(studio.readForSave(JSON.stringify(next), original).review.current, 2);
  next.saveReceipts[0].version = 999;
  assert.equal(studio.decode(JSON.stringify(next)), null);
});

test('page restoration is instance-bound and removes legacy scope and draft fields', () => {
  const restored = studio.pageReference({ agent: 'code', section: 5, scope: 'p1', draft: 'private' }, 'demo');
  assert.equal(JSON.stringify(restored), JSON.stringify({ instanceId: 'demo', agent: 'code', section: 6, sectionId: 'evolution' }));
  assert.equal(studio.pageReference({ instanceId: 'other', agent: 'code', section: 5 }, 'demo'), null);
  assert.equal(studio.pageReference({ agent: 'removed', section: 0 }, 'demo'), null);
  assert.equal(studio.pageReference({ agent: 'review', section: 99 }, 'demo').section, 0);
  assert.equal(studio.pageReference({ agent: 'code', definitionVersion: 6 }, 'demo').definitionVersion, 6);
  assert.equal(studio.pageReference({ agent: 'code', definitionVersion: -1 }, 'demo').definitionVersion, undefined);
});

test('splitting MCP preserves old page meaning and restores new tabs by stable identity', () => {
  const oldIds = ['basics', 'soul', 'skills', 'memory', 'knowledge', 'evolution', 'traces'];
  oldIds.forEach((id, section) => {
    const restored = studio.pageReference({ agent: 'code', section }, 'demo');
    assert.equal(restored.sectionId, id);
    assert.equal(studio.pageReference(restored, 'demo').sectionId, id);
  });
  assert.equal(studio.pageReference({ agent: 'review', sectionId: 'mcp', section: 2 }, 'demo').section, 3);
  assert.equal(studio.pageReference({ agent: 'review', sectionId: 'traces' }, 'demo').section, 7);
  assert.equal(studio.pageReference({ agent: 'code', sectionId: 'removed', section: 5 }, 'demo').section, 0);
});

test('evolution changes the next definition and missing evidence cannot apply it', () => {
  const original = studio.initial();
  assert.throws(() => studio.evolutionDraft(original, 'code', 1, false), /证据/);
  const draft = studio.evolutionDraft(original, 'code', 1, true);
  assert.match(draft.role, /空数据/);
  assert.equal(original.code.versions[0].role.includes('空数据'), false);
});
