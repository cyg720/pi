/**
 * 文件职责：验证 Radius 提供商从旧凭据、在线目录和自定义网关配置中注册模型与授权状态。
 * 技术维度：使用 Vitest、ModelRuntime、内存模型存储、临时 models.json 和 fetch 桩执行集成测试。
 * 产品维度：保障 Radius 用户离线恢复模型目录、在线刷新目录，并能接入自建兼容网关。
 * 逻辑维度：先构造标准凭据和目录，再覆盖离线恢复、在线保存、默认禁网、无认证和自定义配置。
 * 关键边界：Radius 模型仅在配置认证后暴露；自定义 oauth=radius 提供商必须声明 baseUrl。
 * 新手阅读建议：先看 radiusConfig 的目录形状，再比较 ModelRuntime.create 中 allowModelNetwork 的影响。
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InMemoryModelsStore } from "@earendil-works/pi-ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { ModelRuntime } from "../src/core/model-runtime.ts";
import { RADIUS_PROVIDER_ID } from "../src/core/radius.ts";

/** 构造携带缓存网关配置的 Radius OAuth 凭据；参数 gatewayBaseUrl 为 API 根地址；返回离线可恢复凭据。 */
function radiusOAuthCredential(gatewayBaseUrl: string) {
	return {
		type: "oauth" as const,
		access: "access-token",
		refresh: "refresh-token",
		expires: Date.now() + 60 * 60 * 1000,
		gatewayConfig: radiusConfig(gatewayBaseUrl),
	};
}

/** 构造含单个 auto 模型的 Radius 网关目录；参数 baseUrl 为模型请求地址；返回可序列化配置对象。 */
function radiusConfig(baseUrl: string) {
	return {
		baseUrl,
		models: [
			{
				id: "auto",
				name: "Radius Auto",
				reasoning: false,
				input: ["text" as const],
				cost: { input: 1, output: 2, cacheRead: 0.1, cacheWrite: 0.2 },
				contextWindow: 128000,
				maxTokens: 16384,
			},
		],
	};
}

// tempDir 保存自定义 models.json 用例的临时目录。
let tempDir: string;

