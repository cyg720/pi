/**
 * 文件职责：验证交互模式启动早期提交的输入不会因回调尚未安装而丢失。
 * 技术维度：使用 Vitest 模拟编辑器、会话和私有原型方法的最小 this 上下文。
 * 产品维度：确保用户刚启动终端就输入提示词时，内容仍会进入历史记录并被后续处理。
 * 逻辑维度：先测试提交处理器将早期输入入队，再测试取输入方法优先消费队列。
 * 关键边界：测试只覆盖启动阶段普通提示词，不覆盖流式响应、压缩或 Bash 运行中的分支。
 * 新手阅读建议：先看三个测试专用类型，再看 createSubmitContext，最后对照两个队列断言。
 */
import { describe, expect, it, vi } from "vitest";
import { InteractiveMode } from "../src/modes/interactive/interactive-mode.ts";

/** 描述安装编辑器提交处理器所需的最小交互模式上下文。 */
type SubmitContext = {
	// defaultEditor 保存待安装的提交回调。
	defaultEditor: { onSubmit?: (text: string) => void };
	// editor 提供历史记录写入和输入框清空能力。
	editor: {
		addToHistory?: (text: string) => void;
		setText: (text: string) => void;
	};
	// session 提供当前运行状态和异步提示词提交方法。
	session: {
		isCompacting: boolean;
		isStreaming: boolean;
		isBashRunning: boolean;
		prompt: (text: string, options?: unknown) => Promise<void>;
	};
	// flushPendingBashComponents 刷新等待中的 Bash 界面组件。
	flushPendingBashComponents: () => void;
	// onInputCallback 是稍后安装的直接输入接收函数。
	onInputCallback?: (text: string) => void;
	// pendingUserInputs 保存回调尚未就绪时提交的用户文本。
	pendingUserInputs: string[];
};

/** 描述读取用户输入所需的最小队列上下文。 */
type InputContext = {
	// onInputCallback 是无排队输入时用于等待新文本的回调。
	onInputCallback?: (text: string) => void;
	// pendingUserInputs 是按提交顺序保存的启动输入队列。
	pendingUserInputs: string[];
};

/** 描述本测试借用的两个 InteractiveMode 私有方法签名。 */
type InteractiveModePrivate = {
	// 安装编辑器提交处理器；this 为 SubmitContext，无返回值。
	setupEditorSubmitHandler(this: SubmitContext): void;
	// 读取下一条用户输入；this 为 InputContext，返回输入文本 Promise。
	getUserInput(this: InputContext): Promise<string>;
};

// 保存按测试专用接口收窄后的原型，用于显式绑定模拟上下文。
const interactiveModePrototype = InteractiveMode.prototype as unknown as InteractiveModePrivate;

/**
 * 创建默认空闲状态的提交上下文。
 * 参数：无。
 * 返回值：包含模拟编辑器和会话的 SubmitContext。
 * 使用示例：`const context = createSubmitContext()`。
 */
function createSubmitContext(): SubmitContext {
	return {
		defaultEditor: {},
		editor: {
			addToHistory: vi.fn(),
			setText: vi.fn(),
		},
		session: {
			isCompacting: false,
			isStreaming: false,
			isBashRunning: false,
			prompt: vi.fn(async () => {}),
		},
		flushPendingBashComponents: vi.fn(),
		pendingUserInputs: [],
	};
}

describe("InteractiveMode startup input", () => {
	// 验证回调安装前提交的普通提示词会清理空白后入队；无参数，无返回值。
	it("queues a normal prompt submitted before the input callback is installed", async () => {
		// 创建用于安装提交处理器的空闲模拟上下文。
		const context = createSubmitContext();
		interactiveModePrototype.setupEditorSubmitHandler.call(context);

		await context.defaultEditor.onSubmit?.(" early prompt ");

		expect(context.pendingUserInputs).toEqual(["early prompt"]);
		expect(context.flushPendingBashComponents).toHaveBeenCalledTimes(1);
		expect(context.editor.addToHistory).toHaveBeenCalledWith("early prompt");
	});

	// 验证读取输入时优先返回已有队列项且不安装新回调；无参数，无返回值。
	it("returns queued startup input before installing a new input callback", async () => {
		// 构造含一条预排队提示词的最小输入上下文。
		const context: InputContext = {
			pendingUserInputs: ["queued prompt"],
		};

		await expect(interactiveModePrototype.getUserInput.call(context)).resolves.toBe("queued prompt");
		expect(context.onInputCallback).toBeUndefined();
		expect(context.pendingUserInputs).toEqual([]);
	});
});
