/**
 * Proxy stream function for apps that route LLM calls through a server.
 * The server manages auth and proxies requests to LLM providers.
 */
/**
 * 文件职责：提供通过自建服务器转发 LLM 流式请求的客户端实现，并在本地重建完整助手消息。
 * 技术维度：使用 Fetch ReadableStream、SSE 文本帧、EventStream、增量 JSON 解析和 AbortSignal 处理代理协议。
 * 产品维度：让应用把凭据和提供商访问留在服务端，同时仍获得与直连提供商一致的文本、思考和工具调用事件。
 * 逻辑维度：先筛选可序列化请求选项，再读取代理 SSE 事件，processProxyEvent 按类型更新 partial 并推送标准事件。
 * 关键边界：代理必须实现 /api/stream 且返回 data: JSON 行；服务端会省略 partial；中止只作用于本地请求和读取器。
 * 新手阅读建议：先看 ProxyAssistantMessageEvent 协议，再看 streamProxy 的网络循环，最后逐个阅读 processProxyEvent 分支。
 */

// Internal import for JSON parsing utility
// 引入 pi-ai 的消息类型、事件流和增量 JSON 解析工具。
import {
	type AssistantMessage,
	type AssistantMessageEvent,
	type Context,
	EventStream,
	type Model,
	parseStreamingJson,
	type SimpleStreamOptions,
	type StopReason,
	type ToolCall,
} from "@earendil-works/pi-ai";

