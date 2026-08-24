/**
 * 文件职责：回归验证工具允许列表也会过滤会话启动时动态注册的扩展工具。
 * 技术维度：使用 Vitest、临时资源目录、DefaultResourceLoader、SDK 会话和 TypeBox 工具模式。
 * 产品维度：让用户的工具白名单对内置与扩展能力一致生效，降低模型获得多余权限的风险。
 * 逻辑维度：每例创建隔离资源加载器并注册动态工具，再分别测试部分允许和空列表。
 * 关键边界：会话绑定扩展后才注册工具；用例结束需释放会话并递归删除临时目录。
 * 新手阅读建议：先看 createSession 的加载与绑定顺序，再比较两例 getAllTools 和系统提示。
 */
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getModel } from "@earendil-works/pi-ai/compat";
import { Type } from "typebox";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DefaultResourceLoader } from "../../../src/core/resource-loader.ts";
import { createAgentSession } from "../../../src/core/sdk.ts";
import { SessionManager } from "../../../src/core/session-manager.ts";
import { SettingsManager } from "../../../src/core/settings-manager.ts";

describe("regression #2835: tool allowlists filter extension tools", () => {
	// tempDir 是每个用例独享的临时项目根目录。
	let tempDir: string;
	// agentDir 是临时项目下的代理资源目录。
	let agentDir: string;

	// 每例前创建唯一代理目录；无参数，无返回值。
	beforeEach(() => {
		tempDir = join(tmpdir(), `pi-tools-filter-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		agentDir = join(tempDir, "agent");
		mkdirSync(agentDir, { recursive: true });
	});

	// 每例后删除临时根目录；无参数，无返回值。
	afterEach(() => {
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	/**
	 * 创建应用指定工具允许列表的隔离代理会话。
	 * 参数：allowedToolNames 为允许名称数组，undefined 表示不限制。
	 * 返回值：绑定扩展后的 AgentSession Promise。
	 * 使用示例：`await createSession(["read", "dynamic_tool"])`。
	 */
	async function createSession(allowedToolNames?: string[]) {
		// settingsManager 使用临时项目和代理目录保存设置。
		const settingsManager = SettingsManager.create(tempDir, agentDir);
		// sessionManager 是不落盘的临时会话树管理器。
		const sessionManager = SessionManager.inMemory(tempDir);
		// resourceLoader 注册会话启动时创建 dynamic_tool 的扩展。
		const resourceLoader = new DefaultResourceLoader({
			cwd: tempDir,
			agentDir,
			settingsManager,
			extensionFactories: [
				// pi 是扩展 API，用于监听 session_start。
				(pi) => {
					// 会话启动回调动态注册测试工具。
					pi.on("session_start", () => {
						pi.registerTool({
							name: "dynamic_tool",
							label: "Dynamic Tool",
							description: "Tool registered from session_start",
							promptSnippet: "Run dynamic test behavior",
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

		// session 是按允许列表构造的代理会话。
		const { session } = await createAgentSession({
			cwd: tempDir,
			agentDir,
			model: getModel("anthropic", "claude-sonnet-4-5")!,
			settingsManager,
			sessionManager,
			resourceLoader,
			tools: allowedToolNames,
		});
		await session.bindExtensions({});
		return session;
	}

	// 验证只保留明确允许的一个内置工具和一个扩展工具；无参数，无返回值。
	it("allows only explicitly listed built-in and extension tools", async () => {
		// session 是允许 read 与 dynamic_tool 的绑定后会话。
		const session = await createSession(["read", "dynamic_tool"]);

		expect(
			session
				.getAllTools()
				// tool 是当前可见工具，回调提取其名称后排序。
				.map((tool) => tool.name)
				.sort(),
		).toEqual(["dynamic_tool", "read"]);
		expect(session.getActiveToolNames().sort()).toEqual(["dynamic_tool", "read"]);
		expect(session.systemPrompt).toContain("- read: Read file contents");
		expect(session.systemPrompt).toContain("- dynamic_tool: Run dynamic test behavior");
		expect(session.systemPrompt).not.toContain("- bash:");
		expect(session.systemPrompt).not.toContain("- edit:");
		session.dispose();
	});

	// 验证空允许列表禁用全部内置和动态工具；无参数，无返回值。
	it("disables all tools when the allowlist is empty", async () => {
		// session 是显式不允许任何工具的绑定后会话。
		const session = await createSession([]);

		expect(session.getAllTools()).toEqual([]);
		expect(session.getActiveToolNames()).toEqual([]);
		expect(session.systemPrompt).toContain("Available tools:\n(none)");
		expect(session.systemPrompt).not.toContain("dynamic_tool");
		session.dispose();
	});
});
