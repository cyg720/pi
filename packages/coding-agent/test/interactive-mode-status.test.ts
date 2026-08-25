/**
 * 文件职责：验证 InteractiveMode 的状态消息、工具展开、主题持久化、自定义 UI 焦点、自动补全和资源展示。
 * 技术维度：使用 Vitest、虚拟终端、伪 this 对象与原型方法调用隔离测试大型交互模式的局部行为。
 * 产品维度：保证终端用户看到稳定状态、正确焦点与清晰资源列表，并让扩展自动补全和主题设置即时生效。
 * 逻辑维度：先定义渲染与焦点夹具，再按状态、主题、自定义界面、自动补全及资源标签分组测试。
 * 关键边界：大量用例绕过构造函数直接调用原型，伪对象字段必须与实现同步；快照还依赖路径平台和主题初始化。
 * 新手阅读建议：先读 TestFocusableComponent 和渲染辅助函数，再看短小状态用例，最后阅读资源标签与跨平台路径快照。
 */
import { homedir } from "node:os";
import * as path from "node:path";
import { type AutocompleteProvider, CombinedAutocompleteProvider } from "@earendil-works/pi-tui";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { type Component, Container, type Focusable, TUI } from "../../tui/src/tui.ts";
import { VirtualTerminal } from "../../tui/test/virtual-terminal.ts";
import type { AutocompleteProviderFactory } from "../src/core/extensions/types.ts";
import type { SourceInfo } from "../src/core/source-info.ts";
import type { AuthSelectorProvider } from "../src/modes/interactive/components/oauth-selector.ts";
import { InteractiveMode } from "../src/modes/interactive/interactive-mode.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";

