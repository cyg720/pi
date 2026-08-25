/**
 * 文件职责：端到端验证 Anthropic、Google、Vertex、OpenAI 和 OpenRouter 在关闭 thinking 时不会返回推理内容。
 * 技术维度：使用统一 streamSimple 流接口、动态环境凭据检测和流事件计数执行多提供商在线测试。
 * 产品维度：保障用户关闭推理后获得纯文本回答，并控制输出令牌和费用，不泄露内部思考内容。
 * 逻辑维度：构造固定高思考提示，收集流事件与最终文本，再按提供商和模型应用差异化预期。
 * 关键边界：需要真实凭据并产生在线请求；模型回答有随机性，因此使用最低 pong 数和重试机制。
 * 新手阅读建议：先看 runWithoutReasoning 如何消费流，再看 expectThinkingDisabledE2E 的统一断言和各提供商参数。
 */
import { describe, expect, it } from "vitest";
import { getModel, streamSimple } from "../src/compat.ts";
import type { Api, Context, Model, SimpleStreamOptions } from "../src/types.ts";

// SimpleOptionsWithExtras 允许测试传入各提供商专属选项，同时保留通用流选项类型。
type SimpleOptionsWithExtras = SimpleStreamOptions & Record<string, unknown>;

// RunResult 汇总一次无推理请求的事件计数、文本、用量和内容块类型。
interface RunResult {
	thinkingEventCount: number;
	thinkingCharCount: number;
	text: string;
	outputTokens: number;
	contentTypes: string[];
}

// DisableExpectations 描述单个模型探针的额外请求选项和宽松断言阈值。
interface DisableExpectations {
	requestOptions?: SimpleOptionsWithExtras;
	minPongs?: number;
	maxOutputTokens?: number;
}

