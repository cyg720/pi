import { relative, resolve } from "node:path";
import type { RuntimeSnapshot } from "@pi-workbench/runtime-adapter";
import { HttpError } from "./errors.ts";
import { normalizeMessage } from "./runtime-events.ts";
import { type SessionStore, summarizeSession } from "./sessions.ts";
import { safePath } from "./storage.ts";
import type { WorkerManager } from "./workers.ts";

/** Holds the parent lease through native fork, file copy, publication and worker retirement. */
export async function forkSession(
	root: string,
	id: string,
	args: Record<string, unknown>,
	workers: WorkerManager,
	sessions: SessionStore,
): Promise<unknown> {
	return workers.exclusive(id, async (lease) => {
		try {
			const result = await lease.command<{ cancelled: boolean; snapshot: RuntimeSnapshot }>("fork", args);
			if (result.cancelled) return { cancelled: true };
			if (!result.snapshot.sessionFile)
				throw new HttpError(500, "INTERNAL_ERROR", "Fork did not produce a persisted session");
			const directory = resolve(root, "sessions", id, "runtime");
			const source = await safePath(directory, relative(directory, result.snapshot.sessionFile));
			const forked = await sessions.publishFork(id, source, result.snapshot.messages.map(normalizeMessage));
			return { cancelled: false, session: summarizeSession(forked) };
		} finally {
			await lease.release();
		}
	});
}
