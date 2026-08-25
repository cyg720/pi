/**
 * Test that BashExecutionComponent's collapsed output respects the render-time width,
 * not a stale captured width. Regression test for #2569.
 */
/**
 * 文件职责：回归验证 Bash 执行组件的折叠输出使用每次渲染传入的最新宽度。
 * 技术维度：使用 Vitest、最小 TUI 桩、终端可见宽度计算和 BashExecutionComponent。
 * 产品维度：避免终端缩放或分栏后命令输出越界，保证折叠预览适配当前可视区域。
 * 逻辑维度：以宽终端构造组件并追加长行，完成命令后用较窄宽度渲染和逐行断言。
 * 关键边界：TUI 桩仅实现组件加载器需要的成员；使用 any 是为了匹配复杂界面接口。
 * 新手阅读建议：先看 createTuiStub 如何动态提供 columns，再比较单次窄渲染和连续变宽两例。
 */
import { visibleWidth } from "@earendil-works/pi-tui";
import { beforeAll, describe, expect, it } from "vitest";
import { BashExecutionComponent } from "../src/modes/interactive/components/bash-execution.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";

/** Minimal TUI stub that only exposes terminal.columns */
/** 只暴露终端列数和组件计时器所需接口的最小 TUI 测试桩。 */
/**
 * 创建指定列数的 TUI 桩。
 * 参数：columns 为终端列数。
 * 返回值：初始 columns 和可传给组件的 stub。
 * 使用示例：`createTuiStub(200)`。
 */
function createTuiStub(columns: number): { columns: number; stub: any } {
	// state 保存 getter 动态读取的终端列数。
	const state = { columns };
	// stub 模拟 BashExecutionComponent 访问的终端和界面方法。
	const stub = {
		terminal: {
			/** 无参数；返回当前可变终端列数；示例：`stub.terminal.columns`。 */
			get columns() {
				return state.columns;
			},
			/** 无参数；返回固定终端行数 24；示例：`stub.terminal.rows`。 */
			get rows() {
				return 24;
			},
		},
		// Loader calls ui.addInterval / ui.removeInterval
		// _cb 和 _ms 是本测试无需执行的计时器参数，返回可释放占位句柄。
		addInterval: (_cb: () => void, _ms: number) => ({ dispose: () => {} }),
		removeInterval: () => {},
		requestRender: () => {},
	};
	return { columns: state.columns, stub };
}

describe("BashExecutionComponent width handling (#2569)", () => {
	// 测试组开始前初始化无颜色主题；无参数，无返回值。
	beforeAll(() => {
		initTheme(undefined, false);
	});

	// 验证构造时宽度不会覆盖渲染时传入的窄宽度；无参数，无返回值。
	it("collapsed preview lines respect render-time width, not construction-time width", () => {
		// wideWidth 是组件构造时模拟的宽终端列数。
		const wideWidth = 200;
		// narrowWidth 是折叠预览真正渲染时的目标列数。
		const narrowWidth = 80;

		// stub 是宽终端 TUI 桩。
		const { stub } = createTuiStub(wideWidth);
		// component 是待检查的 Bash 执行展示组件。
		const component = new BashExecutionComponent("pwd", stub);

		// Add output with long lines that will wrap differently at different widths
		// 添加会在不同宽度下产生不同换行的长输出。
		// longLine 是 150 个字符的单行测试输出。
		const longLine = "x".repeat(150);
		component.appendOutput(`${longLine}\n${longLine}\n`);

		// Complete the command so it enters collapsed mode
		// 把命令标记为完成，使组件进入折叠模式。
		component.setComplete(0, false);

		// Render at the narrow width (simulating a resize or split pane)
		// 用窄宽度渲染，模拟窗口缩放或分栏。
		// lines 是折叠状态下生成的所有渲染行。
		const lines = component.render(narrowWidth);

		// Every rendered line must fit within the narrow width
		// 每一行都必须适配窄终端宽度。
		// i 是当前渲染行索引。
		for (let i = 0; i < lines.length; i++) {
			// w 是忽略 ANSI 控制码后的当前行可见宽度。
			const w = visibleWidth(lines[i]);
			expect(w, `Line ${i} visibleWidth=${w} > ${narrowWidth}`).toBeLessThanOrEqual(narrowWidth);
		}
	});

	// 验证同一组件在连续两次不同宽度渲染时重新计算换行；无参数，无返回值。
	it("re-computes lines when width changes between renders", () => {
		// stub 是 200 列终端的最小 TUI 桩。
		const { stub } = createTuiStub(200);
		// component 是用于连续两次渲染的 Bash 执行组件。
		const component = new BashExecutionComponent("echo hello", stub);

		// longLine 是恰好 200 字符的测试输出。
		const longLine = "abcdefghij".repeat(20); // 200 chars
		component.appendOutput(`${longLine}\n`);
		component.setComplete(0, false);

		// First render at width 200
		// 首次以 200 列宽度渲染。
		// lines200 是宽终端下的渲染行。
		const lines200 = component.render(200);
		// line 是当前宽终端渲染行。
		for (const line of lines200) {
			expect(visibleWidth(line)).toBeLessThanOrEqual(200);
		}

		// Second render at width 60 (split pane scenario)
		// 第二次以 60 列宽度渲染，模拟分栏。
		// lines60 是重新换行后的窄终端渲染行。
		const lines60 = component.render(60);
		// i 是当前窄终端渲染行索引。
		for (let i = 0; i < lines60.length; i++) {
			// w 是当前窄终端行的可见宽度。
			const w = visibleWidth(lines60[i]);
			expect(w, `Line ${i} visibleWidth=${w} > 60`).toBeLessThanOrEqual(60);
		}
	});
});
