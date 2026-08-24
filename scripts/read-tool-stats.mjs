#!/usr/bin/env node

/**
 * 文件职责：扫描 pi 的 JSONL 会话记录，统计 read 工具完整读取与分段读取的使用情况并生成报告。
 * 技术维度：使用 Node.js 文件流、readline 异步迭代、Intl 时区格式化、分组统计以及 HTML/文本/JSON 输出。
 * 产品维度：帮助维护者了解读取工具的真实使用模式，评估默认行为、上下文消耗和分段读取引导效果。
 * 逻辑维度：解析参数并确定时间范围，递归扫描会话文件，提取 read 调用，聚合统计后按所选格式输出。
 * 关键边界：默认读取用户会话目录且按目标源码文件出生时间过滤；损坏行会跳过，统计不代表完整业务审计。
 * 新手阅读建议：先读 classifyRead 与 scanSessions 理解数据来源，再读 buildSummary，最后看三种报告输出函数。
 */

import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";

/** 常量 DEFAULT_SESSIONS_DIR：默认会话根目录，依据用户主目录中的 .pi 路径确定；仅在定义的统计范围内使用。 */
const DEFAULT_SESSIONS_DIR = path.join(homedir(), ".pi/agent/sessions");
/** 常量 DEFAULT_ACTIVE_READ_TOOL_PATH：用于自动起始时间判断的当前 read 工具源码路径；仅在定义的统计范围内使用。 */
const DEFAULT_ACTIVE_READ_TOOL_PATH = path.join(process.cwd(), "packages/coding-agent/src/core/tools/read.ts");
/** 常量 DEFAULT_TOP：报告默认展示的样例数量；仅在定义的统计范围内使用。 */
const DEFAULT_TOP = 20;
/** 常量 CHART_WIDTH：文本条形图固定宽度，单位为字符；仅在定义的统计范围内使用。 */
const CHART_WIDTH = 40;
/** 常量 REPORT_TIME_ZONE：所有趋势报告统一采用的柏林时区；仅在定义的统计范围内使用。 */
const REPORT_TIME_ZONE = "Europe/Berlin";

/** 解析命令行选项并应用默认值。参数：argv；返回处理后的统计值或结构。示例：parseArgs(argv). */
function parseArgs(argv) {
/** 变量 options：合并默认值后的命令行选项对象；仅在定义的统计范围内使用。 */
	const options = {
		sessionsDir: DEFAULT_SESSIONS_DIR,
		json: false,
		text: false,
		includeRecords: false,
		modelFilter: undefined,
		top: DEFAULT_TOP,
		help: false,
		allSessions: false,
		since: undefined,
		autoSincePath: DEFAULT_ACTIVE_READ_TOOL_PATH,
		bucket: "week",
	};

	for (let i = 0; i < argv.length; i++) {
/** 循环变量 i：当前命令行参数的下标，读取带值选项时会额外递增。 */
/** 变量 arg：当前正在解析的命令行参数；仅在定义的统计范围内使用。 */
		const arg = argv[i];
		if (arg === "--help" || arg === "-h") options.help = true;
		else if (arg === "--json") options.json = true;
		else if (arg === "--text") options.text = true;
		else if (arg === "--include-records") options.includeRecords = true;
		else if (arg === "--model") options.modelFilter = argv[++i];
		else if (arg === "--top") {
/** 变量 value：当前选项对应的原始或数值参数；仅在定义的统计范围内使用。 */
			const value = Number.parseInt(argv[++i] ?? "", 10);
			if (!Number.isFinite(value) || value <= 0) throw new Error("--top must be a positive integer");
			options.top = value;
		} else if (arg === "--sessions-dir") options.sessionsDir = argv[++i];
		else if (arg === "--all-sessions") options.allSessions = true;
		else if (arg === "--since") options.since = argv[++i];
		else if (arg === "--auto-since-path") options.autoSincePath = argv[++i];
		else if (arg === "--bucket") {
/** 变量 value：当前选项对应的原始或数值参数；仅在定义的统计范围内使用。 */
			const value = argv[++i];
			if (value !== "day" && value !== "week") throw new Error("--bucket must be day or week");
			options.bucket = value;
		} else throw new Error(`Unknown argument: ${arg}`);
	}

	return options;
}

