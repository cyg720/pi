import type { SessionTreeEntry } from "@earendil-works/pi-agent-core";
import { SessionError } from "@earendil-works/pi-agent-core";
import { uuidv7 } from "@earendil-works/pi-ai";

/**
 * 【文件职责】存储共享：SQLite 查询/事务等公共辅助。
 * 【新手阅读建议】看辅助函数。
 */
export function generateEntryId(byId: { has(id: string): boolean }): string {
	for (let i = 0; i < 100; i++) {
		// The uuidv7 prefix is timestamp-derived and nearly constant between calls,
		// so short ids must come from the random tail.
		const id = uuidv7().slice(0, 8);
		if (!byId.has(id)) return id;
	}
	return uuidv7();
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export function invalidSession(message: string, cause?: Error): SessionError {
	return new SessionError("invalid_session", `Invalid SQLite session: ${message}`, cause);
}

export function invalidEntry(message: string, cause?: Error): SessionError {
	return new SessionError("invalid_entry", `Invalid SQLite session entry: ${message}`, cause);
}

export function leafIdAfterEntry(entry: SessionTreeEntry): string | null {
	return entry.type === "leaf" ? entry.targetId : entry.id;
}
