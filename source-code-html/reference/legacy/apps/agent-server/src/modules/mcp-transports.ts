import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { Worker } from "node:worker_threads";
import {
	type JsonRpcMessage,
	LATEST_PROTOCOL_VERSION,
	McpClient,
	type McpFetch,
	parseJsonRpcMessage,
	StreamableHttpTransport,
	type StreamableHttpTransportOptions,
} from "@earendil-works/pi-mcp";
import { type JsonObject, type JsonValue, ProtocolValidationError } from "@pi-workbench/protocol";
import { inputObject, numberInput, textInput, wireResult } from "./common.ts";
import { readOperationFields } from "./fields.ts";

interface HttpRequest {
	url: string;
	method: string;
	atMs: number;
	message: JsonRpcMessage | null;
}

async function httpProbe(options: StreamableHttpTransportOptions, retry: boolean, observeMs: number, text: string) {
	const requests: HttpRequest[] = [];
	const notifications: JsonRpcMessage[] = [];
	const errors: string[] = [];
	const startedAt = performance.now();
	let getCount = 0;
	const fixtureFetch: McpFetch = async (url, init) => {
		const message = typeof init?.body === "string" ? parseJsonRpcMessage(JSON.parse(init.body)) : null;
		const method = init?.method ?? "GET";
		requests.push({ url: String(url), method, atMs: performance.now() - startedAt, message });
		if (method === "GET") {
			getCount++;
			if (retry) return new Response("Local retry fixture", { status: 503 });
			if (getCount > 1) return new Response(null, { status: 405 });
			const notification = { jsonrpc: "2.0", method: "fixture/notification", params: { text } };
			return new Response(`data: ${JSON.stringify(notification)}\n\n`, {
				headers: { "content-type": "text/event-stream" },
			});
		}
		if (!message || !("id" in message) || !("method" in message)) return new Response(null, { status: 202 });
		const result =
			message.method === "initialize"
				? {
						protocolVersion: LATEST_PROTOCOL_VERSION,
						capabilities: { tools: {} },
						serverInfo: { name: "workbench-injected-fetch", version: "1" },
					}
				: { content: [{ type: "text", text }] };
		return Response.json({ jsonrpc: "2.0", id: message.id, result });
	};
	const transport = new StreamableHttpTransport({ ...options, fetch: fixtureFetch });
	const client = new McpClient({ name: "workbench-http-fixture", version: "1", requestTimeoutMs: 2000 });
	transport.onError((error) => errors.push(error.message));
	transport.onMessage((message) => {
		if ("method" in message && message.method === "fixture/notification") notifications.push(message);
	});
	try {
		await client.connect(transport);
		const result = await client.callTool("echo", { text });
		await delay(retry ? observeMs : 5);
		const attempts = requests.filter((request) => request.method === "GET");
		return {
			requests,
			notifications,
			errors,
			result,
			getAttempts: attempts.length,
			retryGapsMs: attempts.slice(1).map((request, index) => request.atMs - attempts[index].atMs),
			retryExhausted: retry && errors.some((error) => error.includes("could not be reopened")),
		};
	} finally {
		await client.close();
		await transport.close();
	}
}

/** Actual HTTP SDK parsing and timers; every fetch stays inside this function. */
export async function mcpHttp(input: unknown): Promise<JsonValue> {
	const value = inputObject(input, ["fields", "observeMs", "text"]);
	const fields = readOperationFields("mcp", "http", value.fields);
	const url = new URL(textInput(fields["http.url"], "http.url", "https://example.invalid/mcp"));
	if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
		throw new ProtocolValidationError("http.url", "Expected HTTP(S) URL without credentials; fetch remains local");
	const observeMs = numberInput(value.observeMs, "observeMs", 50, 1, 2000);
	const options: StreamableHttpTransportOptions = {
		url: url.href,
		openGetStream: fields["http.openGetStream"] !== false,
		maxMessageBytes: numberInput(fields["http.maxMessageBytes"], "http.maxMessageBytes", 16_777_216, 1, 16_777_216),
		reconnect: {
			initialDelayMs: numberInput(
				fields["http.reconnect.initialDelayMs"],
				"http.reconnect.initialDelayMs",
				1000,
				0,
				2_147_483_647,
			),
			maxDelayMs: numberInput(
				fields["http.reconnect.maxDelayMs"],
				"http.reconnect.maxDelayMs",
				30_000,
				0,
				2_147_483_647,
			),
			maxRetries: numberInput(fields["http.reconnect.maxRetries"], "http.reconnect.maxRetries", 5, 0, 20),
		},
	};
	const text = textInput(value.text, "text", "x".repeat(256));
	const roundtrip = await httpProbe(options, false, observeMs, text);
	const retry = await httpProbe(options, true, observeMs, text);
	return wireResult({
		transport: "streamable-http-injected-fetch",
		externalServerVerified: false,
		networkRequests: 0,
		appliedOptions: options,
		roundtrip,
		retry,
		observation: {
			observeMs,
			getStreamEnabled: options.openGetStream,
			retryFinished: retry.retryExhausted,
			messageLimitScope: "SSE event bytes only; native SDK does not cap application/json response bodies",
			inactiveReason: options.openGetStream
				? null
				: "GET disabled: SSE cap and reconnect timers have no observable GET effect",
			deadlineScope:
				"Timers use supplied milliseconds unchanged; unelapsed delays are not verified and are cancelled on close",
		},
	});
}

