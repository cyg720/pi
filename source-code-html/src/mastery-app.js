/* Learning state is local and independent of production validation. All course evidence is embedded. */
function createMasteryBrowser(data, esc) {
  const course = data.mastery;
  const $ = id => document.getElementById(id);
  const key = 'pi-doc-mastery-v1';
  const valid = new Set(course.routes.flatMap(r => r.steps.map(s => s.id)));
  let stored;
  try { stored = JSON.parse(localStorage.getItem(key)); } catch { /* Reading remains available without storage. */ }
  const done = new Set(Array.isArray(stored?.done) ? stored.done.filter(id => valid.has(id)) : []);
  let active = '', section = '', slide = 0, menuScroll = 0, query = '', stage = '', resetArmed = false;
  let last = typeof stored?.last === 'string' && course.routes.some(r => r.id === stored.last) ? stored.last : '';
  const opened = new Set(['foundations']);
  const openedRoutes = new Set();
  const href = (id, part = '') => `#mastery/${id}${part ? `/${part}` : ''}`;
  const source = path => `<button class="ref" data-source="${esc(path)}">${esc(path)}</button>`;
  function save() { try { localStorage.setItem(key, JSON.stringify({ done: [...done], last })); } catch { /* file:// storage may be denied. */ } }
  function matches(r, q = query) { return `${r.title} ${r.scenario} ${JSON.stringify(r.steps)} ${r.capabilities.map(c => `${c.id} ${c.title} ${c.purpose}`).join(' ')}`.toLowerCase().includes(q.toLowerCase()); }
  function menu() {
    return `<a href="#mastery">八阶段学习总览</a>${course.stages.map(s => {
      const rows = course.routes.filter(r => r.stage === s.id && (!stage || stage === s.id) && matches(r));
      if (!rows.length) return '';
      return `<details data-mastery-stage="${s.id}" ${opened.has(s.id) || query || stage ? 'open' : ''}><summary>${esc(s.title)} · ${rows.length}</summary>${rows.map(r => `<details class="mastery-route-menu" data-mastery-route="${r.id}" ${openedRoutes.has(r.id) || r.id === active ? 'open' : ''}><summary><a href="${href(r.id)}" data-mastery-link="${r.id}">${esc(r.title)}</a></summary>${r.steps.map((s, i) => `<a class="mastery-step-link" href="${href(r.id, `step-${i + 1}`)}" data-mastery-step="${s.id}">${i + 1}. ${esc(s.title)}</a>`).join('')}</details>`).join('')}</details>`;
    }).join('')}<div class="mastery-utility"><a href="${href('glossary')}">新手术语</a><a href="${href('coverage')}">全部编号与流程对照</a><a href="${href('plan')}">制作待办与验收边界</a></div>`;
  }
  function progress() {
    $('masteryProgress').textContent = `${done.size} / ${valid.size} 个步骤已学习`;
    $('masteryMeter').value = done.size;
    $('masteryMenu').querySelectorAll('[data-mastery-step]').forEach(el => {
      const id = el.dataset.masteryStep;
      el.classList.toggle('learned', done.has(id));
      if (id === `${active}:${section.replace('step-', '')}`) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current');
    });
  }
  function overview() {
    return `<h2>先跑通一条主线，再逐层扩展</h2><p>先掌握 JavaScript 的函数、对象、数组、Promise/await 和 TypeScript 的类型、联合类型。遇到陌生词可先看术语表。每个步骤按“读解释 → 查源码 → 描述输入输出 → 完成练习”推进。</p><div class="callout">阅读顺序用于教学。关联文件和测试提供调查线索，不表示某次运行必经所有文件，也不表示这里已执行业务测试。历史方案、示例和当前内置能力分别标注。</div>${last ? `<a class="chip" href="${href(last)}">继续上次流程 → ${esc(course.routes.find(r => r.id === last).title)}</a>` : ''}<div class="mastery-stage-cards">${course.stages.map(s => {
      const routes = course.routes.filter(r => r.stage === s.id);
      return `<article class="card"><small>${routes.length} 条路线 · ${routes.reduce((n, r) => n + r.steps.length, 0)} 步</small><h3>${esc(s.title)}</h3><p>${esc(s.goal)}</p><ol>${routes.map(r => `<li><a href="${href(r.id)}">${esc(r.title)}</a></li>`).join('')}</ol></article>`;
    }).join('')}</div>`;
  }
  function resources(r) {
    return `<details class="mastery-box"><summary>关联源码、配置文档与测试 · ${r.files.length} / ${r.docs.length} / ${r.tests.length}</summary><p>由步骤专题和延伸编号继承关联。测试是阅读线索，尚未在页面执行；入口文件从第 1 行打开，可用源码弹窗搜索具体函数。</p><h3>源码</h3><div class="refs">${r.files.map(source).join('')}</div><h3>文档</h3><div class="refs">${r.docs.map(source).join('')}</div><h3>测试</h3><div class="refs">${r.tests.map(source).join('') || '当前专题没有直接关联的测试文件，请继续查阅包教程的全部测试。'}</div></details><details class="mastery-box"><summary>功能编号与延伸实践 · ${r.capabilities.length}</summary><p>逐项打开查看原始描述、源码、引用图和测试。延伸示例不保证开箱即用，文档方案不视为已实现接口。</p>${r.capabilities.map(c => `<article class="mastery-cap"><a href="#functions/${esc(c.id)}">${esc(c.title)}</a><small>${esc(c.kind)} · ${esc(c.status)}</small><p>${esc(c.purpose)}</p></article>`).join('')}</details><div class="refs">${r.packages.map(p => `<a href="#packages/${esc(p)}">${esc(p)} 包教程 →</a>`).join('')}</div>`;
  }
  function stepView(r, index) {
    const s = r.steps[index];
    return `<div class="mastery-step-detail"><small>步骤 ${index + 1} / ${r.steps.length}</small><h2>${esc(s.title)}</h2><p class="lead">${esc(s.explain)}</p><div class="mastery-io"><div><small>进入时</small><p>${esc(s.input)}</p></div><span aria-hidden="true">→</span><div><small>完成后</small><p>${esc(s.output)}</p></div></div><h3>对照契约</h3><p>${esc(s.behavior)}</p><p><b>入口线索：</b>${esc(s.entry)}</p><a href="#functions/${esc(s.feature)}">打开 ${esc(s.topicTitle)}：符号、参数、引用图和测试 →</a><details class="mastery-box" open><summary>这一步的真实源码文件</summary><div class="refs">${s.refs.map(ref => source(ref.path)).join('')}</div></details><label class="mastery-check"><input type="checkbox" data-mastery-complete="${s.id}" ${done.has(s.id) ? 'checked' : ''}>我能解释这一步，并已对照源码</label><div class="end-nav"><a href="${href(r.id, index ? `step-${index}` : '')}">← ${index ? '上一步' : '流程总览'}</a><a href="${href(r.id, index + 1 < r.steps.length ? `step-${index + 2}` : 'slides')}">${index + 1 < r.steps.length ? '下一步' : '进入六视角讲解'} →</a></div></div>`;
  }
  function slideBody(r) {
    const s = r.slides[slide];
    return `<div class="mastery-slide"><small>${slide + 1} / ${r.slides.length} · ${esc(s.angle)}</small><h2>${esc(s.title)}</h2><ol>${s.points.map(p => `<li>${esc(p)}</li>`).join('')}</ol></div><details class="mastery-box" open><summary>讲解稿与读码提示</summary><p class="mastery-notes">${esc(s.notes)}</p></details>`;
  }
  function panel() {
    if (active === 'glossary') return `<h2>新手术语：用自己的话解释一次</h2><dl class="mastery-glossary">${course.glossary.map(([term, text]) => `<dt>${esc(term)}</dt><dd>${esc(text)}</dd>`).join('')}</dl>`;
    if (active === 'coverage') return `<h2>${course.coverage.length} 个编号的学习位置</h2><p>这是登记功能的阅读覆盖，不宣称穷尽源码所有可能执行路径。功能新增后，生成器会拒绝未归属编号，促使维护者补充课程。</p><div class="table-wrap"><table><thead><tr><th>编号与功能</th><th>对应流程</th></tr></thead><tbody>${course.coverage.map(c => `<tr><td><a href="#functions/${esc(c.id)}">${esc(c.title)}</a></td><td>${c.routes.map(id => `<a class="chip" href="${href(id)}">${esc(course.routes.find(r => r.id === id).title)}</a>`).join('')}</td></tr>`).join('')}</tbody></table></div>`;
    if (active === 'plan') return `<h2>制作待办与验收记录</h2><p>基线：${esc(course.plan.baseline)}。这里记录文档制作状态，与左上角的个人学习进度独立。</p><ol>${course.plan.acceptance.map(t => `<li>${esc(t)}</li>`).join('')}</ol><div class="table-wrap"><table><thead><tr><th>编号</th><th>分组</th><th>工作项</th><th>状态与证据</th></tr></thead><tbody>${course.plan.tasks.map(t => `<tr><td>${t.id}</td><td>${esc(t.group)}</td><td>${esc(t.text)}</td><td>${esc(({ done: '已完成', doing: '进行中', todo: '待完成', limited: '受环境限制' })[t.status] || t.status)}${t.evidence ? `<br>${esc(t.evidence)}` : ''}</td></tr>`).join('')}</tbody></table></div>`;
    const r = course.routes.find(r => r.id === active);
    if (!r) return overview();
    const previous = r.prerequisite.map(id => course.routes.find(r => r.id === id));
    const index = /^step-\d+$/.test(section) ? Number(section.slice(5)) - 1 : -1;
    const stage = course.stages.find(s => s.id === r.stage);
    const deck = course.decks?.find(d => d.stage === r.stage);
    const deckNotice = course.decksStale ? '<p class="callout">课件待同步：课程或源码基线已更新，旧 PPTX 暂停下载。当前 HTML 讲解仍可阅读。</p>' : '';
    let body;
    if (index >= 0 && index < r.steps.length) body = stepView(r, index);
    else if (section === 'slides') body = `<p>点击讲解区域后可用 ← / →、Home / End 翻页；无需联网或自动播放。</p><div id="masteryViewer" tabindex="0" aria-label="六视角讲解，左右方向键翻页"><div id="masterySlide">${slideBody(r)}</div><div class="pagination"><button id="masterySlidePrev">上一页</button><span id="masterySlideCount" aria-live="polite"></span><button id="masterySlideNext">下一页</button></div></div>${deck ? `<a download="${esc(deck.filename)}" href="data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,${deck.base64}">下载本阶段可编辑 PPTX · ${deck.slides} 页</a>` : ''}`;
    else body = `<h2>按顺序走完这条流程</h2><ol class="mastery-path">${r.steps.map((s, i) => `<li><a href="${href(r.id, `step-${i + 1}`)}"><b>${i + 1}. ${esc(s.title)}</b></a><p>${esc(s.explain)}</p><small>${esc(s.input)} → ${esc(s.output)}</small></li>`).join('')}</ol><h2>失败与恢复</h2><p>${esc(r.failure)}</p><h2>动手练习</h2><p>${esc(r.exercise)}</p><details class="mastery-box"><summary>完成后再打开参考判断</summary><p>${esc(r.answer)}</p></details>${resources(r)}<h2>继续学习</h2><div class="refs">${course.routes.filter(next => next.prerequisite.includes(r.id)).map(next => `<a href="${href(next.id)}">${esc(next.title)} →</a>`).join('') || '<a href="#mastery">回到八阶段总览 →</a>'}</div>`;
    return `<small>${esc(stage.title)}</small><h1>${esc(r.title)}</h1><p class="lead">${esc(r.scenario)}</p><div class="callout"><b>先修：</b>${previous.map(p => `<a href="${href(p.id)}">${esc(p.title)}</a>`).join(' · ') || '无需项目知识，从目录和基本语法开始。'}</div><nav class="mastery-tabs" aria-label="流程章节"><a href="${href(r.id)}" ${!section ? 'aria-current="page"' : ''}>流程总览</a>${r.steps.map((s, i) => `<a href="${href(r.id, `step-${i + 1}`)}" ${index === i ? 'aria-current="page"' : ''}>步骤 ${i + 1}</a>`).join('')}<a href="${href(r.id, 'slides')}" ${section === 'slides' ? 'aria-current="page"' : ''}>六视角 PPT 解说</a></nav>${deckNotice}${body}`;
  }
  function updateSlide() {
    const r = course.routes.find(r => r.id === active);
    slide = Math.max(0, Math.min(r.slides.length - 1, slide));
    $('masterySlide').innerHTML = slideBody(r);
    $('masterySlideCount').textContent = `${slide + 1} / ${r.slides.length}`;
    $('masterySlidePrev').disabled = slide === 0;
    $('masterySlideNext').disabled = slide === r.slides.length - 1;
  }
  function activatePanel() {
    $('masteryPanel').querySelectorAll('[data-mastery-complete]').forEach(input => input.addEventListener('change', () => {
      if (input.checked) done.add(input.dataset.masteryComplete); else done.delete(input.dataset.masteryComplete);
      save(); progress();
    }));
    if (section === 'slides' && course.routes.some(r => r.id === active)) {
      updateSlide();
      $('masterySlidePrev').addEventListener('click', () => { slide--; updateSlide(); });
      $('masterySlideNext').addEventListener('click', () => { slide++; updateSlide(); });
      $('masteryViewer').addEventListener('keydown', event => {
        if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); slide = event.key === 'Home' ? 0 : event.key === 'End' ? 5 : slide + (event.key === 'ArrowRight' ? 1 : -1); updateSlide();
      });
    }
  }
  function listenMenu() {
    $('masteryMenu').querySelectorAll('[data-mastery-stage]').forEach(el => el.addEventListener('toggle', () => { if (el.open) opened.add(el.dataset.masteryStage); else opened.delete(el.dataset.masteryStage); }));
    $('masteryMenu').querySelectorAll('[data-mastery-route]').forEach(el => el.addEventListener('toggle', () => { if (el.open) openedRoutes.add(el.dataset.masteryRoute); else openedRoutes.delete(el.dataset.masteryRoute); }));
  }
  return {
    render(id = '', part = '') {
      active = id; section = part; resetArmed = false;
      const r = course.routes.find(r => r.id === id); if (r) opened.add(r.stage);
      return `<div class="eyebrow">LEARN / SOURCE MASTERY</div><h1>源码精通路线</h1><p class="lead">8 个阶段 · ${course.stats.routes} 条流程 · ${course.stats.steps} 个连贯步骤 · ${course.stats.capabilities} 个功能编号可追溯</p><div class="mastery-toolbar"><div><b id="masteryProgress"></b><progress id="masteryMeter" max="${valid.size}" value="${done.size}"></progress><small>仅存于当前浏览器；勾选表示个人学习记录，不代表验证通过。</small></div><button id="masteryReset">重置学习进度</button></div><div class="mastery-layout"><aside class="mastery-navigation"><label>搜索流程、步骤或功能编号<input id="masteryQuery" type="search" value="${esc(query)}" placeholder="例如 模型、恢复、MCP-01"></label><label>阶段 / 难度<select id="masteryStage"><option value="">全部阶段</option>${course.stages.map(s => `<option value="${s.id}" ${stage === s.id ? 'selected' : ''}>${esc(s.title)}</option>`).join('')}</select></label><nav id="masteryMenu" aria-label="阶段、流程与步骤">${menu()}</nav></aside><article id="masteryPanel" class="mastery-content">${panel()}</article></div>`;
    },
    activate() {
      $('masteryMenu').scrollTop = menuScroll;
      $('masteryQuery').addEventListener('input', () => { query = $('masteryQuery').value; $('masteryMenu').innerHTML = menu(); listenMenu(); progress(); });
      $('masteryStage').addEventListener('change', () => { stage = $('masteryStage').value; $('masteryMenu').innerHTML = menu(); listenMenu(); progress(); });
      $('masteryReset').addEventListener('click', () => {
        if (!resetArmed) { resetArmed = true; $('masteryReset').textContent = '再次点击确认清空学习记录'; return; }
        done.clear(); last = ''; save(); resetArmed = false; $('masteryReset').textContent = '重置学习进度';
        $('masteryPanel').innerHTML = panel(); activatePanel(); progress();
      });
      listenMenu(); this.navigate(active, section);
    },
    navigate(id = '', part = '') {
      active = id; section = part; slide = 0;
      const r = course.routes.find(r => r.id === id);
      if (r) { last = r.id; opened.add(r.stage); openedRoutes.add(r.id); save(); }
      $('masteryPanel').innerHTML = panel();
      $('masteryMenu').querySelectorAll('[data-mastery-link]').forEach(el => { if (el.dataset.masteryLink === id) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); });
      $('masteryMenu').querySelectorAll('[data-mastery-stage]').forEach(el => { if (r?.stage === el.dataset.masteryStage) el.open = true; });
      $('masteryMenu').querySelectorAll('[data-mastery-route]').forEach(el => { if (el.dataset.masteryRoute === id) el.open = true; });
      activatePanel(); progress();
    },
    rememberMenu() { menuScroll = $('masteryMenu')?.scrollTop || 0; },
    search(q) { return course.routes.filter(r => matches(r, q)); }
  };
}
