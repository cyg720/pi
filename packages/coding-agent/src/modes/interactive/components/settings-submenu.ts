/**
 * 【文件职责】实现 `@earendil-works/pi-coding-agent` 包中的 `modes/interactive/components/settings-submenu` 模块，集中维护该模块的类型、状态与操作入口。
 * 【技术维度】主要依赖 `@earendil-works/pi-tui`、`../theme/theme.ts`，并通过 TypeScript 模块边界组织实现。
 * 【产品维度】为具备读取、命令执行、编辑、写入和会话管理能力的编码代理 CLI 提供实现；本文件负责其中与 `modes/interactive/components/settings-submenu` 对应的子能力。
 * 【逻辑维度】对外入口包括 `SelectSubmenuOptions`、`SelectSubmenu`、`SteppedSubmenuStep`、`SteppedSubmenu`；内部辅助逻辑围绕这些入口完成数据转换与流程控制。
 * 【关键边界】调用方应遵守导出类型、错误处理和资源生命周期约束；未导出的辅助实现不构成稳定接口。
 * 【新手阅读建议】先查看 `SelectSubmenuOptions`、`SelectSubmenu`、`SteppedSubmenuStep`、`SteppedSubmenu` 的签名，再沿导入依赖和内部调用链理解具体实现。
 */
import {
	type Component,
	Container,
	fuzzyFilter,
	getKeybindings,
	Input,
	type SelectItem,
	SelectList,
	type SelectListLayoutOptions,
	Spacer,
	Text,
} from "@earendil-works/pi-tui";
import { getSelectListTheme, theme } from "../theme/theme.ts";

const SUBMENU_SELECT_LIST_LAYOUT: SelectListLayoutOptions = {
	minPrimaryColumnWidth: 12,
	maxPrimaryColumnWidth: 32,
};

export interface SelectSubmenuOptions {
	/** Enable type-to-search fuzzy filtering. */
	searchable?: boolean;
	/** Override the select list layout (column widths). */
	layout?: SelectListLayoutOptions;
}

/**
 * Single-step submenu that shows a titled select list.
 * With `searchable: true`, typing filters the list using fuzzy matching.
 */
export class SelectSubmenu extends Container {
	private selectList: SelectList;
	private listChildIndex: number;
	private allOptions: SelectItem[];
	private listLayout: SelectListLayoutOptions;
	private searchInput: Input | undefined;
	private onSelectCb: (value: string) => void;
	private onCancelCb: () => void;
	private onSelectionChangeCb?: (value: string) => void;

	constructor(
		title: string,
		description: string,
		options: SelectItem[],
		currentValue: string,
		onSelect: (value: string) => void,
		onCancel: () => void,
		onSelectionChange?: (value: string) => void,
		submenuOptions?: SelectSubmenuOptions,
	) {
		super();

		this.allOptions = options;
		this.listLayout = submenuOptions?.layout ?? SUBMENU_SELECT_LIST_LAYOUT;
		this.onSelectCb = onSelect;
		this.onCancelCb = onCancel;
		this.onSelectionChangeCb = onSelectionChange;

		// Title
		this.addChild(new Text(theme.bold(theme.fg("accent", title)), 0, 0));

		// Description
		if (description) {
			this.addChild(new Spacer(1));
			this.addChild(new Text(theme.fg("muted", description), 0, 0));
		}

		// Search input
		if (submenuOptions?.searchable) {
			this.addChild(new Spacer(1));
			this.searchInput = new Input();
			this.searchInput.onSubmit = () => {
				this.selectList.handleInput("\r");
			};
			this.addChild(this.searchInput);
		}

		// Spacer
		this.addChild(new Spacer(1));

		// Select list
		this.selectList = this.buildSelectList(options, currentValue);
		this.listChildIndex = this.children.length;
		this.addChild(this.selectList);

		// Hint
		this.addChild(new Spacer(1));
		const hint = submenuOptions?.searchable
			? "  Type to filter \u00b7 Enter to select \u00b7 Esc to go back"
			: "  Enter to select \u00b7 Esc to go back";
		this.addChild(new Text(theme.fg("dim", hint), 0, 0));
	}

	private buildSelectList(options: SelectItem[], preselect: string): SelectList {
		const list = new SelectList(options, Math.min(options.length, 10), getSelectListTheme(), this.listLayout);

		const idx = options.findIndex((o) => o.value === preselect);
		if (idx !== -1) list.setSelectedIndex(idx);

		list.onSelect = (item) => this.onSelectCb(item.value);
		list.onCancel = this.onCancelCb;
		if (this.onSelectionChangeCb) {
			const cb = this.onSelectionChangeCb;
			list.onSelectionChange = (item) => cb(item.value);
		}

		return list;
	}

