/**
 * 【文件职责】工具输出的通用截断工具集：按“行数上限”与“字节上限”两个独立限制截断内容，
 *              提供头部保留（truncateHead）与尾部保留（truncateTail）两种策略及辅助函数。
 * 【技术维度】手写 UTF-8 字节长度计算（兼容无 Buffer 的运行时）；代理对（surrogate pair）与
 *              非配对代理的边界处理；逐行贪心装箱算法。
 * 【产品维度】控制进入模型上下文的工具输出体量，防止大文件/长命令输出撑爆上下文窗口，同时尽量保留有效信息。
 * 【逻辑维度】先算总行数/总字节判断是否需要截断 → 头部策略从前往后收完整行、尾部策略从后往前 →
 *              记录 truncatedBy 标明触发哪条限制；单行超限时头部返回空+标记，尾部允许半行。
 * 【关键边界】默认 2000 行 / 50KB；除尾部特例外绝不返回半行；首行即超字节上限时 truncateHead 返回空内容；
 *              grep 场景另有 500 字符的单行截断。
 * 【新手阅读建议】先看三个常量与 TruncationResult 字段含义 → 再读 truncateHead 主循环 →
 *              最后看 utf8ByteLength 理解多字节字符如何计字节。
 */

// 共享的行数上限默认值：2000 行
export const DEFAULT_MAX_LINES = 2000;
// 共享的字节上限默认值：50KB
export const DEFAULT_MAX_BYTES = 50 * 1024; // 50KB
// grep 匹配行的单行最大字符数
export const GREP_MAX_LINE_LENGTH = 500; // Max chars per grep match line

/** 截断结果（中文说明）：除输出内容外，还报告是否截断、由哪条限制触发、原始/输出规模等诊断信息。 */
export interface TruncationResult {
	/** The truncated content */
	// 截断后的内容
	content: string;
	/** Whether truncation occurred */
	// 是否发生了截断
	truncated: boolean;
	/** Which limit was hit: "lines", "bytes", or null if not truncated */
	// 触发的限制："lines" 行数 / "bytes" 字节 / 未截断为 null
	truncatedBy: "lines" | "bytes" | null;
	/** Total number of lines in the original content */
	// 原始内容的总行数
	totalLines: number;
	/** Total number of bytes in the original content */
	// 原始内容的总字节数（UTF-8）
	totalBytes: number;
	/** Number of complete lines in the truncated output */
	// 输出中的完整行数
	outputLines: number;
	/** Number of bytes in the truncated output */
	// 输出字节数
	outputBytes: number;
	/** Whether the last line was partially truncated (only for tail truncation edge case) */
	// 最后一行是否被部分截断（仅尾部截断特例）
	lastLinePartial: boolean;
	/** Whether the first line exceeded the byte limit (for head truncation) */
	// 首行是否超出字节上限（头部截断场景）
	firstLineExceedsLimit: boolean;
	/** The max lines limit that was applied */
	// 本次应用的行数上限
	maxLines: number;
	/** The max bytes limit that was applied */
	// 本次应用的字节上限
	maxBytes: number;
}

/** 截断选项（中文说明）：两项均可省略并回退默认值。 */
export interface TruncationOptions {
	/** Maximum number of lines (default: 2000) */
	// 最大行数（默认 2000）
	maxLines?: number;
	/** Maximum number of bytes (default: 50KB) */
	// 最大字节数（默认 50KB）
	maxBytes?: number;
}

/** 运行时 Buffer 的最小接口（中文说明）：仅在存在全局 Buffer 时使用其 byteLength 计算 UTF-8 字节数。 */
interface RuntimeBuffer {
	byteLength(content: string, encoding: "utf8"): number;
}

// 全局 Buffer 引用；浏览器等环境为 undefined
const runtimeBuffer = (globalThis as { Buffer?: RuntimeBuffer }).Buffer;
// 非 ASCII 字符匹配模式：用于快速判断是否含多字节字符
const nonAsciiPattern = /[^\x00-\x7f]/;

/**
 * UTF-8 字节长度计算（私有）：优先用运行时 Buffer；否则先查首个非 ASCII 字符——
 * 全 ASCII 直接返回 length；否则按码位累加（1/2/3/4 字节），正确处理代理对（4 字节）。
 */
function utf8ByteLength(content: string): number {
	if (runtimeBuffer) return runtimeBuffer.byteLength(content, "utf8");

	const firstNonAscii = content.search(nonAsciiPattern);
	if (firstNonAscii === -1) return content.length;

	let bytes = firstNonAscii;
	for (let i = firstNonAscii; i < content.length; i++) {
		const code = content.charCodeAt(i);
		if (code <= 0x7f) {
			bytes += 1;
		} else if (code <= 0x7ff) {
			bytes += 2;
		} else if (code >= 0xd800 && code <= 0xdbff && i + 1 < content.length) {
			// 高代理：检查后续是否为低代理构成合法代理对（共 4 字节）
			const next = content.charCodeAt(i + 1);
			if (next >= 0xdc00 && next <= 0xdfff) {
				bytes += 4;
				i++;
			} else {
				bytes += 3;
			}
		} else {
			bytes += 3;
		}
	}
	return bytes;
}

