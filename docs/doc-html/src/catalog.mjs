import ts from 'typescript';
import { posix } from 'node:path';
import { featureModules, featureSpecs } from './features.mjs';
import { moduleOrder, compareFeatures } from './feature-order.mjs';

const scriptFile = /\.(?:[cm]?ts|tsx|[cm]?js|jsx)$/;
const testFile = /(?:\/test[s]?\/|\.(?:test|spec)\.[^.]+$)/;
const textFile = /\.(?:[cm]?[jt]sx?|json|css|html|md|txt|sh|ps1|py|c|h|m|grit|yaml|yml|toml)$/;

export function classifyPath(path) {
  if (testFile.test(path)) return null;
  if (/^packages\/[^/]+\/scripts\//.test(path) || /^[^/]+\.sh$/.test(path)) return 'engineering';
  return [...featureModules].sort((a, b) => b.root.length - a.root.length).find(m => path.startsWith(m.root))?.id ?? null;
}

export function parseSource(path, text) {
  const record = { symbols: [], imports: [], comment: '' };
  if (!scriptFile.test(path) || /(?:\.min\.js$|\.generated\.|\/providers\/data\/|\.models\.ts$|\/doom\/build\/)/.test(path)) return record;
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const clean = raw => raw.replace(/^\/\*\*?\s?/, '').replace(/\*\/$/, '').split('\n').map(s => s.replace(/^\s*\* ?/, '').replace(/^\s*\/\/ ?/, '')).join('\n').trim();
  const comments = node => (ts.getLeadingCommentRanges(text, node.getFullStart()) || []).map(r => clean(text.slice(r.pos, r.end))).join('\n\n');
  record.comment = (ts.getLeadingCommentRanges(text, 0) || []).map(r => clean(text.slice(r.pos, r.end))).join('\n\n');
  function visit(node, owner = '') {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      record.imports.push({ spec: node.moduleSpecifier.text, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, kind: ts.isExportDeclaration(node) ? '再导出' : '导入', typeOnly: Boolean(node.isTypeOnly || node.importClause?.isTypeOnly) });
    }
    let kind;
    if (ts.isFunctionDeclaration(node)) kind = '函数';
    else if (ts.isClassDeclaration(node)) kind = '类';
    else if (ts.isInterfaceDeclaration(node)) kind = '接口';
    else if (ts.isTypeAliasDeclaration(node)) kind = '类型';
    else if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) kind = '方法';
    else if (ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) kind = '访问器';
    else if (ts.isConstructorDeclaration(node)) kind = '构造器';
    else if (ts.isPropertySignature(node) || ts.isPropertyDeclaration(node)) kind = '属性';
    else if (ts.isVariableDeclaration(node) && ts.isVariableDeclarationList(node.parent) && ts.isVariableStatement(node.parent.parent) && node.parent.parent.parent === source) kind = node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) ? '函数变量' : '变量';
    const rawName = node.name?.getText(source) || (ts.isConstructorDeclaration(node) ? 'constructor' : ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) ? 'default' : '');
    const name = owner && kind !== '变量' ? `${owner}.${rawName}` : rawName;
    if (kind && rawName) {
      const statement = ts.isVariableDeclaration(node) ? node.parent.parent : node;
      const start = node.getStart(source);
      const callable = kind === '函数变量' ? node.initializer : node;
      let end = node.body?.getStart(source) ?? node.end;
      if (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) end = node.members.pos;
      if (ts.isVariableDeclaration(node) && node.initializer) end = node.initializer.getStart(source);
      if (kind === '函数变量') end = callable.body.getStart(source);
      record.symbols.push({ name, kind, line: source.getLineAndCharacterOfPosition(start).line + 1, endLine: source.getLineAndCharacterOfPosition(node.end).line + 1,
        signature: text.slice(start, end).trim(), comment: comments(statement), exported: Boolean(statement.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)),
        inputs: callable.parameters?.map(p => p.getText(source)) || [], output: callable.type?.getText(source) || '',
        visibility: node.modifiers?.find(m => [ts.SyntaxKind.PrivateKeyword, ts.SyntaxKind.ProtectedKeyword, ts.SyntaxKind.PublicKeyword].includes(m.kind))?.getText(source) || '' });
    }
    const nextOwner = kind === '类' || kind === '接口' ? name : owner;
    ts.forEachChild(node, child => visit(child, nextOwner));
  }
  visit(source);
  return record;
}

