import { execFile, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { promisify } from "node:util";
import {
	createTaskPlan,
	type DocumentationVariant,
	type EvalObservation,
	formatEvalComparisonReport,
	parseDiscoveredCases,
	readTaskObservation,
	summarizeEvalObservations,
} from "@earendil-works/pi-evals/workbench";
import { type JsonValue, ProtocolValidationError } from "@pi-workbench/protocol";
import { HttpError } from "../errors.ts";
import { inputObject, type ModuleContext, numberInput, textInput, wireResult } from "./common.ts";
import { readOperationFields } from "./fields.ts";

/** Provisioned by the embedding host; none of these values can come from HTTP configuration. */
export interface DockerEvalsHost {
	dockerPath: string;
	images: Record<DocumentationVariant, string>;
	provider: string;
	model: string;
	apiKey: string;
	files: readonly string[];
	environment: NodeJS.ProcessEnv;
}

const execute = promisify(execFile);

export async function evalsLive(operation: string, input: unknown, context: ModuleContext): Promise<JsonValue> {
	if (!context.dockerEvals) throw new HttpError(501, "UNSUPPORTED", "Host has not authorized Docker evaluations");
	const host = context.dockerEvals;
	if (
		!isAbsolute(host.dockerPath) ||
		!host.apiKey.trim() ||
		Object.values(host.images).some((image) => !/^sha256:[a-f0-9]{64}$/.test(image))
	)
		throw new Error("Invalid host Docker evaluation configuration");
	const value = inputObject(input, ["fields"]);
	const fields = readOperationFields("evals", operation, value.fields);
	const provider = textInput(fields.provider, "provider", host.provider);
	const model = textInput(fields.model, "model", host.model);
	if (provider !== host.provider || model !== host.model)
		throw new HttpError(403, "FORBIDDEN", "Evaluation model is not authorized by this host");
	const requestedFiles = fields.requestedFiles ?? [...host.files];
	if (
		!Array.isArray(requestedFiles) ||
		requestedFiles.length < 1 ||
		requestedFiles.length > 4 ||
		!requestedFiles.every(
			(file): file is string =>
				typeof file === "string" && /^evals\/[a-zA-Z0-9_/-]+\.docs\.eval\.ts$/.test(file) && host.files.includes(file),
		)
	)
		throw new ProtocolValidationError("requestedFiles", "Expected host-approved eval files");
	const discoveryArgs = fields.discoveryArgs ?? [];
	if (!Array.isArray(discoveryArgs) || discoveryArgs.length > 4)
		throw new ProtocolValidationError("discoveryArgs", "Expected bounded test-name filters");
	const args = discoveryArgs.map((item) => textInput(item, "discoveryArg"));
	for (let index = 0; index < args.length; index++) {
		if (args[index] === "-t" || args[index] === "--testNamePattern") {
			if (!args[++index]) throw new ProtocolValidationError("discoveryArgs", "Missing pattern");
		} else if (!args[index].startsWith("--testNamePattern=") || args[index] === "--testNamePattern=")
			throw new ProtocolValidationError("discoveryArgs", "Only test-name filters are supported");
	}
	const runsPerVariant = numberInput(fields.runsPerVariant, "runsPerVariant", 1, 1, 3);
	const signal = AbortSignal.any([AbortSignal.timeout(720_000), ...(context.signal ? [context.signal] : [])]);
	signal.throwIfAborted();
	const operationId = randomUUID();
	const owner = createHash("sha256")
		.update(JSON.stringify([context.principalId, context.workspaceRoot]))
		.digest("hex");
	const artifactDirectory = join(context.dataDirectory, "evals", owner, operationId);
	await mkdir(artifactDirectory, { recursive: true, mode: 0o700 });
	const environment = Object.fromEntries(
		Object.entries(host.environment).filter(([name]) =>
			["PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "USERPROFILE", "PROGRAMDATA"].includes(name.toUpperCase()),
		),
	);
	const exits: { variant: DocumentationVariant; discovery: boolean; code: number | null }[] = [];
	async function run(variant: DocumentationVariant, discovery: boolean, selected: string[], index: number) {
		signal.throwIfAborted();
		const directory = join(artifactDirectory, `${index}-${variant}`);
		await mkdir(directory, { recursive: true, mode: 0o700 });
		const name = `pi-workbench-eval-${operationId}-${index}`;
		const dockerArgs = [
			"run",
			"--rm",
			"--pull=never",
			"--name",
			name,
			"--label",
			"pi.workbench.evals=live",
			"--read-only",
			"--pids-limit",
			"256",
			"--memory",
			"2g",
			"--cpus",
			"2",
			"-i",
			"--tmpfs",
			"/tmp:rw,exec,mode=1777",
			"--tmpfs",
			"/run/pi-eval-secrets:rw,noexec,mode=0700",
			"--tmpfs",
			"/repo/node_modules/.vite-temp:rw,exec,mode=1777",
			"--mount",
			`type=bind,source=${directory},target=/artifacts`,
		];
		for (const [key, entry] of Object.entries({
			PI_EVAL_ARTIFACT_DIR: "/artifacts",
			PI_EVAL_RUNS_PER_VARIANT: "1",
			PI_EVAL_SANDBOX_UID: "65532",
			PI_EVAL_SANDBOX_GID: "65532",
			PI_PROVIDER: provider,
			PI_MODEL: model,
		}))
			dockerArgs.push("--env", `${key}=${entry}`);
		if (discovery) dockerArgs.push("--network=none");
		dockerArgs.push(
			"--entrypoint",
			"/bin/sh",
			host.images[variant],
			"-c",
			'umask 077; cat > /run/pi-eval-secrets/auth.json; exec node --experimental-strip-types docker/entrypoint.ts "$@"',
			"pi-eval",
		);
		if (discovery) dockerArgs.push("--discover");
		dockerArgs.push("--project", "docs", ...selected);
		let output = "";
		let overflow = false;
		try {
			const code = await new Promise<number | null>((resolve, reject) => {
				const child = spawn(host.dockerPath, dockerArgs, {
					env: environment,
					windowsHide: true,
					stdio: ["pipe", "pipe", "pipe"],
					signal,
				});
				const collect = (chunk: Buffer) => {
					if (output.length + chunk.length > 4 * 1024 * 1024) {
						overflow = true;
						child.kill();
					} else output += chunk.toString("utf8");
				};
				child.stdout.on("data", collect);
				child.stderr.on("data", collect);
				child.once("error", reject);
				child.once("close", resolve);
				child.stdin.on("error", () => {});
				child.stdin.end(JSON.stringify(discovery ? {} : { [provider]: { type: "api_key", key: host.apiKey } }));
			});
			if (output.includes(host.apiKey)) throw new Error("Credential detected in evaluator output");
			await writeFile(join(directory, "console.log"), output, { mode: 0o600 });
			exits.push({ variant, discovery, code });
			if (overflow || (discovery && code !== 0)) throw new Error("Evaluation discovery or output limit failed");
			return { directory, code };
		} finally {
			await execute(host.dockerPath, ["rm", "-f", name], { env: environment, windowsHide: true, timeout: 10000 }).catch(
				async () => {
					const { stdout } = await execute(
						host.dockerPath,
						["ps", "-a", "--filter", `name=^/${name}$`, "--format", "{{.Names}}"],
						{ env: environment, windowsHide: true, timeout: 10000 },
					);
					if (stdout.trim()) throw new Error("Evaluation container cleanup failed");
				},
			);
		}
	}
	const discovered = [];
	for (const variant of ["without_docs", "with_docs"] as const) {
		const { directory } = await run(variant, true, [...requestedFiles, ...args], discovered.length);
		discovered.push(parseDiscoveredCases(JSON.parse(await readFile(join(directory, "discovered-tests.json"), "utf8"))));
	}
	if (JSON.stringify(discovered[0]) !== JSON.stringify(discovered[1])) throw new Error("Variant discoveries differ");
	const cases = discovered[0].map((entry) => ({ ...entry, file: entry.file.replace("/repo/packages/evals/", "") }));
	if (cases.length > 4 || cases.some((entry) => !requestedFiles.includes(entry.file)))
		throw new Error("Discovery exceeded the authorized selection");
	const tasks = createTaskPlan(cases, `${provider}/${model}`, runsPerVariant);
	const protocol = { operationId, images: host.images, provider, model, requestedFiles, discoveryArgs: args, tasks };
	const protocolDigest = createHash("sha256").update(JSON.stringify(protocol)).digest("hex");
	await writeFile(join(artifactDirectory, "protocol.json"), JSON.stringify({ ...protocol, protocolDigest }, null, 2));
	const observations: EvalObservation[] = [];
	if (operation === "live-evaluate") {
		for (const [index, task] of tasks.entries()) {
			const pattern = `^${`${task.evalSet} ${task.caseId}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`;
			const { directory, code } = await run(task.variant, false, [task.file, "-t", pattern], index + 2);
			const observation = await readTaskObservation(task, join(directory, "vitest.json"), artifactDirectory);
			observations.push(code === 0 ? observation : { ...observation, outcome: "errored" });
			await writeFile(join(artifactDirectory, "observations.json"), JSON.stringify(observations, null, 2));
		}
	}
	const report = summarizeEvalObservations(protocolDigest, tasks, observations);
	const ok = cases.length > 0 && (operation === "live-discover" || report.blockedPairs.length === 0);
	const verified = ok
		? [
				"requestedFiles",
				"discoveryArgs",
				...(operation === "live-evaluate" ? ["provider", "model", "runsPerVariant"] : []),
			]
		: [];
	const effectiveValues = Object.fromEntries(Object.entries(fields).filter(([key]) => verified.includes(key)));
	const result = wireResult({
		ok,
		operationId,
		source: "native-docker-evaluation",
		validationLevel: "live-evaluation-response",
		discoveryExecuted: true,
		evaluationExecuted: operation === "live-evaluate" && tasks.length > 0,
		cases,
		tasks,
		observations,
		exits,
		report,
		text: formatEvalComparisonReport(report),
		effectiveValues,
		appliedFields: Object.keys(effectiveValues),
		fieldEffectiveness: Object.keys(fields).map((key) => ({
			key,
			status: !ok ? "failed" : Object.hasOwn(effectiveValues, key) ? "behavior-verified" : "sent-not-behavior-verified",
			scope: "explicit-operation-only",
			support: "live-evaluation-response",
		})),
		limitations: [
			"Explicit host-approved images, model and eval files only",
			"Scores measure these cases only; catalog costs are estimates, not invoices",
			"Discovery has no provider calls; evaluation calls the real provider",
			"Twelve-minute deadline; disconnect cancels owned containers",
		],
	});
	await writeFile(join(artifactDirectory, "result.json"), JSON.stringify(result, null, 2));
	return result;
}
