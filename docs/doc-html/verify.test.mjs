import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { Script } from 'node:vm';

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
