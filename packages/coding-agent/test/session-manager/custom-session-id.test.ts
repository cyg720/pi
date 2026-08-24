/**
 * 文件职责：验证 SessionManager 在新建、构造、分支和文件派生会话时对自定义 ID 与 UUIDv7 默认值的处理。
 * 技术维度：使用 Vitest、临时 JSONL 文件和正则表达式检查内存与持久化会话的标头和文件名。
 * 产品维度：允许用户给会话稳定易记的标识，同时拒绝可能破坏文件路径的无效字符和边界格式。
 * 逻辑维度：先覆盖 newSession 与构造器，再测试 ID 校验、标头/文件名，以及 branch/fork 的生成和覆盖规则。
 * 关键边界：合法 ID 只能以字母数字开头结尾，中间可含 `-_.`；未指定时必须生成 UUIDv7。
 * 新手阅读建议：先看 UUID_V7_RE 和合法/非法 ID 用例，再比较 createBranchedSession 与 forkFrom。
 */
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import { SessionManager } from "../../src/core/session-manager.ts";

// UUID_V7_RE 用于确认自动生成 ID 的版本位和变体位符合 UUIDv7 规范。
const UUID_V7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// 验证自定义会话 ID 在全部创建入口中的优先级、校验与持久化表现。
describe("SessionManager.newSession with custom id", () => {
	// newSession 显式 ID 应覆盖自动生成值。
	it("uses the provided id instead of generating one", () => {
		// session 是用于调用 newSession 的内存管理器。
		const session = SessionManager.inMemory();
		session.newSession({ id: "my-custom-id" });
		expect(session.getSessionId()).toBe("my-custom-id");
	});

	// 构造内存会话时提供的 ID 应同步进入标头且不创建文件。
	it("uses the provided id when creating an in-memory session", () => {
		// session 在构造选项中直接接收自定义 ID。
		const session = SessionManager.inMemory(process.cwd(), { id: "memory-session-id" });
		expect(session.getSessionId()).toBe("memory-session-id");
		expect(session.getHeader()!.id).toBe("memory-session-id");
		expect(session.getSessionFile()).toBeUndefined();
	});

	// ID 中间允许连字符、下划线和点号。
	it("allows alphanumeric session ids with interior punctuation", () => {
		// session 用于验证合法标点组合。
		const session = SessionManager.inMemory();
		session.newSession({ id: "abc-123_def.456" });
		expect(session.getSessionId()).toBe("abc-123_def.456");
	});

	// 空值、首尾标点、路径分隔符和空格都必须被拒绝。
	it("rejects invalid custom session ids", () => {
		// invalidIds 覆盖空值、首尾符号、斜杠和空格等非法形式。
		const invalidIds = ["", "-abc", "abc-", "_abc", "abc_", ".abc", "abc.", "abc/def", "abc\\def", "abc def"];

		for (const id of invalidIds) {
			// session 为每个非法 ID 单独创建，避免失败状态相互影响。
			const session = SessionManager.inMemory();
			expect(() => session.newSession({ id })).toThrow(
				"Session id must be non-empty, contain only alphanumeric characters",
			);
		}
	});

	// newSession 未提供 ID 时应生成 UUIDv7。
	it("generates a UUIDv7 id when no id is provided", () => {
		// session 是重新开始会话的内存管理器。
		const session = SessionManager.inMemory();
		session.newSession();
		// id 是 newSession 自动生成的会话标识。
		const id = session.getSessionId();
		expect(id).toBeDefined();
		expect(id).not.toBe("");
		expect(id).toMatch(UUID_V7_RE);
	});

	// 即使传入其他选项，只要没有 id 仍应生成 UUIDv7。
	it("generates a UUIDv7 id when options is provided without id", () => {
		// session 用于创建带 parentSession 但无 ID 的会话。
		const session = SessionManager.inMemory();
		session.newSession({ parentSession: "parent.jsonl" });
		// id 是在保留父会话信息时自动生成的标识。
		const id = session.getSessionId();
		expect(id).toBeDefined();
		expect(id).not.toBe("");
		expect(id).toMatch(UUID_V7_RE);
	});

	// 自定义 ID 必须写入会话标头。
	it("includes the custom id in the session header", () => {
		// session 使用固定 header-test-id 创建新会话。
		const session = SessionManager.inMemory();
		session.newSession({ id: "header-test-id" });

		// header 是当前会话的内存标头。
		const header = session.getHeader();
		expect(header).not.toBeNull();
		expect(header!.id).toBe("header-test-id");
	});

	// inMemory 构造器无 ID 时会立即准备 UUIDv7 标头。
	it("generates a UUIDv7 id when constructed without an explicit id", () => {
		// session 是使用默认选项直接构造的内存会话。
		const session = SessionManager.inMemory();
		expect(session.getSessionId()).toMatch(UUID_V7_RE);
		expect(session.getHeader()!.id).toBe(session.getSessionId());
	});

	// 持久化会话应把自定义 ID 同时用于标头和预定文件名，但尚不创建文件。
	it("uses the provided id when creating a persisted session", () => {
		// tempDir 是持久化会话目录。
		const tempDir = mkdtempSync(join(tmpdir(), "pi-session-manager-"));
		// session 使用显式 ID 创建文件型会话管理器。
		const session = SessionManager.create(tempDir, tempDir, { id: "created-session-id" });

		expect(session.getSessionId()).toBe("created-session-id");
		expect(session.getHeader()!.id).toBe("created-session-id");
		// sessionFile 是包含时间戳和自定义 ID 的预定 JSONL 路径。
		const sessionFile = session.getSessionFile()!;
		expect(sessionFile).toContain("created-session-id");
		expect(basename(sessionFile)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_created-session-id\.jsonl$/);
		expect(existsSync(sessionFile)).toBe(false);
	});

	// 从当前消息树创建分支时，默认应为新会话生成独立 UUIDv7。
	it("generates a UUIDv7 id when creating a branched session", () => {
		// session 是含一条用户消息的内存会话。
		const session = SessionManager.inMemory();
		// firstId 是作为分支位置的消息条目 ID。
		const firstId = session.appendMessage({
			role: "user",
			content: [{ type: "text", text: "hello" }],
			timestamp: Date.now(),
		});

		session.createBranchedSession(firstId);

		expect(session.getSessionId()).toMatch(UUID_V7_RE);
		expect(session.getHeader()!.id).toBe(session.getSessionId());
	});

	// 从已有会话文件 fork 且未指定 ID 时应生成新 UUIDv7 并记录父文件。
	it("generates a UUIDv7 id when forking from another session file", () => {
		// tempDir 保存源会话及 fork 后的目标路径信息。
		const tempDir = mkdtempSync(join(tmpdir(), "pi-session-manager-"));
		// sourcePath 是手工创建的源 JSONL 会话文件。
		const sourcePath = join(tempDir, "source.jsonl");
		writeFileSync(
			sourcePath,
			`${[
				JSON.stringify({
					type: "session",
					version: 3,
					id: "legacy-session-id",
					timestamp: new Date().toISOString(),
					cwd: tempDir,
				}),
				JSON.stringify({
					type: "message",
					id: "entry-1",
					parentId: null,
					timestamp: new Date().toISOString(),
					message: {
						role: "assistant",
						content: [{ type: "text", text: "hello" }],
						api: "openai-responses",
						provider: "openai",
						model: "gpt-5.4",
						usage: {
							input: 0,
							output: 0,
							cacheRead: 0,
							cacheWrite: 0,
							totalTokens: 0,
							cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
						},
						stopReason: "stop",
						timestamp: Date.now(),
					},
				}),
			].join("\n")}
`,
		);

		// forked 是从源文件派生且自动生成 ID 的管理器。
		const forked = SessionManager.forkFrom(sourcePath, tempDir, tempDir);
		// header 是 fork 后的新会话标头。
		const header = forked.getHeader();
		expect(header).not.toBeNull();
		expect(header!.id).toMatch(UUID_V7_RE);
		expect(header!.parentSession).toBe(sourcePath);
	});

	// forkFrom 的显式 ID 应覆盖默认 UUID，并进入新文件名。
	it("uses the provided id when forking from another session file", () => {
		// tempDir 是简化源会话和目标会话的共同目录。
		const tempDir = mkdtempSync(join(tmpdir(), "pi-session-manager-"));
		// sourcePath 是只含会话标头的源文件。
		const sourcePath = join(tempDir, "source.jsonl");
		writeFileSync(
			sourcePath,
			`${JSON.stringify({
				type: "session",
				version: 3,
				id: "source-session-id",
				timestamp: new Date().toISOString(),
				cwd: tempDir,
			})}\n`,
		);

		// forked 使用调用者指定的 forked-session-id。
		const forked = SessionManager.forkFrom(sourcePath, tempDir, tempDir, { id: "forked-session-id" });
		// header 是 fork 后带父会话引用的新标头。
		const header = forked.getHeader();
		expect(header).not.toBeNull();
		expect(header!.id).toBe("forked-session-id");
		expect(header!.parentSession).toBe(sourcePath);
		// sessionFile 是包含自定义 fork ID 的新会话路径。
		const sessionFile = forked.getSessionFile()!;
		expect(sessionFile).toContain("forked-session-id");
		expect(basename(sessionFile)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_forked-session-id\.jsonl$/);
	});
});
