/**
 * 【文件职责】实现编辑器自动补全体系：定义补全条目/斜杠命令/提供器接口，并提供内置的
 *              CombinedAutocompleteProvider——统一处理斜杠命令、@ 文件模糊搜索与普通路径补全。
 * 【技术维度】策略接口（AutocompleteProvider）+ 组合实现；fd 子进程做快速目录树遍历（遵循 gitignore）；
 *              AbortSignal 支持取消；同步 readdirSync 的直接路径补全；fuzzyFilter 模糊过滤命令名。
 * 【产品维度】输入 "/" 弹出命令面板、"@" 模糊搜全仓文件、输入路径片段自动列目录——大幅降低长路径与
 *              命令的记忆成本。
 * 【逻辑维度】模块级私有函数处理引号/@前缀解析与 fd 查询构造 → 三个类型定义 →
 *              CombinedAutocompleteProvider：getSuggestions 按 @→斜杠命令→命令参数→普通路径 分派；
 *              applyCompletion 按四类上下文把候选项写回文本并定位光标。
 * 【关键边界】fd 不存在时模糊文件搜索返回空；过滤为 value 前缀匹配；目录候选以 / 结尾且不加空格便于
 *              继续补全；引号配对时回填光标会跳过闭合引号。
 * 【新手阅读建议】先读三个 interface 了解契约 → 再按 getSuggestions 的分派顺序阅读四大分支 →
 *              最后看 applyCompletion 的四类回填逻辑。
 */
import { spawn } from "child_process";
import { readdirSync, statSync } from "fs";
import { homedir } from "os";
import { basename, dirname, join } from "path";
import { fuzzyFilter } from "./fuzzy.ts";

// 视为“词元分隔”的字符集合：空格/制表符/引号/等号
const PATH_DELIMITERS = new Set([" ", "\t", '"', "'", "="]);

// 路径显示归一化（私有）：把反斜杠统一替换为正斜杠（Windows 兼容）
function toDisplayPath(value: string): string {
	return value.replace(/\\/g, "/");
}

// 正则元字符转义（私有）：用于把用户输入安全地嵌入正则
function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 构造 fd 的路径查询模式（私有）：含 / 时生成跨平台分隔符正则；尾随 / 表示只找该目录下的内容
function buildFdPathQuery(query: string): string {
	const normalized = toDisplayPath(query);
	if (!normalized.includes("/")) {
		return normalized;
	}

	const hasTrailingSeparator = normalized.endsWith("/");
	const trimmed = normalized.replace(/^\/+|\/+$/g, "");
	if (!trimmed) {
		return normalized;
	}

	const separatorPattern = "[\\\\/]";
	const segments = trimmed
		.split("/")
		.filter(Boolean)
		.map((segment) => escapeRegex(segment));
	if (segments.length === 0) {
		return normalized;
	}

	let pattern = segments.join(separatorPattern);
	if (hasTrailingSeparator) {
		pattern += separatorPattern;
	}
	return pattern;
}

// 从后向前查找最后一个词元分隔符的位置（私有）；无则 -1
function findLastDelimiter(text: string): number {
	for (let i = text.length - 1; i >= 0; i -= 1) {
		if (PATH_DELIMITERS.has(text[i] ?? "")) {
			return i;
		}
	}
	return -1;
}

// 查找未闭合双引号的起始下标（私有）；无未闭合引号返回 null
function findUnclosedQuoteStart(text: string): number | null {
	let inQuotes = false;
	let quoteStart = -1;

	for (let i = 0; i < text.length; i += 1) {
		if (text[i] === '"') {
			inQuotes = !inQuotes;
			if (inQuotes) {
				quoteStart = i;
			}
		}
	}

	return inQuotes ? quoteStart : null;
}

// 判断某下标是否位于词元开头（私有）：行首或前一字符是分隔符
function isTokenStart(text: string, index: number): boolean {
	return index === 0 || PATH_DELIMITERS.has(text[index - 1] ?? "");
}

