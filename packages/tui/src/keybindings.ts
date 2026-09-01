/**
 * 【文件职责】TUI 快捷键体系：声明全部内置快捷键 ID 注册表（可由下游包声明合并扩展）、
 *              默认键位定义表、用户自定义覆盖配置，以及负责解析/匹配/冲突检测的 KeybindingsManager。
 * 【技术维度】接口的字符串字面量键作为类型安全的事件名；declaration merging 开放扩展；
 *              satisfies 校验默认表形状；全局单例提供进程级访问点。
 * 【产品维度】让用户可自定义编辑器/选择器等全部按键行为（如把提交键改成其他组合），
 *              并在配置冲突时给出明确提示。
 * 【逻辑维度】Keybindings 接口列出全部动作 ID → TUI_KEYBINDINGS 给出默认键与描述 →
 *              Manager.rebuild 按“用户覆盖优先，否则用默认”解析出每个动作的有效键列表并检测冲突 →
 *              matches 用 keys.matchesKey 判定按键是否命中某动作。
 * 【关键边界】用户配置里未知的动作 ID 会被忽略；同一键被多个动作占用会记录为冲突（不阻断运行）；
 *              全局单例 setKeybindings 后影响整个进程。
 * 【新手阅读建议】先浏览 Keybindings 接口了解有哪些动作 → 再扫 TUI_KEYBINDINGS 看默认键位 →
 *              最后精读 KeybindingsManager 的 rebuild/matches。
 */
import { type KeyId, matchesKey } from "./keys.ts";

/**
 * Global keybinding registry.
 * Downstream packages can add keybindings via declaration merging.
 */
/**
 * 快捷键动作注册表（中文说明）：每个键为动作 ID、值为 true 占位；
 * 下游包可通过 declare module 声明合并追加自己的动作。分组：编辑器导航/删除/yank、
 * 通用输入（换行/提交/tab/复制）、通用选择器操作。
 */
export interface Keybindings {
	// Editor navigation and editing
	// 编辑器导航与编辑类动作
	"tui.editor.cursorUp": true;
	"tui.editor.cursorDown": true;
	"tui.editor.historyPrevious": true;
	"tui.editor.historyNext": true;
	"tui.editor.cursorLeft": true;
	"tui.editor.cursorRight": true;
	"tui.editor.cursorWordLeft": true;
	"tui.editor.cursorWordRight": true;
	"tui.editor.cursorLineStart": true;
	"tui.editor.cursorLineEnd": true;
	"tui.editor.jumpForward": true;
	"tui.editor.jumpBackward": true;
	"tui.editor.pageUp": true;
	"tui.editor.pageDown": true;
	"tui.editor.deleteCharBackward": true;
	"tui.editor.deleteCharForward": true;
	"tui.editor.deleteWordBackward": true;
	"tui.editor.deleteWordForward": true;
	"tui.editor.deleteToLineStart": true;
	"tui.editor.deleteToLineEnd": true;
	"tui.editor.yank": true;
	"tui.editor.yankPop": true;
	"tui.editor.undo": true;
	// Generic input actions
	// 通用输入动作
	"tui.input.newLine": true;
	"tui.input.submit": true;
	"tui.input.tab": true;
	"tui.input.copy": true;
	// Generic selection actions
	// 通用选择器动作
	"tui.select.up": true;
	"tui.select.down": true;
	"tui.select.pageUp": true;
	"tui.select.pageDown": true;
	"tui.select.confirm": true;
	"tui.select.cancel": true;
	// Alternate-screen viewport navigation
	"tui.altScreen.pageUp": true;
	"tui.altScreen.pageDown": true;
	"tui.altScreen.halfPageUp": true;
	"tui.altScreen.halfPageDown": true;
	"tui.altScreen.lineUp": true;
	"tui.altScreen.lineDown": true;
	"tui.altScreen.previousPrompt": true;
	"tui.altScreen.nextPrompt": true;
	"tui.altScreen.search": true;
	"tui.altScreen.searchNext": true;
	"tui.altScreen.searchPrevious": true;
	"tui.altScreen.searchClose": true;
	"tui.altScreen.top": true;
	"tui.altScreen.bottom": true;
}

