import { masteryStages, masteryGlossary, masteryRoutes } from './mastery-curriculum.mjs';

// 编号级的延伸实践归属。主线经既有“编号 → 源码专题”映射关联；示例与方案另行标注。
const supplements = {
  'extension-lifecycle': ['OTH-08', 'OTH-09', 'OTH-12', 'OTH-13', 'OTH-14', 'OTH-39', 'OTH-51', 'OTH-55'],
  'extension-ui': ['OTH-10', 'OTH-11', 'OTH-15', 'OTH-27', 'OTH-28', 'OTH-29', 'OTH-30', 'OTH-32', 'OTH-34', 'OTH-35', 'OTH-36', 'OTH-37', 'OTH-38', 'OTH-49'],
  'change-deliver': ['OTH-01', 'OTH-02', 'OTH-03', 'OTH-04', 'OTH-05', 'OTH-43', 'OTH-44'],
  'remote-env': ['OTH-06', 'OTH-07', 'OTH-17', 'OTH-78', 'OTH-79', 'OTH-80'],
  'sdk-rpc': ['OTH-18', 'OTH-19', 'OTH-20', 'OTH-24', 'OTH-25', 'OTH-31', 'OTH-33'],
  'config-scope': ['OTH-21'],
  'tool-exposure': ['OTH-22', 'OTH-23'],
  'process-tools': ['OTH-16', 'OTH-40', 'OTH-41'],
  'tui-input': ['OTH-26', 'OTH-77'],
  'queue-cancel': ['OTH-42'],
  'prompt-resources': ['OTH-45', 'OTH-48'],
  'context-budget': ['OTH-46'],
  'tui-render': ['OTH-47'],
  'telemetry-diagnostics': ['OTH-50'],
  'session-restore': ['OTH-52'],
  'provider-request': ['OTH-53'],
  'special-models': ['OTH-54'],
  'release-upgrade': ['OTH-82'],
  'design-history': ['OTH-89']
};
const providers = ['openai','openai-codex','anthropic','google','google-vertex','azure','amazon-bedrock','radius','openrouter','vercel-ai-gateway','github-copilot','cloudflare-ai-gateway','cloudflare-workers-ai','typesafe','deepseek','ant-ling','nvidia','mistral','xai','groq','cerebras','together','baseten','fireworks','huggingface','meta','opencode','opencode-go','moonshotai','moonshotai-cn','kimi-coding','minimax','minimax-cn','zai','zai-coding-cn','qwen-token-plan','qwen-token-plan-individual','qwen-token-plan-cn','xiaomi','xiaomi-token-plan-cn','xiaomi-token-plan-ams','xiaomi-token-plan-sgp'];
const unique = items => [...new Set(items)];

