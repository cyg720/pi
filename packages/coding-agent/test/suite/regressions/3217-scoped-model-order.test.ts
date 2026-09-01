/**
 * 文件职责：回归验证作用域模型重排会传播到会话状态，并在模型选择器中保持顺序。
 * 技术维度：使用 Vitest、faux 会话夹具、选择器组件、键位单例重置和 ANSI 文本断言。
 * 产品维度：保证用户自定义模型优先级在保存和再次打开 `/model` 时不被重新排序。
 * 逻辑维度：第一例模拟 Alt+Down 重排并捕获 onChange，第二例渲染模型标签并提取顺序。
 * 关键边界：选择器初始化含异步目录刷新，使用 vi.waitFor 等待；夹具需逐例清理。
 * 新手阅读建议：先看 createFakeTui，再比较 orderedIds 在事件回调和渲染文本中的来源。
 */
import { setKeybindings, type TUI } from "@earendil-works/pi-tui";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { KeybindingsManager } from "../../../src/core/keybindings.ts";
import { ModelSelectorComponent } from "../../../src/modes/interactive/components/model-selector.ts";
import { ScopedModelsSelectorComponent } from "../../../src/modes/interactive/components/scoped-models-selector.ts";
import { initTheme } from "../../../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../../../src/utils/ansi.ts";
import { createHarness, type Harness } from "../harness.ts";

/** 创建仅实现 requestRender 的最小 TUI；无参数，返回测试用 TUI。 */
function createFakeTui(): TUI {
	return {
		requestRender: () => {},
	} as unknown as TUI;
}

describe("issue #3217 scoped model ordering", () => {
	// harnesses 保存测试组创建的 faux 会话夹具。
	const harnesses: Harness[] = [];

	// 测试组开始前初始化深色主题；无参数，无返回值。
	beforeAll(() => {
		initTheme("dark");
	});

	beforeEach(() => {
		// Ensure test isolation: keybindings are a global singleton
		// 键位是全局单例，每例重置以确保隔离。
		setKeybindings(new KeybindingsManager());
	});

	// 每例后清理所有会话夹具；无参数，无返回值。
	afterEach(() => {
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
	});

	// 验证重排输入会按新顺序调用 onChange；无参数，无返回值。
	it("propagates reordered scoped models back to the session state", async () => {
		// harness 提供三个按 One、Two、Three 排列的虚拟模型。
		const harness = await createHarness({
			models: [
				{ id: "faux-1", name: "One", reasoning: true },
				{ id: "faux-2", name: "Two", reasoning: true },
				{ id: "faux-3", name: "Three", reasoning: true },
			],
		});
		harnesses.push(harness);

		// orderedIds 是原始作用域模型全限定标识顺序。
		const orderedIds = harness.models.map((model) => `${model.provider}/${model.id}`);
		// changes 记录选择器每次顺序变化，null 表示清空作用域。
		const changes: Array<string[] | null> = [];
		// selector 是可通过键盘重排启用模型的作用域选择器。
		const selector = new ScopedModelsSelectorComponent(
			{
				allModels: [...harness.models],
				enabledModelIds: orderedIds,
			},
			{
				// enabledModelIds 是重排后的可选模型标识列表。
				onChange: (enabledModelIds) => {
					changes.push(enabledModelIds);
				},
				onPersist: () => {},
				onCancel: () => {},
			},
		);

		selector.handleInput("\x1b[1;3B");

		expect(changes).toEqual([[orderedIds[1], orderedIds[0], orderedIds[2]]]);
	});

	// 验证 `/model` 作用域标签按用户顺序显示模型；无参数，无返回值。
	it("preserves scoped model order in the /model scoped tab", async () => {
		// harness 提供三个可供选择器展示的虚拟模型。
		const harness = await createHarness({
			models: [
				{ id: "faux-1", name: "One", reasoning: true },
				{ id: "faux-2", name: "Two", reasoning: true },
				{ id: "faux-3", name: "Three", reasoning: true },
			],
		});
		harnesses.push(harness);

		// modelOne、modelTwo、modelThree 是按标识取得的三个模型对象。
		const modelOne = harness.getModel("faux-1")!;
		const modelTwo = harness.getModel("faux-2")!;
		const modelThree = harness.getModel("faux-3")!;
		// selector 以 Two、One、Three 的作用域顺序构造。
		const selector = new ModelSelectorComponent(
			createFakeTui(),
			modelOne,
			harness.session.modelRuntime,
			[{ model: modelTwo }, { model: modelOne }, { model: modelThree }],
			() => {},
			() => {},
		);

		// 等待异步模型目录刷新完成并出现状态文本。
		await vi.waitFor(() => {
			// rendered 是当前选择器的无 ANSI 文本。
			const rendered = stripAnsi(selector.render(120).join("\n"));
			expect(rendered).toContain(`[${modelOne.provider}]`);
			expect(rendered).toContain("Model catalogs refreshed.");
		});

		// renderedLines 是只包含当前提供商模型项的渲染行。
		const renderedLines = stripAnsi(selector.render(120).join("\n"))
			.split("\n")
			.filter((line) => line.includes(`[${modelOne.provider}]`));
		// orderedIds 从前三条模型行中解析显示标识。
		const orderedIds = renderedLines.slice(0, 3).map((line) => {
			// line 是当前模型渲染行，modelId 是去除箭头与提供商后的标识。
			const [modelId] = line.trim().replace(/^→\s*/, "").split(" [");
			return modelId?.replace(/^✓\s*/, "").trim() ?? "";
		});

		expect(orderedIds).toEqual([modelTwo.id, modelOne.id, modelThree.id]);
	});
});
