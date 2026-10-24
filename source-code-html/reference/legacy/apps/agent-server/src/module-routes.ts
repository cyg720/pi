import type { IncomingMessage, ServerResponse } from "node:http";
import {
	type ConfigEffectiveness,
	type JsonObject,
	type JsonValue,
	parseConfigPatchRequest,
} from "@pi-workbench/protocol";
import type { ConfiguredLocalModelOptions } from "@pi-workbench/runtime-adapter";
import { authorizeWorkspace, type Principal } from "./auth.ts";
import type { ConfigRevisionSource, ConfigStore } from "./config.ts";
import { HttpError, object } from "./errors.ts";
import { body, json } from "./http.ts";
import type { DurableCodingToolsHost } from "./modules/durable-coding-tools.ts";
import type { EnvDaemonHost } from "./modules/env-live.ts";
import type { DockerEvalsHost } from "./modules/evals-live.ts";
import {
	executeModule,
	getFieldEffectivenessRegistry,
	getModuleCapabilities,
	selectOperationFields,
} from "./modules/index.ts";
import type { OperationGate } from "./operation-gate.ts";
import { listWorkspaces, type SessionStore } from "./sessions.ts";
import { safePath } from "./storage.ts";

export async function moduleRoute(
	request: IncomingMessage,
	response: ServerResponse,
	moduleId: string,
	operation: string,
	context: {
		root: string;
		principal: Principal;
		sessions: SessionStore;
		config: ConfigStore;
		operations: OperationGate;
		configuredModel?: ConfiguredLocalModelOptions;
		allowedTools?: readonly string[];
		durableCodingTools?: DurableCodingToolsHost;
		envDaemon?: EnvDaemonHost;
		dockerEvals?: DockerEvalsHost;
	},
): Promise<void> {
	moduleId = moduleId === "agent-core" ? "agent" : moduleId;
	if (
		!getModuleCapabilities().some(
			(capability) => capability.moduleId === moduleId && capability.operation === operation,
		)
	)
		throw new HttpError(501, "UNSUPPORTED", "Module execution is not available");
	const input = object(await body(request), ["input", "workspaceId", "config"]);
	if (input.workspaceId !== undefined && typeof input.workspaceId !== "string")
		throw new HttpError(400, "INVALID_REQUEST", "Invalid workspace identifier");
	const available = (await listWorkspaces(context.root)).filter(
		(workspace) => context.principal.workspaceIds === "all" || context.principal.workspaceIds.includes(workspace.id),
	);
	const workspaceId = input.workspaceId ?? available[0]?.id;
	if (typeof workspaceId !== "string")
		throw new HttpError(400, "INVALID_REQUEST", "An authorized workspace is required");
	authorizeWorkspace(context.principal, workspaceId);
	const workspaceRoot = await safePath(context.root, `workspaces/${workspaceId}`);
	let operationInput: unknown = input.input ?? {};
	let saved: ReturnType<typeof parseConfigPatchRequest> | undefined;
	let selected: JsonObject = {};
	let resolvedMode = false;
	let revisionVector: ConfigRevisionSource[] | undefined;
	let sources: Record<string, ConfigRevisionSource> = {};
	if (input.config !== undefined) {
		const reference = object(input.config, ["scope", "moduleId", "revision", "mode", "revisionVector"]);
		if (reference.mode !== undefined && reference.mode !== "resolved" && reference.mode !== "scope")
			throw new HttpError(400, "INVALID_REQUEST", "Unknown configuration execution mode");
		resolvedMode = reference.mode === "resolved";
		if (!resolvedMode && reference.revisionVector !== undefined)
			throw new HttpError(400, "INVALID_REQUEST", "Revision vector requires resolved mode");
		saved = parseConfigPatchRequest({
			scope: reference.scope,
			moduleId: reference.moduleId,
			revision: reference.revision,
			values: {},
		});
		const selectedConfig = saved;
		if ((saved.moduleId === "agent-core" ? "agent" : saved.moduleId) !== moduleId)
			throw new HttpError(400, "INVALID_REQUEST", "Configuration module must match the operation");
		if (saved.scope.kind === "workspace" && saved.scope.id !== workspaceId)
			throw new HttpError(403, "FORBIDDEN", "Configuration workspace does not match the operation");
		if (saved.scope.kind === "session") {
			const session = context.sessions.get(saved.scope.id);
			if (session.ownerId !== context.principal.id || session.workspaceId !== workspaceId)
				throw new HttpError(403, "FORBIDDEN", "Configuration session is not authorized for this workspace");
		}
		const record = (await context.config.get(saved.scope)).modules[saved.moduleId];
		if ((record?.revision ?? 0) !== saved.revision || (!resolvedMode && !record))
			throw new HttpError(409, "CONFLICT", "Saved configuration revision changed; reload before execution");
		const args = object(
			operationInput,
			operationInput && typeof operationInput === "object" ? Object.keys(operationInput) : [],
		);
		if (Object.hasOwn(args, "fields"))
			throw new HttpError(400, "INVALID_REQUEST", "Cannot override fields while executing saved configuration");
		if (resolvedMode) {
			if (
				!Array.isArray(reference.revisionVector) ||
				reference.revisionVector.length < 1 ||
				reference.revisionVector.length > 3
			)
				throw new HttpError(400, "INVALID_REQUEST", "Resolved execution requires a complete revision vector");
			const expected = reference.revisionVector.map((entry) => {
				const source = object(entry, ["scope", "revision"]);
				const parsed = parseConfigPatchRequest({ ...source, moduleId: selectedConfig.moduleId, values: {} });
				return { scope: parsed.scope, revision: parsed.revision };
			});
			const resolved = await context.config.resolved(saved.scope, saved.moduleId, workspaceId, expected);
			revisionVector = resolved.revisionVector;
			sources = resolved.sources;
			selected = selectOperationFields(moduleId, operation, resolved.resolvedValues as JsonObject);
		} else {
			selected = selectOperationFields(moduleId, operation, (record?.values ?? {}) as JsonObject);
			sources = Object.fromEntries(
				Object.keys(selected).map((key) => [key, { scope: selectedConfig.scope, revision: selectedConfig.revision }]),
			);
		}
		if (!Object.keys(selected).length)
			throw new HttpError(400, "UNSUPPORTED", "Saved configuration has no fields supported by this operation");
		operationInput = { ...args, fields: selected };
	}
	const controller = new AbortController();
	const disconnect = () => {
		if (!response.writableEnded) controller.abort();
	};
	response.once("close", disconnect);
	let result: JsonValue;
	try {
		result = await context.operations.run(() =>
			executeModule(moduleId, operation, operationInput, {
				workspaceRoot,
				dataDirectory: context.root,
				configuredModel: context.configuredModel,
				allowedTools: context.allowedTools,
				durableCodingTools: context.durableCodingTools,
				envDaemon: context.envDaemon,
				dockerEvals: context.dockerEvals,
				principalId: context.principal.id,
				signal: controller.signal,
			}),
		);
	} finally {
		response.off("close", disconnect);
	}
	if (!saved) {
		json(response, 200, result);
		return;
	}
	const record = result !== null && typeof result === "object" && !Array.isArray(result) ? result : {};
	const effective =
		record.effectiveValues !== null &&
		typeof record.effectiveValues === "object" &&
		!Array.isArray(record.effectiveValues)
			? (record.effectiveValues as JsonObject)
			: {};
	const applied = Array.isArray(record.appliedFields)
		? record.appliedFields.filter(
				(key): key is string =>
					typeof key === "string" && Object.hasOwn(selected, key) && Object.hasOwn(effective, key),
			)
		: [];
	const registry = getFieldEffectivenessRegistry();
	const timestamp = new Date().toISOString();
	const receipts: Record<string, ConfigEffectiveness> = {};
	for (const key of applied) {
		const binding = registry.find(
			(field) =>
				field.moduleId === moduleId &&
				field.key === key &&
				(field.operation === operation ||
					(moduleId === "ai" && operation === "generate") ||
					(moduleId === "agent" && operation === "live-run") ||
					(moduleId === "durable" && operation === "live-run") ||
					(moduleId === "env" && operation === "live-runtime") ||
					(moduleId === "evals" && operation.startsWith("live-"))),
		);
		if (!binding || (binding.support !== "local-runtime" && binding.support !== "sdk-boundary")) continue;
		receipts[key] = {
			status: "applied",
			effectiveValue: effective[key],
			effectiveRevision: saved.revision,
			appliedAt: timestamp,
			reason:
				record.validationLevel === "live-evaluation-response"
					? `${moduleId}/${operation}: measured by the native Docker evaluator for these cases only`
					: record.validationLevel === "live-daemon-response"
						? `${moduleId}/${operation}: observed on this real daemon operation only; not SSH or Windows native PTY verification`
						: record.validationLevel === "live-provider-response"
							? `${moduleId}/${operation}: observed in this real provider response only; not a general quality, sampling or future-session guarantee`
							: `${moduleId}/${operation}: ${binding.support}; verified only for this explicit operation, not future sessions or an external provider`,
		};
	}
	const stored = revisionVector
		? await context.config.recordResolvedReceipt(saved.moduleId, revisionVector, sources, receipts)
		: await context.config.recordReceipt(saved.scope, saved.moduleId, saved.revision, receipts);
	json(response, 200, {
		...record,
		savedConfigApplied: stored && Object.keys(receipts).length > 0,
		savedConfigReceipt: {
			stored,
			scope: saved.scope,
			moduleId: saved.moduleId,
			revision: saved.revision,
			mode: resolvedMode ? "resolved" : "scope",
			...(revisionVector ? { revisionVector } : {}),
			operation,
			usedValues: selected,
			sources: Object.fromEntries(Object.keys(selected).map((key) => [key, sources[key]])),
			verifiedFields: Object.keys(receipts),
			validationLevel: record.validationLevel ?? "local-operation-only",
			effectTiming: "explicit-operation-only",
			...(stored
				? {}
				: { warning: "Configuration changed during execution; result is valid but no stale receipt was stored" }),
		},
	});
}
