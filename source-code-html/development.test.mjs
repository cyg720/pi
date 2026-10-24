import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, relative, sep } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { developmentGuide } from './src/development.mjs';
import { produceArtifactSet } from '../scripts/package-artifacts.mjs';
import { installConsumer, smokeTestNpmConsumer } from '../scripts/local-package-install.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(dir, '..');
const commands = developmentGuide.sections.flatMap(s => s.commands || []);
function removeFixture(folder) {
  const target = resolve(folder);
  const local = relative(resolve(tmpdir()), target);
  assert.ok(/^pi-doc-(?:source|deploy|powershell)-[\w-]+$/.test(local) && !local.includes(sep));
  rmSync(target, { recursive: true, force: true });
}

test('开发说明的命令和来源均落在当前仓库契约内', () => {
  assert.equal(developmentGuide.sections.length, 17);
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  for (const section of developmentGuide.sections) for (const [path, needle] of section.refs || []) {
    assert.ok(readFileSync(join(root, path), 'utf8').includes(needle), `${path}: ${needle}`);
  }
  for (const command of commands) {
    assert.ok(command.title && command.code && command.expected);
    for (const [, name] of command.code.matchAll(/npm(?:\.cmd)? run ([\w:-]+)/g)) assert.ok(pkg.scripts[name], name);
  }
  for (const helper of [produceArtifactSet, installConsumer, smokeTestNpmConsumer]) assert.equal(typeof helper, 'function');
});

test('断点配置指向源码并预加载解析器，附加端口与说明一致', () => {
  const launch = JSON.parse(commands.find(c => c.shell === 'json').code);
  assert.equal(launch.version, '0.2.0');
  assert.equal(launch.configurations.length, 3);
  for (const config of launch.configurations.filter(c => c.request === 'launch')) {
    assert.equal(config.type, 'node');
    assert.equal(config.console, 'integratedTerminal');
    assert.ok(config.runtimeArgs.includes('./packages/coding-agent/src/experimental/source-resolver.ts'));
    assert.equal(config.program, '${workspaceFolder}/packages/coding-agent/src/cli.ts');
    assert.ok(readFileSync(config.program.replace('${workspaceFolder}', root), 'utf8').includes('main(process.argv.slice(2))'));
    assert.equal(config.sourceMaps, false);
  }
  assert.equal(launch.configurations[2].address, '127.0.0.1');
  assert.equal(launch.configurations[2].port, 9229);
  for (const command of commands) assert.doesNotMatch(command.code, /experimental\/cli\.ts|\.\/pi-test\.sh/);
});

test('原生 TypeScript 与工作区 source-resolver 可在不加载模型时解析到 src', () => {
  const folder = mkdtempSync(join(tmpdir(), 'pi-doc-source-'));
  try {
    const probe = join(folder, 'probe.ts');
    writeFileSync(probe, 'import assert from "node:assert/strict";\nimport { fileURLToPath } from "node:url";\nconst resolved: string = fileURLToPath(import.meta.resolve("@earendil-works/pi-coding-agent"));\nassert.equal(resolved, process.argv[2]);\nconsole.log("source alias ok");\n');
    const output = execFileSync(process.execPath, ['--import', pathToFileURL(join(root, 'packages/coding-agent/src/experimental/source-resolver.ts')).href, probe, join(root, 'packages/coding-agent/src/index.ts')], { cwd: root, encoding: 'utf8' });
    assert.match(output, /source alias ok/);
  } finally { removeFixture(folder); }
});

test('本地部署模板 JavaScript 语法有效，不执行构建和安装', () => {
  const folder = mkdtempSync(join(tmpdir(), 'pi-doc-deploy-'));
  try {
    const file = join(folder, 'deploy-local.mjs');
    writeFileSync(file, commands.find(c => c.shell === 'javascript').code);
    execFileSync(process.execPath, ['--check', file]);
  } finally { removeFixture(folder); }
});

test('PowerShell 命令块只做语法解析，不执行开发命令', { skip: process.platform !== 'win32' }, () => {
  const folder = mkdtempSync(join(tmpdir(), 'pi-doc-powershell-'));
  try {
    const file = join(folder, 'commands.ps1');
    writeFileSync(file, '\ufeff' + commands.filter(c => c.shell === 'powershell').map(c => c.code).join('\n\n'));
    const quoted = file.replaceAll("'", "''");
    const parser = `$piDocErrors = $null; [System.Management.Automation.Language.Parser]::ParseFile('${quoted}', [ref]$null, [ref]$piDocErrors) | Out-Null; if ($piDocErrors.Count) { $piDocErrors | ForEach-Object { $_.Message }; exit 1 }`;
    execFileSync('powershell.exe', ['-NoProfile', '-Command', parser], { encoding: 'utf8' });
    const resolverLine = commands.flatMap(c => c.code.split('\n')).find(line => line.startsWith('$piResolverUrl = node -p '));
    const output = execFileSync('powershell.exe', ['-NoProfile', '-Command', `${resolverLine}; Write-Output $piResolverUrl`], { cwd: root, encoding: 'utf8' });
    assert.equal(output.trim(), pathToFileURL(join(root, 'packages/coding-agent/src/experimental/source-resolver.ts')).href);
  } finally { removeFixture(folder); }
});

