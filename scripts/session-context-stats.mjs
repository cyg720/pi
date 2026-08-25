#!/usr/bin/env node

/**
 * 文件职责：扫描 Pi 会话 JSONL，统计上下文使用率、压缩频率、会话时长和模型分布，并输出文本、JSON 或 HTML 报告。
 * 技术维度：使用流式逐行读取、异步递归遍历、Intl 时区格式化、模型目录正则解析和分组聚合。
 * 产品维度：帮助维护者识别接近上下文上限的会话与模型，评估压缩策略和实际使用模式。
 * 逻辑维度：解析筛选参数并加载上下文窗口，扫描每个会话，按天/模型汇总，最后渲染指定格式。
 * 关键边界：usage 可能缺失并采用字段求和回退；默认只统计当前 cwd；模型窗口来源文件均为可选。
 * 新手阅读建议：先看 scanSessions 理解原始数据，再看 summarizeSessionGroup/buildSummary，最后阅读报告渲染函数。
 */

import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";

/** 默认 Pi 会话根目录。 */
const DEFAULT_SESSIONS_DIR = path.join(homedir(), ".pi/agent/sessions");
/** 仓库生成模型目录路径，用于读取上下文窗口。 */
const MODELS_GENERATED_PATH = path.join(process.cwd(), "packages/ai/src/models.generated.ts");
/** 用户模型覆盖配置路径。 */
const MODELS_CONFIG_PATH = path.join(homedir(), ".pi/agent/models.json");
/** 报告按天分组使用的时区。 */
const REPORT_TIME_ZONE = "Europe/Berlin";
/** 文本条形图的字符宽度。 */
const CHART_WIDTH = 40;

/** 解析报告命令行参数。返回带默认值的选项。示例：parseArgs(process.argv.slice(2))。 */
function parseArgs(argv) {
	/** 所有筛选与输出选项。 */
	const options = { sessionsDir: DEFAULT_SESSIONS_DIR, json: false, text: false, allSessions: false, since: undefined, modelFilter: undefined, modelPrefixes: [], bashContains: [], cwd: process.cwd(), help: false };
	for (let i = 0; i < argv.length; i++) {
		/** 当前正在处理的参数。 */
		const arg = argv[i];
		if (arg === "--help" || arg === "-h") options.help = true;
		else if (arg === "--json") options.json = true;
		else if (arg === "--text") options.text = true;
		else if (arg === "--sessions-dir") options.sessionsDir = argv[++i];
		else if (arg === "--since") options.since = argv[++i];
		else if (arg === "--all-sessions") options.allSessions = true;
		else if (arg === "--model") options.modelFilter = argv[++i];
		else if (arg === "--model-prefix") options.modelPrefixes.push(argv[++i]);
		else if (arg === "--bash-contains") options.bashContains.push(argv[++i]);
		else if (arg === "--git-commit-or-push") options.bashContains.push("git commit", "git push");
		else if (arg === "--cwd") options.cwd = argv[++i];
		else if (arg === "--all-cwds") options.cwd = undefined;
		else throw new Error(`Unknown argument: ${arg}`);
	}
	return options;
}

/** 输出命令帮助。无返回值。 */
function printHelp() {
	console.log(`Usage: node scripts/session-context-stats.mjs [options]

Options:
  --sessions-dir <path>  Sessions directory (default: ~/.pi/agent/sessions)
  --model <substring>    Filter provider/model by substring
  --model-prefix <p>     Include provider/model prefixes, repeatable, e.g. openai-codex/
  --bash-contains <text> Include only sessions with bash tool calls containing text, repeatable
  --git-commit-or-push   Shortcut for --bash-contains "git commit" --bash-contains "git push"
  --cwd <path>           Include only sessions whose cwd is this path (default: current cwd)
  --all-cwds             Include sessions from all cwd values
  --since <iso>          Only scan session files created at or after this ISO time
  --all-sessions         Scan all sessions (default already scans all)
  --json                 Print JSON instead of HTML report
  --text                 Print plain text instead of HTML report
  -h, --help             Show this help
`);
}

