/**
 * 文件职责：通过启动真实 RPC 子进程端到端验证状态、会话持久化、压缩、Bash、模型设置、树查询和导出接口。
 * 技术维度：使用 Vitest 长超时、RpcClient、临时会话目录、真实提供商凭据和 JSONL 磁盘检查覆盖进程边界。
 * 产品维度：保障外部编辑器或自动化客户端可稳定控制 Pi，并从 RPC 获得与交互模式一致的会话能力。
 * 逻辑维度：每个用例启动独立客户端，依次测试查询、消息与 Bash 持久化、设置、会话管理、条目/树和元数据。
 * 关键边界：需要 Anthropic 凭据和已构建 dist/cli.js；包含真实模型与 Shell 调用；单用例超时最长两分钟。
 * 新手阅读建议：先看 beforeEach 的 RpcClient 配置和 getState，再看 promptAndWait/文件检查，最后读 entries/tree 游标语义。
 */
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentEvent } from "@earendil-works/pi-agent-core";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { RpcClient } from "../src/modes/rpc/rpc-client.ts";

/** 当前测试文件目录，用于定位包根和 dist CLI。 */
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * RPC mode tests.
 */
/** RPC 模式端到端测试；没有 Anthropic 凭据时整组跳过。 */
describe.skipIf(!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_OAUTH_TOKEN)("RPC mode", () => {
	/** 当前用例启动和停止的 RPC 客户端。 */
	let client: RpcClient;
	/** 当前用例隔离的 Pi 数据目录。 */
	let sessionDir: string;

	/** 每个用例前创建客户端配置，尚不启动进程。 */
	beforeEach(() => {
		sessionDir = join(tmpdir(), `pi-rpc-test-${Date.now()}`);
		client = new RpcClient({
			cliPath: join(__dirname, "..", "dist", "cli.js"),
			cwd: join(__dirname, ".."),
			env: { PI_CODING_AGENT_DIR: sessionDir },
			provider: "anthropic",
			model: "claude-sonnet-4-5",
		});
	});

	/** 每个用例后停止 RPC 进程并删除会话目录。 */
	afterEach(async () => {
		await client.stop();
		if (sessionDir && existsSync(sessionDir)) {
			rmSync(sessionDir, { recursive: true });
		}
	});

	/** 验证初始 RPC 状态包含模型且未在流式输出。 */
	test("should get state", async () => {
		await client.start();
		/** RPC get_state 返回的初始状态。 */
		const state = await client.getState();

		expect(state.model).toBeDefined();
		expect(state.model?.provider).toBe("anthropic");
		expect(state.model?.id).toBe("claude-sonnet-4-5");
		expect(state.isStreaming).toBe(false);
		expect(state.messageCount).toBe(0);
	}, 30000);

	/** 验证 prompt 产生的消息会持久化到 JSONL 会话文件。 */
	test("should save messages to session file", async () => {
		await client.start();

		// Send prompt and wait for completion
		// 发送提示并等待完整模型响应。
		/** prompt 期间收到的全部 RPC 事件。 */
		const events = await client.promptAndWait("Reply with just the word 'hello'");

		// Should have message events
		// 用户和助手至少各有一个 message_end。
		/** 事件中所有消息结束事件。 */
		const messageEndEvents = events.filter((e) => e.type === "message_end");
		expect(messageEndEvents.length).toBeGreaterThanOrEqual(2); // user + assistant

		// Wait for file writes
		// 短暂等待异步文件写入完成。
		await new Promise((resolve) => setTimeout(resolve, 200));

		// Verify session file
		// 定位并读取写入的唯一会话文件。
		/** PI_CODING_AGENT_DIR 下的 sessions 目录。 */
		const sessionsPath = join(sessionDir, "sessions");
		expect(existsSync(sessionsPath)).toBe(true);

		/** 按 cwd 分组的会话子目录名。 */
		const sessionDirs = readdirSync(sessionsPath);
		expect(sessionDirs.length).toBeGreaterThan(0);

		/** 当前 cwd 对应的会话目录。 */
		const cwdSessionDir = join(sessionsPath, sessionDirs[0]);
		/** 当前目录中的 JSONL 会话文件。 */
		const sessionFiles = readdirSync(cwdSessionDir).filter((f) => f.endsWith(".jsonl"));
		expect(sessionFiles.length).toBe(1);

		/** 会话文件原始文本。 */
		const sessionContent = readFileSync(join(cwdSessionDir, sessionFiles[0]), "utf8");
		/** 逐行解析后的会话头和条目。 */
		const entries = sessionContent
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line));

		// First entry should be session header
		// 第一条记录应为会话头。
		expect(entries[0].type).toBe("session");

		// Should have user and assistant messages
		// 后续条目应至少包含用户和助手消息。
		/** JSONL 中的全部消息条目。 */
		const messages = entries.filter((e: { type: string }) => e.type === "message");
		expect(messages.length).toBeGreaterThanOrEqual(2);

		/** 消息条目的角色序列。 */
		const roles = messages.map((m: { message: { role: string } }) => m.message.role);
		expect(roles).toContain("user");
		expect(roles).toContain("assistant");
	}, 90000);

	/** 验证 compact RPC 返回摘要并持久化压缩条目。 */
	test("should handle manual compaction", async () => {
		await client.start();

		// First send a prompt to have messages to compact
		// 先发送提示，创建可压缩的消息。
		await client.promptAndWait("Say hello");

		// Compact
		// 调用手工压缩 RPC。
		/** compact 返回的摘要和压缩前 Token 数。 */
		const result = await client.compact();
		expect(result.summary).toBeDefined();
		expect(result.tokensBefore).toBeGreaterThan(0);

		// Wait for file writes
		// 等待压缩条目写入磁盘。
		await new Promise((resolve) => setTimeout(resolve, 200));

		// Verify compaction in session file
		// 从会话文件验证压缩条目。
		/** 会话根目录。 */
		const sessionsPath = join(sessionDir, "sessions");
		/** 当前 cwd 的目录列表。 */
		const sessionDirs = readdirSync(sessionsPath);
		/** 当前 cwd 的会话目录。 */
		const cwdSessionDir = join(sessionsPath, sessionDirs[0]);
		/** 目录中的 JSONL 会话文件。 */
		const sessionFiles = readdirSync(cwdSessionDir).filter((f) => f.endsWith(".jsonl"));
		/** 会话文件原文。 */
		const sessionContent = readFileSync(join(cwdSessionDir, sessionFiles[0]), "utf8");
		/** 逐行解析后的全部记录。 */
		const entries = sessionContent
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line));

		/** 文件中的压缩条目。 */
		const compactionEntries = entries.filter((e: { type: string }) => e.type === "compaction");
		expect(compactionEntries.length).toBe(1);
		expect(compactionEntries[0].summary).toBeDefined();
	}, 120000);

	/** 验证 bash RPC 返回输出、退出码和取消状态。 */
	test("should execute bash command", async () => {
		await client.start();

		/** echo 命令的 RPC 执行结果。 */
		const result = await client.bash("echo hello");
		expect(result.output.trim()).toBe("hello");
		expect(result.exitCode).toBe(0);
		expect(result.cancelled).toBe(false);
	}, 30000);

	/** 验证 bash 执行记录写入会话上下文。 */
	test("should add bash output to context", async () => {
		await client.start();

		// First send a prompt to initialize session
		// 先发送提示以初始化持久化会话。
		await client.promptAndWait("Say hi");

		// Run bash command
		// 执行带唯一标记的 Bash 命令。
		/** 用于在 JSONL 中定位本次输出的唯一值。 */
		const uniqueValue = `test-${Date.now()}`;
		await client.bash(`echo ${uniqueValue}`);

		// Wait for file writes
		// 等待 Bash 消息写入磁盘。
		await new Promise((resolve) => setTimeout(resolve, 200));

		// Verify bash message in session
		// 定位会话文件并筛选 bashExecution 消息。
		/** 会话根目录。 */
		const sessionsPath = join(sessionDir, "sessions");
		/** 当前 cwd 的目录列表。 */
		const sessionDirs = readdirSync(sessionsPath);
		/** 当前 cwd 的会话目录。 */
		const cwdSessionDir = join(sessionsPath, sessionDirs[0]);
		/** 目录中的 JSONL 会话文件。 */
		const sessionFiles = readdirSync(cwdSessionDir).filter((f) => f.endsWith(".jsonl"));
		/** 会话文件原文。 */
		const sessionContent = readFileSync(join(cwdSessionDir, sessionFiles[0]), "utf8");
		/** 逐行解析后的全部记录。 */
		const entries = sessionContent
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line));

		/** 文件中的 Bash 执行消息。 */
		const bashMessages = entries.filter(
			(e: { type: string; message?: { role: string } }) =>
				e.type === "message" && e.message?.role === "bashExecution",
		);
		expect(bashMessages.length).toBe(1);
		expect(bashMessages[0].message.output).toContain(uniqueValue);
	}, 90000);

	/** 验证 Bash 输出会进入下一次模型请求上下文。 */
	test("should include bash output in LLM context", async () => {
		await client.start();

		// Run a bash command with a unique value
		// 执行带唯一值的 Bash 命令。
		/** 模型应从上下文复述的唯一值。 */
		const uniqueValue = `unique-${Date.now()}`;
		await client.bash(`echo ${uniqueValue}`);

		// Ask the LLM what the output was
		// 询问模型刚才的精确命令输出。
		/** 询问命令输出期间收到的事件。 */
		const events = await client.promptAndWait(
			"What was the exact output of the echo command I just ran? Reply with just the value, nothing else.",
		);

		// Find assistant's response
		// 从事件中找到助手最终消息。
		/** 全部消息结束事件。 */
		const messageEndEvents = events.filter((e) => e.type === "message_end") as AgentEvent[];
		/** 助手角色的 message_end 事件。 */
		const assistantMessage = messageEndEvents.find(
			(e) => e.type === "message_end" && e.message?.role === "assistant",
		) as any;

		expect(assistantMessage).toBeDefined();

		/** 助手消息中的首个文本块。 */
		const textContent = assistantMessage.message.content.find((c: any) => c.type === "text");
		expect(textContent?.text).toContain(uniqueValue);
	}, 90000);

	/** 验证可设置并通过状态读取思考级别。 */
	test("should set and get thinking level", async () => {
		await client.start();

		// Set thinking level
		// 设置 high 思考级别。
		await client.setThinkingLevel("high");

		// Verify via state
		// 通过 get_state 验证设置。
		/** 设置后的 RPC 状态。 */
		const state = await client.getState();
		expect(state.thinkingLevel).toBe("high");
	}, 30000);

	/** 验证循环思考级别会改变当前值并持久到状态。 */
	test("should cycle thinking level", async () => {
		await client.start();

		// Get initial level
		// 读取循环前的初始级别。
		/** 循环前的状态。 */
		const initialState = await client.getState();
		/** 循环前的思考级别。 */
		const initialLevel = initialState.thinkingLevel;

		// Cycle
		// 执行一次级别循环。
		/** cycle_thinking_level 返回的新级别。 */
		const result = await client.cycleThinkingLevel();
		expect(result).toBeDefined();
		expect(result!.level).not.toBe(initialLevel);

		// Verify via state
		// 再通过状态确认新级别。
		/** 循环后的状态。 */
		const newState = await client.getState();
		expect(newState.thinkingLevel).toBe(result!.level);
	}, 30000);

	/** 验证可用思考级别列表包含当前值和循环结果。 */
	test("should get available thinking levels", async () => {
		await client.start();

		/** 当前模型可用的思考级别。 */
		const levels = await client.getAvailableThinkingLevels();
		expect(levels.length).toBeGreaterThan(0);

		// The current level reported by get_state must be in the available list
		// get_state 返回的当前级别必须在可用列表中。
		/** 当前 RPC 状态。 */
		const state = await client.getState();
		expect(levels).toContain(state.thinkingLevel);

		// cycle_thinking_level must only ever land on levels from get_available_thinking_levels
		// cycle_thinking_level 的结果必须来自可用列表。
		/** 循环前级别。 */
		const initialLevel = state.thinkingLevel;
		/** 循环操作结果。 */
		const cycled = await client.cycleThinkingLevel();
		if (cycled) {
			expect(levels).toContain(cycled.level);
			// distinct cycle step (unless only one level)
			// 除非只有一个级别，否则循环结果应与初始值不同。
			if (levels.length > 1) {
				expect(cycled.level).not.toBe(initialLevel);
			}
		}
	}, 30000);

	/** 验证可用模型都包含必要元数据。 */
	test("should get available models", async () => {
		await client.start();

		/** RPC 返回的全部可用模型。 */
		const models = await client.getAvailableModels();
		expect(models.length).toBeGreaterThan(0);

		// All models should have required fields
		// 每个模型都必须含提供商、ID、上下文窗口和推理标记。
		for (const model of models) {
			expect(model.provider).toBeDefined();
			expect(model.id).toBeDefined();
			expect(model.contextWindow).toBeGreaterThan(0);
			expect(typeof model.reasoning).toBe("boolean");
		}
	}, 30000);

	/** 验证会话统计包含文件、ID 和消息计数。 */
	test("should get session stats", async () => {
		await client.start();

		// Send a prompt first
		// 先发送提示创建会话统计数据。
		await client.promptAndWait("Hello");

		/** RPC 返回的会话统计。 */
		const stats = await client.getSessionStats();
		expect(stats.sessionFile).toBeDefined();
		expect(stats.sessionId).toBeDefined();
		expect(stats.userMessages).toBeGreaterThanOrEqual(1);
		expect(stats.assistantMessages).toBeGreaterThanOrEqual(1);
	}, 90000);

	/** 验证 newSession 清空消息并开始新会话。 */
	test("should create new session", async () => {
		await client.start();

		// Send a prompt
		// 先发送提示产生消息。
		await client.promptAndWait("Hello");

		// Verify messages exist
		// 确认旧会话已有消息。
		/** 新建会话前后的可变状态。 */
		let state = await client.getState();
		expect(state.messageCount).toBeGreaterThan(0);

		// New session
		// 请求创建新会话。
		await client.newSession();

		// Verify messages cleared
		// 验证新会话消息计数归零。
		state = await client.getState();
		expect(state.messageCount).toBe(0);
	}, 90000);

	/** 验证 exportHtml 创建真实 HTML 文件。 */
	test("should export to HTML", async () => {
		await client.start();

		// Send a prompt first
		// 先发送提示，让导出内容非空。
		await client.promptAndWait("Hello");

		// Export
		// 调用 HTML 导出 RPC。
		/** 导出文件路径结果。 */
		const result = await client.exportHtml();
		expect(result.path).toBeDefined();
		expect(result.path.endsWith(".html")).toBe(true);
		expect(existsSync(result.path)).toBe(true);
	}, 90000);

	/** 验证可读取最近助手文本，初始状态返回 undefined。 */
	test("should get last assistant text", async () => {
		await client.start();

		// Initially null
		// 初始没有助手消息。
		/** 最近助手文本，发送提示后会重新赋值。 */
		let text = await client.getLastAssistantText();
		expect(text).toBeUndefined();

		// Send prompt
		// 发送包含稳定标记的提示。
		await client.promptAndWait("Reply with just: test123");

		// Should have text now
		// 此时应能读取最近助手文本。
		text = await client.getLastAssistantText();
		expect(text).toContain("test123");
	}, 90000);

	/** 验证 getEntries 支持严格从游标之后返回条目。 */
	test("should get session entries with since cursor", async () => {
		await client.start();

		await client.promptAndWait("Reply with just 'ok'");

		/** 全量条目和当前叶节点。 */
		const { entries, leafId } = await client.getEntries();
		expect(entries.length).toBeGreaterThanOrEqual(2); // user + assistant
		/** entry 是 RPC 返回的当前会话条目；每项都应带持久化生成的标识。 */
		for (const entry of entries) {
			expect(entry.id).toBeDefined();
		}
		expect(leafId).toBe(entries[entries.length - 1].id);

		// since cursor returns only entries strictly after the given id
		// since 游标只返回给定 ID 之后的条目。
		/** 从首条记录之后读取的增量结果。 */
		const since = await client.getEntries(entries[0].id);
		expect(since.entries.map((e) => e.id)).toEqual(entries.slice(1).map((e) => e.id));
		expect(since.leafId).toBe(leafId);

		// unknown since id is an error response
		// 不存在的游标 ID 应返回错误。
		await expect(client.getEntries("nonexistent-id")).rejects.toThrow("Entry not found");
	}, 90000);

	/** 验证 getTree 的单链结构与 getEntries 顺序一致。 */
	test("should get session tree", async () => {
		await client.start();

		await client.promptAndWait("Reply with just 'ok'");

		/** 线性会话的全量条目和叶节点。 */
		const { entries, leafId } = await client.getEntries();
		/** 树结构及其叶节点。 */
		const { tree, leafId: treeLeafId } = await client.getTree();
		expect(treeLeafId).toBe(leafId);

		// Single root whose chain matches the entries
		// 树应只有一个根，且单链顺序与 entries 一致。
		expect(tree.length).toBe(1);
		/** 沿单子节点链收集的条目 ID。 */
		const chainIds: string[] = [];
		/** 当前正在遍历的一层节点。 */
		let nodes = tree;
		while (nodes.length === 1) {
			chainIds.push(nodes[0].entry.id);
			nodes = nodes[0].children;
		}
		expect(nodes.length).toBe(0);
		expect(chainIds).toEqual(entries.map((e) => e.id));
	}, 90000);

	/** 验证压缩采用追加写入，不删除压缩前条目。 */
	test("should retain pre-compaction entries in get_entries", async () => {
		await client.start();

		await client.promptAndWait("Reply with just 'ok'");
		/** 压缩前的条目快照。 */
		const before = await client.getEntries();

		await client.compact();

		/** 压缩后的条目快照。 */
		const after = await client.getEntries();
		// Append-only: pre-compaction entries are still there, in the same order
		// 追加写语义：压缩前条目仍存在且顺序不变。
		expect(after.entries.slice(0, before.entries.length).map((e) => e.id)).toEqual(before.entries.map((e) => e.id));
		expect(after.entries.some((e) => e.type === "compaction")).toBe(true);
	}, 120000);

	/** 验证设置会话名称会更新状态并写入 session_info。 */
	test("should set and get session name", async () => {
		await client.start();

		// Initially undefined
		// 初始会话名称应为 undefined。
		/** 设置名称前后的可变状态。 */
		let state = await client.getState();
		expect(state.sessionName).toBeUndefined();

		// Send a prompt first - session files are only written after first assistant message
		// 先发送提示；首次助手消息后才会写会话文件。
		await client.promptAndWait("Reply with just 'ok'");

		// Set name
		// 设置测试会话名称。
		await client.setSessionName("my-test-session");

		// Verify via state
		// 通过状态验证名称。
		state = await client.getState();
		expect(state.sessionName).toBe("my-test-session");

		// Wait for file writes
		// 等待 session_info 写入磁盘。
		await new Promise((resolve) => setTimeout(resolve, 200));

		// Verify session_info entry in session file
		// 从会话文件验证 session_info 条目。
		/** 会话根目录。 */
		const sessionsPath = join(sessionDir, "sessions");
		/** 当前 cwd 的目录列表。 */
		const sessionDirs = readdirSync(sessionsPath);
		/** 当前 cwd 的会话目录。 */
		const cwdSessionDir = join(sessionsPath, sessionDirs[0]);
		/** 目录中的 JSONL 文件。 */
		const sessionFiles = readdirSync(cwdSessionDir).filter((f) => f.endsWith(".jsonl"));
		/** 会话文件原文。 */
		const sessionContent = readFileSync(join(cwdSessionDir, sessionFiles[0]), "utf8");
		/** 逐行解析后的全部记录。 */
		const entries = sessionContent
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line));

		/** 会话文件中的 session_info 条目。 */
		const sessionInfoEntries = entries.filter((e: { type: string }) => e.type === "session_info");
		expect(sessionInfoEntries.length).toBe(1);
		expect(sessionInfoEntries[0].name).toBe("my-test-session");
	}, 60000);
});
/**
 * 文件职责：通过启动真实 RPC 子进程端到端验证状态、会话持久化、压缩、Bash、模型设置、树查询和导出接口。
 * 技术维度：使用 Vitest 长超时、RpcClient、临时会话目录、真实提供商凭据和 JSONL 磁盘检查覆盖进程边界。
 * 产品维度：保障外部编辑器或自动化客户端可稳定控制 Pi，并从 RPC 获得与交互模式一致的会话能力。
 * 逻辑维度：每个用例启动独立客户端，依次测试查询、消息与 Bash 持久化、设置、会话管理、条目/树和元数据。
 * 关键边界：需要 Anthropic 凭据和已构建 dist/cli.js；包含真实模型与 Shell 调用；单用例超时最长两分钟。
 * 新手阅读建议：先看 beforeEach 的 RpcClient 配置和 getState，再看 promptAndWait/文件检查，最后读 entries/tree 游标语义。
 */
