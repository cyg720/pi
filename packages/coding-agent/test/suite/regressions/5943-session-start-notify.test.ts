/**
 * 文件职责：回归验证会话启动与重载期间资源、消息、通知、订阅和焦点更新的先后顺序。
 * 技术维度：使用 Vitest、伪模型测试夹具、TUI Container/Text 组件及对 InteractiveMode 原型方法的受控调用。
 * 产品维度：防止用户重载会话时看到陈旧资源、丢失启动消息，或在异步重载完成前误操作编辑器。
 * 逻辑维度：先构造最小 UI 与原型调用上下文，再分别覆盖资源渲染、通知、消息订阅、重载钩子和焦点。
 * 关键边界：测试依赖内部原型方法和精简上下文替身；生产接口字段变化时这些类型夹具必须同步更新。
 * 新手阅读建议：先读四个 Context 类型和构造函数，再按用例顺序观察 render、subscribe、bind、notify 的事件序列。
 */

import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { Container, Text } from "@earendil-works/pi-tui";
import { describe, expect, it, vi } from "vitest";
import type { AgentSessionEvent } from "../../../src/core/agent-session.ts";
import type { ExtensionUIContext } from "../../../src/core/extensions/index.ts";
import { InteractiveMode } from "../../../src/modes/interactive/interactive-mode.ts";
import { initTheme, type Theme, theme } from "../../../src/modes/interactive/theme/theme.ts";
import { createHarness } from "../harness.ts";

/** 创建扩展测试所需的最小 UI 上下文。参数 onNotify 接收通知内容和级别；返回 ExtensionUIContext 替身。例如：createUiContext(handler)。 */
function createUiContext(
	onNotify: (message: string, type: "info" | "warning" | "error" | undefined) => void,
): ExtensionUIContext {
	return {
		select: async () => undefined,
		confirm: async () => false,
		input: async () => undefined,
		notify: onNotify,
		onTerminalInput: () => () => {},
		setStatus: () => {},
		setWorkingMessage: () => {},
		setWorkingVisible: () => {},
		setWorkingIndicator: () => {},
		setHiddenThinkingLabel: () => {},
		setWidget: () => {},
		setFooter: () => {},
		setHeader: () => {},
		setTitle: () => {},
		custom: async <T>() => undefined as T,
		pasteToEditor: () => {},
		setEditorText: () => {},
		getEditorText: () => "",
		editor: async () => undefined,
		addAutocompleteProvider: () => {},
		setEditorComponent: () => {},
		getEditorComponent: () => undefined,
		get theme() {
			return theme;
		},
		getAllThemes: () => [],
		getTheme: () => undefined,
		setTheme: (_theme: string | Theme) => ({ success: false, error: "Theme switching not available in tests" }),
		getToolsExpanded: () => false,
		setToolsExpanded: () => {},
	};
}

/** 类型 LoadedResourcesResult：为资源加载结果附加空诊断数组的泛型类型。 */
type LoadedResourcesResult<T> = { [K in keyof T]: T[K] } & { diagnostics: [] };

