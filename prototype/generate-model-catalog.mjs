// Offline snapshot only: no provider construction, authentication, or requests.
import { writeFile } from "node:fs/promises";
import { MODELS } from "../packages/ai/src/models.generated.ts";
import { getSupportedThinkingLevels, clampThinkingLevel } from "../packages/ai/src/models.ts";
import { usesGoogleThinkingLevel } from "../packages/ai/src/api/google-shared.ts";

const levels = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
const providers = Object.fromEntries(Object.entries(MODELS).map(([provider, models]) => [provider,
  Object.values(models).map(model => ({
    id: model.id, name: model.name || model.id, reasoning: model.reasoning,
    api: model.api, input: model.input,
    budgetControl: model.reasoning && ((model.api === "anthropic-messages" && model.compat?.forceAdaptiveThinking !== true) || (["google-generative-ai", "google-vertex"].includes(model.api) && !usesGoogleThinkingLevel(model))),
    contextWindow: model.contextWindow, maxTokens: model.maxTokens,
    levels: getSupportedThinkingLevels(model),
    clamps: Object.fromEntries(levels.map(level => [level, clampThinkingLevel(model, level)])),
  })),
]));
await writeFile(new URL("model-catalog.generated.js", import.meta.url),
  "/* Generated offline from packages/ai; run node prototype/generate-model-catalog.mjs. */\nwindow.WorkbenchModelCatalog = " + JSON.stringify(providers, null, 2) + ";\n");
console.log(`${Object.keys(providers).length} providers, ${Object.values(providers).flat().length} chat models`);
for (const id of ["openai", "deepseek", "baseten", "radius"]) console.log(id, providers[id].slice(0, 5).map(model => [model.id, model.levels]));
