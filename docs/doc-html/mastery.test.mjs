import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { buildMastery } from './src/mastery.mjs';
import { masteryRoutes } from './src/mastery-curriculum.mjs';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const data = JSON.parse(html.match(/<script id="doc-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
test('路线编译拒绝断链、循环先修和不完整编号覆盖', () => {
  const options = { catalog: data.catalog, sources: data.sources, plan: {} };
  assert.throws(() => buildMastery({ ...options, routes: [{ ...masteryRoutes[0], prerequisite: ['missing'] }] }), /先修/);
  assert.throws(() => buildMastery({ ...options, routes: [{ ...masteryRoutes[0], prerequisite: [masteryRoutes[0].id] }] }), /循环/);
  assert.throws(() => buildMastery({ ...options, routes: [{ ...masteryRoutes[0], steps: [{ ...masteryRoutes[0].steps[0], feature: 'missing' }] }] }), /专题/);
  assert.throws(() => buildMastery({ ...options, routes: [masteryRoutes[0]] }), /未覆盖/);
});

const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function browserFixture(raw = null, courseData = data, unavailable = false) {
  const nodes = new Map();
  const make = () => ({ innerHTML: '', textContent: '', value: '', scrollTop: 0, listeners: {}, dataset: {}, checked: false, addEventListener(event, fn) { this.listeners[event] = fn; }, querySelectorAll() { return []; }, classList: { toggle() {} }, setAttribute() {}, removeAttribute() {} });
  const checkbox = make(); checkbox.dataset.masteryComplete = 'model-connect:1';
  const routeToggle = make(); routeToggle.dataset.masteryRoute = 'auth-lifecycle';
  const document = { getElementById(id) {
    if (!nodes.has(id)) nodes.set(id, make());
    if (id === 'masteryPanel') nodes.get(id).querySelectorAll = selector => selector === '[data-mastery-complete]' ? [checkbox] : [];
    if (id === 'masteryMenu') nodes.get(id).querySelectorAll = selector => selector === '[data-mastery-route]' ? [routeToggle] : [];
    return nodes.get(id);
  } };
  let storage = raw;
  const localStorage = { getItem() { if (unavailable) throw new Error('storage denied'); return storage; }, setItem(key, value) { if (unavailable) throw new Error('storage denied'); storage = value; } };
  const factory = runInNewContext(readFileSync(new URL('./src/mastery-app.js', import.meta.url), 'utf8') + '; createMasteryBrowser', { document, localStorage });
  return { nodes, checkbox, routeToggle, browser: factory(courseData, esc), storage: () => storage };
}
test('离开后保留非当前路线展开状态，拒绝存储时仍能学习', () => {
  const f = browserFixture(null, data, true);
  f.browser.render('model-connect'); f.browser.activate();
  f.routeToggle.open = true; f.routeToggle.listeners.toggle();
  f.nodes.get('masteryMenu').scrollTop = 420; f.browser.rememberMenu();
  assert.match(f.browser.render('conversation-round'), /data-mastery-route="auth-lifecycle" open/);
  f.nodes.get('masteryMenu').scrollTop = 0; f.browser.activate();
  assert.equal(f.nodes.get('masteryMenu').scrollTop, 420);
  f.checkbox.checked = true; f.checkbox.listeners.change();
  assert.match(f.nodes.get('masteryProgress').textContent, /^1 \/ /);
});
test('八份 PPTX 与 HTML 内嵌字节一致，过期课件明确标记', () => {
  const manifest = JSON.parse(readFileSync(new URL('./learning-slides/manifest.json', import.meta.url), 'utf8'));
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  assert.equal(manifest.courseHash, hash(JSON.stringify(data.mastery.routes)));
  assert.equal(manifest.baseline, data.meta.commit);
  assert.equal(data.mastery.decksStale, false);
  assert.equal(data.mastery.decks.length, data.mastery.stages.length);
  assert.equal(data.mastery.decks.reduce((n, d) => n + d.slides, 0), 132);
  for (const deck of data.mastery.decks) {
    const bytes = readFileSync(new URL(`./learning-slides/${deck.filename}`, import.meta.url));
    assert.equal(hash(bytes), deck.sha256);
    assert.deepEqual(Buffer.from(deck.base64, 'base64'), bytes);
  }
  const f = browserFixture(null, { ...data, mastery: { ...data.mastery, decks: [], decksStale: true } });
  const page = f.browser.render('model-connect', 'slides');
  assert.match(page, /课件待同步/);
  assert.doesNotMatch(page, /download=/);
});
test('步骤深链接、菜单滚动、搜索、进度恢复和两次确认重置', () => {
  const f = browserFixture('{broken');
  assert.match(f.browser.render('model-connect', 'step-1'), /选择连接方式/);
  f.browser.activate();
  f.nodes.get('masteryMenu').scrollTop = 290;
  const old = f.nodes.get('masteryMenu').innerHTML;
  f.browser.navigate('conversation-round', 'step-2');
  assert.match(f.nodes.get('masteryPanel').innerHTML, /构造模型上下文/);
  assert.equal(f.nodes.get('masteryMenu').scrollTop, 290);
  assert.equal(f.nodes.get('masteryMenu').innerHTML, old);
  assert.ok(f.browser.search('OTH-18').some(r => r.id === 'sdk-rpc'));
  f.browser.navigate('model-connect', 'step-1');
  f.checkbox.checked = true; f.checkbox.listeners.change();
  assert.deepEqual(JSON.parse(f.storage()).done, ['model-connect:1']);
  const restored = browserFixture(f.storage());
  assert.match(restored.browser.render('model-connect', 'step-1'), /data-mastery-complete="model-connect:1" checked/);
  f.nodes.get('masteryReset').listeners.click();
  assert.equal(JSON.parse(f.storage()).done.length, 1);
  f.nodes.get('masteryReset').listeners.click();
  assert.equal(JSON.parse(f.storage()).done.length, 0);
  f.nodes.get('masteryQuery').value = '不存在的流程XYZ'; f.nodes.get('masteryQuery').listeners.input();
  assert.doesNotMatch(f.nodes.get('masteryMenu').innerHTML, /data-mastery-route/);
  f.browser.navigate('invalid', 'step-999');
  assert.match(f.nodes.get('masteryPanel').innerHTML, /先跑通一条主线/);
});
test('六视角翻页、键盘与边界，源码引用始终可用', () => {
  const f = browserFixture(); f.browser.render('model-connect', 'slides'); f.browser.activate();
  assert.equal(f.nodes.get('masterySlidePrev').disabled, true);
  f.nodes.get('masterySlideNext').listeners.click();
  assert.match(f.nodes.get('masterySlide').innerHTML, /职责与边界/);
  f.nodes.get('masteryViewer').listeners.keydown({ key: 'End', target: { tagName: 'DIV' }, preventDefault() {} });
  assert.equal(f.nodes.get('masterySlideNext').disabled, true);
  f.nodes.get('masterySlideNext').listeners.click();
  assert.equal(f.nodes.get('masterySlideCount').textContent, '6 / 6');
  f.nodes.get('masteryViewer').listeners.keydown({ key: 'Home', target: { tagName: 'INPUT' }, preventDefault() { throw new Error('输入框不应被拦截'); } });
  assert.equal(f.nodes.get('masterySlideCount').textContent, '6 / 6');
  f.browser.navigate('conversation-round', 'step-3');
  assert.match(f.nodes.get('masteryPanel').innerHTML, /data-source="packages\/agent\/src\/agent-loop.ts"/);
});
test('八阶段逐步课程、真实证据、六视角和全部稳定编号均已离线收录', () => {
  const course = data.mastery;
  assert.equal(course.stages.length, 8);
  assert.ok(course.routes.length >= 40);
  assert.equal(course.coverage.length, data.catalog.capabilities.length);
  for (const stage of course.stages) assert.ok(course.routes.some(r => r.stage === stage.id), stage.id);
  for (const route of course.routes) {
    assert.ok(route.steps.length >= 3, route.id);
    assert.equal(route.slides.length, 6, route.id);
    assert.ok(route.failure && route.exercise && route.answer, route.id);
    for (const step of route.steps) {
      assert.ok(step.explain && step.input && step.output, step.id);
      assert.ok(step.refs.length, step.id);
      for (const ref of step.refs) {
        assert.ok(data.sources[ref.path], ref.path);
        assert.ok(ref.line > 0 && ref.line <= data.sources[ref.path].split('\n').length, ref.path);
      }
    }
    for (const path of [...route.tests, ...route.docs]) assert.ok(data.sources[path], path);
  }
  for (const item of course.coverage) {
    assert.ok(item.routes.length, item.id);
    for (const id of item.routes) assert.ok(course.routes.some(r => r.id === id), id);
  }
});

test('整页学习深链接、全局搜索和返回导航接通且步骤切换不回顶', () => {
  const ids = ['doc-data', 'main', 'nav', 'progressText', 'progress', 'sourceDialog', 'diagramDialog', 'sourceFind', 'globalSearch', 'menu', 'breadcrumb', 'version', 'sidebarMeta', 'searchResults', 'masteryMenu', 'masteryPanel', 'masteryProgress', 'masteryMeter', 'masteryQuery', 'masteryStage', 'masteryReset', 'librarySearch', 'libraryCount', 'libraryRows'];
  const make = () => ({ value: '', innerHTML: '', textContent: '', scrollTop: 0, listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; }, querySelectorAll() { return []; }, classList: { toggle() {}, remove() {} }, setAttribute() {} });
  const nodes = new Map(ids.map(id => [id, make()]));
  nodes.get('doc-data').textContent = JSON.stringify(data);
  const document = { title: '', body: make(), getElementById(id) { return nodes.get(id) || null; }, querySelector() { return make(); }, querySelectorAll() { return []; }, addEventListener() {} };
  const events = {}, location = { hash: '#mastery/model-connect/step-1' };
  let scrolls = 0;
  runInNewContext(['mastery-app.js', 'app.js'].map(p => readFileSync(new URL(`./src/${p}`, import.meta.url), 'utf8')).join('\n'), {
    document, location, window: { addEventListener(type, fn) { events[type] = fn; }, scrollTo() { scrolls++; } },
    localStorage: { getItem() { return null; }, setItem() {} }, clearInterval() {},
    createPackageTutorialBrowser() { return { search() { return []; } }; },
    createVersionBrowser() { return { search() { return []; } }; },
    createFeatureBrowser() { return { search() { return []; } }; }, createDirectoryBrowser() { return { search() { return []; } }; }
  });
  assert.match(nodes.get('nav').innerHTML, /href="#mastery"[^>]*class="nav-link active"/);
  assert.match(nodes.get('masteryPanel').innerHTML, /选择连接方式/);
  const original = nodes.get('main').innerHTML;
  nodes.get('masteryMenu').scrollTop = 450;
  location.hash = '#mastery/conversation-round/step-2'; events.hashchange();
  assert.match(nodes.get('masteryPanel').innerHTML, /构造模型上下文/);
  assert.equal(nodes.get('main').innerHTML, original);
  assert.equal(nodes.get('masteryMenu').scrollTop, 450);
  assert.equal(scrolls, 1);
  nodes.get('globalSearch').value = 'model-connect'; nodes.get('globalSearch').listeners.input();
  assert.match(nodes.get('searchResults').innerHTML, /data-go="mastery\/model-connect"/);
  assert.doesNotMatch(nodes.get('searchResults').innerHTML, /没有找到结果/);
  location.hash = '#sources'; events.hashchange();
  nodes.get('masteryMenu').scrollTop = 0;
  location.hash = '#mastery/model-connect/step-1'; events.hashchange();
  assert.equal(nodes.get('masteryMenu').scrollTop, 450);
});
