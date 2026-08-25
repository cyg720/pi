/**
 * 文件职责：验证大型 edit 工具预览和结果落定只做差异渲染，并可从已保存结果重建预览或显示预检错误。
 * 技术维度：使用 Vitest、真实 TUI/ToolExecutionComponent、伪 Terminal、临时大文件和 edit diff 计算执行渲染集成测试。
 * 产品维度：避免大补丁完成时终端整屏闪烁，同时保证恢复历史会话仍显示修改内容和错误原因。
 * 逻辑维度：构造大量分散编辑和渲染等待器，再覆盖实时调用、历史重放与编辑不适用三种状态。
 * 关键边界：渲染为异步节流流程，需要轮询等待；测试文件最多 1000 行；临时目录必须清理。
 * 新手阅读建议：先看 FakeTerminal 的 fullClearCount，再跟随 ToolExecutionComponent 从参数完成到结果落定的状态变化。
 */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Container, type Terminal, Text, TUI } from "@earendil-works/pi-tui";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createEditToolDefinition } from "../src/core/tools/edit.ts";
import { computeEditsDiff, type Edit } from "../src/core/tools/edit-diff.ts";
import { ToolExecutionComponent } from "../src/modes/interactive/components/tool-execution.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";

/** FakeTerminal 实现最小终端接口并记录全部写入，用于统计整屏清理控制序列。 */
class FakeTerminal implements Terminal {
	// columns 是固定终端宽度。
	columns = 80;
	// rows 是固定终端高度。
	rows = 24;
	// kittyProtocolActive 固定为 true，保持 TUI 图片协议路径稳定。
	kittyProtocolActive = true;
	// writes 按顺序记录 TUI 输出。
	writes: string[] = [];

	/** 兼容终端启动接口；无参数、无返回值。 */
	start(): void {}
	/** 兼容终端停止接口；无参数、无返回值。 */
	stop(): void {}
	/** 虚拟排空输入；无参数；返回完成 Promise。 */
	async drainInput(): Promise<void> {}
	/** 记录写入；参数 data 为终端文本；无返回值。 */
	write(data: string): void {
		this.writes.push(data);
	}
	/** 兼容相对移动；参数未使用；无返回值。 */
	moveBy(_lines: number): void {}
	/** 兼容隐藏光标；无参数、无返回值。 */
	hideCursor(): void {}
	/** 兼容显示光标；无参数、无返回值。 */
	showCursor(): void {}
	/** 兼容清行；无参数、无返回值。 */
	clearLine(): void {}
	/** 兼容从光标清屏；无参数、无返回值。 */
	clearFromCursor(): void {}
	/** 兼容整屏清理；无参数、无返回值。 */
	clearScreen(): void {}
	/** 兼容标题设置；参数未使用；无返回值。 */
	setTitle(_title: string): void {}
	/** 兼容进度设置；参数未使用；无返回值。 */
	setProgress(_active: boolean): void {}

	/** 返回写入完整清屏序列的次数。 */
	get fullClearCount(): number {
		return this.writes.filter((write) => write.includes("\x1b[2J\x1b[H\x1b[3J")).length;
	}
}

