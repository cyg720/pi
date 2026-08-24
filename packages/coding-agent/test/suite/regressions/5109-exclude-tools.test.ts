/**
 * 文件职责：回归验证排除工具列表同时作用于内置工具、扩展工具、允许列表和活动工具集。
 * 技术维度：使用 Vitest、faux 会话夹具、TypeBox 空参数模式和扩展动态注册工具。
 * 产品维度：确保用户明确禁用的工具不会出现在模型系统提示或可执行工具集合中。
 * 逻辑维度：扩展启动时注册两个工具，分别测试普通排除和排除覆盖允许列表两种配置。
 * 关键边界：夹具绑定扩展后才产生动态工具；每个用例必须在 finally 中清理资源。
 * 新手阅读建议：先看 extensionFactories 注册内容，再比较第一例全工具视图与第二例允许列表结果。
 */
import { Type } from "typebox";
import { describe, expect, it } from "vitest";
import type { ExtensionFactory } from "../../../src/index.ts";
import { createHarness } from "../harness.ts";

/**
 * 提取并排序工具名称，便于稳定比较。
 * 参数：tools 为至少含 name 字段的工具数组。
 * 返回值：按字典序排列的名称数组。
 * 使用示例：`toolNames(harness.session.getAllTools())`。
 */
function toolNames(tools: Array<{ name: string }>): string[] {
	// tool 是当前工具对象；回调只提取其 name 字段。
	return tools.map((tool) => tool.name).sort();
}

describe("regression #5109: exclude tools", () => {
	// extensionFactories 在会话启动时动态注册 ask_question 和 dynamic_tool。
	const extensionFactories: ExtensionFactory[] = [
		// pi 是扩展 API，用于监听会话启动事件。
		(pi) => {
			// 会话启动回调注册两个结构相同但名称不同的测试工具。
			pi.on("session_start", () => {
				pi.registerTool({
					name: "ask_question",
					label: "Ask Question",
					description: "Ask a question",
					promptSnippet: "Ask a question",
					parameters: Type.Object({}),
					execute: async () => ({
						content: [{ type: "text", text: "ok" }],
						details: {},
					}),
				});
				pi.registerTool({
					name: "dynamic_tool",
					label: "Dynamic Tool",
					description: "Dynamic test tool",
					promptSnippet: "Run dynamic test behavior",
					parameters: Type.Object({}),
					execute: async () => ({
						content: [{ type: "text", text: "ok" }],
						details: {},
					}),
				});
			});
		},
	];

	// 验证排除列表从全量、活动和系统提示中移除目标工具；无参数，无返回值。
	it("filters built-in and extension tools from available and active tools", async () => {
		// harness 是排除 read 和 ask_question 的虚拟会话夹具。
		const harness = await createHarness({
			excludedToolNames: ["read", "ask_question"],
			extensionFactories,
		});
		try {
			await harness.session.bindExtensions({});

			// allToolNames 是绑定扩展后仍可见的排序工具名称。
			const allToolNames = toolNames(harness.session.getAllTools());
			expect(allToolNames).not.toContain("read");
			expect(allToolNames).not.toContain("ask_question");
			expect(allToolNames).toContain("bash");
			expect(allToolNames).toContain("dynamic_tool");
			expect(harness.session.getActiveToolNames().sort()).toEqual(["bash", "dynamic_tool", "edit", "write"]);
			expect(harness.session.systemPrompt).not.toContain("- read:");
			expect(harness.session.systemPrompt).not.toContain("ask_question");
			expect(harness.session.systemPrompt).toContain("- dynamic_tool: Run dynamic test behavior");
		} finally {
			harness.cleanup();
		}
	});

	// 验证排除列表优先于允许列表和初始活动工具配置；无参数，无返回值。
	it("lets excluded tools override the allowlist", async () => {
		// harness 同时允许和排除两个目标工具，用于检查排除优先级。
		const harness = await createHarness({
			allowedToolNames: ["read", "bash", "ask_question"],
			excludedToolNames: ["read", "ask_question"],
			initialActiveToolNames: ["read", "bash", "ask_question"],
			extensionFactories,
		});
		try {
			await harness.session.bindExtensions({});

			expect(toolNames(harness.session.getAllTools())).toEqual(["bash"]);
			expect(harness.session.getActiveToolNames()).toEqual(["bash"]);
			expect(harness.session.systemPrompt).toContain("- bash:");
			expect(harness.session.systemPrompt).not.toContain("- read:");
			expect(harness.session.systemPrompt).not.toContain("ask_question");
		} finally {
			harness.cleanup();
		}
	});
});
