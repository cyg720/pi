import { Agent, type AgentMessage, type AgentOptions, type AgentTool } from "@earendil-works/pi-agent-core";
import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import { type JsonObject, type JsonValue, ProtocolValidationError } from "@pi-workbench/protocol";
import {
	type ConfiguredModelRequestObservation,
	createConfiguredModelRuntime,
	createWorkspaceTools,
} from "@pi-workbench/runtime-adapter";
import { HttpError } from "../errors.ts";
import { bindWorkspaceTool } from "./agent-tool-binding.ts";
import { inputObject, type ModuleContext, numberInput, textInput, wireResult } from "./common.ts";
import { readOperationFields } from "./fields.ts";

/** One native Agent run, using the same approved model and guarded tools as coding-agent. */
export async function agentLiveRun(input: unknown, context: ModuleContext): Promise<JsonValue> {
	const value = inputObject(input, ["text", "fields", "tools", "steering", "followUp", "timeoutMs", "maxTurns"]);
	const fields = readOperationFields("agent", "live-run", value.fields);
	const configured = context.configuredModel;
	if (!configured) throw new HttpError(503, "UNAVAILABLE", "Host has not configured a live model");
	const text = textInput(value.text, "text");
	if (!text.trim()) throw new ProtocolValidationError("text", "A prompt is required");
	if (fields.transport !== undefined && fields.transport !== "sse")
		throw new HttpError(400, "UNSUPPORTED", "Host live generation supports explicit SSE transport only");
	const allowed = context.allowedTools ?? [];
	const selected = value.tools ?? [...allowed];
	if (!Array.isArray(selected) || selected.some((name) => typeof name !== "string" || !allowed.includes(name)))
		throw new HttpError(403, "FORBIDDEN", "Tools must be a subset of the host workspace tool allowlist");
	const enabledTools = [...new Set(selected as string[])];
	const workspaceTools: AgentTool[] = await createWorkspaceTools(context.workspaceRoot);
	const binding = bindWorkspaceTool(fields["workbench.toolDefinition"], workspaceTools, enabledTools);
	const selectedTools = workspaceTools.filter((tool) => enabledTools.includes(tool.name));
	const boundTools = selectedTools.map((tool) => (binding?.hostTool === tool.name ? binding.tool : tool));
	const timeoutMs = numberInput(value.timeoutMs, "timeoutMs", 120000, 1, 120000);
	const maxTurns = numberInput(value.maxTurns, "maxTurns", 6, 1, 12);
	const maxRetryDelayMs = numberInput(fields.maxRetryDelayMs, "maxRetryDelayMs", 1000, 0, 60000);
	const queues: Record<"steering" | "followUp", string[]> = { steering: [], followUp: [] };
	for (const kind of ["steering", "followUp"] as const) {
		const entries = value[kind] ?? [];
		if (!Array.isArray(entries) || entries.length > 4)
			throw new ProtocolValidationError(kind, "Expected at most four texts");
		queues[kind] = entries.map((entry) => textInput(entry, kind));
	}
	const messages: AgentMessage[] = [];
	if (fields["initialState.messages"] !== undefined) {
		const history = fields["initialState.messages"];
		if (!Array.isArray(history) || history.length > 16)
			throw new ProtocolValidationError("initialState.messages", "Expected at most 16 user messages");
		for (const item of history) {
			const message = inputObject(item, ["role", "content", "timestamp"]);
			if (message.role !== "user" || typeof message.timestamp !== "number")
				throw new ProtocolValidationError("initialState.messages", "Only user-text history is supported");
			messages.push({
				role: "user",
				content: textInput(message.content, "message.content"),
				timestamp: message.timestamp,
			});
		}
	}
	const requestAttempts: ConfiguredModelRequestObservation[] = [];
	const models = await createConfiguredModelRuntime(configured, (observation) => requestAttempts.push(observation));
	const model = models.getModel(configured.provider, configured.id);
	if (!model) throw new HttpError(503, "UNAVAILABLE", "Host model is unavailable");
	const thinkingLevel = (fields["initialState.thinkingLevel"] ?? "off") as NonNullable<
		AgentOptions["initialState"]
	>["thinkingLevel"];
	if (thinkingLevel && !getSupportedThinkingLevels(model).includes(thinkingLevel))
		throw new HttpError(400, "UNSUPPORTED", "Requested thinking level is not supported by the host model");
	const started = performance.now();
	const deadline = AbortSignal.timeout(timeoutMs);
	const signal = context.signal ? AbortSignal.any([deadline, context.signal]) : deadline;
	let activeTools = 0;
	let peakActiveTools = 0;
	let multiToolBatch = false;
	let providerCalls = 0;
	let turns = 0;
	let turnLimitReached = false;
	let boundToolCalls = 0;
	const toolTrace: JsonObject[] = [];
	const events: string[] = [];
	const requestUsers: string[][] = [];
	const responseStatuses: number[] = [];
	const tools = boundTools.map((tool) => ({
		...tool,
		execute: async (...args: Parameters<typeof tool.execute>) => {
			activeTools++;
			peakActiveTools = Math.max(peakActiveTools, activeTools);
			toolTrace.push({
				phase: "start",
				name: tool.name,
				id: args[0],
				elapsedMs: Math.round(performance.now() - started),
			});
			try {
				signal.throwIfAborted();
				const result = await tool.execute(...args);
				if (binding?.tool.name === tool.name) boundToolCalls++;
				return result;
			} finally {
				activeTools--;
				toolTrace.push({
					phase: "end",
					name: tool.name,
					id: args[0],
					elapsedMs: Math.round(performance.now() - started),
				});
			}
		},
	}));
	const agent = new Agent({
		initialState: {
			model,
			tools,
			messages,
			thinkingLevel,
			systemPrompt: textInput(
				fields["initialState.systemPrompt"],
				"initialState.systemPrompt",
				"Use the approved workspace tools when needed.",
			),
		},
		toolExecution: fields.toolExecution as AgentOptions["toolExecution"],
		steeringMode: fields.steeringMode as AgentOptions["steeringMode"],
		followUpMode: fields.followUpMode as AgentOptions["followUpMode"],
		sessionId: fields.sessionId as string | undefined,
		transport: "sse",
		maxRetryDelayMs,
		streamFn: (selectedModel, request, options) => {
			providerCalls++;
			requestUsers.push(
				request.messages
					.filter((message) => message.role === "user")
					.map((message) =>
						typeof message.content === "string"
							? message.content
							: message.content
									.filter((part) => part.type === "text")
									.map((part) => part.text)
									.join(""),
					),
			);
			return models.streamSimple(selectedModel, request, {
				...options,
				signal: options?.signal ? AbortSignal.any([signal, options.signal]) : signal,
				maxTokens: Math.min(configured.maxTokens, 4096),
				timeoutMs,
				maxRetries: 0,
				onResponse: (response) => {
					responseStatuses.push(response.status);
				},
			});
		},
		finishTurn: ({ message }) => {
			turns++;
			if (turns >= maxTurns) {
				turnLimitReached =
					message.role === "assistant" && (message.stopReason === "toolUse" || agent.hasQueuedMessages());
				return { action: "end" };
			}
		},
	});
	let queued = false;
	const unsubscribe = agent.subscribe((event) => {
		if (event.type !== "message_update") events.push(event.type);
		if (event.type === "message_end" && event.message.role === "assistant") {
			if (event.message.content.filter((part) => part.type === "toolCall").length > 1) multiToolBatch = true;
			if (!queued) {
				queued = true;
				for (const content of queues.steering) agent.steer({ role: "user", content, timestamp: Date.now() });
				for (const content of queues.followUp) agent.followUp({ role: "user", content, timestamp: Date.now() });
			}
		}
	});
	const abort = () => agent.abort();
	signal.addEventListener("abort", abort, { once: true });
	try {
		await agent.prompt(text);
		const assistant = agent.state.messages.filter((message) => message.role === "assistant");
		const last = assistant.at(-1);
		const ok = Boolean(last && ["stop", "length"].includes(last.stopReason) && !signal.aborted && !turnLimitReached);
		const thinkingObserved = assistant.some((message) =>
			message.content.some((part) => part.type === "thinking" && part.thinking.length > 0),
		);
		const verified = new Set<string>();
		if (ok) {
			verified.add("transport");
			if (boundToolCalls > 0) verified.add("workbench.toolDefinition");
			if (thinkingObserved && thinkingLevel !== "off") verified.add("initialState.thinkingLevel");
			if (
				multiToolBatch &&
				((agent.toolExecution === "parallel" && peakActiveTools > 1) ||
					(agent.toolExecution === "sequential" && peakActiveTools === 1))
			)
				verified.add("toolExecution");
		}
		const effectiveValues = Object.fromEntries(Object.entries(fields).filter(([key]) => verified.has(key)));
		const result = {
			ok,
			text:
				last?.content
					.filter((part) => part.type === "text")
					.map((part) => part.text)
					.join("") ?? "",
			model: { provider: model.provider, id: model.id },
			enabledTools: tools.map((tool) => tool.name),
			hostTools: enabledTools,
			...(binding
				? { toolBinding: { name: binding.tool.name, hostTool: binding.hostTool, completedCalls: boundToolCalls } }
				: {}),
			toolTrace,
			peakActiveTools,
			multiToolBatch,
			providerCalls,
			responseStatuses,
			// Fetch attempts end at response headers; they do not prove stream completion or billing.
			requestAttempts,
			requestUsers,
			events,
			turns,
			turnLimitReached,
			thinkingObserved,
			deadlineReached: deadline.aborted,
			clientCancelled: context.signal?.aborted ?? false,
			elapsedMs: Math.round(performance.now() - started),
			queueRemaining: agent.hasQueuedMessages(),
			messages: agent.state.messages.map((message) =>
				message.role === "assistant"
					? {
							...message,
							errorMessage: message.errorMessage ? "Provider generation did not complete" : undefined,
							usage: { ...message.usage, cost: configured.cost ? message.usage.cost : null },
						}
					: message,
			),
			requestedValues: fields,
			effectiveValues,
			appliedFields: Object.keys(effectiveValues),
			savedConfigApplied: false,
			validationLevel: "live-provider-response",
			effectTiming: "explicit-operation",
			fieldEffectiveness: Object.keys(fields).map((key) => ({
				key,
				status: !ok ? "failed" : verified.has(key) ? "observed-in-this-run" : "sent-not-behavior-verified",
				support: "live-provider-response",
				scope: "explicit-operation-only",
			})),
			...(!ok
				? {
						error: deadline.aborted
							? "Agent deadline reached"
							: turnLimitReached
								? "Agent turn limit reached"
								: "Agent run did not complete",
					}
				: {}),
		};
		return wireResult(
			JSON.parse(
				configured.apiKey ? JSON.stringify(result).replaceAll(configured.apiKey, "[REDACTED]") : JSON.stringify(result),
			),
		);
	} finally {
		signal.removeEventListener("abort", abort);
		unsubscribe();
		agent.abort();
	}
}
