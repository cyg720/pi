/**
 * 文件职责：验证远程模型目录叠加层的刷新、缓存、版本比较、ETag 重验证和错误恢复。
 * 技术维度：使用 Vitest mock 全局 fetch，并以 InMemoryModelsStore 模拟提供商级持久缓存。
 * 产品维度：让客户端在获得新模型目录的同时保留内置模型，并减少重复请求和陈旧目录风险。
 * 逻辑维度：构造静态提供商与作用域存储，再覆盖 TTL、Last-Modified、304、不可用和暂时失败场景。
 * 关键边界：501 表示目录功能不可用而非致命错误；429 等暂时失败应保留旧叠加层；网络请求受 allowNetwork 控制。
 * 新手阅读建议：先看 model、testProvider、scopedStore 三个夹具，再按成功刷新、时间比较、ETag、失败恢复阅读。
 */
import {
	createProvider,
	InMemoryModelsStore,
	type Model,
	type ModelsStoreEntry,
	type ProviderModelsStore,
} from "@earendil-works/pi-ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VERSION } from "../src/config.ts";
import { withRemoteCatalog } from "../src/core/remote-catalog-provider.ts";

/**
 * 创建用于远程目录测试的最小文本模型。
 * @param id 模型标识及显示名称。
 * @returns 属于 test-provider 的 OpenAI-compatible 模型。
 * @example model("dynamic");
 */
function model(id: string): Model<"openai-completions"> {
	return {
		id,
		name: id,
		api: "openai-completions",
		provider: "test-provider",
		baseUrl: "https://example.test/v1",
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 1000,
		maxTokens: 100,
	};
}

/**
 * 创建带 pi.dev 远程目录能力的静态测试提供商。
 * @param localGeneratedAt 可选本地生成目录时间戳，用于新旧比较。
 * @returns 含 static 模型和远程刷新能力的提供商。
 * @example testProvider(Date.now());
 */
function testProvider(localGeneratedAt?: number) {
	return withRemoteCatalog(
		createProvider({
			id: "test-provider",
			auth: { apiKey: { name: "Test", resolve: async () => ({ auth: {} }) } },
			models: [model("static")],
			api: {
				stream: () => {
					throw new Error("not used");
				},
				streamSimple: () => {
					throw new Error("not used");
				},
			},
		}),
		"https://pi.dev",
		localGeneratedAt,
	);
}

/**
 * 将全局内存模型存储限制到 test-provider 命名空间。
 * @param store 底层内存模型存储。
 * @returns 自动填入提供商标识的读写删接口。
 * @example const scoped = scopedStore(new InMemoryModelsStore());
 */
function scopedStore(store: InMemoryModelsStore): ProviderModelsStore {
	return {
		read: () => store.read("test-provider"),
		write: (entry: ModelsStoreEntry) => store.write("test-provider", entry),
		delete: () => store.delete("test-provider"),
	};
}

/** 每个用例结束后恢复 fetch 等全局 mock。 */
afterEach(() => vi.restoreAllMocks());

