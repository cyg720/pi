/**
 * 文件职责：验证 RPC prompt 命令在预检失败、成功和流式排队时只输出一次语义正确的响应。
 * 技术维度：使用 Vitest、JSONL 输入输出 mock、自定义 EventStream 和真实 AgentSession/RPC 模式装配。
 * 产品维度：保证外部 RPC 客户端能可靠用一次响应判断 prompt 是否接受，不会因异步流产生重复确认。
 * 逻辑维度：mock 标准输出与行读取器，创建可控助手流和运行时宿主，再按三种 prompt 状态检查 JSONL。
 * 关键边界：不写真实 stdout；模型回复由定时器模拟；每个运行时必须中止活动流并删除临时目录。
 * 新手阅读建议：先看 rpcIo 和三个模块 mock，再看 createRuntimeHost/startRpcMode，最后比较三种响应场景。
 */
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Agent } from "@earendil-works/pi-agent-core";
import {
	type AssistantMessage,
	type AssistantMessageEvent,
	EventStream,
	getModel,
	type Model,
} from "@earendil-works/pi-ai/compat";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentSession } from "../src/core/agent-session.ts";
import type { AgentSessionRuntime } from "../src/core/agent-session-runtime.ts";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";
import { runRpcMode } from "../src/modes/rpc/rpc-mode.ts";
import { createModelRegistry, getModelRuntime } from "./model-runtime-test-utils.ts";
import { createTestResourceLoader } from "./utilities.ts";

/** 捕获 RPC 输出行并保存 JSONL 输入回调的共享状态。 */
const rpcIo = vi.hoisted(() => ({
	outputLines: [] as string[],
	lineHandler: undefined as ((line: string) => void) | undefined,
}));

/** 将 RPC 输出守卫替换为内存记录器，避免测试污染真实标准输出。 */
vi.mock("../src/core/output-guard.js", () => ({
	flushRawStdout: vi.fn(async () => {}),
	takeOverStdout: vi.fn(),
	waitForRawStdoutBackpressure: vi.fn(async () => {}),
	writeRawStdout: (line: string) => {
		rpcIo.outputLines.push(line);
	},
}));

/** RPC 主题在非交互测试中不需要真实颜色实现。 */
vi.mock("../src/modes/interactive/theme/theme.js", () => ({ theme: {} }));

/** 捕获 JSONL 行处理器并使用标准 JSON 序列化格式。 */
vi.mock("../src/modes/rpc/jsonl.js", () => ({
	attachJsonlLineReader: vi.fn((_stream: NodeJS.ReadableStream, onLine: (line: string) => void) => {
		rpcIo.lineHandler = onLine;
		return () => {};
	}),
	serializeJsonLine: (value: unknown) => `${JSON.stringify(value)}\n`,
}));

/** 可手工推送助手开始、完成或错误事件的测试流。 */
class MockAssistantStream extends EventStream<AssistantMessageEvent, AssistantMessage> {
	/** 创建以 done/error 为终止事件并提取最终助手消息的流。 */
	constructor() {
		super(
			(event) => event.type === "done" || event.type === "error",
			(event) => {
				if (event.type === "done") return event.message;
				if (event.type === "error") return event.error;
				throw new Error("Unexpected event type");
			},
		);
	}
}

/**
 * 创建固定来源和零用量的助手文本消息。
 * @param text 助手消息正文。
 * @returns Anthropic 测试助手消息。
 * @example createAssistantMessage("done");
 */
function createAssistantMessage(text: string): AssistantMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		api: "anthropic-messages",
		provider: "anthropic",
		model: "claude-sonnet-4-5",
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop",
		timestamp: Date.now(),
	};
}

/** 解析后的任意 RPC JSONL 输出记录。 */
type ParsedOutputLine = Record<string, unknown>;

/**
 * 将可能包含多行的输出片段解析为 JSON 记录。
 * @param outputLines 捕获的原始输出片段。
 * @returns 去空并 JSON.parse 后的记录数组。
 * @example parseOutputLines(rpcIo.outputLines);
 */
function parseOutputLines(outputLines: string[]): ParsedOutputLine[] {
	return outputLines
		.flatMap((line) => line.split("\n"))
		.filter((line) => line.trim().length > 0)
		.map((line) => JSON.parse(line) as ParsedOutputLine);
}

