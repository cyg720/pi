import { packageLessons, historicalLesson } from './package-lessons.mjs';

export function buildPackageTutorials({ paths, directories, read, catalog }) {
  const snapshots = {};
  const names = [...new Set([...directories, ...paths.map(p => /^packages\/([^/]+)\//.exec(p)?.[1]).filter(Boolean)])].sort();
  const tutorials = names.map(id => {
    const prefix = `packages/${id}/`;
    const owned = paths.filter(p => p.startsWith(prefix));
    const manifestPath = `${prefix}package.json`;
    const manifest = owned.includes(manifestPath) ? JSON.parse(read(manifestPath)) : null;
    if (manifest && !packageLessons[id]) throw new Error(`新包缺少中文教程: ${id}`);
    const docs = owned.filter(p => /\.md$/.test(p) && !/CHANGELOG|AGENTS\.md|\/test\/|\/examples\//.test(p)).sort((a, b) => Number(!a.endsWith('/README.md')) - Number(!b.endsWith('/README.md')) || a.localeCompare(b));
    const examples = manifest ? owned.filter(p => /\/(?:examples|evals)\//.test(p) && /\.(?:ts|tsx|js|mjs|md|json|jsonc)$/.test(p)) : [];
    const tests = manifest ? owned.filter(p => /\/test\//.test(p) && !/\/examples\//.test(p) && /\.(?:test|spec)\.[cm]?[jt]s$/.test(p)) : [];
    const schemas = manifest ? owned.filter(p => /\/schemas\/.*\.json$/.test(p)) : [];
    const sourceFiles = Object.keys(catalog.files).filter(p => p.startsWith(`${prefix}src/`));
    const sourceTexts = sourceFiles.filter(p => catalog.files[p].text);
    const symbols = sourceFiles.flatMap(path => catalog.files[path].symbols.map((s, index) => [path, index]));
    const environment = [];
    const lesson = manifest ? packageLessons[id] : historicalLesson(id, docs.length > 0);
    for (const path of new Set([...docs, ...examples, ...tests, ...schemas, ...sourceTexts, ...(manifest ? [manifestPath] : []), ...lesson.flow.map(s => s.path), ...owned.filter(p => /\/daemon\/.*\.(?:rs|toml)$/.test(p))])) snapshots[path] = read(path);
    for (const path of sourceTexts) snapshots[path].split('\n').forEach((line, i) => {
      // Keep exact source evidence, including computed access; no invented variable names/defaults.
      if (/\bprocess\.env\b|\b(?:Deno|Bun)\.env\b/.test(line)) environment.push([path, i + 1]);
    });
    for (const s of lesson.flow) if (!snapshots[s.path]?.includes(s.needle)) throw new Error(`教程流程引用失效: ${id}: ${s.path} :: ${s.needle}`);
    const features = catalog.features.filter(f => f.files.some(p => p.startsWith(`${prefix}src/`))).map(f => f.id);
    return { id, manifest, manifestPath: manifest ? manifestPath : null, status: manifest ? manifest.private ? '私有工作区包' : id === 'durable' ? '实验性包' : '当前源码包' : docs.length ? '历史资料' : '无当前源码', lesson, docs, examples, tests, schemas, sourceFiles, symbols, environment, features };
  });
  return { tutorials, snapshots };
}
