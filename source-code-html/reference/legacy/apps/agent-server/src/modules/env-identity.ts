import { randomUUID } from "node:crypto";
import type { Context } from "@earendil-works/chord";
import { getOrThrow } from "@earendil-works/pi-durable/env";
import { withFileMutationQueue } from "@earendil-works/pi-durable/tools";
import { RemoteExecutionEnv } from "@earendil-works/pi-env";
import type { EnvDaemonHost } from "./env-live.ts";

/** Measure the existing mutation queue against real daemon files, without injected responses or delays. */
export async function verifyEnvIdentity(env: RemoteExecutionEnv, host: EnvDaemonHost, context: Context) {
	const owned = host.create();
	const stop = () => owned.connection.close();
	context.abortSignal?.addEventListener("abort", stop, { once: true });
	try {
		context.abortSignal?.throwIfAborted();
		const daemon = await owned.connection.info();
		if (daemon.os !== "linux") throw new Error("Identity comparison requires a Linux daemon");
		const peer = new RemoteExecutionEnv({
			connection: owned.connection,
			id: `${env.id}:peer:${randomUUID()}`,
			cwd: "/tmp",
		});
		const path = `/tmp/identity-${randomUUID()}.txt`;
		// A distinct object for the same connection has the same filesystem identity.
		const shared = new RemoteExecutionEnv({ connection: env.connection, id: env.id, cwd: "/tmp" });
		async function compare(clients: RemoteExecutionEnv[]) {
			for (const client of clients) getOrThrow(await client.writeFile(path, "0", context));
			let active = 0;
			let peak = 0;
			const events: { phase: string; client: number; value?: number }[] = [];
			await Promise.all(
				Array.from({ length: 8 }, (_, index) => {
					const client = index % 2;
					return withFileMutationQueue(
						clients[client],
						path,
						async () => {
							active++;
							peak = Math.max(peak, active);
							events.push({ phase: "start", client });
							try {
								const value = Number(getOrThrow(await clients[client].readTextFile(path, context)));
								if (!Number.isSafeInteger(value) || value < 0 || value > 7) throw new Error("Invalid identity counter");
								getOrThrow(await clients[client].writeFile(path, String(value + 1), context));
								events.push({ phase: "end", client, value: value + 1 });
							} finally {
								active--;
							}
						},
						context,
					);
				}),
			);
			const final = await Promise.all(
				clients.map(async (client) => Number(getOrThrow(await client.readTextFile(path, context)))),
			);
			return { peak, final, events };
		}
		const sameIdentity = await compare([env, shared]);
		const independent = await compare([env, peer]);
		return {
			ids: [env.id, peer.id],
			path,
			shared: sameIdentity,
			independent,
			verified:
				sameIdentity.peak === 1 &&
				sameIdentity.final.every((value) => value === 8) &&
				independent.peak === 2 &&
				independent.final.every((value) => value === 4),
			limitation: "In-process mutation queue only; not an OS sandbox or cross-process lock",
		};
	} finally {
		owned.connection.close();
		context.abortSignal?.removeEventListener("abort", stop);
		await owned.close();
	}
}
