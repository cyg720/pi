import { versionNotes } from './version-notes.mjs';

const semver = /^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/;
const categoryNames = {
  'Breaking Changes':'breaking', '破坏性变更':'breaking', '不兼容变更':'breaking',
  Added:'added', 新增:'added', 'New Features':'highlights', 新功能:'highlights',
  Changed:'changed', 变更:'changed', 更改:'changed', Fixed:'fixed', 修复:'fixed',
  Removed:'removed', 移除:'removed', 删除:'removed', Deprecated:'deprecated', 废弃:'deprecated',
  Security:'security', 安全:'security', Performance:'performance', 性能:'performance'
};
for (const [category, aliases] of Object.entries({
  breaking:['重大变更','破坏','破坏性更改'],
  added:['添加','添加了','新增了','增加','增加了','已添加','已增加'],
  highlights:['新特性','新增功能'],
  changed:['修改','修改了','更改了','已更改'],
  fixed:['修复了','已修复','固定','已固定'],
  removed:['已移除','移除了']
})) for (const alias of aliases) categoryNames[alias] = category;

// Newest first; prerelease identifiers use semver numeric comparison, not lexical order.
export function compareVersions(a, b) {
  if (a === b) return 0;
  if (a === 'Unreleased') return -1;
  if (b === 'Unreleased') return 1;
  const [acore, apre] = a.split('+')[0].split(/-(.*)/s);
  const [bcore, bpre] = b.split('+')[0].split(/-(.*)/s);
  const an = acore.split('.').map(Number), bn = bcore.split('.').map(Number);
  for (let i=0;i<3;i++) if (an[i] !== bn[i]) return bn[i]-an[i];
  if (apre === undefined && bpre === undefined) return 0;
  if (apre === undefined || bpre === undefined) return apre === undefined ? -1 : 1;
  const ap = apre.split('.'), bp = bpre.split('.');
  for (let i=0;i<Math.max(ap.length,bp.length);i++) {
    if (ap[i] === bp[i]) continue;
    if (ap[i] === undefined) return 1;
    if (bp[i] === undefined) return -1;
    const ai = /^\d+$/.test(ap[i]), bi = /^\d+$/.test(bp[i]);
    if (ai && bi) return Number(bp[i])-Number(ap[i]);
    if (ai !== bi) return ai ? 1 : -1;
    return bp[i].localeCompare(ap[i]);
  }
  return 0;
}

