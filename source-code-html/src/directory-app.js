function createDirectoryBrowser(data, esc) {
  const directory = data.directory || { nodes: {}, stats: {} };
  const nodes = directory.nodes;
  const featureMap = new Map((data.catalog?.features || []).map(f => [f.id, f]));
  let selected = '', query = '', status = '', menuScroll = 0;
  const opened = new Set(['', 'packages', 'packages/coding-agent', 'packages/coding-agent/src']);
  const $ = id => document.getElementById(id);
  const go = path => `directory/${encodeURIComponent(path)}`;
  const source = (path, label = path, line = 0) => Object.hasOwn(data.sources, path) ? `<button class="ref" data-source="${esc(path)}" data-line="${line}">${esc(label)}</button>` : `<span class="meta">${esc(label)} · 未内嵌全文</span>`;
  function matches(node, q = query, filter = status) {
    return (!filter || node.status === filter) && (!q || `${node.path}\n${node.description}\n${node.featureTitles.join('\n')}`.toLowerCase().includes(q.toLowerCase().trim()));
  }
  function filteredPaths() {
    const visible = new Set();
    for (const node of Object.values(nodes)) if (matches(node)) {
      let path = node.path;
      while (path !== null) { visible.add(path); path = nodes[path].parent; }
    }
    return visible;
  }
  function rows() {
    const filtering = Boolean(query.trim() || status);
    const visible = filtering ? filteredPaths() : null;
    const label = { ready: '已初始化', pending: '待补充', review: '源码变化 · 待复核' };
    function row(path, depth) {
      const n = nodes[path];
      if (visible && !visible.has(path)) return '';
      const expanded = filtering || opened.has(path);
      return `<div class="directory-row ${selected === path ? 'selected' : ''}" style="--depth:${depth}" role="listitem"><div class="directory-node"><span class="directory-indent"></span>${n.kind === 'folder' ? `<button class="directory-toggle quiet" data-directory-toggle="${esc(path)}" aria-expanded="${expanded}" aria-label="${expanded ? '收起' : '展开'} ${esc(n.name)}" ${filtering ? 'disabled' : ''}>${expanded ? '−' : '+'}</button>` : '<span class="directory-file-mark" aria-hidden="true">·</span>'}<button class="directory-select" data-directory-select="${esc(path)}" aria-current="${selected === path ? 'true' : 'false'}"><strong>${esc(n.name)}${n.kind === 'folder' ? '/' : ''}</strong><small>${esc(n.description.split('\n')[0])}</small></button><span class="directory-state ${n.status}">${label[n.status]}</span></div></div>${n.kind === 'folder' && expanded ? n.children.map(child => row(child, depth + 1)).join('') : ''}`;
    }
    return nodes[''] ? row('', 0) : '';
  }
  function detail() {
    const n = nodes[selected] || nodes[''];
    if (!n) return '';
    const file = data.catalog && Object.hasOwn(data.catalog.files, n.path) ? data.catalog.files[n.path] : undefined;
    const crumbs = [];
    let path = n.path;
    while (path !== null) { crumbs.unshift(nodes[path]); path = nodes[path].parent; }
    const features = n.features.map(id => featureMap.get(id)).filter(Boolean);
    return `<nav class="directory-crumbs" aria-label="目录位置">${crumbs.map(c => `<button class="quiet" data-directory-select="${esc(c.path)}">${esc(c.name)}</button>`).join('<span>/</span>')}</nav><div class="eyebrow">${n.kind === 'folder' ? 'FOLDER / 文件夹' : 'FILE / 文件'}</div><h2>${esc(n.name)}</h2><p class="meta">${esc(n.path || '仓库根目录')}</p><div class="chips"><span class="chip">${n.status === 'pending' ? '待补充说明' : n.review ? '已有说明 · 源码变化待复核' : '已初始化说明'}</span>${n.kind === 'folder' ? `<span class="chip">${n.children.length} 个直接子节点 · ${n.fileCount} 个下属文件</span>` : `<span class="chip">${n.tracked ? 'Git 已跟踪' : '未跟踪的新文件'}</span><span class="chip">${n.lines === null ? '未收录全文快照' : `${n.lines} 行离线快照`}</span>`}</div><section class="section"><h3>作用描述</h3><div class="directory-description ${n.description ? '' : 'uninitialized'}">${esc(n.description)}</div>${n.description ? `<p class="meta">说明依据：${esc(n.basis)}<br>初始化版本：${esc(n.initializedCommit)}</p>` : '<p class="meta">此节点尚未初始化说明。描述保留为空，后续更新时补充。</p>'}${n.review ? '<div class="callout">当前源码指纹或关联功能与说明初始化时不同。已有说明已保留；已移除功能的详情链接不再显示，请结合当前源码复核。</div>' : ''}</section>${n.details.length ? `<section class="section"><h3>职责、入口与处理边界</h3>${n.details.map(d => `<article class="directory-capability"><h4>${esc(d.title)}</h4><p><b>入口 / 场景：</b>${esc(d.entry)}</p><p><b>处理 / 边界：</b>${esc(d.behavior)}</p><a href="#functions/${esc(d.feature)}">进入功能详情 →</a></article>`).join('')}</section>` : ''}${n.kind === 'folder' ? `<section class="section"><h3>直接子目录与文件</h3><div class="directory-children">${n.children.map(child => { const c = nodes[child]; return `<button class="quiet" data-directory-select="${esc(child)}"><b>${esc(c.name)}${c.kind === 'folder' ? '/' : ''}</b><small>${esc(c.description.split('\n')[0])}</small></button>`; }).join('')}</div></section>` : `<section class="section"><h3>源码与版本</h3>${source(n.path, '打开完整离线源码')}<p class="meta">快照 commit：${esc(data.meta.commit)}<br>文件 SHA-256：${esc(n.sourceHash || '未内嵌全文，未计算快照指纹')}</p></section>`}${features.length ? `<section class="section"><h3>关联功能${n.kind === 'folder' ? '（含下属文件）' : ''}</h3><div class="directory-links">${features.map(f => `<a href="#functions/${esc(f.id)}">${esc(f.title)}<small>${esc(f.evidence)}</small></a>`).join('')}</div></section>` : ''}${file ? `<section class="section"><h3>声明与原始注释</h3>${file.comment ? `<pre class="directory-comment">${esc(file.comment)}</pre>` : '<p class="meta">没有提取到文件头注释。</p>'}<p class="meta">${file.symbols.length} 个语法树声明；完整原文和签名可在源码或关联功能中查看。</p><details><summary>展开全部声明</summary>${file.symbols.map(s => `<div class="directory-symbol">${source(n.path, `${s.kind} ${s.name} · L${s.line}`, s.line)}${s.comment ? `<pre class="directory-comment">${esc(s.comment)}</pre>` : ''}</div>`).join('')}</details></section><section class="section"><h3>静态引用与直接关联测试</h3><p class="meta">仅表示可解析的静态依赖，不等同于运行时调用顺序。</p><h4>导入 / 再导出</h4>${file.imports.map(r => `<div class="file-row">${esc(r.kind)}${r.typeOnly ? ' · 类型' : ''} · ${esc(r.spec)} · L${r.line}${r.target ? ` ${source(r.target)}` : ' · 未解析到仓库文件'}</div>`).join('') || '<p class="meta">无已提取的引用。</p>'}<h4>引用方</h4>${file.consumers.map(r => `<div class="file-row">${source(r.path, r.path, r.line)}${r.typeOnly ? ' · 类型' : ''}</div>`).join('') || '<p class="meta">无索引范围内的直接引用方。</p>'}<h4>测试</h4>${file.tests.map(r => `<div class="file-row">${source(r.path, r.path, r.line)}</div>`).join('') || '<p class="meta">无已解析的直接关联测试。</p>'}</section>` : ''}${n.evidence.length ? `<section class="section"><h3>说明来源</h3><div class="refs">${n.evidence.map(p => source(p)).join('')}</div></section>` : ''}`;
  }
  function rememberMenu() { if ($('directoryTree')) menuScroll = $('directoryTree').scrollTop; }
  function updateTree() {
    const tree = $('directoryTree');
    if (!tree) return;
    const top = tree.scrollTop;
    tree.innerHTML = rows();
    tree.scrollTop = top;
    $('directoryCount').textContent = query.trim() || status ? `匹配 ${Object.values(nodes).filter(n => matches(n)).length} 个节点；同时显示祖先目录。` : `${directory.stats.files} 个文件 / ${directory.stats.folders} 个文件夹（含根目录）`;
  }
  function navigate(anchor) {
    let path;
    try { path = decodeURIComponent(anchor || ''); } catch { path = ''; }
    selected = Object.hasOwn(nodes, path) ? path : '';
    let parent = nodes[selected]?.parent;
    while (parent !== null && parent !== undefined) { opened.add(parent); parent = nodes[parent].parent; }
    if ($('directoryDetail')) { updateTree(); $('directoryDetail').innerHTML = detail(); }
  }
  function render(anchor) {
    navigate(anchor);
    return `<div class="hero-line"><div><div class="eyebrow">DIRECTORY / SOURCE ATLAS</div><h1>源码目录说明</h1><p class="lead">从完整文件树认识仓库，再沿职责、声明与引用深入源码。</p></div></div><div class="directory-summary"><span><b>${directory.stats.files}</b> 文件</span><span><b>${directory.stats.folders}</b> 文件夹</span><span><b>${directory.stats.ready}</b> 已初始化</span><span><b>${directory.stats.review}</b> 待复核</span><span><b>${directory.stats.pending}</b> 待补充</span></div><details class="callout"><summary>收录范围与说明维护规则</summary><p>${esc(directory.scope)}</p><p>已初始化说明复用已有中文包 / 功能讲解，文件的功能参与关系按精确路径归属生成；它不表示文件独自实现整个功能，也不表示所有文件已逐行审计。普通更新会保留已有说明，新节点的描述先留空。源码变化会标记待复核。</p></details><div class="directory-layout"><aside class="directory-menu"><label>搜索路径、作用或功能<input id="directorySearch" type="search" value="${esc(query)}" placeholder="例如 mcp、压缩或 agent-session"></label><label>说明状态<select id="directoryStatus"><option value="">全部节点</option>${[['ready','已初始化'],['pending','待补充'],['review','源码变化待复核']].map(([value,title]) => `<option value="${value}" ${status === value ? 'selected' : ''}>${title}</option>`).join('')}</select></label><div class="directory-controls"><button class="quiet" id="directoryExpand">展开全部</button><button class="quiet" id="directoryCollapse">收起全部</button><button class="quiet" id="directoryLocate">定位当前</button></div><p id="directoryCount" class="meta"></p><div id="directoryTree" role="list" aria-label="仓库目录树">${rows()}</div></aside><article id="directoryDetail" aria-label="文件夹与文件说明">${detail()}</article></div>`;
  }
  function activate() {
    $('directoryTree').scrollTop = menuScroll;
    updateTree();
    $('directorySearch').addEventListener('input', () => { query = $('directorySearch').value; updateTree(); });
    $('directoryStatus').addEventListener('change', () => { status = $('directoryStatus').value; updateTree(); });
    $('directoryExpand').addEventListener('click', () => { Object.values(nodes).filter(n => n.kind === 'folder').forEach(n => opened.add(n.path)); updateTree(); });
    $('directoryCollapse').addEventListener('click', () => { opened.clear(); opened.add(''); updateTree(); });
    $('directoryLocate').addEventListener('click', () => {
      query = ''; status = ''; $('directorySearch').value = ''; $('directoryStatus').value = '';
      navigate(encodeURIComponent(selected));
      $('directoryTree').querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
    });
    $('main').removeEventListener('click', handleClick);
    $('main').addEventListener('click', handleClick);
  }
  function handleClick(event) {
    const toggle = event.target.closest('[data-directory-toggle]');
    if (toggle && !query.trim() && !status) {
      const path = toggle.dataset.directoryToggle;
      if (opened.has(path)) opened.delete(path); else opened.add(path);
      updateTree();
    }
    const select = event.target.closest('[data-directory-select]');
    if (select) {
      const next = `#${go(select.dataset.directorySelect)}`;
      if (location.hash === next) navigate(encodeURIComponent(select.dataset.directorySelect)); else location.hash = next;
    }
  }
  return { render, activate, navigate, rememberMenu, search(q) { return Object.values(nodes).filter(n => matches(n, q, '')); } };
}
