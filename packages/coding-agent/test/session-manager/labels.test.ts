/**
 * 文件职责：验证 SessionManager 标签的写入、覆盖、清除、树节点投影和分支保留规则。
 * 技术维度：使用 Vitest 与内存 SessionManager 构造消息、标签、模型变更和会话树。
 * 产品维度：保证用户用检查点等标签组织会话时，分支操作和上下文构建不会错配或泄漏标签记录。
 * 逻辑维度：逐项覆盖基本读写、最后写入优先、树结构、分支复制、路径裁剪和错误输入。
 * 关键边界：标签记录不是模型消息，不应进入 LLM 上下文；分支只保留目标路径上的标签。
 * 新手阅读建议：先看首个基本读写用例，再看树节点与 createBranchedSession 用例，最后看边界断言。
 */
import { describe, expect, it } from "vitest";
import { type LabelEntry, SessionManager } from "../../src/core/session-manager.ts";

/** 覆盖标签从追加记录到会话树和分支会话的完整行为。 */
describe("SessionManager labels", () => {
	it("sets and gets labels", () => {
		/** 本用例独立使用的内存会话。 */
		const session = SessionManager.inMemory();

		/** 被添加标签的用户消息标识。 */
		const msgId = session.appendMessage({ role: "user", content: "hello", timestamp: 1 });

		// No label initially
		// 新消息初始没有标签。
		expect(session.getLabel(msgId)).toBeUndefined();

		// Set a label
		// 追加标签变更并保存该标签记录的标识。
		/** checkpoint 标签记录的标识。 */
		const labelId = session.appendLabelChange(msgId, "checkpoint");
		expect(session.getLabel(msgId)).toBe("checkpoint");

		// Label entry should be in entries
		// 标签变更本身也应存在于会话条目列表。
		/** 会话中的全部底层条目。 */
		const entries = session.getEntries();
		/** 从条目列表中找到的标签记录。 */
		const labelEntry = entries.find((e) => e.type === "label") as LabelEntry;
		expect(labelEntry).toBeDefined();
		expect(labelEntry.id).toBe(labelId);
		expect(labelEntry.targetId).toBe(msgId);
		expect(labelEntry.label).toBe("checkpoint");
	});

	it("clears labels with undefined", () => {
		/** 清除标签场景的内存会话。 */
		const session = SessionManager.inMemory();

		/** 先设置再清除标签的消息标识。 */
		const msgId = session.appendMessage({ role: "user", content: "hello", timestamp: 1 });

		session.appendLabelChange(msgId, "checkpoint");
		expect(session.getLabel(msgId)).toBe("checkpoint");

		// Clear the label
		// undefined 表示明确清除当前标签。
		session.appendLabelChange(msgId, undefined);
		expect(session.getLabel(msgId)).toBeUndefined();
	});

	it("last label wins", () => {
		/** 多次修改同一标签场景的内存会话。 */
		const session = SessionManager.inMemory();

		/** 连续接收三个标签变更的消息标识。 */
		const msgId = session.appendMessage({ role: "user", content: "hello", timestamp: 1 });

		session.appendLabelChange(msgId, "first");
		session.appendLabelChange(msgId, "second");
		/** 最后一次标签变更记录的标识。 */
		const lastLabelId = session.appendLabelChange(msgId, "third");

		expect(session.getLabel(msgId)).toBe("third");

		/** 包含三次标签变更的全部会话条目。 */
		const entries = session.getEntries();
		/** 最后生效的标签记录。 */
		const lastLabelEntry = entries.find((e) => e.id === lastLabelId) as LabelEntry;
		/** 投影后的会话树。 */
		const tree = session.getTree();
		/** 树中对应原消息的节点。 */
		const msgNode = tree.find((n) => n.entry.id === msgId);
		expect(msgNode?.labelTimestamp).toBe(lastLabelEntry.timestamp);
	});

	it("labels are included in tree nodes", () => {
		/** 树节点标签投影场景的内存会话。 */
		const session = SessionManager.inMemory();

		/** 父级用户消息标识。 */
		const msg1Id = session.appendMessage({ role: "user", content: "hello", timestamp: 1 });
		/** 子级助手消息标识。 */
		const msg2Id = session.appendMessage({
			role: "assistant",
			content: [{ type: "text", text: "hi" }],
			api: "anthropic-messages",
			provider: "anthropic",
			model: "test",
			usage: {
				input: 1,
				output: 1,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 2,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "stop",
			timestamp: 2,
		});

		/** 父消息标签记录标识。 */
		const msg1LabelId = session.appendLabelChange(msg1Id, "start");
		/** 子消息标签记录标识。 */
		const msg2LabelId = session.appendLabelChange(msg2Id, "response");

		/** 含消息和标签的原始条目列表。 */
		const entries = session.getEntries();
		/** 父消息的标签记录。 */
		const msg1LabelEntry = entries.find((e) => e.id === msg1LabelId) as LabelEntry;
		/** 子消息的标签记录。 */
		const msg2LabelEntry = entries.find((e) => e.id === msg2LabelId) as LabelEntry;
		/** 用于验证标签投影的会话树。 */
		const tree = session.getTree();

		// Find the message nodes (skip label entries)
		// 在树中查找消息节点；标签记录不会成为独立树节点。
		/** 树中的父消息节点。 */
		const msg1Node = tree.find((n) => n.entry.id === msg1Id);
		expect(msg1Node?.label).toBe("start");
		expect(msg1Node?.labelTimestamp).toBe(msg1LabelEntry.timestamp);

		// msg2 is a child of msg1
		// 第二条消息是第一条消息的子节点。
		/** 树中的子助手消息节点。 */
		const msg2Node = msg1Node?.children.find((n) => n.entry.id === msg2Id);
		expect(msg2Node?.label).toBe("response");
		expect(msg2Node?.labelTimestamp).toBe(msg2LabelEntry.timestamp);
	});

	it("labels are preserved in createBranchedSession", () => {
		/** 分支保留标签场景的内存会话。 */
		const session = SessionManager.inMemory();

		/** 分支路径上的父消息标识。 */
		const msg1Id = session.appendMessage({ role: "user", content: "hello", timestamp: 1 });
		/** 分支目标助手消息标识。 */
		const msg2Id = session.appendMessage({
			role: "assistant",
			content: [{ type: "text", text: "hi" }],
			api: "anthropic-messages",
			provider: "anthropic",
			model: "test",
			usage: {
				input: 1,
				output: 1,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 2,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "stop",
			timestamp: 2,
		});

		/** 父消息标签记录标识。 */
		const msg1LabelId = session.appendLabelChange(msg1Id, "important");
		/** 分支目标标签记录标识。 */
		const msg2LabelId = session.appendLabelChange(msg2Id, "also-important");
		/** 分支前的原始条目，用于比较标签时间戳。 */
		const originalEntries = session.getEntries();
		/** 分支前父消息的标签记录。 */
		const msg1LabelEntry = originalEntries.find((e) => e.id === msg1LabelId) as LabelEntry;
		/** 分支前目标消息的标签记录。 */
		const msg2LabelEntry = originalEntries.find((e) => e.id === msg2LabelId) as LabelEntry;

		// Branch from msg2 (in-memory mode returns null, but updates internal state)
		// 从 msg2 创建分支；内存模式返回 null，但会更新内部条目。
		session.createBranchedSession(msg2Id);

		// Labels should be preserved
		// 分支路径上两条消息的标签都应保留。
		expect(session.getLabel(msg1Id)).toBe("important");
		expect(session.getLabel(msg2Id)).toBe("also-important");

		// New label entries should exist
		// 新分支中仍应存在两条标签记录。
		/** 分支后的全部条目。 */
		const entries = session.getEntries();
		/** 分支后保留下来的标签条目。 */
		const labelEntries = entries.filter((e) => e.type === "label") as LabelEntry[];
		expect(labelEntries).toHaveLength(2);

		/** 分支后的会话树。 */
		const tree = session.getTree();
		/** 分支树中的父消息节点。 */
		const msg1Node = tree.find((n) => n.entry.id === msg1Id);
		/** 分支树中的目标消息节点。 */
		const msg2Node = msg1Node?.children.find((n) => n.entry.id === msg2Id);
		expect(msg1Node?.labelTimestamp).toBe(msg1LabelEntry.timestamp);
		expect(msg2Node?.labelTimestamp).toBe(msg2LabelEntry.timestamp);
	});

	it("rewires children of removed labels when forking", () => {
		/** 验证移除标签节点后重新连接子节点的内存会话。 */
		const session = SessionManager.inMemory();

		/** 标签所属的父消息标识。 */
		const msg1Id = session.appendMessage({ role: "user", content: "hello", timestamp: 1 });
		session.appendLabelChange(msg1Id, "checkpoint");
		/** 原本位于标签记录之后的模型变更标识。 */
		const modelChangeId = session.appendModelChange("anthropic", "claude-test");
		/** 分支目标消息标识。 */
		const msg2Id = session.appendMessage({ role: "user", content: "followup", timestamp: 2 });

		session.createBranchedSession(msg2Id);

		expect(session.getEntry(modelChangeId)?.parentId).toBe(msg1Id);
	});

	it("labels not on path are not preserved in createBranchedSession", () => {
		/** 分支路径裁剪场景的内存会话。 */
		const session = SessionManager.inMemory();

		/** 分支路径起点消息。 */
		const msg1Id = session.appendMessage({ role: "user", content: "hello", timestamp: 1 });
		/** 将成为分支终点的助手消息。 */
		const msg2Id = session.appendMessage({
			role: "assistant",
			content: [{ type: "text", text: "hi" }],
			api: "anthropic-messages",
			provider: "anthropic",
			model: "test",
			usage: {
				input: 1,
				output: 1,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 2,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "stop",
			timestamp: 2,
		});
		/** 不在目标分支路径上的后续消息。 */
		const msg3Id = session.appendMessage({ role: "user", content: "followup", timestamp: 3 });

		// Label all messages
		// 为三条消息都设置标签，以观察分支裁剪结果。
		session.appendLabelChange(msg1Id, "first");
		session.appendLabelChange(msg2Id, "second");
		session.appendLabelChange(msg3Id, "third");

		// Branch from msg2 (excludes msg3)
		// 从 msg2 分支，因此 msg3 不属于保留路径。
		session.createBranchedSession(msg2Id);

		// Only labels for msg1 and msg2 should be preserved
		// 只应保留 msg1 与 msg2 的标签。
		expect(session.getLabel(msg1Id)).toBe("first");
		expect(session.getLabel(msg2Id)).toBe("second");
		expect(session.getLabel(msg3Id)).toBeUndefined();
	});

	it("labels are not included in buildSessionContext", () => {
		/** 验证标签不会进入模型上下文的内存会话。 */
		const session = SessionManager.inMemory();

		/** 带标签的用户消息标识。 */
		const msgId = session.appendMessage({ role: "user", content: "hello", timestamp: 1 });
		session.appendLabelChange(msgId, "checkpoint");

		/** 供模型使用的会话上下文，只应包含消息。 */
		const ctx = session.buildSessionContext();
		expect(ctx.messages).toHaveLength(1);
		expect(ctx.messages[0].role).toBe("user");
	});

	it("throws when labeling non-existent entry", () => {
		/** 验证无效目标错误的内存会话。 */
		const session = SessionManager.inMemory();

		expect(() => session.appendLabelChange("non-existent", "label")).toThrow("Entry non-existent not found");
	});
});
