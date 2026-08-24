/**
 * 文件职责：验证会话树选择器的树构建、过滤、折叠、分支导航、元数据展示和复制行为。
 * 技术维度：使用 Vitest 构造会话条目树，并用终端按键序列驱动 TreeSelector 的交互状态。
 * 产品维度：保证用户浏览历史会话分支时能准确定位、筛选和选择目标节点。
 * 逻辑维度：先构造各类消息和树夹具，再测试展示信息、过滤器、帮助、复制以及方向键导航。
 * 关键边界：树结构要求父子编号一致；显示断言受终端宽度和折叠状态影响，按键序列必须保持精确。
 * 新手阅读建议：先看消息工厂和 buildTree，再理解基础选择结果，最后阅读分支折叠与过滤组合用例。
 */
import { stripVTControlCharacters } from "node:util";
import { setKeybindings, visibleWidth } from "@earendil-works/pi-tui";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import { KeybindingsManager } from "../src/core/keybindings.ts";
import type {
	ModelChangeEntry,
	SessionEntry,
	SessionMessageEntry,
	SessionTreeNode,
} from "../src/core/session-manager.ts";
import { TreeSelectorComponent } from "../src/modes/interactive/components/tree-selector.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";

beforeAll(() => {
	initTheme("dark");
});

beforeEach(() => {
	// Ensure test isolation: keybindings are a global singleton
	// 中文说明：上方英文注释描述“Ensure test isolation: keybindings are a global singlet”相关前提、步骤或边界；下面代码按该说明执行。
	setKeybindings(new KeybindingsManager());
});

// Helper to create a user message entry
// 中文说明：上方英文注释描述“Helper to create a user message entry”相关前提、步骤或边界；下面代码按该说明执行。
function userMessage(id: string, parentId: string | null, content: string): SessionMessageEntry {
	return {
		type: "message",
		id,
		parentId,
		timestamp: new Date().toISOString(),
		message: { role: "user", content, timestamp: Date.now() },
	};
}

// Helper to create an assistant message entry
// 中文说明：上方英文注释描述“Helper to create an assistant message entry”相关前提、步骤或边界；下面代码按该说明执行。
function assistantMessage(id: string, parentId: string | null, text: string): SessionMessageEntry {
	return {
		type: "message",
		id,
		parentId,
		timestamp: new Date().toISOString(),
		message: {
			role: "assistant",
			content: [{ type: "text", text }],
			api: "anthropic-messages",
			provider: "anthropic",
			model: "claude-sonnet-4",
			usage: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 0,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "stop",
			timestamp: Date.now(),
		},
	};
}

// Helper to create a tool-call-only assistant message (filtered out in default mode)
// 中文说明：上方英文注释描述“Helper to create a tool-call-only assistant message (fi”相关前提、步骤或边界；下面代码按该说明执行。
function toolCallOnlyAssistant(id: string, parentId: string | null): SessionMessageEntry {
	return {
		type: "message",
		id,
		parentId,
		timestamp: new Date().toISOString(),
		message: {
			role: "assistant",
			content: [{ type: "toolCall", id: `tc-${id}`, name: "read", arguments: { path: "test.ts" } }],
			api: "anthropic-messages",
			provider: "anthropic",
			model: "claude-sonnet-4",
			usage: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 0,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "toolUse",
			timestamp: Date.now(),
		},
	};
}

// Helper to create a model_change entry
// 中文说明：上方英文注释描述“Helper to create a model_change entry”相关前提、步骤或边界；下面代码按该说明执行。
function modelChange(id: string, parentId: string | null): ModelChangeEntry {
	return {
		type: "model_change",
		id,
		parentId,
		timestamp: new Date().toISOString(),
		provider: "anthropic",
		modelId: "claude-sonnet-4",
	};
}

