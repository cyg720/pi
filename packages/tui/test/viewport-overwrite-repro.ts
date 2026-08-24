/**
 * TUI viewport overwrite repro
 *
 * Place this file at: packages/tui/test/viewport-overwrite-repro.ts
 * Run from repo root: npx tsx packages/tui/test/viewport-overwrite-repro.ts
 *
 * For reliable repro, run in a small terminal (8-12 rows) or a tmux session:
 *   tmux new-session -d -s tui-bug -x 80 -y 12
 *   tmux send-keys -t tui-bug "npx tsx packages/tui/test/viewport-overwrite-repro.ts" Enter
 *   tmux attach -t tui-bug
 *
 * Expected behavior:
 * - PRE-TOOL lines remain visible above tool output.
 * - POST-TOOL lines append after tool output without overwriting earlier content.
 *
 * Actual behavior (bug):
 * - When content exceeds the viewport and new lines arrive after a tool-call pause,
 *   some earlier PRE-TOOL lines near the bottom are overwritten by POST-TOOL lines.
 */
/**
 * 文件职责：在小终端中手工复现视口溢出后新增内容覆盖旧行的 TUI 缺陷。
 * 技术维度：使用 ProcessTerminal、TUI、自定义行组件和定时分段追加模拟流式输出。
 * 产品维度：帮助开发者观察长对话中工具调用前后文本是否稳定保留在滚动区。
 * 逻辑维度：先输出超视口文本，再模拟工具暂停和长输出，最后追加工具后文本观察覆盖。
 * 关键边界：这是交互调试脚本；需 8–12 行小终端才能稳定复现，运行约数秒。
 * 新手阅读建议：先读顶部预期/实际行为，再按 main 的三个 Phase 跟踪 buffer 内容。
 */
import { ProcessTerminal } from "../src/terminal.ts";
import { type Component, TUI } from "../src/tui.ts";

/** 异步等待指定毫秒；ms 为时长，返回计时完成 Promise。 */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** 保存并渲染固定宽度文本行的最小组件。 */
class Lines implements Component {
	// lines 是当前组件全部逻辑行。
	private lines: string[] = [];

	/** 替换全部内容；lines 为新行数组，无返回值。 */
	set(lines: string[]): void {
		this.lines = lines;
	}

	/** 在末尾追加行；lines 为待追加数组，无返回值。 */
	append(lines: string[]): void {
		this.lines.push(...lines);
	}

	/** 按 width 截断或补齐每行并返回渲染数组。 */
	render(width: number): string[] {
		// line 是当前逻辑行，过长截断，过短补空格。
		return this.lines.map((line) => {
			if (line.length > width) return line.slice(0, width);
			return line.padEnd(width, " ");
		});
	}

	/** 满足 Component 接口的空失效方法；无参数，无返回值。 */
	invalidate(): void {}
}

/**
 * 按固定延迟向组件流式追加编号行。
 * 参数：buffer 为行组件，label 为前缀，count 为数量，delayMs 为间隔，ui 为界面。
 * 返回值：全部追加完成 Promise。
 * 使用示例：`await streamLines(buffer, "TOOL OUT", count, 20, ui)`。
 */
async function streamLines(buffer: Lines, label: string, count: number, delayMs: number, ui: TUI): Promise<void> {
	// i 是从 1 开始的当前行编号。
	for (let i = 1; i <= count; i += 1) {
		buffer.append([`${label} ${String(i).padStart(2, "0")}`]);
		ui.requestRender();
		await sleep(delayMs);
	}
}

/** 运行三阶段视口覆盖复现；无参数，返回完成 Promise。 */
async function main(): Promise<void> {
	// ui 是连接真实终端的测试界面。
	const ui = new TUI(new ProcessTerminal());
	// buffer 是承载全部逐步追加文本的组件。
	const buffer = new Lines();
	ui.addChild(buffer);
	ui.start();

	// height 是当前终端可见行数。
	const height = ui.terminal.rows;
	// preCount 保证工具前文本超过视口。
	const preCount = height + 8; // Ensure content exceeds viewport
	// toolCount 让工具输出进一步推进滚动区。
	const toolCount = height + 12; // Tool output pushes further into scrollback
	// postCount 是工具后追加的固定行数。
	const postCount = 6;

	buffer.set([
		"TUI viewport overwrite repro",
		`Viewport rows detected: ${height}`,
		"(Resize to ~8-12 rows for best repro)",
		"",
		"=== PRE-TOOL STREAM ===",
	]);
	ui.requestRender();
	await sleep(300);

	// Phase 1: Stream pre-tool text until viewport is exceeded.
	// 阶段 1：持续输出工具前文本直到超过视口。
	await streamLines(buffer, "PRE-TOOL LINE", preCount, 30, ui);

	// Phase 2: Simulate tool call pause and tool output.
	// 阶段 2：模拟工具调用暂停和工具输出。
	buffer.append(["", "--- TOOL CALL START ---", "(pause...)", ""]);
	ui.requestRender();
	await sleep(700);

	await streamLines(buffer, "TOOL OUT", toolCount, 20, ui);

	// Phase 3: Post-tool streaming. This is where overwrite often appears.
	// 阶段 3：继续流式输出工具后文本，覆盖缺陷通常在此出现。
	buffer.append(["", "=== POST-TOOL STREAM ==="]);
	ui.requestRender();
	await sleep(300);
	await streamLines(buffer, "POST-TOOL LINE", postCount, 40, ui);

	// Leave the output visible briefly, then restore terminal state.
	// 短暂保留结果供观察，然后恢复终端状态。
	await sleep(1500);
	ui.stop();
}

// error 是主流程抛出的未知错误，处理器尽力恢复终端后报告失败。
main().catch((error) => {
	// Ensure terminal is restored if something goes wrong.
	// 发生错误时确保终端状态得到恢复。
	try {
		// ui 是仅用于执行 stop 恢复动作的临时界面。
		const ui = new TUI(new ProcessTerminal());
		ui.stop();
	} catch {
		// Ignore restore errors.
		// 忽略恢复过程中出现的次要错误。
	}
	process.stderr.write(`${String(error)}\n`);
	process.exitCode = 1;
});
