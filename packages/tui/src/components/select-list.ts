/**
 * 【文件职责】实现 SelectList 通用选择列表组件：可滚动的“主列（+可选描述列）”条目选择器，
 *              支持前缀过滤、键盘上下/确认/取消、双列自适应布局与主题化外观。
 * 【技术维度】实现 Component 接口；快捷键表驱动输入；主列宽度按“最宽条目”自适应并钳制在
 *              min/max 边界内；truncatePrimary 钩子允许调用方自定义截断逻辑。
 * 【产品维度】是模型选择、命令面板、会话切换等所有“从列表里选一个”场景的通用底座。
 * 【逻辑维度】setFilter 按前缀过滤并重置选中 → render：无匹配提示 / 居中滚动窗口渲染条目 /
 *              滚动位置指示 → handleInput：上/下循环移动（触发 onSelectionChange）、Enter 触发 onSelect、
 *              Esc/Ctrl+C 触发 onCancel。
 * 【关键边界】描述列仅在总宽 >40 且剩余宽 >10 时显示；过滤是 value 的不区分大小写前缀匹配；
 *              过滤变化会把选中重置为 0；空列表时上下移动会把下标变为 -1，需调用方保证非空或自行处理。
 * 【新手阅读建议】先看 SelectItem 与 SelectListTheme 了解数据与外观模型 → 再读 render/handleInput 主流程 →
 *              最后看 renderItem 双列布局的宽度分配细节。
 */
import { getKeybindings } from "../keybindings.ts";
import type { Component } from "../tui.ts";
import { truncateToWidth, visibleWidth } from "../utils.ts";

// 主列默认宽度（列数）
const DEFAULT_PRIMARY_COLUMN_WIDTH = 32;
// 主列与描述列之间的间隔
const PRIMARY_COLUMN_GAP = 2;
// 描述列的最小可用宽度：低于此值则不显示描述
const MIN_DESCRIPTION_WIDTH = 10;

// 把多行文本归一化为单行（私有）：换行替换为空格并去首尾空白
const normalizeToSingleLine = (text: string): string => text.replace(/[\r\n]+/g, " ").trim();
// 数值钳制工具（私有）
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(value, max));

/** 选择条目（中文说明）：value 为提交给业务的值；label 为展示名（缺省回退用 value）；
 * description 可选说明文字。 */
export interface SelectItem {
	value: string;
	label: string;
	description?: string;
}

/** 列表主题（中文说明）：五个着色函数分别负责选中前缀、选中整行、描述、滚动信息与无匹配提示。 */
export interface SelectListTheme {
	// 选中行的光标前缀着色
	selectedPrefix: (text: string) => string;
	// 选中行整体文本着色
	selectedText: (text: string) => string;
	// 描述文字着色
	description: (text: string) => string;
	// 滚动位置信息着色
	scrollInfo: (text: string) => string;
	// “无匹配”提示着色
	noMatch: (text: string) => string;
}

/** 自定义主列截断的上下文（中文说明）：提供原文、最大宽、列宽、完整条目与选中态供决策。 */
export interface SelectListTruncatePrimaryContext {
	text: string;
	maxWidth: number;
	columnWidth: number;
	item: SelectItem;
	isSelected: boolean;
}

/** 布局选项（中文说明）：可约束主列的最小/最大宽度，并可注入自定义截断函数。 */
export interface SelectListLayoutOptions {
	minPrimaryColumnWidth?: number;
	maxPrimaryColumnWidth?: number;
	truncatePrimary?: (context: SelectListTruncatePrimaryContext) => string;
}

/**
 * SelectList（中文说明）：持有全部条目、过滤结果、选中下标、可视上限、主题与布局配置，
 * 以及三个对外回调（选中/取消/选中变化）。
 */
export class SelectList implements Component {
	// 全部条目
	private items: SelectItem[] = [];
	// 过滤后的条目（渲染与交互的数据源）
	private filteredItems: SelectItem[] = [];
	// 当前选中下标
	private selectedIndex: number = 0;
	// 视口内最大可见条数
	private maxVisible: number = 5;
	// 外观主题
	private theme: SelectListTheme;
	// 布局配置
	private layout: SelectListLayoutOptions;