// Helper to build a tree from entries using parentId relationships
// 中文说明：上方英文注释描述“Helper to build a tree from entries using parentId rela”相关前提、步骤或边界；下面代码按该说明执行。
function buildTree(entries: Array<SessionEntry>): SessionTreeNode[] {
	if (entries.length === 0) return [];

	/** 常量 nodes 保存“nodes”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const nodes: SessionTreeNode[] = entries.map((entry) => ({
		entry,
		children: [],
	}));

	/** 常量 byId 保存“byId”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const byId = new Map<string, SessionTreeNode>();
	/** 循环变量 node 表示当前遍历项或索引，只在本循环体内有效。 */
	for (const node of nodes) {
		byId.set(node.entry.id, node);
	}

	/** 常量 roots 保存“roots”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
	const roots: SessionTreeNode[] = [];
	/** 循环变量 node 表示当前遍历项或索引，只在本循环体内有效。 */
	for (const node of nodes) {
		if (node.entry.parentId === null) {
			roots.push(node);
		} else {
			/** 常量 parent 保存“parent”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const parent = byId.get(node.entry.parentId);
			if (parent) {
				parent.children.push(node);
			}
		}
	}
	return roots;
}

// 用例分组：集中验证“TreeSelectorComponent”相关功能。
describe("TreeSelectorComponent", () => {
	// 用例分组：集中验证“initial selection with metadata entries”相关功能。
	describe("initial selection with metadata entries", () => {
		// 测试场景：验证“focuses nearest visible ancestor when currentLeafId is a model_change with sibling branch”对应的行为、返回值与边界条件。
		test("focuses nearest visible ancestor when currentLeafId is a model_change with sibling branch", () => {
			// Tree structure:
			// user-1
			// └── asst-1
			//     ├── user-2 (active branch)
			//     │   └── model-1 (model_change, CURRENT LEAF)
			//     └── user-3 (sibling branch, added later chronologically)
			// 中文说明：上方英文注释描述“Tree structure: user-1 └── asst-1 ├── user-2 (active br”相关前提、步骤或边界；下面代码按该说明执行。
			const entries = [
				userMessage("user-1", null, "hello"),
				assistantMessage("asst-1", "user-1", "hi"),
				userMessage("user-2", "asst-1", "active branch"), // Active branch
				modelChange("model-1", "user-2"), // Current leaf (metadata)
				userMessage("user-3", "asst-1", "sibling branch"), // Sibling branch
			];
			/** 常量 tree 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const tree = buildTree(entries);

			/** 常量 selector 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const selector = new TreeSelectorComponent(
				tree,
				"model-1", // currentLeafId is the model_change entry
				24,
				() => {},
				() => {},
			);

			/** 常量 list 保存“list”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const list = selector.getTreeList();
			// Should focus on user-2 (parent of model-1), not user-3 (last item)
			// 中文说明：上方英文注释描述“Should focus on user-2 (parent of model-1), not user-3 ”相关前提、步骤或边界；下面代码按该说明执行。
			expect(list.getSelectedNode()?.entry.id).toBe("user-2");
		});

		// 测试场景：验证“focuses nearest visible ancestor when currentLeafId is a thinking_level_change entry”对应的行为、返回值与边界条件。
		test("focuses nearest visible ancestor when currentLeafId is a thinking_level_change entry", () => {
			// Similar structure with thinking_level_change instead of model_change
			// 中文说明：上方英文注释描述“Similar structure with thinking_level_change instead of”相关前提、步骤或边界；下面代码按该说明执行。
			const entries = [
				userMessage("user-1", null, "hello"),
				assistantMessage("asst-1", "user-1", "hi"),
				userMessage("user-2", "asst-1", "active branch"),
				{
					type: "thinking_level_change" as const,
					id: "thinking-1",
					parentId: "user-2",
					timestamp: new Date().toISOString(),
					thinkingLevel: "high",
				},
				userMessage("user-3", "asst-1", "sibling branch"),
			];
			/** 常量 tree 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const tree = buildTree(entries);

			/** 常量 selector 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const selector = new TreeSelectorComponent(
				tree,
				"thinking-1",
				24,
				() => {},
				() => {},
			);

			/** 常量 list 保存“list”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const list = selector.getTreeList();
			expect(list.getSelectedNode()?.entry.id).toBe("user-2");
		});
	});

	// 用例分组：集中验证“filter switching with parent traversal”相关功能。
	describe("filter switching with parent traversal", () => {
		// 测试场景：验证“switches to nearest visible user message when changing to user-only filter”对应的行为、返回值与边界条件。
		test("switches to nearest visible user message when changing to user-only filter", () => {
			// In user-only filter: [user-1, user-2, user-3]
			// 中文说明：上方英文注释描述“In user-only filter: [user-1, user-2, user-3]”相关前提、步骤或边界；下面代码按该说明执行。
			const entries = [
				userMessage("user-1", null, "hello"),
				assistantMessage("asst-1", "user-1", "hi"),
				userMessage("user-2", "asst-1", "active branch"),
				assistantMessage("asst-2", "user-2", "response"),
				userMessage("user-3", "asst-1", "sibling branch"),
			];
			/** 常量 tree 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const tree = buildTree(entries);

			/** 常量 selector 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const selector = new TreeSelectorComponent(
				tree,
				"asst-2",
				24,
				() => {},
				() => {},
			);

			/** 常量 list 保存“list”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const list = selector.getTreeList();
			expect(list.getSelectedNode()?.entry.id).toBe("asst-2");

			// Simulate Ctrl+U (user-only filter)
			// 中文说明：上方英文注释描述“Simulate Ctrl+U (user-only filter)”相关前提、步骤或边界；下面代码按该说明执行。
			selector.handleInput("\x15");

			// Should now be on user-2 (the parent user message), not user-3
			// 中文说明：上方英文注释描述“Should now be on user-2 (the parent user message), not ”相关前提、步骤或边界；下面代码按该说明执行。
			expect(list.getSelectedNode()?.entry.id).toBe("user-2");
		});

		// 测试场景：验证“returns to nearest visible ancestor when switching back to default filter”对应的行为、返回值与边界条件。
		test("returns to nearest visible ancestor when switching back to default filter", () => {
			// Same branching structure
			// 中文说明：上方英文注释描述“Same branching structure”相关前提、步骤或边界；下面代码按该说明执行。
			const entries = [
				userMessage("user-1", null, "hello"),
				assistantMessage("asst-1", "user-1", "hi"),
				userMessage("user-2", "asst-1", "active branch"),
				assistantMessage("asst-2", "user-2", "response"),
				userMessage("user-3", "asst-1", "sibling branch"),
			];
			/** 常量 tree 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const tree = buildTree(entries);

			/** 常量 selector 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const selector = new TreeSelectorComponent(
				tree,
				"asst-2",
				24,
				() => {},
				() => {},
			);

			/** 常量 list 保存“list”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const list = selector.getTreeList();
			expect(list.getSelectedNode()?.entry.id).toBe("asst-2");

			// Switch to user-only
			// 中文说明：上方英文注释描述“Switch to user-only”相关前提、步骤或边界；下面代码按该说明执行。
			selector.handleInput("\x15"); // Ctrl+U
			expect(list.getSelectedNode()?.entry.id).toBe("user-2");

			// Switch back to default - should stay on user-2
			// (since that's what we navigated to via parent traversal)
			// 中文说明：上方英文注释描述“Switch back to default - should stay on user-2 (since t”相关前提、步骤或边界；下面代码按该说明执行。
			selector.handleInput("\x04"); // Ctrl+D
			expect(list.getSelectedNode()?.entry.id).toBe("user-2");
		});
	});

	// 用例分组：集中验证“help”相关功能。
	describe("help", () => {
		// 测试场景：验证“renders semantic help rows without truncating narrow terminal controls”对应的行为、返回值与边界条件。
		test("renders semantic help rows without truncating narrow terminal controls", () => {
			/** 常量 entries 保存“entries”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const entries = [userMessage("user-1", null, "hello"), assistantMessage("asst-1", "user-1", "hi")];
			/** 常量 tree 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const tree = buildTree(entries);
			/** 常量 selector 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const selector = new TreeSelectorComponent(
				tree,
				"asst-1",
				24,
				() => {},
				() => {},
			);

			/** 常量 plainLines 保存“plainLines”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const plainLines = selector.render(30).map(stripVTControlCharacters);
			/** 常量 plain 保存“plain”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const plain = plainLines.join("\n");
			expect(plain).toContain("branch");
			expect(plain).toContain("copy");
			expect(plain).toContain("filters");
			expect(plain).toContain("cycle");
			expect(plain).toContain("label time");
			expect(plain).not.toContain("...");
			expect(plainLines.every((line) => visibleWidth(line) <= 30)).toBe(true);
		});
	});

	// 用例分组：集中验证“copy”相关功能。
	describe("copy", () => {
		// 测试场景：验证“copies the full selected message with ctrl+x”对应的行为、返回值与边界条件。
		test("copies the full selected message with ctrl+x", () => {
			/** 常量 message 保存当前场景使用的消息或消息集合；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const message = `${"long message ".repeat(30)}\nsecond line`;
			/** 常量 tree 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const tree = buildTree([userMessage("user-1", null, "hello"), assistantMessage("asst-1", "user-1", message)]);
			/** 常量 selector 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const selector = new TreeSelectorComponent(
				tree,
				"asst-1",
				24,
				() => {},
				() => {},
			);
			/** 变量 copied 保存“copied”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			let copied: string | undefined;
			selector.onCopy = (text) => {
				copied = text;
			};

			selector.handleInput("\x18");

			expect(copied).toBe(message);
		});
	});

	// 用例分组：集中验证“label timestamps”相关功能。
	describe("label timestamps", () => {
		// 测试场景：验证“toggles label timestamps for labeled nodes”对应的行为、返回值与边界条件。
		test("toggles label timestamps for labeled nodes", () => {
			/** 常量 entries 保存“entries”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const entries = [userMessage("user-1", null, "hello"), assistantMessage("asst-1", "user-1", "hi")];
			/** 常量 tree 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const tree = buildTree(entries);
			/** 常量 labelDate 保存“labelDate”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const labelDate = new Date(2026, 2, 28, 14, 32, 0);
			tree[0]!.label = "checkpoint";
			tree[0]!.labelTimestamp = labelDate.toISOString();

			/** 常量 selector 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const selector = new TreeSelectorComponent(
				tree,
				"asst-1",
				24,
				() => {},
				() => {},
			);

			/** 常量 list 保存“list”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const list = selector.getTreeList();
			/** 变量 render 保存“render”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			let render = list.render(200).join("\n");
			expect(render).toContain("[checkpoint]");
			expect(render).not.toContain("3/28 14:32");
			expect(render).not.toContain("[+label time]");

			selector.handleInput("T");

			render = list.render(200).join("\n");
			expect(render).toContain("3/28 14:32");
			expect(render).toContain("[+label time]");
		});
	});

	// 用例分组：集中验证“empty filter preservation”相关功能。
	describe("empty filter preservation", () => {
		// 测试场景：验证“preserves selection when switching to empty labeled filter and back”对应的行为、返回值与边界条件。
		test("preserves selection when switching to empty labeled filter and back", () => {
			// Tree with no labels
			// 中文说明：上方英文注释描述“Tree with no labels”相关前提、步骤或边界；下面代码按该说明执行。
			const entries = [
				userMessage("user-1", null, "hello"),
				assistantMessage("asst-1", "user-1", "hi"),
				userMessage("user-2", "asst-1", "bye"),
				assistantMessage("asst-2", "user-2", "goodbye"),
			];
			/** 常量 tree 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const tree = buildTree(entries);

			/** 常量 selector 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const selector = new TreeSelectorComponent(
				tree,
				"asst-2",
				24,
				() => {},
				() => {},
			);

			/** 常量 list 保存“list”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const list = selector.getTreeList();
			expect(list.getSelectedNode()?.entry.id).toBe("asst-2");

			// Switch to labeled-only filter (no labels exist, so empty result)
			// 中文说明：上方英文注释描述“Switch to labeled-only filter (no labels exist, so empt”相关前提、步骤或边界；下面代码按该说明执行。
			selector.handleInput("\x0c"); // Ctrl+L

			// The list should be empty, getSelectedNode returns undefined
			// 中文说明：上方英文注释描述“The list should be empty, getSelectedNode returns undef”相关前提、步骤或边界；下面代码按该说明执行。
			expect(list.getSelectedNode()).toBeUndefined();

			// Switch back to default filter
			// 中文说明：上方英文注释描述“Switch back to default filter”相关前提、步骤或边界；下面代码按该说明执行。
			selector.handleInput("\x04"); // Ctrl+D

			// Should restore to asst-2 (the selection before we switched to empty filter)
			// 中文说明：上方英文注释描述“Should restore to asst-2 (the selection before we switc”相关前提、步骤或边界；下面代码按该说明执行。
			expect(list.getSelectedNode()?.entry.id).toBe("asst-2");
		});

		// 测试场景：验证“preserves selection through multiple empty filter switches”对应的行为、返回值与边界条件。
		test("preserves selection through multiple empty filter switches", () => {
			/** 常量 entries 保存“entries”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const entries = [userMessage("user-1", null, "hello"), assistantMessage("asst-1", "user-1", "hi")];
			/** 常量 tree 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const tree = buildTree(entries);

			/** 常量 selector 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const selector = new TreeSelectorComponent(
				tree,
				"asst-1",
				24,
				() => {},
				() => {},
			);

			/** 常量 list 保存“list”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const list = selector.getTreeList();
			expect(list.getSelectedNode()?.entry.id).toBe("asst-1");

			// Switch to labeled-only (empty) - Ctrl+L toggles labeled ↔ default
			// 中文说明：上方英文注释描述“Switch to labeled-only (empty) - Ctrl+L toggles labeled”相关前提、步骤或边界；下面代码按该说明执行。
			selector.handleInput("\x0c"); // Ctrl+L -> labeled-only
			expect(list.getSelectedNode()).toBeUndefined();

			// Switch to default, then back to labeled-only
			// 中文说明：上方英文注释描述“Switch to default, then back to labeled-only”相关前提、步骤或边界；下面代码按该说明执行。
			selector.handleInput("\x0c"); // Ctrl+L -> default (toggle back)
			expect(list.getSelectedNode()?.entry.id).toBe("asst-1");

			selector.handleInput("\x0c"); // Ctrl+L -> labeled-only again
			expect(list.getSelectedNode()).toBeUndefined();

			// Switch back to default with Ctrl+D
			// 中文说明：上方英文注释描述“Switch back to default with Ctrl+D”相关前提、步骤或边界；下面代码按该说明执行。
			selector.handleInput("\x04"); // Ctrl+D
			expect(list.getSelectedNode()?.entry.id).toBe("asst-1");
		});
	});

	// 用例分组：集中验证“branch navigation and folding with ctrl+arrow keys”相关功能。
	describe("branch navigation and folding with ctrl+arrow keys", () => {
		// Key escape sequences
		// 中文说明：上方英文注释描述“Key escape sequences”相关前提、步骤或边界；下面代码按该说明执行。
		const UP = "\x1b[A";
		/** 常量 DOWN 保存“DOWN”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const DOWN = "\x1b[B";
		/** 常量 CTRL_LEFT 保存“CTRL_LEFT”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const CTRL_LEFT = "\x1b[1;5D";
		/** 常量 CTRL_RIGHT 保存“CTRL_RIGHT”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const CTRL_RIGHT = "\x1b[1;5C";
		/** 常量 ALT_LEFT 保存“ALT_LEFT”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const ALT_LEFT = "\x1b[1;3D";
		/** 常量 ALT_RIGHT 保存“ALT_RIGHT”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
		const ALT_RIGHT = "\x1b[1;3C";

		// Tree structure:
		//
		// user-1
		// asst-1
		// user-2
		// asst-2          ← branch point (has 2 children)
		// ├─ user-3a      ← branch A (active: leaf is asst-4a)
		// │  asst-3a
		// │  user-4a
		// │  asst-4a
		// └─ user-3b      ← branch B
		//    asst-3b
		//    user-4b
		//
		// Foldable nodes: user-1 (root), user-3a (segment start), user-3b (segment start)
		// 中文说明：上方英文注释描述“Tree structure: user-1 asst-1 user-2 asst-2 ← branch po”相关前提、步骤或边界；下面代码按该说明执行。

		/** 构建 buildBranchingTree 对应步骤；无参数；返回值供调用方继续执行或断言。示例：buildBranchingTree()。 */
		function buildBranchingTree() {
			/** 常量 entries 保存“entries”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const entries: SessionEntry[] = [
				userMessage("user-1", null, "first message"),
				assistantMessage("asst-1", "user-1", "response 1"),
				userMessage("user-2", "asst-1", "second message"),
				assistantMessage("asst-2", "user-2", "response 2"),
				// Branch A (active)
				// 中文说明：上方英文注释描述“Branch A (active)”相关前提、步骤或边界；下面代码按该说明执行。
				userMessage("user-3a", "asst-2", "branch A start"),
				assistantMessage("asst-3a", "user-3a", "branch A response"),
				userMessage("user-4a", "asst-3a", "branch A deep"),
				assistantMessage("asst-4a", "user-4a", "branch A leaf"),
				// Branch B
				// 中文说明：上方英文注释描述“Branch B”相关前提、步骤或边界；下面代码按该说明执行。
				userMessage("user-3b", "asst-2", "branch B start"),
				assistantMessage("asst-3b", "user-3b", "branch B response"),
				userMessage("user-4b", "asst-3b", "branch B deep"),
			];
			return buildTree(entries);
		}

		// 测试场景：验证“ctrl+right unfolds a folded node, then does segment jump when unfolded”对应的行为、返回值与边界条件。
		test("ctrl+right unfolds a folded node, then does segment jump when unfolded", () => {
			/** 常量 tree 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const tree = buildBranchingTree();
			/** 常量 selector 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const selector = new TreeSelectorComponent(
				tree,
				"asst-4a",
				24,
				() => {},
				() => {},
			);
			/** 常量 list 保存“list”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const list = selector.getTreeList();

			selector.handleInput(CTRL_LEFT); // asst-4a → user-3a
			expect(list.getSelectedNode()?.entry.id).toBe("user-3a");

			selector.handleInput(CTRL_LEFT); // fold user-3a
			expect(list.getSelectedNode()?.entry.id).toBe("user-3a");

			selector.handleInput(DOWN); // user-3a → user-3b (children hidden)
			expect(list.getSelectedNode()?.entry.id).toBe("user-3b");

			selector.handleInput(UP); // user-3b → user-3a
			expect(list.getSelectedNode()?.entry.id).toBe("user-3a");

			selector.handleInput(CTRL_RIGHT); // unfold user-3a
			expect(list.getSelectedNode()?.entry.id).toBe("user-3a");

			selector.handleInput(DOWN); // user-3a → asst-3a (children restored)
			expect(list.getSelectedNode()?.entry.id).toBe("asst-3a");

			selector.handleInput(CTRL_LEFT); // asst-3a → user-3a
			expect(list.getSelectedNode()?.entry.id).toBe("user-3a");

			selector.handleInput(CTRL_RIGHT); // user-3a → asst-4a (segment jump to leaf)
			expect(list.getSelectedNode()?.entry.id).toBe("asst-4a");
		});

		// 测试场景：验证“alt+left/right are aliases for fold and unfold navigation”对应的行为、返回值与边界条件。
		test("alt+left/right are aliases for fold and unfold navigation", () => {
			/** 常量 tree 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const tree = buildBranchingTree();
			/** 常量 selector 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const selector = new TreeSelectorComponent(
				tree,
				"asst-4a",
				24,
				() => {},
				() => {},
			);
			/** 常量 list 保存“list”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const list = selector.getTreeList();

			selector.handleInput(ALT_LEFT); // asst-4a → user-3a
			expect(list.getSelectedNode()?.entry.id).toBe("user-3a");

			selector.handleInput(ALT_LEFT); // fold user-3a
			expect(list.getSelectedNode()?.entry.id).toBe("user-3a");

			selector.handleInput(ALT_RIGHT); // unfold user-3a
			expect(list.getSelectedNode()?.entry.id).toBe("user-3a");

			selector.handleInput(ALT_RIGHT); // user-3a → asst-4a
			expect(list.getSelectedNode()?.entry.id).toBe("asst-4a");
		});

		// 测试场景：验证“folding root hides entire subtree, nested fold preserved on unfold”对应的行为、返回值与边界条件。
		test("folding root hides entire subtree, nested fold preserved on unfold", () => {
			/** 常量 tree 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const tree = buildBranchingTree();
			/** 常量 selector 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const selector = new TreeSelectorComponent(
				tree,
				"asst-4a",
				24,
				() => {},
				() => {},
			);
			/** 常量 list 保存“list”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const list = selector.getTreeList();

			selector.handleInput(CTRL_LEFT); // asst-4a → user-3a
			expect(list.getSelectedNode()?.entry.id).toBe("user-3a");

			selector.handleInput(CTRL_LEFT); // fold user-3a
			expect(list.getSelectedNode()?.entry.id).toBe("user-3a");

			selector.handleInput(CTRL_LEFT); // user-3a (folded) → user-1
			expect(list.getSelectedNode()?.entry.id).toBe("user-1");

			selector.handleInput(CTRL_LEFT); // fold user-1
			expect(list.getSelectedNode()?.entry.id).toBe("user-1");

			selector.handleInput(DOWN); // wrap (only visible node)
			expect(list.getSelectedNode()?.entry.id).toBe("user-1");

			selector.handleInput(CTRL_RIGHT); // unfold user-1
			expect(list.getSelectedNode()?.entry.id).toBe("user-1");

			selector.handleInput(CTRL_RIGHT); // user-1 → user-3a (segment jump, user-3a still folded)
			expect(list.getSelectedNode()?.entry.id).toBe("user-3a");

			selector.handleInput(DOWN); // user-3a → user-3b (user-3a still folded)
			expect(list.getSelectedNode()?.entry.id).toBe("user-3b");
		});

		// 测试场景：验证“fold and navigate on non-active branch”对应的行为、返回值与边界条件。
		test("fold and navigate on non-active branch", () => {
			/** 常量 tree 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const tree = buildBranchingTree();
			/** 常量 selector 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const selector = new TreeSelectorComponent(
				tree,
				"asst-4a",
				24,
				() => {},
				() => {},
			);
			/** 常量 list 保存“list”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const list = selector.getTreeList();

			// Navigate down to user-3b (branch B)
			// 中文说明：上方英文注释描述“Navigate down to user-3b (branch B)”相关前提、步骤或边界；下面代码按该说明执行。
			let found = false;
			/** 循环变量 i 表示当前遍历项或索引，只在本循环体内有效。 */
			for (let i = 0; i < 20; i++) {
				selector.handleInput(DOWN);
				if (list.getSelectedNode()?.entry.id === "user-3b") {
					found = true;
					break;
				}
			}
			expect(found).toBe(true);

			selector.handleInput(CTRL_RIGHT); // user-3b → user-4b (segment jump to leaf)
			expect(list.getSelectedNode()?.entry.id).toBe("user-4b");

			selector.handleInput(CTRL_LEFT); // user-4b → user-3b
			expect(list.getSelectedNode()?.entry.id).toBe("user-3b");

			selector.handleInput(CTRL_LEFT); // fold user-3b
			expect(list.getSelectedNode()?.entry.id).toBe("user-3b");

			selector.handleInput(CTRL_LEFT); // user-3b (folded) → user-1
			expect(list.getSelectedNode()?.entry.id).toBe("user-1");
		});

		// 测试场景：验证“fold and navigate with multiple roots”对应的行为、返回值与边界条件。
		test("fold and navigate with multiple roots", () => {
			/** 常量 entries 保存“entries”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const entries: SessionEntry[] = [
				userMessage("user-1", null, "first root"),
				assistantMessage("asst-1", "user-1", "response 1"),
				userMessage("user-2", null, "second root"),
				assistantMessage("asst-2", "user-2", "response 2"),
			];
			/** 常量 tree 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const tree = buildTree(entries);
			/** 常量 selector 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const selector = new TreeSelectorComponent(
				tree,
				"asst-1",
				24,
				() => {},
				() => {},
			);
			/** 常量 list 保存“list”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const list = selector.getTreeList();

			expect(list.getSelectedNode()?.entry.id).toBe("asst-1");

			selector.handleInput(CTRL_LEFT); // asst-1 → user-1
			expect(list.getSelectedNode()?.entry.id).toBe("user-1");

			selector.handleInput(CTRL_LEFT); // fold user-1
			expect(list.getSelectedNode()?.entry.id).toBe("user-1");

			selector.handleInput(DOWN); // user-1 → user-2 (children hidden)
			expect(list.getSelectedNode()?.entry.id).toBe("user-2");

			selector.handleInput(CTRL_RIGHT); // user-2 → asst-2 (segment jump to leaf)
			expect(list.getSelectedNode()?.entry.id).toBe("asst-2");

			selector.handleInput(CTRL_LEFT); // asst-2 → user-2
			expect(list.getSelectedNode()?.entry.id).toBe("user-2");

			selector.handleInput(CTRL_LEFT); // fold user-2
			expect(list.getSelectedNode()?.entry.id).toBe("user-2");

			selector.handleInput(CTRL_LEFT); // user-2 (folded, root) → stays on user-2
			expect(list.getSelectedNode()?.entry.id).toBe("user-2");
		});

		// 测试场景：验证“folding root hides descendants even when intermediate nodes are filtered out”对应的行为、返回值与边界条件。
		test("folding root hides descendants even when intermediate nodes are filtered out", () => {
			// user-1 → toolCallOnly-1 (filtered out) → user-2 → asst-2
			// 中文说明：上方英文注释描述“user-1 → toolCallOnly-1 (filtered out) → user-2 → asst-”相关前提、步骤或边界；下面代码按该说明执行。
			const entries: SessionEntry[] = [
				userMessage("user-1", null, "hello"),
				toolCallOnlyAssistant("tool-asst-1", "user-1"),
				userMessage("user-2", "tool-asst-1", "follow up"),
				assistantMessage("asst-2", "user-2", "response"),
			];
			/** 常量 tree 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const tree = buildTree(entries);
			/** 常量 selector 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const selector = new TreeSelectorComponent(
				tree,
				"asst-2",
				24,
				() => {},
				() => {},
			);
			/** 常量 list 保存“list”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const list = selector.getTreeList();

			selector.handleInput(CTRL_LEFT); // asst-2 → user-1
			expect(list.getSelectedNode()?.entry.id).toBe("user-1");

			selector.handleInput(CTRL_LEFT); // fold user-1
			expect(list.getSelectedNode()?.entry.id).toBe("user-1");

			selector.handleInput(DOWN); // wrap (only visible node)
			expect(list.getSelectedNode()?.entry.id).toBe("user-1");
		});

		// 测试场景：验证“search resets fold state”对应的行为、返回值与边界条件。
		test("search resets fold state", () => {
			/** 常量 tree 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const tree = buildBranchingTree();
			/** 常量 selector 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const selector = new TreeSelectorComponent(
				tree,
				"asst-4a",
				24,
				() => {},
				() => {},
			);
			/** 常量 list 保存“list”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const list = selector.getTreeList();

			selector.handleInput(CTRL_LEFT); // asst-4a → user-3a
			selector.handleInput(CTRL_LEFT); // fold user-3a

			selector.handleInput(DOWN); // user-3a → user-3b (children hidden)
			expect(list.getSelectedNode()?.entry.id).toBe("user-3b");

			selector.handleInput("b"); // search resets folds
			selector.handleInput("\x1b"); // clear search

			// Navigate to user-3a to verify fold was reset
			// 中文说明：上方英文注释描述“Navigate to user-3a to verify fold was reset”相关前提、步骤或边界；下面代码按该说明执行。
			let currentId = "";
			/** 循环变量 i 表示当前遍历项或索引，只在本循环体内有效。 */
			for (let i = 0; i < 20; i++) {
				selector.handleInput(DOWN);
				currentId = list.getSelectedNode()?.entry.id ?? "";
				if (currentId === "user-3a") break;
			}
			expect(currentId).toBe("user-3a");

			selector.handleInput(DOWN); // user-3a → asst-3a (not user-3b)
			expect(list.getSelectedNode()?.entry.id).toBe("asst-3a");
		});

		// 测试场景：验证“filter mode change resets fold state”对应的行为、返回值与边界条件。
		test("filter mode change resets fold state", () => {
			/** 常量 tree 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const tree = buildBranchingTree();
			/** 常量 selector 保存当前场景的会话树或选择器；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const selector = new TreeSelectorComponent(
				tree,
				"asst-4a",
				24,
				() => {},
				() => {},
			);
			/** 常量 list 保存“list”对应的中间数据；取值由声明类型和当前场景约束，注意隔离可变状态。 */
			const list = selector.getTreeList();

			selector.handleInput(CTRL_LEFT); // asst-4a → user-3a
			selector.handleInput(CTRL_LEFT); // fold user-3a

			selector.handleInput("\x15"); // ctrl+u: user-only filter resets folds
			selector.handleInput("\x04"); // ctrl+d: back to default

			// Navigate to user-3a to verify fold was reset
			// 中文说明：上方英文注释描述“Navigate to user-3a to verify fold was reset”相关前提、步骤或边界；下面代码按该说明执行。
			let currentId = "";
			/** 循环变量 i 表示当前遍历项或索引，只在本循环体内有效。 */
			for (let i = 0; i < 20; i++) {
				selector.handleInput(DOWN);
				currentId = list.getSelectedNode()?.entry.id ?? "";
				if (currentId === "user-3a") break;
			}
			expect(currentId).toBe("user-3a");

			selector.handleInput(DOWN); // user-3a → asst-3a (not user-3b)
			expect(list.getSelectedNode()?.entry.id).toBe("asst-3a");
		});
	});
});
