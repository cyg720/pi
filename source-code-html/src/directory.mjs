export function buildDirectory({ paths, trackedPaths = paths, catalog, sources = {}, sourceHashes = {}, notes = { nodes: {} } }) {
  const tracked = new Set(trackedPaths);
  const nodes = Object.create(null);
  nodes[''] = { path: '', name: 'pi', kind: 'folder', parent: null, children: [] };
  for (const path of [...new Set(paths)].sort()) {
    if (!path || path.startsWith('/') || path.includes('\\') || path.split('/').some(part => !part || part === '..' || part === '.')) throw new Error(`非法目录路径: ${path}`);
    const parts = path.split('/');
    for (let i = 1; i <= parts.length; i++) {
      const key = parts.slice(0, i).join('/');
      const parent = parts.slice(0, i - 1).join('/');
      const kind = i === parts.length ? 'file' : 'folder';
      if (nodes[key] && nodes[key].kind !== kind) throw new Error(`文件与目录冲突: ${key}`);
      if (!nodes[key]) {
        nodes[key] = { path: key, name: parts[i - 1], kind, parent, children: [] };
        nodes[parent].children.push(key);
      }
    }
  }
  const features = new Map(catalog.features.map(f => [f.id, f]));
  for (const node of Object.values(nodes)) {
    node.children.sort((a, b) => (nodes[a].kind === 'folder' ? 0 : 1) - (nodes[b].kind === 'folder' ? 0 : 1) || a.localeCompare(b, 'en', { numeric: true }));
    const record = Object.hasOwn(catalog.files, node.path) ? catalog.files[node.path] : undefined;
    node.features = node.kind === 'file' ? record?.features || [] : [...new Set(Object.entries(catalog.files).filter(([p]) => !node.path || p.startsWith(`${node.path}/`)).flatMap(([, f]) => f.features))];
    const note = Object.hasOwn(notes.nodes, node.path) ? notes.nodes[node.path] : undefined;
    node.description = note?.description || '';
    node.details = (note?.details || []).filter(detail => !detail.feature || features.has(detail.feature));
    node.basis = node.description ? note.basis || '维护者说明' : '';
    node.evidence = note?.evidence || [];
    node.initializedCommit = note?.initializedCommit || '';
    node.sourceHash = Object.hasOwn(sourceHashes, node.path) ? sourceHashes[node.path] : '';
    node.review = Boolean(node.description && ((note.sourceHash && node.sourceHash && note.sourceHash !== node.sourceHash) || (note.details || []).some(detail => detail.feature && !features.has(detail.feature))));
    node.status = !node.description ? 'pending' : node.review ? 'review' : 'ready';
    node.snapshot = Object.hasOwn(sources, node.path);
    node.tracked = node.kind === 'file' && tracked.has(node.path);
    node.lines = node.snapshot ? sources[node.path].split('\n').length : null;
    node.symbolCount = record?.symbols.length || 0;
    node.featureTitles = node.features.map(id => features.get(id)?.title || '').filter(Boolean);
  }
  function count(path) {
    const node = nodes[path];
    node.fileCount = node.kind === 'file' ? 1 : node.children.reduce((sum, child) => sum + count(child), 0);
    return node.fileCount;
  }
  count('');
  const values = Object.values(nodes);
  return { nodes, stats: { files: values.filter(n => n.kind === 'file').length, folders: values.filter(n => n.kind === 'folder').length, ready: values.filter(n => n.status === 'ready').length, review: values.filter(n => n.status === 'review').length, pending: values.filter(n => n.status === 'pending').length }, scope: '仓库 Git 已跟踪路径及未被 .gitignore 忽略的新文件，包含源码、测试、文档、配置、脚本和资源。目录从文件路径还原；空目录、node_modules、.git 和被忽略的本地生成内容不在此清单。目录树覆盖范围比业务功能清单更广；只有带快照的文本可离线打开全文。' };
}

