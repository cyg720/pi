/**
 * Shared diff computation utilities for the edit and similar tools.
 */
/**
 * 【文件职责】edit 等工具共享的 diff 计算工具集：换行符检测/归一化/还原、模糊匹配归一化、
 *              多处文本替换（含“保留未变更行”的模糊回写）、统一补丁生成与带行号的可读 diff 输出。
 * 【技术维度】diff 库（createTwoFilesPatch/diffLines）；NFKC Unicode 归一化；
 *              行区间（LineSpan）计算与逆序替换保持偏移稳定。
 * 【产品维度】让模型提供的 old_text→new_text 编辑在真实文件上可靠落地：
 *              模型输出的引号/破折号/行尾空白常与文件不完全一致，模糊匹配 + 逐行回写大幅降低编辑失败率，
 *              并向用户展示可读的差异预览。
 * 【逻辑维度】基础函数（detectLineEnding 等）→ fuzzyFindText 先精确后模糊 →
 *              applyEditsToNormalizedContent 统一编排校验（空文本/未找到/重复/重叠/无变化）→
 *              applyReplacementsPreservingUnchangedLines 把规范化空间中的改动映射回原始内容 →
 *              generateUnifiedPatch/generateDiffString 产出展示用差异。
 * 【关键边界】所有编辑必须唯一匹配且互不重叠；模糊匹配时改动以“行为单位”回写原内容，
 *              未触及行保留原始字节；BOM 单独剥离由调用方决定是否写回。
 * 【新手阅读建议】先读 normalizeForFuzzyMatch 与 fuzzyFindText 理解匹配策略 → 再读 applyEditsToNormalizedContent
 *              主流程与五类错误 → 最后看 generateDiffString 的上下文裁剪规则。
 */

import * as Diff from "diff";

// 检测内容的换行风格：首个 \n 若属于 \r\n 则为 CRLF，否则 LF；无换行按 LF
export function detectLineEnding(content: string): "\r\n" | "\n" {
	const crlfIdx = content.indexOf("\r\n");
	const lfIdx = content.indexOf("\n");
	if (lfIdx === -1) return "\n";
	if (crlfIdx === -1) return "\n";
	return crlfIdx < lfIdx ? "\r\n" : "\n";
}

// 把 CRLF 与孤立 CR 全部归一化为 LF
export function normalizeToLF(text: string): string {
	return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

// 按目标风格还原换行：CRLF 时把 \n 全部替换为 \r\n
export function restoreLineEndings(text: string, ending: "\r\n" | "\n"): string {
	return ending === "\r\n" ? text.replace(/\n/g, "\r\n") : text;
}

/**
 * Normalize text for fuzzy matching. Applies progressive transformations:
 * - Strip trailing whitespace from each line
 * - Normalize smart quotes to ASCII equivalents
 * - Normalize Unicode dashes/hyphens to ASCII hyphen
 * - Normalize special Unicode spaces to regular space
 */
/**
 * 为模糊匹配归一化文本（中文说明）：NFKC 规范化 + 去每行尾随空白 +
 * 弯引号→ASCII 引号 + 各类 Unicode 连字符→"-" + 特殊空格→普通空格。
 */
export function normalizeForFuzzyMatch(text: string): string {
	return (
		text
			.normalize("NFKC")
			// Strip trailing whitespace per line
			.split("\n")
			.map((line) => line.trimEnd())
			.join("\n")
			// Smart single quotes → '
			.replace(/[\u2018\u2019\u201A\u201B]/g, "'")
			// Smart double quotes → "
			.replace(/[\u201C\u201D\u201E\u201F]/g, '"')
			// Various dashes/hyphens → -
			// U+2010 hyphen, U+2011 non-breaking hyphen, U+2012 figure dash,
			// U+2013 en-dash, U+2014 em-dash, U+2015 horizontal bar, U+2212 minus
			.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, "-")
			// Special spaces → regular space
			// U+00A0 NBSP, U+2002-U+200A various spaces, U+202F narrow NBSP,
			// U+205F medium math space, U+3000 ideographic space
			.replace(/[\u00A0\u2002-\u200A\u202F\u205F\u3000]/g, " ")
	);
}