// 提取未闭合引号开头的词元前缀（私有）：支持 @" 与 " 两种形态；非词元边界返回 null
function extractQuotedPrefix(text: string): string | null {
	const quoteStart = findUnclosedQuoteStart(text);
	if (quoteStart === null) {
		return null;
	}

	if (quoteStart > 0 && text[quoteStart - 1] === "@") {
		if (!isTokenStart(text, quoteStart - 1)) {
			return null;
		}
		return text.slice(quoteStart - 1);
	}

	if (!isTokenStart(text, quoteStart)) {
		return null;
	}

	return text.slice(quoteStart);
}

// 解析路径前缀形态（私有）：识别 @"、"、@ 三种修饰，剥出裸路径部分
function parsePathPrefix(prefix: string): { rawPrefix: string; isAtPrefix: boolean; isQuotedPrefix: boolean } {
	if (prefix.startsWith('@"')) {
		return { rawPrefix: prefix.slice(2), isAtPrefix: true, isQuotedPrefix: true };
	}
	if (prefix.startsWith('"')) {
		return { rawPrefix: prefix.slice(1), isAtPrefix: false, isQuotedPrefix: true };
	}
	if (prefix.startsWith("@")) {
		return { rawPrefix: prefix.slice(1), isAtPrefix: true, isQuotedPrefix: false };
	}
	return { rawPrefix: prefix, isAtPrefix: false, isQuotedPrefix: false };
}

// 构造最终回填值（私有）：按需补 @ 前缀与成对引号（原前缀带引号或路径含空格时）
function buildCompletionValue(
	path: string,
	options: { isDirectory: boolean; isAtPrefix: boolean; isQuotedPrefix: boolean },
): string {
	const needsQuotes = options.isQuotedPrefix || path.includes(" ");
	const prefix = options.isAtPrefix ? "@" : "";

	if (!needsQuotes) {
		return `${prefix}${path}`;
	}

	const openQuote = `${prefix}"`;
	const closeQuote = '"';
	return `${openQuote}${path}${closeQuote}`;
}

