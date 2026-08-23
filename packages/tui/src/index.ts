/**
 * 【文件职责】tui 包的总出口（barrel 文件）：集中导出终端 UI 框架的全部公开能力——
 *              TUI 核心（组件/容器/覆盖层）、编辑器与输入组件、自动补全、快捷键体系、
 *              键盘输入解析、stdin 缓冲、终端接口、颜色/图片支持与文本工具函数。
 * 【技术维度】纯 TypeScript ESM 再导出，无实现逻辑。
 * 【产品维度】为上层应用（如 coding-agent 的交互模式）提供一套可复用的终端界面积木；
 *              二次开发自定义 TUI 界面时从这里取用所有构件。
 * 【逻辑维度】按“自动补全 → 组件 → 编辑器接口 → 模糊匹配 → 快捷键 → 按键解析 → 输入缓冲 →
 *              终端 → 颜色 → 图片 → TUI 核心 → 工具”分组导出。
 * 【关键边界】本文件只做转发；新增公开模块必须在此登记；注意避免导出名冲突。
 * 【新手阅读建议】第一站读本文件建立能力清单认知，再顺着导出跳转到感兴趣的源文件精读。
 */
// Core TUI interfaces and classes
// 核心 TUI 接口与类

// Autocomplete support
// 自动补全支持
export {
	type AutocompleteItem,
	type AutocompleteProvider,
	type AutocompleteSuggestions,
	CombinedAutocompleteProvider,
	type SlashCommand,
} from "./autocomplete.ts";
// Components
// 通用组件
export { Box } from "./components/box.ts";
export { CancellableLoader } from "./components/cancellable-loader.ts";
export { Editor, type EditorOptions, type EditorTheme } from "./components/editor.ts";
export { Image, type ImageOptions, type ImageTheme } from "./components/image.ts";
export { Input } from "./components/input.ts";
export { Loader, type LoaderIndicatorOptions } from "./components/loader.ts";
export { type DefaultTextStyle, Markdown, type MarkdownOptions, type MarkdownTheme } from "./components/markdown.ts";
export {
	type SelectItem,
	SelectList,
	type SelectListLayoutOptions,
	type SelectListTheme,
	type SelectListTruncatePrimaryContext,
} from "./components/select-list.ts";
export { type SettingItem, SettingsList, type SettingsListTheme } from "./components/settings-list.ts";
export { Spacer } from "./components/spacer.ts";
export { Text } from "./components/text.ts";
export { TruncatedText } from "./components/truncated-text.ts";
// Editor component interface (for custom editors)
// 编辑器组件接口（用于自定义编辑器）
export type { EditorComponent } from "./editor-component.ts";
// Fuzzy matching
// 模糊匹配
export { type FuzzyMatch, fuzzyFilter, fuzzyMatch } from "./fuzzy.ts";
// Keybindings
// 快捷键绑定
export {
	getKeybindings,
	type Keybinding,
	type KeybindingConflict,
	type KeybindingDefinition,
	type KeybindingDefinitions,
	type Keybindings,
	type KeybindingsConfig,
	KeybindingsManager,
	setKeybindings,
	TUI_KEYBINDINGS,
} from "./keybindings.ts";
// Keyboard input handling
// 键盘输入解析
export {
	decodeKittyPrintable,
	isKeyRelease,
	isKeyRepeat,
	isKittyProtocolActive,
	Key,
	type KeyEventType,
	type KeyId,
	matchesKey,
	parseKey,
	setKittyProtocolActive,
} from "./keys.ts";
// Input buffering for batch splitting
// stdin 输入缓冲与批量切分
export { StdinBuffer, type StdinBufferEventMap, type StdinBufferOptions } from "./stdin-buffer.ts";
// Terminal interface and implementations
// 终端接口与实现
export { ProcessTerminal, type Terminal } from "./terminal.ts";
// Terminal colors
// 终端颜色
export {
	parseOsc11BackgroundColor,
	parseTerminalColorSchemeReport,
	type RgbColor,
	type TerminalColorScheme,
} from "./terminal-colors.ts";
// Terminal image support
// 终端图片显示支持
export {
	allocateImageId,
	type CellDimensions,
	calculateImageRows,
	deleteAllKittyImages,
	deleteKittyImage,
	detectCapabilities,
	encodeITerm2,
	encodeKitty,
	getCapabilities,
	getCellDimensions,
	getGifDimensions,
	getImageDimensions,
	getJpegDimensions,
	getPngDimensions,
	getWebpDimensions,
	hyperlink,
	type ImageDimensions,
	type ImageProtocol,
	type ImageRenderOptions,
	imageFallback,
	renderImage,
	resetCapabilitiesCache,
	setCapabilities,
	setCellDimensions,
	type TerminalCapabilities,
} from "./terminal-image.ts";
// TUI 核心框架：组件契约、容器、覆盖层管理
export {
	type Component,
	Container,
	CURSOR_MARKER,
	type Focusable,
	isFocusable,
	type OverlayAnchor,
	type OverlayHandle,
	type OverlayMargin,
	type OverlayOptions,
	type OverlayUnfocusOptions,
	type SizeValue,
	TUI,
} from "./tui.ts";
// Utilities
// 文本工具函数
export { sliceByColumn, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "./utils.ts";
