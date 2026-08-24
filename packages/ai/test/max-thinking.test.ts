/**
 * 文件职责：验证 max 推理档位的显式支持、档位夹取和 Codex Responses 请求载荷。
 * 技术维度：使用 Vitest、模型目录、思考档位兼容函数和请求载荷钩子进行离线测试。
 * 产品维度：确保只有声明支持的模型显示 max，并把用户选择准确传给 Codex 服务。
 * 逻辑维度：构造普通与缺档模型，对目录模型做参数化断言，最后捕获真实发送前载荷。
 * 关键边界：不发起网络请求，onPayload 主动抛错终止；普通推理模型默认最高只到 high。
 * 新手阅读建议：先看前两例理解“支持列表”，再看缺档夹取规则和最后的载荷捕获。
 */
import { describe, expect, it } from "vitest";
import { streamSimple as streamSimpleOpenAICodexResponses } from "../src/api/openai-codex-responses.ts";
import { clampThinkingLevel, getModel, getSupportedThinkingLevels } from "../src/compat.ts";
import type { Context, Model } from "../src/types.ts";

/**
 * 创建包含测试账户标识的伪 Codex JWT 字符串。
 * 参数：无。
 * 返回值：仅满足本地载荷构造解析需求的三段式令牌。
 * 使用示例：`apiKey: mockToken()`。
 */
function mockToken(): string {
	// payload 是包含固定 ChatGPT 账户 id 的 Base64 JSON 段。
	const payload = Buffer.from(
		JSON.stringify({ "https://api.openai.com/auth": { chatgpt_account_id: "acc_test" } }),
		"utf8",
	).toString("base64");
	return `aaa.${payload}.bbb`;
}

describe("max thinking level", () => {
	// 验证普通推理模型不会自动开放 max，夹取时回退 high；无参数，无返回值。
	it("is opt-in for ordinary reasoning models", () => {
		// model 是没有 thinkingLevelMap 的普通推理测试模型。
		const model: Model<"openai-completions"> = {
			id: "ordinary-reasoning",
			name: "Ordinary Reasoning",
			api: "openai-completions",
			provider: "test",
			baseUrl: "https://example.com/v1",
			reasoning: true,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 128000,
			maxTokens: 4096,
		};

		expect(getSupportedThinkingLevels(model)).toEqual(["off", "minimal", "low", "medium", "high"]);
		expect(clampThinkingLevel(model, "max")).toBe("high");
	});

	it.each(["gpt-5.6-luna", "gpt-5.6-sol", "gpt-5.6-terra"] as const)(
		"exposes xhigh and max for openai-codex/%s",
		// modelId 是当前参数化检查的 Codex 模型标识。
		(modelId) => {
			// model 是从目录取得的当前 Codex 模型配置。
			const model = getModel("openai-codex", modelId);
			expect(model).toBeDefined();
			expect(model?.thinkingLevelMap).toMatchObject({ xhigh: "xhigh", max: "max" });
			expect(getSupportedThinkingLevels(model!)).toEqual([
				"off",
				"minimal",
				"low",
				"medium",
				"high",
				"xhigh",
				"max",
			]);
		},
	);

	// 验证 xhigh 缺失但 max 存在时支持列表保留空洞且夹取到 max；无参数，无返回值。
	it("supports a hole between high and max", () => {
		// model 是显式禁用 xhigh、启用 max 的测试模型。
		const model: Model<"openai-completions"> = {
			id: "high-and-max",
			name: "High and Max",
			api: "openai-completions",
			provider: "test",
			baseUrl: "https://example.com/v1",
			reasoning: true,
			thinkingLevelMap: { xhigh: null, max: "max" },
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 128000,
			maxTokens: 4096,
		};

		expect(getSupportedThinkingLevels(model)).toEqual(["off", "minimal", "low", "medium", "high", "max"]);
		expect(clampThinkingLevel(model, "xhigh")).toBe("max");
	});

	// 验证 max 最终映射到 Codex Responses 的 reasoning.effort；无参数，无返回值。
	it("sends max to the Codex Responses API", async () => {
		// model 是明确支持 max 的 GPT-5.6 sol 配置。
		const model = getModel("openai-codex", "gpt-5.6-sol")!;
		// context 是触发请求载荷构造的最小对话上下文。
		const context: Context = {
			systemPrompt: "You are a helpful assistant.",
			messages: [{ role: "user", content: "Hello", timestamp: Date.now() }],
		};
		// payload 保存 onPayload 捕获的原始请求对象。
		let payload: unknown;

		await streamSimpleOpenAICodexResponses(model, context, {
			apiKey: mockToken(),
			reasoning: "max",
			// request 是发送前请求载荷，保存后抛错以阻止网络调用。
			onPayload: (request) => {
				payload = request;
				throw new Error("payload captured");
			},
		}).result();

		expect(payload).toMatchObject({ reasoning: { effort: "max", summary: "auto" } });
	});
});
