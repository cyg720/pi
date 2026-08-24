/**
 * 文件职责：验证会话压缩的 Token 估算、切分点选择、上下文重建、重复压缩判断和真实摘要集成。
 * 技术维度：使用 Vitest、会话条目夹具、压缩核心函数、固定大会话 JSONL 以及可选 Anthropic 在线调用。
 * 产品维度：保障长会话能保留最近内容并用摘要替代旧消息，避免上下文溢出或压缩后状态丢失。
 * 逻辑维度：先构造各类会话条目，再测试 Token 与切分算法、上下文构建、连续压缩，最后验证大夹具。
 * 关键边界：条目编号依赖每个用例前重置；在线摘要分组只有提供 OAuth 凭据时运行且超时为 60 秒。
 * 新手阅读建议：先看 createMessageEntry 的父链构造，再读 findCutPoint 用例，随后阅读 buildSessionContext 与 prepareCompaction。
 */

import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, Usage } from "@earendil-works/pi-ai/compat";
import { getModel } from "@earendil-works/pi-ai/compat";
import { readFileSync } from "fs";
import { join } from "path";
import { beforeEach, describe, expect, it } from "vitest";
import {
	type CompactionSettings,
	calculateContextTokens,
	compact,
	DEFAULT_COMPACTION_SETTINGS,
	estimateContextTokens,
	findCutPoint,
	getLastAssistantUsage,
	prepareCompaction,
	shouldCompact,
} from "../src/core/compaction/index.ts";
import {
	buildSessionContext,
	type CompactionEntry,
	type CustomMessageEntry,
	type ModelChangeEntry,
	migrateSessionEntries,
	parseSessionEntries,
	type SessionEntry,
	type SessionMessageEntry,
	type ThinkingLevelChangeEntry,
} from "../src/core/session-manager.ts";

// ============================================================================
// Test fixtures
// ============================================================================

/** 读取并迁移大会话 JSONL 夹具。无参数；返回去除会话头后的 SessionEntry 数组。例如：loadLargeSessionEntries()。 */
function loadLargeSessionEntries(): SessionEntry[] {
	/** 变量 sessionPath：大会话 JSONL 夹具的绝对路径；仅在当前模块、辅助函数或测试中有效。 */
	const sessionPath = join(__dirname, "fixtures/large-session.jsonl");
	/** 变量 content：从夹具读取的 UTF-8 文本；仅在当前模块、辅助函数或测试中有效。 */
	const content = readFileSync(sessionPath, "utf-8");
	/** 变量 entries：当前场景构造或加载的会话条目数组；仅在当前模块、辅助函数或测试中有效。 */
	const entries = parseSessionEntries(content);
	migrateSessionEntries(entries); // Add id/parentId for v1 fixtures
	// 中文说明：以上英文注释描述测试夹具分段、条目编号、切分预期或压缩后的消息组成。
	return entries.filter((e): e is SessionEntry => e.type !== "session");
}

/** 构造无成本的测试用量。参数 input、output、cacheRead、cacheWrite 为各类 Token；返回 Usage。例如：createMockUsage(100, 50)。 */
function createMockUsage(input: number, output: number, cacheRead = 0, cacheWrite = 0): Usage {
	return {
		input,
		output,
		cacheRead,
		cacheWrite,
		totalTokens: input + output + cacheRead + cacheWrite,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
	};
}

/** 构造用户消息。参数 text 为内容；返回带当前时间戳的 AgentMessage。例如：createUserMessage("hello")。 */
function createUserMessage(text: string): AgentMessage {
	return { role: "user", content: text, timestamp: Date.now() };
}

/** 构造助手消息。参数 text 为内容、usage 可覆盖用量；返回 AssistantMessage。例如：createAssistantMessage("ok")。 */
function createAssistantMessage(text: string, usage?: Usage): AssistantMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		usage: usage || createMockUsage(100, 50),
		stopReason: "stop",
		timestamp: Date.now(),
		api: "anthropic-messages",
		provider: "anthropic",
		model: "claude-sonnet-4-5",
	};
}

/** 变量 entryCounter：生成可预测测试条目编号的递增计数器；仅在当前模块、辅助函数或测试中有效。 */
let entryCounter = 0;
/** 变量 lastId：最新条目编号，用作下一条目的 parentId；仅在当前模块、辅助函数或测试中有效。 */
let lastId: string | null = null;

/** 重置条目编号与上一节点指针。无参数、无返回值。例如：resetEntryCounter()。 */
function resetEntryCounter() {
	entryCounter = 0;
	lastId = null;
}

// Reset counter before each test to get predictable IDs
// 中文说明：以上英文注释描述测试夹具分段、条目编号、切分预期或压缩后的消息组成。
beforeEach(() => {
	resetEntryCounter();
});

/** 把消息包装为父链连续的会话条目。参数 message 为 AgentMessage；返回 SessionMessageEntry。例如：createMessageEntry(message)。 */
function createMessageEntry(message: AgentMessage): SessionMessageEntry {
	/** 变量 id：当前新条目的可预测编号；仅在当前模块、辅助函数或测试中有效。 */
	const id = `test-id-${entryCounter++}`;
	/** 变量 entry：当前辅助函数构造的会话条目；仅在当前模块、辅助函数或测试中有效。 */
	const entry: SessionMessageEntry = {
		type: "message",
		id,
		parentId: lastId,
		timestamp: new Date().toISOString(),
		message,
	};
	lastId = id;
	return entry;
}

