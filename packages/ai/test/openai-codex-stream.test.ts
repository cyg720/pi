/**
 * 文件职责：验证 OpenAI Codex Responses 接口通过 SSE 与 WebSocket 传输时的请求构造、事件解析、缓存续传、超时、重试和压缩行为。
 * 技术维度：使用 Vitest、Web Streams、Fetch/WebSocket 替身、伪 JWT、zstd 压缩解压和可控假定时器模拟完整网络协议。
 * 产品维度：保障 Codex 用户在长连接、会话缓存、服务限流和连接故障下仍能得到正确消息、成本、停止原因及可靠降级。
 * 逻辑维度：先定义令牌和 SSE 构造辅助函数，再覆盖 SSE 基线与请求字段，随后测试 WebSocket 缓存/恢复，最后验证重试延迟和 zstd。
 * 关键边界：测试完全替换网络全局对象并多次切换假时钟；每个用例后必须关闭缓存连接、恢复环境变量和真实定时器。
 * 新手阅读建议：先读 mockToken、decodeCodexRequestBody 和 buildSSEPayload，再看 SSE 基础用例；随后集中阅读 WebSocket 状态机，最后看重试与压缩。
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zstdDecompressSync } from "node:zlib";
import { Type } from "typebox";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	closeOpenAICodexWebSocketSessions,
	getOpenAICodexWebSocketDebugStats,
	resetOpenAICodexWebSocketDebugStats,
	stream as streamOpenAICodexResponses,
	streamSimple as streamSimpleOpenAICodexResponses,
} from "../src/api/openai-codex-responses.ts";
import type { Context, Model } from "../src/types.ts";

/** 常量 originalAgentDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const originalAgentDir = process.env.PI_CODING_AGENT_DIR;

afterEach(() => {
	vi.unstubAllGlobals();
	if (originalAgentDir === undefined) {
		delete process.env.PI_CODING_AGENT_DIR;
	} else {
		process.env.PI_CODING_AGENT_DIR = originalAgentDir;
	}
	closeOpenAICodexWebSocketSessions();
	resetOpenAICodexWebSocketDebugStats();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

/** mockToken 执行当前测试辅助步骤；参数 无 按签名提供输入，返回值供调用方断言。示例：mockToken()。 */
function mockToken(): string {
	/** 常量 payload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const payload = Buffer.from(
		JSON.stringify({ "https://api.openai.com/auth": { chatgpt_account_id: "acc_test" } }),
		"utf8",
	).toString("base64");
	return `aaa.${payload}.bbb`;
}

/** decodeCodexRequestBody 执行当前测试辅助步骤；参数 body 按签名提供输入，返回值供调用方断言。示例：decodeCodexRequestBody(...)。 */
function decodeCodexRequestBody(body: RequestInit["body"] | undefined): Record<string, unknown> | null {
	if (typeof body === "string") {
		return JSON.parse(body) as Record<string, unknown>;
	}
	if (body instanceof Uint8Array) {
		return JSON.parse(Buffer.from(zstdDecompressSync(body)).toString("utf8")) as Record<string, unknown>;
	}
	return null;
}

/** buildSSEPayload 执行当前测试辅助步骤；参数 { 按签名提供输入，返回值供调用方断言。示例：buildSSEPayload(...)。 */
function buildSSEPayload({
	status,
	includeDone = false,
}: {
	status: "completed" | "incomplete";
	includeDone?: boolean;
}): string {
	/** 常量 terminalType 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const terminalType = status === "incomplete" ? "response.incomplete" : "response.completed";
	/** 常量 events 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const events = [
		`data: ${JSON.stringify({
			type: "response.output_item.added",
			item: { type: "message", id: "msg_1", role: "assistant", status: "in_progress", content: [] },
		})}`,
		`data: ${JSON.stringify({ type: "response.content_part.added", part: { type: "output_text", text: "" } })}`,
		`data: ${JSON.stringify({ type: "response.output_text.delta", delta: "Hello" })}`,
		`data: ${JSON.stringify({
			type: "response.output_item.done",
			item: {
				type: "message",
				id: "msg_1",
				role: "assistant",
				status: "completed",
				content: [{ type: "output_text", text: "Hello" }],
			},
		})}`,
		`data: ${JSON.stringify({
			type: terminalType,
			response: {
				status,
				incomplete_details: status === "incomplete" ? { reason: "max_output_tokens" } : null,
				usage: {
					input_tokens: 5,
					output_tokens: 3,
					total_tokens: 8,
					input_tokens_details: { cached_tokens: 0 },
				},
			},
		})}`,
	];

	if (includeDone) {
		events.push("data: [DONE]");
	}

	return `${events.join("\n\n")}\n\n`;
}

// 用例分组：集中验证“openai-codex streaming”相关功能。
describe("openai-codex streaming", () => {
	// 测试场景：验证“streams SSE responses into AssistantMessageEventStream”对应的行为、结果与边界。
	it("streams SSE responses into AssistantMessageEventStream", async () => {
		/** 常量 tempDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tempDir = mkdtempSync(join(tmpdir(), "pi-codex-stream-"));
		process.env.PI_CODING_AGENT_DIR = tempDir;

		/** 常量 payload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const payload = Buffer.from(
			JSON.stringify({ "https://api.openai.com/auth": { chatgpt_account_id: "acc_test" } }),
			"utf8",
		).toString("base64");
		/** 常量 token 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const token = `aaa.${payload}.bbb`;

		/** 常量 sse 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const sse = `${[
			`data: ${JSON.stringify({
				type: "response.output_item.added",
				item: { type: "message", id: "msg_1", role: "assistant", status: "in_progress", content: [] },
			})}`,
			`data: ${JSON.stringify({ type: "response.content_part.added", part: { type: "output_text", text: "" } })}`,
			`data: ${JSON.stringify({ type: "response.output_text.delta", delta: "Hello" })}`,
			`data: ${JSON.stringify({
				type: "response.output_item.done",
				item: {
					type: "message",
					id: "msg_1",
					role: "assistant",
					status: "completed",
					content: [{ type: "output_text", text: "Hello" }],
				},
			})}`,
			`data: ${JSON.stringify({
				type: "response.completed",
				response: {
					status: "completed",
					usage: {
						input_tokens: 5,
						output_tokens: 3,
						total_tokens: 8,
						input_tokens_details: { cached_tokens: 0 },
					},
				},
			})}`,
		].join("\n\n")}\n\n`;

		/** 常量 encoder 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const encoder = new TextEncoder();
		/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(encoder.encode(sse));
				controller.close();
			},
		});

		/** 常量 fetchMock 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
			/** 常量 url 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const url = typeof input === "string" ? input : input.toString();
			if (url === "https://api.github.com/repos/openai/codex/releases/latest") {
				return new Response(JSON.stringify({ tag_name: "rust-v0.0.0" }), { status: 200 });
			}
			if (url.startsWith("https://raw.githubusercontent.com/openai/codex/")) {
				return new Response("PROMPT", { status: 200, headers: { etag: '"etag"' } });
			}
			if (url === "https://chatgpt.com/backend-api/codex/responses") {
				/** 常量 headers 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const headers = init?.headers instanceof Headers ? init.headers : undefined;
				expect(headers?.get("Authorization")).toBe(`Bearer ${token}`);
				expect(headers?.get("chatgpt-account-id")).toBe("acc_test");
				expect(headers?.get("OpenAI-Beta")).toBe("responses=experimental");
				expect(headers?.get("originator")).toBe("pi");
				expect(headers?.get("accept")).toBe("text/event-stream");
				expect(headers?.has("x-api-key")).toBe(false);
				return new Response(stream, {
					status: 200,
					headers: { "content-type": "text/event-stream" },
				});
			}
			return new Response("not found", { status: 404 });
		});

		vi.stubGlobal("fetch", fetchMock);

		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model: Model<"openai-codex-responses"> = {
			id: "gpt-5.1-codex",
			name: "GPT-5.1 Codex",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: "https://chatgpt.com/backend-api",
			reasoning: true,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 400000,
			maxTokens: 128000,
		};

		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: Context = {
			systemPrompt: "You are a helpful assistant.",
			messages: [{ role: "user", content: "Say hello", timestamp: Date.now() }],
		};

		/** 常量 streamResult 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const streamResult = streamOpenAICodexResponses(model, context, { apiKey: token, transport: "sse" });
		/** 变量 sawTextDelta 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let sawTextDelta = false;
		/** 变量 sawDone 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let sawDone = false;

		for await (const event of streamResult) {
			if (event.type === "text_delta") {
				sawTextDelta = true;
			}
			if (event.type === "done") {
				sawDone = true;
				expect(event.message.content.find((c) => c.type === "text")?.text).toBe("Hello");
			}
		}

		expect(sawTextDelta).toBe(true);
		expect(sawDone).toBe(true);
	});

	// 测试场景：验证“completes after response.completed even when the SSE body stays open”对应的行为、结果与边界。
	it("completes after response.completed even when the SSE body stays open", async () => {
		/** 常量 tempDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tempDir = mkdtempSync(join(tmpdir(), "pi-codex-stream-"));
		process.env.PI_CODING_AGENT_DIR = tempDir;
		/** 常量 token 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const token = mockToken();
		/** 常量 encoder 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const encoder = new TextEncoder();
		/** 常量 sse 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const sse = buildSSEPayload({ status: "completed", includeDone: true });

		/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(encoder.encode(sse));
			},
		});

		/** 常量 fetchMock 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fetchMock = vi.fn(async (input: string | URL) => {
			/** 常量 url 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const url = typeof input === "string" ? input : input.toString();
			if (url === "https://api.github.com/repos/openai/codex/releases/latest") {
				return new Response(JSON.stringify({ tag_name: "rust-v0.0.0" }), { status: 200 });
			}
			if (url.startsWith("https://raw.githubusercontent.com/openai/codex/")) {
				return new Response("PROMPT", { status: 200, headers: { etag: '"etag"' } });
			}
			if (url === "https://chatgpt.com/backend-api/codex/responses") {
				return new Response(stream, {
					status: 200,
					headers: { "content-type": "text/event-stream" },
				});
			}
			return new Response("not found", { status: 404 });
		});
		vi.stubGlobal("fetch", fetchMock);

		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model: Model<"openai-codex-responses"> = {
			id: "gpt-5.1-codex",
			name: "GPT-5.1 Codex",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: "https://chatgpt.com/backend-api",
			reasoning: true,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 400000,
			maxTokens: 128000,
		};

		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: Context = {
			systemPrompt: "You are a helpful assistant.",
			messages: [{ role: "user", content: "Say hello", timestamp: Date.now() }],
		};

		/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const result = await Promise.race([
			streamOpenAICodexResponses(model, context, { apiKey: token, transport: "sse" }).result(),
			new Promise<never>((_, reject) => {
				setTimeout(() => reject(new Error("Timed out waiting for completed SSE stream")), 1000);
			}),
		]);

		expect(result.content.find((c) => c.type === "text")?.text).toBe("Hello");
		expect(result.stopReason).toBe("stop");
	});

	// 测试场景：验证“maps response.incomplete to stopReason length even when the SSE body stays open”对应的行为、结果与边界。
	it("maps response.incomplete to stopReason length even when the SSE body stays open", async () => {
		/** 常量 tempDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tempDir = mkdtempSync(join(tmpdir(), "pi-codex-stream-"));
		process.env.PI_CODING_AGENT_DIR = tempDir;
		/** 常量 token 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const token = mockToken();
		/** 常量 encoder 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const encoder = new TextEncoder();
		/** 常量 sse 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const sse = buildSSEPayload({ status: "incomplete" });

		/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(encoder.encode(sse));
			},
		});

		/** 常量 fetchMock 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fetchMock = vi.fn(async (input: string | URL) => {
			/** 常量 url 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const url = typeof input === "string" ? input : input.toString();
			if (url === "https://api.github.com/repos/openai/codex/releases/latest") {
				return new Response(JSON.stringify({ tag_name: "rust-v0.0.0" }), { status: 200 });
			}
			if (url.startsWith("https://raw.githubusercontent.com/openai/codex/")) {
				return new Response("PROMPT", { status: 200, headers: { etag: '"etag"' } });
			}
			if (url === "https://chatgpt.com/backend-api/codex/responses") {
				return new Response(stream, {
					status: 200,
					headers: { "content-type": "text/event-stream" },
				});
			}
			return new Response("not found", { status: 404 });
		});
		vi.stubGlobal("fetch", fetchMock);

		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model: Model<"openai-codex-responses"> = {
			id: "gpt-5.1-codex",
			name: "GPT-5.1 Codex",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: "https://chatgpt.com/backend-api",
			reasoning: true,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 400000,
			maxTokens: 128000,
		};

		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: Context = {
			systemPrompt: "You are a helpful assistant.",
			messages: [{ role: "user", content: "Say hello", timestamp: Date.now() }],
		};

		/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const result = await Promise.race([
			streamOpenAICodexResponses(model, context, { apiKey: token, transport: "sse" }).result(),
			new Promise<never>((_, reject) => {
				setTimeout(() => reject(new Error("Timed out waiting for incomplete SSE stream")), 1000);
			}),
		]);

		expect(result.content.find((c) => c.type === "text")?.text).toBe("Hello");
		expect(result.stopReason).toBe("length");
	});

	// 测试场景：验证“aborts SSE fetch after the configured HTTP timeout when response headers do not arrive”对应的行为、结果与边界。
	it("aborts SSE fetch after the configured HTTP timeout when response headers do not arrive", async () => {
		/** 常量 token 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const token = mockToken();

		/** 常量 fetchMock 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fetchMock = vi.fn((input: string | URL, init?: RequestInit) => {
			/** 常量 url 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const url = typeof input === "string" ? input : input.toString();
			if (url !== "https://chatgpt.com/backend-api/codex/responses") {
				throw new Error(`Unexpected URL: ${url}`);
			}

			/** 常量 signal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const signal = init?.signal;
			if (!signal) {
				throw new Error("Expected SSE fetch to receive an abort signal");
			}

			return new Promise<Response>((_, reject) => {
				/** onAbort 封装当前回调或辅助步骤；参数 无 提供输入，返回值用于后续流程。示例：onAbort()。 */
				const onAbort = () => {
					/** 常量 reason 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const reason = signal.reason;
					reject(reason instanceof Error ? reason : new Error("SSE fetch aborted"));
				};
				if (signal.aborted) {
					onAbort();
					return;
				}
				signal.addEventListener("abort", onAbort, { once: true });
			});
		});
		vi.stubGlobal("fetch", fetchMock);

		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model: Model<"openai-codex-responses"> = {
			id: "gpt-5.1-codex",
			name: "GPT-5.1 Codex",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: "https://chatgpt.com/backend-api",
			reasoning: true,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 400000,
			maxTokens: 128000,
		};
		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: Context = {
			systemPrompt: "You are a helpful assistant.",
			messages: [{ role: "user", content: "Say hello", timestamp: Date.now() }],
		};

		/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const result = await streamOpenAICodexResponses(model, context, {
			apiKey: token,
			transport: "sse",
			timeoutMs: 10,
		}).result();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(result.stopReason).toBe("error");
		expect(result.errorMessage).toBe("Codex SSE response headers timed out after 10ms");
	});

	// 测试场景：验证“aborts SSE body reads after response headers arrive”对应的行为、结果与边界。
	it("aborts SSE body reads after response headers arrive", async () => {
		/** 常量 token 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const token = mockToken();
		/** 常量 encoder 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const encoder = new TextEncoder();
		/** 常量 timers 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const timers: ReturnType<typeof setTimeout>[] = [];
		/** 变量 cancelled 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let cancelled = false;
		/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				/** enqueue 封装当前回调或辅助步骤；参数 chunk: string 提供输入，返回值用于后续流程。示例：enqueue(...)。 */
				const enqueue = (chunk: string) => {
					if (!cancelled) controller.enqueue(encoder.encode(chunk));
				};
				enqueue(
					`${[
						`data: ${JSON.stringify({
							type: "response.output_item.added",
							item: { type: "message", id: "msg_1", role: "assistant", status: "in_progress", content: [] },
						})}`,
						`data: ${JSON.stringify({ type: "response.content_part.added", part: { type: "output_text", text: "" } })}`,
						`data: ${JSON.stringify({ type: "response.output_text.delta", delta: "one" })}`,
					].join("\n\n")}\n\n`,
				);
				timers.push(
					setTimeout(() => {
						enqueue(`data: ${JSON.stringify({ type: "response.output_text.delta", delta: "two" })}\n\n`);
					}, 10),
				);
				timers.push(
					setTimeout(() => {
						if (cancelled) return;
						enqueue(
							`${[
								`data: ${JSON.stringify({
									type: "response.output_item.done",
									item: {
										type: "message",
										id: "msg_1",
										role: "assistant",
										status: "completed",
										content: [{ type: "output_text", text: "onetwo" }],
									},
								})}`,
								`data: ${JSON.stringify({
									type: "response.completed",
									response: {
										status: "completed",
										usage: {
											input_tokens: 5,
											output_tokens: 3,
											total_tokens: 8,
											input_tokens_details: { cached_tokens: 0 },
										},
									},
								})}`,
							].join("\n\n")}\n\n`,
						);
						controller.close();
					}, 20),
				);
			},
			cancel() {
				cancelled = true;
				/** 循环变量 timer 表示当前遍历项或索引，仅在循环体内有效。 */
				for (const timer of timers) clearTimeout(timer);
			},
		});

		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } })),
		);

		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model: Model<"openai-codex-responses"> = {
			id: "gpt-5.1-codex",
			name: "GPT-5.1 Codex",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: "https://chatgpt.com/backend-api",
			reasoning: true,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 400000,
			maxTokens: 128000,
		};
		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: Context = {
			systemPrompt: "You are a helpful assistant.",
			messages: [{ role: "user", content: "Say hello", timestamp: Date.now() }],
		};
		/** 常量 controller 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const controller = new AbortController();
		/** 常量 events 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const events: string[] = [];

		/** 常量 resultStream 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const resultStream = streamOpenAICodexResponses(model, context, {
			apiKey: token,
			transport: "sse",
			signal: controller.signal,
		});
		for await (const event of resultStream) {
			events.push(event.type === "text_delta" ? `text_delta:${event.delta}` : event.type);
			if (event.type === "text_delta" && event.delta === "one") {
				controller.abort();
			}
		}

		/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const result = await resultStream.result();
		expect(result.stopReason).toBe("aborted");
		expect(result.errorMessage).toBe("Request was aborted");
		expect(events).toContain("text_delta:one");
		expect(events).not.toContain("text_delta:two");
		expect(cancelled).toBe(true);
	});

	// 测试场景：验证“sets session-id/x-client-request-id headers and prompt_cache_key when sessionId is provided”对应的行为、结果与边界。
	it("sets session-id/x-client-request-id headers and prompt_cache_key when sessionId is provided", async () => {
		/** 常量 tempDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tempDir = mkdtempSync(join(tmpdir(), "pi-codex-stream-"));
		process.env.PI_CODING_AGENT_DIR = tempDir;

		/** 常量 payload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const payload = Buffer.from(
			JSON.stringify({ "https://api.openai.com/auth": { chatgpt_account_id: "acc_test" } }),
			"utf8",
		).toString("base64");
		/** 常量 token 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const token = `aaa.${payload}.bbb`;

		/** 常量 sse 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const sse = `${[
			`data: ${JSON.stringify({
				type: "response.output_item.added",
				item: { type: "message", id: "msg_1", role: "assistant", status: "in_progress", content: [] },
			})}`,
			`data: ${JSON.stringify({ type: "response.content_part.added", part: { type: "output_text", text: "" } })}`,
			`data: ${JSON.stringify({ type: "response.output_text.delta", delta: "Hello" })}`,
			`data: ${JSON.stringify({
				type: "response.output_item.done",
				item: {
					type: "message",
					id: "msg_1",
					role: "assistant",
					status: "completed",
					content: [{ type: "output_text", text: "Hello" }],
				},
			})}`,
			`data: ${JSON.stringify({
				type: "response.completed",
				response: {
					status: "completed",
					usage: {
						input_tokens: 5,
						output_tokens: 3,
						total_tokens: 8,
						input_tokens_details: { cached_tokens: 0 },
					},
				},
			})}`,
		].join("\n\n")}\n\n`;

		/** 常量 encoder 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const encoder = new TextEncoder();
		/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(encoder.encode(sse));
				controller.close();
			},
		});

		/** 常量 sessionId 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const sessionId = "test-session-123";
		/** 常量 fetchMock 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
			/** 常量 url 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const url = typeof input === "string" ? input : input.toString();
			if (url === "https://api.github.com/repos/openai/codex/releases/latest") {
				return new Response(JSON.stringify({ tag_name: "rust-v0.0.0" }), { status: 200 });
			}
			if (url.startsWith("https://raw.githubusercontent.com/openai/codex/")) {
				return new Response("PROMPT", { status: 200, headers: { etag: '"etag"' } });
			}
			if (url === "https://chatgpt.com/backend-api/codex/responses") {
				/** 常量 headers 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const headers = init?.headers instanceof Headers ? init.headers : undefined;
				// Verify sessionId is set in headers
				// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
				expect(headers?.get("session-id")).toBe(sessionId);
				expect(headers?.has("session_id")).toBe(false);
				expect(headers?.get("x-client-request-id")).toBe(sessionId);

				// Verify sessionId is set in request body as prompt_cache_key
				// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
				const body = decodeCodexRequestBody(init?.body);
				expect(body?.prompt_cache_key).toBe(sessionId);

				return new Response(stream, {
					status: 200,
					headers: { "content-type": "text/event-stream" },
				});
			}
			return new Response("not found", { status: 404 });
		});

		vi.stubGlobal("fetch", fetchMock);

		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model: Model<"openai-codex-responses"> = {
			id: "gpt-5.1-codex",
			name: "GPT-5.1 Codex",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: "https://chatgpt.com/backend-api",
			reasoning: true,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 400000,
			maxTokens: 128000,
		};

		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: Context = {
			systemPrompt: "You are a helpful assistant.",
			messages: [{ role: "user", content: "Say hello", timestamp: Date.now() }],
		};

		/** 常量 streamResult 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const streamResult = streamOpenAICodexResponses(model, context, { apiKey: token, sessionId, transport: "sse" });
		await streamResult.result();
	});

	// 测试场景：验证“omits SSE cache affinity when cacheRetention is none”对应的行为、结果与边界。
	it("omits SSE cache affinity when cacheRetention is none", async () => {
		/** 常量 token 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const token = mockToken();
		/** 常量 encoder 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const encoder = new TextEncoder();
		/** 变量 capturedHeaders 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let capturedHeaders: Headers | undefined;
		/** 变量 capturedBody 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let capturedBody: Record<string, unknown> | null = null;
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_input: string | URL, init?: RequestInit) => {
				capturedHeaders = init?.headers instanceof Headers ? init.headers : undefined;
				capturedBody = decodeCodexRequestBody(init?.body);
				return new Response(
					new ReadableStream<Uint8Array>({
						start(controller) {
							controller.enqueue(encoder.encode(buildSSEPayload({ status: "completed" })));
							controller.close();
						},
					}),
					{ status: 200, headers: { "content-type": "text/event-stream" } },
				);
			}),
		);

		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model: Model<"openai-codex-responses"> = {
			id: "gpt-5.1-codex",
			name: "GPT-5.1 Codex",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: "https://chatgpt.com/backend-api",
			reasoning: true,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 400000,
			maxTokens: 128000,
		};
		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: Context = {
			systemPrompt: "You are a helpful assistant.",
			messages: [{ role: "user", content: "Say hello", timestamp: Date.now() }],
		};

		await streamOpenAICodexResponses(model, context, {
			apiKey: token,
			cacheRetention: "none",
			sessionId: "one-off-summary",
			transport: "sse",
		}).result();

		expect(capturedHeaders?.has("session-id")).toBe(false);
		expect(capturedHeaders?.has("x-client-request-id")).toBe(false);
		expect(capturedBody).not.toHaveProperty("prompt_cache_key");
	});

	// 测试场景：验证“clamps prompt_cache_key to OpenAI”对应的行为、结果与边界。
	it("clamps prompt_cache_key to OpenAI's 64-character limit", async () => {
		/** 常量 token 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const token = mockToken();
		/** 常量 sessionId 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const sessionId = "x".repeat(67);
		/** 变量 capturedPayload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let capturedPayload: { prompt_cache_key?: string } | undefined;
		/** 常量 encoder 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const encoder = new TextEncoder();
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						new ReadableStream<Uint8Array>({
							start(controller) {
								controller.enqueue(encoder.encode(buildSSEPayload({ status: "completed" })));
								controller.close();
							},
						}),
						{ status: 200, headers: { "content-type": "text/event-stream" } },
					),
			),
		);

		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model: Model<"openai-codex-responses"> = {
			id: "gpt-5.1-codex",
			name: "GPT-5.1 Codex",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: "https://chatgpt.com/backend-api",
			reasoning: true,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 400000,
			maxTokens: 128000,
		};
		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: Context = {
			systemPrompt: "You are a helpful assistant.",
			messages: [{ role: "user", content: "Say hello", timestamp: Date.now() }],
		};

		await streamOpenAICodexResponses(model, context, {
			apiKey: token,
			transport: "sse",
			sessionId,
			onPayload: (payload) => {
				capturedPayload = payload as { prompt_cache_key?: string };
			},
		}).result();

		expect(capturedPayload?.prompt_cache_key).toBe("x".repeat(64));
	});

	// 测试场景：验证“clamps Codex session-id header to 64 characters”对应的行为、结果与边界。
	it("clamps Codex session-id header to 64 characters", async () => {
		/** 常量 token 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const token = mockToken();
		/** 常量 sessionId 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const sessionId = "x".repeat(67);
		/** 变量 capturedHeaders 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let capturedHeaders: Headers | undefined;
		/** 常量 encoder 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const encoder = new TextEncoder();
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_input: string | URL, init?: RequestInit) => {
				capturedHeaders = init?.headers instanceof Headers ? init.headers : undefined;
				return new Response(
					new ReadableStream<Uint8Array>({
						start(controller) {
							controller.enqueue(encoder.encode(buildSSEPayload({ status: "completed" })));
							controller.close();
						},
					}),
					{ status: 200, headers: { "content-type": "text/event-stream" } },
				);
			}),
		);

		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model: Model<"openai-codex-responses"> = {
			id: "gpt-5.1-codex",
			name: "GPT-5.1 Codex",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: "https://chatgpt.com/backend-api",
			reasoning: true,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 400000,
			maxTokens: 128000,
		};
		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: Context = {
			systemPrompt: "You are a helpful assistant.",
			messages: [{ role: "user", content: "Say hello", timestamp: Date.now() }],
		};

		await streamOpenAICodexResponses(model, context, {
			apiKey: token,
			transport: "sse",
			sessionId,
		}).result();

		expect(capturedHeaders?.get("session-id")).toBe("x".repeat(64));
		expect(capturedHeaders?.get("x-client-request-id")).toBe("x".repeat(64));
	});

	// 测试场景：验证“preserves gpt-5.5 xhigh reasoning effort from simple options”对应的行为、结果与边界。
	it("preserves gpt-5.5 xhigh reasoning effort from simple options", async () => {
		/** 常量 tempDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tempDir = mkdtempSync(join(tmpdir(), "pi-codex-stream-"));
		process.env.PI_CODING_AGENT_DIR = tempDir;
		/** 常量 token 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const token = mockToken();
		/** 常量 sse 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const sse = buildSSEPayload({ status: "completed" });
		/** 常量 encoder 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const encoder = new TextEncoder();
		/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(encoder.encode(sse));
				controller.close();
			},
		});
		/** 变量 requestedReasoning 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let requestedReasoning: unknown;

		/** 常量 fetchMock 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
			/** 常量 url 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const url = typeof input === "string" ? input : input.toString();
			if (url === "https://api.github.com/repos/openai/codex/releases/latest") {
				return new Response(JSON.stringify({ tag_name: "rust-v0.0.0" }), { status: 200 });
			}
			if (url.startsWith("https://raw.githubusercontent.com/openai/codex/")) {
				return new Response("PROMPT", { status: 200, headers: { etag: '"etag"' } });
			}
			if (url === "https://chatgpt.com/backend-api/codex/responses") {
				/** 常量 body 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const body = decodeCodexRequestBody(init?.body);
				requestedReasoning = body?.reasoning;
				return new Response(stream, {
					status: 200,
					headers: { "content-type": "text/event-stream" },
				});
			}
			return new Response("not found", { status: 404 });
		});
		vi.stubGlobal("fetch", fetchMock);

		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model: Model<"openai-codex-responses"> = {
			id: "gpt-5.5",
			name: "GPT-5.5",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: "https://chatgpt.com/backend-api",
			reasoning: true,
			thinkingLevelMap: { xhigh: "xhigh" },
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 400000,
			maxTokens: 128000,
		};
		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: Context = {
			systemPrompt: "You are a helpful assistant.",
			messages: [{ role: "user", content: "Say hello", timestamp: Date.now() }],
		};

		await streamSimpleOpenAICodexResponses(model, context, {
			apiKey: token,
			reasoning: "xhigh",
			transport: "sse",
		}).result();

		expect(requestedReasoning).toEqual({ effort: "xhigh", summary: "auto" });
	});

	// 测试场景：验证“forwards required tool choice”对应的行为、结果与边界。
	it("forwards required tool choice", async () => {
		/** 常量 token 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const token = mockToken();
		/** 常量 encoder 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const encoder = new TextEncoder();
		/** 常量 sse 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const sse = buildSSEPayload({ status: "completed" });
		/** 变量 requestedToolChoice 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let requestedToolChoice: unknown;

		vi.stubGlobal(
			"fetch",
			vi.fn(async (_input: string | URL, init?: RequestInit) => {
				requestedToolChoice = decodeCodexRequestBody(init?.body)?.tool_choice;
				return new Response(
					new ReadableStream<Uint8Array>({
						start(controller) {
							controller.enqueue(encoder.encode(sse));
							controller.close();
						},
					}),
					{ status: 200, headers: { "content-type": "text/event-stream" } },
				);
			}),
		);

		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model: Model<"openai-codex-responses"> = {
			id: "gpt-5.5",
			name: "GPT-5.5",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: "https://chatgpt.com/backend-api",
			reasoning: true,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 400000,
			maxTokens: 128000,
		};

		await streamOpenAICodexResponses(
			model,
			{
				messages: [
					{ role: "user", content: "Do not call ping. Respond with text instead.", timestamp: Date.now() },
				],
				tools: [
					{
						name: "ping",
						description: "Ping",
						parameters: Type.Object({ value: Type.String() }),
					},
				],
			},
			{ apiKey: token, transport: "sse", toolChoice: "required" },
		).result();

		expect(requestedToolChoice).toBe("required");
	});

	// 测试场景：验证“sets Codex strict mode explicitly and honors constrained sampling”对应的行为、结果与边界。
	it("sets Codex strict mode explicitly and honors constrained sampling", async () => {
		/** 常量 token 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const token = mockToken();
		/** 常量 encoder 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const encoder = new TextEncoder();
		/** 常量 sse 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const sse = buildSSEPayload({ status: "completed" });
		/** 变量 requestedTools 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let requestedTools: Array<{ type?: string; name?: string; strict?: boolean | null }> | undefined;

		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						new ReadableStream<Uint8Array>({
							start(controller) {
								controller.enqueue(encoder.encode(sse));
								controller.close();
							},
						}),
						{ status: 200, headers: { "content-type": "text/event-stream" } },
					),
			),
		);

		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model: Model<"openai-codex-responses"> = {
			id: "gpt-5.5",
			name: "GPT-5.5",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: "https://chatgpt.com/backend-api",
			reasoning: true,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 400000,
			maxTokens: 128000,
		};

		await streamOpenAICodexResponses(
			model,
			{
				messages: [{ role: "user", content: "Use a tool", timestamp: Date.now() }],
				tools: [
					{
						name: "optional",
						description: "Optional constrained sampling",
						parameters: Type.Object({ value: Type.String() }),
						constrainedSampling: false,
					},
					{
						name: "strict",
						description: "Strict constrained sampling",
						parameters: Type.Object({ value: Type.String() }, { additionalProperties: false }),
						constrainedSampling: { type: "json_schema", strict: "prefer" },
					},
				],
			},
			{
				apiKey: token,
				transport: "sse",
				onPayload: (payload) => {
					requestedTools = (payload as { tools?: typeof requestedTools }).tools;
				},
			},
		).result();

		expect(requestedTools).toMatchObject([
			{ type: "function", name: "optional", strict: null },
			{ type: "function", name: "strict", strict: true },
		]);
	});

	it.each(["gpt-5.3-codex", "gpt-5.4", "gpt-5.5"])("clamps %s minimal reasoning effort to low", async (modelId) => {
		/** 常量 tempDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tempDir = mkdtempSync(join(tmpdir(), "pi-codex-stream-"));
		process.env.PI_CODING_AGENT_DIR = tempDir;

		/** 常量 payload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const payload = Buffer.from(
			JSON.stringify({ "https://api.openai.com/auth": { chatgpt_account_id: "acc_test" } }),
			"utf8",
		).toString("base64");
		/** 常量 token 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const token = `aaa.${payload}.bbb`;

		/** 常量 sse 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const sse = `${[
			`data: ${JSON.stringify({
				type: "response.output_item.added",
				item: { type: "message", id: "msg_1", role: "assistant", status: "in_progress", content: [] },
			})}`,
			`data: ${JSON.stringify({ type: "response.content_part.added", part: { type: "output_text", text: "" } })}`,
			`data: ${JSON.stringify({ type: "response.output_text.delta", delta: "Hello" })}`,
			`data: ${JSON.stringify({
				type: "response.output_item.done",
				item: {
					type: "message",
					id: "msg_1",
					role: "assistant",
					status: "completed",
					content: [{ type: "output_text", text: "Hello" }],
				},
			})}`,
			`data: ${JSON.stringify({
				type: "response.completed",
				response: {
					status: "completed",
					usage: {
						input_tokens: 5,
						output_tokens: 3,
						total_tokens: 8,
						input_tokens_details: { cached_tokens: 0 },
					},
				},
			})}`,
		].join("\n\n")}\n\n`;

		/** 变量 requestedReasoning 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let requestedReasoning: unknown;
		/** 常量 encoder 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const encoder = new TextEncoder();
		/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(encoder.encode(sse));
				controller.close();
			},
		});

		/** 常量 fetchMock 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
			/** 常量 url 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const url = typeof input === "string" ? input : input.toString();
			if (url === "https://api.github.com/repos/openai/codex/releases/latest") {
				return new Response(JSON.stringify({ tag_name: "rust-v0.0.0" }), { status: 200 });
			}
			if (url.startsWith("https://raw.githubusercontent.com/openai/codex/")) {
				return new Response("PROMPT", { status: 200, headers: { etag: '"etag"' } });
			}
			if (url === "https://chatgpt.com/backend-api/codex/responses") {
				/** 常量 body 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const body = decodeCodexRequestBody(init?.body);
				requestedReasoning = body?.reasoning;

				return new Response(stream, {
					status: 200,
					headers: { "content-type": "text/event-stream" },
				});
			}
			return new Response("not found", { status: 404 });
		});

		vi.stubGlobal("fetch", fetchMock);

		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model: Model<"openai-codex-responses"> = {
			id: modelId,
			name: modelId,
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: "https://chatgpt.com/backend-api",
			reasoning: true,
			thinkingLevelMap: { minimal: "low" },
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 400000,
			maxTokens: 128000,
		};

		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: Context = {
			systemPrompt: "You are a helpful assistant.",
			messages: [{ role: "user", content: "Say hello", timestamp: Date.now() }],
		};

		/** 常量 streamResult 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const streamResult = streamOpenAICodexResponses(model, context, {
			apiKey: token,
			reasoningEffort: "minimal",
			transport: "sse",
		});
		await streamResult.result();
		expect(requestedReasoning).toEqual({ effort: "low", summary: "auto" });
	});

	it.each([
		["gpt-5.1-codex", "flex", 0.5],
		["gpt-5.1-codex", "priority", 2],
		["gpt-5.5", "flex", 0.5],
		["gpt-5.5", "priority", 2.5],
	] as const)(
		"uses the client-sent %s service tier for %s when Codex echoes default",
		async (modelId, serviceTier, multiplier) => {
			/** 常量 tempDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tempDir = mkdtempSync(join(tmpdir(), "pi-codex-stream-"));
			process.env.PI_CODING_AGENT_DIR = tempDir;
			/** 常量 token 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const token = mockToken();
			/** 常量 sse 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const sse = `${[
				`data: ${JSON.stringify({
					type: "response.output_item.added",
					item: { type: "message", id: "msg_1", role: "assistant", status: "in_progress", content: [] },
				})}`,
				`data: ${JSON.stringify({ type: "response.content_part.added", part: { type: "output_text", text: "" } })}`,
				`data: ${JSON.stringify({ type: "response.output_text.delta", delta: "Hello" })}`,
				`data: ${JSON.stringify({
					type: "response.output_item.done",
					item: {
						type: "message",
						id: "msg_1",
						role: "assistant",
						status: "completed",
						content: [{ type: "output_text", text: "Hello" }],
					},
				})}`,
				`data: ${JSON.stringify({
					type: "response.completed",
					response: {
						status: "completed",
						service_tier: "default",
						usage: {
							input_tokens: 1000000,
							output_tokens: 1000000,
							total_tokens: 2000000,
							input_tokens_details: { cached_tokens: 0 },
						},
					},
				})}`,
			].join("\n\n")}\n\n`;

			/** 常量 encoder 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const encoder = new TextEncoder();
			/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const stream = new ReadableStream<Uint8Array>({
				start(controller) {
					controller.enqueue(encoder.encode(sse));
					controller.close();
				},
			});

			/** 常量 fetchMock 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const fetchMock = vi.fn(async (input: string | URL) => {
				/** 常量 url 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const url = typeof input === "string" ? input : input.toString();
				if (url === "https://api.github.com/repos/openai/codex/releases/latest") {
					return new Response(JSON.stringify({ tag_name: "rust-v0.0.0" }), { status: 200 });
				}
				if (url.startsWith("https://raw.githubusercontent.com/openai/codex/")) {
					return new Response("PROMPT", { status: 200, headers: { etag: '"etag"' } });
				}
				if (url === "https://chatgpt.com/backend-api/codex/responses") {
					return new Response(stream, {
						status: 200,
						headers: { "content-type": "text/event-stream" },
					});
				}
				return new Response("not found", { status: 404 });
			});
			vi.stubGlobal("fetch", fetchMock);

			/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const model: Model<"openai-codex-responses"> = {
				id: modelId,
				name: modelId === "gpt-5.5" ? "GPT-5.5" : "GPT-5.1 Codex",
				api: "openai-codex-responses",
				provider: "openai-codex",
				baseUrl: "https://chatgpt.com/backend-api",
				reasoning: true,
				input: ["text"],
				cost: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 },
				contextWindow: 400000,
				maxTokens: 128000,
			};

			/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const context: Context = {
				systemPrompt: "You are a helpful assistant.",
				messages: [{ role: "user", content: "Say hello", timestamp: Date.now() }],
			};

			/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const result = await streamOpenAICodexResponses(model, context, {
				apiKey: token,
				serviceTier,
				transport: "sse",
			}).result();

			expect(result.usage.cost.input).toBe(1 * multiplier);
			expect(result.usage.cost.output).toBe(2 * multiplier);
			expect(result.usage.cost.total).toBe(3 * multiplier);
		},
	);

	// 测试场景：验证“does not set session-id/x-client-request-id headers when sessionId is not provided”对应的行为、结果与边界。
	it("does not set session-id/x-client-request-id headers when sessionId is not provided", async () => {
		/** 常量 tempDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const tempDir = mkdtempSync(join(tmpdir(), "pi-codex-stream-"));
		process.env.PI_CODING_AGENT_DIR = tempDir;

		/** 常量 payload 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const payload = Buffer.from(
			JSON.stringify({ "https://api.openai.com/auth": { chatgpt_account_id: "acc_test" } }),
			"utf8",
		).toString("base64");
		/** 常量 token 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const token = `aaa.${payload}.bbb`;

		/** 常量 sse 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const sse = `${[
			`data: ${JSON.stringify({
				type: "response.output_item.added",
				item: { type: "message", id: "msg_1", role: "assistant", status: "in_progress", content: [] },
			})}`,
			`data: ${JSON.stringify({ type: "response.content_part.added", part: { type: "output_text", text: "" } })}`,
			`data: ${JSON.stringify({ type: "response.output_text.delta", delta: "Hello" })}`,
			`data: ${JSON.stringify({
				type: "response.output_item.done",
				item: {
					type: "message",
					id: "msg_1",
					role: "assistant",
					status: "completed",
					content: [{ type: "output_text", text: "Hello" }],
				},
			})}`,
			`data: ${JSON.stringify({
				type: "response.completed",
				response: {
					status: "completed",
					usage: {
						input_tokens: 5,
						output_tokens: 3,
						total_tokens: 8,
						input_tokens_details: { cached_tokens: 0 },
					},
				},
			})}`,
		].join("\n\n")}\n\n`;

		/** 常量 encoder 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const encoder = new TextEncoder();
		/** 常量 stream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(encoder.encode(sse));
				controller.close();
			},
		});

		/** 常量 fetchMock 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
			/** 常量 url 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const url = typeof input === "string" ? input : input.toString();
			if (url === "https://api.github.com/repos/openai/codex/releases/latest") {
				return new Response(JSON.stringify({ tag_name: "rust-v0.0.0" }), { status: 200 });
			}
			if (url.startsWith("https://raw.githubusercontent.com/openai/codex/")) {
				return new Response("PROMPT", { status: 200, headers: { etag: '"etag"' } });
			}
			if (url === "https://chatgpt.com/backend-api/codex/responses") {
				/** 常量 headers 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const headers = init?.headers instanceof Headers ? init.headers : undefined;
				// Verify headers are not set when sessionId is not provided
				// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
				expect(headers?.has("session-id")).toBe(false);
				expect(headers?.has("session_id")).toBe(false);
				expect(headers?.has("x-client-request-id")).toBe(false);

				return new Response(stream, {
					status: 200,
					headers: { "content-type": "text/event-stream" },
				});
			}
			return new Response("not found", { status: 404 });
		});

		vi.stubGlobal("fetch", fetchMock);

		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model: Model<"openai-codex-responses"> = {
			id: "gpt-5.1-codex",
			name: "GPT-5.1 Codex",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: "https://chatgpt.com/backend-api",
			reasoning: true,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 400000,
			maxTokens: 128000,
		};

		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: Context = {
			systemPrompt: "You are a helpful assistant.",
			messages: [{ role: "user", content: "Say hello", timestamp: Date.now() }],
		};

		// No sessionId provided
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		const streamResult = streamOpenAICodexResponses(model, context, { apiKey: token, transport: "sse" });
		await streamResult.result();
	});
	// 测试场景：验证“forwards auto transport from streamSimple options and uses cached websocket context”对应的行为、结果与边界。
	it("forwards auto transport from streamSimple options and uses cached websocket context", async () => {
		/** 常量 token 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const token = mockToken();
		/** 常量 sentBodies 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const sentBodies: unknown[] = [];
		/** 变量 capturedWebSocketHeaders 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let capturedWebSocketHeaders: Record<string, string> | undefined;

		/** 常量 fetchMock 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fetchMock = vi.fn(async () => new Response("unexpected fetch", { status: 500 }));
		vi.stubGlobal("fetch", fetchMock);

		/** 模拟当前场景所需的 WebSocket 生命周期、监听器和服务端事件；仅用于本用例的内存协议替身。 */
		class MockWebSocket {
			private listeners = new Map<string, Set<(event: unknown) => void>>();

			constructor(_url: string, protocols?: string | string[] | { headers?: Record<string, string> }) {
				if (protocols && typeof protocols === "object" && !Array.isArray(protocols)) {
					capturedWebSocketHeaders = protocols.headers;
				}
				queueMicrotask(() => this.dispatch("open", {}));
			}

			addEventListener(type: string, listener: (event: unknown) => void): void {
				/** 变量 listeners 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				let listeners = this.listeners.get(type);
				if (!listeners) {
					listeners = new Set();
					this.listeners.set(type, listeners);
				}
				listeners.add(listener);
			}

			removeEventListener(type: string, listener: (event: unknown) => void): void {
				this.listeners.get(type)?.delete(listener);
			}

			send(data: string): void {
				sentBodies.push(JSON.parse(data));
				/** 常量 events 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const events = [
					{
						type: "response.output_item.added",
						item: { type: "message", id: "msg_1", role: "assistant", status: "in_progress", content: [] },
					},
					{ type: "response.content_part.added", part: { type: "output_text", text: "" } },
					{ type: "response.output_text.delta", delta: "Hello" },
					{
						type: "response.output_item.done",
						item: {
							type: "message",
							id: "msg_1",
							role: "assistant",
							status: "completed",
							content: [{ type: "output_text", text: "Hello" }],
						},
					},
					{
						type: "response.completed",
						response: {
							status: "completed",
							usage: {
								input_tokens: 5,
								output_tokens: 3,
								total_tokens: 8,
								input_tokens_details: { cached_tokens: 0 },
							},
						},
					},
				];
				queueMicrotask(() => {
					/** 循环变量 event 表示当前遍历项或索引，仅在循环体内有效。 */
					for (const event of events) {
						this.dispatch("message", { data: JSON.stringify(event) });
					}
				});
			}

			close(): void {}

			private dispatch(type: string, event: unknown): void {
				/** 循环变量 listener 表示当前遍历项或索引，仅在循环体内有效。 */
				for (const listener of this.listeners.get(type) ?? []) {
					listener(event);
				}
			}
		}

		vi.stubGlobal("WebSocket", MockWebSocket);

		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model: Model<"openai-codex-responses"> = {
			id: "gpt-5.1-codex",
			name: "GPT-5.1 Codex",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: "https://chatgpt.com/backend-api",
			reasoning: true,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 400000,
			maxTokens: 128000,
		};
		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: Context = {
			systemPrompt: "You are a helpful assistant.",
			messages: [{ role: "user", content: "Say hello", timestamp: 1 }],
		};

		await streamSimpleOpenAICodexResponses(model, context, {
			apiKey: token,
			sessionId: "session-auto",
			transport: "auto",
		}).result();

		expect(sentBodies).toHaveLength(1);
		expect(capturedWebSocketHeaders?.["session-id"]).toBe("session-auto");
		expect(capturedWebSocketHeaders?.session_id).toBeUndefined();
		expect(capturedWebSocketHeaders?.["x-client-request-id"]).toBe("session-auto");
		expect(global.fetch).not.toHaveBeenCalled();
		expect(getOpenAICodexWebSocketDebugStats("session-auto")).toMatchObject({
			cachedContextRequests: 1,
			fullContextRequests: 1,
		});
	});

	// 测试场景：验证“closes one-shot websockets when cacheRetention is none”对应的行为、结果与边界。
	it("closes one-shot websockets when cacheRetention is none", async () => {
		/** 常量 token 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const token = mockToken();
		/** 常量 sentBodies 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const sentBodies: Array<{ prompt_cache_key?: string }> = [];
		/** 变量 connections 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let connections = 0;
		/** 变量 closedConnections 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let closedConnections = 0;

		/** 模拟当前场景所需的 WebSocket 生命周期、监听器和服务端事件；仅用于本用例的内存协议替身。 */
		class MockWebSocket {
			private listeners = new Map<string, Set<(event: unknown) => void>>();

			constructor() {
				connections++;
				queueMicrotask(() => this.dispatch("open", {}));
			}

			addEventListener(type: string, listener: (event: unknown) => void): void {
				/** 变量 listeners 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				let listeners = this.listeners.get(type);
				if (!listeners) {
					listeners = new Set();
					this.listeners.set(type, listeners);
				}
				listeners.add(listener);
			}

			removeEventListener(type: string, listener: (event: unknown) => void): void {
				this.listeners.get(type)?.delete(listener);
			}

			send(data: string): void {
				sentBodies.push(JSON.parse(data) as { prompt_cache_key?: string });
				queueMicrotask(() => {
					this.dispatch("message", {
						data: JSON.stringify({
							type: "response.completed",
							response: {
								id: `resp_${connections}`,
								status: "completed",
								usage: { input_tokens: 5, output_tokens: 3, total_tokens: 8 },
							},
						}),
					});
				});
			}

			close(): void {
				closedConnections++;
			}

			private dispatch(type: string, event: unknown): void {
				/** 循环变量 listener 表示当前遍历项或索引，仅在循环体内有效。 */
				for (const listener of this.listeners.get(type) ?? []) {
					listener(event);
				}
			}
		}

		vi.stubGlobal("WebSocket", MockWebSocket);
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response("unexpected fetch", { status: 500 })),
		);

		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model: Model<"openai-codex-responses"> = {
			id: "gpt-5.1-codex",
			name: "GPT-5.1 Codex",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: "https://chatgpt.com/backend-api",
			reasoning: true,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 400000,
			maxTokens: 128000,
		};
		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: Context = {
			systemPrompt: "You are a helpful assistant.",
			messages: [{ role: "user", content: "Say hello", timestamp: 1 }],
		};
		/** 常量 options 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const options = {
			apiKey: token,
			cacheRetention: "none" as const,
			sessionId: "one-off-summary",
			transport: "auto" as const,
		};

		await streamOpenAICodexResponses(model, context, options).result();
		await streamOpenAICodexResponses(model, context, options).result();

		expect(connections).toBe(2);
		expect(closedConnections).toBe(2);
		expect(sentBodies).toHaveLength(2);
		expect(sentBodies.every((body) => body.prompt_cache_key === undefined)).toBe(true);
		expect(getOpenAICodexWebSocketDebugStats("one-off-summary")).toBeUndefined();
		expect(global.fetch).not.toHaveBeenCalled();
	});

	// 测试场景：验证“falls back to SSE when websocket connect does not open before the connect timeout”对应的行为、结果与边界。
	it("falls back to SSE when websocket connect does not open before the connect timeout", async () => {
		vi.useFakeTimers();
		/** 常量 token 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const token = mockToken();
		/** 常量 encoder 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const encoder = new TextEncoder();
		/** 常量 sse 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const sse = buildSSEPayload({ status: "completed" });

		/** 常量 fetchMock 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fetchMock = vi.fn(async (input: string | URL) => {
			/** 常量 url 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const url = typeof input === "string" ? input : input.toString();
			if (url !== "https://chatgpt.com/backend-api/codex/responses") {
				throw new Error(`Unexpected URL: ${url}`);
			}

			return new Response(
				new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(encoder.encode(sse));
						controller.close();
					},
				}),
				{ status: 200, headers: { "content-type": "text/event-stream" } },
			);
		});
		vi.stubGlobal("fetch", fetchMock);

		/** 模拟当前场景所需的 WebSocket 生命周期、监听器和服务端事件；仅用于本用例的内存协议替身。 */
		class MockWebSocket {
			private listeners = new Map<string, Set<(event: unknown) => void>>();

			addEventListener(type: string, listener: (event: unknown) => void): void {
				/** 变量 listeners 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				let listeners = this.listeners.get(type);
				if (!listeners) {
					listeners = new Set();
					this.listeners.set(type, listeners);
				}
				listeners.add(listener);
			}

			removeEventListener(type: string, listener: (event: unknown) => void): void {
				this.listeners.get(type)?.delete(listener);
			}

			send(): void {
				throw new Error("send should not be called before websocket open");
			}

			close(): void {}
		}

		vi.stubGlobal("WebSocket", MockWebSocket);

		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model: Model<"openai-codex-responses"> = {
			id: "gpt-5.1-codex",
			name: "GPT-5.1 Codex",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: "https://chatgpt.com/backend-api",
			reasoning: true,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 400000,
			maxTokens: 128000,
		};
		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: Context = {
			systemPrompt: "You are a helpful assistant.",
			messages: [{ role: "user", content: "Say hello", timestamp: 1 }],
		};

		/** 常量 resultPromise 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const resultPromise = streamOpenAICodexResponses(model, context, {
			apiKey: token,
			sessionId: "ws-connect-timeout",
			transport: "auto",
			timeoutMs: 300_000,
			websocketConnectTimeoutMs: 50,
		}).result();

		await vi.advanceTimersByTimeAsync(50);

		/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const result = await resultPromise;
		expect(result.content.find((content) => content.type === "text")?.text).toBe("Hello");
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(getOpenAICodexWebSocketDebugStats("ws-connect-timeout")).toMatchObject({
			websocketFailures: 1,
			sseFallbacks: 1,
			websocketFallbackActive: true,
			lastWebSocketError: "WebSocket connect timeout after 50ms",
		});
	});

	// 测试场景：验证“reconnects once when the websocket connection limit is reached before output starts”对应的行为、结果与边界。
	it("reconnects once when the websocket connection limit is reached before output starts", async () => {
		/** 常量 token 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const token = mockToken();
		/** 变量 connections 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let connections = 0;

		/** 常量 fetchMock 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		/** 模拟当前场景所需的 WebSocket 生命周期、监听器和服务端事件；仅用于本用例的内存协议替身。 */
		class MockWebSocket extends EventTarget {
			private readonly limitReached = connections++ === 0;

			constructor() {
				super();
				queueMicrotask(() => this.dispatchEvent(new Event("open")));
			}

			send(): void {
				/** 常量 event 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const event = this.limitReached
					? { type: "error", error: { code: "websocket_connection_limit_reached" } }
					: {
							type: "response.completed",
							response: {
								id: "resp_1",
								status: "completed",
								usage: { input_tokens: 5, output_tokens: 3, total_tokens: 8 },
							},
						};
				queueMicrotask(() => {
					this.dispatchEvent(Object.assign(new Event("message"), { data: JSON.stringify(event) }));
				});
			}

			close(): void {}
		}

		vi.stubGlobal("WebSocket", MockWebSocket);

		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model: Model<"openai-codex-responses"> = {
			id: "gpt-5.1-codex",
			name: "GPT-5.1 Codex",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: "https://chatgpt.com/backend-api",
			reasoning: true,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 400000,
			maxTokens: 128000,
		};

		/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const result = await streamOpenAICodexResponses(
			model,
			{ systemPrompt: "", messages: [] },
			{
				apiKey: token,
			},
		).result();

		expect(result.stopReason).toBe("stop");
		expect(connections).toBe(2);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	// 测试场景：验证“falls back to SSE when a websocket is idle before the first event”对应的行为、结果与边界。
	it("falls back to SSE when a websocket is idle before the first event", async () => {
		vi.useFakeTimers();
		/** 常量 token 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const token = mockToken();
		/** 常量 sentBodies 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const sentBodies: unknown[] = [];
		/** 常量 encoder 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const encoder = new TextEncoder();
		/** 常量 sse 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const sse = buildSSEPayload({ status: "completed" });

		/** 常量 fetchMock 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fetchMock = vi.fn(async (input: string | URL) => {
			/** 常量 url 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const url = typeof input === "string" ? input : input.toString();
			if (url !== "https://chatgpt.com/backend-api/codex/responses") {
				throw new Error(`Unexpected URL: ${url}`);
			}

			return new Response(
				new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(encoder.encode(sse));
						controller.close();
					},
				}),
				{ status: 200, headers: { "content-type": "text/event-stream" } },
			);
		});
		vi.stubGlobal("fetch", fetchMock);

		/** 模拟当前场景所需的 WebSocket 生命周期、监听器和服务端事件；仅用于本用例的内存协议替身。 */
		class MockWebSocket {
			static OPEN = 1;
			readyState = MockWebSocket.OPEN;
			private listeners = new Map<string, Set<(event: unknown) => void>>();

			constructor(_url: string, _protocols?: string | string[] | { headers?: Record<string, string> }) {
				queueMicrotask(() => this.dispatch("open", {}));
			}

			addEventListener(type: string, listener: (event: unknown) => void): void {
				/** 变量 listeners 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				let listeners = this.listeners.get(type);
				if (!listeners) {
					listeners = new Set();
					this.listeners.set(type, listeners);
				}
				listeners.add(listener);
			}

			removeEventListener(type: string, listener: (event: unknown) => void): void {
				this.listeners.get(type)?.delete(listener);
			}

			send(data: string): void {
				sentBodies.push(JSON.parse(data));
			}

			close(): void {
				this.readyState = 3;
			}

			private dispatch(type: string, event: unknown): void {
				/** 循环变量 listener 表示当前遍历项或索引，仅在循环体内有效。 */
				for (const listener of this.listeners.get(type) ?? []) {
					listener(event);
				}
			}
		}

		vi.stubGlobal("WebSocket", MockWebSocket);

		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model: Model<"openai-codex-responses"> = {
			id: "gpt-5.1-codex",
			name: "GPT-5.1 Codex",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: "https://chatgpt.com/backend-api",
			reasoning: true,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 400000,
			maxTokens: 128000,
		};
		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: Context = {
			systemPrompt: "You are a helpful assistant.",
			messages: [{ role: "user", content: "Say hello", timestamp: 1 }],
		};

		/** 常量 resultPromise 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const resultPromise = streamOpenAICodexResponses(model, context, {
			apiKey: token,
			sessionId: "ws-idle-before-start",
			transport: "auto",
			timeoutMs: 50,
		}).result();

		await vi.advanceTimersByTimeAsync(0);
		expect(sentBodies).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(50);

		/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const result = await resultPromise;
		expect(result.content.find((content) => content.type === "text")?.text).toBe("Hello");
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(getOpenAICodexWebSocketDebugStats("ws-idle-before-start")).toMatchObject({
			websocketFailures: 1,
			sseFallbacks: 1,
			websocketFallbackActive: true,
		});
	});

	// 测试场景：验证“errors when a websocket is idle after the stream started”对应的行为、结果与边界。
	it("errors when a websocket is idle after the stream started", async () => {
		vi.useFakeTimers();
		/** 常量 token 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const token = mockToken();

		/** 常量 fetchMock 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fetchMock = vi.fn(async () => new Response("unexpected fetch", { status: 500 }));
		vi.stubGlobal("fetch", fetchMock);

		/** 模拟当前场景所需的 WebSocket 生命周期、监听器和服务端事件；仅用于本用例的内存协议替身。 */
		class MockWebSocket {
			static OPEN = 1;
			readyState = MockWebSocket.OPEN;
			private listeners = new Map<string, Set<(event: unknown) => void>>();

			constructor(_url: string, _protocols?: string | string[] | { headers?: Record<string, string> }) {
				queueMicrotask(() => this.dispatch("open", {}));
			}

			addEventListener(type: string, listener: (event: unknown) => void): void {
				/** 变量 listeners 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				let listeners = this.listeners.get(type);
				if (!listeners) {
					listeners = new Set();
					this.listeners.set(type, listeners);
				}
				listeners.add(listener);
			}

			removeEventListener(type: string, listener: (event: unknown) => void): void {
				this.listeners.get(type)?.delete(listener);
			}

			send(): void {
				queueMicrotask(() => {
					this.dispatch("message", {
						data: JSON.stringify({
							type: "response.output_item.added",
							item: { type: "message", id: "msg_1", role: "assistant", status: "in_progress", content: [] },
						}),
					});
				});
			}

			close(): void {
				this.readyState = 3;
			}

			private dispatch(type: string, event: unknown): void {
				/** 循环变量 listener 表示当前遍历项或索引，仅在循环体内有效。 */
				for (const listener of this.listeners.get(type) ?? []) {
					listener(event);
				}
			}
		}

		vi.stubGlobal("WebSocket", MockWebSocket);

		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model: Model<"openai-codex-responses"> = {
			id: "gpt-5.1-codex",
			name: "GPT-5.1 Codex",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: "https://chatgpt.com/backend-api",
			reasoning: true,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 400000,
			maxTokens: 128000,
		};
		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: Context = {
			systemPrompt: "You are a helpful assistant.",
			messages: [{ role: "user", content: "Say hello", timestamp: 1 }],
		};

		/** 常量 resultPromise 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const resultPromise = streamOpenAICodexResponses(model, context, {
			apiKey: token,
			transport: "auto",
			timeoutMs: 50,
		}).result();

		await vi.advanceTimersByTimeAsync(0);
		await vi.advanceTimersByTimeAsync(50);

		/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const result = await resultPromise;
		expect(result.stopReason).toBe("error");
		expect(result.errorMessage).toBe("WebSocket idle timeout after 50ms");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	// 测试场景：验证“opens a fresh cached websocket before the backend connection age limit”对应的行为、结果与边界。
	it("opens a fresh cached websocket before the backend connection age limit", async () => {
		vi.useFakeTimers();
		/** 常量 startedAt 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const startedAt = new Date("2026-07-03T00:00:00Z");
		vi.setSystemTime(startedAt);
		/** 常量 token 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const token = mockToken();
		/** 常量 sentConnectionIds 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const sentConnectionIds: number[] = [];
		/** 变量 connections 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let connections = 0;

		/** 模拟当前场景所需的 WebSocket 生命周期、监听器和服务端事件；仅用于本用例的内存协议替身。 */
		class MockWebSocket {
			static OPEN = 1;
			static CLOSED = 3;
			readyState = MockWebSocket.OPEN;
			private readonly connectionId = ++connections;
			private listeners = new Map<string, Set<(event: unknown) => void>>();

			constructor(_url: string, _protocols?: string | string[] | { headers?: Record<string, string> }) {
				queueMicrotask(() => this.dispatch("open", {}));
			}

			addEventListener(type: string, listener: (event: unknown) => void): void {
				/** 变量 listeners 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				let listeners = this.listeners.get(type);
				if (!listeners) {
					listeners = new Set();
					this.listeners.set(type, listeners);
				}
				listeners.add(listener);
			}

			removeEventListener(type: string, listener: (event: unknown) => void): void {
				this.listeners.get(type)?.delete(listener);
			}

			send(): void {
				sentConnectionIds.push(this.connectionId);
				/** 常量 responseId 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const responseId = `resp_${this.connectionId}`;
				queueMicrotask(() => {
					this.dispatch("message", {
						data: JSON.stringify({
							type: "response.completed",
							response: {
								id: responseId,
								status: "completed",
								usage: { input_tokens: 5, output_tokens: 3, total_tokens: 8 },
							},
						}),
					});
				});
			}

			close(): void {
				this.readyState = MockWebSocket.CLOSED;
			}

			private dispatch(type: string, event: unknown): void {
				/** 循环变量 listener 表示当前遍历项或索引，仅在循环体内有效。 */
				for (const listener of this.listeners.get(type) ?? []) {
					listener(event);
				}
			}
		}

		vi.stubGlobal("WebSocket", MockWebSocket);

		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model: Model<"openai-codex-responses"> = {
			id: "gpt-5.1-codex",
			name: "GPT-5.1 Codex",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: "https://chatgpt.com/backend-api",
			reasoning: true,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 400000,
			maxTokens: 128000,
		};
		/** 常量 sessionId 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const sessionId = "aged-ws-session";
		/** 常量 firstContext 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const firstContext: Context = {
			systemPrompt: "You are a helpful assistant.",
			messages: [{ role: "user", content: "Say hello", timestamp: 1 }],
		};

		/** 常量 first 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const first = await streamOpenAICodexResponses(model, firstContext, {
			apiKey: token,
			sessionId,
			transport: "websocket-cached",
		}).result();
		vi.setSystemTime(new Date(startedAt.getTime() + 56 * 60 * 1000));
		/** 常量 secondContext 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const secondContext: Context = {
			systemPrompt: "You are a helpful assistant.",
			messages: [...firstContext.messages, first, { role: "user", content: "Now finish", timestamp: 2 }],
		};

		await streamOpenAICodexResponses(model, secondContext, {
			apiKey: token,
			sessionId,
			transport: "websocket-cached",
		}).result();

		expect(connections).toBe(2);
		expect(sentConnectionIds).toEqual([1, 2]);
		expect(getOpenAICodexWebSocketDebugStats(sessionId)).toMatchObject({
			connectionsCreated: 2,
			connectionsReused: 0,
		});
	});

	// 测试场景：验证“sends only response input deltas in websocket-cached mode”对应的行为、结果与边界。
	it("sends only response input deltas in websocket-cached mode", async () => {
		/** 常量 token 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const token = mockToken();
		/** 常量 sentBodies 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const sentBodies: unknown[] = [];

		/** 模拟当前场景所需的 WebSocket 生命周期、监听器和服务端事件；仅用于本用例的内存协议替身。 */
		class MockWebSocket {
			static OPEN = 1;
			readyState = MockWebSocket.OPEN;
			private listeners = new Map<string, Set<(event: unknown) => void>>();

			constructor(_url: string, _protocols?: string | string[] | { headers?: Record<string, string> }) {
				queueMicrotask(() => this.dispatch("open", {}));
			}

			addEventListener(type: string, listener: (event: unknown) => void): void {
				/** 变量 listeners 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				let listeners = this.listeners.get(type);
				if (!listeners) {
					listeners = new Set();
					this.listeners.set(type, listeners);
				}
				listeners.add(listener);
			}

			removeEventListener(type: string, listener: (event: unknown) => void): void {
				this.listeners.get(type)?.delete(listener);
			}

			send(data: string): void {
				sentBodies.push(JSON.parse(data));
				/** 常量 responseId 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const responseId = `resp_${sentBodies.length}`;
				/** 常量 outputEvents 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const outputEvents =
					sentBodies.length === 1
						? [
								{
									type: "response.output_item.added",
									item: {
										type: "custom_tool_call",
										id: "ctc_1",
										call_id: "call_1",
										name: "sample_tool",
										input: "",
									},
								},
								{ type: "response.custom_tool_call_input.delta", item_id: "ctc_1", delta: "abc" },
								{ type: "response.custom_tool_call_input.done", item_id: "ctc_1", input: "abc" },
								{
									type: "response.output_item.done",
									item: {
										type: "custom_tool_call",
										id: "ctc_1",
										call_id: "call_1",
										name: "sample_tool",
										input: "abc",
									},
								},
							]
						: [];
				/** 常量 events 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const events = [
					{ type: "response.created", response: { id: responseId } },
					...outputEvents,
					{
						type: "response.completed",
						response: {
							id: responseId,
							status: "completed",
							usage: {
								input_tokens: 5,
								output_tokens: 3,
								total_tokens: 8,
								input_tokens_details: { cached_tokens: 0 },
							},
						},
					},
				];
				queueMicrotask(() => {
					/** 循环变量 event 表示当前遍历项或索引，仅在循环体内有效。 */
					for (const event of events) {
						this.dispatch("message", { data: JSON.stringify(event) });
					}
				});
			}

			close(): void {
				this.readyState = 3;
			}

			private dispatch(type: string, event: unknown): void {
				/** 循环变量 listener 表示当前遍历项或索引，仅在循环体内有效。 */
				for (const listener of this.listeners.get(type) ?? []) {
					listener(event);
				}
			}
		}

		vi.stubGlobal("WebSocket", MockWebSocket);

		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model: Model<"openai-codex-responses"> = {
			id: "gpt-5.1-codex",
			name: "GPT-5.1 Codex",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: "https://chatgpt.com/backend-api",
			reasoning: true,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 400000,
			maxTokens: 128000,
			compat: { supportsOpenAIGrammarTools: true },
		};
		/** 常量 firstContext 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const firstContext: Context = {
			systemPrompt: "You are a helpful assistant.",
			messages: [{ role: "user", content: "Use the tool", timestamp: 1 }],
			tools: [
				{
					name: "sample_tool",
					description: "Sample tool",
					parameters: Type.Object({ payload: Type.String() }),
					constrainedSampling: { type: "grammar", variants: { openai_lark: "start: /[a-z]+/" } },
				},
			],
		};

		/** 常量 first 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const first = await streamOpenAICodexResponses(model, firstContext, {
			apiKey: token,
			sessionId: "session-1",
			transport: "websocket-cached",
		}).result();

		/** 常量 secondContext 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const secondContext: Context = {
			...firstContext,
			messages: [
				...firstContext.messages,
				first,
				{
					role: "toolResult",
					toolCallId: "call_1|ctc_1",
					toolName: "sample_tool",
					content: [{ type: "text", text: "real result" }],
					isError: false,
					timestamp: 2,
				},
				{ role: "user", content: "Now finish", timestamp: 3 },
			],
		};
		await streamOpenAICodexResponses(model, secondContext, {
			apiKey: token,
			sessionId: "session-1",
			transport: "websocket-cached",
		}).result();

		expect(sentBodies).toHaveLength(2);
		/** 常量 firstBody 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const firstBody = sentBodies[0] as { input: unknown[]; previous_response_id?: string; store?: boolean };
		/** 常量 secondBody 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const secondBody = sentBodies[1] as { input: unknown[]; previous_response_id?: string; store?: boolean };
		expect(firstBody.store).toBe(false);
		expect(firstBody.previous_response_id).toBeUndefined();
		expect(firstBody.input).toEqual([{ role: "user", content: [{ type: "input_text", text: "Use the tool" }] }]);
		expect(secondBody.store).toBe(false);
		expect(secondBody.previous_response_id).toBe("resp_1");
		expect(secondBody.input).toEqual([
			{ type: "custom_tool_call_output", call_id: "call_1", output: "real result" },
			{ role: "user", content: [{ type: "input_text", text: "Now finish" }] },
		]);
		expect(getOpenAICodexWebSocketDebugStats("session-1")).toMatchObject({
			requests: 2,
			connectionsCreated: 1,
			connectionsReused: 1,
			cachedContextRequests: 2,
			storeTrueRequests: 0,
			fullContextRequests: 1,
			deltaRequests: 1,
			lastDeltaInputItems: 2,
			lastPreviousResponseId: "resp_1",
		});
	});

	it.each(["websocket", "sse"] as const)(
		"recovers a missing cached websocket continuation via %s",
		async (recoveryTransport) => {
			/** 常量 token 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const token = mockToken();
			/** 常量 sessionId 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const sessionId = `missing-continuation-${recoveryTransport}`;
			/** 常量 encoder 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const encoder = new TextEncoder();
			/** 常量 fetchMock 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const fetchMock = vi.fn(
				async () =>
					new Response(
						new ReadableStream<Uint8Array>({
							start(controller) {
								controller.enqueue(encoder.encode(buildSSEPayload({ status: "completed" })));
								controller.close();
							},
						}),
						{ status: 200, headers: { "content-type": "text/event-stream" } },
					),
			);
			vi.stubGlobal("fetch", fetchMock);
			/** 常量 sentBodies 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const sentBodies: Array<{
				connectionId: number;
				input: unknown[];
				previous_response_id?: string;
			}> = [];
			/** 变量 connections 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			let connections = 0;

			/** 模拟当前场景所需的 WebSocket 生命周期、监听器和服务端事件；仅用于本用例的内存协议替身。 */
			class MockWebSocket {
				static OPEN = 1;
				static CLOSED = 3;
				readyState = MockWebSocket.OPEN;
				private readonly connectionId = ++connections;
				private listeners = new Map<string, Set<(event: unknown) => void>>();

				constructor(_url: string, _protocols?: string | string[] | { headers?: Record<string, string> }) {
					queueMicrotask(() => this.dispatch("open", {}));
				}

				addEventListener(type: string, listener: (event: unknown) => void): void {
					/** 变量 listeners 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					let listeners = this.listeners.get(type);
					if (!listeners) {
						listeners = new Set();
						this.listeners.set(type, listeners);
					}
					listeners.add(listener);
				}

				removeEventListener(type: string, listener: (event: unknown) => void): void {
					this.listeners.get(type)?.delete(listener);
				}

				send(data: string): void {
					/** 常量 body 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const body = JSON.parse(data) as { input: unknown[]; previous_response_id?: string };
					sentBodies.push({ ...body, connectionId: this.connectionId });
					if (sentBodies.length === 2) {
						this.dispatchEvents([
							{
								type: "codex.rate_limits",
								plan_type: "plus",
								rate_limits: {
									allowed: true,
									limit_reached: false,
									primary: {
										used_percent: 7,
										window_minutes: 10080,
										reset_after_seconds: 556112,
										reset_at: 1785269351,
									},
									secondary: null,
								},
								code_review_rate_limits: null,
								additional_rate_limits: null,
								credits: { has_credits: false, unlimited: false, balance: "0" },
								promo: null,
							},
							{
								type: "error",
								status: 400,
								error: {
									code: "previous_response_not_found",
									message: "Previous response with id 'resp_1' not found.",
									param: "previous_response_id",
								},
							},
						]);
						return;
					}
					if (sentBodies.length === 3 && recoveryTransport === "sse") {
						queueMicrotask(() => this.dispatch("error", { message: "retry websocket failed" }));
						return;
					}

					/** 常量 response 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const response =
						sentBodies.length === 1
							? { responseId: "resp_1", messageId: "msg_1", text: "Hello" }
							: { responseId: "resp_2", messageId: "msg_2", text: "Recovered" };
					this.dispatchEvents([
						{ type: "response.created", response: { id: response.responseId } },
						{
							type: "response.output_item.added",
							output_index: 0,
							item: {
								type: "message",
								id: response.messageId,
								role: "assistant",
								status: "in_progress",
								content: [],
							},
						},
						{
							type: "response.output_item.done",
							output_index: 0,
							item: {
								type: "message",
								id: response.messageId,
								role: "assistant",
								status: "completed",
								content: [{ type: "output_text", text: response.text }],
							},
						},
						{
							type: "response.completed",
							response: {
								id: response.responseId,
								status: "completed",
								usage: { input_tokens: 5, output_tokens: 3, total_tokens: 8 },
							},
						},
					]);
				}

				close(): void {
					this.readyState = MockWebSocket.CLOSED;
				}

				private dispatchEvents(events: unknown[]): void {
					queueMicrotask(() => {
						/** 循环变量 event 表示当前遍历项或索引，仅在循环体内有效。 */
						for (const event of events) {
							this.dispatch("message", { data: JSON.stringify(event) });
						}
					});
				}

				private dispatch(type: string, event: unknown): void {
					/** 循环变量 listener 表示当前遍历项或索引，仅在循环体内有效。 */
					for (const listener of this.listeners.get(type) ?? []) {
						listener(event);
					}
				}
			}

			vi.stubGlobal("WebSocket", MockWebSocket);

			/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const model: Model<"openai-codex-responses"> = {
				id: "gpt-5.1-codex",
				name: "GPT-5.1 Codex",
				api: "openai-codex-responses",
				provider: "openai-codex",
				baseUrl: "https://chatgpt.com/backend-api",
				reasoning: true,
				input: ["text"],
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				contextWindow: 400000,
				maxTokens: 128000,
			};
			/** 常量 firstContext 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const firstContext: Context = {
				systemPrompt: "You are a helpful assistant.",
				messages: [{ role: "user", content: "Say hello", timestamp: 1 }],
			};

			/** 常量 first 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const first = await streamOpenAICodexResponses(model, firstContext, {
				apiKey: token,
				sessionId,
				transport: "websocket-cached",
			}).result();
			/** 常量 secondContext 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const secondContext: Context = {
				systemPrompt: "You are a helpful assistant.",
				messages: [...firstContext.messages, first, { role: "user", content: "Now finish", timestamp: 2 }],
			};
			/** 常量 eventTypes 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const eventTypes: string[] = [];
			/** 常量 secondStream 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const secondStream = streamOpenAICodexResponses(model, secondContext, {
				apiKey: token,
				sessionId,
				transport: "websocket-cached",
			});
			for await (const event of secondStream) {
				eventTypes.push(event.type);
			}
			/** 常量 second 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const second = await secondStream.result();

			expect(second.stopReason).toBe("stop");
			expect(second.content.find((content) => content.type === "text")?.text).toBe(
				recoveryTransport === "sse" ? "Hello" : "Recovered",
			);
			expect(eventTypes.filter((type) => type === "start")).toHaveLength(1);
			expect(eventTypes).not.toContain("error");
			expect(connections).toBe(2);
			expect(sentBodies).toHaveLength(3);
			expect(sentBodies.map((body) => body.connectionId)).toEqual([1, 1, 2]);
			expect(sentBodies[1].previous_response_id).toBe("resp_1");
			expect(sentBodies[1].input).toEqual([{ role: "user", content: [{ type: "input_text", text: "Now finish" }] }]);
			expect(sentBodies[2].previous_response_id).toBeUndefined();
			expect(sentBodies[2].input).toHaveLength(3);
			expect(sentBodies[2].input.at(-1)).toEqual({
				role: "user",
				content: [{ type: "input_text", text: "Now finish" }],
			});
			expect(fetchMock).toHaveBeenCalledTimes(recoveryTransport === "sse" ? 1 : 0);
			expect(getOpenAICodexWebSocketDebugStats(sessionId)).toMatchObject({
				requests: 3,
				connectionsCreated: 2,
				connectionsReused: 1,
				fullContextRequests: 2,
				deltaRequests: 1,
				websocketFailures: recoveryTransport === "sse" ? 1 : 0,
				sseFallbacks: recoveryTransport === "sse" ? 1 : 0,
			});
		},
	);

	it.each([
		["retry-after-ms", () => ({ "content-type": "application/json", "retry-after-ms": "1500" }), 1500],
		["retry-after seconds", () => ({ "content-type": "application/json", "retry-after": "60" }), 60_000],
		[
			"retry-after HTTP date",
			() => ({ "content-type": "application/json", "retry-after": new Date(Date.now() + 45_000).toUTCString() }),
			45_000,
		],
	] as const)("uses %s for SSE retries", async (_name, makeHeaders, expectedDelay) => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-05-13T00:00:00Z"));
		/** 常量 setTimeoutSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
		/** 常量 token 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const token = mockToken();
		/** 常量 encoder 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const encoder = new TextEncoder();
		/** 常量 sse 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const sse = buildSSEPayload({ status: "completed" });
		/** 变量 codexRequests 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let codexRequests = 0;

		/** 常量 fetchMock 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fetchMock = vi.fn(async (input: string | URL) => {
			/** 常量 url 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const url = typeof input === "string" ? input : input.toString();
			if (url !== "https://chatgpt.com/backend-api/codex/responses") {
				throw new Error(`Unexpected URL: ${url}`);
			}

			codexRequests++;
			if (codexRequests === 1) {
				return new Response(JSON.stringify({ error: { code: "rate_limit_exceeded", message: "rate limited" } }), {
					status: 429,
					headers: makeHeaders(),
				});
			}

			return new Response(
				new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(encoder.encode(sse));
						controller.close();
					},
				}),
				{ status: 200, headers: { "content-type": "text/event-stream" } },
			);
		});
		vi.stubGlobal("fetch", fetchMock);

		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model: Model<"openai-codex-responses"> = {
			id: "gpt-5.1-codex",
			name: "GPT-5.1 Codex",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: "https://chatgpt.com/backend-api",
			reasoning: true,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 400000,
			maxTokens: 128000,
		};
		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: Context = {
			systemPrompt: "You are a helpful assistant.",
			messages: [{ role: "user", content: "Say hello", timestamp: Date.now() }],
		};

		/** 常量 resultPromise 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const resultPromise = streamOpenAICodexResponses(model, context, {
			apiKey: token,
			transport: "sse",
			maxRetries: 1,
		}).result();
		await vi.advanceTimersByTimeAsync(0);
		expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), expectedDelay);

		await vi.advanceTimersToNextTimerAsync();
		/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const result = await resultPromise;
		expect(result.content.find((content) => content.type === "text")?.text).toBe("Hello");
		expect(codexRequests).toBe(2);
	});

	it.each([429, 503])("fails immediately when a %i retry delay exceeds the limit", async (status) => {
		/** 常量 token 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const token = mockToken();
		/** 常量 fetchMock 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fetchMock = vi.fn(
			async () =>
				new Response(JSON.stringify({ error: { code: "temporarily_unavailable", message: "retry later" } }), {
					status,
					headers: { "content-type": "application/json", "retry-after": "2" },
				}),
		);
		vi.stubGlobal("fetch", fetchMock);

		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model: Model<"openai-codex-responses"> = {
			id: "gpt-5.1-codex",
			name: "GPT-5.1 Codex",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: "https://chatgpt.com/backend-api",
			reasoning: true,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 400000,
			maxTokens: 128000,
		};
		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: Context = {
			systemPrompt: "You are a helpful assistant.",
			messages: [{ role: "user", content: "Say hello", timestamp: Date.now() }],
		};

		/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const result = await streamOpenAICodexResponses(model, context, {
			apiKey: token,
			transport: "sse",
			maxRetries: 3,
			maxRetryDelayMs: 1000,
		}).result();

		expect(result.stopReason).toBe("error");
		expect(result.errorMessage).toBe("Server requested 2s retry delay (max: 1s)");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	// 测试场景：验证“zstd-compresses SSE request bodies”对应的行为、结果与边界。
	it("zstd-compresses SSE request bodies", async () => {
		/** 常量 token 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const token = mockToken();
		/** 常量 encoder 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const encoder = new TextEncoder();
		/** 常量 sse 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const sse = buildSSEPayload({ status: "completed" });

		/** 变量 capturedEncoding 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let capturedEncoding: string | null = null;
		/** 变量 capturedBody 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let capturedBody: Uint8Array | string | undefined;

		/** 常量 fetchMock 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
			/** 常量 url 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const url = typeof input === "string" ? input : input.toString();
			if (url !== "https://chatgpt.com/backend-api/codex/responses") {
				throw new Error(`Unexpected URL: ${url}`);
			}
			/** 常量 headers 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const headers = init?.headers instanceof Headers ? init.headers : undefined;
			capturedEncoding = headers?.get("content-encoding") ?? null;
			capturedBody = init?.body as Uint8Array | string | undefined;
			return new Response(
				new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(encoder.encode(sse));
						controller.close();
					},
				}),
				{ status: 200, headers: { "content-type": "text/event-stream" } },
			);
		});
		vi.stubGlobal("fetch", fetchMock);

		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model: Model<"openai-codex-responses"> = {
			id: "gpt-5.1-codex",
			name: "GPT-5.1 Codex",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: "https://chatgpt.com/backend-api",
			reasoning: true,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 400000,
			maxTokens: 128000,
		};

		/** 常量 largeText 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const largeText = "compress me ".repeat(400);
		await streamOpenAICodexResponses(
			model,
			{
				systemPrompt: "You are a helpful assistant.",
				messages: [{ role: "user", content: largeText, timestamp: 1 }],
			},
			{ apiKey: token, transport: "sse" },
		).result();

		expect(capturedEncoding).toBe("zstd");
		expect(capturedBody).toBeInstanceOf(Uint8Array);
		/** 常量 decoded 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const decoded = JSON.parse(Buffer.from(zstdDecompressSync(capturedBody as Uint8Array)).toString("utf8")) as {
			input: Array<{ content: Array<{ text: string }> }>;
		};
		expect(decoded.input[0].content[0].text).toBe(largeText);

		capturedEncoding = null;
		capturedBody = undefined;
		await streamOpenAICodexResponses(
			model,
			{
				systemPrompt: "You are a helpful assistant.",
				messages: [{ role: "user", content: "hi", timestamp: 1 }],
			},
			{ apiKey: token, transport: "sse" },
		).result();

		expect(capturedEncoding).toBe("zstd");
		expect(capturedBody).toBeInstanceOf(Uint8Array);
	});

	// 测试场景：验证“uses exponential backoff across repeated SSE retries without retry headers”对应的行为、结果与边界。
	it("uses exponential backoff across repeated SSE retries without retry headers", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-05-13T00:00:00Z"));
		/** 常量 setTimeoutSpy 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
		/** 常量 token 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const token = mockToken();
		/** 常量 encoder 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const encoder = new TextEncoder();
		/** 常量 sse 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const sse = buildSSEPayload({ status: "completed" });
		/** 变量 codexRequests 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let codexRequests = 0;

		/** 常量 fetchMock 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fetchMock = vi.fn(async (input: string | URL) => {
			/** 常量 url 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const url = typeof input === "string" ? input : input.toString();
			if (url !== "https://chatgpt.com/backend-api/codex/responses") {
				throw new Error(`Unexpected URL: ${url}`);
			}

			codexRequests++;
			if (codexRequests <= 3) {
				return new Response(JSON.stringify({ error: { code: "rate_limit_exceeded", message: "rate limited" } }), {
					status: 429,
					headers: { "content-type": "application/json" },
				});
			}

			return new Response(
				new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(encoder.encode(sse));
						controller.close();
					},
				}),
				{ status: 200, headers: { "content-type": "text/event-stream" } },
			);
		});
		vi.stubGlobal("fetch", fetchMock);

		/** 常量 model 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const model: Model<"openai-codex-responses"> = {
			id: "gpt-5.1-codex",
			name: "GPT-5.1 Codex",
			api: "openai-codex-responses",
			provider: "openai-codex",
			baseUrl: "https://chatgpt.com/backend-api",
			reasoning: true,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 400000,
			maxTokens: 128000,
		};
		/** 常量 context 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const context: Context = {
			systemPrompt: "You are a helpful assistant.",
			messages: [{ role: "user", content: "Say hello", timestamp: Date.now() }],
		};

		/** retryTimeoutDelays 封装当前回调或辅助步骤；参数 无 提供输入，返回值用于后续流程。示例：retryTimeoutDelays()。 */
		const retryTimeoutDelays = () =>
			setTimeoutSpy.mock.calls
				.map((call) => call[1])
				.filter((delay): delay is number => delay === 1000 || delay === 2000 || delay === 4000);

		/** 常量 resultPromise 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const resultPromise = streamOpenAICodexResponses(model, context, {
			apiKey: token,
			transport: "sse",
			maxRetries: 3,
		}).result();
		await vi.advanceTimersByTimeAsync(0);
		expect(retryTimeoutDelays()).toEqual([1000]);

		await vi.advanceTimersToNextTimerAsync();
		expect(retryTimeoutDelays()).toEqual([1000, 2000]);

		await vi.advanceTimersToNextTimerAsync();
		expect(retryTimeoutDelays()).toEqual([1000, 2000, 4000]);

		await vi.advanceTimersToNextTimerAsync();
		/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const result = await resultPromise;
		expect(result.content.find((content) => content.type === "text")?.text).toBe("Hello");
		expect(codexRequests).toBe(4);
	});
});