/** 从会话文件名解析创建时间。返回毫秒时间戳或 null。 */
function parseSessionFileTimestamp(sessionFile) {
	/** 文件名下划线前的时间戳部分。 */
	const rawTimestamp = path.basename(sessionFile).split("_")[0];
	if (!rawTimestamp) return null;
	/** 将文件名时间格式转换为 ISO 后解析的毫秒值。 */
	const ms = Date.parse(rawTimestamp.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, "T$1:$2:$3.$4Z"));
	return Number.isFinite(ms) ? ms : null;
}

/** 按报告时区提取年、月、日部分。返回字段对象。 */
function getTimeZoneParts(ms) {
	/** Intl 格式化得到的日期部分。 */
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: REPORT_TIME_ZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(new Date(ms));
	return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

/** 把时间戳格式化为报告时区的 YYYY-MM-DD。 */
function formatDay(ms) {
	/** 指定时区的年月日字段。 */
	const parts = getTimeZoneParts(ms);
	return `${parts.year}-${parts.month}-${parts.day}`;
}

/** 四舍五入并按 en-US 千分位格式化数字。 */
function formatInt(value) {
	return new Intl.NumberFormat("en-US").format(Math.round(value));
}

/** 将有限数值保留两位小数，否则返回 n/a。 */
function formatNumber(value) {
	return Number.isFinite(value) ? value.toFixed(2) : "n/a";
}

/** 将有限数值格式化为一位小数百分比，否则返回 n/a。 */
function formatPercent(value) {
	return Number.isFinite(value) ? `${value.toFixed(1)}%` : "n/a";
}

/** 将百分比限制在 0-100 并生成固定宽度字符条。 */
function bar(percent) {
	/** 限制到图表范围内的百分比。 */
	const clamped = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
	/** 实心字符数量。 */
	const filled = Math.round((clamped / 100) * CHART_WIDTH);
	return `${"█".repeat(filled)}${"░".repeat(CHART_WIDTH - filled)}`;
}

/** 计算有限值中位数，空集合返回 null。 */
function median(values) {
	/** 过滤并升序排列的有限样本。 */
	const finite = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
	if (finite.length === 0) return null;
	/** 中间位置索引。 */
	const middle = Math.floor(finite.length / 2);
	return finite.length % 2 === 0 ? (finite[middle - 1] + finite[middle]) / 2 : finite[middle];
}

/** 异步递归遍历目录并按名称顺序产出 .jsonl 文件。 */
async function* walkJsonlFiles(dir) {
	/** 当前目录排序后的目录项。 */
	const entries = await fs.readdir(dir, { withFileTypes: true });
	entries.sort((a, b) => a.name.localeCompare(b.name));
	for (const entry of entries) {
		/** 当前目录项完整路径。 */
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) yield* walkJsonlFiles(fullPath);
		else if (entry.isFile() && entry.name.endsWith(".jsonl")) yield fullPath;
	}
}

