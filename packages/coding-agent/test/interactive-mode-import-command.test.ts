/**
 * 文件职责：验证交互模式 /import 路径解析、引号/撇号保留、命令边界和文件不存在错误处理。
 * 技术维度：使用 Vitest、InteractiveMode 原型方法和最小上下文替身直接调用内部命令处理器。
 * 产品维度：让用户可安全导入含空格或撇号的会话路径，并在输错路径时得到非致命提示。
 * 逻辑维度：前三例测试纯解析；后三例构造 runtimeHost 与 UI 模拟，检查确认、调用和错误分支。
 * 关键边界：/important 不得误识别为 /import；外层双引号应剥离，路径内部撇号保持原样。
 * 新手阅读建议：先读 PathCommand 与 getPathCommandArgument 三例，再看 handleImportCommand 所需上下文。
 */
import { describe, expect, it, vi } from "vitest";
import { SessionImportFileNotFoundError } from "../src/core/agent-session-runtime.ts";
import { InteractiveMode } from "../src/modes/interactive/interactive-mode.ts";

// 支持路径参数的两个交互命令字面量类型。
type PathCommand = "/export" | "/import";

// 从 InteractiveMode 原型中抽取的两个被测方法签名。
type InteractiveModePrototype = {
	getPathCommandArgument(this: unknown, text: string, command: PathCommand): string | undefined;
	handleImportCommand(this: ImportCommandContext, text: string): Promise<void>;
};

// handleImportCommand 直接调用时所需的最小 this 结构。
type ImportCommandContext = {
	clearStatusIndicator: () => void;
	runtimeHost: { importFromJsonl: (inputPath: string, cwdOverride?: string) => Promise<{ cancelled: boolean }> };
	showError: (message: string) => void;
	showStatus: (message: string) => void;
	showExtensionConfirm: (title: string, message: string) => Promise<boolean>;
	handleRuntimeSessionChange: () => Promise<void>;
	renderCurrentSessionState: () => void;
	handleFatalRuntimeError: (prefix: string, error: unknown) => Promise<never>;
	promptForMissingSessionCwd: (error: unknown) => Promise<string | undefined>;
	getPathCommandArgument: (text: string, command: PathCommand) => string | undefined;
};

// 类型收窄后的 InteractiveMode 原型引用。
const interactiveModePrototype = InteractiveMode.prototype as unknown as InteractiveModePrototype;

