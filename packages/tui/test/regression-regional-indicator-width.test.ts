/**
 * 文件职责：回归验证地区指示符、旗帜和常见流式 Emoji 的终端宽度稳定为两列。
 * 技术维度：使用 Node 测试、Unicode 码点遍历、可见宽度和 ANSI 折行函数。
 * 产品维度：避免流式输出 Emoji 中间态导致差分渲染漂移和残留字符。
 * 逻辑维度：覆盖半个旗帜、窄宽折行、全部地区指示符、完整旗帜和常见 Emoji。
 * 关键边界：断言依据目标终端的双列显示约定；Unicode/终端实现变化时需复核。
 * 新手阅读建议：先理解“🇨”是完整旗帜的中间态，再看宽度如何影响折行。
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { visibleWidth, wrapTextWithAnsi } from "../src/utils.ts";

/** 地区指示符宽度回归测试组。 */
describe("regional indicator width regression", () => {
	/** 验证单个地区指示符按两列计算。 */
	it("treats partial flag grapheme as full-width to avoid streaming render drift", () => {
		// Repro context:
		// 复现背景：
		// During streaming, "🇨🇳" often appears as an intermediate "🇨" first.
		// 流式输出完整旗帜前，常先出现单个“🇨”。
		// If "🇨" is measured as width 1 while terminal renders it as width 2,
		// 若程序按一列而终端按两列显示，
		// differential rendering can drift and leave stale characters on screen.
		// 差分渲染坐标会漂移并留下旧字符。
		/** 单个地区指示符中间态。 */
		const partialFlag = "🇨";
		/** 列表缩进加中间态旗帜的完整行。 */
		const listLine = "      - 🇨";

		assert.strictEqual(visibleWidth(partialFlag), 2);
		assert.strictEqual(visibleWidth(listLine), 10);
	});

	/** 验证 9 列容不下总宽 10 的列表行时正确折成两行。 */
	it("wraps intermediate partial-flag list line before overflow", () => {
		// Width 9 cannot fit "      - 🇨" if 🇨 is width 2 (8 + 2 = 10).
		// 若旗帜占两列，总宽 10 的文本不能放进 9 列。
		// This must wrap to avoid terminal auto-wrap mismatch.
		// 必须主动折行，避免与终端自动换行不一致。
		/** 9 列下折行得到的两行文本。 */
		const wrapped = wrapTextWithAnsi("      - 🇨", 9);

		assert.strictEqual(wrapped.length, 2);
		assert.strictEqual(visibleWidth(wrapped[0] || ""), 7);
		assert.strictEqual(visibleWidth(wrapped[1] || ""), 2);
	});

	/** 遍历 U+1F1E6 至 U+1F1FF，验证全部单个地区指示符宽度。 */
	it("treats all regional-indicator singleton graphemes as width 2", () => {
		// cp 是当前 Unicode 码点，范围覆盖 A 到 Z 的地区指示符。
		for (let cp = 0x1f1e6; cp <= 0x1f1ff; cp++) {
			/** 当前码点生成的单个地区指示符。 */
			const regionalIndicator = String.fromCodePoint(cp);
			assert.strictEqual(
				visibleWidth(regionalIndicator),
				2,
				`Expected ${regionalIndicator} (U+${cp.toString(16).toUpperCase()}) to be width 2`,
			);
		}
	});

	/** 验证常见完整国旗组合仍只占两列，而不是四列。 */
	it("keeps full flag pairs at width 2", () => {
		/** 六个完整旗帜样本。 */
		const samples = ["🇯🇵", "🇺🇸", "🇬🇧", "🇨🇳", "🇩🇪", "🇫🇷"];
		// flag 是一个完整旗帜字素。
		for (const flag of samples) {
			assert.strictEqual(visibleWidth(flag), 2, `Expected ${flag} to be width 2`);
		}
	});

	/** 验证常见 Emoji 及肤色、变体选择器和 ZWJ 中间态宽度稳定。 */
	it("keeps common streaming emoji intermediates at stable width", () => {
		/** 流式输出可能出现的常见 Emoji 样本。 */
		const samples = ["👍", "👍🏻", "✅", "⚡", "⚡️", "👨", "👨‍💻", "🏳️‍🌈"];
		// sample 是当前 Emoji 或组合序列。
		for (const sample of samples) {
			assert.strictEqual(visibleWidth(sample), 2, `Expected ${sample} to be width 2`);
		}
	});
});
