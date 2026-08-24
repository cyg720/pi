/**
 * 文件职责：使用真实模型端到端验证 AgentSession 手动压缩、压缩后续聊、持久化、内存模式和事件发射。
 * 技术维度：使用 Vitest、真实 Anthropic 流、Agent/AgentSession、临时目录和会话管理器执行长超时集成测试。
 * 产品维度：保障长对话可生成摘要并继续使用，且磁盘与 `--no-session` 模式都保留正确压缩历史。
 * 逻辑维度：统一创建最小会话并记录事件，再覆盖压缩结果、可用性、文件条目、内存条目和事件顺序。
 * 关键边界：需要 API_KEY，会产生真实网络请求和费用；每个用例最长三分钟；临时会话必须清理。
 * 新手阅读建议：先看 createSession 的 Agent 与 SessionManager 组装，再比较 compact 前后的 messages/entries/events。
 */
import { createModelRegistry, getModelRuntime } from "./model-runtime-test-utils.ts";
/**
 * E2E tests for AgentSession compaction behavior.
 *
 * These tests use real LLM calls (no mocking) to verify:
 * - Manual compaction works correctly
 * - Session persistence during compaction
 * - Compaction entry is saved to session file
 */
/** 中文说明：这些用例不使用模拟模型，验证手动压缩、会话持久化以及 compaction 条目实际写入。 */

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Agent } from "@earendil-works/pi-agent-core";
import { getModel, streamSimple } from "@earendil-works/pi-ai/compat";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AgentSession, type AgentSessionEvent } from "../src/core/agent-session.ts";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";
import { createCodingTools } from "../src/index.ts";
import { API_KEY, createTestResourceLoader } from "./utilities.ts";

