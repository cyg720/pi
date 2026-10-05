(() => {
  'use strict';
  const data = JSON.parse(document.getElementById('doc-data').textContent);
  const $ = id => document.getElementById(id);
  const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const saved = (key, fallback) => { try { return JSON.parse(localStorage.getItem(`pi-doc-${key}`)) ?? fallback; } catch { return fallback; } };
  const save = (key, value) => { try { localStorage.setItem(`pi-doc-${key}`, JSON.stringify(value)); } catch { /* file:// storage may be unavailable. Reading still works. */ } };
  const storedRead = saved('read', []);
  const readChapters = new Set(Array.isArray(storedRead) ? storedRead : []);
  const routes = [
    ['start', '从零认识 Pi', '01'], ['map', '项目源码地图', '02'], ['boot', '从 CLI 到会话', '03'],
    ['loop', '模型与工具循环', '04'], ['session', '会话与上下文', '05'], ['extensions', '智能体扩展详解', '06'],
    ['advanced', '服务与持久化', '07'], ['practice', '带着问题读源码', '08'],
    ['functions', '功能清单详情', 'Fn'], ['diagrams', '架构图谱', '图'], ['history', 'Git 提交时间线', 'Git'], ['sources', '离线源码书架', '{ }']
  ];
  const types = { feat: '新增', fix: '修复', docs: '文档', refactor: '重构', test: '测试', chore: '维护', perf: '性能', build: '构建', ci: 'CI', merge: '合并', revert: '回退', other: '其他' };
  let current = 'start';
  let traceIndex = 0;
  let timer;
  let diagramIndex = 0;
  const diagramUrls = new Map();
  let currentSource = '';
  let sourceLine = -1;
  let historyPage = 0;
  let historyFiltered = data.commits;
  let historyQuery = { query: '', scope: '', type: '', year: '' };
  let toastTimer;
  const featureBrowser = createFeatureBrowser(data, esc);
  const notify = text => { $('toast').textContent = text; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2500); };
  const sourceLink = (path, needle = '', label) => `<button class="ref" data-source="${esc(path)}" data-needle="${esc(needle)}">${esc(label || path.replace(/^packages\//, ''))}</button>`;
  const hero = (eyebrow, title, intro, number = '') => `<div class="hero-line"><div><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1><p class="lead">${esc(intro)}</p></div>${number ? `<div class="chapter-number" aria-hidden="true">${number}</div>` : ''}</div>`;
  function nav() {
    $('nav').innerHTML = routes.map(([id, title, n], i) => `${i === 0 ? '<div class="nav-group">循序渐进 / LEARN</div>' : i === 8 ? '<div class="nav-group">查阅与探索 / EXPLORE</div>' : ''}<a href="#${id}" class="nav-link ${current === id ? 'active' : ''}" ${current === id ? 'aria-current="page"' : ''}><span>${n}</span>${title}${readChapters.has(id) ? '<em aria-label="已读">✓</em>' : ''}</a>`).join('');
    const count = routes.slice(0, 8).filter(([id]) => readChapters.has(id)).length;
    $('progressText').textContent = `${count} / 8`;
    $('progress').value = count;
  }
  function finish(id) {
    const index = routes.findIndex(r => r[0] === id);
    return `<div class="end-nav">${index > 0 ? `<a href="#${routes[index - 1][0]}">← ${routes[index - 1][1]}</a>` : '<span></span>'}<button data-read="${id}">${readChapters.has(id) ? '已读 · 撤销标记' : '标记本章已读'}</button>${index < 7 ? `<a href="#${routes[index + 1][0]}">${routes[index + 1][1]} →</a>` : '<a href="#diagrams">查看架构图谱 →</a>'}</div>`;
  }
  function traceHtml() {
    return `<div class="trace"><div class="trace-top"><h2>一条请求的旅程</h2><div><button id="tracePrev" aria-label="上一步">←</button> <button id="tracePlay">自动演示</button> <button id="traceNext" aria-label="下一步">→</button></div></div><div class="trace-track">${data.trace.map((t, i) => `<button class="trace-step ${i === traceIndex ? 'active' : ''}" data-trace="${i}" aria-pressed="${i === traceIndex}"><small>0${i + 1}</small>${esc(t[0])}</button>`).join('')}</div><div id="traceDetail" class="trace-detail" aria-live="polite"></div></div>`;
  }
  function updateTrace() {
    const t = data.trace[traceIndex];
    document.querySelectorAll('[data-trace]').forEach(el => { el.classList.toggle('active', Number(el.dataset.trace) === traceIndex); el.setAttribute('aria-pressed', Number(el.dataset.trace) === traceIndex); });
    $('traceDetail').innerHTML = `<div><strong>${esc(t[1])}</strong><p>${esc(t[2])}</p></div>${sourceLink(t[3], t[4], '查看这一步的源码')}`;
    $('tracePrev').disabled = traceIndex === 0;
    $('traceNext').disabled = traceIndex === data.trace.length - 1;
  }
  function renderChapter(chapter) {
    const index = routes.findIndex(r => r[0] === chapter.id);
    const welcome = chapter.id === 'start' ? `<div class="stats"><div class="stat"><b>${data.packages.length}</b><small>包与职责</small></div><div class="stat"><b>8</b><small>循序渐进的章节</small></div><div class="stat"><b>${data.commits.length.toLocaleString()}</b><small>本地 Git 提交</small></div><div class="stat"><b>5</b><small>可交互架构图</small></div></div><div class="route"><a href="#boot"><span>PATH 01 · START</span><h3>跟着启动走</h3><p>从 cli.ts 到会话装配</p></a><a href="#loop"><span>PATH 02 · EXECUTE</span><h3>跟着请求走</h3><p>模型 → 工具 → 下一轮</p></a><a href="#extensions"><span>PATH 03 · EXTEND</span><h3>理解智能体扩展</h3><p>工具、事件与子智能体</p></a></div>` : '';
    const sections = chapter.sections.map((s, i) => `<section class="section" id="section-${i}"><h2>${esc(s.title)}</h2>${s.text ? `<p>${esc(s.text)}</p>` : ''}${s.table ? `<div class="table-wrap"><table><thead><tr>${s.table[0].map(c => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${s.table.slice(1).map(row => `<tr>${row.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}${s.refs ? `<div class="refs">${s.refs.map(r => sourceLink(...r)).join('')}</div>` : ''}</section>`).join('');
    return `${hero(chapter.eyebrow, chapter.title, chapter.intro, String(index + 1).padStart(2, '0'))}${welcome}${chapter.id === 'loop' || chapter.id === 'start' ? traceHtml() : ''}<div class="two-col"><article>${sections}${finish(chapter.id)}</article><aside class="toc"><strong>本章阅读路线</strong>${chapter.sections.map((s, i) => `<a href="#${chapter.id}/section-${i}">${esc(s.title)}</a>`).join('')}<div class="callout">先读中文解释，再打开对应源码。快照带行号，可搜索函数名。</div></aside></div>`;
  }
  function renderMap() {
    return `${hero('02 / REPOSITORY MAP', '项目源码地图', '按职责认识包；箭头“依赖”来自工作区 package.json，不等同于每次请求的执行路径。', '02')}<div class="grid">${data.packages.map(p => `<article class="card"><small class="mono">packages/${esc(p.path)}</small><h2>${esc(p.path)}</h2><p>${esc(p.description)}</p><div class="chips">${p.dependencies.map(d => `<span class="chip">依赖 ${esc(d.replace('@earendil-works/', ''))}</span>`).join('') || '<span class="chip">无直接 Pi 工作区运行时依赖</span>'}</div><div class="refs">${sourceLink(`packages/${p.path}/package.json`, '', '包清单')}${data.sources[`packages/${p.path}/README.md`] ? sourceLink(`packages/${p.path}/README.md`, '', '阅读 README') : ''}</div></article>`).join('')}</div><section class="section"><h2>目录索引</h2><p>按本次生成时 git ls-files 收录的 packages、scripts、.pi 路径搜索。完整源码快照仅覆盖书架列出的精选文件。</p><label>过滤文件路径 <input id="treeSearch" type="search" placeholder="例如 extensions 或 session-manager"></label><p id="treeCount" class="meta"></p><div id="treeResults" class="tree-list"></div></section>${finish('map')}`;
  }
  function treeSearch() {
    const query = $('treeSearch').value.toLowerCase();
    const results = data.trackedPaths.filter(p => p.toLowerCase().includes(query));
    $('treeCount').textContent = `匹配 ${results.length} 个路径，显示前 ${Math.min(150, results.length)} 个；输入更精确路径缩小范围。`;
    $('treeResults').innerHTML = results.slice(0, 150).map(p => `<div>${data.sources[p] ? sourceLink(p, '', p) : esc(p)}</div>`).join('') || '没有匹配路径。';
  }
  function renderHistory() {
    return `${hero('GIT / PROJECT EVOLUTION', '项目是怎样演进的', '每次提交保留原始说明、作者、日期、父提交与文件变动，并配有中文解说。')}<div class="callout">${esc(data.meta.historyScope)} ${data.meta.shallow ? '当前是浅克隆，历史受本地可用范围限制。' : '当前不是浅克隆。'}<br>“人工中文解说”依据提交说明与统计编写；其余“元数据中文概述”只解释类型、主题线索和文件范围，并非逐条 diff 审查或完整翻译。</div><div class="filters"><label class="grow">搜索提交、中文、作者、文件<input id="historySearch" type="search" placeholder="例如 extension、修复、作者或 hash" value="${esc(historyQuery.query)}"></label><label>包<select id="historyScope"><option value="">全部包</option>${[...new Set(data.commits.flatMap(c => c.scopes))].sort().map(s => `<option ${historyQuery.scope === s ? 'selected' : ''} value="${esc(s)}">${esc(s)}</option>`).join('')}</select></label><label>类型<select id="historyType"><option value="">全部类型</option>${Object.keys(types).map(t => `<option value="${t}" ${historyQuery.type === t ? 'selected' : ''}>${types[t]}</option>`).join('')}</select></label><label>年份<select id="historyYear"><option value="">全部年份</option>${[...new Set(data.commits.map(c => c.date.slice(0, 4)))].sort().reverse().map(y => `<option ${historyQuery.year === y ? 'selected' : ''}>${y}</option>`).join('')}</select></label></div><div id="historyCount" class="meta" role="status"></div><div id="historyRows" class="timeline"></div><div class="pagination"><button id="historyPrev" class="quiet">上一页</button><span id="historyPages" class="meta"></span><button id="historyNext" class="quiet">下一页</button></div>`;
  }
  function filterHistory() {
    historyQuery = { query: $('historySearch').value, scope: $('historyScope').value, type: $('historyType').value, year: $('historyYear').value };
    const q = historyQuery.query.toLowerCase().trim();
    historyFiltered = data.commits.filter(c => (!historyQuery.scope || c.scopes.includes(historyQuery.scope)) && (!historyQuery.type || c.type === historyQuery.type) && (!historyQuery.year || c.date.startsWith(historyQuery.year)) && (!q || `${c.hash} ${c.body} ${c.zh} ${c.author} ${c.files.map(f => f.path).join(' ')}`.toLowerCase().includes(q)));
    historyPage = 0;
    historyRows();
  }
  function historyRows() {
    const pageSize = 25;
    const pageCount = Math.max(1, Math.ceil(historyFiltered.length / pageSize));
    historyPage = Math.max(0, Math.min(historyPage, pageCount - 1));
    $('historyCount').textContent = `${historyFiltered.length.toLocaleString()} / ${data.commits.length.toLocaleString()} 条提交 · 按 Git date-order 从新到旧 · 日期采用原提交时区`;
    $('historyRows').innerHTML = historyFiltered.slice(historyPage * pageSize, (historyPage + 1) * pageSize).map(c => `<article class="commit"><time datetime="${esc(c.date)}">${esc(c.date.replace('T', ' '))}</time><div class="commit-body"><div class="meta">${esc(c.hash.slice(0, 10))} · ${esc(c.author)}<span class="badge">${esc(types[c.type] || c.type)}</span></div><h3>${esc(c.subject)}</h3><span class="badge">${c.curated ? '人工中文解说 · 提交说明与统计' : '元数据中文概述 · 自动生成'}</span><p>${esc(c.zh)}</p><div class="chips">${c.scopes.map(s => `<span class="chip">${esc(s)}</span>`).join('')}<span class="chip">+${c.added} / −${c.removed}</span></div><details><summary>展开原始说明与 ${c.files.length} 个文件</summary><pre>${esc(c.body)}</pre><p class="meta">完整 SHA：${esc(c.hash)}<br>父提交：${esc(c.parents.join(' · ') || '根提交')}</p>${c.files.map(f => `<div class="file-row">+${esc(f.added)} / −${esc(f.removed)} &nbsp; ${esc(f.path)} ${data.sources[f.path] ? sourceLink(f.path, '', '当前快照') : ''}</div>`).join('') || '<p>此记录没有常规 numstat 文件列表；合并记录需结合父提交理解。</p>'}<p class="meta">当前快照属于文档生成版本，不是该历史提交的文件。仓库内查看补丁：git show ${esc(c.hash)}</p></details></div></article>`).join('') || '<div class="empty">没有匹配提交。尝试缩短关键词或清除筛选条件。</div>';
    $('historyPages').textContent = `${historyPage + 1} / ${pageCount}`;
    $('historyPrev').disabled = historyPage === 0;
    $('historyNext').disabled = historyPage >= pageCount - 1;
  }
  function diagramUrl(i) {
    if (!diagramUrls.has(i)) diagramUrls.set(i, URL.createObjectURL(new Blob([data.diagrams[i].html], { type: 'text/html' })));
    return diagramUrls.get(i);
  }
  function renderDiagrams() {
    return `${hero('ATLAS / FIVE PERSPECTIVES', '架构图谱', '五个视角，一起对照源码主线阅读。图内保留原有缩放、主题、交互与导出控件。')}<div class="callout">已将原“图架构”中的五幅主图内嵌到此单文件，并移除在线字体依赖。图的内容保留原样，未视为当前版本逐节点审计结论；以文档源码快照为准。原 visual-check 页面引用的 PNG 在原目录中缺失，因此仅作为原始资料留存。</div><div class="diagram-tabs" role="group" aria-label="选择架构图">${data.diagrams.map((d, i) => `<button data-diagram="${i}" class="${i === diagramIndex ? 'active' : ''}" aria-pressed="${i === diagramIndex}">${esc(d.title)}</button>`).join('')}</div><div class="diagram-caption"><p id="diagramDescription"></p><button id="diagramLarge" class="quiet">打开大图</button></div><div id="diagramHost"></div>`;
  }
  function updateDiagram() {
    const d = data.diagrams[diagramIndex];
    $('diagramDescription').textContent = d.description;
    document.querySelectorAll('[data-diagram]').forEach(el => { const active = Number(el.dataset.diagram) === diagramIndex; el.classList.toggle('active', active); el.setAttribute('aria-pressed', active); });
    $('diagramHost').innerHTML = `<iframe class="diagram-frame" title="${esc(d.title)}" sandbox="allow-scripts allow-downloads" src="${diagramUrl(diagramIndex)}"></iframe>`;
  }
  function renderSources() {
    return `${hero('LIBRARY / LOCAL SNAPSHOTS', '离线源码书架', `${Object.keys(data.sources).length} 份精选源码、类型声明与原始文档已内嵌。无需本地服务器，也不读取磁盘上的其他源码文件。`)}<div class="callout">快照版本：${esc(data.meta.commit)}<br>${data.meta.status ? '生成时 packages/scripts 存在工作区变更，快照反映工作区内容，请结合 manifest 检查。' : '生成时 packages/scripts 没有 Git 报告的工作区变更。'}<br>每份文件的 SHA-256 保存在 data/manifest.json。复制此 HTML 到别处仍可阅读全部内嵌内容。</div><div class="filters"><label class="grow">按文件名筛选<input id="librarySearch" type="search" placeholder="例如 extensions/types.ts"></label></div><p id="libraryCount" class="meta"></p><div id="libraryRows" class="source-list"></div>`;
  }
  function libraryRows() {
    const q = $('librarySearch').value.toLowerCase();
    const results = Object.entries(data.sources).filter(([p]) => p.toLowerCase().includes(q));
    $('libraryCount').textContent = `${results.length} 份文件`;
    $('libraryRows').innerHTML = results.map(([p, text]) => `<button data-source="${esc(p)}">${esc(p)}<small>${text.split('\n').length.toLocaleString()} 行 · ${p.endsWith('.md') ? '原始文档' : '源码 / 配置'}</small></button>`).join('') || '<div class="empty">没有匹配文件。</div>';
  }
  function render() {
    clearInterval(timer); timer = undefined;
    const [id, anchor] = location.hash.slice(1).split('/');
    if (current === 'functions' && id === 'functions' && $('featurePanel')) {
      featureBrowser.navigate(anchor);
      return;
    }
    if (current === 'functions') featureBrowser.rememberMenu();
    current = routes.some(r => r[0] === id) ? id : 'start';
    nav();
    $('breadcrumb').textContent = `Pi 源码导览 / ${routes.find(r => r[0] === current)[1]}`;
    document.title = `${routes.find(r => r[0] === current)[1]} · Pi 源码导览`;
    const chapter = data.chapters.find(c => c.id === current);
    const html = chapter ? renderChapter(chapter) : current === 'functions' ? featureBrowser.render(anchor) : current === 'map' ? renderMap() : current === 'history' ? renderHistory() : current === 'diagrams' ? renderDiagrams() : renderSources();
    $('main').innerHTML = `<div class="page">${html}</div>`;
    if ($('traceDetail')) updateTrace();
    if (current === 'map') { treeSearch(); $('treeSearch').addEventListener('input', treeSearch); }
    if (current === 'history') {
      filterHistory();
      for (const id of ['historySearch', 'historyScope', 'historyType', 'historyYear']) $(id).addEventListener(id === 'historySearch' ? 'input' : 'change', filterHistory);
    }
    if (current === 'diagrams') updateDiagram();
    if (current === 'functions') featureBrowser.activate();
    if (current === 'sources') { libraryRows(); $('librarySearch').addEventListener('input', libraryRows); }
    document.querySelector('.sidebar').classList.remove('open'); $('menu').setAttribute('aria-expanded', 'false');
    if (anchor && document.getElementById(anchor)) document.getElementById(anchor).scrollIntoView();
    else window.scrollTo({ top: 0 });
  }
  function openSource(path, needle = '', requestedLine = 0) {
    if (!Object.hasOwn(data.sources, path)) { notify('该文件未收录离线快照'); return; }
    currentSource = path; sourceLine = -1;
    $('sourceTitle').textContent = path;
    $('sourceFind').value = needle;
    $('sourceBody').innerHTML = data.sources[path].split('\n').map((line, i) => `<div class="code-line" id="code-${i}"><span class="line-number">${i + 1}</span><span class="line-code">${esc(line.replace(/\r$/, '')) || ' '}</span></div>`).join('');
    $('sourceStatus').textContent = `${data.sources[path].split('\n').length} 行 · ${data.meta.commit.slice(0, 9)}`;
    if (!$('sourceDialog').open) $('sourceDialog').showModal();
    $('sourceBody').scrollTop = 0;
    if (Number.isInteger(requestedLine) && requestedLine > 0 && $(`code-${requestedLine - 1}`)) {
      sourceLine = requestedLine - 1;
      const line = $(`code-${sourceLine}`);
      line.classList.add('highlight');
      $('sourceBody').scrollTop += line.getBoundingClientRect().top - $('sourceBody').getBoundingClientRect().top - 60;
      $('sourceStatus').textContent = `第 ${requestedLine} 行 · ${data.meta.commit.slice(0, 9)}`;
    } else if (needle) findSource();
  }
  function findSource() {
    const q = $('sourceFind').value.toLowerCase();
    if (!q) return;
    const lines = data.sources[currentSource].split('\n');
    const matches = lines.map((line, i) => line.toLowerCase().includes(q) ? i : -1).filter(i => i >= 0);
    document.querySelectorAll('.code-line.highlight').forEach(el => el.classList.remove('highlight'));
    if (!matches.length) { $('sourceStatus').textContent = '没有找到该文本'; return; }
    sourceLine = matches.find(i => i > sourceLine) ?? matches[0];
    const line = $(`code-${sourceLine}`); line.classList.add('highlight');
    $('sourceBody').scrollTop += line.getBoundingClientRect().top - $('sourceBody').getBoundingClientRect().top - 60;
    $('sourceStatus').textContent = `第 ${sourceLine + 1} 行 · 匹配 ${matches.indexOf(sourceLine) + 1} / ${matches.length}`;
  }
  function search() {
    const q = $('globalSearch').value.trim().toLowerCase();
    if (!q) { $('searchResults').innerHTML = '<p class="meta">搜索中文讲解、文件路径和内嵌源码内容。提交记录请使用 Git 时间线的专用筛选。</p>'; return; }
    const sections = data.chapters.flatMap(c => c.sections.map((s, i) => ({ c, s, i }))).filter(({ s }) => JSON.stringify(s).toLowerCase().includes(q));
    const features = featureBrowser.search(q);
    const files = Object.entries(data.sources).filter(([p, text]) => `${p}\n${text}`.toLowerCase().includes(q));
    $('searchResults').innerHTML = `<p class="meta">${features.length} 项功能 · ${sections.length} 个讲解段落 · ${files.length} 份文件；各显示前 20 项。</p>${features.slice(0,20).map(f => `<button class="search-result" data-go="functions/${f.id}">${esc(f.title)}<small>功能清单 · ${esc(f.purpose)}</small></button>`).join('')}${sections.slice(0, 20).map(({ c, s, i }) => `<button class="search-result" data-go="${c.id}/section-${i}">${esc(s.title)}<small>${esc(c.title)} · ${esc((s.text || '表格与源码引用').slice(0, 100))}</small></button>`).join('')}${files.slice(0, 20).map(([p, text]) => { const line = text.split('\n').find(l => l.toLowerCase().includes(q)); return `<button class="search-result" data-source="${esc(p)}" data-needle="${esc(q)}">${esc(p)}<small>${esc((line || '文件名匹配').slice(0, 130))}</small></button>`; }).join('')}${!features.length && !sections.length && !files.length ? '<div class="empty">没有找到结果。试试函数名或更短的关键词。</div>' : ''}`;
  }
  document.addEventListener('click', async event => {
    const el = event.target.closest('button, [data-source]'); if (!el) return;
    if (el.dataset.source) { $('searchDialog').close(); openSource(el.dataset.source, el.dataset.needle || '', Number(el.dataset.line || 0)); }
    if (el.dataset.featureCommit) { historyQuery = { query: el.dataset.featureCommit, scope: '', type: '', year: '' }; location.hash = '#history'; }
    if (el.dataset.go) { $('searchDialog').close(); const next = `#${el.dataset.go}`; if (location.hash === next) render(); else location.hash = next; }
    if (el.dataset.read) { const id = el.dataset.read; if (readChapters.has(id)) readChapters.delete(id); else readChapters.add(id); save('read', [...readChapters]); nav(); el.textContent = readChapters.has(id) ? '已读 · 撤销标记' : '标记本章已读'; }
    if (el.dataset.trace !== undefined) { traceIndex = Number(el.dataset.trace); updateTrace(); }
    if (el.dataset.diagram !== undefined) { diagramIndex = Number(el.dataset.diagram); updateDiagram(); }
    switch (el.id) {
      case 'theme': document.body.classList.toggle('dark'); save('dark', document.body.classList.contains('dark')); break;
      case 'menu': { const open = document.querySelector('.sidebar').classList.toggle('open'); el.setAttribute('aria-expanded', open); break; }
      case 'searchOpen': $('searchDialog').showModal(); $('globalSearch').focus(); search(); break;
      case 'searchClose': $('searchDialog').close(); break;
      case 'sourceClose': $('sourceDialog').close(); break;
      case 'sourceFindButton': findSource(); break;
      case 'copySource': try { await navigator.clipboard.writeText(data.sources[currentSource]); $('sourceStatus').textContent = '已复制完整文件'; } catch { $('sourceStatus').textContent = '浏览器未开放剪贴板，请在源码区手动选择复制'; } break;
      case 'tracePrev': traceIndex = Math.max(0, traceIndex - 1); updateTrace(); break;
      case 'traceNext': traceIndex = Math.min(data.trace.length - 1, traceIndex + 1); updateTrace(); break;
      case 'tracePlay':
        if (timer) { clearInterval(timer); timer = undefined; el.textContent = '自动演示'; }
        else { if (traceIndex === data.trace.length - 1) traceIndex = 0; updateTrace(); el.textContent = '暂停演示'; timer = setInterval(() => { traceIndex++; updateTrace(); if (traceIndex === data.trace.length - 1) { clearInterval(timer); timer = undefined; el.textContent = '重新演示'; } }, 2300); }
        break;
      case 'historyPrev': historyPage--; historyRows(); $('historyCount').scrollIntoView({ block: 'center' }); break;
      case 'historyNext': historyPage++; historyRows(); $('historyCount').scrollIntoView({ block: 'center' }); break;
      case 'diagramLarge': $('diagramTitle').textContent = data.diagrams[diagramIndex].title; $('largeDiagram').innerHTML = `<iframe title="${esc(data.diagrams[diagramIndex].title)}大图" sandbox="allow-scripts allow-downloads" src="${diagramUrl(diagramIndex)}"></iframe>`; $('diagramDialog').showModal(); break;
      case 'diagramClose': $('diagramDialog').close(); break;
    }
  });
  $('diagramDialog').addEventListener('close', () => { $('largeDiagram').innerHTML = ''; });
  $('sourceFind').addEventListener('keydown', event => { if (event.key === 'Enter') findSource(); });
  $('globalSearch').addEventListener('input', search);
  document.addEventListener('keydown', event => { if (event.key === '/' && !event.ctrlKey && !event.metaKey && !/INPUT|TEXTAREA|SELECT/.test(event.target.tagName) && !document.querySelector('dialog[open]')) { event.preventDefault(); $('searchDialog').showModal(); $('globalSearch').focus(); search(); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden && timer) { clearInterval(timer); timer = undefined; if ($('tracePlay')) $('tracePlay').textContent = '自动演示'; } });
  window.addEventListener('hashchange', render);
  document.body.classList.toggle('dark', saved('dark', false));
  $('version').textContent = data.meta.commit.slice(0, 9);
  $('sidebarMeta').textContent = `SOURCE ${data.meta.commit.slice(0, 9)}\n${data.meta.builtAt.slice(0, 10)} · 本地快照`;
  render();
})();
