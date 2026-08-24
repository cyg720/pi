/**
 * 文件职责：验证制表符在宽度计算、覆盖层分段、控制序列和终端合成中的一致行为。
 * 技术维度：使用 Node 测试运行器、VirtualTerminal、ANSI 文本辅助函数和自定义 Component。
 * 产品维度：避免含 Tab 的命令输出或状态覆盖层错位、换行，或破坏终端控制序列字节。
 * 逻辑维度：先测试纯宽度辅助函数，再检查控制序列，最后在虚拟终端渲染覆盖层。
 * 关键边界：Tab 按当前列位置展开而非固定替换；控制序列内部的 Tab 必须保持原字节。
 * 新手阅读建议：先理解 slice 与 segments 返回的宽度，再看最后一例的三行期望视口。
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { type Component, TUI } from "../src/tui.ts";
import { extractSegments, normalizeTerminalOutput, sliceWithWidth, visibleWidth } from "../src/utils.ts";
import { VirtualTerminal } from "./virtual-terminal.ts";

/** 渲染恰好填满视口宽度的三行基础内容。 */
class FullViewportContent implements Component {
	/** 按给定宽度补齐三行；width 为目标列数，返回渲染行数组。 */
	render(width: number): string[] {
		// line 是当前基础文本，回调将其补齐到视口宽度。
		return ["base 0", "base 1", "base 2"].map((line) => line.padEnd(width));
	}

	/** 满足 Component 接口的空失效方法；无参数，无返回值。 */
	invalidate(): void {}
}

/** 扩展虚拟终端并记录所有原始写入数据，便于检查 Tab 是否泄漏。 */
class CapturingVirtualTerminal extends VirtualTerminal {
	// output 累积写入终端的原始控制序列和文本。
	private output = "";

	/** 记录并继续执行虚拟终端写入；data 为原始输出，无返回值。 */
	override write(data: string): void {
		this.output += data;
		super.write(data);
	}

	/** 返回累计原始输出；无参数，返回字符串。 */
	getOutput(): string {
		return this.output;
	}
}

/** 渲染包含一个 Tab 的单行状态覆盖层。 */
class TabStatusOverlay implements Component {
	/** 返回固定的 Tab 加 X 文本；无参数，返回单行数组。 */
	render(): string[] {
		return ["\tX"];
	}

	/** 满足 Component 接口的空失效方法；无参数，无返回值。 */
	invalidate(): void {}
}

describe("tab width accounting", () => {
	// 验证切片报告宽度与切片文本的可见宽度一致；无参数，无返回值。
	it("keeps slice helper widths consistent with visible width", () => {
		// text 是包含 Tab 的命令输出示例。
		const text = "out 192M\t.pi/skill-tests/results-ha";
		// slice 是从起点截取最多 10 列的结果。
		const slice = sliceWithWidth(text, 0, 10, true);

		assert.strictEqual(slice.text, "out 192M");
		assert.strictEqual(slice.width, 8);
		assert.strictEqual(visibleWidth(slice.text), slice.width);
	});

	// 验证覆盖层分段前缀宽度与可见宽度一致；无参数，无返回值。
	it("keeps overlay segment widths consistent with visible width", () => {
		// text 是包含 Tab 的命令输出示例。
		const text = "out 192M\t.pi/skill-tests/results-ha";
		// segments 是覆盖区域从第 10 列开始时的文本分段。
		const segments = extractSegments(text, 10, 13, 10, true);

		assert.strictEqual(segments.before, "out 192M");
		assert.strictEqual(segments.beforeWidth, 8);
		assert.strictEqual(visibleWidth(segments.before), segments.beforeWidth);

		// tabFits 是覆盖区域后移一列、允许 Tab 完整进入前缀的分段结果。
		const tabFits = extractSegments(text, 11, 13, 10, true);
		assert.strictEqual(tabFits.before, "out 192M\t");
		assert.strictEqual(tabFits.beforeWidth, 11);
		assert.strictEqual(visibleWidth(tabFits.before), tabFits.beforeWidth);
	});

	// 验证控制序列内部 Tab 保持不变，仅普通文本 Tab 被空格化；无参数，无返回值。
	it("keeps tabs inside terminal control sequences byte-identical", () => {
		// controlSequences 覆盖 OSC、字符串终止和私有控制序列中的 Tab。
		const controlSequences = [
			"\x1b]8;;https://example.test/a\tb\x07",
			"\x1b]0;window\ttitle\x1b\\",
			"\x1b_payload\tdata\x1b\\",
		];

		// controlSequence 是当前必须逐字保留的终端控制序列。
		for (const controlSequence of controlSequences) {
			assert.strictEqual(normalizeTerminalOutput(`${controlSequence}label\ttext`), `${controlSequence}label   text`);
		}
	});

	// 验证含 Tab 的覆盖层最终只占一个物理终端行；无参数，无返回值。
	it("keeps tab-containing overlays on one physical terminal row", async () => {
		// terminal 是 16×3 且记录原始写入的虚拟终端。
		const terminal = new CapturingVirtualTerminal(16, 3);
		// tui 合成满视口基础内容和四列宽覆盖层。
		const tui = new TUI(terminal);
		tui.addChild(new FullViewportContent());
		tui.showOverlay(new TabStatusOverlay(), { width: 4, row: 1, col: 4 });
		tui.start();

		try {
			await terminal.waitForRender();
			assert.deepStrictEqual(terminal.getViewport(), ["base 0          ", "base   X        ", "base 2          "]);
			assert.ok(!terminal.getOutput().includes("\t"));
		} finally {
			tui.stop();
		}
	});
});