/** 从生成模型文件和用户配置加载 provider/model 上下文窗口。返回 Map 与来源列表。 */
async function loadContextWindows() {
	/** provider/model 到 contextWindow 的映射。 */
	const windows = new Map();
	/** 成功读取的上下文窗口来源文件。 */
	const sources = [];
	/** 生成模型文件文本，读取失败时保持空串。 */
	let text = "";
	try {
		text = await fs.readFile(MODELS_GENERATED_PATH, "utf8");
		sources.push(MODELS_GENERATED_PATH);
	} catch {
		// Optional in non-repo usage.
		// 脱离仓库使用时生成模型文件可不存在。
	}
	/** 从生成聚合文件提取提供商代码块的正则。 */
	const providerRegex = /\n\t"([^"]+)": \{([\s\S]*?\n\t)\},/g;
	/** 当前提供商正则匹配。 */
	let providerMatch;
	while ((providerMatch = providerRegex.exec(text)) !== null) {
		/** 当前提供商 ID。 */
		const provider = providerMatch[1];
		/** 当前提供商模型对象代码块。 */
		const body = providerMatch[2];
		/** 从提供商代码块提取模型 ID 与 contextWindow 的正则。 */
		const modelRegex = /\n\t\t"([^"]+)": \{[\s\S]*?contextWindow: (\d+),/g;
		/** 当前模型正则匹配。 */
		let modelMatch;
		while ((modelMatch = modelRegex.exec(body)) !== null) {
			windows.set(`${provider}/${modelMatch[1]}`, Number(modelMatch[2]));
		}
	}

	try {
		/** 解析后的用户 models.json。 */
		const config = JSON.parse(await fs.readFile(MODELS_CONFIG_PATH, "utf8"));
		sources.push(MODELS_CONFIG_PATH);
		/** 用户配置中的提供商对象。 */
		const providers = config?.providers && typeof config.providers === "object" ? config.providers : {};
		for (const [providerName, provider] of Object.entries(providers)) {
			/** 当前提供商按模型 ID 配置的覆盖。 */
			const overrides = provider?.modelOverrides && typeof provider.modelOverrides === "object" ? provider.modelOverrides : {};
			/** modelId 与 override 是当前模型标识及其覆盖配置；只收集数值型上下文窗口。 */
			for (const [modelId, override] of Object.entries(overrides)) {
				if (typeof override?.contextWindow === "number") windows.set(`${providerName}/${modelId}`, override.contextWindow);
			}
			if (Array.isArray(provider?.models)) {
				/** model 是提供商内联定义的当前模型；标识和窗口均有效时才加入映射。 */
				for (const model of provider.models) {
					if (typeof model?.id === "string" && typeof model.contextWindow === "number") windows.set(`${providerName}/${model.id}`, model.contextWindow);
				}
			}
		}
	} catch {
		// Optional user config.
		// 用户 models.json 可不存在或不可解析。
	}

	return { windows, sources };
}

/** 从 usage 提取总上下文 Token；优先 totalTokens，回退四字段求和，无有效值返回 null。 */
function contextTokens(usage) {
	if (!usage || typeof usage !== "object") return null;
	/** 显式 totalTokens 数值。 */
	const totalTokens = Number(usage.totalTokens ?? 0);
	if (Number.isFinite(totalTokens) && totalTokens > 0) return totalTokens;
	/** 输入 Token。 */
	const input = Number(usage.input ?? 0);
	/** 输出 Token。 */
	const output = Number(usage.output ?? 0);
	/** 缓存读取 Token。 */
	const cacheRead = Number(usage.cacheRead ?? 0);
	/** 缓存写入 Token。 */
	const cacheWrite = Number(usage.cacheWrite ?? 0);
	/** 四个分项求和后的回退值。 */
	const value = input + output + cacheRead + cacheWrite;
	return Number.isFinite(value) && value > 0 ? value : null;
}

