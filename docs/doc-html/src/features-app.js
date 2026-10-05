/* Feature browser only renders the generated local catalog. No filesystem or network access. */
function createFeatureBrowser(data, esc) {
  const catalog = data.catalog;
  const $ = id => document.getElementById(id);
  const byId = new Map(catalog.features.map(f => [f.id, f]));
  const modules = new Map(catalog.modules.map(m => [m.id, m]));
  const commitMap = new Map(data.commits.map(c => [c.hash, c]));
  const commitOrder = new Map(data.commits.map((c, i) => [c.hash, i]));
  const searchIndex = new Map();
  let query = '', status = '', evidence = '', moduleFilter = '';
  let active = '', file = '', symbolQuery = '', symbolPage = 0;
  let searchTimer;
  let menuScroll = 0;
  const menuOpen = new Map();
  function rememberMenu() {
    const menu = $('featureMenu');
    if (!menu) return;
    menuScroll = menu.scrollTop;
    menu.querySelectorAll('details[data-module]').forEach(node => menuOpen.set(node.dataset.module, node.open));
  }
  function navigate(id) {
    active = byId.has(id) ? id : '';
    const selected = byId.get(active);
    if (selected && !selected.files.includes(file)) { file = selected.files[0]; symbolQuery = ''; symbolPage = 0; }
    const menu = $('featureMenu');
    const scroll = menu.scrollTop;
    menu.querySelectorAll('a[data-feature]').forEach(link => {
      const selectedLink = link.dataset.feature === active;
      link.classList.toggle('selected', selectedLink);
      if (selectedLink) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    menu.querySelectorAll('details[data-module]').forEach(node => {
      if (node.dataset.module === selected?.module) node.open = true;
    });
    menu.scrollTop = scroll;
    updatePanel(matching());
  }
  const ref = (path, line = 1, label = path) => data.sources[path] !== undefined ? `<button class="ref" data-source="${esc(path)}" data-line="${line}">${esc(label)}</button>` : `<span class="chip">${esc(path)} · 未内嵌文本 / 资源</span>`;
  function textOf(f) {
    if (!searchIndex.has(f.id)) searchIndex.set(f.id, [f.title, f.purpose, f.entry, f.behavior, f.status, f.evidence, ...f.files.map(p => `${p} ${catalog.files[p].symbols.map(s => s.name).join(' ')}`)].join(' ').toLowerCase());
    return searchIndex.get(f.id);
  }
  function matching() {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return catalog.features.filter(f => (!status || f.status === status) && (!evidence || f.evidence === evidence) && (!moduleFilter || f.module === moduleFilter) && terms.every(t => textOf(f).includes(t)));
  }
  function render(id) {
    active = byId.has(id) ? id : '';
    const f = byId.get(active);
    if (f && !f.files.includes(file)) { file = f.files[0]; symbolQuery = ''; symbolPage = 0; }
    return `<div class="feature-heading"><div class="eyebrow">全域功能地图</div><h1>功能清单详情</h1><p class="lead">从大模块看到功能作用，再沿来源、引用与注释进入实现。</p></div><div class="feature-metrics"><span><b>${catalog.modules.length}</b> 大模块</span><span><b>${catalog.stats.documented}</b> 中文能力解说</span><span><b>${catalog.stats.features}</b> 功能与索引条目</span><span><b>${catalog.stats.files}</b> 归属文件</span><span><b>${catalog.stats.symbols.toLocaleString()}</b> 代码声明</span></div><details class="feature-scope"><summary>覆盖范围与证据说明 · ${catalog.stats.unassigned} 个未归属文件</summary><p>${esc(catalog.scope)}</p><p>“中文能力解说”是按源码入口/仓库文档整理的说明；“源码规则归类”按提供商工厂和示例入口自动生成；“源码覆盖索引”列出尚未单独解释的支撑实现。文件覆盖率不代表所有业务语义已人工确认。</p><p>导入/再导出是静态文件引用，不是精确调用图。测试关联仅表示测试直接导入相关源码，不代表该功能被完整测试。原始注释保留原语言，不编造缺失注释。</p></details><div class="feature-filters"><label>查找功能、入口或符号<input id="featureSearch" type="search" value="${esc(query)}" placeholder="例如：压缩、read、registerTool"></label><label>大模块<select id="featureModule"><option value="">全部模块</option>${catalog.modules.map(m => `<option value="${m.id}" ${moduleFilter === m.id ? 'selected' : ''}>${esc(m.title)}</option>`).join('')}</select></label><label>能力类别<select id="featureStatus"><option value="">全部类别</option>${[...new Set(catalog.features.map(f => f.status))].map(s => `<option ${status === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label><label>说明依据<select id="featureEvidence"><option value="">全部依据</option>${['中文能力解说','源码规则归类','源码覆盖索引'].map(s => `<option ${evidence === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label><button id="featureReset" class="quiet">清除筛选</button></div><p id="featureCount" class="meta" role="status"></p><div class="feature-layout"><nav id="featureMenu" class="feature-menu" aria-label="大模块与功能"></nav><div id="featurePanel" class="feature-panel"></div></div>`;
  }
  function refresh(preserve = true) {
    if (preserve) rememberMenu();
    const results = matching();
    $('featureCount').textContent = `匹配 ${results.length} / ${catalog.features.length} 项 · 按业务阅读顺序：启动装配 → 执行 → 持久化 → 展示与扩展；独立模块不代表严格时序`;
    $('featureMenu').innerHTML = `<a class="feature-home" href="#functions">全域概览</a>${catalog.modules.map(m => {
      const rows = results.filter(f => f.module === m.id);
      if (!rows.length) return '';
      const open = query || moduleFilter || menuOpen.get(m.id) || byId.get(active)?.module === m.id;
      return `<details data-module="${m.id}" ${open ? 'open' : ''}><summary>${esc(m.title)}<span>${rows.length}</span></summary>${rows.map(f => `<a href="#functions/${f.id}" data-feature="${f.id}" class="${f.id === active ? 'selected' : ''}" ${f.id === active ? 'aria-current="page"' : ''}>${esc(f.title)}<small>${esc(f.status)}</small></a>`).join('')}</details>`;
    }).join('') || '<p>没有匹配功能。</p>'}`;
    $('featureMenu').scrollTop = menuScroll;
    updatePanel(results);
  }
  function updatePanel(results) {
    const selected = byId.get(active);
    if (selected) {
      $('featurePanel').innerHTML = `${!results.some(f => f.id === active) ? '<div class="callout">当前详情不在筛选结果内。可清除筛选，或从左侧选择其他功能。</div>' : ''}${detail(selected)}`;
      activateFile();
    } else $('featurePanel').innerHTML = overview(results);
  }
  function overview(results) {
    if (!results.length) return '<div class="empty">没有匹配项。尝试其他关键词，或清除筛选。</div>';
    return `<div class="feature-overview"><h2>项目能力总览</h2><p>点击功能查看用途与实现依据。提供商、示例和支撑资源也可继续展开。</p>${catalog.modules.map(m => {
      const rows = results.filter(f => f.module === m.id);
      return rows.length ? `<section class="feature-module"><header><h3>${esc(m.title)}</h3><span class="chip">${m.fileCount} 个文件</span></header><p>${esc(m.description)}</p><div>${rows.map(f => `<a href="#functions/${f.id}" class="feature-overview-row"><strong>${esc(f.title)}</strong><span>${esc(f.purpose)}</span><small>${f.files.length} 个来源文件 · ${esc(f.evidence)}</small></a>`).join('')}</div></section>` : '';
    }).join('')}</div>`;
  }
  function detail(f) {
    const m = modules.get(f.module);
    const files = f.files.map(p => catalog.files[p]);
    const history = f.commits.slice().sort((a,b) => commitOrder.get(a) - commitOrder.get(b));
    return `<article class="feature-detail"><div class="feature-detail-title"><small>${esc(m.title)} / ${esc(f.status)}</small><h2>${esc(f.title)}</h2><div class="chips"><span class="chip">${esc(f.evidence)}</span><span class="chip">${f.files.length} 文件</span><span class="chip">${files.reduce((n,r) => n + r.symbols.length,0)} 声明</span><span class="chip">${f.tests.length} 直接引用测试文件</span></div></div><section><h3>作用与使用场景</h3><p>${esc(f.purpose)}</p><dl class="feature-facts"><dt>入口 / 触发</dt><dd>${esc(f.entry)}</dd><dt>处理与边界</dt><dd>${esc(f.behavior)}</dd><dt>实现来源</dt><dd>${esc(m.root)}<br>版本 ${esc(data.meta.commit.slice(0,12))}；${data.meta.status ? '包含工作区修改' : '已跟踪源码快照'}</dd><dt>参考资料</dt><dd>${f.docs.map(p => ref(p,1,p.replace(/^packages\//,''))).join('')}</dd></dl></section><section><h3>来源文件与实现细节</h3><label class="feature-file-label">选择实现 / 资源文件<select id="featureFile">${f.files.map(p => `<option value="${esc(p)}" ${p === file ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></label><div id="featureFileDetail"></div></section><details class="feature-extra"><summary>测试依据 · ${f.tests.length} 份直接引用测试</summary><p>只收录能解析的静态 import/再导出；间接覆盖、动态加载和字符串引用不在这个计数中。本次未因此运行模型或外部服务。</p><div class="refs">${f.tests.map(p => ref(p)).join('') || '<p>未找到直接静态引用测试；不等于没有测试。</p>'}</div></details><details class="feature-extra"><summary>相关演进 · ${history.length} 条路径关联提交</summary><p>按当前文件路径匹配 Git numstat，不追溯重命名；不是功能首次引入日期。下列展示最近 12 条，完整原文可在 Git 时间线检索。</p>${history.slice(0,12).map(hash => { const c = commitMap.get(hash); return `<div class="feature-history"><small>${esc(c.date.slice(0,10))} · ${hash.slice(0,9)}</small><p>${esc(c.zh)}</p><code>${esc(c.subject)}</code><button class="quiet" data-feature-commit="${hash}">在时间线查看</button></div>`; }).join('') || '<p>本地历史中未找到路径变动记录。</p>'}</details><div class="end-nav"><a href="#functions">← 返回全域概览</a><span class="meta">功能定位：#functions/${esc(f.id)}</span></div></article>`;
  }
  function activateFile() {
    $('featureFile').addEventListener('change', () => { file = $('featureFile').value; symbolQuery = ''; symbolPage = 0; fileDetail(); });
    fileDetail();
  }
  function fileDetail() {
    const f = catalog.files[file];
    const outgoing = f.imports;
    $('featureFileDetail').innerHTML = `<div class="feature-file-bar">${ref(file)}<small>${f.lines ?? '二进制'} ${f.lines === null ? '' : '行'} · ${f.resource ? '资源 / 数据 / 非 TS 实现' : 'TS/JS 实现'} · ${f.symbols.length} 个声明</small></div><div id="featureFlow"></div><details class="feature-extra" ${f.comment ? 'open' : ''}><summary>文件原始注释</summary><pre class="feature-comment">${esc(f.comment || '未提取到文件头注释。可打开完整源码查看实现内说明。')}</pre></details><div class="feature-symbol-head"><h3>声明、签名与注释</h3><label>筛选符号<input id="featureSymbolSearch" type="search" value="${esc(symbolQuery)}" placeholder="名称、签名或原始注释"></label></div><p class="meta">文件 export 不等于 npm 公共 API。未显式写出的返回类型不做猜测；类成员单独列出。自动生成目录数据、压缩第三方 JS 与非 TS/JS 文件不提取声明。</p><div id="featureSymbols"></div><div class="pagination"><button id="featureSymbolPrev" class="quiet">上一页</button><span id="featureSymbolPages" class="meta"></span><button id="featureSymbolNext" class="quiet">下一页</button></div><details class="feature-extra"><summary>引用了什么 · ${outgoing.length} 条静态引用</summary>${outgoing.map(r => `<div class="feature-edge"><code>${esc(r.spec)}</code><small>${r.kind}${r.typeOnly ? '（类型）' : ''} · 第 ${r.line} 行</small>${r.target ? ref(r.target,1,'查看目标') : '<small>外部包或未解析目标</small>'}</div>`).join('') || '<p>未提取到静态 import / export-from。</p>'}</details><details class="feature-extra"><summary>被谁引用 · ${f.consumers.length} 条直接引用</summary>${f.consumers.map(r => `<div class="feature-edge">${ref(r.path,r.line)}<small>${r.kind}${r.typeOnly ? '（类型）' : ''} · 第 ${r.line} 行</small></div>`).join('') || '<p>未发现纳入扫描范围的直接引用；可能是入口、动态使用或间接加载。</p>'}</details><details class="feature-extra"><summary>同源功能 · ${f.features.length} 项</summary><div class="refs">${f.features.map(id => `<a class="chip" href="#functions/${id}">${esc(byId.get(id).title)}</a>`).join('')}</div></details>`;
    const flow = createReferenceFlow(file, f, data.sources, esc);
    const host = $('featureFlow');
    host.innerHTML = flow.render();
    host.addEventListener('click', event => {
      const button = event.target.closest('[data-flow-step]');
      if (button) { flow.step(Number(button.dataset.flowStep)); host.innerHTML = flow.render(); }
    });
    host.addEventListener('keydown', event => {
      const node = event.target.closest('[data-source]');
      if (node && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });
    $('featureSymbolSearch').addEventListener('input', () => { symbolQuery = $('featureSymbolSearch').value; symbolPage = 0; symbolRows(); });
    $('featureSymbolPrev').addEventListener('click', () => { symbolPage--; symbolRows(); });
    $('featureSymbolNext').addEventListener('click', () => { symbolPage++; symbolRows(); });
    symbolRows();
  }
  function symbolRows() {
    const q = symbolQuery.trim().toLowerCase();
    const rows = catalog.files[file].symbols.filter(s => !q || `${s.name} ${s.signature} ${s.comment}`.toLowerCase().includes(q));
    const pages = Math.max(1,Math.ceil(rows.length/30));
    symbolPage = Math.max(0,Math.min(symbolPage,pages-1));
    $('featureSymbols').innerHTML = rows.slice(symbolPage*30,(symbolPage+1)*30).map(s => `<details class="feature-symbol"><summary><span><b>${esc(s.name)}</b><small>${esc(s.kind)}${s.exported ? ' · 文件导出' : ''}${s.visibility ? ` · ${esc(s.visibility)}` : ''} · L${s.line}–${s.endLine}</small></span></summary><pre>${esc(s.signature)}</pre><dl class="feature-facts"><dt>输入参数</dt><dd>${s.inputs.length ? s.inputs.map(p => `<code>${esc(p)}</code>`).join('<br>') : '无参数声明 / 不适用'}</dd><dt>显式类型</dt><dd><code>${esc(s.output || '未显式标注 / 不适用；请读实现与类型推导')}</code></dd><dt>原始注释</dt><dd><pre class="feature-comment">${esc(s.comment || '该声明没有紧邻的前置注释，不依据命名推断行为。')}</pre></dd></dl>${ref(file,s.line,'定位此声明')}</details>`).join('') || '<div class="empty">没有匹配声明。此文件可能是资源或生成数据，可直接阅读全文。</div>';
    $('featureSymbolPages').textContent = `${rows.length} 条 · ${symbolPage+1} / ${pages}`;
    $('featureSymbolPrev').disabled = symbolPage === 0;
    $('featureSymbolNext').disabled = symbolPage >= pages-1;
  }
  function activate() {
    refresh(false);
    $('featureSearch').addEventListener('input', () => { query = $('featureSearch').value; clearTimeout(searchTimer); searchTimer = setTimeout(() => { if ($('featureMenu')) refresh(); },120); });
    for (const id of ['featureStatus','featureEvidence','featureModule']) $(id).addEventListener('change', () => { status = $('featureStatus').value; evidence = $('featureEvidence').value; moduleFilter = $('featureModule').value; refresh(); });
    $('featureReset').addEventListener('click', () => { query=''; status=''; evidence=''; moduleFilter=''; for(const id of ['featureSearch','featureStatus','featureEvidence','featureModule']) $(id).value=''; refresh(); });
  }
  return { render, activate, navigate, rememberMenu, search: q => catalog.features.filter(f => textOf(f).includes(q.toLowerCase())) };
}