/** 创建压缩条目。参数 summary 为摘要、firstKeptEntryId 为保留起点；返回 CompactionEntry。例如：createCompactionEntry("summary", id)。 */
function createCompactionEntry(summary: string, firstKeptEntryId: string): CompactionEntry {
	/** 变量 id：当前新条目的可预测编号；仅在当前模块、辅助函数或测试中有效。 */
	const id = `test-id-${entryCounter++}`;
	/** 变量 entry：当前辅助函数构造的会话条目；仅在当前模块、辅助函数或测试中有效。 */
	const entry: CompactionEntry = {
		type: "compaction",
		id,
		parentId: lastId,
		timestamp: new Date().toISOString(),
		summary,
		firstKeptEntryId,
		tokensBefore: 10000,
	};
	lastId = id;
	return entry;
}

/** 创建模型切换条目。参数 provider 与 modelId 标识模型；返回 ModelChangeEntry。例如：createModelChangeEntry("openai", "gpt-4")。 */
function createModelChangeEntry(provider: string, modelId: string): ModelChangeEntry {
	/** 变量 id：当前新条目的可预测编号；仅在当前模块、辅助函数或测试中有效。 */
	const id = `test-id-${entryCounter++}`;
	/** 变量 entry：当前辅助函数构造的会话条目；仅在当前模块、辅助函数或测试中有效。 */
	const entry: ModelChangeEntry = {
		type: "model_change",
		id,
		parentId: lastId,
		timestamp: new Date().toISOString(),
		provider,
		modelId,
	};
	lastId = id;
	return entry;
}

/** 创建思考等级切换条目。参数 thinkingLevel 为等级；返回 ThinkingLevelChangeEntry。例如：createThinkingLevelEntry("high")。 */
function createThinkingLevelEntry(thinkingLevel: string): ThinkingLevelChangeEntry {
	/** 变量 id：当前新条目的可预测编号；仅在当前模块、辅助函数或测试中有效。 */
	const id = `test-id-${entryCounter++}`;
	/** 变量 entry：当前辅助函数构造的会话条目；仅在当前模块、辅助函数或测试中有效。 */
	const entry: ThinkingLevelChangeEntry = {
		type: "thinking_level_change",
		id,
		parentId: lastId,
		timestamp: new Date().toISOString(),
		thinkingLevel,
	};
	lastId = id;
	return entry;
}

/** 创建可进入上下文的自定义消息条目。参数 content 为文本；返回 CustomMessageEntry。例如：createCustomMessageEntry("note")。 */
function createCustomMessageEntry(content: string): CustomMessageEntry {
	/** 变量 id：当前新条目的可预测编号；仅在当前模块、辅助函数或测试中有效。 */
	const id = `test-id-${entryCounter++}`;
	/** 变量 entry：当前辅助函数构造的会话条目；仅在当前模块、辅助函数或测试中有效。 */
	const entry: CustomMessageEntry = {
		type: "custom_message",
		id,
		parentId: lastId,
		timestamp: new Date().toISOString(),
		customType: "test",
		content,
		display: true,
	};
	lastId = id;
	return entry;
}

/** 从多角色 AgentMessage 数组提取可比较文本。参数 messages 为消息数组；返回按换行拼接的字符串。例如：extractText(messages)。 */
function extractText(messages: AgentMessage[]): string {
	return messages
		.map((message) => {
			switch (message.role) {
				case "user":
					return typeof message.content === "string"
						? message.content
						: message.content
								.filter((block): block is { type: "text"; text: string } => block.type === "text")
								.map((block) => block.text)
								.join(" ");
				case "assistant":
					return message.content
						.filter((block): block is { type: "text"; text: string } => block.type === "text")
						.map((block) => block.text)
						.join(" ");
				case "branchSummary":
				case "compactionSummary":
					return message.summary;
				case "custom":
				case "toolResult":
					return typeof message.content === "string"
						? message.content
						: message.content
								.filter((block): block is { type: "text"; text: string } => block.type === "text")
								.map((block) => block.text)
								.join(" ");
				case "bashExecution":
					return `${message.command}\n${message.output}`;
				default:
					return "";
			}
		})
		.join("\n");
}

// ============================================================================
// Unit tests
// ============================================================================

/** 测试分组：当前会话压缩算法或集成场景。 */
describe("Token calculation", () => {
	/** 测试场景：验证当前 Token、切分、上下文或摘要行为。 */
	it("should calculate total context tokens from usage", () => {
		/** 变量 usage：当前用例使用或取得的 Token 用量；仅在当前模块、辅助函数或测试中有效。 */
		const usage = createMockUsage(1000, 500, 200, 100);
		expect(calculateContextTokens(usage)).toBe(1800);
	});

	/** 测试场景：验证当前 Token、切分、上下文或摘要行为。 */
	it("should handle zero values", () => {
		/** 变量 usage：当前用例使用或取得的 Token 用量；仅在当前模块、辅助函数或测试中有效。 */
		const usage = createMockUsage(0, 0, 0, 0);
		expect(calculateContextTokens(usage)).toBe(0);
	});
});

