import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { buildDirectory, initializeDirectoryNotes } from './src/directory.mjs';
import { developmentGuide } from './src/development.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(dir, '../..');
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function fixture() {
  const feature = { id: 'agent-loop', title: '消息执行', purpose: '执行多轮模型消息与工具结果。', entry: 'Agent.prompt', behavior: '工具结果回到下一轮，终止条件由循环判断。', evidence: '中文能力解说', files: ['packages/agent/src/loop.ts'], tests: ['packages/agent/test/loop.test.ts'], docs: ['packages/agent/README.md'] };
  const files = { 'packages/agent/src/loop.ts': { features: [feature.id], symbols: [{ name: 'loop', kind: '函数', line: 1, comment: 'Loop <tag>' }], comment: 'Entry <tag>', imports: [], consumers: [], tests: [] }, 'packages/agent/src/support.ts': { features: ['agent-support'], symbols: [], imports: [], consumers: [], tests: [], comment: '' } };
  const catalog = { modules: [{ root: 'packages/agent/src/', description: '消息与工具循环实现。', doc: 'packages/agent/README.md', status: '运行时机制' }], features: [feature, { ...feature, id: 'agent-support', title: '支撑索引', evidence: '源码覆盖索引', files: ['packages/agent/src/support.ts'], tests: [], docs: [] }], files };
  const paths = ['packages/agent/src/loop.ts', 'packages/agent/src/support.ts', 'packages/agent/src/new.ts', 'packages/agent/test/loop.test.ts', 'packages/agent/README.md', '新目录/空说明 #%.ts', 'root10.txt', 'root2.txt'];
  const sources = { 'packages/agent/src/loop.ts': 'export function loop() {}' };
  const sourceHashes = { 'packages/agent/src/loop.ts': 'first-hash' };
  return { paths, trackedPaths: paths.filter(p => !p.includes('new.ts')), catalog, sources, sourceHashes };
}
function initializedFixture() {
  const input = fixture();
  const tree = buildDirectory(input);
  const notes = initializeDirectoryNotes(tree, { nodes: {} }, input.catalog, [], 'initial-commit', true);
  return { ...input, notes, directory: buildDirectory({ ...input, notes }), meta: { commit: 'current-commit' } };
}
function makeNode() {
  return { value: '', innerHTML: '', textContent: '', scrollTop: 0, dataset: {}, listeners: new Map(), addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }, removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }, fire(type, event = {}) { for (const fn of this.listeners.get(type) || []) fn(event); }, querySelector() { return null; }, classList: { toggle() {}, remove() {}, add() {} }, setAttribute() {} };
}
function browserFixture() {
  const data = initializedFixture();
  const elements = new Map(['main','directoryTree','directoryDetail','directoryCount','directorySearch','directoryStatus','directoryExpand','directoryCollapse','directoryLocate'].map(id => [id, makeNode()]));
  const location = { hash: '#directory' };
  const document = { getElementById(id) { return elements.get(id) || null; } };
  const scope = { document, location };
  runInNewContext(readFileSync(join(dir, 'src/directory-app.js'), 'utf8'), scope);
  return { data, elements, location, browser: scope.createDirectoryBrowser(data, esc) };
}

test('目录树覆盖全部文件并还原唯一父子关系，目录优先与自然排序', () => {
  const input = fixture();
  const tree = buildDirectory({ ...input, paths: [...input.paths, input.paths[0]] });
  assert.equal(tree.stats.files, input.paths.length);
  assert.equal(tree.nodes[''].fileCount, input.paths.length);
  assert.equal(tree.nodes['packages/agent'].fileCount, 5);
  assert.deepEqual(tree.nodes[''].children, ['packages', '新目录', 'root2.txt', 'root10.txt']);
  for (const node of Object.values(tree.nodes)) {
    if (node.parent !== null) assert.equal(tree.nodes[node.parent].children.filter(p => p === node.path).length, 1);
    if (node.kind === 'file') assert.equal(node.children.length, 0);
  }
  assert.equal(tree.nodes['packages/agent/src/new.ts'].tracked, false);
  assert.equal(tree.nodes['packages/agent/src/loop.ts'].snapshot, true);
});

