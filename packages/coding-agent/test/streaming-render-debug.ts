/**
 * Debug script to reproduce streaming rendering issues.
 * Uses real fixture data that caused the bug.
 * Run with: npx tsx test/streaming-render-debug.ts
 */
/**
 * 文件职责：用真实缺陷夹具手工复现助手思考内容流式渲染问题。
 * 技术维度：使用 ProcessTerminal、TUI、AssistantMessageComponent 和定时分块更新模拟令牌流。
 * 产品维度：帮助开发者直观看到思考块与最终文本在真实终端中的增量布局表现。
 * 逻辑维度：加载夹具，提取思考和文本，逐块更新组件，最后追加文本并停留观察。
 * 关键边界：这是交互调试脚本而非自动断言测试；会占用真实终端约数秒并主动退出进程。
 * 新手阅读建议：先看夹具提取，再看 main 中空消息、思考循环和最终消息三个阶段。
 */

import type { AssistantMessage } from "@earendil-works/pi-ai";
import { ProcessTerminal, TUI } from "@earendil-works/pi-tui";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { AssistantMessageComponent } from "../src/modes/interactive/components/assistant-message.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";

// __filename 是当前 ESM 调试脚本的绝对文件路径。
const __filename = fileURLToPath(import.meta.url);
// __dirname 是脚本目录，用于定位 fixtures 子目录。
const __dirname = dirname(__filename);

// Initialize dark theme with full color support

// 以完整真彩色能力初始化深色主题。
process.env.COLORTERM = "truecolor";
initTheme("dark");

// Load the real fixture that caused the bug

// 加载曾触发缺陷的真实助手消息夹具。
// fixtureMessage 是从 JSON 文件解析的完整助手消息。
const fixtureMessage: AssistantMessage = JSON.parse(
	readFileSync(join(__dirname, "fixtures/assistant-message-with-thinking-code.json"), "utf-8"),
);

// Extract thinking and text content

// 分别提取思考块和文本块。
// thinkingContent 是夹具中的首个思考内容块。
const thinkingContent = fixtureMessage.content.find((c) => c.type === "thinking");
// textContent 是夹具中的首个文本内容块。
const textContent = fixtureMessage.content.find((c) => c.type === "text");

if (!thinkingContent || thinkingContent.type !== "thinking") {
	console.error("No thinking content in fixture");
	process.exit(1);
}

// fullThinkingText 是经过类型收窄后的完整思考文本。
const fullThinkingText = thinkingContent.thinking;
// fullTextContent 是可选文本块内容，缺失时使用空字符串。
const fullTextContent = textContent && textContent.type === "text" ? textContent.text : "";

/**
 * 异步等待指定毫秒数。
 * 参数：ms 为等待时长。
 * 返回值：计时结束后解决的 Promise。
 * 使用示例：`await sleep(15)`。
 */
async function sleep(ms: number): Promise<void> {
	// resolve 是计时器结束时完成 Promise 的回调。
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 运行完整的终端流式渲染演示。
 * 参数：无。
 * 返回值：演示结束时解决的 Promise，随后退出进程。
 * 使用示例：文件末尾调用 `main().catch(console.error)`。
 */
async function main() {
	// terminal 是连接当前进程标准输入输出的真实终端适配器。
	const terminal = new ProcessTerminal();
	// tui 是承载助手消息组件的终端界面。
	const tui = new TUI(terminal);

	// Start with empty message
	// 从只含空思考块的助手消息开始。
	// message 是流式更新前的初始助手消息。
	const message = {
		role: "assistant",
		content: [{ type: "thinking", thinking: "" }],
	} as AssistantMessage;

	// component 负责把助手消息转换为终端渲染行。
	const component = new AssistantMessageComponent(message, false);
	tui.addChild(component);
	tui.start();

	// Simulate streaming thinking content
	// 模拟思考内容按令牌流式到达。
	// thinkingBuffer 累积已经到达的思考文本。
	let thinkingBuffer = "";
	// chunkSize 是每个模拟令牌包含的字符数。
	const chunkSize = 10; // characters per "token"

	// i 是当前思考文本分块的起始字符索引。
	for (let i = 0; i < fullThinkingText.length; i += chunkSize) {
		thinkingBuffer += fullThinkingText.slice(i, i + chunkSize);

		// Update message content
		// 用当前缓冲区更新助手消息内容。
		// updatedMessage 是本轮增量渲染使用的助手消息快照。
		const updatedMessage = {
			role: "assistant",
			content: [{ type: "thinking", thinking: thinkingBuffer }],
		} as AssistantMessage;

		component.updateContent(updatedMessage);
		tui.requestRender();

		await sleep(15); // Simulate token delay
		// 等待 15 毫秒模拟令牌到达间隔。
	}

	// Now add the text content
	// 思考流结束后再加入最终文本内容。
	await sleep(500);

	// finalMessage 同时包含完整思考块和最终文本块。
	const finalMessage = {
		role: "assistant",
		content: [
			{ type: "thinking", thinking: fullThinkingText },
			{ type: "text", text: fullTextContent },
		],
	} as AssistantMessage;

	component.updateContent(finalMessage);
	tui.requestRender();

	// Keep alive for a moment to see the result
	// 短暂停留，便于人工观察最终渲染结果。
	await sleep(3000);

	tui.stop();
	process.exit(0);
}

main().catch(console.error);
