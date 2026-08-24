/**
 * 文件职责：验证会话选择器的短语、正则、相关性、时间顺序和命名状态筛选规则。
 * 技术维度：使用 Vitest 和手工 SessionInfo 数据，对纯函数 filterAndSortSessions 做确定性单元测试。
 * 产品维度：帮助用户在大量历史会话中按内容或名称快速找到目标，并得到稳定、可预测的排序。
 * 逻辑维度：先构造默认会话，再覆盖短语/正则匹配、两种排序、无效表达式和名称过滤。
 * 关键边界：正则不合法时返回空数组；recent 保留输入顺序；空白名称不算已命名。
 * 新手阅读建议：先看 makeSession 的默认字段，再逐个比较查询字符串、排序模式和结果 ID。
 */
import { describe, expect, it } from "vitest";
import type { SessionInfo } from "../src/core/session-manager.ts";
import { filterAndSortSessions } from "../src/modes/interactive/components/session-selector-search.ts";

/**
 * 用必要字段和可选覆盖构造完整会话信息。
 * @param overrides 必须给出 id、修改时间和全文，其余字段可覆盖默认值。
 * @returns SessionInfo；例如 `makeSession({ id: "a", modified: new Date(), allMessagesText: "hi" })`。
 */
function makeSession(
	overrides: Partial<SessionInfo> & { id: string; modified: Date; allMessagesText: string },
): SessionInfo {
	return {
		path: `/tmp/${overrides.id}.jsonl`,
		id: overrides.id,
		cwd: overrides.cwd ?? "",
		name: overrides.name,
		created: overrides.created ?? new Date(0),
		modified: overrides.modified,
		messageCount: overrides.messageCount ?? 1,
		firstMessage: overrides.firstMessage ?? "(no messages)",
		allMessagesText: overrides.allMessagesText,
	};
}

