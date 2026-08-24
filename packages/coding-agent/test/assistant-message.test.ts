/**
 * 文件职责：验证助手与用户消息组件的 OSC 133 区域标记、长度错误、思考块合并和输出内边距。
 * 技术维度：使用 Vitest、TUI 组件、深色主题初始化和 ANSI 清理函数检查终端渲染文本。
 * 产品维度：让终端能识别消息区域、清楚提示截断，并按用户设置对齐正文和思考内容。
 * 逻辑维度：帮助函数构造助手消息；六个用例依次覆盖区域标记、工具调用、长度停止、思考和 padding。
 * 关键边界：包含工具调用时不得包 OSC 区域；连续 thinking 只显示一个折叠标签。
 * 新手阅读建议：先理解三个 OSC 常量，再比较普通消息与工具消息，最后看 setOutputPad 的前后渲染。
 */
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { describe, expect, test } from "vitest";
import { AssistantMessageComponent } from "../src/modes/interactive/components/assistant-message.ts";
import { UserMessageComponent } from "../src/modes/interactive/components/user-message.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

// OSC 133 助手区域开始标记。
const OSC133_ZONE_START = "\x1b]133;A\x07";
// OSC 133 助手区域结束标记。
const OSC133_ZONE_END = "\x1b]133;B\x07";
// OSC 133 命令完成标记。
const OSC133_ZONE_FINAL = "\x1b]133;C\x07";

/** 功能：创建零用量测试助手消息；参数 content、可选 stopReason；返回：AssistantMessage。示例：createAssistantMessage([{ type: "text", text: "hi" }])。 */
function createAssistantMessage(
	content: AssistantMessage["content"],
	overrides: Partial<Pick<AssistantMessage, "stopReason">> = {},
): AssistantMessage {
	return {
		role: "assistant",
		content,
		api: "openai-responses",
		provider: "openai",
		model: "gpt-4o-mini",
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: overrides.stopReason ?? "stop",
		timestamp: Date.now(),
	};
}

describe("AssistantMessageComponent", () => {
	test("adds OSC 133 zone markers to assistant messages without tool calls", () => {
		initTheme("dark");

		// 普通文本助手消息组件。
		const component = new AssistantMessageComponent(createAssistantMessage([{ type: "text", text: "hello" }]));
		// 40 列渲染结果。
		const lines = component.render(40);

		expect(lines).not.toHaveLength(0);
		expect(lines[0]).toContain(OSC133_ZONE_START);
		expect(lines[lines.length - 1].startsWith(OSC133_ZONE_END + OSC133_ZONE_FINAL)).toBe(true);
	});

	test("does not add OSC 133 zone markers when assistant message contains tool calls", () => {
		initTheme("dark");

		// 包含工具调用的助手消息组件。
		const component = new AssistantMessageComponent(
			createAssistantMessage([
				{ type: "text", text: "calling tool" },
				{ type: "toolCall", id: "tool-1", name: "read", arguments: { path: "file.txt" } },
			]),
		);
		// 合并为字符串的 60 列渲染结果。
		const rendered = component.render(60).join("\n");

		expect(rendered.includes(OSC133_ZONE_START)).toBe(false);
		expect(rendered.includes(OSC133_ZONE_END)).toBe(false);
		expect(rendered.includes(OSC133_ZONE_FINAL)).toBe(false);
	});

	test("renders length stops as visible errors", () => {
		initTheme("dark");

		// 因最大长度停止且隐藏思考的助手消息组件。
		const component = new AssistantMessageComponent(
			createAssistantMessage([{ type: "thinking", thinking: "private reasoning" }], { stopReason: "length" }),
			true,
		);
		// 长度停止场景的渲染文本。
		const rendered = component.render(80).join("\n");

		expect(rendered).toContain("Thinking...");
		expect(rendered).toContain("maximum output token limit");
		expect(rendered).toContain("response may be incomplete");
	});

	test("coalesces adjacent thinking blocks into one hidden thinking label", () => {
		initTheme("dark");

		// 含三个相邻 thinking 块的组件。
		const component = new AssistantMessageComponent(
			createAssistantMessage([
				{ type: "thinking", thinking: "first thought" },
				{ type: "thinking", thinking: "" },
				{ type: "thinking", thinking: "second thought" },
				{ type: "text", text: "answer" },
			]),
			true,
		);
		// 去除 ANSI 后的思考折叠渲染文本。
		const rendered = stripAnsi(component.render(80).join("\n"));

		expect(rendered.match(/Thinking\.\.\./g)).toHaveLength(1);
		expect(rendered).toContain("answer");
	});

	test("uses configured output padding for text and thinking", () => {
		initTheme("dark");

		// outputPad=1 的文本和思考组件。
		const component = new AssistantMessageComponent(
			createAssistantMessage([
				{ type: "text", text: "hello" },
				{ type: "thinking", thinking: "reasoning" },
			]),
			false,
			undefined,
			"Thinking...",
			1,
		);
		// 初始带一列前导空格的渲染行。
		const lines = component.render(80).map((line) => stripAnsi(line));

		expect(lines.some((line) => line.includes(" hello"))).toBe(true);
		expect(lines.some((line) => line.includes(" reasoning"))).toBe(true);

		component.setOutputPad(0);
		// 把 outputPad 改为零后的渲染行。
		const updatedLines = component.render(80).map((line) => stripAnsi(line));
		expect(updatedLines.some((line) => line.startsWith("hello"))).toBe(true);
		expect(updatedLines.some((line) => line.startsWith("reasoning"))).toBe(true);
	});

	test("uses configured output padding for user messages", () => {
		initTheme("dark");

		// outputPad=1 的用户消息组件。
		const paddedComponent = new UserMessageComponent("hello", undefined, 1);
		// 有内边距的用户消息行。
		const paddedLines = paddedComponent.render(40).map((line) => stripAnsi(line));
		expect(paddedLines.some((line) => line.startsWith(" hello"))).toBe(true);

		// outputPad=0 的用户消息组件。
		const unpaddedComponent = new UserMessageComponent("hello", undefined, 0);
		// 无内边距的用户消息行。
		const unpaddedLines = unpaddedComponent.render(40).map((line) => stripAnsi(line));
		expect(unpaddedLines.some((line) => line.startsWith("hello"))).toBe(true);
	});
});
