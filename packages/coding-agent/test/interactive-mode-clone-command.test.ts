/**
 * 文件职责：验证交互模式 `/clone` 命令在可克隆与无会话节点两种状态下的行为。
 * 技术维度：使用 Vitest 模拟函数和显式 this 上下文，隔离调用 InteractiveMode 的内部方法。
 * 产品维度：保证用户复制当前会话时得到新会话，并在无内容可复制时看到清晰提示。
 * 逻辑维度：构造最小命令上下文，借用原型方法执行，再检查分叉调用和界面副作用。
 * 关键边界：测试依赖内部原型方法签名；上下文只模拟本命令需要的成员，不代表完整交互模式。
 * 新手阅读建议：先看两个最小类型，再比较成功用例与空节点用例对模拟函数的不同断言。
 */
import { describe, expect, it, vi } from "vitest";
import { InteractiveMode } from "../src/modes/interactive/interactive-mode.ts";

/** 描述调用克隆命令所需的最小运行上下文，便于脱离完整终端界面测试。 */
type CloneCommandContext = {
	// sessionManager 提供当前叶节点标识；null 表示尚无可克隆节点。
	sessionManager: { getLeafId: () => string | null };
	// runtimeHost 负责按节点标识创建分叉会话，并返回用户是否取消。
	runtimeHost: {
		fork: (entryId: string, options?: { position?: "before" | "at" }) => Promise<{ cancelled: boolean }>;
	};
	// renderCurrentSessionState 用于重新渲染当前会话状态。
	renderCurrentSessionState: () => void;
	// editor 提供写入输入框文本的能力。
	editor: { setText: (text: string) => void };
	// showStatus 显示普通状态提示。
	showStatus: (message: string) => void;
	// showError 显示错误提示。
	showError: (message: string) => void;
	// ui 提供请求界面重新渲染的入口。
	ui: { requestRender: () => void };
};

/** 描述本测试从 InteractiveMode 原型借用的克隆方法签名。 */
type InteractiveModePrototype = {
	/**
	 * 使用传入的最小上下文执行克隆命令。
	 * 参数：this 为 CloneCommandContext。
	 * 返回值：命令完成后解决的 Promise。
	 * 使用示例：`interactiveModePrototype.handleCloneCommand.call(context)`。
	 */
	handleCloneCommand(this: CloneCommandContext): Promise<void>;
};

// 保存经过测试专用类型收窄的 InteractiveMode 原型，以便显式绑定模拟上下文。
const interactiveModePrototype = InteractiveMode.prototype as unknown as InteractiveModePrototype;

describe("InteractiveMode /clone", () => {
	// 验证当前叶节点会在原位置创建分叉并清空编辑器；无参数，无返回值。
	it("clones the current leaf into a new session", async () => {
		// 模拟运行时分叉函数，并返回未取消结果。
		const fork = vi.fn(async () => ({ cancelled: false }));
		// 模拟当前会话重新渲染函数。
		const renderCurrentSessionState = vi.fn();
		// 模拟编辑器文本写入函数。
		const setText = vi.fn();
		// 模拟普通状态提示函数。
		const showStatus = vi.fn();
		// 模拟错误提示函数。
		const showError = vi.fn();
		// 模拟界面重绘请求函数。
		const requestRender = vi.fn();

		// 组合成功路径所需的最小命令上下文。
		const context: CloneCommandContext = {
			sessionManager: { getLeafId: () => "leaf-123" },
			runtimeHost: { fork },
			renderCurrentSessionState,
			editor: { setText },
			showStatus,
			showError,
			ui: { requestRender },
		};

		await interactiveModePrototype.handleCloneCommand.call(context);

		expect(fork).toHaveBeenCalledWith("leaf-123", { position: "at" });
		expect(renderCurrentSessionState).not.toHaveBeenCalled();
		expect(setText).toHaveBeenCalledWith("");
		expect(showStatus).toHaveBeenCalledWith("Cloned to new session");
		expect(showError).not.toHaveBeenCalled();
		expect(requestRender).not.toHaveBeenCalled();
	});

	// 验证没有当前叶节点时只显示提示且不创建分叉；无参数，无返回值。
	it("shows a status message when there is nothing to clone", async () => {
		// 模拟分叉函数；本路径预期不会调用它。
		const fork = vi.fn(async () => ({ cancelled: false }));
		// 模拟普通状态提示函数。
		const showStatus = vi.fn();
		// 模拟错误提示函数。
		const showError = vi.fn();

		// 组合 getLeafId 返回 null 的空会话上下文。
		const context: CloneCommandContext = {
			sessionManager: { getLeafId: () => null },
			runtimeHost: { fork },
			renderCurrentSessionState: vi.fn(),
			editor: { setText: vi.fn() },
			showStatus,
			showError,
			ui: { requestRender: vi.fn() },
		};

		await interactiveModePrototype.handleCloneCommand.call(context);

		expect(fork).not.toHaveBeenCalled();
		expect(showStatus).toHaveBeenCalledWith("Nothing to clone yet");
		expect(showError).not.toHaveBeenCalled();
	});
});