test('未初始化节点的描述为空，不继承父目录或覆盖索引的业务说明', () => {
  const data = initializedFixture();
  for (const path of ['packages/agent/src/new.ts','packages/agent/src/support.ts','新目录','新目录/空说明 #%.ts']) {
    assert.equal(data.directory.nodes[path].description, '');
    assert.equal(data.directory.nodes[path].status, 'pending');
  }
  assert.ok(data.directory.nodes['packages/agent/src'].description);
  assert.equal(data.notes.nodes['packages/agent/src/support.ts'].description, '');
});

test('普通刷新登记空节点，显式初始化只补有依据的空项，维护说明始终保留', () => {
  const input = fixture();
  const notes = { nodes: { 'packages/agent/src/loop.ts': { description: '维护者逐文件说明', initializedCommit: 'old' }, removed: { description: '旧节点说明' } } };
  const tree = buildDirectory({ ...input, notes });
  const ordinary = initializeDirectoryNotes(tree, notes, input.catalog, [], 'next');
  assert.equal(ordinary.nodes['packages/agent/src'].description, '');
  const updated = initializeDirectoryNotes(tree, ordinary, input.catalog, [], 'next', true);
  assert.equal(updated.nodes['packages/agent/src/loop.ts'].description, '维护者逐文件说明');
  assert.equal(updated.nodes['packages/agent/src/loop.ts'].initializedCommit, 'old');
  assert.equal(updated.nodes['packages/agent/src/new.ts'].description, '');
  assert.equal(updated.nodes.removed.description, '旧节点说明');
  assert.ok(!tree.nodes.removed);
  assert.ok(!Object.hasOwn(notes.nodes, 'packages/agent/src'));
});

test('初始化区分实现参与、静态测试关联与参考文档，保留入口和边界依据', () => {
  const data = initializedFixture();
  const impl = data.notes.nodes['packages/agent/src/loop.ts'];
  assert.match(impl.description, /本文件参与/);
  assert.equal(impl.details[0].entry, 'Agent.prompt');
  assert.match(impl.details[0].behavior, /工具结果回到下一轮/);
  assert.deepEqual(impl.evidence, ['packages/agent/README.md']);
  assert.match(data.notes.nodes['packages/agent/test/loop.test.ts'].description, /测试实际覆盖范围以断言/);
  assert.match(data.notes.nodes['packages/agent/README.md'].description, /参考文档/);
});

test('源码变化标记待复核但保留已有说明，更新指纹后可恢复已初始化状态', () => {
  const data = initializedFixture();
  const changed = buildDirectory({ ...data, sourceHashes: { 'packages/agent/src/loop.ts': 'changed-hash' } });
  assert.equal(changed.nodes['packages/agent/src/loop.ts'].status, 'review');
  assert.equal(changed.nodes['packages/agent/src/loop.ts'].description, data.directory.nodes['packages/agent/src/loop.ts'].description);
  data.notes.nodes['packages/agent/src/loop.ts'].sourceHash = 'changed-hash';
  assert.equal(buildDirectory({ ...data, sourceHashes: { 'packages/agent/src/loop.ts': 'changed-hash' } }).nodes['packages/agent/src/loop.ts'].status, 'ready');
});

test('拒绝路径穿越、非规范路径与文件目录冲突', () => {
  const input = fixture();
  for (const path of ['../secret','/absolute','a\\b','a//b','a/./b']) assert.throws(() => buildDirectory({ ...input, paths: [path] }), /非法目录路径/);
  assert.throws(() => buildDirectory({ ...input, paths: ['a','a/b'] }), /文件与目录冲突/);
  const special = buildDirectory({ ...input, paths: ['__proto__/constructor','toString'] });
  assert.equal(special.stats.files, 2);
  assert.equal(special.nodes['__proto__'].kind, 'folder');
  const registered = initializeDirectoryNotes(special, { nodes: {} }, input.catalog, [], 'initial', true);
  assert.equal(registered.nodes['__proto__'].description, '');
});

