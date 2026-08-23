/**
 * 【文件职责】懒加载流式机制：在同步返回事件流的同时于后台执行异步初始化
 *              （认证解析/模块加载），初始化失败以错误事件终止流。
 * 【技术维度】外层 EventStream 立即返回；setup Promise 链转发内层事件；
 *              初始化失败合成带 stopReason:"error" 的助手消息。
 * 【产品维度】让 API 模块（尤其含 Node 专属依赖者）按需加载，加速启动并保持摇树友好。
 * 【逻辑维度】createSetupErrorMessage 合成失败消息 → forwardStream 转发事件与结果 →
 *              lazyStream 编排 → lazyApi 包装动态导入模块为 ProviderStreams。
 * 【关键边界】setup 失败绝不抛出（编码进流）；内层有 result() 时转发时一并结算；
 *              动态导入走宿主 import 缓存去重。
 * 【新手阅读建议】先读 lazyStream 的 then/catch 编排 → 再看 lazyApi 的 stream/streamSimple 包装。
 */
import type { Api, AssistantMessage, AssistantMessageEvent, Model, ProviderStreams } from "../types.ts";
import { AssistantMessageEventStream } from "../utils/event-stream.ts";

// 合成初始化失败消息（私有）：空内容 + stopReason:"error" + 错误信息 + 全零用量
function createSetupErrorMessage(model: Model<Api>, error: unknown): AssistantMessage {
	return {
		role: "assistant",
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
		stopReason: "error",
		errorMessage: error instanceof Error ? error.message : String(error),
		timestamp: Date.now(),
	};
}

// 类型守卫：源是否有 result()（私有）
function hasResult(
	source: AsyncIterable<AssistantMessageEvent>,
): source is AsyncIterable<AssistantMessageEvent> & { result(): Promise<AssistantMessage> } {
	return typeof (source as { result?: unknown }).result === "function";
}

// 转发内层事件到外层流（私有）：结束时把内层结果（若有）传给 end
async function forwardStream(
	target: AssistantMessageEventStream,
	source: AsyncIterable<AssistantMessageEvent>,
): Promise<void> {
	for await (const event of source) {
		target.push(event);
	}
	target.end(hasResult(source) ? await source.result() : undefined);
}

/**
 * Returns a stream synchronously while running async setup (auth resolution,
 * lazy module loading) behind it. Setup failures terminate the stream with an
 * error event.
 */
// 懒流（公开）：同步返回流，后台执行 setup；失败以错误事件终止
export function lazyStream(
	model: Model<Api>,
	setup: () => Promise<AsyncIterable<AssistantMessageEvent>>,
): AssistantMessageEventStream {
	const outer = new AssistantMessageEventStream();

	setup()
		.then((inner) => forwardStream(outer, inner))
		.catch((error) => {
			const message = createSetupErrorMessage(model, error);
			outer.push({ type: "error", reason: "error", error: message });
			outer.end(message);
		});

	return outer;
}

/**
 * Wraps a dynamically imported API implementation module as `ProviderStreams`.
 * The module loads on first stream call; the host's import cache deduplicates
 * loads. Load failures terminate the returned stream with an error event.
 */
// 懒 API 包装（公开）：把动态导入的 API 模块包装为 ProviderStreams；
// 首次流调用时才加载模块（宿主 import 缓存去重）；加载失败以错误事件终止流
export function lazyApi(load: () => Promise<ProviderStreams>): ProviderStreams {
	return {
		stream: (model, context, options) =>
			lazyStream(model, async () => (await load()).stream(model, context, options)),
		streamSimple: (model, context, options) =>
			lazyStream(model, async () => (await load()).streamSimple(model, context, options)),
	};
}