/** 输出脚本用法和支持的命令行选项。参数：无；无直接返回值。示例：printHelp(). */
function printHelp() {
	console.log(`Usage: node scripts/read-tool-stats.mjs [options]

Options:
  --sessions-dir <path>  Sessions directory (default: ~/.pi/agent/sessions)
  --model <substring>    Filter provider/model by substring
  --top <n>              Number of examples to show (default: ${DEFAULT_TOP})
  --since <iso>          Only scan session files created at or after this ISO time
  --all-sessions         Disable the automatic since filter
  --auto-since-path <p>  Use birth time of this file for the automatic since filter
  --bucket <day|week>    Time bucket for trend chart (default: week)
  --json                 Print JSON summary instead of HTML report
  --text                 Print plain text report instead of HTML
  --include-records      Include raw records in JSON output
  -h, --help             Show this help
`);
}

/** 从会话文件名解析创建时间戳。参数：sessionFile；返回处理后的统计值或结构。示例：parseSessionFileTimestamp(sessionFile). */
function parseSessionFileTimestamp(sessionFile) {
/** 变量 base：去除目录后的会话文件名；仅在定义的统计范围内使用。 */
	const base = path.basename(sessionFile);
/** 变量 rawTimestamp：文件名下划线前的原始时间字段；仅在定义的统计范围内使用。 */
	const rawTimestamp = base.split("_")[0];
	if (!rawTimestamp) return null;
/** 变量 isoTimestamp：把文件名格式还原后的 ISO 时间字符串；仅在定义的统计范围内使用。 */
	const isoTimestamp = rawTimestamp.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, "T$1:$2:$3.$4Z");
/** 变量 ms：解析或计算得到的毫秒时间戳；仅在定义的统计范围内使用。 */
	const ms = Date.parse(isoTimestamp);
	return Number.isFinite(ms) ? ms : null;
}

/** 把毫秒时间戳转换为 ISO 字符串。参数：ms；返回处理后的统计值或结构。示例：formatIso(ms). */
function formatIso(ms) {
	return new Date(ms).toISOString();
}

/** 按报告时区拆解日期时间字段。参数：ms；返回处理后的统计值或结构。示例：getTimeZoneParts(ms). */
function getTimeZoneParts(ms) {
/** 变量 parts：按报告时区拆分出的日期时间字段；仅在定义的统计范围内使用。 */
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: REPORT_TIME_ZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		hourCycle: "h23",
		weekday: "short",
	}).formatToParts(new Date(ms));
	return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

/** 把时间戳格式化为报告时区中的日期。参数：ms；返回处理后的统计值或结构。示例：formatDay(ms). */
function formatDay(ms) {
/** 变量 parts：按报告时区拆分出的日期时间字段；仅在定义的统计范围内使用。 */
	const parts = getTimeZoneParts(ms);
	return `${parts.year}-${parts.month}-${parts.day}`;
}

/** 计算报告时区所在周的周一起点。参数：ms；返回处理后的统计值或结构。示例：startOfReportTimeZoneWeek(ms). */
function startOfReportTimeZoneWeek(ms) {
/** 变量 parts：按报告时区拆分出的日期时间字段；仅在定义的统计范围内使用。 */
	const parts = getTimeZoneParts(ms);
/** 变量 dayIndex：星期在周一到周日数组中的下标；仅在定义的统计范围内使用。 */
	const dayIndex = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts.weekday ?? "Mon");
/** 变量 localMidnightAsUtc：以 UTC 数值表示的报告时区本地午夜；仅在定义的统计范围内使用。 */
	const localMidnightAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
	return localMidnightAsUtc - Math.max(dayIndex, 0) * 24 * 60 * 60 * 1000;
}

/** 按日或周生成时间分桶键。参数：ms, bucket；返回处理后的统计值或结构。示例：getTimeBucket(ms, bucket). */
function getTimeBucket(ms, bucket) {
	if (!Number.isFinite(ms)) return "[unknown]";
	if (bucket === "day") return formatDay(ms);
	return formatDay(startOfReportTimeZoneWeek(ms));
}

/** 生成小时粒度的时间分桶键。参数：ms；返回处理后的统计值或结构。示例：getHourOfDayBucket(ms). */
function getHourOfDayBucket(ms) {
	if (!Number.isFinite(ms)) return "[unknown]";
	return `${getTimeZoneParts(ms).hour}:00`;
}

