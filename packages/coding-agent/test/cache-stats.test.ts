/**
 * 文件职责：验证会话缓存未命中统计的令牌、成本、空闲时间、模型切换和压缩重置规则。
 * 技术维度：使用 Vitest、AssistantMessage/SessionEntry 工厂和模型缓存读取单价替身执行纯计算测试。
 * 产品维度：帮助用户量化提示缓存浪费并定位因空闲、模型切换或完整重写造成的额外费用。
 * 逻辑维度：建立两轮基线，分别测试累计统计、消息映射和单次即时未命中检测。
 * 关键边界：无缓存活动供应商和压缩后首轮需跳过；成本以写入价减缓存读取价估算。
 * 新手阅读建议：先理解 turn1/turn2 的健康缓存过程，再看 turn3 如何产生 105k 未命中。
 */
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import {
	collectCacheMisses,
	computeCacheWaste,
	detectCacheMiss,
	type ModelPriceSource,
} from "../src/core/cache-stats.ts";
import type { SessionEntry } from "../src/core/session-manager.ts";

// 零成本模板，便于单个测试只覆盖关心的费用字段。
const zeroCost = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 };

// 模型价格来源替身；完整未命中时以每百万 0.3 美元作为缓存读取价。
const models: ModelPriceSource = {
	// $/million tokens; used as cache-read price fallback on full-miss turns
	// 中文说明：单位为每百万令牌美元，用于完整未命中时估算本可使用的缓存读取成本。
	getModel: () => ({ cost: { cacheRead: 0.3 } }),
};

/** 功能：创建缓存统计测试助手消息；参数 options；返回：AssistantMessage。示例：assistant({ cacheWrite: 100_000 })。 */
function assistant(options: {
	input?: number;
	cacheRead?: number;
	cacheWrite?: number;
	cost?: Partial<typeof zeroCost>;
	model?: string;
	timestamp?: number;
}): AssistantMessage {
	return {
		role: "assistant",
		content: [],
		api: "anthropic-messages",
		provider: "test",
		model: options.model ?? "test-model",
		usage: {
			input: options.input ?? 0,
			output: 10,
			cacheRead: options.cacheRead ?? 0,
			cacheWrite: options.cacheWrite ?? 0,
			totalTokens: 0,
			cost: { ...zeroCost, ...options.cost },
		},
		stopReason: "stop",
		timestamp: options.timestamp ?? 0,
	} as AssistantMessage;
}

/** 功能：把助手消息包装成会话条目；参数 message；返回：SessionEntry。示例：entry(turn1)。 */
function entry(message: AssistantMessage): SessionEntry {
	return { type: "message", id: "x", parentId: null, timestamp: "", message } as SessionEntry;
}

// Turn 1: fresh 100k cache write at $3.75/M
// 中文说明：第 1 轮新写入 10 万缓存令牌，费用按每百万 3.75 美元计。
// 健康缓存基线的首次写入消息。
const turn1 = assistant({ cacheWrite: 100_000, cost: { cacheWrite: 0.375 }, timestamp: 0 });
// Turn 2: healthy, everything read back at $0.30/M
// 中文说明：第 2 轮读回全部缓存并新增少量缓存，读取价为每百万 0.30 美元。
// 健康缓存基线的第二轮消息。
const turn2 = assistant({
	cacheRead: 100_000,
	cacheWrite: 5_000,
	cost: { cacheRead: 0.03, cacheWrite: 0.019 },
	timestamp: 60_000,
});