export function parseChangelog(text) {
  const lines = text.replace(/\r\n/g,'\n').split('\n');
  const releases = [];
  let release, section, fence;
  const finishSection = end => {
    if (section) {
      section.body = lines.slice(section.line, end).join('\n').trim();
      release.sections.push(section);
      section = undefined;
    }
  };
  const finishRelease = end => {
    if (release) {
      finishSection(end);
      release.body = lines.slice(release.line, end).join('\n').trim();
      releases.push(release);
    }
  };
  lines.forEach((line, index) => {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length && /^\s*(`+|~+)\s*$/.test(line)) fence = undefined;
      return;
    }
    if (fence) return;
    const heading = line.match(/^##\s+\[?([^\]\s]+)\]?(?:\s+-\s+(\d{4}-\d{2}-\d{2}))?/);
    if (heading && (semver.test(heading[1]) || ['Unreleased','未发布'].includes(heading[1]))) {
      finishRelease(index);
      release = {version:heading[1] === '未发布' ? 'Unreleased' : heading[1], date:heading[2] || '', heading:line, line:index+1, body:'', sections:[]};
      return;
    }
    if (!release) return;
    const subheading = line.match(/^###\s+(.+?)\s*$/);
    if (subheading) {
      finishSection(index);
      section = {title:subheading[1], category:categoryNames[subheading[1]] || 'other', line:index+1, count:0, body:''};
    } else if (/^[-*+]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      // Unsectioned release notes are kept, and counted separately from fenced/nested bullets.
      if (!section) section = {title:'未分类记录', category:'other', line:release.line, count:0, body:''};
      section.count++;
    }
  });
  finishRelease(lines.length);
  const seen = new Set();
  for (const item of releases) {
    if (seen.has(item.version)) throw new Error(`变更日志版本重复: ${item.version}`);
    seen.add(item.version);
  }
  return releases;
}

export function buildVersions({paths,read,packages,commits,tags,head,notes=versionNotes}) {
  const sourcePaths = paths.filter(p => /^packages\/[^/]+\/CHANGELOG(?:\.zh)?\.md$/.test(p)).sort();
  const snapshots = Object.fromEntries(sourcePaths.map(path => [path,read(path)]));
  const active = new Map(packages.map(p => [p.path,p]));
  const groups = new Map();
  const group = id => {
    if (!groups.has(id)) groups.set(id,{id,packages:[],dates:[],tag:null,hash:null,tagDate:null});
    return groups.get(id);
  };
  for (const path of sourcePaths) {
    const id = path.split('/')[1], language = path.endsWith('.zh.md') ? 'zh' : 'en';
    for (const entry of parseChangelog(snapshots[path])) {
      // Chinese drafts are independently maintained and must never be matched to a newer English draft.
      if (language === 'zh' && entry.version === 'Unreleased') continue;
      const version = group(entry.version);
      let pkg = version.packages.find(p => p.id === id);
      if (!pkg) { pkg = {id,active:active.has(id),description:active.get(id)?.description || '历史包资料；当前工作区没有此包的 package.json。',en:null,zh:null}; version.packages.push(pkg); }
      pkg[language] = {...entry,path};
      if (entry.date && !version.dates.includes(entry.date)) version.dates.push(entry.date);
    }
  }
  for (const tag of tags) {
    const id = tag.name.replace(/^v/,'');
    if (!semver.test(id)) continue;
    const version = group(id);
    if (!version.tag || tag.name === `v${id}`) Object.assign(version,{tag:tag.name,hash:tag.hash,tagDate:tag.date || null});
  }
  const byHash = new Map(commits.map(c => [c.hash,c]));
  const ancestors = start => {
    const seen = new Set(), pending = [start];
    while (pending.length) { const hash = pending.pop(); if (!hash || seen.has(hash)) continue; seen.add(hash); pending.push(...(byHash.get(hash)?.parents || [])); }
    return seen;
  };
  const items = [...groups.values()].sort((a,b)=>compareVersions(a.id,b.id));
  const tagged = items.filter(v=>v.tag);
  for (const item of items) {
    const previous = item.id === 'Unreleased' ? tagged[0] : tagged[tagged.indexOf(item)+1];
    item.previous = (item.tag || item.id === 'Unreleased') && previous ? previous.id : null;
    item.range = null;
    item.commitIds = [];
    if (item.tag || item.id === 'Unreleased') {
      const upper = item.id === 'Unreleased' ? head : item.hash;
      const lower = previous ? ancestors(previous.hash) : new Set();
      const upperSet = ancestors(upper);
      item.range = previous ? `${previous.tag}..${item.tag || 'HEAD'}` : (item.tag || 'HEAD');
      item.commitIds = commits.filter(c=>upperSet.has(c.hash) && !lower.has(c.hash)).map(c=>c.hash);
      item.linearRange = !previous || upperSet.has(previous.hash);
    }
    item.counts = {};
    for (const pkg of item.packages) {
      const canonical = pkg.en || pkg.zh;
      pkg.counts = {};
      for (const section of canonical.sections) {
        pkg.counts[section.category] = (pkg.counts[section.category] || 0)+section.count;
        item.counts[section.category] = (item.counts[section.category] || 0)+section.count;
      }
      pkg.empty = !canonical.body.trim();
      pkg.risk = canonical.sections.some(s=>['breaking','removed','security'].includes(s.category) && s.body.trim());
    }
    item.packages.sort((a,b)=> (a.id === 'coding-agent' ? -1 : b.id === 'coding-agent' ? 1 : a.id.localeCompare(b.id)));
    item.recordCount = Object.values(item.counts).reduce((a,b)=>a+b,0);
    item.risk = item.packages.some(p=>p.risk);
    item.notes = notes[item.id] ? structuredClone(notes[item.id]) : null;
    if (item.notes) for (const point of item.notes.points || []) {
      const entry = item.packages.find(p=>p.id===point.package)?.en;
      if (!point.needle || !entry?.body.includes(point.needle)) throw new Error(`版本解说依据失效: ${item.id} / ${point.package} / ${point.needle}`);
      // Leading blank lines in the raw source matter for a precise line link.
      const lines = snapshots[entry.path].replace(/\r\n/g,'\n').split('\n');
      point.line = lines.findIndex((line,index)=>index>=entry.line && line.includes(point.needle))+1;
      point.path = entry.path;
    }
  }
  const numericChinese = items.filter(v=>v.packages.some(p=>p.zh));
  return {versions:{items,sourcePaths,latestTag:tagged[0]?.id || null,chineseThrough:numericChinese[0]?.id || null,head,packageVersions:packages.map(p=>({id:p.path,version:p.version})),stats:{versions:items.length,released:items.filter(v=>v.id!=='Unreleased').length,tags:tagged.length,records:items.reduce((sum,v)=>sum+v.recordCount,0),curated:items.filter(v=>v.notes).length}},snapshots};
}