/** 流式扫描所有会话并计算逐会话指标。返回会话数组和扫描元数据。 */
async function scanSessions(sessionsDir, sinceMs, contextWindows, cwdFilter) {
	/** provider/model 上下文窗口映射。 */
	const windows = contextWindows.windows;
	/** 满足 cwd 条件的逐会话统计。 */
	const sessions = [];
	/** 扫描文件、跳过文件和坏行计数。 */
	const meta = { sessionsDir, sessionFilesScanned: 0, sessionFilesIncluded: 0, sessionFilesSkippedOlderThanSince: 0, malformedLines: 0 };
	/** sessionFile 是递归扫描出的当前会话 JSONL 文件；每个文件只处理一次。 */
	for await (const sessionFile of walkJsonlFiles(sessionsDir)) {
		meta.sessionFilesScanned++;
		/** 从文件名解析的创建时间。 */
		const fileTimestampMs = parseSessionFileTimestamp(sessionFile);
		if (sinceMs !== null && fileTimestampMs !== null && fileTimestampMs < sinceMs) {
			meta.sessionFilesSkippedOlderThanSince++;
			continue;
		}
		meta.sessionFilesIncluded++;
		/** 当前会话逐步累计的统计对象。 */
		const session = {
			sessionFile,
			cwd: null,
			startMs: fileTimestampMs ?? 0,
			endMs: fileTimestampMs ?? 0,
			providerModel: "[unknown]/[unknown]",
			assistantMessages: 0,
			userMessages: 0,
			compactions: 0,
			seenCompaction: false,
			maxPromptTokens: null,
			preFirstCompactionTokens: null,
			maxContextUsagePercent: null,
			preFirstCompactionUsagePercent: null,
			contextWindow: null,
			bashCommands: [],
			over80: false,
			over90: false,
			over100: false,
		};
		/** 当前会话文件的 UTF-8 读取流。 */
		const input = createReadStream(sessionFile, { encoding: "utf8" });
		/** 按行读取且兼容 CRLF 的接口。 */
		const rl = createInterface({ input, crlfDelay: Infinity });
		/** line 是当前 JSONL 文本行；空行跳过，解析失败计入 malformedLines。 */
		for await (const line of rl) {
			if (!line.trim()) continue;
			/** 当前 JSONL 行解析后的条目。 */
			let entry;
			try {
				entry = JSON.parse(line);
			} catch {
				meta.malformedLines++;
				continue;
			}
			if (entry.type === "session" && typeof entry.cwd === "string") session.cwd = entry.cwd;
			/** 当前条目时间戳的毫秒值。 */
			const entryMs = Date.parse(entry.timestamp ?? "");
			if (Number.isFinite(entryMs)) {
				if (!session.startMs || entryMs < session.startMs) session.startMs = entryMs;
				if (!session.endMs || entryMs > session.endMs) session.endMs = entryMs;
			}
			if (entry.type === "compaction") {
				session.compactions++;
				if (typeof entry.tokensBefore === "number") {
					session.maxPromptTokens = Math.max(session.maxPromptTokens ?? 0, entry.tokensBefore);
					if (!session.seenCompaction) session.preFirstCompactionTokens = entry.tokensBefore;
				}
				session.seenCompaction = true;
				continue;
			}
			if (entry.type !== "message" || !entry.message) continue;
			/** 当前消息条目中的消息对象。 */
			const message = entry.message;
			if (message.role === "assistant" && Array.isArray(message.content)) {
				/** block 是助手消息中的当前内容块；这里只统计名为 bash 的工具调用。 */
				for (const block of message.content) {
					if (block?.type !== "toolCall" || block.name !== "bash") continue;
					/** Bash 工具调用参数中的命令字符串。 */
					const command = typeof block.arguments?.command === "string" ? block.arguments.command : "";
					if (command) session.bashCommands.push(command);
				}
			}
			if (message.role === "user") session.userMessages++;
			if (message.role !== "assistant") continue;
			session.assistantMessages++;
			/** 助手消息提供商 ID。 */
			const provider = typeof message.provider === "string" ? message.provider : "[unknown]";
			/** 助手消息模型 ID。 */
			const model = typeof message.model === "string" ? message.model : "[unknown]";
			session.providerModel = `${provider}/${model}`;
			/** 当前 provider/model 的已知上下文窗口。 */
			const contextWindow = windows.get(session.providerModel) ?? null;
			if (contextWindow !== null) session.contextWindow = contextWindow;
			/** 当前助手消息的上下文 Token 估计。 */
			const tokens = contextTokens(message.usage);
			if (tokens !== null) {
				session.maxPromptTokens = Math.max(session.maxPromptTokens ?? 0, tokens);
				if (!session.seenCompaction) session.preFirstCompactionTokens = tokens;
			}
		}
		if (session.maxPromptTokens !== null && session.contextWindow !== null) {
			session.maxContextUsagePercent = (session.maxPromptTokens / session.contextWindow) * 100;
			session.over80 = session.maxContextUsagePercent >= 80;
			session.over90 = session.maxContextUsagePercent >= 90;
			session.over100 = session.maxContextUsagePercent >= 100;
		}
		if (session.preFirstCompactionTokens !== null && session.contextWindow !== null) {
			session.preFirstCompactionUsagePercent = (session.preFirstCompactionTokens / session.contextWindow) * 100;
		}
		if (!cwdFilter || path.resolve(session.cwd ?? "") === cwdFilter) sessions.push(session);
	}
	return { sessions, meta };
}

