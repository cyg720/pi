import { type Frame, memoryLinkPair } from "@earendil-works/chord";
import { applyImmutable, track } from "@earendil-works/chord/delta";
import { createModels, getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import { anthropicProvider } from "@earendil-works/pi-ai/providers/anthropic";
import {
	defineTelemetrySchema,
	InMemoryTelemetryContext,
	NOOP_TELEMETRY_CONTEXT,
	type SpanAttributes,
	type TelemetrySchemaDefinition,
} from "@earendil-works/pi-telemetry";
import { stripTerminalSequences, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import { type JsonValue, ProtocolValidationError } from "@pi-workbench/protocol";
import { inputObject, numberInput, textInput, wireResult } from "./common.ts";
import { fieldObject, readOperationFields } from "./fields.ts";

export function catalog(input: unknown): JsonValue {
	const value = inputObject(input, ["fields"]);
	const fields = readOperationFields("ai", "catalog", value.fields);
	const models = createModels();
	// Construction and synchronous catalog reads do not resolve credentials or contact a provider.
	models.setProvider(anthropicProvider());
	const provider =
		fields["model.provider"] === undefined ? undefined : textInput(fields["model.provider"], "model.provider");
	const id = fields["model.id"] === undefined ? undefined : textInput(fields["model.id"], "model.id");
	const selected = id ? models.getModel(provider ?? "anthropic", id) : undefined;
	if ((provider && !models.getProviders().some((item) => item.id === provider)) || (id && !selected))
		throw new ProtocolValidationError("fields", "Unknown bundled provider/model selection");
	return wireResult({
		source: "bundled-sdk-catalog",
		credentialCheckPerformed: false,
		selected: selected ? { id: selected.id, provider: selected.provider, api: selected.api } : null,
		providers: models.getProviders().map((provider) => ({ id: provider.id })),
		models: models.getModels(provider).map((model) => ({
			id: model.id,
			provider: model.provider,
			name: model.name,
			api: model.api,
			reasoning: model.reasoning,
			input: model.input,
			contextWindow: model.contextWindow,
			maxTokens: model.maxTokens,
			thinkingLevels: getSupportedThinkingLevels(model),
		})),
	});
}

export async function chordDelta(input: unknown): Promise<JsonValue> {
	const value = inputObject(input, ["initial", "next", "fields"]);
	const fields = readOperationFields("chord", "delta", value.fields);
	if (fields["workbench.initialState"] !== undefined) value.initial = fields["workbench.initialState"];
	if (fields["workbench.nextState"] !== undefined) value.next = fields["workbench.nextState"];
	if (!value.initial || typeof value.initial !== "object" || !value.next || typeof value.next !== "object")
		throw new ProtocolValidationError("input", "initial and next must be JSON objects or arrays");
	const tracker = track(value.initial);
	const prepared = tracker.prepareReplace(value.next);
	tracker.adopt(prepared);
	const replica = applyImmutable(prepared.base, prepared.ops);
	const [sender, receiver] = memoryLinkPair();
	try {
		const received = new Promise<Frame>((resolve) => receiver.receive(resolve));
		sender.send({ t: "state", hold: 1, m: "value", as: "snap", value: replica });
		return wireResult({
			authority: tracker.value,
			operations: prepared.ops,
			replica,
			received: await received,
			transport: "memoryLinkPair",
		});
	} finally {
		sender.close();
		receiver.close();
	}
}

export async function telemetrySpan(input: unknown): Promise<JsonValue> {
	const value = inputObject(input, ["name", "fail", "fields"]);
	const fields = readOperationFields("telemetry", "span", value.fields);
	const name = textInput(fields["span.name"] ?? value.name, "name", "workbench.operation");
	if (value.fail !== undefined && typeof value.fail !== "boolean")
		throw new ProtocolValidationError("fail", "Expected boolean");
	const adapter = fields["workbench.adapter"] ?? "InMemoryTelemetryContext";
	if (adapter !== "InMemoryTelemetryContext" && adapter !== "NOOP_TELEMETRY_CONTEXT")
		throw new ProtocolValidationError("workbench.adapter", "External adapter requires authorized host setup");
	const memory = new InMemoryTelemetryContext();
	const telemetry = adapter === "NOOP_TELEMETRY_CONTEXT" ? NOOP_TELEMETRY_CONTEXT : memory;
	const attributes = fieldObject(fields["span.attributes"], "span.attributes", {
		source: "workbench",
		local: true,
	}) as SpanAttributes;
	const event = inputObject(fields["workbench.event"] ?? { name: "operation.started", attributes: { valid: true } }, [
		"name",
		"attributes",
	]);
	const eventAttributes = fieldObject(event.attributes, "event.attributes");
	for (const attribute of Object.values(eventAttributes))
		if (
			attribute === null ||
			(typeof attribute === "object" &&
				(!Array.isArray(attribute) || attribute.some((item) => !["string", "number", "boolean"].includes(typeof item))))
		)
			throw new ProtocolValidationError("event.attributes", "Expected primitive attributes");
	await telemetry.startSpan({ name, attributes }, async (span) => {
		span.addEvent(textInput(event.name, "event.name"), eventAttributes as SpanAttributes);
		await span.startSpan({ name: `${name}.child` }, () => 1);
		if (value.fail || fields["status.status"] === "error")
			span.setStatus({
				status: "error",
				error: { name: "RequestedDiagnostic", message: "Explicit diagnostic failure" },
			});
	});
	return wireResult({ spans: memory.getSpans(), adapter, exporter: null, persisted: false });
}

export function telemetrySchema(input: unknown): JsonValue {
	const value = inputObject(input, ["fields"]);
	const fields = readOperationFields("telemetry", "schema", value.fields);
	const schema = {
		version: numberInput(fields["schema.version"], "schema.version", 1, 1, 1000),
		spans: fieldObject(fields["schema.spans"], "schema.spans"),
	};
	return wireResult({
		schema: defineTelemetrySchema(schema as unknown as TelemetrySchemaDefinition),
		runtimeValidation: false,
		meaning: "Typed schema metadata only; does not enforce span names or attributes at runtime",
	});
}

export function inspectTerminalText(input: unknown): JsonValue {
	const value = inputObject(input, ["text", "width"]);
	const text = textInput(value.text, "text", "Pi 工作台");
	const width = numberInput(value.width, "width", 20, 1, 300);
	return wireResult({
		visibleWidth: visibleWidth(text),
		stripped: stripTerminalSequences(text),
		truncated: truncateToWidth(text, width),
		wrapped: wrapTextWithAnsi(text, width),
		units: "terminal-cells",
		interactiveTerminal: false,
		themeCompatibility: "ANSI text processing only; browser CSS and interactive TUI components are not interchangeable",
	});
}
