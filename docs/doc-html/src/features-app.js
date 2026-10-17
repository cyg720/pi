/* Feature browser only renders the generated local catalog. No filesystem or network access. */
function createFeatureBrowser(data, esc) {
  const catalog = data.catalog;
  const $ = id => document.getElementById(id);
  const allFeatures = [...(catalog.capabilities || []), ...catalog.features];
  const allModules = [...(catalog.capabilityModules || []), ...catalog.modules];
  const byId = new Map(allFeatures.map(f => [f.id, f]));
  const modules = new Map(allModules.map(m => [m.id, m]));
  const commitMap = new Map(data.commits.map(c => [c.hash, c]));
  const commitOrder = new Map(data.commits.map((c, i) => [c.hash, i]));
  const searchIndex = new Map();
  const fileSearchIndex = new Map();
  let query = '', status = '', evidence = '', moduleFilter = '', updateFilter = '';
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
    if (!searchIndex.has(f.id)) searchIndex.set(f.id, [f.id, ...(f.capabilityIds || []), f.title, f.purpose, f.entry, f.behavior, f.status, f.evidence, f.update].join(' ').toLowerCase());
    return searchIndex.get(f.id);
  }
  function includesText(f, term) {
    if (textOf(f).includes(term)) return true;
    return f.files.some(p => {
      if (!fileSearchIndex.has(p)) fileSearchIndex.set(p, `${p} ${catalog.files[p].symbols.map(s => s.name).join(' ')}`.toLowerCase());
      return fileSearchIndex.get(p).includes(term);
    });
  }
  function matching() {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return allFeatures.filter(f => (!status || f.status === status) && (!evidence || f.evidence === evidence) && (!moduleFilter || f.module === moduleFilter) && (!updateFilter || f.update === updateFilter) && terms.every(t => includesText(f, t)));
  }
  function capabilityHtml() {
    const coverage = catalog.capabilityCoverage;
    if (!coverage) return '';
    return `<details class="feature-edition capability-coverage"><summary>Markdown 对照完整 · ${coverage.total} 个稳定编号 · 无遗漏</summary><p>编号、功能说明、入口、状态与业务顺序直接来自原清单。${coverage.mapped} 项映射到源码专题；${coverage.documentationOnly.length} 项为安装、部署或平台文档方案。与原有源码专题属于不同视角，不相加为独立业务功能数。</p>${ref(coverage.source, 1, '打开完整 Markdown 清单')}<p class="meta">清单 SHA-256：${esc(coverage.sha256)}</p><details><summary>能力边界与容易混淆的地方 · ${coverage.boundaries.length} 项</summary>${coverage.boundaries.map(b => `<article class="capability-boundary"><h4>${esc(b.title)}</h4><p>${esc(b.text)}</p><p>${esc(b.impact)}</p>${ref(coverage.source, b.line, '查看原文与依据')}</article>`).join('')}</details></details>`;
  }
  function editionHtml() {
    const edition = catalog.edition;
    if (!edition) return '';
    return `<details class="feature-edition"><summary>版本更新 · ${esc(data.meta.version)} · 补充 ${edition.addedExplanations.length} 项中文解说</summary><p>按本地源码快照 ${esc(edition.from.slice(0,9))} → ${esc(edition.to.slice(0,9))} 对照。版本号来自包清单；当前提交可能包含该版本之后的未发布修改。</p><div class="chips"><span class="chip">新增 ${edition.addedFiles.length} 个范围内文件</span><span class="chip">变动 ${edition.changedFiles.length} 个文本文件</span><span class="chip">移出 ${edition.removedFiles.length} 个范围内文件</span></div><p>“本次补充”表示导览新增条目，包含此前漏讲的能力；“来源更新”表示已有条目的源码指纹改变，不代表该功能全是新增代码。静态索引不推断变动的业务含义。</p><details><summary>本次补充的中文解说</summary><div class="edition-links">${edition.addedExplanations.map(id => { const f = byId.get(id); return `<a href="#functions/${esc(id)}"><small>${esc(modules.get(f.module).title)}</small>${esc(f.title)}</a>`; }).join('')}</div></details><details><summary>从当前目录移出的旧条目 · ${edition.retiredFeatures.length} 项</summary><p>以下旧条目的实现文件已删除或被重新组织，原讲解不再作为当前功能列出。Agent 的消息/工具循环与 Durable 的持久 Harness 分别在对应模块讲解。</p><div class="edition-retired">${edition.retiredFeatures.map(f => `<div><b>${esc(f.title)}</b><small>${f.files.map(esc).join('<br>')}</small></div>`).join('') || '<p>没有移出的旧条目。</p>'}</div></details></details>`;
  }
  function render(id) {
    active = byId.has(id) ? id : '';
    const f = byId.get(active);
    if (f && !f.files.includes(file)) { file = f.files[0]; symbolQuery = ''; symbolPage = 0; }
    return `<div class="feature-heading"><div class="eyebrow">全域功能地图</div><h1>功能清单详情</h1><p class="lead">按稳定编号浏览业务功能，再沿关联源码专题、引用图与测试深入实现。</p></div><div class="feature-metrics"><span><b>${catalog.capabilityModules?.length || catalog.modules.length}</b> 业务模块</span><span><b>${catalog.capabilities?.length || catalog.stats.documented}</b> 编号功能</span><span><b>${catalog.stats.features}</b> 源码专题与索引</span><span><b>${catalog.stats.files}</b> 归属文件</span><span><b>${catalog.stats.symbols.toLocaleString()}</b> 代码声明</span></div><details class="feature-scope"><summary>覆盖范围与证据说明 · ${catalog.stats.unassigned} 个未归属文件</summary><p>${esc(catalog.scope)}</p><p>“中文能力解说”是按源码入口/仓库文档整理的说明；“源码规则归类”按提供商工厂和示例入口自动生成；“源码覆盖索引”列出尚未单独解释的支撑实现。文件覆盖率不代表所有业务语义已人工确认。</p><p>导入/再导出是静态文件引用，不是精确调用图。测试关联仅表示测试直接导入相关源码，不代表该功能被完整测试。原始注释保留原语言，不编造缺失注释。</p></details>${capabilityHtml()}${editionHtml()}<div class="feature-filters"><label>查找功能、入口或符号<input id="featureSearch" type="search" value="${esc(query)}" placeholder="例如：UI-01、DUR-62、压缩、read"></label><label>大模块<select id="featureModule"><option value="">全部模块</option>${allModules.map(m => `<option value="${m.id}" ${moduleFilter === m.id ? 'selected' : ''}>${esc(m.title)}</option>`).join('')}</select></label><label>能力类别<select id="featureStatus"><option value="">全部类别</option>${[...new Set(allFeatures.map(f => f.status))].map(s => `<option ${status === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label><label>说明依据<select id="featureEvidence"><option value="">全部依据</option>${[...(catalog.capabilities ? ['Markdown 功能说明'] : []), '中文能力解说','源码规则归类','源码覆盖索引'].map(s => `<option ${evidence === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label><label>更新状态<select id="featureUpdate"><option value="">全部状态</option>${["本次补充","来源更新","已有条目"].map(s => `<option ${updateFilter === s ? "selected" : ""}>${s}</option>`).join("")}</select></label><button id="featureReset" class="quiet">清除筛选</button></div><p id="featureCount" class="meta" role="status"></p><div class="feature-layout"><nav id="featureMenu" class="feature-menu" aria-label="大模块与功能"></nav><div id="featurePanel" class="feature-panel"></div></div>`;
  }
  function refresh(preserve = true) {
    if (preserve) rememberMenu();
    const results = matching();
    $('featureCount').textContent = `匹配 ${results.length} / ${allFeatures.length} 个可导航条目 · 编号功能按 Markdown 顺序；源码专题保留原阅读顺序，两类数量不可相加为独立功能数`;
    $('featureMenu').innerHTML = `<a class="feature-home" href="#functions">全域概览</a>${allModules.map(m => {
      const rows = results.filter(f => f.module === m.id);
      if (!rows.length) return '';
      const open = query || moduleFilter || menuOpen.get(m.id) || byId.get(active)?.module === m.id;
      return `${m.id === allModules[0]?.id ? '<p class="feature-menu-label">业务功能 · 稳定编号</p>' : m.id === catalog.modules[0]?.id && catalog.capabilities ? '<p class="feature-menu-label">源码专题 · 保留原入口</p>' : ''}<details data-module="${m.id}" ${open ? 'open' : ''}><summary>${esc(m.title)}<span>${rows.length}</span></summary>${rows.map(f => `<a href="#functions/${f.id}" data-feature="${f.id}" class="${f.id === active ? 'selected' : ''}" ${f.id === active ? 'aria-current="page"' : ''}>${esc(f.title)}<small>${esc(f.status)}${f.update && f.update !== "已有条目" ? ` · ${esc(f.update)}` : ""}</small></a>`).join('')}</details>`;
    }).join('') || '<p>没有匹配功能。</p>'}`;
    $('featureMenu').scrollTop = menuScroll;
    updatePanel(results);
  }
  function updatePanel(results) {
    const selected = byId.get(active);
    if (selected) {
      $('featurePanel').innerHTML = `${!results.some(f => f.id === active) ? '<div class="callout">当前详情不在筛选结果内。可清除筛选，或从左侧选择其他功能。</div>' : ''}${detail(selected)}`;
      if (selected.files.length) activateFile();
    } else $('featurePanel').innerHTML = overview(results);
  }
  function overview(results) {
    if (!results.length) return '<div class="empty">没有匹配项。尝试其他关键词，或清除筛选。</div>';
    return `<div class="feature-overview"><h2>项目能力总览</h2><p>编号功能逐项对应 Markdown；源码专题承接已有实现、引用与测试。业务说明和源码索引采用不同粒度。</p>${allModules.map(m => {
      const rows = results.filter(f => f.module === m.id);
      return rows.length ? `<section class="feature-module"><header><h3>${esc(m.title)}</h3><span class="chip">${m.fileCount} 个文件</span></header><p>${esc(m.description)}</p><div>${rows.map(f => `<a href="#functions/${f.id}" class="feature-overview-row"><strong>${esc(f.title)}</strong><span>${esc(f.purpose)}</span><small>${f.files.length} 个来源文件 · ${esc(f.evidence)}${f.update ? ` · ${esc(f.update)}` : ""}</small></a>`).join('')}</div></section>` : '';
    }).join('')}</div>`;
  }
  function detail(f) {
    const m = modules.get(f.module);
    const files = f.files.map(p => catalog.files[p]);
    const crosswalk = f.stableId ? `<section class="capability-crosswalk"><h3>稳定编号与来源映射</h3><p><b>${esc(f.stableId)}</b> · ${esc(f.status)} · ${ref(catalog.capabilityCoverage.source, f.sourceLine, '定位 Markdown 原始条目 · L' + f.sourceLine)}</p><p>${f.relatedFeatures.length ? '关联源码专题提供文件级阅读线索；下方引用图和测试复用这些专题的真实数据。' : '文档方案：查看来源原文；未虚构源码调用与测试关联。'}</p><div class="refs">${f.relatedFeatures.map(id => `<a class="chip" href="#functions/${id}">${esc(byId.get(id).title)}</a>`).join('')}</div></section>` : f.capabilityIds?.length ? `<section class="capability-crosswalk"><h3>本专题关联的编号子功能 · ${f.capabilityIds.length}</h3><div class="capability-links">${f.capabilityIds.map(id => `<a href="#functions/${id}">${esc(byId.get(id).title)}</a>`).join('')}</div></section>` : '';
    const history = f.commits.slice().sort((a,b) => commitOrder.get(a) - commitOrder.get(b));
    return `<article class="feature-detail"><div class="feature-detail-title"><small>${esc(m.title)} / ${esc(f.status)}</small><h2>${esc(f.title)}</h2><div class="chips"><span class="chip">${esc(f.evidence)}</span>${f.update ? `<span class="chip feature-update">${esc(f.update)}</span>` : ""}<span class="chip">${f.files.length} 文件</span><span class="chip">${files.reduce((n,r) => n + r.symbols.length,0)} 声明</span><span class="chip">${f.tests.length} 直接引用测试文件</span></div></div>${crosswalk}<section><h3>作用与使用场景</h3><p>${esc(f.purpose)}</p><dl class="feature-facts"><dt>入口 / 触发</dt><dd>${esc(f.entry)}</dd><dt>处理与边界</dt><dd>${esc(f.behavior)}</dd><dt>实现来源</dt><dd>${esc(m.root)}<br>版本 ${esc(data.meta.version || "未知")} · ${esc(data.meta.commit.slice(0,12))}；${data.meta.status ? '包含工作区修改' : '已跟踪源码快照'}</dd><dt>参考资料</dt><dd>${f.docs.map(p => ref(p,1,p.replace(/^packages\//,''))).join('')}</dd></dl></section>${f.files.length ? `<section><h3>来源文件与实现细节</h3><label class="feature-file-label">选择实现 / 资源文件<select id="featureFile">${f.files.map(p => `<option value="${esc(p)}" ${p === file ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></label><div id="featureFileDetail"></div></section>` : '<section><h3>文档方案与使用依据</h3><p>本项通过上方原始资料阅读，不生成虚构的实现、引用图或测试。</p></section>'}<details class="feature-extra"><summary>测试依据 · ${f.tests.length} 份直接引用测试</summary><p>只收录能解析的import/再导出与字面量动态导入；间接覆盖、计算路径动态加载和字符串引用不在这个计数中。本次未因此运行模型或外部服务。</p><div class="refs">${f.tests.map(p => ref(p)).join('') || '<p>未找到直接静态引用测试；不等于没有测试。</p>'}</div></details><details class="feature-extra"><summary>相关演进 · ${history.length} 条路径关联提交</summary><p>按当前文件路径匹配 Git numstat，不追溯重命名；不是功能首次引入日期。下列展示最近 12 条，完整原文可在 Git 时间线检索。</p>${history.slice(0,12).map(hash => { const c = commitMap.get(hash); return `<div class="feature-history"><small>${esc(c.date.slice(0,10))} · ${hash.slice(0,9)}</small><p>${esc(c.zh)}</p><code>${esc(c.subject)}</code><button class="quiet" data-feature-commit="${hash}">在时间线查看</button></div>`; }).join('') || '<p>本地历史中未找到路径变动记录。</p>'}</details><div class="end-nav"><a href="#functions">← 返回全域概览</a><span class="meta">功能定位：#functions/${esc(f.id)}</span></div></article>`;
  }
  function activateFile() {
    $('featureFile').addEventListener('change', () => { file = $('featureFile').value; symbolQuery = ''; symbolPage = 0; fileDetail(); });
    fileDetail();
  }
  function fileDetail() {
    const f = catalog.files[file];
    const outgoing = f.imports;
    $('featureFileDetail').innerHTML = `<div class="feature-file-bar">${ref(file)}<small>${f.lines ?? '二进制'} ${f.lines === null ? '' : '行'} · ${f.resource ? '资源 / 数据 / 非 TS 实现' : 'TS/JS 实现'} · ${f.symbols.length} 个声明</small></div><div id="featureFlow"></div><details class="feature-extra" ${f.comment ? 'open' : ''}><summary>文件原始注释</summary><pre class="feature-comment">${esc(f.comment || '未提取到文件头注释。可打开完整源码查看实现内说明。')}</pre></details><div class="feature-symbol-head"><h3>声明、签名与注释</h3><label>筛选符号<input id="featureSymbolSearch" type="search" value="${esc(symbolQuery)}" placeholder="名称、签名或原始注释"></label></div><p class="meta">文件 export 不等于 npm 公共 API。未显式写出的返回类型不做猜测；类成员单独列出。自动生成目录数据、压缩第三方 JS 与非 TS/JS 文件不提取声明。</p><div id="featureSymbols"></div><div class="pagination"><button id="featureSymbolPrev" class="quiet">上一页</button><span id="featureSymbolPages" class="meta"></span><button id="featureSymbolNext" class="quiet">下一页</button></div><details class="feature-extra"><summary>引用了什么 · ${outgoing.length} 条静态引用</summary>${outgoing.map(r => `<div class="feature-edge"><code>${esc(r.spec)}</code><small>${r.kind}${r.typeOnly ? '（类型）' : ''} · 第 ${r.line} 行</small>${r.target ? ref(r.target,1,'查看目标') : '<small>外部包或未解析目标</small>'}</div>`).join('') || '<p>未提取到 import / export-from / 字面量动态导入。</p>'}</details><details class="feature-extra"><summary>被谁引用 · ${f.consumers.length} 条直接引用</summary>${f.consumers.map(r => `<div class="feature-edge">${ref(r.path,r.line)}<small>${r.kind}${r.typeOnly ? '（类型）' : ''} · 第 ${r.line} 行</small></div>`).join('') || '<p>未发现纳入扫描范围的直接引用；可能是入口、动态使用或间接加载。</p>'}</details><details class="feature-extra"><summary>同源功能 · ${f.features.length + (f.capabilities?.length || 0)} 项</summary><div class="refs">${[...f.features, ...(f.capabilities || [])].map(id => `<a class="chip" href="#functions/${id}">${esc(byId.get(id).title)}</a>`).join('')}</div></details>`;
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
    for (const id of ['featureStatus','featureEvidence','featureModule','featureUpdate']) $(id).addEventListener('change', () => { status = $('featureStatus').value; evidence = $('featureEvidence').value; moduleFilter = $('featureModule').value; updateFilter = $('featureUpdate').value; refresh(); });
    $('featureReset').addEventListener('click', () => { query=''; status=''; evidence=''; moduleFilter=''; updateFilter=''; for(const id of ['featureSearch','featureStatus','featureEvidence','featureModule','featureUpdate']) $(id).value=''; refresh(); });
  }
  return { render, activate, navigate, rememberMenu, search: q => allFeatures.filter(f => includesText(f, q.toLowerCase())) };
}
