import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { parseCapabilities, attachCapabilities, capabilitySource } from './src/capabilities.mjs';

const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const fixture = '## 01 测试模块\n| 编号 | 功能 | 详细作用 | 入口／条件 | 状态 | 依据 |\n| UI-01 | 输入 | 保留 <tag> 和 a\\|b | `run()` | 内置 | [原文][doc] |\n[doc]: ../../README.md\n';
test('稳定编号解析保留说明、转义管道、行号和仓库来源', () => {
  const result = parseCapabilities(fixture);
  assert.equal(result.rows[0].id, 'UI-01');
  assert.equal(result.rows[0].purpose, '保留 <tag> 和 a|b');
  assert.equal(result.rows[0].line, 3);
  assert.deepEqual(result.rows[0].docs, ['README.md']);
  assert.equal(result.modules.length, 1);
  assert.throws(() => parseCapabilities(fixture.replace('[原文][doc]', '[原文][missing]')), /来源/);
  assert.throws(() => parseCapabilities(fixture + fixture), /重复/);
});
test('缺少映射或指向不存在专题时失败，不用自动猜测掩盖遗漏', () => {
  const catalog = { features: [], files: {} };
  assert.throws(() => attachCapabilities({ catalog, markdown: fixture, read, bindings: {} }), /未映射/);
  assert.throws(() => attachCapabilities({ catalog, markdown: fixture, read, bindings: { 'UI-01': ['gone'] } }), /专题不存在/);
});
test('最终 HTML 的全部稳定编号与 Markdown 一一对应，保留源码、测试与反向关联', () => {
  const html = read('docs/doc-html/index.html');
  const data = JSON.parse(html.match(/<script id="doc-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  const parsed = parseCapabilities(read(capabilitySource));
  const catalog = data.catalog;
  assert.equal(parsed.rows.length, 587);
  assert.equal(catalog.capabilityModules.length, 19);
  assert.deepEqual(catalog.capabilities.map(f => f.id), parsed.rows.map(r => r.id));
  const featureMap = new Map(catalog.features.map(f => [f.id, f]));
  for (const row of parsed.rows) {
    const f = catalog.capabilities.find(f => f.id === row.id);
    assert.equal(f.purpose, row.purpose);
    assert.equal(f.entry, row.entry);
    assert.equal(f.status, row.status);
    assert.equal(f.sourceLine, row.line);
    assert.ok(f.docs.every(p => Object.hasOwn(data.sources, p)), row.id);
    for (const id of f.relatedFeatures) assert.ok(featureMap.get(id)?.capabilityIds.includes(f.id), `${row.id}: ${id}`);
    for (const p of f.files) assert.ok(catalog.files[p]?.capabilities.includes(f.id), `${row.id}: ${p}`);
    for (const p of f.tests) assert.ok(data.sources[p], `${row.id}: ${p}`);
  }
  assert.equal(data.sources[capabilitySource], read(capabilitySource));
  assert.equal(featureMap.get('example-plugins-pi-example-plugin').status, '历史资料');
});

test('编号导航支持搜索、双向跳转、引用图与文档方案，切换不重建菜单或回顶', () => {
  const nodes = new Map();
  const document = { getElementById(id) {
    if (!nodes.has(id)) nodes.set(id, { innerHTML: '', value: '', textContent: '', scrollTop: 0, listeners: {}, querySelectorAll() { return []; }, addEventListener(type, fn) { this.listeners[type] = fn; } });
    return nodes.get(id);
  } };
  const parent = { id: 'coding-demo', module: 'coding', title: '源码专题', purpose: '父专题', entry: 'read', behavior: '返回结果', status: '库', evidence: '中文能力解说', docs: ['README.md'], files: ['demo.ts'], tests: [], commits: [] };
  const catalog = { features: [parent], modules: [{ id: 'coding', title: '编码', root: 'src/', fileCount: 1 }], files: { 'demo.ts': { features: [parent.id], symbols: [], imports: [], consumers: [], tests: [], lines: 1 } }, stats: { files: 1, features: 1, documented: 1, symbols: 0, unassigned: 0 } };
  const markdown = fixture.replace('[doc]:', '| UI-02 | 部署说明 | 文档方案 | 手动部署 | 可选 | [原文][doc] |\n[doc]:');
  const sources = attachCapabilities({ catalog, markdown, read: () => 'source', bindings: { 'UI-01': ['coding-demo'], 'UI-02': [] } });
  sources['demo.ts'] = 'source';
  const data = { catalog, sources, commits: [], meta: { commit: '123456789', version: '1' } };
  const factory = runInNewContext(`${read('docs/doc-html/src/feature-flow.js')}\n${read('docs/doc-html/src/features-app.js')}; createFeatureBrowser`, { document, setTimeout, clearTimeout });
  const browser = factory(data, s => String(s).replaceAll('<', '&lt;').replaceAll('>', '&gt;'));
  assert.match(browser.render('UI-01'), /Markdown 对照完整/);
  browser.activate();
  assert.match(nodes.get('featurePanel').innerHTML, /稳定编号与来源映射/);
  assert.match(nodes.get('featurePanel').innerHTML, /&lt;tag&gt;/);
  assert.match(nodes.get('featurePanel').innerHTML, /data-line="3"/);
  assert.match(nodes.get('featureFlow').innerHTML, /引用关联流程图/);
  assert.ok(browser.search('ui-01').some(f => f.id === 'UI-01'));
  const menu = nodes.get('featureMenu');
  const original = menu.innerHTML;
  menu.scrollTop = 480;
  browser.navigate('UI-02');
  assert.match(nodes.get('featurePanel').innerHTML, /文档方案与使用依据/);
  assert.doesNotMatch(nodes.get('featurePanel').innerHTML, /id="featureFile"/);
  browser.navigate('coding-demo');
  assert.match(nodes.get('featurePanel').innerHTML, /href="#functions\/UI-01"/);
  assert.equal(menu.innerHTML, original);
  assert.equal(menu.scrollTop, 480);
  nodes.get('featureModule').value = 'capability-01';
  nodes.get('featureModule').listeners.change();
  assert.match(menu.innerHTML, /data-feature="UI-02"/);
  assert.doesNotMatch(menu.innerHTML, /data-feature="coding-demo"/);
});
