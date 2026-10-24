import { EventEmitter } from "node:events";
import { setImmediate, setTimeout } from "node:timers/promises";
import {
	createHost,
	type Frame,
	hostNamed,
	ipcLink,
	isChordError,
	type Link,
	local,
	memoryLinkPair,
	method,
	remote,
	type WebSocketLike,
	webSocketLink,
} from "@earendil-works/chord";
import { type JsonValue, ProtocolValidationError } from "@pi-workbench/protocol";
import { Type } from "typebox";
import { inputObject, numberInput, textInput, wireResult } from "./common.ts";
import { readOperationFields } from "./fields.ts";

type Transport = "memoryLinkPair" | "ipcLink" | "webSocketLink";

/** Controlled SDK transport boundary: no process, network socket, or browser is created. */
class LocalIpcChannel extends EventEmitter {
	readonly connected = true;
	peer: LocalIpcChannel | undefined;
	readonly payloads: unknown[];

	constructor(payloads: unknown[]) {
		super();
		this.payloads = payloads;
	}

	send(message: unknown): boolean {
		const detached = structuredClone(message);
		this.payloads.push(detached);
		queueMicrotask(() => this.peer?.emit("message", detached));
		return true;
	}
}

class LocalWebSocket implements WebSocketLike {
	readyState = 1;
	peer: LocalWebSocket | undefined;
	readonly events = new EventEmitter();
	readonly payloads: unknown[];

	constructor(payloads: unknown[]) {
		this.payloads = payloads;
	}

	send(data: string): void {
		this.payloads.push(data);
		queueMicrotask(() => {
			if (this.peer?.readyState === 1) this.peer.events.emit("message", { data });
		});
	}

	close(): void {
		if (this.readyState === 3) return;
		this.readyState = 3;
		this.events.emit("close");
		this.peer?.close();
	}

	addEventListener(type: "message", listener: (event: { readonly data: unknown }) => void): void;
	addEventListener(type: "open" | "close" | "error", listener: () => void): void;
	addEventListener(
		type: "message" | "open" | "close" | "error",
		listener: ((event: { readonly data: unknown }) => void) | (() => void),
	): void {
		this.events.on(type, listener);
	}
}

function localLinks(transport: Transport): { links: [Link, Link]; payloads: unknown[] } {
	const payloads: unknown[] = [];
	if (transport === "memoryLinkPair") return { links: memoryLinkPair(), payloads };
	if (transport === "ipcLink") {
		const left = new LocalIpcChannel(payloads);
		const right = new LocalIpcChannel(payloads);
		left.peer = right;
		right.peer = left;
		return { links: [ipcLink(left), ipcLink(right)], payloads };
	}
	const left = new LocalWebSocket(payloads);
	const right = new LocalWebSocket(payloads);
	left.peer = right;
	right.peer = left;
	return { links: [webSocketLink(left), webSocketLink(right)], payloads };
}

function tapped(link: Link, frames: Frame[]): Link {
	return {
		get closed() {
			return link.closed;
		},
		send(frame) {
			frames.push(structuredClone(frame));
			link.send(frame);
		},
		receive: (handler) => link.receive(handler),
		onClose: (handler) => link.onClose(handler),
		close: (reason) => link.close(reason),
	};
}

function counterContract(name: string, version: number, host: string) {
	return remote(name, {
		version,
		input: Type.Object({}),
		host: hostNamed(host),
		variants: {
			main: {
				state: { count: Type.Number() },
				methods: { add: method(Type.Number(), Type.Number()) },
			},
		},
	});
}

