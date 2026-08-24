/**
 * 文件职责：验证 SessionManager 保存自定义条目并把它纳入树遍历、但不纳入模型消息上下文。
 * 技术维度：使用 Vitest、内存 SessionManager 和 CustomEntry 类型断言。
 * 产品维度：允许扩展在会话树中保存结构化数据，而不会把内部数据发送给模型。
 * 逻辑维度：依次追加消息、自定义条目、消息，检查 entries、父子路径和构建上下文。
 * 关键边界：自定义条目参与树结构但 buildSessionContext 会跳过；测试使用固定消息元数据。
 * 新手阅读建议：画出 msgId→customId→msg2Id，再比较 getEntries 与 ctx.messages 数量。
 */
import { describe, expect, it } from "vitest";
import { type CustomEntry, SessionManager } from "../../src/core/session-manager.ts";

/** 自定义条目保存测试组。 */
describe("SessionManager.saveCustomEntry", () => {
	/** 验证自定义条目的数据、父节点和树顺序，并确认上下文只含消息。 */
	it("saves custom entries and includes them in tree traversal", () => {
		/** 不写磁盘的会话管理器。 */
		const session = SessionManager.inMemory();

		// Save a message
		// 保存第一条用户消息。
		/** 第一条消息 ID，也是自定义条目的父节点。 */
		const msgId = session.appendMessage({ role: "user", content: "hello", timestamp: 1 });

		// Save a custom entry
		// 保存结构化自定义条目。
		/** 自定义条目 ID。 */
		const customId = session.appendCustomEntry("my_data", { foo: "bar" });

		// Save another message
		// 保存自定义条目之后的助手消息。
		/** 第二条消息 ID。 */
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

		// Custom entry should be in entries
		// 自定义条目应出现在完整 entries 中。
		/** 会话树全部三条记录。 */
		const entries = session.getEntries();
		expect(entries).toHaveLength(3);

		/** 从完整记录中找到的自定义条目。 */
		const customEntry = entries.find((e) => e.type === "custom") as CustomEntry;
		expect(customEntry).toBeDefined();
		expect(customEntry.customType).toBe("my_data");
		expect(customEntry.data).toEqual({ foo: "bar" });
		expect(customEntry.id).toBe(customId);
		expect(customEntry.parentId).toBe(msgId);

		// Tree structure should be correct
		// 分支路径应保持消息、自定义条目、消息的父子顺序。
		/** 当前叶节点的完整分支路径。 */
		const path = session.getBranch();
		expect(path).toHaveLength(3);
		expect(path[0].id).toBe(msgId);
		expect(path[1].id).toBe(customId);
		expect(path[2].id).toBe(msg2Id);

		// buildSessionContext should work (custom entries skipped in messages)
		// 构建模型上下文时应跳过自定义条目。
		/** 发送给模型的会话上下文。 */
		const ctx = session.buildSessionContext();
		expect(ctx.messages).toHaveLength(2); // only message entries
	});
});