/** 测试分组：当前会话压缩算法或集成场景。 */
describe("getLastAssistantUsage", () => {
	/** 测试场景：验证当前 Token、切分、上下文或摘要行为。 */
	it("should find the last non-aborted assistant message usage", () => {
		/** 变量 entries：当前场景构造或加载的会话条目数组；仅在当前模块、辅助函数或测试中有效。 */
		const entries: SessionEntry[] = [
			createMessageEntry(createUserMessage("Hello")),
			createMessageEntry(createAssistantMessage("Hi", createMockUsage(100, 50))),
			createMessageEntry(createUserMessage("How are you?")),
			createMessageEntry(createAssistantMessage("Good", createMockUsage(200, 100))),
		];

		/** 变量 usage：当前用例使用或取得的 Token 用量；仅在当前模块、辅助函数或测试中有效。 */
		const usage = getLastAssistantUsage(entries);
		expect(usage).not.toBeNull();
		expect(usage!.input).toBe(200);
	});

	/** 测试场景：验证当前 Token、切分、上下文或摘要行为。 */
	it("should skip aborted messages", () => {
		/** 变量 abortedMsg：停止原因为 aborted 的助手消息；仅在当前模块、辅助函数或测试中有效。 */
		const abortedMsg: AssistantMessage = {
			...createAssistantMessage("Aborted", createMockUsage(300, 150)),
			stopReason: "aborted",
		};

		/** 变量 entries：当前场景构造或加载的会话条目数组；仅在当前模块、辅助函数或测试中有效。 */
		const entries: SessionEntry[] = [
			createMessageEntry(createUserMessage("Hello")),
			createMessageEntry(createAssistantMessage("Hi", createMockUsage(100, 50))),
			createMessageEntry(createUserMessage("How are you?")),
			createMessageEntry(abortedMsg),
		];

		/** 变量 usage：当前用例使用或取得的 Token 用量；仅在当前模块、辅助函数或测试中有效。 */
		const usage = getLastAssistantUsage(entries);
		expect(usage).not.toBeNull();
		expect(usage!.input).toBe(100);
	});

	/** 测试场景：验证当前 Token、切分、上下文或摘要行为。 */
	it("should skip all-zero assistant usage", () => {
		/** 变量 entries：当前场景构造或加载的会话条目数组；仅在当前模块、辅助函数或测试中有效。 */
		const entries: SessionEntry[] = [
			createMessageEntry(createUserMessage("Hello")),
			createMessageEntry(createAssistantMessage("Hi", createMockUsage(100, 50))),
			createMessageEntry(createUserMessage("continue")),
			createMessageEntry(createAssistantMessage("Partial", createMockUsage(0, 0))),
		];

		/** 变量 usage：当前用例使用或取得的 Token 用量；仅在当前模块、辅助函数或测试中有效。 */
		const usage = getLastAssistantUsage(entries);
		expect(usage).not.toBeNull();
		expect(usage!.input).toBe(100);
	});

	/** 测试场景：验证当前 Token、切分、上下文或摘要行为。 */
	it("should return undefined if no assistant messages", () => {
		/** 变量 entries：当前场景构造或加载的会话条目数组；仅在当前模块、辅助函数或测试中有效。 */
		const entries: SessionEntry[] = [createMessageEntry(createUserMessage("Hello"))];
		expect(getLastAssistantUsage(entries)).toBeUndefined();
	});
});

/** 测试分组：当前会话压缩算法或集成场景。 */
describe("estimateContextTokens", () => {
	/** 测试场景：验证当前 Token、切分、上下文或摘要行为。 */
	it("uses the last non-zero assistant usage as the context anchor", () => {
		/** 变量 messages：用于上下文 Token 估算的消息数组；仅在当前模块、辅助函数或测试中有效。 */
		const messages: AgentMessage[] = [
			createUserMessage("Hello"),
			createAssistantMessage("Hi", createMockUsage(100, 50)),
			createUserMessage("continue"),
			createAssistantMessage("Partial thinking", createMockUsage(0, 0)),
		];

		/** 变量 estimate：estimateContextTokens 返回的细分估算；仅在当前模块、辅助函数或测试中有效。 */
		const estimate = estimateContextTokens(messages);

		expect(estimate.usageTokens).toBe(150);
		expect(estimate.lastUsageIndex).toBe(1);
		expect(estimate.trailingTokens).toBeGreaterThan(0);
		expect(estimate.tokens).toBe(150 + estimate.trailingTokens);
	});
});

/** 测试分组：当前会话压缩算法或集成场景。 */
describe("shouldCompact", () => {
	/** 测试场景：验证当前 Token、切分、上下文或摘要行为。 */
	it("should return true when context exceeds threshold", () => {
		/** 变量 settings：当前压缩用例的启用、保留和预留配置；仅在当前模块、辅助函数或测试中有效。 */
		const settings: CompactionSettings = {
			enabled: true,
			reserveTokens: 10000,
			keepRecentTokens: 20000,
		};

		expect(shouldCompact(95000, 100000, settings)).toBe(true);
		expect(shouldCompact(89000, 100000, settings)).toBe(false);
	});

	/** 测试场景：验证当前 Token、切分、上下文或摘要行为。 */
	it("should return false when disabled", () => {
		/** 变量 settings：当前压缩用例的启用、保留和预留配置；仅在当前模块、辅助函数或测试中有效。 */
		const settings: CompactionSettings = {
			enabled: false,
			reserveTokens: 10000,
			keepRecentTokens: 20000,
		};

		expect(shouldCompact(95000, 100000, settings)).toBe(false);
	});
});