// Create stream class matching ProxyMessageEventStream
// 创建能把 done/error 事件收敛为最终助手消息的代理流。
/** 代理客户端使用的助手消息事件流。 */
class ProxyMessageEventStream extends EventStream<AssistantMessageEvent, AssistantMessage> {
	/** 配置终止事件判定与最终消息提取器。无参数。示例：new ProxyMessageEventStream()。 */
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
 * Proxy event types - server sends these with partial field stripped to reduce bandwidth.
 */
/** 代理服务发送的精简事件联合类型；为节省带宽不包含 partial 字段。 */
export type ProxyAssistantMessageEvent =
	| { type: "start" }
	| { type: "text_start"; contentIndex: number }
	| { type: "text_delta"; contentIndex: number; delta: string }
	| { type: "text_end"; contentIndex: number; contentSignature?: string }
	| { type: "thinking_start"; contentIndex: number }
	| { type: "thinking_delta"; contentIndex: number; delta: string }
	| { type: "thinking_end"; contentIndex: number; contentSignature?: string }
	| { type: "toolcall_start"; contentIndex: number; id: string; toolName: string }
	| { type: "toolcall_delta"; contentIndex: number; delta: string }
	| { type: "toolcall_end"; contentIndex: number }
	| {
			type: "done";
			reason: Extract<StopReason, "stop" | "length" | "toolUse">;
			usage: AssistantMessage["usage"];
	  }
	| {
			type: "error";
			reason: Extract<StopReason, "aborted" | "error">;
			errorMessage?: string;
			usage: AssistantMessage["usage"];
	  };

/** 允许序列化并发送到代理服务的流选项子集。 */
type ProxySerializableStreamOptions = Pick<
	SimpleStreamOptions,
	| "temperature"
	| "maxTokens"
	| "reasoning"
	| "cacheRetention"
	| "sessionId"
	| "headers"
	| "metadata"
	| "transport"
	| "thinkingBudgets"
	| "maxRetryDelayMs"
>;

export interface ProxyStreamOptions extends ProxySerializableStreamOptions {
	/** Local abort signal for the proxy request */
	/** 代理请求的本地中止信号，不会序列化。 */
	signal?: AbortSignal;
	/** Auth token for the proxy server */
	/** 访问代理服务器的 Bearer 令牌。 */
	authToken: string;
	/** Proxy server URL (e.g., "https://genai.example.com") */
	/** 代理服务器基础 URL，例如 https://genai.example.com。 */
	proxyUrl: string;
}

/**
 * Stream function that proxies through a server instead of calling LLM providers directly.
 * The server strips the partial field from delta events to reduce bandwidth.
 * We reconstruct the partial message client-side.
 *
 * Use this as the `streamFn` option when creating an Agent that needs to go through a proxy.
 *
 * @example
 * ```typescript
 * const agent = new Agent({
 *   streamFn: (model, context, options) =>
 *     streamProxy(model, context, {
 *       ...options,
 *       authToken: await getAuthToken(),
 *       proxyUrl: "https://genai.example.com",
 *     }),
 * });
 * ```
 */
/** 从完整代理选项挑选可发往服务器的字段。返回新对象。示例：buildProxyRequestOptions(options)。 */
function buildProxyRequestOptions(options: ProxyStreamOptions): ProxySerializableStreamOptions {
	return {
		temperature: options.temperature,
		maxTokens: options.maxTokens,
		reasoning: options.reasoning,
		cacheRetention: options.cacheRetention,
		sessionId: options.sessionId,
		headers: options.headers,
		metadata: options.metadata,
		transport: options.transport,
		thinkingBudgets: options.thinkingBudgets,
		maxRetryDelayMs: options.maxRetryDelayMs,
	};
}

/** 通过代理服务器发起流式模型请求。参数依次为模型、上下文和代理选项；立即返回事件流。 */
export function streamProxy(model: Model<any>, context: Context, options: ProxyStreamOptions): ProxyMessageEventStream {
	/** 调用方订阅并等待结果的代理事件流。 */
	const stream = new ProxyMessageEventStream();

	(async () => {
		// Initialize the partial message that we'll build up from events
		// 初始化将在各增量事件中持续补全的助手消息。
		/** 由精简代理事件逐步重建的助手消息。 */
		const partial: AssistantMessage = {
			role: "assistant",
			stopReason: "stop",
			content: [],
			api: model.api,
			provider: model.provider,
			model: model.id,
			usage: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 0,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			timestamp: Date.now(),
		};

		/** 当前响应体读取器，中止时用于主动 cancel。 */
		let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

		/** AbortSignal 回调：取消正在进行的响应体读取。 */
		const abortHandler = () => {
			if (reader) {
				reader.cancel("Request aborted by user").catch(() => {});
			}
		};

		if (options.signal) {
			options.signal.addEventListener("abort", abortHandler);
		}

		try {
			/** 代理 /api/stream 返回的 HTTP 响应。 */
			const response = await fetch(`${options.proxyUrl}/api/stream`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${options.authToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					model,
					context,
					options: buildProxyRequestOptions(options),
				}),
				signal: options.signal,
			});

			if (!response.ok) {
				/** 默认包含 HTTP 状态的代理错误文本。 */
				let errorMessage = `Proxy error: ${response.status} ${response.statusText}`;
				try {
					/** 代理可能返回的结构化错误体。 */
					const errorData = (await response.json()) as { error?: string };
					if (errorData.error) {
						errorMessage = `Proxy error: ${errorData.error}`;
					}
				} catch {
					// Couldn't parse error response
					// 错误响应无法解析时保留 HTTP 状态文本。
				}
				throw new Error(errorMessage);
			}

			reader = response.body!.getReader();
			/** 将响应字节增量解码为文本。 */
			const decoder = new TextDecoder();
			/** 保存尚未遇到换行的半条 SSE 数据。 */
			let buffer = "";

			while (true) {
				/** 本次读取的完成标记和字节块。 */
				const { done, value } = await reader.read();
				if (done) break;

				if (options.signal?.aborted) {
					throw new Error("Request aborted by user");
				}

				buffer += decoder.decode(value, { stream: true });
				/** 本轮解码后按换行拆出的完整或不完整行。 */
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";

				// line 是本次网络分片中已经完整结束的一行 SSE 文本。
				for (const line of lines) {
					if (line.startsWith("data: ")) {
						/** 去除 SSE data: 前缀后的 JSON 文本。 */
						const data = line.slice(6).trim();
						if (data) {
							/** 服务端发送的精简代理事件。 */
							const proxyEvent = JSON.parse(data) as ProxyAssistantMessageEvent;
							/** 转换为标准助手事件后的结果。 */
							const event = processProxyEvent(proxyEvent, partial);
							if (event) {
								stream.push(event);
							}
						}
					}
				}
			}

			if (options.signal?.aborted) {
				throw new Error("Request aborted by user");
			}

			stream.end();
		} catch (error) {
			/** 捕获异常转换出的用户可读错误文本。 */
			const errorMessage = error instanceof Error ? error.message : String(error);
			/** 根据信号状态区分用户中止和一般错误。 */
			const reason = options.signal?.aborted ? "aborted" : "error";
			partial.stopReason = reason;
			partial.errorMessage = errorMessage;
			stream.push({
				type: "error",
				reason,
				error: partial,
			});
			stream.end();
		} finally {
			if (options.signal) {
				options.signal.removeEventListener("abort", abortHandler);
			}
		}
	})();

	return stream;
}

/**
 * Process a proxy event and update the partial message.
 */
