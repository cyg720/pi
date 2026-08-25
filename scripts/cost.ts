#!/usr/bin/env node
/**
 * 文件职责：读取指定项目最近若干天的 JSONL 会话记录，按日期和提供商汇总模型调用费用。
 * 技术维度：使用 Node.js 文件系统与路径 API、逐行 JSON 解析、日期过滤和控制台表格化文本输出。
 * 产品维度：帮助用户了解项目级 AI 使用成本、请求次数以及输入、输出和缓存费用构成。
 * 逻辑维度：解析参数并定位会话目录，过滤日期范围，累加每日数据，最后输出每日与提供商总计。
 * 关键边界：要求 HOME、目录和天数参数有效；格式错误的单行会被跳过；只统计带 usage.cost 的助手消息。
 * 新手阅读建议：先看 DayCost/Stats 数据结构，再跟随单条 JSONL 消息如何进入 stats 和最终报表。
 */

import * as fs from "fs";
import * as path from "path";

// Parse args
// 解析命令行参数，支持目录、天数和帮助选项。
// args 是去掉 node 与脚本名后的原始参数数组。
const args = process.argv.slice(2);
// directory 保存用户要统计的项目目录，解析前未定义。
let directory: string | undefined;
// days 保存向前统计的自然日数量，必须为可解析整数。
let days: number | undefined;

// i 是当前参数索引；带值选项会在分支内额外递增一次。
for (let i = 0; i < args.length; i++) {
	if (args[i] === "--dir" || args[i] === "-d") {
		directory = args[++i];
	} else if (args[i] === "--days" || args[i] === "-n") {
		days = parseInt(args[++i], 10);
	} else if (args[i] === "--help" || args[i] === "-h") {
		console.log(`Usage: cost.ts -d <path> -n <days>
  -d, --dir <path>   Directory path (required)
  -n, --days <num>   Number of days to track (required)
  -h, --help         Show this help`);
		process.exit(0);
	}
}

// 目录和天数都是必填参数，缺失时输出提示并失败退出。
if (!directory || !days) {
	console.error("Error: both --dir and --days are required");
	console.error("Run with --help for usage");
	process.exit(1);
}

// Encode directory path to session folder name
// 把项目目录编码为 pi 会话存储使用的目录名。
/**
 * 编码项目路径为会话文件夹名称。
 * @param dir 项目路径字符串。
 * @returns 去掉开头斜杠并把其余斜杠替换为连字符的名称；例如 `/tmp/a` 变为 `--tmp-a--`。
 */
function encodeSessionDir(dir: string): string {
	// Remove leading slash, replace remaining slashes with dashes
	// 去掉开头斜杠，再把其余斜杠统一替换为连字符。
	// normalized 是移除可选前导斜杠后的路径文本。
	const normalized = dir.startsWith("/") ? dir.slice(1) : dir;
	return "--" + normalized.replace(/\//g, "-") + "--";
}

// sessionsBase 是当前用户的 pi 会话存储根目录。
const sessionsBase = path.join(process.env.HOME!, ".pi/agent/sessions");
// encodedDir 是目标项目路径对应的会话文件夹名。
const encodedDir = encodeSessionDir(directory);
// sessionsDir 是本次统计实际扫描的目录。
const sessionsDir = path.join(sessionsBase, encodedDir);

// 会话目录不存在时无法统计，输出解析后的路径便于用户排查。
if (!fs.existsSync(sessionsDir)) {
	console.error(`Sessions directory not found: ${sessionsDir}`);
	process.exit(1);
}

// Get cutoff date
// 计算统计日期下界，并归一化到本地当天零点。
// cutoff 是允许纳入统计的最早文件时间。
const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - days);
cutoff.setHours(0, 0, 0, 0);

// DayCost 保存某一天、某个提供商的费用分项与请求数。
interface DayCost {
	total: number;
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	requests: number;
}

// Stats 以日期和提供商为两级键组织累计费用。
interface Stats {
	[day: string]: {
		[provider: string]: DayCost;
	};
}

// stats 是扫描会话时逐步填充的全部统计结果。
const stats: Stats = {};

// Process session files
// 处理目标目录下所有 JSONL 会话文件。
// files 是会话目录中扩展名为 .jsonl 的文件名列表。
const files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith(".jsonl"));

