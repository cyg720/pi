#!/usr/bin/env node
/**
 * Live probe for OpenAI Codex Responses websocket-cached mode.
 *
 * Runs a simple tool loop directly against the pi-ai provider source so it does not
 * depend on built dist packages or coding-agent SDK wiring.
 */
/**
 * 文件职责：对 OpenAI Codex Responses 的 websocket-cached 传输执行真实多轮工具循环探测并输出性能统计。
 * 技术维度：直接调用提供商源码、复用 ModelRuntime 认证、构造确定性工具，并读取 WebSocket 调试计数器。
 * 产品维度：帮助维护者确认长会话缓存、连接复用和增量上下文确实生效，降低真实用户的延迟与输入成本。
 * 逻辑维度：解析参数并构造填充提示，逐轮执行“模型—工具—模型”循环，累计用量和耗时后打印传输汇总。
 * 关键边界：这是需要真实凭据和网络的手工探针；默认使用 gpt-5.5；最多允许每轮四次请求，避免异常死循环。
 * 新手阅读建议：先看 Args、buildPrompt 和 deterministicProbeTool，再跟读 main 的单轮循环，最后看统计输出。
 */

import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Type } from "typebox";
import { ModelRuntime } from "../../coding-agent/src/core/model-runtime.ts";
import {
	closeOpenAICodexWebSocketSessions,
	getOpenAICodexWebSocketDebugStats,
	resetOpenAICodexWebSocketDebugStats,
	stream as streamOpenAICodexResponses,
} from "../src/api/openai-codex-responses.ts";
import { getModel } from "../src/compat.ts";
import type { AssistantMessage, Context, Message, Model, Tool, ToolResultMessage, Transport } from "../src/types.ts";

/** 探针允许的推理强度。 */
type ThinkingLevel = "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

/** 命令行参数解析后的探针配置。 */
interface Args {
	turns: number;
	transport: Transport;
	maxTokens: number;
	reasoning: ThinkingLevel;
	sessionId: string;
}

/** 默认执行的用户轮数。 */
const DEFAULT_TURNS = 20;
/** 默认限制的单次模型输出 Token 数。 */
const DEFAULT_MAX_TOKENS = 64;

/** 解析探针命令行选项。参数 argv 不含 node 和脚本路径；返回完整配置。示例：parseArgs(process.argv.slice(2))。 */
function parseArgs(argv: string[]): Args {
	/** 用户轮数，必须由调用者提供合理正整数。 */
	let turns = DEFAULT_TURNS;
	/** 待探测的 Responses 传输模式。 */
	let transport: Transport = "websocket-cached";
	/** 每次请求的最大输出 Token 数。 */
	let maxTokens = DEFAULT_MAX_TOKENS;
	/** 模型推理强度。 */
	let reasoning: ThinkingLevel = "low";
	/** 隔离 WebSocket 与缓存状态的会话标识。 */
	let sessionId = `pi-ai-codex-ws-cached-probe-${Date.now()}`;

	for (let i = 0; i < argv.length; i++) {
		/** 当前正在处理的参数标志。 */
		const arg = argv[i];
		switch (arg) {
			case "--turns":
				turns = Number.parseInt(required(argv[++i], arg), 10);
				break;
			case "--transport": {
				/** --transport 后的候选值。 */
				const value = required(argv[++i], arg);
				if (value !== "sse" && value !== "websocket" && value !== "websocket-cached" && value !== "auto") {
					throw new Error(`Invalid --transport: ${value}`);
				}
				transport = value;
				break;
			}
			case "--max-tokens":
				maxTokens = Number.parseInt(required(argv[++i], arg), 10);
				break;
			case "--reasoning": {
				/** --reasoning 后的候选值。 */
				const value = required(argv[++i], arg);
				if (
					value !== "minimal" &&
					value !== "low" &&
					value !== "medium" &&
					value !== "high" &&
					value !== "xhigh" &&
					value !== "max"
				) {
					throw new Error(`Invalid --reasoning: ${value}`);
				}
				reasoning = value;
				break;
			}
			case "--session-id":
				sessionId = required(argv[++i], arg);
				break;
			case "--help":
				printHelp();
				process.exit(0);
				break;
			default:
				throw new Error(`Unknown argument: ${arg}`);
		}
	}

	return { turns, transport, maxTokens, reasoning, sessionId };
}

