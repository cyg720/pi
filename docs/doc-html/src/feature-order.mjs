// Reading order: entry -> assembly -> execution -> persistence -> presentation.
// Independent SDKs and optional paths do not form a single runtime trace.
export const moduleOrder = ['coding', 'agent', 'ai', 'codemode', 'mcp', 'durable', 'env', 'tui', 'native', 'chord', 'telemetry', 'examples', 'agent-examples', 'durable-examples', 'evals', 'engineering'];
export const featureOrder = {
  env: ['ssh', 'remote', 'terminal'],
  coding: ['startup', 'settings', 'trust', 'packages', 'resources', 'builtin', 'extensions', 'mcp-config', 'mcp-auth', 'mcp-management', 'mcp-runtime', 'mcp-tools', 'mcp-resources', 'skills', 'templates', 'auth', 'models', 'virtual', 'llama', 'sdk', 'sessions', 'system', 'input', 'interactive', 'fullscreen', 'print', 'rpc', 'keys', 'clipboard', 'prompt', 'run-triggers', 'loadout', 'tool-search', 'codemode', 'codemode-store', 'codemode-models', 'output-files', 'nested-tools', 'tool-support', 'read', 'grep', 'find', 'ls', 'edit', 'write', 'bash', 'powershell', 'compaction', 'branch', 'cache', 'export', 'components', 'theme', 'system-theme', 'radius-login', 'catalog-refresh', 'http', 'diagnostics', 'source-checkout'],
  agent: ['loop', 'run-tool', 'proxy'],
  codemode: ['source', 'declarations', 'wasm', 'host', 'deterministic', 'worker', 'store', 'output'],
  mcp: ['client', 'stdio', 'http', 'oauth-discovery', 'oauth-callback', 'oauth-flow', 'content', 'testing'],
  ai: ['contracts', 'catalog', 'auth', 'openrouter-catalog', 'chatgpt-login', 'oauth-remote', 'federation', 'api', 'strict-tools', 'classifiers', 'images', 'utilities', 'compat', 'cli'],
  durable: ['records', 'session', 'harness', 'registry', 'agent-config', 'prompt', 'inbox', 'input-entries', 'generation', 'tool-tasks', 'tool-search', 'codemode', 'codemode-discovery', 'codemode-models', 'codemode-output', 'env', 'coding-tools', 'watch', 'compaction', 'blocking-compaction', 'subagents', 'task-graph', 'views', 'events', 'usage', 'memory', 'jsonl', 'sqlite', 'testing'],
  tui: ['input', 'wheel', 'complete', 'editing-history', 'layout', 'components', 'render', 'search', 'text', 'color', 'image'],
  chord: ["contracts","host","state","links","reload","registry","manager","delta","context","json"],
  telemetry: ['schema', 'adapters', 'conformance'],
  evals: ['runner', 'report'],
  engineering: ['checks', 'catalog', 'model-hydration', 'install-lock', 'analysis', 'release']
};

export function compareFeatures(a, b) {
  const moduleRank = id => moduleOrder.indexOf(id) < 0 ? moduleOrder.length : moduleOrder.indexOf(id);
  const rank = feature => {
    if (feature.id.endsWith('-support') || feature.id.includes('-support-')) return 10000;
    const keys = featureOrder[feature.module] || [];
    const index = keys.indexOf(feature.id.slice(feature.module.length + 1));
    if (index >= 0) return index;
    if (feature.module === 'examples') return feature.id.startsWith('example-sdk-') ? 100 : feature.id.startsWith('example-extensions-') ? 200 : 300;
    return 1000;
  };
  return moduleRank(a.module) - moduleRank(b.module) || rank(a) - rank(b);
}
