#!/usr/bin/env node
/**
 * Manual SDK probe for OpenAI Codex prompt caching through the tool loop.
 *
 * Runs append-only multi-turn prompting through createAgentSession(), forcing one
 * deterministic custom tool call per top-level user turn. Logs per-subrequest
 * assistant usage so cache-read monotonicity can be inspected inside a tool loop.
 */
/**
 * 文件职责：通过 coding-agent SDK 执行多轮真实 Codex 工具循环，测量提示缓存、时延和 WebSocket 复用。
 * 技术维度：使用 createAgentSession、OpenAI Codex 流、TypeBox 自定义工具、JSONL 会话和调试统计接口。
 * 产品维度：帮助维护者判断长对话工具循环能否稳定复用缓存，并识别 SSE 回退或缓存读取倒退。
 * 逻辑维度：解析参数并构造长提示，注册确定性工具，逐轮执行会话，汇总子请求用量、时延和传输统计。
 * 关键边界：这是会消耗真实凭据和网络配额的手工探针；轮数限制 20 至 50，默认关闭重试和压缩。
 * 新手阅读建议：先读 parseArgs 与 buildPrompt，再看 deterministicProbeTool，最后跟随 main 的逐轮采集和汇总。
 */

import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import {
	type Api,
	type AssistantMessage,
	type AssistantMessageEventStream,
	type Context,
	getModel,
	type Model,
	type SimpleStreamOptions,
	Type,
} from "@earendil-works/pi-ai/compat";
import {
	getOpenAICodexWebSocketDebugStats,
	streamSimple as streamSimpleOpenAICodexResponses,
} from "../../ai/src/api/openai-codex-responses.ts";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { createExtensionRuntime } from "../src/core/extensions/loader.ts";
import type { ToolDefinition } from "../src/core/extensions/types.ts";
import type { ResourceLoader } from "../src/core/resource-loader.ts";
import { createAgentSession } from "../src/core/sdk.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";
import { createModelRegistry, getModelRuntime } from "./model-runtime-test-utils.ts";

/** 探针可选的传输方式；auto 由运行时决定，另外三项明确指定 SSE 或 WebSocket 策略。 */
type Transport = "sse" | "websocket" | "websocket-cached" | "auto";

/** 手工探针的规范化启动参数，供 main 统一消费。 */
interface Args {
	/** 顶层用户回合数，必须位于 MIN_TURNS 与 MAX_TURNS 之间。 */
	turns: number;
	/** 保存会话 JSONL 的绝对文件路径。 */
	sessionPath: string;
	/** 本次探针采用的模型请求传输策略。 */
	transport: Transport;
	/** 单次模型子请求允许生成的最大 Token 数。 */
	maxTokens: number;
}

/** 某一时刻的 WebSocket 调试计数快照，用于比较一轮请求前后的增量。 */
interface WebSocketStatsSnapshot {
	/** 已发出的 WebSocket 请求总数。 */
	requests: number;
	/** 新建连接的累计次数。 */
	connectionsCreated: number;
	/** 复用已有连接的累计次数。 */
	connectionsReused: number;
	/** 使用缓存上下文发起请求的累计次数。 */
	cachedContextRequests: number;
	/** 请求中启用服务端存储的累计次数。 */
	storeTrueRequests: number;
	/** 发送完整上下文的累计次数。 */
	fullContextRequests: number;
	/** 仅发送上下文增量的累计次数。 */
	deltaRequests: number;
}

/** 一次模型子请求的观测记录，包含定位信息、耗时、用量和回复结果。 */
interface SubrequestRecord {
	/** 该子请求所属的顶层用户回合，从 1 开始。 */
	turn: number;
	/** 该回合内的子请求序号，从 1 开始。 */
	subrequest: number;
	/** 整个顶层回合耗时的近似值，单位为毫秒。 */
	elapsedMs: number;
	/** 模型返回的输入、输出及缓存 Token 用量。 */
	usage: AssistantMessage["usage"];
	/** 模型停止生成的原因，例如正常结束或工具调用。 */
	stopReason: AssistantMessage["stopReason"];
	/** 从助手消息中拼接出的纯文本内容。 */
	text: string;
}