export function buildMastery({ catalog, sources, plan, routes = masteryRoutes }) {
  const historicalRoutes = routes.filter(r => r.steps.every(s => catalog.retiredFeatures?.includes(s.feature)));
  routes = routes.filter(r => !historicalRoutes.includes(r));
  const byId = new Map(routes.map(r => [r.id, r]));
  if (byId.size !== routes.length) throw new Error('路线 ID 重复');
  const visiting = new Set(), visited = new Set();
  function visit(id) {
    if (!byId.has(id)) throw new Error(`先修路线不存在: ${id}`);
    if (visiting.has(id)) throw new Error(`先修循环: ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const parent of byId.get(id).prerequisite) visit(parent);
    visiting.delete(id); visited.add(id);
  }
  routes.forEach(r => visit(r.id));
  const features = new Map(catalog.features.map(f => [f.id, f]));
  const capabilities = new Map(catalog.capabilities.map(c => [c.id, c]));
  const compiled = routes.map(r => {
    if (!masteryStages.some(s => s.id === r.stage)) throw new Error(`阶段不存在: ${r.stage}`);
    const topicIds = unique([...r.steps.map(s => s.feature), ...r.extra, ...(r.id === 'provider-request' ? providers.map(p => `ai-provider-${p}`) : [])]);
    for (const id of topicIds) if (!features.has(id)) throw new Error(`源码专题不存在: ${id}`);
    const directIds = [...(supplements[r.id] || []), ...(r.id === 'design-history' ? catalog.capabilities.filter(c => c.status === '历史资料').map(c => c.id) : [])];
    for (const id of directIds) if (!capabilities.has(id)) throw new Error(`延伸编号不存在: ${id}`);
    const linked = catalog.capabilities.filter(c => directIds.includes(c.id) || c.relatedFeatures.some(id => topicIds.includes(id)));
    const topics = unique([...topicIds, ...linked.flatMap(c => c.relatedFeatures)]).map(id => features.get(id));
    const files = unique(topics.flatMap(f => f.files)).filter(p => Object.hasOwn(sources, p));
    const docs = unique([...topics.flatMap(f => f.docs), ...linked.flatMap(c => c.docs)]).filter(p => Object.hasOwn(sources, p));
    const tests = unique(topics.flatMap(f => f.tests || [])).filter(p => Object.hasOwn(sources, p));
    const steps = r.steps.map((s, index) => {
      const f = features.get(s.feature);
      const refs = f.files.filter(p => Object.hasOwn(sources, p)).map(path => ({ path, line: 1 }));
      if (!refs.length) throw new Error(`步骤无源码依据: ${r.id}/${index + 1}`);
      for (const key of ['title', 'explain', 'input', 'output']) if (!s[key]) throw new Error(`步骤缺少 ${key}: ${r.id}`);
      return { ...s, id: `${r.id}:${index + 1}`, refs, entry: f.entry, behavior: f.behavior, topicTitle: f.title };
    });
    const slides = [
      { angle: '场景与目标', title: r.title, points: [r.scenario, `起点：${steps[0].input}`, `完成信号：${steps.at(-1).output}`], notes: `先用自己的话复述场景，再说清成功标准。${r.exercise}` },
      { angle: '职责与边界', title: '谁接收，谁处理，谁负责结果', points: unique(steps.map(s => `${s.topicTitle}：${s.entry}`)), notes: steps.map(s => `${s.title}：${s.behavior}`).join('\n') },
      { angle: '时序与动作', title: '沿着小步骤跟一次执行', points: steps.map((s, i) => `${i + 1}. ${s.title}`), notes: steps.map((s, i) => `${i + 1}. ${s.explain}`).join('\n') },
      { angle: '数据与状态', title: '每个边界的数据怎样变化', points: steps.map(s => `${s.input} → ${s.output}`), notes: '逐步打开对应源码，确认数据结构和提交/可见时机。这里是教学阅读顺序，分支不意味着每次运行都经过。' },
      { angle: '失败与恢复', title: '成功路径之外必须理解什么', points: [r.failure], notes: `从失败位置回到最近一次已确认输出，再检查下一步输入是否满足契约。结合关联测试验证：${r.answer}` },
      { angle: '练习与验证', title: '把看懂变成能解释、能验证', points: [r.exercise, `参考判断：${r.answer}`], notes: '先独立作答，再对照参考判断；记录源码路径、测试名称、预期和实际。学习勾选不表示测试已经运行。' }
    ];
    return { ...r, steps, topicIds: topics.map(f => f.id), capabilities: linked.map(c => ({ id: c.id, title: c.title, purpose: c.purpose, status: c.status, kind: directIds.includes(c.id) ? (c.relatedFeatures.length ? '延伸示例' : '文档方案') : '专题关联', relatedFeatures: c.relatedFeatures })), files, docs, tests, packages: unique(files.map(p => /^packages\/([^/]+)\//.exec(p)?.[1]).filter(Boolean)), slides };
  });
  const coverage = catalog.capabilities.map(c => ({ id: c.id, title: c.title, routes: compiled.filter(r => r.capabilities.some(item => item.id === c.id)).map(r => r.id) }));
  const missing = coverage.filter(c => !c.routes.length);
  if (missing.length) throw new Error(`路线未覆盖编号: ${missing.map(c => c.id).join(', ')}`);
  return { stages: masteryStages, glossary: masteryGlossary, routes: compiled, coverage, plan, stats: { routes: compiled.length, steps: compiled.reduce((n, r) => n + r.steps.length, 0), slides: compiled.length * 6, capabilities: coverage.length } };
}