describe("InteractiveMode /import parsing", () => {
	it("strips quotes from /import path arguments", () => {
		expect(interactiveModePrototype.getPathCommandArgument('/import "path/to/session.jsonl"', "/import")).toBe(
			"path/to/session.jsonl",
		);
		expect(
			interactiveModePrototype.getPathCommandArgument('/import "path with spaces/session.jsonl"', "/import"),
		).toBe("path with spaces/session.jsonl");
	});

	it("preserves apostrophes in unquoted /import path arguments", () => {
		expect(interactiveModePrototype.getPathCommandArgument("/import john's/session.jsonl", "/import")).toBe(
			"john's/session.jsonl",
		);
	});

	it("enforces command token boundaries", () => {
		expect(interactiveModePrototype.getPathCommandArgument("/important /tmp/session.jsonl", "/import")).toBe(
			undefined,
		);
		expect(interactiveModePrototype.getPathCommandArgument("/exporter out.html", "/export")).toBe(undefined);
		expect(interactiveModePrototype.getPathCommandArgument("/import /tmp/session.jsonl", "/import")).toBe(
			"/tmp/session.jsonl",
		);
	});

	it("passes unquoted path to runtimeHost.importFromJsonl", async () => {
		// 模拟成功导入 JSONL 的运行时方法。
		const importFromJsonl = vi.fn(async () => ({ cancelled: false }));
		// 始终确认替换当前会话的确认框。
		const showExtensionConfirm = vi.fn(async () => true);
		// 收集成功状态文本的模拟函数。
		const showStatus = vi.fn();
		// 收集非致命错误的模拟函数。
		const showError = vi.fn();

		// 调用导入处理器所需的完整最小上下文。
		const context: ImportCommandContext = {
			clearStatusIndicator: vi.fn(),
			runtimeHost: { importFromJsonl },
			showError,
			showStatus,
			showExtensionConfirm,
			handleRuntimeSessionChange: vi.fn(async () => {}),
			renderCurrentSessionState: vi.fn(),
			handleFatalRuntimeError: vi.fn(async () => {
				throw new Error("unexpected fatal error");
			}),
			promptForMissingSessionCwd: vi.fn(async () => undefined),
			getPathCommandArgument: interactiveModePrototype.getPathCommandArgument,
		};

		await interactiveModePrototype.handleImportCommand.call(context, '/import "path/to/session.jsonl"');

		expect(showExtensionConfirm).toHaveBeenCalledWith(
			"Import session",
			"Replace current session with path/to/session.jsonl?",
		);
		expect(importFromJsonl).toHaveBeenCalledWith("path/to/session.jsonl");
		expect(showError).not.toHaveBeenCalled();
		expect(showStatus).toHaveBeenCalledWith("Session imported from: path/to/session.jsonl");
	});

	it("passes unquoted apostrophe path to runtimeHost.importFromJsonl unchanged", async () => {
		// 撇号路径场景的成功导入模拟。
		const importFromJsonl = vi.fn(async () => ({ cancelled: false }));
		// 始终确认导入的模拟函数。
		const showExtensionConfirm = vi.fn(async () => true);
		// 成功状态模拟函数。
		const showStatus = vi.fn();
		// 错误状态模拟函数。
		const showError = vi.fn();

		// 撇号路径导入场景上下文。
		const context: ImportCommandContext = {
			clearStatusIndicator: vi.fn(),
			runtimeHost: { importFromJsonl },
			showError,
			showStatus,
			showExtensionConfirm,
			handleRuntimeSessionChange: vi.fn(async () => {}),
			renderCurrentSessionState: vi.fn(),
			handleFatalRuntimeError: vi.fn(async () => {
				throw new Error("unexpected fatal error");
			}),
			promptForMissingSessionCwd: vi.fn(async () => undefined),
			getPathCommandArgument: interactiveModePrototype.getPathCommandArgument,
		};

		await interactiveModePrototype.handleImportCommand.call(context, "/import john's/session.jsonl");

		expect(importFromJsonl).toHaveBeenCalledWith("john's/session.jsonl");
		expect(showError).not.toHaveBeenCalled();
		expect(showStatus).toHaveBeenCalledWith("Session imported from: john's/session.jsonl");
	});

	it("shows a non-fatal error when /import path does not exist", async () => {
		// 始终抛出专用文件不存在错误的导入模拟。
		const importFromJsonl = vi.fn(async () => {
			throw new SessionImportFileNotFoundError("/tmp/missing-session.jsonl");
		});
		// 文件不存在场景仍先确认导入。
		const showExtensionConfirm = vi.fn(async () => true);
		// 不应被调用的成功状态模拟。
		const showStatus = vi.fn();
		// 应接收可读失败消息的错误模拟。
		const showError = vi.fn();
		// 只有未知致命错误才会调用的模拟。
		const handleFatalRuntimeError = vi.fn(async () => {
			throw new Error("unexpected fatal error");
		});

		// 文件不存在错误场景上下文。
		const context: ImportCommandContext = {
			clearStatusIndicator: vi.fn(),
			runtimeHost: { importFromJsonl },
			showError,
			showStatus,
			showExtensionConfirm,
			handleRuntimeSessionChange: vi.fn(async () => {}),
			renderCurrentSessionState: vi.fn(),
			handleFatalRuntimeError,
			promptForMissingSessionCwd: vi.fn(async () => undefined),
			getPathCommandArgument: interactiveModePrototype.getPathCommandArgument,
		};

		await interactiveModePrototype.handleImportCommand.call(context, "/import /tmp/missing-session.jsonl");

		expect(showError).toHaveBeenCalledWith("Failed to import session: File not found: /tmp/missing-session.jsonl");
		expect(showStatus).not.toHaveBeenCalled();
		expect(handleFatalRuntimeError).not.toHaveBeenCalled();
	});
});
