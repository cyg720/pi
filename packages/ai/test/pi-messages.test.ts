/**
 * 文件职责：验证 pi-messages API 的请求编码、SSE 事件转换、终止结果、诊断错误和内置注册。
 * 技术维度：使用 Vitest 与本地 Node HTTP 服务器模拟网关，消费真实异步事件流而不访问外网。
 * 产品维度：保证 Radius/pi 网关能正确接收会话参数，并向用户稳定返回文字、工具调用及可排查错误。
 * 逻辑维度：startServer 记录请求并回放事件，createModel 提供模型夹具，各用例覆盖成功流和失败边界。
 * 关键边界：服务器只监听 127.0.0.1 随机端口；每个用例后必须关闭；事件格式需符合 pi-messages 协议。
 * 新手阅读建议：先看 startServer 如何模拟 SSE，再跟踪首个完整事件流用例，最后阅读四种错误与注册测试。
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { type PiMessagesOptions, stream, streamSimple } from "../src/api/pi-messages.ts";
import type { Api, AssistantMessageEvent, Context, Model } from "../src/types.ts";

/** 本地测试服务器记录的一次 HTTP 请求。 */
type RecordedRequest = {
	/** 请求 URL，包含路径和查询参数。 */
	url: string;
	/** Node 解析后的请求头。 */
	headers: IncomingMessage["headers"];
	/** JSON 解析后的请求正文。 */
	body: unknown;
};

/** 控制本地响应服务器状态、响应头、SSE 事件和错误正文的选项。 */
type ResponderOptions = {
	/** 非 200 时触发 JSON 错误响应。 */
	status?: number;
	/** 成功响应附加头。 */
	headers?: Record<string, string>;
	/** 按顺序写入 SSE data 行的事件。 */
	events?: unknown[];
	/** 错误响应的原始正文。 */
	rawBody?: string;
};

/** 当前用例启动的本地 HTTP 服务器；未启动或已清理时为空。 */
let server: Server | undefined;

/** 每个用例后关闭服务器并清空共享引用。 */
afterEach(() => {
	server?.close();
	server = undefined;
});

/**
 * 启动记录请求并按选项回放 JSON 或 SSE 的本地服务器。
 * @param options 响应状态、头、事件和原始错误正文。
 * @returns 服务器基础 URL 与会随请求追加的记录数组。
 * @example const { baseUrl, requests } = await startServer({ events: [] });
 */
async function startServer(options: ResponderOptions): Promise<{ baseUrl: string; requests: RecordedRequest[] }> {
	/** 保存服务器收到的全部请求。 */
	const requests: RecordedRequest[] = [];

	server = createServer((request: IncomingMessage, response: ServerResponse) => {
		/** 分段接收的请求正文字节。 */
		const chunks: Buffer[] = [];
		request.on("data", (chunk: Buffer) => chunks.push(chunk));
		request.on("end", () => {
			/** 合并请求块后得到的 UTF-8 文本。 */
			const raw = Buffer.concat(chunks).toString("utf-8");
			requests.push({
				url: request.url ?? "",
				headers: request.headers,
				body: raw ? JSON.parse(raw) : undefined,
			});

			if (options.status && options.status !== 200) {
				response.statusCode = options.status;
				response.setHeader("content-type", "application/json");
				response.end(options.rawBody ?? "{}");
				return;
			}

			response.statusCode = 200;
			response.setHeader("content-type", "text/event-stream");
			/** name 和 value 分别是待写入模拟响应的请求头名称与值，来源限于测试选项。 */
			for (const [name, value] of Object.entries(options.headers ?? {})) {
				response.setHeader(name, value);
			}
			/** event 是待编码为 SSE 数据行的单个模拟事件。 */
			for (const event of options.events ?? []) {
				response.write(`data: ${JSON.stringify(event)}\n\n`);
			}
			response.end();
		});
	});

	await new Promise<void>((resolve) => {
		server!.listen(0, "127.0.0.1", () => resolve());
	});

	/** 实际绑定的随机端口信息。 */
	const address = server!.address() as AddressInfo;
	return { baseUrl: `http://127.0.0.1:${address.port}/v1`, requests };
}