// 按“含结尾换行”切分行（私有）：每段以 \n 结尾（最后一行可能没有）
function splitLinesWithEndings(content: string): string[] {
	return content.match(/[^\n]*\n|[^\n]+/g) ?? [];
}

/** 行区间（私有）：start/end 为该行在原文中的字节偏移范围。 */
interface LineSpan {
	start: number;
	end: number;
}

/** 已匹配的编辑（私有）：记录编辑序号、匹配位置/长度与新文本。 */
interface MatchedEdit {
	editIndex: number;
	matchIndex: number;
	matchLength: number;
	newText: string;
}

/** 纯文本替换（私有）：只要位置、长度、新文本三要素。 */
type TextReplacement = Pick<MatchedEdit, "matchIndex" | "matchLength" | "newText">;

// 计算基线内容每一行的偏移区间（私有）
function getLineSpans(content: string): LineSpan[] {
	let offset = 0;
	return splitLinesWithEndings(content).map((line) => {
		const span = { start: offset, end: offset + line.length };
		offset = span.end;
		return span;
	});
}

// 计算替换涉及的行范围（私有）：起止越界抛错；返回 [startLine, endLine) 半开区间
function getReplacementLineRange(lines: LineSpan[], replacement: TextReplacement) {
	const replacementStart = replacement.matchIndex;
	const replacementEnd = replacement.matchIndex + replacement.matchLength;

	let startLine = -1;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (replacementStart >= line.start && replacementStart < line.end) {
			startLine = i;
			break;
		}
	}
	if (startLine === -1) {
		throw new Error("Replacement range is outside the base content.");
	}

	let endLine = startLine;
	while (endLine < lines.length && lines[endLine].end < replacementEnd) {
		endLine++;
	}
	if (endLine >= lines.length) {
		throw new Error("Replacement range is outside the base content.");
	}

	return { startLine, endLine: endLine + 1 };
}

// 在 content 上应用一组替换（私有）：逆序执行使前面的偏移不受影响；offset 用于坐标平移
function applyReplacements(content: string, replacements: TextReplacement[], offset = 0): string {
	let result = content;
	for (let i = replacements.length - 1; i >= 0; i--) {
		const replacement = replacements[i];
		const matchIndex = replacement.matchIndex - offset;
		result =
			result.substring(0, matchIndex) + replacement.newText + result.substring(matchIndex + replacement.matchLength);
	}
	return result;
}

/**
 * Apply replacements matched against `baseContent` to `originalContent` while
 * preserving unchanged line blocks from the original.
 *
 * This is useful when `baseContent` is a normalized view of the original. Each
 * replacement is widened to the lines it actually touches, those touched lines
 * are rewritten from the normalized base, and all other lines are copied back
 * from `originalContent`. The actual replacement ranges drive preservation so
 * duplicate normalized lines cannot be aligned to the wrong occurrence.
 */
/**
 * 应用替换同时保留未变更的原始行（中文说明）：
 * 匹配发生在规范化基线上，落笔却尽量回到原文——把每个替换扩展到其触及的整行，
 * 仅重写被触及的行块，其余行从 originalContent 原样复制。
 * 参数 originalContent —— 原始内容；baseContent —— 规范化视图；replacements —— 基线坐标的替换列表。
 */
