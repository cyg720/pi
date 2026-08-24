#!/usr/bin/env node
/**
 * 文件职责：在 Windows 上复现并验证第 5893 号问题中的 WSL Bash 变量展开行为。
 * 技术维度：使用 Node.js ESM、编码代理 Bash 工具和 Windows bash.exe 启动 WSL 命令。
 * 产品维度：保证 Windows 用户通过 WSL 执行含变量和循环的 Bash 命令时输出不被错误改写。
 * 逻辑维度：检查平台与启动器，运行简单变量和循环两个案例，逐字比较期望输出。
 * 关键边界：只能从 Windows PowerShell/CMD 运行且必须启用 WSL；不适用于原生 Linux/macOS。
 * 新手阅读建议：先看三个延迟拼接的变量展开文本，再阅读 runCase 的执行与比较流程。
 */
import { existsSync } from "node:fs";
import { createBashTool } from "../packages/coding-agent/src/core/tools/bash.ts";

/** Windows 系统内置的 WSL Bash 启动器路径。 */
const shellPath = "C:\\Windows\\System32\\bash.exe";
/** 运行时拼成 `${name}` 的 Bash 变量引用，避免 JavaScript 模板提前展开。 */
const nameExpansion = "$" + "{name}";
/** 运行时拼成 `${count}` 的 Bash 变量引用。 */
const countExpansion = "$" + "{count}";
/** 运行时拼成 `${i}` 的循环变量引用。 */
const iExpansion = "$" + "{i}";

/**
 * 提取 Bash 工具结果中的文本块。
 * @param result Bash 工具返回的结果对象。
 * @returns 所有文本内容以换行连接的字符串。
 * @example `getTextOutput(await tool.execute(...))`。
 */
function getTextOutput(result) {
	return result.content
		// content 是一个结果内容块，只保留文本类型。
		.filter((content) => content.type === "text")
		// content.text 缺失时用空字符串代替。
		.map((content) => content.text ?? "")
		.join("\n");
}

/**
 * 运行一个 WSL Bash 复现案例并严格核对输出。
 * @param label 工具调用和错误提示使用的案例名称。
 * @param command 要交给 WSL Bash 的命令。
 * @param expectedOutput 去除末尾换行后的期望文本。
 * @returns 命令验证完成后的 Promise。
 * @example `await runCase("echo", "echo ok", "ok")`。
 */
async function runCase(label, command, expectedOutput) {
	/** 固定使用 WSL 启动器的 Bash 工具。 */
	const tool = createBashTool(process.cwd(), { shellPath });
	/** Bash 工具执行结果。 */
	const result = await tool.execute(label, { command });
	/** 去除末尾空白行后的实际文本输出。 */
	const output = getTextOutput(result).trimEnd();
	if (output !== expectedOutput) {
		throw new Error(
			[
				`${label} failed`,
				"Expected:",
				expectedOutput,
				"Actual:",
				output,
			].join("\n"),
		);
	}
	console.log(output);
}

if (process.platform !== "win32") {
	throw new Error("This repro must run from Windows PowerShell/CMD, not macOS/Linux or inside WSL.");
}

if (!existsSync(shellPath)) {
	throw new Error(`WSL bash launcher not found at ${shellPath}. Install/enable WSL first.`);
}

await runCase(
	"issue-5893-simple-variable",
	`name='World'; echo "Hello, ${nameExpansion}!"`,
	"Hello, World!",
);

await runCase(
	"issue-5893-loop-variable",
	`count=3; for i in $(seq 1 ${countExpansion}); do echo "Iteration ${iExpansion} of ${countExpansion}"; done`,
	"Iteration 1 of 3\nIteration 2 of 3\nIteration 3 of 3",
);

console.log("issue #5893 WSL bash repro passed");