/** 类型 LoadedResourcesContext：调用 showLoadedResources 所需的最小 this 上下文。 */
type LoadedResourcesContext = {
	/** 类型字段 loadedResourcesContainer：为该内部方法提供 loadedResourcesContainer 状态或行为；可选标记表示测试可省略。 */
	loadedResourcesContainer: Container;
	/** 类型字段 chatContainer：为该内部方法提供 chatContainer 状态或行为；可选标记表示测试可省略。 */
	chatContainer: Container;
	/** 类型字段 options：为该内部方法提供 options 状态或行为；可选标记表示测试可省略。 */
	options: { verbose?: boolean };
	/** 类型字段 settingsManager：为该内部方法提供 settingsManager 状态或行为；可选标记表示测试可省略。 */
	settingsManager: { getQuietStartup: () => boolean };
	/** 类型字段 sessionManager：为该内部方法提供 sessionManager 状态或行为；可选标记表示测试可省略。 */
	sessionManager: { getCwd: () => string };
	/** 类型字段 session：为该内部方法提供 session 状态或行为；可选标记表示测试可省略。 */
	session: {
		/** 类型字段 promptTemplates：为该内部方法提供 promptTemplates 状态或行为；可选标记表示测试可省略。 */
		promptTemplates: [];
		/** 类型字段 resourceLoader：为该内部方法提供 resourceLoader 状态或行为；可选标记表示测试可省略。 */
		resourceLoader: {
			/** 类型字段 getAgentsFiles：为该内部方法提供 getAgentsFiles 状态或行为；可选标记表示测试可省略。 */
			getAgentsFiles: () => LoadedResourcesResult<{ agentsFiles: Array<{ path: string }> }>;
			/** 类型字段 getSkills：为该内部方法提供 getSkills 状态或行为；可选标记表示测试可省略。 */
			getSkills: () => LoadedResourcesResult<{ skills: [] }>;
			/** 类型字段 getPrompts：为该内部方法提供 getPrompts 状态或行为；可选标记表示测试可省略。 */
			getPrompts: () => LoadedResourcesResult<{ prompts: [] }>;
			/** 类型字段 getThemes：为该内部方法提供 getThemes 状态或行为；可选标记表示测试可省略。 */
			getThemes: () => LoadedResourcesResult<{ themes: [] }>;
			/** 类型字段 getExtensions：为该内部方法提供 getExtensions 状态或行为；可选标记表示测试可省略。 */
			getExtensions: () => { extensions: []; errors: [] };
		};
		/** 类型字段 extensionRunner：为该内部方法提供 extensionRunner 状态或行为；可选标记表示测试可省略。 */
		extensionRunner: {
			/** 类型字段 getCommandDiagnostics：为该内部方法提供 getCommandDiagnostics 状态或行为；可选标记表示测试可省略。 */
			getCommandDiagnostics: () => [];
			/** 类型字段 getShortcutDiagnostics：为该内部方法提供 getShortcutDiagnostics 状态或行为；可选标记表示测试可省略。 */
			getShortcutDiagnostics: () => [];
			/** 类型字段 getRegisteredCommands：为该内部方法提供 getRegisteredCommands 状态或行为；可选标记表示测试可省略。 */
			getRegisteredCommands: () => [];
		};
	};
	/** 类型字段 getStartupExpansionState：为该内部方法提供 getStartupExpansionState 状态或行为；可选标记表示测试可省略。 */
	getStartupExpansionState: () => boolean;
	/** 类型字段 formatDisplayPath：为该内部方法提供 formatDisplayPath 状态或行为；可选标记表示测试可省略。 */
	formatDisplayPath: (resourcePath: string) => string;
	/** 类型字段 formatContextPath：为该内部方法提供 formatContextPath 状态或行为；可选标记表示测试可省略。 */
	formatContextPath: (resourcePath: string) => string;
	/** 类型字段 getBuiltInCommandConflictDiagnostics：为该内部方法提供 getBuiltInCommandConflictDiagnostics 状态或行为；可选标记表示测试可省略。 */
	getBuiltInCommandConflictDiagnostics: (extensionRunner: LoadedResourcesContext["session"]["extensionRunner"]) => [];
};

/** 类型 RebindContext：调用 rebindCurrentSession 所需的最小 this 上下文。 */
type RebindContext = {
	/** 类型字段 unsubscribe：为该内部方法提供 unsubscribe 状态或行为；可选标记表示测试可省略。 */
	unsubscribe?: () => void;
	/** 类型字段 applyRuntimeSettings：为该内部方法提供 applyRuntimeSettings 状态或行为；可选标记表示测试可省略。 */
	applyRuntimeSettings: () => void;
	/** 类型字段 renderCurrentSessionState：为该内部方法提供 renderCurrentSessionState 状态或行为；可选标记表示测试可省略。 */
	renderCurrentSessionState: () => void;
	/** 类型字段 bindCurrentSessionExtensions：为该内部方法提供 bindCurrentSessionExtensions 状态或行为；可选标记表示测试可省略。 */
	bindCurrentSessionExtensions: () => Promise<void>;
	/** 类型字段 subscribeToAgent：为该内部方法提供 subscribeToAgent 状态或行为；可选标记表示测试可省略。 */
	subscribeToAgent: () => void;
	/** 类型字段 updateAvailableProviderCount：为该内部方法提供 updateAvailableProviderCount 状态或行为；可选标记表示测试可省略。 */
	updateAvailableProviderCount: () => Promise<void>;
	/** 类型字段 updateEditorBorderColor：为该内部方法提供 updateEditorBorderColor 状态或行为；可选标记表示测试可省略。 */
	updateEditorBorderColor: () => void;
	/** 类型字段 updateTerminalTitle：为该内部方法提供 updateTerminalTitle 状态或行为；可选标记表示测试可省略。 */
	updateTerminalTitle: () => void;
};

