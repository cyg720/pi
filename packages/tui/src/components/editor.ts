import type { AutocompleteProvider, AutocompleteSuggestions } from "../autocomplete.ts";
import { getKeybindings } from "../keybindings.ts";
import { decodePrintableKey, matchesKey } from "../keys.ts";
import { KillRing } from "../kill-ring.ts";
import { type Component, CURSOR_MARKER, type Focusable, type TUI } from "../tui.ts";
import { UndoStack } from "../undo-stack.ts";
import {
	cjkBreakRegex,
	getGraphemeSegmenter,
	getWordSegmenter,
	isWhitespaceChar,
	sliceByColumn,
	visibleWidth,
} from "../utils.ts";
import { findWordBackward, findWordForward } from "../word-navigation.ts";
import { SelectList, type SelectListLayoutOptions, type SelectListTheme } from "./select-list.ts";

/**
 * 【文件职责】实现 Editor 多行编辑器组件：核心文本编辑（光标/插入/删除/按词移动）、
 *              历史浏览、撤销、Emacs 风格 kill/yank、粘贴标记系统、滚动视口渲染、
 *              自动补全（斜杠命令/@ 附件/显式触发）、回车判定与提交。
 * 【技术维度】Intl.Segmenter 字素/词级处理 + 粘贴标记合并成原子段；视觉行/逻辑行双坐标；
 *              异步自动补全请求（防抖 + 序号丢弃过期结果 + AbortController 取消）；
 *              覆盖层选择列表；差分友好的整行输出。
 * 【产品维度】是终端聊天输入框/编辑器的主体：长输入、多行、历史翻阅、补全提示
 *              都在这里获得流畅体验。
 * 【逻辑维度】模块级工具（粘贴标记/折行/补全正则）→ 类型与常量 → Editor 类：
 *              状态字段 → 分段/焦点/历史 → 渲染与输入 → 文本操作（插入/删除/移动）→
 *              撤销/kill-ring → 自动补全流水线。
 * 【关键边界】粘贴内容以占位标记进上下文、原文存 pastes 注册表（压缩模型上下文）；
 *              historyDraft 用于历史浏览时保留未提交草稿；自动补全请求带序号，过期结果丢弃；
 *              disableSubmit 时 Enter 只换行。
 * 【新手阅读建议】先读 EditorState/EditorSnapshot 了解状态模型 → 再读 render 与 handleInput
 *              掌握交互主循环 → 最后研究自动补全流水线与粘贴标记机制。
 */
const graphemeSegmenter = getGraphemeSegmenter();
const wordSegmenter = getWordSegmenter();

