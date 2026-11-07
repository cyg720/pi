/* Static studio design data only. No runtime, tool loading or model requests. */
(() => {
  'use strict';
  const sections = ['basics', 'soul', 'skills', 'mcp', 'memory', 'knowledge', 'evolution', 'traces'];
  const skillCategories = { all: '全部', development: '开发', review: '审查', general: '通用', uploaded: '已上传' };
  function addSkill(draft, file, id) {
    if (!file || typeof file.name !== 'string' || !/\.zip$/i.test(file.name) || file.name.length > 200 || /[\\/\u0000-\u001f]/u.test(file.name) || !Number.isSafeInteger(file.size) || file.size <= 0) throw new Error('请选择非空 ZIP 技能包');
    if (draft.uploadedSkills?.some(item => item.filename.toLowerCase() === file.name.toLowerCase())) throw new Error('同名技能包已添加');
    const next = structuredClone(draft);
    next.uploadedSkills = [...(next.uploadedSkills || []), { id, name: file.name.slice(0, -4), filename: file.name, size: file.size, enabled: true }];
    return next;
  }
  const definitions = {
    code: { id: 'lg-codeing-agent', name: '编码智能体', description: '理解项目，完成代码开发、修改与检查。', duties: '代码开发、问题定位、重构与检查', role: '先读取项目规则，再进行修改。用检查结果说明完成情况，明确未验证的部分。', capabilities: ['read', 'write', 'check', 'rules'] },
    review: { id: 'lg-examine', name: '审查智能体', description: '独立核对交付结果，让每一个结论都有证据。', duties: '验收审查、证据核对、持续复查', role: '按用户的审查要求核对证据，主动寻找反例；证据不足时明确说明，不修改源项目。', capabilities: ['evidence', 'review-check', 'rules'] },
  };
  const catalog = {
    read: ['项目读取', '读取当前项目内的文件'], write: ['项目修改', '编码专用；仍遵守审批和资源占用'],
    check: ['执行检查', '在编码执行环境中检查结果'], rules: ['项目规则', '拟由平台限定项目根到目标目录；原型不读取磁盘'],
    evidence: ['快照取证', '读取已选只读材料'], 'review-check': ['指定检查', '使用独立检查副本，不写源项目'],
    mcp: ['MCP 文档检索', '引用全局登记能力；调用时校验任务资源范围，本原型未连接'],
  };
  function initial() {
    return Object.fromEntries(Object.entries(definitions).map(([key, value]) => [key, { id: value.id, current: 1, versions: [{ ...structuredClone(value), version: 1, improvements: {} }] }]));
  }
  function validate(key, draft) {
    if (!Object.hasOwn(definitions, key) || !draft || draft.id !== definitions[key].id) throw new Error('智能体标识不匹配');
    if (typeof draft.name !== 'string' || !draft.name.trim() || [...draft.name.trim()].length > 80 || /[\u0000-\u001f]/u.test(draft.name)) throw new Error('名称需为 1—80 个字符');
    for (const field of ['description', 'duties', 'role']) if (typeof draft[field] !== 'string' || draft[field].length > 10000) throw new Error('配置内容无效');
    const allowed = [...definitions[key].capabilities, 'mcp'];
    if (!Array.isArray(draft.capabilities) || draft.capabilities.some(value => !allowed.includes(value))) throw new Error('包含当前智能体不支持的能力');
    if (draft.uploadedSkills !== undefined) {
      if (!Array.isArray(draft.uploadedSkills)) throw new Error('技能包记录无效');
      const ids = new Set(); const names = new Set();
      for (const item of draft.uploadedSkills) {
        if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id) || typeof item.filename !== 'string' || !/\.zip$/i.test(item.filename) || item.filename.length > 200 || /[\\/\u0000-\u001f]/u.test(item.filename) || names.has(item.filename.toLowerCase()) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 200 || !Number.isSafeInteger(item.size) || item.size <= 0 || typeof item.enabled !== 'boolean') throw new Error('技能包记录无效');
        ids.add(item.id); names.add(item.filename.toLowerCase());
      }
    }
    if (!draft.improvements || typeof draft.improvements !== 'object' || Array.isArray(draft.improvements)) throw new Error('改进记录无效');
    if (Object.entries(draft.improvements).some(([id, value]) => !id || ['__proto__', 'constructor', 'prototype'].includes(id) || value !== true)) throw new Error('改进范围或状态无效');
  }
  function decode(raw) {
    try {
      const result = JSON.parse(raw);
      for (const key of Object.keys(definitions)) {
        const item = result[key];
        if (item.id !== definitions[key].id || !Array.isArray(item.versions) || item.current !== item.versions.length || !item.current) return null;
        item.versions.forEach((value, index) => { validate(key, value); if (value.version !== index + 1) throw new Error('版本不连续'); });
      }
      if (result.saveReceipts !== undefined) {
        if (!Array.isArray(result.saveReceipts)) return null;
        const ids = new Set();
        for (const receipt of result.saveReceipts) {
          if (!validIntent(receipt) || ids.has(receipt.requestId) || receipt.version !== receipt.expected + 1 || !result[receipt.agent].versions[receipt.version - 1]) return null;
          ids.add(receipt.requestId);
        }
      }
      return result;
    } catch { return null; }
  }
  function save(store, key, expected, draft) {
    if (store[key]?.current !== expected) throw new Error('配置版本已变化，请重新打开工作室后修改');
    validate(key, draft);
    const next = structuredClone(store);
    const version = expected + 1;
    const proposal = key === 'code' ? 'delivery-boundaries' : 'evidence-sources';
    const improvements = draft.improvements[proposal] ? { [proposal]: true } : {};
    next[key].versions.push({ ...definitionValue(draft), name: draft.name.trim(), improvements, version });
    next[key].current = version;
    return next;
  }
  function readForSave(raw, previous) {
    if (raw === null) {
      if (Object.keys(definitions).some(key => previous[key].current !== 1)) throw new Error('已保存配置被移除，请重新打开工作室');
      return initial();
    }
    const value = decode(raw);
    if (!value) throw new Error('配置缓存损坏，未覆盖原数据');
    return value;
  }
  function records(data, agent) {
    return data.sessions.filter(item => item.agent === agent && data.projects.some(project => project.id === item.project));
  }
  function evolutionDraft(store, key, expected, evidenceAvailable) {
    if (!evidenceAvailable) throw new Error('提案证据无法核对，未应用');
    if (store[key]?.current !== expected) throw new Error('配置版本已变化，请重新打开工作室后修改');
    const proposal = key === 'code' ? 'delivery-boundaries' : 'evidence-sources';
    const draft = structuredClone(store[key].versions.at(-1));
    if (draft.improvements[proposal]) throw new Error('当前智能体已应用');
    // Legacy project flags remain historical; they never become agent-wide approvals.
    draft.improvements = { [proposal]: true };
    draft.role += key === 'code' ? '\n交付前核对空数据与中文编码，明确未验证项。' : '\n核对证据出处、日期及原文一致性；缺失时明确说明。';
    return draft;
  }
  function applyEvolution(store, key, expected) { return save(store, key, expected, evolutionDraft(store, key, expected, true)); }
  function definitionValue(draft) {
    const value = Object.fromEntries(['id', 'name', 'description', 'duties', 'role', 'capabilities', 'improvements'].map(key => [key, structuredClone(draft[key])]));
    if (draft.uploadedSkills !== undefined) value.uploadedSkills = draft.uploadedSkills.map(({ id, name, filename, size, enabled }) => ({ id, name, filename, size, enabled }));
    return value;
  }
  function validIntent(value) {
    return value && Object.hasOwn(definitions, value.agent) && typeof value.requestId === 'string' && value.requestId.length > 0 && typeof value.fingerprint === 'string' && /^[a-f0-9]{64}$/.test(value.fingerprint) && Number.isInteger(value.expected) && value.expected > 0;
  }
  async function prepareSave(agent, expected, draft, requestId) {
    validate(agent, draft);
    const bytes = new TextEncoder().encode(JSON.stringify({ agent, expected, definition: definitionValue(draft) }));
    const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
    const intent = { requestId, agent, expected, fingerprint };
    if (!validIntent(intent)) throw new Error('保存请求无效');
    return intent;
  }
  function lookupSave(store, intent) {
    const found = store.saveReceipts?.find(value => value.requestId === intent.requestId);
    if (found && (found.fingerprint !== intent.fingerprint || found.agent !== intent.agent || found.expected !== intent.expected)) throw new Error('保存请求与回执不匹配');
    if (!validIntent(intent)) throw new Error('保存请求无效');
    return found || null;
  }
  async function commitSave(store, intent, draft) {
    const checked = await prepareSave(intent.agent, intent.expected, draft, intent.requestId);
    if (checked.fingerprint !== intent.fingerprint) throw new Error('保存输入与请求不匹配');
    if (lookupSave(store, intent)) return structuredClone(store);
    const next = save(store, intent.agent, intent.expected, draft);
    next.saveReceipts = [...(store.saveReceipts || []), { ...intent, version: next[intent.agent].current }];
    return next;
  }
  function pageReference(value, instanceId) {
    if (!value || (value.instanceId !== undefined && value.instanceId !== instanceId) || !Object.hasOwn(definitions, value.agent)) return null;
    const legacySections = ['basics', 'soul', 'skills', 'memory', 'knowledge', 'evolution', 'traces'];
    const id = value.sectionId === undefined ? (Number.isInteger(value.section) ? legacySections[value.section] : undefined) : value.sectionId;
    const section = Math.max(0, sections.indexOf(id));
    const result = { instanceId, agent: value.agent, section, sectionId: sections[section] };
    if (Object.hasOwn(skillCategories, value.skillCategory)) result.skillCategory = value.skillCategory;
    if (Number.isInteger(value.definitionVersion) && value.definitionVersion > 0) result.definitionVersion = value.definitionVersion;
    return result;
  }
  window.WorkbenchStudio = { initial, decode, save, applyEvolution, evolutionDraft, readForSave, records, definitions, catalog, prepareSave, commitSave, lookupSave, validIntent, pageReference, sections, skillCategories, addSkill };
})();