/** 类型 ReloadCommandContext：调用 handleReloadCommand 所需的完整 this 上下文。 */
type ReloadCommandContext = {
	/** 类型字段 hideThinkingBlock：为该内部方法提供 hideThinkingBlock 状态或行为；可选标记表示测试可省略。 */
	hideThinkingBlock: boolean;
	/** 类型字段 session：为该内部方法提供 session 状态或行为；可选标记表示测试可省略。 */
	session: {
		/** 类型字段 isStreaming：为该内部方法提供 isStreaming 状态或行为；可选标记表示测试可省略。 */
		isStreaming: boolean;
		/** 类型字段 isCompacting：为该内部方法提供 isCompacting 状态或行为；可选标记表示测试可省略。 */
		isCompacting: boolean;
		/** 类型字段 reload：为该内部方法提供 reload 状态或行为；可选标记表示测试可省略。 */
		reload: (options?: { beforeSessionStart?: () => void | Promise<void> }) => Promise<void>;
		/** 类型字段 resourceLoader：为该内部方法提供 resourceLoader 状态或行为；可选标记表示测试可省略。 */
		resourceLoader: { getThemes: () => { themes: [] } };
		/** 类型字段 extensionRunner：为该内部方法提供 extensionRunner 状态或行为；可选标记表示测试可省略。 */
		extensionRunner: unknown;
		/** 类型字段 modelRegistry：为该内部方法提供 modelRegistry 状态或行为；可选标记表示测试可省略。 */
		modelRegistry: { getError: () => string | undefined };
	};
	/** 类型字段 settingsManager：为该内部方法提供 settingsManager 状态或行为；可选标记表示测试可省略。 */
	settingsManager: {
		/** 类型字段 getHttpIdleTimeoutMs：为该内部方法提供 getHttpIdleTimeoutMs 状态或行为；可选标记表示测试可省略。 */
		getHttpIdleTimeoutMs: () => number;
		/** 类型字段 getHideThinkingBlock：为该内部方法提供 getHideThinkingBlock 状态或行为；可选标记表示测试可省略。 */
		getHideThinkingBlock: () => boolean;
		/** 类型字段 getOutputPad：为该内部方法提供 getOutputPad 状态或行为；可选标记表示测试可省略。 */
		getOutputPad: () => 0 | 1;
		/** 类型字段 getEditorPaddingX：为该内部方法提供 getEditorPaddingX 状态或行为；可选标记表示测试可省略。 */
		getEditorPaddingX: () => number;
		/** 类型字段 getAutocompleteMaxVisible：为该内部方法提供 getAutocompleteMaxVisible 状态或行为；可选标记表示测试可省略。 */
		getAutocompleteMaxVisible: () => number;
		/** 类型字段 getShowHardwareCursor：为该内部方法提供 getShowHardwareCursor 状态或行为；可选标记表示测试可省略。 */
		getShowHardwareCursor: () => boolean;
		/** 类型字段 getClearOnShrink：为该内部方法提供 getClearOnShrink 状态或行为；可选标记表示测试可省略。 */
		getClearOnShrink: () => boolean;
	};
	/** 类型字段 keybindings：为该内部方法提供 keybindings 状态或行为；可选标记表示测试可省略。 */
	keybindings: { reload: () => void };
	/** 类型字段 customHeader：为该内部方法提供 customHeader 状态或行为；可选标记表示测试可省略。 */
	customHeader?: unknown;
	/** 类型字段 builtInHeader：为该内部方法提供 builtInHeader 状态或行为；可选标记表示测试可省略。 */
	builtInHeader?: unknown;
	/** 类型字段 editorContainer：为该内部方法提供 editorContainer 状态或行为；可选标记表示测试可省略。 */
	editorContainer: { clear: () => void; addChild: (component: unknown) => void };
	/** 类型字段 ui：为该内部方法提供 ui 状态或行为；可选标记表示测试可省略。 */
	ui: {
		/** 类型字段 setFocus：为该内部方法提供 setFocus 状态或行为；可选标记表示测试可省略。 */
		setFocus: (component: unknown) => void;
		/** 类型字段 requestRender：为该内部方法提供 requestRender 状态或行为；可选标记表示测试可省略。 */
		requestRender: (force?: boolean) => void;
		/** 类型字段 setShowHardwareCursor：为该内部方法提供 setShowHardwareCursor 状态或行为；可选标记表示测试可省略。 */
		setShowHardwareCursor: (enabled: boolean) => void;
		/** 类型字段 setClearOnShrink：为该内部方法提供 setClearOnShrink 状态或行为；可选标记表示测试可省略。 */
		setClearOnShrink: (enabled: boolean) => void;
	};
	/** 类型字段 editor：为该内部方法提供 editor 状态或行为；可选标记表示测试可省略。 */
	editor: unknown;
	/** 类型字段 defaultEditor：为该内部方法提供 defaultEditor 状态或行为；可选标记表示测试可省略。 */
	defaultEditor: { setPaddingX: (padding: number) => void; setAutocompleteMaxVisible: (maxVisible: number) => void };
	/** 类型字段 themeController：为该内部方法提供 themeController 状态或行为；可选标记表示测试可省略。 */
	themeController: { applyFromSettings: () => Promise<void> };
	/** 类型字段 resetExtensionUI：为该内部方法提供 resetExtensionUI 状态或行为；可选标记表示测试可省略。 */
	resetExtensionUI: () => void;
	/** 类型字段 rebuildChatFromMessages：为该内部方法提供 rebuildChatFromMessages 状态或行为；可选标记表示测试可省略。 */
	rebuildChatFromMessages: () => void;
	/** 类型字段 setupAutocompleteProvider：为该内部方法提供 setupAutocompleteProvider 状态或行为；可选标记表示测试可省略。 */
	setupAutocompleteProvider: () => void;
	/** 类型字段 setupExtensionShortcuts：为该内部方法提供 setupExtensionShortcuts 状态或行为；可选标记表示测试可省略。 */
	setupExtensionShortcuts: (runner: unknown) => void;
	/** 类型字段 showLoadedResources：为该内部方法提供 showLoadedResources 状态或行为；可选标记表示测试可省略。 */
	showLoadedResources: (options: unknown) => void;
	/** 类型字段 maybeSaveImplicitProjectTrustAfterReload：为该内部方法提供 maybeSaveImplicitProjectTrustAfterReload 状态或行为；可选标记表示测试可省略。 */
	maybeSaveImplicitProjectTrustAfterReload: () => boolean;
	/** 类型字段 showStatus：为该内部方法提供 showStatus 状态或行为；可选标记表示测试可省略。 */
	showStatus: (message: string) => void;
	/** 类型字段 showWarning：为该内部方法提供 showWarning 状态或行为；可选标记表示测试可省略。 */
	showWarning: (message: string) => void;
	/** 类型字段 showError：为该内部方法提供 showError 状态或行为；可选标记表示测试可省略。 */
	showError: (message: string) => void;
};