export function applyReplacementsPreservingUnchangedLines(
	originalContent: string,
	baseContent: string,
	replacements: TextReplacement[],
): string {
	const originalLines = splitLinesWithEndings(originalContent);
	const baseLines = getLineSpans(baseContent);
	// 两边行数必须一致（规范化不增删行），否则无法对齐
	if (originalLines.length !== baseLines.length) {
		throw new Error("Cannot preserve unchanged lines because the base content has a different line count.");
	}

	// 相邻/重叠的替换合并为同一组（同一行块）
	const groups: Array<{ startLine: number; endLine: number; replacements: TextReplacement[] }> = [];
	const sortedReplacements = [...replacements].sort((a, b) => a.matchIndex - b.matchIndex);
	for (const replacement of sortedReplacements) {
		const range = getReplacementLineRange(baseLines, replacement);
		const current = groups[groups.length - 1];
		if (current && range.startLine < current.endLine) {
			current.endLine = Math.max(current.endLine, range.endLine);
			current.replacements.push(replacement);
			continue;
		}
		groups.push({ ...range, replacements: [replacement] });
	}

	let originalLineIndex = 0;
	let result = "";
	for (const group of groups) {
		// 复制本组之前未受影响的原始行
		result += originalLines.slice(originalLineIndex, group.startLine).join("");

		// 本组：取基线对应行块并施加其中的全部替换
		const groupStartOffset = baseLines[group.startLine].start;
		const groupEndOffset = baseLines[group.endLine - 1].end;
		result += applyReplacements(
			baseContent.slice(groupStartOffset, groupEndOffset),
			group.replacements,
			groupStartOffset,
		);
		originalLineIndex = group.endLine;
	}
	// 收尾：剩余原始行
	result += originalLines.slice(originalLineIndex).join("");

	return result;
}

/** 模糊查找结果（中文说明）：是否找到、匹配下标/长度、是否用了模糊匹配，以及应作为替换基准的内容版本。 */
export interface FuzzyMatchResult {
	/** Whether a match was found */
	// 是否找到匹配
	found: boolean;
	/** The index where the match starts (in the content that should be used for replacement) */
	// 匹配起始下标（相对 contentForReplacement）
	index: number;
	/** Length of the matched text */
	// 匹配文本长度
	matchLength: number;
	/** Whether fuzzy matching was used (false = exact match) */
	// 是否使用了模糊匹配（false 表示精确命中）
	usedFuzzyMatch: boolean;
	/**
	 * The content to use for replacement operations.
	 * When exact match: original content. When fuzzy match: normalized content.
	 */
	// 替换操作应基于的内容：精确=原文；模糊=归一化版
	contentForReplacement: string;
}

/** 单条编辑（中文说明）：oldText 待替换片段；newText 替换后的内容。 */
export interface Edit {
	oldText: string;
	newText: string;
}

/** 编辑应用结果（中文说明）：baseContent 为参与匹配的基线；newContent 为替换后的新内容。 */
export interface AppliedEditsResult {
	baseContent: string;
	newContent: string;
}

/**
 * Find oldText in content, trying exact match first, then fuzzy match.
 * When fuzzy matching is used, the returned contentForReplacement is the
 * fuzzy-normalized version of the content (trailing whitespace stripped,
 * Unicode quotes/dashes normalized to ASCII).
 */
// 在内容中查找 oldText：先精确 indexOf，失败后在双侧归一化的空间中再找一次
export function fuzzyFindText(content: string, oldText: string): FuzzyMatchResult {
	// Try exact match first
	const exactIndex = content.indexOf(oldText);
	if (exactIndex !== -1) {
		return {
			found: true,
			index: exactIndex,
			matchLength: oldText.length,
			usedFuzzyMatch: false,
			contentForReplacement: content,
		};
	}

	// Try fuzzy match - work entirely in normalized space
	const fuzzyContent = normalizeForFuzzyMatch(content);
	const fuzzyOldText = normalizeForFuzzyMatch(oldText);
	const fuzzyIndex = fuzzyContent.indexOf(fuzzyOldText);

	if (fuzzyIndex === -1) {
		return {
			found: false,
			index: -1,
			matchLength: 0,
			usedFuzzyMatch: false,
			contentForReplacement: content,
		};
	}

	// When fuzzy matching, return offsets in normalized space. Callers can use
	// the normalized content to compute replacements, then decide how much of
	// that normalized output should be written back.
	return {
		found: true,
		index: fuzzyIndex,
		matchLength: fuzzyOldText.length,
		usedFuzzyMatch: true,
		contentForReplacement: fuzzyContent,
	};
}

