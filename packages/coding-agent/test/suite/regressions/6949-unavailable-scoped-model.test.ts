/**
 * 文件职责：回归验证模型选择器能够展示、移除并保留模型目录中暂时不可用的启用或会话范围模型。
 * 技术维度：使用 Harness、ScopedModelsSelectorComponent、原型反射调用、按键模拟和 Vitest 异步等待测试 TUI 状态。
 * 产品维度：模型目录变化或提供商离线时，用户仍能看见旧配置并有意识地清理，而不会误丢部分范围设置。
 * 逻辑维度：构造最小 InteractiveMode 上下文，再覆盖组件移除、设置模式合并、纯会话模型和部分范围更新。
 * 关键边界：测试依赖初始化暗色主题和全局按键绑定；不可用模型用合成占位项表示。
 * 新手阅读建议：先看 createInteractiveContext 如何捕获选择器，再跟随每个用例的键盘输入和 setScopedModels 断言。
 */
import type { Api, Model } from "@earendil-works/pi-ai";
import { setKeybindings } from "@earendil-works/pi-tui";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { KeybindingsManager } from "../../../src/core/keybindings.ts";
import { ScopedModelsSelectorComponent } from "../../../src/modes/interactive/components/scoped-models-selector.ts";
import { InteractiveMode } from "../../../src/modes/interactive/interactive-mode.ts";
import { initTheme } from "../../../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../../../src/utils/ansi.ts";
import { createHarness, type Harness } from "../harness.ts";

/**
 * 构造调用私有模型选择器逻辑所需的最小交互上下文。
 * @param options 全部目录模型、启用模型 ID 和可选会话范围模型。
 * @returns 上下文、查询桩、选择器访问器和设置桩；例如 `createInteractiveContext({ allModels: [], enabledModelIds: [] })`。
 */
function createInteractiveContext(options: {
	allModels: Model<Api>[];
	enabledModelIds: string[];
	scopedModels?: Array<{ model: Model<Api> }>;
}) {
	// selector 在 showSelector 工厂执行后保存创建的组件。
	let selector: ScopedModelsSelectorComponent | undefined;
	// setScopedModels 记录交互选择后写回会话范围的模型列表。
	const setScopedModels = vi.fn();
	// getAvailable 模拟异步读取当前可用模型目录。
	const getAvailable = vi.fn().mockResolvedValue(options.allModels);
	// context 是 showModelsSelector 实际读取的最小 this 结构。
	const context = {
		session: {
			modelRuntime: {
				refresh: vi.fn(),
				getAvailable,
			},
			scopedModels: options.scopedModels ?? [],
			setScopedModels,
		},
		settingsManager: {
			getEnabledModels: () => options.enabledModelIds,
			setEnabledModels: vi.fn(),
		},
		showStatus: vi.fn(),
		showSelector: (factory: (done: () => void) => { component: ScopedModelsSelectorComponent }) => {
			selector = factory(() => {}).component;
		},
		updateAvailableProviderCount: vi.fn(),
		ui: { requestRender: vi.fn() },
	};
	return { context, getAvailable, getSelector: () => selector, setScopedModels };
}

/**
 * 通过反射调用 InteractiveMode 的非公开 showModelsSelector 方法。
 * @param context 满足该方法运行时读取字段的伪 this 对象。
 * @returns 选择器打开后的 Promise；例如 `await showModelsSelector(context)`。
 */
async function showModelsSelector(context: object): Promise<void> {
	// show 是从原型取得并收窄 this 签名后的私有方法引用。
	const show = Reflect.get(InteractiveMode.prototype, "showModelsSelector") as (this: object) => Promise<void>;
	await show.call(context);
}

