import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const data = JSON.parse(read('./index.html').match(/<script id="doc-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);

test('上游 1.5 合并包含 p2、Schema、Chord v2 与 Durable 新提交契约', () => {
  assert.equal(data.meta.version, '1.5.0');
  for (const id of ['schema', 'p2']) assert.ok(data.tutorials.find(item => item.id === id)?.lesson.flow.length >= 3, id);
  for (const path of ['apps/p2/plugins/sessions/server.ts', 'packages/ai/catalog/generate.ts', 'packages/chord/src/host/host.ts']) {
    assert.ok(data.catalog.files[path], path);
    assert.ok(data.sources[path], path);
  }
  const text = JSON.stringify([data.chapters, data.tutorials.map(item => item.lesson), data.mastery.routes, data.catalog.features]);
  assert.doesNotMatch(text, /Storage\.commit\(writes, adopt, context\)|retryTask 显式重试|当前 checkout 没有 apps|hostNamed\/hostFamily/);
  assert.match(text, /commit\(batches, receive, context\)/);
  assert.match(text, /ConversationTranscript/);
  assert.match(text, /实验原型/);
});

test('上游更新报告使用合并父提交，区分版本与 Unreleased', () => {
  const report = data.sources['source-code-html/UPSTREAM-UPDATE.md'];
  assert.ok(report);
  for (const term of ['526', 'e49e3d5e8', '085c84e98', 'Unreleased', 'p2', 'pi-schema']) assert.ok(report.includes(term), term);
  assert.ok(data.chapters.find(item => item.id === 'start').sections.some(item => item.refs?.some(([path]) => path.endsWith('UPSTREAM-UPDATE.md'))));
});
