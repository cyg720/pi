import type { IncomingMessage, ServerResponse } from "node:http";
import type { RunEvent } from "@pi-workbench/protocol";
import { HttpError } from "./errors.ts";
import type { SessionStore } from "./sessions.ts";

export class EventStreams {
	private readonly clients = new Map<string, Set<ServerResponse>>();
	publish(event: RunEvent): void {
		for (const response of this.clients.get(event.sessionId) ?? []) this.write(response, event);
	}
	private write(response: ServerResponse, event: RunEvent): void {
		if (response.writableLength > 1024 * 1024) {
			response.destroy();
			return;
		}
		response.write(`id: ${event.seq}\nevent: run\ndata: ${JSON.stringify(event)}\n\n`);
	}
	connect(
		id: string,
		request: IncomingMessage,
		response: ServerResponse,
		sessions: SessionStore,
		afterValue: string | null,
	): void {
		const value = request.headers["last-event-id"] ?? afterValue ?? "0";
		if (typeof value !== "string" || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))
			throw new HttpError(400, "INVALID_REQUEST", "Invalid replay sequence");
		const after = Number(value);
		const session = sessions.get(id);
		if (after > session.seq) throw new HttpError(409, "REPLAY_UNAVAILABLE", "Replay sequence is ahead of this session");
		response.writeHead(200, {
			"content-type": "text/event-stream",
			"cache-control": "no-cache, no-transform",
			connection: "keep-alive",
			"x-accel-buffering": "no",
			"x-content-type-options": "nosniff",
		});
		response.write(": connected\n\n");
		const clients = this.clients.get(id) ?? new Set<ServerResponse>();
		this.clients.set(id, clients);
		clients.add(response);
		for (const event of sessions.events(id, after)) this.write(response, event);
		const heartbeat = setInterval(() => response.write(": heartbeat\n\n"), 15000);
		response.once("close", () => {
			clearInterval(heartbeat);
			clients.delete(response);
			if (!clients.size) this.clients.delete(id);
		});
	}
	close(): void {
		for (const clients of this.clients.values()) for (const response of clients) response.end();
		this.clients.clear();
	}
}
