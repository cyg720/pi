/**
 * 文件职责：验证会话选择器的重命名提示开关、Ctrl+R 进入编辑模式和提交行为。
 * 技术维度：使用 Vitest、模拟重命名回调、Kitty 键盘协议编码和异步组件刷新。
 * 产品维度：保证交互式 `/resume` 可重命名会话，而非交互启动选择器不显示无效提示。
 * 逻辑维度：构造最小 SessionInfo，创建不同配置选择器，等待加载后检查渲染或输入结果。
 * 关键边界：键位是全局单例需逐例重置；组件异步加载通过 setImmediate 刷新微任务。
 * 新手阅读建议：先看 makeSession 和 CTRL_R，再比较 showRenameHint 两例与实际提交用例。
 */
import { setKeybindings } from "@earendil-works/pi-tui";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { KeybindingsManager } from "../src/core/keybindings.ts";
import type { SessionInfo } from "../src/core/session-manager.ts";
import { SessionSelectorComponent } from "../src/modes/interactive/components/session-selector.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";

/** 等待 setImmediate 队列完成；无参数，返回 Promise。 */
async function flushPromises(): Promise<void> {
	// resolve 是 setImmediate 执行时完成 Promise 的回调。
	await new Promise<void>((resolve) => {
		setImmediate(resolve);
	});
}

/**
 * 创建带默认字段的 SessionInfo。
 * 参数：overrides 必须含 id，可覆盖其余字段。
 * 返回值：完整会话信息。
 * 使用示例：`makeSession({ id: "a", name: "Old" })`。
 */
function makeSession(overrides: Partial<SessionInfo> & { id: string }): SessionInfo {
	return {
		path: overrides.path ?? `/tmp/${overrides.id}.jsonl`,
		id: overrides.id,
		cwd: overrides.cwd ?? "",
		name: overrides.name,
		created: overrides.created ?? new Date(0),
		modified: overrides.modified ?? new Date(0),
		messageCount: overrides.messageCount ?? 1,
		firstMessage: overrides.firstMessage ?? "hello",
		allMessagesText: overrides.allMessagesText ?? "hello",
	};
}

// Kitty keyboard protocol encoding for Ctrl+R

// Kitty 键盘协议下 Ctrl+R 的编码常量。
const CTRL_R = "\x1b[114;5u";

describe("session selector rename", () => {
	// 测试组开始前初始化深色主题；无参数，无返回值。
	beforeAll(() => {
		initTheme("dark");
	});

	beforeEach(() => {
		// Ensure test isolation: keybindings are a global singleton
		// 键位是全局单例，每例重置以确保隔离。
		setKeybindings(new KeybindingsManager());
	});

	// 验证交互式恢复选择器显示重命名提示；无参数，无返回值。
	it("shows rename hint in interactive /resume picker configuration", async () => {
		// sessions 是选择器异步加载的单会话列表。
		const sessions = [makeSession({ id: "a" })];
		// keybindings 提供默认重命名快捷键。
		const keybindings = new KeybindingsManager();
		// selector 启用 showRenameHint 的会话选择器。
		const selector = new SessionSelectorComponent(
			async () => sessions,
			async () => [],
			() => {},
			() => {},
			() => {},
			() => {},
			{ showRenameHint: true, keybindings },
		);
		await flushPromises();

		// output 是选择器加载完成后的渲染文本。
		const output = selector.render(120).join("\n");
		expect(output).toContain("ctrl+r");
		expect(output).toContain("rename");
	});

	// 验证非交互恢复选择器隐藏重命名提示；无参数，无返回值。
	it("does not show rename hint in --resume picker configuration", async () => {
		// sessions 是选择器异步加载的单会话列表。
		const sessions = [makeSession({ id: "a" })];
		// keybindings 提供默认快捷键映射。
		const keybindings = new KeybindingsManager();
		// selector 关闭 showRenameHint。
		const selector = new SessionSelectorComponent(
			async () => sessions,
			async () => [],
			() => {},
			() => {},
			() => {},
			() => {},
			{ showRenameHint: false, keybindings },
		);
		await flushPromises();

		// output 是用于确认提示缺失的渲染文本。
		const output = selector.render(120).join("\n");
		expect(output).not.toContain("ctrl+r");
		expect(output).not.toContain("rename");
	});

	// 验证 Ctrl+R 进入重命名并以 Enter 提交编辑文本；无参数，无返回值。
	it("enters rename mode on Ctrl+R and submits with Enter", async () => {
		// sessions 包含名为 Old 的目标会话。
		const sessions = [makeSession({ id: "a", name: "Old" })];
		// renameSession 记录最终文件路径和新名称。
		const renameSession = vi.fn(async () => {});

		// keybindings 提供 Ctrl+R 和确认键配置。
		const keybindings = new KeybindingsManager();
		// selector 是启用实际重命名回调的选择器。
		const selector = new SessionSelectorComponent(
			async () => sessions,
			async () => [],
			() => {},
			() => {},
			() => {},
			() => {},
			{ renameSession, showRenameHint: true, keybindings },
		);
		await flushPromises();

		selector.getSessionList().handleInput(CTRL_R);
		await flushPromises();

		// Rename mode layout
		// 检查重命名模式布局。
		// output 是进入重命名模式后的渲染文本。
		const output = selector.render(120).join("\n");
		expect(output).toContain("Rename Session");
		expect(output).not.toContain("Resume Session");

		// Type and submit
		// 输入字符并提交新名称。
		selector.handleInput("X");
		selector.handleInput("\r");
		await flushPromises();

		expect(renameSession).toHaveBeenCalledTimes(1);
		expect(renameSession).toHaveBeenCalledWith(sessions[0]!.path, "XOld");
	});
});
