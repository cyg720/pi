#!/usr/bin/env node
/**
 * Extracts session transcripts for a given cwd, splits into context-sized files,
 * optionally spawns subagents to analyze patterns.
 *
 * Usage: node scripts/session-transcripts.ts [--analyze] [--output <dir>] [cwd]
 *   --analyze      Spawn pi subagents to analyze each transcript file
 *   --output <dir> Output directory for transcript files (defaults to ./session-transcripts)
 *   cwd            Working directory to extract sessions for (defaults to current)
 */
/**
 * 文件职责：导出指定工作目录的 pi 会话记录，按上下文容量拆分文本，并可调用子代理归纳重复指令。
 * 技术维度：使用 Node.js 文件系统、子进程、readline、JSONL 会话解析和 TypeScript 类型描述完成批处理。
 * 产品维度：帮助维护者复盘历史对话、发现可沉淀到 AGENTS.md、技能或提示词模板中的工作习惯。
 * 逻辑维度：解析参数与会话目录，提取用户/助手文本，分片写盘，可选逐片分析并聚合最终报告。
 * 关键边界：分析模式会启动本机 pi 进程并写入输出目录；超大会话不会再切细，格式异常事件会被忽略。
 * 新手阅读建议：先读 main 的导出流程，再看 parseSession 的文本提取，最后理解 runSubagent 的事件流处理。
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { spawn } from "child_process";
import { createInterface } from "node:readline";
import { homedir } from "os";
import { join, resolve } from "path";
import { parseSessionEntries, type SessionMessageEntry } from "../packages/coding-agent/src/core/session-manager.ts";
import chalk from "chalk";

// 单个转录文件的最大字符数，约对应 2 万 Token，并为提示词、分析和输出预留空间。
const MAX_CHARS_PER_FILE = 100_000; // ~20k tokens, leaving room for prompt + analysis + output

/** 将工作目录规范化为 pi 会话目录名。参数 cwd 为目标目录；返回两端带 -- 的目录名。例如：cwdToSessionDir(process.cwd())。 */
function cwdToSessionDir(cwd: string): string {
	/** 解析为绝对路径并把路径分隔符替换为短横线后的值。 */
	const normalized = resolve(cwd).replace(/\//g, "-");
	// 去掉开头的路径分隔符，并用 -- 包住目录标识。
	return `--${normalized.slice(1)}--`; // Remove leading slash, wrap with --
}

/** 从消息内容中提取纯文本。参数 content 可为字符串或内容块数组；返回合并文本，无文本时为空串。例如：extractTextContent(message.content)。 */
function extractTextContent(content: string | Array<{ type: string; text?: string }>): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";

	return content
		.filter((c) => c.type === "text" && c.text)
		.map((c) => c.text!)
		.join("\n");
}

/** 读取并解析单个 JSONL 会话。参数 filePath 为会话文件路径；返回带角色标签的消息列表。例如：parseSession("session.jsonl")。 */
function parseSession(filePath: string): string[] {
	/** 会话文件的完整 UTF-8 文本。 */
	const content = readFileSync(filePath, "utf8");
	/** 由会话管理器解析出的结构化条目。 */
	const entries = parseSessionEntries(content);
	/** 仅收集用户和助手的非空文本消息。 */
	const messages: string[] = [];

	// entry 是会话 JSONL 中当前待筛选和提取文本的条目。
	for (const entry of entries) {
		if (entry.type !== "message") continue;
		/** 已确认类型为 message 的会话条目。 */
		const msgEntry = entry as SessionMessageEntry;
		/** 当前消息的角色与内容。 */
		const { role, content } = msgEntry.message;

		if (role !== "user" && role !== "assistant") continue;

		/** 从当前消息内容块提取出的纯文本。 */
		const text = extractTextContent(content as string | Array<{ type: string; text?: string }>);
		if (!text.trim()) continue;

		messages.push(`[${role.toUpperCase()}]\n${text}`);
	}

	return messages;
}

/** 子代理事件摘要的最大显示宽度，超过时以省略号截断。 */
const MAX_DISPLAY_WIDTH = 100;

/** 将多行文本压成有限宽度的单行摘要。参数 text 为原文，maxWidth 为最大字符数；返回截断后的文本。例如：truncateLine(text, 100)。 */
function truncateLine(text: string, maxWidth: number): string {
	/** 去除换行、重复空白和首尾空格后的单行文本。 */
	const singleLine = text.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
	if (singleLine.length <= maxWidth) return singleLine;
	return singleLine.slice(0, maxWidth - 3) + "...";
}