/** Strip UTF-8 BOM if present, return both the BOM (if any) and the text without it */
// 剥离 UTF-8 BOM：返回 { bom 剥离出的 BOM（可能为空串）, text 无 BOM 正文 }
export function stripBom(content: string): { bom: string; text: string } {
	return content.startsWith("\uFEFF") ? { bom: "\uFEFF", text: content.slice(1) } : { bom: "", text: content };
}

// 统计 oldText 在归一化空间中的出现次数（私有）
function countOccurrences(content: string, oldText: string): number {
	const fuzzyContent = normalizeForFuzzyMatch(content);
	const fuzzyOldText = normalizeForFuzzyMatch(oldText);
	return fuzzyContent.split(fuzzyOldText).length - 1;
}

// 构造“找不到文本”错误（私有）：单编辑与多编辑给出不同文案
function getNotFoundError(path: string, editIndex: number, totalEdits: number): Error {
	if (totalEdits === 1) {
		return new Error(
			`Could not find the exact text in ${path}. The old text must match exactly including all whitespace and newlines.`,
		);
	}
	return new Error(
		`Could not find edits[${editIndex}] in ${path}. The oldText must match exactly including all whitespace and newlines.`,
	);
}

// 构造“重复出现”错误（私有）：要求提供更多上下文保证唯一
function getDuplicateError(path: string, editIndex: number, totalEdits: number, occurrences: number): Error {
	if (totalEdits === 1) {
		return new Error(
			`Found ${occurrences} occurrences of the text in ${path}. The text must be unique. Please provide more context to make it unique.`,
		);
	}
	return new Error(
		`Found ${occurrences} occurrences of edits[${editIndex}] in ${path}. Each oldText must be unique. Please provide more context to make it unique.`,
	);
}

// 构造“空 oldText”错误（私有）
function getEmptyOldTextError(path: string, editIndex: number, totalEdits: number): Error {
	if (totalEdits === 1) {
		return new Error(`oldText must not be empty in ${path}.`);
	}
	return new Error(`edits[${editIndex}].oldText must not be empty in ${path}.`);
}

// 构造“无变化”错误（私有）：替换前后内容一致视为可疑操作
function getNoChangeError(path: string, totalEdits: number): Error {
	if (totalEdits === 1) {
		return new Error(
			`No changes made to ${path}. The replacement produced identical content. This might indicate an issue with special characters or the text not existing as expected.`,
		);
	}
	return new Error(`No changes made to ${path}. The replacements produced identical content.`);
}

/**
 * Apply one or more exact-text replacements to LF-normalized content.
 *
 * All edits are matched against the same original content. Replacements are
 * then applied in reverse order so offsets remain stable. If any edit needs
 * fuzzy matching, the operation runs in fuzzy-normalized content space and then
 * overlays those line-level changes onto the original content so unchanged line
 * blocks keep their original bytes.
 */
/**
 * 在 LF 归一化内容上应用一条或多条文本替换（中文说明）：
 * 步骤：归一化各编辑 → 校验非空 → 判断是否需要模糊匹配（任一编辑模糊则整体切换到归一化空间）→
 * 逐一匹配（未找到/重复即报错）→ 排序并检查重叠 → 应用替换（模糊时走“保留未变更行”）→
 * 结果与基线相同报无变化错误。
 * 参数 normalizedContent —— 已 LF 归一化的原内容；edits —— 编辑列表；path —— 报错用的路径名。
 */
