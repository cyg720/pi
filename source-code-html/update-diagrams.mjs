import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { offlineDiagram, verifyDiagram } from './src/media.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(dir, '..');
const archify = process.argv[2];
if (!archify) throw new Error('请提供 Archify 的 bin/archify.mjs 路径');
const baseline = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const reviewed = JSON.parse(readFileSync(join(dir, 'src/diagrams/architecture.json'), 'utf8')).meta.repository.revision;
if (reviewed !== baseline) throw new Error('请先按当前源码复核五幅规格，再更新架构规格中的 revision');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const specs = [
  ['architecture', 'pi-system-architecture.html'], ['workflow', 'pi-task-workflow.html'],
  ['sequence', 'pi-task-sequence.html'], ['dataflow', 'pi-task-dataflow.html'], ['lifecycle', 'pi-task-lifecycle.html']
];
const generated = join(dir, 'diagrams/generated');
mkdirSync(generated, { recursive: true });
const diagrams = specs.map(([type, file]) => {
  const input = join(dir, `src/diagrams/${type}.json`);
  const target = join(generated, file);
  const args = [resolve(archify), 'deliver', type, input, target, '--quality', 'showcase', '--json'];
  if (type === 'architecture') args.push('--repo-root', root);
  const receipt = JSON.parse(execFileSync(process.execPath, args, { encoding: 'utf8' }));
  const raw = readFileSync(target, 'utf8');
  const html = offlineDiagram(raw);
  const item = { type, file, specification: receipt.specification, artifact: receipt.artifact, validation: receipt.validation, offlineSha256: sha(html) };
  verifyDiagram(item, readFileSync(input, 'utf8'), raw, html);
  writeFileSync(join(dir, 'diagrams', file), html);
  execFileSync(process.execPath, [resolve(archify), 'check', join(dir, 'diagrams', file)], { encoding: 'utf8' });
  writeFileSync(join(generated, `${type}.receipt.json`), JSON.stringify(receipt, null, 2) + '\n');
  console.log(`${type}: 原始交付与离线封装均通过检查`);
  return item;
});
const sources = [
  ...readdirSync(join(root, 'packages')).map(name => `packages/${name}/package.json`),
  'packages/coding-agent/docs/how-pi-works.md', 'packages/coding-agent/src/core/sdk.ts',
  'packages/coding-agent/src/core/agent-session.ts', 'packages/coding-agent/src/core/session-manager.ts',
  'packages/agent/src/agent.ts', 'packages/agent/src/agent-loop.ts', 'packages/agent/src/types.ts',
  'packages/ai/src/models.ts', 'packages/durable/src/types.ts', 'packages/durable/src/harness/scheduler.ts'
];
writeFileSync(join(dir, 'diagrams/manifest.json'), JSON.stringify({
  baseline, sourceHashes: Object.fromEntries(sources.map(path => [path, sha(readFileSync(join(root, path)))])),
  diagrams, review: { date: new Date().toISOString().slice(0, 10), scope: '当前包关系、CLI 主线、单次工具调用、会话上下文及 Durable TaskState', browserEvidence: 'not-run', visualReview: 'pending', offlinePackaging: '移除在线字体 link 并加入 CSP；原始交付字节另存 generated。' }
}, null, 2) + '\n');