/**
 * 按计数目的切分行（私有）：以 \n 切分；结尾若以 \n 结束则去掉末尾空串，
 * 使行数统计与直觉一致（尾换行不算新的一行）。
 */
function splitLinesForCounting(content: string): string[] {
	if (content.length === 0) return [];
	const lines = content.split("\n");
	if (content.endsWith("\n")) lines.pop();
	return lines;
}

/**
 * 替换非配对代理为占位符（私有）：遍历码元，成对的高/低代理原样保留，
 * 孤立的低代理或高代理替换为 U+FFFD，保证输出是合法字符串。
 */
function replaceUnpairedSurrogates(content: string): string {
	let output = "";
	for (let i = 0; i < content.length; i++) {
		const code = content.charCodeAt(i);
		if (code >= 0xd800 && code <= 0xdbff) {
			if (i + 1 < content.length) {
				const next = content.charCodeAt(i + 1);
				if (next >= 0xdc00 && next <= 0xdfff) {
					output += content[i] + content[i + 1];
					i++;
					continue;
				}
			}
			output += "�";
		} else if (code >= 0xdc00 && code <= 0xdfff) {
			output += "�";
		} else {
			output += content[i];
		}
	}
	return output;
}

/**
 * Format bytes as human-readable size.
 */
// 字节数格式化为人类可读大小（中文说明）：<1024 显示 B，<1MB 显示 KB（一位小数），否则 MB。
export function formatSize(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes}B`;
	} else if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)}KB`;
	} else {
		return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
	}
}

/**
 * Truncate content from the head (keep first N lines/bytes).
 * Suitable for file reads where you want to see the beginning.
 *
 * Never returns partial lines. If first line exceeds byte limit,
 * returns empty content with firstLineExceedsLimit=true.
 */
// 头部截断（中文说明）：保留开头内容，适合文件读取场景。
// 绝不返回半行；首行单独超字节上限时返回空内容并置 firstLineExceedsLimit=true。
// 参数 content —— 原始文本；options —— 上限选项。返回 TruncationResult。
export function truncateHead(content: string, options: TruncationOptions = {}): TruncationResult {
	const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
	const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

	const totalBytes = utf8ByteLength(content);
	const lines = splitLinesForCounting(content);
	const totalLines = lines.length;

	// Check if no truncation needed
	// 无需截断：整体规模都在限制内则原样返回
	if (totalLines <= maxLines && totalBytes <= maxBytes) {
		return {
			content,
			truncated: false,
			truncatedBy: null,
			totalLines,
			totalBytes,
			outputLines: totalLines,
			outputBytes: totalBytes,
			lastLinePartial: false,
			firstLineExceedsLimit: false,
			maxLines,
			maxBytes,
		};
	}

	// Check if first line alone exceeds byte limit
	// 特例：首行自己就超过字节上限
	const firstLineBytes = utf8ByteLength(lines[0]);
	if (firstLineBytes > maxBytes) {
		return {
			content: "",
			truncated: true,
			truncatedBy: "bytes",
			totalLines,
			totalBytes,
			outputLines: 0,
			outputBytes: 0,
			lastLinePartial: false,
			firstLineExceedsLimit: true,
			maxLines,
			maxBytes,
		};
	}

	// Collect complete lines that fit
	// 贪心收集能放下的完整行
	const outputLinesArr: string[] = [];
	let outputBytesCount = 0;
	let truncatedBy: "lines" | "bytes" = "lines";

	for (let i = 0; i < lines.length && i < maxLines; i++) {
		const line = lines[i];
		const lineBytes = utf8ByteLength(line) + (i > 0 ? 1 : 0); // +1 for newline

		if (outputBytesCount + lineBytes > maxBytes) {
			truncatedBy = "bytes";
			break;
		}

		outputLinesArr.push(line);
		outputBytesCount += lineBytes;
	}

	// If we exited due to line limit
	// 因达到行数上限而结束：标记为 lines
	if (outputLinesArr.length >= maxLines && outputBytesCount <= maxBytes) {
		truncatedBy = "lines";
	}

	const outputContent = outputLinesArr.join("\n");
	const finalOutputBytes = utf8ByteLength(outputContent);

	return {
		content: outputContent,
		truncated: true,
		truncatedBy,
		totalLines,
		totalBytes,
		outputLines: outputLinesArr.length,
		outputBytes: finalOutputBytes,
		lastLinePartial: false,
		firstLineExceedsLimit: false,
		maxLines,
		maxBytes,
	};
}

/**
 * Truncate content from the tail (keep last N lines/bytes).
 * Suitable for bash output where you want to see the end (errors, final results).
 *
 * May return partial first line if the last line of original content exceeds byte limit.
 */
