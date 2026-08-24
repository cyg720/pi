/**
 * 文件职责：验证会话退出时生成的恢复命令会正确处理默认目录、自定义目录、Shell 引号和不可恢复场景。
 * 技术维度：使用 Vitest、临时会话文件、SessionManager 测试替身和可恢复的 stdout.isTTY 属性模拟。
 * 产品维度：让用户复制终端提示即可恢复会话，同时避免输出无效命令或路径注入问题。
 * 逻辑维度：帮助函数控制 TTY、创建文件和管理器；八个用例覆盖默认、自定义、引号及 undefined 条件。
 * 关键边界：仅 TTY 且持久化文件存在时返回命令；单引号路径必须按 POSIX Shell 规则转义。
 * 新手阅读建议：先看 createSessionManager 默认值，再按前四个成功命令和后四个拒绝条件阅读。
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { APP_NAME } from "../src/config.ts";
import type { SessionManager } from "../src/core/session-manager.ts";
import { formatResumeCommand } from "../src/modes/interactive/interactive-mode.ts";

// 本文件创建的临时目录列表。
const tempDirs: string[] = [];
// 测试开始前 stdout.isTTY 的原始属性描述符。
const originalStdoutIsTTY = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");

// 功能：恢复 TTY 属性并删除临时目录；参数：无；返回：无。示例：每个用例后自动调用。
afterEach(() => {
	if (originalStdoutIsTTY) {
		Object.defineProperty(process.stdout, "isTTY", originalStdoutIsTTY);
	} else {
		Reflect.deleteProperty(process.stdout, "isTTY");
	}

	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

/** 功能：模拟 stdout TTY 状态；参数 value；返回：无。示例：setStdoutIsTTY(true)。 */
function setStdoutIsTTY(value: boolean): void {
	Object.defineProperty(process.stdout, "isTTY", { configurable: true, value });
}

/** 功能：创建并登记最小会话文件；参数：无；返回：文件路径。示例：const file = createTempFile()。 */
function createTempFile(): string {
	// 独占临时目录。
	const dir = mkdtempSync(join(tmpdir(), "pi-format-resume-command-"));
	tempDirs.push(dir);
	// 临时 JSONL 会话文件路径。
	const file = join(dir, "session.jsonl");
	writeFileSync(file, "\n");
	return file;
}

/** 功能：按选项构造 SessionManager 替身；参数 options；返回：最小管理器。示例：createSessionManager({ sessionFile })。 */
function createSessionManager(options: {
	persisted?: boolean;
	sessionFile?: string;
	sessionId?: string;
	sessionDir?: string;
	usesDefaultSessionDir?: boolean;
}): SessionManager {
	return {
		isPersisted: () => options.persisted ?? true,
		getSessionFile: () => options.sessionFile,
		getSessionId: () => options.sessionId ?? "0197f6e4-4cf9-7f44-a2d8-f8f7f49ee9d3",
		getSessionDir: () => options.sessionDir ?? "/tmp/pi-sessions",
		usesDefaultSessionDir: () => options.usesDefaultSessionDir ?? true,
	} as unknown as SessionManager;
}

describe("formatResumeCommand", () => {
	it("returns a session resume command for default session dirs", () => {
		setStdoutIsTTY(true);
		// 默认目录场景的现存会话文件。
		const sessionFile = createTempFile();
		// 使用默认会话目录的管理器替身。
		const sessionManager = createSessionManager({ sessionFile, sessionId: "test-session" });

		expect(formatResumeCommand(sessionManager)).toBe(`${APP_NAME} --session test-session`);
	});

	it("includes unquoted safe session dirs for non-default session dirs", () => {
		setStdoutIsTTY(true);
		// 自定义安全目录场景的现存会话文件。
		const sessionFile = createTempFile();
		// 使用无需引号自定义目录的管理器替身。
		const sessionManager = createSessionManager({
			sessionFile,
			sessionId: "test-session",
			sessionDir: "/tmp/custom-pi-sessions",
			usesDefaultSessionDir: false,
		});

		expect(formatResumeCommand(sessionManager)).toBe(
			`${APP_NAME} --session-dir /tmp/custom-pi-sessions --session test-session`,
		);
	});

	it("quotes session dirs containing spaces", () => {
		setStdoutIsTTY(true);
		// 含空格目录场景的现存会话文件。
		const sessionFile = createTempFile();
		// 使用需单引号包裹目录的管理器替身。
		const sessionManager = createSessionManager({
			sessionFile,
			sessionId: "test-session",
			sessionDir: "/tmp/custom pi sessions",
			usesDefaultSessionDir: false,
		});

		expect(formatResumeCommand(sessionManager)).toBe(
			`${APP_NAME} --session-dir '/tmp/custom pi sessions' --session test-session`,
		);
	});

	it("quotes session dirs containing single quotes", () => {
		setStdoutIsTTY(true);
		// 含单引号目录场景的现存会话文件。
		const sessionFile = createTempFile();
		// 使用需特殊转义单引号目录的管理器替身。
		const sessionManager = createSessionManager({
			sessionFile,
			sessionId: "test-session",
			sessionDir: "/tmp/custom pi's sessions",
			usesDefaultSessionDir: false,
		});

		expect(formatResumeCommand(sessionManager)).toBe(
			`${APP_NAME} --session-dir '/tmp/custom pi'\\''s sessions' --session test-session`,
		);
	});

	it("returns undefined when stdout is not a TTY", () => {
		setStdoutIsTTY(false);
		// 非 TTY 场景仍存在的会话文件。
		const sessionFile = createTempFile();
		// 非 TTY 场景的管理器替身。
		const sessionManager = createSessionManager({ sessionFile });

		expect(formatResumeCommand(sessionManager)).toBeUndefined();
	});

	it("returns undefined for in-memory sessions", () => {
		setStdoutIsTTY(true);
		// 内存会话场景的临时文件，仅用于隔离 persisted 条件。
		const sessionFile = createTempFile();
		// persisted=false 的管理器替身。
		const sessionManager = createSessionManager({ persisted: false, sessionFile });

		expect(formatResumeCommand(sessionManager)).toBeUndefined();
	});

	it("returns undefined when the session file is missing", () => {
		setStdoutIsTTY(true);
		// 指向不存在会话文件的管理器替身。
		const sessionManager = createSessionManager({ sessionFile: "/tmp/pi-missing-session.jsonl" });

		expect(formatResumeCommand(sessionManager)).toBeUndefined();
	});

	it("returns undefined when the session file is not set", () => {
		setStdoutIsTTY(true);
		// 未设置 sessionFile 的管理器替身。
		const sessionManager = createSessionManager({ sessionFile: undefined });

		expect(formatResumeCommand(sessionManager)).toBeUndefined();
	});
});