/** 类型 InteractiveModePrototype：本回归测试会直接调用的交互模式原型方法视图。 */
type InteractiveModePrototype = {
	showLoadedResources(
		this: LoadedResourcesContext,
		options?: { extensions?: Array<{ path: string }>; force?: boolean; showDiagnosticsWhenQuiet?: boolean },
	): void;
	/** 类型字段 rebindCurrentSession：为该内部方法提供 rebindCurrentSession 状态或行为；可选标记表示测试可省略。 */
	rebindCurrentSession(this: RebindContext, options?: { renderBeforeBind?: boolean }): Promise<void>;
	/** 类型字段 handleReloadCommand：为该内部方法提供 handleReloadCommand 状态或行为；可选标记表示测试可省略。 */
	handleReloadCommand(this: ReloadCommandContext): Promise<void>;
};

/** 变量 interactiveModePrototype：经过测试专用类型收窄的 InteractiveMode 原型；仅在当前测试作用域内有效。 */
const interactiveModePrototype = InteractiveMode.prototype as unknown as InteractiveModePrototype;

/** 类型 ReloadCommandContextOverrides：允许逐层覆盖重载上下文嵌套字段的输入类型。 */
type ReloadCommandContextOverrides = Omit<
	Partial<ReloadCommandContext>,
	"session" | "settingsManager" | "keybindings" | "editorContainer" | "ui" | "defaultEditor" | "themeController"
