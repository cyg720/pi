/**
 * 文件职责：验证会话压缩摘要在推理等级、路由会话、缓存和模型输出上限方面的请求配置。
 * 技术维度：使用 Vitest 提升桩替换 pi-ai 的 completeSimple，并以手工模型和消息构造纯单元测试。
 * 产品维度：保障长对话压缩既能利用推理模型，又不会重复缓存摘要请求或超过模型输出限制。
 * 逻辑维度：先准备模型工厂与固定响应，再覆盖推理开关、会话 ID 隔离和完整 compact 流程。
 * 关键边界：测试不调用真实提供商；mockSummaryResponse 的用量会在分段压缩时被累加两次。
 * 新手阅读建议：先看 createModel 和 mockSummaryResponse，再比较 generateSummary 与 compact 传给模型的选项。
 */
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, Model } from "@earendil-works/pi-ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	type CompactionPreparation,
	compact,
	generateSummary,
	generateSummaryWithUsage,
} from "../src/core/compaction/index.ts";

// completeSimpleMock 是替代真实模型摘要请求的提升模拟函数。
const { completeSimpleMock } = vi.hoisted(() => ({
	completeSimpleMock: vi.fn(),
}));

// 保留 compat 模块其他导出，仅把 completeSimple 定向替换为可断言的桩。
vi.mock("@earendil-works/pi-ai/compat", async (importOriginal) => {
	// actual 是原 compat 模块，用于避免过度模拟无关 API。
	const actual = await importOriginal<typeof import("@earendil-works/pi-ai/compat")>();
	return {
		...actual,
		completeSimple: completeSimpleMock,
	};
});

/**
 * 构造用于摘要测试的 Anthropic Messages 模型。
 * @param reasoning 是否声明支持推理能力。
 * @param maxTokens 单次最大输出令牌数，默认 8192。
 * @returns 完整模型元数据；例如 `createModel(true, 128000)`。
 */
function createModel(reasoning: boolean, maxTokens = 8192): Model<"anthropic-messages"> {
	return {
		id: reasoning ? "reasoning-model" : "non-reasoning-model",
		name: reasoning ? "Reasoning Model" : "Non-reasoning Model",
		api: "anthropic-messages",
		provider: "anthropic",
		baseUrl: "https://api.anthropic.com",
		reasoning,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 200000,
		maxTokens,
	};
}

// mockSummaryResponse 是 completeSimple 每次返回的固定助手摘要及用量。
const mockSummaryResponse: AssistantMessage = {
	role: "assistant",
	content: [{ type: "text", text: "## Goal\nTest summary" }],
	api: "anthropic-messages",
	provider: "anthropic",
	model: "claude-sonnet-4-5",
	usage: {
		input: 10,
		output: 10,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 20,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
	},
	stopReason: "stop",
	timestamp: Date.now(),
};

// messages 是所有摘要用例共享的最小用户消息历史。
const messages: AgentMessage[] = [{ role: "user", content: "Summarize this.", timestamp: Date.now() }];

// 验证摘要请求根据模型能力和用户设置生成正确的推理与缓存选项。
describe("generateSummary reasoning options", () => {
	// 每个用例前清空调用历史并恢复固定成功响应。
	beforeEach(() => {
		completeSimpleMock.mockReset();
		completeSimpleMock.mockResolvedValue(mockSummaryResponse);
	});

	// 推理模型且等级非 off 时，应把指定等级传给模型请求。
	it("uses the provided thinking level for reasoning-capable models", async () => {
		// result 同时包含摘要文本和模型报告的令牌用量。
		const result = await generateSummaryWithUsage(
			messages,
			createModel(true),
			2000,
			"test-key",
			undefined,
			undefined,
			undefined,
			undefined,
			"medium",
		);

		expect(result.text).toBe("## Goal\nTest summary");
		expect(result.usage).toEqual(mockSummaryResponse.usage);

		expect(completeSimpleMock).toHaveBeenCalledTimes(1);
		expect(completeSimpleMock.mock.calls[0][2]).toMatchObject({
			reasoning: "medium",
			apiKey: "test-key",
		});
	});

	// 简化接口应只返回助手响应中的摘要字符串。
	it("preserves the string result from generateSummary", async () => {
		await expect(generateSummary(messages, createModel(false), 2000, "test-key")).resolves.toBe(
			"## Goal\nTest summary",
		);
	});

	// 每次摘要都应使用新路由会话且明确关闭提示缓存。
	it("uses fresh routing sessions without prompt caching", async () => {
		await generateSummary(messages, createModel(false), 2000, "test-key");
		await generateSummary(messages, createModel(false), 2000, "test-key");

		// requestOptions 提取两次模型请求的第三个参数，便于比较路由选项。
		const requestOptions = completeSimpleMock.mock.calls.map((call) => call[2]);
		expect(requestOptions).toHaveLength(2);
		expect(requestOptions.every((options) => options?.cacheRetention === "none")).toBe(true);

		// sessionIds 保存两次请求的会话标识，二者必须不同。
		const sessionIds = requestOptions.map((options) => options?.sessionId);
		expect(sessionIds[0]).not.toBe(sessionIds[1]);
	});

	// 用户关闭 thinking 时，即使模型支持也不能发送 reasoning 字段。
	it("does not set reasoning when thinking is off", async () => {
		await generateSummary(
			messages,
			createModel(true),
			2000,
			"test-key",
			undefined,
			undefined,
			undefined,
			undefined,
			"off",
		);

		expect(completeSimpleMock).toHaveBeenCalledTimes(1);
		expect(completeSimpleMock.mock.calls[0][2]).toMatchObject({
			apiKey: "test-key",
		});
		expect(completeSimpleMock.mock.calls[0][2]).not.toHaveProperty("reasoning");
	});

	// 不支持推理的模型应忽略用户给出的 thinking 等级。
	it("does not set reasoning for non-reasoning models", async () => {
		await generateSummary(
			messages,
			createModel(false),
			2000,
			"test-key",
			undefined,
			undefined,
			undefined,
			undefined,
			"medium",
		);

		expect(completeSimpleMock).toHaveBeenCalledTimes(1);
		expect(completeSimpleMock.mock.calls[0][2]).toMatchObject({
			apiKey: "test-key",
		});
		expect(completeSimpleMock.mock.calls[0][2]).not.toHaveProperty("reasoning");
	});

	// 压缩估算需要更多输出时，两个摘要请求都不得超过模型最大输出量。
	it("clamps compaction summary maxTokens to the model output cap", async () => {
		// preparation 描述一次跨轮次分割的长会话压缩输入和令牌设置。
		const preparation: CompactionPreparation = {
			firstKeptEntryId: "entry-keep",
			messagesToSummarize: messages,
			turnPrefixMessages: messages,
			isSplitTurn: true,
			tokensBefore: 600000,
			fileOps: { read: new Set(), written: new Set(), edited: new Set() },
			settings: { enabled: true, reserveTokens: 500000, keepRecentTokens: 20000 },
		};

		// result 是合并两个摘要调用后得到的压缩结果和累计用量。
		const result = await compact(preparation, createModel(false, 128000), "test-key");

		expect(result.usage).toEqual({
			...mockSummaryResponse.usage,
			input: 20,
			output: 20,
			totalTokens: 40,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		});
		expect(completeSimpleMock.mock.calls.map((call) => call[2]?.maxTokens)).toEqual([128000, 128000]);
	});
});
