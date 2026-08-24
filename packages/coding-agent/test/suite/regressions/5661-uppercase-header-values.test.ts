/**
 * 文件职责：回归验证 models.json 中全大写 API 密钥和请求头字符串不会被迁移成环境变量值。
 * 技术维度：使用 Vitest、临时模型文件、启动迁移、AuthStorage 和运行时模型注册表。
 * 产品维度：避免用户有意填写的大写字面量认证值在升级时被静默替换，导致请求配置变化。
 * 逻辑维度：保存并设置同名环境变量，写入模型配置，运行迁移后检查文件与注册表解析结果。
 * 关键边界：测试会临时修改代理目录及两个环境变量，所有恢复函数按后进先出顺序执行。
 * 新手阅读建议：先看 withAgentDir 和 cleanups，再对比迁移前 JSON、迁移后文件和运行时结果。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ENV_AGENT_DIR } from "../../../src/config.ts";
import { AuthStorage } from "../../../src/core/auth-storage.ts";
import { runMigrations } from "../../../src/migrations.ts";
import { createModelRegistry } from "../../model-runtime-test-utils.ts";
import { createHarness } from "../harness.ts";

describe("regression #5661: uppercase models.json header values", () => {
	// cleanups 保存环境和夹具恢复函数，并在每例结束时逆序执行。
	const cleanups: Array<() => void> = [];

	// 每个用例后执行所有清理函数；无参数，无返回值。
	afterEach(() => {
		while (cleanups.length > 0) {
			cleanups.pop()?.();
		}
	});

	/**
	 * 临时切换代理配置目录并同步执行回调。
	 * 参数：agentDir 为目标目录，fn 为在该环境下运行的函数。
	 * 返回值：无，finally 中恢复原环境。
	 * 使用示例：`withAgentDir(tempDir, () => runMigrations(tempDir))`。
	 */
	function withAgentDir(agentDir: string, fn: () => void): void {
		// previousAgentDir 保存切换前的代理目录环境值。
		const previousAgentDir = process.env[ENV_AGENT_DIR];
		process.env[ENV_AGENT_DIR] = agentDir;
		try {
			fn();
		} finally {
			if (previousAgentDir === undefined) {
				delete process.env[ENV_AGENT_DIR];
			} else {
				process.env[ENV_AGENT_DIR] = previousAgentDir;
			}
		}
	}

	// 验证大写认证字符串经过迁移和注册表加载后仍保持字面值；无参数，无返回值。
	it("keeps uppercase header strings as literals during startup migrations", async () => {
		// harness 提供隔离目录且不预置认证信息。
		const harness = await createHarness({ withConfiguredAuth: false });
		cleanups.push(harness.cleanup);

		// envKeys 是故意与配置字面量同名的环境变量列表。
		const envKeys = ["CUSTOM_API_KEY", "BEARER"];
		// savedEnv 保存两个环境变量原值，便于测试结束恢复。
		const savedEnv: Record<string, string | undefined> = {};
		// key 是当前待保存并设置的环境变量名。
		for (const key of envKeys) {
			savedEnv[key] = process.env[key];
			process.env[key] = `env-${key}`;
		}
		// 清理回调恢复两个环境变量的原始定义状态和值。
		cleanups.push(() => {
			// key 是当前待恢复的环境变量名。
			for (const key of envKeys) {
				if (savedEnv[key] === undefined) {
					delete process.env[key];
				} else {
					process.env[key] = savedEnv[key];
				}
			}
		});

		// modelsPath 是隔离目录中的自定义模型配置路径。
		const modelsPath = join(harness.tempDir, "models.json");
		writeFileSync(
			modelsPath,
			`${JSON.stringify(
				{
					providers: {
						"my-provider": {
							baseUrl: "https://example.com/v1",
							apiKey: "CUSTOM_API_KEY",
							api: "openai-completions",
							headers: { Authorization: "BEARER" },
							models: [{ id: "my-model" }],
						},
					},
				},
				null,
				2,
			)}\n`,
			"utf-8",
		);

		withAgentDir(harness.tempDir, () => runMigrations(harness.tempDir));

		// migrated 是迁移后从磁盘重新解析的模型提供商配置。
		const migrated = JSON.parse(readFileSync(modelsPath, "utf-8")) as {
			providers: Record<string, { apiKey?: string; headers?: Record<string, string> }>;
		};
		expect(migrated.providers["my-provider"]?.apiKey).toBe("CUSTOM_API_KEY");
		expect(migrated.providers["my-provider"]?.headers?.Authorization).toBe("BEARER");

		// registry 是从迁移后模型文件创建的运行时注册表。
		const registry = await createModelRegistry(AuthStorage.create(join(harness.tempDir, "auth.json")), modelsPath);
		// model 是注册表中自定义提供商的可选模型配置。
		const model = registry.find("my-provider", "my-model");
		expect(model).toBeDefined();
		expect(await registry.getApiKeyAndHeaders(model!)).toMatchObject({
			ok: true,
			apiKey: "CUSTOM_API_KEY",
			headers: { Authorization: "BEARER" },
		});
	});
});
