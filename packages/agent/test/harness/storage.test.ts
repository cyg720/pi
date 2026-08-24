/**
 * 文件职责：验证内存会话存储和 JSONL 文件会话存储的元数据、条目、叶节点、标签、统计与路径行为。
 * 技术维度：使用 Vitest、Node.js 文件系统、执行环境抽象以及两种 SessionStorage 实现进行单元测试。
 * 产品维度：保障对话历史能够可靠保存、恢复和统计，避免用户切换分支或重启后丢失会话状态。
 * 逻辑维度：先测试内存实现的基础语义，再覆盖 JSONL 创建、解析、追加、重载、标签和元数据读取。
 * 关键边界：测试会在临时目录写文件；损坏 JSON、非法元数据和不存在路径必须返回明确错误。
 * 新手阅读建议：先对照 InMemorySessionStorage 用例理解存储契约，再阅读 JsonlSessionStorage 的持久化场景。
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NodeExecutionEnv } from "../../src/harness/env/nodejs.ts";
import { JsonlSessionStorage, loadJsonlSessionMetadata } from "../../src/harness/session/jsonl-storage.ts";
import { InMemorySessionStorage } from "../../src/harness/session/memory-storage.ts";
import {
	type BranchSummaryEntry,
	type CompactionEntry,
	type MessageEntry,
	ok,
	type SessionMetadata,
} from "../../src/harness/types.ts";
import { createAssistantMessage, createTempDir, createUserMessage } from "./session-test-utils.ts";

/** 测试分组：InMemorySessionStorage。 */
describe("InMemorySessionStorage", () => {
	/** 测试场景：returns configured session metadata。 */
	it("returns configured session metadata", async () => {
		/** 局部变量 metadata：会话元数据样例，包含固定编号和创建时间；只在当前测试作用域内使用。 */
		const metadata: SessionMetadata = { id: "session-1", createdAt: "2026-01-01T00:00:00.000Z" };
		/** 局部变量 storage：当前用例被测的会话存储实例；只在当前测试作用域内使用。 */
		const storage = new InMemorySessionStorage({ metadata });
		expect(await storage.getMetadata()).toEqual(metadata);
	});

	/** 测试场景：copies initial entries and persists leaf changes。 */
	it("copies initial entries and persists leaf changes", async () => {
		/** 局部变量 entry：单条消息会话条目样例；只在当前测试作用域内使用。 */
		const entry: MessageEntry = {
			type: "message",
			id: "entry-1",
			parentId: null,
			timestamp: "2026-01-01T00:00:00.000Z",
			message: createUserMessage("one"),
		};
		/** 局部变量 initialEntries：传给内存存储的初始条目数组，用于验证构造时复制；只在当前测试作用域内使用。 */
		const initialEntries = [entry];
		/** 局部变量 storage：当前用例被测的会话存储实例；只在当前测试作用域内使用。 */
		const storage = new InMemorySessionStorage({ entries: initialEntries });
		initialEntries.push({ ...entry, id: "entry-2" });
		expect((await storage.getEntries()).map((storedEntry) => storedEntry.id)).toEqual(["entry-1"]);
		expect(await storage.getLeafId()).toBe("entry-1");
		await storage.setLeafId(null);
		expect(await storage.getLeafId()).toBeNull();
		expect((await storage.getEntries()).at(-1)).toMatchObject({ type: "leaf", targetId: null });
	});

	/** 测试场景：rejects invalid leaf ids。 */
	it("rejects invalid leaf ids", async () => {
		/** 局部变量 storage：当前用例被测的会话存储实例；只在当前测试作用域内使用。 */
		const storage = new InMemorySessionStorage();
		await expect(storage.setLeafId("missing")).rejects.toThrow("Entry missing not found");
	});

	/** 测试场景：finds entries by type。 */
	it("finds entries by type", async () => {
		/** 局部变量 entry：单条消息会话条目样例；只在当前测试作用域内使用。 */
		const entry: MessageEntry = {
			type: "message",
			id: "entry-1",
			parentId: null,
			timestamp: "2026-01-01T00:00:00.000Z",
			message: createUserMessage("one"),
		};
		/** 局部变量 storage：当前用例被测的会话存储实例；只在当前测试作用域内使用。 */
		const storage = new InMemorySessionStorage({ entries: [entry] });
		expect((await storage.findEntries("message")).map((found) => found.id)).toEqual(["entry-1"]);
		expect(await storage.findEntries("session_info")).toEqual([]);
	});

	/** 测试场景：maintains label lookup。 */
	it("maintains label lookup", async () => {
		/** 局部变量 entry：单条消息会话条目样例；只在当前测试作用域内使用。 */
		const entry: MessageEntry = {
			type: "message",
			id: "entry-1",
			parentId: null,
			timestamp: "2026-01-01T00:00:00.000Z",
			message: createUserMessage("one"),
		};
		/** 局部变量 storage：当前用例被测的会话存储实例；只在当前测试作用域内使用。 */
		const storage = new InMemorySessionStorage({ entries: [entry] });
		expect(await storage.getLabel("entry-1")).toBeUndefined();
		await storage.appendEntry({
			type: "label",
			id: "label-1",
			parentId: "entry-1",
			timestamp: "2026-01-01T00:00:01.000Z",
			targetId: "entry-1",
			label: "checkpoint",
		});
		expect(await storage.getLabel("entry-1")).toBe("checkpoint");
		await storage.appendEntry({
			type: "label",
			id: "label-2",
			parentId: "label-1",
			timestamp: "2026-01-01T00:00:02.000Z",
			targetId: "entry-1",
			label: undefined,
		});
		expect(await storage.getLabel("entry-1")).toBeUndefined();
	});

	/** 测试场景：includes summary-entry usage in session stats。 */
	it("includes summary-entry usage in session stats", async () => {
		/** 局部变量 assistant：带完整用量信息的助手消息条目；只在当前测试作用域内使用。 */
		const assistant: MessageEntry = {
			type: "message",
			id: "assistant",
			parentId: null,
			timestamp: "2026-01-01T00:00:00.000Z",
			message: {
				role: "assistant",
				content: [{ type: "text", text: "reply" }],
				api: "anthropic-messages",
				provider: "anthropic",
				model: "claude-sonnet-4-5",
				usage: {
					input: 10,
					output: 20,
					cacheRead: 30,
					cacheWrite: 40,
					totalTokens: 100,
					cost: { input: 0.1, output: 0.2, cacheRead: 0.3, cacheWrite: 0.4, total: 1 },
				},
				stopReason: "stop",
				timestamp: 0,
			},
		};
		/** 局部变量 compaction：压缩摘要条目，用于验证统计量累加和路径截断；只在当前测试作用域内使用。 */
		const compaction: CompactionEntry = {
			type: "compaction",
			id: "compaction",
			parentId: "assistant",
			timestamp: "2026-01-01T00:00:01.000Z",
			summary: "summary",
			firstKeptEntryId: "assistant",
			tokensBefore: 1234,
			usage: {
				input: 1,
				output: 2,
				cacheRead: 3,
				cacheWrite: 4,
				totalTokens: 10,
				cost: { input: 0.01, output: 0.02, cacheRead: 0.03, cacheWrite: 0.04, total: 0.1 },
			},
		};
		/** 局部变量 branchSummary：分支摘要条目，用于验证其用量计入会话统计；只在当前测试作用域内使用。 */
		const branchSummary: BranchSummaryEntry = {
			type: "branch_summary",
			id: "branch-summary",
			parentId: "compaction",
			timestamp: "2026-01-01T00:00:02.000Z",
			fromId: "assistant",
			summary: "branch",
			usage: {
				input: 5,
				output: 6,
				cacheRead: 7,
				cacheWrite: 8,
				totalTokens: 26,
				cost: { input: 0.05, output: 0.06, cacheRead: 0.07, cacheWrite: 0.08, total: 0.26 },
			},
		};
		/** 局部变量 storage：当前用例被测的会话存储实例；只在当前测试作用域内使用。 */
		const storage = new InMemorySessionStorage({ entries: [assistant, compaction, branchSummary] });
		expect(await storage.getSessionStats()).toEqual({
			messageCount: 1,
			cachedTokens: 40,
			uncachedTokens: 68,
			totalTokens: 136,
			costTotal: 1.36,
		});
	});

	/** 测试场景：walks paths to root or retained-tail compaction。 */
	it("walks paths to root or retained-tail compaction", async () => {
		/** 局部变量 root：会话树根消息条目；只在当前测试作用域内使用。 */
		const root: MessageEntry = {
			type: "message",
			id: "root",
			parentId: null,
			timestamp: "2026-01-01T00:00:00.000Z",
			message: createUserMessage("root"),
		};
		/** 局部变量 child：挂在根节点下的子消息条目；只在当前测试作用域内使用。 */
		const child: MessageEntry = {
			...root,
			id: "child",
			parentId: "root",
			message: createAssistantMessage("child"),
		};
		/** 局部变量 compaction：压缩摘要条目，用于验证统计量累加和路径截断；只在当前测试作用域内使用。 */
		const compaction: CompactionEntry = {
			type: "compaction",
			id: "compaction",
			parentId: "child",
			timestamp: "2026-01-01T00:00:01.000Z",
			summary: "summary",
			firstKeptEntryId: "child",
			tokensBefore: 1234,
			retainedTail: [createAssistantMessage("child")],
		};
		/** 局部变量 afterCompaction：压缩条目之后追加的用户消息；只在当前测试作用域内使用。 */
		const afterCompaction: MessageEntry = {
			...root,
			id: "after-compaction",
			parentId: "compaction",
			message: createUserMessage("after"),
		};
		/** 局部变量 storage：当前用例被测的会话存储实例；只在当前测试作用域内使用。 */
		const storage = new InMemorySessionStorage({ entries: [root, child, compaction, afterCompaction] });
		expect((await storage.getPathToRootOrCompaction("child")).map((entry) => entry.id)).toEqual(["root", "child"]);
		expect((await storage.getPathToRootOrCompaction("after-compaction")).map((entry) => entry.id)).toEqual([
			"compaction",
			"after-compaction",
		]);
		expect(await storage.getPathToRootOrCompaction(null)).toEqual([]);
	});
});

