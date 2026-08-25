/**
 * 文件职责：验证 llama.cpp 扩展的注册、认证、模型缓存、Hugging Face 查询以及 SSE 加载和下载流程。
 * 技术维度：使用 Vitest、Node.js 临时 HTTP 服务、SSE 事件流和内存模型存储模拟本地路由器与远端仓库。
 * 产品维度：保障用户可连接本地 llama.cpp、发现 GGUF 模型并看到可靠的加载和下载进度。
 * 逻辑维度：先提供服务器与 JSON 响应辅助函数，再逐项测试扩展注册、URL、缓存、认证、搜索和异步模型操作。
 * 关键边界：所有网络均指向测试内临时服务；计时依赖短延迟；用例结束必须关闭连接，避免测试进程悬挂。
 * 新手阅读建议：先看 listen/json 辅助函数，再看 provider 缓存和认证用例，最后阅读两个 SSE 状态机用例。
 */
import { once } from "node:events";
import { createServer, type RequestListener, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { AuthContext, AuthPrompt, ModelsStoreEntry } from "@earendil-works/pi-ai";
import { afterEach, describe, expect, it } from "vitest";
import { createEventBus } from "../src/core/event-bus.ts";
import { createExtensionRuntime, loadExtensionFromFactory } from "../src/core/extensions/loader.ts";
import { LlamaClient, type LlamaProgress, normalizeLlamaServerUrl } from "../src/extensions/llama/client.ts";
import { findHuggingFaceToken, HuggingFaceClient } from "../src/extensions/llama/huggingface.ts";
import llamaExtension from "../src/extensions/llama/index.ts";
import { createLlamaProvider, LLAMA_PROVIDER_ID } from "../src/extensions/llama/provider.ts";

/** 当前测试创建且需要在 afterEach 中关闭的 HTTP 服务。 */
const servers: Server[] = [];

/** 在本机随机端口启动测试服务。参数 handler 处理请求；返回服务实例和基础 URL。示例：await listen(handler)。 */
async function listen(handler: RequestListener): Promise<{ server: Server; url: string }> {
	/** 当前用例新建的 HTTP 服务。 */
	const server = createServer(handler);
	servers.push(server);
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	/** 服务开始监听后解析出的地址信息。 */
	const address = server.address() as AddressInfo;
	return { server, url: `http://127.0.0.1:${address.port}` };
}

/** 以 200 状态返回 JSON。参数 response 为响应流，value 为可序列化数据；无返回值。示例：json(response, {data: []})。 */
function json(response: ServerResponse, value: unknown): void {
	response.writeHead(200, { "Content-Type": "application/json" });
	response.end(JSON.stringify(value));
}

/** 每个用例后关闭全部服务和现有连接。 */
afterEach(async () => {
	await Promise.all(
		servers.splice(0).map(
			(server) =>
				new Promise<void>((resolve) => {
					server.close(() => resolve());
					server.closeAllConnections();
				}),
		),
	);
});

describe("llama.cpp extension", () => {
	/** 验证扩展注册原生提供商和 /llama 命令。 */
	it("registers a native provider and /llama command", async () => {
		/** 捕获扩展注册结果的运行时。 */
		const runtime = createExtensionRuntime();
		/** 从内联工厂加载得到的扩展实例。 */
		const extension = await loadExtensionFromFactory(
			llamaExtension,
			process.cwd(),
			createEventBus(),
			runtime,
			"<inline:llama.cpp>",
		);

		expect(extension.commands.get("llama")?.description).toBe("Manage llama.cpp router models");
		expect(runtime.pendingNativeProviderRegistrations.map((entry) => entry.provider.id)).toEqual([LLAMA_PROVIDER_ID]);
	});

	/** 验证管理 URL 会去掉 /v1 和尾斜杠，并拒绝非 HTTP 协议。 */
	it("normalizes management and inference URLs", () => {
		expect(normalizeLlamaServerUrl("http://127.0.0.1:8080/v1/")).toBe("http://127.0.0.1:8080");
		expect(normalizeLlamaServerUrl("https://example.com/prefix/v1")).toBe("https://example.com/prefix");
		expect(() => normalizeLlamaServerUrl("file:///tmp/llama")).toThrow("http or https");
	});

	/** 验证仅 loaded 状态模型会暴露给推理提供商。 */
	it("exposes only loaded models with router metadata", () => {
		/** 可注入目录并读取模型的 llama 提供商控制器。 */
		const controller = createLlamaProvider();
		controller.setCatalog(
			[
				{
					id: "loaded",
					status: { value: "loaded", args: ["llama-server", "--n-gpu-layers", "999"] },
					architecture: { input_modalities: ["text", "image"] },
					meta: { n_ctx: 65536, n_ctx_train: 131072 },
				},
				{ id: "unloaded", status: { value: "unloaded" } },
				{ id: "loading", status: { value: "loading" } },
			],
			"http://localhost:8080",
		);

		expect(controller.provider.getModels()).toEqual([
			expect.objectContaining({
				id: "loaded",
				baseUrl: "http://localhost:8080/v1",
				contextWindow: 65536,
				maxTokens: 65536,
				input: ["text", "image"],
			}),
		]);
	});

	/** 验证联网刷新会写入缓存，离线刷新可从缓存恢复。 */
	it("persists and restores loaded models for cache-only startup refreshes", async () => {
		/** 内存中保存的最后一个模型缓存条目。 */
		let cachedEntry: ModelsStoreEntry | undefined;
		/** 模拟模型缓存的读、写、删接口。 */
		const store = {
			read: async () => cachedEntry,
			write: async (entry: ModelsStoreEntry) => {
				cachedEntry = structuredClone(entry);
			},
			delete: async () => {
				cachedEntry = undefined;
			},
		};
		/** 提供 loaded 与 unloaded 目录的临时路由器 URL。 */
		const { url } = await listen((request, response) => {
			if (request.url === "/models") {
				json(response, {
					data: [
						{ id: "loaded", status: { value: "loaded" }, meta: { n_ctx: 32768 } },
						{ id: "unloaded", status: { value: "unloaded" } },
					],
				});
				return;
			}
			response.writeHead(404).end();
		});

		/** 允许联网并负责写入缓存的第一个提供商。 */
		const first = createLlamaProvider();
		await first.provider.refreshModels?.({
			credential: { type: "api_key", key: "local", env: { LLAMA_BASE_URL: url } },
			store,
			allowNetwork: true,
		});
		expect(first.provider.getModels().map((model) => model.id)).toEqual(["loaded"]);
		expect(cachedEntry?.models.map((model) => model.id)).toEqual(["loaded"]);

		/** 禁止联网并从缓存恢复目录的第二个提供商。 */
		const second = createLlamaProvider();
		await second.provider.refreshModels?.({
			credential: { type: "api_key", key: "local", env: { LLAMA_BASE_URL: url } },
			store,
			allowNetwork: false,
		});
		expect(second.provider.getModels()).toEqual([
			expect.objectContaining({ id: "loaded", baseUrl: `${url}/v1`, contextWindow: 32768 }),
		]);
	});

	/** 验证未配置时保持休眠，并能保存 URL 和可选密钥。 */
	it("stays dormant until configured and stores URL plus optional key", async () => {
		/** 待检查认证定义的 llama 提供商。 */
		const { provider } = createLlamaProvider();
		/** llama API-key 认证策略。 */
		const auth = provider.auth.apiKey!;
		/** 不暴露环境变量或文件的空认证上下文。 */
		const emptyContext: AuthContext = {
			env: async () => undefined,
			fileExists: async () => false,
		};
		expect(await auth.check?.({ ctx: emptyContext })).toBeUndefined();
		expect(await auth.resolve({ ctx: emptyContext })).toBeUndefined();

		/** 验证 Bearer 密钥的临时服务 URL。 */
		const { url } = await listen((request, response) => {
			expect(request.headers.authorization).toBe("Bearer secret");
			json(response, { data: [] });
		});
		/** 登录提示依次返回的服务 URL 和密钥。 */
		const answers = [url, "secret"];
		/** 登录流程生成的持久化凭据。 */
		const credential = await auth.login!({
			prompt: async (_prompt: AuthPrompt) => answers.shift()!,
			notify: () => {},
		});
		expect(credential).toEqual({
			type: "api_key",
			key: "secret",
			env: { LLAMA_BASE_URL: url },
		});
		expect(await auth.resolve({ ctx: emptyContext, credential })).toEqual({
			auth: { apiKey: "secret", baseUrl: `${url}/v1` },
			env: { LLAMA_BASE_URL: url },
			source: "stored credential",
		});
	});

	/** 验证 Hugging Face 搜索、分片量化聚合和访问要求解析。 */
	it("searches Hugging Face and reads quantizations plus access requirements", async () => {
		/** 模拟 Hugging Face 搜索与详情 API 的服务 URL。 */
		const { url } = await listen((request, response) => {
			expect(request.headers.authorization).toBe("Bearer hf-secret");
			if (request.url?.startsWith("/api/models?")) {
				/** 用于检查查询字符串的完整请求 URL。 */
				const requestUrl = new URL(request.url, "http://localhost");
				expect(requestUrl.searchParams.get("search")).toBe("qwen coder");
				expect(requestUrl.searchParams.get("filter")).toBe("gguf");
				expect(requestUrl.searchParams.get("sort")).toBe("downloads");
				json(response, [{ id: "owner/model-GGUF", downloads: 1200 }]);
				return;
			}
			if (request.url === "/api/models/owner/model-GGUF?blobs=true") {
				json(response, {
					id: "owner/model-GGUF",
					gated: "manual",
					siblings: [
						{ rfilename: "model-Q5_K_M.gguf", size: 6000 },
						{ rfilename: "model-Q4_K_M-00001-of-00002.gguf", size: 2000 },
						{ rfilename: "model-Q4_K_M-00002-of-00002.gguf", size: 3000 },
						{ rfilename: "mmproj-F16.gguf", size: 1000 },
					],
				});
				return;
			}
			response.writeHead(404).end();
		});
		/** 带测试令牌并指向临时服务的 Hugging Face 客户端。 */
		const client = new HuggingFaceClient("hf-secret", url);

		expect(await client.search("qwen coder")).toEqual([{ id: "owner/model-GGUF", downloads: 1200 }]);
		expect(await client.details("owner/model-GGUF")).toEqual({
			id: "owner/model-GGUF",
			gated: "manual",
			quantizations: [
				{ name: "Q4_K_M", size: 5000 },
				{ name: "Q5_K_M", size: 6000 },
			],
		});
		expect(await findHuggingFaceToken({ HF_TOKEN: " hf-secret " })).toBe("hf-secret");
	});

	/** 验证加载请求通过 SSE 报告阶段进度并等待目录变为 loaded。 */
	it("loads with SSE progress and waits for the loaded catalog state", async () => {
		/** 测试服务维护的模型状态。 */
		let status: "unloaded" | "loading" | "loaded" = "unloaded";
		/** 当前连接到 SSE 端点的响应流集合。 */
		const streams = new Set<ServerResponse>();
		/** 向所有 SSE 客户端广播事件；参数 event 为可序列化载荷，无返回值。 */
		const send = (event: unknown) => {
			/** response 是当前已连接的 SSE 响应流；向每个订阅者写入同一事件。 */
			for (const response of streams) response.write(`data: ${JSON.stringify(event)}\n\n`);
		};
		/** 模拟模型目录、加载端点和 SSE 端点的服务 URL。 */
		const { url } = await listen((request, response) => {
			if (request.url === "/models/sse") {
				response.writeHead(200, { "Content-Type": "text/event-stream" });
				streams.add(response);
				request.on("close", () => streams.delete(response));
				return;
			}
			if (request.url === "/models/load" && request.method === "POST") {
				status = "loading";
				json(response, { success: true });
				setTimeout(() => {
					send({
						model: "test-model",
						event: "status_change",
						data: {
							status: "loading",
							progress: { stages: ["text_model", "mmproj_model"], current: "text_model", value: 0.5 },
						},
					});
					status = "loaded";
					send({ model: "test-model", event: "status_change", data: { status: "loaded" } });
				}, 20);
				return;
			}
			if (request.url === "/models") {
				json(response, { data: [{ id: "test-model", status: { value: status } }] });
				return;
			}
			response.writeHead(404).end();
		});

		/** 客户端回调收到的可读进度消息。 */
		const progress: string[] = [];
		/** loadAndWait 最终返回的 loaded 模型。 */
		const model = await new LlamaClient(url).loadAndWait("test-model", (entry) => progress.push(entry.message));
		expect(model.status.value).toBe("loaded");
		expect(progress).toContain("Loading text model");
	});

	/** 验证下载字节进度、完成事件及刷新后的目录。 */
	it("downloads with byte progress and returns the refreshed catalog", async () => {
		/** 测试服务维护的下载生命周期状态。 */
		let status: "missing" | "downloading" | "unloaded" = "missing";
		/** 当前连接到下载 SSE 端点的响应流集合。 */
		const streams = new Set<ServerResponse>();
		/** 向所有下载进度订阅者广播事件；无返回值。 */
		const send = (event: unknown) => {
			/** response 是当前下载进度订阅者的响应流；广播内容保持一致。 */
			for (const response of streams) response.write(`data: ${JSON.stringify(event)}\n\n`);
		};
		/** 模拟模型创建、目录和 SSE 端点的服务 URL。 */
		const { url } = await listen((request, response) => {
			if (request.url === "/models/sse") {
				response.writeHead(200, { "Content-Type": "text/event-stream" });
				streams.add(response);
				request.on("close", () => streams.delete(response));
				return;
			}
			if (request.url === "/models" && request.method === "POST") {
				status = "downloading";
				json(response, { success: true });
				setTimeout(() => {
					send({
						model: "owner/repo:Q4_K_M",
						event: "download_progress",
						data: { progress: { "https://example/model.gguf": { done: 512, total: 1024 } } },
					});
					status = "unloaded";
					send({ model: "owner/repo:Q4_K_M", event: "download_finished", data: {} });
				}, 20);
				return;
			}
			if (request.url?.startsWith("/models")) {
				json(response, {
					data: status === "missing" ? [] : [{ id: "owner/repo:Q4_K_M", status: { value: status } }],
				});
				return;
			}
			response.writeHead(404).end();
		});

		/** 客户端回调收集的结构化下载进度。 */
		const progress: LlamaProgress[] = [];
		/** 下载完成后刷新得到的模型目录。 */
		const models = await new LlamaClient(url).downloadAndWait("owner/repo:Q4_K_M", (entry) => progress.push(entry));
		expect(models).toEqual([{ id: "owner/repo:Q4_K_M", status: { value: "unloaded" } }]);
		expect(progress).toContainEqual({
			message: "Downloading model",
			ratio: 0.5,
			detail: "512 B / 1.00 KiB",
		});
	});
});
/**
 * 文件职责：验证 llama.cpp 扩展的注册、认证、模型缓存、Hugging Face 查询以及 SSE 加载和下载流程。
 * 技术维度：使用 Vitest、Node.js 临时 HTTP 服务、SSE 事件流和内存模型存储模拟本地路由器与远端仓库。
 * 产品维度：保障用户可连接本地 llama.cpp、发现 GGUF 模型并看到可靠的加载和下载进度。
 * 逻辑维度：先提供服务器与 JSON 响应辅助函数，再逐项测试扩展注册、URL、缓存、认证、搜索和异步模型操作。
 * 关键边界：所有网络均指向测试内临时服务；计时依赖短延迟；用例结束必须关闭连接，避免测试进程悬挂。
 * 新手阅读建议：先看 listen/json 辅助函数，再看 provider 缓存和认证用例，最后阅读两个 SSE 状态机用例。
 */
