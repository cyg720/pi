/**
 * 文件职责：验证主内容短于终端高度时，居中覆盖层仍能正常显示。
 * 技术维度：使用 Node 测试、VirtualTerminal 和两个最小 Component 实现。
 * 产品维度：防止短会话中对话框、选择器等覆盖层因布局高度计算错误而消失。
 * 逻辑维度：创建 80×24 终端和三行内容，显示三行覆盖层，渲染后搜索 OVERLAY 文本。
 * 关键边界：测试依赖固定尺寸并输出调试信息；结束时必须 stop TUI。
 * 新手阅读建议：先看 SimpleContent 与 SimpleOverlay，再跟踪 showOverlay 到 viewport 断言。
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { type Component, TUI } from "../src/tui.ts";
import { VirtualTerminal } from "./virtual-terminal.ts";

/** 返回构造时指定行的最小主内容组件。 */
class SimpleContent implements Component {
	/** 固定内容行。 */
	private lines: string[];

	/** @param lines 每次渲染原样返回的行。 */
	constructor(lines: string[]) {
		this.lines = lines;
	}

	/** @returns 固定内容行。 */
	render(): string[] {
		return this.lines;
	}
	/** 当前组件无缓存，无需失效处理。 */
	invalidate() {}
}

/** 固定渲染三行标识文本的覆盖层组件。 */
class SimpleOverlay implements Component {
	/** @returns 覆盖层顶部、中部、底部三行。 */
	render(): string[] {
		return ["OVERLAY_TOP", "OVERLAY_MID", "OVERLAY_BOT"];
	}
	/** 当前组件无缓存，无需失效处理。 */
	invalidate() {}
}

/** 短内容场景覆盖层测试组。 */
describe("TUI overlay with short content", () => {
	/** 验证三行主内容不会阻止覆盖层在 24 行终端中显示。 */
	it("should render overlay when content is shorter than terminal height", async () => {
		// Terminal has 24 rows, but content only has 3 lines
		// 终端有 24 行，但主内容仅 3 行。
		/** 80×24 的虚拟终端。 */
		const terminal = new VirtualTerminal(80, 24);
		/** 绑定虚拟终端的 TUI。 */
		const tui = new TUI(terminal);

		// Only 3 lines of content
		// 只添加三行主内容。
		tui.addChild(new SimpleContent(["Line 1", "Line 2", "Line 3"]));

		// Show overlay centered - should be around row 10 in a 24-row terminal
		// 居中显示覆盖层，在 24 行终端中应接近第 10 行。
		/** 固定三行的覆盖层组件。 */
		const overlay = new SimpleOverlay();
		tui.showOverlay(overlay);

		// Trigger render
		// 启动并等待一次渲染。
		tui.start();
		await terminal.waitForRender();

		/** 渲染后的完整虚拟终端视口。 */
		const viewport = terminal.getViewport();
		/** 是否至少有一行含覆盖层标识。 */
		const hasOverlay = viewport.some((line) => line.includes("OVERLAY"));

		console.log("Terminal rows:", terminal.rows);
		console.log("Content lines: 3");
		console.log("Overlay visible:", hasOverlay);

		if (!hasOverlay) {
			console.log("\nViewport contents:");
			// i 是调试输出的视口行下标。
			for (let i = 0; i < viewport.length; i++) {
				console.log(`  [${i}]: "${viewport[i]}"`);
			}
		}

		assert.ok(hasOverlay, "Overlay should be visible when content is shorter than terminal");

		tui.stop();
	});
});