	// 确认选择回调
	public onSelect?: (item: SelectItem) => void;
	// 取消回调
	public onCancel?: () => void;
	// 选中项变化回调（上下移动时触发）
	public onSelectionChange?: (item: SelectItem) => void;

	// 构造函数：保存依赖并初始化过滤结果
	constructor(items: SelectItem[], maxVisible: number, theme: SelectListTheme, layout: SelectListLayoutOptions = {}) {
		this.items = items;
		this.filteredItems = items;
		this.maxVisible = maxVisible;
		this.theme = theme;
		this.layout = layout;
	}

	// 设置过滤器：按 value 的不区分大小写前缀匹配；过滤变化后选中重置为第一条
	setFilter(filter: string): void {
		this.filteredItems = this.items.filter((item) => item.value.toLowerCase().startsWith(filter.toLowerCase()));
		// Reset selection when filter changes
		this.selectedIndex = 0;
	}

	// 直接设置选中下标（钳制到合法范围）
	setSelectedIndex(index: number): void {
		this.selectedIndex = Math.max(0, Math.min(index, this.filteredItems.length - 1));
	}

	invalidate(): void {
		// No cached state to invalidate currently
		// 当前没有需要失效的缓存状态
	}

	// 渲染：无匹配提示 / 滚动窗口内逐条渲染 / 必要时附加滚动位置指示
	render(width: number): string[] {
		const lines: string[] = [];

		// If no items match filter, show message
		if (this.filteredItems.length === 0) {
			lines.push(this.theme.noMatch("  No matching commands"));
			return lines;
		}

		const primaryColumnWidth = this.getPrimaryColumnWidth();

		// Calculate visible range with scrolling
		// 计算滚动窗口：尽量让选中项居中并钳制在合法范围
		const startIndex = Math.max(
			0,
			Math.min(this.selectedIndex - Math.floor(this.maxVisible / 2), this.filteredItems.length - this.maxVisible),
		);
		const endIndex = Math.min(startIndex + this.maxVisible, this.filteredItems.length);

		// Render visible items
		for (let i = startIndex; i < endIndex; i++) {
			const item = this.filteredItems[i];
			if (!item) continue;

			const isSelected = i === this.selectedIndex;
			const descriptionSingleLine = item.description ? normalizeToSingleLine(item.description) : undefined;
			lines.push(this.renderItem(item, isSelected, width, descriptionSingleLine, primaryColumnWidth));
		}

		// Add scroll indicators if needed
		if (startIndex > 0 || endIndex < this.filteredItems.length) {
			const scrollText = `  (${this.selectedIndex + 1}/${this.filteredItems.length})`;
			// Truncate if too long for terminal
			lines.push(this.theme.scrollInfo(truncateToWidth(scrollText, width - 2, "")));
		}

		return lines;
	}

	// 输入处理：上/下循环移动并通知；Enter 确认；Esc 或 Ctrl+C 取消
	handleInput(keyData: string): void {
		const kb = getKeybindings();
		// Up arrow - wrap to bottom when at top
		if (kb.matches(keyData, "tui.select.up")) {
			this.selectedIndex = this.selectedIndex === 0 ? this.filteredItems.length - 1 : this.selectedIndex - 1;
			this.notifySelectionChange();
		}
		// Down arrow - wrap to top when at bottom
		else if (kb.matches(keyData, "tui.select.down")) {
			this.selectedIndex = this.selectedIndex === this.filteredItems.length - 1 ? 0 : this.selectedIndex + 1;
			this.notifySelectionChange();
		}
		// Enter
		else if (kb.matches(keyData, "tui.select.confirm")) {
			const selectedItem = this.filteredItems[this.selectedIndex];
			if (selectedItem && this.onSelect) {
				this.onSelect(selectedItem);
			}
		}
		// Escape or Ctrl+C
		else if (kb.matches(keyData, "tui.select.cancel")) {
			if (this.onCancel) {
				this.onCancel();
			}
		}
	}

