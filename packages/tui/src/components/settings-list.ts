/**
 * 【文件职责】实现 SettingsList 设置列表组件：可滚动的“标签-当前值”双列设置项列表，
 *              支持 Enter/Space 循环取值、子菜单编辑、可选的模糊搜索过滤与主题化外观。
 * 【技术维度】实现 Component/Focusable 协作模式；fuzzyFilter 搜索过滤；快捷键表驱动输入；
 *              子菜单以组件委托方式接管渲染与输入。
 * 【产品维度】承载 /settings 之类的配置面板体验：用户可在终端里浏览、搜索并直接修改各项设置。
 * 【逻辑维度】render：有子菜单则完全委托 → 否则渲染搜索框（可选）+ 可视窗口内的条目 + 滚动指示 +
 *              选中项描述 + 操作提示；handleInput：上下选择、Enter/Space 激活、Esc 取消、其余键喂给搜索框。
 * 【关键边界】values 与 submenu 二选一决定激活行为；子菜单关闭后光标回到打开它的条目；
 *              搜索模式下过滤结果变化会把 selectedIndex 重置为 0；空格被排除出搜索输入。
 * 【新手阅读建议】先看 SettingItem 各字段了解条目模型 → 再读 handleInput 的分支 →
 *              最后看 activateItem 中两种激活路径与 renderMainList 的可视窗口计算。
 */
import { fuzzyFilter } from "../fuzzy.ts";
import { getKeybindings } from "../keybindings.ts";
import type { Component } from "../tui.ts";
import { truncateToWidth, visibleWidth, wrapTextWithAnsi } from "../utils.ts";
import { Input } from "./input.ts";

/** 单个设置条目（中文说明）：id 唯一标识；label 左侧显示名；description 选中时展示的说明；
 * currentValue 右侧显示值；values 提供时 Enter/Space 循环切换；submenu 提供时 Enter 打开子菜单组件。 */
export interface SettingItem {
	/** Unique identifier for this setting */
	// 该设置的唯一标识
	id: string;
	/** Display label (left side) */
	// 展示名称（左列）
	label: string;
	/** Optional description shown when selected */
	// 可选描述：选中时显示在底部
	description?: string;
	/** Current value to display (right side) */
	// 当前值（右列显示）
	currentValue: string;
	/** If provided, Enter/Space cycles through these values */
	// 可选候选值数组：激活时循环切换
	values?: string[];
	/** If provided, Enter opens this submenu. Receives current value and done callback. */
	// 可选子菜单工厂：入参当前值与完成回调；返回接管交互的组件
	submenu?: (currentValue: string, done: (selectedValue?: string) => void) => Component;
}

/** 列表主题（中文说明）：各元素的着色函数与光标字符，全部由调用方注入。 */
export interface SettingsListTheme {
	// 标签着色：入参文本与是否选中
	label: (text: string, selected: boolean) => string;
	// 值着色：入参文本与是否选中
	value: (text: string, selected: boolean) => string;
	// 描述着色
	description: (text: string) => string;
	// 选中行的光标前缀字符
	cursor: string;
	// 提示文字着色
	hint: (text: string) => string;
}

/** 组件选项（中文说明）：enableSearch 开启顶部模糊搜索框。 */
export interface SettingsListOptions {
	enableSearch?: boolean;
}

/**
 * SettingsList（中文说明）：持有完整条目列表、过滤结果、主题、选中下标与可选搜索框/子菜单状态。
 */
export class SettingsList implements Component {
	// 全部设置条目
	private items: SettingItem[];
	// 搜索过滤后的条目（仅搜索模式使用）
	private filteredItems: SettingItem[];
	// 外观主题
	private theme: SettingsListTheme;
	// 当前选中的下标（相对可视数据源）
	private selectedIndex = 0;
	// 视口内最大可见条数
	private maxVisible: number;
	// 值变化回调：参数为条目 id 与新值
	private onChange: (id: string, newValue: string) => void;
	// 取消回调（Esc）
	private onCancel: () => void;
	// 搜索输入框（搜索模式才有）
	private searchInput?: Input;
	// 是否启用搜索
	private searchEnabled: boolean;

	// Submenu state
	// 子菜单状态：当前打开的子菜单组件与其来源条目下标
	private submenuComponent: Component | null = null;
	private submenuItemIndex: number | null = null;