/** 测试分组：当前会话压缩算法或集成场景。 */
describe("findCutPoint", () => {
	/** 测试场景：验证当前 Token、切分、上下文或摘要行为。 */
	it("should find cut point based on actual token differences", () => {
		// Create entries with cumulative token counts
		/** 变量 entries：当前场景构造或加载的会话条目数组；仅在当前模块、辅助函数或测试中有效。 */
		// 中文说明：以上英文注释描述测试夹具分段、条目编号、切分预期或压缩后的消息组成。
		const entries: SessionEntry[] = [];
		for (let i = 0; i < 10; i++) {
			/** 循环变量 i：构造累计用量消息时的序号，范围 0 到 9。 */
			entries.push(createMessageEntry(createUserMessage(`User ${i}`)));
			entries.push(
				createMessageEntry(createAssistantMessage(`Assistant ${i}`, createMockUsage(0, 100, (i + 1) * 1000, 0))),
			);
		}

		// 20 entries, last assistant has 10000 tokens
		// keepRecentTokens = 2500: keep entries where diff < 2500
		/** 变量 result：切分、压缩或分支操作的返回结果；仅在当前模块、辅助函数或测试中有效。 */
		// 中文说明：以上英文注释描述测试夹具分段、条目编号、切分预期或压缩后的消息组成。
		const result = findCutPoint(entries, 0, entries.length, 2500);

		// Should cut at a valid cut point (user or assistant message)
		// 中文说明：以上英文注释描述测试夹具分段、条目编号、切分预期或压缩后的消息组成。
		expect(entries[result.firstKeptEntryIndex].type).toBe("message");
		/** 变量 role：切分点消息的用户或助手角色；仅在当前模块、辅助函数或测试中有效。 */
		const role = (entries[result.firstKeptEntryIndex] as SessionMessageEntry).message.role;
		expect(role === "user" || role === "assistant").toBe(true);
	});

	/** 测试场景：验证当前 Token、切分、上下文或摘要行为。 */
	it("should return startIndex if no valid cut points in range", () => {
		/** 变量 entries：当前场景构造或加载的会话条目数组；仅在当前模块、辅助函数或测试中有效。 */
		const entries: SessionEntry[] = [createMessageEntry(createAssistantMessage("a"))];
		/** 变量 result：切分、压缩或分支操作的返回结果；仅在当前模块、辅助函数或测试中有效。 */
		const result = findCutPoint(entries, 0, entries.length, 1000);
		expect(result.firstKeptEntryIndex).toBe(0);
	});

	/** 测试场景：验证当前 Token、切分、上下文或摘要行为。 */
	it("should keep everything if all messages fit within budget", () => {
		/** 变量 entries：当前场景构造或加载的会话条目数组；仅在当前模块、辅助函数或测试中有效。 */
		const entries: SessionEntry[] = [
			createMessageEntry(createUserMessage("1")),
			createMessageEntry(createAssistantMessage("a", createMockUsage(0, 50, 500, 0))),
			createMessageEntry(createUserMessage("2")),
			createMessageEntry(createAssistantMessage("b", createMockUsage(0, 50, 1000, 0))),
		];

		/** 变量 result：切分、压缩或分支操作的返回结果；仅在当前模块、辅助函数或测试中有效。 */
		const result = findCutPoint(entries, 0, entries.length, 50000);
		expect(result.firstKeptEntryIndex).toBe(0);
	});

	/** 测试场景：验证当前 Token、切分、上下文或摘要行为。 */
	it("should indicate split turn when cutting at assistant message", () => {
		// Create a scenario where we cut at an assistant message mid-turn
		/** 变量 entries：当前场景构造或加载的会话条目数组；仅在当前模块、辅助函数或测试中有效。 */
		// 中文说明：以上英文注释描述测试夹具分段、条目编号、切分预期或压缩后的消息组成。
		const entries: SessionEntry[] = [
			createMessageEntry(createUserMessage("Turn 1")),
			createMessageEntry(createAssistantMessage("A1", createMockUsage(0, 100, 1000, 0))),
			createMessageEntry(createUserMessage("Turn 2")), // index 2
			// 中文说明：以上英文注释描述测试夹具分段、条目编号、切分预期或压缩后的消息组成。
			createMessageEntry(createAssistantMessage("A2-1", createMockUsage(0, 100, 5000, 0))), // index 3
			// 中文说明：以上英文注释描述测试夹具分段、条目编号、切分预期或压缩后的消息组成。
			createMessageEntry(createAssistantMessage("A2-2", createMockUsage(0, 100, 8000, 0))), // index 4
			// 中文说明：以上英文注释描述测试夹具分段、条目编号、切分预期或压缩后的消息组成。
			createMessageEntry(createAssistantMessage("A2-3", createMockUsage(0, 100, 10000, 0))), // index 5
			// 中文说明：以上英文注释描述测试夹具分段、条目编号、切分预期或压缩后的消息组成。
		];

		// With keepRecentTokens = 3000, should cut somewhere in Turn 2
		/** 变量 result：切分、压缩或分支操作的返回结果；仅在当前模块、辅助函数或测试中有效。 */
		// 中文说明：以上英文注释描述测试夹具分段、条目编号、切分预期或压缩后的消息组成。
		const result = findCutPoint(entries, 0, entries.length, 3000);

		// If cut at assistant message (not user), should indicate split turn
		/** 变量 cutEntry：切分点处的消息条目；仅在当前模块、辅助函数或测试中有效。 */
		// 中文说明：以上英文注释描述测试夹具分段、条目编号、切分预期或压缩后的消息组成。
		const cutEntry = entries[result.firstKeptEntryIndex] as SessionMessageEntry;
		if (cutEntry.message.role === "assistant") {
			expect(result.isSplitTurn).toBe(true);
			expect(result.turnStartIndex).toBe(2); // Turn 2 starts at index 2
			// 中文说明：以上英文注释描述测试夹具分段、条目编号、切分预期或压缩后的消息组成。
		}
	});

	/** 测试场景：验证当前 Token、切分、上下文或摘要行为。 */
	it("should budget context-visible custom message entries", () => {
		/** 变量 entries：当前场景构造或加载的会话条目数组；仅在当前模块、辅助函数或测试中有效。 */
		const entries: SessionEntry[] = [
			createMessageEntry(createUserMessage("hi")),
			createMessageEntry(createAssistantMessage("hello")),
			createCustomMessageEntry("x".repeat(4000)),
			createMessageEntry(createAssistantMessage("ok")),
		];

		/** 变量 tinyBudget：保留预算为 1 Token 时的切分结果；仅在当前模块、辅助函数或测试中有效。 */
		const tinyBudget = findCutPoint(entries, 0, entries.length, 1);
		expect(tinyBudget.firstKeptEntryIndex).toBe(3);
		expect(tinyBudget.isSplitTurn).toBe(true);
		expect(tinyBudget.turnStartIndex).toBe(2);

		/** 变量 customFitsBudget：预算足以容纳自定义消息时的切分结果；仅在当前模块、辅助函数或测试中有效。 */
		const customFitsBudget = findCutPoint(entries, 0, entries.length, 2);
		expect(customFitsBudget.firstKeptEntryIndex).toBe(2);
		expect(customFitsBudget.isSplitTurn).toBe(false);
		expect(customFitsBudget.turnStartIndex).toBe(-1);
	});
});