/** 按 keyFn 分组会话并生成排序汇总。返回分组数组。 */
function summarizeGroups(sessions, keyFn) {
	/** 分组键到会话列表的映射。 */
	const groups = new Map();
	for (const session of sessions) {
		/** 当前会话的分组键。 */
		const key = keyFn(session);
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(session);
	}
	return [...groups.entries()].map(([key, group]) => summarizeSessionGroup(key, group)).sort((a, b) => a.key.localeCompare(b.key));
}

/** 汇总单组会话的消息、时长、Token、压缩和阈值指标。返回统计对象。 */
function summarizeSessionGroup(key, group) {
	/** 已知最大上下文使用率的会话。 */
	const withUsage = group.filter((session) => session.maxContextUsagePercent !== null);
	/** 已知最大提示 Token 的会话。 */
	const withTokens = group.filter((session) => session.maxPromptTokens !== null);
	/** 已知首次压缩前使用率的会话。 */
	const withPreCompactionUsage = group.filter((session) => session.preFirstCompactionUsagePercent !== null);
	/** 至少发生一次压缩的会话数。 */
	const compactions = group.filter((session) => session.compactions > 0).length;
	/** 组内压缩总次数。 */
	const totalCompactions = group.reduce((sum, session) => sum + session.compactions, 0);
	/** 组内出现的去重上下文窗口。 */
	const contextWindows = [...new Set(group.map((session) => session.contextWindow).filter((value) => value !== null))].sort((a, b) => a - b);
	return {
		key,
		sessions: group.length,
		contextWindows,
		assistantMessages: group.reduce((sum, session) => sum + session.assistantMessages, 0),
		avgTurns: group.reduce((sum, session) => sum + session.userMessages, 0) / group.length,
		avgDurationMinutes: group.reduce((sum, session) => sum + Math.max(0, session.endMs - session.startMs) / 60000, 0) / group.length,
		avgMaxPromptTokens: withTokens.length === 0 ? null : withTokens.reduce((sum, session) => sum + (session.maxPromptTokens ?? 0), 0) / withTokens.length,
		medianMaxPromptTokens: median(withTokens.map((session) => session.maxPromptTokens)),
		avgMaxContextUsagePercent: withUsage.length === 0 ? null : withUsage.reduce((sum, session) => sum + (session.maxContextUsagePercent ?? 0), 0) / withUsage.length,
		medianMaxContextUsagePercent: median(withUsage.map((session) => session.maxContextUsagePercent)),
		medianPreFirstCompactionUsagePercent: median(withPreCompactionUsage.map((session) => session.preFirstCompactionUsagePercent)),
		contextKnownSessions: withUsage.length,
		sessionsWithCompaction: compactions,
		totalCompactions,
		compactionRate: (compactions / group.length) * 100,
		over80: group.filter((session) => session.over80).length,
		over90: group.filter((session) => session.over90).length,
		over100: group.filter((session) => session.over100).length,
	};
}

