/**
 * 文件职责：验证会话列表的 modified 时间取最后一条对话消息时间，而不是文件修改时间。
 * 技术维度：使用 Vitest、真实临时 JSONL 文件、文件 stat 和 SessionManager 持久化接口。
 * 产品维度：让会话排序反映真实对话活跃时间，避免文件系统写入时机造成顺序误导。
 * 逻辑维度：创建可持久化会话，记录旧 mtime，追加带明确时间戳的消息后查询会话列表。
 * 关键边界：用例依赖临时目录并等待 10 毫秒区分粗粒度文件时间；会恢复所有模拟函数。
 * 新手阅读建议：先看 createSessionFile 为何追加助手消息，再跟踪 before.mtime 与 msgTime 的比较。
 */
import { writeFileSync } from "node:fs";
import { stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { SessionHeader } from "../src/core/session-manager.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";

/**
 * 创建带会话头和最小助手消息的可持久化 JSONL 文件。
 * 参数：path 为目标会话文件路径。
 * 返回值：无。
 * 使用示例：`createSessionFile(filePath)`。
 */
function createSessionFile(path: string): void {
	// header 是版本 3 的固定测试会话头。
	const header: SessionHeader = {
		type: "session",
		id: "test-session",
		version: 3,
		timestamp: new Date(0).toISOString(),
		cwd: "/tmp",
	};
	writeFileSync(path, `${JSON.stringify(header)}\n`, "utf8");

	// SessionManager only persists once it has seen at least one assistant message.
	// SessionManager 至少看到一条助手消息后才会持久化。
	// Add a minimal assistant entry so subsequent appends are persisted.
	// 添加最小助手条目，使后续追加内容能够写入文件。
	// mgr 是打开目标文件的会话管理器。
	const mgr = SessionManager.open(path);
	mgr.appendMessage({
		role: "assistant",
		content: [{ type: "text", text: "hi" }],
		api: "openai-completions",
		provider: "openai",
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
		timestamp: Date.now(),
	});
}

describe("SessionInfo.modified", () => {
	// 测试组开始前初始化深色主题；无参数，无返回值。
	beforeAll(() => initTheme("dark"));

	// 每个用例后恢复 Vitest 模拟函数；无参数，无返回值。
	afterEach(() => {
		vi.restoreAllMocks();
	});

	// 验证 modified 等于最后一条助手消息时间且不同于旧文件 mtime；无参数，无返回值。
	it("uses last user/assistant message timestamp instead of file mtime", async () => {
		// filePath 是本次运行唯一的临时会话文件路径。
		const filePath = join(tmpdir(), `pi-session-${Date.now()}-modified.jsonl`);
		createSessionFile(filePath);

		// before 保存追加新消息前的文件系统状态。
		const before = await stat(filePath);
		// Ensure the file mtime can differ from our message timestamp even on coarse filesystems.
		// 即使文件系统时间粒度较粗，也要确保 mtime 能与消息时间不同。
		// r 是等待计时器结束时解决 Promise 的回调。
		await new Promise((r) => setTimeout(r, 10));

		// mgr 是重新打开后用于追加新助手消息的会话管理器。
		const mgr = SessionManager.open(filePath);
		// msgTime 是待验证的新助手消息时间戳。
		const msgTime = Date.now();
		mgr.appendMessage({
			role: "assistant",
			content: [{ type: "text", text: "later" }],
			api: "openai-completions",
			provider: "openai",
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
			timestamp: msgTime,
		});

		// sessions 是指定项目和目录下的会话信息列表。
		const sessions = await SessionManager.list("/tmp", dirname(filePath));
		// s 是路径与测试文件相同的可选会话信息；x 表示当前候选会话。
		const s = sessions.find((x) => x.path === filePath);
		expect(s).toBeDefined();
		expect(s!.modified.getTime()).toBe(msgTime);
		expect(s!.modified.getTime()).not.toBe(before.mtime.getTime());
	});
});