// 每个用例前创建随机临时目录，避免并发冲突。
beforeEach(() => {
	tempDir = join(tmpdir(), `pi-test-radius-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(tempDir, { recursive: true });
});

// 用例结束后恢复桩并删除临时配置。
afterEach(() => {
	vi.restoreAllMocks();
	if (tempDir && existsSync(tempDir)) rmSync(tempDir, { recursive: true });
});

// 验证 Radius 内置和自定义提供商在模型运行时中的注册规则。
describe("Radius provider", () => {
	// 旧凭据内嵌的 gatewayConfig 应在禁网时恢复模型目录。
	it("restores the legacy credential catalog without network access", async () => {
		// runtime 使用带缓存目录的凭据且明确禁止网络。
		const runtime = await ModelRuntime.create({
			credentials: AuthStorage.inMemory({
				[RADIUS_PROVIDER_ID]: radiusOAuthCredential("https://radius.example.com/v1"),
			}),
			modelsStore: new InMemoryModelsStore(),
			modelsPath: null,
			allowModelNetwork: false,
		});

		// model 是从旧凭据目录恢复出的 auto 模型。
		const model = runtime.getModel(RADIUS_PROVIDER_ID, "auto");
		expect(model).toMatchObject({ api: "pi-messages", baseUrl: "https://radius.example.com/v1" });
		expect(runtime.getProvider(RADIUS_PROVIDER_ID)?.name).toBe("Radius");
		expect(runtime.hasConfiguredAuth(RADIUS_PROVIDER_ID)).toBe(true);
	});

	// 配置认证并允许网络时，应拉取目录并写入模型存储。
	it("fetches and stores the catalog for configured Radius auth", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify(radiusConfig("https://radius.example.com/v1")), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);
		// modelsStore 用于确认在线目录已持久化到运行时存储。
		const modelsStore = new InMemoryModelsStore();
		// credentials 包含有效但未内嵌目录的新式 Radius 凭据。
		const credentials = AuthStorage.inMemory({
			[RADIUS_PROVIDER_ID]: {
				type: "oauth",
				access: "access-token",
				refresh: "refresh-token",
				expires: Date.now() + 60 * 60 * 1000,
			},
		});
		// runtime 允许联网，因此创建过程中会调用目录接口。
		const runtime = await ModelRuntime.create({
			credentials,
			modelsStore,
			modelsPath: null,
			allowModelNetwork: true,
		});

		expect(runtime.getModel(RADIUS_PROVIDER_ID, "auto")).toBeDefined();
		expect((await modelsStore.read(RADIUS_PROVIDER_ID))?.models).toHaveLength(1);
		expect(vi.mocked(fetch).mock.calls[0]?.[1]?.headers).toMatchObject({ authorization: "Bearer access-token" });
	});

	// 未显式允许网络时，即使有认证也只使用缓存目录。
	it("does not refresh catalogs over the network by default", async () => {
		// fetchSpy 观察默认创建流程是否发起网络请求。
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		// runtime 使用旧凭据中的缓存配置。
		const runtime = await ModelRuntime.create({
			credentials: AuthStorage.inMemory({
				[RADIUS_PROVIDER_ID]: radiusOAuthCredential("https://radius.example.com/v1"),
			}),
			modelsStore: new InMemoryModelsStore(),
			modelsPath: null,
		});

		expect(runtime.getModel(RADIUS_PROVIDER_ID, "auto")).toBeDefined();
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	// 无认证时不应请求官方目录，也不能向用户展示 Radius 模型。
	it("does not fetch or expose Radius models without configured auth", async () => {
		// fetchSpy 记录可能的目录请求。
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		// runtime 允许联网但凭据仓库为空，用于验证认证门槛。
		const runtime = await ModelRuntime.create({
			credentials: AuthStorage.inMemory(),
			modelsStore: new InMemoryModelsStore(),
			modelsPath: null,
			allowModelNetwork: true,
		});

		expect(runtime.getModels(RADIUS_PROVIDER_ID)).toEqual([]);
		expect(fetchSpy.mock.calls.some(([url]) => String(url).includes("radius.pi.dev/v1/config"))).toBe(false);
	});

	// models.json 可声明使用 Radius OAuth 协议的自定义网关。
	it("supports custom Radius gateways from models.json", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify(radiusConfig("http://localhost:8788/v1")), { status: 200 }),
		);
		// modelsPath 是写入自定义提供商配置的临时文件。
		const modelsPath = join(tempDir, "models.json");
		writeFileSync(
			modelsPath,
			JSON.stringify({
				providers: { "radius-dev": { name: "Radius (dev)", baseUrl: "http://localhost:8788", oauth: "radius" } },
			}),
		);
		// runtime 加载自定义网关、认证并允许刷新目录。
		const runtime = await ModelRuntime.create({
			credentials: AuthStorage.inMemory({
				"radius-dev": {
					type: "oauth",
					access: "access-token",
					refresh: "refresh-token",
					expires: Date.now() + 60 * 60 * 1000,
				},
			}),
			modelsStore: new InMemoryModelsStore(),
			modelsPath,
			allowModelNetwork: true,
		});

		expect(runtime.getModel("radius-dev", "auto")).toMatchObject({
			api: "pi-messages",
			baseUrl: "http://localhost:8788/v1",
		});
		expect(runtime.getProvider("radius-dev")?.name).toBe("Radius (dev)");
	});

	// 自定义 Radius 配置缺少 baseUrl 时应产生可读错误。
	it("requires baseUrl for custom Radius gateways", async () => {
		// modelsPath 指向故意遗漏 baseUrl 的配置文件。
		const modelsPath = join(tempDir, "models.json");
		writeFileSync(modelsPath, JSON.stringify({ providers: { "radius-dev": { oauth: "radius" } } }));
		// runtime 禁网加载无效配置，错误应保存在运行时诊断中。
		const runtime = await ModelRuntime.create({
			credentials: AuthStorage.inMemory(),
			modelsStore: new InMemoryModelsStore(),
			modelsPath,
			allowModelNetwork: false,
		});

		expect(runtime.getError()).toContain('"baseUrl" is required when "oauth" is set');
	});
});