/** 解析显式或自动的扫描起始时间。参数：options；返回处理后的统计值或结构。示例：resolveAutoSinceMs(options). */
async function resolveAutoSinceMs(options) {
	if (options.allSessions) return null;
	if (options.since) {
/** 变量 ms：解析或计算得到的毫秒时间戳；仅在定义的统计范围内使用。 */
		const ms = Date.parse(options.since);
		if (!Number.isFinite(ms)) throw new Error(`Invalid --since value: ${options.since}`);
		return { ms, source: `--since ${options.since}` };
	}
	if (!options.autoSincePath) return null;
	try {
/** 变量 stats：目标路径的文件系统元数据；仅在定义的统计范围内使用。 */
		const stats = await fs.stat(options.autoSincePath);
/** 变量 ms：解析或计算得到的毫秒时间戳；仅在定义的统计范围内使用。 */
		const ms = Number.isFinite(stats.birthtimeMs) && stats.birthtimeMs > 0 ? stats.birthtimeMs : stats.mtimeMs;
		return Number.isFinite(ms) && ms > 0 ? { ms, source: `birth time of ${options.autoSincePath}` } : null;
	} catch {
		return null;
	}
}

/** 递归遍历目录并异步产出 JSONL 文件路径。参数：dir；异步产出文件路径。示例：walkJsonlFiles(dir). */
async function* walkJsonlFiles(dir) {
/** 变量 entries：当前目录按名称排序后的目录项；仅在定义的统计范围内使用。 */
	const entries = await fs.readdir(dir, { withFileTypes: true });
	entries.sort((a, b) => a.name.localeCompare(b.name));
	for (const entry of entries) {
/** 循环变量 entry：当前检查的目录项。 */
/** 变量 fullPath：当前目录项拼接后的完整路径；仅在定义的统计范围内使用。 */
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) yield* walkJsonlFiles(fullPath);
		else if (entry.isFile() && entry.name.endsWith(".jsonl")) yield fullPath;
	}
}

/** 使用千位分隔符格式化整数。参数：value；返回处理后的统计值或结构。示例：formatInt(value). */
function formatInt(value) {
	return new Intl.NumberFormat("en-US").format(value);
}

/** 计算并格式化部分占总体的百分比。参数：part, total；返回处理后的统计值或结构。示例：formatPercent(part, total). */
function formatPercent(part, total) {
	return total === 0 ? "n/a" : `${((part / total) * 100).toFixed(1)}%`;
}

/** 把有限数值格式化为两位小数。参数：value；返回处理后的统计值或结构。示例：formatRate(value). */
function formatRate(value) {
	return Number.isFinite(value) ? value.toFixed(2) : "n/a";
}

/** 计算有限数值集合的中位数。参数：numbers；返回处理后的统计值或结构。示例：median(numbers). */
function median(numbers) {
/** 变量 finite：过滤非有限值并升序排列后的数字数组；仅在定义的统计范围内使用。 */
	const finite = numbers.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
	if (finite.length === 0) return null;
/** 变量 middle：中位位置的数组下标；仅在定义的统计范围内使用。 */
	const middle = Math.floor(finite.length / 2);
	return finite.length % 2 === 0 ? (finite[middle - 1] + finite[middle]) / 2 : finite[middle];
}

/** 根据比例生成固定宽度的文本条形图。参数：part, total；返回处理后的统计值或结构。示例：bar(part, total). */
function bar(part, total) {
/** 变量 filled：条形图中实心字符的数量；仅在定义的统计范围内使用。 */
	const filled = total === 0 ? 0 : Math.round((part / total) * CHART_WIDTH);
	return `${"█".repeat(filled)}${"░".repeat(CHART_WIDTH - filled)}`;
}

/** 从字符串或内容块数组提取纯文本。参数：content；返回处理后的统计值或结构。示例：extractTextContent(content). */
function extractTextContent(content) {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.filter((block) => block?.type === "text" && typeof block.text === "string")
		.map((block) => block.text)
		.join("\n");
}

/** 判断 read 工具参数属于完整读取还是分段读取。参数：args；返回处理后的统计值或结构。示例：classifyRead(args). */
function classifyRead(args) {
/** 变量 normalizedArgs：确保为对象后的 read 工具参数；仅在定义的统计范围内使用。 */
	const normalizedArgs = args && typeof args === "object" ? args : {};
/** 变量 hasOffset：参数是否显式提供 offset；仅在定义的统计范围内使用。 */
	const hasOffset = Object.hasOwn(normalizedArgs, "offset") && normalizedArgs.offset !== undefined && normalizedArgs.offset !== null;
/** 变量 hasLimit：参数是否显式提供 limit；仅在定义的统计范围内使用。 */
	const hasLimit = Object.hasOwn(normalizedArgs, "limit") && normalizedArgs.limit !== undefined && normalizedArgs.limit !== null;
	return {
		path: typeof normalizedArgs.path === "string" ? normalizedArgs.path : "",
		offset: hasOffset ? normalizedArgs.offset : null,
		limit: hasLimit ? normalizedArgs.limit : null,
		mode: hasOffset || hasLimit ? "partial" : "full",
	};
}

