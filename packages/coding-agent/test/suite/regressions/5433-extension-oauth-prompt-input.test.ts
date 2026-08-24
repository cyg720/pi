/**
 * 文件职责：回归验证登录对话框显示新 OAuth 提示时，会保留旧输入、授权说明、链接和设置详情。
 * 技术维度：使用 Vitest、TUI 测试替身、深色主题、按键绑定管理器和 ANSI 文本清理函数。
 * 产品维度：防止多步骤扩展登录过程中先前信息消失或输入重复，帮助用户顺利完成授权。
 * 逻辑维度：帮助函数创建和渲染对话框，五个用例覆盖连续提示及三类信息区块和手工输入。
 * 关键边界：测试只检查 120 列文本渲染，不启动真实浏览器；全局主题和按键绑定需先初始化。
 * 新手阅读建议：先看 createDialog、renderDialog、countRenderedValue，再逐个比较 showPrompt 前的状态。
 */
import { setKeybindings, type TUI } from "@earendil-works/pi-tui";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { KeybindingsManager } from "../../../src/core/keybindings.ts";
import { LoginDialogComponent } from "../../../src/modes/interactive/components/login-dialog.ts";
import { initTheme } from "../../../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../../../src/utils/ansi.ts";

vi.mock("../../../src/utils/open-browser.ts", () => ({
	openBrowser: vi.fn(),
}));

/** 功能：创建使用假 TUI 的登录对话框；参数：无；返回：LoginDialogComponent。示例：const dialog = createDialog()。 */
function createDialog(): LoginDialogComponent {
	return new LoginDialogComponent(
		{ requestRender: vi.fn() } as unknown as TUI,
		"prompt-repro",
		() => {},
		"Prompt Repro",
	);
}

/** 功能：把对话框渲染为无 ANSI 的行数组；参数 dialog；返回：去掉行尾空白的文本行。示例：renderDialog(dialog)。 */
function renderDialog(dialog: LoginDialogComponent): string[] {
	return stripAnsi(dialog.render(120).join("\n"))
		.split("\n")
		.map((line) => line.trimEnd());
}

/** 功能：统计某个输入值在渲染结果中出现次数；参数 lines、value；返回：计数。示例：countRenderedValue(lines, "secret")。 */
function countRenderedValue(lines: string[], value: string): number {
	return lines.filter((line) => line.trim() === `> ${value}`).length;
}

describe("LoginDialogComponent OAuth prompts", () => {
	// 功能：初始化测试主题；参数：无；返回：无。示例：套件开始前调用一次。
	beforeAll(() => {
		initTheme("dark");
	});

	// 功能：重置全局按键绑定；参数：无；返回：无。示例：每个用例前自动调用。
	beforeEach(() => {
		setKeybindings(new KeybindingsManager());
	});

	test("keeps previous prompt input stable when a later prompt is active", async () => {
		// 连续普通提示场景的登录对话框。
		const dialog = createDialog();

		// 第一条提示的待完成 Promise；提交后应解析为 first-value。
		const firstPrompt = dialog.showPrompt("First prompt:", "first-value");
		dialog.handleInput("first-value");
		dialog.handleInput("\n");
		await expect(firstPrompt).resolves.toBe("first-value");

		// 第一条完成后打开的第二条提示 Promise。
		const secondPrompt = dialog.showPrompt("Second prompt:");
		dialog.handleInput("second-secret-demo");

		// 第二条提示处于编辑状态时的渲染行。
		const lines = renderDialog(dialog);
		expect(lines.join("\n")).toContain("First prompt:");
		expect(lines.join("\n")).toContain("Second prompt:");
		expect(countRenderedValue(lines, "first-value")).toBe(1);
		expect(countRenderedValue(lines, "second-secret-demo")).toBe(1);

		dialog.handleInput("\n");
		await expect(secondPrompt).resolves.toBe("second-secret-demo");
	});

	test("preserves auth instructions when showing a prompt", () => {
		// 授权说明保留场景的登录对话框。
		const dialog = createDialog();

		dialog.showAuth("https://example.invalid/login", "Authorize the extension");
		dialog.showPrompt("First prompt:");

		// 同时包含授权 URL、说明和输入提示的渲染文本。
		const output = renderDialog(dialog).join("\n");
		expect(output).toContain("https://example.invalid/login");
		expect(output).toContain("Authorize the extension");
		expect(output).toContain("First prompt:");
	});

	test("preserves neutral information and links when showing a prompt", () => {
		// 中性信息和链接保留场景的登录对话框。
		const dialog = createDialog();

		dialog.showInfo("Configure credentials outside pi.", [
			{ label: "Provider documentation", url: "https://example.invalid/docs" },
		]);
		dialog.showPrompt("Press Enter to continue:");

		// 同时包含信息、格式化链接和后续提示的渲染文本。
		const output = renderDialog(dialog).join("\n");
		expect(output).toContain("Configure credentials outside pi.");
		expect(output).toContain("Provider documentation: https://example.invalid/docs");
		expect(output).toContain("Press Enter to continue:");
	});

	test("preserves setup details when showing a prompt", () => {
		// 设置详情保留场景的登录对话框。
		const dialog = createDialog();

		dialog.showDetails(["AWS credential setup:", "providers.md"]);
		dialog.showPrompt("Enter API key:");

		// 同时包含详情行和 API key 提示的渲染文本。
		const output = renderDialog(dialog).join("\n");
		expect(output).toContain("AWS credential setup:");
		expect(output).toContain("providers.md");
		expect(output).toContain("Enter API key:");
	});

	test("keeps previous manual input stable when a later prompt is active", async () => {
		// 手工输入后继续普通提示场景的登录对话框。
		const dialog = createDialog();

		// 手工回调地址输入的待完成 Promise。
		const manualInput = dialog.showManualInput("Paste callback URL:");
		dialog.handleInput("callback-value");
		dialog.handleInput("\n");
		await expect(manualInput).resolves.toBe("callback-value");

		// 手工输入完成后打开的第二条普通提示 Promise。
		const prompt = dialog.showPrompt("Second prompt:");
		dialog.handleInput("second-secret-demo");

		// 第二条提示活动时的渲染行；旧手工输入和新输入均应各出现一次。
		const lines = renderDialog(dialog);
		expect(lines.join("\n")).toContain("Paste callback URL:");
		expect(lines.join("\n")).toContain("Second prompt:");
		expect(countRenderedValue(lines, "callback-value")).toBe(1);
		expect(countRenderedValue(lines, "second-secret-demo")).toBe(1);

		dialog.handleInput("\n");
		await expect(prompt).resolves.toBe("second-secret-demo");
	});
});