// 尾部截断（中文说明）：保留结尾内容，适合命令输出（错误与最终结果在末尾）的场景。
// 若最后一行本身超过字节上限，允许返回部分首行（lastLinePartial=true）。
export function truncateTail(content: string, options: TruncationOptions = {}): TruncationResult {
	const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
	const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

	const totalBytes = utf8ByteLength(content);
	const lines = splitLinesForCounting(content);
	const totalLines = lines.length;

	// Check if no truncation needed
	// 无需截断时原样返回
	if (totalLines <= maxLines && totalBytes <= maxBytes) {
		return {
			content,
			truncated: false,
			truncatedBy: null,
			totalLines,
			totalBytes,
			outputLines: totalLines,
			outputBytes: totalBytes,
			lastLinePartial: false,
			firstLineExceedsLimit: false,
			maxLines,
			maxBytes,
		};
	}

	// Work backwards from the end
	// 从末尾向前收集
	const outputLinesArr: string[] = [];
	let outputBytesCount = 0;
	let truncatedBy: "lines" | "bytes" = "lines";
	let lastLinePartial = false;

	for (let i = lines.length - 1; i >= 0 && outputLinesArr.length < maxLines; i--) {
		const line = lines[i];
		const lineBytes = utf8ByteLength(line) + (outputLinesArr.length > 0 ? 1 : 0); // +1 for newline

		if (outputBytesCount + lineBytes > maxBytes) {
			truncatedBy = "bytes";
			// Edge case: if we haven't added ANY lines yet and this line exceeds maxBytes,
			// take the end of the line (partial)
			// 特例：一行都没收下且该行超限——从行尾取部分内容
			if (outputLinesArr.length === 0) {
				const truncatedLine = truncateStringToBytesFromEnd(line, maxBytes);
				outputLinesArr.unshift(truncatedLine);
				outputBytesCount = utf8ByteLength(truncatedLine);
				lastLinePartial = true;
			}
			break;
		}

		outputLinesArr.unshift(line);
		outputBytesCount += lineBytes;
	}

	// If we exited due to line limit
	// 因行数上限结束则改标 lines
	if (outputLinesArr.length >= maxLines && outputBytesCount <= maxBytes) {
		truncatedBy = "lines";
	}

	const outputContent = outputLinesArr.join("\n");
	const finalOutputBytes = utf8ByteLength(outputContent);

	return {
		content: outputContent,
		truncated: true,
		truncatedBy,
		totalLines,
		totalBytes,
		outputLines: outputLinesArr.length,
		outputBytes: finalOutputBytes,
		lastLinePartial,
		firstLineExceedsLimit: false,
		maxLines,
		maxBytes,
	};
}

/**
 * Truncate a string to fit within a byte limit (from the end).
 * Handles multi-byte UTF-8 characters correctly.
 */
// 从末尾起按字节上限截取字符串（私有）：逐字符（含代理对判定）向前累计字节数，
// 不拆坏多字节字符；若起点落在孤立代理上则用占位符修复。参数 str/maxBytes。返回安全子串。
function truncateStringToBytesFromEnd(str: string, maxBytes: number): string {
	if (maxBytes <= 0) return "";

	let outputBytes = 0;
	let start = str.length;
	let needsReplacement = false;
	for (let i = str.length; i > 0; ) {
		let characterStart = i - 1;
		const code = str.charCodeAt(characterStart);
		let characterBytes: number;
		let unpairedSurrogate = false;
		if (code >= 0xdc00 && code <= 0xdfff && characterStart > 0) {
			// 低代理：尝试与前一个高代理组成代理对
			const previous = str.charCodeAt(characterStart - 1);
			if (previous >= 0xd800 && previous <= 0xdbff) {
				characterStart--;
				characterBytes = 4;
			} else {
				characterBytes = 3;
				unpairedSurrogate = true;
			}
		} else if (code >= 0xd800 && code <= 0xdfff) {
			characterBytes = 3;
			unpairedSurrogate = true;
		} else {
			characterBytes = code <= 0x7f ? 1 : code <= 0x7ff ? 2 : 3;
		}
		if (outputBytes + characterBytes > maxBytes) break;
		outputBytes += characterBytes;
		start = characterStart;
		needsReplacement ||= unpairedSurrogate;
		i = characterStart;
	}

	const output = str.slice(start);
	return needsReplacement ? replaceUnpairedSurrogates(output) : output;
}

/**
 * Truncate a single line to max characters, adding [truncated] suffix.
 * Used for grep match lines.
 */
// 单行按字符数截断（中文说明）：超长时截到 maxChars 并追加 "... [truncated]" 后缀；
// 默认上限 GREP_MAX_LINE_LENGTH。返回 { text 结果, wasTruncated 是否被截 }。
// 使用示例：truncateLine(longGrepMatch) 用于压缩 grep 输出中的超长匹配行。
export function truncateLine(
	line: string,
	maxChars: number = GREP_MAX_LINE_LENGTH,
): { text: string; wasTruncated: boolean } {
	if (line.length <= maxChars) {
		return { text: line, wasTruncated: false };
	}
	return { text: `${line.slice(0, maxChars)}... [truncated]`, wasTruncated: true };
}
