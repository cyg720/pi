/**
 * 文件职责：回归验证打开 `/model` 时重新读取 models.json 并刷新模型选择器与运行时。
 * 技术维度：使用 Vitest、Harness、模型选择组件、文件写入和最小 TUI 替身。
 * 产品维度：用户修改模型配置后无需重启即可看到新模型，并移除旧目录项。
 * 逻辑维度：创建旧目录 Harness，覆写 models.json，构造选择器，等待渲染出现新模型与刷新提示。
 * 关键边界：使用本地假提供方，不访问网络；Harness 与全局按键必须在测试间重置。
 * 新手阅读建议：先看 modelsJson 工厂，再对比文件写入前后的 modelRuntime 查询。
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { setKeybindings, type TUI } from "@earendil-works/pi-tui";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { KeybindingsManager } from "../../../src/core/keybindings.ts";
import { ModelSelectorComponent } from "../../../src/modes/interactive/components/model-selector.ts";
import { initTheme } from "../../../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../../../src/utils/ansi.ts";
import { createHarness, type Harness } from "../harness.ts";

/** @returns 只实现 requestRender 的最小 TUI 替身。 */
function createFakeTui(): TUI {
	return {
		requestRender: () => {},
	} as unknown as TUI;
}

/** @param provider 提供方 ID。@param model 模型 ID。@returns models.json 最小对象。 */
function modelsJson(provider: string, model: string): Record<string, unknown> {
	return {
		providers: {
			[provider]: {
				baseUrl: "https://example.test/v1",
				api: "openai-completions",
				apiKey: "test-key",
				models: [{ id: model }],
			},
		},
	};
}

/** 第 6999 号问题的模型配置热重载测试组。 */
describe("issue #6999 models.json hot reload", () => {
	/** 当前用例 Harness；afterEach 清理后恢复 undefined。 */
	let harness: Harness | undefined;

	/** 测试组开始时初始化暗色主题。 */
	beforeAll(() => {
		initTheme("dark");
	});

	/** 每例前重置全局按键管理器。 */
	beforeEach(() => {
		setKeybindings(new KeybindingsManager());
	});

	/** 每例后清理 Harness。 */
	afterEach(() => {
		harness?.cleanup();
		harness = undefined;
	});

	/** 验证打开选择器后新模型出现、刷新提示可见且旧模型删除。 */
	it("reloads models.json when opening /model", async () => {
		harness = await createHarness({ modelsJson: modelsJson("old-provider", "old-model") });
		expect(harness.session.modelRuntime.getModel("old-provider", "old-model")).toBeDefined();

		writeFileSync(join(harness.tempDir, "models.json"), JSON.stringify(modelsJson("new-provider", "new-model")));
		/** 构造时触发目录刷新并用于渲染断言的模型选择器。 */
		const selector = new ModelSelectorComponent(
			createFakeTui(),
			harness.getModel(),
			harness.settingsManager,
			harness.session.modelRuntime,
			[],
			() => {},
			() => {},
		);

		await vi.waitFor(() => {
			/** 去除 ANSI 后的选择器文本。 */
			const rendered = stripAnsi(selector.render(120).join("\n"));
			expect(rendered).toContain("new-model [new-provider]");
			expect(rendered).toContain("Model catalogs refreshed.");
		});
		expect(harness.session.modelRuntime.getModel("old-provider", "old-model")).toBeUndefined();
	});
});