// Use fd to walk directory tree (fast, respects .gitignore)
// 使用 fd 遍历目录树（快速且遵循 gitignore）
// 以子进程方式调用 fd 搜索（私有）：入参基目录、fd 可执行路径、查询串、上限与中止信号；
// 中止时 SIGKILL 子进程；任何错误都解析为空结果。返回 { path 显示路径, isDirectory } 数组。
async function walkDirectoryWithFd(
	baseDir: string,
	fdPath: string,
	query: string,
	maxResults: number,
	signal: AbortSignal,
): Promise<Array<{ path: string; isDirectory: boolean }>> {
	const args = [
		"--base-directory",
		baseDir,
		"--max-results",
		String(maxResults),
		"--type",
		"f",
		"--type",
		"d",
		"--follow",
		"--hidden",
		"--exclude",
		".git",
		"--exclude",
		".git/*",
		"--exclude",
		".git/**",
	];

	if (toDisplayPath(query).includes("/")) {
		args.push("--full-path");
	}

	if (query) {
		args.push(buildFdPathQuery(query));
	}

	return await new Promise((resolve) => {
		if (signal.aborted) {
			resolve([]);
			return;
		}

		const child = spawn(fdPath, args, {
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stdout = "";
		let resolved = false;

		const finish = (results: Array<{ path: string; isDirectory: boolean }>) => {
			if (resolved) return;
			resolved = true;
			signal.removeEventListener("abort", onAbort);
			resolve(results);
		};

		const onAbort = () => {
			if (child.exitCode === null) {
				child.kill("SIGKILL");
			}
		};

		signal.addEventListener("abort", onAbort, { once: true });
		child.stdout.setEncoding("utf-8");
		child.stdout.on("data", (chunk: string) => {
			stdout += chunk;
		});
		child.on("error", () => {
			finish([]);
		});
		child.on("close", (code) => {
			if (signal.aborted || code !== 0 || !stdout) {
				finish([]);
				return;
			}

			const lines = stdout.trim().split("\n").filter(Boolean);
			const results: Array<{ path: string; isDirectory: boolean }> = [];

			for (const line of lines) {
				const displayLine = toDisplayPath(line);
				const hasTrailingSeparator = displayLine.endsWith("/");
				const normalizedPath = hasTrailingSeparator ? displayLine.slice(0, -1) : displayLine;
				if (normalizedPath === ".git" || normalizedPath.startsWith(".git/") || normalizedPath.includes("/.git/")) {
					continue;
				}

				results.push({
					path: displayLine,
					isDirectory: hasTrailingSeparator,
				});
			}

			finish(results);
		});
	});
}

/** 补全条目（中文说明）：value 回填文本；label 展示名；description 可选说明。 */
export interface AutocompleteItem {
	value: string;
	label: string;
	description?: string;
}

// 可等待类型：同步值或 Promise 均可
type Awaitable<T> = T | Promise<T>;

/** 斜杠命令定义（中文说明）：name 命令名；description 说明；argumentHint 参数占位提示；
 * getArgumentCompletions 为该命令提供参数级补全（返回 null 表示无参补全）。 */
export interface SlashCommand {
	name: string;
	description?: string;
	// 参数占位提示（如 "<model>"），展示在补全面板中
	argumentHint?: string;
	// Function to get argument completions for this command
	// 获取该命令的参数补全候选；无可用补全时返回 null
	// Returns null if no argument completion is available
	getArgumentCompletions?(argumentPrefix: string): Awaitable<AutocompleteItem[] | null>;
}

/** 补全结果集（中文说明）：items 候选数组；prefix 当前正在匹配的前缀文本。 */
export interface AutocompleteSuggestions {
	items: AutocompleteItem[];
	prefix: string; // What we're matching against (e.g., "/" or "src/")
	// 正在匹配的前缀（如 "/" 或 "src/"），回填时会先从文本中移除它
}

/** 补全提供器接口（中文说明）：由编辑器在合适的时机调用以获取候选并把选中项写回文本。 */
export interface AutocompleteProvider {
	/** Characters that should naturally trigger this provider at token boundaries. */
	// 能自然触发该提供器的字符（词元边界处）
	triggerCharacters?: string[];

	// Get autocomplete suggestions for current text/cursor position
	// 按当前文本与光标位置获取补全候选；无建议返回 null。options.signal 用于取消，force 表示强制触发
	// Returns null if no suggestions available
	getSuggestions(
		lines: string[],
		cursorLine: number,
		cursorCol: number,
		options: { signal: AbortSignal; force?: boolean },
	): Promise<AutocompleteSuggestions | null>;

	// Apply the selected item
	// 应用选中的候选：返回新的多行文本与新光标位置
	// Returns the new text and cursor position
	applyCompletion(
		lines: string[],
		cursorLine: number,
		cursorCol: number,
		item: AutocompleteItem,
		prefix: string,
	): {
		lines: string[];
		cursorLine: number;
		cursorCol: number;
	};

	// Check if file completion should trigger for explicit Tab completion
	// 判断显式按 Tab 时是否应触发文件补全
	shouldTriggerFileCompletion?(lines: string[], cursorLine: number, cursorCol: number): boolean;
}

// 组合式提供器：同时处理斜杠命令与文件路径两类补全
// Combined provider that handles both slash commands and file paths
/**
 * CombinedAutocompleteProvider（中文说明）：内置组合提供器。
 * getSuggestions 的分派优先级：@ 模糊文件搜索 → 行首斜杠命令 → 已知命令的参数补全 → 普通路径补全。
 */
export class CombinedAutocompleteProvider implements AutocompleteProvider {
	// 注册的斜杠命令（或简单条目）列表
	private commands: (SlashCommand | AutocompleteItem)[];
	// 相对路径补全的基准目录
	private basePath: string;
	// fd 可执行文件路径；null 表示环境无 fd，禁用模糊文件搜索
	private fdPath: string | null;

	// 构造函数：注入命令列表、基准目录与可选的 fd 路径
	constructor(commands: (SlashCommand | AutocompleteItem)[] = [], basePath: string, fdPath: string | null = null) {
		this.commands = commands;
		this.basePath = basePath;
		this.fdPath = fdPath;
	}

	// 获取补全建议（公开）：依次尝试 @ 前缀 → 斜杠命令 → 命令参数 → 普通路径四类来源
	async getSuggestions(
		lines: string[],
		cursorLine: number,
		cursorCol: number,
		options: { signal: AbortSignal; force?: boolean },
	): Promise<AutocompleteSuggestions | null> {
		const currentLine = lines[cursorLine] || "";
		const textBeforeCursor = currentLine.slice(0, cursorCol);

		// 第一优先：@ 前缀 → 走 fd 模糊文件搜索
		const atPrefix = this.extractAtPrefix(textBeforeCursor);
		if (atPrefix) {
			const { rawPrefix, isQuotedPrefix } = parsePathPrefix(atPrefix);
			const suggestions = await this.getFuzzyFileSuggestions(rawPrefix, {
				isQuotedPrefix,
				signal: options.signal,
			});
			if (suggestions.length === 0) return null;

			return {
				items: suggestions,
				prefix: atPrefix,
			};
		}

		// 第二优先：行首 / 且未强制模式 → 斜杠命令名或其参数补全
		if (!options.force && textBeforeCursor.startsWith("/")) {
			const spaceIndex = textBeforeCursor.indexOf(" ");

			if (spaceIndex === -1) {
				const prefix = textBeforeCursor.slice(1);
				const commandItems = this.commands.map((cmd) => {
					const name = "name" in cmd ? cmd.name : cmd.value;
					const hint = "argumentHint" in cmd && cmd.argumentHint ? cmd.argumentHint : undefined;
					const desc = cmd.description ?? "";
					const fullDesc = hint ? (desc ? `${hint} — ${desc}` : hint) : desc;
					return {
						name,
						label: name,
						description: fullDesc || undefined,
					};
				});

				const filtered = fuzzyFilter(commandItems, prefix, (item) => item.name).map((item) => ({
					value: item.name,
					label: item.label,
					...(item.description && { description: item.description }),
				}));

				if (filtered.length === 0) return null;

				return {
					items: filtered,
					prefix: textBeforeCursor,
				};
			}

			const commandName = textBeforeCursor.slice(1, spaceIndex);
			const argumentText = textBeforeCursor.slice(spaceIndex + 1);

			const command = this.commands.find((cmd) => {
				const name = "name" in cmd ? cmd.name : cmd.value;
				return name === commandName;
			});
			if (!command || !("getArgumentCompletions" in command) || !command.getArgumentCompletions) {
				return null;
			}

			const argumentSuggestions = await command.getArgumentCompletions(argumentText);
			if (!Array.isArray(argumentSuggestions) || argumentSuggestions.length === 0) {
				return null;
			}

			return {
				items: argumentSuggestions,
				prefix: argumentText,
			};
		}

		// 第四优先：普通路径前缀补全（force 时无条件提取）
		const pathMatch = this.extractPathPrefix(textBeforeCursor, options.force ?? false);
		if (pathMatch === null) {
			return null;
		}

		const suggestions = this.getFileSuggestions(pathMatch);
		if (suggestions.length === 0) return null;

		return {
			items: suggestions,
			prefix: pathMatch,
		};
	}

	applyCompletion(
		lines: string[],
		cursorLine: number,
		cursorCol: number,
		item: AutocompleteItem,
		prefix: string,
	): { lines: string[]; cursorLine: number; cursorCol: number } {
		const currentLine = lines[cursorLine] || "";
		const beforePrefix = currentLine.slice(0, cursorCol - prefix.length);
		const afterCursor = currentLine.slice(cursorCol);
		const isQuotedPrefix = prefix.startsWith('"') || prefix.startsWith('@"');
		const hasLeadingQuoteAfterCursor = afterCursor.startsWith('"');
		const hasTrailingQuoteInItem = item.value.endsWith('"');
		const adjustedAfterCursor =
			isQuotedPrefix && hasTrailingQuoteInItem && hasLeadingQuoteAfterCursor ? afterCursor.slice(1) : afterCursor;

		// Check if we're completing a slash command (prefix starts with "/" but NOT a file path)
		// Slash commands are at the start of the line and don't contain path separators after the first /
		// 回填分支一：行首斜杠命令名 —— 回填后自动补一个空格
		const isSlashCommand = prefix.startsWith("/") && beforePrefix.trim() === "" && !prefix.slice(1).includes("/");
		if (isSlashCommand) {
			// This is a command name completion
			const newLine = `${beforePrefix}/${item.value} ${adjustedAfterCursor}`;
			const newLines = [...lines];
			newLines[cursorLine] = newLine;

			return {
				lines: newLines,
				cursorLine,
				cursorCol: beforePrefix.length + item.value.length + 2, // +2 for "/" and space
			};
		}

		// Check if we're completing a file attachment (prefix starts with "@")
		// 回填分支二：@ 文件附件 —— 目录候选不追加空格以便继续深入补全
		if (prefix.startsWith("@")) {
			// This is a file attachment completion
			// Don't add space after directories so user can continue autocompleting
			const isDirectory = item.label.endsWith("/");
			const suffix = isDirectory ? "" : " ";
			const newLine = `${beforePrefix + item.value}${suffix}${adjustedAfterCursor}`;
			const newLines = [...lines];
			newLines[cursorLine] = newLine;

			const hasTrailingQuote = item.value.endsWith('"');
			const cursorOffset = isDirectory && hasTrailingQuote ? item.value.length - 1 : item.value.length;

			return {
				lines: newLines,
				cursorLine,
				cursorCol: beforePrefix.length + cursorOffset + suffix.length,
			};
		}

		// Check if we're in a slash command context (beforePrefix contains "/command ")
		const textBeforeCursor = currentLine.slice(0, cursorCol);
		// 回填分支三：斜杠命令的参数上下文
		if (textBeforeCursor.includes("/") && textBeforeCursor.includes(" ")) {
			// This is likely a command argument completion
			const newLine = beforePrefix + item.value + adjustedAfterCursor;
			const newLines = [...lines];
			newLines[cursorLine] = newLine;

			const isDirectory = item.label.endsWith("/");
			const hasTrailingQuote = item.value.endsWith('"');
			const cursorOffset = isDirectory && hasTrailingQuote ? item.value.length - 1 : item.value.length;

			return {
				lines: newLines,
				cursorLine,
				cursorCol: beforePrefix.length + cursorOffset,
			};
		}

		// For file paths, complete the path
		const newLine = beforePrefix + item.value + adjustedAfterCursor;
		const newLines = [...lines];
		newLines[cursorLine] = newLine;

		const isDirectory = item.label.endsWith("/");
		const hasTrailingQuote = item.value.endsWith('"');
		const cursorOffset = isDirectory && hasTrailingQuote ? item.value.length - 1 : item.value.length;

		return {
			lines: newLines,
			cursorLine,
			cursorCol: beforePrefix.length + cursorOffset,
		};
	}

	// Extract @ prefix for fuzzy file suggestions
	// 提取 @ 前缀（供模糊文件搜索）：支持 @"… 未闭合形态与词首 @ 形态
	private extractAtPrefix(text: string): string | null {
		const quotedPrefix = extractQuotedPrefix(text);
		if (quotedPrefix?.startsWith('@"')) {
			return quotedPrefix;
		}

		const lastDelimiterIndex = findLastDelimiter(text);
		const tokenStart = lastDelimiterIndex === -1 ? 0 : lastDelimiterIndex + 1;

		if (text[tokenStart] === "@") {
			return text.slice(tokenStart);
		}

		return null;
	}

	// Extract a path-like prefix from the text before cursor
	// 提取路径样式的光标前缀：引号词元优先；force 时无条件返回，
	// 自然触发则要求形似路径（含 / 或 ./ ~/ 开头）或刚输入了空格
	private extractPathPrefix(text: string, forceExtract: boolean = false): string | null {
		const quotedPrefix = extractQuotedPrefix(text);
		if (quotedPrefix) {
			return quotedPrefix;
		}

		const lastDelimiterIndex = findLastDelimiter(text);
		const pathPrefix = lastDelimiterIndex === -1 ? text : text.slice(lastDelimiterIndex + 1);

		// For forced extraction (Tab key), always return something
		if (forceExtract) {
			return pathPrefix;
		}

		// For natural triggers, return if it looks like a path, ends with /, starts with ~/, .
		// Only return empty string if the text looks like it's starting a path context
		if (pathPrefix.includes("/") || pathPrefix.startsWith(".") || pathPrefix.startsWith("~/")) {
			return pathPrefix;
		}

		// Return empty string only after a space (not for completely empty text)
		// Empty text should not trigger file suggestions - that's for forced Tab completion
		if (pathPrefix === "" && text.endsWith(" ")) {
			return pathPrefix;
		}

		return null;
	}

	// Expand home directory (~/) to actual home path
	// 展开 ~ 主目录缩写为真实家目录路径（保留尾部斜杠）
	private expandHomePath(path: string): string {
		if (path.startsWith("~/")) {
			const expandedPath = join(homedir(), path.slice(2));
			// Preserve trailing slash if original path had one
			return path.endsWith("/") && !expandedPath.endsWith("/") ? `${expandedPath}/` : expandedPath;
		} else if (path === "~") {
			return homedir();
		}
		return path;
	}

	// 解析带作用域的模糊查询（私有）：把 "dir/query" 拆为基目录 + 子查询，
	// 支持 ~/、绝对路径与相对路径三种基目录形态；基目录不存在返回 null
	private resolveScopedFuzzyQuery(rawQuery: string): { baseDir: string; query: string; displayBase: string } | null {
		const normalizedQuery = toDisplayPath(rawQuery);
		const slashIndex = normalizedQuery.lastIndexOf("/");
		if (slashIndex === -1) {
			return null;
		}

		const displayBase = normalizedQuery.slice(0, slashIndex + 1);
		const query = normalizedQuery.slice(slashIndex + 1);

		let baseDir: string;
		if (displayBase.startsWith("~/")) {
			baseDir = this.expandHomePath(displayBase);
		} else if (displayBase.startsWith("/")) {
			baseDir = displayBase;
		} else {
			baseDir = join(this.basePath, displayBase);
		}

		try {
			if (!statSync(baseDir).isDirectory()) {
				return null;
			}
		} catch {
			return null;
		}

		return { baseDir, query, displayBase };
	}

	// 组装作用域化后的展示路径（私有）：根目录特殊处理避免双斜杠
	private scopedPathForDisplay(displayBase: string, relativePath: string): string {
		const normalizedRelativePath = toDisplayPath(relativePath);
		if (displayBase === "/") {
			return `/${normalizedRelativePath}`;
		}
		return `${toDisplayPath(displayBase)}${normalizedRelativePath}`;
	}

	// Get file/directory suggestions for a given path prefix
	// 同步列出指定前缀下的文件/目录候选（私有）：
	// 区分根前缀/目录前缀/文件前缀三种情形定位搜索目录与名称过滤串；
	// 结果目录优先排序，目录名追加尾部斜杠
	private getFileSuggestions(prefix: string): AutocompleteItem[] {
		try {
			let searchDir: string;
			let searchPrefix: string;
			const { rawPrefix, isAtPrefix, isQuotedPrefix } = parsePathPrefix(prefix);
			let expandedPrefix = rawPrefix;

			// Handle home directory expansion
			if (expandedPrefix.startsWith("~")) {
				expandedPrefix = this.expandHomePath(expandedPrefix);
			}

			const isRootPrefix =
				rawPrefix === "" ||
				rawPrefix === "./" ||
				rawPrefix === "../" ||
				rawPrefix === "~" ||
				rawPrefix === "~/" ||
				rawPrefix === "/" ||
				(isAtPrefix && rawPrefix === "");

			if (isRootPrefix) {
				// Complete from specified position
				if (rawPrefix.startsWith("~") || expandedPrefix.startsWith("/")) {
					searchDir = expandedPrefix;
				} else {
					searchDir = join(this.basePath, expandedPrefix);
				}
				searchPrefix = "";
			} else if (rawPrefix.endsWith("/")) {
				// If prefix ends with /, show contents of that directory
				if (rawPrefix.startsWith("~") || expandedPrefix.startsWith("/")) {
					searchDir = expandedPrefix;
				} else {
					searchDir = join(this.basePath, expandedPrefix);
				}
				searchPrefix = "";
			} else {
				// Split into directory and file prefix
				const dir = dirname(expandedPrefix);
				const file = basename(expandedPrefix);
				if (rawPrefix.startsWith("~") || expandedPrefix.startsWith("/")) {
					searchDir = dir;
				} else {
					searchDir = join(this.basePath, dir);
				}
				searchPrefix = file;
			}

			const entries = readdirSync(searchDir, { withFileTypes: true });
			const suggestions: AutocompleteItem[] = [];

			for (const entry of entries) {
				if (!entry.name.toLowerCase().startsWith(searchPrefix.toLowerCase())) {
					continue;
				}

				// Check if entry is a directory (or a symlink pointing to a directory)
				let isDirectory = entry.isDirectory();
				if (!isDirectory && entry.isSymbolicLink()) {
					try {
						const fullPath = join(searchDir, entry.name);
						isDirectory = statSync(fullPath).isDirectory();
					} catch {
						// Broken symlink or permission error - treat as file
					}
				}

				let relativePath: string;
				const name = entry.name;
				const displayPrefix = rawPrefix;

				if (displayPrefix.endsWith("/")) {
					// If prefix ends with /, append entry to the prefix
					relativePath = displayPrefix + name;
				} else if (displayPrefix.includes("/") || displayPrefix.includes("\\")) {
					// Preserve ~/ format for home directory paths
					if (displayPrefix.startsWith("~/")) {
						const homeRelativeDir = displayPrefix.slice(2); // Remove ~/
						const dir = dirname(homeRelativeDir);
						relativePath = `~/${dir === "." ? name : join(dir, name)}`;
					} else if (displayPrefix.startsWith("/")) {
						// Absolute path - construct properly
						const dir = dirname(displayPrefix);
						if (dir === "/") {
							relativePath = `/${name}`;
						} else {
							relativePath = `${dir}/${name}`;
						}
					} else {
						relativePath = join(dirname(displayPrefix), name);
						// path.join normalizes away ./ prefix, preserve it
						if (displayPrefix.startsWith("./") && !relativePath.startsWith("./")) {
							relativePath = `./${relativePath}`;
						}
					}
				} else {
					// For standalone entries, preserve ~/ if original prefix was ~/
					if (displayPrefix.startsWith("~")) {
						relativePath = `~/${name}`;
					} else {
						relativePath = name;
					}
				}

				relativePath = toDisplayPath(relativePath);
				const pathValue = isDirectory ? `${relativePath}/` : relativePath;
				const value = buildCompletionValue(pathValue, {
					isDirectory,
					isAtPrefix,
					isQuotedPrefix,
				});

				suggestions.push({
					value,
					label: name + (isDirectory ? "/" : ""),
				});
			}

			// Sort directories first, then alphabetically
			suggestions.sort((a, b) => {
				const aIsDir = a.value.endsWith("/");
				const bIsDir = b.value.endsWith("/");
				if (aIsDir && !bIsDir) return -1;
				if (!aIsDir && bIsDir) return 1;
				return a.label.localeCompare(b.label);
			});

			return suggestions;
		} catch (_e) {
			// Directory doesn't exist or not accessible
			return [];
		}
	}

	// Score an entry against the query (higher = better match)
	// 对单个条目打分（私有，分越高匹配越好）：精确文件名 100 / 文件名前缀 80 /
	// 文件名包含 50 / 全路径包含 30；目录额外 +10 排前
	// isDirectory adds bonus to prioritize folders
	private scoreEntry(filePath: string, query: string, isDirectory: boolean): number {
		const fileName = basename(filePath);
		const lowerFileName = fileName.toLowerCase();
		const lowerQuery = query.toLowerCase();

		let score = 0;

		// Exact filename match (highest)
		if (lowerFileName === lowerQuery) score = 100;
		// Filename starts with query
		else if (lowerFileName.startsWith(lowerQuery)) score = 80;
		// Substring match in filename
		else if (lowerFileName.includes(lowerQuery)) score = 50;
		// Substring match in full path
		else if (filePath.toLowerCase().includes(lowerQuery)) score = 30;

		// Directories get a bonus to appear first
		if (isDirectory && score > 0) score += 10;

		return score;
	}

	// Fuzzy file search using fd (fast, respects .gitignore)
	// 基于 fd 的模糊文件搜索（私有）：最多取 100 条、打分排序取前 20 条；
	// 候选描述展示完整路径；异常或取消一律返回空
	private async getFuzzyFileSuggestions(
		query: string,
		options: { isQuotedPrefix: boolean; signal: AbortSignal },
	): Promise<AutocompleteItem[]> {
		if (!this.fdPath || options.signal.aborted) {
			return [];
		}

		try {
			const scopedQuery = this.resolveScopedFuzzyQuery(query);
			const fdBaseDir = scopedQuery?.baseDir ?? this.basePath;
			const fdQuery = scopedQuery?.query ?? query;
			const entries = await walkDirectoryWithFd(fdBaseDir, this.fdPath, fdQuery, 100, options.signal);
			if (options.signal.aborted) {
				return [];
			}

			const scoredEntries = entries
				.map((entry) => ({
					...entry,
					score: fdQuery ? this.scoreEntry(entry.path, fdQuery, entry.isDirectory) : 1,
				}))
				.filter((entry) => entry.score > 0);

			scoredEntries.sort((a, b) => b.score - a.score);
			const topEntries = scoredEntries.slice(0, 20);

			const suggestions: AutocompleteItem[] = [];
			for (const { path: entryPath, isDirectory } of topEntries) {
				const pathWithoutSlash = isDirectory ? entryPath.slice(0, -1) : entryPath;
				const displayPath = scopedQuery
					? this.scopedPathForDisplay(scopedQuery.displayBase, pathWithoutSlash)
					: pathWithoutSlash;
				const entryName = basename(pathWithoutSlash);
				const completionPath = isDirectory ? `${displayPath}/` : displayPath;
				const value = buildCompletionValue(completionPath, {
					isDirectory,
					isAtPrefix: true,
					isQuotedPrefix: options.isQuotedPrefix,
				});

				suggestions.push({
					value,
					label: entryName + (isDirectory ? "/" : ""),
					description: displayPath,
				});
			}

			return suggestions;
		} catch {
			return [];
		}
	}

	// Check if we should trigger file completion (called on Tab key)
	// 显式 Tab 触发判定（公开）：行首正在输入斜杠命令时不触发文件补全，其余情况均触发
	shouldTriggerFileCompletion(lines: string[], cursorLine: number, cursorCol: number): boolean {
		const currentLine = lines[cursorLine] || "";
		const textBeforeCursor = currentLine.slice(0, cursorCol);

		// Don't trigger if we're typing a slash command at the start of the line
		if (textBeforeCursor.trim().startsWith("/") && !textBeforeCursor.trim().includes(" ")) {
			return false;
		}

		return true;
	}
}
