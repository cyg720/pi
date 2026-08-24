/**
 * 文件职责：验证 SQLite 会话仓库的迁移、分支物化、分页、元数据和异常清理行为。
 * 技术维度：使用 Vitest、Node 临时目录、SQLite 适配接口及可注入失败的测试替身执行存储集成测试。
 * 产品维度：保障会话数据升级后可继续打开、分叉和恢复，并在写入失败时不泄漏连接或缓存脏状态。
 * 逻辑维度：先定义可控语句与数据库替身，再覆盖迁移结构、正常读写、分支物化及事务回滚场景。
 * 关键边界：测试会创建真实临时数据库；故障用例依赖精确 SQL 前缀来注入异常，不代表通用 SQL 模拟器。
 * 新手阅读建议：先看首个迁移用例理解表结构，再读分支与物化用例，最后关注三个失败清理测试。
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	applyMigrations,
	createNodeSqliteFactory,
	type SqliteDatabase,
	type SqliteDatabaseFactory,
	type SqliteRunResult,
	type SqliteSessionMetadata,
	SqliteSessionRepo,
	SqliteSessionStorage,
	type SqliteStatement,
} from "../../../storage/sqlite-node/src/index.ts";
import { NodeExecutionEnv } from "../../src/harness/env/nodejs.ts";
import { createAssistantMessage, createUserMessage } from "./session-test-utils.ts";

/** 创建当前用例独享的 SQLite 临时目录。无参数；返回目录路径。例如：createTempDir()。 */
function createTempDir(): string {
	return mkdtempSync(join(tmpdir(), "pi-agent-sqlite-"));
}

/** 可由回调决定 run 行为的语句替身，用于精确模拟某条 SQL 写入失败。 */
class ThrowingStatement implements SqliteStatement {
	/** run 时执行的异步回调，可返回结果或主动抛错。 */
	private readonly onRun: () => Promise<SqliteRunResult>;

	/** 保存 run 回调。参数 onRun 定义执行结果；构造函数无返回值。例如：new ThrowingStatement(async () => ({ changes: 1 }))。 */
	constructor(onRun: () => Promise<SqliteRunResult>) {
		this.onRun = onRun;
	}

	/** 执行预设回调。参数 _params 仅满足接口且被忽略；返回回调结果。例如：await statement.run()。 */
	async run(..._params: unknown[]): Promise<SqliteRunResult> {
		return this.onRun();
	}

	/** 模拟查询单行。参数被忽略；固定返回 undefined。例如：await statement.get()。 */
	async get<TRow extends object>(..._params: unknown[]): Promise<TRow | undefined> {
		return undefined;
	}

	/** 模拟查询多行。参数被忽略；固定返回空数组。例如：await statement.all()。 */
	async all<TRow extends object>(..._params: unknown[]): Promise<TRow[]> {
		return [];
	}
}

/** 记录 close 次数并按 SQL 生成语句的数据库替身，用于验证失败路径释放资源。 */
class CountingDatabase implements SqliteDatabase {
	/** close 被调用的累计次数，初始为 0。 */
	closeCount = 0;
	/** 根据 SQL 文本选择测试语句行为的工厂。 */
	private readonly statementFactory: (sql: string) => SqliteStatement;

	/** 保存语句工厂。参数 statementFactory 接收 SQL 并返回替身；无返回值。例如：new CountingDatabase(factory)。 */
	constructor(statementFactory: (sql: string) => SqliteStatement) {
		this.statementFactory = statementFactory;
	}

	/** 模拟执行无返回 SQL。参数 _sql 被忽略；返回已完成 Promise。例如：await db.exec(sql)。 */
	async exec(_sql: string): Promise<void> {}

	/** 用工厂创建预备语句。参数 sql 为原始 SQL；返回 SqliteStatement。例如：db.prepare(sql)。 */
	prepare(sql: string): SqliteStatement {
		return this.statementFactory(sql);
	}

	/** 直接执行事务回调。参数 fn 为工作函数；返回其结果。例如：await db.transaction(fn)。 */
	async transaction<T>(fn: () => Promise<T>): Promise<T> {
		return fn();
	}

