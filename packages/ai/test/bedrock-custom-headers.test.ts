/**
 * 文件职责：验证 Bedrock 自定义 Header 通过 AWS SDK build 中间件注入，并安全跳过认证等保留 Header。
 * 技术维度：使用 Vitest 模拟 Bedrock SDK 类和 middlewareStack，捕获注册项并直接调用中间件处理器。
 * 产品维度：允许用户给 Bedrock 请求添加代理或追踪 Header，同时防止覆盖 AWS 签名、Host 和时间字段。
 * 逻辑维度：驱动伪流注册中间件，再覆盖正常注入、大小写安全、空 Header、异常请求结构和 streamSimple 转发。
 * 关键边界：保留 Header 比较必须不区分大小写；request/headers 缺失时原样传给下一个处理器；测试 send 固定失败。
 * 新手阅读建议：先看 bedrockMock 如何记录 handler/opts，再手动跟随 reg.handler(nextSpy)(fakeArgs) 的数据变化。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// MiddlewareHandler 描述 AWS SDK 中间件工厂：接收 next，返回处理请求参数的异步函数。
type MiddlewareHandler = (next: (args: unknown) => Promise<unknown>) => (args: unknown) => Promise<unknown>;

// bedrockMock 收集客户端 middlewareStack.add 的每次注册。
const bedrockMock = vi.hoisted(() => ({
	middlewareRegistrations: [] as Array<{
		handler: MiddlewareHandler;
		opts: { step?: string; name?: string; priority?: string };
	}>,
}));

// 用最小类替换 Bedrock Runtime SDK，避免真实 AWS 请求并暴露中间件。
vi.mock("@aws-sdk/client-bedrock-runtime", () => {
	/** BedrockRuntimeServiceException 是满足被测模块导入的错误占位类。 */
	class BedrockRuntimeServiceException extends Error {}

	/** BedrockRuntimeClient 记录中间件注册并让 send 以预期错误结束。 */
	class BedrockRuntimeClient {
		// middlewareStack 只实现 add，注册内容写入共享 mock。
		middlewareStack = {
			add: (handler: MiddlewareHandler, opts: { step?: string; name?: string; priority?: string }) => {
				bedrockMock.middlewareRegistrations.push({ handler, opts });
			},
		};

		/** 模拟失败发送；无参数；返回拒绝 Promise，确保不会访问网络。 */
		send(): Promise<never> {
			return Promise.reject(new Error("mock send"));
		}
	}

	/** ConverseStreamCommand 保存输入，满足被测客户端构造请求的需要。 */
	class ConverseStreamCommand {
		// input 是构造器收到的原始命令参数。
		readonly input: unknown;

		/** 参数 input 为命令请求；保存后创建实例。 */
		constructor(input: unknown) {
			this.input = input;
		}
	}

	return {
		BedrockRuntimeClient,
		BedrockRuntimeServiceException,
		ConverseStreamCommand,
		StopReason: {
			END_TURN: "end_turn",
			STOP_SEQUENCE: "stop_sequence",
			MAX_TOKENS: "max_tokens",
			MODEL_CONTEXT_WINDOW_EXCEEDED: "model_context_window_exceeded",
			TOOL_USE: "tool_use",
		},
		CachePointType: { DEFAULT: "default" },
		CacheTTL: { ONE_HOUR: "ONE_HOUR" },
		ConversationRole: { ASSISTANT: "assistant", USER: "user" },
		ImageFormat: { JPEG: "jpeg", PNG: "png", GIF: "gif", WEBP: "webp" },
		ToolResultStatus: { ERROR: "error", SUCCESS: "success" },
	};
});

import type { BedrockOptions } from "../src/api/bedrock-converse-stream.ts";
import { stream as streamBedrock, streamSimple as streamSimpleBedrock } from "../src/api/bedrock-converse-stream.ts";
import { getModel } from "../src/compat.ts";
import type { Context, Model } from "../src/types.ts";

// context 是所有 Bedrock 流共享的单条用户消息。
const context: Context = {
	messages: [{ role: "user", content: "hello", timestamp: Date.now() }],
};

