/**
 * 文件职责：验证 AuthStorage 对 API Key/OAuth 凭据的解析、并发修改、文件锁、删除和损坏文件保护。
 * 技术维度：使用 Vitest、临时 auth.json、proper-lockfile mock 和 pi-ai 模型认证刷新流程。
 * 产品维度：保证用户凭据可安全解析和更新，不覆盖其他进程改动，也不会在锁异常时破坏认证文件。
 * 逻辑维度：每个用例创建临时认证文件，覆盖读取、修改、并发、删除、内存实现和 OAuth 锁恢复。
 * 关键边界：命令型密钥会执行本地命令；环境变量需恢复；文件修改必须持锁；畸形 JSON 不得被覆盖。
 * 新手阅读建议：先看 writeAuthJson 与基本读取用例，再读并发/锁用例，最后理解 OAuth 刷新如何复用存储。
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createModels, type Provider } from "@earendil-works/pi-ai";
import lockfile from "proper-lockfile";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AuthStorage } from "../src/core/auth-storage.ts";

/** 覆盖文件与内存认证存储的读取、写入、锁定和恢复契约。 */
describe("AuthStorage", () => {
	/** 当前用例独立使用的临时目录。 */
	let tempDir: string;
	/** 当前用例 auth.json 的绝对路径。 */
	let authJsonPath: string;

	/** 每个用例前创建唯一临时目录和认证文件路径。 */
	beforeEach(() => {
		tempDir = join(tmpdir(), `pi-test-auth-storage-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		mkdirSync(tempDir, { recursive: true });
		authJsonPath = join(tempDir, "auth.json");
	});

	/** 每个用例后删除临时目录并恢复所有 mock。 */
	afterEach(() => {
		if (existsSync(tempDir)) rmSync(tempDir, { recursive: true });
		vi.restoreAllMocks();
	});

	/**
	 * 将对象序列化写入当前用例 auth.json。
	 * @param data 提供商标识到原始凭据的映射。
	 * @returns 无返回值。
	 * @example writeAuthJson({ anthropic: { type: "api_key", key: "x" } });
	 */
	function writeAuthJson(data: Record<string, unknown>): void {
		writeFileSync(authJsonPath, JSON.stringify(data));
	}

	test("reads and resolves stored API-key credentials", async () => {
		/** 测试前已有的环境密钥，finally 中原样恢复。 */
		const original = process.env.TEST_AUTH_STORAGE_KEY;
		process.env.TEST_AUTH_STORAGE_KEY = "environment-key";
		try {
			writeAuthJson({ anthropic: { type: "api_key", key: "$TEST_AUTH_STORAGE_KEY" } });
			/** 从临时 auth.json 读取凭据的文件存储。 */
			const storage = AuthStorage.create(authJsonPath);
			expect(await storage.read("anthropic")).toEqual({ type: "api_key", key: "environment-key" });
		} finally {
			if (original === undefined) delete process.env.TEST_AUTH_STORAGE_KEY;
			else process.env.TEST_AUTH_STORAGE_KEY = original;
		}
	});

	test("resolves command-backed API-key credentials", async () => {
		writeAuthJson({ anthropic: { type: "api_key", key: "!printf 'command-key'" } });
		/** 解析命令型密钥的文件认证存储。 */
		const storage = AuthStorage.create(authJsonPath);
		expect(await storage.read("anthropic")).toEqual({ type: "api_key", key: "command-key" });
	});

	test("returns OAuth credentials unchanged", async () => {
		/** 不经转换即可返回的 OAuth 凭据。 */
		const credential = {
			type: "oauth" as const,
			access: "access-token",
			refresh: "refresh-token",
			expires: Date.now() + 60_000,
		};
		/** 预置 OAuth 凭据的内存存储。 */
		const storage = AuthStorage.inMemory({ anthropic: credential });
		expect(await storage.read("anthropic")).toEqual(credential);
	});

	test("credential-scoped env takes precedence and remains inspectable", async () => {
		writeAuthJson({
			anthropic: {
				type: "api_key",
				key: "$SCOPED_KEY",
				env: { SCOPED_KEY: "scoped-value", REGION: "test-region" },
			},
		});
		/** 带凭据级环境变量的文件存储。 */
		const storage = AuthStorage.create(authJsonPath);
		expect(await storage.read("anthropic")).toMatchObject({
			key: "scoped-value",
			env: { SCOPED_KEY: "scoped-value", REGION: "test-region" },
		});
	});

	test("modify persists a credential while preserving unrelated external edits", async () => {
		writeAuthJson({ anthropic: { type: "api_key", key: "old" } });
		/** 修改前先存在 anthropic 凭据的文件存储。 */
		const storage = AuthStorage.create(authJsonPath);
		writeAuthJson({
			anthropic: { type: "api_key", key: "old" },
			openai: { type: "api_key", key: "external" },
		});

		await storage.modify("anthropic", async () => ({ type: "api_key", key: "new" }));

		expect(JSON.parse(readFileSync(authJsonPath, "utf8"))).toEqual({
			anthropic: { type: "api_key", key: "new" },
			openai: { type: "api_key", key: "external" },
		});
	});

	test("modify with undefined leaves the current credential unchanged", async () => {
		writeAuthJson({ anthropic: { type: "api_key", key: "stored" } });
		/** 验证 undefined 修改结果的文件存储。 */
		const storage = AuthStorage.create(authJsonPath);
		expect(await storage.modify("anthropic", async () => undefined)).toEqual({ type: "api_key", key: "stored" });
		expect(await storage.read("anthropic")).toEqual({ type: "api_key", key: "stored" });
	});

	test("serializes concurrent modifications", async () => {
		writeAuthJson({});
		/** 并发修改 auth.json 的第一个存储实例。 */
		const first = AuthStorage.create(authJsonPath);
		/** 并发修改同一文件的第二个存储实例。 */
		const second = AuthStorage.create(authJsonPath);
		await Promise.all([
			first.modify("anthropic", async () => ({ type: "api_key", key: "anthropic-key" })),
			second.modify("openai", async () => ({ type: "api_key", key: "openai-key" })),
		]);
		expect(JSON.parse(readFileSync(authJsonPath, "utf8"))).toEqual({
			anthropic: { type: "api_key", key: "anthropic-key" },
			openai: { type: "api_key", key: "openai-key" },
		});
	});

	test("delete removes one credential while preserving others", async () => {
		writeAuthJson({
			anthropic: { type: "api_key", key: "anthropic-key" },
			openai: { type: "api_key", key: "openai-key" },
		});
		/** 删除单个提供商凭据的文件存储。 */
		const storage = AuthStorage.create(authJsonPath);
		writeAuthJson({
			anthropic: { type: "api_key", key: "anthropic-key" },
			openai: { type: "api_key", key: "openai-key" },
			google: { type: "api_key", key: "external-key" },
		});
		await storage.delete("anthropic");
		await expect(storage.list()).resolves.toEqual([
			{ providerId: "openai", type: "api_key" },
			{ providerId: "google", type: "api_key" },
		]);
		expect(await storage.read("anthropic")).toBeUndefined();
		expect(await storage.read("openai")).toEqual({ type: "api_key", key: "openai-key" });
		expect(await storage.read("google")).toEqual({ type: "api_key", key: "external-key" });
	});

	test("in-memory storage implements the same credential-store behavior", async () => {
		/** 与文件实现共享相同操作契约的内存存储。 */
		const storage = AuthStorage.inMemory({ anthropic: { type: "api_key", key: "initial" } });
		expect(await storage.read("anthropic")).toEqual({ type: "api_key", key: "initial" });
		await storage.modify("anthropic", async () => ({ type: "api_key", key: "updated" }));
		expect(await storage.read("anthropic")).toEqual({ type: "api_key", key: "updated" });
		await storage.delete("anthropic");
		await expect(storage.list()).resolves.toEqual([]);
	});

	test("does not write after lock acquisition failure and recovers on retry", async () => {
		writeAuthJson({ anthropic: { type: "api_key", key: "stored" } });
		/** 锁失败和重试场景的文件存储。 */
		const storage = AuthStorage.create(authJsonPath);
		/** 首次拒绝 lock 调用的监视器。 */
		const lockSpy = vi.spyOn(lockfile, "lock").mockRejectedValueOnce(new Error("lock unavailable"));

		await expect(storage.modify("openai", async () => ({ type: "api_key", key: "new" }))).rejects.toThrow(
			"lock unavailable",
		);
		expect(JSON.parse(readFileSync(authJsonPath, "utf8"))).toEqual({
			anthropic: { type: "api_key", key: "stored" },
		});

		lockSpy.mockRestore();
		await storage.modify("openai", async () => ({ type: "api_key", key: "new" }));
		expect(JSON.parse(readFileSync(authJsonPath, "utf8"))).toEqual({
			anthropic: { type: "api_key", key: "stored" },
			openai: { type: "api_key", key: "new" },
		});
	});

	test("surfaces a compromised OAuth refresh lock and allows a later retry", async () => {
		/** OAuth 凭据所属的测试提供商标识。 */
		const providerId = "oauth-provider";
		writeAuthJson({
			[providerId]: {
				type: "oauth",
				access: "expired-access",
				refresh: "refresh-token",
				expires: 0,
			},
		});
		/** 保存已过期 OAuth 凭据的文件存储。 */
		const storage = AuthStorage.create(authJsonPath);
		/** 支持 OAuth 刷新但不提供真实模型的测试提供商。 */
		const provider: Provider = {
			id: providerId,
			name: "OAuth Provider",
			auth: {
				oauth: {
					name: "OAuth",
					login: async () => {
						throw new Error("not used");
					},
					refresh: async (credential) => ({
						...credential,
						access: "refreshed-access",
						expires: Date.now() + 60_000,
					}),
					toAuth: async (credential) => ({ apiKey: credential.access }),
				},
			},
			getModels: () => [],
			stream: () => {
				throw new Error("not used");
			},
			streamSimple: () => {
				throw new Error("not used");
			},
		};
		/** 使用 AuthStorage 作为凭据后端的模型注册表。 */
		const models = createModels({ credentials: storage });
		models.setProvider(provider);

		/** proper-lockfile 的真实 lock 方法，第二次认证重试时恢复使用。 */
		const realLock = lockfile.lock.bind(lockfile);
		/** 首次锁定后立即报告 compromised 的 lock mock。 */
		const lockSpy = vi.spyOn(lockfile, "lock").mockImplementationOnce(async (file, options) => {
			options?.onCompromised?.(new Error("lock compromised"));
			return realLock(file, options);
		});
		await expect(models.getAuth(providerId)).rejects.toMatchObject({ code: "auth" });

		lockSpy.mockRestore();
		await expect(models.getAuth(providerId)).resolves.toMatchObject({ auth: { apiKey: "refreshed-access" } });
	});

	test("does not overwrite malformed auth files", async () => {
		writeAuthJson({ anthropic: { type: "api_key", key: "stored" } });
		/** 验证畸形文件保护的认证存储。 */
		const storage = AuthStorage.create(authJsonPath);
		writeFileSync(authJsonPath, "{invalid-json", "utf8");
		await expect(storage.modify("openai", async () => ({ type: "api_key", key: "new" }))).rejects.toThrow();
		expect(readFileSync(authJsonPath, "utf8")).toBe("{invalid-json");
	});
});