/** 按指定日/周时间桶汇总读取记录。参数：records, bucket；返回处理后的统计值或结构。示例：summarizeTimeBuckets(records, bucket). */
function summarizeTimeBuckets(records, bucket) {
	return summarizeGroups(records, (record) => getTimeBucket(record.timestampMs, bucket)).sort((a, b) => a.key.localeCompare(b.key));
}

/** 按会话归一化方式汇总时间桶。参数：records, bucket；返回处理后的统计值或结构。示例：summarizeNormalizedTimeBuckets(records, bucket). */
function summarizeNormalizedTimeBuckets(records, bucket) {
	return summarizeNormalizedTimeBucketsByKey(records, (record) => getTimeBucket(record.timestampMs, bucket));
}

/** 按自定义键分组并计算每会话读取指标。参数：records, keyFn；返回处理后的统计值或结构。示例：summarizeNormalizedTimeBucketsByKey(records, keyFn). */
function summarizeNormalizedTimeBucketsByKey(records, keyFn) {
/** 变量 bucketGroups：时间桶键到读取记录数组的映射；仅在定义的统计范围内使用。 */
	const bucketGroups = new Map();
	for (const record of records) {
/** 循环变量 record：当前参与分组的 read 调用记录。 */
/** 变量 bucketKey：当前记录所属的时间桶键；仅在定义的统计范围内使用。 */
		const bucketKey = keyFn(record);
		if (!bucketGroups.has(bucketKey)) bucketGroups.set(bucketKey, []);
		bucketGroups.get(bucketKey).push(record);
	}

	return [...bucketGroups.entries()]
		.map(([key, bucketRecords]) => {
/** 变量 sessionGroups：会话文件到该会话读取记录的映射；仅在定义的统计范围内使用。 */
			const sessionGroups = new Map();
			for (const record of bucketRecords) {
/** 循环变量 record：当前时间桶中的一条读取记录。 */
				if (!sessionGroups.has(record.sessionFile)) sessionGroups.set(record.sessionFile, []);
				sessionGroups.get(record.sessionFile).push(record);
			}
/** 变量 sessions：各会话独立计算的读取统计；仅在定义的统计范围内使用。 */
			const sessions = [...sessionGroups.values()].map((sessionRecords) => {
/** 变量 full：完整读取调用数量；仅在定义的统计范围内使用。 */
				const full = sessionRecords.filter((record) => record.mode === "full").length;
/** 变量 partial：分段读取调用数量；仅在定义的统计范围内使用。 */
				const partial = sessionRecords.length - full;
				return { reads: sessionRecords.length, full, partial, partialRate: sessionRecords.length === 0 ? null : partial / sessionRecords.length };
			});
/** 变量 reads：当前分组的读取总数；仅在定义的统计范围内使用。 */
			const reads = bucketRecords.length;
/** 变量 full：完整读取调用数量；仅在定义的统计范围内使用。 */
			const full = bucketRecords.filter((record) => record.mode === "full").length;
/** 变量 partial：分段读取调用数量；仅在定义的统计范围内使用。 */
			const partial = reads - full;
/** 变量 sessionCount：当前分组涉及的会话数量；仅在定义的统计范围内使用。 */
			const sessionCount = sessions.length;
/** 变量 medianSessionPartialRate：各会话分段读取率的中位数；仅在定义的统计范围内使用。 */
			const medianSessionPartialRate = median(sessions.map((session) => session.partialRate));
			return {
				key,
				sessions: sessionCount,
				reads,
				full,
				partial,
				readsPerSession: sessionCount === 0 ? null : reads / sessionCount,
				fullPerSession: sessionCount === 0 ? null : full / sessionCount,
				partialPerSession: sessionCount === 0 ? null : partial / sessionCount,
				medianSessionPartialRate,
			};
		})
		.sort((a, b) => a.key.localeCompare(b.key));
}

/** 按任意键对读取记录进行基础汇总。参数：records, keyFn；返回处理后的统计值或结构。示例：summarizeGroups(records, keyFn). */
function summarizeGroups(records, keyFn) {
/** 变量 groups：汇总键到读取记录数组的映射；仅在定义的统计范围内使用。 */
	const groups = new Map();
	for (const record of records) {
/** 循环变量 record：当前参与分组的 read 调用记录。 */
/** 变量 key：当前记录计算出的汇总键；仅在定义的统计范围内使用。 */
		const key = keyFn(record);
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(record);
	}
	return [...groups.entries()]
		.map(([key, group]) => {
/** 变量 full：完整读取调用数量；仅在定义的统计范围内使用。 */
			const full = group.filter((record) => record.mode === "full").length;
/** 变量 partial：分段读取调用数量；仅在定义的统计范围内使用。 */
			const partial = group.length - full;
/** 变量 assistantMessages：包含 read 调用的唯一助手消息数量；仅在定义的统计范围内使用。 */
			const assistantMessages = new Set(group.map((record) => `${record.sessionFile}::${record.assistantEntryId}`)).size;
			return { key, reads: group.length, assistantMessages, full, partial, fullRate: group.length === 0 ? null : full / group.length, partialRate: group.length === 0 ? null : partial / group.length };
		})
		.sort((a, b) => b.reads - a.reads || a.key.localeCompare(b.key));
}

