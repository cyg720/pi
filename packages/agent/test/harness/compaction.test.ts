/**
 * 文件职责：验证会话压缩中的令牌估算、切分点选择、摘要生成、上下文重建和文件操作保留。
 * 技术维度：使用 Vitest、faux provider、会话树夹具和伪 Usage 数据离线模拟长会话压缩。
 * 产品维度：确保长对话接近上下文上限时仍能保留近期内容、历史摘要和关键文件操作信息。
 * 逻辑维度：先构造消息与会话条目，再测试估算和切分，随后覆盖摘要生成、错误传播及最终压缩结果。
 * 关键边界：估算值不是精确分词结果；树父子关系、助手 usage 与模型输出上限会直接影响压缩判断。
 * 新手阅读建议：先看 createMockUsage 和条目工厂，再读 findCutPoint/prepareCompaction，最后看 compact 摘要流程。
 */
import {
	type AssistantMessage,
	createModels,
	type FauxProviderHandle,
	fauxAssistantMessage,
	fauxProvider,
	type Message,
	type Model,
	type Models,
	type Usage,
} from "@earendil-works/pi-ai";
import { beforeEach, describe, expect, it } from "vitest";
import {
	type CompactionPreparation,
	calculateContextTokens,
	compact,
	DEFAULT_COMPACTION_SETTINGS,
	estimateContextTokens,
	estimateTokens,
	findCutPoint,
	findTurnStartIndex,
	generateSummary,
	generateSummaryWithUsage,
	getLastAssistantUsage,
	prepareCompaction,
	serializeConversation,
	shouldCompact,
} from "../../src/harness/compaction/compaction.ts";
import { buildSessionContext } from "../../src/harness/session/session.ts";
import type {
	BranchSummaryEntry,
	CompactionEntry,
	CompactionSettings,
	CustomMessageEntry,
	MessageEntry,
	ModelChangeEntry,
	SessionTreeEntry,
	ThinkingLevelChangeEntry,
} from "../../src/harness/types.ts";
import { getOrThrow } from "../../src/harness/types.ts";
import type { AgentMessage } from "../../src/types.ts";

/** 变量 nextId 保存“nextId”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
let nextId = 0;
/** 创建 createId 对应步骤；无参数；返回值供调用方继续执行或断言。示例：createId()。 */
function createId(): string {
	return `entry-${nextId++}`;
}

/** 创建 createMockUsage 对应步骤；参数 input、output、cacheRead、cacheWrite 按签名提供所需输入；返回值供调用方继续执行或断言。示例：createMockUsage(..., ..., ..., ...)。 */
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

/** 创建 createUserMessage 对应步骤；参数 text 按签名提供所需输入；返回值供调用方继续执行或断言。示例：createUserMessage(...)。 */
function createUserMessage(text: string): AgentMessage {
	return {
		role: "user",
		content: [{ type: "text", text }],
		timestamp: Date.now(),
	};
}

/** 创建 createAssistantMessage 对应步骤；参数 text、usage、50 按签名提供所需输入；返回值供调用方继续执行或断言。示例：createAssistantMessage(..., ..., ...)。 */
function createAssistantMessage(text: string, usage = createMockUsage(100, 50)): AssistantMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		api: "anthropic-messages",
		provider: "anthropic",
		model: "claude-sonnet-4-5",
		usage,
		stopReason: "stop",
		timestamp: Date.now(),
	};
}

/** 创建 createMessageEntry 对应步骤；参数 message、parentId 按签名提供所需输入；返回值供调用方继续执行或断言。示例：createMessageEntry(..., ...)。 */
function createMessageEntry(message: AgentMessage, parentId: string | null = null): MessageEntry {
	return {
		type: "message",
		id: createId(),
		parentId,
		timestamp: new Date().toISOString(),
		message,
	};
}

/** 创建 createCompactionEntry 对应步骤；无参数；返回值供调用方继续执行或断言。示例：createCompactionEntry()。 */
function createCompactionEntry(
	summary: string,
	firstKeptEntryId: string,
	parentId: string | null = null,
	retainedTail?: AgentMessage[],
): CompactionEntry {
	return {
		type: "compaction",
		id: createId(),
		parentId,
		timestamp: new Date().toISOString(),
		summary,
		firstKeptEntryId,
		tokensBefore: 1234,
		retainedTail,
	};
}

/** 创建 createThinkingLevelEntry 对应步骤；参数 level、parentId 按签名提供所需输入；返回值供调用方继续执行或断言。示例：createThinkingLevelEntry(..., ...)。 */
function createThinkingLevelEntry(level: string, parentId: string | null = null): ThinkingLevelChangeEntry {
	return {
		type: "thinking_level_change",
		id: createId(),
		parentId,
		timestamp: new Date().toISOString(),
		thinkingLevel: level,
	};
}

/** 创建 createModelChangeEntry 对应步骤；参数 provider、modelId、parentId 按签名提供所需输入；返回值供调用方继续执行或断言。示例：createModelChangeEntry(..., ..., ...)。 */
function createModelChangeEntry(provider: string, modelId: string, parentId: string | null = null): ModelChangeEntry {
	return {
		type: "model_change",
		id: createId(),
		parentId,
		timestamp: new Date().toISOString(),
		provider,
		modelId,
	};
}

