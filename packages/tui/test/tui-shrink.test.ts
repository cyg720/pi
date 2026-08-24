/**
 * 文件职责：验证 TUI 内容从多行缩减为零时会清除终端中先前渲染的全部行。
 * 技术维度：使用 Node 测试运行器、VirtualTerminal 和最小 Component 实现异步渲染测试。
 * 产品维度：防止内容消失后旧文字残留在终端，造成用户误读。
 * 逻辑维度：先渲染三行并确认可见，清空子组件后重绘，再确认三行均消失。
 * 关键边界：虚拟终端固定为 40×10；测试结束必须停止 TUI 渲染循环。
 * 新手阅读建议：先看 Lines 如何提供固定内容，再比较 clear 前后 viewport 的变化。
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { type Component, TUI } from "../src/tui.ts";
import { VirtualTerminal } from "./virtual-terminal.ts";

/** 固定返回给定字符串数组的测试组件，用于精确控制内容高度。 */
class Lines implements Component {
	/** 每次渲染原样返回的行数组。 */
	private lines: string[];

	/** @param lines 固定渲染行；调用方应避免随后修改该数组。 */
	constructor(lines: string[]) {
		this.lines = lines;
	}

	/** @returns 当前固定行数组。 */
	render(): string[] {
		return this.lines;
	}

	/** 当前组件无缓存，因此失效通知无需操作。 */
	invalidate(): void {}
}

/** TUI 内容缩减清屏测试组。 */
describe("TUI shrinking content", () => {
	/** 验证从三行变为零行后虚拟终端不再含旧文本。 */
	it("clears all rendered lines when content shrinks to zero", async () => {
		/** 40 列、10 行的虚拟终端。 */
		const terminal = new VirtualTerminal(40, 10);
		/** 绑定虚拟终端的被测 TUI。 */
		const tui = new TUI(terminal);
		/** 初始渲染三行文字的测试组件。 */
		const content = new Lines(["first", "second", "third"]);
		tui.addChild(content);
		tui.start();
		await terminal.waitForRender();

		// line 是初次渲染视口的一行，以下断言确认三条初始内容均可见。
		assert.ok(terminal.getViewport().some((line) => line.includes("first")));
		assert.ok(terminal.getViewport().some((line) => line.includes("second")));
		assert.ok(terminal.getViewport().some((line) => line.includes("third")));

		tui.clear();
		tui.requestRender();
		await terminal.waitForRender();

		/** 清空并重绘后的完整视口。 */
		const viewport = terminal.getViewport();
		// line 是清空后视口的一行，不能再包含任何旧内容。
		assert.ok(!viewport.some((line) => line.includes("first")), "first line should be cleared");
		assert.ok(!viewport.some((line) => line.includes("second")), "second line should be cleared");
		assert.ok(!viewport.some((line) => line.includes("third")), "third line should be cleared");

		tui.stop();
	});
});
