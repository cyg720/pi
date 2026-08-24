/**
 * 文件职责：验证 OpenRouter 图片生成适配器能组装请求、解析文本/图片、统计响应标识并传递取消信号。
 * 技术维度：使用 Vitest、模拟 OpenAI Chat Completions SDK、data URL 图片和 AbortController。
 * 产品维度：让用户通过 OpenRouter 图像模型获得结构化图片结果，并能安全取消耗时生成。
 * 逻辑维度：模拟 SDK 成功或中止；三个用例检查多模态输出、请求参数、取消结果和简单图片存在性。
 * 关键边界：请求必须非流式并声明 image/text modalities；取消错误应转换为 stopReason=aborted。
 * 新手阅读建议：先看 FakeOpenAI 返回的数据形状，再对照 generateImages 的输入、输出和 captured params。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateImages } from "../src/images.ts";
import type { ImagesContext, ImagesModel } from "../src/types.ts";

// OpenAI SDK 模拟状态；保存最后一次请求体和请求选项。
const mockState = vi.hoisted(() => ({
	lastParams: undefined as unknown,
	lastRequestOptions: undefined as unknown,
}));

vi.mock("openai", () => {
	// FakeOpenAI 提供 OpenRouter 图片适配器所需的最小 SDK 接口。
	class FakeOpenAI {
		// 模拟 chat.completions.create，并根据 AbortSignal 返回成功或中止。
		chat = {
			completions: {
				create: (params: unknown, requestOptions?: unknown) => {
					mockState.lastParams = params;
					mockState.lastRequestOptions = requestOptions;
					// 请求选项中的可选取消信号。
					const signal = (requestOptions as { signal?: AbortSignal } | undefined)?.signal;
					if (signal?.aborted) {
						// 预先取消时由 withResponse 抛出的错误。
						const error = new Error("Request aborted");
						return {
							withResponse: async () => {
								throw error;
							},
						};
					}
					// 固定的文本加 data URL 图片响应。
					const response = {
						id: "img-1",
						usage: {
							prompt_tokens: 12,
							completion_tokens: 34,
							prompt_tokens_details: { cached_tokens: 0 },
						},
						choices: [
							{
								message: {
									content: "Here is your image.",
									images: [{ image_url: "data:image/png;base64,ZmFrZS1wbmc=" }],
								},
							},
						],
					};
					// 带 withResponse 扩展的 SDK Promise。
					const promise = Promise.resolve(response) as Promise<typeof response> & {
						withResponse: () => Promise<{
							data: typeof response;
							response: { status: number; headers: Headers };
						}>;
					};
					promise.withResponse = async () => ({
						data: response,
						response: { status: 200, headers: new Headers() },
					});
					return promise;
				},
			},
		};
	}

	return { default: FakeOpenAI };
});

describe("openrouter images", () => {
	// 功能：重置捕获请求；参数：无；返回：无。示例：每个用例前自动调用。
	beforeEach(() => {
		mockState.lastParams = undefined;
		mockState.lastRequestOptions = undefined;
	});

	it("returns text plus images in final output", async () => {
		// 同时支持文本和图片输出的 OpenRouter 图像模型。
		const model: ImagesModel<"openrouter-images"> = {
			id: "google/gemini-3.1-flash-image-preview",
			name: "Gemini 3.1 Flash Image Preview",
			api: "openrouter-images",
			provider: "openrouter",
			baseUrl: "https://openrouter.ai/api/v1",
			input: ["text", "image"],
			output: ["text", "image"],
			cost: { input: 0.015, output: 0.03, cacheRead: 0, cacheWrite: 0 },
			headers: { "HTTP-Referer": "https://example.com" },
		};
		// 单条文本提示的图片生成上下文。
		const context: ImagesContext = {
			input: [{ type: "text", text: "Generate a dog" }],
		};

		// 解析后的最终图片助手结果。
		const output = await generateImages(model, context, { apiKey: "test" });
		expect(output.stopReason).toBe("stop");
		expect(output.responseId).toBe("img-1");
		expect(output.output[0]).toMatchObject({ type: "text", text: "Here is your image." });
		expect(output.output[1]).toMatchObject({ type: "image", mimeType: "image/png", data: "ZmFrZS1wbmc=" });

		// 捕获请求体的最小类型视图。
		const params = mockState.lastParams as {
			stream?: boolean;
			modalities?: string[];
			messages?: [{ content?: [{ type: string; text?: string }] }];
		};
		expect(params.stream).toBe(false);
		expect(params.modalities).toEqual(["image", "text"]);
		expect(params.messages?.[0]?.content?.[0]).toMatchObject({ type: "text", text: "Generate a dog" });
	});

	it("passes through abort signal and returns aborted result", async () => {
		// 只输出图片的 FLUX 测试模型。
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
		// 取消场景的文本输入上下文。
		const context: ImagesContext = {
			input: [{ type: "text", text: "Generate a dog" }],
		};
		// 在调用前即中止的控制器。
		const controller = new AbortController();
		controller.abort();

		// 应被转换为 aborted 的生成结果。
		const output = await generateImages(model, context, { apiKey: "test", signal: controller.signal });
		expect(output.stopReason).toBe("aborted");
		expect(output.errorMessage).toBe("Request aborted");
		expect(mockState.lastRequestOptions).toMatchObject({ signal: controller.signal });
	});

	it("generateImages resolves the final assistant images result", async () => {
		// 最终结果解析场景的 FLUX 测试模型。
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
		// 简单图片生成上下文。
		const context: ImagesContext = {
			input: [{ type: "text", text: "Generate a dog" }],
		};

		// 应至少包含一项 image 的最终结果。
		const output = await generateImages(model, context, { apiKey: "test" });
		expect(output.output.some((item) => item.type === "image")).toBe(true);
	});
});