// MIDDLEWARE_NAME 是被测自定义 Header 中间件的固定注册名。
const MIDDLEWARE_NAME = "pi-ai-custom-headers";

/** 获取内置 Bedrock Opus 测试模型；无参数；返回模型元数据。 */
function getModelFixture(): Model<"bedrock-converse-stream"> {
	return getModel("amazon-bedrock", "us.anthropic.claude-opus-4-8");
}

/**
 * Drive a stream to completion so the middleware (registered before `client.send`)
 * is captured even though the mocked `send()` rejects. Errors are swallowed because
 * the rejecting mock is expected — we only care about the recorded registrations.
 */
/**
 * 中文说明：驱动流到结束以触发 client.send 前的中间件注册；send 的预期失败会被吞掉。
 * @param options 待转发的 Bedrock 请求选项。
 * @returns 驱动完成的 Promise；例如 `await driveBedrock({ headers: { "x": "y" } })`。
 */
async function driveBedrock(options: BedrockOptions): Promise<void> {
	await streamBedrock(getModelFixture(), context, options)
		.result()
		.catch(() => undefined);
}

/** 筛选名称匹配的自定义 Header 中间件；无参数；返回注册数组。 */
function findCustomHeadersRegistration() {
	// matches 是当前用例中名称等于 MIDDLEWARE_NAME 的注册项。
	const matches = bedrockMock.middlewareRegistrations.filter((r) => r.opts.name === MIDDLEWARE_NAME);
	return matches;
}

// 每个用例前清空中间件注册记录。
beforeEach(() => {
	bedrockMock.middlewareRegistrations.length = 0;
});

