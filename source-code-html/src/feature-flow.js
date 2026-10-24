/* Source-backed, one-hop reference map. Arrows mean importer -> imported file. */
function createReferenceFlow(path, record, sources, esc) {
  const incoming = [...record.consumers.map(r => ({ ...r, test: false })), ...(record.tests || []).map(r => ({ ...r, test: true }))];
  const outgoing = record.imports;
  let page = 0;
  const pages = Math.max(1, Math.ceil(Math.max(incoming.length, outgoing.length) / 3));
  function render() {
    const left = incoming.slice(page * 3, page * 3 + 3);
    const right = outgoing.slice(page * 3, page * 3 + 3);
    const nodes = [];
    const edges = [];
    function node(file, x, y, tone, label, sourceLine = 1, reference = '') {
      const clickable = Object.hasOwn(sources, file);
      const name = file.split('/').pop();
      const parts = [];
      for (let i = 0; i < name.length; i += 30) parts.push(name.slice(i, i + 30));
      const visible = parts.slice(0, 2);
      if (parts.length > 2) visible[1] = `${visible[1].slice(0, 27)}…`;
      const parent = file.slice(0, Math.max(0, file.lastIndexOf('/')));
      const shortParent = parent.length > 36 ? `…${parent.slice(-35)}` : parent;
      nodes.push(`<g class="flow-node flow-${tone}${clickable ? ' flow-clickable' : ''}" ${clickable ? `role="button" tabindex="0" data-source="${esc(file)}" data-line="${sourceLine}" aria-label="打开 ${esc(file)} 第 ${sourceLine} 行"` : 'role="group"'}><title>${esc(file)}${reference ? ` · ${esc(reference)}` : ''}${clickable ? ' · 点击阅读源码' : ' · 未收录离线源码'}</title><rect x="${x}" y="${y}" width="276" height="100" rx="9"/><text class="flow-role" x="${x + 14}" y="${y + 20}">${esc(label)}</text><text class="flow-name" x="${x + 138}" y="${y + 43}" text-anchor="middle">${visible.map((part, i) => `<tspan x="${x + 138}" dy="${i ? 17 : 0}">${esc(part)}</tspan>`).join('')}</text><text class="flow-path" x="${x + 138}" y="${y + 84}" text-anchor="middle">${esc(shortParent || '根目录 / 外部标识')}</text></g>`);
    }
    node(path, 412, 220, 'focus', '当前功能的实现文件');
    left.forEach((r, i) => {
      const y = 78 + i * 144;
      const kind = `${r.test ? '测试 · ' : ''}${r.typeOnly ? '类型' : ''}${r.kind} · L${r.line}`;
      node(r.path, 20, y, r.test ? 'test' : 'consumer', kind, r.line);
      edges.push(`<path class="flow-edge${r.typeOnly ? ' flow-type' : ''}" d="M296 ${y + 50} H${328 + i * 22} V${244 + i * 26} H410" marker-end="url(#flowArrow)"><title>${esc(r.path)} → ${esc(path)} · ${esc(kind)}</title></path>`);
    });
    right.forEach((r, i) => {
      const y = 78 + i * 144;
      const kind = `${r.typeOnly ? '类型' : ''}${r.kind}${r.target ? '' : ' · 外部/未解析'}`;
      node(r.target || r.spec, 804, y, r.target ? 'dependency' : 'external', kind, 1, `当前文件 L${r.line}：${r.spec}`);
      edges.push(`<path class="flow-edge${r.typeOnly ? ' flow-type' : ''}" d="M688 ${244 + i * 26} H${714 + i * 22} V${y + 50} H802" marker-end="url(#flowArrow)"><title>${esc(path)} → ${esc(r.target || r.spec)} · ${esc(kind)} · L${r.line}</title></path>`);
    });
    return `<div class="reference-flow"><div class="flow-heading"><h3>引用关联流程图</h3><span>${incoming.length} 条入向引用 · ${outgoing.length} 条出向引用</span></div><p>箭头表示“引用方 → 被引用方”，实线为普通导入/再导出，虚线为类型引用。这是当前文件的静态关系，不代表运行时执行顺序。点击节点阅读源码；完整路径可悬停查看。</p><div class="flow-viewport" tabindex="0" aria-label="引用关系图，窄屏可横向滚动"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 496" role="group" aria-label="${esc(path)} 的静态引用流程图"><defs><pattern id="flowGrid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" class="flow-grid" fill="none"/></pattern><marker id="flowArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" class="flow-arrow"/></marker></defs><rect width="1100" height="496" fill="url(#flowGrid)"/><path d="M390 20V476 M710 20V476" class="flow-lane"/><text x="158" y="38" text-anchor="middle" class="flow-label">引用方 / 测试</text><text x="550" y="38" text-anchor="middle" class="flow-label">当前文件</text><text x="942" y="38" text-anchor="middle" class="flow-label">引用的依赖</text>${edges.join('')}${nodes.join('')}${!left.length ? '<text x="158" y="280" text-anchor="middle" class="flow-label">本页没有入向引用</text>' : ''}${!right.length ? '<text x="942" y="280" text-anchor="middle" class="flow-label">本页没有出向引用</text>' : ''}</svg></div><div class="flow-controls"><button class="quiet" data-flow-step="-1" ${page === 0 ? 'disabled' : ''}>上一组</button><span role="status">${page + 1} / ${pages} · 每侧最多 3 条，分页查看全部关系</span><button class="quiet" data-flow-step="1" ${page === pages - 1 ? 'disabled' : ''}>下一组</button></div></div>`;
  }
  return { render, step(delta) { page = Math.max(0, Math.min(pages - 1, page + delta)); } };
}
