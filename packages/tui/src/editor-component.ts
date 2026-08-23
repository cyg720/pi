/**
 * 【文件职责】定义自定义编辑器组件的接口契约（EditorComponent）：扩展可用自己的编辑器实现
 *              （vim 模式、emacs 模式、自定义键位等）替换内置编辑器，同时保持与宿主应用的兼容。
 * 【技术维度】接口继承 Component 获得渲染/布局能力；方法按“必需/可选回调/可选增强”分层，
 *              可选方法由宿主做存在性探测后调用。
 * 【产品维度】是编辑器可插拔的关键接缝：第三方扩展无需改动核心代码即可接入全新编辑体验。
 * 【逻辑维度】必需：getText/setText/handleInput（文本读写与按键处理）→ 必需回调：onSubmit/onChange →
 *              可选增强：历史记录、光标插入、展开文本、自动补全、外观定制。
 * 【关键边界】handleInput 接收的是原始终端字节序列；getExpandedText 未实现时宿主回退 getText；
 *              回调属性由宿主赋值、编辑器实现负责触发。
 * 【新手阅读建议】按文件内的分区注释顺序读：先掌握三个必需方法，再浏览各可选增强了解扩展空间。
 */
import type { AutocompleteProvider } from "./autocomplete.ts";
import type { Component } from "./tui.ts";

/**
 * Interface for custom editor components.
 *
 * This allows extensions to provide their own editor implementation
 * (e.g., vim mode, emacs mode, custom keybindings) while maintaining
 * compatibility with the core application.
 */
/**
 * 自定义编辑器组件接口（中文说明）：继承 Component；实现方需提供核心文本访问与输入处理，
 * 其余为可选能力，宿主按需探测调用。
 */
export interface EditorComponent extends Component {
	// =========================================================================
	// Core text access (required)
	// =========================================================================
	// 核心文本访问（必需）

	/** Get the current text content */
	// 获取当前文本内容
	getText(): string;

	/** Set the text content */
	// 设置文本内容（整体替换）
	setText(text: string): void;

	/** Handle raw terminal input (key presses, paste sequences, etc.) */
	// 处理原始终端输入（按键字节、粘贴序列等）
	handleInput(data: string): void;

	// =========================================================================
	// Callbacks (required)
	// =========================================================================
	// 回调（必需）

	/** Called when user submits (e.g., Enter key) */
	// 用户提交时触发（如按下回车）；参数为当前文本
	onSubmit?: (text: string) => void;

	/** Called when text changes */
	// 文本变化时触发
	onChange?: (text: string) => void;

	// =========================================================================
	// History support (optional)
	// =========================================================================
	// 历史记录支持（可选）

	/** Add text to history for up/down navigation */
	// 把文本加入历史，供上/下方向键翻阅
	addToHistory?(text: string): void;

	// =========================================================================
	// Advanced text manipulation (optional)
	// =========================================================================
	// 高级文本操作（可选）

	/** Insert text at current cursor position */
	// 在当前光标处插入文本
	insertTextAtCursor?(text: string): void;

	/**
	 * Get text with any markers expanded (e.g., paste markers).
	 * Falls back to getText() if not implemented.
	 */
	// 获取“标记展开后”的文本（如粘贴标记还原为完整内容）；未实现时宿主回退 getText()
	getExpandedText?(): string;

	// =========================================================================
	// Autocomplete support (optional)
	// =========================================================================
	// 自动补全支持（可选）

	/** Set the autocomplete provider */
	// 设置自动补全提供器
	setAutocompleteProvider?(provider: AutocompleteProvider): void;

	// =========================================================================
	// Appearance (optional)
	// =========================================================================
	// 外观定制（可选）

	/** Border color function */
	// 边框着色函数（接收字符串返回带色字符串）
	borderColor?: (str: string) => string;

	/** Set horizontal padding */
	// 设置水平内边距（列数）
	setPaddingX?(padding: number): void;

	/** Set max visible items in autocomplete dropdown */
	// 设置自动补全下拉的最大可见条数
	setAutocompleteMaxVisible?(maxVisible: number): void;
}
