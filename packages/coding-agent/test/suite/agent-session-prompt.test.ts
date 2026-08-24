import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { fauxAssistantMessage, fauxToolCall, type Model } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { afterEach, describe, expect, it } from "vitest";
import type { InputEvent } from "../../src/core/extensions/index.ts";
import type { PromptTemplate } from "../../src/core/prompt-templates.ts";
import { createSyntheticSourceInfo } from "../../src/core/source-info.ts";
import { createTestResourceLoader } from "../utilities.ts";
import { createHarness, getMessageText, type Harness } from "./harness.ts";

describe("AgentSession prompt characterization", () => {
	/** 当前文件创建且需清理的 Harness。 */
	const harnesses: Harness[] = [];
	/** 技能等用例创建且需删除的临时目录。 */
	const tempDirs: string[] = [];

	/** 每个用例后释放 Harness 并删除临时目录。 */
	afterEach(() => {
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
		while (tempDirs.length > 0) {
			/** 从清理栈弹出的最近临时目录。 */
			const tempDir = tempDirs.pop();
			if (tempDir) {
				rmSync(tempDir, { recursive: true, force: true });
			}
		}
	});

	/** 验证空闲时 prompt 记录用户消息和单个文本响应。 */
	it("prompts while idle and records a single text response", async () => {
		/** 使用默认配置的 Harness。 */
		const harness = await createHarness();
		harnesses.push(harness);

		harness.setResponses([fauxAssistantMessage("hello")]);

		await harness.session.prompt("hi");

		expect(harness.session.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
		expect(getMessageText(harness.session.messages[0]!)).toBe("hi");
		expect(harness.getPendingResponseCount()).toBe(0);
	});

	/** 验证工具调用完成后继续等待下一次模型响应。 */
	it("handles a tool call turn and waits for the follow-up LLM response", async () => {
		/** echo 工具实际收到的文本。 */
		const toolRuns: string[] = [];
		/** 回显参数的测试工具。 */
		const echoTool: AgentTool = {
			name: "echo",
			label: "Echo",
			description: "Echo text back",
			parameters: Type.Object({ text: Type.String() }),
			execute: async (_toolCallId, params) => {
				/** 从未知参数安全读取的 text。 */
				const text = typeof params === "object" && params !== null && "text" in params ? String(params.text) : "";
				toolRuns.push(text);
				return {
					content: [{ type: "text", text: `echo:${text}` }],
					details: { text },
				};
			},
		};
		/** 只注册 echo 工具的 Harness。 */
		const harness = await createHarness({ tools: [echoTool] });
		harnesses.push(harness);

		harness.setResponses([
			fauxAssistantMessage(fauxToolCall("echo", { text: "hello" }), { stopReason: "toolUse" }),
			fauxAssistantMessage("done"),
		]);

		await harness.session.prompt("start");

		expect(toolRuns).toEqual(["hello"]);
		expect(harness.session.messages.map((message) => message.role)).toEqual([
			"user",
			"assistant",
			"toolResult",
			"assistant",
		]);
		expect(harness.session.messages[2]?.role).toBe("toolResult");
		expect(harness.session.messages[3]?.role).toBe("assistant");
	});

	/** 验证同一响应中的多个工具并行完成后只触发一次后续模型请求。 */
	it("executes multiple tool calls from one response and continues with a single follow-up response", async () => {
		/** 两个工具实际完成的名称和值记录。 */
		const toolRuns: string[] = [];
		/** 创建带指定延迟的回显工具。返回 AgentTool。示例：makeTool("slow", 25)。 */
		const makeTool = (name: string, delayMs: number): AgentTool => ({
			name,
			label: name,
			description: `${name} tool`,
			parameters: Type.Object({ value: Type.String() }),
			execute: async (_toolCallId, params) => {
				/** 从未知参数安全读取的 value。 */
				const value =
					typeof params === "object" && params !== null && "value" in params ? String(params.value) : "";
				await new Promise((resolve) => setTimeout(resolve, delayMs));
				toolRuns.push(`${name}:${value}`);
				return {
					content: [{ type: "text", text: `${name}:${value}` }],
					details: { value },
				};
			},
		});
		/** 注册快慢两个工具的 Harness。 */
		const harness = await createHarness({ tools: [makeTool("slow", 25), makeTool("fast", 0)] });
		harnesses.push(harness);

		harness.setResponses([
			fauxAssistantMessage([fauxToolCall("slow", { value: "a" }), fauxToolCall("fast", { value: "b" })], {
				stopReason: "toolUse",
			}),
			(context) => {
				/** 提供商上下文中的全部工具结果。 */
				const toolResults = context.messages.filter((message) => message.role === "toolResult");
				return fauxAssistantMessage(`tool results: ${toolResults.length}`);
			},
		]);

		await harness.session.prompt("run tools");

		expect(toolRuns.sort()).toEqual(["fast:b", "slow:a"]);
		expect(harness.session.messages.filter((message) => message.role === "toolResult")).toHaveLength(2);
		expect(harness.session.messages[harness.session.messages.length - 1]?.role).toBe("assistant");
	});

	/** 验证图片附件完整进入提供商上下文。 */
	it("preserves image attachments in the provider context", async () => {
		/** 使用默认配置的 Harness。 */
		const harness = await createHarness();
		harnesses.push(harness);
		/** 伪提供商是否看到 image 内容块。 */
		let sawImage = false;

		harness.setResponses([
			(context) => {
				/** 提供商上下文中的用户消息。 */
				const user = context.messages.find((message) => message.role === "user");
				sawImage =
					user?.role === "user" &&
					typeof user.content !== "string" &&
					user.content.some((part) => part.type === "image");
				return fauxAssistantMessage("ok");
			},
		]);

		await harness.session.prompt("describe", {
			images: [
				{
					type: "image",
					mimeType: "image/png",
					data: "ZmFrZQ==",
				},
			],
		});

		expect(sawImage).toBe(true);
	});

	/** 验证 /skill:name 命令在调用模型前展开技能正文。 */
	it("expands skill commands before sending the prompt", async () => {
		/** 保存临时 SKILL.md 的目录。 */
		const tempDir = join(tmpdir(), `pi-skill-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		mkdirSync(tempDir, { recursive: true });
		tempDirs.push(tempDir);
		/** 临时技能文件路径。 */
		const skillPath = join(tempDir, "test-skill.md");
		writeFileSync(skillPath, "# Test Skill\n\nUse the skill body.");

		/** 在默认资源加载器上覆盖技能列表的测试加载器。 */
		const resourceLoader = {
			...createTestResourceLoader(),
			getSkills: () => ({
				skills: [
					{
						name: "test",
						description: "Test skill",
						filePath: skillPath,
						disableModelInvocation: false,
						baseDir: tempDir,
						sourceInfo: createSyntheticSourceInfo(skillPath, {
							source: "local",
							scope: "project",
							origin: "top-level",
							baseDir: tempDir,
						}),
					},
				],
				diagnostics: [],
			}),
		};
		/** 使用自定义技能资源的 Harness。 */
		const harness = await createHarness({ resourceLoader });
		harnesses.push(harness);
		/** 伪提供商最终收到的展开后提示。 */
		let expandedPrompt = "";

		harness.setResponses([
			(context) => {
				/** 提供商上下文中的用户消息。 */
				const user = context.messages.find((message) => message.role === "user");
				expandedPrompt = user ? getMessageText(user) : "";
				return fauxAssistantMessage("ok");
			},
		]);

		await harness.session.prompt("/skill:test explain this");

		expect(expandedPrompt).toContain('<skill name="test" location="');
		expect(expandedPrompt).toContain("Use the skill body.");
		expect(expandedPrompt).toContain("explain this");
	});

	/** 验证 /template 参数替换在调用模型前完成。 */
	it("expands prompt templates before sending the prompt", async () => {
		/** 将首个参数插入正文的测试提示模板。 */
		const template: PromptTemplate = {
			name: "review",
			description: "Review template",
			content: "Review this code: $1",
			filePath: "/virtual/review.md",
			sourceInfo: createSyntheticSourceInfo("/virtual/review.md", {
				source: "local",
				scope: "temporary",
				origin: "top-level",
			}),
		};
		/** 在默认资源加载器上覆盖提示模板列表的加载器。 */
		const resourceLoader = {
			...createTestResourceLoader(),
			getPrompts: () => ({ prompts: [template], diagnostics: [] }),
		};
		/** 使用自定义提示模板资源的 Harness。 */
		const harness = await createHarness({ resourceLoader });
		harnesses.push(harness);
		/** 伪提供商最终收到的展开后提示。 */
		let expandedPrompt = "";

		harness.setResponses([
			(context) => {
				/** 提供商上下文中的用户消息。 */
				const user = context.messages.find((message) => message.role === "user");
				expandedPrompt = user ? getMessageText(user) : "";
				return fauxAssistantMessage("ok");
			},
		]);

		await harness.session.prompt("/review src/index.ts");

		expect(expandedPrompt).toBe("Review this code: src/index.ts");
	});

	/** 验证扩展命令直接执行且不消费伪提供商响应。 */
	it("dispatches extension commands without consuming a provider response", async () => {
		/** testcmd 实际收到的参数。 */
		const commandRuns: string[] = [];
		/** 注册 testcmd 扩展命令的 Harness。 */
		const harness = await createHarness({
			extensionFactories: [
				(pi) => {
					pi.registerCommand("testcmd", {
						description: "Test command",
						handler: async (args) => {
							commandRuns.push(args);
						},
					});
				},
			],
		});
		harnesses.push(harness);
		harness.setResponses([fauxAssistantMessage("should stay queued")]);

		await harness.session.prompt("/testcmd hello world");

		expect(commandRuns).toEqual(["hello world"]);
		expect(harness.session.messages).toEqual([]);
		expect(harness.getPendingResponseCount()).toBe(1);
	});

	/** 验证空闲时 sendUserMessage 会自动触发模型轮次。 */
	it("sendUserMessage while idle triggers a turn", async () => {
		/** 使用默认配置的 Harness。 */
		const harness = await createHarness();
		harnesses.push(harness);

		harness.setResponses([fauxAssistantMessage("response")]);

		await harness.session.sendUserMessage("from extension");

		expect(harness.session.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
		expect(getMessageText(harness.session.messages[0]!)).toBe("from extension");
	});

	/** 验证空闲 prompt 的 input 事件不暴露无意义的 streamingBehavior。 */
	it("does not report streamingBehavior to input handlers while idle", async () => {
		/** input 扩展监听器收到的事件。 */
		const inputEvents: InputEvent[] = [];
		/** 注册 input 监听器的 Harness。 */
		const harness = await createHarness({
			extensionFactories: [
				(pi) => {
					pi.on("input", (event) => {
						inputEvents.push(event);
					});
				},
			],
		});
		harnesses.push(harness);
		harness.setResponses([fauxAssistantMessage("ok")]);

		await harness.session.prompt("idle", { streamingBehavior: "followUp" });

		expect(inputEvents).toHaveLength(1);
		expect(inputEvents[0]?.streamingBehavior).toBeUndefined();
	});

	/** 验证流式处理中排队的 prompt 会向 input 事件报告 followUp。 */
	it("reports streamingBehavior to input handlers while streaming", async () => {
		/** 手动释放 wait 工具执行的回调。 */
		let releaseToolExecution: (() => void) | undefined;
		/** wait 工具在此 Promise 完成前保持执行中。 */
		const toolRelease = new Promise<void>((resolve) => {
			releaseToolExecution = resolve;
		});
		/** input 扩展监听器收到的事件。 */
		const inputEvents: InputEvent[] = [];
		/** 等待手动释放后返回结果的测试工具。 */
		const waitTool: AgentTool = {
			name: "wait",
			label: "Wait",
			description: "Wait for release",
			parameters: Type.Object({}),
			execute: async () => {
				await toolRelease;
				return {
					content: [{ type: "text", text: "released" }],
					details: {},
				};
			},
		};
		/** 注册 wait 工具和 input 监听器的 Harness。 */
		const harness = await createHarness({
			tools: [waitTool],
			extensionFactories: [
				(pi) => {
					pi.on("input", (event) => {
						inputEvents.push(event);
					});
				},
			],
		});
		harnesses.push(harness);
		harness.setResponses([
			fauxAssistantMessage(fauxToolCall("wait", {}), { stopReason: "toolUse" }),
			fauxAssistantMessage("done"),
		]);

		/** 首次 tool_execution_start 时完成的同步 Promise。 */
		const sawToolStart = new Promise<void>((resolve) => {
			/** 工具开始后立即移除的事件订阅。 */
			const unsubscribe = harness.session.subscribe((event) => {
				if (event.type === "tool_execution_start") {
					unsubscribe();
					resolve();
				}
			});
		});

		/** 因 wait 工具而保持进行中的首个 prompt。 */
		const promptPromise = harness.session.prompt("start");
		await sawToolStart;
		await harness.session.prompt("queued", { streamingBehavior: "followUp" });

		expect(inputEvents.map((event) => event.streamingBehavior)).toEqual([undefined, "followUp"]);

		releaseToolExecution?.();
		await promptPromise;
	});

	/** 验证流式处理中缺少 streamingBehavior 的第二个 prompt 被拒绝。 */
	it("throws when prompted during streaming without a streamingBehavior", async () => {
		/** 手动释放 wait 工具执行的回调。 */
		let releaseToolExecution: (() => void) | undefined;
		/** wait 工具在此 Promise 完成前保持执行中。 */
		const toolRelease = new Promise<void>((resolve) => {
			releaseToolExecution = resolve;
		});
		/** 等待手动释放后返回结果的测试工具。 */
		const waitTool: AgentTool = {
			name: "wait",
			label: "Wait",
			description: "Wait for release",
			parameters: Type.Object({}),
			execute: async () => {
				await toolRelease;
				return {
					content: [{ type: "text", text: "released" }],
					details: {},
				};
			},
		};
		/** 只注册 wait 工具的 Harness。 */
		const harness = await createHarness({ tools: [waitTool] });
		harnesses.push(harness);
		harness.setResponses([
			fauxAssistantMessage(fauxToolCall("wait", {}), { stopReason: "toolUse" }),
			fauxAssistantMessage("done"),
		]);

		/** 首次 tool_execution_start 时完成的同步 Promise。 */
		const sawToolStart = new Promise<void>((resolve) => {
			/** 工具开始后立即移除的事件订阅。 */
			const unsubscribe = harness.session.subscribe((event) => {
				if (event.type === "tool_execution_start") {
					unsubscribe();
					resolve();
				}
			});
		});

		/** 因 wait 工具而保持进行中的首个 prompt。 */
		const promptPromise = harness.session.prompt("start");
		await sawToolStart;

		await expect(harness.session.prompt("second")).rejects.toThrow(
			"Agent is already processing. Specify streamingBehavior ('steer' or 'followUp') to queue the message.",
		);

		releaseToolExecution?.();
		await promptPromise;
	});

	/** 验证没有选定模型时 prompt 明确失败。 */
	it("throws when prompting without a model", async () => {
		/** 随后会清空 Agent 模型的 Harness。 */
		const harness = await createHarness();
		harnesses.push(harness);
		harness.session.agent.state.model = undefined as unknown as Model<any>;

		await expect(harness.session.prompt("hi")).rejects.toThrow("No model selected.");
	});

	/** 验证没有配置提供商认证时 prompt 明确失败。 */
	it("throws when prompting without configured auth", async () => {
		/** 未配置认证的 Harness。 */
		const harness = await createHarness({ withConfiguredAuth: false });
		harnesses.push(harness);

		await expect(harness.session.prompt("hi")).rejects.toThrow(
			`No API key found for ${harness.getModel().provider}.`,
		);
	});
});
/**
 * 文件职责：刻画 AgentSession.prompt 在空闲、工具循环、附件、技能、模板、扩展命令和流式排队状态下的行为。
 * 技术维度：使用 Harness、faux 提供商、TypeBox 工具、可控 Promise 和临时技能文件执行无网络集成测试。
 * 产品维度：保障用户输入在各种入口和运行状态下被正确展开、排队或拒绝，并等待完整模型/工具循环。
 * 逻辑维度：从基础 prompt 与工具调用开始，再验证资源展开、命令分派、sendUserMessage、input 事件和流式并发边界。
 * 关键边界：Harness 与临时目录必须清理；流式期间新 prompt 必须指定 steer/followUp；无模型或认证时应立即报错。
 * 新手阅读建议：先读基础 prompt 和单/多工具用例，再看技能模板展开，最后比较空闲与流式 input 行为。
 */
