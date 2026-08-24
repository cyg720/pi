/**
 * 文件职责：验证 Radius OAuth 对设备登录、刷新和浏览器发现分别使用正确的网关端点与载荷。
 * 技术维度：使用 Vitest、全局 fetch 模拟、假定时器、FormData 查询和标准 Response 对象。
 * 产品维度：确保 Radius 用户可通过设备码或浏览器授权登录，并能直接刷新令牌而不做多余发现。
 * 逻辑维度：帮助函数构造 JSON 响应和交互替身；三个用例分别模拟 device、refresh 与 browser 请求。
 * 关键边界：设备/刷新直连 gateway，只有浏览器授权读取 /v1/oauth；每例后必须恢复全局 fetch 与定时器。
 * 新手阅读建议：先看 GATEWAY 和 requestUrl，再沿 fetch 分支核对每个端点、表单字段和返回令牌。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRadiusOAuth } from "../src/auth/oauth/radius.ts";
import type { AuthEvent, AuthInteraction } from "../src/auth/types.ts";

// 所有 Radius 请求共用的测试网关根地址。
const GATEWAY = "https://radius.example";

/** 功能：创建 JSON Response；参数 body、可选 status；返回：Response。示例：jsonResponse({ ok: true })。 */
function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

/** 功能：从 fetch input 统一取得 URL；参数 input；返回：字符串 URL。示例：requestUrl(new Request(url))。 */
function requestUrl(input: unknown): string {
	if (typeof input === "string") return input;
	if (input instanceof URL) return input.toString();
	if (input instanceof Request) return input.url;
	throw new Error(`Unsupported request input: ${String(input)}`);
}

/** 功能：创建固定登录方式的认证交互替身；参数 loginMethod、events；返回：AuthInteraction。示例：interaction("device-code", events)。 */
function interaction(loginMethod: "browser" | "device-code", events: AuthEvent[] = []): AuthInteraction {
	return {
		prompt: async () => loginMethod,
		notify: (event) => events.push(event),
	};
}

describe("Radius OAuth", () => {
	// 功能：恢复 fetch、模拟和真实定时器；参数：无；返回：无。示例：每个用例后自动调用。
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it("uses gateway endpoints directly for device login", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-07-24T00:00:00Z"));
		// 收集登录过程通知事件的数组。
		const events: AuthEvent[] = [];
		// 记录 fetch 实际访问端点的数组。
		const urls: string[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: unknown, init?: RequestInit) => {
				// 当前 fetch 输入归一化后的 URL。
				const url = requestUrl(input);
				urls.push(url);
				// 当前 POST body 解析出的表单参数。
				const form = new URLSearchParams(String(init?.body));
				if (url === `${GATEWAY}/v1/oauth/device`) {
					expect(form.get("client_id")).toBe("pi-gateway");
					expect(form.get("scope")).toBe("gateway offline_access");
					return jsonResponse({
						device_code: "device-code",
						user_code: "ABCD-1234",
						verification_uri: "https://radius-ui.example/pair",
						expires_in: 600,
						interval: 5,
					});
				}
				if (url === `${GATEWAY}/v1/oauth/token`) {
					expect(form.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:device_code");
					expect(form.get("client_id")).toBe("pi-gateway");
					expect(form.get("device_code")).toBe("device-code");
					return jsonResponse({
						access_token: "access-token",
						refresh_token: "refresh-token",
						expires_in: 3600,
						scope: "gateway offline_access",
					});
				}
				throw new Error(`Unexpected request: ${url}`);
			}),
		);

		// 使用测试网关创建的 Radius OAuth 实现。
		const oauth = createRadiusOAuth({ name: "Radius", gateway: GATEWAY });
		await expect(oauth.login(interaction("device-code", events))).resolves.toEqual({
			type: "oauth",
			access: "access-token",
			refresh: "refresh-token",
			expires: Date.now() + 3600 * 1000 - 60_000,
			scope: "gateway offline_access",
		});
		expect(events).toEqual([
			{
				type: "device_code",
				userCode: "ABCD-1234",
				verificationUri: "https://radius-ui.example/pair",
				intervalSeconds: 5,
				expiresInSeconds: 600,
			},
		]);
		expect(urls).toEqual([`${GATEWAY}/v1/oauth/device`, `${GATEWAY}/v1/oauth/token`]);
	});

	it("refreshes directly through the gateway without discovery", async () => {
		// 只接受 token 刷新端点的 fetch 模拟函数。
		const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
			expect(requestUrl(input)).toBe(`${GATEWAY}/v1/oauth/token`);
			// 刷新请求的表单参数。
			const form = new URLSearchParams(String(init?.body));
			expect(form.get("grant_type")).toBe("refresh_token");
			expect(form.get("client_id")).toBe("pi-gateway");
			expect(form.get("refresh_token")).toBe("old-refresh");
			return jsonResponse({
				access_token: "new-access",
				refresh_token: "new-refresh",
				expires_in: 3600,
			});
		});
		vi.stubGlobal("fetch", fetchMock);

		// 使用测试网关创建的 Radius OAuth 实现。
		const oauth = createRadiusOAuth({ name: "Radius", gateway: GATEWAY });
		await expect(
			oauth.refresh({ type: "oauth", access: "old-access", refresh: "old-refresh", expires: 0 }),
		).resolves.toMatchObject({ access: "new-access", refresh: "new-refresh" });
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it("discovers only the interactive browser authorization endpoint", async () => {
		// 只接受浏览器发现端点的 fetch 模拟函数。
		const fetchMock = vi.fn(async (input: unknown) => {
			expect(requestUrl(input)).toBe(`${GATEWAY}/v1/oauth`);
			return jsonResponse({ issuer: "https://radius-ui.example" });
		});
		vi.stubGlobal("fetch", fetchMock);

		// 使用测试网关创建的 Radius OAuth 实现。
		const oauth = createRadiusOAuth({ name: "Radius", gateway: GATEWAY });
		await expect(oauth.login(interaction("browser"))).rejects.toThrow(`Invalid Radius OAuth config from ${GATEWAY}`);
		expect(fetchMock).toHaveBeenCalledOnce();
	});
});
