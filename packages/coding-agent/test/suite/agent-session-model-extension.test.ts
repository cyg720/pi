/**
 * 文件职责：刻画 AgentSession 的模型切换、思考级别以及扩展对工具、上下文、输入、系统提示和生命周期的影响。
 * 技术维度：使用无网络 Harness、faux 消息、TypeBox 工具和内联扩展工厂执行完整事件链测试。
 * 产品维度：保障用户切换模型和扩展定制不会破坏认证、会话记录、工具结果或提示上下文。
 * 逻辑维度：先测试模型与思考设置，再覆盖工具拦截/改写、上下文与输入变换、命令查看选项及生命周期事件。
 * 关键边界：每个 Harness 必须清理；模型认证可显式关闭；扩展修改只应影响提供商上下文，不回写原用户消息。
 * 新手阅读建议：先读 setModel 与 cycleModel，用工具拦截理解扩展钩子，再阅读 context/input/before_agent_start 差异。
 */
import type { AgentTool, ThinkingLevel } from "@earendil-works/pi-agent-core";
import { fauxAssistantMessage, fauxToolCall, type Model, type Usage } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { afterEach, describe, expect, it } from "vitest";
import type { BuildSystemPromptOptions, ExtensionAPI } from "../../src/index.ts";
import { createHarness, getAssistantTexts, type Harness } from "./harness.ts";

