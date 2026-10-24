import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import { HttpError, identifier } from "./errors.ts";
import { atomicWrite, SerialQueue, safePath } from "./storage.ts";

export const MAX_FILE_BYTES = 1024 * 1024;
export function etag(content: string): string {
	return `"${createHash("sha256").update(content).digest("hex")}"`;
}
export class WorkspaceFiles {
	private readonly root: string;
	private readonly queue = new SerialQueue();
	constructor(root: string) {
		this.root = root;
	}
	private async rootFor(id: string): Promise<string> {
		return safePath(this.root, `workspaces/${identifier(id)}`);
	}
	async read(id: string, path: string): Promise<unknown> {
		const target = await safePath(await this.rootFor(id), path);
		const info = await stat(target);
		if (info.isDirectory()) {
			const entries = await readdir(target, { withFileTypes: true });
			const visible = entries.filter((entry) => entry.isDirectory() || entry.isFile());
			return {
				workspaceId: id,
				path,
				truncated: visible.length > 2000,
				entries: visible.slice(0, 2000).map((entry) => ({
					path: path ? `${path}/${entry.name}` : entry.name,
					name: entry.name,
					kind: entry.isDirectory() ? "directory" : "file",
				})),
			};
		}
		if (!info.isFile() || info.size > MAX_FILE_BYTES)
			throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Only regular files up to 1 MiB can be read");
		if (info.nlink !== 1) throw new HttpError(403, "FORBIDDEN", "Hard-linked files are not allowed");
		const content = await readFile(target, "utf8");
		if (content.includes("\0")) throw new HttpError(415, "UNSUPPORTED", "Binary files cannot be edited as text");
		return { workspaceId: id, path, content, encoding: "utf-8", etag: etag(content), size: info.size };
	}
	async search(id: string, query: string): Promise<unknown> {
		if (!query.trim() || query.length > 200)
			throw new HttpError(400, "INVALID_REQUEST", "Search query must contain 1–200 characters");
		const root = await this.rootFor(id);
		const entries: { path: string; name: string; kind: "file" | "directory" }[] = [];
		const pending = [""];
		let visited = 0;
		while (pending.length && visited < 10000 && entries.length < 1000) {
			const directory = pending.pop();
			if (directory === undefined) break;
			for (const entry of await readdir(await safePath(root, directory), { withFileTypes: true })) {
				if (++visited > 10000 || entries.length >= 1000) break;
				if (!entry.isDirectory() && !entry.isFile()) continue;
				const path = directory ? `${directory}/${entry.name}` : entry.name;
				if (entry.isDirectory()) pending.push(path);
				if (path.toLowerCase().includes(query.toLowerCase()))
					entries.push({ path, name: entry.name, kind: entry.isDirectory() ? "directory" : "file" });
			}
		}
		return {
			workspaceId: id,
			query,
			entries,
			truncated: pending.length > 0 || visited >= 10000 || entries.length >= 1000,
		};
	}
	async mkdir(id: string, path: string): Promise<unknown> {
		return this.queue.run(async () => {
			if (!path) throw new HttpError(400, "INVALID_REQUEST", "Directory path is required");
			const target = await safePath(await this.rootFor(id), path, true);
			try {
				await mkdir(target, { mode: 0o700 });
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code === "EEXIST")
					throw new HttpError(409, "CONFLICT", "Path already exists");
				throw error;
			}
			return { workspaceId: id, path, kind: "directory" };
		});
	}
	async write(id: string, path: string, content: string, expected: string): Promise<unknown> {
		return this.queue.run(async () => {
			if (!path || Buffer.byteLength(content) > MAX_FILE_BYTES)
				throw new HttpError(400, "INVALID_REQUEST", "Invalid file or oversized content");
			const target = await safePath(await this.rootFor(id), path, true);
			let current: string | null = null;
			try {
				const currentInfo = await stat(target);
				if (!currentInfo.isFile() || currentInfo.size > MAX_FILE_BYTES)
					throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Only regular files up to 1 MiB can be edited");
				if (currentInfo.nlink !== 1) throw new HttpError(403, "FORBIDDEN", "Hard-linked files are not allowed");
				current = await readFile(target, "utf8");
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
			}
			if (expected !== (current === null ? "*" : etag(current)))
				throw new HttpError(409, "CONFLICT", "File changed; reload before saving");
			await atomicWrite(target, content);
			return { workspaceId: id, path, etag: etag(content), size: Buffer.byteLength(content) };
		});
	}
}
