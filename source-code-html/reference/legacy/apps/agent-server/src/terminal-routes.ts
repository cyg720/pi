import type { IncomingMessage, ServerResponse } from "node:http";
import { HttpError, object } from "./errors.ts";
import { body, json } from "./http.ts";
import { SerialQueue, safePath } from "./storage.ts";
import { TerminalError, type TerminalManager } from "./terminal/index.ts";

const creations = new SerialQueue();
export async function terminalRoute(
	request: IncomingMessage,
	response: ServerResponse,
	manager: TerminalManager,
	root: string,
	sessionId: string,
	workspaceId: string,
	action?: string,
): Promise<void> {
	try {
		const current = manager.list(sessionId).at(-1);
		if (!action && request.method === "GET") {
			json(response, 200, current ?? null);
			return;
		}
		if (!action && request.method === "POST") {
			const dimensions = object(await body(request), ["cols", "rows"]);
			if (
				(dimensions.cols !== undefined && typeof dimensions.cols !== "number") ||
				(dimensions.rows !== undefined && typeof dimensions.rows !== "number")
			)
				throw new HttpError(400, "INVALID_REQUEST", "Invalid terminal dimensions");
			const result = await creations.run(async () => {
				const existing = manager
					.list(sessionId)
					.find((terminal) => terminal.status === "running" || terminal.status === "starting");
				return (
					existing ??
					manager.create(
						sessionId,
						await safePath(root, `workspaces/${workspaceId}`),
						dimensions as { cols?: number; rows?: number },
					)
				);
			});
			json(response, 201, result);
			return;
		}
		if (!current) throw new HttpError(404, "NOT_FOUND", "No terminal has been created for this session");
		if (!action && request.method === "DELETE") {
			json(response, 200, await manager.close(sessionId, current.id));
			return;
		}
		if (action === "input" && request.method === "POST") {
			const input = object(await body(request), ["data"]);
			if (typeof input.data !== "string") throw new HttpError(400, "INVALID_REQUEST", "Terminal input must be text");
			await manager.write(sessionId, current.id, input.data);
			json(response, 200, { accepted: true });
			return;
		}
		if (action === "resize" && request.method === "POST") {
			const dimensions = object(await body(request), ["cols", "rows"]);
			if (typeof dimensions.cols !== "number" || typeof dimensions.rows !== "number")
				throw new HttpError(400, "INVALID_REQUEST", "Terminal dimensions must be numbers");
			json(response, 200, await manager.resize(sessionId, current.id, dimensions.cols, dimensions.rows));
			return;
		}
		throw new HttpError(404, "NOT_FOUND", "Terminal route not found");
	} catch (error) {
		if (error instanceof TerminalError)
			throw new HttpError(
				error.statusCode,
				error.statusCode === 403 ? "FORBIDDEN" : error.statusCode >= 500 ? "UNAVAILABLE" : "INVALID_REQUEST",
				error.message,
			);
		throw error;
	}
}