/**
 * 筛选指定请求标识的 prompt 响应。
 * @param outputLines 捕获的 JSONL 输出。
 * @param id 目标 RPC 请求标识。
 * @returns 同时匹配 id、response 类型和 prompt 命令的记录。
 * @example getPromptResponses(lines, "b1");
 */
function getPromptResponses(outputLines: string[], id: string): ParsedOutputLine[] {
	return parseOutputLines(outputLines).filter(
		(record) => record.id === id && record.type === "response" && record.command === "prompt",
	);
}

/**
 * 等待指定时间，供测试让延迟回复完成。
 * @param ms 毫秒数。
 * @returns 到时后完成的 Promise。
 * @example await sleep(10);
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 创建带可控认证和回复延迟的 RPC 运行时宿主。
 * @param options 是否配置认证、回复延迟和可选模型。
 * @returns 运行时宿主及异步清理函数。
 * @example await createRuntimeHost({ withAuth: true, responseDelayMs: 0 });
 */
async function createRuntimeHost(options: { withAuth: boolean; responseDelayMs: number; model?: Model<any> }): Promise<{
	runtimeHost: AgentSessionRuntime;
	cleanup: () => Promise<void>;
}> {
	/** 当前运行时专属临时目录。 */
	const tempDir = join(tmpdir(), `pi-rpc-prompt-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(tempDir, { recursive: true });

	/** 显式传入或默认取得的模型。 */
	const model = options.model ?? getModel("anthropic", "claude-sonnet-4-5");
	if (!model) {
		throw new Error("Test model not found");
	}

	/** 使用可控延迟 MockAssistantStream 的 Agent。 */
	const agent = new Agent({
		getApiKey: () => "test-key",
		initialState: {
			model,
			systemPrompt: "Test",
			tools: [],
		},
		streamFn: (_model, _context, _options) => {
			/** 本次模型调用返回的可推送测试流。 */
			const stream = new MockAssistantStream();
			queueMicrotask(() => {
				stream.push({ type: "start", partial: createAssistantMessage("") });
				setTimeout(() => {
					stream.push({ type: "done", reason: "stop", message: createAssistantMessage("done") });
				}, options.responseDelayMs);
			});
			return stream;
		},
	});

	/** 保存 RPC 会话消息的内存管理器。 */
	const sessionManager = SessionManager.inMemory();
	/** 使用临时目录的设置管理器。 */
	const settingsManager = SettingsManager.create(tempDir, tempDir);
	/** 使用临时 auth.json 的认证存储。 */
	const authStorage = AuthStorage.create(join(tempDir, "auth.json"));
	/** RPC 会话使用的模型注册表。 */
	const modelRegistry = await createModelRegistry(authStorage, tempDir);
	if (options.withAuth) {
		await authStorage.modify("anthropic", async () => ({ type: "api_key", key: "test-key" }));
	}

	/** 交给 RPC 模式的实际 AgentSession。 */
	const session = new AgentSession({
		agent,
		sessionManager,
		settingsManager,
		cwd: tempDir,
		modelRuntime: getModelRuntime(modelRegistry),
		resourceLoader: createTestResourceLoader(),
	});

	/** 只实现 RPC 模式需要成员的运行时宿主替身。 */
	const runtimeHost = {
		session,
		newSession: vi.fn(async () => ({ cancelled: true })),
		switchSession: vi.fn(async () => ({ cancelled: true })),
		fork: vi.fn(async () => ({ cancelled: true, selectedText: "" })),
		dispose: vi.fn(async () => {}),
		setRebindSession: vi.fn(),
	} as unknown as AgentSessionRuntime;

	return {
		runtimeHost,
		cleanup: async () => {
			try {
				if (session.isStreaming) {
					await session.abort();
				}
			} catch {
				// ignore test cleanup failures
				// 清理阶段的中止失败不应覆盖主测试结果。
			}
			session.dispose();
			if (existsSync(tempDir)) {
				rmSync(tempDir, { recursive: true });
			}
		},
	};
}

/**
 * 创建运行时、启动 RPC 模式并等待输入行处理器就绪。
 * @param options 是否配置认证、回复延迟和可选模型。
 * @returns 可发送 JSONL 命令的行处理器与清理函数。
 * @example const rpc = await startRpcMode({ withAuth: true, responseDelayMs: 0 });
 */
async function startRpcMode(options: { withAuth: boolean; responseDelayMs: number; model?: Model<any> }): Promise<{
	lineHandler: (line: string) => void;
	cleanup: () => Promise<void>;
}> {
	rpcIo.outputLines = [];
	rpcIo.lineHandler = undefined;

	/** 新建的 RPC 运行时宿主与清理函数。 */
	const { runtimeHost, cleanup } = await createRuntimeHost(options);
	void runRpcMode(runtimeHost);
	await vi.waitFor(() => expect(rpcIo.lineHandler).toBeDefined());

	return { lineHandler: rpcIo.lineHandler!, cleanup };
}

/** 覆盖 prompt 预检、正常接受和流式排队时的一次性响应语义。 */
describe("RPC prompt response semantics", () => {
	/** 每个用例后清空捕获的输出与输入处理器。 */
	afterEach(() => {
		rpcIo.outputLines = [];
		rpcIo.lineHandler = undefined;
	});

	it("emits one failure response when prompt preflight rejects", async () => {
		/** 未配置目标提供商认证的 RPC 输入与清理函数。 */
		const { lineHandler, cleanup } = await startRpcMode({
			withAuth: false,
			responseDelayMs: 0,
			model: {
				id: "fake-model",
				name: "Fake Model",
				api: "openai-completions",
				provider: "fake-provider",
				baseUrl: "https://example.invalid",
				reasoning: false,
				input: [],
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				contextWindow: 0,
				maxTokens: 0,
			},
		});

		try {
			lineHandler(JSON.stringify({ id: "b1", type: "prompt", message: "Hello" }));

			await vi.waitFor(() => {
				/** 当前等待断言时筛选出的失败响应。 */
				const responses = getPromptResponses(rpcIo.outputLines, "b1");
				expect(responses).toHaveLength(1);
				expect(responses[0]).toMatchObject({
					id: "b1",
					type: "response",
					command: "prompt",
					success: false,
					error: expect.stringContaining(
						"No API key found for fake-provider.\n\nUse /login to log into a provider via OAuth or API key. See:",
					),
				});
			});
		} finally {
			await cleanup();
		}
	});

	it("emits one success response when prompt preflight succeeds", async () => {
		/** 已配置认证且立即回复的 RPC 输入与清理函数。 */
		const { lineHandler, cleanup } = await startRpcMode({ withAuth: true, responseDelayMs: 0 });

		try {
			lineHandler(JSON.stringify({ id: "b2", type: "prompt", message: "Hello" }));

			await vi.waitFor(() => {
				/** 当前等待断言时筛选出的成功响应。 */
				const responses = getPromptResponses(rpcIo.outputLines, "b2");
				expect(responses).toHaveLength(1);
				expect(responses[0]).toMatchObject({
					id: "b2",
					type: "response",
					command: "prompt",
					success: true,
				});
			});
		} finally {
			await cleanup();
		}
	});

	it("emits one success response when prompt is queued during streaming", async () => {
		/** 已配置认证且首轮延迟完成的 RPC 输入与清理函数。 */
		const { lineHandler, cleanup } = await startRpcMode({ withAuth: true, responseDelayMs: 100 });

		try {
			lineHandler(JSON.stringify({ id: "b3-start", type: "prompt", message: "Start" }));
			await vi.waitFor(() => {
				expect(getPromptResponses(rpcIo.outputLines, "b3-start")).toHaveLength(1);
			});

			rpcIo.outputLines = [];
			lineHandler(
				JSON.stringify({
					id: "b3",
					type: "prompt",
					message: "Queue this",
					streamingBehavior: "followUp",
				}),
			);

			await vi.waitFor(() => {
				/** 流式期间排队 prompt 的接受响应。 */
				const responses = getPromptResponses(rpcIo.outputLines, "b3");
				expect(responses).toHaveLength(1);
				expect(responses[0]).toMatchObject({
					id: "b3",
					type: "response",
					command: "prompt",
					success: true,
				});
			});

			await sleep(150);
		} finally {
			await cleanup();
		}
	});
});
