/**
 * 文件职责：回归验证重新渲染会话历史时，未完成工具调用仍能接收实时完成事件，已完成调用不会残留为 pending。
 * 技术维度：使用 Vitest、真实 InteractiveMode 原型方法、TUI Container/Text 和最小 this 上下文测试渲染状态。
 * 产品维度：避免用户切换 thinking 等界面设置后，慢工具结果消失或历史工具被错误视为仍在运行。
 * 逻辑维度：构造伪交互模式、工具调用/结果和会话条目，再分别模拟实时完成与完整历史重绘。
 * 关键边界：只实现原型方法实际读取的 this 字段；主题必须先初始化，消息与工具调用 ID 必须一致。
 * 新手阅读建议：先看 RenderSessionContextThis 的最小依赖，再跟随 pendingTools 在渲染前后的变化。
 */
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, ToolResultMessage, Usage } from "@earendil-works/pi-ai";
import { Container, Text, type TUI } from "@earendil-works/pi-tui";
import { beforeAll, describe, expect, test, vi } from "vitest";
import type { AgentSessionEvent } from "../../../src/core/agent-session.ts";
import type { SessionEntry } from "../../../src/core/session-manager.ts";
import type { ToolExecutionComponent } from "../../../src/modes/interactive/components/tool-execution.ts";
import { InteractiveMode } from "../../../src/modes/interactive/interactive-mode.ts";
import { initTheme } from "../../../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../../../src/utils/ansi.ts";

// TOOL_CALL_ID 是两条用例共享的稳定工具调用标识。
const TOOL_CALL_ID = "tool-4167";
// TOOL_NAME 是伪慢工具名称，用于匹配调用与结果。
const TOOL_NAME = "slow_tool";

// EMPTY_USAGE 是构造测试助手消息所需的零令牌用量。
const EMPTY_USAGE: Usage = {
	input: 0,
	output: 0,
	cacheRead: 0,
	cacheWrite: 0,
	totalTokens: 0,
	cost: {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		total: 0,
	},
};

// RenderSessionItems 描述 InteractiveMode 内部渲染消息数组的方法签名。
type RenderSessionItems = (
	this: RenderSessionContextThis,
	items: AgentMessage[],
	options?: { updateFooter?: boolean; populateHistory?: boolean },
) => void;

// RenderSessionContextThis 描述 renderSessionEntries 和 handleEvent 实际依赖的最小 this 对象。
type RenderSessionContextThis = {
	pendingTools: Map<string, ToolExecutionComponent>;
	chatContainer: Container;
	footer: { invalidate(): void };
	ui: TUI;
	settingsManager: {
		getShowImages(): boolean;
		getImageWidthCells(): number;
		getShowCacheMissNotices(): boolean;
	};
	sessionManager: { getCwd(): string; getEntries(): SessionEntry[] };
	session: { retryAttempt: number; modelRegistry: { find(provider: string, modelId: string): undefined } };
	toolOutputExpanded: boolean;
	isInitialized: boolean;
	updateEditorBorderColor(): void;
	getRegisteredToolDefinition(toolName: string): undefined;
	addMessageToChat(message: AgentMessage, options?: { populateHistory?: boolean }): void;
	renderSessionItems: RenderSessionItems;
};

// RenderSessionEntries 描述从持久化条目重绘会话的方法签名。
type RenderSessionEntries = (
	this: RenderSessionContextThis,
	entries: SessionEntry[],
	options?: { updateFooter?: boolean; populateHistory?: boolean },
) => void;

// HandleEvent 描述异步处理 AgentSessionEvent 的内部方法签名。
type HandleEvent = (this: RenderSessionContextThis, event: AgentSessionEvent) => Promise<void>;

/** 创建可调用内部渲染方法的伪 InteractiveMode 上下文；无参数；返回最小 this 对象。 */
function createFakeInteractiveModeThis(): RenderSessionContextThis {
	// chatContainer 保存渲染产生的文本组件，供最终字符串断言。
	const chatContainer = new Container();
	return {
		pendingTools: new Map<string, ToolExecutionComponent>(),
		chatContainer,
		footer: { invalidate: vi.fn() },
		ui: { requestRender: vi.fn() } as unknown as TUI,
		settingsManager: {
			getShowImages: () => false,
			getImageWidthCells: () => 60,
			getShowCacheMissNotices: () => false,
		},
		sessionManager: { getCwd: () => process.cwd(), getEntries: () => [] },
		session: { retryAttempt: 0, modelRegistry: { find: () => undefined } },
		toolOutputExpanded: false,
		isInitialized: true,
		updateEditorBorderColor: vi.fn(),
		getRegisteredToolDefinition: (_toolName: string) => undefined,
		renderSessionItems: (InteractiveMode.prototype as unknown as { renderSessionItems: RenderSessionItems })
			.renderSessionItems,
		/** 参数 message 是待显示消息；把角色文本加入容器且无返回值；示例：`fakeThis.addMessageToChat(message)`。 */
		addMessageToChat(message: AgentMessage) {
			chatContainer.addChild(new Text(message.role, 0, 0));
		},
	};
}