/** 应用模型/Bash 筛选并构建总计、按天、按模型和模型内按天汇总。返回报告数据。 */
function buildSummary(sessions, meta, options) {
	/** 小写后的模型前缀筛选。 */
	const lowerPrefixes = options.modelPrefixes.map((prefix) => prefix.toLowerCase());
	/** 小写后的 Bash 内容筛选。 */
	const bashContains = options.bashContains.map((text) => text.toLowerCase());
	/** 应用全部用户筛选后的会话。 */
	const filtered = sessions.filter((session) => {
		/** 当前会话的小写 provider/model。 */
		const providerModel = session.providerModel.toLowerCase();
		if (options.modelFilter && !providerModel.includes(options.modelFilter.toLowerCase())) return false;
		if (lowerPrefixes.length > 0 && !lowerPrefixes.some((prefix) => providerModel.startsWith(prefix))) return false;
		if (bashContains.length > 0) {
			/** 当前会话全部 Bash 命令的小写形式。 */
			const commands = session.bashCommands.map((command) => command.toLowerCase());
			if (!bashContains.some((text) => commands.some((command) => command.includes(text)))) return false;
		}
		return true;
	});
	return {
		filters: { model: options.modelFilter ?? null, modelPrefixes: options.modelPrefixes, bashContains: options.bashContains, cwd: options.cwd ? path.resolve(options.cwd) : null },
		scan: { ...meta, timezone: REPORT_TIME_ZONE },
		totals: summarizeSessionGroup("total", filtered),
		byDay: summarizeGroups(filtered, (session) => formatDay(session.startMs)),
		byModel: summarizeGroups(filtered, (session) => session.providerModel).sort((a, b) => b.sessions - a.sessions || a.key.localeCompare(b.key)),
		byModelDay: summarizeGroups(filtered, (session) => session.providerModel).sort((a, b) => b.sessions - a.sessions || a.key.localeCompare(b.key)).map((model) => ({
			...model,
			byDay: summarizeGroups(
				filtered.filter((session) => session.providerModel === model.key),
				(session) => formatDay(session.startMs)
			),
		})),
	};
}

/** 将单个统计分组格式化为等宽文本行。参数 group 为汇总对象，indent 为行前缩进；返回可直接输出的字符串。例如：lineForGroup(summary.totals)。 */
function lineForGroup(group, indent = "  ") {
	return `${indent}${group.key} sessions=${formatInt(group.sessions).padStart(4)} avgTurns=${formatNumber(group.avgTurns).padStart(5)} avgMin=${formatNumber(group.avgDurationMinutes).padStart(6)} avgMaxTok=${group.avgMaxPromptTokens === null ? "n/a" : formatInt(group.avgMaxPromptTokens).padStart(7)} medMaxCtx=${group.medianMaxContextUsagePercent === null ? "n/a" : formatPercent(group.medianMaxContextUsagePercent).padStart(6)} medPreCompactCtx=${group.medianPreFirstCompactionUsagePercent === null ? "n/a" : formatPercent(group.medianPreFirstCompactionUsagePercent).padStart(6)} avgCtx=${group.avgMaxContextUsagePercent === null ? "n/a" : formatPercent(group.avgMaxContextUsagePercent).padStart(6)} compact=${formatPercent(group.compactionRate).padStart(6)} over90=${formatInt(group.over90).padStart(3)} ${bar(group.medianMaxContextUsagePercent ?? 0)}`;
}


