#!/usr/bin/env node
/**
 * 文件职责：扫描 pi 会话 JSONL，统计 edit 工具的成功率、参数形式、上下文膨胀和同文件多次调用。
 * 技术维度：使用 Node.js 流式文件读取、异步目录遍历、分位数统计和命令行参数解析处理大量会话记录。
 * 产品维度：帮助维护者发现 edit 工具调用低效或失败的模式，为提示词、接口和扩展优化提供数据。
 * 逻辑维度：解析筛选参数后遍历会话，配对工具调用与结果，计算单次指标并分组汇总，最后输出 JSON 或人类报告。
 * 关键边界：默认读取用户会话目录，可能处理敏感路径和大量数据；时间筛选依赖文件名或扩展文件出生时间。
 * 新手阅读建议：先读 parseArgs 和 analyzeReplacement，再看 scanSessions 的配对逻辑，最后阅读 buildSummary 与报告输出。
 */

import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";

/** 常量 DEFAULT_SESSIONS_DIR 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const DEFAULT_SESSIONS_DIR = path.join(homedir(), ".pi/agent/sessions");
/** 常量 DEFAULT_ACTIVE_EDIT_EXTENSION_PATH 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const DEFAULT_ACTIVE_EDIT_EXTENSION_PATH = path.join(homedir(), ".pi/agent/extensions/edit.ts");
/** 常量 DEFAULT_TOP 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
const DEFAULT_TOP = 20;

/** parseArgs 执行当前测试辅助步骤；参数 argv 按签名提供输入，返回值供调用方断言。示例：parseArgs(...)。 */
function parseArgs(argv) {
	/** 常量 options 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const options = {
		sessionsDir: DEFAULT_SESSIONS_DIR,
		json: false,
		includeRecords: false,
		failedOnly: false,
		modelFilter: undefined,
		extFilter: undefined,
		top: DEFAULT_TOP,
		help: false,
		allSessions: false,
		since: undefined,
		autoSincePath: DEFAULT_ACTIVE_EDIT_EXTENSION_PATH,
	};

	/** 循环变量 i 表示当前遍历项或索引，仅在循环体内有效。 */
	for (let i = 0; i < argv.length; i++) {
		/** 常量 arg 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const arg = argv[i];
		if (arg === "--help" || arg === "-h") {
			options.help = true;
		} else if (arg === "--json") {
			options.json = true;
		} else if (arg === "--include-records") {
			options.includeRecords = true;
		} else if (arg === "--failed-only") {
			options.failedOnly = true;
		} else if (arg === "--model") {
			options.modelFilter = argv[++i];
		} else if (arg === "--ext") {
			options.extFilter = argv[++i]?.toLowerCase();
		} else if (arg === "--top") {
			/** 常量 value 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const value = Number.parseInt(argv[++i] ?? "", 10);
			if (!Number.isFinite(value) || value <= 0) {
				throw new Error("--top must be a positive integer");
			}
			options.top = value;
		} else if (arg === "--sessions-dir") {
			options.sessionsDir = argv[++i];
		} else if (arg === "--all-sessions") {
			options.allSessions = true;
		} else if (arg === "--since") {
			options.since = argv[++i];
		} else if (arg === "--auto-since-path") {
			options.autoSincePath = argv[++i];
		} else {
			throw new Error(`Unknown argument: ${arg}`);
		}
	}

	return options;
}

/** printHelp 执行当前测试辅助步骤；参数 无 按签名提供输入，返回值供调用方断言。示例：printHelp()。 */
function printHelp() {
	console.log(`Usage: node scripts/edit-tool-stats.mjs [options]

Options:
  --sessions-dir <path>  Sessions directory (default: ~/.pi/agent/sessions)
  --model <substring>    Filter provider/model by substring
  --ext <extension>      Filter by file extension, e.g. .ts
  --failed-only          Include only failed edit calls
  --top <n>              Number of examples to show (default: ${DEFAULT_TOP})
  --since <iso>          Only scan session files created at or after this ISO time
  --all-sessions         Disable the automatic since filter
  --auto-since-path <p>  Use birth time of this file for the automatic since filter
  --json                 Print JSON summary instead of human report
  --include-records      Include raw records in JSON output
  -h, --help             Show this help
`);
}

/** parseSessionFileTimestamp 执行当前测试辅助步骤；参数 sessionFile 按签名提供输入，返回值供调用方断言。示例：parseSessionFileTimestamp(...)。 */
function parseSessionFileTimestamp(sessionFile) {
	/** 常量 base 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const base = path.basename(sessionFile);
	/** 常量 rawTimestamp 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const rawTimestamp = base.split("_")[0];
	if (!rawTimestamp) return null;
	/** 常量 isoTimestamp 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const isoTimestamp = rawTimestamp.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, "T$1:$2:$3.$4Z");
	/** 常量 ms 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const ms = Date.parse(isoTimestamp);
	if (!Number.isFinite(ms)) return null;
	return ms;
}

/** formatIso 执行当前测试辅助步骤；参数 ms 按签名提供输入，返回值供调用方断言。示例：formatIso(...)。 */
function formatIso(ms) {
	return new Date(ms).toISOString();
}

/** resolveAutoSinceMs 执行当前测试辅助步骤；参数 options 按签名提供输入，返回值供调用方断言。示例：resolveAutoSinceMs(...)。 */
async function resolveAutoSinceMs(options) {
	if (options.allSessions) return null;
	if (options.since) {
		/** 常量 ms 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const ms = Date.parse(options.since);
		if (!Number.isFinite(ms)) {
			throw new Error(`Invalid --since value: ${options.since}`);
		}
		return { ms, source: `--since ${options.since}` };
	}
	if (!options.autoSincePath) return null;
	try {
		/** 常量 stats 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const stats = await fs.stat(options.autoSincePath);
		/** 常量 birthtimeMs 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const birthtimeMs = Number.isFinite(stats.birthtimeMs) && stats.birthtimeMs > 0 ? stats.birthtimeMs : stats.mtimeMs;
		if (!Number.isFinite(birthtimeMs) || birthtimeMs <= 0) return null;
		return { ms: birthtimeMs, source: `birth time of ${options.autoSincePath}` };
	} catch {
		return null;
	}
}

async function* walkJsonlFiles(dir) {
	/** 常量 entries 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const entries = await fs.readdir(dir, { withFileTypes: true });
	entries.sort((a, b) => a.name.localeCompare(b.name));

	/** 循环变量 entry 表示当前遍历项或索引，仅在循环体内有效。 */
	for (const entry of entries) {
		/** 常量 fullPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			yield* walkJsonlFiles(fullPath);
		} else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
			yield fullPath;
		}
	}
}

/** getPathExtension 执行当前测试辅助步骤；参数 filePath 按签名提供输入，返回值供调用方断言。示例：getPathExtension(...)。 */
function getPathExtension(filePath) {
	if (typeof filePath !== "string" || filePath.length === 0) return "[unknown]";
	/** 常量 ext 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const ext = path.extname(filePath).toLowerCase();
	if (ext) return ext;
	/** 常量 base 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const base = path.basename(filePath);
	if (base.startsWith(".") && !base.slice(1).includes(".")) return base.toLowerCase();
	return "[no_ext]";
}

/** utf8Bytes 执行当前测试辅助步骤；参数 value 按签名提供输入，返回值供调用方断言。示例：utf8Bytes(...)。 */
function utf8Bytes(value) {
	return Buffer.byteLength(value ?? "", "utf8");
}

/** longestCommonPrefixLength 执行当前测试辅助步骤；参数 a、b 按签名提供输入，返回值供调用方断言。示例：longestCommonPrefixLength(..., ...)。 */
function longestCommonPrefixLength(a, b) {
	/** 常量 max 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const max = Math.min(a.length, b.length);
	/** 变量 index 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let index = 0;
	while (index < max && a[index] === b[index]) index++;
	return index;
}

/** longestCommonSuffixLength 执行当前测试辅助步骤；参数 a、b 按签名提供输入，返回值供调用方断言。示例：longestCommonSuffixLength(..., ...)。 */
function longestCommonSuffixLength(a, b) {
	/** 常量 max 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const max = Math.min(a.length, b.length);
	/** 变量 index 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	let index = 0;
	while (index < max && a[a.length - 1 - index] === b[b.length - 1 - index]) index++;
	return index;
}

/** analyzeReplacement 执行当前测试辅助步骤；参数 oldText、newText 按签名提供输入，返回值供调用方断言。示例：analyzeReplacement(..., ...)。 */
function analyzeReplacement(oldText, newText) {
	/** 常量 prefixChars 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const prefixChars = longestCommonPrefixLength(oldText, newText);
	/** 常量 oldRemainder 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const oldRemainder = oldText.slice(prefixChars);
	/** 常量 newRemainder 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const newRemainder = newText.slice(prefixChars);
	/** 常量 suffixChars 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const suffixChars = longestCommonSuffixLength(oldRemainder, newRemainder);
	/** 常量 oldCore 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const oldCore = suffixChars > 0 ? oldRemainder.slice(0, -suffixChars) : oldRemainder;
	/** 常量 newCore 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const newCore = suffixChars > 0 ? newRemainder.slice(0, -suffixChars) : newRemainder;
	/** 常量 prefix 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const prefix = oldText.slice(0, prefixChars);
	/** 常量 suffix 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const suffix = suffixChars > 0 ? oldRemainder.slice(-suffixChars) : "";

	/** 常量 oldBytes 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const oldBytes = utf8Bytes(oldText);
	/** 常量 newBytes 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const newBytes = utf8Bytes(newText);
	/** 常量 sharedPrefixBytes 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const sharedPrefixBytes = utf8Bytes(prefix);
	/** 常量 sharedSuffixBytes 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const sharedSuffixBytes = utf8Bytes(suffix);
	/** 常量 sharedContextBytes 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const sharedContextBytes = sharedPrefixBytes + sharedSuffixBytes;
	/** 常量 coreOldBytes 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const coreOldBytes = utf8Bytes(oldCore);
	/** 常量 coreNewBytes 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const coreNewBytes = utf8Bytes(newCore);
	/** 常量 coreBytes 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const coreBytes = coreOldBytes + coreNewBytes;
	/** 常量 totalEditBytes 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const totalEditBytes = oldBytes + newBytes;
	/** 常量 wrapperPayloadBytes 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const wrapperPayloadBytes = totalEditBytes - coreBytes;
	/** 常量 inflationRatio 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const inflationRatio = coreBytes === 0 ? null : totalEditBytes / coreBytes;

	return {
		oldBytes,
		newBytes,
		totalEditBytes,
		sharedPrefixBytes,
		sharedSuffixBytes,
		sharedContextBytes,
		coreOldBytes,
		coreNewBytes,
		coreBytes,
		wrapperPayloadBytes,
		inflationRatio,
		noCoreChange: coreBytes === 0,
	};
}

/** median 执行当前测试辅助步骤；参数 numbers 按签名提供输入，返回值供调用方断言。示例：median(...)。 */
function median(numbers) {
	return quantile(numbers, 0.5);
}

/** quantile 执行当前测试辅助步骤；参数 numbers、q 按签名提供输入，返回值供调用方断言。示例：quantile(..., ...)。 */
function quantile(numbers, q) {
	/** 常量 finite 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const finite = numbers.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
	if (finite.length === 0) return null;
	if (finite.length === 1) return finite[0];
	/** 常量 position 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const position = (finite.length - 1) * q;
	/** 常量 lower 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const lower = Math.floor(position);
	/** 常量 upper 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const upper = Math.ceil(position);
	if (lower === upper) return finite[lower];
	/** 常量 weight 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const weight = position - lower;
	return finite[lower] * (1 - weight) + finite[upper] * weight;
}

/** formatInt 执行当前测试辅助步骤；参数 value 按签名提供输入，返回值供调用方断言。示例：formatInt(...)。 */
function formatInt(value) {
	return new Intl.NumberFormat("en-US").format(value);
}

/** formatPercent 执行当前测试辅助步骤；参数 part、total 按签名提供输入，返回值供调用方断言。示例：formatPercent(..., ...)。 */
function formatPercent(part, total) {
	if (total === 0) return "n/a";
	return `${((part / total) * 100).toFixed(1)}%`;
}

/** formatRatio 执行当前测试辅助步骤；参数 value 按签名提供输入，返回值供调用方断言。示例：formatRatio(...)。 */
function formatRatio(value) {
	if (value === null) return "no-core-change";
	if (!Number.isFinite(value)) return "∞";
	if (value >= 100) return `${value.toFixed(0)}x`;
	if (value >= 10) return `${value.toFixed(1)}x`;
	return `${value.toFixed(2)}x`;
}

/** formatBytes 执行当前测试辅助步骤；参数 value 按签名提供输入，返回值供调用方断言。示例：formatBytes(...)。 */
function formatBytes(value) {
	if (value < 1024) return `${value}B`;
	if (value < 1024 * 1024) return `${(value / 1024).toFixed(value >= 10 * 1024 ? 0 : 1)}KB`;
	return `${(value / (1024 * 1024)).toFixed(1)}MB`;
}

/** extractTextContent 执行当前测试辅助步骤；参数 content 按签名提供输入，返回值供调用方断言。示例：extractTextContent(...)。 */
function extractTextContent(content) {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.filter((block) => block?.type === "text" && typeof block.text === "string")
		.map((block) => block.text)
		.join("\n");
}

/** classifyErrorKind 执行当前测试辅助步骤；参数 text、isError、matchedResult 按签名提供输入，返回值供调用方断言。示例：classifyErrorKind(..., ..., ...)。 */
function classifyErrorKind(text, isError, matchedResult) {
	if (!matchedResult) return "missing_result";
	if (!isError) return null;
	/** 常量 normalized 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const normalized = text.toLowerCase();
	if (normalized.includes("file not found")) return "file_not_found";
	if (normalized.includes("could not find the exact text")) return "not_found_exact_text";
	if (normalized.includes("found multiple occurrences") || /^found \d+ occurrences/m.test(normalized)) {
		return "multiple_occurrences";
	}
	if (normalized.includes("no changes made")) return "no_changes_made";
	if (normalized.includes("input is invalid")) return "invalid_input";
	if (normalized.includes("must not overlap")) return "overlapping_edits";
	if (normalized.includes("aborted")) return "aborted";
	return "other";
}

/** getArgStyle 执行当前测试辅助步骤；参数 args 按签名提供输入，返回值供调用方断言。示例：getArgStyle(...)。 */
function getArgStyle(args) {
	/** 常量 hasEdits 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const hasEdits = Array.isArray(args?.edits);
	/** 常量 hasOldText 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const hasOldText = typeof args?.oldText === "string" || typeof args?.newText === "string";
	/** 常量 hasOldString 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const hasOldString = typeof args?.old_string === "string" || typeof args?.new_string === "string";
	if (hasEdits) return "edits";
	if (hasOldText && hasOldString) return "mixed";
	if (hasOldText) return "oldText/newText";
	if (hasOldString) return "old_string/new_string";
	return "unknown";
}

/** analyzeToolArguments 执行当前测试辅助步骤；参数 args 按签名提供输入，返回值供调用方断言。示例：analyzeToolArguments(...)。 */
function analyzeToolArguments(args) {
	/** 常量 normalizedArgs 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const normalizedArgs = args && typeof args === "object" ? args : {};
	/** 常量 filePath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const filePath = typeof normalizedArgs.path === "string" ? normalizedArgs.path : "";
	/** 常量 extension 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const extension = getPathExtension(filePath);
	/** 常量 argStyle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const argStyle = getArgStyle(normalizedArgs);

	if (Array.isArray(normalizedArgs.edits)) {
		/** 常量 perEdit 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const perEdit = normalizedArgs.edits.map((edit) =>
			analyzeReplacement(typeof edit?.oldText === "string" ? edit.oldText : "", typeof edit?.newText === "string" ? edit.newText : "")
		);
		/** 常量 inflations 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const inflations = perEdit.map((edit) => edit.inflationRatio).filter((value) => value !== null);
		/** 常量 totals 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const totals = perEdit.reduce(
			(acc, edit) => ({
				oldBytes: acc.oldBytes + edit.oldBytes,
				newBytes: acc.newBytes + edit.newBytes,
				totalEditBytes: acc.totalEditBytes + edit.totalEditBytes,
				sharedPrefixBytes: acc.sharedPrefixBytes + edit.sharedPrefixBytes,
				sharedSuffixBytes: acc.sharedSuffixBytes + edit.sharedSuffixBytes,
				sharedContextBytes: acc.sharedContextBytes + edit.sharedContextBytes,
				coreOldBytes: acc.coreOldBytes + edit.coreOldBytes,
				coreNewBytes: acc.coreNewBytes + edit.coreNewBytes,
				coreBytes: acc.coreBytes + edit.coreBytes,
				wrapperPayloadBytes: acc.wrapperPayloadBytes + edit.wrapperPayloadBytes,
				noCoreChangeCount: acc.noCoreChangeCount + (edit.noCoreChange ? 1 : 0),
			}),
			{
				oldBytes: 0,
				newBytes: 0,
				totalEditBytes: 0,
				sharedPrefixBytes: 0,
				sharedSuffixBytes: 0,
				sharedContextBytes: 0,
				coreOldBytes: 0,
				coreNewBytes: 0,
				coreBytes: 0,
				wrapperPayloadBytes: 0,
				noCoreChangeCount: 0,
			}
		);
		return {
			path: filePath,
			extension,
			mode: "multi",
			argStyle,
			editsCount: normalizedArgs.edits.length,
			...totals,
			inflationRatio: totals.coreBytes === 0 ? null : totals.totalEditBytes / totals.coreBytes,
			medianEditInflationRatio: median(inflations),
			maxEditInflationRatio: inflations.length > 0 ? Math.max(...inflations) : null,
			perEdit,
		};
	}

	/** 常量 oldText 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const oldText = typeof normalizedArgs.oldText === "string" ? normalizedArgs.oldText : typeof normalizedArgs.old_string === "string" ? normalizedArgs.old_string : "";
	/** 常量 newText 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const newText = typeof normalizedArgs.newText === "string" ? normalizedArgs.newText : typeof normalizedArgs.new_string === "string" ? normalizedArgs.new_string : "";
	/** 常量 replacement 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const replacement = analyzeReplacement(oldText, newText);
	return {
		path: filePath,
		extension,
		mode: "single",
		argStyle,
		editsCount: 1,
		...replacement,
		medianEditInflationRatio: replacement.inflationRatio,
		maxEditInflationRatio: replacement.inflationRatio,
		perEdit: [replacement],
	};
}

/** groupCounts 执行当前测试辅助步骤；参数 records、keyFn 按签名提供输入，返回值供调用方断言。示例：groupCounts(..., ...)。 */
function groupCounts(records, keyFn) {
	/** 常量 counts 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const counts = new Map();
	/** 循环变量 record 表示当前遍历项或索引，仅在循环体内有效。 */
	for (const record of records) {
		/** 常量 key 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const key = keyFn(record);
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return counts;
}

/** collectInflations 执行当前测试辅助步骤；参数 records 按签名提供输入，返回值供调用方断言。示例：collectInflations(...)。 */
function collectInflations(records) {
	return records.map((record) => record.inflationRatio).filter((value) => value !== null);
}

/** summarizeGroups 执行当前测试辅助步骤；参数 records、keyFn 按签名提供输入，返回值供调用方断言。示例：summarizeGroups(..., ...)。 */
function summarizeGroups(records, keyFn) {
	/** 常量 groups 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const groups = new Map();
	/** 循环变量 record 表示当前遍历项或索引，仅在循环体内有效。 */
	for (const record of records) {
		/** 常量 key 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const key = keyFn(record);
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(record);
	}

	return [...groups.entries()]
		.map(([key, group]) => {
			/** 常量 resolved 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const resolved = group.filter((record) => record.success !== null);
			/** 常量 success 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const success = resolved.filter((record) => record.success).length;
			/** 常量 failed 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const failed = resolved.filter((record) => record.success === false).length;
			/** 常量 multi 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const multi = group.filter((record) => record.mode === "multi").length;
			/** 常量 inflations 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const inflations = collectInflations(group);
			return {
				key,
				calls: group.length,
				resolved: resolved.length,
				success,
				failed,
				unresolved: group.length - resolved.length,
				multi,
				multiRate: group.length === 0 ? null : multi / group.length,
				successRate: resolved.length === 0 ? null : success / resolved.length,
				medianInflation: quantile(inflations, 0.5),
				p95Inflation: quantile(inflations, 0.95),
			};
		})
		.sort((a, b) => b.calls - a.calls || a.key.localeCompare(b.key));
}

/** buildSameFileClusterStats 执行当前测试辅助步骤；参数 records 按签名提供输入，返回值供调用方断言。示例：buildSameFileClusterStats(...)。 */
function buildSameFileClusterStats(records) {
	/** 常量 groups 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const groups = new Map();
	/** 循环变量 record 表示当前遍历项或索引，仅在循环体内有效。 */
	for (const record of records) {
		/** 常量 key 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const key = `${record.sessionFile}::${record.assistantEntryId}::${record.path}`;
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(record);
	}

	/** 常量 clusters 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const clusters = [...groups.values()].filter((group) => group.length >= 2);
	/** 常量 assistantMessagesWithCluster 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const assistantMessagesWithCluster = new Set(clusters.map((group) => `${group[0].sessionFile}::${group[0].assistantEntryId}`));
	/** 常量 assistantMessagesWithMultiEdit 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const assistantMessagesWithMultiEdit = new Set(
		records
			.filter((record) => record.mode === "multi" && record.editsCount > 1)
			.map((record) => `${record.sessionFile}::${record.assistantEntryId}`)
	);
	/** 常量 callsInsideClusters 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const callsInsideClusters = clusters.reduce((sum, group) => sum + group.length, 0);

	return {
		clustersCount: clusters.length,
		assistantMessagesWithCluster: assistantMessagesWithCluster.size,
		assistantMessagesWithMultiEdit: assistantMessagesWithMultiEdit.size,
		callsInsideClusters,
		averageCallsPerCluster: clusters.length === 0 ? null : callsInsideClusters / clusters.length,
		ratioClusterAssistantMessagesToMultiEditAssistantMessages:
			assistantMessagesWithMultiEdit.size === 0 ? null : assistantMessagesWithCluster.size / assistantMessagesWithMultiEdit.size,
	};
}

/** buildInflationBuckets 执行当前测试辅助步骤；参数 records 按签名提供输入，返回值供调用方断言。示例：buildInflationBuckets(...)。 */
function buildInflationBuckets(records) {
	/** 常量 buckets 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const buckets = [
		{ key: "no_core_change", label: "no-core-change", test: (record) => record.inflationRatio === null },
		{ key: "lt4", label: "<4x", test: (record) => record.inflationRatio !== null && record.inflationRatio < 4 },
		{ key: "4to10", label: "4-10x", test: (record) => record.inflationRatio !== null && record.inflationRatio >= 4 && record.inflationRatio < 10 },
		{ key: "10to25", label: "10-25x", test: (record) => record.inflationRatio !== null && record.inflationRatio >= 10 && record.inflationRatio < 25 },
		{ key: "gte25", label: "25x+", test: (record) => record.inflationRatio !== null && record.inflationRatio >= 25 },
	];

	return buckets.map((bucket) => {
		/** 常量 bucketRecords 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const bucketRecords = records.filter(bucket.test);
		/** 常量 resolved 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const resolved = bucketRecords.filter((record) => record.success !== null);
		/** 常量 failed 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const failed = resolved.filter((record) => record.success === false).length;
		return {
			key: bucket.key,
			label: bucket.label,
			count: bucketRecords.length,
			resolved: resolved.length,
			failed,
			failureRate: resolved.length === 0 ? null : failed / resolved.length,
		};
	});
}

/** buildHugeReplacementStats 执行当前测试辅助步骤；参数 records 按签名提供输入，返回值供调用方断言。示例：buildHugeReplacementStats(...)。 */
function buildHugeReplacementStats(records) {
	/** 常量 thresholds 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const thresholds = [1024, 4096, 16384, 65536];
	return thresholds.map((threshold) => ({
		threshold,
		count: records.filter((record) => record.totalEditBytes > threshold).length,
	}));
}

/** buildWorstExamples 执行当前测试辅助步骤；参数 records、top 按签名提供输入，返回值供调用方断言。示例：buildWorstExamples(..., ...)。 */
function buildWorstExamples(records, top) {
	/** 常量 scored 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const scored = [...records].sort((a, b) => {
		/** 常量 aScore 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const aScore = a.inflationRatio === null ? Number.POSITIVE_INFINITY : a.inflationRatio;
		/** 常量 bScore 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const bScore = b.inflationRatio === null ? Number.POSITIVE_INFINITY : b.inflationRatio;
		if (aScore !== bScore) return bScore - aScore;
		if (a.totalEditBytes !== b.totalEditBytes) return b.totalEditBytes - a.totalEditBytes;
		return a.path.localeCompare(b.path);
	});

	return scored.slice(0, top).map((record) => ({
		providerModel: record.providerModel,
		extension: record.extension,
		path: record.path,
		inflationRatio: record.inflationRatio,
		totalEditBytes: record.totalEditBytes,
		coreBytes: record.coreBytes,
		mode: record.mode,
		editsCount: record.editsCount,
		failed: record.success === false,
		errorKind: record.errorKind,
		sessionFile: record.sessionFile,
	}));
}

/** buildSummary 执行当前测试辅助步骤；参数 records、meta、options 按签名提供输入，返回值供调用方断言。示例：buildSummary(..., ..., ...)。 */
function buildSummary(records, meta, options) {
	/** 常量 uniqueAssistantMessages 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const uniqueAssistantMessages = new Set(records.map((record) => `${record.sessionFile}::${record.assistantEntryId}`)).size;
	/** 常量 resolved 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const resolved = records.filter((record) => record.success !== null);
	/** 常量 success 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const success = resolved.filter((record) => record.success).length;
	/** 常量 failed 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const failed = resolved.filter((record) => record.success === false).length;
	/** 常量 unresolved 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const unresolved = records.length - resolved.length;
	/** 常量 single 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const single = records.filter((record) => record.mode === "single").length;
	/** 常量 multi 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const multi = records.filter((record) => record.mode === "multi").length;
	/** 常量 modeStats 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const modeStats = ["single", "multi"].map((mode) => {
		/** 常量 modeRecords 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const modeRecords = records.filter((record) => record.mode === mode);
		/** 常量 modeResolved 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const modeResolved = modeRecords.filter((record) => record.success !== null);
		/** 常量 modeSuccess 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const modeSuccess = modeResolved.filter((record) => record.success).length;
		/** 常量 modeFailed 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const modeFailed = modeResolved.filter((record) => record.success === false).length;
		return {
			mode,
			calls: modeRecords.length,
			resolved: modeResolved.length,
			success: modeSuccess,
			failed: modeFailed,
			unresolved: modeRecords.length - modeResolved.length,
			successRate: modeResolved.length === 0 ? null : modeSuccess / modeResolved.length,
			failureRate: modeResolved.length === 0 ? null : modeFailed / modeResolved.length,
		};
	});
	/** 常量 multiEditLengthBuckets 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const multiEditLengthBuckets = [
		{ key: "1", label: "edits.length === 1", test: (record) => record.mode === "multi" && record.editsCount === 1 },
		{ key: "2", label: "edits.length === 2", test: (record) => record.mode === "multi" && record.editsCount === 2 },
		{ key: "3plus", label: "edits.length >= 3", test: (record) => record.mode === "multi" && record.editsCount >= 3 },
	].map((bucket) => {
		/** 常量 bucketRecords 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const bucketRecords = records.filter(bucket.test);
		/** 常量 bucketResolved 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const bucketResolved = bucketRecords.filter((record) => record.success !== null);
		/** 常量 bucketSuccess 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const bucketSuccess = bucketResolved.filter((record) => record.success).length;
		/** 常量 bucketFailed 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const bucketFailed = bucketResolved.filter((record) => record.success === false).length;
		return {
			key: bucket.key,
			label: bucket.label,
			calls: bucketRecords.length,
			resolved: bucketResolved.length,
			success: bucketSuccess,
			failed: bucketFailed,
			unresolved: bucketRecords.length - bucketResolved.length,
			successRate: bucketResolved.length === 0 ? null : bucketSuccess / bucketResolved.length,
			failureRate: bucketResolved.length === 0 ? null : bucketFailed / bucketResolved.length,
		};
	});
	/** 常量 argStyles 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const argStyles = [...groupCounts(records, (record) => record.argStyle).entries()]
		.map(([style, count]) => ({ style, count }))
		.sort((a, b) => b.count - a.count || a.style.localeCompare(b.style));
	/** 常量 providerStats 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const providerStats = summarizeGroups(records, (record) => record.providerModel);
	/** 常量 extensionStats 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const extensionStats = summarizeGroups(records, (record) => record.extension);
	/** 常量 inflations 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const inflations = collectInflations(records);
	/** 常量 noCoreChange 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const noCoreChange = records.filter((record) => record.inflationRatio === null).length;
	/** 常量 pathologicalThresholds 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const pathologicalThresholds = [10, 25, 100].map((threshold) => ({
		threshold,
		count: records.filter((record) => record.inflationRatio !== null && record.inflationRatio >= threshold).length,
	}));
	/** 常量 failureKinds 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const failureKinds = [...groupCounts(records.filter((record) => record.success === false), (record) => record.errorKind ?? "other").entries()]
		.map(([kind, count]) => ({ kind, count }))
		.sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind));

	return {
		filters: {
			model: options.modelFilter ?? null,
			extension: options.extFilter ?? null,
			failedOnly: options.failedOnly,
		},
		scan: {
			sessionsDir: meta.sessionsDir,
			sessionFilesScanned: meta.sessionFilesScanned,
			sessionFilesIncluded: meta.sessionFilesIncluded,
			sessionFilesSkippedOlderThanSince: meta.sessionFilesSkippedOlderThanSince,
			sessionFilesWithEditCalls: meta.sessionFilesWithEditCalls,
			since: meta.since ? { ms: meta.since.ms, iso: formatIso(meta.since.ms), source: meta.since.source } : null,
			malformedLines: meta.malformedLines,
			unmatchedToolResults: meta.unmatchedToolResults,
		},
		counts: {
			assistantMessagesWithEditCalls: uniqueAssistantMessages,
			totalEditCalls: records.length,
			resolvedEditCalls: resolved.length,
			success,
			failed,
			unresolved,
			single,
			multi,
			noCoreChange,
		},
		modeStats,
		multiEditLengthBuckets,
		argStyles,
		providerStats,
		extensionStats,
		inflation: {
			median: quantile(inflations, 0.5),
			p90: quantile(inflations, 0.9),
			p95: quantile(inflations, 0.95),
			p99: quantile(inflations, 0.99),
			pathologicalThresholds,
			hugeReplacements: buildHugeReplacementStats(records),
			failureByBucket: buildInflationBuckets(records),
		},
		sameFileClusters: buildSameFileClusterStats(records),
		failureKinds,
		worstExamples: buildWorstExamples(records, options.top),
	};
}

/** printGroupTable 执行当前测试辅助步骤；参数 title、groups、formatter 按签名提供输入，返回值供调用方断言。示例：printGroupTable(..., ..., ...)。 */
function printGroupTable(title, groups, formatter) {
	if (groups.length === 0) return;
	console.log(`\n${title}`);
	/** 循环变量 group 表示当前遍历项或索引，仅在循环体内有效。 */
	for (const group of groups) {
		console.log(formatter(group));
	}
}

/** printHumanReport 执行当前测试辅助步骤；参数 summary 按签名提供输入，返回值供调用方断言。示例：printHumanReport(...)。 */
function printHumanReport(summary) {
	/** 常量 { scan, counts, modeStats, multiEditLengthBuckets, argStyles, providerStats, extensionStats, inflation, sameFileClusters, failureKinds, worstExamples, filters } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const { scan, counts, modeStats, multiEditLengthBuckets, argStyles, providerStats, extensionStats, inflation, sameFileClusters, failureKinds, worstExamples, filters } = summary;
	console.log(`Scanned ${formatInt(scan.sessionFilesIncluded)} session files in ${scan.sessionsDir}`);
	if (scan.since) {
		console.log(`Session filter: files created at or after ${scan.since.iso} (${scan.since.source})`);
		console.log(`Skipped older session files: ${formatInt(scan.sessionFilesSkippedOlderThanSince)} of ${formatInt(scan.sessionFilesScanned)}`);
	}
	console.log(`Found ${formatInt(counts.totalEditCalls)} edit tool calls in ${formatInt(counts.assistantMessagesWithEditCalls)} assistant messages`);
	if (filters.model || filters.extension || filters.failedOnly) {
		/** 常量 filterParts 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const filterParts = [];
		if (filters.model) filterParts.push(`model contains \"${filters.model}\"`);
		if (filters.extension) filterParts.push(`extension = ${filters.extension}`);
		if (filters.failedOnly) filterParts.push("failed only");
		console.log(`Filters: ${filterParts.join(", ")}`);
	}

	console.log("\nSuccess rate");
	console.log(`  success:    ${formatInt(counts.success)}  ${formatPercent(counts.success, counts.resolvedEditCalls)}`);
	console.log(`  failed:     ${formatInt(counts.failed)}  ${formatPercent(counts.failed, counts.resolvedEditCalls)}`);
	console.log(`  unresolved: ${formatInt(counts.unresolved)}`);

	console.log("\nMode usage");
	console.log(`  single replacement: ${formatInt(counts.single)}  ${formatPercent(counts.single, counts.totalEditCalls)}`);
	console.log(`  multi-edit (edits): ${formatInt(counts.multi)}  ${formatPercent(counts.multi, counts.totalEditCalls)}`);

	console.log("\nFailures by edit type");
	/** 循环变量 mode 表示当前遍历项或索引，仅在循环体内有效。 */
	for (const mode of modeStats) {
		console.log(
			`  ${mode.mode.padEnd(6)} calls=${formatInt(mode.calls).padStart(4)} success=${mode.successRate === null ? "n/a" : formatPercent(mode.success, mode.resolved).padStart(6)} failed=${mode.failureRate === null ? "n/a" : formatPercent(mode.failed, mode.resolved).padStart(6)} unresolved=${formatInt(mode.unresolved)}`
		);
	}

	console.log("\nMulti-edit bucket split");
	/** 循环变量 bucket 表示当前遍历项或索引，仅在循环体内有效。 */
	for (const bucket of multiEditLengthBuckets) {
		console.log(
			`  ${bucket.label.padEnd(20)} ${formatInt(bucket.calls).padStart(4)} calls  success=${bucket.successRate === null ? "n/a" : formatPercent(bucket.success, bucket.resolved).padStart(6)} failed=${bucket.failureRate === null ? "n/a" : formatPercent(bucket.failed, bucket.resolved).padStart(6)}`
		);
	}

	console.log("\nArgument style");
	/** 循环变量 entry 表示当前遍历项或索引，仅在循环体内有效。 */
	for (const entry of argStyles) {
		console.log(`  ${entry.style.padEnd(22)} ${formatInt(entry.count).padStart(8)}  ${formatPercent(entry.count, counts.totalEditCalls)}`);
	}

	printGroupTable("By provider/model", providerStats, (group) => {
		return [
			`  ${group.key}`,
			`    calls: ${formatInt(group.calls)}`,
			`    success: ${group.successRate === null ? "n/a" : formatPercent(group.success, group.resolved)}`,
			`    multi-edit: ${group.multiRate === null ? "n/a" : formatPercent(group.multi, group.calls)}`,
			`    median inflation: ${formatRatio(group.medianInflation)}`,
			`    p95 inflation: ${formatRatio(group.p95Inflation)}`,
		].join("\n");
	});

	printGroupTable("By file extension", extensionStats, (group) => {
		return `  ${group.key.padEnd(10)} calls=${formatInt(group.calls).padStart(6)}  success=${group.successRate === null ? "n/a" : formatPercent(group.success, group.resolved).padStart(6)}  medianInflation=${formatRatio(group.medianInflation)}`;
	});

	console.log("\nContext inflation");
	console.log(`  median inflation: ${formatRatio(inflation.median)}`);
	console.log(`  p90 inflation:    ${formatRatio(inflation.p90)}`);
	console.log(`  p95 inflation:    ${formatRatio(inflation.p95)}`);
	console.log(`  p99 inflation:    ${formatRatio(inflation.p99)}`);
	console.log(`  no-core-change:   ${formatInt(counts.noCoreChange)}`);

	console.log("\nHuge replacements");
	/** 循环变量 entry 表示当前遍历项或索引，仅在循环体内有效。 */
	for (const entry of inflation.hugeReplacements) {
		console.log(`  >${formatBytes(entry.threshold).padEnd(6)} ${formatInt(entry.count).padStart(8)}`);
	}

	console.log("\nPathological wrappers");
	/** 循环变量 entry 表示当前遍历项或索引，仅在循环体内有效。 */
	for (const entry of inflation.pathologicalThresholds) {
		console.log(`  inflation >= ${String(entry.threshold).padEnd(3)}x ${formatInt(entry.count).padStart(8)}`);
	}

	console.log("\nSame-file multi-call behavior");
	console.log(`  assistant msgs with 2+ edit calls to same file: ${formatInt(sameFileClusters.assistantMessagesWithCluster)}`);
	console.log(`  total same-file clusters:                      ${formatInt(sameFileClusters.clustersCount)}`);
	console.log(`  calls inside those clusters:                  ${formatInt(sameFileClusters.callsInsideClusters)}`);
	console.log(`  average calls per cluster:                    ${sameFileClusters.averageCallsPerCluster === null ? "n/a" : sameFileClusters.averageCallsPerCluster.toFixed(2)}`);
	console.log(`  assistant msgs using one multi-edit call:     ${formatInt(sameFileClusters.assistantMessagesWithMultiEdit)}`);
	console.log(`  ratio multi-call / multi-edit assistant msgs: ${sameFileClusters.ratioClusterAssistantMessagesToMultiEditAssistantMessages === null ? "n/a" : sameFileClusters.ratioClusterAssistantMessagesToMultiEditAssistantMessages.toFixed(2)}`);

	console.log("\nFailures by kind");
	if (failureKinds.length === 0) {
		console.log("  none");
	} else {
		/** 循环变量 failure 表示当前遍历项或索引，仅在循环体内有效。 */
		for (const failure of failureKinds) {
			console.log(`  ${failure.kind.padEnd(22)} ${formatInt(failure.count).padStart(8)}`);
		}
	}

	console.log("\nFailure rate by inflation bucket");
	/** 循环变量 bucket 表示当前遍历项或索引，仅在循环体内有效。 */
	for (const bucket of inflation.failureByBucket) {
		console.log(`  ${bucket.label.padEnd(14)} ${bucket.failureRate === null ? "n/a" : formatPercent(bucket.failed, bucket.resolved).padStart(6)}  (${formatInt(bucket.count)} calls)`);
	}

	console.log(`\nWorst ${formatInt(worstExamples.length)} examples`);
	/** 循环变量 i 表示当前遍历项或索引，仅在循环体内有效。 */
	for (let i = 0; i < worstExamples.length; i++) {
		/** 常量 example 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const example = worstExamples[i];
		console.log(
			`  ${i + 1}. ${example.providerModel} ${example.extension} inflation=${formatRatio(example.inflationRatio)} failed=${example.failed ? example.errorKind : "false"}`
		);
		console.log(`     path: ${example.path}`);
		console.log(`     totalEditBytes=${formatBytes(example.totalEditBytes)} coreBytes=${formatBytes(example.coreBytes)} mode=${example.mode} edits=${example.editsCount}`);
	}

	if (scan.malformedLines > 0 || scan.unmatchedToolResults > 0) {
		console.log("\nParser notes");
		if (scan.malformedLines > 0) console.log(`  malformed lines skipped: ${formatInt(scan.malformedLines)}`);
		if (scan.unmatchedToolResults > 0) console.log(`  unmatched edit tool results: ${formatInt(scan.unmatchedToolResults)}`);
	}
}

/** scanSessions 执行当前测试辅助步骤；参数 sessionsDir、since 按签名提供输入，返回值供调用方断言。示例：scanSessions(..., ...)。 */
async function scanSessions(sessionsDir, since) {
	/** 常量 records 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const records = [];
	/** 常量 meta 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const meta = {
		sessionsDir,
		sessionFilesScanned: 0,
		sessionFilesIncluded: 0,
		sessionFilesSkippedOlderThanSince: 0,
		sessionFilesWithEditCalls: 0,
		since,
		malformedLines: 0,
		unmatchedToolResults: 0,
	};

	for await (const sessionFile of walkJsonlFiles(sessionsDir)) {
		meta.sessionFilesScanned++;
		/** 常量 sessionTimestampMs 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const sessionTimestampMs = parseSessionFileTimestamp(sessionFile);
		if (since && sessionTimestampMs !== null && sessionTimestampMs < since.ms) {
			meta.sessionFilesSkippedOlderThanSince++;
			continue;
		}
		meta.sessionFilesIncluded++;
		/** 常量 pending 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const pending = new Map();
		/** 变量 fileHadEditCall 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let fileHadEditCall = false;
		/** 常量 input 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const input = createReadStream(sessionFile, { encoding: "utf8" });
		/** 常量 rl 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const rl = createInterface({ input, crlfDelay: Infinity });

		for await (const line of rl) {
			if (!line.trim()) continue;
			/** 变量 entry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			let entry;
			try {
				entry = JSON.parse(line);
			} catch {
				meta.malformedLines++;
				continue;
			}

			if (entry?.type !== "message" || !entry.message) continue;
			/** 常量 message 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const message = entry.message;

			if (message.role === "assistant" && Array.isArray(message.content)) {
				/** 循环变量 block 表示当前遍历项或索引，仅在循环体内有效。 */
				for (const block of message.content) {
					if (block?.type !== "toolCall" || block.name !== "edit") continue;
					fileHadEditCall = true;
					/** 常量 analysis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const analysis = analyzeToolArguments(block.arguments);
					/** 常量 record 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
					const record = {
						sessionFile,
						assistantEntryId: entry.id,
						toolCallId: typeof block.id === "string" ? block.id : "",
						timestamp: entry.timestamp,
						api: typeof message.api === "string" ? message.api : null,
						provider: typeof message.provider === "string" ? message.provider : "[unknown]",
						model: typeof message.model === "string" ? message.model : "[unknown]",
						providerModel: `${typeof message.provider === "string" ? message.provider : "[unknown]"}/${typeof message.model === "string" ? message.model : "[unknown]"}`,
						success: null,
						errorKind: null,
						errorText: "",
						resultSummary: "",
						matchedResult: false,
						...analysis,
					};
					records.push(record);
					if (record.toolCallId) pending.set(record.toolCallId, record);
				}
			}

			if (message.role === "toolResult" && message.toolName === "edit") {
				/** 常量 toolCallId 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const toolCallId = typeof message.toolCallId === "string" ? message.toolCallId : "";
				/** 常量 record 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const record = pending.get(toolCallId);
				if (!record) {
					meta.unmatchedToolResults++;
					continue;
				}
				/** 常量 text 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const text = extractTextContent(message.content);
				record.matchedResult = true;
				record.success = message.isError === true ? false : true;
				record.resultSummary = text;
				record.errorText = message.isError === true ? text : "";
				record.errorKind = classifyErrorKind(text, message.isError === true, true);
				pending.delete(toolCallId);
			}
		}

		/** 循环变量 record 表示当前遍历项或索引，仅在循环体内有效。 */
		for (const record of pending.values()) {
			record.matchedResult = false;
			record.success = null;
			record.errorKind = classifyErrorKind("", false, false);
		}

		if (fileHadEditCall) meta.sessionFilesWithEditCalls++;
	}

	return { records, meta };
}

/** applyFilters 执行当前测试辅助步骤；参数 records、options 按签名提供输入，返回值供调用方断言。示例：applyFilters(..., ...)。 */
function applyFilters(records, options) {
	return records.filter((record) => {
		if (options.modelFilter && !record.providerModel.toLowerCase().includes(options.modelFilter.toLowerCase())) {
			return false;
		}
		if (options.extFilter && record.extension !== options.extFilter) {
			return false;
		}
		if (options.failedOnly && record.success !== false) {
			return false;
		}
		return true;
	});
}

/** main 执行当前测试辅助步骤；参数 无 按签名提供输入，返回值供调用方断言。示例：main()。 */
async function main() {
	/** 常量 options 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		printHelp();
		return;
	}

	/** 常量 sessionsDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const sessionsDir = path.resolve(options.sessionsDir);
	await fs.access(sessionsDir);
	/** 常量 since 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const since = await resolveAutoSinceMs(options);

	/** 常量 { records, meta } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const { records, meta } = await scanSessions(sessionsDir, since);
	/** 常量 filteredRecords 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const filteredRecords = applyFilters(records, options);
	/** 常量 summary 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const summary = buildSummary(filteredRecords, meta, options);

	if (options.json) {
		/** 常量 output 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const output = options.includeRecords ? { summary, records: filteredRecords } : { summary };
		console.log(JSON.stringify(output, null, 2));
		return;
	}

	printHumanReport(summary);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
