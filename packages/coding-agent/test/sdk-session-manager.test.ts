/**
 * 文件职责：验证 SDK 默认会话管理器路径、显式覆盖、工作目录推导及 Bash 工具会话环境变量。
 * 技术维度：使用 Vitest、临时文件系统、真实内置模型元数据、内存会话管理器和 Bash 工具执行。
 * 产品维度：确保嵌入方的会话保存位置与工作目录可预测，并让 Shell 命令获知当前会话上下文。
 * 逻辑维度：搭建项目和代理目录，依次测试默认持久化、自定义管理器、cwd 推导和 PI_* 变量。
 * 关键边界：Bash 测试依赖可执行 shell 与 pwd；每个会话必须 dispose，临时目录必须清理。
 * 新手阅读建议：先比较前两个会话管理器用例，再看 cwd 如何同时影响系统提示与 Bash 工作目录。
 */
import { existsSync, mkdirSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getModel } from "@earendil-works/pi-ai/compat";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAgentSession } from "../src/core/sdk.ts";
import { SessionManager } from "../src/core/session-manager.ts";

describe("createAgentSession session manager defaults", () => {
	// 当前用例的临时根目录。
	let tempDir: string;
	// 模拟项目工作目录。
	let cwd: string;
	// 模拟用户代理配置目录。
	let agentDir: string;

	// 功能：创建隔离项目和代理目录；参数：无；返回：无。示例：Vitest 每个用例前调用。
	beforeEach(() => {
		tempDir = join(tmpdir(), `pi-sdk-session-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		cwd = join(tempDir, "project");
		agentDir = join(tempDir, "agent");
		mkdirSync(cwd, { recursive: true });
		mkdirSync(agentDir, { recursive: true });
	});

	// 功能：递归删除当前临时根目录；参数：无；返回：无。示例：Vitest 每个用例后调用。
	afterEach(() => {
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("uses agentDir for the default persisted session path", async () => {
		// 用于创建会话的内置 Anthropic 模型；目录缺失时断言提前失败。
		const model = getModel("anthropic", "claude-sonnet-4-5");
		expect(model).toBeTruthy();

		// 未提供 sessionManager 时创建的默认持久化会话。
		const { session } = await createAgentSession({
			cwd,
			agentDir,
			model: model!,
		});

		// cwd 转换成文件系统安全名称后的路径片段。
		const safePath = `--${cwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`;
		// 预期位于 agentDir/sessions 下的会话目录。
		const expectedSessionDir = join(agentDir, "sessions", safePath);
		// 默认会话管理器实际报告的会话目录。
		const sessionDir = session.sessionManager.getSessionDir();
		// 默认会话管理器实际创建的 JSONL 文件路径。
		const sessionFile = session.sessionManager.getSessionFile();

		expect(sessionDir).toBe(expectedSessionDir);
		expect(sessionFile?.startsWith(`${expectedSessionDir}/`)).toBe(true);

		session.dispose();
	});

	it("keeps an explicit sessionManager override", async () => {
		// 显式管理器场景使用的内置模型。
		const model = getModel("anthropic", "claude-sonnet-4-5");
		expect(model).toBeTruthy();

		// 调用方提供的内存会话管理器，不应被 SDK 替换。
		const sessionManager = SessionManager.inMemory(cwd);
		// 使用显式 sessionManager 创建的会话。
		const { session } = await createAgentSession({
			cwd,
			agentDir,
			model: model!,
			sessionManager,
		});

		expect(session.sessionManager).toBe(sessionManager);
		expect(session.sessionManager.isPersisted()).toBe(false);

		session.dispose();
	});

	it("derives cwd from an explicit sessionManager when cwd is omitted", async () => {
		// cwd 推导场景使用的内置模型。
		const model = getModel("anthropic", "claude-sonnet-4-5");
		expect(model).toBeTruthy();

		// 只通过 sessionManager 提供给 SDK 的工作目录。
		const sessionCwd = join(tempDir, "session-project");
		mkdirSync(sessionCwd, { recursive: true });
		// 以 sessionCwd 为根的内存会话管理器。
		const sessionManager = SessionManager.inMemory(sessionCwd);
		// 省略 cwd 后创建的会话，应从管理器读取它。
		const { session } = await createAgentSession({
			agentDir,
			model: model!,
			sessionManager,
		});

		expect(session.sessionManager).toBe(sessionManager);
		expect(session.systemPrompt).toContain(`Current working directory: ${sessionCwd}`);

		// 会话注册的内置 Bash 工具；找不到时断言失败。
		const bashTool = session.agent.state.tools.find((tool) => tool.name === "bash");
		expect(bashTool).toBeTruthy();
		// Bash 执行 pwd 得到的结构化工具结果。
		const result = await bashTool!.execute("test", { command: "pwd" });
		// 从工具结果文本块拼接的原始工作目录输出。
		const output = result.content
			.filter((item): item is { type: "text"; text: string } => item.type === "text")
			.map((item) => item.text)
			.join("");

		expect(realpathSync(output.trim())).toBe(realpathSync(sessionCwd));

		session.dispose();
	});

	it("exposes current session state to the built-in bash tool", async () => {
		// 环境变量场景使用的内置模型。
		const model = getModel("anthropic", "claude-sonnet-4-5");
		expect(model).toBeTruthy();

		// 启用 high 思考级别且使用默认持久化管理器的会话。
		const { session } = await createAgentSession({
			cwd,
			agentDir,
			model: model!,
			thinkingLevel: "high",
		});
		expect(session.sessionFile).toBeTruthy();
		expect(session.systemPrompt).toContain(
			"Inspect PI_* environment variables for current model and session details.",
		);

		// 将读取 PI_* 环境变量的内置 Bash 工具。
		const bashTool = session.agent.state.tools.find((tool) => tool.name === "bash");
		expect(bashTool).toBeTruthy();
		// 打印五个会话环境变量后的工具执行结果。
		const result = await bashTool!.execute("test", {
			command: `printf '%s\\n' "$PI_SESSION_ID" "$PI_SESSION_FILE" "$PI_PROVIDER" "$PI_MODEL" "$PI_REASONING_LEVEL"`,
		});
		// 按行保留五个变量值的拼接文本。
		const output = result.content
			.filter((item): item is { type: "text"; text: string } => item.type === "text")
			.map((item) => item.text)
			.join("");

		expect(output.trim().split("\n")).toEqual([
			session.sessionId,
			session.sessionFile,
			model!.provider,
			model!.id,
			session.thinkingLevel,
		]);

		session.dispose();
	});
});