// 有真实 API_KEY 时才运行压缩端到端测试。
describe.skipIf(!API_KEY)("AgentSession compaction e2e", () => {
	// session 是当前用例的活动代理会话。
	let session: AgentSession;
	// tempDir 保存会话、设置和认证临时文件。
	let tempDir: string;
	// sessionManager 根据用例选择磁盘或内存模式。
	let sessionManager: SessionManager;
	// events 按发生顺序记录全部 AgentSessionEvent。
	let events: AgentSessionEvent[];

	// 每个用例前创建临时目录并清空事件列表。
	beforeEach(async () => {
		// Create temp directory for session files
		// 创建保存会话文件的临时目录。
		tempDir = join(tmpdir(), `pi-compaction-test-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });

		// Track events
		// 初始化当前用例的事件记录数组。
		events = [];
	});

	// 每个用例后释放会话并删除临时文件。
	afterEach(async () => {
		if (session) {
			session.dispose();
		}
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true });
		}
	});

	/**
	 * 创建绑定真实模型与最小压缩设置的 AgentSession。
	 * @param inMemory 为 true 时使用不落盘会话管理器。
	 * @returns 活动会话；例如 `await createSession(true)`。
	 */
	async function createSession(inMemory = false) {
		// model 是真实压缩请求使用的 Claude Sonnet 4.5。
		const model = getModel("anthropic", "claude-sonnet-4-5")!;
		// agent 使用真实 streamSimple 和编码工具创建。
		const agent = new Agent({
			getApiKey: () => API_KEY,
			streamFn: streamSimple,
			initialState: {
				model,
				systemPrompt: "You are a helpful assistant. Be concise.",
				tools: createCodingTools(process.cwd()),
			},
		});

		sessionManager = inMemory ? SessionManager.inMemory() : SessionManager.create(tempDir);
		// settingsManager 保存测试专用压缩阈值。
		const settingsManager = SettingsManager.create(tempDir, tempDir);
		// Use minimal keepRecentTokens so small test conversations have something to summarize
		// 把保留令牌降到 1，使短对话也有内容可摘要。
		settingsManager.applyOverrides({ compaction: { keepRecentTokens: 1 } });
		// authStorage 是临时认证仓库。
		const authStorage = AuthStorage.create(join(tempDir, "auth.json"));
		// modelRegistry 为会话提供模型与认证查询。
		const modelRegistry = await createModelRegistry(authStorage);

		session = new AgentSession({
			agent,
			sessionManager,
			settingsManager,
			cwd: tempDir,
			modelRuntime: getModelRuntime(modelRegistry),
			resourceLoader: createTestResourceLoader(),
		});

		// Subscribe to track events
		// 订阅会话事件并按顺序记录。
		session.subscribe((event) => {
			events.push(event);
		});

		return session;
	}

	// compact() 应生成非空摘要并用压缩摘要消息替换旧历史。
	it("should trigger manual compaction via compact()", async () => {
		await createSession();

		// Send a few prompts to build up history
		// 发送两轮短提示以形成可压缩历史。
		await session.prompt("What is 2+2? Reply with just the number.");
		await session.agent.waitForIdle();

		await session.prompt("What is 3+3? Reply with just the number.");
		await session.agent.waitForIdle();

		// Manually compact
		// result 是手动压缩返回的摘要和令牌统计。
		const result = await session.compact();

		expect(result.summary).toBeDefined();
		expect(result.summary.length).toBeGreaterThan(0);
		expect(result.tokensBefore).toBeGreaterThan(0);

		// Verify messages were compacted (should have summary + recent)
		// messages 是压缩后的活动上下文，应包含摘要和保留消息。
		const messages = session.messages;
		expect(messages.length).toBeGreaterThan(0);

		// First message should be the summary (a user message with summary content)
		// firstMsg 应是压缩器插入的 compactionSummary。
		const firstMsg = messages[0];
		expect(firstMsg.role).toBe("compactionSummary");
	}, 120000);

	// 压缩后会话仍应能继续发出真实提示并收到助手响应。
	it("should maintain valid session state after compaction", async () => {
		await createSession();

		// Build up history
		await session.prompt("What is the capital of France? One word answer.");
		await session.agent.waitForIdle();

		await session.prompt("What is the capital of Germany? One word answer.");
		await session.agent.waitForIdle();

		// Compact
		await session.compact();

		// Session should still be usable
		await session.prompt("What is the capital of Italy? One word answer.");
		await session.agent.waitForIdle();

		// Should have messages after compaction
		expect(session.messages.length).toBeGreaterThan(0);

		// The agent should have responded
		// assistantMessages 是压缩后续聊产生并保留的助手消息。
		const assistantMessages = session.messages.filter((m) => m.role === "assistant");
		expect(assistantMessages.length).toBeGreaterThan(0);
	}, 180000);

	// 磁盘会话压缩应追加一个完整 compaction 条目。
	it("should persist compaction to session file", async () => {
		await createSession();

		await session.prompt("Say hello");
		await session.agent.waitForIdle();

		await session.prompt("Say goodbye");
		await session.agent.waitForIdle();

		// Compact
		await session.compact();

		// Load entries from session manager
		// entries 是会话管理器当前持久化条目列表。
		const entries = sessionManager.getEntries();

		// Should have a compaction entry
		// compactionEntries 只保留压缩类型条目。
		const compactionEntries = entries.filter((e) => e.type === "compaction");
		expect(compactionEntries.length).toBe(1);

		// compaction 是唯一压缩记录，类型收窄后检查摘要元数据。
		const compaction = compactionEntries[0];
		expect(compaction.type).toBe("compaction");
		if (compaction.type === "compaction") {
			expect(compaction.summary.length).toBeGreaterThan(0);
			expect(typeof compaction.firstKeptEntryId).toBe("string");
			expect(compaction.tokensBefore).toBeGreaterThan(0);
		}
	}, 120000);

	// 内存模式也应执行压缩并保存内存条目，而不依赖文件路径。
	it("should work with --no-session mode (in-memory only)", async () => {
		await createSession(true); // in-memory mode

		// Send prompts
		await session.prompt("What is 2+2? Reply with just the number.");
		await session.agent.waitForIdle();

		await session.prompt("What is 3+3? Reply with just the number.");
		await session.agent.waitForIdle();

		// Compact should work even without file persistence
		// result 是纯内存会话的压缩结果。
		const result = await session.compact();

		expect(result.summary).toBeDefined();
		expect(result.summary.length).toBeGreaterThan(0);

		// In-memory entries should have the compaction
		// entries 是内存管理器保存的条目。
		const entries = sessionManager.getEntries();
		// compactionEntries 是其中的压缩记录。
		const compactionEntries = entries.filter((e) => e.type === "compaction");
		expect(compactionEntries.length).toBe(1);
	}, 120000);

	// 手动压缩应按顺序发出 compaction_start 和 compaction_end，并保留普通消息事件。
	it("should emit compaction events during manual compaction", async () => {
		await createSession();

		// Build some history
		await session.prompt("Say hello");
		await session.agent.waitForIdle();

		// Manually trigger compaction and check events
		await session.compact();

		// compactionEvents 只筛选压缩生命周期事件。
		const compactionEvents = events.filter((e) => e.type === "compaction_start" || e.type === "compaction_end");
		expect(compactionEvents).toHaveLength(2);
		expect(compactionEvents[0]).toEqual({ type: "compaction_start", reason: "manual" });
		expect(compactionEvents[1]).toMatchObject({
			type: "compaction_end",
			reason: "manual",
			aborted: false,
			willRetry: false,
		});

		// Regular events should have been emitted
		// messageEndEvents 验证正常模型消息事件没有因压缩丢失。
		const messageEndEvents = events.filter((e) => e.type === "message_end");
		expect(messageEndEvents.length).toBeGreaterThan(0);
	}, 120000);
});