// 粘贴标记正则：匹配 [paste #1 +123 lines] 或 [paste #2 1234 chars] 形式
/** Regex matching paste markers like `[paste #1 +123 lines]` or `[paste #2 1234 chars]`. */
const PASTE_MARKER_REGEX = /\[paste #(\d+)( (\+\d+ lines|\d+ chars))?\]/g;

/** Non-global version for single-segment testing. */
// 非全局版本：用于单段测试
const PASTE_MARKER_SINGLE = /^\[paste #(\d+)( (\+\d+ lines|\d+ chars))?\]$/;

/** Check if a segment is a paste marker (i.e. was merged by segmentWithMarkers). */
// 判断一个段是否为粘贴标记（私有）：长度至少 10 且匹配单段正则
function isPasteMarker(segment: string): boolean {
	return segment.length >= 10 && PASTE_MARKER_SINGLE.test(segment);
}

/**
 * A segmenter that wraps Intl.Segmenter and merges graphemes that fall
 * within paste markers into single atomic segments.  This makes cursor
 * movement, deletion, word-wrap, etc. treat paste markers as single units.
 *
 * Only markers whose numeric ID exists in `validIds` are merged.
 */
// 带粘贴标记感知的分词器（私有）：把落在有效粘贴标记内的字素合并为单个原子段，
// 使光标移动/删除/折行把标记当整体处理；仅合并 ID 存在于 validIds 的标记
function segmentWithMarkers(
	text: string,
	baseSegmenter: Intl.Segmenter,
	validIds: Set<number>,
): Iterable<Intl.SegmentData> {
	// Fast path: no paste markers in the text or no valid IDs.
	// 快路径：文本中无粘贴标记或无有效 ID 时直接走基础分词器
	if (validIds.size === 0 || !text.includes("[paste #")) {
		return baseSegmenter.segment(text);
	}

	// Find all marker spans with valid IDs.
	// 收集所有带有效 ID 的标记区间
	const markers: Array<{ start: number; end: number }> = [];
	for (const m of text.matchAll(PASTE_MARKER_REGEX)) {
		const id = Number.parseInt(m[1]!, 10);
		if (!validIds.has(id)) continue;
		markers.push({ start: m.index, end: m.index + m[0].length });
	}
	if (markers.length === 0) {
		return baseSegmenter.segment(text);
	}

	// Build merged segment list.
	// 构建合并后的段列表：落在标记内的段并入首段，其余透传
	const baseSegments = baseSegmenter.segment(text);
	const result: Intl.SegmentData[] = [];
	let markerIdx = 0;

	for (const seg of baseSegments) {
		// Skip past markers that are entirely before this segment.
		while (markerIdx < markers.length && markers[markerIdx]!.end <= seg.index) {
			markerIdx++;
		}

		const marker = markerIdx < markers.length ? markers[markerIdx]! : null;

		if (marker && seg.index >= marker.start && seg.index < marker.end) {
			// This segment falls inside a marker.
			// If this is the first segment of the marker, emit a merged segment.
			if (seg.index === marker.start) {
				const markerText = text.slice(marker.start, marker.end);
				result.push({
					segment: markerText,
					index: marker.start,
					input: text,
				});
			}
			// Otherwise skip (already merged into the first segment).
		} else {
			result.push(seg);
		}
	}

	return result;
}

/**
 * Represents a chunk of text for word-wrap layout.
 * Tracks both the text content and its position in the original line.
 */
/** 折行文本块（中文说明）：text 块内容；startIndex/endIndex 在原始行中的字符区间。 */
export interface TextChunk {
	text: string;
	// 显示文本
	// 块文本
	startIndex: number;
	// 起点字符下标（原行）
	endIndex: number;
	// 终点字符下标（原行）
}

/**
 * Split a line into word-wrapped chunks.
 * Wraps at word boundaries when possible, falling back to character-level
 * wrapping for words longer than the available width.
 *
 * @param line - The text line to wrap
 * @param maxWidth - Maximum visible width per chunk
 * @param preSegmented - Optional pre-segmented graphemes (e.g. with paste-marker awareness).
 *                       When omitted the default Intl.Segmenter is used.
 * @returns Array of chunks with text and position information
 */
/**
 * 按词折行（公开）：优先在词边界/空白后断行，超长单词回退到逐字符硬折；
 * 超宽原子段（如窄终端下的粘贴标记）按字素粒度再次递归拆分（仅影响视觉布局，
 * 不改变其逻辑原子性）。返回带原文位置的块数组。
 */
export function wordWrapLine(line: string, maxWidth: number, preSegmented?: Intl.SegmentData[]): TextChunk[] {
	if (!line || maxWidth <= 0) {
		return [{ text: "", startIndex: 0, endIndex: 0 }];
	}

	const lineWidth = visibleWidth(line);
	if (lineWidth <= maxWidth) {
		return [{ text: line, startIndex: 0, endIndex: line.length }];
	}

	const chunks: TextChunk[] = [];
	const segments = preSegmented ?? [...graphemeSegmenter.segment(line)];

	let currentWidth = 0;
	let chunkStart = 0;

	// Wrap opportunity: the position after the last whitespace before a non-whitespace
		// 断行机会：最后一个空白之后的位置（多空格取最后空格之后）；CJK 任意相邻字符间也可断
	// grapheme, i.e. where a line break is allowed.
	let wrapOppIndex = -1;
	let wrapOppWidth = 0;

	for (let i = 0; i < segments.length; i++) {
		const seg = segments[i]!;
		const grapheme = seg.segment;
		const gWidth = visibleWidth(grapheme);
		const charIndex = seg.index;
		const isWs = !isPasteMarker(grapheme) && isWhitespaceChar(grapheme);

		// Overflow check before advancing.
		// 前进前的溢出检查：超过最大宽时回退到最近断行机会，否则当前位置强制断开
		if (currentWidth + gWidth > maxWidth) {
			if (wrapOppIndex >= 0 && currentWidth - wrapOppWidth + gWidth <= maxWidth) {
				// Backtrack to last wrap opportunity (the remaining content
			// 回退到最近断行点（剩余内容加当前字素仍可放下）
				// plus the current grapheme still fits within maxWidth).
				chunks.push({ text: line.slice(chunkStart, wrapOppIndex), startIndex: chunkStart, endIndex: wrapOppIndex });
				chunkStart = wrapOppIndex;
				currentWidth -= wrapOppWidth;
			} else if (chunkStart < charIndex) {
				// No viable wrap opportunity: force-break at current position.
			// 无可用断行点：当前位置强制断开（含回退也放不下宽字符的情况）
				// This also handles the case where backtracking to a word
				// boundary wouldn't help because the remaining content plus
				// the current grapheme (e.g. a wide character) still exceeds
				// maxWidth.
				chunks.push({ text: line.slice(chunkStart, charIndex), startIndex: chunkStart, endIndex: charIndex });
				chunkStart = charIndex;
				currentWidth = 0;
			}
			wrapOppIndex = -1;
		}

		if (gWidth > maxWidth) {
		// 单个原子段超过最大宽（如窄终端的粘贴标记）：按字素粒度重新折行，
		// 拆分仅用于布局，逻辑上仍是原子
			// Single atomic segment wider than maxWidth (e.g. paste marker
			// in a narrow terminal). Re-wrap it at grapheme granularity.

			// The segment remains logically atomic for cursor
			// movement / editing — the split is purely visual for word-wrap layout.
			const subChunks = wordWrapLine(grapheme, maxWidth);
			for (let j = 0; j < subChunks.length - 1; j++) {
				const sc = subChunks[j]!;
				chunks.push({ text: sc.text, startIndex: charIndex + sc.startIndex, endIndex: charIndex + sc.endIndex });
			}
			const last = subChunks[subChunks.length - 1]!;
			chunkStart = charIndex + last.startIndex;
			currentWidth = visibleWidth(last.text);
			wrapOppIndex = -1;
			continue;
		}

		// Advance.
		currentWidth += gWidth;

		// Record wrap opportunity: whitespace followed by non-whitespace
		// 记录断行机会：空白后跟非空白，或任一侧为 CJK 字符
		// (multiple spaces join; the break point is after the last space),
		// or at a boundary where either side is CJK (CJK allows breaking
		// between any adjacent characters).
		const next = segments[i + 1];
		if (isWs && next && (isPasteMarker(next.segment) || !isWhitespaceChar(next.segment))) {
			wrapOppIndex = next.index;
			wrapOppWidth = currentWidth;
		} else if (!isWs && next && !isWhitespaceChar(next.segment)) {
			const isCjk = !isPasteMarker(grapheme) && cjkBreakRegex.test(grapheme);
			const nextIsCjk = !isPasteMarker(next.segment) && cjkBreakRegex.test(next.segment);
			if (isCjk || nextIsCjk) {
				wrapOppIndex = next.index;
				wrapOppWidth = currentWidth;
			}
		}
	}

	// Push final chunk.
	// 收尾：压入剩余内容作为最后一块
	chunks.push({ text: line.slice(chunkStart), startIndex: chunkStart, endIndex: line.length });

	return chunks;
}

// Kitty CSI-u sequences for printable keys, including optional shifted/base codepoints.
// 编辑器内部状态（私有）：lines 各行文本；cursorLine/cursorCol 光标逻辑行列
interface EditorState {
	lines: string[];
	// 文本行数组
	cursorLine: number;
	// 光标所在行（逻辑行索引）
	cursorCol: number;
	// 光标所在列（字符下标）
}

// 撤销快照：编辑器文本状态 + 粘贴注册表（恢复历史时同时还原粘贴内容）
/** Undo snapshot: editor text state plus the paste registry. */
interface EditorSnapshot {
	state: EditorState;
	// 文本状态
	pastes: Map<number, string>;
	// 粘贴注册表副本
	pasteCounter: number;
	// 粘贴计数器副本
}

// 布局行（私有）：text 显示文本；hasCursor 是否含光标；cursorPos 光标字符位置
interface LayoutLine {
	text: string;
	hasCursor: boolean;
	// 该行是否包含光标
	cursorPos?: number;
	// 光标在行内的字符位置
}

/** 编辑器主题（中文说明）：borderColor 边框着色；selectList 补全列表主题。 */
export interface EditorTheme {
	borderColor: (str: string) => string;
	// 边框着色函数
	selectList: SelectListTheme;
	// 自动补全选择列表的主题
}

/** 编辑器选项（中文说明）：paddingX 水平内边距；autocompleteMaxVisible 补全列表最大可见条数。 */
export interface EditorOptions {
	paddingX?: number;
	// 水平内边距（列）
	autocompleteMaxVisible?: number;
	// 补全下拉最大可见条数
}

// 斜杠命令补全列表的布局配置：主列宽度 12-32 列
const SLASH_COMMAND_SELECT_LIST_LAYOUT: SelectListLayoutOptions = {
	minPrimaryColumnWidth: 12,
	// 主列最小宽
	maxPrimaryColumnWidth: 32,
	// 主列最大宽
};

// 附件补全的防抖时长（毫秒）
const ATTACHMENT_AUTOCOMPLETE_DEBOUNCE_MS = 20;
// 默认补全触发字符：@（附件/文件）与 #（斜杠命令）
const DEFAULT_AUTOCOMPLETE_TRIGGER_CHARACTERS = ["@", "#"];

// 转义正则字符类中的元字符（私有）
function escapeCharacterClass(value: string): string {
	return value.replace(/[\\^$.*+?()[\]{}|-]/g, "\\$&");
}

// 构建触发模式（私有）：词元开头紧跟任一触发字符且之后无空白
function buildTriggerPattern(triggerCharacters: string[]): RegExp {
	return new RegExp(`(?:^|[\\s])[${triggerCharacters.map(escapeCharacterClass).join("")}][^\\s]*$`);
}

// 构建防抖模式（私有）：仅对非 @ 的触发字符做防抖（@ 附件始终即时）；
// 支持 @"路径 与 /命令 两种形态
function buildDebouncePattern(triggerCharacters: string[]): RegExp {
	const escapedWithoutAt = triggerCharacters.filter((character) => character !== "@").map(escapeCharacterClass);
	return new RegExp(`(?:^|[ \\t])(?:@(?:"[^"]*|[^\\s]*)|[${escapedWithoutAt.join("")}][^\\s]*)$`);
}

// 生成滚动边框行（私有）：指示方向与隐藏行数；空间不足时用省略号截断
function createScrollBorder(direction: "↑" | "↓", hiddenLineCount: number, width: number): string {
	const availableWidth = Math.max(0, width);
	const indicator = `─── ${direction} ${hiddenLineCount} more `;
	const remaining = availableWidth - visibleWidth(indicator);
	if (remaining >= 0) return indicator + "─".repeat(remaining);

	const ellipsis = "...".slice(0, availableWidth);
	const indicatorWidth = availableWidth - visibleWidth(ellipsis);
	return sliceByColumn(indicator, 0, indicatorWidth, true) + ellipsis;
}

/**
 * Editor（中文说明）：多行编辑器组件，实现 Component 与 Focusable；
 * 聚合文本状态、历史、撤销栈、kill-ring、粘贴注册表与自动补全等子系统。
 */
export class Editor implements Component, Focusable {
	private state: EditorState = {
		lines: [""],
		cursorLine: 0,
		cursorCol: 0,
	};

	/** Focusable interface - set by TUI when focus changes */
	focused: boolean = false;

	protected tui: TUI;
	private theme: EditorTheme;
	private paddingX: number = 0;

	// Store last render width for cursor navigation
	private lastWidth: number = 80;

	// Vertical scrolling support
	private scrollOffset: number = 0;

	// Border color (can be changed dynamically)
	public borderColor: (str: string) => string;

	// Autocomplete support
	private autocompleteProvider?: AutocompleteProvider;
	private autocompleteTriggerCharacters = [...DEFAULT_AUTOCOMPLETE_TRIGGER_CHARACTERS];
	private autocompleteTriggerPattern = buildTriggerPattern(this.autocompleteTriggerCharacters);
	private autocompleteDebouncePattern = buildDebouncePattern(this.autocompleteTriggerCharacters);
	private autocompleteList?: SelectList;
	private autocompleteState: "regular" | "force" | null = null;
	private autocompletePrefix: string = "";
	private autocompleteMaxVisible: number = 5;
	private autocompleteAbort?: AbortController;
	private autocompleteDebounceTimer?: ReturnType<typeof setTimeout>;
	private autocompleteRequestTask: Promise<void> = Promise.resolve();
	private autocompleteStartToken: number = 0;
	private autocompleteRequestId: number = 0;

	// Paste tracking for large pastes
	private pastes: Map<number, string> = new Map();
	private pasteCounter: number = 0;

	// Bracketed paste mode buffering
	private pasteBuffer: string = "";
	private isInPaste: boolean = false;

	// Prompt history for up/down navigation
	private history: string[] = [];
	private historyIndex: number = -1; // -1 = not browsing, 0 = most recent, 1 = older, etc.
	private historyDraft: EditorState | null = null;

	// Kill ring for Emacs-style kill/yank operations
	private killRing = new KillRing();
	private lastAction: "kill" | "yank" | "type-word" | null = null;

	// Character jump mode
	private jumpMode: "forward" | "backward" | null = null;

	// Preferred visual column for vertical cursor movement (sticky column)
	private preferredVisualCol: number | null = null;

	// When the cursor is snapped to the start of an atomic segment, e.g. a
	// paste marker, cursorCol no longer reflects where the cursor would have
	// landed. This field stores the pre-snap cursorCol so that the next
	// vertical move can resolve it to a visual column on whatever VL it belongs
	// to.
	private snappedFromCursorCol: number | null = null;

	// Undo support
	private undoStack = new UndoStack<EditorSnapshot>();

	// 提交回调（Enter 提交时携带全文）
	public onSubmit?: (text: string) => void;
	public onChange?: (text: string) => void;
	// 文本变化回调
	public disableSubmit: boolean = false;
	// 为 true 时 Enter 只换行不提交

	// 构造函数：保存 TUI/主题/边框着色；规范化内边距与补全可见条数
	constructor(tui: TUI, theme: EditorTheme, options: EditorOptions = {}) {
		this.tui = tui;
		this.theme = theme;
		this.borderColor = theme.borderColor;
		const paddingX = options.paddingX ?? 0;
		this.paddingX = Number.isFinite(paddingX) ? Math.max(0, Math.floor(paddingX)) : 0;
		const maxVisible = options.autocompleteMaxVisible ?? 5;
		this.autocompleteMaxVisible = Number.isFinite(maxVisible) ? Math.max(3, Math.min(20, Math.floor(maxVisible))) : 5;
	}

	/** Set of currently valid paste IDs, for marker-aware segmentation. */
	// 当前有效的粘贴 ID 集合（供标记感知分词用）
// 当前有效粘贴 ID 集合（私有）：供标记感知分词使用
	private validPasteIds(): Set<number> {
		return new Set(this.pastes.keys());
	}

	/** Segment text with paste-marker awareness, only merging markers with valid IDs. */
	// 带粘贴标记感知的分词：按模式选择词/字素分词器并合并有效标记
// 带标记感知的分词（私有）：按模式选择词/字素分词器并合并有效粘贴标记
	private segment(text: string, mode: "word" | "grapheme"): Iterable<Intl.SegmentData> {
		return segmentWithMarkers(text, mode === "word" ? wordSegmenter : graphemeSegmenter, this.validPasteIds());
	}

	// 读取水平内边距
	getPaddingX(): number {
		return this.paddingX;
	}

	// 设置水平内边距（规范化后变化才触发重绘）
	setPaddingX(padding: number): void {
		const newPadding = Number.isFinite(padding) ? Math.max(0, Math.floor(padding)) : 0;
		if (this.paddingX !== newPadding) {
			this.paddingX = newPadding;
			this.tui.requestRender();
		}
	}

	// 读取补全可见条数上限
	getAutocompleteMaxVisible(): number {
		return this.autocompleteMaxVisible;
	}

	// 设置补全可见条数上限
	setAutocompleteMaxVisible(maxVisible: number): void {
		const newMaxVisible = Number.isFinite(maxVisible) ? Math.max(3, Math.min(20, Math.floor(maxVisible))) : 5;
		if (this.autocompleteMaxVisible !== newMaxVisible) {
			this.autocompleteMaxVisible = newMaxVisible;
			this.tui.requestRender();
		}
	}

	// 设置自动补全提供器：取消进行中的补全，并同步触发字符配置
	setAutocompleteProvider(provider: AutocompleteProvider): void {
		this.cancelAutocomplete();
		this.autocompleteProvider = provider;
		this.setAutocompleteTriggerCharacters(provider.triggerCharacters ?? []);
	}

	/**
	 * Add a prompt to history for up/down arrow navigation.
	 * Called after successful submission.
	 */
	// 提交成功后加入历史（公开）：去空白、去连续重复、上限 100 条
	addToHistory(text: string): void {
		const trimmed = text.trim();
		if (!trimmed) return;
		// Don't add consecutive duplicates
		// 跳过连续重复项
		if (this.history.length > 0 && this.history[0] === trimmed) return;
		this.history.unshift(trimmed);
		// Limit history size
		// 限制历史规模（最多 100 条）
		if (this.history.length > 100) {
			this.history.pop();
		}
	}

	// 编辑器是否为空（仅一行且为空串）
	private isEditorEmpty(): boolean {
		return this.state.lines.length === 1 && this.state.lines[0] === "";
	}

	// 光标是否在第一视觉行（多行折行后）
	private isOnFirstVisualLine(): boolean {
		const visualLines = this.buildVisualLineMap(this.lastWidth);
		const currentVisualLine = this.findCurrentVisualLine(visualLines);
		return currentVisualLine === 0;
	}

	// 光标是否在最后视觉行
	private isOnLastVisualLine(): boolean {
		const visualLines = this.buildVisualLineMap(this.lastWidth);
		const currentVisualLine = this.findCurrentVisualLine(visualLines);
		return currentVisualLine === visualLines.length - 1;
	}

	// 浏览历史（私有）：方向键上翻/下翻；首次进入时压撤销快照并暂存草稿，
	// 回到索引 -1 时恢复草稿（若之前编辑过）或清空
	private navigateHistory(direction: 1 | -1): void {
		this.lastAction = null;
		if (this.history.length === 0) return;

		const newIndex = this.historyIndex - direction; // Up(-1) increases index, Down(1) decreases
		if (newIndex < -1 || newIndex >= this.history.length) return;

		// Capture state when first entering history browsing mode
		// 首次进入历史浏览时捕获当前状态（供取消浏览后恢复）
		if (this.historyIndex === -1 && newIndex >= 0) {
			this.pushUndoSnapshot();
			this.historyDraft = structuredClone(this.state);
		}

		this.historyIndex = newIndex;

		if (this.historyIndex === -1) {
			const draft = this.historyDraft;
			this.historyDraft = null;
			if (draft) {
				this.state = draft;
				this.preferredVisualCol = null;
				this.snappedFromCursorCol = null;
				this.scrollOffset = 0;
				if (this.onChange) this.onChange(this.getText());
			} else {
				this.setTextInternal("");
			}
		} else {
			this.setTextInternal(this.history[this.historyIndex] || "", direction === -1 ? "start" : "end");
		}
	}

	// 退出历史浏览（私有）：复位索引与草稿
	private exitHistoryBrowsing(): void {
		this.historyIndex = -1;
		this.historyDraft = null;
	}

	/** Internal setText that doesn't reset history state - used by navigateHistory */
	// 内部设置文本（不清历史状态，供历史浏览使用）：设置行/光标并触发 onChange
// 内部设置文本（私有）：不清历史状态，供历史浏览使用；设置行与光标并触发 onChange
	private setTextInternal(text: string, cursorPlacement: "start" | "end" = "end"): void {
		const lines = text.split("\n");
		this.state.lines = lines.length === 0 ? [""] : lines;
		this.state.cursorLine = cursorPlacement === "start" ? 0 : this.state.lines.length - 1;
		this.setCursorCol(cursorPlacement === "start" ? 0 : this.state.lines[this.state.cursorLine]?.length || 0);
		// Reset scroll - render() will adjust to show cursor
		// 复位滚动偏移：render 会依据光标位置调整视口
		this.scrollOffset = 0;

		if (this.onChange) {
			this.onChange(this.getText());
		}
	}

	// 失效：无缓存状态需要清理（渲染缓存由 width 变化自动失效）
	invalidate(): void {
		// No cached state to invalidate currently
	}

	// 渲染（公开）：布局文本 → 滚动定位保持光标可见 → 顶部边框（可含上滚指示）→
	// 逐行绘制（含伪光标反显与硬件光标标记）→ 底部边框（可含下滚指示）→ 补全列表
	render(width: number): string[] {
		const maxPadding = Math.max(0, Math.floor((width - 1) / 2));
		const paddingX = Math.min(this.paddingX, maxPadding);
		const contentWidth = Math.max(1, width - paddingX * 2);

		// Layout width: with padding the cursor can overflow into it,
		// 布局宽度：有内边距时光标可溢出进内边距；无内边距时预留 1 列给光标
		// without padding we reserve 1 column for the cursor.
		const layoutWidth = Math.max(1, contentWidth - (paddingX ? 0 : 1));

		// Store for cursor navigation (must match wrapping width)
		// 记录布局宽度供光标导航使用（必须与折行宽度一致）
		this.lastWidth = layoutWidth;

		const horizontal = this.borderColor("─");

		// Layout the text
		const layoutLines = this.layoutText(layoutWidth);

		// Calculate max visible lines: 30% of terminal height, minimum 5 lines
		// 最大可见行数：终端高度的 30%，至少 5 行
		const terminalRows = this.tui.terminal.rows;
		const maxVisibleLines = Math.max(5, Math.floor(terminalRows * 0.3));

		// Find the cursor line index in layoutLines
		let cursorLineIndex = layoutLines.findIndex((line) => line.hasCursor);
		if (cursorLineIndex === -1) cursorLineIndex = 0;

		// Adjust scroll offset to keep cursor visible
		// 调整滚动偏移使光标始终可见
		if (cursorLineIndex < this.scrollOffset) {
			this.scrollOffset = cursorLineIndex;
		} else if (cursorLineIndex >= this.scrollOffset + maxVisibleLines) {
			this.scrollOffset = cursorLineIndex - maxVisibleLines + 1;
		}

		// Clamp scroll offset to valid range
		const maxScrollOffset = Math.max(0, layoutLines.length - maxVisibleLines);
		this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, maxScrollOffset));

		// Get visible lines slice
		// 取出可见窗口内的布局行
		const visibleLines = layoutLines.slice(this.scrollOffset, this.scrollOffset + maxVisibleLines);

		const result: string[] = [];
		const leftPadding = " ".repeat(paddingX);
		const rightPadding = leftPadding;

		// Render top border (with scroll indicator if scrolled down)
		// 顶部边框：滚下去时显示上滚指示
		if (this.scrollOffset > 0) {
			const border = createScrollBorder("↑", this.scrollOffset, width);
			result.push(this.borderColor(border));
		} else {
			result.push(horizontal.repeat(width));
		}

		// Render each visible layout line
		// Emit hardware cursor marker when focused so TUI can position the
		// 聚焦时发射硬件光标标记，供 TUI 在补全菜单可见时仍能为 IME 定位光标
		// hardware cursor for IME candidate-window placement even while
		// autocomplete (e.g. slash-command menu) is visible.
		const emitCursorMarker = this.focused;

		for (const layoutLine of visibleLines) {
			let displayText = layoutLine.text;
			let lineVisibleWidth = visibleWidth(layoutLine.text);
			let cursorInPadding = false;

			// Add cursor if this line has it
			if (layoutLine.hasCursor && layoutLine.cursorPos !== undefined) {
				const before = displayText.slice(0, layoutLine.cursorPos);
				const after = displayText.slice(layoutLine.cursorPos);

				// Hardware cursor marker (zero-width, emitted before fake cursor for IME positioning)
				// 硬件光标标记：零宽，在伪光标前发射以支持 IME 定位
				const marker = emitCursorMarker ? CURSOR_MARKER : "";

				if (after.length > 0) {
					// Cursor is on a character (grapheme) - replace it with highlighted version
					// 光标在字符上：用反显视频突出该字素作为伪光标
					// Get the first grapheme from 'after'
					const afterGraphemes = [...this.segment(after, "grapheme")];
					const firstGrapheme = afterGraphemes[0]?.segment || "";
					const restAfter = after.slice(firstGrapheme.length);
					const cursor = `\x1b[7m${firstGrapheme}\x1b[0m`;
					displayText = before + marker + cursor + restAfter;
					// lineVisibleWidth stays the same - we're replacing, not adding
				} else {
					// Cursor is at the end - add highlighted space
					// 光标在行尾：追加反显空格作为伪光标
					const cursor = "\x1b[7m \x1b[0m";
					displayText = before + marker + cursor;
					lineVisibleWidth = lineVisibleWidth + 1;
					// If cursor overflows content width into the padding, flag it
					if (lineVisibleWidth > contentWidth && paddingX > 0) {
						cursorInPadding = true;
					}
				}
			}

			// Calculate padding based on actual visible width
			const padding = " ".repeat(Math.max(0, contentWidth - lineVisibleWidth));
			const lineRightPadding = cursorInPadding ? rightPadding.slice(1) : rightPadding;

			// Render the line (no side borders, just horizontal lines above and below)
			// 输出行内容（无左右边框，仅上下横线）
			result.push(`${leftPadding}${displayText}${padding}${lineRightPadding}`);
		}

		// Render bottom border (with scroll indicator if more content below)
		// 底部边框：还有内容时显示下滚指示
		const linesBelow = layoutLines.length - (this.scrollOffset + visibleLines.length);
		if (linesBelow > 0) {
			const border = createScrollBorder("↓", linesBelow, width);
			result.push(this.borderColor(border));
		} else {
			result.push(horizontal.repeat(width));
		}

		// Add autocomplete list if active
		// 补全激活时把选择列表渲染在编辑器下方
		if (this.autocompleteState && this.autocompleteList) {
			const autocompleteResult = this.autocompleteList.render(contentWidth);
			for (const line of autocompleteResult) {
				const lineWidth = visibleWidth(line);
				const linePadding = " ".repeat(Math.max(0, contentWidth - lineWidth));
				result.push(`${leftPadding}${line}${linePadding}${rightPadding}`);
			}
		}

		return result;
	}

	// 输入分发主入口（公开）：跳转模式 → 括号粘贴状态机 → Ctrl+C 让出 →
	// 撤销 → 补全模式按键（取消/上下/应用）→ Tab 触发 → 其余按键逐项分发给具体处理
	handleInput(data: string): void {
		const kb = getKeybindings();

		// Handle character jump mode (awaiting next character to jump to)
		// 字符跳转模式：等待下一个字符执行跳转；再按跳转键则取消
		if (this.jumpMode !== null) {
			// Cancel if the hotkey is pressed again
			if (kb.matches(data, "tui.editor.jumpForward") || kb.matches(data, "tui.editor.jumpBackward")) {
				this.jumpMode = null;
				return;
			}

			const printable = decodePrintableKey(data) ?? (data.charCodeAt(0) >= 32 ? data : undefined);
			if (printable !== undefined) {
				// Printable character - perform the jump
				const direction = this.jumpMode;
				this.jumpMode = null;
				this.jumpToChar(printable, direction);
				return;
			}

			// Control character - cancel and fall through to normal handling
			this.jumpMode = null;
		}

		// Handle bracketed paste mode
		// 括号粘贴模式：进入粘贴接收状态
		if (data.includes("\x1b[200~")) {
			this.isInPaste = true;
			this.pasteBuffer = "";
			data = data.replace("\x1b[200~", "");
		}

		if (this.isInPaste) {
			this.pasteBuffer += data;
			const endIndex = this.pasteBuffer.indexOf("\x1b[201~");
			if (endIndex !== -1) {
				const pasteContent = this.pasteBuffer.substring(0, endIndex);
				if (pasteContent.length > 0) {
					this.handlePaste(pasteContent);
				}
				this.isInPaste = false;
				const remaining = this.pasteBuffer.substring(endIndex + 6);
				this.pasteBuffer = "";
				if (remaining.length > 0) {
					this.handleInput(remaining);
				}
				return;
			}
			return;
		}

		// Ctrl+C - let parent handle (exit/clear)
		// Ctrl+C：让父级处理（退出/清空）
		if (kb.matches(data, "tui.input.copy")) {
			return;
		}

		// Undo
		// 撤销
		if (kb.matches(data, "tui.editor.undo")) {
			this.undo();
			return;
		}

		// Handle autocomplete mode
		// 补全模式：Esc 取消、上下移动、Tab/Enter 应用选中项
		if (this.autocompleteState && this.autocompleteList) {
			if (kb.matches(data, "tui.select.cancel")) {
				this.cancelAutocomplete();
				return;
			}

			if (kb.matches(data, "tui.select.up") || kb.matches(data, "tui.select.down")) {
				this.autocompleteList.handleInput(data);
				return;
			}

			if (kb.matches(data, "tui.input.tab")) {
				const selected = this.autocompleteList.getSelectedItem();
				if (selected && this.autocompleteProvider) {
					this.pushUndoSnapshot();
					this.lastAction = null;
					const result = this.autocompleteProvider.applyCompletion(
						this.state.lines,
						this.state.cursorLine,
						this.state.cursorCol,
						selected,
						this.autocompletePrefix,
					);
					this.state.lines = result.lines;
					this.state.cursorLine = result.cursorLine;
					this.setCursorCol(result.cursorCol);
					this.cancelAutocomplete();
					if (this.onChange) this.onChange(this.getText());
				}
				return;
			}

			if (kb.matches(data, "tui.select.confirm")) {
				const selected = this.autocompleteList.getSelectedItem();
				if (selected && this.autocompleteProvider) {
					this.pushUndoSnapshot();
					this.lastAction = null;
					const result = this.autocompleteProvider.applyCompletion(
						this.state.lines,
						this.state.cursorLine,
						this.state.cursorCol,
						selected,
						this.autocompletePrefix,
					);
					this.state.lines = result.lines;
					this.state.cursorLine = result.cursorLine;
					this.setCursorCol(result.cursorCol);

					if (this.autocompletePrefix.startsWith("/")) {
						this.cancelAutocomplete();
						// Fall through to submit
					} else {
						this.cancelAutocomplete();
						if (this.onChange) this.onChange(this.getText());
						return;
					}
				}
			}
		}

		// Tab - trigger completion
		// 无补全时的 Tab：触发补全
		if (kb.matches(data, "tui.input.tab") && !this.autocompleteState) {
			this.handleTabCompletion();
			return;
		}

		// Deletion actions
		if (kb.matches(data, "tui.editor.deleteToLineEnd")) {
			this.deleteToEndOfLine();
			return;
		}
		if (kb.matches(data, "tui.editor.deleteToLineStart")) {
			this.deleteToStartOfLine();
			return;
		}
		if (kb.matches(data, "tui.editor.deleteWordBackward")) {
			this.deleteWordBackwards();
			return;
		}
		if (kb.matches(data, "tui.editor.deleteWordForward")) {
			this.deleteWordForward();
			return;
		}
		if (kb.matches(data, "tui.editor.deleteCharBackward") || matchesKey(data, "shift+backspace")) {
			this.handleBackspace();
			return;
		}
		if (kb.matches(data, "tui.editor.deleteCharForward") || matchesKey(data, "shift+delete")) {
			this.handleForwardDelete();
			return;
		}

		// Kill ring actions
		if (kb.matches(data, "tui.editor.yank")) {
			this.yank();
			return;
		}
		if (kb.matches(data, "tui.editor.yankPop")) {
			this.yankPop();
			return;
		}

		// Cursor movement actions
		if (kb.matches(data, "tui.editor.cursorLineStart")) {
			this.moveToLineStart();
			return;
		}
		if (kb.matches(data, "tui.editor.cursorLineEnd")) {
			this.moveToLineEnd();
			return;
		}
		if (kb.matches(data, "tui.editor.cursorWordLeft")) {
			this.moveWordBackwards();
			return;
		}
		if (kb.matches(data, "tui.editor.cursorWordRight")) {
			this.moveWordForwards();
			return;
		}

		// New line
		if (
			kb.matches(data, "tui.input.newLine") ||
			(data.charCodeAt(0) === 10 && data.length > 1) ||
			data === "\x1b\r" ||
			data === "\x1b[13;2~" ||
			(data.length > 1 && data.includes("\x1b") && data.includes("\r")) ||
			(data === "\n" && data.length === 1)
		) {
			if (this.shouldSubmitOnBackslashEnter(data, kb)) {
				this.handleBackspace();
				this.submitValue();
				return;
			}
			this.addNewLine();
			return;
		}

		// Submit (Enter)
		if (kb.matches(data, "tui.input.submit")) {
			if (this.disableSubmit) return;

			// Workaround for terminals without Shift+Enter support:
			// If char before cursor is \, delete it and insert newline instead of submitting.
			const currentLine = this.state.lines[this.state.cursorLine] || "";
			if (this.state.cursorCol > 0 && currentLine[this.state.cursorCol - 1] === "\\") {
				this.handleBackspace();
				this.addNewLine();
				return;
			}

			this.submitValue();
			return;
		}

		// Arrow key navigation (with history support)
		if (kb.matches(data, "tui.editor.cursorUp")) {
			if (
				this.isOnFirstVisualLine() &&
				(this.isEditorEmpty() || this.historyIndex > -1 || this.state.cursorCol === 0)
			) {
				this.navigateHistory(-1);
			} else if (this.isOnFirstVisualLine()) {
				// Already at top - jump to start of line
				this.moveToLineStart();
			} else {
				this.moveCursor(-1, 0);
			}
			return;
		}
		if (kb.matches(data, "tui.editor.cursorDown")) {
			if (this.historyIndex > -1 && this.isOnLastVisualLine()) {
				this.navigateHistory(1);
			} else if (this.isOnLastVisualLine()) {
				// Already at bottom - jump to end of line
				this.moveToLineEnd();
			} else {
				this.moveCursor(1, 0);
			}
			return;
		}
		if (kb.matches(data, "tui.editor.cursorRight")) {
			this.moveCursor(0, 1);
			return;
		}
		if (kb.matches(data, "tui.editor.cursorLeft")) {
			this.moveCursor(0, -1);
			return;
		}

		// Page up/down - scroll by page and move cursor
		if (kb.matches(data, "tui.editor.pageUp")) {
			this.pageScroll(-1);
			return;
		}
		if (kb.matches(data, "tui.editor.pageDown")) {
			this.pageScroll(1);
			return;
		}

		// Character jump mode triggers
		if (kb.matches(data, "tui.editor.jumpForward")) {
			this.jumpMode = "forward";
			return;
		}
		if (kb.matches(data, "tui.editor.jumpBackward")) {
			this.jumpMode = "backward";
			return;
		}

		// Shift+Space - insert regular space
		if (matchesKey(data, "shift+space")) {
			this.insertCharacter(" ");
			return;
		}

		const printable = decodePrintableKey(data);
		if (printable !== undefined) {
			this.insertCharacter(printable);
			return;
		}

		// Regular characters
		if (data.charCodeAt(0) >= 32) {
			this.insertCharacter(data);
		}
	}

// 文本布局（私有）：按可用宽度折行逻辑行得到视觉行序列，
// 标记哪一行包含光标及其列位置（供渲染定位光标标记）
	private layoutText(contentWidth: number): LayoutLine[] {
		const layoutLines: LayoutLine[] = [];

		if (this.state.lines.length === 0 || (this.state.lines.length === 1 && this.state.lines[0] === "")) {
			// Empty editor
			layoutLines.push({
				text: "",
				hasCursor: true,
				cursorPos: 0,
			});
			return layoutLines;
		}

		// Process each logical line
		for (let i = 0; i < this.state.lines.length; i++) {
			const line = this.state.lines[i] || "";
			const isCurrentLine = i === this.state.cursorLine;
			const lineVisibleWidth = visibleWidth(line);

			if (lineVisibleWidth <= contentWidth) {
				// Line fits in one layout line
				if (isCurrentLine) {
					layoutLines.push({
						text: line,
						hasCursor: true,
						cursorPos: this.state.cursorCol,
					});
				} else {
					layoutLines.push({
						text: line,
						hasCursor: false,
					});
				}
			} else {
				// Line needs wrapping - use word-aware wrapping
				const chunks = wordWrapLine(line, contentWidth, [...this.segment(line, "grapheme")]);

				for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
					const chunk = chunks[chunkIndex];
					if (!chunk) continue;

					const cursorPos = this.state.cursorCol;
					const isLastChunk = chunkIndex === chunks.length - 1;

					// Determine if cursor is in this chunk
					// For word-wrapped chunks, we need to handle the case where
					// cursor might be in trimmed whitespace at end of chunk
					let hasCursorInChunk = false;
					let adjustedCursorPos = 0;

					if (isCurrentLine) {
						if (isLastChunk) {
							// Last chunk: cursor belongs here if >= startIndex
							hasCursorInChunk = cursorPos >= chunk.startIndex;
							adjustedCursorPos = cursorPos - chunk.startIndex;
						} else {
							// Non-last chunk: cursor belongs here if in range [startIndex, endIndex)
							// But we need to handle the visual position in the trimmed text
							hasCursorInChunk = cursorPos >= chunk.startIndex && cursorPos < chunk.endIndex;
							if (hasCursorInChunk) {
								adjustedCursorPos = cursorPos - chunk.startIndex;
								// Clamp to text length (in case cursor was in trimmed whitespace)
								if (adjustedCursorPos > chunk.text.length) {
									adjustedCursorPos = chunk.text.length;
								}
							}
						}
					}

					if (hasCursorInChunk) {
						layoutLines.push({
							text: chunk.text,
							hasCursor: true,
							cursorPos: adjustedCursorPos,
						});
					} else {
						layoutLines.push({
							text: chunk.text,
							hasCursor: false,
						});
					}
				}
			}
		}

		return layoutLines;
	}

	getText(): string {
		return this.state.lines.join("\n");
	}