/** 默认执行回合数，取允许下限 20。 */
const DEFAULT_TURNS = 20;
/** 允许的最小回合数 20，确保缓存趋势具有样本。 */
const MIN_TURNS = 20;
/** 允许的最大回合数 50，限制真实调用成本。 */
const MAX_TURNS = 50;
/** 每个子请求默认最大输出 Token 数 64。 */
const DEFAULT_MAX_TOKENS = 64;

/** 解析手工探针参数。参数 argv 为命令行数组；返回 Args，非法值抛错。例如：parseArgs(process.argv.slice(2))。 */
function parseArgs(argv: string[]): Args {
	/** 计划执行的顶层用户回合数。 */
	let turns = DEFAULT_TURNS;
	/** 写入 JSONL 会话记录的绝对路径。 */
	let sessionPath = resolve(join(tmpdir(), `pi-sdk-codex-cache-probe-tool-loop-${Date.now()}.jsonl`));
	/** 请求传输模式，支持 sse、websocket、websocket-cached 或 auto。 */
	let transport: Transport = "sse";
	/** 每个模型子请求允许的最大输出 Token 数。 */
	let maxTokens = DEFAULT_MAX_TOKENS;

	// i 为命令行下标，遇到带值选项时会先递增读取 value。
	for (let i = 0; i < argv.length; i++) {
		/** 当前命令行参数。 */
		const arg = argv[i];
		switch (arg) {
			case "--turns": {
				/** 当前带值选项后读取的字符串。 */
				const value = argv[++i];
				if (!value) throw new Error("Missing value for --turns");
				turns = Number.parseInt(value, 10);
				break;
			}
			case "--session": {
				/** 当前带值选项后读取的字符串。 */
				const value = argv[++i];
				if (!value) throw new Error("Missing value for --session");
				sessionPath = resolve(value);
				break;
			}
			case "--transport": {
				/** 当前带值选项后读取的字符串。 */
				const value = argv[++i];
				if (value !== "sse" && value !== "websocket" && value !== "websocket-cached" && value !== "auto") {
					throw new Error(`Invalid --transport value: ${value}`);
				}
				transport = value;
				break;
			}
			case "--max-tokens": {
				/** 当前带值选项后读取的字符串。 */
				const value = argv[++i];
				if (!value) throw new Error("Missing value for --max-tokens");
				maxTokens = Number.parseInt(value, 10);
				break;
			}
			case "--help": {
				printHelp();
				process.exit(0);
				return { turns, sessionPath, transport, maxTokens };
			}
			default:
				throw new Error(`Unknown argument: ${arg}`);
		}
	}

	if (!Number.isInteger(turns) || turns < MIN_TURNS || turns > MAX_TURNS) {
		throw new Error(`--turns must be an integer between ${MIN_TURNS} and ${MAX_TURNS}`);
	}
	if (!Number.isInteger(maxTokens) || maxTokens <= 0) {
		throw new Error("--max-tokens must be a positive integer");
	}

	return { turns, sessionPath, transport, maxTokens };
}

/** 输出命令用法和固定测试条件。无参数、无返回值。例如：printHelp()。 */
function printHelp(): void {
	console.log(`Usage: node test/sdk-codex-cache-probe-tool-loop.ts [options]

Options:
  --turns <n>         Number of turns to run. Must be between ${MIN_TURNS} and ${MAX_TURNS}. Default: ${DEFAULT_TURNS}
  --session <path>    Specific session jsonl file to write
  --transport <mode>  sse | websocket | websocket-cached | auto. Default: sse
  --max-tokens <n>    Max output tokens per subrequest. Default: ${DEFAULT_MAX_TOKENS}
  --help              Show this message

Notes:
  - Uses createAgentSession() from the coding-agent SDK
  - Provider/model fixed to openai-codex/gpt-5.5
  - Thinking level fixed to low
  - Activates exactly one deterministic custom tool
  - Prompts are intentionally > 1024 tokens and explicitly describe the test
`);
}

