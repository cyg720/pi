import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { Script } from 'node:vm';
import { classifyPath, discoverModules } from './src/catalog.mjs';
import { developmentGuide } from './src/development.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(dir, 'index.html'), 'utf8');
const data = JSON.parse(html.match(/<script id="doc-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
test('本地 HEAD 可达历史完整且每条都有中文概述', () => {
  const count = Number(execFileSync('git', ['rev-list', '--count', 'HEAD'], { cwd: dir, encoding: 'utf8' }));
  assert.equal(data.commits.length, count);
  assert.equal(new Set(data.commits.map(c => c.hash)).size, count);
  assert.ok(data.commits.every(c => /[\u4e00-\u9fff]/.test(c.zh) && c.subject));
});
test('所有教学引用均有离线快照且定位文本存在', () => {
  assert.deepEqual(data.chapters.find(c => c.id === 'development'), developmentGuide, '开发说明必须随单文件重新生成');
  for (const c of data.chapters) for (const s of c.sections) for (const [path, needle] of s.refs || []) {
    assert.ok(data.sources[path], `缺少 ${path}`);
    assert.ok(data.sources[path].includes(needle), `定位失效 ${path}: ${needle}`);
  }
  for (const [, , , path, needle] of data.trace) assert.ok(data.sources[path]?.includes(needle), path);
});
test('单文件内嵌所有架构图，无外部加载或原目录路径依赖', () => {
  assert.equal(data.diagrams.length, 5);
  for (const d of data.diagrams) {
    assert.ok(d.html.includes('<svg'));
    assert.doesNotMatch(d.html, /<(?:script|link|img)\b[^>]*(?:src|href)=["']https?:/i);
    assert.doesNotMatch(d.html, /(?:\.\.\/)+图架构|[A-Z]:[\\/]code[\\/]/i);
    assert.equal(d.hash, createHash('sha256').update(d.html).digest('hex'));
    assert.ok(existsSync(join(dir, 'diagrams', d.file)));
  }
  assert.doesNotMatch(html, /<script\b[^>]*src=/i);
  assert.doesNotMatch(html, /<link\b[^>]*href=["']https?:/i);
});
test('源码快照与 manifest 指纹一致', () => {
  for (const [path, source] of Object.entries(data.sources)) {
    assert.equal(data.sourceHashes[path], createHash('sha256').update(source).digest('hex'));
  }
  assert.ok(data.packages.length >= 12);
});
test('主页面和五幅图的内联脚本均可解析', () => {
  for (const page of [{ file: 'index.html', html }, ...data.diagrams]) {
    for (const match of page.html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/type=["']application\/json/.test(match[1])) continue;
      new Script(match[2], { filename: page.file });
    }
  }
});
test('全部原始资料在本目录有逐字节副本', () => {
  const root = join(dir, '../..');
  const originals = [
    ['架构图', 'pi-system-architecture'], ['工作流图', 'pi-task-workflow'],
    ['时序图', 'pi-task-sequence'], ['数据流图', 'pi-task-dataflow'], ['生命周期图', 'pi-task-lifecycle']
  ];
  for (const [folder, stem] of originals) for (const suffix of ['.html', '.visual-check.html']) {
    const archived = readFileSync(join(dir, 'diagrams/original', folder, stem + suffix));
    const original = join(root, '图架构', folder, stem + suffix);
    if (existsSync(original)) assert.deepEqual(archived, readFileSync(original));
    assert.ok(archived.length > 0);
  }
});
test('功能清单覆盖所有范围内的已跟踪文件，不静默遗漏', () => {
  const paths = execFileSync('git', ['ls-files', '-z'], { cwd: join(dir, '../..'), encoding: 'utf8' }).split('\0').filter(Boolean);
  const modules = discoverModules(paths, p => readFileSync(join(dir, '../..', p), 'utf8'));
  const expected = paths.filter(p => classifyPath(p, modules));
  assert.deepEqual(Object.keys(data.catalog.files).sort(), expected.sort());
  assert.equal(data.catalog.stats.unassigned, 0);
  assert.equal(new Set(data.catalog.features.map(f => f.id)).size, data.catalog.features.length);
  for (const [path, record] of Object.entries(data.catalog.files)) {
    assert.ok(record.features.length, path);
    if (record.text) assert.ok(Object.hasOwn(data.sources, path), path);
    for (const symbol of record.symbols) {
      assert.ok(symbol.line >= 1 && symbol.endLine <= record.lines, `${path}:${symbol.name}`);
    }
  }
});
test('功能详情有来源、用途、入口、边界和有效双向归属', () => {
  for (const f of data.catalog.features) {
    for (const field of ['title','purpose','entry','behavior','status','evidence']) assert.ok(f[field], `${f.id} ${field}`);
    assert.ok(f.files.length, f.id);
    for (const path of f.files) assert.ok(data.catalog.files[path]?.features.includes(f.id), `${f.id}: ${path}`);
    for (const path of [...f.docs,...f.tests]) assert.ok(Object.hasOwn(data.sources,path), `${f.id}: ${path}`);
    for (const hash of f.commits) assert.ok(data.commits.some(c => c.hash === hash));
  }
  for (const provider of ['openai','anthropic','google']) assert.ok(data.catalog.features.some(f => f.id === `ai-provider-${provider}`), provider);
});

test('生成版本与当前源码一致，新包和所有包 src 独立核验无遗漏', () => {
  const root = join(dir, '../..');
  assert.equal(data.meta.commit, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim());
  const pkg = JSON.parse(readFileSync(join(root, 'packages/coding-agent/package.json'), 'utf8'));
  assert.equal(data.meta.version, pkg.version);
  const paths = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const packages = paths.filter(p => /^packages\/[^/]+\/package\.json$/.test(p));
  assert.equal(data.packages.length, packages.length);
  for (const path of paths.filter(p => /^packages\/[^/]+\/src\//.test(p))) assert.ok(data.catalog.files[path], path);
  for (const id of ['env-remote','env-ssh','codemode-portable','coding-program-status','coding-tool-selection','coding-config-schemas','durable-images','durable-nested-output','durable-failure-retention','mcp-client','mcp-oauth-flow','codemode-host','codemode-store','coding-mcp-runtime','coding-codemode','coding-tool-search','coding-loadout','coding-fullscreen','durable-generation','durable-inbox','durable-subagents','durable-task-graph','engineering-model-hydration','engineering-install-lock']) {
    const f = data.catalog.features.find(f => f.id === id);
    assert.ok(f, id);
    assert.equal(f.evidence, '中文能力解说', id);
  }
  assert.equal(data.catalog.features.filter(f => f.module === 'durable-examples' && f.evidence === '中文能力解说').length, 32);
  assert.ok(data.catalog.features.some(f => f.id === 'agent-examples-mcp-codemode'));
  assert.ok(!data.catalog.features.some(f => ['sqlite','agent-harness','experimental-mini','experimental-micro'].includes(f.id)));
  assert.ok(Object.keys(data.catalog.files).every(p => !p.startsWith('packages/agent/src/harness/') && !p.startsWith('packages/session-backends/sqlite-node/')));
});

test('版本差异基于固定旧快照，新增解说均可导航且状态完整', () => {
  const baseline = JSON.parse(readFileSync(join(dir, 'src/edition-baseline.json'), 'utf8'));
  const edition = data.catalog.edition;
  assert.equal(edition.from, baseline.commit);
  assert.equal(edition.to, data.meta.commit);
  assert.deepEqual(edition, JSON.parse(readFileSync(join(dir, 'data/edition.json'), 'utf8')));
  for (const id of edition.addedExplanations) {
    const f = data.catalog.features.find(f => f.id === id);
    assert.equal(f?.update, '本次补充', id);
    assert.equal(f.evidence, '中文能力解说', id);
  }
  assert.ok(edition.addedExplanations.length >= 60);
  assert.ok(edition.retiredFeatures.some(f => f.id === 'sqlite-storage'));
  assert.ok(edition.removedFiles.every(p => !data.catalog.files[p]));
  assert.ok(edition.changedFiles.every(p => data.sourceHashes[p] !== baseline.sourceHashes[p]));
  assert.ok(data.catalog.features.every(f => ['本次补充','来源更新','已有条目'].includes(f.update)));
});