	private applyFilter(query: string): void {
		const filtered = query
			? fuzzyFilter(this.allOptions, query, (item) => `${item.label} ${item.description ?? ""}`)
			: this.allOptions;

		const newList = this.buildSelectList(filtered, "");
		this.children[this.listChildIndex] = newList;
		this.selectList = newList;
	}

	handleInput(data: string): void {
		if (this.searchInput) {
			const kb = getKeybindings();
			const isNav =
				kb.matches(data, "tui.select.up") ||
				kb.matches(data, "tui.select.down") ||
				kb.matches(data, "tui.select.confirm") ||
				kb.matches(data, "tui.select.cancel");
			if (isNav) {
				this.selectList.handleInput(data);
			} else {
				this.searchInput.handleInput(data);
				this.applyFilter(this.searchInput.getValue());
			}
		} else {
			this.selectList.handleInput(data);
		}
	}
}

// ============================================================================
// SteppedSubmenu — reusable multi-step selector
// ============================================================================

/** One step in a {@link SteppedSubmenu}. */
export interface SteppedSubmenuStep {
	/** Unique key \u2014 the selected value is stored in the result context under this key. */
	key: string;
	/** Title shown at the top of the step. Receives prior selections. */
	title: string | ((context: Record<string, string>) => string);
	/** Description shown below the title. Receives prior selections. */
	description: string | ((context: Record<string, string>) => string);
	/** Build the option list for this step. Called fresh each time the step is shown. */
	options: (context: Record<string, string>) => SelectItem[];
	/** Optionally pre-select a value when entering this step. */
	preselect?: (context: Record<string, string>) => string | undefined;
	/** Enable type-to-search fuzzy filtering for this step. */
	searchable?: boolean;
	/** Override the select list layout (column widths) for this step. */
	layout?: SelectListLayoutOptions;
}

interface SteppedSubmenuOptions {
	/** Start at this step index (0-based), skipping earlier steps. Requires initialContext for skipped keys. */
	startAtStep?: number;
	/** Pre-fill selections for skipped steps. */
	initialContext?: Record<string, string>;
	/** After completing the last step, loop back to step 0 instead of closing. */
	loop?: boolean;
}

/**
 * Generic N-step submenu built on top of {@link SelectSubmenu}.
 *
 * Each step's options can depend on prior selections via the shared context.
 * Esc goes back one step; Esc at step 0 cancels.
 * With `loop: true`, completing the final step invokes `onComplete` then returns to step 0.
 */
export class SteppedSubmenu extends Container {
	private readonly steps: SteppedSubmenuStep[];
	private readonly onComplete: (context: Record<string, string>) => void;
	private readonly onCancel: () => void;
	private readonly opts: SteppedSubmenuOptions;
	private activeComponent: Component;
	private context: Record<string, string>;

	constructor(
		steps: SteppedSubmenuStep[],
		onComplete: (context: Record<string, string>) => void,
		onCancel: () => void,
		opts: SteppedSubmenuOptions = {},
	) {
		super();
		this.steps = steps;
		this.onComplete = onComplete;
		this.onCancel = onCancel;
		this.opts = opts;
		this.context = { ...(opts.initialContext ?? {}) };
		this.activeComponent = this.buildStep(opts.startAtStep ?? 0);
	}

	private buildStep(stepIndex: number): Component {
		const step = this.steps[stepIndex];
		const total = this.steps.length;
		const stepLabel = total > 1 ? `Step ${stepIndex + 1}/${total} \u00b7 ` : "";

		const title = typeof step.title === "function" ? step.title(this.context) : step.title;
		const desc = typeof step.description === "function" ? step.description(this.context) : step.description;
		const items = step.options(this.context);
		const preselect = step.preselect?.(this.context) ?? "";

		return new SelectSubmenu(
			title,
			`${stepLabel}${desc}`,
			items,
			preselect,
			(value) => {
				this.context[step.key] = value;

				if (stepIndex < total - 1) {
					// Advance to next step
					this.activeComponent = this.buildStep(stepIndex + 1);
				} else {
					// Final step \u2014 deliver result
					this.onComplete({ ...this.context });

					if (this.opts.loop) {
						this.context = {};
						this.activeComponent = this.buildStep(0);
					} else {
						this.onCancel();
					}
				}
			},
			() => {
				if (stepIndex > 0) {
					delete this.context[step.key];
					this.activeComponent = this.buildStep(stepIndex - 1);
				} else {
					this.onCancel();
				}
			},
			undefined,
			step.searchable || step.layout ? { searchable: step.searchable, layout: step.layout } : undefined,
		);
	}

	render(width: number): string[] {
		return this.activeComponent.render(width);
	}

	handleInput(data: string): void {
		this.activeComponent.handleInput?.(data);
	}

	invalidate(): void {
		this.activeComponent.invalidate?.();
	}
}