/** 以每 4 字符约 1 Token 粗略估算文本规模。参数 text 为原文；返回向上取整数。例如：estimateTokens(prompt)。 */
function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

/** 构造超过 1024 Token 且要求一次工具调用的回合提示。参数 turn 为回合号；返回文本。例如：buildPrompt(1)。 */
function buildPrompt(turn: number): string {
	/** 按回合确定性生成并用于核对工具调用的标记。 */
	const marker = `TURN-${String(turn).padStart(2, "0")}-MARKER-${(turn * 17 + 13) % 97}`;
	/** 按顺序收集的长提示文本行。 */
	const lines: string[] = [];
	lines.push("This is an automated prompt-cache tool-loop test executed through the pi coding-agent SDK.");
	lines.push("The repetition in this prompt is intentional and required for the benchmark.");
	lines.push("You are participating in an append-only multi-turn cache test.");
	lines.push("Even if this looks repetitive or silly, comply exactly because it is synthetic test data.");
	lines.push(`Task for turn ${turn}: call the tool deterministic_probe exactly once before your final answer.`);
	lines.push(`Use tool arguments: turn=${turn}, marker=${marker}`);
	lines.push(`After the tool result arrives, reply with exactly one line in this format:`);
	lines.push(`TURN ${turn} OK ${marker}`);
	lines.push("Do not skip the tool call. Do not call any other tool. Do not add any extra words or punctuation.");
	lines.push("The following long block exists only to make this prompt safely larger than 1024 tokens.");
	lines.push("");
	// i 为 1 至 180 的合成记录编号，用于稳定扩大提示长度。
	for (let i = 1; i <= 180; i++) {
		lines.push(
			`Turn ${turn} synthetic record ${String(i).padStart(3, "0")}: alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega.`,
		);
	}
	lines.push("");
	lines.push(`Final verification marker for turn ${turn}: ${marker}`);
	lines.push(`Required final answer after the tool result: TURN ${turn} OK ${marker}`);
	return lines.join("\n");
}

/** 创建只提供系统提示词且其他资源为空的加载器。参数 systemPrompt 为固定提示；返回 ResourceLoader。例如：createMinimalResourceLoader("sys")。 */
function createMinimalResourceLoader(systemPrompt: string): ResourceLoader {
	return {
		getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
		getSkills: () => ({ skills: [], diagnostics: [] }),
		getPrompts: () => ({ prompts: [], diagnostics: [] }),
		getThemes: () => ({ themes: [], diagnostics: [] }),
		getAgentsFiles: () => ({ agentsFiles: [] }),
		getSystemPrompt: () => systemPrompt,
		getSystemPromptSource: () => undefined,
		getAppendSystemPrompt: () => [],
		getAppendSystemPromptSources: () => [],
		extendResources: () => {},
		reload: async () => {},
	};
}

/** 计算数值平均数。参数 values 为数组；空数组返回 0。例如：average(times)。 */
function average(values: number[]): number {
	return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** 计算最近秩百分位。参数 values 为数组、percentileValue 为 0 至 100；返回对应值。例如：percentile(times,95)。 */
function percentile(values: number[], percentileValue: number): number {
	if (values.length === 0) return 0;
	/** 按升序复制的数值数组。 */
	const sorted = [...values].sort((a, b) => a - b);
	/** 目标百分位在已排序数组中的安全下标。 */
	const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1));
	return sorted[index];
}

/** 读取会话 WebSocket 计数并把缺失值补零。参数 sessionId 为会话编号；返回快照。例如：getWebSocketStatsSnapshot(id)。 */
function getWebSocketStatsSnapshot(sessionId: string): WebSocketStatsSnapshot {
	/** 当前会话累计 WebSocket 调试统计。 */
	const stats = getOpenAICodexWebSocketDebugStats(sessionId);
	return {
		requests: stats?.requests ?? 0,
		connectionsCreated: stats?.connectionsCreated ?? 0,
		connectionsReused: stats?.connectionsReused ?? 0,
		cachedContextRequests: stats?.cachedContextRequests ?? 0,
		storeTrueRequests: stats?.storeTrueRequests ?? 0,
		fullContextRequests: stats?.fullContextRequests ?? 0,
		deltaRequests: stats?.deltaRequests ?? 0,
	};
}