// Only this fixed program can be launched. Arguments are data after the script path, never Node options.
const STDIO_FIXTURE = String.raw`
import { createInterface } from "node:readline";
const marker = process.argv[2] ?? "alpha";
const stubborn = marker === "stubborn";
if (stubborn) {
	process.on("SIGTERM", () => {});
	setInterval(() => {}, 1000);
}
const lines = createInterface({ input: process.stdin });
lines.on("line", (line) => {
	const message = JSON.parse(line);
	if (message.id === undefined) return;
	if (message.method === "initialize") {
		process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: {
			protocolVersion: message.params.protocolVersion, capabilities: {}, serverInfo: { name: "owned-stdio-fixture", version: "1" }
		} }) + "\n");
		return;
	}
	const result = {
		marker, argv: process.argv.slice(1), argv0: process.argv0, cwd: process.cwd(), executable: process.execPath, pid: process.pid,
		inherited: process.env.PI_WORKBENCH_MCP_FIXTURE ?? null,
		environmentKeys: Object.keys(process.env).sort()
	};
	process.stderr.write("fixture-stderr-0123456789", () => {
		process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }) + "\n");
	});
});
lines.on("close", () => { if (!stubborn) process.exit(0); });
`;

// Running the SDK in a Worker with an explicit environment lets inheritEnv keep its real semantics
// without passing the server's environment (or credentials) to the fixture process.
function stdioRunnerSource(sdkUrl: string): string {
	return `
import { parentPort, workerData } from "node:worker_threads";
import { setTimeout as delay } from "node:timers/promises";
import { McpClient, StdioTransport } from ${JSON.stringify(sdkUrl)};
const transport = new StdioTransport(workerData);
const client = new McpClient({ name: "workbench-stdio-fixture", version: "1", requestTimeoutMs: 2000 });
const errors = [];
transport.onError((error) => errors.push(error.message));
let result;
let failure;
let closeElapsedMs;
try {
	const connecting = client.connect(transport);
	parentPort.postMessage({ kind: "pid", pid: transport.pid });
	await connecting;
	result = await client.request("fixture/inspect");
	await delay(10);
} catch (error) {
	failure = error instanceof Error ? error.message : String(error);
} finally {
	const closeStarted = performance.now();
	await client.close();
	await transport.close();
	closeElapsedMs = performance.now() - closeStarted;
}
parentPort.postMessage({ kind: "result", result: { observed: result ?? null, stderr: transport.stderr, closeElapsedMs, errors, failure: failure ?? null } });
parentPort.close();
`;
}

function processAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ESRCH") return false;
		throw error;
	}
}

