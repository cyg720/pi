import { constants as bufferConstants } from "buffer";
import { appendFileSync, closeSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync, writeSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findMostRecentSession, loadEntriesFromFile, SessionManager } from "../../src/core/session-manager.ts";

/** 最近会话发现时最多扫描的头部字节数。 */
const HEADER_SCAN_LIMIT_BYTES = 1024 * 1024;

describe("loadEntriesFromFile", () => {
	/** 当前用例的临时目录。 */
	let tempDir: string;

	/** 每个用例前创建独立临时目录。 */
	beforeEach(() => {
		tempDir = join(tmpdir(), `session-test-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
	});

	/** 每个用例后递归删除临时目录。 */
	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	/** 写入版本 3 会话头，prefix 可模拟前置空白或损坏行。无返回值。 */
	function writeSessionHeader(file: string, cwd: string, id: string, prefix = ""): void {
		writeFileSync(
			file,
			`${prefix}${JSON.stringify({
				type: "session",
				version: 3,
				id,
				timestamp: "2025-01-01T00:00:00Z",
				cwd,
			})}\n`,
		);
	}

	/** 验证不存在的文件返回空条目。 */
	it("returns empty array for non-existent file", () => {
		/** 不存在文件的读取结果。 */
		const entries = loadEntriesFromFile(join(tempDir, "nonexistent.jsonl"));
		expect(entries).toEqual([]);
	});

	/** 验证空文件返回空条目。 */
	it("returns empty array for empty file", () => {
		/** 当前用例创建的空文件。 */
		const file = join(tempDir, "empty.jsonl");
		writeFileSync(file, "");
		expect(loadEntriesFromFile(file)).toEqual([]);
	});

	/** 验证缺少有效会话头的文件返回空条目。 */
	it("returns empty array for file without valid session header", () => {
		/** 只含消息而无会话头的文件。 */
		const file = join(tempDir, "no-header.jsonl");
		writeFileSync(file, '{"type":"message","id":"1"}\n');
		expect(loadEntriesFromFile(file)).toEqual([]);
	});

	/** 验证首行不是 JSON 时返回空条目。 */
	it("returns empty array for malformed JSON", () => {
		/** 包含非法 JSON 的文件。 */
		const file = join(tempDir, "malformed.jsonl");
		writeFileSync(file, "not json\n");
		expect(loadEntriesFromFile(file)).toEqual([]);
	});

	/** 验证有效会话头和消息都被加载。 */
	it("loads valid session file", () => {
		/** 包含有效头和消息的 JSONL 文件。 */
		const file = join(tempDir, "valid.jsonl");
		writeFileSync(
			file,
			'{"type":"session","id":"abc","timestamp":"2025-01-01T00:00:00Z","cwd":"/tmp"}\n' +
				'{"type":"message","id":"1","parentId":null,"timestamp":"2025-01-01T00:00:01Z","message":{"role":"user","content":"hi","timestamp":1}}\n',
		);
		/** 从有效文件加载的头和消息条目。 */
		const entries = loadEntriesFromFile(file);
		expect(entries).toHaveLength(2);
		expect(entries[0].type).toBe("session");
		expect(entries[1].type).toBe("message");
	});

	/** 验证头部有效时会跳过中间坏行并保留后续条目。 */
	it("skips malformed lines but keeps valid ones", () => {
		/** 混合有效与无效行的 JSONL 文件。 */
		const file = join(tempDir, "mixed.jsonl");
		writeFileSync(
			file,
			'{"type":"session","id":"abc","timestamp":"2025-01-01T00:00:00Z","cwd":"/tmp"}\n' +
				"not valid json\n" +
				'{"type":"message","id":"1","parentId":null,"timestamp":"2025-01-01T00:00:01Z","message":{"role":"user","content":"hi","timestamp":1}}\n',
		);
		/** 跳过坏行后的有效条目。 */
		const entries = loadEntriesFromFile(file);
		expect(entries).toHaveLength(2);
	});

	/** 参数化验证前置空行、坏行和跨缓冲区头部仍能读取 cwd。 */
	it.each([
		["leading blank lines", "\n  \n", "leading-blank"],
		["leading malformed lines", "not json\n{broken json\n", "leading-malformed"],
		["a multi-buffer header", "", "a".repeat(8192)],
	])("reads cwd from a session with %s", (_description, prefix, sessionId) => {
		/** 当前参数场景的会话文件。 */
		const file = join(tempDir, "header.jsonl");
		/** 写入头部并期待恢复的 cwd。 */
		const storedCwd = join(tempDir, "stored-project");
		writeSessionHeader(file, storedCwd, sessionId, prefix);

		/** 从测试文件打开的会话管理器。 */
		const sessionManager = SessionManager.open(file, tempDir);
		expect(sessionManager.getSessionId()).toBe(sessionId);
		expect(sessionManager.getCwd()).toBe(storedCwd);
	});

	/** 验证显式打开不受最近会话发现扫描上限限制。 */
	it("opens compatible sessions beyond the discovery scan limit", () => {
		/** 会话头中记录的 cwd。 */
		const storedCwd = join(tempDir, "stored-project");
		/** 显式传入时应覆盖头部 cwd 的路径。 */
		const overrideCwd = join(tempDir, "override-project");
		/** 超大 ID 和超大前缀两种边界场景。 */
		const cases = [
			{ name: "large-header", id: "a".repeat(HEADER_SCAN_LIMIT_BYTES + 1), prefix: "" },
			{
				name: "large-prefix",
				id: "large-prefix",
				prefix: `${"x".repeat(HEADER_SCAN_LIMIT_BYTES + 1)}\n`,
			},
		];

		for (const { name, id, prefix } of cases) {
			/** 当前边界场景的会话文件。 */
			const file = join(tempDir, `${name}.jsonl`);
			writeSessionHeader(file, storedCwd, id, prefix);
			for (const cwdOverride of [undefined, overrideCwd]) {
				/** 使用可选 cwd 覆盖打开的会话管理器。 */
				const sessionManager = SessionManager.open(file, tempDir, cwdOverride);
				expect(sessionManager.getSessionId()).toBe(id);
				expect(sessionManager.getCwd()).toBe(cwdOverride ?? storedCwd);
			}
		}
	});

	/** 验证文件总长度超过 Node 最大字符串长度时仍可按流式方式打开。 */
	it("opens session files larger than Node's max string length", () => {
		/** 通过稀疏写入扩展的超大会话文件。 */
		const file = join(tempDir, "large.jsonl");
		writeFileSync(
			file,
			'{"type":"session","version":3,"id":"abc","timestamp":"2025-01-01T00:00:00Z","cwd":"/tmp"}\n',
		);

		/** 以读写模式打开超大文件的描述符。 */
		const fd = openSync(file, "r+");
		try {
			/** 在稀疏偏移处写入的单个换行字节。 */
			const newline = Buffer.from("\n");
			/** 每次扩展文件的偏移步长。 */
			const stride = 16 * 1024 * 1024;
			for (let offset = stride; offset <= bufferConstants.MAX_STRING_LENGTH + stride; offset += stride) {
				writeSync(fd, newline, 0, newline.length, offset);
			}
		} finally {
			closeSync(fd);
		}

		appendFileSync(
			file,
			'{"type":"message","id":"1","parentId":null,"timestamp":"2025-01-01T00:00:01Z","message":{"role":"user","content":"hi","timestamp":1}}\n',
		);

		/** 从超大文件打开的会话管理器。 */
		const sessionManager = SessionManager.open(file, tempDir);
		expect(sessionManager.getSessionId()).toBe("abc");
		expect(sessionManager.getEntries()).toHaveLength(1);
		expect(sessionManager.buildSessionContext().messages).toEqual([{ role: "user", content: "hi", timestamp: 1 }]);
	});
});

describe("findMostRecentSession", () => {
	/** 当前最近会话发现用例的临时目录。 */
	let tempDir: string;

	/** 每个用例前创建独立临时目录。 */
	beforeEach(() => {
		tempDir = join(tmpdir(), `session-test-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
	});

	/** 每个用例后递归删除临时目录。 */
	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	/** 验证空目录没有最近会话。 */
	it("returns null for empty directory", () => {
		expect(findMostRecentSession(tempDir)).toBeNull();
	});

	/** 验证不存在目录返回 null。 */
	it("returns null for non-existent directory", () => {
		expect(findMostRecentSession(join(tempDir, "nonexistent"))).toBeNull();
	});

	/** 验证非 JSONL 文件被忽略。 */
	it("ignores non-jsonl files", () => {
		writeFileSync(join(tempDir, "file.txt"), "hello");
		writeFileSync(join(tempDir, "file.json"), "{}");
		expect(findMostRecentSession(tempDir)).toBeNull();
	});

	/** 验证无有效会话头的 JSONL 被忽略。 */
	it("ignores jsonl files without valid session header", () => {
		writeFileSync(join(tempDir, "invalid.jsonl"), '{"type":"message"}\n');
		expect(findMostRecentSession(tempDir)).toBeNull();
	});

	/** 验证唯一有效会话文件被返回。 */
	it("returns single valid session file", () => {
		/** 唯一有效会话文件路径。 */
		const file = join(tempDir, "session.jsonl");
		writeFileSync(file, '{"type":"session","id":"abc","timestamp":"2025-01-01T00:00:00Z","cwd":"/tmp"}\n');
		expect(findMostRecentSession(tempDir)).toBe(file);
	});

	/** 验证按修改时间返回最新会话。 */
	it("returns most recently modified session", async () => {
		/** 较早写入的会话文件。 */
		const file1 = join(tempDir, "older.jsonl");
		/** 较晚写入的会话文件。 */
		const file2 = join(tempDir, "newer.jsonl");

		writeFileSync(file1, '{"type":"session","id":"old","timestamp":"2025-01-01T00:00:00Z","cwd":"/tmp"}\n');
		// Small delay to ensure different mtime
		// 短暂等待，确保两个文件的修改时间不同。
		await new Promise((r) => setTimeout(r, 10));
		writeFileSync(file2, '{"type":"session","id":"new","timestamp":"2025-01-01T00:00:00Z","cwd":"/tmp"}\n');

		expect(findMostRecentSession(tempDir)).toBe(file2);
	});

	/** 验证无效文件不会遮挡有效会话。 */
	it("skips invalid files and returns valid one", async () => {
		/** 较早写入的无效 JSONL。 */
		const invalid = join(tempDir, "invalid.jsonl");
		/** 较晚写入的有效会话。 */
		const valid = join(tempDir, "valid.jsonl");

		writeFileSync(invalid, '{"type":"not-session"}\n');
		await new Promise((r) => setTimeout(r, 10));
		writeFileSync(valid, '{"type":"session","id":"abc","timestamp":"2025-01-01T00:00:00Z","cwd":"/tmp"}\n');

		expect(findMostRecentSession(tempDir)).toBe(valid);
	});

	/** 验证超出扫描上限且损坏的文件被跳过。 */
	it("skips oversized corrupt files and returns a valid session", () => {
		/** 超过扫描上限的损坏文件。 */
		const invalid = join(tempDir, "oversized.jsonl");
		/** 应被返回的有效会话文件。 */
		const valid = join(tempDir, "valid.jsonl");
		writeFileSync(invalid, "x".repeat(HEADER_SCAN_LIMIT_BYTES + 1));
		writeFileSync(valid, '{"type":"session","id":"abc","timestamp":"2025-01-01T00:00:00Z","cwd":"/tmp"}\n');

		expect(findMostRecentSession(tempDir)).toBe(valid);
	});

	/** 验证 cwd 过滤只返回对应项目的最新会话。 */
	it("filters most recent session by cwd", async () => {
		/** 项目 A 的 cwd。 */
		const projectA = join(tempDir, "project-a");
		/** 项目 B 的 cwd。 */
		const projectB = join(tempDir, "project-b");
		/** 项目 A 的会话文件。 */
		const fileA = join(tempDir, "a.jsonl");
		/** 项目 B 的会话文件。 */
		const fileB = join(tempDir, "b.jsonl");

		writeFileSync(
			fileA,
			`${JSON.stringify({ type: "session", id: "a", timestamp: "2025-01-01T00:00:00Z", cwd: projectA })}\n`,
		);
		await new Promise((r) => setTimeout(r, 10));
		writeFileSync(
			fileB,
			`${JSON.stringify({ type: "session", id: "b", timestamp: "2025-01-01T00:00:00Z", cwd: projectB })}\n`,
		);

		expect(findMostRecentSession(tempDir, projectA)).toBe(fileA);
		expect(findMostRecentSession(tempDir, projectB)).toBe(fileB);
	});
});

describe("SessionManager custom flat session directory", () => {
	/** 当前扁平目录用例的根临时目录。 */
	let tempDir: string;
	/** 项目 A 工作目录。 */
	let projectA: string;
	/** 项目 B 工作目录。 */
	let projectB: string;

	/** 每个用例前创建扁平会话根和两个项目目录。 */
	beforeEach(() => {
		tempDir = join(tmpdir(), `session-test-${Date.now()}`);
		projectA = join(tempDir, "project-a");
		projectB = join(tempDir, "project-b");
		mkdirSync(projectA, { recursive: true });
		mkdirSync(projectB, { recursive: true });
	});

	/** 每个用例后删除临时目录。 */
	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	/** 在扁平会话目录中创建含一轮对话的持久化会话。返回文件路径。 */
	function createPersistedSession(cwd: string, label: string): string {
		/** 指定 cwd 和共享会话目录的新会话。 */
		const session = SessionManager.create(cwd, tempDir);
		session.appendMessage({ role: "user", content: label, timestamp: Date.now() });
		session.appendMessage({
			role: "assistant",
			content: [{ type: "text", text: `reply to ${label}` }],
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
			timestamp: Date.now(),
		});
		/** 会话持久化后的文件路径。 */
		const sessionFile = session.getSessionFile();
		if (!sessionFile) {
			throw new Error("Expected persisted session file");
		}
		return sessionFile;
	}

	/** 验证 list 按 cwd 过滤、listAll 返回全部、continueRecent 只续接当前项目。 */
	it("scopes current-folder APIs by cwd while listing all flat sessions", async () => {
		/** 项目 A 创建的会话文件。 */
		const sessionA = createPersistedSession(projectA, "from A");
		await new Promise((r) => setTimeout(r, 10));
		/** 项目 B 创建的会话文件。 */
		const sessionB = createPersistedSession(projectB, "from B");

		/** list 对项目 A 返回的会话。 */
		const currentA = await SessionManager.list(projectA, tempDir);
		expect(currentA.map((session) => session.path)).toEqual([sessionA]);

		/** listAll 返回的两个项目会话。 */
		const all = await SessionManager.listAll(tempDir);
		expect(new Set(all.map((session) => session.path))).toEqual(new Set([sessionA, sessionB]));

		/** continueRecent 为项目 A 恢复的管理器。 */
		const continuedA = SessionManager.continueRecent(projectA, tempDir);
		expect(continuedA.getSessionFile()).toBe(sessionA);
	});
});

describe("SessionManager.setSessionFile with corrupted files", () => {
	/** 当前损坏文件用例的临时目录。 */
	let tempDir: string;

	/** 每个用例前创建独立临时目录。 */
	beforeEach(() => {
		tempDir = join(tmpdir(), `session-test-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
	});

	/** 每个用例后删除临时目录。 */
	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	/** 验证显式空文件会被截断并写入新会话头。 */
	it("truncates and rewrites empty file with valid header", () => {
		/** 待恢复的空会话文件。 */
		const emptyFile = join(tempDir, "empty.jsonl");
		writeFileSync(emptyFile, "");

		/** 从空文件恢复出的会话管理器。 */
		const sm = SessionManager.open(emptyFile, tempDir);

		// Should have created a new session with valid header
		// 空文件应初始化为带有效头的新会话。
		expect(sm.getSessionId()).toBeTruthy();
		expect(sm.getHeader()).toBeTruthy();
		expect(sm.getHeader()?.type).toBe("session");

		// File should now contain a valid header
		// 文件此时应只包含一个有效会话头。
		/** 初始化后的文件全文。 */
		const content = readFileSync(emptyFile, "utf-8");
		/** 去除空行后的 JSONL 行。 */
		const lines = content.trim().split("\n").filter(Boolean);
		expect(lines.length).toBe(1);
		/** 解析后的新会话头。 */
		const header = JSON.parse(lines[0]);
		expect(header.type).toBe("session");
		expect(header.id).toBe(sm.getSessionId());
	});

	/** 验证非空但无会话头的文件抛错且原文不变。 */
	it("throws and preserves non-empty file without valid header", () => {
		/** 包含孤立消息的损坏文件。 */
		const noHeaderFile = join(tempDir, "no-header.jsonl");
		/** 写入并期待保持不变的原始内容。 */
		const originalContent =
			'{"type":"message","id":"abc","parentId":"orphaned","timestamp":"2025-01-01T00:00:00Z","message":{"role":"assistant","content":"test"}}\n';
		writeFileSync(noHeaderFile, originalContent);

		expect(() => SessionManager.open(noHeaderFile, tempDir)).toThrow(
			`Session file is not a valid pi session: ${noHeaderFile}`,
		);
		expect(readFileSync(noHeaderFile, "utf-8")).toBe(originalContent);
	});

	/** 验证扩展名无关，非会话 JSONL 同样不会被覆盖。 */
	it("throws and preserves non-session JSONL files", () => {
		/** 包含普通事件而非会话的文件。 */
		const nonSessionFile = join(tempDir, "not-a-session.log");
		/** 写入并期待保持不变的原始内容。 */
		const originalContent = '{"type":"event","data":"not a session"}\n';
		writeFileSync(nonSessionFile, originalContent);

		expect(() => SessionManager.open(nonSessionFile, tempDir)).toThrow(
			`Session file is not a valid pi session: ${nonSessionFile}`,
		);
		expect(readFileSync(nonSessionFile, "utf-8")).toBe(originalContent);
	});

	/** 验证空文件恢复后仍使用调用者指定的原路径。 */
	it("preserves explicit session file path when recovering from corrupted file", () => {
		/** 调用者显式指定的空文件路径。 */
		const explicitPath = join(tempDir, "my-session.jsonl");
		writeFileSync(explicitPath, "");

		/** 从显式路径恢复出的管理器。 */
		const sm = SessionManager.open(explicitPath, tempDir);

		// The session file path should be preserved
		// 恢复后会话文件路径应保持调用者显式指定的值。
		expect(sm.getSessionFile()).toBe(explicitPath);
	});

	/** 验证空文件完成初始化后可被后续实例正常加载。 */
	it("subsequent loads of initialized empty file work correctly", () => {
		/** 首次打开前为空的会话文件。 */
		const emptyFile = join(tempDir, "empty.jsonl");
		writeFileSync(emptyFile, "");

		/** 负责初始化空文件的第一个管理器。 */
		const sm1 = SessionManager.open(emptyFile, tempDir);
		/** 第一次初始化生成的会话 ID。 */
		const sessionId = sm1.getSessionId();

		/** 再次打开已初始化文件的第二个管理器。 */
		const sm2 = SessionManager.open(emptyFile, tempDir);
		expect(sm2.getSessionId()).toBe(sessionId);
		expect(sm2.getHeader()?.type).toBe("session");
	});
});
/**
 * 文件职责：验证会话 JSONL 的容错读取、最近会话发现、自定义扁平目录和损坏文件恢复策略。
 * 技术维度：使用 Vitest、Node.js 同步文件 API、稀疏超大文件写入和真实 mtime 差异测试磁盘边界。
 * 产品维度：保障用户会话即使含坏行、超大头部或空文件也能安全恢复，且不会覆盖非会话数据。
 * 逻辑维度：依次测试 loadEntriesFromFile、findMostRecentSession、扁平目录作用域和 setSessionFile 损坏文件处理。
 * 关键边界：超大文件用例可能消耗显著磁盘地址空间；10ms 延迟用于区分 mtime；所有临时目录必须递归清理。
 * 新手阅读建议：先看基础有效/无效 JSONL 用例，再读扫描上限与超大文件，最后比较空文件恢复和非空损坏保护。
 */