	/** 记录一次关闭操作。无参数、无业务返回值。例如：await db.close()。 */
	async close(): Promise<void> {
		this.closeCount += 1;
	}
}

describe("SQLite migrations", () => {
	// 验证文件迁移被执行、记录，并创建预期的 WITHOUT ROWID 表与列。
	it("applies file-based migrations and records them", async () => {
		/** 当前用例的临时根目录。 */
		const root = createTempDir();
		/** 会话 SQLite 数据库路径。 */
		const databasePath = join(root, "sessions.sqlite");
		/** 以临时目录为工作目录的 Node 执行环境。 */
		const env = new NodeExecutionEnv({ cwd: root });
		/** 使用 Node 内置 SQLite 的数据库工厂。 */
		const sqlite = createNodeSqliteFactory();
		/** 触发迁移并管理会话的 SQLite 仓库。 */
		const repo = new SqliteSessionRepo({ env, sqlite, databasePath });
		await repo.create({ cwd: root, id: "session-1" });

		/** 迁移完成后用于检查结构的数据库连接。 */
		const db = await sqlite.open(databasePath);
		try {
			/** migrations 表中按编号排序的迁移记录。 */
			const rows = await db.prepare("SELECT id FROM migrations ORDER BY id").all<{ id: string }>();
			expect(rows.map((row) => row.id)).toEqual(["001_initial.sql"]);
			/** sqlite_master 中的全部表名和建表 SQL。 */
			const tables = await db
				.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY name")
				.all<{ name: string; sql: string | null }>();
			expect(tables.map((row) => row.name)).toEqual(
				expect.arrayContaining([
					"migrations",
					"sessions",
					"session_entries",
					"session_sequences",
					"branch_entries",
					"session_materialized",
					"entry_materialized",
				]),
			);
			/** sessions 表当前列信息。 */
			const sessionColumns = await db.prepare("PRAGMA table_info(sessions)").all<{ name: string }>();
			expect(sessionColumns.map((column) => column.name)).toContain("active_leaf_id");
			for (const tableName of [
				"sessions",
				"session_sequences",
				"branch_entries",
				"session_materialized",
				"entry_materialized",
			]) {
				/** 当前预期表在 sqlite_master 中的记录。 */
				const table = tables.find((row) => row.name === tableName);
				expect(table?.sql).toContain("WITHOUT ROWID");
			}
		} finally {
			await db.close();
		}
	});

	// 验证元数据在创建、列表、重开和分叉时继承，并允许分叉时覆盖。
	it("persists session metadata through create, list, open, and fork", async () => {
		/** 当前用例的临时根目录。 */
		const root = createTempDir();
		/** 会话数据库路径。 */
		const databasePath = join(root, "sessions.sqlite");
		/** 临时 Node 执行环境。 */
		const env = new NodeExecutionEnv({ cwd: root });
		/** 用于元数据操作的会话仓库。 */
		const repo = new SqliteSessionRepo({ env, sqlite: createNodeSqliteFactory(), databasePath });
		/** 带 reviewer 元数据的新建源会话。 */
		const source = await repo.create({
			cwd: root,
			id: "session-1",
			metadata: { profile: "reviewer" },
		});
		/** 源会话持久化后的完整元数据。 */
		const sourceMetadata = await source.getMetadata();
		expect(sourceMetadata.metadata).toEqual({ profile: "reviewer" });
		expect((await repo.list({ cwd: root })).map((listed) => listed.metadata)).toEqual([{ profile: "reviewer" }]);
		expect((await (await repo.open(sourceMetadata)).getMetadata()).metadata).toEqual({ profile: "reviewer" });
		/** 未显式覆盖元数据的分叉会话。 */
		const fork = await repo.fork(sourceMetadata, { cwd: root, id: "session-2" });
		expect((await fork.getMetadata()).metadata).toEqual({ profile: "reviewer" });
		/** 显式把 profile 覆盖为 writer 的分叉会话。 */
		const overridden = await repo.fork(sourceMetadata, {
			cwd: root,
			id: "session-3",
			metadata: { profile: "writer" },
		});
		expect((await overridden.getMetadata()).metadata).toEqual({ profile: "writer" });
	});

	// 验证活动叶子编号与分支条目在同一事务内物化并可重开恢复。
	it("materializes active leaf id in sessions transactionally", async () => {
		/** 当前用例的临时根目录。 */
		const root = createTempDir();
		/** 会话数据库路径。 */
		const databasePath = join(root, "sessions.sqlite");
		/** 临时 Node 执行环境。 */
		const env = new NodeExecutionEnv({ cwd: root });
		/** SQLite 数据库工厂。 */
		const sqlite = createNodeSqliteFactory();
		/** 当前用例的会话仓库。 */
		const repo = new SqliteSessionRepo({ env, sqlite, databasePath });
		/** 新建的测试会话。 */
		const session = await repo.create({ cwd: root, id: "session-1" });
		/** 会话根用户消息编号。 */
		const rootId = await session.appendMessage(createUserMessage("root"));
		/** 根消息之后的助手子消息编号。 */
		const childId = await session.appendMessage(createAssistantMessage("child"));
		await session.getStorage().setLeafId(rootId);

		/** 用于直接检查物化表的数据库连接。 */
		const db = await sqlite.open(databasePath);
		try {
			/** sessions 表中保存的活动叶子行。 */
			const row = await db
				.prepare("SELECT active_leaf_id FROM sessions WHERE id = ?")
				.get<{ active_leaf_id: string | null }>("session-1");
			expect(row?.active_leaf_id).toBe(rootId);
			/** branch_entries 中最新的分支条目。 */
			const latestBranchRow = await db
				.prepare(
					"SELECT branch_id, entry_id, entry_seq FROM branch_entries WHERE session_id = ? ORDER BY entry_seq DESC LIMIT 1",
				)
				.get<{ branch_id: string; entry_id: string; entry_seq: number }>("session-1");
			/** session_entries 中最新写入的叶子变更条目。 */
			const latestSessionEntry = await db
				.prepare("SELECT id, type FROM session_entries WHERE session_id = ? ORDER BY entry_seq DESC LIMIT 1")
				.get<{ id: string; type: string }>("session-1");
			expect(latestSessionEntry?.type).toBe("leaf");
			expect(latestBranchRow?.entry_id).toBe(latestSessionEntry?.id);
		} finally {
			await db.close();
		}

		/** 从持久化元数据重新打开的会话。 */
		const reopened = await repo.open(await session.getMetadata());
		expect(await reopened.getLeafId()).toBe(rootId);
		expect(childId).not.toBe(rootId);
	});

	// 从已有子节点的父节点追加内容时，应建立新的分支物化记录。
	it("materializes a new branch when appending from a parent with an existing child", async () => {
		/** 当前用例的临时根目录。 */
		const root = createTempDir();
		/** 会话数据库路径。 */
		const databasePath = join(root, "sessions.sqlite");
		/** 临时 Node 执行环境。 */
		const env = new NodeExecutionEnv({ cwd: root });
		/** SQLite 数据库工厂。 */
		const sqlite = createNodeSqliteFactory();
		/** 当前用例的会话仓库。 */
		const repo = new SqliteSessionRepo({ env, sqlite, databasePath });
		/** 用于创建分支的测试会话。 */
		const session = await repo.create({ cwd: root, id: "session-1" });
		/** 分支共同的根用户消息编号。 */
		const rootId = await session.appendMessage(createUserMessage("root"));
		/** 根消息的第一个助手子节点编号。 */
		const firstChildId = await session.appendMessage(createAssistantMessage("first child"));
		await session.getStorage().setLeafId(rootId);
		/** 回到根节点后追加的第二个助手子节点编号。 */
		const secondChildId = await session.appendMessage(createAssistantMessage("second child"));

		/** 用于检查分支物化结果的数据库连接。 */
		const db = await sqlite.open(databasePath);
		try {
			/** 当前会话所有已物化分支条目。 */
			const branchRows = await db
				.prepare(
					"SELECT branch_id, entry_id, entry_seq FROM branch_entries WHERE session_id = ? ORDER BY branch_id, entry_seq",
				)
				.all<{ branch_id: string; entry_id: string; entry_seq: number }>("session-1");
			/** 去重后的分支编号集合。 */
			const branchIds = [...new Set(branchRows.map((row) => row.branch_id))];
			expect(branchIds).toHaveLength(3);
			expect(branchRows.filter((row) => row.entry_id === rootId)).toHaveLength(3);
			expect(branchRows.filter((row) => row.entry_id === firstChildId)).toHaveLength(1);
			expect(branchRows.filter((row) => row.entry_id === secondChildId)).toHaveLength(1);
		} finally {
			await db.close();
		}
	});

	// 重开会话时应从物化分支与摘要状态恢复名称和活动消息路径。
	it("reopens using branch materialization and session summary state", async () => {
		/** 当前用例的临时根目录。 */
		const root = createTempDir();
		/** 会话数据库路径。 */
		const databasePath = join(root, "sessions.sqlite");
		/** 临时 Node 执行环境。 */
		const env = new NodeExecutionEnv({ cwd: root });
		/** 当前用例的会话仓库。 */
		const repo = new SqliteSessionRepo({ env, sqlite: createNodeSqliteFactory(), databasePath });
		/** 创建分支和名称的源会话。 */
		const session = await repo.create({ cwd: root, id: "session-1" });
		/** 分支根消息编号。 */
		const rootId = await session.appendMessage(createUserMessage("root"));
		await session.appendMessage(createAssistantMessage("first child"));
		await session.appendSessionName("  Reopened Session  ");
		await session.getStorage().setLeafId(rootId);
		await session.appendMessage(createAssistantMessage("branched child"));

		/** 依据物化状态重新打开的会话。 */
		const reopened = await repo.open(await session.getMetadata());
		expect(await reopened.getSessionName()).toBe("Reopened Session");
		expect((await reopened.buildContext()).messages.map((message) => message.role)).toEqual(["user", "assistant"]);
		expect((await reopened.buildContext()).messages.at(-1)).toMatchObject({
			content: [{ type: "text", text: "branched child" }],
		});
	});

	// getEntries 应按 entry_seq 游标和 limit 稳定分页。
	it("pages entries by entry_seq cursor", async () => {
		/** 当前用例的临时根目录。 */
		const root = createTempDir();
		/** 会话数据库路径。 */
		const databasePath = join(root, "sessions.sqlite");
		/** 临时 Node 执行环境。 */
		const env = new NodeExecutionEnv({ cwd: root });
		/** 当前用例的会话仓库。 */
		const repo = new SqliteSessionRepo({ env, sqlite: createNodeSqliteFactory(), databasePath });
		/** 包含三条消息的测试会话。 */
		const session = await repo.create({ cwd: root, id: "session-1" });
		await session.appendMessage(createUserMessage("one"));
		await session.appendMessage(createAssistantMessage("two"));
		await session.appendMessage(createUserMessage("three"));

		expect((await session.getEntries({ limit: 2 })).map((entry) => entry.type)).toEqual(["message", "message"]);
		expect((await session.getEntries({ afterEntrySeq: 2, limit: 2 })).map((entry) => entry.type)).toEqual([
			"message",
			"message",
		]);
	});

	// create 在打开连接后写入失败时必须关闭数据库一次。
	it("closes the database when create fails after openDatabase succeeds", async () => {
		/** 当前用例的临时根目录。 */
		const root = createTempDir();
		/** 对 sessions 插入抛错、其他语句成功的数据库替身。 */
		const db = new CountingDatabase((sql) => {
			if (sql.startsWith("INSERT INTO sessions")) {
				return new ThrowingStatement(async () => {
					throw new Error("insert failed");
				});
			}
			return new ThrowingStatement(async () => ({ changes: 1 }));
		});
		/** 始终返回计数数据库替身的工厂。 */
		const sqlite: SqliteDatabaseFactory = {
			open: async () => db,
		};
		/** 临时 Node 执行环境。 */
		const env = new NodeExecutionEnv({ cwd: root });
		/** 使用故障工厂的会话仓库。 */
		const repo = new SqliteSessionRepo({ env, sqlite, databasePath: join(root, "sessions.sqlite") });

		await expect(repo.create({ cwd: root, id: "session-1" })).rejects.toThrow("insert failed");
		expect(db.closeCount).toBe(1);
	});

	// open 在读取不到指定会话时也必须关闭已打开数据库。
	it("closes the database when open fails after openDatabase succeeds", async () => {
		/** 当前用例的临时根目录。 */
		const root = createTempDir();
		/** 对会话查询返回空结果的计数数据库替身。 */
		const db = new CountingDatabase((sql) => {
			if (sql.includes("FROM sessions WHERE id = ?")) {
				return new ThrowingStatement(async () => ({ changes: 0 }));
			}
			return new ThrowingStatement(async () => ({ changes: 1 }));
		});
		/** 始终返回计数数据库替身的工厂。 */
		const sqlite: SqliteDatabaseFactory = {
			open: async () => db,
		};
		/** 临时 Node 执行环境。 */
		const env = new NodeExecutionEnv({ cwd: root });
		/** 使用故障工厂的会话仓库。 */
		const repo = new SqliteSessionRepo({ env, sqlite, databasePath: join(root, "sessions.sqlite") });
		/** 指向不存在会话的元数据。 */
		const metadata: SqliteSessionMetadata = {
			id: "missing",
			createdAt: new Date().toISOString(),
			cwd: root,
			path: join(root, "sessions.sqlite"),
		};
		writeFileSync(metadata.path, "");

		await expect(repo.open(metadata)).rejects.toThrow("Session not found: missing");
		expect(db.closeCount).toBe(1);
	});

	// fork 读取源条目后应调用源存储 cleanup，即使替身不提供真实数据库。
	it("closes the source storage after fork reads its entries", async () => {
		/** 当前用例的临时根目录。 */
		const root = createTempDir();
		/** 会话数据库路径。 */
		const databasePath = join(root, "sessions.sqlite");
		/** 临时 Node 执行环境。 */
		const env = new NodeExecutionEnv({ cwd: root });
		/** 当前用例的会话仓库。 */
		const repo = new SqliteSessionRepo({ env, sqlite: createNodeSqliteFactory(), databasePath });
		/** 源存储 cleanup 的累计调用次数。 */
		let cleanupCount = 0;
		/** 提供空条目并记录 cleanup 的源存储替身。 */
		const sourceStorage = {
			async getEntries() {
				return [];
			},
			async getPathToRootOrCompaction() {
				return [];
			},
			async cleanup() {
				cleanupCount += 1;
			},
		} as const;
		/** 仓库原始 open 方法，测试结束前恢复。 */
		const originalOpen = repo.open.bind(repo);
		repo.open = async () =>
			({
				getStorage() {
					return sourceStorage;
				},
			}) as never;

		try {
			await repo.fork(
				{
					id: "session-1",
					createdAt: new Date().toISOString(),
					cwd: root,
					path: databasePath,
				},
				{ cwd: root, id: "session-2" },
			);
		} finally {
			repo.open = originalOpen;
		}

		expect(cleanupCount).toBe(1);
	});

	// appendEntry 事务失败时应回滚叶子、条目列表和查询缓存。
	it("restores in-memory state when appendEntry fails after mutating caches", async () => {
		/** 当前用例的临时根目录。 */
		const root = createTempDir();
		/** 会话数据库路径。 */
		const databasePath = join(root, "sessions.sqlite");
		/** SQLite 数据库工厂。 */
		const sqlite = createNodeSqliteFactory();
		/** 已打开并完成迁移的数据库连接。 */
		const db = await sqlite.open(databasePath);
		await applyMigrations(db);
		/** 直接基于数据库创建的会话存储实例。 */
		const storage = await SqliteSessionStorage.create(db, databasePath, {
			cwd: root,
			sessionId: "session-1",
		});
		/** 数据库原始 prepare 方法，非目标 SQL 继续委托给它。 */
		const originalPrepare = db.prepare.bind(db);
		db.prepare = (sql: string) => {
			if (sql.startsWith("UPDATE sessions SET active_leaf_id = ?")) {
				return new ThrowingStatement(async () => {
					throw new Error("active leaf update failed");
				});
			}
			return originalPrepare(sql);
		};

		await expect(
			storage.appendEntry({
				type: "message",
				id: "root",
				parentId: null,
				timestamp: new Date().toISOString(),
				message: createUserMessage("root"),
			}),
		).rejects.toMatchObject({ code: "storage" });
		expect(await storage.getLeafId()).toBeNull();
		expect(await storage.getEntry("root")).toBeUndefined();
		expect(await storage.getEntries()).toEqual([]);
		await db.close();
	});

	// 会话名称、模型、思考级别、Token 成本和标签应正确写入物化摘要表。
	it("materializes session summary fields transactionally", async () => {
		/** 当前用例的临时根目录。 */
		const root = createTempDir();
		/** 会话数据库路径。 */
		const databasePath = join(root, "sessions.sqlite");
		/** 临时 Node 执行环境。 */
		const env = new NodeExecutionEnv({ cwd: root });
		/** SQLite 数据库工厂。 */
		const sqlite = createNodeSqliteFactory();
		/** 当前用例的会话仓库。 */
		const repo = new SqliteSessionRepo({ env, sqlite, databasePath });
		/** 用于累积摘要字段的测试会话。 */
		const session = await repo.create({ cwd: root, id: "session-1" });
		/** 第一条用户消息编号，也是后续压缩与分支目标。 */
		const userId = await session.appendMessage(createUserMessage("one"));
		await session.appendThinkingLevelChange("high");
		await session.appendModelChange("anthropic", "claude-sonnet-4-5");
		/** 带模型、Token 和成本数据的助手消息。 */
		const assistant = {
			...createAssistantMessage("two"),
			provider: "anthropic",
			model: "claude-sonnet-4-5",
			usage: {
				input: 100,
				output: 25,
				cacheRead: 40,
				cacheWrite: 10,
				totalTokens: 175,
				cost: { input: 0.1, output: 0.2, cacheRead: 0.03, cacheWrite: 0.04, total: 0.37 },
			},
		};
		await session.appendMessage(assistant);
		await session.appendCompaction("summary", userId, 200, undefined, false, {
			input: 1,
			output: 2,
			cacheRead: 3,
			cacheWrite: 4,
			totalTokens: 10,
			cost: { input: 0.01, output: 0.02, cacheRead: 0.03, cacheWrite: 0.04, total: 0.1 },
		});
		await session.moveTo(userId, {
			summary: "branch summary",
			usage: {
				input: 5,
				output: 6,
				cacheRead: 7,
				cacheWrite: 8,
				totalTokens: 26,
				cost: { input: 0.05, output: 0.06, cacheRead: 0.07, cacheWrite: 0.08, total: 0.26 },
			},
		});
		await session.appendSessionName("  My Session  ");
		await session.appendLabel(userId, "checkpoint");

		/** 用于直接检查物化摘要表的数据库连接。 */
		const db = await sqlite.open(databasePath);
		try {
			/** session_materialized 中当前会话的 JSON 摘要行。 */
			const row = await db.prepare("SELECT session_id, payload FROM session_materialized WHERE session_id = ?").get<{
				session_id: string;
				payload: string;
			}>("session-1");
			expect(row).toBeDefined();
			expect(row?.session_id).toBe("session-1");
			expect(JSON.parse(row?.payload ?? "null")).toMatchObject({
				name: "My Session",
				messageCount: 2,
				cachedTokens: 50,
				uncachedTokens: 128,
				totalTokens: 211,
				costTotal: 0.73,
				currentModel: { provider: "anthropic", modelId: "claude-sonnet-4-5" },
				currentThinkingLevel: "high",
			});
			/** entry_materialized 中标签等条目级摘要。 */
			const entryRows = await db
				.prepare(
					"SELECT session_id, entry_seq, type, payload FROM entry_materialized WHERE session_id = ? ORDER BY entry_seq, type",
				)
				.all<{
					session_id: string;
					entry_seq: number;
					type: string;
					payload: string;
				}>("session-1");
			expect(
				entryRows.some((entryRow) => entryRow.type === "label" && JSON.parse(entryRow.payload).targetId === userId),
			).toBe(true);
			expect(entryRows.some((entryRow) => entryRow.type === "thinking")).toBe(false);
			expect(entryRows.some((entryRow) => entryRow.type === "model")).toBe(false);
		} finally {
			await db.close();
		}
	});
});