/** Shared collection; each faux provider gets a unique id so coexisting fakes route correctly. */
// 共享模型集合供伪提供商复用；每个伪提供商使用唯一编号，避免并存时路由错误。
const models = createModels();
/** 变量 fauxCount 保存测试使用的模型提供商或伪实现；取值由声明类型和当前场景约束，注意隔离可变状态。 */
let fauxCount = 0;

/** 创建 createFauxModel 对应步骤；参数 reasoning、maxTokens 按签名提供所需输入；返回值供调用方继续执行或断言。示例：createFauxModel(..., ...)。 */
function createFauxModel(reasoning: boolean, maxTokens = 8192): { faux: FauxProviderHandle; model: Model<string> } {
	/** 常量 faux 保存测试使用的模型提供商或伪实现；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const faux = fauxProvider({
		provider: `faux-${++fauxCount}`,
		models: [
			{
				id: reasoning ? "reasoning-model" : "non-reasoning-model",
				reasoning,
				contextWindow: 200000,
				maxTokens,
			},
		],
	});
	models.setProvider(faux.provider);
	return { faux, model: faux.getModel() };
}

/** 创建 createModelsWithSimpleResponses 对应步骤；参数 responses 按签名提供所需输入；返回值供调用方继续执行或断言。示例：createModelsWithSimpleResponses(...)。 */
function createModelsWithSimpleResponses(responses: AssistantMessage[]): Models {
	/** 常量 remaining 保存“remaining”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const remaining = [...responses];
	/** 常量 stub 保存“stub”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const stub = Object.create(models) as Models;
	stub.completeSimple = async () => {
		/** 常量 response 保存当前调用返回的响应；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const response = remaining.shift();
		if (!response) throw new Error("No faux completeSimple response queued");
		return response;
	};
	return stub;
}

// 用例分组：集中验证“harness compaction”相关功能。
describe("harness compaction", () => {
	beforeEach(() => {
		nextId = 0;
	});

	// 测试场景：验证“calculates total context tokens from usage”对应的行为、返回值与边界条件。
	it("calculates total context tokens from usage", () => {
		expect(calculateContextTokens(createMockUsage(1000, 500, 200, 100))).toBe(1800);
		expect(calculateContextTokens(createMockUsage(0, 0, 0, 0))).toBe(0);
	});

	// 测试场景：验证“checks compaction threshold”对应的行为、返回值与边界条件。
	it("checks compaction threshold", () => {
		/** 常量 settings 保存控制当前行为的配置选项；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const settings: CompactionSettings = {
			enabled: true,
			reserveTokens: 10000,
			keepRecentTokens: 20000,
		};
		expect(shouldCompact(95000, 100000, settings)).toBe(true);
		expect(shouldCompact(89000, 100000, settings)).toBe(false);
		expect(shouldCompact(95000, 100000, { ...settings, enabled: false })).toBe(false);
	});

	// 测试场景：验证“finds a cut point based on token differences”对应的行为、返回值与边界条件。
	it("finds a cut point based on token differences", () => {
		/** 常量 entries 保存“entries”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const entries: SessionTreeEntry[] = [];
		/** 变量 parentId 保存“parentId”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		let parentId: string | null = null;
		/** 循环变量 i 表示当前遍历项或索引，只在本循环体内有效。 */
		for (let i = 0; i < 10; i++) {
			/** 常量 user 保存“user”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const user = createMessageEntry(createUserMessage(`User ${i}`), parentId);
			entries.push(user);
			/** 常量 assistant 保存“assistant”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const assistant = createMessageEntry(
				createAssistantMessage(`Assistant ${i}`, createMockUsage(0, 100, (i + 1) * 1000, 0)),
				user.id,
			);
			entries.push(assistant);
			parentId = assistant.id;
		}

		/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const result = findCutPoint(entries, 0, entries.length, 2500);
		expect(entries[result.firstKeptEntryIndex]?.type).toBe("message");
	});

	// 测试场景：验证“covers cut-point and turn-start edge cases”对应的行为、返回值与边界条件。
	it("covers cut-point and turn-start edge cases", () => {
		/** 常量 thinking 保存“thinking”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const thinking = createThinkingLevelEntry("high");
		/** 常量 modelChange 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const modelChange = createModelChangeEntry("openai", "gpt-4", thinking.id);
		expect(findCutPoint([thinking, modelChange], 0, 2, 1)).toEqual({
			firstKeptEntryIndex: 0,
			turnStartIndex: -1,
			isSplitTurn: false,
		});

		/** 常量 branchSummary 保存“branchSummary”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const branchSummary: BranchSummaryEntry = {
			type: "branch_summary",
			id: createId(),
			parentId: modelChange.id,
			timestamp: new Date().toISOString(),
			fromId: "branch",
			summary: "branch summary",
		};
		/** 常量 customMessage 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const customMessage: CustomMessageEntry = {
			type: "custom_message",
			id: createId(),
			parentId: branchSummary.id,
			timestamp: new Date().toISOString(),
			customType: "note",
			content: "custom content",
			display: true,
		};
		expect(findTurnStartIndex([thinking, branchSummary], 1, 0)).toBe(1);
		expect(findTurnStartIndex([thinking, customMessage], 1, 0)).toBe(1);
		expect(findTurnStartIndex([thinking, modelChange], 1, 0)).toBe(-1);

		/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const result = findCutPoint([thinking, branchSummary, customMessage], 0, 3, 1);
		expect(result.firstKeptEntryIndex).toBe(0);

		/** 常量 toolResult 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const toolResult = createMessageEntry({
			role: "toolResult",
			toolCallId: "call-1",
			toolName: "read",
			content: [{ type: "text", text: "tool output" }],
			isError: false,
			timestamp: Date.now(),
		});
		expect(findCutPoint([toolResult], 0, 1, 1)).toEqual({
			firstKeptEntryIndex: 0,
			turnStartIndex: -1,
			isSplitTurn: false,
		});

		/** 常量 user 保存“user”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const user = createMessageEntry(createUserMessage("user"));
		/** 常量 compaction 保存“compaction”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const compaction = createCompactionEntry("summary", user.id, user.id);
		/** 常量 assistant 保存“assistant”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const assistant = createMessageEntry(createAssistantMessage("assistant"), compaction.id);
		expect(findCutPoint([user, compaction, assistant], 0, 3, 1).firstKeptEntryIndex).toBe(2);
	});

	// 测试场景：验证“estimates tokens and context usage across supported message roles”对应的行为、返回值与边界条件。
	it("estimates tokens and context usage across supported message roles", () => {
		/** 常量 usage 保存令牌或用量数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const usage = createMockUsage(10, 5, 3, 2);
		/** 常量 assistant 保存“assistant”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const assistant = createAssistantMessage("assistant", usage);
		/** 常量 assistantWithThinkingAndTool 保存“assistantWithThinkingAndTool”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const assistantWithThinkingAndTool: AssistantMessage = {
			...assistant,
			content: [
				{ type: "thinking", thinking: "thinking" },
				{ type: "toolCall", id: "call-1", name: "read", arguments: { path: "file.ts" } },
			],
		};
		/** 常量 customString 保存“customString”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const customString: AgentMessage = {
			role: "custom",
			customType: "note",
			content: "custom text",
			display: true,
			timestamp: Date.now(),
		};
		/** 常量 toolResultWithImage 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const toolResultWithImage: AgentMessage = {
			role: "toolResult",
			toolCallId: "call-1",
			toolName: "read",
			content: [
				{ type: "text", text: "tool text" },
				{ type: "image", mimeType: "image/png", data: "abc" },
			],
			isError: false,
			timestamp: Date.now(),
		};
		/** 常量 bashExecution 保存“bashExecution”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const bashExecution: AgentMessage = {
			role: "bashExecution",
			command: "npm run check",
			output: "ok",
			exitCode: 0,
			cancelled: false,
			truncated: false,
			timestamp: Date.now(),
		};
		/** 常量 branchSummaryMessage 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const branchSummaryMessage: AgentMessage = {
			role: "branchSummary",
			summary: "branch",
			fromId: "x",
			timestamp: Date.now(),
		};
		/** 常量 compactionSummaryMessage 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const compactionSummaryMessage: AgentMessage = {
			role: "compactionSummary",
			summary: "compact",
			tokensBefore: 123,
			timestamp: Date.now(),
		};

		expect(estimateTokens({ role: "user", content: "plain user", timestamp: Date.now() })).toBeGreaterThan(0);
		expect(estimateTokens(assistantWithThinkingAndTool)).toBeGreaterThan(0);
		expect(estimateTokens(customString)).toBeGreaterThan(0);
		expect(estimateTokens(toolResultWithImage)).toBeGreaterThan(1000);
		expect(estimateTokens(bashExecution)).toBeGreaterThan(0);
		expect(estimateTokens(branchSummaryMessage)).toBeGreaterThan(0);
		expect(estimateTokens(compactionSummaryMessage)).toBeGreaterThan(0);
		expect(estimateTokens({ role: "unknown", timestamp: Date.now() } as unknown as AgentMessage)).toBe(0);
		expect(
			getLastAssistantUsage([createMessageEntry(createUserMessage("user")), createMessageEntry(assistant)]),
		).toBe(usage);
		expect(
			getLastAssistantUsage([
				createMessageEntry({ ...assistant, stopReason: "aborted" }),
				createMessageEntry({ ...assistant, stopReason: "error" }),
			]),
		).toBeUndefined();
		expect(
			getLastAssistantUsage([
				createMessageEntry(createUserMessage("user")),
				createMessageEntry(assistant),
				createMessageEntry(createAssistantMessage("partial", createMockUsage(0, 0))),
			]),
		).toBe(usage);
		expect(estimateContextTokens([createUserMessage("no usage")]).lastUsageIndex).toBeNull();
		expect(estimateContextTokens([assistant, createUserMessage("tail")])).toMatchObject({
			usageTokens: 20,
			lastUsageIndex: 0,
		});
		/** 常量 estimate 保存“estimate”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const estimate = estimateContextTokens([
			createUserMessage("Hello"),
			assistant,
			createUserMessage("continue"),
			createAssistantMessage("Partial thinking", createMockUsage(0, 0)),
		]);
		expect(estimate.usageTokens).toBe(20);
		expect(estimate.lastUsageIndex).toBe(1);
		expect(estimate.trailingTokens).toBeGreaterThan(0);
		expect(estimate.tokens).toBe(20 + estimate.trailingTokens);
	});

	// 测试场景：验证“builds session context with a compaction entry”对应的行为、返回值与边界条件。
	it("builds session context with a compaction entry", () => {
		/** 常量 u1 保存会话树中的当前条目；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const u1 = createMessageEntry(createUserMessage("1"));
		/** 常量 a1 保存会话树中的当前条目；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const a1 = createMessageEntry(createAssistantMessage("a"), u1.id);
		/** 常量 u2 保存会话树中的当前条目；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const u2 = createMessageEntry(createUserMessage("2"), a1.id);
		/** 常量 a2 保存会话树中的当前条目；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const a2 = createMessageEntry(createAssistantMessage("b"), u2.id);
		/** 常量 compaction 保存“compaction”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const compaction = createCompactionEntry("Summary of 1,a,2,b", u2.id, a2.id, [
			createUserMessage("2"),
			createAssistantMessage("b"),
		]);
		/** 常量 u3 保存会话树中的当前条目；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const u3 = createMessageEntry(createUserMessage("3"), compaction.id);
		/** 常量 a3 保存会话树中的当前条目；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const a3 = createMessageEntry(createAssistantMessage("c"), u3.id);
		/** 常量 loaded 保存“loaded”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const loaded = buildSessionContext([u1, a1, u2, a2, compaction, u3, a3]);
		expect(loaded.messages).toHaveLength(5);
		expect(loaded.messages[0]?.role).toBe("compactionSummary");
		expect(loaded.messages.map((message) => message.role)).toEqual([
			"compactionSummary",
			"user",
			"assistant",
			"user",
			"assistant",
		]);
	});

	// 测试场景：验证“falls back to firstKeptEntryId when a compaction has no retained tail”对应的行为、返回值与边界条件。
	it("falls back to firstKeptEntryId when a compaction has no retained tail", () => {
		/** 常量 u1 保存会话树中的当前条目；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const u1 = createMessageEntry(createUserMessage("1"));
		/** 常量 a1 保存会话树中的当前条目；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const a1 = createMessageEntry(createAssistantMessage("a"), u1.id);
		/** 常量 u2 保存会话树中的当前条目；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const u2 = createMessageEntry(createUserMessage("2"), a1.id);
		/** 常量 a2 保存会话树中的当前条目；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const a2 = createMessageEntry(createAssistantMessage("b"), u2.id);
		/** 常量 compaction 保存“compaction”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const compaction = createCompactionEntry("Summary of 1,a,2,b", u2.id, a2.id);
		/** 常量 u3 保存会话树中的当前条目；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const u3 = createMessageEntry(createUserMessage("3"), compaction.id);
		/** 常量 loaded 保存“loaded”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const loaded = buildSessionContext([u1, a1, u2, a2, compaction, u3]);
		expect(loaded.messages.map((message) => message.role)).toEqual([
			"compactionSummary",
			"user",
			"assistant",
			"user",
		]);
	});

	// 测试场景：验证“tracks model and thinking level changes in built context”对应的行为、返回值与边界条件。
	it("tracks model and thinking level changes in built context", () => {
		/** 常量 user 保存“user”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const user = createMessageEntry(createUserMessage("1"));
		/** 常量 modelChange 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const modelChange = createModelChangeEntry("openai", "gpt-4", user.id);
		/** 常量 assistant 保存“assistant”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const assistant = createMessageEntry(createAssistantMessage("a"), modelChange.id);
		/** 常量 thinkingChange 保存“thinkingChange”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const thinkingChange = createThinkingLevelEntry("high", assistant.id);
		/** 常量 loaded 保存“loaded”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const loaded = buildSessionContext([user, modelChange, assistant, thinkingChange]);
		expect(loaded.model).toEqual({ provider: "anthropic", modelId: "claude-sonnet-4-5" });
		expect(loaded.thinkingLevel).toBe("high");
	});

	// 测试场景：验证“prepares compaction using the latest compaction summary as previousSummary”对应的行为、返回值与边界条件。
	it("prepares compaction using the latest compaction summary as previousSummary", () => {
		/** 常量 u1 保存会话树中的当前条目；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const u1 = createMessageEntry(createUserMessage("user msg 1"));
		/** 常量 a1 保存会话树中的当前条目；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const a1 = createMessageEntry(createAssistantMessage("assistant msg 1"), u1.id);
		/** 常量 u2 保存会话树中的当前条目；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const u2 = createMessageEntry(createUserMessage("user msg 2"), a1.id);
		/** 常量 a2 保存会话树中的当前条目；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const a2 = createMessageEntry(createAssistantMessage("assistant msg 2", createMockUsage(5000, 1000)), u2.id);
		/** 常量 compaction1 保存“compaction1”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const compaction1 = createCompactionEntry("First summary", u2.id, a2.id);
		/** 常量 u3 保存会话树中的当前条目；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const u3 = createMessageEntry(createUserMessage("user msg 3"), compaction1.id);
		/** 常量 a3 保存会话树中的当前条目；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const a3 = createMessageEntry(createAssistantMessage("assistant msg 3", createMockUsage(8000, 2000)), u3.id);
		/** 常量 pathEntries 保存测试使用的文件系统路径或文件数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const pathEntries = [u1, a1, u2, a2, compaction1, u3, a3];
		/** 常量 preparation 保存“preparation”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const preparation = getOrThrow(prepareCompaction(pathEntries, DEFAULT_COMPACTION_SETTINGS));
		expect(preparation).toBeDefined();
		expect(preparation?.previousSummary).toBe("First summary");
		expect(preparation?.firstKeptEntryId).toBeTruthy();
		expect(preparation?.retainedTail.length).toBeGreaterThan(0);
		expect(preparation?.tokensBefore).toBe(estimateContextTokens(buildSessionContext(pathEntries).messages).tokens);
	});

	// 测试场景：验证“prepares split-turn compaction with prior file-operation details”对应的行为、返回值与边界条件。
	it("prepares split-turn compaction with prior file-operation details", () => {
		/** 常量 u1 保存会话树中的当前条目；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const u1 = createMessageEntry(createUserMessage("user msg 1"));
		/** 常量 assistantMessage 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const assistantMessage: AssistantMessage = {
			...createAssistantMessage("assistant msg 1"),
			content: [{ type: "toolCall", id: "tool-1", name: "write", arguments: { path: "written.ts" } }],
		};
		/** 常量 a1 保存会话树中的当前条目；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const a1 = createMessageEntry(assistantMessage, u1.id);
		/** 常量 compaction1 保存“compaction1”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const compaction1: CompactionEntry = {
			...createCompactionEntry("First summary", u1.id, a1.id),
			details: { readFiles: ["old-read.ts"], modifiedFiles: ["old-edit.ts"] },
		};
		/** 常量 u2 保存会话树中的当前条目；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const u2 = createMessageEntry(createUserMessage("large turn"), compaction1.id);
		/** 常量 a2 保存会话树中的当前条目；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const a2 = createMessageEntry(createAssistantMessage("large assistant message"), u2.id);
		/** 常量 preparation 保存“preparation”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const preparation = getOrThrow(
			prepareCompaction([u1, a1, compaction1, u2, a2], {
				enabled: true,
				reserveTokens: 100,
				keepRecentTokens: 1,
			}),
		);

		expect(preparation).toMatchObject({ previousSummary: "First summary", isSplitTurn: true });
		expect(preparation?.turnPrefixMessages.map((message) => message.role)).toEqual(["user"]);
		expect([...preparation!.fileOps.read]).toContain("old-read.ts");
		expect([...preparation!.fileOps.edited]).toContain("old-edit.ts");
		expect([...preparation!.fileOps.written]).toContain("written.ts");
	});

	// 测试场景：验证“prepares custom and branch summary entries for summarization”对应的行为、返回值与边界条件。
	it("prepares custom and branch summary entries for summarization", () => {
		/** 常量 branchSummary 保存“branchSummary”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const branchSummary: BranchSummaryEntry = {
			type: "branch_summary",
			id: createId(),
			parentId: null,
			timestamp: new Date().toISOString(),
			fromId: "branch",
			summary: "branch summary",
		};
		/** 常量 customMessage 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const customMessage: CustomMessageEntry = {
			type: "custom_message",
			id: createId(),
			parentId: branchSummary.id,
			timestamp: new Date().toISOString(),
			customType: "note",
			content: "custom content",
			display: true,
		};
		/** 常量 user 保存“user”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const user = createMessageEntry(createUserMessage("keep"), customMessage.id);
		/** 常量 assistant 保存“assistant”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const assistant = createMessageEntry(createAssistantMessage("assistant"), user.id);
		/** 常量 preparation 保存“preparation”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const preparation = getOrThrow(
			prepareCompaction([branchSummary, customMessage, user, assistant], {
				enabled: true,
				reserveTokens: 100,
				keepRecentTokens: 1,
			}),
		);

		expect(preparation?.messagesToSummarize.map((message) => message.role)).toEqual(["branchSummary", "custom"]);
	});

	// 测试场景：验证“does not prepare compaction when there is nothing valid to compact”对应的行为、返回值与边界条件。
	it("does not prepare compaction when there is nothing valid to compact", () => {
		/** 常量 compaction 保存“compaction”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const compaction = createCompactionEntry("already compacted", "entry-keep");
		expect(getOrThrow(prepareCompaction([compaction], DEFAULT_COMPACTION_SETTINGS))).toBeUndefined();
		expect(getOrThrow(prepareCompaction([], DEFAULT_COMPACTION_SETTINGS))).toBeUndefined();
	});

	// 测试场景：验证“serializes conversation with truncated tool results”对应的行为、返回值与边界条件。
	it("serializes conversation with truncated tool results", () => {
		/** 常量 longContent 保存当前场景使用或生成的文本；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const longContent = "x".repeat(5000);
		/** 常量 messages 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const messages = convertMessages([
			{
				role: "toolResult",
				toolCallId: "tc1",
				toolName: "read",
				content: [{ type: "text", text: longContent }],
				isError: false,
				timestamp: Date.now(),
			},
		]);
		/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const result = serializeConversation(messages);
		expect(result).toContain("[Tool result]:");
		expect(result).toContain("[... 3000 more characters truncated]");
	});

	// 测试场景：验证“passes reasoning through generateSummary only for reasoning models with thinking enabled”对应的行为、返回值与边界条件。
	it("passes reasoning through generateSummary only for reasoning models with thinking enabled", async () => {
		/** 常量 messages 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const messages: AgentMessage[] = [createUserMessage("Summarize this.")];
		/** 常量 seenOptions 保存控制当前行为的配置选项；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const seenOptions: Array<Record<string, unknown> | undefined> = [];
		/** 常量 { faux 保存测试使用的模型提供商或伪实现；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const { faux: fauxReasoning, model: reasoningModel } = createFauxModel(true);
		fauxReasoning.setResponses([
			(_context, options) => {
				seenOptions.push(options as Record<string, unknown> | undefined);
				return fauxAssistantMessage("## Goal\nTest summary");
			},
		]);
		getOrThrow(
			await generateSummary(messages, models, reasoningModel, 2000, undefined, undefined, undefined, "medium"),
		);
		expect(seenOptions[0]).toMatchObject({ reasoning: "medium" });

		/** 常量 { faux 保存测试使用的模型提供商或伪实现；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const { faux: fauxOff, model: offModel } = createFauxModel(true);
		fauxOff.setResponses([
			(_context, options) => {
				seenOptions.push(options as Record<string, unknown> | undefined);
				return fauxAssistantMessage("## Goal\nTest summary");
			},
		]);
		getOrThrow(await generateSummary(messages, models, offModel, 2000, undefined, undefined, undefined, "off"));
		expect(seenOptions[1]).not.toHaveProperty("reasoning");

		/** 常量 { faux 保存测试使用的模型提供商或伪实现；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const { faux: fauxNonReasoning, model: nonReasoningModel } = createFauxModel(false);
		fauxNonReasoning.setResponses([
			(_context, options) => {
				seenOptions.push(options as Record<string, unknown> | undefined);
				return fauxAssistantMessage("## Goal\nTest summary");
			},
		]);
		getOrThrow(
			await generateSummary(messages, models, nonReasoningModel, 2000, undefined, undefined, undefined, "medium"),
		);
		expect(seenOptions[2]).not.toHaveProperty("reasoning");
	});

	// 测试场景：验证“includes previous summaries and custom instructions in generateSummary prompts”对应的行为、返回值与边界条件。
	it("includes previous summaries and custom instructions in generateSummary prompts", async () => {
		/** 常量 messages 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const messages: AgentMessage[] = [createUserMessage("Summarize this.")];
		/** 变量 promptText 保存当前场景使用或生成的文本；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		let promptText = "";
		/** 常量 { faux, model } 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const { faux, model } = createFauxModel(false);
		faux.setResponses([
			(context) => {
				/** 常量 message 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
				const message = context.messages[0];
				/** 常量 content 保存当前场景使用或生成的文本；取值由声明类型和当前场景约束，注意隔离可变状态。 */
				const content = message?.role === "user" ? message.content : [];
				promptText = Array.isArray(content) && content[0]?.type === "text" ? content[0].text : "";
				return fauxAssistantMessage("## Goal\nTest summary");
			},
		]);

		/** 常量 summary 保存“summary”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const summary = getOrThrow(
			await generateSummaryWithUsage(messages, models, model, 2000, undefined, "focus", "old summary"),
		);

		expect(summary.text).toContain("Test summary");
		expect(summary.usage.input).toBeGreaterThan(0);
		expect(summary.usage.output).toBeGreaterThan(0);
		expect(summary.usage.totalTokens).toBe(
			summary.usage.input + summary.usage.output + summary.usage.cacheRead + summary.usage.cacheWrite,
		);
		expect(promptText).toContain("<previous-summary>\nold summary\n</previous-summary>");
		expect(promptText).toContain("Additional focus: focus");
	});

	// 测试场景：验证“preserves the string result from generateSummary”对应的行为、返回值与边界条件。
	it("preserves the string result from generateSummary", async () => {
		/** 常量 messages 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const messages: AgentMessage[] = [createUserMessage("Summarize this.")];
		/** 常量 { faux, model } 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const { faux, model } = createFauxModel(false);
		faux.setResponses([fauxAssistantMessage("## Goal\nTest summary")]);

		expect(getOrThrow(await generateSummary(messages, models, model, 2000))).toBe("## Goal\nTest summary");
	});

	// 测试场景：验证“returns error results for failed or aborted summary generations”对应的行为、返回值与边界条件。
	it("returns error results for failed or aborted summary generations", async () => {
		/** 常量 messages 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const messages: AgentMessage[] = [createUserMessage("Summarize this.")];
		/** 常量 { faux 保存测试使用的模型提供商或伪实现；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const { faux: errorFaux, model: errorModel } = createFauxModel(false);
		errorFaux.setResponses([fauxAssistantMessage("", { stopReason: "error", errorMessage: "boom" })]);
		/** 常量 errorResult 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const errorResult = await generateSummary(messages, models, errorModel, 2000);
		expect(errorResult).toMatchObject({
			ok: false,
			error: { code: "summarization_failed", message: "Summarization failed: boom" },
		});

		/** 常量 { faux 保存测试使用的模型提供商或伪实现；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const { faux: abortedFaux, model: abortedModel } = createFauxModel(false);
		abortedFaux.setResponses([fauxAssistantMessage("", { stopReason: "aborted", errorMessage: "stopped" })]);
		/** 常量 abortedResult 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const abortedResult = await generateSummary(messages, models, abortedModel, 2000);
		expect(abortedResult).toMatchObject({ ok: false, error: { code: "aborted", message: "stopped" } });
	});

	// 测试场景：验证“clamps compaction summary maxTokens to the model output cap”对应的行为、返回值与边界条件。
	it("clamps compaction summary maxTokens to the model output cap", async () => {
		/** 常量 messages 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const messages: AgentMessage[] = [createUserMessage("Summarize this.")];
		/** 常量 seenOptions 保存控制当前行为的配置选项；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const seenOptions: Array<Record<string, unknown> | undefined> = [];
		/** 常量 { faux, model } 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const { faux, model } = createFauxModel(false, 128000);
		faux.setResponses([
			(_context, options) => {
				seenOptions.push(options as Record<string, unknown> | undefined);
				return fauxAssistantMessage("## Goal\nTest summary");
			},
			(_context, options) => {
				seenOptions.push(options as Record<string, unknown> | undefined);
				return fauxAssistantMessage("## Goal\nTest summary");
			},
		]);
		/** 常量 preparation 保存“preparation”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const preparation: CompactionPreparation = {
			firstKeptEntryId: "entry-keep",
			messagesToSummarize: messages,
			turnPrefixMessages: messages,
			retainedTail: messages,
			isSplitTurn: true,
			tokensBefore: 600000,
			fileOps: { read: new Set(), written: new Set(), edited: new Set() },
			settings: { enabled: true, reserveTokens: 500000, keepRecentTokens: 20000 },
		};

		getOrThrow(await compact(preparation, models, model));

		expect(seenOptions.map((options) => options?.maxTokens)).toEqual([128000, 128000]);
		expect(seenOptions.map((options) => options?.cacheRetention)).toEqual(["none", "none"]);
		/** 常量 sessionIds 保存“sessionIds”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const sessionIds = seenOptions.map((options) => options?.sessionId);
		expect(sessionIds[0]).not.toBe(sessionIds[1]);
	});

	// 测试场景：验证“returns compaction error results without throwing”对应的行为、返回值与边界条件。
	it("returns compaction error results without throwing", async () => {
		/** 常量 messages 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const messages: AgentMessage[] = [createUserMessage("Summarize this.")];
		/** 常量 preparation 保存“preparation”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const preparation: CompactionPreparation = {
			firstKeptEntryId: "entry-keep",
			messagesToSummarize: messages,
			turnPrefixMessages: [],
			retainedTail: messages,
			isSplitTurn: false,
			tokensBefore: 100,
			fileOps: { read: new Set(), written: new Set(), edited: new Set() },
			settings: { enabled: true, reserveTokens: 2000, keepRecentTokens: 20 },
		};
		/** 常量 { faux 保存测试使用的模型提供商或伪实现；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const { faux: historyFaux, model: historyModel } = createFauxModel(false);
		historyFaux.setResponses([fauxAssistantMessage("", { stopReason: "error", errorMessage: "history failed" })]);
		expect(await compact(preparation, models, historyModel)).toMatchObject({
			ok: false,
			error: { code: "summarization_failed", message: "Summarization failed: history failed" },
		});

		/** 常量 { model 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const { model: invalidModel } = createFauxModel(false);
		/** 常量 invalidResult 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const invalidResult = await compact(
			{ ...preparation, messagesToSummarize: [], firstKeptEntryId: "" },
			models,
			invalidModel,
		);
		expect(invalidResult).toMatchObject({ ok: false, error: { code: "invalid_session" } });
	});

	// 测试场景：验证“combines usage for split-turn compaction summaries”对应的行为、返回值与边界条件。
	it("combines usage for split-turn compaction summaries", async () => {
		/** 常量 messages 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const messages: AgentMessage[] = [createUserMessage("Summarize this.")];
		/** 常量 { model } 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const { model } = createFauxModel(false);
		/** 常量 historyUsage 保存令牌或用量数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const historyUsage = createMockUsage(1, 2, 3, 4);
		/** 常量 turnPrefixUsage 保存令牌或用量数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const turnPrefixUsage = createMockUsage(5, 6, 7, 8);
		/** 常量 usageModels 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const usageModels = createModelsWithSimpleResponses([
			{ ...fauxAssistantMessage("history summary"), usage: historyUsage },
			{ ...fauxAssistantMessage("turn prefix summary"), usage: turnPrefixUsage },
		]);
		/** 常量 preparation 保存“preparation”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const preparation: CompactionPreparation = {
			firstKeptEntryId: "entry-keep",
			messagesToSummarize: messages,
			turnPrefixMessages: messages,
			isSplitTurn: true,
			tokensBefore: 100,
			retainedTail: messages,
			fileOps: { read: new Set(), written: new Set(), edited: new Set() },
			settings: { enabled: true, reserveTokens: 2000, keepRecentTokens: 20 },
		};

		/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const result = getOrThrow(await compact(preparation, usageModels, model));

		expect(result.usage).toEqual(createMockUsage(6, 8, 10, 12));
	});

	// 测试场景：验证“passes reasoning through turn-prefix summaries when enabled”对应的行为、返回值与边界条件。
	it("passes reasoning through turn-prefix summaries when enabled", async () => {
		/** 常量 messages 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const messages: AgentMessage[] = [createUserMessage("Summarize this.")];
		/** 常量 seenOptions 保存控制当前行为的配置选项；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const seenOptions: Array<Record<string, unknown> | undefined> = [];
		/** 常量 { faux, model } 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const { faux, model } = createFauxModel(true);
		faux.setResponses([
			(_context, options) => {
				seenOptions.push(options as Record<string, unknown> | undefined);
				return fauxAssistantMessage("## Original Request\nTest summary");
			},
		]);
		/** 常量 preparation 保存“preparation”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const preparation: CompactionPreparation = {
			firstKeptEntryId: "entry-keep",
			messagesToSummarize: [],
			turnPrefixMessages: messages,
			retainedTail: messages,
			isSplitTurn: true,
			tokensBefore: 100,
			fileOps: { read: new Set(), written: new Set(), edited: new Set() },
			settings: { enabled: true, reserveTokens: 2000, keepRecentTokens: 20 },
		};

		getOrThrow(await compact(preparation, models, model, undefined, undefined, "high"));

		expect(seenOptions[0]).toMatchObject({ reasoning: "high" });
	});

	// 测试场景：验证“returns turn-prefix compaction errors without throwing”对应的行为、返回值与边界条件。
	it("returns turn-prefix compaction errors without throwing", async () => {
		/** 常量 messages 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const messages: AgentMessage[] = [createUserMessage("Summarize this.")];
		/** 常量 preparation 保存“preparation”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const preparation: CompactionPreparation = {
			firstKeptEntryId: "entry-keep",
			messagesToSummarize: [],
			turnPrefixMessages: messages,
			retainedTail: messages,
			isSplitTurn: true,
			tokensBefore: 100,
			fileOps: { read: new Set(), written: new Set(), edited: new Set() },
			settings: { enabled: true, reserveTokens: 2000, keepRecentTokens: 20 },
		};
		/** 常量 { faux, model } 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const { faux, model } = createFauxModel(false);
		faux.setResponses([fauxAssistantMessage("", { stopReason: "error", errorMessage: "prefix failed" })]);

		expect(await compact(preparation, models, model)).toMatchObject({
			ok: false,
			error: { code: "summarization_failed", message: "Turn prefix summarization failed: prefix failed" },
		});

		/** 常量 { faux 保存测试使用的模型提供商或伪实现；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const { faux: abortedFaux, model: abortedModel } = createFauxModel(false);
		abortedFaux.setResponses([fauxAssistantMessage("", { stopReason: "aborted", errorMessage: "prefix stopped" })]);
		expect(await compact(preparation, models, abortedModel)).toMatchObject({
			ok: false,
			error: { code: "aborted", message: "prefix stopped" },
		});
	});

	// 测试场景：验证“returns a compaction result with file details”对应的行为、返回值与边界条件。
	it("returns a compaction result with file details", async () => {
		/** 常量 u1 保存会话树中的当前条目；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const u1 = createMessageEntry(createUserMessage("read a file"));
		/** 常量 assistantMessage 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const assistantMessage: AssistantMessage = {
			...createAssistantMessage("calling tool", createMockUsage(1000, 200)),
			content: [{ type: "toolCall", id: "tool-1", name: "read", arguments: { path: "src/index.ts" } }],
		};
		/** 常量 a1 保存会话树中的当前条目；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const a1 = createMessageEntry(assistantMessage, u1.id);
		/** 常量 u2 保存会话树中的当前条目；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const u2 = createMessageEntry(createUserMessage("continue"), a1.id);
		/** 常量 a2 保存会话树中的当前条目；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const a2 = createMessageEntry(createAssistantMessage("done", createMockUsage(4000, 500)), u2.id);
		/** 常量 preparation 保存“preparation”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const preparation = getOrThrow(prepareCompaction([u1, a1, u2, a2], DEFAULT_COMPACTION_SETTINGS));
		expect(preparation).toBeDefined();
		/** 常量 { faux, model } 保存当前测试使用的模型或模型集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const { faux, model } = createFauxModel(false);
		faux.setResponses([fauxAssistantMessage("## Goal\nTest summary")]);
		/** 常量 result 保存供后续断言检查的结果；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const result = getOrThrow(await compact(preparation!, models, model));
		expect(result.summary.length).toBeGreaterThan(0);
		expect(result.firstKeptEntryId).toBeTruthy();
		expect(result.usage?.totalTokens).toBeGreaterThan(0);
		expect(result.retainedTail?.length).toBeGreaterThan(0);
		expect(result.details).toBeDefined();
	});
});

/** 处理 convertMessages 对应步骤；参数 messages 按签名提供所需输入；返回值供调用方继续执行或断言。示例：convertMessages(...)。 */
function convertMessages(messages: Message[]): Message[] {
	return messages;
}
