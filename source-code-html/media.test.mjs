import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { compileDecks } from './src/slides.mjs';
import { offlineDiagram, verifyDiagram } from './src/media.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const course = JSON.parse(read('./data/mastery.json'));
const features = JSON.parse(read('./data/features.json')).features;

test('课件正文和讲者备注使用同一份当前课程，拒绝失配基线', () => {
  const decks = compileDecks(course, features, course.plan.baseline);
  assert.equal(decks.length, 8);
  assert.equal(decks.reduce((n, deck) => n + deck.slides.length, 0), 132);
  for (const deck of decks) for (const slide of deck.slides) {
    const route = course.routes.find(r => r.id === slide.route);
    assert.equal(slide.text.title, route.title);
    assert.ok(slide.notes.includes(course.plan.baseline));
    assert.ok(slide.notes.includes(route.answer));
    for (const step of route.steps) for (const ref of step.refs) assert.ok(slide.notes.includes(`${ref.path}:${ref.line}`));
  }
  assert.throws(() => compileDecks(course, features, 'old'), /基线/);
  const durability = decks.find(d => d.stage === 'durability').slides.map(s => s.notes).join('\n');
  for (const term of ['watchDoc', 'Conversation.watch', 'IndexedDB', 'readOnly', 'adopt']) assert.ok(durability.includes(term), term);
});

test('离线封装仅移除在线字体并增加网络隔离，保持图形与脚本', () => {
  const raw = '<html><head><link href="https://fonts.example/font.css" rel="stylesheet"></head><body><svg>diagram</svg><script>const x = 1;</script></body></html>';
  const offline = offlineDiagram(raw);
  assert.doesNotMatch(offline, /fonts.example/);
  assert.match(offline, /connect-src 'none'/);
  assert.match(offline, /<svg>diagram<\/svg>/);
  assert.match(offline, /<script>const x = 1;<\/script>/);
});

test('五图绑定当前源码、规格和交付字节，失配必须报错', () => {
  const manifest = JSON.parse(read('./diagrams/manifest.json'));
  assert.equal(manifest.baseline, course.plan.baseline);
  assert.equal(manifest.diagrams.length, 5);
  for (const item of manifest.diagrams) {
    const raw = read(`./diagrams/generated/${item.file}`);
    const spec = read(`./src/diagrams/${item.type}.json`);
    const html = read(`./diagrams/${item.file}`);
    assert.equal(verifyDiagram(item, spec, raw, html), true);
    assert.throws(() => verifyDiagram(item, spec, `${raw} changed`, html), /指纹/);
    assert.deepEqual(item.validation, { checksPassed: 9, checkCount: 9, compositionProfile: 'showcase', compositionStatus: 'pass', errors: 0, warnings: 0 });
  }
  for (const [path, expected] of Object.entries(manifest.sourceHashes)) assert.equal(hash(read(`../${path}`)), expected, path);
});

test('当前课件可下载且旧课件逐字节存档', () => {
  const manifest = JSON.parse(read('./learning-slides/manifest.json'));
  const old = JSON.parse(read('./history/learning-slides-2026-10-17/manifest.json'));
  assert.equal(manifest.baseline, course.plan.baseline);
  assert.equal(manifest.courseHash, hash(JSON.stringify(course.routes)));
  assert.equal(manifest.contentHash, hash(JSON.stringify(compileDecks(course, features, course.plan.baseline))));
  assert.equal(manifest.review.validationSha256, hash(read('./learning-slides/validation.json')));
  assert.equal(course.decksStale, false);
  for (const deck of old.decks) {
    const bytes = readFileSync(new URL(`./history/learning-slides-2026-10-17/${deck.filename}`, import.meta.url));
    assert.equal(hash(bytes), deck.sha256);
    assert.notEqual(manifest.decks.find(d => d.stage === deck.stage).sha256, deck.sha256);
  }
});
