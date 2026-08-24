#!/usr/bin/env node
/**
 * 文件职责：按本地自然日统计指定项目会话中的令牌、费用、助手消息数和独立会话数。
 * 技术维度：使用 Node.js 文件系统/路径 API、JSONL 解析、Map/Set 聚合和本地日期边界生成控制台报表。
 * 产品维度：帮助用户从项目、日期和提供商三个层级了解模型使用量与成本趋势。
 * 逻辑维度：解析参数并定位编码会话目录，逐条累计日/提供商/总计，最后按日期和提供商排序输出。
 * 关键边界：只统计有效助手消息；日期按本地时区计算；损坏 JSONL 行跳过；days 必须为正整数。
 * 新手阅读建议：先看 Totals/DayStats，再跟随 addUsage 在三个聚合对象上的调用，最后阅读输出循环。
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

// UsageCost 描述消息用量中的可选费用分项。
interface UsageCost {
	input?: number;
	output?: number;
	cacheRead?: number;
	cacheWrite?: number;
	total?: number;
}

// Usage 描述历史会话可能包含的不完整令牌与费用字段。
interface Usage {
	input?: number;
	output?: number;
	cacheRead?: number;
	cacheWrite?: number;
	totalTokens?: number;
	cost?: UsageCost;
}

// AssistantMessage 是统计器实际读取的助手消息字段子集。
interface AssistantMessage {
	role?: string;
	provider?: string;
	usage?: Usage;
	timestamp?: number;
}

// SessionEntry 描述 JSONL 中可能出现的消息条目最小结构。
interface SessionEntry {
	type?: string;
	timestamp?: string;
	message?: AssistantMessage;
}

// Totals 保存令牌、费用、消息数和参与统计的会话文件集合。
interface Totals {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	totalTokens: number;
	costInput: number;
	costOutput: number;
	costCacheRead: number;
	costCacheWrite: number;
	costTotal: number;
	assistantMessages: number;
	sessions: Set<string>;
}

// DayStats 在一天总计之外，按提供商维护次级统计。
interface DayStats extends Totals {
	providers: Map<string, Totals>;
}

// Args 是校验并规范化后的命令行参数。
interface Args {
	days: number;
	cwd: string;
	sessionsBase: string;
}

/** 创建所有数值为 0、会话集合为空的统计对象；无参数；返回 Totals。 */
function createTotals(): Totals {
	return {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 0,
		costInput: 0,
		costOutput: 0,
		costCacheRead: 0,
		costCacheWrite: 0,
		costTotal: 0,
		assistantMessages: 0,
		sessions: new Set<string>(),
	};
}

/** 创建带空提供商 Map 的每日统计；无参数；返回 DayStats。 */
function createDayStats(): DayStats {
	return {
		...createTotals(),
		providers: new Map<string, Totals>(),
	};
}

/** 把一次助手用量累加到统计对象；参数 totals/usage/sessionFile 为目标、用量和会话名；无返回值。 */
function addUsage(totals: Totals, usage: Usage, sessionFile: string): void {
	// cost 在历史消息缺少费用字段时使用空对象，从而各分项按 0 处理。
	const cost = usage.cost ?? {};
	totals.input += usage.input ?? 0;
	totals.output += usage.output ?? 0;
	totals.cacheRead += usage.cacheRead ?? 0;
	totals.cacheWrite += usage.cacheWrite ?? 0;
	totals.totalTokens += usage.totalTokens ?? 0;
	totals.costInput += cost.input ?? 0;
	totals.costOutput += cost.output ?? 0;
	totals.costCacheRead += cost.cacheRead ?? 0;
	totals.costCacheWrite += cost.cacheWrite ?? 0;
	totals.costTotal += cost.total ?? 0;
	totals.assistantMessages += 1;
	totals.sessions.add(sessionFile);
}

/** 编码项目 cwd 为 pi 会话目录名；参数 cwd 为路径；返回 `--...--` 名称。 */
function encodeSessionDir(cwd: string): string {
	// normalized 去掉 POSIX 路径开头斜杠，避免目录名多一个连字符。
	const normalized = cwd.startsWith("/") ? cwd.slice(1) : cwd;
	return `--${normalized.replace(/\//g, "-")}--`;
}

