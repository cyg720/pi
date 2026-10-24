import { appendFile } from "node:fs/promises";
import { SerialQueue, safePath } from "./storage.ts";

/** Deliberately excludes bodies, query strings, identifiers, headers and error text. */
export class AuditLog {
	private readonly root: string;
	private readonly queue = new SerialQueue();
	private failed = false;
	constructor(root: string) {
		this.root = root;
	}
	get healthy(): boolean {
		return !this.failed;
	}
	record(method: string, status: number): void {
		void this.queue
			.run(async () => {
				const path = await safePath(this.root, "audit.jsonl", true);
				await appendFile(path, `${JSON.stringify({ timestamp: new Date().toISOString(), method, status })}\n`, {
					mode: 0o600,
				});
			})
			.catch(() => {
				this.failed = true;
			});
	}
	async drain(): Promise<void> {
		await this.queue.run(async () => {});
	}
}
