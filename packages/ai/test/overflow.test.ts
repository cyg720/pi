/**
 * 文件职责：验证上下文溢出识别覆盖多家服务错误文本与零输出 length 停止，同时排除限流等误报。
 * 技术维度：使用 Vitest 和统一 AssistantMessage 工厂，对 isContextOverflow 的字符串模式与用量启发式做测试。
 * 产品维度：帮助代理在真正超出上下文时触发压缩或恢复，而不会把临时服务故障误判为提示过长。
 * 逻辑维度：先构造错误消息并覆盖供应商文案，再构造 length 消息检查用量接近窗口的判定。
 * 关键边界：HTTP 429、Bedrock throttling 和普通 length 输出不能算溢出；逗号数字也需正确解析。
 * 新手阅读建议：先看正例错误文案的共同“最大上下文”语义，再看四个负例和末尾用量边界。
 */
import { describe, expect, it } from "vitest";
import type { AssistantMessage } from "../src/types.ts";
import { isContextOverflow } from "../src/utils/overflow.ts";

/** 功能：创建带指定错误文本的助手消息；参数 errorMessage；返回：stopReason=error 的消息。示例：createErrorMessage("prompt too long")。 */
function createErrorMessage(errorMessage: string): AssistantMessage {
	return {
		role: "assistant",
		content: [],
		api: "openai-completions",
		provider: "ollama",
		model: "qwen3.5:35b",
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				total: 0,
			},
		},
		stopReason: "error",
		errorMessage,
		timestamp: Date.now(),
	};
}

describe("isContextOverflow", () => {
	it("detects explicit Ollama prompt-too-long errors", () => {
		const message = createErrorMessage("400 `prompt too long; exceeded max context length by 100918 tokens`");
		expect(isContextOverflow(message, 32768)).toBe(true);
	});

	it("detects Together AI context length errors", () => {
		const message = createErrorMessage(
			"400 The input (516368 tokens) is longer than the model's context length (262144 tokens).",
		);
		expect(isContextOverflow(message, 262144)).toBe(true);
	});

	it("detects LiteLLM-wrapped OpenAI maximum context length errors", () => {
		const message = createErrorMessage(
			"Error: 503 litellm.ServiceUnavailableError: litellm.MidStreamFallbackError: litellm.APIConnectionError: APIConnectionError: OpenAIException - Requested token count exceeds the model's maximum context length of 131072 tokens.",
		);
		expect(isContextOverflow(message, 131072)).toBe(true);
	});

	it("detects OpenAI-compatible parenthesized maximum context length errors", () => {
		const message = createErrorMessage(
			"Error: 400 Input length (265330) exceeds model's maximum context length (262144).",
		);
		expect(isContextOverflow(message, 262144)).toBe(true);
	});

	it("detects OpenRouter Poolside maximum allowed input length errors", () => {
		const message = createErrorMessage(
			"Provider returned error: Input length 131393 exceeds the maximum allowed input length of 131040 tokens.",
		);
		expect(isContextOverflow(message, 131072)).toBe(true);
	});

	it("detects DS4 configured context size errors", () => {
		// 普通数字格式的 DS4 溢出消息。
		const message = createErrorMessage(
			"400 Prompt has 256468 tokens, but the configured context size is 256000 tokens",
		);
		expect(isContextOverflow(message, 256000)).toBe(true);

		// 带千位分隔逗号的同类溢出消息。
		const commaMessage = createErrorMessage(
			"Prompt has 5,958,968 tokens, but the configured context size is 256,000 tokens",
		);
		expect(isContextOverflow(commaMessage, 256000)).toBe(true);
	});

	it("does not treat generic non-overflow Ollama errors as overflow", () => {
		const message = createErrorMessage("500 `model runner crashed unexpectedly`");
		expect(isContextOverflow(message, 32768)).toBe(false);
	});

	it("does not treat Bedrock throttling 'Too many tokens' as overflow", () => {
		// Bedrock returns this for HTTP 429 rate limiting, NOT context overflow.
		// 中文说明：Bedrock 的该文本表示 429 限流，不代表上下文超出。
		// formatBedrockError uses a human-readable prefix for ThrottlingException.
		// 中文说明：格式化器会为 ThrottlingException 添加可读前缀，检测器必须识别并排除。
		const message = createErrorMessage("Throttling error: Too many tokens, please wait before trying again.");
		expect(isContextOverflow(message, 200000)).toBe(false);
	});

	it("does not treat Bedrock service unavailable as overflow", () => {
		const message = createErrorMessage("Service unavailable: The service is temporarily unavailable.");
		expect(isContextOverflow(message, 200000)).toBe(false);
	});

	it("does not treat generic rate limit errors as overflow", () => {
		const message = createErrorMessage("Rate limit exceeded, please retry after 30 seconds.");
		expect(isContextOverflow(message, 200000)).toBe(false);
	});

	it("does not treat HTTP 429 style errors as overflow", () => {
		const message = createErrorMessage("Too many requests. Please slow down.");
		expect(isContextOverflow(message, 200000)).toBe(false);
	});

	/** 功能：创建 length 停止消息；参数 input、cacheRead、output；返回：含对应用量的助手消息。示例：createLengthStopMessage(100, 0, 0)。 */
	function createLengthStopMessage(input: number, cacheRead: number, output: number): AssistantMessage {
		return {
			role: "assistant",
			content: [],
			api: "openai-completions",
			provider: "xiaomi",
			model: "mimo-v2.5-pro",
			usage: {
				input,
				output,
				cacheRead,
				cacheWrite: 0,
				totalTokens: input + cacheRead + output,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "length",
			timestamp: Date.now(),
		};
	}

	it("detects Xiaomi-style overflow (length stop with zero output and filled context)", () => {
		const message = createLengthStopMessage(58, 1048512, 0);
		expect(isContextOverflow(message, 1048576)).toBe(true);
	});

	it("does not treat normal length stops with output as overflow", () => {
		const message = createLengthStopMessage(1000, 0, 4096);
		expect(isContextOverflow(message, 200000)).toBe(false);
	});

	it("does not treat length stops far below context as overflow", () => {
		const message = createLengthStopMessage(100, 0, 0);
		expect(isContextOverflow(message, 200000)).toBe(false);
	});
});
