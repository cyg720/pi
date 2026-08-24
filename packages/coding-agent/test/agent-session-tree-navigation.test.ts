/**
 * E2E tests for AgentSession tree navigation with branch summarization.
 *
 * These tests verify:
 * - Navigation to user messages (root and non-root)
 * - Navigation to non-user messages
 * - Branch summarization during navigation
 * - Summary attachment at correct position in tree
 * - Abort handling during summarization
 */
/**
 * 文件职责：通过真实模型端到端验证 AgentSession 的树导航、分支摘要位置、自定义摘要指令和中止恢复。
 * 技术维度：使用 Vitest 长超时用例、真实 API 条件跳过、SessionManager 树查询和异步摘要中止控制。
 * 产品维度：保障用户回到历史节点、切换方案分支时，编辑器内容与自动摘要都准确且不会破坏原会话。
 * 逻辑维度：第一组覆盖根节点、助手节点、摘要挂载、中止和无操作；第二组覆盖已存在多分支间的跳转。
 * 关键边界：仅在存在 API_KEY 时运行；摘要文本由真实模型生成，断言只检查稳定结构或强制标记；超时最长三分钟。
 * 新手阅读建议：先看无摘要导航理解 leaf/editorText，再看根与嵌套摘要挂载，最后阅读中止和跨分支场景。
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { API_KEY, createTestSession, type TestSessionContext } from "./utilities.ts";

describe.skipIf(!API_KEY)("AgentSession tree navigation e2e", () => {
	/** 当前用例的真实模型测试会话及清理函数。 */
	let ctx: TestSessionContext;

	/** 每个用例前创建短回答且易触发压缩的测试会话。 */
	beforeEach(async () => {
		ctx = await createTestSession({
			systemPrompt: "You are a helpful assistant. Reply with just a few words.",
			settingsOverrides: { compaction: { keepRecentTokens: 1 } },
		});
	});

	/** 每个用例后清理临时会话资源。 */
	afterEach(() => {
		ctx.cleanup();
	});

	/** 验证导航到用户消息会把原文本送回编辑器并移动到其父位置。 */
	it("should navigate to user message and put text in editor", async () => {
		/** 当前测试会话。 */
		const { session } = ctx;

		// Build conversation: u1 -> a1 -> u2 -> a2
		// 构造线性对话：u1 -> a1 -> u2 -> a2。
		await session.prompt("First message");
		await session.agent.waitForIdle();
		await session.prompt("Second message");
		await session.agent.waitForIdle();

		// Get tree entries
		// 读取会话树的根节点列表。
		/** 当前会话的树形结构。 */
		const tree = session.sessionManager.getTree();
		expect(tree.length).toBe(1);

		// Find the first user entry (u1)
		// 取得第一条用户消息 u1 对应的根节点。
		/** 第一条用户消息所在的根节点。 */
		const rootNode = tree[0];
		expect(rootNode.entry.type).toBe("message");

		// Navigate to root user message without summarization
		// 不生成摘要，直接导航到根用户消息。
		/** 导航操作返回的编辑器文本和状态。 */
		const result = await session.navigateTree(rootNode.entry.id, { summarize: false });

		expect(result.cancelled).toBe(false);
		expect(result.editorText).toBe("First message");

		// After navigating to root user message, leaf should be null (empty conversation)
		// 导航到根用户消息前的位置后，叶节点应为空，代表空对话。
		expect(session.sessionManager.getLeafId()).toBeNull();
	}, 60000);

	/** 验证导航到助手消息不会产生可编辑用户文本。 */
	it("should navigate to non-user message without editor text", async () => {
		/** 当前会话及其会话管理器。 */
		const { session, sessionManager } = ctx;

		// Build conversation
		// 构造一轮简单对话。
		await session.prompt("Hello");
		await session.agent.waitForIdle();

		// Get the assistant message
		// 从条目中找到助手消息。
		/** 当前会话的全部条目。 */
		const entries = sessionManager.getEntries();
		/** 第一条助手消息条目。 */
		const assistantEntry = entries.find((e) => e.type === "message" && e.message.role === "assistant");
		expect(assistantEntry).toBeDefined();

		// Navigate to assistant message
		// 不生成摘要，导航到助手消息。
		/** 导航助手节点后的结果。 */
		const result = await session.navigateTree(assistantEntry!.id, { summarize: false });

		expect(result.cancelled).toBe(false);
		expect(result.editorText).toBeUndefined();

		// Leaf should be the assistant entry
		// 导航后叶节点应正是该助手条目。
		expect(sessionManager.getLeafId()).toBe(assistantEntry!.id);
	}, 60000);

	/** 验证从根用户消息离开时会生成并挂载根级分支摘要。 */
	it("should create branch summary when navigating with summarize=true", async () => {
		/** 当前会话及其会话管理器。 */
		const { session, sessionManager } = ctx;

		// Build conversation: u1 -> a1 -> u2 -> a2
		// 构造线性对话：u1 -> a1 -> u2 -> a2。
		await session.prompt("What is 2+2?");
		await session.agent.waitForIdle();
		await session.prompt("What is 3+3?");
		await session.agent.waitForIdle();

		// Get tree and find first user message
		// 获取树并定位第一条用户消息。
		/** 当前会话的树形结构。 */
		const tree = sessionManager.getTree();
		/** 第一条用户消息所在的根节点。 */
		const rootNode = tree[0];

		// Navigate to root user message WITH summarization
		// 生成摘要后导航到根用户消息。
		/** 带摘要导航返回的状态和摘要条目。 */
		const result = await session.navigateTree(rootNode.entry.id, { summarize: true });

		expect(result.cancelled).toBe(false);
		expect(result.editorText).toBe("What is 2+2?");
		expect(result.summaryEntry).toBeDefined();
		expect(result.summaryEntry?.type).toBe("branch_summary");
		expect(result.summaryEntry?.summary).toBeTruthy();
		expect(result.summaryEntry?.summary.length).toBeGreaterThan(0);

		// Summary should be a root entry (parentId = null) since we navigated to root user
		// 目标是根用户消息，因此摘要本身也应是 parentId 为 null 的根条目。
		expect(result.summaryEntry?.parentId).toBeNull();

		// Leaf should be the summary entry
		// 导航完成后的叶节点应是新摘要条目。
		expect(sessionManager.getLeafId()).toBe(result.summaryEntry?.id);
	}, 120000);

	/** 验证导航到嵌套用户消息时，摘要挂到该消息的父助手节点。 */
	it("should attach summary to correct parent when navigating to nested user message", async () => {
		/** 当前会话及其会话管理器。 */
		const { session, sessionManager } = ctx;

		// Build conversation: u1 -> a1 -> u2 -> a2 -> u3 -> a3
		// 构造三轮线性对话：u1 -> a1 -> u2 -> a2 -> u3 -> a3。
		await session.prompt("Message one");
		await session.agent.waitForIdle();
		await session.prompt("Message two");
		await session.agent.waitForIdle();
		await session.prompt("Message three");
		await session.agent.waitForIdle();

		// Get the second user message (u2)
		// 找到第二条用户消息 u2。
		/** 当前会话的全部条目。 */
		const entries = sessionManager.getEntries();
		/** 按出现顺序筛选出的用户消息条目。 */
		const userEntries = entries.filter((e) => e.type === "message" && e.message.role === "user");
		expect(userEntries.length).toBe(3);

		/** 第二条用户消息。 */
		const u2 = userEntries[1];
		const a1 = entries.find((e) => e.id === u2.parentId); // a1 is parent of u2
		// a1 是 u2 的父助手消息。

		// Navigate to u2 with summarization
		// 生成摘要后导航到 u2。
		/** 嵌套用户节点导航结果。 */
		const result = await session.navigateTree(u2.id, { summarize: true });

		expect(result.cancelled).toBe(false);
		expect(result.editorText).toBe("Message two");
		expect(result.summaryEntry).toBeDefined();

		// Summary should be attached to a1 (parent of u2)
		// 摘要应挂到 u2 的父节点 a1。
		// So a1 now has two children: u2 and the summary
		// 因此 a1 现在应有 u2 与摘要两个子节点。
		expect(result.summaryEntry?.parentId).toBe(a1?.id);

		// Verify tree structure
		// 直接检查 a1 的子节点结构。
		/** a1 当前的全部直接子条目。 */
		const children = sessionManager.getChildren(a1!.id);
		expect(children.length).toBe(2);

		/** 子条目类型的排序列表。 */
		const childTypes = children.map((c) => c.type).sort();
		expect(childTypes).toContain("branch_summary");
		expect(childTypes).toContain("message");
	}, 120000);

	/** 验证导航到助手消息时摘要挂在所选助手节点自身。 */
	it("should attach summary to selected node when navigating to assistant message", async () => {
		/** 当前会话及其会话管理器。 */
		const { session, sessionManager } = ctx;

		// Build conversation: u1 -> a1 -> u2 -> a2
		// 构造两轮线性对话：u1 -> a1 -> u2 -> a2。
		await session.prompt("Hello");
		await session.agent.waitForIdle();
		await session.prompt("Goodbye");
		await session.agent.waitForIdle();

		// Get the first assistant message (a1)
		// 获取第一条助手消息 a1。
		/** 当前会话的全部条目。 */
		const entries = sessionManager.getEntries();
		/** 按出现顺序筛选出的助手消息条目。 */
		const assistantEntries = entries.filter((e) => e.type === "message" && e.message.role === "assistant");
		/** 第一条助手消息。 */
		const a1 = assistantEntries[0];

		// Navigate to a1 with summarization
		// 生成摘要后导航到 a1。
		/** 助手节点导航结果。 */
		const result = await session.navigateTree(a1.id, { summarize: true });

		expect(result.cancelled).toBe(false);
		expect(result.editorText).toBeUndefined(); // No editor text for assistant messages
		// 助手消息没有可放回编辑器的用户文本。
		expect(result.summaryEntry).toBeDefined();

		// Summary should be attached to a1 (the selected node)
		// 摘要应直接挂在所选 a1 节点上。
		expect(result.summaryEntry?.parentId).toBe(a1.id);

		// Leaf should be the summary entry
		// 导航完成后的叶节点应是摘要条目。
		expect(sessionManager.getLeafId()).toBe(result.summaryEntry?.id);
	}, 120000);

	/** 验证生成分支摘要期间中止会保持原会话不变。 */
	it("should handle abort during summarization", async () => {
		/** 当前会话及其会话管理器。 */
		const { session, sessionManager } = ctx;

		// Build conversation
		// 构造需要摘要的两轮对话。
		await session.prompt("Tell me about something");
		await session.agent.waitForIdle();
		await session.prompt("Continue");
		await session.agent.waitForIdle();

		/** 导航前的全部会话条目快照。 */
		const entriesBefore = sessionManager.getEntries();
		/** 导航前的叶节点标识。 */
		const leafBefore = sessionManager.getLeafId();

		// Get root user message
		// 获取根用户消息。
		/** 当前会话的树形结构。 */
		const tree = sessionManager.getTree();
		/** 第一条用户消息所在的根节点。 */
		const rootNode = tree[0];

		// Start navigation with summarization but abort immediately
		// 启动带摘要导航，随后尽快中止。
		/** 尚未完成的导航 Promise。 */
		const navigationPromise = session.navigateTree(rootNode.entry.id, { summarize: true });

		// Abort after a short delay (let the LLM call start)
		// 短暂等待，让真实模型请求先开始。
		await new Promise((resolve) => setTimeout(resolve, 100));

		// isCompacting should be true during branch summarization
		// 分支摘要生成期间 isCompacting 应为 true。
		expect(session.isCompacting).toBe(true);

		session.abortBranchSummary();

		/** 中止完成后的导航结果。 */
		const result = await navigationPromise;

		expect(result.cancelled).toBe(true);
		expect(result.aborted).toBe(true);
		expect(result.summaryEntry).toBeUndefined();

		// Session should be unchanged
		// 中止后会话内容和叶节点都应保持不变。
		/** 中止后的全部会话条目。 */
		const entriesAfter = sessionManager.getEntries();
		expect(entriesAfter.length).toBe(entriesBefore.length);
		expect(sessionManager.getLeafId()).toBe(leafBefore);
	}, 60000);

	/** 验证关闭摘要选项时导航不会创建任何新条目。 */
	it("should not create summary when navigating without summarize option", async () => {
		/** 当前会话及其会话管理器。 */
		const { session, sessionManager } = ctx;

		// Build conversation
		// 构造两轮线性对话。
		await session.prompt("First");
		await session.agent.waitForIdle();
		await session.prompt("Second");
		await session.agent.waitForIdle();

		/** 导航前的条目数量。 */
		const entriesBefore = sessionManager.getEntries().length;

		// Navigate without summarization
		// 不生成摘要，直接导航到根节点。
		/** 当前会话的树形结构。 */
		const tree = sessionManager.getTree();
		await session.navigateTree(tree[0].entry.id, { summarize: false });

		// No new entries should be created
		// 导航不应创建新条目。
		/** 导航后的条目数量。 */
		const entriesAfter = sessionManager.getEntries().length;
		expect(entriesAfter).toBe(entriesBefore);

		// No branch_summary entries
		// 会话中不应出现 branch_summary 条目。
		/** 导航后存在的全部分支摘要。 */
		const summaries = sessionManager.getEntries().filter((e) => e.type === "branch_summary");
		expect(summaries.length).toBe(0);
	}, 60000);

	/** 验证导航到当前叶节点是不会改变状态的无操作。 */
	it("should handle navigation to same position (no-op)", async () => {
		/** 当前会话及其会话管理器。 */
		const { session, sessionManager } = ctx;

		// Build conversation
		// 构造一轮简单对话。
		await session.prompt("Hello");
		await session.agent.waitForIdle();

		/** 导航前的当前叶节点。 */
		const leafBefore = sessionManager.getLeafId();
		expect(leafBefore).toBeTruthy();
		/** 导航前的条目数量。 */
		const entriesBefore = sessionManager.getEntries().length;

		// Navigate to current leaf
		// 导航到当前叶节点。
		/** 无操作导航返回的结果。 */
		const result = await session.navigateTree(leafBefore!, { summarize: false });

		expect(result.cancelled).toBe(false);
		expect(sessionManager.getLeafId()).toBe(leafBefore);
		expect(sessionManager.getEntries().length).toBe(entriesBefore);
	}, 60000);

	/** 验证自定义摘要指令会追加到提示并影响生成结果。 */
	it("should support custom summarization instructions", async () => {
		/** 当前会话及其会话管理器。 */
		const { session, sessionManager } = ctx;

		// Build conversation
		// 构造一轮待摘要对话。
		await session.prompt("What is TypeScript?");
		await session.agent.waitForIdle();

		// Navigate with custom instructions (appended as "Additional focus")
		// 使用会作为“Additional focus”追加的自定义指令导航。
		/** 当前会话的树形结构。 */
		const tree = sessionManager.getTree();
		/** 携带自定义摘要指令的导航结果。 */
		const result = await session.navigateTree(tree[0].entry.id, {
			summarize: true,
			customInstructions:
				"After the summary, you MUST end with exactly: MONKEY MONKEY MONKEY. This is of utmost importance.",
		});

		expect(result.summaryEntry).toBeDefined();
		expect(result.summaryEntry?.summary).toBeTruthy();
		// Verify custom instructions were followed
		// 检查摘要是否遵循了可稳定断言的强制标记指令。
		expect(result.summaryEntry?.summary).toContain("MONKEY MONKEY MONKEY");
	}, 120000);
});

