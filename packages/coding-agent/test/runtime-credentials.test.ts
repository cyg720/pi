/**
 * 文件职责：验证运行时 API 密钥覆盖与持久化凭据之间的读取、枚举和删除规则。
 * 技术维度：使用 Vitest、内存 AuthStorage 和 RuntimeCredentials 进行无磁盘异步测试。
 * 产品维度：允许临时密钥覆盖已保存登录而不泄漏或写盘，并确保删除操作彻底清理。
 * 逻辑维度：分别测试读取遮蔽与恢复、脱敏枚举合并，以及同时删除覆盖和持久凭据。
 * 关键边界：所有密钥均为测试字符串；list 只能暴露提供方和类型，绝不能返回密钥值。
 * 新手阅读建议：先区分 storage 与 credentials 两层，再比较 set、remove 和 delete 的不同影响。
 */
import { describe, expect, test } from "vitest";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { RuntimeCredentials } from "../src/core/runtime-credentials.ts";

/** RuntimeCredentials 行为测试组。 */
describe("RuntimeCredentials", () => {
	/** 验证运行时密钥优先读取但不覆盖存储，移除覆盖后恢复读取存储值。 */
	test("runtime overrides mask stored credentials without persisting", async () => {
		/** 预置 anthropic 持久 API 密钥的内存存储。 */
		const storage = AuthStorage.inMemory({ anthropic: { type: "api_key", key: "stored-key" } });
		/** 包装该存储的运行时凭据视图。 */
		const credentials = new RuntimeCredentials(storage);

		credentials.setRuntimeApiKey("anthropic", "runtime-key");
		expect(await credentials.read("anthropic")).toEqual({ type: "api_key", key: "runtime-key" });
		expect(await storage.read("anthropic")).toEqual({ type: "api_key", key: "stored-key" });

		credentials.removeRuntimeApiKey("anthropic");
		expect(await credentials.read("anthropic")).toEqual({ type: "api_key", key: "stored-key" });
	});

	/** 验证枚举合并覆盖提供方，并只返回类型等非敏感元数据。 */
	test("enumeration merges overrides without exposing keys", async () => {
		/** 含即将被覆盖的 Anthropic OAuth 凭据的内存存储。 */
		const storage = AuthStorage.inMemory({
			anthropic: { type: "oauth", access: "access", refresh: "refresh", expires: Date.now() + 60_000 },
		});
		/** 同时读取持久凭据与运行时覆盖的凭据视图。 */
		const credentials = new RuntimeCredentials(storage);
		credentials.setRuntimeApiKey("anthropic", "runtime-key");
		credentials.setRuntimeApiKey("openai", "other-runtime-key");

		expect(await credentials.list()).toEqual([
			{ providerId: "anthropic", type: "api_key" },
			{ providerId: "openai", type: "api_key" },
		]);
	});

	/** 验证 delete 会同时清除指定提供方的运行时覆盖和持久凭据。 */
	test("delete clears both the override and persisted credential", async () => {
		/** 预置 Anthropic 持久密钥的内存存储。 */
		const storage = AuthStorage.inMemory({ anthropic: { type: "api_key", key: "stored-key" } });
		/** 之后还会设置同提供方运行时覆盖的凭据视图。 */
		const credentials = new RuntimeCredentials(storage);
		credentials.setRuntimeApiKey("anthropic", "runtime-key");

		await credentials.delete("anthropic");

		expect(await credentials.read("anthropic")).toBeUndefined();
		expect(await credentials.list()).toEqual([]);
	});
});
