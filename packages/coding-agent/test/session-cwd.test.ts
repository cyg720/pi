/**
 * 文件职责：验证持久化会话工作目录缺失时的检测、覆盖和受控错误行为。
 * 技术维度：使用 Vitest、临时 JSONL 会话文件、SessionManager 和运行时工厂注入。
 * 产品维度：避免恢复已移动项目的会话时在错误目录运行工具，并允许用户选择回退目录。
 * 逻辑维度：创建缺失 cwd 的会话，分别检查问题对象、打开时覆盖和运行时创建前拒绝。
 * 关键边界：测试递归删除临时目录；受控错误必须在调用真实运行时工厂之前抛出。
 * 新手阅读建议：先看两个文件夹辅助函数，再按“检测、覆盖、阻止”三个用例阅读。
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type CreateAgentSessionRuntimeFactory, createAgentSessionRuntime } from "../src/core/agent-session-runtime.ts";
import { getMissingSessionCwdIssue, MissingSessionCwdError } from "../src/core/session-cwd.ts";
import { SessionManager } from "../src/core/session-manager.ts";

/** 创建唯一临时目录；name 为前缀，返回目录路径。 */
function createTempDir(name: string): string {
	// dir 是带时间和随机后缀的系统临时目录路径。
	const dir = join(tmpdir(), `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(dir, { recursive: true });
	return dir;
}

/** 把含指定 cwd 的最小 v3 会话头写入 path；无返回值。 */
function writeSessionFile(path: string, cwd: string): void {
	writeFileSync(
		path,
		`${JSON.stringify({
			type: "session",
			version: 3,
			id: "session-id",
			timestamp: new Date().toISOString(),
			cwd,
		})}\n`,
	);
}

describe("session cwd handling", () => {
	// cleanupPaths 保存每个用例创建的临时目录。
	const cleanupPaths: string[] = [];

	// 每例后递归删除全部登记目录；无参数，无返回值。
	afterEach(() => {
		// path 是当前待删除的临时目录。
		for (const path of cleanupPaths.splice(0)) {
			rmSync(path, { recursive: true, force: true });
		}
	});

	// 验证持久化 cwd 不存在时返回完整问题描述；无参数，无返回值。
	it("detects missing session cwd from persisted sessions", () => {
		// fallbackCwd 是实际存在的可回退目录。
		const fallbackCwd = createTempDir("pi-session-cwd-fallback");
		// missingCwd 是故意不存在的会话工作目录。
		const missingCwd = join(fallbackCwd, "does-not-exist");
		// sessionDir 是会话文件所在临时目录。
		const sessionDir = createTempDir("pi-session-cwd-session-dir");
		// sessionFile 是最小会话 JSONL 路径。
		const sessionFile = join(sessionDir, "session.jsonl");
		cleanupPaths.push(fallbackCwd, sessionDir);
		writeSessionFile(sessionFile, missingCwd);

		// sessionManager 按文件中缺失的 cwd 打开会话。
		const sessionManager = SessionManager.open(sessionFile);
		// issue 是检测到的缺失目录问题详情。
		const issue = getMissingSessionCwdIssue(sessionManager, fallbackCwd);
		expect(issue).toEqual({
			sessionFile: sessionManager.getSessionFile(),
			sessionCwd: missingCwd,
			fallbackCwd,
		});
	});

	// 验证打开会话时可用 fallbackCwd 覆盖有效目录；无参数，无返回值。
	it("supports overriding the effective cwd when opening a session", () => {
		// fallbackCwd 是用于覆盖的现存目录。
		const fallbackCwd = createTempDir("pi-session-cwd-override");
		// missingCwd 是文件中保存的不存在目录。
		const missingCwd = join(fallbackCwd, "does-not-exist");
		// sessionDir 和 sessionFile 保存测试会话。
		const sessionDir = createTempDir("pi-session-cwd-override-session-dir");
		const sessionFile = join(sessionDir, "session.jsonl");
		cleanupPaths.push(fallbackCwd, sessionDir);
		writeSessionFile(sessionFile, missingCwd);

		// sessionManager 使用第三个参数覆盖有效 cwd。
		const sessionManager = SessionManager.open(sessionFile, undefined, fallbackCwd);
		expect(sessionManager.getCwd()).toBe(fallbackCwd);
		expect(getMissingSessionCwdIssue(sessionManager, fallbackCwd)).toBeUndefined();
	});

	// 验证缺失 cwd 会在运行时工厂执行前抛出受控错误；无参数，无返回值。
	it("throws a controlled error before runtime creation when the stored cwd is missing", async () => {
		// fallbackCwd 是运行时请求使用的现存目录。
		const fallbackCwd = createTempDir("pi-session-cwd-runtime");
		// missingCwd 是会话头保存的不存在目录。
		const missingCwd = join(fallbackCwd, "does-not-exist");
		// sessionDir 和 sessionFile 保存测试会话。
		const sessionDir = createTempDir("pi-session-cwd-runtime-session-dir");
		const sessionFile = join(sessionDir, "session.jsonl");
		cleanupPaths.push(fallbackCwd, sessionDir);
		writeSessionFile(sessionFile, missingCwd);

		// sessionManager 保留文件中的缺失 cwd。
		const sessionManager = SessionManager.open(sessionFile);
		// createRuntimeCalled 记录工厂是否被错误调用，初始为 false。
		let createRuntimeCalled = false;
		// createRuntime 是一旦调用就标记并抛错的运行时工厂。
		const createRuntime: CreateAgentSessionRuntimeFactory = async () => {
			createRuntimeCalled = true;
			throw new Error("should not be called");
		};

		await expect(
			createAgentSessionRuntime(createRuntime, {
				cwd: fallbackCwd,
				agentDir: fallbackCwd,
				sessionManager,
			}),
		).rejects.toBeInstanceOf(MissingSessionCwdError);
		expect(createRuntimeCalled).toBe(false);
	});
});