/** 描述 pi JSON 模式输出的事件形状，仅声明本脚本会读取的字段。 */
interface JsonEvent {
	/** 事件类别，例如 message_update、tool_execution_start 或 turn_end。 */
	type: string;
	/** 助手消息增量事件；非消息更新时缺省。 */
	assistantMessageEvent?: { type: string; delta?: string };
	/** 工具名称；仅工具执行事件提供。 */
	toolName?: string;
	/** read/write 工具可能携带的参数。 */
	args?: {
		/** 被读取或写入的文件路径。 */
		path?: string;
		/** 分块读取的起始偏移。 */
		offset?: number;
		/** 分块读取的最大行数。 */
		limit?: number;
		/** 写入工具的文本内容；本脚本不打印该值。 */
		content?: string;
	};
}

/** 启动一个 pi 子代理执行分析。参数 prompt 为任务提示词、cwd 为子进程目录；返回是否成功退出。例如：await runSubagent(prompt, outputDir)。 */
function runSubagent(prompt: string, cwd: string): Promise<{ success: boolean }> {
	return new Promise((resolve) => {
		/** 以 JSON 事件模式启动的 pi 子进程，仅开放 read/write 工具。 */
		const child = spawn("pi", ["--mode", "json", "--tools", "read,write", "-p", prompt], {
			cwd,
			stdio: ["ignore", "pipe", "pipe"],
		});

		/** 累积尚未打印的助手文本增量，在工具调用或轮次结束时刷新。 */
		let textBuffer = "";

		/** 按行读取子进程标准输出，确保每个 JSON 事件独立解析。 */
		const rl = createInterface({ input: child.stdout });

		rl.on("line", (line) => {
			try {
				/** 当前一行解析出的 pi JSON 事件。 */
				const event: JsonEvent = JSON.parse(line);

				if (event.type === "message_update" && event.assistantMessageEvent) {
					/** 当前助手消息更新事件。 */
					const msgEvent = event.assistantMessageEvent;
					if (msgEvent.type === "text_delta" && msgEvent.delta) {
						textBuffer += msgEvent.delta;
					}
				} else if (event.type === "tool_execution_start" && event.toolName) {
					// Print accumulated text before tool starts
					// 工具开始前先打印已累积的助手文本，保持事件展示顺序。
					if (textBuffer.trim()) {
						console.log(chalk.dim("  " + truncateLine(textBuffer, MAX_DISPLAY_WIDTH)));
						textBuffer = "";
					}
					// Format tool call with args
					// 根据工具类型整理简洁参数，避免输出写入内容等大字段。
					/** 当前工具调用的可读参数摘要。 */
					let argsStr = "";
					if (event.args) {
						if (event.toolName === "read") {
							argsStr = event.args.path || "";
							if (event.args.offset) argsStr += ` offset=${event.args.offset}`;
							if (event.args.limit) argsStr += ` limit=${event.args.limit}`;
						} else if (event.toolName === "write") {
							argsStr = event.args.path || "";
						}
					}
					console.log(chalk.cyan(`  [${event.toolName}] ${argsStr}`));
				} else if (event.type === "turn_end") {
					// Print any remaining text at turn end
					// 轮次结束时打印剩余文本，避免最后一段增量丢失。
					if (textBuffer.trim()) {
						console.log(chalk.dim("  " + truncateLine(textBuffer, MAX_DISPLAY_WIDTH)));
					}
					textBuffer = "";
				}
			} catch {
				// Ignore malformed JSON
				// 忽略非 JSON 或结构异常的输出行，让后续事件继续处理。
			}
		});

		child.stderr.on("data", (data) => {
			process.stderr.write(chalk.red(data.toString()));
		});

		child.on("close", (code) => {
			resolve({ success: code === 0 });
		});

		child.on("error", (err) => {
			console.error(chalk.red(`  Failed to spawn pi: ${err.message}`));
			resolve({ success: false });
		});
	});
}