> & {
	session?: Partial<ReloadCommandContext["session"]>;
	settingsManager?: Partial<ReloadCommandContext["settingsManager"]>;
	keybindings?: Partial<ReloadCommandContext["keybindings"]>;
	editorContainer?: Partial<ReloadCommandContext["editorContainer"]>;
	ui?: Partial<ReloadCommandContext["ui"]>;
	defaultEditor?: Partial<ReloadCommandContext["defaultEditor"]>;
	themeController?: Partial<ReloadCommandContext["themeController"]>;
};

/** 合并可选覆盖项并创建可调用重载命令的完整上下文。参数 overrides 为局部替换；返回 ReloadCommandContext。例如：createReloadCommandContext({ editor })。 */
function createReloadCommandContext(overrides: ReloadCommandContextOverrides = {}): ReloadCommandContext {
	/** 变量 editor：重载后应重新获得焦点的编辑器占位对象；仅在当前测试作用域内有效。 */
	const editor = overrides.editor ?? {};
	return {
		hideThinkingBlock: overrides.hideThinkingBlock ?? false,
		session: {
			isStreaming: false,
			isCompacting: false,
			reload: async (options) => {
				await options?.beforeSessionStart?.();
			},
			resourceLoader: { getThemes: () => ({ themes: [] }) },
			extensionRunner: {},
			modelRegistry: { getError: () => undefined },
			...overrides.session,
		},
		settingsManager: {
			getHttpIdleTimeoutMs: () => 0,
			getHideThinkingBlock: () => false,
			getOutputPad: () => 1,
			getEditorPaddingX: () => 1,
			getAutocompleteMaxVisible: () => 10,
			getShowHardwareCursor: () => false,
			getClearOnShrink: () => false,
			...overrides.settingsManager,
		},
		keybindings: { reload: () => {}, ...overrides.keybindings },
		editorContainer: { clear: () => {}, addChild: () => {}, ...overrides.editorContainer },
		ui: {
			setFocus: () => {},
			requestRender: () => {},
			setShowHardwareCursor: () => {},
			setClearOnShrink: () => {},
			...overrides.ui,
		},
		editor,
		defaultEditor: { setPaddingX: () => {}, setAutocompleteMaxVisible: () => {}, ...overrides.defaultEditor },
		themeController: { applyFromSettings: async () => {}, ...overrides.themeController },
		customHeader: overrides.customHeader,
		builtInHeader: overrides.builtInHeader,
		resetExtensionUI: overrides.resetExtensionUI ?? (() => {}),
		rebuildChatFromMessages: overrides.rebuildChatFromMessages ?? (() => {}),
		setupAutocompleteProvider: overrides.setupAutocompleteProvider ?? (() => {}),
		setupExtensionShortcuts: overrides.setupExtensionShortcuts ?? (() => {}),
		showLoadedResources: overrides.showLoadedResources ?? (() => {}),
		maybeSaveImplicitProjectTrustAfterReload: overrides.maybeSaveImplicitProjectTrustAfterReload ?? (() => false),
		showStatus: overrides.showStatus ?? (() => {}),
		showWarning: overrides.showWarning ?? (() => {}),
		showError: overrides.showError ?? (() => {}),
	};
}

/** 类型 MessageEvent：仅保留消息开始和消息结束事件的联合类型。 */
type MessageEvent = Extract<AgentSessionEvent, { type: "message_start" | "message_end" }>;

/** 从消息开始或结束事件中提取纯文本。参数 event 为消息事件；返回拼接后的字符串。例如：getMessageText(event)。 */
function getMessageText(event: MessageEvent): string {
	/** 变量 message：事件中携带的消息对象；仅在当前测试作用域内有效。 */
	const message = event.message;
	if (!("content" in message)) {
		return "";
	}
	/** 变量 content：消息的字符串或内容块集合；仅在当前测试作用域内有效。 */
	const content = message.content;
	if (typeof content === "string") {
		return content;
	}
	return content
		.filter((part): part is { type: "text"; text: string } => part.type === "text")
		.map((part) => part.text)
		.join("");
}