// 动作 ID 类型：注册表的全部键名联合
export type Keybinding = keyof Keybindings;

/** 单个动作的定义（中文说明）：defaultKeys 默认键（单个或数组）；description 面向帮助文案。 */
export interface KeybindingDefinition {
	defaultKeys: KeyId | KeyId[];
	description?: string;
}

// 定义表类型：动作 ID → 定义
export type KeybindingDefinitions = Record<string, KeybindingDefinition>;
// 用户配置类型：动作 ID → 自定义键（undefined 表示沿用默认）
export type KeybindingsConfig = Record<string, KeyId | KeyId[] | undefined>;

/** TUI 内置快捷键默认定义表（中文说明）：以 Emacs/readline 惯例为主——
 * ctrl+a/e 行首尾、ctrl+w 删词、ctrl+k 删到行尾、ctrl+y yank 等。 */
export const TUI_KEYBINDINGS = {
	"tui.editor.cursorUp": { defaultKeys: "up", description: "Move cursor up" },
	"tui.editor.cursorDown": { defaultKeys: "down", description: "Move cursor down" },
	"tui.editor.historyPrevious": {
		defaultKeys: [],
		description: "Select previous prompt history entry",
	},
	"tui.editor.historyNext": {
		defaultKeys: [],
		description: "Select next prompt history entry",
	},
	"tui.editor.cursorLeft": {
		defaultKeys: ["left", "ctrl+b"],
		description: "Move cursor left",
	},
	"tui.editor.cursorRight": {
		defaultKeys: ["right", "ctrl+f"],
		description: "Move cursor right",
	},
	"tui.editor.cursorWordLeft": {
		defaultKeys: ["alt+left", "ctrl+left", "alt+b"],
		description: "Move cursor word left",
	},
	"tui.editor.cursorWordRight": {
		defaultKeys: ["alt+right", "ctrl+right", "alt+f"],
		description: "Move cursor word right",
	},
	"tui.editor.cursorLineStart": {
		defaultKeys: ["home", "ctrl+home", "ctrl+a"],
		description: "Move to line start",
	},
	"tui.editor.cursorLineEnd": {
		defaultKeys: ["end", "ctrl+end", "ctrl+e"],
		description: "Move to line end",
	},
	"tui.editor.jumpForward": {
		defaultKeys: "ctrl+]",
		description: "Jump forward to character",
	},
	"tui.editor.jumpBackward": {
		defaultKeys: "ctrl+alt+]",
		description: "Jump backward to character",
	},
	"tui.editor.pageUp": { defaultKeys: ["pageUp", "ctrl+pageUp"], description: "Page up" },
	"tui.editor.pageDown": { defaultKeys: ["pageDown", "ctrl+pageDown"], description: "Page down" },
	"tui.editor.deleteCharBackward": {
		defaultKeys: "backspace",
		description: "Delete character backward",
	},
	"tui.editor.deleteCharForward": {
		defaultKeys: ["delete", "ctrl+d"],
		description: "Delete character forward",
	},
	"tui.editor.deleteWordBackward": {
		defaultKeys: ["ctrl+w", "alt+backspace"],
		description: "Delete word backward",
	},
	"tui.editor.deleteWordForward": {
		defaultKeys: ["alt+d", "alt+delete"],
		description: "Delete word forward",
	},
	"tui.editor.deleteToLineStart": {
		defaultKeys: "ctrl+u",
		description: "Delete to line start",
	},
	"tui.editor.deleteToLineEnd": {
		defaultKeys: "ctrl+k",
		description: "Delete to line end",
	},
	"tui.editor.yank": { defaultKeys: "ctrl+y", description: "Yank" },
	"tui.editor.yankPop": { defaultKeys: "alt+y", description: "Yank pop" },
	"tui.editor.undo": { defaultKeys: "ctrl+-", description: "Undo" },
	"tui.input.newLine": { defaultKeys: ["shift+enter", "ctrl+j"], description: "Insert newline" },
	"tui.input.submit": { defaultKeys: "enter", description: "Submit input" },
	"tui.input.tab": { defaultKeys: "tab", description: "Tab / autocomplete" },
	"tui.input.copy": { defaultKeys: "ctrl+c", description: "Copy selection" },
	"tui.select.up": { defaultKeys: "up", description: "Move selection up" },
	"tui.select.down": { defaultKeys: "down", description: "Move selection down" },
	"tui.select.pageUp": { defaultKeys: "pageUp", description: "Selection page up" },
	"tui.select.pageDown": {
		defaultKeys: "pageDown",
		description: "Selection page down",
	},
	"tui.select.confirm": { defaultKeys: "enter", description: "Confirm selection" },
	"tui.select.cancel": {
		defaultKeys: ["escape", "ctrl+c"],
		description: "Cancel selection",
	},
	// These intentionally shadow the unmodified editor bindings in fullscreen mode.
	"tui.altScreen.pageUp": {
		defaultKeys: "pageUp",
		description: "Scroll viewport up one page",
	},
	"tui.altScreen.pageDown": {
		defaultKeys: "pageDown",
		description: "Scroll viewport down one page",
	},
	"tui.altScreen.halfPageUp": {
		defaultKeys: [],
		description: "Scroll viewport up half a page",
	},
	"tui.altScreen.halfPageDown": {
		defaultKeys: [],
		description: "Scroll viewport down half a page",
	},
	"tui.altScreen.lineUp": {
		defaultKeys: [],
		description: "Scroll viewport up one line",
	},
	"tui.altScreen.lineDown": {
		defaultKeys: [],
		description: "Scroll viewport down one line",
	},
	"tui.altScreen.previousPrompt": {
		defaultKeys: ["ctrl+shift+up", "ctrl+up"],
		description: "Jump to previous semantic prompt",
	},
	"tui.altScreen.nextPrompt": {
		defaultKeys: ["ctrl+shift+down", "ctrl+down"],
		description: "Jump to next semantic prompt",
	},
	"tui.altScreen.search": {
		defaultKeys: "ctrl+shift+f",
		description: "Search the primary scroll view",
	},
	"tui.altScreen.searchNext": {
		defaultKeys: ["enter", "ctrl+g"],
		description: "Select the next search match",
	},
	"tui.altScreen.searchPrevious": {
		defaultKeys: ["shift+enter", "ctrl+shift+g"],
		description: "Select the previous search match",
	},
	"tui.altScreen.searchClose": {
		defaultKeys: "escape",
		description: "Close transcript search",
	},
	"tui.altScreen.top": { defaultKeys: "home", description: "Scroll viewport to top" },
	"tui.altScreen.bottom": { defaultKeys: "end", description: "Scroll viewport to bottom" },
} as const satisfies KeybindingDefinitions;