/**
 * 创建指向本地测试服务器的 pi-messages 模型。
 * @param baseUrl 本地服务器的 /v1 基础地址。
 * @returns 固定能力和计费字段的 Radius 测试模型。
 * @example createModel("http://127.0.0.1:1234/v1");
 */
function createModel(baseUrl: string): Model<"pi-messages"> {
	return {
		id: "auto",
		name: "Radius Auto",
		api: "pi-messages",
		provider: "radius",
		baseUrl,
		reasoning: false,
		input: ["text"],
		cost: { input: 1, output: 2, cacheRead: 0.1, cacheWrite: 0.2 },
		contextWindow: 128000,
		maxTokens: 16384,
	};
}

/** 所有请求复用的最小用户会话上下文。 */
const context: Context = {
	messages: [{ role: "user", content: "Hello", timestamp: Date.now() }],
};

/** 成功终止事件中使用的固定令牌与成本统计。 */
const usage = {
	input: 10,
	output: 5,
	cacheRead: 0,
	cacheWrite: 0,
	totalTokens: 15,
	cost: { input: 0.1, output: 0.2, cacheRead: 0, cacheWrite: 0, total: 0.3 },
};

/** 覆盖 pi-messages 请求、事件、错误和缺失配置行为。 */
describe("pi-messages", () => {
	it("streams text and tool calls and resolves the terminal message", async () => {
		/** 本地服务器地址和收到的请求记录。 */
		const { baseUrl, requests } = await startServer({
			events: [
				{ type: "start" },
				{ type: "text_start", contentIndex: 0 },
				{ type: "text_delta", contentIndex: 0, delta: "Hel" },
				{ type: "text_delta", contentIndex: 0, delta: "lo" },
				{ type: "text_end", contentIndex: 0, content: "Hello" },
				{ type: "toolcall_start", contentIndex: 1, id: "call_1", toolName: "read" },
				{ type: "toolcall_delta", contentIndex: 1, delta: '{"path":' },
				{ type: "toolcall_delta", contentIndex: 1, delta: '"a.txt"}' },
				{
					type: "toolcall_end",
					contentIndex: 1,
					toolCall: { type: "toolCall", id: "call_1", name: "read", arguments: { path: "a.txt" } },
				},
				{ type: "done", reason: "toolUse", usage, responseId: "resp_1" },
			],
		});
		/** 指向本地服务器的被测模型。 */
		const model = createModel(baseUrl);

		/** 按到达顺序收集的标准助手事件。 */
		const events: AssistantMessageEvent[] = [];
		/** 带认证和请求选项的 pi-messages 事件流。 */
		const eventStream = stream(model, context, {
			apiKey: "test-key",
			sessionId: "session-1",
			toolChoice: "auto",
			maxTokens: 100,
			headers: { "x-custom": "1" },
		});
		/** event 是事件流当前产出的事件；循环将其全部收集以便后续断言。 */
		for await (const event of eventStream) {
			events.push(event);
		}
		/** 事件流终止后得到的最终助手消息。 */
		const message = await eventStream.result();

		expect(message.stopReason).toBe("toolUse");
		expect(message.usage).toEqual(usage);
		expect(message.responseId).toBe("resp_1");
		expect(message.model).toBe("auto");
		expect(message.provider).toBe("radius");
		expect(message.content).toEqual([
			{ type: "text", text: "Hello", textSignature: undefined },
			{ type: "toolCall", id: "call_1", name: "read", arguments: { path: "a.txt" } },
		]);
		expect(events.some((event) => event.type === "text_delta")).toBe(true);
		expect(events.filter((event) => event.type === "toolcall_end")).toHaveLength(1);

		expect(requests).toHaveLength(1);
		/** 本地服务器记录的唯一请求。 */
		const request = requests[0];
		expect(request.url).toBe("/v1/messages");
		expect(request.headers.authorization).toBe("Bearer test-key");
		expect(request.headers["x-custom"]).toBe("1");
		expect(request.body).toEqual({
			model: "auto",
			context,
			options: { maxTokens: 100, sessionId: "session-1", toolChoice: "auto" },
		});
	});

	it("appends debug=1 and reports response headers via onResponse", async () => {
		/** 带上游提供商响应头的服务器及请求记录。 */
		const { baseUrl, requests } = await startServer({
			headers: { "x-pi-gateway-upstream-provider": "anthropic" },
			events: [{ type: "done", reason: "stop", usage }],
		});
		/** 调试查询参数场景的模型。 */
		const model = createModel(baseUrl);

		/** onResponse 观察到的响应头。 */
		let observedHeaders: Record<string, string> | undefined;
		/** 开启调试并捕获响应头的请求选项。 */
		const options: PiMessagesOptions = {
			apiKey: "test-key",
			debug: true,
			onResponse: (response) => {
				observedHeaders = response.headers;
			},
		};
		/** 简化流消费后得到的成功消息。 */
		const message = await streamSimple(model, context, options).result();

		expect(message.stopReason).toBe("stop");
		expect(requests[0].url).toBe("/v1/messages?debug=1");
		expect(observedHeaders?.["x-pi-gateway-upstream-provider"]).toBe("anthropic");
	});

	it("surfaces backend error responses with diagnostics", async () => {
		/** 返回 401 结构化错误的本地服务器地址。 */
		const { baseUrl } = await startServer({
			status: 401,
			rawBody: JSON.stringify({ error: { message: "Token expired", code: "unauthorized" } }),
		});
		/** 后端错误场景的模型。 */
		const model = createModel(baseUrl);

		/** 包含诊断信息的错误消息。 */
		const message = await stream(model, context, { apiKey: "stale" }).result();

		expect(message.stopReason).toBe("error");
		expect(message.errorMessage).toContain("401");
		expect(message.errorMessage).toContain("Token expired");
		expect(message.errorMessage).toContain("unauthorized");
		expect(message.diagnostics?.[0]?.type).toBe("pi_messages_response_failure");
		expect(message.diagnostics?.[0]?.details?.status).toBe(401);
	});

	it("propagates server-sent error events", async () => {
		/** 通过 SSE error 事件终止的服务器地址。 */
		const { baseUrl } = await startServer({
			events: [{ type: "start" }, { type: "error", reason: "error", usage, errorMessage: "Upstream failed" }],
		});
		/** SSE 错误事件场景的模型。 */
		const model = createModel(baseUrl);

		/** 应透传上游错误和用量的最终消息。 */
		const message = await stream(model, context, { apiKey: "test-key" }).result();

		expect(message.stopReason).toBe("error");
		expect(message.errorMessage).toBe("Upstream failed");
		expect(message.usage).toEqual(usage);
	});

	it("errors when no API key is provided", async () => {
		/** 指向不可连接端口的模型；认证检查应先于网络请求失败。 */
		const model = createModel("http://127.0.0.1:1/v1");

		/** 缺少密钥时得到的标准错误消息。 */
		const message = await stream(model, context).result();

		expect(message.stopReason).toBe("error");
		expect(message.errorMessage).toContain("No API key provided");
	});

	it("errors when the stream ends without a terminal event", async () => {
		/** 只发送部分文本、不发送 done/error 的服务器地址。 */
		const { baseUrl } = await startServer({
			events: [
				{ type: "start" },
				{ type: "text_start", contentIndex: 0 },
				{ type: "text_delta", contentIndex: 0, delta: "partial" },
			],
		});
		/** 缺少终止事件场景的模型。 */
		const model = createModel(baseUrl);

		/** 流意外结束后生成的错误消息。 */
		const message = await stream(model, context, { apiKey: "test-key" }).result();

		expect(message.stopReason).toBe("error");
		expect(message.errorMessage).toContain("stream ended without a terminal event");
	});
});

/** 验证 pi-messages 已进入兼容层 API 类型和运行时注册表。 */
describe("pi-messages api registration", () => {
	it("is registered as a builtin api provider", async () => {
		/** 动态加载兼容层以检查内置 API 提供商注册。 */
		const { getApiProvider } = await import("../src/compat.ts");
		expect(getApiProvider("pi-messages")).toBeDefined();
	});

	it("is a known api usable on models", () => {
		/** 编译期与运行时都应接受的 pi-messages API 标识。 */
		const api: Api = "pi-messages";
		expect(api).toBe("pi-messages");
	});
});