export function applyEditsToNormalizedContent(
	normalizedContent: string,
	edits: Edit[],
	path: string,
): AppliedEditsResult {
	// 编辑文本也做 LF 归一化
	const normalizedEdits = edits.map((edit) => ({
		oldText: normalizeToLF(edit.oldText),
		newText: normalizeToLF(edit.newText),
	}));

	for (let i = 0; i < normalizedEdits.length; i++) {
		if (normalizedEdits[i].oldText.length === 0) {
			throw getEmptyOldTextError(path, i, normalizedEdits.length);
		}
	}

	// 预检：是否存在任何需要模糊匹配的编辑
	const initialMatches = normalizedEdits.map((edit) => fuzzyFindText(normalizedContent, edit.oldText));
	const usedFuzzyMatch = initialMatches.some((match) => match.usedFuzzyMatch);
	const replacementBaseContent = usedFuzzyMatch ? normalizeForFuzzyMatch(normalizedContent) : normalizedContent;

	// 逐一匹配并校验唯一性
	const matchedEdits: MatchedEdit[] = [];
	for (let i = 0; i < normalizedEdits.length; i++) {
		const edit = normalizedEdits[i];
		const matchResult = fuzzyFindText(replacementBaseContent, edit.oldText);
		if (!matchResult.found) {
			throw getNotFoundError(path, i, normalizedEdits.length);
		}

		const occurrences = countOccurrences(replacementBaseContent, edit.oldText);
		if (occurrences > 1) {
			throw getDuplicateError(path, i, normalizedEdits.length, occurrences);
		}

		matchedEdits.push({
			editIndex: i,
			matchIndex: matchResult.index,
			matchLength: matchResult.matchLength,
			newText: edit.newText,
		});
	}

	// 按位置排序后两两检查重叠
	matchedEdits.sort((a, b) => a.matchIndex - b.matchIndex);
	for (let i = 1; i < matchedEdits.length; i++) {
		const previous = matchedEdits[i - 1];
		const current = matchedEdits[i];
		if (previous.matchIndex + previous.matchLength > current.matchIndex) {
			throw new Error(
				`edits[${previous.editIndex}] and edits[${current.editIndex}] overlap in ${path}. Merge them into one edit or target disjoint regions.`,
			);
		}
	}

	const baseContent = normalizedContent;
	// 模糊模式：行级回写保留原文；精确模式：直接整体替换
	const newContent = usedFuzzyMatch
		? applyReplacementsPreservingUnchangedLines(normalizedContent, replacementBaseContent, matchedEdits)
		: applyReplacements(replacementBaseContent, matchedEdits);

	if (baseContent === newContent) {
		throw getNoChangeError(path, normalizedEdits.length);
	}

	return { baseContent, newContent };
}

/** Generate a standard unified patch. */
// 生成标准 unified 补丁（中文说明）：同一文件的旧/新内容对比，默认 4 行上下文。
// 返回可直接展示或套用的补丁文本。
export function generateUnifiedPatch(path: string, oldContent: string, newContent: string, contextLines = 4): string {
	return Diff.createTwoFilesPatch(path, path, oldContent, newContent, undefined, undefined, {
		context: contextLines,
		headerOptions: Diff.FILE_HEADERS_ONLY,
	});
}

/**
 * Generate a display-oriented diff string with line numbers and context.
 * Returns both the diff string and the first changed line number (in the new file).
 */
