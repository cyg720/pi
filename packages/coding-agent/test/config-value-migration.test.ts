/**
 * 文件职责：验证配置值环境变量语法迁移不会误改大写字面量，并能容忍损坏或空白的 models.json。
 * 技术维度：使用 Vitest、临时目录、环境变量隔离、真实迁移器和模型注册表执行文件级集成测试。
 * 产品维度：升级项目时保护用户 API 密钥、请求头和 OAuth 字段原值，同时给无效配置提供可读诊断。
 * 逻辑维度：创建隔离 agent 目录，临时切换 ENV_AGENT_DIR，分别检查 auth.json、无效 models.json 和完整提供商配置。
 * 关键边界：测试会临时修改进程环境变量并写磁盘；finally 必须恢复所有环境值，迁移器不得记录无变化日志。
 * 新手阅读建议：先看 createAgentDir/withAgentDir 的隔离方式，再比较迁移前文件和注册表实际解析结果。
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ENV_AGENT_DIR } from "../src/config.ts";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { runMigrations } from "../src/migrations.ts";

import { createModelRegistry } from "./model-runtime-test-utils.ts";

// 验证旧环境变量识别迁移只处理明确语法，不猜测普通大写字符串。
describe("config value env var syntax migration", () => {
	// tempDirs 收集本组创建的临时 agent 目录，便于统一删除。
	const tempDirs: string[] = [];

	// 每个用例后删除临时目录并恢复 console 等模拟函数。
	afterEach(() => {
		// dir 是当前待递归删除的测试临时目录。
		for (const dir of tempDirs.splice(0)) {
			fs.rmSync(dir, { recursive: true, force: true });
		}
		vi.restoreAllMocks();
	});

	/** 创建并登记一个测试 agent 目录；无参数；返回目录绝对路径。 */
	function createAgentDir(): string {
		// agentDir 是系统临时目录下带随机后缀的新目录。
		const agentDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-config-value-migration-test-"));
		tempDirs.push(agentDir);
		return agentDir;
	}

	/**
	 * 在临时 ENV_AGENT_DIR 下同步执行回调并可靠恢复原值。
	 * @param agentDir 要临时设置的 agent 目录。
	 * @param fn 在该环境下执行的无参数函数。
	 * @returns 无返回值；例如 `withAgentDir(dir, () => runMigrations(dir))`。
	 */
	function withAgentDir(agentDir: string, fn: () => void): void {
		// previousAgentDir 保存调用前环境值，undefined 表示原先不存在。
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

	// auth.json 中普通大写字符串、显式 `$` 语法和 OAuth 令牌都应保持原样。
	it("leaves uppercase auth.json API key values unchanged", () => {
		// agentDir 是本用例认证文件所在目录。
		const agentDir = createAgentDir();
		fs.writeFileSync(
			path.join(agentDir, "auth.json"),
			`${JSON.stringify(
				{
					anthropic: { type: "api_key", key: "ANTHROPIC_API_KEY" },
					openai: { type: "api_key", key: "$OPENAI_API_KEY" },
					opencode: { type: "api_key", key: "public" },
					github: { type: "oauth", access: "ACCESS_TOKEN", refresh: "REFRESH_TOKEN", expires: 1 },
				},
				null,
				2,
			)}\n`,
			"utf-8",
		);
		// logSpy 确认没有实际迁移时不会输出变更日志。
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		withAgentDir(agentDir, () => runMigrations(agentDir));

		// migrated 是迁移后重新解析的认证配置映射。
		const migrated = JSON.parse(fs.readFileSync(path.join(agentDir, "auth.json"), "utf-8")) as Record<
			string,
			Record<string, unknown>
		>;
		expect(migrated.anthropic.key).toBe("ANTHROPIC_API_KEY");
		expect(migrated.openai.key).toBe("$OPENAI_API_KEY");
		expect(migrated.opencode.key).toBe("public");
		expect(migrated.github.access).toBe("ACCESS_TOKEN");
		expect(logSpy).not.toHaveBeenCalled();
	});

	// 格式损坏或空白 models.json 不应让整体迁移过程抛错或改写原内容。
	it.each([
		["malformed", '{\n  "providers": {\n'],
		["blank", ""],
	])("does not throw on %s models.json during migrations", async (_name, content) => {
		// agentDir 是本参数化用例的隔离目录。
		const agentDir = createAgentDir();
		// modelsPath 指向待保留原样的无效配置文件。
		const modelsPath = path.join(agentDir, "models.json");
		fs.writeFileSync(modelsPath, content, "utf-8");

		withAgentDir(agentDir, () => expect(() => runMigrations(agentDir)).not.toThrow());

		expect(fs.readFileSync(modelsPath, "utf-8")).toBe(content);
		// registry 使用同一无效文件加载，用于确认错误诊断仍然清晰。
		const registry = await createModelRegistry(AuthStorage.create(path.join(agentDir, "auth.json")), modelsPath);
		// loadError 是模型注册表保存的解析错误文本。
		const loadError = registry.getError();
		expect(loadError).toContain("Failed to parse models.json");
		expect(loadError).toContain(`File: ${modelsPath}`);
	});

	// models.json 各层 API 密钥和 Header 中的大写字面量都不得自动当成环境变量引用。
	it("leaves uppercase models.json API key and header values unchanged", async () => {
		// agentDir 是完整模型配置和认证文件的临时根目录。
		const agentDir = createAgentDir();
		// envKeys 列出配置文本中出现、并故意同时设置到环境里的键名。
		const envKeys = ["CUSTOM_API_KEY", "HEADER_API_KEY", "MODEL_API_KEY", "OVERRIDE_API_KEY"];
		// savedEnv 保存每个环境变量原值，finally 中逐项还原。
		const savedEnv: Record<string, string | undefined> = {};
		// key 是当前待覆盖并保存原值的配置环境变量名。
		for (const key of envKeys) {
			savedEnv[key] = process.env[key];
			process.env[key] = `env-${key}`;
		}

		try {
			fs.writeFileSync(
				path.join(agentDir, "models.json"),
				`${JSON.stringify(
					{
						providers: {
							"custom-provider": {
								baseUrl: "https://example.com/v1",
								apiKey: "CUSTOM_API_KEY",
								api: "openai-completions",
								headers: {
									"x-api-key": "HEADER_API_KEY",
									"x-literal": "literal",
								},
								models: [
									{
										id: "model-a",
										headers: { "x-model-key": "MODEL_API_KEY" },
									},
								],
								modelOverrides: {
									"model-b": { headers: { "x-override-key": "OVERRIDE_API_KEY" } },
								},
							},
						},
					},
					null,
					2,
				)}\n`,
				"utf-8",
			);
			// logSpy 确认所有值保持原样时迁移器不报告变更。
			const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			withAgentDir(agentDir, () => runMigrations(agentDir));

			// migrated 是迁移后读取的完整 providers 配置。
			const migrated = JSON.parse(fs.readFileSync(path.join(agentDir, "models.json"), "utf-8")) as {
				providers: Record<
					string,
					{
						apiKey?: string;
						headers?: Record<string, string>;
						models?: Array<{ headers?: Record<string, string> }>;
						modelOverrides?: Record<string, { headers?: Record<string, string> }>;
					}
				>;
			};
			// provider 是待检查的 custom-provider 配置。
			const provider = migrated.providers["custom-provider"]!;
			expect(provider.apiKey).toBe("CUSTOM_API_KEY");
			expect(provider.headers?.["x-api-key"]).toBe("HEADER_API_KEY");
			expect(provider.headers?.["x-literal"]).toBe("literal");
			expect(provider.models?.[0]?.headers?.["x-model-key"]).toBe("MODEL_API_KEY");
			expect(provider.modelOverrides?.["model-b"]?.headers?.["x-override-key"]).toBe("OVERRIDE_API_KEY");
			expect(logSpy).not.toHaveBeenCalled();

			// registry 验证运行时也把这些大写文本当作字面密钥和请求头。
			const registry = await createModelRegistry(
				AuthStorage.create(path.join(agentDir, "auth.json")),
				path.join(agentDir, "models.json"),
			);
			// model 是自定义提供商目录中的 model-a。
			const model = registry.find("custom-provider", "model-a");
			expect(model).toBeDefined();
			expect(await registry.getApiKeyForProvider("custom-provider")).toBe("CUSTOM_API_KEY");
			expect(await registry.getApiKeyAndHeaders(model!)).toMatchObject({
				ok: true,
				apiKey: "CUSTOM_API_KEY",
				headers: {
					"x-api-key": "HEADER_API_KEY",
					"x-literal": "literal",
					"x-model-key": "MODEL_API_KEY",
				},
			});
		} finally {
			// key 是当前待恢复或删除的配置环境变量名。
			for (const key of envKeys) {
				if (savedEnv[key] === undefined) {
					delete process.env[key];
				} else {
					process.env[key] = savedEnv[key];
				}
			}
		}
	});
});
