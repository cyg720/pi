import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { parseChangelog, compareVersions, buildVersions } from './src/versions.mjs';

test('version parser preserves complete entries, fenced headings, empty releases and source lines', () => {
  const text = '# Changelog\r\n\r\n## [Unreleased]\r\n\r\n## [1.2.0] - 2026-10-07\r\n\r\n### Breaking Changes\r\n\r\n- First item\r\n  continued\r\n\r\n  ```md\r\n## [9.9.9]\r\n- Not an entry\r\n  ```\r\n\r\n- Second item\r\n\r\n## [1.1.0]\r\n';
  const entries = parseChangelog(text);
  assert.deepEqual(entries.map(e => e.version), ['Unreleased', '1.2.0', '1.1.0']);
  assert.equal(entries[0].sections.length, 0);
  assert.equal(entries[1].line, 5);
  assert.equal(entries[1].sections[0].category, 'breaking');
  assert.equal(entries[1].sections[0].count, 2);
  assert.ok(entries[1].body.includes('## [9.9.9]'));
  assert.equal(text.split(/\r?\n/)[entries[1].line - 1], entries[1].heading);
  assert.deepEqual(['0.9.0','1.0.0-rc.10','0.10.0','1.0.0','1.0.0-rc.2','Unreleased'].sort(compareVersions), ['Unreleased','1.0.0','1.0.0-rc.10','1.0.0-rc.2','0.10.0','0.9.0']);
  assert.equal(compareVersions('1.0.0+one','1.0.0+two'),0);
  assert.equal(parseChangelog('## [1.0.0]\n###  重大变更  \n- 迁移')[0].sections[0].category,'breaking');
});

test('version aggregation uses graph ranges, distinguishes stale Chinese drafts, and validates commentary evidence', () => {
  const docs = {
    'packages/a/CHANGELOG.md': '# Changelog\n## [Unreleased]\n### Added\n- Future\n## [1.1.0] - 2026-10-07\n### Breaking Changes\n- API changed\n## [1.0.0]\n',
    'packages/a/CHANGELOG.zh.md': '# 日志\n## [未发布]\n### 新增\n- 旧草稿不可配对\n## [1.0.0]\n### 新增\n- 中文旧版本\n',
    'packages/retired/CHANGELOG.zh.md': '# 日志\n## [0.9.0]\n### 修复\n- 历史包\n'
  };
  const commits = [
    {hash:'d',parents:['b','c']},{hash:'b',parents:['a']},{hash:'c',parents:['a']},{hash:'a',parents:[]}
  ];
  const args = { paths: Object.keys(docs), read: p => docs[p], packages: [{path:'a',version:'1.1.0'}], commits, head:'d', tags:[{name:'v1.0.0',hash:'a'},{name:'v1.1.0',hash:'b'}], notes: {} };
  const {versions, snapshots} = buildVersions(args);
  assert.deepEqual(versions.items.map(v => v.id), ['Unreleased','1.1.0','1.0.0','0.9.0']);
  assert.deepEqual(versions.items[0].commitIds, ['d','c']);
  assert.equal(versions.items[0].range, 'v1.1.0..HEAD');
  assert.equal(versions.items[0].packages[0].zh, null);
  assert.deepEqual(versions.items[1].commitIds, ['b']);
  assert.equal(versions.items[1].risk, true);
  assert.equal(versions.items[2].packages[0].empty, true);
  assert.ok(versions.items[2].packages[0].zh.body.includes('中文旧版本'));
  assert.equal(versions.items[3].packages[0].active, false);
  assert.equal(versions.items[3].range, null);
  assert.deepEqual(snapshots, docs);
  assert.throws(() => buildVersions({...args, notes:{'1.1.0':{points:[{package:'a',needle:'not present'}]}}}), /版本解说依据失效/);
});

