/**
 * 文件职责：演示如何通过 RpcClient 启动 coding-agent、监听事件并构建交互式命令行。
 * 技术维度：使用 Node readline、RPC 客户端、异步事件回调和标准输入输出实现示例程序。
 * 产品维度：帮助扩展开发者把编码代理嵌入自己的进程，并处理消息、工具与中断事件。
 * 逻辑维度：创建客户端并监听事件，启动后读取状态，再循环接收输入直到退出或中断。
 * 关键边界：依赖已构建的 dist/cli.js 和 Anthropic 配置；直接运行可能访问真实服务。
 * 新手阅读建议：先看 RpcClient 配置，再看 onEvent 的事件分类，最后读 readline 生命周期。
 */
import { dirname, join } from "node:path";
import * as readline from "node:readline";
import { fileURLToPath } from "node:url";
import { RpcClient } from "../src/modes/rpc/rpc-client.ts";

// __dirname 是当前 ESM 示例文件所在目录，用于构造 CLI 的绝对路径。
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Interactive example of using coding-agent via RpcClient.
 * Usage: npx tsx test/rpc-example.ts
 */
/**
 * 这是通过 RpcClient 使用 coding-agent 的交互示例。
 * 用法：`npx tsx test/rpc-example.ts`。
 */

/**
 * 启动 RPC 客户端并运行交互式输入循环。
 * 参数：无。
 * 返回值：程序退出或发生错误时解决的 Promise。
 * 使用示例：文件末尾通过 `main().catch(console.error)` 调用。
 */
async function main() {
	// client 管理 coding-agent 子进程、RPC 请求与事件订阅。
	const client = new RpcClient({
		cliPath: join(__dirname, "../dist/cli.js"),
		provider: "anthropic",
		model: "claude-sonnet-4-20250514",
		args: ["--no-session"],
	});

	// Stream events to console
	// 将 RPC 流事件实时输出到控制台。
	// event 是当前 RPC 事件，按消息增量和工具生命周期分类处理。
	client.onEvent((event) => {
		if (event.type === "message_update") {
			// assistantMessageEvent 是当前助手消息的细粒度流事件。
			const { assistantMessageEvent } = event;
			if (assistantMessageEvent.type === "text_delta" || assistantMessageEvent.type === "thinking_delta") {
				process.stdout.write(assistantMessageEvent.delta);
			}
		}

		if (event.type === "tool_execution_start") {
			console.log(`\n[Tool: ${event.toolName}]`);
		}

		if (event.type === "tool_execution_end") {
			console.log(`[Result: ${JSON.stringify(event.result).slice(0, 200)}...]\n`);
		}
	});

	await client.start();

	// state 是代理启动后的模型和思考级别快照。
	const state = await client.getState();
	console.log(`Model: ${state.model?.provider}/${state.model?.id}`);
	console.log(`Thinking: ${state.thinkingLevel ?? "off"}\n`);

	// Handle user input
	// 处理用户逐行输入。
	// rl 负责读取终端行输入并接收 Ctrl+C 信号。
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		terminal: true,
	});

	// isWaiting 标记代理是否正在处理上一条输入，避免并发提交。
	let isWaiting = false;

	/** 无等待任务时显示输入提示；无参数，无返回值，示例：`prompt()`。 */
	const prompt = () => {
		if (!isWaiting) process.stdout.write("You: ");
	};

	// line 是用户提交的一整行文本；回调处理退出命令或发送提示词。
	rl.on("line", async (line) => {
		if (isWaiting) return;
		if (line.trim() === "exit") {
			await client.stop();
			process.exit(0);
		}

		isWaiting = true;
		await client.promptAndWait(line);
		console.log("\n");
		isWaiting = false;
		prompt();
	});

	// SIGINT 回调在等待时中止当前请求，空闲时停止客户端并退出程序。
	rl.on("SIGINT", () => {
		if (isWaiting) {
			console.log("\n[Aborting...]");
			client.abort();
		} else {
			client.stop();
			process.exit(0);
		}
	});

	console.log("Interactive RPC example. Type 'exit' to quit.\n");
	prompt();
}

main().catch(console.error);
