/**
 * 【文件职责】实现编辑器的“按词移动光标”逻辑：向前/向后跳一个词，
 *              正确处理空白、词、ASCII 标点与“原子段”（如粘贴标记整体跳过）。
 * 【技术维度】Intl.Segmenter 词级切分（可注入自定义 segment）；迭代器/数组两种遍历方式；
 *              纯函数设计，无任何状态修改。
 * 【产品维度】Ctrl+左/右方向键的底层实现：让用户在命令行里高效地按词编辑长输入。
 * 【逻辑维度】findWordBackward：切分光标前文本 → 弹掉尾部空白 → 按末段类型（原子/词/标点）决定回退量；
 *              findWordForward：对称地跳过前导空白后前进。
 * 【关键边界】词内含 ASCII 标点时只退/进到标点边界而非整词；原子段永远整体跨越；
 *              cursor 越界自动钳制到 0 或文本长度。
 * 【新手阅读建议】先读 WordNavigationOptions 了解两个可注入项 → 再对照阅读 backward/forward 两个函数
 *              （结构镜像，便于理解）。
 */
import { getWordSegmenter, isWhitespaceChar, PUNCTUATION_REGEX } from "./utils.ts";

// 共享的词级分词器实例（模块加载时创建一次）
const wordSegmenter = getWordSegmenter();

/**
 * Options for word navigation functions.
 * When omitted, uses the default Intl.Segmenter word segmentation.
 */
/**
 * 词导航选项（中文说明）：两项均可省略并回退默认行为。
 */
export interface WordNavigationOptions {
	/** Custom segmenter returning word segments for the given text. */
	// 自定义分词函数：返回给定文本的词段序列
	segment?: (text: string) => Iterable<Intl.SegmentData>;
	/** Predicate identifying atomic segments that should be treated as single units (e.g. paste markers). */
	// 原子段判定：命中的段视为不可分割的整体（如粘贴标记），光标一次跨过
	isAtomicSegment?: (segment: string) => boolean;
}

/**
 * Find the cursor position after moving one word backward from `cursor` in `text`.
 * Skips trailing whitespace, then stops at the next word/punctuation boundary.
 *
 * Pure function - does not mutate any state.
 */
// 向后移动一个词（中文说明）：参数 text 全文、cursor 当前位置；
// 返回新光标位置。流程：弹尾部空白 → 原子段整体退 / 词内遇 ASCII 标点停在标点处 / 标点串整串跳过。
export function findWordBackward(text: string, cursor: number, options?: WordNavigationOptions): number {
	if (cursor <= 0) return 0;

	// 只需切分光标之前的文本
	const textBeforeCursor = text.slice(0, cursor);
	const segmentFn = options?.segment;
	const isAtomic = options?.isAtomicSegment;
	const segments = segmentFn ? [...segmentFn(textBeforeCursor)] : [...wordSegmenter.segment(textBeforeCursor)];
	let newCursor = cursor;

	// Skip trailing whitespace
	// 第一步：从末尾弹掉所有空白段
	while (
		segments.length > 0 &&
		!isAtomic?.(segments[segments.length - 1]?.segment || "") &&
		isWhitespaceChar(segments[segments.length - 1]?.segment || "")
	) {
		newCursor -= segments.pop()?.segment.length || 0;
	}

	if (segments.length === 0) return newCursor;

	const last = segments[segments.length - 1]!;

	if (isAtomic?.(last.segment)) {
		// Skip one atomic segment.
		// 原子段：整体后退
		newCursor -= last.segment.length;
	} else if (last.isWordLike) {
		// Skip inside one word-like segment, preserving ASCII punctuation boundaries.
		// 词段：若内含 ASCII 标点则只退到该标点之后的位置
		const segment = last.segment;
		const matches = [...segment.matchAll(new RegExp(PUNCTUATION_REGEX, "g"))];
		if (matches.length <= 0) {
			newCursor -= segment.length;
		} else {
			const lastMatch = matches[matches.length - 1]!;
			newCursor -= segment.length - (lastMatch.index + lastMatch[0].length);
		}
	} else {
		// Skip non-word non-whitespace run (punctuation)
		// 标点段：连续的非词非空白整串跳过
		while (
			segments.length > 0 &&
			!isAtomic?.(segments[segments.length - 1]?.segment || "") &&
			!segments[segments.length - 1]?.isWordLike &&
			!isWhitespaceChar(segments[segments.length - 1]?.segment || "")
		) {
			newCursor -= segments.pop()?.segment.length || 0;
		}
	}

	return newCursor;
}

/**
 * Find the cursor position after moving one word forward from `cursor` in `text`.
 * Skips leading whitespace, then stops at the next word/punctuation boundary.
 *
 * Pure function - does not mutate any state.
 */
// 向前移动一个词（中文说明）：与 findWordBackward 镜像——先跳过前导空白，
// 再按首段类型（原子/词/标点）决定前进量。返回新光标位置。
export function findWordForward(text: string, cursor: number, options?: WordNavigationOptions): number {
	if (cursor >= text.length) return text.length;

	// 只需切分光标之后的文本
	const textAfterCursor = text.slice(cursor);
	const segmentFn = options?.segment;
	const isAtomic = options?.isAtomicSegment;
	const segments = segmentFn ? segmentFn(textAfterCursor) : wordSegmenter.segment(textAfterCursor);
	const iterator = segments[Symbol.iterator]();
	let next = iterator.next();
	let newCursor = cursor;

	// Skip leading whitespace
	// 第一步：跳过所有前导空白段
	while (!next.done && !isAtomic?.(next.value.segment) && isWhitespaceChar(next.value.segment)) {
		newCursor += next.value.segment.length;
		next = iterator.next();
	}

	if (next.done) return newCursor;

	if (isAtomic?.(next.value.segment)) {
		// Skip one atomic segment.
		// 原子段：整体前进
		newCursor += next.value.segment.length;
	} else if (next.value.isWordLike) {
		// Skip inside one word-like segment, preserving ASCII punctuation boundaries.
		// 词段：前进到词内首个 ASCII 标点处（无标点则到词尾）
		newCursor += PUNCTUATION_REGEX.exec(next.value.segment)?.index ?? next.value.segment.length;
	} else {
		// Skip non-word non-whitespace run (punctuation)
		// 标点段：连续的非词非空白整串跳过
		while (
			!next.done &&
			!isAtomic?.(next.value.segment) &&
			!next.value.isWordLike &&
			!isWhitespaceChar(next.value.segment)
		) {
			newCursor += next.value.segment.length;
			next = iterator.next();
		}
	}

	return newCursor;
}
