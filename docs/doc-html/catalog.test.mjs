import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parseSource, classifyPath, resolveImport, buildCatalog, discoverModules } from './src/catalog.mjs';
import { moduleOrder, featureOrder, compareFeatures } from './src/feature-order.mjs';
import { featureModules } from './src/features.mjs';
import { compareEdition } from './src/edition.mjs';

test('函数变量保留真实输入与显式输出', () => {
  const record = parseSource('sample.ts', 'export const twice = (value: number): number => value * 2;');
  assert.deepEqual(record.symbols[0].inputs, ['value: number']);
  assert.equal(record.symbols[0].output, 'number');
  assert.match(record.symbols[0].signature, /value: number/);
});

test('TS 7 索引保留接口成员、访问权限、Unicode 行号和 JS/TSX', () => {
  const record = parseSource('fixture.ts', '// 中文与 😀\r\nexport interface Store { value: string; save(input: string): void; }\r\nexport class Box { private value = 1; constructor() {} get size(): number { return this.value; } }');
  assert.match(record.comment, /中文与 😀/);
  assert.equal(record.symbols.find(s => s.name === 'Store.save').line, 2);
  assert.equal(record.symbols.find(s => s.name === 'Store.value').kind, '属性');
  assert.deepEqual(record.symbols.find(s => s.name === 'Store.save').inputs, ['input: string']);
  assert.equal(record.symbols.find(s => s.name === 'Box.value').visibility, 'private');
  assert.equal(record.symbols.find(s => s.name === 'Box.constructor').kind, '构造器');
  assert.equal(record.symbols.find(s => s.name === 'Box.size').output, 'number');
  assert.equal(parseSource('fixture.js', 'export const run = (x) => x;').symbols[0].exported, true);
  assert.equal(parseSource('fixture.tsx', 'export const View = () => <span>中文</span>;').symbols[0].kind, '函数变量');
  assert.deepEqual(parseSource('README.md', '# 文档').symbols, []);
});

