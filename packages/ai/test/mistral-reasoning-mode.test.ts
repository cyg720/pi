/**
 * 文件职责：验证 Mistral 不同模型的推理控制字段和会话提示缓存键选择。
 * 技术维度：使用 Vitest、模型目录、简单流载荷钩子和本地无效端点离线捕获请求。
 * 产品维度：确保各 Mistral 模型收到其 API 支持的 reasoning_effort 或 prompt_mode 参数。
 * 逻辑维度：统一创建上下文并捕获载荷，覆盖 Small、Magistral、Medium 和缓存保留设置。
 * 关键边界：本地端点会失败但载荷已先捕获；只检查三个与推理和缓存相关的字段。
 * 新手阅读建议：先看 MistralPayload，再比较七个用例中模型、reasoning 与 cacheRetention。
 */
import { describe, expect, it } from "vitest";
import { streamSimple } from "../src/api/mistral-conversations.ts";
import type { Context, Model, SimpleStreamOptions } from "../src/types.ts";
import { normalizeContext } from "../src/utils/transcript.ts";

/** 描述本测试关心的 Mistral 请求字段。 */
interface MistralPayload {
	// promptMode 是 Magistral 模型使用的 reasoning 模式标记。
	promptMode?: "reasoning";
	// reasoningEffort 是部分 Mistral 模型接受的 none 或 high 强度。
	reasoningEffort?: "none" | "high";
	// promptCacheKey 使用会话 id 关联可复用提示缓存。
	promptCacheKey?: string;
}

<<<<<<< HEAD
/** 创建含一条 Hello 消息的最小 Context；无参数，返回上下文。 */
=======
function makeModel(id: string, reasoning: boolean): Model<"mistral-conversations"> {
	return {
		id,
		name: id,
		api: "mistral-conversations",
		provider: "mistral",
		baseUrl: "http://127.0.0.1:9",
		reasoning,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128000,
		maxTokens: 16384,
	};
}

>>>>>>> main
function makeContext(): Context {
	return {
		messages: [{ role: "user", content: "Hello", timestamp: Date.now() }],
	};
}

/**
 * 在请求失败前捕获 Mistral 请求载荷。
 * 参数：model 为被测模型，options 为推理或缓存设置。
 * 返回值：捕获的 MistralPayload Promise。
 * 使用示例：`await capturePayload(model, { reasoning: "medium" })`。
 */
