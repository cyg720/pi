/**
 * 文件职责：验证 Anthropic 不同代际模型在关闭或启用推理时生成的请求载荷及在线输出行为。
 * 技术维度：使用 onPayload 钩子截获请求 JSON、故意中断网络发送，并用 streamSimple 执行可选端到端测试。
 * 产品维度：确保用户的 thinking 设置准确映射为 disabled、adaptive 和 effort 字段，避免意外推理开销。
 * 逻辑维度：先离线捕获各模型载荷，再在有密钥时验证关闭推理不会产生 thinking 流事件。
 * 关键边界：Fable 5 不发送 disabled 字段；在线测试需要 ANTHROPIC_API_KEY 并允许一定输出随机性。
 * 新手阅读建议：先看 capturePayload 如何在发网前截获数据，再比较不同模型用例的 thinking/output_config。
 */
import { describe, expect, it } from "vitest";
import { getModel, streamSimple } from "../src/compat.ts";
import type { Context, Model, SimpleStreamOptions } from "../src/types.ts";

// AnthropicThinkingPayload 只描述本组断言关心的推理与输出配置字段。
interface AnthropicThinkingPayload {
	thinking?: { type: string; budget_tokens?: number; display?: string };
	output_config?: { effort?: string };
}

/**
 * PayloadCaptured 是截获请求载荷后主动终止发送流程的哨兵错误。
 * 核心功能：区分预期中断与真实网络失败；使用场景：onPayload 回调取得数据后立即抛出。
 */
class PayloadCaptured extends Error {
	/** 创建固定名称和消息的哨兵错误；无参数；返回 PayloadCaptured 实例。 */
	constructor() {
		super("payload captured");
		this.name = "PayloadCaptured";
	}
}

/** 构造载荷捕获所需的最小用户上下文；无参数；返回 Context。 */
function makePayloadCaptureContext(): Context {
	return {
		messages: [{ role: "user", content: "Hello", timestamp: Date.now() }],
	};
}

/**
 * 在真正建立网络连接前截获 Anthropic 请求载荷。
 * @param model 待测 Anthropic Messages 模型。
 * @param options 可选流请求设置，如 reasoning 等级。
 * @returns 截获的推理相关载荷；例如 `await capturePayload(model, { reasoning: "high" })`。
 */
async function capturePayload(
	model: Model<"anthropic-messages">,
	options?: SimpleStreamOptions,
): Promise<AnthropicThinkingPayload> {
	// capturedPayload 保存 onPayload 回调看到的数据，回调执行前为 undefined。
	let capturedPayload: AnthropicThinkingPayload | undefined;
	// payloadCaptureModel 把地址改到不可用本地端口，确保测试绝不访问真实服务。
	const payloadCaptureModel: Model<"anthropic-messages"> = {
		...model,
		baseUrl: "http://127.0.0.1:9",
	};

	// s 是配置假密钥和载荷钩子的请求流。
	const s = streamSimple(payloadCaptureModel, makePayloadCaptureContext(), {
		...options,
		apiKey: "fake-key",
		onPayload: (payload) => {
			capturedPayload = payload as AnthropicThinkingPayload;
			throw new PayloadCaptured();
		},
	});

	await s.result();

	if (!capturedPayload) {
		throw new Error("Expected payload to be captured before request failure");
	}

	return capturedPayload;
}

// RunResult 汇总在线响应中的推理事件、字符、文本和内容类型。
interface RunResult {
	thinkingEventCount: number;
	thinkingCharCount: number;
	text: string;
	contentTypes: string[];
}

/** 构造要求内部计算但只输出 pong 的在线测试上下文；无参数；返回 Context。 */
function makeE2EContext(): Context {
	return {
		systemPrompt: "You are a precise assistant. Follow the requested output format exactly.",
		messages: [
			{
				role: "user",
				content:
					"Before replying, carefully solve 36863 * 5279 internally. Then reply with the word pong repeated exactly 40 times, separated by single spaces. Do not add any other text.",
				timestamp: Date.now(),
			},
		],
	};
}

/** 统计文本中独立 pong 单词数量；参数 text 为模型正文；返回匹配数量。 */
function countPongs(text: string): number {
	return text.match(/\bpong\b/gi)?.length ?? 0;
}

/**
 * 不传 reasoning 选项运行 Anthropic 模型并收集输出。
 * @param model 待测 Anthropic Messages 模型。
 * @returns 推理事件和正文摘要；例如 `await runWithoutReasoning(model)`。
 */