async function routeCounter(name: string, contractName: string, version: number, transport: Transport) {
	const {
		links: [downstream, upstream],
		payloads,
	} = localLinks(transport);
	const frames: Frame[] = [];
	const server = createHost({ name, self: { localFixture: true }, onError: () => {} });
	const client = createHost({
		name: `${name}.reader`,
		self: { localFixture: true },
		kind: "client",
		upstream: { link: tapped(upstream, frames), principal: { localFixture: true } },
		onError: () => {},
	});
	const contract = counterContract(contractName, version, name);
	server.accept(tapped(downstream, frames), { kind: "client", principal: { localFixture: true } });
	server.serve(contract, (_input, _principal, self) => {
		const count = self.state("count", Type.Number(), 0);
		return {
			variant: "main",
			count,
			add: (amount, ctx) => {
				count.replace(ctx, count.value + amount);
				return count.value;
			},
		};
	});
	const handle = client.hold(contract, {});
	const changes: number[] = [];
	const unsubscribe = handle.count.subscribe((count) => {
		if (count !== undefined) changes.push(count);
	});
	try {
		await handle.ready;
		const initial = handle.count.value;
		const rpcResult = await handle.add(7);
		await setImmediate();
		const replica = handle.count.value;
		const mismatches: { code: string; message: string }[] = [];
		for (const wrong of [
			counterContract(`${contractName}.missing`, version, name),
			counterContract(contractName, version + 1, name),
		]) {
			const rejected = client.hold(wrong, {});
			try {
				await rejected.ready;
				throw new Error("SDK unexpectedly accepted a mismatched contract");
			} catch (error) {
				if (!isChordError(error)) throw error;
				mismatches.push({ code: error.code, message: error.message });
			} finally {
				rejected.release();
			}
		}
		return { initial, rpcResult, replica, changes, frames, mismatches, wireSamples: payloads.slice(0, 6) };
	} finally {
		unsubscribe();
		handle.release();
		await client.close();
		await server.close();
		downstream.close();
		upstream.close();
	}
}

async function validateCell(dev: boolean) {
	const host = createHost({ self: { localFixture: true }, dev, onError: () => {} });
	const contract = local("workbench.dev.validation", {
		version: 1,
		input: Type.Object({}),
		members: { update: method(Type.Unknown(), Type.Null()) },
	});
	host.serve(contract, (_input, _principal, self) => {
		const state = self.state("value", Type.Object({ n: Type.Number() }), { n: 0 });
		return {
			update: (value, ctx) => {
				// Deliberately bypass static typing to exercise the SDK's runtime cell validation.
				state.replace(ctx, value as { n: number });
				return null;
			},
		};
	});
	const handle = await host.get(contract, {});
	try {
		await handle.update({ n: "invalid-number" });
		return { invalidWriteRejected: false, code: null, reason: null };
	} catch (error) {
		if (!isChordError(error)) throw error;
		return { invalidWriteRejected: true, code: error.code, reason: error.reason ?? null };
	} finally {
		handle.release();
		await host.close();
	}
}

async function loadEager(awaitEager: boolean) {
	const host = createHost({ self: { localFixture: true }, onError: () => {} });
	const contract = local("workbench.eager.gate", { version: 1, input: Type.Object({}) });
	let release: (value: string) => void = () => {};
	let resourceOpened = false;
	let loadSettled = false;
	let resourceClosed = false;
	const gate = new Promise<string>((resolve) => {
		release = resolve;
	});
	try {
		const loaded = host
			.load(
				[
					{
						name: "workbench.eager.facet",
						setup({ serve }) {
							serve(
								contract,
								(_input, _principal, self) => {
									self.resource("gate", {
										version: 1,
										open: () => {
											resourceOpened = true;
											return gate;
										},
										close: () => {
											resourceClosed = true;
										},
									});
									return {};
								},
								{ lifetime: "host" },
							);
						},
					},
				],
				// The saved workbench field controls the renamed startup barrier in Chord 1.3.
				{ awaitHostObjects: awaitEager },
			)
			.then(() => {
				loadSettled = true;
			});
		await setImmediate();
		const settledBeforeRelease = loadSettled;
		release("open");
		await loaded;
		await host.ready();
		await host.close();
		return { resourceOpened, settledBeforeRelease, settledAfterRelease: loadSettled, resourceClosed };
	} finally {
		release("cleanup");
		await host.close();
	}
}