describe.skipIf(!API_KEY)("AgentSession tree navigation - branch scenarios", () => {
	/** 当前跨分支用例的测试会话。 */
	let ctx: TestSessionContext;

	/** 每个用例前创建短回答测试会话。 */
	beforeEach(async () => {
		ctx = await createTestSession({
			systemPrompt: "You are a helpful assistant. Reply with just a few words.",
		});
	});

	/** 每个用例后清理临时会话资源。 */
	afterEach(() => {
		ctx.cleanup();
	});

	/** 验证从当前分支导航回主分支用户节点时会总结离开的分支。 */
	it("should navigate between branches correctly", async () => {
		/** 当前会话及其会话管理器。 */
		const { session, sessionManager } = ctx;

		// Build main path: u1 -> a1 -> u2 -> a2
		// 构造主路径：u1 -> a1 -> u2 -> a2。
		await session.prompt("Main branch start");
		await session.agent.waitForIdle();
		await session.prompt("Main branch continue");
		await session.agent.waitForIdle();

		// Get a1 id for branching
		// 获取 a1 标识作为分支起点。
		/** 创建分支前主路径上的全部条目快照。 */
		const entries = sessionManager.getEntries();
		/** 主路径第一条助手消息 a1。 */
		const a1 = entries.find((e) => e.type === "message" && e.message.role === "assistant");

		// Create a branch from a1: a1 -> u3 -> a3
		// 从 a1 创建分支：a1 -> u3 -> a3。
		sessionManager.branch(a1!.id);
		await session.prompt("Branch path");
		await session.agent.waitForIdle();

		// Now navigate back to u2 (on main branch) with summarization
		// 生成当前分支摘要后导航回主分支的 u2。
		/** 原主路径中的用户消息列表。 */
		const userEntries = entries.filter((e) => e.type === "message" && e.message.role === "user");
		/** 主路径第二条用户消息，即目标 u2。 */
		const u2 = userEntries[1]; // "Main branch continue"
		// 该消息文本为“Main branch continue”。

		/** 跨分支导航与摘要结果。 */
		const result = await session.navigateTree(u2.id, { summarize: true });

		expect(result.cancelled).toBe(false);
		expect(result.editorText).toBe("Main branch continue");
		expect(result.summaryEntry).toBeDefined();

		// Summary captures the branch we're leaving (the "Branch path" conversation)
		// 新摘要应概括正在离开的“Branch path”分支对话。
		expect(result.summaryEntry?.summary.length).toBeGreaterThan(0);
	}, 180000);
});