// 验证会话搜索语法、排序和命名筛选的组合行为。
describe("session selector search", () => {
	// 引号短语会先归一化多余空白，再做连续文本匹配。
	it("filters by quoted phrase with whitespace normalization", () => {
		// sessions 包含一个跨换行匹配和一个不连续匹配的候选。
		const sessions: SessionInfo[] = [
			makeSession({
				id: "a",
				modified: new Date("2026-01-01T00:00:00.000Z"),
				allMessagesText: "node\n\n   cve was discussed",
			}),
			makeSession({
				id: "b",
				modified: new Date("2026-01-02T00:00:00.000Z"),
				allMessagesText: "node something else",
			}),
		];

		// result 是短语搜索后的会话列表。
		const result = filterAndSortSessions(sessions, '"node cve"', "recent");
		expect(result.map((s) => s.id)).toEqual(["a"]);
	});

	// `re:` 查询按不区分大小写的正则表达式匹配全文。
	it("filters by regex (re:) and is case-insensitive", () => {
		// sessions 用 brave 与 bravery 区分单词边界正则。
		const sessions: SessionInfo[] = [
			makeSession({
				id: "a",
				modified: new Date("2026-01-02T00:00:00.000Z"),
				allMessagesText: "Brave is great",
			}),
			makeSession({
				id: "b",
				modified: new Date("2026-01-03T00:00:00.000Z"),
				allMessagesText: "bravery is not the same",
			}),
		];

		// result 只应包含完整单词 Brave 的会话。
		const result = filterAndSortSessions(sessions, "re:\\bbrave\\b", "recent");
		expect(result.map((s) => s.id)).toEqual(["a"]);
	});

	// recent 模式只过滤，不重新打乱调用者已按时间排好的输入。
	it("recent sort preserves input order", () => {
		// sessions 已按预期最近顺序排列，并附带一个不匹配项。
		const sessions: SessionInfo[] = [
			makeSession({
				id: "newer",
				modified: new Date("2026-01-03T00:00:00.000Z"),
				allMessagesText: "brave",
			}),
			makeSession({
				id: "older",
				modified: new Date("2026-01-01T00:00:00.000Z"),
				allMessagesText: "brave",
			}),
			makeSession({
				id: "nomatch",
				modified: new Date("2026-01-04T00:00:00.000Z"),
				allMessagesText: "something else",
			}),
		];

		// result 应保持两个匹配项的原始相对顺序。
		const result = filterAndSortSessions(sessions, '"brave"', "recent");
		expect(result.map((s) => s.id)).toEqual(["newer", "older"]);
	});

	// relevance 优先匹配位置/分数，同分时使用修改时间倒序。
	it("relevance sort orders by score and tie-breaks by modified desc", () => {
		// sessions 中 early 的关键词位置更靠前，应获得更高相关性。
		const sessions: SessionInfo[] = [
			makeSession({
				id: "late",
				modified: new Date("2026-01-03T00:00:00.000Z"),
				allMessagesText: "xxxx brave",
			}),
			makeSession({
				id: "early",
				modified: new Date("2026-01-01T00:00:00.000Z"),
				allMessagesText: "brave xxxx",
			}),
		];

		// result1 验证相关性分数优先于修改时间。
		const result1 = filterAndSortSessions(sessions, '"brave"', "relevance");
		expect(result1.map((s) => s.id)).toEqual(["early", "late"]);

		// tieSessions 构造相关性完全相同但修改时间不同的候选。
		const tieSessions: SessionInfo[] = [
			makeSession({
				id: "newer",
				modified: new Date("2026-01-03T00:00:00.000Z"),
				allMessagesText: "brave",
			}),
			makeSession({
				id: "older",
				modified: new Date("2026-01-01T00:00:00.000Z"),
				allMessagesText: "brave",
			}),
		];

		// result2 验证同分时较新的会话排在前面。
		const result2 = filterAndSortSessions(tieSessions, '"brave"', "relevance");
		expect(result2.map((s) => s.id)).toEqual(["newer", "older"]);
	});

	// 无法编译的正则应安全返回空列表而不是抛出到界面。
	it("returns empty list for invalid regex", () => {
		// sessions 提供一个本可匹配的候选，以确认失败来自正则语法。
		const sessions: SessionInfo[] = [
			makeSession({
				id: "a",
				modified: new Date("2026-01-01T00:00:00.000Z"),
				allMessagesText: "brave",
			}),
		];

		// result 是无效正则的安全空结果。
		const result = filterAndSortSessions(sessions, "re:(", "recent");
		expect(result).toEqual([]);
	});

	// 验证 all/named 名称状态过滤及其与全文查询的组合。
	describe("name filter", () => {
		// sessions 同时包含两个有名称和两个无名称会话，共享可搜索正文。
		const sessions: SessionInfo[] = [
			makeSession({
				id: "named1",
				name: "My Project",
				modified: new Date("2026-01-03T00:00:00.000Z"),
				allMessagesText: "blueberry",
			}),
			makeSession({
				id: "named2",
				name: "Another Named",
				modified: new Date("2026-01-02T00:00:00.000Z"),
				allMessagesText: "blueberry",
			}),
			makeSession({
				id: "other1",
				modified: new Date("2026-01-04T00:00:00.000Z"),
				allMessagesText: "blueberry",
			}),
			makeSession({
				id: "other2",
				modified: new Date("2026-01-01T00:00:00.000Z"),
				allMessagesText: "blueberry",
			}),
		];

		// all 模式保留全部会话。
		it("returns all sessions when nameFilter is 'all'", () => {
			// result 是不做名称过滤时的结果。
			const result = filterAndSortSessions(sessions, "", "recent", "all");
			expect(result.map((session) => session.id)).toEqual(["named1", "named2", "other1", "other2"]);
		});

		// named 模式只保留非空名称。
		it("returns only named sessions when nameFilter is 'named'", () => {
			// result 是已命名会话子集。
			const result = filterAndSortSessions(sessions, "", "recent", "named");
			expect(result.map((session) => session.id)).toEqual(["named1", "named2"]);
		});

		// 名称过滤应先于全文查询应用，二者结果取交集。
		it("applies name filter before search query", () => {
			// result 是命名条件与 blueberry 查询共同筛选的结果。
			const result = filterAndSortSessions(sessions, "blueberry", "recent", "named");
			expect(result.map((session) => session.id)).toEqual(["named1", "named2"]);
		});

		// 仅含空格或空字符串的名称都不算有效名称。
		it("excludes whitespace-only names from named filter", () => {
			// sessionsWithWhitespace 覆盖空格名、空名和真实名称三种情况。
			const sessionsWithWhitespace: SessionInfo[] = [
				makeSession({
					id: "whitespace",
					name: "   ",
					modified: new Date("2026-01-01T00:00:00.000Z"),
					allMessagesText: "test",
				}),
				makeSession({
					id: "empty",
					name: "",
					modified: new Date("2026-01-02T00:00:00.000Z"),
					allMessagesText: "test",
				}),
				makeSession({
					id: "named",
					name: "Real Name",
					modified: new Date("2026-01-03T00:00:00.000Z"),
					allMessagesText: "test",
				}),
			];

			// result 应只保留具有可见字符名称的会话。
			const result = filterAndSortSessions(sessionsWithWhitespace, "", "recent", "named");
			expect(result.map((session) => session.id)).toEqual(["named"]);
		});
	});
});
