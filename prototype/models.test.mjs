import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { MODELS } from "../packages/ai/src/models.generated.ts";
import { getSupportedThinkingLevels, clampThinkingLevel } from "../packages/ai/src/models.ts";

const context = vm.createContext({ window: {} });
for (const file of ["model-catalog.generated.js", "models.js", "fixtures.js"]) vm.runInContext(readFileSync(new URL(file, import.meta.url), "utf8"), context);
const models = context.window.WorkbenchModels;
test("settings provider entries cover the source catalog without duplicates", () => {
  const providers = Array.from(context.window.WorkbenchFixtures.providers, provider => provider[0]);
  assert.equal(new Set(providers).size, providers.length);
  assert.deepEqual(providers.sort(), Object.keys(MODELS).sort());
});
test("all provider/model names and effort options match local pi-ai source", () => {
  assert.deepEqual(Object.keys(models.catalog).sort(), Object.keys(MODELS).sort(), "provider IDs must match the source catalog");
  for (const [provider, entries] of Object.entries(MODELS)) {
    assert.deepEqual(Array.from(models.catalog[provider], model => model.id).sort(), Object.keys(entries).sort(), `${provider}: model IDs must match`);
    for (const model of Object.values(entries)) {
      const ref = `${provider}/${model.id}`;
      assert.equal(models.name(ref), model.name || model.id);
      assert.equal(models.get(ref).contextWindow, model.contextWindow);
      assert.equal(models.get(ref).maxTokens, model.maxTokens);
      assert.deepEqual([...models.levels(ref)], getSupportedThinkingLevels(model));
      for (const level of ["off", "minimal", "low", "medium", "high", "xhigh", "max"]) {
        assert.equal(models.normalize(ref, level), clampThinkingLevel(model, level));
      }
    }
  }
});

test("catalog refresh exposes new capabilities and preserves removed model references", () => {
  assert.ok(models.get("qwen-token-plan-individual-cn/qwen3.8-max"));
  assert.deepEqual([...models.levels("kimi-coding/k3.1-pro")], ["low", "high", "max"]);
  assert.equal(models.get("azure/gpt-6-sol").contextWindow, 1050000);
  const record = { model: "openai/gpt-realtime-2.1", thinking: "high", task: "保留草稿", project: "p2", id: "s7" };
  models.migrate(record);
  assert.equal(record.model, "openai/gpt-realtime-2.1");
  assert.equal(models.get(record.model), undefined);
  assert.equal(models.label(record.model, record.thinking), "能力未知");
  assert.equal(record.task, "保留草稿");
  assert.equal(record.project, "p2");
  assert.equal(record.id, "s7");
});
test("switching to a nonreasoning model clears effort; restricted model uses supported fallback", () => {
  assert.equal(models.normalize("openai/gpt-4.1", "max"), "off");
  assert.equal(models.label("openai/gpt-4.1", "off"), "不支持思考");
  assert.deepEqual([...models.levels("deepseek/deepseek-v4-pro")], ["off", "high", "max"]);
  assert.equal(models.normalize("deepseek/deepseek-v4-pro", "medium"), "high");
});
test("unknown refs do not invent capabilities or discard model namespaces", () => {
  assert.equal(models.name("custom/team/model"), "team/model");
  assert.deepEqual([...models.levels("custom/team/model")], []);
  assert.equal(models.normalize("custom/team/model", "high"), "");
});
test("old demo refs upgrade without losing drafts, project or session identity", () => {
  const record = { model: "deepseek/review-demo", thinking: "标准思考", task: "保留草稿", project: "p2", id: "s7" };
  models.migrate(record);
  assert.equal(record.model, "deepseek/deepseek-v4-pro");
  assert.equal(record.thinking, "high");
  assert.equal(record.task, "保留草稿");
  assert.equal(record.project, "p2");
  assert.equal(record.id, "s7");
  assert.ok(models.get(models.defaultRef("openai")));
});
test("sample sessions reference real catalog entries", () => {
  for (const session of context.window.WorkbenchFixtures.sessions) assert.ok(models.get(session.model), session.model);
});

test("context overrides allow catalog defaults or a smaller positive integer, never invent capacity", () => {
  const ref = "deepseek/deepseek-v4-pro";
  const ceiling = models.get(ref).contextWindow;
  for (const value of ["", "32000", String(ceiling)]) assert.equal(models.contextError(ref, value), "");
  for (const value of ["0", "-1", "3.5", "NaN", "Infinity", String(ceiling + 1)]) assert.ok(models.contextError(ref, value));
  assert.ok(models.contextError("custom/unknown", "32000"));
  assert.equal(models.tokens(undefined), "未知");
});
