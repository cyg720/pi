/**
 * 文件职责：验证交互模式处理压缩完成事件和刷新压缩期间排队消息的行为。
 * 技术维度：使用 Vitest、Reflect 访问私有原型方法和最小 this 模拟对象隔离界面逻辑。
 * 产品维度：保证压缩后聊天区显示摘要，并让用户在压缩期间输入的转向消息正确续接。
 * 逻辑维度：第一例调用 handleEvent 重建聊天，第二例调用 flushCompactionQueue 检查 steer 分派。
 * 关键边界：测试依赖两个内部方法及其最小上下文形状；不启动真实 TUI 或模型请求。
 * 新手阅读建议：先看 fakeThis 中哪些方法被断言，再对照 Reflect.get 的事件和选项类型。
 */
import { describe, expect, test, vi } from "vitest";
import { InteractiveMode } from "../src/modes/interactive/interactive-mode.ts";

describe("InteractiveMode compaction events", () => {
	// 验证压缩结束会重建聊天并在底部追加合成摘要；无参数，无返回值。
	test("rebuilds chat and appends a synthetic compaction summary at the bottom", async () => {
		// fakeThis 是 handleEvent 压缩分支所需的最小交互模式上下文。
		const fakeThis = {
			isInitialized: true,
			footer: { invalidate: vi.fn() },
			autoCompactionEscapeHandler: undefined as (() => void) | undefined,
			autoCompactionLoader: undefined,
			defaultEditor: {},
			statusContainer: { clear: vi.fn() },
			chatContainer: { clear: vi.fn() },
			rebuildChatFromMessages: vi.fn(),
			addMessageToChat: vi.fn(),
			showError: vi.fn(),
			showStatus: vi.fn(),
			clearStatusIndicator: vi.fn(),
			flushCompactionQueue: vi.fn().mockResolvedValue(undefined),
			settingsManager: { getShowTerminalProgress: () => false },
			ui: { requestRender: vi.fn(), terminal: { setProgress: vi.fn() } },
		};

		// handleEvent 是从原型取得并按 fakeThis 事件形状声明的私有异步方法。
		const handleEvent = Reflect.get(InteractiveMode.prototype, "handleEvent") as (
			this: typeof fakeThis,
			event: {
				type: "compaction_end";
				reason: "manual" | "threshold" | "overflow";
				result: { tokensBefore: number; summary: string } | undefined;
				aborted: boolean;
				willRetry: boolean;
				errorMessage?: string;
			},
		) => Promise<void>;

		await handleEvent.call(fakeThis, {
			type: "compaction_end",
			reason: "manual",
			result: {
				tokensBefore: 123,
				summary: "summary",
			},
			aborted: false,
			willRetry: false,
		});

		expect(fakeThis.chatContainer.clear).toHaveBeenCalledTimes(1);
		expect(fakeThis.rebuildChatFromMessages).toHaveBeenCalledTimes(1);
		expect(fakeThis.addMessageToChat).toHaveBeenCalledTimes(1);
		expect(fakeThis.addMessageToChat).toHaveBeenCalledWith(
			expect.objectContaining({
				role: "compactionSummary",
				tokensBefore: 123,
				summary: "summary",
			}),
		);
		expect(fakeThis.flushCompactionQueue).toHaveBeenCalledWith({ willRetry: false });
	});

	// 验证活动代理运行中刷新 steer 消息会保留转向语义；无参数，无返回值。
	test("preserves steering behavior when flushing into an active agent run", async () => {
		// fakeThis 是含一条 steer 排队消息和会话模拟方法的最小上下文。
		const fakeThis = {
			compactionQueuedMessages: [{ text: "change direction", mode: "steer" as const }],
			session: {
				clearQueue: vi.fn(),
				prompt: vi.fn().mockResolvedValue(undefined),
				steer: vi.fn().mockResolvedValue(undefined),
				followUp: vi.fn().mockResolvedValue(undefined),
			},
			isExtensionCommand: vi.fn().mockReturnValue(false),
			updatePendingMessagesDisplay: vi.fn(),
			showError: vi.fn(),
		};

		// flushCompactionQueue 是从原型取得并绑定到第二个 fakeThis 的私有方法。
		const flushCompactionQueue = Reflect.get(InteractiveMode.prototype, "flushCompactionQueue") as (
			this: typeof fakeThis,
			options?: { willRetry?: boolean },
		) => Promise<void>;

		await flushCompactionQueue.call(fakeThis, { willRetry: false });

		expect(fakeThis.session.prompt).toHaveBeenCalledWith("change direction", { streamingBehavior: "steer" });
		expect(fakeThis.compactionQueuedMessages).toEqual([]);
		expect(fakeThis.showError).not.toHaveBeenCalled();
	});
});
