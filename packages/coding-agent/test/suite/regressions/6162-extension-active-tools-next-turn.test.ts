/**
 * 文件职责：回归验证扩展在工具执行中修改活动工具后，下一次模型请求立即采用新工具并记录增量变化。
 * 技术维度：使用 Harness、伪助手工具调用、TypeBox 工具定义和扩展工厂模拟同一次代理运行的多轮请求。
 * 产品维度：让动态加载或切换工具的扩展无需等待下一次用户提示，并保留本轮系统提示覆盖。
 * 逻辑维度：分别测试替换工具集、追加工具集和 before_agent_start 系统提示在中途刷新后的延续。
 * 关键边界：工具变化发生在工具 execute 内；断言关注下一轮 provider context，而非仅会话最终状态。
 * 新手阅读建议：先看每个扩展注册的两个工具，再比较 setResponses 两次回调收到的 tools/messages/systemPrompt。
 */
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { describe, expect, it } from "vitest";
import type { ExtensionFactory } from "../../../src/index.ts";
import { createHarness } from "../harness.ts";

// 回归覆盖活动工具变化未及时进入同一运行下一轮请求的问题。
describe("extension active tools next-turn refresh", () => {
	// setActiveTools 替换工具集后，紧接着的提供商请求应只看到新工具。
	it("applies pi.setActiveTools before the next provider request in the same run", async () => {
		// extensionFactories 注册负责切换的工具和切换后可用的工具。
		const extensionFactories: ExtensionFactory[] = [
			(pi) => {
				pi.registerTool({
					name: "switch_tools",
					label: "Switch Tools",
					description: "Switch the active extension tool set",
					promptSnippet: "Switch to the next extension tool",
					parameters: Type.Object({}),
					execute: async () => {
						pi.setActiveTools(["after_switch"]);
						return {
							content: [{ type: "text", text: "switched" }],
							details: {},
						};
					},
				});

				pi.registerTool({
					name: "after_switch",
					label: "After Switch",
					description: "Tool that should be available after switching",
					promptSnippet: "Run after the active tool set changes",
					parameters: Type.Object({}),
					execute: async () => ({
						content: [{ type: "text", text: "after" }],
						details: {},
					}),
				});
			},
		];
		// harness 加载动态工具扩展并提供伪模型响应。
		const harness = await createHarness({
			extensionFactories,
		});

		try {
			harness.session.setActiveToolsByName(["switch_tools"]);

			// providerToolNames 按请求轮次记录提供商收到的工具名。
			const providerToolNames: string[][] = [];
			harness.setResponses([
				(context) => {
					providerToolNames.push((context.tools ?? []).map((tool) => tool.name).sort());
					return fauxAssistantMessage(fauxToolCall("switch_tools", {}), { stopReason: "toolUse" });
				},
				(context) => {
					providerToolNames.push((context.tools ?? []).map((tool) => tool.name).sort());
					return fauxAssistantMessage("done");
				},
			]);

			expect(harness.session.getActiveToolNames()).toEqual(["switch_tools"]);

			await harness.session.prompt("start");

			expect(harness.session.getActiveToolNames()).toEqual(["after_switch"]);
			expect(providerToolNames).toEqual([["switch_tools"], ["after_switch"]]);
		} finally {
			harness.cleanup();
		}
	});

	// 追加活动工具时，当前工具结果应记录 addedToolNames 供下一轮理解变化。
	it("records additive active tool changes on the current tool result", async () => {
		// extensionFactories 注册一个保留原工具并追加 after_load 的工具。
		const extensionFactories: ExtensionFactory[] = [
			(pi) => {
				pi.registerTool({
					name: "load_more_tools",
					label: "Load More Tools",
					description: "Load more tools",
					parameters: Type.Object({}),
					execute: async () => {
						pi.setActiveTools([...pi.getActiveTools(), "after_load"]);
						return {
							content: [{ type: "text", text: "loaded" }],
							details: {},
						};
					},
				});

				pi.registerTool({
					name: "after_load",
					label: "After Load",
					description: "Tool available after loading",
					parameters: Type.Object({}),
					execute: async () => ({
						content: [{ type: "text", text: "after" }],
						details: {},
					}),
				});
			},
		];
		// harness 是加载追加工具扩展的测试会话。
		const harness = await createHarness({ extensionFactories });

		try {
			harness.session.setActiveToolsByName(["load_more_tools"]);

			// addedToolNames 按提供商轮次记录工具结果声明的新增工具。
			const addedToolNames: string[][] = [];
			harness.setResponses([
				() => fauxAssistantMessage(fauxToolCall("load_more_tools", {}), { stopReason: "toolUse" }),
				(context) => {
					addedToolNames.push(
						context.messages
							.filter((message) => message.role === "toolResult")
							.flatMap((message) => message.addedToolNames ?? []),
					);
					return fauxAssistantMessage("done");
				},
			]);

			await harness.session.prompt("start");

			expect(harness.session.getActiveToolNames()).toEqual(["load_more_tools", "after_load"]);
			expect(addedToolNames).toEqual([["after_load"]]);
		} finally {
			harness.cleanup();
		}
	});

	// 中途重建工具上下文时，不得丢失本次运行 before_agent_start 返回的系统提示。
	it("preserves before_agent_start system prompt overrides when tools change mid-run", async () => {
		// extensionFactories 同时注册系统提示覆盖和工具切换行为。
		const extensionFactories: ExtensionFactory[] = [
			(pi) => {
				pi.on("before_agent_start", async (event) => ({
					systemPrompt: `${event.systemPrompt}\n\nkeep this run override`,
				}));

				pi.registerTool({
					name: "switch_tools",
					label: "Switch Tools",
					description: "Switch the active extension tool set",
					promptSnippet: "Switch to the next extension tool",
					parameters: Type.Object({}),
					execute: async () => {
						pi.setActiveTools(["after_switch"]);
						return {
							content: [{ type: "text", text: "switched" }],
							details: {},
						};
					},
				});

				pi.registerTool({
					name: "after_switch",
					label: "After Switch",
					description: "Tool that should be available after switching",
					promptSnippet: "Run after the active tool set changes",
					parameters: Type.Object({}),
					execute: async () => ({
						content: [{ type: "text", text: "after" }],
						details: {},
					}),
				});
			},
		];
		// harness 加载系统提示与工具切换扩展。
		const harness = await createHarness({
			extensionFactories,
		});

		try {
			harness.session.setActiveToolsByName(["switch_tools"]);

			// providerSystemPrompts 记录两轮请求实际收到的系统提示。
			const providerSystemPrompts: string[] = [];
			// providerToolNames 记录两轮请求的工具集合。
			const providerToolNames: string[][] = [];
			harness.setResponses([
				(context) => {
					providerSystemPrompts.push(context.systemPrompt ?? "");
					providerToolNames.push((context.tools ?? []).map((tool) => tool.name).sort());
					return fauxAssistantMessage(fauxToolCall("switch_tools", {}), { stopReason: "toolUse" });
				},
				(context) => {
					providerSystemPrompts.push(context.systemPrompt ?? "");
					providerToolNames.push((context.tools ?? []).map((tool) => tool.name).sort());
					return fauxAssistantMessage("done");
				},
			]);

			await harness.session.prompt("start");

			expect(providerToolNames).toEqual([["switch_tools"], ["after_switch"]]);
			expect(providerSystemPrompts).toHaveLength(2);
			expect(providerSystemPrompts[0]).toContain("keep this run override");
			expect(providerSystemPrompts[1]).toContain("keep this run override");
		} finally {
			harness.cleanup();
		}
	});
});
