import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { selectFeatureSpecs, validateFeatureSources } from './src/catalog.mjs';
import { attachCapabilities } from './src/capabilities.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const data = JSON.parse(read('source-code-html/index.html').match(/<script id="doc-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);

test('导览使用当前 checkout，不能把另一分支工作台当成当前实现', () => {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  assert.equal(data.meta.commit, head);
  assert.equal(data.meta.version, JSON.parse(read('packages/coding-agent/package.json')).version);
  assert.equal(data.packages.length, 11);
  assert.ok(!data.catalog.modules.some(m => m.id.startsWith('workbench-')));
  assert.ok(!data.catalog.features.some(f => ['coding-native-settings', 'engineering-workbench'].includes(f.id)));
  assert.ok(!data.mastery.routes.some(r => r.id === 'workbench-request'));
  assert.ok(!data.chapters.find(c => c.id === 'development').sections.some(s => s.commands?.some(c => /(?:start|build|test):workbench/.test(c.code))));
  for (const path of Object.keys(data.sources)) assert.ok(existsSync(new URL(path, root)), path);
});

test('失效工作台编号保留历史身份，当前接口和示例已迁移', () => {
  for (const c of data.catalog.capabilities.filter(c => /^(WBW|WBP|WBS|WBR)-/.test(c.id))) {
    assert.equal(c.status, '历史资料');
    assert.deepEqual(c.relatedFeatures, []);
    assert.deepEqual(c.files, []);
    assert.ok(data.mastery.coverage.find(item => item.id === c.id)?.routes.includes('design-history'));
  }
  const views = data.catalog.features.find(f => f.id === 'durable-views');
  assert.ok(views.files.includes('packages/durable/src/session/session.ts'));
  assert.doesNotMatch(views.entry, /viewState|documentState/);
  assert.ok(data.catalog.features.some(f => f.id === 'durable-indexeddb'));
  assert.ok(data.catalog.features.some(f => f.id === 'durable-read-only'));
  assert.ok(data.catalog.features.some(f => f.id === 'ai-client-identity'));
  for (const f of data.catalog.features.filter(f => f.module === 'durable-examples')) assert.equal(f.evidence, '中文能力解说', f.id);
  assert.match(data.catalog.features.find(f => f.id === 'chord-output').behavior, /Date\.now/);
  const oldPatch = data.catalog.capabilities.find(c => c.id === 'OTH-90');
  assert.equal(oldPatch.status, '历史资料');
  assert.deepEqual(oldPatch.relatedFeatures, []);
  assert.equal(data.catalog.capabilities.find(c => c.id === 'DUR-21').entry, '`Conversation.watch()`');
  assert.doesNotMatch(data.catalog.capabilities.find(c => c.id === 'CHR-35').purpose, /Durable 文档和视图继续复用/);
  assert.match(read('source-code-html/src/app.js'), /\['workbench', '历史工作台与边界'/);
  assert.ok(data.catalog.capabilities.find(c => c.id === 'OTH-60').relatedFeatures.some(id => id.includes('21-subagent-foreground')));
  assert.ok(!data.catalog.capabilities.find(c => c.id === 'OTH-60').relatedFeatures.some(id => id.includes('24-compaction')));
});

test('只退休已声明的缺席功能，部分工作台存在时仍逐条验证其源码', () => {
  const absent = selectFeatureSpecs(['packages/coding-agent/src/core/settings-manager.ts']);
  assert.ok(absent.retired.includes('coding-native-settings'));
  assert.ok(absent.retired.includes('workbench-web-startup'));
  assert.ok(absent.specs.coding.some(s => s[0] === 'startup'));
  const path = 'packages/coding-agent/src/core/workbench-config.ts';
  const present = selectFeatureSpecs([path]);
  assert.ok(!present.retired.includes('coding-native-settings'));
  const spec = present.specs.coding.find(s => s[0] === 'native-settings');
  assert.ok(spec);
  assert.throws(() => validateFeatureSources([path, 'README.md'], [{ id: 'coding', root: 'packages/coding-agent/src/', doc: 'README.md' }], { coding: [spec] }), /settings-manager/);
});

test('退休编号不伪造源码关联，未登记的失效映射仍失败', () => {
  const markdown = '## 01 测试\n| UI-01 | 旧入口 | 历史能力 | old() | 库 | [资料][doc] |\n[doc]: ../../README.md\n';
  const catalog = { features: [], files: {}, retiredFeatures: ['old'] };
  attachCapabilities({ catalog, markdown, read: () => '# 历史', bindings: { 'UI-01': ['old'] } });
  assert.equal(catalog.capabilities[0].status, '历史资料');
  assert.deepEqual(catalog.capabilities[0].files, []);
  assert.throws(() => attachCapabilities({ catalog, markdown, read: () => '# 历史', bindings: { 'UI-01': ['typo'] } }), /专题不存在/);
});
