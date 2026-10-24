export function compareEdition(catalog, sourceHashes, baseline, current) {
  const oldFeatures = new Map(baseline.features.map(f => [f.id, f]));
  const currentIds = new Set(catalog.features.map(f => f.id));
  const files = Object.keys(catalog.files);
  const previousFiles = new Set(baseline.features.flatMap(f => f.files));
  for (const feature of catalog.features) {
    feature.update = !oldFeatures.has(feature.id) ? '本次补充' : feature.files.some(p => sourceHashes[p] && sourceHashes[p] !== baseline.sourceHashes[p]) ? '来源更新' : '已有条目';
  }
  return {
    from: baseline.commit, to: current,
    addedFiles: files.filter(p => !previousFiles.has(p)),
    changedFiles: files.filter(p => previousFiles.has(p) && sourceHashes[p] && sourceHashes[p] !== baseline.sourceHashes[p]),
    removedFiles: [...previousFiles].filter(p => !catalog.files[p]),
    addedExplanations: catalog.features.filter(f => !oldFeatures.has(f.id) && f.evidence === '中文能力解说').map(f => f.id),
    retiredFeatures: baseline.features.filter(f => !currentIds.has(f.id) && !f.id.includes('-support')).map(f => ({ id: f.id, title: f.title, files: f.files }))
  };
}