/** 测试分组：当前会话压缩算法或集成场景。 */
describe("buildSessionContext", () => {
	/** 测试场景：验证当前 Token、切分、上下文或摘要行为。 */
	it("should load all messages when no compaction", () => {
		/** 变量 entries：当前场景构造或加载的会话条目数组；仅在当前模块、辅助函数或测试中有效。 */
		const entries: SessionEntry[] = [
			createMessageEntry(createUserMessage("1")),
			createMessageEntry(createAssistantMessage("a")),
			createMessageEntry(createUserMessage("2")),
			createMessageEntry(createAssistantMessage("b")),
		];

		/** 变量 loaded：从条目树重建的会话上下文；仅在当前模块、辅助函数或测试中有效。 */
		const loaded = buildSessionContext(entries);
		expect(loaded.messages.length).toBe(4);
		expect(loaded.thinkingLevel).toBe("off");
		expect(loaded.model).toEqual({ provider: "anthropic", modelId: "claude-sonnet-4-5" });
	});

	/** 测试场景：验证当前 Token、切分、上下文或摘要行为。 */
	it("should handle single compaction", () => {
		// IDs: u1=test-id-0, a1=test-id-1, u2=test-id-2, a2=test-id-3, compaction=test-id-4, u3=test-id-5, a3=test-id-6
		/** 变量 u1：第一条用户消息条目；仅在当前模块、辅助函数或测试中有效。 */
		// 中文说明：以上英文注释描述测试夹具分段、条目编号、切分预期或压缩后的消息组成。
		const u1 = createMessageEntry(createUserMessage("1"));
		/** 变量 a1：第一条助手消息条目；仅在当前模块、辅助函数或测试中有效。 */
		const a1 = createMessageEntry(createAssistantMessage("a"));
		/** 变量 u2：第二条用户消息条目；仅在当前模块、辅助函数或测试中有效。 */
		const u2 = createMessageEntry(createUserMessage("2"));
		/** 变量 a2：第二条助手消息条目；仅在当前模块、辅助函数或测试中有效。 */
		const a2 = createMessageEntry(createAssistantMessage("b"));
		/** 变量 compaction：当前场景的压缩条目；仅在当前模块、辅助函数或测试中有效。 */
		const compaction = createCompactionEntry("Summary of 1,a,2,b", u2.id); // keep from u2 onwards
		/** 变量 u3：第三条用户消息条目；仅在当前模块、辅助函数或测试中有效。 */
		// 中文说明：以上英文注释描述测试夹具分段、条目编号、切分预期或压缩后的消息组成。
		const u3 = createMessageEntry(createUserMessage("3"));
		/** 变量 a3：第三条助手消息条目；仅在当前模块、辅助函数或测试中有效。 */
		const a3 = createMessageEntry(createAssistantMessage("c"));

		/** 变量 entries：当前场景构造或加载的会话条目数组；仅在当前模块、辅助函数或测试中有效。 */
		const entries: SessionEntry[] = [u1, a1, u2, a2, compaction, u3, a3];

		/** 变量 loaded：从条目树重建的会话上下文；仅在当前模块、辅助函数或测试中有效。 */
		const loaded = buildSessionContext(entries);
		// summary + kept (u2, a2) + after (u3, a3) = 5
		// 中文说明：以上英文注释描述测试夹具分段、条目编号、切分预期或压缩后的消息组成。
		expect(loaded.messages.length).toBe(5);
		expect(loaded.messages[0].role).toBe("compactionSummary");
		expect((loaded.messages[0] as any).summary).toContain("Summary of 1,a,2,b");
	});

	/** 测试场景：验证当前 Token、切分、上下文或摘要行为。 */
	it("should handle multiple compactions (only latest matters)", () => {
		// First batch
		/** 变量 u1：第一条用户消息条目；仅在当前模块、辅助函数或测试中有效。 */
		// 中文说明：以上英文注释描述测试夹具分段、条目编号、切分预期或压缩后的消息组成。
		const u1 = createMessageEntry(createUserMessage("1"));
		/** 变量 a1：第一条助手消息条目；仅在当前模块、辅助函数或测试中有效。 */
		const a1 = createMessageEntry(createAssistantMessage("a"));
		/** 变量 compact1：第一次压缩条目；仅在当前模块、辅助函数或测试中有效。 */
		const compact1 = createCompactionEntry("First summary", u1.id);
		// Second batch
		/** 变量 u2：第二条用户消息条目；仅在当前模块、辅助函数或测试中有效。 */
		// 中文说明：以上英文注释描述测试夹具分段、条目编号、切分预期或压缩后的消息组成。
		const u2 = createMessageEntry(createUserMessage("2"));
		/** 变量 b：后续助手消息条目；仅在当前模块、辅助函数或测试中有效。 */
		const b = createMessageEntry(createAssistantMessage("b"));
		/** 变量 u3：第三条用户消息条目；仅在当前模块、辅助函数或测试中有效。 */
		const u3 = createMessageEntry(createUserMessage("3"));
		/** 变量 c：后续助手消息条目；仅在当前模块、辅助函数或测试中有效。 */
		const c = createMessageEntry(createAssistantMessage("c"));
		/** 变量 compact2：第二次压缩条目；仅在当前模块、辅助函数或测试中有效。 */
		const compact2 = createCompactionEntry("Second summary", u3.id); // keep from u3 onwards
		// After second compaction
		/** 变量 u4：第四条用户消息条目；仅在当前模块、辅助函数或测试中有效。 */
		// 中文说明：以上英文注释描述测试夹具分段、条目编号、切分预期或压缩后的消息组成。
		const u4 = createMessageEntry(createUserMessage("4"));
		/** 变量 d：后续助手消息条目；仅在当前模块、辅助函数或测试中有效。 */
		const d = createMessageEntry(createAssistantMessage("d"));

		/** 变量 entries：当前场景构造或加载的会话条目数组；仅在当前模块、辅助函数或测试中有效。 */
		const entries: SessionEntry[] = [u1, a1, compact1, u2, b, u3, c, compact2, u4, d];

		/** 变量 loaded：从条目树重建的会话上下文；仅在当前模块、辅助函数或测试中有效。 */
		const loaded = buildSessionContext(entries);
		// summary + kept from u3 (u3, c) + after (u4, d) = 5
		// 中文说明：以上英文注释描述测试夹具分段、条目编号、切分预期或压缩后的消息组成。
		expect(loaded.messages.length).toBe(5);
		expect((loaded.messages[0] as any).summary).toContain("Second summary");
	});

	/** 测试场景：验证当前 Token、切分、上下文或摘要行为。 */
	it("should keep all messages when firstKeptEntryId is first entry", () => {
		/** 变量 u1：第一条用户消息条目；仅在当前模块、辅助函数或测试中有效。 */
		const u1 = createMessageEntry(createUserMessage("1"));
		/** 变量 a1：第一条助手消息条目；仅在当前模块、辅助函数或测试中有效。 */
		const a1 = createMessageEntry(createAssistantMessage("a"));
		/** 变量 compact1：第一次压缩条目；仅在当前模块、辅助函数或测试中有效。 */
		const compact1 = createCompactionEntry("First summary", u1.id); // keep from first entry
		/** 变量 u2：第二条用户消息条目；仅在当前模块、辅助函数或测试中有效。 */
		// 中文说明：以上英文注释描述测试夹具分段、条目编号、切分预期或压缩后的消息组成。
		const u2 = createMessageEntry(createUserMessage("2"));
		/** 变量 b：后续助手消息条目；仅在当前模块、辅助函数或测试中有效。 */
		const b = createMessageEntry(createAssistantMessage("b"));

		/** 变量 entries：当前场景构造或加载的会话条目数组；仅在当前模块、辅助函数或测试中有效。 */
		const entries: SessionEntry[] = [u1, a1, compact1, u2, b];

		/** 变量 loaded：从条目树重建的会话上下文；仅在当前模块、辅助函数或测试中有效。 */
		const loaded = buildSessionContext(entries);
		// summary + all messages (u1, a1, u2, b) = 5
		// 中文说明：以上英文注释描述测试夹具分段、条目编号、切分预期或压缩后的消息组成。
		expect(loaded.messages.length).toBe(5);
	});

	/** 测试场景：验证当前 Token、切分、上下文或摘要行为。 */
	it("should track model and thinking level changes", () => {
		/** 变量 entries：当前场景构造或加载的会话条目数组；仅在当前模块、辅助函数或测试中有效。 */
		const entries: SessionEntry[] = [
			createMessageEntry(createUserMessage("1")),
			createModelChangeEntry("openai", "gpt-4"),
			createMessageEntry(createAssistantMessage("a")),
			createThinkingLevelEntry("high"),
		];

		/** 变量 loaded：从条目树重建的会话上下文；仅在当前模块、辅助函数或测试中有效。 */
		const loaded = buildSessionContext(entries);
		// model_change is later overwritten by assistant message's model info
		// 中文说明：以上英文注释描述测试夹具分段、条目编号、切分预期或压缩后的消息组成。
		expect(loaded.model).toEqual({ provider: "anthropic", modelId: "claude-sonnet-4-5" });
		expect(loaded.thinkingLevel).toBe("high");
	});
});