/** Fixed local stdio fixture, never arbitrary executable, script, directory, or inherited host environment. */
export async function mcpStdio(input: unknown): Promise<JsonValue> {
	const value = inputObject(input, ["fields"]);
	const fields = readOperationFields("mcp", "stdio", value.fields);
	const command = textInput(fields["stdio.command"], "stdio.command", "node");
	if (command !== "node" && command !== process.execPath)
		throw new ProtocolValidationError(
			"stdio.command",
			'Only "node" or this runtime process.execPath can launch the owned fixture',
		);
	const cwdAlias = textInput(fields["stdio.cwd"], "stdio.cwd", "fixture://alpha");
	if (cwdAlias !== "fixture://alpha" && cwdAlias !== "fixture://beta")
		throw new ProtocolValidationError(
			"stdio.cwd",
			"Only fixture://alpha and fixture://beta are available private directories",
		);
	const args = fields["stdio.args"] ?? ["./mcp-server.mjs", "alpha"];
	if (
		!Array.isArray(args) ||
		args.length < 1 ||
		args.length > 2 ||
		args[0] !== "./mcp-server.mjs" ||
		(args.length === 2 && (typeof args[1] !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(args[1])))
	)
		throw new ProtocolValidationError(
			"stdio.args",
			'Expected ["./mcp-server.mjs"] and optional safe marker ("stubborn" tests close escalation)',
		);
	const maxStderrBytes = numberInput(fields["stdio.maxStderrBytes"], "stdio.maxStderrBytes", 65_536, 1, 65_536);
	const closeTimeoutMs = numberInput(fields["stdio.closeTimeoutMs"], "stdio.closeTimeoutMs", 2000, 0, 2000);
	const stderr = textInput(fields["stdio.stderr"], "stdio.stderr", "pipe");
	const inheritEnv = fields["stdio.inheritEnv"] === true;
	const root = await mkdtemp(join(tmpdir(), "pi-workbench-mcp-"));
	let worker: Worker | undefined;
	let pid: number | undefined;
	let output: JsonValue = null;
	const failures: unknown[] = [];
	try {
		const bin = process.platform === "win32" ? dirname(process.execPath) : join(root, "bin");
		if (process.platform !== "win32") {
			await mkdir(bin, { mode: 0o700 });
			await symlink(process.execPath, join(bin, "node"));
		}
		const systemEnvironment =
			process.platform === "win32" && process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {};
		// The native SDK uses taskkill for Windows process trees. Only its worker needs that path.
		const workerPath = systemEnvironment.SystemRoot
			? [bin, join(systemEnvironment.SystemRoot, "System32")].join(delimiter)
			: bin;
		for (const name of ["alpha", "beta"]) {
			const directory = join(root, name);
			await mkdir(directory, { mode: 0o700 });
			await writeFile(join(directory, "mcp-server.mjs"), STDIO_FIXTURE, { mode: 0o600 });
		}
		const runner = join(root, "runner.mjs");
		await writeFile(runner, stdioRunnerSource(import.meta.resolve("@earendil-works/pi-mcp")), { mode: 0o600 });
		const options = {
			command,
			args,
			cwd: join(root, cwdAlias.slice("fixture://".length)),
			env: { ...systemEnvironment, PATH: bin, HOME: root, USERPROFILE: root, LANG: "C.UTF-8" },
			inheritEnv,
			stderr,
			maxStderrBytes,
			closeTimeoutMs,
		};
		worker = new Worker(runner, {
			workerData: options,
			execArgv: [],
			env: {
				...systemEnvironment,
				PATH: workerPath,
				HOME: root,
				USERPROFILE: root,
				LANG: "C.UTF-8",
				PI_WORKBENCH_MCP_FIXTURE: "owned-fixture-inherited-value",
			},
		});
		const running = worker;
		const result = await new Promise<JsonObject>((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error("Owned MCP fixture exceeded 6000 ms deadline")), 6000);
			running.on("message", (message: unknown) => {
				if (!message || typeof message !== "object") return;
				if ("kind" in message && message.kind === "pid" && "pid" in message && typeof message.pid === "number")
					pid = message.pid;
				if ("kind" in message && message.kind === "result" && "result" in message) {
					clearTimeout(timer);
					try {
						resolve(inputObject(message.result, ["observed", "stderr", "closeElapsedMs", "errors", "failure"]));
					} catch (error) {
						reject(error);
					}
				}
			});
			running.once("error", (error) => {
				clearTimeout(timer);
				reject(error);
			});
			running.once("exit", (code) => {
				clearTimeout(timer);
				reject(new Error(`Owned MCP worker exited before result (${code})`));
			});
		});
		if (result.failure) throw new Error(String(result.failure));
		if (pid === undefined || processAlive(pid)) throw new Error("Owned MCP fixture did not exit after transport close");
		output = wireResult({
			...result,
			transport: "stdio-owned-node-fixture",
			externalServerVerified: false,
			networkRequests: 0,
			appliedOptions: options,
			allowedCommands: ["node", process.execPath],
			cwdAlias,
			childExited: true,
			environmentBoundary:
				"inheritEnv refers only to an isolated worker's explicit PATH, private HOME/USERPROFILE, LANG, Windows SystemRoot, and synthetic PI_WORKBENCH_MCP_FIXTURE; no server credentials are inherited",
			stderrBoundary:
				stderr === "inherit"
					? "Child stderr goes to the host stderr; the SDK buffer and maxStderrBytes are inactive"
					: "SDK captures and caps the actual child stderr",
		});
	} catch (error) {
		failures.push(error);
	}
	try {
		await worker?.terminate();
	} catch (error) {
		failures.push(error);
	}
	try {
		if (pid !== undefined && processAlive(pid)) {
			process.kill(process.platform === "win32" ? pid : -pid, "SIGKILL");
			for (let attempt = 0; attempt < 100 && processAlive(pid); attempt++) await delay(10);
			if (processAlive(pid)) throw new Error("Owned MCP fixture cleanup failed");
		}
	} catch (error) {
		failures.push(error);
	}
	try {
		await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
	} catch (error) {
		failures.push(error);
	}
	if (failures.length) throw new AggregateError(failures, failures.map((error) => String(error)).join("; "));
	return output;
}