/** 测试分组：JsonlSessionStorage。 */
describe("JsonlSessionStorage", () => {
	/** 测试场景：throws for missing files when opening。 */
	it("throws for missing files when opening", async () => {
		/** 局部变量 dir：本用例独享的临时目录；只在当前测试作用域内使用。 */
		const dir = createTempDir();
		/** 局部变量 env：基于临时目录创建的 Node 执行环境；只在当前测试作用域内使用。 */
		const env = new NodeExecutionEnv({ cwd: dir });
		/** 局部变量 filePath：当前用例读写的 session.jsonl 路径；只在当前测试作用域内使用。 */
		const filePath = join(dir, "session.jsonl");
		await expect(JsonlSessionStorage.open(env, filePath)).rejects.toMatchObject({ code: "not_found" });
	});

	/** 测试场景：writes the header on create。 */
	it("writes the header on create", async () => {
		/** 局部变量 dir：本用例独享的临时目录；只在当前测试作用域内使用。 */
		const dir = createTempDir();
		/** 局部变量 env：基于临时目录创建的 Node 执行环境；只在当前测试作用域内使用。 */
		const env = new NodeExecutionEnv({ cwd: dir });
		/** 局部变量 filePath：当前用例读写的 session.jsonl 路径；只在当前测试作用域内使用。 */
		const filePath = join(dir, "session.jsonl");
		/** 局部变量 storage：当前用例被测的会话存储实例；只在当前测试作用域内使用。 */
		const storage = await JsonlSessionStorage.create(env, filePath, { cwd: dir, sessionId: "session-1" });
		expect(existsSync(filePath)).toBe(true);
		expect(readFileSync(filePath, "utf8").trim().split("\n")).toHaveLength(1);
		expect(await storage.getLeafId()).toBeNull();
		expect(await storage.getEntries()).toEqual([]);
		await storage.appendEntry({
			type: "message",
			id: "user-1",
			parentId: null,
			timestamp: "2026-01-01T00:00:00.000Z",
			message: createUserMessage("one"),
		});
		/** 局部变量 lines：从会话文件读取并按行拆分的 JSONL 文本；只在当前测试作用域内使用。 */
		const lines = readFileSync(filePath, "utf8").trim().split("\n");
		expect(JSON.parse(lines[0]!).type).toBe("session");
		expect(JSON.parse(lines[1]!).id).toBe("user-1");
		expect(lines).toHaveLength(2);
	});

	/** 测试场景：throws for malformed session headers。 */
	it("throws for malformed session headers", async () => {
		/** 局部变量 dir：本用例独享的临时目录；只在当前测试作用域内使用。 */
		const dir = createTempDir();
		/** 局部变量 env：基于临时目录创建的 Node 执行环境；只在当前测试作用域内使用。 */
		const env = new NodeExecutionEnv({ cwd: dir });
		/** 局部变量 filePath：当前用例读写的 session.jsonl 路径；只在当前测试作用域内使用。 */
		const filePath = join(dir, "session.jsonl");
		writeFileSync(filePath, "not json\n");
		await expect(JsonlSessionStorage.open(env, filePath)).rejects.toThrow("first line is not a valid session header");
	});

	/** 测试场景：throws for malformed entry lines。 */
	it("throws for malformed entry lines", async () => {
		/** 局部变量 dir：本用例独享的临时目录；只在当前测试作用域内使用。 */
		const dir = createTempDir();
		/** 局部变量 env：基于临时目录创建的 Node 执行环境；只在当前测试作用域内使用。 */
		const env = new NodeExecutionEnv({ cwd: dir });
		/** 局部变量 filePath：当前用例读写的 session.jsonl 路径；只在当前测试作用域内使用。 */
		const filePath = join(dir, "session.jsonl");
		/** 局部变量 header：手工构造的会话文件头，供异常或元数据场景使用；只在当前测试作用域内使用。 */
		const header = {
			type: "session",
			version: 3,
			id: "session-1",
			timestamp: "2026-01-01T00:00:00.000Z",
			cwd: dir,
		};
		/** 局部变量 entry：单条消息会话条目样例；只在当前测试作用域内使用。 */
		const entry: MessageEntry = {
			type: "message",
			id: "entry-1",
			parentId: null,
			timestamp: "2026-01-01T00:00:00.000Z",
			message: createUserMessage("one"),
		};
		writeFileSync(filePath, `${JSON.stringify(header)}\nnot json\n${JSON.stringify(entry)}\n`);
		await expect(JsonlSessionStorage.open(env, filePath)).rejects.toMatchObject({ code: "invalid_entry" });
	});

	/** 测试场景：creates and reads session metadata from the header。 */
	it("creates and reads session metadata from the header", async () => {
		/** 局部变量 dir：本用例独享的临时目录；只在当前测试作用域内使用。 */
		const dir = createTempDir();
		/** 局部变量 env：基于临时目录创建的 Node 执行环境；只在当前测试作用域内使用。 */
		const env = new NodeExecutionEnv({ cwd: dir });
		/** 局部变量 filePath：当前用例读写的 session.jsonl 路径；只在当前测试作用域内使用。 */
		const filePath = join(dir, "session.jsonl");
		/** 局部变量 storage：当前用例被测的会话存储实例；只在当前测试作用域内使用。 */
		const storage = await JsonlSessionStorage.create(env, filePath, {
			cwd: dir,
			sessionId: "session-1",
			parentSessionPath: "/tmp/parent.jsonl",
		});
		/** 局部变量 metadata：会话元数据样例，包含固定编号和创建时间；只在当前测试作用域内使用。 */
		const metadata = await storage.getMetadata();
		expect(metadata).toMatchObject({
			id: "session-1",
			cwd: dir,
			path: filePath,
			parentSessionPath: "/tmp/parent.jsonl",
		});
		await storage.appendEntry({
			type: "message",
			id: "user-1",
			parentId: null,
			timestamp: "2026-01-01T00:00:00.000Z",
			message: createUserMessage("one"),
		});
		expect(await loadJsonlSessionMetadata(env, filePath)).toEqual(metadata);
	});

	/** 测试场景：round-trips custom header metadata。 */
	it("round-trips custom header metadata", async () => {
		/** 局部变量 dir：本用例独享的临时目录；只在当前测试作用域内使用。 */
		const dir = createTempDir();
		/** 局部变量 env：基于临时目录创建的 Node 执行环境；只在当前测试作用域内使用。 */
		const env = new NodeExecutionEnv({ cwd: dir });
		/** 局部变量 filePath：当前用例读写的 session.jsonl 路径；只在当前测试作用域内使用。 */
		const filePath = join(dir, "session.jsonl");
		/** 局部变量 storage：当前用例被测的会话存储实例；只在当前测试作用域内使用。 */
		const storage = await JsonlSessionStorage.create(env, filePath, {
			cwd: dir,
			sessionId: "session-1",
			metadata: { profile: "reviewer" },
		});
		expect((await storage.getMetadata()).metadata).toEqual({ profile: "reviewer" });
		/** 局部变量 loaded：从磁盘重新打开的会话存储实例；只在当前测试作用域内使用。 */
		const loaded = await JsonlSessionStorage.open(env, filePath);
		expect((await loaded.getMetadata()).metadata).toEqual({ profile: "reviewer" });
		expect((await loadJsonlSessionMetadata(env, filePath)).metadata).toEqual({ profile: "reviewer" });
	});

	/** 测试场景：omits header metadata when not provided。 */
	it("omits header metadata when not provided", async () => {
		/** 局部变量 dir：本用例独享的临时目录；只在当前测试作用域内使用。 */
		const dir = createTempDir();
		/** 局部变量 env：基于临时目录创建的 Node 执行环境；只在当前测试作用域内使用。 */
		const env = new NodeExecutionEnv({ cwd: dir });
		/** 局部变量 filePath：当前用例读写的 session.jsonl 路径；只在当前测试作用域内使用。 */
		const filePath = join(dir, "session.jsonl");
		await JsonlSessionStorage.create(env, filePath, { cwd: dir, sessionId: "session-1" });
		expect(JSON.parse(readFileSync(filePath, "utf8").trim())).not.toHaveProperty("metadata");
		expect((await loadJsonlSessionMetadata(env, filePath)).metadata).toBeUndefined();
	});

	/** 测试场景：throws for non-object header metadata。 */
	it("throws for non-object header metadata", async () => {
		/** 局部变量 dir：本用例独享的临时目录；只在当前测试作用域内使用。 */
		const dir = createTempDir();
		/** 局部变量 env：基于临时目录创建的 Node 执行环境；只在当前测试作用域内使用。 */
		const env = new NodeExecutionEnv({ cwd: dir });
		/** 局部变量 filePath：当前用例读写的 session.jsonl 路径；只在当前测试作用域内使用。 */
		const filePath = join(dir, "session.jsonl");
		/** 局部变量 header：手工构造的会话文件头，供异常或元数据场景使用；只在当前测试作用域内使用。 */
		const header = {
			type: "session",
			version: 3,
			id: "session-1",
			timestamp: "2026-01-01T00:00:00.000Z",
			cwd: dir,
			metadata: "profile",
		};
		writeFileSync(filePath, `${JSON.stringify(header)}\n`);
		await expect(JsonlSessionStorage.open(env, filePath)).rejects.toThrow(
			"session header metadata must be an object",
		);
	});

	/** 测试场景：loads existing entries and reconstructs leaf。 */
	it("loads existing entries and reconstructs leaf", async () => {
		/** 局部变量 dir：本用例独享的临时目录；只在当前测试作用域内使用。 */
		const dir = createTempDir();
		/** 局部变量 env：基于临时目录创建的 Node 执行环境；只在当前测试作用域内使用。 */
		const env = new NodeExecutionEnv({ cwd: dir });
		/** 局部变量 filePath：当前用例读写的 session.jsonl 路径；只在当前测试作用域内使用。 */
		const filePath = join(dir, "session.jsonl");
		/** 局部变量 storage：当前用例被测的会话存储实例；只在当前测试作用域内使用。 */
		const storage = await JsonlSessionStorage.create(env, filePath, { cwd: dir, sessionId: "session-1" });
		/** 局部变量 root：会话树根消息条目；只在当前测试作用域内使用。 */
		const root: MessageEntry = {
			type: "message",
			id: "root",
			parentId: null,
			timestamp: "2026-01-01T00:00:00.000Z",
			message: createUserMessage("root"),
		};
		/** 局部变量 child：挂在根节点下的子消息条目；只在当前测试作用域内使用。 */
		const child: MessageEntry = {
			...root,
			id: "child",
			parentId: "root",
			message: createAssistantMessage("child"),
		};
		await storage.appendEntry(root);
		await storage.appendEntry(child);
		/** 局部变量 loaded：从磁盘重新打开的会话存储实例；只在当前测试作用域内使用。 */
		const loaded = await JsonlSessionStorage.open(env, filePath);
		expect(await loaded.getLeafId()).toBe("child");
		expect((await loaded.getEntries()).map((entry) => entry.id)).toEqual(["root", "child"]);
		await loaded.setLeafId("root");
		/** 局部变量 reloaded：再次打开的存储实例，用于验证叶节点持久化结果；只在当前测试作用域内使用。 */
		const reloaded = await JsonlSessionStorage.open(env, filePath);
		expect(await reloaded.getLeafId()).toBe("root");
		expect((await reloaded.getEntries()).at(-1)).toMatchObject({ type: "leaf", targetId: "root" });
		expect((await loaded.getPathToRootOrCompaction("child")).map((entry) => entry.id)).toEqual(["root", "child"]);
	});

	/** 测试场景：finds entries by type。 */
	it("finds entries by type", async () => {
		/** 局部变量 dir：本用例独享的临时目录；只在当前测试作用域内使用。 */
		const dir = createTempDir();
		/** 局部变量 env：基于临时目录创建的 Node 执行环境；只在当前测试作用域内使用。 */
		const env = new NodeExecutionEnv({ cwd: dir });
		/** 局部变量 filePath：当前用例读写的 session.jsonl 路径；只在当前测试作用域内使用。 */
		const filePath = join(dir, "session.jsonl");
		/** 局部变量 storage：当前用例被测的会话存储实例；只在当前测试作用域内使用。 */
		const storage = await JsonlSessionStorage.create(env, filePath, { cwd: dir, sessionId: "session-1" });
		await storage.appendEntry({
			type: "message",
			id: "entry-1",
			parentId: null,
			timestamp: "2026-01-01T00:00:00.000Z",
			message: createUserMessage("one"),
		});
		expect((await storage.findEntries("message")).map((found) => found.id)).toEqual(["entry-1"]);
		expect(await storage.findEntries("session_info")).toEqual([]);
	});

	/** 测试场景：maintains label lookup。 */
	it("maintains label lookup", async () => {
		/** 局部变量 dir：本用例独享的临时目录；只在当前测试作用域内使用。 */
		const dir = createTempDir();
		/** 局部变量 env：基于临时目录创建的 Node 执行环境；只在当前测试作用域内使用。 */
		const env = new NodeExecutionEnv({ cwd: dir });
		/** 局部变量 filePath：当前用例读写的 session.jsonl 路径；只在当前测试作用域内使用。 */
		const filePath = join(dir, "session.jsonl");
		/** 局部变量 storage：当前用例被测的会话存储实例；只在当前测试作用域内使用。 */
		const storage = await JsonlSessionStorage.create(env, filePath, { cwd: dir, sessionId: "session-1" });
		await storage.appendEntry({
			type: "message",
			id: "entry-1",
			parentId: null,
			timestamp: "2026-01-01T00:00:00.000Z",
			message: createUserMessage("one"),
		});
		expect(await storage.getLabel("entry-1")).toBeUndefined();
		await storage.appendEntry({
			type: "label",
			id: "label-1",
			parentId: "entry-1",
			timestamp: "2026-01-01T00:00:01.000Z",
			targetId: "entry-1",
			label: "checkpoint",
		});
		expect(await storage.getLabel("entry-1")).toBe("checkpoint");
		await storage.appendEntry({
			type: "label",
			id: "label-2",
			parentId: "label-1",
			timestamp: "2026-01-01T00:00:02.000Z",
			targetId: "entry-1",
			label: undefined,
		});
		expect(await storage.getLabel("entry-1")).toBeUndefined();
		/** 局部变量 loaded：从磁盘重新打开的会话存储实例；只在当前测试作用域内使用。 */
		const loaded = await JsonlSessionStorage.open(env, filePath);
		expect(await loaded.getLabel("entry-1")).toBeUndefined();
	});

	/** 测试场景：includes summary-entry usage in session stats。 */
	it("includes summary-entry usage in session stats", async () => {
		/** 局部变量 dir：本用例独享的临时目录；只在当前测试作用域内使用。 */
		const dir = createTempDir();
		/** 局部变量 env：基于临时目录创建的 Node 执行环境；只在当前测试作用域内使用。 */
		const env = new NodeExecutionEnv({ cwd: dir });
		/** 局部变量 filePath：当前用例读写的 session.jsonl 路径；只在当前测试作用域内使用。 */
		const filePath = join(dir, "session.jsonl");
		/** 局部变量 storage：当前用例被测的会话存储实例；只在当前测试作用域内使用。 */
		const storage = await JsonlSessionStorage.create(env, filePath, { cwd: dir, sessionId: "session-1" });
		await storage.appendEntry({
			type: "message",
			id: "assistant",
			parentId: null,
			timestamp: "2026-01-01T00:00:00.000Z",
			message: {
				role: "assistant",
				content: [{ type: "text", text: "reply" }],
				api: "anthropic-messages",
				provider: "anthropic",
				model: "claude-sonnet-4-5",
				usage: {
					input: 10,
					output: 20,
					cacheRead: 30,
					cacheWrite: 40,
					totalTokens: 100,
					cost: { input: 0.1, output: 0.2, cacheRead: 0.3, cacheWrite: 0.4, total: 1 },
				},
				stopReason: "stop",
				timestamp: 0,
			},
		});
		await storage.appendEntry({
			type: "compaction",
			id: "compaction",
			parentId: "assistant",
			timestamp: "2026-01-01T00:00:01.000Z",
			summary: "summary",
			firstKeptEntryId: "assistant",
			tokensBefore: 1234,
			usage: {
				input: 1,
				output: 2,
				cacheRead: 3,
				cacheWrite: 4,
				totalTokens: 10,
				cost: { input: 0.01, output: 0.02, cacheRead: 0.03, cacheWrite: 0.04, total: 0.1 },
			},
		});
		await storage.appendEntry({
			type: "branch_summary",
			id: "branch-summary",
			parentId: "compaction",
			timestamp: "2026-01-01T00:00:02.000Z",
			fromId: "assistant",
			summary: "branch",
			usage: {
				input: 5,
				output: 6,
				cacheRead: 7,
				cacheWrite: 8,
				totalTokens: 26,
				cost: { input: 0.05, output: 0.06, cacheRead: 0.07, cacheWrite: 0.08, total: 0.26 },
			},
		});
		expect(await storage.getSessionStats()).toEqual({
			messageCount: 1,
			cachedTokens: 40,
			uncachedTokens: 68,
			totalTokens: 136,
			costTotal: 1.36,
		});
	});

	/** 测试场景：reads session metadata through the line-reading filesystem operation。 */
	it("reads session metadata through the line-reading filesystem operation", async () => {
		/** 局部变量 dir：本用例独享的临时目录；只在当前测试作用域内使用。 */
		const dir = createTempDir();
		/** 局部变量 filePath：当前用例读写的 session.jsonl 路径；只在当前测试作用域内使用。 */
		const filePath = join(dir, "session.jsonl");
		/** 局部变量 header：手工构造的会话文件头，供异常或元数据场景使用；只在当前测试作用域内使用。 */
		const header = {
			type: "session",
			version: 3,
			id: "session-1",
			timestamp: "2026-01-01T00:00:00.000Z",
			cwd: dir,
		};
		/** 局部变量 metadata：会话元数据样例，包含固定编号和创建时间；只在当前测试作用域内使用。 */
		const metadata = await loadJsonlSessionMetadata(
			{
				readTextLines: async () => ok([JSON.stringify(header)]),
				readTextFile: async () => {
					throw new Error("readTextFile should not be called for metadata");
				},
				writeFile: async () => ok(undefined),
				appendFile: async () => ok(undefined),
			},
			filePath,
		);
		expect(metadata).toEqual({
			id: "session-1",
			createdAt: "2026-01-01T00:00:00.000Z",
			cwd: dir,
			path: filePath,
			parentSessionPath: undefined,
		});
	});
});