test('目录深链接、未知描述空区与原始注释转义正确', () => {
  const { browser, elements } = browserFixture();
  const html = browser.render(encodeURIComponent('packages/agent/src/loop.ts'));
  assert.match(html, /源码目录说明/);
  assert.match(html, /data-directory-toggle="packages\/agent\/src" aria-expanded="true"/);
  assert.match(elements.get('directoryDetail').innerHTML, /Entry &lt;tag&gt;/);
  browser.navigate(encodeURIComponent('新目录/空说明 #%.ts'));
  assert.match(elements.get('directoryDetail').innerHTML, /directory-description uninitialized"><\/div>/);
  assert.doesNotMatch(elements.get('directoryDetail').innerHTML, /<tag>/);
  browser.navigate('%malformed');
  assert.match(elements.get('directoryDetail').innerHTML, /仓库根目录/);
  browser.navigate('constructor');
  assert.match(elements.get('directoryDetail').innerHTML, /仓库根目录/);
});

test('搜索与状态筛选显示匹配节点及祖先，展开和收起状态可恢复', () => {
  const { browser, elements } = browserFixture();
  browser.render(); browser.activate();
  elements.get('directoryCollapse').fire('click');
  assert.doesNotMatch(elements.get('directoryTree').innerHTML, /data-directory-select="packages\/agent\/src\/loop.ts"/);
  elements.get('directorySearch').value = 'loop.ts'; elements.get('directorySearch').fire('input');
  assert.match(elements.get('directoryTree').innerHTML, /data-directory-select="packages\/agent\/src\/loop.ts"/);
  assert.match(elements.get('directoryTree').innerHTML, /data-directory-select="packages"/);
  assert.doesNotMatch(elements.get('directoryTree').innerHTML, /data-directory-select="packages\/agent\/src\/support.ts"/);
  elements.get('directorySearch').value = ''; elements.get('directorySearch').fire('input');
  elements.get('directoryStatus').value = 'pending'; elements.get('directoryStatus').fire('change');
  assert.match(elements.get('directoryTree').innerHTML, /data-directory-select="packages\/agent\/src\/support.ts"/);
  assert.doesNotMatch(elements.get('directoryTree').innerHTML, /data-directory-select="packages\/agent\/src\/loop.ts"/);
  elements.get('directoryStatus').value = ''; elements.get('directoryStatus').fire('change');
  elements.get('directoryExpand').fire('click');
  assert.match(elements.get('directoryTree').innerHTML, /data-directory-select="packages\/agent\/src\/loop.ts"/);
  assert.ok(browser.search('消息执行').some(n => n.path === 'packages/agent/src/loop.ts'));
});

test('点选仅替换详情并保留树滚动，离开再回来恢复且不叠加点击监听器', () => {
  const { browser, elements, location } = browserFixture();
  browser.render(); browser.activate();
  const tree = elements.get('directoryTree');
  tree.scrollTop = 333;
  const button = { dataset: { directorySelect: 'packages/agent/src/loop.ts' } };
  elements.get('main').fire('click', { target: { closest(selector) { return selector === '[data-directory-select]' ? button : null; } } });
  assert.equal(location.hash, '#directory/packages%2Fagent%2Fsrc%2Floop.ts');
  browser.navigate(location.hash.split('/')[1]);
  assert.equal(tree.scrollTop, 333);
  browser.rememberMenu(); tree.scrollTop = 0; browser.render(location.hash.split('/')[1]); browser.activate();
  assert.equal(tree.scrollTop, 333);
  assert.equal(elements.get('main').listeners.get('click').size, 1);
});

test('源码目录菜单接入整页路由和全文搜索，内部选取不触发页面回顶', () => {
  const data = { ...initializedFixture(), chapters: [developmentGuide], commits: [], packages: [], trace: [], meta: { commit: '0123456789', version: '1.0.2', builtAt: '2026-10-05' } };
  const ids = ['doc-data','main','nav','progressText','progress','sourceDialog','diagramDialog','sourceFind','globalSearch','menu','breadcrumb','version','sidebarMeta','searchResults','toast','directoryTree','directoryDetail','directoryCount','directorySearch','directoryStatus','directoryExpand','directoryCollapse','directoryLocate'];
  const nodes = new Map(ids.map(id => [id, makeNode()]));
  nodes.get('doc-data').textContent = JSON.stringify(data);
  const windowEvents = {}, location = { hash: '#directory' };
  let scrolled = 0;
  const document = { title: '', body: makeNode(), getElementById(id) { return nodes.get(id) || null; }, querySelector() { return makeNode(); }, querySelectorAll() { return []; }, addEventListener() {} };
  runInNewContext(['development-app.js','directory-app.js','app.js'].map(p => readFileSync(join(dir, 'src', p), 'utf8')).join('\n'), {
    document, location, window: { addEventListener(type, fn) { windowEvents[type] = fn; }, scrollTo() { scrolled++; } }, localStorage: { getItem() { return null; }, setItem() {} }, createFeatureBrowser() { return { search() { return []; }, rememberMenu() {} }; }, clearInterval() {}
  });
  assert.match(nodes.get('nav').innerHTML, /href="#directory"[^>]*class="nav-link active"/);
  const mainHtml = nodes.get('main').innerHTML;
  nodes.get('directoryTree').scrollTop = 456;
  location.hash = '#directory/packages%2Fagent%2Fsrc%2Floop.ts'; windowEvents.hashchange();
  assert.equal(nodes.get('main').innerHTML, mainHtml);
  assert.equal(nodes.get('directoryTree').scrollTop, 456);
  assert.equal(scrolled, 1);
  nodes.get('globalSearch').value = 'loop.ts'; nodes.get('globalSearch').fire('input');
  assert.match(nodes.get('searchResults').innerHTML, /data-go="directory\/packages%2Fagent%2Fsrc%2Floop.ts"/);
});

test('最终单文件与持久登记覆盖所有 Git 路径和未忽略新文件，未知说明保持空', () => {
  const html = readFileSync(join(dir, 'index.html'), 'utf8');
  const data = JSON.parse(html.match(/<script id="doc-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  const paths = [...new Set(execFileSync('git', ['ls-files','--cached','--others','--exclude-standard','-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean))];
  const tree = data.directory;
  assert.ok(tree, '源码目录需随单文件生成');
  assert.deepEqual(Object.values(tree.nodes).filter(n => n.kind === 'file').map(n => n.path).sort(), paths.sort());
  assert.deepEqual(tree, JSON.parse(readFileSync(join(dir, 'data/directory.json'), 'utf8')));
  assert.deepEqual(tree.stats, JSON.parse(readFileSync(join(dir, 'data/manifest.json'), 'utf8')).directory);
  const notes = JSON.parse(readFileSync(join(dir, 'src/directory-notes.json'), 'utf8'));
  assert.equal(Object.values(tree.nodes).length, tree.stats.files + tree.stats.folders);
  assert.equal(tree.stats.ready + tree.stats.review + tree.stats.pending, Object.values(tree.nodes).length);
  for (const node of Object.values(tree.nodes)) {
    assert.equal(node.description, notes.nodes[node.path].description);
    if (node.status === 'pending') assert.equal(node.description, '', node.path);
    for (const feature of node.features) assert.ok(data.catalog.features.some(f => f.id === feature));
  }
  assert.ok(tree.stats.ready > 0 && tree.stats.pending > 0);
});
