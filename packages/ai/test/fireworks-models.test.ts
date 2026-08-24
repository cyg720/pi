/**
 * 文件职责：验证 Fireworks 内置模型元数据、环境认证、Anthropic 兼容选项及实际请求头/工具字段。
 * 技术维度：使用 Vitest、本地 HTTP/SSE 服务器、TypeBox 工具和真实 Anthropic Messages 适配器。
 * 产品维度：确保 Fireworks 模型目录准确，并让会话亲和与工具缓存字段符合其兼容接口限制。
 * 逻辑维度：先检查静态模型注册和密钥，再构造本地请求捕获器，对比 Fireworks 与原生 Anthropic。
 * 关键边界：本地服务器只返回空 SSE；模型 baseUrl 会临时覆盖；环境变量必须在用例后恢复。
 * 新手阅读建议：先读静态目录用例理解 compat，再看 captureAnthropicRequest，最后比较两个提供商请求。
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { Type } from "typebox";
import { afterEach, describe, expect, it } from "vitest";
import { stream as streamAnthropic } from "../src/api/anthropic-messages.ts";
import { getModel, getModels } from "../src/compat.ts";
import { findEnvKeys, getEnvApiKey } from "../src/env-api-keys.ts";
import type { Context, Model, Tool } from "../src/types.ts";

/** 测试前已有的 Fireworks API Key。 */
const originalFireworksApiKey = process.env.FIREWORKS_API_KEY;

/** 每个用例后恢复 Fireworks API Key。 */
afterEach(() => {
	if (originalFireworksApiKey === undefined) {
		delete process.env.FIREWORKS_API_KEY;
	} else {
		process.env.FIREWORKS_API_KEY = originalFireworksApiKey;
	}
});

/** 覆盖 Fireworks 模型目录、认证和兼容能力元数据。 */
describe("Fireworks models", () => {
	it("registers the default Kimi K2.6 model via Anthropic-compatible Messages API", () => {
		/** 默认 Kimi K2.6 模型。 */
		const model = getModel("fireworks", "accounts/fireworks/models/kimi-k2p6");

		expect(model).toBeDefined();
		expect(model.api).toBe("anthropic-messages");
		expect(model.provider).toBe("fireworks");
		expect(model.baseUrl).toBe("https://api.fireworks.ai/inference");
		expect(model.reasoning).toBe(true);
		expect(model.input).toEqual(["text", "image"]);
		expect(model.contextWindow).toBe(262000);
		expect(model.maxTokens).toBe(262000);
		expect(model.cost).toEqual({
			input: 0.95,
			output: 4,
			cacheRead: 0.16,
			cacheWrite: 0,
		});
	});

	it("registers the Fire Pass turbo router model", () => {
		/** Fire Pass turbo 路由模型。 */
		const model = getModels("fireworks").find(
			(candidate) => candidate.id.startsWith("accounts/fireworks/routers/") && candidate.id.endsWith("-turbo"),
		);

		expect(model).toBeDefined();
		expect(model?.api).toBe("anthropic-messages");
		expect(model?.baseUrl).toBe("https://api.fireworks.ai/inference");
		expect(model?.input).toEqual(["text", "image"]);
	});

	it("aligns GLM 5.2 Fast with GLM 5.2's OpenAI-compatible config", () => {
		/** 标准 GLM 5.2 模型。 */
		const base = getModel("fireworks", "accounts/fireworks/models/glm-5p2");
		/** GLM 5.2 Fast 路由模型。 */
		const fast = getModel("fireworks", "accounts/fireworks/routers/glm-5p2-fast");

		expect(fast.api).toBe(base.api);
		expect(fast.baseUrl).toBe(base.baseUrl);
		expect(fast.compat).toEqual(base.compat);
		expect(fast.thinkingLevelMap).toEqual(base.thinkingLevelMap);
	});

	it("resolves FIREWORKS_API_KEY from the environment", () => {
		process.env.FIREWORKS_API_KEY = "test-fireworks-key";

		expect(findEnvKeys("fireworks")).toEqual(["FIREWORKS_API_KEY"]);
		expect(getEnvApiKey("fireworks")).toBe("test-fireworks-key");
	});

	it("sets Fireworks-specific compat for session affinity and unsupported tool fields", () => {
		/** 具有 Fireworks 特定兼容配置的 Kimi 模型。 */
		const model = getModel("fireworks", "accounts/fireworks/models/kimi-k2p6");

		expect(model.compat).toBeDefined();
		expect(model.compat?.sendSessionAffinityHeaders).toBe(true);
		expect(model.compat?.supportsEagerToolInputStreaming).toBe(false);
		expect(model.compat?.supportsCacheControlOnTools).toBe(false);
		expect(model.compat?.supportsLongCacheRetention).toBe(false);
	});
});