for (const file of files) {
	// Extract timestamp from filename: <timestamp>_<uuid>.jsonl
	// 从 `<时间戳>_<UUID>.jsonl` 文件名提取时间戳部分。
	// Format: 2025-12-17T08-25-07-381Z (dashes instead of colons)
	// 文件名时间格式使用连字符代替冒号，例如 2025-12-17T08-25-07-381Z。
	// timestamp 是文件名下划线前的编码时间。
	const timestamp = file.split("_")[0];
	// Convert back to valid ISO: replace T08-25-07-381Z with T08:25:07.381Z
	// 把时间部分恢复为合法 ISO 格式，例如 T08:25:07.381Z。
	// isoTimestamp 是可交给 Date 解析的标准时间字符串。
	const isoTimestamp = timestamp.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/, "T$1:$2:$3.$4Z");
	// fileDate 是从文件名得到的会话创建时间。
	const fileDate = new Date(isoTimestamp);

	if (fileDate < cutoff) continue;

	// filepath 是当前会话文件的绝对或根目录相对路径。
	const filepath = path.join(sessionsDir, file);
	// content 保存会话 JSONL 文件全文。
	const content = fs.readFileSync(filepath, "utf8");
	// lines 是按换行拆分的独立 JSON 条目文本。
	const lines = content.trim().split("\n");

	// line 是当前会话 JSONL 文件中待解析的一行记录。
	for (const line of lines) {
		if (!line) continue;

		try {
			// entry 是当前行解析出的会话记录，结构在后续条件中逐步检查。
			const entry = JSON.parse(line);

			if (entry.type !== "message") continue;
			if (entry.message?.role !== "assistant") continue;
			if (!entry.message?.usage?.cost) continue;

			// provider 和 usage 来自助手消息，用于确定归属和费用。
			const { provider, usage } = entry.message;
			// cost 包含总费用以及输入、输出、缓存分项。
			const { cost } = usage;
			// entryDate 是消息记录自身的时间戳。
			const entryDate = new Date(entry.timestamp);
			// day 是 UTC 日期键，格式为 YYYY-MM-DD。
			const day = entryDate.toISOString().split("T")[0];

			if (!stats[day]) stats[day] = {};
			if (!stats[day][provider]) {
				stats[day][provider] = {
					total: 0,
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					requests: 0,
				};
			}

			stats[day][provider].total += cost.total || 0;
			stats[day][provider].input += cost.input || 0;
			stats[day][provider].output += cost.output || 0;
			stats[day][provider].cacheRead += cost.cacheRead || 0;
			stats[day][provider].cacheWrite += cost.cacheWrite || 0;
			stats[day][provider].requests += 1;
		} catch {
			// Skip malformed lines
			// 单行 JSON 损坏时跳过该行，继续统计同文件其他有效记录。
		}
	}
}

// Sort days and output
// 按日期键排序后输出报表。
// sortedDays 是存在有效费用数据的日期升序列表。
const sortedDays = Object.keys(stats).sort();

// 没有有效记录时给出说明并正常退出。
if (sortedDays.length === 0) {
	console.log(`No sessions found in the last ${days} days for: ${directory}`);
	process.exit(0);
}

console.log(`\nCost breakdown for: ${directory}`);
console.log(`Period: last ${days} days (since ${cutoff.toISOString().split("T")[0]})`);
console.log("=".repeat(80));

// grandTotal 累加所有日期、所有提供商的总费用。
let grandTotal = 0;
// providerTotals 跨日期累计每个提供商的费用分项。
const providerTotals: { [p: string]: DayCost } = {};


// day 是按日期排序后的当前成本汇总键。
for (const day of sortedDays) {
	console.log(`\n${day}`);
	console.log("-".repeat(40));

	// dayTotal 是当前日期所有提供商费用之和。
	let dayTotal = 0;
	// providers 是当前日期出现的提供商名称排序列表。
	const providers = Object.keys(stats[day]).sort();

	for (const provider of providers) {
		// s 是当前日期和提供商对应的累计统计。
		const s = stats[day][provider];
		dayTotal += s.total;

		if (!providerTotals[provider]) {
			providerTotals[provider] = { total: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, requests: 0 };
		}
		providerTotals[provider].total += s.total;
		providerTotals[provider].input += s.input;
		providerTotals[provider].output += s.output;
		providerTotals[provider].cacheRead += s.cacheRead;
		providerTotals[provider].cacheWrite += s.cacheWrite;
		providerTotals[provider].requests += s.requests;

		console.log(
			`  ${provider.padEnd(15)} $${s.total.toFixed(4).padStart(8)}  (${s.requests} reqs, in: $${s.input.toFixed(4)}, out: $${s.output.toFixed(4)}, cache: $${(s.cacheRead + s.cacheWrite).toFixed(4)})`
		);
	}

	console.log(`  ${"Day total:".padEnd(15)} $${dayTotal.toFixed(4).padStart(8)}`);
	grandTotal += dayTotal;
}

console.log("\n" + "=".repeat(80));
console.log("TOTALS BY PROVIDER");
console.log("-".repeat(40));

for (const provider of Object.keys(providerTotals).sort()) {
	// t 是该提供商跨全部日期的总计。
	const t = providerTotals[provider];
	console.log(
		`  ${provider.padEnd(15)} $${t.total.toFixed(4).padStart(8)}  (${t.requests} reqs, in: $${t.input.toFixed(4)}, out: $${t.output.toFixed(4)}, cache: $${(t.cacheRead + t.cacheWrite).toFixed(4)})`
	);
}

console.log("-".repeat(40));
console.log(`  ${"GRAND TOTAL:".padEnd(15)} $${grandTotal.toFixed(4).padStart(8)}`);
console.log();
