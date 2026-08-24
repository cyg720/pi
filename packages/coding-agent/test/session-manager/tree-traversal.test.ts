/**
 * 文件职责：验证 SessionManager 追加各类条目、维护叶节点、遍历父链与树、创建分支及文件持久化。
 * 技术维度：使用 Vitest、内存与文件型 SessionManager、临时目录、JSONL 解析和测试消息辅助函数。
 * 产品维度：保障用户回退、分叉和继续会话时只看到当前分支，且摘要、工具用量和父子关系不会丢失。
 * 逻辑维度：按追加、路径、树、分支、摘要、条目查询、上下文和创建分支会话逐组覆盖。
 * 关键边界：文件型用例必须清理临时目录；从无助手消息的位置分叉会延迟到首个助手回复才创建文件。
 * 新手阅读建议：先读 append operations 理解 parentId 与 leaf，再看 getTree，最后阅读 createBranchedSession 的持久化场景。
 */

import { existsSync, mkdirSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { type CustomEntry, SessionManager } from "../../src/core/session-manager.ts";
import { assistantMsg, userMsg } from "../utilities.ts";

/** 测试分组：SessionManager append and tree traversal。 */
describe("SessionManager append and tree traversal", () => {
	/** 测试分组：append operations。 */
	describe("append operations", () => {
		/** 测试场景：appendMessage creates entry with correct parentId chain。 */
		it("appendMessage creates entry with correct parentId chain", () => {
			/** 变量 session：当前场景的内存或文件型 SessionManager；仅在当前测试作用域内有效。 */
			const session = SessionManager.inMemory();

			/** 变量 id1：第一条追加记录的编号；仅在当前测试作用域内有效。 */
			const id1 = session.appendMessage(userMsg("first"));
			/** 变量 id2：第二条追加记录的编号；仅在当前测试作用域内有效。 */
			const id2 = session.appendMessage(assistantMsg("second"));
			/** 变量 id3：第三条追加记录的编号；仅在当前测试作用域内有效。 */
			const id3 = session.appendMessage(userMsg("third"));

			/** 变量 entries：当前会话中按追加顺序保存的全部条目；仅在当前测试作用域内有效。 */
			const entries = session.getEntries();
			expect(entries).toHaveLength(3);

			expect(entries[0].id).toBe(id1);
			expect(entries[0].parentId).toBeNull();
			expect(entries[0].type).toBe("message");

			expect(entries[1].id).toBe(id2);
			expect(entries[1].parentId).toBe(id1);

			expect(entries[2].id).toBe(id3);
			expect(entries[2].parentId).toBe(id2);
		});

		/** 测试场景：appendThinkingLevelChange integrates into tree。 */
		it("appendThinkingLevelChange integrates into tree", () => {
			/** 变量 session：当前场景的内存或文件型 SessionManager；仅在当前测试作用域内有效。 */
			const session = SessionManager.inMemory();

			/** 变量 msgId：分支前用户消息的编号；仅在当前测试作用域内有效。 */
			const msgId = session.appendMessage(userMsg("hello"));
			/** 变量 thinkingId：思考等级变更条目的编号；仅在当前测试作用域内有效。 */
			const thinkingId = session.appendThinkingLevelChange("high");
			/** 变量 _msg2Id：当前会话树测试使用的 _msg2Id 值；仅在当前测试作用域内有效。 */
			const _msg2Id = session.appendMessage(assistantMsg("response"));

			/** 变量 entries：当前会话中按追加顺序保存的全部条目；仅在当前测试作用域内有效。 */
			const entries = session.getEntries();
			expect(entries).toHaveLength(3);

			/** 变量 thinkingEntry：找到的思考等级变更条目；仅在当前测试作用域内有效。 */
			const thinkingEntry = entries.find((e) => e.type === "thinking_level_change");
			expect(thinkingEntry).toBeDefined();
			expect(thinkingEntry!.id).toBe(thinkingId);
			expect(thinkingEntry!.parentId).toBe(msgId);

			expect(entries[2].parentId).toBe(thinkingId);
		});

		/** 测试场景：appendModelChange integrates into tree。 */
		it("appendModelChange integrates into tree", () => {
			/** 变量 session：当前场景的内存或文件型 SessionManager；仅在当前测试作用域内有效。 */
			const session = SessionManager.inMemory();

			/** 变量 msgId：分支前用户消息的编号；仅在当前测试作用域内有效。 */
			const msgId = session.appendMessage(userMsg("hello"));
			/** 变量 modelId：模型变更条目的编号；仅在当前测试作用域内有效。 */
			const modelId = session.appendModelChange("openai", "gpt-4");
			/** 变量 _msg2Id：当前会话树测试使用的 _msg2Id 值；仅在当前测试作用域内有效。 */
			const _msg2Id = session.appendMessage(assistantMsg("response"));

			/** 变量 entries：当前会话中按追加顺序保存的全部条目；仅在当前测试作用域内有效。 */
			const entries = session.getEntries();
			/** 变量 modelEntry：找到的模型变更条目；仅在当前测试作用域内有效。 */
			const modelEntry = entries.find((e) => e.type === "model_change");
			expect(modelEntry).toBeDefined();
			expect(modelEntry?.id).toBe(modelId);
			expect(modelEntry?.parentId).toBe(msgId);
			if (modelEntry?.type === "model_change") {
				expect(modelEntry.provider).toBe("openai");
				expect(modelEntry.modelId).toBe("gpt-4");
			}

			expect(entries[2].parentId).toBe(modelId);
		});

		/** 测试场景：appendCompaction integrates into tree。 */
		it("appendCompaction integrates into tree", () => {
			/** 变量 session：当前场景的内存或文件型 SessionManager；仅在当前测试作用域内有效。 */
			const session = SessionManager.inMemory();

			/** 变量 id1：第一条追加记录的编号；仅在当前测试作用域内有效。 */
			const id1 = session.appendMessage(userMsg("1"));
			/** 变量 id2：第二条追加记录的编号；仅在当前测试作用域内有效。 */
			const id2 = session.appendMessage(assistantMsg("2"));
			/** 变量 usage：用于摘要和工具记录的完整 Token 用量样例；仅在当前测试作用域内有效。 */
			const usage = {
				input: 10,
				output: 20,
				cacheRead: 30,
				cacheWrite: 40,
				totalTokens: 100,
				cost: { input: 0.1, output: 0.2, cacheRead: 0.3, cacheWrite: 0.4, total: 1 },
			};
			/** 变量 compactionId：新压缩条目的编号；仅在当前测试作用域内有效。 */
			const compactionId = session.appendCompaction("summary", id1, 1000, undefined, false, usage);
			/** 变量 _id3：当前会话树测试使用的 _id3 值；仅在当前测试作用域内有效。 */
			const _id3 = session.appendMessage(userMsg("3"));

			/** 变量 entries：当前会话中按追加顺序保存的全部条目；仅在当前测试作用域内有效。 */
			const entries = session.getEntries();
			/** 变量 compactionEntry：找到的压缩条目；仅在当前测试作用域内有效。 */
			const compactionEntry = entries.find((e) => e.type === "compaction");
			expect(compactionEntry).toBeDefined();
			expect(compactionEntry?.id).toBe(compactionId);
			expect(compactionEntry?.parentId).toBe(id2);
			if (compactionEntry?.type === "compaction") {
				expect(compactionEntry.summary).toBe("summary");
				expect(compactionEntry.firstKeptEntryId).toBe(id1);
				expect(compactionEntry.tokensBefore).toBe(1000);
				expect(compactionEntry.usage).toEqual(usage);
			}

			expect(entries[3].parentId).toBe(compactionId);
		});

		/** 测试场景：appendCustomEntry integrates into tree。 */
		it("appendCustomEntry integrates into tree", () => {
			/** 变量 session：当前场景的内存或文件型 SessionManager；仅在当前测试作用域内有效。 */
			const session = SessionManager.inMemory();

			/** 变量 msgId：分支前用户消息的编号；仅在当前测试作用域内有效。 */
			const msgId = session.appendMessage(userMsg("hello"));
			/** 变量 customId：自定义条目的编号；仅在当前测试作用域内有效。 */
			const customId = session.appendCustomEntry("my_data", { key: "value" });
			/** 变量 _msg2Id：当前会话树测试使用的 _msg2Id 值；仅在当前测试作用域内有效。 */
			const _msg2Id = session.appendMessage(assistantMsg("response"));

			/** 变量 entries：当前会话中按追加顺序保存的全部条目；仅在当前测试作用域内有效。 */
			const entries = session.getEntries();
			/** 变量 customEntry：找到并收窄类型的自定义条目；仅在当前测试作用域内有效。 */
			const customEntry = entries.find((e) => e.type === "custom") as CustomEntry;
			expect(customEntry).toBeDefined();
			expect(customEntry.id).toBe(customId);
			expect(customEntry.parentId).toBe(msgId);
			expect(customEntry.customType).toBe("my_data");
			expect(customEntry.data).toEqual({ key: "value" });

			expect(entries[2].parentId).toBe(customId);
		});

		/** 测试场景：leaf pointer advances after each append。 */
		it("leaf pointer advances after each append", () => {
			/** 变量 session：当前场景的内存或文件型 SessionManager；仅在当前测试作用域内有效。 */
			const session = SessionManager.inMemory();

			expect(session.getLeafId()).toBeNull();

			/** 变量 id1：第一条追加记录的编号；仅在当前测试作用域内有效。 */
			const id1 = session.appendMessage(userMsg("1"));
			expect(session.getLeafId()).toBe(id1);

			/** 变量 id2：第二条追加记录的编号；仅在当前测试作用域内有效。 */
			const id2 = session.appendMessage(assistantMsg("2"));
			expect(session.getLeafId()).toBe(id2);

			/** 变量 id3：第三条追加记录的编号；仅在当前测试作用域内有效。 */
			const id3 = session.appendThinkingLevelChange("high");
			expect(session.getLeafId()).toBe(id3);
		});
	});

	/** 测试分组：getPath。 */
	describe("getPath", () => {
		/** 测试场景：returns empty array for empty session。 */
		it("returns empty array for empty session", () => {
			/** 变量 session：当前场景的内存或文件型 SessionManager；仅在当前测试作用域内有效。 */
			const session = SessionManager.inMemory();
			expect(session.getBranch()).toEqual([]);
		});

		/** 测试场景：returns single entry path。 */
		it("returns single entry path", () => {
			/** 变量 session：当前场景的内存或文件型 SessionManager；仅在当前测试作用域内有效。 */
			const session = SessionManager.inMemory();
			/** 变量 id：当前会话树测试使用的 id 值；仅在当前测试作用域内有效。 */
			const id = session.appendMessage(userMsg("hello"));

			/** 变量 path：从根到指定节点或当前叶节点的分支路径；仅在当前测试作用域内有效。 */
			const path = session.getBranch();
			expect(path).toHaveLength(1);
			expect(path[0].id).toBe(id);
		});

		/** 测试场景：returns full path from root to leaf。 */
		it("returns full path from root to leaf", () => {
			/** 变量 session：当前场景的内存或文件型 SessionManager；仅在当前测试作用域内有效。 */
			const session = SessionManager.inMemory();

			/** 变量 id1：第一条追加记录的编号；仅在当前测试作用域内有效。 */
			const id1 = session.appendMessage(userMsg("1"));
			/** 变量 id2：第二条追加记录的编号；仅在当前测试作用域内有效。 */
			const id2 = session.appendMessage(assistantMsg("2"));
			/** 变量 id3：第三条追加记录的编号；仅在当前测试作用域内有效。 */
			const id3 = session.appendThinkingLevelChange("high");
			/** 变量 id4：分支或主路径上的第四条记录编号；仅在当前测试作用域内有效。 */
			const id4 = session.appendMessage(userMsg("3"));

			/** 变量 path：从根到指定节点或当前叶节点的分支路径；仅在当前测试作用域内有效。 */
			const path = session.getBranch();
			expect(path).toHaveLength(4);
			expect(path.map((e) => e.id)).toEqual([id1, id2, id3, id4]);
		});

		/** 测试场景：returns path from specified entry to root。 */
		it("returns path from specified entry to root", () => {
			/** 变量 session：当前场景的内存或文件型 SessionManager；仅在当前测试作用域内有效。 */
			const session = SessionManager.inMemory();

			/** 变量 id1：第一条追加记录的编号；仅在当前测试作用域内有效。 */
			const id1 = session.appendMessage(userMsg("1"));
			/** 变量 id2：第二条追加记录的编号；仅在当前测试作用域内有效。 */
			const id2 = session.appendMessage(assistantMsg("2"));
			/** 变量 _id3：当前会话树测试使用的 _id3 值；仅在当前测试作用域内有效。 */
			const _id3 = session.appendMessage(userMsg("3"));
			/** 变量 _id4：当前会话树测试使用的 _id4 值；仅在当前测试作用域内有效。 */
			const _id4 = session.appendMessage(assistantMsg("4"));

			/** 变量 path：从根到指定节点或当前叶节点的分支路径；仅在当前测试作用域内有效。 */
			const path = session.getBranch(id2);
			expect(path).toHaveLength(2);
			expect(path.map((e) => e.id)).toEqual([id1, id2]);
		});
	});

	/** 测试分组：getTree。 */
	describe("getTree", () => {
		/** 测试场景：returns empty array for empty session。 */
		it("returns empty array for empty session", () => {
			/** 变量 session：当前场景的内存或文件型 SessionManager；仅在当前测试作用域内有效。 */
			const session = SessionManager.inMemory();
			expect(session.getTree()).toEqual([]);
		});

		/** 测试场景：returns single root for linear session。 */
		it("returns single root for linear session", () => {
			/** 变量 session：当前场景的内存或文件型 SessionManager；仅在当前测试作用域内有效。 */
			const session = SessionManager.inMemory();

			/** 变量 id1：第一条追加记录的编号；仅在当前测试作用域内有效。 */
			const id1 = session.appendMessage(userMsg("1"));
			/** 变量 id2：第二条追加记录的编号；仅在当前测试作用域内有效。 */
			const id2 = session.appendMessage(assistantMsg("2"));
			/** 变量 id3：第三条追加记录的编号；仅在当前测试作用域内有效。 */
			const id3 = session.appendMessage(userMsg("3"));

			/** 变量 tree：由会话条目构造的根节点数组；仅在当前测试作用域内有效。 */
			const tree = session.getTree();
			expect(tree).toHaveLength(1);

			/** 变量 root：树结构中的根节点；仅在当前测试作用域内有效。 */
			const root = tree[0];
			expect(root.entry.id).toBe(id1);
			expect(root.children).toHaveLength(1);
			expect(root.children[0].entry.id).toBe(id2);
			expect(root.children[0].children).toHaveLength(1);
			expect(root.children[0].children[0].entry.id).toBe(id3);
			expect(root.children[0].children[0].children).toHaveLength(0);
		});

		/** 测试场景：returns tree with branches after branch。 */
		it("returns tree with branches after branch", () => {
			/** 变量 session：当前场景的内存或文件型 SessionManager；仅在当前测试作用域内有效。 */
			const session = SessionManager.inMemory();

			// Build: 1 -> 2 -> 3
			/** 变量 id1：第一条追加记录的编号；仅在当前测试作用域内有效。 */
			// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。
			const id1 = session.appendMessage(userMsg("1"));
			/** 变量 id2：第二条追加记录的编号；仅在当前测试作用域内有效。 */
			const id2 = session.appendMessage(assistantMsg("2"));
			/** 变量 id3：第三条追加记录的编号；仅在当前测试作用域内有效。 */
			const id3 = session.appendMessage(userMsg("3"));

			// Branch from id2, add new path: 2 -> 4
			// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。
			session.branch(id2);
			/** 变量 id4：分支或主路径上的第四条记录编号；仅在当前测试作用域内有效。 */
			const id4 = session.appendMessage(userMsg("4-branch"));

			/** 变量 tree：由会话条目构造的根节点数组；仅在当前测试作用域内有效。 */
			const tree = session.getTree();
			expect(tree).toHaveLength(1);

			/** 变量 root：树结构中的根节点；仅在当前测试作用域内有效。 */
			const root = tree[0];
			expect(root.entry.id).toBe(id1);
			expect(root.children).toHaveLength(1);

			/** 变量 node2：编号为 id2 的树节点；仅在当前测试作用域内有效。 */
			const node2 = root.children[0];
			expect(node2.entry.id).toBe(id2);
			expect(node2.children).toHaveLength(2); // id3 and id4 are siblings
			// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。

			/** 变量 childIds：id2 下所有直接子节点编号；仅在当前测试作用域内有效。 */
			const childIds = node2.children.map((c) => c.entry.id).sort();
			expect(childIds).toEqual([id3, id4].sort());
		});

		/** 测试场景：handles multiple branches at same point。 */
		it("handles multiple branches at same point", () => {
			/** 变量 session：当前场景的内存或文件型 SessionManager；仅在当前测试作用域内有效。 */
			const session = SessionManager.inMemory();

			/** 变量 _id1：当前会话树测试使用的 _id1 值；仅在当前测试作用域内有效。 */
			const _id1 = session.appendMessage(userMsg("root"));
			/** 变量 id2：第二条追加记录的编号；仅在当前测试作用域内有效。 */
			const id2 = session.appendMessage(assistantMsg("response"));

			// Branch A
			// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。
			session.branch(id2);
			/** 变量 idA：A 分支首条消息编号；仅在当前测试作用域内有效。 */
			const idA = session.appendMessage(userMsg("branch-A"));

			// Branch B
			// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。
			session.branch(id2);
			/** 变量 idB：B 分支首条消息编号；仅在当前测试作用域内有效。 */
			const idB = session.appendMessage(userMsg("branch-B"));

			// Branch C
			// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。
			session.branch(id2);
			/** 变量 idC：C 分支首条消息编号；仅在当前测试作用域内有效。 */
			const idC = session.appendMessage(userMsg("branch-C"));

			/** 变量 tree：由会话条目构造的根节点数组；仅在当前测试作用域内有效。 */
			const tree = session.getTree();
			/** 变量 node2：编号为 id2 的树节点；仅在当前测试作用域内有效。 */
			const node2 = tree[0].children[0];
			expect(node2.entry.id).toBe(id2);
			expect(node2.children).toHaveLength(3);

			/** 变量 branchIds：同一分支点下 A、B、C 子节点编号；仅在当前测试作用域内有效。 */
			const branchIds = node2.children.map((c) => c.entry.id).sort();
			expect(branchIds).toEqual([idA, idB, idC].sort());
		});

		/** 测试场景：handles deep branching。 */
		it("handles deep branching", () => {
			/** 变量 session：当前场景的内存或文件型 SessionManager；仅在当前测试作用域内有效。 */
			const session = SessionManager.inMemory();

			// Main path: 1 -> 2 -> 3 -> 4
			/** 变量 _id1：当前会话树测试使用的 _id1 值；仅在当前测试作用域内有效。 */
			// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。
			const _id1 = session.appendMessage(userMsg("1"));
			/** 变量 id2：第二条追加记录的编号；仅在当前测试作用域内有效。 */
			const id2 = session.appendMessage(assistantMsg("2"));
			/** 变量 id3：第三条追加记录的编号；仅在当前测试作用域内有效。 */
			const id3 = session.appendMessage(userMsg("3"));
			/** 变量 _id4：当前会话树测试使用的 _id4 值；仅在当前测试作用域内有效。 */
			const _id4 = session.appendMessage(assistantMsg("4"));

			// Branch from 2: 2 -> 5 -> 6
			// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。
			session.branch(id2);
			/** 变量 id5：分支路径上的第五条记录编号；仅在当前测试作用域内有效。 */
			const id5 = session.appendMessage(userMsg("5"));
			/** 变量 _id6：当前会话树测试使用的 _id6 值；仅在当前测试作用域内有效。 */
			const _id6 = session.appendMessage(assistantMsg("6"));

			// Branch from 5: 5 -> 7
			// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。
			session.branch(id5);
			/** 变量 _id7：当前会话树测试使用的 _id7 值；仅在当前测试作用域内有效。 */
			const _id7 = session.appendMessage(userMsg("7"));

			/** 变量 tree：由会话条目构造的根节点数组；仅在当前测试作用域内有效。 */
			const tree = session.getTree();

			// Verify structure
			/** 变量 node2：编号为 id2 的树节点；仅在当前测试作用域内有效。 */
			// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。
			const node2 = tree[0].children[0];
			expect(node2.children).toHaveLength(2); // id3 and id5
			// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。

			/** 变量 node5：编号为 id5 的分支节点；仅在当前测试作用域内有效。 */
			const node5 = node2.children.find((c) => c.entry.id === id5)!;
			expect(node5.children).toHaveLength(2); // id6 and id7
			// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。

			/** 变量 node3：编号为 id3 的主路径节点；仅在当前测试作用域内有效。 */
			const node3 = node2.children.find((c) => c.entry.id === id3)!;
			expect(node3.children).toHaveLength(1); // id4
			// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。
		});
	});

	/** 测试分组：branch。 */
	describe("branch", () => {
		/** 测试场景：moves leaf pointer to specified entry。 */
		it("moves leaf pointer to specified entry", () => {
			/** 变量 session：当前场景的内存或文件型 SessionManager；仅在当前测试作用域内有效。 */
			const session = SessionManager.inMemory();

			/** 变量 id1：第一条追加记录的编号；仅在当前测试作用域内有效。 */
			const id1 = session.appendMessage(userMsg("1"));
			/** 变量 _id2：当前会话树测试使用的 _id2 值；仅在当前测试作用域内有效。 */
			const _id2 = session.appendMessage(assistantMsg("2"));
			/** 变量 id3：第三条追加记录的编号；仅在当前测试作用域内有效。 */
			const id3 = session.appendMessage(userMsg("3"));

			expect(session.getLeafId()).toBe(id3);

			session.branch(id1);
			expect(session.getLeafId()).toBe(id1);
		});

		/** 测试场景：throws for non-existent entry。 */
		it("throws for non-existent entry", () => {
			/** 变量 session：当前场景的内存或文件型 SessionManager；仅在当前测试作用域内有效。 */
			const session = SessionManager.inMemory();
			session.appendMessage(userMsg("hello"));

			expect(() => session.branch("nonexistent")).toThrow("Entry nonexistent not found");
		});

		/** 测试场景：new appends become children of branch point。 */
		it("new appends become children of branch point", () => {
			/** 变量 session：当前场景的内存或文件型 SessionManager；仅在当前测试作用域内有效。 */
			const session = SessionManager.inMemory();

			/** 变量 id1：第一条追加记录的编号；仅在当前测试作用域内有效。 */
			const id1 = session.appendMessage(userMsg("1"));
			/** 变量 _id2：当前会话树测试使用的 _id2 值；仅在当前测试作用域内有效。 */
			const _id2 = session.appendMessage(assistantMsg("2"));

			session.branch(id1);
			/** 变量 id3：第三条追加记录的编号；仅在当前测试作用域内有效。 */
			const id3 = session.appendMessage(userMsg("branched"));

			/** 变量 entries：当前会话中按追加顺序保存的全部条目；仅在当前测试作用域内有效。 */
			const entries = session.getEntries();
			/** 变量 branchedEntry：分支后新追加的消息条目；仅在当前测试作用域内有效。 */
			const branchedEntry = entries.find((e) => e.id === id3)!;
			expect(branchedEntry.parentId).toBe(id1); // sibling of id2
			// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。
		});
	});

	/** 测试分组：branchWithSummary。 */
	describe("branchWithSummary", () => {
		/** 测试场景：inserts branch summary and advances leaf。 */
		it("inserts branch summary and advances leaf", () => {
			/** 变量 session：当前场景的内存或文件型 SessionManager；仅在当前测试作用域内有效。 */
			const session = SessionManager.inMemory();

			/** 变量 id1：第一条追加记录的编号；仅在当前测试作用域内有效。 */
			const id1 = session.appendMessage(userMsg("1"));
			/** 变量 _id2：当前会话树测试使用的 _id2 值；仅在当前测试作用域内有效。 */
			const _id2 = session.appendMessage(assistantMsg("2"));
			/** 变量 _id3：当前会话树测试使用的 _id3 值；仅在当前测试作用域内有效。 */
			const _id3 = session.appendMessage(userMsg("3"));

			/** 变量 usage：用于摘要和工具记录的完整 Token 用量样例；仅在当前测试作用域内有效。 */
			const usage = {
				input: 10,
				output: 20,
				cacheRead: 30,
				cacheWrite: 40,
				totalTokens: 100,
				cost: { input: 0.1, output: 0.2, cacheRead: 0.3, cacheWrite: 0.4, total: 1 },
			};
			/** 变量 summaryId：分支摘要条目的编号；仅在当前测试作用域内有效。 */
			const summaryId = session.branchWithSummary(id1, "Summary of abandoned work", undefined, false, usage);

			expect(session.getLeafId()).toBe(summaryId);

			/** 变量 entries：当前会话中按追加顺序保存的全部条目；仅在当前测试作用域内有效。 */
			const entries = session.getEntries();
			/** 变量 summaryEntry：从条目列表找到的分支摘要记录；仅在当前测试作用域内有效。 */
			const summaryEntry = entries.find((e) => e.type === "branch_summary");
			expect(summaryEntry).toBeDefined();
			expect(summaryEntry?.parentId).toBe(id1);
			if (summaryEntry?.type === "branch_summary") {
				expect(summaryEntry.summary).toBe("Summary of abandoned work");
				expect(summaryEntry.usage).toEqual(usage);
			}
		});

		/** 测试场景：throws for non-existent entry。 */
		it("throws for non-existent entry", () => {
			/** 变量 session：当前场景的内存或文件型 SessionManager；仅在当前测试作用域内有效。 */
			const session = SessionManager.inMemory();
			session.appendMessage(userMsg("hello"));

			expect(() => session.branchWithSummary("nonexistent", "summary")).toThrow("Entry nonexistent not found");
		});
	});

	/** 测试分组：getLeafEntry。 */
	describe("getLeafEntry", () => {
		/** 测试场景：returns undefined for empty session。 */
		it("returns undefined for empty session", () => {
			/** 变量 session：当前场景的内存或文件型 SessionManager；仅在当前测试作用域内有效。 */
			const session = SessionManager.inMemory();
			expect(session.getLeafEntry()).toBeUndefined();
		});

		/** 测试场景：returns current leaf entry。 */
		it("returns current leaf entry", () => {
			/** 变量 session：当前场景的内存或文件型 SessionManager；仅在当前测试作用域内有效。 */
			const session = SessionManager.inMemory();

			session.appendMessage(userMsg("1"));
			/** 变量 id2：第二条追加记录的编号；仅在当前测试作用域内有效。 */
			const id2 = session.appendMessage(assistantMsg("2"));

			/** 变量 leaf：当前叶节点条目；仅在当前测试作用域内有效。 */
			const leaf = session.getLeafEntry();
			expect(leaf).toBeDefined();
			expect(leaf!.id).toBe(id2);
		});
	});

	/** 测试分组：getEntry。 */
	describe("getEntry", () => {
		/** 测试场景：returns undefined for non-existent id。 */
		it("returns undefined for non-existent id", () => {
			/** 变量 session：当前场景的内存或文件型 SessionManager；仅在当前测试作用域内有效。 */
			const session = SessionManager.inMemory();
			expect(session.getEntry("nonexistent")).toBeUndefined();
		});

		/** 测试场景：returns entry by id。 */
		it("returns entry by id", () => {
			/** 变量 session：当前场景的内存或文件型 SessionManager；仅在当前测试作用域内有效。 */
			const session = SessionManager.inMemory();

			/** 变量 id1：第一条追加记录的编号；仅在当前测试作用域内有效。 */
			const id1 = session.appendMessage(userMsg("first"));
			/** 变量 id2：第二条追加记录的编号；仅在当前测试作用域内有效。 */
			const id2 = session.appendMessage(assistantMsg("second"));

			/** 变量 entry1：按 id1 查询到的条目；仅在当前测试作用域内有效。 */
			const entry1 = session.getEntry(id1);
			expect(entry1).toBeDefined();
			expect(entry1?.type).toBe("message");
			if (entry1?.type === "message" && entry1.message.role === "user") {
				expect(entry1.message.content).toBe("first");
			}

			/** 变量 entry2：按 id2 查询到的条目；仅在当前测试作用域内有效。 */
			const entry2 = session.getEntry(id2);
			expect(entry2).toBeDefined();
			if (entry2?.type === "message" && entry2.message.role === "assistant") {
				expect((entry2.message.content as any)[0].text).toBe("second");
			}
		});
	});

	/** 测试分组：buildSessionContext with branches。 */
	describe("buildSessionContext with branches", () => {
		/** 测试场景：returns messages from current branch only。 */
		it("returns messages from current branch only", () => {
			/** 变量 session：当前场景的内存或文件型 SessionManager；仅在当前测试作用域内有效。 */
			const session = SessionManager.inMemory();

			// Main: 1 -> 2 -> 3
			// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。
			session.appendMessage(userMsg("msg1"));
			/** 变量 id2：第二条追加记录的编号；仅在当前测试作用域内有效。 */
			const id2 = session.appendMessage(assistantMsg("msg2"));
			session.appendMessage(userMsg("msg3"));

			// Branch from 2: 2 -> 4
			// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。
			session.branch(id2);
			session.appendMessage(assistantMsg("msg4-branch"));

			/** 变量 ctx：根据当前叶分支构建的模型上下文；仅在当前测试作用域内有效。 */
			const ctx = session.buildSessionContext();
			expect(ctx.messages).toHaveLength(3); // msg1, msg2, msg4-branch (not msg3)
			// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。

			expect((ctx.messages[0] as any).content).toBe("msg1");
			expect((ctx.messages[1] as any).content[0].text).toBe("msg2");
			expect((ctx.messages[2] as any).content[0].text).toBe("msg4-branch");
		});
	});
});

/** 测试分组：createBranchedSession。 */
describe("createBranchedSession", () => {
	/** 测试场景：throws for non-existent entry。 */
	it("throws for non-existent entry", () => {
		/** 变量 session：当前场景的内存或文件型 SessionManager；仅在当前测试作用域内有效。 */
		const session = SessionManager.inMemory();
		session.appendMessage(userMsg("hello"));

		expect(() => session.createBranchedSession("nonexistent")).toThrow("Entry nonexistent not found");
	});

	/** 测试场景：creates new session with path to specified leaf (in-memory)。 */
	it("creates new session with path to specified leaf (in-memory)", () => {
		/** 变量 session：当前场景的内存或文件型 SessionManager；仅在当前测试作用域内有效。 */
		const session = SessionManager.inMemory();

		// Build: 1 -> 2 -> 3 -> 4
		/** 变量 id1：第一条追加记录的编号；仅在当前测试作用域内有效。 */
		// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。
		const id1 = session.appendMessage(userMsg("1"));
		/** 变量 id2：第二条追加记录的编号；仅在当前测试作用域内有效。 */
		const id2 = session.appendMessage(assistantMsg("2"));
		/** 变量 id3：第三条追加记录的编号；仅在当前测试作用域内有效。 */
		const id3 = session.appendMessage(userMsg("3"));
		session.appendMessage(assistantMsg("4"));

		// Branch from 3: 3 -> 5
		// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。
		session.branch(id3);
		/** 变量 _id5：当前会话树测试使用的 _id5 值；仅在当前测试作用域内有效。 */
		const _id5 = session.appendMessage(userMsg("5"));

		// Create branched session from id2 (should only have 1 -> 2)
		/** 变量 result：创建内存分支会话的返回值；仅在当前测试作用域内有效。 */
		// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。
		const result = session.createBranchedSession(id2);
		expect(result).toBeUndefined(); // in-memory returns null
		// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。

		// Session should now only have entries 1 and 2
		/** 变量 entries：当前会话中按追加顺序保存的全部条目；仅在当前测试作用域内有效。 */
		// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。
		const entries = session.getEntries();
		expect(entries).toHaveLength(2);
		expect(entries[0].id).toBe(id1);
		expect(entries[1].id).toBe(id2);
	});

	/** 测试场景：extracts correct path from branched tree。 */
	it("extracts correct path from branched tree", () => {
		/** 变量 session：当前场景的内存或文件型 SessionManager；仅在当前测试作用域内有效。 */
		const session = SessionManager.inMemory();

		// Build: 1 -> 2 -> 3
		/** 变量 id1：第一条追加记录的编号；仅在当前测试作用域内有效。 */
		// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。
		const id1 = session.appendMessage(userMsg("1"));
		/** 变量 id2：第二条追加记录的编号；仅在当前测试作用域内有效。 */
		const id2 = session.appendMessage(assistantMsg("2"));
		session.appendMessage(userMsg("3"));

		// Branch from 2: 2 -> 4 -> 5
		// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。
		session.branch(id2);
		/** 变量 id4：分支或主路径上的第四条记录编号；仅在当前测试作用域内有效。 */
		const id4 = session.appendMessage(userMsg("4"));
		/** 变量 id5：分支路径上的第五条记录编号；仅在当前测试作用域内有效。 */
		const id5 = session.appendMessage(assistantMsg("5"));

		// Create branched session from id5 (should have 1 -> 2 -> 4 -> 5)
		// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。
		session.createBranchedSession(id5);

		/** 变量 entries：当前会话中按追加顺序保存的全部条目；仅在当前测试作用域内有效。 */
		const entries = session.getEntries();
		expect(entries).toHaveLength(4);
		expect(entries.map((e) => e.id)).toEqual([id1, id2, id4, id5]);
	});

	/** 测试场景：does not duplicate entries when forking from first user message。 */
	it("does not duplicate entries when forking from first user message", () => {
		/** 变量 tempDir：当前文件持久化用例使用的临时目录；仅在当前测试作用域内有效。 */
		const tempDir = join(tmpdir(), `session-fork-dedup-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });

		try {
			// Create a persisted session with a couple of turns
			/** 变量 session：当前场景的内存或文件型 SessionManager；仅在当前测试作用域内有效。 */
			// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。
			const session = SessionManager.create(tempDir, tempDir);
			/** 变量 id1：第一条追加记录的编号；仅在当前测试作用域内有效。 */
			const id1 = session.appendMessage(userMsg("first question"));
			session.appendMessage(assistantMsg("first answer"));
			session.appendMessage(userMsg("second question"));
			session.appendMessage(assistantMsg("second answer"));

			// Fork from the very first user message (no assistant in the branched path)
			/** 变量 newFile：创建分支后预留或写入的 JSONL 文件路径；仅在当前测试作用域内有效。 */
			// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。
			const newFile = session.createBranchedSession(id1);
			expect(newFile).toBeDefined();

			// The branched path has no assistant, so the file should not exist yet
			// (deferred to _persist on first assistant, matching newSession() contract)
			// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。
			expect(existsSync(newFile!)).toBe(false);

			// Simulate extension adding entry before assistant (like preset on turn_start)
			// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。
			session.appendCustomEntry("preset-state", { name: "plan" });

			// Now the assistant responds
			// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。
			session.appendMessage(assistantMsg("new answer"));

			// File should now exist with exactly one header and no duplicate IDs
			// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。
			expect(existsSync(newFile!)).toBe(true);
			/** 变量 content：从分支会话文件读取的 UTF-8 文本；仅在当前测试作用域内有效。 */
			const content = readFileSync(newFile!, "utf-8");
			/** 变量 lines：去除空行后的 JSONL 文本行；仅在当前测试作用域内有效。 */
			const lines = content.trim().split("\n").filter(Boolean);
			/** 变量 records：逐行解析出的会话头和条目对象；仅在当前测试作用域内有效。 */
			const records = lines.map((line) => JSON.parse(line));

			expect(records.filter((r) => r.type === "session")).toHaveLength(1);

			/** 变量 entryIds：除会话头外的所有字符串条目编号；仅在当前测试作用域内有效。 */
			const entryIds = records
				.filter((r) => r.type !== "session")
				.map((r) => r.id)
				.filter((id): id is string => typeof id === "string");
			expect(new Set(entryIds).size).toBe(entryIds.length);
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	/** 测试场景：preserves tool and summary usage across a file-backed reload。 */
	it("preserves tool and summary usage across a file-backed reload", () => {
		/** 变量 tempDir：当前文件持久化用例使用的临时目录；仅在当前测试作用域内有效。 */
		const tempDir = join(tmpdir(), `session-usage-roundtrip-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });

		try {
			/** 变量 session：当前场景的内存或文件型 SessionManager；仅在当前测试作用域内有效。 */
			const session = SessionManager.create(tempDir, tempDir);
			/** 变量 rootId：用量往返场景的根消息编号；仅在当前测试作用域内有效。 */
			const rootId = session.appendMessage(userMsg("question"));
			session.appendMessage(assistantMsg("answer"));
			/** 变量 usage：用于摘要和工具记录的完整 Token 用量样例；仅在当前测试作用域内有效。 */
			const usage = {
				input: 10,
				output: 20,
				cacheRead: 30,
				cacheWrite: 40,
				totalTokens: 100,
				cost: { input: 0.1, output: 0.2, cacheRead: 0.3, cacheWrite: 0.4, total: 1 },
			};
			session.appendMessage({
				role: "toolResult",
				toolCallId: "call-1",
				toolName: "nested-model",
				content: [{ type: "text", text: "result" }],
				isError: false,
				usage,
				timestamp: Date.now(),
			});
			session.appendCompaction("summary", rootId, 100, undefined, false, usage);
			session.branchWithSummary(rootId, "branch summary", undefined, false, usage);

			/** 变量 file：当前文件型会话的 JSONL 路径；仅在当前测试作用域内有效。 */
			const file = session.getSessionFile();
			expect(file).toBeDefined();
			/** 变量 reopened：从文件重新打开的 SessionManager；仅在当前测试作用域内有效。 */
			const reopened = SessionManager.open(file!, tempDir);
			expect(reopened.getEntries()).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ type: "compaction", usage }),
					expect.objectContaining({ type: "branch_summary", usage }),
					expect.objectContaining({
						type: "message",
						message: expect.objectContaining({ role: "toolResult", usage }),
					}),
				]),
			);
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	/** 测试场景：writes file immediately when forking from a point with assistant messages。 */
	it("writes file immediately when forking from a point with assistant messages", () => {
		/** 变量 tempDir：当前文件持久化用例使用的临时目录；仅在当前测试作用域内有效。 */
		const tempDir = join(tmpdir(), `session-fork-with-assistant-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });

		try {
			/** 变量 session：当前场景的内存或文件型 SessionManager；仅在当前测试作用域内有效。 */
			const session = SessionManager.create(tempDir, tempDir);
			session.appendMessage(userMsg("first question"));
			/** 变量 id2：第二条追加记录的编号；仅在当前测试作用域内有效。 */
			const id2 = session.appendMessage(assistantMsg("first answer"));
			session.appendMessage(userMsg("second question"));
			session.appendMessage(assistantMsg("second answer"));

			// Fork including the assistant message
			/** 变量 newFile：创建分支后预留或写入的 JSONL 文件路径；仅在当前测试作用域内有效。 */
			// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。
			const newFile = session.createBranchedSession(id2);
			expect(newFile).toBeDefined();

			// Path includes an assistant, so file should be written immediately
			// 中文说明：以上英文注释展示预期树形路径、分支位置、延迟持久化或去重检查。
			expect(existsSync(newFile!)).toBe(true);
			/** 变量 content：从分支会话文件读取的 UTF-8 文本；仅在当前测试作用域内有效。 */
			const content = readFileSync(newFile!, "utf-8");
			/** 变量 lines：去除空行后的 JSONL 文本行；仅在当前测试作用域内有效。 */
			const lines = content.trim().split("\n").filter(Boolean);
			/** 变量 records：逐行解析出的会话头和条目对象；仅在当前测试作用域内有效。 */
			const records = lines.map((line) => JSON.parse(line));
			expect(records.filter((r) => r.type === "session")).toHaveLength(1);
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});
});