test('功能浏览器支持概览、过滤、详情和符号定位', () => {
  const nodes = new Map();
  const document = { getElementById(id) {
    if (!nodes.has(id)) nodes.set(id, { value: '', innerHTML: '', textContent: '', scrollTop: 0, listeners: {}, querySelectorAll() { return []; }, addEventListener(type, fn) { this.listeners[type] = fn; } });
    return nodes.get(id);
  } };
  const file = 'demo.ts';
  const feature = { id: 'demo', module: 'sample', title: '读取文件', purpose: '读取内容', entry: 'read', behavior: '返回文本', status: '库能力', evidence: '中文能力解说', update: '本次补充', files: [file], docs: [], tests: [], commits: [] };
  const data = { meta: { commit: 'abc' }, sources: { [file]: 'function read() {}' }, commits: [], catalog: { modules: [{ id: 'sample', title: '示例模块', root: '', description: '模块说明', fileCount: 1 }], features: [feature], stats: { documented: 1, features: 1, files: 1, symbols: 1, unassigned: 0 }, scope: '测试范围', files: { [file]: { lines: 1, imports: [], consumers: [], features: ['demo'], symbols: [{ name: 'read', kind: '函数', line: 1, endLine: 1, signature: 'read()', comment: '读取', inputs: [], output: '' }] } } } };
  const factory = runInNewContext(`${readFileSync(new URL('./src/feature-flow.js', import.meta.url), 'utf8')}\n${readFileSync(new URL('./src/features-app.js', import.meta.url), 'utf8')}; createFeatureBrowser`, { document, setTimeout, clearTimeout });
  const browser = factory(data, value => String(value).replaceAll('<', '&lt;'));
  assert.match(browser.render(''), /功能清单详情/);
  browser.activate();
  assert.match(nodes.get('featureMenu').innerHTML, /#functions\/demo/);
  assert.match(nodes.get('featurePanel').innerHTML, /项目能力总览/);
  nodes.get('featureStatus').value = '实验';
  nodes.get('featureStatus').listeners.change();
  assert.match(nodes.get('featurePanel').innerHTML, /没有匹配项/);
  nodes.get('featureReset').listeners.click();
  nodes.get('featureUpdate').value = '来源更新';
  nodes.get('featureUpdate').listeners.change();
  assert.match(nodes.get('featurePanel').innerHTML, /没有匹配项/);
  nodes.get('featureUpdate').value = '本次补充';
  nodes.get('featureUpdate').listeners.change();
  assert.match(nodes.get('featurePanel').innerHTML, /读取文件/);
  nodes.get('featureReset').listeners.click();
  data.meta.version = '1.0.2';
  data.catalog.edition = { from: 'previous123', to: 'current123', addedExplanations: ['demo'], addedFiles: [file], changedFiles: [], removedFiles: ['old.ts'], retiredFeatures: [{ id: 'old', title: '旧入口', files: ['old.ts'] }] };
  const editionHtml = browser.render('');
  assert.match(editionHtml, /版本更新 · 1.0.2 · 补充 1 项中文解说/);
  assert.match(editionHtml, /旧入口/);
  assert.match(editionHtml, /href="#functions\/demo"/);
  const menu = nodes.get('featureMenu');
  const originalMenuHtml = menu.innerHTML;
  const details = [{ dataset: { module: 'sample' }, open: true }, { dataset: { module: 'another' }, open: true }];
  menu.querySelectorAll = selector => selector.startsWith('details') ? details : [];
  menu.scrollTop = 480;
  browser.navigate('demo');
  assert.equal(menu.scrollTop, 480, '切换功能保留树的滚动位置');
  assert.equal(menu.innerHTML, originalMenuHtml, '切换功能不重建树 DOM');
  assert.equal(details[1].open, true, '保留其他模块的展开状态');
  assert.match(nodes.get('featurePanel').innerHTML, /作用与使用场景/);
  assert.match(nodes.get('featureFlow').innerHTML, /引用关联流程图/);
  assert.match(nodes.get('featureSymbols').innerHTML, /data-line="1"/);
  nodes.get('featureSymbolSearch').value = 'missing';
  nodes.get('featureSymbolSearch').listeners.input();
  assert.match(nodes.get('featureSymbols').innerHTML, /没有匹配声明/);
  assert.equal(browser.search('读取').length, 1);
  browser.rememberMenu();
  menu.scrollTop = 0;
  browser.render('demo');
  browser.activate();
  assert.equal(menu.scrollTop, 480, '返回功能页恢复树滚动位置');
});

test('业务阅读顺序保留全部模块与功能，支撑项置后', () => {
  assert.equal(new Set(moduleOrder).size, featureModules.length);
  assert.deepEqual([...moduleOrder].sort(), featureModules.map(m => m.id).sort());
  for (const keys of Object.values(featureOrder)) assert.equal(new Set(keys).size, keys.length);
  const features = ['write', 'prompt', 'support', 'settings', 'startup', 'resources', 'sdk', 'read'].map(key => ({ id: `coding-${key}`, module: 'coding' }));
  assert.deepEqual(features.sort(compareFeatures).map(f => f.id), ['coding-startup', 'coding-settings', 'coding-resources', 'coding-sdk', 'coding-prompt', 'coding-read', 'coding-write', 'coding-support']);
});

test('引用图使用真实方向、类型标识、源码行号并覆盖全部分页', () => {
  const create = runInNewContext(`${readFileSync(new URL('./src/feature-flow.js', import.meta.url), 'utf8')}; createReferenceFlow`);
  const imports = Array.from({ length: 7 }, (_, i) => ({ spec: `./dep${i}.js`, target: `dep${i}.ts`, line: i + 1, kind: '导入', typeOnly: i === 0 }));
  imports.push({ spec: '<external>', target: null, line: 9, kind: '导入', typeOnly: false });
  const sources = Object.fromEntries(['current.ts', 'caller.ts', ...imports.filter(r => r.target).map(r => r.target)].map(p => [p, 'text']));
  const graph = create('current.ts', { imports, consumers: [{ path: 'caller.ts', line: 23, kind: '导入', typeOnly: false }], tests: [] }, sources, value => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;'));
  const first = graph.render();
  assert.match(first, /caller.ts → current.ts/);
  assert.match(first, /current.ts → dep0.ts/);
  assert.match(first, /flow-edge flow-type/);
  assert.match(first, /data-source="caller.ts" data-line="23"/);
  assert.doesNotMatch(first, /dep3.ts/);
  graph.step(1);
  assert.match(graph.render(), /dep3.ts/);
  graph.step(1);
  assert.match(graph.render(), /dep6.ts/);
  assert.match(graph.render(), /&lt;external&gt;/);
  assert.doesNotMatch(graph.render(), /data-source="&lt;external&gt;"/);
  graph.step(99);
  assert.match(graph.render(), /3 \/ 3/);
  graph.step(-99);
  assert.match(graph.render(), /1 \/ 3/);
});

test('语法索引保留注释、行号、类型及异步方法，不把字符串当成声明', () => {
  const text = '/** 文件说明 */\nimport type { X } from "./types.js";\n/** 计算说明 @param x 输入 */\nexport async function compute(x: number): Promise<number> { return x; }\nexport class Store {\n/** 保存记录 */\nasync save(value: string): Promise<void> {}\n}\nconst fake = "export function fake() {}";';
  const record = parseSource('packages/demo/src/api.ts', text);
  const fn = record.symbols.find(s => s.name === 'compute');
  assert.equal(fn.line, 4);
  assert.equal(fn.exported, true);
  assert.match(fn.comment, /计算说明/);
  assert.match(fn.signature, /Promise<number>/);
  assert.ok(record.symbols.some(s => s.name === 'Store.save' && /保存记录/.test(s.comment)));
  assert.ok(!record.symbols.some(s => s.name === 'fake' && s.kind === '函数'));
  assert.equal(record.imports[0].typeOnly, true);
});
test('显式区分实验应用、示例、原生和包源码', () => {
  assert.equal(classifyPath('packages/coding-agent/src/experimental/source-resolver.ts'), 'coding');
  assert.equal(classifyPath('packages/coding-agent/examples/extensions/hello.ts'), 'examples');
  assert.equal(classifyPath('packages/coding-agent/src/core/sdk.ts'), 'coding');
  assert.equal(classifyPath('packages/tui/native/win32/src/win32-platform.c'), 'native');
  assert.equal(classifyPath('packages/ai/scripts/generate-models.ts'), 'engineering');
  assert.equal(classifyPath('packages/ai/test/foo.test.ts'), null);
  assert.equal(classifyPath('packages/mcp/src/client.ts'), 'mcp');
  assert.equal(classifyPath('packages/codemode/src/host.ts'), 'codemode');
  assert.equal(classifyPath('packages/agent/examples/mcp-codemode/main.ts'), 'agent-examples');
  assert.equal(classifyPath('packages/durable/test/examples/31-reload-and-restart.ts'), 'durable-examples');
  assert.equal(classifyPath('packages/durable/test/agent.test.ts'), null);
});
test('引用解析仅接受真实文件，支持源代码中的 .js 后缀和包 exports', () => {
  const files = new Set(['packages/demo/src/a.ts', 'packages/demo/src/types.ts', 'packages/lib/src/api.ts']);
  const manifests = [{ dir: 'packages/lib', name: '@scope/lib', exports: { './api': { import: './dist/api.js' } } }];
  assert.equal(resolveImport('packages/demo/src/a.ts', './types.js', files, manifests), 'packages/demo/src/types.ts');
  assert.equal(resolveImport('packages/demo/src/a.ts', '@scope/lib/api', files, manifests), 'packages/lib/src/api.ts');
  assert.equal(resolveImport('packages/demo/src/a.ts', './missing', files, manifests), null);
  assert.equal(resolveImport('packages/demo/src/a.ts', '@scope/lib/private', files, manifests), null);
});

test('引用索引识别字面量动态导入与混合类型导入，不猜计算路径', () => {
  const record = parseSource('demo.ts', 'import { type X } from "./types.js";\nimport { type T, value } from "./mixed.js";\nexport { type Y } from "./other.js";\nasync function load() { await import("./lazy.js"); await import(prefix + name); }');
  assert.deepEqual(record.imports.map(r => [r.spec, r.kind, r.typeOnly]), [
    ['./types.js', '导入', true], ['./mixed.js', '导入', false], ['./other.js', '再导出', true], ['./lazy.js', '动态导入', false]
  ]);
});

test('未知工作区包自动发现并进入有归属的待解读索引', () => {
  const sources = {
    'packages/future/package.json': '{"name":"@scope/future","version":"2.0.0"}',
    'packages/future/README.md': '# Future',
    'packages/future/src/index.ts': 'export { work } from "./nested/work.js";',
    'packages/future/src/nested/work.ts': 'export function work(): number { return 1; }'
  };
  const paths = Object.keys(sources);
  const read = p => sources[p];
  const modules = discoverModules(paths, read);
  assert.equal(classifyPath(paths[2], modules), 'package-future');
  const { catalog, snapshots } = buildCatalog({ paths, read, commits: [] });
  assert.equal(catalog.modules.length, 1);
  assert.equal(catalog.modules[0].status, '待解读');
  assert.equal(catalog.stats.files, 2);
  assert.equal(catalog.stats.unassigned, 0);
  assert.equal(catalog.stats.documented, 0);
  assert.ok(catalog.features.every(f => f.evidence === '源码覆盖索引' && f.files.length === 1));
  assert.equal(catalog.files[paths[2]].imports[0].target, paths[3]);
  assert.ok(snapshots[paths[1]]);
});

test('版本对照区分新增讲解、既有来源变化与移出文件', () => {
  const catalog = { files: { 'same.ts': {}, 'changed.ts': {}, 'new.ts': {} }, features: [
    { id: 'same', files: ['same.ts'], evidence: '中文能力解说' },
    { id: 'changed', files: ['changed.ts'], evidence: '中文能力解说' },
    { id: 'new', files: ['new.ts'], evidence: '中文能力解说' },
    { id: 'new-support-root', files: ['new.ts'], evidence: '源码覆盖索引' }
  ] };
  const baseline = { commit: 'old', features: [
    { id: 'same', files: ['same.ts'] }, { id: 'changed', files: ['changed.ts'] },
    { id: 'gone', title: '旧功能', files: ['gone.ts'] }, { id: 'old-support', files: ['gone.ts'] }
  ], sourceHashes: { 'same.ts': 's', 'changed.ts': 'before', 'gone.ts': 'g' } };
  const edition = compareEdition(catalog, { 'same.ts': 's', 'changed.ts': 'after', 'new.ts': 'n' }, baseline, 'current');
  assert.deepEqual(catalog.features.map(f => f.update), ['已有条目', '来源更新', '本次补充', '本次补充']);
  assert.deepEqual(edition.addedExplanations, ['new']);
  assert.deepEqual(edition.changedFiles, ['changed.ts']);
  assert.deepEqual(edition.addedFiles, ['new.ts']);
  assert.deepEqual(edition.removedFiles, ['gone.ts']);
  assert.deepEqual(edition.retiredFeatures.map(f => f.id), ['gone']);
});
