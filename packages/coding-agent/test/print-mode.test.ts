/**
 * 文件职责：验证打印模式在文本、JSON 和助手错误场景都会触发 session_shutdown，并返回正确退出码。
 * 技术维度：使用 Vitest、完整运行时/会话类型替身和模拟函数隔离 runPrintMode 的生命周期行为。
 * 产品维度：保证非交互 CLI 正常或失败退出时扩展都有机会清理资源，同时正确传递初始图片。
 * 逻辑维度：帮助函数创建助手消息和宿主替身；三个用例分别执行文本、JSON 与错误路径并检查 emit。
 * 关键边界：错误路径应返回 1 并输出 provider 错误；dispose 只发送一次 quit 原因的关闭事件。
 * 新手阅读建议：先看 FakeSession/FakeRuntimeHost 的最小接口，再跟踪 dispose 如何触发扩展事件。
 */
import type { AssistantMessage, ImageContent } from "@earendil-works/pi-ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SessionShutdownEvent } from "../src/index.ts";
import { runPrintMode } from "../src/modes/print-mode.ts";

// 关闭事件的简短别名，供模拟 emit 函数签名复用。
type EmitEvent = SessionShutdownEvent;

// 测试所需的扩展运行器最小接口。
type FakeExtensionRunner = {
	hasHandlers: (eventType: string) => boolean;
	emit: ReturnType<typeof vi.fn<(event: EmitEvent) => Promise<void>>>;
};

// runPrintMode 会访问的会话最小结构。
type FakeSession = {
	sessionManager: { getHeader: () => object | undefined };
	agent: { waitForIdle: () => Promise<void>; subscribe: ReturnType<typeof vi.fn> };
	state: { messages: AssistantMessage[] };
	extensionRunner: FakeExtensionRunner;
	bindExtensions: ReturnType<typeof vi.fn>;
	subscribe: ReturnType<typeof vi.fn>;
	prompt: ReturnType<typeof vi.fn>;
	reload: ReturnType<typeof vi.fn>;
};

// runPrintMode 接收的运行时宿主最小结构。
type FakeRuntimeHost = {
	session: FakeSession;
	newSession: ReturnType<typeof vi.fn>;
	fork: ReturnType<typeof vi.fn>;
	switchSession: ReturnType<typeof vi.fn>;
	dispose: ReturnType<typeof vi.fn>;
	setRebindSession: ReturnType<typeof vi.fn>;
};

/** 功能：创建测试助手消息；参数 options 可指定文本、停止原因和错误；返回：AssistantMessage。示例：createAssistantMessage({ text: "done" })。 */
function createAssistantMessage(options?: {
	text?: string;
	stopReason?: AssistantMessage["stopReason"];
	errorMessage?: string;
}): AssistantMessage {
	return {
		role: "assistant",
		content: options?.text ? [{ type: "text", text: options.text }] : [],
		api: "openai-responses",
		provider: "openai",
		model: "gpt-4o-mini",
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: options?.stopReason ?? "stop",
		errorMessage: options?.errorMessage,
		timestamp: Date.now(),
	};
}

/** 功能：创建持有一条助手消息的运行时替身；参数 assistantMessage；返回：FakeRuntimeHost。示例：createRuntimeHost(message)。 */
function createRuntimeHost(assistantMessage: AssistantMessage): FakeRuntimeHost {
	// 只声明支持 session_shutdown 的扩展运行器替身。
	const extensionRunner: FakeExtensionRunner = {
		hasHandlers: (eventType: string) => eventType === "session_shutdown",
		emit: vi.fn(async () => {}),
	};

	// 会话状态中的唯一助手消息数组。
	const state = { messages: [assistantMessage] };

	// 打印模式所需方法均为无副作用模拟的会话替身。
	const session: FakeSession = {
		sessionManager: { getHeader: () => undefined },
		agent: { waitForIdle: async () => {}, subscribe: vi.fn(() => () => {}) },
		state,
		extensionRunner,
		bindExtensions: vi.fn(async () => {}),
		subscribe: vi.fn(() => () => {}),
		prompt: vi.fn(async () => {}),
		reload: vi.fn(async () => {}),
	};

	return {
		session,
		newSession: vi.fn(async () => undefined),
		fork: vi.fn(async () => ({ selectedText: "" })),
		switchSession: vi.fn(async () => undefined),
		dispose: vi.fn(async () => {
			await session.extensionRunner.emit({ type: "session_shutdown", reason: "quit" });
		}),
		setRebindSession: vi.fn(),
	};
}

// 功能：恢复所有 Vitest 模拟；参数：无；返回：无。示例：每个用例后自动调用。
afterEach(() => {
	vi.restoreAllMocks();
});

describe("runPrintMode", () => {
	it("emits session_shutdown in text mode", async () => {
		// 返回 done 文本的运行时宿主。
		const runtimeHost = createRuntimeHost(createAssistantMessage({ text: "done" }));
		// 便于断言调用的会话引用。
		const { session } = runtimeHost;
		// 随首条文本提示传入的测试图片。
		const images: ImageContent[] = [{ type: "image", mimeType: "image/png", data: "abc" }];

		// 文本模式完成后的进程退出码。
		const exitCode = await runPrintMode(runtimeHost as unknown as Parameters<typeof runPrintMode>[0], {
			mode: "text",
			initialMessage: "Say done",
			initialImages: images,
		});

		expect(exitCode).toBe(0);
		expect(session.prompt).toHaveBeenCalledWith("Say done", { images });
		expect(session.extensionRunner.emit).toHaveBeenCalledTimes(1);
		expect(session.extensionRunner.emit).toHaveBeenCalledWith({ type: "session_shutdown", reason: "quit" });
	});

	it("emits session_shutdown in json mode", async () => {
		// JSON 模式使用的运行时宿主。
		const runtimeHost = createRuntimeHost(createAssistantMessage({ text: "done" }));
		// 便于断言调用的会话引用。
		const { session } = runtimeHost;

		// JSON 模式完成后的退出码。
		const exitCode = await runPrintMode(runtimeHost as unknown as Parameters<typeof runPrintMode>[0], {
			mode: "json",
			messages: ["hello"],
		});

		expect(exitCode).toBe(0);
		expect(session.prompt).toHaveBeenCalledWith("hello");
		expect(session.extensionRunner.emit).toHaveBeenCalledTimes(1);
		expect(session.extensionRunner.emit).toHaveBeenCalledWith({ type: "session_shutdown", reason: "quit" });
	});

	it("emits session_shutdown and returns non-zero on assistant error", async () => {
		// 包含 provider failure 助手错误的运行时宿主。
		const runtimeHost = createRuntimeHost(
			createAssistantMessage({ stopReason: "error", errorMessage: "provider failure" }),
		);
		// 便于断言关闭事件的会话引用。
		const { session } = runtimeHost;
		// 静默捕获 console.error 的模拟函数。
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		// 错误消息导致的非零退出码。
		const exitCode = await runPrintMode(runtimeHost as unknown as Parameters<typeof runPrintMode>[0], {
			mode: "text",
		});

		expect(exitCode).toBe(1);
		expect(errorSpy).toHaveBeenCalledWith("provider failure");
		expect(session.extensionRunner.emit).toHaveBeenCalledTimes(1);
		expect(session.extensionRunner.emit).toHaveBeenCalledWith({ type: "session_shutdown", reason: "quit" });
	});
});
