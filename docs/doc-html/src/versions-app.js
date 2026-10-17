function createVersionBrowser(data, esc) {
  'use strict';
  const versions = data.versions;
  const items = versions.items;
  const byId = new Map(items.map(v=>[v.id,v]));
  const commits = new Map(data.commits.map(c=>[c.hash,c]));
  const labels = {breaking:'不兼容变更',highlights:'产品重点',added:'新增',changed:'调整',fixed:'修复',removed:'移除',deprecated:'弃用',security:'安全',performance:'性能',other:'其他记录'};
  const tabs = [['overview','中文导读'],['changes','各包变更'],['upgrade','兼容与升级'],['code','源码关联'],['commits','提交记录'],['sources','资料依据']];
  const state = {selected:items[0]?.id,tab:'overview',query:'',package:'',risk:false,scroll:0,page:0,compare:''};
  const $ = id=>document.getElementById(id);
  const display = id=>id==='Unreleased' ? '未发布改动' : `v${id}`;
  const counts = value=>Object.entries(value).filter(([,count])=>count).map(([key,count])=>`${labels[key] || key} ${count}`).join(' · ') || '未单列条目';
  const ref = (path,line,label)=>`<button class="ref" data-source="${esc(path)}" data-line="${line || 1}">${esc(label || path)}</button>`;
  const anchor = (id,tab,label,extra='')=>`<a href="#versions/${esc(id)}/${tab}" ${extra}>${esc(label)}</a>`;
  const searchText = new Map(items.map(v=>[v.id,`${v.id} ${v.dates.join(' ')} ${JSON.stringify(v.notes || '')} ${v.packages.map(p=>`${p.id} ${p.en?.body || ''} ${p.zh?.body || ''}`).join(' ')}`.toLowerCase()]));

  function inline(text, path) {
    const pattern = /`([^`\n]+)`|\*\*([^*\n]+)\*\*|\[([^\]\n]+)\]\(([^\s)]+)\)/g;
    let html = '', last = 0;
    for (const m of text.matchAll(pattern)) {
      html += esc(text.slice(last,m.index));
      if (m[1]) html += `<code>${esc(m[1])}</code>`;
      else if (m[2]) html += `<strong>${esc(m[2])}</strong>`;
      else if (/^https?:\/\//i.test(m[4])) html += `<a href="${esc(m[4])}" target="_blank" rel="noopener noreferrer">${esc(m[3])}<span class="sr-only">（外部链接，需联网）</span></a>`;
      else {
        const parts = path.split('/').slice(0,-1);
        for (const part of m[4].split('#')[0].split('/')) { if (part === '..') parts.pop(); else if (part && part !== '.') parts.push(part); }
        const target = parts.join('/');
        html += Object.hasOwn(data.sources,target) ? ref(target,1,m[3]) : `${esc(m[3])} <code>${esc(m[4])}</code>`;
      }
      last = m.index+m[0].length;
    }
    return html+esc(text.slice(last));
  }

  function markdown(text,path) {
    const result = [];
    let fence = '', code = [], paragraph = [];
    const flush = ()=>{ if (paragraph.length) result.push(`<p>${inline(paragraph.join('\n'),path)}</p>`); paragraph=[]; };
    for (const line of text.split('\n')) {
      const marker = line.match(/^\s*(`{3,}|~{3,})/);
      if (fence) {
        if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && /^\s*(`+|~+)\s*$/.test(line)) {result.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`); fence='';code=[];}
        else code.push(line);
      } else if (marker) {flush();fence=marker[1];}
      else if (!line.trim()) flush();
      else if (/^#{2,6}\s/.test(line)) {flush();result.push(`<h4>${inline(line.replace(/^#+\s/,''),path)}</h4>`);}
      else if (/^\s*[-*+]\s/.test(line)) {flush();result.push(`<p class="version-bullet">${inline(line.replace(/^\s*[-*+]\s/,''),path)}</p>`);}
      else paragraph.push(line);
    }
    flush();
    if (fence) result.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
    return result.join('');
  }

  function filtered() {
    const terms = state.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter(v=>(!state.package || v.packages.some(p=>p.id===state.package)) && (!state.risk || v.risk) && terms.every(q=>searchText.get(v.id).includes(q)));
  }

  function menu() {
    const matches = filtered();
    return `<div class="version-list-count" role="status">${matches.length} / ${items.length} 个版本${!matches.some(v=>v.id===state.selected) ? ' · 当前详情不在筛选结果中' : ''}</div>${matches.map(v=>anchor(v.id,state.tab,display(v.id),`class="version-item ${v.id===state.selected ? 'active' : ''}" data-version="${esc(v.id)}" ${v.id===state.selected ? 'aria-current="page"' : ''}` ).replace('</a>',`<small>${esc(v.dates.join(' / ') || (v.id==='Unreleased' ? '当前工作区' : '未记录发布日期'))} · ${v.recordCount} 条</small><span>${esc(v.notes?.title || `${v.packages.length} 个包的版本记录`)}</span>${v.risk ? '<em>含不兼容 / 移除 / 安全记录</em>' : ''}</a>`)).join('') || '<div class="empty">没有匹配版本。尝试清除条件。</div>'}`;
  }

  function overview(v) {
    const notes = v.notes;
    const activePackages = v.packages.filter(p=>!p.empty);
    return `<section class="version-section"><div class="eyebrow">VERSION BRIEF / 阅读定位</div><h2>${esc(notes?.title || `${display(v.id)} · 变更记录导读`)}</h2><p>${esc(notes?.intro || `本版收录 ${v.packages.length} 个包的日志章节，其中 ${activePackages.length} 个包单列变更。${counts(v.counts)}。先按自己使用的包阅读，再检查不兼容或移除记录，最后用提交范围追查实现。此概述由日志元数据生成，完整内容在“各包变更”。`)}</p>${notes?.audience ? `<p><strong>重点读者：</strong>${esc(notes.audience)}</p>` : ''}<div class="version-metrics"><div><b>${v.packages.length}</b><span>包日志章节</span></div><div><b>${v.recordCount}</b><span>顶层条目（含重复重点）</span></div><div><b>${v.commitIds.length}</b><span>本地范围提交</span></div><div><b>${v.packages.filter(p=>p.zh).length}</b><span>有中文参考的包</span></div></div><p class="meta">${esc(counts(v.counts))}。章节 / 条目 / 提交不是独立功能数量；New Features 与 Added 可能重复描述同一能力。</p></section>
      ${notes ? `<section class="version-section"><h2>重点变化：原来 → 现在 → 实际影响</h2><p class="meta">以下为选定重点的中文解说；不代替全部包记录，不表示已逐条审查本版所有补丁。</p>${notes.points.map((point,i)=>`<article class="version-note"><div class="eyebrow">${String(i+1).padStart(2,'0')} / ${esc(point.package)}</div><h3>${esc(point.title)}</h3><dl><dt>原来 / 问题</dt><dd>${esc(point.before)}</dd><dt>现在 / 变化</dt><dd>${esc(point.after)}</dd><dt>为什么关注</dt><dd>${esc(point.why)}</dd><dt>建议检查</dt><dd>${esc(point.action)}</dd></dl>${ref(point.path,point.line,'定位本版原文依据')}</article>`).join('')}</section>` : '<div class="callout">本版尚未编写专题中文解说。下方包维度概述来自记录统计；如有同版本中文日志，可在“各包变更”阅读。没有对应中文资料时保留英文原文。</div>'}
      <section class="version-section"><h2>包维度速览</h2>${packageTable(v)}<p>${anchor(v.id,'changes','展开全部包变更 →')}</p></section>`;
  }

  function packageTable(v) {
    return `<div class="table-wrap"><table><thead><tr><th>包</th><th>本版记录</th><th>阅读提示</th></tr></thead><tbody>${v.packages.map(p=>`<tr><td>${esc(p.id)}${!p.active ? '<small> · 历史资料</small>' : ''}</td><td>${esc(counts(p.counts))}</td><td>${p.empty ? '本包本版未单列变更；不代表源码没有变化。' : p.risk ? '先核对不兼容、移除或安全记录，再读新增与修复。' : '先对照自身使用场景，再追踪新增、调整与修复的原文。'}${p.en ? '' : ' 仅有中文历史资料，未找到当前英文对应章节。'}</td></tr>`).join('') || '<tr><td colspan="3">只有本地标签，没有当前变更日志章节。</td></tr>'}</tbody></table></div>`;
  }

  function changes(v) {
    return `<section class="version-section"><h2>各包完整变更记录</h2><p>英文来自本版原始变更日志；已有中文资料独立展示，可能滞后，不与英文条目逐项强行配对。展开包即可阅读全文；点击来源可打开整份离线文件。</p><p class="meta">左侧包筛选用于筛选版本，右侧始终保留所选版本的全部包，便于发现跨包影响。记录中的外部链接需要网络；源码与文档快照离线可读。</p>${v.packages.map(p=>`<details class="version-package" ${!p.empty ? 'open' : ''}><summary><strong>${esc(p.id)}</strong> <span>${esc(counts(p.counts))}</span>${!p.active ? ' · 当前已无包清单' : ''}</summary><div class="version-package-body"><p class="meta">当前包职责参考：${esc(p.description)}（不代表本历史版本的职责完全相同。）</p>${p.empty ? '<div class="callout">原始章节为空：只记录了版本标题，不能据此断言本版没有源码改动。</div>' : ''}${p.zh ? `<details class="version-language" open><summary>已有中文参考 · 可能滞后</summary><div class="version-markdown">${markdown(p.zh.body,p.zh.path) || '<p>中文章节未单列内容。</p>'}</div>${ref(p.zh.path,p.zh.line,'中文日志 · 本版位置')}</details>` : '<p class="meta">没有同版本中文日志；请结合中文导读与下方完整原文阅读。</p>'}${p.en ? `<details class="version-language" ${p.zh ? '' : 'open'}><summary>英文原始记录 · ${p.en.sections.length} 个分类</summary><div class="version-markdown">${markdown(p.en.body,p.en.path) || '<p>本章没有单列条目。</p>'}</div>${ref(p.en.path,p.en.line,'英文日志 · 本版位置')}</details>` : '<p class="meta">当前仓库没有此版本的英文日志章节。</p>'}</div></details>`).join('') || '<div class="empty">本版只有标签记录；可从提交记录查看可用历史。</div>'}</section>`;
  }

  function upgrade(v) {
    const risks = v.packages.flatMap(p=>(p.en || p.zh).sections.filter(s=>['breaking','removed','deprecated','security'].includes(s.category)).map(s=>({p,s,source:p.en || p.zh})));
    const compare = byId.get(state.compare || v.previous);
    return `<section class="version-section"><h2>兼容性与升级检查</h2><p>先确定自己跨越了哪些版本，再逐版检查接口和配置变化。补丁号也可能有 Breaking Changes；没有该标题也不能作为完全兼容的保证。下列检查是阅读建议，不会自动修改配置或执行升级。</p><ol><li>记录自己的包版本、安装方式和定制入口；当前工作区包清单见“资料依据”。</li><li>逐版查看不兼容、移除和弃用记录，按实际使用到的 API / 配置项缩小范围。</li><li>对照各包完整记录及源码，覆盖成功、取消、错误、恢复与旧数据读取等相关场景。</li><li>按“本地开发说明”在隔离环境验证自己的改造，确认后再决定部署。</li></ol><p><a href="#development">打开本地开发说明 →</a></p><div class="callout">跨多个版本升级时，要同时读中间版本。本页比较统计只对比两版各自的日志条目，不是累计升级报告或代码差异。</div></section>
      <section class="version-section"><h2>本版必须优先核对的原始记录</h2>${risks.map(({p,s,source})=>`<article class="version-note"><h3>${esc(p.id)} · ${esc(labels[s.category])}</h3><div class="version-markdown">${markdown(s.body,source.path)}</div>${ref(source.path,s.line,'定位分类原文')}</article>`).join('') || '<p>当前本版日志未单列不兼容 / 移除 / 弃用 / 安全分类，请继续检查调整与修复的具体行为。</p>'}</section>
      <section class="version-section"><h2>两版记录对照</h2><label>比较对象<select id="versionCompare"><option value="">${v.previous ? `默认：v${esc(v.previous)}` : '请选择版本'}</option>${items.filter(i=>i.id!==v.id).map(i=>`<option value="${esc(i.id)}" ${state.compare===i.id ? 'selected' : ''}>${esc(display(i.id))}</option>`).join('')}</select></label><div id="versionComparison">${comparison(v,compare)}</div></section>`;
  }

  function comparison(v,other) {
    if (!other || other.id===v.id) return '<p class="meta">请选择另一个版本查看包与分类的记录数。</p>';
    const packageIds = [...new Set([...v.packages,...other.packages].map(p=>p.id))].sort();
    return `<p>${esc(display(other.id))} ↔ ${esc(display(v.id))}；数值增加不等于功能增加，缺少记录不等于包已删除。</p><div class="table-wrap"><table><thead><tr><th>包</th><th>${esc(display(other.id))}</th><th>${esc(display(v.id))}</th></tr></thead><tbody>${packageIds.map(id=>`<tr><td>${esc(id)}</td><td>${esc(other.packages.some(p=>p.id===id) ? counts(other.packages.find(p=>p.id===id).counts) : '无对应章节')}</td><td>${esc(v.packages.some(p=>p.id===id) ? counts(v.packages.find(p=>p.id===id).counts) : '无对应章节')}</td></tr>`).join('')}</tbody></table></div>${anchor(other.id,'upgrade','打开比较版本的兼容性记录 →')}`;
  }

  function code(v) {
    const touched = new Set(v.commitIds.flatMap(hash=>(commits.get(hash)?.files || []).map(f=>f.path)));
    return `<section class="version-section"><h2>从版本回到当前源码</h2><p>以下链接打开当前导览快照 ${esc(data.meta.commit.slice(0,9))}，不是历史版本的源码。版本提交范围内的文件名用于建立静态阅读线索；关联测试被收录不表示它已运行或已证明某个版本正确。</p><div class="callout">本版 ${touched.size} 个路径出现在常规提交文件统计中。合并提交的 numstat 可能没有文件，重命名按既有时间线数据处理，因此不将此列表称为完整版本 diff。</div>${v.packages.map(p=>{
      const files = [...touched].filter(path=>path.startsWith(`packages/${p.id}/`) && Object.hasOwn(data.sources,path)).sort();
      const tests = files.filter(path=>/\/(test|tests)\/|\.test\./.test(path));
      const currentPackage = data.packages.find(pkg=>pkg.path===p.id);
      return `<article class="version-note"><h3>${esc(p.id)}</h3><p>${currentPackage ? `<a href="#packages/${esc(p.id)}">当前 package 教程</a> · <a href="#directory/${encodeURIComponent(`packages/${p.id}`)}">当前源码目录</a>` : '当前无此包清单，请以历史资料与 Git 为准。'}</p><details><summary>提交涉及且已收录的当前快照 · ${files.length} 份 / 其中测试 ${tests.length} 份</summary><div class="version-files">${files.map(path=>ref(path,1,path)).join('') || '<p>没有匹配的当前快照；文件可能已移除、未收录，或本版没有可用标签范围。</p>'}</div></details></article>`;
    }).join('')}<p>更细的静态引用图、稳定功能编号与关联测试仍由现有功能清单提供：</p><a href="#functions">打开功能清单详情 →</a></section>`;
  }

  function commitRows(v) {
    const pageCount = Math.max(1,Math.ceil(v.commitIds.length/25));
    state.page = Math.max(0,Math.min(state.page,pageCount-1));
    return `<p class="meta">${v.commitIds.length} 条 · ${state.page+1} / ${pageCount} 页</p>${v.commitIds.slice(state.page*25,(state.page+1)*25).map(hash=>{
      const c = commits.get(hash);
      return `<article class="version-note"><small>${esc(c.date.slice(0,10))} · ${esc(c.hash.slice(0,10))} · ${esc(c.author)}</small><h3>${esc(c.subject)}</h3><span class="badge">${c.curated ? '已有中文提交解说' : '自动元数据中文概述'}</span><p>${esc(c.zh)}</p><button class="ref" data-feature-commit="${esc(hash)}">查看完整说明、父提交与文件列表</button></article>`;
    }).join('') || '<p>没有可列出的本地范围提交。</p>'}<div class="pagination"><button data-version-page="-1" ${state.page===0 ? 'disabled' : ''}>上一页</button><span>${state.page+1} / ${pageCount}</span><button data-version-page="1" ${state.page>=pageCount-1 ? 'disabled' : ''}>下一页</button></div>`;
  }

  function history(v) {
    return `<section class="version-section"><h2>与本版关联的本地提交范围</h2>${v.range ? `<p>范围：<code>${esc(v.range)}</code></p><p>范围按 Git 可达关系计算，排除前一个较低版本标签可达的提交；不是按提交日期猜测版本归属。${v.linearRange ? '' : '两个标签不是祖先关系：此处是可达提交差集，不是线性发布区间。'}${data.meta.shallow ? '当前为浅克隆，结果受本地历史截断限制。' : ''}</p><pre><code>git log --oneline ${esc(v.range)}</code></pre>${v.tag ? `<p class="meta">本地标签目标：${esc(v.hash)}</p>` : '<p class="meta">未发布范围到 HEAD 为止；未提交的工作区改动不属于 Git 提交范围。</p>'}` : '<div class="callout">没有可确认的本地标签边界，未猜测提交归属。可以在 Git 时间线按版本号或路径搜索。</div>'}<p class="meta">保留现有时间线的中文解说；自动元数据概述不等于逐条 diff 审查或全文翻译。</p><div id="versionCommits">${commitRows(v)}</div></section>`;
  }

  function sources(v) {
    return `<section class="version-section"><h2>版本身份与证据边界</h2><dl class="version-facts"><dt>版本</dt><dd>${esc(display(v.id))}</dd><dt>日志日期</dt><dd>${esc(v.dates.join(' / ') || '没有日期记录')}${v.dates.length>1 ? '（各包日期不一致，保留全部值。）' : ''}</dd><dt>本地可达标签</dt><dd>${esc(v.tag || '无')} ${esc(v.hash || '')}</dd><dt>标签记录时间</dt><dd>${esc(v.tagDate || '无')}（Git 标签 / 目标记录时间，不等同于公开发布日期。）</dd><dt>当前源码基准</dt><dd>${esc(versions.head)}</dd><dt>生成时间</dt><dd>${esc(data.meta.builtAt)}</dd><dt>中文资料范围</dt><dd>已发现数字版本最高到 ${esc(versions.chineseThrough || '无')}；中文 Unreleased 不自动匹配英文 Unreleased。</dd></dl><p>本页只依据当前仓库日志、包清单与 HEAD 可达标签。日志标题不是远端发行状态证明；标签之外的分支、npm 实际发布与在线 release 页面未据此核验。HEAD 以外的本地标签不作为当前历史版本加入。</p><p>当前快照反映生成时工作区；未发布日志可能包含未提交内容。全文指纹可在 data/manifest.json 复核。</p></section><section class="version-section"><h2>本版全部原始资料</h2><div class="version-files">${v.packages.flatMap(p=>[p.en,p.zh].filter(Boolean)).map(e=>ref(e.path,e.line,`${e.path} : ${e.line}`)).join('') || '<p>只有本地 Git 标签记录。</p>'}</div></section><section class="version-section"><h2>当前包版本（不是本版历史包版本）</h2><div class="table-wrap"><table><thead><tr><th>包</th><th>当前 package.json</th><th>来源</th></tr></thead><tbody>${versions.packageVersions.map(p=>`<tr><td>${esc(p.id)}</td><td>${esc(p.version)}</td><td>${ref(`packages/${p.id}/package.json`,1,'包清单')}</td></tr>`).join('')}</tbody></table></div></section>`;
  }

  function panel() {
    const v = byId.get(state.selected);
    if (!v) return '<div class="empty">没有版本数据。</div>';
    const index = items.indexOf(v);
    const body = {overview,changes,upgrade,code,commits:history,sources}[state.tab](v);
    return `<header class="version-heading"><div class="eyebrow">${v.id==='Unreleased' ? 'WORKING TREE / 尚未发布' : 'LOCAL HISTORY / 本地版本记录'}</div><h2>${esc(display(v.id))}</h2><p>${esc(v.dates.join(' / ') || '未记录发布日期')} · ${v.notes ? '有重点中文解说' : '记录索引与原始资料'} ${v.tag ? `· ${esc(v.tag)}` : ''}</p><div class="version-neighbors">${index>0 ? anchor(items[index-1].id,state.tab,'← 较新记录') : '<span></span>'}${index<items.length-1 ? anchor(items[index+1].id,state.tab,'较旧记录 →') : ''}</div></header><nav class="version-tabs" aria-label="版本解说栏目">${tabs.map(([id,title])=>anchor(v.id,id,title,`${state.tab===id ? 'class="active" aria-current="page"' : ''}`)).join('')}</nav><div class="version-content">${body}</div>`;
  }

  function choose(id,tab) {
    const selected = byId.has(id) ? id : (id ? items[0]?.id : state.selected);
    if (selected!==state.selected) {state.page=0;state.compare='';}
    state.selected=selected;
    state.tab=tabs.some(([key])=>key===tab) ? tab : 'overview';
  }

  function render(id,tab) {
    choose(id,tab);
    return `<div class="version-browser"><div class="hero-line"><div><div class="eyebrow">VERSIONS / 项目如何演进</div><h1>版本介绍</h1><p class="lead">从版本重点读到接口影响，再回到包、源码与提交依据。</p></div></div><div class="version-baseline">当前包版本 ${esc(data.meta.version)} · HEAD ${esc(data.meta.commit.slice(0,9))} · ${versions.stats.released} 个历史版本记录 · ${versions.stats.curated} 版重点中文解说 · 本地当前历史最高标签 ${esc(versions.latestTag || '无')}</div><div class="version-layout"><aside class="version-sidebar" aria-label="版本清单"><div class="version-filters"><label>搜索版本 / 中文 / 原文<input id="versionSearch" type="search" value="${esc(state.query)}" placeholder="版本号、Azure、工具…"></label><label>涉及的包<select id="versionPackage"><option value="">全部包</option>${[...new Set(items.flatMap(v=>v.packages.map(p=>p.id)))].sort().map(id=>`<option value="${esc(id)}" ${state.package===id ? 'selected' : ''}>${esc(id)}</option>`).join('')}</select></label><label class="version-check"><input type="checkbox" id="versionRisk" ${state.risk ? 'checked' : ''}>只看不兼容 / 移除 / 安全记录</label><button id="versionReset" class="quiet">清除筛选</button></div><nav id="versionList" class="version-list" aria-label="选择版本">${menu()}</nav></aside><article id="versionPanel" class="version-panel" aria-label="版本详细解说">${id && !byId.has(id) ? '<div class="callout">未找到该版本，已显示最近记录。</div>' : ''}${panel()}</article></div></div>`;
  }

  function activatePanel() {
    $('versionCompare')?.addEventListener('change',()=>{state.compare=$('versionCompare').value;$('versionComparison').innerHTML=comparison(byId.get(state.selected),byId.get(state.compare || byId.get(state.selected).previous));});
  }

  function navigate(id,tab) {
    choose(id,tab);
    $('versionPanel').innerHTML=`${id && !byId.has(id) ? '<div class="callout">未找到该版本，已显示最近记录。</div>' : ''}${panel()}`;
    $('versionPanel').scrollTop=0;
    for (const link of $('versionList').querySelectorAll('[data-version]')) {
      const active=link.dataset.version===state.selected;
      link.classList.toggle('active',active);
      if (active) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
      link.setAttribute('href',`#versions/${link.dataset.version}/${state.tab}`);
    }
    const status=$('versionList').querySelector('[role="status"]');
    const matches=filtered();
    if(status) status.textContent=`${matches.length} / ${items.length} 个版本${!matches.some(v=>v.id===state.selected) ? ' · 当前详情不在筛选结果中' : ''}`;
    activatePanel();
  }

  function activate() {
    $('versionList').scrollTop=state.scroll;
    const filter=()=>{state.query=$('versionSearch').value;state.package=$('versionPackage').value;state.risk=$('versionRisk').checked;$('versionList').innerHTML=menu();$('versionList').scrollTop=0;};
    $('versionSearch').addEventListener('input',filter);
    $('versionPackage').addEventListener('change',filter);
    $('versionRisk').addEventListener('change',filter);
    $('versionReset').addEventListener('click',()=>{$('versionSearch').value='';$('versionPackage').value='';$('versionRisk').checked=false;filter();});
    $('versionPanel').addEventListener('click',event=>{const button=event.target.closest('[data-version-page]');if(!button || button.disabled)return;state.page+=Number(button.dataset.versionPage);$('versionCommits').innerHTML=commitRows(byId.get(state.selected));$('versionCommits').scrollIntoView({block:'nearest'});});
    activatePanel();
  }
  return {render,activate,navigate,rememberMenu(){if($('versionList'))state.scroll=$('versionList').scrollTop;},search(query){return items.filter(v=>searchText.get(v.id).includes(query.toLowerCase()));}};
}
