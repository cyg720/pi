import type { MessageSnapshot, RunEvent, RunStatus } from "./types.ts";

export function isTerminalRunStatus(status: RunStatus): boolean {
	return status === "completed" || status === "failed" || status === "aborted";
}
export function canTransitionRunStatus(from: RunStatus, to: RunStatus): boolean {
	if (from === to) return true;
	if (from === "idle") return to === "running";
	if (from === "running") return to === "cancelling" || isTerminalRunStatus(to);
	if (from === "cancelling") return isTerminalRunStatus(to);
	return false;
}

/** afterSeq is the last applied sequence. Gaps require an authoritative snapshot. */
export function classifyEventSequence(lastSeq: number, nextSeq: number): "duplicate" | "next" | "gap" {
	if (!Number.isSafeInteger(lastSeq) || lastSeq < 0 || !Number.isSafeInteger(nextSeq) || nextSeq < 1)
		throw new RangeError("Invalid event sequence");
	return nextSeq <= lastSeq ? "duplicate" : nextSeq === lastSeq + 1 ? "next" : "gap";
}

/** Apply only after session/run and sequence checks. message_end replaces all partial content. */
export function applyMessageEvent(messages: readonly MessageSnapshot[], event: RunEvent): MessageSnapshot[] {
	if (event.type === "message_end") {
		const message = event.payload.message;
		const index = messages.findIndex((item) => item.id === message.id);
		return index === -1 ? [...messages, message] : messages.map((item, i) => (i === index ? message : item));
	}
	if (event.type !== "text" && event.type !== "thinking") return [...messages];
	const type = event.type;
	const { messageId, delta } = event.payload;
	const existing = messages.find((item) => item.id === messageId);
	const message: MessageSnapshot = existing ?? { id: messageId, role: "assistant", content: [] };
	const content = message.content.map((part) => ({ ...part }));
	const last = content.at(-1);
	if (last?.type === type) last.text += delta;
	else content.push({ type, text: delta });
	const updated = { ...message, content };
	return existing ? messages.map((item) => (item.id === messageId ? updated : item)) : [...messages, updated];
}
