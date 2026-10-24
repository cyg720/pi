import { createHash } from "node:crypto";
import { readdir, readFile, rename } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { HttpError, identifier, object } from "./errors.ts";
import { atomicWrite, safePath } from "./storage.ts";

export function durableNamespace(principalId: string, workspaceRoot: string): string {
	return createHash("sha256").update(`${principalId}\0${workspaceRoot}`).digest("hex");
}

function namespaceIdentity(value: unknown): { version: 1; principalId: string; workspaceId: string } {
	const record = object(value, ["version", "principalId", "workspaceId"]);
	if (record.version !== 1 || typeof record.principalId !== "string" || typeof record.workspaceId !== "string")
		throw new Error("Invalid Durable namespace identity");
	return { version: 1, principalId: identifier(record.principalId), workspaceId: identifier(record.workspaceId) };
}

/** Written only by an authorized run/resume, never by inspection or browser-supplied metadata. */
export async function recordDurableNamespace(
	directory: string,
	principalId: string,
	workspaceRoot: string,
	dataRoot: string,
): Promise<void> {
	const workspaceId = identifier(basename(workspaceRoot));
	if (resolve(dataRoot, "workspaces", workspaceId) !== resolve(workspaceRoot))
		throw new Error("Durable workspace is outside the host data root");
	const expected = namespaceIdentity({ version: 1, principalId, workspaceId });
	const path = await safePath(directory, "namespace.json", true);
	try {
		const actual = namespaceIdentity(JSON.parse(await readFile(path, "utf8")));
		if (actual.principalId !== expected.principalId || actual.workspaceId !== expected.workspaceId)
			throw new HttpError(409, "CONFLICT", "Durable namespace identity does not match its owner");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		await atomicWrite(path, JSON.stringify(expected));
	}
}

/** Called only on the restore staging copy, under the existing offline backup lock. */
export async function relocateDurableNamespaces(
	staging: string,
	original: string,
	destination: string,
): Promise<number> {
	let directory: string;
	try {
		directory = await safePath(staging, "durable-live");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
		throw error;
	}
	const moves: { from: string; to: string }[] = [];
	for (const name of await readdir(directory)) {
		if (!/^[a-f0-9]{64}$/.test(name)) throw new Error("Invalid Durable namespace directory");
		const from = await safePath(directory, name);
		if ((await readdir(from)).length === 0) continue;
		let identity: ReturnType<typeof namespaceIdentity>;
		try {
			identity = namespaceIdentity(JSON.parse(await readFile(await safePath(from, "namespace.json"), "utf8")));
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT")
				throw new Error("Durable namespace identity is missing; run or resume it in the original host before backup");
			throw error;
		}
		await safePath(staging, `workspaces/${identity.workspaceId}`);
		if (name !== durableNamespace(identity.principalId, resolve(original, "workspaces", identity.workspaceId)))
			throw new Error("Durable namespace identity does not match the original workspace");
		moves.push({
			from,
			to: resolve(
				directory,
				durableNamespace(identity.principalId, resolve(destination, "workspaces", identity.workspaceId)),
			),
		});
	}
	for (const move of moves) await rename(move.from, move.to);
	return moves.length;
}
