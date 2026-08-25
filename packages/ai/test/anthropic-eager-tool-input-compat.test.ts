/**
 * 文件职责：验证 Anthropic 工具请求在新式 eager_input_streaming、旧 Beta 头和严格 Schema 之间的兼容转换。
 * 技术维度：启动本地 HTTP 服务器捕获真实请求头与 JSON 体，使用 Vitest、TypeBox 和异步 SSE 流完成离线测试。
 * 产品维度：保障不同 Anthropic 兼容端点都能正确接收工具流式参数，严格工具保留完整输入约束。
 * 逻辑维度：构造模型、工具和上下文，捕获一次请求，再分别断言默认、旧协议、无工具和严格工具行为。
 * 关键边界：服务器绑定随机本地端口且必须在 finally 关闭；仅严格采样工具发送完整 Schema 元信息。
 * 新手阅读建议：先看 captureAnthropicRequest 的本地闭环，再比较 getFirstTool 和 getFirstToolInputSchema 断言。
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { Type } from "typebox";
import { describe, expect, it } from "vitest";
import { stream as streamAnthropic } from "../src/api/anthropic-messages.ts";
import type { Context, Model, Tool } from "../src/types.ts";

// CapturedRequest 保存本地服务器观察到的请求头和解析后的 JSON 请求体。
interface CapturedRequest {
	headers: IncomingMessage["headers"];
	body: Record<string, unknown>;
}

/** 构造指向本地服务器的 Anthropic 模型；参数 baseUrl 为端点，compat 为能力覆盖；返回完整 Model。 */
function createModel(baseUrl: string, compat?: Model<"anthropic-messages">["compat"]): Model<"anthropic-messages"> {
	return {
		id: "claude-opus-4-8",
		name: "Claude Opus 4.8",
		api: "anthropic-messages",
		provider: "test-anthropic",
		baseUrl,
		reasoning: true,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 200000,
		maxTokens: 32000,
		compat: { forceAdaptiveThinking: true, ...compat },
	};
}

// tool 是默认启用急切输入流的最小 lookup 工具。
const tool: Tool = {
	name: "lookup",
	description: "Look up a value",
	parameters: Type.Object({ value: Type.String() }),
};

// schemaCompatibilityTool 含完整 Schema 元信息，但没有声明严格约束采样。
const schemaCompatibilityTool: Tool = {
	...tool,
	parameters: Type.Object({ value: Type.String() }, { additionalProperties: false, title: "LookupInput" }),
};

// strictTool 显式偏好 JSON Schema 严格采样，应保留完整输入 Schema 并发送 strict。
const strictTool: Tool = {
	...tool,
	parameters: Type.Object({ value: Type.String() }, { additionalProperties: false, title: "StrictLookupInput" }),
	constrainedSampling: { type: "json_schema", strict: "prefer" },
};

/** 构造带可选工具数组的用户上下文；默认含 lookup 工具；返回 Context。 */
function createContext(tools: Tool[] = [tool]): Context {
	return {
		messages: [{ role: "user", content: "Use the tool", timestamp: Date.now() }],
		...(tools.length > 0 ? { tools } : {}),
	};
}

/**
 * 读取并解析本地 HTTP 请求体。
 * @param request Node.js IncomingMessage 流。
 * @returns JSON 对象 Promise；例如 `await readRequestBody(request)`。
 */