/** 构造要求内部计算但只输出 40 个 pong 的上下文；无参数；返回固定 Context。 */
function makeContext(): Context {
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

/** 统计文本中独立 pong 单词数量；参数 text 为模型正文；返回不区分大小写的匹配数。 */
function countPongs(text: string): number {
	return text.match(/\bpong\b/gi)?.length ?? 0;
}

/**
 * 在未设置 reasoning 的情况下运行模型并收集流与最终响应信息。
 * @param model 任意受支持 API 的模型。
 * @param options 覆盖默认最大令牌和温度的请求选项。
 * @returns RunResult；例如 `await runWithoutReasoning(model)`。
 */
async function runWithoutReasoning<TApi extends Api>(
	model: Model<TApi>,
	options: SimpleOptionsWithExtras = {},
): Promise<RunResult> {
	// s 是可异步迭代并能取得最终结果的统一模型流。
	const s = streamSimple(model, makeContext(), {
		maxTokens: 160,
		temperature: 0,
		...options,
	});

	// thinkingEventCount 统计 thinking 开始、增量和结束事件总数，预期为 0。
	let thinkingEventCount = 0;
	// thinkingCharCount 累加推理增量字符数，预期为 0。
	let thinkingCharCount = 0;

	// event 是当前 Google 流事件，用于确认关闭推理后不再出现 thinking 生命周期或增量。
	for await (const event of s) {
		if (event.type === "thinking_start" || event.type === "thinking_end") {
			thinkingEventCount += 1;
		}
		if (event.type === "thinking_delta") {
			thinkingEventCount += 1;
			thinkingCharCount += event.delta.length;
		}
	}

	// response 是流结束后的完整助手响应及用量。
	const response = await s.result();
	expect(response.stopReason, response.errorMessage).toBe("stop");

	// text 拼接全部文本块并移除首尾空白，用于统计 pong。
	const text = response.content
		.filter((block) => block.type === "text")
		.map((block) => block.text)
		.join("")
		.trim();

	return {
		thinkingEventCount,
		thinkingCharCount,
		text,
		outputTokens: response.usage.output,
		contentTypes: response.content.map((block) => block.type),
	};
}

/**
 * 执行统一的“thinking 已关闭”在线断言。
 * @param model 待测模型。
 * @param expectations 可选请求覆盖、最低 pong 数和最大输出令牌数。
 * @returns 断言完成后的 Promise；例如 `await expectThinkingDisabledE2E(model)`。
 */
async function expectThinkingDisabledE2E<TApi extends Api>(model: Model<TApi>, expectations: DisableExpectations = {}) {
	// result 是运行模型后收集的事件、文本与用量摘要。
	const result = await runWithoutReasoning(model, expectations.requestOptions);

	expect(result.thinkingEventCount).toBe(0);
	expect(result.thinkingCharCount).toBe(0);
	expect(result.contentTypes).not.toContain("thinking");
	expect(countPongs(result.text)).toBeGreaterThanOrEqual(expectations.minPongs ?? 35);
	if (expectations.maxOutputTokens !== undefined) {
		expect(result.outputTokens).toBeLessThan(expectations.maxOutputTokens);
	}
}

// 有 Anthropic 密钥时验证预算式和自适应推理模型。
describe.skipIf(!process.env.ANTHROPIC_API_KEY)("Anthropic thinking disable E2E", () => {
	it("disables thinking for budget-based reasoning models", { retry: 2, timeout: 30000 }, async () => {
		await expectThinkingDisabledE2E(getModel("anthropic", "claude-sonnet-4-5"), {
			requestOptions: { maxTokens: 320, temperature: 0 },
		});
	});

	it("disables thinking for adaptive reasoning models", { retry: 2, timeout: 30000 }, async () => {
		await expectThinkingDisabledE2E(getModel("anthropic", "claude-sonnet-4-6"), {
			requestOptions: { maxTokens: 320, temperature: 0 },
		});
	});
});

// 有 Gemini 密钥时验证 Google 直连的 2.5、3.x 和 3.1 Pro。
describe.skipIf(!process.env.GEMINI_API_KEY)("Google thinking disable E2E", () => {
	it("disables thinking for Gemini 2.5", { retry: 2, timeout: 30000 }, async () => {
		await expectThinkingDisabledE2E(getModel("google", "gemini-2.5-flash"));
	});

	it("disables thinking for Gemini 3.x", { retry: 2, timeout: 30000 }, async () => {
		await expectThinkingDisabledE2E(getModel("google", "gemini-3-flash-preview"));
	});

	it("does not error when thinking is off for Gemini 3.1 Pro", { retry: 2, timeout: 30000 }, async () => {
		await expectThinkingDisabledE2E(getModel("google", "gemini-3.1-pro-preview"), {
			requestOptions: { maxTokens: 512 },
			minPongs: 20,
		});
	});
});

// 根据 API Key 或项目/区域凭据，选择可用的 Google Vertex 认证方式。
describe("Google Vertex thinking disable E2E", () => {
	// vertexProject 是两个常见项目环境变量中的首个可用值。
	const vertexProject = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
	// vertexLocation 是 Vertex 请求所需的云区域。
	const vertexLocation = process.env.GOOGLE_CLOUD_LOCATION;
	// vertexApiKey 是可选的 Vertex API 密钥认证方式。
	const vertexApiKey = process.env.GOOGLE_CLOUD_API_KEY;
	// vertexOptions 优先使用 API 密钥，否则在项目和区域齐全时使用云项目认证。
	const vertexOptions = vertexApiKey
		? ({ apiKey: vertexApiKey } satisfies SimpleOptionsWithExtras)
		: vertexProject && vertexLocation
			? ({ project: vertexProject, location: vertexLocation } satisfies SimpleOptionsWithExtras)
			: undefined;

	it.skipIf(!vertexOptions)("disables thinking for Gemini 2.5", { retry: 2, timeout: 30000 }, async () => {
		await expectThinkingDisabledE2E(getModel("google-vertex", "gemini-2.5-flash"), {
			requestOptions: vertexOptions,
		});
	});

	it.skipIf(!vertexOptions)("disables thinking for Gemini 3.x", { retry: 2, timeout: 30000 }, async () => {
		await expectThinkingDisabledE2E(getModel("google-vertex", "gemini-3-flash-preview"), {
			requestOptions: vertexOptions,
		});
	});
});

// 有 OpenAI 密钥时验证 Responses 推理模型关闭 thinking。
describe.skipIf(!process.env.OPENAI_API_KEY)("OpenAI thinking disable E2E", () => {
	it("disables thinking for Responses reasoning models", { retry: 2, timeout: 30000 }, async () => {
		await expectThinkingDisabledE2E(getModel("openai", "gpt-5.4-mini"), {
			requestOptions: { temperature: undefined },
		});
	});
});

// 有 OpenRouter 密钥时验证第三方 Qwen 推理模型的关闭行为。
describe.skipIf(!process.env.OPENROUTER_API_KEY)("OpenRouter thinking disable E2E", () => {
	it("disables thinking for Qwen 3.5 reasoning models", { retry: 2, timeout: 30000 }, async () => {
		await expectThinkingDisabledE2E(getModel("openrouter", "qwen/qwen3.5-plus-02-15"), {
			maxOutputTokens: 100,
		});
	});
});