/** 把完整汇总对象转换为纯文本报告。参数 summary 来自 buildSummary；返回以换行符结尾的报告字符串。例如：buildTextReport(summary)。 */
function buildTextReport(summary) {
	/** 按输出顺序收集报告的每一行，最终统一拼接。 */
	const lines = [];
	lines.push(`Scanned ${formatInt(summary.scan.sessionFilesIncluded)} session files in ${summary.scan.sessionsDir}`);
	lines.push(`Report timezone: ${summary.scan.timezone} (CET/CEST)`);
	lines.push(`Context window sources: ${summary.scan.contextWindowSources.join(", ") || "none"}`);
	if (summary.filters.model) lines.push(`Filters: model contains "${summary.filters.model}"`);
	if (summary.filters.modelPrefixes.length > 0) lines.push(`Filters: model prefixes = ${summary.filters.modelPrefixes.join(", ")}`);
	if (summary.filters.bashContains.length > 0) lines.push(`Filters: bash contains any of = ${summary.filters.bashContains.join(", ")}`);
	if (summary.filters.cwd) lines.push(`Filters: cwd = ${summary.filters.cwd}`);
	lines.push("Context usage parses full session JSONL files. max context uses max assistant usage.totalTokens per session, falling back to input + output + cacheRead + cacheWrite, plus compaction tokensBefore. medPreCompactCtx uses the last assistant usage before the first compaction, or the first compaction tokensBefore when present, divided by model contextWindow from packages/ai/src/models.generated.ts when known.");
	lines.push("");
	lines.push("Totals");
	lines.push(lineForGroup(summary.totals));
	lines.push("");
	lines.push("By day");
	/** group 是按日期聚合的当前统计组，直接格式化为一行。 */
	for (const group of summary.byDay) lines.push(lineForGroup(group));
	lines.push("");
	lines.push("By model");
	/** group 是按模型聚合的当前统计组，直接格式化为一行。 */
	for (const group of summary.byModel) lines.push(lineForGroup(group));
	lines.push("");
	lines.push("By model, then by day");
	/** model 是当前模型汇总项，包含总计、窗口信息及按日期子组。 */
	for (const model of summary.byModelDay) {
		lines.push("");
		/** 当前模型可用的上下文窗口说明；未知时显示 unknown。 */
		const contextWindowLabel = model.contextWindows.length === 0 ? "unknown" : model.contextWindows.map((value) => formatInt(value)).join(", ");
		lines.push(`${model.key} contextWindow=${contextWindowLabel}`);
		lines.push(lineForGroup(model, "  total "));
		/** group 是当前模型下的单日统计组，使用缩进格式输出。 */
		for (const group of model.byDay) lines.push(lineForGroup(group, "  "));
	}
	if (summary.scan.malformedLines > 0) {
		lines.push("");
		lines.push(`Malformed lines skipped: ${formatInt(summary.scan.malformedLines)}`);
	}
	return `${lines.join("\n")}\n`;
}


/** 转义 HTML 中具有特殊含义的字符。参数 text 为原始文本；返回可安全放入 pre 元素的字符串。例如：escapeHtml("a<b")。 */
function escapeHtml(text) {
	return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/** 将汇总打印为包含等宽 pre 区域的最小 HTML 页面。参数 summary 为报告数据；无返回值。例如：printHtmlReport(summary)。 */
function printHtmlReport(summary) {
	console.log(`<!doctype html>
<meta charset="utf-8">
<title>Session context stats</title>
<style>
body { margin: 24px; background: #fff; color: #111; }
pre { font: 13px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre; }
</style>
<pre>${escapeHtml(buildTextReport(summary))}</pre>`);
}


/** 解析命令行参数、扫描会话并按请求格式输出报告。无显式参数；成功时无返回值。例如：await main()。 */
async function main() {
	/** 命令行选项，来源为当前进程参数。 */
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		printHelp();
		return;
	}
	/** 起始时间的毫秒时间戳；未指定时为 null。 */
	const sinceMs = options.since ? Date.parse(options.since) : null;
	if (options.since && !Number.isFinite(sinceMs)) throw new Error(`Invalid --since value: ${options.since}`);
	/** 从模型清单加载的上下文窗口映射及来源说明。 */
	const contextWindows = await loadContextWindows();
	/** 规范化后的工作目录筛选；未设置时为 undefined。 */
	const cwdFilter = options.cwd ? path.resolve(options.cwd) : undefined;
	/** 扫描得到的会话明细与扫描元数据。 */
	const { sessions, meta } = await scanSessions(path.resolve(options.sessionsDir), sinceMs, contextWindows, cwdFilter);
	/** 应用筛选并聚合后的最终报告数据。 */
	const summary = buildSummary(sessions, { ...meta, contextWindowSources: contextWindows.sources }, options);
	if (options.json) console.log(JSON.stringify(summary, null, 2));
	else if (options.text) console.log(buildTextReport(summary));
	else printHtmlReport(summary);
}

// 捕获入口异步错误，输出便于命令行阅读的消息并以失败状态退出。
main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
