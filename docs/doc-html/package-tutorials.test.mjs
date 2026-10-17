import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { buildPackageTutorials } from './src/package-tutorials.mjs';

const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
test('新包缺少教学说明会报错；历史目录不从 dist 或缓存冒充当前包', () => {
  assert.throws(() => buildPackageTutorials({ paths: ['packages/new/package.json'], directories: ['new'], read: () => '{"name":"new"}', catalog: { files: {}, features: [] } }), /教程/);
  const { tutorials } = buildPackageTutorials({ paths: [], directories: ['session-backends'], read, catalog: { files: {}, features: [] } });
  assert.equal(tutorials[0].status, '无当前源码');
  assert.deepEqual(tutorials[0].symbols, []);
  assert.deepEqual(tutorials[0].examples, []);
});

test('所有本地子目录有教程入口，参数索引无截断，来源和学习路线有效', () => {
  const html = read('docs/doc-html/index.html');
  const data = JSON.parse(html.match(/<script id="doc-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(data.tutorials.length, 15);
  assert.equal(data.tutorials.filter(p => p.manifest).length, 11);
  for (const p of data.tutorials) {
    assert.ok(p.lesson.intro && p.lesson.focus.length && p.lesson.mastery.length, p.id);
    for (const path of [...p.docs, ...p.examples, ...p.tests, ...p.schemas]) assert.ok(Object.hasOwn(data.sources, path), path);
    for (const step of p.lesson.flow) assert.ok(data.sources[step.path]?.includes(step.needle), step.path);
    const expected = Object.entries(data.catalog.files).filter(([path]) => path.startsWith(`packages/${p.id}/src/`)).flatMap(([path, f]) => f.symbols.map((s, index) => [path, index]));
    assert.deepEqual(p.symbols, expected, p.id);
    for (const [path, line] of p.environment) assert.ok(data.sources[path].split('\n')[line - 1].includes('env'), path);
  }
  assert.equal(data.tutorials.find(p => p.id === 'evals').status, '私有工作区包');
  assert.equal(data.tutorials.find(p => p.id === 'client').status, '历史资料');
  assert.ok(data.tutorials.find(p => p.id === 'coding-agent').schemas.some(p => p.endsWith('settings.schema.json')));
  assert.match(html, /createPackageTutorialBrowser/);
});

test('教程交互保留菜单滚动，参数可搜索翻页，来源内容安全转义', () => {
  const data = JSON.parse(read('docs/doc-html/index.html').match(/<script id="doc-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  const nodes = new Map();
  const document = { getElementById(id) { if (!nodes.has(id)) nodes.set(id, { innerHTML: '', textContent: '', value: '', scrollTop: 0, listeners: {}, querySelectorAll() { return []; }, addEventListener(type, fn) { this.listeners[type] = fn; } }); return nodes.get(id); } };
  const factory = runInNewContext(read('docs/doc-html/src/package-tutorials-app.js') + '; createPackageTutorialBrowser', { document });
  const esc = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const browser = factory(data, esc);
  assert.match(browser.render('agent'), /package 教程/);
  browser.activate();
  const menu = nodes.get('tutorialMenu'); menu.scrollTop = 310;
  const original = menu.innerHTML;
  browser.navigate('ai', 'config');
  assert.equal(menu.innerHTML, original);
  assert.equal(menu.scrollTop, 310);
  nodes.get('tutorialSymbolScope').value = 'all';
  nodes.get('tutorialSymbolScope').listeners.change();
  const firstPage = nodes.get('tutorialSymbols').innerHTML;
  nodes.get('tutorialNext').listeners.click();
  assert.notEqual(nodes.get('tutorialSymbols').innerHTML, firstPage);
  assert.match(nodes.get('tutorialPage').textContent, /^2 \/ /);
  nodes.get('tutorialSymbolQuery').value = 'temperature';
  nodes.get('tutorialSymbolQuery').listeners.input();
  assert.match(nodes.get('tutorialSymbols').innerHTML, /temperature/);
  browser.navigate('session-backends', 'config');
  assert.match(nodes.get('tutorialPanel').innerHTML, /无当前源码/);
  assert.ok(browser.search('工具').length);
  data.sources['packages/agent/README.md'] = '<script>bad()</script>';
  browser.navigate('agent', 'docs');
  assert.match(nodes.get('tutorialDocBody').innerHTML, /&lt;script&gt;/);
  assert.doesNotMatch(nodes.get('tutorialDocBody').innerHTML, /<script>/);
});

test('整页包教程深链接和全局搜索接通，子菜单切换不重建页面或回顶', () => {
  const data = JSON.parse(read('docs/doc-html/index.html').match(/<script id="doc-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  const ids = ['doc-data','main','nav','progressText','progress','sourceDialog','diagramDialog','sourceFind','globalSearch','menu','breadcrumb','version','sidebarMeta','searchResults','toast','tutorialMenu','tutorialPanel','tutorialSymbolQuery','tutorialSymbolScope','tutorialSymbols','tutorialPage','tutorialPrev','tutorialNext'];
  const make = () => ({ value: '', innerHTML: '', textContent: '', scrollTop: 0, listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; }, querySelectorAll() { return []; }, classList: { toggle() {}, remove() {} }, setAttribute() {} });
  const nodes = new Map(ids.map(id => [id, make()]));
  nodes.get('doc-data').textContent = JSON.stringify(data);
  const document = { title: '', body: make(), getElementById(id) { return nodes.get(id) || null; }, querySelector() { return make(); }, querySelectorAll() { return []; }, addEventListener() {} };
  const events = {}, location = { hash: '#packages/agent/config' };
  let scrolls = 0;
  runInNewContext(['development-app.js', 'package-tutorials-app.js', 'app.js'].map(p => read(`docs/doc-html/src/${p}`)).join('\n'), {
    createMasteryBrowser() { return { search() { return []; } }; },
    createVersionBrowser() { return { search() { return []; } }; },
    document, location, window: { addEventListener(type, fn) { events[type] = fn; }, scrollTo() { scrolls++; } },
    localStorage: { getItem() { return null; } }, clearInterval() {},
    createFeatureBrowser() { return { search() { return []; } }; }, createDirectoryBrowser() { return { search() { return []; } }; }
  });
  assert.match(nodes.get('nav').innerHTML, /href="#packages"[^>]*class="nav-link active"/);
  assert.match(nodes.get('tutorialPanel').innerHTML, /参数配置/);
  const original = nodes.get('main').innerHTML;
  nodes.get('tutorialMenu').scrollTop = 450;
  location.hash = '#packages/durable/flow'; events.hashchange();
  assert.match(nodes.get('tutorialPanel').innerHTML, /提交/);
  assert.equal(nodes.get('main').innerHTML, original);
  assert.equal(nodes.get('tutorialMenu').scrollTop, 450);
  assert.equal(scrolls, 1);
  nodes.get('globalSearch').value = '并行工具'; nodes.get('globalSearch').listeners.input();
  assert.match(nodes.get('searchResults').innerHTML, /data-go="packages\/agent"/);
});
