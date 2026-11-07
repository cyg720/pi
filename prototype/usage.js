/* Explicit visual scenarios. No fabricated live telemetry. */
(() => {
  "use strict";
  const valid = value => Number.isFinite(value) && value >= 0;
  function clean(value) {
    if (!value || value.demo !== true) return null;
    const output = { demo: true, partial: value.partial === true };
    for (const key of ["steps", "output", "durationMs", "toolTokens", "approvalTokens", "contextTokens", "contextWindow"]) if (valid(value[key])) output[key] = value[key];
    output.models = (Array.isArray(value.models) ? value.models : []).map(model => Object.fromEntries(["input", "output", "cacheRead", "cacheWrite"].filter(key => valid(model?.[key])).map(key => [key, model[key]])));
    return output;
  }
  function read(session) {
    const value = clean(session?.usageSample);
    const samples = session?.agent === "review" ? [...(session.reviewRounds || []).filter(item => item.round < session.round).map(item => clean(item.usageSample)), value] : [value];
    const known = samples.filter(Boolean);
    if (!known.length) return { tokens: null, cache: null, speed: null, context: null, steps: null, partial: false, demo: false };
    const models = known.flatMap(item => item.models);
    const complete = models.length && models.every(model => ["input", "output", "cacheRead", "cacheWrite"].every(key => valid(model[key])));
    const sum = key => models.reduce((total, model) => total + (model[key] || 0), 0);
    const input = sum("input") + sum("cacheRead") + sum("cacheWrite");
    const cache = complete && input > 0 && sum("cacheRead") + sum("cacheWrite") > 0 ? Math.round(sum("cacheRead") / input * 100) : null;
    const allKnown = samples.every(Boolean);
    return { demo: true, partial: !allKnown || known.some(item => item.partial) || !complete || cache !== null,
      tokens: allKnown && complete && known.every(item => valid(item.toolTokens) && valid(item.approvalTokens)) ? input + sum("output") + known.reduce((sum, item) => sum + item.toolTokens + item.approvalTokens, 0) : null,
      cache: allKnown ? cache : null,
      speed: value && valid(value.output) && value.durationMs > 0 ? Math.round(value.output / (value.durationMs / 1000)) : null,
      context: value && valid(value.contextTokens) && value.contextWindow > 0 ? Math.round(value.contextTokens / value.contextWindow * 100) : null,
      steps: allKnown && known.every(item => valid(item.steps)) ? known.reduce((sum, item) => sum + item.steps, 0) : null };
  }
  function example(type) {
    if (type === "unknown") return null;
    return { demo: true, partial: true, steps: 4, models: [{ input: 30, output: 30, cacheRead: 20, cacheWrite: 0 }], toolTokens: 20, approvalTokens: 70,
      ...(type === "partial" ? {} : { output: 30, durationMs: 1000, contextTokens: 100, contextWindow: 1000 }) };
  }
  window.WorkbenchUsage = { read, clean, example };
})();
