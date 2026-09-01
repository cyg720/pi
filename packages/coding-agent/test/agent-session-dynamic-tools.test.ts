/**
 * 文件职责：验证 AgentSession 动态注册工具、工具来源元数据、系统提示和 Bash 会话环境暴露。
 * 技术维度：使用 Vitest、临时目录、DefaultResourceLoader 内联扩展和真实会话装配接口。
 * 产品维度：确保扩展与 SDK 后注册的工具立即可用，并让 Bash 子进程按配置获知当前会话和模型信息。
 * 逻辑维度：每个用例创建隔离资源加载器与会话，注册工具，绑定扩展，再检查工具状态和提示词。
 * 关键边界：测试会创建真实临时目录；会话和加载器需释放；Bash spawnHook 只检查环境而不依赖命令输出。
 * 新手阅读建议：先看 beforeEach 的目录结构，再读 Bash 环境用例，随后比较扩展工具、SDK 工具和隐藏工具。
 */
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getModel } from "@earendil-works/pi-ai/compat";
import { Type } from "typebox";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DefaultResourceLoader } from "../src/core/resource-loader.ts";
import { createAgentSession } from "../src/core/sdk.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";
import { createBashTool } from "../src/core/tools/bash.ts";

/** 覆盖会话初始化前后注册工具时的目录、提示与来源行为。 */
describe("AgentSession dynamic tool registration", () => {
	/** 当前用例的临时工作目录。 */
	let tempDir: string;
	/** 当前用例模拟的 agent 配置目录。 */
	let agentDir: string;

	/** 每个用例前创建独立工作目录和 agent 子目录。 */
	beforeEach(() => {
		tempDir = join(tmpdir(), `pi-dynamic-tool-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		agentDir = join(tempDir, "agent");
		mkdirSync(agentDir, { recursive: true });
	});

	/** 每个用例后递归删除临时目录。 */
	afterEach(() => {
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("exposes session state before custom bash spawn hooks and supports opting out", async () => {
		/** 使用临时目录持久化设置的管理器。 */
		const settingsManager = SettingsManager.create(tempDir, agentDir);
		/** 具有固定会话标识的文件会话管理器。 */
		const sessionManager = SessionManager.create(tempDir, join(agentDir, "sessions"), { id: "bash-env-test" });
		/** 默认 Bash spawnHook 观察到的会话环境。 */
		let sessionEnv: NodeJS.ProcessEnv | undefined;
		/** 显式关闭环境暴露的 Bash 工具观察到的环境。 */
		let optedOutEnv: NodeJS.ProcessEnv | undefined;
		/** 注册两个 Bash 工具的资源加载器。 */
		const resourceLoader = new DefaultResourceLoader({
			cwd: tempDir,
			agentDir,
			settingsManager,
			extensionFactories: [
				(pi) => {
					pi.registerTool(
						createBashTool(tempDir, {
							spawnHook: (ctx) => {
								sessionEnv = ctx.env;
								return ctx;
							},
						}),
					);
					pi.registerTool({
						...createBashTool(tempDir, {
							exposeSessionEnvironment: false,
							spawnHook: (ctx) => {
								optedOutEnv = ctx.env;
								return ctx;
							},
						}),
						name: "bash_without_session_env",
						label: "bash without session env",
					});
				},
			],
		});
		await resourceLoader.reload();

		/** 会话使用的 Anthropic 模型。 */
		const model = getModel("anthropic", "claude-sonnet-4-5")!;
		/** 装配完成的被测会话。 */
		const { session } = await createAgentSession({
			cwd: tempDir,
			agentDir,
			model,
			thinkingLevel: "high",
			settingsManager,
			sessionManager,
			resourceLoader,
		});

		/** 默认暴露 PI_* 环境变量的 Bash 工具。 */
		const bashTool = session.agent.state.tools.find((tool) => tool.name === "bash")!;
		expect(session.systemPrompt).toContain(
			"You can inspect PI_* environment variables for current model and session details.",
		);
		await bashTool.execute("bash-env", { command: "printf ok" });
		expect(sessionEnv).toMatchObject({
			PI_SESSION_ID: session.sessionId,
			PI_SESSION_FILE: session.sessionFile,
			PI_PROVIDER: model.provider,
			PI_MODEL: model.id,
			PI_REASONING_LEVEL: session.thinkingLevel,
		});

		/** 显式关闭会话环境暴露的自定义 Bash 工具。 */
		const optedOutBashTool = session.agent.state.tools.find((tool) => tool.name === "bash_without_session_env")!;
		await optedOutBashTool.execute("bash-no-env", { command: "printf ok" });
		expect(optedOutEnv).not.toHaveProperty("PI_SESSION_ID");
		expect(optedOutEnv).not.toHaveProperty("PI_SESSION_FILE");
		expect(optedOutEnv).not.toHaveProperty("PI_PROVIDER");
		expect(optedOutEnv).not.toHaveProperty("PI_MODEL");
		expect(optedOutEnv).not.toHaveProperty("PI_REASONING_LEVEL");

		session.dispose();
	});

	it("refreshes tool registry when tools are registered after initialization", async () => {
		/** 动态注册场景的设置管理器。 */
		const settingsManager = SettingsManager.create(tempDir, agentDir);
		/** 动态注册场景的内存会话管理器。 */
		const sessionManager = SessionManager.inMemory();

		/** 在 session_start 回调中注册 dynamic_tool 的资源加载器。 */
		const resourceLoader = new DefaultResourceLoader({
			cwd: tempDir,
			agentDir,
			settingsManager,
			extensionFactories: [
				(pi) => {
					pi.on("session_start", () => {
						pi.registerTool({
							name: "dynamic_tool",
							label: "Dynamic Tool",
							description: "Tool registered from session_start",
							promptSnippet: "Run dynamic test behavior",
							promptGuidelines: ["Use dynamic_tool when the user asks for dynamic behavior tests."],
							parameters: Type.Object({}),
							execute: async () => ({
								content: [{ type: "text", text: "ok" }],
								details: {},
							}),
						});
					});
				},
			],
		});
		await resourceLoader.reload();

		/** 扩展绑定前创建的被测会话。 */
		const { session } = await createAgentSession({
			cwd: tempDir,
			agentDir,
			model: getModel("anthropic", "claude-sonnet-4-5")!,
			settingsManager,
			sessionManager,
			resourceLoader,
		});

		expect(session.getAllTools().map((tool) => tool.name)).not.toContain("dynamic_tool");

		await session.bindExtensions({});

		/** 扩展绑定后刷新得到的全部工具。 */
		const allTools = session.getAllTools();
		/** 动态扩展注册的工具。 */
		const dynamicTool = allTools.find((tool) => tool.name === "dynamic_tool");
		/** 内置 read 工具，用于对比来源元数据。 */
		const readTool = allTools.find((tool) => tool.name === "read");

		expect(allTools.map((tool) => tool.name)).toContain("dynamic_tool");
		expect(dynamicTool?.promptGuidelines).toEqual([
			"Use dynamic_tool when the user asks for dynamic behavior tests.",
		]);
		expect(dynamicTool?.sourceInfo).toMatchObject({
			path: "<inline:1>",
			source: "inline",
			scope: "temporary",
			origin: "top-level",
		});
		expect(readTool?.sourceInfo).toMatchObject({
			path: "<builtin:read>",
			source: "builtin",
			scope: "temporary",
			origin: "top-level",
		});
		expect(session.getActiveToolNames()).toContain("dynamic_tool");
		expect(session.systemPrompt).toContain("- dynamic_tool: Run dynamic test behavior");
		expect(session.systemPrompt).toContain("- Use dynamic_tool when the user asks for dynamic behavior tests.");

		session.dispose();
	});

	it("returns source metadata for SDK custom tools", async () => {
		/** SDK 工具场景的设置管理器。 */
		const settingsManager = SettingsManager.create(tempDir, agentDir);
		/** SDK 工具场景的内存会话管理器。 */
		const sessionManager = SessionManager.inMemory();
		/** 不加载扩展的默认资源加载器。 */
		const resourceLoader = new DefaultResourceLoader({
			cwd: tempDir,
			agentDir,
			settingsManager,
		});
		await resourceLoader.reload();

		/** 通过 customTools 注册 sdk_tool 的会话。 */
		const { session } = await createAgentSession({
			cwd: tempDir,
			agentDir,
			model: getModel("anthropic", "claude-sonnet-4-5")!,
			settingsManager,
			sessionManager,
			resourceLoader,
			customTools: [
				{
					name: "sdk_tool",
					label: "SDK Tool",
					description: "Tool registered through createAgentSession",
					parameters: Type.Object({}),
					execute: async () => ({
						content: [{ type: "text", text: "ok" }],
						details: {},
					}),
				},
			],
		});

		/** 从工具目录中取得的 SDK 自定义工具。 */
		const sdkTool = session.getAllTools().find((tool) => tool.name === "sdk_tool");
		expect(sdkTool?.sourceInfo).toMatchObject({
			path: "<sdk:sdk_tool>",
			source: "sdk",
			scope: "temporary",
			origin: "top-level",
		});
		expect(session.getActiveToolNames()).toContain("sdk_tool");

		session.dispose();
	});

	it("keeps custom tools active but omits them from available tools when promptSnippet is not provided", async () => {
		/** 隐藏提示片段场景的设置管理器。 */
		const settingsManager = SettingsManager.create(tempDir, agentDir);
		/** 隐藏提示片段场景的内存会话管理器。 */
		const sessionManager = SessionManager.inMemory();

		/** 注册没有 promptSnippet 的 hidden_tool 的资源加载器。 */
		const resourceLoader = new DefaultResourceLoader({
			cwd: tempDir,
			agentDir,
			settingsManager,
			extensionFactories: [
				(pi) => {
					pi.on("session_start", () => {
						pi.registerTool({
							name: "hidden_tool",
							label: "Hidden Tool",
							description: "Description should not appear in available tools",
							parameters: Type.Object({}),
							execute: async () => ({
								content: [{ type: "text", text: "ok" }],
								details: {},
							}),
						});
					});
				},
			],
		});
		await resourceLoader.reload();

		/** 包含 hidden_tool 的被测会话。 */
		const { session } = await createAgentSession({
			cwd: tempDir,
			agentDir,
			model: getModel("anthropic", "claude-sonnet-4-5")!,
			settingsManager,
			sessionManager,
			resourceLoader,
		});

		await session.bindExtensions({});

		expect(session.getAllTools().map((tool) => tool.name)).toContain("hidden_tool");
		expect(session.getActiveToolNames()).toContain("hidden_tool");
		expect(session.systemPrompt).not.toContain("hidden_tool");
		expect(session.systemPrompt).not.toContain("Description should not appear in available tools");

		session.dispose();
	});
});
