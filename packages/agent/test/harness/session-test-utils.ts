/**
 * 文件职责：为 Agent Harness 会话测试创建标准消息和自动清理的临时目录。
 * 技术维度：使用 AgentMessage 联合类型、Node 文件系统和 Vitest afterEach。
 * 产品维度：统一测试夹具，减少各会话测试重复代码和临时文件泄漏。
 * 逻辑维度：两个函数构造用户/助手消息；目录函数登记路径；afterEach 逐个删除。
 * 关键边界：助手模型和用量为固定假值；getLatestTempDir 只应在已创建目录后调用。
 * 新手阅读建议：先看两个消息结构差异，再阅读 tempDirs 的创建、查询和清理生命周期。
 */
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { afterEach } from "vitest";

/** @param text 用户文本。@returns 带当前时间戳的用户 AgentMessage。 */
export function createUserMessage(text: string): AgentMessage {
	return {
		role: "user",
		content: [{ type: "text", text }],
		timestamp: Date.now(),
	};
}

/** @param text 助手文本。@returns 带固定模型与零用量的助手 AgentMessage。 */
export function createAssistantMessage(text: string): AgentMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		api: "anthropic-messages",
		provider: "anthropic",
		model: "claude-sonnet-4-5",
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
	};
}

/** 本文件创建且待清理的临时目录栈。 */
const tempDirs: string[] = [];

/** @returns 新建并登记的唯一会话临时目录。@example `const dir = createTempDir()`。 */
export function createTempDir(): string {
	/** 时间戳加随机后缀的临时目录路径。 */
	const dir = join(tmpdir(), `pi-agent-session-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(dir, { recursive: true });
	tempDirs.push(dir);
	return dir;
}

/** @returns 最近创建的临时目录；调用前必须至少创建一个目录。 */
export function getLatestTempDir(): string {
	return tempDirs[tempDirs.length - 1]!;
}

/** 每例结束后按后进先出顺序删除所有登记目录。 */
afterEach(() => {
	while (tempDirs.length > 0) {
		/** 当前弹出的已登记临时目录。 */
		const dir = tempDirs.pop()!;
		if (existsSync(dir)) {
			rmSync(dir, { recursive: true, force: true });
		}
	}
});
