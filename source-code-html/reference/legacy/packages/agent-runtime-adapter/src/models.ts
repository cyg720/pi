import {
	createProvider,
	type FetchFunction,
	InMemoryCredentialStore,
	type ProviderStreams,
	type ThinkingLevelMap,
} from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { openAIResponsesApi } from "@earendil-works/pi-ai/api/openai-responses.lazy";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";

export interface ConfiguredLocalModelOptions {
	provider: string;
	id: string;
	baseUrl: string;
	api: "openai-completions" | "openai-responses";
	contextWindow: number;
	maxTokens: number;
	/** Exact HTTPS origins approved in host configuration, never from HTTP request bodies. */
	allowedOrigins?: readonly string[];
	/** Host-injected, memory-only credential. Never returned, persisted or resolved as a command/env name. */
	apiKey?: string;
	capabilities?: { reasoning?: boolean; input?: ("text" | "image")[]; thinkingLevelMap?: ThinkingLevelMap };
	cost?: { input: number; output: number; cacheRead: number; cacheWrite: number };
}

const knownCosts = new WeakMap<ModelRuntime, Set<string>>();
export function hasKnownModelCost(runtime: ModelRuntime, provider: string, id: string): boolean {
	return knownCosts.get(runtime)?.has(`${provider}/${id}`) ?? false;
}

/** Transport observation only: never includes credentials, headers, URLs or message bodies. */
export interface ConfiguredModelRequestObservation {
	attempt: number;
	startedAt: number;
	elapsedMs: number;
	status: number | null;
	aborted: boolean;
	/** Allowlisted transport code only; null also covers unknown failures. Ends at response headers. */
	failureCode: string | null;
}

const transportFailureCodes = new Set([
	"UND_ERR_CONNECT_TIMEOUT",
	"UND_ERR_HEADERS_TIMEOUT",
	"UND_ERR_ABORTED",
	"UND_ERR_SOCKET",
	"ECONNREFUSED",
	"ECONNRESET",
	"ENOTFOUND",
	"EAI_AGAIN",
	"ETIMEDOUT",
]);