/** 创建显示已加载资源所需的最小交互模式上下文。无参数；返回 LoadedResourcesContext。例如：createLoadedResourcesContext()。 */
function createLoadedResourcesContext(): LoadedResourcesContext {
	return {
		loadedResourcesContainer: new Container(),
		chatContainer: new Container(),
		options: { verbose: true },
		settingsManager: { getQuietStartup: () => false },
		sessionManager: { getCwd: () => "/repo" },
		session: {
			promptTemplates: [],
			resourceLoader: {
				getAgentsFiles: () => ({ agentsFiles: [{ path: "/repo/AGENTS.md" }], diagnostics: [] }),
				getSkills: () => ({ skills: [], diagnostics: [] }),
				getPrompts: () => ({ prompts: [], diagnostics: [] }),
				getThemes: () => ({ themes: [], diagnostics: [] }),
				getExtensions: () => ({ extensions: [], errors: [] }),
			},
			extensionRunner: {
				getCommandDiagnostics: () => [],
				getShortcutDiagnostics: () => [],
				getRegisteredCommands: () => [],
			},
		},
		getStartupExpansionState: () => false,
		formatDisplayPath: (resourcePath) => resourcePath,
		formatContextPath: (resourcePath) => resourcePath.replace("/repo/", ""),
		getBuiltInCommandConflictDiagnostics: () => [],
	};
}

