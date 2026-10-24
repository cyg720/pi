import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const data = JSON.parse(readFileSync(new URL('index.html', import.meta.url), 'utf8').match(/<script id="doc-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
test('工作台四层仅在 checkout 存在对应源码时列为当前功能', () => {
  const currentApps = execFileSync('git', ['ls-files', '-z', '--', 'apps'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  if (!currentApps.length) { assert.ok(!data.catalog.modules.some(m => m.id.startsWith('workbench-'))); return; }
  for (const id of ['workbench-web', 'workbench-protocol', 'workbench-server', 'workbench-runtime']) {
    const module = data.catalog.modules.find(m => m.id === id);
    assert.ok(module, id);
    const features = data.catalog.features.filter(f => f.module === id && f.evidence === '中文能力解说');
    assert.ok(features.length >= 3, id);
    assert.ok(features.some(f => f.tests.length), `${id} 测试关联`);
    assert.ok(features.some(f => f.files.some(p => data.catalog.files[p].imports.some(i => i.target))), `${id} 引用关联`);
  }
  const paths = execFileSync('git', ['ls-files', '-z', '--', 'apps'], { cwd: root, encoding: 'utf8' }).split('\0').filter(p => /^apps\/[^/]+\/src\//.test(p));
  for (const path of paths) assert.ok(data.catalog.files[path]?.features.length && Object.hasOwn(data.sources, path), path);
  const target = 'apps/agent-web/src/features/coding-agent/entries/NativeSettings.ts';
  const edge = data.catalog.files[target].tests.find(t => t.kind === '已核对的 esbuild 测试入口');
  assert.ok(edge, '打包后的 UI 测试须区分于直接 import');
  assert.match(data.sources[edge.path].split('\n')[edge.line - 1], /export \* from '\.\/src\/features\/coding-agent\/entries\/NativeSettings'/);
});
test('工作台学习、开发、教程入口区分当前源码与历史快照', () => {
  if (!data.catalog.modules.some(m => m.id === 'workbench-web')) {
    assert.match(data.chapters.find(c => c.id === 'workbench').title, /历史/);
    assert.ok(!data.tutorials.some(p => ['agent-web', 'agent-server', 'agent-protocol', 'agent-runtime-adapter'].includes(p.id)));
    assert.ok(!data.mastery.routes.some(route => route.id === 'workbench-request'));
    return;
  }
  const chapter = data.chapters.find(c => c.id === 'workbench');
  assert.ok(chapter && chapter.sections.length >= 8);
  assert.ok(data.chapters.find(c => c.id === 'development').sections.some(s => s.commands?.some(c => c.code.includes('start:workbench'))));
  for (const id of ['agent-web', 'agent-server', 'agent-protocol', 'agent-runtime-adapter']) {
    const p = data.tutorials.find(p => p.id === id);
    assert.ok(p?.manifest && p.symbols.length && p.tests.length, id);
    assert.ok(p.lesson.flow.length >= 3, id);
  }
  assert.equal(data.catalog.capabilities.length, 640);
  assert.ok(data.catalog.capabilityCoverage.source.startsWith('source-code-html/reference/'));
  assert.ok(data.mastery.routes.some(route => route.id === 'design-history'));
});
