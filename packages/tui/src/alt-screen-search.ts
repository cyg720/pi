/**
 * 【文件职责】实现 `@earendil-works/pi-tui` 包中的 `alt-screen-search` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `./components/input.ts`、`./tui.ts`、`./utils.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为文本应用提供基于差分渲染的终端界面能力；本文件负责其中与 `alt-screen-search` 对应的子能力。
 * 【逻辑维度】对外入口包括 `AltScreenSearchSegment`、`AltScreenSearchMatch`、`findAltScreenSearchMatches`、`getAltScreenSearchMatchKey`、`AltScreenSearchComponent`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `AltScreenSearchSegment`、`AltScreenSearchMatch`、`findAltScreenSearchMatches`、`getAltScreenSearchMatchKey`、`AltScreenSearchComponent` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import { Input } from "./components/input.ts";
import type { Component, Focusable } from "./tui.ts";
import { getGraphemeSegmenter, stripTerminalSequences, truncateToWidth, visibleWidth } from "./utils.ts";

const segmenter = getGraphemeSegmenter();

interface SearchSourceSpan {
	row: number;
	startCol: number;
	endCol: number;
}

export interface AltScreenSearchSegment {
	row: number;
	startCol: number;
	endCol: number;
}

export interface AltScreenSearchMatch {
	segments: AltScreenSearchSegment[];
}

function appendMappedText(
	text: string,
	span: SearchSourceSpan | undefined,
	corpus: { text: string; source: Array<SearchSourceSpan | undefined> },
): void {
	corpus.text += text;
	for (let index = 0; index < text.length; index++) corpus.source.push(span);
}

function buildSearchCorpus(lines: readonly string[]): {
	text: string;
	source: Array<SearchSourceSpan | undefined>;
} {
	const corpus: { text: string; source: Array<SearchSourceSpan | undefined> } = { text: "", source: [] };
	let pendingSeparator = false;

	for (let row = 0; row < lines.length; row++) {
		const line = stripTerminalSequences(lines[row] ?? "");
		let column = 0;
		for (const grapheme of segmenter.segment(line)) {
			const text = grapheme.segment;
			const width = visibleWidth(text);
			if (/^\s+$/u.test(text)) {
				if (corpus.text.length > 0) pendingSeparator = true;
				column += width;
				continue;
			}
			if (pendingSeparator) {
				appendMappedText(" ", undefined, corpus);
				pendingSeparator = false;
			}
			appendMappedText(text, { row, startCol: column, endCol: column + width }, corpus);
			column += width;
		}
		if (corpus.text.length > 0) pendingSeparator = true;
	}

	return corpus;
}

function normalizeQuery(query: string): string {
	return query.replace(/\s+/gu, " ").trim();
}

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findAltScreenSearchMatches(lines: readonly string[], query: string): AltScreenSearchMatch[] {
	const normalizedQuery = normalizeQuery(query);
	if (!normalizedQuery) return [];

	const corpus = buildSearchCorpus(lines);
	const expression = new RegExp(escapeRegExp(normalizedQuery), "giu");
	const matches: AltScreenSearchMatch[] = [];

	for (const match of corpus.text.matchAll(expression)) {
		const start = match.index;
		const end = start + match[0].length;
		const segments: AltScreenSearchSegment[] = [];
		for (let index = start; index < end; index++) {
			const span = corpus.source[index];
			if (!span) continue;
			const previous = segments[segments.length - 1];
			if (previous && previous.row === span.row && span.startCol <= previous.endCol) {
				previous.endCol = Math.max(previous.endCol, span.endCol);
			} else {
				segments.push({ ...span });
			}
		}
		if (segments.length > 0) matches.push({ segments });
	}

	return matches;
}

export function getAltScreenSearchMatchKey(match: AltScreenSearchMatch): string {
	const first = match.segments[0];
	const last = match.segments[match.segments.length - 1];
	return first && last ? `${first.row}:${first.startCol}:${last.row}:${last.endCol}` : "";
}

export class AltScreenSearchComponent implements Component, Focusable {
	private readonly input = new Input();
	private readonly onQueryChange: (query: string) => void;
	private resultCount = 0;
	private resultIndex = -1;
	private _focused = false;

	constructor(onQueryChange: (query: string) => void) {
		this.onQueryChange = onQueryChange;
	}

	get focused(): boolean {
		return this._focused;
	}

	set focused(value: boolean) {
		this._focused = value;
		this.input.focused = value;
	}

	setResult(index: number, count: number): void {
		this.resultIndex = index;
		this.resultCount = count;
	}

	handleInput(data: string): void {
		const previous = this.input.getValue();
		this.input.handleInput(data);
		const query = this.input.getValue();
		if (query !== previous) this.onQueryChange(query);
	}

	invalidate(): void {
		this.input.invalidate();
	}

	render(width: number): string[] {
		const safeWidth = Math.max(1, width);
		const label = " Find transcript";
		const query = this.input.getValue();
		const status = !query
			? ""
			: this.resultCount === 0
				? "No matches "
				: `${this.resultIndex + 1}/${this.resultCount} `;
		const labelWidth = visibleWidth(label);
		const statusWidth = visibleWidth(status);
		const gap = " ".repeat(Math.max(1, safeWidth - labelWidth - statusWidth));
		const title = truncateToWidth(`${label}${gap}${status}`, safeWidth, "");
		const padding = " ".repeat(Math.max(0, safeWidth - visibleWidth(title)));
		return [`\x1b[7m${title}${padding}\x1b[27m`, ...this.input.render(safeWidth)];
	}
}