export function resolveImport(from, spec, files, manifests) {
  let candidate;
  if (spec.startsWith('.')) candidate = posix.normalize(posix.join(posix.dirname(from), spec));
  else {
    const manifest = manifests.find(p => spec === p.name || spec.startsWith(`${p.name}/`));
    if (!manifest) return null;
    const subpath = spec === manifest.name ? '.' : `.${spec.slice(manifest.name.length)}`;
    const exports = manifest.exports;
    let target;
    function value(entry) {
      if (typeof entry === 'string') return entry;
      if (Array.isArray(entry)) return entry.map(value).find(Boolean);
      return entry && value(entry.import ?? entry.default ?? entry.types);
    }
    if (!exports) target = subpath === '.' ? manifest.main : undefined;
    else if (typeof exports === 'string' || !Object.keys(exports).some(k => k.startsWith('.'))) target = subpath === '.' ? value(exports) : undefined;
    else {
      target = value(exports[subpath]);
      if (!target) for (const [key, entry] of Object.entries(exports)) {
        if (!key.includes('*')) continue;
        const [prefix, suffix] = key.split('*');
        if (subpath.startsWith(prefix) && subpath.endsWith(suffix)) { target = value(entry)?.replaceAll('*', subpath.slice(prefix.length, suffix ? -suffix.length : undefined)); if (target) break; }
      }
    }
    if (!target) return null;
    candidate = posix.normalize(posix.join(manifest.dir, target.replace(/^\.\/dist\//, 'src/').replace(/\.d\.ts$/, '.ts')));
  }
  return [candidate, candidate.replace(/\.[cm]?js$/, '.ts'), `${candidate}.ts`, `${candidate}/index.ts`, `${candidate}.js`, `${candidate}/index.js`].find(p => files.has(p)) || null;
}

export function buildCatalog({ paths, read, commits }) {
  const pathSet = new Set(paths);
  const manifests = paths.filter(p => /^packages\/(?:[^/]+|session-backends\/[^/]+)\/package\.json$/.test(p)).map(p => ({ dir: posix.dirname(p), ...JSON.parse(read(p)) }));
  const files = {};
  const snapshots = {};
  for (const path of paths) {
    const module = classifyPath(path);
    if (!module) continue;
    const text = textFile.test(path) ? read(path) : null;
    const info = text === null ? { symbols: [], imports: [], comment: '' } : parseSource(path, text);
    files[path] = { module, ...info, resource: !scriptFile.test(path) || /(?:\.generated\.|\.models\.ts$|\.min\.js$)/.test(path), text: text !== null, lines: text?.split('\n').length ?? null, consumers: [], tests: [], features: [] };
    if (text !== null) snapshots[path] = text;
  }
  for (const path of paths.filter(p => files[p] || (testFile.test(p) && scriptFile.test(p)))) {
    const imports = files[path]?.imports ?? parseSource(path, read(path)).imports;
    for (const ref of imports) {
      ref.target = resolveImport(path, ref.spec, pathSet, manifests);
      if (ref.target && files[ref.target]) {
        const edge = { path, line: ref.line, kind: ref.kind, typeOnly: ref.typeOnly };
        if (testFile.test(path)) files[ref.target].tests.push(edge);
        else files[ref.target].consumers.push(edge);
      }
    }
  }
  const features = [];
  for (const module of featureModules) {
    const owned = Object.keys(files).filter(p => files[p].module === module.id);
    for (const [key, title, patterns, purpose, entry, behavior] of featureSpecs[module.id] || []) {
      const members = owned.filter(p => patterns.some(pattern => p.slice(module.root.length) === pattern || (!/\.[a-z]+$/i.test(pattern) && p.slice(module.root.length).startsWith(pattern))));
      if (!members.length) throw new Error(`功能没有源码依据: ${module.id}/${key}`);
      features.push({ id: `${module.id}-${key}`, module: module.id, title, purpose, entry, behavior, files: members, status: module.status, evidence: '中文能力解说', docs: [module.doc] });
    }
    // Independently list provider factories and runnable example entry units.
    if (module.id === 'ai') for (const path of owned.filter(p => /^packages\/ai\/src\/providers\/[^/]+\.ts$/.test(p) && !/\.models\.ts$|\.d\.ts$/.test(p) && files[p].symbols.some(s => s.exported && /函数/.test(s.kind) && /\bProvider\b/.test(s.output)))) {
      const key = posix.basename(path, '.ts');
      features.push({ id: `ai-provider-${key}`, module: 'ai', title: `${key} · 提供商接入`, purpose: `通过 ${key} 工厂提供模型目录、请求派发或认证组合；具体导出与原始注释见下方。`, entry: files[path].symbols.filter(s => s.exported).map(s => s.name).join('、'), behavior: '返回 Provider 的导出函数由语法树识别；不根据厂商名称推断支持全部模型或所有输入类型。', files: [path, ...owned.filter(p => p === path.replace(/\.ts$/, '.models.ts'))], status: '库能力', evidence: '源码规则归类', docs: [module.doc] });
    }
    if (module.id === 'examples') {
      const groups = new Map();
      for (const path of owned) {
        const parts = path.slice(module.root.length).split('/');
        const key = parts.slice(0, Math.min(2, parts.length)).join('/');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(path);
      }
      for (const [key, members] of groups) features.push({ id: `example-${key.replace(/[^a-zA-Z0-9-]/g, '-')}`, module: module.id, title: `${key.replace(/\.[^.]+$/, '')} · 示例`, purpose: `展示 ${key} 对应的扩展或 SDK 用法。具体场景以入口文件的原始说明、注册代码和配套 README 为依据。`, entry: members.find(p => /(?:index|\d[^/]*)\.ts$/.test(p)) || members[0], behavior: '示例不是默认启用功能；阅读注册入口、参数契约和清理行为后再选择使用。', files: members, status: '示例', evidence: '源码规则归类', docs: [module.doc, ...members.filter(p => p.endsWith('README.md'))] });
    }
    const assigned = new Set(features.filter(f => f.module === module.id).flatMap(f => f.files));
    const remaining = owned.filter(p => !assigned.has(p));
    if (remaining.length) features.push({ id: `${module.id}-support`, module: module.id, title: '其余实现、入口与支撑资源', purpose: `${module.title}中尚未单独撰写中文能力说明的文件在此完整列出，防止静默遗漏。`, entry: '从文件列表选择入口，查看符号、原始注释和引用', behavior: '此项是覆盖索引，不代表其中所有实现已做语义审计。每份源码仍可离线展开。', files: remaining, status: module.status, evidence: '源码覆盖索引', docs: [module.doc] });
  }
  features.sort(compareFeatures);
  const history = new Map();
  for (const commit of commits) for (const file of commit.files) {
    if (!files[file.path]) continue;
    if (!history.has(file.path)) history.set(file.path, []);
    history.get(file.path).push(commit.hash);
  }
  for (const feature of features) {
    feature.commits = [...new Set(feature.files.flatMap(p => history.get(p) || []))];
    feature.tests = [...new Set(feature.files.flatMap(p => files[p].tests.map(t => t.path)))];
    for (const path of feature.files) files[path].features.push(feature.id);
    for (const doc of feature.docs) if (pathSet.has(doc) && !snapshots[doc]) snapshots[doc] = read(doc);
  }
  // Test sources are embedded only when an exact static import links them to indexed files.
  for (const path of new Set(features.flatMap(f => f.tests))) snapshots[path] = read(path);
  const modules = featureModules.map(m => ({ ...m, features: features.filter(f => f.module === m.id).map(f => f.id), fileCount: Object.values(files).filter(f => f.module === m.id).length })).sort((a, b) => moduleOrder.indexOf(a.id) - moduleOrder.indexOf(b.id));
  return { catalog: { modules, features, files, stats: { files: Object.keys(files).length, symbols: Object.values(files).reduce((n, f) => n + f.symbols.length, 0), features: features.length, documented: features.filter(f => f.evidence === '中文能力解说').length, unassigned: Object.values(files).filter(f => !f.features.length).length }, scope: 'Git 已跟踪的全部工作区包 src、coding-agent/examples、tui/native、根/包 scripts 与根 shell 入口。测试通过精确静态 import 关联；文档、测试场景、构建产物和二进制不计为独立业务功能。TS/JS 用语法树提取声明与注释；C/Objective-C/Shell 保留文本或资源索引。文件覆盖不等于每项语义都已人工审计。' }, snapshots };
}