// 回归覆盖 issue #6949 中不可用范围模型导致选择器丢失或清空配置的问题。
describe("issue #6949 unavailable scoped models", () => {
	// harnesses 收集每个用例创建的 Harness，结束后统一清理。
	const harnesses: Harness[] = [];

	// 全组测试前初始化组件渲染依赖的暗色主题。
	beforeAll(() => {
		initTheme("dark");
	});

	// 每个用例前重置全局按键映射，保证输入序列含义稳定。
	beforeEach(() => {
		setKeybindings(new KeybindingsManager());
	});

	// 每个用例后清理全部 Harness 资源。
	afterEach(() => {
		while (harnesses.length > 0) harnesses.pop()?.cleanup();
	});

	// 不在目录中的已启用模型应显示 unavailable，并允许取消勾选和持久化。
	it("shows and removes an enabled model without a catalog entry", async () => {
		// harness 提供一个正常可用模型作为对照。
		const harness = await createHarness({ models: [{ id: "available", name: "Available" }] });
		harnesses.push(harness);
		// availableId 是目录中真实模型的完整 provider/id。
		const availableId = `${harness.models[0].provider}/${harness.models[0].id}`;
		// unavailableId 模拟设置中存在但目录已移除的模型 ID。
		const unavailableId = `${harness.models[0].provider}/unavailable`;
		// changes 记录每次临时勾选变化。
		const changes: Array<string[] | null> = [];
		// persisted 记录用户保存时最终写入的模型集合。
		const persisted: Array<string[] | null> = [];
		// selector 直接以可用模型和混合启用 ID 创建。
		const selector = new ScopedModelsSelectorComponent(
			{
				allModels: [...harness.models],
				enabledModelIds: [unavailableId, availableId],
			},
			{
				onChange: (enabledIds) => {
					changes.push(enabledIds);
				},
				onPersist: (enabledIds) => {
					persisted.push(enabledIds);
				},
				onCancel: () => {},
			},
		);

		expect(stripAnsi(selector.render(100).join("\n"))).toContain(`${unavailableId} [unavailable] ✗`);
		selector.handleInput("\r");
		expect(changes).toEqual([[availableId]]);
		selector.handleInput("\x13");
		expect(persisted).toEqual([[availableId]]);
	});

	// 未匹配设置模式应一次合并解析后作为不可用项传给选择器。
	it("passes unmatched settings patterns to the selector with one combined resolution", async () => {
		// harness 提供用于构造完整 ID 的模型提供商信息。
		const harness = await createHarness({ models: [{ id: "available", name: "Available" }] });
		harnesses.push(harness);
		// unavailableIds 是两个不在可用目录中的启用模型 ID。
		const unavailableIds = ["unavailable-one", "unavailable-two"].map((id) => `${harness.models[0].provider}/${id}`);
		// context 打开模型选择器，getAvailable 记录合并解析次数。
		const { context, getAvailable, getSelector } = createInteractiveContext({
			allModels: [],
			enabledModelIds: unavailableIds,
		});

		await showModelsSelector(context);

		// selector 是 showModelsSelector 创建的实际组件。
		const selector = getSelector();
		if (!selector) throw new Error("Expected scoped-model selector to open");
		// rendered 是去除 ANSI 样式后的可断言文本。
		const rendered = stripAnsi(selector.render(100).join("\n"));
		// unavailableId 是当前应显示 unavailable 标记的模型标识。
		for (const unavailableId of unavailableIds) {
			expect(rendered).toContain(`${unavailableId} [unavailable] ✗`);
		}
		expect(getAvailable).toHaveBeenCalledTimes(2);
	});

	// 即使设置中没有启用模型，单个不可用的会话范围模型也应打开选择器。
	it("opens when only a session-scoped model is unavailable", async () => {
		// harness 创建一个随后从可用目录中排除的模型。
		const harness = await createHarness({ models: [{ id: "unavailable", name: "Unavailable" }] });
		harnesses.push(harness);
		// model 是仅存在于 session.scopedModels 的模型对象。
		const model = harness.models[0];
		// fullId 是期望显示的完整模型标识。
		const fullId = `${model.provider}/${model.id}`;
		// context 和 getSelector 是当前空目录选择器的交互上下文与读取函数。
		const { context, getSelector } = createInteractiveContext({
			allModels: [],
			enabledModelIds: [],
			scopedModels: [{ model }],
		});

		await showModelsSelector(context);

		// selector 是应被成功打开的模型选择组件。
		const selector = getSelector();
		if (!selector) throw new Error("Expected scoped-model selector to open");
		expect(stripAnsi(selector.render(100).join("\n"))).toContain(`${fullId} [unavailable] ✗`);
	});

	// 某个启用模型不可用时，调整部分范围不得错误清空其余已选模型。
	it("does not clear a partial scope when an enabled model is unavailable", async () => {
		// harness 提供三个可用模型，用于构造部分会话范围。
		const harness = await createHarness({
			models: [
				{ id: "one", name: "One" },
				{ id: "two", name: "Two" },
				{ id: "three", name: "Three" },
			],
		});
		harnesses.push(harness);
		// one 和 two 是当前会话范围中的两个模型。
		const [one, two] = harness.models;
		// enabledIds 是这两个可用模型的完整 ID。
		const enabledIds = [one, two].map((model) => `${model.provider}/${model.id}`);
		// unavailableId 是额外存在于设置但不在目录的模型。
		const unavailableId = `${one.provider}/unavailable`;
		// context、getSelector 和 setScopedModels 用于读取并更新当前作用域选择状态。
		const { context, getSelector, setScopedModels } = createInteractiveContext({
			allModels: [...harness.models],
			enabledModelIds: [...enabledIds, unavailableId],
			scopedModels: [{ model: one }, { model: two }],
		});

		await showModelsSelector(context);
		// selector 是已打开并包含可用、不可用项目的组件。
		const selector = getSelector();
		if (!selector) throw new Error("Expected scoped-model selector to open");
		selector.handleInput("\x1b[1;3B");

		await vi.waitFor(() => {
			expect(setScopedModels).toHaveBeenLastCalledWith([
				{ model: two, thinkingLevel: undefined },
				{ model: one, thinkingLevel: undefined },
			]);
		});
	});
});