describe("computeCacheWaste", () => {
	it("accumulates missed tokens and cost across turns", () => {
		// Turn 3: full miss, previous 105k prompt re-billed at $3.75/M write
		// 中文说明：第 3 轮完整未命中，前一轮 105k 提示按缓存写入价重新计费。
		// 产生完整未命中的第三轮消息。
		const turn3 = assistant({ cacheWrite: 110_000, cost: { cacheWrite: 0.4125 }, timestamp: 120_000 });
		// 三轮会话累计缓存浪费统计。
		const totals = computeCacheWaste([entry(turn1), entry(turn2), entry(turn3)], models);
		expect(totals.missedTokens).toBe(105_000);
		// 105k at ($3.75 - $0.30)/M
		// 中文说明：浪费成本为 105k ×（写入价 3.75 - 读取价 0.30）/ 百万。
		expect(totals.missedCost).toBeCloseTo(0.36225, 5);
	});

	it("counts nothing for healthy sessions", () => {
		// 健康两轮会话的累计统计，应为零浪费。
		const totals = computeCacheWaste([entry(turn1), entry(turn2)], models);
		expect(totals.missedTokens).toBe(0);
		expect(totals.missedCost).toBe(0);
	});

	it("skips the turn after a compaction reset", () => {
		// 模拟上下文压缩边界的会话条目。
		const reset = { type: "compaction", id: "c", parentId: null, timestamp: "" } as SessionEntry;
		// 压缩后第一条重新写入缓存的消息。
		const afterReset = assistant({ cacheWrite: 20_000, cost: { cacheWrite: 0.075 } });
		// 含压缩边界的累计统计。
		const totals = computeCacheWaste([entry(turn1), reset, entry(afterReset)], models);
		expect(totals.missedTokens).toBe(0);
	});

	it("counts misses caused by model switches", () => {
		// 切换为 other-model 后完整写入的消息。
		const otherModel = assistant({ cacheWrite: 100_000, cost: { cacheWrite: 0.375 }, model: "other-model" });
		// 模型切换场景的累计统计。
		const totals = computeCacheWaste([entry(turn1), entry(otherModel)], models);
		expect(totals.missedTokens).toBe(100_000);
		expect(totals.missCount).toBe(1);
	});

	it("skips providers that report no cache activity", () => {
		// 只报告 input、没有任何缓存字段的第一轮。
		const a = assistant({ input: 100_000 });
		// 只报告 input、没有任何缓存字段的第二轮。
		const b = assistant({ input: 110_000 });
		// 无缓存活动场景的累计统计。
		const totals = computeCacheWaste([entry(a), entry(b)], models);
		expect(totals.missedTokens).toBe(0);
	});
});

describe("collectCacheMisses", () => {
	it("maps counted misses to their assistant messages by reference", () => {
		// 与 turn2 相比产生完整未命中的目标消息。
		const missTurn = assistant({ cacheWrite: 110_000, cost: { cacheWrite: 0.4125 }, timestamp: 120_000 });
		// 以消息对象为键的未命中映射。
		const misses = collectCacheMisses([entry(turn1), entry(turn2), entry(missTurn)], models);
		expect(misses.size).toBe(1);
		expect(misses.get(missTurn)?.missedTokens).toBe(105_000);
	});
});

describe("detectCacheMiss", () => {
	it("detects a miss on a just-completed message with idle time", () => {
		// 在上一请求 540 秒后发生完整未命中的新消息。
		const missMessage = assistant({ cacheWrite: 110_000, cost: { cacheWrite: 0.4125 }, timestamp: 600_000 });
		// 针对刚完成消息计算的单次未命中详情。
		const miss = detectCacheMiss([entry(turn1), entry(turn2)], missMessage, models);
		expect(miss).toBeDefined();
		expect(miss?.missedTokens).toBe(105_000);
		expect(miss?.missedCost).toBeCloseTo(0.36225, 5);
		// 600s - 60s since the previous request
		// 中文说明：新消息 600 秒减去上一请求 60 秒，空闲时间为 540 秒。
		expect(miss?.idleMs).toBe(540_000);
		expect(miss?.modelChanged).toBe(false);
	});

	it("flags model switches on detected misses", () => {
		// 切换模型后发生完整未命中的消息。
		const otherModel = assistant({
			cacheWrite: 110_000,
			cost: { cacheWrite: 0.4125 },
			model: "other-model",
			timestamp: 120_000,
		});
		// 带 modelChanged 标记的未命中详情。
		const miss = detectCacheMiss([entry(turn1), entry(turn2)], otherModel, models);
		expect(miss?.missedTokens).toBe(105_000);
		expect(miss?.modelChanged).toBe(true);
	});

	it("returns undefined for healthy turns", () => {
		// 完整读取 105k 缓存并只新增 2k 的健康消息。
		const healthy = assistant({
			cacheRead: 105_000,
			cacheWrite: 2_000,
			cost: { cacheRead: 0.0315, cacheWrite: 0.0075 },
			timestamp: 120_000,
		});
		expect(detectCacheMiss([entry(turn1), entry(turn2)], healthy, models)).toBeUndefined();
	});

	it("returns undefined for the first turn of a session", () => {
		expect(detectCacheMiss([], turn1, models)).toBeUndefined();
	});
});
