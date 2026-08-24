/**
 * 文件职责：回归验证禁用内置工具时不会连带禁用扩展动态注册工具，并覆盖服务式创建路径。
 * 技术维度：使用 Vitest、默认资源加载器、扩展生命周期回调和两种会话创建 API 组装真实会话。
 * 产品维度：让用户可收紧默认工具权限，同时继续使用自己安装扩展提供的专用工具。
 * 逻辑维度：帮助函数注册 session_start 动态工具；三个用例分别测试 builtin、all 和服务创建。
 * 关键边界：noTools=all 必须清空所有工具；会话持有资源，每个用例完成后需显式 dispose。
 * 新手阅读建议：先比较 noTools 两个枚举值的断言，再看 createSession 中扩展工具注册时机。
 */
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getModel } from "@earendil-works/pi-ai/compat";
import { Type } from "typebox";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	createAgentSessionFromServices,
	createAgentSessionServices,
} from "../../../src/core/agent-session-services.ts";
import { DefaultResourceLoader } from "../../../src/core/resource-loader.ts";
import { createAgentSession } from "../../../src/core/sdk.ts";
import { SessionManager } from "../../../src/core/session-manager.ts";
import { SettingsManager } from "../../../src/core/settings-manager.ts";

describe("regression #3592: no-builtin-tools keeps extension tools enabled", () => {
	// 当前用例的临时工作目录。
	let tempDir: string;
	// 当前用例的代理配置目录。
	let agentDir: string;

	// 功能：创建隔离代理目录；参数：无；返回：无。示例：Vitest 每个用例前自动调用。
	beforeEach(() => {
		tempDir = join(tmpdir(), `pi-no-builtin-tools-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		agentDir = join(tempDir, "agent");
		mkdirSync(agentDir, { recursive: true });
	});

	// 功能：删除当前临时目录；参数：无；返回：无。示例：Vitest 每个用例后自动调用。
	afterEach(() => {
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	/** 功能：创建带动态扩展工具的会话；参数 options 控制 noTools 和工具白名单；返回：已绑定扩展的会话。示例：await createSession({ noTools: "builtin" })。 */
	async function createSession(options?: { noTools?: "all" | "builtin"; tools?: string[] }) {
		// 读取当前临时目录设置的管理器。
		const settingsManager = SettingsManager.create(tempDir, agentDir);
		// 不落盘的会话管理器，根目录仍用于上下文定位。
		const sessionManager = SessionManager.inMemory(tempDir);
		// 配置了 session_start 扩展工厂的资源加载器。
		const resourceLoader = new DefaultResourceLoader({
			cwd: tempDir,
			agentDir,
			settingsManager,
			extensionFactories: [
				(pi) => {
					// pi 是扩展上下文；该工厂注册生命周期监听器且不返回值。
					pi.on("session_start", () => {
						// session_start 回调无参数、无返回值，启动时注册 dynamic_tool。
						pi.registerTool({
							name: "dynamic_tool",
							label: "Dynamic Tool",
							description: "Tool registered from session_start",
							promptSnippet: "Run dynamic test behavior",
							parameters: Type.Object({}),
							execute: async () => ({
								// execute 无参数依赖，返回固定文本与空详情供激活状态测试。
								content: [{ type: "text", text: "ok" }],
								details: {},
							}),
						});
					});
				},
			],
		});
		await resourceLoader.reload();

		// SDK 创建的会话；noTools 和 tools 原样传给会话策略。
		const { session } = await createAgentSession({
			cwd: tempDir,
			agentDir,
			model: getModel("anthropic", "claude-sonnet-4-5")!,
			settingsManager,
			sessionManager,
			resourceLoader,
			noTools: options?.noTools,
			tools: options?.tools,
		});
		await session.bindExtensions({});
		return session;
	}

	it("keeps extension tools active when built-in defaults are disabled", async () => {
		// 仅禁用内置默认激活状态的会话；动态工具仍应处于 active。
		const session = await createSession({ noTools: "builtin" });

		expect(
			session
				.getAllTools()
				.map((tool) => tool.name)
				.sort(),
		).toEqual(["bash", "dynamic_tool", "edit", "find", "grep", "ls", "read", "write"]);
		expect(session.getActiveToolNames()).toEqual(["dynamic_tool"]);
		expect(session.systemPrompt).toContain("- dynamic_tool: Run dynamic test behavior");
		expect(session.systemPrompt).not.toContain("- read:");
		expect(session.systemPrompt).not.toContain("- bash:");
		session.dispose();
	});

	it("still disables all tools when noTools is all", async () => {
		// 禁用所有工具的会话；包括扩展工具在内都不应保留。
		const session = await createSession({ noTools: "all" });

		expect(session.getAllTools()).toEqual([]);
		expect(session.getActiveToolNames()).toEqual([]);
		expect(session.systemPrompt).toContain("Available tools:\n(none)");
		session.dispose();
	});

	it("propagates noTools through service-based session creation", async () => {
		// 服务式创建路径使用的设置管理器。
		const settingsManager = SettingsManager.create(tempDir, agentDir);
		// 服务式创建路径使用的内存会话管理器。
		const sessionManager = SessionManager.inMemory(tempDir);
		// 未注册额外扩展的基础会话服务集合。
		const services = await createAgentSessionServices({
			cwd: tempDir,
			agentDir,
			settingsManager,
		});

		// 由现有 services 创建且禁用内置工具的会话。
		const { session } = await createAgentSessionFromServices({
			services,
			sessionManager,
			model: getModel("anthropic", "claude-sonnet-4-5")!,
			noTools: "builtin",
		});

		expect(session.getActiveToolNames()).toEqual([]);
		expect(session.systemPrompt).toContain("Available tools:\n(none)");
		expect(session.systemPrompt).not.toContain("- read:");
		session.dispose();
	});
});
