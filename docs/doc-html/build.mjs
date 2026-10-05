import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, cpSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chapters, packageNotes, trace } from './src/content.mjs';
import { buildCatalog } from './src/catalog.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(dir, '../..');
const read = path => readFileSync(join(root, path), 'utf8');
const git = args => execFileSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
const sha = value => createHash('sha256').update(value).digest('hex');
mkdirSync(join(dir, 'diagrams'), { recursive: true });
mkdirSync(join(dir, 'data'), { recursive: true });
const original = join(root, '图架构');
const archived = join(dir, 'diagrams', 'original');
// Preserve every supplied file once. Future builds do not need the old directory.
if (!existsSync(archived) && existsSync(original)) cpSync(original, archived, { recursive: true });
const diagramSpecs = [
  ['架构图', 'pi-system-architecture.html', '系统架构', '先看职责边界，再看包之间如何协作。'],
  ['工作流图', 'pi-task-workflow.html', '任务工作流', '从用户目标到工具执行与结果返回。'],
  ['时序图', 'pi-task-sequence.html', '执行时序', '观察不同参与者之间的调用顺序。'],
  ['数据流图', 'pi-task-dataflow.html', '数据流转', '追踪输入、上下文、模型响应与持久化数据。'],
  ['生命周期图', 'pi-task-lifecycle.html', '生命周期', '观察任务状态和结束、恢复边界。']
];
const diagrams = diagramSpecs.map(([folder, file, title, description]) => {
  let html = readFileSync(join(archived, folder, file), 'utf8');
  html = html.replace(/<link\b[^>]*href=["']https?:[^>]*>/gi, '');
  const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src blob: data:; worker-src blob:; connect-src 'none'">`;
  html = html.replace(/<head([^>]*)>/i, `<head$1>${policy}`);
  writeFileSync(join(dir, 'diagrams', file), html);
  return { file, title, description, html, hash: sha(html) };
});

const notes = JSON.parse(readFileSync(join(dir, 'src/history-notes.json'), 'utf8'));
const labels = { feat: '新增能力', fix: '修复问题', docs: '更新文档', refactor: '重构实现', test: '调整测试', chore: '维护整理', perf: '性能优化', build: '构建调整', ci: '持续集成调整', revert: '回退变更', style: '格式与样式调整' };
const themes = [[/extension|plugin/i, '扩展机制'], [/tool/i, '工具执行'], [/session|compaction/i, '会话与上下文'], [/model|provider|anthropic|openai|gemini|claude/i, '模型接入'], [/render|terminal|autocomplete|editor|tui/i, '终端交互'], [/storage|sqlite|jsonl|durable/i, '持久化'], [/chord|delta|facet/i, '应用组合与状态'], [/release|version/i, '版本发布'], [/security|sandbox|trust/i, '信任与隔离']];
const log = git(['log', 'HEAD', '--date-order', '--format=%x1e%H%x1f%aI%x1f%an%x1f%P%x1f%B%x1f', '--numstat', '--no-renames']);
const commits = log.split('\x1e').filter(Boolean).map(record => {
  const [hash, date, author, parents, body, stats = ''] = record.split('\x1f');
  const subject = body.trim().split('\n')[0];
  const files = stats.trim().split('\n').filter(Boolean).map(line => {
    const [added, removed, ...parts] = line.split('\t');
    return { path: parts.join('\t'), added, removed };
  }).filter(f => f.path);
  const type = subject.match(/^([a-z]+)(?:\([^)]*\))?!?:/)?.[1] || (parents.trim().split(' ').length > 1 ? 'merge' : 'other');
  const scopes = [...new Set(files.map(f => f.path.match(/^packages\/([^/]+)/)?.[1] || '仓库级'))];
  const topics = themes.filter(([pattern]) => pattern.test(subject)).map(([, label]) => label);
  const added = files.reduce((sum, f) => sum + (Number(f.added) || 0), 0);
  const removed = files.reduce((sum, f) => sum + (Number(f.removed) || 0), 0);
  const verb = type === 'merge' ? '合并历史' : labels[type] || '提交变更';
  const zh = notes[hash] || `${verb}；${topics.length ? `主题线索：${topics.join('、')}。` : ''}涉及 ${scopes.join('、') || '未列出文件'}，记录 ${files.length} 个文件的变动、文本新增 ${added} 行 / 删除 ${removed} 行。${type === 'merge' ? '合并提交的常规 numstat 可能为空，请结合父提交理解。' : '具体改动意图见原始提交说明与文件清单。'}`;
  return { hash, date, author, parents: parents.split(' ').filter(Boolean), subject, body: body.trim(), files, scopes, type, added, removed, zh, curated: Boolean(notes[hash]) };
});

const packages = Object.entries(packageNotes).map(([path, description]) => {
  const pkg = JSON.parse(read(`packages/${path}/package.json`));
  return { path, name: pkg.name, version: pkg.version, description, dependencies: Object.keys(pkg.dependencies || {}).filter(x => x.startsWith('@earendil-works/')) };
});
const allPaths = git(['ls-files', '-z']).split('\0').filter(Boolean);
const { catalog, snapshots } = buildCatalog({ paths: allPaths, read, commits });
const selected = new Set(chapters.flatMap(c => c.sections.flatMap(s => (s.refs || []).map(r => r[0]))));
for (const t of trace) selected.add(t[3]);
for (const pkg of packages) {
  selected.add(`packages/${pkg.path}/package.json`);
  if (existsSync(join(root, `packages/${pkg.path}/README.md`))) selected.add(`packages/${pkg.path}/README.md`);
}
for (const file of ['README.md', 'AGENTS.md', 'packages/coding-agent/src/core/extensions/types.ts', 'packages/coding-agent/docs/configuration.md', 'packages/coding-agent/docs/custom-provider.md', 'packages/coding-agent/docs/session-format.md']) selected.add(file);
const sources = { ...snapshots, ...Object.fromEntries([...selected].sort().map(path => [path, read(path)])) };
for (const c of chapters) for (const s of c.sections) for (const [path, needle] of s.refs || []) {
  if (!sources[path].includes(needle)) throw new Error(`引用失效: ${path} :: ${needle}`);
}
const sourceHashes = Object.fromEntries(Object.entries(sources).map(([p, v]) => [p, sha(v)]));
const trackedPaths = git(['ls-files', '--', 'packages', 'scripts', '.pi']).trim().split('\n');
const data = { chapters, trace, packages, sources, sourceHashes, diagrams, commits, trackedPaths, catalog, meta: {
  commit: git(['rev-parse', 'HEAD']).trim(), branch: git(['branch', '--show-current']).trim(), builtAt: new Date().toISOString(),
  shallow: git(['rev-parse', '--is-shallow-repository']).trim() === 'true', status: git(['status', '--short', '--', 'packages', 'scripts']).trim(),
  historyScope: '本地 HEAD 可达的全部提交；按 Git date-order 排列。合并关系保留父提交 ID。'
}};
const serialized = JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const template = readFileSync(join(dir, 'src/template.html'), 'utf8');
const css = readFileSync(join(dir, 'src/style.css'), 'utf8') + '\n' + readFileSync(join(dir, 'src/features.css'), 'utf8');
const js = ['feature-flow.js', 'features-app.js', 'app.js'].map(file => readFileSync(join(dir, 'src', file), 'utf8')).join('\n');
const output = template.replace('/* INLINE_STYLE */', () => css).replace('/* INLINE_DATA */', () => serialized).replace('/* INLINE_APP */', () => js);
writeFileSync(join(dir, 'index.html'), output);
writeFileSync(join(dir, 'data/history.json'), JSON.stringify(commits, null, 2));
writeFileSync(join(dir, 'data/features.json'), JSON.stringify(catalog, null, 2));
writeFileSync(join(dir, 'data/manifest.json'), JSON.stringify({ ...data.meta, sourceHashes, diagramHashes: Object.fromEntries(diagrams.map(d => [d.file, d.hash])), commitCount: commits.length, catalog: catalog.stats }, null, 2));
console.log(`已生成 ${relative(root, join(dir, 'index.html'))}: ${commits.length} 条提交 / ${Object.keys(sources).length} 份源码与文档 / ${catalog.stats.features} 项功能与索引 / ${catalog.stats.files} 个归属文件 / ${catalog.stats.symbols} 个声明 / ${(Buffer.byteLength(output) / 1024 / 1024).toFixed(1)} MiB`);