/** 等待一次零延迟计时器，使节流渲染有机会运行；无参数；返回 Promise。 */
async function waitForRender(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * 轮询渲染字符串直到包含目标文本或超时。
 * @param getRender 获取当前渲染文本的函数。
 * @param expectedText 期望出现的片段。
 * @param onRetry 每轮可选触发渲染回调。
 * @param timeoutMs 最长等待毫秒数，默认 2000。
 * @returns 命中后的完整渲染文本。
 */
async function waitForRenderedText(
	getRender: () => string,
	expectedText: string,
	onRetry?: () => void,
	timeoutMs = 2000,
): Promise<string> {
	// deadline 是轮询绝对截止时间。
	const deadline = Date.now() + timeoutMs;
	// lastRender 保存最近一次渲染，超时时用于诊断。
	let lastRender = "";
	while (Date.now() < deadline) {
		onRetry?.();
		await waitForRender();
		lastRender = getRender();
		if (lastRender.includes(expectedText)) {
			return lastRender;
		}
	}
	throw new Error(`Timed out waiting for render to include "${expectedText}". Last render:\n${lastRender}`);
}

/** 从大文件行数组构造十个分散的三行替换；参数 lines 为源行；返回 Edit 数组。 */
function createLargeEdits(lines: string[]): Edit[] {
	// targets 是被修改中心行的一基行号列表。
	const targets = [50, 150, 250, 350, 450, 550, 650, 750, 850, 950];
	return targets.map((lineNumber) => ({
		oldText: `${lines[lineNumber - 1]}\n${lines[lineNumber]}\n${lines[lineNumber + 1]}`,
		newText: `${lines[lineNumber - 1]}\n${lines[lineNumber]} changed\n${lines[lineNumber + 1]}`,
	}));
}

// 验证 edit 工具组件在大差异、历史重放和预检错误时的 TUI 行为。
describe("edit tool TUI rendering", () => {
	// tempDirs 收集所有异步创建的临时目录。
	const tempDirs: string[] = [];

	// 全组测试前初始化暗色主题。
	beforeAll(() => {
		initTheme("dark");
	});

	// 每个用例后并行删除临时目录。
	afterEach(async () => {
		await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
	});

	// 大差异应完整出现在调用预览，结果落定不能触发全屏重绘。
	it("renders the large diff in the call preview and does not full-redraw when the result settles", async () => {
		// dir 是大型文件用例的临时目录。
		const dir = await mkdtemp(join(tmpdir(), "pi-edit-redraw-"));
		tempDirs.push(dir);
		// filePath 是 1000 行测试文件。
		const filePath = join(dir, "large-edit.txt");
		await writeFile(
			filePath,
			`${Array.from({ length: 1000 }, (_, i) => `line ${i}`).join("\n")}
`,
			"utf8",
		);
		// lines 是写入文件后读取的源行数组。
		const lines = (await readFile(filePath, "utf8")).trimEnd().split("\n");
		// edits 是跨文件十处的替换请求。
		const edits = createLargeEdits(lines);
		// diff 是预计算的编辑差异详情。
		const diff = await computeEditsDiff(filePath, edits, process.cwd());
		if ("error" in diff) {
			throw new Error(diff.error);
		}

		// terminal 记录底层输出与清屏次数。
		const terminal = new FakeTerminal();
		// tui 是运行真实差异渲染的界面实例。
		const tui = new TUI(terminal);
		// root 包含大量历史行和工具组件，模拟已滚动聊天。
		const root = new Container();
		/** i 是历史行序号，从 0 到 199，用于构造足够长的滚动区域。 */
		for (let i = 0; i < 200; i++) {
			root.addChild(new Text(`history ${i}`, 0, 0));
		}

		// component 是待测 edit 工具执行组件。
		const component = new ToolExecutionComponent(
			"edit",
			"tool-call-1",
			{ path: filePath, edits },
			{},
			createEditToolDefinition(process.cwd()),
			tui,
			process.cwd(),
		);
		root.addChild(component);
		tui.addChild(root);
		tui.start();
		await waitForRender();

		component.setArgsComplete();
		tui.requestRender();
		await waitForRender();
		await waitForRender();

		// callOnlyRender 是工具结果尚未落定时的调用预览。
		const callOnlyRender = await waitForRenderedText(
			() => component.render(80).join("\n"),
			"line 50 changed",
			() => tui.requestRender(true),
		);
		expect(callOnlyRender).toContain("edit");
		expect(callOnlyRender).toContain("line 950 changed");

		// redrawsBeforeResult 记录结果更新前 TUI 全量重绘次数。
		const redrawsBeforeResult = tui.fullRedraws;
		// clearsBeforeResult 记录结果更新前终端完整清屏次数。
		const clearsBeforeResult = terminal.fullClearCount;
		component.updateResult(
			{
				content: [{ type: "text", text: `Successfully replaced ${edits.length} block(s) in ${filePath}.` }],
				details: diff,
				isError: false,
			},
			false,
		);
		tui.requestRender();
		await waitForRender();

		expect(tui.fullRedraws).toBe(redrawsBeforeResult);
		expect(terminal.fullClearCount).toBe(clearsBeforeResult);

		// settledRender 是结果落定后的组件文本，应继续显示差异而非成功句。
		const settledRender = component.render(80).join("\n");
		expect(settledRender).toContain("line 50 changed");
		expect(settledRender).toContain("line 950 changed");
		expect(settledRender).not.toContain("Successfully replaced");
	});

	// 历史结果没有 argsComplete 事件时，也应仅凭 details 重建盒装差异预览。
	it("reconstructs the boxed preview from a settled result without argsComplete", async () => {
		// dir 是历史重放用例临时目录。
		const dir = await mkdtemp(join(tmpdir(), "pi-edit-replay-"));
		tempDirs.push(dir);
		// filePath 是生成差异后会被删除的源文件。
		const filePath = join(dir, "replay-edit.txt");
		await writeFile(
			filePath,
			`${Array.from({ length: 200 }, (_, i) => `line ${i}`).join("\n")}
`,
			"utf8",
		);
		// lines、edits、diff 构成已保存结果中的差异详情。
		const lines = (await readFile(filePath, "utf8")).trimEnd().split("\n");
		const edits = createLargeEdits(lines).slice(0, 2);
		const diff = await computeEditsDiff(filePath, edits, process.cwd());
		/** diff 是预先计算并保存的编辑差异；错误分支会在构造组件前终止用例。 */
		if ("error" in diff) {
			throw new Error(diff.error);
		}
		await rm(filePath, { force: true });

		// terminal、tui、component 构造历史结果重放界面。
		const terminal = new FakeTerminal();
		const tui = new TUI(terminal);
		const component = new ToolExecutionComponent(
			"edit",
			"tool-call-replay",
			{ path: filePath, edits },
			{},
			createEditToolDefinition(process.cwd()),
			tui,
			process.cwd(),
		);
		/** component 是依据已保存差异重放的工具组件，用于验证渲染不依赖原文件。 */
		tui.addChild(component);
		tui.start();
		await waitForRender();

		component.updateResult(
			{
				content: [{ type: "text", text: `Successfully replaced ${edits.length} block(s) in ${filePath}.` }],
				details: diff,
				isError: false,
			},
			false,
		);
		await waitForRender();
		await waitForRender();

		// rendered 是只调用 updateResult 后重建的差异文本。
		const rendered = component.render(80).join("\n");
		expect(rendered).toContain("line 50 changed");
		expect(rendered).toContain("line 150 changed");
	});

	// 编辑块无法匹配源文件时，应显示预检错误且不伪造增删行。
	it("shows a preflight error without rendering a diff when the edits do not apply", async () => {
		// dir 和 filePath 保存不会匹配 oldText 的短文件。
		const dir = await mkdtemp(join(tmpdir(), "pi-edit-preflight-"));
		tempDirs.push(dir);
		const filePath = join(dir, "missing-edit.txt");
		/** filePath 指向不含目标旧文本的短文件，用于触发编辑预检失败。 */
		await writeFile(filePath, "line 0\nline 1\n", "utf8");

		// terminal、tui、component 构造预检失败渲染路径。
		const terminal = new FakeTerminal();
		const tui = new TUI(terminal);
		const component = new ToolExecutionComponent(
			"edit",
			"tool-call-2",
			{ path: filePath, edits: [{ oldText: "does not exist", newText: "replacement" }] },
			{},
			createEditToolDefinition(process.cwd()),
			tui,
			process.cwd(),
		);
		/** component 是预检失败场景的工具组件，后续断言其错误输出不会触发全屏重绘。 */
		tui.addChild(component);
		tui.start();
		await waitForRender();

		component.setArgsComplete();
		tui.requestRender();
		await waitForRender();
		await waitForRender();

		// rendered 是等待异步预检错误出现后的组件文本。
		const rendered = await waitForRenderedText(
			() => component.render(80).join("\n"),
			"Could not find",
			() => tui.requestRender(true),
		);
		expect(rendered).not.toContain("+1 ");
		expect(rendered).not.toContain("-1 ");
	});
});