async function runWithoutReasoning(model: Model<"anthropic-messages">): Promise<RunResult> {
	// s 是最大输出 160 令牌、温度为 0 的模型流。
	const s = streamSimple(model, makeE2EContext(), {
		temperature: 0,
		maxTokens: 160,
	});

	// thinkingEventCount 统计所有推理生命周期与增量事件。
	let thinkingEventCount = 0;
	// thinkingCharCount 累加 thinking_delta 中的字符数。
	let thinkingCharCount = 0;

	for await (const event of s) {
		if (event.type === "thinking_start" || event.type === "thinking_end") {
			thinkingEventCount += 1;
		}
		if (event.type === "thinking_delta") {
			thinkingEventCount += 1;
			thinkingCharCount += event.delta.length;
		}
	}

	// response 是流结束后的完整助手消息。
	const response = await s.result();
	expect(response.stopReason, response.errorMessage).toBe("stop");

	// text 是全部文本内容块拼接后的最终正文。
	const text = response.content
		.filter((block) => block.type === "text")
		.map((block) => block.text)
		.join("")
		.trim();

	return {
		thinkingEventCount,
		thinkingCharCount,
		text,
		contentTypes: response.content.map((block) => block.type),
	};
}

// 离线验证各 Claude 系列模型的 thinking 请求字段映射。
describe("Anthropic thinking disable payload", () => {
	// 预算式推理模型关闭时应显式发送 disabled。
	it("sends thinking.type=disabled for budget-based reasoning models when thinking is off", async () => {
		// payload 是 Claude Sonnet 4.5 的截获请求体片段。
		const payload = await capturePayload(getModel("anthropic", "claude-sonnet-4-5"));

		expect(payload.thinking).toEqual({ type: "disabled" });
		expect(payload.output_config).toBeUndefined();
	});

	// 自适应推理模型关闭时同样应显式发送 disabled。
	it("sends thinking.type=disabled for adaptive reasoning models when thinking is off", async () => {
		// payload 是 Claude Opus 4.6 的截获请求体片段。
		const payload = await capturePayload(getModel("anthropic", "claude-opus-4-6"));

		expect(payload.thinking).toEqual({ type: "disabled" });
		expect(payload.output_config).toBeUndefined();
	});

	// Opus 4.8 关闭推理时沿用 disabled 语义。
	it("sends thinking.type=disabled for Claude Opus 4.8 when thinking is off", async () => {
		// payload 是 Claude Opus 4.8 的关闭推理载荷。
		const payload = await capturePayload(getModel("anthropic", "claude-opus-4-8"));

		expect(payload.thinking).toEqual({ type: "disabled" });
		expect(payload.output_config).toBeUndefined();
	});

	// Fable 5 不支持显式 disabled 字段，因此关闭时应完全省略推理配置。
	it("omits thinking.type=disabled for Claude Fable 5 when thinking is off", async () => {
		// payload 是 Claude Fable 5 的默认载荷。
		const payload = await capturePayload(getModel("anthropic", "claude-fable-5"));

		expect(payload.thinking).toBeUndefined();
		expect(payload.output_config).toBeUndefined();
	});

	// Opus 4.8 高等级推理应使用 adaptive 与 summarized 展示。
	it("uses adaptive thinking for Claude Opus 4.8 when reasoning is enabled", async () => {
		// payload 是 reasoning=high 时的 Opus 4.8 载荷。
		const payload = await capturePayload(getModel("anthropic", "claude-opus-4-8"), { reasoning: "high" });

		expect(payload.thinking).toEqual({ type: "adaptive", display: "summarized" });
		expect(payload.output_config).toEqual({ effort: "high" });
	});

	// Sonnet 5 高等级推理应使用相同的新式自适应协议。
	it("uses adaptive thinking for Claude Sonnet 5 when reasoning is enabled", async () => {
		// payload 是 reasoning=high 时的 Sonnet 5 载荷。
		const payload = await capturePayload(getModel("anthropic", "claude-sonnet-5"), { reasoning: "high" });

		expect(payload.thinking).toEqual({ type: "adaptive", display: "summarized" });
		expect(payload.output_config).toEqual({ effort: "high" });
	});

	// xhigh 等级不得被降级为 high。
	it("maps xhigh reasoning to effort=xhigh for Claude Opus 4.8", async () => {
		// payload 是 reasoning=xhigh 时的 Opus 4.8 载荷。
		const payload = await capturePayload(getModel("anthropic", "claude-opus-4-8"), { reasoning: "xhigh" });

		expect(payload.thinking).toEqual({ type: "adaptive", display: "summarized" });
		expect(payload.output_config).toEqual({ effort: "xhigh" });
	});
});

// 有真实密钥时确认关闭推理的线上响应不含 thinking 内容。
describe.skipIf(!process.env.ANTHROPIC_API_KEY)("Anthropic thinking disable E2E", () => {
	it("disables thinking for Claude reasoning models", { retry: 2, timeout: 30000 }, async () => {
		// result 是在线 Sonnet 4.5 请求的事件和正文统计。
		const result = await runWithoutReasoning(getModel("anthropic", "claude-sonnet-4-5"));

		expect(result.thinkingEventCount).toBe(0);
		expect(result.thinkingCharCount).toBe(0);
		expect(result.contentTypes).not.toContain("thinking");
		expect(countPongs(result.text)).toBeGreaterThanOrEqual(35);
	});
});
