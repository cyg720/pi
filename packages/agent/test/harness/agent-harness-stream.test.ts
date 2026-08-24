/**
 * 文件职责：验证 AgentHarness 合并基础流选项、提供商请求钩子、保存点更新和载荷钩子的行为。
 * 技术维度：使用 Vitest、pi-ai FauxProvider、内存 Session 和事件钩子执行完全离线的代理流测试。
 * 产品维度：让测试和扩展可安全定制超时、Header、Metadata 和请求载荷，并支持工具轮次间更新配置。
 * 逻辑维度：创建唯一伪提供商，捕获选项快照，再覆盖单钩子合并、多钩子删除、保存点和载荷链。
 * 关键边界：每个伪提供商 ID 必须唯一以避免路由冲突；对象快照需复制嵌套 Header/Metadata 防止后续变异。
 * 新手阅读建议：先看 newFaux/captureOptions，再比较 before_provider_request 两个用例中的合并和删除语义。
 */
import {
	createModels,
	type FauxProviderHandle,
	fauxAssistantMessage,
	fauxProvider,
	fauxToolCall,
	type StreamOptions,
} from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import { AgentHarness } from "../../src/harness/agent-harness.ts";
import { InMemorySessionStorage } from "../../src/harness/session/memory-storage.ts";
import { Session } from "../../src/harness/session/session.ts";
import type { AgentHarnessOptions } from "../../src/harness/types.ts";
import { calculateTool } from "../utils/calculate.ts";

/** Shared collection; each faux provider gets a unique id so coexisting fakes route correctly. */
/** 共享模型集合；每个伪提供商使用唯一 ID，确保多个假端点共存时仍能正确路由。 */
// models 是所有 Harness 用例共享的模型注册表。
const models = createModels();
// fauxCount 为每次 newFaux 递增，保证提供商名称不重复。
let fauxCount = 0;

/** 创建并注册一个唯一伪提供商；无参数；返回可配置响应的 FauxProviderHandle。 */
function newFaux(): FauxProviderHandle {
	// faux 是带自增 provider ID 的新伪提供商句柄。
	const faux = fauxProvider({ provider: `faux-${++fauxCount}` });
	models.setProvider(faux.provider);
	return faux;
}

/** 用给定选项创建 AgentHarness；参数 options 为完整 Harness 配置；返回实例。 */
function createHarness(options: AgentHarnessOptions): AgentHarness {
	return new AgentHarness(options);
}

/** 对流选项及其可变嵌套对象做浅快照；参数 options 可缺省；返回独立 StreamOptions。 */
function captureOptions(options: StreamOptions | undefined): StreamOptions {
	return {
		...options,
		headers: options?.headers ? { ...options.headers } : undefined,
		metadata: options?.metadata ? { ...options.metadata } : undefined,
	};
}