test('开发命令渲染保留复制定位、转义 HTML 并按 shell 筛选', () => {
  const helpers = runInNewContext(`${readFileSync(join(dir, 'src/development-app.js'), 'utf8')}; ({ renderGuideBlocks, readGuideCommand, filterGuideCommands });`);
  const section = { steps: ['先准备 <数据>'], commands: [{ title: '命令', shell: 'powershell', code: 'Write-Output "<tag>"', expected: '输出 <tag>' }] };
  const esc = value => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const html = helpers.renderGuideBlocks(section, 'development', 2, esc);
  assert.match(html, /data-copy-command="development:2:0"/);
  assert.match(html, /data-command-shell="powershell"/);
  assert.match(html, /&lt;tag&gt;/);
  assert.doesNotMatch(html, /<tag>/);
  assert.equal(helpers.readGuideCommand([{ id: 'development', sections: [{}, {}, section] }], 'development:2:0'), section.commands[0].code);
  assert.equal(helpers.readGuideCommand([developmentGuide], 'development:999:999'), undefined);
  const rows = ['powershell','bash','json'].map(shell => ({ dataset: { commandShell: shell }, hidden: false }));
  helpers.filterGuideCommands({ querySelectorAll() { return rows; } }, 'powershell');
  assert.deepEqual(rows.map(r => r.hidden), [false,true,false]);
  helpers.filterGuideCommands({ querySelectorAll() { return rows; } }, 'all');
  assert.ok(rows.every(r => !r.hidden));
});

test('本地开发菜单接入页面路由、复制、进度恢复和全文搜索', async () => {
  const data = { chapters: [developmentGuide], meta: { commit: '0123456789', version: '1.0.2', builtAt: '2026-10-05' }, commits: [], sources: {}, packages: [], trace: [] };
  const nodes = new Map();
  const makeNode = () => ({ value: '', innerHTML: '', textContent: '', checked: false, dataset: {}, listeners: {}, classList: { toggle() {}, remove() {}, add() {} }, addEventListener(type, fn) { this.listeners[type] = fn; }, setAttribute() {} });
  for (const id of ['doc-data','main','nav','devProgress','commandShell','progressText','progress','sourceDialog','diagramDialog','sourceFind','globalSearch','menu','breadcrumb','version','sidebarMeta','searchResults','toast']) nodes.set(id, makeNode());
  nodes.get('doc-data').textContent = JSON.stringify(data);
  const rows = ['powershell','bash','json'].map(shell => ({ dataset: { commandShell: shell }, hidden: false }));
  const checkbox = { ...makeNode(), dataset: { devComplete: '3' } };
  nodes.get('main').querySelectorAll = selector => selector === '[data-command-shell]' ? rows : selector === '[data-dev-complete]' ? [checkbox] : [];
  const events = {}, windowEvents = {}, storage = new Map();
  let copied;
  const location = { hash: '#development' };
  const document = { title: '', body: makeNode(), getElementById(id) { return nodes.get(id) || null; }, querySelector() { return makeNode(); }, querySelectorAll() { return []; }, addEventListener(type, fn) { events[type] = fn; } };
  runInNewContext(`${readFileSync(join(dir, 'src/development-app.js'), 'utf8')}\n${readFileSync(join(dir, 'src/directory-app.js'), 'utf8')}\n${readFileSync(join(dir, 'src/package-tutorials-app.js'), 'utf8')}\n${readFileSync(join(dir, 'src/app.js'), 'utf8')}`, {
    document, location, window: { addEventListener(type, fn) { windowEvents[type] = fn; }, scrollTo() {} },
    localStorage: { getItem(key) { return storage.get(key) || null; }, setItem(key, value) { storage.set(key, value); } },
    navigator: { clipboard: { async writeText(text) { copied = text; } } },
    createMasteryBrowser() { return { search() { return []; } }; },
    createVersionBrowser() { return { search() { return []; } }; },
    createFeatureBrowser() { return { search() { return []; }, render() { return '<div>功能清单</div>'; }, activate() {}, rememberMenu() {} }; },
    setTimeout() { return 1; }, clearTimeout() {}, clearInterval() {}
  });
  assert.match(nodes.get('nav').innerHTML, /href="#development"[^>]*class="nav-link active"/);
  assert.match(nodes.get('main').innerHTML, /data-copy-command="development:4:0"/);
  assert.equal(nodes.get('progressText').textContent, '0 / 8');
  assert.equal(nodes.get('devProgress').textContent, '0 / 17 个阶段已确认');
  const button = { id: '', dataset: { copyCommand: 'development:4:0' } };
  await events.click({ target: { closest() { return button; } } });
  assert.equal(copied, developmentGuide.sections[4].commands[0].code);
  nodes.get('commandShell').value = 'bash';
  nodes.get('commandShell').listeners.change();
  assert.deepEqual(rows.map(r => r.hidden), [true,false,false]);
  checkbox.checked = true;
  checkbox.listeners.change();
  assert.equal(nodes.get('devProgress').textContent, '1 / 17 个阶段已确认');
  location.hash = '#functions'; windowEvents.hashchange();
  location.hash = '#development'; windowEvents.hashchange();
  assert.match(nodes.get('main').innerHTML, /data-dev-complete="3" checked/);
  assert.deepEqual(JSON.parse(storage.get('pi-doc-development-012345678')), [3]);
  nodes.get('globalSearch').value = 'hydrate:model-data';
  nodes.get('globalSearch').listeners.input();
  assert.match(nodes.get('searchResults').innerHTML, /data-go="development\/section-3"/);
});