async function capturePayload(
	model: Model<"mistral-conversations">,
	options?: SimpleStreamOptions,
): Promise<MistralPayload> {
	// capturedPayload 保存 onPayload 收到的请求对象。
	let capturedPayload: MistralPayload | undefined;
<<<<<<< HEAD
	// payloadCaptureModel 使用本地无效端点，确保不访问真实服务。
	const payloadCaptureModel: Model<"mistral-conversations"> = {
		...model,
		baseUrl: "http://127.0.0.1:9",
	};

	// stream 构造请求并在连接失败前触发载荷钩子。
	const stream = streamSimple(payloadCaptureModel, makeContext(), {
=======
	const stream = streamSimple(model, normalizeContext(makeContext()), {
>>>>>>> main
		...options,
		apiKey: "fake-key",
		// payload 是发送前请求对象，保存后原样返回。
		onPayload: (payload) => {
			capturedPayload = payload as MistralPayload;
			return payload;
		},
	});

	await stream.result();

	if (!capturedPayload) {
		throw new Error("Expected payload to be captured before request failure");
	}

	return capturedPayload;
}

describe("Mistral reasoning mode selection", () => {
	// 验证 Small 4 开启思考时使用 high reasoningEffort；无参数，无返回值。
	it("uses reasoning_effort for Mistral Small 4", async () => {
<<<<<<< HEAD
		// payload 是 Small 4 中等思考设置产生的请求载荷。
		const payload = await capturePayload(getModel("mistral", "mistral-small-2603"), { reasoning: "medium" });
=======
		const payload = await capturePayload(makeModel("mistral-small-2603", true), { reasoning: "medium" });
>>>>>>> main

		expect(payload.reasoningEffort).toBe("high");
		expect(payload.promptMode).toBeUndefined();
	});

	// 验证 Small 4 关闭思考时省略所有推理控制；无参数，无返回值。
	it("omits reasoning controls for Mistral Small 4 when thinking is off", async () => {
<<<<<<< HEAD
		// payload 是未指定 reasoning 的 Small 4 请求载荷。
		const payload = await capturePayload(getModel("mistral", "mistral-small-2603"));
=======
		const payload = await capturePayload(makeModel("mistral-small-2603", true));
>>>>>>> main

		expect(payload.reasoningEffort).toBeUndefined();
		expect(payload.promptMode).toBeUndefined();
	});

	// 验证 Magistral 模型使用 promptMode=reasoning；无参数，无返回值。
	it("uses prompt_mode for Magistral reasoning models", async () => {
<<<<<<< HEAD
		// payload 是 Magistral 中等思考请求载荷。
		const payload = await capturePayload(getModel("mistral", "magistral-medium-latest"), { reasoning: "medium" });
=======
		const payload = await capturePayload(makeModel("magistral-medium-latest", true), { reasoning: "medium" });
>>>>>>> main

		expect(payload.promptMode).toBe("reasoning");
		expect(payload.reasoningEffort).toBeUndefined();
	});

<<<<<<< HEAD
	// 验证 Medium 3.5 开启思考时使用 high reasoningEffort；无参数，无返回值。
	it("uses reasoning_effort for Mistral Medium 3.5", async () => {
		// payload 是 Medium 3.5 中等思考请求载荷。
		const payload = await capturePayload(getModel("mistral", "mistral-medium-3.5"), { reasoning: "medium" });
=======
	// Regression for #9375: Mistral-hosted GLM-5.2 ignores prompt_mode.
	describe("zai-glm-5-2", () => {
		it("uses reasoning_effort when thinking is enabled", async () => {
			const payload = await capturePayload(makeModel("zai-glm-5-2", true), { reasoning: "medium" });
>>>>>>> main

			expect(payload.reasoningEffort).toBe("high");
			expect(payload.promptMode).toBeUndefined();
		});

		it("omits reasoning controls when thinking is off", async () => {
			const payload = await capturePayload(makeModel("zai-glm-5-2", true));

			expect(payload.reasoningEffort).toBeUndefined();
			expect(payload.promptMode).toBeUndefined();
		});
	});

<<<<<<< HEAD
	// 验证 Medium 3.5 关闭思考时省略推理字段；无参数，无返回值。
	it("omits reasoning controls for Mistral Medium 3.5 when thinking is off", async () => {
		// payload 是未指定 reasoning 的 Medium 3.5 载荷。
		const payload = await capturePayload(getModel("mistral", "mistral-medium-3.5"));
=======
	// Regression for #8700: Medium aliases must use reasoning_effort, not Magistral's prompt_mode.
	describe.each(["mistral-medium-2604", "mistral-medium-latest"] as const)("%s", (modelId) => {
		it("uses reasoning_effort when thinking is enabled", async () => {
			const payload = await capturePayload(makeModel(modelId, true), { reasoning: "medium" });

			expect(payload.reasoningEffort).toBe("high");
			expect(payload.promptMode).toBeUndefined();
		});

		it("omits reasoning controls when thinking is off", async () => {
			const payload = await capturePayload(makeModel(modelId, true));

			expect(payload.reasoningEffort).toBeUndefined();
			expect(payload.promptMode).toBeUndefined();
		});
	});

	// Regression for #8700: the Medium prefix must still respect the model's reasoning capability.
	it("omits reasoning controls for non-reasoning Medium models", async () => {
		const payload = await capturePayload(makeModel("mistral-medium-2505", false), { reasoning: "medium" });
>>>>>>> main

		expect(payload.reasoningEffort).toBeUndefined();
		expect(payload.promptMode).toBeUndefined();
	});

	// 验证会话 id 默认映射为提示缓存键；无参数，无返回值。
	it("uses the session id as prompt cache key", async () => {
<<<<<<< HEAD
		// payload 是带 sessionId 的 Large 模型请求载荷。
		const payload = await capturePayload(getModel("mistral", "mistral-large-latest"), {
=======
		const payload = await capturePayload(makeModel("mistral-large-latest", false), {
>>>>>>> main
			sessionId: "session-123",
		});

		expect(payload.promptCacheKey).toBe("session-123");
	});

	// 验证禁用缓存保留时省略提示缓存键；无参数，无返回值。
	it("omits prompt cache key when cache retention is disabled", async () => {
<<<<<<< HEAD
		// payload 是 cacheRetention=none 的 Large 模型载荷。
		const payload = await capturePayload(getModel("mistral", "mistral-large-latest"), {
=======
		const payload = await capturePayload(makeModel("mistral-large-latest", false), {
>>>>>>> main
			sessionId: "session-123",
			cacheRetention: "none",
		});

		expect(payload.promptCacheKey).toBeUndefined();
	});
});