async function observeUpstream(
	name: string,
	kind: "host" | "client",
	pingInterval: number,
	pingTimeout: number,
	observeMs: number,
) {
	const [silentPeer, upstream] = memoryLinkPair();
	const started = Date.now();
	const frames: { frame: Frame; elapsedMs: number }[] = [];
	let closeReason: string | null = null;
	let closedAfterMs: number | null = null;
	silentPeer.receive((frame) => frames.push({ frame, elapsedMs: Date.now() - started }));
	upstream.onClose((reason) => {
		closeReason = reason;
		closedAfterMs = Date.now() - started;
	});
	const host = createHost({
		name,
		self: { localFixture: true },
		kind,
		upstream: { link: upstream, principal: { localFixture: true }, pingInterval, pingTimeout },
		onError: () => {},
	});
	try {
		let reloadAllowed = false;
		let reloadError: string | null = null;
		try {
			await host.reload([]);
			reloadAllowed = true;
		} catch (error) {
			reloadError = error instanceof Error ? error.message : String(error);
		}
		await setTimeout(observeMs);
		const pings = frames.filter(({ frame }) => frame.t === "ping");
		return {
			hello: frames.find(({ frame }) => frame.t === "hello")?.frame,
			reloadAllowed,
			reloadError,
			pingCount: pings.length,
			firstPingAfterMs: pings[0]?.elapsedMs ?? null,
			pingSamples: pings.slice(0, 16),
			closed: upstream.closed,
			closeReason,
			closedAfterMs,
			observationMs: observeMs,
			appliedPingIntervalMs: pingInterval,
			appliedPingTimeoutMs: pingTimeout,
			timeoutObserved: closeReason === "ping timeout",
		};
	} finally {
		await host.close();
		silentPeer.close();
	}
}

/** Public Chord APIs with isolated local fixtures; fields never change a persistent host. */
export async function chordHost(input: unknown): Promise<JsonValue> {
	const value = inputObject(input, ["fields", "observeMs"]);
	const fields = readOperationFields("chord", "host", value.fields);
	const name = textInput(fields["host.name"], "host.name", "workbench-host");
	const contractName = textInput(fields["workbench.contractName"], "workbench.contractName", "demo.counter");
	if (!name || !contractName) throw new ProtocolValidationError("fields", "Host and contract names must not be empty");
	const version = numberInput(fields["workbench.contractVersion"], "workbench.contractVersion", 1, 1, 1_000_000);
	const kind = fields["host.kind"] ?? "host";
	if (kind !== "host" && kind !== "client") throw new ProtocolValidationError("host.kind", "Expected host or client");
	const dev = fields["host.dev"] ?? true;
	const awaitEager = fields["load.awaitEager"] ?? true;
	if (typeof dev !== "boolean" || typeof awaitEager !== "boolean")
		throw new ProtocolValidationError("fields", "Expected boolean");
	const transport = fields["workbench.link"] ?? "memoryLinkPair";
	if (transport !== "memoryLinkPair" && transport !== "ipcLink" && transport !== "webSocketLink")
		throw new ProtocolValidationError("workbench.link", "Expected a supported local SDK transport");
	const pingInterval = numberInput(
		fields["host.upstreamOptions.pingInterval"],
		"host.upstreamOptions.pingInterval",
		15_000,
		1,
		2_147_483_647,
	);
	const pingTimeout = numberInput(
		fields["host.upstreamOptions.pingTimeout"],
		"host.upstreamOptions.pingTimeout",
		45_000,
		1,
		2_147_483_647,
	);
	const observeMs = numberInput(value.observeMs, "observeMs", 50, 1, 1000);
	const [routing, validation, eager, upstream] = await Promise.all([
		routeCounter(name, contractName, version, transport),
		validateCell(dev),
		loadEager(awaitEager),
		observeUpstream(name, kind, pingInterval, pingTimeout, observeMs),
	]);
	return wireResult({
		routing,
		validation,
		eager,
		upstream,
		transport,
		transportScope:
			transport === "memoryLinkPair" ? "native-memory-link" : "SDK-adapter-over-controlled-in-process-endpoints",
		externalConnections: 0,
		processesStarted: 0,
		limitations: [
			"Separate disposable SDK hosts exercise routing, validation, eager load and upstream behavior.",
			"WebSocket and IPC adapters use in-process endpoints; no actual socket or process integration is verified.",
			"Ping values are applied unchanged; only events within observeMs (1..1000 ms) are observed. Long timers may not fire.",
		],
	});
}
