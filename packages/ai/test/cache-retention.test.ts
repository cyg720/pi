/**
 * 文件职责：验证 Anthropic、OpenAI Responses 与 OpenAI Completions 请求载荷中的提示缓存保留配置。
 * 技术维度：使用 Vitest、各提供商流接口和 onPayload 截获机制，在发出网络请求前检查构造的请求对象。
 * 产品维度：保障短期、长期或禁用缓存设置能正确降低重复上下文成本，同时兼容代理和不支持特性的模型。
 * 逻辑维度：通过抛出专用异常在载荷生成后终止请求，再分别检查环境变量、显式选项和模型兼容标志。
 * 关键边界：部分在线用例需要真实密钥；代理场景使用假地址并预期失败，只以已截获载荷作为断言依据。
 * 新手阅读建议：先读 stopAfterPayload 理解拦截技巧，再比较三个提供商分组对 retention、key 和 options 的映射。
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { stream as streamAnthropic } from "../src/api/anthropic-messages.ts";
import { stream as streamOpenAICompletions } from "../src/api/openai-completions.ts";
import { stream as streamOpenAIResponses } from "../src/api/openai-responses.ts";
import { getModel, stream } from "../src/compat.ts";
import { MODELS } from "../src/models.generated.ts";
import type { Context, Model } from "../src/types.ts";

/** 专用控制流异常：在成功截获请求载荷后立即中止流，避免真正发送测试请求。 */
class PayloadCaptured extends Error {
	/** 创建“载荷已截获”异常。无参数；实例仅用于被测试代码提前退出。例如：new PayloadCaptured()。 */
	constructor() {
		super("payload captured");
		this.name = "PayloadCaptured";
	}
}

/** 接口 OpenAICompletionsCachePayload：描述测试需要检查的 OpenAI 提示缓存载荷字段。 */
interface OpenAICompletionsCachePayload {
	/** 可选缓存键，通常由 sessionId 映射而来。 */
	prompt_cache_key?: string;
	/** 可选缓存保留时长，长期模式预期为 24h。 */
	prompt_cache_retention?: string;
}

/** 接口 OpenAIResponsesCachePayload：描述测试需要检查的 OpenAI 提示缓存载荷字段。 */
interface OpenAIResponsesCachePayload extends OpenAICompletionsCachePayload {
	/** 可选缓存写入策略；explicit 用于禁用隐式缓存写入。 */
	prompt_cache_options?: { mode: "explicit" };
}

/** 创建截获 onPayload 的回调。参数 capture 保存强类型载荷；返回会在保存后抛出 PayloadCaptured 的函数。例如：stopAfterPayload(payload => saved = payload)。 */
function stopAfterPayload<TPayload>(capture: (payload: TPayload) => void): (payload: unknown) => never {
	return (payload: unknown): never => {
		capture(payload as TPayload);
		throw new PayloadCaptured();
	};
}