/** 键位冲突记录（中文说明）：key 为被争用的键；keybindings 为同时声明该键的动作列表。 */
export interface KeybindingConflict {
	key: KeyId;
	keybindings: string[];
}

// 去重归一化（私有）：undefined→空数组；单键转数组；按出现顺序去重
function normalizeKeys(keys: KeyId | KeyId[] | undefined): KeyId[] {
	if (keys === undefined) return [];
	const keyList = Array.isArray(keys) ? keys : [keys];
	const seen = new Set<KeyId>();
	const result: KeyId[] = [];
	for (const key of keyList) {
		if (!seen.has(key)) {
			seen.add(key);
			result.push(key);
		}
	}
	return result;
}

/**
 * KeybindingsManager（中文说明）：给定定义表与用户覆盖配置，
 * 解析每个动作的最终有效键列表，并提供匹配判定、冲突查询与配置热替换。
 */
export class KeybindingsManager {
	// 动作定义表（含描述与默认键）
	private definitions: KeybindingDefinitions;
	// 用户自定义覆盖配置
	private userBindings: KeybindingsConfig;
	// 解析结果：动作 ID → 有效键列表
	private keysById = new Map<Keybinding, KeyId[]>();
	// 用户配置中的键位冲突列表
	private conflicts: KeybindingConflict[] = [];

