// Reading order: entry -> assembly -> execution -> persistence -> presentation.
// Independent SDKs and optional paths do not form a single runtime trace.
export const moduleOrder = ['coding', 'agent', 'ai', 'durable', 'sqlite', 'tui', 'native', 'chord', 'client', 'protocol', 'server', 'experimental', 'telemetry', 'examples', 'evals', 'engineering'];
export const featureOrder = {
  coding: ['startup', 'settings', 'trust', 'packages', 'resources', 'extensions', 'skills', 'templates', 'auth', 'models', 'virtual', 'llama', 'sdk', 'sessions', 'system', 'input', 'interactive', 'print', 'rpc', 'keys', 'clipboard', 'prompt', 'tool-support', 'read', 'grep', 'find', 'ls', 'edit', 'write', 'bash', 'powershell', 'compaction', 'branch', 'cache', 'export', 'components', 'theme', 'http', 'diagnostics'],
  agent: ['harness', 'session', 'context', 'execution', 'loop', 'tools', 'drive', 'search', 'proxy', 'pico'],
  ai: ['contracts', 'catalog', 'auth', 'api', 'images', 'utilities', 'compat', 'cli'],
  durable: ['records', 'session', 'harness', 'env', 'memory', 'jsonl', 'sqlite', 'testing'],
  tui: ['input', 'complete', 'components', 'render', 'text', 'color', 'image'],
  chord: ['json', 'context', 'facets', 'services', 'delta', 'bundle'],
  client: ['transport', 'client', 'errors'],
  protocol: ['envelope', 'codec', 'cbor'],
  server: ['transport', 'route', 'testing'],
  experimental: ['plugins', 'services', 'workers', 'clients', 'mini', 'micro'],
  telemetry: ['schema', 'adapters', 'conformance'],
  evals: ['runner', 'report'],
  engineering: ['checks', 'catalog', 'analysis', 'release']
};

export function compareFeatures(a, b) {
  const moduleRank = id => moduleOrder.indexOf(id) < 0 ? moduleOrder.length : moduleOrder.indexOf(id);
  const rank = feature => {
    if (feature.id.endsWith('-support')) return 10000;
    const keys = featureOrder[feature.module] || [];
    const index = keys.indexOf(feature.id.slice(feature.module.length + 1));
    if (index >= 0) return index;
    if (feature.module === 'examples') return feature.id.startsWith('example-sdk-') ? 100 : feature.id.startsWith('example-extensions-') ? 200 : 300;
    return 1000;
  };
  return moduleRank(a.module) - moduleRank(b.module) || rank(a) - rank(b);
}
