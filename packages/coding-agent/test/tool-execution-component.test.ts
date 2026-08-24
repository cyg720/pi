/**
 * 文件职责：验证 ToolExecutionComponent 对内置与自定义工具调用、结果、折叠、截断和扩展渲染器的兼容行为。
 * 技术维度：使用 Vitest、pi-tui Text/TUI、工具定义工厂、ANSI 清理以及伪 Bash 执行操作。
 * 产品维度：保障终端中的工具执行记录简洁、准确且可展开，不重复标题、截断提示或泄露应隐藏的资源内容。
 * 逻辑维度：先测试渲染器组合和 Bash 输出，再覆盖内置覆盖、共享状态、读写预览、错误与特殊资源折叠。
 * 关键边界：渲染断言依赖固定终端宽度与主题；长输出用例会生成数千行但不启动真实外部命令。
 * 新手阅读建议：先读两个辅助工厂，再看自定义与内置渲染器继承，最后阅读 read 特殊折叠场景。
 */

import { join, resolve } from "node:path";
import { Text, type TUI } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { beforeAll, describe, expect, test } from "vitest";
import { getReadmePath } from "../src/config.ts";
import type { ToolDefinition } from "../src/core/extensions/types.ts";
import { type BashOperations, createBashToolDefinition } from "../src/core/tools/bash.ts";
import { createReadTool, createReadToolDefinition } from "../src/core/tools/read.ts";
import { createWriteToolDefinition } from "../src/core/tools/write.ts";
import { ToolExecutionComponent } from "../src/modes/interactive/components/tool-execution.ts";
import { initTheme, theme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

/** 创建最小可执行工具定义。参数 name 默认为 custom_tool；返回带 Any 参数和固定文本结果的 ToolDefinition。例如：createBaseToolDefinition("read")。 */
function createBaseToolDefinition(name = "custom_tool"): ToolDefinition {
	return {
		name,
		label: name,
		description: "custom tool",
		parameters: Type.Any(),
		execute: async () => ({
			content: [{ type: "text", text: "ok" }],
			details: {},
		}),
	};
}

/** 创建只实现 requestRender 的最小 TUI 替身。无参数；返回供组件构造使用的 TUI。例如：createFakeTui()。 */
function createFakeTui(): TUI {
	return {
		requestRender: () => {},
	} as unknown as TUI;
}

/** 测试分组：ToolExecutionComponent 与既有工具渲染行为保持一致。 */
describe("ToolExecutionComponent parity", () => {
	beforeAll(() => {
		initTheme("dark");
	});

	/** 测试场景：验证当前工具调用或结果的渲染、折叠与截断行为。 */
	test("stacks custom call and result renderers like the old implementation", () => {
		/** 变量 toolDefinition：当前场景的自定义工具定义及渲染器；仅在当前测试或循环范围内有效。 */
		const toolDefinition: ToolDefinition = {
			...createBaseToolDefinition(),
			renderCall: () => new Text("custom call", 0, 0),
			renderResult: () => new Text("custom result", 0, 0),
		};

		/** 变量 component：当前被测的工具执行界面组件；仅在当前测试或循环范围内有效。 */
		const component = new ToolExecutionComponent(
			"custom_tool",
			"tool-1",
			{},
			{},
			toolDefinition,
			createFakeTui(),
			process.cwd(),
		);
		expect(stripAnsi(component.render(120).join("\n"))).toContain("custom call");

		component.updateResult(
			{
				content: [{ type: "text", text: "done" }],
				details: {},
				isError: false,
			},
			false,
		);

		/** 变量 rendered：去除 ANSI 后的组件渲染文本；仅在当前测试或循环范围内有效。 */
		const rendered = stripAnsi(component.render(120).join("\n"));
		expect(rendered).toContain("custom call");
		expect(rendered).toContain("custom result");
	});

	/** 测试场景：验证当前工具调用或结果的渲染、折叠与截断行为。 */
	test("self-rendered empty tool rows take no layout space", () => {
		/** 变量 toolDefinition：当前场景的自定义工具定义及渲染器；仅在当前测试或循环范围内有效。 */
		const toolDefinition: ToolDefinition = {
			...createBaseToolDefinition(),
			renderShell: "self",
			renderCall: () => new Text("", 0, 0),
			renderResult: () => new Text("", 0, 0),
		};

		/** 变量 component：当前被测的工具执行界面组件；仅在当前测试或循环范围内有效。 */
		const component = new ToolExecutionComponent(
			"custom_tool",
			"tool-empty-self-render",
			{},
			{},
			toolDefinition,
			createFakeTui(),
			process.cwd(),
		);
		expect(component.render(120)).toEqual([]);

		component.updateResult(
			{
				content: [],
				details: {},
				isError: false,
			},
			false,
		);

		expect(component.render(120)).toEqual([]);
	});

	/** 测试场景：验证当前工具调用或结果的渲染、折叠与截断行为。 */
	test("uses built-in rendering for built-in overrides without custom renderers", () => {
		/** 变量 overrideDefinition：覆盖内置工具部分行为的扩展工具定义；仅在当前测试或循环范围内有效。 */
		const overrideDefinition: ToolDefinition = {
			...createBaseToolDefinition("edit"),
		};

		/** 变量 component：当前被测的工具执行界面组件；仅在当前测试或循环范围内有效。 */
		const component = new ToolExecutionComponent(
			"edit",
			"tool-2",
			{ path: "README.md", oldText: "before", newText: "after" },
			{},
			overrideDefinition,
			createFakeTui(),
			process.cwd(),
		);
		component.updateResult({ content: [], details: { diff: "+1 after", firstChangedLine: 1 }, isError: false });
		/** 变量 rendered：去除 ANSI 后的组件渲染文本；仅在当前测试或循环范围内有效。 */
		const rendered = stripAnsi(component.render(120).join("\n"));
		expect(rendered).toContain("edit");
		expect(rendered).toContain("README.md");
		expect(rendered).not.toContain(":1");
	});

	/** 测试场景：验证当前工具调用或结果的渲染、折叠与截断行为。 */
	test("preserves legacy file_path rendering compatibility for built-in tools", () => {
		/** 变量 component：当前被测的工具执行界面组件；仅在当前测试或循环范围内有效。 */
		const component = new ToolExecutionComponent(
			"read",
			"tool-3",
			{ file_path: "README.md" },
			{},
			undefined,
			createFakeTui(),
			process.cwd(),
		);
		/** 变量 rendered：去除 ANSI 后的组件渲染文本；仅在当前测试或循环范围内有效。 */
		const rendered = stripAnsi(component.render(120).join("\n"));
		expect(rendered).toContain("read");
		expect(rendered).toContain("README.md");
	});

	/** 测试场景：验证当前工具调用或结果的渲染、折叠与截断行为。 */
	test("bash execute emits an initial empty partial update before output arrives", async () => {
		/** 变量 updates：Bash 工具执行期间收到的部分更新数组；仅在当前测试或循环范围内有效。 */
		const updates: Array<{ content: Array<{ type: string; text?: string }>; details?: unknown }> = [];
		/** 变量 operations：模拟 Bash 执行过程的操作实现；仅在当前测试或循环范围内有效。 */
		const operations: BashOperations = {
			exec: async () => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				return { exitCode: 0 };
			},
		};
		/** 变量 tool：当前用例执行或渲染的工具定义；仅在当前测试或循环范围内有效。 */
		const tool = createBashToolDefinition(process.cwd(), { operations, exposeSessionEnvironment: false });
		/** 变量 promise：尚未完成的异步 Bash 工具执行；仅在当前测试或循环范围内有效。 */
		const promise = tool.execute(
			"tool-bash-1",
			{ command: "sleep 10" },
			undefined,
			(update) => updates.push(update as { content: Array<{ type: string; text?: string }>; details?: unknown }),
			{} as never,
		);
		expect(updates).toEqual([{ content: [], details: undefined }]);
		await promise;
	});

	/** 测试场景：验证当前工具调用或结果的渲染、折叠与截断行为。 */
	test("bash renderer does not duplicate final full output truncation details", async () => {
		/** 变量 operations：模拟 Bash 执行过程的操作实现；仅在当前测试或循环范围内有效。 */
		const operations: BashOperations = {
			exec: async (_command, _cwd, { onData }) => {
				for (let i = 1; i <= 4000; i++) {
					/** 循环变量 i：生成长 Bash 输出时的行号，范围 1 到 4000。 */
					onData(Buffer.from(`line-${String(i).padStart(4, "0")}\n`));
				}
				return { exitCode: 0 };
			},
		};
		/** 变量 tool：当前用例执行或渲染的工具定义；仅在当前测试或循环范围内有效。 */
		const tool = createBashToolDefinition(process.cwd(), { operations, exposeSessionEnvironment: false });
		/** 变量 result：工具执行返回的最终内容与详情；仅在当前测试或循环范围内有效。 */
		const result = await tool.execute(
			"tool-bash-1b",
			{ command: "generate output" },
			undefined,
			undefined,
			{} as never,
		);
		/** 变量 component：当前被测的工具执行界面组件；仅在当前测试或循环范围内有效。 */
		const component = new ToolExecutionComponent(
			"bash",
			"tool-bash-1b",
			{ command: "generate output" },
			{},
			tool,
			createFakeTui(),
			process.cwd(),
		);
		component.setExpanded(true);
		component.updateResult({ ...result, isError: false }, false);

		/** 变量 rendered：去除 ANSI 后的组件渲染文本；仅在当前测试或循环范围内有效。 */
		const rendered = stripAnsi(component.render(200).join("\n"));
		expect(rendered.match(/Full output:/g)?.length ?? 0).toBe(1);
		expect(rendered).toMatch(/line-4000[^\n]*\n[^\S\n]*\n \[Full output:/);
		expect(rendered).not.toMatch(/line-4000[^\n]*\n[^\S\n]*\n[^\S\n]*\n \[Full output:/);
		expect(rendered).toContain("Truncated: showing 2000 of 4000 lines");
		expect(rendered).not.toContain("[Showing lines 2001-4000 of 4000. Full output:");
	});

	/** 测试场景：验证当前工具调用或结果的渲染、折叠与截断行为。 */
	test("does not duplicate built-in headers when passed the active built-in definition", () => {
		/** 变量 component：当前被测的工具执行界面组件；仅在当前测试或循环范围内有效。 */
		const component = new ToolExecutionComponent(
			"read",
			"tool-4",
			{ path: "README.md" },
			{},
			createReadToolDefinition(process.cwd()),
			createFakeTui(),
			process.cwd(),
		);
		component.updateResult({ content: [{ type: "text", text: "hello" }], details: undefined, isError: false }, false);
		/** 变量 rendered：去除 ANSI 后的组件渲染文本；仅在当前测试或循环范围内有效。 */
		const rendered = stripAnsi(component.render(120).join("\n"));
		expect(rendered.match(/\bread\b/g)?.length ?? 0).toBe(1);
	});

	/** 测试场景：验证当前工具调用或结果的渲染、折叠与截断行为。 */
	test("inherits missing built-in result renderer slot from the built-in tool", () => {
		/** 变量 overrideDefinition：覆盖内置工具部分行为的扩展工具定义；仅在当前测试或循环范围内有效。 */
		const overrideDefinition: ToolDefinition = {
			...createBaseToolDefinition("read"),
			renderCall: () => new Text("override call", 0, 0),
		};

		/** 变量 component：当前被测的工具执行界面组件；仅在当前测试或循环范围内有效。 */
		const component = new ToolExecutionComponent(
			"read",
			"tool-4b",
			{ path: "notes.txt" },
			{},
			overrideDefinition,
			createFakeTui(),
			process.cwd(),
		);
		component.updateResult({ content: [{ type: "text", text: "hello" }], details: undefined, isError: false }, false);
		component.setExpanded(true);
		/** 变量 rendered：去除 ANSI 后的组件渲染文本；仅在当前测试或循环范围内有效。 */
		const rendered = stripAnsi(component.render(120).join("\n"));
		expect(rendered).toContain("override call");
		expect(rendered).toContain("hello");
	});

	/** 测试场景：验证当前工具调用或结果的渲染、折叠与截断行为。 */
	test("inherits missing built-in call renderer slot from the built-in tool", () => {
		/** 变量 overrideDefinition：覆盖内置工具部分行为的扩展工具定义；仅在当前测试或循环范围内有效。 */
		const overrideDefinition: ToolDefinition = {
			...createBaseToolDefinition("read"),
			renderResult: () => new Text("override result", 0, 0),
		};

		/** 变量 component：当前被测的工具执行界面组件；仅在当前测试或循环范围内有效。 */
		const component = new ToolExecutionComponent(
			"read",
			"tool-4c",
			{ path: "README.md" },
			{},
			overrideDefinition,
			createFakeTui(),
			process.cwd(),
		);
		component.updateResult({ content: [{ type: "text", text: "hello" }], details: undefined, isError: false }, false);
		/** 变量 rendered：去除 ANSI 后的组件渲染文本；仅在当前测试或循环范围内有效。 */
		const rendered = stripAnsi(component.render(120).join("\n"));
		expect(rendered).toContain("read");
		expect(rendered).toContain("README.md");
		expect(rendered).toContain("override result");
	});

	/** 测试场景：验证当前工具调用或结果的渲染、折叠与截断行为。 */
	test("uses custom renderers for built-in overrides that reuse built-in definition parameters", () => {
		/** 变量 builtInDefinition：当前工作目录生成的内置 read 工具定义；仅在当前测试或循环范围内有效。 */
		const builtInDefinition = createReadToolDefinition(process.cwd());
		/** 变量 component：当前被测的工具执行界面组件；仅在当前测试或循环范围内有效。 */
		const component = new ToolExecutionComponent(
			"read",
			"tool-4d",
			{ path: "README.md" },
			{},
			{
				...builtInDefinition,
				renderCall: () => new Text("override call", 0, 0),
				renderResult: () => new Text("override result", 0, 0),
			},
			createFakeTui(),
			process.cwd(),
		);
		component.updateResult({ content: [{ type: "text", text: "hello" }], details: undefined, isError: false }, false);
		/** 变量 rendered：去除 ANSI 后的组件渲染文本；仅在当前测试或循环范围内有效。 */
		const rendered = stripAnsi(component.render(120).join("\n"));
		expect(rendered).toContain("override call");
		expect(rendered).toContain("override result");
		expect(rendered).not.toContain("read README.md");
	});

	/** 测试场景：验证当前工具调用或结果的渲染、折叠与截断行为。 */
	test("uses custom renderers for built-in overrides that reuse wrapped built-in tool parameters", () => {
		/** 变量 builtInTool：封装后的内置 read 工具实例；仅在当前测试或循环范围内有效。 */
		const builtInTool = createReadTool(process.cwd());
		/** 变量 component：当前被测的工具执行界面组件；仅在当前测试或循环范围内有效。 */
		const component = new ToolExecutionComponent(
			"read",
			"tool-4e",
			{ path: "README.md" },
			{},
			{
				...createBaseToolDefinition("read"),
				parameters: builtInTool.parameters,
				renderCall: () => new Text("wrapped override call", 0, 0),
				renderResult: () => new Text("wrapped override result", 0, 0),
			},
			createFakeTui(),
			process.cwd(),
		);
		component.updateResult({ content: [{ type: "text", text: "hello" }], details: undefined, isError: false }, false);
		/** 变量 rendered：去除 ANSI 后的组件渲染文本；仅在当前测试或循环范围内有效。 */
		const rendered = stripAnsi(component.render(120).join("\n"));
		expect(rendered).toContain("wrapped override call");
		expect(rendered).toContain("wrapped override result");
	});

	/** 测试场景：验证当前工具调用或结果的渲染、折叠与截断行为。 */
	test("shares renderer state across custom call and result slots", () => {
		/** 渲染器共享状态类型：token 可选，用于验证调用与结果渲染槽共享同一状态。 */
		type RenderState = { token?: string };
		/** 变量 toolDefinition：当前场景的自定义工具定义及渲染器；仅在当前测试或循环范围内有效。 */
		const toolDefinition: ToolDefinition<any, unknown, RenderState> = {
			...createBaseToolDefinition(),
			renderCall: (_args, _theme, context) => {
				context.state.token ??= "shared-token";
				return new Text(`custom call ${context.state.token}`, 0, 0);
			},
			renderResult: (_result, _options, _theme, context) => {
				return new Text(`custom result ${context.state.token}`, 0, 0);
			},
		};

		/** 变量 component：当前被测的工具执行界面组件；仅在当前测试或循环范围内有效。 */
		const component = new ToolExecutionComponent(
			"custom_tool",
			"tool-5",
			{},
			{},
			toolDefinition,
			createFakeTui(),
			process.cwd(),
		);
		component.updateResult({ content: [{ type: "text", text: "done" }], details: {}, isError: false }, false);
		/** 变量 rendered：去除 ANSI 后的组件渲染文本；仅在当前测试或循环范围内有效。 */
		const rendered = stripAnsi(component.render(120).join("\n"));
		expect(rendered).toContain("custom call shared-token");
		expect(rendered).toContain("custom result shared-token");
	});

	/** 测试场景：验证当前工具调用或结果的渲染、折叠与截断行为。 */
	test("exposes args in render result context", () => {
		/** 变量 toolDefinition：当前场景的自定义工具定义及渲染器；仅在当前测试或循环范围内有效。 */
		const toolDefinition: ToolDefinition = {
			...createBaseToolDefinition(),
			renderCall: () => new Text("call", 0, 0),
			renderResult: (_result, _options, _theme, context) =>
				new Text(`arg:${String((context.args as { foo: string }).foo)}`, 0, 0),
		};

		/** 变量 component：当前被测的工具执行界面组件；仅在当前测试或循环范围内有效。 */
		const component = new ToolExecutionComponent(
			"custom_tool",
			"tool-5b",
			{ foo: "bar" },
			{},
			toolDefinition,
			createFakeTui(),
			process.cwd(),
		);
		component.updateResult({ content: [{ type: "text", text: "done" }], details: {}, isError: false }, false);
		/** 变量 rendered：去除 ANSI 后的组件渲染文本；仅在当前测试或循环范围内有效。 */
		const rendered = stripAnsi(component.render(120).join("\n"));
		expect(rendered).toContain("arg:bar");
	});

	/** 测试场景：验证当前工具调用或结果的渲染、折叠与截断行为。 */
	test("falls back when custom renderers are absent", () => {
		/** 变量 toolDefinition：当前场景的自定义工具定义及渲染器；仅在当前测试或循环范围内有效。 */
		const toolDefinition: ToolDefinition = {
			...createBaseToolDefinition(),
		};

		/** 变量 component：当前被测的工具执行界面组件；仅在当前测试或循环范围内有效。 */
		const component = new ToolExecutionComponent(
			"custom_tool",
			"tool-6",
			{ foo: "bar" },
			{},
			toolDefinition,
			createFakeTui(),
			process.cwd(),
		);
		component.updateResult({ content: [{ type: "text", text: "done" }], details: {}, isError: false }, false);
		/** 变量 rendered：去除 ANSI 后的组件渲染文本；仅在当前测试或循环范围内有效。 */
		const rendered = stripAnsi(component.render(120).join("\n"));
		expect(rendered).toContain("custom_tool");
		expect(rendered).toContain("done");
	});

	/** 测试场景：验证当前工具调用或结果的渲染、折叠与截断行为。 */
	test("trims trailing blank display lines from write previews", () => {
		/** 变量 component：当前被测的工具执行界面组件；仅在当前测试或循环范围内有效。 */
		const component = new ToolExecutionComponent(
			"write",
			"tool-7",
			{ path: "README.md", content: "one\ntwo\n" },
			{},
			createWriteToolDefinition(process.cwd()),
			createFakeTui(),
			process.cwd(),
		);
		/** 变量 rendered：去除 ANSI 后的组件渲染文本；仅在当前测试或循环范围内有效。 */
		const rendered = stripAnsi(component.render(120).join("\n"));
		expect(rendered).toContain("one");
		expect(rendered).toContain("two");
		expect(rendered).not.toContain("two\n\n");
	});

	/** 测试场景：验证当前工具调用或结果的渲染、折叠与截断行为。 */
	test("trims trailing blank display lines from read results", () => {
		/** 变量 component：当前被测的工具执行界面组件；仅在当前测试或循环范围内有效。 */
		const component = new ToolExecutionComponent(
			"read",
			"tool-8",
			{ path: "notes.txt" },
			{},
			createReadToolDefinition(process.cwd()),
			createFakeTui(),
			process.cwd(),
		);
		component.updateResult(
			{ content: [{ type: "text", text: "one\ntwo\n" }], details: undefined, isError: false },
			false,
		);
		component.setExpanded(true);
		/** 变量 rendered：去除 ANSI 后的组件渲染文本；仅在当前测试或循环范围内有效。 */
		const rendered = stripAnsi(component.render(120).join("\n"));
		expect(rendered).toContain("one");
		expect(rendered).toContain("two");
		expect(rendered).not.toContain("two\n\n");
	});

	/** 测试场景：验证当前工具调用或结果的渲染、折叠与截断行为。 */
	test("does not syntax-highlight read errors based on the requested file path", () => {
		/** 变量 component：当前被测的工具执行界面组件；仅在当前测试或循环范围内有效。 */
		const component = new ToolExecutionComponent(
			"read",
			"tool-read-error-highlighting",
			{ path: "config.exs", offset: 120, limit: 130 },
			{},
			createReadToolDefinition(process.cwd()),
			createFakeTui(),
			process.cwd(),
		);
		/** 变量 error：用于检查错误渲染样式的文本；仅在当前测试或循环范围内有效。 */
		const error = "Offset 120 is beyond end of file (96 lines total)";
		component.updateResult({ content: [{ type: "text", text: error }], details: undefined, isError: true }, false);

		/** 变量 rendered：去除 ANSI 后的组件渲染文本；仅在当前测试或循环范围内有效。 */
		const rendered = component.render(120).join("\n");
		expect(stripAnsi(rendered)).toContain(error);
		expect(rendered).toContain(theme.fg("toolOutput", error));
	});

	/** 测试场景：验证当前工具调用或结果的渲染、折叠与截断行为。 */
	test("collapses ordinary read results until expanded", () => {
		/** 变量 component：当前被测的工具执行界面组件；仅在当前测试或循环范围内有效。 */
		const component = new ToolExecutionComponent(
			"read",
			"tool-ordinary-read-collapsed",
			{ path: "notes.txt" },
			{},
			createReadToolDefinition(process.cwd()),
			createFakeTui(),
			process.cwd(),
		);
		component.updateResult(
			{ content: [{ type: "text", text: "hidden content" }], details: undefined, isError: false },
			false,
		);

		/** 变量 collapsed：组件未展开时的纯文本渲染结果；仅在当前测试或循环范围内有效。 */
		const collapsed = stripAnsi(component.render(120).join("\n"));
		expect(collapsed).toContain("read");
		expect(collapsed).toContain("notes.txt");
		expect(collapsed).not.toContain("hidden content");

		component.setExpanded(true);
		/** 变量 expanded：组件展开后的纯文本渲染结果；仅在当前测试或循环范围内有效。 */
		const expanded = stripAnsi(component.render(120).join("\n"));
		expect(expanded).toContain("hidden content");
	});

	for (const scenario of [
		/** 循环变量 scenario：当前特殊资源读取或行范围展示配置。 */
		{
			title: "SKILL.md",
			path: join(process.cwd(), "attio", "SKILL.md"),
			content: "---\nname: attio\ndescription: CRM helper\n---\n\n# Hidden skill instructions",
			compact: "[skill] attio",
			hidden: "Hidden skill instructions",
			absent: "read skill attio",
		},
		{
			title: "AGENTS.md",
			path: join(process.cwd(), ".pi", "AGENTS.md"),
			content: "Hidden resource instructions",
			compact: "read resource .pi/AGENTS.md",
			hidden: "Hidden resource instructions",
			absent: undefined,
		},
		{
			title: "outside AGENTS.md",
			path: resolve(process.cwd(), "..", "AGENTS.md"),
			content: "Hidden outside resource instructions",
			compact: `read resource ${resolve(process.cwd(), "..", "AGENTS.md").replace(/\\/g, "/")}`,
			hidden: "Hidden outside resource instructions",
			absent: undefined,
		},
		{
			title: "Pi documentation",
			path: getReadmePath(),
			content: "Hidden docs content",
			compact: "read docs README.md",
			hidden: "Hidden docs content",
			absent: undefined,
		},
	] as const) {
		/** 测试场景：验证当前工具调用或结果的渲染、折叠与截断行为。 */
		test(`renders ${scenario.title} read results compactly until expanded`, () => {
			/** 变量 component：当前被测的工具执行界面组件；仅在当前测试或循环范围内有效。 */
			const component = new ToolExecutionComponent(
				"read",
				`tool-compact-${scenario.title}`,
				{ path: scenario.path },
				{},
				createReadToolDefinition(process.cwd()),
				createFakeTui(),
				process.cwd(),
			);
			component.updateResult(
				{ content: [{ type: "text", text: scenario.content }], details: undefined, isError: false },
				false,
			);

			/** 变量 collapsed：组件未展开时的纯文本渲染结果；仅在当前测试或循环范围内有效。 */
			const collapsed = stripAnsi(component.render(120).join("\n"));
			expect(collapsed).toContain(scenario.compact);
			expect(collapsed).not.toContain(scenario.hidden);
			if (scenario.absent) {
				expect(collapsed).not.toContain(scenario.absent);
			}

			component.setExpanded(true);
			/** 变量 expanded：组件展开后的纯文本渲染结果；仅在当前测试或循环范围内有效。 */
			const expanded = stripAnsi(component.render(120).join("\n"));
			expect(expanded).toContain(scenario.hidden);
		});
	}

	for (const scenario of [
		/** 循环变量 scenario：当前特殊资源读取或行范围展示配置。 */
		{ title: "SKILL.md", path: join(process.cwd(), "attio", "SKILL.md"), compact: "[skill] attio:120-329" },
		{ title: "Pi documentation", path: getReadmePath(), compact: "read docs README.md:120-329" },
	] as const) {
		/** 测试场景：验证当前工具调用或结果的渲染、折叠与截断行为。 */
		test(`shows the read line range in compact ${scenario.title} reads before the expand hint`, () => {
			/** 变量 component：当前被测的工具执行界面组件；仅在当前测试或循环范围内有效。 */
			const component = new ToolExecutionComponent(
				"read",
				`tool-compact-range-${scenario.title}`,
				{ path: scenario.path, offset: 120, limit: 210 },
				{},
				createReadToolDefinition(process.cwd()),
				createFakeTui(),
				process.cwd(),
			);

			/** 变量 collapsed：组件未展开时的纯文本渲染结果；仅在当前测试或循环范围内有效。 */
			const collapsed = stripAnsi(component.render(120).join("\n"));
			expect(collapsed).toContain(scenario.compact);
			expect(collapsed.indexOf(":120-329")).toBeLessThan(collapsed.indexOf("to expand"));
		});
	}
});