/** 构建包含过滤条件、扫描信息、计数和趋势的完整摘要。参数：records, meta, options；返回处理后的统计值或结构。示例：buildSummary(records, meta, options). */
function buildSummary(records, meta, options) {
/** 变量 full：完整读取调用数量；仅在定义的统计范围内使用。 */
	const full = records.filter((record) => record.mode === "full").length;
/** 变量 partial：分段读取调用数量；仅在定义的统计范围内使用。 */
	const partial = records.length - full;
/** 变量 providerStats：按提供商和模型汇总的统计；仅在定义的统计范围内使用。 */
	const providerStats = summarizeGroups(records, (record) => record.providerModel);
/** 变量 timeStats：按日或周汇总的趋势统计；仅在定义的统计范围内使用。 */
	const timeStats = summarizeTimeBuckets(records, options.bucket);
/** 变量 normalizedTimeStats：按会话归一化后的日或周趋势；仅在定义的统计范围内使用。 */
	const normalizedTimeStats = summarizeNormalizedTimeBuckets(records, options.bucket);
/** 变量 timeOfDayStats：按小时汇总的读取统计；仅在定义的统计范围内使用。 */
	const timeOfDayStats = summarizeGroups(records, (record) => getHourOfDayBucket(record.timestampMs)).sort((a, b) => a.key.localeCompare(b.key));
/** 变量 normalizedTimeOfDayStats：按会话归一化后的小时统计；仅在定义的统计范围内使用。 */
	const normalizedTimeOfDayStats = summarizeNormalizedTimeBucketsByKey(records, (record) => getHourOfDayBucket(record.timestampMs));
/** 变量 timeStatsByProvider：每个提供商内部按时间进一步拆分的统计；仅在定义的统计范围内使用。 */
	const timeStatsByProvider = providerStats.map((provider) => ({
		providerModel: provider.key,
		...provider,
		timeStats: summarizeTimeBuckets(
			records.filter((record) => record.providerModel === provider.key),
			options.bucket
		),
		normalizedTimeStats: summarizeNormalizedTimeBuckets(
			records.filter((record) => record.providerModel === provider.key),
			options.bucket
		),
		timeOfDayStats: summarizeGroups(
			records.filter((record) => record.providerModel === provider.key),
			(record) => getHourOfDayBucket(record.timestampMs)
		).sort((a, b) => a.key.localeCompare(b.key)),
		normalizedTimeOfDayStats: summarizeNormalizedTimeBucketsByKey(
			records.filter((record) => record.providerModel === provider.key),
			(record) => getHourOfDayBucket(record.timestampMs)
		),
	}));
	return {
		filters: { model: options.modelFilter ?? null, bucket: options.bucket },
		scan: {
			sessionsDir: meta.sessionsDir,
			sessionFilesScanned: meta.sessionFilesScanned,
			sessionFilesIncluded: meta.sessionFilesIncluded,
			sessionFilesSkippedOlderThanSince: meta.sessionFilesSkippedOlderThanSince,
			sessionFilesWithReadCalls: meta.sessionFilesWithReadCalls,
			since: meta.since ? { ms: meta.since.ms, iso: formatIso(meta.since.ms), source: meta.since.source } : null,
			malformedLines: meta.malformedLines,
		},
		counts: {
			assistantMessagesWithReadCalls: new Set(records.map((record) => `${record.sessionFile}::${record.assistantEntryId}`)).size,
			totalReadCalls: records.length,
			full,
			partial,
			fullRate: records.length === 0 ? null : full / records.length,
			partialRate: records.length === 0 ? null : partial / records.length,
		},
		providerStats,
		timeStats,
		normalizedTimeStats,
		timeOfDayStats,
		normalizedTimeOfDayStats,
		timeStatsByProvider,
		examples: records.slice(0, options.top),
	};
}