// 生成为人眼设计的差异字符串（中文说明）：带行号 +/- 标记，
// 变更附近仅显示 contextLines 行上下文，其余以 "..." 折叠；
// 同时返回新文件中第一处变更的行号（供 UI 定位滚动）。
export function generateDiffString(
	oldContent: string,
	newContent: string,
	contextLines = 4,
): { diff: string; firstChangedLine: number | undefined } {
	const parts = Diff.diffLines(oldContent, newContent);
	const output: string[] = [];

	// 计算行号列宽（按最大行数的位数对齐）
	const oldLines = oldContent.split("\n");
	const newLines = newContent.split("\n");
	const maxLineNum = Math.max(oldLines.length, newLines.length);
	const lineNumWidth = String(maxLineNum).length;

	// 当前扫描到的新旧行号
	let oldLineNum = 1;
	let newLineNum = 1;
	// 上一段是否为变更（用于判断上下文显示策略）
	let lastWasChange = false;
	// 新文件中第一处变更的行号
	let firstChangedLine: number | undefined;

	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];
		const raw = part.value.split("\n");
		if (raw[raw.length - 1] === "") {
			raw.pop();
		}

		if (part.added || part.removed) {
			// Capture the first changed line (in the new file)
			if (firstChangedLine === undefined) {
				firstChangedLine = newLineNum;
			}

			// Show the change
			for (const line of raw) {
				if (part.added) {
					const lineNum = String(newLineNum).padStart(lineNumWidth, " ");
					output.push(`+${lineNum} ${line}`);
					newLineNum++;
				} else {
					// removed
					const lineNum = String(oldLineNum).padStart(lineNumWidth, " ");
					output.push(`-${lineNum} ${line}`);
					oldLineNum++;
				}
			}
			lastWasChange = true;
		} else {
			// Context lines - only show a few before/after changes
			// 未变更段的四种显示策略：两侧邻接变更 / 仅前侧 / 仅后侧 / 完全跳过
			const nextPartIsChange = i < parts.length - 1 && (parts[i + 1].added || parts[i + 1].removed);
			const hasLeadingChange = lastWasChange;
			const hasTrailingChange = nextPartIsChange;

			if (hasLeadingChange && hasTrailingChange) {
				if (raw.length <= contextLines * 2) {
					for (const line of raw) {
						const lineNum = String(oldLineNum).padStart(lineNumWidth, " ");
						output.push(` ${lineNum} ${line}`);
						oldLineNum++;
						newLineNum++;
					}
				} else {
					// 中间过长：头尾各留 contextLines，中间折叠
					const leadingLines = raw.slice(0, contextLines);
					const trailingLines = raw.slice(raw.length - contextLines);
					const skippedLines = raw.length - leadingLines.length - trailingLines.length;

					for (const line of leadingLines) {
						const lineNum = String(oldLineNum).padStart(lineNumWidth, " ");
						output.push(` ${lineNum} ${line}`);
						oldLineNum++;
						newLineNum++;
					}

					output.push(` ${"".padStart(lineNumWidth, " ")} ...`);
					oldLineNum += skippedLines;
					newLineNum += skippedLines;

					for (const line of trailingLines) {
						const lineNum = String(oldLineNum).padStart(lineNumWidth, " ");
						output.push(` ${lineNum} ${line}`);
						oldLineNum++;
						newLineNum++;
					}
				}
			} else if (hasLeadingChange) {
				// 只在前侧显示少量上下文
				const shownLines = raw.slice(0, contextLines);
				const skippedLines = raw.length - shownLines.length;

				for (const line of shownLines) {
					const lineNum = String(oldLineNum).padStart(lineNumWidth, " ");
					output.push(` ${lineNum} ${line}`);
					oldLineNum++;
					newLineNum++;
				}

				if (skippedLines > 0) {
					output.push(` ${"".padStart(lineNumWidth, " ")} ...`);
					oldLineNum += skippedLines;
					newLineNum += skippedLines;
				}
			} else if (hasTrailingChange) {
				// 只在后侧显示少量上下文
				const skippedLines = Math.max(0, raw.length - contextLines);
				if (skippedLines > 0) {
					output.push(` ${"".padStart(lineNumWidth, " ")} ...`);
					oldLineNum += skippedLines;
					newLineNum += skippedLines;
				}

				for (const line of raw.slice(skippedLines)) {
					const lineNum = String(oldLineNum).padStart(lineNumWidth, " ");
					output.push(` ${lineNum} ${line}`);
					oldLineNum++;
					newLineNum++;
				}
			} else {
				// Skip these context lines entirely
				oldLineNum += raw.length;
				newLineNum += raw.length;
			}

			lastWasChange = false;
		}
	}

	return { diff: output.join("\n"), firstChangedLine };
}