	// 构造函数：保存依赖；enableSearch 为真时创建搜索输入框
	constructor(
		items: SettingItem[],
		maxVisible: number,
		theme: SettingsListTheme,
		onChange: (id: string, newValue: string) => void,
		onCancel: () => void,
		options: SettingsListOptions = {},
	) {
		this.items = items;
		this.filteredItems = items;
		this.maxVisible = maxVisible;
		this.theme = theme;
		this.onChange = onChange;
		this.onCancel = onCancel;
		this.searchEnabled = options.enableSearch ?? false;
		if (this.searchEnabled) {
			this.searchInput = new Input();
		}
	}

	/** Update an item's currentValue */
	// 按 id 更新某条目的当前值（外部同步状态用）
	updateValue(id: string, newValue: string): void {
		const item = this.items.find((i) => i.id === id);
		if (item) {
			item.currentValue = newValue;
		}
	}

	// 级联失效：转发给打开中的子菜单
	invalidate(): void {
		this.submenuComponent?.invalidate?.();
	}

	// 渲染入口：子菜单激活时完全由其接管
	render(width: number): string[] {
		// If submenu is active, render it instead
		if (this.submenuComponent) {
			return this.submenuComponent.render(width);
		}

		return this.renderMainList(width);
	}

	// 主列表渲染（私有）：搜索框 → 空态提示 → 可视窗口条目 → 滚动指示 → 描述 → 操作提示
	private renderMainList(width: number): string[] {
		const lines: string[] = [];

		if (this.searchEnabled && this.searchInput) {
			// 搜索模式：先渲染搜索框与分隔空行
			lines.push(...this.searchInput.render(width));
			lines.push("");
		}

		if (this.items.length === 0) {
			// 无任何设置项的空态
			lines.push(this.theme.hint("  No settings available"));
			if (this.searchEnabled) {
				this.addHintLine(lines, width);
			}
			return lines;
		}

		const displayItems = this.searchEnabled ? this.filteredItems : this.items;
		if (displayItems.length === 0) {
			// 搜索无匹配的空态
			lines.push(truncateToWidth(this.theme.hint("  No matching settings"), width));
			this.addHintLine(lines, width);
			return lines;
		}

		// Calculate visible range with scrolling
		// 计算滚动窗口：尽量让选中项居中，并钳制在合法范围
		const startIndex = Math.max(
			0,
			Math.min(this.selectedIndex - Math.floor(this.maxVisible / 2), displayItems.length - this.maxVisible),
		);
		const endIndex = Math.min(startIndex + this.maxVisible, displayItems.length);

		// Calculate max label width for alignment
		// 标签对齐宽度：最长标签但不超过 30 列
		const maxLabelWidth = Math.min(30, Math.max(...this.items.map((item) => visibleWidth(item.label))));

		// Render visible items
		// 渲染窗口内每个条目：光标前缀 + 对齐标签 + 分隔 + 截断后的值
		for (let i = startIndex; i < endIndex; i++) {
			const item = displayItems[i];
			if (!item) continue;

			const isSelected = i === this.selectedIndex;
			const prefix = isSelected ? this.theme.cursor : "  ";
			const prefixWidth = visibleWidth(prefix);

			// Pad label to align values
			// 标签补空格对齐后着色
			const labelPadded = item.label + " ".repeat(Math.max(0, maxLabelWidth - visibleWidth(item.label)));
			const labelText = this.theme.label(labelPadded, isSelected);

			// Calculate space for value
			// 计算值区域的可用宽度并截断着色
			const separator = "  ";
			const usedWidth = prefixWidth + maxLabelWidth + visibleWidth(separator);
			const valueMaxWidth = width - usedWidth - 2;

			const valueText = this.theme.value(truncateToWidth(item.currentValue, valueMaxWidth, ""), isSelected);

			lines.push(truncateToWidth(prefix + labelText + separator + valueText, width));
		}

		// Add scroll indicator if needed
		// 有内容被卷动时显示“当前位置/总数”
		if (startIndex > 0 || endIndex < displayItems.length) {
			const scrollText = `  (${this.selectedIndex + 1}/${displayItems.length})`;
			lines.push(this.theme.hint(truncateToWidth(scrollText, width - 2, "")));
		}

		// Add description for selected item
		// 选中项描述：折行后逐行着色输出
		const selectedItem = displayItems[this.selectedIndex];
		if (selectedItem?.description) {
			lines.push("");
			const wrappedDesc = wrapTextWithAnsi(selectedItem.description, width - 4);
			for (const line of wrappedDesc) {
				lines.push(this.theme.description(`  ${line}`));
			}
		}

		// Add hint
		// 底部操作提示
		this.addHintLine(lines, width);

		return lines;
	}