/** 捕获文本报告输出并返回字符串。参数：summary；返回处理后的统计值或结构。示例：buildHumanReport(summary). */
function buildHumanReport(summary) {
/** 变量 lines：捕获文本报告输出的字符串数组；仅在定义的统计范围内使用。 */
	const lines = [];
/** 变量 originalLog：输出报告前保存的原 console.log；仅在定义的统计范围内使用。 */
	const originalLog = console.log;
	console.log = (line = "") => lines.push(String(line));
	try {
		printHumanReport(summary);
	} finally {
		console.log = originalLog;
	}
	return lines.join("\n") + "\n";
}

/** 转义 HTML 特殊字符，防止报告内容破坏页面结构。参数：text；返回处理后的统计值或结构。示例：escapeHtml(text). */
function escapeHtml(text) {
	return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/** 把文本报告包裹为最小 HTML 页面并输出。参数：summary；无直接返回值。示例：printHtmlReport(summary). */
function printHtmlReport(summary) {
/** 变量 text：已生成的纯文本报告；仅在定义的统计范围内使用。 */
	const text = buildHumanReport(summary);
	console.log(`<!doctype html>
<meta charset="utf-8">
<title>Read tool stats</title>
<style>
body { margin: 24px; background: #fff; color: #111; }
pre { font: 13px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre; }
</style>
<pre>${escapeHtml(text)}</pre>`);
}

/** 输出适合终端阅读的多维统计报告。参数：summary；无直接返回值。示例：printHumanReport(summary). */
function printHumanReport(summary) {
/** 解构变量：从摘要中解构报告输出所需的扫描、计数、趋势和过滤信息。 */
	const { scan, counts, timeStats, normalizedTimeStats, timeOfDayStats, normalizedTimeOfDayStats, timeStatsByProvider, filters } = summary;
	console.log(`Scanned ${formatInt(scan.sessionFilesIncluded)} session files in ${scan.sessionsDir}`);
	console.log(`Report timezone: ${REPORT_TIME_ZONE} (CET/CEST)`);
	if (scan.since) {
		console.log(`Session filter: files created at or after ${scan.since.iso} (${scan.since.source})`);
		console.log(`Skipped older session files: ${formatInt(scan.sessionFilesSkippedOlderThanSince)} of ${formatInt(scan.sessionFilesScanned)}`);
	}
	console.log(`Found ${formatInt(counts.totalReadCalls)} read tool calls in ${formatInt(counts.assistantMessagesWithReadCalls)} assistant messages`);
	if (filters.model) console.log(`Filters: model contains "${filters.model}"`);

	console.log("\nFull vs partial reads");
	console.log(`  full:    ${formatInt(counts.full).padStart(8)}  ${formatPercent(counts.full, counts.totalReadCalls).padStart(6)}  ${bar(counts.full, counts.totalReadCalls)}`);
	console.log(`  partial: ${formatInt(counts.partial).padStart(8)}  ${formatPercent(counts.partial, counts.totalReadCalls).padStart(6)}  ${bar(counts.partial, counts.totalReadCalls)}`);

	console.log(`\nBy ${filters.bucket}`);
	for (const group of timeStats) {
/** 循环变量 group：当前准备输出的汇总分组。 */
		console.log(
			`  ${group.key} reads=${formatInt(group.reads).padStart(5)} full=${formatPercent(group.full, group.reads).padStart(6)} partial=${formatPercent(group.partial, group.reads).padStart(6)} ${bar(group.partial, group.reads)}`
		);
	}

	console.log("\nBy time of day");
	for (const group of timeOfDayStats) {
/** 循环变量 group：当前准备输出的汇总分组。 */
		console.log(
			`  ${group.key} reads=${formatInt(group.reads).padStart(5)} full=${formatPercent(group.full, group.reads).padStart(6)} partial=${formatPercent(group.partial, group.reads).padStart(6)} ${bar(group.partial, group.reads)}`
		);
	}

	console.log("\nBy time of day, session-normalized");
	for (const group of normalizedTimeOfDayStats) {
/** 循环变量 group：当前准备输出的汇总分组。 */
		console.log(
			`  ${group.key} sessions=${formatInt(group.sessions).padStart(4)} reads/session=${formatRate(group.readsPerSession).padStart(5)} full/session=${formatRate(group.fullPerSession).padStart(5)} partial/session=${formatRate(group.partialPerSession).padStart(5)} medianSessionPartial=${group.medianSessionPartialRate === null ? "n/a" : formatPercent(group.medianSessionPartialRate, 1).padStart(6)} ${bar(group.medianSessionPartialRate ?? 0, 1)}`
		);
	}

	console.log(`\nBy ${filters.bucket}, session-normalized`);
	for (const group of normalizedTimeStats) {
/** 循环变量 group：当前准备输出的汇总分组。 */
		console.log(
			`  ${group.key} sessions=${formatInt(group.sessions).padStart(4)} reads/session=${formatRate(group.readsPerSession).padStart(5)} full/session=${formatRate(group.fullPerSession).padStart(5)} partial/session=${formatRate(group.partialPerSession).padStart(5)} medianSessionPartial=${group.medianSessionPartialRate === null ? "n/a" : formatPercent(group.medianSessionPartialRate, 1).padStart(6)} ${bar(group.medianSessionPartialRate ?? 0, 1)}`
		);
	}

	console.log(`\nBy provider/model, then by ${filters.bucket}`);
	for (const group of timeStatsByProvider) {
/** 循环变量 group：当前准备输出的汇总分组。 */
		console.log(`\n${group.providerModel}`);
		console.log(`  total reads=${formatInt(group.reads)} assistantMessages=${formatInt(group.assistantMessages)}`);
		console.log(`  total full    ${formatInt(group.full).padStart(8)} ${formatPercent(group.full, group.reads).padStart(6)} ${bar(group.full, group.reads)}`);
		console.log(`  total partial ${formatInt(group.partial).padStart(8)} ${formatPercent(group.partial, group.reads).padStart(6)} ${bar(group.partial, group.reads)}`);
		console.log(`  By ${filters.bucket}`);
		for (const bucket of group.timeStats) {
/** 循环变量 bucket：当前提供商下的时间或小时分桶。 */
			console.log(
				`    ${bucket.key} reads=${formatInt(bucket.reads).padStart(5)} full=${formatPercent(bucket.full, bucket.reads).padStart(6)} partial=${formatPercent(bucket.partial, bucket.reads).padStart(6)} ${bar(bucket.partial, bucket.reads)}`
			);
		}
		console.log(`  By ${filters.bucket}, session-normalized`);
		for (const bucket of group.normalizedTimeStats) {
/** 循环变量 bucket：当前提供商下的时间或小时分桶。 */
			console.log(
				`    ${bucket.key} sessions=${formatInt(bucket.sessions).padStart(4)} reads/session=${formatRate(bucket.readsPerSession).padStart(5)} full/session=${formatRate(bucket.fullPerSession).padStart(5)} partial/session=${formatRate(bucket.partialPerSession).padStart(5)} medianSessionPartial=${bucket.medianSessionPartialRate === null ? "n/a" : formatPercent(bucket.medianSessionPartialRate, 1).padStart(6)} ${bar(bucket.medianSessionPartialRate ?? 0, 1)}`
			);
		}
		console.log("  By time of day");
		for (const bucket of group.timeOfDayStats) {
/** 循环变量 bucket：当前提供商下的时间或小时分桶。 */
			console.log(
				`    ${bucket.key} reads=${formatInt(bucket.reads).padStart(5)} full=${formatPercent(bucket.full, bucket.reads).padStart(6)} partial=${formatPercent(bucket.partial, bucket.reads).padStart(6)} ${bar(bucket.partial, bucket.reads)}`
			);
		}
		console.log("  By time of day, session-normalized");
		for (const bucket of group.normalizedTimeOfDayStats) {
/** 循环变量 bucket：当前提供商下的时间或小时分桶。 */
			console.log(
				`    ${bucket.key} sessions=${formatInt(bucket.sessions).padStart(4)} reads/session=${formatRate(bucket.readsPerSession).padStart(5)} full/session=${formatRate(bucket.fullPerSession).padStart(5)} partial/session=${formatRate(bucket.partialPerSession).padStart(5)} medianSessionPartial=${bucket.medianSessionPartialRate === null ? "n/a" : formatPercent(bucket.medianSessionPartialRate, 1).padStart(6)} ${bar(bucket.medianSessionPartialRate ?? 0, 1)}`
			);
		}
	}

	if (scan.malformedLines > 0) {
		console.log("\nParser notes");
		console.log(`  malformed lines skipped: ${formatInt(scan.malformedLines)}`);
	}
}

/** 扫描会话文件并提取所有 read 工具调用记录。参数：sessionsDir, since；返回处理后的统计值或结构。示例：scanSessions(sessionsDir, since). */
async function scanSessions(sessionsDir, since) {
/** 变量 records：从全部会话提取的 read 调用记录；仅在定义的统计范围内使用。 */
	const records = [];
/** 变量 meta：扫描进度、过滤数量和损坏行数量；仅在定义的统计范围内使用。 */
	const meta = { sessionsDir, sessionFilesScanned: 0, sessionFilesIncluded: 0, sessionFilesSkippedOlderThanSince: 0, sessionFilesWithReadCalls: 0, since, malformedLines: 0 };

	for await (const sessionFile of walkJsonlFiles(sessionsDir)) {
/** 循环变量 sessionFile：当前扫描的 JSONL 会话文件路径。 */
		meta.sessionFilesScanned++;
/** 变量 sessionTimestampMs：从当前会话文件名解析出的时间；仅在定义的统计范围内使用。 */
		const sessionTimestampMs = parseSessionFileTimestamp(sessionFile);
		if (since && sessionTimestampMs !== null && sessionTimestampMs < since.ms) {
			meta.sessionFilesSkippedOlderThanSince++;
			continue;
		}
		meta.sessionFilesIncluded++;
/** 变量 fileHadReadCall：当前会话文件是否至少包含一次 read 调用；仅在定义的统计范围内使用。 */
		let fileHadReadCall = false;
/** 变量 input：当前会话文件的 UTF-8 读取流；仅在定义的统计范围内使用。 */
		const input = createReadStream(sessionFile, { encoding: "utf8" });
/** 变量 rl：逐行异步读取会话文件的 readline 接口；仅在定义的统计范围内使用。 */
		const rl = createInterface({ input, crlfDelay: Infinity });

		for await (const line of rl) {
/** 循环变量 line：当前会话文件中的一行 JSON 文本。 */
			if (!line.trim()) continue;
/** 变量 entry：当前 JSONL 行解析出的会话条目或目录项；仅在定义的统计范围内使用。 */
			let entry;
			try {
				entry = JSON.parse(line);
			} catch {
				meta.malformedLines++;
				continue;
			}
			if (entry?.type !== "message" || !entry.message) continue;
/** 变量 message：当前助手消息对象；仅在定义的统计范围内使用。 */
			const message = entry.message;
			if (message.role !== "assistant" || !Array.isArray(message.content)) continue;
			for (const block of message.content) {
/** 循环变量 block：当前助手消息中的内容块。 */
				if (block?.type !== "toolCall" || block.name !== "read") continue;
				fileHadReadCall = true;
				records.push({
					sessionFile,
					assistantEntryId: entry.id,
					toolCallId: typeof block.id === "string" ? block.id : "",
					timestamp: entry.timestamp,
					timestampMs: Date.parse(entry.timestamp) || sessionTimestampMs || 0,
					api: typeof message.api === "string" ? message.api : null,
					provider: typeof message.provider === "string" ? message.provider : "[unknown]",
					model: typeof message.model === "string" ? message.model : "[unknown]",
					providerModel: `${typeof message.provider === "string" ? message.provider : "[unknown]"}/${typeof message.model === "string" ? message.model : "[unknown]"}`,
					...classifyRead(block.arguments),
				});
			}
		}
		if (fileHadReadCall) meta.sessionFilesWithReadCalls++;
	}
	return { records, meta };
}

/** 按模型子串过滤扫描记录。参数：records, options；返回处理后的统计值或结构。示例：applyFilters(records, options). */
function applyFilters(records, options) {
	return records.filter((record) => !options.modelFilter || record.providerModel.toLowerCase().includes(options.modelFilter.toLowerCase()));
}

/** 协调参数解析、扫描、汇总和最终输出。参数：无；无直接返回值。示例：main(). */
async function main() {
/** 变量 options：合并默认值后的命令行选项对象；仅在定义的统计范围内使用。 */
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		printHelp();
		return;
	}
/** 变量 sessionsDir：解析后的会话根目录绝对路径；仅在定义的统计范围内使用。 */
	const sessionsDir = path.resolve(options.sessionsDir);
	await fs.access(sessionsDir);
/** 变量 since：扫描使用的起始时间及来源；仅在定义的统计范围内使用。 */
	const since = await resolveAutoSinceMs(options);
/** 解构变量：从扫描结果中解构读取记录和扫描元数据。 */
	const { records, meta } = await scanSessions(sessionsDir, since);
/** 变量 filteredRecords：应用模型筛选后的记录集合；仅在定义的统计范围内使用。 */
	const filteredRecords = applyFilters(records, options);
/** 变量 summary：最终用于输出的统计摘要；仅在定义的统计范围内使用。 */
	const summary = buildSummary(filteredRecords, meta, options);
	if (options.json) {
		console.log(JSON.stringify(options.includeRecords ? { summary, records: filteredRecords } : { summary }, null, 2));
		return;
	}
	if (options.text) {
		printHumanReport(summary);
		return;
	}
	printHtmlReport(summary);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
