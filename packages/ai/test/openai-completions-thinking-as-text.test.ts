/**
 * 文件职责：验证要求“推理转文本”的 OpenAI Completions 兼容端点能重放 thinking 内容并成功发送请求。
 * 技术维度：使用 Vitest、消息转换器、本地 HTTP/SSE 服务器和异步事件收集器执行单元及离线集成测试。
 * 产品维度：保障某些兼容模型在续聊时不会因专用 thinking 块而拒绝历史消息，并保留可读推理文本。
 * 逻辑维度：构造固定模型、助手消息和上下文，先断言序列化结果，再通过本地端点验证完整流请求。
 * 关键边界：仅 compat.requiresThinkingAsText 为 true 时适用；本地服务器必须在 finally 中关闭。
 * 新手阅读建议：先看 buildContext 和 convertMessages 两个纯转换用例，再跟随 SSE 服务器的请求与完成事件。
 */
import { once } from "node:events";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { convertMessages, stream as streamOpenAICompletions } from "../src/api/openai-completions.ts";
import type {
	AssistantMessage,
	AssistantMessageEvent,
	Context,
	Model,
	OpenAICompletionsCompat,
	Usage,
} from "../src/types.ts";

// emptyUsage 是构造历史助手消息所需的零令牌用量。
const emptyUsage: Usage = {
	input: 0,
	output: 0,
	cacheRead: 0,
	cacheWrite: 0,
	totalTokens: 0,
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

// compat 模拟要求把 thinking 作为普通文本发送的完整 OpenAI Completions 能力集合。
const compat = {
	supportsStore: true,
	supportsDeveloperRole: true,
	supportsReasoningEffort: true,
	supportsUsageInStreaming: true,
	maxTokensField: "max_completion_tokens",
	requiresToolResultName: false,
	requiresAssistantAfterToolResult: false,
	requiresThinkingAsText: true,
	requiresReasoningContentOnAssistantMessages: false,
	thinkingFormat: "openai",
	openRouterRouting: {},
	vercelGatewayRouting: {},
	chatTemplateKwargs: {},
	zaiToolStream: false,
	supportsStrictMode: true,
	supportsOpenAIGrammarTools: false,
	cacheControlFormat: undefined,
	sendSessionAffinityHeaders: false,
	sessionAffinityFormat: "openai",
	supportsLongCacheRetention: true,
} satisfies Omit<Required<OpenAICompletionsCompat>, "cacheControlFormat" | "deferredToolsMode"> & {
	cacheControlFormat?: OpenAICompletionsCompat["cacheControlFormat"];
	deferredToolsMode?: OpenAICompletionsCompat["deferredToolsMode"];
};

/** 构造测试模型；参数 baseUrl 默认为不可用本地地址，可覆盖为测试服务器；返回 Model。 */
function buildModel(baseUrl = "http://127.0.0.1:1"): Model<"openai-completions"> {
	return {
		id: "repro-model",
		name: "Repro Model",
		api: "openai-completions",
		provider: "repro-provider",
		baseUrl,
		reasoning: true,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128000,
		maxTokens: 4096,
		compat,
	};
}

/** 构造固定来源的历史助手消息；参数 content 为 thinking/text 内容块；返回 AssistantMessage。 */
function buildAssistant(content: AssistantMessage["content"]): AssistantMessage {
	return {
		role: "assistant",
		content,
		api: "openai-completions",
		provider: "repro-provider",
		model: "repro-model",
		usage: emptyUsage,
		stopReason: "stop",
		timestamp: 2,
	};
}

/** 构造用户、历史助手、继续请求三条消息的上下文；参数 assistant 为待重放消息；返回 Context。 */
function buildContext(assistant: AssistantMessage): Context {
	return {
		messages: [
			{ role: "user", content: "hello", timestamp: 1 },
			assistant,
			{ role: "user", content: "continue", timestamp: 3 },
		],
	};
}

/** 收集异步助手事件流中的全部事件；参数 stream 为异步可迭代对象；返回事件数组 Promise。 */
async function collectEvents(stream: AsyncIterable<AssistantMessageEvent>): Promise<AssistantMessageEvent[]> {
	// events 按到达顺序累积流事件。
	const events: AssistantMessageEvent[] = [];
	// event 是当前标准化流事件，按原始到达顺序保存。
	for await (const event of stream) {
		events.push(event);
	}
	return events;
}

// ChatCompletionsRequestBody 描述本地服务器需要检查的请求字段。
interface ChatCompletionsRequestBody {
	model: string;
	messages: Array<{ role: string; content?: unknown }>;
	stream: boolean;
	stream_options?: { include_usage?: boolean };
}

// 验证 thinking-as-text 配置下的历史序列化和网络请求闭环。
describe("openai-completions thinking-as-text replay", () => {
	// 每个用例后移除可能影响认证路径的 OpenAI 环境密钥。
	afterEach(() => {
		delete process.env.OPENAI_API_KEY;
	});

	// 同一模型历史含 thinking 和 text 时，两者都应成为助手文本内容块。
	it("serializes same-model thinking-plus-text replay as assistant text parts", () => {
		// messages 是转换为 OpenAI 协议后的消息数组。
		const messages = convertMessages(
			buildModel(),
			buildContext(
				buildAssistant([
					{ type: "thinking", thinking: "internal reasoning" },
					{ type: "text", text: "visible answer" },
				]),
			),
			compat,
		);

		expect(messages[1]).toEqual({
			role: "assistant",
			content: [
				{ type: "text", text: "internal reasoning" },
				{ type: "text", text: "visible answer" },
			],
		});
	});

	// 只有 thinking 而无可见文本时也应生成有效助手文本消息。
	it("serializes same-model thinking-only replay as assistant text parts", () => {
		// messages 是 thinking-only 历史的转换结果。
		const messages = convertMessages(
			buildModel(),
			buildContext(buildAssistant([{ type: "thinking", thinking: "internal reasoning" }])),
			compat,
		);

		expect(messages[1]).toEqual({
			role: "assistant",
			content: [{ type: "text", text: "internal reasoning" }],
		});
	});

	// 完整流请求应到达本地端点，且正文使用转换后的两个文本块。
	it("reaches the endpoint when replay contains both thinking and text", async () => {
		// requestBodies 收集服务器收到的 Chat Completions 请求。
		const requestBodies: ChatCompletionsRequestBody[] = [];
		// server 校验路径、读取 JSON 请求并返回最小成功 SSE 流。
		const server = http.createServer(async (req, res) => {
			if (req.method !== "POST" || req.url !== "/chat/completions") {
				res.writeHead(404).end();
				return;
			}

			// body 逐块拼接 POST 请求正文。
			let body = "";
			// chunk 是当前 HTTP 请求正文分片，转换为字符串后追加。
			for await (const chunk of req) {
				body += chunk.toString();
			}
			requestBodies.push(JSON.parse(body) as ChatCompletionsRequestBody);

			res.writeHead(200, {
				"content-type": "text/event-stream",
				"cache-control": "no-cache",
				connection: "keep-alive",
			});
			res.write(
				`data: ${JSON.stringify({
					id: "chatcmpl-repro",
					object: "chat.completion.chunk",
					created: 0,
					model: "repro-model",
					choices: [{ index: 0, delta: { role: "assistant", content: "ok" }, finish_reason: null }],
				})}\n\n`,
			);
			res.write(
				`data: ${JSON.stringify({
					id: "chatcmpl-repro",
					object: "chat.completion.chunk",
					created: 0,
					model: "repro-model",
					choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
					usage: { prompt_tokens: 1, completion_tokens: 1 },
				})}\n\n`,
			);
			res.write("data: [DONE]\n\n");
			res.end();
		});

		server.listen(0, "127.0.0.1");
		await once(server, "listening");

		try {
			// port 是操作系统为本地服务器分配的随机端口。
			const { port } = server.address() as AddressInfo;
			// events 是客户端从本地 SSE 响应解析出的完整事件序列。
			const events = await collectEvents(
				streamOpenAICompletions(
					buildModel(`http://127.0.0.1:${port}`),
					buildContext(
						buildAssistant([
							{ type: "thinking", thinking: "internal reasoning" },
							{ type: "text", text: "visible answer" },
						]),
					),
					{ apiKey: "test-key" },
				),
			);

			expect(requestBodies).toHaveLength(1);
			expect(requestBodies[0]?.messages[1]).toEqual({
				role: "assistant",
				content: [
					{ type: "text", text: "internal reasoning" },
					{ type: "text", text: "visible answer" },
				],
			});

			// terminalEvent 是流的最后事件，预期表示正常 done。
			const terminalEvent = events.at(-1);
			expect(terminalEvent?.type).toBe("done");
		} finally {
			server.close();
			await once(server, "close");
		}
	});
});