/** 把 Date 格式化为本地 YYYY-MM-DD 键；参数 date 为时间；返回日期字符串。 */
function localDayKey(date: Date): string {
	// year 是本地时区年份。
	const year = date.getFullYear();
	// month 是补零后的本地月份。
	const month = String(date.getMonth() + 1).padStart(2, "0");
	// day 是补零后的本地日期。
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/** 解析并校验命令行选项；无参数；返回天数、项目 cwd 和会话根目录。 */
function parseArgs(): Args {
	// args 是去掉运行时和脚本名后的参数数组。
	const args = process.argv.slice(2);
	// days 默认统计最近 7 个本地自然日。
	let days = 7;
	// cwd 默认使用脚本启动目录。
	let cwd = process.cwd();
	// sessionsBase 默认指向用户 pi 会话根目录。
	let sessionsBase = join(homedir(), ".pi", "agent", "sessions");

	for (let i = 0; i < args.length; i++) {
		// arg 是当前待解析的命令行标记。
		const arg = args[i];
		if ((arg === "--days" || arg === "-n") && args[i + 1]) {
			days = Number.parseInt(args[++i], 10);
		} else if ((arg === "--cwd" || arg === "--dir" || arg === "-d") && args[i + 1]) {
			cwd = resolve(args[++i]);
		} else if (arg === "--sessions-base" && args[i + 1]) {
			sessionsBase = resolve(args[++i]);
		} else if (arg === "--help" || arg === "-h") {
			console.log(`Usage: scripts/stats.ts [options]

Options:
  -n, --days <days>         Number of local calendar days to include (default: 7)
  -d, --dir, --cwd <path>   Project cwd to inspect (default: current cwd)
  --sessions-base <path>    Sessions base directory (default: ~/.pi/agent/sessions)
  -h, --help                Show this help`);
			process.exit(0);
		}
	}

	if (!Number.isInteger(days) || days <= 0) {
		throw new Error("--days must be a positive integer");
	}

	return { days, cwd: resolve(cwd), sessionsBase };
}

/** 把令牌数四舍五入并按英文千位分隔格式化；参数 value 为数值；返回字符串。 */
function formatInt(value: number): string {
	return Math.round(value).toLocaleString("en-US");
}

/** 把美元费用格式化为四位小数；参数 value 为费用；返回 `$0.0000` 形式。 */
function formatCost(value: number): string {
	return `$${value.toFixed(4)}`;
}

/** 输出一行固定宽度统计；参数 label 为行名、totals 为数据；无返回值。 */
function printTotals(label: string, totals: Totals): void {
	console.log(
		`${label.padEnd(16)} messages: ${String(totals.assistantMessages).padStart(5)}  sessions: ${String(totals.sessions.size).padStart(3)}  ` +
			`input: ${formatInt(totals.input).padStart(12)}  output: ${formatInt(totals.output).padStart(10)}  ` +
			`cache read: ${formatInt(totals.cacheRead).padStart(13)}  cache write: ${formatInt(totals.cacheWrite).padStart(10)}  ` +
			`total: ${formatInt(totals.totalTokens).padStart(13)}  cost: ${formatCost(totals.costTotal).padStart(10)}`,
	);
}

// days、cwd、sessionsBase 是解析后的最终运行参数。
const { days, cwd, sessionsBase } = parseArgs();
// sessionsDir 是目标项目编码后的具体会话目录。
const sessionsDir = join(sessionsBase, encodeSessionDir(cwd));

if (!existsSync(sessionsDir)) {
	throw new Error(`Sessions directory not found: ${sessionsDir}`);
}

// now 是计算本地日期区间的当前时间。
const now = new Date();
// start 是纳入统计的最早本地日期零点。
const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
start.setDate(start.getDate() - days + 1);
// end 是今天之后一天的本地零点，作为排他上界。
const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

// stats 按 YYYY-MM-DD 保存每日统计。
const stats = new Map<string, DayStats>();
// grandTotal 跨全部日期和提供商累加总计。
const grandTotal = createTotals();

for (const file of readdirSync(sessionsDir)) {
	if (!file.endsWith(".jsonl")) continue;

	// path 是当前 JSONL 会话文件完整路径。
	const path = join(sessionsDir, file);
	// lines 是会话文件按换行拆分后的条目文本。
	const lines = readFileSync(path, "utf8").split("\n");
	for (const line of lines) {
		if (!line.trim()) continue;

		// entry 保存解析后的松散会话条目。
		let entry: SessionEntry;
		try {
			entry = JSON.parse(line) as SessionEntry;
		} catch {
			continue;
		}

		if (entry.type !== "message" || entry.message?.role !== "assistant" || !entry.message.usage) continue;

		// timestamp 优先使用助手消息时间，否则回退到条目 ISO 时间。
		const timestamp = entry.message.timestamp !== undefined ? new Date(entry.message.timestamp) : new Date(entry.timestamp ?? 0);
		if (timestamp < start || timestamp >= end) continue;

		// dayKey 是消息所在本地日期的聚合键。
		const dayKey = localDayKey(timestamp);
		// dayStats 是该日期已有或即将创建的统计对象。
		let dayStats = stats.get(dayKey);
		if (!dayStats) {
			dayStats = createDayStats();
			stats.set(dayKey, dayStats);
		}

		// provider 缺失时归入 unknown，避免丢弃有效用量。
		const provider = entry.message.provider ?? "unknown";
		// providerStats 是当天该提供商的统计对象。
		let providerStats = dayStats.providers.get(provider);
		if (!providerStats) {
			providerStats = createTotals();
			dayStats.providers.set(provider, providerStats);
		}

		addUsage(dayStats, entry.message.usage, file);
		addUsage(providerStats, entry.message.usage, file);
		addUsage(grandTotal, entry.message.usage, file);
	}
}

console.log(`Usage for ${cwd}`);
console.log(`Sessions: ${sessionsDir}`);
console.log(`Period: ${localDayKey(start)} through ${localDayKey(new Date(end.getTime() - 1))} (${days} local days)`);
console.log("".padEnd(160, "="));

for (const day of [...stats.keys()].sort()) {
	// dayStats 是当前输出日期的汇总和提供商细分。
	const dayStats = stats.get(day)!;
	printTotals(day, dayStats);
	for (const provider of [...dayStats.providers.keys()].sort()) {
		printTotals(`  ${provider}`, dayStats.providers.get(provider)!);
	}
}

console.log("".padEnd(160, "-"));
printTotals("TOTAL", grandTotal);