/** 测试分组：问题 #5943 的 session_start 瞬态界面回归。 */
describe("regression #5943: session_start transient UI", () => {
	/** 测试场景：renders loaded resources before restored messages without stale entries。 */
	it("renders loaded resources before restored messages without stale entries", () => {
		initTheme("dark", false);
		/** 变量 context：当前用例调用原型方法所需的最小上下文；仅在当前测试作用域内有效。 */
		const context = createLoadedResourcesContext();
		/** 变量 root：组合资源区域和聊天区域的根容器；仅在当前测试作用域内有效。 */
		const root = new Container();
		root.addChild(context.loadedResourcesContainer);
		root.addChild(context.chatContainer);
		context.loadedResourcesContainer.addChild(new Text("stale resources", 0, 0));
		context.chatContainer.addChild(new Text("restored message", 0, 0));

		interactiveModePrototype.showLoadedResources.call(context);

		/** 变量 chatRendered：只渲染聊天容器得到的文本；仅在当前测试作用域内有效。 */
		const chatRendered = context.chatContainer.render(80).join("\n");
		expect(chatRendered).toContain("restored message");
		expect(chatRendered).not.toContain("[Context]");

		/** 变量 rendered：渲染整个根容器得到的文本；仅在当前测试作用域内有效。 */
		const rendered = root.render(80).join("\n");
		expect(rendered).not.toContain("stale resources");
		expect(rendered.indexOf("[Context]")).toBeLessThan(rendered.indexOf("restored message"));
	});

	/** 测试场景：renders replacement session state before session_start handlers can notify。 */
	it("renders replacement session state before session_start handlers can notify", async () => {
		/** 变量 events：按发生顺序记录渲染、订阅、绑定和消息事件的数组；仅在当前测试作用域内有效。 */
		const events: string[] = [];
		/** 变量 harness：带伪模型与扩展运行时的测试夹具；仅在当前测试作用域内有效。 */
		const harness = await createHarness({
			extensionFactories: [
				(pi) => {
					pi.on("session_start", (_event, ctx) => {
						ctx.ui.notify("Hello Error", "error");
					});
				},
			],
		});

		try {
			/** 变量 context：当前用例调用原型方法所需的最小上下文；仅在当前测试作用域内有效。 */
			const context: RebindContext = {
				applyRuntimeSettings: () => events.push("apply"),
				renderCurrentSessionState: () => events.push("render"),
				bindCurrentSessionExtensions: async () => {
					events.push("bind");
					await harness.session.bindExtensions({
						uiContext: createUiContext((message) => events.push(`notify:${message}`)),
						mode: "tui",
					});
				},
				subscribeToAgent: () => events.push("subscribe"),
				updateAvailableProviderCount: async () => {},
				updateEditorBorderColor: () => {},
				updateTerminalTitle: () => {},
			};

			await interactiveModePrototype.rebindCurrentSession.call(context, { renderBeforeBind: true });

			expect(events).toEqual(["apply", "render", "subscribe", "bind", "notify:Hello Error"]);
		} finally {
			harness.cleanup();
		}
	});

	/** 测试场景：subscribes before replacement session_start handlers send messages。 */
	it("subscribes before replacement session_start handlers send messages", async () => {
		/** 变量 events：按发生顺序记录渲染、订阅、绑定和消息事件的数组；仅在当前测试作用域内有效。 */
		const events: string[] = [];
		/** 变量 harness：带伪模型与扩展运行时的测试夹具；仅在当前测试作用域内有效。 */
		const harness = await createHarness({
			extensionFactories: [
				(pi) => {
					pi.on("session_start", () => {
						pi.sendMessage({
							customType: "session-start",
							content: "custom from start",
							display: true,
						});
					});
				},
			],
		});

		try {
			/** 变量 context：当前用例调用原型方法所需的最小上下文；仅在当前测试作用域内有效。 */
			const context: RebindContext = {
				applyRuntimeSettings: () => {},
				renderCurrentSessionState: () => events.push("render"),
				bindCurrentSessionExtensions: async () => {
					events.push("bind");
					await harness.session.bindExtensions({
						uiContext: createUiContext(() => {}),
						mode: "tui",
					});
				},
				subscribeToAgent: () => {
					events.push("subscribe");
					harness.session.subscribe((event) => {
						if (event.type !== "message_start" && event.type !== "message_end") {
							return;
						}
						events.push(`${event.type}:${event.message.role}:${getMessageText(event)}`);
					});
				},
				updateAvailableProviderCount: async () => {},
				updateEditorBorderColor: () => {},
				updateTerminalTitle: () => {},
			};

			await interactiveModePrototype.rebindCurrentSession.call(context, { renderBeforeBind: true });

			expect(events).toEqual([
				"render",
				"subscribe",
				"bind",
				"message_start:custom:custom from start",
				"message_end:custom:custom from start",
			]);
		} finally {
			harness.cleanup();
		}
	});

	/** 测试场景：subscribes before replacement session_start handlers send user messages。 */
	it("subscribes before replacement session_start handlers send user messages", async () => {
		/** 变量 events：按发生顺序记录渲染、订阅、绑定和消息事件的数组；仅在当前测试作用域内有效。 */
		const events: string[] = [];
		/** 变量 harness：带伪模型与扩展运行时的测试夹具；仅在当前测试作用域内有效。 */
		const harness = await createHarness({
			extensionFactories: [
				(pi) => {
					pi.on("session_start", () => {
						pi.sendUserMessage("user from start");
					});
				},
			],
		});
		harness.setResponses([fauxAssistantMessage("assistant from start")]);

		try {
			/** 变量 context：当前用例调用原型方法所需的最小上下文；仅在当前测试作用域内有效。 */
			const context: RebindContext = {
				applyRuntimeSettings: () => {},
				renderCurrentSessionState: () => events.push("render"),
				bindCurrentSessionExtensions: async () => {
					events.push("bind");
					await harness.session.bindExtensions({
						uiContext: createUiContext(() => {}),
						mode: "tui",
					});
				},
				subscribeToAgent: () => {
					events.push("subscribe");
					harness.session.subscribe((event) => {
						if (event.type !== "message_start" && event.type !== "message_end") {
							return;
						}
						events.push(`${event.type}:${event.message.role}:${getMessageText(event)}`);
					});
				},
				updateAvailableProviderCount: async () => {},
				updateEditorBorderColor: () => {},
				updateTerminalTitle: () => {},
			};

			await interactiveModePrototype.rebindCurrentSession.call(context, { renderBeforeBind: true });
			await harness.session.agent.waitForIdle();

			expect(events.slice(0, 3)).toEqual(["render", "subscribe", "bind"]);
			expect(events).toContain("message_start:user:user from start");
			expect(events).toContain("message_end:user:user from start");
			expect(events).toContain("message_end:assistant:assistant from start");
		} finally {
			harness.cleanup();
		}
	});

	/** 测试场景：runs the reload render hook before reload session_start handlers can notify。 */
	it("runs the reload render hook before reload session_start handlers can notify", async () => {
		/** 变量 events：按发生顺序记录渲染、订阅、绑定和消息事件的数组；仅在当前测试作用域内有效。 */
		const events: string[] = [];
		/** 变量 beforeSessionStart：用于记录重载前渲染时机的模拟函数；仅在当前测试作用域内有效。 */
		const beforeSessionStart = vi.fn(() => {
			events.push("render");
		});
		/** 变量 harness：带伪模型与扩展运行时的测试夹具；仅在当前测试作用域内有效。 */
		const harness = await createHarness({
			extensionFactories: [
				(pi) => {
					pi.on("session_start", (event, ctx) => {
						events.push(`start:${event.reason}`);
						ctx.ui.notify(`notify:${event.reason}`, "error");
					});
				},
			],
		});

		try {
			await harness.session.bindExtensions({
				uiContext: createUiContext((message) => events.push(message)),
				mode: "tui",
			});
			expect(events).toEqual(["start:startup", "notify:startup"]);

			events.length = 0;
			await harness.session.reload({ beforeSessionStart });

			expect(beforeSessionStart).toHaveBeenCalledTimes(1);
			expect(events).toEqual(["render", "start:reload", "notify:reload"]);
		} finally {
			harness.cleanup();
		}
	});

	/** 测试场景：refreshes hideThinkingBlock before rebuilding chat during reload。 */
	it("refreshes hideThinkingBlock before rebuilding chat during reload", async () => {
		initTheme("dark", false);
		/** 变量 events：按发生顺序记录渲染、订阅、绑定和消息事件的数组；仅在当前测试作用域内有效。 */
		const events: string[] = [];
		/** 变量 context：当前用例调用原型方法所需的最小上下文；仅在当前测试作用域内有效。 */
		let context: ReloadCommandContext;
		context = createReloadCommandContext({
			settingsManager: { getHideThinkingBlock: () => true },
			session: {
				reload: async (options) => {
					events.push("reload");
					await options?.beforeSessionStart?.();
					events.push(`start:${context.hideThinkingBlock}`);
				},
			},
			rebuildChatFromMessages: () => {
				events.push(`rebuild:${context.hideThinkingBlock}`);
			},
		});

		await interactiveModePrototype.handleReloadCommand.call(context);

		expect(context.hideThinkingBlock).toBe(true);
		expect(events).toEqual(["reload", "rebuild:true", "start:true"]);
	});

	/** 测试场景：keeps the reload blocker focused until async reload completes。 */
	it("keeps the reload blocker focused until async reload completes", async () => {
		initTheme("dark", false);
		/** 变量 editor：重载后应重新获得焦点的编辑器占位对象；仅在当前测试作用域内有效。 */
		const editor = {};
		/** 变量 focused：最近一次传给 setFocus 的组件；仅在当前测试作用域内有效。 */
		let focused: unknown;
		/** 变量 chatRestored：聊天历史是否已在等待异步重载时恢复；仅在当前测试作用域内有效。 */
		let chatRestored = false;
		/** 变量 markReloadWaiting：当前回归场景使用的 markReloadWaiting 值；仅在当前测试作用域内有效。 */
		let markReloadWaiting!: () => void;
		/** 变量 finishReload：当前回归场景使用的 finishReload 值；仅在当前测试作用域内有效。 */
		let finishReload!: () => void;
		/** 变量 reloadWaiting：在重载进入等待阶段时完成的同步 Promise；仅在当前测试作用域内有效。 */
		const reloadWaiting = new Promise<void>((resolve) => {
			markReloadWaiting = resolve;
		});
		/** 变量 reloadFinished：由测试控制重载结束时机的 Promise；仅在当前测试作用域内有效。 */
		const reloadFinished = new Promise<void>((resolve) => {
			finishReload = resolve;
		});

		/** 变量 context：当前用例调用原型方法所需的最小上下文；仅在当前测试作用域内有效。 */
		const context = createReloadCommandContext({
			editor,
			session: {
				reload: async (options) => {
					await options?.beforeSessionStart?.();
					markReloadWaiting();
					await reloadFinished;
				},
			},
			ui: {
				setFocus: (component) => {
					focused = component;
				},
			},
			rebuildChatFromMessages: () => {
				chatRestored = true;
			},
		});

		/** 变量 reloadPromise：正在执行的异步重载命令 Promise；仅在当前测试作用域内有效。 */
		const reloadPromise = interactiveModePrototype.handleReloadCommand.call(context);
		await reloadWaiting;

		expect(chatRestored).toBe(true);
		expect(focused).not.toBe(editor);

		finishReload();
		await reloadPromise;

		expect(focused).toBe(editor);
	});
});