describe("AgentSession model and extension characterization", () => {
	/** 当前文件创建且需在 afterEach 清理的 Harness。 */
	const harnesses: Harness[] = [];

	/** 每个用例结束后释放全部测试资源。 */
	afterEach(() => {
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
	});

	/** 验证 setModel 持久化模型变更并发出 model_select。 */
	it("setModel saves the model and emits model_select", async () => {
		/** 扩展观察到的“旧模型->新模型:来源”记录。 */
		const modelEvents: string[] = [];
		/** 注册两个模型和 model_select 监听器的 Harness。 */
		const harness = await createHarness({
			models: [
				{ id: "faux-1", name: "One", reasoning: true },
				{ id: "faux-2", name: "Two", reasoning: true },
			],
			extensionFactories: [
				(pi) => {
					pi.on("model_select", async (event) => {
						modelEvents.push(`${event.previousModel?.id ?? "none"}->${event.model.id}:${event.source}`);
					});
				},
			],
		});
		harnesses.push(harness);
		/** 准备切换到的第二个模型。 */
		const nextModel = harness.getModel("faux-2")!;

		await harness.session.setModel(nextModel);

		expect(harness.session.model?.id).toBe("faux-2");
		expect(modelEvents).toEqual(["faux-1->faux-2:set"]);
		expect(
			harness.sessionManager
				.getEntries()
				.filter((entry) => entry.type === "model_change")
				.map((entry) => `${entry.provider}/${entry.modelId}`),
		).toEqual([`${nextModel.provider}/${nextModel.id}`]);
	});

	/** 验证 scoped 模型循环，并恢复每个模型保存的思考偏好。 */
	it("cycles through scoped models and preserves the scoped thinking preference", async () => {
		/** 一个推理模型和一个非推理模型组成的 Harness。 */
		const harness = await createHarness({
			models: [
				{ id: "faux-1", name: "One", reasoning: true },
				{ id: "faux-2", name: "Two", reasoning: false },
			],
		});
		harnesses.push(harness);
		/** 支持推理的第一个模型。 */
		const modelOne = harness.getModel("faux-1")!;
		/** 不支持推理的第二个模型。 */
		const modelTwo = harness.getModel("faux-2")!;
		harness.session.setScopedModels([{ model: modelOne, thinkingLevel: "high" }, { model: modelTwo }] as Array<{
			model: Model<string>;
			thinkingLevel?: ThinkingLevel;
		}>);
		harness.session.setThinkingLevel("high");

		await harness.session.cycleModel();
		expect(harness.session.model?.id).toBe("faux-2");
		expect(harness.session.thinkingLevel).toBe("off");

		await harness.session.cycleModel();
		expect(harness.session.model?.id).toBe("faux-1");
		expect(harness.session.thinkingLevel).toBe("high");
	});

	/** 验证不支持推理的模型把级别限制为 off。 */
	it("clamps thinking levels to model capabilities and cycles available levels", async () => {
		/** 只包含非推理模型的 Harness。 */
		const harness = await createHarness({ models: [{ id: "faux-1", reasoning: false }] });
		harnesses.push(harness);

		harness.session.setThinkingLevel("high");
		expect(harness.session.thinkingLevel).toBe("off");
		expect(harness.session.cycleThinkingLevel()).toBeUndefined();
	});

	/** 验证同时支持 xhigh/max 时循环顺序正确。 */
	it("cycles xhigh before max when both are supported", async () => {
		/** 包含可自定义思考映射模型的 Harness。 */
		const harness = await createHarness({ models: [{ id: "faux-1", reasoning: true }] });
		harnesses.push(harness);
		harness.getModel().thinkingLevelMap = { xhigh: "xhigh", max: "max" };

		expect(harness.session.getAvailableThinkingLevels()).toEqual([
			"off",
			"minimal",
			"low",
			"medium",
			"high",
			"xhigh",
			"max",
		]);
		harness.session.setThinkingLevel("high");
		expect(harness.session.cycleThinkingLevel()).toBe("xhigh");
		expect(harness.session.cycleThinkingLevel()).toBe("max");
		expect(harness.session.cycleThinkingLevel()).toBe("off");
	});

	/** 验证目标提供商没有认证时 setModel 明确失败。 */
	it("throws when setModel is called without configured auth", async () => {
		/** 有两个模型但未配置认证的 Harness。 */
		const harness = await createHarness({
			models: [
				{ id: "faux-1", name: "One", reasoning: true },
				{ id: "faux-2", name: "Two", reasoning: true },
			],
			withConfiguredAuth: false,
		});
		harnesses.push(harness);

		await expect(harness.session.setModel(harness.getModel("faux-2")!)).rejects.toThrow(
			`No API key for ${harness.getModel().provider}/faux-2`,
		);
	});

	/** 验证 tool_call 扩展钩子可阻止实际工具执行。 */
	it("allows extension tool_call handlers to block tool execution", async () => {
		/** 若实际执行就抛错的 echo 工具。 */
		const echoTool: AgentTool = {
			name: "echo",
			label: "Echo",
			description: "Echo text back",
			parameters: Type.Object({ text: Type.String() }),
			execute: async () => {
				throw new Error("tool should have been blocked");
			},
		};
		/** 注册工具拦截扩展的 Harness。 */
		const harness = await createHarness({
			tools: [echoTool],
			extensionFactories: [
				(pi) => {
					pi.on("tool_call", async () => ({ block: true, reason: "Blocked by test" }));
				},
			],
		});
		harnesses.push(harness);
		harness.setResponses([
			fauxAssistantMessage([fauxToolCall("echo", { text: "hello" })], { stopReason: "toolUse" }),
			(context) => {
				/** 上下文中扩展生成的错误工具结果。 */
				const toolResult = context.messages.find((message) => message.role === "toolResult");
				/** 从工具结果提取的错误文本。 */
				const errorText =
					toolResult?.role === "toolResult"
						? toolResult.content
								.filter((part): part is { type: "text"; text: string } => part.type === "text")
								.map((part) => part.text)
								.join("\n")
						: "";
				return fauxAssistantMessage(errorText);
			},
		]);

		await harness.session.prompt("hi");

		expect(getAssistantTexts(harness)).toContain("Blocked by test");
		expect(
			harness.session.messages.find((message) => message.role === "toolResult" && message.isError),
		).toBeDefined();
	});

	/** 验证 tool_result 扩展钩子可改写内容、详情和用量。 */
	it("allows extension tool_result handlers to modify tool results", async () => {
		/** 原始工具执行返回的用量。 */
		const toolUsage: Usage = {
			input: 1,
			output: 2,
			cacheRead: 3,
			cacheWrite: 4,
			totalTokens: 10,
			cost: { input: 0.1, output: 0.2, cacheRead: 0.3, cacheWrite: 0.4, total: 1 },
		};
		/** 扩展替换后的工具用量。 */
		const patchedToolUsage: Usage = {
			input: 5,
			output: 6,
			cacheRead: 7,
			cacheWrite: 8,
			totalTokens: 26,
			cost: { input: 0.5, output: 0.6, cacheRead: 0.7, cacheWrite: 0.8, total: 2.6 },
		};
		/** 扩展实际观察到的原始工具用量。 */
		let observedToolUsage: Usage | undefined;
		/** 回显参数并附带 toolUsage 的测试工具。 */
		const echoTool: AgentTool = {
			name: "echo",
			label: "Echo",
			description: "Echo text back",
			parameters: Type.Object({ text: Type.String() }),
			execute: async (_toolCallId, params) => {
				/** 从未知参数安全读取的 text。 */
				const text = typeof params === "object" && params !== null && "text" in params ? String(params.text) : "";
				return { content: [{ type: "text", text }], details: { text }, usage: toolUsage };
			},
		};
		/** 注册工具结果改写扩展的 Harness。 */
		const harness = await createHarness({
			tools: [echoTool],
			extensionFactories: [
				(pi) => {
					pi.on("tool_result", async (event) => {
						observedToolUsage = event.usage;
						return {
							content: [{ type: "text", text: "patched result" }],
							details: { patched: true },
							usage: patchedToolUsage,
						};
					});
				},
			],
		});
		harnesses.push(harness);
		harness.setResponses([
			fauxAssistantMessage([fauxToolCall("echo", { text: "hello" })], { stopReason: "toolUse" }),
			(context) => {
				/** 提供商上下文中的已改写工具结果。 */
				const toolResult = context.messages.find((message) => message.role === "toolResult");
				/** 从已改写工具结果提取的文本。 */
				const text =
					toolResult?.role === "toolResult"
						? toolResult.content
								.filter((part): part is { type: "text"; text: string } => part.type === "text")
								.map((part) => part.text)
								.join("\n")
						: "";
				return fauxAssistantMessage(text);
			},
		]);

		await harness.session.prompt("hi");

		expect(getAssistantTexts(harness)).toContain("patched result");
		/** 会话中详情带 patched 标记的工具结果。 */
		const toolResult = harness.session.messages.find(
			(message) => message.role === "toolResult" && message.details?.patched === true,
		);
		expect(observedToolUsage).toEqual(toolUsage);
		expect(toolResult).toBeDefined();
		expect(toolResult?.role === "toolResult" ? toolResult.usage : undefined).toEqual(patchedToolUsage);
	});

	/** 验证 context 钩子仅在调用模型前改写消息。 */
	it("allows extension context handlers to modify messages before the LLM call", async () => {
		/** 注册用户消息重写 context 钩子的 Harness。 */
		const harness = await createHarness({
			extensionFactories: [
				(pi) => {
					pi.on("context", async (event) => ({
						messages: event.messages.map((message) =>
							message.role === "user"
								? { ...message, content: [{ type: "text", text: "rewritten" }], timestamp: message.timestamp }
								: message,
						),
					}));
				},
			],
		});
		harnesses.push(harness);
		/** 伪提供商最终看到的用户文本。 */
		let providerUserText = "";
		harness.setResponses([
			(context) => {
				/** 提供商上下文中的用户消息。 */
				const user = context.messages.find((message) => message.role === "user");
				providerUserText =
					user && typeof user.content !== "string"
						? user.content
								.filter((part): part is { type: "text"; text: string } => part.type === "text")
								.map((part) => part.text)
								.join("\n")
						: "";
				return fauxAssistantMessage("done");
			},
		]);

		await harness.session.prompt("original");

		expect(providerUserText).toBe("rewritten");
		/** 会话持久化的原始用户消息。 */
		const storedUserMessage = harness.session.messages.find((message) => message.role === "user");
		expect(storedUserMessage?.role).toBe("user");
		if (storedUserMessage?.role === "user") {
			expect(storedUserMessage.content).toEqual([{ type: "text", text: "original" }]);
		}
	});

	/** 验证 input 钩子可变换文本或完全处理输入。 */
	it("allows extension input handlers to transform or handle input", async () => {
		/** 工厂回调中捕获的扩展 API。 */
		let extensionApi: ExtensionAPI | undefined;
		/** 注册 transform/handled 输入钩子的 Harness。 */
		const transformedHarness = await createHarness({
			extensionFactories: [
				(pi) => {
					extensionApi = pi;
					pi.on("input", async (event) => {
						if (event.text === "ping") {
							return { action: "handled" };
						}
						return { action: "transform", text: `transformed:${event.text}` };
					});
				},
			],
		});
		harnesses.push(transformedHarness);
		/** 伪提供商最终看到的变换后用户文本。 */
		let providerUserText = "";
		transformedHarness.setResponses([
			(context) => {
				/** 提供商上下文中的用户消息。 */
				const user = context.messages.find((message) => message.role === "user");
				providerUserText =
					user && typeof user.content !== "string"
						? user.content
								.filter((part): part is { type: "text"; text: string } => part.type === "text")
								.map((part) => part.text)
								.join("\n")
						: "";
				return fauxAssistantMessage("done");
			},
		]);

		await transformedHarness.session.prompt("hello");
		await transformedHarness.session.prompt("ping");

		expect(providerUserText).toBe("transformed:hello");
		expect(transformedHarness.session.messages.filter((message) => message.role === "user")).toHaveLength(1);
		expect(extensionApi).toBeDefined();
	});

	/** 验证扩展命令可取得同一个实时系统提示选项对象。 */
	it("allows extension commands to inspect live system prompt options", async () => {
		/** 两次命令调用观察到的系统提示选项。 */
		const seenOptions: BuildSystemPromptOptions[] = [];
		/** 注册 inspect-options 命令的 Harness。 */
		const harness = await createHarness({
			extensionFactories: [
				(pi) => {
					pi.registerCommand("inspect-options", {
						description: "Inspect system prompt options",
						handler: async (_args, ctx) => {
							/** 命令上下文返回的实时选项引用。 */
							const options = ctx.getSystemPromptOptions();
							seenOptions.push(options);
							options.selectedTools?.push("mutated_tool");
						},
					});
				},
			],
		});
		harnesses.push(harness);

		await harness.session.prompt("/inspect-options");
		await harness.session.prompt("/inspect-options");

		expect(seenOptions).toHaveLength(2);
		expect(seenOptions[0]).toBe(seenOptions[1]);
		expect(seenOptions[0]?.cwd).toBe(harness.tempDir);
		expect(seenOptions[0]?.selectedTools).toContain("read");
		expect(seenOptions[1]?.selectedTools).toContain("mutated_tool");
	});

	/** 验证 before_agent_start 可注入自定义消息并扩展系统提示。 */
	it("allows before_agent_start handlers to inject custom messages and modify the system prompt", async () => {
		/** 注册 before_agent_start 返回值的 Harness。 */
		const harness = await createHarness({
			extensionFactories: [
				(pi) => {
					pi.on("before_agent_start", async (event) => ({
						message: {
							customType: "before-start",
							content: "injected",
							display: true,
							details: { injected: true },
						},
						systemPrompt: `${event.systemPrompt}\n\nextra instructions`,
					}));
				},
			],
		});
		harnesses.push(harness);
		/** 伪提供商收到的系统提示。 */
		let providerSystemPrompt = "";
		/** 伪提供商上下文是否包含注入消息文本。 */
		let sawInjectedUserMessage = false;
		harness.setResponses([
			(context) => {
				providerSystemPrompt = context.systemPrompt ?? "";
				sawInjectedUserMessage = context.messages.some(
					(message) =>
						message.role === "user" &&
						typeof message.content !== "string" &&
						message.content.some((part) => part.type === "text" && part.text === "injected"),
				);
				return fauxAssistantMessage("done");
			},
		]);

		await harness.session.prompt("hello");

		expect(providerSystemPrompt).toContain("extra instructions");
		expect(sawInjectedUserMessage).toBe(true);
		expect(
			harness.session.messages.some((message) => message.role === "custom" && message.customType === "before-start"),
		).toBe(true);
	});

	/** 验证扩展绑定和重载发出成对生命周期事件。 */
	it("bindExtensions emits session_start and reload emits session_shutdown then session_start", async () => {
		/** 扩展观察到的生命周期事件顺序。 */
		const lifecycleEvents: string[] = [];
		/** 注册 session_start/session_shutdown 监听器的 Harness。 */
		const harness = await createHarness({
			extensionFactories: [
				(pi) => {
					pi.on("session_start", async (event) => {
						lifecycleEvents.push(`start:${event.reason}`);
					});
					pi.on("session_shutdown", async (event) => {
						lifecycleEvents.push(`shutdown:${event.reason}`);
					});
				},
			],
		});
		harnesses.push(harness);

		await harness.session.bindExtensions({ shutdownHandler: () => {} });
		await harness.session.reload();

		expect(lifecycleEvents).toEqual(["start:startup", "shutdown:reload", "start:reload"]);
	});
});
/**
 * 文件职责：刻画 AgentSession 的模型切换、思考级别以及扩展对工具、上下文、输入、系统提示和生命周期的影响。
 * 技术维度：使用无网络 Harness、faux 消息、TypeBox 工具和内联扩展工厂执行完整事件链测试。
 * 产品维度：保障用户切换模型和扩展定制不会破坏认证、会话记录、工具结果或提示上下文。
 * 逻辑维度：先测试模型与思考设置，再覆盖工具拦截/改写、上下文与输入变换、命令查看选项及生命周期事件。
 * 关键边界：每个 Harness 必须清理；模型认证可显式关闭；扩展修改只应影响提供商上下文，不回写原用户消息。
 * 新手阅读建议：先读 setModel 与 cycleModel，用工具拦截理解扩展钩子，再阅读 context/input/before_agent_start 差异。
 */
