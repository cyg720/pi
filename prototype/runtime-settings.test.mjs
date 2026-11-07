import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { MODELS } from "../packages/ai/src/models.generated.ts";
import { usesGoogleThinkingLevel } from "../packages/ai/src/api/google-shared.ts";

const context = vm.createContext({ window: {}, URL });
for (const file of ["model-catalog.generated.js", "runtime-settings.js"]) vm.runInContext(readFileSync(new URL(file, import.meta.url), "utf8"), context);
const settings = context.window.WorkbenchRuntimeSettings;
const catalog = context.window.WorkbenchModelCatalog;
const retry = settings.groups.find(group => group.id === "retry").fields;

test("catalog settings capabilities derive from current source, including Google discrete thinking", () => {
  for (const [provider, entries] of Object.entries(MODELS)) for (const model of Object.values(entries)) {
    const snapshot = catalog[provider].find(item => item.id === model.id);
    assert.equal(snapshot.api, model.api);
    assert.deepEqual([...snapshot.input], [...model.input]);
    const expected = model.reasoning && ((model.api === "anthropic-messages" && model.compat?.forceAdaptiveThinking !== true) || (["google-generative-ai", "google-vertex"].includes(model.api) && !usesGoogleThinkingLevel(model)));
    assert.equal(snapshot.budgetControl, expected);
    const keys = settings.modelFields(snapshot).map(field => field.key);
    assert.equal(keys.includes("thinkingBudgets.high"), expected);
    assert.equal(keys.includes("temperature"), !model.reasoning);
    assert.equal(keys.includes("maxTokens"), model.api !== "openai-codex-responses");
  }
});
test("Durable retry default preview counts initial call separately and serializes seconds to ms", () => {
  const result = settings.parse(retry, {});
  assert.equal(result.payload["retry.baseDelayMs"], 2000);
  assert.equal(result.payload["retry.maxAgentDelayMs"], 60000);
  assert.match(settings.retryPreview(result.values), /2、4、8 秒/);
  assert.match(settings.retryPreview(result.values), /最多 4 次/);
});
test("reject invalid and inconsistent retry numbers; zero and disabled do not retry", () => {
  for (const value of ["", "NaN", "Infinity", "-1", "1.5", "11"]) assert.ok(settings.parse(retry, {"retry.maxRetries":value}).errors["retry.maxRetries"]);
  assert.ok(settings.parse(retry, {"retry.baseDelayMs":"70", "retry.maxAgentDelayMs":"60"}).errors["retry.maxAgentDelayMs"]);
  assert.equal(settings.retryPreview(settings.parse(retry, {"retry.maxRetries":"0"}).values), "不自动重试。");
  assert.equal(settings.retryPreview(settings.parse(retry, {"retry.enabled":false}).values), "不自动重试。");
  assert.match(settings.retryPreview(settings.parse(retry, {"retry.maxRetries":"5", "retry.maxAgentDelayMs":"4"}).values), /2、4、4、4、4/);
});
test("optional blank timeout omitted; zero server delay retains unlimited meaning; protocol options gated", () => {
  const fields = settings.connectionFields(false);
  const result = settings.parse(fields, {maxRetryDelayMs:"0"});
  assert.equal(result.payload.timeoutMs, undefined);
  assert.equal(result.payload.maxRetryDelayMs, 0);
  assert.equal(result.payload.maxRetries, 0);
  assert.equal(settings.parse(fields, {timeoutMs:"15"}).payload.timeoutMs, 15000);
  assert.ok(settings.parse(fields, {timeoutMs:"0"}).errors.timeoutMs);
  assert.ok(!fields.some(field => field.key === "transport"));
  assert.ok(settings.connectionFields(true).some(field => field.key === "transport"));
  assert.ok(settings.parse(settings.connectionFields(true), {transport:"invented"}).errors.transport);
});
test("model output bounds and unsupported fields cannot leak into payload", () => {
  const model = catalog.openai.find(model => model.id === "gpt-4.1");
  const fields = settings.modelFields(model);
  assert.ok(settings.parse(fields, {maxTokens:String(model.maxTokens+1)}).errors.maxTokens);
  assert.ok(settings.parse(fields, {temperature:"1.1"}).errors.temperature);
  const result = settings.parse(fields, {temperature:"0.3", maxTokens:"", "thinkingBudgets.high":"1234", thinkingLevel:"high"});
  assert.equal(result.payload.maxTokens, undefined);
  assert.equal(result.payload["thinkingBudgets.high"], undefined);
  assert.equal(result.payload.temperature, 0.3);
  assert.ok(result.errors.thinkingLevel);
});
test("proxy accepts empty and HTTP endpoints, rejects credentials and script URLs", () => {
  const fields = settings.groups.find(group => group.id === "network").fields;
  for (const value of ["", "http://127.0.0.1:7890", "https://proxy.example"]) assert.equal(settings.parse(fields, {httpProxy:value}).errors.httpProxy, undefined);
  for (const value of ["javascript:alert(1)", "http://user:pass@localhost", "bad", "socks5://localhost"]) assert.ok(settings.parse(fields, {httpProxy:value}).errors.httpProxy);
});
test("per-model compaction overrides omit inherited values and reject beyond window", () => {
  const model = catalog.openai[0];
  const fields = settings.modelFields(model);
  assert.equal(settings.parse(fields, {}).payload["compaction.reserveTokens"], undefined);
  assert.equal(settings.parse(fields, {"compaction.backgroundTokens":"0"}).payload["compaction.backgroundTokens"], 0);
  assert.ok(settings.parse(fields, {"compaction.reserveTokens":String(model.contextWindow)}).errors["compaction.reserveTokens"]);
});
