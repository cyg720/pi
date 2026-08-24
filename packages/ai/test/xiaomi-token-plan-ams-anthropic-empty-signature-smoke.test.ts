/**
 * 文件职责：在线冒烟验证小米 Anthropic 兼容端点产生的空思考签名可被保留并正确回放。
 * 技术维度：使用 Vitest 条件跳过、Anthropic 消息模型、载荷拦截回调和真实环境 API 密钥。
 * 产品维度：保障用户连续对话时不会因供应商返回空 signature 而丢失思考块或请求失败。
 * 逻辑维度：完成首轮请求，提取思考块，构造第二轮上下文，在发网前捕获并检查回放载荷。
 * 关键边界：只有配置真实密钥时运行；会产生网络调用，且依赖供应商确实返回空签名。
 * 新手阅读建议：先看 model.compat，再看主测试的“首轮响应—回放上下文—载荷断言”三步。
 */
import { describe, expect, it } from "vitest";
import { completeSimple, getEnvApiKey, streamSimple } from "../src/compat.ts";
import type { AssistantMessage, Context, Model } from "../src/types.ts";

// 供应商注册名；必须与环境变量密钥解析和模型 provider 字段保持一致。
const provider = "xiaomi-token-plan-ams";
// 从环境中读取的真实密钥；缺失时整个测试套件会被跳过。
const apiKey = getEnvApiKey(provider);

// 小米 MiMo Anthropic 兼容模型的测试元数据；allowEmptySignature 是本回归的关键开关。
const model: Model<"anthropic-messages"> = {
	id: "mimo-v2.5-pro",
	name: "MiMo-V2.5-Pro Anthropic smoke",
	api: "anthropic-messages",
	provider,
	baseUrl: "https://token-plan-ams.xiaomimimo.com/anthropic",
	reasoning: true,
	input: ["text"],
	cost: { input: 1, output: 3, cacheRead: 0.2, cacheWrite: 0 },
	contextWindow: 1048576,
	maxTokens: 1024,
	compat: { allowEmptySignature: true },
};

// 捕获的 Anthropic 请求载荷最小结构；仅声明本测试会读取的 messages 字段。
interface AnthropicPayload {
	messages?: Array<{
		role: string;
		content: string | Array<{ type: string; text?: string; thinking?: string; signature?: string }>;
	}>;
}

// 用于主动中止网络请求的哨兵错误；表示 onPayload 已成功取得待检查载荷。
class PayloadCaptured extends Error {
	/** 功能：创建固定消息的哨兵错误；参数：无；返回：PayloadCaptured 实例。示例：throw new PayloadCaptured()。 */
	constructor() {
		super("payload captured");
		this.name = "PayloadCaptured";
	}
}

/** 功能：创建首轮用户上下文；参数：无；返回：含系统提示和一条用户消息的 Context。示例：completeSimple(model, makeInitialContext(), options)。 */
function makeInitialContext(): Context {
	return {
		systemPrompt: "You are concise. Follow the requested output format exactly.",
		messages: [
			{
				role: "user",
				content: "Think internally if you need to, then reply with exactly this text and nothing else: first-ok",
				timestamp: Date.now(),
			},
		],
	};
}

/** 功能：筛选助手消息中的思考块；参数 message 为助手消息；返回：全部 thinking 内容块。示例：getThinkingBlocks(first)。 */
function getThinkingBlocks(message: AssistantMessage) {
	return message.content.filter((block) => block.type === "thinking");
}

/** 功能：在真正发送第二轮请求前截获载荷；参数 context 为回放上下文；返回：AnthropicPayload。示例：await captureReplayPayload(context)。 */
async function captureReplayPayload(context: Context): Promise<AnthropicPayload> {
	// onPayload 写入的请求载荷；回调未触发前保持 undefined。
	let capturedPayload: AnthropicPayload | undefined;
	// 第二轮请求流；预期在 onPayload 抛出哨兵错误后停止，不应真正访问服务端。
	const stream = streamSimple(model, context, {
		apiKey,
		maxTokens: 512,
		reasoning: "high",
		onPayload: (payload) => {
			capturedPayload = payload as AnthropicPayload;
			throw new PayloadCaptured();
		},
	});

	await stream.result();

	if (!capturedPayload) {
		throw new Error("Expected payload capture before request");
	}
	return capturedPayload;
}

describe.skipIf(!apiKey)("Xiaomi Token Plan AMS Anthropic empty thinking signature smoke", () => {
	it("reproduces empty thinking signatures and preserves them for replay", { timeout: 60000, retry: 1 }, async () => {
		// 首轮固定上下文，后续回放会在其消息数组后追加模型与用户消息。
		const firstContext = makeInitialContext();
		// 真实服务的首轮助手响应；最多允许测试框架重试一次。
		const first = await completeSimple(model, firstContext, {
			apiKey,
			maxTokens: 512,
			reasoning: "high",
		});

		expect(first.stopReason, first.errorMessage).toBe("stop");

		// 首轮响应中的所有 thinking 块；至少一个应携带空字符串签名。
		const thinkingBlocks = getThinkingBlocks(first);
		expect(thinkingBlocks.length).toBeGreaterThan(0);
		expect(thinkingBlocks.some((block) => block.thinkingSignature === "")).toBe(true);

		// 第二轮完整上下文；保留首轮消息并追加一个要求固定输出的新用户消息。
		const replayContext: Context = {
			...firstContext,
			messages: [
				...firstContext.messages,
				first,
				{
					role: "user",
					content: "Reply with exactly this text and nothing else: second-ok",
					timestamp: Date.now(),
				},
			],
		};

		// 尚未发网的第二轮 Anthropic 请求载荷。
		const replayPayload = await captureReplayPayload(replayContext);
		// 载荷中的助手消息；应该承载被回放的思考内容与空签名。
		const assistantPayload = replayPayload.messages?.find((message) => message.role === "assistant");
		expect(assistantPayload).toBeDefined();
		expect(Array.isArray(assistantPayload!.content)).toBe(true);
		// 回放载荷中的 thinking 项；应保持 thinking 字段而不是降级为文本。
		const replayedThinking = (assistantPayload!.content as Array<{ type: string; text?: string }>).filter(
			(block) => block.type === "thinking",
		);
		// 回放载荷中的普通文本项；不得重复包含思考内容。
		const replayedText = (assistantPayload!.content as Array<{ type: string; text?: string }>).filter(
			(block) => block.type === "text",
		);
		expect(replayedThinking).toEqual([{ type: "thinking", thinking: thinkingBlocks[0].thinking, signature: "" }]);
		expect(replayedText.some((block) => block.text === thinkingBlocks[0].thinking)).toBe(false);
	});
});