/** 确保参数标志后存在取值。返回非空字符串，否则抛错。示例：required(argv[i], "--turns")。 */
function required(value: string | undefined, flag: string): string {
	if (!value) throw new Error(`Missing value for ${flag}`);
	return value;
}

/** 输出探针使用说明，无参数且无返回值。示例：printHelp()。 */
function printHelp(): void {
	console.log(`Usage: node test/codex-websocket-cached-probe.ts [options]

Options:
  --turns <n>          Number of user turns. Default: ${DEFAULT_TURNS}
  --transport <mode>   sse | websocket | websocket-cached | auto. Default: websocket-cached
  --reasoning <level>  minimal | low | medium | high | xhigh | max. Default: low
  --max-tokens <n>     Max output tokens per model request. Default: ${DEFAULT_MAX_TOKENS}
  --session-id <id>    Session id for websocket/cache state
`);
}

/** 构造指定轮次的确定性长提示。参数 turn 为从 1 开始的轮次；返回提示文本。示例：buildPrompt(1)。 */
function buildPrompt(turn: number): string {
	/** 由轮次确定性计算的校验标记。 */
	const marker = `TURN-${String(turn).padStart(2, "0")}-MARKER-${(turn * 17 + 13) % 97}`;
	/** 提示的基础说明和后续填充行。 */
	const lines = [
		"This is an automated OpenAI Codex Responses websocket cache probe.",
		`Task for turn ${turn}: call deterministic_probe exactly once before your final answer.`,
		`Use tool arguments: turn=${turn}, marker=${marker}`,
		`After the tool result arrives, reply exactly: TURN ${turn} OK ${marker}`,
		"The following repeated block is intentional benchmark padding.",
	];
	for (let i = 1; i <= 180; i++) {
		lines.push(
			`Turn ${turn} synthetic record ${String(i).padStart(3, "0")}: alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega.`,
		);
	}
	return lines.join("\n");
}

/** 创建每轮必须调用一次的确定性测试工具。返回 Tool 定义。示例：deterministicProbeTool()。 */
function deterministicProbeTool(): Tool {
	return {
		name: "deterministic_probe",
		description: "Mandatory benchmark tool. Call exactly once with the turn and marker from the user prompt.",
		parameters: Type.Object({
			turn: Type.Number(),
			marker: Type.String(),
		}),
	};
}

/** 将模型工具调用转换为固定成功结果。返回可追加到上下文的工具消息。示例：executeTool(call)。 */
function executeTool(call: Extract<AssistantMessage["content"][number], { type: "toolCall" }>): ToolResultMessage {
	return {
		role: "toolResult",
		toolCallId: call.id,
		toolName: call.name,
		content: [{ type: "text", text: `deterministic_probe_result ${JSON.stringify(call.arguments)} fixed=OK` }],
		details: { fixed: "OK" },
		isError: false,
		timestamp: Date.now(),
	};
}

/** 拼接助手消息中的文本块。返回去除首尾空白的最终文本。示例：textOf(message)。 */
function textOf(message: AssistantMessage): string {
	return message.content
		.filter((block): block is Extract<AssistantMessage["content"][number], { type: "text" }> => block.type === "text")
		.map((block) => block.text)
		.join("\n")
		.trim();
}