/** 执行转录导出、可选分析和结果聚合的命令行主流程。无参数；成功时无返回值。例如：await main()。 */
async function main() {
	/** 去掉 node 与脚本路径后的用户参数。 */
	const args = process.argv.slice(2);
	/** 是否启用子代理分析阶段。 */
	const analyzeFlag = args.includes("--analyze");

	// Parse --output <dir>
	// 解析 --output <dir> 输出目录选项。
	/** --output 标记在参数数组中的位置；不存在时为 -1。 */
	const outputIdx = args.indexOf("--output");
	/** 转录与分析结果的输出目录，默认位于当前目录下。 */
	let outputDir = resolve("./session-transcripts");
	if (outputIdx !== -1 && args[outputIdx + 1]) {
		outputDir = resolve(args[outputIdx + 1]);
	}

	// Find cwd (positional arg that's not a flag or flag value)
	// 查找既不是选项也不是选项值的位置参数，将其视为目标工作目录。
	/** 已被命名选项占用的参数下标，避免误判为 cwd。 */
	const flagIndices = new Set<number>();
	flagIndices.add(args.indexOf("--analyze"));
	if (outputIdx !== -1) {
		flagIndices.add(outputIdx);
		flagIndices.add(outputIdx + 1);
	}
	/** 用户提供的可选工作目录位置参数。 */
	const cwdArg = args.find((a, i) => !flagIndices.has(i) && !a.startsWith("--"));
	/** 规范化后的目标工作目录，缺省为当前目录。 */
	const cwd = resolve(cwdArg || process.cwd());

	mkdirSync(outputDir, { recursive: true });
	/** pi 在用户主目录下保存所有会话的根目录。 */
	const sessionsBase = join(homedir(), ".pi/agent/sessions");
	/** 由目标工作目录转换得到的会话子目录名。 */
	const sessionDirName = cwdToSessionDir(cwd);
	/** 本次要扫描的完整会话目录。 */
	const sessionDir = join(sessionsBase, sessionDirName);

	if (!existsSync(sessionDir)) {
		console.error(`No sessions found for ${cwd}`);
		console.error(`Expected: ${sessionDir}`);
		process.exit(1);
	}

	/** 按名称排序后的 JSONL 会话文件列表。 */
	const sessionFiles = readdirSync(sessionDir)
		.filter((f) => f.endsWith(".jsonl"))
		.sort();

	console.log(`Found ${sessionFiles.length} session files in ${sessionDir}`);

	// Collect all transcripts
	// 读取所有会话并收集可导出的用户/助手转录文本。
	/** 每个元素对应一个完整会话的格式化转录。 */
	const allTranscripts: string[] = [];
	for (const file of sessionFiles) {
		/** 当前会话文件的绝对路径。 */
		const filePath = join(sessionDir, file);
		/** 当前会话中可用的用户与助手消息。 */
		const messages = parseSession(filePath);
		if (messages.length > 0) {
			allTranscripts.push(`=== SESSION: ${file} ===\n${messages.join("\n---\n")}\n=== END SESSION ===`);
		}
	}

	if (allTranscripts.length === 0) {
		console.error("No transcripts found");
		process.exit(1);
	}

	// Split into files respecting MAX_CHARS_PER_FILE
	// 在尽量不拆开单个会话的前提下，按最大字符数生成输出分片。
	/** 已写出的转录文件名，后续分析阶段逐个处理。 */
	const outputFiles: string[] = [];
	/** 正在累积、尚未写盘的转录内容。 */
	let currentContent = "";
	/** 下一个输出文件的递增编号，从 0 开始。 */
	let fileIndex = 0;

	for (const transcript of allTranscripts) {
		// If adding this transcript would exceed limit, write current and start new
		// 若加入当前会话会超限，先写出已有分片再开启新分片。
		if (currentContent.length > 0 && currentContent.length + transcript.length + 2 > MAX_CHARS_PER_FILE) {
			/** 当前普通分片的零填充文件名。 */
			const filename = `session-transcripts-${String(fileIndex).padStart(3, "0")}.txt`;
			writeFileSync(join(outputDir, filename), currentContent);
			outputFiles.push(filename);
			console.log(`Wrote ${filename} (${currentContent.length} chars)`);
			currentContent = "";
			fileIndex++;
		}

		// If this single transcript exceeds limit, write it to its own file
		// 单个会话自身超限时独立写盘，避免继续扩大其他分片。
		if (transcript.length > MAX_CHARS_PER_FILE) {
			// Write any pending content first
			// 先写出仍在等待的普通分片，维持文件编号顺序。
			if (currentContent.length > 0) {
				/** 超大会话之前待写普通分片的文件名。 */
				const filename = `session-transcripts-${String(fileIndex).padStart(3, "0")}.txt`;
				writeFileSync(join(outputDir, filename), currentContent);
				outputFiles.push(filename);
				console.log(`Wrote ${filename} (${currentContent.length} chars)`);
				currentContent = "";
				fileIndex++;
			}
			// Write the large transcript to its own file
			// 将超大会话完整写入独立文件，并明确标记 oversized。
			/** 超大会话独占的输出文件名。 */
			const filename = `session-transcripts-${String(fileIndex).padStart(3, "0")}.txt`;
			writeFileSync(join(outputDir, filename), transcript);
			outputFiles.push(filename);
			console.log(chalk.yellow(`Wrote ${filename} (${transcript.length} chars) - oversized`));
			fileIndex++;
			continue;
		}

		currentContent += (currentContent ? "\n\n" : "") + transcript;
	}

	// Write remaining content
	// 循环结束后写出最后一段未满上限的内容。
	if (currentContent.length > 0) {
		/** 最后一份普通分片的文件名。 */
		const filename = `session-transcripts-${String(fileIndex).padStart(3, "0")}.txt`;
		writeFileSync(join(outputDir, filename), currentContent);
		outputFiles.push(filename);
		console.log(`Wrote ${filename} (${currentContent.length} chars)`);
	}

	console.log(`\nCreated ${outputFiles.length} transcript file(s) in ${outputDir}`);

	if (!analyzeFlag) {
		console.log("\nRun with --analyze to spawn pi subagents for pattern analysis.");
		return;
	}

	// Find AGENTS.md files to compare against
	// 查找全局与项目级 AGENTS.md，供分析代理判断规则是否已经存在。
	/** 用户级 AGENTS.md 的约定路径。 */
	const globalAgentsMd = join(homedir(), ".pi/agent/AGENTS.md");
	/** 目标项目根目录中的 AGENTS.md 路径。 */
	const localAgentsMd = join(cwd, "AGENTS.md");
	/** 当前实际存在、需要交给子代理阅读的规则文件。 */
	const agentsMdFiles = [globalAgentsMd, localAgentsMd].filter(existsSync);
	/** 分析提示词中可选的规则文件预读步骤。 */
	const agentsMdSection =
		agentsMdFiles.length > 0
			? `STEP 1: Read the existing AGENTS.md file(s) to see what's already encoded:\n${agentsMdFiles.join("\n")}\n\nSTEP 2: `
			: "";

	// Spawn subagents to analyze each file
	// 为每个转录分片构造统一分析任务，要求完整阅读并输出严格格式。
	/** 单分片分析使用的固定提示词模板。 */
	const analysisPrompt = `You are analyzing session transcripts to identify recurring user instructions that could be automated.

${agentsMdSection}READING THE TRANSCRIPT:
The transcript file is large. Read it in chunks of 1000 lines using offset/limit parameters:
1. First: read with limit=1000 (lines 1-1000)
2. Then: read with offset=1001, limit=1000 (lines 1001-2000)
3. Continue incrementing offset by 1000 until you reach the end
4. Only after reading the ENTIRE file, perform the analysis and write the summary

ANALYSIS TASK:
Look for patterns where the user repeatedly gives similar instructions. These could become:
- AGENTS.md entries: coding style rules, behavior guidelines, project conventions
- Skills: multi-step workflows with external tools (search, browser, APIs)
- Prompt templates: reusable prompts for common tasks

Compare each pattern against the existing AGENTS.md content to determine if it's NEW or EXISTING.

OUTPUT FORMAT (strict):
Write a file with exactly this structure. Use --- as separator between patterns.

PATTERN: <short descriptive name>
STATUS: NEW | EXISTING
TYPE: agents-md | skill | prompt-template
FREQUENCY: <number of times observed>
EVIDENCE:
- "<exact quote 1>"
- "<exact quote 2>"
- "<exact quote 3>"
DRAFT:
<proposed content for AGENTS.md entry, SKILL.md, or prompt template>
---

Rules:
- Only include patterns that appear 2+ times
- STATUS is NEW if not in AGENTS.md, EXISTING if already covered
- EVIDENCE must contain exact quotes from the transcripts
- DRAFT must be ready-to-use content
- If no patterns found, write "NO PATTERNS FOUND"
- Do not include any other text outside this format`;

	console.log("\nSpawning subagents for analysis...");
	for (const file of outputFiles) {
		/** 当前分片对应的分析摘要文件名。 */
		const summaryFile = file.replace(".txt", ".summary.txt");
		/** 当前待分析转录分片的完整路径。 */
		const filePath = join(outputDir, file);
		/** 子代理必须写入的摘要完整路径。 */
		const summaryPath = join(outputDir, summaryFile);

		/** 当前转录文件文本，用于统计规模与行数。 */
		const fileContent = readFileSync(filePath, "utf8");
		/** 当前转录文件的字符数。 */
		const fileSize = fileContent.length;

		console.log(`Analyzing ${file} (${fileSize} chars)...`);

		/** 当前转录文件的行数，提示代理按块完整读取。 */
		const lineCount = fileContent.split("\n").length;
		/** 注入具体文件、行数与输出路径后的完整任务提示词。 */
		const fullPrompt = `${analysisPrompt}\n\nThe file ${filePath} has ${lineCount} lines. Read it in full using chunked reads, then write your analysis to ${summaryPath}`;

		/** 当前子代理的执行结果。 */
		const result = await runSubagent(fullPrompt, outputDir);

		if (result.success && existsSync(summaryPath)) {
			console.log(chalk.green(`  -> ${summaryFile}`));
		} else if (result.success) {
			console.error(chalk.yellow(`  Agent finished but did not write ${summaryFile}`));
		} else {
			console.error(chalk.red(`  Failed to analyze ${file}`));
		}
	}

	// Collect all created summary files
	// 收集分析阶段实际生成的摘要，避免聚合不存在的文件。
	/** 按名称排序后的单分片摘要文件列表。 */
	const summaryFiles = readdirSync(outputDir)
		.filter((f) => f.endsWith(".summary.txt"))
		.sort();

	console.log(`\n=== Individual Analysis Complete ===`);
	console.log(`Created ${summaryFiles.length} summary files`);

	if (summaryFiles.length === 0) {
		console.log(chalk.yellow("No summary files created. Nothing to aggregate."));
		return;
	}

	// Final aggregation step
	// 启动最后一次代理任务，合并重复模式并重新核验现有规则。
	console.log("\nAggregating findings into final summary...");

	/** 供聚合代理逐个读取的摘要文件路径清单。 */
	const summaryPaths = summaryFiles.map((f) => join(outputDir, f)).join("\n");
	/** 最终聚合报告的目标路径。 */
	const finalSummaryPath = join(outputDir, "FINAL-SUMMARY.txt");

	/** 描述去重、排序、状态复核和输出格式的聚合提示词。 */
	const aggregationPrompt = `You are aggregating pattern analysis results from multiple summary files.

STEP 1: Read the existing AGENTS.md file(s) to understand what patterns are already encoded:
${agentsMdFiles.length > 0 ? agentsMdFiles.join("\n") : "(no AGENTS.md files found)"}

STEP 2: Read ALL of the following summary files:
${summaryPaths}

STEP 3: Create a consolidated final summary that:
1. Merges duplicate patterns (same pattern found in multiple files)
2. Ranks patterns by total frequency across all files
3. Groups by status (NEW first, then EXISTING) and type
4. Provides the best/most complete DRAFT for each unique pattern
5. Verify STATUS against AGENTS.md content (pattern may be marked NEW in summaries but actually exists)

OUTPUT FORMAT (strict):
Write the final summary with this structure:

# NEW PATTERNS (not yet in AGENTS.md)

## AGENTS.MD: <pattern name>
Total Frequency: <sum across all files>
Evidence:
- "<best quotes>"
Draft:
<consolidated draft>

## SKILL: <pattern name>
...

## PROMPT-TEMPLATE: <pattern name>
...

---

# EXISTING PATTERNS (already in AGENTS.md, for reference)

## <pattern name>
Total Frequency: <N>
Already covered by: <quote relevant section from AGENTS.md>

---

# SUMMARY
- New patterns to add: <N>
- Already covered: <N>
- Top 3 new patterns by frequency: <list>

Write the final summary to ${finalSummaryPath}`;

	/** 聚合子代理的执行结果。 */
	const aggregateResult = await runSubagent(aggregationPrompt, outputDir);

	if (aggregateResult.success && existsSync(finalSummaryPath)) {
		console.log(chalk.green(`\n=== Final Summary Created ===`));
		console.log(chalk.green(`  ${finalSummaryPath}`));
	} else if (aggregateResult.success) {
		console.error(chalk.yellow(`Agent finished but did not write final summary`));
	} else {
		console.error(chalk.red(`Failed to create final summary`));
	}
}

// 捕获入口异步错误并输出，避免未处理的 Promise 拒绝。
main().catch(console.error);