// Ordinary refreshes register new paths with an empty description. Explicit initialization
// reuses only existing Chinese explanations; it never overwrites a maintained description.
export function initializeDirectoryNotes(directory, notes, catalog, packages, commit, initialize = false) {
  const result = { schemaVersion: 1, nodes: Object.assign(Object.create(null), structuredClone(notes.nodes || {})) };
  const features = new Map(catalog.features.map(f => [f.id, f]));
  const seeds = {
    '': ['项目仓库根目录。packages 承载工作区包，scripts 承载工程工具，source-code-html 保存离线导览；根 package.json 定义工作区和开发检查入口。', 'package.json'],
    packages: ['工作区包集合。各包的 package.json 定义入口、导出和依赖；src 是实现，test 是验证，README 与 docs 是使用契约。包之间的运行时依赖应以清单和静态引用为依据。', 'package.json'],
    scripts: ['仓库工程脚本集合，负责依赖与入口校验、源码统计、构建、模型数据水合和交付辅助。不同脚本的运行条件不同，具体入口见关联功能及本地开发说明。', 'AGENTS.md'],
    'source-code-html': ['本项目的离线源码导览。build.mjs 将中文内容、源码快照、目录树、提交时间线和架构图打包到 index.html；src 是维护源文件，data 是可独立分析的生成数据。阅读 HTML 不需要运行生成器。', 'source-code-html/README.md'],
    'source-code-html/src': ['离线导览的维护源文件。中文章节和能力说明由维护者编写，浏览器脚本管理路由与交互，样式管理响应式布局；目录说明保存在 directory-notes.json，普通生成保留已有说明。', 'source-code-html/README.md'],
    'source-code-html/data': ['离线导览的生成数据，包括功能、目录、历史、版本差异与指纹清单。它们用于核查和后续维护；index.html 内嵌同一批数据，读者无需单独加载这些 JSON。', 'source-code-html/README.md']
  };
  for (const pkg of packages) {
    seeds[`packages/${pkg.path}`] = [pkg.description, `packages/${pkg.path}/package.json`];
    seeds[`packages/${pkg.path}/package.json`] = [`${pkg.name} 的包清单。定义包版本、模块入口、公开导出、运行时 / 开发依赖和包级脚本；根工作区与消费该包的工具据此解析和安装。工作区运行时依赖：${pkg.dependencies.join('、') || '无直接 Pi 工作区运行时依赖'}。修改入口或依赖后应同步检查真实导出、依赖声明和锁文件。`, `packages/${pkg.path}/package.json`];
  }
  for (const [path, description] of Object.entries({
    'source-code-html/build.mjs': '离线导览生成入口。读取当前 Git 路径、工作区清单、教学内容、源码与提交统计，构建功能索引、目录树、差异和指纹，最终内嵌 CSS / JavaScript / JSON 与架构图到 index.html。--initialize-directory 可补充尚为空且已有中文依据的说明，普通生成只登记新空节点。',
    'source-code-html/src/directory.mjs': '目录数据与初始化规则。从文件路径还原父子树，计算目录下文件总数、功能关联、快照状态；合并持久说明并比较源码指纹。新未知路径的 description 保持空字符串，已有维护说明不会被自动初始化覆盖。',
    'source-code-html/src/directory-app.js': '源码目录说明的浏览器交互。呈现树与详情，处理目录展开、搜索、状态筛选、路径深链接、定位当前节点和菜单滚动保留；详情关联内嵌源码、声明、注释、引用与测试，不读取用户磁盘。',
    'source-code-html/src/directory.css': '源码目录说明的布局与视觉样式。宽屏树 / 详情双栏且正文占满可用宽度，窄屏改为上下排列；目录树独立滚动，状态、描述、面包屑和引用各有阅读样式。主题变量与减少动画规则由全站样式提供。',
    'source-code-html/src/directory-notes.json': '按仓库相对路径保存的持久中文目录说明。空 description 表示未初始化；已初始化项保留说明、入口边界、来源、初始化 commit 和文件指纹。可以人工编辑说明，重新生成不会覆盖非空内容；指纹变化会提示复核。',
    'source-code-html/data/directory.json': '生成器导出的完整目录数据。包含全部节点、父子关系、说明、状态、功能关联、源码快照标识与总数，供离线页面及独立分析使用。应通过生成器更新，而非直接修改此产物。',
    'source-code-html/directory.test.mjs': '目录功能的定向回归验证。使用小型路径与功能夹具验证完整树、空说明、初始化保留、源码变更标记和路径校验；使用 DOM 替身验证搜索、筛选、深链接、展开与滚动恢复；同时核对最终 HTML 的全仓库路径覆盖。'
  })) seeds[path] = [description, 'source-code-html/README.md'];
  for (const module of catalog.modules.filter(m => m.status !== '待解读')) seeds[module.root.replace(/\/$/, '')] = [module.description, module.doc];
  for (const node of Object.values(directory.nodes)) {
    const prior = result.nodes[node.path];
    if (prior?.description || !initialize) { result.nodes[node.path] = prior || { description: '' }; continue; }
    const associated = [...new Set([...node.features, ...(node.kind === 'file' ? catalog.features.filter(f => f.tests?.includes(node.path) || f.docs.includes(node.path)).map(f => f.id) : [])])].map(id => features.get(id)).filter(f => f?.evidence === '中文能力解说');
    const seed = Object.hasOwn(seeds, node.path) ? seeds[node.path] : null;
    if (!seed && !associated.length) { result.nodes[node.path] = prior || { description: '' }; continue; }
    const descriptions = associated.map(f => `${f.title}：${f.purpose}`);
    const relation = node.kind === 'folder' ? '本目录汇集以下能力的相关实现' : associated.some(f => f.files.includes(node.path)) ? '按现有源码归属，本文件参与以下能力' : associated.some(f => f.tests?.includes(node.path)) ? '本文件通过静态引用与以下能力直接关联，是其测试资料；测试实际覆盖范围以断言与执行结果为准' : '本文件是以下能力列出的参考文档，用于对照接口、使用方法和处理边界';
    const description = seed?.[0] || `${relation}：\n${descriptions.join('\n')}`;
    const details = associated.map(f => ({ title: f.title, entry: f.entry, behavior: f.behavior, feature: f.id }));
    result.nodes[node.path] = { description, details, basis: seed ? '已有包 / 模块职责说明' : '已有中文功能讲解与精确路径归属', evidence: [...new Set([...(seed ? [seed[1]] : []), ...associated.flatMap(f => f.docs)])], initializedCommit: commit, sourceHash: node.sourceHash || '' };
  }
  return result;
}
