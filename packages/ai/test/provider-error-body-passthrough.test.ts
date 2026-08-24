// Regression test for issues/provider-error-body-passthrough
//
// When an endpoint behind a proxy / gateway returns a non-2xx response with a
// body the SDK cannot fold into its message, the provider catch block drops the
// body. The openai SDK's APIError keeps the parsed body on `error.error` and
// produces `"<status> status code (no body)"` as the message, so a body-blind
// catch (`error.message` only) surfaces the opaque message and hides the real
// reason the gateway returned.
//
// This test routes a 403-with-body APIError through the OpenRouter image
// provider (one of the body-blind providers) and asserts the resulting
// errorMessage contains both the status and the body reason. It is EXPECTED TO
// FAIL until the provider catch blocks read the SDK error body.
// 在提供商捕获逻辑读取 SDK 错误体之前，该回归测试预期失败。
/**
 * 文件职责：回归验证图片提供商错误会同时保留 HTTP 状态和网关响应体中的真实原因。
 * 技术维度：使用 Vitest 模块模拟、OpenAI APIError 形状和 OpenRouter 图片生成入口。
 * 产品维度：让用户看到网关拒绝请求的具体原因，而不是无内容的模糊 SDK 错误。
 * 逻辑维度：模拟 OpenAI 客户端返回带解析错误体的 403，调用图片接口并检查 errorMessage。
 * 关键边界：不访问网络；FakeAPIError 只复现本回归依赖的 status、error 和 message 字段。
 * 新手阅读建议：先读顶部缺陷背景，再看 FakeAPIError 与 OpenAI 模拟，最后看三条错误断言。
 */

import { describe, expect, it, vi } from "vitest";
import { generateImages } from "../src/images.ts";
import type { ImagesContext, ImagesModel } from "../src/types.ts";

// Reproduce the openai SDK APIError shape: makeMessage(status, error, message)
// returns `"403 status code (no body)"` when status is set but the parsed body
// (`error`) is empty/unparsed, while the parsed body itself is kept on `.error`.
// 复现 OpenAI SDK 的 APIError：消息可能显示“无正文”，但解析后的正文仍保存在 error.error。
/** 模拟 OpenAI SDK 权限错误的最小字段集合。 */
class FakeAPIError extends Error {
	// status 保存 HTTP 状态码，本例固定为 403。
	status: number;
	// error 保存 SDK 解析后的任意响应正文。
	error: unknown;
	/** 构造模拟错误；status 为状态码，parsedBody 为解析正文，无返回值。 */
	constructor(status: number, parsedBody: unknown) {
		super(`${status} status code (no body)`);
		this.name = "PermissionDeniedError";
		this.status = status;
		this.error = parsedBody;
	}
}

// 用本地假客户端替换 openai 模块，避免发送真实请求。
vi.mock("openai", () => {
	/** 只实现图片提供商访问的 chat.completions.create 调用链。 */
	class FakeOpenAI {
		// chat 提供 completions.create，并返回带 withResponse 的 Promise。
		chat = {
			completions: {
				// create 创建一个可附加 withResponse 方法的占位 Promise。
				create: () => {
					// promise 模拟 OpenAI SDK 可继续调用 withResponse 的返回对象。
					const promise = Promise.resolve(undefined) as unknown as {
						withResponse: () => Promise<never>;
					};
					promise.withResponse = async () => {
						// 403 from a gateway/proxy carrying the real reason in the body.
						// 网关或代理返回 403，并把真实原因放在响应正文中。
						throw new FakeAPIError(403, { error: "blocked by gateway WAF" });
					};
					return promise;
				},
			},
		};
	}
	return { default: FakeOpenAI };
});

describe("provider error body passthrough", () => {
	// 验证 OpenRouter 图片错误包含 403 与 WAF 原因，而非 SDK 模糊消息；无参数，无返回值。
	it("surfaces the HTTP body reason instead of the opaque SDK message (openrouter images)", async () => {
		// model 是用于触发 OpenRouter 图片提供商路径的最小模型配置。
		const model: ImagesModel<"openrouter-images"> = {
			id: "black-forest-labs/flux.2-pro",
			name: "FLUX.2 Pro",
			api: "openrouter-images",
			provider: "openrouter",
			baseUrl: "https://openrouter.ai/api/v1",
			input: ["text", "image"],
			output: ["image"],
			cost: { input: 0.015, output: 0.03, cacheRead: 0, cacheWrite: 0 },
		};
		// context 是请求生成一张狗图片的最小输入上下文。
		const context: ImagesContext = {
			input: [{ type: "text", text: "Generate a dog" }],
		};

		// output 是提供商捕获模拟 403 后返回的错误结果。
		const output = await generateImages(model, context, { apiKey: "test" });

		expect(output.stopReason).toBe("error");
		// The status should be surfaced.
		// 错误信息应暴露 HTTP 状态码。
		expect(output.errorMessage).toContain("403");
		// The body reason must not be swallowed by the opaque SDK message.
		// 响应体中的真实原因不能被 SDK 模糊消息吞掉。
		expect(output.errorMessage).toContain("blocked by gateway WAF");
		expect(output.errorMessage).not.toBe("403 status code (no body)");
	});
});