	// 构造：保存定义与配置后立即重建解析缓存
	constructor(definitions: KeybindingDefinitions, userBindings: KeybindingsConfig = {}) {
		this.definitions = definitions;
		this.userBindings = userBindings;
		this.rebuild();
	}

	/**
	 * 重建解析缓存（私有）：先统计用户配置中每个键被哪些动作声明（未知动作忽略）并记下冲突，
	 * 再逐动作解析最终键——有用户覆盖用用户的（归一化），否则用默认键。
	 */
	private rebuild(): void {
		this.keysById.clear();
		this.conflicts = [];

		// 用户配置的“键 → 声明它的动作集合”
		const userClaims = new Map<KeyId, Set<Keybinding>>();
		for (const [keybinding, keys] of Object.entries(this.userBindings)) {
			// 忽略定义表中不存在的动作 ID
			if (!(keybinding in this.definitions)) continue;
			for (const key of normalizeKeys(keys)) {
				const claimants = userClaims.get(key) ?? new Set<Keybinding>();
				claimants.add(keybinding as Keybinding);
				userClaims.set(key, claimants);
			}
		}

		// 同一键被多个动作声明即为冲突
		for (const [key, keybindings] of userClaims) {
			if (keybindings.size > 1) {
				this.conflicts.push({ key, keybindings: [...keybindings] });
			}
		}

		// 解析每个动作的最终键列表
		for (const [id, definition] of Object.entries(this.definitions)) {
			const userKeys = this.userBindings[id];
			const keys = userKeys === undefined ? normalizeKeys(definition.defaultKeys) : normalizeKeys(userKeys);
			this.keysById.set(id as Keybinding, keys);
		}
	}

	// 判定原始按键数据是否命中指定动作的任一键位
	matches(data: string, keybinding: Keybinding): boolean {
		const keys = this.keysById.get(keybinding) ?? [];
		for (const key of keys) {
			if (matchesKey(data, key)) return true;
		}
		return false;
	}

	// 获取某动作的有效键列表（副本）
	getKeys(keybinding: Keybinding): KeyId[] {
		return [...(this.keysById.get(keybinding) ?? [])];
	}

	// 获取某动作的原始定义（含描述）
	getDefinition(keybinding: Keybinding): KeybindingDefinition {
		return this.definitions[keybinding];
	}

	// 获取全部冲突的深拷贝列表
	getConflicts(): KeybindingConflict[] {
		return this.conflicts.map((conflict) => ({ ...conflict, keybindings: [...conflict.keybindings] }));
	}

	// 热替换用户配置并重建
	setUserBindings(userBindings: KeybindingsConfig): void {
		this.userBindings = userBindings;
		this.rebuild();
	}

	// 获取用户配置副本
	getUserBindings(): KeybindingsConfig {
		return { ...this.userBindings };
	}

	// 获取解析后的完整绑定表：单键返回标量、多键返回数组
	getResolvedBindings(): KeybindingsConfig {
		const resolved: KeybindingsConfig = {};
		for (const id of Object.keys(this.definitions)) {
			const keys = this.keysById.get(id as Keybinding) ?? [];
			resolved[id] = keys.length === 1 ? keys[0]! : [...keys];
		}
		return resolved;
	}
}

// 进程级全局管理器单例；null 表示尚未创建
let globalKeybindings: KeybindingsManager | null = null;

// 设置全局快捷键管理器（宿主注入自定义配置时调用）
export function setKeybindings(keybindings: KeybindingsManager): void {
	globalKeybindings = keybindings;
}

// 获取全局管理器：未设置时用内置 TUI_KEYBINDINGS 懒创建
export function getKeybindings(): KeybindingsManager {
	if (!globalKeybindings) {
		globalKeybindings = new KeybindingsManager(TUI_KEYBINDINGS);
	}
	return globalKeybindings;
}