// 展开粘贴标记（私有）：把 [paste #N] 替换为注册表中原文本（用于提交/复制等输出场景）
	private expandPasteMarkers(text: string): string {
		let result = text;
		for (const [pasteId, pasteContent] of this.pastes) {
			const markerRegex = new RegExp(`\\[paste #${pasteId}( (\\+\\d+ lines|\\d+ chars))?\\]`, "g");
			result = result.replace(markerRegex, () => pasteContent);
		}
		return result;
	}

	/**
	 * Get text with paste markers expanded to their actual content.
	 * Use this when you need the full content (e.g., for external editor).
	 */
	getExpandedText(): string {
		return this.expandPasteMarkers(this.state.lines.join("\n"));
	}

	getLines(): string[] {
		return [...this.state.lines];
	}

	getCursor(): { line: number; col: number } {
		return { line: this.state.cursorLine, col: this.state.cursorCol };
	}

	setText(text: string): void {
		this.cancelAutocomplete();
		this.lastAction = null;
		this.exitHistoryBrowsing();
		const normalized = this.normalizeText(text);
		// Push undo snapshot if content differs (makes programmatic changes undoable)
		if (this.getText() !== normalized) {
			this.pushUndoSnapshot();
		}
		this.pastes.clear();
		this.pasteCounter = 0;
		this.setTextInternal(normalized);
	}

	/**
	 * Insert text at the current cursor position.
	 * Used for programmatic insertion (e.g., clipboard image markers).
	 * This is atomic for undo - single undo restores entire pre-insert state.
	 */
	insertTextAtCursor(text: string): void {
		if (!text) return;
		this.cancelAutocomplete();
		this.pushUndoSnapshot();
		this.lastAction = null;
		this.exitHistoryBrowsing();
		this.insertTextAtCursorInternal(text);
	}

	/**
	 * Normalize text for editor storage:
	 * - Normalize line endings (\r\n and \r -> \n)
	 * - Expand tabs to 4 spaces
	 */