// 验证 Bedrock 自定义 Header 中间件注册和执行的安全语义。
describe("bedrock custom headers middleware", () => {
	// 正常 Header 应注册一个低优先级 build 中间件并写入请求。
	it("VC1: registers a build-step middleware that injects the caller header (happy path)", async () => {
		await driveBedrock({ cacheRetention: "none", headers: { "x-custom": "v" } });

		// registrations 是本次流注册的自定义 Header 中间件。
		const registrations = findCustomHeadersRegistration();
		expect(registrations).toHaveLength(1);

		// reg 是唯一注册项。
		const [reg] = registrations;
		expect(reg.opts.step).toBe("build");
		expect(reg.opts.priority).toBe("low");
		expect(reg.opts.name).toBe(MIDDLEWARE_NAME);

		// nextSpy 模拟并记录中间件链下一个处理器。
		const nextSpy = vi.fn(async (a: unknown) => a);
		// fakeArgs 是含空 Header 映射的可写请求参数。
		const fakeArgs = { request: { headers: {} as Record<string, string> } };
		await reg.handler(nextSpy)(fakeArgs);

		expect(fakeArgs.request.headers["x-custom"]).toBe("v");
		expect(nextSpy).toHaveBeenCalledTimes(1);
		expect(nextSpy).toHaveBeenCalledWith(fakeArgs);
	});

	// 保留 Header 应不区分大小写跳过，仅允许普通自定义 Header 注入。
	it("VC2: skips reserved headers case-insensitively while applying allowed ones", async () => {
		await driveBedrock({
			cacheRetention: "none",
			headers: {
				authorization: "evil",
				"x-amz-date": "evil",
				"x-allowed": "ok",
				Authorization: "evil2",
				"X-Amz-Date": "evil2",
				HOST: "evil3",
			},
		});

		// reg 是本次自定义 Header 中间件注册。
		const [reg] = findCustomHeadersRegistration();
		expect(reg).toBeDefined();

		// nextSpy 记录最终请求是否继续传递。
		const nextSpy = vi.fn(async (a: unknown) => a);
		// fakeArgs 预置真实签名相关 Header，验证不会被恶意值覆盖。
		const fakeArgs = {
			request: {
				headers: {
					authorization: "real-auth",
					"x-amz-date": "real-date",
					host: "real-host",
				} as Record<string, string>,
			},
		};
		await reg.handler(nextSpy)(fakeArgs);

		expect(fakeArgs.request.headers.authorization).toBe("real-auth");
		expect(fakeArgs.request.headers["x-amz-date"]).toBe("real-date");
		expect(fakeArgs.request.headers.host).toBe("real-host");
		expect(fakeArgs.request.headers["x-allowed"]).toBe("ok");
		// Mixed-case reserved keys must be skipped too: a case-sensitive guard would
		// 混合大小写保留键也必须跳过，否则大小写敏感检查会添加并列的新键。
		// add them back as distinct capitalised keys. Assert no such leak occurred and
		// 断言没有此类泄漏，并确认只新增 x-allowed。
		// that the only new key beyond the three pre-existing ones is `x-allowed`.
		// 最终键集合应等于三个原键加一个允许键。
		expect(fakeArgs.request.headers.Authorization).toBeUndefined();
		expect(fakeArgs.request.headers["X-Amz-Date"]).toBeUndefined();
		expect(fakeArgs.request.headers.HOST).toBeUndefined();
		expect(Object.keys(fakeArgs.request.headers).sort()).toEqual(
			["authorization", "host", "x-allowed", "x-amz-date"].sort(),
		);
		expect(nextSpy).toHaveBeenCalledTimes(1);
	});

	// headers 未定义时不应注册任何中间件。
	it("VC3: registers no middleware when headers is undefined", async () => {
		await driveBedrock({ cacheRetention: "none" });

		expect(findCustomHeadersRegistration()).toHaveLength(0);
	});

	// 空 Header 对象也不应产生无意义中间件。
	it("VC3: registers no middleware when headers is empty", async () => {
		await driveBedrock({ cacheRetention: "none", headers: {} });

		expect(findCustomHeadersRegistration()).toHaveLength(0);
	});

	// 请求对象缺少 headers 或 request 时，中间件应安全透传。
	it("VC3 (structural guard): passes through unchanged when the request has no headers", async () => {
		await driveBedrock({ cacheRetention: "none", headers: { "x-custom": "v" } });

		// reg 是待直接调用的结构保护中间件。
		const [reg] = findCustomHeadersRegistration();
		expect(reg).toBeDefined();

		// nextSpy 返回输入并记录两种异常结构。
		const nextSpy = vi.fn(async (a: unknown) => a);

		// argsNoHeaders 含 request 但没有 headers。
		const argsNoHeaders = { request: {} };
		await expect(reg.handler(nextSpy)(argsNoHeaders)).resolves.toBeDefined();
		expect(nextSpy).toHaveBeenCalledWith(argsNoHeaders);

		// argsUndefinedRequest 的 request 明确为 undefined。
		const argsUndefinedRequest = { request: undefined };
		await expect(reg.handler(nextSpy)(argsUndefinedRequest)).resolves.toBeDefined();
		expect(nextSpy).toHaveBeenCalledWith(argsUndefinedRequest);

		expect(nextSpy).toHaveBeenCalledTimes(2);
	});

	// streamSimple 包装器必须把 Header 一直传到基础 stream 中间件。
	it("VC4: streamSimpleBedrock forwards headers end-to-end (regression guard)", async () => {
		await streamSimpleBedrock(getModelFixture(), context, { headers: { "x-custom": "v" } })
			.result()
			.catch(() => undefined);

		// registrations 是 streamSimple 路径产生的中间件注册。
		const registrations = findCustomHeadersRegistration();
		expect(registrations).toHaveLength(1);

		// reg 是唯一自定义 Header 注册项。
		const [reg] = registrations;
		expect(reg.opts.step).toBe("build");

		// nextSpy 和 fakeArgs 用于实际执行中间件并验证写入。
		const nextSpy = vi.fn(async (a: unknown) => a);
		const fakeArgs = { request: { headers: {} as Record<string, string> } };
		await reg.handler(nextSpy)(fakeArgs);

		expect(fakeArgs.request.headers["x-custom"]).toBe("v");
	});
});
