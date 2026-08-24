/**
 * Simple chat interface demo using tui.ts
 */
/**
 * 文件职责：演示用 TUI 组件构建带命令、自动补全和模拟机器人回复的简单聊天界面。
 * 技术维度：使用 ProcessTerminal、Editor、Markdown、Loader、Text 和 setTimeout 异步更新。
 * 产品维度：为新手提供可直接运行的终端聊天组件组合示例。
 * 逻辑维度：创建界面与编辑器，处理 delete/clear 命令，提交消息后显示加载器和随机回复。
 * 关键边界：这是交互演示而非自动测试；回复为本地随机文本，Ctrl+C 由终端流程处理。
 * 新手阅读建议：先看组件创建和 children 顺序，再读 onSubmit 的命令分支与异步回复。
 */

import chalk from "chalk";
import { CombinedAutocompleteProvider } from "../src/autocomplete.ts";
import { Editor } from "../src/components/editor.ts";
import { Loader } from "../src/components/loader.ts";
import { Markdown } from "../src/components/markdown.ts";
import { Text } from "../src/components/text.ts";
import { ProcessTerminal } from "../src/terminal.ts";
import { TUI } from "../src/tui.ts";
import { defaultEditorTheme, defaultMarkdownTheme } from "./test-themes.ts";

// Create terminal

// 创建真实进程终端。
// terminal 是 TUI 的输入输出适配器。
const terminal = new ProcessTerminal();

// Create TUI

// 创建终端界面。
// tui 管理所有聊天组件和焦点。
const tui = new TUI(terminal);

// Create chat container with some initial messages

// 添加欢迎与使用提示文本。
tui.addChild(
	new Text("Welcome to Simple Chat!\n\nType your messages below. Type '/' for commands. Press Ctrl+C to exit."),
);

// Create editor with autocomplete

// 创建带默认主题的输入编辑器。
// editor 接收用户文本和自动补全。
const editor = new Editor(tui, defaultEditorTheme);

// Set up autocomplete provider with slash commands and file completion

// 配置斜杠命令与文件路径自动补全。
// autocompleteProvider 提供 delete、clear 和当前目录文件候选。
const autocompleteProvider = new CombinedAutocompleteProvider(
	[
		{ name: "delete", description: "Delete the last message" },
		{ name: "clear", description: "Clear all messages" },
	],
	process.cwd(),
);
editor.setAutocompleteProvider(autocompleteProvider);

tui.addChild(editor);

// Focus the editor

// 把键盘焦点交给编辑器。
tui.setFocus(editor);

// Track if we're waiting for bot response

// isResponding 标记是否正在等待模拟回复，防止重复提交。
let isResponding = false;

// Handle message submission

// value 是用户提交的原始文本；回调处理命令或创建聊天消息。
editor.onSubmit = (value: string) => {
	// Prevent submission if already responding
	// 等待回复期间拒绝再次提交。
	if (isResponding) {
		return;
	}

	// trimmed 是去除首尾空白后的命令判断文本。
	const trimmed = value.trim();

	// Handle slash commands
	// 处理内置斜杠命令。
	if (trimmed === "/delete") {
		// children 是当前界面的可变组件数组。
		const children = tui.children;
		// Remove component before editor (if there are any besides the initial text)
		// 删除编辑器前最后一条消息，但保留初始文本。
		if (children.length > 3) {
			// children[0] = "Welcome to Simple Chat!"
			// children[0] 是欢迎文本。
			// children[1] = "Type your messages below..."
			// children[2...n-1] = messages
			// children[n] = editor
			children.splice(children.length - 2, 1);
		}
		tui.requestRender();
		return;
	}

	if (trimmed === "/clear") {
		// children 是待批量删除消息的组件数组。
		const children = tui.children;
		// Remove all messages but keep the welcome text and editor
		// 删除全部消息但保留欢迎文本和编辑器。
		children.splice(2, children.length - 3);
		tui.requestRender();
		return;
	}

	if (trimmed) {
		isResponding = true;
		editor.disableSubmit = true;

		// userMessage 是用户输入的 Markdown 展示组件。
		const userMessage = new Markdown(value, 1, 1, defaultMarkdownTheme);

		// children 是聊天组件数组，用于在编辑器前插入消息。
		const children = tui.children;
		children.splice(children.length - 1, 0, userMessage);

		// loader 是等待模拟回复时显示的 Thinking 动画。
		const loader = new Loader(
			tui,
			// s 是加载动画文本，分别应用青色和暗色样式。
			(s) => chalk.cyan(s),
			(s) => chalk.dim(s),
			"Thinking...",
		);
		children.splice(children.length - 1, 0, loader);

		tui.requestRender();

		// 一秒后移除加载器并插入随机回复。
		setTimeout(() => {
			tui.removeChild(loader);

			// Simulate a response
			// 模拟机器人回复。
			// responses 是本地候选回复列表。
			const responses = [
				"That's interesting! Tell me more.",
				"I see what you mean.",
				"Fascinating perspective!",
				"Could you elaborate on that?",
				"That makes sense to me.",
				"I hadn't thought of it that way.",
				"Great point!",
				"Thanks for sharing that.",
			];
			// randomResponse 是随机选择的一条回复。
			const randomResponse = responses[Math.floor(Math.random() * responses.length)];

			// Add assistant message with no background (transparent)
			// 添加无背景的助手 Markdown 消息。
			// botMessage 是模拟回复的展示组件。
			const botMessage = new Markdown(randomResponse, 1, 1, defaultMarkdownTheme);
			children.splice(children.length - 1, 0, botMessage);

			// Re-enable submit
			// 重新允许提交。
			isResponding = false;
			editor.disableSubmit = false;

			// Request render
			// 请求重绘最终聊天状态。
			tui.requestRender();
		}, 1000);
	}
};

// Start the TUI

// 启动交互界面。
tui.start();