// 文本归一化（私有）：把 CRLF/CR 统一为 LF
	private normalizeText(text: string): string {
		return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\t/g, "    ");
	}

	/**
	 * Internal text insertion at cursor. Handles single and multi-line text.
	 * Does not push undo snapshots or trigger autocomplete - caller is responsible.
	 * Normalizes line endings and calls onChange once at the end.
	 */
// 在光标处插入文本（私有核心）：按字素逐字符插入并推进光标，保持首选视觉列
	private insertTextAtCursorInternal(text: string): void {
		if (!text) return;

		// Normalize line endings and tabs
		const normalized = this.normalizeText(text);
		const insertedLines = normalized.split("\n");

		const currentLine = this.state.lines[this.state.cursorLine] || "";
		const beforeCursor = currentLine.slice(0, this.state.cursorCol);
		const afterCursor = currentLine.slice(this.state.cursorCol);

		if (insertedLines.length === 1) {
			// Single line - insert at cursor position
			this.state.lines[this.state.cursorLine] = beforeCursor + normalized + afterCursor;
			this.setCursorCol(this.state.cursorCol + normalized.length);
		} else {
			// Multi-line insertion
			this.state.lines = [
				// All lines before current line
				...this.state.lines.slice(0, this.state.cursorLine),

				// The first inserted line merged with text before cursor
				beforeCursor + insertedLines[0],

				// All middle inserted lines
				...insertedLines.slice(1, -1),

				// The last inserted line with text after cursor
				insertedLines[insertedLines.length - 1] + afterCursor,

				// All lines after current line
				...this.state.lines.slice(this.state.cursorLine + 1),
			];

			this.state.cursorLine += insertedLines.length - 1;
			this.setCursorCol((insertedLines[insertedLines.length - 1] || "").length);
		}

		if (this.onChange) {
			this.onChange(this.getText());
		}
	}

	// All the editor methods from before...
// 插入单个字符（私有）：处理换行/制表，管理撤销合并（连续打字合并为一组），
// 更新光标/滚动并触发 onChange 与重绘
	private insertCharacter(char: string, skipUndoCoalescing?: boolean): void {
		this.exitHistoryBrowsing();

		// Undo coalescing (fish-style):
		// - Consecutive word chars coalesce into one undo unit
		// - Space captures state before itself (so undo removes space+following word together)
		// - Each space is separately undoable
		// Skip coalescing when called from atomic operations (e.g., handlePaste)
		if (!skipUndoCoalescing) {
			if (isWhitespaceChar(char) || this.lastAction !== "type-word") {
				this.pushUndoSnapshot();
			}
			this.lastAction = "type-word";
		}

		const line = this.state.lines[this.state.cursorLine] || "";

		const before = line.slice(0, this.state.cursorCol);
		const after = line.slice(this.state.cursorCol);

		this.state.lines[this.state.cursorLine] = before + char + after;
		this.setCursorCol(this.state.cursorCol + char.length);

		if (this.onChange) {
			this.onChange(this.getText());
		}

		// Check if we should trigger or update autocomplete
		if (!this.autocompleteState) {
			// Auto-trigger for "/" at the start of a line (slash commands)
			if (char === "/" && this.isAtStartOfMessage()) {
				this.tryTriggerAutocomplete();
			}
			// Auto-trigger for symbol-based completion like @, #, or provider triggers at token boundaries
			else if (this.autocompleteTriggerCharacters.includes(char)) {
				const currentLine = this.state.lines[this.state.cursorLine] || "";
				const textBeforeCursor = currentLine.slice(0, this.state.cursorCol);
				const charBeforeSymbol = textBeforeCursor[textBeforeCursor.length - 2];
				if (textBeforeCursor.length === 1 || charBeforeSymbol === " " || charBeforeSymbol === "\t") {
					this.tryTriggerAutocomplete();
				}
			}
			// Also auto-trigger when typing letters in a slash command or symbol completion context
			else if (/[a-zA-Z0-9.\-_]/.test(char)) {
				const currentLine = this.state.lines[this.state.cursorLine] || "";
				const textBeforeCursor = currentLine.slice(0, this.state.cursorCol);
				// Check if we're in a slash command (with or without space for arguments)
				if (this.isInSlashCommandContext(textBeforeCursor)) {
					this.tryTriggerAutocomplete();
				}
				// Check if we're in a symbol-based completion context like @, #, or provider triggers
				else if (this.autocompleteTriggerPattern.test(textBeforeCursor)) {
					this.tryTriggerAutocomplete();
				}
			}
		} else {
			this.updateAutocomplete();
		}
	}

