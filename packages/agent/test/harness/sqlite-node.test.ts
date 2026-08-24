/**
 * 文件职责：验证 Node SQLite 适配器支持 node:sqlite 风格的命名参数。
 * 技术维度：使用 Vitest、临时目录与 SQLite DDL/DML，在真实本地数据库文件上执行集成测试。
 * 产品维度：保证会话存储可安全绑定命名参数，避免字符串拼接和不同驱动语法不兼容。
 * 逻辑维度：创建临时数据库，建表、插入、按参数查询并断言结果，最后无条件关闭连接。
 * 关键边界：测试会创建临时文件但不访问网络；数据库连接必须在 finally 中关闭。
 * 新手阅读建议：按 open、exec、prepare/run、prepare/get、close 的顺序理解适配器生命周期。
 */
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createNodeSqliteFactory } from "../../../storage/sqlite-node/src/index.ts";
import { createTempDir } from "./session-test-utils.ts";

/** SQLite Node 适配器集成测试组。 */
describe("sqlite-node adapter", () => {
	/** 验证以 $ 开头的参数名可同时用于写入与查询，并在结束时释放连接。 */
	it("supports node:sqlite-style named parameters", async () => {
		/** 本用例独享的临时目录；由测试工具创建，避免污染仓库。 */
		const root = createTempDir();
		/** 临时 SQLite 数据库文件路径；仅在当前测试生命周期内使用。 */
		const databasePath = join(root, "adapter.sqlite");
		/** Node SQLite 工厂；负责按统一存储接口打开数据库。 */
		const sqlite = createNodeSqliteFactory();
		/** 已打开的数据库连接；无论断言是否成功都必须在 finally 中关闭。 */
		const db = await sqlite.open(databasePath);
		try {
			await db.exec("CREATE TABLE items (id INTEGER PRIMARY KEY, text TEXT NOT NULL)");
			await db.prepare("INSERT INTO items (id, text) VALUES ($id, $text)").run({ $id: 1, $text: "hello" });
			/** 按命名参数查询得到的首行；未命中时可能为 undefined，本例预期命中固定记录。 */
			const row = await db.prepare("SELECT text FROM items WHERE id = $id").get<{ text: string }>({ $id: 1 });
			expect(row).toEqual({ text: "hello" });
		} finally {
			await db.close();
		}
	});
});
