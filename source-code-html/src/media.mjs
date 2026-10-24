import { createHash } from 'node:crypto';

export function offlineDiagram(raw) {
  const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src blob: data:; worker-src blob:; connect-src 'none'">`;
  return raw.replace(/<link\b[^>]*href=["']https?:[^>]*>/gi, '').replace(/<head([^>]*)>/i, `<head$1>${policy}`);
}

export function verifyDiagram(item, spec, raw, offline) {
  for (const [name, bytes, expected] of [['规格', spec, item.specification.sha256], ['交付图', raw, item.artifact.sha256], ['离线图', offline, item.offlineSha256]]) {
    if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error(`${item.file} ${name}指纹失效`);
  }
  if (offline !== offlineDiagram(raw)) throw new Error(`${item.file} 离线封装失配`);
  return true;
}
