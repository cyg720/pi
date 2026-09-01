/**
 * 文件职责：验证 Node HTTP 代理解析对环境变量优先级、NO_PROXY 和不支持协议的处理。
 * 技术维度：使用 Vitest、进程环境变量快照和 URL 解析函数进行无网络单元测试。
 * 产品维度：确保企业代理环境下模型请求走正确代理，并对 SOCKS 或 PAC 配置给出明确错误。
 * 逻辑维度：记录原始代理环境，每个用例先清空配置，执行解析后再统一恢复。
 * 关键边界：会临时修改 process.env；新增代理变量别名时必须同步维护快照与清理列表。
 * 新手阅读建议：先看 PROXY_ENV_KEYS 和清理钩子，再按排除、解析、优先级、拒绝四类用例阅读。
 */
import { afterEach, describe, expect, it } from "vitest";
import { resolveHttpProxyUrlForTarget, UNSUPPORTED_PROXY_PROTOCOL_MESSAGE } from "../src/utils/node-http-proxy.ts";

// 列出解析器可能读取的全部大小写及 npm 代理环境变量键名。
const PROXY_ENV_KEYS = [
	"HTTP_PROXY",
	"HTTPS_PROXY",
	"NO_PROXY",
	"ALL_PROXY",
	"http_proxy",
	"https_proxy",
	"no_proxy",
	"all_proxy",
	"npm_config_http_proxy",
	"npm_config_https_proxy",
	"npm_config_proxy",
	"npm_config_no_proxy",
] as const;

// 保存测试启动前每个代理环境变量的原始值，便于用例结束后完整恢复。
const originalEnv = new Map<string, string | undefined>();
// key 是当前代理环境变量名；循环把可能为 undefined 的原始值写入快照。
for (const key of PROXY_ENV_KEYS) {
	originalEnv.set(key, process.env[key]);
}

/**
 * 从当前进程删除所有代理相关环境变量。
 * 参数：无。
 * 返回值：无。
 * 使用示例：在每个代理解析断言前调用 `resetProxyEnv()`。
 */
function resetProxyEnv(): void {
	// key 是当前待删除的代理环境变量名。
	for (const key of PROXY_ENV_KEYS) {
		delete process.env[key];
	}
}

// 每个用例后清空测试值并恢复原始代理环境；无参数，无返回值。
afterEach(() => {
	resetProxyEnv();
	// key 和 value 分别是原始环境变量名和值；原本未定义的键保持删除状态。
	for (const [key, value] of originalEnv) {
		if (value !== undefined) {
			process.env[key] = value;
		}
	}
});

describe("node HTTP proxy resolution", () => {
	// 验证 NO_PROXY 中的目标地址不会使用 HTTPS 代理；无参数，无返回值。
	it("respects NO_PROXY exclusions", () => {
		resetProxyEnv();
		process.env.HTTPS_PROXY = "http://proxy.example:8080";
		process.env.NO_PROXY = "bedrock-runtime.us-east-1.amazonaws.com";

		expect(resolveHttpProxyUrlForTarget("https://bedrock-runtime.us-east-1.amazonaws.com")).toBeUndefined();
	});

	// 验证 HTTPS 目标能解析到配置的 HTTP 代理 URL；无参数，无返回值。
	it("resolves HTTP and HTTPS proxy URLs", () => {
		resetProxyEnv();
		process.env.HTTPS_PROXY = "http://proxy.example:8080";

		expect(resolveHttpProxyUrlForTarget("https://bedrock-runtime.us-east-1.amazonaws.com")?.toString()).toBe(
			"http://proxy.example:8080/",
		);
	});

	// 验证调用级代理映射的优先级高于 process.env；无参数，无返回值。
	it("prefers scoped proxy env aliases before process env aliases", () => {
		resetProxyEnv();
		process.env.https_proxy = "http://process-proxy.example:8080";

		expect(
			resolveHttpProxyUrlForTarget("https://bedrock-runtime.us-east-1.amazonaws.com", {
				HTTPS_PROXY: "http://scoped-proxy.example:8080",
			})?.toString(),
		).toBe("http://scoped-proxy.example:8080/");
	});

	// 验证 SOCKS 和 PAC 等未支持协议会抛出统一错误；无参数，无返回值。
	it("rejects SOCKS and PAC proxy URLs explicitly", () => {
		resetProxyEnv();
		process.env.HTTPS_PROXY = "socks5://proxy.example:1080";

		expect(() => resolveHttpProxyUrlForTarget("https://bedrock-runtime.us-east-1.amazonaws.com")).toThrow(
			UNSUPPORTED_PROXY_PROTOCOL_MESSAGE,
		);
	});

	it("handles subdomain wildcards, IPv6, and ports in NO_PROXY", () => {
		resetProxyEnv();
		process.env.HTTPS_PROXY = "http://proxy.example:8080";
		process.env.NO_PROXY = "example.com, .wildcard.org, *.star.net, ::1, [2001:db8::1], 127.0.0.1:8080";

		expect(resolveHttpProxyUrlForTarget("https://example.com")).toBeUndefined();
		expect(resolveHttpProxyUrlForTarget("https://api.example.com")).toBeUndefined();
		expect(resolveHttpProxyUrlForTarget("https://wildcard.org")).toBeUndefined();
		expect(resolveHttpProxyUrlForTarget("https://api.wildcard.org")).toBeUndefined();
		expect(resolveHttpProxyUrlForTarget("https://star.net")).toBeUndefined();
		expect(resolveHttpProxyUrlForTarget("https://api.star.net")).toBeUndefined();
		expect(resolveHttpProxyUrlForTarget("https://notexample.com")?.toString()).toBe("http://proxy.example:8080/");

		expect(resolveHttpProxyUrlForTarget("https://[::1]:80")).toBeUndefined();
		expect(resolveHttpProxyUrlForTarget("https://[2001:db8::1]")).toBeUndefined();
		expect(resolveHttpProxyUrlForTarget("https://127.0.0.1:8080")).toBeUndefined();
		expect(resolveHttpProxyUrlForTarget("https://127.0.0.1:3000")?.toString()).toBe("http://proxy.example:8080/");
	});
});
