import type { SqliteDatabase } from "../types.ts";
import { invalidSession } from "./shared.ts";

/**
 * 【文件职责】会话序号：会话条目的递增序号管理。
 * 【新手阅读建议】看序号分配。
 */
export async function getNextSequence(db: SqliteDatabase, sessionId: string): Promise<number> {
	const sequenceRow = await db
		.prepare("SELECT next_seq FROM session_sequences WHERE session_id = ?")
		.get<{ next_seq: number }>(sessionId);
	if (!sequenceRow) {
		throw invalidSession(`missing sequence row for session ${sessionId}`);
	}
	return sequenceRow.next_seq;
}

export async function advanceSequence(db: SqliteDatabase, sessionId: string, nextSeq: number): Promise<void> {
	await db.prepare("UPDATE session_sequences SET next_seq = ? WHERE session_id = ?").run(nextSeq + 1, sessionId);
}
