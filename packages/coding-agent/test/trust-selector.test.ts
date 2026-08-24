/**
 * 文件职责：验证项目信任选择器对已保存决定、继承决定和用户确认操作的展示与输出。
 * 技术维度：使用 Vitest、模拟回调、键位管理器、主题初始化和 ANSI 去除辅助函数。
 * 产品维度：让用户清楚当前项目是否受信任，并能安全地保存项目或父目录级决定。
 * 逻辑维度：每例构造不同信任上下文，渲染文本或发送回车，再检查提示与更新列表。
 * 关键边界：断言基于深色主题和默认键位；路径示例使用 POSIX 形式但不访问真实文件系统。
 * 新手阅读建议：先比较前三个只读展示场景，再看最后一例如何生成两条父子目录更新。
 */
import { setKeybindings } from "@earendil-works/pi-tui";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { KeybindingsManager } from "../src/core/keybindings.ts";
import { TrustSelectorComponent } from "../src/modes/interactive/components/trust-selector.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

describe("TrustSelectorComponent", () => {
	// 测试组开始前初始化深色主题；无参数，无返回值。
	beforeAll(() => {
		initTheme("dark");
	});

	// 每个用例前恢复默认键位管理器；无参数，无返回值。
	beforeEach(() => {
		setKeybindings(new KeybindingsManager());
	});

	// 验证当前目录已有可信决定时对应选项带勾；无参数，无返回值。
	it("marks the saved trusted decision", () => {
		// selector 是当前目录已保存为可信状态的选择器实例。
		const selector = new TrustSelectorComponent({
			cwd: "/project",
			savedDecision: { path: "/project", decision: true },
			projectTrusted: true,
			onSelect: () => {},
			onCancel: () => {},
		});

		// output 是移除 ANSI 控制码后的完整选择器文本。
		const output = stripAnsi(selector.render(120).join("\n"));

		expect(output).toContain("Saved decision: trusted (/project)");
		expect(output).toContain("Current session: trusted");
		expect(output).toContain("Trust ✓");
		expect(output).not.toContain("Do not trust ✓");
	});

	// 验证默认信任选项确认后返回当前目录更新；无参数，无返回值。
	it("selects a trust decision", () => {
		// onSelect 是记录选择结果的模拟回调。
		const onSelect = vi.fn();
		// selector 是没有保存决定且当前不可信的选择器实例。
		const selector = new TrustSelectorComponent({
			cwd: "/project",
			savedDecision: null,
			projectTrusted: false,
			onSelect,
			onCancel: () => {},
		});

		selector.handleInput("\n");

		expect(onSelect).toHaveBeenCalledWith({ trusted: true, updates: [{ path: "/project", decision: true }] });
	});

	// 验证来自祖先目录的保存决定标记为继承；无参数，无返回值。
	it("labels saved ancestor decisions as inherited", () => {
		// selector 是从 /parent 继承可信状态的嵌套项目选择器。
		const selector = new TrustSelectorComponent({
			cwd: "/parent/project/nested",
			savedDecision: { path: "/parent", decision: true },
			projectTrusted: true,
			onSelect: () => {},
			onCancel: () => {},
		});

		// output 是用于检查继承提示的无 ANSI 文本。
		const output = stripAnsi(selector.render(120).join("\n"));

		expect(output).toContain("Saved decision: trusted (inherited from /parent)");
	});

	// 验证父目录信任选项会保留父决定并清除项目级覆盖；无参数，无返回值。
	it("adds a trust parent option", () => {
		// onSelect 是记录父目录信任选择结果的模拟回调。
		const onSelect = vi.fn();
		// selector 是当前项目继承父目录可信决定的选择器实例。
		const selector = new TrustSelectorComponent({
			cwd: "/parent/project",
			savedDecision: { path: "/parent", decision: true },
			projectTrusted: true,
			onSelect,
			onCancel: () => {},
		});

		// output 是用于确认父目录选项与继承说明的无 ANSI 文本。
		const output = stripAnsi(selector.render(120).join("\n"));
		expect(output).toContain("Saved decision: trusted (inherited from /parent)");
		expect(output).toContain("Trust parent folder (/parent) ✓");

		selector.handleInput("\n");

		expect(onSelect).toHaveBeenCalledWith({
			trusted: true,
			updates: [
				{ path: "/parent", decision: true },
				{ path: "/parent/project", decision: null },
			],
		});
	});
});
