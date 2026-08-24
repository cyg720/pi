/**
 * 文件职责：刻画 AgentSessionRuntime 创建、扩展绑定、消息替换、新建/恢复/分叉会话和跨目录状态恢复。
 * 技术维度：使用 Vitest、faux 提供商、内存认证、会话运行时服务工厂和临时文件型/内存型 SessionManager。
 * 产品维度：保障用户切换、恢复或分叉任务时扩展事件顺序、模型、思考等级、工作目录和消息保持一致。
 * 逻辑维度：共享工厂建立完整运行时，再依次验证消息持久化、切换取消、分叉语义、内存分叉与跨目录恢复。
 * 关键边界：每个运行时与 faux 注册都必须加入 cleanups；文件型会话首个助手响应前尚未真正写入磁盘。
 * 新手阅读建议：先读 createRuntimeForTest 的服务装配，再看 new/resume 事件序列，最后阅读 fork 和跨 cwd 用例。
 */

import { existsSync, mkdirSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, parse } from "node:path";
import { fauxAssistantMessage, registerFauxProvider } from "@earendil-works/pi-ai/compat";
import { afterEach, describe, expect, it } from "vitest";
import {
	type CreateAgentSessionRuntimeFactory,
	createAgentSessionFromServices,
	createAgentSessionRuntime,
	createAgentSessionServices,
} from "../../src/core/agent-session-runtime.ts";
import { AuthStorage } from "../../src/core/auth-storage.ts";
import { SessionManager } from "../../src/core/session-manager.ts";
import type {
	ExtensionAPI,
	ExtensionFactory,
	SessionBeforeForkEvent,
	SessionBeforeSwitchEvent,
	SessionShutdownEvent,
	SessionStartEvent,
} from "../../src/index.ts";

/** 记录类型：汇总本文件关注的切换前、分叉前、关闭和启动扩展事件。 */
type RecordedSessionEvent =
	| SessionBeforeSwitchEvent
	| SessionBeforeForkEvent
	| SessionShutdownEvent
	| SessionStartEvent;

