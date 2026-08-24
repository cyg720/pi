/**
 * 文件职责：验证捕获与非捕获覆盖层在创建、聚焦、隐藏、移除、输入路由和视觉层级变化时的行为。
 * 技术维度：使用 Node test、虚拟终端、可聚焦测试组件和真实 TUI 覆盖层句柄执行交互回归测试。
 * 产品维度：保证弹窗、计时器和扩展界面叠加时，用户输入不会被被动覆盖层抢走且焦点能正确恢复。
 * 逻辑维度：先定义三种最小组件，再按焦点管理、空操作保护、循环预防和渲染顺序分组覆盖复杂序列。
 * 关键边界：焦点断言高度依赖操作先后与异步刷新；每个用例必须停止 TUI，覆盖层可见性回调也要保持确定。
 * 新手阅读建议：先读三个测试组件与 renderAndFlush，再看单覆盖层用例，最后阅读多覆盖层、替换焦点和循环场景。
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import type { Component, Focusable } from "../src/tui.ts";
import { Container, TUI } from "../src/tui.ts";
import { VirtualTerminal } from "./virtual-terminal.ts";

/** StaticOverlay 渲染固定文本行，用于只关注视觉层级而不需要输入能力的覆盖层测试。 */
class StaticOverlay implements Component {
	/** lines 保存覆盖层固定显示内容，由构造函数传入。 */
	private lines: string[];

	/** 初始化固定覆盖层；参数 lines 为完整显示行数组。例如：new StaticOverlay(["A"])。 */
	constructor(lines: string[]) {
		this.lines = lines;
	}

	/** 返回固定行数组；无参数。例如：overlay.render()。 */
	render(): string[] {
		return this.lines;
	}

	/** 本夹具无缓存，失效操作为空；无参数、无返回值。例如：overlay.invalidate()。 */
	invalidate(): void {}
}

/** EmptyContent 提供空的基础内容层，使测试只观察覆盖层焦点与渲染。 */
class EmptyContent implements Component {
	/** 返回空行数组；无参数。例如：content.render()。 */
	render(): string[] {
		return [];
	}
	/** 本夹具无缓存，失效操作为空；无参数、无返回值。例如：content.invalidate()。 */
	invalidate(): void {}
}

/** FocusableOverlay 记录焦点和输入，作为编辑器、覆盖层及替换组件的统一测试夹具。 */
class FocusableOverlay implements Component, Focusable {
	/** focused 表示组件当前是否持有输入焦点。 */
	focused = false;
	/** inputs 保存收到的原始输入序列，供路由断言使用。 */
	inputs: string[] = [];
	/** lines 保存该覆盖层的固定可见内容。 */
	private lines: string[];

	/** 初始化可聚焦覆盖层；参数 lines 为显示行数组。例如：new FocusableOverlay(["EDITOR"])。 */
	constructor(lines: string[]) {
		this.lines = lines;
	}

	/** 记录终端输入；参数 data 为原始输入文本，无返回值。例如：overlay.handleInput("x")。 */
	handleInput(data: string): void {
		this.inputs.push(data);
	}

	/** 返回固定显示行；无参数。例如：overlay.render()。 */
	render(): string[] {
		return this.lines;
	}

	/** 本夹具无缓存，失效操作为空；无参数、无返回值。例如：overlay.invalidate()。 */
	invalidate(): void {}
}

/** renderAndFlush 执行当前测试辅助步骤；参数 tui、terminal 按签名提供输入，返回值供调用方断言。示例：renderAndFlush(..., ...)。 */
async function renderAndFlush(tui: TUI, terminal: VirtualTerminal): Promise<void> {
	tui.requestRender(true);
	await new Promise<void>((resolve) => process.nextTick(resolve));
	await terminal.waitForRender();
}