/** 构造一个尚未完成的慢工具助手调用消息；无参数；返回 AssistantMessage。 */
function createAssistantToolCallMessage(): AssistantMessage {
	return {
		role: "assistant",
		content: [
			{
				type: "toolCall",
				id: TOOL_CALL_ID,
				name: TOOL_NAME,
				arguments: { delayMs: 10_000 },
			},
		],
		api: "test-api",
		provider: "test-provider",
		model: "test-model",
		usage: EMPTY_USAGE,
		stopReason: "toolUse",
		timestamp: Date.now(),
	};
}

/** 构造与固定调用 ID 匹配的成功工具结果；参数 text 为结果正文；返回 ToolResultMessage。 */
function createToolResultMessage(text: string): ToolResultMessage {
	return {
		role: "toolResult",
		toolCallId: TOOL_CALL_ID,
		toolName: TOOL_NAME,
		content: [{ type: "text", text }],
		isError: false,
		timestamp: Date.now(),
	};
}

/**
 * 把连续消息包装为具有父子链的 SessionEntry 数组。
 * @param messages 按会话顺序排列的代理消息。
 * @returns 生成的会话条目；例如 `createSessionEntries([assistant])`。
 */
function createSessionEntries(messages: AgentMessage[]): SessionEntry[] {
	// parentId 保存上一条目 ID，首条没有父节点。
	let parentId: string | null = null;
	return messages.map((message, index) => {
		// entry 是当前消息对应的持久化会话条目。
		const entry: SessionEntry = {
			type: "message",
			id: `entry-${index}`,
			parentId,
			timestamp: new Date().toISOString(),
			message,
		};
		parentId = entry.id;
		return entry;
	});
}

/** 把聊天容器渲染为去除 ANSI 的纯文本；参数 container 为 TUI 容器；返回多行字符串。 */
function renderChat(container: Container): string {
	return stripAnsi(container.render(120).join("\n"));
}

// 验证会话条目重绘对工具 pending 注册表的维护。
describe("InteractiveMode.renderSessionEntries", () => {
	// 全组测试前初始化渲染依赖的主题。
	beforeAll(() => {
		initTheme("dark");
	});

	// 只有调用而无结果的历史重绘应保留 pending，以便后续实时事件更新组件。
	test("keeps unresolved rendered tool calls registered for live completion events", async () => {
		// fakeThis 是本用例的伪交互模式状态。
		const fakeThis = createFakeInteractiveModeThis();
		// renderSessionEntries 是从真实原型取得的待测渲染方法。
		const renderSessionEntries = (
			InteractiveMode.prototype as unknown as { renderSessionEntries: RenderSessionEntries }
		).renderSessionEntries;
		// handleEvent 是用于投递工具完成事件的真实内部方法。
		const handleEvent = (InteractiveMode.prototype as unknown as { handleEvent: HandleEvent }).handleEvent;

		renderSessionEntries.call(fakeThis, createSessionEntries([createAssistantToolCallMessage()]));

		expect(fakeThis.pendingTools.has(TOOL_CALL_ID)).toBe(true);

		await handleEvent.call(fakeThis, {
			type: "tool_execution_end",
			toolCallId: TOOL_CALL_ID,
			toolName: TOOL_NAME,
			result: { content: [{ type: "text", text: "FINAL_RESULT" }], details: undefined },
			isError: false,
		});

		expect(fakeThis.pendingTools.has(TOOL_CALL_ID)).toBe(false);
		expect(renderChat(fakeThis.chatContainer)).toContain("FINAL_RESULT");
	});

	// 调用与结果都在历史中时，重绘完成后不应保留 pending 项。
	test("does not keep completed historical tool calls registered as pending", () => {
		// fakeThis 是新的隔离渲染上下文。
		const fakeThis = createFakeInteractiveModeThis();
		// renderSessionEntries 是待测的真实原型方法。
		const renderSessionEntries = (
			InteractiveMode.prototype as unknown as { renderSessionEntries: RenderSessionEntries }
		).renderSessionEntries;

		renderSessionEntries.call(
			fakeThis,
			createSessionEntries([createAssistantToolCallMessage(), createToolResultMessage("HISTORICAL_RESULT")]),
		);

		expect(fakeThis.pendingTools.size).toBe(0);
		expect(renderChat(fakeThis.chatContainer)).toContain("HISTORICAL_RESULT");
	});
});
