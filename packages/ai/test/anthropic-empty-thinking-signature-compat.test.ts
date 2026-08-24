/**
 * 文件职责：验证 Anthropic 兼容层按模型开关处理空思考签名，并覆盖小米与 Kimi 模型配置。
 * 技术维度：使用 Vitest、载荷拦截回调和本地无效端点，在发网前检查转换后的 Anthropic 请求。
 * 产品维度：既避免不接受空签名的服务报错，也允许明确兼容空签名的供应商保留思考语义。
 * 逻辑维度：构造模型与三轮消息上下文，捕获载荷，分别断言降级为文本或保留 thinking 块。
 * 关键边界：单个空格会被规范化为空签名；测试依赖 onPayload 在网络请求前同步触发。
 * 新手阅读建议：先比较前三个用例的开关差异，再看 Kimi 模型目录如何预设兼容选项。
 */
import { describe, expect, it } from "vitest";
import { getModel, streamSimple } from "../src/compat.ts";
import type { AssistantMessage, Context, Model } from "../src/types.ts";

// 捕获的 Anthropic 请求最小结构，只声明本测试需要检查的消息内容。
interface AnthropicPayload {
	messages?: Array<{
		role: string;
		content: Array<{ type: string; text?: string; thinking?: string; signature?: string }>;
	}>;
}

// 表示载荷已成功捕获的哨兵错误，用于阻止后续真实网络请求。
class PayloadCaptured extends Error {
	/** 功能：创建固定消息的捕获哨兵；参数：无；返回：PayloadCaptured 实例。示例：throw new PayloadCaptured()。 */
	constructor() {
		super("payload captured");
		this.name = "PayloadCaptured";
	}
}

/** 功能：创建可切换空签名兼容性的测试模型；参数 allowEmptySignature 可省略；返回：Anthropic 模型。示例：makeModel(true)。 */
function makeModel(allowEmptySignature?: boolean): Model<"anthropic-messages"> {
	return {
		id: "mimo-v2.5-pro",
		name: "MiMo-V2.5-Pro",
		api: "anthropic-messages",
		provider: "xiaomi-token-plan-ams",
		baseUrl: "http://127.0.0.1:9/anthropic",
		reasoning: true,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 1048576,
		maxTokens: 1024,
		...(allowEmptySignature === undefined ? {} : { compat: { allowEmptySignature } }),
	};
}

/** 功能：创建含 thinking 助手消息的多轮上下文；参数为签名、思考文本、供应商和模型；返回：Context。示例：makeContext("signed")。 */
function makeContext(
	thinkingSignature: string,
	thinking = "internal reasoning",
	provider = "xiaomi-token-plan-ams",
	model = "mimo-v2.5-pro",
): Context {
	// 被回放的助手消息；thinkingSignature 是各测试的主要输入变量。
	const assistant: AssistantMessage = {
		role: "assistant",
		content: [{ type: "thinking", thinking, thinkingSignature }],
		provider,
		api: "anthropic-messages",
		model,
		timestamp: Date.now(),
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop",
	};
	return {
		messages: [
			{ role: "user", content: "first", timestamp: Date.now() },
			assistant,
			{ role: "user", content: "second", timestamp: Date.now() },
		],
	};
}

/** 功能：截获转换后的 Anthropic 载荷；参数 model、context；返回：捕获载荷。示例：await capturePayload(model, context)。 */
async function capturePayload(model: Model<"anthropic-messages">, context: Context): Promise<AnthropicPayload> {
	// onPayload 回调写入的载荷；未触发时保持 undefined 并在结尾报错。
	let capturedPayload: AnthropicPayload | undefined;
	// 使用假密钥和无效本地地址创建的流；哨兵错误应在发网前终止它。
	const stream = streamSimple(model, context, {
		apiKey: "fake-key",
		onPayload: (payload) => {
			capturedPayload = payload as AnthropicPayload;
			throw new PayloadCaptured();
		},
	});
	await stream.result();
	if (!capturedPayload) throw new Error("Expected payload capture before request");
	return capturedPayload;
}

describe("Anthropic empty thinking signature compat", () => {
	it("converts empty-signature thinking to text by default", async () => {
		// 未开启兼容选项时捕获的请求载荷。
		const payload = await capturePayload(makeModel(), makeContext(""));
		// 载荷中的助手消息；空签名思考应降级为普通文本。
		const assistant = payload.messages?.find((message) => message.role === "assistant");
		expect(assistant?.content).toEqual([{ type: "text", text: "internal reasoning" }]);
	});

	it("preserves empty thinking text when the signature is present", async () => {
		// 有签名但 thinking 为空时捕获的请求载荷。
		const payload = await capturePayload(makeModel(), makeContext("signed-thinking", ""));
		// 载荷中的助手消息；合法签名应允许空思考文本保持 thinking 类型。
		const assistant = payload.messages?.find((message) => message.role === "assistant");
		expect(assistant?.content).toEqual([{ type: "thinking", thinking: "", signature: "signed-thinking" }]);
	});

	it("preserves empty-signature thinking when allowEmptySignature is enabled", async () => {
		// 显式允许空签名时捕获的请求载荷。
		const payload = await capturePayload(makeModel(true), makeContext(" "));
		// 载荷中的助手消息；规范化后的空签名应继续保留在 thinking 块中。
		const assistant = payload.messages?.find((message) => message.role === "assistant");
		expect(assistant?.content).toEqual([{ type: "thinking", thinking: "internal reasoning", signature: "" }]);
	});

	it.each(["k3"] as const)("allows empty signatures for Kimi Coding %s", async (modelId) => {
		// 从模型目录取得的 Kimi Coding 模型；当前参数化值仅为 k3。
		const model = getModel("kimi-coding", modelId);
		expect(model.compat?.allowEmptySignature).toBe(true);

		// 使用目录模型设置捕获的载荷。
		const payload = await capturePayload(model, makeContext(" ", "internal reasoning", "kimi-coding", modelId));
		// 载荷中的助手消息，应保留规范化后的空签名 thinking。
		const assistant = payload.messages?.find((message) => message.role === "assistant");
		expect(assistant?.content).toEqual([{ type: "thinking", thinking: "internal reasoning", signature: "" }]);
	});
});