// 用例分组：集中验证“TUI overlay non-capturing”相关功能。
describe("TUI overlay non-capturing", () => {
	// 用例分组：集中验证“focus management”相关功能。
	describe("focus management", () => {
		// 测试场景：验证“non-capturing overlay preserves focus on creation”对应的行为、结果与边界。
		it("non-capturing overlay preserves focus on creation", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			/** 常量 overlay 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const overlay = new FocusableOverlay(["OVERLAY"]);
			tui.addChild(new EmptyContent());
			tui.setFocus(editor);
			tui.start();
			try {
				tui.showOverlay(overlay, { nonCapturing: true });
				await renderAndFlush(tui, terminal);
				assert.strictEqual(editor.focused, true);
				assert.strictEqual(overlay.focused, false);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“focus() transfers focus to the overlay”对应的行为、结果与边界。
		it("focus() transfers focus to the overlay", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			/** 常量 overlay 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const overlay = new FocusableOverlay(["OVERLAY"]);
			tui.addChild(new EmptyContent());
			tui.setFocus(editor);
			tui.start();
			try {
				/** 常量 handle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const handle = tui.showOverlay(overlay, { nonCapturing: true });
				handle.focus();
				await renderAndFlush(tui, terminal);
				assert.strictEqual(editor.focused, false);
				assert.strictEqual(overlay.focused, true);
				assert.strictEqual(handle.isFocused(), true);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“unfocus() restores previous focus”对应的行为、结果与边界。
		it("unfocus() restores previous focus", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			/** 常量 overlay 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const overlay = new FocusableOverlay(["OVERLAY"]);
			tui.addChild(new EmptyContent());
			tui.setFocus(editor);
			tui.start();
			try {
				/** 常量 handle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const handle = tui.showOverlay(overlay, { nonCapturing: true });
				handle.focus();
				handle.unfocus();
				await renderAndFlush(tui, terminal);
				assert.strictEqual(editor.focused, true);
				assert.strictEqual(overlay.focused, false);
				assert.strictEqual(handle.isFocused(), false);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“setHidden(false) on non-capturing overlay does not auto-focus”对应的行为、结果与边界。
		it("setHidden(false) on non-capturing overlay does not auto-focus", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			/** 常量 overlay 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const overlay = new FocusableOverlay(["OVERLAY"]);
			tui.addChild(new EmptyContent());
			tui.setFocus(editor);
			tui.start();
			try {
				/** 常量 handle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const handle = tui.showOverlay(overlay, { nonCapturing: true });
				handle.setHidden(true);
				handle.setHidden(false);
				await renderAndFlush(tui, terminal);
				assert.strictEqual(editor.focused, true);
				assert.strictEqual(overlay.focused, false);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“hide() when overlay is not focused does not change focus”对应的行为、结果与边界。
		it("hide() when overlay is not focused does not change focus", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			/** 常量 overlay 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const overlay = new FocusableOverlay(["OVERLAY"]);
			tui.addChild(new EmptyContent());
			tui.setFocus(editor);
			tui.start();
			try {
				/** 常量 handle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const handle = tui.showOverlay(overlay, { nonCapturing: true });
				handle.hide();
				await renderAndFlush(tui, terminal);
				assert.strictEqual(editor.focused, true);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“hide() when focused restores focus correctly”对应的行为、结果与边界。
		it("hide() when focused restores focus correctly", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			/** 常量 overlay 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const overlay = new FocusableOverlay(["OVERLAY"]);
			tui.addChild(new EmptyContent());
			tui.setFocus(editor);
			tui.start();
			try {
				/** 常量 handle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const handle = tui.showOverlay(overlay, { nonCapturing: true });
				handle.focus();
				handle.hide();
				await renderAndFlush(tui, terminal);
				assert.strictEqual(editor.focused, true);
				assert.strictEqual(overlay.focused, false);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“capturing overlay removed with non-capturing below restores focus to editor”对应的行为、结果与边界。
		it("capturing overlay removed with non-capturing below restores focus to editor", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			/** 常量 nonCapturing 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const nonCapturing = new FocusableOverlay(["NC"]);
			/** 常量 capturing 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const capturing = new FocusableOverlay(["CAP"]);
			tui.addChild(new EmptyContent());
			tui.setFocus(editor);
			tui.start();
			try {
				tui.showOverlay(nonCapturing, { nonCapturing: true });
				/** 常量 handle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const handle = tui.showOverlay(capturing);
				assert.strictEqual(capturing.focused, true);
				handle.hide();
				await renderAndFlush(tui, terminal);
				assert.strictEqual(editor.focused, true);
				assert.strictEqual(nonCapturing.focused, false);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“sub-overlay cleanup then hideOverlay restores focus and input to editor”对应的行为、结果与边界。
		it("sub-overlay cleanup then hideOverlay restores focus and input to editor", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			/** 常量 timer 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const timer = new FocusableOverlay(["TIMER"]);
			/** 常量 controller 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const controller = new FocusableOverlay(["CTRL"]);
			tui.addChild(new EmptyContent());
			tui.setFocus(editor);
			tui.start();
			try {
				/** 常量 timerHandle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const timerHandle = tui.showOverlay(timer, { nonCapturing: true });
				tui.showOverlay(controller);
				assert.strictEqual(controller.focused, true);
				assert.strictEqual(editor.focused, false);
				timerHandle.hide();
				tui.hideOverlay();
				await renderAndFlush(tui, terminal);
				assert.strictEqual(editor.focused, true);
				assert.strictEqual(controller.focused, false);
				assert.strictEqual(timer.focused, false);
				terminal.sendInput("x");
				await renderAndFlush(tui, terminal);
				assert.deepStrictEqual(editor.inputs, ["x"]);
				assert.deepStrictEqual(controller.inputs, []);
				assert.deepStrictEqual(timer.inputs, []);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“removed focused child overlay does not become parent overlay fallback”对应的行为、结果与边界。
		it("removed focused child overlay does not become parent overlay fallback", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			/** 常量 child 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const child = new FocusableOverlay(["CHILD"]);
			/** 常量 parent 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const parent = new FocusableOverlay(["PARENT"]);
			tui.addChild(new EmptyContent());
			tui.setFocus(editor);
			tui.start();
			try {
				/** 常量 childHandle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const childHandle = tui.showOverlay(child, { nonCapturing: true });
				childHandle.focus();
				/** 常量 parentHandle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const parentHandle = tui.showOverlay(parent);
				assert.strictEqual(parent.focused, true);

				childHandle.hide();
				parentHandle.hide();
				terminal.sendInput("x");
				await renderAndFlush(tui, terminal);

				assert.deepStrictEqual(editor.inputs, ["x"]);
				assert.deepStrictEqual(child.inputs, []);
				assert.deepStrictEqual(parent.inputs, []);
				assert.strictEqual(editor.focused, true);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“microtask-deferred sub-overlay pattern (showExtensionCustom simulation) restores focus”对应的行为、结果与边界。
		it("microtask-deferred sub-overlay pattern (showExtensionCustom simulation) restores focus", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			/** 常量 timer 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const timer = new FocusableOverlay(["TIMER"]);
			/** 常量 controller 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const controller = new FocusableOverlay(["CTRL"]);
			tui.addChild(new EmptyContent());
			tui.setFocus(editor);
			tui.start();
			try {
				// Simulate showExtensionCustom: factory creates timer synchronously,
				// then .then() pushes controller as a microtask
				// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
				let timerHandle: ReturnType<typeof tui.showOverlay> | null = null;
				let doneFn: () => void = () => {
					throw new Error("doneFn was not initialized");
				};

				/** 常量 overlayPromise 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const overlayPromise = new Promise<void>((resolve) => {
					doneFn = () => {
						if (!timerHandle) throw new Error("timerHandle was not initialized");
						timerHandle.hide();
						tui.hideOverlay();
						resolve();
					};
					timerHandle = tui.showOverlay(timer, { nonCapturing: true });
					// .then() runs as microtask — same as showExtensionCustom
					// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
					Promise.resolve(controller).then((c) => {
						tui.showOverlay(c);
					});
				});

				await Promise.resolve();
				await renderAndFlush(tui, terminal);

				assert.strictEqual(controller.focused, true);
				assert.strictEqual(editor.focused, false);

				// Simulate Esc: cleanup + close (from inside handleInput)
				// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
				doneFn();
				// Now await the promise (simulating showExtensionCustom resolving)
				// 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
				await overlayPromise;
				await renderAndFlush(tui, terminal);

				assert.strictEqual(editor.focused, true, "editor should regain focus");
				assert.strictEqual(controller.focused, false);
				assert.strictEqual(timer.focused, false);

				terminal.sendInput("x");
				await renderAndFlush(tui, terminal);
				assert.deepStrictEqual(editor.inputs, ["x"], "editor should receive input after close");
				assert.deepStrictEqual(controller.inputs, []);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“handleInput redirection skips non-capturing overlays when focused overlay becomes invisible”对应的行为、结果与边界。
		it("handleInput redirection skips non-capturing overlays when focused overlay becomes invisible", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			/** 常量 fallbackCapturing 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const fallbackCapturing = new FocusableOverlay(["FALLBACK"]);
			/** 常量 nonCapturing 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const nonCapturing = new FocusableOverlay(["NC"]);
			/** 常量 primary 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const primary = new FocusableOverlay(["PRIMARY"]);
			/** 变量 isVisible 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			let isVisible = true;
			tui.addChild(new EmptyContent());
			tui.setFocus(editor);
			tui.start();
			try {
				tui.showOverlay(fallbackCapturing);
				tui.showOverlay(nonCapturing, { nonCapturing: true });
				tui.showOverlay(primary, { visible: () => isVisible });
				assert.strictEqual(primary.focused, true);
				isVisible = false;
				terminal.sendInput("x");
				await renderAndFlush(tui, terminal);
				assert.deepStrictEqual(primary.inputs, []);
				assert.deepStrictEqual(nonCapturing.inputs, []);
				assert.deepStrictEqual(fallbackCapturing.inputs, ["x"]);
				assert.strictEqual(fallbackCapturing.focused, true);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“active base focus replacement receives close input before overlay restore”对应的行为、结果与边界。
		it("active base focus replacement receives close input before overlay restore", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			/** 常量 replacement 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const replacement = new FocusableOverlay(["REPLACEMENT"]);
			/** 常量 overlay 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const overlay = new FocusableOverlay(["OVERLAY"]);
			overlay.handleInput = (data: string) => {
				overlay.inputs.push(data);
				if (data === "b") {
					tui.setFocus(replacement);
				}
			};
			replacement.handleInput = (data: string) => {
				replacement.inputs.push(data);
				if (data === "\r") {
					tui.setFocus(editor);
				}
			};
			tui.addChild(new EmptyContent());
			tui.setFocus(editor);
			tui.start();
			try {
				tui.showOverlay(overlay);
				assert.strictEqual(overlay.focused, true);
				terminal.sendInput("b");
				await renderAndFlush(tui, terminal);
				assert.strictEqual(replacement.focused, true);

				terminal.sendInput("\r");
				await renderAndFlush(tui, terminal);
				assert.deepStrictEqual(replacement.inputs, ["\r"]);
				assert.deepStrictEqual(overlay.inputs, ["b"]);
				assert.strictEqual(overlay.focused, true);

				terminal.sendInput("x");
				await renderAndFlush(tui, terminal);
				assert.deepStrictEqual(overlay.inputs, ["b", "x"]);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“active replacement still receives input when it is another overlay preFocus”对应的行为、结果与边界。
		it("active replacement still receives input when it is another overlay preFocus", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			/** 常量 replacement 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const replacement = new FocusableOverlay(["REPLACEMENT"]);
			/** 常量 passive 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const passive = new FocusableOverlay(["PASSIVE"]);
			/** 常量 overlay 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const overlay = new FocusableOverlay(["OVERLAY"]);
			overlay.handleInput = (data: string) => {
				overlay.inputs.push(data);
				if (data === "b") {
					tui.setFocus(replacement);
				}
			};
			replacement.handleInput = (data: string) => {
				replacement.inputs.push(data);
				if (data === "\r") {
					tui.setFocus(editor);
				}
			};
			tui.addChild(new EmptyContent());
			tui.setFocus(editor);
			tui.start();
			try {
				tui.setFocus(replacement);
				tui.showOverlay(passive, { nonCapturing: true });
				tui.setFocus(editor);
				tui.showOverlay(overlay);
				terminal.sendInput("b");
				await renderAndFlush(tui, terminal);
				assert.strictEqual(replacement.focused, true);

				terminal.sendInput("1");
				terminal.sendInput("\r");
				await renderAndFlush(tui, terminal);
				assert.deepStrictEqual(replacement.inputs, ["1", "\r"]);
				assert.deepStrictEqual(overlay.inputs, ["b"]);
				assert.strictEqual(overlay.focused, true);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“blocked replacement can move focus internally before overlay restore”对应的行为、结果与边界。
		it("blocked replacement can move focus internally before overlay restore", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 base 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const base = new Container();
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			/** 常量 firstReplacement 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const firstReplacement = new FocusableOverlay(["FIRST"]);
			/** 常量 secondReplacement 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const secondReplacement = new FocusableOverlay(["SECOND"]);
			/** 常量 overlay 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const overlay = new FocusableOverlay(["OVERLAY"]);
			overlay.handleInput = (data: string) => {
				overlay.inputs.push(data);
				if (data === "b") tui.setFocus(firstReplacement);
			};
			firstReplacement.handleInput = (data: string) => {
				firstReplacement.inputs.push(data);
				if (data === "n") tui.setFocus(secondReplacement);
			};
			secondReplacement.handleInput = (data: string) => {
				secondReplacement.inputs.push(data);
				if (data === "\r") {
					base.clear();
					base.addChild(editor);
					tui.setFocus(editor);
				}
			};
			base.addChild(editor);
			base.addChild(firstReplacement);
			base.addChild(secondReplacement);
			tui.addChild(base);
			tui.setFocus(editor);
			tui.start();
			try {
				tui.showOverlay(overlay);
				terminal.sendInput("b");
				await renderAndFlush(tui, terminal);
				terminal.sendInput("n");
				await renderAndFlush(tui, terminal);
				terminal.sendInput("2");
				terminal.sendInput("\r");
				await renderAndFlush(tui, terminal);

				assert.deepStrictEqual(overlay.inputs, ["b"]);
				assert.deepStrictEqual(firstReplacement.inputs, ["n"]);
				assert.deepStrictEqual(secondReplacement.inputs, ["2", "\r"]);
				assert.strictEqual(overlay.focused, true);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“removed replacement restores overlay even when overlay preFocus differs from next focus”对应的行为、结果与边界。
		it("removed replacement restores overlay even when overlay preFocus differs from next focus", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 base 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const base = new Container();
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			/** 常量 palette 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const palette = new FocusableOverlay(["PALETTE"]);
			/** 常量 replacement 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const replacement = new FocusableOverlay(["REPLACEMENT"]);
			/** 常量 overlay 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const overlay = new FocusableOverlay(["OVERLAY"]);
			overlay.handleInput = (data: string) => {
				overlay.inputs.push(data);
				if (data === "b") tui.setFocus(replacement);
			};
			replacement.handleInput = (data: string) => {
				replacement.inputs.push(data);
				if (data === "\r") {
					base.clear();
					base.addChild(editor);
					tui.setFocus(editor);
				}
			};
			base.addChild(editor);
			base.addChild(palette);
			base.addChild(replacement);
			tui.addChild(base);
			tui.setFocus(palette);
			tui.start();
			try {
				tui.showOverlay(overlay);
				terminal.sendInput("b");
				await renderAndFlush(tui, terminal);
				terminal.sendInput("\r");
				terminal.sendInput("x");
				await renderAndFlush(tui, terminal);

				assert.deepStrictEqual(overlay.inputs, ["b", "x"]);
				assert.deepStrictEqual(replacement.inputs, ["\r"]);
				assert.deepStrictEqual(editor.inputs, []);
				assert.strictEqual(overlay.focused, true);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“unfocus target releases a blocked overlay while replacement remains focused”对应的行为、结果与边界。
		it("unfocus target releases a blocked overlay while replacement remains focused", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 fallback 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const fallback = new FocusableOverlay(["FALLBACK"]);
			/** 常量 target 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const target = new FocusableOverlay(["TARGET"]);
			/** 常量 replacement 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const replacement = new FocusableOverlay(["REPLACEMENT"]);
			/** 常量 overlay 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const overlay = new FocusableOverlay(["OVERLAY"]);
			replacement.handleInput = (data: string) => {
				replacement.inputs.push(data);
				if (data === "\r") tui.setFocus(fallback);
			};
			tui.addChild(new EmptyContent());
			tui.start();
			try {
				/** 常量 overlayHandle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const overlayHandle = tui.showOverlay(overlay);
				overlay.handleInput = (data: string) => {
					overlay.inputs.push(data);
					if (data === "b") {
						tui.setFocus(replacement);
						overlayHandle.unfocus({ target });
					}
				};

				terminal.sendInput("b");
				await renderAndFlush(tui, terminal);
				assert.strictEqual(replacement.focused, true);
				terminal.sendInput("\r");
				terminal.sendInput("x");
				await renderAndFlush(tui, terminal);

				assert.deepStrictEqual(overlay.inputs, ["b"]);
				assert.deepStrictEqual(replacement.inputs, ["\r"]);
				assert.deepStrictEqual(fallback.inputs, []);
				assert.deepStrictEqual(target.inputs, ["x"]);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“handleInput restores focus to a visible focused overlay after base focus steal”对应的行为、结果与边界。
		it("handleInput restores focus to a visible focused overlay after base focus steal", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			/** 常量 replacement 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const replacement = new FocusableOverlay(["REPLACEMENT"]);
			/** 常量 overlay 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const overlay = new FocusableOverlay(["OVERLAY"]);
			tui.addChild(new EmptyContent());
			tui.setFocus(editor);
			tui.start();
			try {
				tui.showOverlay(overlay);
				assert.strictEqual(overlay.focused, true);
				tui.setFocus(replacement);
				tui.setFocus(editor);
				terminal.sendInput("x");
				await renderAndFlush(tui, terminal);
				assert.deepStrictEqual(overlay.inputs, ["x"]);
				assert.deepStrictEqual(editor.inputs, []);
				assert.strictEqual(overlay.focused, true);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“handleInput restores focus to explicitly focused raw sub-overlay after base focus steal”对应的行为、结果与边界。
		it("handleInput restores focus to explicitly focused raw sub-overlay after base focus steal", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			/** 常量 controller 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const controller = new FocusableOverlay(["CONTROLLER"]);
			/** 常量 subOverlay 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const subOverlay = new FocusableOverlay(["SUB"]);
			tui.addChild(new EmptyContent());
			tui.setFocus(editor);
			tui.start();
			try {
				tui.showOverlay(controller);
				/** 常量 subHandle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const subHandle = tui.showOverlay(subOverlay, { nonCapturing: true });
				subHandle.focus();
				tui.setFocus(editor);
				terminal.sendInput("x");
				await renderAndFlush(tui, terminal);
				assert.deepStrictEqual(subOverlay.inputs, ["x"]);
				assert.deepStrictEqual(controller.inputs, []);
				assert.deepStrictEqual(editor.inputs, []);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“passive non-capturing overlay does not regain input after base focus”对应的行为、结果与边界。
		it("passive non-capturing overlay does not regain input after base focus", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			/** 常量 passive 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const passive = new FocusableOverlay(["PASSIVE"]);
			tui.addChild(new EmptyContent());
			tui.setFocus(editor);
			tui.start();
			try {
				tui.showOverlay(passive, { nonCapturing: true });
				terminal.sendInput("x");
				await renderAndFlush(tui, terminal);
				assert.deepStrictEqual(editor.inputs, ["x"]);
				assert.deepStrictEqual(passive.inputs, []);
				assert.strictEqual(editor.focused, true);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“explicitly focused non-capturing overlay regains input after base focus steal”对应的行为、结果与边界。
		it("explicitly focused non-capturing overlay regains input after base focus steal", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			/** 常量 overlay 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const overlay = new FocusableOverlay(["NC"]);
			tui.addChild(new EmptyContent());
			tui.setFocus(editor);
			tui.start();
			try {
				/** 常量 handle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const handle = tui.showOverlay(overlay, { nonCapturing: true });
				handle.focus();
				tui.setFocus(editor);
				terminal.sendInput("x");
				await renderAndFlush(tui, terminal);
				assert.deepStrictEqual(overlay.inputs, ["x"]);
				assert.deepStrictEqual(editor.inputs, []);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“unfocus() prevents visible overlay from regaining input”对应的行为、结果与边界。
		it("unfocus() prevents visible overlay from regaining input", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			/** 常量 overlay 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const overlay = new FocusableOverlay(["OVERLAY"]);
			tui.addChild(new EmptyContent());
			tui.setFocus(editor);
			tui.start();
			try {
				/** 常量 handle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const handle = tui.showOverlay(overlay);
				handle.unfocus();
				terminal.sendInput("x");
				await renderAndFlush(tui, terminal);
				assert.deepStrictEqual(editor.inputs, ["x"]);
				assert.deepStrictEqual(overlay.inputs, []);
				assert.strictEqual(editor.focused, true);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“setFocus(null) explicitly clears visible overlay restore”对应的行为、结果与边界。
		it("setFocus(null) explicitly clears visible overlay restore", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 overlay 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const overlay = new FocusableOverlay(["OVERLAY"]);
			tui.addChild(new EmptyContent());
			tui.start();
			try {
				tui.showOverlay(overlay);
				tui.setFocus(null);
				terminal.sendInput("x");
				await renderAndFlush(tui, terminal);
				assert.deepStrictEqual(overlay.inputs, []);
				assert.strictEqual(overlay.focused, false);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“blocked replacement setFocus(null) resumes the visible overlay”对应的行为、结果与边界。
		it("blocked replacement setFocus(null) resumes the visible overlay", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 replacement 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const replacement = new FocusableOverlay(["REPLACEMENT"]);
			/** 常量 overlay 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const overlay = new FocusableOverlay(["OVERLAY"]);
			replacement.handleInput = (data: string) => {
				replacement.inputs.push(data);
				if (data === "\r") tui.setFocus(null);
			};
			overlay.handleInput = (data: string) => {
				overlay.inputs.push(data);
				if (data === "b") tui.setFocus(replacement);
			};
			tui.addChild(new EmptyContent());
			tui.start();
			try {
				tui.showOverlay(overlay);
				terminal.sendInput("b");
				await renderAndFlush(tui, terminal);
				terminal.sendInput("\r");
				terminal.sendInput("x");
				await renderAndFlush(tui, terminal);
				assert.deepStrictEqual(replacement.inputs, ["\r"]);
				assert.deepStrictEqual(overlay.inputs, ["b", "x"]);
				assert.strictEqual(overlay.focused, true);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“temporarily invisible focused overlay falls back without losing restore eligibility”对应的行为、结果与边界。
		it("temporarily invisible focused overlay falls back without losing restore eligibility", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			/** 常量 overlay 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const overlay = new FocusableOverlay(["OVERLAY"]);
			/** 变量 visible 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			let visible = true;
			tui.addChild(new EmptyContent());
			tui.setFocus(editor);
			tui.start();
			try {
				tui.showOverlay(overlay, { visible: () => visible });
				tui.setFocus(editor);
				visible = false;
				terminal.sendInput("x");
				await renderAndFlush(tui, terminal);
				assert.deepStrictEqual(editor.inputs, ["x"]);
				assert.deepStrictEqual(overlay.inputs, []);
				visible = true;
				terminal.sendInput("y");
				await renderAndFlush(tui, terminal);
				assert.deepStrictEqual(editor.inputs, ["x"]);
				assert.deepStrictEqual(overlay.inputs, ["y"]);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“temporarily invisible focused overlay with null preFocus restores when visible again”对应的行为、结果与边界。
		it("temporarily invisible focused overlay with null preFocus restores when visible again", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 overlay 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const overlay = new FocusableOverlay(["OVERLAY"]);
			/** 变量 visible 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			let visible = true;
			tui.addChild(new EmptyContent());
			tui.start();
			try {
				tui.showOverlay(overlay, { visible: () => visible });
				visible = false;
				terminal.sendInput("x");
				await renderAndFlush(tui, terminal);
				assert.deepStrictEqual(overlay.inputs, []);
				visible = true;
				terminal.sendInput("y");
				await renderAndFlush(tui, terminal);
				assert.deepStrictEqual(overlay.inputs, ["y"]);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“cyclic overlay preFocus ancestry does not hang focus changes”对应的行为、结果与边界。
		it("cyclic overlay preFocus ancestry does not hang focus changes", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			/** 常量 overlay 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const overlay = new FocusableOverlay(["OVERLAY"]);
			tui.addChild(new EmptyContent());
			tui.setFocus(overlay);
			tui.start();
			try {
				/** 常量 handle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const handle = tui.showOverlay(overlay, { nonCapturing: true });
				handle.focus();
				tui.setFocus(editor);
				terminal.sendInput("x");
				await renderAndFlush(tui, terminal);
				assert.deepStrictEqual(editor.inputs, ["x"]);
				assert.deepStrictEqual(overlay.inputs, []);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“handleInput restores the focus-order top overlay after base focus steal”对应的行为、结果与边界。
		it("handleInput restores the focus-order top overlay after base focus steal", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			/** 常量 lower 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const lower = new FocusableOverlay(["LOWER"]);
			/** 常量 upper 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const upper = new FocusableOverlay(["UPPER"]);
			tui.addChild(new EmptyContent());
			tui.setFocus(editor);
			tui.start();
			try {
				/** 常量 lowerHandle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const lowerHandle = tui.showOverlay(lower);
				tui.showOverlay(upper);
				lowerHandle.focus();
				tui.setFocus(editor);
				terminal.sendInput("x");
				await renderAndFlush(tui, terminal);
				assert.deepStrictEqual(lower.inputs, ["x"]);
				assert.deepStrictEqual(upper.inputs, []);
				assert.deepStrictEqual(editor.inputs, []);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“hideOverlay() does not reassign focus when topmost overlay is non-capturing”对应的行为、结果与边界。
		it("hideOverlay() does not reassign focus when topmost overlay is non-capturing", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			/** 常量 capturing 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const capturing = new FocusableOverlay(["CAP"]);
			/** 常量 nonCapturing 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const nonCapturing = new FocusableOverlay(["NC"]);
			tui.addChild(new EmptyContent());
			tui.setFocus(editor);
			tui.start();
			try {
				tui.showOverlay(capturing);
				tui.showOverlay(nonCapturing, { nonCapturing: true });
				assert.strictEqual(capturing.focused, true);
				tui.hideOverlay();
				await renderAndFlush(tui, terminal);
				assert.strictEqual(capturing.focused, true);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“multiple capturing and non-capturing overlays restore focus through removals”对应的行为、结果与边界。
		it("multiple capturing and non-capturing overlays restore focus through removals", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			/** 常量 c1 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const c1 = new FocusableOverlay(["C1"]);
			/** 常量 n1 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const n1 = new FocusableOverlay(["N1"]);
			/** 常量 c2 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const c2 = new FocusableOverlay(["C2"]);
			/** 常量 n2 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const n2 = new FocusableOverlay(["N2"]);
			tui.addChild(new EmptyContent());
			tui.setFocus(editor);
			tui.start();
			try {
				/** 常量 c1Handle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const c1Handle = tui.showOverlay(c1);
				tui.showOverlay(n1, { nonCapturing: true });
				/** 常量 c2Handle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const c2Handle = tui.showOverlay(c2);
				tui.showOverlay(n2, { nonCapturing: true });
				assert.strictEqual(c2.focused, true);
				c2Handle.hide();
				await renderAndFlush(tui, terminal);
				assert.strictEqual(c1.focused, true);
				c1Handle.hide();
				await renderAndFlush(tui, terminal);
				assert.strictEqual(editor.focused, true);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“capturing overlay unfocus() on topmost capturing overlay falls back to preFocus”对应的行为、结果与边界。
		it("capturing overlay unfocus() on topmost capturing overlay falls back to preFocus", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			/** 常量 capturing 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const capturing = new FocusableOverlay(["CAP"]);
			tui.addChild(new EmptyContent());
			tui.setFocus(editor);
			tui.start();
			try {
				/** 常量 handle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const handle = tui.showOverlay(capturing);
				assert.strictEqual(capturing.focused, true);
				handle.unfocus();
				await renderAndFlush(tui, terminal);
				assert.strictEqual(editor.focused, true);
				assert.strictEqual(capturing.focused, false);
			} finally {
				tui.stop();
			}
		});
	});

	// 用例分组：集中验证“no-op guards”相关功能。
	describe("no-op guards", () => {
		// 测试场景：验证“focus() on hidden overlay is a no-op”对应的行为、结果与边界。
		it("focus() on hidden overlay is a no-op", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			/** 常量 overlay 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const overlay = new FocusableOverlay(["OVERLAY"]);
			tui.addChild(new EmptyContent());
			tui.setFocus(editor);
			tui.start();
			try {
				/** 常量 handle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const handle = tui.showOverlay(overlay, { nonCapturing: true });
				handle.setHidden(true);
				handle.focus();
				await renderAndFlush(tui, terminal);
				assert.strictEqual(editor.focused, true);
				assert.strictEqual(handle.isFocused(), false);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“focus() after hide() is a no-op”对应的行为、结果与边界。
		it("focus() after hide() is a no-op", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			/** 常量 overlay 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const overlay = new FocusableOverlay(["OVERLAY"]);
			tui.addChild(new EmptyContent());
			tui.setFocus(editor);
			tui.start();
			try {
				/** 常量 handle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const handle = tui.showOverlay(overlay, { nonCapturing: true });
				handle.hide();
				handle.focus();
				await renderAndFlush(tui, terminal);
				assert.strictEqual(editor.focused, true);
				assert.strictEqual(handle.isFocused(), false);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“unfocus() when overlay does not have focus is a no-op”对应的行为、结果与边界。
		it("unfocus() when overlay does not have focus is a no-op", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			/** 常量 overlay 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const overlay = new FocusableOverlay(["OVERLAY"]);
			tui.addChild(new EmptyContent());
			tui.setFocus(editor);
			tui.start();
			try {
				/** 常量 handle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const handle = tui.showOverlay(overlay, { nonCapturing: true });
				handle.unfocus();
				await renderAndFlush(tui, terminal);
				assert.strictEqual(editor.focused, true);
				assert.strictEqual(overlay.focused, false);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“unfocus() with null preFocus clears focus and does not route input back to overlay”对应的行为、结果与边界。
		it("unfocus() with null preFocus clears focus and does not route input back to overlay", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 overlay 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const overlay = new FocusableOverlay(["OVERLAY"]);
			tui.addChild(new EmptyContent());
			tui.start();
			try {
				/** 常量 handle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const handle = tui.showOverlay(overlay);
				assert.strictEqual(overlay.focused, true);
				handle.unfocus();
				assert.strictEqual(overlay.focused, false);
				terminal.sendInput("x");
				await renderAndFlush(tui, terminal);
				assert.deepStrictEqual(overlay.inputs, []);
				assert.strictEqual(handle.isFocused(), false);
			} finally {
				tui.stop();
			}
		});
	});

	// 用例分组：集中验证“focus cycle prevention”相关功能。
	describe("focus cycle prevention", () => {
		// 测试场景：验证“toggle focus between non-capturing overlays then unfocus returns to editor”对应的行为、结果与边界。
		it("toggle focus between non-capturing overlays then unfocus returns to editor", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			/** 常量 a 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const a = new FocusableOverlay(["A"]);
			/** 常量 b 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const b = new FocusableOverlay(["B"]);
			tui.addChild(new EmptyContent());
			tui.setFocus(editor);
			tui.start();
			try {
				/** 常量 aHandle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const aHandle = tui.showOverlay(a, { nonCapturing: true });
				/** 常量 bHandle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const bHandle = tui.showOverlay(b, { nonCapturing: true });
				aHandle.focus();
				bHandle.focus();
				aHandle.focus();
				aHandle.unfocus();
				await renderAndFlush(tui, terminal);
				assert.strictEqual(editor.focused, true);
				assert.strictEqual(a.focused, false);
				assert.strictEqual(b.focused, false);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“explicit unfocus target supports cycling between three overlays and editor”对应的行为、结果与边界。
		it("explicit unfocus target supports cycling between three overlays and editor", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			/** 常量 a 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const a = new FocusableOverlay(["A"]);
			/** 常量 b 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const b = new FocusableOverlay(["B"]);
			/** 常量 c 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const c = new FocusableOverlay(["C"]);
			tui.addChild(new EmptyContent());
			tui.setFocus(editor);
			tui.start();
			try {
				/** 常量 aHandle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const aHandle = tui.showOverlay(a);
				/** 常量 bHandle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const bHandle = tui.showOverlay(b);
				/** 常量 cHandle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const cHandle = tui.showOverlay(c);

				aHandle.focus();
				terminal.sendInput("a");
				await renderAndFlush(tui, terminal);
				bHandle.focus();
				terminal.sendInput("b");
				await renderAndFlush(tui, terminal);
				cHandle.focus();
				terminal.sendInput("c");
				await renderAndFlush(tui, terminal);
				cHandle.unfocus({ target: editor });
				terminal.sendInput("e");
				await renderAndFlush(tui, terminal);
				aHandle.focus();
				terminal.sendInput("A");
				await renderAndFlush(tui, terminal);
				aHandle.unfocus({ target: editor });
				terminal.sendInput("E");
				await renderAndFlush(tui, terminal);

				assert.deepStrictEqual(a.inputs, ["a", "A"]);
				assert.deepStrictEqual(b.inputs, ["b"]);
				assert.deepStrictEqual(c.inputs, ["c"]);
				assert.deepStrictEqual(editor.inputs, ["e", "E"]);
				assert.strictEqual(editor.focused, true);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“explicit null unfocus target clears focus without restoring overlays”对应的行为、结果与边界。
		it("explicit null unfocus target clears focus without restoring overlays", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 overlay 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const overlay = new FocusableOverlay(["OVERLAY"]);
			tui.addChild(new EmptyContent());
			tui.start();
			try {
				/** 常量 handle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const handle = tui.showOverlay(overlay);
				handle.unfocus({ target: null });
				terminal.sendInput("x");
				await renderAndFlush(tui, terminal);
				assert.deepStrictEqual(overlay.inputs, []);
				assert.strictEqual(handle.isFocused(), false);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“hiding focused overlay falls back to next visual-frontmost overlay”对应的行为、结果与边界。
		it("hiding focused overlay falls back to next visual-frontmost overlay", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(80, 24);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			/** 常量 a 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const a = new FocusableOverlay(["A"]);
			/** 常量 b 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const b = new FocusableOverlay(["B"]);
			/** 常量 c 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const c = new FocusableOverlay(["C"]);
			tui.addChild(new EmptyContent());
			tui.setFocus(editor);
			tui.start();
			try {
				/** 常量 aHandle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const aHandle = tui.showOverlay(a);
				/** 常量 bHandle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const bHandle = tui.showOverlay(b);
				tui.showOverlay(c);
				aHandle.focus();
				bHandle.focus();
				bHandle.setHidden(true);
				terminal.sendInput("x");
				await renderAndFlush(tui, terminal);
				assert.deepStrictEqual(a.inputs, ["x"]);
				assert.deepStrictEqual(c.inputs, []);
				assert.strictEqual(a.focused, true);
			} finally {
				tui.stop();
			}
		});
	});

	// 用例分组：集中验证“rendering order”相关功能。
	describe("rendering order", () => {
		// 测试场景：验证“focus() on already-focused overlay bumps visual order”对应的行为、结果与边界。
		it("focus() on already-focused overlay bumps visual order", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(20, 6);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			tui.addChild(new EmptyContent());
			tui.setFocus(editor);
			tui.start();
			try {
				/** 常量 aHandle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const aHandle = tui.showOverlay(new StaticOverlay(["A"]), { row: 0, col: 0, width: 1, nonCapturing: true });
				tui.showOverlay(new StaticOverlay(["B"]), { row: 0, col: 0, width: 1, nonCapturing: true });
				aHandle.focus();
				tui.showOverlay(new StaticOverlay(["C"]), { row: 0, col: 0, width: 1, nonCapturing: true });
				await renderAndFlush(tui, terminal);
				assert.strictEqual(terminal.getViewport()[0]?.charAt(0), "C");
				aHandle.focus();
				await renderAndFlush(tui, terminal);
				assert.strictEqual(terminal.getViewport()[0]?.charAt(0), "A");
				assert.strictEqual(aHandle.isFocused(), true);
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“default rendering order for overlapping overlays follows creation order”对应的行为、结果与边界。
		it("default rendering order for overlapping overlays follows creation order", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(20, 6);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			tui.addChild(new EmptyContent());
			tui.start();
			try {
				tui.showOverlay(new StaticOverlay(["A"]), { row: 0, col: 0, width: 1, nonCapturing: true });
				tui.showOverlay(new StaticOverlay(["B"]), { row: 0, col: 0, width: 1, nonCapturing: true });
				await renderAndFlush(tui, terminal);
				assert.strictEqual(terminal.getViewport()[0]?.charAt(0), "B");
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“focus() on lower overlay renders it on top”对应的行为、结果与边界。
		it("focus() on lower overlay renders it on top", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(20, 6);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			tui.addChild(new EmptyContent());
			tui.start();
			try {
				/** 常量 lower 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const lower = tui.showOverlay(new StaticOverlay(["A"]), { row: 0, col: 0, width: 1, nonCapturing: true });
				tui.showOverlay(new StaticOverlay(["B"]), { row: 0, col: 0, width: 1, nonCapturing: true });
				await renderAndFlush(tui, terminal);
				assert.strictEqual(terminal.getViewport()[0]?.charAt(0), "B");
				lower.focus();
				await renderAndFlush(tui, terminal);
				assert.strictEqual(terminal.getViewport()[0]?.charAt(0), "A");
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“focusing middle overlay places it on top while preserving others relative order”对应的行为、结果与边界。
		it("focusing middle overlay places it on top while preserving others relative order", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(20, 6);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			tui.addChild(new EmptyContent());
			tui.start();
			try {
				tui.showOverlay(new StaticOverlay(["A"]), { row: 0, col: 0, width: 1, nonCapturing: true });
				/** 常量 middle 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const middle = tui.showOverlay(new StaticOverlay(["B"]), { row: 0, col: 0, width: 1, nonCapturing: true });
				/** 常量 top 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const top = tui.showOverlay(new StaticOverlay(["C"]), { row: 0, col: 0, width: 1, nonCapturing: true });
				await renderAndFlush(tui, terminal);
				assert.strictEqual(terminal.getViewport()[0]?.charAt(0), "C");
				middle.focus();
				await renderAndFlush(tui, terminal);
				assert.strictEqual(terminal.getViewport()[0]?.charAt(0), "B");
				middle.hide();
				await renderAndFlush(tui, terminal);
				assert.strictEqual(terminal.getViewport()[0]?.charAt(0), "C");
				top.hide();
				await renderAndFlush(tui, terminal);
				assert.strictEqual(terminal.getViewport()[0]?.charAt(0), "A");
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“capturing overlay hidden and shown again renders on top after unhide”对应的行为、结果与边界。
		it("capturing overlay hidden and shown again renders on top after unhide", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(20, 6);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			tui.addChild(new EmptyContent());
			tui.start();
			try {
				tui.showOverlay(new StaticOverlay(["A"]), { row: 0, col: 0, width: 1, nonCapturing: true });
				/** 常量 capturing 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const capturing = tui.showOverlay(new StaticOverlay(["B"]), { row: 0, col: 0, width: 1 });
				await renderAndFlush(tui, terminal);
				assert.strictEqual(terminal.getViewport()[0]?.charAt(0), "B");
				capturing.setHidden(true);
				tui.showOverlay(new StaticOverlay(["C"]), { row: 0, col: 0, width: 1, nonCapturing: true });
				await renderAndFlush(tui, terminal);
				assert.strictEqual(terminal.getViewport()[0]?.charAt(0), "C");
				capturing.setHidden(false);
				await renderAndFlush(tui, terminal);
				assert.strictEqual(terminal.getViewport()[0]?.charAt(0), "B");
			} finally {
				tui.stop();
			}
		});

		// 测试场景：验证“unfocus() does not change visual order until another overlay is focused”对应的行为、结果与边界。
		it("unfocus() does not change visual order until another overlay is focused", async () => {
			/** 常量 terminal 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const terminal = new VirtualTerminal(20, 6);
			/** 常量 tui 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const tui = new TUI(terminal);
			/** 常量 editor 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
			const editor = new FocusableOverlay(["EDITOR"]);
			tui.addChild(new EmptyContent());
			tui.setFocus(editor);
			tui.start();
			try {
				/** 常量 a 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const a = tui.showOverlay(new StaticOverlay(["A"]), { row: 0, col: 0, width: 1, nonCapturing: true });
				/** 常量 b 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
				const b = tui.showOverlay(new StaticOverlay(["B"]), { row: 0, col: 0, width: 1, nonCapturing: true });
				await renderAndFlush(tui, terminal);
				assert.strictEqual(terminal.getViewport()[0]?.charAt(0), "B");
				a.focus();
				await renderAndFlush(tui, terminal);
				assert.strictEqual(terminal.getViewport()[0]?.charAt(0), "A");
				a.unfocus();
				await renderAndFlush(tui, terminal);
				assert.strictEqual(terminal.getViewport()[0]?.charAt(0), "A");
				b.focus();
				await renderAndFlush(tui, terminal);
				assert.strictEqual(terminal.getViewport()[0]?.charAt(0), "B");
			} finally {
				tui.stop();
			}
		});
	});
});