/** 处理单个代理事件并原地更新 partial。返回应推送的标准事件，无法产生事件时返回 undefined。 */
function processProxyEvent(
	proxyEvent: ProxyAssistantMessageEvent,
	partial: AssistantMessage,
): AssistantMessageEvent | undefined {
	switch (proxyEvent.type) {
		case "start":
			return { type: "start", partial };

		case "text_start":
			partial.content[proxyEvent.contentIndex] = { type: "text", text: "" };
			return { type: "text_start", contentIndex: proxyEvent.contentIndex, partial };

		case "text_delta": {
			/** 指定索引处应为文本的部分内容块。 */
			const content = partial.content[proxyEvent.contentIndex];
			if (content?.type === "text") {
				content.text += proxyEvent.delta;
				return {
					type: "text_delta",
					contentIndex: proxyEvent.contentIndex,
					delta: proxyEvent.delta,
					partial,
				};
			}
			throw new Error("Received text_delta for non-text content");
		}

		case "text_end": {
			/** 指定索引处即将完成的文本内容块。 */
			const content = partial.content[proxyEvent.contentIndex];
			if (content?.type === "text") {
				content.textSignature = proxyEvent.contentSignature;
				return {
					type: "text_end",
					contentIndex: proxyEvent.contentIndex,
					content: content.text,
					partial,
				};
			}
			throw new Error("Received text_end for non-text content");
		}

		case "thinking_start":
			partial.content[proxyEvent.contentIndex] = { type: "thinking", thinking: "" };
			return { type: "thinking_start", contentIndex: proxyEvent.contentIndex, partial };

		case "thinking_delta": {
			/** 指定索引处应为思考内容的部分块。 */
			const content = partial.content[proxyEvent.contentIndex];
			if (content?.type === "thinking") {
				content.thinking += proxyEvent.delta;
				return {
					type: "thinking_delta",
					contentIndex: proxyEvent.contentIndex,
					delta: proxyEvent.delta,
					partial,
				};
			}
			throw new Error("Received thinking_delta for non-thinking content");
		}

		case "thinking_end": {
			/** 指定索引处即将完成的思考内容块。 */
			const content = partial.content[proxyEvent.contentIndex];
			if (content?.type === "thinking") {
				content.thinkingSignature = proxyEvent.contentSignature;
				return {
					type: "thinking_end",
					contentIndex: proxyEvent.contentIndex,
					content: content.thinking,
					partial,
				};
			}
			throw new Error("Received thinking_end for non-thinking content");
		}

		case "toolcall_start":
			partial.content[proxyEvent.contentIndex] = {
				type: "toolCall",
				id: proxyEvent.id,
				name: proxyEvent.toolName,
				arguments: {},
				partialJson: "",
			} satisfies ToolCall & { partialJson: string } as ToolCall;
			return { type: "toolcall_start", contentIndex: proxyEvent.contentIndex, partial };

		case "toolcall_delta": {
			/** 指定索引处应为工具调用的部分内容块。 */
			const content = partial.content[proxyEvent.contentIndex];
			if (content?.type === "toolCall") {
				(content as any).partialJson += proxyEvent.delta;
				content.arguments = parseStreamingJson((content as any).partialJson) || {};
				partial.content[proxyEvent.contentIndex] = { ...content }; // Trigger reactivity
				// 创建浅拷贝以触发依赖引用变化的响应式更新。
				return {
					type: "toolcall_delta",
					contentIndex: proxyEvent.contentIndex,
					delta: proxyEvent.delta,
					partial,
				};
			}
			throw new Error("Received toolcall_delta for non-toolCall content");
		}

		case "toolcall_end": {
			/** 指定索引处即将完成的工具调用内容块。 */
			const content = partial.content[proxyEvent.contentIndex];
			if (content?.type === "toolCall") {
				delete (content as any).partialJson;
				return {
					type: "toolcall_end",
					contentIndex: proxyEvent.contentIndex,
					toolCall: content,
					partial,
				};
			}
			return undefined;
		}

		case "done":
			partial.stopReason = proxyEvent.reason;
			partial.usage = proxyEvent.usage;
			return { type: "done", reason: proxyEvent.reason, message: partial };

		case "error":
			partial.stopReason = proxyEvent.reason;
			partial.errorMessage = proxyEvent.errorMessage;
			partial.usage = proxyEvent.usage;
			return { type: "error", reason: proxyEvent.reason, error: partial };

		default: {
			/** 编译期穷尽检查；新增事件类型时此处会报类型错误。 */
			const _exhaustiveCheck: never = proxyEvent;
			console.warn(`Unhandled proxy event type: ${(proxyEvent as any).type}`);
			return undefined;
		}
	}
}
