/**
 * 文件职责：回归验证 #2860 中会话替换后 withSession 使用新上下文，旧 pi/ctx 失效，并覆盖 fork/switch。
 * 技术维度：使用 Vitest、假模型提供商、AgentSessionRuntime 工厂、内联扩展命令和临时会话文件。
 * 产品维度：防止扩展在新建、分叉或切换会话后继续写入旧会话，确保回调消息进入正确目标。
 * 逻辑维度：createRuntimeForTest 装配可替换运行时并重绑定扩展，各用例触发命令后检查生命周期与消息。
 * 关键边界：旧上下文在替换后必须抛错；withSession 内只能使用传入的新 ctx；所有运行时和提供商需清理。
 * 新手阅读建议：先看 createRuntimeForTest 的重绑定机制，再读 newSession 主回归，最后比较 fork 与 switchSession。
 */
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fauxAssistantMessage, registerFauxProvider } from "@earendil-works/pi-ai/compat";
import { afterEach, describe, expect, it } from "vitest";
import type { AgentSession } from "../../../src/core/agent-session.ts";
import {
	type CreateAgentSessionRuntimeFactory,
	createAgentSessionFromServices,
	createAgentSessionRuntime,
	createAgentSessionServices,
} from "../../../src/core/agent-session-runtime.ts";
import { AuthStorage } from "../../../src/core/auth-storage.ts";
import { ModelRuntime } from "../../../src/core/model-runtime.ts";
import { SessionManager } from "../../../src/core/session-manager.ts";
import type { ExtensionAPI, ExtensionCommandContext, ExtensionFactory } from "../../../src/index.ts";

/**
 * 从任意 AgentSession 消息提取文字内容。
 * @param message 会话消息。
 * @returns 字符串内容或拼接后的 text 片段。
 * @example getText(session.messages[0]);
 */
function getText(message: AgentSession["messages"][number]): string {
	if (!("content" in message)) {
		return "";
	}
	return typeof message.content === "string"
		? message.content
		: message.content
				.filter((part): part is { type: "text"; text: string } => part.type === "text")
				.map((part) => part.text)
				.join("");
}