// --- Integration tests for Fireworks Anthropic session affinity and tool compat ---
// --- Fireworks Anthropic 会话亲和与工具兼容集成测试。---

/** 本地服务器捕获的请求头与 JSON 正文。 */
interface CapturedRequest {
	headers: IncomingMessage["headers"];
	body: Record<string, unknown>;
}

/** 请求转换使用的 lookup 工具。 */
const tool: Tool = {
	name: "lookup",
	description: "Look up a value",
	parameters: Type.Object({ value: Type.String() }),
};

/** Fireworks Anthropic 接口的固定兼容能力。 */
const FIREWORKS_ANTHROPIC_COMPAT = {
	sendSessionAffinityHeaders: true,
	supportsEagerToolInputStreaming: false,
	supportsCacheControlOnTools: false,
	supportsLongCacheRetention: false,
} satisfies NonNullable<Model<"anthropic-messages">["compat"]>;

/**
 * 创建带可覆盖兼容配置的 Fireworks Anthropic 模型。
 * @param compat 会话亲和、工具字段与缓存能力。
 * @returns 本地捕获器可覆盖 baseUrl 的测试模型。
 */
function createFireworksModel(
	compat: Model<"anthropic-messages">["compat"] = FIREWORKS_ANTHROPIC_COMPAT,
): Model<"anthropic-messages"> {
	return {
		id: "accounts/fireworks/models/kimi-k2p6",
		name: "Kimi K2.6",
		api: "anthropic-messages",
		provider: "fireworks",
		baseUrl: "http://127.0.0.1:0", // overridden by captureAnthropicRequest
		// captureAnthropicRequest 会把占位地址覆盖为真实本地端口。
		reasoning: true,
		input: ["text", "image"],
		cost: { input: 0.95, output: 4, cacheRead: 0.16, cacheWrite: 0 },
		contextWindow: 262000,
		maxTokens: 262000,
		compat,
	};
}

/**
 * 创建用于对照的原生 Anthropic 模型。
 * @returns 本地捕获器可覆盖 baseUrl 的 Claude 模型。
 */
function createAnthropicModel(): Model<"anthropic-messages"> {
	return {
		id: "claude-opus-4-8",
		name: "Claude Opus 4.8",
		api: "anthropic-messages",
		provider: "anthropic",
		baseUrl: "http://127.0.0.1:0", // overridden by captureAnthropicRequest
		// captureAnthropicRequest 会把占位地址覆盖为真实本地端口。
		reasoning: true,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 200000,
		maxTokens: 32000,
	};
}

/**
 * 创建请求使用的最小用户上下文。
 * @param tools 工具列表，空列表时省略 tools 字段。
 * @returns 请求使用的统一 Context。
 */
function createContext(tools: Tool[] = [tool]): Context {
	return {
		messages: [{ role: "user", content: "Use the tool", timestamp: Date.now() }],
		...(tools.length > 0 ? { tools } : {}),
	};
}

/**
 * 读取并解析 Node HTTP 请求正文。
 * @param request 正在接收的请求。
 * @returns JSON 对象正文。
 */