/** renderLastLine 执行当前测试辅助步骤；参数 container、width  按签名提供输入，返回值供调用方断言。示例：renderLastLine(..., ...)。 */
function renderLastLine(container: Container, width = 120): string {
	/** 常量 last 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
	const last = container.children[container.children.length - 1];
	if (!last) return "";
	return last.render(width).join("\n");
}

/** renderAll 执行当前测试辅助步骤；参数 container、width  按签名提供输入，返回值供调用方断言。示例：renderAll(..., ...)。 */
function renderAll(container: Container, width = 120): string {
	return container.children.flatMap((child) => child.render(width)).join("\n");
}

/** TestFocusableComponent 模拟可聚焦输入组件，记录按键并提供可读写文本，供覆盖层焦点回归测试使用。 */
class TestFocusableComponent implements Component, Focusable {
	/** focused 表示当前组件是否持有输入焦点，由 TUI 更新。 */
	focused = false;
	/** inputs 保存组件收到的原始输入序列，仅供用例断言。 */
	inputs: string[] = [];
	/** label 是 render 返回的固定可见文本，构造后不变。 */
	private readonly label: string;
	/** text 保存组件的可编辑文本，初始为空字符串。 */
	private text = "";

	/** 初始化组件；参数 label 为显示标签，无返回值。例如：new TestFocusableComponent("EDITOR")。 */
	constructor(label: string) {
		this.label = label;
	}

	/** 记录输入；参数 data 为终端输入文本，无返回值。例如：component.handleInput("x")。 */
	handleInput(data: string): void {
		this.inputs.push(data);
	}

	/** 返回当前编辑文本；无参数。例如：component.getText()。 */
	getText(): string {
		return this.text;
	}

	/** 更新编辑文本；参数 text 为完整新内容，无返回值。例如：component.setText("value")。 */
	setText(text: string): void {
		this.text = text;
	}

	/** 返回固定标签行；无参数，返回单行字符串数组。例如：component.render()。 */
	render(): string[] {
		return [this.label];
	}

	/** 标记组件失效；本夹具没有缓存，因此无参数、无返回值。例如：component.invalidate()。 */
	invalidate(): void {}
}

/** flushTui 执行当前测试辅助步骤；参数 tui、terminal 按签名提供输入，返回值供调用方断言。示例：flushTui(..., ...)。 */
async function flushTui(tui: TUI, terminal: VirtualTerminal): Promise<void> {
	tui.requestRender(true);
	await Promise.resolve();
	await terminal.waitForRender();
}

/** normalizeRenderedOutput 执行当前测试辅助步骤；参数 container、width  按签名提供输入，返回值供调用方断言。示例：normalizeRenderedOutput(..., ...)。 */
function normalizeRenderedOutput(container: Container, width = 220): string {
	return renderAll(container, width)
		.replace(/\u001b\[[0-9;]*m/g, "")
		.replace(/\\/g, "/")
		.split("\n")
		.map((line) => line.replace(/\s+$/g, ""))
		.join("\n")
		.trim();
}

type ExtensionFixture = {
	path: string;
	sourceInfo?: SourceInfo;
};

// 用例分组：集中验证“InteractiveMode.showStatus”相关功能。
describe("InteractiveMode.showStatus", () => {
	beforeAll(() => {
		// showStatus uses the global theme instance
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		initTheme("dark");
	});

	// 测试场景：验证“coalesces immediately-sequential status messages”对应的行为、结果与边界。
	test("coalesces immediately-sequential status messages", () => {
		/** 常量 fakeThis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeThis: any = {
			chatContainer: new Container(),
			ui: { requestRender: vi.fn() },
			lastStatusSpacer: undefined,
			lastStatusText: undefined,
		};

		(InteractiveMode as any).prototype.showStatus.call(fakeThis, "STATUS_ONE");
		expect(fakeThis.chatContainer.children).toHaveLength(2);
		expect(renderLastLine(fakeThis.chatContainer)).toContain("STATUS_ONE");

		(InteractiveMode as any).prototype.showStatus.call(fakeThis, "STATUS_TWO");
		// second status updates the previous line instead of appending
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		expect(fakeThis.chatContainer.children).toHaveLength(2);
		expect(renderLastLine(fakeThis.chatContainer)).toContain("STATUS_TWO");
		expect(renderLastLine(fakeThis.chatContainer)).not.toContain("STATUS_ONE");
	});

	// 测试场景：验证“appends a new status line if something else was added in between”对应的行为、结果与边界。
	test("appends a new status line if something else was added in between", () => {
		/** 常量 fakeThis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeThis: any = {
			chatContainer: new Container(),
			ui: { requestRender: vi.fn() },
			lastStatusSpacer: undefined,
			lastStatusText: undefined,
		};

		(InteractiveMode as any).prototype.showStatus.call(fakeThis, "STATUS_ONE");
		expect(fakeThis.chatContainer.children).toHaveLength(2);

		// Something else gets added to the chat in between status updates
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		fakeThis.chatContainer.addChild({ render: () => ["OTHER"], invalidate: () => {} });
		expect(fakeThis.chatContainer.children).toHaveLength(3);

		(InteractiveMode as any).prototype.showStatus.call(fakeThis, "STATUS_TWO");
		// adds spacer + text
		// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
		expect(fakeThis.chatContainer.children).toHaveLength(5);
		expect(renderLastLine(fakeThis.chatContainer)).toContain("STATUS_TWO");
	});
});

// 用例分组：集中验证“InteractiveMode.setToolsExpanded”相关功能。
describe("InteractiveMode.setToolsExpanded", () => {
	// 测试场景：验证“applies expansion state to the active header and chat entries”对应的行为、结果与边界。
	test("applies expansion state to the active header and chat entries", () => {
		/** 常量 header 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const header = { setExpanded: vi.fn() };
		/** 常量 loadedResourcesChild 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const loadedResourcesChild = { setExpanded: vi.fn() };
		/** 常量 chatChild 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const chatChild = { setExpanded: vi.fn() };
		/** 常量 fakeThis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeThis: any = {
			toolOutputExpanded: false,
			customHeader: undefined,
			builtInHeader: header,
			loadedResourcesContainer: { children: [loadedResourcesChild] },
			chatContainer: { children: [chatChild] },
			ui: { requestRender: vi.fn() },
		};

		(InteractiveMode as any).prototype.setToolsExpanded.call(fakeThis, true);

		expect(fakeThis.toolOutputExpanded).toBe(true);
		expect(header.setExpanded).toHaveBeenCalledWith(true);
		expect(loadedResourcesChild.setExpanded).toHaveBeenCalledWith(true);
		expect(chatChild.setExpanded).toHaveBeenCalledWith(true);
		expect(fakeThis.ui.requestRender).toHaveBeenCalledTimes(1);
	});
});

// 用例分组：集中验证“InteractiveMode.createExtensionUIContext setTheme”相关功能。
describe("InteractiveMode.createExtensionUIContext setTheme", () => {
	// 测试场景：验证“persists theme changes to settings manager”对应的行为、结果与边界。
	test("persists theme changes to settings manager", () => {
		initTheme("dark");

		/** 变量 currentTheme 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		let currentTheme = "dark";
		/** 常量 settingsManager 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const settingsManager = {
			getTheme: vi.fn(() => currentTheme),
			setTheme: vi.fn((theme: string) => {
				currentTheme = theme;
			}),
		};
		/** 常量 fakeThis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeThis: any = {
			session: { settingsManager },
			settingsManager,
			themeController: {
				setThemeInstance: vi.fn(() => ({ success: true })),
				setThemeName: vi.fn(() => {
					fakeThis.ui.requestRender();
					return { success: true };
				}),
			},
			ui: { requestRender: vi.fn() },
		};

		/** 常量 uiContext 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const uiContext = (InteractiveMode as any).prototype.createExtensionUIContext.call(fakeThis);
		/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const result = uiContext.setTheme("light");

		expect(result.success).toBe(true);
		expect(fakeThis.themeController.setThemeName).toHaveBeenCalledWith("light");
		expect(settingsManager.setTheme).toHaveBeenCalledWith("light");
		expect(currentTheme).toBe("light");
		expect(fakeThis.ui.requestRender).toHaveBeenCalledTimes(1);
	});

	// 测试场景：验证“does not persist invalid theme names”对应的行为、结果与边界。
	test("does not persist invalid theme names", () => {
		initTheme("dark");

		/** 常量 settingsManager 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const settingsManager = {
			getTheme: vi.fn(() => "dark"),
			setTheme: vi.fn(),
		};
		/** 常量 fakeThis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeThis: any = {
			session: { settingsManager },
			settingsManager,
			themeController: {
				setThemeInstance: vi.fn(() => ({ success: true })),
				setThemeName: vi.fn(() => ({ success: false, error: "Theme not found" })),
			},
			ui: { requestRender: vi.fn() },
		};

		/** 常量 uiContext 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const uiContext = (InteractiveMode as any).prototype.createExtensionUIContext.call(fakeThis);
		/** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const result = uiContext.setTheme("__missing_theme__");

		expect(result.success).toBe(false);
		expect(fakeThis.themeController.setThemeName).toHaveBeenCalledWith("__missing_theme__");
		expect(settingsManager.setTheme).not.toHaveBeenCalled();
		expect(fakeThis.ui.requestRender).not.toHaveBeenCalled();
	});
});

// 用例分组：集中验证“InteractiveMode.showExtensionCustom”相关功能。
describe("InteractiveMode.showExtensionCustom", () => {
	beforeAll(() => {
		initTheme("dark");
	});

	// 测试场景：验证“overlay custom UI reclaims input after non-overlay custom UI closes”对应的行为、结果与边界。
	test("overlay custom UI reclaims input after non-overlay custom UI closes", async () => {
		/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const terminal = new VirtualTerminal(80, 24);
		/** 常量 ui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const ui = new TUI(terminal);
		/** 常量 editorContainer 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const editorContainer = new Container();
		/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const editor = new TestFocusableComponent("EDITOR");
		/** 常量 palette 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const palette = new TestFocusableComponent("PALETTE");
		/** 常量 overlay 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const overlay = new TestFocusableComponent("OVERLAY");
		/** 常量 replacement 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const replacement = new TestFocusableComponent("REPLACEMENT");
		/** closeOverlay 是稍后由覆盖层回调赋值的关闭函数；参数 value 为关闭结果，无返回值。 */
		let closeOverlay: (value: string) => void = () => {
			throw new Error("closeOverlay was not initialized");
		};
		/** closeReplacement 是替换覆盖层的关闭函数；参数 value 为关闭结果，无返回值。 */
		let closeReplacement: (value: string) => void = () => {
			throw new Error("closeReplacement was not initialized");
		};
		/** 常量 fakeThis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeThis = {
			editor,
			editorContainer,
			keybindings: {},
			ui,
		};
		/** 常量 showExtensionCustom 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const showExtensionCustom = <T>(
			factory: (tui: TUI, theme: unknown, keybindings: unknown, done: (result: T) => void) => Component,
			options?: { overlay?: boolean },
		): Promise<T> =>
			(InteractiveMode as any).prototype.showExtensionCustom.call(fakeThis, factory, options) as Promise<T>;

		editorContainer.addChild(editor);
		ui.addChild(editorContainer);
		ui.addChild(palette);
		ui.setFocus(palette);
		ui.start();
		try {
			/** 常量 overlayPromise 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const overlayPromise = showExtensionCustom<string>(
				(_tui, _theme, _keybindings, done) => {
					closeOverlay = done;
					return overlay;
				},
				{ overlay: true },
			);
			await flushTui(ui, terminal);
			expect(overlay.focused).toBe(true);

			/** 常量 replacementPromise 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const replacementPromise = showExtensionCustom<string>((_tui, _theme, _keybindings, done) => {
				closeReplacement = done;
				return replacement;
			});
			await flushTui(ui, terminal);
			expect(replacement.focused).toBe(true);

			closeReplacement("done");
			await replacementPromise;
			await flushTui(ui, terminal);
			terminal.sendInput("x");
			await flushTui(ui, terminal);

			expect(overlay.inputs).toEqual(["x"]);
			expect(editor.inputs).toEqual([]);
			expect(overlay.focused).toBe(true);

			closeOverlay("closed");
			await overlayPromise;
		} finally {
			ui.stop();
		}
	});
});

// 用例分组：集中验证“InteractiveMode.createExtensionUIContext addAutocompleteProvider”相关功能。
describe("InteractiveMode.createExtensionUIContext addAutocompleteProvider", () => {
	// 测试场景：验证“stores wrapper factories and rebuilds autocomplete immediately”对应的行为、结果与边界。
	test("stores wrapper factories and rebuilds autocomplete immediately", () => {
		/** wrapper 封装当前回调或辅助步骤；参数 current 提供输入，返回值用于后续流程。示例：wrapper(...)。 */
		const wrapper: AutocompleteProviderFactory = (current) => current;
		/** 常量 fakeThis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeThis = {
			autocompleteProviderWrappers: [] as AutocompleteProviderFactory[],
			setupAutocompleteProvider: vi.fn(),
		};

		/** 常量 uiContext 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const uiContext = (InteractiveMode as any).prototype.createExtensionUIContext.call(fakeThis);
		uiContext.addAutocompleteProvider(wrapper);

		expect(fakeThis.autocompleteProviderWrappers).toEqual([wrapper]);
		expect(fakeThis.setupAutocompleteProvider).toHaveBeenCalledTimes(1);
	});
});

// 用例分组：集中验证“InteractiveMode.setupAutocompleteProvider”相关功能。
describe("InteractiveMode.setupAutocompleteProvider", () => {
	// 测试场景：验证“stacks wrapper factories over a fresh base provider”对应的行为、结果与边界。
	test("stacks wrapper factories over a fresh base provider", () => {
		/** 常量 defaultEditor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const defaultEditor = { setAutocompleteProvider: vi.fn() };
		/** 常量 customEditor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const customEditor = { setAutocompleteProvider: vi.fn() };
		/** 常量 calls 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const calls: string[] = [];

		/** 常量 wrap1 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const wrap1: AutocompleteProviderFactory = (current): AutocompleteProvider => ({
			/** 记录第一层调用后转发建议查询；参数为文本行、光标位置和选项，返回当前提供者的建议。 */
			async getSuggestions(lines, cursorLine, cursorCol, options) {
				calls.push("getSuggestions:wrap1");
				return current.getSuggestions(lines, cursorLine, cursorCol, options);
			},
			/** 记录第一层调用后转发补全应用；参数描述编辑位置、候选项和前缀，返回更新后的文本与光标。 */
			applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
				calls.push("applyCompletion:wrap1");
				return current.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
			},
			/** 记录第一层调用后判断是否触发文件补全；参数为文本行和光标位置，返回布尔值。 */
			shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
				calls.push("shouldTrigger:wrap1");
				return current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? true;
			},
		});
		/** 常量 wrap2 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const wrap2: AutocompleteProviderFactory = (current): AutocompleteProvider => ({
			/** 记录第二层调用后转发建议查询；参数为文本行、光标位置和选项，返回当前提供者的建议。 */
			async getSuggestions(lines, cursorLine, cursorCol, options) {
				calls.push("getSuggestions:wrap2");
				return current.getSuggestions(lines, cursorLine, cursorCol, options);
			},
			/** 记录第二层调用后转发补全应用；参数描述编辑位置、候选项和前缀，返回更新后的文本与光标。 */
			applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
				calls.push("applyCompletion:wrap2");
				return current.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
			},
			/** 记录第二层调用后判断是否触发文件补全；参数为文本行和光标位置，返回布尔值。 */
			shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
				calls.push("shouldTrigger:wrap2");
				return current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? true;
			},
		});

		/** 常量 fakeThis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeThis = {
			createBaseAutocompleteProvider: () => new CombinedAutocompleteProvider([], "/tmp/project", undefined),
			defaultEditor,
			editor: customEditor,
			autocompleteProviderWrappers: [wrap1, wrap2],
		};

		(InteractiveMode as any).prototype.setupAutocompleteProvider.call(fakeThis);

		expect(defaultEditor.setAutocompleteProvider).toHaveBeenCalledTimes(1);
		expect(customEditor.setAutocompleteProvider).toHaveBeenCalledTimes(1);
		/** 常量 provider 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const provider = defaultEditor.setAutocompleteProvider.mock.calls[0]?.[0] as AutocompleteProvider;
		expect(provider).toBe(customEditor.setAutocompleteProvider.mock.calls[0]?.[0]);
		expect(provider.shouldTriggerFileCompletion?.(["foo"], 0, 3)).toBe(true);
		expect(calls).toEqual(["shouldTrigger:wrap2", "shouldTrigger:wrap1"]);
	});

	// 测试场景：验证“merges triggerCharacters from wrapper factories”对应的行为、结果与边界。
	test("merges triggerCharacters from wrapper factories", () => {
		/** 常量 defaultEditor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const defaultEditor = { setAutocompleteProvider: vi.fn() };
		/** 常量 customEditor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const customEditor = { setAutocompleteProvider: vi.fn() };
		/** 常量 passThrough 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const passThrough =
			(triggerCharacters: string[]): AutocompleteProviderFactory =>
			(current) => ({
				triggerCharacters,
				getSuggestions: (lines, cursorLine, cursorCol, options) =>
					current.getSuggestions(lines, cursorLine, cursorCol, options),
				applyCompletion: (lines, cursorLine, cursorCol, item, prefix) =>
					current.applyCompletion(lines, cursorLine, cursorCol, item, prefix),
			});

		/** 常量 fakeThis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeThis = {
			createBaseAutocompleteProvider: () => new CombinedAutocompleteProvider([], "/tmp/project", undefined),
			defaultEditor,
			editor: customEditor,
			autocompleteProviderWrappers: [passThrough(["$"]), passThrough(["!"])],
		};

		(
			InteractiveMode as unknown as {
				prototype: { setupAutocompleteProvider: (this: typeof fakeThis) => void };
			}
		).prototype.setupAutocompleteProvider.call(fakeThis);

		/** 常量 provider 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const provider = defaultEditor.setAutocompleteProvider.mock.calls[0]?.[0] as AutocompleteProvider;
		expect(provider.triggerCharacters).toEqual(["$", "!"]);
	});
});

// 用例分组：集中验证“InteractiveMode.createBaseAutocompleteProvider”相关功能。
describe("InteractiveMode.createBaseAutocompleteProvider", () => {
	// 测试场景：验证“matches model command arguments across provider/model order”对应的行为、结果与边界。
	test("matches model command arguments across provider/model order", async () => {
		type TestModel = { id: string; provider: string; name: string };
		type FakeInteractiveMode = {
			session: {
				scopedModels: Array<{ model: TestModel }>;
				modelRuntime: { getAvailable: () => TestModel[] };
				promptTemplates: [];
				extensionRunner: { getRegisteredCommands: () => [] };
				resourceLoader: { getSkills: () => { skills: [] } };
			};
			settingsManager: { getEnableSkillCommands: () => boolean };
			skillCommands: Map<string, string>;
			sessionManager: { getCwd: () => string };
			fdPath: null;
		};

		/** 常量 createBaseAutocompleteProvider 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const createBaseAutocompleteProvider = (
			InteractiveMode as unknown as {
				prototype: { createBaseAutocompleteProvider(this: FakeInteractiveMode): AutocompleteProvider };
			}
		).prototype.createBaseAutocompleteProvider;
		/** 常量 models 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const models = [
			{ id: "gpt-5.2-codex", provider: "github-copilot", name: "GPT-5.2 Codex" },
			{ id: "gpt-5.5", provider: "openai-codex", name: "GPT-5.5" },
		];
		/** 常量 fakeThis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeThis: FakeInteractiveMode = {
			session: {
				scopedModels: [],
				modelRuntime: { getAvailable: () => models },
				promptTemplates: [],
				extensionRunner: { getRegisteredCommands: () => [] },
				resourceLoader: { getSkills: () => ({ skills: [] }) },
			},
			settingsManager: { getEnableSkillCommands: () => false },
			skillCommands: new Map(),
			sessionManager: { getCwd: () => "/tmp" },
			fdPath: null,
		};

		/** 常量 provider 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const provider = createBaseAutocompleteProvider.call(fakeThis);
		/** 常量 line 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const line = "/model codexgpt";
		/** 常量 suggestions 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const suggestions = await provider.getSuggestions([line], 0, line.length, {
			signal: new AbortController().signal,
		});

		expect(suggestions?.items.map((item) => item.value)).toEqual([
			"openai-codex/gpt-5.5",
			"github-copilot/gpt-5.2-codex",
		]);
	});

	// 测试场景：验证“matches login command arguments by provider id and name”对应的行为、结果与边界。
	test("matches login command arguments by provider id and name", async () => {
		type FakeInteractiveMode = {
			session: {
				scopedModels: [];
				modelRuntime: { getAvailable: () => [] };
				promptTemplates: [];
				extensionRunner: { getRegisteredCommands: () => [] };
				resourceLoader: { getSkills: () => { skills: [] } };
			};
			settingsManager: { getEnableSkillCommands: () => boolean };
			skillCommands: Map<string, string>;
			sessionManager: { getCwd: () => string };
			fdPath: null;
			getLoginProviderOptions: () => AuthSelectorProvider[];
		};

		/** 常量 createBaseAutocompleteProvider 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const createBaseAutocompleteProvider = (
			InteractiveMode as unknown as {
				prototype: { createBaseAutocompleteProvider(this: FakeInteractiveMode): AutocompleteProvider };
			}
		).prototype.createBaseAutocompleteProvider;
		/** 常量 fakeThis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeThis: FakeInteractiveMode = {
			session: {
				scopedModels: [],
				modelRuntime: { getAvailable: () => [] },
				promptTemplates: [],
				extensionRunner: { getRegisteredCommands: () => [] },
				resourceLoader: { getSkills: () => ({ skills: [] }) },
			},
			settingsManager: { getEnableSkillCommands: () => false },
			skillCommands: new Map(),
			sessionManager: { getCwd: () => "/tmp" },
			fdPath: null,
			getLoginProviderOptions: () => [
				{ id: "anthropic", name: "Anthropic", authType: "oauth" },
				{ id: "anthropic", name: "Anthropic", authType: "api_key" },
				{ id: "openai", name: "OpenAI", authType: "api_key" },
			],
		};

		/** 常量 provider 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const provider = createBaseAutocompleteProvider.call(fakeThis);
		/** 常量 line 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const line = "/login subscription anthrop";
		/** 常量 suggestions 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const suggestions = await provider.getSuggestions([line], 0, line.length, {
			signal: new AbortController().signal,
		});

		expect(suggestions?.items).toEqual([
			{
				value: "anthropic",
				label: "anthropic",
				description: "Anthropic · subscription/API key",
			},
		]);
	});
});
// 用例分组：集中验证“InteractiveMode.showLoadedResources”相关功能。
describe("InteractiveMode.showLoadedResources", () => {
	beforeAll(() => {
		initTheme("dark");
	});

	/** createShowLoadedResourcesThis 执行当前测试辅助步骤；参数 options 按签名提供输入，返回值供调用方断言。示例：createShowLoadedResourcesThis(...)。 */
	function createShowLoadedResourcesThis(options: {
		quietStartup: boolean;
		verbose?: boolean;
		toolOutputExpanded?: boolean;
		cwd?: string;
		contextFiles?: Array<{ path: string; content?: string }>;
		extensions?: ExtensionFixture[];
		skills?: Array<{ filePath: string; name: string }>;
		skillDiagnostics?: Array<{ type: "warning" | "error" | "collision"; message: string }>;
		useRealScopeGroups?: boolean;
	}) {
		/** 常量 fakeThis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeThis: any = {
			options: { verbose: options.verbose ?? false },
			toolOutputExpanded: options.toolOutputExpanded ?? false,
			loadedResourcesContainer: new Container(),
			chatContainer: new Container(),
			settingsManager: {
				getQuietStartup: () => options.quietStartup,
			},
			sessionManager: {
				getCwd: () => options.cwd ?? "/tmp/project",
			},
			session: {
				promptTemplates: [],
				extensionRunner: {
					getCommandDiagnostics: () => [],
					getShortcutDiagnostics: () => [],
				},
				resourceLoader: {
					getPathMetadata: () => new Map(),
					getAgentsFiles: () => ({ agentsFiles: options.contextFiles ?? [] }),
					getSkills: () => ({
						skills: options.skills ?? [],
						diagnostics: options.skillDiagnostics ?? [],
					}),
					getPrompts: () => ({ prompts: [], diagnostics: [] }),
					getExtensions: () => ({ extensions: options.extensions ?? [], errors: [], runtime: {} }),
					getThemes: () => ({ themes: [], diagnostics: [] }),
				},
			},
			formatDisplayPath: (p: string) => (InteractiveMode as any).prototype.formatDisplayPath.call(fakeThis, p),
			formatExtensionDisplayPath: (p: string) =>
				(InteractiveMode as any).prototype.formatExtensionDisplayPath.call(fakeThis, p),
			formatContextPath: (p: string) => (InteractiveMode as any).prototype.formatContextPath.call(fakeThis, p),
			getStartupExpansionState: () => (InteractiveMode as any).prototype.getStartupExpansionState.call(fakeThis),
			buildScopeGroups: () => [],
			formatScopeGroups: () => "resource-list",
			isPackageSource: (sourceInfo?: SourceInfo) =>
				(InteractiveMode as any).prototype.isPackageSource.call(fakeThis, sourceInfo),
			getShortPath: (p: string, sourceInfo?: SourceInfo) =>
				(InteractiveMode as any).prototype.getShortPath.call(fakeThis, p, sourceInfo),
			getCompactPathLabel: (p: string, sourceInfo?: SourceInfo) =>
				(InteractiveMode as any).prototype.getCompactPathLabel.call(fakeThis, p, sourceInfo),
			getCompactPackageSourceLabel: (sourceInfo?: SourceInfo) =>
				(InteractiveMode as any).prototype.getCompactPackageSourceLabel.call(fakeThis, sourceInfo),
			getCompactExtensionLabel: (p: string, sourceInfo?: SourceInfo) =>
				(InteractiveMode as any).prototype.getCompactExtensionLabel.call(fakeThis, p, sourceInfo),
			getCompactDisplayPathSegments: (p: string) =>
				(InteractiveMode as any).prototype.getCompactDisplayPathSegments.call(fakeThis, p),
			getCompactNonPackageExtensionLabel: (
				p: string,
				index: number,
				allPaths: Array<{ path: string; segments: string[] }>,
			) => (InteractiveMode as any).prototype.getCompactNonPackageExtensionLabel.call(fakeThis, p, index, allPaths),
			getCompactExtensionLabels: (extensions: ExtensionFixture[]) =>
				(InteractiveMode as any).prototype.getCompactExtensionLabels.call(fakeThis, extensions),
			formatDiagnostics: () => "diagnostics",
			getBuiltInCommandConflictDiagnostics: () => [],
		};

		if (options.useRealScopeGroups) {
			fakeThis.getScopeGroup = (sourceInfo?: SourceInfo) =>
				(InteractiveMode as any).prototype.getScopeGroup.call(fakeThis, sourceInfo);
			fakeThis.buildScopeGroups = (items: Array<{ path: string; sourceInfo?: SourceInfo }>) =>
				(InteractiveMode as any).prototype.buildScopeGroups.call(fakeThis, items);
			fakeThis.formatScopeGroups = (groups: unknown, formatOptions: unknown) =>
				(InteractiveMode as any).prototype.formatScopeGroups.call(fakeThis, groups, formatOptions);
		}

		return fakeThis;
	}

	/** createSourceInfo 执行当前测试辅助步骤；参数 无 按签名提供输入，返回值供调用方断言。示例：createSourceInfo()。 */
	function createSourceInfo(
		filePath: string,
		options: {
			source: string;
			scope: "user" | "project" | "temporary";
			origin: "package" | "top-level";
			baseDir?: string;
		},
	): SourceInfo {
		return {
			path: filePath,
			source: options.source,
			scope: options.scope,
			origin: options.origin,
			baseDir: options.baseDir,
		};
	}

	/** createExtensionFixtures 执行当前测试辅助步骤；参数 无 按签名提供输入，返回值供调用方断言。示例：createExtensionFixtures()。 */
	function createExtensionFixtures(): ExtensionFixture[] {
		return [
			{
				path: "/tmp/project/.pi/extensions/answer.ts",
				sourceInfo: createSourceInfo("/tmp/project/.pi/extensions/answer.ts", {
					source: "local",
					scope: "project",
					origin: "top-level",
					baseDir: "/tmp/project/.pi/extensions",
				}),
			},
			{
				path: "/tmp/project/.pi/extensions/local-index/index.ts",
				sourceInfo: createSourceInfo("/tmp/project/.pi/extensions/local-index/index.ts", {
					source: "local",
					scope: "project",
					origin: "top-level",
					baseDir: "/tmp/project/.pi/extensions",
				}),
			},
			{
				path: "/tmp/agent/extensions/user-index/index.ts",
				sourceInfo: createSourceInfo("/tmp/agent/extensions/user-index/index.ts", {
					source: "local",
					scope: "user",
					origin: "top-level",
					baseDir: "/tmp/agent/extensions",
				}),
			},
			{
				path: "/tmp/project/.pi/npm/node_modules/pi-markdown-preview/extensions/index.ts",
				sourceInfo: createSourceInfo("/tmp/project/.pi/npm/node_modules/pi-markdown-preview/extensions/index.ts", {
					source: "npm:pi-markdown-preview",
					scope: "project",
					origin: "package",
					baseDir: "/tmp/project/.pi/npm/node_modules/pi-markdown-preview",
				}),
			},
			{
				path: "/tmp/project/.pi/npm/node_modules/@scope/pi-scoped/extensions/index.ts",
				sourceInfo: createSourceInfo("/tmp/project/.pi/npm/node_modules/@scope/pi-scoped/extensions/index.ts", {
					source: "npm:@scope/pi-scoped",
					scope: "project",
					origin: "package",
					baseDir: "/tmp/project/.pi/npm/node_modules/@scope/pi-scoped",
				}),
			},
			{
				path: "/tmp/project/.pi/git/github.com/HazAT/pi-interactive-subagents/extensions/index.ts",
				sourceInfo: createSourceInfo(
					"/tmp/project/.pi/git/github.com/HazAT/pi-interactive-subagents/extensions/index.ts",
					{
						source: "git:github.com/HazAT/pi-interactive-subagents",
						scope: "project",
						origin: "package",
						baseDir: "/tmp/project/.pi/git/github.com/HazAT/pi-interactive-subagents",
					},
				),
			},
			{
				path: "/tmp/project/.pi/git/github.com/HazAT/pi-interactive-subagents/extensions/subagents/index.ts",
				sourceInfo: createSourceInfo(
					"/tmp/project/.pi/git/github.com/HazAT/pi-interactive-subagents/extensions/subagents/index.ts",
					{
						source: "git:github.com/HazAT/pi-interactive-subagents",
						scope: "project",
						origin: "package",
						baseDir: "/tmp/project/.pi/git/github.com/HazAT/pi-interactive-subagents",
					},
				),
			},
			{
				path: "/tmp/temp/cli-extension.ts",
				sourceInfo: createSourceInfo("/tmp/temp/cli-extension.ts", {
					source: "cli",
					scope: "temporary",
					origin: "top-level",
					baseDir: "/tmp/temp",
				}),
			},
		];
	}

	// 测试场景：验证“shows a compact resource listing by default”对应的行为、结果与边界。
	test("shows a compact resource listing by default", () => {
		/** 常量 fakeThis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeThis = createShowLoadedResourcesThis({
			quietStartup: false,
			skills: [{ filePath: "/tmp/skill/SKILL.md", name: "commit" }],
		});

		(InteractiveMode as any).prototype.showLoadedResources.call(fakeThis, {
			force: false,
		});

		/** 常量 output 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const output = renderAll(fakeThis.loadedResourcesContainer);
		expect(output).toContain("[Skills]");
		expect(output).toContain("commit");
		expect(output).not.toContain("resource-list");
	});

	// 测试场景：验证“shows full resource listing when expanded”对应的行为、结果与边界。
	test("shows full resource listing when expanded", () => {
		/** 常量 fakeThis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeThis = createShowLoadedResourcesThis({
			quietStartup: false,
			toolOutputExpanded: true,
			skills: [{ filePath: "/tmp/skill/SKILL.md", name: "commit" }],
		});

		(InteractiveMode as any).prototype.showLoadedResources.call(fakeThis, {
			force: false,
		});

		/** 常量 output 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const output = renderAll(fakeThis.loadedResourcesContainer);
		expect(output).toContain("[Skills]");
		expect(output).toContain("resource-list");
		expect(output).not.toContain("commit");
	});

	// 测试场景：验证“shows full resource listing on verbose startup even when tool output is collapsed”对应的行为、结果与边界。
	test("shows full resource listing on verbose startup even when tool output is collapsed", () => {
		/** 常量 fakeThis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeThis = createShowLoadedResourcesThis({
			quietStartup: true,
			verbose: true,
			toolOutputExpanded: false,
			skills: [{ filePath: "/tmp/skill/SKILL.md", name: "commit" }],
		});

		(InteractiveMode as any).prototype.showLoadedResources.call(fakeThis, {
			force: false,
		});

		/** 常量 output 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const output = renderAll(fakeThis.loadedResourcesContainer);
		expect(output).toContain("[Skills]");
		expect(output).toContain("resource-list");
		expect(output).not.toContain("commit");
	});

	// 测试场景：验证“abbreviates extensions in compact listing”对应的行为、结果与边界。
	test("abbreviates extensions in compact listing", () => {
		/** 常量 fakeThis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeThis = createShowLoadedResourcesThis({
			quietStartup: false,
			extensions: [{ path: "/tmp/extensions/answer.ts" }, { path: "/tmp/extensions/btw.ts" }],
		});

		(InteractiveMode as any).prototype.showLoadedResources.call(fakeThis, {
			force: false,
		});

		/** 常量 output 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const output = renderAll(fakeThis.loadedResourcesContainer);
		expect(output).toContain("[Extensions]");
		expect(output).toContain("answer.ts, btw.ts");
		expect(output).not.toContain("extensions/answer.ts");
	});

	// 测试场景：验证“captures mixed extension layouts in compact output”对应的行为、结果与边界。
	test("captures mixed extension layouts in compact output", () => {
		/** 常量 fakeThis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeThis = createShowLoadedResourcesThis({
			quietStartup: false,
			extensions: createExtensionFixtures(),
			useRealScopeGroups: true,
		});

		(InteractiveMode as any).prototype.showLoadedResources.call(fakeThis, {
			force: false,
		});

		expect(normalizeRenderedOutput(fakeThis.loadedResourcesContainer)).toMatchInlineSnapshot(`
"[Extensions]
  @scope/pi-scoped, answer.ts, cli-extension.ts, HazAT/pi-interactive-subagents, HazAT/pi-interactive-subagents:subagents, local-index, pi-markdown-preview, user-index"`);
	});

	// 测试场景：验证“adds more parent folders until local extension labels are unique”对应的行为、结果与边界。
	test("adds more parent folders until local extension labels are unique", () => {
		/** 常量 extensions 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const extensions: ExtensionFixture[] = [
			{
				path: "/tmp/alpha/one/index.ts",
				sourceInfo: createSourceInfo("/tmp/alpha/one/index.ts", {
					source: "cli",
					scope: "temporary",
					origin: "top-level",
					baseDir: "/tmp/alpha",
				}),
			},
			{
				path: "/tmp/beta/one/index.ts",
				sourceInfo: createSourceInfo("/tmp/beta/one/index.ts", {
					source: "cli",
					scope: "temporary",
					origin: "top-level",
					baseDir: "/tmp/beta",
				}),
			},
			{
				path: "/tmp/gamma/one/index.ts",
				sourceInfo: createSourceInfo("/tmp/gamma/one/index.ts", {
					source: "cli",
					scope: "temporary",
					origin: "top-level",
					baseDir: "/tmp/gamma",
				}),
			},
		];

		/** 常量 fakeThis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeThis = createShowLoadedResourcesThis({
			quietStartup: false,
			extensions,
			useRealScopeGroups: true,
		});

		(InteractiveMode as any).prototype.showLoadedResources.call(fakeThis, {
			force: false,
		});

		expect(normalizeRenderedOutput(fakeThis.loadedResourcesContainer)).toMatchInlineSnapshot(`
"[Extensions]
  alpha/one, beta/one, gamma/one"`);
	});

	// 测试场景：验证“strips index.ts from local extension label, showing parent dir”对应的行为、结果与边界。
	test("strips index.ts from local extension label, showing parent dir", () => {
		/** 常量 extensions 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const extensions: ExtensionFixture[] = [
			{
				path: "/tmp/extensions/plan-mode/index.ts",
				sourceInfo: createSourceInfo("/tmp/extensions/plan-mode/index.ts", {
					source: "local",
					scope: "project",
					origin: "top-level",
					baseDir: "/tmp/extensions",
				}),
			},
		];

		/** 常量 fakeThis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeThis = createShowLoadedResourcesThis({
			quietStartup: false,
			extensions,
			useRealScopeGroups: true,
		});

		(InteractiveMode as any).prototype.showLoadedResources.call(fakeThis, {
			force: false,
		});

		expect(normalizeRenderedOutput(fakeThis.loadedResourcesContainer)).toMatchInlineSnapshot(`
"[Extensions]
  plan-mode"`);
	});

	// 测试场景：验证“strips index.js from local extension label, showing parent dir”对应的行为、结果与边界。
	test("strips index.js from local extension label, showing parent dir", () => {
		/** 常量 extensions 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const extensions: ExtensionFixture[] = [
			{
				path: "/tmp/extensions/plan-mode/index.js",
				sourceInfo: createSourceInfo("/tmp/extensions/plan-mode/index.js", {
					source: "local",
					scope: "project",
					origin: "top-level",
					baseDir: "/tmp/extensions",
				}),
			},
		];

		/** 常量 fakeThis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeThis = createShowLoadedResourcesThis({
			quietStartup: false,
			extensions,
			useRealScopeGroups: true,
		});

		(InteractiveMode as any).prototype.showLoadedResources.call(fakeThis, {
			force: false,
		});

		expect(normalizeRenderedOutput(fakeThis.loadedResourcesContainer)).toMatchInlineSnapshot(`
"[Extensions]
  plan-mode"`);
	});

	// 测试场景：验证“mixed single-file and subdirectory index.ts extensions strip index.ts”对应的行为、结果与边界。
	test("mixed single-file and subdirectory index.ts extensions strip index.ts", () => {
		/** 常量 extensions 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const extensions: ExtensionFixture[] = [
			{
				path: "/tmp/extensions/webfetch.ts",
				sourceInfo: createSourceInfo("/tmp/extensions/webfetch.ts", {
					source: "local",
					scope: "project",
					origin: "top-level",
					baseDir: "/tmp/extensions",
				}),
			},
			{
				path: "/tmp/extensions/plan-mode/index.ts",
				sourceInfo: createSourceInfo("/tmp/extensions/plan-mode/index.ts", {
					source: "local",
					scope: "project",
					origin: "top-level",
					baseDir: "/tmp/extensions",
				}),
			},
		];

		/** 常量 fakeThis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeThis = createShowLoadedResourcesThis({
			quietStartup: false,
			extensions,
			useRealScopeGroups: true,
		});

		(InteractiveMode as any).prototype.showLoadedResources.call(fakeThis, {
			force: false,
		});

		expect(normalizeRenderedOutput(fakeThis.loadedResourcesContainer)).toMatchInlineSnapshot(`
"[Extensions]
  plan-mode, webfetch.ts"`);
	});

	// 测试场景：验证“multiple index.ts with unique parent dirs need no disambiguation”对应的行为、结果与边界。
	test("multiple index.ts with unique parent dirs need no disambiguation", () => {
		/** 常量 extensions 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const extensions: ExtensionFixture[] = [
			{
				path: "/tmp/extensions/foo/index.ts",
				sourceInfo: createSourceInfo("/tmp/extensions/foo/index.ts", {
					source: "local",
					scope: "project",
					origin: "top-level",
					baseDir: "/tmp/extensions",
				}),
			},
			{
				path: "/tmp/extensions/bar/index.ts",
				sourceInfo: createSourceInfo("/tmp/extensions/bar/index.ts", {
					source: "local",
					scope: "project",
					origin: "top-level",
					baseDir: "/tmp/extensions",
				}),
			},
		];

		/** 常量 fakeThis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeThis = createShowLoadedResourcesThis({
			quietStartup: false,
			extensions,
			useRealScopeGroups: true,
		});

		(InteractiveMode as any).prototype.showLoadedResources.call(fakeThis, {
			force: false,
		});

		expect(normalizeRenderedOutput(fakeThis.loadedResourcesContainer)).toMatchInlineSnapshot(`
"[Extensions]
  bar, foo"`);
	});

	// 测试场景：验证“multiple index.ts with same parent dir name disambiguated with grandparent”对应的行为、结果与边界。
	test("multiple index.ts with same parent dir name disambiguated with grandparent", () => {
		/** 常量 extensions 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const extensions: ExtensionFixture[] = [
			{
				path: "/tmp/alpha/tools/index.ts",
				sourceInfo: createSourceInfo("/tmp/alpha/tools/index.ts", {
					source: "cli",
					scope: "temporary",
					origin: "top-level",
					baseDir: "/tmp/alpha",
				}),
			},
			{
				path: "/tmp/beta/tools/index.ts",
				sourceInfo: createSourceInfo("/tmp/beta/tools/index.ts", {
					source: "cli",
					scope: "temporary",
					origin: "top-level",
					baseDir: "/tmp/beta",
				}),
			},
		];

		/** 常量 fakeThis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeThis = createShowLoadedResourcesThis({
			quietStartup: false,
			extensions,
			useRealScopeGroups: true,
		});

		(InteractiveMode as any).prototype.showLoadedResources.call(fakeThis, {
			force: false,
		});

		expect(normalizeRenderedOutput(fakeThis.loadedResourcesContainer)).toMatchInlineSnapshot(`
"[Extensions]
  alpha/tools, beta/tools"`);
	});

	// 测试场景：验证“non-index file in subdirectory stays as filename”对应的行为、结果与边界。
	test("non-index file in subdirectory stays as filename", () => {
		/** 常量 extensions 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const extensions: ExtensionFixture[] = [
			{
				path: "/tmp/extensions/my-ext/main.ts",
				sourceInfo: createSourceInfo("/tmp/extensions/my-ext/main.ts", {
					source: "local",
					scope: "project",
					origin: "top-level",
					baseDir: "/tmp/extensions",
				}),
			},
		];

		/** 常量 fakeThis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeThis = createShowLoadedResourcesThis({
			quietStartup: false,
			extensions,
			useRealScopeGroups: true,
		});

		(InteractiveMode as any).prototype.showLoadedResources.call(fakeThis, {
			force: false,
		});

		expect(normalizeRenderedOutput(fakeThis.loadedResourcesContainer)).toMatchInlineSnapshot(`
"[Extensions]
  main.ts"`);
	});

	// 测试场景：验证“package extensions still strip index.ts correctly (regression guard)”对应的行为、结果与边界。
	test("package extensions still strip index.ts correctly (regression guard)", () => {
		/** 常量 extensions 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const extensions: ExtensionFixture[] = [
			{
				path: "/tmp/project/.pi/npm/node_modules/pi-markdown-preview/extensions/index.ts",
				sourceInfo: createSourceInfo("/tmp/project/.pi/npm/node_modules/pi-markdown-preview/extensions/index.ts", {
					source: "npm:pi-markdown-preview",
					scope: "project",
					origin: "package",
					baseDir: "/tmp/project/.pi/npm/node_modules/pi-markdown-preview",
				}),
			},
		];

		/** 常量 fakeThis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeThis = createShowLoadedResourcesThis({
			quietStartup: false,
			extensions,
			useRealScopeGroups: true,
		});

		(InteractiveMode as any).prototype.showLoadedResources.call(fakeThis, {
			force: false,
		});

		expect(normalizeRenderedOutput(fakeThis.loadedResourcesContainer)).toMatchInlineSnapshot(`
"[Extensions]
  pi-markdown-preview"`);
	});

	// 测试场景：验证“labels npm sibling extensions relative to the declaring package”对应的行为、结果与边界。
	test("labels npm sibling extensions relative to the declaring package", () => {
		/** 常量 extensions 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const extensions: ExtensionFixture[] = [
			{
				path: "/tmp/project/.pi/npm/node_modules/primary-package/index.ts",
				sourceInfo: createSourceInfo("/tmp/project/.pi/npm/node_modules/primary-package/index.ts", {
					source: "npm:primary-package",
					scope: "project",
					origin: "package",
					baseDir: "/tmp/project/.pi/npm/node_modules/primary-package",
				}),
			},
			{
				path: "/tmp/project/.pi/npm/node_modules/sibling-package/index.ts",
				sourceInfo: createSourceInfo("/tmp/project/.pi/npm/node_modules/sibling-package/index.ts", {
					source: "npm:primary-package",
					scope: "project",
					origin: "package",
					baseDir: "/tmp/project/.pi/npm/node_modules/primary-package",
				}),
			},
		];

		/** 常量 fakeThis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeThis = createShowLoadedResourcesThis({
			quietStartup: false,
			extensions,
			useRealScopeGroups: true,
		});

		(InteractiveMode as any).prototype.showLoadedResources.call(fakeThis, {
			force: false,
		});

		expect(normalizeRenderedOutput(fakeThis.loadedResourcesContainer)).toMatchInlineSnapshot(`
"[Extensions]
  primary-package, primary-package:../sibling-package"`);
	});

	// 测试场景：验证“labels Windows npm sibling extensions relative to the declaring package”对应的行为、结果与边界。
	test("labels Windows npm sibling extensions relative to the declaring package", () => {
		/** 常量 primaryPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const primaryPath = "C:\\Users\\me\\.pi\\agent\\npm\\node_modules\\primary-package\\index.ts";
		/** 常量 siblingPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const siblingPath = "C:\\Users\\me\\.pi\\agent\\npm\\node_modules\\sibling-package\\index.ts";
		/** 常量 baseDir 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const baseDir = "C:\\Users\\me\\.pi\\agent\\npm\\node_modules\\primary-package";
		/** 常量 extensions 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const extensions: ExtensionFixture[] = [
			{
				path: primaryPath,
				sourceInfo: createSourceInfo(primaryPath, {
					source: "npm:primary-package",
					scope: "user",
					origin: "package",
					baseDir,
				}),
			},
			{
				path: siblingPath,
				sourceInfo: createSourceInfo(siblingPath, {
					source: "npm:primary-package",
					scope: "user",
					origin: "package",
					baseDir,
				}),
			},
		];

		/** 常量 fakeThis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeThis = createShowLoadedResourcesThis({
			quietStartup: false,
			extensions,
			useRealScopeGroups: true,
		});

		(InteractiveMode as any).prototype.showLoadedResources.call(fakeThis, {
			force: false,
		});

		expect(normalizeRenderedOutput(fakeThis.loadedResourcesContainer)).toMatchInlineSnapshot(`
"[Extensions]
  primary-package, primary-package:../sibling-package"`);
	});

	// 测试场景：验证“captures mixed extension layouts in expanded output”对应的行为、结果与边界。
	test("captures mixed extension layouts in expanded output", () => {
		/** 常量 fakeThis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeThis = createShowLoadedResourcesThis({
			quietStartup: false,
			toolOutputExpanded: true,
			extensions: createExtensionFixtures(),
			useRealScopeGroups: true,
		});

		(InteractiveMode as any).prototype.showLoadedResources.call(fakeThis, {
			force: false,
		});

		expect(normalizeRenderedOutput(fakeThis.loadedResourcesContainer)).toMatchInlineSnapshot(`
"[Extensions]
  project
    /tmp/project/.pi/extensions/answer.ts
    /tmp/project/.pi/extensions/local-index
    git:github.com/HazAT/pi-interactive-subagents
      extensions
      extensions/subagents
    npm:@scope/pi-scoped
      extensions
    npm:pi-markdown-preview
      extensions
  user
    /tmp/agent/extensions/user-index
  path
    /tmp/temp/cli-extension.ts"`);
	});

	// 测试场景：验证“shows context paths relative to cwd while preserving full external paths”对应的行为、结果与边界。
	test("shows context paths relative to cwd while preserving full external paths", () => {
		/** 常量 home 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const home = homedir();
		/** 常量 cwd 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const cwd = path.join(home, "Development", "pi-mono");
		/** 常量 fakeThis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeThis = createShowLoadedResourcesThis({
			quietStartup: false,
			cwd,
			contextFiles: [{ path: path.join(home, ".pi", "agent", "AGENTS.md") }, { path: path.join(cwd, "AGENTS.md") }],
		});

		(InteractiveMode as any).prototype.showLoadedResources.call(fakeThis, {
			force: false,
		});

		/** 常量 output 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const output = renderAll(fakeThis.loadedResourcesContainer).replace(/\\/g, "/");
		expect(output).toContain("[Context]");
		expect(output).toContain("~/.pi/agent/AGENTS.md, AGENTS.md");
		expect(output).not.toContain(`${cwd.replace(/\\/g, "/")}/AGENTS.md`);
	});

	// 测试场景：验证“shows full context paths when expanded”对应的行为、结果与边界。
	test("shows full context paths when expanded", () => {
		/** 常量 home 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const home = homedir();
		/** 常量 cwd 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const cwd = path.join(home, "Development", "pi-mono");
		/** 常量 fakeThis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeThis = createShowLoadedResourcesThis({
			quietStartup: false,
			toolOutputExpanded: true,
			cwd,
			contextFiles: [{ path: path.join(home, ".pi", "agent", "AGENTS.md") }, { path: path.join(cwd, "AGENTS.md") }],
		});

		(InteractiveMode as any).prototype.showLoadedResources.call(fakeThis, {
			force: false,
		});

		/** 常量 output 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const output = renderAll(fakeThis.loadedResourcesContainer).replace(/\\/g, "/");
		expect(output).toContain("[Context]");
		expect(output).toContain("~/.pi/agent/AGENTS.md");
		expect(output).toContain("~/Development/pi-mono/AGENTS.md");
		expect(output).not.toContain("~/.pi/agent/AGENTS.md, AGENTS.md");
	});

	// 测试场景：验证“does not show verbose listing on quiet startup during reload”对应的行为、结果与边界。
	test("does not show verbose listing on quiet startup during reload", () => {
		/** 常量 fakeThis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeThis = createShowLoadedResourcesThis({
			quietStartup: true,
			skills: [{ filePath: "/tmp/skill/SKILL.md", name: "commit" }],
		});

		(InteractiveMode as any).prototype.showLoadedResources.call(fakeThis, {
			extensions: [{ path: "/tmp/ext/index.ts" }],
			force: false,
			showDiagnosticsWhenQuiet: true,
		});

		expect(fakeThis.loadedResourcesContainer.children).toHaveLength(0);
	});

	// 测试场景：验证“still shows diagnostics on quiet startup when requested”对应的行为、结果与边界。
	test("still shows diagnostics on quiet startup when requested", () => {
		/** 常量 fakeThis 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const fakeThis = createShowLoadedResourcesThis({
			quietStartup: true,
			skills: [{ filePath: "/tmp/skill/SKILL.md", name: "commit" }],
			skillDiagnostics: [{ type: "warning", message: "duplicate skill name" }],
		});

		(InteractiveMode as any).prototype.showLoadedResources.call(fakeThis, {
			force: false,
			showDiagnosticsWhenQuiet: true,
		});

		/** 常量 output 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
		const output = renderAll(fakeThis.loadedResourcesContainer);
		expect(output).toContain("[Skill conflicts]");
		expect(output).not.toContain("[Skills]");
	});
});