// 验证 AgentHarness 在真正调用提供商前对流选项和载荷钩子的处理。
describe("AgentHarness stream configuration", () => {
	// before_provider_request 应看到基础快照，其补丁再与基础选项合并。
	it("snapshots stream options before provider request hooks", async () => {
		// capturedOptions 保存伪提供商最终收到的流选项。
		let capturedOptions: StreamOptions | undefined;
		// registration 是当前用例独占的伪提供商。
		const registration = newFaux();
		registration.setResponses([
			(_context, options) => {
				capturedOptions = options;
				return fauxAssistantMessage("ok");
			},
		]);

		// session 带固定 ID 和创建时间，用于验证 sessionId 注入。
		const session = new Session(new InMemorySessionStorage({ metadata: { id: "session-1", createdAt: "now" } }));
		// harness 配置基础超时、重试、Header、Metadata 和缓存策略。
		const harness = createHarness({
			models,
			session,
			model: registration.getModel(),
			streamOptions: {
				timeoutMs: 1000,
				maxRetries: 2,
				maxRetryDelayMs: 3000,
				headers: { "x-base": "base" },
				metadata: { base: true },
				cacheRetention: "none",
			},
		});

		harness.on("before_provider_request", (event) => {
			expect(event.sessionId).toBe("session-1");
			expect(event.streamOptions.headers).toEqual({ "x-base": "base" });
			return {
				streamOptions: {
					headers: { "x-hook": "hook" },
					metadata: { hook: true },
				},
			};
		});

		await harness.prompt("hello");

		expect(capturedOptions).toMatchObject({
			timeoutMs: 1000,
			maxRetries: 2,
			maxRetryDelayMs: 3000,
			sessionId: "session-1",
			cacheRetention: "none",
		});
		expect(capturedOptions?.headers).toEqual({ "x-base": "base", "x-hook": "hook" });
		expect(capturedOptions?.metadata).toEqual({ base: true, hook: true });
	});

	// 多个请求钩子应串联，每个钩子看到前一个结果，并支持 undefined 删除字段。
	it("chains provider request patches and supports deletion semantics", async () => {
		// capturedOptions 保存两次补丁应用后的最终结果。
		let capturedOptions: StreamOptions | undefined;
		// registration 是本用例的伪提供商。
		const registration = newFaux();
		registration.setResponses([
			(_context, options) => {
				capturedOptions = options;
				return fauxAssistantMessage("ok");
			},
		]);

		// harness 提供可被两个钩子增删的基础选项。
		const harness = createHarness({
			models,
			session: new Session(new InMemorySessionStorage()),
			model: registration.getModel(),
			streamOptions: {
				timeoutMs: 1000,
				maxRetries: 2,
				headers: { keep: "base", remove: "base" },
				metadata: { keep: "base", remove: "base" },
			},
		});

		harness.on("before_provider_request", (event) => {
			expect(event.streamOptions.headers).toEqual({ keep: "base", remove: "base" });
			return {
				streamOptions: {
					headers: { first: "1", remove: undefined },
					metadata: { first: 1, remove: undefined },
				},
			};
		});
		harness.on("before_provider_request", (event) => {
			expect(event.streamOptions.headers).toEqual({ keep: "base", first: "1" });
			expect(event.streamOptions.metadata).toEqual({ keep: "base", first: 1 });
			return {
				streamOptions: {
					timeoutMs: undefined,
					headers: { second: "2" },
					metadata: undefined,
				},
			};
		});

		await harness.prompt("hello");

		expect(capturedOptions?.timeoutMs).toBeUndefined();
		expect(capturedOptions?.maxRetries).toBe(2);
		expect(capturedOptions?.headers).toEqual({ keep: "base", first: "1", second: "2" });
		expect(capturedOptions?.metadata).toBeUndefined();
	});

	// 工具执行期间 setStreamOptions 应只影响保存点后的下一轮请求，不回改当前请求。
	it("uses updated stream options for save-point snapshots without mutating the active request", async () => {
		// capturedOptions 按两轮提供商调用顺序保存独立快照。
		const capturedOptions: StreamOptions[] = [];
		// registration 会先返回工具调用，再返回最终文本。
		const registration = newFaux();
		registration.setResponses([
			(_context, options) => {
				capturedOptions.push(captureOptions(options));
				return fauxAssistantMessage(fauxToolCall("calculate", { expression: "1 + 1" }, { id: "call-1" }), {
					stopReason: "toolUse",
				});
			},
			(_context, options) => {
				capturedOptions.push(captureOptions(options));
				return fauxAssistantMessage("done");
			},
		]);

		// harness 启用 calculate 工具并设置首轮选项。
		const harness = createHarness({
			models,
			session: new Session(new InMemorySessionStorage()),
			model: registration.getModel(),
			tools: [calculateTool],
			streamOptions: { timeoutMs: 1000, headers: { turn: "first" } },
		});

		harness.subscribe((event) => {
			if (event.type === "tool_execution_start") {
				harness.setStreamOptions({ timeoutMs: 2000, headers: { turn: "second" } });
			}
		});

		await harness.prompt("hello");

		expect(capturedOptions).toHaveLength(2);
		expect(capturedOptions[0].timeoutMs).toBe(1000);
		expect(capturedOptions[0].headers).toEqual({ turn: "first" });
		expect(capturedOptions[1].timeoutMs).toBe(2000);
		expect(capturedOptions[1].headers).toEqual({ turn: "second" });
	});

	// before_provider_payload 钩子应按注册顺序串联，每次看到前一次返回的 payload。
	it("chains provider payload hooks", async () => {
		// seenPayloads 记录两个钩子各自收到的载荷。
		const seenPayloads: unknown[] = [];
		// finalPayload 保存提供商 onPayload 链最终返回值。
		let finalPayload: unknown;
		// registration 在响应工厂中主动调用 onPayload。
		const registration = newFaux();
		registration.setResponses([
			async (_context, options, _state, model) => {
				finalPayload = await options?.onPayload?.({ steps: ["provider"] }, model);
				return fauxAssistantMessage("ok");
			},
		]);

		// harness 使用最小会话和模型配置。
		const harness = createHarness({
			models,
			session: new Session(new InMemorySessionStorage()),
			model: registration.getModel(),
		});

		harness.on("before_provider_payload", (event) => {
			seenPayloads.push(event.payload);
			return { payload: { steps: ["provider", "first"] } };
		});
		harness.on("before_provider_payload", (event) => {
			seenPayloads.push(event.payload);
			return { payload: { steps: ["provider", "first", "second"] } };
		});

		await harness.prompt("hello");

		expect(seenPayloads).toEqual([{ steps: ["provider"] }, { steps: ["provider", "first"] }]);
		expect(finalPayload).toEqual({ steps: ["provider", "first", "second"] });
	});
});
