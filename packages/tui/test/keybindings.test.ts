/**
 * 文件职责：验证 TUI 默认按键、用户重绑定、共享按键保留和冲突报告规则。
 * 技术维度：使用 Node 测试运行器、assert 和真实 KeybindingsManager。
 * 产品维度：保证自定义快捷键不会意外删除其他默认操作，并能报告明确冲突。
 * 逻辑维度：覆盖 Ctrl+J 别名、提交重绑、共享方向键和两个用户绑定冲突。
 * 关键边界：断言依赖默认绑定及顺序；默认表变更时需重新评估期望值。
 * 新手阅读建议：先理解 getKeys 与 matches，再比较默认共享和用户冲突。
 */
import assert from "node:assert";
import { describe, it } from "node:test";
import { KeybindingsManager, TUI_KEYBINDINGS } from "../src/keybindings.ts";

/** 按键合并与冲突处理测试组。 */
describe("KeybindingsManager", () => {
	/** 验证默认换行支持 Shift+Enter、Ctrl+J 及终端序列。 */
	it("binds Ctrl+J as a default newline alias", () => {
		/** 只加载默认绑定的管理器。 */
		const keybindings = new KeybindingsManager(TUI_KEYBINDINGS);

		assert.deepStrictEqual(keybindings.getKeys("tui.input.newLine"), ["shift+enter", "ctrl+j"]);
		assert.strictEqual(keybindings.matches("\n", "tui.input.newLine"), true);
		assert.strictEqual(keybindings.matches("\x1b[106;5u", "tui.input.newLine"), true);
	});

	/** 验证重绑输入提交不会移除选择器默认 Enter。 */
	it("does not evict selector confirm when input submit is rebound", () => {
		/** 覆盖 submit 的按键管理器。 */
		const keybindings = new KeybindingsManager(TUI_KEYBINDINGS, {
			"tui.input.submit": ["enter", "ctrl+enter"],
		});

		assert.deepStrictEqual(keybindings.getKeys("tui.input.submit"), ["enter", "ctrl+enter"]);
		assert.deepStrictEqual(keybindings.getKeys("tui.select.confirm"), ["enter"]);
	});

	/** 验证选择器复用 Up 不会移除编辑器光标 Up。 */
	it("does not evict cursor bindings when another action reuses the same key", () => {
		/** 为选择器添加共享键的管理器。 */
		const keybindings = new KeybindingsManager(TUI_KEYBINDINGS, {
			"tui.select.up": ["up", "ctrl+p"],
		});

		assert.deepStrictEqual(keybindings.getKeys("tui.select.up"), ["up", "ctrl+p"]);
		assert.deepStrictEqual(keybindings.getKeys("tui.editor.cursorUp"), ["up"]);
	});

	/** 验证两个用户绑定复用 Ctrl+X 会报告冲突但不驱逐默认键。 */
	it("still reports direct user binding conflicts without evicting defaults", () => {
		/** 包含直接用户冲突的管理器。 */
		const keybindings = new KeybindingsManager(TUI_KEYBINDINGS, {
			"tui.input.submit": "ctrl+x",
			"tui.select.confirm": "ctrl+x",
		});

		assert.deepStrictEqual(keybindings.getConflicts(), [
			{
				key: "ctrl+x",
				keybindings: ["tui.input.submit", "tui.select.confirm"],
			},
		]);
		assert.deepStrictEqual(keybindings.getKeys("tui.editor.cursorLeft"), ["left", "ctrl+b"]);
	});
});