	// 渲染单行条目（私有）：有描述且空间充足时走双列布局，否则仅渲染主列
	private renderItem(
		item: SelectItem,
		isSelected: boolean,
		width: number,
		descriptionSingleLine: string | undefined,
		primaryColumnWidth: number,
	): string {
		// 选中行用箭头前缀，未选中用两空格占位
		const prefix = isSelected ? "→ " : "  ";
		const prefixWidth = visibleWidth(prefix);

		if (descriptionSingleLine && width > 40) {
			// 双列布局：主列有效宽度受总宽钳制；描述起点 = 前缀 + 主列内容 + 弹性间距
			const effectivePrimaryColumnWidth = Math.max(1, Math.min(primaryColumnWidth, width - prefixWidth - 4));
			const maxPrimaryWidth = Math.max(1, effectivePrimaryColumnWidth - PRIMARY_COLUMN_GAP);
			const truncatedValue = this.truncatePrimary(item, isSelected, maxPrimaryWidth, effectivePrimaryColumnWidth);
			const truncatedValueWidth = visibleWidth(truncatedValue);
			const spacing = " ".repeat(Math.max(1, effectivePrimaryColumnWidth - truncatedValueWidth));
			const descriptionStart = prefixWidth + truncatedValueWidth + spacing.length;
			const remainingWidth = width - descriptionStart - 2; // -2 for safety

			if (remainingWidth > MIN_DESCRIPTION_WIDTH) {
				// 描述足够放得下：截断后拼在右侧
				const truncatedDesc = truncateToWidth(descriptionSingleLine, remainingWidth, "");
				if (isSelected) {
					return this.theme.selectedText(`${prefix}${truncatedValue}${spacing}${truncatedDesc}`);
				}

				const descText = this.theme.description(spacing + truncatedDesc);
				return prefix + truncatedValue + descText;
			}
		}

		// 单列回退：整行只显示主列内容
		const maxWidth = width - prefixWidth - 2;
		const truncatedValue = this.truncatePrimary(item, isSelected, maxWidth, maxWidth);
		if (isSelected) {
			return this.theme.selectedText(`${prefix}${truncatedValue}`);
		}

		return prefix + truncatedValue;
	}

	// 计算主列宽度（私有）：取最宽条目 + 间隔，再钳制到布局边界
	private getPrimaryColumnWidth(): number {
		const { min, max } = this.getPrimaryColumnBounds();
		const widestPrimary = this.filteredItems.reduce((widest, item) => {
			return Math.max(widest, visibleWidth(this.getDisplayValue(item)) + PRIMARY_COLUMN_GAP);
		}, 0);

		return clamp(widestPrimary, min, max);
	}

	// 获取主列宽度的最小/最大边界（私有）：任一缺省时互相回退，最终保证 min≤max 且 ≥1
	private getPrimaryColumnBounds(): { min: number; max: number } {
		const rawMin =
			this.layout.minPrimaryColumnWidth ?? this.layout.maxPrimaryColumnWidth ?? DEFAULT_PRIMARY_COLUMN_WIDTH;
		const rawMax =
			this.layout.maxPrimaryColumnWidth ?? this.layout.minPrimaryColumnWidth ?? DEFAULT_PRIMARY_COLUMN_WIDTH;

		return {
			min: Math.max(1, Math.min(rawMin, rawMax)),
			max: Math.max(1, Math.max(rawMin, rawMax)),
		};
	}

	// 截断主列内容（私有）：优先使用调用方注入的自定义截断，结果再统一按 maxWidth 兜底截断
	private truncatePrimary(item: SelectItem, isSelected: boolean, maxWidth: number, columnWidth: number): string {
		const displayValue = this.getDisplayValue(item);
		const truncatedValue = this.layout.truncatePrimary
			? this.layout.truncatePrimary({
					text: displayValue,
					maxWidth,
					columnWidth,
					item,
					isSelected,
				})
			: truncateToWidth(displayValue, maxWidth, "");

		return truncateToWidth(truncatedValue, maxWidth, "");
	}

	// 条目的展示文本：label 优先，为空回退 value
	private getDisplayValue(item: SelectItem): string {
		return item.label || item.value;
	}

	// 广播选中变化事件（私有）
	private notifySelectionChange(): void {
		const selectedItem = this.filteredItems[this.selectedIndex];
		if (selectedItem && this.onSelectionChange) {
			this.onSelectionChange(selectedItem);
		}
	}

	// 获取当前选中条目；无则返回 null
	getSelectedItem(): SelectItem | null {
		const item = this.filteredItems[this.selectedIndex];
		return item || null;
	}
}