/** 覆盖会话替换时扩展上下文失效与 withSession 回调目标。 */
describe("regression #2860: replaced session callbacks", () => {
	/** 当前 describe 注册的运行时清理函数。 */
	const cleanups: Array<() => Promise<void> | void> = [];

	/** 每个用例后按后进先出顺序执行全部清理。 */
	afterEach(async () => {
		while (cleanups.length > 0) {
			await cleanups.pop()?.();
		}
	});

	/**
	 * 创建带指定扩展和脚本回复的可替换会话运行时。
	 * @param extensionFactory 被测内联扩展工厂。
	 * @param responses 假模型按顺序返回的文本。
	 * @returns 运行时宿主与假提供商句柄。
	 * @example await createRuntimeForTest((pi) => {}, ["reply"]);
	 */
	async function createRuntimeForTest(extensionFactory: ExtensionFactory, responses: string[]) {
		/** 当前运行时独立使用的临时目录。 */
		const tempDir = join(tmpdir(), `pi-2860-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		mkdirSync(tempDir, { recursive: true });

		/** 注册脚本回复和单个模型的假提供商。 */
		const faux = registerFauxProvider({
			models: [{ id: "faux-1", reasoning: false }],
		});
		faux.setResponses(responses.map((response) => fauxAssistantMessage(response)));

		/** 保存假提供商 API Key 的内存认证存储。 */
		const authStorage = AuthStorage.inMemory();
		await authStorage.modify(faux.getModel().provider, async () => ({ type: "api_key", key: "faux-key" }));
		/** 会话服务使用的模型运行时。 */
		const modelRuntime = await ModelRuntime.create({
			credentials: authStorage,
			modelsPath: join(tempDir, "models.json"),
		});

		/** 每次新建替换会话时重新创建服务与 AgentSession 的工厂。 */
		const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
			/** 当前会话对应的服务集合。 */
			const services = await createAgentSessionServices({
				cwd,
				agentDir: tempDir,
				modelRuntime,
				resourceLoaderOptions: {
					extensionFactories: [
						(pi: ExtensionAPI) => {
							pi.registerProvider(faux.getModel().provider, {
								baseUrl: faux.getModel().baseUrl,
								apiKey: "faux-key",
								api: faux.api,
								models: faux.models.map((registeredModel) => ({
									id: registeredModel.id,
									name: registeredModel.name,
									api: registeredModel.api,
									reasoning: registeredModel.reasoning,
									input: registeredModel.input,
									cost: registeredModel.cost,
									contextWindow: registeredModel.contextWindow,
									maxTokens: registeredModel.maxTokens,
								})),
							});
							extensionFactory(pi);
						},
					],
					noSkills: true,
					noPromptTemplates: true,
					noThemes: true,
				},
			});
			return {
				...(await createAgentSessionFromServices({
					services,
					sessionManager,
					sessionStartEvent,
					model: faux.getModel(),
				})),
				services,
				diagnostics: services.diagnostics,
			};
		};

		/** 支持 new/fork/switch 的被测运行时。 */
		const runtime = await createAgentSessionRuntime(createRuntime, {
			cwd: tempDir,
			agentDir: tempDir,
			sessionManager: SessionManager.create(tempDir),
		});

		/** 将当前运行时动作重新绑定到新会话扩展上下文。 */
		const rebindSession = async (): Promise<void> => {
			/** 当前替换后的会话。 */
			const session = runtime.session;
			await session.bindExtensions({
				commandContextActions: {
					waitForIdle: () => session.agent.waitForIdle(),
					newSession: async (options) => runtime.newSession(options),
					fork: async (entryId, options) => {
						/** fork 操作的运行时结果。 */
						const result = await runtime.fork(entryId, options);
						return { cancelled: result.cancelled };
					},
					navigateTree: async (targetId, options) => {
						/** 导航树操作的会话结果。 */
						const result = await session.navigateTree(targetId, {
							summarize: options?.summarize,
							customInstructions: options?.customInstructions,
							replaceInstructions: options?.replaceInstructions,
							label: options?.label,
						});
						return { cancelled: result.cancelled };
					},
					switchSession: async (sessionPath, options) => runtime.switchSession(sessionPath, options),
					reload: async () => {
						await session.reload();
					},
				},
			});
		};

		runtime.setRebindSession(async () => {
			await rebindSession();
		});
		await rebindSession();

		cleanups.push(async () => {
			await runtime.dispose();
			faux.unregister();
			if (existsSync(tempDir)) {
				rmSync(tempDir, { recursive: true, force: true });
			}
		});

		return { runtime, faux };
	}

	it("rebinds before withSession, targets the replacement session, and invalidates stale pi/ctx", async () => {
		/** 记录 session_start/shutdown/withSession 的顺序。 */
		const events: string[] = [];
		/** 会话替换前捕获的命令上下文。 */
		let oldCtx: ExtensionCommandContext | undefined;
		/** 会话替换前捕获的扩展 API。 */
		let oldPi: ExtensionAPI | undefined;
		/** 被替换会话文件路径。 */
		let oldSessionFile: string | undefined;
		/** 旧 ctx 被访问时是否按预期抛错。 */
		let staleCtxThrows = false;
		/** 旧 pi 被使用时是否按预期抛错。 */
		let stalePiThrows = false;
		/** withSession 收到的新会话文件路径。 */
		let replacementSessionFile: string | undefined;
		/** 每次扩展重建时递增的实例编号。 */
		let instanceId = 0;
		/** 注册 repro 命令后的被测运行时。 */
		const { runtime } = await createRuntimeForTest(
			(pi) => {
				/** 当前扩展实例编号。 */
				const currentInstance = ++instanceId;
				pi.on("session_start", () => {
					events.push(`start:${currentInstance}`);
				});
				pi.on("session_shutdown", () => {
					events.push(`shutdown:${currentInstance}`);
				});
				pi.registerCommand("repro", {
					description: "repro",
					handler: async (_args, ctx) => {
						oldCtx = ctx;
						oldPi = pi;
						oldSessionFile = ctx.sessionManager.getSessionFile();
						await ctx.newSession({
							parentSession: oldSessionFile,
							withSession: async (replacedCtx) => {
								events.push(`with:${currentInstance}`);
								replacementSessionFile = replacedCtx.sessionManager.getSessionFile();
								try {
									oldCtx?.sessionManager.getSessionFile();
								} catch {
									staleCtxThrows = true;
								}
								try {
									oldPi?.sendUserMessage("stale message");
								} catch {
									stalePiThrows = true;
								}
								await replacedCtx.sendUserMessage("Hello from the new session!");
							},
						});
					},
				});
			},
			["hello reply"],
		);

		expect(events).toEqual(["start:1"]);

		await runtime.session.prompt("/repro");

		expect(events).toEqual(["start:1", "shutdown:1", "start:2", "with:1"]);
		expect(replacementSessionFile).toBeDefined();
		expect(replacementSessionFile).not.toBe(oldSessionFile);
		expect(staleCtxThrows).toBe(true);
		expect(stalePiThrows).toBe(true);
		expect(runtime.session.messages.map((message) => `${message.role}:${getText(message)}`)).toEqual([
			"user:Hello from the new session!",
			"assistant:hello reply",
		]);
	});

	it("supports withSession for fork", async () => {
		/** 注册 fork-it 命令后的被测运行时。 */
		const { runtime } = await createRuntimeForTest(
			(pi) => {
				pi.registerCommand("fork-it", {
					description: "fork-it",
					handler: async (_args, ctx) => {
						/** 当前会话叶节点标识。 */
						const leafId = ctx.sessionManager.getLeafId();
						if (!leafId) {
							throw new Error("Missing leaf id");
						}
						await ctx.fork(leafId, {
							position: "at",
							withSession: async (replacedCtx) => {
								await replacedCtx.sendUserMessage("fork callback message");
							},
						});
					},
				});
			},
			["seed reply", "fork reply"],
		);

		await runtime.session.prompt("seed");
		await runtime.session.prompt("/fork-it");

		expect(runtime.session.messages.map((message) => `${message.role}:${getText(message)}`)).toEqual([
			"user:seed",
			"assistant:seed reply",
			"user:fork callback message",
			"assistant:fork reply",
		]);
	});

	it("supports withSession for switchSession", async () => {
		/** switch-it 命令要切换到的目标会话路径。 */
		let targetSessionPath = "";
		/** 注册 switch-it 命令后的被测运行时。 */
		const { runtime } = await createRuntimeForTest(
			(pi) => {
				pi.registerCommand("switch-it", {
					description: "switch-it",
					handler: async (_args, ctx) => {
						await ctx.switchSession(targetSessionPath, {
							withSession: async (replacedCtx) => {
								await replacedCtx.sendUserMessage("switch callback message");
							},
						});
					},
				});
			},
			["root reply", "target reply", "switch reply"],
		);

		await runtime.session.prompt("root");
		/** 初始 root 会话文件路径。 */
		const originalSessionPath = runtime.session.sessionFile;
		/** 创建目标会话的运行时结果。 */
		const newSessionResult = await runtime.newSession();
		expect(newSessionResult.cancelled).toBe(false);
		await runtime.session.prompt("target");
		targetSessionPath = runtime.session.sessionFile!;
		await runtime.switchSession(originalSessionPath!);

		await runtime.session.prompt("/switch-it");

		expect(runtime.session.sessionFile).toBe(targetSessionPath);
		expect(runtime.session.messages.map((message) => `${message.role}:${getText(message)}`)).toEqual([
			"user:target",
			"assistant:target reply",
			"user:switch callback message",
			"assistant:switch reply",
		]);
	});
});