// 处理粘贴（私有）：清洗 CR、tab 转 4 空格；内容存入粘贴注册表，
// 在光标处插入占位标记 [paste #N …]（大小超过阈值时），否则直接插入原文
	private handlePaste(pastedText: string): void {
		this.cancelAutocomplete();
		this.exitHistoryBrowsing();
		this.lastAction = null;

		this.pushUndoSnapshot();

		// Some terminals (e.g. tmux popups with extended-keys-format=csi-u) re-encode
		// control bytes inside bracketed paste as CSI-u Ctrl+<letter> sequences
		// (ESC [ <codepoint> ; 5 u). Decode those back to their literal byte so the
		// per-char filter below preserves newlines instead of stripping ESC and
		// leaking the printable tail (e.g. "[106;5u") into the editor.
		const decodedText = pastedText.replace(/\x1b\[(\d+);5u/g, (match, code) => {
			const cp = Number(code);
			if (cp >= 97 && cp <= 122) return String.fromCharCode(cp - 96);
			if (cp >= 65 && cp <= 90) return String.fromCharCode(cp - 64);
			return match;
		});

		// Clean the pasted text: normalize line endings, expand tabs
		const cleanText = this.normalizeText(decodedText);

		// Filter out non-printable characters except newlines
		let filteredText = cleanText
			.split("")
			.filter((char) => char === "\n" || char.charCodeAt(0) >= 32)
			.join("");

		// If pasting a file path (starts with /, ~, or .) and the character before
		// the cursor is a word character, prepend a space for better readability
		if (/^[/~.]/.test(filteredText)) {
			const currentLine = this.state.lines[this.state.cursorLine] || "";
			const charBeforeCursor = this.state.cursorCol > 0 ? currentLine[this.state.cursorCol - 1] : "";
			if (charBeforeCursor && /\w/.test(charBeforeCursor)) {
				filteredText = ` ${filteredText}`;
			}
		}

		// Split into lines to check for large paste
		const pastedLines = filteredText.split("\n");

		// Check if this is a large paste (> 10 lines or > 1000 characters)
		const totalChars = filteredText.length;
		if (pastedLines.length > 10 || totalChars > 1000) {
			// Store the paste and insert a marker
			this.pasteCounter++;
			const pasteId = this.pasteCounter;
			this.pastes.set(pasteId, filteredText);

			// Insert marker like "[paste #1 +123 lines]" or "[paste #1 1234 chars]"
			const marker =
				pastedLines.length > 10
					? `[paste #${pasteId} +${pastedLines.length} lines]`
					: `[paste #${pasteId} ${totalChars} chars]`;
			this.insertTextAtCursorInternal(marker);
			return;
		}

		if (pastedLines.length === 1) {
			// Single line - insert atomically (do not trigger autocomplete during paste)
			this.insertTextAtCursorInternal(filteredText);
			return;
		}

		// Multi-line paste - use direct state manipulation
		this.insertTextAtCursorInternal(filteredText);
	}

// 在光标处插入换行（私有）：拆分当前行并在下一行继续
	private addNewLine(): void {
		this.cancelAutocomplete();
		this.exitHistoryBrowsing();
		this.lastAction = null;

		this.pushUndoSnapshot();

		const currentLine = this.state.lines[this.state.cursorLine] || "";

		const before = currentLine.slice(0, this.state.cursorCol);
		const after = currentLine.slice(this.state.cursorCol);

		// Split current line
		this.state.lines[this.state.cursorLine] = before;
		this.state.lines.splice(this.state.cursorLine + 1, 0, after);

		// Move cursor to start of new line
		this.state.cursorLine++;
		this.setCursorCol(0);

		if (this.onChange) {
			this.onChange(this.getText());
		}
	}

// 判断反斜杠回车是否应提交（私有）：最后一行非空时提交
	private shouldSubmitOnBackslashEnter(data: string, kb: ReturnType<typeof getKeybindings>): boolean {
		if (this.disableSubmit) return false;
		if (!matchesKey(data, "enter")) return false;
		const submitKeys = kb.getKeys("tui.input.submit");
		const hasShiftEnter = submitKeys.includes("shift+enter") || submitKeys.includes("shift+return");
		if (!hasShiftEnter) return false;

		const currentLine = this.state.lines[this.state.cursorLine] || "";
		return this.state.cursorCol > 0 && currentLine[this.state.cursorCol - 1] === "\\";
	}

// 提交（私有）：展开粘贴标记后触发 onSubmit，成功后加入历史
	private submitValue(): void {
		this.cancelAutocomplete();
		const result = this.expandPasteMarkers(this.state.lines.join("\n")).trim();

		this.state = { lines: [""], cursorLine: 0, cursorCol: 0 };
		this.pastes.clear();
		this.pasteCounter = 0;
		this.exitHistoryBrowsing();
		this.scrollOffset = 0;
		this.undoStack.clear();
		this.lastAction = null;

		if (this.onChange) this.onChange("");
		if (this.onSubmit) this.onSubmit(result);
	}

// 退格删除（私有）：按原子段（粘贴标记/字素）删除；行首退格合并到上一行；
// 支持撤销合并与 kill 累积
	private handleBackspace(): void {
		this.exitHistoryBrowsing();
		this.lastAction = null;

		if (this.state.cursorCol > 0) {
			this.pushUndoSnapshot();

			// Delete grapheme before cursor (handles emojis, combining characters, etc.)
			let line = this.state.lines[this.state.cursorLine] || "";
			const beforeCursor = line.slice(0, this.state.cursorCol);

			// Find the last grapheme in the text before cursor
			const graphemes = [...this.segment(beforeCursor, "grapheme")];
			const lastGrapheme = graphemes[graphemes.length - 1];
			const graphemeLength = lastGrapheme ? lastGrapheme.segment.length : 1;
			const isPastedSegmented = PASTE_MARKER_SINGLE.exec(lastGrapheme.segment);

			if (isPastedSegmented) {
				// This contains the id part e.g 4 from [paste #4 +123 lines]
				const targetId = Number(isPastedSegmented[1]);
				this.pastes.delete(targetId);
				this.pasteCounter--;

				// Shift registry entries down in ascending id order, independent
				// of marker order in the text ([paste #3] becomes [paste #2] when
				// [paste #1] is removed).
				const higherIds = [...this.pastes.keys()].filter((id) => id > targetId).sort((a, b) => a - b);
				for (const id of higherIds) {
					this.pastes.set(id - 1, this.pastes.get(id)!);
					this.pastes.delete(id);
				}

				// Renumber markers with ids greater than the removed one.
				this.state.lines = this.state.lines.map((line) =>
					line.replace(PASTE_MARKER_REGEX, (fullMatch, idGroup, suffixGroup) => {
						const x = Number(idGroup);
						if (x <= targetId) return fullMatch;
						return `[paste #${x - 1}${suffixGroup}]`;
					}),
				);
			}

			line = this.state.lines[this.state.cursorLine] || "";

			const before = line.slice(0, this.state.cursorCol - graphemeLength);
			const after = line.slice(this.state.cursorCol);

			this.state.lines[this.state.cursorLine] = before + after;
			this.setCursorCol(this.state.cursorCol - graphemeLength);
		} else if (this.state.cursorLine > 0) {
			this.pushUndoSnapshot();

			// Merge with previous line
			const currentLine = this.state.lines[this.state.cursorLine] || "";
			const previousLine = this.state.lines[this.state.cursorLine - 1] || "";

			this.state.lines[this.state.cursorLine - 1] = previousLine + currentLine;
			this.state.lines.splice(this.state.cursorLine, 1);

			this.state.cursorLine--;
			this.setCursorCol(previousLine.length);
		}

		if (this.onChange) {
			this.onChange(this.getText());
		}

		// Update or re-trigger autocomplete after backspace
		if (this.autocompleteState) {
			this.updateAutocomplete();
		} else {
			// If autocomplete was cancelled (no matches), re-trigger if we're in a completable context
			const currentLine = this.state.lines[this.state.cursorLine] || "";
			const textBeforeCursor = currentLine.slice(0, this.state.cursorCol);
			// Slash command context
			if (this.isInSlashCommandContext(textBeforeCursor)) {
				this.tryTriggerAutocomplete();
			}
			// Symbol-based completion context like @, #, or provider triggers
			else if (this.autocompleteTriggerPattern.test(textBeforeCursor)) {
				this.tryTriggerAutocomplete();
			}
		}
	}

	/**
	 * Set cursor column and clear preferredVisualCol.
	 * Use this for all non-vertical cursor movements to reset sticky column behavior.
	 */
// 设置光标列（私有）：钳制到行长度
	private setCursorCol(col: number): void {
		this.state.cursorCol = col;
		this.preferredVisualCol = null;
		this.snappedFromCursorCol = null;
	}

	/**
	 * Move cursor to a target visual line, applying sticky column logic.
	 * Shared by moveCursor() and pageScroll().
	 */
// 移动到指定视觉行（私有）：在折行视图中上下移动光标，维持首选视觉列；
// 处理粘贴标记行等边界情况
	private moveToVisualLine(
		visualLines: Array<{ logicalLine: number; startCol: number; length: number }>,
		currentVisualLine: number,
		targetVisualLine: number,
	): void {
		const currentVL = visualLines[currentVisualLine];
		const targetVL = visualLines[targetVisualLine];
		if (!(currentVL && targetVL)) return;

		// When the cursor was snapped to a segment start, resolve the pre-snap
		// position against the VL it belongs to. This gives the correct visual
		// column even after a resize reshuffles VLs.
		let currentVisualCol: number;
		if (this.snappedFromCursorCol !== null) {
			const vlIndex = this.findVisualLineAt(visualLines, currentVL.logicalLine, this.snappedFromCursorCol);
			currentVisualCol = this.snappedFromCursorCol - visualLines[vlIndex].startCol;
		} else {
			currentVisualCol = this.state.cursorCol - currentVL.startCol;
		}

		// For non-last segments, clamp to length-1 to stay within the segment
		const isLastSourceSegment =
			currentVisualLine === visualLines.length - 1 ||
			visualLines[currentVisualLine + 1]?.logicalLine !== currentVL.logicalLine;
		const sourceMaxVisualCol = isLastSourceSegment ? currentVL.length : Math.max(0, currentVL.length - 1);

		const isLastTargetSegment =
			targetVisualLine === visualLines.length - 1 ||
			visualLines[targetVisualLine + 1]?.logicalLine !== targetVL.logicalLine;
		const targetMaxVisualCol = isLastTargetSegment ? targetVL.length : Math.max(0, targetVL.length - 1);

		const moveToVisualCol = this.computeVerticalMoveColumn(currentVisualCol, sourceMaxVisualCol, targetMaxVisualCol);

		// Set cursor position
		this.state.cursorLine = targetVL.logicalLine;
		const targetCol = targetVL.startCol + moveToVisualCol;
		const logicalLine = this.state.lines[targetVL.logicalLine] || "";
		this.state.cursorCol = Math.min(targetCol, logicalLine.length);

		// Snap cursor to atomic segment boundary (e.g. paste markers)
		// so the cursor never lands in the middle of a multi-grapheme unit.
		// Single-grapheme segments don't need snapping.
		const segments = [...this.segment(logicalLine, "grapheme")];
		for (const seg of segments) {
			if (seg.index > this.state.cursorCol) break;
			if (seg.segment.length <= 1) continue;
			if (this.state.cursorCol < seg.index + seg.segment.length) {
				const isContinuation = seg.index < targetVL.startCol;
				const isMovingDown = targetVisualLine > currentVisualLine;

				if (isContinuation && isMovingDown) {
					// The segment started on a previous visual line, and we
					// already visited it on the way down. Skip all remaining
					// continuation VLs and land on the first VL past it.
					const segEnd = seg.index + seg.segment.length;
					let next = targetVisualLine + 1;
					while (
						next < visualLines.length &&
						visualLines[next].logicalLine === targetVL.logicalLine &&
						visualLines[next].startCol < segEnd
					) {
						next++;
					}
					if (next < visualLines.length) {
						this.moveToVisualLine(visualLines, currentVisualLine, next);
						return;
					}
				}

				// Snap to the start of the segment so it gets highlighted.
				// Store the pre-snap position so the next vertical move can
				// resolve it to the correct visual column.
				this.snappedFromCursorCol = this.state.cursorCol;
				this.state.cursorCol = seg.index;
				return;
			}
		}

		// No snap occurred – we moved out of the atomic segment.
		this.snappedFromCursorCol = null;
	}

	/**
	 * Compute the target visual column for vertical cursor movement.
	 * Implements the sticky column decision table:
	 *
	 * | P | S | T | U | Scenario                                             | Set Preferred | Move To     |
	 * |---|---|---|---| ---------------------------------------------------- |---------------|-------------|
	 * | 0 | * | 0 | - | Start nav, target fits                               | null          | current     |
	 * | 0 | * | 1 | - | Start nav, target shorter                            | current       | target end  |
	 * | 1 | 0 | 0 | 0 | Clamped, target fits preferred                       | null          | preferred   |
	 * | 1 | 0 | 0 | 1 | Clamped, target longer but still can't fit preferred | keep          | target end  |
	 * | 1 | 0 | 1 | - | Clamped, target even shorter                         | keep          | target end  |
	 * | 1 | 1 | 0 | - | Rewrapped, target fits current                       | null          | current     |
	 * | 1 | 1 | 1 | - | Rewrapped, target shorter than current               | current       | target end  |
	 *
	 * Where:
	 * - P = preferred col is set
	 * - S = cursor in middle of source line (not clamped to end)
	 * - T = target line shorter than current visual col
	 * - U = target line shorter than preferred col
	 */
// 计算垂直移动的目标列（私有）：从首选视觉列换算字符列，含尾行/宽字符钳制
	private computeVerticalMoveColumn(
		currentVisualCol: number,
		sourceMaxVisualCol: number,
		targetMaxVisualCol: number,
	): number {
		const hasPreferred = this.preferredVisualCol !== null; // P
		const cursorInMiddle = currentVisualCol < sourceMaxVisualCol; // S
		const targetTooShort = targetMaxVisualCol < currentVisualCol; // T

		if (!hasPreferred || cursorInMiddle) {
			if (targetTooShort) {
				// Cases 2 and 7
				this.preferredVisualCol = currentVisualCol;
				return targetMaxVisualCol;
			}

			// Cases 1 and 6
			this.preferredVisualCol = null;
			return currentVisualCol;
		}

		const targetCantFitPreferred = targetMaxVisualCol < this.preferredVisualCol!; // U
		if (targetTooShort || targetCantFitPreferred) {
			// Cases 4 and 5
			return targetMaxVisualCol;
		}

		// Case 3
		const result = this.preferredVisualCol!;
		this.preferredVisualCol = null;
		return result;
	}

// 光标移到逻辑行首（私有）
	private moveToLineStart(): void {
		this.lastAction = null;
		this.setCursorCol(0);
	}

// 光标移到逻辑行尾（私有）
	private moveToLineEnd(): void {
		this.lastAction = null;
		const currentLine = this.state.lines[this.state.cursorLine] || "";
		this.setCursorCol(currentLine.length);
	}

// 删除到行首（私有）：删入 kill-ring（向前拼接，可累积）
	private deleteToStartOfLine(): void {
		this.exitHistoryBrowsing();

		const currentLine = this.state.lines[this.state.cursorLine] || "";

		if (this.state.cursorCol > 0) {
			this.pushUndoSnapshot();

			// Calculate text to be deleted and save to kill ring (backward deletion = prepend)
			const deletedText = currentLine.slice(0, this.state.cursorCol);
			this.killRing.push(deletedText, { prepend: true, accumulate: this.lastAction === "kill" });
			this.lastAction = "kill";

			// Delete from start of line up to cursor
			this.state.lines[this.state.cursorLine] = currentLine.slice(this.state.cursorCol);
			this.setCursorCol(0);
		} else if (this.state.cursorLine > 0) {
			this.pushUndoSnapshot();

			// At start of line - merge with previous line, treating newline as deleted text
			this.killRing.push("\n", { prepend: true, accumulate: this.lastAction === "kill" });
			this.lastAction = "kill";

			const previousLine = this.state.lines[this.state.cursorLine - 1] || "";
			this.state.lines[this.state.cursorLine - 1] = previousLine + currentLine;
			this.state.lines.splice(this.state.cursorLine, 1);
			this.state.cursorLine--;
			this.setCursorCol(previousLine.length);
		}

		if (this.onChange) {
			this.onChange(this.getText());
		}
	}

// 删除到行尾（私有）：删入 kill-ring（向后拼接，可累积）
	private deleteToEndOfLine(): void {
		this.exitHistoryBrowsing();

		const currentLine = this.state.lines[this.state.cursorLine] || "";

		if (this.state.cursorCol < currentLine.length) {
			this.pushUndoSnapshot();

			// Calculate text to be deleted and save to kill ring (forward deletion = append)
			const deletedText = currentLine.slice(this.state.cursorCol);
			this.killRing.push(deletedText, { prepend: false, accumulate: this.lastAction === "kill" });
			this.lastAction = "kill";

			// Delete from cursor to end of line
			this.state.lines[this.state.cursorLine] = currentLine.slice(0, this.state.cursorCol);
		} else if (this.state.cursorLine < this.state.lines.length - 1) {
			this.pushUndoSnapshot();

			// At end of line - merge with next line, treating newline as deleted text
			this.killRing.push("\n", { prepend: false, accumulate: this.lastAction === "kill" });
			this.lastAction = "kill";

			const nextLine = this.state.lines[this.state.cursorLine + 1] || "";
			this.state.lines[this.state.cursorLine] = currentLine + nextLine;
			this.state.lines.splice(this.state.cursorLine + 1, 1);
		}

		if (this.onChange) {
			this.onChange(this.getText());
		}
	}

// 向前删一个词（私有）：连续 kill 合并，删入 kill-ring
	private deleteWordBackwards(): void {
		this.exitHistoryBrowsing();

		const currentLine = this.state.lines[this.state.cursorLine] || "";

		// If at start of line, behave like backspace at column 0 (merge with previous line)
		if (this.state.cursorCol === 0) {
			if (this.state.cursorLine > 0) {
				this.pushUndoSnapshot();

				// Treat newline as deleted text (backward deletion = prepend)
				this.killRing.push("\n", { prepend: true, accumulate: this.lastAction === "kill" });
				this.lastAction = "kill";

				const previousLine = this.state.lines[this.state.cursorLine - 1] || "";
				this.state.lines[this.state.cursorLine - 1] = previousLine + currentLine;
				this.state.lines.splice(this.state.cursorLine, 1);
				this.state.cursorLine--;
				this.setCursorCol(previousLine.length);
			}
		} else {
			this.pushUndoSnapshot();

			// Save lastAction before cursor movement (moveWordBackwards resets it)
			const wasKill = this.lastAction === "kill";

			const oldCursorCol = this.state.cursorCol;
			this.moveWordBackwards();
			const deleteFrom = this.state.cursorCol;
			this.setCursorCol(oldCursorCol);

			const deletedText = currentLine.slice(deleteFrom, this.state.cursorCol);
			this.killRing.push(deletedText, { prepend: true, accumulate: wasKill });
			this.lastAction = "kill";

			this.state.lines[this.state.cursorLine] =
				currentLine.slice(0, deleteFrom) + currentLine.slice(this.state.cursorCol);
			this.setCursorCol(deleteFrom);
		}

		if (this.onChange) {
			this.onChange(this.getText());
		}
	}

// 向后删一个词（私有）：连续 kill 合并，删入 kill-ring
	private deleteWordForward(): void {
		this.exitHistoryBrowsing();

		const currentLine = this.state.lines[this.state.cursorLine] || "";

		// If at end of line, merge with next line (delete the newline)
		if (this.state.cursorCol >= currentLine.length) {
			if (this.state.cursorLine < this.state.lines.length - 1) {
				this.pushUndoSnapshot();

				// Treat newline as deleted text (forward deletion = append)
				this.killRing.push("\n", { prepend: false, accumulate: this.lastAction === "kill" });
				this.lastAction = "kill";

				const nextLine = this.state.lines[this.state.cursorLine + 1] || "";
				this.state.lines[this.state.cursorLine] = currentLine + nextLine;
				this.state.lines.splice(this.state.cursorLine + 1, 1);
			}
		} else {
			this.pushUndoSnapshot();

			// Save lastAction before cursor movement (moveWordForwards resets it)
			const wasKill = this.lastAction === "kill";

			const oldCursorCol = this.state.cursorCol;
			this.moveWordForwards();
			const deleteTo = this.state.cursorCol;
			this.setCursorCol(oldCursorCol);

			const deletedText = currentLine.slice(this.state.cursorCol, deleteTo);
			this.killRing.push(deletedText, { prepend: false, accumulate: wasKill });
			this.lastAction = "kill";

			this.state.lines[this.state.cursorLine] =
				currentLine.slice(0, this.state.cursorCol) + currentLine.slice(deleteTo);
		}

		if (this.onChange) {
			this.onChange(this.getText());
		}
	}

// 前向删除（私有）：按原子段删除光标处内容
	private handleForwardDelete(): void {
		this.exitHistoryBrowsing();
		this.lastAction = null;

		const currentLine = this.state.lines[this.state.cursorLine] || "";

		if (this.state.cursorCol < currentLine.length) {
			this.pushUndoSnapshot();

			// Delete grapheme at cursor position (handles emojis, combining characters, etc.)
			const afterCursor = currentLine.slice(this.state.cursorCol);

			// Find the first grapheme at cursor
			const graphemes = [...this.segment(afterCursor, "grapheme")];
			const firstGrapheme = graphemes[0];
			const graphemeLength = firstGrapheme ? firstGrapheme.segment.length : 1;

			const before = currentLine.slice(0, this.state.cursorCol);
			const after = currentLine.slice(this.state.cursorCol + graphemeLength);
			this.state.lines[this.state.cursorLine] = before + after;
		} else if (this.state.cursorLine < this.state.lines.length - 1) {
			this.pushUndoSnapshot();

			// At end of line - merge with next line
			const nextLine = this.state.lines[this.state.cursorLine + 1] || "";
			this.state.lines[this.state.cursorLine] = currentLine + nextLine;
			this.state.lines.splice(this.state.cursorLine + 1, 1);
		}

		if (this.onChange) {
			this.onChange(this.getText());
		}

		// Update or re-trigger autocomplete after forward delete
		if (this.autocompleteState) {
			this.updateAutocomplete();
		} else {
			const currentLine = this.state.lines[this.state.cursorLine] || "";
			const textBeforeCursor = currentLine.slice(0, this.state.cursorCol);
			// Slash command context
			if (this.isInSlashCommandContext(textBeforeCursor)) {
				this.tryTriggerAutocomplete();
			}
			// Symbol-based completion context like @, #, or provider triggers
			else if (this.autocompleteTriggerPattern.test(textBeforeCursor)) {
				this.tryTriggerAutocomplete();
			}
		}
	}

	/**
	 * Build a mapping from visual lines to logical positions.
	 * Returns an array where each element represents a visual line with:
	 * - logicalLine: index into this.state.lines
	 * - startCol: starting column in the logical line
	 * - length: length of this visual line segment
	 */
// 构建视觉行映射（私有）：记录每个视觉行对应的逻辑行与起始列，供坐标换算
	private buildVisualLineMap(width: number): Array<{ logicalLine: number; startCol: number; length: number }> {
		const visualLines: Array<{ logicalLine: number; startCol: number; length: number }> = [];

		for (let i = 0; i < this.state.lines.length; i++) {
			const line = this.state.lines[i] || "";
			const lineVisWidth = visibleWidth(line);
			if (line.length === 0) {
				// Empty line still takes one visual line
				visualLines.push({ logicalLine: i, startCol: 0, length: 0 });
			} else if (lineVisWidth <= width) {
				visualLines.push({ logicalLine: i, startCol: 0, length: line.length });
			} else {
				// Line needs wrapping - use word-aware wrapping
				const chunks = wordWrapLine(line, width, [...this.segment(line, "grapheme")]);
				for (const chunk of chunks) {
					visualLines.push({
						logicalLine: i,
						startCol: chunk.startIndex,
						length: chunk.endIndex - chunk.startIndex,
					});
				}
			}
		}

		return visualLines;
	}

	/**
	 * Find the visual line index that contains the given logical position.
	 */
// 按行列定位视觉行（私有）：给定逻辑行与字符列，找到所在视觉行
	private findVisualLineAt(
		visualLines: Array<{ logicalLine: number; startCol: number; length: number }>,
		line: number,
		col: number,
	): number {
		for (let i = 0; i < visualLines.length; i++) {
			const vl = visualLines[i];
			if (!vl || vl.logicalLine !== line) continue;
			const offset = col - vl.startCol;
			// Cursor is in this segment if it's within range. For the last
			// segment of a logical line, cursor can be at length (end position)
			const isLastSegmentOfLine = i === visualLines.length - 1 || visualLines[i + 1]?.logicalLine !== vl.logicalLine;
			if (offset >= 0 && (offset < vl.length || (isLastSegmentOfLine && offset === vl.length))) {
				return i;
			}
		}
		return visualLines.length - 1;
	}

	/**
	 * Find the visual line index for the current cursor position.
	 */
// 定位光标当前所在的视觉行（私有）
	private findCurrentVisualLine(
		visualLines: Array<{ logicalLine: number; startCol: number; length: number }>,
	): number {
		return this.findVisualLineAt(visualLines, this.state.cursorLine, this.state.cursorCol);
	}

// 移动光标（私有）：行/列增量移动，处理行尾自动换行与滚动跟随
	private moveCursor(deltaLine: number, deltaCol: number): void {
		this.lastAction = null;
		const visualLines = this.buildVisualLineMap(this.lastWidth);
		const currentVisualLine = this.findCurrentVisualLine(visualLines);

		if (deltaLine !== 0) {
			const targetVisualLine = currentVisualLine + deltaLine;

			if (targetVisualLine >= 0 && targetVisualLine < visualLines.length) {
				this.moveToVisualLine(visualLines, currentVisualLine, targetVisualLine);
			}
		}

		if (deltaCol !== 0) {
			const currentLine = this.state.lines[this.state.cursorLine] || "";

			if (deltaCol > 0) {
				// Moving right - move by one grapheme (handles emojis, combining characters, etc.)
				if (this.state.cursorCol < currentLine.length) {
					const afterCursor = currentLine.slice(this.state.cursorCol);
					const graphemes = [...this.segment(afterCursor, "grapheme")];
					const firstGrapheme = graphemes[0];
					this.setCursorCol(this.state.cursorCol + (firstGrapheme ? firstGrapheme.segment.length : 1));
				} else if (this.state.cursorLine < this.state.lines.length - 1) {
					// Wrap to start of next logical line
					this.state.cursorLine++;
					this.setCursorCol(0);
				} else {
					// At end of last line - can't move, but set preferredVisualCol for up/down navigation
					const currentVL = visualLines[currentVisualLine];
					if (currentVL) {
						this.preferredVisualCol = this.state.cursorCol - currentVL.startCol;
					}
				}
			} else {
				// Moving left - move by one grapheme (handles emojis, combining characters, etc.)
				if (this.state.cursorCol > 0) {
					const beforeCursor = currentLine.slice(0, this.state.cursorCol);
					const graphemes = [...this.segment(beforeCursor, "grapheme")];
					const lastGrapheme = graphemes[graphemes.length - 1];
					this.setCursorCol(this.state.cursorCol - (lastGrapheme ? lastGrapheme.segment.length : 1));
				} else if (this.state.cursorLine > 0) {
					// Wrap to end of previous logical line
					this.state.cursorLine--;
					const prevLine = this.state.lines[this.state.cursorLine] || "";
					this.setCursorCol(prevLine.length);
				}
			}
		}

		// Keep an open autocomplete picker in sync with the new cursor
		// position: cursor movement changes the text before the cursor, so a
		// picker computed for the old position is stale. Re-query so it
		// refreshes — or closes when the new position yields no suggestions —
		// mirroring insertCharacter()/handleBackspace(). Without this, arrowing
		// left from `/cmd ` back into the command name leaves the argument
		// picker showing against a `/cmd` prefix (and a Tab there would
		// concatenate the stale suggestion onto the partial command name).
		if (this.autocompleteState) {
			this.updateAutocomplete();
		}
	}

	/**
	 * Scroll by a page (direction: -1 for up, 1 for down).
	 * Moves cursor by the page size while keeping it in bounds.
	 */
// 翻页滚动（私有）：上/下滚一页并相应移动光标
	private pageScroll(direction: -1 | 1): void {
		this.lastAction = null;
		const terminalRows = this.tui.terminal.rows;
		const pageSize = Math.max(5, Math.floor(terminalRows * 0.3));

		const visualLines = this.buildVisualLineMap(this.lastWidth);
		const currentVisualLine = this.findCurrentVisualLine(visualLines);
		const targetVisualLine = Math.max(0, Math.min(visualLines.length - 1, currentVisualLine + direction * pageSize));

		this.moveToVisualLine(visualLines, currentVisualLine, targetVisualLine);
	}

// 光标按词左移（私有）
	private moveWordBackwards(): void {
		this.lastAction = null;
		const currentLine = this.state.lines[this.state.cursorLine] || "";

		// If at start of line, move to end of previous line
		if (this.state.cursorCol === 0) {
			if (this.state.cursorLine > 0) {
				this.state.cursorLine--;
				const prevLine = this.state.lines[this.state.cursorLine] || "";
				this.setCursorCol(prevLine.length);
			}
			return;
		}

		this.setCursorCol(
			findWordBackward(currentLine, this.state.cursorCol, {
				segment: (text) => this.segment(text, "word"),
				isAtomicSegment: isPasteMarker,
			}),
		);
	}

	/**
	 * Yank (paste) the most recent kill ring entry at cursor position.
	 */
// yank 粘贴（私有）：把 kill-ring 最新条目插入光标处
	private yank(): void {
		if (this.killRing.length === 0) return;

		this.pushUndoSnapshot();

		const text = this.killRing.peek()!;
		this.insertYankedText(text);

		this.lastAction = "yank";
	}

	/**
	 * Cycle through kill ring (only works immediately after yank or yank-pop).
	 * Replaces the last yanked text with the previous entry in the ring.
	 */
// yank-pop 轮换（私有）：仅上一步为 yank 时有效——删掉刚贴内容后换贴更早条目
	private yankPop(): void {
		// Only works if we just yanked and have more than one entry
		if (this.lastAction !== "yank" || this.killRing.length <= 1) return;

		this.pushUndoSnapshot();

		// Delete the previously yanked text (still at end of ring before rotation)
		this.deleteYankedText();

		// Rotate the ring: move end to front
		this.killRing.rotate();

		// Insert the new most recent entry (now at end after rotation)
		const text = this.killRing.peek()!;
		this.insertYankedText(text);

		this.lastAction = "yank";
	}

	/**
	 * Insert text at cursor position (used by yank operations).
	 */
// 插入 yank 文本（私有）：含历史/粘贴标记场景的规范化处理
	private insertYankedText(text: string): void {
		this.exitHistoryBrowsing();
		const lines = text.split("\n");

		if (lines.length === 1) {
			// Single line - insert at cursor
			const currentLine = this.state.lines[this.state.cursorLine] || "";
			const before = currentLine.slice(0, this.state.cursorCol);
			const after = currentLine.slice(this.state.cursorCol);
			this.state.lines[this.state.cursorLine] = before + text + after;
			this.setCursorCol(this.state.cursorCol + text.length);
		} else {
			// Multi-line insert
			const currentLine = this.state.lines[this.state.cursorLine] || "";
			const before = currentLine.slice(0, this.state.cursorCol);
			const after = currentLine.slice(this.state.cursorCol);

			// First line merges with text before cursor
			this.state.lines[this.state.cursorLine] = before + (lines[0] || "");

			// Insert middle lines
			for (let i = 1; i < lines.length - 1; i++) {
				this.state.lines.splice(this.state.cursorLine + i, 0, lines[i] || "");
			}

			// Last line merges with text after cursor
			const lastLineIndex = this.state.cursorLine + lines.length - 1;
			this.state.lines.splice(lastLineIndex, 0, (lines[lines.length - 1] || "") + after);

			// Update cursor position
			this.state.cursorLine = lastLineIndex;
			this.setCursorCol((lines[lines.length - 1] || "").length);
		}

		if (this.onChange) {
			this.onChange(this.getText());
		}
	}

	/**
	 * Delete the previously yanked text (used by yank-pop).
	 * The yanked text is derived from killRing[end] since it hasn't been rotated yet.
	 */
// 删除刚 yank 的文本（私有）：yank-pop 轮换前撤销上一次插入
	private deleteYankedText(): void {
		const yankedText = this.killRing.peek();
		if (!yankedText) return;

		const yankLines = yankedText.split("\n");

		if (yankLines.length === 1) {
			// Single line - delete backward from cursor
			const currentLine = this.state.lines[this.state.cursorLine] || "";
			const deleteLen = yankedText.length;
			const before = currentLine.slice(0, this.state.cursorCol - deleteLen);
			const after = currentLine.slice(this.state.cursorCol);
			this.state.lines[this.state.cursorLine] = before + after;
			this.setCursorCol(this.state.cursorCol - deleteLen);
		} else {
			// Multi-line delete - cursor is at end of last yanked line
			const startLine = this.state.cursorLine - (yankLines.length - 1);
			const startCol = (this.state.lines[startLine] || "").length - (yankLines[0] || "").length;

			// Get text after cursor on current line
			const afterCursor = (this.state.lines[this.state.cursorLine] || "").slice(this.state.cursorCol);

			// Get text before yank start position
			const beforeYank = (this.state.lines[startLine] || "").slice(0, startCol);

			// Remove all lines from startLine to cursorLine and replace with merged line
			this.state.lines.splice(startLine, yankLines.length, beforeYank + afterCursor);

			// Update cursor
			this.state.cursorLine = startLine;
			this.setCursorCol(startCol);
		}

		if (this.onChange) {
			this.onChange(this.getText());
		}
	}

// 压入撤销快照（私有）：连同粘贴注册表一并保存
	private pushUndoSnapshot(): void {
		this.undoStack.push({ state: this.state, pastes: this.pastes, pasteCounter: this.pasteCounter });
	}

// 撤销（私有）：恢复最近快照（含粘贴注册表）
	private undo(): void {
		this.exitHistoryBrowsing();
		const snapshot = this.undoStack.pop();
		if (!snapshot) return;
		Object.assign(this.state, snapshot.state);
		this.pastes = snapshot.pastes;
		this.pasteCounter = snapshot.pasteCounter;
		this.lastAction = null;
		this.preferredVisualCol = null;
		if (this.onChange) {
			this.onChange(this.getText());
		}
	}

	/**
	 * Jump to the first occurrence of a character in the specified direction.
	 * Multi-line search. Case-sensitive. Skips the current cursor position.
	 */
// 跳转模式（私有）：jump 键后输入字符，光标跳到该字符前/后
	private jumpToChar(char: string, direction: "forward" | "backward"): void {
		this.lastAction = null;
		const isForward = direction === "forward";
		const lines = this.state.lines;

		const end = isForward ? lines.length : -1;
		const step = isForward ? 1 : -1;

		for (let lineIdx = this.state.cursorLine; lineIdx !== end; lineIdx += step) {
			const line = lines[lineIdx] || "";
			const isCurrentLine = lineIdx === this.state.cursorLine;

			// Current line: start after/before cursor; other lines: search full line
			const searchFrom = isCurrentLine
				? isForward
					? this.state.cursorCol + 1
					: this.state.cursorCol - 1
				: undefined;

			const idx = isForward ? line.indexOf(char, searchFrom) : line.lastIndexOf(char, searchFrom);

			if (idx !== -1) {
				this.state.cursorLine = lineIdx;
				this.setCursorCol(idx);
				return;
			}
		}
		// No match found - cursor stays in place
	}

// 光标按词右移（私有）
	private moveWordForwards(): void {
		this.lastAction = null;
		const currentLine = this.state.lines[this.state.cursorLine] || "";

		// If at end of line, move to start of next line
		if (this.state.cursorCol >= currentLine.length) {
			if (this.state.cursorLine < this.state.lines.length - 1) {
				this.state.cursorLine++;
				this.setCursorCol(0);
			}
			return;
		}

		this.setCursorCol(
			findWordForward(currentLine, this.state.cursorCol, {
				segment: (text) => this.segment(text, "word"),
				isAtomicSegment: isPasteMarker,
			}),
		);
	}

	// Slash menu only allowed on the first line of the editor
// 是否允许显示斜杠命令菜单（私有）：光标在首行首个词元且文本以 "/" 开头
	private isSlashMenuAllowed(): boolean {
		return this.state.cursorLine === 0;
	}

	// Helper method to check if cursor is at start of message (for slash command detection)
// 光标是否在消息起始位置（私有）
	private isAtStartOfMessage(): boolean {
		if (!this.isSlashMenuAllowed()) return false;
		const currentLine = this.state.lines[this.state.cursorLine] || "";
		const beforeCursor = currentLine.slice(0, this.state.cursorCol);
		return beforeCursor.trim() === "" || beforeCursor.trim() === "/";
	}

// 光标是否处于斜杠命令上下文（私有）
	private isInSlashCommandContext(textBeforeCursor: string): boolean {
		return this.isSlashMenuAllowed() && textBeforeCursor.trimStart().startsWith("/");
	}

	// Autocomplete methods
	/**
	 * Find the best autocomplete item index for the given prefix.
	 * Returns -1 if no match is found.
	 *
	 * Match priority:
	 * 1. Exact match (prefix === item.value) -> always selected
	 * 2. Prefix match -> first item whose value starts with prefix
	 * 3. No match -> -1 (keep default highlight)
	 *
	 * Matching is case-sensitive and checks item.value only.
	 */
// 在补全候选中找最佳匹配下标（私有）：精确值/前缀/包含逐级匹配
	private getBestAutocompleteMatchIndex(items: Array<{ value: string; label: string }>, prefix: string): number {
		if (!prefix) return -1;

		let firstPrefixIndex = -1;

		for (let i = 0; i < items.length; i++) {
			const value = items[i]!.value;
			if (value === prefix) {
				return i; // Exact match always wins
			}
			if (firstPrefixIndex === -1 && value.startsWith(prefix)) {
				firstPrefixIndex = i;
			}
		}

		return firstPrefixIndex;
	}

// 创建补全选择列表（私有）：渲染到覆盖层并绑定选择/取消回调
	private createAutocompleteList(
		prefix: string,
		items: Array<{ value: string; label: string; description?: string }>,
	): SelectList {
		const layout = prefix.startsWith("/") ? SLASH_COMMAND_SELECT_LIST_LAYOUT : undefined;
		return new SelectList(items, this.autocompleteMaxVisible, this.theme.selectList, layout);
	}

// 尝试触发补全（私有）：Tab 显式触发或输入触发字符时请求
	private tryTriggerAutocomplete(explicitTab: boolean = false): void {
		this.requestAutocomplete({ force: false, explicitTab });
	}

// 处理 Tab（私有）：有激活补全则确认选择；否则触发显式补全
	private handleTabCompletion(): void {
		if (!this.autocompleteProvider) return;

		const currentLine = this.state.lines[this.state.cursorLine] || "";
		const beforeCursor = currentLine.slice(0, this.state.cursorCol);

		if (this.isInSlashCommandContext(beforeCursor) && !beforeCursor.trimStart().includes(" ")) {
			this.handleSlashCommandCompletion();
		} else {
			this.forceFileAutocomplete(true);
		}
	}

// 处理斜杠命令补全（私有）：在命令上下文时触发命令列表补全
	private handleSlashCommandCompletion(): void {
		this.requestAutocomplete({ force: false, explicitTab: true });
	}

// 强制文件补全（私有）：@ 附件或显式 Tab 场景
	private forceFileAutocomplete(explicitTab: boolean = false): void {
		this.requestAutocomplete({ force: true, explicitTab });
	}

// 请求补全（私有）：计算防抖后启动异步请求
	private requestAutocomplete(options: { force: boolean; explicitTab: boolean }): void {
		if (!this.autocompleteProvider) return;

		if (options.force) {
			const shouldTrigger =
				!this.autocompleteProvider.shouldTriggerFileCompletion ||
				this.autocompleteProvider.shouldTriggerFileCompletion(
					this.state.lines,
					this.state.cursorLine,
					this.state.cursorCol,
				);
			if (!shouldTrigger) {
				return;
			}
		}

		this.cancelAutocompleteRequest();
		const startToken = ++this.autocompleteStartToken;

		const debounceMs = this.getAutocompleteDebounceMs(options);
		if (debounceMs > 0) {
			this.autocompleteDebounceTimer = setTimeout(() => {
				this.autocompleteDebounceTimer = undefined;
				void this.startAutocompleteRequest(startToken, options);
			}, debounceMs);
			return;
		}

		void this.startAutocompleteRequest(startToken, options);
	}

	private async startAutocompleteRequest(
		startToken: number,
		options: { force: boolean; explicitTab: boolean },
	): Promise<void> {
		const previousTask = this.autocompleteRequestTask;
		this.autocompleteRequestTask = (async () => {
			await previousTask;
			if (startToken !== this.autocompleteStartToken || !this.autocompleteProvider) {
				return;
			}

			const controller = new AbortController();
			this.autocompleteAbort = controller;
			const requestId = ++this.autocompleteRequestId;
			const snapshotText = this.getText();
			const snapshotLine = this.state.cursorLine;
			const snapshotCol = this.state.cursorCol;

			await this.runAutocompleteRequest(requestId, controller, snapshotText, snapshotLine, snapshotCol, options);
		})();
		await this.autocompleteRequestTask;
	}

// 设置补全触发字符（私有）：重建触发/防抖正则
	private setAutocompleteTriggerCharacters(triggerCharacters: string[]): void {
		const next = [...DEFAULT_AUTOCOMPLETE_TRIGGER_CHARACTERS];
		for (const character of triggerCharacters) {
			if (character.length !== 1 || character === "/" || isWhitespaceChar(character) || next.includes(character)) {
				continue;
			}
			next.push(character);
		}
		this.autocompleteTriggerCharacters = next;
		this.autocompleteTriggerPattern = buildTriggerPattern(next);
		this.autocompleteDebouncePattern = buildDebouncePattern(next);
	}

// 计算补全防抖时长（私有）：显式触发即时，@ 附件短防抖，其余长防抖
	private getAutocompleteDebounceMs(options: { force: boolean; explicitTab: boolean }): number {
		if (options.explicitTab || options.force) {
			return 0;
		}

		const currentLine = this.state.lines[this.state.cursorLine] || "";
		const textBeforeCursor = currentLine.slice(0, this.state.cursorCol);
		return this.autocompleteDebouncePattern.test(textBeforeCursor) ? ATTACHMENT_AUTOCOMPLETE_DEBOUNCE_MS : 0;
	}

// 执行补全请求（私有核心）：向提供器取建议，检查序号有效性后应用或清理 UI
	private async runAutocompleteRequest(
		requestId: number,
		controller: AbortController,
		snapshotText: string,
		snapshotLine: number,
		snapshotCol: number,
		options: { force: boolean; explicitTab: boolean },
	): Promise<void> {
		if (!this.autocompleteProvider) return;

		const suggestions = await this.autocompleteProvider.getSuggestions(
			this.state.lines,
			this.state.cursorLine,
			this.state.cursorCol,
			{ signal: controller.signal, force: options.force },
		);

		if (!this.isAutocompleteRequestCurrent(requestId, controller, snapshotText, snapshotLine, snapshotCol)) {
			return;
		}

		this.autocompleteAbort = undefined;

		if (!suggestions || !Array.isArray(suggestions.items) || suggestions.items.length === 0) {
			this.cancelAutocomplete();
			this.tui.requestRender();
			return;
		}

		if (options.force && options.explicitTab && suggestions.items.length === 1) {
			const item = suggestions.items[0]!;
			this.pushUndoSnapshot();
			this.lastAction = null;
			const result = this.autocompleteProvider.applyCompletion(
				this.state.lines,
				this.state.cursorLine,
				this.state.cursorCol,
				item,
				suggestions.prefix,
			);
			this.state.lines = result.lines;
			this.state.cursorLine = result.cursorLine;
			this.setCursorCol(result.cursorCol);
			if (this.onChange) this.onChange(this.getText());
			this.tui.requestRender();
			return;
		}

		this.applyAutocompleteSuggestions(suggestions, options.force ? "force" : "regular");
		this.tui.requestRender();
	}

// 补全请求是否仍有效（私有）：按序号对比丢弃过期响应
	private isAutocompleteRequestCurrent(
		requestId: number,
		controller: AbortController,
		snapshotText: string,
		snapshotLine: number,
		snapshotCol: number,
	): boolean {
		return (
			!controller.signal.aborted &&
			requestId === this.autocompleteRequestId &&
			this.getText() === snapshotText &&
			this.state.cursorLine === snapshotLine &&
			this.state.cursorCol === snapshotCol
		);
	}

// 应用补全建议（私有）：更新前缀与候选，重新创建/更新选择列表
	private applyAutocompleteSuggestions(suggestions: AutocompleteSuggestions, state: "regular" | "force"): void {
		this.autocompletePrefix = suggestions.prefix;
		this.autocompleteList = this.createAutocompleteList(suggestions.prefix, suggestions.items);

		const bestMatchIndex = this.getBestAutocompleteMatchIndex(suggestions.items, suggestions.prefix);
		if (bestMatchIndex >= 0) {
			this.autocompleteList.setSelectedIndex(bestMatchIndex);
		}

		this.autocompleteState = state;
	}

// 取消进行中的补全请求（私有）：中止控制器 + 清防抖定时器 + 序号自增
	private cancelAutocompleteRequest(): void {
		this.autocompleteStartToken += 1;
		if (this.autocompleteDebounceTimer) {
			clearTimeout(this.autocompleteDebounceTimer);
			this.autocompleteDebounceTimer = undefined;
		}
		this.autocompleteAbort?.abort();
		this.autocompleteAbort = undefined;
	}

// 清空补全 UI（私有）：隐藏覆盖层并复位相关状态
	private clearAutocompleteUi(): void {
		this.autocompleteState = null;
		this.autocompleteList = undefined;
		this.autocompletePrefix = "";
	}

// 完全取消补全（私有）：清请求与 UI
	private cancelAutocomplete(): void {
		this.cancelAutocompleteRequest();
		this.clearAutocompleteUi();
	}

// 是否正在显示补全列表（公开）
	// 是否正在显示补全列表（公开）：供父组件感知补全状态
	public isShowingAutocomplete(): boolean {
		return this.autocompleteState !== null;
	}

// 更新补全（私有）：根据当前文本/光标重新评估是否需要继续显示补全
	// 更新补全状态（私有）：依据当前文本与光标位置决定继续/取消补全
	private updateAutocomplete(): void {
		if (!this.autocompleteState || !this.autocompleteProvider) return;
		this.requestAutocomplete({ force: this.autocompleteState === "force", explicitTab: false });
	}
}