async function readRequestBody(request: IncomingMessage): Promise<Record<string, unknown>> {
	// chunks 按到达顺序收集请求体二进制片段。
	const chunks: Buffer[] = [];
	// chunk 是请求正文当前到达的二进制或字符串分片。
	for await (const chunk of request) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

/** 向客户端写入空的成功 SSE 响应；参数 response 为服务器响应；无返回值。 */
function writeEmptySseResponse(response: ServerResponse): void {
	response.writeHead(200, { "content-type": "text/event-stream" });
	response.end();
}

/**
 * 启动一次性本地服务器并捕获 Anthropic 客户端请求。
 * @param compat 待测模型兼容配置。
 * @param context 含工具的统一请求上下文。
 * @returns 捕获的头和请求体；例如 `await captureAnthropicRequest(undefined, createContext())`。
 */
async function captureAnthropicRequest(
	compat: Model<"anthropic-messages">["compat"],
	context: Context,
): Promise<CapturedRequest> {
	// capturedRequest 在服务器收到请求后赋值，结束时必须存在。
	let capturedRequest: CapturedRequest | undefined;

	// server 在随机本地端口读取请求并返回最小 SSE 响应。
	const server = createServer(async (request, response) => {
		capturedRequest = {
			headers: request.headers,
			body: await readRequestBody(request),
		};
		writeEmptySseResponse(response);
	});

	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	// address 是 server.listen 分配后的 TCP 地址信息。
	const address = server.address() as AddressInfo;

	try {
		// stream 是指向本地服务器的 Anthropic 消息流。
		const stream = streamAnthropic(createModel(`http://127.0.0.1:${address.port}`, compat), context, {
			apiKey: "test-key",
			cacheRetention: "none",
		});

		// event 是当前 Anthropic 流事件，完成或出错后停止消费。
		for await (const event of stream) {
			if (event.type === "done" || event.type === "error") break;
		}
	} finally {
		await new Promise<void>((resolve, reject) => {
			server.close((error) => (error ? reject(error) : resolve()));
		});
	}

	if (!capturedRequest) {
		throw new Error("Anthropic request was not captured");
	}
	return capturedRequest;
}

/** 从请求体取得首个工具对象；参数 body 为请求 JSON；返回工具记录，不存在时抛错。 */
function getFirstTool(body: Record<string, unknown>): Record<string, unknown> {
	// tools 是请求体中尚未完成类型校验的工具字段。
	const tools = body.tools;
	if (!Array.isArray(tools) || typeof tools[0] !== "object" || tools[0] === null) {
		throw new Error("Expected first tool in request body");
	}
	return tools[0] as Record<string, unknown>;
}

/** 从首个工具取得输入 Schema；参数 body 为请求 JSON；返回对象 Schema，不合法时抛错。 */
function getFirstToolInputSchema(body: Record<string, unknown>): Record<string, unknown> {
	// inputSchema 是首个工具尚未收窄类型的 input_schema 字段。
	const inputSchema = getFirstTool(body).input_schema;
	if (typeof inputSchema !== "object" || inputSchema === null || Array.isArray(inputSchema)) {
		throw new Error("Expected first tool input schema in request body");
	}
	return inputSchema as Record<string, unknown>;
}

// 验证 Anthropic 新旧工具流协议及严格 Schema 发送规则。
describe("Anthropic eager tool input streaming compatibility", () => {
	// 默认兼容配置应在每个工具上发送 eager_input_streaming=true。
	it("sends per-tool eager_input_streaming by default", async () => {
		// request 是默认配置下捕获的本地请求。
		const request = await captureAnthropicRequest(undefined, createContext());

		expect(getFirstTool(request.body).eager_input_streaming).toBe(true);
		expect(request.headers["anthropic-beta"]).toBeUndefined();
	});

	// 明确禁用新能力时应改发旧版 fine-grained Beta 请求头。
	it("uses the legacy fine-grained tool streaming beta when eager tool input streaming is disabled", async () => {
		// request 是关闭 eager 能力后的兼容请求。
		const request = await captureAnthropicRequest({ supportsEagerToolInputStreaming: false }, createContext());

		expect(getFirstTool(request.body).eager_input_streaming).toBeUndefined();
		expect(request.headers["anthropic-beta"]).toBe("fine-grained-tool-streaming-2025-05-14");
	});

	// 没有任何工具时不需要发送旧版工具流 Beta 头。
	it("does not send the legacy fine-grained tool streaming beta when there are no tools", async () => {
		// request 是空工具上下文对应的请求。
		const request = await captureAnthropicRequest({ supportsEagerToolInputStreaming: false }, createContext([]));

		expect(request.body.tools).toBeUndefined();
		expect(request.headers["anthropic-beta"]).toBeUndefined();
	});

	// 只有声明 constrainedSampling 的严格工具才保留 title 和 additionalProperties。
	it("only sends the full input schema for strict JSON-schema tools", async () => {
		// legacyRequest 是普通兼容工具请求，应裁剪 Schema 元信息。
		const legacyRequest = await captureAnthropicRequest(
			{ supportsStrictTools: true },
			createContext([schemaCompatibilityTool]),
		);
		// parameters 提取普通工具的核心 properties 和 required 供精确比较。
		const parameters = schemaCompatibilityTool.parameters as { properties?: unknown; required?: unknown };
		expect(getFirstToolInputSchema(legacyRequest.body)).toEqual({
			type: "object",
			properties: parameters.properties,
			required: parameters.required,
		});

		// strictRequest 是显式严格工具请求，应携带 strict 和完整 Schema。
		const strictRequest = await captureAnthropicRequest({ supportsStrictTools: true }, createContext([strictTool]));
		expect(getFirstTool(strictRequest.body).strict).toBe(true);
		expect(getFirstToolInputSchema(strictRequest.body)).toMatchObject({
			additionalProperties: false,
			title: "StrictLookupInput",
		});
	});
});
