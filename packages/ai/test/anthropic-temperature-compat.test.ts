/**
 * 文件职责：验证不同 Anthropic 模型及兼容配置是否应在请求中保留 temperature。
 * 技术维度：使用 Vitest、统一模型目录、请求载荷钩子和本地无效端点离线捕获载荷。
 * 产品维度：避免不支持 temperature 的新 Claude 模型拒绝请求，同时保持旧模型采样控制。
 * 逻辑维度：构造上下文和自定义模型，统一捕获载荷，再对六种模型/配置组合断言。
 * 关键边界：onPayload 抛出专用错误阻止网络访问；只检查 temperature 字段是否存在。
 * 新手阅读建议：先看 makeCustomModel 和 capturePayload，再比较 4.7/4.8 与 4.6 的差异。
 */
import { describe, expect, it } from "vitest";
import { getModel, streamSimple } from "../src/compat.ts";
import type { Context, Model, SimpleStreamOptions } from "../src/types.ts";

/** 描述本测试关心的 Anthropic 请求温度字段。 */
interface AnthropicTemperaturePayload {
	// temperature 是可选采样温度，不支持的模型应省略。
	temperature?: number;
}

/** 表示成功捕获载荷后主动中断请求的预期错误。 */
class PayloadCaptured extends Error {
	/** 构造固定名称的捕获完成错误；无参数，无返回值。 */
	constructor() {
		super("payload captured");
		this.name = "PayloadCaptured";
	}
}

/** 创建含一条 Hello 用户消息的最小上下文；无参数，返回 Context。 */
function makeContext(): Context {
	return {
		messages: [{ role: "user", content: "Hello", timestamp: Date.now() }],
	};
}

/**
 * 创建使用 Anthropic Messages 协议的自定义代理模型。
 * 参数：compat 为可选兼容设置。
 * 返回值：指向本地无效端口的 Model。
 * 使用示例：`makeCustomModel({ supportsTemperature: false })`。
 */
function makeCustomModel(compat?: Model<"anthropic-messages">["compat"]): Model<"anthropic-messages"> {
	return {
		id: "vendor--claude-opus-4-7",
		name: "Vendor Proxy Opus 4.7",
		api: "anthropic-messages",
		provider: "vendor-proxy",
		baseUrl: "http://127.0.0.1:9",
		reasoning: true,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 200000,
		maxTokens: 32000,
		compat,
	};
}

/**
 * 在请求发送前捕获 Anthropic 载荷。
 * 参数：model 为被测模型，options 为可选简单流设置。
 * 返回值：捕获到的温度载荷 Promise。
 * 使用示例：`await capturePayload(model, { temperature: 0 })`。
 */
async function capturePayload(
	model: Model<"anthropic-messages">,
	options?: SimpleStreamOptions,
): Promise<AnthropicTemperaturePayload> {
	// capturedPayload 保存 onPayload 观察到的请求字段。
	let capturedPayload: AnthropicTemperaturePayload | undefined;

	// payloadCaptureModel 强制使用本地无效端点，防止意外网络访问。
	const payloadCaptureModel: Model<"anthropic-messages"> = {
		...model,
		baseUrl: "http://127.0.0.1:9",
	};

	// s 是构造请求并在 onPayload 阶段中止的简单事件流。
	const s = streamSimple(payloadCaptureModel, makeContext(), {
		...options,
		apiKey: "fake-key",
		// payload 是发送前的原始请求载荷，捕获后抛错阻止真正发送。
		onPayload: (payload) => {
			capturedPayload = payload as AnthropicTemperaturePayload;
			throw new PayloadCaptured();
		},
	});

	await s.result();

	if (!capturedPayload) {
		throw new Error("Expected payload to be captured before request failure");
	}

	return capturedPayload;
}

describe("Anthropic temperature compatibility", () => {
	// 验证 Opus 4.7 请求省略显式 temperature=0；无参数，无返回值。
	it("omits temperature for Claude Opus 4.7", async () => {
		// payload 是捕获的 Opus 4.7 请求载荷。
		const payload = await capturePayload(getModel("anthropic", "claude-opus-4-7"), { temperature: 0 });

		expect(payload.temperature).toBeUndefined();
	});

	// 验证 Opus 4.8 请求省略显式 temperature=0；无参数，无返回值。
	it("omits temperature for Claude Opus 4.8", async () => {
		// payload 是捕获的 Opus 4.8 请求载荷。
		const payload = await capturePayload(getModel("anthropic", "claude-opus-4-8"), { temperature: 0 });

		expect(payload.temperature).toBeUndefined();
	});

	// 验证 Opus 4.7 连默认 temperature=1 也省略；无参数，无返回值。
	it("omits default temperature for Claude Opus 4.7", async () => {
		// payload 是带默认温度选项构造的 Opus 4.7 载荷。
		const payload = await capturePayload(getModel("anthropic", "claude-opus-4-7"), { temperature: 1 });

		expect(payload.temperature).toBeUndefined();
	});

	// 验证 Opus 4.6 仍保留 temperature=0；无参数，无返回值。
	it("keeps temperature for Claude Opus 4.6", async () => {
		// payload 是捕获的 Opus 4.6 请求载荷。
		const payload = await capturePayload(getModel("anthropic", "claude-opus-4-6"), { temperature: 0 });

		expect(payload.temperature).toBe(0);
	});

	// 验证 Sonnet 4.6 仍保留 temperature=0；无参数，无返回值。
	it("keeps temperature for Claude Sonnet 4.6", async () => {
		// payload 是捕获的 Sonnet 4.6 请求载荷。
		const payload = await capturePayload(getModel("anthropic", "claude-sonnet-4-6"), { temperature: 0 });

		expect(payload.temperature).toBe(0);
	});

	// 验证自定义模型显式关闭 supportsTemperature 时省略温度；无参数，无返回值。
	it("omits temperature for custom models with supportsTemperature disabled", async () => {
		// payload 是自定义不支持温度模型的请求载荷。
		const payload = await capturePayload(makeCustomModel({ supportsTemperature: false }), { temperature: 0 });

		expect(payload.temperature).toBeUndefined();
	});
});
