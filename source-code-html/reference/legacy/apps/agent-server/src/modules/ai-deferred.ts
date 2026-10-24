import { createModels, fauxAssistantMessage, fauxProvider } from "@earendil-works/pi-ai";
import { normalizeContext } from "@earendil-works/pi-ai/utils/transcript";
import { type JsonValue, ProtocolValidationError } from "@pi-workbench/protocol";
import { inputObject, wireResult } from "./common.ts";
import { readOperationFields } from "./fields.ts";

export async function aiDeferred(input: unknown): Promise<JsonValue> {
	const value = inputObject(input, ["fields"]);
	const fields = readOperationFields("ai", "deferred", value.fields);
	const deferred = fields.deferred ?? false;
	if (typeof deferred !== "boolean")
		throw new ProtocolValidationError(
			"deferred",
			"Local faux supports boolean lifecycle only; provider scheduling window requires a supporting external provider",
		);
	const faux = fauxProvider({ tokensPerSecond: 0, deferred: { pendingFetches: 1, pollAfterMs: 1 } });
	const models = createModels();
	models.setProvider(faux.provider);
	faux.setResponses([fauxAssistantMessage("Local deferred result")]);
	const model = faux.getModel();
	const context = normalizeContext({ messages: [{ role: "user", content: "Local", timestamp: 0 }] });
	const first = await models.streamSimple(model, context, { deferred, env: {} }).result();
	const stages = [first.stopReason];
	if (first.deferred) {
		const pending = await models.fetchDeferred(model, first.deferred, { env: {} });
		stages.push(pending.stopReason);
		const ready = await models.fetchDeferred(model, first.deferred, { env: {} });
		stages.push(ready.stopReason);
		await models.cancelDeferred(model, first.deferred, { env: {} });
	}
	return wireResult({
		backend: "native explicit faux deferred lifecycle",
		stages,
		deferredFetchCount: faux.state.deferredFetchCount,
		cancelledHandles: faux.state.cancelledDeferred.length,
		externalRequests: 0,
		schedulingWindowVerified: false,
	});
}
