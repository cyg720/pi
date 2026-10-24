import {
	type CodemodeDeclaredTool,
	type CodemodeJsonSchema,
	CodemodeSandbox,
	InlineCodemodeSandbox,
	loadQuickJSWasm,
	renderDeclarations,
} from "@earendil-works/pi-codemode";
import { type JsonValue, ProtocolValidationError } from "@pi-workbench/protocol";
import { inputObject, numberInput, textInput, wireResult } from "./common.ts";
import { fieldObject, readOperationFields } from "./fields.ts";

export async function executeCode(input: unknown): Promise<JsonValue> {
	const value = inputObject(input, ["code", "store", "fields"]);
	const fields = readOperationFields("codemode", "execute", value.fields);
	const code = textInput(
		fields["workbench.source"] ?? value.code,
		"code",
		'const value = await tools.echo({text:"local"}); store("last", value); text(value);',
	);
	if (fields["executeOptions.store"] !== undefined) value.store = fields["executeOptions.store"];
	else if (value.store === undefined) value.store = {};
	if (value.store !== undefined && (!value.store || typeof value.store !== "object" || Array.isArray(value.store)))
		throw new ProtocolValidationError("store", "Expected object");
	const store = value.store === undefined ? {} : inputObject(value.store, Object.keys(value.store));
	const declaration =
		fields["workbench.toolSchema"] === undefined
			? undefined
			: inputObject(fields["workbench.toolSchema"], ["name", "description", "inputSchema", "outputSchema"]);
	const toolName = declaration ? textInput(declaration.name, "toolSchema.name") : "echo";
	if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(toolName))
		throw new ProtocolValidationError("toolSchema.name", "Expected simple tool identifier");
	const tools = [
		{
			name: toolName,
			description: declaration
				? textInput(declaration.description, "toolSchema.description", "Local JSON echo")
				: "Bounded local echo; no host IO",
			inputSchema: declaration
				? (fieldObject(declaration.inputSchema, "toolSchema.inputSchema") as CodemodeJsonSchema)
				: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
			...(declaration?.outputSchema === undefined
				? {}
				: { outputSchema: fieldObject(declaration.outputSchema, "toolSchema.outputSchema") as CodemodeJsonSchema }),
			execute: async (args: unknown) => {
				if (declaration) return fieldObject(wireResult(args), "tool.arguments");
				const parsed = inputObject(args, ["text"]);
				return { text: textInput(parsed.text, "echo.text") };
			},
		},
	];
	const runtime = fields["workbench.runtime"] ?? "Node/Bun worker";
	if (runtime !== "Node/Bun worker" && runtime !== "Portable inline")
		throw new ProtocolValidationError(
			"workbench.runtime",
			"Cloudflare remote requires separately configured authorized transport",
		);
	const Constructor = runtime === "Portable inline" ? InlineCodemodeSandbox : CodemodeSandbox;
	const sandbox = new Constructor({
		wasm: loadQuickJSWasm(),
		interruptBudget: 1000,
		timeoutMs: numberInput(fields["sandbox.timeoutMs"], "sandbox.timeoutMs", 2000, 1, 5000),
		memoryLimitBytes: numberInput(
			fields["sandbox.memoryLimitBytes"],
			"sandbox.memoryLimitBytes",
			16 * 1024 * 1024,
			1_048_576,
			67_108_864,
		),
		tools,
	});
	try {
		const result = await sandbox.execute(code, { store });
		return wireResult(
			result.ok
				? {
						...result,
						isolation: runtime === "Portable inline" ? "QuickJS WASM inline" : "QuickJS WASM worker",
						hostCapabilities: [toolName],
						declarations: renderDeclarations({ tools }),
						schemaEnforced: false,
					}
				: {
						ok: false,
						output: result.output,
						calls: result.calls,
						error: { kind: result.error.kind, message: result.error.message },
						storeWrites: { set: {}, delete: [] },
					},
		);
	} finally {
		await sandbox.close();
	}
}

export async function replayCode(input: unknown): Promise<JsonValue> {
	const value = inputObject(input, ["fields"]);
	const fields = readOperationFields("codemode", "replay", value.fields);
	const startedAt = numberInput(fields["run.startedAt"], "run.startedAt", 0, 0, Number.MAX_SAFE_INTEGER - 50);
	const seed = numberInput(fields["run.seed"], "run.seed", 42, 0, 4294967295);
	const raw = fields["run.tools"] ?? [{ name: "lookup", jsName: "lookup", description: "Local lookup" }];
	if (!Array.isArray(raw) || raw.length < 1 || raw.length > 10)
		throw new ProtocolValidationError("run.tools", "Expected 1..10 declarations");
	const tools: CodemodeDeclaredTool[] = raw.map((item) => {
		const declared = inputObject(item, ["name", "jsName", "description"]);
		const name = textInput(declared.name, "name");
		const jsName = textInput(declared.jsName, "jsName");
		if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(jsName))
			throw new ProtocolValidationError("jsName", "Expected simple identifier");
		return { name, jsName, description: textInput(declared.description, "description", "") };
	});
	if (new Set(tools.map((tool) => tool.jsName)).size !== tools.length)
		throw new ProtocolValidationError("run.tools", "Duplicate alias");
	const sandbox = new CodemodeSandbox({ timeoutMs: 2000, memoryLimitBytes: 16_777_216, tools: [] });
	const calls: JsonValue[] = [];
	try {
		const source = `const before=Date.now();const random=[Math.random(),Math.random()];const answer=await tools[${JSON.stringify(tools[0].jsName)}]({local:true});return {before,random,answer,after:Date.now(),catalog:ALL_TOOLS};`;
		const running = sandbox.start(source, {
			startedAt,
			seed,
			tools,
			timeoutMs: 2000,
			onCall(call) {
				calls.push(wireResult(call));
				running.deliver(calls.length, startedAt + 50, call.id, { ok: true, value: { toolName: call.name } });
			},
		});
		const result = await running.result;
		return wireResult({ ...result, hostCalls: calls, externalRequests: 0 });
	} finally {
		await sandbox.close();
	}
}
