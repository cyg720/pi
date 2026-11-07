/* B proposal integrated into the existing workbench shell. */
(() => {
  'use strict';
  const model = window.WorkbenchStudio;
  const dataKey = 'lg-workbench.studio-definitions.v1';
  const pageKey = 'lg-workbench.studio-page.v1';
  const instanceId = 'static-demo-v1';
  const pendingKey = `lg-workbench.studio-pending.${instanceId}`;
  const tabs = ['基础信息', '灵魂', 'Skills', 'MCP', '记忆', '知识库', '自进化', '运行轨迹'];
  const root = document.createElement('section');
  root.id = 'agent-studio'; root.hidden = true;
  root.setAttribute('aria-label', '智能体工作室');
  document.body.append(root);
  let store = model.initial();
  let page = null;
  let draft;
  let expected;
  let dirty = false;
  let trigger;
  let saving = false;
  let pending = null;
  let feedback = '';
  let definitionUnavailable = false;
  const versionFloor = { code: 1, review: 1 };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const button = (label, action, extra = '', primary = false) => `<button type="button" class="btn ${primary ? 'primary' : ''}" data-studio="${action}" ${extra}>${label}</button>`;
  const avatar = key => `<span class="studio-avatar ${key === 'review' ? 'review' : ''}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="${key === 'review' ? 'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Zm-4 9 3 3 5-6' : 'm8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18'}"/></svg></span>`;
  function workspace() {
    try {
      const raw = localStorage.getItem(window.WorkbenchWorkspace.key);
      if (raw === null) return { data: window.WorkbenchFixtures, state: { project: 'p1' } };
      return window.WorkbenchWorkspace.decode(raw, window.WorkbenchFixtures) || { data: { projects: [], sessions: [] }, state: {} };
    } catch { return { data: { projects: [], sessions: [] }, state: {} }; }
  }
  function notify(message) { feedback = message; const node = root.querySelector('.studio-feedback'); if (node) node.textContent = message; }
  function rememberPage() { try { if (page) { page.sectionId = model.sections[page.section]; page.definitionVersion = Math.max(page.definitionVersion || 1, expected, versionFloor[page.agent]); localStorage.setItem(pageKey, JSON.stringify(page)); } else localStorage.removeItem(pageKey); } catch { if (page) notify('浏览器无法保存工作室位置，刷新可能无法恢复。'); } }
  function position() {
    const main = document.querySelector('#app .workspace');
    if (!main) return;
    root.style.left = `${main.getBoundingClientRect().left}px`;
    main.inert = !!page;
    main.style.visibility = page ? 'hidden' : '';
  }
  function loadDraft() { draft = structuredClone(store[page.agent].versions.at(-1)); expected = store[page.agent].current; versionFloor[page.agent] = Math.max(versionFloor[page.agent], expected); dirty = false; }
  function readDefinitions(raw) {
    const latest = model.readForSave(raw, store);
    for (const key of Object.keys(versionFloor)) if (latest[key].current < versionFloor[key]) throw new Error('已保存版本缺失或被回退，请恢复配置');
    return latest;
  }
  function open(agent, origin) {
    if (!Object.hasOwn(model.definitions, agent)) return;
    if (!canLeave()) return;
    let warning = '';
    try {
      const raw = localStorage.getItem(dataKey);
      if (raw === null && definitionUnavailable) throw new Error('已保存配置尚未恢复');
      store = readDefinitions(raw); definitionUnavailable = false;
    } catch (error) { definitionUnavailable = true; warning = `读取配置失败：${error.message}。当前显示的内容未核对，不会用它覆盖存储。`; }
    trigger = origin;
    page = { instanceId, agent, section: 0 }; feedback = '';
    loadDraft(); root.hidden = false; render(); position(); rememberPage();
    if (warning) notify(warning);
    if (pending) recoverSave();
    root.querySelector('[data-studio="back"]').focus();
  }
  function canLeave() { if (saving) return false; return !dirty || window.confirm('有未保存的配置修改。确定放弃并离开？取消后可继续编辑或保存。'); }
  function close() {
    page = null; dirty = false; root.hidden = true; rememberPage(); position();
    if (trigger?.isConnected) trigger.focus();
  }
  function invoke(action, extra = {}) {
    const node = document.createElement('button');
    node.hidden = true; node.dataset.action = action; Object.assign(node.dataset, extra);
    document.body.append(node); node.click(); node.remove();
  }
  async function save(evolve = false) {
    if (saving) return;
    if (pending) { notify('上次保存结果待核对，请先查询原请求，不要重复保存。'); return; }
    if (!dirty && !evolve) { notify('当前没有待保存的修改。'); return; }
    if (evolve && dirty) { notify('先保存当前修改，再应用演示建议。'); return; }
    saving = true;
    root.querySelectorAll('input, textarea, button').forEach(node => { node.disabled = true; });
    let written = false;
    try {
      const raw = localStorage.getItem(dataKey);
      if (definitionUnavailable && raw === null) throw new Error('无法确认已保存配置，请恢复数据后重新打开工作室');
      const latest = readDefinitions(raw);
      const snapshot = evolve ? model.evolutionDraft(latest, page.agent, expected, true) : structuredClone(draft);
      const intent = await model.prepareSave(page.agent, expected, snapshot, crypto.randomUUID());
      const next = await model.commitSave(latest, intent, snapshot);
      // Hashing is asynchronous: re-read before writing, never overwrite a newer tab.
      if (JSON.stringify(model.readForSave(localStorage.getItem(dataKey), store)) !== JSON.stringify(latest)) throw new Error('配置版本已变化，请重新打开工作室');
      sessionStorage.setItem(pendingKey, JSON.stringify(intent)); pending = intent;
      localStorage.setItem(dataKey, JSON.stringify(next));
      written = true;
      const persisted = model.readForSave(localStorage.getItem(dataKey), latest);
      if (!model.lookupSave(persisted, intent)) throw new Error('尚未查到保存回执');
      sessionStorage.removeItem(pendingKey); pending = null;
      store = persisted; definitionUnavailable = false; loadDraft(); rememberPage();
      notify(`演示配置已保存为 v${expected}。新会话首次发送或新分支创建时才取最新版；旧会话、队列与复核沿用原绑定。真实运行装配待实现。`);
    } catch (error) {
      if (!written) { try { sessionStorage.removeItem(pendingKey); pending = null; } catch { /* Keep the reference when storage is unavailable. */ } }
      notify(`${written ? '保存结果待核对，刷新只查原请求' : '未保存'}：${error.message}。当前输入仍保留，未保存输入不跨刷新保存。`);
    } finally { saving = false; render(); }
  }
  function recoverSave() {
    if (!pending) return;
    try {
      const latest = readDefinitions(localStorage.getItem(dataKey));
      const result = model.lookupSave(latest, pending);
      if (!result) { notify('未查到原保存回执。未自动重存；可继续查询，或结束核对后重新编辑。'); return; }
      sessionStorage.removeItem(pendingKey); pending = null; store = latest; definitionUnavailable = false;
      if (!dirty) loadDraft();
      render(); rememberPage(); notify(`已核对原请求：${model.definitions[result.agent].name} v${result.version} 已保存，未新增版本。${dirty ? '当前输入未覆盖；重新打开后按最新版本修改。' : ''}`);
    } catch (error) { notify(`暂时无法核对：${error.message}。保留原请求，不自动重存。`); }
  }
  function field(label, key, multiline = false) { return `<label class="studio-field"><span>${label}</span>${multiline ? `<textarea data-studio-field="${key}">${esc(draft[key])}</textarea>` : `<input data-studio-field="${key}" value="${esc(draft[key])}">`}</label>`; }
  function rows() { return model.records(workspace().data, page.agent); }
  const statuses = { running: '执行中', stopped: '已停止', published: '报告已发布', idle: '未开始', waiting: '等待确认', blocked: '资源冲突', unknown: '待核对', failed: '失败', done: '已完成', stopping: '停止中', finishing: '收尾中', capturing: '取材中' };
  function traces(limit) {
    const items = rows().slice(0, limit);
    const projects = workspace().data.projects;
    return items.length ? items.map(item => `<div class="studio-row"><div><b>${esc(item.title)}</b><small>${esc(projects.find(project => project.id === item.project)?.name || '来源项目缺失')} · 时间未记录</small></div><span class="studio-tag">${esc(statuses[item.status] || '状态未知')}</span>${button('打开原会话', 'session', `data-id="${esc(item.id)}" data-project="${esc(item.project)}"`)}</div>`).join('') : '<div class="studio-empty">该智能体暂无运行记录。</div>';
  }
  function basics() {
    const capabilities = [...model.definitions[page.agent].capabilities.slice(0, 3), 'mcp'];
    return `<div class="studio-overview"><section class="studio-panel"><h2>定义它的工作</h2>${field('智能体名称', 'name')}${field('简短描述', 'description')}${field('主要职责', 'duties')}<label class="studio-field"><span>智能体标识 · 固定</span><input value="${draft.id}" readonly></label></section><div class="studio-overview-right"><section class="studio-panel"><div class="studio-panel-title"><h2>能力概览</h2>${button('管理', 'tab', 'data-tab="2"')}</div><div class="studio-cap-grid">${capabilities.map(key => `<button data-studio="tab" data-tab="${key === 'mcp' ? 3 : 2}"><b>${model.catalog[key][0]}</b><small>${draft.capabilities.includes(key) ? '已选用 · 演示' : '未启用'}</small></button>`).join('')}</div></section><section class="studio-panel"><div class="studio-panel-title"><h2>持续改进</h2><span class="studio-tag">设计示例</span></div><p>${page.agent === 'code' ? '在交付前补充空数据与中文编码检查。' : '在审查清单中补充证据来源及日期核对。'}</p>${button('查看证据与建议 →', 'tab', 'data-tab="6"')}</section></div><section class="studio-panel studio-wide"><div class="studio-panel-title"><h2>最近运行</h2>${button('全部记录', 'tab', 'data-tab="7"')}</div>${traces(3)}</section></div>`;
  }
  function soul() { return `<section class="studio-panel"><h2>灵魂</h2><p>定义这个智能体的个性：如何表达、如何判断，以及坚持什么工作原则。</p>${field('个性、表达方式与工作原则', 'role', true)}<p>项目记忆和规则由各项目根目录文件维护，不在工作室配置。平台计划只自动读取项目根目录到目标目录之间的 AGENTS.md；AGENT.md 和自定义记忆文件须明确选入材料。</p><p>旧 coding-agent 加载器还会读取全局目录和项目上级目录，不能直接当作项目隔离能力；Durable 不会自动加载这些规则。原型不读取磁盘。</p><p>审查保留所用项目规则与记忆的来源，恢复不把历史材料替换成当前源文件。项目规则不能放宽工具范围和审批规则。</p></section>`; }
  function capabilities() {
    const category = page.skillCategory || 'all';
    const items = model.definitions[page.agent].capabilities.map(key => ({ key, name: model.catalog[key][0], description: model.catalog[key][1], category: key === 'rules' || key === 'read' ? 'general' : page.agent === 'code' ? 'development' : 'review', enabled: draft.capabilities.includes(key) }));
    const uploaded = draft.uploadedSkills || [];
    const cards = items.filter(item => category === 'all' || category === item.category).map(item => `<label class="studio-skill-card"><div class="studio-skill-card-top"><span class="studio-skill-icon" aria-hidden="true">◇</span><input type="checkbox" data-capability="${item.key}" aria-label="选用${esc(item.name)}" ${item.enabled ? 'checked' : ''}></div><b>${esc(item.name)}</b><p>${esc(item.description)}</p><div class="studio-skill-meta"><span>${model.skillCategories[item.category]} · 工具能力</span><span>${item.enabled ? '已选用' : '未选用'}</span></div></label>`);
    if (category === 'all' || category === 'uploaded') cards.push(...uploaded.map(item => `<article class="studio-skill-card"><label class="studio-skill-selection"><div class="studio-skill-card-top"><span class="studio-skill-icon" aria-hidden="true">↥</span><input type="checkbox" data-uploaded-skill="${esc(item.id)}" aria-label="选用${esc(item.name)}" ${item.enabled ? 'checked' : ''}></div><b>${esc(item.name)}</b><p title="${esc(item.filename)}">${esc(item.filename)} · ${Math.max(1, Math.ceil(item.size / 1024))} KB</p></label><div class="studio-skill-meta"><span>技能包 · 未安装 · 演示</span><button type="button" data-studio="remove-skill" data-id="${esc(item.id)}" aria-label="移除${esc(item.name)}">移除</button></div></article>`));
    return `<section class="studio-panel"><div class="studio-panel-title"><h2>Skills</h2>${button('＋ 上传 Skill 包', 'upload-skill')}</div><p>按分类查看技能包和工具能力，选用后保存修改。</p><input type="file" id="studio-skill-upload" accept=".zip" hidden><nav class="studio-skill-tabs" aria-label="Skill 分类">${Object.entries(model.skillCategories).map(([key, name]) => { const count = key === 'all' ? items.length + uploaded.length : key === 'uploaded' ? uploaded.length : items.filter(item => item.category === key).length; return `<button type="button" data-studio="skill-category" data-category="${key}" aria-pressed="${key === category}">${name}<span>${count}</span></button>`; }).join('')}</nav><div class="studio-skill-grid">${cards.join('') || '<div class="studio-empty">该分类暂无内容。可上传 Skill 包。</div>'}</div><p class="studio-upload-hint">上传为演示：仅记录 ZIP 文件名和大小，不读取包内容、不安装。技能包不会自动获得工具权限。</p>${page.agent === 'review' ? '<div class="studio-note">审查智能体不提供源项目写入和编码 Code Mode。完全访问也不能改变这条边界。</div>' : ''}</section>`;
  }
  function mcp() { return `<section class="studio-panel"><h2>MCP</h2><p>选择该智能体使用的 MCP 能力。连接与凭据在全局管理，工作室不重复配置。</p><label class="studio-row"><div><b>${model.catalog.mcp[0]}</b><small>${model.catalog.mcp[1]}</small></div><span class="studio-tag">未连接 · 演示</span><input type="checkbox" data-capability="mcp" ${draft.capabilities.includes('mcp') ? 'checked' : ''}></label><p>选用不等于授权。调用仍须检查当前任务的资源范围和审批规则，不能跨项目读取材料。</p>${page.agent === 'review' ? '<div class="studio-note">审查只使用所选材料和独立检查副本，MCP 不能绕过源项目只读边界。</div>' : ''}</section>`; }
  function references(kind) { return `<section class="studio-panel"><h2>${kind}</h2><p>${kind === '记忆' ? '管理该智能体通用的长期偏好和经验，保留来源，可纠正。' : '管理供该智能体使用的通用参考资料，保留来源和版本。'}</p><div class="studio-empty">该智能体暂无已登记${kind}。<br>2.0 将在这里管理，原型不编造已导入的资料。</div><div class="studio-note">项目专属内容留在项目文件中，不自动汇入通用资料。正式保存须等资料、依赖清单和索引就绪，再切换新版本；旧会话继续引用旧版本。平台实际禁用或凭据失效会阻止后续准入，不撤回已发生的动作。</div></section>`; }
  function evolution() {
    const applied = !!draft.improvements[page.agent === 'code' ? 'delivery-boundaries' : 'evidence-sources'];
    const title = page.agent === 'code' ? '补充交付前边界检查' : '补充证据来源核对';
    return `<section class="studio-panel"><h2>自进化</h2><p>长期运行发现问题，形成建议；验证后由用户确认应用。</p><div class="studio-steps">发现问题 <span>→</span> 归并证据 <span>→</span> 验证改动 <span>→</span> 确认应用</div><article class="studio-proposal"><span class="studio-tag">模拟提案 · ${applied ? '已应用' : '待确认'}</span><h3>${title}</h3><p>示例用于展示改进流程，不代表系统已分析真实运行记录。</p><p>范围：当前智能体的新会话；旧会话和其他智能体保持原样。项目专属要求留在项目文件，提案不携带项目私有内容。</p><details><summary>证据与拟修改内容</summary><p>${page.agent === 'code' ? '模拟证据：两次交付遗漏空数据检查。拟增加空结果、中文编码核对清单。' : '模拟证据：材料结论缺少日期。拟增加出处、日期和原文一致性核对。'}</p><p>验证状态：模拟案例通过，尚无真实评测。涉及新增工具或代码时先开发和登记。</p></details><div class="studio-actions">${button(applied ? '已应用' : '确认应用演示建议', 'evolve', applied ? 'disabled' : '', true)}</div></article><p>应用前确认通用性和证据；完全访问不会自动批准自进化，也不自动修改项目文件。</p></section>`;
  }
  function render() {
    let content = [basics, soul, capabilities, mcp, () => references('记忆'), () => references('知识库'), evolution, () => `<section class="studio-panel"><h2>运行轨迹</h2><p>只看时间、项目、任务和状态，详细过程打开原会话。按固定智能体标识归属，不按可修改名称匹配。缺失时间不猜测。</p>${traces()}</section>`][page.section]();
    if (page.section === 2 || page.section === 3) content += '<div class="studio-note">取消勾选只修改下一版配置，旧会话继续沿用原能力清单。平台实际禁用、凭据失效或停止会阻止后续准入，不撤回已发生的动作；这里不是即时撤权入口。</div>';
    if (page.section === 6) content += `<div class="studio-note">证据引用：DEMO-${page.agent}-01（固定样例，非真实项目记录）。应用时重新核对样例与当前定义版本，实际增加通用规则；不复制项目对话、私有材料或整段运行历史。真实来源核验与评测待 2.0 实现。</div>`;
    root.innerHTML = `<header class="studio-top"><div>智能体工作室 <span>/</span> ${esc(draft.name)}</div><div><span class="studio-tag">B 版 · 2.0 预览</span>${button('返回工作台', 'back')}</div></header><div class="studio-scroll"><div class="studio-page"><section class="studio-hero">${avatar(page.agent)}<div class="studio-identity"><div><h1>${esc(draft.name)}</h1><span class="studio-tag">内置智能体</span><span class="studio-tag">v${expected}</span></div><p>${esc(draft.description)}</p></div><div class="studio-actions"><span class="studio-save-state">${dirty ? '有未保存修改' : '演示版本'}</span>${button('开始会话', 'start')}${button('保存修改', 'save', pending ? 'disabled' : '', true)}</div></section><p class="studio-policy">工作室配置仅新会话生效：首次发送或显式创建分支时取最新版，打开创建页不绑定。旧会话、队列、停后继续、同会话复核与刷新恢复沿用原定义。模型与运行参数使用全局设置。</p>${pending ? `<div class="studio-note">有保存请求待核对。刷新只查原回执，不自动重存。<div class="studio-actions">${button('查询原保存结果', 'query-save')}${button('结束本次核对', 'dismiss-save')}</div></div>` : ''}<nav class="studio-tabs" aria-label="工作室区域">${tabs.map((tab, index) => `<button data-studio="tab" data-tab="${index}" aria-current="${page.section === index ? 'page' : 'false'}">${tab}</button>`).join('')}</nav>${content}<p class="studio-feedback" role="status" aria-live="polite">${esc(feedback)}</p></div></div><footer class="studio-footer">静态设计预览 · 定义与回执为浏览器样例；未接真实会话装配、资料索引或 Durable</footer>`;
    if (saving) root.querySelectorAll('input, textarea, button').forEach(node => { node.disabled = true; });
  }
  function decorate() {
    for (const node of document.querySelectorAll('.agent-shortcut, .agent-card [data-action="new-session"]')) {
      node.title = '打开智能体工作室';
      const label = model.definitions[node.dataset.agent]?.name || '智能体';
      node.setAttribute('aria-label', `打开${label}工作室`);
      if (!node.classList.contains('agent-shortcut') && node.textContent !== '打开工作室') node.textContent = '打开工作室';
    }
    if (page) position();
  }
  document.addEventListener('click', event => {
    const card = event.target.closest('.agent-shortcut, .agent-card [data-action="new-session"]');
    if (card) { event.preventDefault(); event.stopImmediatePropagation(); open(card.dataset.agent, card); return; }
    if (!page || !event.target.closest('#app')) return;
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action && !['toggle-sidebar', 'toggle-theme', 'agent-view'].includes(action)) {
      if (!canLeave()) { event.preventDefault(); event.stopImmediatePropagation(); } else close();
    }
  }, true);
  root.addEventListener('click', event => {
    const node = event.target.closest('[data-studio]');
    if (!node || node.disabled || saving) return;
    const action = node.dataset.studio;
    if (action === 'upload-skill') root.querySelector('#studio-skill-upload').click();
    if (action === 'skill-category') { page.skillCategory = node.dataset.category; render(); rememberPage(); root.querySelector(`[data-category="${page.skillCategory}"]`).focus(); }
    if (action === 'remove-skill') { draft.uploadedSkills = (draft.uploadedSkills || []).filter(item => item.id !== node.dataset.id); dirty = true; render(); notify('已从待保存配置移除，保存后仅影响新会话。'); }
    if (action === 'save') save();
    if (action === 'query-save') recoverSave();
    if (action === 'dismiss-save' && window.confirm('结束核对不会重存或撤销已保存版本。保留当前输入，重新打开工作室后再编辑。')) {
      try { sessionStorage.removeItem(pendingKey); pending = null; render(); notify('已结束核对，未重新保存。'); } catch { notify('无法清理请求引用，请稍后重试。'); }
    }
    if (action === 'tab') { page.section = Number(node.dataset.tab); render(); rememberPage(); root.querySelector(`[data-tab="${page.section}"]`).focus(); }
    if (action === 'back' && canLeave()) close();
    if (action === 'start') {
      if (!canLeave()) return;
      const agent = page.agent; close(); invoke('new-session', { agent });
    }
    if (action === 'session' && canLeave()) {
      const id = node.dataset.id;
      if (!rows().some(item => item.id === id && item.project === node.dataset.project)) { render(); notify('原会话已失效或不属于当前智能体，请重新选择。'); return; }
      close(); invoke('session', { id });
    }
    if (action === 'evolve') save(true);
  });
  root.addEventListener('input', event => {
    const key = event.target.dataset.studioField;
    if (!key) return;
    draft[key] = event.target.value; dirty = true;
    root.querySelector('.studio-save-state').textContent = '有未保存修改';
  });
  root.addEventListener('change', event => {
    if (event.target.id === 'studio-skill-upload') {
      const file = event.target.files?.[0];
      if (!file) return;
      try { draft = model.addSkill(draft, file, crypto.randomUUID()); dirty = true; page.skillCategory = 'uploaded'; render(); rememberPage(); notify('已添加技能包演示记录。请保存修改；文件内容未上传或安装。'); }
      catch (error) { event.target.value = ''; notify(error.message); }
      return;
    }
    const skill = draft.uploadedSkills?.find(item => item.id === event.target.dataset.uploadedSkill);
    if (skill) { skill.enabled = event.target.checked; dirty = true; root.querySelector('.studio-save-state').textContent = '有未保存修改'; }
    const key = event.target.dataset.capability;
    if (key) { draft.capabilities = event.target.checked ? [...new Set([...draft.capabilities, key])] : draft.capabilities.filter(item => item !== key); dirty = true; root.querySelector('.studio-save-state').textContent = '有未保存修改'; const status = event.target.closest('.studio-skill-card')?.querySelector('.studio-skill-meta span:last-child'); if (status) status.textContent = event.target.checked ? '已选用' : '未选用'; }
  });
  window.addEventListener('beforeunload', event => { if (dirty || saving) { event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('storage', event => {
    if (!page) return;
    if (event.key === dataKey || event.key === null) notify('其他页面已修改或清理配置；当前输入保留，保存前会校验版本。');
    if (event.key === window.WorkbenchWorkspace.key || event.key === null) {
      render();
    }
  });
  window.addEventListener('resize', position);
  window.addEventListener('workbench-layout', position);
  new MutationObserver(decorate).observe(document.getElementById('app'), { childList: true, subtree: true });
  new ResizeObserver(position).observe(document.getElementById('app'));
  let startupWarning = '';
  try {
    const raw = localStorage.getItem(dataKey);
    if (raw !== null) {
      const decoded = model.decode(raw);
      if (decoded) store = decoded;
      else { definitionUnavailable = true; startupWarning = '配置缓存损坏；当前仅显示初始样例，保存不会覆盖损坏数据。'; }
    }
  } catch { definitionUnavailable = true; startupWarning = '读取配置失败；当前只显示初始样例，未把失败当作配置已删除。请重试。'; }
  try {
    const raw = sessionStorage.getItem(pendingKey);
    if (raw !== null) { pending = JSON.parse(raw); if (!model.validIntent(pending)) pending = { invalid: true }; }
  } catch { pending = { invalid: true }; }
  try {
    const saved = JSON.parse(localStorage.getItem(pageKey) || 'null');
    page = model.pageReference(saved, instanceId);
    if (page) {
      versionFloor[page.agent] = Math.max(versionFloor[page.agent], page.definitionVersion || 1);
      if (page.definitionVersion > store[page.agent].current) { definitionUnavailable = true; startupWarning = '已保存版本缺失或被回退。当前内容未核对，保留原版本引用；请恢复配置，不会自动重存。'; }
      loadDraft(); root.hidden = false; render(); position();
      rememberPage();
      if (startupWarning) notify(startupWarning);
      if (pending) recoverSave();
    } else if (saved) {
      localStorage.removeItem(pageKey);
      invoke('agents');
    }
  } catch { /* Invalid page state falls back to the workbench. */ }
  decorate();
})();