/** 覆盖远程目录叠加层在缓存验证和网络异常下的行为。 */
describe("remote catalog provider", () => {
	it("parses keyed catalogs, sends version headers, observes the refresh TTL, and supports forced refreshes", async () => {
		/** 返回固定 dynamic 模型目录并记录请求头的 fetch mock。 */
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
			async () =>
				new Response(JSON.stringify({ dynamic: model("dynamic") }), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
		);
		/** 使用默认本地目录时间的远程提供商。 */
		const provider = testProvider();
		/** 保存动态目录缓存的内存存储。 */
		const store = new InMemoryModelsStore();
		/** 允许网络且携带 API key 类型凭据的刷新上下文。 */
		const refresh = { credential: { type: "api_key" } as const, store: scopedStore(store), allowNetwork: true };
		await provider.refreshModels?.(refresh);
		await provider.refreshModels?.(refresh);
		await provider.refreshModels?.({ ...refresh, force: true });

		expect(provider.getModels().map((entry) => entry.id)).toEqual(["static", "dynamic"]);
		expect((await store.read(provider.id))?.models.map((entry) => entry.id)).toEqual(["dynamic"]);
		expect(fetchSpy).toHaveBeenCalledTimes(2);
		expect(fetchSpy.mock.calls[0]?.[1]?.headers).toMatchObject({
			"User-Agent": expect.stringContaining(`pi/${VERSION}`),
		});
	});

	it("prefers the newer of the generated and remote catalogs", async () => {
		/** 本地生成目录的固定时间。 */
		const localGeneratedAt = Date.parse("2026-07-23T10:00:00.000Z");
		/** 比本地目录新一分钟的 HTTP Last-Modified 文本。 */
		const newerHeader = new Date(localGeneratedAt + 60_000).toUTCString();
		/** 先返回旧目录、再返回新目录的响应队列。 */
		const responses = [
			new Response(JSON.stringify({ old: model("old") }), {
				headers: { "last-modified": new Date(localGeneratedAt - 60_000).toUTCString() },
			}),
			new Response(JSON.stringify({ newer: model("newer") }), {
				headers: { "last-modified": newerHeader },
			}),
		];
		vi.spyOn(globalThis, "fetch").mockImplementation(async () => responses.shift() as Response);
		/** 带本地目录生成时间的远程提供商。 */
		const provider = testProvider(localGeneratedAt);
		/** 新旧目录场景的内存缓存。 */
		const store = new InMemoryModelsStore();
		/** 新旧目录场景的刷新上下文。 */
		const refresh = { credential: { type: "api_key" } as const, store: scopedStore(store), allowNetwork: true };

		await provider.refreshModels?.(refresh);
		expect(provider.getModels().map((entry) => entry.id)).toEqual(["static"]);

		await provider.refreshModels?.({ ...refresh, force: true });
		expect(provider.getModels().map((entry) => entry.id)).toEqual(["static", "newer"]);
		expect(await store.read(provider.id)).toMatchObject({ lastModified: Date.parse(newerHeader) });
	});

	it("revalidates a stored catalog with its etag and keeps the overlay on 304", async () => {
		/** 首次 200 带 ETag、再次 304 的响应队列。 */
		const responses = [
			new Response(JSON.stringify({ dynamic: model("dynamic") }), {
				headers: { "content-type": "application/json", etag: '"catalog-1"' },
			}),
			new Response(null, { status: 304, headers: { etag: '"catalog-1"' } }),
		];
		/** 记录 If-None-Match 请求头的 fetch mock。 */
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => responses.shift() as Response);
		/** ETag 重验证场景的提供商。 */
		const provider = testProvider();
		/** 保存 ETag、目录和检查时间的内存缓存。 */
		const store = new InMemoryModelsStore();
		/** ETag 场景的刷新上下文。 */
		const refresh = { credential: { type: "api_key" } as const, store: scopedStore(store), allowNetwork: true };

		await provider.refreshModels?.(refresh);
		expect(fetchSpy.mock.calls[0]?.[1]?.headers).not.toHaveProperty("if-none-match");
		expect(await store.read(provider.id)).toMatchObject({ etag: '"catalog-1"' });

		/** 首次成功刷新后的检查时间，用于验证 304 会推进时间。 */
		const checkedAt = (await store.read(provider.id))?.checkedAt;
		await provider.refreshModels?.({ ...refresh, force: true });

		expect(fetchSpy.mock.calls[1]?.[1]?.headers).toMatchObject({ "if-none-match": '"catalog-1"' });
		expect(provider.getModels().map((entry) => entry.id)).toEqual(["static", "dynamic"]);
		/** 304 处理后的完整缓存条目。 */
		const stored = await store.read(provider.id);
		expect(stored?.models.map((entry) => entry.id)).toEqual(["dynamic"]);
		expect(stored?.etag).toBe('"catalog-1"');
		expect(stored?.checkedAt).toBeGreaterThanOrEqual(checkedAt ?? 0);
	});

	it("drops a stale etag when the overlay becomes unavailable", async () => {
		/** 先提供目录、再返回 501 的响应队列。 */
		const responses = [
			new Response(JSON.stringify({ dynamic: model("dynamic") }), {
				headers: { "content-type": "application/json", etag: '"catalog-1"' },
			}),
			new Response("not implemented", { status: 501 }),
		];
		vi.spyOn(globalThis, "fetch").mockImplementation(async () => responses.shift() as Response);
		/** 目录变为不可用场景的提供商。 */
		const provider = testProvider();
		/** 保存随后应清除 ETag 的缓存。 */
		const store = new InMemoryModelsStore();
		/** 允许强制第二次请求的刷新上下文。 */
		const refresh = { credential: { type: "api_key" } as const, store: scopedStore(store), allowNetwork: true };

		await provider.refreshModels?.(refresh);
		await provider.refreshModels?.({ ...refresh, force: true });

		expect((await store.read(provider.id))?.etag).toBeUndefined();
	});

	it("keeps the etag and overlay after a transient failure", async () => {
		/** 成功、限流、304 三阶段响应队列。 */
		const responses = [
			new Response(JSON.stringify({ dynamic: model("dynamic") }), {
				headers: { "content-type": "application/json", etag: '"catalog-1"' },
			}),
			new Response("rate limited", { status: 429 }),
			new Response(null, { status: 304, headers: { etag: '"catalog-1"' } }),
		];
		/** 记录限流恢复后条件请求的 fetch mock。 */
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => responses.shift() as Response);
		/** 暂时失败恢复场景的提供商。 */
		const provider = testProvider();
		/** 应跨暂时失败保留目录和 ETag 的缓存。 */
		const store = new InMemoryModelsStore();
		/** 暂时失败场景的刷新上下文。 */
		const refresh = { credential: { type: "api_key" } as const, store: scopedStore(store), allowNetwork: true };

		await provider.refreshModels?.(refresh);
		await expect(provider.refreshModels?.({ ...refresh, force: true })).rejects.toThrow(/429/);

		/** 429 后仍应完整保留的缓存条目。 */
		const stored = await store.read(provider.id);
		expect(stored?.etag).toBe('"catalog-1"');
		expect(stored?.models.map((entry) => entry.id)).toEqual(["dynamic"]);

		await provider.refreshModels?.({ ...refresh, force: true });
		expect(fetchSpy.mock.calls[2]?.[1]?.headers).toMatchObject({ "if-none-match": '"catalog-1"' });
		expect(provider.getModels().map((entry) => entry.id)).toEqual(["static", "dynamic"]);
	});

	it("treats unimplemented pi.dev catalog routes as an unavailable overlay", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("not implemented", { status: 501 }));
		/** 远程路由未实现时仍保留静态目录的提供商。 */
		const provider = testProvider();
		/** 记录不可用状态检查时间的缓存。 */
		const store = new InMemoryModelsStore();

		await expect(
			provider.refreshModels?.({
				credential: { type: "api_key" },
				store: scopedStore(store),
				allowNetwork: true,
			}),
		).resolves.toBeUndefined();
		expect(provider.getModels().map((entry) => entry.id)).toEqual(["static"]);
		expect(await store.read(provider.id)).toMatchObject({ models: [], checkedAt: expect.any(Number) });
	});
});