/** 计算两份 WebSocket 快照逐字段差值。参数 after 与 before 为快照；返回差值。例如：diffWebSocketStats(after,before)。 */
function diffWebSocketStats(after: WebSocketStatsSnapshot, before: WebSocketStatsSnapshot): WebSocketStatsSnapshot {
	return {
		requests: after.requests - before.requests,
		connectionsCreated: after.connectionsCreated - before.connectionsCreated,
		connectionsReused: after.connectionsReused - before.connectionsReused,
		cachedContextRequests: after.cachedContextRequests - before.cachedContextRequests,
		storeTrueRequests: after.storeTrueRequests - before.storeTrueRequests,
		fullContextRequests: after.fullContextRequests - before.fullContextRequests,
		deltaRequests: after.deltaRequests - before.deltaRequests,
	};
}

/** 格式化单轮 WebSocket 统计。参数 label 为标签、stats 为快照；返回一行文本。例如：formatWebSocketStats("turn 01",stats)。 */
function formatWebSocketStats(label: string, stats: WebSocketStatsSnapshot): string {
	if (stats.requests === 0) return `${label} websocket none`;
	return [
		`${label} websocket`,
		`requests ${stats.requests}`,
		`new/reused ${stats.connectionsCreated}/${stats.connectionsReused}`,
		`cached ${stats.cachedContextRequests}`,
		`store ${stats.storeTrueRequests}`,
		`full/delta ${stats.fullContextRequests}/${stats.deltaRequests}`,
	].join(" | ");
}

/** 合并助手消息中的文本块并去首尾空白。参数 message 为助手消息；返回文本。例如：getAssistantText(message)。 */
function getAssistantText(message: AssistantMessage): string {
	return message.content
		.filter((block): block is Extract<AssistantMessage["content"][number], { type: "text" }> => block.type === "text")
		.map((block) => block.text)
		.join("\n")
		.trim();
}

/** 确定性工具参数的 TypeBox Schema。 */
const deterministicProbeParameters = Type.Object({
	turn: Type.Number({ description: "Top-level benchmark turn number" }),
	marker: Type.String({ description: "Marker string provided by the user" }),
});

/** 创建必须按回合和标记调用一次的确定性工具。无参数；返回 ToolDefinition。例如：deterministicProbeTool()。 */
function deterministicProbeTool(): ToolDefinition<typeof deterministicProbeParameters> {
	return {
		name: "deterministic_probe",
		label: "Deterministic Probe",
		description:
			"Mandatory cache-benchmark tool. Call it exactly once when the user asks for a cache benchmark turn, then use its result to produce the final one-line answer.",
		promptSnippet:
			"deterministic_probe(turn, marker): mandatory for cache benchmark turns. Call exactly once before the final answer.",
		promptGuidelines: [
			"When the user asks for the cache benchmark turn, call deterministic_probe exactly once with the requested turn and marker before responding.",
			"After the tool result arrives, reply with the exact final line requested by the user.",
		],
		parameters: deterministicProbeParameters,
		/** 返回包含回合与标记的固定成功结果。参数为调用编号和已校验 params；返回工具结果 Promise。例如：await tool.execute(id, params, signal)。 */
		execute: async (_toolCallId, params) => ({
			content: [
				{
					type: "text",
					text: `deterministic_probe_result turn=${params.turn} marker=${params.marker} fixed=OK`,
				},
			],
			details: { turn: params.turn, marker: params.marker, fixed: "OK" },
		}),
	};
}