async function readRequestBody(request: IncomingMessage): Promise<Record<string, unknown>> {
	/** 按到达顺序收集的请求字节块。 */
	const chunks: Buffer[] = [];
	for await (const chunk of request) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

/**
 * 写入成功但不含事件的 SSE 响应。
 * @param response Node HTTP 响应。
 * @returns 无返回值。
 */
function writeEmptySseResponse(response: ServerResponse): void {
	response.writeHead(200, { "content-type": "text/event-stream" });
	response.end();
}

/**
 * 启动本地服务器并捕获一次 Anthropic 适配器请求。
 * @param model 被测模型。
 * @param context 会话上下文。
 * @param options 会话 ID 与缓存保留覆盖。
 * @returns 捕获的请求头和正文。
 */
async function captureAnthropicRequest(
	model: Model<"anthropic-messages">,
	context: Context,
	options?: { sessionId?: string; cacheRetention?: string },
): Promise<CapturedRequest> {
	/** 本地服务器收到的请求，发送前为空。 */
	let capturedRequest: CapturedRequest | undefined;

	/** 读取请求后返回空 SSE 的本地服务器。 */
	const server = createServer(async (request, response) => {
		capturedRequest = {
			headers: request.headers,
			body: await readRequestBody(request),
		};
		writeEmptySseResponse(response);
	});

	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	/** 服务器随机监听端口信息。 */
	const address = server.address() as AddressInfo;

	try {
		// Override the model's baseUrl to point to the local test server
		// 将模型 baseUrl 指向本地测试服务器。
		/** 指向本地随机端口的模型副本。 */
		const localModel = { ...model, baseUrl: `http://127.0.0.1:${address.port}` };

		/** 发出捕获请求的 Anthropic 消息流。 */
		const stream = streamAnthropic(localModel, context, {
			apiKey: "test-key",
			cacheRetention: (options?.cacheRetention as "none" | "short" | "long") ?? "short",
			sessionId: options?.sessionId,
		});

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

/**
 * 从请求正文安全取得工具数组。
 * @param body 捕获的请求正文。
 * @returns 工具对象数组，字段缺失时抛错。
 */
function getTools(body: Record<string, unknown>): Record<string, unknown>[] {
	/** 未缩窄的 tools 字段。 */
	const tools = body.tools;
	if (!Array.isArray(tools)) {
		throw new Error("Expected tools in request body");
	}
	return tools as Record<string, unknown>[];
}

/** 对比 Fireworks 与原生 Anthropic 的会话亲和和工具兼容字段。 */
describe("Fireworks Anthropic session affinity and tool compat", () => {
	it("sends x-session-affinity header for Fireworks models", async () => {
		const model = createFireworksModel();
		// Need a real port, capture will assign one
		const request = await captureAnthropicRequest(model, createContext(), {
			sessionId: "fireworks-session-1",
		});

		expect(request.headers["x-session-affinity"]).toBe("fireworks-session-1");
	});

	it("omits x-session-affinity header for native Anthropic models", async () => {
		const model = createAnthropicModel();
		const request = await captureAnthropicRequest(model, createContext(), {
			sessionId: "anthropic-session-1",
		});

		expect(request.headers["x-session-affinity"]).toBeUndefined();
	});

	it("omits x-session-affinity header when cacheRetention is none", async () => {
		const model = createFireworksModel();
		const request = await captureAnthropicRequest(model, createContext(), {
			sessionId: "fireworks-session-2",
			cacheRetention: "none",
		});

		expect(request.headers["x-session-affinity"]).toBeUndefined();
	});

	it("omits cache_control on tools for Fireworks models", async () => {
		const model = createFireworksModel();
		const request = await captureAnthropicRequest(model, createContext());

		const tools = getTools(request.body);
		const lastTool = tools[tools.length - 1];
		expect(lastTool.cache_control).toBeUndefined();
	});

	it("omits eager_input_streaming on tools for Fireworks models", async () => {
		const model = createFireworksModel();
		const request = await captureAnthropicRequest(model, createContext());

		const tools = getTools(request.body);
		for (const t of tools) {
			expect(t.eager_input_streaming).toBeUndefined();
		}
	});

	it("sends cache_control on tools for native Anthropic models", async () => {
		const model = createAnthropicModel();
		const request = await captureAnthropicRequest(model, createContext());

		const tools = getTools(request.body);
		const lastTool = tools[tools.length - 1];
		expect(lastTool.cache_control).toBeDefined();
		expect((lastTool.cache_control as { type: string }).type).toBe("ephemeral");
	});

	it("sends eager_input_streaming on tools for native Anthropic models", async () => {
		const model = createAnthropicModel();
		const request = await captureAnthropicRequest(model, createContext());

		const tools = getTools(request.body);
		expect(tools[0].eager_input_streaming).toBe(true);
	});
});
