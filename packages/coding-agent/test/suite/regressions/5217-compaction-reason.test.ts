/**
 * 文件职责：回归验证压缩扩展事件收到准确的 manual、threshold 或 overflow 原因与重试标记。
 * 技术维度：使用 Vitest、faux 会话夹具、扩展事件监听器和内部自动压缩入口。
 * 产品维度：让扩展根据用户手动压缩、阈值触发或溢出恢复采取正确策略。
 * 逻辑维度：注册记录扩展并准备两轮会话，分别触发三种压缩路径后比较事件序列。
 * 关键边界：自动压缩测试通过专用类型访问内部方法；所有夹具需在 afterEach 中清理。
 * 新手阅读建议：先看 RecordedCompactionEvent 和 recordingExtension，再比较三个用例参数。
 */
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { afterEach, describe, expect, it } from "vitest";
import type { ExtensionFactory } from "../../../src/index.ts";
import { createHarness, type Harness } from "../harness.ts";

/** 描述测试需要访问的内部自动压缩方法。 */
type SessionWithCompactionInternals = {
	// _runAutoCompaction 接收触发原因和是否重试，返回是否完成。
	_runAutoCompaction: (reason: "overflow" | "threshold", willRetry: boolean) => Promise<boolean>;
};

/** 记录扩展收到的压缩事件关键字段。 */
interface RecordedCompactionEvent {
	// type 区分压缩前与压缩完成事件。
	type: "session_before_compact" | "session_compact";
	// reason 是手动、阈值或溢出触发原因。
	reason: "manual" | "threshold" | "overflow";
	// willRetry 表示压缩后是否重试原请求。
	willRetry: boolean;
}

/**
 * 创建把两个压缩事件追加到数组的扩展工厂。
 * 参数：recorded 为事件收集数组。
 * 返回值：ExtensionFactory。
 * 使用示例：`extensionFactories: [recordingExtension(recorded)]`。
 */
function recordingExtension(recorded: RecordedCompactionEvent[]): ExtensionFactory {
	// pi 是扩展 API，用于注册两个压缩事件监听器。
	return (pi) => {
		// event 是压缩准备事件，记录后返回固定扩展摘要。
		pi.on("session_before_compact", async (event) => {
			recorded.push({ type: event.type, reason: event.reason, willRetry: event.willRetry });
			return {
				compaction: {
					summary: "summary from extension",
					firstKeptEntryId: event.preparation.firstKeptEntryId,
					tokensBefore: event.preparation.tokensBefore,
					details: {},
				},
			};
		});
		// event 是压缩完成事件，只记录关键字段。
		pi.on("session_compact", async (event) => {
			recorded.push({ type: event.type, reason: event.reason, willRetry: event.willRetry });
		});
	};
}

/**
 * 创建已有两轮消息且安装记录扩展的压缩夹具。
 * 参数：recorded 为事件收集数组。
 * 返回值：准备完成的 Harness。
 * 使用示例：`await createCompactionHarness(recorded)`。
 */
async function createCompactionHarness(recorded: RecordedCompactionEvent[]): Promise<Harness> {
	// harness 使用很小的保留令牌数，便于触发压缩。
	const harness = await createHarness({
		settings: { compaction: { keepRecentTokens: 1 } },
		extensionFactories: [recordingExtension(recorded)],
	});
	harness.setResponses([fauxAssistantMessage("one"), fauxAssistantMessage("two")]);
	await harness.session.prompt("first");
	await harness.session.prompt("second");
	return harness;
}

describe("issue #5217 compaction reason on extension events", () => {
	// harnesses 保存需在每例后清理的夹具。
	const harnesses: Harness[] = [];

	// 每例后清理全部夹具；无参数，无返回值。
	afterEach(() => {
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
	});

	// 验证公开 compact() 报告 manual 且不重试；无参数，无返回值。
	it("reports manual reason for compact()", async () => {
		// recorded 收集压缩前后两个扩展事件。
		const recorded: RecordedCompactionEvent[] = [];
		// harness 是已准备两轮消息的会话夹具。
		const harness = await createCompactionHarness(recorded);
		harnesses.push(harness);

		await harness.session.compact();

		expect(recorded).toEqual([
			{ type: "session_before_compact", reason: "manual", willRetry: false },
			{ type: "session_compact", reason: "manual", willRetry: false },
		]);
	});

	// 验证自动阈值压缩报告 threshold 且不重试；无参数，无返回值。
	it("reports threshold reason for auto-compaction", async () => {
		// recorded 收集阈值压缩事件。
		const recorded: RecordedCompactionEvent[] = [];
		// harness 是用于触发自动压缩的会话夹具。
		const harness = await createCompactionHarness(recorded);
		harnesses.push(harness);
		// sessionInternals 是访问内部自动压缩方法的测试视图。
		const sessionInternals = harness.session as unknown as SessionWithCompactionInternals;

		await sessionInternals._runAutoCompaction("threshold", false);

		expect(recorded).toEqual([
			{ type: "session_before_compact", reason: "threshold", willRetry: false },
			{ type: "session_compact", reason: "threshold", willRetry: false },
		]);
	});

	// 验证溢出恢复报告 overflow 且 willRetry=true；无参数，无返回值。
	it("reports overflow reason and willRetry for overflow recovery", async () => {
		// recorded 收集溢出压缩事件。
		const recorded: RecordedCompactionEvent[] = [];
		// harness 是用于触发溢出恢复的会话夹具。
		const harness = await createCompactionHarness(recorded);
		harnesses.push(harness);
		// sessionInternals 是访问内部自动压缩方法的测试视图。
		const sessionInternals = harness.session as unknown as SessionWithCompactionInternals;

		await sessionInternals._runAutoCompaction("overflow", true);

		expect(recorded).toEqual([
			{ type: "session_before_compact", reason: "overflow", willRetry: true },
			{ type: "session_compact", reason: "overflow", willRetry: true },
		]);
	});
});