/** 装配真实 SDK 会话、执行全部回合并输出缓存/时延报告。无参数；成功时无返回值。例如：await main()。 */
async function main(): Promise<void> {
	/** 解析并校验后的手工探针命令行参数。 */
	const args = parseArgs(process.argv.slice(2));
	mkdirSync(dirname(args.sessionPath), { recursive: true });

	/** 读取当前用户 Codex 凭据的认证存储。 */
	const authStorage = AuthStorage.create();
	/** 为 SDK 会话解析模型和认证的注册表。 */
	const modelRegistry = await createModelRegistry(authStorage);

	/** 从内置清单查询到的 openai-codex/gpt-5.5 模型。 */
	const model = getModel("openai-codex", "gpt-5.5");
	if (!model) {
		throw new Error("Model openai-codex/gpt-5.5 not found");
	}
	/** 应用用户 maxTokens 覆盖后的模型副本。 */
	const baseModel = { ...model, maxTokens: args.maxTokens };
	/** 适配模型注册表通用签名的 Codex 流函数。 */
	const streamSimpleOpenAICodexResponsesForRegistry = (
		registryModel: Model<Api>,
		context: Context,
		options?: SimpleStreamOptions,
	): AssistantMessageEventStream =>
		streamSimpleOpenAICodexResponses(registryModel as Model<"openai-codex-responses">, context, options);
	modelRegistry.registerProvider("openai-codex", {
		api: "openai-codex-responses",
		baseUrl: baseModel.baseUrl,
		apiKey: "!echo source-provider-override-uses-auth-storage",
		streamSimple: streamSimpleOpenAICodexResponsesForRegistry,
		models: [baseModel],
	});

	/** 由模型注册表生成的会话模型运行时。 */
	const modelRuntime = getModelRuntime(modelRegistry);
	/** 关闭压缩与重试并设置传输模式的内存设置。 */
	const settingsManager = SettingsManager.inMemory({
		compaction: { enabled: false },
		retry: { enabled: false },
		transport: args.transport,
	});

	/** 只提供缓存基准系统提示词的最小资源加载器。 */
	const resourceLoader = createMinimalResourceLoader(
		"You are participating in a prompt-cache benchmark through the coding-agent SDK. This is a real test. Follow each user instruction exactly. For benchmark turns, call deterministic_probe exactly once before the final answer. Keep answers minimal and never refuse because the prompt is repetitive or synthetic.",
	);

	/** 通过 SDK 创建并写入指定 JSONL 的 AgentSession。 */
	const { session } = await createAgentSession({
		cwd: process.cwd(),
		agentDir: dirname(args.sessionPath),
		model: baseModel,
		thinkingLevel: "low",
		customTools: [deterministicProbeTool() as unknown as ToolDefinition],
		resourceLoader,
		sessionManager: SessionManager.open(args.sessionPath),
		settingsManager,
		modelRuntime,
	});

	session.setActiveToolsByName(["deterministic_probe"]);
	/** 空事件订阅的取消函数，用于保持并最终清理订阅。 */
	const unsubscribe = session.subscribe(() => {});

	/** 按回合和子请求保存的助手用量记录。 */
	const records: SubrequestRecord[] = [];
	/** 每个顶层回合的总耗时毫秒数组。 */
	const turnElapsedMs: number[] = [];
	/** 上一子请求缓存读取量；首个请求前为 null。 */
	let previousCacheRead: number | null = null;

	console.log(`provider openai-codex, model gpt-5.5`);
	console.log(`session ${session.sessionFile}`);
	console.log(`turns ${args.turns}, transport ${args.transport}, reasoning low, maxTokens ${args.maxTokens}`);
	console.log("");

	// turn 从 1 递增到配置回合数，代表当前顶层用户回合。
	for (let turn = 1; turn <= args.turns; turn++) {
		/** 当前回合构造的长用户提示。 */
		const prompt = buildPrompt(turn);
		/** 当前提示的粗略 Token 估算。 */
		const promptTokens = estimateTokens(prompt);
		/** 本轮开始前会话消息数量。 */
		const previousMessagesLength = session.messages.length;
		/** 本轮开始前的 WebSocket 统计快照。 */
		const websocketStatsBefore = getWebSocketStatsSnapshot(session.sessionId);
		/** 本轮请求开始的毫秒时间。 */
		const startedAt = Date.now();
		await session.prompt(prompt);
		/** 当前顶层回合完成耗时毫秒。 */
		const elapsedMs = Date.now() - startedAt;
		turnElapsedMs.push(elapsedMs);

		/** 当前回合新追加的全部会话消息。 */
		const newMessages = session.messages.slice(previousMessagesLength);
		/** 当前回合新生成的助手消息。 */
		const assistantMessages = newMessages.filter((message): message is AssistantMessage =>
			Boolean(message && typeof message === "object" && (message as { role?: unknown }).role === "assistant"),
		);
		/** 当前回合新产生的工具结果消息。 */
		const toolResults = newMessages.filter((message) =>
			Boolean(message && typeof message === "object" && (message as { role?: unknown }).role === "toolResult"),
		);

		if (assistantMessages.length < 2 || toolResults.length < 1) {
			throw new Error(
				`Turn ${turn} did not execute the expected tool loop. assistants=${assistantMessages.length} toolResults=${toolResults.length}`,
			);
		}

		/** 当前回合所有子请求输入 Token 合计。 */
		let turnInput = 0;
		/** 当前回合所有子请求输出 Token 合计。 */
		let turnOutput = 0;
		/** 当前回合缓存读取 Token 合计。 */
		let turnCacheRead = 0;
		/** 当前回合缓存写入 Token 合计。 */
		let turnCacheWrite = 0;
		/** 当前回合总 Token 合计。 */
		let turnTotal = 0;

		// i 为当前回合助手子请求下标，从 0 开始。
		for (let i = 0; i < assistantMessages.length; i++) {
			/** 当前子请求对应的助手消息。 */
			const assistant = assistantMessages[i];
			/** 当前子请求写入汇总数组的结构化记录。 */
			const record: SubrequestRecord = {
				turn,
				subrequest: i + 1,
				elapsedMs,
				usage: assistant.usage,
				stopReason: assistant.stopReason,
				text: getAssistantText(assistant),
			};
			records.push(record);

			turnInput += assistant.usage.input;
			turnOutput += assistant.usage.output;
			turnCacheRead += assistant.usage.cacheRead;
			turnCacheWrite += assistant.usage.cacheWrite;
			turnTotal += assistant.usage.totalTokens;

			/** 当前缓存读取量是否不小于上一子请求的可读标记。 */
			const monotonic =
				previousCacheRead === null ? "n/a" : assistant.usage.cacheRead >= previousCacheRead ? "yes" : "NO";
			console.log(
				[
					`turn ${String(turn).padStart(2, "0")}.${i + 1}`,
					`elapsed ${(elapsedMs / 1000).toFixed(1)}s`,
					`prompt~${promptTokens}`,
					`stop ${assistant.stopReason}`,
					`in ${assistant.usage.input}`,
					`out ${assistant.usage.output}`,
					`cache ${assistant.usage.cacheRead}/${assistant.usage.cacheWrite}`,
					`total ${assistant.usage.totalTokens}`,
					`cache>=prev ${monotonic}`,
				].join(" | "),
			);

			if (assistant.stopReason === "error" || assistant.stopReason === "aborted") {
				throw new Error(
					`Turn ${turn}.${i + 1} ended with stopReason=${assistant.stopReason}: ${assistant.errorMessage || "unknown error"}`,
				);
			}
			previousCacheRead = assistant.usage.cacheRead;
		}

		/** 本轮结束后的 WebSocket 统计快照。 */
		const websocketStatsAfter = getWebSocketStatsSnapshot(session.sessionId);
		/** 本轮新增的 WebSocket 请求与复用统计。 */
		const websocketStatsForTurn = diffWebSocketStats(websocketStatsAfter, websocketStatsBefore);
		console.log(
			[
				`turn ${String(turn).padStart(2, "0")} agg`,
				`assistants ${assistantMessages.length}`,
				`toolResults ${toolResults.length}`,
				`in ${turnInput}`,
				`out ${turnOutput}`,
				`cache ${turnCacheRead}/${turnCacheWrite}`,
				`total ${turnTotal}`,
			].join(" | "),
		);
		console.log(formatWebSocketStats(`turn ${String(turn).padStart(2, "0")}`, websocketStatsForTurn));
	}

	/** 缓存读取量相对前一子请求下降的记录列表。 */
	const violations = records
		.map((record, index) => {
			if (index === 0) return null;
			/** 当前记录的前一个子请求记录。 */
			const previous = records[index - 1];
			if (record.usage.cacheRead >= previous.usage.cacheRead) return null;
			return {
				turn: record.turn,
				subrequest: record.subrequest,
				previous: previous.usage.cacheRead,
				current: record.usage.cacheRead,
			};
		})
		.filter((value): value is NonNullable<typeof value> => value !== null);

	/** 全部顶层回合耗时总和。 */
	const totalElapsedMs = turnElapsedMs.reduce((sum, value) => sum + value, 0);
	console.log("");
	console.log(
		[
			"timing",
			`turns ${turnElapsedMs.length}`,
			`total ${(totalElapsedMs / 1000).toFixed(1)}s`,
			`avg ${(average(turnElapsedMs) / 1000).toFixed(2)}s`,
			`p50 ${(percentile(turnElapsedMs, 50) / 1000).toFixed(2)}s`,
			`p95 ${(percentile(turnElapsedMs, 95) / 1000).toFixed(2)}s`,
			`max ${(Math.max(...turnElapsedMs) / 1000).toFixed(2)}s`,
		].join(" | "),
	);
	/** 会话结束时的累计 WebSocket 调试统计。 */
	const websocketStats = getOpenAICodexWebSocketDebugStats(session.sessionId);
	/** 所选传输模式是否期望使用 WebSocket。 */
	const requestedWebsocket =
		args.transport === "websocket" || args.transport === "websocket-cached" || args.transport === "auto";
	/** 调试统计是否实际观察到 WebSocket 请求。 */
	const observedWebsocket = Boolean(websocketStats && websocketStats.requests > 0);
	console.log(
		[
			"transport summary",
			`requested ${args.transport}`,
			`observed ${observedWebsocket ? "websocket" : "sse/no-websocket"}`,
			`sseFallbackSuspected ${requestedWebsocket && !observedWebsocket ? "yes" : "no"}`,
			`cachedContext ${websocketStats?.cachedContextRequests ? "yes" : "no"}`,
			`storeTrue ${websocketStats ? `${websocketStats.storeTrueRequests}/${websocketStats.requests}` : "0/0"}`,
			`delta ${websocketStats ? `${websocketStats.deltaRequests}/${websocketStats.requests}` : "0/0"}`,
			`full ${websocketStats ? `${websocketStats.fullContextRequests}/${websocketStats.requests}` : "0/0"}`,
		].join(" | "),
	);
	if (websocketStats) {
		console.log(
			[
				"websocket details",
				`requests ${websocketStats.requests}`,
				`connections created/reused ${websocketStats.connectionsCreated}/${websocketStats.connectionsReused}`,
				`cachedContext ${websocketStats.cachedContextRequests}`,
				`storeTrue ${websocketStats.storeTrueRequests}`,
				`full/delta ${websocketStats.fullContextRequests}/${websocketStats.deltaRequests}`,
				`lastInputItems ${websocketStats.lastInputItems}`,
				`lastDeltaItems ${websocketStats.lastDeltaInputItems ?? "n/a"}`,
				`lastPreviousResponseId ${websocketStats.lastPreviousResponseId ?? "n/a"}`,
			].join(" | "),
		);
	}
	console.log(`subrequest cache read monotonic: ${violations.length === 0 ? "yes" : "NO"}`);
	if (violations.length > 0) {
		console.log("violations:");
		// violation 依次表示每个缓存读取倒退记录。
		for (const violation of violations) {
			console.log(`  turn ${violation.turn}.${violation.subrequest}: ${violation.previous} -> ${violation.current}`);
		}
	}
	console.log(`session file: ${session.sessionFile}`);

	unsubscribe();
	session.dispose();
}

main().catch((error: unknown) => {
	/** 入口捕获到的错误可读文本。 */
	const message = error instanceof Error ? error.message : String(error);
	console.error(message);
	process.exitCode = 1;
});