/** 测试分组：当前会话压缩算法或集成场景。 */
describe("prepareCompaction with previous compaction", () => {
	/** 测试场景：验证当前 Token、切分、上下文或摘要行为。 */
	it("should skip repeated compactions when kept messages still fit", () => {
		/** 变量 u1：第一条用户消息条目；仅在当前模块、辅助函数或测试中有效。 */
		const u1 = createMessageEntry(createUserMessage("user msg 1 (summarized by compaction1)"));
		/** 变量 a1：第一条助手消息条目；仅在当前模块、辅助函数或测试中有效。 */
		const a1 = createMessageEntry(createAssistantMessage("assistant msg 1"));
		/** 变量 u2：第二条用户消息条目；仅在当前模块、辅助函数或测试中有效。 */
		const u2 = createMessageEntry(createUserMessage("user msg 2 - kept by compaction1"));
		/** 变量 a2：第二条助手消息条目；仅在当前模块、辅助函数或测试中有效。 */
		const a2 = createMessageEntry(createAssistantMessage("assistant msg 2"));
		/** 变量 u3：第三条用户消息条目；仅在当前模块、辅助函数或测试中有效。 */
		const u3 = createMessageEntry(createUserMessage("user msg 3 - kept by compaction1"));
		/** 变量 a3：第三条助手消息条目；仅在当前模块、辅助函数或测试中有效。 */
		const a3 = createMessageEntry(createAssistantMessage("assistant msg 3", createMockUsage(5000, 1000)));
		/** 变量 compaction1：既有的第一次压缩条目；仅在当前模块、辅助函数或测试中有效。 */
		const compaction1 = createCompactionEntry("First summary", u2.id);
		/** 变量 u4：第四条用户消息条目；仅在当前模块、辅助函数或测试中有效。 */
		const u4 = createMessageEntry(createUserMessage("user msg 4 (new after compaction1)"));
		/** 变量 a4：第四条助手消息条目；仅在当前模块、辅助函数或测试中有效。 */
		const a4 = createMessageEntry(createAssistantMessage("assistant msg 4", createMockUsage(8000, 2000)));

		/** 变量 pathEntries：当前叶节点到根路径上的条目；仅在当前模块、辅助函数或测试中有效。 */
		const pathEntries = [u1, a1, u2, a2, u3, a3, compaction1, u4, a4];
		/** 变量 preparation：prepareCompaction 返回的摘要准备数据；仅在当前模块、辅助函数或测试中有效。 */
		const preparation = prepareCompaction(pathEntries, DEFAULT_COMPACTION_SETTINGS);

		expect(preparation).toBeUndefined();
	});

	/** 测试场景：验证当前 Token、切分、上下文或摘要行为。 */
	it("should re-summarize previously kept messages when the recent window moves past them", () => {
		/** 变量 u1：第一条用户消息条目；仅在当前模块、辅助函数或测试中有效。 */
		const u1 = createMessageEntry(createUserMessage("user msg 1 (summarized by compaction1)".repeat(4)));
		/** 变量 a1：第一条助手消息条目；仅在当前模块、辅助函数或测试中有效。 */
		const a1 = createMessageEntry(createAssistantMessage("assistant msg 1".repeat(4)));
		/** 变量 u2：第二条用户消息条目；仅在当前模块、辅助函数或测试中有效。 */
		const u2 = createMessageEntry(createUserMessage("user msg 2 - kept by compaction1 ".repeat(12)));
		/** 变量 a2：第二条助手消息条目；仅在当前模块、辅助函数或测试中有效。 */
		const a2 = createMessageEntry(createAssistantMessage("assistant msg 2 ".repeat(12)));
		/** 变量 u3：第三条用户消息条目；仅在当前模块、辅助函数或测试中有效。 */
		const u3 = createMessageEntry(createUserMessage("user msg 3 - kept by compaction1 ".repeat(12)));
		/** 变量 a3：第三条助手消息条目；仅在当前模块、辅助函数或测试中有效。 */
		const a3 = createMessageEntry(createAssistantMessage("assistant msg 3 ".repeat(12), createMockUsage(5000, 1000)));
		/** 变量 compaction1：既有的第一次压缩条目；仅在当前模块、辅助函数或测试中有效。 */
		const compaction1 = createCompactionEntry("First summary", u2.id);
		/** 变量 u4：第四条用户消息条目；仅在当前模块、辅助函数或测试中有效。 */
		const u4 = createMessageEntry(createUserMessage("user msg 4 (new after compaction1) ".repeat(12)));
		/** 变量 a4：第四条助手消息条目；仅在当前模块、辅助函数或测试中有效。 */
		const a4 = createMessageEntry(createAssistantMessage("assistant msg 4 ".repeat(12), createMockUsage(8000, 2000)));

		/** 变量 settings：当前压缩用例的启用、保留和预留配置；仅在当前模块、辅助函数或测试中有效。 */
		const settings: CompactionSettings = {
			...DEFAULT_COMPACTION_SETTINGS,
			keepRecentTokens: 100,
		};
		/** 变量 preparation：prepareCompaction 返回的摘要准备数据；仅在当前模块、辅助函数或测试中有效。 */
		const preparation = prepareCompaction([u1, a1, u2, a2, u3, a3, compaction1, u4, a4], settings);

		expect(preparation).toBeDefined();
		/** 变量 summarizedText：从待摘要消息中提取的纯文本；仅在当前模块、辅助函数或测试中有效。 */
		const summarizedText = extractText(preparation!.messagesToSummarize);
		expect(summarizedText).toContain("user msg 2 - kept by compaction1");
		expect(summarizedText).toContain("user msg 3 - kept by compaction1");
		expect(summarizedText).not.toContain("First summary");
		expect(preparation!.previousSummary).toBe("First summary");
	});
});

