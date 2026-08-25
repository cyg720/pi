/**
 * 文件职责：验证 OpenAI Completions 提供商重试由项目统一控制，SDK 自带重试始终关闭。
 * 技术维度：使用 Vitest 假定时器、模拟 OpenAI SDK 流、HTTP 状态错误与 Retry-After 响应头。
 * 产品维度：避免双层重试造成不可预测延迟，同时尊重服务端退避要求和用户设置的最大等待。
 * 逻辑维度：模拟请求选项与失败队列，消费完整流，覆盖默认、两次重试及超长等待拒绝。
 * 关键边界：每个测试后必须恢复真实定时器；SDK maxRetries 必须固定为 0，防止隐藏额外请求。
 * 新手阅读建议：先读 consume 如何消费事件，再按三个用例观察 requestOptions 数量随时间变化。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stream as streamOpenAICompletions } from "../src/api/openai-completions.ts";
import type { Context, Model } from "../src/types.ts";

// OpenAI SDK 模拟状态；记录每次请求选项并按队列提供 withResponse 错误。
const mockState = vi.hoisted(() => ({
	requestOptions: [] as unknown[],
	requestErrors: [] as Error[],
}));

vi.mock("openai", () => {
	// FakeOpenAI 提供可注入错误的最小 Completions SDK 接口。
	class FakeOpenAI {
		// 模拟 chat.completions 命名空间；create 总会提供两条成功流分片。
		chat = {
			completions: {
				create: (_params: unknown, options: unknown) => {
					// options 是当前 SDK 请求配置，会被保存以检查 maxRetries。
					mockState.requestOptions.push(options);
					// 固定返回文本 ok 后正常停止的异步流。
					const stream = {
						/** 无参数；依次返回文本和停止分片；示例：`for await (const chunk of stream)`。 */
						async *[Symbol.asyncIterator]() {
							yield {
								id: "chatcmpl-test",
								choices: [{ index: 0, delta: { content: "ok" } }],
							};
							yield {
								id: "chatcmpl-test",
								choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
							};
						},
					};
					// 带 withResponse 方法的 SDK 风格 Promise。
					const promise = Promise.resolve(stream) as Promise<typeof stream> & {
						withResponse: () => Promise<{
							data: typeof stream;
							response: { status: number; headers: Headers };
						}>;
					};
					promise.withResponse = async () => {
						// 当前尝试要抛出的预设错误；队列空时返回成功响应。
						const error = mockState.requestErrors.shift();
						if (error) throw error;
						return {
							data: stream,
							response: { status: 200, headers: new Headers() },
						};
					};
					return promise;
				},
			},
		};
	}
	return { default: FakeOpenAI };
});

// 所有重试用例共用的 OpenAI Completions 测试模型。
const model: Model<"openai-completions"> = {
	id: "test-model",
	name: "Test Model",
	api: "openai-completions",
	provider: "opencode-go",
	baseUrl: "https://opencode.ai/zen/go/v1",
	reasoning: false,
	input: ["text"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 1000,
	maxTokens: 100,
};

// 固定单轮用户消息上下文，不包含工具。
const context: Context = {
	systemPrompt: "",
	messages: [{ role: "user", content: [{ type: "text", text: "hi" }], timestamp: 0 }],
	tools: [],
};

/** 功能：启动并完全消费测试流；参数 options 可设置重试次数和最大延迟；返回：最终消息 Promise。示例：await consume({ maxRetries: 2 })。 */
async function consume(options?: { maxRetries?: number; maxRetryDelayMs?: number }) {
	// 当前测试调用产生的消息事件流。
	const stream = streamOpenAICompletions(model, context, { apiKey: "test", ...options });
	for await (const _event of stream) {
		// _event 是单个流事件；本测试只需消费它以推进请求，不检查内容。
		void _event;
	}
	return stream.result();
}

describe("openai-completions provider retries", () => {
	// 功能：清空请求记录与错误队列；参数：无；返回：无。示例：每个用例前自动调用。
	beforeEach(() => {
		mockState.requestOptions = [];
		mockState.requestErrors = [];
	});

	// 功能：恢复真实定时器；参数：无；返回：无。示例：每个用例后自动调用。
	afterEach(() => {
		vi.useRealTimers();
	});

	it("disables SDK retries by default", async () => {
		await consume();
		expect(mockState.requestOptions).toEqual([expect.objectContaining({ maxRetries: 0 })]);
	});

	it("honors provider retries while keeping SDK retries disabled", async () => {
		vi.useFakeTimers();
		mockState.requestErrors = [
			Object.assign(new Error("rate limited"), {
				status: 429,
				headers: new Headers({ "retry-after-ms": "100" }),
			}),
			Object.assign(new Error("server error"), {
				status: 500,
				headers: new Headers({ "retry-after-ms": "100" }),
			}),
		];

		// 尚未完成的消费 Promise；通过推进假时间触发两次提供商重试。
		const result = consume({ maxRetries: 2, maxRetryDelayMs: 100 });
		await vi.advanceTimersByTimeAsync(0);
		expect(mockState.requestOptions).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(99);
		expect(mockState.requestOptions).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(mockState.requestOptions).toHaveLength(2);
		await vi.advanceTimersByTimeAsync(99);
		expect(mockState.requestOptions).toHaveLength(2);
		await vi.advanceTimersByTimeAsync(1);
		await result;

		expect(mockState.requestOptions).toEqual([
			expect.objectContaining({ maxRetries: 0 }),
			expect.objectContaining({ maxRetries: 0 }),
			expect.objectContaining({ maxRetries: 0 }),
		]);
	});

	it("fails immediately when a provider-requested retry delay exceeds the limit", async () => {
		mockState.requestErrors = [
			Object.assign(new Error("rate limited"), {
				status: 429,
				headers: new Headers({ "retry-after": "277403" }),
			}),
		];

		// 因服务端要求等待 277403 秒而立即结束的错误消息结果。
		const result = await consume({ maxRetries: 2, maxRetryDelayMs: 1000 });

		expect(result.stopReason).toBe("error");
		expect(result.errorMessage).toContain("Server requested 277403s retry delay (max: 1s)");
		expect(result.errorMessage).toContain("rate limited");
		expect(mockState.requestOptions).toEqual([expect.objectContaining({ maxRetries: 0 })]);
	});
});
