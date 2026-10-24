import type { IncomingMessage, ServerResponse } from "node:http";
import type { WorkbenchSettingsPatch } from "@pi-workbench/runtime-adapter";
import { authorizeWorkspace, type Principal } from "./auth.ts";
import { HttpError, identifier, object } from "./errors.ts";
import { body, json } from "./http.ts";
import type { NativeSettingsStore } from "./native-settings.ts";

export async function nativeSettingsRoute(
	request: IncomingMessage,
	response: ServerResponse,
	url: URL,
	principal: Principal,
	settings: NativeSettingsStore,
) {
	const input =
		request.method === "PUT"
			? object(await body(request), ["scope", "workspaceId", "revision", "values"])
			: Object.fromEntries(url.searchParams);
	if (request.method !== "GET" && request.method !== "PUT") throw new HttpError(404, "NOT_FOUND", "Route not found");
	object(input, request.method === "GET" ? ["scope", "workspaceId"] : ["scope", "workspaceId", "revision", "values"]);
	if (input.scope !== "global" && input.scope !== "project")
		throw new HttpError(400, "INVALID_REQUEST", "Invalid native scope");
	if (typeof input.workspaceId !== "string") throw new HttpError(400, "INVALID_REQUEST", "Workspace is required");
	const workspaceId = identifier(input.workspaceId);
	authorizeWorkspace(principal, workspaceId);
	let patch: { revision: string; values: WorkbenchSettingsPatch } | undefined;
	if (request.method === "PUT") {
		if (typeof input.revision !== "string") throw new HttpError(400, "INVALID_REQUEST", "Revision is required");
		patch = {
			revision: input.revision,
			values: object(input.values, [
				"defaultProvider",
				"defaultModel",
				"defaultThinkingLevel",
				"defaultTools",
				"codemode",
			]) as WorkbenchSettingsPatch,
		};
	}
	json(response, 200, await settings.access(principal.id, workspaceId, input.scope, patch));
}
