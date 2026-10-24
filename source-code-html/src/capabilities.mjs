import { posix } from 'node:path';
import { createHash } from 'node:crypto';
import { capabilityBindings, capabilityGroups } from './capability-bindings.mjs';

export const capabilitySource = 'source-code-html/reference/pi-feature-catalog.zh.md';

export function parseCapabilities(markdown) {
  const references = new Map([...markdown.matchAll(/^\[([^\]]+)\]:\s+(\S+)/gm)].map(m => [m[1], m[2]]));
  const rows = [], modules = [], boundaries = [], seen = new Set();
  let module, boundarySection = false;
  const lines = markdown.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## ')) {
      boundarySection = line === '## 能力边界与容易混淆的地方';
      const heading = line.match(/^## (\d{2}) (.+)$/);
      module = heading ? { id: `capability-${heading[1]}`, title: heading[2], description: '按功能清单原顺序阅读；状态、入口与来源保留原文。', root: capabilitySource, features: [] } : undefined;
      if (module) modules.push(module);
    }
    if (!/^\| [A-Z]+-\d+ \|/.test(line) && !(boundarySection && /^\| /.test(line))) continue;
    const cells = line.split(/(?<!\\)\|/).slice(1, -1).map(s => s.trim().replaceAll('\\|', '|'));
    if (boundarySection) {
      if (cells[0] !== '项目' && !/^[-: ]+$/.test(cells[0])) boundaries.push({ title: cells[0], text: cells[1], impact: cells[2], line: i + 1 });
      continue;
    }
    if (!module || cells.length !== 6) throw new Error(`功能表格格式错误: L${i + 1}`);
    const [id, title, purpose, entry, status, evidence] = cells;
    if (seen.has(id)) throw new Error(`重复功能编号: ${id}`);
    seen.add(id);
    const docs = [...new Set([...evidence.matchAll(/\[[^\]]+\]\[([^\]]+)\]/g)].map(m => {
      const target = references.get(m[1]);
      if (!target) throw new Error(`来源未定义: ${id}/${m[1]}`);
      const path = posix.normalize(posix.join(posix.dirname(capabilitySource), target.split('#')[0]));
      if (path.startsWith('../') || path.startsWith('/') || /[:\\]/.test(path)) throw new Error(`非法来源路径: ${id}/${path}`);
      return path;
    }))];
    if (!docs.length) throw new Error(`功能缺少来源: ${id}`);
    rows.push({ id, title, purpose, entry, status, docs, module: module.id, line: i + 1 });
    module.features.push(id);
  }
  if (!rows.length) throw new Error('功能清单为空');
  return { rows, modules, boundaries };
}

export function attachCapabilities({ catalog, markdown, read, bindings = capabilityBindings }) {
  const parsed = parseCapabilities(markdown);
  const byId = new Map(catalog.features.map(f => [f.id, f]));
  const snapshots = { [capabilitySource]: markdown };
  const rowIds = new Set(parsed.rows.map(r => r.id));
  for (const id of Object.keys(bindings)) if (!rowIds.has(id)) throw new Error(`映射编号已不在清单中: ${id}`);
  for (const f of catalog.features) f.capabilityIds = [];
  for (const f of Object.values(catalog.files)) f.capabilities = [];
  const capabilities = parsed.rows.map(row => {
    if (!Object.hasOwn(bindings, row.id)) throw new Error(`功能未映射: ${row.id}`);
    const retiredFeatures = bindings[row.id].filter(id => catalog.retiredFeatures?.includes(id));
    const relatedFeatures = [...new Set([...bindings[row.id].filter(id => !retiredFeatures.includes(id)), ...(capabilityGroups[row.id] || []).flatMap(prefix => catalog.features.filter(f => f.id.startsWith(prefix) && f.files.some(p => /\.ts$/.test(p))).map(f => f.id))])];
    const parents = relatedFeatures.map(id => {
      const f = byId.get(id);
      if (!f) throw new Error(`源码专题不存在: ${row.id}/${id}`);
      f.capabilityIds.push(row.id);
      return f;
    });
    const files = [...new Set(parents.flatMap(f => f.files))];
    for (const p of files) catalog.files[p].capabilities.push(row.id);
    for (const p of row.docs) if (!Object.hasOwn(snapshots, p)) snapshots[p] = read(p);
    return { ...row, status: retiredFeatures.length && !parents.length ? '历史资料' : row.status, sourceLine: row.line, stableId: row.id, title: `${row.id} · ${row.title}`, relatedFeatures, retiredFeatures, files,
      behavior: retiredFeatures.length && !parents.length ? '当前 checkout 不包含对应实现；编号与原始资料保留用于历史对照，不能按旧入口运行。' : parents.length ? '编号沿用历史清单，当前源码专题与引用按本次 checkout 生成。编号原文不是逐项重新审计的结论；接口变化以专题边界、当前源码和版本日志为准。文件关联不表示本子功能独占。' : '本项保留历史编号与文档方案；以当前来源核对适用条件，不虚构内部实现或测试关系。',
      evidence: 'Markdown 功能说明', update: '本次补充', docs: row.docs,
      tests: [...new Set(parents.flatMap(f => f.tests))], commits: [...new Set(parents.flatMap(f => f.commits))] };
  });
  for (const m of parsed.modules) {
    m.fileCount = new Set(capabilities.filter(f => f.module === m.id).flatMap(f => f.files)).size;
  }
  catalog.capabilities = capabilities;
  catalog.capabilityModules = parsed.modules;
  catalog.capabilityCoverage = { source: capabilitySource, sha256: createHash('sha256').update(markdown).digest('hex'), total: capabilities.length, mapped: capabilities.filter(f => f.relatedFeatures.length).length, documentationOnly: capabilities.filter(f => !f.relatedFeatures.length).map(f => f.id), boundaries: parsed.boundaries };
  return snapshots;
}