	// 输入处理：子菜单优先接管；否则按上/下/确认/取消分发，剩余键交给搜索框
	handleInput(data: string): void {
		// If submenu is active, delegate all input to it
		// The submenu's onCancel (triggered by escape) will call done() which closes it
		if (this.submenuComponent) {
			this.submenuComponent.handleInput?.(data);
			return;
		}

		// Main list input handling
		const kb = getKeybindings();
		const displayItems = this.searchEnabled ? this.filteredItems : this.items;
		if (kb.matches(data, "tui.select.up")) {
			// 上移：首行回绕到末行
			if (displayItems.length === 0) return;
			this.selectedIndex = this.selectedIndex === 0 ? displayItems.length - 1 : this.selectedIndex - 1;
		} else if (kb.matches(data, "tui.select.down")) {
			// 下移：末行回绕到首行
			if (displayItems.length === 0) return;
			this.selectedIndex = this.selectedIndex === displayItems.length - 1 ? 0 : this.selectedIndex + 1;
		} else if (kb.matches(data, "tui.select.confirm") || data === " ") {
			// Enter 或空格激活当前条目
			this.activateItem();
		} else if (kb.matches(data, "tui.select.cancel")) {
			// Esc 触发取消回调
			this.onCancel();
		} else if (this.searchEnabled && this.searchInput) {
			// 其余按键进入搜索：剔除空格后若仍有内容才喂给输入框
			const sanitized = data.replace(/ /g, "");
			if (!sanitized) {
				return;
			}
			this.searchInput.handleInput(sanitized);
			this.applyFilter(this.searchInput.getValue());
		}
	}

	/**
	 * 激活当前条目（私有）：有 submenu 则记录来源下标并打开子菜单（done 回调里更新值）；
	 * 否则有 values 时循环切换到下一个候选值并触发 onChange。
	 */
	private activateItem(): void {
		const item = this.searchEnabled ? this.filteredItems[this.selectedIndex] : this.items[this.selectedIndex];
		if (!item) return;

		if (item.submenu) {
			// Open submenu, passing current value so it can pre-select correctly
			// 打开子菜单：done(selectedValue?) 更新值并关闭；传 undefined 表示仅关闭不改值
			this.submenuItemIndex = this.selectedIndex;
			this.submenuComponent = item.submenu(item.currentValue, (selectedValue?: string) => {
				if (selectedValue !== undefined) {
					item.currentValue = selectedValue;
					this.onChange(item.id, selectedValue);
				}
				this.closeSubmenu();
			});
		} else if (item.values && item.values.length > 0) {
			// Cycle through values
			// 循环取值：当前下标 +1 取模得到下一个候选
			const currentIndex = item.values.indexOf(item.currentValue);
			const nextIndex = (currentIndex + 1) % item.values.length;
			const newValue = item.values[nextIndex];
			item.currentValue = newValue;
			this.onChange(item.id, newValue);
		}
	}

	// 关闭子菜单（私有）：清引用并把选中位置恢复到打开它的条目
	private closeSubmenu(): void {
		this.submenuComponent = null;
		// Restore selection to the item that opened the submenu
		if (this.submenuItemIndex !== null) {
			this.selectedIndex = this.submenuItemIndex;
			this.submenuItemIndex = null;
		}
	}

	// 应用搜索过滤（私有）：按 label 模糊过滤并把选中重置到第一条
	private applyFilter(query: string): void {
		this.filteredItems = fuzzyFilter(this.items, query, (item) => item.label);
		this.selectedIndex = 0;
	}

	// 追加操作提示行（私有）：搜索模式提示额外多一条“Type to search”
	private addHintLine(lines: string[], width: number): void {
		lines.push("");
		lines.push(
			truncateToWidth(
				this.theme.hint(
					this.searchEnabled
						? "  Type to search · Enter/Space to change · Esc to cancel"
						: "  Enter/Space to change · Esc to cancel",
				),
				width,
			),
		);
	}
}
