/* Package lessons use only embedded evidence. No commands or examples are executed. */
function createPackageTutorialBrowser(data, esc) {
  const packages = data.tutorials || [];
  const tabs = [['intro', '职责与重点'], ['usage', '使用入门'], ['config', '全部参数配置'], ['flow', '核心流程'], ['extend', '扩展方式'], ['mastery', '源码精读'], ['examples', '示例与测试'], ['docs', '原始资料']];
  const $ = id => document.getElementById(id);
  let active = '', tab = 'intro', menuScroll = 0, page = 0, filePage = 0;
  const source = (path, line = 1, label = path) => `<button class="ref" data-source="${esc(path)}" data-line="${line}">${esc(label)}</button>`;
  const list = items => `<ol class="tutorial-steps">${items.map(s => `<li>${esc(s)}</li>`).join('')}</ol>`;
  const heading = (title, text) => `<h2>${esc(title)}</h2><p>${esc(text)}</p>`;
  const link = (p, section, label) => `<a href="#packages/${esc(p.id)}/${section}">${esc(label)}</a>`;
  function overview() {
    return `${heading('选择一个子包，沿着证据深入', '先理解职责，再运行最小场景；读完类型、调用链和测试后，再设计扩展。下列每个目录都有独立入口，历史状态不会混入当前包。')}<div class="tutorial-cards">${packages.map(p => `<a class="card" href="#packages/${esc(p.id)}"><span class="badge">${esc(p.status)}</span><h2>${esc(p.id)}</h2><p>${esc(p.lesson.intro)}</p><small>${p.sourceFiles.length} 个源码文件 · ${p.symbols.length} 个声明 · ${p.examples.length} 份示例文件</small></a>`).join('')}</div>`;
  }
  function intro(p) {
    return `${heading('先建立职责边界', p.lesson.intro)}${list(p.lesson.focus)}${p.manifest ? `<div class="table-wrap"><table><tbody><tr><th>包名 / 版本</th><td>${esc(p.manifest.name)} · ${esc(p.manifest.version)}</td></tr><tr><th>运行要求</th><td>${esc(JSON.stringify(p.manifest.engines || {}))}（未声明的要求请结合仓库配置）</td></tr><tr><th>运行时依赖</th><td>${esc(Object.entries(p.manifest.dependencies || {}).map(([k, v]) => `${k}: ${v}`).join('\n') || '包清单未声明')}</td></tr></tbody></table></div><details class="tutorial-box"><summary>全部 exports、bin 与 scripts（包清单原文）</summary><p>这里只展示命令定义，不在页面执行。dist 入口属于发布产物，源码调试见本地开发说明。</p><pre>${esc(JSON.stringify({ exports: p.manifest.exports, main: p.manifest.main, bin: p.manifest.bin, scripts: p.manifest.scripts }, null, 2))}</pre>${source(p.manifestPath)}</details>` : `<div class="callout">${esc(p.status)}：没有当前 package.json / src，参数、运行与扩展能力不作推断。</div>`}<div class="refs">${link(p, 'usage', '开始使用 →')}${link(p, 'flow', '跟着核心流程 →')}<a href="#directory/${encodeURIComponent(p.root || `packages/${p.id}`)}">查看源码目录 →</a></div>`;
  }
  function usage(p) {
    const readme = p.docs.find(path => path.endsWith('/README.md'));
    const sample = readme && /```(?:typescript|ts)\r?\n([\s\S]*?)```/.exec(data.sources[readme]);
    return `${heading('如何使用这个包', '以下步骤来自当前仓库契约。示例中的模型、凭据、宿主函数和运行环境需要按实际场景准备；页面只负责阅读。')}${list(p.lesson.usage)}${sample ? `<details class="tutorial-box" open><summary>README 中的第一段 TypeScript 示例</summary><p>逐字引用的原始示例；可能是片段而非独立脚本。配套前置条件与后续步骤见原始资料。</p><pre><code>${esc(sample[1])}</code></pre>${source(readme, 1, '查看完整 README 与前置条件')}</details>` : '<p>本包没有可提取的 README TypeScript 入门片段，请从原始资料和示例入口阅读。</p>'}<div class="refs"><a href="#development">环境准备、断点与部署步骤 →</a>${link(p, 'examples', '所有示例与测试 →')}${link(p, 'docs', '完整使用文档 →')}</div>`;
  }
  function config(p) {
    return `${heading('参数配置：重点解释与完整索引', '下方覆盖当前包 src 已解析的全部声明，包含函数入参、类型成员、内部实现与配置 schema。默认筛选配置类型，可切换全部声明。它不是公共 API 白名单；公共导入边界以 package.json 的 exports 为准。')}${p.lesson.config.map(([name, text]) => `<div class="tutorial-box"><h3>${esc(name)}</h3><p>${esc(text)}</p></div>`).join('')}<div class="callout">“?” 表示类型允许省略，不代表已知默认值。默认值、枚举与约束保留原始注释和 schema；继承、联合、映射类型请展开完整声明并继续查父类型。没有注释的参数不会编造说明。文档与源码冲突时，核对当前实现与测试。</div><div class="filters"><label class="grow">搜索参数、类型、路径和原始注释<input id="tutorialSymbolQuery" type="search" placeholder="例如 timeout、signal、temperature"></label><label>范围<select id="tutorialSymbolScope"><option value="config">配置类型及成员</option><option value="all">全部源码声明</option><option value="call">函数、方法与入参</option></select></label></div><div id="tutorialSymbols" aria-live="polite"></div><div class="pagination"><button id="tutorialPrev">上一页</button><span id="tutorialPage" class="meta"></span><button id="tutorialNext">下一页</button></div><h3>配置文件与 JSON Schema</h3>${p.schemas.length ? p.schemas.map(path => `<details class="tutorial-box"><summary>${esc(path)}</summary><p>完整 schema 保留 required、default、enum、嵌套属性与 $ref；以当前校验和消费代码确定生效行为。</p><pre>${esc(data.sources[path])}</pre>${source(path)}</details>`).join('') : '<p>当前包未提供 schemas/ 下的 JSON Schema。参数通过代码类型或调用契约配置，不虚构独立配置文件。</p>'}<details class="tutorial-box"><summary>环境读取位置 · ${p.environment.length} 处</summary><p>逐行列出 src 中 process.env / Bun.env / Deno.env 的显式读取线索；包含计算键和注释。经工具函数间接读取的变量请结合类型、认证文档与实现，不将本列表宣称为语义穷举。</p>${p.environment.map(([path, line]) => `<div class="tutorial-env">${source(path, line, `${path}:${line}`)}<pre>${esc(data.sources[path].split('\n')[line - 1])}</pre></div>`).join('') || '<p>未发现以上显式读取形式。</p>'}</details>${link(p, 'docs', '查阅完整配置与 API 文档 →')}`;
  }
  function flow(p) {
    return `${heading('核心流程与断点路线', '下面是本包的教学阅读顺序，每步关联当前实现。分支和可选路径不表示每次运行都必定经过。')}${p.lesson.flow.length ? `<ol class="tutorial-flow">${p.lesson.flow.map((s, i) => `<li><span>${i + 1}</span><div><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p><button class="ref" data-source="${esc(s.path)}" data-needle="${esc(s.needle)}">${esc(s.path)}</button>${(data.catalog.files[s.path]?.features || []).map(id => `<a class="chip" href="#functions/${esc(id)}">源码专题与引用图</a>`).join('')}</div></li>`).join('')}</ol>` : '<div class="empty">没有当前源码，不生成虚构调用链。</div>'}`;
  }
  function mastery(p) {
    return `${heading('从会用到精通源码', '每一阶段都需要能解释行为并用源码或测试证明。阅读进度不等于已经掌握。')}${list(p.lesson.mastery)}<h3>完成练习后的自检</h3>${list(['能说明入口参数在哪里验证、默认值在哪里补齐，以及错误由谁接收。', '能沿成功、失败和取消三条路径解释状态变化与资源清理。', '能找到对应测试并提出一个当前测试未覆盖的边界，而不是只复制实现写断言。'])}<h3>本包现有源码专题</h3><div class="capability-links">${p.features.map(id => { const f = data.catalog.features.find(f => f.id === id); return `<a href="#functions/${esc(id)}">${esc(f.title)}<small>${esc(f.purpose)}</small></a>`; }).join('') || '<p>当前没有可关联的源码专题。</p>'}</div>`;
  }
  function examples(p) {
    return `${heading('相关示例与测试', '示例用于学习用法，测试用于验证契约。此处按仓库路径完整列出匹配文件，不代表都可独立运行。真实模型、网络、SSH、容器等用例应先阅读前置条件。')}<div class="filters"><label class="grow">筛选文件<input id="tutorialFileQuery" type="search" placeholder="例如 tool、resume、mcp"></label><label>类型<select id="tutorialFileScope"><option value="examples">示例 · ${p.examples.length}</option><option value="tests">测试 · ${p.tests.length}</option></select></label></div><div id="tutorialFiles"></div><div class="pagination"><button id="tutorialFilePrev">上一页</button><span id="tutorialFilePage"></span><button id="tutorialFileNext">下一页</button></div>`;
  }
  function docs(p) {
    return `${heading('原始资料：完整离线阅读', '正文保留仓库原语言与原文，不把历史中文翻译视为最新 API 保证。代码块不执行，图片与外链不自动加载。可用浏览器查找，或打开原文按行定位。')}<label class="tutorial-doc-select">选择资料<select id="tutorialDoc">${p.docs.map(path => `<option value="${esc(path)}">${esc(path)}</option>`).join('')}</select></label><div id="tutorialDocBody" class="tutorial-doc"></div>`;
  }
  function panel() {
    const p = packages.find(p => p.id === active);
    if (!p) return overview();
    const body = tab === 'config' ? config(p) : tab === 'flow' ? flow(p) : tab === 'usage' ? usage(p) : tab === 'extend' ? `${heading('可扩展的边界', '优先使用公开契约和现有适配层；源码内部函数的存在并不表示稳定扩展接口。')}${list(p.lesson.extend)}${flow(p)}` : tab === 'mastery' ? mastery(p) : tab === 'examples' ? examples(p) : tab === 'docs' ? docs(p) : intro(p);
    return `<header class="tutorial-heading"><small>${esc(p.root || `packages/${p.id}`)} · ${esc(p.status)}</small><h1>${esc(p.id)}</h1><div class="chips"><span class="chip">${p.sourceFiles.length} 个源码文件</span><span class="chip">${p.symbols.length} 个源码声明</span><span class="chip">${p.docs.length} 份原始资料</span></div></header><nav class="tutorial-tabs" aria-label="包教程章节">${tabs.map(([key, title]) => `<a href="#packages/${esc(p.id)}/${key}" ${key === tab ? 'aria-current="page"' : ''}>${title}</a>`).join('')}</nav><article class="tutorial-article">${body}</article>`;
  }
  function symbols() {
    const p = packages.find(p => p.id === active);
    const q = $('tutorialSymbolQuery').value.trim().toLowerCase(), scope = $('tutorialSymbolScope').value || 'config';
    const rows = p.symbols.map(([path, index]) => ({ path, s: data.catalog.files[path].symbols[index] })).filter(({ path, s }) => (scope === 'all' || (scope === 'call' ? s.inputs.length || /函数|方法|构造器/.test(s.kind) : /Options|Config|Settings|Schema|Params|Parameters/.test(s.name))) && (!q || `${path} ${s.name} ${s.signature} ${s.comment}`.toLowerCase().includes(q)));
    const size = 40, pages = Math.max(1, Math.ceil(rows.length / size)); page = Math.max(0, Math.min(page, pages - 1));
    $('tutorialSymbols').innerHTML = `<p class="meta">${rows.length} / ${p.symbols.length} 个声明匹配 · 所有页均可翻看</p>${rows.slice(page * size, (page + 1) * size).map(({ path, s }) => `<details class="tutorial-box"><summary><b>${esc(s.name)}</b><small>${esc(s.kind)} · ${s.exported ? '文件直接导出' : '成员 / 内部声明'} · ${esc(path)}:${s.line}</small></summary><pre>${esc(s.signature)}</pre>${s.inputs.length ? `<h4>原始入参（含类型与显式默认表达式）</h4><pre>${esc(s.inputs.join('\n'))}</pre>` : ''}${s.output ? `<p>显式返回 / 属性类型：<code>${esc(s.output)}</code></p>` : ''}<p class="tutorial-comment">${esc(s.comment || '此声明没有直接前置注释；请查看所属类型及实现。')}</p>${source(path, s.line, '定位声明与默认值消费逻辑')}${/接口|类型/.test(s.kind) ? `<details><summary>完整类型原文（包含嵌套字段）</summary><pre>${esc(data.sources[path].split('\n').slice(s.line - 1, s.endLine).join('\n'))}</pre></details>` : ''}</details>`).join('') || '<p>没有匹配项。</p>'}`;
    $('tutorialPage').textContent = `${page + 1} / ${pages}`;
    $('tutorialPrev').disabled = page === 0; $('tutorialNext').disabled = page === pages - 1;
  }
  function files() {
    const p = packages.find(p => p.id === active), q = $('tutorialFileQuery').value.toLowerCase();
    const rows = p[$('tutorialFileScope').value || 'examples'].filter(path => path.toLowerCase().includes(q));
    const pages = Math.max(1, Math.ceil(rows.length / 40)); filePage = Math.max(0, Math.min(filePage, pages - 1));
    $('tutorialFiles').innerHTML = rows.slice(filePage * 40, (filePage + 1) * 40).map(path => {
      const feature = data.catalog.features.find(f => f.status === '示例' && f.files.includes(path));
      return `<details class="tutorial-box"><summary>${esc(feature?.title || path)}${feature ? `<small>${esc(path)}</small>` : ''}</summary>${feature ? `<p>${esc(feature.purpose)}</p><a href="#functions/${esc(feature.id)}">打开示例解说与源码关联 →</a>` : '<p>本文件暂未单独撰写中文场景解说；阅读原始注释、所在目录 README 和测试断言。</p>'}${source(path)}<pre>${esc(data.sources[path])}</pre></details>`;
    }).join('') || '<div class="empty">没有匹配文件。也可在原始资料中查找内嵌示例。</div>';
    $('tutorialFilePage').textContent = `${rows.length} 个文件 · ${filePage + 1} / ${pages}`;
    $('tutorialFilePrev').disabled = filePage === 0; $('tutorialFileNext').disabled = filePage === pages - 1;
  }
  function documentBody() {
    const p = packages.find(p => p.id === active), path = $('tutorialDoc').value || p.docs[0];
    if (!path) { $('tutorialDocBody').innerHTML = '<div class="empty">没有当前已跟踪资料。</div>'; return; }
    // Minimal source-preserving Markdown presentation. All content is escaped; HTML and links stay inert.
    let fence = false;
    const lines = data.sources[path].split('\n').map(line => {
      if (/^```/.test(line)) { fence = !fence; return fence ? '<pre><code>' : '</code></pre>'; }
      if (fence) return esc(line) + '\n';
      const h = /^(#{1,6})\s+(.+)/.exec(line);
      if (h) return `<h${Math.min(4, h[1].length + 1)}>${esc(h[2])}</h${Math.min(4, h[1].length + 1)}>`;
      return line.trim() ? `<div class="tutorial-doc-line">${esc(line)}</div>` : '<div class="tutorial-doc-gap"></div>';
    }).join('');
    $('tutorialDocBody').innerHTML = `${source(path, 1, '打开逐行原文')}${lines}${fence ? '</code></pre>' : ''}`;
  }
  function activatePanel() {
    if (!packages.some(p => p.id === active)) return;
    if (tab === 'config') {
      $('tutorialSymbolScope').value = 'config'; symbols();
      for (const [id, event] of [['tutorialSymbolQuery', 'input'], ['tutorialSymbolScope', 'change']]) $(id).addEventListener(event, () => { page = 0; symbols(); });
      $('tutorialPrev').addEventListener('click', () => { page--; symbols(); }); $('tutorialNext').addEventListener('click', () => { page++; symbols(); });
    }
    if (tab === 'examples') {
      $('tutorialFileScope').value = 'examples'; files();
      for (const [id, event] of [['tutorialFileQuery', 'input'], ['tutorialFileScope', 'change']]) $(id).addEventListener(event, () => { filePage = 0; files(); });
      $('tutorialFilePrev').addEventListener('click', () => { filePage--; files(); }); $('tutorialFileNext').addEventListener('click', () => { filePage++; files(); });
    }
    if (tab === 'docs') { documentBody(); $('tutorialDoc').addEventListener('change', documentBody); }
  }
  return {
    render(id = '', section = 'intro') {
      active = id; tab = tabs.some(([key]) => key === section) ? section : 'intro';
      return `<div class="eyebrow">PACKAGE / LEARN BY SOURCE</div><h1>package 教程</h1><p class="lead">${packages.length} 个目录入口 · ${packages.filter(p => p.manifest).length} 个当前包 · 从用法到实现，再到扩展与验证</p><div class="tutorial-layout"><nav id="tutorialMenu" class="tutorial-menu" aria-label="子包教程"><a href="#packages">全部子包概览</a>${packages.map(p => `<a href="#packages/${esc(p.id)}" data-tutorial="${esc(p.id)}">${esc(p.id)}<small>${esc(p.status)}</small></a>`).join('')}</nav><div id="tutorialPanel">${panel()}</div></div>`;
    },
    activate() { $('tutorialMenu').scrollTop = menuScroll; this.navigate(active, tab); },
    navigate(id = '', section = 'intro') {
      active = id; tab = tabs.some(([key]) => key === section) ? section : 'intro'; page = 0; filePage = 0;
      $('tutorialPanel').innerHTML = panel();
      $('tutorialMenu').querySelectorAll('[data-tutorial]').forEach(el => { if (el.dataset.tutorial === active) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); });
      activatePanel();
    },
    rememberMenu() { menuScroll = $('tutorialMenu')?.scrollTop || 0; },
    search(q) { return packages.filter(p => `${p.id} ${JSON.stringify(p.lesson)}`.toLowerCase().includes(q.toLowerCase())); }
  };
}
