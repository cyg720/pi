import { describe, expect, it } from "vitest";
import {
	type BranchSummaryEntry,
	buildContextEntries,
	buildSessionContext,
	type CompactionEntry,
	type CustomEntry,
	type ModelChangeEntry,
	type SessionEntry,
	type SessionMessageEntry,
	type ThinkingLevelChangeEntry,
} from "../../src/core/session-manager.ts";

/** 创建用户或助手消息条目。参数依次为标识、父标识、角色和文本；返回完整测试条目。示例：msg("1", null, "user", "hello")。 */
function msg(id: string, parentId: string | null, role: "user" | "assistant", text: string): SessionMessageEntry {
	/** 两种角色共享的条目元数据。 */
	const base = { type: "message" as const, id, parentId, timestamp: "2025-01-01T00:00:00Z" };
	if (role === "user") {
		return { ...base, message: { role, content: text, timestamp: 1 } };
	}
	return {
		...base,
		message: {
			role,
			content: [{ type: "text", text }],
			api: "anthropic-messages",
			provider: "anthropic",
			model: "claude-test",
			usage: {
				input: 1,
				output: 1,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 2,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "stop",
			timestamp: 1,
		},
	};
}

/** 创建压缩条目。参数包含摘要和首个保留条目标识；返回固定 tokensBefore 的测试对象。示例：compaction("5", "4", "Summary", "3")。 */
function compaction(id: string, parentId: string | null, summary: string, firstKeptEntryId: string): CompactionEntry {
	return {
		type: "compaction",
		id,
		parentId,
		timestamp: "2025-01-01T00:00:00Z",
		summary,
		firstKeptEntryId,
		tokensBefore: 1000,
	};
}

/** 创建分支摘要条目。fromId 指向被总结分支的末端；返回测试对象。示例：branchSummary("4", "2", "Summary", "3")。 */
function branchSummary(id: string, parentId: string | null, summary: string, fromId: string): BranchSummaryEntry {
	return { type: "branch_summary", id, parentId, timestamp: "2025-01-01T00:00:00Z", summary, fromId };
}

/** 创建不会默认投影成模型消息的自定义条目。返回测试对象。示例：custom("2", "1", "state", data)。 */
function custom(id: string, parentId: string | null, customType: string, data?: unknown): CustomEntry {
	return { type: "custom", id, parentId, timestamp: "2025-01-01T00:00:00Z", customType, data };
}

/** 创建思考级别变更条目。返回测试对象。示例：thinkingLevel("2", "1", "high")。 */
function thinkingLevel(id: string, parentId: string | null, level: string): ThinkingLevelChangeEntry {
	return { type: "thinking_level_change", id, parentId, timestamp: "2025-01-01T00:00:00Z", thinkingLevel: level };
}

/** 创建模型变更条目。返回测试对象。示例：modelChange("2", "1", "openai", "gpt-4")。 */
function modelChange(id: string, parentId: string | null, provider: string, modelId: string): ModelChangeEntry {
	return { type: "model_change", id, parentId, timestamp: "2025-01-01T00:00:00Z", provider, modelId };
}

describe("buildSessionContext", () => {
	describe("trivial cases", () => {
		/** 验证空条目得到空消息、关闭思考和空模型。 */
		it("empty entries returns empty context", () => {
			/** 空条目构建出的上下文。 */
			const ctx = buildSessionContext([]);
			expect(ctx.messages).toEqual([]);
			expect(ctx.thinkingLevel).toBe("off");
			expect(ctx.model).toBeNull();
		});

		/** 验证单条用户消息被保留。 */
		it("single user message", () => {
			/** 仅包含一条根用户消息的条目列表。 */
			const entries: SessionEntry[] = [msg("1", null, "user", "hello")];
			/** 由单条消息构建的上下文。 */
			const ctx = buildSessionContext(entries);
			expect(ctx.messages).toHaveLength(1);
			expect(ctx.messages[0].role).toBe("user");
		});

		/** 验证普通四消息对话保持角色顺序。 */
		it("simple conversation", () => {
			/** 线性用户与助手对话条目。 */
			const entries: SessionEntry[] = [
				msg("1", null, "user", "hello"),
				msg("2", "1", "assistant", "hi there"),
				msg("3", "2", "user", "how are you"),
				msg("4", "3", "assistant", "great"),
			];
			/** 线性条目转换出的上下文。 */
			const ctx = buildSessionContext(entries);
			expect(ctx.messages).toHaveLength(4);
			expect(ctx.messages.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
		});

		/** 验证思考级别变更会更新上下文设置。 */
		it("tracks thinking level changes", () => {
			/** 包含思考级别变更的线性条目。 */
			const entries: SessionEntry[] = [
				msg("1", null, "user", "hello"),
				thinkingLevel("2", "1", "high"),
				msg("3", "2", "assistant", "thinking hard"),
			];
			/** 应反映 high 思考级别的上下文。 */
			const ctx = buildSessionContext(entries);
			expect(ctx.thinkingLevel).toBe("high");
			expect(ctx.messages).toHaveLength(2);
		});

		/** 验证助手消息会提供当前模型信息。 */
		it("tracks model from assistant message", () => {
			/** 包含模型元数据助手消息的条目。 */
			const entries: SessionEntry[] = [msg("1", null, "user", "hello"), msg("2", "1", "assistant", "hi")];
			/** 应从助手消息读取模型的上下文。 */
			const ctx = buildSessionContext(entries);
			expect(ctx.model).toEqual({ provider: "anthropic", modelId: "claude-test" });
		});

		/** 验证后续助手消息会覆盖显式模型变更记录。 */
		it("tracks model from model change entry", () => {
			/** 先切换模型、再收到固定 anthropic 助手消息的条目。 */
			const entries: SessionEntry[] = [
				msg("1", null, "user", "hello"),
				modelChange("2", "1", "openai", "gpt-4"),
				msg("3", "2", "assistant", "hi"),
			];
			/** 最终模型应取最后助手消息的上下文。 */
			const ctx = buildSessionContext(entries);
			// Assistant message overwrites model change
			// 助手消息会覆盖此前的模型变更记录。
			expect(ctx.model).toEqual({ provider: "anthropic", modelId: "claude-test" });
		});
	});

	describe("with compaction", () => {
		/** 验证摘要位于保留消息与压缩后消息之前。 */
		it("includes summary before kept messages", () => {
			/** 包含一次压缩和压缩后对话的条目。 */
			const entries: SessionEntry[] = [
				msg("1", null, "user", "first"),
				msg("2", "1", "assistant", "response1"),
				msg("3", "2", "user", "second"),
				msg("4", "3", "assistant", "response2"),
				compaction("5", "4", "Summary of first two turns", "3"),
				msg("6", "5", "user", "third"),
				msg("7", "6", "assistant", "response3"),
			];
			/** 应仅包含摘要、保留消息和后续消息的上下文。 */
			const ctx = buildSessionContext(entries);

			// Should have: summary + kept (3,4) + after (6,7) = 5 messages
			// 应得到摘要、保留的 3/4 和压缩后的 6/7，共五条消息。
			expect(ctx.messages).toHaveLength(5);
			expect((ctx.messages[0] as any).summary).toContain("Summary of first two turns");
			expect((ctx.messages[1] as any).content).toBe("second");
			expect((ctx.messages[2] as any).content[0].text).toBe("response2");
			expect((ctx.messages[3] as any).content).toBe("third");
			expect((ctx.messages[4] as any).content[0].text).toBe("response3");
		});

		/** 验证从首条消息起保留时不会漏掉原始对话。 */
		it("handles compaction keeping from first message", () => {
			/** 首条消息就是保留起点的压缩条目。 */
			const entries: SessionEntry[] = [
				msg("1", null, "user", "first"),
				msg("2", "1", "assistant", "response"),
				compaction("3", "2", "Empty summary", "1"),
				msg("4", "3", "user", "second"),
			];
			/** 包含摘要和全部消息的上下文。 */
			const ctx = buildSessionContext(entries);

			// Summary + all messages (1,2,4)
			// 上下文应由摘要与全部消息 1、2、4 组成。
			expect(ctx.messages).toHaveLength(4);
			expect((ctx.messages[0] as any).summary).toContain("Empty summary");
		});

		/** 验证多次压缩时只采用路径上最新一次压缩。 */
		it("multiple compactions uses latest", () => {
			/** 依次包含两次压缩的条目。 */
			const entries: SessionEntry[] = [
				msg("1", null, "user", "a"),
				msg("2", "1", "assistant", "b"),
				compaction("3", "2", "First summary", "1"),
				msg("4", "3", "user", "c"),
				msg("5", "4", "assistant", "d"),
				compaction("6", "5", "Second summary", "4"),
				msg("7", "6", "user", "e"),
			];
			/** 应从第二次压缩起构建的上下文。 */
			const ctx = buildSessionContext(entries);

			// Should use second summary, keep from 4
			// 应使用第二个摘要，并从条目 4 开始保留。
			expect(ctx.messages).toHaveLength(4);
			expect((ctx.messages[0] as any).summary).toContain("Second summary");
		});

		/** 验证压缩感知的条目筛选会保留范围内自定义条目。 */
		it("buildContextEntries returns compaction-aware entries including custom entries", () => {
			/** 包含压缩前后自定义条目的测试路径。 */
			const entries: SessionEntry[] = [
				msg("1", null, "user", "first"),
				custom("2", "1", "old-state", { hidden: true }),
				msg("3", "2", "assistant", "response1"),
				custom("4", "3", "kept-card", { title: "Kept" }),
				msg("5", "4", "user", "second"),
				compaction("6", "5", "Summary", "4"),
				custom("7", "6", "after-card", { title: "After" }),
				msg("8", "7", "assistant", "response2"),
			];

			expect(buildContextEntries(entries).map((entry) => entry.id)).toEqual(["6", "4", "5", "7", "8"]);
			/** 默认消息投影后的上下文，自定义条目不直接成为消息。 */
			const ctx = buildSessionContext(entries);
			expect(ctx.messages.map((message) => message.role)).toEqual(["compactionSummary", "user", "assistant"]);
		});

		/** 验证压缩不会丢失完整路径上的设置变更。 */
		it("keeps settings from the full path after compaction", () => {
			/** 在压缩之前设置 high 思考级别的条目。 */
			const entries: SessionEntry[] = [
				msg("1", null, "user", "first"),
				thinkingLevel("2", "1", "high"),
				msg("3", "2", "assistant", "response1"),
				msg("4", "3", "user", "second"),
				compaction("5", "4", "Summary", "4"),
			];

			/** 应保留 high 设置的压缩上下文。 */
			const ctx = buildSessionContext(entries);
			expect(ctx.thinkingLevel).toBe("high");
			expect(ctx.messages.map((message) => message.role)).toEqual(["compactionSummary", "user"]);
		});
	});

	describe("with branches", () => {
		/** 验证 leafId 决定树中采用的分支。 */
		it("follows path to specified leaf", () => {
			// Tree:
			// 测试树结构：
			//   1 -> 2 -> 3 (branch A)
			//         \-> 4 (branch B)
			/** 在条目 2 处分叉的测试树。 */
			const entries: SessionEntry[] = [
				msg("1", null, "user", "start"),
				msg("2", "1", "assistant", "response"),
				msg("3", "2", "user", "branch A"),
				msg("4", "2", "user", "branch B"),
			];

			/** 指向分支 A 叶节点的上下文。 */
			const ctxA = buildSessionContext(entries, "3");
			expect(ctxA.messages).toHaveLength(3);
			expect((ctxA.messages[2] as any).content).toBe("branch A");

			/** 指向分支 B 叶节点的上下文。 */
			const ctxB = buildSessionContext(entries, "4");
			expect(ctxB.messages).toHaveLength(3);
			expect((ctxB.messages[2] as any).content).toBe("branch B");
		});

		/** 验证分支摘要条目会作为 branchSummary 消息进入路径。 */
		it("includes branch summary in path", () => {
			/** 包含弃用分支摘要和新方向的条目。 */
			const entries: SessionEntry[] = [
				msg("1", null, "user", "start"),
				msg("2", "1", "assistant", "response"),
				msg("3", "2", "user", "abandoned path"),
				branchSummary("4", "2", "Summary of abandoned work", "3"),
				msg("5", "4", "user", "new direction"),
			];
			/** 指向新方向叶节点的上下文。 */
			const ctx = buildSessionContext(entries, "5");

			expect(ctx.messages).toHaveLength(4);
			expect((ctx.messages[2] as any).summary).toContain("Summary of abandoned work");
			expect((ctx.messages[3] as any).content).toBe("new direction");
		});

		/** 验证同一棵树中的主压缩路径和恢复分支路径互不混淆。 */
		it("complex tree with multiple branches and compaction", () => {
			// Tree:
			// 测试树结构：
			//   1 -> 2 -> 3 -> 4 -> compaction(5) -> 6 -> 7 (main path)
			//              \-> 8 -> 9 (abandoned branch)
			//                    \-> branchSummary(10) -> 11 (resumed from 3)
			/** 同时包含压缩主路径、弃用分支和分支摘要的复杂树。 */
			const entries: SessionEntry[] = [
				msg("1", null, "user", "start"),
				msg("2", "1", "assistant", "r1"),
				msg("3", "2", "user", "q2"),
				msg("4", "3", "assistant", "r2"),
				compaction("5", "4", "Compacted history", "3"),
				msg("6", "5", "user", "q3"),
				msg("7", "6", "assistant", "r3"),
				// Abandoned branch from 3
				// 从条目 3 分出的弃用分支。
				msg("8", "3", "user", "wrong path"),
				msg("9", "8", "assistant", "wrong response"),
				// Branch summary resuming from 3
				// 从条目 3 恢复并携带摘要的新分支。
				branchSummary("10", "3", "Tried wrong approach", "9"),
				msg("11", "10", "user", "better approach"),
			];

			// Main path to 7: summary + kept(3,4) + after(6,7)
			// 到叶节点 7 的主路径由摘要、保留条目 3/4 和后续条目 6/7 组成。
			/** 指向主路径叶节点 7 的上下文。 */
			const ctxMain = buildSessionContext(entries, "7");
			expect(ctxMain.messages).toHaveLength(5);
			expect((ctxMain.messages[0] as any).summary).toContain("Compacted history");
			expect((ctxMain.messages[1] as any).content).toBe("q2");
			expect((ctxMain.messages[2] as any).content[0].text).toBe("r2");
			expect((ctxMain.messages[3] as any).content).toBe("q3");
			expect((ctxMain.messages[4] as any).content[0].text).toBe("r3");

			// Branch path to 11: 1,2,3 + branch_summary + 11
			// 到叶节点 11 的分支路径由 1、2、3、分支摘要和 11 组成。
			/** 指向恢复分支叶节点 11 的上下文。 */
			const ctxBranch = buildSessionContext(entries, "11");
			expect(ctxBranch.messages).toHaveLength(5);
			expect((ctxBranch.messages[0] as any).content).toBe("start");
			expect((ctxBranch.messages[1] as any).content[0].text).toBe("r1");
			expect((ctxBranch.messages[2] as any).content).toBe("q2");
			expect((ctxBranch.messages[3] as any).summary).toContain("Tried wrong approach");
			expect((ctxBranch.messages[4] as any).content).toBe("better approach");
		});
	});

	describe("edge cases", () => {
		/** 验证 leafId 不存在时回退到最后条目。 */
		it("uses last entry when leafId not found", () => {
			/** 简单线性对话条目。 */
			const entries: SessionEntry[] = [msg("1", null, "user", "hello"), msg("2", "1", "assistant", "hi")];
			/** 使用不存在 leafId 构建的回退上下文。 */
			const ctx = buildSessionContext(entries, "nonexistent");
			expect(ctx.messages).toHaveLength(2);
		});

		/** 验证父节点缺失时仅返回可到达的孤立节点。 */
		it("handles orphaned entries gracefully", () => {
			/** 第二条消息引用不存在父节点的条目。 */
			const entries: SessionEntry[] = [
				msg("1", null, "user", "hello"),
				msg("2", "missing", "assistant", "orphan"), // parent doesn't exist
				// 父节点不存在，用于模拟损坏或不完整的会话树。
			];
			/** 指向孤立节点构建的上下文。 */
			const ctx = buildSessionContext(entries, "2");
			// Should only get the orphan since parent chain is broken
			// 父链断开，因此只能得到孤立消息本身。
			expect(ctx.messages).toHaveLength(1);
		});
	});
});
/**
 * 文件职责：验证会话条目树如何转换为模型上下文，包括压缩、分支摘要、自定义条目和设置恢复。
 * 技术维度：使用 Vitest 和轻量条目工厂构造树形数据，直接测试 buildContextEntries 与 buildSessionContext。
 * 产品维度：保障用户切换分支或压缩长会话后，模型仍收到正确历史、模型选择和思考级别。
 * 逻辑维度：先定义各类条目工厂，再按简单对话、压缩、分支和异常边界四组场景断言输出。
 * 关键边界：测试时间戳和用量为固定样例；部分断言使用 any 读取不同角色消息的特有字段，避免改变既有测试类型结构。
 * 新手阅读建议：先看六个条目工厂，再读简单场景理解基础输出，随后比较压缩路径与分支路径的差异。
 */