test('generated version index covers local changelogs and tags reachable from its source baseline', () => {
  const root = resolve(import.meta.dirname, '..');
  const run = args => execFileSync('git', args, {cwd:root,encoding:'utf8'}).trim();
  const versions = JSON.parse(readFileSync(new URL('./data/versions.json', import.meta.url), 'utf8'));
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  const data = JSON.parse(html.match(/<script id="doc-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(data.versions, versions);
  const reachable = new Set(run(['tag','--merged',versions.head]).split('\n'));
  for (const item of versions.items) {
    if (item.tag) {
      assert.ok(reachable.has(item.tag));
      const actual = run(['rev-list', item.range || item.tag]).split('\n').filter(Boolean).sort();
      assert.deepEqual([...item.commitIds].sort(), actual, item.id);
    }
    for (const pkg of item.packages) for (const entry of [pkg.en,pkg.zh].filter(Boolean)) {
      assert.equal(data.sources[entry.path], readFileSync(resolve(root, entry.path),'utf8'));
      assert.equal(data.sources[entry.path].split(/\r?\n/)[entry.line-1], entry.heading);
    }
  }
  const paths = run(['ls-files']).split('\n').filter(p => /^packages\/[^/]+\/CHANGELOG(?:\.zh)?\.md$/.test(p));
  assert.equal(versions.sourcePaths.length, paths.length);
  for (const path of paths) for (const entry of parseChangelog(readFileSync(resolve(root,path),'utf8'))) {
    if (path.endsWith('.zh.md') && entry.version === 'Unreleased') continue;
    const item = versions.items.find(v => v.id === entry.version);
    assert.ok(item, `${path} ${entry.version}`);
    const pkg = item.packages.find(p => p.id === path.split('/')[1]);
    assert.equal(pkg[path.endsWith('.zh.md') ? 'zh' : 'en'].body, entry.body);
  }
  const draft = versions.items.find(v=>v.id==='Unreleased');
  assert.deepEqual([...draft.commitIds].sort(), run(['rev-list',draft.range.replace(/\bHEAD\b/g,versions.head)]).split('\n').filter(Boolean).sort());
  for (const item of versions.items) for (const point of item.notes?.points || []) {
    assert.ok(data.sources[point.path].split(/\r?\n/)[point.line-1].includes(point.needle), `${item.id} ${point.title}`);
  }
  for (const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) if (!script[0].includes('type="application/json"')) new vm.Script(script[1]);
});

const escape = text => String(text).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const load = () => JSON.parse(readFileSync(new URL('./index.html',import.meta.url),'utf8').match(/<script id="doc-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
function makeNode() {
  return {innerHTML:'',textContent:'',value:'',checked:false,scrollTop:0,listeners:{},dataset:{},attributes:{},addEventListener(type,fn){this.listeners[type]=fn;},querySelectorAll(){return [];},querySelector(){return null;},scrollIntoView(){},classList:{toggle(){},remove(){}},setAttribute(key,value){this.attributes[key]=value;},removeAttribute(key){delete this.attributes[key];}};
}

test('version browser preserves list identity and scroll, filters all text and restores selection', () => {
  const data = load(), nodes=new Map();
  const document={getElementById(id){if(!nodes.has(id))nodes.set(id,makeNode());return nodes.get(id);}};
  const factory=vm.runInNewContext(readFileSync(new URL('./src/versions-app.js',import.meta.url),'utf8')+';createVersionBrowser',{document});
  const browser=factory(data,escape);
  const initial=browser.render('1.1.0','overview');
  assert.match(initial,/耗时可观测/);
  assert.match(initial,/href="#versions\/1.1.0\/overview"[^>]*aria-current="page"/);
  browser.activate();
  const list=nodes.get('versionList');list.innerHTML='retained';list.scrollTop=415;
  const selected=makeNode();selected.dataset.version='1.0.3';
  list.querySelectorAll=()=>[selected];
  browser.navigate('1.0.3','changes');
  assert.equal(list.innerHTML,'retained');assert.equal(list.scrollTop,415);
  assert.equal(selected.attributes['aria-current'],'page');
  assert.match(nodes.get('versionPanel').innerHTML,/azure-openai-responses/);
  browser.rememberMenu();list.scrollTop=0;
  assert.match(browser.render(),/v1.0.3/);browser.activate();
  assert.equal(list.scrollTop,415);
  nodes.get('versionSearch').value='Azure 配置';nodes.get('versionSearch').listeners.input();
  assert.match(list.innerHTML,/data-version="1.0.3"/);
  nodes.get('versionPackage').value='env';nodes.get('versionPackage').listeners.change();
  assert.doesNotMatch(list.innerHTML,/data-version="1.0.3"/);
  nodes.get('versionReset').listeners.click();
  nodes.get('versionRisk').checked=true;nodes.get('versionRisk').listeners.change();
  assert.doesNotMatch(list.innerHTML,/data-version="1.0.2"/);
  assert.ok(browser.search('azure-openai-responses').some(v=>v.id==='1.0.3'));
  assert.match(browser.render('missing'),/未找到该版本/);
  browser.navigate('1.1.0','upgrade');
  nodes.get('versionCompare').value='1.0.3';nodes.get('versionCompare').listeners.change();
  assert.match(nodes.get('versionComparison').innerHTML,/v1.0.3 ↔ v1.1.0/);
  browser.navigate('0.99.0','commits');
  nodes.get('versionPanel').listeners.click({target:{closest(){return {dataset:{versionPage:'1'}};}}});
  assert.match(nodes.get('versionCommits').innerHTML,/2 \/ /);
});

test('all version sections render with escaped evidence and complete package content', () => {
  const data=load();
  const factory=vm.runInNewContext(readFileSync(new URL('./src/versions-app.js',import.meta.url),'utf8')+';createVersionBrowser',{document:{getElementById(){return null;}}});
  const browser=factory(data,escape);
  for(const item of data.versions.items) for(const tab of ['overview','changes','upgrade','code','commits','sources']) {
    const html=browser.render(item.id,tab);
    assert.match(html,/versionPanel/);
    assert.doesNotMatch(html,/<script\b/i,`${item.id}/${tab}`);
    if(tab==='changes') for(const pkg of item.packages) for(const entry of [pkg.en,pkg.zh].filter(Boolean)) {
      assert.ok(html.includes(`data-source="${entry.path}" data-line="${entry.line}"`),`${item.id} ${entry.path}`);
    }
  }
  const item=data.versions.items.find(v=>v.id==='1.0.2');
  item.packages[0].en.body='### Example\n\n<img src=x onerror=bad()>\n\n- [bad](javascript:bad)\n\n```html\n<script>bad()</script>\n```';
  const result=browser.render('1.0.2','changes');
  assert.match(result,/&lt;img/);assert.match(result,/&lt;script&gt;/);
  assert.doesNotMatch(result,/<img|<script|href="javascript:/);
});

test('whole page version route supports deep links, global search and return without rebuilding list', () => {
  const data=load();
  const ids=['doc-data','main','nav','progressText','progress','sourceDialog','diagramDialog','sourceFind','globalSearch','menu','breadcrumb','version','sidebarMeta','searchResults','versionList','versionPanel','versionSearch','versionPackage','versionRisk','versionReset','versionCompare','versionComparison','versionCommits','librarySearch','libraryCount','libraryRows'];
  const nodes=new Map(ids.map(id=>[id,makeNode()]));
  nodes.get('doc-data').textContent=JSON.stringify(data);
  const document={title:'',body:makeNode(),getElementById(id){return nodes.get(id)||null;},querySelector(){return makeNode();},querySelectorAll(){return [];},addEventListener(){}};
  const events={},location={hash:'#versions/1.1.0/overview'};
  let scrolls=0;
  vm.runInNewContext(['versions-app.js','app.js'].map(file=>readFileSync(new URL(`./src/${file}`,import.meta.url),'utf8')).join('\n'),{
    document,location,window:{addEventListener(type,fn){events[type]=fn;},scrollTo(){scrolls++;}},
    localStorage:{getItem(){return null;}},clearInterval(){},
    createFeatureBrowser(){return {search(){return [];}};},createDirectoryBrowser(){return {search(){return [];}};},
    createPackageTutorialBrowser(){return {search(){return [];}};},createMasteryBrowser(){return {search(){return [];}};}
  });
  assert.match(nodes.get('nav').innerHTML,/href="#versions"[^>]*class="nav-link active"/);
  assert.match(nodes.get('main').innerHTML,/耗时可观测/);
  const main=nodes.get('main').innerHTML;
  nodes.get('versionList').scrollTop=390;
  location.hash='#versions/1.0.3/overview';events.hashchange();
  assert.match(nodes.get('versionPanel').innerHTML,/Azure 提供商更名/);
  assert.equal(nodes.get('main').innerHTML,main);assert.equal(scrolls,1);
  assert.equal(nodes.get('versionList').scrollTop,390);
  nodes.get('globalSearch').value='Azure 配置迁移';nodes.get('globalSearch').listeners.input();
  // A distinctive phrase from the curated notes, rather than only a source filename.
  nodes.get('globalSearch').value='Azure 名称变更';nodes.get('globalSearch').listeners.input();
  assert.match(nodes.get('searchResults').innerHTML,/data-go="versions\/1.0.3\/overview"/);
  location.hash='#sources';events.hashchange();nodes.get('versionList').scrollTop=0;
  location.hash='#versions';events.hashchange();
  assert.equal(nodes.get('versionList').scrollTop,390);
  assert.match(nodes.get('main').innerHTML,/Azure 提供商更名/);
});