/** 测试分组：按提供商拆分的提示缓存保留行为。 */
describe("Cache Retention (PI_CACHE_RETENTION)", () => {
	/** 变量 originalEnv：测试开始时 PI_CACHE_RETENTION 环境变量的原值；只在当前模块、分组或测试范围内使用。 */
	const originalEnv = process.env.PI_CACHE_RETENTION;

	beforeEach(() => {
		delete process.env.PI_CACHE_RETENTION;
	});

	afterEach(() => {
		if (originalEnv !== undefined) {
			process.env.PI_CACHE_RETENTION = originalEnv;
		} else {
			delete process.env.PI_CACHE_RETENTION;
		}
	});

	/** 变量 context：所有请求共享的最小系统提示与用户消息上下文；只在当前模块、分组或测试范围内使用。 */
	const context: Context = {
		systemPrompt: "You are a helpful assistant.",
		messages: [{ role: "user", content: "Hello", timestamp: Date.now() }],
	};

	/** 测试分组：按提供商拆分的提示缓存保留行为。 */
	describe("Anthropic Provider", () => {
		/** 测试场景：检查当前缓存模式与模型兼容标志生成的请求载荷字段。 */
		it.skipIf(!process.env.ANTHROPIC_API_KEY)(
			"should use default cache TTL (no ttl field) when PI_CACHE_RETENTION is not set",
			async () => {
				/** 变量 model：当前被测模型配置；只在当前模块、分组或测试范围内使用。 */
				const model = getModel("anthropic", "claude-haiku-4-5");
				/** 变量 capturedPayload：onPayload 截获的提供商原始请求载荷；只在当前模块、分组或测试范围内使用。 */
				let capturedPayload: any = null;

				/** 变量 s：尚未消费的助手消息事件流；只在当前模块、分组或测试范围内使用。 */
				const s = stream(model, context, {
					onPayload: stopAfterPayload((payload) => {
						capturedPayload = payload;
					}),
				});

				// Consume the stream to trigger the request
				// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。
				for await (const _ of s) {
					/** 循环变量 _：仅用于驱动事件流生成请求载荷，不读取事件内容。 */
					// Just consume
					// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。
				}

				expect(capturedPayload).not.toBeNull();
				// System prompt should have cache_control without ttl
				// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。
				expect(capturedPayload.system).toBeDefined();
				expect(capturedPayload.system[0].cache_control).toEqual({ type: "ephemeral" });
			},
		);

		/** 测试场景：检查当前缓存模式与模型兼容标志生成的请求载荷字段。 */
		it.skipIf(!process.env.ANTHROPIC_API_KEY)("should use 1h cache TTL when PI_CACHE_RETENTION=long", async () => {
			process.env.PI_CACHE_RETENTION = "long";
			/** 变量 model：当前被测模型配置；只在当前模块、分组或测试范围内使用。 */
			const model = getModel("anthropic", "claude-haiku-4-5");
			/** 变量 capturedPayload：onPayload 截获的提供商原始请求载荷；只在当前模块、分组或测试范围内使用。 */
			let capturedPayload: any = null;

			/** 变量 s：尚未消费的助手消息事件流；只在当前模块、分组或测试范围内使用。 */
			const s = stream(model, context, {
				onPayload: stopAfterPayload((payload) => {
					capturedPayload = payload;
				}),
			});

			// Consume the stream to trigger the request
			// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。
			for await (const _ of s) {
				/** 循环变量 _：仅用于驱动事件流生成请求载荷，不读取事件内容。 */
				// Just consume
				// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。
			}

			expect(capturedPayload).not.toBeNull();
			// System prompt should have cache_control with ttl: "1h"
			// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。
			expect(capturedPayload.system).toBeDefined();
			expect(capturedPayload.system[0].cache_control).toEqual({ type: "ephemeral", ttl: "1h" });
		});

		/** 测试场景：检查当前缓存模式与模型兼容标志生成的请求载荷字段。 */
		it("should add ttl for non-api.anthropic.com baseUrl by default", async () => {
			process.env.PI_CACHE_RETENTION = "long";

			// Create a model with a different baseUrl (simulating a proxy)
			/** 变量 baseModel：模型目录返回的基础模型配置；只在当前模块、分组或测试范围内使用。 */
			// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。
			const baseModel = getModel("anthropic", "claude-haiku-4-5");
			/** 变量 proxyModel：把 baseUrl 改为代理地址的模型配置；只在当前模块、分组或测试范围内使用。 */
			const proxyModel = {
				...baseModel,
				baseUrl: "https://my-proxy.example.com/v1",
				// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。
			};

			/** 变量 capturedPayload：onPayload 截获的提供商原始请求载荷；只在当前模块、分组或测试范围内使用。 */
			let capturedPayload: any = null;

			// We can't actually make the request (no proxy), but we can verify the payload
			// by using a mock or checking the logic directly
			// For this test, we'll import the helper directly
			// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。

			// Since we can't easily test this without mocking, we'll skip the actual API call
			// and just verify the helper logic works correctly
			// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。

			try {
				/** 变量 s：尚未消费的助手消息事件流；只在当前模块、分组或测试范围内使用。 */
				const s = streamAnthropic(proxyModel, context, {
					apiKey: "fake-key",
					onPayload: stopAfterPayload((payload) => {
						capturedPayload = payload;
					}),
				});

				// This will fail since we're using a fake key and fake proxy, but the payload should be captured
				// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。
				for await (const event of s) {
					/** 循环变量 event：当前流事件，遇到 error 后停止消费。 */
					if (event.type === "error") break;
				}
			} catch {
				// Expected to fail
				// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。
			}

			expect(capturedPayload).not.toBeNull();
			expect(capturedPayload.system[0].cache_control).toEqual({ type: "ephemeral", ttl: "1h" });
		});

		/** 测试场景：检查当前缓存模式与模型兼容标志生成的请求载荷字段。 */
		it("should omit ttl when supportsLongCacheRetention is false", async () => {
			/** 变量 baseModel：模型目录返回的基础模型配置；只在当前模块、分组或测试范围内使用。 */
			const baseModel = getModel("anthropic", "claude-haiku-4-5");
			/** 变量 proxyModel：把 baseUrl 改为代理地址的模型配置；只在当前模块、分组或测试范围内使用。 */
			const proxyModel = {
				...baseModel,
				baseUrl: "https://my-proxy.example.com/v1",
				// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。
				compat: { supportsLongCacheRetention: false },
			};
			/** 变量 capturedPayload：onPayload 截获的提供商原始请求载荷；只在当前模块、分组或测试范围内使用。 */
			let capturedPayload: any = null;

			try {
				/** 变量 s：尚未消费的助手消息事件流；只在当前模块、分组或测试范围内使用。 */
				const s = streamAnthropic(proxyModel, context, {
					apiKey: "fake-key",
					cacheRetention: "long",
					onPayload: stopAfterPayload((payload) => {
						capturedPayload = payload;
					}),
				});

				for await (const event of s) {
					/** 循环变量 event：当前流事件，遇到 error 后停止消费。 */
					if (event.type === "error") break;
				}
			} catch {
				// Expected to fail
				// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。
			}

			expect(capturedPayload).not.toBeNull();
			expect(capturedPayload.system[0].cache_control).toEqual({ type: "ephemeral" });
		});

		/** 测试场景：检查当前缓存模式与模型兼容标志生成的请求载荷字段。 */
		it("should omit cache_control when cacheRetention is none", async () => {
			/** 变量 baseModel：模型目录返回的基础模型配置；只在当前模块、分组或测试范围内使用。 */
			const baseModel = getModel("anthropic", "claude-haiku-4-5");
			/** 变量 capturedPayload：onPayload 截获的提供商原始请求载荷；只在当前模块、分组或测试范围内使用。 */
			let capturedPayload: any = null;

			try {
				/** 变量 s：尚未消费的助手消息事件流；只在当前模块、分组或测试范围内使用。 */
				const s = streamAnthropic(baseModel, context, {
					apiKey: "fake-key",
					cacheRetention: "none",
					onPayload: stopAfterPayload((payload) => {
						capturedPayload = payload;
					}),
				});

				for await (const event of s) {
					/** 循环变量 event：当前流事件，遇到 error 后停止消费。 */
					if (event.type === "error") break;
				}
			} catch {
				// Expected to fail
				// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。
			}

			expect(capturedPayload).not.toBeNull();
			expect(capturedPayload.system[0].cache_control).toBeUndefined();
		});

		/** 测试场景：检查当前缓存模式与模型兼容标志生成的请求载荷字段。 */
		it("should add cache_control to string user messages", async () => {
			/** 变量 baseModel：模型目录返回的基础模型配置；只在当前模块、分组或测试范围内使用。 */
			const baseModel = getModel("anthropic", "claude-haiku-4-5");
			/** 变量 capturedPayload：onPayload 截获的提供商原始请求载荷；只在当前模块、分组或测试范围内使用。 */
			let capturedPayload: any = null;

			try {
				/** 变量 s：尚未消费的助手消息事件流；只在当前模块、分组或测试范围内使用。 */
				const s = streamAnthropic(baseModel, context, {
					apiKey: "fake-key",
					onPayload: stopAfterPayload((payload) => {
						capturedPayload = payload;
					}),
				});

				for await (const event of s) {
					/** 循环变量 event：当前流事件，遇到 error 后停止消费。 */
					if (event.type === "error") break;
				}
			} catch {
				// Expected to fail
				// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。
			}

			expect(capturedPayload).not.toBeNull();
			/** 变量 lastMessage：Anthropic 载荷中的最后一条消息；只在当前模块、分组或测试范围内使用。 */
			const lastMessage = capturedPayload.messages[capturedPayload.messages.length - 1];
			expect(Array.isArray(lastMessage.content)).toBe(true);
			/** 变量 lastBlock：最后一条消息的末尾内容块；只在当前模块、分组或测试范围内使用。 */
			const lastBlock = lastMessage.content[lastMessage.content.length - 1];
			expect(lastBlock.cache_control).toEqual({ type: "ephemeral" });
		});

		/** 测试场景：检查当前缓存模式与模型兼容标志生成的请求载荷字段。 */
		it("should set 1h cache TTL when cacheRetention is long", async () => {
			/** 变量 baseModel：模型目录返回的基础模型配置；只在当前模块、分组或测试范围内使用。 */
			const baseModel = getModel("anthropic", "claude-haiku-4-5");
			/** 变量 capturedPayload：onPayload 截获的提供商原始请求载荷；只在当前模块、分组或测试范围内使用。 */
			let capturedPayload: any = null;

			try {
				/** 变量 s：尚未消费的助手消息事件流；只在当前模块、分组或测试范围内使用。 */
				const s = streamAnthropic(baseModel, context, {
					apiKey: "fake-key",
					cacheRetention: "long",
					onPayload: stopAfterPayload((payload) => {
						capturedPayload = payload;
					}),
				});

				for await (const event of s) {
					/** 循环变量 event：当前流事件，遇到 error 后停止消费。 */
					if (event.type === "error") break;
				}
			} catch {
				// Expected to fail
				// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。
			}

			expect(capturedPayload).not.toBeNull();
			expect(capturedPayload.system[0].cache_control).toEqual({ type: "ephemeral", ttl: "1h" });
		});
	});

	/** 测试分组：按提供商拆分的提示缓存保留行为。 */
	describe("OpenAI Responses Provider", () => {
		/** 测试场景：检查当前缓存模式与模型兼容标志生成的请求载荷字段。 */
		it.skipIf(!process.env.OPENAI_API_KEY)(
			"should not set prompt_cache_retention when PI_CACHE_RETENTION is not set",
			async () => {
				/** 变量 model：当前被测模型配置；只在当前模块、分组或测试范围内使用。 */
				const model = getModel("openai", "gpt-4o-mini");
				/** 变量 capturedPayload：onPayload 截获的提供商原始请求载荷；只在当前模块、分组或测试范围内使用。 */
				let capturedPayload: any = null;

				/** 变量 s：尚未消费的助手消息事件流；只在当前模块、分组或测试范围内使用。 */
				const s = stream(model, context, {
					onPayload: stopAfterPayload((payload) => {
						capturedPayload = payload;
					}),
				});

				// Consume the stream to trigger the request
				// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。
				for await (const _ of s) {
					/** 循环变量 _：仅用于驱动事件流生成请求载荷，不读取事件内容。 */
					// Just consume
					// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。
				}

				expect(capturedPayload).not.toBeNull();
				expect(capturedPayload.prompt_cache_retention).toBeUndefined();
			},
		);

		/** 测试场景：检查当前缓存模式与模型兼容标志生成的请求载荷字段。 */
		it.skipIf(!process.env.OPENAI_API_KEY)(
			"should set prompt_cache_retention to 24h when PI_CACHE_RETENTION=long",
			async () => {
				process.env.PI_CACHE_RETENTION = "long";
				/** 变量 model：当前被测模型配置；只在当前模块、分组或测试范围内使用。 */
				const model = getModel("openai", "gpt-4o-mini");
				/** 变量 capturedPayload：onPayload 截获的提供商原始请求载荷；只在当前模块、分组或测试范围内使用。 */
				let capturedPayload: any = null;

				/** 变量 s：尚未消费的助手消息事件流；只在当前模块、分组或测试范围内使用。 */
				const s = stream(model, context, {
					onPayload: stopAfterPayload((payload) => {
						capturedPayload = payload;
					}),
				});

				// Consume the stream to trigger the request
				// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。
				for await (const _ of s) {
					/** 循环变量 _：仅用于驱动事件流生成请求载荷，不读取事件内容。 */
					// Just consume
					// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。
				}

				expect(capturedPayload).not.toBeNull();
				expect(capturedPayload.prompt_cache_retention).toBe("24h");
			},
		);

		/** 测试场景：检查当前缓存模式与模型兼容标志生成的请求载荷字段。 */
		it("should set prompt_cache_retention for non-api.openai.com baseUrl by default", async () => {
			process.env.PI_CACHE_RETENTION = "long";

			// Create a model with a different baseUrl (simulating a proxy)
			/** 变量 baseModel：模型目录返回的基础模型配置；只在当前模块、分组或测试范围内使用。 */
			// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。
			const baseModel = getModel("openai", "gpt-4o-mini");
			/** 变量 proxyModel：把 baseUrl 改为代理地址的模型配置；只在当前模块、分组或测试范围内使用。 */
			const proxyModel = {
				...baseModel,
				baseUrl: "https://my-proxy.example.com/v1",
				// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。
			};

			/** 变量 capturedPayload：onPayload 截获的提供商原始请求载荷；只在当前模块、分组或测试范围内使用。 */
			let capturedPayload: any = null;

			try {
				/** 变量 s：尚未消费的助手消息事件流；只在当前模块、分组或测试范围内使用。 */
				const s = streamOpenAIResponses(proxyModel, context, {
					apiKey: "fake-key",
					onPayload: stopAfterPayload((payload) => {
						capturedPayload = payload;
					}),
				});

				// This will fail since we're using a fake key and fake proxy, but the payload should be captured
				// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。
				for await (const event of s) {
					/** 循环变量 event：当前流事件，遇到 error 后停止消费。 */
					if (event.type === "error") break;
				}
			} catch {
				// Expected to fail
				// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。
			}

			expect(capturedPayload).not.toBeNull();
			expect(capturedPayload.prompt_cache_retention).toBe("24h");
		});

		/** 测试场景：检查当前缓存模式与模型兼容标志生成的请求载荷字段。 */
		it("should omit prompt_cache_retention when supportsLongCacheRetention is false", async () => {
			/** 变量 model：当前被测模型配置；只在当前模块、分组或测试范围内使用。 */
			const model = {
				...getModel("openai", "gpt-4o-mini"),
				compat: { supportsLongCacheRetention: false },
			};
			/** 变量 capturedPayload：onPayload 截获的提供商原始请求载荷；只在当前模块、分组或测试范围内使用。 */
			let capturedPayload: any = null;

			try {
				/** 变量 s：尚未消费的助手消息事件流；只在当前模块、分组或测试范围内使用。 */
				const s = streamOpenAIResponses(model, context, {
					apiKey: "fake-key",
					cacheRetention: "long",
					sessionId: "session-compat-false",
					onPayload: stopAfterPayload((payload) => {
						capturedPayload = payload;
					}),
				});

				for await (const event of s) {
					/** 循环变量 event：当前流事件，遇到 error 后停止消费。 */
					if (event.type === "error") break;
				}
			} catch {
				// Expected to fail
				// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。
			}

			expect(capturedPayload).not.toBeNull();
			expect(capturedPayload.prompt_cache_retention).toBeUndefined();
		});

		/** 测试场景：检查当前缓存模式与模型兼容标志生成的请求载荷字段。 */
		it("should omit prompt_cache_key and disable implicit writes when cacheRetention is none", async () => {
			/** 变量 model：当前被测模型配置；只在当前模块、分组或测试范围内使用。 */
			const model = getModel("openai", "gpt-5.6-sol");
			/** 变量 capturedPayload：onPayload 截获的提供商原始请求载荷；只在当前模块、分组或测试范围内使用。 */
			let capturedPayload: OpenAIResponsesCachePayload | undefined;

			try {
				/** 变量 s：尚未消费的助手消息事件流；只在当前模块、分组或测试范围内使用。 */
				const s = streamOpenAIResponses(model, context, {
					apiKey: "fake-key",
					cacheRetention: "none",
					sessionId: "session-1",
					onPayload: stopAfterPayload<OpenAIResponsesCachePayload>((payload) => {
						capturedPayload = payload;
					}),
				});

				for await (const event of s) {
					/** 循环变量 event：当前流事件，遇到 error 后停止消费。 */
					if (event.type === "error") break;
				}
			} catch {
				// Expected to fail
				// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。
			}

			expect(capturedPayload).toBeDefined();
			expect(capturedPayload?.prompt_cache_key).toBeUndefined();
			expect(capturedPayload?.prompt_cache_retention).toBeUndefined();
			expect(capturedPayload?.prompt_cache_options).toEqual({ mode: "explicit" });
		});

		/** 测试场景：检查当前缓存模式与模型兼容标志生成的请求载荷字段。 */
		it("should omit prompt_cache_options for models that reject it", async () => {
			/** 变量 model：当前被测模型配置；只在当前模块、分组或测试范围内使用。 */
			const model = getModel("openai", "gpt-4o-mini");
			/** 变量 capturedPayload：onPayload 截获的提供商原始请求载荷；只在当前模块、分组或测试范围内使用。 */
			let capturedPayload: OpenAIResponsesCachePayload | undefined;

			try {
				/** 变量 s：尚未消费的助手消息事件流；只在当前模块、分组或测试范围内使用。 */
				const s = streamOpenAIResponses(model, context, {
					apiKey: "fake-key",
					cacheRetention: "none",
					sessionId: "session-1",
					onPayload: stopAfterPayload<OpenAIResponsesCachePayload>((payload) => {
						capturedPayload = payload;
					}),
				});

				for await (const event of s) {
					/** 循环变量 event：当前流事件，遇到 error 后停止消费。 */
					if (event.type === "error") break;
				}
			} catch {
				// Expected to fail
				// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。
			}

			expect(capturedPayload).toBeDefined();
			expect(capturedPayload?.prompt_cache_key).toBeUndefined();
			expect(capturedPayload?.prompt_cache_options).toBeUndefined();
		});

		/** 测试场景：检查当前缓存模式与模型兼容标志生成的请求载荷字段。 */
		it("should set prompt_cache_retention when cacheRetention is long", async () => {
			/** 变量 model：当前被测模型配置；只在当前模块、分组或测试范围内使用。 */
			const model = getModel("openai", "gpt-4o-mini");
			/** 变量 capturedPayload：onPayload 截获的提供商原始请求载荷；只在当前模块、分组或测试范围内使用。 */
			let capturedPayload: any = null;

			try {
				/** 变量 s：尚未消费的助手消息事件流；只在当前模块、分组或测试范围内使用。 */
				const s = streamOpenAIResponses(model, context, {
					apiKey: "fake-key",
					cacheRetention: "long",
					sessionId: "session-2",
					onPayload: stopAfterPayload((payload) => {
						capturedPayload = payload;
					}),
				});

				for await (const event of s) {
					/** 循环变量 event：当前流事件，遇到 error 后停止消费。 */
					if (event.type === "error") break;
				}
			} catch {
				// Expected to fail
				// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。
			}

			expect(capturedPayload).not.toBeNull();
			expect(capturedPayload.prompt_cache_key).toBe("session-2");
			expect(capturedPayload.prompt_cache_retention).toBe("24h");
		});
	});

	/** 测试分组：按提供商拆分的提示缓存保留行为。 */
	describe("OpenAI Completions Provider", () => {
		/** 创建代理地址下的 OpenAI Completions 测试模型。参数 compat 可覆盖兼容能力；返回完整模型配置。例如：createCompletionsModel({ supportsLongCacheRetention: false })。 */
		function createCompletionsModel(compat?: Model<"openai-completions">["compat"]): Model<"openai-completions"> {
			return {
				id: "test-model",
				name: "Test Model",
				api: "openai-completions",
				provider: "test-openai-completions",
				baseUrl: "https://my-proxy.example.com/v1",
				// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。
				reasoning: false,
				input: ["text"],
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				contextWindow: 128000,
				maxTokens: 4096,
				compat,
			};
		}

		/** 测试场景：检查当前缓存模式与模型兼容标志生成的请求载荷字段。 */
		it("should set prompt_cache_retention for non-api.openai.com baseUrl by default", async () => {
			/** 变量 capturedPayload：onPayload 截获的提供商原始请求载荷；只在当前模块、分组或测试范围内使用。 */
			let capturedPayload: any = null;

			try {
				/** 变量 s：尚未消费的助手消息事件流；只在当前模块、分组或测试范围内使用。 */
				const s = streamOpenAICompletions(createCompletionsModel(), context, {
					apiKey: "fake-key",
					cacheRetention: "long",
					sessionId: "session-completions",
					onPayload: stopAfterPayload((payload) => {
						capturedPayload = payload;
					}),
				});

				for await (const event of s) {
					/** 循环变量 event：当前流事件，遇到 error 后停止消费。 */
					if (event.type === "error") break;
				}
			} catch {
				// Expected to fail
				// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。
			}

			expect(capturedPayload).not.toBeNull();
			expect(capturedPayload.prompt_cache_key).toBe("session-completions");
			expect(capturedPayload.prompt_cache_retention).toBe("24h");
		});

		/** 测试场景：检查当前缓存模式与模型兼容标志生成的请求载荷字段。 */
		it("should omit prompt_cache_retention when supportsLongCacheRetention is false", async () => {
			/** 变量 capturedPayload：onPayload 截获的提供商原始请求载荷；只在当前模块、分组或测试范围内使用。 */
			let capturedPayload: any = null;

			try {
				/** 变量 s：尚未消费的助手消息事件流；只在当前模块、分组或测试范围内使用。 */
				const s = streamOpenAICompletions(createCompletionsModel({ supportsLongCacheRetention: false }), context, {
					apiKey: "fake-key",
					cacheRetention: "long",
					sessionId: "session-completions-false",
					onPayload: stopAfterPayload((payload) => {
						capturedPayload = payload;
					}),
				});

				for await (const event of s) {
					/** 循环变量 event：当前流事件，遇到 error 后停止消费。 */
					if (event.type === "error") break;
				}
			} catch {
				// Expected to fail
				// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。
			}

			expect(capturedPayload).not.toBeNull();
			expect(capturedPayload.prompt_cache_key).toBeUndefined();
			expect(capturedPayload.prompt_cache_retention).toBeUndefined();
		});

		/** 测试场景：检查当前缓存模式与模型兼容标志生成的请求载荷字段。 */
		it.each([
			MODELS.opencode["deepseek-v4-flash"],
			MODELS.opencode["deepseek-v4-pro"],
			MODELS.opencode["kimi-k2.5"],
			MODELS.opencode["kimi-k2.6"],
			MODELS.opencode["minimax-m2.7"],
			MODELS["opencode-go"]["kimi-k2.6"],
		] as const)("should omit long cache retention for $provider/$id", async (metadata) => {
			/** 变量 model：当前被测模型配置；只在当前模块、分组或测试范围内使用。 */
			const model = metadata as Model<"openai-completions">;
			/** 变量 capturedPayload：onPayload 截获的提供商原始请求载荷；只在当前模块、分组或测试范围内使用。 */
			let capturedPayload: OpenAICompletionsCachePayload | undefined;

			try {
				/** 变量 s：尚未消费的助手消息事件流；只在当前模块、分组或测试范围内使用。 */
				const s = streamOpenAICompletions(model, context, {
					apiKey: "fake-key",
					cacheRetention: "long",
					sessionId: "session-opencode-long-cache-unsupported",
					onPayload: stopAfterPayload<OpenAICompletionsCachePayload>((payload) => {
						capturedPayload = payload;
					}),
				});

				for await (const event of s) {
					/** 循环变量 event：当前流事件，遇到 error 后停止消费。 */
					if (event.type === "error") break;
				}
			} catch {
				// Expected to fail
				// 中文说明：以上英文注释解释了载荷触发方式、代理失败预期或具体缓存字段断言。
			}

			expect(model.compat?.supportsLongCacheRetention).toBe(false);
			expect(capturedPayload).toBeDefined();
			expect(capturedPayload?.prompt_cache_key).toBeUndefined();
			expect(capturedPayload?.prompt_cache_retention).toBeUndefined();
		});
	});
});
