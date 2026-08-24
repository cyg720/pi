/**
 * 文件职责：验证旧版会话条目迁移会补齐树形 id/parentId，且对已迁移数据保持幂等。
 * 技术维度：使用 Vitest、FileEntry 类型和 migrateSessionEntries 原地迁移函数进行单元测试。
 * 产品维度：保证旧会话升级后仍能正确恢复消息分支，同时避免重复启动时改变现有标识。
 * 逻辑维度：第一例构造 v1 线性消息并检查新字段，第二例构造 v2 条目并检查字段不变。
 * 关键边界：迁移函数会原地修改数组；用例中的 any 仅用于读取跨版本动态字段。
 * 新手阅读建议：先看 entries 的会话头和两条消息，再比较迁移前后 parentId 的串联方式。
 */
import { describe, expect, it } from "vitest";
import { type FileEntry, migrateSessionEntries } from "../../src/core/session-manager.ts";

describe("migrateSessionEntries", () => {
	// 验证 v1 条目会升级版本并生成八位消息标识及父子链；无参数，无返回值。
	it("should add id/parentId to v1 entries", () => {
		// entries 是没有消息 id 和 parentId 的旧版会话条目数组。
		const entries: FileEntry[] = [
			{ type: "session", id: "sess-1", timestamp: "2025-01-01T00:00:00Z", cwd: "/tmp" },
			{ type: "message", timestamp: "2025-01-01T00:00:01Z", message: { role: "user", content: "hi", timestamp: 1 } },
			{
				type: "message",
				timestamp: "2025-01-01T00:00:02Z",
				message: {
					role: "assistant",
					content: [{ type: "text", text: "hello" }],
					api: "test",
					provider: "test",
					model: "test",
					usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 },
					stopReason: "stop",
					timestamp: 2,
				},
			},
		] as FileEntry[];

		migrateSessionEntries(entries);

		// Header should have version set (v3 is current after hookMessage->custom migration)
		// 会话头应设置当前 v3 版本，其中包含 hookMessage 到 custom 的迁移。
		expect((entries[0] as any).version).toBe(3);

		// Entries should have id/parentId
		// 消息条目应补齐 id 和 parentId。
		// msg1 是迁移后的第一条消息，作为树根没有父节点。
		const msg1 = entries[1] as any;
		// msg2 是迁移后的第二条消息，其父节点应指向 msg1。
		const msg2 = entries[2] as any;

		expect(msg1.id).toBeDefined();
		expect(msg1.id.length).toBe(8);
		expect(msg1.parentId).toBeNull();

		expect(msg2.id).toBeDefined();
		expect(msg2.id.length).toBe(8);
		expect(msg2.parentId).toBe(msg1.id);
	});

	// 验证已有 id 和 parentId 的会话再次迁移不会改变标识；无参数，无返回值。
	it("should be idempotent (skip already migrated)", () => {
		// entries 是已经包含稳定消息标识和父子关系的 v2 会话。
		const entries: FileEntry[] = [
			{ type: "session", id: "sess-1", version: 2, timestamp: "2025-01-01T00:00:00Z", cwd: "/tmp" },
			{
				type: "message",
				id: "abc12345",
				parentId: null,
				timestamp: "2025-01-01T00:00:01Z",
				message: { role: "user", content: "hi", timestamp: 1 },
			},
			{
				type: "message",
				id: "def67890",
				parentId: "abc12345",
				timestamp: "2025-01-01T00:00:02Z",
				message: {
					role: "assistant",
					content: [{ type: "text", text: "hello" }],
					api: "test",
					provider: "test",
					model: "test",
					usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 },
					stopReason: "stop",
					timestamp: 2,
				},
			},
		] as FileEntry[];

		migrateSessionEntries(entries);

		// IDs should be unchanged
		// 已有消息标识应保持不变。
		expect((entries[1] as any).id).toBe("abc12345");
		expect((entries[2] as any).id).toBe("def67890");
		expect((entries[2] as any).parentId).toBe("abc12345");
	});
});