// ============================================================================
// Integration tests with real session data
// ============================================================================

/** 测试分组：当前会话压缩算法或集成场景。 */
describe("Large session fixture", () => {
	/** 测试场景：验证当前 Token、切分、上下文或摘要行为。 */
	it("should parse the large session", () => {
		/** 变量 entries：当前场景构造或加载的会话条目数组；仅在当前模块、辅助函数或测试中有效。 */
		const entries = loadLargeSessionEntries();
		expect(entries.length).toBeGreaterThan(100);

		/** 变量 messageCount：大夹具中的消息条目数量；仅在当前模块、辅助函数或测试中有效。 */
		const messageCount = entries.filter((e) => e.type === "message").length;
		expect(messageCount).toBeGreaterThan(100);
	});

	/** 测试场景：验证当前 Token、切分、上下文或摘要行为。 */
	it("should find cut point in large session", () => {
		/** 变量 entries：当前场景构造或加载的会话条目数组；仅在当前模块、辅助函数或测试中有效。 */
		const entries = loadLargeSessionEntries();
		/** 变量 result：切分、压缩或分支操作的返回结果；仅在当前模块、辅助函数或测试中有效。 */
		const result = findCutPoint(entries, 0, entries.length, DEFAULT_COMPACTION_SETTINGS.keepRecentTokens);

		// Cut point should be at a message entry (user or assistant)
		// 中文说明：以上英文注释描述测试夹具分段、条目编号、切分预期或压缩后的消息组成。
		expect(entries[result.firstKeptEntryIndex].type).toBe("message");
		/** 变量 role：切分点消息的用户或助手角色；仅在当前模块、辅助函数或测试中有效。 */
		const role = (entries[result.firstKeptEntryIndex] as SessionMessageEntry).message.role;
		expect(role === "user" || role === "assistant").toBe(true);
	});

	/** 测试场景：验证当前 Token、切分、上下文或摘要行为。 */
	it("should load session correctly", () => {
		/** 变量 entries：当前场景构造或加载的会话条目数组；仅在当前模块、辅助函数或测试中有效。 */
		const entries = loadLargeSessionEntries();
		/** 变量 loaded：从条目树重建的会话上下文；仅在当前模块、辅助函数或测试中有效。 */
		const loaded = buildSessionContext(entries);

		expect(loaded.messages.length).toBeGreaterThan(100);
		expect(loaded.model).not.toBeNull();
	});
});