/** 测试分组：AgentSessionRuntime 的生命周期与会话替换行为。 */
describe("AgentSessionRuntime characterization", () => {
	/** 变量 cleanups：按后进先出顺序保存的运行时释放与临时目录清理函数；仅在当前函数或测试范围内有效。 */
	const cleanups: Array<() => Promise<void> | void> = [];

	afterEach(async () => {
		while (cleanups.length > 0) {
			await cleanups.pop()?.();
		}
	});

	/** 创建带两个 faux 模型与指定扩展的完整测试运行时。参数 extensionFactory 注册测试行为，options 可控制 cwd 和初始模型状态；返回 runtime、faux 与临时目录。例如：await createRuntimeForTest(pi => {})。 */
	async function createRuntimeForTest(
		extensionFactory: ExtensionFactory,
		options?: { cwd?: string; bootstrapModel?: boolean; bootstrapThinkingLevel?: boolean },
	) {
		/** 变量 tempDir：当前运行时使用的临时工作和 agent 目录；仅在当前函数或测试范围内有效。 */
		const tempDir =
			options?.cwd ?? join(tmpdir(), `pi-runtime-suite-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		mkdirSync(tempDir, { recursive: true });

		/** 变量 faux：提供两个模型和固定响应的 faux 注册项；仅在当前函数或测试范围内有效。 */
		const faux = registerFauxProvider({
			models: [
				{ id: "faux-1", reasoning: true },
				{ id: "faux-2", reasoning: false },
			],
		});
		faux.setResponses([fauxAssistantMessage("one"), fauxAssistantMessage("two"), fauxAssistantMessage("three")]);

		/** 变量 authStorage：保存 faux API key 的内存认证存储；仅在当前函数或测试范围内有效。 */
		const authStorage = AuthStorage.inMemory();
		await authStorage.modify(faux.getModel().provider, async () => ({ type: "api_key", key: "faux-key" }));

		/** 变量 runtimeOptions：创建会话服务所需的认证、模型和资源加载配置；仅在当前函数或测试范围内有效。 */
		const runtimeOptions = {
			agentDir: tempDir,
			authStorage,
			model: options?.bootstrapModel === false ? undefined : faux.getModel(),
			thinkingLevel: options?.bootstrapThinkingLevel === false ? undefined : undefined,
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
		};
		/** 变量 createRuntime：根据 cwd、SessionManager 和启动事件组装会话运行时的工厂；仅在当前函数或测试范围内有效。 */
		const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
			/** 变量 services：为当前工作目录创建的认证、模型和资源服务集合；仅在当前函数或测试范围内有效。 */
			const services = await createAgentSessionServices({
				...runtimeOptions,
				cwd,
			});
			return {
				...(await createAgentSessionFromServices({
					services,
					sessionManager,
					sessionStartEvent,
					model: runtimeOptions.model,
					thinkingLevel: runtimeOptions.thinkingLevel,
				})),
				services,
				diagnostics: services.diagnostics,
			};
		};
		/** 变量 runtime：当前场景被测的 AgentSessionRuntime；仅在当前函数或测试范围内有效。 */
		const runtime = await createAgentSessionRuntime(createRuntime, {
			cwd: tempDir,
			agentDir: tempDir,
			sessionManager: SessionManager.create(tempDir),
		});
		await runtime.session.bindExtensions({});

		cleanups.push(async () => {
			await runtime.dispose();
			faux.unregister();
			if (existsSync(tempDir)) {
				rmSync(tempDir, { recursive: true, force: true });
			}
		});

		return { runtime, faux, tempDir };
	}

	/** 测试场景：验证当前消息持久化、会话切换、分叉或状态恢复语义。 */
	it("persists message_end assistant replacements to the session manager", async () => {
		/** 解构变量：从测试工厂结果取得当前场景需要的运行时、faux 注册或临时目录。 */
		const { runtime } = await createRuntimeForTest((pi: ExtensionAPI) => {
			pi.on("message_end", (event) => {
				if (event.message.role !== "assistant") return;

				return {
					message: {
						...event.message,
						usage: {
							...event.message.usage,
							cost: {
								...event.message.usage.cost,
								total: 0.123,
							},
						},
					},
				};
			});
		});

		await runtime.session.prompt("hello");

		/** 变量 sessionAssistant：运行时内存消息中找到的助手回复；仅在当前函数或测试范围内有效。 */
		const sessionAssistant = runtime.session.messages.find((message) => message.role === "assistant");
		expect(sessionAssistant?.role).toBe("assistant");
		if (sessionAssistant?.role !== "assistant") {
			throw new Error("missing assistant message");
		}
		expect(sessionAssistant.usage.cost.total).toBe(0.123);

		/** 变量 persistedAssistant：SessionManager 条目中持久化的助手回复；仅在当前函数或测试范围内有效。 */
		const persistedAssistant = runtime.session.sessionManager
			.getEntries()
			.filter((entry) => entry.type === "message")
			.map((entry) => entry.message)
			.find((message) => message.role === "assistant");
		expect(persistedAssistant?.role).toBe("assistant");
		if (persistedAssistant?.role !== "assistant") {
			throw new Error("missing persisted assistant message");
		}
		expect(persistedAssistant.usage.cost.total).toBe(0.123);
	});

	/** 测试场景：验证当前消息持久化、会话切换、分叉或状态恢复语义。 */
	it("emits session_before_switch and session_start for new and resume flows", async () => {
		/** 变量 events：按发生顺序收集的会话扩展事件；仅在当前函数或测试范围内有效。 */
		const events: RecordedSessionEvent[] = [];
		/** 解构变量：从测试工厂结果取得当前场景需要的运行时、faux 注册或临时目录。 */
		const { runtime } = await createRuntimeForTest((pi: ExtensionAPI) => {
			pi.on("session_before_switch", (event) => {
				events.push(event);
			});
			pi.on("session_shutdown", (event) => {
				events.push(event);
			});
			pi.on("session_start", (event) => {
				events.push(event);
			});
		});

		expect(events).toEqual([{ type: "session_start", reason: "startup" }]);
		events.length = 0;

		await runtime.session.prompt("hello");
		/** 变量 originalSessionFile：切换前原会话的文件路径；仅在当前函数或测试范围内有效。 */
		const originalSessionFile = runtime.session.sessionFile;
		/** 变量 originalSession：切换前原 AgentSession 对象；仅在当前函数或测试范围内有效。 */
		const originalSession = runtime.session;

		/** 变量 newSessionResult：新建会话操作的取消状态；仅在当前函数或测试范围内有效。 */
		const newSessionResult = await runtime.newSession();
		expect(newSessionResult.cancelled).toBe(false);
		await runtime.session.bindExtensions({});
		expect(runtime.session).not.toBe(originalSession);
		expect(runtime.session.messages).toEqual([]);
		/** 变量 secondSessionFile：新建后的第二个会话文件路径；仅在当前函数或测试范围内有效。 */
		const secondSessionFile = runtime.session.sessionFile;
		expect(events).toEqual([
			{ type: "session_before_switch", reason: "new", targetSessionFile: undefined },
			{ type: "session_shutdown", reason: "new", targetSessionFile: secondSessionFile },
			{ type: "session_start", reason: "new", previousSessionFile: originalSessionFile },
		]);

		events.length = 0;

		/** 变量 switchResult：恢复原会话操作的返回结果；仅在当前函数或测试范围内有效。 */
		const switchResult = await runtime.switchSession(originalSessionFile!);
		expect(switchResult.cancelled).toBe(false);
		await runtime.session.bindExtensions({});
		expect(events).toEqual([
			{ type: "session_before_switch", reason: "resume", targetSessionFile: originalSessionFile },
			{ type: "session_shutdown", reason: "resume", targetSessionFile: originalSessionFile },
			{ type: "session_start", reason: "resume", previousSessionFile: secondSessionFile },
		]);
	});

	/** 测试场景：验证当前消息持久化、会话切换、分叉或状态恢复语义。 */
	it("honors session_before_switch cancellation for new and resume", async () => {
		/** 变量 events：按发生顺序收集的会话扩展事件；仅在当前函数或测试范围内有效。 */
		const events: RecordedSessionEvent[] = [];
		/** 变量 cancelReason：当前扩展应取消的 new 或 resume 原因；仅在当前函数或测试范围内有效。 */
		let cancelReason: "new" | "resume" | undefined;
		/** 解构变量：从测试工厂结果取得当前场景需要的运行时、faux 注册或临时目录。 */
		const { runtime } = await createRuntimeForTest((pi: ExtensionAPI) => {
			pi.on("session_before_switch", (event) => {
				events.push(event);
				if (event.reason === cancelReason) {
					return { cancel: true };
				}
			});
			pi.on("session_start", (event) => {
				events.push(event);
			});
		});

		await runtime.session.prompt("hello");
		/** 变量 originalSessionFile：切换前原会话的文件路径；仅在当前函数或测试范围内有效。 */
		const originalSessionFile = runtime.session.sessionFile;

		cancelReason = "new";
		/** 变量 newResult：被取消的新建会话结果；仅在当前函数或测试范围内有效。 */
		const newResult = await runtime.newSession();
		expect(newResult.cancelled).toBe(true);
		expect(runtime.session.sessionFile).toBe(originalSessionFile);

		events.length = 0;
		/** 变量 otherDir：另一个会话所在的临时目录；仅在当前函数或测试范围内有效。 */
		const otherDir = join(tmpdir(), `pi-runtime-other-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		mkdirSync(otherDir, { recursive: true });
		/** 变量 otherSession：用于恢复取消测试的独立 SessionManager；仅在当前函数或测试范围内有效。 */
		const otherSession = SessionManager.create(otherDir);
		otherSession.appendMessage({ role: "user", content: [{ type: "text", text: "other" }], timestamp: Date.now() });
		/** 变量 otherSessionFile：另一个会话的文件路径；仅在当前函数或测试范围内有效。 */
		const otherSessionFile = otherSession.getSessionFile();
		cancelReason = "resume";
		/** 变量 resumeResult：被取消的恢复会话结果；仅在当前函数或测试范围内有效。 */
		const resumeResult = await runtime.switchSession(otherSessionFile!);
		expect(resumeResult.cancelled).toBe(true);
		expect(runtime.session.sessionFile).toBe(originalSessionFile);
	});

	/** 测试场景：验证当前消息持久化、会话切换、分叉或状态恢复语义。 */
	it("emits session_before_fork and session_start and honors cancellation", async () => {
		/** 变量 events：按发生顺序收集的会话扩展事件；仅在当前函数或测试范围内有效。 */
		const events: RecordedSessionEvent[] = [];
		/** 变量 cancelNextFork：下一次分叉是否由扩展取消；仅在当前函数或测试范围内有效。 */
		let cancelNextFork = false;
		/** 解构变量：从测试工厂结果取得当前场景需要的运行时、faux 注册或临时目录。 */
		const { runtime } = await createRuntimeForTest((pi: ExtensionAPI) => {
			pi.on("session_before_fork", (event) => {
				events.push(event);
				if (cancelNextFork) {
					cancelNextFork = false;
					return { cancel: true };
				}
			});
			pi.on("session_shutdown", (event) => {
				events.push(event);
			});
			pi.on("session_start", (event) => {
				events.push(event);
			});
		});

		events.length = 0;
		await runtime.session.prompt("hello");
		/** 变量 userMessage：当前会话中可供分叉的第一条用户消息信息；仅在当前函数或测试范围内有效。 */
		const userMessage = runtime.session.getUserMessagesForForking()[0]!;
		/** 变量 previousSessionFile：执行分叉前的会话文件；仅在当前函数或测试范围内有效。 */
		const previousSessionFile = runtime.session.sessionFile;

		/** 变量 successResult：成功分叉操作的结果；仅在当前函数或测试范围内有效。 */
		const successResult = await runtime.fork(userMessage.entryId);
		expect(successResult.cancelled).toBe(false);
		expect(successResult.selectedText).toBe("hello");
		await runtime.session.bindExtensions({});
		expect(events).toEqual([
			{ type: "session_before_fork", entryId: userMessage.entryId, position: "before" },
			{ type: "session_shutdown", reason: "fork", targetSessionFile: runtime.session.sessionFile },
			{ type: "session_start", reason: "fork", previousSessionFile },
		]);
		/** 变量 sessionFileName：分叉后会话文件的不含扩展名名称；仅在当前函数或测试范围内有效。 */
		const sessionFileName = parse(runtime.session.sessionFile!).name;
		expect(sessionFileName.endsWith(`_${runtime.session.sessionId}`)).toBe(true);

		events.length = 0;
		cancelNextFork = true;
		/** 变量 cancelResult：扩展取消普通分叉后的结果；仅在当前函数或测试范围内有效。 */
		const cancelResult = await runtime.fork(userMessage.entryId);
		expect(cancelResult).toEqual({ cancelled: true });
		expect(events).toEqual([{ type: "session_before_fork", entryId: userMessage.entryId, position: "before" }]);

		events.length = 0;
		cancelNextFork = true;
		/** 变量 cancelAtResult：扩展取消当前位置分叉后的结果；仅在当前函数或测试范围内有效。 */
		const cancelAtResult = await runtime.fork("missing-entry", { position: "at" });
		expect(cancelAtResult).toEqual({ cancelled: true });
		expect(events).toEqual([{ type: "session_before_fork", entryId: "missing-entry", position: "at" }]);
	});

	/** 测试场景：验证当前消息持久化、会话切换、分叉或状态恢复语义。 */
	it("reports why an unflushed session cannot be forked", async () => {
		/** 解构变量：从测试工厂结果取得当前场景需要的运行时、faux 注册或临时目录。 */
		const { runtime } = await createRuntimeForTest(() => {});
		/** 变量 sessionFile：当前尚未落盘的预留会话文件路径；仅在当前函数或测试范围内有效。 */
		const sessionFile = runtime.session.sessionFile;
		/** 变量 leafId：当前活动分支的叶条目编号；仅在当前函数或测试范围内有效。 */
		const leafId = runtime.session.sessionManager.getLeafId();
		expect(sessionFile).toBeDefined();
		expect(existsSync(sessionFile!)).toBe(false);
		expect(leafId).toBeTruthy();

		await expect(runtime.fork(leafId!, { position: "at" })).rejects.toThrow(
			"This session has not been saved yet. Wait for the first assistant response before cloning or forking it.",
		);
	});

	/** 测试场景：验证当前消息持久化、会话切换、分叉或状态恢复语义。 */
	it("duplicates the current active branch when forking at the current position", async () => {
		/** 解构变量：从测试工厂结果取得当前场景需要的运行时、faux 注册或临时目录。 */
		const { runtime } = await createRuntimeForTest(() => {});
		await runtime.session.prompt("hello");
		await runtime.session.prompt("again");

		/** 变量 beforeMessages：分叉前规范化后的角色与用户文本数组；仅在当前函数或测试范围内有效。 */
		const beforeMessages = runtime.session.messages.map((message) => ({
			role: message.role,
			text:
				message.role === "user"
					? typeof message.content === "string"
						? message.content
						: message.content
								.filter((part): part is { type: "text"; text: string } => part.type === "text")
								.map((part) => part.text)
								.join("")
					: undefined,
		}));
		/** 变量 previousSessionFile：执行分叉前的会话文件；仅在当前函数或测试范围内有效。 */
		const previousSessionFile = runtime.session.sessionFile;
		/** 变量 leafId：当前活动分支的叶条目编号；仅在当前函数或测试范围内有效。 */
		const leafId = runtime.session.sessionManager.getLeafId();
		expect(leafId).toBeTruthy();

		/** 变量 result：当前位置分叉操作的结果；仅在当前函数或测试范围内有效。 */
		const result = await runtime.fork(leafId!, { position: "at" });
		expect(result).toEqual({ cancelled: false, selectedText: undefined });
		expect(runtime.session.sessionFile).not.toBe(previousSessionFile);
		expect(
			runtime.session.messages.map((message) => ({
				role: message.role,
				text:
					message.role === "user"
						? typeof message.content === "string"
							? message.content
							: message.content
									.filter((part): part is { type: "text"; text: string } => part.type === "text")
									.map((part) => part.text)
									.join("")
						: undefined,
			})),
		).toEqual(beforeMessages);
	});

	/** 测试场景：验证当前消息持久化、会话切换、分叉或状态恢复语义。 */
	it("duplicates the current active branch in-memory when forking at the current position", async () => {
		/** 变量 tempDir：当前运行时使用的临时工作和 agent 目录；仅在当前函数或测试范围内有效。 */
		const tempDir = join(tmpdir(), `pi-runtime-suite-in-memory-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		mkdirSync(tempDir, { recursive: true });

		/** 变量 faux：提供两个模型和固定响应的 faux 注册项；仅在当前函数或测试范围内有效。 */
		const faux = registerFauxProvider({
			models: [
				{ id: "faux-1", reasoning: true },
				{ id: "faux-2", reasoning: false },
			],
		});
		faux.setResponses([fauxAssistantMessage("one"), fauxAssistantMessage("two"), fauxAssistantMessage("three")]);

		/** 变量 authStorage：保存 faux API key 的内存认证存储；仅在当前函数或测试范围内有效。 */
		const authStorage = AuthStorage.inMemory();
		await authStorage.modify(faux.getModel().provider, async () => ({ type: "api_key", key: "faux-key" }));

		/** 变量 runtimeOptions：创建会话服务所需的认证、模型和资源加载配置；仅在当前函数或测试范围内有效。 */
		const runtimeOptions = {
			agentDir: tempDir,
			authStorage,
			model: faux.getModel(),
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
					},
				],
				noSkills: true,
				noPromptTemplates: true,
				noThemes: true,
			},
		};
		/** 变量 createRuntime：根据 cwd、SessionManager 和启动事件组装会话运行时的工厂；仅在当前函数或测试范围内有效。 */
		const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
			/** 变量 services：为当前工作目录创建的认证、模型和资源服务集合；仅在当前函数或测试范围内有效。 */
			const services = await createAgentSessionServices({
				...runtimeOptions,
				cwd,
			});
			return {
				...(await createAgentSessionFromServices({
					services,
					sessionManager,
					sessionStartEvent,
					model: runtimeOptions.model,
				})),
				services,
				diagnostics: services.diagnostics,
			};
		};
		/** 变量 runtime：当前场景被测的 AgentSessionRuntime；仅在当前函数或测试范围内有效。 */
		const runtime = await createAgentSessionRuntime(createRuntime, {
			cwd: tempDir,
			agentDir: tempDir,
			sessionManager: SessionManager.inMemory(tempDir),
		});
		await runtime.session.bindExtensions({});
		cleanups.push(async () => {
			await runtime.dispose();
			faux.unregister();
			if (existsSync(tempDir)) {
				rmSync(tempDir, { recursive: true, force: true });
			}
		});

		await runtime.session.prompt("hello");
		await runtime.session.prompt("again");

		/** 变量 beforeMessages：分叉前规范化后的角色与用户文本数组；仅在当前函数或测试范围内有效。 */
		const beforeMessages = runtime.session.messages.map((message) => ({
			role: message.role,
			text:
				message.role === "user"
					? typeof message.content === "string"
						? message.content
						: message.content
								.filter((part): part is { type: "text"; text: string } => part.type === "text")
								.map((part) => part.text)
								.join("")
					: undefined,
		}));
		/** 变量 leafId：当前活动分支的叶条目编号；仅在当前函数或测试范围内有效。 */
		const leafId = runtime.session.sessionManager.getLeafId();
		expect(leafId).toBeTruthy();
		expect(runtime.session.sessionFile).toBeUndefined();

		/** 变量 result：当前位置分叉操作的结果；仅在当前函数或测试范围内有效。 */
		const result = await runtime.fork(leafId!, { position: "at" });
		expect(result).toEqual({ cancelled: false, selectedText: undefined });
		expect(runtime.session.sessionFile).toBeUndefined();
		expect(
			runtime.session.messages.map((message) => ({
				role: message.role,
				text:
					message.role === "user"
						? typeof message.content === "string"
							? message.content
							: message.content
									.filter((part): part is { type: "text"; text: string } => part.type === "text")
									.map((part) => part.text)
									.join("")
						: undefined,
			})),
		).toEqual(beforeMessages);
	});

	/** 测试场景：验证当前消息持久化、会话切换、分叉或状态恢复语义。 */
	it("throws when forking with an invalid entry id", async () => {
		/** 解构变量：从测试工厂结果取得当前场景需要的运行时、faux 注册或临时目录。 */
		const { runtime } = await createRuntimeForTest(() => {});
		await expect(runtime.fork("missing-entry")).rejects.toThrow("Invalid entry ID for forking");
	});

	/** 测试场景：验证当前消息持久化、会话切换、分叉或状态恢复语义。 */
	it("updates the runtime session cwd on cross-cwd session replacement", async () => {
		/** 变量 firstDir：跨目录切换测试的源工作目录；仅在当前函数或测试范围内有效。 */
		const firstDir = join(tmpdir(), `pi-runtime-cwd-a-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		/** 变量 secondDir：跨目录切换测试的目标工作目录；仅在当前函数或测试范围内有效。 */
		const secondDir = join(tmpdir(), `pi-runtime-cwd-b-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		mkdirSync(firstDir, { recursive: true });
		mkdirSync(secondDir, { recursive: true });
		/** 解构变量：从测试工厂结果取得当前场景需要的运行时、faux 注册或临时目录。 */
		const { runtime, faux, tempDir } = await createRuntimeForTest(() => {}, { cwd: firstDir });
		/** 变量 otherAuthStorage：目标运行时使用的独立内存认证存储；仅在当前函数或测试范围内有效。 */
		const otherAuthStorage = AuthStorage.inMemory();
		await otherAuthStorage.modify(faux.getModel().provider, async () => ({ type: "api_key", key: "faux-key" }));
		/** 变量 otherRuntimeOptions：目标运行时的服务创建配置；仅在当前函数或测试范围内有效。 */
		const otherRuntimeOptions = {
			agentDir: tempDir,
			authStorage: otherAuthStorage,
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
					},
				],
				noSkills: true,
				noPromptTemplates: true,
				noThemes: true,
			},
		};
		/** 变量 createOtherRuntime：为目标目录创建会话运行时的工厂；仅在当前函数或测试范围内有效。 */
		const createOtherRuntime: CreateAgentSessionRuntimeFactory = async ({
			cwd,
			sessionManager,
			sessionStartEvent,
		}) => {
			/** 变量 services：为当前工作目录创建的认证、模型和资源服务集合；仅在当前函数或测试范围内有效。 */
			const services = await createAgentSessionServices({
				...otherRuntimeOptions,
				cwd,
			});
			return {
				...(await createAgentSessionFromServices({
					services,
					sessionManager,
					sessionStartEvent,
				})),
				services,
				diagnostics: services.diagnostics,
			};
		};
		/** 变量 otherRuntime：目标目录中的独立 AgentSessionRuntime；仅在当前函数或测试范围内有效。 */
		const otherRuntime = await createAgentSessionRuntime(createOtherRuntime, {
			cwd: secondDir,
			agentDir: tempDir,
			sessionManager: SessionManager.create(secondDir),
		});
		cleanups.push(async () => {
			await otherRuntime.dispose();
		});
		await otherRuntime.session.prompt("other");
		/** 变量 otherSessionFile：另一个会话的文件路径；仅在当前函数或测试范围内有效。 */
		const otherSessionFile = otherRuntime.session.sessionFile!;

		await runtime.switchSession(otherSessionFile);

		expect(realpathSync(runtime.session.sessionManager.getCwd())).toBe(realpathSync(secondDir));
		expect(realpathSync(runtime.cwd)).toBe(realpathSync(secondDir));
	});

	/** 测试场景：验证当前消息持久化、会话切换、分叉或状态恢复语义。 */
	it("restores model and thinking state from the destination session", async () => {
		/** 解构变量：从测试工厂结果取得当前场景需要的运行时、faux 注册或临时目录。 */
		const { runtime, faux, tempDir } = await createRuntimeForTest(() => {}, {
			bootstrapModel: false,
			bootstrapThinkingLevel: false,
		});
		/** 变量 otherDir：另一个会话所在的临时目录；仅在当前函数或测试范围内有效。 */
		const otherDir = join(tempDir, "other");
		mkdirSync(otherDir, { recursive: true });
		/** 变量 otherAuthStorage：目标运行时使用的独立内存认证存储；仅在当前函数或测试范围内有效。 */
		const otherAuthStorage = AuthStorage.inMemory();
		await otherAuthStorage.modify(faux.getModel().provider, async () => ({ type: "api_key", key: "faux-key" }));
		/** 变量 otherRuntimeOptions：目标运行时的服务创建配置；仅在当前函数或测试范围内有效。 */
		const otherRuntimeOptions = {
			agentDir: tempDir,
			authStorage: otherAuthStorage,
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
					},
				],
				noSkills: true,
				noPromptTemplates: true,
				noThemes: true,
			},
		};
		/** 变量 createOtherRuntime：为目标目录创建会话运行时的工厂；仅在当前函数或测试范围内有效。 */
		const createOtherRuntime: CreateAgentSessionRuntimeFactory = async ({
			cwd,
			sessionManager,
			sessionStartEvent,
		}) => {
			/** 变量 services：为当前工作目录创建的认证、模型和资源服务集合；仅在当前函数或测试范围内有效。 */
			const services = await createAgentSessionServices({
				...otherRuntimeOptions,
				cwd,
			});
			return {
				...(await createAgentSessionFromServices({
					services,
					sessionManager,
					sessionStartEvent,
				})),
				services,
				diagnostics: services.diagnostics,
			};
		};
		/** 变量 otherRuntime：目标目录中的独立 AgentSessionRuntime；仅在当前函数或测试范围内有效。 */
		const otherRuntime = await createAgentSessionRuntime(createOtherRuntime, {
			cwd: otherDir,
			agentDir: tempDir,
			sessionManager: SessionManager.create(otherDir),
		});
		cleanups.push(async () => {
			await otherRuntime.dispose();
		});
		await otherRuntime.session.setModel(faux.getModel("faux-2")!);
		otherRuntime.session.setThinkingLevel("off");
		await otherRuntime.session.prompt("hello");
		/** 变量 targetSessionFile：保存目标模型和思考状态的会话文件；仅在当前函数或测试范围内有效。 */
		const targetSessionFile = otherRuntime.session.sessionFile!;

		await runtime.switchSession(targetSessionFile);

		expect(runtime.session.model?.id).toBe("faux-2");
		expect(runtime.session.thinkingLevel).toBe("off");
	});
});
