/**
 * 文件职责：验证 HTTP 代理设置填充环境变量但不覆盖用户已有值，并忽略空输入。
 * 技术维度：使用 Vitest 和 process.env 快照隔离全局环境状态。
 * 产品维度：让配置文件代理对 HTTP/HTTPS 同时生效，同时尊重更高优先级环境配置。
 * 逻辑维度：每例前保存并清空代理变量，每例后恢复，三个用例覆盖设置、保留和忽略。
 * 关键边界：测试直接修改进程环境，必须串行隔离；只覆盖大写环境变量。
 * 新手阅读建议：先看 beforeEach/afterEach 的对称性，再阅读三个输入分支。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyHttpProxySettings } from "../src/core/http-dispatcher.ts";

/** 受测试影响的两个代理环境变量键。 */
const PROXY_ENV_KEYS = ["HTTP_PROXY", "HTTPS_PROXY"] as const;

/** HTTP 代理环境设置测试组。 */
describe("http proxy settings", () => {
	/** 每例开始前保存的原环境值。 */
	let savedEnv: Record<(typeof PROXY_ENV_KEYS)[number], string | undefined>;

	/** 保存原值并清空代理变量。 */
	beforeEach(() => {
		// key 是 HTTP_PROXY 或 HTTPS_PROXY，映射为当前环境值。
		savedEnv = Object.fromEntries(PROXY_ENV_KEYS.map((key) => [key, process.env[key]])) as Record<
			(typeof PROXY_ENV_KEYS)[number],
			string | undefined
		>;
		// key 是待清空的代理变量名。
		for (const key of PROXY_ENV_KEYS) {
			delete process.env[key];
		}
	});

	/** 按原先的存在或缺失状态恢复两个环境变量。 */
	afterEach(() => {
		// key 是当前要恢复的代理变量名。
		for (const key of PROXY_ENV_KEYS) {
			/** 该变量在用例前的值。 */
			const value = savedEnv[key];
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
	});

	/** 验证一个设置值同时填充 HTTP_PROXY 与 HTTPS_PROXY。 */
	it("applies httpProxy to HTTP_PROXY and HTTPS_PROXY", () => {
		applyHttpProxySettings("http://127.0.0.1:7890");

		expect(process.env.HTTP_PROXY).toBe("http://127.0.0.1:7890");
		expect(process.env.HTTPS_PROXY).toBe("http://127.0.0.1:7890");
	});

	/** 验证已有环境值优先，不被设置项覆盖。 */
	it("does not override existing proxy env vars", () => {
		process.env.HTTP_PROXY = "http://env-http:8080";
		process.env.HTTPS_PROXY = "http://env-https:8080";

		applyHttpProxySettings("http://settings:7890");

		expect(process.env.HTTP_PROXY).toBe("http://env-http:8080");
		expect(process.env.HTTPS_PROXY).toBe("http://env-https:8080");
	});

	/** 验证全空白代理值不会创建环境变量。 */
	it("ignores empty values", () => {
		applyHttpProxySettings("   ");

		expect(process.env.HTTP_PROXY).toBeUndefined();
		expect(process.env.HTTPS_PROXY).toBeUndefined();
	});
});