/** Explicit loopback or host-allowlisted HTTPS endpoint, without saved credentials or model fallback. */
export async function createConfiguredModelRuntime(
	options: ConfiguredLocalModelOptions,
	onRequest?: (observation: ConfiguredModelRequestObservation) => void,
): Promise<ModelRuntime> {
	const url = new URL(options.baseUrl);
	const local = url.protocol === "http:" && ["127.0.0.1", "[::1]"].includes(url.hostname);
	const allowed = (options.allowedOrigins ?? []).some((origin) => {
		const approved = new URL(origin);
		return (
			approved.protocol === "https:" &&
			!approved.username &&
			!approved.password &&
			!approved.search &&
			!approved.hash &&
			approved.pathname === "/" &&
			approved.origin === url.origin
		);
	});
	if ((!local && !(url.protocol === "https:" && allowed)) || url.username || url.password || url.search || url.hash) {
		throw new Error(
			"Model endpoint must be loopback HTTP or host-allowlisted HTTPS without URL credentials, query or fragment",
		);
	}
	if (!local && !options.apiKey?.trim())
		throw new Error("External endpoint requires an explicit host memory credential");
	if (
		options.capabilities?.input &&
		(!options.capabilities.input.length ||
			options.capabilities.input.some((input) => input !== "text" && input !== "image"))
	)
		throw new Error("Invalid model input capabilities");
	if (options.cost && Object.values(options.cost).some((cost) => !Number.isFinite(cost) || cost < 0))
		throw new Error("Invalid model pricing");
	const thinkingLevelMap = options.capabilities?.thinkingLevelMap;
	if (
		thinkingLevelMap !== undefined &&
		(!options.capabilities?.reasoning ||
			!thinkingLevelMap ||
			typeof thinkingLevelMap !== "object" ||
			Array.isArray(thinkingLevelMap) ||
			Object.entries(thinkingLevelMap).some(
				([level, value]) =>
					!["off", "minimal", "low", "medium", "high", "xhigh", "max"].includes(level) ||
					(value !== null && (typeof value !== "string" || !value.trim() || value.length > 80)),
			))
	)
		throw new Error("Invalid explicit thinking level mapping");
	if (!/^[a-zA-Z0-9_-]{1,80}$/.test(options.provider) || !options.id.trim() || options.id.length > 256) {
		throw new Error("Invalid explicit local model identity");
	}
	if (
		![options.contextWindow, options.maxTokens].every((value) => Number.isSafeInteger(value) && value > 0) ||
		options.maxTokens > options.contextWindow
	) {
		throw new Error("Invalid local model token limits");
	}
	if (options.api !== "openai-completions" && options.api !== "openai-responses")
		throw new Error("Unsupported local model API");
	const credentials = new InMemoryCredentialStore();
	const transportFetch = globalThis.fetch.bind(globalThis);
	let requestCount = 0;
	const guardedFetch: FetchFunction = async (input, init) => {
		const requested = new URL(input instanceof Request ? input.url : input.toString());
		if (requested.origin !== url.origin || requested.username || requested.password)
			throw new Error("Model request is outside the approved endpoint origin");
		const attempt = ++requestCount;
		const startedAt = Date.now();
		const started = performance.now();
		let status: number | null = null;
		let failureCode: string | null = null;
		try {
			const response = await transportFetch(input, { ...init, redirect: "error" });
			status = response.status;
			return response;
		} catch (error) {
			// Fetch wraps native failures in cause. Never copy arbitrary error text or codes.
			let cause: unknown = error;
			for (let depth = 0; depth < 4 && cause && typeof cause === "object"; depth++) {
				if ("code" in cause && typeof cause.code === "string" && transportFailureCodes.has(cause.code)) {
					failureCode = cause.code;
					break;
				}
				cause = "cause" in cause ? cause.cause : undefined;
			}
			throw error;
		} finally {
			try {
				onRequest?.({
					attempt,
					startedAt,
					elapsedMs: performance.now() - started,
					status,
					failureCode,
					aborted: (init?.signal ?? (input instanceof Request ? input.signal : undefined))?.aborted ?? false,
				});
			} catch {
				// A passive observer must not change transport success, failure or retry behavior.
			}
		}
	};
	const api = options.api === "openai-completions" ? openAICompletionsApi() : openAIResponsesApi();
	const guardedApi: ProviderStreams = {
		stream: (model, context, request) =>
			api.stream(model, context, { ...request, fetch: guardedFetch, transport: "sse" }),
		streamSimple: (model, context, request) =>
			api.streamSimple(model, context, { ...request, fetch: guardedFetch, transport: "sse" }),
		...(api.fetchDeferred
			? {
					fetchDeferred: (model, handle, request) =>
						api.fetchDeferred!(model, handle, { ...request, fetch: guardedFetch }),
				}
			: {}),
		...(api.cancelDeferred
			? {
					cancelDeferred: (model, handle, request) =>
						api.cancelDeferred!(model, handle, { ...request, fetch: guardedFetch }),
				}
			: {}),
	};
	await credentials.modify(options.provider, async () => ({
		type: "api_key",
		key: options.apiKey ?? "pi-workbench-local-no-auth",
	}));
	const runtime = await ModelRuntime.create({
		credentials,
		modelsPath: null,
		allowModelNetwork: false,
		refreshOnCreate: false,
	});
	runtime.registerNativeProvider(
		createProvider({
			id: options.provider,
			api: guardedApi,
			baseUrl: url.toString().replace(/\/$/, ""),
			// Some OpenAI-compatible clients require a non-empty key even for local
			// servers. This fixed public placeholder is never a real credential.
			auth: {
				apiKey: {
					name: "Host memory credential",
					resolve: async ({ credential }) => (credential?.key ? { auth: { apiKey: credential.key } } : undefined),
				},
			},
			models: [
				{
					id: options.id,
					api: options.api,
					provider: options.provider,
					baseUrl: url.toString().replace(/\/$/, ""),
					name: options.id,
					reasoning: options.capabilities?.reasoning ?? false,
					...(thinkingLevelMap ? { thinkingLevelMap: { ...thinkingLevelMap } } : {}),
					input: options.capabilities?.input ?? ["text"],
					cost: options.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
					contextWindow: options.contextWindow,
					maxTokens: options.maxTokens,
				},
			],
		}),
	);
	await runtime.refresh({ allowNetwork: false, providers: [options.provider] });
	knownCosts.set(runtime, new Set(options.cost ? [`${options.provider}/${options.id}`] : []));
	return runtime;
}