// ============================================================================
// LLM integration tests (skipped without API key)
// ============================================================================

/** 测试分组：当前会话压缩算法或集成场景。 */
describe.skipIf(!process.env.ANTHROPIC_OAUTH_TOKEN)("LLM summarization", () => {
	/** 测试场景：验证当前 Token、切分、上下文或摘要行为。 */
	it("should generate a compaction result for the large session", async () => {
		/** 变量 entries：当前场景构造或加载的会话条目数组；仅在当前模块、辅助函数或测试中有效。 */
		const entries = loadLargeSessionEntries();
		/** 变量 model：在线摘要使用的 Anthropic 模型；仅在当前模块、辅助函数或测试中有效。 */
		const model = getModel("anthropic", "claude-sonnet-4-5")!;

		/** 变量 preparation：prepareCompaction 返回的摘要准备数据；仅在当前模块、辅助函数或测试中有效。 */
		const preparation = prepareCompaction(entries, DEFAULT_COMPACTION_SETTINGS);
		expect(preparation).toBeDefined();

		/** 变量 compactionResult：真实模型生成的压缩结果；仅在当前模块、辅助函数或测试中有效。 */
		const compactionResult = await compact(preparation!, model, process.env.ANTHROPIC_OAUTH_TOKEN!);

		expect(compactionResult.summary.length).toBeGreaterThan(100);
		expect(compactionResult.firstKeptEntryId).toBeTruthy();
		expect(compactionResult.tokensBefore).toBeGreaterThan(0);

		console.log("Summary length:", compactionResult.summary.length);
		console.log("First kept entry ID:", compactionResult.firstKeptEntryId);
		console.log("Tokens before:", compactionResult.tokensBefore);
		console.log("\n--- SUMMARY ---\n");
		console.log(compactionResult.summary);
	}, 60000);

	/** 测试场景：验证当前 Token、切分、上下文或摘要行为。 */
	it("should produce valid session after compaction", async () => {
		/** 变量 entries：当前场景构造或加载的会话条目数组；仅在当前模块、辅助函数或测试中有效。 */
		const entries = loadLargeSessionEntries();
		/** 变量 loaded：从条目树重建的会话上下文；仅在当前模块、辅助函数或测试中有效。 */
		const loaded = buildSessionContext(entries);
		/** 变量 model：在线摘要使用的 Anthropic 模型；仅在当前模块、辅助函数或测试中有效。 */
		const model = getModel("anthropic", "claude-sonnet-4-5")!;

		/** 变量 preparation：prepareCompaction 返回的摘要准备数据；仅在当前模块、辅助函数或测试中有效。 */
		const preparation = prepareCompaction(entries, DEFAULT_COMPACTION_SETTINGS);
		expect(preparation).toBeDefined();

		/** 变量 compactionResult：真实模型生成的压缩结果；仅在当前模块、辅助函数或测试中有效。 */
		const compactionResult = await compact(preparation!, model, process.env.ANTHROPIC_OAUTH_TOKEN!);

		// Simulate appending compaction to entries by creating a proper entry
		/** 变量 lastEntry：原会话中的最后一条记录；仅在当前模块、辅助函数或测试中有效。 */
		// 中文说明：以上英文注释描述测试夹具分段、条目编号、切分预期或压缩后的消息组成。
		const lastEntry = entries[entries.length - 1];
		/** 变量 parentId：新压缩条目应连接的父条目编号；仅在当前模块、辅助函数或测试中有效。 */
		const parentId = lastEntry.id;
		/** 变量 compactionEntry：准备追加到会话的压缩条目；仅在当前模块、辅助函数或测试中有效。 */
		const compactionEntry: CompactionEntry = {
			type: "compaction",
			id: "compaction-test-id",
			parentId,
			timestamp: new Date().toISOString(),
			...compactionResult,
		};
		/** 变量 newEntries：追加压缩条目后的新会话数组；仅在当前模块、辅助函数或测试中有效。 */
		const newEntries = [...entries, compactionEntry];
		/** 变量 reloaded：从压缩后条目重新构建的会话上下文；仅在当前模块、辅助函数或测试中有效。 */
		const reloaded = buildSessionContext(newEntries);

		// Should have summary + kept messages
		// 中文说明：以上英文注释描述测试夹具分段、条目编号、切分预期或压缩后的消息组成。
		expect(reloaded.messages.length).toBeLessThan(loaded.messages.length);
		expect(reloaded.messages[0].role).toBe("compactionSummary");
		expect((reloaded.messages[0] as any).summary).toContain(compactionResult.summary);

		console.log("Original messages:", loaded.messages.length);
		console.log("After compaction:", reloaded.messages.length);
	}, 60000);
});