/** 计算数值平均值；空数组返回 0。示例：average(elapsed)。 */
function average(values: number[]): number {
	return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

/** 计算最近秩百分位。参数 p 取 0 到 100；空数组返回 0。示例：percentile(elapsed, 95)。 */
function percentile(values: number[], p: number): number {
	if (values.length === 0) return 0;
	/** 升序排列的样本副本，不修改调用方数组。 */
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}

/** 执行完整在线探针并打印逐轮与汇总统计。无返回值。示例：await main()。 */
async function main(): Promise<void> {
	/** 解析完成的运行配置。 */
	const args = parseArgs(process.argv.slice(2));
	/** 目标 Codex 模型定义。 */
	const model = getModel("openai-codex", "gpt-5.5") as Model<"openai-codex-responses"> | undefined;
	if (!model) throw new Error("Model openai-codex/gpt-5.5 not found");
	/** 用命令行上限覆盖 maxTokens 的模型副本。 */
	const modelWithMaxTokens = { ...model, maxTokens: args.maxTokens };
	/** 负责读取 coding-agent 认证的模型运行时。 */
	const modelRuntime = await ModelRuntime.create();
	/** 优先取 Codex 凭据，缺失时回退到普通 OpenAI 凭据。 */
	const apiKey =
		(await modelRuntime.getAuth("openai-codex"))?.auth.apiKey ?? (await modelRuntime.getAuth("openai"))?.auth.apiKey;
	if (!apiKey) {
		throw new Error("No OpenAI Codex API key found in coding-agent auth storage.");
	}
	/** 在所有轮次之间持续增长的模型上下文。 */
	const context: Context = {
		systemPrompt:
			"You are participating in a benchmark. For each benchmark turn, call deterministic_probe exactly once before the final answer. Keep final answers minimal.",
		messages: [],
		tools: [deterministicProbeTool()],
	};
	/** 每个用户轮次从开始到最终文本的耗时毫秒数。 */
	const elapsed: number[] = [];
	resetOpenAICodexWebSocketDebugStats(args.sessionId);

	console.log(`provider openai-codex, model gpt-5.5`);
	console.log(`sessionId ${args.sessionId}`);
	console.log(
		`turns ${args.turns}, transport ${args.transport}, reasoning ${args.reasoning}, maxTokens ${args.maxTokens}`,
	);
	console.log(`scratch ${resolve(join(tmpdir(), args.sessionId))}`);
	console.log("");

	for (let turn = 1; turn <= args.turns; turn++) {
		context.messages.push({ role: "user", content: buildPrompt(turn), timestamp: Date.now() });
		/** 本轮开始前的 WebSocket 累计计数快照。 */
		const beforeStats = getOpenAICodexWebSocketDebugStats(args.sessionId);
		/** 本轮开始时间戳，用于计算端到端耗时。 */
		const started = Date.now();
		/** 本轮模型请求次数，包含工具结果后的继续请求。 */
		let requests = 0;
		/** 本轮收到的助手消息数。 */
		let assistantCount = 0;
		/** 本轮生成并追加的工具结果数。 */
		let toolResults = 0;
		/** 本轮无工具调用的最终助手文本。 */
		let finalText = "";
		/** 本轮累计输入 Token。 */
		let turnInput = 0;
		/** 本轮累计输出 Token。 */
		let turnOutput = 0;
		/** 本轮累计缓存读取 Token。 */
		let turnCacheRead = 0;
		/** 本轮累计缓存写入 Token。 */
		let turnCacheWrite = 0;

		while (true) {
			requests++;
			/** 当前请求得到的完整助手消息。 */
			const message = await streamOpenAICodexResponses(modelWithMaxTokens, context, {
				apiKey,
				sessionId: args.sessionId,
				transport: args.transport,
				reasoningEffort: args.reasoning,
				maxTokens: args.maxTokens,
			}).result();
			assistantCount++;
			context.messages.push(message);
			turnInput += message.usage.input;
			turnOutput += message.usage.output;
			turnCacheRead += message.usage.cacheRead;
			turnCacheWrite += message.usage.cacheWrite;
			/** 当前助手消息中的全部工具调用块。 */
			const toolCalls = message.content.filter(
				(block): block is Extract<AssistantMessage["content"][number], { type: "toolCall" }> =>
					block.type === "toolCall",
			);
			console.log(
				[
					`turn ${String(turn).padStart(2, "0")}.${requests}`,
					`stop ${message.stopReason}`,
					`in ${message.usage.input}`,
					`out ${message.usage.output}`,
					`cache ${message.usage.cacheRead}/${message.usage.cacheWrite}`,
					`tools ${toolCalls.length}`,
				].join(" | "),
			);
			if (message.stopReason === "error" || message.stopReason === "aborted") {
				throw new Error(message.errorMessage ?? `request failed on turn ${turn}.${requests}`);
			}
			if (toolCalls.length === 0) {
				finalText = textOf(message);
				break;
			}
			for (const call of toolCalls) {
				context.messages.push(executeTool(call) as Message);
				toolResults++;
			}
			if (requests > 4) throw new Error(`Too many requests for turn ${turn}`);
		}

		/** 本轮端到端耗时，单位毫秒。 */
		const elapsedMs = Date.now() - started;
		elapsed.push(elapsedMs);
		/** 本轮结束后的 WebSocket 累计计数快照。 */
		const afterStats = getOpenAICodexWebSocketDebugStats(args.sessionId);
		/** 由前后快照差值组成的传输统计文本。 */
		const statLine = afterStats
			? `ws requests ${afterStats.requests - (beforeStats?.requests ?? 0)} | new/reused ${afterStats.connectionsCreated - (beforeStats?.connectionsCreated ?? 0)}/${afterStats.connectionsReused - (beforeStats?.connectionsReused ?? 0)} | cached ${afterStats.cachedContextRequests - (beforeStats?.cachedContextRequests ?? 0)} | store ${afterStats.storeTrueRequests - (beforeStats?.storeTrueRequests ?? 0)} | full/delta ${afterStats.fullContextRequests - (beforeStats?.fullContextRequests ?? 0)}/${afterStats.deltaRequests - (beforeStats?.deltaRequests ?? 0)}`
			: "ws none";
		console.log(
			[
				`turn ${String(turn).padStart(2, "0")} agg`,
				`elapsed ${(elapsedMs / 1000).toFixed(1)}s`,
				`assistant ${assistantCount}`,
				`toolResults ${toolResults}`,
				`in ${turnInput}`,
				`out ${turnOutput}`,
				`cache ${turnCacheRead}/${turnCacheWrite}`,
				statLine,
				`final ${JSON.stringify(finalText).slice(0, 80)}`,
			].join(" | "),
		);
	}

	/** 全部轮次完成后的 WebSocket 最终统计。 */
	const stats = getOpenAICodexWebSocketDebugStats(args.sessionId);
	console.log("");
	console.log(
		[
			"timing",
			`turns ${elapsed.length}`,
			`total ${(elapsed.reduce((sum, value) => sum + value, 0) / 1000).toFixed(1)}s`,
			`avg ${(average(elapsed) / 1000).toFixed(2)}s`,
			`p50 ${(percentile(elapsed, 50) / 1000).toFixed(2)}s`,
			`p95 ${(percentile(elapsed, 95) / 1000).toFixed(2)}s`,
			`max ${(Math.max(...elapsed) / 1000).toFixed(2)}s`,
		].join(" | "),
	);
	console.log(
		[
			"transport summary",
			`requested ${args.transport}`,
			`observed ${stats && stats.requests > 0 ? "websocket" : "sse/no-websocket"}`,
			`storeTrue ${stats ? `${stats.storeTrueRequests}/${stats.requests}` : "0/0"}`,
			`full/delta ${stats ? `${stats.fullContextRequests}/${stats.deltaRequests}` : "0/0"}`,
			`connections created/reused ${stats ? `${stats.connectionsCreated}/${stats.connectionsReused}` : "0/0"}`,
			`lastPreviousResponseId ${stats?.lastPreviousResponseId ?? "n/a"}`,
		].join(" | "),
	);
	closeOpenAICodexWebSocketSessions(args.sessionId);
}

/** 启动探针；顶层异常转为简洁错误文本和非零退出码。 */
main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
